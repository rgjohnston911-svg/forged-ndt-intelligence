// @ts-nocheck
/**
 * DEPLOY256 - Cross-Case Pattern Recognition Engine v1.0.0
 * netlify/functions/cross-case-patterns.ts
 *
 * Finds patterns across thousands of cases that no single inspector would see.
 * "Every time we see X on this asset class in this environment, Y follows within 18 months."
 *
 * 8 capabilities:
 *   1. Scan Cases for Patterns (fingerprint + cluster)
 *   2. Match New Case Against Known Patterns
 *   3. Extract Pattern Rules
 *   4. Generate Pattern Alerts
 *   5. Compute Pattern Statistics
 *   6. Get Emerging Trends
 *   7. Get Pattern History for a Case
 *   8. Pattern Audit Trail
 *
 * Actions:
 *   get_registry
 *   scan_patterns
 *   match_case
 *   get_clusters
 *   get_rules
 *   get_alerts
 *   acknowledge_alert
 *   get_statistics
 *   get_emerging_trends
 *   get_case_patterns
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var ENGINE_NAME = "cross-case-patterns";
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
// PATTERN DIMENSIONS — what we cluster on
// ============================================================
var PATTERN_DIMENSIONS = [
  "asset_type",
  "failure_mode",
  "environment",
  "material_class",
  "method",
  "vertical",
  "finding_type",
  "disposition",
  "severity"
];

// ============================================================
// CLUSTER TYPES
// ============================================================
var CLUSTER_TYPES = [
  "failure_recurrence",
  "method_ineffectiveness",
  "environment_correlation",
  "material_vulnerability",
  "age_related_degradation",
  "seasonal_pattern",
  "geographic_cluster",
  "mechanism_cascade_pattern"
];

// ============================================================
// SEVERITY THRESHOLDS
// ============================================================
var SEVERITY_THRESHOLDS = {
  critical: { min_cases: 3, min_rejection_rate: 0.70 },
  high: { min_cases: 3, min_rejection_rate: 0.50 },
  medium: { min_cases: 5, min_rejection_rate: 0.30 },
  low: { min_cases: 10, min_rejection_rate: 0.10 }
};

// ============================================================
// CAPABILITY REGISTRY
// ============================================================
var CAPABILITY_REGISTRY = [
  { id: "CAP-PAT-001", name: "Scan Cases for Patterns", action: "scan_patterns" },
  { id: "CAP-PAT-002", name: "Match New Case Against Known Patterns", action: "match_case" },
  { id: "CAP-PAT-003", name: "Extract Pattern Rules", action: "get_rules" },
  { id: "CAP-PAT-004", name: "Generate Pattern Alerts", action: "match_case" },
  { id: "CAP-PAT-005", name: "Compute Pattern Statistics", action: "get_statistics" },
  { id: "CAP-PAT-006", name: "Get Emerging Trends", action: "get_emerging_trends" },
  { id: "CAP-PAT-007", name: "Get Pattern History for Case", action: "get_case_patterns" },
  { id: "CAP-PAT-008", name: "Pattern Audit Trail", action: "get_registry" }
];

// ============================================================
// INTEGRATION MAP
// ============================================================
var INTEGRATION_MAP = {
  concept_intelligence_core: {
    consumes: ["mechanism chains", "failure pathways", "governing concepts"],
    produces: ["mechanism cascade patterns"]
  },
  cost_reasoning_engine: {
    consumes: ["failure cost profiles"],
    produces: ["cost pattern trends", "recurring failure cost clusters"]
  },
  outcome_tracking: {
    consumes: ["outcome records", "prediction accuracy"],
    produces: ["outcome-validated patterns"]
  },
  trend_analytics: {
    consumes: ["trend data"],
    produces: ["cross-case trend overlays"]
  },
  risk_scoring: {
    produces: ["pattern-based risk multipliers"]
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

function round4(n) {
  return Number(Number(n).toFixed(4));
}

function buildFingerprint(caseRow) {
  var parts = [];
  if (caseRow.asset_type) parts.push("A:" + caseRow.asset_type);
  if (caseRow.environment) parts.push("E:" + caseRow.environment);
  if (caseRow.material_class) parts.push("M:" + caseRow.material_class);
  if (caseRow.method) parts.push("MT:" + caseRow.method);
  if (caseRow.vertical) parts.push("V:" + caseRow.vertical);
  return parts.join("|");
}

function computeSimilarity(caseA, caseB) {
  var score = 0;
  var dimensions = 0;

  if (caseA.asset_type && caseB.asset_type) {
    dimensions = dimensions + 1;
    if (caseA.asset_type === caseB.asset_type) score = score + 1;
  }
  if (caseA.method && caseB.method) {
    dimensions = dimensions + 1;
    if (caseA.method === caseB.method) score = score + 1;
  }
  if (caseA.environment && caseB.environment) {
    dimensions = dimensions + 1;
    if (caseA.environment === caseB.environment) score = score + 1;
  }
  if (caseA.material_class && caseB.material_class) {
    dimensions = dimensions + 1;
    if (caseA.material_class === caseB.material_class) score = score + 1;
  }
  if (caseA.vertical && caseB.vertical) {
    dimensions = dimensions + 1;
    if (caseA.vertical === caseB.vertical) score = score + 1;
  }

  // Finding-level matches
  if (caseA.top_finding_type && caseB.top_finding_type) {
    dimensions = dimensions + 2;
    if (caseA.top_finding_type === caseB.top_finding_type) score = score + 2;
  }
  if (caseA.final_disposition && caseB.final_disposition) {
    dimensions = dimensions + 1;
    if (caseA.final_disposition === caseB.final_disposition) score = score + 1;
  }

  return dimensions > 0 ? round4(score / dimensions) : 0;
}

function determineSeverity(caseCount, rejectionRate) {
  if (caseCount >= SEVERITY_THRESHOLDS.critical.min_cases && rejectionRate >= SEVERITY_THRESHOLDS.critical.min_rejection_rate) return "critical";
  if (caseCount >= SEVERITY_THRESHOLDS.high.min_cases && rejectionRate >= SEVERITY_THRESHOLDS.high.min_rejection_rate) return "high";
  if (caseCount >= SEVERITY_THRESHOLDS.medium.min_cases && rejectionRate >= SEVERITY_THRESHOLDS.medium.min_rejection_rate) return "medium";
  return "low";
}

// ============================================================
// DATABASE OPERATIONS
// ============================================================

async function emitAuditEvent(orgId, caseId, actionType, eventJson) {
  await supabase.from("pattern_audit_events").insert({
    org_id: orgId,
    case_id: caseId || null,
    action_type: actionType,
    event_json: eventJson
  });
}

// ============================================================
// CORE: SCAN PATTERNS — analyze all cases for an org
// ============================================================

async function scanPatterns(orgId) {
  // Load all finalized cases for this org
  var caseResult = await supabase
    .from("inspection_cases")
    .select("id, case_number, title, status, method, asset_type, environment, material_class, vertical, final_disposition, final_confidence, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (caseResult.error) throw caseResult.error;
  var cases = caseResult.data || [];
  if (cases.length < 2) {
    return { clusters_found: 0, message: "Need at least 2 cases to find patterns" };
  }

  // Load findings for dimension extraction
  var caseIds = [];
  for (var ci = 0; ci < cases.length; ci++) {
    caseIds.push(cases[ci].id);
  }

  var findingsResult = await supabase
    .from("findings")
    .select("case_id, finding_type, severity, confidence")
    .in("case_id", caseIds.slice(0, 200));

  var findingsMap = {};
  if (findingsResult.data) {
    for (var fi = 0; fi < findingsResult.data.length; fi++) {
      var f = findingsResult.data[fi];
      if (!findingsMap[f.case_id]) findingsMap[f.case_id] = [];
      findingsMap[f.case_id].push(f);
    }
  }

  // Enrich cases with top finding
  for (var ei = 0; ei < cases.length; ei++) {
    var caseFindings = findingsMap[cases[ei].id] || [];
    if (caseFindings.length > 0) {
      cases[ei].top_finding_type = caseFindings[0].finding_type;
      cases[ei].top_severity = caseFindings[0].severity;
    }
  }

  // Group by each dimension and find clusters
  var clusters = [];
  var dimensions = ["asset_type", "method", "vertical", "environment", "material_class"];

  for (var di = 0; di < dimensions.length; di++) {
    var dim = dimensions[di];
    var groups = {};

    for (var gi = 0; gi < cases.length; gi++) {
      var val = cases[gi][dim];
      if (!val) continue;
      if (!groups[val]) groups[val] = [];
      groups[val].push(cases[gi]);
    }

    var keys = Object.keys(groups);
    for (var ki = 0; ki < keys.length; ki++) {
      var groupCases = groups[keys[ki]];
      if (groupCases.length < 2) continue;

      // Calculate rejection rate
      var rejections = 0;
      for (var ri = 0; ri < groupCases.length; ri++) {
        var disp = groupCases[ri].final_disposition;
        if (disp === "reject" || disp === "rejectable" || disp === "REJECT" || disp === "REJECTABLE") {
          rejections = rejections + 1;
        }
      }
      var rejectionRate = round4(rejections / groupCases.length);
      var severity = determineSeverity(groupCases.length, rejectionRate);

      // Find dominant finding type in this group
      var findingCounts = {};
      for (var fci = 0; fci < groupCases.length; fci++) {
        var ft = groupCases[fci].top_finding_type;
        if (ft) {
          findingCounts[ft] = (findingCounts[ft] || 0) + 1;
        }
      }
      var topFinding = null;
      var topFindingCount = 0;
      var fKeys = Object.keys(findingCounts);
      for (var fki = 0; fki < fKeys.length; fki++) {
        if (findingCounts[fKeys[fki]] > topFindingCount) {
          topFinding = fKeys[fki];
          topFindingCount = findingCounts[fKeys[fki]];
        }
      }

      var clusterKey = dim + ":" + keys[ki];
      clusters.push({
        org_id: orgId,
        cluster_key: clusterKey,
        cluster_name: dim.replace(/_/g, " ") + " = " + keys[ki] + " (" + groupCases.length + " cases)",
        cluster_type: "failure_recurrence",
        asset_type: dim === "asset_type" ? keys[ki] : null,
        failure_mode: topFinding,
        environment: dim === "environment" ? keys[ki] : null,
        material_class: dim === "material_class" ? keys[ki] : null,
        method: dim === "method" ? keys[ki] : null,
        vertical: dim === "vertical" ? keys[ki] : null,
        case_count: groupCases.length,
        confidence: round4(groupCases.length > 5 ? 0.85 : 0.60 + (groupCases.length * 0.05)),
        severity: severity,
        cluster_json: {
          dimension: dim,
          value: keys[ki],
          rejection_rate: rejectionRate,
          top_finding: topFinding,
          top_finding_count: topFindingCount,
          case_ids: groupCases.slice(0, 20).map(function(c) { return c.id; })
        },
        active: true,
        engine_version: ENGINE_VERSION
      });
    }
  }

  // Also scan for cross-dimension patterns (asset_type + finding_type combos)
  var crossGroups = {};
  for (var xi = 0; xi < cases.length; xi++) {
    var xKey = (cases[xi].asset_type || "unknown") + "+" + (cases[xi].top_finding_type || "unknown");
    if (!crossGroups[xKey]) crossGroups[xKey] = [];
    crossGroups[xKey].push(cases[xi]);
  }
  var xKeys = Object.keys(crossGroups);
  for (var xki = 0; xki < xKeys.length; xki++) {
    var xCases = crossGroups[xKeys[xki]];
    if (xCases.length < 3) continue;

    var xRejections = 0;
    for (var xri = 0; xri < xCases.length; xri++) {
      var xDisp = xCases[xri].final_disposition;
      if (xDisp === "reject" || xDisp === "rejectable" || xDisp === "REJECT" || xDisp === "REJECTABLE") {
        xRejections = xRejections + 1;
      }
    }
    var xRejRate = round4(xRejections / xCases.length);
    var xParts = xKeys[xki].split("+");

    clusters.push({
      org_id: orgId,
      cluster_key: "cross:" + xKeys[xki],
      cluster_name: xParts[0] + " with " + xParts[1] + " (" + xCases.length + " cases)",
      cluster_type: "mechanism_cascade_pattern",
      asset_type: xParts[0] !== "unknown" ? xParts[0] : null,
      failure_mode: xParts[1] !== "unknown" ? xParts[1] : null,
      environment: null,
      material_class: null,
      method: null,
      vertical: null,
      case_count: xCases.length,
      confidence: round4(xCases.length > 5 ? 0.85 : 0.60 + (xCases.length * 0.05)),
      severity: determineSeverity(xCases.length, xRejRate),
      cluster_json: {
        dimension: "asset_type+finding_type",
        asset_type: xParts[0],
        finding_type: xParts[1],
        rejection_rate: xRejRate,
        case_ids: xCases.slice(0, 20).map(function(c) { return c.id; })
      },
      active: true,
      engine_version: ENGINE_VERSION
    });
  }

  // Persist clusters (upsert by cluster_key)
  var persisted = 0;
  for (var pi = 0; pi < clusters.length; pi++) {
    var existing = await supabase
      .from("pattern_clusters")
      .select("id")
      .eq("org_id", orgId)
      .eq("cluster_key", clusters[pi].cluster_key)
      .limit(1);

    if (existing.data && existing.data.length > 0) {
      await supabase
        .from("pattern_clusters")
        .update({
          case_count: clusters[pi].case_count,
          confidence: clusters[pi].confidence,
          severity: clusters[pi].severity,
          cluster_json: clusters[pi].cluster_json,
          updated_at: new Date().toISOString()
        })
        .eq("id", existing.data[0].id);
    } else {
      await supabase.from("pattern_clusters").insert(clusters[pi]);
    }
    persisted = persisted + 1;
  }

  await emitAuditEvent(orgId, null, "scan_patterns", {
    cases_analyzed: cases.length,
    clusters_found: clusters.length,
    clusters_persisted: persisted
  });

  return {
    cases_analyzed: cases.length,
    clusters_found: clusters.length,
    clusters_persisted: persisted,
    clusters: clusters.slice(0, 50)
  };
}

// ============================================================
// CORE: MATCH CASE — check if a new case matches known patterns
// ============================================================

async function matchCase(caseId, orgId) {
  // Load the case
  var caseResult = await supabase
    .from("inspection_cases")
    .select("id, case_number, title, method, asset_type, environment, material_class, vertical, final_disposition")
    .eq("id", caseId)
    .maybeSingle();

  if (caseResult.error) throw caseResult.error;
  if (!caseResult.data) return { error: "Case not found: " + caseId };
  var caseData = caseResult.data;

  // Load findings for this case
  var findResult = await supabase
    .from("findings")
    .select("finding_type, severity")
    .eq("case_id", caseId)
    .limit(10);
  var topFinding = (findResult.data && findResult.data.length > 0) ? findResult.data[0].finding_type : null;

  // Load active clusters for this org
  var clusterResult = await supabase
    .from("pattern_clusters")
    .select("*")
    .eq("org_id", orgId)
    .eq("active", true)
    .order("case_count", { ascending: false })
    .limit(100);

  if (clusterResult.error) throw clusterResult.error;
  var clusters = clusterResult.data || [];

  var matches = [];
  for (var mi = 0; mi < clusters.length; mi++) {
    var c = clusters[mi];
    var matchScore = 0;
    var matchReasons = [];

    if (c.asset_type && caseData.asset_type && c.asset_type === caseData.asset_type) {
      matchScore = matchScore + 0.25;
      matchReasons.push("asset_type match: " + c.asset_type);
    }
    if (c.method && caseData.method && c.method === caseData.method) {
      matchScore = matchScore + 0.15;
      matchReasons.push("method match: " + c.method);
    }
    if (c.environment && caseData.environment && c.environment === caseData.environment) {
      matchScore = matchScore + 0.20;
      matchReasons.push("environment match: " + c.environment);
    }
    if (c.material_class && caseData.material_class && c.material_class === caseData.material_class) {
      matchScore = matchScore + 0.20;
      matchReasons.push("material match: " + c.material_class);
    }
    if (c.vertical && caseData.vertical && c.vertical === caseData.vertical) {
      matchScore = matchScore + 0.10;
      matchReasons.push("vertical match: " + c.vertical);
    }
    if (c.failure_mode && topFinding && c.failure_mode === topFinding) {
      matchScore = matchScore + 0.30;
      matchReasons.push("finding type match: " + topFinding);
    }

    if (matchScore >= 0.40) {
      matches.push({
        cluster_id: c.id,
        cluster_name: c.cluster_name,
        cluster_type: c.cluster_type,
        match_score: round4(Math.min(matchScore, 1.0)),
        cluster_severity: c.severity,
        cluster_case_count: c.case_count,
        cluster_confidence: c.confidence,
        match_reasons: matchReasons,
        cluster_json: c.cluster_json
      });
    }
  }

  // Sort by match score descending
  matches.sort(function(a, b) { return b.match_score - a.match_score; });

  // Generate alerts for high-scoring matches
  var alertsGenerated = 0;
  for (var ai = 0; ai < matches.length; ai++) {
    if (matches[ai].match_score >= 0.60) {
      var alertSeverity = matches[ai].cluster_severity;
      if (matches[ai].match_score >= 0.80) alertSeverity = "high";
      if (matches[ai].match_score >= 0.90 && matches[ai].cluster_severity === "critical") alertSeverity = "critical";

      await supabase.from("pattern_alerts").insert({
        case_id: caseId,
        org_id: orgId,
        cluster_id: matches[ai].cluster_id,
        alert_type: "pattern_match",
        alert_severity: alertSeverity,
        message: "This case matches pattern: " + matches[ai].cluster_name + " (score: " + Math.round(matches[ai].match_score * 100) + "%, " + matches[ai].cluster_case_count + " prior cases). " + matches[ai].match_reasons.join("; ") + ".",
        alert_json: matches[ai],
        engine_version: ENGINE_VERSION
      });
      alertsGenerated = alertsGenerated + 1;
    }
  }

  // Add case to matching clusters as member
  for (var mi2 = 0; mi2 < matches.length; mi2++) {
    if (matches[mi2].match_score >= 0.50) {
      await supabase.from("pattern_case_members").insert({
        cluster_id: matches[mi2].cluster_id,
        case_id: caseId,
        org_id: orgId,
        similarity_score: matches[mi2].match_score,
        contribution_json: { reasons: matches[mi2].match_reasons }
      });
    }
  }

  await emitAuditEvent(orgId, caseId, "match_case", {
    clusters_checked: clusters.length,
    matches_found: matches.length,
    alerts_generated: alertsGenerated
  });

  return {
    case_id: caseId,
    clusters_checked: clusters.length,
    matches_found: matches.length,
    alerts_generated: alertsGenerated,
    matches: matches.slice(0, 20)
  };
}

// ============================================================
// CORE: GET EMERGING TRENDS
// ============================================================

async function getEmergingTrends(orgId, lookbackDays) {
  var cutoff = new Date(Date.now() - (lookbackDays || 90) * 24 * 60 * 60 * 1000).toISOString();

  // Recent cases
  var recentResult = await supabase
    .from("inspection_cases")
    .select("id, asset_type, method, environment, material_class, vertical, final_disposition, created_at")
    .eq("org_id", orgId)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(500);

  var recentCases = recentResult.data || [];
  if (recentCases.length < 3) {
    return { trends: [], message: "Not enough recent cases for trend detection" };
  }

  // Count by dimension
  var dimensionCounts = {};
  var dimensions = ["asset_type", "method", "environment", "material_class", "vertical"];
  for (var di = 0; di < dimensions.length; di++) {
    dimensionCounts[dimensions[di]] = {};
  }

  var totalRejections = 0;
  for (var ci = 0; ci < recentCases.length; ci++) {
    var c = recentCases[ci];
    for (var d2 = 0; d2 < dimensions.length; d2++) {
      var dim = dimensions[d2];
      var val = c[dim];
      if (val) {
        if (!dimensionCounts[dim][val]) dimensionCounts[dim][val] = { total: 0, rejections: 0 };
        dimensionCounts[dim][val].total = dimensionCounts[dim][val].total + 1;
        var disp = c.final_disposition;
        if (disp === "reject" || disp === "rejectable" || disp === "REJECT" || disp === "REJECTABLE") {
          dimensionCounts[dim][val].rejections = dimensionCounts[dim][val].rejections + 1;
          totalRejections = totalRejections + 1;
        }
      }
    }
  }

  // Build trends — dimensions with elevated rejection rates
  var trends = [];
  var baseRejectionRate = recentCases.length > 0 ? round4(totalRejections / recentCases.length) : 0;

  for (var t1 = 0; t1 < dimensions.length; t1++) {
    var dimName = dimensions[t1];
    var vals = Object.keys(dimensionCounts[dimName]);
    for (var t2 = 0; t2 < vals.length; t2++) {
      var stats = dimensionCounts[dimName][vals[t2]];
      if (stats.total < 2) continue;
      var dimRejRate = round4(stats.rejections / stats.total);

      // Is this dimension's rejection rate elevated vs baseline?
      var isElevated = dimRejRate > baseRejectionRate * 1.5 && stats.rejections >= 2;
      var isVolume = stats.total >= 5;

      if (isElevated || isVolume) {
        trends.push({
          dimension: dimName,
          value: vals[t2],
          case_count: stats.total,
          rejection_count: stats.rejections,
          rejection_rate: dimRejRate,
          baseline_rejection_rate: baseRejectionRate,
          elevated: isElevated,
          severity: determineSeverity(stats.total, dimRejRate),
          trend_description: dimName.replace(/_/g, " ") + " = " + vals[t2] + ": " + stats.total + " cases, " + Math.round(dimRejRate * 100) + "% rejection rate" + (isElevated ? " (elevated vs " + Math.round(baseRejectionRate * 100) + "% baseline)" : "")
        });
      }
    }
  }

  // Sort by severity then rejection rate
  var severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  trends.sort(function(a, b) {
    var sevDiff = (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
    if (sevDiff !== 0) return sevDiff;
    return b.rejection_rate - a.rejection_rate;
  });

  return {
    lookback_days: lookbackDays || 90,
    total_recent_cases: recentCases.length,
    baseline_rejection_rate: baseRejectionRate,
    trends_found: trends.length,
    trends: trends
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
        pattern_dimensions: PATTERN_DIMENSIONS,
        cluster_types: CLUSTER_TYPES,
        severity_thresholds: SEVERITY_THRESHOLDS,
        integrations: INTEGRATION_MAP,
        actions: [
          "get_registry", "scan_patterns", "match_case", "get_clusters",
          "get_rules", "get_alerts", "acknowledge_alert", "get_statistics",
          "get_emerging_trends", "get_case_patterns"
        ]
      });
    }

    // ========================================================
    // ACTION: scan_patterns
    // ========================================================
    if (action === "scan_patterns") {
      var spOrgId = body.org_id;
      if (!spOrgId) return json(400, { ok: false, error: "Missing org_id" });
      var scanResult = await scanPatterns(spOrgId);
      return json(200, {
        ok: true,
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        output: scanResult
      });
    }

    // ========================================================
    // ACTION: match_case
    // ========================================================
    if (action === "match_case") {
      var mcCaseId = body.case_id;
      var mcOrgId = body.org_id;
      if (!mcCaseId || !mcOrgId) return json(400, { ok: false, error: "Missing case_id and org_id" });
      var matchResult = await matchCase(mcCaseId, mcOrgId);
      if (matchResult.error) return json(404, { ok: false, error: matchResult.error });
      return json(200, {
        ok: true,
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        output: matchResult
      });
    }

    // ========================================================
    // ACTION: get_clusters
    // ========================================================
    if (action === "get_clusters") {
      var gcOrgId = body.org_id;
      if (!gcOrgId) return json(400, { ok: false, error: "Missing org_id" });
      var gcSeverity = body.severity || null;
      var gcQuery = supabase
        .from("pattern_clusters")
        .select("*")
        .eq("org_id", gcOrgId)
        .eq("active", true)
        .order("case_count", { ascending: false })
        .limit(body.limit || 50);
      if (gcSeverity) gcQuery = gcQuery.eq("severity", gcSeverity);
      var gcResult = await gcQuery;
      if (gcResult.error) throw gcResult.error;
      return json(200, {
        ok: true,
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        clusters: gcResult.data || [],
        count: (gcResult.data || []).length
      });
    }

    // ========================================================
    // ACTION: get_rules
    // ========================================================
    if (action === "get_rules") {
      var grOrgId = body.org_id;
      if (!grOrgId) return json(400, { ok: false, error: "Missing org_id" });
      var grResult = await supabase
        .from("pattern_rules")
        .select("*")
        .eq("org_id", grOrgId)
        .eq("active", true)
        .order("confidence", { ascending: false })
        .limit(body.limit || 50);
      if (grResult.error) throw grResult.error;
      return json(200, {
        ok: true,
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        rules: grResult.data || [],
        count: (grResult.data || []).length
      });
    }

    // ========================================================
    // ACTION: get_alerts
    // ========================================================
    if (action === "get_alerts") {
      var gaOrgId = body.org_id;
      if (!gaOrgId) return json(400, { ok: false, error: "Missing org_id" });
      var gaAcknowledged = body.acknowledged === true;
      var gaQuery = supabase
        .from("pattern_alerts")
        .select("*")
        .eq("org_id", gaOrgId)
        .eq("acknowledged", gaAcknowledged)
        .order("created_at", { ascending: false })
        .limit(body.limit || 50);
      if (body.case_id) gaQuery = gaQuery.eq("case_id", body.case_id);
      var gaResult = await gaQuery;
      if (gaResult.error) throw gaResult.error;
      return json(200, {
        ok: true,
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        alerts: gaResult.data || [],
        count: (gaResult.data || []).length
      });
    }

    // ========================================================
    // ACTION: acknowledge_alert
    // ========================================================
    if (action === "acknowledge_alert") {
      var aaAlertId = body.alert_id;
      if (!aaAlertId) return json(400, { ok: false, error: "Missing alert_id" });
      var aaResult = await supabase
        .from("pattern_alerts")
        .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
        .eq("id", aaAlertId)
        .select()
        .single();
      if (aaResult.error) throw aaResult.error;
      return json(200, {
        ok: true,
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        alert: aaResult.data
      });
    }

    // ========================================================
    // ACTION: get_statistics
    // ========================================================
    if (action === "get_statistics") {
      var gsOrgId = body.org_id;
      if (!gsOrgId) return json(400, { ok: false, error: "Missing org_id" });
      var gsResult = await supabase
        .from("pattern_statistics")
        .select("*")
        .eq("org_id", gsOrgId)
        .order("case_count", { ascending: false })
        .limit(body.limit || 100);
      if (gsResult.error) throw gsResult.error;
      return json(200, {
        ok: true,
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        statistics: gsResult.data || [],
        count: (gsResult.data || []).length
      });
    }

    // ========================================================
    // ACTION: get_emerging_trends
    // ========================================================
    if (action === "get_emerging_trends") {
      var etOrgId = body.org_id;
      if (!etOrgId) return json(400, { ok: false, error: "Missing org_id" });
      var etResult = await getEmergingTrends(etOrgId, body.lookback_days || 90);
      return json(200, {
        ok: true,
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        output: etResult
      });
    }

    // ========================================================
    // ACTION: get_case_patterns
    // ========================================================
    if (action === "get_case_patterns") {
      var cpCaseId = body.case_id;
      if (!cpCaseId) return json(400, { ok: false, error: "Missing case_id" });

      // Get memberships
      var memberResult = await supabase
        .from("pattern_case_members")
        .select("*, pattern_clusters(*)")
        .eq("case_id", cpCaseId)
        .order("similarity_score", { ascending: false });
      if (memberResult.error) throw memberResult.error;

      // Get alerts
      var alertResult = await supabase
        .from("pattern_alerts")
        .select("*")
        .eq("case_id", cpCaseId)
        .order("created_at", { ascending: false });
      if (alertResult.error) throw alertResult.error;

      return json(200, {
        ok: true,
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        case_id: cpCaseId,
        cluster_memberships: memberResult.data || [],
        alerts: alertResult.data || []
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
