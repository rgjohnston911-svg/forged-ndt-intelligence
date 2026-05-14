// ============================================================
// Sprint 4D — Prediction capture
//
// Invoked from the orchestrator's success path AFTER memory ingest,
// gated on consensus != 'unresolved'. Reads the just-finalized
// deliberation + its sibling cd_anomaly_consequence_assessments and
// cd_causal_chains rows, flattens the structured prediction, and
// INSERTs one row into cd_deliberation_predictions (DEPLOY358).
//
// SCHEMA NOTE: the existing cd_prediction_outcomes (DEPLOY355) is
// per-anomaly-per-aspect with a 4-value prediction_type enum that
// doesn't accept a "deliberation outcome" row. We INSERT into the
// new cd_deliberation_predictions table instead. See DEPLOY358 for
// the rationale.
//
// Failure handling: idempotent (per-deliberation UNIQUE constraint in
// SQL + count-check in code). Defensive against missing sibling rows
// (Sprint 4C taught us not to assume). Never blocks the deliberation —
// the orchestrator wraps this call in try/catch and writes failures to
// arbitration_rules_applied.prediction_capture_error.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ConsensusLevel,
  ConsequenceTier,
  RecommendedActionTier,
} from "./types";

export interface CaptureResult {
  ok: boolean;
  prediction_id?: string;
  note?: string;
  error?: string;
}

interface DeliberationRow {
  id: string;
  org_id: string;
  finding_id: string | null;
  finding_type: string | null;
  consensus_level: string | null;
  deliberation_completed_at: string | null;
  total_cost_usd: number | null;
}

interface ConsequenceRow {
  id: string;
  asset_id: string | null;
  overall_tier: string | null;
  recommended_action_tier: string | null;
  time_to_consequence_days: number | null;
  total_confidence: number | null;
}

interface CausalChainRow {
  id: string;
  title: string | null;
  linked_mechanisms: unknown;
  linked_anomaly_ids: unknown;
}

const VALID_CONSEQUENCE_TIERS: ConsequenceTier[] = [
  "negligible",
  "low",
  "moderate",
  "high",
  "severe",
  "catastrophic",
];

const VALID_ACTION_TIERS: RecommendedActionTier[] = [
  "monitor",
  "engineering_review",
  "urgent_assessment",
  "immediate_remediation",
  "cease_operation",
];

function coerceConsequenceTier(v: unknown): ConsequenceTier | null {
  if (typeof v !== "string") return null;
  return (VALID_CONSEQUENCE_TIERS as string[]).includes(v)
    ? (v as ConsequenceTier)
    : null;
}

function coerceActionTier(v: unknown): RecommendedActionTier | null {
  if (typeof v !== "string") return null;
  return (VALID_ACTION_TIERS as string[]).includes(v)
    ? (v as RecommendedActionTier)
    : null;
}

function coerceConsensus(v: unknown): ConsensusLevel | null {
  if (typeof v !== "string") return null;
  const valid: ConsensusLevel[] = [
    "unanimous",
    "majority_with_dissent",
    "split",
    "unresolved",
  ];
  return (valid as string[]).includes(v) ? (v as ConsensusLevel) : null;
}

async function loadDeliberation(
  supabase: SupabaseClient,
  deliberation_id: string,
  org_id: string
): Promise<DeliberationRow | null> {
  const { data } = await supabase
    .from("cd_deliberation_log")
    .select(
      "id, org_id, finding_id, finding_type, consensus_level, deliberation_completed_at, total_cost_usd"
    )
    .eq("id", deliberation_id)
    .eq("org_id", org_id)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    org_id: String(row.org_id),
    finding_id: (row.finding_id as string | null) ?? null,
    finding_type: (row.finding_type as string | null) ?? null,
    consensus_level: (row.consensus_level as string | null) ?? null,
    deliberation_completed_at:
      (row.deliberation_completed_at as string | null) ?? null,
    total_cost_usd:
      typeof row.total_cost_usd === "number" ? row.total_cost_usd : null,
  };
}

async function existingPredictionId(
  supabase: SupabaseClient,
  deliberation_id: string,
  org_id: string
): Promise<string | null> {
  const { data } = await supabase
    .from("cd_deliberation_predictions")
    .select("id")
    .eq("org_id", org_id)
    .eq("deliberation_id", deliberation_id)
    .maybeSingle();
  if (!data) return null;
  return String((data as Record<string, unknown>).id);
}

