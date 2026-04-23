// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var ENGINE_ID = "underwater-ndt-authority";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY295";
var corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };

var UNDERWATER_NDT_METHODS = {
  underwater_visual: { method: "Underwater Visual Inspection", surface_confidence: 0.85, underwater_confidence_base: 0.55, standards: ["IMCA D 045", "NORSOK N-005"], capabilities: ["general_condition_survey", "marine_growth_assessment", "gross_damage_detection", "CP_anode_visual", "coating_condition_gross"], limitations: ["resolution_limited_by_visibility", "color_distortion_at_depth", "lighting_dependent", "marine_growth_masks_surface"], visibility_modifiers: { excellent: 0.80, good: 0.70, moderate: 0.55, poor: 0.35, very_poor: 0.15 }, current_modifiers: { slack: 1.0, light: 0.95, moderate: 0.85, strong: 0.65, very_strong: 0.30 }, depth_modifiers: { shallow: 1.0, air_range: 0.95, mixed_gas: 0.90, saturation: 0.70 }, cleaning_required: true },
  underwater_ut: { method: "Underwater Ultrasonic Testing", surface_confidence: 0.90, underwater_confidence_base: 0.72, standards: ["BS EN ISO 17640", "IMCA D 045"], capabilities: ["wall_thickness_measurement", "crack_detection_TOFD_PAUT", "lamination_detection", "weld_inspection"], limitations: ["coupling_difficult_in_current", "surface_prep_required", "marine_growth_must_be_removed", "diver_stability_affects_accuracy"], visibility_modifiers: { excellent: 0.95, good: 0.90, moderate: 0.85, poor: 0.75, very_poor: 0.65 }, current_modifiers: { slack: 1.0, light: 0.90, moderate: 0.75, strong: 0.50, very_strong: 0.20 }, depth_modifiers: { shallow: 1.0, air_range: 0.95, mixed_gas: 0.85, saturation: 0.65 }, cleaning_required: true, surface_prep: "Sa 2.5 at measurement point" },
  underwater_mpi: { method: "Underwater MPI (Wet Fluorescent)", surface_confidence: 0.88, underwater_confidence_base: 0.65, standards: ["BS EN ISO 17638", "IMCA D 045", "AWS D3.6M"], capabilities: ["surface_breaking_crack_detection", "weld_toe_crack_detection", "fatigue_crack_detection"], limitations: ["fluorescent_particles_dispersed_by_current", "UV_light_reduced_by_turbidity", "surface_prep_critical", "cold_water_reduces_particle_mobility"], visibility_modifiers: { excellent: 0.85, good: 0.80, moderate: 0.70, poor: 0.45, very_poor: 0.20 }, current_modifiers: { slack: 1.0, light: 0.85, moderate: 0.60, strong: 0.30, very_strong: 0.10 }, depth_modifiers: { shallow: 1.0, air_range: 0.90, mixed_gas: 0.80, saturation: 0.55 }, cleaning_required: true, surface_prep: "Sa 2.5 minimum" },
  underwater_acfm: { method: "Underwater ACFM", surface_confidence: 0.85, underwater_confidence_base: 0.75, standards: ["BS 7910 Annex T", "DNVGL-RP-C210"], capabilities: ["crack_detection_through_coating", "crack_sizing_length_and_depth", "weld_toe_inspection", "fatigue_crack_monitoring"], limitations: ["requires_calibration_for_material", "geometry_dependent", "non_ferromagnetic_not_effective"], visibility_modifiers: { excellent: 0.95, good: 0.92, moderate: 0.88, poor: 0.82, very_poor: 0.70 }, current_modifiers: { slack: 1.0, light: 0.95, moderate: 0.85, strong: 0.70, very_strong: 0.45 }, depth_modifiers: { shallow: 1.0, air_range: 0.95, mixed_gas: 0.90, saturation: 0.75 }, cleaning_required: false, surface_prep: "Light cleaning only — works through coatings up to 5mm" },
  underwater_cp_survey: { method: "Underwater CP Potential Survey", surface_confidence: 0.80, underwater_confidence_base: 0.70, standards: ["DNV-RP-B401", "NACE SP0176"], capabilities: ["protection_potential_measurement", "anode_condition_assessment", "anode_depletion_measurement"], limitations: ["marine_growth_affects_readings", "proximity_to_anodes_affects_readings", "reference_electrode_calibration_critical"], visibility_modifiers: { excellent: 0.95, good: 0.92, moderate: 0.88, poor: 0.80, very_poor: 0.70 }, current_modifiers: { slack: 1.0, light: 0.95, moderate: 0.90, strong: 0.80, very_strong: 0.65 }, depth_modifiers: { shallow: 1.0, air_range: 0.95, mixed_gas: 0.90, saturation: 0.80 }, cleaning_required: false },
  underwater_fmd: { method: "Flooded Member Detection", surface_confidence: 0.0, underwater_confidence_base: 0.88, standards: ["IMCA D 045", "API RP 2A"], capabilities: ["through_wall_crack_detection_in_tubulars", "works_through_marine_growth"], limitations: ["tubular_members_only", "cannot_size_crack", "binary_result"], visibility_modifiers: { excellent: 1.0, good: 1.0, moderate: 1.0, poor: 0.95, very_poor: 0.90 }, current_modifiers: { slack: 1.0, light: 1.0, moderate: 0.95, strong: 0.85, very_strong: 0.70 }, depth_modifiers: { shallow: 1.0, air_range: 1.0, mixed_gas: 0.95, saturation: 0.85 }, cleaning_required: false },
  underwater_photography: { method: "Underwater Photography / Video", surface_confidence: 0.80, underwater_confidence_base: 0.50, standards: ["IMCA D 045"], capabilities: ["permanent_record", "remote_review", "damage_documentation"], limitations: ["backscatter", "color_loss_with_depth", "lighting_critical", "scale_reference_needed"], visibility_modifiers: { excellent: 0.80, good: 0.70, moderate: 0.50, poor: 0.25, very_poor: 0.10 }, current_modifiers: { slack: 1.0, light: 0.90, moderate: 0.75, strong: 0.50, very_strong: 0.20 }, depth_modifiers: { shallow: 1.0, air_range: 0.90, mixed_gas: 0.80, saturation: 0.55 }, cleaning_required: true }
};

