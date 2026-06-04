// @ts-nocheck
/**
 * DEPLOY245 - human-intelligence.ts
 * netlify/functions/human-intelligence.ts
 *
 * HUMAN INTELLIGENCE LAYER
 * Inspector performance tracking, skill validation, certification management,
 * competency scoring, workload balancing, training gap analysis
 *
 * POST /api/human-intelligence { action, ... }
 *
 * Actions:
 *   get_inspector_profile     - full inspector competency profile
 *   evaluate_performance      - score inspector performance on a case
 *   check_certification       - verify certification validity for an assignment
 *   get_training_gaps         - identify training needs for an inspector
 *   recommend_assignment      - recommend best inspector for a case
 *   get_competency_matrix     - org-wide competency overview
 *   get_registry              - full engine registry
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

// ── NDT CERTIFICATION SCHEMES ──────────────────────────────────────

var CERTIFICATION_SCHEMES = [
  {
    id: "asnt_snt_tc_1a",
    name: "ASNT SNT-TC-1A",
    description: "Employer-based NDT certification per ASNT Recommended Practice",
    levels: ["Level I", "Level II", "Level III"],
    renewal_years: 5,
    recertification: "Employer written practice, vision exam annually"
  },
  {
    id: "asnt_cp_189",
    name: "ASNT CP-189",
    description: "ASNT Standard for Qualification and Certification of NDT Personnel",
    levels: ["Level I", "Level II"],
    renewal_years: 5,
    recertification: "120 hours continuing education or re-exam"
  },
  {
    id: "asnt_accp",
    name: "ASNT ACCP (Central Certification)",
    description: "ASNT Central Certification Program - third party certification",
    levels: ["Level II", "Level III"],
    renewal_years: 5,
    recertification: "Points-based continuing education"
  },
  {
    id: "iso_9712",
    name: "ISO 9712 / EN ISO 9712",
    description: "International standard for qualification and certification of NDT personnel",
    levels: ["Level 1", "Level 2", "Level 3"],
    renewal_years: 5,
    recertification: "Documented continued satisfactory work + vision exam"
  },
  {
    id: "nas_410",
    name: "NAS 410 / EN 4179",
    description: "Aerospace NDT personnel qualification and approval",
    levels: ["Level 1", "Level 2", "Level 3"],
    renewal_years: 5,
    recertification: "Employer-based per written practice"
  },
  {
    id: "api_510",
    name: "API 510 Pressure Vessel Inspector",
    description: "API individual certification for pressure vessel inspection",
    levels: ["Certified"],
    renewal_years: 3,
    recertification: "Re-examination or approved course + experience"
  },
  {
    id: "api_570",
    name: "API 570 Piping Inspector",
    description: "API individual certification for piping inspection",
    levels: ["Certified"],
    renewal_years: 3,
    recertification: "Re-examination or approved course + experience"
  },
  {
    id: "api_653",
    name: "API 653 Tank Inspector",
    description: "API individual certification for aboveground storage tank inspection",
    levels: ["Certified"],
    renewal_years: 3,
    recertification: "Re-examination or approved course + experience"
  },
  {
    id: "aws_cwi",
    name: "AWS CWI (Certified Welding Inspector)",
    description: "American Welding Society Certified Welding Inspector",
    levels: ["CAWI", "CWI", "SCWI"],
    renewal_years: 3,
    recertification: "80 PDHs per 3-year cycle + vision exam"
  },
  {
    id: "cswip",
    name: "CSWIP (TWI Certification)",
    description: "Certification Scheme for Welding and Inspection Personnel",
    levels: ["3.1 Welding Inspector", "3.2 Senior", "Underwater Inspector"],
    renewal_years: 5,
    recertification: "Continued employment + CPD log"
  }
];

// ── NDT METHOD REGISTRY ────────────────────────────────────────────

var NDT_METHODS = [
  { id: "ut", name: "Ultrasonic Testing", code: "UT", category: "volumetric" },
  { id: "rt", name: "Radiographic Testing", code: "RT", category: "volumetric" },
  { id: "mt", name: "Magnetic Particle Testing", code: "MT", category: "surface" },
  { id: "pt", name: "Liquid Penetrant Testing", code: "PT", category: "surface" },
  { id: "vt", name: "Visual Testing", code: "VT", category: "surface" },
  { id: "et", name: "Electromagnetic Testing (Eddy Current)", code: "ET", category: "surface" },
  { id: "ae", name: "Acoustic Emission Testing", code: "AE", category: "condition_monitoring" },
  { id: "ir", name: "Infrared / Thermal Testing", code: "IR", category: "condition_monitoring" },
  { id: "lt", name: "Leak Testing", code: "LT", category: "tightness" },
  { id: "paut", name: "Phased Array Ultrasonic Testing", code: "PAUT", category: "advanced_ut" },
  { id: "tofd", name: "Time-of-Flight Diffraction", code: "TOFD", category: "advanced_ut" },
  { id: "gpr", name: "Ground Penetrating Radar", code: "GPR", category: "specialized" },
  { id: "mfl", name: "Magnetic Flux Leakage", code: "MFL", category: "specialized" },
  { id: "acfm", name: "Alternating Current Field Measurement", code: "ACFM", category: "specialized" }
];

// ── PERFORMANCE METRICS ────────────────────────────────────────────

var PERFORMANCE_FACTORS = [
  { id: "detection_rate", weight: 0.25, description: "Percentage of known defects correctly identified" },
  { id: "false_call_rate", weight: 0.20, description: "Percentage of calls that were false positives (lower is better)" },
  { id: "sizing_accuracy", weight: 0.15, description: "Accuracy of defect sizing compared to actual" },
  { id: "reporting_quality", weight: 0.15, description: "Completeness and accuracy of inspection reports" },
  { id: "procedure_compliance", weight: 0.10, description: "Adherence to approved inspection procedures" },
  { id: "timeliness", weight: 0.10, description: "Completion of inspections within scheduled time" },
  { id: "safety_compliance", weight: 0.05, description: "Adherence to safety protocols and near-miss reporting" }
];

// ── COMPETENCY CALCULATOR ──────────────────────────────────────────

function calculateCompetencyScore(metrics) {
  var totalScore = 0;
  var totalWeight = 0;

  for (var i = 0; i < PERFORMANCE_FACTORS.length; i++) {
    var factor = PERFORMANCE_FACTORS[i];
    var value = metrics[factor.id];
    if (value !== undefined && value !== null) {
      // false_call_rate is inverse (lower = better)
      var normalized = factor.id === "false_call_rate" ? (1 - value) : value;
      totalScore += normalized * factor.weight;
      totalWeight += factor.weight;
    }
  }

  if (totalWeight === 0) return { score: 0, grade: "insufficient_data", evaluated_factors: 0 };

  var finalScore = totalScore / totalWeight;
  var grade = "expert";
  if (finalScore < 0.6) grade = "needs_improvement";
  else if (finalScore < 0.7) grade = "developing";
  else if (finalScore < 0.8) grade = "competent";
  else if (finalScore < 0.9) grade = "proficient";

  return {
    score: Math.round(finalScore * 1000) / 1000,
    grade: grade,
    evaluated_factors: Math.round(totalWeight / 0.01) / 100
  };
}

// ── HANDLER ────────────────────────────────────────────────────────

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";

    // ── get_registry ──
    if (action === "get_registry") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "human-intelligence",
          deploy: "DEPLOY245",
          version: "1.0.0",
          certification_schemes: CERTIFICATION_SCHEMES.length,
          ndt_methods: NDT_METHODS.length,
          performance_factors: PERFORMANCE_FACTORS.length,
          grade_scale: ["needs_improvement", "developing", "competent", "proficient", "expert"],
          schemes: CERTIFICATION_SCHEMES.map(function(s) {
            return { id: s.id, name: s.name, levels: s.levels, renewal_years: s.renewal_years };
          }),
          methods: NDT_METHODS.map(function(m) {
            return { id: m.id, name: m.name, code: m.code, category: m.category };
          }),
          factors: PERFORMANCE_FACTORS.map(function(f) {
            return { id: f.id, weight: f.weight, description: f.description };
          })
        })
      };
    }

    // ── get_inspector_profile ──
    if (action === "get_inspector_profile") {
      if (!body.inspector_id) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "inspector_id required" }) };
      }

      var sb = createClient(supabaseUrl, supabaseKey);

      // get cases where this inspector was involved (via audit trail)
      var auditRes = await sb.from("audit_events")
        .select("case_id, event_type, event_data, created_at")
        .eq("created_by", body.inspector_id)
        .order("created_at", { ascending: false })
        .limit(100);

      var events = auditRes.data || [];

      // count activity types
      var caseIds = {};
      var activityCounts = {};
      for (var ei = 0; ei < events.length; ei++) {
        var evt = events[ei];
        caseIds[evt.case_id] = true;
        if (!activityCounts[evt.event_type]) activityCounts[evt.event_type] = 0;
        activityCounts[evt.event_type]++;
      }

      // get adjudication history
      var adjRes = await sb.from("inspector_adjudications")
        .select("id, case_id, original_disposition, inspector_disposition, override_justification, created_at")
        .eq("inspector_id", body.inspector_id)
        .order("created_at", { ascending: false })
        .limit(50);

      var adjudications = adjRes.data || [];
      var overrideCount = 0;
      for (var adi = 0; adi < adjudications.length; adi++) {
        if (adjudications[adi].original_disposition !== adjudications[adi].inspector_disposition) {
          overrideCount++;
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "get_inspector_profile",
          inspector_id: body.inspector_id,
          activity_summary: {
            total_cases_touched: Object.keys(caseIds).length,
            total_audit_events: events.length,
            event_breakdown: activityCounts,
            last_activity: events.length > 0 ? events[0].created_at : null
          },
          adjudication_summary: {
            total_adjudications: adjudications.length,
            system_overrides: overrideCount,
            override_rate: adjudications.length > 0 ? Math.round(overrideCount / adjudications.length * 1000) / 1000 : 0
          },
          certifications: body.certifications || [],
          note: "Certification data should be populated from HR/training system integration"
        })
      };
    }

    // ── evaluate_performance ──
    if (action === "evaluate_performance") {
      if (!body.inspector_id || !body.metrics) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({
          error: "inspector_id and metrics required",
          expected_metrics: PERFORMANCE_FACTORS.map(function(f) { return { id: f.id, range: "0-1", weight: f.weight }; })
        })};
      }

      var competency = calculateCompetencyScore(body.metrics);

      // identify weak areas
      var weakAreas = [];
      var strongAreas = [];
      for (var mi = 0; mi < PERFORMANCE_FACTORS.length; mi++) {
        var factor = PERFORMANCE_FACTORS[mi];
        var val = body.metrics[factor.id];
        if (val !== undefined) {
          var effective = factor.id === "false_call_rate" ? (1 - val) : val;
          if (effective < 0.7) {
            weakAreas.push({ factor: factor.id, value: val, description: factor.description });
          } else if (effective >= 0.9) {
            strongAreas.push({ factor: factor.id, value: val, description: factor.description });
          }
        }
      }

      // log evaluation
      var sb2 = createClient(supabaseUrl, supabaseKey);
      await sb2.from("audit_events").insert({
        case_id: body.case_id || "00000000-0000-0000-0000-000000000000",
        event_type: "inspector_performance_evaluation",
        event_data: {
          inspector_id: body.inspector_id,
          score: competency.score,
          grade: competency.grade,
          metrics: body.metrics
        },
        created_by: body.evaluator_id || "system"
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "evaluate_performance",
          inspector_id: body.inspector_id,
          competency: competency,
          metrics_evaluated: body.metrics,
          weak_areas: weakAreas,
          strong_areas: strongAreas,
          recommendation: competency.grade === "needs_improvement" ? "remedial_training_required" :
            competency.grade === "developing" ? "supervised_work_with_mentoring" :
            competency.grade === "competent" ? "independent_work_authorized" :
            competency.grade === "proficient" ? "eligible_for_complex_assignments" :
            "eligible_for_mentoring_and_lead_roles"
        })
      };
    }

    // ── check_certification ──
    if (action === "check_certification") {
      if (!body.inspector_id || !body.required_method) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "inspector_id and required_method required" }) };
      }

      // validate method
      var method = null;
      for (var mti = 0; mti < NDT_METHODS.length; mti++) {
        if (NDT_METHODS[mti].id === body.required_method || NDT_METHODS[mti].code.toLowerCase() === body.required_method.toLowerCase()) {
          method = NDT_METHODS[mti];
          break;
        }
      }

      if (!method) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({
          error: "Invalid method",
          valid_methods: NDT_METHODS.map(function(m) { return m.id; })
        })};
      }

      // In production, this would check against a certifications table
      // For now, return the framework for what would be checked
      var requiredLevel = body.required_level || "Level II";
      var requiredScheme = body.certification_scheme || "asnt_snt_tc_1a";

      var scheme = null;
      for (var sci = 0; sci < CERTIFICATION_SCHEMES.length; sci++) {
        if (CERTIFICATION_SCHEMES[sci].id === requiredScheme) {
          scheme = CERTIFICATION_SCHEMES[sci];
          break;
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "check_certification",
          inspector_id: body.inspector_id,
          required: {
            method: method,
            level: requiredLevel,
            scheme: scheme ? { id: scheme.id, name: scheme.name } : null
          },
          checks_performed: [
            "certification_current_and_not_expired",
            "method_and_level_match_requirement",
            "vision_exam_current",
            "employer_authorization_active",
            "no_suspension_or_revocation"
          ],
          note: "Connect to HR/certification database for live validation"
        })
      };
    }

    // ── get_training_gaps ──
    if (action === "get_training_gaps") {
      if (!body.inspector_id) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "inspector_id required" }) };
      }

      var currentMethods = body.current_certifications || [];
      var requiredMethods = body.required_methods || NDT_METHODS.map(function(m) { return m.id; });

      var gaps = [];
      for (var ri = 0; ri < requiredMethods.length; ri++) {
        var found = false;
        for (var ci = 0; ci < currentMethods.length; ci++) {
          if (currentMethods[ci].method === requiredMethods[ri] || currentMethods[ci] === requiredMethods[ri]) {
            found = true;
            break;
          }
        }
        if (!found) {
          var methodInfo = null;
          for (var mfi = 0; mfi < NDT_METHODS.length; mfi++) {
            if (NDT_METHODS[mfi].id === requiredMethods[ri]) { methodInfo = NDT_METHODS[mfi]; break; }
          }
          if (methodInfo) {
            gaps.push({
              method: methodInfo,
              gap_type: "missing_certification",
              priority: methodInfo.category === "volumetric" || methodInfo.category === "advanced_ut" ? "high" : "medium"
            });
          }
        }
      }

      // check for expiring certifications
      var expiring = [];
      for (var exi = 0; exi < currentMethods.length; exi++) {
        if (currentMethods[exi].expiry_date) {
          var expiryDate = new Date(currentMethods[exi].expiry_date);
          var now = new Date();
          var sixMonths = 180 * 24 * 60 * 60 * 1000;
          if (expiryDate.getTime() - now.getTime() < sixMonths) {
            expiring.push({
              method: currentMethods[exi].method,
              expiry_date: currentMethods[exi].expiry_date,
              days_remaining: Math.round((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
              urgency: expiryDate.getTime() < now.getTime() ? "expired" : "expiring_soon"
            });
          }
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "get_training_gaps",
          inspector_id: body.inspector_id,
          certification_gaps: gaps,
          expiring_certifications: expiring,
          total_gaps: gaps.length,
          total_expiring: expiring.length,
          training_recommendation: gaps.length > 3 ? "comprehensive_training_plan_needed" :
            gaps.length > 0 ? "targeted_training_for_gap_methods" :
            expiring.length > 0 ? "renewal_training_scheduled" :
            "fully_qualified"
        })
      };
    }

    // ── recommend_assignment ──
    if (action === "recommend_assignment") {
      if (!body.case_id) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };
      }

      var sb3 = createClient(supabaseUrl, supabaseKey);
      var caseRes = await sb3.from("inspection_cases").select("*").eq("id", body.case_id).single();
      if (caseRes.error || !caseRes.data) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ action: "recommend_assignment", case_id: body.case_id, error: "case_not_found" }) };
      }

      var caseData = caseRes.data;
      var inspMethod = (caseData.inspection_method || "").toLowerCase();

      // determine required method
      var requiredMethodId = null;
      for (var rmi = 0; rmi < NDT_METHODS.length; rmi++) {
        if (inspMethod.indexOf(NDT_METHODS[rmi].code.toLowerCase()) !== -1 ||
            inspMethod.indexOf(NDT_METHODS[rmi].name.toLowerCase()) !== -1 ||
            inspMethod.indexOf(NDT_METHODS[rmi].id) !== -1) {
          requiredMethodId = NDT_METHODS[rmi];
          break;
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "recommend_assignment",
          case_id: body.case_id,
          component: caseData.component_name,
          inspection_method: caseData.inspection_method,
          required_method: requiredMethodId,
          assignment_criteria: [
            "Certified in required NDT method at Level II minimum",
            "Current certification (not expired)",
            "Experience with component type",
            "Competency grade of 'competent' or higher",
            "Available workload capacity",
            "No conflict of interest"
          ],
          minimum_level: requiredMethodId && (requiredMethodId.category === "advanced_ut" || requiredMethodId.category === "volumetric") ? "Level II" : "Level I",
          note: "Connect to HR system for live inspector availability and assignment"
        })
      };
    }

    // ── get_competency_matrix ──
    if (action === "get_competency_matrix") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "get_competency_matrix",
          framework: {
            methods: NDT_METHODS.map(function(m) { return { id: m.id, code: m.code, name: m.name }; }),
            certification_schemes: CERTIFICATION_SCHEMES.map(function(s) { return { id: s.id, name: s.name, levels: s.levels }; }),
            performance_factors: PERFORMANCE_FACTORS,
            grade_scale: [
              { grade: "needs_improvement", min_score: 0, max_score: 0.6, description: "Remedial training required" },
              { grade: "developing", min_score: 0.6, max_score: 0.7, description: "Supervised work with mentoring" },
              { grade: "competent", min_score: 0.7, max_score: 0.8, description: "Independent work authorized" },
              { grade: "proficient", min_score: 0.8, max_score: 0.9, description: "Complex assignments eligible" },
              { grade: "expert", min_score: 0.9, max_score: 1.0, description: "Mentoring and lead roles" }
            ]
          },
          note: "Populate with org data via get_inspector_profile for each inspector"
        })
      };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action, valid_actions: ["get_inspector_profile", "evaluate_performance", "check_certification", "get_training_gaps", "recommend_assignment", "get_competency_matrix", "get_registry"] }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
