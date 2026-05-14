// ============================================================
// Sprint 4C — Consequence Engine (rules-based, deterministic)
//
// Per-anomaly risk quantification across 5 categories: safety, cost,
// downtime, environmental, regulatory. Pure functions where possible;
// the only impure step is the INSERT into cd_anomaly_consequence_assessments
// (DEPLOY357). No AI calls.
//
// Philosophy: same as causalChainEngine.ts — rules-based first, LLM
// augmentation never. The Synthesizer wraps prose around these numbers;
// it does not generate or override them.
//
// Conceptual basis: API RP 581 (Risk-Based Inspection), 40 CFR 110
// (oil-spill thresholds), 30 CFR 250 (offshore environmental reporting),
// 49 CFR 192/195 (PHMSA pipeline reporting). Tiers map onto a 6-step
// negligible→catastrophic scale rather than the 1..5 integer scale of
// the asset-baseline table — that's intentional, see DEPLOY357 header.
// ============================================================

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AnomalyContext,
  AssetContext,
  CausalChainResult,
  CategoryAssessment,
  ConsequenceCategory,
  ConsequenceProfile,
  ConsequenceTier,
  RecommendedActionTier,
} from "./types";

export interface BuildConsequenceProfileInput {
  anomaly: AnomalyContext;
  asset: AssetContext;
  causalChain?: CausalChainResult | null;
  supabase: SupabaseClient;
  org_id: string;
  deliberation_id?: string | null;
}

export interface BuildConsequenceProfileResult {
  ok: boolean;
  profile?: ConsequenceProfile;
  error?: string;
}

// ------------------------------------------------------------
// Tier ordering helpers
// ------------------------------------------------------------

const TIER_ORDER: ConsequenceTier[] = [
  "negligible",
  "low",
  "moderate",
  "high",
  "severe",
  "catastrophic",
];

function tierIndex(t: ConsequenceTier): number {
  return TIER_ORDER.indexOf(t);
}

function bumpTier(t: ConsequenceTier, steps: number = 1): ConsequenceTier {
  const i = Math.min(
    TIER_ORDER.length - 1,
    Math.max(0, tierIndex(t) + steps)
  );
  return TIER_ORDER[i];
}

function worstTier(tiers: ConsequenceTier[]): ConsequenceTier {
  if (tiers.length === 0) return "negligible";
  return tiers.reduce(
    (acc, t) => (tierIndex(t) > tierIndex(acc) ? t : acc),
    "negligible" as ConsequenceTier
  );
}

// ------------------------------------------------------------
// Inline lookup tables (Sprint 4 polish target: move to DB)
// ------------------------------------------------------------

// Hours of downtime per mechanism for a typical repair. Sourced from
// industry rule-of-thumb estimates; not meant to be precise. Subsea
// access multiplies these by 3x in the engine, then the tier mapping
// translates hours → tier. Mechanism keys match cd_degradation_mechanisms.
const REPAIR_TIME_ESTIMATE_HOURS: Record<
  string,
  { low: number; expected: number; high: number }
> = {
  general_corrosion: { low: 24, expected: 72, high: 240 },
  pitting_corrosion: { low: 16, expected: 48, high: 168 },
  crevice_corrosion: { low: 24, expected: 72, high: 240 },
  galvanic_corrosion: { low: 16, expected: 48, high: 144 },
  microbiologically_influenced_corrosion: { low: 48, expected: 120, high: 336 },
  corrosion_under_insulation: { low: 72, expected: 168, high: 480 },
  erosion_corrosion: { low: 24, expected: 96, high: 240 },
  coating_blistering: { low: 8, expected: 24, high: 72 },
  coating_holiday: { low: 4, expected: 16, high: 48 },
  coating_disbondment: { low: 24, expected: 72, high: 168 },
  underfilm_corrosion: { low: 24, expected: 96, high: 240 },
  cathodic_protection_failure: { low: 8, expected: 24, high: 72 },
  anode_depletion: { low: 4, expected: 12, high: 48 },
  marine_growth_loading: { low: 24, expected: 72, high: 168 },
  scour: { low: 48, expected: 168, high: 480 },
  settlement: { low: 168, expected: 720, high: 2160 },
  fatigue_cracking: { low: 72, expected: 240, high: 720 },
  weld_toe_cracking: { low: 48, expected: 168, high: 480 },
  hydrogen_cracking: { low: 96, expected: 336, high: 720 },
  lack_of_fusion: { low: 24, expected: 96, high: 240 },
  undercut: { low: 16, expected: 48, high: 120 },
  porosity: { low: 16, expected: 48, high: 120 },
  impact_damage: { low: 24, expected: 96, high: 336 },
  dropped_object_damage: { low: 48, expected: 168, high: 480 },
  vessel_strike_damage: { low: 168, expected: 720, high: 2160 },
  abrasion_damage: { low: 16, expected: 48, high: 168 },
  cavitation_damage: { low: 24, expected: 72, high: 240 },
  thermal_cycling: { low: 48, expected: 168, high: 480 },
  pressure_cycling: { low: 48, expected: 168, high: 480 },
  concrete_spalling: { low: 72, expected: 240, high: 720 },
  rebar_corrosion: { low: 168, expected: 480, high: 1440 },
  chloride_attack: { low: 168, expected: 480, high: 1440 },
  freeze_thaw_damage: { low: 96, expected: 336, high: 720 },
};

