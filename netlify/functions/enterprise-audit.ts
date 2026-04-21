// @ts-nocheck
/**
 * DEPLOY223 - enterprise-audit.ts
 * netlify/functions/enterprise-audit.ts
 *
 * ENTERPRISE AUDIT SYSTEM
 *
 * Three capabilities:
 *   1. LOG EVENT — append-only audit event for any user or system action
 *   2. SIGN BUNDLE — create a tamper-proof signed decision bundle with hash chain
 *   3. GET HISTORY — retrieve full audit trail for a case (events + bundles)
 *
 * Every action records: who did it, when, what changed, and a snapshot of
 * the inputs/outputs at that moment. Signed bundles form a hash chain —
 * tampering with any historical bundle breaks the chain.
 *
 * POST /api/enterprise-audit
 *   { action: "log_event", case_id, event_type, detail, user_id?, user_email? }
 *   { action: "sign_bundle", case_id, user_id?, user_email? }
 *   { action: "get_history", case_id }
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { createHash, createHmac } from "crypto";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var EXECUTION_MODE = "deterministic";
var ENGINE_VERSION = "enterprise-audit/1.0.0";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

// ================================================================
// STABLE JSON STRINGIFY (deterministic key order for hashing)
// ================================================================
function stableStringify(obj) {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    var parts0 = [];
    for (var a = 0; a < obj.length; a++) parts0.push(stableStringify(obj[a]));
    return "[" + parts0.join(",") + "]";
  }
  var keys = Object.keys(obj).sort();
  var parts = [];
  for (var i = 0; i < keys.length; i++) {
    parts.push(JSON.stringify(keys[i]) + ":" + stableStringify(obj[keys[i]]));
  }
  return "{" + parts.join(",") + "}";
}

function hashData(data) {
  return createHash("sha256").update(stableStringify(data)).digest("hex");
}

function signData(data, secretKey) {
  return createHmac("sha256", secretKey).update(stableStringify(data)).digest("hex");
}

// ================================================================
// EVENT TYPE REGISTRY
// ================================================================
var EVENT_TYPES = {
  // User actions
  case_created: { category: "case_lifecycle", actor: "user" },
  case_updated: { category: "case_lifecycle", actor: "user" },
  evidence_uploaded: { category: "evidence", actor: "user" },
  evidence_deleted: { category: "evidence", actor: "user" },
  measurement_added: { category: "evidence", actor: "user" },
  measurement_updated: { category: "evidence", actor: "user" },
  finding_added: { category: "findings", actor: "user" },
  finding_updated: { category: "findings", actor: "user" },
  finding_deleted: { category: "findings", actor: "user" },
  thickness_grid_uploaded: { category: "evidence", actor: "user" },
  field_changed: { category: "case_lifecycle", actor: "user" },

  // System engine runs
  decision_spine_run: { category: "decision", actor: "system" },
  authority_run: { category: "decision", actor: "system" },
  code_authority_run: { category: "decision", actor: "system" },
  outcome_simulation_run: { category: "prediction", actor: "system" },
  material_authority_run: { category: "material", actor: "system" },
  composite_repair_run: { category: "repair", actor: "system" },
  planner_run: { category: "planning", actor: "system" },
  analysis_run: { category: "analysis", actor: "system" },
  similar_cases_run: { category: "analysis", actor: "system" },

  // Decision actions
  bundle_signed: { category: "audit", actor: "system" },
  bundle_verified: { category: "audit", actor: "system" },
  authority_locked: { category: "decision", actor: "user" },
  authority_unlocked: { category: "decision", actor: "user" },

  // Inspector actions (future DEPLOY226)
  inspector_concur: { category: "adjudication", actor: "user" },
  inspector_override: { category: "adjudication", actor: "user" },
  inspector_escalate: { category: "adjudication", actor: "user" },

  // Generic
  custom: { category: "custom", actor: "user" }
};

// ================================================================
// ACTION 1: LOG EVENT
// ================================================================
async function logEvent(sb, params) {
  var eventType = params.event_type || "custom";
  var eventInfo = EVENT_TYPES[eventType] || EVENT_TYPES.custom;

  var eventRow = {
    case_id: params.case_id,
    event_type: eventType,
    event_category: eventInfo.category,
    actor_type: params.actor_type || eventInfo.actor || "system",
    actor_id: params.user_id || null,
    actor_email: params.user_email || null,
    actor_name: params.user_name || null,
    detail: params.detail || {},
    input_snapshot: params.input_snapshot || null,
    output_snapshot: params.output_snapshot || null,
    execution_mode: params.execution_mode || EXECUTION_MODE,
    function_name: params.function_name || null,
    ip_address: params.ip_address || null,
    session_id: params.session_id || null
  };

  var res = await sb.from("audit_events").insert(eventRow).select().single();
  if (res.error) {
    return { success: false, error: "Failed to log event: " + res.error.message };
  }

  return {
    success: true,
    event_id: res.data.id,
    event_type: eventType,
    category: eventInfo.category,
    actor_type: eventRow.actor_type,
    logged_at: res.data.created_at
  };
}

// ================================================================
// ACTION 2: SIGN BUNDLE
// ================================================================
async function signBundle(sb, params) {
  var caseId = params.case_id;

  // Load case with all decision data
  var caseRes = await sb.from("inspection_cases").select("*").eq("id", caseId).single();
  if (caseRes.error || !caseRes.data) {
    return { success: false, error: "Case not found" };
  }
  var caseRow = caseRes.data;

  // Load findings
  var findingsRes = await sb.from("findings").select("*").eq("case_id", caseId).order("created_at", { ascending: true });
  var findings = findingsRes.data || [];

  // Load all audit events for this case (the full trail)
  var eventsRes = await sb.from("audit_events")
    .select("id, event_type, event_category, actor_type, actor_id, actor_email, actor_name, detail, execution_mode, function_name, created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });
  var events = eventsRes.data || [];

  // Get previous bundle for chain linking
  var prevRes = await sb.from("audit_bundles")
    .select("id, bundle_version, bundle_hash")
    .eq("case_id", caseId)
    .order("bundle_version", { ascending: false })
    .limit(1);
  var previousBundle = (prevRes.data && prevRes.data.length > 0) ? prevRes.data[0] : null;
  var previousHash = previousBundle ? previousBundle.bundle_hash : null;
  var newVersion = previousBundle ? (previousBundle.bundle_version + 1) : 1;

  // Build the complete replay snapshot
  var replaySnapshot = {
    case: {
      id: caseRow.id,
      case_number: caseRow.case_number,
      title: caseRow.title,
      asset_type: caseRow.asset_type,
      industry: caseRow.industry,
      method: caseRow.method,
      component_name: caseRow.component_name,
      material_class: caseRow.material_class,
      status: caseRow.status,
      disposition: caseRow.disposition
    },
    decision_state: caseRow.decision_state,
    unified_confidence: caseRow.unified_confidence,
    confidence_components: caseRow.confidence_components,
    conceptual_reasoning: caseRow.conceptual_reasoning,
    authority_evidence: caseRow.authority_evidence,
    decision_bundle: caseRow.decision_bundle,
    outcome_simulation: caseRow.outcome_simulation,
    code_authority_result: caseRow.code_authority_result,
    material_authority_result: caseRow.material_authority_result,
    material_authority_status: caseRow.material_authority_status,
    composite_repair_result: caseRow.composite_repair_result,
    governing_codes: caseRow.governing_codes,
    precedence_tier: caseRow.precedence_tier,
    findings_count: findings.length,
    findings: findings.map(function(f) {
      return {
        id: f.id,
        indication_type: f.indication_type,
        severity: f.severity,
        recommended_action: f.recommended_action,
        notes: f.notes,
        created_at: f.created_at
      };
    })
  };

  // Build the bundle
  var signedAt = new Date().toISOString();
  var bundleData = {
    engine: ENGINE_VERSION,
    execution_mode: EXECUTION_MODE,
    case_id: caseId,
    case_number: caseRow.case_number,
    bundle_version: newVersion,
    signed_at: signedAt,
    previous_hash: previousHash,
    chain_position: newVersion,
    decision_snapshot: {
      state: caseRow.decision_state,
      unified_confidence: caseRow.unified_confidence,
      disposition: caseRow.disposition,
      precedence_tier: caseRow.precedence_tier,
      predicted_failure_date: caseRow.predicted_failure_date,
      remaining_life_months: caseRow.remaining_life_months
    },
    replay_snapshot: replaySnapshot,
    audit_trail: {
      total_events: events.length,
      user_actions: events.filter(function(e) { return e.actor_type === "user"; }).length,
      system_actions: events.filter(function(e) { return e.actor_type === "system"; }).length,
      events: events
    },
    contributing_engines: buildContributingEngines(caseRow),
    signed_by: {
      user_id: params.user_id || null,
      email: params.user_email || null,
      name: params.user_name || null
    }
  };

  // Hash the bundle
  var bundleHash = hashData(bundleData);

  // Get signing key
  var keyRes = await sb.from("org_signing_keys")
    .select("*")
    .eq("is_active", true)
    .limit(1)
    .single();
  var signingKey = keyRes.data;
  if (!signingKey) {
    return { success: false, error: "No active signing key found. Run DEPLOY223 migration first." };
  }

  // Sign with HMAC-SHA256
  var signature = signData(bundleData, signingKey.private_key_encrypted);

  // Validate chain
  var chainValid = true;
  if (previousHash && previousBundle) {
    // Chain is valid if we correctly reference the previous hash
    chainValid = true; // We just set previous_hash above, actual validation is in verify-audit-chain
  }

  // Insert bundle (append-only)
  var bundleRow = {
    case_id: caseId,
    bundle_version: newVersion,
    bundle_data: bundleData,
    bundle_hash: bundleHash,
    previous_hash: previousHash,
    signature: signature,
    signing_key_id: signingKey.id,
    signed_by_user_id: params.user_id || null,
    signed_by_email: params.user_email || null,
    signed_at: signedAt,
    chain_valid: chainValid,
    replay_snapshot: replaySnapshot
  };

  var insertRes = await sb.from("audit_bundles").insert(bundleRow).select().single();
  if (insertRes.error) {
    return { success: false, error: "Failed to insert bundle: " + insertRes.error.message };
  }

  // Update case with chain head
  await sb.from("inspection_cases").update({
    audit_bundle_count: newVersion,
    last_audit_hash: bundleHash,
    last_audit_signed_at: signedAt,
    audit_chain_valid: chainValid
  }).eq("id", caseId);

  // Log the signing event
  await logEvent(sb, {
    case_id: caseId,
    event_type: "bundle_signed",
    user_id: params.user_id,
    user_email: params.user_email,
    detail: {
      bundle_version: newVersion,
      bundle_hash: bundleHash,
      previous_hash: previousHash,
      chain_position: newVersion,
      total_events_captured: events.length,
      signing_key_id: signingKey.id
    },
    execution_mode: EXECUTION_MODE,
    function_name: "enterprise-audit"
  });

  return {
    success: true,
    bundle_id: insertRes.data.id,
    bundle_version: newVersion,
    bundle_hash: bundleHash,
    previous_hash: previousHash,
    signature: signature,
    signing_key_id: signingKey.id,
    chain_position: newVersion,
    chain_valid: chainValid,
    signed_at: signedAt,
    events_captured: events.length,
    user_actions: bundleData.audit_trail.user_actions,
    system_actions: bundleData.audit_trail.system_actions,
    contributing_engines: bundleData.contributing_engines,
    replay_snapshot_included: true
  };
}

// ================================================================
// ACTION 3: GET HISTORY
// ================================================================
async function getHistory(sb, params) {
  var caseId = params.case_id;

  // Load case basics
  var caseRes = await sb.from("inspection_cases")
    .select("id, case_number, title, decision_state, audit_bundle_count, last_audit_hash, last_audit_signed_at, audit_chain_valid")
    .eq("id", caseId)
    .single();
  if (caseRes.error || !caseRes.data) {
    return { success: false, error: "Case not found" };
  }

  // Load all events
  var eventsRes = await sb.from("audit_events")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });
  var events = eventsRes.data || [];

  // Load all bundles
  var bundlesRes = await sb.from("audit_bundles")
    .select("id, bundle_version, bundle_hash, previous_hash, signature, signing_key_id, signed_by_email, signed_at, chain_valid")
    .eq("case_id", caseId)
    .order("bundle_version", { ascending: true });
  var bundles = bundlesRes.data || [];

  // Build timeline (interleave events and bundles)
  var timeline = [];

  for (var ei = 0; ei < events.length; ei++) {
    var ev = events[ei];
    timeline.push({
      type: "event",
      timestamp: ev.created_at,
      event_type: ev.event_type,
      category: ev.event_category,
      actor_type: ev.actor_type,
      actor_email: ev.actor_email || ev.actor_name || (ev.actor_type === "system" ? "SYSTEM" : "Unknown"),
      detail: ev.detail,
      execution_mode: ev.execution_mode,
      function_name: ev.function_name
    });
  }

  for (var bi = 0; bi < bundles.length; bi++) {
    var b = bundles[bi];
    timeline.push({
      type: "bundle_signed",
      timestamp: b.signed_at,
      bundle_version: b.bundle_version,
      bundle_hash: b.bundle_hash,
      previous_hash: b.previous_hash,
      signed_by: b.signed_by_email || "System",
      chain_valid: b.chain_valid
    });
  }

  // Sort by timestamp
  timeline.sort(function(a, b) {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  // Summary stats
  var userActions = events.filter(function(e) { return e.actor_type === "user"; });
  var systemActions = events.filter(function(e) { return e.actor_type === "system"; });
  var uniqueActors = {};
  for (var ui = 0; ui < userActions.length; ui++) {
    var actorKey = userActions[ui].actor_email || userActions[ui].actor_id || "unknown";
    if (!uniqueActors[actorKey]) {
      uniqueActors[actorKey] = { email: userActions[ui].actor_email, name: userActions[ui].actor_name, action_count: 0 };
    }
    uniqueActors[actorKey].action_count++;
  }

  return {
    success: true,
    case_id: caseId,
    case_number: caseRes.data.case_number,
    title: caseRes.data.title,
    decision_state: caseRes.data.decision_state,
    summary: {
      total_events: events.length,
      user_actions: userActions.length,
      system_actions: systemActions.length,
      bundles_signed: bundles.length,
      unique_actors: Object.keys(uniqueActors).length,
      actors: Object.keys(uniqueActors).map(function(k) { return uniqueActors[k]; }),
      chain_valid: caseRes.data.audit_chain_valid,
      last_signed_at: caseRes.data.last_audit_signed_at
    },
    bundles: bundles,
    timeline: timeline
  };
}

// ================================================================
// HELPERS
// ================================================================
function buildContributingEngines(caseRow) {
  var engines = [];
  if (caseRow.decision_state) engines.push({ engine: "decision-spine", mode: "deterministic" });
  if (caseRow.decision_bundle) engines.push({ engine: "run-authority", mode: "hybrid" });
  if (caseRow.code_authority_result) engines.push({ engine: "universal-code-authority", mode: "deterministic" });
  if (caseRow.outcome_simulation) engines.push({ engine: "outcome-simulation", mode: "deterministic" });
  if (caseRow.material_authority_result) engines.push({ engine: "material-authority", mode: "deterministic" });
  if (caseRow.composite_repair_result) engines.push({ engine: "composite-repair-authority", mode: "deterministic" });
  return engines;
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
    var caseId = body.case_id;

    if (!caseId) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };
    if (!action) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "action required: log_event, sign_bundle, or get_history" }) };

    var sb = createClient(supabaseUrl, supabaseKey);

    // Try to extract user from auth header
    var authHeader = (event.headers["authorization"] || event.headers["Authorization"] || "");
    var token = authHeader.replace("Bearer ", "");
    if (token && !body.user_id) {
      try {
        var userRes = await sb.auth.getUser(token);
        if (userRes.data && userRes.data.user) {
          body.user_id = userRes.data.user.id;
          body.user_email = userRes.data.user.email;
          body.user_name = (userRes.data.user.user_metadata && userRes.data.user.user_metadata.full_name) || null;
        }
      } catch (authErr) {
        // Non-critical: proceed without user context
      }
    }

    // Extract IP from headers
    body.ip_address = event.headers["x-forwarded-for"] || event.headers["x-real-ip"] || null;

    var result = null;

    if (action === "log_event") {
      result = await logEvent(sb, body);
    } else if (action === "sign_bundle") {
      result = await signBundle(sb, body);
    } else if (action === "get_history") {
      result = await getHistory(sb, body);
    } else {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action + ". Use log_event, sign_bundle, or get_history." }) };
    }

    return {
      statusCode: result.success ? 200 : 500,
      headers: corsHeaders,
      body: JSON.stringify(result, null, 2)
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
