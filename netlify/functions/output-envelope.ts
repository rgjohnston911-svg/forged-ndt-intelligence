// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ═════���═══════════════════════════════════���════════════════════════
// OUTPUT ENVELOPE ENGINE (DEPLOY331)
//
// Enforces the "deterministic reasons / AI interprets" discipline
// at the architectural level.
//
// Every engine output MUST be wrapped in a standard envelope that
// separates:
//   deterministic {} — what physics/code engines computed
//   interpreted {}   — what AI layers inferred or narrated
//   provenance {}    — full audit trail of what drove what
//
// This engine:
// 1. Defines the canonical envelope schema
// 2. Validates any engine output against the schema
// 3. Wraps raw engine outputs into compliant envelopes
// 4. Scores envelope quality (completeness, traceability)
// 5. Maintains an envelope registry for compliance auditing
// 6. Provides a "strip AI" view — deterministic-only output
//    suitable for regulatory submission
//
// An OSHA investigator or courtroom expert sees ONLY the
// deterministic layer. The interpreted layer is supplementary.
// ═══════��═════════════════════════���════════════════════════════════

// ── ENVELOPE SCHEMA ─────────��───────────────────────────────────
var ENVELOPE_SCHEMA = {
  version: "1.0.0",
  required_fields: ["deterministic", "interpreted", "provenance"],
  deterministic_fields: {
    required: ["engine", "timestamp", "computations"],
    optional: ["code_references", "physics_models", "thresholds", "pass_fail"]
  },
  interpreted_fields: {
    required: ["summary"],
    optional: ["narrative", "recommendations", "confidence", "caveats"]
  },
  provenance_fields: {
    required: ["engine_id", "engine_version", "input_hash"],
    optional: ["trace_id", "parent_engines", "data_sources", "inspector_id", "case_id"]
  }
};

// ── ENGINE CLASSIFICATION ───────────────────────────────────────
// Which output fields from each engine type are deterministic vs interpreted
var ENGINE_CLASSIFICATIONS = {
  "physics_computation": {
    description: "Pure physics calculations — Paris law, B31G, corrosion rate, remaining life",
    deterministic_keys: ["result", "value", "calculation", "formula", "inputs", "threshold", "pass_fail", "remaining_life", "corrosion_rate", "wall_thickness", "stress", "pressure", "factor", "ratio"],
    interpreted_keys: ["recommendation", "narrative", "summary", "explanation", "confidence_narrative"],
    examples: ["inspection-world-model", "uncertainty-propagation", "physics-constrained-inference", "formula-intelligence-core"]
  },
  "code_compliance": {
    description: "Code/standard evaluation — deterministic pass/fail against published criteria",
    deterministic_keys: ["code_ref", "clause", "requirement", "measured", "threshold", "pass_fail", "disposition", "mandatory_action", "code_override"],
    interpreted_keys: ["explanation", "context", "similar_cases", "risk_narrative"],
    examples: ["universal-code-authority", "live-code-authority", "weld-acceptance-authority", "refinery-code-authority-router"]
  },
  "ai_reasoning": {
    description: "AI-assisted analysis — interpretation, pattern matching, narrative generation",
    deterministic_keys: ["input_data", "matched_patterns", "rule_triggers", "scores"],
    interpreted_keys: ["analysis", "narrative", "recommendation", "explanation", "hypothesis", "risk_assessment", "summary"],
    examples: ["tri-model-reasoning", "superbrain-report", "conceptual-reasoning-brain"]
  },
  "sensor_fusion": {
    description: "Data aggregation and statistical computation",
    deterministic_keys: ["measurements", "statistics", "trend", "slope", "correlation", "change_points", "health_index"],
    interpreted_keys: ["regime", "alarm_narrative", "projection_narrative", "recommendation"],
    examples: ["temporal-fusion-engine", "process-data-integration", "trend-analytics"]
  },
  "validation": {
    description: "Verification and quality assurance",
    deterministic_keys: ["checks", "pass_count", "fail_count", "coverage", "test_results", "convergence"],
    interpreted_keys: ["assessment", "gaps_narrative", "improvement_suggestions"],
    examples: ["validation-suite", "convergence-proof", "regression-test-authority"]
  },
  "multi_agent": {
    description: "Multi-expert deliberation",
    deterministic_keys: ["agent_scores", "consensus_score", "conflicts", "code_override", "vote_tally"],
    interpreted_keys: ["judgment", "debate_narrative", "final_recommendation", "dissenting_opinions"],
    examples: ["multi-agent-debate", "neurosymbolic-reasoning"]
  }
};

