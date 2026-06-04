// @ts-nocheck
/**
 * DEPLOY261 - authority-lock-system.ts
 * netlify/functions/authority-lock-system.ts
 *
 * AUTHORITY LOCK SYSTEM v1.0.0
 * "Which exact clause governs this disposition?"
 *
 * Pins the specific table/row/section of the governing code before any
 * accept/reject decision. Makes every disposition legally traceable.
 *
 * 10 actions:
 *   get_registry        — engine overview
 *   get_editions         — list active code editions
 *   get_clauses          — list clauses for a code family
 *   lookup_clause        — find governing clause for a given context
 *   lock_authority       — lock a clause to an assessment
 *   get_lock             — retrieve authority lock(s) for an assessment
 *   verify_lock          — verify lock validity (edition still active)
 *   get_clause_criteria  — get specific acceptance criteria within a clause
 *   get_clause_history   — audit trail for an assessment
 *   compare_clauses      — compare governing clauses across codes for same scenario
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
// Clause Lookup Engine
// Given a weld context, finds the governing clause
// ============================================================
function scoreClauseMatch(clause, context) {
  var score = 0;
  var matchDetails = [];

  // Code family must match
  if (clause.code_family !== context.code_family) return { score: -1, matchDetails: ["code_family_mismatch"] };

  // Loading condition match
  if (context.loading_condition && clause.applies_to_loading) {
    var loadingMatch = false;
    for (var i = 0; i < clause.applies_to_loading.length; i++) {
      if (clause.applies_to_loading[i] === context.loading_condition) {
        loadingMatch = true;
        break;
      }
    }
    if (loadingMatch) {
      score += 30;
      matchDetails.push("loading_match:" + context.loading_condition);
    } else {
      score -= 50;
      matchDetails.push("loading_mismatch");
    }
  }

  // Joint type match
  if (context.joint_type && clause.applies_to_joint_types) {
    var jointMatch = false;
    for (var j = 0; j < clause.applies_to_joint_types.length; j++) {
      if (clause.applies_to_joint_types[j] === context.joint_type) {
        jointMatch = true;
        break;
      }
    }
    if (jointMatch) {
      score += 20;
      matchDetails.push("joint_match:" + context.joint_type);
    } else {
      score -= 20;
      matchDetails.push("joint_mismatch");
    }
  }

  // Discontinuity type match
  if (context.discontinuity_type && clause.discontinuity_types) {
    var discMatch = false;
    for (var k = 0; k < clause.discontinuity_types.length; k++) {
      if (clause.discontinuity_types[k] === context.discontinuity_type) {
        discMatch = true;
        break;
      }
    }
    if (discMatch) {
      score += 25;
      matchDetails.push("discontinuity_match:" + context.discontinuity_type);
    }
  }

  // Governs category match
  if (context.examination_method) {
    var methodCategoryMap = {
      "VT": "visual_acceptance",
      "RT": "rt_acceptance",
      "UT": "ut_acceptance",
      "MT": "mt_pt_acceptance",
      "PT": "mt_pt_acceptance"
    };
    var expectedCategory = methodCategoryMap[context.examination_method];
    if (expectedCategory && clause.governs_category === expectedCategory) {
      score += 25;
      matchDetails.push("category_match:" + expectedCategory);
    }
  }

  // Is mandatory bonus
  if (clause.is_mandatory) {
    score += 5;
    matchDetails.push("mandatory");
  }

  // Priority rank (lower is higher priority)
  if (clause.priority_rank) {
    score += Math.max(0, 10 - Math.floor(clause.priority_rank / 10));
  }

  return { score: score, matchDetails: matchDetails };
}

function rankClauses(clauses, context) {
  var scored = [];
  for (var i = 0; i < clauses.length; i++) {
    var result = scoreClauseMatch(clauses[i], context);
    if (result.score >= 0) {
      scored.push({
        clause: clauses[i],
        score: result.score,
        match_details: result.matchDetails
      });
    }
  }
  scored.sort(function(a, b) { return b.score - a.score; });
  return scored;
}

// ============================================================
// Lock Verification
// ============================================================
function buildLockReason(context, matchDetails) {
  var parts = [];
  parts.push("Code: " + (context.code_family || "unknown"));
  if (context.loading_condition) parts.push("Loading: " + context.loading_condition);
  if (context.joint_type) parts.push("Joint: " + context.joint_type);
  if (context.examination_method) parts.push("Method: " + context.examination_method);
  if (context.discontinuity_type) parts.push("Discontinuity: " + context.discontinuity_type);
  parts.push("Match factors: " + matchDetails.join(", "));
  return parts.join(" | ");
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
        engine: "authority-lock-system",
        version: "1.0.0",
        deploy: "DEPLOY261",
        mode: "deterministic",
        description: "Pins the exact clause/table/section of the governing code to every disposition. Makes accept/reject decisions legally traceable.",
        capabilities: [
          "get_registry — engine overview",
          "get_editions — list active code editions with year and issuing body",
          "get_clauses — list all clauses for a code family with category filtering",
          "lookup_clause — find governing clause for a weld context (code + loading + joint + discontinuity + method)",
          "lock_authority — lock a specific clause to an assessment with full context snapshot",
          "get_lock — retrieve authority lock(s) for an assessment",
          "verify_lock — verify lock validity (edition still current, clause not superseded)",
          "get_clause_criteria — get specific acceptance/rejection criteria within a locked clause",
          "get_clause_history — full audit trail of lock events for an assessment",
          "compare_clauses — compare governing clauses across multiple codes for the same scenario"
        ],
        code_families_tracked: ["AWS_D1.1", "AWS_D1.2", "AWS_D1.3", "AWS_D1.5", "AWS_D1.6", "API_1104", "ASME_VIII", "ASME_B31.3", "ASME_IX"],
        clause_categories: ["visual_acceptance", "rt_acceptance", "ut_acceptance", "mt_pt_acceptance", "weld_size", "preheat", "interpass", "joint_design", "qualification", "procedure", "repair", "general_requirement"],
        principle: "No disposition without a locked clause. The system identifies WHICH SPECIFIC RULE governs before allowing accept/reject."
      });
    }

    // ============================================================
    // ACTION: get_editions
    // ============================================================
    if (action === "get_editions") {
      var edFilter = body.code_family || null;
      var edQuery = sb.from("authority_code_editions").select("*").eq("is_active", true).order("code_family");
      if (edFilter) edQuery = edQuery.eq("code_family", edFilter);
      var edResult = await edQuery;
      if (edResult.error) return err(500, edResult.error.message);
      return ok({
        action: "get_editions",
        count: edResult.data.length,
        editions: edResult.data
      });
    }

    // ============================================================
    // ACTION: get_clauses
    // ============================================================
    if (action === "get_clauses") {
      var cfFamily = body.code_family;
      if (!cfFamily) return err(400, "code_family required");
      var cfQuery = sb.from("authority_clause_registry").select("*").eq("code_family", cfFamily).order("priority_rank");
      if (body.governs_category) cfQuery = cfQuery.eq("governs_category", body.governs_category);
      var cfResult = await cfQuery;
      if (cfResult.error) return err(500, cfResult.error.message);
      return ok({
        action: "get_clauses",
        code_family: cfFamily,
        count: cfResult.data.length,
        clauses: cfResult.data
      });
    }

    // ============================================================
    // ACTION: lookup_clause
    // Find the governing clause for a given context
    // ============================================================
    if (action === "lookup_clause") {
      var lookupContext = {
        code_family: body.code_family,
        loading_condition: body.loading_condition || "static",
        joint_type: body.joint_type || null,
        weld_type: body.weld_type || null,
        discontinuity_type: body.discontinuity_type || null,
        examination_method: body.examination_method || "VT",
        thickness_mm: body.thickness_mm || null,
        material_group: body.material_group || null,
        application: body.application || null,
        connection_type: body.connection_type || "nontubular"
      };

      if (!lookupContext.code_family) return err(400, "code_family required");

      // Fetch all clauses for this code family
      var lcResult = await sb.from("authority_clause_registry").select("*").eq("code_family", lookupContext.code_family);
      if (lcResult.error) return err(500, lcResult.error.message);

      var ranked = rankClauses(lcResult.data, lookupContext);

      if (ranked.length === 0) {
        return ok({
          action: "lookup_clause",
          context: lookupContext,
          governing_clause: null,
          message: "No matching clause found for the given context. Manual code review required.",
          alternatives: []
        });
      }

      var governing = ranked[0];
      var alternatives = [];
      for (var ai = 1; ai < Math.min(ranked.length, 4); ai++) {
        alternatives.push({
          clause_number: ranked[ai].clause.clause_number,
          clause_title: ranked[ai].clause.clause_title,
          score: ranked[ai].score,
          match_details: ranked[ai].match_details,
          why_not_primary: ranked[ai].score < governing.score ? "Lower match score (" + ranked[ai].score + " vs " + governing.score + ")" : "Equal score but lower priority"
        });
      }

      // Also fetch criteria for the governing clause
      var criteriaResult = await sb.from("authority_clause_criteria").select("*").eq("clause_id", governing.clause.id);
      var criteria = (criteriaResult.data || []);

      // Filter criteria to matching discontinuity if specified
      var relevantCriteria = criteria;
      if (lookupContext.discontinuity_type) {
        var filtered = [];
        for (var ci = 0; ci < criteria.length; ci++) {
          if (criteria[ci].discontinuity_type === lookupContext.discontinuity_type) {
            filtered.push(criteria[ci]);
          }
        }
        if (filtered.length > 0) relevantCriteria = filtered;
      }

      return ok({
        action: "lookup_clause",
        context: lookupContext,
        governing_clause: {
          id: governing.clause.id,
          clause_number: governing.clause.clause_number,
          clause_title: governing.clause.clause_title,
          clause_type: governing.clause.clause_type,
          governs_category: governing.clause.governs_category,
          description: governing.clause.description,
          is_mandatory: governing.clause.is_mandatory,
          match_score: governing.score,
          match_details: governing.match_details
        },
        acceptance_criteria: relevantCriteria,
        lock_ready: true,
        lock_reason: buildLockReason(lookupContext, governing.match_details),
        alternatives: alternatives,
        total_candidates_evaluated: lcResult.data.length
      });
    }

    // ============================================================
    // ACTION: lock_authority
    // Lock a clause to an assessment — no disposition without this
    // ============================================================
    if (action === "lock_authority") {
      var lockClauseId = body.clause_id;
      var lockAssessmentId = body.assessment_id || null;
      var lockCaseId = body.case_id || null;
      var lockReason = body.lock_reason || "Manual lock";
      var lockContext = body.context || {};
      var lockBy = body.locked_by || "system";
      var lockOrgId = body.org_id || null;

      if (!lockClauseId) return err(400, "clause_id required");
      if (!lockAssessmentId && !lockCaseId) return err(400, "assessment_id or case_id required");

      // Fetch the clause details
      var clauseCheck = await sb.from("authority_clause_registry").select("*").eq("id", lockClauseId).single();
      if (clauseCheck.error) return err(404, "Clause not found: " + clauseCheck.error.message);
      var clauseData = clauseCheck.data;

      // Fetch the active edition
      var edCheck = await sb.from("authority_code_editions").select("*").eq("code_family", clauseData.code_family).eq("is_active", true).limit(1);
      var editionId = (edCheck.data && edCheck.data.length > 0) ? edCheck.data[0].id : null;

      // Deactivate any existing active locks for this assessment + category
      if (lockAssessmentId) {
        var existingLocks = await sb.from("authority_locks").select("id").eq("assessment_id", lockAssessmentId).eq("is_active", true);
        if (existingLocks.data) {
          for (var eli = 0; eli < existingLocks.data.length; eli++) {
            await sb.from("authority_locks").update({ is_active: false, superseded_by: null }).eq("id", existingLocks.data[eli].id);
          }
        }
      }

      // Create the lock
      var lockInsert = await sb.from("authority_locks").insert({
        org_id: lockOrgId,
        assessment_id: lockAssessmentId,
        case_id: lockCaseId,
        clause_id: lockClauseId,
        edition_id: editionId,
        code_family: clauseData.code_family,
        clause_number: clauseData.clause_number,
        clause_title: clauseData.clause_title,
        lock_reason: lockReason,
        context_snapshot: lockContext,
        locked_by: lockBy,
        is_active: true
      }).select().single();

      if (lockInsert.error) return err(500, "Failed to create lock: " + lockInsert.error.message);

      // Audit event
      await sb.from("authority_lock_audit").insert({
        org_id: lockOrgId,
        lock_id: lockInsert.data.id,
        event_type: "lock_created",
        event_data: {
          clause_number: clauseData.clause_number,
          clause_title: clauseData.clause_title,
          code_family: clauseData.code_family,
          lock_reason: lockReason,
          context_snapshot: lockContext
        },
        actor: lockBy
      });

      return ok({
        action: "lock_authority",
        lock: lockInsert.data,
        clause: {
          clause_number: clauseData.clause_number,
          clause_title: clauseData.clause_title,
          code_family: clauseData.code_family,
          governs_category: clauseData.governs_category,
          description: clauseData.description
        },
        edition: (edCheck.data && edCheck.data.length > 0) ? {
          edition_year: edCheck.data[0].edition_year,
          full_title: edCheck.data[0].full_title
        } : null,
        message: "Authority locked. Disposition is now traceable to " + clauseData.code_family + " " + clauseData.clause_number + "."
      });
    }

    // ============================================================
    // ACTION: get_lock
    // Retrieve active authority lock(s) for an assessment
    // ============================================================
    if (action === "get_lock") {
      var glAssessmentId = body.assessment_id || null;
      var glCaseId = body.case_id || null;
      if (!glAssessmentId && !glCaseId) return err(400, "assessment_id or case_id required");

      var glQuery = sb.from("authority_locks").select("*").eq("is_active", true);
      if (glAssessmentId) glQuery = glQuery.eq("assessment_id", glAssessmentId);
      if (glCaseId) glQuery = glQuery.eq("case_id", glCaseId);
      var glResult = await glQuery.order("locked_at", { ascending: false });

      if (glResult.error) return err(500, glResult.error.message);

      return ok({
        action: "get_lock",
        assessment_id: glAssessmentId,
        case_id: glCaseId,
        active_locks: glResult.data.length,
        locks: glResult.data,
        disposition_allowed: glResult.data.length > 0,
        message: glResult.data.length > 0
          ? "Authority locked to " + glResult.data[0].code_family + " " + glResult.data[0].clause_number + ". Disposition may proceed."
          : "No active authority lock. Disposition BLOCKED until a governing clause is locked."
      });
    }

    // ============================================================
    // ACTION: verify_lock
    // Verify a lock is still valid (edition current, clause not superseded)
    // ============================================================
    if (action === "verify_lock") {
      var vlLockId = body.lock_id || null;
      var vlAssessmentId = body.assessment_id || null;

      if (!vlLockId && !vlAssessmentId) return err(400, "lock_id or assessment_id required");

      var vlQuery = sb.from("authority_locks").select("*").eq("is_active", true);
      if (vlLockId) vlQuery = vlQuery.eq("id", vlLockId);
      if (vlAssessmentId) vlQuery = vlQuery.eq("assessment_id", vlAssessmentId);
      var vlResult = await vlQuery;

      if (vlResult.error) return err(500, vlResult.error.message);
      if (!vlResult.data || vlResult.data.length === 0) {
        return ok({
          action: "verify_lock",
          valid: false,
          reason: "No active lock found",
          disposition_allowed: false
        });
      }

      var lock = vlResult.data[0];
      var verifyResults = [];
      var allValid = true;

      for (var vi = 0; vi < vlResult.data.length; vi++) {
        var vLock = vlResult.data[vi];
        var vValid = true;
        var vReasons = [];

        // Check edition is still active
        if (vLock.edition_id) {
          var edVerify = await sb.from("authority_code_editions").select("is_active, edition_year").eq("id", vLock.edition_id).single();
          if (edVerify.error || !edVerify.data || !edVerify.data.is_active) {
            vValid = false;
            vReasons.push("Code edition is no longer active — lock may reference superseded criteria");
          }
        }

        // Check clause still exists
        var clauseVerify = await sb.from("authority_clause_registry").select("id, clause_number").eq("id", vLock.clause_id).single();
        if (clauseVerify.error) {
          vValid = false;
          vReasons.push("Clause record not found — may have been deleted or modified");
        }

        if (!vValid) allValid = false;

        verifyResults.push({
          lock_id: vLock.id,
          clause_number: vLock.clause_number,
          code_family: vLock.code_family,
          valid: vValid,
          reasons: vReasons.length > 0 ? vReasons : ["Lock is valid — edition active, clause exists"],
          locked_at: vLock.locked_at
        });

        // Audit the verification
        await sb.from("authority_lock_audit").insert({
          org_id: vLock.org_id,
          lock_id: vLock.id,
          event_type: "lock_verified",
          event_data: { valid: vValid, reasons: vReasons },
          actor: body.verified_by || "system"
        });
      }

      return ok({
        action: "verify_lock",
        valid: allValid,
        locks_checked: verifyResults.length,
        results: verifyResults,
        disposition_allowed: allValid,
        message: allValid
          ? "All authority locks verified valid. Disposition may proceed."
          : "One or more locks are invalid. Re-lock with current edition before disposition."
      });
    }

    // ============================================================
    // ACTION: get_clause_criteria
    // Get acceptance/rejection criteria for a specific clause
    // ============================================================
    if (action === "get_clause_criteria") {
      var ccClauseId = body.clause_id || null;
      var ccClauseNumber = body.clause_number || null;
      var ccCodeFamily = body.code_family || null;

      if (!ccClauseId && (!ccClauseNumber || !ccCodeFamily)) {
        return err(400, "clause_id, or clause_number + code_family required");
      }

      // Resolve clause_id if not provided
      if (!ccClauseId) {
        var ccLookup = await sb.from("authority_clause_registry").select("id").eq("code_family", ccCodeFamily).eq("clause_number", ccClauseNumber).limit(1);
        if (ccLookup.error || !ccLookup.data || ccLookup.data.length === 0) {
          return err(404, "Clause not found: " + ccCodeFamily + " " + ccClauseNumber);
        }
        ccClauseId = ccLookup.data[0].id;
      }

      var ccQuery = sb.from("authority_clause_criteria").select("*").eq("clause_id", ccClauseId);
      if (body.discontinuity_type) ccQuery = ccQuery.eq("discontinuity_type", body.discontinuity_type);
      var ccResult = await ccQuery;

      if (ccResult.error) return err(500, ccResult.error.message);

      return ok({
        action: "get_clause_criteria",
        clause_id: ccClauseId,
        count: ccResult.data.length,
        criteria: ccResult.data,
        summary: {
          prohibited: ccResult.data.filter(function(c) { return c.limit_type === "prohibited"; }).length,
          dimensional_limits: ccResult.data.filter(function(c) { return c.limit_type === "max_dimension"; }).length,
          conditional: ccResult.data.filter(function(c) { return c.limit_type === "conditional"; }).length
        }
      });
    }

    // ============================================================
    // ACTION: get_clause_history
    // Full audit trail for an assessment's authority locks
    // ============================================================
    if (action === "get_clause_history") {
      var chAssessmentId = body.assessment_id || null;
      var chCaseId = body.case_id || null;
      if (!chAssessmentId && !chCaseId) return err(400, "assessment_id or case_id required");

      // Get all locks (active and inactive) for this assessment
      var chLockQuery = sb.from("authority_locks").select("*");
      if (chAssessmentId) chLockQuery = chLockQuery.eq("assessment_id", chAssessmentId);
      if (chCaseId) chLockQuery = chLockQuery.eq("case_id", chCaseId);
      var chLocks = await chLockQuery.order("locked_at", { ascending: true });

      if (chLocks.error) return err(500, chLocks.error.message);

      // Get all audit events for these locks
      var lockIds = [];
      for (var chi = 0; chi < (chLocks.data || []).length; chi++) {
        lockIds.push(chLocks.data[chi].id);
      }

      var chAudit = { data: [] };
      if (lockIds.length > 0) {
        chAudit = await sb.from("authority_lock_audit").select("*").in("lock_id", lockIds).order("created_at", { ascending: true });
      }

      return ok({
        action: "get_clause_history",
        assessment_id: chAssessmentId,
        case_id: chCaseId,
        total_locks: (chLocks.data || []).length,
        active_locks: (chLocks.data || []).filter(function(l) { return l.is_active; }).length,
        superseded_locks: (chLocks.data || []).filter(function(l) { return !l.is_active; }).length,
        locks: chLocks.data || [],
        audit_events: chAudit.data || [],
        timeline: (chAudit.data || []).map(function(e) {
          return {
            event: e.event_type,
            timestamp: e.created_at,
            actor: e.actor,
            detail: e.event_data
          };
        })
      });
    }

    // ============================================================
    // ACTION: compare_clauses
    // Compare governing clauses across codes for the same scenario
    // ============================================================
    if (action === "compare_clauses") {
      var cmpCodeFamilies = body.code_families || [];
      var cmpContext = {
        loading_condition: body.loading_condition || "static",
        joint_type: body.joint_type || null,
        discontinuity_type: body.discontinuity_type || null,
        examination_method: body.examination_method || "VT",
        connection_type: body.connection_type || "nontubular"
      };

      if (cmpCodeFamilies.length === 0) return err(400, "code_families array required (e.g. ['AWS_D1.1', 'AWS_D1.5', 'API_1104'])");

      var comparisons = [];
      for (var cfi = 0; cfi < cmpCodeFamilies.length; cfi++) {
        var cmpFamily = cmpCodeFamilies[cfi];
        var cmpLookupContext = {
          code_family: cmpFamily,
          loading_condition: cmpContext.loading_condition,
          joint_type: cmpContext.joint_type,
          discontinuity_type: cmpContext.discontinuity_type,
          examination_method: cmpContext.examination_method,
          connection_type: cmpContext.connection_type
        };

        var cmpClauses = await sb.from("authority_clause_registry").select("*").eq("code_family", cmpFamily);
        if (cmpClauses.error || !cmpClauses.data) {
          comparisons.push({
            code_family: cmpFamily,
            governing_clause: null,
            error: "Failed to fetch clauses"
          });
          continue;
        }

        var cmpRanked = rankClauses(cmpClauses.data, cmpLookupContext);

        if (cmpRanked.length === 0) {
          comparisons.push({
            code_family: cmpFamily,
            governing_clause: null,
            message: "No matching clause found"
          });
          continue;
        }

        var cmpGoverning = cmpRanked[0];

        // Fetch criteria for comparison
        var cmpCriteria = await sb.from("authority_clause_criteria").select("*").eq("clause_id", cmpGoverning.clause.id);
        var relevantCmp = (cmpCriteria.data || []);
        if (cmpContext.discontinuity_type) {
          var filteredCmp = [];
          for (var fci = 0; fci < relevantCmp.length; fci++) {
            if (relevantCmp[fci].discontinuity_type === cmpContext.discontinuity_type) {
              filteredCmp.push(relevantCmp[fci]);
            }
          }
          if (filteredCmp.length > 0) relevantCmp = filteredCmp;
        }

        comparisons.push({
          code_family: cmpFamily,
          governing_clause: {
            clause_number: cmpGoverning.clause.clause_number,
            clause_title: cmpGoverning.clause.clause_title,
            governs_category: cmpGoverning.clause.governs_category,
            match_score: cmpGoverning.score
          },
          criteria_count: relevantCmp.length,
          criteria: relevantCmp,
          strictness_indicators: {
            has_prohibited: relevantCmp.some(function(c) { return c.limit_type === "prohibited"; }),
            prohibited_count: relevantCmp.filter(function(c) { return c.limit_type === "prohibited"; }).length,
            has_dimensional_limits: relevantCmp.some(function(c) { return c.limit_type === "max_dimension"; }),
            smallest_limit: relevantCmp.filter(function(c) { return c.limit_value !== null; }).sort(function(a, b) { return parseFloat(a.limit_value) - parseFloat(b.limit_value); })[0] || null
          }
        });
      }

      // Determine which code is most/least strict
      var strictnessRanking = comparisons.filter(function(c) { return c.governing_clause; }).sort(function(a, b) {
        return b.strictness_indicators.prohibited_count - a.strictness_indicators.prohibited_count;
      });

      // Audit the comparison
      await sb.from("authority_lock_audit").insert({
        org_id: body.org_id || null,
        lock_id: null,
        event_type: "comparison_run",
        event_data: {
          code_families: cmpCodeFamilies,
          context: cmpContext,
          results_count: comparisons.length
        },
        actor: body.compared_by || "system"
      });

      return ok({
        action: "compare_clauses",
        context: cmpContext,
        code_families_compared: cmpCodeFamilies.length,
        comparisons: comparisons,
        strictness_ranking: strictnessRanking.map(function(c) { return c.code_family; }),
        insight: strictnessRanking.length >= 2
          ? strictnessRanking[0].code_family + " is most restrictive (" + strictnessRanking[0].strictness_indicators.prohibited_count + " prohibited items). " + strictnessRanking[strictnessRanking.length - 1].code_family + " is least restrictive."
          : "Insufficient data for strictness comparison"
      });
    }

    return err(400, "Unknown action: " + action + ". Valid: get_registry, get_editions, get_clauses, lookup_clause, lock_authority, get_lock, verify_lock, get_clause_criteria, get_clause_history, compare_clauses");

  } catch (e) {
    return err(500, String(e && e.message ? e.message : e));
  }
};
