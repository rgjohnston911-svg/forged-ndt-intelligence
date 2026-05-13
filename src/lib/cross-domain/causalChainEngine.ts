// ============================================================
// DEPLOY355 — Cross-domain causal chain engine
//
// Rules-based (NOT LLM-based) — deterministic and auditable.
// Engineer's cited_mechanisms feed the candidate list; this
// engine ranks them by fit and builds a forward failure path
// for the top mechanism. Persisted to cd_causal_chains.
//
// SCHEMA NOTES:
// - cd_degradation_mechanisms columns (live schema, the source of truth):
//     id, mechanism_key, display_name, category, description,
//     physics_explanation, related_domains, typical_evidence,
//     accelerators, inhibitors, related_codes,
//     default_consequence_bias, active, created_at
//   Sprint 2 speculatively added `applicable_materials`,
//   `typical_severity_range`, and `typical_progression_rate` to this
//   engine's SELECT, anticipating a follow-up migration that never
//   shipped. PostgREST rejected the SELECT (`42703 column ... does
//   not exist`) and the engine returned `ok:false` with
//   `mechanism_lookup_failed`. Sprint 3.3 fix: SELECT only requests
//   columns that exist. The material/severity/progression-rate
//   scoring components are deleted, not stubbed — re-add them under
//   a future migration alongside their backing columns.
// - cd_causal_chains stores `linked_mechanisms` + `chain_steps`
//   (jsonb arrays) — the brief's primary_mechanism_code /
//   ranked_mechanisms / failure_path map into those columns.
// ============================================================

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AnomalyContext,
  AssetContext,
  CausalChainResult,
  CausalChainStateNode,
} from "./types";

function generateUuid(): string {
  // randomUUID is available in Node 16.7+ and the Netlify Node 18 runtime.
  return randomUUID();
}

interface MechanismRow {
  mechanism_key: string;
  display_name: string;
  category: string;
  default_consequence_bias: "low" | "moderate" | "high" | "critical";
  related_domains: unknown;
  active: boolean;
}

export interface BuildCausalChainInput {
  anomaly: AnomalyContext;
  asset: AssetContext;
  candidateMechanismCodes: string[];
  supabase: SupabaseClient;
  org_id: string;
}

// Maps cat_X severity to numeric weight.
const SEVERITY_NUMERIC: Record<string, number> = {
  cat_1_minor: 1,
  cat_2_moderate: 2,
  cat_3_major: 3,
  cat_4_critical: 4,
};

