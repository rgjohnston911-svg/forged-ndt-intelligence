// @ts-nocheck
/**
 * DEPLOY297 - subsea-inspection-conditions.ts
 * netlify/functions/subsea-inspection-conditions.ts
 *
 * SUBSEA INSPECTION CONDITIONS ENGINE
 *
 * Visibility, current, depth, and marine growth state as first-class
 * inputs that modify every subsea assessment's confidence. Connects
 * inspection conditions to the Klein bottle mesh — dive conditions
 * are part of the assessment surface, not external to it.
 *
 * POST /api/subsea-inspection-conditions
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var ENGINE_ID = "subsea-inspection-conditions";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY297";
var corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };

// ============================================================
// CONDITION IMPACT MATRIX
// ============================================================

var VISIBILITY_IMPACT = {
  excellent: { min_m: 10, confidence_factor: 0.95, visual_reliable: true, photography_reliable: true, ndt_access: "full", label: "Excellent (>10m)" },
  good: { min_m: 5, max_m: 10, confidence_factor: 0.85, visual_reliable: true, photography_reliable: true, ndt_access: "full", label: "Good (5-10m)" },
  moderate: { min_m: 2, max_m: 5, confidence_factor: 0.70, visual_reliable: true, photography_reliable: false, ndt_access: "full_but_slow", label: "Moderate (2-5m)" },
  poor: { min_m: 1, max_m: 2, confidence_factor: 0.45, visual_reliable: false, photography_reliable: false, ndt_access: "contact_only", label: "Poor (1-2m)" },
  very_poor: { min_m: 0, max_m: 1, confidence_factor: 0.20, visual_reliable: false, photography_reliable: false, ndt_access: "severely_limited", label: "Very Poor (<1m)" },
  zero: { min_m: 0, max_m: 0, confidence_factor: 0.05, visual_reliable: false, photography_reliable: false, ndt_access: "tactile_only", label: "Zero Visibility" }
};

var CURRENT_IMPACT = {
  slack: { max_kts: 0.3, confidence_factor: 1.0, diver_stability: "excellent", ndt_quality: "optimal", work_rate: 1.0, label: "Slack (<0.3 kts)" },
  light: { max_kts: 0.7, confidence_factor: 0.92, diver_stability: "good", ndt_quality: "good", work_rate: 0.9, label: "Light (0.3-0.7 kts)" },
  moderate: { max_kts: 1.0, confidence_factor: 0.78, diver_stability: "fair", ndt_quality: "reduced", work_rate: 0.7, label: "Moderate (0.7-1.0 kts)" },
  strong: { max_kts: 1.5, confidence_factor: 0.50, diver_stability: "poor", ndt_quality: "significantly_reduced", work_rate: 0.4, label: "Strong (1.0-1.5 kts)" },
  very_strong: { min_kts: 1.5, confidence_factor: 0.15, diver_stability: "dangerous", ndt_quality: "unreliable", work_rate: 0.1, label: "Very Strong (>1.5 kts)" }
};

var DEPTH_IMPACT = {
  shallow: { max_m: 10, confidence_factor: 1.0, dive_mode: "scuba_or_surface_supplied_air", bottom_time: "extended", label: "Shallow (<10m)" },
  air_range: { max_m: 50, confidence_factor: 0.92, dive_mode: "surface_supplied_air", bottom_time: "decompression_limits_apply", label: "Air Range (10-50m)" },
  mixed_gas: { max_m: 100, confidence_factor: 0.82, dive_mode: "surface_supplied_mixed_gas", bottom_time: "limited_by_decompression", label: "Mixed Gas (50-100m)" },
  saturation: { min_m: 100, confidence_factor: 0.70, dive_mode: "saturation_diving", bottom_time: "unlimited_in_sat_but_task_limited", label: "Saturation (>100m)" }
};

var SEA_STATE_IMPACT = {
  calm: { max_hs_m: 0.5, confidence_factor: 1.0, dive_operations: "all_permitted", label: "Calm (<0.5m Hs)" },
  slight: { max_hs_m: 1.25, confidence_factor: 0.95, dive_operations: "all_permitted", label: "Slight (0.5-1.25m Hs)" },
  moderate: { max_hs_m: 2.0, confidence_factor: 0.85, dive_operations: "most_permitted_caution", label: "Moderate (1.25-2.0m Hs)" },
  rough: { max_hs_m: 3.0, confidence_factor: 0.60, dive_operations: "limited_surface_supplied_only", label: "Rough (2.0-3.0m Hs)" },
  very_rough: { min_hs_m: 3.0, confidence_factor: 0.20, dive_operations: "suspended_except_sat_bell", label: "Very Rough (>3.0m Hs)" }
};

// ============================================================
// INSPECTION QUALITY CLASSIFICATION
// ============================================================

var QUALITY_LEVELS = {
  full_confidence: { min_factor: 0.80, label: "Full Confidence", description: "Conditions support high-quality inspection. Results are reliable.", action: "Proceed with all planned inspection methods." },
  acceptable: { min_factor: 0.60, label: "Acceptable", description: "Conditions adequate for most inspection tasks. Some quality reduction expected.", action: "Proceed but note condition limitations in report." },
  limited: { min_factor: 0.40, label: "Limited Confidence", description: "Conditions significantly impact inspection quality. Results should be treated as preliminary.", action: "Perform what is possible. Plan follow-up inspection in better conditions." },
  marginal: { min_factor: 0.20, label: "Marginal", description: "Conditions barely adequate. Only gross features detectable. NDT unreliable.", action: "General survey only. No quantitative measurements. Plan re-inspection." },
  inadequate: { min_factor: 0.0, label: "Inadequate", description: "Conditions do not support meaningful inspection. Results would be misleading.", action: "ABORT inspection. Wait for improved conditions. Do not report findings as valid." }
};

// ============================================================
// CORE FUNCTIONS
// ============================================================

function classifyCondition(key, value, lookup) {
  var keys = Object.keys(lookup);
  for (var i = keys.length - 1; i >= 0; i--) {
    var entry = lookup[keys[i]];
    if (entry.min_m !== undefined && value < entry.min_m) continue;
    if (entry.max_m !== undefined && value > entry.max_m) continue;
    if (entry.min_kts !== undefined && value < entry.min_kts) continue;
    if (entry.max_kts !== undefined && value > entry.max_kts) continue;
    if (entry.max_hs_m !== undefined && value > entry.max_hs_m) continue;
    if (entry.min_hs_m !== undefined && value < entry.min_hs_m) continue;
    return { class: keys[i], label: entry.label, factor: entry.confidence_factor, details: entry };
  }
  return { class: "unknown", label: "Unknown", factor: 0.5, details: {} };
}

function evaluateConditions(input) {
  var vis_m = input.visibility_m !== undefined ? input.visibility_m : 5;
  var current_kts = input.current_kts !== undefined ? input.current_kts : 0.5;
  var depth_m = input.depth_m !== undefined ? input.depth_m : 20;
  var sea_state_hs = input.sea_state_hs_m !== undefined ? input.sea_state_hs_m : 1.0;
  var cleaned = input.marine_growth_cleaned || false;

  var visResult = { class: "unknown", factor: 0.5 };
  if (vis_m >= 10) visResult = { class: "excellent", factor: 0.95 };
  else if (vis_m >= 5) visResult = { class: "good", factor: 0.85 };
  else if (vis_m >= 2) visResult = { class: "moderate", factor: 0.70 };
  else if (vis_m >= 1) visResult = { class: "poor", factor: 0.45 };
  else if (vis_m > 0) visResult = { class: "very_poor", factor: 0.20 };
  else visResult = { class: "zero", factor: 0.05 };

  var curResult = { class: "unknown", factor: 0.5 };
  if (current_kts <= 0.3) curResult = { class: "slack", factor: 1.0 };
  else if (current_kts <= 0.7) curResult = { class: "light", factor: 0.92 };
  else if (current_kts <= 1.0) curResult = { class: "moderate", factor: 0.78 };
  else if (current_kts <= 1.5) curResult = { class: "strong", factor: 0.50 };
  else curResult = { class: "very_strong", factor: 0.15 };

  var depResult = { class: "unknown", factor: 0.5 };
  if (depth_m <= 10) depResult = { class: "shallow", factor: 1.0, dive_mode: "scuba_or_surface_supplied" };
  else if (depth_m <= 50) depResult = { class: "air_range", factor: 0.92, dive_mode: "surface_supplied_air" };
  else if (depth_m <= 100) depResult = { class: "mixed_gas", factor: 0.82, dive_mode: "mixed_gas" };
  else depResult = { class: "saturation", factor: 0.70, dive_mode: "saturation" };

  var seaResult = { class: "unknown", factor: 0.5 };
  if (sea_state_hs <= 0.5) seaResult = { class: "calm", factor: 1.0 };
  else if (sea_state_hs <= 1.25) seaResult = { class: "slight", factor: 0.95 };
  else if (sea_state_hs <= 2.0) seaResult = { class: "moderate", factor: 0.85 };
  else if (sea_state_hs <= 3.0) seaResult = { class: "rough", factor: 0.60 };
  else seaResult = { class: "very_rough", factor: 0.20 };

  var cleanFactor = cleaned ? 1.0 : 0.5;

  var combined = visResult.factor * curResult.factor * depResult.factor * seaResult.factor * cleanFactor;
  combined = Math.round(combined * 100) / 100;

  var qualityLevel = "inadequate";
  if (combined >= 0.80) qualityLevel = "full_confidence";
  else if (combined >= 0.60) qualityLevel = "acceptable";
  else if (combined >= 0.40) qualityLevel = "limited";
  else if (combined >= 0.20) qualityLevel = "marginal";

  var qualityDef = QUALITY_LEVELS[qualityLevel];

  var limitingFactor = "none";
  var lowestFactor = 1.0;
  if (visResult.factor < lowestFactor) { lowestFactor = visResult.factor; limitingFactor = "visibility"; }
  if (curResult.factor < lowestFactor) { lowestFactor = curResult.factor; limitingFactor = "current"; }
  if (depResult.factor < lowestFactor) { lowestFactor = depResult.factor; limitingFactor = "depth"; }
  if (seaResult.factor < lowestFactor) { lowestFactor = seaResult.factor; limitingFactor = "sea_state"; }
  if (cleanFactor < lowestFactor) { lowestFactor = cleanFactor; limitingFactor = "marine_growth_not_cleaned"; }

  var recommendations = [];
  if (visResult.class === "very_poor" || visResult.class === "zero") recommendations.push("Visibility too poor for meaningful inspection. Wait for improved conditions.");
  if (curResult.class === "very_strong") recommendations.push("Current too strong. Wait for slack water window.");
  if (curResult.class === "strong") recommendations.push("Strong current — contact NDT unreliable. Use ACFM if crack detection needed.");
  if (!cleaned) recommendations.push("Clean marine growth before inspection for reliable results.");
  if (seaResult.class === "very_rough") recommendations.push("Sea state too rough for dive operations. Stand by.");
  if (seaResult.class === "rough") recommendations.push("Rough seas — limit to essential inspection only.");
  if (qualityLevel === "inadequate") recommendations.push("DO NOT PROCEED — conditions inadequate for valid inspection.");

  return {
    conditions: {
      visibility: { value_m: vis_m, class: visResult.class, factor: visResult.factor },
      current: { value_kts: current_kts, class: curResult.class, factor: curResult.factor },
      depth: { value_m: depth_m, class: depResult.class, factor: depResult.factor, dive_mode: depResult.dive_mode || null },
      sea_state: { value_hs_m: sea_state_hs, class: seaResult.class, factor: seaResult.factor },
      marine_growth_cleaned: cleaned, cleaning_factor: cleanFactor
    },
    combined_confidence_factor: combined,
    quality_level: qualityLevel,
    quality_description: qualityDef.description,
    quality_action: qualityDef.action,
    limiting_factor: limitingFactor,
    lowest_individual_factor: lowestFactor,
    recommendations: recommendations,
    assumptions_for_mesh: {
      inspection_coverage: combined >= 0.60 ? "adequate" : (combined >= 0.40 ? "limited" : "visual_only"),
      coating_condition: combined < 0.40 ? "unknown_poor_inspection_conditions" : "assessable",
      cp_effectiveness: combined < 0.30 ? "unknown_conditions_too_poor" : "assessable"
    },
    klein_bottle_note: "Inspection conditions determine what you can know about the asset. Poor visibility means coating condition is unknown. Unknown coating means CP demand is uncertain. Uncertain CP means corrosion rate is uncertain. The dive conditions propagate through every engine in the mesh."
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
    if (action === "get_registry") { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, deploy: DEPLOY, mode: "deterministic", purpose: "Subsea Inspection Conditions — visibility, current, depth, sea state as confidence modifiers", visibility_classes: Object.keys(VISIBILITY_IMPACT).length, current_classes: Object.keys(CURRENT_IMPACT).length, depth_classes: Object.keys(DEPTH_IMPACT).length, quality_levels: Object.keys(QUALITY_LEVELS).length, actions: ["evaluate_conditions", "get_condition_database", "get_quality_levels", "get_registry"] }) }; }
    if (action === "evaluate_conditions") {
      var condResult = evaluateConditions(body);
      try { var sb = createClient(supabaseUrl, supabaseKey); await sb.from("subsea_inspection_conditions").insert({ org_id: body.org_id || null, case_id: body.case_id || null, visibility_m: body.visibility_m || null, current_kts: body.current_kts || null, depth_m: body.depth_m || null, quality_level: condResult.quality_level, combined_factor: condResult.combined_confidence_factor, result_json: condResult }); } catch (e) {}
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: condResult }, null, 2) };
    }
    if (action === "get_condition_database") { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, visibility: VISIBILITY_IMPACT, current: CURRENT_IMPACT, depth: DEPTH_IMPACT, sea_state: SEA_STATE_IMPACT }, null, 2) }; }
    if (action === "get_quality_levels") { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, levels: QUALITY_LEVELS }, null, 2) }; }
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
  } catch (err) { return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) }; }
};
