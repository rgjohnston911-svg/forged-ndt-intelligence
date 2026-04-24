// @ts-nocheck
/**
 * DEPLOY305 - advanced-probability-engine.ts
 * netlify/functions/advanced-probability-engine.ts
 *
 * ADVANCED PROBABILITY ENGINE — ENGINE 95
 *
 * Sub-engines 201, 211, 212, 213, 214, 235:
 *   201 - Bayesian Evidence (Bayes theorem posterior update)
 *   211 - Reliability + Survival (Weibull reliability, hazard rate)
 *   212 - Monte Carlo Simulation (stochastic exceedance probability)
 *   213 - Markov State Transition (condition state propagation)
 *   214 - Kalman Sensor Fusion (noisy measurement fusion)
 *   235 - Measurement Uncertainty (root-sum-square propagation)
 *
 * POST /api/advanced-probability-engine
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var ENGINE_ID = "advanced-probability-engine";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY305";
var corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };

// ============================================================
// HELPERS
// ============================================================

function num(v, fallback) {
  var n = Number(v);
  if (v === undefined || v === null || v === "" || isNaN(n)) {
    return fallback !== undefined ? fallback : null;
  }
  return n;
}

function getMissing(inp, keys) {
  var m = [];
  for (var i = 0; i < keys.length; i++) {
    if (inp[keys[i]] === undefined || inp[keys[i]] === null || inp[keys[i]] === "") m.push(keys[i]);
  }
  return m;
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

function buildResult(engineNum, engineCode, partial) {
  return {
    engine_number: engineNum,
    engine_code: engineCode,
    result: partial.result || {},
    interpretation: partial.interpretation || "Calculation complete.",
    confidence: clamp01(partial.confidence || 0.7),
    uncertainty: clamp01(partial.uncertainty || 0.3),
    severity: partial.severity || "info",
    assumptions: partial.assumptions || [],
    limitations: partial.limitations || [],
    missing_inputs: partial.missing_inputs || [],
    proof_trace: partial.proof_trace || { mathematical_basis: [], calculation_steps: [], required_human_review: false }
  };
}

function holdResult(engineNum, engineCode, missingKeys) {
  return buildResult(engineNum, engineCode, {
    result: { missing_inputs: missingKeys },
    interpretation: "Calculation held. Missing inputs: " + missingKeys.join(", ") + ".",
    confidence: 0.1,
    uncertainty: 0.9,
    severity: "hold_for_input",
    missing_inputs: missingKeys,
    proof_trace: { mathematical_basis: [], calculation_steps: ["Input validation failed"], required_human_review: false, next_data_needed: missingKeys }
  });
}

// ============================================================
// 201 — BAYESIAN EVIDENCE
// ============================================================

function calcBayesianEvidence(inp) {
  var m = getMissing(inp, ["prior", "likelihood", "evidence_probability"]);
  if (m.length) return holdResult(201, "UNCERTAINTY_BAYES", m);
  var prior = num(inp.prior);
  var likelihood = num(inp.likelihood);
  var evProb = num(inp.evidence_probability);
  if (evProb === 0) return buildResult(201, "UNCERTAINTY_BAYES", { result: { posterior_probability: 0 }, interpretation: "Evidence probability is zero — posterior is zero.", confidence: 0.5, uncertainty: 0.5, severity: "medium" });
  var posterior = clamp01((likelihood * prior) / evProb);
  return buildResult(201, "UNCERTAINTY_BAYES", {
    result: { posterior_probability: posterior, prior: prior, likelihood: likelihood, evidence_probability: evProb },
    interpretation: "Posterior probability updated to " + (posterior * 100).toFixed(1) + "%.",
    confidence: 0.82, uncertainty: 1 - posterior,
    severity: posterior > 0.8 ? "high" : posterior > 0.5 ? "medium" : "low",
    assumptions: ["Evidence probability is estimated correctly", "Evidence is conditionally relevant to the hypothesis"],
    limitations: ["Bayesian output is only as reliable as priors and likelihoods"],
    proof_trace: { mathematical_basis: ["Bayes theorem"], calculation_steps: ["posterior = (" + likelihood + " * " + prior + ") / " + evProb + " = " + posterior], required_human_review: false }
  });
}

// ============================================================
// 211 — RELIABILITY + SURVIVAL (WEIBULL)
// ============================================================

function calcReliabilitySurvival(inp) {
  var m = getMissing(inp, ["t", "eta", "beta"]);
  if (m.length) return holdResult(211, "RELIABILITY_SURVIVAL", m);
  var t = num(inp.t), eta = num(inp.eta), beta = num(inp.beta);
  var R = Math.exp(-Math.pow(t / eta, beta));
  var h = (beta / eta) * Math.pow(t / eta, beta - 1);
  return buildResult(211, "RELIABILITY_SURVIVAL", {
    result: { reliability: R, failure_probability: 1 - R, hazard_rate: h },
    interpretation: "Weibull reliability is " + (R * 100).toFixed(1) + "%; failure probability is " + ((1 - R) * 100).toFixed(1) + "%.",
    confidence: 0.78, uncertainty: 0.22,
    severity: R < 0.5 ? "critical" : R < 0.75 ? "high" : R < 0.9 ? "medium" : "low",
    assumptions: ["Weibull distribution is appropriate for this failure mode"],
    limitations: ["Shape and scale parameters must be calibrated from field data"],
    proof_trace: { mathematical_basis: ["Weibull reliability", "hazard rate"], calculation_steps: ["R = exp(-(t/eta)^beta) = exp(-(" + t + "/" + eta + ")^" + beta + ") = " + R.toFixed(6)], required_human_review: R < 0.75 }
  });
}

// ============================================================
// 212 — MONTE CARLO SIMULATION
// ============================================================

function approximateNormal() {
  var u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function calcMonteCarlo(inp) {
  var m = getMissing(inp, ["mean", "std", "threshold"]);
  if (m.length) return holdResult(212, "MONTE_CARLO", m);
  var simCount = num(inp.simulations, 1000);
  var mean = num(inp.mean), std = num(inp.std), threshold = num(inp.threshold);
  var failures = 0;
  for (var i = 0; i < simCount; i++) {
    var sample = mean + std * approximateNormal();
    if (sample > threshold) failures++;
  }
  var pf = failures / simCount;
  return buildResult(212, "MONTE_CARLO", {
    result: { simulations: simCount, failures: failures, probability_exceedance: pf },
    interpretation: "Monte Carlo exceedance probability is " + (pf * 100).toFixed(1) + "% from " + simCount + " simulations.",
    confidence: simCount >= 5000 ? 0.85 : 0.72,
    uncertainty: Math.max(0.1, 1 / Math.sqrt(simCount)),
    severity: pf > 0.5 ? "critical" : pf > 0.2 ? "high" : pf > 0.05 ? "medium" : "low",
    assumptions: ["Normal distribution assumed for input uncertainty", "Independent samples"],
    limitations: ["Results vary between runs due to random sampling", "More simulations improve accuracy"],
    proof_trace: { mathematical_basis: ["Monte Carlo simulation", "Box-Muller transform"], calculation_steps: [failures + "/" + simCount + " exceeded threshold " + threshold], required_human_review: pf > 0.2 }
  });
}

// ============================================================
// 213 — MARKOV STATE TRANSITION
// ============================================================

function calcMarkovTransition(inp) {
  var state = inp.state_vector;
  var P = inp.transition_matrix;
  if (!Array.isArray(state) || !Array.isArray(P) || state.length === 0 || P.length === 0) {
    return holdResult(213, "MARKOV_TRANSITION", ["state_vector", "transition_matrix"]);
  }
  var next = [];
  for (var j = 0; j < P[0].length; j++) {
    var sum = 0;
    for (var i = 0; i < state.length; i++) {
      sum += Number(state[i]) * Number(P[i][j]);
    }
    next.push(sum);
  }
  var failedState = next[next.length - 1];
  return buildResult(213, "MARKOV_TRANSITION", {
    result: { current_state: state, next_state: next },
    interpretation: "Markov condition state advanced one step. Failed-state probability is " + (failedState * 100).toFixed(1) + "%.",
    confidence: 0.76, uncertainty: 0.24,
    severity: failedState > 0.3 ? "high" : failedState > 0.1 ? "medium" : "low",
    assumptions: ["Transition probabilities are stationary", "Markov property holds (memoryless)"],
    limitations: ["Does not capture time-varying degradation rates"],
    proof_trace: { mathematical_basis: ["Markov chains", "transition matrix multiplication"], calculation_steps: ["next_state = " + JSON.stringify(next)], required_human_review: false }
  });
}

// ============================================================
// 214 — KALMAN SENSOR FUSION
// ============================================================

function calcKalmanFusion(inp) {
  var m = getMissing(inp, ["estimate", "measurement", "estimate_variance", "measurement_variance"]);
  if (m.length) return holdResult(214, "SENSOR_FUSION_KALMAN", m);
  var x = num(inp.estimate), z = num(inp.measurement);
  var P = num(inp.estimate_variance), R = num(inp.measurement_variance);
  var K = P / (P + R);
  var updated = x + K * (z - x);
  var newVar = (1 - K) * P;
  return buildResult(214, "SENSOR_FUSION_KALMAN", {
    result: { kalman_gain: K, updated_estimate: updated, updated_variance: newVar, prior_estimate: x, measurement: z },
    interpretation: "Fused estimate is " + updated.toFixed(4) + " with Kalman gain " + K.toFixed(3) + ". Variance reduced from " + P.toFixed(4) + " to " + newVar.toFixed(4) + ".",
    confidence: clamp01(1 - newVar), uncertainty: clamp01(newVar),
    severity: "info",
    assumptions: ["Gaussian noise assumption", "Linear measurement model"],
    limitations: ["Nonlinear systems may require extended or unscented Kalman filter"],
    proof_trace: { mathematical_basis: ["Kalman filter update"], calculation_steps: ["K = " + P + "/(" + P + "+" + R + ") = " + K, "x_new = " + x + " + " + K + "*(" + z + "-" + x + ") = " + updated], required_human_review: false }
  });
}

// ============================================================
// 235 — MEASUREMENT UNCERTAINTY
// ============================================================

function calcMeasurementUncertainty(inp) {
  var components = inp.components;
  if (!Array.isArray(components) || components.length === 0) return holdResult(235, "MEASUREMENT_UNCERTAINTY", ["components"]);
  var sumSq = 0;
  for (var i = 0; i < components.length; i++) {
    var c = Number(components[i]);
    sumSq += c * c;
  }
  var combined = Math.sqrt(sumSq);
  var k = num(inp.k, 2);
  var expanded = k * combined;
  var measuredValue = num(inp.measured_value, null);
  var relUncertainty = measuredValue !== null && measuredValue !== 0 ? expanded / Math.abs(measuredValue) : null;
  return buildResult(235, "MEASUREMENT_UNCERTAINTY", {
    result: { combined_standard_uncertainty: combined, expanded_uncertainty: expanded, coverage_factor: k, relative_uncertainty: relUncertainty },
    interpretation: "Expanded measurement uncertainty is +/-" + expanded.toFixed(4) + " (k=" + k + ")." + (relUncertainty !== null ? " Relative uncertainty is " + (relUncertainty * 100).toFixed(1) + "%." : ""),
    confidence: 0.84, uncertainty: relUncertainty !== null ? clamp01(relUncertainty) : 0.2,
    severity: "info",
    assumptions: ["Components are independent and normally distributed", "Coverage factor k=" + k + " for ~95% confidence"],
    limitations: ["Does not account for systematic bias or correlation between components"],
    proof_trace: { mathematical_basis: ["root-sum-square uncertainty propagation", "GUM method"], calculation_steps: ["uc = sqrt(sum(ci^2)) = " + combined, "U = k*uc = " + k + "*" + combined + " = " + expanded], required_human_review: false }
  });
}

// ============================================================
// ENGINE MAP
// ============================================================

var ENGINE_MAP = {
  "201": calcBayesianEvidence,
  "211": calcReliabilitySurvival,
  "212": calcMonteCarlo,
  "213": calcMarkovTransition,
  "214": calcKalmanFusion,
  "235": calcMeasurementUncertainty,
  "UNCERTAINTY_BAYES": calcBayesianEvidence,
  "RELIABILITY_SURVIVAL": calcReliabilitySurvival,
  "MONTE_CARLO": calcMonteCarlo,
  "MARKOV_TRANSITION": calcMarkovTransition,
  "SENSOR_FUSION_KALMAN": calcKalmanFusion,
  "MEASUREMENT_UNCERTAINTY": calcMeasurementUncertainty
};

// ============================================================
// HANDLER
// ============================================================

function logRun(body, result) {
  try {
    var sb = createClient(supabaseUrl, supabaseKey);
    sb.from("advanced_math_engine_runs").insert({
      org_id: body.org_id || null,
      case_id: body.case_id || null,
      asset_id: body.asset_id || null,
      finding_id: body.finding_id || null,
      engine_number: result.engine_number,
      engine_code: result.engine_code,
      input_payload: body.inputs || body.input || {},
      output_payload: result.result,
      confidence: result.confidence,
      uncertainty: result.uncertainty,
      severity: result.severity,
      assumptions: result.assumptions,
      limitations: result.limitations,
      missing_inputs: result.missing_inputs,
      proof_trace: result.proof_trace
    });
  } catch (e) {}
}

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };
  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";

    if (action === "get_registry") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
        engine: ENGINE_ID, version: ENGINE_VERSION, deploy: DEPLOY,
        mode: "deterministic",
        purpose: "Advanced Probability Engine — Bayesian evidence, Weibull reliability, Monte Carlo, Markov transitions, Kalman fusion, measurement uncertainty",
        sub_engines: [201, 211, 212, 213, 214, 235],
        actions: ["run_engine", "get_registry"]
      }) };
    }

    if (action === "run_engine") {
      var engineKey = String(body.engine_number || body.engine_code || "");
      var fn = ENGINE_MAP[engineKey];
      if (!fn) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown sub-engine: " + engineKey + ". Available: 201, 211, 212, 213, 214, 235" }) };
      var inputs = body.inputs || body.input || {};
      var result = fn(inputs);
      logRun(body, result);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: result }, null, 2) };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
