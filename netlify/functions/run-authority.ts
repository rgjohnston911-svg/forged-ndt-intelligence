/**
 * DEPLOY22_run-authority.ts
 * Deploy to: netlify/functions/run-authority.ts
 *
 * Called after inspector enters measurements.
 * Reads findings + measurements from Supabase,
 * runs the Authority Lock Engine + Conflict Resolver,
 * and locks the final decision.
 *
 * CRITICAL: String concatenation only. No backtick template literals.
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

// ================================================================
// CONFLICT RESOLVER (inline to avoid import issues)
// ================================================================

var HARD_REJECTABLE = ["crack", "incomplete_fusion", "incomplete_penetration", "overlap"];

function resolveConflicts(openaiFindings: any[], claudeFindings: any[]) {
  var resolutions: any[] = [];
  var mergedFindings: any[] = [];
  var openaiMap: Record<string, any> = {};
  var claudeMap: Record<string, any> = {};

  for (var i = 0; i < openaiFindings.length; i++) {
    var k = openaiFindings[i].finding_type;
    if (!openaiMap[k] || openaiFindings[i].confidence > openaiMap[k].confidence) {
      openaiMap[k] = openaiFindings[i];
    }
  }
  for (var j = 0; j < claudeFindings.length; j++) {
    var ck = claudeFindings[j].finding_type;
    if (!claudeMap[ck] || claudeFindings[j].confidence > claudeMap[ck].confidence) {
      claudeMap[ck] = claudeFindings[j];
    }
  }

  var allTypes: string[] = [];
  var typeSet: Record<string, boolean> = {};
  var allKeys = Object.keys(openaiMap).concat(Object.keys(claudeMap));
  for (var t = 0; t < allKeys.length; t++) {
    if (!typeSet[allKeys[t]]) { typeSet[allKeys[t]] = true; allTypes.push(allKeys[t]); }
  }

  var agreements = 0;
  for (var a = 0; a < allTypes.length; a++) {
    var ft = allTypes[a];
    var oai = openaiMap[ft] || null;
    var cld = claudeMap[ft] || null;

    if (oai && cld) {
      agreements++;
      var avgC = (oai.confidence + cld.confidence) / 2;
      var boostC = Math.min(avgC * 1.15, 0.98);
      resolutions.push({
        finding_type: ft,
        openai_confidence: oai.confidence,
        claude_confidence: cld.confidence,
        resolution_method: "DUAL_AGREEMENT",
        resolved_confidence: boostC,
        reasoning: "Both AI engines identified " + ft + ". Cross-validated confidence: " + Math.round(boostC * 100) + "%."
      });
      mergedFindings.push({
        finding_type: ft,
        confidence: boostC,
        source: "merged",
        severity: oai.severity || cld.severity || "medium"
      });
    } else if (oai && !cld) {
      var isHard = HARD_REJECTABLE.indexOf(ft) >= 0;
      var penaltyConf = oai.confidence * (isHard ? 0.85 : 0.8);
      resolutions.push({
        finding_type: ft,
        openai_confidence: oai.confidence,
        claude_confidence: 0,
        resolution_method: isHard ? "CONSERVATIVE_ESCALATION" : "SINGLE_SOURCE_RETAINED",
        resolved_confidence: penaltyConf,
        reasoning: ft + " detected by GPT-4o only. " + (isHard ? "Conservative escalation for critical defect." : "Confidence reduced for single-source.")
      });
      mergedFindings.push({
        finding_type: ft, confidence: penaltyConf, source: "openai_only",
        severity: oai.severity || "medium"
      });
    } else if (!oai && cld) {
      var isHardC = HARD_REJECTABLE.indexOf(ft) >= 0;
      var penaltyConfC = cld.confidence * (isHardC ? 0.85 : 0.8);
      resolutions.push({
        finding_type: ft,
        openai_confidence: 0,
        claude_confidence: cld.confidence,
        resolution_method: isHardC ? "CONSERVATIVE_ESCALATION" : "SINGLE_SOURCE_RETAINED",
        resolved_confidence: penaltyConfC,
        reasoning: ft + " identified by Claude physics reasoning only. " + (isHardC ? "Conservative escalation." : "May indicate physics-based inference.")
      });
      mergedFindings.push({
        finding_type: ft, confidence: penaltyConfC, source: "claude_only",
        severity: cld.severity || "medium"
      });
    }
  }

  return {
    resolutions: resolutions,
    merged_findings: mergedFindings,
    agreement_score: allTypes.length > 0 ? agreements / allTypes.length : 0,
    has_conflicts: agreements < allTypes.length
  };
}

// ================================================================
// AUTHORITY RULES
// ================================================================

var AUTHORITY_RULES = [
  { id: "HR_CRACK_D11", rule_name: "AWS D1.1 - Cracks Not Permitted", code_family: "AWS_D1_1", rule_class: "hard_reject", finding_type: "crack", measurement_key: null, threshold_imperial: null, threshold_metric: null, operator: "exists", engineering_basis: "Cracks are unconditionally rejected. Crack tips concentrate stress 10-100x. Sharp-tipped discontinuity creates theoretical infinite stress at tip in LEFM." },
  { id: "HR_CRACK_A8", rule_name: "ASME VIII - Cracks Not Permitted", code_family: "ASME_VIII", rule_class: "hard_reject", finding_type: "crack", measurement_key: null, threshold_imperial: null, threshold_metric: null, operator: "exists", engineering_basis: "Pressure vessels contain stored energy. Crack in pressure boundary can propagate rapidly. Vessel rupture is catastrophic." },
  { id: "HR_CRACK_API", rule_name: "API 1104 - Cracks Not Permitted", code_family: "API_1104", rule_class: "hard_reject", finding_type: "crack", measurement_key: null, threshold_imperial: null, threshold_metric: null, operator: "exists", engineering_basis: "Pipeline failure: environmental contamination, fire/explosion, public safety. Circumferential crack under hoop stress has highest propagation force." },
  { id: "HR_IP_A8", rule_name: "ASME VIII - Incomplete Penetration", code_family: "ASME_VIII", rule_class: "hard_reject", finding_type: "incomplete_penetration", measurement_key: null, threshold_imperial: null, threshold_metric: null, operator: "exists", engineering_basis: "Reduces effective throat below design requirement. Root creates crevice for corrosive media." },
  { id: "HR_IF_D11", rule_name: "AWS D1.1 - Incomplete Fusion", code_family: "AWS_D1_1", rule_class: "hard_reject", finding_type: "incomplete_fusion", measurement_key: null, threshold_imperial: null, threshold_metric: null, operator: "exists", engineering_basis: "Unbonded interface acts as planar discontinuity. Zero cross-section in through-thickness direction." },
  { id: "HR_OL_D11", rule_name: "AWS D1.1 - Overlap Not Permitted", code_family: "AWS_D1_1", rule_class: "hard_reject", finding_type: "overlap", measurement_key: null, threshold_imperial: null, threshold_metric: null, operator: "exists", engineering_basis: "Mechanical notch at weld toe. Rolled-over metal not fused to base, creating crack-like condition." },
  { id: "TH_UC_STATIC", rule_name: "AWS D1.1 - Undercut Static", code_family: "AWS_D1_1", rule_class: "threshold", finding_type: "undercut", measurement_key: "depth", threshold_imperial: 0.03125, threshold_metric: 0.8, operator: "lte", engineering_basis: "Static: 1/32 in limit where cross-section reduction affects load capacity." },
  { id: "TH_UC_DYNAMIC", rule_name: "AWS D1.1 - Undercut Dynamic/Cyclic", code_family: "AWS_D1_1", rule_class: "threshold", finding_type: "undercut", measurement_key: "depth", threshold_imperial: 0.01, threshold_metric: 0.25, operator: "lte", engineering_basis: "Dynamic/cyclic: 0.01 in limit. Physics shifts to stress concentration and fatigue initiation." },
  { id: "TH_BT_API", rule_name: "API 1104 - Burn-Through", code_family: "API_1104", rule_class: "threshold", finding_type: "burn_through", measurement_key: "diameter", threshold_imperial: 0.25, threshold_metric: 6.4, operator: "lte", engineering_basis: "1/4 in max. Root inaccessible after installation." },
  { id: "TH_REINF_D11", rule_name: "AWS D1.1 - Reinforcement", code_family: "AWS_D1_1", rule_class: "threshold", finding_type: "reinforcement", measurement_key: "height", threshold_imperial: 0.125, threshold_metric: 3.0, operator: "lte", engineering_basis: "1/8 in max. Balances throat area vs toe stress concentration." },
  { id: "TH_POR_D11", rule_name: "AWS D1.1 - Porosity Size", code_family: "AWS_D1_1", rule_class: "threshold", finding_type: "porosity", measurement_key: "diameter", threshold_imperial: 0.09375, threshold_metric: 2.4, operator: "lte", engineering_basis: "Spherical void SCF ~2.0 vs infinite for crack. 3/32 in limit." }
];

function runAuthority(findingsArr: any[], measurements: any[]) {
  var evaluations: any[] = [];
  var hardRejects: string[] = [];
  var thresholdFailures: string[] = [];
  var missingMeasurements: any[] = [];
  var rulesPassed = 0, rulesFailed = 0, rulesNA = 0;

  var mLookup: Record<string, any> = {};
  for (var m = 0; m < measurements.length; m++) {
    mLookup[measurements[m].finding_type + ":" + measurements[m].measurement_key] = measurements[m];
  }

  var fConf: Record<string, number> = {};
  for (var f = 0; f < findingsArr.length; f++) {
    var ft = findingsArr[f].finding_type;
    if (!fConf[ft] || findingsArr[f].confidence > fConf[ft]) fConf[ft] = findingsArr[f].confidence;
  }

  for (var r = 0; r < AUTHORITY_RULES.length; r++) {
    var rule = AUTHORITY_RULES[r];
    var exists = fConf[rule.finding_type] !== undefined;
    var conf = fConf[rule.finding_type] || 0;

    if (rule.rule_class === "hard_reject") {
      if (exists && conf >= 0.5) {
        rulesFailed++;
        evaluations.push({ rule_id: rule.id, rule_name: rule.rule_name, code_family: rule.code_family, rule_class: "hard_reject", passed: false, measured_value_imperial: null, threshold_imperial: null, explanation: rule.finding_type + " detected at " + Math.round(conf * 100) + "%. Unconditional rejection.", engineering_basis: rule.engineering_basis, evidence_chain: "AI (" + Math.round(conf * 100) + "%) -> REJECT" });
        hardRejects.push(rule.rule_name);
      } else {
        rulesNA++;
        evaluations.push({ rule_id: rule.id, rule_name: rule.rule_name, code_family: rule.code_family, rule_class: "hard_reject", passed: null, measured_value_imperial: null, threshold_imperial: null, explanation: rule.finding_type + " not detected.", engineering_basis: rule.engineering_basis, evidence_chain: "No detection -> N/A" });
      }
      continue;
    }

    if (rule.rule_class === "threshold") {
      if (!exists) {
        rulesNA++;
        evaluations.push({ rule_id: rule.id, rule_name: rule.rule_name, code_family: rule.code_family, rule_class: "threshold", passed: null, measured_value_imperial: null, threshold_imperial: rule.threshold_imperial, explanation: rule.finding_type + " not detected.", engineering_basis: rule.engineering_basis, evidence_chain: "No detection -> N/A" });
        continue;
      }

      var mData = mLookup[rule.finding_type + ":" + rule.measurement_key];
      if (!mData) {
        rulesNA++;
        evaluations.push({ rule_id: rule.id, rule_name: rule.rule_name, code_family: rule.code_family, rule_class: "threshold", passed: null, measured_value_imperial: null, threshold_imperial: rule.threshold_imperial, explanation: rule.finding_type + " detected but " + rule.measurement_key + " not measured. MEASUREMENT REQUIRED.", engineering_basis: rule.engineering_basis, evidence_chain: "AI (" + Math.round(conf * 100) + "%) -> Missing -> CANNOT EVALUATE" });
        var tracked = false;
        for (var mm = 0; mm < missingMeasurements.length; mm++) {
          if (missingMeasurements[mm].finding_type === rule.finding_type && missingMeasurements[mm].measurement_key === rule.measurement_key) { missingMeasurements[mm].required_by.push(rule.rule_name); tracked = true; break; }
        }
        if (!tracked) missingMeasurements.push({ finding_type: rule.finding_type, measurement_key: rule.measurement_key, label: rule.finding_type.replace(/_/g, " ") + " " + rule.measurement_key, required_by: [rule.rule_name] });
        continue;
      }

      var valI = mData.value_imperial;
      var valM = mData.value_metric;
      var thrI = rule.threshold_imperial || 0;
      var thrM = rule.threshold_metric || 0;
      var passed = (rule.operator === "lte") ? valI <= thrI : valI < thrI;

      if (passed) {
        rulesPassed++;
        evaluations.push({ rule_id: rule.id, rule_name: rule.rule_name, code_family: rule.code_family, rule_class: "threshold", passed: true, measured_value_imperial: valI, threshold_imperial: thrI, explanation: rule.finding_type + " " + rule.measurement_key + " = " + valI.toFixed(4) + " in (" + valM.toFixed(2) + " mm). Limit: " + thrI.toFixed(4) + " in (" + thrM.toFixed(2) + " mm). PASS.", engineering_basis: rule.engineering_basis, evidence_chain: "Measured " + valI.toFixed(4) + " -> Limit " + thrI.toFixed(4) + " -> PASS" });
      } else {
        rulesFailed++;
        evaluations.push({ rule_id: rule.id, rule_name: rule.rule_name, code_family: rule.code_family, rule_class: "threshold", passed: false, measured_value_imperial: valI, threshold_imperial: thrI, explanation: rule.finding_type + " " + rule.measurement_key + " = " + valI.toFixed(4) + " in (" + valM.toFixed(2) + " mm). EXCEEDS " + thrI.toFixed(4) + " in (" + thrM.toFixed(2) + " mm). REJECT.", engineering_basis: rule.engineering_basis, evidence_chain: "Measured " + valI.toFixed(4) + " -> Limit " + thrI.toFixed(4) + " -> FAIL" });
        thresholdFailures.push(rule.rule_name);
      }
    }
  }

  // FINAL DECISION
  var disposition = "accept";
  var locked = false;
  var confidence = 0.85;
  var whatText = "", whyText = "", howText = "", reason = "";

  if (hardRejects.length > 0) {
    disposition = "reject"; locked = true; confidence = 0.98;
    reason = "Hard rejection: " + hardRejects.join(", ");
    whatText = "REJECT - " + hardRejects[0]; whyText = reason; howText = "Repair per code. Re-inspect after repair.";
  } else if (thresholdFailures.length > 0) {
    disposition = "reject"; locked = true; confidence = 0.95;
    reason = "Threshold exceeded: " + thresholdFailures.join(", ");
    whatText = "REJECT - Exceeds code limit."; whyText = evaluations.filter(function(e) { return e.passed === false; })[0].explanation; howText = "Repair to code limits. Re-measure.";
  } else if (missingMeasurements.length > 0) {
    disposition = "review_required"; locked = false; confidence = 0.60;
    reason = "Missing: " + missingMeasurements.map(function(mm) { return mm.label; }).join(", ");
    whatText = "REVIEW REQUIRED - Measurements needed."; whyText = reason; howText = "Enter measurements, re-run authority.";
  } else {
    disposition = "accept"; locked = true; confidence = 0.90;
    reason = rulesPassed + " rules passed.";
    whatText = "ACCEPT - No nonconforming conditions."; whyText = reason; howText = "Proceed per procedure. Archive with evidence.";
  }

  return {
    locked: locked, disposition: disposition, confidence: confidence,
    reason: reason, what: whatText, why: whyText, how: howText,
    evaluations: evaluations,
    evidence: { rules_evaluated: evaluations.length, rules_passed: rulesPassed, rules_failed: rulesFailed, rules_na: rulesNA, hard_rejects: hardRejects, threshold_failures: thresholdFailures, measurements_provided: measurements.length, measurements_needed: missingMeasurements.length },
    missing_measurements: missingMeasurements,
    measurement_count: measurements.length
  };
}

// ================================================================
// HANDLER
// ================================================================

var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var caseId = body.case_id;
    if (!caseId) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };
    }

    var supabase = createClient(supabaseUrl, supabaseKey);

    // Load findings
    var findingsResult = await supabase.from("findings").select("*").eq("case_id", caseId);
    var allFindings = findingsResult.data || [];

    // Load measurements
    var measResult = await supabase.from("case_measurements").select("*").eq("case_id", caseId);
    var measurements = measResult.data || [];

    // Separate by source for conflict resolution
    var oaiFindings = allFindings.filter(function(f) { return f.source === "openai"; });
    var cldFindings = allFindings.filter(function(f) { return f.source === "claude"; });

    // Run conflict resolution
    var conflicts = resolveConflicts(oaiFindings, cldFindings);

    // Store conflict resolutions
    if (conflicts.resolutions.length > 0) {
      // Delete old resolutions for this case
      await supabase.from("conflict_resolutions").delete().eq("case_id", caseId);
      for (var cr = 0; cr < conflicts.resolutions.length; cr++) {
        var res = conflicts.resolutions[cr];
        await supabase.from("conflict_resolutions").insert({
          case_id: caseId,
          finding_type: res.finding_type,
          openai_confidence: res.openai_confidence,
          claude_confidence: res.claude_confidence,
          resolution_method: res.resolution_method,
          resolved_assessment: res.finding_type,
          resolved_confidence: res.resolved_confidence,
          reasoning: res.reasoning
        });
      }
    }

    // Run authority engine
    var authority = runAuthority(allFindings, measurements);

    // Store authority evaluations
    await supabase.from("rule_evaluations").delete().eq("case_id", caseId);
    for (var ev = 0; ev < authority.evaluations.length; ev++) {
      var e = authority.evaluations[ev];
      await supabase.from("rule_evaluations").insert({
        case_id: caseId,
        rule_key: e.rule_id,
        rule_name: e.rule_name,
        method: "AUTHORITY",
        passed: e.passed,
        rule_class: e.rule_class,
        explanation: e.explanation,
        engineering_basis_cited: e.engineering_basis,
        input_snapshot_json: {
          measured_value_imperial: e.measured_value_imperial,
          threshold_imperial: e.threshold_imperial
        },
        output_snapshot_json: {
          evidence_chain: e.evidence_chain
        }
      });
    }

    // Update case with authority decision
    await supabase.from("inspection_cases").update({
      final_disposition: authority.disposition,
      final_confidence: authority.confidence,
      final_decision_reason: authority.reason,
      truth_engine_summary: authority.what,
      authority_locked: authority.locked,
      authority_decision: authority.disposition,
      authority_reason: authority.reason,
      authority_evidence: authority.evidence,
      authority_confidence: authority.confidence,
      authority_locked_at: authority.locked ? new Date().toISOString() : null,
      status: authority.locked ? "finalized" : "truth_resolved"
    }).eq("id", caseId);

    // Log event
    await supabase.from("case_events").insert({
      case_id: caseId,
      event_type: authority.locked ? "authority_locked" : "authority_evaluated",
      event_json: {
        disposition: authority.disposition,
        locked: authority.locked,
        confidence: authority.confidence,
        rules_passed: authority.evidence.rules_passed,
        rules_failed: authority.evidence.rules_failed,
        measurements_provided: authority.evidence.measurements_provided,
        conflict_agreement_score: conflicts.agreement_score
      }
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: true,
        authority: authority,
        conflicts: {
          agreement_score: conflicts.agreement_score,
          has_conflicts: conflicts.has_conflicts,
          resolutions: conflicts.resolutions
        }
      })
    };

  } catch (err: any) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || "run-authority failed" })
    };
  }
};

export { handler };
