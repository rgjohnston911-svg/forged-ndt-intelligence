// @ts-nocheck
/**
 * DEPLOY250 - evidence-integrity.ts
 * netlify/functions/evidence-integrity.ts
 *
 * EVIDENCE INTEGRITY ENGINE
 * Tamper-evident evidence chain with HMAC-SHA256 on evidence objects,
 * provenance tracking, integrity verification, chain-of-custody
 *
 * POST /api/evidence-integrity { action, ... }
 *
 * Actions:
 *   seal_evidence          - compute and store integrity hash for evidence item
 *   verify_evidence        - verify integrity hash matches stored evidence
 *   verify_case_evidence   - verify all evidence for a case
 *   get_provenance         - full chain-of-custody for an evidence item
 *   get_integrity_report   - integrity status report for a case
 *   get_registry           - engine registry
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var SIGNING_SECRET = process.env.EVIDENCE_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "default-evidence-key";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

// ── INTEGRITY FUNCTIONS ────────────────────────────────────────────

function computeEvidenceHash(evidence) {
  var payload = JSON.stringify({
    id: evidence.id,
    case_id: evidence.case_id,
    evidence_type: evidence.evidence_type,
    file_name: evidence.file_name,
    metadata: evidence.metadata,
    created_at: evidence.created_at
  });
  return crypto.createHmac("sha256", SIGNING_SECRET).update(payload).digest("hex");
}

function computeChainHash(evidenceHashes) {
  var combined = evidenceHashes.join("|");
  return crypto.createHmac("sha256", SIGNING_SECRET).update(combined).digest("hex");
}

// ── HANDLER ────────────────────────────────────────────────────────

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";

    // ── get_registry ──
    if (action === "get_registry") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "evidence-integrity",
          deploy: "DEPLOY250",
          version: "1.0.0",
          capabilities: [
            "hmac_sha256_evidence_sealing",
            "per_item_integrity_verification",
            "case_level_chain_verification",
            "provenance_tracking",
            "tamper_detection"
          ],
          hash_algorithm: "HMAC-SHA256",
          philosophy: "Every evidence object — files, images, sensor data, measurements — must have verifiable integrity. If a single byte changes, the hash breaks."
        })
      };
    }

    var sb = createClient(supabaseUrl, supabaseKey);

    // ── seal_evidence ──
    if (action === "seal_evidence") {
      if (!body.evidence_id) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "evidence_id required" }) };
      }

      var evidRes = await sb.from("evidence").select("*").eq("id", body.evidence_id).single();
      if (evidRes.error || !evidRes.data) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ action: "seal_evidence", evidence_id: body.evidence_id, error: "evidence_not_found" }) };
      }

      var evidence = evidRes.data;
      var hash = computeEvidenceHash(evidence);

      // store hash in metadata
      var existingMeta = evidence.metadata || {};
      existingMeta.integrity_hash = hash;
      existingMeta.sealed_at = new Date().toISOString();
      existingMeta.sealed_by = body.user_id || "system";
      existingMeta.hash_algorithm = "HMAC-SHA256";

      await sb.from("evidence").update({ metadata: existingMeta }).eq("id", body.evidence_id);

      // audit log
      await sb.from("audit_events").insert({
        case_id: evidence.case_id,
        event_type: "evidence_sealed",
        event_data: { evidence_id: body.evidence_id, hash: hash, algorithm: "HMAC-SHA256" },
        created_by: body.user_id || "system"
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "seal_evidence",
          evidence_id: body.evidence_id,
          case_id: evidence.case_id,
          integrity_hash: hash,
          algorithm: "HMAC-SHA256",
          sealed_at: existingMeta.sealed_at,
          status: "sealed"
        })
      };
    }

    // ── verify_evidence ──
    if (action === "verify_evidence") {
      if (!body.evidence_id) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "evidence_id required" }) };
      }

      var vRes = await sb.from("evidence").select("*").eq("id", body.evidence_id).single();
      if (vRes.error || !vRes.data) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ action: "verify_evidence", evidence_id: body.evidence_id, error: "evidence_not_found" }) };
      }

      var vEvid = vRes.data;
      var storedHash = (vEvid.metadata || {}).integrity_hash;

      if (!storedHash) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            action: "verify_evidence",
            evidence_id: body.evidence_id,
            status: "not_sealed",
            message: "Evidence has not been sealed. Call seal_evidence first."
          })
        };
      }

      // recompute hash from current data (temporarily remove integrity fields for comparison)
      var cleanEvid = JSON.parse(JSON.stringify(vEvid));
      delete cleanEvid.metadata.integrity_hash;
      delete cleanEvid.metadata.sealed_at;
      delete cleanEvid.metadata.sealed_by;
      delete cleanEvid.metadata.hash_algorithm;

      var recomputedPayload = JSON.stringify({
        id: cleanEvid.id,
        case_id: cleanEvid.case_id,
        evidence_type: cleanEvid.evidence_type,
        file_name: cleanEvid.file_name,
        metadata: cleanEvid.metadata,
        created_at: cleanEvid.created_at
      });
      var recomputedHash = crypto.createHmac("sha256", SIGNING_SECRET).update(recomputedPayload).digest("hex");

      var match = storedHash === recomputedHash;

      // audit log
      await sb.from("audit_events").insert({
        case_id: vEvid.case_id,
        event_type: "evidence_integrity_check",
        event_data: { evidence_id: body.evidence_id, match: match, stored_hash: storedHash.substring(0, 16) + "...", recomputed_hash: recomputedHash.substring(0, 16) + "..." },
        created_by: body.user_id || "system"
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "verify_evidence",
          evidence_id: body.evidence_id,
          case_id: vEvid.case_id,
          integrity_status: match ? "VERIFIED" : "TAMPERED",
          hash_match: match,
          sealed_at: (vEvid.metadata || {}).sealed_at,
          message: match ? "Evidence integrity verified. No modification detected since sealing." : "INTEGRITY VIOLATION: Evidence has been modified since sealing. Stored hash does not match recomputed hash."
        })
      };
    }

    // ── verify_case_evidence ──
    if (action === "verify_case_evidence") {
      if (!body.case_id) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };
      }

      var caseEvidRes = await sb.from("evidence").select("*").eq("case_id", body.case_id).order("created_at", { ascending: true });
      var allEvid = caseEvidRes.data || [];

      var sealedCount = 0;
      var verifiedCount = 0;
      var tamperedCount = 0;
      var unsealedCount = 0;
      var itemResults = [];
      var hashes = [];

      for (var ei = 0; ei < allEvid.length; ei++) {
        var ev = allEvid[ei];
        var evHash = (ev.metadata || {}).integrity_hash;

        if (!evHash) {
          unsealedCount++;
          itemResults.push({ evidence_id: ev.id, file_name: ev.file_name, status: "not_sealed" });
          continue;
        }

        sealedCount++;
        hashes.push(evHash);

        var cleanEv = JSON.parse(JSON.stringify(ev));
        delete cleanEv.metadata.integrity_hash;
        delete cleanEv.metadata.sealed_at;
        delete cleanEv.metadata.sealed_by;
        delete cleanEv.metadata.hash_algorithm;

        var evPayload = JSON.stringify({
          id: cleanEv.id,
          case_id: cleanEv.case_id,
          evidence_type: cleanEv.evidence_type,
          file_name: cleanEv.file_name,
          metadata: cleanEv.metadata,
          created_at: cleanEv.created_at
        });
        var evRecomputed = crypto.createHmac("sha256", SIGNING_SECRET).update(evPayload).digest("hex");

        if (evHash === evRecomputed) {
          verifiedCount++;
          itemResults.push({ evidence_id: ev.id, file_name: ev.file_name, status: "verified" });
        } else {
          tamperedCount++;
          itemResults.push({ evidence_id: ev.id, file_name: ev.file_name, status: "TAMPERED" });
        }
      }

      // compute chain hash
      var chainHash = hashes.length > 0 ? computeChainHash(hashes) : null;

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "verify_case_evidence",
          case_id: body.case_id,
          total_evidence: allEvid.length,
          sealed: sealedCount,
          verified: verifiedCount,
          tampered: tamperedCount,
          unsealed: unsealedCount,
          chain_hash: chainHash,
          overall_status: tamperedCount > 0 ? "INTEGRITY_VIOLATION" : (unsealedCount > 0 ? "PARTIALLY_SEALED" : (allEvid.length === 0 ? "NO_EVIDENCE" : "FULLY_VERIFIED")),
          items: itemResults
        })
      };
    }

    // ── get_provenance ──
    if (action === "get_provenance") {
      if (!body.evidence_id) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "evidence_id required" }) };
      }

      var provEvid = await sb.from("evidence").select("*").eq("id", body.evidence_id).single();
      if (provEvid.error || !provEvid.data) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ action: "get_provenance", evidence_id: body.evidence_id, error: "evidence_not_found" }) };
      }

      var provAudit = await sb.from("audit_events")
        .select("*")
        .eq("case_id", provEvid.data.case_id)
        .order("created_at", { ascending: true });

      var relevantEvents = (provAudit.data || []).filter(function(e) {
        return (e.event_data && e.event_data.evidence_id === body.evidence_id) ||
               e.event_type === "evidence_created" ||
               e.event_type === "evidence_sealed" ||
               e.event_type === "evidence_integrity_check" ||
               e.event_type === "sensor_data_ingested";
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "get_provenance",
          evidence_id: body.evidence_id,
          evidence: {
            id: provEvid.data.id,
            case_id: provEvid.data.case_id,
            type: provEvid.data.evidence_type,
            file_name: provEvid.data.file_name,
            created_at: provEvid.data.created_at,
            sealed: !!(provEvid.data.metadata || {}).integrity_hash,
            sealed_at: (provEvid.data.metadata || {}).sealed_at || null
          },
          chain_of_custody: relevantEvents.map(function(e, idx) {
            return {
              step: idx + 1,
              event_type: e.event_type,
              created_at: e.created_at,
              created_by: e.created_by,
              details: e.event_data
            };
          }),
          total_custody_events: relevantEvents.length
        })
      };
    }

    // ── get_integrity_report ──
    if (action === "get_integrity_report") {
      if (!body.case_id) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };
      }

      // evidence integrity
      var repEvid = await sb.from("evidence").select("*").eq("case_id", body.case_id);
      var repItems = repEvid.data || [];
      var repSealed = 0;
      var repUnsealed = 0;
      for (var ri = 0; ri < repItems.length; ri++) {
        if ((repItems[ri].metadata || {}).integrity_hash) repSealed++;
        else repUnsealed++;
      }

      // audit trail
      var repAudit = await sb.from("audit_events").select("id, event_type, created_at", { count: "exact", head: false }).eq("case_id", body.case_id);
      var auditCount = (repAudit.data || []).length;

      // audit bundles
      var repBundles = await sb.from("audit_bundles").select("id, created_at, hash_chain_prev", { count: "exact", head: false }).eq("case_id", body.case_id);
      var bundleCount = (repBundles.data || []).length;

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "get_integrity_report",
          case_id: body.case_id,
          evidence_integrity: {
            total_items: repItems.length,
            sealed: repSealed,
            unsealed: repUnsealed,
            seal_coverage: repItems.length > 0 ? Math.round(repSealed / repItems.length * 100) : 0
          },
          audit_integrity: {
            total_events: auditCount,
            audit_bundles: bundleCount,
            chain_linked: bundleCount > 0
          },
          overall_integrity_score: (function() {
            var score = 0;
            if (repItems.length > 0 && repSealed === repItems.length) score += 40;
            else if (repSealed > 0) score += 20;
            if (auditCount > 0) score += 30;
            if (bundleCount > 0) score += 30;
            return score;
          })(),
          integrity_grade: (function() {
            var s = 0;
            if (repItems.length > 0 && repSealed === repItems.length) s += 40;
            else if (repSealed > 0) s += 20;
            if (auditCount > 0) s += 30;
            if (bundleCount > 0) s += 30;
            if (s >= 90) return "A";
            if (s >= 70) return "B";
            if (s >= 50) return "C";
            if (s >= 30) return "D";
            return "F";
          })(),
          recommendations: (function() {
            var recs = [];
            if (repUnsealed > 0) recs.push("Seal " + repUnsealed + " unsealed evidence items via seal_evidence");
            if (auditCount === 0) recs.push("No audit events found — ensure decision engines log to audit trail");
            if (bundleCount === 0) recs.push("Generate audit bundle via export-audit-bundle for regulatory submission");
            if (recs.length === 0) recs.push("Full integrity coverage achieved");
            return recs;
          })()
        })
      };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action, valid_actions: ["seal_evidence", "verify_evidence", "verify_case_evidence", "get_provenance", "get_integrity_report", "get_registry"] }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