async function loadLatestConsequence(
  supabase: SupabaseClient,
  org_id: string,
  deliberation_id: string,
  anomaly_id: string
): Promise<ConsequenceRow | null> {
  // Prefer the row written by THIS deliberation. Fall back to the
  // latest row for this anomaly when no deliberation_id-tagged row
  // exists (defensive: pre-Sprint-4C.1 rows might not be linked).
  const byDelib = await supabase
    .from("cd_anomaly_consequence_assessments")
    .select(
      "id, asset_id, overall_tier, recommended_action_tier, time_to_consequence_days, total_confidence"
    )
    .eq("org_id", org_id)
    .eq("deliberation_id", deliberation_id)
    .order("created_at", { ascending: false })
    .limit(1);
  const arr1 = (byDelib.data ?? []) as Record<string, unknown>[];
  let row: Record<string, unknown> | null = arr1[0] ?? null;
  if (!row) {
    const byAnomaly = await supabase
      .from("cd_anomaly_consequence_assessments")
      .select(
        "id, asset_id, overall_tier, recommended_action_tier, time_to_consequence_days, total_confidence"
      )
      .eq("org_id", org_id)
      .eq("anomaly_id", anomaly_id)
      .order("created_at", { ascending: false })
      .limit(1);
    const arr2 = (byAnomaly.data ?? []) as Record<string, unknown>[];
    row = arr2[0] ?? null;
  }
  if (!row) return null;
  return {
    id: String(row.id),
    asset_id: (row.asset_id as string | null) ?? null,
    overall_tier: (row.overall_tier as string | null) ?? null,
    recommended_action_tier:
      (row.recommended_action_tier as string | null) ?? null,
    time_to_consequence_days:
      typeof row.time_to_consequence_days === "number"
        ? row.time_to_consequence_days
        : null,
    total_confidence:
      typeof row.total_confidence === "number" ? row.total_confidence : null,
  };
}

