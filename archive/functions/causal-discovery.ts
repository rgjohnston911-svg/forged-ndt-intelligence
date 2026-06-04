// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_ANON_KEY;
var supabase = createClient(supabaseUrl, supabaseKey);

// ══════════════════════════════════════════════════════════════════
// CAUSAL DISCOVERY ENGINE
//
// Automatically discovers causal relationships from inspection data.
// Unlike the Conceptual Reasoning Brain's causal chains (which are
// human-defined), this engine uses constraint-based algorithms to
// FIND cause-effect structures from the data itself.
//
// Methods:
// 1. PC Algorithm (constraint-based) — conditional independence tests
// 2. Correlation-to-Causation upgrade — temporal + domain constraints
// 3. Intervention analysis — what happens when X changes?
// ══════════════════════════════════════════════════════════════════

// ── KNOWN CAUSAL DOMAIN CONSTRAINTS ─────────────────────────────
// Physical laws that constrain what causal structures are possible
var DOMAIN_CONSTRAINTS = {
  "temperature → corrosion_rate": { direction: "forward", mechanism: "Arrhenius kinetics", strength: "strong" },
  "corrosion_rate → wall_loss": { direction: "forward", mechanism: "material removal", strength: "strong" },
  "wall_loss → stress_concentration": { direction: "forward", mechanism: "geometric effect", strength: "strong" },
  "stress_concentration → crack_initiation": { direction: "forward", mechanism: "fatigue mechanics", strength: "moderate" },
  "crack_initiation → crack_growth": { direction: "forward", mechanism: "Paris law", strength: "strong" },
  "crack_growth → failure": { direction: "forward", mechanism: "fracture mechanics", strength: "strong" },
  "coating_failure → corrosion_rate": { direction: "forward", mechanism: "barrier removal", strength: "strong" },
  "cp_loss → corrosion_rate": { direction: "forward", mechanism: "electrochemical", strength: "strong" },
  "vibration → fatigue_damage": { direction: "forward", mechanism: "cyclic loading", strength: "strong" },
  "marine_growth → cp_shielding": { direction: "forward", mechanism: "physical barrier", strength: "moderate" },
  "h2s_concentration → sulfidation_rate": { direction: "forward", mechanism: "chemical kinetics", strength: "strong" },
  "moisture → cui_rate": { direction: "forward", mechanism: "electrolyte presence", strength: "strong" },
  "chloride → scc_probability": { direction: "forward", mechanism: "anodic dissolution", strength: "strong" },
  "temperature_cycling → thermal_fatigue": { direction: "forward", mechanism: "differential expansion", strength: "moderate" },
  "flow_velocity → erosion_rate": { direction: "forward", mechanism: "particle impact", strength: "strong" },
  "microstructure_degradation → creep_rate": { direction: "forward", mechanism: "diffusion", strength: "moderate" }
};

// ── CORRELATION COMPUTATION ─────────────────────────────────────
function pearsonCorrelation(x, y) {
  var n = Math.min(x.length, y.length);
  if (n < 3) return 0;

  var sum_x = 0, sum_y = 0, sum_xy = 0, sum_x2 = 0, sum_y2 = 0;
  for (var i = 0; i < n; i++) {
    sum_x += x[i]; sum_y += y[i];
    sum_xy += x[i] * y[i];
    sum_x2 += x[i] * x[i];
    sum_y2 += y[i] * y[i];
  }

  var num = n * sum_xy - sum_x * sum_y;
  var den = Math.sqrt((n * sum_x2 - sum_x * sum_x) * (n * sum_y2 - sum_y * sum_y));
  if (den === 0) return 0;
  return num / den;
}

// Partial correlation (controlling for Z)
function partialCorrelation(x, y, z) {
  var r_xy = pearsonCorrelation(x, y);
  var r_xz = pearsonCorrelation(x, z);
  var r_yz = pearsonCorrelation(y, z);

  var num = r_xy - r_xz * r_yz;
  var den = Math.sqrt((1 - r_xz * r_xz) * (1 - r_yz * r_yz));
  if (den === 0) return 0;
  return num / den;
}

