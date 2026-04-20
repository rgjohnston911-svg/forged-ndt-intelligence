// @ts-nocheck
/**
 * DEPLOY255 - Outcome Tracking Engine v1.0.0
 * netlify/functions/outcome-tracking.ts
 *
 * Closes the feedback loop: what did we predict vs what actually happened.
 * Feeds accuracy data back into concept reliability, cost model accuracy,
 * and inspection effectiveness scoring.
 *
 * 8 capabilities:
 *   1. Record Actual Outcome
 *   2. Compare Predictions vs Actuals
 *   3. Score Cost Accuracy
 *   4. Score Inspection Effectiveness
 *   5. Score Concept Engine Accuracy
 *   6. Generate Calibration Recommendations
 *   7. Accuracy Dashboard Metrics
 *   8. Outcome Audit Trail
 *
 * Actions:
 *   get_registry
 *   record_outcome
 *   compare_predictions
 *   score_cost_accuracy
 *   score_inspection_effectiveness
 *   score_concept_accuracy
 *   get_calibration_queue
 *   get_accuracy_dashboard
 *   get_case_outcome
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var ENGINE_NAME = "outcome-tracking";
var ENGINE_VERSION = "v1.0.0";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

var supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// ============================================================
// OUTCOME TYPES — what can actually happen after a decision
// ============================================================
var OUTCOME_TYPES = [
  "repair_confirmed",
  "repair_not_needed",
  "failure_occurred",
  "monitoring_stable",
  "monitoring_degraded",
  "inspection_confirmed",
  "inspection_missed",
  "deferred_no_change",
  "deferred_worsened"
];

// ============================================================
// ACCURACY GRADES
// ============================================================
var ACCURACY_GRADES = {
  exact_match: { label: "Exact Match", min_score: 0.90, color: "#22c55e" },
  close_match: { label: "Close Match", min_score: 0.70, color: "#3b82f6" },
  partial_match: { label: "Partial Match", min_score: 0.40, color: "#f59e0b" },
  miss: { label: "Miss", min_score: 0.10, color: "#ef4444" },
  opposite: { label: "Opposite", min_score: 0.0, color: "#dc2626" }
};

// ============================================================
// COST VARIANCE THRESHOLDS
// ============================================================
var COST_VARIANCE_THRESHOLDS = {
  exact: 0.10,
  close: 0.25,
  partial: 0.50,
  miss: 1.00
};

// ============================================================
// CAPABILITY REGISTRY
// ============================================================
var CAPABILITY_REGISTRY = [
  { id: "CAP-OUT-001", name: "Record Actual Outcome", action: "record_outcome" },
  { id: "CAP-OUT-002", name: "Compare Predictions vs Actuals", action: "compare_predictions" },
  { id: "CAP-OUT-003", name: "Score Cost Accuracy", action: "score_cost_accuracy" },
  { id: "CAP-OUT-004", name: "Score Inspection Effectiveness", action: "score_inspection_effectiveness" },
  { id: "CAP-OUT-005", name: "Score Concept Engine Accuracy", action: "score_concept_accuracy" },
  { id: "CAP-OUT-006", name: "Calibration Recommendations", action: "get_calibration_queue" },
  { id: "CAP-OUT-007", name: "Accuracy Dashboard Metrics", action: "get_accuracy_dashboard" },
  { id: "CAP-OUT-008", name: "Outcome Audit Trail", action: "get_case_outcome" }
];

// ============================================================
// INTEGRATION MAP
// ============================================================
var INTEGRATION_MAP = {
  concept_intelligence_v21: {
    feeds_back: ["concept reliability scores", "drift metrics", "calibration profiles"],
    via: "concept_accuracy table + calibration queue"
  },
  cost_reasoning_engine: {
    feeds_back: ["cost model accuracy", "failure cost calibration", "assumption profile tuning"],
    via: "cost_accuracy table + calibration queue"
  },
  decision_core: {
    feeds_back: ["disposition accuracy", "confidence calibration"],
    via: "prediction_accuracy table"
  },
  inspection_report: {
    feeds_back: ["method effectiveness", "detection rates", "sizing accuracy"],
    via: "inspection_effectiveness table"
  },
  enterprise_audit: {
    produces: ["outcome events", "accuracy events", "calibration events"],
    via: "outcome_audit_events table"
  }
};

// ============================================================
// HELPERS
// ============================================================

function json(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body)
  };
}

function round2(n) {
  return Number(Number(n).toFixed(2));
}

function round4(n) {
  return Number(Number(n).toFixed(4));
}

function gradeCostVariance(variancePct) {
  var abs = Math.abs(variancePct);
  if (abs <= COST_VARIANCE_THRESHOLDS.exact) return "exact_match";
  if (abs <= COST_VARIANCE_THRESHOLDS.close) return "close_match";
  if (abs <= COST_VARIANCE_THRESHOLDS.partial) return "partial_match";
  if (abs <= COST_VARIANCE_THRESHOLDS.miss) return "miss";
  return "opposite";
}

function gradePredictionAccuracy(predicted, actual) {
  if (!predicted || !actual) return { score: 0, match_type: "pending" };
  var pLower = String(predicted).toLowerCase().trim();
  var aLower = String(actual).toLowerCase().trim();
  if (pLower === aLower) return { score: 1.0, match_type: "exact_match" };
  if (pLower.indexOf(aLower) >= 0 || aLower.indexOf(pLower) >= 0) return { score: 0.75, match_type: "close_match" };
  return { score: 0.0, match_type: "miss" };
}

function scoreInspectionEffectiveness(detected, sizingPct, falseCalled, missed) {
  var score = 0;
  if (detected === true) score = score + 0.40;
  if (sizingPct !== null && sizingPct !== undefined) {
    var sizingScore = Math.max(0, 1 - Math.abs(1 - Number(sizingPct) / 100));
    score = score + (0.30 * sizingScore);
  } else {
    score = score + 0.15;
  }
  if (falseCalled === true) score = score - 0.25;
  if (missed === true) score = score - 0.40;
  score = score + 0.20;
  return round4(Math.max(0, Math.min(1, score)));
}

// ============================================================
// DATABASE OPERATIONS
// ============================================================

async function emitAuditEvent(caseId, orgId, actionType, eventJson) {
  var result = await supabase.from("outcome_audit_events").insert({
    case_id: caseId,
    org_id: orgId,
    action_type: actionType,
    event_json: eventJson
  });
  if (result.error) throw result.error;
}

async function getOutcomeForCase(caseId) {
  var result = await supabase
    .from("outcome_records")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (result.error) throw result.error;
  return result.data && result.data.length > 0 ? result.data[0] : null;
}

async function getPredictionAccuracy(outcomeRecordId) {
  var result = await supabase
    .from("prediction_accuracy")
    .select("*")
    .eq("outcome_record_id", outcomeRecordId)
    .order("created_at", { ascending: true });
  if (result.error) throw result.error;
  return result.data || [];
}

async function getCostAccuracy(outcomeRecordId) {
  var result = await supabase
    .from("cost_accuracy")
    .select("*")
    .eq("outcome_record_id", outcomeRecordId)
    .order("created_at", { ascending: true });
  if (result.error) throw result.error;
  return result.data || [];
}

async function getInspectionEffectiveness(outcomeRecordId) {
  var result = await supabase
    .from("inspection_effectiveness")
    .select("*")
    .eq("outcome_record_id", outcomeRecordId)
    .order("created_at", { ascending: true });
  if (result.error) throw result.error;
  return result.data || [];
}

async function getConceptAccuracy(outcomeRecordId) {
  var result = await supabase
    .from("concept_accuracy")
    .select("*")
    .eq("outcome_record_id", outcomeRecordId)
    .order("created_at", { ascending: true });
  if (result.error) throw result.error;
  return result.data || [];
}

// ============================================================
// CORE: RECORD OUTCOME
// ============================================================

async function recordOutcome(input) {
  var payload = {
    case_id: input.case_id,
    org_id: input.org_id,
    outcome_type: input.outcome_type,
    outcome_status: input.outcome_status || "recorded",
    recorded_by: input.recorded_by || null,
    actual_disposition: input.actual_disposition || null,
    actual_failure_mode: input.actual_failure_mode || null,
    actual_consequence_level: input.actual_consequence_level || null,
    time_to_outcome_days: input.time_to_outcome_days || null,
    outcome_json: input.outcome_json || {},
    notes: input.notes || null,
    engine_version: ENGINE_VERSION
  };

  var result = await supabase.from("outcome_records").insert(payload).select().single();
  if (result.error) throw result.error;

  await emitAuditEvent(input.case_id, input.org_id, "record_outcome", {
    outcome_record_id: result.data.id,
    outcome_type: input.outcome_type,
    actual_disposition: input.actual_disposition
  });

  return result.data;
}

// ============================================================
// CORE: COMPARE PREDICTIONS
// ============================================================

async function comparePredictions(input) {
  var outcomeRecord = await getOutcomeForCase(input.case_id);
  if (!outcomeRecord) {
    return { error: "No outcome record found for case " + input.case_id };
  }

  var predictions = input.predictions || [];
  var results = [];

  for (var i = 0; i < predictions.length; i++) {
    var p = predictions[i];
    var gradeResult = gradePredictionAccuracy(p.predicted_value, p.actual_value);

    var row = {
      case_id: input.case_id,
      org_id: input.org_id,
      outcome_record_id: outcomeRecord.id,
      prediction_source: p.source || "unknown",
      prediction_type: p.type || "disposition",
      predicted_value: String(p.predicted_value || ""),
      actual_value: String(p.actual_value || ""),
      accuracy_score: gradeResult.score,
      match_type: gradeResult.match_type,
      accuracy_json: {
        source: p.source,
        type: p.type,
        predicted: p.predicted_value,
        actual: p.actual_value,
        grade: gradeResult
      },
      engine_version: ENGINE_VERSION
    };

    var insertResult = await supabase.from("prediction_accuracy").insert(row).select().single();
    if (insertResult.error) throw insertResult.error;
    results.push(insertResult.data);
  }

  // Calculate aggregate accuracy
  var totalScore = 0;
  var matchCount = 0;
  var missCount = 0;
  for (var j = 0; j < results.length; j++) {
    totalScore = totalScore + Number(results[j].accuracy_score || 0);
    if (results[j].match_type === "exact_match" || results[j].match_type === "close_match") {
      matchCount = matchCount + 1;
    } else {
      missCount = missCount + 1;
    }
  }
  var avgAccuracy = results.length > 0 ? round4(totalScore / results.length) : 0;

  await emitAuditEvent(input.case_id, input.org_id, "compare_predictions", {
    outcome_record_id: outcomeRecord.id,
    prediction_count: results.length,
    avg_accuracy: avgAccuracy,
    match_count: matchCount,
    miss_count: missCount
  });

  return {
    outcome_record_id: outcomeRecord.id,
    predictions_scored: results.length,
    avg_accuracy: avgAccuracy,
    match_count: matchCount,
    miss_count: missCount,
    results: results
  };
}

// ============================================================
// CORE: SCORE COST ACCURACY
// ============================================================

async function scoreCostAccuracy(input) {
  var outcomeRecord = await getOutcomeForCase(input.case_id);
  if (!outcomeRecord) {
    return { error: "No outcome record found for case " + input.case_id };
  }

  var costComparisons = input.cost_comparisons || [];
  var results = [];

  for (var i = 0; i < costComparisons.length; i++) {
    var c = costComparisons[i];
    var predicted = Number(c.predicted_cost || 0);
    var actual = Number(c.actual_cost || 0);
    var variance = round2(actual - predicted);
    var variancePct = predicted > 0 ? round4((actual - predicted) / predicted) : 0;
    var grade = gradeCostVariance(variancePct);

    var row = {
      case_id: input.case_id,
      org_id: input.org_id,
      outcome_record_id: outcomeRecord.id,
      scenario_type: c.scenario_type || "repair_now",
      predicted_cost: predicted,
      actual_cost: actual,
      cost_variance: variance,
      cost_variance_pct: variancePct,
      accuracy_grade: grade,
      cost_json: {
        scenario_type: c.scenario_type,
        predicted: predicted,
        actual: actual,
        variance: variance,
        variance_pct: variancePct,
        grade: grade
      },
      currency_code: c.currency_code || "USD",
      engine_version: ENGINE_VERSION
    };

    var insertResult = await supabase.from("cost_accuracy").insert(row).select().single();
    if (insertResult.error) throw insertResult.error;
    results.push(insertResult.data);
  }

  // Check if calibration recommendation needed
  var totalVariancePct = 0;
  for (var j = 0; j < results.length; j++) {
    totalVariancePct = totalVariancePct + Math.abs(Number(results[j].cost_variance_pct || 0));
  }
  var avgVariancePct = results.length > 0 ? round4(totalVariancePct / results.length) : 0;

  // If avg variance > 25%, queue a calibration recommendation
  if (avgVariancePct > 0.25 && results.length > 0) {
    await supabase.from("outcome_calibration_queue").insert({
      org_id: input.org_id,
      target_engine: "cost-reasoning-engine",
      target_parameter: "base_cost_models",
      current_value: null,
      recommended_value: null,
      reason: "Average cost variance of " + Math.round(avgVariancePct * 100) + "% across " + results.length + " comparisons exceeds 25% threshold. Review cost models for " + (results[0].scenario_type || "unknown") + " scenarios.",
      evidence_count: results.length,
      confidence: round4(1 - avgVariancePct),
      status: "pending",
      calibration_json: {
        avg_variance_pct: avgVariancePct,
        comparisons: results.length,
        case_id: input.case_id
      },
      engine_version: ENGINE_VERSION
    });
  }

  await emitAuditEvent(input.case_id, input.org_id, "score_cost_accuracy", {
    outcome_record_id: outcomeRecord.id,
    comparisons: results.length,
    avg_variance_pct: avgVariancePct,
    calibration_triggered: avgVariancePct > 0.25
  });

  return {
    outcome_record_id: outcomeRecord.id,
    comparisons_scored: results.length,
    avg_variance_pct: avgVariancePct,
    calibration_triggered: avgVariancePct > 0.25,
    results: results
  };
}

// ============================================================
// CORE: SCORE INSPECTION EFFECTIVENESS
// ============================================================

async function scoreInspectionEffectivenessAction(input) {
  var outcomeRecord = await getOutcomeForCase(input.case_id);
  if (!outcomeRecord) {
    return { error: "No outcome record found for case " + input.case_id };
  }

  var inspections = input.inspections || [];
  var results = [];

  for (var i = 0; i < inspections.length; i++) {
    var insp = inspections[i];
    var effScore = scoreInspectionEffectiveness(
      insp.detection_success,
      insp.sizing_accuracy_pct,
      insp.false_call || false,
      insp.missed_finding || false
    );

    var row = {
      case_id: input.case_id,
      org_id: input.org_id,
      outcome_record_id: outcomeRecord.id,
      method_recommended: insp.method_recommended || "unknown",
      method_used: insp.method_used || insp.method_recommended || "unknown",
      detection_success: insp.detection_success || false,
      sizing_accuracy_pct: insp.sizing_accuracy_pct || null,
      false_call: insp.false_call || false,
      missed_finding: insp.missed_finding || false,
      effectiveness_score: effScore,
      effectiveness_json: {
        method_recommended: insp.method_recommended,
        method_used: insp.method_used,
        detection: insp.detection_success,
        sizing_pct: insp.sizing_accuracy_pct,
        false_call: insp.false_call,
        missed: insp.missed_finding,
        score: effScore
      },
      engine_version: ENGINE_VERSION
    };

    var insertResult = await supabase.from("inspection_effectiveness").insert(row).select().single();
    if (insertResult.error) throw insertResult.error;
    results.push(insertResult.data);
  }

  // Check for method with poor effectiveness — queue calibration
  for (var k = 0; k < results.length; k++) {
    if (Number(results[k].effectiveness_score) < 0.40) {
      await supabase.from("outcome_calibration_queue").insert({
        org_id: input.org_id,
        target_engine: "concept-intelligence-core",
        target_parameter: "method_capability_" + results[k].method_used,
        current_value: null,
        recommended_value: null,
        reason: results[k].method_used + " scored " + Math.round(Number(results[k].effectiveness_score) * 100) + "% effectiveness. Review method capability map and recommended follow-up logic.",
        evidence_count: 1,
        confidence: Number(results[k].effectiveness_score),
        status: "pending",
        calibration_json: {
          method: results[k].method_used,
          score: results[k].effectiveness_score,
          case_id: input.case_id
        },
        engine_version: ENGINE_VERSION
      });
    }
  }

  await emitAuditEvent(input.case_id, input.org_id, "score_inspection_effectiveness", {
    outcome_record_id: outcomeRecord.id,
    inspections_scored: results.length
  });

  return {
    outcome_record_id: outcomeRecord.id,
    inspections_scored: results.length,
    results: results
  };
}

// ============================================================
// CORE: SCORE CONCEPT ACCURACY
// ============================================================

async function scoreConceptAccuracyAction(input) {
  var outcomeRecord = await getOutcomeForCase(input.case_id);
  if (!outcomeRecord) {
    return { error: "No outcome record found for case " + input.case_id };
  }

  var concepts = input.concepts || [];
  var results = [];
  var correctCount = 0;
  var usefulCount = 0;
  var totalCount = concepts.length;

  for (var i = 0; i < concepts.length; i++) {
    var c = concepts[i];
    var row = {
      case_id: input.case_id,
      org_id: input.org_id,
      outcome_record_id: outcomeRecord.id,
      concept_key: c.concept_key,
      was_activated: c.was_activated !== false,
      was_correct: c.was_correct || null,
      was_useful: c.was_useful || null,
      was_governing: c.was_governing || false,
      confidence_at_prediction: c.confidence_at_prediction || null,
      accuracy_json: {
        concept_key: c.concept_key,
        activated: c.was_activated,
        correct: c.was_correct,
        useful: c.was_useful,
        governing: c.was_governing,
        confidence: c.confidence_at_prediction
      },
      engine_version: ENGINE_VERSION
    };

    var insertResult = await supabase.from("concept_accuracy").insert(row).select().single();
    if (insertResult.error) throw insertResult.error;
    results.push(insertResult.data);

    if (c.was_correct === true) correctCount = correctCount + 1;
    if (c.was_useful === true) usefulCount = usefulCount + 1;
  }

  var correctRate = totalCount > 0 ? round4(correctCount / totalCount) : 0;
  var usefulRate = totalCount > 0 ? round4(usefulCount / totalCount) : 0;

  // If a concept was activated but wrong, queue calibration
  for (var j = 0; j < concepts.length; j++) {
    if (concepts[j].was_activated === true && concepts[j].was_correct === false) {
      await supabase.from("outcome_calibration_queue").insert({
        org_id: input.org_id,
        target_engine: "concept-intelligence-v21",
        target_parameter: "reliability_" + concepts[j].concept_key,
        current_value: concepts[j].confidence_at_prediction || null,
        recommended_value: null,
        reason: concepts[j].concept_key + " was activated but outcome shows it was incorrect. Review concept trigger conditions and reduce reliability score.",
        evidence_count: 1,
        confidence: concepts[j].confidence_at_prediction || 0.5,
        status: "pending",
        calibration_json: {
          concept_key: concepts[j].concept_key,
          was_governing: concepts[j].was_governing,
          case_id: input.case_id
        },
        engine_version: ENGINE_VERSION
      });
    }
  }

  await emitAuditEvent(input.case_id, input.org_id, "score_concept_accuracy", {
    outcome_record_id: outcomeRecord.id,
    concepts_scored: totalCount,
    correct_rate: correctRate,
    useful_rate: usefulRate
  });

  return {
    outcome_record_id: outcomeRecord.id,
    concepts_scored: totalCount,
    correct_count: correctCount,
    useful_count: usefulCount,
    correct_rate: correctRate,
    useful_rate: usefulRate,
    results: results
  };
}

// ============================================================
// CORE: ACCURACY DASHBOARD
// ============================================================

async function getAccuracyDashboard(orgId) {
  // Prediction accuracy aggregate
  var predResult = await supabase
    .from("prediction_accuracy")
    .select("accuracy_score, match_type")
    .eq("org_id", orgId);
  var predRows = predResult.data || [];
  var predTotal = predRows.length;
  var predScoreSum = 0;
  var predExact = 0;
  var predClose = 0;
  var predMiss = 0;
  for (var pi = 0; pi < predRows.length; pi++) {
    predScoreSum = predScoreSum + Number(predRows[pi].accuracy_score || 0);
    if (predRows[pi].match_type === "exact_match") predExact = predExact + 1;
    if (predRows[pi].match_type === "close_match") predClose = predClose + 1;
    if (predRows[pi].match_type === "miss" || predRows[pi].match_type === "opposite") predMiss = predMiss + 1;
  }

  // Cost accuracy aggregate
  var costResult = await supabase
    .from("cost_accuracy")
    .select("cost_variance_pct, accuracy_grade")
    .eq("org_id", orgId);
  var costRows = costResult.data || [];
  var costTotal = costRows.length;
  var costVarianceSum = 0;
  var costExact = 0;
  var costMiss = 0;
  for (var ci = 0; ci < costRows.length; ci++) {
    costVarianceSum = costVarianceSum + Math.abs(Number(costRows[ci].cost_variance_pct || 0));
    if (costRows[ci].accuracy_grade === "exact_match" || costRows[ci].accuracy_grade === "close_match") costExact = costExact + 1;
    if (costRows[ci].accuracy_grade === "miss" || costRows[ci].accuracy_grade === "opposite") costMiss = costMiss + 1;
  }

  // Inspection effectiveness aggregate
  var inspResult = await supabase
    .from("inspection_effectiveness")
    .select("effectiveness_score, detection_success, false_call, missed_finding")
    .eq("org_id", orgId);
  var inspRows = inspResult.data || [];
  var inspTotal = inspRows.length;
  var inspScoreSum = 0;
  var inspDetected = 0;
  var inspFalseCalls = 0;
  var inspMissed = 0;
  for (var ii = 0; ii < inspRows.length; ii++) {
    inspScoreSum = inspScoreSum + Number(inspRows[ii].effectiveness_score || 0);
    if (inspRows[ii].detection_success === true) inspDetected = inspDetected + 1;
    if (inspRows[ii].false_call === true) inspFalseCalls = inspFalseCalls + 1;
    if (inspRows[ii].missed_finding === true) inspMissed = inspMissed + 1;
  }

  // Concept accuracy aggregate
  var conceptResult = await supabase
    .from("concept_accuracy")
    .select("concept_key, was_correct, was_useful, was_governing")
    .eq("org_id", orgId);
  var conceptRows = conceptResult.data || [];
  var conceptTotal = conceptRows.length;
  var conceptCorrect = 0;
  var conceptUseful = 0;
  for (var coi = 0; coi < conceptRows.length; coi++) {
    if (conceptRows[coi].was_correct === true) conceptCorrect = conceptCorrect + 1;
    if (conceptRows[coi].was_useful === true) conceptUseful = conceptUseful + 1;
  }

  // Pending calibrations
  var calResult = await supabase
    .from("outcome_calibration_queue")
    .select("id, target_engine, reason, status")
    .eq("org_id", orgId)
    .eq("status", "pending");
  var pendingCalibrations = calResult.data || [];

  // Outcome records count
  var outcomeResult = await supabase
    .from("outcome_records")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  var outcomeCount = outcomeResult.count || 0;

  return {
    total_outcomes_recorded: outcomeCount,
    prediction_accuracy: {
      total: predTotal,
      avg_score: predTotal > 0 ? round4(predScoreSum / predTotal) : null,
      exact_matches: predExact,
      close_matches: predClose,
      misses: predMiss
    },
    cost_accuracy: {
      total: costTotal,
      avg_variance_pct: costTotal > 0 ? round4(costVarianceSum / costTotal) : null,
      accurate_count: costExact,
      miss_count: costMiss
    },
    inspection_effectiveness: {
      total: inspTotal,
      avg_score: inspTotal > 0 ? round4(inspScoreSum / inspTotal) : null,
      detection_rate: inspTotal > 0 ? round4(inspDetected / inspTotal) : null,
      false_call_rate: inspTotal > 0 ? round4(inspFalseCalls / inspTotal) : null,
      missed_rate: inspTotal > 0 ? round4(inspMissed / inspTotal) : null
    },
    concept_accuracy: {
      total: conceptTotal,
      correct_rate: conceptTotal > 0 ? round4(conceptCorrect / conceptTotal) : null,
      useful_rate: conceptTotal > 0 ? round4(conceptUseful / conceptTotal) : null
    },
    pending_calibrations: pendingCalibrations.length,
    calibration_queue: pendingCalibrations
  };
}

// ============================================================
// HANDLER
// ============================================================

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action;

    if (!action) {
      return json(400, { ok: false, error: "Missing action" });
    }

    // ========================================================
    // ACTION: get_registry
    // ========================================================
    if (action === "get_registry") {
      return json(200, {
        ok: true,
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        mode: "deterministic",
        capabilities: CAPABILITY_REGISTRY,
        outcome_types: OUTCOME_TYPES,
        accuracy_grades: ACCURACY_GRADES,
        cost_variance_thresholds: COST_VARIANCE_THRESHOLDS,
        integrations: INTEGRATION_MAP,
        actions: [
          "get_registry",
          "record_outcome",
          "compare_predictions",
          "score_cost_accuracy",
          "score_inspection_effectiveness",
          "score_concept_accuracy",
          "get_calibration_queue",
          "get_accuracy_dashboard",
          "get_case_outcome"
        ]
      });
    }

    // ========================================================
    // ACTION: record_outcome
    // ========================================================
    if (action === "record_outcome") {
      var roInput = body.input;
      if (!roInput || !roInput.case_id || !roInput.org_id || !roInput.outcome_type) {
        return json(400, { ok: false, error: "Missing required: input.case_id, input.org_id, input.outcome_type" });
      }
      if (OUTCOME_TYPES.indexOf(roInput.outcome_type) < 0) {
        return json(400, { ok: false, error: "Invalid outcome_type. Valid: " + OUTCOME_TYPES.join(", ") });
      }
      var outcomeRecord = await recordOutcome(roInput);
      return json(200, {
        ok: true,
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        outcome_record: outcomeRecord
      });
    }

    // ========================================================
    // ACTION: compare_predictions
    // ========================================================
    if (action === "compare_predictions") {
      var cpInput = body.input;
      if (!cpInput || !cpInput.case_id || !cpInput.org_id || !Array.isArray(cpInput.predictions)) {
        return json(400, { ok: false, error: "Missing required: input.case_id, input.org_id, input.predictions[]" });
      }
      var cpResult = await comparePredictions(cpInput);
      if (cpResult.error) {
        return json(404, { ok: false, error: cpResult.error });
      }
      return json(200, {
        ok: true,
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        output: cpResult
      });
    }

    // ========================================================
    // ACTION: score_cost_accuracy
    // ========================================================
    if (action === "score_cost_accuracy") {
      var scInput = body.input;
      if (!scInput || !scInput.case_id || !scInput.org_id || !Array.isArray(scInput.cost_comparisons)) {
        return json(400, { ok: false, error: "Missing required: input.case_id, input.org_id, input.cost_comparisons[]" });
      }
      var scResult = await scoreCostAccuracy(scInput);
      if (scResult.error) {
        return json(404, { ok: false, error: scResult.error });
      }
      return json(200, {
        ok: true,
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        output: scResult
      });
    }

    // ========================================================
    // ACTION: score_inspection_effectiveness
    // ========================================================
    if (action === "score_inspection_effectiveness") {
      var siInput = body.input;
      if (!siInput || !siInput.case_id || !siInput.org_id || !Array.isArray(siInput.inspections)) {
        return json(400, { ok: false, error: "Missing required: input.case_id, input.org_id, input.inspections[]" });
      }
      var siResult = await scoreInspectionEffectivenessAction(siInput);
      if (siResult.error) {
        return json(404, { ok: false, error: siResult.error });
      }
      return json(200, {
        ok: true,
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        output: siResult
      });
    }

    // ========================================================
    // ACTION: score_concept_accuracy
    // ========================================================
    if (action === "score_concept_accuracy") {
      var caInput = body.input;
      if (!caInput || !caInput.case_id || !caInput.org_id || !Array.isArray(caInput.concepts)) {
        return json(400, { ok: false, error: "Missing required: input.case_id, input.org_id, input.concepts[]" });
      }
      var caResult = await scoreConceptAccuracyAction(caInput);
      if (caResult.error) {
        return json(404, { ok: false, error: caResult.error });
      }
      return json(200, {
        ok: true,
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        output: caResult
      });
    }

    // ========================================================
    // ACTION: get_calibration_queue
    // ========================================================
    if (action === "get_calibration_queue") {
      var calOrgId = body.org_id;
      if (!calOrgId) {
        return json(400, { ok: false, error: "Missing org_id" });
      }
      var calStatus = body.status || "pending";
      var calResult = await supabase
        .from("outcome_calibration_queue")
        .select("*")
        .eq("org_id", calOrgId)
        .eq("status", calStatus)
        .order("created_at", { ascending: false });
      if (calResult.error) throw calResult.error;

      return json(200, {
        ok: true,
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        queue: calResult.data || [],
        count: (calResult.data || []).length
      });
    }

    // ========================================================
    // ACTION: get_accuracy_dashboard
    // ========================================================
    if (action === "get_accuracy_dashboard") {
      var dashOrgId = body.org_id;
      if (!dashOrgId) {
        return json(400, { ok: false, error: "Missing org_id" });
      }
      var dashboard = await getAccuracyDashboard(dashOrgId);
      return json(200, {
        ok: true,
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        dashboard: dashboard
      });
    }

    // ========================================================
    // ACTION: get_case_outcome
    // ========================================================
    if (action === "get_case_outcome") {
      var gcCaseId = body.case_id;
      if (!gcCaseId) {
        return json(400, { ok: false, error: "Missing case_id" });
      }
      var gcOutcome = await getOutcomeForCase(gcCaseId);
      if (!gcOutcome) {
        return json(200, {
          ok: true,
          engine: ENGINE_NAME,
          version: ENGINE_VERSION,
          outcome: null,
          message: "No outcome recorded for this case"
        });
      }

      var gcPredictions = await getPredictionAccuracy(gcOutcome.id);
      var gcCosts = await getCostAccuracy(gcOutcome.id);
      var gcInspections = await getInspectionEffectiveness(gcOutcome.id);
      var gcConcepts = await getConceptAccuracy(gcOutcome.id);

      return json(200, {
        ok: true,
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        outcome: gcOutcome,
        prediction_accuracy: gcPredictions,
        cost_accuracy: gcCosts,
        inspection_effectiveness: gcInspections,
        concept_accuracy: gcConcepts
      });
    }

    // ========================================================
    // UNKNOWN ACTION
    // ========================================================
    return json(400, { ok: false, error: "Unknown action: " + String(action) });

  } catch (err) {
    return json(500, {
      ok: false,
      engine: ENGINE_NAME,
      version: ENGINE_VERSION,
      error: err && err.message ? err.message : String(err)
    });
  }
};
