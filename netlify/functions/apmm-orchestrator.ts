// @ts-nocheck
/**
 * DEPLOY311 - apmm-orchestrator.ts
 * netlify/functions/apmm-orchestrator.ts
 *
 * APMM ORCHESTRATOR — ENGINE 101
 *
 * Intelligent routing layer for the Advanced Physics & Mathematics
 * Master Core. Takes case context (mechanism, measurements, asset type)
 * and automatically selects relevant sub-engines, runs them via
 * internal HTTP calls to the 6 APMM functions, and feeds all results
 * through the Master Physics Arbiter (240) for consensus.
 *
 * DEPLOY312 UPDATE: Added power_generation context type and engines 240-245.
 *
 * Actions:
 *   run_orchestration - full auto-select and run
 *   get_engine_map    - returns context-to-engine mapping
 *   get_registry      - standard registry response
 *
 * POST /api/apmm-orchestrator
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var ENGINE_ID = "apmm-orchestrator";
var ENGINE_VERSION = "1.1.0";
var DEPLOY = "DEPLOY311";
var corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };

function num(v, fallback) { var n = Number(v); if (v === undefined || v === null || v === "" || isNaN(n)) return fallback !== undefined ? fallback : null; return n; }
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

// ============================================================
// CONTEXT-TO-ENGINE MAPPING
// ============================================================
// Each context type maps to a set of sub-engines that should run.
// The orchestrator selects engines based on what data is available
// and what mechanism/scenario is being evaluated.

var CONTEXT_ENGINE_MAP = {
  "corrosion": {
    description: "Corrosion assessment with environmental and material factors",
    always: [201, 211, 235],
    if_available: {
      "stress_data": [216, 210],
      "thermal_data": [225, 210],
      "coating_data": [228, 210],
      "cp_data": [226],
      "spatial_data": [204],
      "inspection_history": [212, 213],
      "sensor_data": [214, 221],
      "cost_data": [205, 237],
      "code_limits": [236]
    }
  },
  "fatigue": {
    description: "Fatigue and cyclic loading assessment",
    always: [201, 211, 216, 235],
    if_available: {
      "vibration_data": [232, 221],
      "thermal_data": [225, 210],
      "spatial_data": [204],
      "inspection_history": [212, 213],
      "sensor_data": [214],
      "cost_data": [205, 237],
      "code_limits": [236],
      "fsi_data": [224]
    }
  },
  "structural": {
    description: "Structural integrity and load-bearing assessment",
    always: [201, 216, 229, 235],
    if_available: {
      "buckling_data": [229],
      "composite_data": [227],
      "blast_data": [233],
      "thermal_data": [225],
      "fsi_data": [224],
      "spatial_data": [204, 209],
      "inspection_history": [212, 213],
      "sensor_data": [214],
      "cost_data": [205, 237],
      "code_limits": [236],
      "numerical_data": [223]
    }
  },
  "subsea": {
    description: "Subsea and marine environment assessment",
    always: [201, 211, 230, 235],
    if_available: {
      "cp_data": [226],
      "coating_data": [228],
      "fsi_data": [224],
      "stress_data": [216, 210],
      "thermal_data": [225],
      "spatial_data": [204],
      "inspection_history": [212, 213],
      "sensor_data": [214, 221],
      "cost_data": [205, 237],
      "code_limits": [236],
      "graph_data": [203]
    }
  },
  "rotating_equipment": {
    description: "Rotating machinery and vibration assessment",
    always: [201, 232, 221, 235],
    if_available: {
      "stress_data": [216],
      "thermal_data": [225],
      "inspection_history": [212, 213],
      "sensor_data": [214],
      "cost_data": [205, 237],
      "code_limits": [236]
    }
  },
  "process_piping": {
    description: "Process piping and pressure equipment",
    always: [201, 211, 216, 235],
    if_available: {
      "thermal_data": [225, 217],
      "coating_data": [228],
      "cp_data": [226],
      "stress_data": [210],
      "inspection_history": [212, 213],
      "sensor_data": [214],
      "cost_data": [205, 237],
      "code_limits": [236],
      "graph_data": [203]
    }
  },
  "aerospace": {
    description: "Aerospace and space systems assessment",
    always: [201, 216, 231, 235],
    if_available: {
      "composite_data": [227],
      "thermal_data": [225],
      "fatigue_data": [211],
      "blast_data": [233],
      "inspection_history": [212],
      "sensor_data": [214, 221],
      "cost_data": [205, 237],
      "code_limits": [236],
      "scaling_data": [218]
    }
  },
  "civil": {
    description: "Civil and architectural structural assessment",
    always: [201, 229, 235],
    if_available: {
      "stress_data": [216],
      "thermal_data": [225],
      "spatial_data": [204, 209],
      "inspection_history": [212, 213],
      "sensor_data": [214],
      "cost_data": [205, 237],
      "code_limits": [236],
      "graph_data": [203],
      "blast_data": [233]
    }
  },
  "root_cause": {
    description: "Root cause analysis and causal investigation",
    always: [201, 208, 206, 235],
    if_available: {
      "graph_data": [203],
      "spatial_data": [204],
      "inspection_history": [212],
      "sensor_data": [214, 221],
      "human_factors": [234],
      "code_limits": [236]
    }
  },
  "decision_support": {
    description: "Decision support and optimization",
    always: [201, 205, 206, 220, 237],
    if_available: {
      "uncertainty_data": [219],
      "human_factors": [234],
      "code_limits": [236],
      "inspection_history": [212],
      "safety_claim": [239]
    }
  },
  "power_generation": {
    description: "Power generation — boilers, HRSGs, turbines, steam piping, feedwater, condensate systems",
    always: [201, 211, 216, 225, 235, 240, 241, 244, 245],
    if_available: {
      "stress_data": [210, 229],
      "vibration_data": [232, 221, 243],
      "thermal_data": [244],
      "inspection_history": [212, 213],
      "sensor_data": [214, 221],
      "cost_data": [205, 237],
      "code_limits": [236],
      "fac_data": [242],
      "turbine_data": [243],
      "cycle_data": [241],
      "creep_data": [240],
      "graph_data": [203]
    }
  },
  "full_physics": {
    description: "Full physics sweep — run all available engines",
    always: [201, 202, 204, 205, 206, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245],
    if_available: {}
  }
};

// ============================================================
// ENGINE ROUTING TABLE (sub-engine -> host function)
// ============================================================

var ENGINE_HOST = {
  201: "advanced-probability-engine",
  211: "advanced-probability-engine",
  212: "advanced-probability-engine",
  213: "advanced-probability-engine",
  214: "advanced-probability-engine",
  235: "advanced-probability-engine",
  210: "advanced-structural-engine",
  216: "advanced-structural-engine",
  223: "advanced-structural-engine",
  224: "advanced-structural-engine",
  229: "advanced-structural-engine",
  230: "advanced-structural-engine",
  232: "advanced-structural-engine",
  202: "advanced-transport-engine",
  207: "advanced-transport-engine",
  217: "advanced-transport-engine",
  225: "advanced-transport-engine",
  226: "advanced-transport-engine",
  227: "advanced-transport-engine",
  228: "advanced-transport-engine",
  231: "advanced-transport-engine",
  233: "advanced-transport-engine",
  238: "advanced-transport-engine",
  203: "advanced-spatial-graph-engine",
  204: "advanced-spatial-graph-engine",
  209: "advanced-spatial-graph-engine",
  215: "advanced-spatial-graph-engine",
  205: "advanced-decision-engine",
  206: "advanced-decision-engine",
  208: "advanced-decision-engine",
  218: "advanced-decision-engine",
  219: "advanced-decision-engine",
  220: "advanced-decision-engine",
  221: "advanced-decision-engine",
  222: "advanced-decision-engine",
  234: "advanced-decision-engine",
  236: "advanced-decision-engine",
  237: "advanced-decision-engine",
  239: "advanced-decision-engine",
  240: "apmm-power-gen-engines",
  241: "apmm-power-gen-engines",
  242: "apmm-power-gen-engines",
  243: "apmm-power-gen-engines",
  244: "apmm-power-gen-engines",
  245: "apmm-power-gen-engines"
};

// ============================================================
// ENGINE SELECTOR
// ============================================================

function selectEngines(contextType, availableData) {
  var mapping = CONTEXT_ENGINE_MAP[contextType];
  if (!mapping) return { engines: [], error: "Unknown context_type: " + contextType };
  var engines = [];
  var seen = {};
  // Add always-run engines
  for (var i = 0; i < mapping.always.length; i++) {
    var e = mapping.always[i];
    if (!seen[e]) { engines.push(e); seen[e] = true; }
  }
  // Add conditional engines based on available data
  if (availableData && mapping.if_available) {
    var dataKeys = Object.keys(availableData);
    for (var d = 0; d < dataKeys.length; d++) {
      var key = dataKeys[d];
      if (mapping.if_available[key]) {
        var conditional = mapping.if_available[key];
        for (var c = 0; c < conditional.length; c++) {
          if (!seen[conditional[c]]) { engines.push(conditional[c]); seen[conditional[c]] = true; }
        }
      }
    }
  }
  engines.sort(function(a, b) { return a - b; });
  return { engines: engines, error: null };
}

// ============================================================
// INTERNAL ENGINE CALLER
// ============================================================

async function callSubEngine(engineNumber, inputs, siteUrl) {
  var hostFunction = ENGINE_HOST[engineNumber];
  if (!hostFunction) return { engine_number: engineNumber, error: "No host function mapped", severity: "hold_for_input", confidence: 0 };
  var url = siteUrl + "/.netlify/functions/" + hostFunction;
  try {
    var response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": process.env.NDT_API_KEY || "" }, // DEPLOY471: forward server key
      body: JSON.stringify({ action: "run_engine", engine_number: String(engineNumber), inputs: inputs })
    });
    var data = await response.json();
    if (data.result) return data.result;
    return { engine_number: engineNumber, error: "Unexpected response", severity: "hold_for_input", confidence: 0 };
  } catch (err) {
    return { engine_number: engineNumber, error: String(err && err.message ? err.message : err), severity: "hold_for_input", confidence: 0 };
  }
}

// ============================================================
// ARBITER CALLER
// ============================================================

async function callArbiter(engineResults, siteUrl) {
  var url = siteUrl + "/.netlify/functions/advanced-physics-arbiter";
  try {
    var response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run_engine", engine_number: "240", inputs: { engine_results: engineResults } })
    });
    var data = await response.json();
    if (data.result) return data.result;
    return { error: "Arbiter returned unexpected response" };
  } catch (err) {
    return { error: "Arbiter call failed: " + String(err && err.message ? err.message : err) };
  }
}

// ============================================================
// ORCHESTRATION LOGIC
// ============================================================

async function runOrchestration(body, siteUrl) {
  var startTime = Date.now();
  var contextType = body.context_type || "corrosion";
  var inputs = body.inputs || {};
  var availableData = body.available_data || {};
  var orgId = body.org_id || null;
  var caseId = body.case_id || null;
  var assetId = body.asset_id || null;
  var findingId = body.finding_id || null;

  // Step 1: Select engines
  var selection = selectEngines(contextType, availableData);
  if (selection.error) {
    return { error: selection.error, available_contexts: Object.keys(CONTEXT_ENGINE_MAP) };
  }

  // Step 2: Run selected engines
  var engineResults = [];
  var engineErrors = [];
  for (var i = 0; i < selection.engines.length; i++) {
    var engineNum = selection.engines[i];
    var engineInputs = inputs[String(engineNum)] || inputs["all"] || {};
    var result = await callSubEngine(engineNum, engineInputs, siteUrl);
    if (result.error) {
      engineErrors.push({ engine: engineNum, error: result.error });
    }
    engineResults.push(result);
  }

  // Step 3: Run arbiter on all results (excluding hold_for_input with no data)
  var validResults = [];
  for (var j = 0; j < engineResults.length; j++) {
    if (engineResults[j].severity !== "hold_for_input") {
      validResults.push(engineResults[j]);
    }
  }

  var arbiterResult = null;
  if (validResults.length > 0) {
    arbiterResult = await callArbiter(validResults, siteUrl);
  }

  var executionMs = Date.now() - startTime;

  // Step 4: Log orchestration run
  try {
    var sb = createClient(supabaseUrl, supabaseKey);
    sb.from("apmm_orchestrator_runs").insert({
      org_id: orgId,
      case_id: caseId,
      asset_id: assetId,
      finding_id: findingId,
      context_type: contextType,
      selected_engines: selection.engines,
      engine_results: engineResults,
      arbiter_result: arbiterResult || {},
      consensus_severity: arbiterResult && arbiterResult.result ? arbiterResult.result.consensus_severity : null,
      consensus_confidence: arbiterResult && arbiterResult.result ? arbiterResult.result.consensus_confidence : null,
      conflicts_detected: arbiterResult && arbiterResult.result ? (arbiterResult.result.conflicts || []).length : 0,
      human_review_required: arbiterResult && arbiterResult.result ? arbiterResult.result.human_review_required : false,
      total_engines_run: selection.engines.length,
      execution_ms: executionMs
    });
  } catch (e) {}

  return {
    orchestration: {
      context_type: contextType,
      engines_selected: selection.engines.length,
      engines_with_results: validResults.length,
      engines_held: selection.engines.length - validResults.length,
      engine_errors: engineErrors.length,
      execution_ms: executionMs
    },
    engine_results: engineResults,
    arbiter: arbiterResult,
    consensus: arbiterResult && arbiterResult.result ? {
      severity: arbiterResult.result.consensus_severity,
      confidence: arbiterResult.result.consensus_confidence,
      conflicts: arbiterResult.result.conflicts,
      human_review_required: arbiterResult.result.human_review_required
    } : null,
    metadata: { org_id: orgId, case_id: caseId, asset_id: assetId, finding_id: findingId }
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
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
        engine: ENGINE_ID, version: ENGINE_VERSION, deploy: DEPLOY,
        mode: "deterministic",
        purpose: "APMM Orchestrator — intelligent routing layer that selects relevant sub-engines based on context, runs them, and feeds results through the Master Physics Arbiter for consensus",
        available_contexts: Object.keys(CONTEXT_ENGINE_MAP),
        total_sub_engines: 46,
        actions: ["run_orchestration", "get_engine_map", "get_registry"]
      }) };
    }

    if (action === "get_engine_map") {
      var mapOut = {};
      var ctxKeys = Object.keys(CONTEXT_ENGINE_MAP);
      for (var k = 0; k < ctxKeys.length; k++) {
        var ctx = CONTEXT_ENGINE_MAP[ctxKeys[k]];
        mapOut[ctxKeys[k]] = { description: ctx.description, always_run: ctx.always, conditional_triggers: Object.keys(ctx.if_available) };
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, engine_map: mapOut }, null, 2) };
    }

    if (action === "run_orchestration") {
      // Determine site URL for internal calls
      var siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "https://4dndt.netlify.app";
      var result = await runOrchestration(body, siteUrl);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: result }, null, 2) };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action + ". Available: run_orchestration, get_engine_map, get_registry" }) };
  } catch (err) { return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) }; }
};
