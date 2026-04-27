// @ts-nocheck
/**
 * CFI-ENGINE — Contextual Failure Intelligence Engine
 * netlify/functions/cfi-engine.ts
 *
 * DEPLOY — CFI-1.0.0 (Production)
 *
 * Single action-based routing function. The CFI layer WRAPS the existing DDE engine,
 * identifying contextual hotspots from Supabase and optionally calling DDE for
 * mechanism probabilities.
 *
 * Actions:
 *  1. get_registry — Engine capabilities & version
 *  2. analyze_context — CFI_CONTEXT_ROUTER + CFI_FAILURE_HOTSPOT_ENGINE
 *  3. analyze_with_dde — CFI_DAMAGE_MECHANISM_MATCHER (wraps DDE)
 *  4. get_inspection_plan — CFI_INSPECTION_METHOD_ROUTER + CFI_EVIDENCE_REQUIREMENT_ENGINE
 *  5. get_risk_assessment — CFI_RISK_ESCALATION_ENGINE
 *  6. get_repair_plan — CFI_REPAIR_PREVENTION_ENGINE
 *  7. record_finding — Records CFI analysis result to cfi_case_findings
 *  8. submit_feedback — CFI_LEARNING_FEEDBACK_LOOP
 *  9. get_pattern_library — CFI_ASSET_LOCATION_LIBRARY
 *
 * POST-only with CORS headers. var only. String concat only.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var supabase = createClient(supabaseUrl, supabaseKey);

var ENGINE_VERSION = "CFI-1.0.0";
var ENGINE_NAME = "Contextual Failure Intelligence Engine";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

// ────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ────────────────────────────────────────────────────────────────────────────

function num(v, fallback) {
  var n = Number(v);
  if (v === undefined || v === null || v === "" || isNaN(n)) {
    return fallback !== undefined ? fallback : null;
  }
  return n;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function getMissing(inp, keys) {
  var m = [];
  for (var i = 0; i < keys.length; i++) {
    if (inp[keys[i]] === undefined || inp[keys[i]] === null || inp[keys[i]] === "") {
      m.push(keys[i]);
    }
  }
  return m;
}

function fuzzyMatch(str1, str2) {
  if (!str1 || !str2) return 0;
  var s1 = String(str1).toLowerCase();
  var s2 = String(str2).toLowerCase();
  if (s1 === s2) return 1.0;
  if (s1.indexOf(s2) !== -1 || s2.indexOf(s1) !== -1) return 0.75;
  return 0;
}

function countContextMatches(pattern, context) {
  var score = 0;
  var weights = {
    domain: 1.0,
    asset_type: 1.0,
    location_context: 0.9,
    geometry_context: 0.7,
    material: 0.7,
    coating_context: 0.6,
    insulation_context: 0.6,
    environment_context: 0.7,
    process_context: 0.7,
    loading_context: 0.7
  };
  for (var key in weights) {
    if (pattern[key] && context[key]) {
      var match = fuzzyMatch(pattern[key], context[key]);
      if (match > 0) score += match * weights[key];
    }
  }
  return score;
}

function mergeUnique(arr1, arr2) {
  var result = arr1 ? arr1.slice() : [];
  if (!arr2) return result;
  for (var i = 0; i < arr2.length; i++) {
    if (result.indexOf(arr2[i]) === -1) {
      result.push(arr2[i]);
    }
  }
  return result;
}

function computeHotspotScore(matchQuality, matchCount, severity) {
  var qualityScore = matchQuality * 30;
  var countScore = Math.min(matchCount * 10, 40);
  var severityMultiplier = severity === "CRITICAL" ? 1.3 : severity === "HIGH" ? 1.1 : 1.0;
  return Math.min(Math.round((qualityScore + countScore) * severityMultiplier), 100);
}

function hotspotSeverity(score) {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

// ────────────────────────────────────────────────────────────────────────────
// ACTION HANDLERS
// ────────────────────────────────────────────────────────────────────────────

async function handleGetRegistry() {
  return {
    status: "OK",
    engine: "CFI-ENGINE",
    version: ENGINE_VERSION,
    name: ENGINE_NAME,
    capabilities: [
      "get_registry — Query engine capabilities and version",
      "analyze_context — Match asset context to failure patterns and compute hotspot score",
      "analyze_with_dde — Run analyze_context and bridge to DDE engine for mechanism probabilities",
      "get_inspection_plan — Produce prioritized inspection plan with method rationale and gaps",
      "get_risk_assessment — Evaluate current risk level, escalation triggers, and response timeline",
      "get_repair_plan — Produce immediate/short-term/long-term repair and prevention measures",
      "record_finding — Save CFI analysis result to cfi_case_findings table",
      "submit_feedback — Record inspector feedback and adjust pattern confidence weights",
      "get_pattern_library — Browse and filter cfi_context_patterns library"
    ],
    actions: [
      "get_registry",
      "analyze_context",
      "analyze_with_dde",
      "get_inspection_plan",
      "get_risk_assessment",
      "get_repair_plan",
      "record_finding",
      "submit_feedback",
      "get_pattern_library"
    ]
  };
}

async function handleAnalyzeContext(inp) {
  var asset_context = inp.asset_context || {};
  var observed_context = inp.observed_context || {};

  if (!asset_context.domain) {
    return { status: "HOLD", missing_fields: ["asset_context.domain"] };
  }

  try {
    var matchingPatterns = [];
    var domainPatterns = [];

    try {
      var resp = await supabase
        .from("cfi_context_patterns")
        .select("*")
        .eq("domain", asset_context.domain);

      if (resp.data) {
        domainPatterns = resp.data;
      }
    } catch (e) {
      // Continue with empty patterns
    }

    for (var i = 0; i < domainPatterns.length; i++) {
      var pattern = domainPatterns[i];
      var assetTypeMatch = fuzzyMatch(pattern.asset_type, asset_context.asset_type);
      if (assetTypeMatch < 0.5) continue;

      var contextScore = countContextMatches(pattern, observed_context);
      var weightedScore = contextScore * (pattern.confidence_weight || 0.7);

      matchingPatterns.push({
        pattern_id: pattern.id,
        domain: pattern.domain,
        asset_type: pattern.asset_type,
        location_context: pattern.location_context,
        failure_modes: pattern.common_failure_modes || [],
        damage_mechanisms: pattern.likely_damage_mechanisms || [],
        ndt_methods: (pattern.primary_ndt_methods || []).concat(pattern.secondary_ndt_methods || []),
        primary_ndt_methods: pattern.primary_ndt_methods || [],
        secondary_ndt_methods: pattern.secondary_ndt_methods || [],
        evidence_required: pattern.evidence_required || [],
        risk_indicators: pattern.risk_indicators || [],
        escalation_triggers: pattern.escalation_triggers || [],
        recommended_actions: pattern.recommended_actions || [],
        prevention_actions: pattern.prevention_actions || [],
        match_score: contextScore,
        weighted_score: weightedScore,
        severity: pattern.severity_default || "MEDIUM"
      });
    }

    matchingPatterns.sort(function(a, b) {
      return b.weighted_score - a.weighted_score;
    });

    var topPatterns = matchingPatterns.slice(0, 5);

    var consolidated_failure_modes = [];
    var consolidated_damage_mechanisms = [];
    var consolidated_primary_ndt = [];
    var consolidated_secondary_ndt = [];
    var consolidated_evidence = [];
    var consolidated_risk_indicators = [];
    var consolidated_escalation = [];
    var consolidated_recommended = [];
    var consolidated_prevention = [];

    for (var j = 0; j < topPatterns.length; j++) {
      var p = topPatterns[j];
      consolidated_failure_modes = mergeUnique(consolidated_failure_modes, p.failure_modes);
      consolidated_damage_mechanisms = mergeUnique(consolidated_damage_mechanisms, p.damage_mechanisms);
      consolidated_primary_ndt = mergeUnique(consolidated_primary_ndt, p.primary_ndt_methods);
      consolidated_secondary_ndt = mergeUnique(consolidated_secondary_ndt, p.secondary_ndt_methods);
      consolidated_evidence = mergeUnique(consolidated_evidence, p.evidence_required);
      consolidated_risk_indicators = mergeUnique(consolidated_risk_indicators, p.risk_indicators);
      consolidated_escalation = mergeUnique(consolidated_escalation, p.escalation_triggers);
      consolidated_recommended = mergeUnique(consolidated_recommended, p.recommended_actions);
      consolidated_prevention = mergeUnique(consolidated_prevention, p.prevention_actions);
    }

    var avgSeverity = topPatterns.length > 0
      ? topPatterns.reduce(function(sum, p) { return sum + (p.severity === "CRITICAL" ? 3 : p.severity === "HIGH" ? 2 : 1); }, 0) / topPatterns.length
      : 1;

    var hotspot_score = 0;
    if (topPatterns.length > 0) {
      hotspot_score = computeHotspotScore(
        topPatterns[0].weighted_score / 10,
        topPatterns.length,
        topPatterns[0].severity
      );
    }

    var severity = hotspotSeverity(hotspot_score);

    var suggestedDdeDomain = "fixed";
    if (asset_context.domain === "subsea" || asset_context.domain === "pipeline") {
      suggestedDdeDomain = "subsea";
    } else if (asset_context.domain === "marine") {
      suggestedDdeDomain = "marine";
    } else if (asset_context.domain === "offshore" && observed_context.process_context === "floating") {
      suggestedDdeDomain = "floating";
    }

    var suggested_evidence_keys = {};
    if (observed_context.location_context) suggested_evidence_keys.location = observed_context.location_context;
    if (observed_context.environment_context) suggested_evidence_keys.environment = observed_context.environment_context;
    if (observed_context.process_context) suggested_evidence_keys.process = observed_context.process_context;
    if (observed_context.loading_context) suggested_evidence_keys.loading = observed_context.loading_context;
    if (observed_context.coating_context) suggested_evidence_keys.coating = observed_context.coating_context;

    return {
      status: "OK",
      engine: "CFI-ENGINE",
      version: ENGINE_VERSION,
      action: "analyze_context",
      hotspot_score: hotspot_score,
      hotspot_severity: severity,
      matched_patterns: topPatterns,
      consolidated: {
        failure_modes: consolidated_failure_modes,
        damage_mechanisms: consolidated_damage_mechanisms,
        primary_ndt_methods: consolidated_primary_ndt,
        secondary_ndt_methods: consolidated_secondary_ndt,
        evidence_required: consolidated_evidence,
        risk_indicators: consolidated_risk_indicators,
        escalation_triggers: consolidated_escalation,
        recommended_actions: consolidated_recommended,
        prevention_actions: consolidated_prevention
      },
      dde_bridge: {
        suggested_dde_domain: suggestedDdeDomain,
        suggested_evidence_keys: suggested_evidence_keys
      }
    };
  } catch (err) {
    return {
      status: "ERROR",
      error: String(err),
      stage: "analyze_context"
    };
  }
}

async function handleAnalyzeWithDde(inp) {
  var asset_context = inp.asset_context || {};
  var observed_context = inp.observed_context || {};

  if (!asset_context.domain) {
    return { status: "HOLD", missing_fields: ["asset_context.domain"] };
  }

  try {
    var cfiResult = await handleAnalyzeContext(inp);
    if (cfiResult.status !== "OK") {
      return cfiResult;
    }

    var ddeDomain = cfiResult.dde_bridge.suggested_dde_domain;

    var ddeObservedEvidence = {};
    if (observed_context.location_context) ddeObservedEvidence.location_clues = [observed_context.location_context];
    if (observed_context.environment_context) ddeObservedEvidence.environment_signature = observed_context.environment_context;
    if (observed_context.process_context) ddeObservedEvidence.process_regime = observed_context.process_context;
    if (observed_context.loading_context) ddeObservedEvidence.loading_pattern = observed_context.loading_context;

    var ddePayload = {
      action: "diagnose",
      domain: ddeDomain,
      asset_context: {
        material: asset_context.material || "unknown",
        component_type: asset_context.component || "generic"
      },
      observed_evidence: ddeObservedEvidence
    };

    var ddeUrl = supabaseUrl
      ? "https://4dndt.netlify.app/.netlify/functions/dde-engine"
      : "http://localhost:8888/.netlify/functions/dde-engine";

    var ddeResponse = null;
    try {
      var fetchResp = await fetch(ddeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ddePayload)
      });
      ddeResponse = await fetchResp.json();
    } catch (e) {
      // DDE unavailable; continue with CFI results only
    }

    return {
      status: "OK",
      engine: "CFI-ENGINE",
      version: ENGINE_VERSION,
      action: "analyze_with_dde",
      hotspot_score: cfiResult.hotspot_score,
      hotspot_severity: cfiResult.hotspot_severity,
      matched_patterns: cfiResult.matched_patterns,
      consolidated: cfiResult.consolidated,
      dde_bridge: cfiResult.dde_bridge,
      dde_response: ddeResponse || { status: "UNAVAILABLE", note: "DDE endpoint not reachable; CFI results above are definitive" }
    };
  } catch (err) {
    return {
      status: "ERROR",
      error: String(err),
      stage: "analyze_with_dde"
    };
  }
}

async function handleGetInspectionPlan(inp) {
  var asset_context = inp.asset_context || {};
  var observed_context = inp.observed_context || {};

  if (!asset_context.domain) {
    return { status: "HOLD", missing_fields: ["asset_context.domain"] };
  }

  try {
    var cfiResult = await handleAnalyzeContext(inp);
    if (cfiResult.status !== "OK") {
      return cfiResult;
    }

    var primaryMethods = cfiResult.consolidated.primary_ndt_methods || [];
    var secondaryMethods = cfiResult.consolidated.secondary_ndt_methods || [];
    var evidenceRequired = cfiResult.consolidated.evidence_required || [];
    var observedEvidenceSet = [];

    if (observed_context.coating_context) observedEvidenceSet.push("coating_assessment");
    if (observed_context.insulation_context) observedEvidenceSet.push("insulation_inspection");
    if (observed_context.geometry_context) observedEvidenceSet.push("dimensional_survey");

    var evidenceGaps = [];
    for (var i = 0; i < evidenceRequired.length; i++) {
      if (observedEvidenceSet.indexOf(evidenceRequired[i]) === -1) {
        evidenceGaps.push(evidenceRequired[i]);
      }
    }

    var inspectionSequence = [];
    for (var j = 0; j < primaryMethods.length; j++) {
      inspectionSequence.push({
        sequence_order: j + 1,
        method: primaryMethods[j],
        priority: "PRIMARY",
        rationale: "High confidence match to observed context and failure patterns"
      });
    }
    for (var k = 0; k < secondaryMethods.length; k++) {
      inspectionSequence.push({
        sequence_order: primaryMethods.length + k + 1,
        method: secondaryMethods[k],
        priority: "SECONDARY",
        rationale: "Confirmatory or secondary mechanism verification"
      });
    }

    return {
      status: "OK",
      engine: "CFI-ENGINE",
      version: ENGINE_VERSION,
      action: "get_inspection_plan",
      hotspot_score: cfiResult.hotspot_score,
      hotspot_severity: cfiResult.hotspot_severity,
      inspection_plan: {
        primary_methods: primaryMethods,
        secondary_methods: secondaryMethods,
        evidence_gaps: evidenceGaps,
        inspection_sequence: inspectionSequence,
        method_limitations: [
          "Surface-breaking cracks require magnetic or dye penetrant confirmation",
          "Subsurface defects may require ultrasonic or TOFD confirmation",
          "Material composition affects radiation penetration; thickness limits apply"
        ]
      }
    };
  } catch (err) {
    return {
      status: "ERROR",
      error: String(err),
      stage: "get_inspection_plan"
    };
  }
}

async function handleGetRiskAssessment(inp) {
  var asset_context = inp.asset_context || {};
  var observed_context = inp.observed_context || {};

  if (!asset_context.domain) {
    return { status: "HOLD", missing_fields: ["asset_context.domain"] };
  }

  try {
    var cfiResult = await handleAnalyzeContext(inp);
    if (cfiResult.status !== "OK") {
      return cfiResult;
    }

    var escalationTriggers = cfiResult.consolidated.escalation_triggers || [];
    var activeEscalations = [];

    for (var i = 0; i < escalationTriggers.length; i++) {
      activeEscalations.push({
        trigger: escalationTriggers[i],
        active: true,
        consequence: "Potential for rapid degradation and unplanned failure"
      });
    }

    var riskLevel = cfiResult.hotspot_severity;
    var timeUrgency = riskLevel === "CRITICAL" ? "IMMEDIATE (24-48 hours)" : riskLevel === "HIGH" ? "URGENT (1-2 weeks)" : riskLevel === "MEDIUM" ? "PLANNED (1-2 months)" : "ROUTINE (next scheduled inspection)";

    return {
      status: "OK",
      engine: "CFI-ENGINE",
      version: ENGINE_VERSION,
      action: "get_risk_assessment",
      risk_level: riskLevel,
      hotspot_score: cfiResult.hotspot_score,
      escalation_triggers: activeEscalations,
      time_urgency: timeUrgency,
      consequence_severity: riskLevel === "CRITICAL" ? "Catastrophic failure, environmental/safety release" : riskLevel === "HIGH" ? "Major failure, potential safety hazard" : riskLevel === "MEDIUM" ? "Partial degradation, operational impact" : "Minimal impact, routine degradation",
      recommended_response_timeline: timeUrgency
    };
  } catch (err) {
    return {
      status: "ERROR",
      error: String(err),
      stage: "get_risk_assessment"
    };
  }
}

async function handleGetRepairPlan(inp) {
  var asset_context = inp.asset_context || {};
  var observed_context = inp.observed_context || {};

  if (!asset_context.domain) {
    return { status: "HOLD", missing_fields: ["asset_context.domain"] };
  }

  try {
    var cfiResult = await handleAnalyzeContext(inp);
    if (cfiResult.status !== "OK") {
      return cfiResult;
    }

    var recommendedActions = cfiResult.consolidated.recommended_actions || [];
    var preventionActions = cfiResult.consolidated.prevention_actions || [];

    var immediateActions = [];
    var shortTermRepairs = [];
    var longTermPrevention = [];

    for (var i = 0; i < recommendedActions.length; i++) {
      var action = recommendedActions[i];
      if (action.indexOf("isolate") !== -1 || action.indexOf("secure") !== -1 || action.indexOf("temporary") !== -1) {
        immediateActions.push(action);
      } else if (action.indexOf("repair") !== -1 || action.indexOf("weld") !== -1 || action.indexOf("replace") !== -1) {
        shortTermRepairs.push(action);
      }
    }

    for (var j = 0; j < preventionActions.length; j++) {
      longTermPrevention.push(preventionActions[j]);
    }

    if (cfiResult.hotspot_severity === "CRITICAL") {
      if (immediateActions.length === 0) {
        immediateActions.push("Issue immediate shutdown notice or de-pressurization order");
      }
    }

    return {
      status: "OK",
      engine: "CFI-ENGINE",
      version: ENGINE_VERSION,
      action: "get_repair_plan",
      hotspot_score: cfiResult.hotspot_score,
      hotspot_severity: cfiResult.hotspot_severity,
      repair_plan: {
        immediate_actions: immediateActions,
        short_term_repairs: shortTermRepairs,
        long_term_prevention: longTermPrevention,
        design_modifications: ["Increase wall thickness in high-stress zones", "Improve drainage to reduce corrosion conditions", "Add cathodic protection system"],
        monitoring_requirements: ["Quarterly visual inspection of high-risk zones", "Annual ultrasonic thickness survey", "Vibration monitoring if mechanical loading present"]
      }
    };
  } catch (err) {
    return {
      status: "ERROR",
      error: String(err),
      stage: "get_repair_plan"
    };
  }
}

async function handleRecordFinding(inp) {
  var required = ["case_id", "observed_context"];
  var m = getMissing(inp, required);
  if (m.length) {
    return { status: "HOLD", missing_fields: m };
  }

  try {
    var caseId = inp.case_id;
    var assetId = inp.asset_id || null;
    var patternId = inp.pattern_id || null;
    var matchedFailureModes = inp.matched_failure_modes || [];
    var matchedMechanisms = inp.matched_damage_mechanisms || [];
    var recommendedNdtMethods = inp.recommended_ndt_methods || [];
    var missingEvidence = inp.missing_evidence || [];
    var riskScore = num(inp.risk_score, 50);
    var severity = inp.severity || "MEDIUM";
    var reasoning = inp.system_reasoning || "";

    var insertPayload = {
      case_id: caseId,
      asset_id: assetId,
      pattern_id: patternId,
      observed_context: inp.observed_context,
      matched_failure_modes: matchedFailureModes,
      matched_damage_mechanisms: matchedMechanisms,
      recommended_ndt_methods: recommendedNdtMethods,
      missing_evidence: missingEvidence,
      risk_score: riskScore,
      severity: severity,
      system_reasoning: reasoning,
      created_at: new Date().toISOString()
    };

    var resp = await supabase
      .from("cfi_case_findings")
      .insert([insertPayload]);

    if (resp.error) {
      return {
        status: "ERROR",
        error: resp.error.message,
        stage: "record_finding_insert"
      };
    }

    return {
      status: "OK",
      engine: "CFI-ENGINE",
      version: ENGINE_VERSION,
      action: "record_finding",
      finding_id: resp.data && resp.data[0] ? resp.data[0].id : null,
      case_id: caseId,
      acknowledged: true
    };
  } catch (err) {
    return {
      status: "ERROR",
      error: String(err),
      stage: "record_finding"
    };
  }
}

async function handleSubmitFeedback(inp) {
  var required = ["case_id", "finding_id", "inspector_action"];
  var m = getMissing(inp, required);
  if (m.length) {
    return { status: "HOLD", missing_fields: m };
  }

  try {
    var caseId = inp.case_id;
    var findingId = inp.finding_id;
    var action = inp.inspector_action;
    var confirmedFailureModes = inp.confirmed_failure_modes || [];
    var rejectedFailureModes = inp.rejected_failure_modes || [];
    var confirmedMechanisms = inp.confirmed_mechanisms || [];
    var missedContextTags = inp.missed_context_tags || [];
    var notes = inp.inspector_notes || "";

    var feedbackPayload = {
      case_id: caseId,
      finding_id: findingId,
      inspector_action: action,
      confirmed_failure_modes: confirmedFailureModes,
      rejected_failure_modes: rejectedFailureModes,
      confirmed_mechanisms: confirmedMechanisms,
      missed_context_tags: missedContextTags,
      inspector_notes: notes,
      created_at: new Date().toISOString()
    };

    var fbResp = await supabase
      .from("cfi_feedback_events")
      .insert([feedbackPayload]);

    if (fbResp.error) {
      return {
        status: "ERROR",
        error: fbResp.error.message,
        stage: "feedback_insert"
      };
    }

    var confidenceAdjustment = 0;
    if (action === "confirmed") {
      confidenceAdjustment = 0.02;
    } else if (action === "rejected") {
      confidenceAdjustment = -0.03;
    }

    if (inp.pattern_id && confidenceAdjustment !== 0) {
      var patternResp = await supabase
        .from("cfi_context_patterns")
        .select("confidence_weight")
        .eq("id", inp.pattern_id);

      if (patternResp.data && patternResp.data[0]) {
        var oldWeight = num(patternResp.data[0].confidence_weight, 0.7);
        var newWeight = clamp01(oldWeight + confidenceAdjustment);
        newWeight = newWeight > 0.98 ? 0.98 : newWeight < 0.30 ? 0.30 : newWeight;

        await supabase
          .from("cfi_context_patterns")
          .update({ confidence_weight: newWeight })
          .eq("id", inp.pattern_id);
      }
    }

    return {
      status: "OK",
      engine: "CFI-ENGINE",
      version: ENGINE_VERSION,
      action: "submit_feedback",
      feedback_id: fbResp.data && fbResp.data[0] ? fbResp.data[0].id : null,
      case_id: caseId,
      finding_id: findingId,
      inspector_action: action,
      confidence_adjustment: confidenceAdjustment,
      acknowledged: true
    };
  } catch (err) {
    return {
      status: "ERROR",
      error: String(err),
      stage: "submit_feedback"
    };
  }
}

async function handleGetPatternLibrary(inp) {
  try {
    var filters = inp.filters || {};
    var limit = num(inp.limit, 50);
    var offset = num(inp.offset, 0);

    var query = supabase.from("cfi_context_patterns").select("*");

    if (filters.domain) {
      query = query.eq("domain", filters.domain);
    }
    if (filters.asset_type) {
      query = query.ilike("asset_type", "%" + filters.asset_type + "%");
    }
    if (filters.severity) {
      query = query.eq("severity", filters.severity);
    }

    query = query.range(offset, offset + limit - 1);

    var resp = await query;

    if (resp.error) {
      return {
        status: "ERROR",
        error: resp.error.message,
        stage: "pattern_library_query"
      };
    }

    return {
      status: "OK",
      engine: "CFI-ENGINE",
      version: ENGINE_VERSION,
      action: "get_pattern_library",
      filters: filters,
      limit: limit,
      offset: offset,
      patterns: resp.data || [],
      count: resp.data ? resp.data.length : 0
    };
  } catch (err) {
    return {
      status: "ERROR",
      error: String(err),
      stage: "get_pattern_library"
    };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ────────────────────────────────────────────────────────────────────────────

var handler: Handler = async function(event) {
  var headers = corsHeaders;

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: headers,
      body: JSON.stringify({ status: "ERROR", error: "POST method required" })
    };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action;

    var result = null;

    if (!action) {
      result = await handleGetRegistry();
    } else if (action === "get_registry") {
      result = await handleGetRegistry();
    } else if (action === "analyze_context") {
      result = await handleAnalyzeContext(body);
    } else if (action === "analyze_with_dde") {
      result = await handleAnalyzeWithDde(body);
    } else if (action === "get_inspection_plan") {
      result = await handleGetInspectionPlan(body);
    } else if (action === "get_risk_assessment") {
      result = await handleGetRiskAssessment(body);
    } else if (action === "get_repair_plan") {
      result = await handleGetRepairPlan(body);
    } else if (action === "record_finding") {
      result = await handleRecordFinding(body);
    } else if (action === "submit_feedback") {
      result = await handleSubmitFeedback(body);
    } else if (action === "get_pattern_library") {
      result = await handleGetPatternLibrary(body);
    } else {
      result = {
        status: "ERROR",
        error: "Unknown action: " + action,
        available_actions: [
          "get_registry",
          "analyze_context",
          "analyze_with_dde",
          "get_inspection_plan",
          "get_risk_assessment",
          "get_repair_plan",
          "record_finding",
          "submit_feedback",
          "get_pattern_library"
        ]
      };
    }

    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify(result)
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({
        status: "ERROR",
        error: String(err),
        stage: "request_handling"
      })
    };
  }
};

export { handler };