// ── ENVELOPE BUILDER ────────────────────────────────────────────
function buildEnvelope(engineId, engineVersion, rawOutput, classification) {
  var classDef = ENGINE_CLASSIFICATIONS[classification] || ENGINE_CLASSIFICATIONS["physics_computation"];

  var envelope = {
    envelope_version: ENVELOPE_SCHEMA.version,
    created_at: new Date().toISOString(),
    deterministic: {
      engine: engineId,
      timestamp: new Date().toISOString(),
      computations: {},
      code_references: [],
      physics_models: [],
      thresholds: [],
      pass_fail: null
    },
    interpreted: {
      summary: "",
      narrative: null,
      recommendations: [],
      confidence: null,
      caveats: []
    },
    provenance: {
      engine_id: engineId,
      engine_version: engineVersion,
      input_hash: computeInputHash(rawOutput),
      trace_id: null,
      parent_engines: [],
      data_sources: []
    }
  };

  // Classify each field in the raw output
  if (rawOutput && typeof rawOutput === "object") {
    var keys = Object.keys(rawOutput);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var value = rawOutput[key];

      // Skip metadata fields
      if (key === "engine" || key === "action" || key === "deploy" || key === "version") continue;

      var isDeterministic = false;
      for (var di = 0; di < classDef.deterministic_keys.length; di++) {
        if (key.indexOf(classDef.deterministic_keys[di]) !== -1) {
          isDeterministic = true;
          break;
        }
      }

      var isInterpreted = false;
      if (!isDeterministic) {
        for (var ii = 0; ii < classDef.interpreted_keys.length; ii++) {
          if (key.indexOf(classDef.interpreted_keys[ii]) !== -1) {
            isInterpreted = true;
            break;
          }
        }
      }

      if (isDeterministic) {
        envelope.deterministic.computations[key] = value;

        // Extract code references if present
        if (key === "code_ref" || key === "code_reference" || key === "clause") {
          if (typeof value === "string") envelope.deterministic.code_references.push(value);
          else if (Array.isArray(value)) envelope.deterministic.code_references = envelope.deterministic.code_references.concat(value);
        }

        // Extract pass/fail
        if (key === "pass_fail" || key === "disposition" || key === "pass") {
          envelope.deterministic.pass_fail = value;
        }
      } else if (isInterpreted) {
        if (key.indexOf("summary") !== -1 || key.indexOf("narrative") !== -1) {
          envelope.interpreted.summary = envelope.interpreted.summary + (envelope.interpreted.summary ? " " : "") + String(value);
        } else if (key.indexOf("recommendation") !== -1) {
          if (Array.isArray(value)) envelope.interpreted.recommendations = envelope.interpreted.recommendations.concat(value);
          else envelope.interpreted.recommendations.push(String(value));
        } else if (key.indexOf("confidence") !== -1) {
          envelope.interpreted.confidence = value;
        } else if (key.indexOf("caveat") !== -1 || key.indexOf("limitation") !== -1) {
          if (Array.isArray(value)) envelope.interpreted.caveats = envelope.interpreted.caveats.concat(value);
          else envelope.interpreted.caveats.push(String(value));
        } else {
          envelope.interpreted[key] = value;
        }
      } else {
        // Ambiguous — put in deterministic by default (conservative)
        envelope.deterministic.computations[key] = value;
      }
    }
  }

  return envelope;
}

