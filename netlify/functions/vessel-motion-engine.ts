// @ts-nocheck
/**
 * DEPLOY290 - vessel-motion-engine.ts
 * netlify/functions/vessel-motion-engine.ts
 *
 * VESSEL MOTION + HYDRODYNAMICS ENGINE
 *
 * Sea state effects, motion responses, slamming, fatigue accumulation,
 * operational limits.
 *
 * POST /api/vessel-motion-engine
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var ENGINE_ID = "vessel-motion-engine";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY290";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

var SEA_STATES = {
  calm: { code: 0, hs_m: { min: 0, max: 0.1 }, description: "Calm (glassy)", fatigue_factor: 0.1, slamming_risk: "none", operational_impact: "none" },
  smooth: { code: 1, hs_m: { min: 0.1, max: 0.5 }, description: "Smooth (rippled)", fatigue_factor: 0.2, slamming_risk: "none", operational_impact: "none" },
  slight: { code: 2, hs_m: { min: 0.5, max: 1.25 }, description: "Slight", fatigue_factor: 0.4, slamming_risk: "low", operational_impact: "minor" },
  moderate: { code: 3, hs_m: { min: 1.25, max: 2.5 }, description: "Moderate", fatigue_factor: 0.7, slamming_risk: "moderate", operational_impact: "some_operations_limited" },
  rough: { code: 4, hs_m: { min: 2.5, max: 4.0 }, description: "Rough", fatigue_factor: 1.0, slamming_risk: "significant", operational_impact: "most_operations_suspended" },
  very_rough: { code: 5, hs_m: { min: 4.0, max: 6.0 }, description: "Very rough", fatigue_factor: 1.5, slamming_risk: "high", operational_impact: "all_deck_operations_stopped" },
  high: { code: 6, hs_m: { min: 6.0, max: 9.0 }, description: "High", fatigue_factor: 2.0, slamming_risk: "severe", operational_impact: "survival_mode" },
  very_high: { code: 7, hs_m: { min: 9.0, max: 14.0 }, description: "Very high", fatigue_factor: 3.0, slamming_risk: "extreme", operational_impact: "survival_mode" },
  phenomenal: { code: 8, hs_m: { min: 14.0, max: 99 }, description: "Phenomenal", fatigue_factor: 5.0, slamming_risk: "extreme", operational_impact: "survival_extreme" }
};

var SLAMMING_TYPES = {
  bow_slamming: { name: "Bow Slamming", affected: ["bow_plating", "bow_frames", "forecastle"], damage: ["plating_deformation", "frame_buckling", "weld_cracking"], prevention: "Reduce speed, alter heading" },
  bottom_slamming: { name: "Bottom Slamming", affected: ["bottom_plating", "floors", "double_bottom"], damage: ["plating_set_up", "stiffener_tripping", "weld_cracking"], prevention: "Increase draft, reduce speed" },
  stern_slamming: { name: "Stern Slamming", affected: ["stern_plating", "stern_frames", "rudder_horn"], damage: ["plating_deformation", "propeller_racing"], prevention: "Reduce speed in following seas" },
  whipping: { name: "Whipping Response", affected: ["midships_structure", "deck_openings", "hatch_corners"], damage: ["fatigue_acceleration", "increased_hull_girder_stress"], prevention: "Avoid slamming conditions" },
  springing: { name: "Springing", affected: ["midships_deck", "bottom_structure"], damage: ["fatigue_damage_accumulation"], prevention: "Design consideration" }
};

var OPERATIONAL_LIMITS = {
  crane_operations: { max_hs_m: 2.5, description: "Crane operations suspended above limit" },
  helicopter_ops: { max_hs_m: 4.0, description: "Helicopter operations limited by deck motion" },
  cargo_transfer: { max_hs_m: 2.0, description: "Cargo transfer between vessels" },
  diving_operations: { max_hs_m: 1.5, description: "Diving operations weather window" },
  rov_operations: { max_hs_m: 3.5, description: "ROV launch and recovery limits" },
  drilling: { max_hs_m: 5.0, description: "Drilling operations (vessel dependent)" },
  pipelay: { max_hs_m: 3.0, description: "Pipelay operations" },
  personnel_transfer: { max_hs_m: 1.5, description: "Personnel transfer by gangway or basket" }
};

function evaluateMotion(input) {
  var seaState = input.sea_state || "moderate";
  var heading = input.heading || "head_seas";
  var speed_kts = input.speed_kts || 0;

  var seaDef = SEA_STATES[seaState];
  if (!seaDef) return { error: "Unknown sea state. Options: " + Object.keys(SEA_STATES).join(", ") };

  var rollFactor = 1.0;
  var pitchFactor = 1.0;
  var slammingFactor = 1.0;

  if (heading === "beam_seas") { rollFactor = 2.0; pitchFactor = 0.5; slammingFactor = 0.3; }
  else if (heading === "quartering_seas") { rollFactor = 1.5; pitchFactor = 0.8; slammingFactor = 0.5; }
  else if (heading === "following_seas") { rollFactor = 0.8; pitchFactor = 0.7; slammingFactor = 0.4; }
  else if (heading === "head_seas") { rollFactor = 0.5; pitchFactor = 1.5; slammingFactor = 1.5; }

  if (speed_kts > 10) slammingFactor = slammingFactor * 1.3;
  if (speed_kts > 15) slammingFactor = slammingFactor * 1.5;

  var effectiveFatigueFactor = seaDef.fatigue_factor * ((rollFactor + pitchFactor) / 2);

  var slammingRisk = seaDef.slamming_risk;
  if (slammingFactor > 2.0 && slammingRisk !== "extreme") {
    if (slammingRisk === "none") slammingRisk = "low";
    else if (slammingRisk === "low") slammingRisk = "moderate";
    else if (slammingRisk === "moderate") slammingRisk = "significant";
    else if (slammingRisk === "significant") slammingRisk = "high";
  }

  var hs = (seaDef.hs_m.min + seaDef.hs_m.max) / 2;
  var operationsAffected = [];
  var opKeys = Object.keys(OPERATIONAL_LIMITS);
  for (var i = 0; i < opKeys.length; i++) {
    var limit = OPERATIONAL_LIMITS[opKeys[i]];
    if (hs > limit.max_hs_m) {
      operationsAffected.push({ operation: opKeys[i], description: limit.description, limit_hs: limit.max_hs_m, exceeded: true });
    }
  }

  return {
    sea_state: seaState, sea_state_description: seaDef.description, significant_wave_height_m: hs, heading: heading, speed_kts: speed_kts,
    motion_factors: { roll_factor: Math.round(rollFactor * 100) / 100, pitch_factor: Math.round(pitchFactor * 100) / 100, slamming_factor: Math.round(slammingFactor * 100) / 100 },
    fatigue: { base_factor: seaDef.fatigue_factor, effective_factor: Math.round(effectiveFatigueFactor * 100) / 100, note: effectiveFatigueFactor > 2.0 ? "HIGH fatigue accumulation rate." : (effectiveFatigueFactor > 1.0 ? "Elevated fatigue accumulation." : "Normal fatigue rate.") },
    slamming: { risk: slammingRisk, types_at_risk: slammingRisk === "none" ? [] : (heading === "head_seas" ? ["bow_slamming", "whipping"] : (heading === "following_seas" ? ["stern_slamming"] : ["bottom_slamming"])), speed_recommendation: slammingRisk === "significant" || slammingRisk === "high" || slammingRisk === "severe" || slammingRisk === "extreme" ? "REDUCE SPEED to minimize slamming." : "Current speed acceptable." },
    operations_affected: operationsAffected, operational_impact: seaDef.operational_impact,
    klein_bottle_note: "Every wave cycle is a fatigue cycle. The sea state is not external to the structure — it IS the loading."
  };
}

function assessFatigueFromMotion(input) {
  var seaState = input.sea_state || "moderate";
  var hoursInState = input.hours || 24;
  var wavePeriod = input.wave_period_s || 8;
  var existingDamage = input.existing_damage_ratio || 0;

  var seaDef = SEA_STATES[seaState];
  if (!seaDef) return { error: "Unknown sea state" };

  var cyclesPerHour = 3600 / wavePeriod;
  var totalCycles = cyclesPerHour * hoursInState;
  var increment = totalCycles * seaDef.fatigue_factor * 1e-8;
  var cumulative = existingDamage + increment;

  var status = "safe";
  if (cumulative > 1.0) status = "exceeded_design_life";
  else if (cumulative > 0.8) status = "approaching_limit";
  else if (cumulative > 0.5) status = "mid_life";

  return { sea_state: seaState, hours: hoursInState, wave_period_s: wavePeriod, cycles: Math.round(totalCycles), fatigue_factor: seaDef.fatigue_factor, damage_increment: Math.round(increment * 1e6) / 1e6, existing_damage: existingDamage, cumulative_damage: Math.round(cumulative * 1e6) / 1e6, status: status, note: status === "exceeded_design_life" ? "Fatigue design life exceeded. Inspect hotspots." : (status === "approaching_limit" ? "Approaching fatigue limit. Plan inspection." : "Within design life.") };
}

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";

    if (action === "get_registry") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, deploy: DEPLOY, mode: "deterministic", purpose: "Vessel Motion + Hydrodynamics — sea state, slamming, fatigue, operational limits", sea_states: Object.keys(SEA_STATES).length, slamming_types: Object.keys(SLAMMING_TYPES).length, operational_limits: Object.keys(OPERATIONAL_LIMITS).length, actions: ["evaluate_motion", "assess_fatigue_from_motion", "get_sea_states", "get_operational_limits", "get_slamming_types", "get_registry"] }) };
    }
    if (action === "evaluate_motion") {
      var motionResult = evaluateMotion(body);
      try {
        var sb = createClient(supabaseUrl, supabaseKey);
        await sb.from("vessel_motion_assessments").insert({ org_id: body.org_id || null, case_id: body.case_id || null, sea_state: body.sea_state || "unknown", result_json: motionResult });
      } catch (dbErr) { /* non-fatal */ }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: motionResult }, null, 2) };
    }
    if (action === "assess_fatigue_from_motion") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: assessFatigueFromMotion(body) }, null, 2) };
    }
    if (action === "get_sea_states") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, sea_states: SEA_STATES }, null, 2) };
    }
    if (action === "get_operational_limits") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, limits: OPERATIONAL_LIMITS }, null, 2) };
    }
    if (action === "get_slamming_types") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, slamming: SLAMMING_TYPES }, null, 2) };
    }
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
