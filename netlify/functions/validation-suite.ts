// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var ENGINE_ID = "validation-suite";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY292";
var corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };

var BENCHMARK_CASES = {
  weld_001: { id: "weld_001", domain: "weld", name: "Porosity in Non-Critical Fillet Weld", input: { defect_type: "porosity", weld_type: "fillet", size_mm: 2, wall_thickness_mm: 12, code: "AWS_D1.1", service: "static_non_critical" }, expected: { disposition: "accept", confidence_min: 0.80, decision_mode: "authority" }, expert_source: "CWI Level III consensus" },
  weld_002: { id: "weld_002", domain: "weld", name: "Incomplete Fusion in Pressure Vessel", input: { defect_type: "incomplete_fusion", weld_type: "butt", size_mm: 5, wall_thickness_mm: 20, code: "ASME_IX", service: "pressure_containment" }, expected: { disposition: "reject", confidence_min: 0.90, decision_mode: "authority" }, expert_source: "ASME IX mandatory rejection" },
  weld_003: { id: "weld_003", domain: "weld", name: "Crack in Sour Service Pipeline", input: { defect_type: "crack", weld_type: "butt", size_mm: 1, wall_thickness_mm: 15, code: "API_1104", service: "sour_service" }, expected: { disposition: "reject", confidence_min: 0.95, decision_mode: "locked" }, expert_source: "NACE MR0175 + API 1104" },
  coating_001: { id: "coating_001", domain: "coating", name: "Ballast Tank Coating GOOD", input: { coating_system: "epoxy", zone: "ballast_tanks", condition: "intact", dft_measured_um: 320, dft_specified_um: 300, age_years: 5 }, expected: { disposition: "acceptable", coating_rating: "GOOD", confidence_min: 0.85 }, expert_source: "IACS coating guidelines" },
  coating_002: { id: "coating_002", domain: "coating", name: "Splash Zone Coating Failure", input: { coating_system: "epoxy", zone: "splash", condition: "failed", area_affected_percent: 40, corrosion_visible: true }, expected: { disposition: "unacceptable", coating_rating: "POOR", corrosion_risk: "very_high" }, expert_source: "NACE SP0188 + ISO 12944" },
  corrosion_001: { id: "corrosion_001", domain: "corrosion", name: "General Corrosion — Failed Coating + CP", input: { material: "carbon_steel", environment: "seawater", coating: "failed", cp: "effective" }, expected: { mechanism: "general_corrosion", rate_mm_yr_range: { min: 0.1, max: 0.3 } }, expert_source: "DNV RP B401" },
  corrosion_002: { id: "corrosion_002", domain: "corrosion", name: "Pitting — Stagnant Seawater No CP", input: { material: "carbon_steel", environment: "seawater_stagnant", coating: "failed", cp: "ineffective" }, expected: { mechanism: "pitting", rate_mm_yr_range: { min: 0.5, max: 2.0 } }, expert_source: "API 571" },
  subsea_001: { id: "subsea_001", domain: "subsea", name: "Jacket Splash Zone Unprotected", input: { asset_type: "jacket", zone: "splash", coating_condition: "failed", cp_status: "ineffective", structural_role: "primary", age_years: 22 }, expected: { risk_level: "critical", consequence: "catastrophic", protection_state: "unprotected" }, expert_source: "ISO 19902 + DNV RP B401" },
  subsea_002: { id: "subsea_002", domain: "subsea", name: "Pipeline Free Span VIV", input: { asset_type: "pipeline", zone: "submerged", damage_description: "free span 12m", coating_condition: "intact", cp_status: "effective" }, expected: { risk_level: "high", primary_concern: "VIV_fatigue" }, expert_source: "DNV RP F105" },
  vessel_001: { id: "vessel_001", domain: "vessel", name: "Bulk Carrier Below Renewal", input: { vessel_type: "bulk_carrier", vessel_zone: "ballast_tanks", wall_thickness_mm: 8, original_thickness_mm: 14, coating_condition: "failed", damage_type: "corrosion_wastage" }, expected: { structural_status: "below_renewal_threshold", operational_decision: "PROCEED TO REPAIR" }, expert_source: "IACS CSR-BC" },
  vessel_002: { id: "vessel_002", domain: "vessel", name: "FPSO Collision", input: { vessel_type: "fpso", vessel_zone: "waterline", damage_type: "collision_damage" }, expected: { operational_decision: "EMERGENCY", urgency: "emergency" }, expert_source: "SOLAS" },
  stability_001: { id: "stability_001", domain: "stability", name: "Tanker GM Below Minimum", input: { vessel_category: "cargo_transport", gm_m: 0.10, loading_condition: "partial_load", slack_tanks: 4, fse_correction_m: 0.03 }, expected: { overall_status: "unsafe", operational_decision: "do_not_sail" }, expert_source: "IMO IS Code" },
  cross_001: { id: "cross_001", domain: "cross_domain", name: "Coating→CP→Corrosion→Fatigue Chain", input: { asset_type: "jacket", zone: "submerged", coating_condition: "failed", cp_status: "marginal", wall_thickness_mm: 16, original_thickness_mm: 20, fatigue_damage_ratio: 0.6, structural_role: "primary", age_years: 18 }, expected: { naive_risk: "moderate", converged_risk: "high_or_critical", convergence_matters: true }, expert_source: "Klein bottle convergence proof" },
  cross_002: { id: "cross_002", domain: "cross_domain", name: "Anchor Drag Cascade", input: { asset_type: "pipeline", zone: "submerged", external_event: "anchor_drag", coating_condition: "failed", dent_depth_mm: 15, member_diameter_mm: 500 }, expected: { naive_risk: "moderate", converged_risk: "high", convergence_matters: true }, expert_source: "Klein bottle convergence proof" },
  cross_003: { id: "cross_003", domain: "cross_domain", name: "H2S Through-Wall Hydrogen", input: { asset_type: "pipeline", zone: "internal", internal_fluid: "sour_service", coating_condition: "failed", cp_status: "effective", wall_thickness_mm: 10, original_thickness_mm: 12 }, expected: { convergence_matters: true, key_interaction: "hydrogen_diffusion_through_wall" }, expert_source: "Klein bottle hydrogen diffusion" }
};

