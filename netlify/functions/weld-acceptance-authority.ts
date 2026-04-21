// @ts-nocheck
/**
 * DEPLOY260 - Weld Acceptance Authority v1.0.0
 * netlify/functions/weld-acceptance-authority.ts
 *
 * CWI-level deterministic weld evaluation engine.
 * Not an image classifier — an inspection authority system.
 *
 * Architecture: OpenAI sees → Claude reasons → this engine DECIDES.
 * AI handles observation. This engine handles code, physics, and law.
 *
 * 12 actions:
 *   get_registry
 *   evaluate_weld         — full CWI-level assessment
 *   route_code            — determine governing code + clause
 *   check_acceptance      — single discontinuity vs code threshold
 *   check_dominance       — discontinuity interaction/dominance ranking
 *   validate_physics      — 4D physics plausibility (process x position x material)
 *   check_evidence        — evidence sufficiency gate
 *   get_process_registry  — all welding processes
 *   get_position_registry — all positions including sheet metal
 *   get_material_registry — all base materials
 *   get_joint_registry    — all joint configurations
 *   get_discontinuity_registry — all discontinuity types with physics
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var ENGINE_NAME = "weld-acceptance-authority";
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

// ── helpers ──

function ok(data) {
  return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(data) };
}

function fail(code, msg) {
  return { statusCode: code, headers: corsHeaders, body: JSON.stringify({ error: msg }) };
}

function getOrg(event) {
  try {
    var auth = event.headers["authorization"] || "";
    if (!auth) return null;
    var token = auth.replace("Bearer ", "");
    var payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    return payload.app_metadata && payload.app_metadata.org_id ? payload.app_metadata.org_id : null;
  } catch (e) {
    return null;
  }
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function nowISO() {
  return new Date().toISOString();
}

// ── audit helper ──

function auditLog(orgId, actionType, caseId, scanId, detail) {
  return supabase.from("weld_audit_events").insert({
    org_id: orgId,
    case_id: caseId || null,
    scan_id: scanId || null,
    action_type: actionType,
    event_json: detail
  });
}

// ══════════════════════════════════════════════
// DOMINANCE ENGINE
// Tier 1 = absolute dominance (cracks). If any Tier 1 exists,
// nothing else matters — REJECT immediately.
// ══════════════════════════════════════════════

function getDominanceTier(discKey, discRegistry) {
  for (var i = 0; i < discRegistry.length; i++) {
    if (discRegistry[i].discontinuity_key === discKey) {
      return discRegistry[i].dominance_tier;
    }
  }
  return 5;
}

function getDiscInfo(discKey, discRegistry) {
  for (var i = 0; i < discRegistry.length; i++) {
    if (discRegistry[i].discontinuity_key === discKey) return discRegistry[i];
  }
  return null;
}

function rankByDominance(discontinuities, discRegistry) {
  var ranked = discontinuities.slice().sort(function(a, b) {
    var tierA = getDominanceTier(a.discontinuity_key, discRegistry);
    var tierB = getDominanceTier(b.discontinuity_key, discRegistry);
    return tierA - tierB;
  });
  return ranked;
}

// ══════════════════════════════════════════════
// EVIDENCE SUFFICIENCY ENGINE
// A CWI does not evaluate in a vacuum.
// ══════════════════════════════════════════════

function checkEvidenceSufficiency(evidence) {
  var issues = [];
  var score = 100;
  var required = [];

  // Must have at least one image or explicit measurements
  if (!evidence.images || evidence.images.length === 0) {
    if (!evidence.measurements || evidence.measurements.length === 0) {
      issues.push("No images and no measurements provided — cannot evaluate");
      score = 0;
      required.push("weld_photo_overview");
      required.push("weld_photo_closeup");
    }
  }

  // Check image count and types
  if (evidence.images && evidence.images.length > 0) {
    var hasOverview = false;
    var hasCloseup = false;
    var hasProfile = false;
    var hasCalibration = false;

    for (var i = 0; i < evidence.images.length; i++) {
      var img = evidence.images[i];
      if (img.type === "overview") hasOverview = true;
      if (img.type === "closeup") hasCloseup = true;
      if (img.type === "profile" || img.type === "side_view") hasProfile = true;
      if (img.calibrated || img.has_reference) hasCalibration = true;
      if (img.quality_score !== undefined && img.quality_score < 50) {
        issues.push("Image " + (i + 1) + " has low quality score (" + img.quality_score + ") — may affect accuracy");
        score -= 10;
      }
    }

    if (!hasOverview) { issues.push("No overview photo — recommend full weld view"); score -= 10; required.push("weld_photo_overview"); }
    if (!hasCloseup) { issues.push("No close-up photo — detail may be missed"); score -= 10; required.push("weld_photo_closeup"); }
    if (!hasProfile) { issues.push("No profile/side view — reinforcement and throat cannot be verified"); score -= 15; required.push("weld_photo_profile"); }
    if (!hasCalibration) { issues.push("No calibration reference — measurements are estimated only"); score -= 15; required.push("calibration_reference"); }
  }

  // Check metadata
  if (!evidence.process) { issues.push("Welding process not specified"); score -= 10; }
  if (!evidence.position) { issues.push("Weld position not specified"); score -= 5; }
  if (!evidence.material) { issues.push("Base material not specified"); score -= 5; }
  if (!evidence.joint_type) { issues.push("Joint type not specified"); score -= 5; }
  if (!evidence.code) { issues.push("Governing code not specified — cannot determine acceptance criteria"); score -= 20; }
  if (!evidence.thickness) { issues.push("Material thickness not specified — thickness-dependent criteria cannot be applied"); score -= 10; }

  if (score < 0) score = 0;

  var rating = "sufficient";
  if (score < 30) rating = "critically_insufficient";
  else if (score < 50) rating = "insufficient";
  else if (score < 70) rating = "marginal";
  else if (score < 85) rating = "adequate";
  else rating = "sufficient";

  return {
    score: score,
    rating: rating,
    issues: issues,
    required_evidence: required,
    can_proceed: score >= 50,
    can_issue_final: score >= 80,
    must_escalate: score < 50
  };
}

// ══════════════════════════════════════════════
// CODE ROUTING ENGINE
// What code applies? What clause? What table?
// ══════════════════════════════════════════════

function routeCode(context) {
  // If explicit code provided, use it
  if (context.code_key) return context.code_key;

  // Auto-route based on context
  var application = (context.application || "").toLowerCase();
  var material = (context.material || "").toLowerCase();
  var joint = (context.joint_type || "").toLowerCase();

  if (application.indexOf("bridge") >= 0) return "aws_d1_5";
  if (application.indexOf("pipeline") >= 0 || application.indexOf("pipe") >= 0) {
    if (application.indexOf("process") >= 0 || application.indexOf("chemical") >= 0) return "asme_b31_3";
    if (application.indexOf("power") >= 0 || application.indexOf("steam") >= 0) return "asme_b31_1";
    return "api_1104";
  }
  if (application.indexOf("pressure") >= 0 || application.indexOf("vessel") >= 0) return "asme_viii";

  // Material-based routing
  if (material.indexOf("aluminum") >= 0) return "aws_d1_2";
  if (material.indexOf("stainless") >= 0 && material.indexOf("sheet") < 0) return "aws_d1_6";
  if (material.indexOf("sheet") >= 0) return "aws_d1_3";

  // Thickness-based: sheet steel < 3.4mm → D1.3
  if (context.thickness && context.thickness <= 3.4) return "aws_d1_3";

  // Default: structural steel
  return "aws_d1_1";
}

// ══════════════════════════════════════════════
// ACCEPTANCE CHECK ENGINE
// Single discontinuity vs code threshold
// ══════════════════════════════════════════════

function checkSingleAcceptance(disc, criteria, context) {
  var result = {
    discontinuity_key: disc.discontinuity_key,
    measured_value: disc.measured_value,
    measured_unit: disc.measured_unit || "mm",
    criteria_matched: [],
    disposition: "accept",
    reject_reasons: [],
    conditional_notes: [],
    governing_clauses: []
  };

  if (!criteria || criteria.length === 0) {
    result.disposition = "no_criteria";
    result.conditional_notes.push("No code acceptance criteria found for this discontinuity under " + (context.code_key || "unknown code"));
    return result;
  }

  for (var ci = 0; ci < criteria.length; ci++) {
    var crit = criteria[ci];

    // Match loading condition
    if (context.loading_condition && crit.loading_condition !== context.loading_condition && crit.loading_condition !== "all") {
      continue;
    }

    result.criteria_matched.push({
      table: crit.table_reference,
      clause: crit.clause_reference,
      type: crit.criteria_type,
      code: crit.code_key
    });

    result.governing_clauses.push(crit.code_name + " " + crit.table_reference + " (" + crit.clause_reference + ")");

    // Absolute reject (cracks, LOF, etc.)
    if (crit.absolute_reject) {
      result.disposition = "reject";
      result.reject_reasons.push({
        reason: disc.discontinuity_key + " is not permitted per " + crit.code_name + " " + crit.table_reference,
        clause: crit.clause_reference,
        criteria_type: crit.criteria_type,
        note: crit.conditional_note
      });
      break; // No need to check further
    }

    // Conditional checks with measured values
    if (disc.measured_value !== undefined && disc.measured_value !== null) {
      var rejectOnMeasure = false;

      if (crit.max_individual !== null && crit.max_individual !== undefined) {
        if (disc.measured_value > crit.max_individual) {
          rejectOnMeasure = true;
          result.reject_reasons.push({
            reason: disc.discontinuity_key + " measured " + disc.measured_value + disc.measured_unit + " exceeds maximum " + crit.max_individual + disc.measured_unit,
            clause: crit.clause_reference,
            criteria_type: crit.criteria_type
          });
        }
      }

      if (crit.max_depth_mm !== null && crit.max_depth_mm !== undefined) {
        if (disc.measured_value > crit.max_depth_mm) {
          rejectOnMeasure = true;
          result.reject_reasons.push({
            reason: disc.discontinuity_key + " depth " + disc.measured_value + "mm exceeds maximum " + crit.max_depth_mm + "mm",
            clause: crit.clause_reference,
            criteria_type: crit.criteria_type
          });
        }
      }

      if (crit.max_depth_percent !== null && crit.max_depth_percent !== undefined && context.thickness) {
        var depthPercent = (disc.measured_value / context.thickness) * 100;
        if (depthPercent > crit.max_depth_percent) {
          rejectOnMeasure = true;
          result.reject_reasons.push({
            reason: disc.discontinuity_key + " depth is " + round2(depthPercent) + "% of thickness, exceeds " + crit.max_depth_percent + "% limit",
            clause: crit.clause_reference,
            criteria_type: crit.criteria_type
          });
        }
      }

      if (crit.max_length_mm !== null && crit.max_length_mm !== undefined && disc.measured_length) {
        if (disc.measured_length > crit.max_length_mm) {
          rejectOnMeasure = true;
          result.reject_reasons.push({
            reason: disc.discontinuity_key + " length " + disc.measured_length + "mm exceeds maximum " + crit.max_length_mm + "mm",
            clause: crit.clause_reference,
            criteria_type: crit.criteria_type
          });
        }
      }

      if (crit.max_size_mm !== null && crit.max_size_mm !== undefined) {
        if (disc.measured_value > crit.max_size_mm) {
          rejectOnMeasure = true;
          result.reject_reasons.push({
            reason: disc.discontinuity_key + " size " + disc.measured_value + "mm exceeds maximum " + crit.max_size_mm + "mm",
            clause: crit.clause_reference,
            criteria_type: crit.criteria_type
          });
        }
      }

      if (rejectOnMeasure) {
        result.disposition = "reject";
      }
    } else {
      // No measurement — conditional acceptance
      if (crit.criteria_type !== "zero_tolerance") {
        result.conditional_notes.push("No measurement provided for " + disc.discontinuity_key + " — cannot verify against " + crit.criteria_type + " limits. Gauge measurement required.");
      }
    }
  }

  return result;
}

// ══════════════════════════════════════════════
// CONFIDENCE ENGINE
// How certain are we in this assessment?
// ══════════════════════════════════════════════

function computeConfidence(evidenceSufficiency, discontinuityResults, physicsValidations, hasCalibration) {
  var score = 50; // Base

  // Evidence quality
  score += (evidenceSufficiency.score / 100) * 25; // Up to 25 points from evidence

  // Calibration
  if (hasCalibration) score += 10;

  // Measurement completeness
  var measured = 0;
  var total = discontinuityResults.length;
  for (var i = 0; i < discontinuityResults.length; i++) {
    if (discontinuityResults[i].measured_value !== undefined && discontinuityResults[i].measured_value !== null) {
      measured++;
    }
  }
  if (total > 0) {
    score += (measured / total) * 10; // Up to 10 points from measurement completeness
  }

  // Physics validation agreement
  if (physicsValidations && physicsValidations.length > 0) {
    var plausible = 0;
    for (var pi = 0; pi < physicsValidations.length; pi++) {
      if (physicsValidations[pi].plausible) plausible++;
    }
    score += (plausible / physicsValidations.length) * 5;
  }

  if (score > 100) score = 100;
  score = round2(score);

  var level = "low";
  if (score >= 90) level = "high";
  else if (score >= 75) level = "moderate";
  else if (score >= 60) level = "provisional";
  else level = "low";

  return {
    score: score,
    level: level,
    requires_escalation: score < 60,
    can_auto_accept: score >= 85,
    can_auto_reject: score >= 70 // Rejections need less confidence than accepts
  };
}

// ══════════════════════════════════════════════
// ESCALATION LOGIC
// ══════════════════════════════════════════════

function determineEscalation(confidence, disposition, discontinuityResults, mode) {
  var escalate = false;
  var reasons = [];

  // Always escalate cracks
  for (var i = 0; i < discontinuityResults.length; i++) {
    var dr = discontinuityResults[i];
    if (dr.discontinuity_key && dr.discontinuity_key.indexOf("crack") >= 0) {
      escalate = true;
      reasons.push("Crack indication detected — requires CWI/instructor confirmation");
    }
  }

  // Low confidence
  if (confidence.requires_escalation) {
    escalate = true;
    reasons.push("Confidence score " + confidence.score + " below escalation threshold");
  }

  // Accept without high confidence
  if (disposition === "accept" && !confidence.can_auto_accept) {
    escalate = true;
    reasons.push("Accept disposition requires confidence >= 85; current: " + confidence.score);
  }

  // Production mode: always escalate
  if (mode === "production" || mode === "cwi_assist") {
    escalate = true;
    reasons.push("Mode " + mode + " requires human signoff on all dispositions");
  }

  return {
    escalate: escalate,
    reasons: reasons,
    priority: escalate && disposition === "reject" ? "high" : escalate ? "normal" : "none"
  };
}

// ══════════════════════════════════════════════
//  HANDLER
// ══════════════════════════════════════════════

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return fail(405, "POST only");

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "";

    // ── get_registry ──
    if (action === "get_registry") {
      return ok({
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        status: "operational",
        capabilities: [
          "evaluate_weld",
          "route_code",
          "check_acceptance",
          "check_dominance",
          "validate_physics",
          "check_evidence",
          "get_process_registry",
          "get_position_registry",
          "get_material_registry",
          "get_joint_registry",
          "get_discontinuity_registry"
        ],
        codes_supported: ["aws_d1_1", "aws_d1_2", "aws_d1_3", "aws_d1_5", "aws_d1_6", "api_1104", "asme_viii", "asme_b31_3"],
        modes: ["training", "instructor", "production", "cwi_assist"],
        processes: 17,
        positions: 17,
        materials: 18,
        joints: 20,
        discontinuities: 25,
        physics_rules: "4D: process x position x material x environment",
        description: "CWI-level deterministic weld acceptance authority. AI observes, this engine decides. All dispositions traceable to code clause."
      });
    }

    // ── get_process_registry ──
    if (action === "get_process_registry") {
      var procResult = await supabase.from("weld_process_registry").select("*").eq("active", true).order("process_category");
      if (procResult.error) return fail(500, procResult.error.message);
      return ok({ processes: procResult.data, total: procResult.data.length });
    }

    // ── get_position_registry ──
    if (action === "get_position_registry") {
      var posResult = await supabase.from("weld_position_registry").select("*").eq("active", true).order("difficulty_tier");
      if (posResult.error) return fail(500, posResult.error.message);
      return ok({ positions: posResult.data, total: posResult.data.length });
    }

    // ── get_material_registry ──
    if (action === "get_material_registry") {
      var matResult = await supabase.from("weld_material_registry").select("*").eq("active", true).order("material_group");
      if (matResult.error) return fail(500, matResult.error.message);
      return ok({ materials: matResult.data, total: matResult.data.length });
    }

    // ── get_joint_registry ──
    if (action === "get_joint_registry") {
      var jointResult = await supabase.from("weld_joint_registry").select("*").eq("active", true).order("joint_category");
      if (jointResult.error) return fail(500, jointResult.error.message);
      return ok({ joints: jointResult.data, total: jointResult.data.length });
    }

    // ── get_discontinuity_registry ──
    if (action === "get_discontinuity_registry") {
      var discResult = await supabase.from("weld_discontinuity_registry").select("*").eq("active", true).order("dominance_tier", { ascending: true });
      if (discResult.error) return fail(500, discResult.error.message);
      return ok({ discontinuities: discResult.data, total: discResult.data.length });
    }

    // ── route_code ──
    if (action === "route_code") {
      var codeKey = routeCode({
        code_key: body.code_key,
        application: body.application,
        material: body.material,
        joint_type: body.joint_type,
        thickness: body.thickness
      });

      // Get criteria summary for this code
      var critSummary = await supabase.from("weld_code_acceptance_criteria")
        .select("code_name, table_reference, clause_reference, loading_condition, discontinuity_key, criteria_type, absolute_reject")
        .eq("code_key", codeKey)
        .eq("active", true);

      var absoluteRejects = [];
      var conditionalChecks = [];
      if (critSummary.data) {
        for (var cs = 0; cs < critSummary.data.length; cs++) {
          if (critSummary.data[cs].absolute_reject) {
            absoluteRejects.push(critSummary.data[cs].discontinuity_key);
          } else {
            conditionalChecks.push(critSummary.data[cs].discontinuity_key);
          }
        }
      }

      return ok({
        code_key: codeKey,
        code_name: critSummary.data && critSummary.data.length > 0 ? critSummary.data[0].code_name : codeKey,
        routing_basis: body.code_key ? "explicit" : "auto_routed",
        loading_conditions_available: ["static", "cyclic", "pressure"],
        absolute_reject_discontinuities: absoluteRejects,
        conditional_discontinuities: conditionalChecks,
        total_criteria: critSummary.data ? critSummary.data.length : 0
      });
    }

    // ── check_evidence ──
    if (action === "check_evidence") {
      var evidence = body.evidence || body;
      var sufficiency = checkEvidenceSufficiency(evidence);
      return ok({ evidence_sufficiency: sufficiency });
    }

    // ── check_acceptance ──
    if (action === "check_acceptance") {
      if (!body.discontinuity_key) return fail(400, "discontinuity_key required");
      if (!body.code_key) return fail(400, "code_key required");

      var criteria = await supabase.from("weld_code_acceptance_criteria")
        .select("*")
        .eq("code_key", body.code_key)
        .eq("discontinuity_key", body.discontinuity_key)
        .eq("active", true);

      if (criteria.error) return fail(500, criteria.error.message);

      var disc = {
        discontinuity_key: body.discontinuity_key,
        measured_value: body.measured_value,
        measured_unit: body.measured_unit || "mm",
        measured_length: body.measured_length
      };

      var context = {
        code_key: body.code_key,
        loading_condition: body.loading_condition || "static",
        thickness: body.thickness
      };

      var result = checkSingleAcceptance(disc, criteria.data, context);

      return ok(result);
    }

    // ── check_dominance ──
    if (action === "check_dominance") {
      if (!body.discontinuities || !Array.isArray(body.discontinuities)) {
        return fail(400, "discontinuities array required");
      }

      var discReg = await supabase.from("weld_discontinuity_registry").select("*").eq("active", true);
      if (discReg.error) return fail(500, discReg.error.message);

      var ranked = rankByDominance(body.discontinuities, discReg.data);
      var dominant = ranked.length > 0 ? ranked[0] : null;
      var dominantInfo = dominant ? getDiscInfo(dominant.discontinuity_key, discReg.data) : null;

      var hasTier1 = false;
      for (var t = 0; t < ranked.length; t++) {
        if (getDominanceTier(ranked[t].discontinuity_key, discReg.data) === 1) {
          hasTier1 = true;
          break;
        }
      }

      return ok({
        ranked: ranked.map(function(r) {
          var info = getDiscInfo(r.discontinuity_key, discReg.data);
          return {
            discontinuity_key: r.discontinuity_key,
            dominance_tier: info ? info.dominance_tier : 5,
            severity_ranking: info ? info.severity_ranking : 5,
            is_planar: info ? info.is_planar : false,
            name: info ? info.discontinuity_name : r.discontinuity_key
          };
        }),
        dominant_discontinuity: dominant ? dominant.discontinuity_key : null,
        dominant_tier: dominantInfo ? dominantInfo.dominance_tier : null,
        has_tier1_crack: hasTier1,
        verdict: hasTier1
          ? "TIER 1 DOMINANT: Crack detected. All other discontinuities are secondary. Immediate reject per all codes."
          : dominant && dominantInfo && dominantInfo.dominance_tier <= 2
          ? "TIER 2 DOMINANT: " + (dominantInfo ? dominantInfo.discontinuity_name : "") + " dominates. Evaluate this first."
          : "No dominant discontinuity — evaluate all findings individually."
      });
    }

    // ── validate_physics ──
    if (action === "validate_physics") {
      if (!body.discontinuity_key) return fail(400, "discontinuity_key required");

      var query = supabase.from("weld_4d_physics_rules").select("*").eq("active", true).eq("discontinuity_key", body.discontinuity_key);

      if (body.process_key) query = query.or("process_key.eq." + body.process_key + ",process_key.is.null");
      if (body.position_key) query = query.or("position_key.eq." + body.position_key + ",position_key.is.null");
      if (body.material_key) query = query.or("material_key.eq." + body.material_key + ",material_key.is.null");

      var physResult = await query;
      if (physResult.error) return fail(500, physResult.error.message);

      // Also check general rules (no specific process/position/material)
      var generalRules = await supabase.from("weld_4d_physics_rules")
        .select("*")
        .eq("active", true)
        .eq("discontinuity_key", body.discontinuity_key)
        .is("process_key", null)
        .is("position_key", null)
        .is("material_key", null);

      var allRules = (physResult.data || []).concat(generalRules.data || []);

      // Deduplicate by rule_key
      var seen = {};
      var unique = [];
      for (var ui = 0; ui < allRules.length; ui++) {
        if (!seen[allRules[ui].rule_key]) {
          seen[allRules[ui].rule_key] = true;
          unique.push(allRules[ui]);
        }
      }

      var plausible = unique.length > 0;
      var highProbability = false;
      for (var hp = 0; hp < unique.length; hp++) {
        if (unique[hp].probability === "probable" || unique[hp].probability === "certain") {
          highProbability = true;
          break;
        }
      }

      return ok({
        discontinuity_key: body.discontinuity_key,
        process_key: body.process_key || null,
        position_key: body.position_key || null,
        material_key: body.material_key || null,
        physics_plausible: plausible,
        high_probability: highProbability,
        rules_matched: unique.map(function(r) {
          return {
            rule_key: r.rule_key,
            rule_name: r.rule_name,
            probability: r.probability,
            physics_explanation: r.physics_explanation,
            root_cause: r.root_cause,
            contributing_factors: r.contributing_factors,
            prevention_actions: r.prevention_actions,
            teaching_point: r.teaching_point
          };
        }),
        total_rules: unique.length,
        assessment: highProbability
          ? "HIGH PROBABILITY: Physics confirms this discontinuity is expected given the process/position/material combination."
          : plausible
          ? "PLAUSIBLE: Physics rules support this discontinuity occurring in this context."
          : "LOW PROBABILITY: No physics rules match this combination — verify detection accuracy or consider unusual conditions."
      });
    }

    // ══════════════════════════════════════════════
    // EVALUATE_WELD — The Full CWI Assessment
    // ══════════════════════════════════════════════
    if (action === "evaluate_weld") {
      var orgId = body.org_id || getOrg(event);
      if (!orgId) return fail(400, "org_id required");

      var mode = body.mode || "training";

      // 1. EVIDENCE SUFFICIENCY GATE
      var evidence = {
        images: body.images || [],
        measurements: body.measurements || [],
        process: body.process_key,
        position: body.position_key,
        material: body.material_key,
        joint_type: body.joint_key,
        code: body.code_key,
        thickness: body.thickness
      };

      var evSufficiency = checkEvidenceSufficiency(evidence);

      // If critically insufficient, stop
      if (evSufficiency.score < 30) {
        await auditLog(orgId, "evaluation_blocked", body.case_id, body.scan_id, {
          reason: "evidence_critically_insufficient",
          score: evSufficiency.score,
          issues: evSufficiency.issues
        });

        return ok({
          disposition: "insufficient_evidence",
          disposition_detail: "Cannot evaluate — evidence is critically insufficient",
          evidence_sufficiency: evSufficiency,
          required_actions: evSufficiency.required_evidence.map(function(re) {
            return "Provide: " + re;
          }),
          assessment_complete: false
        });
      }

      // 2. CODE ROUTING
      var codeKey = routeCode({
        code_key: body.code_key,
        application: body.application,
        material: body.material_key,
        joint_type: body.joint_key,
        thickness: body.thickness
      });

      var loadingCondition = body.loading_condition || "static";

      // 3. GET REGISTRIES
      var discRegistry = await supabase.from("weld_discontinuity_registry").select("*").eq("active", true);
      if (discRegistry.error) return fail(500, discRegistry.error.message);

      // 4. PROCESS DISCONTINUITIES
      var discontinuities = body.discontinuities || [];
      if (discontinuities.length === 0) {
        // No discontinuities found — clean weld
        var cleanAssessment = {
          org_id: orgId,
          case_id: body.case_id || null,
          scan_id: body.scan_id || null,
          process_key: body.process_key || null,
          position_key: body.position_key || null,
          material_key: body.material_key || null,
          joint_key: body.joint_key || null,
          code_key: codeKey,
          loading_condition: loadingCondition,
          thickness_mm: body.thickness || null,
          discontinuities_found: [],
          criteria_applied: [],
          physics_validations: [],
          disposition: evSufficiency.can_issue_final ? "accept" : "provisional_accept",
          disposition_detail: "No discontinuities detected",
          governing_clause: codeKey + " visual acceptance criteria",
          reject_reasons: [],
          accept_conditions: evSufficiency.can_issue_final ? [] : ["Requires additional evidence or instructor confirmation"],
          repair_required: false,
          confidence_score: evSufficiency.score,
          assessment_json: { evidence_sufficiency: evSufficiency, mode: mode },
          engine_version: ENGINE_VERSION
        };

        await supabase.from("weld_assessments").insert(cleanAssessment);
        await auditLog(orgId, "weld_evaluated", body.case_id, body.scan_id, { disposition: cleanAssessment.disposition, code: codeKey });

        return ok({
          disposition: cleanAssessment.disposition,
          disposition_detail: cleanAssessment.disposition_detail,
          code_routed: codeKey,
          evidence_sufficiency: evSufficiency,
          findings: [],
          confidence: { score: evSufficiency.score, level: evSufficiency.score >= 80 ? "high" : "provisional" },
          escalation: determineEscalation({ score: evSufficiency.score, requires_escalation: false, can_auto_accept: evSufficiency.can_issue_final }, "accept", [], mode)
        });
      }

      // 5. DOMINANCE CHECK
      var ranked = rankByDominance(discontinuities, discRegistry.data);

      // 6. EVALUATE EACH DISCONTINUITY AGAINST CODE
      var findings = [];
      var allRejectReasons = [];
      var overallDisposition = "accept";
      var governingClauses = [];
      var physicsValidations = [];
      var repairRequired = false;
      var repairRecommendations = [];

      for (var di = 0; di < ranked.length; di++) {
        var disc = ranked[di];

        // Get criteria for this discontinuity + code
        var critResult = await supabase.from("weld_code_acceptance_criteria")
          .select("*")
          .eq("code_key", codeKey)
          .eq("discontinuity_key", disc.discontinuity_key)
          .eq("active", true);

        var context = {
          code_key: codeKey,
          loading_condition: loadingCondition,
          thickness: body.thickness
        };

        var acceptance = checkSingleAcceptance(disc, critResult.data || [], context);

        // Physics validation
        var physQuery = supabase.from("weld_4d_physics_rules")
          .select("rule_name, probability, physics_explanation, root_cause, prevention_actions, teaching_point")
          .eq("discontinuity_key", disc.discontinuity_key)
          .eq("active", true);

        if (body.process_key) physQuery = physQuery.or("process_key.eq." + body.process_key + ",process_key.is.null");

        var physResult = await physQuery.limit(3);
        var physRules = physResult.data || [];

        var physValidation = {
          discontinuity: disc.discontinuity_key,
          plausible: physRules.length > 0,
          rules: physRules
        };
        physicsValidations.push(physValidation);

        // Get discontinuity info for enrichment
        var discInfo = getDiscInfo(disc.discontinuity_key, discRegistry.data);

        var finding = {
          discontinuity_key: disc.discontinuity_key,
          discontinuity_name: discInfo ? discInfo.discontinuity_name : disc.discontinuity_key,
          dominance_tier: discInfo ? discInfo.dominance_tier : 5,
          is_planar: discInfo ? discInfo.is_planar : false,
          measured_value: disc.measured_value,
          measured_unit: disc.measured_unit || "mm",
          measured_length: disc.measured_length,
          location: disc.location || "not_specified",
          ai_confidence: disc.ai_confidence || null,
          acceptance: acceptance,
          physics: physValidation,
          repair_action: null
        };

        // Track disposition
        if (acceptance.disposition === "reject") {
          overallDisposition = "reject";
          repairRequired = true;
          for (var rr = 0; rr < acceptance.reject_reasons.length; rr++) {
            allRejectReasons.push(acceptance.reject_reasons[rr]);
          }

          // Generate repair recommendation
          var repairRec = disc.discontinuity_key.indexOf("crack") >= 0
            ? "Excavate to sound metal, verify removal by MT/PT, re-weld per qualified WPS"
            : disc.discontinuity_key === "undercut"
            ? "Additional weld pass at toe with reduced heat input"
            : disc.discontinuity_key === "porosity_scattered" || disc.discontinuity_key === "porosity_cluster"
            ? "Excavate affected area, improve shielding/cleanliness, re-weld"
            : disc.discontinuity_key === "incomplete_fusion" || disc.discontinuity_key === "incomplete_penetration"
            ? "Back-gouge to sound metal, re-weld with proper technique and heat input"
            : disc.discontinuity_key === "burnthrough"
            ? "Patch or re-make joint with reduced heat input or backing"
            : "Repair per qualified repair procedure";

          finding.repair_action = repairRec;
          repairRecommendations.push({ discontinuity: disc.discontinuity_key, action: repairRec });
        }

        for (var gc = 0; gc < acceptance.governing_clauses.length; gc++) {
          if (governingClauses.indexOf(acceptance.governing_clauses[gc]) < 0) {
            governingClauses.push(acceptance.governing_clauses[gc]);
          }
        }

        findings.push(finding);
      }

      // 7. CONFIDENCE SCORING
      var hasCalibration = false;
      if (body.images) {
        for (var ci = 0; ci < body.images.length; ci++) {
          if (body.images[ci].calibrated || body.images[ci].has_reference) hasCalibration = true;
        }
      }

      var confidence = computeConfidence(evSufficiency, discontinuities, physicsValidations, hasCalibration);

      // 8. PROVISIONAL LOGIC
      if (overallDisposition === "accept" && !evSufficiency.can_issue_final) {
        overallDisposition = "provisional_accept";
      }
      if (overallDisposition === "reject" && confidence.score < 60) {
        overallDisposition = "provisional_reject";
      }

      // 9. ESCALATION
      var escalation = determineEscalation(confidence, overallDisposition, findings, mode);

      if (escalation.escalate && overallDisposition === "accept") {
        overallDisposition = "accept_pending_review";
      }

      // 10. STORE ASSESSMENT
      var assessment = {
        org_id: orgId,
        case_id: body.case_id || null,
        scan_id: body.scan_id || null,
        process_key: body.process_key || null,
        position_key: body.position_key || null,
        material_key: body.material_key || null,
        joint_key: body.joint_key || null,
        code_key: codeKey,
        loading_condition: loadingCondition,
        thickness_mm: body.thickness || null,
        discontinuities_found: findings,
        criteria_applied: governingClauses,
        physics_validations: physicsValidations,
        disposition: overallDisposition,
        disposition_detail: overallDisposition === "reject"
          ? "REJECT: " + allRejectReasons.length + " code violation(s) found"
          : overallDisposition === "provisional_accept"
          ? "PROVISIONAL ACCEPT: Pending additional evidence or reviewer confirmation"
          : overallDisposition === "accept_pending_review"
          ? "ACCEPT PENDING REVIEW: Disposition requires instructor/CWI confirmation"
          : overallDisposition === "provisional_reject"
          ? "PROVISIONAL REJECT: Low confidence — requires verification"
          : "ACCEPT: All discontinuities within code acceptance criteria",
        governing_clause: governingClauses.join("; "),
        reject_reasons: allRejectReasons,
        accept_conditions: overallDisposition.indexOf("provisional") >= 0 || overallDisposition.indexOf("pending") >= 0
          ? ["Requires human review before final disposition"]
          : [],
        repair_required: repairRequired,
        repair_recommendations: repairRecommendations,
        confidence_score: confidence.score,
        assessment_json: {
          evidence_sufficiency: evSufficiency,
          confidence: confidence,
          escalation: escalation,
          mode: mode,
          dominance_applied: true
        },
        engine_version: ENGINE_VERSION
      };

      var assessInsert = await supabase.from("weld_assessments").insert(assessment).select().single();

      await auditLog(orgId, "weld_evaluated", body.case_id, body.scan_id, {
        disposition: overallDisposition,
        code: codeKey,
        findings_count: findings.length,
        reject_reasons: allRejectReasons.length,
        confidence: confidence.score,
        escalated: escalation.escalate,
        mode: mode
      });

      // 11. RETURN FULL CWI REPORT
      return ok({
        assessment_id: assessInsert.data ? assessInsert.data.id : null,
        disposition: overallDisposition,
        disposition_detail: assessment.disposition_detail,
        code_routed: {
          code_key: codeKey,
          loading_condition: loadingCondition,
          governing_clauses: governingClauses
        },
        evidence_sufficiency: evSufficiency,
        findings: findings,
        dominance: {
          dominant: findings.length > 0 ? findings[0].discontinuity_key : null,
          dominant_tier: findings.length > 0 ? findings[0].dominance_tier : null,
          has_crack: findings.some(function(f) { return f.discontinuity_key.indexOf("crack") >= 0; })
        },
        reject_reasons: allRejectReasons,
        repair: {
          required: repairRequired,
          recommendations: repairRecommendations
        },
        confidence: confidence,
        escalation: escalation,
        mode: mode,
        summary: overallDisposition === "reject"
          ? "WELD REJECTED. " + allRejectReasons.length + " code violation(s) per " + governingClauses[0] + ". Repair required."
          : overallDisposition === "accept"
          ? "WELD ACCEPTED. All " + findings.length + " finding(s) within " + codeKey + " acceptance criteria."
          : "WELD " + overallDisposition.toUpperCase().replace(/_/g, " ") + ". " + (escalation.escalate ? "Escalated for review: " + escalation.reasons[0] : "")
      });
    }

    return fail(400, "Unknown action: " + action + ". Valid actions: get_registry, evaluate_weld, route_code, check_acceptance, check_dominance, validate_physics, check_evidence, get_process_registry, get_position_registry, get_material_registry, get_joint_registry, get_discontinuity_registry");

  } catch (err) {
    return fail(500, String(err && err.message ? err.message : err));
  }
};
