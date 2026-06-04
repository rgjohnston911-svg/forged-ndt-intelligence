// ============================================================
// cross-domain-record-outcome.ts — Sprint 4D
//
// POST endpoint for operators / CMMS integrations to report the
// actual outcome of a prediction. UPDATEs the prediction row with
// reported_at, actual_outcome jsonb, and a deterministic
// calibration_delta computed by outcomeReporter.recordOutcome.
//
// Auth: same x-health-key header pattern as cross-domain-health.
// Sprint 5+ can switch to JWT once operator-facing UI exists.
// ============================================================

import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { recordOutcome } from "../../src/lib/cross-domain/outcomeReporter";
import { isCrossDomainEnabled } from "../../src/lib/cross-domain/featureFlags";
import type { ActualOutcome } from "../../src/lib/cross-domain/types";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-health-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body, null, 2),
  };
}

const VALID_ACTIONS = new Set<string>([
  "monitor",
  "engineering_review",
  "urgent_assessment",
  "immediate_remediation",
  "cease_operation",
  "no_action_taken",
  "other_action",
]);

const VALID_TIERS = new Set<string>([
  "negligible",
  "low",
  "moderate",
  "high",
  "severe",
  "catastrophic",
]);

function validateActual(raw: unknown): { ok: true; value: ActualOutcome } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "actual must be an object" };
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.action_taken !== "string" || !VALID_ACTIONS.has(r.action_taken)) {
    return {
      ok: false,
      error: `actual.action_taken must be one of: ${Array.from(VALID_ACTIONS).join("|")}`,
    };
  }
  if (
    r.action_date !== null &&
    r.action_date !== undefined &&
    typeof r.action_date !== "string"
  ) {
    return { ok: false, error: "actual.action_date must be a string or null" };
  }
  if (
    r.mechanism_confirmed !== null &&
    r.mechanism_confirmed !== undefined &&
    typeof r.mechanism_confirmed !== "boolean"
  ) {
    return {
      ok: false,
      error: "actual.mechanism_confirmed must be boolean or null",
    };
  }
  if (
    r.actual_consequence_tier !== null &&
    r.actual_consequence_tier !== undefined &&
    (typeof r.actual_consequence_tier !== "string" ||
      !VALID_TIERS.has(r.actual_consequence_tier))
  ) {
    return {
      ok: false,
      error: `actual.actual_consequence_tier must be one of: ${Array.from(VALID_TIERS).join("|")} or null`,
    };
  }
  if (
    r.days_to_actual_consequence !== null &&
    r.days_to_actual_consequence !== undefined &&
    typeof r.days_to_actual_consequence !== "number"
  ) {
    return {
      ok: false,
      error: "actual.days_to_actual_consequence must be a number or null",
    };
  }
  if (typeof r.reported_by !== "string" || r.reported_by.trim().length === 0) {
    return { ok: false, error: "actual.reported_by required (non-empty string)" };
  }
  if (typeof r.free_text_notes !== "string") {
    return { ok: false, error: "actual.free_text_notes required (string)" };
  }
  return {
    ok: true,
    value: {
      action_taken: r.action_taken as ActualOutcome["action_taken"],
      action_date: (r.action_date as string | null) ?? null,
      mechanism_confirmed:
        r.mechanism_confirmed === undefined
          ? null
          : (r.mechanism_confirmed as boolean | null),
      actual_consequence_tier:
        (r.actual_consequence_tier as ActualOutcome["actual_consequence_tier"]) ??
        null,
      days_to_actual_consequence:
        (r.days_to_actual_consequence as number | null) ?? null,
      reported_by: r.reported_by,
      free_text_notes: r.free_text_notes,
    },
  };
}

export const handler: Handler = async (event: HandlerEvent) => {
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

  let body: {
    prediction_id?: string;
    org_id?: string;
    actual?: unknown;
  };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return json(400, { error: "invalid_json_body" });
  }
  const prediction_id = body.prediction_id;
  const org_id = body.org_id;
  if (!prediction_id || !org_id) {
    return json(400, { error: "prediction_id and org_id required" });
  }
  const validated = validateActual(body.actual);
  if (!validated.ok) {
    return json(400, { error: validated.error });
  }

  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !supabaseKey) {
    return json(500, { error: "Supabase env not configured" });
  }
  const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

  const enabled = await isCrossDomainEnabled(org_id, supabase);
  if (!enabled) {
    return json(403, {
      ok: false,
      org_id,
      error: "cross_domain_intelligence flag not enabled for this org",
    });
  }

  const result = await recordOutcome({
    prediction_id,
    org_id,
    actual: validated.value,
    supabase,
  });

  if (!result.ok) {
    const status = result.error === "prediction_not_found" ? 404 : 400;
    return json(status, { ok: false, error: result.error });
  }
  return json(200, {
    ok: true,
    prediction_id,
    calibration_delta: result.calibration_delta,
  });
};