async function loadLatestCausalChain(
  supabase: SupabaseClient,
  org_id: string,
  anomaly_id: string,
  asset_id_hint: string | null
): Promise<CausalChainRow | null> {
  // Sprint 4 Polish (Fix B): the prior implementation used
  // .contains("linked_anomaly_ids", [anomaly_id]) which, in production,
  // returned no rows even when chains existed — leaving primary_mechanism
  // null in the captured prediction. Switch to a more robust pattern:
  // filter by asset_id when we have it (a real column, no jsonb
  // gymnastics), then narrow down in JS to the chain that actually lists
  // this anomaly_id. Falls back to org-wide scan when asset_id is unknown.
  let query = supabase
    .from("cd_causal_chains")
    .select("id, title, linked_mechanisms, linked_anomaly_ids")
    .eq("org_id", org_id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (asset_id_hint) {
    query = query.eq("asset_id", asset_id_hint);
  }
  const { data } = await query;
  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return null;
  // Filter for rows whose linked_anomaly_ids contains this anomaly_id.
  // (Defensive against the jsonb-contains corner case we hit before.)
  const match =
    rows.find((r) => {
      const ids = r.linked_anomaly_ids;
      return Array.isArray(ids) && (ids as unknown[]).includes(anomaly_id);
    }) ??
    // If none of the asset's chains explicitly list this anomaly_id,
    // fall back to the most recent chain for the asset — defensible
    // because the engine writes one chain per anomaly and the most
    // recent is the most likely match.
    rows[0];
  return {
    id: String(match.id),
    title: (match.title as string | null) ?? null,
    linked_mechanisms: match.linked_mechanisms,
    linked_anomaly_ids: match.linked_anomaly_ids,
  };
}

// Sprint 4 Polish (Fix B): primary_mechanism extraction now (1) defensively
// re-sorts linked_mechanisms by fit_score DESC so the canonical
// machine-readable identifier wins even if the engine wrote out-of-order
// rows, (2) prefers .mechanism_key (the canonical key per the
// cd_causal_chains schema) but accepts .code for backward compat, and
// (3) falls back to parsing the title's after-colon display name into
// snake_case when the linked_mechanisms array is empty/missing. Logs a
// console.warn before returning null so we know in production logs which
// row had the gap.
function displayNameToMechanismKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s/]+/g, "_")
    .replace(/[^a-z0-9_]+/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function extractPrimaryMechanism(
  chain: CausalChainRow | null
): string | null {
  if (!chain) return null;
  const lm = chain.linked_mechanisms;
  if (Array.isArray(lm) && lm.length > 0) {
    const items = lm.filter(
      (x): x is Record<string, unknown> | string =>
        x !== null && (typeof x === "object" || typeof x === "string")
    );
    // Stable-sort by fit_score DESC when present; entries without a
    // fit_score fall to the back. Entries that are plain strings have
    // no fit_score so they sort last.
    const indexed = items.map((x, idx) => ({ x, idx }));
    indexed.sort((a, b) => {
      const af =
        typeof a.x === "object" &&
        typeof (a.x as Record<string, unknown>).fit_score === "number"
          ? ((a.x as Record<string, unknown>).fit_score as number)
          : -Infinity;
      const bf =
        typeof b.x === "object" &&
        typeof (b.x as Record<string, unknown>).fit_score === "number"
          ? ((b.x as Record<string, unknown>).fit_score as number)
          : -Infinity;
      if (af !== bf) return bf - af;
      return a.idx - b.idx;
    });
    for (const { x } of indexed) {
      if (typeof x === "string") return x;
      const key = (x as Record<string, unknown>).mechanism_key;
      if (typeof key === "string" && key.length > 0) return key;
      const code = (x as Record<string, unknown>).code;
      if (typeof code === "string" && code.length > 0) return code;
    }
  }
  // Title fallback. cd_causal_chains.title is written by
  // causalChainEngine.ts as: `Causal chain for ${anomaly.id}: ${display_name}`
  // — extract the after-colon segment and snake_case it.
  const title = chain.title ?? "";
  const colonIdx = title.lastIndexOf(":");
  if (colonIdx >= 0 && colonIdx < title.length - 1) {
    const displayName = title.slice(colonIdx + 1).trim();
    if (displayName.length > 0) {
      const key = displayNameToMechanismKey(displayName);
      if (key.length > 0) {
        return key;
      }
    }
  }
  console.warn(
    `[predictionCapture] could not extract primary_mechanism from causal chain id=${chain.id} (linked_mechanisms shape=${
      Array.isArray(lm) ? `array[${lm.length}]` : typeof lm
    }, title="${title}")`
  );
  return null;
}

async function resolveAssetIdForAnomaly(
  supabase: SupabaseClient,
  org_id: string,
  anomaly_id: string
): Promise<string | null> {
  const { data } = await supabase
    .from("cd_asset_anomalies")
    .select("asset_id")
    .eq("org_id", org_id)
    .eq("id", anomaly_id)
    .maybeSingle();
  if (!data) return null;
  const asset = (data as Record<string, unknown>).asset_id;
  return typeof asset === "string" ? asset : null;
}

export async function captureDeliberationPrediction(
  deliberation_id: string,
  org_id: string,
  supabase: SupabaseClient
): Promise<CaptureResult> {
  try {
    const delib = await loadDeliberation(supabase, deliberation_id, org_id);
    if (!delib) {
      return { ok: false, error: "deliberation_not_found" };
    }
    if (!delib.deliberation_completed_at) {
      return { ok: false, note: "deliberation_not_completed" };
    }
    const consensus = coerceConsensus(delib.consensus_level);
    if (!consensus || consensus === "unresolved") {
      return { ok: false, note: "consensus_unresolved_skipped" };
    }
    if (!delib.finding_id) {
      return { ok: false, error: "deliberation_missing_finding_id" };
    }

    // Idempotency check (application-level; the SQL UNIQUE on
    // deliberation_id is a backstop).
    const existing = await existingPredictionId(
      supabase,
      deliberation_id,
      org_id
    );
    if (existing) {
      return { ok: true, prediction_id: existing, note: "already_captured" };
    }

    const consequence = await loadLatestConsequence(
      supabase,
      org_id,
      deliberation_id,
      delib.finding_id
    );

    let asset_id = consequence?.asset_id ?? null;
    if (!asset_id) {
      asset_id = await resolveAssetIdForAnomaly(
        supabase,
        org_id,
        delib.finding_id
      );
    }
    if (!asset_id) {
      // The migration requires asset_id NOT NULL; without it we can't
      // capture. Surface the gap so the orchestrator records it.
      return {
        ok: false,
        error: "could_not_resolve_asset_id",
      };
    }

    // Sprint 4 Polish (Fix B): pass asset_id as a hint so the causal
    // chain lookup can filter by a real column instead of jsonb-contains.
    const causalChain = await loadLatestCausalChain(
      supabase,
      org_id,
      delib.finding_id,
      asset_id
    );
    const primary_mechanism = extractPrimaryMechanism(causalChain);

    const payload = {
      org_id,
      deliberation_id,
      anomaly_id: delib.finding_id,
      asset_id,
      predicted_at: new Date().toISOString(),
      primary_mechanism,
      consensus_level: consensus,
      consequence_overall_tier: coerceConsequenceTier(consequence?.overall_tier),
      recommended_action_tier: coerceActionTier(
        consequence?.recommended_action_tier
      ),
      time_to_consequence_days: consequence?.time_to_consequence_days ?? null,
      total_confidence: consequence?.total_confidence ?? null,
    };

    const { data: inserted, error } = await supabase
      .from("cd_deliberation_predictions")
      .insert(payload)
      .select("id")
      .maybeSingle();
    if (error) {
      return {
        ok: false,
        error: `prediction_insert_failed: ${error.message}`,
      };
    }
    const prediction_id =
      inserted && typeof inserted === "object"
        ? String((inserted as Record<string, unknown>).id ?? "")
        : "";
    return { ok: true, prediction_id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `prediction_capture_threw: ${message}` };
  }
}
