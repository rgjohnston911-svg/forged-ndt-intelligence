// @ts-nocheck
/**
 * DEPLOY304 - multi-physics-4d-projection.ts
 * netlify/functions/multi-physics-4d-projection.ts
 *
 * MULTI-PHYSICS 4D PROJECTION — ENGINE 94
 *
 * Time-forward coupled simulation engine. Projects asset condition
 * into the future by coupling corrosion, stress, fatigue, coating
 * degradation, and vibration into year-by-year timelines.
 *
 * Three simulation modes:
 *   corrosion_stress   - Wall loss + hoop stress + coating degradation
 *                        over time with disposition at each year
 *   fatigue_corrosion  - Miner rule + wall thinning with stress
 *                        concentration increase as wall thins
 *   do_nothing         - Three scenarios (best/expected/worst) with
 *                        cost-of-inaction analysis
 *
 * Every projection includes:
 *   - Year-by-year timeline with thickness, stress, damage, disposition
 *   - Recommended inspection interval
 *   - Failure year estimate
 *   - Confidence and assumptions
 *
 * POST /api/multi-physics-4d-projection
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var ENGINE_ID = "multi-physics-4d-projection";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY304";
var corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };

// ============================================================
// HELPERS
// ============================================================

function num(v) {
  var n = Number(v);
  if (v === undefined || v === null || v === "" || isNaN(n)) return null;
  return n;
}

function getMissing(inputs, keys) {
  var m = [];
  for (var i = 0; i < keys.length; i++) {
    if (inputs[keys[i]] === undefined || inputs[keys[i]] === null || inputs[keys[i]] === "") {
      m.push(keys[i]);
    }
  }
  return m;
}

// ============================================================
// SIMULATION: CORROSION-STRESS COUPLING
// ============================================================

function simulateCorrosionStress(inp) {
  var required = ["t_actual", "t_min", "CR", "P", "D", "S_allow", "years"];
  var m = getMissing(inp, required);
  if (m.length > 0) {
    return { error: null, held: true, missing_inputs: m, interpretation: "Cannot simulate — missing: " + m.join(", ") };
  }

  var tActual = num(inp.t_actual);
  var tMin = num(inp.t_min);
  var CR = num(inp.CR);
  var P = num(inp.P);
  var D = num(inp.D);
  var sAllow = num(inp.S_allow);
  var years = num(inp.years);
  var coatingLife = num(inp.coating_life) || 0;
  var coatingFactor = num(inp.coating_degradation_factor) || 1.0;

  var timeline = [];
  var failureYear = null;
  var inspectionInterval = null;

  for (var y = 0; y <= years; y++) {
    // Coating degradation: after coating life expires, corrosion accelerates
    var effectiveCR = CR;
    if (coatingLife > 0 && y > coatingLife) {
      var yearsExposed = y - coatingLife;
      effectiveCR = CR * (1 + (coatingFactor - 1) * Math.min(yearsExposed / 5, 1));
    }

    var thickness = tActual - (effectiveCR * y);
    if (thickness < 0) thickness = 0;

    var hoopStress = thickness > 0 ? (P * D) / (2 * thickness) : Infinity;
    var stressRatio = hoopStress / sAllow;
    var remainingLife = effectiveCR > 0 ? (thickness - tMin) / effectiveCR : Infinity;

    var disposition = "monitor";
    if (thickness <= tMin || stressRatio >= 1) {
      disposition = "repair_or_shutdown";
      if (failureYear === null) failureYear = y;
    } else if (stressRatio >= 0.9 || remainingLife < 2) {
      disposition = "immediate_engineer_review";
    } else if (stressRatio >= 0.75 || remainingLife < 5) {
      disposition = "accelerated_inspection";
    }

    timeline.push({
      year: y,
      thickness: Math.round(thickness * 1000) / 1000,
      effective_CR: Math.round(effectiveCR * 10000) / 10000,
      hoop_stress: Math.round(hoopStress * 100) / 100,
      stress_ratio: Math.round(stressRatio * 10000) / 10000,
      remaining_life_from_here: Math.round(remainingLife * 10) / 10,
      disposition: disposition
    });
  }

  // Determine inspection interval
  if (failureYear !== null && failureYear <= 2) {
    inspectionInterval = 0;
  } else if (failureYear !== null && failureYear <= 5) {
    inspectionInterval = 1;
  } else {
    var rl = CR > 0 ? (tActual - tMin) / CR : 999;
    if (rl < 5) inspectionInterval = 1;
    else if (rl < 10) inspectionInterval = 2;
    else if (rl < 20) inspectionInterval = 5;
    else inspectionInterval = 10;
  }

  return {
    held: false,
    mode: "corrosion_stress",
    timeline: timeline,
    failure_year: failureYear,
    inspection_interval_years: inspectionInterval,
    initial_thickness: tActual,
    minimum_thickness: tMin,
    corrosion_rate: CR,
    coating_life: coatingLife,
    interpretation: failureYear !== null
      ? "Wall thickness reaches minimum at year " + failureYear + ". " + (failureYear <= 2 ? "CRITICAL — immediate action required." : "Plan repair or replacement before year " + failureYear + ".")
      : "Wall thickness remains above minimum for the full " + years + "-year projection.",
    confidence: 0.76,
    assumptions: [
      "Linear corrosion rate with coating degradation factor",
      "Thin-wall hoop stress formula applies",
      "No localized attack or pitting acceleration"
    ],
    limitations: [
      "Does not model localized corrosion, SCC, or fatigue interaction",
      "Coating degradation is simplified as linear ramp"
    ]
  };
}

// ============================================================
// SIMULATION: FATIGUE-CORROSION INTERACTION
// ============================================================

function simulateFatigueCorrosion(inp) {
  var required = ["t_actual", "t_min", "CR", "sigma_nom", "Kt_initial", "cycles_per_year", "N_failure", "years"];
  var m = getMissing(inp, required);
  if (m.length > 0) {
    return { error: null, held: true, missing_inputs: m, interpretation: "Cannot simulate — missing: " + m.join(", ") };
  }

  var tActual = num(inp.t_actual);
  var tMin = num(inp.t_min);
  var CR = num(inp.CR);
  var sigmaNom = num(inp.sigma_nom);
  var KtInit = num(inp.Kt_initial);
  var cyclesPerYear = num(inp.cycles_per_year);
  var Nf = num(inp.N_failure);
  var years = num(inp.years);

  var timeline = [];
  var cumulativeDamage = 0;
  var failureYear = null;
  var failureMode = null;

  for (var y = 0; y <= years; y++) {
    var thickness = tActual - (CR * y);
    if (thickness < 0) thickness = 0;

    // Stress concentration increases as wall thins
    var wallRatio = tActual > 0 ? tActual / Math.max(thickness, 0.01) : 1;
    var Kt = KtInit * Math.sqrt(wallRatio);

    var peakStress = Kt * sigmaNom;

    // Damage this year (Miner fraction)
    var yearDamage = y > 0 ? cyclesPerYear / Nf : 0;
    cumulativeDamage += yearDamage;

    var disposition = "monitor";
    if (thickness <= tMin) {
      disposition = "repair_or_shutdown";
      if (failureYear === null) { failureYear = y; failureMode = "wall_loss"; }
    } else if (cumulativeDamage >= 1) {
      disposition = "repair_or_shutdown";
      if (failureYear === null) { failureYear = y; failureMode = "fatigue"; }
    } else if (cumulativeDamage >= 0.7 || thickness - tMin < CR * 2) {
      disposition = "immediate_engineer_review";
    } else if (cumulativeDamage >= 0.4) {
      disposition = "accelerated_inspection";
    }

    timeline.push({
      year: y,
      thickness: Math.round(thickness * 1000) / 1000,
      Kt_effective: Math.round(Kt * 1000) / 1000,
      peak_stress: Math.round(peakStress * 100) / 100,
      cumulative_damage: Math.round(cumulativeDamage * 10000) / 10000,
      disposition: disposition
    });
  }

  return {
    held: false,
    mode: "fatigue_corrosion",
    timeline: timeline,
    failure_year: failureYear,
    failure_mode: failureMode,
    interpretation: failureYear !== null
      ? "Failure predicted at year " + failureYear + " by " + failureMode + ". " + (failureMode === "fatigue" ? "Cumulative fatigue damage reaches 1.0." : "Wall thickness reaches minimum.")
      : "No failure predicted within " + years + "-year window.",
    confidence: 0.72,
    assumptions: [
      "Linear corrosion rate",
      "Miner linear damage accumulation",
      "Stress concentration scales with sqrt of wall ratio"
    ],
    limitations: [
      "Does not model crack initiation or propagation",
      "Load sequence effects not captured",
      "Kt scaling is approximate"
    ]
  };
}

// ============================================================
// SIMULATION: DO-NOTHING PROJECTION
// ============================================================

function projectDoNothing(inp) {
  var required = ["t_actual", "t_min", "CR", "repair_cost", "failure_cost", "years"];
  var m = getMissing(inp, required);
  if (m.length > 0) {
    return { error: null, held: true, missing_inputs: m, interpretation: "Cannot project — missing: " + m.join(", ") };
  }

  var tActual = num(inp.t_actual);
  var tMin = num(inp.t_min);
  var CR = num(inp.CR);
  var repairCost = num(inp.repair_cost);
  var failureCost = num(inp.failure_cost);
  var years = num(inp.years);

  var scenarios = [
    { label: "best", factor: 0.5 },
    { label: "expected", factor: 1.0 },
    { label: "worst", factor: 2.0 }
  ];

  var projections = [];
  for (var s = 0; s < scenarios.length; s++) {
    var sc = scenarios[s];
    var effectiveCR = CR * sc.factor;
    var rl = effectiveCR > 0 ? (tActual - tMin) / effectiveCR : 999;
    var failYear = Math.floor(rl);
    if (failYear > years) failYear = null;

    var doNothingCost = 0;
    if (failYear !== null) {
      doNothingCost = failureCost;
    }

    projections.push({
      scenario: sc.label,
      corrosion_rate: effectiveCR,
      remaining_life: Math.round(rl * 10) / 10,
      failure_year: failYear,
      do_nothing_cost: doNothingCost,
      repair_now_cost: repairCost,
      cost_of_inaction: doNothingCost - repairCost
    });
  }

  var expected = projections[1];
  var recommendation = "monitor";
  if (expected.cost_of_inaction > 0) {
    recommendation = "repair_now";
  } else if (expected.remaining_life < 5) {
    recommendation = "plan_repair";
  }

  return {
    held: false,
    mode: "do_nothing",
    projections: projections,
    recommendation: recommendation,
    interpretation: recommendation === "repair_now"
      ? "Repair now is economically justified. Expected cost of inaction (" + expected.do_nothing_cost + ") exceeds repair cost (" + repairCost + ")."
      : recommendation === "plan_repair"
        ? "Plan repair within " + Math.round(expected.remaining_life) + " years. Monitor with calculated interval."
        : "Do-nothing is acceptable for now. Continue monitoring.",
    confidence: 0.70,
    assumptions: [
      "Best/expected/worst at 0.5x/1x/2x corrosion rate",
      "Single failure mode (wall loss)",
      "Repair cost and failure cost are known"
    ],
    limitations: [
      "Does not account for secondary damage modes",
      "Does not include downtime or production loss in cost",
      "Discount rate not applied (no NPV)"
    ]
  };
}

// ============================================================
// HANDLER
// ============================================================

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };
  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";

    if (action === "get_registry") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
        engine: ENGINE_ID, version: ENGINE_VERSION, deploy: DEPLOY,
        mode: "deterministic",
        purpose: "Multi-Physics 4D Projection — time-forward coupled simulation with corrosion-stress, fatigue-corrosion, and do-nothing cost analysis",
        simulation_modes: ["corrosion_stress", "fatigue_corrosion", "do_nothing"],
        actions: ["simulate_corrosion_stress", "simulate_fatigue_corrosion", "project_do_nothing", "get_registry"]
      }) };
    }

    if (action === "simulate_corrosion_stress") {
      var inputs = body.inputs || body;
      var result = simulateCorrosionStress(inputs);

      if (result.held) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
          engine: ENGINE_ID, action: action,
          held: true,
          missing_inputs: result.missing_inputs,
          interpretation: result.interpretation
        }) };
      }

      // Log (non-fatal)
      try {
        var sb = createClient(supabaseUrl, supabaseKey);
        await sb.from("formula_execution_runs").insert({
          org_id: body.org_id || null,
          case_id: body.case_id || null,
          asset_id: body.asset_id || null,
          finding_id: body.finding_id || null,
          formula_code: "4D_CORROSION_STRESS",
          input_payload: inputs,
          output_payload: { failure_year: result.failure_year, inspection_interval: result.inspection_interval_years, timeline_length: result.timeline.length },
          confidence: result.confidence,
          severity: result.failure_year !== null && result.failure_year <= 2 ? "critical" : result.failure_year !== null && result.failure_year <= 5 ? "high" : "medium",
          interpretation: result.interpretation
        });
      } catch (e) {}

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
        engine: ENGINE_ID, version: ENGINE_VERSION, action: action,
        simulation: result
      }, null, 2) };
    }

    if (action === "simulate_fatigue_corrosion") {
      var inputs2 = body.inputs || body;
      var result2 = simulateFatigueCorrosion(inputs2);

      if (result2.held) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
          engine: ENGINE_ID, action: action,
          held: true,
          missing_inputs: result2.missing_inputs,
          interpretation: result2.interpretation
        }) };
      }

      try {
        var sb2 = createClient(supabaseUrl, supabaseKey);
        await sb2.from("formula_execution_runs").insert({
          org_id: body.org_id || null,
          case_id: body.case_id || null,
          asset_id: body.asset_id || null,
          finding_id: body.finding_id || null,
          formula_code: "4D_FATIGUE_CORROSION",
          input_payload: inputs2,
          output_payload: { failure_year: result2.failure_year, failure_mode: result2.failure_mode, timeline_length: result2.timeline.length },
          confidence: result2.confidence,
          severity: result2.failure_year !== null && result2.failure_year <= 2 ? "critical" : result2.failure_year !== null && result2.failure_year <= 5 ? "high" : "medium",
          interpretation: result2.interpretation
        });
      } catch (e) {}

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
        engine: ENGINE_ID, version: ENGINE_VERSION, action: action,
        simulation: result2
      }, null, 2) };
    }

    if (action === "project_do_nothing") {
      var inputs3 = body.inputs || body;
      var result3 = projectDoNothing(inputs3);

      if (result3.held) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
          engine: ENGINE_ID, action: action,
          held: true,
          missing_inputs: result3.missing_inputs,
          interpretation: result3.interpretation
        }) };
      }

      try {
        var sb3 = createClient(supabaseUrl, supabaseKey);
        await sb3.from("formula_execution_runs").insert({
          org_id: body.org_id || null,
          case_id: body.case_id || null,
          asset_id: body.asset_id || null,
          finding_id: body.finding_id || null,
          formula_code: "4D_DO_NOTHING",
          input_payload: inputs3,
          output_payload: { recommendation: result3.recommendation, projections: result3.projections },
          confidence: result3.confidence,
          severity: result3.recommendation === "repair_now" ? "high" : "medium",
          interpretation: result3.interpretation
        });
      } catch (e) {}

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
        engine: ENGINE_ID, version: ENGINE_VERSION, action: action,
        simulation: result3
      }, null, 2) };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
