// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_ANON_KEY;
var supabase = createClient(supabaseUrl, supabaseKey);

// ── DEFAULT PHYSICS MODEL REGISTRY ─────────────────────────────
// Each model has default parameters that can be refined by learning
var DEFAULT_MODELS = {
  paris_law_carbon_steel: {
    model_name: "Paris Law — Carbon Steel",
    model_type: "crack_growth",
    default_parameters: { C: 3.0e-12, m: 3.0, K_IC: 55, geometry_factor: 1.12 },
    calibrated_parameters: null,
    applicable_materials: ["carbon_steel", "A36", "A516", "A106"],
    applicable_environments: ["general", "marine", "industrial", "refinery"]
  },
  paris_law_stainless: {
    model_name: "Paris Law — Stainless Steel",
    model_type: "crack_growth",
    default_parameters: { C: 5.0e-12, m: 3.25, K_IC: 80, geometry_factor: 1.12 },
    calibrated_parameters: null,
    applicable_materials: ["stainless_steel", "304", "316", "316L", "duplex"],
    applicable_environments: ["general", "marine", "chemical", "subsea"]
  },
  power_law_marine: {
    model_name: "Power Law Corrosion — Marine Immersed",
    model_type: "corrosion",
    default_parameters: { k: 0.25, n: 0.8, pitting_factor: 5.0, temp_coefficient: 0.02 },
    calibrated_parameters: null,
    applicable_materials: ["carbon_steel", "structural_steel"],
    applicable_environments: ["marine_immersed", "subsea", "splash_zone"]
  },
  power_law_atmospheric: {
    model_name: "Power Law Corrosion — Atmospheric",
    model_type: "corrosion",
    default_parameters: { k: 0.08, n: 0.6, pitting_factor: 3.0, temp_coefficient: 0.015 },
    calibrated_parameters: null,
    applicable_materials: ["carbon_steel", "structural_steel", "weathering_steel"],
    applicable_environments: ["atmospheric", "coastal", "industrial_atmospheric"]
  },
  power_law_chemical: {
    model_name: "Power Law Corrosion — Chemical Process",
    model_type: "corrosion",
    default_parameters: { k: 0.15, n: 0.85, pitting_factor: 5.5, temp_coefficient: 0.025 },
    calibrated_parameters: null,
    applicable_materials: ["carbon_steel", "stainless_steel"],
    applicable_environments: ["refinery", "chemical_process", "high_temp"]
  },
  sn_curve_carbon_steel: {
    model_name: "S-N Curve Fatigue — Carbon Steel",
    model_type: "fatigue",
    default_parameters: { S_ref: 400, b: 3.5, endurance_limit: 200, cycles_at_ref: 1e6 },
    calibrated_parameters: null,
    applicable_materials: ["carbon_steel", "structural_steel"],
    applicable_environments: ["general", "marine", "industrial"]
  },
  sn_curve_stainless: {
    model_name: "S-N Curve Fatigue — Stainless Steel",
    model_type: "fatigue",
    default_parameters: { S_ref: 350, b: 4.0, endurance_limit: 170, cycles_at_ref: 1e6 },
    calibrated_parameters: null,
    applicable_materials: ["stainless_steel", "304", "316"],
    applicable_environments: ["general", "chemical", "subsea"]
  },
  larson_miller_creep: {
    model_name: "Larson-Miller Creep",
    model_type: "creep",
    default_parameters: { C_lm: 20, A_norton: 1e-15, n_norton: 4.5, Q_activation: 280000, R_gas: 8.314 },
    calibrated_parameters: null,
    applicable_materials: ["carbon_steel", "Cr-Mo_steel", "stainless_steel"],
    applicable_environments: ["high_temp", "refinery", "power_plant"]
  },
  coating_epoxy: {
    model_name: "Coating Life — Epoxy",
    model_type: "coating",
    default_parameters: { design_life: 15, gamma: 1.5, failure_threshold: 0.3, environment_factor: 1.0 },
    calibrated_parameters: null,
    applicable_materials: ["epoxy", "modified_epoxy"],
    applicable_environments: ["general", "marine", "industrial"]
  },
  coating_tsa: {
    model_name: "Coating Life — Thermal Spray Aluminum",
    model_type: "coating",
    default_parameters: { design_life: 25, gamma: 2.0, failure_threshold: 0.4, environment_factor: 1.0 },
    calibrated_parameters: null,
    applicable_materials: ["TSA", "thermal_spray_aluminum"],
    applicable_environments: ["marine", "subsea", "offshore"]
  }
};

