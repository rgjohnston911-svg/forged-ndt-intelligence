// ============================================================
// cross-domain-deliberation-status.ts
//
// Sprint 3 — polling endpoint. GET ?id=<deliberation_id>&org_id=<org_id>.
// Derives status from existing cd_deliberation_log columns; no
// schema change required. Tenant-isolated: 404 if id+org_id don't
// match a row (never leak that a deliberation exists for another org).
// ============================================================

import type { Handler, HandlerEvent } from "@netlify/functions";
import type {} from "@supabase/supabase-js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  deriveStatus,
  specialistsCompleted,
  currentSpecialist,
  progressPct,
  elapsedMs,
  extractFailureReason,
  SPECIALIST_ORDER,
  type DeliberationLogRow,
} from "../../src/lib/cross-domain/deliberationState";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-health-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

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

export async function handleStatusRequest(
  event: HandlerEvent,
  supabase: SupabaseClient
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "GET") {
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

  const id = event.queryStringParameters?.id;
  const queryOrg = event.queryStringParameters?.org_id;
  const orgId = queryOrg || getOrgFromJwt(event);
  if (!id) return json(400, { error: "id required" });
  if (!orgId) return json(400, { error: "org_id required" });

  const { data } = await supabase
    .from("cd_deliberation_log")
    .select(
      "id, org_id, deliberation_started_at, deliberation_completed_at, specialist_outputs, synthesizer_decision, arbitration_rules_applied, consensus_level, escalated_to_human, total_cost_usd"
    )
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!data) {
    // Tenant isolation: do NOT distinguish "wrong org" from "not found".
    return json(404, { error: "deliberation_not_found" });
  }
  const row = data as DeliberationLogRow;
  const status = deriveStatus(row);
  const completed = specialistsCompleted(row);
  const current = status === "running" ? currentSpecialist(completed) : null;
  const progress = progressPct(completed.length);

  return json(200, {
    deliberation_id: row.id,
    status,
    started_at: row.deliberation_started_at ?? null,
    completed_at: row.deliberation_completed_at ?? null,
    elapsed_ms: elapsedMs(row),
    specialists_completed: completed,
    current_specialist: current,
    progress_pct: progress,
    partial_outputs: row.specialist_outputs ?? [],
    synthesizer_decision: row.synthesizer_decision ?? null,
    consensus_level: row.consensus_level ?? null,
    escalated_to_human: row.escalated_to_human ?? false,
    total_cost_usd: row.total_cost_usd ?? 0,
    failure_reason: status === "failed" ? extractFailureReason(row) : null,
    canonical_order: SPECIALIST_ORDER,
  });
}

var authGuard = require("./auth-guard.cjs"); // DEPLOY471
export const handler: Handler = async (event) => {
  var __a = await authGuard.verifyAuth(event); if (!__a.ok) { return authGuard.denyResponse(__a, corsHeaders); } // DEPLOY471
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !supabaseKey) {
    return json(500, { error: "Supabase env not configured" });
  }
  const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);
  return handleStatusRequest(event, supabase);
};
