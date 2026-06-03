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
import {
  finalizeDeliberation,
  type FinalizeWebhookContext,
} from "../../src/lib/cross-domain/deliberationFinalizer";
import { retrieveAnalogousCases } from "../../src/lib/cross-domain/memoryRetrieval";
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

// Sprint 4A: the Sprint 2 cd_inspection_events SELECT is replaced by
// vector retrieval over cd_tenant_memory_index. retrieveAnalogousCases
// embeds the anomaly+asset+mechanisms description and pulls the top-K
// most semantically similar reasoning artifacts from prior deliberations.
async function loadAnalogousCases(
  supabase: SupabaseClient,
  org_id: string,
  asset: AssetContext,
  anomaly: AnomalyContext,
  excludeDeliberationId?: string
): Promise<AnalogousCase[]> {
  const assetContext = [
    asset.asset_name,
    `type=${asset.asset_type}`,
    `domain=${asset.domain}`,
    asset.material ? `material=${asset.material}` : "",
    asset.service_environment
      ? `service_env=${asset.service_environment}`
      : "",
    `criticality=${asset.criticality}`,
  ]
    .filter(Boolean)
    .join(" ");
  const citedMechanisms = anomaly.mechanism_key ? [anomaly.mechanism_key] : [];

  const result = await retrieveAnalogousCases(
    {
      anomalyDescription: anomaly.description,
      assetContext,
      citedMechanisms,
      org_id,
      excludeDeliberationId,
    },
    supabase
  );

  if (!result.ok) {
    console.warn(
      `[cross-domain analogous-cases] retrieval failed err="${
        result.error ?? "unknown"
      }" — historian will run cold-start`
    );
    return [];
  }
  return result.cases;
}

async function markRowFailed(
  supabase: SupabaseClient,
  deliberation_id: string,
  errorMessage: string
): Promise<void> {
  try {
    // Sprint 3.1: consensus_level conforms to the existing CHECK
    // constraint (text IN unanimous|majority_with_dissent|split|
    // unresolved). The failure signal lives in arbitration_rules_applied.
    await supabase
      .from("cd_deliberation_log")
      .update({
        arbitration_rules_applied: {
          error: errorMessage,
          final_status: "failed",
        },
        consensus_level: "unresolved",
        escalated_to_human: true,
        deliberation_completed_at: new Date().toISOString(),
      })
      .eq("id", deliberation_id);
  } catch {
    // best-effort; if the failure-marker write itself fails there's
    // nothing we can do — Netlify logs will still capture the crash.
  }
}

var authGuard = require("./auth-guard.cjs"); // DEPLOY471
export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {

  var __a = await authGuard.verifyAuth(event); if (!__a.ok) { return authGuard.denyResponse(__a, corsHeaders); } // DEPLOY471
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

  // Sprint 4 Polish 4 Phase 6 (B3): hoisted into the outer scope so
  // the `finally` block can pass anomaly + asset context to
  // finalizeDeliberation. Populated inside the inner try once
  // loadAnomaly + loadAsset succeed. Stays undefined if the
  // deliberation aborts before those loads complete — in which case
  // the finalizer's webhook fire is skipped (optional param).
  let webhookCtx: FinalizeWebhookContext | undefined;

  try {
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
      // Phase 6 (B3): now that both anomaly + asset are loaded, hand
      // the IDs to the outer scope so the `finally` block can pass
      // them through to finalizeDeliberation. Webhook payloads from
      // the belt-and-suspenders path now carry real anomaly + asset
      // identifiers (vs. all-null in the pre-Phase-6 silent path).
      webhookCtx = { anomaly_id: anomaly.id, asset_id: asset.id };

      const [evidence, mechanismVocabulary, analogousCases] = await Promise.all([
        loadEvidence(supabase, org_id, anomaly.id),
        loadMechanismVocabulary(supabase),
        loadAnalogousCases(supabase, org_id, asset, anomaly, deliberation_id),
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
  } finally {
    // Sprint 3.1 belt-and-suspenders: ensure the row reaches a terminal
    // state even if the orchestrator's own finalize failed silently
    // (e.g., CHECK violation, network blip on the inner UPDATE).
    // finalizeDeliberation is idempotent — if the row was already
    // completed by markRowFailed or the orchestrator's finalizeLog,
    // this no-ops.
    try {
      // Phase 6 (B3): pass webhookCtx so the belt-and-suspenders
      // finalize path fires the webhook for its two genuine-finalize
      // branches (partial-chain + normal-finalize). Undefined when
      // the deliberation aborted before anomaly/asset loaded — the
      // finalizer treats undefined as "skip webhook fire".
      await finalizeDeliberation(deliberation_id, org_id, supabase, webhookCtx);
    } catch (finalizeErr) {
      console.error(
        "[cross-domain finalize] finalization failed:",
        finalizeErr instanceof Error ? finalizeErr.message : finalizeErr
      );
    }
    // Sprint 3.2: emit one summary line so the deliberation's terminal
    // state shows up at the bottom of Netlify function logs without
    // requiring a database query.
    try {
      const { data: row } = await supabase
        .from("cd_deliberation_log")
        .select(
          "consensus_level, total_cost_usd, deliberation_started_at, deliberation_completed_at, specialist_outputs"
        )
        .eq("id", deliberation_id)
        .maybeSingle();
      const { data: chainRows } = await supabase
        .from("cd_causal_chains")
        .select("id")
        .eq("org_id", org_id)
        .contains("linked_anomaly_ids", [anomaly_id]);
      const r = (row ?? {}) as Record<string, unknown>;
      const outputs = Array.isArray(r.specialist_outputs)
        ? (r.specialist_outputs as unknown[])
        : [];
      const startedAt = r.deliberation_started_at
        ? Date.parse(String(r.deliberation_started_at))
        : 0;
      const completedAt = r.deliberation_completed_at
        ? Date.parse(String(r.deliberation_completed_at))
        : Date.now();
      const elapsedSec = startedAt
        ? Math.round((completedAt - startedAt) / 1000)
        : 0;
      const causalWritten = Array.isArray(chainRows) && chainRows.length > 0;
      console.log(
        `[deliberation ${deliberation_id}] FINAL: consensus=${r.consensus_level ?? "null"} total_cost=$${
          typeof r.total_cost_usd === "number"
            ? r.total_cost_usd.toFixed(4)
            : "0"
        } elapsed=${elapsedSec}s specialists_completed=${outputs.length}/6 causal_chain_written=${causalWritten}`
      );
    } catch (logErr) {
      // FINAL log is best-effort; never let logging crash the function.
      console.error(
        "[cross-domain finalize] FINAL log read failed:",
        logErr instanceof Error ? logErr.message : logErr
      );
    }
  }
};
