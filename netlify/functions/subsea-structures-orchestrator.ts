// @ts-nocheck
/**
 * DEPLOY287 - subsea-structures-orchestrator.ts
 * netlify/functions/subsea-structures-orchestrator.ts
 *
 * SUBSEA STRUCTURES INTELLIGENCE AUTHORITY
 *
 * The orchestrator that thinks like:
 * "A senior offshore integrity engineer + corrosion specialist +
 *  structural analyst + inspection supervisor in one system."
 *
 * It always asks:
 * - What environment is this in?
 * - What is flowing through it?
 * - What hit it or interacted with it?
 * - What is the structure's role?
 * - What will happen next if nothing is done?
 *
 * Klein Bottle: subsea assets fail from INTERACTION.
 * ENVIRONMENT + STRUCTURE + MATERIAL + COATING + CP + FLOW + EVENTS
 * There is no inside or outside. One continuous degradation surface.
 *
 * POST /api/subsea-structures-orchestrator
 *
 * Actions:
 *   full_assessment        — complete subsea integrity assessment
 *   quick_assessment       — rapid screening assessment
 *   get_assessment_template — required inputs for assessment
 *   get_registry           — engine metadata
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var ENGINE_ID = "subsea-structures-orchestrator";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY287";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

// ============================================================
// SUBSEA EVIDENCE CONTRACT
// ============================================================

var REQUIRED_EVIDENCE = [
  { field: "asset_type", importance: "critical", description: "Asset class (jacket, pipeline, riser, etc.)" },
  { field: "zone", importance: "critical", description: "Zone (atmospheric, splash, tidal, submerged, mudline, buried, internal)" },
  { field: "location_description", importance: "critical", description: "Physical location on the asset" },
  { field: "damage_description", importance: "critical", description: "What was found or what happened" },
  { field: "coating_condition", importance: "high", description: "Coating state at assessment location" },
  { field: "cp_status", importance: "high", description: "CP protection status" },
  { field: "marine_growth_level", importance: "high", description: "Fouling level (none/light/moderate/heavy/extreme)" },
  { field: "structural_role", importance: "high", description: "Primary/secondary/appurtenance" },
  { field: "inspection_method", importance: "high", description: "How the finding was detected" },
  { field: "material", importance: "moderate", description: "Material grade" },
  { field: "wall_thickness_mm", importance: "moderate", description: "Measured or nominal wall thickness" },
  { field: "age_years", importance: "moderate", description: "Asset age" },
  { field: "depth_m", importance: "moderate", description: "Water depth" },
  { field: "internal_fluid", importance: "moderate", description: "What flows through it (if applicable)" },
  { field: "dimensions", importance: "moderate", description: "Damage dimensions (length, width, depth)" }
];

// ============================================================
// INTERNAL PROCESS CONDITIONS
// ============================================================

var INTERNAL_CONDITIONS = {
  dry_gas: { corrosion_risk: "low", mechanisms: ["none_if_dry"], severity_factor: 0.2 },
  wet_gas: { corrosion_risk: "moderate", mechanisms: ["CO2_corrosion", "condensation_corrosion"], severity_factor: 0.6 },
  oil: { corrosion_risk: "low_to_moderate", mechanisms: ["under_deposit", "wax_trapping"], severity_factor: 0.4 },
  multiphase: { corrosion_risk: "high", mechanisms: ["CO2_corrosion", "erosion_corrosion", "slug_impact"], severity_factor: 0.8 },
  high_water_cut: { corrosion_risk: "high", mechanisms: ["general_corrosion", "MIC", "under_deposit"], severity_factor: 0.8 },
  sour_service: { corrosion_risk: "very_high", mechanisms: ["H2S_corrosion", "SSC", "HIC", "SOHIC"], severity_factor: 1.0 },
  co2_rich: { corrosion_risk: "high", mechanisms: ["CO2_corrosion", "mesa_attack"], severity_factor: 0.8 },
  sand_producing: { corrosion_risk: "high", mechanisms: ["erosion", "erosion_corrosion"], severity_factor: 0.9 },
  seawater_injection: { corrosion_risk: "high", mechanisms: ["oxygen_corrosion", "MIC", "pitting"], severity_factor: 0.8 }
};

// ============================================================
// CONSEQUENCE CLASSIFICATION
// ============================================================

var CONSEQUENCE_MATRIX = {
  catastrophic: {
    description: "Loss of life risk, major environmental release, structural collapse",
    response_time: "immediate",
    decision_mode: "locked",
    examples: ["Platform structural failure", "Riser rupture", "Mooring failure"]
  },
  major: {
    description: "Significant environmental release, major production loss, major repair cost",
    response_time: "urgent_days",
    decision_mode: "supervisory",
    examples: ["Pipeline leak", "Significant structural damage", "CP system failure"]
  },
  moderate: {
    description: "Minor release risk, production impact, significant repair needed",
    response_time: "planned_weeks",
    decision_mode: "advisory",
    examples: ["Coating failure with corrosion", "Secondary member damage", "Anode depletion"]
  },
  minor: {
    description: "No safety impact, minor repair, no production impact",
    response_time: "next_scheduled",
    decision_mode: "assist",
    examples: ["Light marine growth", "Minor coating damage", "Cosmetic impact"]
  }
};

// ============================================================
// CORE ASSESSMENT LOGIC
// ============================================================

function checkEvidence(input) {
  var provided = [];
  var missing_critical = [];
  var missing_high = [];
  var missing_moderate = [];

  for (var i = 0; i < REQUIRED_EVIDENCE.length; i++) {
    var field = REQUIRED_EVIDENCE[i];
    if (input[field.field] !== undefined && input[field.field] !== null && input[field.field] !== "") {
      provided.push(field.field);
    } else {
      if (field.importance === "critical") missing_critical.push(field);
      else if (field.importance === "high") missing_high.push(field);
      else missing_moderate.push(field);
    }
  }

  var evidenceScore = provided.length / REQUIRED_EVIDENCE.length;
  var holdDecision = missing_critical.length > 0;

  var confidenceCeiling = 0.95;
  if (missing_critical.length > 0) confidenceCeiling = 0.40;
  else if (missing_high.length > 2) confidenceCeiling = 0.60;
  else if (missing_high.length > 0) confidenceCeiling = 0.75;

  return {
    evidence_score: Math.round(evidenceScore * 100) / 100,
    confidence_ceiling: confidenceCeiling,
    hold_decision: holdDecision,
    provided: provided,
    missing_critical: missing_critical,
    missing_high: missing_high,
    missing_moderate: missing_moderate,
    total_required: REQUIRED_EVIDENCE.length,
    total_provided: provided.length
  };
}

function assessSubsea(input) {
  var assessment = {
    engine: ENGINE_ID,
    version: ENGINE_VERSION,
    assessment_type: "subsea_integrity",
    assessed_at: new Date().toISOString()
  };

  // Step 1: Evidence check
  var evidence = checkEvidence(input);
  assessment.evidence = evidence;

  if (evidence.hold_decision) {
    assessment.status = "HOLD";
    assessment.hold_reason = "Missing critical evidence: " + evidence.missing_critical.map(function(f) { return f.field; }).join(", ");
    assessment.action = "Provide missing critical data before assessment can proceed.";
    return assessment;
  }

  // Step 2: Zone severity
  var zone = input.zone || "submerged";
  var zoneSeverity = 1.0;
  var ZONE_MULTIPLIERS = {
    atmospheric: 1.0, splash: 2.5, tidal: 1.8,
    submerged: 1.0, mudline: 1.5, buried: 1.2, internal: 1.5
  };
  zoneSeverity = ZONE_MULTIPLIERS[zone] || 1.0;

  var age = input.age_years || 0;
  if (age > 25) zoneSeverity = zoneSeverity * 1.3;
  else if (age > 15) zoneSeverity = zoneSeverity * 1.1;

  assessment.zone_assessment = {
    zone: zone,
    base_multiplier: ZONE_MULTIPLIERS[zone] || 1.0,
    adjusted_multiplier: Math.round(zoneSeverity * 100) / 100,
    age_years: age
  };

  // Step 3: Protection state
  var coatingCondition = input.coating_condition || "unknown";
  var cpStatus = input.cp_status || "unknown";
  var protectionState = "unknown";

  if (coatingCondition === "intact" && cpStatus === "effective") protectionState = "fully_protected";
  else if (coatingCondition === "failed" && cpStatus === "ineffective") protectionState = "unprotected";
  else if (coatingCondition === "failed" || coatingCondition === "severe_degradation") protectionState = "compromised";
  else if (cpStatus === "ineffective") protectionState = "partially_protected";
  else protectionState = "degraded";

  assessment.protection_state = {
    coating: coatingCondition,
    cp: cpStatus,
    combined: protectionState,
    note: protectionState === "unprotected" ? "CRITICAL: No protective barriers remain. Maximum corrosion rate." :
          protectionState === "compromised" ? "Protection significantly degraded. Accelerated corrosion likely." :
          protectionState === "fully_protected" ? "Both barriers functional. Corrosion rate minimized." :
          "Protection state requires verification."
  };

  // Step 4: Internal conditions (if flow asset)
  if (input.internal_fluid) {
    var internalDef = INTERNAL_CONDITIONS[input.internal_fluid];
    if (internalDef) {
      assessment.internal_assessment = {
        fluid: input.internal_fluid,
        corrosion_risk: internalDef.corrosion_risk,
        active_mechanisms: internalDef.mechanisms,
        severity_factor: internalDef.severity_factor,
        internal_external_interaction: "Internal conditions affect wall thickness which changes external stress state. External conditions change external corrosion which compounds with internal wall loss. One wall, two attack surfaces."
      };
    }
  }

  // Step 5: Marine growth impact
  var marineGrowth = input.marine_growth_level || "none";
  var growthConfidenceImpact = 1.0;
  var GROWTH_CONFIDENCE = { none: 1.0, light: 0.95, moderate: 0.75, heavy: 0.45, extreme: 0.20 };
  growthConfidenceImpact = GROWTH_CONFIDENCE[marineGrowth] || 1.0;

  assessment.marine_growth =
