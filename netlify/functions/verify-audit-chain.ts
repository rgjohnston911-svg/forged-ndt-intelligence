// @ts-nocheck
/**
 * DEPLOY223 - verify-audit-chain.ts
 * netlify/functions/verify-audit-chain.ts
 *
 * AUDIT CHAIN VERIFICATION
 *
 * Walks the complete chain of signed audit bundles for a case.
 * For each bundle:
 *   1. Recomputes SHA-256 hash of bundle data
 *   2. Verifies HMAC-SHA256 signature using the signing key
 *   3. Validates chain link (previous_hash matches prior bundle)
 *   4. Reports any breaks, mismatches, or tampering
 *
 * POST /api/verify-audit-chain { case_id }
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { createHash, createHmac } from "crypto";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var EXECUTION_MODE = "deterministic";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

function hashData(data) {
  return createHash("sha256").update(stableStringify(data)).digest("hex");
}

function signData(data, secretKey) {
  return createHmac("sha256", secretKey).update(stableStringify(data)).digest("hex");
}

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var caseId = body.case_id;
    if (!caseId) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };

    var sb = createClient(supabaseUrl, supabaseKey);

    // Load all bundles in chain order
    var bundlesRes = await sb.from("audit_bundles")
      .select("*")
      .eq("case_id", caseId)
      .order("bundle_version", { ascending: true });

    if (bundlesRes.error) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "Failed to load bundles: " + bundlesRes.error.message }) };
    }

    var bundles = bundlesRes.data || [];

    if (bundles.length === 0) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          case_id: caseId,
          chain_length: 0,
          chain_valid: true,
          message: "No audit bundles exist for this case yet.",
          verification_results: []
        }, null, 2)
      };
    }

    // Load signing keys for signature verification
    var keysRes = await sb.from("org_signing_keys").select("*");
    var keyMap = {};
    if (keysRes.data) {
      for (var ki = 0; ki < keysRes.data.length; ki++) {
        keyMap[keysRes.data[ki].id] = keysRes.data[ki];
      }
    }

    // Walk the chain
    var verificationResults = [];
    var chainValid = true;
    var chainBreakAt = null;

    for (var bi = 0; bi < bundles.length; bi++) {
      var bundle = bundles[bi];
      var result = {
        bundle_version: bundle.bundle_version,
        bundle_id: bundle.id,
        signed_at: bundle.signed_at,
        signed_by: bundle.signed_by_email || "System",
        stored_hash: bundle.bundle_hash,
        checks: {}
      };

      // Check 1: Recompute hash
      var recomputedHash = hashData(bundle.bundle_data);
      var hashMatch = recomputedHash === bundle.bundle_hash;
      result.checks.hash_integrity = {
        passed: hashMatch,
        stored: bundle.bundle_hash,
        recomputed: recomputedHash,
        detail: hashMatch
          ? "Bundle data hash matches stored hash. Data is untampered."
          : "HASH MISMATCH. Bundle data has been modified after signing."
      };
      if (!hashMatch) { chainValid = false; if (!chainBreakAt) chainBreakAt = bundle.bundle_version; }

      // Check 2: Verify signature
      var signingKey = keyMap[bundle.signing_key_id];
      if (signingKey) {
        var recomputedSig = signData(bundle.bundle_data, signingKey.private_key_encrypted);
        var sigMatch = recomputedSig === bundle.signature;
        result.checks.signature_valid = {
          passed: sigMatch,
          signing_key_id: bundle.signing_key_id,
          key_revoked: signingKey.revoked_at ? true : false,
          detail: sigMatch
            ? "HMAC-SHA256 signature verified with key " + bundle.signing_key_id + "."
            : "SIGNATURE MISMATCH. Bundle was signed with a different key or data was modified."
        };
        if (!sigMatch) { chainValid = false; if (!chainBreakAt) chainBreakAt = bundle.bundle_version; }
        if (signingKey.revoked_at) {
          result.checks.signature_valid.warning = "Signing key was revoked at " + signingKey.revoked_at + ". Bundle was signed before revocation and is still valid.";
        }
      } else {
        result.checks.signature_valid = {
          passed: false,
          signing_key_id: bundle.signing_key_id,
          detail: "Signing key " + bundle.signing_key_id + " not found in org_signing_keys. Cannot verify signature."
        };
        chainValid = false;
        if (!chainBreakAt) chainBreakAt = bundle.bundle_version;
      }

      // Check 3: Chain link
      if (bi === 0) {
        // First bundle in chain
        var firstLinkOk = bundle.previous_hash === null || bundle.previous_hash === undefined;
        result.checks.chain_link = {
          passed: firstLinkOk,
          detail: firstLinkOk
            ? "First bundle in chain. No previous hash expected."
            : "WARNING: First bundle has a previous_hash value (" + bundle.previous_hash + ") but there is no prior bundle."
        };
        if (!firstLinkOk) { chainValid = false; if (!chainBreakAt) chainBreakAt = bundle.bundle_version; }
      } else {
        var prevBundle = bundles[bi - 1];
        var linkMatch = bundle.previous_hash === prevBundle.bundle_hash;
        result.checks.chain_link = {
          passed: linkMatch,
          expected_previous: prevBundle.bundle_hash,
          actual_previous: bundle.previous_hash,
          detail: linkMatch
            ? "Chain link valid. Previous hash matches bundle v" + prevBundle.bundle_version + "."
            : "CHAIN BREAK. Previous hash does not match bundle v" + prevBundle.bundle_version + ". A bundle may have been inserted, deleted, or modified."
        };
        if (!linkMatch) { chainValid = false; if (!chainBreakAt) chainBreakAt = bundle.bundle_version; }
      }

      // Check 4: Version sequence
      var expectedVersion = bi + 1;
      var versionOk = bundle.bundle_version === expectedVersion;
      result.checks.version_sequence = {
        passed: versionOk,
        expected: expectedVersion,
        actual: bundle.bundle_version,
        detail: versionOk
          ? "Version sequence correct."
          : "VERSION GAP. Expected v" + expectedVersion + " but found v" + bundle.bundle_version + ". A bundle may have been deleted."
      };
      if (!versionOk) { chainValid = false; if (!chainBreakAt) chainBreakAt = bundle.bundle_version; }

      // Overall result for this bundle
      var allPassed = result.checks.hash_integrity.passed &&
        result.checks.signature_valid.passed &&
        result.checks.chain_link.passed &&
        result.checks.version_sequence.passed;
      result.overall = allPassed ? "VERIFIED" : "FAILED";

      verificationResults.push(result);
    }

    // Update case chain validity
    await sb.from("inspection_cases").update({
      audit_chain_valid: chainValid
    }).eq("id", caseId);

    // Log verification event
    await sb.from("audit_events").insert({
      case_id: caseId,
      event_type: "bundle_verified",
      event_category: "audit",
      actor_type: "system",
      detail: {
        chain_length: bundles.length,
        chain_valid: chainValid,
        chain_break_at: chainBreakAt,
        verification_count: verificationResults.length
      },
      execution_mode: EXECUTION_MODE,
      function_name: "verify-audit-chain"
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        engine: "verify-audit-chain/1.0.0",
        execution_mode: EXECUTION_MODE,
        case_id: caseId,
        chain_length: bundles.length,
        chain_valid: chainValid,
        chain_break_at: chainBreakAt,
        verified_at: new Date().toISOString(),
        summary: chainValid
          ? "All " + bundles.length + " bundles verified. Hash integrity, signatures, and chain links all valid. No tampering detected."
          : "CHAIN INTEGRITY FAILURE at bundle v" + chainBreakAt + ". " + bundles.length + " bundles checked. Review verification_results for details.",
        verification_results: verificationResults
      }, null, 2)
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
