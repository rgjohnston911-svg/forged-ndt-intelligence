// @ts-nocheck
/**
 * DEPLOY216 - export-audit-bundle.ts
 * netlify/functions/export-audit-bundle.ts
 *
 * Returns the signed decision bundle for a case, plus an integrity
 * re-verification (hashes the stored bundle and compares against the
 * stored hash). Any mismatch proves tampering or data drift.
 *
 * This is the artifact an inspection authority of record can sign off
 * on. Competitors shipping LLM black boxes cannot produce this.
 *
 * GET  /api/export-audit-bundle?case_id=...   -> JSON bundle + verification
 * POST /api/export-audit-bundle { case_id }   -> same
 *
 * CRITICAL: String concatenation only. No backtick template literals.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json"
};

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

function hashBundle(bundle) {
  return createHash("sha256").update(stableStringify(bundle)).digest("hex");
}

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };

  try {
    var caseId = null;
    if (event.httpMethod === "GET") {
      caseId = event.queryStringParameters && event.queryStringParameters.case_id;
    } else if (event.httpMethod === "POST") {
      var body = JSON.parse(event.body || "{}");
      caseId = body.case_id;
    } else {
      return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed" }) };
    }
    if (!caseId) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };

    var sb = createClient(supabaseUrl, supabaseKey);
    var res = await sb.from("inspection_cases")
      .select("id, case_number, decision_bundle, decision_bundle_hash, decision_bundle_version, decision_bundle_signed_at")
      .eq("id", caseId)
      .single();

    if (res.error || !res.data) {
      return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "case not found" }) };
    }
    if (!res.data.decision_bundle) {
      return { statusCode: 409, headers: corsHeaders, body: JSON.stringify({
        error: "no_bundle_yet",
        detail: "Run /api/decision-spine for this case first to generate a signed bundle."
      }) };
    }

    // Integrity re-verification
    var recomputedHash = hashBundle(res.data.decision_bundle);
    var storedHash = res.data.decision_bundle_hash;
    var integrityOK = recomputedHash === storedHash;

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        case_id: res.data.id,
        case_number: res.data.case_number,
        bundle_version: res.data.decision_bundle_version,
        signed_at: res.data.decision_bundle_signed_at,
        stored_hash: storedHash,
        recomputed_hash: recomputedHash,
        integrity_verified: integrityOK,
        integrity_note: integrityOK
          ? "Stored hash matches recomputed hash. Bundle is untampered."
          : "HASH MISMATCH. Bundle has been modified after signing or the hash function changed. DO NOT trust this bundle; re-run decision-spine.",
        bundle: res.data.decision_bundle
      }, null, 2)
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
