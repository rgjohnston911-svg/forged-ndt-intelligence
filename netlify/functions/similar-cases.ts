// @ts-nocheck
/**
 * DEPLOY215 - similar-cases.ts
 * netlify/functions/similar-cases.ts
 *
 * Returns top-K locked cases most similar to the given case, scoped to
 * the case's org_id. If the query case has no embedding yet, lazily
 * embeds it first (calls the same pipeline as embed-case.ts).
 *
 * POST { case_id: string, k?: number }
 *
 * Response: { success: true, neighbors: [{ id, case_number, title, ..., similarity }] }
 *
 * This is the foundation of the "case library compounding" pattern.
 * Every locked case becomes retrievable evidence for future cases.
 *
 * CRITICAL: String concatenation only. No backtick template literals.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var openaiKey = process.env.OPENAI_API_KEY || "";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

function safe(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function buildSummary(c, findings, measurements, thickness) {
  var parts = [];
  parts.push("Case " + safe(c.case_number) + ": " + safe(c.title));
  parts.push("Component: " + safe(c.component_name) + " | Weld: " + safe(c.weld_id) + " | Joint: " + safe(c.joint_type));
  parts.push("Method: " + safe(c.method) + " | Material: " + safe(c.material_class) + " | Load: " + safe(c.load_condition));
  parts.push("Code: " + safe(c.code_family) + " " + safe(c.code_edition));
  if (c.thickness_mm) parts.push("Nominal thickness: " + safe(c.thickness_mm) + " mm");
  if (findings && findings.length > 0) {
    var fList = [];
    for (var i = 0; i < findings.length; i++) {
      var f = findings[i];
      fList.push(safe(f.label || f.finding_type) + (f.severity ? " (" + safe(f.severity) + ")" : ""));
    }
    parts.push("Findings: " + fList.join("; "));
  }
  if (thickness && thickness.length > 0) {
    var tVals = [];
    for (var k = 0; k < thickness.length; k++) {
      var tv = Number(thickness[k].thickness_in);
      if (!isNaN(tv) && tv > 0) tVals.push(tv);
    }
    if (tVals.length > 0) {
      var tMin = Math.min.apply(null, tVals);
      parts.push("Min thickness reading: " + tMin.toFixed(4) + " in across " + tVals.length + " points");
    }
  }
  if (c.final_disposition) parts.push("Disposition: " + safe(c.final_disposition));
  if (c.final_decision_reason) parts.push("Reason: " + safe(c.final_decision_reason));
  return parts.join("\n");
}

async function getEmbedding(text) {
  var resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + openaiKey
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text })
  });
  if (!resp.ok) {
    var errText = await resp.text();
    throw new Error("OpenAI embedding failed: " + resp.status + " " + errText);
  }
  var json = await resp.json();
  return json.data[0].embedding;
}

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var caseId = body.case_id;
    var k = body.k && Number(body.k) > 0 ? Number(body.k) : 5;
    if (!caseId) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };

    var sb = createClient(supabaseUrl, supabaseKey);

    var caseRes = await sb.from("inspection_cases").select("*").eq("id", caseId).single();
    if (caseRes.error || !caseRes.data) {
      return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "case not found" }) };
    }
    var caseRow = caseRes.data;

    var queryEmbedding = caseRow.case_embedding;

    // Lazy embed if missing
    if (!queryEmbedding) {
      var findingsRes = await sb.from("findings").select("*").eq("case_id", caseId);
      var measRes = await sb.from("measurements").select("*").eq("case_id", caseId);
      var thkRes = await sb.from("thickness_readings").select("*").eq("case_id", caseId);
      var summary = buildSummary(caseRow, findingsRes.data || [], measRes.data || [], thkRes.data || []);
      queryEmbedding = await getEmbedding(summary);
      await sb.from("inspection_cases").update({
        case_summary: summary,
        case_embedding: queryEmbedding,
        embedded_at: new Date().toISOString()
      }).eq("id", caseId);
    }

    // Call the RPC
    var rpcRes = await sb.rpc("find_similar_cases", {
      query_embedding: queryEmbedding,
      query_org_id: caseRow.org_id,
      exclude_case_id: caseId,
      match_count: k
    });

    if (rpcRes.error) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "similarity rpc failed", detail: rpcRes.error.message }) };
    }

    var neighbors = rpcRes.data || [];

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        case_id: caseId,
        count: neighbors.length,
        neighbors: neighbors
      })
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
