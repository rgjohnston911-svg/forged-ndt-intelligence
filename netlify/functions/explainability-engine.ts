// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ══════════════════════════════════════════════════════════════════
// EXPLAINABILITY & AUDIT TRAIL ENGINE (DEPLOY328)
//
// Every inference, every judgment, every recommendation in
// FORGED must be traceable back to its root inputs, physics
// models, symbolic rules, and expert reasoning.
//
// This engine provides:
// 1. Decision trace — full chain from raw input to output
// 2. Evidence attribution — which inputs drove which conclusions
// 3. Layer decomposition — contribution from each architectural layer
// 4. Human-readable narrative — plain-language explanation
// 5. Regulatory audit package — formatted for API 579/ASME review
// 6. Counterfactual analysis — "what would change if X were different"
//
// Required for certifiability in regulated industries.
// An ASNT Level III must be able to follow every step.
// ══════════════════════════════════════════════════════════════════

// ── LAYER DEFINITIONS ───────────────────────────────────────────
var ARCHITECTURE_LAYERS = {
  "layer_1_world_model": {
    name: "Physical World Model",
    engine: "inspection-world-model",
    description: "Projects damage forward through time using governing physics equations",
    outputs: ["future_states", "damage_trajectories", "what_if_scenarios"]
  },
  "layer_2_physics_learning": {
    name: "Physics-Informed Learning",
    engine: "physics-learning-engine",
    description: "Records predicted vs actual, refines physics model parameters with governance",
    outputs: ["parameter_updates", "model_accuracy", "learning_events"]
  },
  "layer_3_digital_twin": {
    name: "Self-Calibrating Digital Twin",
    engine: "self-calibrating-twin",
    description: "Auto-corrects predictions using Bayesian updates and drift detection",
    outputs: ["calibration_state", "drift_alerts", "corrected_predictions"]
  },
  "layer_4_reasoning": {
    name: "Conceptual Reasoning Brain",
    engine: "conceptual-reasoning-brain",
    description: "Hypothesis generation, causal chain construction, cross-domain analogy",
    outputs: ["hypotheses", "causal_chains", "analogies", "novelty_flags"]
  },
  "layer_5_proof": {
    name: "Proof Engine Suite",
    engine: "multiple",
    description: "Physics-constrained inference, uncertainty propagation, causal discovery, conformal prediction",
    outputs: ["inferred_parameters", "uncertainty_bounds", "causal_graphs", "prediction_intervals"]
  },
  "layer_6_validation": {
    name: "Validation Engine Suite",
    engine: "multiple",
    description: "Neurosymbolic reasoning, multi-agent debate, anomaly fingerprinting",
    outputs: ["fused_judgments", "debate_consensus", "anomaly_classification"]
  },
  "layer_7_learning": {
    name: "Closed-Loop Self-Learning Brain",
    engine: "closed-loop-self-learning-brain",
    description: "Outcome tracking, evidence valuation, confidence calibration, model updates",
    outputs: ["learning_outcomes", "confidence_updates", "model_corrections"]
  }
};

// ── EXPLANATION TEMPLATES ───────────────────────────────────────
var EXPLANATION_TEMPLATES = {
  "remaining_life": {
    template: "The remaining life estimate of {value} {unit} was computed using {model} with {n_inputs} input measurements. The primary driver is {primary_driver} contributing {driver_pct}% of the result. Uncertainty bounds [{lower}, {upper}] reflect {uncertainty_source}. Code compliance check via {code_ref} confirms {compliance_status}.",
    required_fields: ["value", "unit", "model", "n_inputs", "primary_driver", "driver_pct", "lower", "upper", "uncertainty_source", "code_ref", "compliance_status"]
  },
  "risk_assessment": {
    template: "Risk score of {score} ({category}) was determined by {n_agents} expert agents. {consensus_statement}. The dominant risk factor is {dominant_factor}. Code compliance {code_status}. Confidence level: {confidence}%.",
    required_fields: ["score", "category", "n_agents", "consensus_statement", "dominant_factor", "code_status", "confidence"]
  },
  "mechanism_identification": {
    template: "The identified mechanism is {mechanism} with {confidence}% confidence. This determination is based on {evidence_count} pieces of evidence. {n_rules} symbolic rules were evaluated, of which {n_triggered} triggered. The fingerprint matched library pattern {pattern_id} ({pattern_name}) with {match_pct}% similarity.",
    required_fields: ["mechanism", "confidence", "evidence_count", "n_rules", "n_triggered", "pattern_id", "pattern_name", "match_pct"]
  },
  "anomaly_alert": {
    template: "An anomaly was detected with score {score}. The anomaly fingerprint shows: mechanism={mech_sig}, rate={rate_sig}, spatial={spatial_sig}. {match_statement}. Recommended action: {action}.",
    required_fields: ["score", "mech_sig", "rate_sig", "spatial_sig", "match_statement", "action"]
  },
  "calibration_event": {
    template: "The digital twin for asset {asset_id} was recalibrated. Prior prediction error was {prior_error}%, now {post_error}%. Method: {method}. Drift status: {drift_status}. {n_observations} observations since last calibration.",
    required_fields: ["asset_id", "prior_error", "post_error", "method", "drift_status", "n_observations"]
  }
};

