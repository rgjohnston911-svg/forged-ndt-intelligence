// @ts-nocheck
/**
 * DEPLOY230 - notifications.ts
 * netlify/functions/notifications.ts
 *
 * NOTIFICATION SYSTEM
 *
 * POST /api/notifications { action: "send", recipient_id, event_type, title, message, ... }
 *   -> Creates a notification for a specific user
 *
 * POST /api/notifications { action: "send_bulk", recipients[], event_type, title, message, ... }
 *   -> Sends same notification to multiple recipients
 *
 * POST /api/notifications { action: "get_inbox", recipient_id, unread_only, limit }
 *   -> Returns notifications for a user (newest first)
 *
 * POST /api/notifications { action: "mark_read", notification_id }
 *   -> Marks a single notification as read
 *
 * POST /api/notifications { action: "mark_all_read", recipient_id }
 *   -> Marks all notifications as read for a user
 *
 * POST /api/notifications { action: "dismiss", notification_id }
 *   -> Dismisses a notification (hides from inbox)
 *
 * POST /api/notifications { action: "get_preferences", user_id }
 *   -> Returns notification preferences for a user
 *
 * POST /api/notifications { action: "update_preferences", user_id, preferences }
 *   -> Updates notification preferences
 *
 * POST /api/notifications { action: "get_stats", recipient_id }
 *   -> Returns unread count, by severity, recent activity
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

// Event types that auto-generate notifications
var EVENT_TYPES = {
  escalation_created: { severity: "warning", title_prefix: "Escalation: " },
  escalation_assigned: { severity: "info", title_prefix: "Assigned: " },
  escalation_resolved: { severity: "success", title_prefix: "Resolved: " },
  escalation_overdue: { severity: "critical", title_prefix: "OVERDUE: " },
  inspector_override: { severity: "warning", title_prefix: "Override: " },
  inspector_concur: { severity: "info", title_prefix: "Concur: " },
  critical_finding: { severity: "critical", title_prefix: "Critical Finding: " },
  case_assigned: { severity: "info", title_prefix: "Case Assigned: " },
  case_closed: { severity: "success", title_prefix: "Case Closed: " },
  deadline_warning: { severity: "warning", title_prefix: "Deadline: " },
  system_alert: { severity: "critical", title_prefix: "System: " },
  audit_chain_broken: { severity: "critical", title_prefix: "Audit Alert: " },
  confidence_low: { severity: "warning", title_prefix: "Low Confidence: " }
};

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action;
    var sb = createClient(supabaseUrl, supabaseKey);

    // ── ACTION: send ──
    if (action === "send") {
      if (!body.recipient_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "recipient_id required" }) };
      if (!body.title) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "title required" }) };
      if (!body.message) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "message required" }) };

      var eventInfo = EVENT_TYPES[body.event_type] || { severity: "info", title_prefix: "" };

      var notification = {
        recipient_id: body.recipient_id,
        recipient_email: body.recipient_email || null,
        recipient_role: body.recipient_role || null,
        case_id: body.case_id || null,
        event_type: body.event_type || "general",
        source_engine: body.source_engine || null,
        title: body.title,
        message: body.message,
        severity: body.severity || eventInfo.severity,
        action_url: body.action_url || null,
        action_label: body.action_label || null,
        metadata: body.metadata || {}
      };

      var insertResult = await sb.from("notifications").insert(notification).select().single();
      if (insertResult.error) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: insertResult.error.message }) };

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ notification: insertResult.data }) };
    }

    // ── ACTION: send_bulk ──
    if (action === "send_bulk") {
      if (!body.recipients || body.recipients.length === 0) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "recipients array required" }) };
      if (!body.title) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "title required" }) };
      if (!body.message) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "message required" }) };

      var eventInfo2 = EVENT_TYPES[body.event_type] || { severity: "info", title_prefix: "" };
      var bulkRows = [];

      for (var bi = 0; bi < body.recipients.length; bi++) {
        var recip = body.recipients[bi];
        bulkRows.push({
          recipient_id: typeof recip === "string" ? recip : recip.id,
          recipient_email: typeof recip === "string" ? null : (recip.email || null),
          recipient_role: typeof recip === "string" ? null : (recip.role || null),
          case_id: body.case_id || null,
          event_type: body.event_type || "general",
          source_engine: body.source_engine || null,
          title: body.title,
          message: body.message,
          severity: body.severity || eventInfo2.severity,
          action_url: body.action_url || null,
          action_label: body.action_label || null,
          metadata: body.metadata || {}
        });
      }

      var bulkResult = await sb.from("notifications").insert(bulkRows).select();
      if (bulkResult.error) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: bulkResult.error.message }) };

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ sent: bulkResult.data.length, notifications: bulkResult.data }) };
    }

    // ── ACTION: get_inbox ──
    if (action === "get_inbox") {
      if (!body.recipient_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "recipient_id required" }) };

      var limit = body.limit || 50;
      var inboxQuery = sb.from("notifications").select("*").eq("recipient_id", body.recipient_id).eq("dismissed", false).order("created_at", { ascending: false }).limit(limit);

      if (body.unread_only === true) {
        inboxQuery = inboxQuery.eq("read", false);
      }

      var inboxResult = await inboxQuery;
      if (inboxResult.error) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: inboxResult.error.message }) };

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ notifications: inboxResult.data || [], total: (inboxResult.data || []).length })
      };
    }

    // ── ACTION: mark_read ──
    if (action === "mark_read") {
      if (!body.notification_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "notification_id required" }) };

      var readResult = await sb.from("notifications").update({ read: true, read_at: new Date().toISOString() }).eq("id", body.notification_id).select().single();
      if (readResult.error) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: readResult.error.message }) };

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ notification: readResult.data }) };
    }

    // ── ACTION: mark_all_read ──
    if (action === "mark_all_read") {
      if (!body.recipient_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "recipient_id required" }) };

      var markAllResult = await sb.from("notifications").update({ read: true, read_at: new Date().toISOString() }).eq("recipient_id", body.recipient_id).eq("read", false);
      if (markAllResult.error) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: markAllResult.error.message }) };

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, message: "All notifications marked as read" }) };
    }

    // ── ACTION: dismiss ──
    if (action === "dismiss") {
      if (!body.notification_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "notification_id required" }) };

      var dismissResult = await sb.from("notifications").update({ dismissed: true, dismissed_at: new Date().toISOString() }).eq("id", body.notification_id).select().single();
      if (dismissResult.error) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: dismissResult.error.message }) };

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ notification: dismissResult.data }) };
    }

    // ── ACTION: get_preferences ──
    if (action === "get_preferences") {
      if (!body.user_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "user_id required" }) };

      var prefResult = await sb.from("notification_preferences").select("*").eq("user_id", body.user_id).single();
      if (prefResult.error || !prefResult.data) {
        // Return defaults if no preferences set
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            preferences: {
              user_id: body.user_id,
              notify_escalation: true,
              notify_override: true,
              notify_critical_finding: true,
              notify_case_assigned: true,
              notify_deadline_warning: true,
              notify_resolution: true,
              notify_system_alert: true,
              in_app: true,
              email_digest: false
            },
            is_default: true
          })
        };
      }

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ preferences: prefResult.data, is_default: false }) };
    }

    // ── ACTION: update_preferences ──
    if (action === "update_preferences") {
      if (!body.user_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "user_id required" }) };
      if (!body.preferences) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "preferences object required" }) };

      var prefs = body.preferences;
      prefs.user_id = body.user_id;
      prefs.updated_at = new Date().toISOString();

      // Upsert: update if exists, insert if not
      var upsertResult = await sb.from("notification_preferences").upsert(prefs, { onConflict: "user_id" }).select().single();
      if (upsertResult.error) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: upsertResult.error.message }) };

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ preferences: upsertResult.data }) };
    }

    // ── ACTION: get_stats ──
    if (action === "get_stats") {
      var statsQuery = sb.from("notifications").select("*");
      if (body.recipient_id) {
        statsQuery = statsQuery.eq("recipient_id", body.recipient_id);
      }
      var statsResult = await statsQuery;
      if (statsResult.error) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: statsResult.error.message }) };

      var all = statsResult.data || [];
      var stats = {
        total: all.length,
        unread: 0,
        by_severity: { info: 0, warning: 0, critical: 0, success: 0 },
        by_event_type: {},
        recent_24h: 0
      };

      var twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

      for (var si = 0; si < all.length; si++) {
        var n = all[si];
        if (!n.read) stats.unread++;
        if (stats.by_severity[n.severity] !== undefined) stats.by_severity[n.severity]++;
        stats.by_event_type[n.event_type] = (stats.by_event_type[n.event_type] || 0) + 1;
        if (new Date(n.created_at).getTime() > twentyFourHoursAgo) stats.recent_24h++;
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ stats: stats }, null, 2)
      };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action + ". Valid: send, send_bulk, get_inbox, mark_read, mark_all_read, dismiss, get_preferences, update_preferences, get_stats" }) };

  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
