// ============================================================
// cross-domain-deliberate.ts
//
// Trigger endpoint for the Sprint 2 deliberation orchestrator.
// Loads an anomaly + asset + evidence + mechanism vocabulary +
// pre-filtered analogous cases, then calls runDeliberation.
//
// Auth: x-health-key header (reuse CROSS_DOMAIN_HEALTH_KEY env).
// Feature flag gate: cross_domain_intelligence must be true.
//
// Timeout note: this is configured with a 26s function timeout
// in netlify.toml (Pro plan sync function max). Worst-case
// deliberation latency (~50s on full thinking budgets) exceeds
// this. Best-effort persistence in cd_deliberation_log means a
// timeout doesn't lose progress — Sprint 3 will chunked-async
// the orchestrator (each specialist in its own function).
//
// SCHEMA NOTE (PR body): anomalies live in `cd_asset_anomalies`
// (not `cd_anomalies` as the brief writes), and evidence is
// linked polymorphically via linked_entity_type + linked_entity_id.
// ============================================================

import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isCrossDomainEnabled } from "../../src/lib/cross-domain/featureFlags";
import {
  runDeliberation,
  generateDeliberationId,
} from "../../src/lib/cross-domain/orchestrator";
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
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-health-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body, null, 2) };
}

function getOrgFromJwt(event: HandlerEvent): string | null {
  try {
    const auth = event.headers["authorization"] || event.headers["Authorization"] || "";
    if (!auth) return null;
    const token = auth.replace(/^Bearer\s+/i, "");
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
    return payload?.app_metadata?.org_id ?? null;
  } catch {
    return null;
  }
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
    .select(
      "id, asset_id, description, severity, created_at, mechanism_key"
    )
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

// Sprint 2 placeholder: filter cd_inspection_events for events on
// assets of same asset_type in the same org within 90 days, where
// the linked anomaly mechanism overlaps the current anomaly's
// mechanism_key. Up to 5 most-recent. Sprint 4 → vector retrieval.
async function loadAnalogousCases(
  supabase: SupabaseClient,
  org_id: string,
  asset: AssetContext,
  anomaly: AnomalyContext
): Promise<AnalogousCase[]> {
  if (!anomaly.mechanism_key) return [];
  const sinceISO = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Step 1: find assets with the same asset_type in this org.
  const { data: peerAssetsData } = await supabase
    .from("cd_asset_nodes")
    .select("id")
    .eq("org_id", org_id)
    .eq("asset_type", asset.asset_type);
  const peerAssetIds = ((peerAssetsData ?? []) as Array<{ id: string }>)
    .map((r) => r.id)
    .filter((id) => id !== asset.id);
  if (peerAssetIds.length === 0) return [];

  // Step 2: find recent inspection events on those assets.
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

  // Step 3: filter to events whose linked anomaly shares mechanism_key.
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

export const handler: Handler = async (event) => {
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

  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !supabaseKey) {
    return json(500, { error: "Supabase env not configured" });
  }
  const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

  const enabled = await isCrossDomainEnabled(orgId, supabase);
  if (!enabled) {
    return json(403, {
      error: "cross_domain_intelligence flag not enabled for this org",
    });
  }

  const anomaly = await loadAnomaly(supabase, orgId, body.anomaly_id);
  if (!anomaly) return json(404, { error: "anomaly_not_found" });

  const asset = await loadAsset(supabase, orgId, anomaly.asset_id);
  if (!asset) return json(404, { error: "asset_not_found" });

  const [evidence, mechanismVocabulary, analogousCases] = await Promise.all([
    loadEvidence(supabase, orgId, anomaly.id),
    loadMechanismVocabulary(supabase),
    loadAnalogousCases(supabase, orgId, asset, anomaly),
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
    org_id: orgId,
    deliberation_id: generateDeliberationId(),
    supabase,
  });

  return json(result.ok ? 200 : 207, result);
};