// Wall-loss progression in mm/year. Rule-of-thumb central estimates
// for the engine's time-to-consequence calculation. Real values vary
// wildly with environment; calling code should treat as ballpark.
const PROGRESSION_RATE_MM_PER_YEAR: Record<string, number> = {
  general_corrosion: 0.1,
  pitting_corrosion: 0.5,
  crevice_corrosion: 0.4,
  galvanic_corrosion: 0.3,
  microbiologically_influenced_corrosion: 0.8,
  corrosion_under_insulation: 0.4,
  erosion_corrosion: 1.0,
  underfilm_corrosion: 0.3,
  cavitation_damage: 0.6,
  rebar_corrosion: 0.05,
  chloride_attack: 0.08,
};

// Default consequence bias by mechanism. Mirrors the seed data in
// DEPLOY355 (cd_degradation_mechanisms.default_consequence_bias) so we
// don't need a roundtrip to the DB. Keep this in sync if seeds change.
const MECHANISM_BIAS: Record<
  string,
  "low" | "moderate" | "high" | "critical"
> = {
  general_corrosion: "moderate",
  pitting_corrosion: "high",
  crevice_corrosion: "high",
  galvanic_corrosion: "moderate",
  microbiologically_influenced_corrosion: "high",
  corrosion_under_insulation: "high",
  erosion_corrosion: "high",
  coating_blistering: "moderate",
  coating_holiday: "moderate",
  coating_disbondment: "moderate",
  underfilm_corrosion: "high",
  cathodic_protection_failure: "high",
  anode_depletion: "moderate",
  marine_growth_loading: "moderate",
  scour: "high",
  settlement: "high",
  fatigue_cracking: "critical",
  weld_toe_cracking: "critical",
  hydrogen_cracking: "critical",
  lack_of_fusion: "high",
  undercut: "moderate",
  porosity: "moderate",
  impact_damage: "high",
  dropped_object_damage: "high",
  vessel_strike_damage: "critical",
  abrasion_damage: "moderate",
  cavitation_damage: "moderate",
  thermal_cycling: "moderate",
  pressure_cycling: "high",
  concrete_spalling: "high",
  rebar_corrosion: "high",
  chloride_attack: "high",
  freeze_thaw_damage: "moderate",
};

// ------------------------------------------------------------
// Helper: pull a primary mechanism key from the inputs
// ------------------------------------------------------------

function resolveMechanismKey(
  anomaly: AnomalyContext,
  causalChain?: CausalChainResult | null
): string | null {
  if (causalChain && causalChain.ok && causalChain.primary_mechanism) {
    return causalChain.primary_mechanism.code;
  }
  if (anomaly.mechanism_key) return anomaly.mechanism_key;
  return null;
}

function fluidString(asset: AssetContext): string {
  const opc = asset.operating_conditions ?? {};
  const f = (opc as Record<string, unknown>).fluid;
  return typeof f === "string" ? f.toLowerCase() : "";
}

