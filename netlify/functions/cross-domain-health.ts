// ============================================================
// cross-domain-health.ts
//
// Smoke-tests the 6 cross-domain AI client wrappers. Returns
// per-role ok/response/latency and counts ai_cost_log rows
// written during this invocation.
//
// Auth: x-health-key header must match CROSS_DOMAIN_HEALTH_KEY.
// Org:  ?org_id= query param (preferred) or Bearer JWT
//       app_metadata.org_id fallback. Org must have
//       cross_domain_intelligence enabled in org_feature_flags.
//
// Path B note: wrappers now make real minimal-token provider
// calls. `response` is the literal model reply (typically "OK").
// ============================================================

import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  callInspector,
  callEngineer,
  callResearcher,
  callDevilsAdvocate,
  callHistorian,
  callSynthesizer,
} from "../../src/lib/cross-domain/aiSpecialists";
import { isCrossDomainEnabled } from "../../src/lib/cross-domain/featureFlags";
import type {
  SpecialistCallContext,
  SpecialistOutput,
  SpecialistRole,
} from "../../src/lib/cross-domain/types";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-health-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

const HEALTH_PROMPT = "Respond with the single word OK.";

type SpecialistFn = (
  prompt: string,
  ctx?: SpecialistCallContext
) => Promise<SpecialistOutput>;

const SPECIALISTS: Array<{ role: SpecialistRole; fn: SpecialistFn }> = [
  { role: "inspector", fn: callInspector },
  { role: "engineer", fn: callEngineer },
  { role: "researcher", fn: callResearcher },
  { role: "devils_advocate", fn: callDevilsAdvocate },
  { role: "historian", fn: callHistorian },
  { role: "synthesizer", fn: callSynthesizer },
];

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

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body, null, 2),
  };
}

interface RoleResult {
  ok: boolean;
  response: string | null;
  latency_ms: number;
  error?: string;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
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
      error: "org_id required (provide ?org_id= or Bearer JWT with app_metadata.org_id)",
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !supabaseKey) {
    return json(500, { error: "Supabase env not configured" });
  }
  const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

  const enabled = await isCrossDomainEnabled(orgId, supabase);
  if (!enabled) {
    return json(403, {
      ok: false,
      org_id: orgId,
      error: "cross_domain_intelligence flag not enabled for this org",
    });
  }

  const startISO = new Date().toISOString();
  const ctx: SpecialistCallContext = {
    cost: { orgId, supabaseAdmin: supabase },
  };

  const settled = await Promise.allSettled(
    SPECIALISTS.map(({ fn }) => fn(HEALTH_PROMPT, ctx))
  );

  const results: Record<string, RoleResult> = {};
  for (let i = 0; i < SPECIALISTS.length; i++) {
    const role = SPECIALISTS[i].role;
    const s = settled[i];
    if (s.status === "fulfilled") {
      const v = s.value;
      const r: RoleResult = {
        ok: v.ok,
        response: v.response,
        latency_ms: v.latency_ms,
      };
      if (v.error) r.error = v.error;
      results[role] = r;
    } else {
      results[role] = {
        ok: false,
        response: null,
        latency_ms: 0,
        error: String(s.reason),
      };
    }
  }

  let cost_log_entries = 0;
  const { count, error: countErr } = await supabase
    .from("ai_cost_log")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .gte("created_at", startISO)
    .like("code_name", "cross_domain:%");
  if (countErr) {
    cost_log_entries = -1;
  } else {
    cost_log_entries = count ?? 0;
  }

  const allOk = Object.values(results).every((r) => r.ok);

  return json(200, {
    ok: allOk,
    org_id: orgId,
    checked_at: startISO,
    results,
    cost_log_entries,
  });
};
