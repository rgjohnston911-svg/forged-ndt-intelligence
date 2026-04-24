// @ts-nocheck
/**
 * DEPLOY310 - advanced-physics-arbiter.ts
 * netlify/functions/advanced-physics-arbiter.ts
 *
 * ADVANCED PHYSICS ARBITER — ENGINE 100
 *
 * Sub-engine 240:
 *   240 - Master Physics Arbiter (multi-engine consensus with conflict detection)
 *
 * Receives results from multiple sub-engines, checks for conflicts,
 * computes weighted consensus severity and confidence, and flags
 * contradictions requiring human review.
 *
 * POST /api/advanced-physics-arbiter
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var ENGINE_ID = "advanced-physics-arbiter";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY310";
var corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };

function num(v, fallback) { var n = Number(v); if (v === undefined || v === null || v === "" || isNaN(n)) return fallback !== undefined ? fallback : null; return n; }
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

function buildResult(engineNum, engineCode, partial) {
  return { engine_number: engineNum, engine_code: engineCode, result: partial.result || {}, interpretation: partial.interpretation || "", confidence: clamp01(partial.confidence || 0.7), uncertainty: clamp01(partial.uncertainty || 0.3), severity: partial.severity || "info", assumptions: partial.assumptions || [], limitations: partial.limitations || [], missing_inputs: partial.missing_inputs || [], proof_trace: partial.proof_trace || { mathematical_basis: [], calculation_steps: [], required_human_review: false } };
}

function holdResult(engineNum, engineCode, m) {
  return buildResult(engineNum, engineCode, { result: { missing_inputs: m }, interpretation: "Calculation held. Missing: " + m.join(", ") + ".", confidence: 0.1, uncertainty: 0.9, severity: "hold_for_input", missing_inputs: m, proof_trace: { mathematical_basis: [], calculation_steps: ["Input validation failed"], required_human_review: false, next_data_needed: m } });
}

// ============================================================
// SEVERITY RANK HELPER
// ============================================================

var SEVERITY_RANK = { "critical": 5, "high": 4, "medium": 3, "low": 2, "info": 1, "hold_for_input": 0 };

function severityToRank(s) { return SEVERITY_RANK[s] || 1; }

function rankToSeverity(r) {
  if (r >= 4.5) return "critical";
  if (r >= 3.5) return "high";
  if (r >= 2.5) return "medium";
  if (r >= 1.5) return "low";
  return "info";
}

// ============================================================
// 240 — MASTER PHYSICS ARBITER
// ============================================================

function calcMasterArbiter(inp) {
  var engineResults = inp.engine_results;
  if (!Array.isArray(engineResults) || engineResults.length === 0) {
    return holdResult(240, "MASTER_PHYSICS_ARBITER", ["engine_results"]);
  }

  var totalWeight = 0;
  var weightedSeverity = 0;
  var weightedConfidence = 0;
  var allAssumptions = [];
  var allLimitations = [];
  var conflicts = [];
  var steps = [];
  var humanReviewRequired = false;
  var hasCritical = false;
  var hasHold = false;
  var severityCounts = { "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0, "hold_for_input": 0 };

  // Process each engine result
  for (var i = 0; i < engineResults.length; i++) {
    var er = engineResults[i];
    var eng = er.engine_number || er.engine_code || ("Engine_" + i);
    var sev = er.severity || "info";
    var conf = num(er.confidence, 0.5);
    var weight = conf; // Weight by confidence

    severityCounts[sev] = (severityCounts[sev] || 0) + 1;
    weightedSeverity += severityToRank(sev) * weight;
    weightedConfidence += conf * weight;
    totalWeight += weight;

    if (sev === "critical") hasCritical = true;
    if (sev === "hold_for_input") hasHold = true;
    if (er.proof_trace && er.proof_trace.required_human_review) humanReviewRequired = true;

    if (Array.isArray(er.assumptions)) {
      for (var j = 0; j < er.assumptions.length; j++) {
        allAssumptions.push("[" + eng + "] " + er.assumptions[j]);
      }
    }
    if (Array.isArray(er.limitations)) {
      for (var j = 0; j < er.limitations.length; j++) {
        allLimitations.push("[" + eng + "] " + er.limitations[j]);
      }
    }
    steps.push("Engine " + eng + ": severity=" + sev + " confidence=" + conf.toFixed(2));
  }

  // Conflict detection: check for severity disagreements
  if (severityCounts["critical"] > 0 && (severityCounts["low"] > 0 || severityCounts["info"] > 0)) {
    conflicts.push("CONFLICT: Some engines report critical severity while others report low/info — investigate discrepancy.");
    humanReviewRequired = true;
  }
  if (severityCounts["high"] > 0 && severityCounts["low"] > 0) {
    conflicts.push("CONFLICT: Mixed high and low severity assessments — engines may be evaluating different failure modes.");
    humanReviewRequired = true;
  }

  // Check for contradictory interpretations (simplified: flag if spread of severity ranks > 2)
  var minRank = 6, maxRank = 0;
  for (var i = 0; i < engineResults.length; i++) {
    var r = severityToRank(engineResults[i].severity || "info");
    if (r < minRank) minRank = r;
    if (r > maxRank) maxRank = r;
  }
  if (maxRank - minRank > 2 && engineResults.length > 2) {
    conflicts.push("CONFLICT: Severity spread of " + (maxRank - minRank) + " ranks across " + engineResults.length + " engines — high disagreement.");
    humanReviewRequired = true;
  }

  var consensusSeverityRank = totalWeight > 0 ? weightedSeverity / totalWeight : 1;
  var consensusConfidence = totalWeight > 0 ? weightedConfidence / totalWeight : 0.5;
  var consensusSeverity = hasCritical ? "critical" : rankToSeverity(consensusSeverityRank);

  // Override: if any engine is critical, arbiter is at least high
  if (hasCritical && consensusSeverity !== "critical") consensusSeverity = "high";

  return buildResult(240, "MASTER_PHYSICS_ARBITER", {
    result: { consensus_severity: consensusSeverity, consensus_confidence: consensusConfidence, engines_evaluated: engineResults.length, severity_counts: severityCounts, conflicts: conflicts, has_critical: hasCritical, has_holds: hasHold, human_review_required: humanReviewRequired },
    interpretation: "Arbiter consensus across " + engineResults.length + " engines: severity=" + consensusSeverity + ", confidence=" + consensusConfidence.toFixed(3) + "." + (conflicts.length > 0 ? " " + conflicts.length + " conflict(s) detected — human review required." : "") + (hasHold ? " Some engines awaiting input." : ""),
    confidence: clamp01(consensusConfidence * (conflicts.length > 0 ? 0.7 : 1.0)),
    uncertainty: clamp01(1 - consensusConfidence + conflicts.length * 0.1),
    severity: consensusSeverity,
    assumptions: allAssumptions.slice(0, 20),
    limitations: allLimitations.slice(0, 20).concat(conflicts.length > 0 ? ["Engine conflicts detected — automated consensus may be unreliable"] : []),
    proof_trace: { mathematical_basis: ["confidence-weighted severity consensus", "conflict detection by severity spread"], calculation_steps: steps.concat(["consensusSeverityRank=" + consensusSeverityRank.toFixed(3), "consensusSeverity=" + consensusSeverity, "conflicts=" + conflicts.length]), required_human_review: humanReviewRequired }
  });
}

// ============================================================
// ENGINE MAP
// ============================================================

var ENGINE_MAP = {
  "240": calcMasterArbiter, "MASTER_PHYSICS_ARBITER": calcMasterArbiter
};

function logRun(body, result) { try { var sb = createClient(supabaseUrl, supabaseKey); sb.from("advanced_math_engine_runs").insert({ org_id: body.org_id || null, case_id: body.case_id || null, asset_id: body.asset_id || null, finding_id: body.finding_id || null, engine_number: result.engine_number, engine_code: result.engine_code, input_payload: body.inputs || body.input || {}, output_payload: result.result, confidence: result.confidence, uncertainty: result.uncertainty, severity: result.severity, assumptions: result.assumptions, limitations: result.limitations, missing_inputs: result.missing_inputs, proof_trace: result.proof_trace }); } catch (e) {} }

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };
  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";
    if (action === "get_registry") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, deploy: DEPLOY, mode: "deterministic", purpose: "Advanced Physics Arbiter — master multi-engine consensus with conflict detection and severity arbitration", sub_engines: [240], actions: ["run_engine", "get_registry"] }) };
    }
    if (action === "run_engine") {
      var engineKey = String(body.engine_number || body.engine_code || "");
      var fn = ENGINE_MAP[engineKey];
      if (!fn) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown sub-engine: " + engineKey + ". Available: 240" }) };
      var inputs = body.inputs || body.input || {};
      var result = fn(inputs);
      logRun(body, result);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: result }, null, 2) };
    }
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
  } catch (err) { return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) }; }
};
