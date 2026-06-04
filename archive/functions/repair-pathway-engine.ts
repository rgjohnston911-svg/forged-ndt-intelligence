// @ts-nocheck
/**
 * DEPLOY263 - repair-pathway-engine.ts
 * netlify/functions/repair-pathway-engine.ts
 *
 * REPAIR PATHWAY ENGINE v1.0.0
 * Turns every reject into an actionable repair plan.
 * Accept / Repair / Reject / Cut-Out-and-Rerun with prerequisites.
 *
 * 10 actions:
 *   get_registry           — engine overview
 *   generate_repair_plan   — generate full repair pathway for a rejected weld
 *   get_repair_methods     — list all repair methods with filtering
 *   get_prerequisites      — list all prerequisites
 *   check_prerequisites    — check which prerequisites are met for a repair
 *   get_code_rules         — get code-specific repair rules
 *   record_repair          — record a completed repair in history
 *   get_repair_history     — get repair history for a location/case
 *   get_reinspection_plan  — get reinspection requirements for a repair
 *   get_repair_stats       — aggregate repair statistics
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
function errResp(code, msg) {
  return { statusCode: code, headers: corsHeaders, body: JSON.stringify({ error: msg }) };
}

// ============================================================
// Repair Method Selection Engine
// Picks the best repair method for each discontinuity
// ============================================================
function selectRepairMethod(methods, discontinuity, weldContext) {
  var candidates = [];
  var discType = discontinuity.type || "";
  var material = weldContext.material || "carbon_steel";
  var process = weldContext.process || "SMAW";

  for (var i = 0; i < methods.length; i++) {
    var method = methods[i];
    if (!method.is_active) continue;

    // Check discontinuity applicability
    var discMatch = false;
    for (var d = 0; d < method.applicable_discontinuities.length; d++) {
      if (method.applicable_discontinuities[d] === discType ||
          discType.indexOf(method.applicable_discontinuities[d]) >= 0 ||
          method.applicable_discontinuities[d].indexOf(discType) >= 0) {
        discMatch = true;
        break;
      }
    }
    if (!discMatch) continue;

    // Check material applicability
    var matMatch = false;
    for (var m = 0; m < method.applicable_materials.length; m++) {
      if (method.applicable_materials[m] === material ||
          material.indexOf(method.applicable_materials[m]) >= 0) {
        matMatch = true;
        break;
      }
    }

    // Check process applicability
    var procMatch = false;
    for (var p = 0; p < method.applicable_processes.length; p++) {
      if (method.applicable_processes[p] === process ||
          process.indexOf(method.applicable_processes[p]) >= 0) {
        procMatch = true;
        break;
      }
    }

    var score = 0;
    if (discMatch) score += 50;
    if (matMatch) score += 25;
    if (procMatch) score += 15;
    score += (method.typical_success_rate || 0) / 10;

    candidates.push({
      method: method,
      score: score,
      material_compatible: matMatch,
      process_compatible: procMatch
    });
  }

  candidates.sort(function(a, b) { return b.score - a.score; });
  return candidates;
}

// Determine repair disposition
function determineRepairDisposition(discontinuities, repairCount, maxRepairs, codeRules) {
  var hasCrack = false;
  var hasMultipleDefects = discontinuities.length >= 3;
  var hasExtensive = false;

  for (var i = 0; i < discontinuities.length; i++) {
    var dtype = discontinuities[i].type || "";
    if (dtype.indexOf("crack") >= 0) hasCrack = true;
    if (discontinuities[i].severity === "extensive" || discontinuities[i].extent === "extensive") hasExtensive = true;
  }

  // Repair limit exceeded
  if (repairCount >= maxRepairs) {
    return {
      disposition: "cut_out_and_rerun",
      reason: "Repair limit exceeded (" + repairCount + " prior repairs at this location). Code requires cut-out and rerun.",
      requires_engineering: true
    };
  }

  // Extensive defects or too many types
  if (hasExtensive || (hasMultipleDefects && hasCrack)) {
    return {
      disposition: "cut_out_and_rerun",
      reason: "Defects are too extensive for local repair. Full removal and rewelding recommended.",
      requires_engineering: false
    };
  }

  // Standard repair path
  return {
    disposition: "repair",
    reason: "Local repair is feasible. Follow repair plan with prerequisites.",
    requires_engineering: false
  };
}

// Estimate difficulty
function estimateDifficulty(discontinuities, weldContext) {
  var maxSeverity = 0;
  for (var i = 0; i < discontinuities.length; i++) {
    var dtype = discontinuities[i].type || "";
    if (dtype.indexOf("crack") >= 0) maxSeverity = Math.max(maxSeverity, 4);
    else if (dtype.indexOf("fusion") >= 0 || dtype.indexOf("penetration") >= 0) maxSeverity = Math.max(maxSeverity, 3);
    else if (dtype.indexOf("porosity") >= 0 || dtype.indexOf("slag") >= 0) maxSeverity = Math.max(maxSeverity, 2);
    else maxSeverity = Math.max(maxSeverity, 1);
  }

  var position = weldContext.position || "1G";
  var positionFactor = 0;
  if (position.indexOf("4") >= 0 || position.indexOf("overhead") >= 0) positionFactor = 2;
  else if (position.indexOf("3") >= 0 || position.indexOf("vertical") >= 0) positionFactor = 1;
  else if (position.indexOf("6G") >= 0 || position.indexOf("5G") >= 0) positionFactor = 2;

  var total = maxSeverity + positionFactor + discontinuities.length - 1;

  if (total >= 7) return "requires_specialist";
  if (total >= 5) return "complex";
  if (total >= 3) return "moderate";
  return "straightforward";
}

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return errResp(405, "POST only");

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "";
    var sb = createClient(supabaseUrl, supabaseKey);

    // ============================================================
    // ACTION: get_registry
    // ============================================================
    if (action === "get_registry") {
      return ok({
        engine: "repair-pathway-engine",
        version: "1.0.0",
        deploy: "DEPLOY263",
        mode: "deterministic",
        description: "Turns every reject into an actionable repair plan. Accept / Repair / Cut-Out-and-Rerun with prerequisites, procedure steps, and reinspection requirements.",
        capabilities: [
          "get_registry — engine overview",
          "generate_repair_plan — full repair pathway for a rejected weld with method selection, prerequisites, procedure steps, reinspection plan",
          "get_repair_methods — list all 10 repair methods with filtering by category/discontinuity",
          "get_prerequisites — list all 10 prerequisites with verification methods",
          "check_prerequisites — verify which prerequisites are met for a specific repair",
          "get_code_rules — code-specific repair rules (D1.1 two-repair max, ASME VIII PWHT, etc.)",
          "record_repair — record a completed repair in location history",
          "get_repair_history — repair history for a location/case with count tracking",
          "get_reinspection_plan — NDE requirements for verifying the repair",
          "get_repair_stats — aggregate repair statistics across assessments"
        ],
        repair_methods: 10,
        prerequisites: 10,
        code_rules: 12,
        codes_covered: ["AWS_D1.1", "AWS_D1.5", "API_1104", "ASME_VIII", "ASME_B31.3"],
        principle: "A rejection without a repair plan is incomplete. Every reject must answer: what to fix, how to fix it, what prerequisites must be met, and how to verify the repair."
      });
    }

    // ============================================================
    // ACTION: generate_repair_plan
    // ============================================================
    if (action === "generate_repair_plan") {
      var discontinuities = body.discontinuities || [];
      var weldContext = body.weld_context || {};
      var codeFamily = body.code_family || weldContext.code_family || "AWS_D1.1";
      var assessmentId = body.assessment_id || null;
      var caseId = body.case_id || null;
      var orgId = body.org_id || null;
      var locationId = body.location_id || body.weld_id || null;

      if (discontinuities.length === 0) return errResp(400, "discontinuities array required (each with type, and optionally severity, measured, limit)");

      // Fetch repair methods
      var methodsResult = await sb.from("repair_method_registry").select("*").eq("is_active", true);
      if (methodsResult.error) return errResp(500, "Failed to fetch methods: " + methodsResult.error.message);
      var methods = methodsResult.data || [];

      // Fetch code rules
      var rulesResult = await sb.from("repair_code_rules").select("*").eq("code_family", codeFamily);
      var codeRules = (rulesResult.data || []);

      // Fetch prerequisites
      var prereqResult = await sb.from("repair_prerequisites").select("*");
      var prerequisites = (prereqResult.data || []);

      // Check repair history at this location
      var repairCount = 0;
      var maxRepairs = 2;
      if (locationId) {
        var histQuery = sb.from("repair_history").select("id", { count: "exact", head: true });
        if (locationId) histQuery = histQuery.eq("location_id", locationId);
        if (orgId) histQuery = histQuery.eq("org_id", orgId);
        var histResult = await histQuery;
        repairCount = histResult.count || 0;
      }

      // Check code-specific repair limit
      for (var rl = 0; rl < codeRules.length; rl++) {
        if (codeRules[rl].rule_type === "repair_limit" && codeRules[rl].parameters && codeRules[rl].parameters.max_repairs) {
          maxRepairs = codeRules[rl].parameters.max_repairs;
          break;
        }
      }

      // Determine disposition
      var dispResult = determineRepairDisposition(discontinuities, repairCount, maxRepairs, codeRules);

      // Select repair methods for each discontinuity
      var repairPlan = [];
      var allReinspection = [];
      for (var di = 0; di < discontinuities.length; di++) {
        var disc = discontinuities[di];
        var candidates = selectRepairMethod(methods, disc, weldContext);

        var methodPlan = {
          discontinuity: disc,
          recommended_method: null,
          alternative_methods: [],
          prerequisites_required: [],
          procedure_steps: [],
          reinspection: []
        };

        if (candidates.length > 0) {
          var best = candidates[0].method;
          methodPlan.recommended_method = {
            method_code: best.method_code,
            method_name: best.method_name,
            category: best.category,
            risk_level: best.risk_level,
            typical_success_rate: best.typical_success_rate,
            material_compatible: candidates[0].material_compatible,
            process_compatible: candidates[0].process_compatible
          };
          methodPlan.procedure_steps = best.procedure_steps || [];
          methodPlan.prerequisites_required = best.prerequisites || [];
          methodPlan.reinspection = best.reinspection_required || [];

          // Add reinspection items to master list
          for (var ri = 0; ri < (best.reinspection_required || []).length; ri++) {
            var reinspItem = best.reinspection_required[ri];
            if (allReinspection.indexOf(reinspItem) < 0) {
              allReinspection.push(reinspItem);
            }
          }

          // Add alternatives
          for (var ai = 1; ai < Math.min(candidates.length, 3); ai++) {
            methodPlan.alternative_methods.push({
              method_code: candidates[ai].method.method_code,
              method_name: candidates[ai].method.method_name,
              category: candidates[ai].method.category,
              score: candidates[ai].score
            });
          }
        } else {
          methodPlan.recommended_method = {
            method_code: "RM-004",
            method_name: "Cut Out and Rerun",
            category: "cut_out_and_rerun",
            risk_level: "high",
            note: "No specific repair method matches — full removal and reweld recommended"
          };
        }

        repairPlan.push(methodPlan);
      }

      // Build prerequisites checklist
      var prereqChecklist = [];
      var prereqCodes = {};
      for (var pp = 0; pp < repairPlan.length; pp++) {
        var reqs = repairPlan[pp].prerequisites_required || [];
        for (var pr = 0; pr < reqs.length; pr++) {
          prereqCodes[reqs[pr]] = true;
        }
      }

      // Always include core prerequisites
      prereqCodes["Qualified repair WPS"] = true;
      prereqCodes["Qualified welder for repair process"] = true;

      for (var pk in prereqCodes) {
        prereqChecklist.push({
          requirement: pk,
          met: false,
          verified_by: null
        });
      }

      // Estimate difficulty
      var difficulty = estimateDifficulty(discontinuities, weldContext);

      // Generate teaching notes
      var teachingParts = [];
      if (dispResult.disposition === "cut_out_and_rerun") {
        teachingParts.push("This weld requires complete removal and rewelding rather than local repair.");
        if (repairCount >= maxRepairs) {
          teachingParts.push("The " + codeFamily + " repair limit (" + maxRepairs + " repairs) has been reached at this location.");
        }
      } else {
        teachingParts.push("This weld can be repaired locally. Follow the repair plan for each discontinuity in order of severity.");
      }
      if (difficulty === "requires_specialist" || difficulty === "complex") {
        teachingParts.push("This repair is " + difficulty + " — consider whether a more experienced welder should perform the repair.");
      }
      teachingParts.push("Remember: every repair requires reinspection using the same NDE method that found the original defect.");

      // Save assessment
      if (assessmentId || caseId) {
        await sb.from("repair_pathway_assessments").insert({
          org_id: orgId,
          assessment_id: assessmentId,
          case_id: caseId,
          disposition: dispResult.disposition,
          discontinuities: discontinuities,
          weld_context: weldContext,
          repair_plan: repairPlan,
          prerequisites_checked: prereqChecklist,
          all_prerequisites_met: false,
          code_rules_applied: codeRules.map(function(r) { return { rule_code: r.rule_code, rule_name: r.rule_name }; }),
          repair_count_at_location: repairCount,
          max_repairs_allowed: maxRepairs,
          repair_limit_exceeded: repairCount >= maxRepairs,
          reinspection_plan: allReinspection,
          estimated_difficulty: difficulty,
          teaching_notes: teachingParts.join(" ")
        });

        await sb.from("repair_audit_events").insert({
          org_id: orgId,
          assessment_id: assessmentId,
          event_type: "pathway_generated",
          event_data: {
            disposition: dispResult.disposition,
            discontinuity_count: discontinuities.length,
            repair_count: repairCount,
            difficulty: difficulty
          },
          actor: body.generated_by || "system"
        });
      }

      return ok({
        action: "generate_repair_plan",
        disposition: dispResult.disposition,
        disposition_reason: dispResult.reason,
        requires_engineering_approval: dispResult.requires_engineering,
        repair_count_at_location: repairCount,
        max_repairs_allowed: maxRepairs,
        repair_limit_exceeded: repairCount >= maxRepairs,
        estimated_difficulty: difficulty,
        repair_plan: repairPlan,
        prerequisites_checklist: prereqChecklist,
        reinspection_plan: allReinspection,
        code_rules_applied: codeRules.map(function(r) { return { rule_code: r.rule_code, rule_name: r.rule_name, description: r.rule_description, clause: r.clause_reference }; }),
        teaching_notes: teachingParts.join(" "),
        message: dispResult.disposition === "repair"
          ? "Repair plan generated with " + repairPlan.length + " repair step(s). Verify all prerequisites before starting."
          : "Cut-out and rerun required. " + dispResult.reason
      });
    }

    // ============================================================
    // ACTION: get_repair_methods
    // ============================================================
    if (action === "get_repair_methods") {
      var rmQuery = sb.from("repair_method_registry").select("*").eq("is_active", true).order("method_code");
      if (body.category) rmQuery = rmQuery.eq("category", body.category);
      var rmResult = await rmQuery;
      if (rmResult.error) return errResp(500, rmResult.error.message);

      // Filter by discontinuity if provided
      var filtered = rmResult.data || [];
      if (body.discontinuity_type) {
        var discFiltered = [];
        for (var fi = 0; fi < filtered.length; fi++) {
          for (var fd = 0; fd < filtered[fi].applicable_discontinuities.length; fd++) {
            if (filtered[fi].applicable_discontinuities[fd].indexOf(body.discontinuity_type) >= 0 ||
                body.discontinuity_type.indexOf(filtered[fi].applicable_discontinuities[fd]) >= 0) {
              discFiltered.push(filtered[fi]);
              break;
            }
          }
        }
        filtered = discFiltered;
      }

      return ok({
        action: "get_repair_methods",
        count: filtered.length,
        methods: filtered
      });
    }

    // ============================================================
    // ACTION: get_prerequisites
    // ============================================================
    if (action === "get_prerequisites") {
      var pqQuery = sb.from("repair_prerequisites").select("*").order("prerequisite_code");
      if (body.category) pqQuery = pqQuery.eq("category", body.category);
      var pqResult = await pqQuery;
      if (pqResult.error) return errResp(500, pqResult.error.message);
      return ok({
        action: "get_prerequisites",
        count: pqResult.data.length,
        prerequisites: pqResult.data
      });
    }

    // ============================================================
    // ACTION: check_prerequisites
    // ============================================================
    if (action === "check_prerequisites") {
      var cpChecks = body.checks || [];
      if (cpChecks.length === 0) return errResp(400, "checks array required — each with prerequisite_code and met (boolean)");

      var prereqsResult = await sb.from("repair_prerequisites").select("*");
      var allPrereqs = prereqsResult.data || [];

      var results = [];
      var allMet = true;
      var mandatoryFailed = [];

      for (var ci = 0; ci < cpChecks.length; ci++) {
        var check = cpChecks[ci];
        var prereq = null;
        for (var pi = 0; pi < allPrereqs.length; pi++) {
          if (allPrereqs[pi].prerequisite_code === check.prerequisite_code) {
            prereq = allPrereqs[pi];
            break;
          }
        }

        var met = check.met === true;
        if (!met) allMet = false;
        if (!met && prereq && prereq.is_mandatory) {
          mandatoryFailed.push({
            code: check.prerequisite_code,
            name: prereq ? prereq.prerequisite_name : check.prerequisite_code,
            consequence: prereq ? prereq.failure_consequence : "Repair may not proceed"
          });
        }

        results.push({
          prerequisite_code: check.prerequisite_code,
          prerequisite_name: prereq ? prereq.prerequisite_name : "Unknown",
          met: met,
          is_mandatory: prereq ? prereq.is_mandatory : true,
          verified_by: check.verified_by || null,
          notes: check.notes || null
        });
      }

      return ok({
        action: "check_prerequisites",
        all_met: allMet,
        mandatory_failures: mandatoryFailed.length,
        repair_allowed: mandatoryFailed.length === 0,
        results: results,
        mandatory_failed: mandatoryFailed,
        message: mandatoryFailed.length === 0
          ? "All mandatory prerequisites met. Repair may proceed."
          : mandatoryFailed.length + " mandatory prerequisite(s) not met. Repair BLOCKED."
      });
    }

    // ============================================================
    // ACTION: get_code_rules
    // ============================================================
    if (action === "get_code_rules") {
      var crFamily = body.code_family || null;
      var crQuery = sb.from("repair_code_rules").select("*").order("rule_code");
      if (crFamily) crQuery = crQuery.eq("code_family", crFamily);
      if (body.rule_type) crQuery = crQuery.eq("rule_type", body.rule_type);
      var crResult = await crQuery;
      if (crResult.error) return errResp(500, crResult.error.message);
      return ok({
        action: "get_code_rules",
        count: crResult.data.length,
        rules: crResult.data
      });
    }

    // ============================================================
    // ACTION: record_repair
    // ============================================================
    if (action === "record_repair") {
      var rrCaseId = body.case_id || null;
      var rrAssessmentId = body.assessment_id || null;
      var rrOrgId = body.org_id || null;
      var rrLocationId = body.location_id || body.weld_id || null;
      var rrMethod = body.repair_method || "";
      var rrDisc = body.discontinuity_repaired || "";

      if (!rrMethod) return errResp(400, "repair_method required");
      if (!rrDisc) return errResp(400, "discontinuity_repaired required");

      // Get current repair count at location
      var rrCount = 1;
      if (rrLocationId) {
        var rrHistCount = await sb.from("repair_history").select("id", { count: "exact", head: true }).eq("location_id", rrLocationId);
        rrCount = (rrHistCount.count || 0) + 1;
      }

      var rrInsert = await sb.from("repair_history").insert({
        org_id: rrOrgId,
        case_id: rrCaseId,
        assessment_id: rrAssessmentId,
        weld_id: body.weld_id || null,
        location_id: rrLocationId,
        repair_number: rrCount,
        repair_method: rrMethod,
        discontinuity_repaired: rrDisc,
        repair_wps: body.repair_wps || null,
        repaired_by: body.repaired_by || null,
        repaired_at: body.repaired_at || new Date().toISOString(),
        reinspection_method: body.reinspection_method || null,
        reinspection_result: body.reinspection_result || "pending",
        reinspected_by: body.reinspected_by || null,
        notes: body.notes || null
      }).select().single();

      if (rrInsert.error) return errResp(500, "Failed to record repair: " + rrInsert.error.message);

      // Check if approaching repair limit
      var limitWarning = null;
      if (rrCount >= 2) {
        limitWarning = "WARNING: " + rrCount + " repairs at this location. Most codes limit repairs to 2 before requiring cut-out and rerun or engineering approval.";

        await sb.from("repair_audit_events").insert({
          org_id: rrOrgId,
          assessment_id: rrAssessmentId,
          event_type: "repair_limit_warning",
          event_data: { location_id: rrLocationId, repair_count: rrCount },
          actor: body.repaired_by || "system"
        });
      }

      await sb.from("repair_audit_events").insert({
        org_id: rrOrgId,
        assessment_id: rrAssessmentId,
        event_type: "repair_completed",
        event_data: {
          repair_id: rrInsert.data.id,
          repair_number: rrCount,
          method: rrMethod,
          discontinuity: rrDisc
        },
        actor: body.repaired_by || "system"
      });

      return ok({
        action: "record_repair",
        repair: rrInsert.data,
        repair_number: rrCount,
        limit_warning: limitWarning,
        message: "Repair #" + rrCount + " recorded at this location." + (limitWarning ? " " + limitWarning : "")
      });
    }

    // ============================================================
    // ACTION: get_repair_history
    // ============================================================
    if (action === "get_repair_history") {
      var rhLocationId = body.location_id || null;
      var rhCaseId = body.case_id || null;
      if (!rhLocationId && !rhCaseId) return errResp(400, "location_id or case_id required");

      var rhQuery = sb.from("repair_history").select("*");
      if (rhLocationId) rhQuery = rhQuery.eq("location_id", rhLocationId);
      if (rhCaseId) rhQuery = rhQuery.eq("case_id", rhCaseId);
      var rhResult = await rhQuery.order("repair_number");

      if (rhResult.error) return errResp(500, rhResult.error.message);

      return ok({
        action: "get_repair_history",
        total_repairs: rhResult.data.length,
        repairs: rhResult.data,
        approaching_limit: rhResult.data.length >= 2,
        message: rhResult.data.length >= 2
          ? "WARNING: " + rhResult.data.length + " repairs at this location. Next rejection requires cut-out or engineering approval."
          : rhResult.data.length + " repair(s) recorded at this location."
      });
    }

    // ============================================================
    // ACTION: get_reinspection_plan
    // ============================================================
    if (action === "get_reinspection_plan") {
      var rpAssessmentId = body.assessment_id || null;
      var rpCaseId = body.case_id || null;
      var rpCodeFamily = body.code_family || "AWS_D1.1";

      // Get the repair pathway assessment
      var rpQuery = sb.from("repair_pathway_assessments").select("*");
      if (rpAssessmentId) rpQuery = rpQuery.eq("assessment_id", rpAssessmentId);
      if (rpCaseId) rpQuery = rpQuery.eq("case_id", rpCaseId);
      var rpResult = await rpQuery.order("generated_at", { ascending: false }).limit(1);

      if (rpResult.error) return errResp(500, rpResult.error.message);

      if (!rpResult.data || rpResult.data.length === 0) {
        // No saved assessment — build from code rules
        var rpRules = await sb.from("repair_code_rules").select("*").eq("code_family", rpCodeFamily).eq("rule_type", "reinspection_requirement");

        return ok({
          action: "get_reinspection_plan",
          source: "code_rules",
          code_family: rpCodeFamily,
          reinspection_requirements: (rpRules.data || []).map(function(r) {
            return { rule: r.rule_name, description: r.rule_description, clause: r.clause_reference, parameters: r.parameters };
          }),
          general_principle: "Repaired welds must be reinspected using the same NDE method(s) and acceptance criteria that found the original defect."
        });
      }

      var pathway = rpResult.data[0];
      return ok({
        action: "get_reinspection_plan",
        source: "repair_pathway",
        reinspection_methods: pathway.reinspection_plan,
        repair_plan_summary: {
          disposition: pathway.disposition,
          discontinuity_count: (pathway.discontinuities || []).length,
          difficulty: pathway.estimated_difficulty
        },
        general_principle: "Repaired welds must be reinspected using the same NDE method(s) and acceptance criteria that found the original defect."
      });
    }

    // ============================================================
    // ACTION: get_repair_stats
    // ============================================================
    if (action === "get_repair_stats") {
      var rsOrgId = body.org_id || null;

      var rsQuery = sb.from("repair_history").select("repair_method, discontinuity_repaired, reinspection_result, location_id");
      if (rsOrgId) rsQuery = rsQuery.eq("org_id", rsOrgId);
      var rsResult = await rsQuery;
      var data = rsResult.data || [];

      var byMethod = {};
      var byDisc = {};
      var byResult = { acceptable: 0, rejectable: 0, pending: 0, not_performed: 0 };
      var locationCounts = {};

      for (var si = 0; si < data.length; si++) {
        var item = data[si];
        byMethod[item.repair_method] = (byMethod[item.repair_method] || 0) + 1;
        byDisc[item.discontinuity_repaired] = (byDisc[item.discontinuity_repaired] || 0) + 1;
        if (item.reinspection_result) byResult[item.reinspection_result] = (byResult[item.reinspection_result] || 0) + 1;
        if (item.location_id) locationCounts[item.location_id] = (locationCounts[item.location_id] || 0) + 1;
      }

      var multiRepairLocations = 0;
      for (var lk in locationCounts) {
        if (locationCounts[lk] >= 2) multiRepairLocations++;
      }

      return ok({
        action: "get_repair_stats",
        total_repairs: data.length,
        by_method: byMethod,
        by_discontinuity: byDisc,
        reinspection_results: byResult,
        success_rate: data.length > 0 ? Math.round(byResult.acceptable / Math.max(1, byResult.acceptable + byResult.rejectable) * 100) : 0,
        locations_with_multiple_repairs: multiRepairLocations,
        message: data.length > 0 ? data.length + " repairs recorded. " + byResult.acceptable + " passed reinspection, " + byResult.rejectable + " failed." : "No repairs recorded yet."
      });
    }

    return errResp(400, "Unknown action: " + action + ". Valid: get_registry, generate_repair_plan, get_repair_methods, get_prerequisites, check_prerequisites, get_code_rules, record_repair, get_repair_history, get_reinspection_plan, get_repair_stats");

  } catch (e) {
    return errResp(500, String(e && e.message ? e.message : e));
  }
};
