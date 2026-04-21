// @ts-nocheck
/**
 * DEPLOY268 - fatigue-vibration-proof.ts
 * netlify/functions/fatigue-vibration-proof.ts
 *
 * FATIGUE & VIBRATION PROOF ENGINE v1.0.0
 * Dedicated engine for cyclic loading assessment.
 *
 * S-N curve fatigue life estimation per BS 7608 / DNV-RP-C203.
 * VIV assessment per DNV-RP-F105.
 * Vibration screening per API 618 / ASME OM.
 * Fatigue damage accumulation per Miner's rule.
 *
 * Every fatigue life must trace to an S-N curve.
 * Every VIV assessment must trace to reduced velocity.
 * If inputs are insufficient, engine refuses to calculate.
 *
 * 10 actions:
 *   get_registry           — engine overview
 *   assess_fatigue         — S-N curve fatigue life for a component
 *   assess_viv             — vortex-induced vibration screening
 *   assess_vibration       — general vibration screening
 *   calculate_miner_sum    — cumulative fatigue damage
 *   get_sn_curves          — list available S-N curves
 *   get_joint_classes      — weld joint classification guide
 *   record_assessment      — store a fatigue assessment
 *   get_assessment_history — retrieve assessments for a case
 *   validate_assessment    — check proof status
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var ENGINE_VERSION = "fatigue-vibration-proof/1.0.0";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

function ok(body) { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(body) }; }
function errResp(code, msg) { return { statusCode: code, headers: corsHeaders, body: JSON.stringify({ error: msg }) }; }

// ============================================================
// S-N CURVE LIBRARY
// Based on DNV-RP-C203 / BS 7608
// Log N = log a - m * log S
// where N = cycles to failure, S = stress range (MPa), a and m are curve constants
// ============================================================
var SN_CURVES = [
  { id: "B1", standard: "DNV-RP-C203", environment: "in_air", log_a: 15.117, m: 4.0, description: "Base metal, ground flush", fatigue_limit_mpa: 106.97, thickness_ref_mm: 25 },
  { id: "B2", standard: "DNV-RP-C203", environment: "in_air", log_a: 14.885, m: 4.0, description: "Base metal, as-rolled", fatigue_limit_mpa: 93.59, thickness_ref_mm: 25 },
  { id: "C", standard: "DNV-RP-C203", environment: "in_air", log_a: 13.640, m: 3.5, description: "Butt welds, ground flush", fatigue_limit_mpa: 73.10, thickness_ref_mm: 25 },
  { id: "C1", standard: "DNV-RP-C203", environment: "in_air", log_a: 13.362, m: 3.5, description: "Butt welds, toe ground", fatigue_limit_mpa: 65.50, thickness_ref_mm: 25 },
  { id: "C2", standard: "DNV-RP-C203", environment: "in_air", log_a: 13.104, m: 3.5, description: "Butt welds, as-welded", fatigue_limit_mpa: 58.48, thickness_ref_mm: 25 },
  { id: "D", standard: "DNV-RP-C203", environment: "in_air", log_a: 12.164, m: 3.0, description: "Cruciform joints, T-joints, plates", fatigue_limit_mpa: 52.63, thickness_ref_mm: 25 },
  { id: "E", standard: "DNV-RP-C203", environment: "in_air", log_a: 12.010, m: 3.0, description: "Welded attachments, longitudinal", fatigue_limit_mpa: 46.78, thickness_ref_mm: 25 },
  { id: "F", standard: "DNV-RP-C203", environment: "in_air", log_a: 11.855, m: 3.0, description: "Welded attachments, transverse", fatigue_limit_mpa: 41.52, thickness_ref_mm: 25 },
  { id: "F1", standard: "DNV-RP-C203", environment: "in_air", log_a: 11.699, m: 3.0, description: "Fillet welds, load-carrying", fatigue_limit_mpa: 36.84, thickness_ref_mm: 25 },
  { id: "F3", standard: "DNV-RP-C203", environment: "in_air", log_a: 11.546, m: 3.0, description: "Fillet welds, non-load-carrying", fatigue_limit_mpa: 32.75, thickness_ref_mm: 25 },
  { id: "G", standard: "DNV-RP-C203", environment: "in_air", log_a: 11.398, m: 3.0, description: "Poor details, cope holes", fatigue_limit_mpa: 29.24, thickness_ref_mm: 25 },
  { id: "W1", standard: "DNV-RP-C203", environment: "in_air", log_a: 11.261, m: 3.0, description: "Worst weld details", fatigue_limit_mpa: 25.42, thickness_ref_mm: 25 },
  { id: "T", standard: "DNV-RP-C203", environment: "in_air", log_a: 12.164, m: 3.0, description: "Tubular joints", fatigue_limit_mpa: 52.63, thickness_ref_mm: 32 },
  // Seawater with CP
  { id: "D_seawater_CP", standard: "DNV-RP-C203", environment: "seawater_with_CP", log_a: 11.764, m: 3.0, description: "D-curve, seawater with cathodic protection", fatigue_limit_mpa: 0, thickness_ref_mm: 25 },
  { id: "E_seawater_CP", standard: "DNV-RP-C203", environment: "seawater_with_CP", log_a: 11.610, m: 3.0, description: "E-curve, seawater with cathodic protection", fatigue_limit_mpa: 0, thickness_ref_mm: 25 },
  { id: "F_seawater_CP", standard: "DNV-RP-C203", environment: "seawater_with_CP", log_a: 11.455, m: 3.0, description: "F-curve, seawater with cathodic protection", fatigue_limit_mpa: 0, thickness_ref_mm: 25 },
  // Seawater free corrosion (no CP)
  { id: "D_seawater_free", standard: "DNV-RP-C203", environment: "seawater_free_corrosion", log_a: 11.764, m: 3.0, description: "D-curve, seawater free corrosion (no CP) — factor 3 on life", fatigue_limit_mpa: 0, thickness_ref_mm: 25 },
];

// ============================================================
// WELD JOINT CLASSIFICATION GUIDE
// ============================================================
var JOINT_CLASSES = [
  { classification: "B1", description: "Base metal, automatic or manual butt weld, ground flush, NDE verified", typical_components: ["pressure vessels", "pipelines", "critical structures"] },
  { classification: "C", description: "Butt welds, full penetration, ground flush", typical_components: ["girth welds", "seam welds"] },
  { classification: "C1", description: "Butt welds, full penetration, weld toe ground", typical_components: ["girth welds with toe grinding"] },
  { classification: "C2", description: "Butt welds, full penetration, as-welded", typical_components: ["standard girth welds", "standard seam welds"] },
  { classification: "D", description: "Cruciform joints, T-joints, plates with transverse butt welds", typical_components: ["stiffener connections", "bracket toes", "tubular joints"] },
  { classification: "E", description: "Welded attachments on stressed members, longitudinal", typical_components: ["longitudinal stiffeners", "gusset plates"] },
  { classification: "F", description: "Welded attachments on stressed members, transverse", typical_components: ["transverse stiffeners", "pad plates"] },
  { classification: "F1", description: "Load-carrying fillet welds", typical_components: ["bracket connections", "trunnions"] },
  { classification: "F3", description: "Non-load-carrying fillet welds", typical_components: ["minor attachments"] },
  { classification: "G", description: "Poor weld details, cope holes, weld access holes", typical_components: ["cope holes in beams", "poorly detailed connections"] },
  { classification: "W1", description: "Worst case weld details, partial penetration under bending", typical_components: ["partial penetration welds in fatigue-critical joints"] },
  { classification: "T", description: "Tubular joints (hot spot stress method)", typical_components: ["jacket braces", "riser clamps", "caisson connections"] }
];

// ============================================================
// FATIGUE LIFE CALCULATION
// ============================================================
function assessFatigue(input) {
  var result = {
    component: input.component || "unknown",
    joint_classification: input.joint_classification || null,
    sn_curve_used: null,
    stress_range_mpa: input.stress_range_mpa || null,
    cycle_count: input.cycle_count || null,
    cycles_to_failure: null,
    fatigue_life_years: null,
    consumed_life_fraction: null,
    remaining_life_years: null,
    miner_sum: null,
    fatigue_status: "UNASSESSED",
    proof_status: "UNPROVEN",
    calculation_method: "NONE",
    code_reference: "N/A",
    input_quality: {},
    assumptions: [],
    scf_applied: input.scf || 1.0,
    thickness_correction: 1.0,
    environment_factor: 1.0
  };

  // Input quality tracking
  var iq = {};
  var fields = ["stress_range_mpa", "cycle_count", "joint_classification", "thickness_mm", "scf", "design_life_years", "cycles_per_year"];
  for (var f = 0; f < fields.length; f++) {
    if (input[fields[f]] !== undefined && input[fields[f]] !== null) {
      iq[fields[f]] = input[fields[f] + "_quality"] || "ASSUMED";
    } else {
      iq[fields[f]] = "NOT_PROVIDED";
    }
  }
  result.input_quality = iq;

  // Must have stress range
  if (!input.stress_range_mpa) {
    result.proof_status = "NO_PROOF";
    result.fatigue_status = "CALCULATION_NOT_DEFENSIBLE";
    result.assumptions.push("No stress range provided — fatigue life cannot be calculated");
    return result;
  }

  // Must have joint classification
  if (!input.joint_classification) {
    result.proof_status = "NO_PROOF";
    result.fatigue_status = "CALCULATION_NOT_DEFENSIBLE";
    result.assumptions.push("No joint classification provided — S-N curve cannot be selected");
    return result;
  }

  // Find S-N curve
  var env = (input.environment || "in_air").toLowerCase();
  var curveId = input.joint_classification;
  if (env.indexOf("seawater") >= 0 && env.indexOf("cp") >= 0) curveId = curveId + "_seawater_CP";
  else if (env.indexOf("seawater") >= 0) curveId = curveId + "_seawater_free";

  var curve = null;
  for (var i = 0; i < SN_CURVES.length; i++) {
    if (SN_CURVES[i].id === curveId) { curve = SN_CURVES[i]; break; }
  }
  if (!curve) {
    // Fallback to base curve
    for (var j = 0; j < SN_CURVES.length; j++) {
      if (SN_CURVES[j].id === input.joint_classification) { curve = SN_CURVES[j]; break; }
    }
  }
  if (!curve) {
    result.proof_status = "NO_PROOF";
    result.fatigue_status = "CALCULATION_NOT_DEFENSIBLE";
    result.assumptions.push("Joint classification '" + input.joint_classification + "' not found in S-N curve library");
    return result;
  }

  result.sn_curve_used = curve.id;
  result.code_reference = curve.standard;

  // Apply SCF
  var effectiveStress = input.stress_range_mpa * (input.scf || 1.0);

  // Thickness correction (DNV-RP-C203 Section 2.4)
  var t = input.thickness_mm || 25;
  var tRef = curve.thickness_ref_mm;
  if (t > tRef) {
    var k = 0.25; // default exponent
    result.thickness_correction = Math.pow(t / tRef, k);
    effectiveStress = effectiveStress * result.thickness_correction;
    result.assumptions.push("Thickness correction applied: t=" + t + "mm, tref=" + tRef + "mm, factor=" + Math.round(result.thickness_correction * 1000) / 1000);
  }

  // Environment factor
  if (env.indexOf("seawater") >= 0 && env.indexOf("free") >= 0 && curveId.indexOf("seawater_free") < 0) {
    result.environment_factor = 3.0;
    result.assumptions.push("Seawater free corrosion: life reduced by factor 3");
  }

  // Calculate cycles to failure: log N = log a - m * log S
  var logS = Math.log10(effectiveStress);
  var logN = curve.log_a - curve.m * logS;
  var N = Math.pow(10, logN);

  // Apply environment factor
  N = N / result.environment_factor;

  result.cycles_to_failure = Math.round(N);
  result.calculation_method = "SN_CURVE_" + curve.standard.replace(/-/g, "_");

  // Calculate fatigue life in years if cycles_per_year provided
  if (input.cycles_per_year && input.cycles_per_year > 0) {
    result.fatigue_life_years = Math.round((N / input.cycles_per_year) * 10) / 10;
  }

  // Calculate consumed life if current cycle count known
  if (input.cycle_count && input.cycle_count > 0) {
    result.consumed_life_fraction = Math.round((input.cycle_count / N) * 10000) / 10000;
    result.miner_sum = result.consumed_life_fraction;
  }

  // Calculate remaining life
  if (result.fatigue_life_years !== null && input.years_in_service) {
    result.remaining_life_years = Math.round((result.fatigue_life_years - input.years_in_service) * 10) / 10;
  } else if (result.consumed_life_fraction !== null && input.cycles_per_year) {
    var remainingCycles = N - (input.cycle_count || 0);
    result.remaining_life_years = Math.round((remainingCycles / input.cycles_per_year) * 10) / 10;
  }

  // Determine status
  if (result.consumed_life_fraction !== null) {
    if (result.consumed_life_fraction >= 1.0) result.fatigue_status = "EXHAUSTED";
    else if (result.consumed_life_fraction >= 0.8) result.fatigue_status = "CRITICAL";
    else if (result.consumed_life_fraction >= 0.5) result.fatigue_status = "MONITOR";
    else result.fatigue_status = "ACCEPTABLE";
  } else if (result.remaining_life_years !== null) {
    if (result.remaining_life_years <= 0) result.fatigue_status = "EXHAUSTED";
    else if (result.remaining_life_years <= 2) result.fatigue_status = "CRITICAL";
    else if (result.remaining_life_years <= 5) result.fatigue_status = "MONITOR";
    else result.fatigue_status = "ACCEPTABLE";
  }

  // Proof status
  if (iq.stress_range_mpa === "MEASURED" && iq.joint_classification !== "NOT_PROVIDED") {
    result.proof_status = "PROVEN";
  } else if (iq.stress_range_mpa === "ASSUMED") {
    result.proof_status = "PROVISIONAL";
    result.assumptions.push("Stress range is assumed — FEA or measurement required for defensible result");
  } else {
    result.proof_status = "PROVISIONAL";
  }

  return result;
}

// ============================================================
// VIV SCREENING (DNV-RP-F105)
// ============================================================
function assessVIV(input) {
  var result = {
    component: input.component || "unknown",
    span_length_m: input.span_length_m || null,
    outer_diameter_m: input.outer_diameter_m || null,
    current_velocity_ms: input.current_velocity_ms || null,
    natural_frequency_hz: null,
    reduced_velocity: null,
    viv_susceptible: false,
    screening_result: "UNASSESSED",
    allowable_span_m: null,
    fatigue_from_viv: null,
    proof_status: "UNPROVEN",
    code_reference: "DNV-RP-F105",
    input_quality: {},
    assumptions: []
  };

  if (!input.span_length_m || !input.outer_diameter_m) {
    result.proof_status = "NO_PROOF";
    result.screening_result = "CALCULATION_NOT_DEFENSIBLE";
    result.assumptions.push("Span length and outer diameter required for VIV screening");
    return result;
  }

  if (!input.current_velocity_ms) {
    result.proof_status = "NO_PROOF";
    result.screening_result = "CALCULATION_NOT_DEFENSIBLE";
    result.assumptions.push("Current velocity required for VIV screening");
    return result;
  }

  var D = input.outer_diameter_m;
  var L = input.span_length_m;
  var V = input.current_velocity_ms;

  // Simplified natural frequency (pinned-pinned beam)
  // fn = (pi/2) * sqrt(EI / mL^4)
  // Simplified: fn ~ C * D / L^2 where C depends on end conditions
  var wallThickness = input.wall_thickness_m || D * 0.04; // approximate
  var I = (Math.PI / 64) * (Math.pow(D, 4) - Math.pow(D - 2 * wallThickness, 4));
  var E = input.youngs_modulus || 207e9; // steel default Pa
  var m = input.mass_per_length || 200; // kg/m approximate with added mass
  var fn = (Math.PI / (2 * L * L)) * Math.sqrt(E * I / m);

  result.natural_frequency_hz = Math.round(fn * 1000) / 1000;

  // Reduced velocity
  var Vr = V / (fn * D);
  result.reduced_velocity = Math.round(Vr * 100) / 100;

  // VIV onset screening (DNV-RP-F105: onset at Vr ~ 3-5 for in-line, 4-8 for cross-flow)
  if (Vr >= 3.0) {
    result.viv_susceptible = true;
    if (Vr >= 5.0) {
      result.screening_result = "VIV_LIKELY_CROSSFLOW";
      result.assumptions.push("Reduced velocity " + result.reduced_velocity + " indicates likely cross-flow VIV");
    } else {
      result.screening_result = "VIV_POSSIBLE_INLINE";
      result.assumptions.push("Reduced velocity " + result.reduced_velocity + " indicates possible in-line VIV");
    }
  } else {
    result.viv_susceptible = false;
    result.screening_result = "VIV_UNLIKELY";
  }

  // Simplified allowable free span (L_allow where Vr = 3.0)
  // Vr = V/(fn*D) = 3 -> fn = V/(3*D)
  // fn = (pi/(2*L^2)) * sqrt(EI/m)
  // L^2 = (pi * sqrt(EI/m)) / (2 * V/(3*D))
  var fnTarget = V / (3.0 * D);
  if (fnTarget > 0) {
    var LallowSq = (Math.PI * Math.sqrt(E * I / m)) / (2 * fnTarget);
    result.allowable_span_m = Math.round(Math.sqrt(LallowSq) * 100) / 100;
  }

  // Proof status
  var allMeasured = true;
  var fields2 = ["span_length_m", "outer_diameter_m", "current_velocity_ms"];
  for (var f2 = 0; f2 < fields2.length; f2++) {
    var q = input[fields2[f2] + "_quality"] || "ASSUMED";
    result.input_quality[fields2[f2]] = q;
    if (q !== "MEASURED") allMeasured = false;
  }

  if (allMeasured) result.proof_status = "PROVEN";
  else result.proof_status = "PROVISIONAL";

  if (!input.wall_thickness_m) result.assumptions.push("Wall thickness estimated as 4% of OD — measurement needed");
  if (!input.mass_per_length) result.assumptions.push("Mass per unit length estimated — should be calculated from actual properties");

  return result;
}

// ============================================================
// GENERAL VIBRATION SCREENING
// ============================================================
function assessVibration(input) {
  var result = {
    component: input.component || "unknown",
    vibration_type: input.vibration_type || "unknown",
    frequency_hz: input.frequency_hz || null,
    velocity_mms: input.velocity_mms || null,
    amplitude_mm: input.amplitude_mm || null,
    screening_result: "UNASSESSED",
    severity: "UNKNOWN",
    baseline_comparison: null,
    recommended_action: null,
    proof_status: "UNPROVEN",
    code_reference: "N/A",
    assumptions: []
  };

  // ISO 10816 / API 618 vibration severity zones
  if (input.velocity_mms !== null && input.velocity_mms !== undefined) {
    var v = input.velocity_mms;
    if (v <= 2.8) { result.severity = "GOOD"; result.screening_result = "ACCEPTABLE"; }
    else if (v <= 7.1) { result.severity = "SATISFACTORY"; result.screening_result = "ACCEPTABLE"; }
    else if (v <= 18.0) { result.severity = "UNSATISFACTORY"; result.screening_result = "MONITOR_CLOSELY"; }
    else { result.severity = "UNACCEPTABLE"; result.screening_result = "IMMEDIATE_ACTION"; }
    result.code_reference = "ISO 10816-1";
    result.proof_status = (input.velocity_mms_quality === "MEASURED") ? "PROVEN" : "PROVISIONAL";
  } else if (input.amplitude_mm !== null && input.frequency_hz !== null) {
    // Convert to velocity: v = 2*pi*f*A (mm/s, mm peak, Hz)
    var calcV = 2 * Math.PI * input.frequency_hz * input.amplitude_mm;
    result.velocity_mms = Math.round(calcV * 100) / 100;
    result.assumptions.push("Velocity calculated from amplitude and frequency");
    if (calcV <= 2.8) { result.severity = "GOOD"; result.screening_result = "ACCEPTABLE"; }
    else if (calcV <= 7.1) { result.severity = "SATISFACTORY"; result.screening_result = "ACCEPTABLE"; }
    else if (calcV <= 18.0) { result.severity = "UNSATISFACTORY"; result.screening_result = "MONITOR_CLOSELY"; }
    else { result.severity = "UNACCEPTABLE"; result.screening_result = "IMMEDIATE_ACTION"; }
    result.code_reference = "ISO 10816-1";
    result.proof_status = "PROVISIONAL";
  } else {
    result.proof_status = "NO_PROOF";
    result.screening_result = "CALCULATION_NOT_DEFENSIBLE";
    result.assumptions.push("Velocity or amplitude+frequency required for vibration screening");
  }

  // Baseline comparison
  if (input.baseline_velocity_mms && result.velocity_mms) {
    var change = ((result.velocity_mms - input.baseline_velocity_mms) / input.baseline_velocity_mms) * 100;
    result.baseline_comparison = {
      baseline: input.baseline_velocity_mms,
      current: result.velocity_mms,
      change_percent: Math.round(change * 10) / 10,
      trending: change > 25 ? "INCREASING_SIGNIFICANTLY" : change > 10 ? "INCREASING" : change < -10 ? "DECREASING" : "STABLE"
    };
  }

  // Recommended action
  if (result.screening_result === "IMMEDIATE_ACTION") {
    result.recommended_action = "STOP operation. Investigate root cause. Engineering assessment required before restart.";
  } else if (result.screening_result === "MONITOR_CLOSELY") {
    result.recommended_action = "Increase monitoring frequency. Plan engineering assessment. Evaluate fatigue implications.";
  } else if (result.screening_result === "ACCEPTABLE") {
    result.recommended_action = "Continue normal monitoring.";
  }

  return result;
}

// ============================================================
// MINER'S SUM CALCULATION
// ============================================================
function calculateMinerSum(blocks) {
  var totalDamage = 0;
  var details = [];

  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    if (!block.stress_range_mpa || !block.cycles || !block.joint_classification) {
      details.push({ block: i + 1, error: "Missing stress_range_mpa, cycles, or joint_classification" });
      continue;
    }

    var fatigueResult = assessFatigue({
      stress_range_mpa: block.stress_range_mpa,
      joint_classification: block.joint_classification,
      scf: block.scf || 1.0,
      thickness_mm: block.thickness_mm,
      environment: block.environment
    });

    if (fatigueResult.cycles_to_failure && fatigueResult.cycles_to_failure > 0) {
      var damage = block.cycles / fatigueResult.cycles_to_failure;
      totalDamage = totalDamage + damage;
      details.push({
        block: i + 1,
        stress_range: block.stress_range_mpa,
        applied_cycles: block.cycles,
        allowable_cycles: fatigueResult.cycles_to_failure,
        damage_fraction: Math.round(damage * 10000) / 10000,
        sn_curve: fatigueResult.sn_curve_used
      });
    }
  }

  var status = "ACCEPTABLE";
  if (totalDamage >= 1.0) status = "EXHAUSTED";
  else if (totalDamage >= 0.8) status = "CRITICAL";
  else if (totalDamage >= 0.5) status = "MONITOR";

  return {
    miner_sum: Math.round(totalDamage * 10000) / 10000,
    status: status,
    block_count: blocks.length,
    details: details,
    proof_status: totalDamage > 0 ? "PROVISIONAL" : "NO_PROOF",
    code_reference: "DNV-RP-C203 Section 2.2 / BS 7608"
  };
}

// ============================================================
// HANDLER
// ============================================================
export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return errResp(405, "POST only");

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "";

    if (action === "get_registry") {
      return ok({
        engine: "fatigue-vibration-proof",
        version: ENGINE_VERSION,
        description: "Dedicated cyclic loading assessment engine. S-N curve fatigue life, VIV screening, vibration severity, Miner's rule damage accumulation. Every result traces to a curve, a standard, and input quality.",
        actions: ["get_registry", "assess_fatigue", "assess_viv", "assess_vibration", "calculate_miner_sum", "get_sn_curves", "get_joint_classes", "record_assessment", "get_assessment_history", "validate_assessment"],
        sn_curves: SN_CURVES.length,
        joint_classes: JOINT_CLASSES.length,
        standards: ["DNV-RP-C203", "DNV-RP-F105", "BS 7608", "ISO 10816-1", "API 618"],
        fatigue_statuses: ["ACCEPTABLE", "MONITOR", "CRITICAL", "EXHAUSTED", "CALCULATION_NOT_DEFENSIBLE"],
        proof_levels: ["PROVEN", "PROVISIONAL", "UNPROVEN", "NO_PROOF"],
        status: "operational"
      });
    }

    if (action === "get_sn_curves") {
      var envFilter = body.environment || null;
      var curves = SN_CURVES;
      if (envFilter) {
        curves = [];
        for (var cf = 0; cf < SN_CURVES.length; cf++) {
          if (SN_CURVES[cf].environment.indexOf(envFilter) >= 0) curves.push(SN_CURVES[cf]);
        }
      }
      return ok({ engine: "fatigue-vibration-proof", curve_count: curves.length, curves: curves });
    }

    if (action === "get_joint_classes") {
      return ok({ engine: "fatigue-vibration-proof", class_count: JOINT_CLASSES.length, classes: JOINT_CLASSES });
    }

    if (action === "assess_fatigue") {
      var fatigueResult = assessFatigue(body.input || body);
      return ok({ engine: "fatigue-vibration-proof", result: fatigueResult });
    }

    if (action === "assess_viv") {
      var vivResult = assessVIV(body.input || body);
      return ok({ engine: "fatigue-vibration-proof", result: vivResult });
    }

    if (action === "assess_vibration") {
      var vibResult = assessVibration(body.input || body);
      return ok({ engine: "fatigue-vibration-proof", result: vibResult });
    }

    if (action === "calculate_miner_sum") {
      var blocks = body.blocks || body.loading_blocks || [];
      if (blocks.length === 0) return errResp(400, "blocks array required with stress_range_mpa, cycles, joint_classification per block");
      var minerResult = calculateMinerSum(blocks);
      return ok({ engine: "fatigue-vibration-proof", result: minerResult });
    }

    if (action === "record_assessment") {
      if (!supabaseUrl || !supabaseKey) return errResp(500, "SUPABASE not configured");
      var sb = createClient(supabaseUrl, supabaseKey);
      var assessType = body.assessment_type || "fatigue";
      if (assessType === "fatigue") {
        var ins = await sb.from("fatigue_assessments").insert({
          case_id: body.case_id || null,
          component: body.component || "unknown",
          material: body.material || null,
          joint_classification: body.joint_classification || null,
          stress_range_mpa: body.stress_range_mpa || null,
          cycle_count: body.cycle_count || null,
          sn_curve_used: body.sn_curve_used || null,
          cumulative_damage: body.miner_sum || null,
          fatigue_status: body.fatigue_status || "UNASSESSED",
          proof_status: body.proof_status || "UNPROVEN",
          code_reference: body.code_reference || null
        }).select("id").single();
        return ok({ engine: "fatigue-vibration-proof", recorded: true, id: ins.data ? ins.data.id : null });
      } else {
        var ins2 = await sb.from("vibration_assessments").insert({
          case_id: body.case_id || null,
          component: body.component || "unknown",
          vibration_type: body.vibration_type || null,
          frequency_hz: body.frequency_hz || null,
          amplitude_mm: body.amplitude_mm || null,
          velocity_mms: body.velocity_mms || null,
          span_length_m: body.span_length_m || null,
          screening_result: body.screening_result || null,
          proof_status: body.proof_status || "UNPROVEN",
          code_reference: body.code_reference || null
        }).select("id").single();
        return ok({ engine: "fatigue-vibration-proof", recorded: true, id: ins2.data ? ins2.data.id : null });
      }
    }

    if (action === "get_assessment_history") {
      if (!body.case_id) return errResp(400, "case_id required");
      if (!supabaseUrl || !supabaseKey) return errResp(500, "SUPABASE not configured");
      var sb2 = createClient(supabaseUrl, supabaseKey);
      var fat = await sb2.from("fatigue_assessments").select("*").eq("case_id", body.case_id).order("created_at", { ascending: false });
      var vib = await sb2.from("vibration_assessments").select("*").eq("case_id", body.case_id).order("created_at", { ascending: false });
      return ok({ engine: "fatigue-vibration-proof", case_id: body.case_id, fatigue_assessments: fat.data || [], vibration_assessments: vib.data || [] });
    }

    if (action === "validate_assessment") {
      return ok({ engine: "fatigue-vibration-proof", note: "Use assess_fatigue or assess_viv with input quality tracking for validation" });
    }

    return errResp(400, "Unknown action: " + action + ". Use get_registry for available actions.");
  } catch (err) {
    return errResp(500, String(err && err.message ? err.message : err));
  }
};
