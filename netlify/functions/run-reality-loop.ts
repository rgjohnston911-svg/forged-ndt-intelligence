/**
 * DEPLOY50 — run-reality-loop.ts
 * netlify/functions/run-reality-loop.ts
 *
 * Closed-Loop Reality Engine (Klein Bottle Implementation)
 * Transforms linear inspection into continuous reality-feedback:
 *   Reality -> Model -> Future -> Decision -> Reality
 *
 * Reads convergence + authority data from case, projects 3 scenarios
 * (repair/monitor/no-action) with 12/24/36 month failure risk,
 * stores state snapshots, updates case with loop results.
 *
 * CONSTRAINT: No backtick template literals (Git Bash paste corruption)
 */
import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/* ================================================================
   TYPES
================================================================ */

interface RealitySnapshot {
  id: string;
  case_id: string;
  state: string;
  finding_code: string;
  confidence: number;
  severity_index: number;
  consequence_index: number;
  progression_rate: number;
  failure_mode: string;
  risk_12_month: number;
  risk_24_month: number;
  risk_36_month: number;
  decision: string | null;
}

/* ================================================================
   SEVERITY + RISK PROJECTION LOGIC
================================================================ */

function computeSeverityIndex(confidence: number, findingCode: string): number {
  var baseSeverity: Record<string, number> = {
    crack: 0.95,
    hydrogen_cracking: 0.92,
    incomplete_fusion: 0.85,
    incomplete_penetration: 0.82,
    burn_through: 0.80,
    undercut: 0.55,
    slag_inclusion: 0.50,
    porosity: 0.40,
    reinforcement: 0.20,
    overlap: 0.30,
    unknown: 0.50
  };
  var code = (findingCode || "unknown").toLowerCase().replace(/ /g, "_");
  var base = baseSeverity[code] || 0.50;
  return Math.round(base * confidence * 100) / 100;
}

function computeConsequenceIndex(findingCode: string, loadCondition: string): number {
  var code = (findingCode || "unknown").toLowerCase().replace(/ /g, "_");
  var load = (loadCondition || "unknown").toLowerCase();

  var baseConsequence = 0.5;
  if (["crack", "hydrogen_cracking", "incomplete_fusion", "incomplete_penetration"].indexOf(code) !== -1) {
    baseConsequence = 0.85;
  } else if (["undercut", "burn_through"].indexOf(code) !== -1) {
    baseConsequence = 0.60;
  } else if (["porosity", "slag_inclusion"].indexOf(code) !== -1) {
    baseConsequence = 0.40;
  }

  if (["dynamic", "cyclic", "cyclic_pressure"].indexOf(load) !== -1) {
    baseConsequence = Math.min(1.0, baseConsequence * 1.3);
  } else if (["pressure", "high_temp"].indexOf(load) !== -1) {
    baseConsequence = Math.min(1.0, baseConsequence * 1.2);
  }

  return Math.round(baseConsequence * 100) / 100;
}

function computeProgressionRate(findingCode: string, serviceEnv: string): number {
  var code = (findingCode || "unknown").toLowerCase().replace(/ /g, "_");
  var env = (serviceEnv || "unknown").toUpperCase();

  var baseRate = 0.05;
  if (["crack", "hydrogen_cracking", "stress_corrosion_cracking", "fatigue_cracking"].indexOf(code) !== -1) {
    baseRate = 0.15;
  } else if (["uniform_corrosion", "pitting_corrosion", "erosion"].indexOf(code) !== -1) {
    baseRate = 0.10;
  } else if (["undercut", "incomplete_fusion"].indexOf(code) !== -1) {
    baseRate = 0.08;
  } else if (["porosity", "slag_inclusion"].indexOf(code) !== -1) {
    baseRate = 0.03;
  }

  if (["MARINE", "IMMERSION_SALT_WATER", "SOUR_SERVICE"].indexOf(env) !== -1) {
    baseRate = baseRate * 1.5;
  } else if (["CHEMICAL_PROCESS", "HIGH_TEMPERATURE", "CYCLIC_PRESSURE"].indexOf(env) !== -1) {
    baseRate = baseRate * 1.3;
  }

  return Math.round(Math.min(1.0, baseRate) * 100) / 100;
}

function projectFailureRisk(severity: number, consequence: number, progression: number, months: number): number {
  var risk = severity * consequence * (1 - Math.exp(-progression * months));
  return Math.round(Math.min(1.0, Math.max(0, risk)) * 1000) / 1000;
}

function projectScenario(severity: number, consequence: number, progression: number, action: string) {
  var adjSeverity = severity;
  var adjProgression = progression;

  if (action === "REPAIR") {
    adjSeverity = severity * 0.2;
    adjProgression = progression * 0.2;
  } else if (action === "MONITOR") {
    adjProgression = progression * 0.7;
  }

  return {
    severity: adjSeverity,
    progression: adjProgression,
    risk12: projectFailureRisk(adjSeverity, consequence, adjProgression, 12),
    risk24: projectFailureRisk(adjSeverity, consequence, adjProgression, 24),
    risk36: projectFailureRisk(adjSeverity, consequence, adjProgression, 36)
  };
}

