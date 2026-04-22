// @ts-nocheck
/**
 * DEPLOY271 - superbrain-report.ts
 * netlify/functions/superbrain-report.ts
 *
 * SUPERBRAIN REPORT QUERY ENGINE v1.0.0
 * Engine #64 — AI-powered dynamic report generation from Superbrain v6 sessions.
 *
 * Users ask natural language questions about completed Superbrain sessions.
 * The engine loads the full session data, sends it to Claude with the query,
 * and returns a structured, professional report response.
 *
 * No canned templates. Every report is dynamically generated from the actual
 * reasoning pipeline output, engine enrichment data, and proof chains.
 *
 * 5 actions:
 *   get_registry     — engine overview
 *   query_session    — ask a natural language question about a session
 *   list_sessions    — list available sessions for reporting
 *   get_report       — retrieve a previously generated report by ID
 *   get_report_history — list reports generated for a session
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var anthropicKey = process.env.ANTHROPIC_API_KEY || "";

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
// REPORT SYSTEM PROMPT
// Tells Claude how to generate professional NDT reports
// from Superbrain v6 session data.
// ============================================================
var REPORT_SYSTEM_PROMPT = "You are the FORGED NDT Intelligence OS Report Engine. " +
  "You generate professional engineering reports from Superbrain v6 adversarial reasoning sessions. " +
  "\n\n" +
  "CONTEXT: You will receive the full output of a Superbrain v6 pipeline run, which includes:\n" +
  "- Model A (GPT-4o): Physics analysis, claim graphs, component-level proof chains, calculations\n" +
  "- Model B (Claude): Engineering standards authority, assumption mapping, repair credibility\n" +
  "- Model C (GPT-4o): Adversarial analysis, disproof paths, proof breaks, confidence scores\n" +
  "- Resolution (Claude): Decision proof, regulatory defensibility, governance lock\n" +
  "- Engine Enrichment: Code authority validations, corrosion loop analysis, fatigue/vibration assessments, cascade failure paths, inspection planning workpacks\n" +
  "\n" +
  "INSTRUCTIONS:\n" +
  "1. Answer the user's query using ONLY data from the session. Do not invent findings.\n" +
  "2. Use precise technical language appropriate for NDT/inspection engineers.\n" +
  "3. Reference specific proof chains, claim IDs, and engine outputs when available.\n" +
  "4. Structure your response with clear sections using markdown headers.\n" +
  "5. Include a CONFIDENCE statement at the end rating how well the session data answers the query.\n" +
  "6. If the session data does not contain enough information to answer, say so explicitly.\n" +
  "7. When citing standards, use exact editions from the code authority data.\n" +
  "8. For executive audiences, lead with the decision and risk level, then supporting evidence.\n" +
  "9. For technical audiences, lead with the proof chain, then calculations, then standards basis.\n" +
  "\n" +
  "OUTPUT FORMAT:\n" +
  "Return a JSON object with these fields:\n" +
  "- report_title: A concise professional title for this report\n" +
  "- report_type: One of: executive_summary, technical_analysis, proof_chain, inspection_plan, risk_assessment, standards_compliance, custom\n" +
  "- sections: Array of {heading: string, content: string} objects\n" +
  "- key_findings: Array of 3-7 bullet point strings summarizing the most important findings\n" +
  "- recommendations: Array of action items with priority (critical/high/medium/low)\n" +
  "- metadata: {confidence: 0-100, data_completeness: 0-100, applicable_standards: string[]}\n" +
  "\n" +
  "Return ONLY valid JSON. No markdown wrapping. No explanation outside the JSON.";

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
// HANDLER
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
        actions: [
          { name: "get_registry", description: "Engine overview and capabilities" },
          { name: "query_session", description: "Ask a natural language question about a session", params: "session_id (required), query (required or use preset), preset (optional: executive_summary, proof_chain, inspection_plan, risk_assessment, standards_compliance, full_technical)" },
          { name: "list_sessions", description: "List available reasoning sessions", params: "limit (optional, default 20), status (optional, default complete)" },
          { name: "get_report", description: "Retrieve a previously generated report", params: "report_id (required)" },
          { name: "get_report_history", description: "List reports for a session", params: "session_id (required)" }
        ],
        presets: Object.keys(QUERY_PRESETS),
        ai_model: "claude-sonnet-4-20250514",
        capabilities: [
          "Natural language querying of Superbrain v6 session data",
          "Dynamic report generation — no canned templates",
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

    // --- get_report_history ---
    if (action === "get_report_history") {
      if (!body.session_id) return errResp(400, "session_id required");
      if (!supabaseUrl || !supabaseKey) return errResp(500, "SUPABASE not configured");
      var sb = createClient(supabaseUrl, supabaseKey);

      var histRes = await sb.from("superbrain_reports")
        .select("id, session_id, query, preset, report_title, report_type, created_at")
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

    // --- query_session (main action) ---
    if (action === "query_session" || !action) {
      if (!body.session_id) return errResp(400, "session_id required");
      if (!body.query && !body.preset) return errResp(400, "query or preset required");
      if (!supabaseUrl || !supabaseKey) return errResp(500, "SUPABASE not configured");
      if (!anthropicKey) return errResp(500, "ANTHROPIC_API_KEY not configured");

      var sb = createClient(supabaseUrl, supabaseKey);

      // Load the full session
      var sessRes = await sb.from("reasoning_sessions")
        .select("*")
        .eq("id", body.session_id)
        .single();

      if (sessRes.error || !sessRes.data) return errResp(404, "Session not found: " + body.session_id);

      var session = sessRes.data;
      if (session.pipeline_status !== "complete") {
        return errResp(400, "Session pipeline is not complete. Status: " + session.pipeline_status);
      }

      // Build the query
      var userQuery = body.query || "";
      if (body.preset && QUERY_PRESETS[body.preset]) {
        userQuery = QUERY_PRESETS[body.preset] + (userQuery ? "\n\nAdditional context: " + userQuery : "");
      }

      // Build the session context for Claude
      var sessionContext = "=== SUPERBRAIN V6 SESSION DATA ===\n\n";
      sessionContext += "Session ID: " + session.id + "\n";
      sessionContext += "Case ID: " + (session.case_id || "direct input") + "\n";
      sessionContext += "Pipeline Version: " + (session.pipeline_version || "unknown") + "\n";
      sessionContext += "Status: " + session.pipeline_status + "\n";
      sessionContext += "Total Duration: " + (session.total_duration_ms || "unknown") + " ms\n\n";

      // Input summary
      if (session.input_summary) {
        sessionContext += "=== INPUT ===\n";
        sessionContext += JSON.stringify(session.input_summary, null, 2) + "\n\n";
      }

      // Model A output
      if (session.model_a_output) {
        sessionContext += "=== MODEL A OUTPUT (Physics + Proof Chain) ===\n";
        var modelAStr = typeof session.model_a_output === "string" ? session.model_a_output : JSON.stringify(session.model_a_output, null, 2);
        // Truncate if over 15k chars to stay within token limits
        if (modelAStr.length > 15000) modelAStr = modelAStr.substring(0, 15000) + "\n... [truncated]";
        sessionContext += modelAStr + "\n\n";
      }

      // Model B output
      if (session.model_b_output) {
        sessionContext += "=== MODEL B OUTPUT (Engineering + Standards Authority) ===\n";
        var modelBStr = typeof session.model_b_output === "string" ? session.model_b_output : JSON.stringify(session.model_b_output, null, 2);
        if (modelBStr.length > 15000) modelBStr = modelBStr.substring(0, 15000) + "\n... [truncated]";
        sessionContext += modelBStr + "\n\n";
      }

      // Model C output
      if (session.model_c_output) {
        sessionContext += "=== MODEL C OUTPUT (Adversarial + Proof Break Detection) ===\n";
        var modelCStr = typeof session.model_c_output === "string" ? session.model_c_output : JSON.stringify(session.model_c_output, null, 2);
        if (modelCStr.length > 15000) modelCStr = modelCStr.substring(0, 15000) + "\n... [truncated]";
        sessionContext += modelCStr + "\n\n";
      }

      // Resolution output
      if (session.resolution_output) {
        sessionContext += "=== RESOLUTION OUTPUT (Decision Proof + Governance Lock) ===\n";
        var resStr = typeof session.resolution_output === "string" ? session.resolution_output : JSON.stringify(session.resolution_output, null, 2);
        if (resStr.length > 15000) resStr = resStr.substring(0, 15000) + "\n... [truncated]";
        sessionContext += resStr + "\n\n";
      }

      // Final output (includes engine_enrichment)
      if (session.final_output) {
        sessionContext += "=== FINAL OUTPUT (with Engine Enrichment) ===\n";
        var finalStr = typeof session.final_output === "string" ? session.final_output : JSON.stringify(session.final_output, null, 2);
        if (finalStr.length > 20000) finalStr = finalStr.substring(0, 20000) + "\n... [truncated]";
        sessionContext += finalStr + "\n\n";
      }

      // Call Claude
      var startTime = Date.now();
      var claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8000,
          system: REPORT_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: "SESSION DATA:\n\n" + sessionContext + "\n\n---\n\nQUERY:\n" + userQuery
            }
          ]
        })
      });

      var claudeDuration = Date.now() - startTime;

      if (!claudeResp.ok) {
        var errText = "";
        try { errText = await claudeResp.text(); } catch(e) { errText = "unknown"; }
        return errResp(502, "Claude API error: HTTP " + claudeResp.status + " — " + errText.substring(0, 500));
      }

      var claudeJson = await claudeResp.json();
      var rawResponse = "";
      if (claudeJson.content && claudeJson.content.length > 0) {
        rawResponse = claudeJson.content[0].text || "";
      }

      // Parse the structured report from Claude's response
      var report = null;
      try {
        // Try to extract JSON if wrapped in markdown code blocks
        var jsonStr = rawResponse;
        if (jsonStr.indexOf("```") >= 0) {
          var jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) jsonStr = jsonMatch[1].trim();
        }
        report = JSON.parse(jsonStr);
      } catch(parseErr) {
        // If Claude didn't return valid JSON, wrap the raw text
        report = {
          report_title: "Superbrain Session Analysis",
          report_type: "custom",
          sections: [{ heading: "Analysis", content: rawResponse }],
          key_findings: [],
          recommendations: [],
          metadata: { confidence: 50, data_completeness: 50, applicable_standards: [], parse_note: "Raw text response — structured parsing failed" }
        };
      }

      // Save to database
      var reportRecord = {
        session_id: body.session_id,
        query: body.query || null,
        preset: body.preset || null,
        report_title: report.report_title || "Untitled Report",
        report_type: report.report_type || "custom",
        report_content: report,
        raw_response: rawResponse,
        claude_model: "claude-sonnet-4-20250514",
        claude_duration_ms: claudeDuration,
        input_tokens: claudeJson.usage ? claudeJson.usage.input_tokens : null,
        output_tokens: claudeJson.usage ? claudeJson.usage.output_tokens : null,
        created_at: new Date().toISOString()
      };

      var saveRes = await sb.from("superbrain_reports").insert(reportRecord).select("id").single();
      var reportId = (saveRes.data && saveRes.data.id) ? saveRes.data.id : null;

      if (saveRes.error) {
        // Still return the report even if save fails
        console.log("Warning: failed to save report — " + saveRes.error.message);
      }

      return ok({
        engine: "superbrain-report",
        version: ENGINE_VERSION,
        action: "query_session",
        report_id: reportId,
        session_id: body.session_id,
        query: body.query || null,
        preset: body.preset || null,
        claude_duration_ms: claudeDuration,
        tokens: {
          input: claudeJson.usage ? claudeJson.usage.input_tokens : null,
          output: claudeJson.usage ? claudeJson.usage.output_tokens : null
        },
        report: report
      });
    }

    return errResp(400, "Unknown action: " + action + ". Valid: get_registry, query_session, list_sessions, get_report, get_report_history");

  } catch (err) {
    return errResp(500, String(err && err.message ? err.message : err));
  }
};
