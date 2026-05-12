// ============================================================
// cross-domain-deliberate-background.ts
//
// Sprint 3 — Netlify Background Function. Filename suffix
// `-background.ts` is what Netlify uses to auto-detect this as
// a Background Function with a 15-minute ceiling (vs. 26s for
// synchronous functions). Real 6-AI deliberations run 30-100s,
// so the synchronous runtime can't fit them.
//
// Invocation: POST from cross-domain-deliberate.ts (the trigger
// endpoint) with { deliberation_id, anomaly_id, org_id } body.
// No auth check here — the trigger endpoint already validated
// the request. This function is internal-only.
//
// On any failure (including loader crashes), the cd_deliberation_log
// row is updated with consensus_level='failed' and the error
// message is written to arbitration_rules_applied.error for the
// polling endpoint to surface.
// ============================================================

import type { Handler } from "@netlify/functions";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runDeliberation } from "../../src/lib/cross-domain/orchestrator";
import { checkOrgBudget } from "../../src/lib/cross-domain/budgetGuard";
import type {
  AnomalyContext,
  AssetContext,
  EvidenceItem,
  DegradationMechanismRef,
  AnalogousCase,
  DeliberationInput,
} from "../../src/lib/cross-domain/types";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST",
  "Content-Type": "application/json",
};

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body, null, 2) };
}

function ageYearsFromInstallDate(installDate: string | null): number | null {
  if (!installDate) return null;
  const t = Date.parse(installDate);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (365.25 * 24 * 60 * 60 * 1000);
}

async function loadAnomaly(
  supabase: SupabaseClient,
  org_id: string,
  anomaly_id: string
): Promise<AnomalyContext | null> {
  const { data } = await supabase
    .from("cd_asset_anomalies")
    .select("id, asset_id, description, severity, created_at, mechanism_key")
    .eq("org_id", org_id)
    .eq("id", anomaly_id)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    asset_id: String(row.asset_id),
    description: String(row.description ?? ""),
    severity: row.severity as AnomalyContext["severity"],
    observed_at: String(row.created_at),
    mechanism_key: (row.mechanism_key as string | null) ?? null,
  };
}

async function loadAsset(
  supabase: SupabaseClient,
  org_id: string,
  asset_id: string
): Promise<AssetContext | null> {
  const { data } = await supabase
    .from("cd_asset_nodes")
    .select(
      "id, asset_name, asset_type, domain, material, service_environment, criticality, install_date"
    )
    .eq("org_id", org_id)
    .eq("id", asset_id)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    asset_name: String(row.asset_name ?? ""),
    asset_type: String(row.asset_type ?? ""),
    domain: row.domain as AssetContext["domain"],
    material: (row.material as string | null) ?? null,
    service_environment: (row.service_environment as string | null) ?? null,
    criticality: row.criticality as AssetContext["criticality"],
    age_years: ageYearsFromInstallDate(row.install_date as string | null),
  };
}

async function loadEvidence(
  supabase: SupabaseClient,
  org_id: string,
  anomaly_id: string
): Promise<EvidenceItem[]> {
  const { data } = await supabase
    .from("cd_evidence_items")
    .select(
      "id, evidence_type, source, reliability_weight, captured_at, raw_text, structured_jsonb, confidence"
    )
    .eq("org_id", org_id)
    .eq("linked_entity_type", "anomaly")
    .eq("linked_entity_id", anomaly_id)
    .order("captured_at", { ascending: false });
  const rows = (data ?? []) as Record<string, unknown>[];
  return rows.slice(0, 20).map((r) => ({
    id: String(r.id),
    evidence_type: String(r.evidence_type ?? ""),
    source: String(r.source ?? ""),
    reliability_weight: (r.reliability_weight as number | null) ?? null,
    captured_at: (r.captured_at as string | null) ?? null,
    raw_text: (r.raw_text as string | null) ?? null,
    structured_jsonb:
      (r.structured_jsonb as Record<string, unknown> | null) ?? null,
    confidence: (r.confidence as number | null) ?? null,
  }));
}

async function loadMechanismVocabulary(
  supabase: SupabaseClient
): Promise<DegradationMechanismRef[]> {
  const { data } = await supabase
    .from("cd_degradation_mechanisms")
    .select("mechanism_key, display_name, category, active")
    .eq("active", true);
  const rows = (data ?? []) as Record<string, unknown>[];
  return rows.map((r) => ({
    mechanism_key: String(r.mechanism_key),
    display_name: String(r.display_name ?? r.mechanism_key),
    category: String(r.category ?? "unknown"),
  }));
}

