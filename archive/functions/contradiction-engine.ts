// @ts-nocheck
/**
 * DEPLOY262 - contradiction-engine.ts
 * netlify/functions/contradiction-engine.ts
 *
 * CONTRADICTION ENGINE v1.0.0
 * "Student says no cracks — photo shows linear indication at crater."
 *
 * Catches gaps between what the person CLAIMS and what the EVIDENCE shows.
 * Highest-impact teaching engine: forces honest observation before disposition.
 *
 * 10 actions:
 *   get_registry              — engine overview
 *   check_contradictions      — run full contradiction check on an assessment
 *   get_rules                 — list all contradiction rules with filtering
 *   get_detected              — get contradictions detected for an assessment
 *   resolve_contradiction     — mark a contradiction as resolved with action
 *   get_integrity_score       — get the integrity score for an assessment
 *   get_assessment_summary    — full contradiction assessment summary
 *   override_contradiction    — override with justification (instructor/CWI only)
 *   get_teaching_response     — get teaching content for a specific contradiction
 *   get_contradiction_stats   — aggregate stats across assessments
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

function ok(body) {
  return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(body) };
}
function err(code, msg) {
  return { statusCode: code, headers: corsHeaders, body: JSON.stringify({ error: msg }) };
}

// ============================================================
// Contradiction Detection Engine
// Runs all applicable rules against the provided evidence
// ============================================================
function detectContradictions(rules, input) {
  var found = [];
  var checksRun = 0;

  var claims = input.claims || {};
  var measurements = input.measurements || {};
  var findings = input.findings || [];
  var disposition = input.disposition || "";
  var wpsParams = input.wps_parameters || {};
  var processType = input.process_type || "";
  var position = input.position || "";
  var material = input.material || "";
  var aiDetections = input.ai_detections || [];
  var evidenceScore = input.evidence_sufficiency_score || 100;
  var priorAssessments = input.prior_assessments || [];

  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i];
    if (!rule.is_active) continue;

    // Check domain applicability
    var domainMatch = false;
    var domain = input.domain || "welding";
    if (rule.applies_to) {
      for (var d = 0; d < rule.applies_to.length; d++) {
        if (rule.applies_to[d] === domain || rule.applies_to[d] === "general") {
          domainMatch = true;
          break;
        }
      }
    }
    if (!domainMatch) continue;

    checksRun++;
    var contradiction = null;

    // ---- CLAIM VS IMAGE ----
    if (rule.rule_code === "CVE-001") {
      // Claims no cracks but AI detected linear indication
      var claimNoCracks = true;
      for (var f = 0; f < findings.length; f++) {
        if (findings[f].type && findings[f].type.indexOf("crack") >= 0) {
          claimNoCracks = false;
          break;
        }
      }
      if (claimNoCracks && claims.no_cracks === true) {
        var aiFoundCrack = false;
        for (var a = 0; a < aiDetections.length; a++) {
          var det = aiDetections[a].type || aiDetections[a].indication || "";
          if (det.indexOf("crack") >= 0 || det.indexOf("linear") >= 0) {
            aiFoundCrack = true;
            break;
          }
        }
        if (aiFoundCrack) {
          contradiction = {
            claim_field: "findings.cracks",
            claim_value: "No cracks reported",
            evidence_field: "ai_detection",
            evidence_value: "Linear indication detected in image"
          };
        }
      }
    }

    if (rule.rule_code === "CVE-002") {
      var claimNoPorosity = true;
      for (var f2 = 0; f2 < findings.length; f2++) {
        if (findings[f2].type && findings[f2].type.indexOf("porosity") >= 0) {
          claimNoPorosity = false;
          break;
        }
      }
      if (claimNoPorosity && claims.no_porosity === true) {
        var aiFoundPorosity = false;
        for (var a2 = 0; a2 < aiDetections.length; a2++) {
          var det2 = aiDetections[a2].type || aiDetections[a2].indication || "";
          if (det2.indexOf("porosity") >= 0 || det2.indexOf("rounded") >= 0 || det2.indexOf("gas") >= 0) {
            aiFoundPorosity = true;
            break;
          }
        }
        if (aiFoundPorosity) {
          contradiction = {
            claim_field: "findings.porosity",
            claim_value: "No porosity reported",
            evidence_field: "ai_detection",
            evidence_value: "Rounded indications detected in image"
          };
        }
      }
    }

    if (rule.rule_code === "CVE-003") {
      var claimNoUndercut = true;
      for (var f3 = 0; f3 < findings.length; f3++) {
        if (findings[f3].type && findings[f3].type.indexOf("undercut") >= 0) {
          claimNoUndercut = false;
          break;
        }
      }
      if (claimNoUndercut && claims.no_undercut === true) {
        var aiFoundUndercut = false;
        for (var a3 = 0; a3 < aiDetections.length; a3++) {
          var det3 = aiDetections[a3].type || aiDetections[a3].indication || "";
          if (det3.indexOf("undercut") >= 0 || det3.indexOf("groove") >= 0 || det3.indexOf("toe") >= 0) {
            aiFoundUndercut = true;
            break;
          }
        }
        if (aiFoundUndercut) {
          contradiction = {
            claim_field: "findings.undercut",
            claim_value: "No undercut reported",
            evidence_field: "ai_detection",
            evidence_value: "Groove/notch detected at weld toe"
          };
        }
      }
    }

    if (rule.rule_code === "CVE-004") {
      var claimNoIF = true;
      for (var f4 = 0; f4 < findings.length; f4++) {
        if (findings[f4].type && (findings[f4].type.indexOf("incomplete_fusion") >= 0 || findings[f4].type.indexOf("cold_lap") >= 0)) {
          claimNoIF = false;
          break;
        }
      }
      if (claimNoIF && claims.no_incomplete_fusion === true) {
        var aiFoundIF = false;
        for (var a4 = 0; a4 < aiDetections.length; a4++) {
          var det4 = aiDetections[a4].type || aiDetections[a4].indication || "";
          if (det4.indexOf("fusion") >= 0 || det4.indexOf("cold_lap") >= 0 || det4.indexOf("overlap") >= 0) {
            aiFoundIF = true;
            break;
          }
        }
        if (aiFoundIF) {
          contradiction = {
            claim_field: "findings.incomplete_fusion",
            claim_value: "No incomplete fusion reported",
            evidence_field: "ai_detection",
            evidence_value: "Cold lap / overlap detected at weld toe"
          };
        }
      }
    }

    // ---- CLAIM VS MEASUREMENT ----
    if (rule.rule_code === "CVM-001") {
      if (measurements.throat_mm && wpsParams.min_throat_mm) {
        if (parseFloat(measurements.throat_mm) < parseFloat(wpsParams.min_throat_mm) * 0.95) {
          contradiction = {
            claim_field: "measurements.throat_mm",
            claim_value: String(measurements.throat_mm) + " mm",
            evidence_field: "wps_parameters.min_throat_mm",
            evidence_value: String(wpsParams.min_throat_mm) + " mm required"
          };
        }
      }
    }

    if (rule.rule_code === "CVM-002") {
      if (measurements.weld_size_mm && measurements.leg_short_mm) {
        if (parseFloat(measurements.weld_size_mm) > parseFloat(measurements.leg_short_mm) * 1.1) {
          contradiction = {
            claim_field: "measurements.weld_size_mm",
            claim_value: String(measurements.weld_size_mm) + " mm claimed",
            evidence_field: "measurements.leg_short_mm",
            evidence_value: String(measurements.leg_short_mm) + " mm (shorter leg governs)"
          };
        }
      }
    }

    if (rule.rule_code === "CVM-003") {
      if (measurements.reinforcement_mm && measurements.code_max_reinforcement_mm) {
        if (parseFloat(measurements.reinforcement_mm) > parseFloat(measurements.code_max_reinforcement_mm)) {
          if (disposition === "accept" || disposition === "acceptable") {
            contradiction = {
              claim_field: "disposition",
              claim_value: "Acceptable (with " + measurements.reinforcement_mm + " mm reinforcement)",
              evidence_field: "code_limit.max_reinforcement_mm",
              evidence_value: String(measurements.code_max_reinforcement_mm) + " mm maximum"
            };
          }
        }
      }
    }

    // ---- MEASUREMENT VS MEASUREMENT ----
    if (rule.rule_code === "MVM-001") {
      if (measurements.ut_thickness_mm && measurements.nominal_thickness_mm) {
        var utVal = parseFloat(measurements.ut_thickness_mm);
        var nomVal = parseFloat(measurements.nominal_thickness_mm);
        if (utVal > nomVal * 1.1) {
          contradiction = {
            claim_field: "measurements.ut_thickness_mm",
            claim_value: String(utVal) + " mm measured",
            evidence_field: "measurements.nominal_thickness_mm",
            evidence_value: String(nomVal) + " mm nominal (reading exceeds nominal by " + Math.round((utVal - nomVal) / nomVal * 100) + "%)"
          };
        }
      }
    }

    if (rule.rule_code === "MVM-002") {
      if (measurements.hardness_value && measurements.expected_hardness_min && measurements.expected_hardness_max) {
        var hv = parseFloat(measurements.hardness_value);
        var hMin = parseFloat(measurements.expected_hardness_min);
        var hMax = parseFloat(measurements.expected_hardness_max);
        if (hv < hMin * 0.8 || hv > hMax * 1.2) {
          contradiction = {
            claim_field: "measurements.hardness_value",
            claim_value: String(hv) + " " + (measurements.hardness_scale || "HB"),
            evidence_field: "material_spec.expected_range",
            evidence_value: String(hMin) + "-" + String(hMax) + " " + (measurements.hardness_scale || "HB")
          };
        }
      }
    }

    // ---- CLAIM VS CODE ----
    if (rule.rule_code === "CVC-001") {
      if ((disposition === "accept" || disposition === "acceptable") && findings.length > 0) {
        for (var fc = 0; fc < findings.length; fc++) {
          if (findings[fc].exceeds_code === true) {
            contradiction = {
              claim_field: "disposition",
              claim_value: "Accept",
              evidence_field: "findings[" + fc + "]",
              evidence_value: (findings[fc].type || "discontinuity") + " exceeds code limit: " + (findings[fc].measured || "") + " vs " + (findings[fc].limit || "") + " max"
            };
            break;
          }
        }
      }
    }

    if (rule.rule_code === "CVC-002") {
      if ((disposition === "reject" || disposition === "rejected") && findings.length > 0) {
        var anyExceeds = false;
        for (var fc2 = 0; fc2 < findings.length; fc2++) {
          if (findings[fc2].exceeds_code === true) {
            anyExceeds = true;
            break;
          }
        }
        if (!anyExceeds) {
          contradiction = {
            claim_field: "disposition",
            claim_value: "Reject",
            evidence_field: "findings",
            evidence_value: "No reported finding exceeds code limits"
          };
        }
      }
    }

    // ---- MEASUREMENT VS WPS ----
    if (rule.rule_code === "MVW-001") {
      if (measurements.amperage && wpsParams.amperage_min && wpsParams.amperage_max) {
        var amp = parseFloat(measurements.amperage);
        if (amp < parseFloat(wpsParams.amperage_min) || amp > parseFloat(wpsParams.amperage_max)) {
          contradiction = {
            claim_field: "measurements.amperage",
            claim_value: String(amp) + " A",
            evidence_field: "wps_parameters.amperage_range",
            evidence_value: String(wpsParams.amperage_min) + "-" + String(wpsParams.amperage_max) + " A"
          };
        }
      }
    }

    if (rule.rule_code === "MVW-002") {
      if (measurements.voltage && wpsParams.voltage_min && wpsParams.voltage_max) {
        var volt = parseFloat(measurements.voltage);
        if (volt < parseFloat(wpsParams.voltage_min) || volt > parseFloat(wpsParams.voltage_max)) {
          contradiction = {
            claim_field: "measurements.voltage",
            claim_value: String(volt) + " V",
            evidence_field: "wps_parameters.voltage_range",
            evidence_value: String(wpsParams.voltage_min) + "-" + String(wpsParams.voltage_max) + " V"
          };
        }
      }
    }

    // ---- PROCESS VS EVIDENCE ----
    if (rule.rule_code === "PVE-001") {
      if (processType && aiDetections.length > 0) {
        for (var ap = 0; ap < aiDetections.length; ap++) {
          var procEvidence = aiDetections[ap].process_indicator || "";
          if (procEvidence && procEvidence !== processType && procEvidence.length > 0) {
            contradiction = {
              claim_field: "process_type",
              claim_value: processType,
              evidence_field: "ai_detection.process_indicator",
              evidence_value: "Visual characteristics suggest " + procEvidence
            };
            break;
          }
        }
      }
    }

    // ---- POSITION VS EVIDENCE ----
    if (rule.rule_code === "POS-001") {
      if (position && aiDetections.length > 0) {
        for (var apos = 0; apos < aiDetections.length; apos++) {
          var posEvidence = aiDetections[apos].position_indicator || "";
          if (posEvidence && posEvidence !== position && posEvidence.length > 0) {
            contradiction = {
              claim_field: "position",
              claim_value: position,
              evidence_field: "ai_detection.position_indicator",
              evidence_value: "Gravity effects suggest " + posEvidence
            };
            break;
          }
        }
      }
    }

    // ---- HISTORY VS CURRENT ----
    if (rule.rule_code === "HVC-001") {
      if (disposition && priorAssessments.length > 0) {
        for (var ph = 0; ph < priorAssessments.length; ph++) {
          var prior = priorAssessments[ph];
          if (prior.disposition && prior.disposition !== disposition && !prior.repair_documented) {
            contradiction = {
              claim_field: "disposition",
              claim_value: disposition,
              evidence_field: "prior_assessment.disposition",
              evidence_value: "Previously: " + prior.disposition + " (no repair documented)"
            };
            break;
          }
        }
      }
    }

    // ---- LOGIC CONFLICTS ----
    if (rule.rule_code === "LOG-001") {
      if (disposition === "accept" || disposition === "acceptable") {
        for (var fl = 0; fl < findings.length; fl++) {
          var fType = findings[fl].type || "";
          if (fType.indexOf("crack") >= 0) {
            contradiction = {
              claim_field: "disposition",
              claim_value: "Accept",
              evidence_field: "findings.crack",
              evidence_value: fType + " reported — cracks prohibited under all codes"
            };
            break;
          }
        }
      }
    }

    if (rule.rule_code === "LOG-002") {
      if (disposition === "reject" || disposition === "rejected") {
        if (findings.length === 0) {
          contradiction = {
            claim_field: "disposition",
            claim_value: "Reject",
            evidence_field: "findings",
            evidence_value: "No discontinuities reported to justify rejection"
          };
        }
      }
    }

    if (rule.rule_code === "LOG-003") {
      if ((disposition === "accept" || disposition === "reject" || disposition === "acceptable" || disposition === "rejected") && evidenceScore < 50) {
        contradiction = {
          claim_field: "disposition",
          claim_value: disposition,
          evidence_field: "evidence_sufficiency_score",
          evidence_value: String(evidenceScore) + "% (below 50% threshold for definitive disposition)"
        };
      }
    }

    // ---- MATERIAL VS EVIDENCE ----
    if (rule.rule_code === "MAT-001") {
      if (material && aiDetections.length > 0) {
        for (var am = 0; am < aiDetections.length; am++) {
          var matEvidence = aiDetections[am].material_indicator || "";
          if (matEvidence && matEvidence !== material && matEvidence.length > 0) {
            contradiction = {
              claim_field: "material",
              claim_value: material,
              evidence_field: "ai_detection.material_indicator",
              evidence_value: "Visual characteristics suggest " + matEvidence
            };
            break;
          }
        }
      }
    }

    // If a contradiction was found for this rule, record it
    if (contradiction) {
      found.push({
        rule_id: rule.id,
        rule_code: rule.rule_code,
        rule_name: rule.rule_name,
        category: rule.category,
        severity: rule.severity,
        claim_field: contradiction.claim_field,
        claim_value: contradiction.claim_value,
        evidence_field: contradiction.evidence_field,
        evidence_value: contradiction.evidence_value,
        contradiction_description: rule.description,
        teaching_message: rule.teaching_response
      });
    }
  }

  return { checksRun: checksRun, found: found };
}

// Integrity score: starts at 100, deducted per contradiction by severity
function calculateIntegrityScore(contradictions) {
  var score = 100;
  var deductions = { critical: 30, major: 15, minor: 5, informational: 0 };
  for (var i = 0; i < contradictions.length; i++) {
    var sev = contradictions[i].severity || "minor";
    score -= (deductions[sev] || 5);
  }
  return Math.max(0, score);
}

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return err(405, "POST only");

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "";
    var sb = createClient(supabaseUrl, supabaseKey);

    // ============================================================
    // ACTION: get_registry
    // ============================================================
    if (action === "get_registry") {
      return ok({
        engine: "contradiction-engine",
        version: "1.0.0",
        deploy: "DEPLOY262",
        mode: "deterministic",
        description: "Catches gaps between what the person CLAIMS and what the EVIDENCE shows. Forces honest observation before disposition.",
        capabilities: [
          "get_registry — engine overview",
          "check_contradictions — run full contradiction check against 20 rules across 10 categories",
          "get_rules — list all contradiction rules with category/severity filtering",
          "get_detected — retrieve contradictions found for an assessment",
          "resolve_contradiction — mark a contradiction as resolved with corrective action",
          "get_integrity_score — get the integrity score for an assessment (100 = no contradictions)",
          "get_assessment_summary — full contradiction assessment summary with teaching content",
          "override_contradiction — override with justification (instructor/CWI only)",
          "get_teaching_response — get detailed teaching content for a specific contradiction",
          "get_contradiction_stats — aggregate contradiction statistics"
        ],
        contradiction_categories: [
          "claim_vs_image — what you say vs what the photo shows",
          "claim_vs_measurement — what you report vs what the numbers say",
          "measurement_vs_measurement — conflicting measurements",
          "claim_vs_code — your disposition vs code requirements",
          "measurement_vs_wps — your parameters vs WPS limits",
          "process_vs_evidence — claimed process vs visual characteristics",
          "position_vs_evidence — claimed position vs gravity effects",
          "material_vs_evidence — claimed material vs visual/PMI evidence",
          "history_vs_current — current vs prior assessments",
          "logic_conflict — internally inconsistent claims"
        ],
        rules_seeded: 20,
        principle: "The system does not accept claims at face value. Every claim is checked against available evidence. Contradictions must be resolved before disposition."
      });
    }

    // ============================================================
    // ACTION: check_contradictions
    // Run full contradiction check
    // ============================================================
    if (action === "check_contradictions") {
      var checkInput = body.input || body;
      var assessmentId = body.assessment_id || null;
      var caseId = body.case_id || null;
      var orgId = body.org_id || null;
      var checkedBy = body.checked_by || "system";

      // Fetch all active rules
      var rulesResult = await sb.from("contradiction_rule_registry").select("*").eq("is_active", true);
      if (rulesResult.error) return err(500, "Failed to fetch rules: " + rulesResult.error.message);

      var rules = rulesResult.data || [];
      var result = detectContradictions(rules, checkInput);
      var integrityScore = calculateIntegrityScore(result.found);
      var dispositionBlocked = false;
      var blockReason = "";

      // Block disposition if any critical contradiction found
      for (var bc = 0; bc < result.found.length; bc++) {
        if (result.found[bc].severity === "critical") {
          dispositionBlocked = true;
          blockReason = "Critical contradiction: " + result.found[bc].rule_name;
          break;
        }
      }

      // Also block if integrity score below 40
      if (integrityScore < 40 && !dispositionBlocked) {
        dispositionBlocked = true;
        blockReason = "Integrity score too low (" + integrityScore + "/100) — too many contradictions for reliable disposition";
      }

      // Count by severity
      var critCount = 0, majCount = 0, minCount = 0, infoCount = 0;
      for (var sc = 0; sc < result.found.length; sc++) {
        if (result.found[sc].severity === "critical") critCount++;
        else if (result.found[sc].severity === "major") majCount++;
        else if (result.found[sc].severity === "minor") minCount++;
        else infoCount++;
      }

      // Save detected contradictions
      if (result.found.length > 0 && (assessmentId || caseId)) {
        for (var si = 0; si < result.found.length; si++) {
          var c = result.found[si];
          await sb.from("detected_contradictions").insert({
            org_id: orgId,
            assessment_id: assessmentId,
            case_id: caseId,
            rule_id: c.rule_id,
            rule_code: c.rule_code,
            category: c.category,
            severity: c.severity,
            claim_field: c.claim_field,
            claim_value: c.claim_value,
            evidence_field: c.evidence_field,
            evidence_value: c.evidence_value,
            contradiction_description: c.contradiction_description,
            teaching_message: c.teaching_message,
            resolution_required: c.severity === "critical" || c.severity === "major"
          });
        }
      }

      // Save assessment summary
      if (assessmentId || caseId) {
        await sb.from("contradiction_assessments").insert({
          org_id: orgId,
          assessment_id: assessmentId,
          case_id: caseId,
          total_checks_run: result.checksRun,
          contradictions_found: result.found.length,
          critical_count: critCount,
          major_count: majCount,
          minor_count: minCount,
          informational_count: infoCount,
          integrity_score: integrityScore,
          disposition_blocked: dispositionBlocked,
          block_reason: blockReason || null,
          input_snapshot: checkInput,
          checked_by: checkedBy
        });

        // Audit
        await sb.from("contradiction_audit_events").insert({
          org_id: orgId,
          assessment_id: assessmentId,
          event_type: "check_run",
          event_data: {
            checks_run: result.checksRun,
            contradictions_found: result.found.length,
            integrity_score: integrityScore,
            disposition_blocked: dispositionBlocked
          },
          actor: checkedBy
        });
      }

      return ok({
        action: "check_contradictions",
        checks_run: result.checksRun,
        contradictions_found: result.found.length,
        critical: critCount,
        major: majCount,
        minor: minCount,
        informational: infoCount,
        integrity_score: integrityScore,
        disposition_blocked: dispositionBlocked,
        block_reason: blockReason || null,
        contradictions: result.found,
        message: result.found.length === 0
          ? "No contradictions detected. Claims are consistent with evidence."
          : result.found.length + " contradiction(s) detected. " + (dispositionBlocked ? "Disposition BLOCKED until resolved." : "Review and resolve before finalizing.")
      });
    }

    // ============================================================
    // ACTION: get_rules
    // ============================================================
    if (action === "get_rules") {
      var rQuery = sb.from("contradiction_rule_registry").select("*").eq("is_active", true).order("rule_code");
      if (body.category) rQuery = rQuery.eq("category", body.category);
      if (body.severity) rQuery = rQuery.eq("severity", body.severity);
      var rResult = await rQuery;
      if (rResult.error) return err(500, rResult.error.message);
      return ok({
        action: "get_rules",
        count: rResult.data.length,
        rules: rResult.data
      });
    }

    // ============================================================
    // ACTION: get_detected
    // ============================================================
    if (action === "get_detected") {
      var gdAssessmentId = body.assessment_id || null;
      var gdCaseId = body.case_id || null;
      if (!gdAssessmentId && !gdCaseId) return err(400, "assessment_id or case_id required");

      var gdQuery = sb.from("detected_contradictions").select("*");
      if (gdAssessmentId) gdQuery = gdQuery.eq("assessment_id", gdAssessmentId);
      if (gdCaseId) gdQuery = gdQuery.eq("case_id", gdCaseId);
      if (body.resolved !== undefined) gdQuery = gdQuery.eq("resolved", body.resolved);
      var gdResult = await gdQuery.order("created_at");
      if (gdResult.error) return err(500, gdResult.error.message);

      return ok({
        action: "get_detected",
        count: gdResult.data.length,
        unresolved: gdResult.data.filter(function(c) { return !c.resolved; }).length,
        contradictions: gdResult.data
      });
    }

    // ============================================================
    // ACTION: resolve_contradiction
    // ============================================================
    if (action === "resolve_contradiction") {
      var rcId = body.contradiction_id;
      var rcAction = body.resolution_action;
      var rcBy = body.resolved_by || "system";
      var rcNotes = body.resolution_notes || "";

      if (!rcId) return err(400, "contradiction_id required");
      if (!rcAction) return err(400, "resolution_action required (claim_corrected, evidence_reexamined, both_updated, override_with_justification, false_positive_confirmed)");

      var rcUpdate = await sb.from("detected_contradictions").update({
        resolved: true,
        resolved_by: rcBy,
        resolved_at: new Date().toISOString(),
        resolution_action: rcAction,
        resolution_notes: rcNotes
      }).eq("id", rcId).select().single();

      if (rcUpdate.error) return err(500, "Failed to resolve: " + rcUpdate.error.message);

      // Audit
      await sb.from("contradiction_audit_events").insert({
        org_id: rcUpdate.data.org_id,
        assessment_id: rcUpdate.data.assessment_id,
        event_type: "contradiction_resolved",
        event_data: {
          contradiction_id: rcId,
          rule_code: rcUpdate.data.rule_code,
          resolution_action: rcAction,
          resolution_notes: rcNotes
        },
        actor: rcBy
      });

      return ok({
        action: "resolve_contradiction",
        contradiction: rcUpdate.data,
        message: "Contradiction resolved: " + rcAction
      });
    }

    // ============================================================
    // ACTION: get_integrity_score
    // ============================================================
    if (action === "get_integrity_score") {
      var isAssessmentId = body.assessment_id || null;
      var isCaseId = body.case_id || null;
      if (!isAssessmentId && !isCaseId) return err(400, "assessment_id or case_id required");

      var isQuery = sb.from("contradiction_assessments").select("*");
      if (isAssessmentId) isQuery = isQuery.eq("assessment_id", isAssessmentId);
      if (isCaseId) isQuery = isQuery.eq("case_id", isCaseId);
      var isResult = await isQuery.order("checked_at", { ascending: false }).limit(1);

      if (isResult.error) return err(500, isResult.error.message);
      if (!isResult.data || isResult.data.length === 0) {
        return ok({
          action: "get_integrity_score",
          integrity_score: null,
          message: "No contradiction check has been run for this assessment yet"
        });
      }

      var assessment = isResult.data[0];
      return ok({
        action: "get_integrity_score",
        integrity_score: assessment.integrity_score,
        contradictions_found: assessment.contradictions_found,
        critical: assessment.critical_count,
        major: assessment.major_count,
        minor: assessment.minor_count,
        disposition_blocked: assessment.disposition_blocked,
        checked_at: assessment.checked_at,
        rating: assessment.integrity_score >= 90 ? "HIGH — claims consistent with evidence" :
                assessment.integrity_score >= 70 ? "MODERATE — minor inconsistencies detected" :
                assessment.integrity_score >= 40 ? "LOW — significant contradictions require resolution" :
                "CRITICAL — disposition blocked until contradictions resolved"
      });
    }

    // ============================================================
    // ACTION: get_assessment_summary
    // ============================================================
    if (action === "get_assessment_summary") {
      var gsAssessmentId = body.assessment_id || null;
      var gsCaseId = body.case_id || null;
      if (!gsAssessmentId && !gsCaseId) return err(400, "assessment_id or case_id required");

      var gsAQuery = sb.from("contradiction_assessments").select("*");
      if (gsAssessmentId) gsAQuery = gsAQuery.eq("assessment_id", gsAssessmentId);
      if (gsCaseId) gsAQuery = gsAQuery.eq("case_id", gsCaseId);
      var gsAResult = await gsAQuery.order("checked_at", { ascending: false }).limit(1);

      var gsDQuery = sb.from("detected_contradictions").select("*");
      if (gsAssessmentId) gsDQuery = gsDQuery.eq("assessment_id", gsAssessmentId);
      if (gsCaseId) gsDQuery = gsDQuery.eq("case_id", gsCaseId);
      var gsDResult = await gsDQuery.order("created_at");

      return ok({
        action: "get_assessment_summary",
        assessment: (gsAResult.data && gsAResult.data.length > 0) ? gsAResult.data[0] : null,
        contradictions: gsDResult.data || [],
        unresolved: (gsDResult.data || []).filter(function(c) { return !c.resolved; }).length,
        all_resolved: (gsDResult.data || []).every(function(c) { return c.resolved; })
      });
    }

    // ============================================================
    // ACTION: override_contradiction
    // ============================================================
    if (action === "override_contradiction") {
      var ovId = body.contradiction_id;
      var ovBy = body.override_by;
      var ovReason = body.override_reason;

      if (!ovId) return err(400, "contradiction_id required");
      if (!ovBy) return err(400, "override_by required (must be instructor or CWI)");
      if (!ovReason) return err(400, "override_reason required — must justify why contradiction is acceptable");

      var ovUpdate = await sb.from("detected_contradictions").update({
        resolved: true,
        resolved_by: ovBy,
        resolved_at: new Date().toISOString(),
        resolution_action: "override_with_justification",
        resolution_notes: "OVERRIDE by " + ovBy + ": " + ovReason
      }).eq("id", ovId).select().single();

      if (ovUpdate.error) return err(500, "Failed to override: " + ovUpdate.error.message);

      await sb.from("contradiction_audit_events").insert({
        org_id: ovUpdate.data.org_id,
        assessment_id: ovUpdate.data.assessment_id,
        event_type: "override_applied",
        event_data: {
          contradiction_id: ovId,
          rule_code: ovUpdate.data.rule_code,
          override_by: ovBy,
          override_reason: ovReason
        },
        actor: ovBy
      });

      return ok({
        action: "override_contradiction",
        contradiction: ovUpdate.data,
        message: "Contradiction overridden by " + ovBy + ". Justification recorded in audit trail."
      });
    }

    // ============================================================
    // ACTION: get_teaching_response
    // ============================================================
    if (action === "get_teaching_response") {
      var trRuleCode = body.rule_code || null;
      var trContradictionId = body.contradiction_id || null;

      if (!trRuleCode && !trContradictionId) return err(400, "rule_code or contradiction_id required");

      if (trContradictionId) {
        var trCResult = await sb.from("detected_contradictions").select("*").eq("id", trContradictionId).single();
        if (trCResult.error) return err(404, "Contradiction not found");
        trRuleCode = trCResult.data.rule_code;
      }

      var trRule = await sb.from("contradiction_rule_registry").select("*").eq("rule_code", trRuleCode).single();
      if (trRule.error) return err(404, "Rule not found: " + trRuleCode);

      return ok({
        action: "get_teaching_response",
        rule_code: trRule.data.rule_code,
        rule_name: trRule.data.rule_name,
        category: trRule.data.category,
        severity: trRule.data.severity,
        what_happened: trRule.data.description,
        example_scenario: trRule.data.example_scenario,
        teaching_response: trRule.data.teaching_response,
        resolution_options: [
          "claim_corrected — update your claim to match the evidence",
          "evidence_reexamined — re-examine the evidence and confirm your original claim",
          "both_updated — update both claim and evidence after re-examination",
          "false_positive_confirmed — confirm this was a false detection (requires justification)"
        ]
      });
    }

    // ============================================================
    // ACTION: get_contradiction_stats
    // ============================================================
    if (action === "get_contradiction_stats") {
      var stOrgId = body.org_id || null;

      var stQuery = sb.from("detected_contradictions").select("rule_code, category, severity, resolved");
      if (stOrgId) stQuery = stQuery.eq("org_id", stOrgId);
      var stResult = await stQuery;

      if (stResult.error) return err(500, stResult.error.message);
      var data = stResult.data || [];

      // Aggregate by category
      var byCat = {};
      var byRule = {};
      var bySev = { critical: 0, major: 0, minor: 0, informational: 0 };
      var totalResolved = 0;

      for (var si2 = 0; si2 < data.length; si2++) {
        var item = data[si2];
        byCat[item.category] = (byCat[item.category] || 0) + 1;
        byRule[item.rule_code] = (byRule[item.rule_code] || 0) + 1;
        bySev[item.severity] = (bySev[item.severity] || 0) + 1;
        if (item.resolved) totalResolved++;
      }

      // Find most common
      var mostCommonRule = "";
      var mostCommonCount = 0;
      for (var rk in byRule) {
        if (byRule[rk] > mostCommonCount) {
          mostCommonCount = byRule[rk];
          mostCommonRule = rk;
        }
      }

      return ok({
        action: "get_contradiction_stats",
        total_contradictions: data.length,
        total_resolved: totalResolved,
        total_unresolved: data.length - totalResolved,
        resolution_rate: data.length > 0 ? Math.round(totalResolved / data.length * 100) : 0,
        by_severity: bySev,
        by_category: byCat,
        by_rule: byRule,
        most_common_contradiction: mostCommonRule,
        most_common_count: mostCommonCount,
        insight: mostCommonRule ? "Most common contradiction: " + mostCommonRule + " (" + mostCommonCount + " occurrences). Focus teaching on this gap." : "No contradictions recorded yet."
      });
    }

    return err(400, "Unknown action: " + action + ". Valid: get_registry, check_contradictions, get_rules, get_detected, resolve_contradiction, get_integrity_score, get_assessment_summary, override_contradiction, get_teaching_response, get_contradiction_stats");

  } catch (e) {
    return err(500, String(e && e.message ? e.message : e));
  }
};
