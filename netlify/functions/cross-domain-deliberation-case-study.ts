// ============================================================
// cross-domain-deliberation-case-study.ts
//
// Sprint 5 Phase B — Case study endpoint. Converts any completed
// deliberation into a code-first / why / how teaching artifact
// (markdown). Pure read + format: no AI inference, no deliberation
// logic. Deterministic and replayable.
//
// Auth + org-resolution patterns mirror cross-domain-deliberation-status.ts
// exactly (x-health-key header + ?org_id= query or Bearer JWT fallback).
// Errors return JSON; success returns markdown with Content-Type
// text/markdown; charset=utf-8.
// ============================================================

import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  renderCaseStudyMarkdown,
  type CaseStudyAsset,
  type CaseStudyAnomaly,
  type CaseStudyConsequence,
  type CaseStudyDeliberation,
  type CaseStudyEvidence,
} from "../../src/lib/cross-domain/caseStudyRenderer";

const corsHeadersJson: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-health-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

const corsHeadersMarkdown: Record<string, string> = {
  ...corsHeadersJson,
  "Content-Type": "text/markdown; charset=utf-8",
};

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: corsHeadersJson,
    body: JSON.stringify(body, null, 2),
  };
}

function markdown(statusCode: number, body: string) {
  return { statusCode, headers: corsHeadersMarkdown, body };
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

export async function handleCaseStudyRequest(
  event: HandlerEvent,
  supabase: SupabaseClient
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeadersJson, body: "" };
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
  const format = (event.queryStringParameters?.format ?? "markdown").toLowerCase();
  if (!id) return json(400, { error: "id required" });
  if (!orgId) return json(400, { error: "org_id required" });
  if (format !== "markdown") {
    return json(400, {
      error: "unsupported_format",
      detail: `format=${format} not supported. Phase B.1 supports markdown only; html/pdf deferred to B.2/B.3.`,
    });
  }

  // ---- 1. cd_deliberation_log row ----
  const delibResp = await supabase
    .from("cd_deliberation_log")
    .select(
      "id, org_id, finding_id, deliberation_started_at, deliberation_completed_at, specialist_outputs, synthesizer_decision, arbitration_rules_applied, consensus_level, total_cost_usd"
    )
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (delibResp.error) {
    return json(500, { error: "db_error", detail: delibResp.error.message });
  }
  if (!delibResp.data) {
    // Tenant-isolation 404: do NOT distinguish wrong-org from not-found.
    return json(404, { error: "deliberation_not_found" });
  }
  const deliberation = delibResp.data as CaseStudyDeliberation;

  if (!deliberation.deliberation_completed_at) {
    return json(422, {
      error: "deliberation_incomplete",
      detail: "deliberation_completed_at is null — chain is still pending or running",
    });
  }

  if (!deliberation.finding_id) {
    return json(500, {
      error: "deliberation_missing_finding_id",
      detail: "deliberation row has no finding_id; cannot resolve anomaly",
    });
  }

  // ---- 2. cd_asset_anomalies row ----
  const anomResp = await supabase
    .from("cd_asset_anomalies")
    .select("id, asset_id, domain, anomaly_type, severity, description")
    .eq("id", deliberation.finding_id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (anomResp.error) {
    return json(500, { error: "db_error", detail: anomResp.error.message });
  }
  if (!anomResp.data) {
    return json(500, {
      error: "anomaly_not_found",
      detail: `deliberation references anomaly ${deliberation.finding_id} that does not exist or belongs to another org`,
    });
  }
  const anomalyRow = anomResp.data as {
    id: string;
    asset_id: string;
    domain: string | null;
    anomaly_type: string | null;
    severity: string;
    description: string;
  };
  const anomaly: CaseStudyAnomaly = {
    id: anomalyRow.id,
    anomaly_type: anomalyRow.anomaly_type,
    severity: anomalyRow.severity,
    description: anomalyRow.description,
    domain: anomalyRow.domain,
  };

  // ---- 3. cd_asset_nodes row ----
  const assetResp = await supabase
    .from("cd_asset_nodes")
    .select("id, asset_name, domain, criticality, location_description")
    .eq("id", anomalyRow.asset_id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (assetResp.error) {
    return json(500, { error: "db_error", detail: assetResp.error.message });
  }
  if (!assetResp.data) {
    return json(500, {
      error: "asset_not_found",
      detail: `anomaly references asset ${anomalyRow.asset_id} that does not exist or belongs to another org`,
    });
  }
  const asset = assetResp.data as CaseStudyAsset;

  // ---- 4. cd_evidence_items rows (polymorphic, linked_entity_type='anomaly') ----
  const evResp = await supabase
    .from("cd_evidence_items")
    .select("id, evidence_type, raw_text")
    .eq("org_id", orgId)
    .eq("linked_entity_type", "anomaly")
    .eq("linked_entity_id", anomalyRow.id);
  if (evResp.error) {
    return json(500, { error: "db_error", detail: evResp.error.message });
  }
  const evidenceById = new Map<string, CaseStudyEvidence>();
  for (const e of (evResp.data ?? []) as CaseStudyEvidence[]) {
    evidenceById.set(e.id, e);
  }

  // ---- 5. cd_anomaly_consequence_assessments — latest by deliberation_id ----
  // Soft reference (no FK per DEPLOY357 comment). Multiple rows possible
  // in theory (e.g., re-runs), so ORDER + take first instead of maybeSingle.
  const consResp = await supabase
    .from("cd_anomaly_consequence_assessments")
    .select(
      "recommended_action_tier, overall_tier, total_confidence, time_to_consequence_days, created_at"
    )
    .eq("deliberation_id", deliberation.id)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (consResp.error) {
    return json(500, { error: "db_error", detail: consResp.error.message });
  }
  const consRows = (consResp.data ?? []) as Array<{
    recommended_action_tier: CaseStudyConsequence["recommended_action_tier"];
    overall_tier: CaseStudyConsequence["overall_tier"];
    total_confidence: number;
    time_to_consequence_days: number | null;
    created_at: string;
  }>;
  const consequence: CaseStudyConsequence | null =
    consRows.length > 0
      ? {
          recommended_action_tier: consRows[0].recommended_action_tier,
          overall_tier: consRows[0].overall_tier,
          total_confidence: consRows[0].total_confidence,
          time_to_consequence_days: consRows[0].time_to_consequence_days,
        }
      : null;

  // ---- Render ----
  const body = renderCaseStudyMarkdown({
    deliberation,
    asset,
    anomaly,
    evidenceById,
    consequence,
    generatedAt: new Date().toISOString(),
  });

  return markdown(200, body);
}

export const handler: Handler = async (event) => {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !supabaseKey) {
    return json(500, { error: "Supabase env not configured" });
  }
  const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);
  return handleCaseStudyRequest(event, supabase);
};