function hasHydrocarbon(fluid: string): boolean {
  return /(\bhc\b|hydrocarbon|crude|oil|gas|lpg|condensate|diesel|naphtha|natural_gas|methane)/i.test(
    fluid
  );
}

function hasToxic(fluid: string): boolean {
  return /h2s|hydrogen sulfide|chlorine|ammonia|so2/i.test(fluid);
}

function hasExplosive(fluid: string): boolean {
  return /(lpg|natural_gas|hydrogen|methane|propane|butane)/i.test(fluid);
}

function isMarineOrSubsea(asset: AssetContext): boolean {
  const env = (asset.service_environment ?? "").toLowerCase();
  return /(subsea|marine|offshore|underwater|splash)/.test(env);
}

function isBuried(asset: AssetContext): boolean {
  const env = (asset.service_environment ?? "").toLowerCase();
  return /buried|subterranean|underground/.test(env);
}

// ------------------------------------------------------------
// Category: Safety
//
// Base tier from a criticality × severity matrix (API RP 581-style
// risk grid), bumped up by fluid and environment modifiers.
// ------------------------------------------------------------

function assessSafety(
  anomaly: AnomalyContext,
  asset: AssetContext
): CategoryAssessment {
  const factors: string[] = [
    `asset.criticality=${asset.criticality}`,
    `anomaly.severity=${anomaly.severity}`,
  ];
  // Matrix lookup. Rows: criticality, Columns: severity.
  const matrix: Record<string, Record<string, ConsequenceTier>> = {
    life_safety: {
      cat_4_critical: "catastrophic",
      cat_3_major: "severe",
      cat_2_moderate: "high",
      cat_1_minor: "moderate",
    },
    critical: {
      cat_4_critical: "severe",
      cat_3_major: "high",
      cat_2_moderate: "moderate",
      cat_1_minor: "low",
    },
    high: {
      cat_4_critical: "high",
      cat_3_major: "moderate",
      cat_2_moderate: "low",
      cat_1_minor: "low",
    },
    moderate: {
      cat_4_critical: "moderate",
      cat_3_major: "low",
      cat_2_moderate: "low",
      cat_1_minor: "negligible",
    },
    low: {
      cat_4_critical: "low",
      cat_3_major: "low",
      cat_2_moderate: "negligible",
      cat_1_minor: "negligible",
    },
  };
  let tier: ConsequenceTier =
    matrix[asset.criticality]?.[anomaly.severity] ?? "moderate";

  const fluid = fluidString(asset);
  if (hasToxic(fluid)) {
    tier = bumpTier(tier, 1);
    factors.push(`fluid=${fluid} (toxic release potential)`);
  }
  if (hasExplosive(fluid)) {
    tier = bumpTier(tier, 1);
    factors.push(`fluid=${fluid} (explosive release potential)`);
  }
  if (isMarineOrSubsea(asset)) {
    tier = bumpTier(tier, 1);
    factors.push(
      `service_environment=${asset.service_environment} (limited evacuation/response)`
    );
  }

  const reasoning = `Safety tier derived from API RP 581-style criticality × severity matrix (${asset.criticality} × ${anomaly.severity}), with modifiers applied for fluid hazard and access environment.`;
  return {
    category: "safety",
    tier,
    estimated_value: null,
    reasoning,
    contributing_factors: factors,
    citation_codes: ["API RP 581"],
  };
}

// ------------------------------------------------------------
// Category: Cost
//
// Order-of-magnitude estimate around an asset replacement cost or
// daily production value, if either is in operating_conditions or
// metadata_jsonb. If we have nothing to anchor on, return null —
// don't fabricate dollar figures.
// ------------------------------------------------------------

function readNumericHint(
  asset: AssetContext,
  ...keys: string[]
): number | null {
  const sources: Array<Record<string, unknown> | null | undefined> = [
    asset.operating_conditions,
    asset.metadata_jsonb,
  ];
  for (const src of sources) {
    if (!src) continue;
    for (const k of keys) {
      const v = (src as Record<string, unknown>)[k];
      if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
    }
  }
  return null;
}

const COST_MULTIPLIERS: Record<
  ConsequenceTier,
  { low: number; expected: number; high: number }