// ── PC ALGORITHM (SIMPLIFIED) ───────────────────────────────────
// Constraint-based causal discovery
function pcAlgorithm(data, variable_names, threshold) {
  threshold = threshold || 0.1;
  var n_vars = variable_names.length;

  // Step 1: Start with fully connected graph
  var edges = {};
  for (var i = 0; i < n_vars; i++) {
    for (var j = i + 1; j < n_vars; j++) {
      var key = variable_names[i] + " -- " + variable_names[j];
      edges[key] = { from: variable_names[i], to: variable_names[j], exists: true };
    }
  }

  // Step 2: Remove edges where unconditional independence holds
  var removed = [];
  var edge_keys = Object.keys(edges);
  for (var e = 0; e < edge_keys.length; e++) {
    var edge = edges[edge_keys[e]];
    var x_data = data[edge.from] || [];
    var y_data = data[edge.to] || [];

    var r = Math.abs(pearsonCorrelation(x_data, y_data));
    if (r < threshold) {
      edge.exists = false;
      removed.push({ edge: edge_keys[e], reason: "unconditional independence", correlation: Math.round(r * 1000) / 1000 });
    } else {
      edge.correlation = Math.round(r * 1000) / 1000;
    }
  }

  // Step 3: Conditional independence (controlling for each other variable)
  for (var e = 0; e < edge_keys.length; e++) {
    var edge = edges[edge_keys[e]];
    if (!edge.exists) continue;

    for (var k = 0; k < n_vars; k++) {
      if (variable_names[k] === edge.from || variable_names[k] === edge.to) continue;

      var x_data = data[edge.from] || [];
      var y_data = data[edge.to] || [];
      var z_data = data[variable_names[k]] || [];

      if (z_data.length < 3) continue;

      var r_partial = Math.abs(partialCorrelation(x_data, y_data, z_data));
      if (r_partial < threshold) {
        edge.exists = false;
        removed.push({
          edge: edge_keys[e],
          reason: "conditional independence given " + variable_names[k],
          partial_correlation: Math.round(r_partial * 1000) / 1000
        });
        break;
      }
    }
  }

  // Step 4: Orient edges using domain constraints
  var causal_edges = [];
  for (var e = 0; e < edge_keys.length; e++) {
    var edge = edges[edge_keys[e]];
    if (!edge.exists) continue;

    var forward_key = edge.from + " → " + edge.to;
    var reverse_key = edge.to + " → " + edge.from;

    var direction = "undetermined";
    var mechanism = "statistical_association";

    if (DOMAIN_CONSTRAINTS[forward_key]) {
      direction = edge.from + " → " + edge.to;
      mechanism = DOMAIN_CONSTRAINTS[forward_key].mechanism;
    } else if (DOMAIN_CONSTRAINTS[reverse_key]) {
      direction = edge.to + " → " + edge.from;
      mechanism = DOMAIN_CONSTRAINTS[reverse_key].mechanism;
    }

    causal_edges.push({
      from: edge.from,
      to: edge.to,
      correlation: edge.correlation,
      direction: direction,
      mechanism: mechanism,
      strength: edge.correlation > 0.8 ? "strong" : edge.correlation > 0.5 ? "moderate" : "weak"
    });
  }

  return {
    variables: variable_names,
    discovered_edges: causal_edges,
    removed_edges: removed,
    total_possible_edges: n_vars * (n_vars - 1) / 2,
    surviving_edges: causal_edges.length,
    method: "PC_algorithm_with_domain_constraints"
  };
}

// ── TEMPORAL CAUSAL ANALYSIS ────────────────────────────────────
// Granger-like causality: does X's past predict Y's future?
function temporalCausalAnalysis(time_series_x, time_series_y, lag) {
  lag = lag || 1;
  var n = Math.min(time_series_x.length, time_series_y.length) - lag;
  if (n < 5) return { error: "Insufficient data for temporal analysis" };

  // X(t) predicting Y(t+lag)
  var x_past = time_series_x.slice(0, n);
  var y_future = time_series_y.slice(lag, n + lag);
  var forward_corr = pearsonCorrelation(x_past, y_future);

  // Y(t) predicting X(t+lag)
  var y_past = time_series_y.slice(0, n);
  var x_future = time_series_x.slice(lag, n + lag);
  var reverse_corr = pearsonCorrelation(y_past, x_future);

  var causal_direction = "undetermined";
  if (Math.abs(forward_corr) > Math.abs(reverse_corr) + 0.1) {
    causal_direction = "X → Y";
  } else if (Math.abs(reverse_corr) > Math.abs(forward_corr) + 0.1) {
    causal_direction = "Y → X";
  } else {
    causal_direction = "bidirectional_or_confounded";
  }

  return {
    forward_correlation: Math.round(forward_corr * 1000) / 1000,
    reverse_correlation: Math.round(reverse_corr * 1000) / 1000,
    lag_periods: lag,
    causal_direction: causal_direction,
    confidence: Math.round(Math.abs(Math.abs(forward_corr) - Math.abs(reverse_corr)) * 1000) / 1000,
    n_observations: n
  };
}

