// @ts-nocheck
/**
 * DEPLOY231 - compliance-matrix.ts
 * netlify/functions/compliance-matrix.ts
 *
 * COMPLIANCE MATRIX ENGINE
 *
 * Tracks regulatory compliance status per case.
 * Maps inspection requirements to standards, checks if each requirement is met,
 * and produces a compliance score.
 *
 * POST /api/compliance-matrix { action: "evaluate", case_id }
 *   -> Evaluates compliance status for a case based on its codes and findings
 *
 * POST /api/compliance-matrix { action: "get_requirements", standard }
 *   -> Returns requirements for a specific standard (API 579, ASME PCC-2, etc.)
 *
 * POST /api/compliance-matrix { action: "get_case_compliance", case_id }
 *   -> Returns stored compliance evaluation for a case
 *
 * POST /api/compliance-matrix { action: "get_summary" }
 *   -> Returns compliance stats across all cases
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

// Standard compliance requirements registry
var STANDARDS_REGISTRY = {
  "API-579": {
    name: "API 579-1/ASME FFS-1 Fitness-For-Service",
    category: "regulatory",
    requirements: [
      { id: "API579-001", clause: "Part 4", desc: "General metal loss assessment performed", category: "assessment", critical: true },
      { id: "API579-002", clause: "Part 5", desc: "Local metal loss assessment performed", category: "assessment", critical: true },
      { id: "API579-003", clause: "Part 8", desc: "Weld misalignment assessment if applicable", category: "assessment", critical: false },
      { id: "API579-004", clause: "Part 9", desc: "Crack-like flaw assessment if applicable", category: "assessment", critical: false },
      { id: "API579-005", clause: "Part 2", desc: "Equipment data and maintenance history documented", category: "documentation", critical: true },
      { id: "API579-006", clause: "Part 3", desc: "Material properties identified and verified", category: "material", critical: true },
      { id: "API579-007", clause: "Part 14", desc: "Remaining life calculation performed", category: "assessment", critical: true }
    ]
  },
  "ASME-PCC-2": {
    name: "ASME PCC-2 Repair of Pressure Equipment and Piping",
    category: "industry",
    requirements: [
      { id: "PCC2-001", clause: "Article 4.1", desc: "Non-metallic composite repair design verified", category: "repair", critical: true },
      { id: "PCC2-002", clause: "Article 4.2", desc: "Surface preparation requirements met", category: "repair", critical: true },
      { id: "PCC2-003", clause: "Article 4.3", desc: "Repair installation procedure documented", category: "documentation", critical: true },
      { id: "PCC2-004", clause: "Article 4.4", desc: "Post-repair inspection performed", category: "inspection", critical: true },
      { id: "PCC2-005", clause: "Article 2.1", desc: "Welded repair assessment completed", category: "repair", critical: false }
    ]
  },
  "ASME-B31-3": {
    name: "ASME B31.3 Process Piping",
    category: "industry",
    requirements: [
      { id: "B313-001", clause: "345.2", desc: "Visual examination performed", category: "inspection", critical: true },
      { id: "B313-002", clause: "344.6", desc: "Radiographic examination where required", category: "inspection", critical: false },
      { id: "B313-003", clause: "345.4", desc: "Ultrasonic examination where required", category: "inspection", critical: false },
      { id: "B313-004", clause: "345.1", desc: "NDE personnel qualification verified", category: "personnel", critical: true },
      { id: "B313-005", clause: "341", desc: "Pressure test performed", category: "testing", critical: true }
    ]
  },
  "API-510": {
    name: "API 510 Pressure Vessel Inspection Code",
    category: "regulatory",
    requirements: [
      { id: "API510-001", clause: "6.3", desc: "External visual inspection performed", category: "inspection", critical: true },
      { id: "API510-002", clause: "6.4", desc: "Internal inspection performed or justified exemption", category: "inspection", critical: true },
      { id: "API510-003", clause: "7.1", desc: "Corrosion rate calculated", category: "assessment", critical: true },
      { id: "API510-004", clause: "7.2", desc: "Remaining life calculated", category: "assessment", critical: true },
      { id: "API510-005", clause: "7.3", desc: "Next inspection date determined", category: "scheduling", critical: true },
      { id: "API510-006", clause: "8", desc: "Repair/alteration meets NBIC requirements", category: "repair", critical: false }
    ]
  },
  "API-570": {
    name: "API 570 Piping Inspection Code",
    category: "regulatory",
    requirements: [
      { id: "API570-001", clause: "6.3", desc: "Visual inspection performed", category: "inspection", critical: true },
      { id: "API570-002", clause: "6.4", desc: "Thickness measurements taken", category: "inspection", critical: true },
      { id: "API570-003", clause: "7.1", desc: "Corrosion rate determined", category: "assessment", critical: true },
      { id: "API570-004", clause: "7.2", desc: "Remaining life calculated", category: "assessment", critical: true },
      { id: "API570-005", clause: "7.3", desc: "Next inspection date scheduled", category: "scheduling", critical: true },
      { id: "API570-006", clause: "8", desc: "Repair methods per applicable code", category: "repair", critical: false }
    ]
  },
  "ISO-24817": {
    name: "ISO 24817 Composite Repairs for Pipework",
    category: "international",
    requirements: [
      { id: "ISO24817-001", clause: "7", desc: "Design calculation for composite repair", category: "repair", critical: true },
      { id: "ISO24817-002", clause: "8", desc: "Installation procedure qualified", category: "repair", critical: true },
      { id: "ISO24817-003", clause: "9", desc: "Quality assurance during installation", category: "quality", critical: true },
      { id: "ISO24817-004", clause: "10", desc: "Post-repair testing completed", category: "testing", critical: true }
    ]
  }
};

function getApplicableStandards(caseData, codeSets) {
  var standards = [];
  var standardNames = {};

  // Check code_sets for referenced standards
  if (codeSets && codeSets.length > 0) {
    for (var ci = 0; ci < codeSets.length; ci++) {
      var code = codeSets[ci];
      var codeName = (code.code_name || code.name || "").toUpperCase();

      var regKeys = Object.keys(STANDARDS_REGISTRY);
      for (var rk = 0; rk < regKeys.length; rk++) {
        var key = regKeys[rk];
        var cleanKey = key.replace(/-/g, "").replace(/ /g, "");
        var cleanCode = codeName.replace(/-/g, "").replace(/ /g, "").replace(/\//g, "");
        if (cleanCode.indexOf(cleanKey) >= 0 || cleanKey.indexOf(cleanCode) >= 0) {
          if (!standardNames[key]) {
            standardNames[key] = true;
            standards.push(key);
          }
        }
      }
    }
  }

  // Infer from asset type / inspection method
  var assetType = (caseData.asset_type || "").toLowerCase();
  if (assetType.indexOf("vessel") >= 0 || assetType.indexOf("tank") >= 0) {
    if (!standardNames["API-510"]) { standardNames["API-510"] = true; standards.push("API-510"); }
  }
  if (assetType.indexOf("pipe") >= 0 || assetType.indexOf("piping") >= 0) {
    if (!standardNames["API-570"]) { standardNames["API-570"] = true; standards.push("API-570"); }
    if (!standardNames["ASME-B31-3"]) { standardNames["ASME-B31-3"] = true; standards.push("ASME-B31-3"); }
  }

  // Always include API-579 for fitness-for-service assessments
  if (!standardNames["API-579"]) { standardNames["API-579"] = true; standards.push("API-579"); }

  return standards;
}

function evaluateRequirements(requirements, caseData, findings, evidence) {
  var results = [];
  var met = 0;
  var notMet = 0;
  var notApplicable = 0;

  for (var ri = 0; ri < requirements.length; ri++) {
    var req = requirements[ri];
    var status = "not_evaluated";
    var reason = "";

    // Auto-evaluate based on category
    var cat = req.category;

    if (cat === "inspection") {
      // Check if there are findings (indicates inspection was performed)
      if (findings && findings.length > 0) {
        status = "met";
        reason = findings.length + " finding(s) recorded from inspection";
      } else {
        status = "not_met";
        reason = "No findings recorded — inspection may not have been performed";
      }
    } else if (cat === "documentation") {
      // Check if evidence/attachments exist
      if (evidence && evidence.length > 0) {
        status = "met";
        reason = evidence.length + " evidence item(s) documented";
      } else {
        status = "not_met";
        reason = "No evidence/documentation uploaded";
      }
    } else if (cat === "material") {
      // Check if material is identified
      if (caseData.material || caseData.material_family) {
        status = "met";
        reason = "Material identified: " + (caseData.material || caseData.material_family);
      } else {
        status = "not_met";
        reason = "Material not identified on case";
      }
    } else if (cat === "assessment") {
      // Check if system has produced a state/disposition
      if (caseData.state && caseData.disposition) {
        status = "met";
        reason = "Assessment completed — state: " + caseData.state + ", disposition: " + caseData.disposition;
      } else if (caseData.state || caseData.disposition) {
        status = "partial";
        reason = "Partial assessment — state: " + (caseData.state || "N/A") + ", disposition: " + (caseData.disposition || "N/A");
      } else {
        status = "not_met";
        reason = "No assessment result recorded";
      }
    } else if (cat === "personnel") {
      // Can't auto-verify — mark as needs_review
      status = "needs_review";
      reason = "Personnel qualification requires manual verification";
    } else if (cat === "repair" || cat === "testing" || cat === "quality" || cat === "scheduling") {
      // These typically need manual confirmation
      status = "needs_review";
      reason = "Requires manual verification";
    }

    if (status === "met") met++;
    else if (status === "not_met") notMet++;
    else if (status === "not_applicable") notApplicable++;

    results.push({
      requirement_id: req.id,
      clause: req.clause,
      description: req.desc,
      category: req.category,
      critical: req.critical,
      status: status,
      reason: reason
    });
  }

  var total = results.length;
  var evaluated = met + notMet;
  var score = evaluated > 0 ? Math.round((met / evaluated) * 100) : null;

  return {
    results: results,
    score: score,
    met: met,
    not_met: notMet,
    needs_review: total - met - notMet - notApplicable,
    not_applicable: notApplicable,
    total: total
  };
}

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action;
    var sb = createClient(supabaseUrl, supabaseKey);
    var startTime = Date.now();

    // ── ACTION: get_requirements ──
    if (action === "get_requirements") {
      if (!body.standard) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "standard required (e.g. API-579, ASME-PCC-2)" }) };

      var std = STANDARDS_REGISTRY[body.standard];
      if (!std) {
        return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "Standard not found: " + body.standard, available: Object.keys(STANDARDS_REGISTRY) }) };
      }

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ standard: body.standard, name: std.name, category: std.category, requirements: std.requirements }) };
    }

    // ── ACTION: evaluate ──
    if (action === "evaluate") {
      if (!body.case_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };

      // Load case data
      var caseResult = await sb.from("inspection_cases").select("*").eq("id", body.case_id).single();
      if (caseResult.error || !caseResult.data) return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "case not found" }) };
      var caseData = caseResult.data;

      // Load findings
      var findingsResult = await sb.from("findings").select("*").eq("case_id", body.case_id);
      var findings = findingsResult.data || [];

      // Load evidence
      var evidenceResult = await sb.from("evidence").select("*").eq("case_id", body.case_id);
      var evidence = evidenceResult.data || [];

      // Load code sets
      var codeResult = await sb.from("code_sets").select("*").eq("case_id", body.case_id);
      var codeSets = codeResult.data || [];

      // Determine applicable standards
      var applicableStandards = getApplicableStandards(caseData, codeSets);

      // Evaluate each standard
      var evaluations = [];
      var overallMet = 0;
      var overallTotal = 0;
      var criticalNotMet = 0;

      for (var asi = 0; asi < applicableStandards.length; asi++) {
        var stdKey = applicableStandards[asi];
        var stdDef = STANDARDS_REGISTRY[stdKey];
        if (!stdDef) continue;

        var evalResult = evaluateRequirements(stdDef.requirements, caseData, findings, evidence);

        // Count critical not-met
        for (var eri = 0; eri < evalResult.results.length; eri++) {
          if (evalResult.results[eri].critical && evalResult.results[eri].status === "not_met") {
            criticalNotMet++;
          }
        }

        overallMet += evalResult.met;
        overallTotal += evalResult.total;

        evaluations.push({
          standard: stdKey,
          name: stdDef.name,
          category: stdDef.category,
          score: evalResult.score,
          met: evalResult.met,
          not_met: evalResult.not_met,
          needs_review: evalResult.needs_review,
          total: evalResult.total,
          requirements: evalResult.results
        });
      }

      var overallScore = overallTotal > 0 ? Math.round((overallMet / overallTotal) * 100) : null;
      var complianceLevel = "unknown";
      if (overallScore !== null) {
        if (criticalNotMet > 0) complianceLevel = "non_compliant";
        else if (overallScore >= 90) complianceLevel = "compliant";
        else if (overallScore >= 70) complianceLevel = "partially_compliant";
        else complianceLevel = "non_compliant";
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          case_id: body.case_id,
          compliance_level: complianceLevel,
          overall_score: overallScore,
          critical_gaps: criticalNotMet,
          standards_evaluated: evaluations.length,
          evaluations: evaluations,
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: get_case_compliance ──
    if (action === "get_case_compliance") {
      if (!body.case_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };
      // Re-evaluate live (no cached results — always fresh)
      body.action = "evaluate";
      // Recurse by re-calling with evaluate action
      var evalBody = JSON.stringify({ action: "evaluate", case_id: body.case_id });
      var evalEvent = { httpMethod: "POST", body: evalBody };
      return await handler(evalEvent, null);
    }

    // ── ACTION: get_summary ──
    if (action === "get_summary") {
      var allCases = await sb.from("inspection_cases").select("id, state, disposition, material, asset_type");
      if (allCases.error) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: allCases.error.message }) };

      var totalCases = (allCases.data || []).length;

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          total_cases: totalCases,
          standards_available: Object.keys(STANDARDS_REGISTRY).length,
          standards: Object.keys(STANDARDS_REGISTRY).map(function(k) {
            return { code: k, name: STANDARDS_REGISTRY[k].name, category: STANDARDS_REGISTRY[k].category, requirements_count: STANDARDS_REGISTRY[k].requirements.length };
          }),
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action + ". Valid: evaluate, get_requirements, get_case_compliance, get_summary" }) };

  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
