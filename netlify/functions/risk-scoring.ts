// @ts-nocheck
/**
 * DEPLOY232 - risk-scoring.ts
 * netlify/functions/risk-scoring.ts
 *
 * RISK SCORING ENGINE
 *
 * Calculates composite risk scores for cases based on multiple factors:
 * damage severity, confidence, compliance gaps, escalation status,
 * override history, and time since last inspection.
 *
 * POST /api/risk-scoring { action: "score_case", case_id }
 *   -> Returns detailed risk breakdown for a single case
 *
 * POST /api/risk-scoring { action: "score_all" }
 *   -> Scores all open cases and returns ranked risk list
 *
 * POST /api/risk-scoring { action: "get_risk_matrix" }
 *   -> Returns risk distribution matrix (likelihood vs consequence)
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

// Risk factor weights (sum to 1.0)
var WEIGHTS = {
  severity: 0.25,
  confidence_gap: 0.15,
  damage_type: 0.15,
  override_risk: 0.10,
  escalation_risk: 0.10,
  finding_density: 0.10,
  age_risk: 0.10,
  compliance_risk: 0.05
};

// Damage type risk rankings (0-1)
var DAMAGE_RISK = {
  "hydrogen": 0.95,
  "scc": 0.95,
  "stress corrosion cracking": 0.95,
  "fatigue": 0.90,
  "creep": 0.85,
  "erosion-corrosion": 0.80,
  "pitting": 0.75,
  "corrosion": 0.65,
  "erosion": 0.65,
  "general corrosion": 0.55,
  "mechanical damage": 0.60,
  "wear": 0.50,
  "coating failure": 0.30,
  "cosmetic": 0.10
};

// Disposition risk rankings
var DISPOSITION_RISK = {
  "replace": 1.0,
  "repair_immediate": 0.95,
  "repair": 0.80,
  "monitor_closely": 0.65,
  "monitor": 0.50,
  "acceptable": 0.20,
  "accept": 0.20,
  "no_action": 0.10
};

function scoreSeverity(caseData) {
  var state = (caseData.state || "").toLowerCase();
  var disp = (caseData.disposition || "").toLowerCase();

  // Check disposition first
  var dispKeys = Object.keys(DISPOSITION_RISK);
  for (var di = 0; di < dispKeys.length; di++) {
    if (disp.indexOf(dispKeys[di]) >= 0) return DISPOSITION_RISK[dispKeys[di]];
  }

  // Fall back to state
  if (state.indexOf("critical") >= 0 || state.indexOf("immediate") >= 0) return 1.0;
  if (state.indexOf("major") >= 0 || state.indexOf("severe") >= 0) return 0.80;
  if (state.indexOf("moderate") >= 0 || state.indexOf("degrad") >= 0) return 0.60;
  if (state.indexOf("minor") >= 0) return 0.35;
  if (state.indexOf("acceptable") >= 0 || state.indexOf("pass") >= 0) return 0.15;

  return 0.50; // unknown = medium risk
}

function scoreConfidenceGap(caseData) {
  // Low confidence = higher risk (system is uncertain)
  var conf = caseData.confidence;
  if (conf === null || conf === undefined) return 0.70; // no confidence = risky
  return Math.max(0, 1.0 - conf); // inverse: 0.9 confidence = 0.1 risk
}

function scoreDamageType(caseData) {
  var dmg = (caseData.damage_type || "").toLowerCase();
  if (!dmg) return 0.50;

  var dmgKeys = Object.keys(DAMAGE_RISK);
  for (var di = 0; di < dmgKeys.length; di++) {
    if (dmg.indexOf(dmgKeys[di]) >= 0) return DAMAGE_RISK[dmgKeys[di]];
  }
  return 0.50;
}

function scoreOverrideRisk(caseData) {
  if (caseData.inspector_override_active) return 0.85; // active override = disagreement = risk
  if (caseData.adjudication_count && caseData.adjudication_count > 2) return 0.60; // multiple reviews = complex
  if (caseData.adjudication_count && caseData.adjudication_count > 0) return 0.30; // reviewed = some attention needed
  return 0.10; // no overrides = low risk
}

function scoreEscalationRisk(caseData) {
  if (caseData.escalation_status === "open" || caseData.escalation_status === "assigned") return 0.90;
  if (caseData.escalation_count && caseData.escalation_count > 1) return 0.70;
  if (caseData.escalation_count && caseData.escalation_count > 0) return 0.50;
  return 0.05;
}

function scoreFindingDensity(findingCount) {
  if (findingCount >= 10) return 1.0;
  if (findingCount >= 5) return 0.75;
  if (findingCount >= 3) return 0.55;
  if (findingCount >= 1) return 0.35;
  return 0.10;
}

function scoreAge(caseData) {
  if (!caseData.created_at) return 0.50;
  var ageMs = Date.now() - new Date(caseData.created_at).getTime();
  var ageDays = ageMs / (1000 * 60 * 60 * 24);

  // Older open cases = higher risk (languishing)
  if (caseData.status === "open" || caseData.status === "in_progress") {
    if (ageDays > 90) return 0.90;
    if (ageDays > 30) return 0.65;
    if (ageDays > 7) return 0.40;
    return 0.15;
  }
  return 0.10; // closed cases = low age risk
}

function calculateRiskScore(factors) {
  var score = 0;
  var keys = Object.keys(WEIGHTS);
  for (var wi = 0; wi < keys.length; wi++) {
    var key = keys[wi];
    score += (factors[key] || 0) * WEIGHTS[key];
  }
  return Math.round(score * 1000) / 1000;
}

function riskLevel(score) {
  if (score >= 0.75) return "critical";
  if (score >= 0.55) return "high";
  if (score >= 0.35) return "medium";
  if (score >= 0.15) return "low";
  return "minimal";
}

function riskColor(level) {
  if (level === "critical") return "#ef4444";
  if (level === "high") return "#f59e0b";
  if (level === "medium") return "#3b82f6";
  if (level === "low") return "#22c55e";
  return "#8b949e";
}

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action;
    var sb = createClient(supabaseUrl, supabaseKey);
    var startTime = Date.now();

    // ── ACTION: score_case ──
    if (action === "score_case") {
      if (!body.case_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };

      var caseResult = await sb.from("inspection_cases").select("*").eq("id", body.case_id).single();
      if (caseResult.error || !caseResult.data) return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "case not found" }) };
      var caseData = caseResult.data;

      var findingCount = await sb.from("findings").select("id", { count: "exact", head: true }).eq("case_id", body.case_id);
      var numFindings = findingCount.count || 0;

      var factors = {
        severity: scoreSeverity(caseData),
        confidence_gap: scoreConfidenceGap(caseData),
        damage_type: scoreDamageType(caseData),
        override_risk: scoreOverrideRisk(caseData),
        escalation_risk: scoreEscalationRisk(caseData),
        finding_density: scoreFindingDensity(numFindings),
        age_risk: scoreAge(caseData),
        compliance_risk: 0.50 // default until compliance-matrix is called
      };

      var score = calculateRiskScore(factors);
      var level = riskLevel(score);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          case_id: body.case_id,
          risk_score: score,
          risk_level: level,
          risk_color: riskColor(level),
          factors: factors,
          weights: WEIGHTS,
          finding_count: numFindings,
          case_summary: {
            state: caseData.state,
            disposition: caseData.disposition,
            confidence: caseData.confidence,
            damage_type: caseData.damage_type,
            material: caseData.material,
            override_active: caseData.inspector_override_active || false,
            escalation_status: caseData.escalation_status || null
          },
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: score_all ──
    if (action === "score_all") {
      var allResult = await sb.from("inspection_cases").select("*");
      if (allResult.error) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: allResult.error.message }) };

      var allCases = allResult.data || [];
      var scoredCases = [];

      // Get finding counts for all cases
      var findingsResult = await sb.from("findings").select("case_id");
      var findingsByCaseId = {};
      if (findingsResult.data) {
        for (var fi = 0; fi < findingsResult.data.length; fi++) {
          var fCaseId = findingsResult.data[fi].case_id;
          findingsByCaseId[fCaseId] = (findingsByCaseId[fCaseId] || 0) + 1;
        }
      }

      for (var ci = 0; ci < allCases.length; ci++) {
        var c = allCases[ci];
        var nf = findingsByCaseId[c.id] || 0;

        var factors2 = {
          severity: scoreSeverity(c),
          confidence_gap: scoreConfidenceGap(c),
          damage_type: scoreDamageType(c),
          override_risk: scoreOverrideRisk(c),
          escalation_risk: scoreEscalationRisk(c),
          finding_density: scoreFindingDensity(nf),
          age_risk: scoreAge(c),
          compliance_risk: 0.50
        };

        var score2 = calculateRiskScore(factors2);
        var level2 = riskLevel(score2);

        scoredCases.push({
          case_id: c.id,
          case_number: c.case_number || c.id.substring(0, 8),
          risk_score: score2,
          risk_level: level2,
          risk_color: riskColor(level2),
          state: c.state,
          disposition: c.disposition,
          confidence: c.confidence,
          damage_type: c.damage_type,
          material: c.material,
          component: c.component_name,
          status: c.status,
          finding_count: nf,
          override_active: c.inspector_override_active || false
        });
      }

      // Sort by risk score descending (highest risk first)
      scoredCases.sort(function(a, b) { return b.risk_score - a.risk_score; });

      // Summary stats
      var levelCounts = { critical: 0, high: 0, medium: 0, low: 0, minimal: 0 };
      for (var li = 0; li < scoredCases.length; li++) {
        levelCounts[scoredCases[li].risk_level] = (levelCounts[scoredCases[li].risk_level] || 0) + 1;
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          total_cases: scoredCases.length,
          risk_distribution: levelCounts,
          avg_risk_score: scoredCases.length > 0 ? Math.round((scoredCases.reduce(function(sum, c2) { return sum + c2.risk_score; }, 0) / scoredCases.length) * 1000) / 1000 : null,
          cases: scoredCases,
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: get_risk_matrix ──
    if (action === "get_risk_matrix") {
      var matrixResult = await sb.from("inspection_cases").select("id, state, disposition, confidence, damage_type");
      if (matrixResult.error) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: matrixResult.error.message }) };

      var matrixCases = matrixResult.data || [];
      // 5x5 matrix: likelihood (confidence gap) vs consequence (severity)
      var matrix = {};
      var likelihoodBuckets = ["very_low", "low", "medium", "high", "very_high"];
      var consequenceBuckets = ["negligible", "minor", "moderate", "major", "catastrophic"];

      for (var mi = 0; mi < matrixCases.length; mi++) {
        var mc = matrixCases[mi];
        var sevScore = scoreSeverity(mc);
        var confGap = scoreConfidenceGap(mc);

        // Map to buckets
        var lBucket = confGap >= 0.8 ? "very_high" : confGap >= 0.6 ? "high" : confGap >= 0.4 ? "medium" : confGap >= 0.2 ? "low" : "very_low";
        var cBucket = sevScore >= 0.8 ? "catastrophic" : sevScore >= 0.6 ? "major" : sevScore >= 0.4 ? "moderate" : sevScore >= 0.2 ? "minor" : "negligible";

        var mKey = lBucket + "|" + cBucket;
        if (!matrix[mKey]) matrix[mKey] = { likelihood: lBucket, consequence: cBucket, count: 0, case_ids: [] };
        matrix[mKey].count++;
        if (matrix[mKey].case_ids.length < 5) matrix[mKey].case_ids.push(mc.id);
      }

      var matrixArr = [];
      var mKeys = Object.keys(matrix);
      for (var mk = 0; mk < mKeys.length; mk++) {
        matrixArr.push(matrix[mKeys[mk]]);
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          matrix: matrixArr,
          total_cases: matrixCases.length,
          likelihood_axis: likelihoodBuckets,
          consequence_axis: consequenceBuckets,
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action + ". Valid: score_case, score_all, get_risk_matrix" }) };

  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