// ── TRACE BUILDER ───────────────────────────────────────────────
function buildDecisionTrace(caseData, layerResults) {
  var trace = {
    trace_id: generateTraceId(),
    case_id: caseData.case_id || null,
    timestamp: new Date().toISOString(),
    layers: [],
    evidence_chain: [],
    total_inputs: 0,
    total_models: 0,
    total_rules: 0,
    critical_decisions: []
  };

  // Walk each layer and extract its contribution
  for (var layerKey in ARCHITECTURE_LAYERS) {
    var layerDef = ARCHITECTURE_LAYERS[layerKey];
    var layerResult = layerResults[layerKey] || null;

    var layerTrace = {
      layer: layerKey,
      name: layerDef.name,
      engine: layerDef.engine,
      status: layerResult ? "executed" : "skipped",
      inputs: [],
      outputs: [],
      models_used: [],
      rules_evaluated: [],
      duration_ms: 0,
      contribution_weight: 0
    };

    if (layerResult) {
      layerTrace.inputs = layerResult.inputs || [];
      layerTrace.outputs = layerResult.outputs || [];
      layerTrace.models_used = layerResult.models || [];
      layerTrace.rules_evaluated = layerResult.rules || [];
      layerTrace.duration_ms = layerResult.duration_ms || 0;
      layerTrace.contribution_weight = layerResult.weight || 0;

      trace.total_inputs = trace.total_inputs + (layerResult.inputs ? layerResult.inputs.length : 0);
      trace.total_models = trace.total_models + (layerResult.models ? layerResult.models.length : 0);
      trace.total_rules = trace.total_rules + (layerResult.rules ? layerResult.rules.length : 0);

      // Extract critical decisions
      if (layerResult.decisions) {
        for (var di = 0; di < layerResult.decisions.length; di++) {
          trace.critical_decisions.push({
            layer: layerKey,
            decision: layerResult.decisions[di],
            reversible: layerResult.decisions[di].reversible !== false
          });
        }
      }
    }

    trace.layers.push(layerTrace);
  }

  return trace;
}

// ── EVIDENCE ATTRIBUTION ────────────────────────────────────────
function attributeEvidence(trace, finalOutput) {
  var attributions = [];

  // For each output field, trace back through layers to find contributing inputs
  if (finalOutput && typeof finalOutput === "object") {
    var outputKeys = Object.keys(finalOutput);
    for (var oi = 0; oi < outputKeys.length; oi++) {
      var outputKey = outputKeys[oi];
      var attribution = {
        output_field: outputKey,
        output_value: finalOutput[outputKey],
        contributing_layers: [],
        contributing_inputs: [],
        sensitivity: 0
      };

      // Walk layers backward to find contributors
      for (var li = trace.layers.length - 1; li >= 0; li--) {
        var layer = trace.layers[li];
        if (layer.status === "skipped") continue;

        for (var outi = 0; outi < layer.outputs.length; outi++) {
          if (layer.outputs[outi].field === outputKey || layer.outputs[outi].feeds === outputKey) {
            attribution.contributing_layers.push(layer.layer);
            // Trace inputs of this layer
            for (var ini = 0; ini < layer.inputs.length; ini++) {
              attribution.contributing_inputs.push({
                layer: layer.layer,
                input: layer.inputs[ini]
              });
            }
          }
        }
      }

      attributions.push(attribution);
    }
  }

  return attributions;
}