function uuid(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/* ================================================================
   NARRATIVE ENGINE
================================================================ */

function buildNarrative(action: string, baseRisk12: number, appliedRisk12: number, failureMode: string): string {
  var baseP = Math.round(baseRisk12 * 100);
  var newP = Math.round(appliedRisk12 * 100);
  var mode = (failureMode || "progressive degradation").replace(/_/g, " ");

  if (action === "REPAIR") {
    return "Repair action reduced projected 12-month " + mode + " risk from " + baseP + "% to " + newP + "%. Severity index reduced by 80%. Progression rate reduced by 80%. Reality state updated and stabilized. Next inspection interval can be extended.";
  }
  if (action === "MONITOR") {
    return "Monitoring action adjusted progression rate by 30%. 12-month " + mode + " risk adjusted from " + baseP + "% to " + newP + "%. Degradation continues at reduced rate. Re-inspection recommended within monitoring interval.";
  }
  if (action === "REINSPECT") {
    return "Re-inspection ordered. Current reality state preserved at " + baseP + "% 12-month risk. Additional data collection required before projection update.";
  }
  if (action === "ESCALATE") {
    return "Escalated to engineering assessment. Current " + mode + " risk at " + baseP + "% over 12 months requires fitness-for-service evaluation beyond standard inspection authority.";
  }
  return "No action taken. System maintains original " + mode + " trajectory at " + baseP + "% risk within 12 months. Progression rate unchanged. Next scheduled inspection applies.";
}

function determineFailureMode(findingCode: string): string {
  var code = (findingCode || "unknown").toLowerCase().replace(/ /g, "_");
  if (["crack", "hydrogen_cracking", "fatigue_cracking", "stress_corrosion_cracking"].indexOf(code) !== -1) return "crack_propagation_to_failure";
  if (["incomplete_fusion", "incomplete_penetration"].indexOf(code) !== -1) return "joint_integrity_loss";
  if (["undercut", "burn_through"].indexOf(code) !== -1) return "stress_concentration_failure";
  if (["uniform_corrosion", "pitting_corrosion", "erosion", "general_wall_loss"].indexOf(code) !== -1) return "wall_loss_to_leak_or_rupture";
  if (["porosity", "slag_inclusion"].indexOf(code) !== -1) return "reduced_load_capacity";
  return "progressive_degradation";
}

/* ================================================================
   NETLIFY HANDLER
================================================================ */

function headers() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };
}

