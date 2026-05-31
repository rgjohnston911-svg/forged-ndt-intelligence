// @ts-nocheck
/**
 * DEPLOY271 - superbrain-report.ts
 * netlify/functions/superbrain-report.ts
 *
 * SUPERBRAIN REPORT QUERY ENGINE v1.0.0 — ROUTER
 * Engine #64 — AI-powered dynamic report generation from Superbrain v6 sessions.
 *
 * This is the ROUTER. Fast actions (get_registry, list_sessions, get_report,
 * get_report_history) are handled here. The query_session action creates a
 * report record with status "processing" and invokes the background function.
 *
 * The background function (superbrain-report-background.ts) does the heavy
 * Claude API call and updates the report record when done.
 *
 * 6 actions:
 *   get_registry       — engine overview
 *   query_session      — start report generation (async, returns report_id)
 *   get_report_status  — poll for report completion
 *   list_sessions      — list available sessions for reporting
 *   get_report         — retrieve a completed report by ID
 *   get_report_history — list reports generated for a session
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var ENGINE_VERSION = "superbrain-report/1.0.0";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

function ok(body) { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(body) }; }
function errResp(code, msg) { return { statusCode: code, headers: corsHeaders, body: JSON.stringify({ error: msg }) }; }

// ============================================================
// QUERY PRESETS — common report types with tuned prompts
// ============================================================
var QUERY_PRESETS = {
  executive_summary: "Generate an executive summary suitable for a VP of Operations or Asset Integrity Manager. " +
    "Lead with the GO/NO-GO decision, overall risk level, and business impact. " +
    "Summarize the key proof chain findings, highlight any governance lock failures, " +
    "and list the top 3 recommended actions with estimated priority and timeline.",

  proof_chain: "Trace the complete proof chain from initial claim through all three adversarial models to final resolution. " +
    "Show where proof was established, where it was challenged, and where gaps remain. " +
    "Include confidence scores at each stage and identify any proof breaks detected by Model C.",

  inspection_plan: "Extract and elaborate the inspection planning output. " +
    "Show the recommended NDT methods for each component, access requirements, " +
    "priority scoring, and estimated workpack scope. " +
    "Cross-reference with the corrosion loop and fatigue assessment data.",

  risk_assessment: "Generate a comprehensive risk assessment from the session data. " +
    "Include the cascade failure analysis paths, corrosion remaining life calculations, " +
    "fatigue damage accumulation, vibration severity ratings, and overall risk ranking. " +
    "Map each risk to its governing standard and acceptance criteria.",

  standards_compliance: "Audit all standards references in this session against the code authority database. " +
    "List every standard cited, its current edition status, any superseded references found, " +
    "and compliance status. Flag any vague references that could not be resolved to exact editions.",

  full_technical: "Generate a complete technical analysis report covering all aspects of this session. " +
    "Include physics analysis, engineering standards review, adversarial findings, " +
    "corrosion assessment, fatigue/vibration analysis, cascade paths, " +
    "inspection planning, and final decision with governance lock status."
};

// ============================================================
// HANDLER (ROUTER)
// ============================================================
export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return errResp(405, "POST only");

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "query_session";

    // --- get_registry ---
    if (action === "get_registry") {
      return ok({
        engine: "superbrain-report",
        version: ENGINE_VERSION,
        description: "AI-powered dynamic report generation from Superbrain v6 sessions",
        deploy: "DEPLOY271",
        engine_number: 64,
        architecture: "async-background",
        actions: [
          { name: "get_registry", description: "Engine overview and capabilities" },
          { name: "query_session", description: "Start async report generation", params: "session_id (required), query (required or use preset), preset (optional)" },
          { name: "get_report_status", description: "Poll for report completion", params: "report_id (required)" },
          { name: "list_sessions", description: "List available reasoning sessions", params: "limit (optional, default 20), status (optional, default complete)" },
          { name: "get_report", description: "Retrieve a completed report", params: "report_id (required)" },
          { name: "get_report_history", description: "List reports for a session", params: "session_id (required)" }
        ],
        presets: Object.keys(QUERY_PRESETS),
        ai_model: "claude-sonnet-4-20250514",
        capabilities: [
          "Natural language querying of Superbrain v6 session data",
          "Dynamic report generation — no canned templates",
          "Async background processing — no timeout issues",
          "Executive summaries, technical analyses, proof chain traces",
          "Cross-references engine enrichment (corrosion, fatigue, cascade, inspection)",
          "Standards compliance auditing via code authority data",
          "Report persistence and history tracking"
        ]
      });
    }

    // --- list_sessions ---
    if (action === "list_sessions") {
      if (!supabaseUrl || !supabaseKey) return errResp(500, "SUPABASE not configured");
      var sb = createClient(supabaseUrl, supabaseKey);
      var limit = body.limit || 20;
      var statusFilter = body.status || "complete";

      var sessRes = await sb.from("reasoning_sessions")
        .select("id, case_id, pipeline_version, pipeline_status, pipeline_step, created_at, updated_at, total_duration_ms")
        .eq("pipeline_status", statusFilter)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (sessRes.error) return errResp(500, "Failed to list sessions: " + sessRes.error.message);

      return ok({
        engine: "superbrain-report",
        action: "list_sessions",
        count: sessRes.data.length,
        sessions: sessRes.data
      });
    }

    // --- get_report ---
    if (action === "get_report") {
      if (!body.report_id) return errResp(400, "report_id required");
      if (!supabaseUrl || !supabaseKey) return errResp(500, "SUPABASE not configured");
      var sb = createClient(supabaseUrl, supabaseKey);

      var repRes = await sb.from("superbrain_reports")
        .select("*")
        .eq("id", body.report_id)
        .single();

      if (repRes.error || !repRes.data) return errResp(404, "Report not found");

      return ok({
        engine: "superbrain-report",
        action: "get_report",
        report: repRes.data
      });
    }

    // --- get_report_status ---
    if (action === "get_report_status") {
      if (!body.report_id) return errResp(400, "report_id required");
      if (!supabaseUrl || !supabaseKey) return errResp(500, "SUPABASE not configured");
      var sb = createClient(supabaseUrl, supabaseKey);

      var statRes = await sb.from("superbrain_reports")
        .select("id, session_id, report_status, report_title, report_type, report_content, claude_duration_ms, input_tokens, output_tokens, created_at, updated_at")
        .eq("id", body.report_id)
        .single();

      if (statRes.error || !statRes.data) return errResp(404, "Report not found");

      var rep = statRes.data;
      var isComplete = rep.report_status === "complete" || rep.report_status === "error";

      if (!isComplete) {
        return ok({
          engine: "superbrain-report",
          action: "get_report_status",
          report_id: rep.id,
          status: rep.report_status || "processing",
          message: "Report is being generated. Poll again in 3 seconds."
        });
      }

      // Complete — return full report
      return ok({
        engine: "superbrain-report",
        version: ENGINE_VERSION,
        action: "get_report_status",
        report_id: rep.id,
        session_id: rep.session_id,
        status: rep.report_status,
        claude_duration_ms: rep.claude_duration_ms,
        tokens: {
          input: rep.input_tokens,
          output: rep.output_tokens
        },
        report: rep.report_content
      });
    }

    // --- get_report_history ---
    if (action === "get_report_history") {
      if (!body.session_id) return errResp(400, "session_id required");
      if (!supabaseUrl || !supabaseKey) return errResp(500, "SUPABASE not configured");
      var sb = createClient(supabaseUrl, supabaseKey);

      var histRes = await sb.from("superbrain_reports")
        .select("id, session_id, query, preset, report_title, report_type, report_status, created_at")
        .eq("session_id", body.session_id)
        .order("created_at", { ascending: false });

      if (histRes.error) return errResp(500, "Failed to get report history: " + histRes.error.message);

      return ok({
        engine: "superbrain-report",
        action: "get_report_history",
        session_id: body.session_id,
        count: histRes.data.length,
        reports: histRes.data
      });
    }

    // --- query_session (async — creates record, invokes background) ---
    if (action === "query_session") {
      if (!body.session_id) return errResp(400, "session_id required");
      if (!body.query && !body.preset) return errResp(400, "query or preset required");
      if (!supabaseUrl || !supabaseKey) return errResp(500, "SUPABASE not configured");

      var sb = createClient(supabaseUrl, supabaseKey);

      // Verify the session exists and is complete
      var sessCheck = await sb.from("reasoning_sessions")
        .select("id, pipeline_status")
        .eq("id", body.session_id)
        .single();

      if (sessCheck.error || !sessCheck.data) return errResp(404, "Session not found: " + body.session_id);
      if (sessCheck.data.pipeline_status !== "complete") {
        return errResp(400, "Session pipeline is not complete. Status: " + sessCheck.data.pipeline_status);
      }

      // Build the full query text
      var userQuery = body.query || "";
      if (body.preset && QUERY_PRESETS[body.preset]) {
        userQuery = QUERY_PRESETS[body.preset] + (userQuery ? "\n\nAdditional context: " + userQuery : "");
      }

      // Create a report record with status "processing"
      var reportInsert = await sb.from("superbrain_reports").insert({
        session_id: body.session_id,
        query: body.query || null,
        preset: body.preset || null,
        report_title: "Generating...",
        report_type: body.preset || "custom",
        report_status: "processing",
        report_content: null,
        raw_response: null,
        created_at: new Date().toISOString()
      }).select("id").single();

      if (reportInsert.error || !reportInsert.data) {
        return errResp(500, "Failed to create report record: " + (reportInsert.error ? reportInsert.error.message : "unknown"));
      }

      var reportId = reportInsert.data.id;

      // Invoke the background function
      var siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "https://4dndt.netlify.app";
      try {
        var bgResp = await fetch(siteUrl + "/.netlify/functions/superbrain-report-background", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": process.env.NDT_API_KEY || "" },
          body: JSON.stringify({
            report_id: reportId,
            session_id: body.session_id,
            query: userQuery
          })
        });
        console.log("Background function invoked, status: " + bgResp.status);
      } catch (bgErr) {
        // Update report as error
        await sb.from("superbrain_reports")
          .update({ report_status: "error", raw_response: "Failed to invoke background function: " + String(bgErr) })
          .eq("id", reportId);
        return errResp(500, "Failed to start report generation: " + String(bgErr));
      }

      // Return immediately with report_id for polling
      return {
        statusCode: 202,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "superbrain-report",
          action: "query_session",
          report_id: reportId,
          status: "accepted",
          message: "Report generation started. Poll with {action:'get_report_status', report_id:'" + reportId + "'}"
        })
      };
    }

    return errResp(400, "Unknown action: " + action + ". Valid: get_registry, query_session, get_report_status, list_sessions, get_report, get_report_history");

  } catch (err) {
    return errResp(500, String(err && err.message ? err.message : err));
  }
};
