// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var ENGINE_ID = "executive-decision-engine";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY294";
var corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };

var REPAIR_COSTS = {
  coating_repair_topside: { typical: 15000, mobilization: 2000 }, coating_repair_splash: { typical: 60000, mobilization: 15000 }, coating_repair_subsea: { typical: 150000, mobilization: 50000 }, coating_repair_tank: { typical: 100000, mobilization: 20000 },
  steel_renewal_topside: { typical: 40000, mobilization: 5000 }, steel_renewal_subsea: { typical: 350000, mobilization: 100000 }, steel_renewal_drydock: { typical: 150000, mobilization: 200000 },
  weld_repair_topside: { typical: 20000, mobilization: 3000 }, weld_repair_subsea: { typical: 200000, mobilization: 80000 },
  cp_anode_retrofit: { typical: 100000, mobilization: 50000 }, clamp_repair_subsea: { typical: 250000, mobilization: 80000 }, pipeline_repair: { typical: 2000000, mobilization: 500000 }, drydock_mobilization: { typical: 1500000, mobilization: 0 }
};

var FAILURE_COSTS = {
  structural_failure_platform: { typical: 200000000 }, pipeline_rupture: { typical: 50000000 }, vessel_loss: { typical: 100000000 },
  production_shutdown: { typical: 2000000, note: "per_day" }, regulatory_action: { typical: 1000000 }, environmental_release: { typical: 20000000 }
};

var DOWNTIME_COSTS = { fpso_per_day: { typical: 1500000 }, drillship_per_day: { typical: 800000 }, platform_per_day: { typical: 1000000 }, tanker_per_day: { typical: 50000 }, psv_per_day: { typical: 25000 } };

function calculateDecisionEconomics(input) {
  var repairType = input.repair_type || "coating_repair_topside";
  var failureType = input.failure_type || "production_shutdown";
  var prob = input.probability_of_failure || 0.1;
  var timeYears = input.time_to_failure_years || 5;
  var assetType = input.asset_type || "platform";
  var downtimeDays = input.downtime_days || 14;
  var fleetSize = input.fleet_similar_assets || 1;
  var discountRate = input.discount_rate || 0.08;
  var repair = REPAIR_COSTS[repairType] || REPAIR_COSTS.coating_repair_topside;
  var failure = FAILURE_COSTS[failureType] || FAILURE_COSTS.production_shutdown;
  var repairCost = repair.typical + repair.mobilization;
  var failureCost = failure.typical;
  var expectedFailureCost = failureCost * prob;
  var npvFailure = expectedFailureCost / Math.pow(1 + discountRate, timeYears);
  var dtKey = assetType + "_per_day";
  var dtCost = DOWNTIME_COSTS[dtKey] || DOWNTIME_COSTS.platform_per_day;
  var downtimeCost = dtCost.typical * downtimeDays;
  var costOfInaction = npvFailure + (downtimeCost * prob);
  var netBenefit = costOfInaction - repairCost;
  var roi = repairCost > 0 ? Math.round((netBenefit / repairCost) * 100) : 0;
  var fleetRepairCost = repairCost * fleetSize;
  var fleetAvoidedCost = costOfInaction * fleetSize;
  var fleetNetBenefit = fleetAvoidedCost - fleetRepairCost;
  var decision = roi > 500 ? "repair_strongly_recommended" : (roi > 100 ? "repair_recommended" : (roi > 0 ? "repair_marginally_justified" : "monitor_and_reassess"));
  return {
    repair: { type: repairType, cost: repairCost },
    failure: { type: failureType, full_cost: failureCost, probability: prob, expected_cost: Math.round(expectedFailureCost), npv_cost: Math.round(npvFailure) },
    downtime: { days: downtimeDays, cost_per_day: dtCost.typical, total: Math.round(downtimeCost * prob) },
    economics: { cost_of_repair: repairCost, cost_of_inaction: Math.round(costOfInaction), net_benefit: Math.round(netBenefit), roi_percent: roi, decision: decision },
    fleet: { similar_assets: fleetSize, total_repair_cost: fleetRepairCost, total_avoided_cost: Math.round(fleetAvoidedCost), fleet_net_benefit: Math.round(fleetNetBenefit) },
    executive_summary: "Repair: $" + repairCost + ". Failure risk: $" + Math.round(costOfInaction) + ". ROI: " + roi + "%. " + (roi > 100 ? "RECOMMEND REPAIR." : (roi > 0 ? "Marginal case." : "Monitor."))
  };
}

