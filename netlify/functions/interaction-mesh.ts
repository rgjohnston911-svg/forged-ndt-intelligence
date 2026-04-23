// @ts-nocheck
/**
 * DEPLOY278 - interaction-mesh.ts
 * netlify/functions/interaction-mesh.ts
 *
 * KLEIN BOTTLE INTERACTION MESH — Superbrain v7 Core
 *
 * The fundamental principle: no engine operates in isolation.
 * Every engine's output potentially invalidates another engine's assumptions.
 * This mesh detects cross-domain mismatches and drives re-evaluation
 * until results converge — or flags instability as a finding itself.
 *
 * POST /api/interaction-mesh
 *
 * Actions:
 *   evaluate_mesh        — run full convergence loop on engine results
 *   check_assumptions    — compare one engine's assumptions vs actual findings
 *   get_interaction_map  — return which engines affect which
 *   get_registry         — engine metadata
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
 
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
 
var ENGINE_ID = "interaction-mesh";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY278";
 
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
 
// ============================================================
// KLEIN BOTTLE TOPOLOGY — ENGINE INTERACTION MATRIX
// ============================================================
// Defines which engines' outputs can invalidate which engines' assumptions.
// This is the "wiring diagram" of the Klein bottle — the topology
// that turns 69 independent engines into one continuous surface.
// ============================================================
 
var INTERACTION_MATRIX = [
  // Coatings affects corrosion, CP effectiveness, evidence confidence
  {
    source: "coatings-intelligence-authority",
    affects: ["corrosion-loop-engine", "uncertainty-boundary-engine", "evidence-contract-engine"],
    field: "coating_condition",
    impact: "Coating state changes corrosion rate assumptions, CP effectiveness, and evidence confidence"
  },
  // Corrosion affects wall thickness, fatigue life, structural capacity
  {
    source: "corrosion-loop-engine",
    affects: ["fatigue-vibration-proof", "weld-acceptance-authority", "uncertainty-boundary-engine", "decision-liability-engine"],
    field: "wall_loss",
    impact: "Wall thinning changes stress state, fatigue life, weld acceptance margins, and decision confidence"
  },
  // Fatigue affects structural integrity, inspection intervals, decision mode
  {
    source: "fatigue-vibration-proof",
    affects: ["weld-acceptance-authority", "decision-liability-engine", "inspection-planning-proof"],
    field: "fatigue_state",
    impact: "Fatigue damage changes weld acceptance criteria, decision urgency, and inspection strategy"
  },
  // Weld acceptance affects structural capacity, consequence severity
  {
    source: "weld-acceptance-authority",
    affects: ["multi-asset-cascade", "decision-liability-engine", "uncertainty-boundary-engine"],
    field: "weld_disposition",
    impact: "Weld rejection changes cascade risk, decision mode, and system confidence"
  },
  // Mechanism causality affects everything — identifies what's actually happening
  {
    source: "mechanism-causality-engine",
    affects: ["corrosion-loop-engine", "fatigue-vibration-proof", "coatings-intelligence-authority", "uncertainty-boundary-engine", "decision-liability-engine"],
    field: "active_mechanisms",
    impact: "Mechanism identification changes degradation models, coating relevance, confidence limits, and decision governance"
  },
  // Uncertainty affects decision mode, which affects what actions are allowed
  {
    source: "uncertainty-boundary-engine",
    affects: ["decision-liability-engine", "evidence-contract-engine"],
    field: "confidence_ceiling",
    impact: "Confidence limits change decision mode eligibility and evidence sufficiency"
  },
  // Evidence contracts affect confidence, which affects everything
  {
    source: "evidence-contract-engine",
    affects: ["uncertainty-boundary-engine", "decision-liability-engine", "coatings-intelligence-authority", "corrosion-loop-engine"],
    field: "evidence_score",
    impact: "Evidence sufficiency changes confidence ceilings and domain-specific assessment reliability"
  },
  // Decision liability affects what the system is allowed to conclude
  {
    source: "decision-liability-engine",
    affects: ["inspection-planning-proof", "evidence-contract-engine"],
    field: "decision_mode",
    impact: "Decision mode changes inspection urgency and evidence requirements"
  },
  // Multi-asset cascade affects consequence severity across the system
  {
    source: "multi-asset-cascade",
    affects: ["decision-liability-engine", "fatigue-vibration-proof", "corrosion-loop-engine"],
    field: "cascade_severity",
    impact: "Cascade effects change consequence classification, loading assumptions, and corrosion environment"
  },
  // Inspection planning affects evidence availability, which affects confidence
  {
    source: "inspection-planning-proof",
    affects: ["evidence-contract-engine", "uncertainty-boundary-engine"],
    field: "inspection_coverage",
    impact: "Inspection method and coverage changes evidence availability and measurement uncertainty"
  },
  // Live code authority affects acceptance criteria for everything
  {
    source: "live-code-authority",
    affects: ["weld-acceptance-authority", "coatings-intelligence-authority", "corrosion-loop-engine", "fatigue-vibration-proof"],
    field: "applicable_codes",
    impact: "Code requirements change acceptance thresholds across all domain engines"
  },
  // Cost reasoning affects repair feasibility, which affects decision pathway
  {
    source: "cost-reasoning-engine",
    affects: ["decision-liability-engine", "inspection-planning-proof"],
    field: "cost_feasibility",
    impact: "Cost constraints change viable decision pathways and inspection strategy"
  }
];
 
// ============================================================
// ASSUMPTION DOMAINS
// ============================================================
// Standard assumption categories that engines can declare.
// Each assumption has a domain key, a default value (what engines
// assume if they have no information), and a severity weight
// indicating how much a mismatch matters.
// ============================================================
 
var ASSUMPTION_DOMAINS = {
  coating_condition: {
    key: "coating_condition",
    default_assumption: "intact",
    possible_states: ["intact", "minor_degradation", "moderate_degradation", "severe_degradation", "failed", "absent"],
    severity_weight: 0.8,
    description: "Protective coating state on the assessed surface"
  },
  cp_effectiveness: {
    key: "cp_effectiveness",
    default_assumption: "effective",
    possible_states: ["effective", "marginal", "ineffective", "absent", "shielded", "unknown"],
    severity_weight: 0.7,
    description: "Cathodic protection effectiveness at the assessment location"
  },
  wall_thickness: {
    key: "wall_thickness",
    default_assumption: "nominal",
    possible_states: ["nominal", "minor_loss", "moderate_loss", "significant_loss", "near_minimum", "below_minimum"],
    severity_weight: 0.9,
    description: "Current wall thickness relative to nominal and minimum required"
  },
  material_condition: {
    key: "material_condition",
    default_assumption: "as_specified",
    possible_states: ["as_specified", "degraded", "embrittled", "sensitized", "unknown"],
    severity_weight: 0.85,
    description: "Material metallurgical condition"
  },
  active_mechanisms: {
    key: "active_mechanisms",
    default_assumption: "none_identified",
    possible_states: ["none_identified", "single_mechanism", "multiple_independent", "multiple_interacting", "synergistic_chain"],
    severity_weight: 0.95,
    description: "Active damage mechanisms and their interaction state"
  },
  stress_state: {
    key: "stress_state",
    default_assumption: "design_basis",
    possible_states: ["design_basis", "elevated", "cyclic", "combined", "overloaded", "unknown"],
    severity_weight: 0.85,
    description: "Current stress state at the assessment location"
  },
  environment_severity: {
    key: "environment_severity",
    default_assumption: "as_designed",
    possible_states: ["as_designed", "mild", "moderate", "severe", "extreme", "upset", "unknown"],
    severity_weight: 0.8,
    description: "Service environment severity relative to design basis"
  },
  inspection_coverage: {
    key: "inspection_coverage",
    default_assumption: "adequate",
    possible_states: ["comprehensive", "adequate", "limited", "single_method", "visual_only", "none"],
    severity_weight: 0.7,
    description: "Inspection method coverage and reliability"
  },
  fatigue_state: {
    key: "fatigue_state",
    default_assumption: "within_design_life",
    possible_states: ["within_design_life", "approaching_limit", "at_limit", "beyond_limit", "crack_detected", "unknown"],
    severity_weight: 0.9,
    description: "Fatigue damage accumulation state"
  },
  consequence_class: {
    key: "consequence_class",
    default_assumption: "moderate",
    possible_states: ["negligible", "minor", "moderate", "major", "catastrophic"],
    severity_weight: 1.0,
    description: "Consequence of failure classification"
  }
};
 
// ============================================================
// MISMATCH SEVERITY CLASSIFICATION
// ============================================================
 
var MISMATCH_SEVERITY_THRESHOLDS = {
  critical: 0.85,
  major: 0.65,
  moderate: 0.40,
  minor: 0.15
};
 
// ============================================================
// CONVERGENCE PARAMETERS
// ============================================================
 
var MAX_ITERATIONS = 5;
var CONVERGENCE_THRESHOLD = 0.02;
var INSTABILITY_THRESHOLD = 3;
 
// ============================================================
// CORE FUNCTIONS
// ============================================================
 
function getStateIndex(domain, state) {
  var domainDef = ASSUMPTION_DOMAINS[domain];
  if (!domainDef) return -1;
  for (var i = 0; i < domainDef.possible_states.length; i++) {
    if (domainDef.possible_states[i] === state) return i;
  }
  return -1;
}
 
function calculateMismatchSeverity(domain, assumed, actual) {
  var domainDef = ASSUMPTION_DOMAINS[domain];
  if (!domainDef) return { severity: 0, classification: "unknown", description: "Unknown domain" };
 
  var assumedIdx = getStateIndex(domain, assumed);
  var actualIdx = getStateIndex(domain, actual);
 
  if (assumedIdx === -1 || actualIdx === -1) {
    return { severity: 0.5, classification: "moderate", description: "Could not resolve states for comparison" };
  }
 
  if (assumedIdx === actualIdx) {
    return { severity: 0, classification: "none", description: "Assumption matches reality" };
  }
 
  var maxIdx = domainDef.possible_states.length - 1;
  var rawDelta = Math.abs(actualIdx - assumedIdx) / maxIdx;
  var directionPenalty = actualIdx > assumedIdx ? 1.2 : 0.8;
  var severity = Math.min(1.0, rawDelta * directionPenalty * domainDef.severity_weight);
 
  var classification = "minor";
  if (severity >= MISMATCH_SEVERITY_THRESHOLDS.critical) classification = "critical";
  else if (severity >= MISMATCH_SEVERITY_THRESHOLDS.major) classification = "major";
  else if (severity >= MISMATCH_SEVERITY_THRESHOLDS.moderate) classification = "moderate";
 
  var desc = "Assumed " + domain + " = " + assumed + " but actual = " + actual;
  if (actualIdx > assumedIdx) {
    desc = desc + " (WORSE than assumed — results may be non-conservative)";
  } else {
    desc = desc + " (BETTER than assumed — results may be overly conservative)";
  }
 
  return {
    severity: Math.round(severity * 1000) / 1000,
    classification: classification,
    assumed: assumed,
    actual: actual,
    domain: domain,
    direction: actualIdx > assumedIdx ? "non_conservative" : "conservative",
    description: desc
  };
}
 
function findAffectedEngines(sourceEngine) {
  var affected = [];
  for (var i = 0; i < INTERACTION_MATRIX.length; i++) {
    if (INTERACTION_MATRIX[i].source === sourceEngine) {
      for (var j = 0; j < INTERACTION_MATRIX[i].affects.length; j++) {
        var target = INTERACTION_MATRIX[i].affects[j];
        var found = false;
        for (var k = 0; k < affected.length; k++) {
          if (affected[k] === target) { found = true; break; }
        }
        if (!found) affected.push(target);
      }
    }
  }
  return affected;
}
 
function findSourcesFor(targetEngine) {
  var sources = [];
  for (var i = 0; i < INTERACTION_MATRIX.length; i++) {
    var entry = INTERACTION_MATRIX[i];
    for (var j = 0; j < entry.affects.length; j++) {
      if (entry.affects[j] === targetEngine) {
        sources.push({
          source: entry.source,
          field: entry.field,
          impact: entry.impact
        });
        break;
      }
    }
  }
  return sources;
}
 
function evaluateMesh(engineResults) {
  // engineResults is an array of:
  // { engine: string, findings: object, assumptions: { domain: assumed_state }, actuals: { domain: actual_state } }
 
  var iterations = [];
  var allMismatches = [];
  var convergenceHistory = [];
  var engineReEvalCount = {};
 
  // Build lookup maps
  var findingsMap = {};
  var assumptionsMap = {};
  var actualsMap = {};
 
  for (var i = 0; i < engineResults.length; i++) {
    var er = engineResults[i];
    findingsMap[er.engine] = er.findings || {};
    assumptionsMap[er.engine] = er.assumptions || {};
    actualsMap[er.engine] = er.actuals || {};
    engineReEvalCount[er.engine] = 0;
  }
 
  // ITERATION LOOP — the Klein bottle convergence
  var iterationCount = 0;
  var converged = false;
  var totalMismatchSeverity = 999;
 
  while (iterationCount < MAX_ITERATIONS && !converged) {
    iterationCount++;
    var iterationMismatches = [];
    var enginesNeedingReEval = [];
 
    // For each engine, check its assumptions against actual findings from other engines
    for (var ei = 0; ei < engineResults.length; ei++) {
      var engine = engineResults[ei].engine;
      var assumptions = assumptionsMap[engine] || {};
 
      var engineMismatches = [];
 
      // Check each assumption against the actual state reported by the authoritative engine
      var assumptionKeys = Object.keys(assumptions);
      for (var ak = 0; ak < assumptionKeys.length; ak++) {
        var domain = assumptionKeys[ak];
        var assumedState = assumptions[domain];
 
        // Find which engine is authoritative for this domain
        var actualState = null;
        for (var oi = 0; oi < engineResults.length; oi++) {
          if (engineResults[oi].engine !== engine && actualsMap[engineResults[oi].engine]) {
            if (actualsMap[engineResults[oi].engine][domain] !== undefined) {
              actualState = actualsMap[engineResults[oi].engine][domain];
              break;
            }
          }
        }
 
        if (actualState !== null && actualState !== assumedState) {
          var mismatch = calculateMismatchSeverity(domain, assumedState, actualState);
          mismatch.engine = engine;
          mismatch.iteration = iterationCount;
          engineMismatches.push(mismatch);
        }
      }
 
      if (engineMismatches.length > 0) {
        var needsReEval = false;
        for (var m = 0; m < engineMismatches.length; m++) {
          iterationMismatches.push(engineMismatches[m]);
          if (engineMismatches[m].classification === "critical" || engineMismatches[m].classification === "major") {
            needsReEval = true;
          }
        }
        if (needsReEval) {
          enginesNeedingReEval.push(engine);
          engineReEvalCount[engine] = (engineReEvalCount[engine] || 0) + 1;
        }
      }
    }
 
    // Calculate total mismatch severity for convergence check
    var newTotalSeverity = 0;
    for (var ms = 0; ms < iterationMismatches.length; ms++) {
      newTotalSeverity += iterationMismatches[ms].severity;
    }
 
    var delta = Math.abs(totalMismatchSeverity - newTotalSeverity);
    convergenceHistory.push({
      iteration: iterationCount,
      mismatch_count: iterationMismatches.length,
      total_severity: Math.round(newTotalSeverity * 1000) / 1000,
      delta: Math.round(delta * 1000) / 1000,
      engines_needing_reeval: enginesNeedingReEval.length
    });
 
    totalMismatchSeverity = newTotalSeverity;
 
    // Add all mismatches from this iteration
    for (var ami = 0; ami < iterationMismatches.length; ami++) {
      allMismatches.push(iterationMismatches[ami]);
    }
 
    iterations.push({
      iteration: iterationCount,
      mismatches: iterationMismatches,
      engines_flagged: enginesNeedingReEval
    });
 
    // Convergence check
    if (delta < CONVERGENCE_THRESHOLD || iterationMismatches.length === 0) {
      converged = true;
    }
 
    // If engines need re-eval, update their assumptions to match actuals
    // (simulating re-evaluation with corrected inputs)
    for (var re = 0; re < enginesNeedingReEval.length; re++) {
      var reEngine = enginesNeedingReEval[re];
      var reAssumptions = assumptionsMap[reEngine] || {};
      var reKeys = Object.keys(reAssumptions);
      for (var rk = 0; rk < reKeys.length; rk++) {
        var rDomain = reKeys[rk];
        for (var ro = 0; ro < engineResults.length; ro++) {
          if (engineResults[ro].engine !== reEngine && actualsMap[engineResults[ro].engine]) {
            if (actualsMap[engineResults[ro].engine][rDomain] !== undefined) {
              assumptionsMap[reEngine][rDomain] = actualsMap[engineResults[ro].engine][rDomain];
              break;
            }
          }
        }
      }
    }
  }
 
  // Classify stability
  var stability = "stable";
  if (!converged) {
    stability = "unstable";
  } else if (iterationCount > INSTABILITY_THRESHOLD) {
    stability = "marginally_stable";
  }
 
  // Calculate naive vs converged delta
  var naiveSeverity = 0;
  if (iterations.length > 0 && iterations[0].mismatches) {
    for (var ns = 0; ns < iterations[0].mismatches.length; ns++) {
      naiveSeverity += iterations[0].mismatches[ns].severity;
    }
  }
  var convergenceDelta = Math.round(Math.abs(naiveSeverity - totalMismatchSeverity) * 1000) / 1000;
 
  // Identify critical chains — sequences of mismatches that propagate
  var criticalChains = [];
  var criticalMismatches = [];
  for (var cm = 0; cm < allMismatches.length; cm++) {
    if (allMismatches[cm].classification === "critical") {
      criticalMismatches.push(allMismatches[cm]);
    }
  }
 
  if (criticalMismatches.length > 0) {
    // Group by domain to find propagation chains
    var domainChains = {};
    for (var dc = 0; dc < criticalMismatches.length; dc++) {
      var dom = criticalMismatches[dc].domain;
      if (!domainChains[dom]) domainChains[dom] = [];
      domainChains[dom].push(criticalMismatches[dc]);
    }
    var chainKeys = Object.keys(domainChains);
    for (var ck = 0; ck < chainKeys.length; ck++) {
      if (domainChains[chainKeys[ck]].length > 1) {
        criticalChains.push({
          domain: chainKeys[ck],
          affected_engines: domainChains[chainKeys[ck]].length,
          chain: domainChains[chainKeys[ck]]
        });
      }
    }
  }
 
  // Non-conservative mismatch count — these are the dangerous ones
  var nonConservativeCount = 0;
  for (var nc = 0; nc < allMismatches.length; nc++) {
    if (allMismatches[nc].direction === "non_conservative") nonConservativeCount++;
  }
 
  // Confidence impact — how much should overall confidence drop due to cross-domain issues
  var confidenceImpact = 0;
  for (var ci = 0; ci < allMismatches.length; ci++) {
    if (allMismatches[ci].direction === "non_conservative") {
      confidenceImpact += allMismatches[ci].severity * 0.1;
    }
  }
  confidenceImpact = Math.min(0.40, Math.round(confidenceImpact * 1000) / 1000);
 
  return {
    converged: converged,
    stability: stability,
    iterations_required: iterationCount,
    max_iterations: MAX_ITERATIONS,
    total_mismatches: allMismatches.length,
    non_conservative_mismatches: nonConservativeCount,
    confidence_impact: confidenceImpact,
    convergence_delta: convergenceDelta,
    convergence_history: convergenceHistory,
    critical_chains: criticalChains,
    engine_reeval_counts: engineReEvalCount,
    mismatches: allMismatches,
    iterations: iterations,
    klein_bottle_metric: {
      interaction_density: Math.round((allMismatches.length / Math.max(1, engineResults.length)) * 100) / 100,
      cross_domain_coupling: criticalChains.length > 0 ? "high" : (allMismatches.length > 3 ? "moderate" : "low"),
      naive_vs_converged_delta: convergenceDelta,
      assessment: convergenceDelta > 0.3 ? "Naive single-pass assessment would have been significantly non-conservative. Klein bottle convergence is essential for this case." :
                  convergenceDelta > 0.1 ? "Cross-domain interactions materially affect the assessment. Convergence loop adds value." :
                  "Minimal cross-domain interaction. Single-pass assessment is adequate for this case."
    }
  };
}
 
function checkSingleAssumption(engineName, assumptions, allActuals) {
  var results = [];
  var assumptionKeys = Object.keys(assumptions);
  for (var i = 0; i < assumptionKeys.length; i++) {
    var domain = assumptionKeys[i];
    var assumed = assumptions[domain];
    var actual = allActuals[domain];
    if (actual !== undefined) {
      var mismatch = calculateMismatchSeverity(domain, assumed, actual);
      mismatch.engine = engineName;
      results.push(mismatch);
    } else {
      results.push({
        engine: engineName,
        domain: domain,
        assumed: assumed,
        actual: "no_data",
        severity: 0,
        classification: "no_data",
        description: "No authoritative actual state available for " + domain
      });
    }
  }
  return results;
}
 
function getInteractionMap() {
  var map = {};
  for (var i = 0; i < INTERACTION_MATRIX.length; i++) {
    var entry = INTERACTION_MATRIX[i];
    if (!map[entry.source]) {
      map[entry.source] = {
        affects: [],
        affected_by: [],
        fields_published: []
      };
    }
    map[entry.source].fields_published.push(entry.field);
    for (var j = 0; j < entry.affects.length; j++) {
      var target = entry.affects[j];
      var found = false;
      for (var k = 0; k < map[entry.source].affects.length; k++) {
        if (map[entry.source].affects[k] === target) { found = true; break; }
      }
      if (!found) map[entry.source].affects.push(target);
 
      if (!map[target]) {
        map[target] = { affects: [], affected_by: [], fields_published: [] };
      }
      var foundSrc = false;
      for (var l = 0; l < map[target].affected_by.length; l++) {
        if (map[target].affected_by[l] === entry.source) { foundSrc = true; break; }
      }
      if (!foundSrc) map[target].affected_by.push(entry.source);
    }
  }
 
  // Calculate connectivity metrics
  var engines = Object.keys(map);
  var totalConnections = 0;
  var maxConnections = 0;
  var mostConnected = "";
  for (var e = 0; e < engines.length; e++) {
    var conn = map[engines[e]].affects.length + map[engines[e]].affected_by.length;
    totalConnections += conn;
    if (conn > maxConnections) {
      maxConnections = conn;
      mostConnected = engines[e];
    }
  }
 
  return {
    engines: map,
    topology: {
      total_engines_in_mesh: engines.length,
      total_connections: totalConnections,
      most_connected_engine: mostConnected,
      most_connected_count: maxConnections,
      average_connections: Math.round((totalConnections / Math.max(1, engines.length)) * 10) / 10,
      interaction_entries: INTERACTION_MATRIX.length,
      assumption_domains: Object.keys(ASSUMPTION_DOMAINS).length
    }
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
 
    // get_registry
    if (action === "get_registry") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: ENGINE_ID,
          version: ENGINE_VERSION,
          deploy: DEPLOY,
          mode: "deterministic",
          purpose: "Klein Bottle interaction mesh — cross-domain convergence loop for Superbrain v7",
          principle: "No engine operates in isolation. Every output potentially invalidates another engine's assumptions.",
          interaction_entries: INTERACTION_MATRIX.length,
          assumption_domains: Object.keys(ASSUMPTION_DOMAINS).length,
          max_iterations: MAX_ITERATIONS,
          convergence_threshold: CONVERGENCE_THRESHOLD,
          actions: [
            "evaluate_mesh — run full convergence loop on engine results",
            "check_assumptions — compare one engine's assumptions vs actual findings",
            "get_interaction_map — return full engine interaction topology",
            "get_registry — engine metadata"
          ]
        })
      };
    }
 
    // evaluate_mesh
    if (action === "evaluate_mesh") {
      var engineResults = body.engine_results;
      if (!engineResults || !Array.isArray(engineResults) || engineResults.length === 0) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            error: "engine_results required — array of { engine, findings, assumptions, actuals }"
          })
        };
      }
 
      var meshResult = evaluateMesh(engineResults);
 
      // Persist to DB (non-fatal)
      try {
        var sb = createClient(supabaseUrl, supabaseKey);
        await sb.from("interaction_mesh_results").insert({
          org_id: body.org_id || null,
          case_id: body.case_id || null,
          converged: meshResult.converged,
          stability: meshResult.stability,
          iterations_required: meshResult.iterations_required,
          total_mismatches: meshResult.total_mismatches,
          non_conservative_count: meshResult.non_conservative_mismatches,
          confidence_impact: meshResult.confidence_impact,
          convergence_delta: meshResult.convergence_delta,
          result_json: meshResult
        });
      } catch (dbErr) { /* non-fatal */ }
 
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: ENGINE_ID,
          version: ENGINE_VERSION,
          action: action,
          result: meshResult
        }, null, 2)
      };
    }
 
    // check_assumptions
    if (action === "check_assumptions") {
      var engineName = body.engine_name;
      var assumptions = body.assumptions;
      var actuals = body.actuals;
      if (!engineName || !assumptions) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "engine_name and assumptions required" })
        };
      }
 
      var checkResults = checkSingleAssumption(engineName, assumptions, actuals || {});
      var affected = findAffectedEngines(engineName);
      var sources = findSourcesFor(engineName);
 
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: ENGINE_ID,
          version: ENGINE_VERSION,
          action: action,
          checked_engine: engineName,
          assumption_checks: checkResults,
          this_engine_affects: affected,
          this_engine_affected_by: sources
        }, null, 2)
      };
    }
 
    // get_interaction_map
    if (action === "get_interaction_map") {
      var interactionMap = getInteractionMap();
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: ENGINE_ID,
          version: ENGINE_VERSION,
          action: action,
          interaction_map: interactionMap
        }, null, 2)
      };
    }
 
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Unknown action: " + action })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: String(err && err.message ? err.message : err) })
    };
  }
};
 
