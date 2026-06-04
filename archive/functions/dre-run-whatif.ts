/**
 * DEPLOY60 — dre-run-whatif.ts
 * netlify/functions/dre-run-whatif.ts
 *
 * Damage Reality Engine — What-If Scenario Runner
 * Projects risk change under different decision scenarios
 *
 * POST { org_id, damage_case_id, scenario_name }
 *
 * Scenarios:
 *   no_inspection — leave hidden damage mechanisms unresolved
 *   delayed_7_days — allow active damage to progress
 *   vt_only — miss sub-surface and hidden damage
 *   wrong_method — create false confidence
 *   continued_operation_under_load — amplify existing damage
 *
 * CONSTRAINT: String concatenation only — no backtick template literals
 */

import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function computeWhatIf(eval_data: any, scenario: string): any {
  var riskDelta = 0;
  var hiddenDelta = 0;
  var urgencyDelta = 0;
  var confDelta = 0;
  var notes: string[] = [];

  if (scenario === "no_inspection") {
    riskDelta = 15;
    hiddenDelta = 12;
    urgencyDelta = 10;
    confDelta = -10;
    notes.push("No inspection leaves hidden damage mechanisms unresolved.");
    notes.push("Condition may deteriorate without detection.");
    notes.push("Regulatory compliance gaps may develop.");
  }
  if (scenario === "delayed_7_days") {
    riskDelta = 10;
    hiddenDelta = 8;
    urgencyDelta = 6;
    confDelta = -6;
    notes.push("7-day delay may allow crack growth, corrosion progression, or worsening instability.");
    notes.push("Active damage mechanisms do not pause.");
    notes.push("Environmental exposure during delay may compound original event.");
  }
  if (scenario === "vt_only") {
    riskDelta = 8;
    hiddenDelta = 10;
    confDelta = -8;
    notes.push("VT alone can miss hidden cracking, wall loss, and backside damage.");
    notes.push("Sub-surface and internal conditions remain uncharacterized.");
    notes.push("False confidence may result from clean-looking visual.");
  }
  if (scenario === "wrong_method") {
    riskDelta = 12;
    hiddenDelta = 14;
    confDelta = -12;
    notes.push("Wrong method selection can create false confidence and miss the dominant mechanism.");
    notes.push("PT cannot find subsurface defects. MT does not work on non-ferromagnetic materials.");
    notes.push("UT without proper calibration misses critical sizing information.");
  }
  if (scenario === "continued_operation_under_load") {
    riskDelta = 18;
    hiddenDelta = 10;
    urgencyDelta = 14;
    notes.push("Continued operation can amplify existing damage and trigger secondary failures.");
    notes.push("Dynamic loading accelerates crack growth.");
    notes.push("Thermal cycling accelerates corrosion and fatigue interaction.");
  }

  var baseRisk = eval_data.overall_damage_risk || 0;
  var baseHidden = eval_data.hidden_damage_likelihood_score || 0;
  var baseUrgency = eval_data.inspection_urgency_score || 0;
  var baseConf = eval_data.confidence_score || 0;

  var projectedRisk = clamp(baseRisk + riskDelta, 0, 100);
  var projectedHidden = clamp(baseHidden + hiddenDelta, 0, 100);
  var projectedUrgency = clamp(baseUrgency + urgencyDelta, 0, 100);
  var projectedConf = clamp(baseConf + confDelta, 0, 100);

  var projectedDisp = "continue_normal";
  if (projectedRisk >= 25) projectedDisp = "targeted_inspection";
  if (projectedRisk >= 50) projectedDisp = "priority_inspection_required";
  if (projectedRisk >= 70) projectedDisp = "restricted_operation";
  if (projectedRisk >= 80) projectedDisp = "inspection_before_return";
  if (projectedRisk >= 90) projectedDisp = "shutdown_consideration";

  return {
    scenario: scenario,
    base_risk: baseRisk,
    projected_risk: projectedRisk,
    risk_delta: riskDelta,
    projected_hidden_damage: projectedHidden,
    projected_urgency: projectedUrgency,
    projected_confidence: projectedConf,
    base_disposition: eval_data.operational_disposition,
    projected_disposition: projectedDisp,
    disposition_changed: projectedDisp !== eval_data.operational_disposition,
    notes: notes,
  };
}

var handler: Handler = async function(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
    }

    var body = JSON.parse(event.body || "{}");
    var orgId = body.org_id;
    var damageCaseId = body.damage_case_id;
    var scenarioName = body.scenario_name;

    if (!orgId || !damageCaseId || !scenarioName) {
      return { statusCode: 400, body: JSON.stringify({ error: "org_id, damage_case_id, and scenario_name required" }) };
    }

    var validScenarios = ["no_inspection", "delayed_7_days", "vt_only", "wrong_method", "continued_operation_under_load"];
    if (validScenarios.indexOf(scenarioName) === -1) {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid scenario. Valid: " + validScenarios.join(", ") }) };
    }

    var supabase = getSupabase();

    /* Fetch latest evaluation */
    var evalRes = await supabase
      .from("damage_evaluations")
      .select("*")
      .eq("org_id", orgId)
      .eq("damage_case_id", damageCaseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (evalRes.error || !evalRes.data) {
      return { statusCode: 404, body: JSON.stringify({ error: "No evaluation found. Run evaluation first." }) };
    }

    /* Compute what-if */
    var result = computeWhatIf(evalRes.data, scenarioName);

    /* Store */
    var insertRes = await supabase
      .from("damage_whatif_runs")
      .insert({
        org_id: orgId,
        damage_case_id: damageCaseId,
        asset_id: evalRes.data.asset_id,
        scenario_name: scenarioName,
        scenario_payload: { scenario_name: scenarioName },
        result_payload: result,
      })
      .select("*")
      .single();

    if (insertRes.error) {
      return { statusCode: 500, body: JSON.stringify({ error: insertRes.error.message }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        whatif: insertRes.data,
        result: result,
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Unexpected error" }),
    };
  }
};

export { handler };
