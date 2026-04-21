// @ts-nocheck
/**
 * DEPLOY254 - Cost Reasoning Engine v1.0.0
 * netlify/functions/cost-reasoning-engine.ts
 *
 * Deterministic-first cost reasoning layer that converts
 * inspection intelligence into financially actionable output.
 *
 * 8 capabilities:
 *   1. Immediate vs Deferred Cost Modeling
 *   2. Failure Cost Mapping
 *   3. Probability-Weighted Expected Cost Modeling
 *   4. Time Horizon Cost Projection
 *   5. Inspection ROI / Value of Information
 *   6. Scenario Comparison (repair / inspect / monitor / do nothing)
 *   7. Cost of Uncertainty Calculation
 *   8. Executive Cost Summary Output
 *
 * Actions:
 *   get_registry
 *   calculate_cost_scenarios
 *   get_failure_cost
 *   evaluate_decision_roi
 *   generate_cost_summary
 *   project_cost_timeline
 *   calculate_value_of_information
 *
 * Integrates with: Concept Intelligence Core v2.0/v2.1,
 * Decision Core, Engineering Core, Failure Pathway Simulator,
 * Outcome Simulation, Inspection Report, Enterprise Audit
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var ENGINE_NAME = "cost-reasoning-engine";
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
// SCENARIO TYPES
// ============================================================
var SCENARIO_TYPES = [
  "repair_now",
  "inspect_further",
  "monitor",
  "do_nothing",
  "replace",
  "derate"
];

// ============================================================
// CAPABILITY REGISTRY
// ============================================================
var CAPABILITY_REGISTRY = [
  { id: "CAP-COST-001", name: "Immediate vs Deferred Cost Modeling", action: "calculate_cost_scenarios" },
  { id: "CAP-COST-002", name: "Failure Cost Mapping", action: "get_failure_cost" },
  { id: "CAP-COST-003", name: "Probability-Weighted Expected Cost", action: "calculate_cost_scenarios" },
  { id: "CAP-COST-004", name: "Time Horizon Projection", action: "project_cost_timeline" },
  { id: "CAP-COST-005", name: "Inspection ROI / Value of Information", action: "calculate_value_of_information" },
  { id: "CAP-COST-006", name: "Scenario Comparison", action: "calculate_cost_scenarios" },
  { id: "CAP-COST-007", name: "Cost of Uncertainty", action: "calculate_cost_scenarios" },
  { id: "CAP-COST-008", name: "Executive Cost Summary", action: "generate_cost_summary" }
];

// ============================================================
// INTEGRATION MAP — what this engine consumes from others
// ============================================================
var INTEGRATION_MAP = {
  concept_intelligence_core: {
    consumes: ["governing_concept", "supporting_concepts", "confidence_adjustment", "blind_spots", "contradictions"],
    via: "concept_output field in input"
  },
  concept_intelligence_v21: {
    consumes: ["authority_state", "hold_status", "provisional_status", "escalation_flags"],
    via: "authority_output field in input"
  },
  failure_pathway_simulator: {
    consumes: ["pathway_plausibility", "consequence_level", "failure_mode"],
    via: "failure_pathways array in input"
  },
  planner_agent: {
    produces: ["best_voi_method", "next_action_routing"],
    via: "value_of_information_outputs in output"
  },
  outcome_simulation: {
    consumes: ["scenario_branch_outputs", "timeline_cost_projection"],
    via: "scenario comparison cross-reference"
  },
  inspection_report: {
    produces: ["executive_summary", "cost_scenario_table", "do_nothing_summary"],
    via: "decision_summary in output"
  },
  enterprise_audit: {
    produces: ["assumptions_used", "cost_model_version", "failure_pathway_used", "scenario_selection", "recommendation"],
    via: "cost_audit_events table"
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

function clamp(value, min, max) {
  if (min === undefined) min = 0;
  if (max === undefined) max = 1;
  if (value < min) return min;
  if (value > max) return max;
  return Number(value.toFixed(4));
}

function round2(n) {
  return Number(Number(n).toFixed(2));
}

function applyMultipliers(baseCost, multiplierJson, context) {
  var total = Number(baseCost);
  var mj = multiplierJson || {};
  var ctx = context || {};

  if (ctx.offshore === true && typeof mj.offshore_multiplier === "number") {
    total = total * Number(mj.offshore_multiplier);
  }
  if (ctx.outage_required === true && typeof mj.shutdown_multiplier === "number") {
    total = total * Number(mj.shutdown_multiplier);
  }
  if (ctx.criticality === "high" && typeof mj.criticality_multiplier === "number") {
    total = total * Number(mj.criticality_multiplier);
  }
  if (ctx.criticality === "critical" && typeof mj.criticality_multiplier === "number") {
    total = total * (Number(mj.criticality_multiplier) + 0.25);
  }
  if (typeof mj.access_multiplier === "number") {
    total = total * Number(mj.access_multiplier);
  }
  if (typeof mj.temporary_support_multiplier === "number" && ctx.temporary_support === true) {
    total = total * Number(mj.temporary_support_multiplier);
  }
  if (typeof mj.underwater_multiplier === "number" && ctx.underwater === true) {
    total = total * Number(mj.underwater_multiplier);
  }
  if (typeof mj.scaffold_multiplier === "number" && ctx.scaffold_required === true) {
    total = total * Number(mj.scaffold_multiplier);
  }

  return round2(total);
}

function failureCostTotal(profile) {
  var total =
    Number(profile.direct_repair_cost || 0) +
    Number(profile.downtime_cost || 0) +
    Number(profile.collateral_damage_cost || 0) +
    Number(profile.environmental_cost || 0) +
    Number(profile.safety_liability_cost || 0) +
    Number(profile.regulatory_cost || 0);
  return round2(total);
}

function expectedCost(probabilityOfFailure, totalFailureCost) {
  return round2(probabilityOfFailure * totalFailureCost);
}

function calculateCostOfUncertainty(expectedFailureCost, confidence, uncertaintyMultiplier) {
  var confidenceGap = 1 - clamp(confidence || 0, 0, 1);
  return round2(expectedFailureCost * uncertaintyMultiplier * confidenceGap);
}

function calculateROI(actionCost, avoidedCost) {
  if (!actionCost || actionCost <= 0) return 0;
  return Number(((avoidedCost - actionCost) / actionCost).toFixed(3));
}

function formatDollars(n) {
  var rounded = Math.round(Number(n));
  if (rounded >= 1000000) {
    return "$" + (rounded / 1000000).toFixed(1) + "M";
  }
  if (rounded >= 1000) {
    return "$" + Math.round(rounded / 1000) + "K";
  }
  return "$" + rounded;
}

// ============================================================
// DATABASE LOOKUPS
// ============================================================

async function getDefaultAssumptions() {
  var result = await supabase
    .from("cost_assumption_profiles")
    .select("*")
    .eq("active", true)
    .limit(1);

  if (result.error) throw result.error;
  return result.data && result.data.length > 0 ? result.data[0] : null;
}

async function getCostModel(assetType, componentType, failureMode, costCategory) {
  var query = supabase
    .from("cost_models")
    .select("*")
    .eq("active", true)
    .eq("asset_type", assetType)
    .eq("cost_category", costCategory)
    .limit(1);

  if (componentType) query = query.eq("component_type", componentType);
  if (failureMode) query = query.eq("failure_mode", failureMode);

  var result = await query;
  if (result.error) throw result.error;
  return result.data && result.data.length > 0 ? result.data[0] : null;
}

async function getFailureProfile(failureMode, consequenceLevel) {
  if (!failureMode) return null;
  var query = supabase
    .from("failure_cost_profiles")
    .select("*")
    .eq("active", true)
    .eq("failure_mode", failureMode)
    .limit(1);

  if (consequenceLevel) query = query.eq("consequence_level", consequenceLevel);

  var result = await query;
  if (result.error) throw result.error;
  return result.data && result.data.length > 0 ? result.data[0] : null;
}

async function getInspectionProfile(method) {
  var result = await supabase
    .from("inspection_cost_profiles")
    .select("*")
    .eq("active", true)
    .eq("method", method)
    .limit(1);

  if (result.error) throw result.error;
  return result.data && result.data.length > 0 ? result.data[0] : null;
}

// ============================================================
// PERSISTENCE
// ============================================================

async function persistScenarioRows(caseId, orgId, rows) {
  if (!rows || rows.length === 0) return [];
  var payload = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    payload.push({
      case_id: caseId,
      org_id: orgId,
      scenario_type: row.scenario_type,
      immediate_cost: row.immediate_cost,
      expected_cost: row.expected_cost,
      risk_exposure: row.risk_exposure,
      avoided_cost: row.avoided_cost,
      roi_value: row.roi_value,
      confidence: row.confidence,
      currency_code: row.currency_code,
      scenario_json: row,
      engine_version: ENGINE_VERSION
    });
  }
  var result = await supabase.from("case_cost_scenarios").insert(payload).select();
  if (result.error) throw result.error;
  return result.data || [];
}

async function persistTimelineRows(rows) {
  if (!rows || rows.length === 0) return [];
  var result = await supabase.from("cost_timeline_projections").insert(rows).select();
  if (result.error) throw result.error;
  return result.data || [];
}

async function persistDecisionOutput(payload) {
  var result = await supabase.from("cost_decision_outputs").insert(payload).select().single();
  if (result.error) throw result.error;
  return result.data;
}

async function emitAuditEvent(caseId, orgId, actionType, eventJson) {
  var result = await supabase.from("cost_audit_events").insert({
    case_id: caseId,
    org_id: orgId,
    action_type: actionType,
    event_json: eventJson
  });
  if (result.error) throw result.error;
}

// ============================================================
// CORE: SCENARIO CALCULATOR
// ============================================================

async function calculateScenarios(input) {
  var assumptions = await getDefaultAssumptions();
  var assumptionJson = assumptions ? assumptions.assumption_json || {} : {};
  var currency = "USD";

  var assetType = input.asset_context ? input.asset_context.asset_type : "pipeline";
  var componentType = input.asset_context ? input.asset_context.component_type : undefined;
  var failurePathways = input.failure_pathways || [];
  var topPathway = failurePathways.length > 0 ? failurePathways[0] : null;
  var failureMode = topPathway ? (topPathway.failure_mode || topPathway.path || "fatigue_crack") : "fatigue_crack";
  var consequenceLevel = topPathway ? (topPathway.consequence_level || "high") : "high";
  var confidence = Number(input.current_decision_confidence || 0.75);
  var probabilityOfFailure = clamp(Number(topPathway ? topPathway.plausibility : 0.35), 0, 1);

  // ---- Authority integration ----
  // TODO: When authority_output comes from Concept Intelligence v2.1,
  // adjust confidence floor and probability floor based on authority_state
  var authorityState = input.authority_output ? input.authority_output.authority_state : "stable";
  if (authorityState === "hold" || authorityState === "escalate") {
    // Under HOLD/ESCALATE, apply consequence floor from assumptions
    var probFloor = Number(assumptionJson.high_consequence_failure_probability_floor || 0.10);
    if (consequenceLevel === "critical") {
      probFloor = Number(assumptionJson.critical_failure_probability_floor || 0.20);
    }
    if (probabilityOfFailure < probFloor) {
      probabilityOfFailure = probFloor;
    }
  }

  // ---- Concept integration ----
  // TODO: When concept_output comes from Concept Intelligence Core v2.0,
  // use governing concept confidence to weight uncertainty calculation
  // and blind_spot flags to force additional inspection scenarios

  // ---- Lookup cost models ----
  var repairModel = await getCostModel(assetType, componentType, failureMode, "repair_now");
  var deferredModel = await getCostModel(assetType, componentType, failureMode, "deferred_repair");
  var failureModel = await getCostModel(assetType, componentType, failureMode, "failure_event");
  var failureProfile = await getFailureProfile(failureMode, consequenceLevel);

  // ---- Calculate base costs ----
  var ctx = input.asset_context || {};
  var repairNowCost = repairModel ? applyMultipliers(Number(repairModel.base_cost), repairModel.multiplier_json || {}, ctx) : 0;
  var deferredRepairCost = deferredModel ? applyMultipliers(Number(deferredModel.base_cost), deferredModel.multiplier_json || {}, ctx) : round2(repairNowCost * 1.5);
  var baseFailureModelCost = failureModel ? applyMultipliers(Number(failureModel.base_cost), failureModel.multiplier_json || {}, ctx) : 0;
  var failureTotalFromProfile = failureProfile ? failureCostTotal(failureProfile) : 0;
  var topFailureCost = Math.max(baseFailureModelCost, failureTotalFromProfile);

  // ---- Formula: Expected Cost = P(failure) x Failure Cost Total ----
  var expectedFailureCost = expectedCost(probabilityOfFailure, topFailureCost);

  // ---- Formula: Cost of Uncertainty = Expected x Multiplier x (1 - Confidence) ----
  var uncertaintyMultiplier = Number(assumptionJson.uncertainty_cost_multiplier || 0.15);
  var uncertaintyCost = calculateCostOfUncertainty(expectedFailureCost, confidence, uncertaintyMultiplier);

  // ---- Inspection cost / VOI for follow-up methods ----
  var inspectFurtherCost = 0;
  var voiOutputs = [];
  var followUpMethods = input.recommended_follow_up_methods || [];
  var uncertaintyReductionFactor = Number(assumptionJson.inspection_uncertainty_reduction_factor || 0.35);

  for (var mi = 0; mi < followUpMethods.length; mi++) {
    var method = followUpMethods[mi];
    var profile = await getInspectionProfile(method);
    if (profile) {
      var methodCost = Number(profile.mobilization_cost || 0) + Number(profile.execution_cost || 0) + Number(profile.analysis_cost || 0) + Number(profile.outage_cost || 0);
      inspectFurtherCost = inspectFurtherCost + methodCost;
      // Formula: VOI = Expected Before - Expected After - Inspection Cost
      var expectedAfter = round2(expectedFailureCost * (1 - uncertaintyReductionFactor));
      var voi = round2(expectedFailureCost - expectedAfter - methodCost);
      voiOutputs.push({
        method: method,
        inspection_cost: round2(methodCost),
        expected_cost_before: expectedFailureCost,
        expected_cost_after: expectedAfter,
        value_of_information: voi,
        currency_code: currency
      });
    }
  }

  // ---- Formula: Do Nothing Cost = Expected Failure + Uncertainty Carry ----
  var doNothingCost = round2(expectedFailureCost + uncertaintyCost);

  // ---- Formula: Monitor cost retains risk fraction ----
  var monitorRiskRetention = Number(assumptionJson.monitoring_risk_retention_factor || 0.35);
  var monitorCost = round2(expectedFailureCost * monitorRiskRetention + uncertaintyCost * 0.5);

  // ---- Formula: Inspect further expected = inspection spend + reduced expected failure ----
  var inspectFurtherExpected = round2(inspectFurtherCost + expectedFailureCost * (1 - uncertaintyReductionFactor));

  // ---- Residual risk after repair ----
  var residualRiskFactor = Number(assumptionJson.residual_risk_after_repair || 0.15);

  // ---- Build scenarios ----
  var scenarios = [
    {
      scenario_type: "repair_now",
      immediate_cost: repairNowCost,
      expected_cost: repairNowCost,
      risk_exposure: round2(expectedFailureCost * residualRiskFactor),
      avoided_cost: round2(doNothingCost - repairNowCost),
      roi_value: calculateROI(repairNowCost, round2(doNothingCost - repairNowCost)),
      confidence: confidence,
      currency_code: currency,
      summary: "Immediate repair eliminates primary failure pathway. Residual risk " + formatDollars(expectedFailureCost * residualRiskFactor) + "."
    },
    {
      scenario_type: "inspect_further",
      immediate_cost: round2(inspectFurtherCost),
      expected_cost: inspectFurtherExpected,
      risk_exposure: round2(expectedFailureCost * (1 - uncertaintyReductionFactor)),
      avoided_cost: round2(doNothingCost - inspectFurtherExpected),
      roi_value: calculateROI(round2(inspectFurtherCost), round2(doNothingCost - inspectFurtherExpected)),
      confidence: confidence,
      currency_code: currency,
      summary: "Follow-up inspection reduces uncertainty by " + Math.round(uncertaintyReductionFactor * 100) + "% before major spend decision."
    },
    {
      scenario_type: "monitor",
      immediate_cost: 0,
      expected_cost: monitorCost,
      risk_exposure: round2(expectedFailureCost * monitorRiskRetention),
      avoided_cost: round2(doNothingCost - monitorCost),
      roi_value: 0,
      confidence: confidence,
      currency_code: currency,
      summary: "Monitoring defers direct spend but retains " + Math.round(monitorRiskRetention * 100) + "% risk exposure."
    },
    {
      scenario_type: "do_nothing",
      immediate_cost: 0,
      expected_cost: doNothingCost,
      risk_exposure: doNothingCost,
      avoided_cost: 0,
      roi_value: 0,
      confidence: confidence,
      currency_code: currency,
      summary: "No action carries full risk-weighted exposure of " + formatDollars(doNothingCost) + "."
    }
  ];

  // Sort by expected cost ascending — best financial option first
  scenarios.sort(function(a, b) { return a.expected_cost - b.expected_cost; });
  var bestScenario = scenarios[0];

  // ---- Build failure cost breakdown ----
  var failureBreakdowns = [];
  if (failureProfile) {
    failureBreakdowns.push({
      failure_mode: failureMode,
      consequence_level: consequenceLevel,
      direct_repair_cost: Number(failureProfile.direct_repair_cost || 0),
      downtime_cost: Number(failureProfile.downtime_cost || 0),
      collateral_damage_cost: Number(failureProfile.collateral_damage_cost || 0),
      environmental_cost: Number(failureProfile.environmental_cost || 0),
      safety_liability_cost: Number(failureProfile.safety_liability_cost || 0),
      regulatory_cost: Number(failureProfile.regulatory_cost || 0),
      total_failure_cost: round2(topFailureCost),
      currency_code: currency
    });
  }

  // ---- Build executive summary ----
  var execParts = [];
  execParts.push("Repair now: " + formatDollars(repairNowCost) + ".");
  if (deferredRepairCost > repairNowCost) {
    execParts.push("Deferral increases likely spend to " + formatDollars(deferredRepairCost) + ".");
  }
  execParts.push("Failure in service: " + formatDollars(topFailureCost) + " consequence exposure.");
  execParts.push("Risk-weighted do-nothing cost: " + formatDollars(doNothingCost) + ".");
  if (voiOutputs.length > 0) {
    var bestVoi = voiOutputs[0];
    for (var vi = 1; vi < voiOutputs.length; vi++) {
      if (voiOutputs[vi].value_of_information > bestVoi.value_of_information) {
        bestVoi = voiOutputs[vi];
      }
    }
    if (bestVoi.value_of_information > 0) {
      execParts.push(bestVoi.method + " inspection adds " + formatDollars(bestVoi.value_of_information) + " in decision value for " + formatDollars(bestVoi.inspection_cost) + " spend.");
    }
  }
  execParts.push("Recommended: " + bestScenario.scenario_type.replace(/_/g, " ") + ".");

  var recommendedAction = bestScenario.scenario_type;
  if (recommendedAction === "inspect_further") {
    recommendedAction = "Perform follow-up inspection immediately";
  } else if (recommendedAction === "repair_now") {
    recommendedAction = "Execute repair now";
  } else if (recommendedAction === "monitor") {
    recommendedAction = "Implement condition monitoring program";
  } else {
    recommendedAction = bestScenario.scenario_type.replace(/_/g, " ");
  }

  var topVoiValue = 0;
  for (var vj = 0; vj < voiOutputs.length; vj++) {
    if (voiOutputs[vj].value_of_information > topVoiValue) {
      topVoiValue = voiOutputs[vj].value_of_information;
    }
  }

  var decisionSummary = {
    case_id: input.case_id,
    recommended_action: recommendedAction,
    best_scenario_type: bestScenario.scenario_type,
    repair_now_cost: repairNowCost,
    inspect_further_cost: round2(inspectFurtherCost),
    monitor_cost: monitorCost,
    do_nothing_expected_cost: doNothingCost,
    deferred_repair_cost: round2(deferredRepairCost),
    top_failure_cost: round2(topFailureCost),
    top_value_of_information: topVoiValue,
    cost_of_uncertainty: uncertaintyCost,
    probability_of_failure: probabilityOfFailure,
    confidence: confidence,
    authority_state: authorityState,
    currency_code: currency,
    executive_summary: execParts.join(" ")
  };

  return {
    scenario_outputs: scenarios,
    failure_cost_breakdowns: failureBreakdowns,
    timeline_projections: [],
    value_of_information_outputs: voiOutputs,
    decision_summary: decisionSummary,
    assumptions_used: assumptionJson,
    models_matched: {
      repair_now: repairModel ? true : false,
      deferred_repair: deferredModel ? true : false,
      failure_event: failureModel ? true : false,
      failure_profile: failureProfile ? true : false
    }
  };
}

// ============================================================
// CORE: TIMELINE BUILDER
// ============================================================

function buildTimeline(caseId, orgId, scenarios, probabilityOfFailureBase) {
  var horizons = ["immediate", "3_month", "12_month", "36_month"];
  var factors = { "immediate": 1.0, "3_month": 1.05, "12_month": 1.2, "36_month": 1.5 };
  var probFactors = { "immediate": 1.0, "3_month": 1.1, "12_month": 1.35, "36_month": 1.75 };
  var rows = [];

  for (var si = 0; si < scenarios.length; si++) {
    var scenario = scenarios[si];
    for (var hi = 0; hi < horizons.length; hi++) {
      var horizon = horizons[hi];
      var factor = factors[horizon] || 1.0;
      var probability = clamp(probabilityOfFailureBase * (probFactors[horizon] || 1.0), 0, 1);
      var projectedCost = round2(scenario.expected_cost * factor);

      rows.push({
        case_id: caseId,
        org_id: orgId,
        scenario_type: scenario.scenario_type,
        time_horizon: horizon,
        projected_cost: projectedCost,
        probability_of_failure: probability,
        projection_json: {
          scenario_type: scenario.scenario_type,
          time_horizon: horizon,
          factor: factor,
          projected_cost: projectedCost,
          probability_of_failure: probability
        }
      });
    }
  }

  return rows;
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
        scenario_types: SCENARIO_TYPES,
        integrations: INTEGRATION_MAP,
        actions: [
          "get_registry",
          "calculate_cost_scenarios",
          "get_failure_cost",
          "evaluate_decision_roi",
          "generate_cost_summary",
          "project_cost_timeline",
          "calculate_value_of_information"
        ]
      });
    }

    // ========================================================
    // ACTION: calculate_cost_scenarios
    // ========================================================
    if (action === "calculate_cost_scenarios") {
      var input = body.input;
      if (!input || !input.case_id || !input.org_id || !input.asset_context || !input.asset_context.asset_type) {
        return json(400, { ok: false, error: "Missing required: input.case_id, input.org_id, input.asset_context.asset_type" });
      }

      var output = await calculateScenarios(input);

      // Persist scenario rows
      await persistScenarioRows(input.case_id, input.org_id, output.scenario_outputs);

      // Audit hook
      await emitAuditEvent(input.case_id, input.org_id, "calculate_cost_scenarios", {
        best_scenario: output.decision_summary.best_scenario_type,
        repair_now_cost: output.decision_summary.repair_now_cost,
        do_nothing_cost: output.decision_summary.do_nothing_expected_cost,
        models_matched: output.models_matched,
        assumptions: output.assumptions_used
      });

      return json(200, {
        ok: true,
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        output: output
      });
    }

    // ========================================================
    // ACTION: project_cost_timeline
    // ========================================================
    if (action === "project_cost_timeline") {
      var tInput = body.input;
      if (!tInput || !tInput.case_id || !tInput.org_id || !Array.isArray(tInput.scenarios)) {
        return json(400, { ok: false, error: "Missing required: input.case_id, input.org_id, input.scenarios[]" });
      }

      var probBase = Number(tInput.probability_of_failure_base || 0.35);
      var timelineRows = buildTimeline(tInput.case_id, tInput.org_id, tInput.scenarios, probBase);
      await persistTimelineRows(timelineRows);
      await emitAuditEvent(tInput.case_id, tInput.org_id, "project_cost_timeline", {
        row_count: timelineRows.length,
        scenarios_count: tInput.scenarios.length,
        probability_base: probBase
      });

      return json(200, {
        ok: true,
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        projections: timelineRows
      });
    }

    // ========================================================
    // ACTION: get_failure_cost
    // ========================================================
    if (action === "get_failure_cost") {
      var fMode = body.failure_mode;
      var fLevel = body.consequence_level || "high";
      if (!fMode) {
        return json(400, { ok: false, error: "Missing failure_mode" });
      }

      var fProfile = await getFailureProfile(fMode, fLevel);
      var fTotal = fProfile ? failureCostTotal(fProfile) : 0;

      return json(200, {
        ok: true,
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        profile: fProfile,
        total_failure_cost: fTotal,
        breakdown: fProfile ? {
          direct_repair_cost: Number(fProfile.direct_repair_cost || 0),
          downtime_cost: Number(fProfile.downtime_cost || 0),
          collateral_damage_cost: Number(fProfile.collateral_damage_cost || 0),
          environmental_cost: Number(fProfile.environmental_cost || 0),
          safety_liability_cost: Number(fProfile.safety_liability_cost || 0),
          regulatory_cost: Number(fProfile.regulatory_cost || 0)
        } : null
      });
    }

    // ========================================================
    // ACTION: calculate_value_of_information
    // ========================================================
    if (action === "calculate_value_of_information") {
      var voiMethod = body.method;
      var voiExpectedBefore = Number(body.expected_cost_before || 0);
      var voiExpectedAfter = Number(body.expected_cost_after || 0);
      if (!voiMethod) {
        return json(400, { ok: false, error: "Missing method" });
      }

      var iProfile = await getInspectionProfile(voiMethod);
      var iCost = iProfile ? Number(iProfile.mobilization_cost || 0) + Number(iProfile.execution_cost || 0) + Number(iProfile.analysis_cost || 0) + Number(iProfile.outage_cost || 0) : 0;
      // Formula: VOI = Expected Before - Expected After - Inspection Cost
      var voiValue = round2(voiExpectedBefore - voiExpectedAfter - iCost);

      return json(200, {
        ok: true,
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        output: {
          method: voiMethod,
          inspection_cost: round2(iCost),
          expected_cost_before: voiExpectedBefore,
          expected_cost_after: voiExpectedAfter,
          value_of_information: voiValue,
          roi: iCost > 0 ? calculateROI(iCost, voiValue) : 0,
          currency_code: "USD"
        },
        inspection_profile: iProfile
      });
    }

    // ========================================================
    // ACTION: evaluate_decision_roi
    // ========================================================
    if (action === "evaluate_decision_roi") {
      var roiActionCost = Number(body.action_cost || 0);
      var roiAvoidedCost = Number(body.avoided_cost || 0);
      var roiVal = calculateROI(roiActionCost, roiAvoidedCost);

      return json(200, {
        ok: true,
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        action_cost: roiActionCost,
        avoided_cost: roiAvoidedCost,
        roi_value: roiVal,
        roi_percentage: round2(roiVal * 100) + "%",
        interpretation: roiVal > 5 ? "Very high ROI — strong case for action" :
                        roiVal > 2 ? "High ROI — clear financial benefit" :
                        roiVal > 1 ? "Positive ROI — action pays for itself" :
                        roiVal > 0 ? "Marginal ROI — action justified but narrow margin" :
                        "Negative ROI — action costs more than it saves"
      });
    }

    // ========================================================
    // ACTION: generate_cost_summary
    // ========================================================
    if (action === "generate_cost_summary") {
      var sInput = body.input;
      if (!sInput || !sInput.case_id || !sInput.org_id || !sInput.asset_context || !sInput.asset_context.asset_type) {
        return json(400, { ok: false, error: "Missing required: input.case_id, input.org_id, input.asset_context.asset_type" });
      }

      var sOutput = await calculateScenarios(sInput);

      // Persist scenario rows
      await persistScenarioRows(sInput.case_id, sInput.org_id, sOutput.scenario_outputs);

      // Build timeline automatically
      var sProb = sOutput.decision_summary.probability_of_failure || 0.35;
      var sTimeline = buildTimeline(sInput.case_id, sInput.org_id, sOutput.scenario_outputs, sProb);
      await persistTimelineRows(sTimeline);
      sOutput.timeline_projections = sTimeline;

      // Persist decision output
      var decisionRecord = await persistDecisionOutput({
        case_id: sInput.case_id,
        org_id: sInput.org_id,
        recommended_action: sOutput.decision_summary.recommended_action,
        best_scenario_type: sOutput.decision_summary.best_scenario_type,
        cost_summary_json: sOutput.decision_summary,
        roi_json: sOutput.scenario_outputs,
        narrative_json: {
          executive_summary: sOutput.decision_summary.executive_summary,
          assumptions_used: sOutput.assumptions_used,
          models_matched: sOutput.models_matched
        },
        engine_version: ENGINE_VERSION
      });

      // Audit hook — full summary generation
      await emitAuditEvent(sInput.case_id, sInput.org_id, "generate_cost_summary", {
        decision_output_id: decisionRecord.id,
        best_scenario: sOutput.decision_summary.best_scenario_type,
        repair_now_cost: sOutput.decision_summary.repair_now_cost,
        do_nothing_cost: sOutput.decision_summary.do_nothing_expected_cost,
        top_failure_cost: sOutput.decision_summary.top_failure_cost,
        models_matched: sOutput.models_matched,
        assumptions: sOutput.assumptions_used,
        timeline_rows: sTimeline.length
      });

      return json(200, {
        ok: true,
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        decision_output: decisionRecord,
        output: sOutput
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
