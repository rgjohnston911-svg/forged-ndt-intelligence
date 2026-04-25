// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_ANON_KEY;
var supabase = createClient(supabaseUrl, supabaseKey);

// ══════════════════════════════════════════════════════════════════
// UNCERTAINTY PROPAGATION ENGINE
//
// Takes multi-source input uncertainties (material ±X%, load ±Y%,
// geometry ±Z%, environment ±W%) and propagates them through
// physics models to produce full probability distributions on
// outputs like remaining life, corrosion rate, crack growth.
//
// Methods:
// 1. Monte Carlo Simulation — random sampling, distribution-free
// 2. First-Order Reliability Method (FORM) — linearized, fast
// 3. Latin Hypercube Sampling — stratified Monte Carlo, efficient
// ══════════════════════════════════════════════════════════════════

// ── RANDOM NUMBER GENERATORS ────────────────────────────────────
// Box-Muller transform for normal distribution
function randNormal(mean, std) {
  var u1 = Math.random();
  var u2 = Math.random();
  var z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

function randUniform(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

function randLogNormal(mean, std) {
  var mu = Math.log(mean * mean / Math.sqrt(std * std + mean * mean));
  var sigma = Math.sqrt(Math.log(1 + (std * std) / (mean * mean)));
  return Math.exp(randNormal(mu, sigma));
}

function sampleVariable(variable) {
  var dist = variable.distribution || "normal";
  var mean = variable.mean || variable.value || 0;
  var std = variable.std || variable.uncertainty || mean * 0.1;

  if (dist === "normal") return randNormal(mean, std);
  if (dist === "uniform") return randUniform(variable.min || mean - std * 1.73, variable.max || mean + std * 1.73);
  if (dist === "lognormal") return randLogNormal(mean, std);
  return randNormal(mean, std);
}

// ── LATIN HYPERCUBE SAMPLING ────────────────────────────────────
function latinHypercubeSamples(variables, n_samples) {
  var var_keys = Object.keys(variables);
  var n_vars = var_keys.length;
  var samples = [];

  // Create stratified intervals for each variable
  var intervals = {};
  for (var i = 0; i < n_vars; i++) {
    var key = var_keys[i];
    var perm = [];
    for (var j = 0; j < n_samples; j++) perm.push(j);
    // Fisher-Yates shuffle
    for (var j = n_samples - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var tmp = perm[j]; perm[j] = perm[k]; perm[k] = tmp;
    }
    intervals[key] = perm;
  }

  for (var i = 0; i < n_samples; i++) {
    var sample = {};
    for (var j = 0; j < n_vars; j++) {
      var key = var_keys[j];
      var v = variables[key];
      var stratum = intervals[key][i];
      var u = (stratum + Math.random()) / n_samples;

      var mean = v.mean || v.value || 0;
      var std = v.std || v.uncertainty || mean * 0.1;
      var dist = v.distribution || "normal";

      if (dist === "normal") {
        // Inverse normal CDF approximation (Abramowitz & Stegun)
        var p = u;
        if (p < 0.001) p = 0.001;
        if (p > 0.999) p = 0.999;
        var t_val = Math.sqrt(-2 * Math.log(p < 0.5 ? p : 1 - p));
        var c0 = 2.515517, c1 = 0.802853, c2 = 0.010328;
        var d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;
        var z = t_val - (c0 + c1 * t_val + c2 * t_val * t_val) / (1 + d1 * t_val + d2 * t_val * t_val + d3 * t_val * t_val * t_val);
        if (p < 0.5) z = -z;
        sample[key] = mean + std * z;
      } else if (dist === "uniform") {
        var lo = v.min || mean - std * 1.73;
        var hi = v.max || mean + std * 1.73;
        sample[key] = lo + u * (hi - lo);
      } else {
        sample[key] = mean + std * (u - 0.5) * 3.46;
      }
    }
    samples.push(sample);
  }

  return samples;
}

// ── PHYSICS MODELS FOR PROPAGATION ──────────────────────────────
var PROPAGATION_MODELS = {
  remaining_life_corrosion: {
    name: "Remaining Life — Corrosion",
    inputs: ["wall_thickness_mm", "corrosion_rate_mm_yr", "minimum_wall_mm"],
    compute: function(vars) {
      var t = vars.wall_thickness_mm || 25;
      var r = vars.corrosion_rate_mm_yr || 0.25;
      var t_min = vars.minimum_wall_mm || t * 0.4;
      if (r <= 0) return 999;
      return (t - t_min) / r;
    },
    output_name: "remaining_life_years",
    output_units: "years"
  },
  remaining_life_crack: {
    name: "Remaining Life — Crack Growth",
    inputs: ["initial_crack_mm", "critical_crack_mm", "crack_growth_rate_mm_yr"],
    compute: function(vars) {
      var a0 = vars.initial_crack_mm || 2;
      var ac = vars.critical_crack_mm || 20;
      var rate = vars.crack_growth_rate_mm_yr || 0.5;
      if (rate <= 0) return 999;
      return (ac - a0) / rate;
    },
    output_name: "remaining_life_years",
    output_units: "years"
  },
  remaining_life_fatigue: {
    name: "Remaining Life — Fatigue (Miner's Rule)",
    inputs: ["current_damage", "annual_damage_increment"],
    compute: function(vars) {
      var D = vars.current_damage || 0;
      var dD = vars.annual_damage_increment || 0.05;
      if (dD <= 0) return 999;
      return (1.0 - D) / dD;
    },
    output_name: "remaining_life_years",
    output_units: "years"
  },
  burst_pressure: {
    name: "Burst Pressure (B31G Modified)",
    inputs: ["wall_thickness_mm", "outer_diameter_mm", "smys_mpa", "defect_depth_mm", "defect_length_mm"],
    compute: function(vars) {
      var t = vars.wall_thickness_mm || 25;
      var D = vars.outer_diameter_mm || 500;
      var SMYS = vars.smys_mpa || 358;
      var d = vars.defect_depth_mm || 5;
      var L = vars.defect_length_mm || 50;

      var A = d * L;
      var A0 = t * L;
      var M = Math.sqrt(1 + 0.6275 * (L * L) / (D * t) - 0.003375 * Math.pow(L, 4) / (D * D * t * t));
      var RSF = (1 - A / A0) / (1 - A / (A0 * M));
      var P_burst = 2 * SMYS * t / D * RSF;
      return P_burst;
    },
    output_name: "burst_pressure_mpa",
    output_units: "MPa"
  },
  stress_intensity: {
    name: "Stress Intensity Factor",
    inputs: ["applied_stress_mpa", "crack_length_mm", "geometry_factor"],
    compute: function(vars) {
      var sigma = vars.applied_stress_mpa || 100;
      var a = (vars.crack_length_mm || 5) / 1000;
      var Y = vars.geometry_factor || 1.12;
      return Y * sigma * Math.sqrt(Math.PI * a);
    },
    output_name: "K_mpa_sqrt_m",
    output_units: "MPa*sqrt(m)"
  }
};

// ── MONTE CARLO PROPAGATION ─────────────────────────────────────
function monteCarloPropagate(model_key, input_variables, n_samples, method) {
  var model = PROPAGATION_MODELS[model_key];
  if (!model) return { error: "Unknown model: " + model_key };

  var samples;
  if (method === "latin_hypercube") {
    samples = latinHypercubeSamples(input_variables, n_samples);
  } else {
    samples = [];
    for (var i = 0; i < n_samples; i++) {
      var s = {};
      var keys = Object.keys(input_variables);
      for (var j = 0; j < keys.length; j++) {
        s[keys[j]] = sampleVariable(input_variables[keys[j]]);
      }
      samples.push(s);
    }
  }

  // Run model for each sample
  var outputs = [];
  for (var i = 0; i < samples.length; i++) {
    var val = model.compute(samples[i]);
    if (isFinite(val) && val < 9999) outputs.push(val);
  }

  outputs.sort(function(a, b) { return a - b; });

  var n = outputs.length;
  if (n === 0) return { error: "All samples produced invalid outputs" };

  // Statistics
  var sum = 0, sum2 = 0;
  for (var i = 0; i < n; i++) { sum += outputs[i]; sum2 += outputs[i] * outputs[i]; }
  var mean = sum / n;
  var variance = sum2 / n - mean * mean;
  var std = Math.sqrt(variance);

  // Percentiles
  function percentile(arr, p) { var idx = Math.floor(p * arr.length); return arr[Math.min(idx, arr.length - 1)]; }

  var p5 = percentile(outputs, 0.05);
  var p25 = percentile(outputs, 0.25);
  var p50 = percentile(outputs, 0.50);
  var p75 = percentile(outputs, 0.75);
  var p95 = percentile(outputs, 0.95);

  // Probability of exceeding thresholds
  var prob_negative = outputs.filter(function(v) { return v <= 0; }).length / n;

  return {
    model: model_key,
    model_name: model.name,
    output_name: model.output_name,
    output_units: model.output_units,
    method: method || "monte_carlo",
    samples_run: n_samples,
    valid_samples: n,
    statistics: {
      mean: Math.round(mean * 10000) / 10000,
      std: Math.round(std * 10000) / 10000,
      cv: Math.round((std / Math.abs(mean || 1)) * 10000) / 10000,
      min: Math.round(outputs[0] * 10000) / 10000,
      max: Math.round(outputs[n - 1] * 10000) / 10000
    },
    percentiles: {
      p5: Math.round(p5 * 10000) / 10000,
      p25: Math.round(p25 * 10000) / 10000,
      p50_median: Math.round(p50 * 10000) / 10000,
      p75: Math.round(p75 * 10000) / 10000,
      p95: Math.round(p95 * 10000) / 10000
    },
    prediction_interval_90: {
      lower: Math.round(p5 * 10000) / 10000,
      upper: Math.round(p95 * 10000) / 10000,
      width: Math.round((p95 - p5) * 10000) / 10000
    },
    probability_of_failure: Math.round(prob_negative * 10000) / 100,
    interpretation: "The " + model.output_name + " has a 90% probability of being between " + (Math.round(p5 * 100) / 100) + " and " + (Math.round(p95 * 100) / 100) + " " + model.output_units
  };
}

// ── FORM (FIRST-ORDER RELIABILITY METHOD) ───────────────────────
function formPropagate(model_key, input_variables) {
  var model = PROPAGATION_MODELS[model_key];
  if (!model) return { error: "Unknown model: " + model_key };

  var keys = Object.keys(input_variables);
  var means = {};
  var stds = {};
  for (var i = 0; i < keys.length; i++) {
    var v = input_variables[keys[i]];
    means[keys[i]] = v.mean || v.value || 0;
    stds[keys[i]] = v.std || v.uncertainty || means[keys[i]] * 0.1;
  }

  // Evaluate at mean point
  var f_mean = model.compute(means);

  // Partial derivatives via finite difference
  var partials = {};
  var variance_contribution = {};
  var total_variance = 0;

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var h = stds[key] * 0.01;
    if (h === 0) h = means[key] * 0.001 || 0.001;

    var perturbed = Object.assign({}, means);
    perturbed[key] = means[key] + h;
    var f_plus = model.compute(perturbed);

    perturbed[key] = means[key] - h;
    var f_minus = model.compute(perturbed);

    var df_dx = (f_plus - f_minus) / (2 * h);
    partials[key] = Math.round(df_dx * 1e8) / 1e8;

    var var_contrib = (df_dx * stds[key]) * (df_dx * stds[key]);
    variance_contribution[key] = Math.round(var_contrib * 1e8) / 1e8;
    total_variance += var_contrib;
  }

  var total_std = Math.sqrt(total_variance);

  // Sensitivity ranking
  var sensitivity = [];
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var contrib_pct = total_variance > 0 ? (variance_contribution[key] / total_variance) * 100 : 0;
    sensitivity.push({
      variable: key,
      partial_derivative: partials[key],
      variance_contribution: variance_contribution[key],
      contribution_pct: Math.round(contrib_pct * 10) / 10
    });
  }
  sensitivity.sort(function(a, b) { return b.contribution_pct - a.contribution_pct; });

  return {
    model: model_key,
    model_name: model.name,
    output_name: model.output_name,
    output_units: model.output_units,
    method: "FORM",
    mean_output: Math.round(f_mean * 10000) / 10000,
    std_output: Math.round(total_std * 10000) / 10000,
    cv: Math.round((total_std / Math.abs(f_mean || 1)) * 10000) / 10000,
    prediction_interval_95: {
      lower: Math.round((f_mean - 1.96 * total_std) * 10000) / 10000,
      upper: Math.round((f_mean + 1.96 * total_std) * 10000) / 10000
    },
    sensitivity_ranking: sensitivity,
    dominant_uncertainty_source: sensitivity.length > 0 ? sensitivity[0].variable : null,
    interpretation: "Output uncertainty is " + Math.round((total_std / Math.abs(f_mean || 1)) * 10000) / 100 + "% (CV). Dominant source: " + (sensitivity.length > 0 ? sensitivity[0].variable + " (" + sensitivity[0].contribution_pct + "%)" : "none")
  };
}

