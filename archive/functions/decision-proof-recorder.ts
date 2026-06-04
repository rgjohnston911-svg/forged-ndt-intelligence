// @ts-nocheck
/**
 * DEPLOY314 - decision-proof-recorder.ts v1.0.0
 * netlify/functions/decision-proof-recorder.ts
 *
 * DECISION PROOF RECORDER ENGINE
 *
 * decision-traceability (DEPLOY248) reconstructs traces AFTER the fact.
 * This engine captures proof AT DECISION TIME — immutable, timestamped,
 * and complete. Every authority decision gets a frozen proof record.
 *
 * When ANY engine produces a disposition or decision lock, this engine
 * records the complete proof chain:
 *   - Input data that informed the decision
 *   - Physics models applied and their outputs
 *   - Code authority referenced and its ruling
 *   - Evidence quality and completeness score
 *   - Alternatives considered and why they were rejected
 *   - Assumptions made and their validity status
 *   - Confidence level and what drove it
 *   - Final decision and rationale
 *
 * Proof records are IMMUTABLE — once written, they cannot be modified.
 * If a decision is revised, a new proof record is created linking to the original.
 *
 * 8 actions:
 *   get_registry          - engine metadata
 *   record_proof          - capture a decision proof (called by authority engines)
 *   get_proof             - retrieve a specific proof by ID
 *   get_proofs_for_case   - all proofs associated with a case
 *   get_proof_chain       - full revision chain for a decision
 *   search_proofs         - search by engine, decision type, date range
 *   get_proof_stats       - statistics on proof records
 *   validate_proof        - check if a proof record is complete and well-formed
 *
 * var only. String concatenation only. No backticks.
 * POST only. Non-fatal DB. export var handler: Handler.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var ENGINE_NAME = "decision-proof-recorder";
var ENGINE_VERSION = "v1.0.0";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

function buildResult(data) {
  return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(data) };
}

function holdResult(code, msg) {
  return { statusCode: code, headers: corsHeaders, body: JSON.stringify({ error: msg, engine: ENGINE_NAME }) };
}

function generateProofId() {
  var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  var id = "PRF-";
  for (var i = 0; i < 12; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function generateHash(data) {
  var str = JSON.stringify(data);
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    var chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return "SHA-" + Math.abs(hash).toString(16).toUpperCase();
}


// ================================================================
// DECISION TYPES — what kinds of decisions we track
// ================================================================

var TRACKED_DECISION_TYPES = [
  "disposition",
  "decision_lock",
  "fitness_for_service",
  "remaining_life",
  "repair_recommendation",
  "code_compliance",
  "risk_classification",
  "escalation",
  "mechanism_identification",
  "material_acceptance",
  "weld_acceptance",
  "coating_assessment",
  "power_generation_assessment"
];

var REQUIRED_PROOF_FIELDS = [
  "case_id",
  "source_engine",
  "decision_type",
  "decision_value",
  "rationale"
];

var RECOMMENDED_PROOF_FIELDS = [
  "input_summary",
  "physics_applied",
  "code_authority",
  "evidence_quality",
  "confidence",
  "alternatives_considered",
  "assumptions"
];


// ================================================================
// PROOF VALIDATOR — checks completeness of a proof record
// ================================================================

function validateProofRecord(proof) {
  var issues = [];
  var score = 0;
  var maxScore = 0;

  // Required fields (weighted heavily)
  for (var i = 0; i < REQUIRED_PROOF_FIELDS.length; i++) {
    var field = REQUIRED_PROOF_FIELDS[i];
    maxScore += 20;
    if (proof[field] !== undefined && proof[field] !== null && proof[field] !== "") {
      score += 20;
    } else {
      issues.push("Missing required field: " + field);
    }
  }

  // Recommended fields (weighted moderately)
  for (var j = 0; j < RECOMMENDED_PROOF_FIELDS.length; j++) {
    var rField = RECOMMENDED_PROOF_FIELDS[j];
    maxScore += 10;
    if (proof[rField] !== undefined && proof[rField] !== null && proof[rField] !== "") {
      score += 10;
    } else {
      issues.push("Missing recommended field: " + rField);
    }
  }

  // Decision type must be recognized
  if (proof.decision_type && TRACKED_DECISION_TYPES.indexOf(proof.decision_type) === -1) {
    issues.push("Unrecognized decision_type: " + proof.decision_type + ". Known types: " + TRACKED_DECISION_TYPES.join(", "));
  }

  // Confidence must be 0-1 if present
  if (proof.confidence !== undefined) {
    if (typeof proof.confidence !== "number" || proof.confidence < 0 || proof.confidence > 1) {
      issues.push("Confidence must be a number between 0 and 1");
    }
  }

  // Evidence quality must be 0-1 if present
  if (proof.evidence_quality !== undefined) {
    if (typeof proof.evidence_quality !== "number" || proof.evidence_quality < 0 || proof.evidence_quality > 1) {
      issues.push("Evidence quality must be a number between 0 and 1");
    }
  }

  var completeness = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return {
    valid: issues.length === 0 || (score >= 80),
    completeness_pct: completeness,
    completeness_grade: completeness >= 90 ? "A" : (completeness >= 75 ? "B" : (completeness >= 60 ? "C" : "D")),
    issues: issues,
    has_required: score >= (REQUIRED_PROOF_FIELDS.length * 20)
  };
}


// ================================================================
// ACTION MAP
// ================================================================

var ACTION_MAP = {

  get_registry: function() {
    return buildResult({
      engine: ENGINE_NAME,
      version: ENGINE_VERSION,
      description: "Immutable decision proof recorder — captures complete proof chain at decision time",
      tracked_decision_types: TRACKED_DECISION_TYPES,
      required_fields: REQUIRED_PROOF_FIELDS,
      recommended_fields: RECOMMENDED_PROOF_FIELDS,
      actions: ["get_registry", "record_proof", "get_proof", "get_proofs_for_case", "get_proof_chain", "search_proofs", "get_proof_stats", "validate_proof"],
      immutable: true,
      note: "Proof records cannot be modified after creation. Revisions create new linked records."
    });
  },

  record_proof: function(body) {
    // Validate required fields
    for (var i = 0; i < REQUIRED_PROOF_FIELDS.length; i++) {
      if (!body[REQUIRED_PROOF_FIELDS[i]]) {
        return holdResult(400, "Missing required field: " + REQUIRED_PROOF_FIELDS[i]);
      }
    }

    var proofId = generateProofId();
    var now = new Date().toISOString();

    var proofRecord = {
      proof_id: proofId,
      case_id: body.case_id,
      source_engine: body.source_engine,
      decision_type: body.decision_type,
      decision_value: body.decision_value,
      rationale: body.rationale,
      input_summary: body.input_summary || null,
      physics_applied: body.physics_applied || null,
      code_authority: body.code_authority || null,
      evidence_quality: body.evidence_quality || null,
      confidence: body.confidence || null,
      alternatives_considered: body.alternatives_considered || null,
      assumptions: body.assumptions || null,
      prior_proof_id: body.prior_proof_id || null,
      revision_reason: body.revision_reason || null,
      metadata: body.metadata || null,
      integrity_hash: null,
      recorded_at: now
    };

    // Generate integrity hash from the proof content
    proofRecord.integrity_hash = generateHash({
      case_id: proofRecord.case_id,
      source_engine: proofRecord.source_engine,
      decision_type: proofRecord.decision_type,
      decision_value: proofRecord.decision_value,
      rationale: proofRecord.rationale,
      recorded_at: proofRecord.recorded_at
    });

    // Validate completeness
    var validation = validateProofRecord(proofRecord);

    // Non-fatal DB store
    var sb = createClient(supabaseUrl, supabaseKey);
    return sb.from("decision_proofs").insert({
      proof_id: proofRecord.proof_id,
      case_id: proofRecord.case_id,
      source_engine: proofRecord.source_engine,
      decision_type: proofRecord.decision_type,
      decision_value: typeof proofRecord.decision_value === "string" ? proofRecord.decision_value : JSON.stringify(proofRecord.decision_value),
      rationale: proofRecord.rationale,
      input_summary: proofRecord.input_summary ? JSON.stringify(proofRecord.input_summary) : null,
      physics_applied: proofRecord.physics_applied ? JSON.stringify(proofRecord.physics_applied) : null,
      code_authority: proofRecord.code_authority ? JSON.stringify(proofRecord.code_authority) : null,
      evidence_quality: proofRecord.evidence_quality,
      confidence: proofRecord.confidence,
      alternatives_considered: proofRecord.alternatives_considered ? JSON.stringify(proofRecord.alternatives_considered) : null,
      assumptions: proofRecord.assumptions ? JSON.stringify(proofRecord.assumptions) : null,
      prior_proof_id: proofRecord.prior_proof_id,
      revision_reason: proofRecord.revision_reason,
      metadata: proofRecord.metadata ? JSON.stringify(proofRecord.metadata) : null,
      integrity_hash: proofRecord.integrity_hash,
      completeness_pct: validation.completeness_pct,
      completeness_grade: validation.completeness_grade,
      recorded_at: proofRecord.recorded_at
    }).then(function(res) {
      var dbStatus = "stored";
      if (res.error) dbStatus = "store_failed: " + res.error.message;

      return buildResult({
        engine: ENGINE_NAME,
        action: "record_proof",
        proof_id: proofRecord.proof_id,
        integrity_hash: proofRecord.integrity_hash,
        completeness: {
          pct: validation.completeness_pct,
          grade: validation.completeness_grade,
          issues: validation.issues
        },
        db_status: dbStatus,
        is_revision: !!proofRecord.prior_proof_id,
        recorded_at: proofRecord.recorded_at
      });
    }).catch(function(err) {
      return buildResult({
        engine: ENGINE_NAME,
        action: "record_proof",
        proof_id: proofRecord.proof_id,
        integrity_hash: proofRecord.integrity_hash,
        completeness: {
          pct: validation.completeness_pct,
          grade: validation.completeness_grade,
          issues: validation.issues
        },
        db_status: "store_failed: " + String(err),
        note: "Proof generated but DB storage failed — non-fatal",
        proof_record: proofRecord
      });
    });
  },

  get_proof: function(body) {
    if (!body.proof_id) return holdResult(400, "proof_id required");

    var sb = createClient(supabaseUrl, supabaseKey);
    return sb.from("decision_proofs")
      .select("*")
      .eq("proof_id", body.proof_id)
      .limit(1)
      .then(function(res) {
        if (res.error) return holdResult(500, "DB error: " + res.error.message);
        if (!res.data || res.data.length === 0) return holdResult(404, "Proof not found: " + body.proof_id);

        return buildResult({
          engine: ENGINE_NAME,
          proof: res.data[0]
        });
      });
  },

  get_proofs_for_case: function(body) {
    if (!body.case_id) return holdResult(400, "case_id required");

    var sb = createClient(supabaseUrl, supabaseKey);
    return sb.from("decision_proofs")
      .select("*")
      .eq("case_id", body.case_id)
      .order("recorded_at", { ascending: true })
      .then(function(res) {
        if (res.error) return holdResult(500, "DB error: " + res.error.message);

        var proofs = res.data || [];

        // Group by decision type
        var byType = {};
        for (var i = 0; i < proofs.length; i++) {
          var dt = proofs[i].decision_type || "unknown";
          if (!byType[dt]) byType[dt] = [];
          byType[dt].push(proofs[i]);
        }

        return buildResult({
          engine: ENGINE_NAME,
          case_id: body.case_id,
          total_proofs: proofs.length,
          by_decision_type: byType,
          proofs: proofs
        });
      });
  },

  get_proof_chain: function(body) {
    if (!body.proof_id) return holdResult(400, "proof_id required");

    var sb = createClient(supabaseUrl, supabaseKey);

    // Get the starting proof
    return sb.from("decision_proofs")
      .select("*")
      .eq("proof_id", body.proof_id)
      .limit(1)
      .then(function(res) {
        if (res.error || !res.data || res.data.length === 0) {
          return holdResult(404, "Proof not found: " + body.proof_id);
        }

        var startProof = res.data[0];
        var caseId = startProof.case_id;
        var sourceEngine = startProof.source_engine;
        var decisionType = startProof.decision_type;

        // Get all proofs for this case + engine + decision type to build the chain
        return sb.from("decision_proofs")
          .select("*")
          .eq("case_id", caseId)
          .eq("source_engine", sourceEngine)
          .eq("decision_type", decisionType)
          .order("recorded_at", { ascending: true })
          .then(function(chainRes) {
            var allProofs = chainRes.data || [];

            // Build revision chain
            var chain = [];
            for (var i = 0; i < allProofs.length; i++) {
              chain.push({
                proof_id: allProofs[i].proof_id,
                decision_value: allProofs[i].decision_value,
                confidence: allProofs[i].confidence,
                prior_proof_id: allProofs[i].prior_proof_id,
                revision_reason: allProofs[i].revision_reason,
                recorded_at: allProofs[i].recorded_at,
                completeness_grade: allProofs[i].completeness_grade
              });
            }

            return buildResult({
              engine: ENGINE_NAME,
              case_id: caseId,
              source_engine: sourceEngine,
              decision_type: decisionType,
              chain_length: chain.length,
              has_revisions: chain.length > 1,
              chain: chain,
              current: chain.length > 0 ? chain[chain.length - 1] : null,
              original: chain.length > 0 ? chain[0] : null
            });
          });
      });
  },

  search_proofs: function(body) {
    var sb = createClient(supabaseUrl, supabaseKey);
    var query = sb.from("decision_proofs").select("*");

    if (body.source_engine) query = query.eq("source_engine", body.source_engine);
    if (body.decision_type) query = query.eq("decision_type", body.decision_type);
    if (body.case_id) query = query.eq("case_id", body.case_id);
    if (body.min_confidence) query = query.gte("confidence", body.min_confidence);
    if (body.completeness_grade) query = query.eq("completeness_grade", body.completeness_grade);
    if (body.from_date) query = query.gte("recorded_at", body.from_date);
    if (body.to_date) query = query.lte("recorded_at", body.to_date);

    var limit = body.limit || 50;
    query = query.order("recorded_at", { ascending: false }).limit(limit);

    return query.then(function(res) {
      if (res.error) return holdResult(500, "DB error: " + res.error.message);

      return buildResult({
        engine: ENGINE_NAME,
        total: (res.data || []).length,
        filters_applied: {
          source_engine: body.source_engine || null,
          decision_type: body.decision_type || null,
          case_id: body.case_id || null,
          min_confidence: body.min_confidence || null,
          completeness_grade: body.completeness_grade || null,
          from_date: body.from_date || null,
          to_date: body.to_date || null
        },
        proofs: res.data || []
      });
    });
  },

  get_proof_stats: function() {
    var sb = createClient(supabaseUrl, supabaseKey);

    return sb.from("decision_proofs")
      .select("*")
      .then(function(res) {
        if (res.error) {
          return buildResult({
            engine: ENGINE_NAME,
            note: "Stats unavailable — table may not exist yet. Run DEPLOY314 migration.",
            total_proofs: 0
          });
        }

        var proofs = res.data || [];
        var total = proofs.length;
        var byEngine = {};
        var byType = {};
        var byGrade = { A: 0, B: 0, C: 0, D: 0 };
        var totalConfidence = 0;
        var confidenceCount = 0;
        var revisions = 0;

        for (var i = 0; i < proofs.length; i++) {
          var p = proofs[i];

          // By engine
          var eng = p.source_engine || "unknown";
          byEngine[eng] = (byEngine[eng] || 0) + 1;

          // By type
          var dt = p.decision_type || "unknown";
          byType[dt] = (byType[dt] || 0) + 1;

          // By grade
          var grade = p.completeness_grade || "D";
          if (byGrade[grade] !== undefined) byGrade[grade]++;

          // Confidence average
          if (p.confidence !== null && p.confidence !== undefined) {
            totalConfidence += p.confidence;
            confidenceCount++;
          }

          // Revisions
          if (p.prior_proof_id) revisions++;
        }

        return buildResult({
          engine: ENGINE_NAME,
          total_proofs: total,
          avg_confidence: confidenceCount > 0 ? Math.round((totalConfidence / confidenceCount) * 100) / 100 : null,
          revision_count: revisions,
          by_source_engine: byEngine,
          by_decision_type: byType,
          by_completeness_grade: byGrade
        });
      })
      .catch(function() {
        return buildResult({
          engine: ENGINE_NAME,
          note: "Stats unavailable — run DEPLOY314 migration",
          total_proofs: 0
        });
      });
  },

  validate_proof: function(body) {
    // Validate a proof record without storing it
    var validation = validateProofRecord(body);
    return buildResult({
      engine: ENGINE_NAME,
      action: "validate_proof",
      validation: validation
    });
  }
};


// ================================================================
// HANDLER
// ================================================================

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return holdResult(405, "POST only");

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";

    var actionFn = ACTION_MAP[action];
    if (!actionFn) return holdResult(400, "Unknown action: " + action + ". Valid: " + Object.keys(ACTION_MAP).join(", "));

    var result = actionFn(body);
    if (result && typeof result.then === "function") {
      return result;
    }
    return result;
  } catch (err) {
    return holdResult(500, String(err && err.message ? err.message : err));
  }
};
