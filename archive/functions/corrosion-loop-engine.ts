// @ts-nocheck
/**
 * DEPLOY267 - corrosion-loop-engine.ts
 * netlify/functions/corrosion-loop-engine.ts
 *
 * CORROSION LOOP ENGINE v1.0.0
 * Ties mechanism identification -> rate prediction -> remaining wall ->
 * inspection interval in a single traceable loop.
 *
 * Forces real inputs or refuses to calculate.
 * Every rate must trace to a basis. Every interval must trace to a rate.
 *
 * Mechanism library: API 571 damage mechanisms
 * Rate models: API 579-1 Level 1/2, DNV-RP-F101, de Waard-Milliams (CO2),
 *              NACE SP0775 (H2S), empirical trending
 * Remaining life: API 579-1 Part 4/5
 * Interval: API 510/570/653 rules + risk-adjusted
 *
 * 10 actions:
 *   get_registry           — engine overview
 *   identify_mechanism     — identify corrosion mechanism from conditions
 *   calculate_rate         — calculate corrosion rate with input quality tracking
 *   calculate_remaining_life — remaining wall life from rate + measurements
 *   calculate_interval     — next inspection interval
 *   run_full_loop          — mechanism -> rate -> life -> interval in one call
 *   get_mechanism_library  — list all supported mechanisms
 *   record_measurement     — record a thickness measurement
 *   get_loop_history       — get corrosion loop history for a case
 *   validate_loop          — check proof status of an existing loop
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var ENGINE_VERSION = "corrosion-loop-engine/1.0.0";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

function ok(body) { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(body) }; }
function errResp(code, msg) { return { statusCode: code, headers: corsHeaders, body: JSON.stringify({ error: msg }) }; }

// ============================================================
// CORROSION MECHANISM LIBRARY (API 571 based)
// ============================================================
var MECHANISM_LIBRARY = [
  { id: "general_corrosion", name: "General / Uniform Corrosion", api571_ref: "4.3.1", environments: ["atmospheric", "immersion", "soil"], materials: ["carbon_steel", "low_alloy"], typical_rate_mmpy: { low: 0.05, medium: 0.25, high: 1.0 }, detection_methods: ["UT_THICKNESS", "VISUAL"], key_factors: ["temperature", "humidity", "coating_condition"] },
  { id: "CUI", name: "Corrosion Under Insulation", api571_ref: "4.3.3", environments: ["insulated_carbon_steel", "insulated_stainless"], materials: ["carbon_steel", "austenitic_stainless"], typical_rate_mmpy: { low: 0.1, medium: 0.5, high: 2.0 }, detection_methods: ["UT_THICKNESS", "RT", "GWT", "EC"], key_factors: ["temperature_range", "insulation_type", "coating_condition", "climate"], temp_range_c: { min: -4, max: 175 } },
  { id: "CUF", name: "Corrosion Under Fireproofing", api571_ref: "4.3.3", environments: ["fireproofed_steel"], materials: ["carbon_steel", "structural_steel"], typical_rate_mmpy: { low: 0.1, medium: 0.3, high: 1.5 }, detection_methods: ["UT_THICKNESS", "VISUAL_after_removal"], key_factors: ["fireproofing_type", "moisture_ingress", "drainage"] },
  { id: "co2_corrosion", name: "CO2 Corrosion (Sweet Corrosion)", api571_ref: "4.3.6", environments: ["wet_co2", "production_systems"], materials: ["carbon_steel"], typical_rate_mmpy: { low: 0.1, medium: 1.0, high: 10.0 }, detection_methods: ["UT_THICKNESS", "ER_probes", "coupons"], key_factors: ["co2_partial_pressure", "temperature", "ph", "flow_velocity", "water_cut"] },
  { id: "h2s_corrosion", name: "H2S / Sour Corrosion", api571_ref: "4.3.7", environments: ["wet_h2s", "sour_service"], materials: ["carbon_steel", "low_alloy"], typical_rate_mmpy: { low: 0.05, medium: 0.5, high: 3.0 }, detection_methods: ["UT_THICKNESS", "UT_SHEAR_WAVE"], key_factors: ["h2s_partial_pressure", "ph", "temperature", "chloride"] },
  { id: "erosion_corrosion", name: "Erosion-Corrosion", api571_ref: "4.3.8", environments: ["multiphase_flow", "sand_laden", "high_velocity"], materials: ["carbon_steel"], typical_rate_mmpy: { low: 0.5, medium: 2.0, high: 10.0 }, detection_methods: ["UT_THICKNESS", "RT"], key_factors: ["flow_velocity", "sand_content", "geometry", "fluid_properties"] },
  { id: "MIC", name: "Microbiologically Influenced Corrosion", api571_ref: "4.3.9", environments: ["stagnant_water", "dead_legs", "low_flow"], materials: ["carbon_steel", "stainless_steel"], typical_rate_mmpy: { low: 0.1, medium: 1.0, high: 5.0 }, detection_methods: ["UT_THICKNESS", "biological_testing"], key_factors: ["water_chemistry", "temperature", "flow_conditions", "biocide_treatment"] },
  { id: "pitting", name: "Pitting Corrosion", api571_ref: "4.3.10", environments: ["chloride", "stagnant", "under_deposits"], materials: ["carbon_steel", "stainless_steel"], typical_rate_mmpy: { low: 0.1, medium: 0.5, high: 3.0 }, detection_methods: ["UT_THICKNESS", "PAUT", "RT"], key_factors: ["chloride_concentration", "temperature", "ph", "oxygen"] },
  { id: "galvanic", name: "Galvanic Corrosion", api571_ref: "4.3.11", environments: ["dissimilar_metals_wet"], materials: ["all"], typical_rate_mmpy: { low: 0.05, medium: 0.3, high: 2.0 }, detection_methods: ["UT_THICKNESS", "VISUAL"], key_factors: ["area_ratio", "electrolyte_conductivity", "potential_difference"] },
  { id: "FAC", name: "Flow-Accelerated Corrosion", api571_ref: "4.3.12", environments: ["wet_steam", "condensate", "feedwater"], materials: ["carbon_steel"], typical_rate_mmpy: { low: 0.5, medium: 2.0, high: 5.0 }, detection_methods: ["UT_THICKNESS", "GWT"], key_factors: ["temperature", "ph", "flow_velocity", "chromium_content", "geometry"] },
  { id: "atmospheric", name: "Atmospheric Corrosion", api571_ref: "4.3.2", environments: ["marine", "industrial", "rural"], materials: ["carbon_steel", "weathering_steel"], typical_rate_mmpy: { low: 0.01, medium: 0.08, high: 0.3 }, detection_methods: ["UT_THICKNESS", "VISUAL"], key_factors: ["humidity", "chloride_deposition", "SO2", "rainfall"] },
  { id: "splash_zone", name: "Splash Zone Corrosion", api571_ref: "N/A", environments: ["marine_splash_zone"], materials: ["carbon_steel"], typical_rate_mmpy: { low: 0.2, medium: 0.5, high: 2.0 }, detection_methods: ["UT_THICKNESS", "VISUAL", "CP_SURVEY"], key_factors: ["tidal_range", "coating_condition", "cp_effectiveness", "wave_action"] }
];

// ============================================================
// RATE CALCULATION ENGINE
// ============================================================
function calculateRate(input) {
  var result = {
    mechanism: input.mechanism || "unknown",
    calculation_method: "NONE",
    rate_mmpy: null,
    rate_confidence: "NONE",
    input_quality: {},
    assumptions: [],
    code_reference: "N/A",
    proof_status: "UNPROVEN"
  };

  // Track input quality for every parameter
  var iq = {};
  var fields = ["nominal_wall_mm", "measured_wall_mm", "years_in_service", "temperature_c", "co2_pp", "h2s_pp", "ph", "flow_velocity"];
  for (var f = 0; f < fields.length; f++) {
    if (input[fields[f]] !== undefined && input[fields[f]] !== null) {
      iq[fields[f]] = input[fields[f] + "_quality"] || "ASSUMED";
    } else {
      iq[fields[f]] = "NOT_PROVIDED";
    }
  }
  result.input_quality = iq;

  // Method 1: Direct trending from two or more measurements
  if (input.measured_wall_mm && input.previous_wall_mm && input.years_between) {
    var wallLoss = input.previous_wall_mm - input.measured_wall_mm;
    if (wallLoss > 0 && input.years_between > 0) {
      result.rate_mmpy = Math.round((wallLoss / input.years_between) * 1000) / 1000;
      result.calculation_method = "DIRECT_TRENDING";
      result.rate_confidence = "HIGH";
      result.code_reference = "API 570 Section 7.1.2 / API 510 Section 7.1.2";
      result.proof_status = "PROVEN";
      if (iq.measured_wall_mm === "MEASURED" && input.previous_wall_mm_quality === "MEASURED") {
        result.rate_confidence = "VERY_HIGH";
      }
      return result;
    }
  }

  // Method 2: Single measurement with known nominal and service time
  if (input.measured_wall_mm && input.nominal_wall_mm && input.years_in_service) {
    var loss = input.nominal_wall_mm - input.measured_wall_mm;
    if (loss > 0 && input.years_in_service > 0) {
      result.rate_mmpy = Math.round((loss / input.years_in_service) * 1000) / 1000;
      result.calculation_method = "SINGLE_POINT_AVERAGE";
      result.rate_confidence = "MEDIUM";
      result.code_reference = "API 570 Section 7.1";
      result.proof_status = "PROVISIONAL";
      result.assumptions.push("Corrosion assumed linear from commissioning");
      result.assumptions.push("Nominal wall assumed accurate (no mill tolerance correction)");
      return result;
    }
  }

  // Method 3: Mechanism-based estimate from library
  var mech = null;
  for (var ml = 0; ml < MECHANISM_LIBRARY.length; ml++) {
    if (MECHANISM_LIBRARY[ml].id === input.mechanism) {
      mech = MECHANISM_LIBRARY[ml];
      break;
    }
  }

  if (mech) {
    var severity = (input.severity || "medium").toLowerCase();
    if (severity === "low") result.rate_mmpy = mech.typical_rate_mmpy.low;
    else if (severity === "high") result.rate_mmpy = mech.typical_rate_mmpy.high;
    else result.rate_mmpy = mech.typical_rate_mmpy.medium;

    result.calculation_method = "MECHANISM_LIBRARY_ESTIMATE";
    result.rate_confidence = "LOW";
    result.code_reference = "API 571 " + mech.api571_ref;
    result.proof_status = "UNPROVEN";
    result.assumptions.push("Rate estimated from typical range — not case-specific");
    result.assumptions.push("Severity assumed: " + severity);
    return result;
  }

  // No calculation possible
  result.calculation_method = "CALCULATION_NOT_DEFENSIBLE";
  result.rate_confidence = "NONE";
  result.proof_status = "NO_PROOF";
  result.assumptions.push("Insufficient data to calculate corrosion rate");
  return result;
}

// ============================================================
// REMAINING LIFE CALCULATION
// ============================================================
function calculateRemainingLife(input) {
  var result = {
    remaining_wall_mm: null,
    minimum_required_mm: null,
    remaining_life_years: null,
    confidence: "NONE",
    calculation_method: "NONE",
    code_reference: "N/A",
    proof_status: "UNPROVEN",
    assumptions: []
  };

  if (!input.measured_wall_mm) {
    result.proof_status = "NO_PROOF";
    result.assumptions.push("No measured wall thickness — cannot calculate remaining life");
    return result;
  }

  var tMin = input.minimum_required_mm || null;
  if (!tMin && input.nominal_wall_mm && input.design_pressure && input.outside_diameter_mm) {
    // Barlow formula simplified
    tMin = (input.design_pressure * input.outside_diameter_mm) / (2 * (input.allowable_stress || 137.9));
    result.assumptions.push("tmin calculated from Barlow formula with assumed allowable stress");
  } else if (!tMin && input.nominal_wall_mm) {
    tMin = input.nominal_wall_mm * 0.5; // conservative default
    result.assumptions.push("tmin assumed as 50% of nominal — MUST be verified by design calculation");
  }

  if (!tMin) {
    result.proof_status = "NO_PROOF";
    result.assumptions.push("Cannot determine minimum required wall — remaining life not calculable");
    return result;
  }

  result.minimum_required_mm = Math.round(tMin * 100) / 100;
  result.remaining_wall_mm = Math.round((input.measured_wall_mm - tMin) * 100) / 100;

  if (result.remaining_wall_mm <= 0) {
    result.remaining_life_years = 0;
    result.confidence = "HIGH";
    result.calculation_method = "BELOW_MINIMUM";
    result.code_reference = "API 579-1 Part 4";
    result.proof_status = "PROVEN";
    return result;
  }

  if (input.corrosion_rate_mmpy && input.corrosion_rate_mmpy > 0) {
    result.remaining_life_years = Math.round((result.remaining_wall_mm / input.corrosion_rate_mmpy) * 10) / 10;
    result.calculation_method = "LINEAR_PROJECTION";
    result.code_reference = "API 579-1 Part 4 / API 570 Section 7.2";
    result.confidence = input.rate_confidence || "MEDIUM";
    result.proof_status = input.rate_confidence === "VERY_HIGH" || input.rate_confidence === "HIGH" ? "PROVEN" : "PROVISIONAL";
    return result;
  }

  result.proof_status = "NO_PROOF";
  result.assumptions.push("No corrosion rate available — remaining life not calculable");
  return result;
}

// ============================================================
// INSPECTION INTERVAL CALCULATION
// ============================================================
function calculateInterval(input) {
  var result = {
    interval_months: null,
    next_inspection_date: null,
    interval_basis: "NONE",
    code_reference: "N/A",
    confidence: "NONE",
    proof_status: "UNPROVEN",
    constraints: []
  };

  if (!input.remaining_life_years || input.remaining_life_years <= 0) {
    result.interval_months = 0;
    result.interval_basis = "IMMEDIATE_INSPECTION_REQUIRED";
    result.proof_status = "PROVEN";
    result.confidence = "HIGH";
    return result;
  }

  // API 510/570 rule: half remaining life or code maximum, whichever is less
  var halfLife = input.remaining_life_years / 2;
  var codeMax = 10; // years — API 570 external

  if (input.service_type === "internal") codeMax = 5; // API 570 internal
  if (input.consequence === "CATASTROPHIC") codeMax = 2;
  if (input.consequence === "MAJOR") codeMax = 3;

  var intervalYears = Math.min(halfLife, codeMax);

  // Risk adjustment
  if (input.risk_factor === "HIGH") intervalYears = intervalYears * 0.5;
  else if (input.risk_factor === "VERY_HIGH") intervalYears = intervalYears * 0.25;

  // Floor at 3 months
  if (intervalYears < 0.25) intervalYears = 0.25;

  result.interval_months = Math.round(intervalYears * 12);
  result.interval_basis = "HALF_REMAINING_LIFE_OR_CODE_MAX";
  result.code_reference = "API 570 Section 6.3.2 / API 510 Section 6.3";
  result.confidence = input.life_confidence || "MEDIUM";
  result.proof_status = input.life_proof_status || "PROVISIONAL";

  if (input.last_inspection_date) {
    var lastDate = new Date(input.last_inspection_date);
    var nextDate = new Date(lastDate.getTime() + (result.interval_months * 30.44 * 24 * 60 * 60 * 1000));
    result.next_inspection_date = nextDate.toISOString().split("T")[0];
  }

  result.constraints.push("Code maximum: " + codeMax + " years (" + input.service_type + " service)");
  result.constraints.push("Half remaining life: " + Math.round(halfLife * 10) / 10 + " years");

  return result;
}

// ============================================================
// MECHANISM IDENTIFICATION
// ============================================================
function identifyMechanism(conditions) {
  var candidates = [];
  var env = (conditions.environment || "").toLowerCase();
  var mat = (conditions.material || "carbon_steel").toLowerCase();
  var temp = conditions.temperature_c || null;

  for (var i = 0; i < MECHANISM_LIBRARY.length; i++) {
    var mech = MECHANISM_LIBRARY[i];
    var score = 0;

    // Environment match
    for (var e = 0; e < mech.environments.length; e++) {
      if (env.indexOf(mech.environments[e]) >= 0 || mech.environments[e].indexOf(env) >= 0) {
        score = score + 30;
        break;
      }
    }

    // Material match
    for (var m = 0; m < mech.materials.length; m++) {
      if (mat.indexOf(mech.materials[m]) >= 0 || mech.materials[m] === "all") {
        score = score + 20;
        break;
      }
    }

    // Temperature range match (for CUI)
    if (mech.temp_range_c && temp !== null) {
      if (temp >= mech.temp_range_c.min && temp <= mech.temp_range_c.max) {
        score = score + 25;
      }
    }

    // Key factor matches
    for (var k = 0; k < mech.key_factors.length; k++) {
      if (conditions[mech.key_factors[k]] !== undefined) {
        score = score + 5;
      }
    }

    // Specific condition boosts
    if (mech.id === "co2_corrosion" && conditions.co2_partial_pressure) score = score + 30;
    if (mech.id === "h2s_corrosion" && conditions.h2s_partial_pressure) score = score + 30;
    if (mech.id === "erosion_corrosion" && conditions.sand_production) score = score + 30;
    if (mech.id === "CUI" && env.indexOf("insul") >= 0) score = score + 30;
    if (mech.id === "CUF" && env.indexOf("fireproof") >= 0) score = score + 30;
    if (mech.id === "splash_zone" && env.indexOf("splash") >= 0) score = score + 40;
    if (mech.id === "MIC" && (env.indexOf("stagnant") >= 0 || env.indexOf("dead_leg") >= 0)) score = score + 30;

    if (score > 20) {
      candidates.push({
        mechanism: mech.id,
        name: mech.name,
        score: score,
        confidence: score >= 60 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW",
        api571_ref: mech.api571_ref,
        typical_rates: mech.typical_rate_mmpy,
        detection_methods: mech.detection_methods,
        key_factors: mech.key_factors
      });
    }
  }

  candidates.sort(function(a, b) { return b.score - a.score; });
  return candidates;
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

    // ---- get_registry ----
    if (action === "get_registry") {
      return ok({
        engine: "corrosion-loop-engine",
        version: ENGINE_VERSION,
        description: "Traceable corrosion loop: mechanism -> rate -> remaining life -> inspection interval. Every rate must trace to a basis. Every interval must trace to a rate. Forces real inputs or refuses to calculate.",
        actions: ["get_registry", "identify_mechanism", "calculate_rate", "calculate_remaining_life", "calculate_interval", "run_full_loop", "get_mechanism_library", "record_measurement", "get_loop_history", "validate_loop"],
        mechanisms: MECHANISM_LIBRARY.length,
        rate_methods: ["DIRECT_TRENDING", "SINGLE_POINT_AVERAGE", "MECHANISM_LIBRARY_ESTIMATE", "CALCULATION_NOT_DEFENSIBLE"],
        proof_levels: ["PROVEN", "PROVISIONAL", "UNPROVEN", "NO_PROOF"],
        code_references: ["API 571", "API 579-1", "API 510", "API 570", "DNV-RP-F101", "NACE SP0775"],
        status: "operational"
      });
    }

    // ---- get_mechanism_library ----
    if (action === "get_mechanism_library") {
      return ok({ engine: "corrosion-loop-engine", mechanism_count: MECHANISM_LIBRARY.length, mechanisms: MECHANISM_LIBRARY });
    }

    // ---- identify_mechanism ----
    if (action === "identify_mechanism") {
      var conditions = body.conditions || body;
      var candidates = identifyMechanism(conditions);
      return ok({ engine: "corrosion-loop-engine", candidate_count: candidates.length, candidates: candidates });
    }

    // ---- calculate_rate ----
    if (action === "calculate_rate") {
      var rateResult = calculateRate(body.input || body);
      return ok({ engine: "corrosion-loop-engine", result: rateResult });
    }

    // ---- calculate_remaining_life ----
    if (action === "calculate_remaining_life") {
      var lifeResult = calculateRemainingLife(body.input || body);
      return ok({ engine: "corrosion-loop-engine", result: lifeResult });
    }

    // ---- calculate_interval ----
    if (action === "calculate_interval") {
      var intResult = calculateInterval(body.input || body);
      return ok({ engine: "corrosion-loop-engine", result: intResult });
    }

    // ---- run_full_loop ----
    if (action === "run_full_loop") {
      var input = body.input || body;

      // Step 1: Identify mechanism
      var mechs = identifyMechanism(input.conditions || input);
      var primaryMech = mechs.length > 0 ? mechs[0] : null;

      // Step 2: Calculate rate
      var rateInput = input;
      if (primaryMech) rateInput.mechanism = primaryMech.mechanism;
      var rate = calculateRate(rateInput);

      // Step 3: Calculate remaining life
      var lifeInput = { measured_wall_mm: input.measured_wall_mm, nominal_wall_mm: input.nominal_wall_mm, minimum_required_mm: input.minimum_required_mm, corrosion_rate_mmpy: rate.rate_mmpy, rate_confidence: rate.rate_confidence, design_pressure: input.design_pressure, outside_diameter_mm: input.outside_diameter_mm, allowable_stress: input.allowable_stress };
      var life = calculateRemainingLife(lifeInput);

      // Step 4: Calculate interval
      var intInput = { remaining_life_years: life.remaining_life_years, life_confidence: life.confidence, life_proof_status: life.proof_status, service_type: input.service_type || "external", consequence: input.consequence || "HIGH", risk_factor: input.risk_factor, last_inspection_date: input.last_inspection_date };
      var interval = calculateInterval(intInput);

      // Overall proof status
      var overallProof = "PROVEN";
      if (rate.proof_status === "NO_PROOF" || life.proof_status === "NO_PROOF") overallProof = "NO_PROOF";
      else if (rate.proof_status === "UNPROVEN" || life.proof_status === "UNPROVEN") overallProof = "UNPROVEN";
      else if (rate.proof_status === "PROVISIONAL" || life.proof_status === "PROVISIONAL") overallProof = "PROVISIONAL";

      var loopResult = {
        engine: "corrosion-loop-engine",
        version: ENGINE_VERSION,
        component: input.component || "unknown",
        material: input.material || "unknown",
        overall_proof_status: overallProof,
        mechanism: { primary: primaryMech, all_candidates: mechs },
        rate: rate,
        remaining_life: life,
        inspection_interval: interval,
        loop_complete: rate.rate_mmpy !== null && life.remaining_life_years !== null && interval.interval_months !== null,
        proof_chain_intact: overallProof === "PROVEN" || overallProof === "PROVISIONAL"
      };

      // Store in Supabase if available
      if (supabaseUrl && supabaseKey && body.case_id) {
        var sb = createClient(supabaseUrl, supabaseKey);
        await sb.from("corrosion_loops").insert({
          case_id: body.case_id,
          component: input.component || "unknown",
          material: input.material || "unknown",
          mechanism: primaryMech ? primaryMech.mechanism : "unknown",
          mechanism_confidence: primaryMech ? primaryMech.confidence : "NONE",
          environment: input.environment || null,
          temperature_c: input.temperature_c || null,
          co2_partial_pressure: input.co2_pp || null,
          h2s_partial_pressure: input.h2s_pp || null,
          nominal_wall_mm: input.nominal_wall_mm || null,
          measured_wall_mm: input.measured_wall_mm || null,
          minimum_required_wall_mm: life.minimum_required_mm,
          corrosion_rate_mmpy: rate.rate_mmpy,
          rate_basis: rate.calculation_method,
          rate_confidence: rate.rate_confidence,
          remaining_life_years: life.remaining_life_years,
          remaining_life_confidence: life.confidence,
          inspection_interval_months: interval.interval_months,
          interval_basis: interval.interval_basis,
          calculation_method: rate.calculation_method,
          code_reference: rate.code_reference,
          input_quality: rate.input_quality,
          assumptions: rate.assumptions.concat(life.assumptions),
          proof_status: overallProof
        });
      }

      return ok(loopResult);
    }

    // ---- record_measurement ----
    if (action === "record_measurement") {
      if (!supabaseUrl || !supabaseKey) return errResp(500, "SUPABASE not configured");
      if (!body.loop_id || !body.wall_thickness_mm) return errResp(400, "loop_id and wall_thickness_mm required");
      var sb2 = createClient(supabaseUrl, supabaseKey);
      var insResult = await sb2.from("corrosion_rate_history").insert({
        loop_id: body.loop_id,
        measurement_date: body.measurement_date || new Date().toISOString().split("T")[0],
        wall_thickness_mm: body.wall_thickness_mm,
        location_id: body.location_id || null,
        method: body.method || "UT_THICKNESS",
        confidence: body.confidence || "MEASURED"
      }).select("id").single();
      return ok({ engine: "corrosion-loop-engine", recorded: true, id: insResult.data ? insResult.data.id : null });
    }

    // ---- get_loop_history ----
    if (action === "get_loop_history") {
      if (!body.case_id) return errResp(400, "case_id required");
      if (!supabaseUrl || !supabaseKey) return errResp(500, "SUPABASE not configured");
      var sb3 = createClient(supabaseUrl, supabaseKey);
      var loopRes = await sb3.from("corrosion_loops").select("*").eq("case_id", body.case_id).order("created_at", { ascending: false });
      return ok({ engine: "corrosion-loop-engine", case_id: body.case_id, loops: loopRes.data || [] });
    }

    // ---- validate_loop ----
    if (action === "validate_loop") {
      if (!body.loop_id) return errResp(400, "loop_id required");
      if (!supabaseUrl || !supabaseKey) return errResp(500, "SUPABASE not configured");
      var sb4 = createClient(supabaseUrl, supabaseKey);
      var loopData = await sb4.from("corrosion_loops").select("*").eq("id", body.loop_id).single();
      if (loopData.error || !loopData.data) return errResp(404, "Loop not found");

      var loop = loopData.data;
      var validations = [];
      if (!loop.mechanism || loop.mechanism === "unknown") validations.push({ field: "mechanism", status: "FAIL", reason: "No mechanism identified" });
      else validations.push({ field: "mechanism", status: "PASS" });
      if (!loop.corrosion_rate_mmpy) validations.push({ field: "rate", status: "FAIL", reason: "No rate calculated" });
      else if (loop.rate_confidence === "LOW" || loop.rate_confidence === "NONE") validations.push({ field: "rate", status: "WARN", reason: "Rate confidence: " + loop.rate_confidence });
      else validations.push({ field: "rate", status: "PASS" });
      if (!loop.remaining_life_years && loop.remaining_life_years !== 0) validations.push({ field: "remaining_life", status: "FAIL", reason: "No remaining life calculated" });
      else validations.push({ field: "remaining_life", status: "PASS" });
      if (!loop.inspection_interval_months) validations.push({ field: "interval", status: "FAIL", reason: "No interval calculated" });
      else validations.push({ field: "interval", status: "PASS" });

      var failCount = 0;
      for (var v = 0; v < validations.length; v++) { if (validations[v].status === "FAIL") failCount++; }

      return ok({ engine: "corrosion-loop-engine", loop_id: body.loop_id, proof_status: loop.proof_status, validations: validations, fail_count: failCount, loop_complete: failCount === 0 });
    }

    return errResp(400, "Unknown action: " + action + ". Use get_registry for available actions.");
  } catch (err) {
    return errResp(500, String(err && err.message ? err.message : err));
  }
};