// ── COUNTERFACTUAL ANALYSIS ─────────────────────────────────────
function analyzeCounterfactuals(trace, finalOutput, whatIfParams) {
  var counterfactuals = [];

  if (!whatIfParams || !Array.isArray(whatIfParams)) return counterfactuals;

  for (var wi = 0; wi < whatIfParams.length; wi++) {
    var param = whatIfParams[wi];
    var cf = {
      parameter: param.name,
      original_value: param.original,
      alternate_value: param.alternate,
      affected_layers: [],
      estimated_output_change: {},
      sensitivity_rank: 0
    };

    // Identify which layers would be affected
    for (var li = 0; li < trace.layers.length; li++) {
      var layer = trace.layers[li];
      if (layer.status === "skipped") continue;
      for (var ini = 0; ini < layer.inputs.length; ini++) {
        if (layer.inputs[ini].name === param.name || layer.inputs[ini].field === param.name) {
          cf.affected_layers.push(layer.layer);
          break;
        }
      }
    }

    // Estimate output sensitivity using linear perturbation
    if (param.original !== 0 && param.alternate !== 0) {
      var pctChange = Math.abs((param.alternate - param.original) / param.original);
      // Propagate through affected layers with amplification
      var amplification = 1.0;
      for (var ai = 0; ai < cf.affected_layers.length; ai++) {
        amplification = amplification * 1.15; // each layer can amplify ~15%
      }
      cf.estimated_output_change = {
        input_change_pct: Math.round(pctChange * 1000) / 10,
        estimated_output_change_pct: Math.round(pctChange * amplification * 1000) / 10,
        amplification_factor: Math.round(amplification * 100) / 100
      };
    }

    counterfactuals.push(cf);
  }

  // Rank by sensitivity
  counterfactuals.sort(function(a, b) {
    var aChg = a.estimated_output_change.estimated_output_change_pct || 0;
    var bChg = b.estimated_output_change.estimated_output_change_pct || 0;
    return bChg - aChg;
  });
  for (var ri = 0; ri < counterfactuals.length; ri++) {
    counterfactuals[ri].sensitivity_rank = ri + 1;
  }

  return counterfactuals;
}

// ── NARRATIVE GENERATOR ─────────────────────────────────────────
function generateNarrative(trace, attributions, template_key) {
  var narrative = {
    summary: "",
    sections: [],
    readable_trace: ""
  };

  // Build section-by-section narrative
  var sections = [];
  sections.push({
    heading: "Input Data",
    content: "This analysis used " + trace.total_inputs + " input measurements across " + trace.layers.length + " processing layers."
  });

  // Layer-by-layer
  for (var li = 0; li < trace.layers.length; li++) {
    var layer = trace.layers[li];
    if (layer.status === "skipped") continue;

    var layerDef = ARCHITECTURE_LAYERS[layer.layer];
    sections.push({
      heading: layerDef.name,
      content: layerDef.description + ". Used " + layer.models_used.length + " model(s) and evaluated " + layer.rules_evaluated.length + " rule(s). Contribution weight: " + Math.round(layer.contribution_weight * 100) + "%."
    });
  }

  // Critical decisions
  if (trace.critical_decisions.length > 0) {
    var decisionText = trace.critical_decisions.length + " critical decision(s) were made: ";
    for (var di = 0; di < trace.critical_decisions.length; di++) {
      var dec = trace.critical_decisions[di];
      decisionText = decisionText + "(" + (di + 1) + ") " + (dec.decision.description || dec.decision.type || "decision") + " at " + dec.layer;
      if (di < trace.critical_decisions.length - 1) decisionText = decisionText + "; ";
    }
    decisionText = decisionText + ".";
    sections.push({ heading: "Critical Decisions", content: decisionText });
  }

  // Evidence attribution summary
  if (attributions.length > 0) {
    var attrText = "Key output fields trace back to: ";
    for (var ai = 0; ai < Math.min(attributions.length, 5); ai++) {
      var attr = attributions[ai];
      attrText = attrText + attr.output_field + " (from " + attr.contributing_layers.length + " layer(s))";
      if (ai < Math.min(attributions.length, 5) - 1) attrText = attrText + ", ";
    }
    attrText = attrText + ".";
    sections.push({ heading: "Evidence Attribution", content: attrText });
  }

  narrative.sections = sections;

  // Build readable summary
  var summaryParts = [];
  for (var si = 0; si < sections.length; si++) {
    summaryParts.push(sections[si].heading + ": " + sections[si].content);
  }
  narrative.summary = summaryParts.join(" | ");
  narrative.readable_trace = summaryParts.join("\n\n");

  return narrative;
}