var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: headers(), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: headers(), body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var caseId = body.caseId;
    var selectedAction = (body.action || "NO_ACTION").toUpperCase();

    if (!caseId) {
      return { statusCode: 400, headers: headers(), body: JSON.stringify({ error: "caseId is required" }) };
    }

    var validActions = ["REPAIR", "MONITOR", "NO_ACTION", "REINSPECT", "ESCALATE"];
    if (validActions.indexOf(selectedAction) === -1) {
      selectedAction = "NO_ACTION";
    }

    var sb = createClient(supabaseUrl, supabaseKey);

    /* ---- Read case data ---- */
    var caseRes = await sb.from("inspection_cases").select("*").eq("id", caseId).single();
    if (caseRes.error || !caseRes.data) {
      return { statusCode: 404, headers: headers(), body: JSON.stringify({ error: "Case not found" }) };
    }
    var cd = caseRes.data;

    /* ---- Determine finding from convergence or findings ---- */
    var findingCode = "unknown";
    var findingConfidence = 0.5;

    if (cd.dominant_reality) {
      findingCode = cd.dominant_reality;
      findingConfidence = cd.dominant_score || 0.5;
    } else {
      /* Fall back to highest-confidence finding */
      var fRes = await sb.from("findings").select("label, confidence").eq("case_id", caseId).order("confidence", { ascending: false }).limit(1).single();
      if (fRes.data) {
        findingCode = (fRes.data.label || "unknown").toLowerCase().replace(/ /g, "_");
        findingConfidence = fRes.data.confidence || 0.5;
      }
    }

    /* ---- Compute indices ---- */
    var severity = computeSeverityIndex(findingConfidence, findingCode);
    var consequence = computeConsequenceIndex(findingCode, cd.load_condition || "unknown");
    var progression = computeProgressionRate(findingCode, cd.service_environment || "UNKNOWN");
    var failureMode = determineFailureMode(findingCode);

    /* ---- Project all 3 scenarios ---- */
    var noActionScenario = projectScenario(severity, consequence, progression, "NO_ACTION");
    var repairScenario = projectScenario(severity, consequence, progression, "REPAIR");
    var monitorScenario = projectScenario(severity, consequence, progression, "MONITOR");

    /* ---- Get applied scenario based on selected action ---- */
    var applied = noActionScenario;
    if (selectedAction === "REPAIR") applied = repairScenario;
    else if (selectedAction === "MONITOR") applied = monitorScenario;

    /* ---- Build state snapshots ---- */
    var now = Date.now();
    var snapshots: RealitySnapshot[] = [
      {
        id: uuid(), case_id: caseId, state: "INITIAL_OBSERVATION",
        finding_code: findingCode, confidence: findingConfidence,
        severity_index: severity, consequence_index: consequence,
        progression_rate: progression, failure_mode: failureMode,
        risk_12_month: noActionScenario.risk12, risk_24_month: noActionScenario.risk24,
        risk_36_month: noActionScenario.risk36, decision: null
      },
      {
        id: uuid(), case_id: caseId, state: "CONVERGED_REALITY",
        finding_code: findingCode, confidence: findingConfidence,
        severity_index: severity, consequence_index: consequence,
        progression_rate: progression, failure_mode: failureMode,
        risk_12_month: noActionScenario.risk12, risk_24_month: noActionScenario.risk24,
        risk_36_month: noActionScenario.risk36, decision: null
      },
      {
        id: uuid(), case_id: caseId, state: "OUTCOME_PROJECTED",
        finding_code: findingCode, confidence: findingConfidence,
        severity_index: severity, consequence_index: consequence,
        progression_rate: progression, failure_mode: failureMode,
        risk_12_month: noActionScenario.risk12, risk_24_month: noActionScenario.risk24,
        risk_36_month: noActionScenario.risk36, decision: null
      },
      {
        id: uuid(), case_id: caseId, state: "DECISION_APPLIED",
        finding_code: findingCode, confidence: findingConfidence,
        severity_index: severity, consequence_index: consequence,
        progression_rate: progression, failure_mode: failureMode,
        risk_12_month: applied.risk12, risk_24_month: applied.risk24,
        risk_36_month: applied.risk36, decision: selectedAction
      },
      {
        id: uuid(), case_id: caseId, state: "REALITY_UPDATED",
        finding_code: findingCode, confidence: findingConfidence,
        severity_index: applied.severity, consequence_index: consequence,
        progression_rate: applied.progression, failure_mode: failureMode,
        risk_12_month: applied.risk12, risk_24_month: applied.risk24,
        risk_36_month: applied.risk36, decision: selectedAction
      }
    ];

    /* ---- Build narrative ---- */
    var narrative = buildNarrative(selectedAction, noActionScenario.risk12, applied.risk12, failureMode);

    /* ---- Store snapshots ---- */
    var snapInsert = await sb.from("reality_snapshots").insert(snapshots);
    if (snapInsert.error) { console.log("WARNING: snapshot insert failed: " + JSON.stringify(snapInsert.error)); }

    /* ---- Store loop record ---- */
    var loopRow = {
      case_id: caseId,
      loop_state: "CLOSED_LOOP_ACTIVE",
      selected_action: selectedAction,
      loop_narrative: narrative,
      severity_before: severity,
      severity_after: applied.severity,
      progression_before: progression,
      progression_after: applied.progression,
      risk_12_before: noActionScenario.risk12,
      risk_12_after: applied.risk12,
      risk_24_before: noActionScenario.risk24,
      risk_24_after: applied.risk24,
      risk_36_before: noActionScenario.risk36,
      risk_36_after: applied.risk36,
      snapshot_count: snapshots.length
    };
    var loopInsert = await sb.from("reality_loops").insert([loopRow]);
    if (loopInsert.error) { console.log("WARNING: loop insert failed: " + JSON.stringify(loopInsert.error)); }

    /* ---- Update case ---- */
    var caseUpdate = await sb.from("inspection_cases").update({
      reality_loop_active: true,
      reality_loop_action: selectedAction,
      reality_risk_12_month: applied.risk12,
      reality_risk_24_month: applied.risk24,
      reality_risk_36_month: applied.risk36
    }).eq("id", caseId);
    if (caseUpdate.error) { console.log("WARNING: case update failed: " + JSON.stringify(caseUpdate.error)); }

    /* ---- Return ---- */
    return {
      statusCode: 200,
      headers: headers(),
      body: JSON.stringify({
        success: true,
        caseId: caseId,
        action: selectedAction,
        narrative: narrative,
        failureMode: failureMode,
        scenarios: {
          noAction: { risk12: noActionScenario.risk12, risk24: noActionScenario.risk24, risk36: noActionScenario.risk36, severity: severity, progression: progression },
          repair: { risk12: repairScenario.risk12, risk24: repairScenario.risk24, risk36: repairScenario.risk36, severity: repairScenario.severity, progression: repairScenario.progression },
          monitor: { risk12: monitorScenario.risk12, risk24: monitorScenario.risk24, risk36: monitorScenario.risk36, severity: monitorScenario.severity, progression: monitorScenario.progression }
        },
        applied: { severity: applied.severity, progression: applied.progression, risk12: applied.risk12, risk24: applied.risk24, risk36: applied.risk36 },
        loopState: "CLOSED_LOOP_ACTIVE",
        snapshotCount: snapshots.length
      })
    };

  } catch (err: any) {
    console.log("run-reality-loop error: " + String(err));
    return { statusCode: 500, headers: headers(), body: JSON.stringify({ error: "Internal error", detail: String(err) }) };
  }
};

export { handler };
