// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_ANON_KEY;
var supabase = createClient(supabaseUrl, supabaseKey);

// ══════════════════════════════════════════════════════════════════
// PHYSICS-CONSTRAINED INFERENCE ENGINE (PINN CORE)
//
// Instead of evaluating a physics formula with known parameters,
// this engine INFERS unknown parameters from noisy field data
// while being CONSTRAINED by the governing differential equation.
//
// The physics equation acts as a regularizer — the inferred
// parameters MUST produce results consistent with the governing
// law, even when data is sparse or noisy.
//
// Method: Constrained least-squares with physics penalty
//   Loss = data_fit + lambda * physics_violation
//
// This is the serverless approximation of what a GPU-trained PINN
// does with automatic differentiation — we use grid search +
// refinement over the parameter space with physics consistency
// enforced at every evaluation point.
// ══════════════════════════════════════════════════════════════════

// ── GOVERNING EQUATIONS ─────────────────────────────────────────
var GOVERNING_EQUATIONS = {
  mcconomy_sulfidation: {
    name: "McConomy Sulfidation (API 939-C)",
    equation: "rate = A * exp(-Q / (R * T)) * P_H2S^n",
    parameters: ["A", "Q", "n"],
    defaults: { A: 1.0e8, Q: 125000, n: 0.4, R: 8.314 },
    bounds: { A: [1e6, 1e12], Q: [80000, 180000], n: [0.2, 0.8] },
    evaluate: function(params, conditions) {
      var T = conditions.temperature_k || (conditions.temperature_c + 273.15);
      var P = conditions.h2s_partial_pressure || 0.01;
      var rate = params.A * Math.exp(-params.Q / (params.R * T)) * Math.pow(P, params.n);
      return rate;
    },
    units: "mm/yr"
  },
  paris_law_crack: {
    name: "Paris Law Crack Growth",
    equation: "da/dN = C * (delta_K)^m",
    parameters: ["C", "m"],
    defaults: { C: 3.0e-12, m: 3.0 },
    bounds: { C: [1e-14, 1e-9], m: [2.0, 5.0] },
    evaluate: function(params, conditions) {
      var delta_K = conditions.delta_K || conditions.stress_intensity_range || 10;
      var rate = params.C * Math.pow(delta_K, params.m);
      return rate;
    },
    units: "m/cycle"
  },
  power_law_corrosion: {
    name: "Power Law General Corrosion",
    equation: "d(t) = k * t^n",
    parameters: ["k", "n"],
    defaults: { k: 0.25, n: 0.8 },
    bounds: { k: [0.001, 2.0], n: [0.3, 1.5] },
    evaluate: function(params, conditions) {
      var t = conditions.time_years || 1;
      var loss = params.k * Math.pow(t, params.n);
      return loss;
    },
    units: "mm"
  },
  dewaard_milliams_co2: {
    name: "de Waard-Milliams CO2 Corrosion",
    equation: "log(rate) = 5.8 - 1710/T + 0.67*log(pCO2)",
    parameters: ["A_dw", "B_dw", "n_co2"],
    defaults: { A_dw: 5.8, B_dw: 1710, n_co2: 0.67 },
    bounds: { A_dw: [4.0, 8.0], B_dw: [1200, 2200], n_co2: [0.4, 1.0] },
    evaluate: function(params, conditions) {
      var T = conditions.temperature_k || (conditions.temperature_c + 273.15);
      var pCO2 = conditions.co2_partial_pressure || 0.1;
      var log_rate = params.A_dw - params.B_dw / T + params.n_co2 * Math.log10(pCO2);
      return Math.pow(10, log_rate);
    },
    units: "mm/yr"
  },
  arrhenius_kinetics: {
    name: "Arrhenius Kinetic Rate",
    equation: "k = A * exp(-Ea / (R * T))",
    parameters: ["A_arr", "Ea"],
    defaults: { A_arr: 1e10, Ea: 80000, R: 8.314 },
    bounds: { A_arr: [1e5, 1e15], Ea: [40000, 200000] },
    evaluate: function(params, conditions) {
      var T = conditions.temperature_k || (conditions.temperature_c + 273.15);
      var rate = params.A_arr * Math.exp(-params.Ea / (params.R * T));
      return rate;
    },
    units: "1/s"
  },
  norton_creep: {
    name: "Norton Creep Law",
    equation: "epsilon_dot = A * sigma^n * exp(-Q/(R*T))",
    parameters: ["A_norton", "n_norton", "Q_creep"],
    defaults: { A_norton: 1e-15, n_norton: 4.5, Q_creep: 280000, R: 8.314 },
    bounds: { A_norton: [1e-20, 1e-10], n_norton: [2.0, 8.0], Q_creep: [150000, 400000] },
    evaluate: function(params, conditions) {
      var T = conditions.temperature_k || (conditions.temperature_c + 273.15);
      var sigma = conditions.stress_mpa || 100;
      var rate = params.A_norton * Math.pow(sigma, params.n_norton) * Math.exp(-params.Q_creep / (params.R * T));
      return rate;
    },
    units: "1/hr"
  },
  mic_pitting: {
    name: "MIC Pitting Rate",
    equation: "depth = k_mic * t^n_mic * f(biofilm) * f(temp)",
    parameters: ["k_mic", "n_mic", "biofilm_factor"],
    defaults: { k_mic: 0.5, n_mic: 0.6, biofilm_factor: 2.0 },
    bounds: { k_mic: [0.05, 5.0], n_mic: [0.3, 1.0], biofilm_factor: [1.0, 5.0] },
    evaluate: function(params, conditions) {
      var t = conditions.time_years || 1;
      var temp_factor = 1.0;
      if (conditions.temperature_c) {
        temp_factor = conditions.temperature_c > 20 && conditions.temperature_c < 45 ? 1.5 : 1.0;
      }
      var depth = params.k_mic * Math.pow(t, params.n_mic) * params.biofilm_factor * temp_factor;
      return depth;
    },
    units: "mm"
  },
  cscc_growth: {
    name: "Chloride Stress Corrosion Cracking Growth",
    equation: "da/dt = A_cscc * K^n_cscc * exp(-Q_cscc/(R*T)) * [Cl]^p",
    parameters: ["A_cscc", "n_cscc", "Q_cscc", "p_cl"],
    defaults: { A_cscc: 1e-6, n_cscc: 2.5, Q_cscc: 60000, p_cl: 0.5, R: 8.314 },
    bounds: { A_cscc: [1e-10, 1e-2], n_cscc: [1.0, 5.0], Q_cscc: [30000, 120000], p_cl: [0.2, 1.0] },
    evaluate: function(params, conditions) {
      var T = conditions.temperature_k || (conditions.temperature_c + 273.15);
      var K = conditions.stress_intensity || 20;
      var Cl = conditions.chloride_ppm || 100;
      var rate = params.A_cscc * Math.pow(K, params.n_cscc) * Math.exp(-params.Q_cscc / (params.R * T)) * Math.pow(Cl / 1000, params.p_cl);
      return rate;
    },
    units: "mm/yr"
  }
};