> = {
  catastrophic: { low: 5, expected: 10, high: 20 },
  severe: { low: 1, expected: 3, high: 8 },
  high: { low: 0.3, expected: 1, high: 2 },
  moderate: { low: 0.1, expected: 0.3, high: 1 },
  low: { low: 0.02, expected: 0.1, high: 0.3 },
  negligible: { low: 0.0, expected: 0.02, high: 0.1 },
};

function assessCost(
  anomaly: AnomalyContext,
  asset: AssetContext,
  safetyTier: ConsequenceTier,
  mechanismKey: string | null
): CategoryAssessment {
  const factors: string[] = [`safety_tier=${safetyTier}`];
  if (mechanismKey) factors.push(`mechanism=${mechanismKey}`);

  const replacementCost = readNumericHint(
    asset,
    "replacement_cost_usd",
    "asset_replacement_cost_usd",
    "capex_usd"
  );
  const dailyValue = readNumericHint(
    asset,
    "daily_production_value_usd",
    "daily_revenue_usd"
  );

  // Anchor preference: replacement cost first, fall back to 60 days
  // of production value if that's all we have.
  let anchorUsd: number | null = null;
  let anchorLabel = "";
  if (replacementCost) {
    anchorUsd = replacementCost;
    anchorLabel = "asset replacement cost";
    factors.push(`replacement_cost_usd=${replacementCost}`);
  } else if (dailyValue) {
    anchorUsd = dailyValue * 60;
    anchorLabel = "60-day production-value proxy";
    factors.push(`daily_production_value_usd=${dailyValue} × 60 days`);
  }

  if (!anchorUsd) {
    return {
      category: "cost",
      tier: safetyTier,
      estimated_value: null,
      reasoning:
        "No asset replacement cost or daily production value found in operating_conditions/metadata_jsonb — cannot produce a defensible dollar estimate. Cost tier mirrors safety tier as a coarse proxy.",
      contributing_factors: factors,
    };
  }

  const mult = COST_MULTIPLIERS[safetyTier];
  const round = (n: number) => Math.round(n);
  return {
    category: "cost",
    tier: safetyTier,
    estimated_value: {
      low: round(anchorUsd * mult.low),
      expected: round(anchorUsd * mult.expected),
      high: round(anchorUsd * mult.high),
      unit: "USD",
    },
    reasoning: `Order-of-magnitude estimate anchored on ${anchorLabel} (${anchorUsd.toLocaleString()} USD) with tier-${safetyTier} multipliers (${mult.low}×/${mult.expected}×/${mult.high}×). Real cost depends on repair complexity, regulatory penalties, and downstream business interruption — these multipliers are conservative ballparks.`,
    contributing_factors: factors,
    citation_codes: ["API RP 581"],
  };
}

// ------------------------------------------------------------
// Category: Downtime
//
// Hardcoded lookup keyed by mechanism_key, 3x multiplier for subsea
// access. If mechanism unknown, return null.
// ------------------------------------------------------------

function downtimeHoursToTier(hours: number): ConsequenceTier {
  if (hours >= 720) return "catastrophic"; // >= 30 days
  if (hours >= 240) return "severe"; // >= 10 days
  if (hours >= 72) return "high"; // >= 3 days
  if (hours >= 24) return "moderate"; // >= 1 day
  if (hours >= 4) return "low";
  return "negligible";
}

// Severity-scaling of the per-mechanism base repair time. The inline
// lookup gives a typical (cat_3-ish) repair window; minor and moderate
// anomalies don't take that long, and critical anomalies often do
// more. Severity is treated as the "scope of damage" proxy.
function severityRepairScale(
  severity: AnomalyContext["severity"]
): number {
  switch (severity) {
    case "cat_1_minor":
      return 0.25;
    case "cat_2_moderate":
      return 0.5;
    case "cat_3_major":
      return 1.0;
    case "cat_4_critical":
      return 1.5;
    default:
      return 1.0;
  }
}

