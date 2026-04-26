// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ══════════════════════════════════════════════════════════════════
// EVENT BUS ENGINE (DEPLOY335)
//
// Central event routing for the entire platform.
// When any engine produces a significant event — anomaly detected,
// code compliance override, drift alert, critical remaining life,
// debate conflict — it publishes to the event bus.
//
// The event bus:
// 1. Receives events from any engine
// 2. Classifies severity (info, warning, alert, critical)
// 3. Matches against subscription rules
// 4. Queues notifications for external delivery
// 5. Maintains full event log for audit
// 6. Provides event stream queries for dashboards
//
// Webhook targets: email, Slack, DCS, CMMS, external APIs
// ══════════════════════════════════════════════════════════════════

// ── EVENT TYPES ────────────────────────────────────────────────
var EVENT_TYPES = {
  "anomaly_detected": {
    severity_default: "alert",
    description: "Anomaly fingerprint engine flagged an unusual degradation pattern",
    source_engines: ["anomaly-fingerprint"]
  },
  "code_compliance_override": {
    severity_default: "critical",
    description: "Multi-agent debate resulted in code compliance override",
    source_engines: ["multi-agent-debate", "neurosymbolic-reasoning"]
  },
  "twin_drift_detected": {
    severity_default: "warning",
    description: "Digital twin predictions drifting from actuals",
    source_engines: ["self-calibrating-twin"]
  },
  "remaining_life_critical": {
    severity_default: "critical",
    description: "Remaining life below threshold",
    source_engines: ["predictive-remaining-life", "inspection-world-model", "batch-processing-gateway"]
  },
  "remaining_life_short": {
    severity_default: "alert",
    description: "Remaining life below 3 years",
    source_engines: ["predictive-remaining-life", "inspection-world-model"]
  },
  "corrosion_rate_high": {
    severity_default: "alert",
    description: "Corrosion rate exceeds threshold",
    source_engines: ["corrosion-loop-engine", "field-observation-protocol"]
  },
  "debate_conflict": {
    severity_default: "warning",
    description: "Expert agents produced conflicting assessments",
    source_engines: ["multi-agent-debate"]
  },
  "calibration_required": {
    severity_default: "warning",
    description: "Physics model or twin needs recalibration",
    source_engines: ["self-calibrating-twin", "physics-learning-engine"]
  },
  "inspection_overdue": {
    severity_default: "alert",
    description: "Scheduled inspection past due date",
    source_engines: ["active-inspection-optimizer"]
  },
  "novelty_escalation": {
    severity_default: "alert",
    description: "Unknown degradation pattern requires human review",
    source_engines: ["anomaly-fingerprint", "conceptual-reasoning-brain"]
  },
  "batch_complete": {
    severity_default: "info",
    description: "Batch processing run completed",
    source_engines: ["batch-processing-gateway"]
  },
  "report_generated": {
    severity_default: "info",
    description: "Regulatory report generated",
    source_engines: ["regulatory-report-generator"]
  },
  "measurement_warning": {
    severity_default: "warning",
    description: "Field measurement failed physics validation",
    source_engines: ["field-observation-protocol"]
  },
  "parameter_update_proposed": {
    severity_default: "info",
    description: "Physics learning engine proposes model parameter update",
    source_engines: ["physics-learning-engine"]
  },
  "change_point_detected": {
    severity_default: "alert",
    description: "Temporal fusion detected regime shift in sensor data",
    source_engines: ["temporal-fusion-engine"]
  }
};

// ── SEVERITY LEVELS ────────────────────────────────────────────
var SEVERITY_LEVELS = {
  "info": { level: 0, color: "#3b82f6", action: "log_only" },
  "warning": { level: 1, color: "#f59e0b", action: "log_and_queue" },
  "alert": { level: 2, color: "#f97316", action: "notify_subscribers" },
  "critical": { level: 3, color: "#ef4444", action: "immediate_notify" }
};

// ── DEFAULT SUBSCRIPTIONS ──────────────────────────────────────
var DEFAULT_SUBSCRIPTIONS = [
  { id: "sub-001", event_types: ["code_compliance_override", "remaining_life_critical"], min_severity: "critical", channel: "email", active: true },
  { id: "sub-002", event_types: ["anomaly_detected", "novelty_escalation", "remaining_life_short"], min_severity: "alert", channel: "slack", active: true },
  { id: "sub-003", event_types: ["twin_drift_detected", "calibration_required", "debate_conflict"], min_severity: "warning", channel: "dashboard", active: true },
  { id: "sub-004", event_types: ["batch_complete", "report_generated"], min_severity: "info", channel: "log", active: true },
  { id: "sub-005", event_types: ["change_point_detected", "corrosion_rate_high", "measurement_warning"], min_severity: "warning", channel: "slack", active: true }
];

