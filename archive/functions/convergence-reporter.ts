// @ts-nocheck
/**
 * DEPLOY280 - convergence-reporter.ts
 * netlify/functions/convergence-reporter.ts
 *
 * CONVERGENCE REPORTER — Klein Bottle Report Generator
 *
 * Takes interaction mesh results and produces human-readable
 * and machine-readable convergence reports. Integrates into
 * every Superbrain report as the "interaction analysis" section.
 *
 * POST /api/convergence-reporter
 *
 * Actions:
 *   generate_report       — full convergence report from mesh results
 *   compare_naive_converged — show what the naive assessment missed
 *   get_divergence_flags   — quick check: did convergence matter?
 *   get_topology_summary   — summarize engine interconnections
 *   get_registry           — engine metadata
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
 
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
 
var ENGINE_ID = "convergence-reporter";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY280";
 
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
 
// ============================================================
// DIVERGENCE CLASSIFICATIONS
// ============================================================
// How significant is the difference between naive and converged?
// ============================================================
 
var DIVERGENCE_LEVELS = [
  {
    level: "critical_divergence",
    min_delta: 0.50,
    label: "CRITICAL DIVERGENCE",
    description: "Naive single-pass assessment is dangerously non-conservative. Multiple cross-domain interactions fundamentally change the risk picture. Klein bottle convergence is mandatory.",
    action: "STOP — do not use naive assessment. Converged result required for any decision.",
    confidence_penalty: 0.30
  },
  {
    level: "significant_divergence",
    min_delta: 0.30,
    label: "SIGNIFICANT DIVERGENCE",
    description: "Cross-domain interactions materially change the assessment. Naive result underestimates risk in at least one domain.",
    action: "Use converged result only. Flag interaction effects in report.",
    confidence_penalty: 0.20
  },
  {
    level: "moderate_divergence",
    min_delta: 0.15,
    label: "MODERATE DIVERGENCE",
    description: "Some cross-domain effects detected. Naive result is directionally correct but misses compounding factors.",
    action: "Prefer converged result. Note interaction effects as contributing factors.",
    confidence_penalty: 0.10
  },
  {
    level: "minor_divergence",
    min_delta: 0.05,
    label: "MINOR DIVERGENCE",
    description: "Minimal cross-domain interaction. Naive and converged results are broadly consistent.",
    action: "Either result acceptable. Note interactions for completeness.",
    confidence_penalty: 0.05
  },
  {
    level: "no_divergence",
    min_delta: 0.0,
    label: "NO DIVERGENCE",
    description: "No meaningful cross-domain interaction detected. Engine results are independent.",
    action: "Naive assessment is adequate.",
    confidence_penalty: 0.0
  }
];
 
// ============================================================
// REPORT NARRATIVE TEMPLATES
// ============================================================
 
var STABILITY_NARRATIVES = {
  stable: "The assessment converged within normal iteration limits. All cross-domain assumptions have been reconciled with actual findings.",
  marginally_stable: "The assessment converged but required more iterations than typical. This indicates significant cross-domain coupling — multiple engines' results are sensitive to each other's findings.",
  unstable: "WARNING: The assessment did not converge within the maximum iteration limit. This means engine results are circularly dependent and highly sensitive to assumptions. The asset's condition involves strongly coupled degradation mechanisms that cannot be fully resolved by independent engine assessments. Human expert review is required."
};
 
var CHAIN_NARRATIVES = {
  coating_corrosion: "Coating degradation is driving corrosion acceleration. The coating assessment and corrosion assessment cannot be evaluated independently — they form a coupled system where each makes the other worse.",
  corrosion_fatigue: "Wall thinning from corrosion is changing the stress state, which accelerates fatigue damage. The corrosion rate and fatigue life are coupled — faster corrosion means shorter fatigue life, which means earlier failure than either mechanism predicts alone.",
  mechanism_cascade: "Multiple damage mechanisms are interacting. The mechanism identification changes the corrosion model, which changes the wall thickness, which changes the fatigue life, which changes the decision mode. This is a classic Klein bottle case — every factor loops back through every other factor.",
  evidence_confidence: "Evidence gaps are compounding across domains. Insufficient evidence in one domain reduces confidence in dependent domains, creating a cascading uncertainty effect.",
  decision_escalation: "Cross-domain interactions are driving the decision toward a more restrictive mode. The converged assessment requires more human involvement than any single engine would have recommended."
};
 
// ============================================================
// CORE FUNCTIONS
// ============================================================
 
function classifyDivergence(convergenceDelta) {
  for (var i = 0; i < DIVERGENCE_LEVELS.length; i++) {
    if (convergenceDelta >= DIVERGENCE_LEVELS[i].min_delta) {
      return DIVERGENCE_LEVELS[i];
    }
  }
  return DIVERGENCE_LEVELS[DIVERGENCE_LEVELS.length - 1];
}
 
function generateNarrative(meshResult) {
  var sections = [];
 
  // Stability narrative
  var stabilityText = STABILITY_NARRATIVES[meshResult.stability] || STABILITY_NARRATIVES.stable;
  sections.push({
    heading: "Convergence Status",
    text: stabilityText,
    data: {
      converged: meshResult.converged,
      stability: meshResult.stability,
      iterations: meshResult.iterations_required
    }
  });
 
  // Divergence narrative
  var divergence = classifyDivergence(meshResult.convergence_delta || 0);
  sections.push({
    heading: "Naive vs Converged Assessment",
    text: divergence.description,
    action: divergence.action,
    data: {
      divergence_level: divergence.level,
      convergence_delta: meshResult.convergence_delta,
      confidence_penalty: divergence.confidence_penalty
    }
  });
 
  // Non-conservative findings
  if (meshResult.non_conservative_mismatches > 0) {
    sections.push({
      heading: "Non-Conservative Assumptions Detected",
      text: meshResult.non_conservative_mismatches + " engine(s) made assumptions that were more optimistic than reality. Their initial results underestimated risk. The converged result corrects for this.",
      severity: "high",
      data: {
        count: meshResult.non_conservative_mismatches,
        total_mismatches: meshResult.total_mismatches
      }
    });
  }
 
  // Critical chains
  if (meshResult.critical_chains && meshResult.critical_chains.length > 0) {
    var chainTexts = [];
    for (var i = 0; i < meshResult.critical_chains.length; i++) {
      var chain = meshResult.critical_chains[i];
      var narrativeKey = null;
      if (chain.domain === "coating_condition" || chain.domain === "wall_thickness") {
        narrativeKey = "coating_corrosion";
      } else if (chain.domain === "fatigue_state" || chain.domain === "stress_state") {
        narrativeKey = "corrosion_fatigue";
      } else if (chain.domain === "active_mechanisms") {
        narrativeKey = "mechanism_cascade";
      } else if (chain.domain === "inspection_coverage") {
        narrativeKey = "evidence_confidence";
      }
 
      chainTexts.push({
        domain: chain.domain,
        engines_affected: chain.affected_engines,
        narrative: narrativeKey ? CHAIN_NARRATIVES[narrativeKey] : "Cross-domain propagation detected in " + chain.domain + " affecting " + chain.affected_engines + " engines."
      });
    }
    sections.push({
      heading: "Critical Interaction Chains",
      text: "The following cross-domain chains were detected where a finding in one domain propagates through multiple engines:",
      chains: chainTexts
    });
  }
 
  // Klein bottle metric
  if (meshResult.klein_bottle_metric) {
    sections.push({
      heading: "Klein Bottle Assessment",
      text: meshResult.klein_bottle_metric.assessment,
      data: {
        interaction_density: meshResult.klein_bottle_metric.interaction_density,
        cross_domain_coupling: meshResult.klein_bottle_metric.cross_domain_coupling
      }
    });
  }
 
  return sections;
}
 
function generateReport(meshResult, caseContext) {
  var narrative = generateNarrative(meshResult);
  var divergence = classifyDivergence(meshResult.convergence_delta || 0);
 
  // Build mismatch summary by domain
  var domainSummary = {};
  var mismatches = meshResult.mismatches || [];
  for (var i = 0; i < mismatches.length; i++) {
    var m = mismatches[i];
    if (!domainSummary[m.domain]) {
      domainSummary[m.domain] = {
        domain: m.domain,
        mismatch_count: 0,
        worst_severity: 0,
        worst_classification: "none",
        engines_affected: [],
        non_conservative: 0
      };
    }
    domainSummary[m.domain].mismatch_count++;
    if (m.severity > domainSummary[m.domain].worst_severity) {
      domainSummary[m.domain].worst_severity = m.severity;
      domainSummary[m.domain].worst_classification = m.classification;
    }
    if (m.direction === "non_conservative") {
      domainSummary[m.domain].non_conservative++;
    }
    var engineFound = false;
    for (var ef = 0; ef < domainSummary[m.domain].engines_affected.length; ef++) {
      if (domainSummary[m.domain].engines_affected[ef] === m.engine) { engineFound = true; break; }
    }
    if (!engineFound) domainSummary[m.domain].engines_affected.push(m.engine);
  }
 
  // Build engine summary
  var engineSummary = {};
  for (var j = 0; j < mismatches.length; j++) {
    var mm = mismatches[j];
    if (!engineSummary[mm.engine]) {
      engineSummary[mm.engine] = {
        engine: mm.engine,
        total_mismatches: 0,
        critical_mismatches: 0,
        non_conservative: 0,
        domains_affected: []
      };
    }
    engineSummary[mm.engine].total_mismatches++;
    if (mm.classification === "critical") engineSummary[mm.engine].critical_mismatches++;
    if (mm.direction === "non_conservative") engineSummary[mm.engine].non_conservative++;
    var domFound = false;
    for (var df = 0; df < engineSummary[mm.engine].domains_affected.length; df++) {
      if (engineSummary[mm.engine].domains_affected[df] === mm.domain) { domFound = true; break; }
    }
    if (!domFound) engineSummary[mm.engine].domains_affected.push(mm.domain);
  }
 
  var report = {
    report_type: "klein_bottle_convergence_report",
    report_version: ENGINE_VERSION,
    case_id: caseContext ? caseContext.case_id : null,
    generated_at: new Date().toISOString(),
    executive_summary: {
      convergence_status: meshResult.stability,
      divergence_level: divergence.level,
      divergence_label: divergence.label,
      iterations_required: meshResult.iterations_required,
      total_mismatches: meshResult.total_mismatches,
      non_conservative_mismatches: meshResult.non_conservative_mismatches,
      confidence_penalty: divergence.confidence_penalty,
      critical_chains: meshResult.critical_chains ? meshResult.critical_chains.length : 0,
      bottom_line: divergence.action
    },
    narrative_sections: narrative,
    domain_summary: domainSummary,
    engine_summary: engineSummary,
    convergence_history: meshResult.convergence_history,
    klein_bottle_metric: meshResult.klein_bottle_metric,
    recommendations: generateRecommendations(meshResult, divergence)
  };
 
  return report;
}
 
function generateRecommendations(meshResult, divergence) {
  var recs = [];
 
  if (divergence.level === "critical_divergence" || divergence.level === "significant_divergence") {
    recs.push({
      priority: "critical",
      recommendation: "Do not rely on individual engine results. Only use the converged assessment for decision-making.",
      rationale: "Cross-domain interactions significantly change the risk picture."
    });
  }
 
  if (meshResult.non_conservative_mismatches > 0) {
    recs.push({
      priority: "high",
      recommendation: "Review all non-conservative assumption mismatches. Initial engine assessments underestimated risk in " + meshResult.non_conservative_mismatches + " domain(s).",
      rationale: "Non-conservative assumptions lead to under-estimation of risk."
    });
  }
 
  if (meshResult.stability === "unstable") {
    recs.push({
      priority: "critical",
      recommendation: "Assessment did not converge. Engage a multi-discipline expert team for manual review. The asset's degradation mechanisms are too strongly coupled for independent assessment.",
      rationale: "Circular dependencies between degradation mechanisms prevent stable automated assessment."
    });
  }
 
  if (meshResult.critical_chains && meshResult.critical_chains.length > 0) {
    recs.push({
      priority: "high",
      recommendation: "Address critical interaction chains. Fixing the root domain in each chain will improve assessment stability across all dependent domains.",
      rationale: "Critical chains propagate uncertainty and risk across multiple engines."
    });
  }
 
  if (meshResult.confidence_impact > 0.15) {
    recs.push({
      priority: "high",
      recommendation: "Overall confidence should be reduced by " + Math.round(meshResult.confidence_impact * 100) + "% due to cross-domain uncertainty propagation. Consider additional inspection or data collection.",
      rationale: "Cross-domain mismatches compound uncertainty beyond what individual engines report."
    });
  }
 
  if (recs.length === 0) {
    recs.push({
      priority: "info",
      recommendation: "No significant cross-domain interactions detected. Individual engine assessments are reliable.",
      rationale: "Engine assumptions align with actual findings across all domains."
    });
  }
 
  return recs;
}
 
function getDivergenceFlags(meshResult) {
  var divergence = classifyDivergence(meshResult.convergence_delta || 0);
  return {
    divergence_detected: divergence.level !== "no_divergence",
    level: divergence.level,
    label: divergence.label,
    action: divergence.action,
    confidence_penalty: divergence.confidence_penalty,
    non_conservative_count: meshResult.non_conservative_mismatches || 0,
    stability: meshResult.stability,
    requires_converged_result: divergence.level === "critical_divergence" || divergence.level === "significant_divergence"
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
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: ENGINE_ID,
          version: ENGINE_VERSION,
          deploy: DEPLOY,
          mode: "deterministic",
          purpose: "Convergence Reporter — produces Klein Bottle interaction analysis for every Superbrain report",
          divergence_levels: DIVERGENCE_LEVELS.length,
          actions: [
            "generate_report — full convergence report from mesh results",
            "compare_naive_converged — show what the naive assessment missed",
            "get_divergence_flags — quick check: did convergence matter?",
            "get_topology_summary — summarize engine interconnections",
            "get_registry — engine metadata"
          ]
        })
      };
    }
 
    if (action === "generate_report") {
      var meshResult = body.mesh_result;
      if (!meshResult) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "mesh_result required" }) };
      }
      var report = generateReport(meshResult, body.case_context || null);
 
      try {
        var sb = createClient(supabaseUrl, supabaseKey);
        await sb.from("convergence_reports").insert({
          org_id: body.org_id || null,
          case_id: body.case_context ? body.case_context.case_id : null,
          divergence_level: report.executive_summary.divergence_level,
          stability: report.executive_summary.convergence_status,
          confidence_penalty: report.executive_summary.confidence_penalty,
          result_json: report
        });
      } catch (dbErr) { /* non-fatal */ }
 
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: ENGINE_ID,
          version: ENGINE_VERSION,
          action: action,
          report: report
        }, null, 2)
      };
    }
 
    if (action === "get_divergence_flags") {
      var meshRes = body.mesh_result;
      if (!meshRes) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "mesh_result required" }) };
      }
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: ENGINE_ID,
          version: ENGINE_VERSION,
          action: action,
          flags: getDivergenceFlags(meshRes)
        }, null, 2)
      };
    }
 
    if (action === "compare_naive_converged") {
      var meshData = body.mesh_result;
      if (!meshData) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "mesh_result required" }) };
      }
      var div = classifyDivergence(meshData.convergence_delta || 0);
      var nonConservative = [];
      var conservative = [];
      var allMismatches = meshData.mismatches || [];
      for (var nc = 0; nc < allMismatches.length; nc++) {
        if (allMismatches[nc].direction === "non_conservative") {
          nonConservative.push(allMismatches[nc]);
        } else if (allMismatches[nc].direction === "conservative") {
          conservative.push(allMismatches[nc]);
        }
      }
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: ENGINE_ID,
          version: ENGINE_VERSION,
          action: action,
          comparison: {
            divergence: div,
            naive_would_have_missed: nonConservative,
            naive_was_overly_conservative: conservative,
            bottom_line: nonConservative.length > 0 ?
              "The naive single-pass assessment missed " + nonConservative.length + " non-conservative interaction(s). The converged result identifies risks that no individual engine would have caught alone." :
              "No significant non-conservative mismatches. Naive assessment is adequate."
          }
        }, null, 2)
      };
    }
 
    if (action === "get_topology_summary") {
      // Return a summary of how engines connect without requiring mesh results
      var connections = [];
      var engineSet = {};
      // Build from knowledge of the interaction matrix structure
      connections.push({ from: "coatings-intelligence-authority", to: "corrosion-loop-engine", via: "coating_condition" });
      connections.push({ from: "coatings-intelligence-authority", to: "uncertainty-boundary-engine", via: "coating_condition" });
      connections.push({ from: "corrosion-loop-engine", to: "fatigue-vibration-proof", via: "wall_loss" });
      connections.push({ from: "corrosion-loop-engine", to: "weld-acceptance-authority", via: "wall_loss" });
      connections.push({ from: "fatigue-vibration-proof", to: "weld-acceptance-authority", via: "fatigue_state" });
      connections.push({ from: "fatigue-vibration-proof", to: "decision-liability-engine", via: "fatigue_state" });
      connections.push({ from: "mechanism-causality-engine", to: "corrosion-loop-engine", via: "active_mechanisms" });
      connections.push({ from: "mechanism-causality-engine", to: "fatigue-vibration-proof", via: "active_mechanisms" });
      connections.push({ from: "mechanism-causality-engine", to: "coatings-intelligence-authority", via: "active_mechanisms" });
      connections.push({ from: "uncertainty-boundary-engine", to: "decision-liability-engine", via: "confidence_ceiling" });
      connections.push({ from: "evidence-contract-engine", to: "uncertainty-boundary-engine", via: "evidence_score" });
      connections.push({ from: "live-code-authority", to: "weld-acceptance-authority", via: "applicable_codes" });
      connections.push({ from: "multi-asset-cascade", to: "decision-liability-engine", via: "cascade_severity" });
 
      for (var ci = 0; ci < connections.length; ci++) {
        engineSet[connections[ci].from] = true;
        engineSet[connections[ci].to] = true;
      }
 
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: ENGINE_ID,
          version: ENGINE_VERSION,
          action: action,
          topology: {
            engines_in_mesh: Object.keys(engineSet).length,
            connections: connections,
            total_connections: connections.length,
            principle: "Each connection represents a domain where one engine's output can invalidate another engine's assumptions. The Klein bottle has no inside or outside — every engine is both a producer and consumer of cross-domain state."
          }
        }, null, 2)
      };
    }
 
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
 