function runBenchmark(caseId) {
  var bc = BENCHMARK_CASES[caseId];
  if (!bc) return { error: "Unknown case. Available: " + Object.keys(BENCHMARK_CASES).join(", ") };
  return { case_id: bc.id, domain: bc.domain, name: bc.name, input: bc.input, expected_outcome: bc.expected, expert_source: bc.expert_source, status: "ready_for_comparison" };
}

function runAllBenchmarks() {
  var results = []; var keys = Object.keys(BENCHMARK_CASES);
  for (var i = 0; i < keys.length; i++) { var c = BENCHMARK_CASES[keys[i]]; results.push({ case_id: c.id, domain: c.domain, name: c.name, convergence_matters: c.expected.convergence_matters || false }); }
  return { total_cases: results.length, cases: results };
}

function validateResult(caseId, actualOutput) {
  var bc = BENCHMARK_CASES[caseId];
  if (!bc) return { error: "Unknown case" };
  var expected = bc.expected; var findings = []; var pass = true;
  if (expected.disposition && actualOutput.disposition) { if (actualOutput.disposition !== expected.disposition) { findings.push({ field: "disposition", expected: expected.disposition, actual: actualOutput.disposition, status: "MISMATCH" }); pass = false; } else { findings.push({ field: "disposition", status: "MATCH" }); } }
  if (expected.operational_decision && actualOutput.operational_decision) { if (actualOutput.operational_decision !== expected.operational_decision) { findings.push({ field: "operational_decision", expected: expected.operational_decision, actual: actualOutput.operational_decision, status: "MISMATCH" }); pass = false; } else { findings.push({ field: "operational_decision", status: "MATCH" }); } }
  if (expected.risk_level && actualOutput.risk_level) { if (actualOutput.risk_level !== expected.risk_level) { findings.push({ field: "risk_level", expected: expected.risk_level, actual: actualOutput.risk_level, status: "MISMATCH" }); pass = false; } else { findings.push({ field: "risk_level", status: "MATCH" }); } }
  if (expected.overall_status && actualOutput.overall_status) { if (actualOutput.overall_status !== expected.overall_status) { findings.push({ field: "overall_status", expected: expected.overall_status, actual: actualOutput.overall_status, status: "MISMATCH" }); pass = false; } else { findings.push({ field: "overall_status", status: "MATCH" }); } }
  return { case_id: caseId, case_name: bc.name, domain: bc.domain, pass: pass, findings: findings, expert_source: bc.expert_source };
}

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };
  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";
    if (action === "get_registry") { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, deploy: DEPLOY, mode: "deterministic", purpose: "Validation Suite — benchmark cases with known correct outcomes", total_benchmark_cases: Object.keys(BENCHMARK_CASES).length, actions: ["run_benchmark", "run_all_benchmarks", "validate_result", "get_case_list", "get_registry"] }) }; }
    if (action === "run_benchmark") { if (!body.case_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) }; return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: runBenchmark(body.case_id) }, null, 2) }; }
    if (action === "run_all_benchmarks") { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: runAllBenchmarks() }, null, 2) }; }
    if (action === "validate_result") { if (!body.case_id || !body.actual_output) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id and actual_output required" }) }; var vr = validateResult(body.case_id, body.actual_output); try { var sb = createClient(supabaseUrl, supabaseKey); await sb.from("validation_results").insert({ case_id: body.case_id, domain: vr.domain, pass: vr.pass, findings: vr.findings, result_json: vr }); } catch (e) {} return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: vr }, null, 2) }; }
    if (action === "get_case_list") { var list = []; var keys = Object.keys(BENCHMARK_CASES); for (var i = 0; i < keys.length; i++) { list.push({ id: BENCHMARK_CASES[keys[i]].id, domain: BENCHMARK_CASES[keys[i]].domain, name: BENCHMARK_CASES[keys[i]].name }); } return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, cases: list }, null, 2) }; }
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
  } catch (err) { return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) }; }
};
