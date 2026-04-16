// @ts-nocheck
/**
 * DEPLOY228 - escalation-workflow.ts
 * netlify/functions/escalation-workflow.ts
 *
 * ESCALATION WORKFLOW ENGINE
 *
 * POST /api/escalation-workflow { action: "create", case_id, priority, escalation_reason, escalated_by, ... }
 *   -> Creates new escalation in the queue with auto-deadline
 *
 * POST /api/escalation-workflow { action: "assign", escalation_id, assigned_to, assigned_to_email, assigned_to_name }
 *   -> Assigns escalation to a reviewer
 *
 * POST /api/escalation-workflow { action: "resolve", escalation_id, resolution_type, resolution_decision, resolution_rationale, resolved_by, ... }
 *   -> Resolves an escalation (upheld, overturned, modified, deferred)
 *
 * POST /api/escalation-workflow { action: "get_queue", status, priority, assigned_to }
 *   -> Returns filtered escalation queue
 *
 * POST /api/escalation-workflow { action: "get_case_escalations", case_id }
 *   -> Returns all escalations for a specific case
 *
 * POST /api/escalation-workflow { action: "get_stats" }
 *   -> Returns queue statistics (open, overdue, by priority, avg resolution time)
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

// Auto-deadline hours by priority
var DEADLINE_HOURS = {
  routine: 168,    // 7 days
  elevated: 72,    // 3 days
  urgent: 24,      // 24 hours
  emergency: 4     // 4 hours
};

function calculateDeadline(priority) {
  var hours = DEADLINE_HOURS[priority] || DEADLINE_HOURS.routine;
  var deadline = new Date(Date.now() + hours * 60 * 60 * 1000);
  return deadline.toISOString();
}

function isOverdue(deadline) {
  if (!deadline) return false;
  return new Date(deadline).getTime() < Date.now();
}

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action;
    var sb = createClient(supabaseUrl, supabaseKey);

    // ── ACTION: create ──
    if (action === "create") {
      if (!body.case_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };
      if (!body.escalated_by) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "escalated_by required" }) };

      var priority = body.priority || "routine";
      if (priority !== "routine" && priority !== "elevated" && priority !== "urgent" && priority !== "emergency") {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Invalid priority. Must be: routine, elevated, urgent, emergency" }) };
      }

      // Check case exists
      var caseCheck = await sb.from("inspection_cases").select("id").eq("id", body.case_id).single();
      if (caseCheck.error || !caseCheck.data) return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "case not found" }) };

      // Capture system state snapshot
      var caseState = await sb.from("inspection_cases").select("*").eq("id", body.case_id).single();
      var snapshot = null;
      if (caseState.data) {
        snapshot = {
          state: caseState.data.state,
          disposition: caseState.data.disposition,
          confidence: caseState.data.confidence,
          inspector_override_active: caseState.data.inspector_override_active,
          inspector_final_decision: caseState.data.inspector_final_decision,
          captured_at: new Date().toISOString()
        };
      }

      var deadline = calculateDeadline(priority);

      var escalation = {
        case_id: body.case_id,
        adjudication_id: body.adjudication_id || null,
        escalated_by: body.escalated_by,
        escalated_by_email: body.escalated_by_email || null,
        escalated_by_name: body.escalated_by_name || null,
        priority: priority,
        status: "open",
        deadline: deadline,
        deadline_source: "auto",
        escalation_reason: body.escalation_reason || body.reason || null,
        system_state_snapshot: snapshot,
        notes: body.notes || null
      };

      // If assigned_to provided, set status to assigned
      if (body.assigned_to) {
        escalation.assigned_to = body.assigned_to;
        escalation.assigned_to_email = body.assigned_to_email || null;
        escalation.assigned_to_name = body.assigned_to_name || null;
        escalation.assigned_at = new Date().toISOString();
        escalation.status = "assigned";
      }

      var insertResult = await sb.from("escalation_queue").insert(escalation).select().single();
      if (insertResult.error) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: insertResult.error.message }) };

      // Update case escalation tracking
      var caseUpdate = {
        escalation_count: (caseState.data && caseState.data.escalation_count ? caseState.data.escalation_count : 0) + 1,
        active_escalation_id: insertResult.data.id,
        escalation_status: escalation.status
      };
      await sb.from("inspection_cases").update(caseUpdate).eq("id", body.case_id);

      // Log to audit if table exists
      var auditEvent = {
        case_id: body.case_id,
        event_type: "escalation_created",
        actor_id: body.escalated_by,
        actor_email: body.escalated_by_email || null,
        actor_type: "user",
        summary: "Escalation created with priority: " + priority,
        metadata: { escalation_id: insertResult.data.id, priority: priority, deadline: deadline }
      };
      await sb.from("audit_events").insert(auditEvent);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          escalation: insertResult.data,
          deadline: deadline,
          deadline_hours: DEADLINE_HOURS[priority]
        })
      };
    }

    // ── ACTION: assign ──
    if (action === "assign") {
      if (!body.escalation_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "escalation_id required" }) };
      if (!body.assigned_to) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "assigned_to required" }) };

      var updateData = {
        assigned_to: body.assigned_to,
        assigned_to_email: body.assigned_to_email || null,
        assigned_to_name: body.assigned_to_name || null,
        assigned_at: new Date().toISOString(),
        status: "assigned",
        updated_at: new Date().toISOString()
      };

      var assignResult = await sb.from("escalation_queue").update(updateData).eq("id", body.escalation_id).select().single();
      if (assignResult.error) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: assignResult.error.message }) };

      // Update case escalation status
      if (assignResult.data && assignResult.data.case_id) {
        await sb.from("inspection_cases").update({ escalation_status: "assigned" }).eq("id", assignResult.data.case_id);

        // Audit log
        await sb.from("audit_events").insert({
          case_id: assignResult.data.case_id,
          event_type: "escalation_assigned",
          actor_id: body.assigned_by || body.assigned_to,
          actor_type: "user",
          summary: "Escalation assigned to: " + (body.assigned_to_name || body.assigned_to),
          metadata: { escalation_id: body.escalation_id, assigned_to: body.assigned_to }
        });
      }

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ escalation: assignResult.data }) };
    }

    // ── ACTION: resolve ──
    if (action === "resolve") {
      if (!body.escalation_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "escalation_id required" }) };
      if (!body.resolution_type) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "resolution_type required (upheld, overturned, modified, deferred)" }) };
      if (!body.resolved_by) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "resolved_by required" }) };

      var validTypes = ["upheld", "overturned", "modified", "deferred"];
      var isValidType = false;
      for (var vti = 0; vti < validTypes.length; vti++) {
        if (validTypes[vti] === body.resolution_type) { isValidType = true; break; }
      }
      if (!isValidType) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Invalid resolution_type. Must be: upheld, overturned, modified, deferred" }) };

      var resolveData = {
        status: "resolved",
        resolution_type: body.resolution_type,
        resolution_decision: body.resolution_decision || null,
        resolution_rationale: body.resolution_rationale || null,
        resolved_by: body.resolved_by,
        resolved_by_email: body.resolved_by_email || null,
        resolved_by_name: body.resolved_by_name || null,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      var resolveResult = await sb.from("escalation_queue").update(resolveData).eq("id", body.escalation_id).select().single();
      if (resolveResult.error) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: resolveResult.error.message }) };

      // Update case
      if (resolveResult.data && resolveResult.data.case_id) {
        await sb.from("inspection_cases").update({
          escalation_status: "resolved",
          active_escalation_id: null
        }).eq("id", resolveResult.data.case_id);

        // Audit log
        await sb.from("audit_events").insert({
          case_id: resolveResult.data.case_id,
          event_type: "escalation_resolved",
          actor_id: body.resolved_by,
          actor_email: body.resolved_by_email || null,
          actor_type: "user",
          summary: "Escalation resolved: " + body.resolution_type + (body.resolution_decision ? " - " + body.resolution_decision : ""),
          metadata: { escalation_id: body.escalation_id, resolution_type: body.resolution_type }
        });
      }

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ escalation: resolveResult.data }) };
    }

    // ── ACTION: get_queue ──
    if (action === "get_queue") {
      var queueQuery = sb.from("escalation_queue").select("*").order("created_at", { ascending: false });

      if (body.status) queueQuery = queueQuery.eq("status", body.status);
      if (body.priority) queueQuery = queueQuery.eq("priority", body.priority);
      if (body.assigned_to) queueQuery = queueQuery.eq("assigned_to", body.assigned_to);

      // Default: show non-resolved
      if (!body.status && !body.show_all) {
        queueQuery = queueQuery.in("status", ["open", "assigned", "in_review"]);
      }

      var limit = body.limit || 50;
      queueQuery = queueQuery.limit(limit);

      var queueResult = await queueQuery;
      if (queueResult.error) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: queueResult.error.message }) };

      // Tag overdue items
      var items = queueResult.data || [];
      for (var qi = 0; qi < items.length; qi++) {
        items[qi].is_overdue = isOverdue(items[qi].deadline) && items[qi].status !== "resolved" && items[qi].status !== "cancelled";
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ queue: items, total: items.length }, null, 2)
      };
    }

    // ── ACTION: get_case_escalations ──
    if (action === "get_case_escalations") {
      if (!body.case_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };

      var caseEscResult = await sb.from("escalation_queue").select("*").eq("case_id", body.case_id).order("created_at", { ascending: false });
      if (caseEscResult.error) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: caseEscResult.error.message }) };

      var caseItems = caseEscResult.data || [];
      for (var cei = 0; cei < caseItems.length; cei++) {
        caseItems[cei].is_overdue = isOverdue(caseItems[cei].deadline) && caseItems[cei].status !== "resolved" && caseItems[cei].status !== "cancelled";
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ escalations: caseItems, total: caseItems.length })
      };
    }

    // ── ACTION: get_stats ──
    if (action === "get_stats") {
      var allEsc = await sb.from("escalation_queue").select("*");
      if (allEsc.error) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: allEsc.error.message }) };

      var all = allEsc.data || [];
      var stats = {
        total: all.length,
        by_status: { open: 0, assigned: 0, in_review: 0, resolved: 0, expired: 0, cancelled: 0 },
        by_priority: { routine: 0, elevated: 0, urgent: 0, emergency: 0 },
        overdue: 0,
        avg_resolution_hours: null,
        resolution_breakdown: { upheld: 0, overturned: 0, modified: 0, deferred: 0 }
      };

      var resolutionTotalMs = 0;
      var resolutionCount = 0;

      for (var si = 0; si < all.length; si++) {
        var item = all[si];

        // By status
        if (stats.by_status[item.status] !== undefined) stats.by_status[item.status]++;

        // By priority
        if (stats.by_priority[item.priority] !== undefined) stats.by_priority[item.priority]++;

        // Overdue
        if (isOverdue(item.deadline) && item.status !== "resolved" && item.status !== "cancelled") {
          stats.overdue++;
        }

        // Resolution stats
        if (item.status === "resolved" && item.resolution_type) {
          if (stats.resolution_breakdown[item.resolution_type] !== undefined) {
            stats.resolution_breakdown[item.resolution_type]++;
          }
          // Calculate resolution time
          if (item.escalated_at && item.resolved_at) {
            var escTime = new Date(item.escalated_at).getTime();
            var resTime = new Date(item.resolved_at).getTime();
            if (resTime > escTime) {
              resolutionTotalMs += (resTime - escTime);
              resolutionCount++;
            }
          }
        }
      }

      if (resolutionCount > 0) {
        stats.avg_resolution_hours = Math.round((resolutionTotalMs / resolutionCount) / (1000 * 60 * 60) * 10) / 10;
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ stats: stats }, null, 2)
      };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action + ". Valid: create, assign, resolve, get_queue, get_case_escalations, get_stats" }) };

  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