function classifyVis(v) { if (v >= 10) return "excellent"; if (v >= 5) return "good"; if (v >= 2) return "moderate"; if (v >= 1) return "poor"; return "very_poor"; }
function classifyCur(c) { if (c <= 0.3) return "slack"; if (c <= 0.7) return "light"; if (c <= 1.0) return "moderate"; if (c <= 1.5) return "strong"; return "very_strong"; }
function classifyDep(d) { if (d <= 10) return "shallow"; if (d <= 50) return "air_range"; if (d <= 100) return "mixed_gas"; return "saturation"; }

function evaluateUnderwaterNDT(input) {
  var method = input.method || "underwater_visual";
  var vis = input.visibility_m || 5;
  var cur = input.current_kts || 0.5;
  var dep = input.depth_m || 20;
  var cleaned = input.marine_growth_cleaned || false;
  var m = UNDERWATER_NDT_METHODS[method];
  if (!m) return { error: "Unknown method. Available: " + Object.keys(UNDERWATER_NDT_METHODS).join(", ") };
  var vc = classifyVis(vis); var cc = classifyCur(cur); var dc = classifyDep(dep);
  var vf = m.visibility_modifiers[vc] || 0.5;
  var cf = m.current_modifiers[cc] || 0.5;
  var df = m.depth_modifiers[dc] || 0.5;
  var cleanPenalty = (m.cleaning_required && !cleaned) ? 0.4 : 1.0;
  var conf = Math.round(m.underwater_confidence_base * vf * cf * df * cleanPenalty * 100) / 100;
  var delta = Math.round((m.surface_confidence - conf) * 100);
  var feasible = true; var notes = [];
  if (cc === "very_strong") { notes.push("Current too strong for " + m.method); if (method === "underwater_mpi") feasible = false; }
  if (vc === "very_poor" && method === "underwater_visual") { notes.push("Visibility too poor for visual"); feasible = false; }
  if (m.cleaning_required && !cleaned) notes.push("Clean marine growth first");
  var rec = !feasible ? "do_not_proceed" : (conf < 0.3 ? "results_unreliable" : (conf < 0.5 ? "proceed_with_caution" : (conf < 0.7 ? "acceptable" : "proceed")));
  return { method: method, method_name: m.method, conditions: { visibility_m: vis, visibility_class: vc, current_kts: cur, current_class: cc, depth_m: dep, depth_class: dc, cleaned: cleaned }, confidence: { surface: m.surface_confidence, underwater_base: m.underwater_confidence_base, adjusted: conf, vis_factor: vf, cur_factor: cf, dep_factor: df, clean_penalty: cleanPenalty, loss_vs_surface_percent: delta }, feasibility: { feasible: feasible, recommendation: rec, notes: notes }, capabilities: m.capabilities, limitations: m.limitations, standards: m.standards, surface_prep: m.surface_prep || null };
}