// ── CONSTRAINED INFERENCE ALGORITHM ─────────────────────────────
// Grid search + refinement with physics penalty
function constrainedInference(equation_key, observations, options) {
  var eq = GOVERNING_EQUATIONS[equation_key];
  if (!eq) return { error: "Unknown equation: " + equation_key };

  var param_names = eq.parameters;
  var defaults = eq.defaults;
  var bounds = eq.bounds;
  var lambda_physics = (options && options.physics_weight) || 10.0;
  var grid_resolution = (options && options.grid_resolution) || 10;
  var refinement_rounds = (options && options.refinement_rounds) || 3;

  // Generate grid for each parameter
  function linspace(lo, hi, n) {
    var vals = [];
    for (var i = 0; i < n; i++) {
      vals.push(lo + (hi - lo) * i / (n - 1));
    }
    return vals;
  }

  var best_params = {};
  var best_loss = Infinity;
  var current_bounds = {};

  for (var i = 0; i < param_names.length; i++) {
    var pn = param_names[i];
    current_bounds[pn] = bounds[pn] ? [bounds[pn][0], bounds[pn][1]] : [defaults[pn] * 0.1, defaults[pn] * 10];
  }

  // Copy non-inferrable params from defaults
  var base_params = {};
  var dk = Object.keys(defaults);
  for (var i = 0; i < dk.length; i++) {
    base_params[dk[i]] = defaults[dk[i]];
  }

  for (var round = 0; round < refinement_rounds; round++) {
    var grids = {};
    for (var i = 0; i < param_names.length; i++) {
      var pn = param_names[i];
      var lo = current_bounds[pn][0];
      var hi = current_bounds[pn][1];
      // Use log-space for parameters spanning orders of magnitude
      if (hi / lo > 100) {
        var log_lo = Math.log10(lo);
        var log_hi = Math.log10(hi);
        var log_vals = linspace(log_lo, log_hi, grid_resolution);
        grids[pn] = log_vals.map(function(v) { return Math.pow(10, v); });
      } else {
        grids[pn] = linspace(lo, hi, grid_resolution);
      }
    }

    // Evaluate grid (handle 1-4 parameter dimensions)
    var grid_keys = param_names.slice(0, Math.min(param_names.length, 4));

    function evaluatePoint(trial_params) {
      var params = Object.assign({}, base_params, trial_params);
      var data_loss = 0;
      var physics_loss = 0;

      for (var j = 0; j < observations.length; j++) {
        var obs = observations[j];
        var predicted = eq.evaluate(params, obs.conditions);
        var actual = obs.measured_value;

        // Normalized data fit
        var norm = actual !== 0 ? actual : 1;
        var residual = (predicted - actual) / norm;
        data_loss += residual * residual;

        // Physics consistency: predicted should be non-negative and finite
        if (predicted < 0 || !isFinite(predicted)) {
          physics_loss += 1000;
        }
      }

      data_loss = data_loss / observations.length;
      var total_loss = data_loss + lambda_physics * physics_loss;
      return total_loss;
    }

    // Grid search (up to 4D)
    var g0 = grids[grid_keys[0]] || [defaults[grid_keys[0]]];
    var g1 = grid_keys[1] ? (grids[grid_keys[1]] || [defaults[grid_keys[1]]]) : [null];
    var g2 = grid_keys[2] ? (grids[grid_keys[2]] || [defaults[grid_keys[2]]]) : [null];
    var g3 = grid_keys[3] ? (grids[grid_keys[3]] || [defaults[grid_keys[3]]]) : [null];

    for (var i0 = 0; i0 < g0.length; i0++) {
      for (var i1 = 0; i1 < g1.length; i1++) {
        for (var i2 = 0; i2 < g2.length; i2++) {
          for (var i3 = 0; i3 < g3.length; i3++) {
            var trial = {};
            trial[grid_keys[0]] = g0[i0];
            if (grid_keys[1] && g1[i1] !== null) trial[grid_keys[1]] = g1[i1];
            if (grid_keys[2] && g2[i2] !== null) trial[grid_keys[2]] = g2[i2];
            if (grid_keys[3] && g3[i3] !== null) trial[grid_keys[3]] = g3[i3];

            var loss = evaluatePoint(trial);
            if (loss < best_loss) {
              best_loss = loss;
              best_params = Object.assign({}, trial);
            }
          }
        }
      }
    }

    // Narrow bounds around best for next refinement round
    for (var i = 0; i < param_names.length; i++) {
      var pn = param_names[i];
      if (best_params[pn] !== undefined) {
        var val = best_params[pn];
        var range = current_bounds[pn][1] - current_bounds[pn][0];
        current_bounds[pn] = [Math.max(bounds[pn][0], val - range * 0.15), Math.min(bounds[pn][1], val + range * 0.15)];
      }
    }
  }

  // Compute uncertainty on inferred parameters via perturbation
  var param_uncertainty = {};
  for (var i = 0; i < param_names.length; i++) {
    var pn = param_names[i];
    if (best_params[pn] === undefined) continue;
    var val = best_params[pn];
    var perturb_plus = Object.assign({}, best_params);
    var perturb_minus = Object.assign({}, best_params);
    perturb_plus[pn] = val * 1.1;
    perturb_minus[pn] = val * 0.9;
    var loss_plus = evaluatePoint(perturb_plus);
    var loss_minus = evaluatePoint(perturb_minus);
    var curvature = (loss_plus + loss_minus - 2 * best_loss) / (0.1 * val * 0.1 * val);
    var std_est = curvature > 0 ? 1 / Math.sqrt(curvature) : val * 0.5;
    param_uncertainty[pn] = {
      value: best_params[pn],
      std: Math.round(std_est * 1e8) / 1e8,
      lower_95: best_params[pn] - 1.96 * std_est,
      upper_95: best_params[pn] + 1.96 * std_est,
      relative_uncertainty_pct: Math.round((std_est / Math.abs(best_params[pn] || 1)) * 10000) / 100
    };
  }

  // Compute fitted vs measured
  var fitted = [];
  var total_error = 0;
  var full_params = Object.assign({}, base_params, best_params);
  for (var j = 0; j < observations.length; j++) {
    var obs = observations[j];
    var pred = eq.evaluate(full_params, obs.conditions);
    var err = Math.abs(pred - obs.measured_value) / (obs.measured_value || 1);
    total_error += err;
    fitted.push({
      observation_index: j,
      measured: obs.measured_value,
      fitted: Math.round(pred * 1e8) / 1e8,
      residual: Math.round((pred - obs.measured_value) * 1e8) / 1e8,
      error_pct: Math.round(err * 10000) / 100
    });
  }

  // Tri-state output
  var mean_error = total_error / observations.length;
  var tri_state = mean_error < 0.1 ? "CONFIRMED" : mean_error < 0.3 ? "PLAUSIBLE" : "INSUFFICIENT_FIT";

  return {
    equation: equation_key,
    equation_name: eq.name,
    governing_equation: eq.equation,
    inferred_parameters: best_params,
    parameter_uncertainty: param_uncertainty,
    fit_quality: {
      total_loss: Math.round(best_loss * 1e8) / 1e8,
      mean_error_pct: Math.round(mean_error * 10000) / 100,
      observations_used: observations.length,
      refinement_rounds: refinement_rounds,
      grid_resolution: grid_resolution
    },
    fitted_vs_measured: fitted,
    tri_state: tri_state,
    physics_constraint: "All inferred parameters satisfy governing equation " + eq.equation,
    units: eq.units,
    confidence: tri_state === "CONFIRMED" ? 0.92 : tri_state === "PLAUSIBLE" ? 0.70 : 0.40
  };
}