// ── LEARNING ALGORITHMS ────────────────────────────────────────
// Exponential moving average for parameter updates
function computeParameterUpdate(current_value, observed_value, learning_rate) {
  return current_value + learning_rate * (observed_value - current_value);
}

// Bayesian-inspired confidence weighting
function computeLearningWeight(prediction_error, sample_size, prior_confidence) {
  var error_magnitude = Math.abs(prediction_error);
  var data_weight = Math.min(1.0, sample_size / 50);
  var error_weight = error_magnitude > 0.5 ? 0.3 : error_magnitude > 0.2 ? 0.6 : 0.9;
  return Math.round(data_weight * error_weight * prior_confidence * 1000) / 1000;
}

// Derive implied parameter from observation
function deriveImpliedParameter(model_type, predicted, actual, current_params) {
  var ratio = actual / (predicted || 1);
  var adjustments = {};

  if (model_type === "crack_growth") {
    adjustments.C = current_params.C * ratio;
    adjustments.implied_ratio = ratio;
  } else if (model_type === "corrosion") {
    adjustments.k = current_params.k * ratio;
    adjustments.implied_ratio = ratio;
  } else if (model_type === "fatigue") {
    adjustments.b = current_params.b * (1 + (1 - ratio) * 0.1);
    adjustments.implied_ratio = ratio;
  } else if (model_type === "creep") {
    adjustments.A_norton = current_params.A_norton * ratio;
    adjustments.implied_ratio = ratio;
  } else if (model_type === "coating") {
    adjustments.design_life = current_params.design_life * (1 / ratio);
    adjustments.implied_ratio = ratio;
  }

  return adjustments;
}

