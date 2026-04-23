// @ts-nocheck
/**
 * DEPLOY289 - stability-engine.ts
 * netlify/functions/stability-engine.ts
 *
 * STABILITY + BALLAST ENGINE
 *
 * Buoyancy, metacentric height, ballast state, free surface effect,
 * flooding progression, safe-to-sail decisions.
 *
 * POST /api/stability-engine
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var ENGINE_ID = "stability-engine";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY289";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

var STABILITY_CRITERIA = {
  imo_intact: { name: "IMO Intact Stability (IS Code)", gm_min_m: 0.15, gz_30_min_m: 0.20, area_0_30_min_mrad: 0.055, area_0_40_min_mrad: 0.09, applies_to: ["all_vessels"] },
  imo_damage: { name: "IMO Damage Stability (SOLAS Ch II-1)", gm_min_m: 0.05, heel_max_deg: 15, range_positive_gz_min_deg: 15, applies_to: ["cargo_transport", "offshore_support"] },
  modu_intact: { name: "MODU Code Intact Stability", gm_min_m: 0.30, area_ratio_min: 1.3, applies_to: ["drilling", "offshore_production"] },
  modu_damage: { name: "MODU Code Damage Stability", gm_min_m: 0.05, heel_max_deg: 17, applies_to: ["drilling", "offshore_production"] }
};

var LOADING_CONDITIONS = {
  full_load: { name: "Full Load Departure", severity_factor: 1.0, note: "Maximum displacement. Check GM at departure." },
  ballast: { name: "Ballast Condition", severity_factor: 0.8, note: "Light ship + ballast. Higher GM but potential slamming." },
  partial_load: { name: "Partial Load", severity_factor: 1.2, note: "Partial filling creates free surface effect." },
  transit: { name: "Transit Condition", severity_factor: 0.9, note: "Consumables depleting. GM changes over voyage." },
  operating: { name: "Operating / On Station", severity_factor: 1.1, note: "Operational loads may shift. Monitor GM." },
  survival: { name: "Survival / Storm", severity_factor: 1.5, note: "Maximum environmental loading." },
  damaged: { name: "Damaged Condition", severity_factor: 2.5, note: "EMERGENCY: Apply damage stability criteria." }
};

var FREE_SURFACE_RULES = {
  mitigation: ["Press up or empty slack tanks", "Avoid partial filling during heavy weather", "Sequence ballast operations to minimize simultaneous slack tanks"]
};

var FLOODING_SCENARIOS = {
  minor_breach: { name: "Minor Hull Breach", time_to_critical: "hours_to_days", stability_impact: "gradual_degradation", response: ["Activate bilge pumps", "Identify and patch breach", "Monitor stability"] },
  moderate_breach: { name: "Moderate Hull Breach", time_to_critical: "minutes_to_hours", stability_impact: "significant_degradation", response: ["Emergency bilge pumping", "Damage control parties", "Consider counter-flooding", "Prepare abandonment if required"] },
  major_breach: { name: "Major Hull Breach / Grounding", time_to_critical: "minutes", stability_impact: "rapid_loss", response: ["EMERGENCY damage control", "Counter-flood opposite side if heel developing", "Prepare evacuation", "Broadcast distress"] }
};

function evaluateStability(input) {
  var gm = input.gm_m || null;
  var vesselCategory = input.vessel_category || "cargo_transport";
  var loadingCondition = input.loading_condition || "full_load";
  var slackTanks = input.slack_tanks || 0;
  var fseCorrection = input.fse_correction_m || 0;
  var heel = input.heel_deg || 0;
  var damage = input.damage_condition || false;

  var loadDef = LOADING_CONDITIONS[loadingCondition] || LOADING_CONDITIONS.full_load;
  var criteria = damage ? (vesselCategory === "drilling" || vesselCategory === "offshore_production" ? STABILITY_CRITERIA.modu_damage : STABILITY_CRITERIA.imo_damage) : (vesselCategory === "drilling" || vesselCategory === "offshore_production" ? STABILITY_CRITERIA.modu_intact : STABILITY_CRITERIA.imo_intact);

  var result = { loading_condition: loadingCondition, loading_name: loadDef.name, criteria_applied: criteria.name, damage_condition: damage };

  if (gm !== null) {
    var effectiveGM = gm - fseCorrection;
    var gmStatus = "adequate";
    if (effectiveGM < criteria.gm_min_m) gmStatus = "below_minimum";
    else if (effectiveGM < criteria.gm_min_m * 1.5) gmStatus = "marginal";
    else if (effectiveGM > criteria.gm_min_m * 5) gmStatus = "high_gm_risk_of_snap_roll";
    result.gm = { measured_m: gm, fse_correction_m: fseCorrection, effective_gm_m: Math.round(effectiveGM * 1000) / 1000, minimum_required_m: criteria.gm_min_m, status: gmStatus, margin: Math.round((effectiveGM - criteria.gm_min_m) * 1000) / 1000 };
  }

  if (slackTanks > 0) {
    result.free_surface = { slack_tanks: slackTanks, fse_correction_applied: fseCorrection, warning: slackTanks > 3 ? "CRITICAL: Multiple slack tanks. FSE may significantly reduce effective GM." : "Monitor FSE. Minimize slack tanks.", mitigation: FREE_SURFACE_RULES.mitigation };
  }

  if (heel > 0) {
    var heelStatus = "acceptable";
    if (damage && heel > 15) heelStatus = "exceeds_damage_limit";
    else if (heel > 10) heelStatus = "significant_list";
    else if (heel > 5) heelStatus = "notable_list";
    else if (heel > 2) heelStatus = "minor_list";
    result.heel = { current_deg: heel, status: heelStatus, action: heelStatus === "exceeds_damage_limit" ? "EMERGENCY: Heel exceeds damage limit. Counter-flood or evacuate." : (heelStatus === "significant_list" ? "Investigate cause immediately. Counter-ballast if safe." : "Monitor") };
  }

  var stabilityStatus = "safe";
  if (result.gm && result.gm.status === "below_minimum") stabilityStatus = "unsafe";
  else if (result.heel && result.heel.status === "exceeds_damage_limit") stabilityStatus = "critical";
  else if (result.gm && result.gm.status === "marginal") stabilityStatus = "restricted";
  else if (result.gm && result.gm.status === "high_gm_risk_of_snap_roll") stabilityStatus = "caution";

  result.overall_status = stabilityStatus;
  result.operational_decision = stabilityStatus === "unsafe" ? "STOP OPERATIONS. Do not sail. Address stability immediately." : stabilityStatus === "critical" ? "EMERGENCY. Prepare evacuation." : stabilityStatus === "restricted" ? "Restricted operations only. No heavy lifts." : stabilityStatus === "caution" ? "High GM may cause snap roll in beam seas." : "Safe to operate within loading manual limits.";
  result.klein_bottle_note = "Stability is not separate from structure. A corroded bulkhead is simultaneously a structural weakness AND a flooding boundary.";

  return result;
}

function simulateFlooding(input) {
  var breachSize = input.breach_size || "minor_breach";
  var depth_below_waterline_m = input.depth_below_waterline_m || 2;
  var vesselDisplacement = input.displacement_tonnes || 10000;

  var scenario = FLOODING_SCENARIOS[breachSize] || FLOODING_SCENARIOS.minor_breach;
  var breachAreaMap = { minor_breach: 0.05, moderate_breach: 0.5, major_breach: 5.0 };
  var breachArea = breachAreaMap[breachSize] || 0.05;
  var flowRate = 0.6 * breachArea * Math.sqrt(2 * 9.81 * depth_below_waterline_m);
  var flowRateTonnesPerMin = flowRate * 1.025 * 60;

  return {
    breach_scenario: breachSize,
    scenario_name: scenario.name,
    depth_below_waterline_m: depth_below_waterline_m,
    estimated_breach_area_m2: breachArea,
    flow_rate_m3_s: Math.round(flowRate * 100) / 100,
    flow_rate_tonnes_min: Math.round(flowRateTonnesPerMin * 10) / 10,
    time_to_critical: scenario.time_to_critical,
    stability_impact: scenario.stability_impact,
    response_actions: scenario.response,
    flooding_percent_displacement_per_hour: Math.round((flowRateTonnesPerMin * 60 / vesselDisplacement) * 100 * 10) / 10
  };
}

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body ||
