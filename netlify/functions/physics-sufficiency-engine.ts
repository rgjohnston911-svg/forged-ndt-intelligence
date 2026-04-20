// @ts-nocheck
/**
 * DEPLOY259 - Physics Sufficiency Engine v1.0.0
 * netlify/functions/physics-sufficiency-engine.ts
 *
 * "Can this method physically detect this mechanism?"
 *
 * Deterministic method-mechanism mapping engine.
 * Maps damage mechanisms -> valid methods -> required techniques.
 * Scores inspection sufficiency and identifies physics gaps.
 *
 * 10 actions:
 *   get_registry
 *   check_sufficiency       — given mechanism + methods applied, score coverage
 *   recommend_methods       — given mechanism, return ranked method recommendations
 *   get_method_capability   — what can this method detect?
 *   get_mechanism_methods   — what methods detect this mechanism?
 *   assess_case             — full case sufficiency assessment across all mechanisms
 *   get_physics_gaps        — what's missing for this case?
 *   get_method_registry     — list all NDT methods with physics info
 *   get_mechanism_registry  — list all damage mechanisms
 *   get_technique_requirements — detailed technique params for method+mechanism
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var ENGINE_NAME = "physics-sufficiency-engine";
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

// ── audit helper ──

function auditLog(orgId, actionType, caseId, detail) {
  return supabase.from("physics_audit_events").insert({
    org_id: orgId,
    case_id: caseId || null,
    action_type: actionType,
    event_json: detail
  });
}

// ── sufficiency rating ──

function rateSufficiency(score) {
  if (score >= 90) return "fully_sufficient";
  if (score >= 70) return "adequate";
  if (score >= 50) return "marginal";
  if (score >= 30) return "insufficient";
  return "critically_insufficient";
}

// ── method ranking for a mechanism ──

function rankMethods(mappings) {
  // Sort: primary first, then by confidence, then sufficient_alone
  var sorted = mappings.slice().sort(function(a, b) {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    if (a.is_sufficient_alone && !b.is_sufficient_alone) return -1;
    if (!a.is_sufficient_alone && b.is_sufficient_alone) return 1;
    return b.confidence_rating - a.confidence_rating;
  });
  return sorted;
}

// ── compute sufficiency score ──
// Given a mechanism and the methods applied, compute how well covered the inspection is

function computeSufficiency(mappings, methodsApplied) {
  if (!mappings || mappings.length === 0) return { score: 0, rating: "no_data", details: [] };

  var appliedSet = {};
  for (var i = 0; i < methodsApplied.length; i++) {
    appliedSet[methodsApplied[i]] = true;
  }

  var hasPrimary = false;
  var hasSufficient = false;
  var totalConfidence = 0;
  var maxConfidence = 0;
  var appliedMappings = [];
  var missingMappings = [];

  for (var m = 0; m < mappings.length; m++) {
    var mapping = mappings[m];
    if (appliedSet[mapping.method_key]) {
      appliedMappings.push(mapping);
      if (mapping.is_primary) hasPrimary = true;
      if (mapping.is_sufficient_alone) hasSufficient = true;
      if (mapping.confidence_rating > maxConfidence) maxConfidence = mapping.confidence_rating;
      totalConfidence += mapping.confidence_rating;
    } else {
      missingMappings.push(mapping);
    }
  }

  if (appliedMappings.length === 0) {
    return {
      score: 0,
      rating: "critically_insufficient",
      has_primary: false,
      has_sufficient_alone: false,
      methods_applied: [],
      methods_missing: missingMappings.map(function(mm) {
        return {
          method_key: mm.method_key,
          detection_capability: mm.detection_capability,
          is_primary: mm.is_primary,
          confidence: mm.confidence_rating,
          required_technique: mm.required_technique
        };
      }),
      gaps: ["No applicable methods have been applied for this mechanism"]
    };
  }

  // Scoring algorithm:
  // Base: max single-method confidence * 100
  // Bonus: +10 if primary method used
  // Bonus: +5 if method is sufficient alone
  // Bonus: +5 for each complementary method (up to +15)
  // Cap at 100

  var score = maxConfidence * 100;
  if (hasPrimary) score += 10;
  if (hasSufficient) score += 5;

  var complementaryBonus = Math.min((appliedMappings.length - 1) * 5, 15);
  score += complementaryBonus;

  if (score > 100) score = 100;
  score = round2(score);

  var gaps = [];

  // Check if any primary method is missing
  var primaryMissing = [];
  for (var pm = 0; pm < missingMappings.length; pm++) {
    if (missingMappings[pm].is_primary) {
      primaryMissing.push(missingMappings[pm].method_key);
    }
  }
  if (!hasPrimary && primaryMissing.length > 0) {
    gaps.push("Primary method(s) not applied: " + primaryMissing.join(", "));
  }

  // Check if no sufficient-alone method was used
  if (!hasSufficient) {
    var sufficientOptions = [];
    for (var so = 0; so < mappings.length; so++) {
      if (mappings[so].is_sufficient_alone) sufficientOptions.push(mappings[so].method_key);
    }
    if (sufficientOptions.length > 0) {
      gaps.push("No standalone-sufficient method applied. Options: " + sufficientOptions.join(", "));
    }
  }

  // Check for method-specific warnings
  for (var am = 0; am < appliedMappings.length; am++) {
    var applied = appliedMappings[am];
    if (applied.required_technique === "NOT_SUFFICIENT") {
      gaps.push(applied.method_key + " is NOT SUFFICIENT for " + applied.mechanism_key + ". " + (applied.code_requirement || ""));
    }
    if (applied.detection_capability === "poor" || applied.detection_capability === "screening_only") {
      gaps.push(applied.method_key + " provides only " + applied.detection_capability + " detection for this mechanism");
    }
  }

  return {
    score: score,
    rating: rateSufficiency(score),
    has_primary: hasPrimary,
    has_sufficient_alone: hasSufficient,
    max_confidence: maxConfidence,
    methods_applied: appliedMappings.map(function(am) {
      return {
        method_key: am.method_key,
        detection_capability: am.detection_capability,
        is_primary: am.is_primary,
        is_sufficient_alone: am.is_sufficient_alone,
        confidence: am.confidence_rating,
        required_technique: am.required_technique,
        code_requirement: am.code_requirement
      };
    }),
    methods_missing: missingMappings.map(function(mm) {
      return {
        method_key: mm.method_key,
        detection_capability: mm.detection_capability,
        is_primary: mm.is_primary,
        is_sufficient_alone: mm.is_sufficient_alone,
        confidence: mm.confidence_rating,
        required_technique: mm.required_technique
      };
    }),
    gaps: gaps
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
          "check_sufficiency",
          "recommend_methods",
          "get_method_capability",
          "get_mechanism_methods",
          "assess_case",
          "get_physics_gaps",
          "get_method_registry",
          "get_mechanism_registry",
          "get_technique_requirements"
        ],
        sufficiency_ratings: ["fully_sufficient", "adequate", "marginal", "insufficient", "critically_insufficient"],
        detection_capabilities: ["excellent", "good", "moderate", "poor", "screening_only", "good_surface", "good_screening", "good_external_only", "good_internal", "good_active_only", "excellent_after_strip", "excellent_thickness", "moderate_indicators", "poor_indicators_only", "composition_only"],
        description: "Deterministic physics-based method sufficiency engine. Maps damage mechanisms to valid NDT methods, scores inspection coverage, identifies physics gaps."
      });
    }

    // ── get_method_registry ──
    if (action === "get_method_registry") {
      var methodResult = await supabase.from("physics_method_registry")
        .select("*")
        .eq("active", true)
        .order("method_category", { ascending: true });

      if (methodResult.error) return fail(500, methodResult.error.message);

      var byCategory = {};
      for (var mi = 0; mi < methodResult.data.length; mi++) {
        var meth = methodResult.data[mi];
        var cat = meth.method_category;
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(meth);
      }

      return ok({ methods: methodResult.data, total: methodResult.data.length, by_category: byCategory });
    }

    // ── get_mechanism_registry ──
    if (action === "get_mechanism_registry") {
      var mechResult = await supabase.from("physics_damage_mechanisms")
        .select("*")
        .eq("active", true)
        .order("mechanism_category", { ascending: true });

      if (mechResult.error) return fail(500, mechResult.error.message);

      var byMechCategory = {};
      for (var mci = 0; mci < mechResult.data.length; mci++) {
        var mech = mechResult.data[mci];
        var mcat = mech.mechanism_category;
        if (!byMechCategory[mcat]) byMechCategory[mcat] = [];
        byMechCategory[mcat].push(mech);
      }

      return ok({ mechanisms: mechResult.data, total: mechResult.data.length, by_category: byMechCategory });
    }

    // ── get_method_capability ──
    if (action === "get_method_capability") {
      if (!body.method_key) return fail(400, "method_key required");

      var methodInfo = await supabase.from("physics_method_registry")
        .select("*")
        .eq("method_key", body.method_key)
        .maybeSingle();

      if (methodInfo.error) return fail(500, methodInfo.error.message);
      if (!methodInfo.data) return fail(404, "Method not found: " + body.method_key);

      var methodMappings = await supabase.from("physics_method_mechanism_map")
        .select("*")
        .eq("method_key", body.method_key)
        .eq("active", true)
        .order("confidence_rating", { ascending: false });

      if (methodMappings.error) return fail(500, methodMappings.error.message);

      var canDetect = [];
      var primaryFor = [];
      var sufficientFor = [];

      for (var di = 0; di < methodMappings.data.length; di++) {
        var dm = methodMappings.data[di];
        canDetect.push({
          mechanism_key: dm.mechanism_key,
          detection_capability: dm.detection_capability,
          confidence: dm.confidence_rating,
          is_primary: dm.is_primary,
          is_sufficient_alone: dm.is_sufficient_alone,
          required_technique: dm.required_technique,
          code_requirement: dm.code_requirement
        });
        if (dm.is_primary) primaryFor.push(dm.mechanism_key);
        if (dm.is_sufficient_alone) sufficientFor.push(dm.mechanism_key);
      }

      return ok({
        method: methodInfo.data,
        detects: canDetect,
        total_mechanisms: canDetect.length,
        primary_for: primaryFor,
        sufficient_alone_for: sufficientFor
      });
    }

    // ── get_mechanism_methods ──
    if (action === "get_mechanism_methods") {
      if (!body.mechanism_key) return fail(400, "mechanism_key required");

      var mechInfo = await supabase.from("physics_damage_mechanisms")
        .select("*")
        .eq("mechanism_key", body.mechanism_key)
        .maybeSingle();

      if (mechInfo.error) return fail(500, mechInfo.error.message);
      if (!mechInfo.data) return fail(404, "Mechanism not found: " + body.mechanism_key);

      var mechMappings = await supabase.from("physics_method_mechanism_map")
        .select("*")
        .eq("mechanism_key", body.mechanism_key)
        .eq("active", true);

      if (mechMappings.error) return fail(500, mechMappings.error.message);

      var ranked = rankMethods(mechMappings.data);

      return ok({
        mechanism: mechInfo.data,
        methods: ranked.map(function(r) {
          return {
            method_key: r.method_key,
            detection_capability: r.detection_capability,
            confidence: r.confidence_rating,
            is_primary: r.is_primary,
            is_sufficient_alone: r.is_sufficient_alone,
            complementary_methods: r.complementary_methods,
            required_technique: r.required_technique,
            code_requirement: r.code_requirement,
            limitations: r.limitations_for_mechanism,
            min_detectable_size_mm: r.min_detectable_size_mm
          };
        }),
        total_methods: ranked.length,
        primary_methods: ranked.filter(function(r) { return r.is_primary; }).map(function(r) { return r.method_key; }),
        sufficient_alone: ranked.filter(function(r) { return r.is_sufficient_alone; }).map(function(r) { return r.method_key; })
      });
    }

    // ── check_sufficiency ──
    if (action === "check_sufficiency") {
      if (!body.mechanism_key) return fail(400, "mechanism_key required");
      if (!body.methods_applied || !Array.isArray(body.methods_applied)) {
        return fail(400, "methods_applied array required");
      }

      var mappings = await supabase.from("physics_method_mechanism_map")
        .select("*")
        .eq("mechanism_key", body.mechanism_key)
        .eq("active", true);

      if (mappings.error) return fail(500, mappings.error.message);

      var result = computeSufficiency(mappings.data, body.methods_applied);

      // Get mechanism info for context
      var mechDetail = await supabase.from("physics_damage_mechanisms")
        .select("mechanism_name, flaw_type, severity_if_missed")
        .eq("mechanism_key", body.mechanism_key)
        .maybeSingle();

      return ok({
        mechanism_key: body.mechanism_key,
        mechanism_name: mechDetail.data ? mechDetail.data.mechanism_name : body.mechanism_key,
        flaw_type: mechDetail.data ? mechDetail.data.flaw_type : "unknown",
        severity_if_missed: mechDetail.data ? mechDetail.data.severity_if_missed : "unknown",
        methods_applied: body.methods_applied,
        sufficiency: result
      });
    }

    // ── recommend_methods ──
    if (action === "recommend_methods") {
      if (!body.mechanism_key) return fail(400, "mechanism_key required");

      var mappings = await supabase.from("physics_method_mechanism_map")
        .select("*")
        .eq("mechanism_key", body.mechanism_key)
        .eq("active", true);

      if (mappings.error) return fail(500, mappings.error.message);
      if (!mappings.data || mappings.data.length === 0) {
        return fail(404, "No method mappings found for mechanism: " + body.mechanism_key);
      }

      var ranked = rankMethods(mappings.data);

      // Get method details for enrichment
      var methodKeys = [];
      for (var rk = 0; rk < ranked.length; rk++) {
        methodKeys.push(ranked[rk].method_key);
      }

      var methodDetails = await supabase.from("physics_method_registry")
        .select("method_key, method_name, method_category, physics_principle, cost_tier, skill_level_required, field_portable")
        .in("method_key", methodKeys);

      var methodMap = {};
      if (methodDetails.data) {
        for (var md = 0; md < methodDetails.data.length; md++) {
          methodMap[methodDetails.data[md].method_key] = methodDetails.data[md];
        }
      }

      // Constraints filtering
      var constraints = body.constraints || {};
      var filtered = ranked;

      if (constraints.field_portable_only) {
        filtered = filtered.filter(function(r) {
          var info = methodMap[r.method_key];
          return info && info.field_portable;
        });
      }
      if (constraints.max_cost_tier) {
        var tierOrder = { low: 1, medium: 2, high: 3 };
        var maxTier = tierOrder[constraints.max_cost_tier] || 3;
        filtered = filtered.filter(function(r) {
          var info = methodMap[r.method_key];
          return info && (tierOrder[info.cost_tier] || 3) <= maxTier;
        });
      }
      if (constraints.max_skill_level) {
        var skillOrder = { level_i: 1, level_ii: 2, level_iii: 3 };
        var maxSkill = skillOrder[constraints.max_skill_level] || 3;
        filtered = filtered.filter(function(r) {
          var info = methodMap[r.method_key];
          return info && (skillOrder[info.skill_level_required] || 3) <= maxSkill;
        });
      }

      // Build recommendation with strategy
      var primary = [];
      var complementary = [];
      var screening = [];

      for (var fi = 0; fi < filtered.length; fi++) {
        var f = filtered[fi];
        var info = methodMap[f.method_key] || {};
        var rec = {
          method_key: f.method_key,
          method_name: info.method_name || f.method_key,
          detection_capability: f.detection_capability,
          confidence: f.confidence_rating,
          is_primary: f.is_primary,
          is_sufficient_alone: f.is_sufficient_alone,
          required_technique: f.required_technique,
          code_requirement: f.code_requirement,
          cost_tier: info.cost_tier || "unknown",
          skill_level: info.skill_level_required || "unknown",
          field_portable: info.field_portable !== undefined ? info.field_portable : true,
          complementary_methods: f.complementary_methods
        };

        if (f.is_primary) primary.push(rec);
        else if (f.detection_capability === "screening_only" || f.detection_capability === "good_screening") screening.push(rec);
        else complementary.push(rec);
      }

      return ok({
        mechanism_key: body.mechanism_key,
        strategy: {
          primary_methods: primary,
          complementary_methods: complementary,
          screening_methods: screening,
          recommended_approach: primary.length > 0
            ? "Use " + primary[0].method_key + " as primary" + (complementary.length > 0 ? ", supplement with " + complementary[0].method_key : "")
            : "No primary method available with given constraints"
        },
        all_options: filtered.map(function(f) {
          var info = methodMap[f.method_key] || {};
          return {
            method_key: f.method_key,
            method_name: info.method_name || f.method_key,
            detection_capability: f.detection_capability,
            confidence: f.confidence_rating,
            is_primary: f.is_primary,
            required_technique: f.required_technique,
            code_requirement: f.code_requirement
          };
        }),
        total_options: filtered.length
      });
    }

    // ── assess_case ──
    if (action === "assess_case") {
      var orgId = body.org_id || getOrg(event);
      if (!orgId) return fail(400, "org_id required");
      if (!body.case_id) return fail(400, "case_id required");
      if (!body.mechanisms || !Array.isArray(body.mechanisms)) return fail(400, "mechanisms array required");
      if (!body.methods_applied || !Array.isArray(body.methods_applied)) return fail(400, "methods_applied array required");

      var assessments = [];
      var overallScore = 0;
      var allGaps = [];
      var criticalGaps = [];

      for (var ai = 0; ai < body.mechanisms.length; ai++) {
        var mechKey = body.mechanisms[ai];

        var mappings = await supabase.from("physics_method_mechanism_map")
          .select("*")
          .eq("mechanism_key", mechKey)
          .eq("active", true);

        if (mappings.error) continue;

        var result = computeSufficiency(mappings.data, body.methods_applied);

        // Get mechanism severity
        var mechSev = await supabase.from("physics_damage_mechanisms")
          .select("mechanism_name, severity_if_missed, flaw_type")
          .eq("mechanism_key", mechKey)
          .maybeSingle();

        var severity = mechSev.data ? mechSev.data.severity_if_missed : "medium";
        var mechName = mechSev.data ? mechSev.data.mechanism_name : mechKey;

        // Weight score by severity
        var severityWeight = 1.0;
        if (severity === "critical") severityWeight = 1.5;
        else if (severity === "high") severityWeight = 1.2;
        else if (severity === "medium") severityWeight = 1.0;
        else severityWeight = 0.8;

        overallScore += result.score * severityWeight;

        var assessment = {
          mechanism_key: mechKey,
          mechanism_name: mechName,
          severity_if_missed: severity,
          sufficiency_score: result.score,
          sufficiency_rating: result.rating,
          has_primary: result.has_primary,
          has_sufficient_alone: result.has_sufficient_alone,
          gaps: result.gaps,
          methods_applied: result.methods_applied,
          methods_missing: result.methods_missing
        };

        assessments.push(assessment);

        for (var gi = 0; gi < result.gaps.length; gi++) {
          allGaps.push({ mechanism: mechKey, gap: result.gaps[gi] });
          if (severity === "critical" || severity === "high") {
            criticalGaps.push({ mechanism: mechKey, mechanism_name: mechName, severity: severity, gap: result.gaps[gi] });
          }
        }

        // Store assessment
        await supabase.from("physics_sufficiency_assessments").insert({
          org_id: orgId,
          case_id: body.case_id,
          mechanism_key: mechKey,
          methods_applied: body.methods_applied,
          methods_required: result.methods_applied ? result.methods_applied.map(function(ma) { return ma.method_key; }) : [],
          methods_missing: result.methods_missing ? result.methods_missing.map(function(mm) { return mm.method_key; }) : [],
          sufficiency_score: result.score,
          sufficiency_rating: result.rating,
          gaps: result.gaps,
          recommendations: result.methods_missing ? result.methods_missing.filter(function(mm) { return mm.is_primary; }).map(function(mm) { return "Add " + mm.method_key + " (" + mm.detection_capability + ", confidence " + mm.confidence + ")"; }) : [],
          assessment_json: assessment,
          engine_version: ENGINE_VERSION
        });
      }

      // Overall score is average weighted by severity
      var totalWeight = 0;
      for (var wi = 0; wi < body.mechanisms.length; wi++) {
        totalWeight += 1; // simplified — weight already applied in loop
      }
      var overallAvg = totalWeight > 0 ? round2(overallScore / body.mechanisms.length) : 0;
      if (overallAvg > 100) overallAvg = 100;

      var overallRating = rateSufficiency(overallAvg);

      await auditLog(orgId, "case_assessed", body.case_id, {
        mechanisms_assessed: body.mechanisms.length,
        methods_applied: body.methods_applied,
        overall_score: overallAvg,
        overall_rating: overallRating,
        critical_gaps: criticalGaps.length,
        total_gaps: allGaps.length
      });

      return ok({
        case_id: body.case_id,
        overall_sufficiency: {
          score: overallAvg,
          rating: overallRating,
          mechanisms_assessed: assessments.length,
          methods_applied: body.methods_applied,
          total_gaps: allGaps.length,
          critical_gaps: criticalGaps.length
        },
        assessments: assessments,
        critical_gaps: criticalGaps,
        all_gaps: allGaps,
        verdict: overallAvg >= 90
          ? "SUFFICIENT: Inspection program provides comprehensive physics coverage for all identified mechanisms."
          : overallAvg >= 70
          ? "ADEQUATE: Inspection program covers primary detection needs but has minor gaps. Review recommendations."
          : overallAvg >= 50
          ? "MARGINAL: Significant physics gaps exist. Key mechanisms may not be adequately detected. Action required."
          : overallAvg >= 30
          ? "INSUFFICIENT: Critical detection gaps. Current methods cannot reliably detect identified mechanisms. Immediate action required."
          : "CRITICALLY INSUFFICIENT: Inspection program does not address identified damage mechanisms. STOP and redesign inspection plan."
      });
    }

    // ── get_physics_gaps ──
    if (action === "get_physics_gaps") {
      var orgId = body.org_id || getOrg(event);
      if (!orgId) return fail(400, "org_id required");
      if (!body.case_id) return fail(400, "case_id required");

      var gapResult = await supabase.from("physics_sufficiency_assessments")
        .select("*")
        .eq("org_id", orgId)
        .eq("case_id", body.case_id)
        .order("computed_at", { ascending: false });

      if (gapResult.error) return fail(500, gapResult.error.message);

      // Deduplicate to latest per mechanism
      var mechMap = {};
      for (var gi = 0; gi < gapResult.data.length; gi++) {
        var g = gapResult.data[gi];
        if (!mechMap[g.mechanism_key]) mechMap[g.mechanism_key] = g;
      }

      var gapList = [];
      var addItems = [];
      var totalScore = 0;
      var count = 0;

      for (var mk in mechMap) {
        var assess = mechMap[mk];
        totalScore += assess.sufficiency_score;
        count++;

        if (assess.gaps && assess.gaps.length > 0) {
          for (var gj = 0; gj < assess.gaps.length; gj++) {
            gapList.push({
              mechanism: mk,
              rating: assess.sufficiency_rating,
              score: assess.sufficiency_score,
              gap: assess.gaps[gj]
            });
          }
        }

        if (assess.recommendations && assess.recommendations.length > 0) {
          for (var rj = 0; rj < assess.recommendations.length; rj++) {
            addItems.push({
              mechanism: mk,
              action: assess.recommendations[rj],
              priority: assess.sufficiency_score < 50 ? "high" : "medium"
            });
          }
        }
      }

      return ok({
        case_id: body.case_id,
        overall_score: count > 0 ? round2(totalScore / count) : 0,
        mechanisms_assessed: count,
        gaps: gapList,
        add_items: addItems,
        total_gaps: gapList.length,
        total_add_items: addItems.length
      });
    }

    // ── get_technique_requirements ──
    if (action === "get_technique_requirements") {
      if (!body.method_key) return fail(400, "method_key required");
      if (!body.mechanism_key) return fail(400, "mechanism_key required");

      var techResult = await supabase.from("physics_technique_requirements")
        .select("*")
        .eq("method_key", body.method_key)
        .eq("mechanism_key", body.mechanism_key)
        .eq("active", true);

      if (techResult.error) return fail(500, techResult.error.message);

      // Also get the mapping for context
      var mapResult = await supabase.from("physics_method_mechanism_map")
        .select("*")
        .eq("method_key", body.method_key)
        .eq("mechanism_key", body.mechanism_key)
        .eq("active", true)
        .maybeSingle();

      return ok({
        method_key: body.method_key,
        mechanism_key: body.mechanism_key,
        mapping: mapResult.data || null,
        technique_requirements: techResult.data,
        total: techResult.data.length
      });
    }

    return fail(400, "Unknown action: " + action + ". Valid actions: get_registry, check_sufficiency, recommend_methods, get_method_capability, get_mechanism_methods, assess_case, get_physics_gaps, get_method_registry, get_mechanism_registry, get_technique_requirements");

  } catch (err) {
    return fail(500, String(err && err.message ? err.message : err));
  }
};
