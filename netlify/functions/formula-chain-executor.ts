// @ts-nocheck
/**
 * DEPLOY302 - formula-chain-executor.ts
 * netlify/functions/formula-chain-executor.ts
 *
 * FORMULA CHAIN EXECUTOR — ENGINE 92
 *
 * Sequences multiple formulas from Engine 91 into decision-ready
 * chains. Looks up chain definitions from Supabase, executes each
 * formula in order, synthesizes combined severity/confidence/decision,
 * and logs the chain run.
 *
 * 7 pre-seeded chains:
 *   PRESSURE_REMAINING_LIFE, WELD_CRACKING_RISK, NDT_DETECTABILITY,
 *   COATING_CUI_RISK, CP_SUBSEA, FLOW_EROSION_VIBRATION, RISK_COST_DECISION
 *
 * Also supports auto-detection: given a context object, determines
 * which chains apply and runs them all.
 *
 * POST /api/formula-chain-executor
 *
 * Actions:
 *   get_registry       - engine metadata
 *   run_chain           - execute a named chain
 *   auto_detect         - detect and run applicable chains from context
 *   list_chains         - list available chains
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var ENGINE_ID = "formula-chain-executor";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY302";
var corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };

// ============================================================
// CHAIN AUTO-DETECTION
// ============================================================

function detectChains(context) {
  var chains = [];
  if (context.wall_loss || context.corrosion_rate || context.pressure_boundary || context.t_actual || context.CR) {
    chains.push("PRESSURE_REMAINING_LIFE");
  }
  if (context.welding || context.wps || context.repair_weld || context.heat_input || context.carbon_equivalent) {
    chains.push("WELD_CRACKING_RISK");
  }
  if (context.ndt_method || context.flaw_size || context.detectability || context.ut || context.paut || context.tofd || context.rt) {
    chains.push("NDT_DETECTABILITY");
  }
  if (context.coating || context.insulation || context.cui || context.dew_point || context.humidity) {
    chains.push("COATING_CUI_RISK");
  }
  if (context.cp || context.subsea || context.buried_pipeline || context.anode || context.cathodic_protection) {
    chains.push("CP_SUBSEA");
  }
  if (context.flow || context.erosion || context.vibration || context.rotating_equipment || context.velocity) {
    chains.push("FLOW_EROSION_VIBRATION");
  }
  if (context.failure_consequence || context.cost || context.risk_decision || context.Pf || context.Cf) {
    chains.push("RISK_COST_DECISION");
  }
  return chains;
}

// ============================================================
// CHAIN SYNTHESIS
// ============================================================

function synthesizeDecision(chainCode, results) {
  var severities = [];
  var totalConf = 0;
  var held = 0;
  var critical = 0;
  var high = 0;

  for (var i = 0; i < results.length; i++) {
    severities.push(results[i].severity);
    totalConf += results[i].confidence || 0;
    if (results[i].severity === "hold_for_input") held++;
    if (results[i].severity === "critical") critical++;
    if (results[i].severity === "high") high++;
  }

  var avgConf = results.length > 0 ? totalConf / results.length : 0;
  var decision = "MONITOR_WITH_PLANNED_INSPECTION";
  var severity = "medium";
  var summary = "No critical formula result was triggered.";

  if (held === results.length) {
    decision = "HOLD_FOR_INPUT";
    severity = "hold_for_input";
    summary = "All formulas held — insufficient data for any calculation. Provide required inputs.";
  } else if (critical > 0) {
    decision = "ENGINEER_REVIEW_OR_REPAIR_REQUIRED";
    severity = "critical";
    summary = critical + " critical formula result(s) triggered. Engineer review required before continued service.";
  } else if (high > 0) {
    decision = "ESCALATE_INSPECTION_AND_REVIEW";
    severity = "high";
    summary = high + " high-severity formula result(s). Inspection escalation recommended.";
  }

  return {
    chain_code: chainCode,
    decision: decision,
    severity: severity,
    confidence: avgConf,
    summary: summary,
    formula_count: results.length,
    held_count: held,
    critical_count: critical,
    high_count: high,
    results: results
  };
}

// ============================================================
// INTERNAL FORMULA EXECUTOR (calls Engine 91 via HTTP)
// ============================================================

async function callFormulaEngine(formulaCode, inputs, body) {
  var baseUrl = process.env.URL || "";
  var payload = {
    action: "run_formula",
    formula_code: formulaCode,
    inputs: inputs,
    org_id: body.org_id || null,
    case_id: body.case_id || null,
    asset_id: body.asset_id || null,
    finding_id: body.finding_id || null
  };

  try {
    var resp = await fetch(baseUrl + "/api/formula-intelligence-core", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    var data = await resp.json();
    if (data.result) return data.result;
    return { formula_code: formulaCode, severity: "hold_for_input", confidence: 0.1, interpretation: "Engine 91 returned no result", missing_inputs: [], output: {} };
  } catch (e) {
    return { formula_code: formulaCode, severity: "hold_for_input", confidence: 0.1, interpretation: "Failed to reach formula engine: " + String(e && e.message ? e.message : e), missing_inputs: [], output: {} };
  }
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
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
        engine: ENGINE_ID, version: ENGINE_VERSION, deploy: DEPLOY,
        mode: "deterministic",
        purpose: "Formula Chain Executor — sequences formulas into decision-ready chains with auto-detection",
        chains: 7,
        actions: ["run_chain", "auto_detect", "list_chains", "get_registry"]
      }) };
    }

    if (action === "list_chains") {
      try {
        var sb = createClient(supabaseUrl, supabaseKey);
        var chainList = await sb.from("formula_chains").select("chain_code, chain_name, description, applicable_domains, ordered_formula_codes").eq("is_active", true);
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
          engine: ENGINE_ID, action: action,
          chains: chainList.data || []
        }, null, 2) };
      } catch (e) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
          engine: ENGINE_ID, action: action,
          chains: [],
          note: "Could not load chains from database"
        }) };
      }
    }

    if (action === "run_chain") {
      var chainCode = body.chain_code;
      var inputs = body.inputs || {};
      if (!chainCode) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "chain_code required" }) };

      // Load chain definition
      var sb2 = createClient(supabaseUrl, supabaseKey);
      var chainLookup = await sb2.from("formula_chains").select("*").eq("chain_code", chainCode).eq("is_active", true).limit(1);
      if (!chainLookup.data || chainLookup.data.length === 0) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Chain not found: " + chainCode }) };
      }
      var chain = chainLookup.data[0];
      var formulaCodes = chain.ordered_formula_codes || [];

      // Execute each formula in sequence
      var results = [];
      for (var ci = 0; ci < formulaCodes.length; ci++) {
        var result = await callFormulaEngine(formulaCodes[ci], inputs, body);
        results.push(result);
      }

      // Synthesize decision
      var synthesis = synthesizeDecision(chainCode, results);

      // Log chain run (non-fatal)
      try {
        await sb2.from("formula_chain_runs").insert({
          org_id: body.org_id || null,
          case_id: body.case_id || null,
          asset_id: body.asset_id || null,
          finding_id: body.finding_id || null,
          chain_code: chainCode,
          input_payload: inputs,
          final_output: synthesis,
          decision: synthesis.decision,
          confidence: synthesis.confidence
        });
      } catch (e) {}

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
        engine: ENGINE_ID, version: ENGINE_VERSION, action: action,
        chain_code: chainCode,
        chain_name: chain.chain_name,
        synthesis: synthesis
      }, null, 2) };
    }

    if (action === "auto_detect") {
      var context = body.context || body.inputs || {};
      var detectedChains = detectChains(context);

      if (detectedChains.length === 0) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
          engine: ENGINE_ID, action: action,
          detected_chains: [],
          note: "No formula chains triggered by the provided context. Supply domain-specific inputs (wall thickness, corrosion rate, welding parameters, NDT method, coating data, CP data, flow data, or risk/cost data)."
        }) };
      }

      var allSyntheses = [];
      for (var di = 0; di < detectedChains.length; di++) {
        var sb3 = createClient(supabaseUrl, supabaseKey);
        var chainLookup2 = await sb3.from("formula_chains").select("*").eq("chain_code", detectedChains[di]).eq("is_active", true).limit(1);
        if (chainLookup2.data && chainLookup2.data.length > 0) {
          var ch = chainLookup2.data[0];
          var chResults = [];
          for (var cj = 0; cj < (ch.ordered_formula_codes || []).length; cj++) {
            var res = await callFormulaEngine(ch.ordered_formula_codes[cj], context, body);
            chResults.push(res);
          }
          var syn = synthesizeDecision(detectedChains[di], chResults);
          allSyntheses.push(syn);

          // Log (non-fatal)
          try {
            await sb3.from("formula_chain_runs").insert({
              org_id: body.org_id || null,
              case_id: body.case_id || null,
              chain_code: detectedChains[di],
              input_payload: context,
              final_output: syn,
              decision: syn.decision,
              confidence: syn.confidence
            });
          } catch (e) {}
        }
      }

      // Overall synthesis across all chains
      var overallCritical = 0;
      var overallHigh = 0;
      var overallHeld = 0;
      for (var si = 0; si < allSyntheses.length; si++) {
        overallCritical += allSyntheses[si].critical_count;
        overallHigh += allSyntheses[si].high_count;
        overallHeld += allSyntheses[si].held_count;
      }

      var overallDecision = "MONITOR_WITH_PLANNED_INSPECTION";
      if (overallCritical > 0) overallDecision = "ENGINEER_REVIEW_OR_REPAIR_REQUIRED";
      else if (overallHigh > 0) overallDecision = "ESCALATE_INSPECTION_AND_REVIEW";
      else if (overallHeld > 0 && overallHeld === allSyntheses.length) overallDecision = "HOLD_FOR_INPUT";

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
        engine: ENGINE_ID, version: ENGINE_VERSION, action: action,
        detected_chains: detectedChains,
        overall_decision: overallDecision,
        chain_results: allSyntheses
      }, null, 2) };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