function selectBestMethod(input) {
  var task = input.task || "crack_detection";
  var vis = input.visibility_m || 5; var cur = input.current_kts || 0.5; var dep = input.depth_m || 20; var cleaned = input.marine_growth_cleaned || false;
  var candidates = []; var methods = Object.keys(UNDERWATER_NDT_METHODS);
  for (var i = 0; i < methods.length; i++) {
    var m = UNDERWATER_NDT_METHODS[methods[i]]; var hasCap = false;
    for (var c = 0; c < m.capabilities.length; c++) { if (m.capabilities[c].indexOf(task) >= 0) { hasCap = true; break; } }
    if (!hasCap) continue;
    var r = evaluateUnderwaterNDT({ method: methods[i], visibility_m: vis, current_kts: cur, depth_m: dep, marine_growth_cleaned: cleaned });
    if (r.feasibility && r.feasibility.feasible) { candidates.push({ method: methods[i], name: m.method, confidence: r.confidence.adjusted, cleaning_required: m.cleaning_required }); }
  }
  candidates.sort(function(a, b) { return b.confidence - a.confidence; });
  return { task: task, conditions: { visibility_m: vis, current_kts: cur, depth_m: dep, cleaned: cleaned }, ranked: candidates, best: candidates.length > 0 ? candidates[0] : null };
}

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };
  try {
    var body = JSON.parse(event.body || "{}"); var action = body.action || "get_registry";
    if (action === "get_registry") { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, deploy: DEPLOY, mode: "deterministic", purpose: "Underwater NDT Authority — method confidence, capabilities, condition modifiers", methods: Object.keys(UNDERWATER_NDT_METHODS).length, actions: ["evaluate_method", "select_best_method", "get_method_database", "get_registry"] }) }; }
    if (action === "evaluate_method") { var er = evaluateUnderwaterNDT(body); try { var sb = createClient(supabaseUrl, supabaseKey); await sb.from("underwater_ndt_assessments").insert({ org_id: body.org_id || null, case_id: body.case_id || null, method: body.method || "unknown", confidence: er.confidence ? er.confidence.adjusted : null, result_json: er }); } catch (e) {} return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: er }, null, 2) }; }
    if (action === "select_best_method") { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: selectBestMethod(body) }, null, 2) }; }
    if (action === "get_method_database") { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, methods: UNDERWATER_NDT_METHODS }, null, 2) }; }
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
  } catch (err) { return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) }; }
};