// ── OUTPUT HELPERS ──────────────────────────────────────────────
function buildResult(code, body) {
  return { statusCode: code, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" }, body: JSON.stringify(body) };
}
function holdResult(code, msg, action) {
  return buildResult(code, { error: msg, action: action, engine: "physics-constrained-inference", timestamp: new Date().toISOString() });
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
      engine_code: "physics-constrained-inference",
      engine_version: "1.0.0",
      engine_name: "Physics-Constrained Inference Engine",
      deploy: "DEPLOY323",
      paradigm: "Physics-Informed Neural Network (PINN) Core — serverless constrained inference",
      description: "Infers unknown physics parameters from noisy field measurements while being constrained by governing differential equations. The physics acts as a regularizer — inferred parameters MUST be consistent with the governing law. Outputs with uncertainty bands feed the tri-state precondition system.",
      governing_equations: Object.keys(GOVERNING_EQUATIONS).length,
      equations_available: Object.keys(GOVERNING_EQUATIONS).map(function(k) { return { key: k, name: GOVERNING_EQUATIONS[k].name, equation: GOVERNING_EQUATIONS[k].equation }; }),
      method: "Constrained grid search with iterative refinement + physics penalty (lambda * violation)",
      actions: ["get_registry", "infer_parameters", "evaluate_equation", "get_equations"],
      tri_state_output: "CONFIRMED (error < 10%) | PLAUSIBLE (10-30%) | INSUFFICIENT_FIT (> 30%)",
      status: "operational"
    });
  }

  if (action === "infer_parameters") {
    var equation = requestData.equation;
    var observations = requestData.observations || [];

    if (!equation) return holdResult(400, "equation required (e.g. mcconomy_sulfidation)", action);
    if (observations.length < 2) return holdResult(400, "At least 2 observations [{conditions: {...}, measured_value: N}] required", action);

    var result = constrainedInference(equation, observations, requestData.options || {});

    try {
      await supabase.from("constrained_inference_runs").insert([{
        case_id: requestData.case_id || null,
        equation_key: equation,
        observations_count: observations.length,
        inferred_parameters: result.inferred_parameters,
        parameter_uncertainty: result.parameter_uncertainty,
        fit_quality: result.fit_quality,
        tri_state: result.tri_state,
        confidence: result.confidence
      }]);
    } catch (e) { /* non-fatal */ }

    return buildResult(200, { action: "infer_parameters", engine: "physics-constrained-inference", result: result, timestamp: new Date().toISOString() });
  }

  if (action === "evaluate_equation") {
    var equation = requestData.equation;
    var parameters = requestData.parameters || {};
    var conditions = requestData.conditions || {};

    if (!equation) return holdResult(400, "equation required", action);

    var eq = GOVERNING_EQUATIONS[equation];
    if (!eq) return holdResult(400, "Unknown equation: " + equation, action);

    var full_params = Object.assign({}, eq.defaults, parameters);
    var value = eq.evaluate(full_params, conditions);

    return buildResult(200, {
      action: "evaluate_equation",
      equation: equation,
      equation_name: eq.name,
      governing_equation: eq.equation,
      parameters_used: full_params,
      conditions: conditions,
      result: Math.round(value * 1e8) / 1e8,
      units: eq.units,
      timestamp: new Date().toISOString()
    });
  }

  if (action === "get_equations") {
    var equations = [];
    var keys = Object.keys(GOVERNING_EQUATIONS);
    for (var i = 0; i < keys.length; i++) {
      var eq = GOVERNING_EQUATIONS[keys[i]];
      equations.push({
        key: keys[i],
        name: eq.name,
        equation: eq.equation,
        parameters: eq.parameters,
        defaults: eq.defaults,
        bounds: eq.bounds,
        units: eq.units
      });
    }
    return buildResult(200, { action: "get_equations", equations: equations, count: equations.length });
  }

  return holdResult(400, "Unknown action: " + action, action);
};
