// @ts-nocheck
/**
 * DEPLOY308 - advanced-spatial-graph-engine.ts
 * netlify/functions/advanced-spatial-graph-engine.ts
 *
 * ADVANCED SPATIAL & GRAPH ENGINE — ENGINE 98
 *
 * Sub-engines 203, 204, 209, 215:
 *   203 - Graph Consequence Propagation (BFS cascade through system graph)
 *   204 - Spatial Field Intelligence (hotspot detection in field maps)
 *   209 - Topology + Geometry (risk index from connectivity and curvature)
 *   215 - Fractal Morphology (box-counting dimension via log-log regression)
 *
 * POST /api/advanced-spatial-graph-engine
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var ENGINE_ID = "advanced-spatial-graph-engine";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY308";
var corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };

function num(v, fallback) { var n = Number(v); if (v === undefined || v === null || v === "" || isNaN(n)) return fallback !== undefined ? fallback : null; return n; }
function getMissing(inp, keys) { var m = []; for (var i = 0; i < keys.length; i++) { if (inp[keys[i]] === undefined || inp[keys[i]] === null || inp[keys[i]] === "") m.push(keys[i]); } return m; }
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

function buildResult(engineNum, engineCode, partial) {
  return { engine_number: engineNum, engine_code: engineCode, result: partial.result || {}, interpretation: partial.interpretation || "", confidence: clamp01(partial.confidence || 0.7), uncertainty: clamp01(partial.uncertainty || 0.3), severity: partial.severity || "info", assumptions: partial.assumptions || [], limitations: partial.limitations || [], missing_inputs: partial.missing_inputs || [], proof_trace: partial.proof_trace || { mathematical_basis: [], calculation_steps: [], required_human_review: false } };
}

function holdResult(engineNum, engineCode, m) {
  return buildResult(engineNum, engineCode, { result: { missing_inputs: m }, interpretation: "Calculation held. Missing: " + m.join(", ") + ".", confidence: 0.1, uncertainty: 0.9, severity: "hold_for_input", missing_inputs: m, proof_trace: { mathematical_basis: [], calculation_steps: ["Input validation failed"], required_human_review: false, next_data_needed: m } });
}

// ============================================================
// 203 — GRAPH CONSEQUENCE PROPAGATION (BFS CASCADE)
// ============================================================

function calcGraphPropagation(inp) {
  var nodes = inp.nodes;
  var edges = inp.edges;
  var startNode = inp.start_node;
  if (!Array.isArray(nodes) || !Array.isArray(edges) || startNode === undefined || startNode === null || startNode === "") {
    return holdResult(203, "GRAPH_CONSEQUENCE", ["nodes", "edges", "start_node"]);
  }
  var decayFactor = num(inp.decay_factor, 0.8);
  // Build adjacency list
  var adj = {};
  for (var i = 0; i < nodes.length; i++) {
    adj[String(nodes[i])] = [];
  }
  for (var i = 0; i < edges.length; i++) {
    var from = String(edges[i][0] || edges[i].from);
    var to = String(edges[i][1] || edges[i].to);
    var weight = num(edges[i][2] || edges[i].weight, 1.0);
    if (adj[from]) adj[from].push({ target: to, weight: weight });
  }
  // BFS cascade from start_node
  var impact = {};
  impact[String(startNode)] = 1.0;
  var queue = [String(startNode)];
  var visited = {};
  visited[String(startNode)] = true;
  var steps = [];
  steps.push("Start: " + startNode + " impact=1.0");
  while (queue.length > 0) {
    var current = queue.shift();
    var neighbors = adj[current] || [];
    for (var j = 0; j < neighbors.length; j++) {
      var nb = neighbors[j];
      var propagated = impact[current] * decayFactor * nb.weight;
      if (!visited[nb.target] || propagated > (impact[nb.target] || 0)) {
        impact[nb.target] = propagated;
        if (!visited[nb.target]) {
          visited[nb.target] = true;
          queue.push(nb.target);
        }
        steps.push(current + " -> " + nb.target + " impact=" + propagated.toFixed(4));
      }
    }
  }
  var affectedCount = 0;
  var maxImpact = 0;
  var maxNode = String(startNode);
  var nodeKeys = Object.keys(impact);
  for (var k = 0; k < nodeKeys.length; k++) {
    if (nodeKeys[k] !== String(startNode)) {
      affectedCount++;
      if (impact[nodeKeys[k]] > maxImpact) {
        maxImpact = impact[nodeKeys[k]];
        maxNode = nodeKeys[k];
      }
    }
  }
  return buildResult(203, "GRAPH_CONSEQUENCE", {
    result: { impact_map: impact, affected_nodes: affectedCount, max_downstream_impact: maxImpact, max_impact_node: maxNode },
    interpretation: "Consequence propagation from node " + startNode + " affects " + affectedCount + " downstream nodes. Max downstream impact is " + maxImpact.toFixed(4) + " at node " + maxNode + ".",
    confidence: 0.72, uncertainty: 0.28,
    severity: affectedCount > nodes.length * 0.5 ? "high" : affectedCount > nodes.length * 0.25 ? "medium" : "low",
    assumptions: ["Graph edges correctly represent physical or logical dependencies", "Decay factor represents attenuation through each link"],
    limitations: ["Does not model feedback loops or cyclic amplification", "Edge weights are assumed static"],
    proof_trace: { mathematical_basis: ["BFS graph traversal", "multiplicative decay propagation"], calculation_steps: steps, required_human_review: affectedCount > nodes.length * 0.5 }
  });
}

// ============================================================
// 204 — SPATIAL FIELD INTELLIGENCE (HOTSPOT DETECTION)
// ============================================================

function calcSpatialField(inp) {
  var field = inp.field;
  if (!Array.isArray(field) || field.length === 0) {
    return holdResult(204, "SPATIAL_FIELD", ["field"]);
  }
  var threshold = num(inp.threshold, null);
  // field is array of {x, y, value} or [x, y, value]
  var points = [];
  var sum = 0;
  var maxVal = -Infinity;
  var minVal = Infinity;
  for (var i = 0; i < field.length; i++) {
    var px, py, pv;
    if (Array.isArray(field[i])) {
      px = Number(field[i][0]);
      py = Number(field[i][1]);
      pv = Number(field[i][2]);
    } else {
      px = Number(field[i].x);
      py = Number(field[i].y);
      pv = Number(field[i].value);
    }
    points.push({ x: px, y: py, value: pv });
    sum += pv;
    if (pv > maxVal) maxVal = pv;
    if (pv < minVal) minVal = pv;
  }
  var mean = sum / points.length;
  var variance = 0;
  for (var i = 0; i < points.length; i++) {
    variance += (points[i].value - mean) * (points[i].value - mean);
  }
  variance = variance / points.length;
  var stddev = Math.sqrt(variance);
  // Hotspot detection: points exceeding threshold or mean + 2*stddev
  var hotspotThreshold = threshold !== null ? threshold : mean + 2 * stddev;
  var hotspots = [];
  for (var i = 0; i < points.length; i++) {
    if (points[i].value >= hotspotThreshold) {
      hotspots.push(points[i]);
    }
  }
  var hotspotFraction = hotspots.length / points.length;
  return buildResult(204, "SPATIAL_FIELD", {
    result: { hotspots: hotspots, hotspot_count: hotspots.length, total_points: points.length, hotspot_fraction: hotspotFraction, field_mean: mean, field_stddev: stddev, field_min: minVal, field_max: maxVal, hotspot_threshold: hotspotThreshold },
    interpretation: hotspots.length + " hotspot(s) detected out of " + points.length + " points (threshold=" + hotspotThreshold.toFixed(3) + "). Field mean=" + mean.toFixed(3) + ", stddev=" + stddev.toFixed(3) + ".",
    confidence: 0.74, uncertainty: 0.26,
    severity: hotspotFraction > 0.2 ? "high" : hotspotFraction > 0.05 ? "medium" : "low",
    assumptions: ["Spatial field is sampled at representative locations", "Threshold is appropriate for the measurement domain"],
    limitations: ["Does not perform spatial interpolation or kriging", "Hotspot detection is point-based — clustering not performed"],
    proof_trace: { mathematical_basis: ["spatial statistics", "threshold-based anomaly detection"], calculation_steps: ["mean=" + mean.toFixed(4), "stddev=" + stddev.toFixed(4), "threshold=" + hotspotThreshold.toFixed(4), "hotspots=" + hotspots.length + "/" + points.length], required_human_review: hotspotFraction > 0.2 }
  });
}

// ============================================================
// 209 — TOPOLOGY + GEOMETRY (RISK INDEX)
// ============================================================

function calcTopologyGeometry(inp) {
  var m = getMissing(inp, ["num_nodes", "num_edges", "mean_curvature"]);
  if (m.length) return holdResult(209, "TOPOLOGY_GEOMETRY", m);
  var N = num(inp.num_nodes);
  var E = num(inp.num_edges);
  var curvature = num(inp.mean_curvature);
  var maxEdges = N * (N - 1) / 2;
  var connectivity = maxEdges > 0 ? E / maxEdges : 0;
  // Euler characteristic for planar graph approximation: V - E + F
  // For a connected planar graph F = E - V + 2
  var eulerFaces = E - N + 2;
  // Risk index combines connectivity density and curvature magnitude
  var curvatureWeight = num(inp.curvature_weight, 0.5);
  var connectivityWeight = num(inp.connectivity_weight, 0.5);
  var riskIndex = clamp01(connectivityWeight * connectivity + curvatureWeight * Math.min(1, Math.abs(curvature)));
  return buildResult(209, "TOPOLOGY_GEOMETRY", {
    result: { connectivity_density: connectivity, euler_faces: eulerFaces, curvature_magnitude: Math.abs(curvature), risk_index: riskIndex },
    interpretation: "Topology risk index is " + riskIndex.toFixed(3) + ". Connectivity density=" + connectivity.toFixed(3) + ", curvature magnitude=" + Math.abs(curvature).toFixed(3) + ".",
    confidence: 0.68, uncertainty: 0.32,
    severity: riskIndex > 0.7 ? "high" : riskIndex > 0.4 ? "medium" : "low",
    assumptions: ["Graph is approximately planar", "Mean curvature represents structural stress concentration"],
    limitations: ["Euler characteristic assumes connected planar graph", "Risk index weighting is configurable but not calibrated"],
    proof_trace: { mathematical_basis: ["graph theory connectivity", "Euler characteristic", "curvature-based risk weighting"], calculation_steps: ["maxEdges=" + N + "*(" + N + "-1)/2=" + maxEdges, "connectivity=" + E + "/" + maxEdges + "=" + connectivity.toFixed(4), "eulerFaces=" + E + "-" + N + "+2=" + eulerFaces, "riskIndex=" + connectivityWeight + "*" + connectivity.toFixed(4) + "+" + curvatureWeight + "*" + Math.min(1, Math.abs(curvature)).toFixed(4) + "=" + riskIndex.toFixed(4)], required_human_review: riskIndex > 0.7 }
  });
}

// ============================================================
// 215 — FRACTAL MORPHOLOGY (BOX-COUNTING DIMENSION)
// ============================================================

function calcFractalMorphology(inp) {
  var boxSizes = inp.box_sizes;
  var boxCounts = inp.box_counts;
  if (!Array.isArray(boxSizes) || !Array.isArray(boxCounts) || boxSizes.length < 2 || boxCounts.length < 2 || boxSizes.length !== boxCounts.length) {
    return holdResult(215, "FRACTAL_MORPHOLOGY", ["box_sizes", "box_counts"]);
  }
  // Log-log linear regression: log(N) = D * log(1/eps) + c
  // where eps = box_size, N = box_count, D = fractal dimension
  var n = boxSizes.length;
  var logX = [];
  var logY = [];
  for (var i = 0; i < n; i++) {
    logX.push(Math.log(1.0 / Number(boxSizes[i])));
    logY.push(Math.log(Number(boxCounts[i])));
  }
  // Linear regression: D = (n*sum(xy) - sum(x)*sum(y)) / (n*sum(x^2) - (sum(x))^2)
  var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (var i = 0; i < n; i++) {
    sumX += logX[i];
    sumY += logY[i];
    sumXY += logX[i] * logY[i];
    sumX2 += logX[i] * logX[i];
  }
  var denom = n * sumX2 - sumX * sumX;
  var D = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  var intercept = (sumY - D * sumX) / n;
  // R-squared
  var meanY = sumY / n;
  var ssTot = 0, ssRes = 0;
  for (var i = 0; i < n; i++) {
    var predicted = D * logX[i] + intercept;
    ssTot += (logY[i] - meanY) * (logY[i] - meanY);
    ssRes += (logY[i] - predicted) * (logY[i] - predicted);
  }
  var r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  return buildResult(215, "FRACTAL_MORPHOLOGY", {
    result: { fractal_dimension: D, r_squared: r2, intercept: intercept, data_points: n },
    interpretation: "Box-counting fractal dimension is " + D.toFixed(4) + " (R-squared=" + r2.toFixed(4) + ")." + (D > 2.5 ? " High complexity morphology." : D > 1.5 ? " Moderate complexity." : " Low complexity."),
    confidence: r2 > 0.95 ? 0.85 : r2 > 0.8 ? 0.7 : 0.55,
    uncertainty: 1 - r2,
    severity: D > 2.5 ? "high" : D > 1.5 ? "medium" : "low",
    assumptions: ["Box-counting method is appropriate for the morphology", "Data spans sufficient scale range for reliable regression"],
    limitations: ["Box-counting dimension is an approximation — multifractal analysis may be needed", "Accuracy depends on number of scale levels and quality of counting"],
    proof_trace: { mathematical_basis: ["box-counting fractal dimension", "log-log linear regression"], calculation_steps: ["logX = log(1/eps) for each box size", "logY = log(N) for each box count", "D (slope) = " + D.toFixed(6), "R^2 = " + r2.toFixed(6)], required_human_review: r2 < 0.8 }
  });
}

// ============================================================
// ENGINE MAP
// ============================================================

var ENGINE_MAP = {
  "203": calcGraphPropagation, "GRAPH_CONSEQUENCE": calcGraphPropagation,
  "204": calcSpatialField, "SPATIAL_FIELD": calcSpatialField,
  "209": calcTopologyGeometry, "TOPOLOGY_GEOMETRY": calcTopologyGeometry,
  "215": calcFractalMorphology, "FRACTAL_MORPHOLOGY": calcFractalMorphology
};

function logRun(body, result) { try { var sb = createClient(supabaseUrl, supabaseKey); sb.from("advanced_math_engine_runs").insert({ org_id: body.org_id || null, case_id: body.case_id || null, asset_id: body.asset_id || null, finding_id: body.finding_id || null, engine_number: result.engine_number, engine_code: result.engine_code, input_payload: body.inputs || body.input || {}, output_payload: result.result, confidence: result.confidence, uncertainty: result.uncertainty, severity: result.severity, assumptions: result.assumptions, limitations: result.limitations, missing_inputs: result.missing_inputs, proof_trace: result.proof_trace }); } catch (e) {} }

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };
  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";
    if (action === "get_registry") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, deploy: DEPLOY, mode: "deterministic", purpose: "Advanced Spatial & Graph Engine — graph consequence propagation, spatial field intelligence, topology geometry, fractal morphology", sub_engines: [203, 204, 209, 215], actions: ["run_engine", "get_registry"] }) };
    }
    if (action === "run_engine") {
      var engineKey = String(body.engine_number || body.engine_code || "");
      var fn = ENGINE_MAP[engineKey];
      if (!fn) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown sub-engine: " + engineKey + ". Available: 203, 204, 209, 215" }) };
      var inputs = body.inputs || body.input || {};
      var result = fn(inputs);
      logRun(body, result);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: result }, null, 2) };
    }
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
  } catch (err) { return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) }; }
};