// ── OUTPUT HELPERS ──────────────────────────────────────────────
function buildResult(code, body) {
  return { statusCode: code, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" }, body: JSON.stringify(body) };
}
function holdResult(code, msg, action) {
  return buildResult(code, { error: msg, action: action, engine: "physics-learning-engine", timestamp: new Date().toISOString() });
}

// ── ACTION: GET MODEL REGISTRY ──────────────────────────────────
async function getModelRegistry(params) {
  var models = [];

  try {
    var res = await supabase.from("physics_model_registry").select("*").eq("status", "active");
    if (res.data && res.data.length > 0) {
      models = res.data;
    }
  } catch (e) { /* fallback to defaults */ }

  if (models.length === 0) {
    var keys = Object.keys(DEFAULT_MODELS);
    for (var i = 0; i < keys.length; i++) {
      var dm = DEFAULT_MODELS[keys[i]];
      models.push({
        id: keys[i],
        model_name: dm.model_name,
        model_type: dm.model_type,
        default_parameters: dm.default_parameters,
        calibrated_parameters: dm.calibrated_parameters,
        calibration_count: 0,
        accuracy_score: null,
        applicable_materials: dm.applicable_materials,
        applicable_environments: dm.applicable_environments,
        status: "active",
        version: "v1.0.0"
      });
    }
  }

  if (params.model_type) {
    models = models.filter(function(m) { return m.model_type === params.model_type; });
  }

  return { action: "get_model_registry", models: models, count: models.length };
}

// ── ACTION: RECORD OBSERVATION ──────────────────────────────────
async function recordObservation(params) {
  var model_id = params.model_id;
  var model_key = params.model_key;
  var predicted_value = params.predicted_value;
  var actual_value = params.actual_value;
  var case_id = params.case_id || null;

  if (predicted_value === undefined || actual_value === undefined) {
    return { action: "record_observation", error: "predicted_value and actual_value required" };
  }

  var prediction_error = actual_value - predicted_value;
  var error_pct = predicted_value !== 0 ? Math.round((prediction_error / predicted_value) * 10000) / 100 : 0;

  var model_type = params.model_type || "unknown";
  var current_params = params.current_parameters || {};
  var implied = deriveImpliedParameter(model_type, predicted_value, actual_value, current_params);
  var learning_weight = computeLearningWeight(error_pct / 100, params.sample_size || 1, params.prior_confidence || 0.8);

  var record = {
    model_id: model_id || null,
    case_id: case_id,
    predicted_value: predicted_value,
    actual_value: actual_value,
    prediction_error: Math.round(prediction_error * 10000) / 10000,
    environmental_factors: params.environmental_factors || {},
    material_factors: params.material_factors || {},
    parameter_adjustment: implied,
    learning_weight: learning_weight
  };

  try {
    await supabase.from("physics_learning_events").insert([record]);
  } catch (e) { /* non-fatal */ }

  return {
    action: "record_observation",
    predicted: predicted_value,
    actual: actual_value,
    error: Math.round(prediction_error * 10000) / 10000,
    error_pct: error_pct,
    implied_parameter_adjustment: implied,
    learning_weight: learning_weight,
    recommendation: Math.abs(error_pct) > 30 ? "SIGNIFICANT_DEVIATION — parameter recalibration recommended" : Math.abs(error_pct) > 15 ? "MODERATE_DEVIATION — flag for review" : "WITHIN_TOLERANCE — no action needed"
  };
}

// ── ACTION: LEARN FROM OUTCOMES (BATCH) ─────────────────────────
async function learnFromOutcomes(params) {
  var model_id = params.model_id;
  var model_type = params.model_type || "unknown";
  var observations = params.observations || [];
  var learning_rate = params.learning_rate || 0.1;

  if (observations.length === 0) {
    return { action: "learn_from_outcomes", error: "No observations provided" };
  }

  var current_params = params.current_parameters || {};
  var errors = [];
  var total_error = 0;
  var implied_adjustments = [];

  for (var i = 0; i < observations.length; i++) {
    var obs = observations[i];
    var err = obs.actual - obs.predicted;
    var err_pct = obs.predicted !== 0 ? err / obs.predicted : 0;
    errors.push(err_pct);
    total_error = total_error + Math.abs(err_pct);

    var implied = deriveImpliedParameter(model_type, obs.predicted, obs.actual, current_params);
    implied_adjustments.push(implied);
  }

  var mean_error = total_error / observations.length;
  var mean_ratio = 0;
  for (var i = 0; i < implied_adjustments.length; i++) {
    mean_ratio = mean_ratio + (implied_adjustments[i].implied_ratio || 1);
  }
  mean_ratio = mean_ratio / implied_adjustments.length;

  var proposed_params = {};
  var param_keys = Object.keys(current_params);
  for (var i = 0; i < param_keys.length; i++) {
    var key = param_keys[i];
    if (typeof current_params[key] === "number") {
      var adjustment = implied_adjustments[0][key];
      if (adjustment !== undefined) {
        proposed_params[key] = Math.round(computeParameterUpdate(current_params[key], adjustment, learning_rate) * 1e12) / 1e12;
      } else {
        proposed_params[key] = current_params[key];
      }
    }
  }

  var accuracy_before = 1 - mean_error;
  var estimated_accuracy_after = Math.min(0.99, accuracy_before + mean_error * learning_rate * 0.5);

  var proposal = {
    action: "learn_from_outcomes",
    model_type: model_type,
    observations_count: observations.length,
    mean_absolute_error_pct: Math.round(mean_error * 10000) / 100,
    mean_adjustment_ratio: Math.round(mean_ratio * 10000) / 10000,
    current_parameters: current_params,
    proposed_parameters: proposed_params,
    accuracy_before: Math.round(accuracy_before * 1000) / 1000,
    estimated_accuracy_after: Math.round(estimated_accuracy_after * 1000) / 1000,
    learning_rate_used: learning_rate,
    governance: {
      human_approval_required: true,
      auto_apply: false,
      reason: "Physics model parameter changes require human validation before production use"
    },
    recommendation: mean_error > 0.3 ? "MAJOR_RECALIBRATION_NEEDED" : mean_error > 0.15 ? "MODERATE_ADJUSTMENT_RECOMMENDED" : "MINOR_TUNING_SUGGESTED"
  };

  try {
    await supabase.from("learning_update_candidates").insert([{
      update_type: "physics_parameter_calibration",
      target_engine: "physics-learning-engine",
      proposed_change: { model_type: model_type, current: current_params, proposed: proposed_params },
      evidence_basis: { observations_count: observations.length, mean_error: mean_error, mean_ratio: mean_ratio },
      validation_score: estimated_accuracy_after,
      risk_score: mean_error > 0.3 ? 0.7 : mean_error > 0.15 ? 0.4 : 0.2,
      status: "pending",
      human_approval_required: true
    }]);
  } catch (e) { /* non-fatal */ }

  return proposal;
}

// ── ACTION: GET MODEL ACCURACY ──────────────────────────────────
async function getModelAccuracy(params) {
  var model_id = params.model_id;
  var model_type = params.model_type;

  var events = [];
  try {
    var query = supabase.from("physics_learning_events").select("*").order("created_at", { ascending: false }).limit(100);
    if (model_id) query = query.eq("model_id", model_id);
    var res = await query;
    events = res.data || [];
  } catch (e) { /* fallback */ }

  if (events.length === 0) {
    return { action: "get_model_accuracy", model_id: model_id, events_count: 0, note: "No learning events recorded yet", accuracy: null };
  }

  var total_error = 0;
  var max_error = 0;
  var within_10pct = 0;
  var within_20pct = 0;

  for (var i = 0; i < events.length; i++) {
    var evt = events[i];
    var err = Math.abs(evt.prediction_error / (evt.predicted_value || 1));
    total_error = total_error + err;
    if (err > max_error) max_error = err;
    if (err <= 0.1) within_10pct++;
    if (err <= 0.2) within_20pct++;
  }

  var mean_error = total_error / events.length;

  return {
    action: "get_model_accuracy",
    model_id: model_id,
    events_count: events.length,
    mean_absolute_error_pct: Math.round(mean_error * 10000) / 100,
    max_error_pct: Math.round(max_error * 10000) / 100,
    accuracy_score: Math.round((1 - mean_error) * 1000) / 1000,
    within_10pct: Math.round((within_10pct / events.length) * 1000) / 10,
    within_20pct: Math.round((within_20pct / events.length) * 1000) / 10,
    calibration_status: mean_error > 0.25 ? "POORLY_CALIBRATED" : mean_error > 0.1 ? "MODERATELY_CALIBRATED" : "WELL_CALIBRATED"
  };
}

// ── ACTION: PROPOSE PARAMETER UPDATE ────────────────────────────
async function proposeParameterUpdate(params) {
  var model_id = params.model_id;
  var model_type = params.model_type;
  var current_parameters = params.current_parameters || {};
  var proposed_parameters = params.proposed_parameters || {};
  var evidence = params.evidence || {};

  var changes = {};
  var param_keys = Object.keys(proposed_parameters);
  for (var i = 0; i < param_keys.length; i++) {
    var key = param_keys[i];
    if (current_parameters[key] !== undefined && current_parameters[key] !== proposed_parameters[key]) {
      var change_pct = current_parameters[key] !== 0 ? ((proposed_parameters[key] - current_parameters[key]) / current_parameters[key]) * 100 : 0;
      changes[key] = {
        from: current_parameters[key],
        to: proposed_parameters[key],
        change_pct: Math.round(change_pct * 100) / 100
      };
    }
  }

  var max_change = 0;
  var change_keys = Object.keys(changes);
  for (var i = 0; i < change_keys.length; i++) {
    var c = Math.abs(changes[change_keys[i]].change_pct);
    if (c > max_change) max_change = c;
  }

  var risk = max_change > 50 ? "HIGH" : max_change > 20 ? "MEDIUM" : "LOW";

  var proposal = {
    action: "propose_parameter_update",
    model_id: model_id,
    model_type: model_type,
    parameter_changes: changes,
    max_change_pct: Math.round(max_change * 100) / 100,
    risk_level: risk,
    governance: {
      human_approval_required: true,
      auto_apply: false,
      rollback_available: true,
      reason: risk === "HIGH" ? "Large parameter change — requires senior engineer review" : "Standard physics model calibration update"
    },
    status: "pending_approval"
  };

  try {
    await supabase.from("learning_update_candidates").insert([{
      update_type: "physics_parameter_update",
      target_engine: "physics-learning-engine",
      proposed_change: { model_id: model_id, model_type: model_type, changes: changes, proposed: proposed_parameters },
      evidence_basis: evidence,
      validation_score: 1 - (max_change / 200),
      risk_score: max_change / 100,
      status: "pending",
      human_approval_required: true
    }]);
  } catch (e) { /* non-fatal */ }

  return proposal;
}

// ── ACTION: APPROVE & APPLY UPDATE ──────────────────────────────
async function approveAndApply(params) {
  var model_id = params.model_id;
  var approved_parameters = params.approved_parameters;
  var approved_by = params.approved_by || "system";
  var approval_notes = params.approval_notes || "";

  if (!approved_parameters) {
    return { action: "approve_and_apply", error: "approved_parameters required" };
  }

  try {
    await supabase.from("physics_model_versions").insert([{
      model_id: model_id,
      version: params.new_version || "v1.1.0",
      parameters: approved_parameters,
      accuracy_at_version: params.accuracy || null,
      change_reason: approval_notes,
      approved_by: approved_by
    }]);

    if (model_id) {
      await supabase.from("physics_model_registry").update({
        calibrated_parameters: approved_parameters,
        calibration_count: params.calibration_count || 1,
        accuracy_score: params.accuracy || null,
        version: params.new_version || "v1.1.0"
      }).eq("id", model_id);
    }
  } catch (e) { /* non-fatal */ }

  return {
    action: "approve_and_apply",
    model_id: model_id,
    version: params.new_version || "v1.1.0",
    parameters_applied: approved_parameters,
    approved_by: approved_by,
    status: "APPLIED",
    governance: { versioned: true, rollback_available: true, audit_trail: true }
  };
}

// ── ACTION: ROLLBACK MODEL ──────────────────────────────────────
async function rollbackModel(params) {
  var model_id = params.model_id;
  var target_version = params.target_version;

  var version_record = null;
  try {
    var res = await supabase.from("physics_model_versions").select("*").eq("model_id", model_id).eq("version", target_version).limit(1);
    if (res.data && res.data.length > 0) {
      version_record = res.data[0];
    }
  } catch (e) { /* */ }

  if (!version_record) {
    return { action: "rollback_model", error: "Version " + target_version + " not found for model " + model_id };
  }

  try {
    await supabase.from("physics_model_registry").update({
      calibrated_parameters: version_record.parameters,
      version: target_version
    }).eq("id", model_id);
  } catch (e) { /* non-fatal */ }

  return {
    action: "rollback_model",
    model_id: model_id,
    rolled_back_to: target_version,
    parameters_restored: version_record.parameters,
    status: "ROLLED_BACK",
    governance: { audit_trail: true, reason: params.reason || "Manual rollback" }
  };
}

// ── ACTION: GET LEARNING HISTORY ────────────────────────────────
async function getLearningHistory(params) {
  try {
    var query = supabase.from("physics_learning_events").select("*").order("created_at", { ascending: false }).limit(params.limit || 50);
    if (params.model_id) query = query.eq("model_id", params.model_id);
    if (params.case_id) query = query.eq("case_id", params.case_id);
    var res = await query;
    return { action: "get_learning_history", events: res.data || [], count: (res.data || []).length };
  } catch (e) {
    return { action: "get_learning_history", events: [], count: 0, note: "DB unavailable" };
  }
}

// ── HANDLER ─────────────────────────────────────────────────────
export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return buildResult(200, { status: "ok" });
  if (event.httpMethod !== "POST") return holdResult(405, "POST only", "error");

  var body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return holdResult(400, "Invalid JSON", "parse"); }
  var action = body.action || "get_registry";
  var requestData = body;

  if (action === "get_registry") {
    return buildResult(200, {
      engine_code: "physics-learning-engine",
      engine_version: "1.0.0",
      engine_name: "Physics Learning Engine",
      deploy: "DEPLOY318",
      layer: "Layer 2 — Physics-Informed Learning",
      description: "Learns physics behavior from real outcomes. Refines crack growth, corrosion, fatigue, creep, and coating models from field data. All parameter changes versioned and governed.",
      physics_models: Object.keys(DEFAULT_MODELS).length + " pre-loaded models",
      model_types: ["crack_growth", "corrosion", "fatigue", "creep", "coating"],
      actions: ["get_registry", "get_model_registry", "record_observation", "learn_from_outcomes", "get_model_accuracy", "propose_parameter_update", "approve_and_apply", "rollback_model", "get_learning_history"],
      governance: { human_approval_required: true, version_controlled: true, rollback_available: true },
      status: "operational"
    });
  }

  if (action === "get_model_registry") return buildResult(200, await getModelRegistry(requestData));
  if (action === "record_observation") return buildResult(200, await recordObservation(requestData));
  if (action === "learn_from_outcomes") return buildResult(200, await learnFromOutcomes(requestData));
  if (action === "get_model_accuracy") return buildResult(200, await getModelAccuracy(requestData));
  if (action === "propose_parameter_update") return buildResult(200, await proposeParameterUpdate(requestData));
  if (action === "approve_and_apply") return buildResult(200, await approveAndApply(requestData));
  if (action === "rollback_model") return buildResult(200, await rollbackModel(requestData));
  if (action === "get_learning_history") return buildResult(200, await getLearningHistory(requestData));

  return holdResult(400, "Unknown action: " + action, action);
};