function assessDowntime(
  anomaly: AnomalyContext,
  asset: AssetContext,
  mechanismKey: string | null
): CategoryAssessment {
  const factors: string[] = [];
  if (mechanismKey) factors.push(`mechanism=${mechanismKey}`);
  factors.push(`anomaly.severity=${anomaly.severity}`);
  if (!mechanismKey || !REPAIR_TIME_ESTIMATE_HOURS[mechanismKey]) {
    return {
      category: "downtime",
      tier: "low",
      estimated_value: null,
      reasoning: mechanismKey
        ? `Mechanism ${mechanismKey} has no repair-time estimate in the inline lookup table; downtime cannot be quantified.`
        : "No primary mechanism resolved from causal chain or anomaly inputs; downtime cannot be quantified.",
      contributing_factors: factors,
    };
  }

  const base = REPAIR_TIME_ESTIMATE_HOURS[mechanismKey];
  const subseaMultiplier = isMarineOrSubsea(asset) ? 3 : 1;
  if (subseaMultiplier > 1) {
    factors.push(
      `subsea/marine access multiplier ×${subseaMultiplier} on base repair time`
    );
  }
  const sev = severityRepairScale(anomaly.severity);
  if (sev !== 1.0) {
    factors.push(`severity scope multiplier ×${sev} on base repair time`);
  }
  const round = (n: number) => Math.round(n * 10) / 10;
  const low = round(base.low * subseaMultiplier * sev);
  const expected = round(base.expected * subseaMultiplier * sev);
  const high = round(base.high * subseaMultiplier * sev);

  return {
    category: "downtime",
    tier: downtimeHoursToTier(expected),
    estimated_value: { low, expected, high, unit: "hours" },
    reasoning: `Base repair time for ${mechanismKey} is ${base.low}-${base.expected}-${base.high} hours (inline lookup; targeted for DB normalization in Sprint 5)${subseaMultiplier > 1 ? `, multiplied by ${subseaMultiplier}× for ${asset.service_environment} access` : ""}${sev !== 1.0 ? `, scaled ×${sev} for ${anomaly.severity} scope` : ""}. Tier derived from expected hours.`,
    contributing_factors: factors,
  };
}

// ------------------------------------------------------------
// Category: Environmental
// ------------------------------------------------------------

function assessEnvironmental(
  anomaly: AnomalyContext,
  asset: AssetContext
): CategoryAssessment {
  const factors: string[] = [
    `anomaly.severity=${anomaly.severity}`,
    `service_environment=${asset.service_environment ?? "unspecified"}`,
  ];
  const fluid = fluidString(asset);
  const citations: string[] = [];
  let tier: ConsequenceTier = "negligible";

  const severeAnomaly =
    anomaly.severity === "cat_3_major" ||
    anomaly.severity === "cat_4_critical";

  if (hasHydrocarbon(fluid)) {
    factors.push(`fluid=${fluid} (hydrocarbon)`);
    if (isMarineOrSubsea(asset)) {
      tier = severeAnomaly ? "severe" : "high";
      citations.push("40 CFR 110", "30 CFR 250");
      factors.push("marine/subsea environment → water-body spill risk");
    } else if (isBuried(asset)) {
      tier = severeAnomaly ? "high" : "moderate";
      citations.push("40 CFR 110");
      factors.push("buried environment → soil/groundwater contamination risk");
    } else {
      tier = severeAnomaly ? "moderate" : "low";
      citations.push("40 CFR 110");
    }
  } else if (hasToxic(fluid)) {
    factors.push(`fluid=${fluid} (toxic)`);
    tier = severeAnomaly ? "severe" : "high";
    citations.push("40 CFR 68");
  } else {
    factors.push(`fluid=${fluid || "unspecified"} (no hazardous substance identified)`);
    tier = "negligible";
  }

  return {
    category: "environmental",
    tier,
    estimated_value: null,
    reasoning: `Environmental tier derived from fluid hazard class × service environment × anomaly severity. Hydrocarbon in marine/subsea environments triggers the highest tiers per 40 CFR 110 oil-spill thresholds; non-hazardous or unspecified fluids drop to negligible.`,
    contributing_factors: factors,
    citation_codes: citations,
  };
}

// ------------------------------------------------------------
// Category: Regulatory
// ------------------------------------------------------------