// ── INTERVENTION ANALYSIS ───────────────────────────────────────
function interventionAnalysis(data_before, data_after, variable_names) {
  var effects = [];

  for (var i = 0; i < variable_names.length; i++) {
    var name = variable_names[i];
    var before = data_before[name] || [];
    var after = data_after[name] || [];

    if (before.length < 3 || after.length < 3) continue;

    var mean_before = 0, mean_after = 0;
    for (var j = 0; j < before.length; j++) mean_before += before[j];
    mean_before /= before.length;
    for (var j = 0; j < after.length; j++) mean_after += after[j];
    mean_after /= after.length;

    var std_before = 0;
    for (var j = 0; j < before.length; j++) std_before += (before[j] - mean_before) * (before[j] - mean_before);
    std_before = Math.sqrt(std_before / before.length);

    var effect_size = std_before > 0 ? (mean_after - mean_before) / std_before : 0;

    effects.push({
      variable: name,
      mean_before: Math.round(mean_before * 10000) / 10000,
      mean_after: Math.round(mean_after * 10000) / 10000,
      change_pct: Math.round(((mean_after - mean_before) / (mean_before || 1)) * 10000) / 100,
      effect_size: Math.round(effect_size * 1000) / 1000,
      significance: Math.abs(effect_size) > 0.8 ? "large" : Math.abs(effect_size) > 0.5 ? "medium" : Math.abs(effect_size) > 0.2 ? "small" : "negligible"
    });
  }

  effects.sort(function(a, b) { return Math.abs(b.effect_size) - Math.abs(a.effect_size); });
  return { effects: effects, intervention_detected: effects.filter(function(e) { return Math.abs(e.effect_size) > 0.5; }).length > 0 };
}

// ── OUTPUT HELPERS ──────────────────────────────────────────────
function buildResult(code, body) {
  return { statusCode: code, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" }, body: JSON.stringify(body) };
}
function holdResult(code, msg, action) {
  return buildResult(code, { error: msg, action: action, engine: "causal-discovery", timestamp: new Date().toISOString() });
}

// ── HANDLER ─────────────────────────────────────────────────────
export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return buildResult(200, { status: "ok" });
  if (event.httpMethod !== "POST") return holdResult(405, "POST only", "error");

  var body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return holdResult(400, "Invalid JSON", "parse"); }
  var action = body.action || "get_registry";
  var requestData = body;

  if (action === "get_registry") {
    return buildResult(200, {
      engine_code: "causal-discovery",
      engine_version: "1.0.0",
      engine_name: "Causal Discovery Engine",
      deploy: "DEPLOY325",
      paradigm: "Data-driven causal structure learning with domain constraints",
      description: "Automatically discovers causal relationships from inspection data using constraint-based algorithms. Unlike human-defined causal chains, this finds cause-effect structures FROM the data. Domain physics constraints orient discovered edges.",
      domain_constraints: Object.keys(DOMAIN_CONSTRAINTS).length,
      methods: ["PC_algorithm", "temporal_granger", "intervention_analysis"],
      actions: ["get_registry", "discover_causes", "temporal_analysis", "intervention_analysis", "get_domain_constraints"],
      status: "operational"
    });
  }

  if (action === "discover_causes") {
    var data = requestData.data || {};
    var variable_names = requestData.variables || Object.keys(data);
    var threshold = requestData.threshold || 0.1;

    if (variable_names.length < 2) return holdResult(400, "At least 2 variables with data required", action);

    var result = pcAlgorithm(data, variable_names, threshold);

    try {
      await supabase.from("causal_discovery_results").insert([{
        case_id: requestData.case_id || null,
        variables: variable_names,
        edges_discovered: result.discovered_edges.length,
        edges_removed: result.removed_edges.length,
        method: "PC_algorithm",
        results: result
      }]);
    } catch (e) { /* non-fatal */ }

    return buildResult(200, { action: "discover_causes", engine: "causal-discovery", result: result, timestamp: new Date().toISOString() });
  }

  if (action === "temporal_analysis") {
    var x = requestData.time_series_x || [];
    var y = requestData.time_series_y || [];
    var lag = requestData.lag || 1;
    var x_name = requestData.x_name || "X";
    var y_name = requestData.y_name || "Y";

    if (x.length < 5 || y.length < 5) return holdResult(400, "At least 5 data points required per time series", action);

    var result = temporalCausalAnalysis(x, y, lag);
    result.x_name = x_name;
    result.y_name = y_name;
    result.causal_direction = result.causal_direction.replace("X", x_name).replace("Y", y_name);

    return buildResult(200, { action: "temporal_analysis", engine: "causal-discovery", result: result, timestamp: new Date().toISOString() });
  }

  if (action === "intervention_analysis") {
    var before = requestData.data_before || {};
    var after = requestData.data_after || {};
    var variables = requestData.variables || Object.keys(before);
    var intervention = requestData.intervention || "unknown";

    var result = interventionAnalysis(before, after, variables);
    result.intervention = intervention;

    return buildResult(200, { action: "intervention_analysis", engine: "causal-discovery", result: result, timestamp: new Date().toISOString() });
  }

  if (action === "get_domain_constraints") {
    var constraints = [];
    var keys = Object.keys(DOMAIN_CONSTRAINTS);
    for (var i = 0; i < keys.length; i++) {
      constraints.push(Object.assign({ relationship: keys[i] }, DOMAIN_CONSTRAINTS[keys[i]]));
    }
    return buildResult(200, { action: "get_domain_constraints", constraints: constraints, count: constraints.length });
  }

  return holdResult(400, "Unknown action: " + action, action);
};