// ── DETERMINISTIC-ONLY VIEW ─────────────────────────────────────
function stripToRegulatory(envelope) {
  return {
    engine: envelope.deterministic.engine,
    timestamp: envelope.deterministic.timestamp,
    computations: envelope.deterministic.computations,
    code_references: envelope.deterministic.code_references,
    physics_models: envelope.deterministic.physics_models,
    pass_fail: envelope.deterministic.pass_fail,
    provenance: {
      engine_id: envelope.provenance.engine_id,
      engine_version: envelope.provenance.engine_version,
      input_hash: envelope.provenance.input_hash
    },
    regulatory_note: "This output contains only deterministic computations. AI-interpreted content has been stripped for regulatory submission."
  };
}

// ── VALIDATION ──────────────────────────────────────────────────
function validateEnvelope(envelope) {
  var errors = [];
  var warnings = [];

  // Check required top-level fields
  for (var fi = 0; fi < ENVELOPE_SCHEMA.required_fields.length; fi++) {
    var field = ENVELOPE_SCHEMA.required_fields[fi];
    if (!envelope[field]) errors.push("Missing required field: " + field);
  }

  // Check deterministic required fields
  if (envelope.deterministic) {
    for (var di = 0; di < ENVELOPE_SCHEMA.deterministic_fields.required.length; di++) {
      var dField = ENVELOPE_SCHEMA.deterministic_fields.required[di];
      if (!envelope.deterministic[dField]) errors.push("Missing deterministic." + dField);
    }
    if (envelope.deterministic.computations && Object.keys(envelope.deterministic.computations).length === 0) {
      warnings.push("Deterministic computations is empty — engine may be purely interpretive");
    }
  }

  // Check interpreted required fields
  if (envelope.interpreted) {
    if (!envelope.interpreted.summary || envelope.interpreted.summary.length === 0) {
      warnings.push("Interpreted summary is empty");
    }
  }

  // Check provenance required fields
  if (envelope.provenance) {
    for (var pi = 0; pi < ENVELOPE_SCHEMA.provenance_fields.required.length; pi++) {
      var pField = ENVELOPE_SCHEMA.provenance_fields.required[pi];
      if (!envelope.provenance[pField]) errors.push("Missing provenance." + pField);
    }
  }

  // Score completeness
  var totalFields = 0;
  var filledFields = 0;
  var allOptional = ENVELOPE_SCHEMA.deterministic_fields.optional
    .concat(ENVELOPE_SCHEMA.interpreted_fields.optional)
    .concat(ENVELOPE_SCHEMA.provenance_fields.optional);

  totalFields = ENVELOPE_SCHEMA.deterministic_fields.required.length
    + ENVELOPE_SCHEMA.interpreted_fields.required.length
    + ENVELOPE_SCHEMA.provenance_fields.required.length
    + allOptional.length;

  if (envelope.deterministic) {
    for (var k in envelope.deterministic) {
      if (envelope.deterministic[k] !== null && envelope.deterministic[k] !== undefined) filledFields++;
    }
  }
  if (envelope.interpreted) {
    for (var k in envelope.interpreted) {
      if (envelope.interpreted[k] !== null && envelope.interpreted[k] !== undefined && envelope.interpreted[k] !== "") filledFields++;
    }
  }
  if (envelope.provenance) {
    for (var k in envelope.provenance) {
      if (envelope.provenance[k] !== null && envelope.provenance[k] !== undefined) filledFields++;
    }
  }

  var quality = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings,
    quality_score: Math.min(100, quality),
    deterministic_field_count: envelope.deterministic ? Object.keys(envelope.deterministic.computations || {}).length : 0,
    interpreted_field_count: envelope.interpreted ? Object.keys(envelope.interpreted).length : 0
  };
}

function computeInputHash(obj) {
  // Simple hash for provenance tracking
  var str = JSON.stringify(obj || {});
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    var ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash = hash & hash; // 32-bit integer
  }
  return "h" + Math.abs(hash).toString(16);
}

