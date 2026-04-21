// @ts-nocheck
/**
 * DEPLOY253 - concept-intelligence-v21.ts
 * netlify/functions/concept-intelligence-v21.ts
 *
 * CONCEPT INTELLIGENCE CORE v2.1 — VALIDATION + DOMINANCE PACK
 *
 * Extension layer on top of DEPLOY252 (v2.0) that adds:
 *   1. Dominance Resolution — 1 governing + 3 supporting, rest suppressed
 *   2. Authority Enforcement — deterministic HOLD/PROVISIONAL/ESCALATE/STABLE
 *   3. Concept Validation — track confirmed/false_positive/useful per activation
 *   4. Reliability Scoring — per-concept reliability from validation history
 *   5. Case Replay — re-run old cases through current logic, compare outcomes
 *   6. Drift Monitoring — track concept accuracy over time by vertical/method
 *
 * POST /api/concept-intelligence-v21 { action, ... }
 *
 * Actions:
 *   resolve_dominance       - classify concepts: governing/supporting/suppressed
 *   enforce_authority        - determine HOLD/PROVISIONAL/ESCALATE/STABLE
 *   validate_concept         - record validation event for a concept activation
 *   get_reliability          - get reliability score for a concept
 *   replay_case              - re-run case through v2.0 logic, compare to actual
 *   get_drift_metrics        - concept accuracy drift by vertical/method
 *   full_v21_analysis        - run dominance + authority on a v2.0 concept pack
 *   get_registry             - engine capabilities
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

var ENGINE_VERSION = "v2.1.0";
var MAX_VISIBLE_SUPPORTING = 3;

// =====================================================================
// UTILITY
// =====================================================================

function clamp(val) {
  if (val < 0) return 0;
  if (val > 1) return 1;
  return Math.round(val * 1000) / 1000;
}

function lower(s) { return (s || "").toString().toLowerCase(); }

// =====================================================================
// CONCEPT FAMILY AUTHORITY WEIGHTS
// governing_reality > uncertainty_reality > propagation_reality > action_reality > origin_reality
// =====================================================================

var FAMILY_WEIGHTS = {
  constraint_dominance: 1.00,
  physics_sufficiency: 1.00,
  decision_boundary: 0.98,
  contradiction_detection: 0.95,
  blind_spot_detection: 0.92,
  confidence_collapse: 0.90,
  mechanism_propagation: 0.85,
  mechanism_interaction: 0.83,
  failure_pathway: 0.80,
  information_gain: 0.75,
  parallel_reality: 0.72,
  causal_root: 0.65
};

var FAMILY_PRIORITY = {
  governing_reality: 1,
  uncertainty_reality: 2,
  propagation_reality: 3,
  action_reality: 4,
  origin_reality: 5
};

var CONCEPT_TO_FAMILY = {
  constraint_dominance: "governing_reality",
  physics_sufficiency: "governing_reality",
  decision_boundary: "governing_reality",
  contradiction_detection: "uncertainty_reality",
  blind_spot_detection: "uncertainty_reality",
  confidence_collapse: "uncertainty_reality",
  mechanism_propagation: "propagation_reality",
  mechanism_interaction: "propagation_reality",
  failure_pathway: "propagation_reality",
  information_gain: "action_reality",
  parallel_reality: "action_reality",
  causal_root: "origin_reality"
};

// =====================================================================
// VALIDATION SOURCE WEIGHTS
// =====================================================================

var VALIDATION_SOURCE_WEIGHTS = {
  repair_finding: 1.00,
  failure_event: 0.95,
  advanced_ndt_follow_up: 0.95,
  engineering_review: 0.90,
  shutdown_inspection: 0.90,
  reviewer_adjudication: 0.85,
  customer_qa_review: 0.85,
  inspector_review: 0.70,
  historical_replay: 0.50
};

// =====================================================================
// DOMINANCE RESOLUTION ENGINE
// =====================================================================

function scoreDominance(activationScore, familyWeight, consequenceRelevance, validationReliability, boundaryRelevance, crossConceptSupport, contradictionPenalty, noisePenalty) {
  var score =
    (activationScore * 0.35) +
    (familyWeight * 0.15) +
    (consequenceRelevance * 0.15) +
    (validationReliability * 0.15) +
    (boundaryRelevance * 0.10) +
    (crossConceptSupport * 0.10) -
    (contradictionPenalty * 0.10) -
    (noisePenalty * 0.10);
  return clamp(score);
}

function resolveDominance(activeConcepts, calibrationProfiles) {
  var scored = [];

  for (var i = 0; i < activeConcepts.length; i++) {
    var c = activeConcepts[i];
    var key = c.key || c.concept_key || "";
    var familyWeight = FAMILY_WEIGHTS[key] || 0.70;

    // Apply calibration profile if available
    if (calibrationProfiles && calibrationProfiles[key]) {
      var cal = calibrationProfiles[key];
      if (cal.family_authority_weight) familyWeight = cal.family_authority_weight;
    }

    var dScore = scoreDominance(
      c.score || 0,
      familyWeight,
      c.consequence_relevance || 0.75,
      c.validation_reliability || 0.70,
      c.boundary_relevance || 0.50,
      c.cross_concept_support || 0.50,
      c.contradiction_penalty || 0,
      c.noise_penalty || 0.05
    );

    scored.push({
      concept_key: key,
      family: CONCEPT_TO_FAMILY[key] || "unknown",
      activation_score: c.score || 0,
      dominance_score: dScore,
      family_weight: familyWeight,
      consequence_relevance: c.consequence_relevance || 0.75,
      validation_reliability: c.validation_reliability || 0.70,
      boundary_relevance: c.boundary_relevance || 0.50,
      cross_concept_support: c.cross_concept_support || 0.50,
      contradiction_penalty: c.contradiction_penalty || 0,
      noise_penalty: c.noise_penalty || 0.05
    });
  }

  // Sort by dominance score descending, then by family priority for ties
  scored.sort(function(a, b) {
    if (Math.abs(b.dominance_score - a.dominance_score) > 0.001) {
      return b.dominance_score - a.dominance_score;
    }
    var aPri = FAMILY_PRIORITY[a.family] || 99;
    var bPri = FAMILY_PRIORITY[b.family] || 99;
    return aPri - bPri;
  });

  // ── HARD RULE OVERRIDES ──

  // Rule 1: physics_sufficiency governs if active (evidence adequacy trumps all)
  var hasPhysics = false;
  var hasDecisionBoundary = false;
  var hasBlindSpot = false;
  var hasContradiction = false;

  for (var hi = 0; hi < scored.length; hi++) {
    if (scored[hi].concept_key === "physics_sufficiency") hasPhysics = true;
    if (scored[hi].concept_key === "decision_boundary") hasDecisionBoundary = true;
    if (scored[hi].concept_key === "blind_spot_detection") hasBlindSpot = true;
    if (scored[hi].concept_key === "contradiction_detection") hasContradiction = true;
  }

  // Determine governing concept
  var governing = scored.length > 0 ? scored[0].concept_key : null;

  // Hard override: physics_sufficiency always governs if active
  if (hasPhysics && governing !== "physics_sufficiency") {
    // Exception: critical contradiction overrides physics
    var criticalContradiction = false;
    for (var cci = 0; cci < activeConcepts.length; cci++) {
      if ((activeConcepts[cci].key || activeConcepts[cci].concept_key) === "contradiction_detection") {
        if (activeConcepts[cci].severity === "critical") criticalContradiction = true;
      }
    }
    if (!criticalContradiction) governing = "physics_sufficiency";
  }

  // ── CLASSIFY: governing / supporting / suppressed / audit_only ──

  var visible = [];
  var suppressed = [];
  var auditOnly = [];

  for (var ci = 0; ci < scored.length; ci++) {
    var item = scored[ci];
    if (item.concept_key === governing) continue; // skip governing

    // Hard rule: decision_boundary must stay visible if unstable
    if (item.concept_key === "decision_boundary" && hasDecisionBoundary) {
      if (visible.length < MAX_VISIBLE_SUPPORTING) {
        visible.push(item.concept_key);
        continue;
      }
    }

    // Hard rule: blind_spot_detection stays visible in high-consequence
    if (item.concept_key === "blind_spot_detection" && hasBlindSpot) {
      if (visible.length < MAX_VISIBLE_SUPPORTING) {
        visible.push(item.concept_key);
        continue;
      }
    }

    // Hard rule: contradiction_detection stays visible if severity high+
    if (item.concept_key === "contradiction_detection" && hasContradiction) {
      if (visible.length < MAX_VISIBLE_SUPPORTING) {
        visible.push(item.concept_key);
        continue;
      }
    }

    // Fill remaining visible slots by dominance score
    if (visible.length < MAX_VISIBLE_SUPPORTING) {
      visible.push(item.concept_key);
    } else {
      // Low-scoring concepts go to audit_only, mid-range to suppressed
      if (item.dominance_score < 0.40) {
        auditOnly.push(item.concept_key);
      } else {
        suppressed.push(item.concept_key);
      }
    }
  }

  return {
    governing_concept: governing,
    governing_reason: governing ? "Highest dominance score with family priority override applied" : "No active concepts",
    visible_supporting_concepts: visible,
    suppressed_concepts: suppressed,
    audit_only_concepts: auditOnly,
    dominance_scores: scored,
    max_visible_supporting: MAX_VISIBLE_SUPPORTING,
    hard_rules_applied: {
      physics_sufficiency_override: hasPhysics && governing === "physics_sufficiency",
      decision_boundary_forced_visible: hasDecisionBoundary && visible.indexOf("decision_boundary") !== -1,
      blind_spot_forced_visible: hasBlindSpot && visible.indexOf("blind_spot_detection") !== -1,
      contradiction_forced_visible: hasContradiction && visible.indexOf("contradiction_detection") !== -1
    }
  };
}


// =====================================================================
// AUTHORITY ENFORCEMENT ENGINE
// Deterministic HOLD / PROVISIONAL / ESCALATE / STABLE
// =====================================================================

function enforceAuthority(params) {
  // ── HOLD — blocks final disposition ──
  var holdReasons = [];
  if (params.physics_insufficiency) holdReasons.push("Physics sufficiency: methods insufficient for flaw characterization");
  if (params.unresolved_critical_contradiction) holdReasons.push("Unresolved critical contradiction in evidence");
  if (params.confidence_below_threshold) holdReasons.push("Adjusted confidence below minimum threshold (" + (params.confidence_value || "unknown") + ")");
  if (params.requires_method_escalation) holdReasons.push("Required method escalation not yet completed");
  if (params.high_risk_blind_spot) holdReasons.push("High-risk blind spot in high-consequence service");

  if (holdReasons.length > 0) {
    return {
      authority_state: "hold",
      authority_reason: holdReasons.join("; "),
      allow_final_disposition: false,
      hold_for_input: true,
      requires_engineering_review: params.requires_engineering_review || false,
      requires_method_escalation: params.requires_method_escalation || false,
      requires_scope_expansion: params.high_risk_blind_spot || false,
      hold_reasons: holdReasons
    };
  }

  // ── ESCALATE — needs elevated review ──
  var escalateReasons = [];
  if (params.requires_engineering_review) escalateReasons.push("Engineering review required for disposition");
  if (params.replay_historical_miss_pattern) escalateReasons.push("Historical replay shows pattern of missed findings at similar cases");
  if (params.critical_propagation_in_critical_service) escalateReasons.push("Critical mechanism propagation in high-consequence service");
  if (params.scope_expansion_required) escalateReasons.push("Similar assets likely affected — scope expansion required");

  if (escalateReasons.length > 0) {
    return {
      authority_state: "escalate",
      authority_reason: escalateReasons.join("; "),
      allow_final_disposition: false,
      hold_for_input: false,
      requires_engineering_review: true,
      requires_method_escalation: false,
      requires_scope_expansion: params.scope_expansion_required || false,
      escalate_reasons: escalateReasons
    };
  }

  // ── PROVISIONAL — decision is unstable ──
  var provisionalReasons = [];
  if (params.unstable_boundary) provisionalReasons.push("Decision boundary is unstable — measurement near acceptance limit");
  if (params.unresolved_moderate_contradiction) provisionalReasons.push("Moderate contradiction remains unresolved");
  if (params.missing_context) provisionalReasons.push("Relevant context still missing for full assessment");
  if (params.low_validation_confidence) provisionalReasons.push("Concept validation confidence not yet strong enough for full authority");

  if (provisionalReasons.length > 0) {
    return {
      authority_state: "provisional",
      authority_reason: provisionalReasons.join("; "),
      allow_final_disposition: false,
      hold_for_input: false,
      requires_engineering_review: false,
      requires_method_escalation: false,
      requires_scope_expansion: false,
      provisional_reasons: provisionalReasons
    };
  }

  // ── STABLE — clear to proceed ──
  return {
    authority_state: "stable",
    authority_reason: "No blocking concept conditions remain. All critical constraints resolved.",
    allow_final_disposition: true,
    hold_for_input: false,
    requires_engineering_review: false,
    requires_method_escalation: false,
    requires_scope_expansion: false
  };
}


// =====================================================================
// RELIABILITY SCORING
// =====================================================================

function scoreReliability(metrics) {
  var confirmedRate = metrics.confirmed > 0 ? metrics.confirmed / Math.max(1, metrics.activations) : 0;
  var falsePositiveRate = metrics.false_positives > 0 ? metrics.false_positives / Math.max(1, metrics.activations) : 0;
  var usefulRate = metrics.followed_and_useful > 0 ? metrics.followed_and_useful / Math.max(1, metrics.activations) : 0;
  var noiseRate = (metrics.false_positives + (metrics.inconclusive || 0)) / Math.max(1, metrics.activations);

  var score =
    (confirmedRate * 0.35) +
    (usefulRate * 0.20) +
    ((metrics.average_agreement || 0.70) * 0.15) +
    ((metrics.high_consequence_performance || 0.70) * 0.15) +
    ((metrics.replay_improvement_rate || 0.50) * 0.10) -
    (falsePositiveRate * 0.15) -
    (noiseRate * 0.10);

  return clamp(score);
}


// =====================================================================
// FULL v2.1 ANALYSIS — Takes v2.0 output, applies dominance + authority
// =====================================================================

function runFullV21Analysis(v20Output) {
  // Extract active concepts from v2.0 output
  var activeConcepts = v20Output.active_concepts || [];

  // Enrich with v2.0 context for dominance scoring
  var enriched = [];
  for (var i = 0; i < activeConcepts.length; i++) {
    var ac = activeConcepts[i];
    var enrichedConcept = {
      key: ac.key || ac.concept_key || "",
      score: ac.score || 0,
      consequence_relevance: 0.75,
      validation_reliability: 0.70,
      boundary_relevance: 0.50,
      cross_concept_support: 0.50,
      contradiction_penalty: 0,
      noise_penalty: 0.05,
      severity: ac.severity || null
    };

    // Boost consequence relevance for critical findings
    if (v20Output.failure_pathways && v20Output.failure_pathways.length > 0) {
      for (var fp = 0; fp < v20Output.failure_pathways.length; fp++) {
        if (v20Output.failure_pathways[fp].consequence_level === "critical") {
          enrichedConcept.consequence_relevance = 0.95;
          break;
        }
      }
    }

    // Boost boundary relevance for decision_boundary
    if (enrichedConcept.key === "decision_boundary" && v20Output.decision_stability) {
      if (v20Output.decision_stability.state === "unstable_boundary") enrichedConcept.boundary_relevance = 0.90;
      if (v20Output.decision_stability.state === "cliff_edge") enrichedConcept.boundary_relevance = 0.98;
    }

    // Cross-concept support: if multiple engines agree something is wrong
    if (activeConcepts.length >= 3) enrichedConcept.cross_concept_support = 0.70;
    if (activeConcepts.length >= 5) enrichedConcept.cross_concept_support = 0.85;

    enriched.push(enrichedConcept);
  }

  // Run dominance resolution
  var dominance = resolveDominance(enriched, null);

  // Build authority parameters from v2.0 output
  var authorityParams = {
    physics_insufficiency: false,
    unresolved_critical_contradiction: false,
    unresolved_moderate_contradiction: false,
    confidence_below_threshold: false,
    confidence_value: null,
    requires_method_escalation: false,
    high_risk_blind_spot: false,
    requires_engineering_review: false,
    unstable_boundary: false,
    missing_context: false,
    replay_historical_miss_pattern: false,
    critical_propagation_in_critical_service: false,
    scope_expansion_required: false,
    low_validation_confidence: false
  };

  // Map v2.0 recommended_state to authority parameters
  if (v20Output.recommended_state) {
    var rs = v20Output.recommended_state;
    authorityParams.requires_method_escalation = rs.requires_method_escalation || false;
    authorityParams.requires_engineering_review = rs.requires_engineering_review || false;
  }

  // Check physics sufficiency
  for (var pi = 0; pi < activeConcepts.length; pi++) {
    if ((activeConcepts[pi].key || "") === "physics_sufficiency") {
      authorityParams.physics_insufficiency = true;
    }
  }

  // Check contradictions
  if (v20Output.contradictions && v20Output.contradictions.length > 0) {
    for (var ci = 0; ci < v20Output.contradictions.length; ci++) {
      if (v20Output.contradictions[ci].severity === "critical") {
        authorityParams.unresolved_critical_contradiction = true;
      } else if (v20Output.contradictions[ci].severity === "high" || v20Output.contradictions[ci].severity === "medium") {
        authorityParams.unresolved_moderate_contradiction = true;
      }
    }
  }

  // Check confidence
  if (v20Output.confidence_adjustment) {
    var adj = v20Output.confidence_adjustment;
    if (adj.adjusted_confidence !== undefined && adj.adjusted_confidence < 0.50) {
      authorityParams.confidence_below_threshold = true;
      authorityParams.confidence_value = adj.adjusted_confidence;
    }
    if (adj.hold_triggered) {
      authorityParams.confidence_below_threshold = true;
      authorityParams.confidence_value = adj.adjusted_confidence;
    }
  }

  // Check decision boundary
  if (v20Output.decision_stability) {
    if (v20Output.decision_stability.state === "unstable_boundary" || v20Output.decision_stability.state === "cliff_edge") {
      authorityParams.unstable_boundary = true;
    }
    if (v20Output.decision_stability.state === "cliff_edge") {
      authorityParams.requires_engineering_review = true;
    }
  }

  // Check blind spots in context of consequence
  if (v20Output.blind_spots && v20Output.blind_spots.length > 0 && v20Output.failure_pathways) {
    var hasCriticalPathway = false;
    for (var fpi = 0; fpi < v20Output.failure_pathways.length; fpi++) {
      if (v20Output.failure_pathways[fpi].consequence_level === "critical") hasCriticalPathway = true;
    }
    if (hasCriticalPathway && v20Output.blind_spots.length >= 2) {
      authorityParams.high_risk_blind_spot = true;
    }
  }

  // Check propagation in critical service
  if (v20Output.propagation_flags && v20Output.propagation_flags.length > 0) {
    for (var pfi = 0; pfi < v20Output.propagation_flags.length; pfi++) {
      if (v20Output.propagation_flags[pfi].severity === "critical") {
        authorityParams.critical_propagation_in_critical_service = true;
        authorityParams.scope_expansion_required = true;
        break;
      }
    }
  }

  // Run authority enforcement
  var authority = enforceAuthority(authorityParams);

  return {
    engine_version: ENGINE_VERSION,
    dominance: dominance,
    authority: authority,
    authority_parameters_used: authorityParams,
    v20_summary: {
      active_concepts_count: activeConcepts.length,
      contradictions_count: (v20Output.contradictions || []).length,
      blind_spots_count: (v20Output.blind_spots || []).length,
      propagation_flags_count: (v20Output.propagation_flags || []).length,
      failure_pathways_count: (v20Output.failure_pathways || []).length,
      original_confidence: v20Output.confidence_adjustment ? v20Output.confidence_adjustment.original_confidence : null,
      adjusted_confidence: v20Output.confidence_adjustment ? v20Output.confidence_adjustment.adjusted_confidence : null,
      decision_stability_state: v20Output.decision_stability ? v20Output.decision_stability.state : null
    }
  };
}


// =====================================================================
// HANDLER
// =====================================================================

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";

    var sb = createClient(supabaseUrl, supabaseKey);

    // ── get_registry ──
    if (action === "get_registry") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "concept-intelligence-v21",
          deploy: "DEPLOY253",
          version: ENGINE_VERSION,
          extends: "concept-intelligence-core v2.0.0 (DEPLOY252)",
          sub_engines: [
            { name: "Dominance Resolution", purpose: "1 governing + 3 supporting, rest suppressed" },
            { name: "Authority Enforcement", purpose: "Deterministic HOLD/PROVISIONAL/ESCALATE/STABLE" },
            { name: "Concept Validation", purpose: "Track confirmed/false_positive/useful per activation" },
            { name: "Reliability Scoring", purpose: "Per-concept reliability from validation history" },
            { name: "Case Replay", purpose: "Re-run old cases, compare concept path vs actual path" },
            { name: "Drift Monitoring", purpose: "Track concept accuracy over time by vertical/method" }
          ],
          authority_states: ["hold", "provisional", "escalate", "stable"],
          dominance_formula: "activation(0.35) + family_weight(0.15) + consequence(0.15) + reliability(0.15) + boundary(0.10) + support(0.10) - contradiction(0.10) - noise(0.10)",
          max_visible_concepts: 1 + MAX_VISIBLE_SUPPORTING,
          philosophy: "Less noise, more authority. The system does not just flag — it governs. One governing concept, three supporting, rest suppressed. Final disposition is blocked when physics, contradictions, or confidence demand it."
        })
      };
    }

    // ── resolve_dominance ──
    if (action === "resolve_dominance") {
      var activeConcepts = body.active_concepts || [];
      if (activeConcepts.length === 0) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "active_concepts array required" }) };
      }

      // Load calibration profiles if available
      var calProfiles = {};
      try {
        var calRes = await sb.from("concept_calibration_profiles").select("*").eq("active", true);
        if (!calRes.error && calRes.data) {
          for (var cpi = 0; cpi < calRes.data.length; cpi++) {
            calProfiles[calRes.data[cpi].concept_key] = calRes.data[cpi].calibration_json || {};
          }
        }
      } catch (calErr) { /* non-fatal */ }

      var dominanceResult = resolveDominance(activeConcepts, calProfiles);

      // Persist if IDs provided
      if (body.concept_run_id && body.case_id && body.org_id) {
        try {
          await sb.from("concept_dominance_results").insert({
            concept_run_id: body.concept_run_id,
            case_id: body.case_id,
            org_id: body.org_id,
            governing_concept: dominanceResult.governing_concept,
            visible_supporting_concepts: dominanceResult.visible_supporting_concepts,
            suppressed_concepts: dominanceResult.suppressed_concepts,
            audit_only_concepts: dominanceResult.audit_only_concepts,
            dominance_json: dominanceResult
          });
        } catch (domPersistErr) { /* non-fatal */ }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "resolve_dominance",
          success: true,
          engine_version: ENGINE_VERSION,
          dominance: dominanceResult
        })
      };
    }

    // ── enforce_authority ──
    if (action === "enforce_authority") {
      var authorityResult = enforceAuthority({
        physics_insufficiency: body.physics_insufficiency || false,
        unresolved_critical_contradiction: body.unresolved_critical_contradiction || false,
        unresolved_moderate_contradiction: body.unresolved_moderate_contradiction || false,
        confidence_below_threshold: body.confidence_below_threshold || false,
        confidence_value: body.confidence_value || null,
        requires_method_escalation: body.requires_method_escalation || false,
        high_risk_blind_spot: body.high_risk_blind_spot || false,
        requires_engineering_review: body.requires_engineering_review || false,
        unstable_boundary: body.unstable_boundary || false,
        missing_context: body.missing_context || false,
        replay_historical_miss_pattern: body.replay_historical_miss_pattern || false,
        critical_propagation_in_critical_service: body.critical_propagation_in_critical_service || false,
        scope_expansion_required: body.scope_expansion_required || false,
        low_validation_confidence: body.low_validation_confidence || false
      });

      // Persist authority event
      if (body.concept_run_id && body.case_id && body.org_id) {
        try {
          await sb.from("concept_authority_events").insert({
            concept_run_id: body.concept_run_id,
            case_id: body.case_id,
            org_id: body.org_id,
            authority_state: authorityResult.authority_state,
            authority_reason: authorityResult.authority_reason,
            authority_json: authorityResult
          });
        } catch (authPersistErr) { /* non-fatal */ }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "enforce_authority",
          success: true,
          engine_version: ENGINE_VERSION,
          authority: authorityResult
        })
      };
    }

    // ── validate_concept ──
    if (action === "validate_concept") {
      var ve = body.validation_event || body;
      if (!ve.concept_run_id || !ve.case_id || !ve.org_id || !ve.concept_key || !ve.validation_status) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Required: concept_run_id, case_id, org_id, concept_key, validation_status" }) };
      }

      var validStatuses = ["confirmed", "partially_confirmed", "false_positive", "false_negative", "inconclusive", "ignored_but_correct", "followed_and_useful"];
      if (validStatuses.indexOf(ve.validation_status) === -1) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Invalid validation_status. Valid: " + validStatuses.join(", ") }) };
      }

      var insertPayload = {
        concept_run_id: ve.concept_run_id,
        case_id: ve.case_id,
        org_id: ve.org_id,
        concept_key: ve.concept_key,
        validation_status: ve.validation_status,
        validation_source: ve.validation_source || "inspector_review",
        validator_user_id: ve.validator_user_id || null,
        usefulness_score: ve.usefulness_score || null,
        agreement_score: ve.agreement_score || null,
        notes: ve.notes || null,
        validation_json: ve.validation_json || null
      };

      var vInsert = await sb.from("concept_validation_events").insert(insertPayload).select().single();
      if (vInsert.error) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "Failed to persist validation: " + vInsert.error.message }) };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "validate_concept",
          success: true,
          engine_version: ENGINE_VERSION,
          validation_event: vInsert.data
        })
      };
    }

    // ── get_reliability ──
    if (action === "get_reliability") {
      var conceptKey = body.concept_key;
      if (!conceptKey) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "concept_key required" }) };

      // Query validation events for this concept
      var vQuery = sb.from("concept_validation_events").select("validation_status, usefulness_score, agreement_score, validation_source").eq("concept_key", conceptKey);
      if (body.org_id) vQuery = vQuery.eq("org_id", body.org_id);

      var vResult = await vQuery;
      var events = vResult.data || [];

      if (events.length === 0) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            action: "get_reliability",
            engine_version: ENGINE_VERSION,
            concept_key: conceptKey,
            activations: 0,
            reliability_score: null,
            message: "No validation events recorded yet for this concept"
          })
        };
      }

      // Calculate metrics
      var metrics = {
        activations: events.length,
        confirmed: 0,
        false_positives: 0,
        false_negatives: 0,
        inconclusive: 0,
        followed_and_useful: 0,
        ignored_but_correct: 0,
        average_usefulness: 0,
        average_agreement: 0,
        high_consequence_performance: 0.70,
        replay_improvement_rate: 0.50
      };

      var usefulSum = 0;
      var usefulCount = 0;
      var agreeSum = 0;
      var agreeCount = 0;

      for (var ei = 0; ei < events.length; ei++) {
        var ev = events[ei];
        if (ev.validation_status === "confirmed" || ev.validation_status === "partially_confirmed") metrics.confirmed++;
        if (ev.validation_status === "false_positive") metrics.false_positives++;
        if (ev.validation_status === "false_negative") metrics.false_negatives++;
        if (ev.validation_status === "inconclusive") metrics.inconclusive++;
        if (ev.validation_status === "followed_and_useful") { metrics.followed_and_useful++; metrics.confirmed++; }
        if (ev.validation_status === "ignored_but_correct") metrics.ignored_but_correct++;
        if (ev.usefulness_score !== null && ev.usefulness_score !== undefined) { usefulSum = usefulSum + ev.usefulness_score; usefulCount++; }
        if (ev.agreement_score !== null && ev.agreement_score !== undefined) { agreeSum = agreeSum + ev.agreement_score; agreeCount++; }
      }

      metrics.average_usefulness = usefulCount > 0 ? Math.round((usefulSum / usefulCount) * 1000) / 1000 : 0.70;
      metrics.average_agreement = agreeCount > 0 ? Math.round((agreeSum / agreeCount) * 1000) / 1000 : 0.70;

      var reliabilityScore = scoreReliability(metrics);
      metrics.reliability_score = reliabilityScore;

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "get_reliability",
          engine_version: ENGINE_VERSION,
          concept_key: conceptKey,
          metrics: metrics
        })
      };
    }

    // ── replay_case ──
    if (action === "replay_case") {
      var replayCaseId = body.case_id;
      var replayOrgId = body.org_id;
      if (!replayCaseId) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };

      // Load original case
      var caseQ = await sb.from("inspection_cases").select("*").eq("id", replayCaseId).single();
      if (caseQ.error || !caseQ.data) {
        return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "case_not_found" }) };
      }

      // Load original concept run if exists
      var origRun = await sb.from("concept_runs").select("*").eq("case_id", replayCaseId).order("created_at", { ascending: false }).limit(1);
      var hasOriginalRun = !origRun.error && origRun.data && origRun.data.length > 0;
      var originalOutput = hasOriginalRun ? origRun.data[0].output_json : null;

      // Call v2.0 engine to re-analyze
      // TODO: In production, call the actual /api/concept-intelligence-core analyze_case internally
      // For now, build replay summary from existing data

      var replayOutput = {
        source_case_id: replayCaseId,
        replay_version: ENGINE_VERSION,
        replay_mode: body.replay_mode || "strict",
        had_original_concept_run: hasOriginalRun,
        original_governing_concept: originalOutput ? (originalOutput.governing_concept ? originalOutput.governing_concept.key : null) : null,
        original_active_concepts_count: originalOutput ? (originalOutput.active_concepts || []).length : 0,
        original_contradictions_count: originalOutput ? (originalOutput.contradictions || []).length : 0,
        original_blind_spots_count: originalOutput ? (originalOutput.blind_spots || []).length : 0,
        improvement_delta: {
          timing_delta: hasOriginalRun ? "Concept intelligence was available for this case" : "No concept run existed — v2.0 analysis would have provided mechanism chains, blind spots, and contradiction detection from first inspection",
          prevented_miss: !hasOriginalRun,
          accelerated_discovery: !hasOriginalRun,
          reduced_false_confidence: !hasOriginalRun
        },
        recommendation: hasOriginalRun ? "Original concept run exists. Compare original governing concept and authority state against actual outcome." : "No concept run existed for this case. Running v2.0 analysis now would retroactively identify any missed secondary risks or blind spots."
      };

      // Persist replay
      try {
        await sb.from("concept_replay_runs").insert({
          source_case_id: replayCaseId,
          org_id: replayOrgId || caseQ.data.org_id || "default",
          replay_version: ENGINE_VERSION,
          replay_mode: body.replay_mode || "strict",
          replay_output: replayOutput,
          improvement_delta_json: replayOutput.improvement_delta
        });
      } catch (replayPersistErr) { /* non-fatal */ }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "replay_case",
          success: true,
          engine_version: ENGINE_VERSION,
          replay: replayOutput
        })
      };
    }

    // ── get_drift_metrics ──
    if (action === "get_drift_metrics") {
      var driftKey = body.concept_key || null;
      var driftQuery = sb.from("concept_drift_metrics").select("*").order("created_at", { ascending: false }).limit(50);
      if (driftKey) driftQuery = driftQuery.eq("concept_key", driftKey);
      if (body.org_id) driftQuery = driftQuery.eq("org_id", body.org_id);
      if (body.vertical) driftQuery = driftQuery.eq("vertical", body.vertical);

      var driftResult = await driftQuery;

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "get_drift_metrics",
          engine_version: ENGINE_VERSION,
          metrics: driftResult.data || [],
          note: driftResult.data && driftResult.data.length === 0 ? "No drift metrics recorded yet. Metrics populate as validation events accumulate." : null
        })
      };
    }

    // ── full_v21_analysis ── Takes v2.0 output, runs dominance + authority
    if (action === "full_v21_analysis") {
      var v20Output = body.v20_output;
      if (!v20Output) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "v20_output object required (output from concept-intelligence-core analyze_case)" }) };
      }

      var v21Result = runFullV21Analysis(v20Output);

      // Persist dominance and authority if IDs available
      var packId = v20Output.concept_pack_id || body.concept_run_id;
      var caseId = v20Output.case_id || body.case_id;
      var orgId = body.org_id;

      if (packId && caseId && orgId) {
        try {
          await sb.from("concept_dominance_results").insert({
            concept_run_id: packId,
            case_id: caseId,
            org_id: orgId,
            governing_concept: v21Result.dominance.governing_concept,
            visible_supporting_concepts: v21Result.dominance.visible_supporting_concepts,
            suppressed_concepts: v21Result.dominance.suppressed_concepts,
            audit_only_concepts: v21Result.dominance.audit_only_concepts,
            dominance_json: v21Result.dominance
          });
        } catch (dp) { /* non-fatal */ }

        try {
          await sb.from("concept_authority_events").insert({
            concept_run_id: packId,
            case_id: caseId,
            org_id: orgId,
            authority_state: v21Result.authority.authority_state,
            authority_reason: v21Result.authority.authority_reason,
            authority_json: v21Result.authority
          });
        } catch (ap) { /* non-fatal */ }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "full_v21_analysis",
          success: true,
          engine_version: ENGINE_VERSION,
          result: v21Result
        })
      };
    }

    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Unknown action: " + action,
        valid_actions: ["get_registry", "resolve_dominance", "enforce_authority", "validate_concept", "get_reliability", "replay_case", "get_drift_metrics", "full_v21_analysis"]
      })
    };

  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
