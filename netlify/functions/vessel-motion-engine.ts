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
    else if (slamm