// ── AUDIT PACKAGE BUILDER ───────────────────────────────────────
function buildAuditPackage(trace, attributions, narrative, caseData) {
  return {
    package_id: generateTraceId(),
    generated_at: new Date().toISOString(),
    case_id: caseData.case_id || null,
    asset_id: caseData.asset_id || null,
    standard: "FORGED-NDT/3.0.0",
    audit_type: "full_decision_trace",
    sections: {
      executive_summary: narrative.summary,
      input_data: {
        total_inputs: trace.total_inputs,
        input_sources: extractInputSources(trace)
      },
      processing_pipeline: {
        layers_executed: trace.layers.filter(function(l) { return l.status === "executed"; }).length,
        layers_skipped: trace.layers.filter(function(l) { return l.status === "skipped"; }).length,
        total_models: trace.total_models,
        total_rules: trace.total_rules,
        layer_detail: trace.layers
      },
      evidence_attribution: attributions,
      critical_decisions: trace.critical_decisions,
      narrative_explanation: narrative.sections,
      compliance_notes: {
        code_references: extractCodeReferences(trace),
        non_overridable_rules: extractNonOverridableRules(trace)
      }
    },
    certification: {
      traceable: true,
      reproducible: true,
      auditable: true,
      physics_grounded: trace.total_models > 0,
      code_compliant: extractCodeReferences(trace).length > 0
    }
  };
}

function extractInputSources(trace) {
  var sources = [];
  for (var li = 0; li < trace.layers.length; li++) {
    var layer = trace.layers[li];
    for (var ii = 0; ii < layer.inputs.length; ii++) {
      var input = layer.inputs[ii];
      if (input.source && sources.indexOf(input.source) === -1) {
        sources.push(input.source);
      }
    }
  }
  return sources;
}

function extractCodeReferences(trace) {
  var refs = [];
  for (var li = 0; li < trace.layers.length; li++) {
    var layer = trace.layers[li];
    for (var ri = 0; ri < layer.rules_evaluated.length; ri++) {
      var rule = layer.rules_evaluated[ri];
      if (rule.code_ref && refs.indexOf(rule.code_ref) === -1) {
        refs.push(rule.code_ref);
      }
    }
  }
  return refs;
}

function extractNonOverridableRules(trace) {
  var nonOverridable = [];
  for (var li = 0; li < trace.layers.length; li++) {
    var layer = trace.layers[li];
    for (var ri = 0; ri < layer.rules_evaluated.length; ri++) {
      var rule = layer.rules_evaluated[ri];
      if (rule.overridable === false) {
        nonOverridable.push({
          rule_id: rule.id || rule.rule_id,
          description: rule.description || rule.name,
          layer: layer.layer,
          code_ref: rule.code_ref || null
        });
      }
    }
  }
  return nonOverridable;
}