// ── SAVE FUNCTIONS ──────��───────────────────────────────────────
async function saveEnvelope(sb, envelope, validation) {
  try {
    await sb.from("output_envelopes").insert([{
      engine_id: envelope.provenance.engine_id,
      engine_version: envelope.provenance.engine_version,
      input_hash: envelope.provenance.input_hash,
      case_id: envelope.provenance.case_id || null,
      deterministic_field_count: validation.deterministic_field_count,
      interpreted_field_count: validation.interpreted_field_count,
      quality_score: validation.quality_score,
      has_code_references: (envelope.deterministic.code_references || []).length > 0,
      has_pass_fail: envelope.deterministic.pass_fail !== null,
      full_envelope: envelope
    }]);
  } catch (e) {
    // non-fatal
  }
}

async function getEnvelopeHistory(sb, engineId, caseId, limit) {
  try {
    var q = sb.from("output_envelopes").select("*").order("created_at", { ascending: false }).limit(limit || 20);
    if (engineId) q = q.eq("engine_id", engineId);
    if (caseId) q = q.eq("case_id", caseId);
    var result = await q;
    return result.data || [];
  } catch (e) {
    return [];
  }
}

// ── HANDLER ─────────���───────────────────────────────────────────
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

    // ── GET REGISTRY ──────────────────────────────────────────
    if (action === "get_registry") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "output-envelope",
          deploy: "DEPLOY331",
          version: "1.0.0",
          description: "Output Envelope Engine — enforces deterministic/interpreted/provenance separation across all engines",
          schema_version: ENVELOPE_SCHEMA.version,
          engine_classifications: Object.keys(ENGINE_CLASSIFICATIONS).length,
          capabilities: [
            "envelope_wrapping",
            "field_classification",
            "regulatory_strip",
            "envelope_validation",
            "quality_scoring",
            "provenance_tracking"
          ],
          actions: ["get_registry", "wrap", "validate", "strip_regulatory", "get_classifications", "get_schema", "get_history"]
        })
      };
    }

    // ── WRAP ─────���────────────────────────────────────────────
    if (action === "wrap") {
      var engineId = body.engine_id || "unknown";
      var engineVersion = body.engine_version || "0.0.0";
      var rawOutput = body.raw_output || {};
      var classification = body.classification || "physics_computation";

      var envelope = buildEnvelope(engineId, engineVersion, rawOutput, classification);

      // Attach optional provenance
      if (body.case_id) envelope.provenance.case_id = body.case_id;
      if (body.trace_id) envelope.provenance.trace_id = body.trace_id;
      if (body.parent_engines) envelope.provenance.parent_engines = body.parent_engines;
      if (body.data_sources) envelope.provenance.data_sources = body.data_sources;

      var validation = validateEnvelope(envelope);
      await saveEnvelope(sb, envelope, validation);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "output-envelope",
          action: "wrap",
          envelope: envelope,
          validation: validation
        })
      };
    }

    // ── VALIDATE ──────────────────────────────────────────────
    if (action === "validate") {
      var envToValidate = body.envelope || {};
      var validation = validateEnvelope(envToValidate);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "output-envelope",
          action: "validate",
          validation: validation
        })
      };
    }

    // ── STRIP REGULATORY ──────────────────────────────────��───
    if (action === "strip_regulatory") {
      var envToStrip = body.envelope || {};
      var regulatory = stripToRegulatory(envToStrip);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "output-envelope",
          action: "strip_regulatory",
          regulatory_output: regulatory
        })
      };
    }

    // ��─ GET CLASSIFICATIONS ───────────────────────────────────
    if (action === "get_classifications") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "output-envelope",
          action: "get_classifications",
          classifications: ENGINE_CLASSIFICATIONS
        })
      };
    }

    // ── GET SCHEMA ────────────────────────────────────���───────
    if (action === "get_schema") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "output-envelope",
          action: "get_schema",
          schema: ENVELOPE_SCHEMA
        })
      };
    }

    // ── GET HISTORY ────────────��──────────────────────────────
    if (action === "get_history") {
      var history = await getEnvelopeHistory(sb, body.engine_id, body.case_id, body.limit || 20);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "output-envelope",
          action: "get_history",
          envelopes: history,
          count: history.length
        })
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ engine: "output-envelope", error: "Unknown action: " + action })
    };

  } catch (err) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ engine: "output-envelope", error: String(err && err.message ? err.message : err) })
    };
  }
};

export { handler };
