// @ts-nocheck
/**
 * DEPLOY226 - inspector-adjudication.ts
 * netlify/functions/inspector-adjudication.ts
 *
 * INSPECTOR ADJUDICATION ENGINE
 *
 * Allows inspectors to:
 *   CONCUR  — agree with the system decision (recorded for audit)
 *   OVERRIDE — disagree and provide alternative decision with rationale
 *   ESCALATE — flag for senior review with priority level
 *
 * The system decision is NEVER modified. The inspector's decision is
 * recorded alongside it. The final case disposition becomes the inspector's
 * decision, but the system decision is preserved for comparison.
 *
 * POST /api/inspector-adjudication
 *   { action: "submit", case_id, adjudication_type, rationale, ... }
 *   { action: "get_history", case_id }
 *   { action: "get_stats", case_id? }
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var EXECUTION_MODE = "deterministic";
var ENGINE_VERSION = "inspector-adjudication/1.0.0";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

var VALID_TYPES = ["concur", "override", "escalate"];
var VALID_PRIORITIES = ["routine", "elevated", "urgent", "emergency"];

// ================================================================
// ACTION 1: SUBMIT ADJUDICATION
// ================================================================
async function submitAdjudication(sb, params, userInfo) {
  var caseId = params.case_id;
  var adjType = params.adjudication_type;
  var rationale = params.rationale;

  // Validate inputs
  if (!caseId) return { success: false, error: "case_id required" };
  if (!adjType || VALID_TYPES.indexOf(adjType) < 0) {
    return { success: false, error: "adjudication_type must be one of: " + VALID_TYPES.join(", ") };
  }
  if (!rationale || rationale.trim().length < 10) {
    return { success: false, error: "rationale is required and must be at least 10 characters. Inspectors must explain their reasoning." };
  }

  // Override requires an override_decision
  if (adjType === "override" && !params.override_decision) {
    return { success: false, error: "override_decision is required when adjudication_type is 'override'. What should the decision be instead?" };
  }

  // Escalate requires escalate_to
  if (adjType === "escalate" && !params.escalate_to) {
    return { success: false, error: "escalate_to is required when adjudication_type is 'escalate'. Who should review this?" };
  }

  // Load current case state (snapshot at time of adjudication)
  var caseRes = await sb.from("inspection_cases")
    .select("id, case_number, decision_state, unified_confidence, disposition, precedence_tier, predicted_failure_date, remaining_life_months")
    .eq("id", caseId)
    .single();

  if (caseRes.error || !caseRes.data) {
    return { success: false, error: "Case not found" };
  }
  var caseRow = caseRes.data;

  // Build adjudication record
  var record = {
    case_id: caseId,
    inspector_id: userInfo.user_id || params.inspector_id || "00000000-0000-0000-0000-000000000000",
    inspector_email: userInfo.user_email || params.inspector_email || null,
    inspector_name: userInfo.user_name || params.inspector_name || null,
    inspector_cert_level: params.cert_level || null,
    adjudication_type: adjType,

    // System state snapshot
    system_decision_state: caseRow.decision_state,
    system_unified_confidence: caseRow.unified_confidence,
    system_disposition: caseRow.disposition,
    system_precedence_tier: caseRow.precedence_tier,
    system_predicted_failure_date: caseRow.predicted_failure_date,
    system_remaining_life_months: caseRow.remaining_life_months,

    // Inspector's override (if applicable)
    override_decision: adjType === "override" ? params.override_decision : null,
    override_disposition: adjType === "override" ? (params.override_disposition || null) : null,
    override_confidence: adjType === "override" ? (params.override_confidence || null) : null,

    // Always required
    rationale: rationale.trim(),
    evidence_references: params.evidence_references || [],
    additional_notes: params.additional_notes || null,

    // Escalation details
    escalate_to: adjType === "escalate" ? params.escalate_to : null,
    escalate_reason: adjType === "escalate" ? (params.escalate_reason || rationale.trim()) : null,
    escalation_priority: adjType === "escalate" ? (params.escalation_priority || "routine") : null
  };

  // Validate escalation priority
  if (record.escalation_priority && VALID_PRIORITIES.indexOf(record.escalation_priority) < 0) {
    return { success: false, error: "escalation_priority must be one of: " + VALID_PRIORITIES.join(", ") };
  }

  // Insert adjudication record
  var insertRes = await sb.from("inspector_adjudications").insert(record).select().single();
  if (insertRes.error) {
    return { success: false, error: "Failed to record adjudication: " + insertRes.error.message };
  }

  // Update case with adjudication metadata
  var caseUpdate = {
    adjudication_count: (caseRow.adjudication_count || 0) + 1,
    last_adjudication_type: adjType,
    last_adjudication_at: new Date().toISOString(),
    inspector_override_active: adjType === "override"
  };

  // If override, set inspector's final decision on the case
  if (adjType === "override") {
    caseUpdate.inspector_final_decision = params.override_decision;
  } else if (adjType === "concur") {
    caseUpdate.inspector_final_decision = "concurs_with_system";
  } else if (adjType === "escalate") {
    caseUpdate.inspector_final_decision = "escalated_to_" + params.escalate_to;
  }

  await sb.from("inspection_cases").update(caseUpdate).eq("id", caseId);

  // Log audit event (if enterprise-audit table exists)
  try {
    await sb.from("audit_events").insert({
      case_id: caseId,
      event_type: "inspector_" + adjType,
      event_category: "adjudication",
      actor_type: "user",
      actor_id: record.inspector_id,
      actor_email: record.inspector_email,
      actor_name: record.inspector_name,
      detail: {
        adjudication_id: insertRes.data.id,
        adjudication_type: adjType,
        system_state: caseRow.decision_state,
        system_confidence: caseRow.unified_confidence,
        override_decision: record.override_decision,
        rationale_length: rationale.length,
        evidence_count: record.evidence_references.length
      },
      execution_mode: EXECUTION_MODE,
      function_name: "inspector-adjudication"
    });
  } catch (auditErr) {
    // Non-critical: audit logging failure shouldn't block adjudication
  }

  return {
    success: true,
    adjudication_id: insertRes.data.id,
    adjudication_type: adjType,
    case_number: caseRow.case_number,
    system_decision: {
      state: caseRow.decision_state,
      confidence: caseRow.unified_confidence,
      disposition: caseRow.disposition
    },
    inspector_decision: {
      type: adjType,
      override_decision: record.override_decision,
      rationale: record.rationale,
      escalate_to: record.escalate_to,
      escalation_priority: record.escalation_priority
    },
    recorded_at: insertRes.data.created_at
  };
}

// ================================================================
// ACTION 2: GET HISTORY
// ================================================================
async function getHistory(sb, params) {
  var caseId = params.case_id;
  if (!caseId) return { success: false, error: "case_id required" };

  var caseRes = await sb.from("inspection_cases")
    .select("id, case_number, decision_state, unified_confidence, disposition, adjudication_count, last_adjudication_type, last_adjudication_at, inspector_final_decision, inspector_override_active")
    .eq("id", caseId)
    .single();

  if (caseRes.error || !caseRes.data) {
    return { success: false, error: "Case not found" };
  }

  var adjRes = await sb.from("inspector_adjudications")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  var adjudications = adjRes.data || [];

  // Build summary
  var concurs = adjudications.filter(function(a) { return a.adjudication_type === "concur"; });
  var overrides = adjudications.filter(function(a) { return a.adjudication_type === "override"; });
  var escalations = adjudications.filter(function(a) { return a.adjudication_type === "escalate"; });

  // Unique inspectors
  var inspectors = {};
  for (var ai = 0; ai < adjudications.length; ai++) {
    var key = adjudications[ai].inspector_email || adjudications[ai].inspector_id;
    if (!inspectors[key]) {
      inspectors[key] = {
        email: adjudications[ai].inspector_email,
        name: adjudications[ai].inspector_name,
        cert_level: adjudications[ai].inspector_cert_level,
        total: 0,
        concurs: 0,
        overrides: 0,
        escalations: 0
      };
    }
    inspectors[key].total++;
    if (adjudications[ai].adjudication_type === "concur") inspectors[key].concurs++;
    if (adjudications[ai].adjudication_type === "override") inspectors[key].overrides++;
    if (adjudications[ai].adjudication_type === "escalate") inspectors[key].escalations++;
  }

  return {
    success: true,
    case_id: caseId,
    case_number: caseRes.data.case_number,
    current_state: {
      system_decision: caseRes.data.decision_state,
      system_confidence: caseRes.data.unified_confidence,
      system_disposition: caseRes.data.disposition,
      inspector_override_active: caseRes.data.inspector_override_active,
      inspector_final_decision: caseRes.data.inspector_final_decision,
      effective_decision: caseRes.data.inspector_override_active
        ? caseRes.data.inspector_final_decision
        : caseRes.data.decision_state
    },
    summary: {
      total_adjudications: adjudications.length,
      concurs: concurs.length,
      overrides: overrides.length,
      escalations: escalations.length,
      unique_inspectors: Object.keys(inspectors).length,
      inspectors: Object.keys(inspectors).map(function(k) { return inspectors[k]; }),
      agreement_rate: adjudications.length > 0
        ? Math.round((concurs.length / adjudications.length) * 100)
        : null
    },
    adjudications: adjudications.map(function(a) {
      return {
        id: a.id,
        type: a.adjudication_type,
        inspector_email: a.inspector_email,
        inspector_name: a.inspector_name,
        inspector_cert_level: a.inspector_cert_level,
        system_state_at_time: a.system_decision_state,
        system_confidence_at_time: a.system_unified_confidence,
        override_decision: a.override_decision,
        rationale: a.rationale,
        evidence_references: a.evidence_references,
        escalate_to: a.escalate_to,
        escalation_priority: a.escalation_priority,
        created_at: a.created_at
      };
    })
  };
}

// ================================================================
// ACTION 3: GET STATS (aggregate across all cases)
// ================================================================
async function getStats(sb, params) {
  // Load all adjudications (optionally filtered by case)
  var query = sb.from("inspector_adjudications").select("*").order("created_at", { ascending: false });
  if (params.case_id) query = query.eq("case_id", params.case_id);
  query = query.limit(500);

  var res = await query;
  var adjudications = res.data || [];

  var concurs = adjudications.filter(function(a) { return a.adjudication_type === "concur"; });
  var overrides = adjudications.filter(function(a) { return a.adjudication_type === "override"; });
  var escalations = adjudications.filter(function(a) { return a.adjudication_type === "escalate"; });

  // Override patterns: what system states get overridden most
  var overrideByState = {};
  for (var oi = 0; oi < overrides.length; oi++) {
    var state = overrides[oi].system_decision_state || "unknown";
    if (!overrideByState[state]) overrideByState[state] = 0;
    overrideByState[state]++;
  }

  return {
    success: true,
    scope: params.case_id ? "single_case" : "all_cases",
    total_adjudications: adjudications.length,
    concurs: concurs.length,
    overrides: overrides.length,
    escalations: escalations.length,
    agreement_rate: adjudications.length > 0
      ? Math.round((concurs.length / adjudications.length) * 100) + "%"
      : "N/A",
    override_rate: adjudications.length > 0
      ? Math.round((overrides.length / adjudications.length) * 100) + "%"
      : "N/A",
    override_by_system_state: overrideByState,
    recent: adjudications.slice(0, 10).map(function(a) {
      return {
        type: a.adjudication_type,
        system_state: a.system_decision_state,
        override_decision: a.override_decision,
        inspector: a.inspector_email || a.inspector_name,
        created_at: a.created_at
      };
    })
  };
}

// ================================================================
// HANDLER
// ================================================================
export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action;

    if (!action) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "action required: submit, get_history, or get_stats" }) };

    var sb = createClient(supabaseUrl, supabaseKey);

    // Extract user from auth header
    var userInfo = { user_id: null, user_email: null, user_name: null };
    var authHeader = (event.headers["authorization"] || event.headers["Authorization"] || "");
    var token = authHeader.replace("Bearer ", "");
    if (token) {
      try {
        var userRes = await sb.auth.getUser(token);
        if (userRes.data && userRes.data.user) {
          userInfo.user_id = userRes.data.user.id;
          userInfo.user_email = userRes.data.user.email;
          userInfo.user_name = (userRes.data.user.user_metadata && userRes.data.user.user_metadata.full_name) || null;
        }
      } catch (authErr) {
        // Non-critical
      }
    }

    var result = null;

    if (action === "submit") {
      result = await submitAdjudication(sb, body, userInfo);
    } else if (action === "get_history") {
      result = await getHistory(sb, body);
    } else if (action === "get_stats") {
      result = await getStats(sb, body);
    } else {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
    }

    return {
      statusCode: result.success ? 200 : 400,
      headers: corsHeaders,
      body: JSON.stringify(result, null, 2)
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