function assessRegulatory(
  anomaly: AnomalyContext,
  asset: AssetContext
): CategoryAssessment {
  const factors: string[] = [
    `asset.domain=${asset.domain}`,
    `anomaly.severity=${anomaly.severity}`,
    `service_environment=${asset.service_environment ?? "unspecified"}`,
  ];
  const fluid = fluidString(asset);
  const citations: string[] = [];
  let tier: ConsequenceTier = "negligible";

  const severeAnomaly =
    anomaly.severity === "cat_3_major" ||
    anomaly.severity === "cat_4_critical";

  // PHMSA rules
  if (asset.domain === "pipeline") {
    if (isBuried(asset) || isMarineOrSubsea(asset)) {
      const isLiquid = hasHydrocarbon(fluid) && !hasExplosive(fluid);
      const isGas = hasExplosive(fluid);
      if (isLiquid) {
        citations.push("49 CFR 195");
        factors.push("PHMSA liquid pipeline regulation applies");
        tier = severeAnomaly ? "severe" : "high";
      } else if (isGas) {
        citations.push("49 CFR 192");
        factors.push("PHMSA gas pipeline regulation applies");
        tier = severeAnomaly ? "severe" : "high";
      }
    }
    if (isMarineOrSubsea(asset) && hasHydrocarbon(fluid)) {
      citations.push("30 CFR 250");
      factors.push("BSEE offshore notification regime applies");
      tier = severeAnomaly ? "catastrophic" : "severe";
    }
  }

  // ASME pressure equipment
  if (asset.domain === "pressure_equipment" && severeAnomaly) {
    citations.push("ASME PCC-3");
    factors.push(
      "Pressure equipment with major/critical anomaly → ASME PCC-3 inspection trigger"
    );
    tier = bumpTier(tier, tierIndex(tier) < tierIndex("high") ? 2 : 1);
  }

  // Offshore structural
  if (
    asset.domain === "structural" &&
    isMarineOrSubsea(asset) &&
    severeAnomaly
  ) {
    citations.push("API RP 2A");
    factors.push("Offshore structural anomaly → API RP 2A inspection regime");
    tier = bumpTier(tier, 1);
  }

  return {
    category: "regulatory",
    tier,
    estimated_value: null,
    reasoning:
      citations.length === 0
        ? `No specific federal reporting trigger fires for ${asset.domain}/${asset.service_environment ?? "unspecified"} with ${anomaly.severity} severity under current rules.`
        : `Rules fired: ${citations.join(", ")}. Notification/inspection obligations apply per cited regulations.`,
    contributing_factors: factors,
    citation_codes: citations,
  };
}

// ------------------------------------------------------------
// Time-to-consequence
//
// Tries to compute days until remaining_wall_mm reaches 50% nominal
// using a hardcoded progression rate. Falls back to null + reasoning.
// ------------------------------------------------------------

function assessTimeToConsequence(
  anomaly: AnomalyContext,
  mechanismKey: string | null
): ConsequenceProfile["time_to_consequence"] {
  const meas = anomaly.measurement_jsonb ?? {};
  const remainingWall =
    typeof (meas as Record<string, unknown>).remaining_wall_mm === "number"
      ? ((meas as Record<string, unknown>).remaining_wall_mm as number)
      : null;
  const nominalWall =
    typeof (meas as Record<string, unknown>).nominal_wall_mm === "number"
      ? ((meas as Record<string, unknown>).nominal_wall_mm as number)
      : null;
  const rate = mechanismKey ? PROGRESSION_RATE_MM_PER_YEAR[mechanismKey] : undefined;

  if (!remainingWall || !nominalWall || !rate) {
    const missing: string[] = [];
    if (!remainingWall) missing.push("remaining_wall_mm");
    if (!nominalWall) missing.push("nominal_wall_mm");
    if (!rate) missing.push("progression rate for mechanism");
    return {
      estimated_days: null,
      confidence: "low",
      reasoning: `Insufficient inputs to compute time-to-consequence (${missing.join(", ")}). Treat any narrative timeline from the AI specialists as low-confidence until field measurements are taken.`,
    };
  }
  // Days until wall hits 50% of nominal.
  const threshold = nominalWall * 0.5;
  const slackMm = remainingWall - threshold;
  if (slackMm <= 0) {
    return {
      estimated_days: 0,
      confidence: "high",
      reasoning: `Remaining wall (${remainingWall} mm) already at or below the 50%-of-nominal engineering critical threshold (${threshold} mm). Time-to-consequence is effectively 0; action is immediate.`,
    };
  }
  const days = Math.round((slackMm / rate) * 365);
  return {
    estimated_days: days,
    confidence: "medium",
    reasoning: `Computed as (remaining_wall_mm ${remainingWall} − 50%-nominal threshold ${threshold}) / progression rate ${rate} mm/year × 365. Single-point linear extrapolation; real degradation rates vary with operating conditions.`,
  };
}

