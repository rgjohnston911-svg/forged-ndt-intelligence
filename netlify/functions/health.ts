// @ts-nocheck
/**
 * DEPLOY225 - health.ts
 * netlify/functions/health.ts
 *
 * PRODUCTION HEALTH CHECK — 101 ENGINES
 *
 * POST /api/health {}         -> full health check
 * POST /api/health {quick:true} -> fast DB-only check
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var SYSTEM_VERSION = "FORGED-NDT/2.0.0";
var BUILD_DATE = "2026-04-23";
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
var CRITICAL_TABLES = [
  { name: "inspection_cases", deploy: "core", critical: true },
  { name: "findings", deploy: "core", critical: true },
  { name: "evidence", deploy: "core", critical: true },
  { name: "code_sets", deploy: "DEPLOY222", critical: false },
  { name: "audit_events", deploy: "DEPLOY223", critical: false },
  { name: "audit_bundles", deploy: "DEPLOY223", critical: false },
  { name: "org_signing_keys", deploy: "DEPLOY223", critical: false },
  { name: "inspector_adjudications", deploy: "DEPLOY226", critical: false },
  { name: "reasoning_sessions", deploy: "DEPLOY265", critical: false },
  { name: "learning_records", deploy: "DEPLOY265", critical: false },
  { name: "hypothesis_tracking", deploy: "DEPLOY265", critical: false },
  { name: "calibration_scores", deploy: "DEPLOY265", critical: false },
  { name: "adversarial_challenges", deploy: "DEPLOY265", critical: false },
  { name: "inspection_plans", deploy: "DEPLOY266", critical: false },
  { name: "workpack_items", deploy: "DEPLOY266", critical: false },
  { name: "corrosion_loops", deploy: "DEPLOY267", critical: false },
  { name: "corrosion_rate_history", deploy: "DEPLOY267", critical: false },
  { name: "fatigue_assessments", deploy: "DEPLOY268", critical: false },
  { name: "vibration_assessments", deploy: "DEPLOY268", critical: false },
  { name: "asset_graphs", deploy: "DEPLOY269", critical: false },
  { name: "cascade_scenarios", deploy: "DEPLOY269", critical: false },
  { name: "asset_interactions", deploy: "DEPLOY269", critical: false },
  { name: "code_authority_registry", deploy: "DEPLOY270", critical: false },
  { name: "code_authority_lookups", deploy: "DEPLOY270", critical: false },
  { name: "superbrain_reports", deploy: "DEPLOY271", critical: false },
  { name: "evidence_contracts", deploy: "DEPLOY273", critical: false },
  { name: "coating_assessments", deploy: "DEPLOY274", critical: false },
  { name: "coating_audit_events", deploy: "DEPLOY274", critical: false },
  { name: "uncertainty_records", deploy: "DEPLOY276", critical: false },
  { name: "decision_audit_log", deploy: "DEPLOY277", critical: false },
  { name: "interaction_mesh_results", deploy: "DEPLOY278", critical: false },
  { name: "convergence_reports", deploy: "DEPLOY280", critical: false },
  { name: "prevention_records", deploy: "DEPLOY281", critical: false },
  { name: "fleet_exposure_mappings", deploy: "DEPLOY282", critical: false },
  { name: "prevention_effectiveness", deploy: "DEPLOY282", critical: false },
  { name: "subsea_domain_assessments", deploy: "DEPLOY283", critical: false },
  { name: "cp_assessments", deploy: "DEPLOY284", critical: false },
  { name: "marine_growth_assessments", deploy: "DEPLOY285", critical: false },
  { name: "external_interaction_events", deploy: "DEPLOY286", critical: false },
  { name: "subsea_orchestrator_results", deploy: "DEPLOY287", critical: false },
  { name: "vessel_assessments", deploy: "DEPLOY288", critical: false },
  { name: "stability_assessments", deploy: "DEPLOY289", critical: false },
  { name: "motion_assessments", deploy: "DEPLOY290", critical: false },
  { name: "vessel_orchestrator_results", deploy: "DEPLOY291", critical: false },
  { name: "validation_results", deploy: "DEPLOY292", critical: false },
  { name: "convergence_proof_results", deploy: "DEPLOY293", critical: false },
  { name: "executive_decisions", deploy: "DEPLOY294", critical: false },
  { name: "underwater_ndt_assessments", deploy: "DEPLOY295", critical: false },
  { name: "underwater_weld_assessments", deploy: "DEPLOY296", critical: false },
  { name: "subsea_inspection_conditions", deploy: "DEPLOY297", critical: false },
  { name: "process_condition_assessments", deploy: "DEPLOY298", critical: false },
  { name: "refinery_mechanism_assessments", deploy: "DEPLOY299", critical: false },
  { name: "refinery_code_authority_results", deploy: "DEPLOY300", critical: false },
  { name: "formula_categories", deploy: "DEPLOY301", critical: false },
  { name: "formula_registry", deploy: "DEPLOY301", critical: false },
  { name: "formula_execution_runs", deploy: "DEPLOY301", critical: false },
  { name: "formula_chains", deploy: "DEPLOY302", critical: false },
  { name: "formula_chain_runs", deploy: "DEPLOY302", critical: false },
  { name: "formula_decision_cards", deploy: "DEPLOY303", critical: false },
  { name: "advanced_math_engine_registry", deploy: "DEPLOY305", critical: false },
  { name: "advanced_math_engine_runs", deploy: "DEPLOY305", critical: false },
  { name: "evidence_items", deploy: "DEPLOY305", critical: false },
  { name: "mechanism_beliefs", deploy: "DEPLOY305", critical: false },
  { name: "system_graph_nodes", deploy: "DEPLOY305", critical: false },
  { name: "system_graph_edges", deploy: "DEPLOY305", critical: false },
  { name: "digital_twin_state_vectors", deploy: "DEPLOY305", critical: false },
  { name: "digital_twin_predictions", deploy: "DEPLOY305", critical: false },
  { name: "spatial_field_maps", deploy: "DEPLOY305", critical: false },
  { name: "optimization_runs", deploy: "DEPLOY305", critical: false },
  { name: "causal_models", deploy: "DEPLOY305", critical: false },
  { name: "advanced_decision_cards", deploy: "DEPLOY305", critical: false },
  { name: "apmm_orchestrator_runs", deploy: "DEPLOY311", critical: false }
];
var ENGINE_REGISTRY = [
  { name: "decision-spine", deploy: "DEPLOY220", mode: "deterministic", path: "/api/decision-spine" },
  { name: "run-authority", deploy: "DEPLOY216", mode: "hybrid", path: "/api/run-authority" },
  { name: "outcome-simulation", deploy: "DEPLOY221", mode: "deterministic", path: "/api/outcome-simulation" },
  { name: "universal-code-authority", deploy: "DEPLOY222", mode: "deterministic", path: "/api/universal-code-authority" },
  { name: "enterprise-audit", deploy: "DEPLOY223", mode: "deterministic", path: "/api/enterprise-audit" },
  { name: "verify-audit-chain", deploy: "DEPLOY223", mode: "deterministic", path: "/api/verify-audit-chain" },
  { name: "inspector-adjudication", deploy: "DEPLOY226", mode: "deterministic", path: "/api/inspector-adjudication" },
  { name: "health", deploy: "DEPLOY225", mode: "deterministic", path: "/api/health" },
  { name: "decision-core", deploy: "DEPLOY167", mode: "deterministic", path: "/api/decision-core" },
  { name: "engineering-core", deploy: "DEPLOY167", mode: "deterministic", path: "/api/engineering-core" },
  { name: "truth-engine", deploy: "DEPLOY167", mode: "deterministic", path: "/api/truth-engine" },
  { name: "planner-agent", deploy: "DEPLOY167", mode: "deterministic", path: "/api/planner-agent" },
  { name: "material-authority", deploy: "DEPLOY219", mode: "deterministic", path: "/api/material-authority" },
  { name: "composite-repair-authority", deploy: "DEPLOY218", mode: "deterministic", path: "/api/composite-repair-authority" },
  { name: "governance-matrix", deploy: "DEPLOY074", mode: "deterministic", path: "/api/governance-matrix" },
  { name: "export-audit-bundle", deploy: "DEPLOY216", mode: "deterministic", path: "/api/export-audit-bundle" },
  { name: "similar-cases", deploy: "DEPLOY200", mode: "ai_assisted", path: "/api/similar-cases" },
  { name: "run-analysis", deploy: "core", mode: "ai_assisted", path: "/api/run-analysis" },
  { name: "observation-layer", deploy: "core", mode: "ai_assisted", path: "/api/observation-layer" },
  { name: "case-search", deploy: "DEPLOY227", mode: "deterministic", path: "/api/case-search" },
  { name: "escalation-workflow", deploy: "DEPLOY228", mode: "deterministic", path: "/api/escalation-workflow" },
  { name: "trend-analytics", deploy: "DEPLOY229", mode: "deterministic", path: "/api/trend-analytics" },
  { name: "notifications", deploy: "DEPLOY230", mode: "deterministic", path: "/api/notifications" },
  { name: "compliance-matrix", deploy: "DEPLOY231", mode: "deterministic", path: "/api/compliance-matrix" },
  { name: "risk-scoring", deploy: "DEPLOY232", mode: "deterministic", path: "/api/risk-scoring" },
  { name: "inspection-report", deploy: "DEPLOY233", mode: "deterministic", path: "/api/inspection-report" },
  { name: "rbac", deploy: "DEPLOY234", mode: "deterministic", path: "/api/rbac" },
  { name: "validation-engine", deploy: "DEPLOY235", mode: "deterministic", path: "/api/validation-engine" },
  { name: "data-ingestion", deploy: "DEPLOY236", mode: "deterministic", path: "/api/data-ingestion" },
  { name: "chemical-process", deploy: "DEPLOY237", mode: "deterministic", path: "/api/chemical-process" },
  { name: "nuclear-vertical", deploy: "DEPLOY238", mode: "deterministic", path: "/api/nuclear-vertical" },
  { name: "aerospace-vertical", deploy: "DEPLOY239", mode: "deterministic", path: "/api/aerospace-vertical" },
  { name: "power-generation", deploy: "DEPLOY240", mode: "deterministic", path: "/api/power-generation" },
  { name: "maritime-offshore", deploy: "DEPLOY241", mode: "deterministic", path: "/api/maritime-offshore" },
  { name: "civil-infrastructure", deploy: "DEPLOY242", mode: "deterministic", path: "/api/civil-infrastructure" },
  { name: "space-systems", deploy: "DEPLOY243", mode: "deterministic", path: "/api/space-systems" },
  { name: "robotics-automation", deploy: "DEPLOY244", mode: "deterministic", path: "/api/robotics-automation" },
  { name: "human-intelligence", deploy: "DEPLOY245", mode: "deterministic", path: "/api/human-intelligence" },
  { name: "medical-bio", deploy: "DEPLOY246", mode: "deterministic", path: "/api/medical-bio" },
  { name: "validation-benchmark", deploy: "DEPLOY247", mode: "deterministic", path: "/api/validation-benchmark" },
  { name: "decision-traceability", deploy: "DEPLOY248", mode: "deterministic", path: "/api/decision-traceability" },
  { name: "rules-version-control", deploy: "DEPLOY249", mode: "deterministic", path: "/api/rules-version-control" },
  { name: "evidence-integrity", deploy: "DEPLOY250", mode: "deterministic", path: "/api/evidence-integrity" },
  { name: "enterprise-operations", deploy: "DEPLOY251", mode: "deterministic", path: "/api/enterprise-operations" },
  { name: "concept-intelligence-core", deploy: "DEPLOY252", mode: "deterministic", path: "/api/concept-intelligence-core" },
  { name: "concept-intelligence-v21", deploy: "DEPLOY253", mode: "deterministic", path: "/api/concept-intelligence-v21" },
  { name: "cost-reasoning-engine", deploy: "DEPLOY254", mode: "deterministic", path: "/api/cost-reasoning-engine" },
  { name: "outcome-tracking", deploy: "DEPLOY255", mode: "deterministic", path: "/api/outcome-tracking" },
  { name: "cross-case-patterns", deploy: "DEPLOY256", mode: "deterministic", path: "/api/cross-case-patterns" },
  { name: "process-data-integration", deploy: "DEPLOY257", mode: "deterministic", path: "/api/process-data-integration" },
  { name: "predictive-remaining-life", deploy: "DEPLOY258", mode: "deterministic", path: "/api/predictive-remaining-life" },
  { name: "physics-sufficiency-engine", deploy: "DEPLOY259", mode: "deterministic", path: "/api/physics-sufficiency-engine" },
  { name: "weld-acceptance-authority", deploy: "DEPLOY272", mode: "deterministic", path: "/api/weld-acceptance-authority" },
  { name: "authority-lock-system", deploy: "DEPLOY261", mode: "deterministic", path: "/api/authority-lock-system" },
  { name: "contradiction-engine", deploy: "DEPLOY262", mode: "deterministic", path: "/api/contradiction-engine" },
  { name: "repair-pathway-engine", deploy: "DEPLOY263", mode: "deterministic", path: "/api/repair-pathway-engine" },
  { name: "reality-lock-domain", deploy: "DEPLOY264", mode: "deterministic", path: "/api/reality-lock-domain" },
  { name: "tri-model-reasoning", deploy: "DEPLOY265", mode: "ai_assisted", path: "/api/tri-model-reasoning" },
  { name: "inspection-planning-proof", deploy: "DEPLOY266", mode: "deterministic", path: "/api/inspection-planning-proof" },
  { name: "corrosion-loop-engine", deploy: "DEPLOY267", mode: "deterministic", path: "/api/corrosion-loop-engine" },
  { name: "fatigue-vibration-proof", deploy: "DEPLOY268", mode: "deterministic", path: "/api/fatigue-vibration-proof" },
  { name: "multi-asset-cascade", deploy: "DEPLOY269", mode: "deterministic", path: "/api/multi-asset-cascade" },
  { name: "live-code-authority", deploy: "DEPLOY270", mode: "deterministic", path: "/api/live-code-authority" },
  { name: "superbrain-report", deploy: "DEPLOY271", mode: "ai_assisted", path: "/api/superbrain-report" },
  { name: "evidence-contract-engine", deploy: "DEPLOY273", mode: "deterministic", path: "/api/evidence-contract-engine" },
  { name: "coatings-intelligence-authority", deploy: "DEPLOY274", mode: "deterministic", path: "/api/coatings-intelligence-authority" },
  { name: "mechanism-causality-engine", deploy: "DEPLOY275", mode: "deterministic", path: "/api/mechanism-causality-engine" },
  { name: "uncertainty-boundary-engine", deploy: "DEPLOY276", mode: "deterministic", path: "/api/uncertainty-boundary-engine" },
  { name: "decision-liability-engine", deploy: "DEPLOY277", mode: "deterministic", path: "/api/decision-liability-engine" },
  { name: "interaction-mesh", deploy: "DEPLOY278", mode: "deterministic", path: "/api/interaction-mesh" },
  { name: "convergence-reporter", deploy: "DEPLOY280", mode: "deterministic", path: "/api/convergence-reporter" },
  { name: "root-cause-prevention", deploy: "DEPLOY281", mode: "deterministic", path: "/api/root-cause-prevention" },
  { name: "subsea-domain-registry", deploy: "DEPLOY283", mode: "deterministic", path: "/api/subsea-domain-registry" },
  { name: "cp-intelligence", deploy: "DEPLOY284", mode: "deterministic", path: "/api/cp-intelligence" },
  { name: "marine-growth-engine", deploy: "DEPLOY285", mode: "deterministic", path: "/api/marine-growth-engine" },
  { name: "external-interaction-engine", deploy: "DEPLOY286", mode: "deterministic", path: "/api/external-interaction-engine" },
  { name: "subsea-structures-orchestrator", deploy: "DEPLOY287", mode: "deterministic", path: "/api/subsea-structures-orchestrator" },
  { name: "vessel-class-registry", deploy: "DEPLOY288", mode: "deterministic", path: "/api/vessel-class-registry" },
  { name: "stability-engine", deploy: "DEPLOY289", mode: "deterministic", path: "/api/stability-engine" },
  { name: "vessel-motion-engine", deploy: "DEPLOY290", mode: "deterministic", path: "/api/vessel-motion-engine" },
  { name: "marine-vessel-orchestrator", deploy: "DEPLOY291", mode: "deterministic", path: "/api/marine-vessel-orchestrator" },
  { name: "validation-suite", deploy: "DEPLOY292", mode: "deterministic", path: "/api/validation-suite" },
  { name: "convergence-proof", deploy: "DEPLOY293", mode: "deterministic", path: "/api/convergence-proof" },
  { name: "executive-decision-engine", deploy: "DEPLOY294", mode: "deterministic", path: "/api/executive-decision-engine" },
  { name: "underwater-ndt-authority", deploy: "DEPLOY295", mode: "deterministic", path: "/api/underwater-ndt-authority" },
  { name: "underwater-welding-authority", deploy: "DEPLOY296", mode: "deterministic", path: "/api/underwater-welding-authority" },
  { name: "subsea-inspection-conditions", deploy: "DEPLOY297", mode: "deterministic", path: "/api/subsea-inspection-conditions" },
  { name: "process-condition-authority", deploy: "DEPLOY298", mode: "deterministic", path: "/api/process-condition-authority" },
  { name: "refinery-mechanism-authority", deploy: "DEPLOY299", mode: "deterministic", path: "/api/refinery-mechanism-authority" },
  { name: "refinery-code-authority-router", deploy: "DEPLOY300", mode: "deterministic", path: "/api/refinery-code-authority-router" },
  { name: "formula-intelligence-core", deploy: "DEPLOY301", mode: "deterministic", path: "/api/formula-intelligence-core" },
  { name: "formula-chain-executor", deploy: "DEPLOY302", mode: "deterministic", path: "/api/formula-chain-executor" },
  { name: "formula-decision-authority", deploy: "DEPLOY303", mode: "deterministic", path: "/api/formula-decision-authority" },
  { name: "multi-physics-4d-projection", deploy: "DEPLOY304", mode: "deterministic", path: "/api/multi-physics-4d-projection" },
  { name: "advanced-probability-engine", deploy: "DEPLOY305", mode: "deterministic", path: "/api/advanced-probability-engine" },
  { name: "advanced-structural-engine", deploy: "DEPLOY306", mode: "deterministic", path: "/api/advanced-structural-engine" },
  { name: "advanced-transport-engine", deploy: "DEPLOY307", mode: "deterministic", path: "/api/advanced-transport-engine" },
  { name: "advanced-spatial-graph-engine", deploy: "DEPLOY308", mode: "deterministic", path: "/api/advanced-spatial-graph-engine" },
  { name: "advanced-decision-engine", deploy: "DEPLOY309", mode: "deterministic", path: "/api/advanced-decision-engine" },
  { name: "advanced-physics-arbiter", deploy: "DEPLOY310", mode: "deterministic", path: "/api/advanced-physics-arbiter" },
  { name: "apmm-orchestrator", deploy: "DEPLOY311", mode: "deterministic", path: "/api/apmm-orchestrator" }
];
function countByMode(mode) {
  var c = 0;
  for (var i = 0; i < ENGINE_REGISTRY.length; i++) {
    if (ENGINE_REGISTRY[i].mode === mode) c++;
  }
  return c;
}
export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };
  try {
    var body = JSON.parse(event.body || "{}");
    var quick = body.quick === true;
    var startTime = Date.now();
    var checks = [];
    var errors = [];
    var warnings = [];
    var overallStatus = "healthy";
    if (!supabaseUrl) { errors.push({ code: "E020", detail: "SUPABASE_URL not set" }); overallStatus = "critical"; }
    if (!supabaseKey) { errors.push({ code: "E020", detail: "SUPABASE_SERVICE_ROLE_KEY not set" }); overallStatus = "critical"; }
    if (overallStatus === "critical") { return { statusCode: 503, headers: corsHeaders, body: JSON.stringify({ status: "critical", system: SYSTEM_VERSION, errors: errors, checked_at: new Date().toISOString(), response_ms: Date.now() - startTime }) }; }
    var sb = createClient(supabaseUrl, supabaseKey);
    var dbCheck = await sb.from("inspection_cases").select("id").limit(1);
    if (dbCheck.error) { errors.push({ code: "E001", detail: dbCheck.error.message }); overallStatus = "critical"; } else { checks.push({ name: "database_connection", status: "pass", detail: "Supabase connected" }); }
    if (quick) { return { statusCode: overallStatus === "critical" ? 503 : 200, headers: corsHeaders, body: JSON.stringify({ status: overallStatus, system: SYSTEM_VERSION, checks: checks, errors: errors, checked_at: new Date().toISOString(), response_ms: Date.now() - startTime }) }; }
    for (var ti = 0; ti < CRITICAL_TABLES.length; ti++) {
      var tbl = CRITICAL_TABLES[ti];
      var tblCheck = await sb.from(tbl.name).select("*").limit(1);
      if (tblCheck.error) {
        if (tbl.critical) { errors.push({ code: "E002", table: tbl.name, deploy: tbl.deploy, detail: tblCheck.error.message }); if (overallStatus === "healthy") overallStatus = "degraded"; }
        else { warnings.push({ code: "E002", table: tbl.name, deploy: tbl.deploy, detail: "Table not found - run " + tbl.deploy + " migration" }); }
      } else { checks.push({ name: "table_" + tbl.name, status: "pass", deploy: tbl.deploy }); }
    }
    var keyCheck = await sb.from("org_signing_keys").select("id").eq("is_active", true).limit(1);
    if (keyCheck.error || !keyCheck.data || keyCheck.data.length === 0) { warnings.push({ code: "E010", detail: "No active signing key" }); }
    else { checks.push({ name: "signing_key", status: "pass", detail: "Active key: " + keyCheck.data[0].id }); }
    var caseCount = 0;
    var recentCases = 0;
    var countCheck = await sb.from("inspection_cases").select("id", { count: "exact", head: true });
    caseCount = countCheck.count || 0;
    var sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    var recentCheck = await sb.from("inspection_cases").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo);
    recentCases = recentCheck.count || 0;
    if (errors.length > 0 && overallStatus !== "critical") overallStatus = "degraded";
    if (errors.length === 0 && warnings.length > 0) overallStatus = "healthy_with_warnings";
    return {
      statusCode: overallStatus === "critical" ? 503 : 200,
      headers: corsHeaders,
      body: JSON.stringify({
        status: overallStatus,
        system: SYSTEM_VERSION,
        build_date: BUILD_DATE,
        checked_at: new Date().toISOString(),
        response_ms: Date.now() - startTime,
        database: { connected: true, total_cases: caseCount, cases_last_7_days: recentCases },
        engines: { total: ENGINE_REGISTRY.length, deterministic: countByMode("deterministic"), ai_assisted: countByMode("ai_assisted"), hybrid: countByMode("hybrid"), registry: ENGINE_REGISTRY },
        tables: { total: CRITICAL_TABLES.length },
        checks: checks,
        errors: errors,
        warnings: warnings
      }, null, 2)
    };
  } catch (err) { return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) }; }
};
