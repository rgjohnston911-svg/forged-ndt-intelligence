// @ts-nocheck
/**
 * DEPLOY271 - superbrain-report-background.ts
 * netlify/functions/superbrain-report-background.ts
 *
 * SUPERBRAIN REPORT QUERY ENGINE — BACKGROUND WORKER
 * Called by the router (superbrain-report.ts) to do the heavy lifting:
 *   1. Load session data from Supabase
 *   2. Build context string from all model outputs + engine enrichment
 *   3. Call Claude API with session context + user query
 *   4. Parse structured report from Claude response
 *   5. Save completed report to superbrain_reports table
 *
 * Runs as a Netlify Background Function (up to 15 minutes).
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var anthropicKey = process.env.ANTHROPIC_API_KEY || "";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

// ============================================================
// REPORT SYSTEM PROMPT
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
  "4. Structure your response with clear sections.\n" +
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
  "- recommendations: Array of {action: string, priority: string} objects where priority is critical/high/medium/low\n" +
  "- metadata: {confidence: 0-100, data_completeness: 0-100, applicable_standards: string[]}\n" +
  "\n" +
  "Return ONLY valid JSON. No markdown wrapping. No explanation outside the JSON.";

// ============================================================
// BACKGROUND HANDLER
// ============================================================
export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  var sb = createClient(supabaseUrl, supabaseKey);

  try {
    var body = JSON.parse(event.body || "{}");
    var reportId = body.report_id;
    var sessionId = body.session_id;
    var query = body.query;

    if (!reportId || !sessionId || !query) {
      console.log("Missing required params: report_id, session_id, query");
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Missing params" }) };
    }

    console.log("Report background started: report=" + reportId + " session=" + sessionId);

    // Load the full session
    var sessRes = await sb.from("reasoning_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessRes.error || !sessRes.data) {
      await sb.from("superbrain_reports")
        .update({ report_status: "error", raw_response: "Session not found: " + sessionId })
        .eq("id", reportId);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ status: "error" }) };
    }

    var session = sessRes.data;

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
      if (modelAStr.length > 12000) modelAStr = modelAStr.substring(0, 12000) + "\n... [truncated]";
      sessionContext += modelAStr + "\n\n";
    }

    // Model B output
    if (session.model_b_output) {
      sessionContext += "=== MODEL B OUTPUT (Engineering + Standards Authority) ===\n";
      var modelBStr = typeof session.model_b_output === "string" ? session.model_b_output : JSON.stringify(session.model_b_output, null, 2);
      if (modelBStr.length > 12000) modelBStr = modelBStr.substring(0, 12000) + "\n... [truncated]";
      sessionContext += modelBStr + "\n\n";
    }

    // Model C output
    if (session.model_c_output) {
      sessionContext += "=== MODEL C OUTPUT (Adversarial + Proof Break Detection) ===\n";
      var modelCStr = typeof session.model_c_output === "string" ? session.model_c_output : JSON.stringify(session.model_c_output, null, 2);
      if (modelCStr.length > 12000) modelCStr = modelCStr.substring(0, 12000) + "\n... [truncated]";
      sessionContext += modelCStr + "\n\n";
    }

    // Resolution output
    if (session.resolution_output) {
      sessionContext += "=== RESOLUTION OUTPUT (Decision Proof + Governance Lock) ===\n";
      var resStr = typeof session.resolution_output === "string" ? session.resolution_output : JSON.stringify(session.resolution_output, null, 2);
      if (resStr.length > 12000) resStr = resStr.substring(0, 12000) + "\n... [truncated]";
      sessionContext += resStr + "\n\n";
    }

    // Final output (includes engine_enrichment)
    if (session.final_output) {
      sessionContext += "=== FINAL OUTPUT (with Engine Enrichment) ===\n";
      var finalStr = typeof session.final_output === "string" ? session.final_output : JSON.stringify(session.final_output, null, 2);
      if (finalStr.length > 15000) finalStr = finalStr.substring(0, 15000) + "\n... [truncated]";
      sessionContext += finalStr + "\n\n";
    }

    console.log("Context built: " + sessionContext.length + " chars. Calling Claude...");

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
        max_tokens: 6000,
        system: REPORT_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: "SESSION DATA:\n\n" + sessionContext + "\n\n---\n\nQUERY:\n" + query
          }
        ]
      })
    });

    var claudeDuration = Date.now() - startTime;
    console.log("Claude responded in " + claudeDuration + "ms, status " + claudeResp.status);

    if (!claudeResp.ok) {
      var errText = "";
      try { errText = await claudeResp.text(); } catch(e) { errText = "unknown"; }
      await sb.from("superbrain_reports")
        .update({
          report_status: "error",
          raw_response: "Claude API error: HTTP " + claudeResp.status + " — " + errText.substring(0, 1000),
          claude_duration_ms: claudeDuration,
          updated_at: new Date().toISOString()
        })
        .eq("id", reportId);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ status: "error" }) };
    }

    var claudeJson = await claudeResp.json();
    var rawResponse = "";
    if (claudeJson.content && claudeJson.content.length > 0) {
      rawResponse = claudeJson.content[0].text || "";
    }

    // Parse the structured report from Claude's response
    var report = null;
    try {
      var jsonStr = rawResponse;
      // Strip markdown code blocks if present
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

    // Save completed report
    var updateRes = await sb.from("superbrain_reports")
      .update({
        report_status: "complete",
        report_title: report.report_title || "Superbrain Report",
        report_type: report.report_type || "custom",
        report_content: report,
        raw_response: rawResponse,
        claude_model: "claude-sonnet-4-20250514",
        claude_duration_ms: claudeDuration,
        input_tokens: claudeJson.usage ? claudeJson.usage.input_tokens : null,
        output_tokens: claudeJson.usage ? claudeJson.usage.output_tokens : null,
        updated_at: new Date().toISOString()
      })
      .eq("id", reportId);

    if (updateRes.error) {
      console.log("Failed to save report: " + updateRes.error.message);
    } else {
      console.log("Report saved successfully: " + reportId);
    }

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ status: "complete", report_id: reportId }) };

  } catch (err) {
    console.log("Background error: " + String(err));
    try {
      await sb.from("superbrain_reports")
        .update({
          report_status: "error",
          raw_response: "Background function error: " + String(err),
          updated_at: new Date().toISOString()
        })
        .eq("id", body.report_id);
    } catch(e) {}
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ status: "error" }) };
  }
};
