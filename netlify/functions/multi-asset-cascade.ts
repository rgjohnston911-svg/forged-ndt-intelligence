// @ts-nocheck
/**
 * DEPLOY269 - multi-asset-cascade.ts
 * netlify/functions/multi-asset-cascade.ts
 *
 * MULTI-ASSET CASCADE ENGINE v1.0.0
 * Models how failure in one component propagates to others.
 *
 * Maps interaction effects across connected asset systems.
 * Identifies single points of failure, cascade paths, isolation boundaries,
 * common cause groups, and barrier effectiveness.
 *
 * Example: free span -> VIV -> riser fatigue -> topsides vibration -> process upset
 *
 * 8 actions:
 *   get_registry           — engine overview
 *   build_graph            — build asset interaction graph from input
 *   analyze_cascades       — find all cascade paths in a graph
 *   find_spof              — find single points of failure
 *   find_common_cause      — find common cause failure groups
 *   assess_barriers        — assess barrier effectiveness along cascade paths
 *   get_graph              — retrieve stored graph
 *   get_graph_history      — list graphs for a case
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var ENGINE_VERSION = "multi-asset-cascade/1.0.0";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

function ok(body) { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(body) }; }
function errResp(code, msg) { return { statusCode: code, headers: corsHeaders, body: JSON.stringify({ error: msg }) }; }

// ============================================================
// INTERACTION TYPES
// ============================================================
var INTERACTION_TYPES = [
  { type: "structural_load", description: "Load transfer through structural connection", propagation_speed: "immediate", reversible: false },
  { type: "vibration_transmission", description: "Vibration propagation through connected structure", propagation_speed: "immediate", reversible: true },
  { type: "pressure_coupling", description: "Pressure communication through fluid path", propagation_speed: "fast", reversible: true },
  { type: "flow_dependency", description: "Upstream/downstream flow dependency", propagation_speed: "fast", reversible: false },
  { type: "thermal_coupling", description: "Heat transfer between adjacent components", propagation_speed: "slow", reversible: true },
  { type: "corrosion_coupling", description: "Shared corrosion environment or galvanic cell", propagation_speed: "slow", reversible: false },
  { type: "cp_dependency", description: "Shared cathodic protection system", propagation_speed: "slow", reversible: false },
  { type: "scour_propagation", description: "Seabed scour spreading along corridor", propagation_speed: "slow", reversible: false },
  { type: "safety_system", description: "Shared safety system (ESD, blowdown, fire)", propagation_speed: "immediate", reversible: true },
  { type: "utility_dependency", description: "Shared power, hydraulic, or control system", propagation_speed: "immediate", reversible: false },
  { type: "human_proximity", description: "Personnel exposure to adjacent failure", propagation_speed: "immediate", reversible: false }
];

// ============================================================
// BARRIER TYPES
// ============================================================
var BARRIER_TYPES = [
  { type: "ESD_valve", description: "Emergency shutdown valve", typical_reliability: 0.95, failure_mode: "fail_to_close", test_interval: "quarterly" },
  { type: "PSV", description: "Pressure safety valve", typical_reliability: 0.97, failure_mode: "fail_to_open", test_interval: "annual" },
  { type: "blowdown_valve", description: "Blowdown/depressurization valve", typical_reliability: 0.93, failure_mode: "fail_to_open", test_interval: "quarterly" },
  { type: "fire_detection", description: "Fire and gas detection system", typical_reliability: 0.90, failure_mode: "fail_to_detect", test_interval: "monthly" },
  { type: "fire_suppression", description: "Deluge/foam fire suppression", typical_reliability: 0.85, failure_mode: "fail_to_activate", test_interval: "semi_annual" },
  { type: "structural_isolation", description: "Physical separation / blast wall", typical_reliability: 0.99, failure_mode: "structural_failure", test_interval: "inspection_based" },
  { type: "riser_isolation", description: "Subsea riser isolation valve", typical_reliability: 0.90, failure_mode: "fail_to_close", test_interval: "annual" },
  { type: "check_valve", description: "Non-return valve", typical_reliability: 0.88, failure_mode: "fail_to_close", test_interval: "annual" },
  { type: "coating_system", description: "Protective coating system", typical_reliability: 0.70, failure_mode: "degradation", test_interval: "inspection_based" },
  { type: "cp_system", description: "Cathodic protection system", typical_reliability: 0.85, failure_mode: "insufficient_protection", test_interval: "annual_survey" }
];

// ============================================================
// GRAPH BUILDER
// Builds an asset interaction graph from component descriptions
// ============================================================
function buildGraph(input) {
  var nodes = [];
  var edges = [];
  var components = input.components || [];

  // Build nodes
  for (var i = 0; i < components.length; i++) {
    var comp = components[i];
    nodes.push({
      id: comp.id || ("node_" + i),
      name: comp.name || comp,
      type: comp.type || "component",
      environment: comp.environment || "unknown",
      criticality: comp.criticality || "MEDIUM",
      current_condition: comp.condition || "UNKNOWN",
      failure_modes: comp.failure_modes || [],
      connected_to: comp.connected_to || []
    });
  }

  // Build edges from connections
  for (var n = 0; n < nodes.length; n++) {
    var node = nodes[n];
    if (node.connected_to) {
      for (var c = 0; c < node.connected_to.length; c++) {
        var conn = node.connected_to[c];
        var targetId = typeof conn === "string" ? conn : conn.target;
        var interType = typeof conn === "string" ? "flow_dependency" : (conn.type || "flow_dependency");
        var strength = typeof conn === "string" ? "MEDIUM" : (conn.strength || "MEDIUM");

        // Check target exists
        var targetExists = false;
        for (var te = 0; te < nodes.length; te++) {
          if (nodes[te].id === targetId || nodes[te].name === targetId) {
            targetId = nodes[te].id;
            targetExists = true;
            break;
          }
        }

        if (targetExists) {
          edges.push({
            source: node.id,
            target: targetId,
            interaction_type: interType,
            coupling_strength: strength,
            directionality: "unidirectional",
            barriers: []
          });
        }
      }
    }
  }

  // Auto-detect interactions from input
  if (input.interactions) {
    for (var ai = 0; ai < input.interactions.length; ai++) {
      var inter = input.interactions[ai];
      edges.push({
        source: inter.source,
        target: inter.target,
        interaction_type: inter.type || "flow_dependency",
        coupling_strength: inter.strength || "MEDIUM",
        directionality: inter.directionality || "unidirectional",
        barriers: inter.barriers || []
      });
    }
  }

  return { nodes: nodes, edges: edges };
}

// ============================================================
// CASCADE PATH FINDER
// DFS-based cascade path analysis
// ============================================================
function findCascadePaths(nodes, edges, maxDepth) {
  var paths = [];
  var limit = maxDepth || 6;

  // Build adjacency list
  var adj = {};
  for (var e = 0; e < edges.length; e++) {
    if (!adj[edges[e].source]) adj[edges[e].source] = [];
    adj[edges[e].source].push(edges[e]);
  }

  // DFS from each node
  for (var n = 0; n < nodes.length; n++) {
    var startNode = nodes[n];
    var stack = [{ node: startNode.id, path: [startNode.id], edges_used: [], depth: 0 }];
    var visited = {};

    while (stack.length > 0) {
      var current = stack.pop();
      if (current.depth >= limit) continue;

      var neighbors = adj[current.node] || [];
      for (var nb = 0; nb < neighbors.length; nb++) {
        var edge = neighbors[nb];
        var target = edge.target;

        if (current.path.indexOf(target) >= 0) continue; // no cycles

        var newPath = current.path.concat([target]);
        var newEdges = current.edges_used.concat([edge.interaction_type]);

        // Record path if length > 1
        if (newPath.length >= 3) {
          // Find consequence severity for the final node
          var finalNode = null;
          for (var fn = 0; fn < nodes.length; fn++) {
            if (nodes[fn].id === target) { finalNode = nodes[fn]; break; }
          }

          paths.push({
            initiating_component: startNode.name || startNode.id,
            propagation_path: newPath,
            interaction_chain: newEdges,
            cascade_depth: newPath.length - 1,
            final_component: finalNode ? (finalNode.name || finalNode.id) : target,
            final_criticality: finalNode ? finalNode.criticality : "UNKNOWN"
          });
        }

        stack.push({ node: target, path: newPath, edges_used: newEdges, depth: current.depth + 1 });
      }
    }
  }

  // Sort by cascade depth descending
  paths.sort(function(a, b) {
    var sevOrder = { "CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1, "UNKNOWN": 0 };
    var sa = sevOrder[a.final_criticality] || 0;
    var sb2 = sevOrder[b.final_criticality] || 0;
    if (sa !== sb2) return sb2 - sa;
    return b.cascade_depth - a.cascade_depth;
  });

  return paths;
}

// ============================================================
// SINGLE POINT OF FAILURE FINDER
// ============================================================
function findSPOF(nodes, edges) {
  var spofs = [];

  for (var n = 0; n < nodes.length; n++) {
    var node = nodes[n];
    var incomingCount = 0;
    var outgoingCount = 0;

    for (var e = 0; e < edges.length; e++) {
      if (edges[e].target === node.id) incomingCount++;
      if (edges[e].source === node.id) outgoingCount++;
    }

    // SPOF if it's the only path between groups (high connectivity)
    if (outgoingCount >= 2 || (incomingCount >= 1 && outgoingCount >= 1)) {
      // Check if removing this node disconnects the graph
      var isSpof = false;

      // Simple heuristic: if node has both incoming and outgoing and criticality is HIGH+
      if (incomingCount >= 1 && outgoingCount >= 1 &&
          (node.criticality === "CRITICAL" || node.criticality === "HIGH")) {
        isSpof = true;
      }

      // If it's the only path (single incoming to multiple outgoing)
      if (outgoingCount >= 2 && incomingCount === 1) {
        isSpof = true;
      }

      if (isSpof) {
        spofs.push({
          component: node.name || node.id,
          criticality: node.criticality,
          incoming_connections: incomingCount,
          outgoing_connections: outgoingCount,
          impact: "Failure would affect " + outgoingCount + " downstream component(s)",
          mitigation: outgoingCount >= 2 ? "Consider redundancy or enhanced monitoring" : "Ensure barrier integrity"
        });
      }
    }
  }

  return spofs;
}

// ============================================================
// COMMON CAUSE GROUP FINDER
// ============================================================
function findCommonCause(nodes, edges) {
  var groups = {};

  // Group by shared environment
  for (var n = 0; n < nodes.length; n++) {
    var env = nodes[n].environment || "unknown";
    if (!groups[env]) groups[env] = { cause: env, type: "shared_environment", components: [] };
    groups[env].components.push(nodes[n].name || nodes[n].id);
  }

  // Group by shared interaction type
  var interGroups = {};
  for (var e = 0; e < edges.length; e++) {
    var iType = edges[e].interaction_type;
    if (!interGroups[iType]) interGroups[iType] = { cause: iType, type: "shared_interaction", components: [] };
    if (interGroups[iType].components.indexOf(edges[e].source) < 0) interGroups[iType].components.push(edges[e].source);
    if (interGroups[iType].components.indexOf(edges[e].target) < 0) interGroups[iType].components.push(edges[e].target);
  }

  var result = [];
  var gKeys = Object.keys(groups);
  for (var g = 0; g < gKeys.length; g++) {
    if (groups[gKeys[g]].components.length >= 2) result.push(groups[gKeys[g]]);
  }
  var iKeys = Object.keys(interGroups);
  for (var ig = 0; ig < iKeys.length; ig++) {
    if (interGroups[iKeys[ig]].components.length >= 2) result.push(interGroups[iKeys[ig]]);
  }

  return result;
}

// ============================================================
// HANDLER
// ============================================================
export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return errResp(405, "POST only");

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "";

    if (action === "get_registry") {
      return ok({
        engine: "multi-asset-cascade",
        version: ENGINE_VERSION,
        description: "Models how failure in one component propagates to others. Builds asset interaction graphs, traces cascade paths, identifies single points of failure and common cause groups, assesses barrier effectiveness.",
        actions: ["get_registry", "build_graph", "analyze_cascades", "find_spof", "find_common_cause", "assess_barriers", "get_graph", "get_graph_history"],
        interaction_types: INTERACTION_TYPES.length,
        barrier_types: BARRIER_TYPES.length,
        max_cascade_depth: 6,
        status: "operational"
      });
    }

    if (action === "build_graph") {
      if (!body.components || body.components.length === 0) return errResp(400, "components array required");
      var graph = buildGraph(body);

      // Full analysis
      var cascades = findCascadePaths(graph.nodes, graph.edges, body.max_depth || 6);
      var spofs = findSPOF(graph.nodes, graph.edges);
      var commonCause = findCommonCause(graph.nodes, graph.edges);

      var result = {
        engine: "multi-asset-cascade",
        version: ENGINE_VERSION,
        generated_at: new Date().toISOString(),
        node_count: graph.nodes.length,
        edge_count: graph.edges.length,
        cascade_path_count: cascades.length,
        spof_count: spofs.length,
        common_cause_group_count: commonCause.length,
        nodes: graph.nodes,
        edges: graph.edges,
        cascade_paths: cascades.slice(0, 20), // top 20
        single_points_of_failure: spofs,
        common_cause_groups: commonCause
      };

      // Store if Supabase available
      if (supabaseUrl && supabaseKey && body.case_id) {
        var sb = createClient(supabaseUrl, supabaseKey);
        var ins = await sb.from("asset_graphs").insert({
          case_id: body.case_id,
          graph_name: body.graph_name || "Production System",
          graph_type: body.graph_type || "production_system",
          nodes: graph.nodes,
          edges: graph.edges,
          cascade_paths: cascades,
          single_points_of_failure: spofs,
          common_cause_groups: commonCause
        }).select("id").single();
        if (ins.data) result.graph_id = ins.data.id;
      }

      return ok(result);
    }

    if (action === "analyze_cascades") {
      var nodes = body.nodes || [];
      var edges = body.edges || [];
      if (nodes.length === 0 || edges.length === 0) return errResp(400, "nodes and edges arrays required");
      var cascades2 = findCascadePaths(nodes, edges, body.max_depth || 6);
      return ok({ engine: "multi-asset-cascade", cascade_count: cascades2.length, cascades: cascades2 });
    }

    if (action === "find_spof") {
      var nodes2 = body.nodes || [];
      var edges2 = body.edges || [];
      if (nodes2.length === 0) return errResp(400, "nodes and edges arrays required");
      var spofs2 = findSPOF(nodes2, edges2);
      return ok({ engine: "multi-asset-cascade", spof_count: spofs2.length, single_points_of_failure: spofs2 });
    }

    if (action === "find_common_cause") {
      var nodes3 = body.nodes || [];
      var edges3 = body.edges || [];
      if (nodes3.length === 0) return errResp(400, "nodes array required");
      var cc = findCommonCause(nodes3, edges3);
      return ok({ engine: "multi-asset-cascade", group_count: cc.length, common_cause_groups: cc });
    }

    if (action === "assess_barriers") {
      var barriers = body.barriers || [];
      var assessed = [];
      for (var b = 0; b < barriers.length; b++) {
        var barrier = barriers[b];
        var bType = null;
        for (var bt = 0; bt < BARRIER_TYPES.length; bt++) {
          if (BARRIER_TYPES[bt].type === barrier.type) { bType = BARRIER_TYPES[bt]; break; }
        }
        assessed.push({
          barrier: barrier.name || barrier.type,
          type: barrier.type,
          location: barrier.location || "unknown",
          typical_reliability: bType ? bType.typical_reliability : 0.5,
          actual_condition: barrier.condition || "UNKNOWN",
          last_test_date: barrier.last_test || null,
          test_interval: bType ? bType.test_interval : "unknown",
          effectiveness: barrier.condition === "GOOD" ? "HIGH" : barrier.condition === "DEGRADED" ? "REDUCED" : "UNKNOWN",
          failure_mode: bType ? bType.failure_mode : "unknown"
        });
      }
      return ok({ engine: "multi-asset-cascade", barrier_count: assessed.length, barriers: assessed });
    }

    if (action === "get_graph") {
      if (!body.graph_id) return errResp(400, "graph_id required");
      if (!supabaseUrl || !supabaseKey) return errResp(500, "SUPABASE not configured");
      var sb2 = createClient(supabaseUrl, supabaseKey);
      var gr = await sb2.from("asset_graphs").select("*").eq("id", body.graph_id).single();
      if (gr.error || !gr.data) return errResp(404, "Graph not found");
      return ok({ engine: "multi-asset-cascade", graph: gr.data });
    }

    if (action === "get_graph_history") {
      if (!body.case_id) return errResp(400, "case_id required");
      if (!supabaseUrl || !supabaseKey) return errResp(500, "SUPABASE not configured");
      var sb3 = createClient(supabaseUrl, supabaseKey);
      var hist = await sb3.from("asset_graphs").select("id, graph_name, graph_type, created_at").eq("case_id", body.case_id).order("created_at", { ascending: false });
      return ok({ engine: "multi-asset-cascade", case_id: body.case_id, graphs: hist.data || [] });
    }

    return errResp(400, "Unknown action: " + action + ". Use get_registry for available actions.");
  } catch (err) {
    return errResp(500, String(err && err.message ? err.message : err));
  }
};