async function loadAnalogousCases(
  supabase: SupabaseClient,
  org_id: string,
  asset: AssetContext,
  anomaly: AnomalyContext
): Promise<AnalogousCase[]> {
  if (!anomaly.mechanism_key) return [];
  const sinceISO = new Date(
    Date.now() - 90 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: peerAssetsData } = await supabase
    .from("cd_asset_nodes")
    .select("id")
    .eq("org_id", org_id)
    .eq("asset_type", asset.asset_type);
  const peerAssetIds = ((peerAssetsData ?? []) as Array<{ id: string }>)
    .map((r) => r.id)
    .filter((id) => id !== asset.id);
  if (peerAssetIds.length === 0) return [];

  const { data: eventsData } = await supabase
    .from("cd_inspection_events")
    .select("id, asset_id, inspection_date, summary")
    .eq("org_id", org_id)
    .in("asset_id", peerAssetIds)
    .gte("inspection_date", sinceISO)
    .order("inspection_date", { ascending: false });
  const events = (eventsData ?? []) as Array<{
    id: string;
    asset_id: string;
    inspection_date: string;
    summary: string | null;
  }>;
  if (events.length === 0) return [];

  const eventIds = events.map((e) => e.id);
  const { data: peerAnomaliesData } = await supabase
    .from("cd_asset_anomalies")
    .select("inspection_event_id, mechanism_key")
    .eq("org_id", org_id)
    .in("inspection_event_id", eventIds)
    .eq("mechanism_key", anomaly.mechanism_key);
  const matchingEventIds = new Set(
    ((peerAnomaliesData ?? []) as Array<{ inspection_event_id: string }>).map(
      (r) => r.inspection_event_id
    )
  );

  return events
    .filter((e) => matchingEventIds.has(e.id))
    .slice(0, 5)
    .map((e) => ({
      inspection_event_id: e.id,
      asset_id: e.asset_id,
      asset_type: asset.asset_type,
      inspection_date: e.inspection_date,
      summary: e.summary,
      cited_mechanisms: [anomaly.mechanism_key ?? ""],
    }));
}

async function markRowFailed(
  supabase: SupabaseClient,
  deliberation_id: string,
  errorMessage: string
): Promise<void> {
  try {
    await supabase
      .from("cd_deliberation_log")
      .update({
        arbitration_rules_applied: { error: errorMessage },
        consensus_level: "failed",
        escalated_to_human: true,
        deliberation_completed_at: new Date().toISOString(),
      })
      .eq("id", deliberation_id);
  } catch {
    // best-effort; if the failure-marker write itself fails there's
    // nothing we can do — Netlify logs will still capture the crash.
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  let body: {
    deliberation_id?: string;
    anomaly_id?: string;
    org_id?: string;
    resume_from_specialist?: string;
  };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return json(400, { error: "invalid_json_body" });
  }
  const { deliberation_id, anomaly_id, org_id } = body;
  if (!deliberation_id || !anomaly_id || !org_id) {
    return json(400, {
      error: "deliberation_id, anomaly_id, org_id all required",
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !supabaseKey) {
    await markRowFailed(
      createClient(supabaseUrl || "http://placeholder", supabaseKey || "placeholder"),
      deliberation_id,
      "supabase_env_not_configured"
    );
    return json(500, { error: "Supabase env not configured" });
  }
  const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

  try {
    // Budget pre-check (orchestrator also runs this; doing it up-front
    // avoids loader work when we already know we'd abort).
    const budget = await checkOrgBudget(supabase, org_id);
    if (!budget.ok) {
      await markRowFailed(
        supabase,
        deliberation_id,
        budget.reason ?? "org_daily_cap_exceeded"
      );
      return json(200, { ok: false, reason: budget.reason });
    }

    const anomaly = await loadAnomaly(supabase, org_id, anomaly_id);
    if (!anomaly) {
      await markRowFailed(supabase, deliberation_id, "anomaly_not_found");
      return json(200, { ok: false, reason: "anomaly_not_found" });
    }
    const asset = await loadAsset(supabase, org_id, anomaly.asset_id);
    if (!asset) {
      await markRowFailed(supabase, deliberation_id, "asset_not_found");
      return json(200, { ok: false, reason: "asset_not_found" });
    }

    const [evidence, mechanismVocabulary, analogousCases] = await Promise.all([
      loadEvidence(supabase, org_id, anomaly.id),
      loadMechanismVocabulary(supabase),
      loadAnalogousCases(supabase, org_id, asset, anomaly),
    ]);

    const input: DeliberationInput = {
      anomaly,
      asset,
      evidence,
      priorAnalyses: [],
      mechanismVocabulary,
      analogousCases,
    };

    const result = await runDeliberation(input, {
      org_id,
      deliberation_id,
      supabase,
      resume_from_specialist: body.resume_from_specialist as
        | DeliberationInput["priorAnalyses"][number]["role"]
        | undefined,
    });

    return json(200, {
      ok: result.ok,
      deliberation_id: result.deliberation_id,
      aborted_reason: result.aborted_reason ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markRowFailed(supabase, deliberation_id, message);
    // Re-throw so Netlify logs the crash (per brief Part 2 error handling).
    throw err;
  }
};