// ── EVENT PROCESSOR ────────────────────────────────────────────
function processEvent(eventData) {
  var eventType = eventData.event_type || "unknown";
  var typeDef = EVENT_TYPES[eventType] || { severity_default: "info", description: "Unknown event type" };

  var severity = eventData.severity || typeDef.severity_default;
  var severityDef = SEVERITY_LEVELS[severity] || SEVERITY_LEVELS["info"];

  var processed = {
    event_id: generateEventId(),
    event_type: eventType,
    severity: severity,
    severity_level: severityDef.level,
    description: typeDef.description,
    source_engine: eventData.source_engine || null,
    asset_id: eventData.asset_id || null,
    case_id: eventData.case_id || null,
    payload: eventData.payload || {},
    message: eventData.message || typeDef.description,
    action: severityDef.action,
    timestamp: new Date().toISOString(),
    matched_subscriptions: [],
    notification_queue: []
  };

  // Match subscriptions
  for (var si = 0; si < DEFAULT_SUBSCRIPTIONS.length; si++) {
    var sub = DEFAULT_SUBSCRIPTIONS[si];
    if (!sub.active) continue;

    // Check event type match
    var typeMatch = sub.event_types.indexOf(eventType) !== -1;
    if (!typeMatch) continue;

    // Check severity
    var minSevLevel = (SEVERITY_LEVELS[sub.min_severity] || SEVERITY_LEVELS["info"]).level;
    if (severityDef.level < minSevLevel) continue;

    processed.matched_subscriptions.push(sub.id);
    processed.notification_queue.push({
      subscription_id: sub.id,
      channel: sub.channel,
      status: "queued",
      queued_at: new Date().toISOString()
    });
  }

  return processed;
}

// ── EVENT QUERY ────────────────────────────────────────────────
function filterEvents(events, filters) {
  var filtered = events;

  if (filters.event_type) {
    filtered = filtered.filter(function(e) { return e.event_type === filters.event_type; });
  }

  if (filters.severity) {
    var minLevel = (SEVERITY_LEVELS[filters.severity] || SEVERITY_LEVELS["info"]).level;
    filtered = filtered.filter(function(e) { return (e.severity_level || 0) >= minLevel; });
  }

  if (filters.source_engine) {
    filtered = filtered.filter(function(e) { return e.source_engine === filters.source_engine; });
  }

  if (filters.asset_id) {
    filtered = filtered.filter(function(e) { return e.asset_id === filters.asset_id; });
  }

  return filtered;
}

function generateEventId() {
  var chars = "abcdef0123456789";
  var id = "EVT-";
  for (var i = 0; i < 12; i++) {
    id = id + chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// ── SAVE FUNCTIONS ─────────────────────────────────────────────
async function saveEvent(sb, processed) {
  try {
    await sb.from("event_bus_log").insert([{
      event_id: processed.event_id,
      event_type: processed.event_type,
      severity: processed.severity,
      severity_level: processed.severity_level,
      source_engine: processed.source_engine,
      asset_id: processed.asset_id,
      case_id: processed.case_id,
      message: processed.message,
      matched_subscriptions: processed.matched_subscriptions,
      notification_count: processed.notification_queue.length,
      payload: processed.payload
    }]);
  } catch (e) {
    // non-fatal
  }
}

async function getEventLog(sb, filters, limit) {
  try {
    var q = sb.from("event_bus_log").select("*").order("created_at", { ascending: false }).limit(limit || 100);
    if (filters && filters.event_type) q = q.eq("event_type", filters.event_type);
    if (filters && filters.severity) q = q.eq("severity", filters.severity);
    if (filters && filters.source_engine) q = q.eq("source_engine", filters.source_engine);
    if (filters && filters.asset_id) q = q.eq("asset_id", filters.asset_id);
    var result = await q;
    return result.data || [];
  } catch (e) {
    return [];
  }
}

async function getEventStats(sb) {
  try {
    var now = new Date();
    var oneDayAgo = new Date(now.getTime() - 86400000).toISOString();
    var oneWeekAgo = new Date(now.getTime() - 604800000).toISOString();

    var dayResult = await sb.from("event_bus_log").select("severity", { count: "exact", head: true }).gte("created_at", oneDayAgo);
    var weekResult = await sb.from("event_bus_log").select("severity", { count: "exact", head: true }).gte("created_at", oneWeekAgo);

    return {
      last_24h: dayResult.count || 0,
      last_7d: weekResult.count || 0
    };
  } catch (e) {
    return { last_24h: 0, last_7d: 0 };
  }
}

// ── HANDLER ────────────────────────────────────────────────────
var handler = async function(event) {
  var corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";
    var sb = createClient(supabaseUrl, supabaseKey);

    if (action === "get_registry") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "event-bus",
          deploy: "DEPLOY335",
          version: "1.0.0",
          description: "Event Bus Engine — central event routing with severity classification, subscription matching, and notification queuing",
          event_types: Object.keys(EVENT_TYPES).length,
          severity_levels: Object.keys(SEVERITY_LEVELS).length,
          default_subscriptions: DEFAULT_SUBSCRIPTIONS.length,
          capabilities: ["publish_event", "subscribe", "query_events", "event_statistics", "notification_routing"],
          actions: ["get_registry", "publish", "get_events", "get_stats", "get_event_types", "get_subscriptions"]
        })
      };
    }

    if (action === "publish") {
      var processed = processEvent(body);
      await saveEvent(sb, processed);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "event-bus",
          action: "publish",
          event: processed
        })
      };
    }

    if (action === "get_events") {
      var events = await getEventLog(sb, body.filters || {}, body.limit || 100);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ engine: "event-bus", action: "get_events", events: events, count: events.length })
      };
    }

    if (action === "get_stats") {
      var stats = await getEventStats(sb);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ engine: "event-bus", action: "get_stats", statistics: stats })
      };
    }

    if (action === "get_event_types") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ engine: "event-bus", action: "get_event_types", event_types: EVENT_TYPES })
      };
    }

    if (action === "get_subscriptions") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ engine: "event-bus", action: "get_subscriptions", subscriptions: DEFAULT_SUBSCRIPTIONS })
      };
    }

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: "event-bus", error: "Unknown action: " + action }) };

  } catch (err) {
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: "event-bus", error: String(err && err.message ? err.message : err) }) };
  }
};

export { handler };
