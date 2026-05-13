// ============================================================
// cross-domain-deliberate.ts
//
// Sprint 3 — TRIGGER ENDPOINT (refactored from synchronous to
// fire-and-forget). Validates the request, creates a pending
// cd_deliberation_log row, fires the background function, and
// returns 202 in <1s. Real execution happens in
// cross-domain-deliberate-background.ts (15-min ceiling).
//
// Background invocation uses Method A from the Netlify docs:
// plain HTTPS POST to the function URL. Netlify routes any
// function whose filename ends in `-background.ts` to the
// async runtime automatically — no header needed.
//
// Auth: x-health-key + cross_domain_intelligence flag (same as
// cross-domain-health). Idempotency: a second request for the
// same anomaly within 30s returns the existing deliberation_id
// instead of starting a new chain.
// ============================================================

import { randomUUID } from "node:crypto";
import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isCrossDomainEnabled } from "../../src/lib/cross-domain/featureFlags";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-health-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const IDEMPOTENCY_WINDOW_MS = 30 * 1000;

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body, null, 2) };
}

function getOrgFromJwt(event: HandlerEvent): string | null {
  try {
    const auth =
      event.headers["authorization"] || event.headers["Authorization"] || "";
    if (!auth) return null;
    const token = auth.replace(/^Bearer\s+/i, "");
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64").toString("utf8")
    );
    return payload?.app_metadata?.org_id ?? null;
  } catch {
    return null;
  }
}

// Pick the site base URL Netlify knows about. process.env.URL is set
// automatically on Netlify; fall back to deriving from event.rawUrl
// for local netlify-dev runs.
function getSiteBaseUrl(event: HandlerEvent): string {
  if (process.env.URL) return process.env.URL;
  if (event.rawUrl) {
    try {
      const u = new URL(event.rawUrl);
      return `${u.protocol}//${u.host}`;
    } catch {
      // fallthrough
    }
  }
  return "";
}

async function findExistingInFlight(
  supabase: SupabaseClient,
  org_id: string,
  anomaly_id: string
): Promise<string | null> {
  const cutoffISO = new Date(Date.now() - IDEMPOTENCY_WINDOW_MS).toISOString();
  const { data } = await supabase
    .from("cd_deliberation_log")
    .select("id")
    .eq("org_id", org_id)
    .eq("finding_id", anomaly_id)
    .is("deliberation_completed_at", null)
    .gte("created_at", cutoffISO)
    .order("created_at", { ascending: false })
    .maybeSingle();
  if (!data) return null;
  return (data as { id?: string }).id ?? null;
}

async function createPendingRow(
  supabase: SupabaseClient,
  deliberation_id: string,
  org_id: string,
  anomaly_id: string
): Promise<void> {
  await supabase.from("cd_deliberation_log").insert({
    id: deliberation_id,
    org_id,
    finding_id: anomaly_id,
    finding_type: "anomaly",
    // deliberation_started_at intentionally null — background sets it
    // when execution begins. Polling endpoint reads null as 'pending'.
    deliberation_started_at: null,
    specialist_outputs: [],
    arbitration_rules_applied: {},
    consensus_level: null,
    escalated_to_human: false,
    total_cost_usd: 0,
  });
}

async function markTriggerFailed(
  supabase: SupabaseClient,
  deliberation_id: string,
  reason: string
): Promise<void> {
  try {
    // Sprint 3.1: consensus_level conforms to the CHECK constraint
    // (unanimous|majority_with_dissent|split|unresolved). The failure
    // signal lives in arbitration_rules_applied; the status endpoint
    // surfaces it via deriveStatus.
    await supabase
      .from("cd_deliberation_log")
      .update({
        arbitration_rules_applied: { error: reason, final_status: "failed" },
        consensus_level: "unresolved",
        escalated_to_human: true,
        deliberation_completed_at: new Date().toISOString(),
      })
      .eq("id", deliberation_id);
  } catch {
    /* best-effort */
  }
}

// Method A: plain HTTPS POST to the -background function URL.
// Netlify auto-detects the `-background` suffix and runs the
// callee in the async runtime — caller does NOT await the body.
async function invokeBackground(
  baseUrl: string,
  deliberation_id: string,
  anomaly_id: string,
  org_id: string
): Promise<void> {
  const url = `${baseUrl}/.netlify/functions/cross-domain-deliberate-background`;
  // We DO await the fetch() promise so we can catch invocation errors
  // (DNS failure, etc.) and report them to the client. Background
  // functions respond 202 in <100ms regardless of how long the work
  // actually takes, so this await does not block on the deliberation.
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deliberation_id, anomaly_id, org_id }),
  });
  if (!res.ok && res.status !== 202) {
    throw new Error(`background invocation returned ${res.status}`);
  }
}

// Exported for testing: the full trigger flow with supabase injected.
export async function handleTriggerRequest(
  event: HandlerEvent,
  supabase: SupabaseClient
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  const expected = process.env.CROSS_DOMAIN_HEALTH_KEY;
  if (!expected) {
    return json(500, { error: "CROSS_DOMAIN_HEALTH_KEY not configured" });
  }
  const provided =
    event.headers["x-health-key"] || event.headers["X-Health-Key"] || "";
  if (provided !== expected) {
    return json(401, { error: "unauthorized" });
  }

  const queryOrg = event.queryStringParameters?.org_id;
  const orgId = queryOrg || getOrgFromJwt(event);
  if (!orgId) {
    return json(400, {
      error: "org_id required (provide ?org_id= or Bearer JWT)",
    });
  }

  let body: { anomaly_id?: string };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return json(400, { error: "invalid_json_body" });
  }
  if (!body.anomaly_id) {
    return json(400, { error: "anomaly_id required" });
  }
  const anomaly_id = body.anomaly_id;

  const enabled = await isCrossDomainEnabled(orgId, supabase);
  if (!enabled) {
    return json(403, {
      error: "cross_domain_intelligence flag not enabled for this org",
    });
  }

  // Idempotency: if a deliberation for this anomaly started in the
  // last 30s and hasn't completed, return its id without starting a
  // new chain. Cheap protection against double-clicks and retries.
  const existingId = await findExistingInFlight(supabase, orgId, anomaly_id);
  if (existingId) {
    return json(200, {
      already_running: true,
      deliberation_id: existingId,
      poll_url: `/.netlify/functions/cross-domain-deliberation-status?id=${existingId}&org_id=${orgId}`,
    });
  }

  const deliberation_id = randomUUID();
  await createPendingRow(supabase, deliberation_id, orgId, anomaly_id);

  try {
    await invokeBackground(
      getSiteBaseUrl(event),
      deliberation_id,
      anomaly_id,
      orgId
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markTriggerFailed(
      supabase,
      deliberation_id,
      `background_trigger_failed: ${message}`
    );
    return json(500, {
      error: "background_trigger_failed",
      deliberation_id,
      detail: message,
    });
  }

  return json(202, {
    deliberation_id,
    status: "pending",
    poll_url: `/.netlify/functions/cross-domain-deliberation-status?id=${deliberation_id}&org_id=${orgId}`,
  });
}

export const handler: Handler = async (event) => {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !supabaseKey) {
    return json(500, { error: "Supabase env not configured" });
  }
  const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);
  return handleTriggerRequest(event, supabase);
};