function generateOperatingWindow(input) {
  var rate = input.degradation_rate_mm_yr || 0.3;
  var current = input.current_thickness_mm || 12;
  var minimum = input.minimum_thickness_mm || 8;
  var sf = input.safety_factor || 1.25;
  var effMin = minimum * sf;
  var margin = current - effMin;
  var years = rate > 0 ? margin / rate : 999;
  var absYears = rate > 0 ? (current - minimum) / rate : 999;
  var status = years <= 0 ? "exceeded" : (years < 1 ? "critical" : (years < 3 ? "limited" : (years < 5 ? "moderate" : "safe")));
  return {
    current_mm: current, minimum_mm: minimum, effective_minimum_mm: Math.round(effMin * 10) / 10, margin_mm: Math.round(margin * 10) / 10, rate_mm_yr: rate,
    safe_window_years: Math.round(years * 10) / 10, absolute_limit_years: Math.round(absYears * 10) / 10, status: status,
    recommendation: status === "exceeded" ? "STOP — below safe limit. Immediate repair." : status === "critical" ? "Less than 1 year. Plan immediate repair." : status === "limited" ? "Safe for " + Math.round(years * 10) / 10 + " years. Schedule repair." : status === "moderate" ? "Safe for " + Math.round(years * 10) / 10 + " years. Next maintenance cycle." : "No concern. Monitor at scheduled interval.",
    next_inspection: status === "critical" ? "within_6_months" : (status === "limited" ? "within_1_year" : (status === "moderate" ? "within_2_years" : "at_scheduled_interval"))
  };
}

function generateExecutiveBrief(input) {
  var name = input.asset_name || "Asset";
  var risk = input.risk_level || "moderate";
  var repCost = input.repair_cost || 50000;
  var failCost = input.failure_cost || 2000000;
  var prob = input.probability || 0.1;
  var window = input.operating_window_years || 5;
  var rec = input.recommendation || "repair";
  var expectedLoss = failCost * prob;
  var ratio = Math.round(expectedLoss / repCost);
  return {
    asset: name, risk_level: risk,
    brief: { line_1: name + " — Risk: " + risk.toUpperCase(), line_2: "Repair now: $" + repCost, line_3: "Expected failure cost: $" + Math.round(expectedLoss) + " (" + Math.round(prob * 100) + "% x $" + failCost + ")", line_4: "Failure cost is " + ratio + "x repair cost", line_5: "Safe window: " + window + " years", line_6: "Recommendation: " + rec.toUpperCase() },
    decision_support: ratio > 10 ? "STRONG CASE — repair prevents catastrophic loss" : (ratio > 3 ? "CLEAR CASE — repair cheaper than failure" : (ratio > 1 ? "POSITIVE — repair justified" : "MARGINAL — monitor"))
  };
}

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };
  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";
    if (action === "get_registry") { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, deploy: DEPLOY, mode: "deterministic", purpose: "Executive Decision Engine — cost-consequence, repair vs failure, operating windows", repair_cost_types: Object.keys(REPAIR_COSTS).length, failure_cost_types: Object.keys(FAILURE_COSTS).length, actions: ["calculate_economics", "generate_operating_window", "generate_executive_brief", "get_cost_database", "get_registry"] }) }; }
    if (action === "calculate_economics") {
      var er = calculateDecisionEconomics(body);
      try { var sb = createClient(supabaseUrl, supabaseKey); await sb.from("executive_decisions").insert({ org_id: body.org_id || null, case_id: body.case_id || null, repair_type: body.repair_type || "unknown", decision: er.economics.decision, roi_percent: er.economics.roi_percent, result_json: er }); } catch (e) {}
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: er }, null, 2) };
    }
    if (action === "generate_operating_window") { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: generateOperatingWindow(body) }, null, 2) }; }
    if (action === "generate_executive_brief") { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: generateExecutiveBrief(body) }, null, 2) }; }
    if (action === "get_cost_database") { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, repair_costs: REPAIR_COSTS, failure_costs: FAILURE_COSTS, downtime_costs: DOWNTIME_COSTS }, null, 2) }; }
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
  } catch (err) { return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) }; }
};