const CONSEQUENCE_NUMERIC: Record<string, number> = {
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

// Generic forward progressions per mechanism category. Hardcoded
// in code for Sprint 2 because cd_degradation_mechanisms has no
// typical_progression_rate column. When the migration lands, swap
// this for the DB-driven path.
const CATEGORY_FAILURE_PATHS: Record<string, string[]> = {
  corrosion: [
    "surface_attack",
    "wall_thinning",
    "through_wall_penetration",
    "loss_of_containment",
  ],
  coating: [
    "coating_degradation",
    "coating_breakdown",
    "substrate_exposure",
    "underlying_corrosion_initiation",
  ],
  welding: [
    "weld_defect_propagation",
    "crack_extension",
    "leak_or_fracture",
    "structural_failure",
  ],
  fatigue: [
    "crack_initiation",
    "crack_propagation",
    "critical_crack_size",
    "fast_fracture",
  ],
  mechanical_damage: [
    "deformation_or_dent",
    "stress_concentration",
    "crack_initiation_at_damage",
    "leak_or_failure",
  ],
  environmental: [
    "environmental_stress_loading",
    "accelerated_degradation",
    "loss_of_integrity",
    "failure",
  ],
  erosion: [
    "surface_material_loss",
    "wall_thinning",
    "through_wall_penetration",
    "loss_of_containment",
  ],
  abrasion: [
    "surface_material_loss",
    "wall_thinning",
    "loss_of_function",
    "failure_or_replacement",
  ],
  thermal: [
    "thermal_stress",
    "material_property_degradation",
    "crack_or_distortion",
    "failure",
  ],
  pressure: [
    "overstress",
    "deformation",
    "rupture_initiation",
    "loss_of_containment",
  ],
  structural: [
    "load_redistribution",
    "local_yielding",
    "member_failure",
    "collapse_or_loss_of_function",
  ],
  biological: [
    "biofilm_or_growth_onset",
    "localized_attack",
    "wall_thinning_or_blockage",
    "loss_of_function",
  ],
  unknown: ["progression_unknown"],
};

function scoreDomainMatch(
  related_domains: unknown,
  asset_domain: string
): number {
  if (!Array.isArray(related_domains) || related_domains.length === 0) return 0;
  const arr = related_domains as unknown[];
  return arr.some((d) => typeof d === "string" && d === asset_domain) ? 1 : 0;
}

function scoreSeverityEnvelope(
  consequence_bias: string,
  anomaly_severity: string
): number {
  const c = CONSEQUENCE_NUMERIC[consequence_bias];
  const a = SEVERITY_NUMERIC[anomaly_severity];
  if (c === undefined || a === undefined) return 0;
  // Linear closeness: identical=1, 1 step apart=0.66, 2 apart=0.33, 3 apart=0.
  const diff = Math.abs(c - a);
  return Math.max(0, 1 - diff / 3);
}

function scoreMechanismAlreadyCited(
  candidate_key: string,
  anomaly_mechanism_key: string | null | undefined
): number {
  if (!anomaly_mechanism_key) return 0;
  return candidate_key === anomaly_mechanism_key ? 1 : 0;
}

interface ScoredMechanism {
  row: MechanismRow;
  fit_score: number;
  reasoning: string;
}

function scoreMechanism(
  m: MechanismRow,
  anomaly: AnomalyContext,
  _asset: AssetContext
): ScoredMechanism {
  // Scoring uses ONLY columns that exist in cd_degradation_mechanisms:
  // related_domains, default_consequence_bias, mechanism_key. Material /
  // severity-range / progression-rate components were removed in Sprint
  // 3.3 — re-add under a future migration alongside their backing columns.
  const components: Array<{ name: string; weight: number; score: number }> = [
    {
      name: "domain_match",
      weight: 0.5,
      score: scoreDomainMatch(m.related_domains, _asset.domain),
    },
    {
      name: "severity_envelope",
      weight: 0.3,
      score: scoreSeverityEnvelope(
        m.default_consequence_bias,
        anomaly.severity
      ),
    },
    {
      name: "mechanism_already_cited",
      weight: 0.2,
      score: scoreMechanismAlreadyCited(m.mechanism_key, anomaly.mechanism_key),
    },
  ];

  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  const fit_score =
    totalWeight > 0
      ? components.reduce((s, c) => s + (c.weight / totalWeight) * c.score, 0)
      : 0;

  const reasoning = components
    .map((c) => `${c.name}=${c.score.toFixed(2)}(w${c.weight.toFixed(2)})`)
    .join(" ");
  return { row: m, fit_score, reasoning };
}

function buildFailurePath(category: string): CausalChainStateNode[] {
  const path = CATEGORY_FAILURE_PATHS[category] ??
    CATEGORY_FAILURE_PATHS["unknown"];
  return path.map((state) => ({
    state,
    // No typical_progression_rate column in current schema; null
    // for Sprint 2. Migration in PR follow-up enables real estimates.
    estimated_days_to_state: null,
  }));
}

function emptyFailureResult(reason: string): CausalChainResult {
  return {
    ok: false,
    reason,
    causal_chain_id: null,
    primary_mechanism: null,
    ranked_alternatives: [],
    failure_path: [],
    confidence: 0,
  };
}

export async function buildCausalChain(
  input: BuildCausalChainInput
): Promise<CausalChainResult> {
  const { anomaly, asset, candidateMechanismCodes, supabase, org_id } = input;

  if (!candidateMechanismCodes || candidateMechanismCodes.length === 0) {
    return emptyFailureResult("no_candidates");
  }

  // Project ONLY columns that exist in cd_degradation_mechanisms (see
  // SCHEMA NOTES). Naming a nonexistent column here causes PostgREST
  // to reject the entire SELECT with `42703 column ... does not exist`
  // and the engine returns mechanism_lookup_failed — which is exactly
  // what masked the cd_causal_chains write path in production.
  const { data, error } = await supabase
    .from("cd_degradation_mechanisms")
    .select(
      "mechanism_key,display_name,category,default_consequence_bias,related_domains,active"
    )
    .in("mechanism_key", candidateMechanismCodes);

  if (error) {
    return emptyFailureResult(
      `mechanism_lookup_failed: ${error.message ?? "unknown"}`
    );
  }
  const rows = (data ?? []) as MechanismRow[];
  if (rows.length === 0) {
    return emptyFailureResult("no_mechanism_records_for_candidates");
  }

  const scored = rows
    .filter((r) => r.active !== false)
    .map((r) => scoreMechanism(r, anomaly, asset))
    .sort((a, b) => b.fit_score - a.fit_score);

  if (scored.length === 0) {
    return emptyFailureResult("no_active_mechanisms");
  }

  const top = scored[0];
  const top3 = scored.slice(0, 3);
  const failure_path = buildFailurePath(top.row.category);

  const ranked_mechanisms_jsonb = top3.map((s) => ({
    mechanism_key: s.row.mechanism_key,
    display_name: s.row.display_name,
    fit_score: s.fit_score,
    reasoning: s.reasoning,
  }));

  // Generate the id client-side so we don't need a read-back roundtrip
  // (and so tests work against the mock without read-after-write support).
  const causal_chain_id = generateUuid();

  // Persist to cd_causal_chains using existing column names (see
  // SCHEMA NOTES above). chain_type defaults to 'degradation'.
  const insertRow = {
    id: causal_chain_id,
    org_id,
    asset_id: anomaly.asset_id,
    title: `Causal chain for ${anomaly.id}: ${top.row.display_name}`,
    summary: `Primary mechanism: ${top.row.display_name} (fit ${top.fit_score.toFixed(2)})`,
    chain_type: "degradation",
    linked_anomaly_ids: [anomaly.id],
    linked_asset_ids: [anomaly.asset_id],
    linked_mechanisms: ranked_mechanisms_jsonb,
    chain_steps: failure_path,
    confidence: top.fit_score,
    competing_hypotheses: top3
      .slice(1)
      .map((s) => ({
        mechanism_key: s.row.mechanism_key,
        fit_score: s.fit_score,
      })),
    missing_evidence: [],
    recommended_information_gain_actions: [],
    created_by: "cross_domain:causal_chain_engine",
  };

  // Sprint 3.2: check INSERT error explicitly. supabase-js returns
  // `{ error }` on RLS denial / CHECK violation / missing column and
  // does NOT throw — we'd silently drop the row otherwise (which is
  // exactly what happened in the first production deliberation).
  const insertRes = (await supabase
    .from("cd_causal_chains")
    .insert(insertRow)) as { data: unknown; error: { message?: string } | null };
  if (insertRes && insertRes.error) {
    const errMsg = insertRes.error.message ?? String(insertRes.error);
    console.error(
      `[causalChainEngine] insert FAILED chain_id=${causal_chain_id} org=${org_id} err="${errMsg}"`
    );
    return emptyFailureResult(`causal_chain_insert_failed: ${errMsg}`);
  }
  console.log(
    `[causalChainEngine] inserted chain_id=${causal_chain_id} primary=${top.row.mechanism_key} fit=${top.fit_score.toFixed(2)} alternatives=${top3.length - 1}`
  );

  return {
    ok: true,
    causal_chain_id,
    primary_mechanism: {
      code: top.row.mechanism_key,
      name: top.row.display_name,
      fit_score: top.fit_score,
      reasoning: top.reasoning,
    },
    ranked_alternatives: top3.slice(1).map((s) => ({
      code: s.row.mechanism_key,
      name: s.row.display_name,
      fit_score: s.fit_score,
    })),
    failure_path,
    confidence: top.fit_score,
  };
}