// ── OUTPUT HELPERS ──────────────────────────────────────────────
function buildResult(code, body) {
  return { statusCode: code, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" }, body: JSON.stringify(body) };
}
function holdResult(code, msg, action) {
  return buildResult(code, { error: msg, action: action, engine: "uncertainty-propagation", timestamp: new Date().toISOString() });
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
      engine_code: "uncertainty-propagation",
      engine_version: "1.0.0",
      engine_name: "Uncertainty Propagation Engine",
      deploy: "DEPLOY324",
      paradigm: "Multi-source uncertainty propagation through physics models",
      description: "Propagates input uncertainties (material ±X%, load ±Y%, geometry ±Z%) through physics models using Monte Carlo, Latin Hypercube Sampling, or FORM. Produces full probability distributions and identifies the dominant uncertainty source.",
      methods: ["monte_carlo", "latin_hypercube", "FORM"],
      models_available: Object.keys(PROPAGATION_MODELS).map(function(k) { return { key: k, name: PROPAGATION_MODELS[k].name }; }),
      input_distributions: ["normal", "uniform", "lognormal"],
      actions: ["get_registry", "propagate_mc", "propagate_form", "sensitivity_analysis", "get_models"],
      status: "operational"
    });
  }

  if (action === "propagate_mc") {
    var model = requestData.model;
    var variables = requestData.variables || {};
    var n_samples = requestData.n_samples || 5000;
    var method = requestData.sampling_method || "latin_hypercube";

    if (!model) return holdResult(400, "model required", action);
    if (Object.keys(variables).length === 0) return holdResult(400, "variables required", action);
    if (n_samples > 50000) n_samples = 50000;

    var result = monteCarloPropagate(model, variables, n_samples, method);

    try {
      await supabase.from("uncertainty_propagation_runs").insert([{
        case_id: requestData.case_id || null,
        model_key: model,
        method: method,
        n_samples: n_samples,
        input_variables: variables,
        output_mean: result.statistics ? result.statistics.mean : null,
        output_std: result.statistics ? result.statistics.std : null,
        p5: result.percentiles ? result.percentiles.p5 : null,
        p95: result.percentiles ? result.percentiles.p95 : null,
        probability_of_failure: result.probability_of_failure || null
      }]);
    } catch (e) { /* non-fatal */ }

    return buildResult(200, { action: "propagate_mc", engine: "uncertainty-propagation", result: result, timestamp: new Date().toISOString() });
  }

  if (action === "propagate_form") {
    var model = requestData.model;
    var variables = requestData.variables || {};

    if (!model) return holdResult(400, "model required", action);
    if (Object.keys(variables).length === 0) return holdResult(400, "variables required", action);

    var result = formPropagate(model, variables);

    try {
      await supabase.from("uncertainty_propagation_runs").insert([{
        case_id: requestData.case_id || null,
        model_key: model,
        method: "FORM",
        n_samples: 0,
        input_variables: variables,
        output_mean: result.mean_output,
        output_std: result.std_output,
        p5: result.prediction_interval_95 ? result.prediction_interval_95.lower : null,
        p95: result.prediction_interval_95 ? result.prediction_interval_95.upper : null
      }]);
    } catch (e) { /* non-fatal */ }

    return buildResult(200, { action: "propagate_form", engine: "uncertainty-propagation", result: result, timestamp: new Date().toISOString() });
  }

  if (action === "sensitivity_analysis") {
    var model = requestData.model;
    var variables = requestData.variables || {};

    if (!model) return holdResult(400, "model required", action);

    var form_result = formPropagate(model, variables);
    var mc_result = monteCarloPropagate(model, variables, requestData.n_samples || 5000, "latin_hypercube");

    return buildResult(200, {
      action: "sensitivity_analysis",
      engine: "uncertainty-propagation",
      form_analysis: {
        sensitivity_ranking: form_result.sensitivity_ranking,
        dominant_source: form_result.dominant_uncertainty_source,
        cv: form_result.cv
      },
      mc_validation: {
        mean: mc_result.statistics ? mc_result.statistics.mean : null,
        std: mc_result.statistics ? mc_result.statistics.std : null,
        p90_interval: mc_result.prediction_interval_90
      },
      recommendation: form_result.sensitivity_ranking && form_result.sensitivity_ranking.length > 0 ? "Reduce uncertainty in " + form_result.sensitivity_ranking[0].variable + " for maximum impact (" + form_result.sensitivity_ranking[0].contribution_pct + "% of total variance)" : "Insufficient data",
      timestamp: new Date().toISOString()
    });
  }

  if (action === "get_models") {
    var models = [];
    var keys = Object.keys(PROPAGATION_MODELS);
    for (var i = 0; i < keys.length; i++) {
      models.push({ key: keys[i], name: PROPAGATION_MODELS[keys[i]].name, inputs: PROPAGATION_MODELS[keys[i]].inputs, output: PROPAGATION_MODELS[keys[i]].output_name, units: PROPAGATION_MODELS[keys[i]].output_units });
    }
    return buildResult(200, { action: "get_models", models: models, count: models.length });
  }

  return holdResult(400, "Unknown action: " + action, action);
};
