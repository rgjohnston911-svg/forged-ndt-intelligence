// @ts-nocheck
/**
 * DEPLOY215 - embed-case.ts
 * netlify/functions/embed-case.ts
 *
 * Builds a canonical summary string from an inspection_cases row
 * (component, material, method, findings, measurements, disposition,
 * reasoning) and stores an OpenAI text-embedding-3-small (1536d) vector
 * plus the summary text back on the case.
 *
 * Idempotent. Re-callable after any case mutation. Safe to invoke
 * after run-authority to refresh embeddings once a case locks.
 *
 * POST { case_id: string, force?: boolean }
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
  parts.push("Code: " + safe(c.code_family) + " " + safe(c.code_edition) + (c.code_section ? " section " + safe(c.code_section) : ""));
  if (c.thickness_mm) parts.push("Nominal thickness: " + safe(c.thickness_mm) + " mm");

  if (findings && findings.length > 0) {
    var fList = [];
    for (var i = 0; i < findings.length; i++) {
      var f = findings[i];
      var label = safe(f.label || f.finding_type);
      var sev = f.severity ? " (" + safe(f.severity) + ")" : "";
      var conf = f.confidence != null ? " conf=" + Math.round(Number(f.confidence) * 100) + "%" : "";
      fList.push(label + sev + conf);
    }
    parts.push("Findings: " + fList.join("; "));
  } else {
    parts.push("Findings: none");
  }

  if (measurements && measurements.length > 0) {
    var mList = [];
    for (var j = 0; j < measurements.length && j < 20; j++) {
      var m = measurements[j];
      mList.push(safe(m.finding_type) + "." + safe(m.measurement_key) + "=" + safe(m.value_imperial) + " in");
    }
    parts.push("Measurements: " + mList.join("; "));
  }

  if (thickness && thickness.length > 0) {
    var tVals = [];
    for (var k = 0; k < thickness.length; k++) {
      var tv = Number(thickness[k].thickness_in);
      if (!isNaN(tv) && tv > 0) tVals.push(tv);
    }
    if (tVals.length > 0) {
      var tMin = Math.min.apply(null, tVals);
      var tMax = Math.max.apply(null, tVals);
      var tSum = 0; for (var s = 0; s < tVals.length; s++) tSum += tVals[s];
      var tAvg = tSum / tVals.length;
      parts.push("Thickness readings: n=" + tVals.length + ", min=" + tMin.toFixed(4) + " in, avg=" + tAvg.toFixed(4) + " in, max=" + tMax.toFixed(4) + " in");
    }
  }

  if (c.final_disposition) {
    parts.push("Disposition: " + safe(c.final_disposition) + (c.final_confidence != null ? " @ " + Math.round(Number(c.final_confidence) * 100) + "%" : ""));
  }
  if (c.final_decision_reason) parts.push("Reason: " + safe(c.final_decision_reason));
  if (c.truth_engine_summary) parts.push("Summary: " + safe(c.truth_engine_summary));

  return parts.join("\n");
}

async function getEmbedding(text) {
  var resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + openaiKey
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text
    })
  });
  if (!resp.ok) {
    var errText = await resp.text();
    throw new Error("OpenAI embedding failed: " + resp.status + " " + errText);
  }
  var json = await resp.json();
  if (!json.data || !json.data[0] || !json.data[0].embedding) {
    throw new Error("OpenAI embedding response malformed");
  }
  return json.data[0].embedding;
}

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var caseId = body.case_id;
    var force = body.force === true;
    if (!caseId) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };

    var sb = createClient(supabaseUrl, supabaseKey);

    var caseRes = await sb.from("inspection_cases").select("*").eq("id", caseId).single();
    if (caseRes.error || !caseRes.data) {
      return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "case not found", detail: caseRes.error && caseRes.error.message }) };
    }
    var caseRow = caseRes.data;

    if (!force && caseRow.case_embedding && caseRow.embedded_at) {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, skipped: true, reason: "already_embedded" }) };
    }

    var findingsRes = await sb.from("findings").select("*").eq("case_id", caseId);
    var measRes = await sb.from("measurements").select("*").eq("case_id", caseId);
    var thkRes = await sb.from("thickness_readings").select("*").eq("case_id", caseId);

    var summary = buildSummary(
      caseRow,
      findingsRes.data || [],
      measRes.data || [],
      thkRes.data || []
    );

    var embedding = await getEmbedding(summary);

    var upd = await sb.from("inspection_cases").update({
      case_summary: summary,
      case_embedding: embedding,
      embedded_at: new Date().toISOString()
    }).eq("id", caseId);

    if (upd.error) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "update failed", detail: upd.error.message }) };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        case_id: caseId,
        summary_chars: summary.length,
        embedding_dim: embedding.length
      })
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