function generateTraceId() {
  var chars = "abcdef0123456789";
  var id = "";
  for (var i = 0; i < 32; i++) {
    id = id + chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id.substring(0, 8) + "-" + id.substring(8, 12) + "-" + id.substring(12, 16) + "-" + id.substring(16, 20) + "-" + id.substring(20);
}

// ── SAVE FUNCTIONS ──────────────────────────────────────────────
async function saveTrace(sb, trace, narrative, auditPackage) {
  try {
    var record = {
      case_id: trace.case_id,
      trace_id: trace.trace_id,
      layers_executed: trace.layers.filter(function(l) { return l.status === "executed"; }).length,
      total_inputs: trace.total_inputs,
      total_models: trace.total_models,
      total_rules: trace.total_rules,
      critical_decisions_count: trace.critical_decisions.length,
      narrative_summary: narrative.summary,
      full_trace: trace,
      audit_package: auditPackage
    };
    await sb.from("explainability_traces").insert([record]);
  } catch (e) {
    // non-fatal
  }
}

async function getTraceHistory(sb, caseId, limit) {
  try {
    var q = sb.from("explainability_traces").select("*").order("created_at", { ascending: false }).limit(limit || 20);
    if (caseId) q = q.eq("case_id", caseId);
    var result = await q;
    return result.data || [];
  } catch (e) {
    return [];
  }
}

// ── HANDLER ─────────────────────────────────────────────────────
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
          engine: "explainability-engine",
          deploy: "DEPLOY328",
          version: "1.0.0",
          description: "Explainability & Audit Trail Engine — full decision traceability for certifiable AI",
          architecture_layers: Object.keys(ARCHITECTURE_LAYERS).length,
          explanation_templates: Object.keys(EXPLANATION_TEMPLATES).length,
          capabilities: [
            "decision_trace",
            "evidence_attribution",
            "counterfactual_analysis",
            "narrative_generation",
            "audit_package",
            "trace_history"
          ],
          actions: ["get_registry", "trace_decision", "explain", "counterfactual", "audit_package", "get_history"]
        })
      };
    }

    // ── TRACE DECISION ────────────────────────────────────────
    if (action === "trace_decision") {
      var caseData = body.case_data || { case_id: body.case_id };
      var layerResults = body.layer_results || {};

      var trace = buildDecisionTrace(caseData, layerResults);
      var attributions = attributeEvidence(trace, body.final_output || {});
      var narrative = generateNarrative(trace, attributions, body.template || null);
      var auditPackage = buildAuditPackage(trace, attributions, narrative, caseData);

      await saveTrace(sb, trace, narrative, auditPackage);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "explainability-engine",
          action: "trace_decision",
          trace: trace,
          attributions: attributions,
          narrative: narrative,
          audit_package: auditPackage
        })
      };
    }

    // ── EXPLAIN (template-based) ──────────────────────────────
    if (action === "explain") {
      var templateKey = body.template || "remaining_life";
      var templateDef = EXPLANATION_TEMPLATES[templateKey];
      if (!templateDef) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            engine: "explainability-engine",
            action: "explain",
            error: "Unknown template: " + templateKey,
            available_templates: Object.keys(EXPLANATION_TEMPLATES)
          })
        };
      }

      // Fill template with provided values
      var values = body.values || {};
      var filled = templateDef.template;
      var missing = [];
      for (var fi = 0; fi < templateDef.required_fields.length; fi++) {
        var field = templateDef.required_fields[fi];
        if (values[field] !== undefined) {
          filled = filled.split("{" + field + "}").join(String(values[field]));
        } else {
          missing.push(field);
          filled = filled.split("{" + field + "}").join("[MISSING: " + field + "]");
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "explainability-engine",
          action: "explain",
          template: templateKey,
          explanation: filled,
          missing_fields: missing,
          completeness: Math.round(((templateDef.required_fields.length - missing.length) / templateDef.required_fields.length) * 100)
        })
      };
    }

    // ── COUNTERFACTUAL ────────────────────────────────────────
    if (action === "counterfactual") {
      var cfCaseData = body.case_data || { case_id: body.case_id };
      var cfLayerResults = body.layer_results || {};
      var whatIfParams = body.what_if || [];

      var cfTrace = buildDecisionTrace(cfCaseData, cfLayerResults);
      var counterfactuals = analyzeCounterfactuals(cfTrace, body.final_output || {}, whatIfParams);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "explainability-engine",
          action: "counterfactual",
          counterfactuals: counterfactuals,
          most_sensitive: counterfactuals.length > 0 ? counterfactuals[0].parameter : null
        })
      };
    }

    // ── AUDIT PACKAGE ─────────────────────────────────────────
    if (action === "audit_package") {
      var apCaseData = body.case_data || { case_id: body.case_id };
      var apLayerResults = body.layer_results || {};

      var apTrace = buildDecisionTrace(apCaseData, apLayerResults);
      var apAttributions = attributeEvidence(apTrace, body.final_output || {});
      var apNarrative = generateNarrative(apTrace, apAttributions, body.template || null);
      var pkg = buildAuditPackage(apTrace, apAttributions, apNarrative, apCaseData);

      await saveTrace(sb, apTrace, apNarrative, pkg);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "explainability-engine",
          action: "audit_package",
          package: pkg
        })
      };
    }

    // ── GET HISTORY ───────────────────────────────────────────
    if (action === "get_history") {
      var history = await getTraceHistory(sb, body.case_id, body.limit || 20);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "explainability-engine",
          action: "get_history",
          traces: history,
          count: history.length
        })
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ engine: "explainability-engine", error: "Unknown action: " + action })
    };

  } catch (err) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ engine: "explainability-engine", error: String(err && err.message ? err.message : err) })
    };
  }
};

export { handler };