// ------------------------------------------------------------
// Aggregate → recommended_action_tier
// ------------------------------------------------------------

function deriveRecommendedAction(
  categories: CategoryAssessment[]
): RecommendedActionTier {
  const tiers = categories.map((c) => c.tier);
  if (tiers.includes("catastrophic")) return "cease_operation";
  if (tiers.includes("severe")) return "immediate_remediation";
  const highCount = tiers.filter((t) => t === "high").length;
  if (highCount >= 2) return "urgent_assessment";
  if (highCount === 1) return "engineering_review";
  return "monitor";
}

// Per-category confidence: 0.8 when quantified, 0.3 when null estimated_value.
function deriveTotalConfidence(categories: CategoryAssessment[]): number {
  if (categories.length === 0) return 0;
  const sum = categories.reduce(
    (acc, c) => acc + (c.estimated_value === null ? 0.3 : 0.8),
    0
  );
  return Number((sum / categories.length).toFixed(2));
}

// ------------------------------------------------------------
// Public entry point
// ------------------------------------------------------------

export async function buildConsequenceProfile(
  input: BuildConsequenceProfileInput
): Promise<BuildConsequenceProfileResult> {
  try {
    const { anomaly, asset, causalChain, supabase, org_id, deliberation_id } =
      input;

    const mechanismKey = resolveMechanismKey(anomaly, causalChain);
    const safety = assessSafety(anomaly, asset);
    const cost = assessCost(anomaly, asset, safety.tier, mechanismKey);
    const downtime = assessDowntime(anomaly, asset, mechanismKey);
    const environmental = assessEnvironmental(anomaly, asset);
    const regulatory = assessRegulatory(anomaly, asset);

    const categories: CategoryAssessment[] = [
      safety,
      cost,
      downtime,
      environmental,
      regulatory,
    ];

    const overall_tier = worstTier(categories.map((c) => c.tier));
    const time_to_consequence = assessTimeToConsequence(anomaly, mechanismKey);
    const recommended_action_tier = deriveRecommendedAction(categories);
    const total_confidence = deriveTotalConfidence(categories);

    const profile: ConsequenceProfile = {
      consequence_profile_id: randomUUID(),
      anomaly_id: anomaly.id,
      asset_id: asset.id,
      overall_tier,
      categories,
      time_to_consequence,
      recommended_action_tier,
      total_confidence,
    };

    // Persist. INSERT failure does NOT block the deliberation — the
    // caller in the orchestrator captures the error in
    // arbitration_rules_applied.consequence_engine_error.
    const { error: insertError } = await supabase
      .from("cd_anomaly_consequence_assessments")
      .insert({
        id: profile.consequence_profile_id,
        org_id,
        anomaly_id: profile.anomaly_id,
        asset_id: profile.asset_id,
        deliberation_id: deliberation_id ?? null,
        overall_tier: profile.overall_tier,
        recommended_action_tier: profile.recommended_action_tier,
        total_confidence: profile.total_confidence,
        time_to_consequence_days: profile.time_to_consequence.estimated_days,
        time_to_consequence_confidence:
          profile.time_to_consequence.confidence,
        profile_jsonb: profile,
      });
    if (insertError) {
      return {
        ok: false,
        profile,
        error: `consequence_assessments insert failed: ${insertError.message}`,
      };
    }

    return { ok: true, profile };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `consequence_engine_threw: ${message}` };
  }
}

// Exports for tests.
export {
  TIER_ORDER,
  worstTier,
  bumpTier,
  tierIndex,
  assessSafety,
  assessCost,
  assessDowntime,
  assessEnvironmental,
  assessRegulatory,
  assessTimeToConsequence,
  deriveRecommendedAction,
  deriveTotalConfidence,
  REPAIR_TIME_ESTIMATE_HOURS,
  PROGRESSION_RATE_MM_PER_YEAR,
  MECHANISM_BIAS,
};
