// ============================================================
// cross-domain-calibration.ts — Sprint 4D
//
// GET endpoint returning CalibrationStats for an org with optional
// filters. Backs whatever future UI / dashboard / sales demo wants
// to show "platform calibration over time".
//
// Auth: same x-health-key header pattern as cross-domain-health.
// ============================================================

import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { computeCalibrationStats } from "../../src/lib/cross-domain/calibrationStats";
import { isCrossDomainEnabled } from "../../src/lib/cross-domain/featureFlags";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-health-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body, null, 2),
  };
}

export const handler: Handler = async (event: HandlerEvent) => {
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

  const q = event.queryStringParameters ?? {};
  const org_id = q.org_id;
  if (!org_id) {
    return json(400, { error: "org_id query param required" });
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

  try {
    const stats = await computeCalibrationStats(
      {
        org_id,
        asset_domain: q.asset_domain ?? undefined,
        asset_type: q.asset_type ?? undefined,
        primary_mechanism: q.primary_mechanism ?? undefined,
        since: q.since ?? undefined,
        until: q.until ?? undefined,
      },
      supabase
    );
    return json(200, stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json(500, { error: `calibration_stats_failed: ${message}` });
  }
};
