// @ts-nocheck
/**
 * DEPLOY309 - advanced-decision-engine.ts
 * netlify/functions/advanced-decision-engine.ts
 *
 * ADVANCED DECISION ENGINE — ENGINE 99
 *
 * Sub-engines 205, 206, 208, 218, 219, 220, 221, 222, 234, 236, 237, 239:
 *   205 - Inspection Optimization (cost-benefit inspection interval)
 *   206 - Information Gain Router (entropy-based sensor value)
 *   208 - Causal Root Cause (weighted cause scoring)
 *   218 - Dimensional Scaling (Buckingham Pi theorem)
 *   219 - Optimization Under Uncertainty (robust objective)
 *   220 - Decision Utility (expected utility with risk aversion)
 *   221 - Signal Spectral (FFT peak frequency extraction)
 *   222 - Inverse Problem (Tikhonov regularized least squares)
 *   234 - Human Factors Risk (composite human error probability)
 *   236 - Code Constraint Math (utilization ratio against code limit)
 *   237 - Economic Optimization (NPV of maintenance strategy)
 *   239 - Adversarial Proof (contradiction-based safety claim)
 *
 * POST /api/advanced-decision-engine
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var ENGINE_ID = "advanced-decision-engine";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY309";
var corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };

function num(v, fallback) { var n = Number(v); if (v === undefined || v === null || v === "" || isNaN(n)) return fallback !== undefined ? fallback : null; return n; }
function getMissing(inp, keys) { var m = []; for (var i = 0; i < keys.length; i++) { if (inp[keys[i]] === undefined || inp[keys[i]] === null || inp[keys[i]] === "") m.push(keys[i]); } return m; }
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

function buildResult(engineNum, engineCode, partial) {
  return { engine_number: engineNum, engine_code: engineCode, result: partial.result || {}, interpretation: partial.interpretation || "", confidence: clamp01(partial.confidence || 0.7), uncertainty: clamp01(partial.uncertainty || 0.3), severity: partial.severity || "info", assumptions: partial.assumptions || [], limitations: partial.limitations || [], missing_inputs: partial.missing_inputs || [], proof_trace: partial.proof_trace || { mathematical_basis: [], calculation_steps: [], required_human_review: false } };
}

function holdResult(engineNum, engineCode, m) {
  return buildResult(engineNum, engineCode, { result: { missing_inputs: m }, interpretation: "Calculation held. Missing: " + m.join(", ") + ".", confidence: 0.1, uncertainty: 0.9, severity: "hold_for_input", missing_inputs: m, proof_trace: { mathematical_basis: [], calculation_steps: ["Input validation failed"], required_human_review: false, next_data_needed: m } });
}

// ============================================================
// 205 — INSPECTION OPTIMIZATION
// ============================================================

function calcInspectionOptimization(inp) {
  var m = getMissing(inp, ["failure_cost", "inspection_cost", "failure_rate"]);
  if (m.length) return holdResult(205, "INSPECTION_OPTIMIZATION", m);
  var Cf = num(inp.failure_cost), Ci = num(inp.inspection_cost), lambda = num(inp.failure_rate);
  // Optimal inspection interval: T* = sqrt(2*Ci / (lambda*Cf))
  var Topt = Math.sqrt(2 * Ci / (lambda * Cf));
  var annualCost = Ci / Topt + lambda * Cf * Topt / 2;
  return buildResult(205, "INSPECTION_OPTIMIZATION", {
    result: { optimal_interval: Topt, annual_expected_cost: annualCost, failure_cost: Cf, inspection_cost: Ci, failure_rate: lambda },
    interpretation: "Optimal inspection interval is " + Topt.toFixed(2) + " time units. Expected annual cost is " + annualCost.toFixed(2) + ".",
    confidence: 0.76, uncertainty: 0.24,
    severity: Topt < 1 ? "high" : Topt < 5 ? "medium" : "low",
    assumptions: ["Constant failure rate (exponential model)", "Inspection perfectly detects incipient failure"],
    limitations: ["Does not account for imperfect inspection or age-dependent failure rates"],
    proof_trace: { mathematical_basis: ["optimal inspection interval", "cost minimization"], calculation_steps: ["Topt = sqrt(2*" + Ci + "/(" + lambda + "*" + Cf + ")) = " + Topt.toFixed(4), "annualCost = " + Ci + "/" + Topt.toFixed(4) + " + " + lambda + "*" + Cf + "*" + Topt.toFixed(4) + "/2 = " + annualCost.toFixed(4)], required_human_review: false }
  });
}

// ============================================================
// 206 — INFORMATION GAIN ROUTER
// ============================================================

function calcInformationGain(inp) {
  var probs = inp.prior_probabilities;
  if (!Array.isArray(probs) || probs.length === 0) return holdResult(206, "INFORMATION_GAIN", ["prior_probabilities"]);
  // Shannon entropy: H = -sum(p * log2(p))
  var H = 0;
  for (var i = 0; i < probs.length; i++) {
    var p = Number(probs[i]);
    if (p > 0) H -= p * (Math.log(p) / Math.log(2));
  }
  var maxEntropy = Math.log(probs.length) / Math.log(2);
  var normalizedEntropy = maxEntropy > 0 ? H / maxEntropy : 0;
  // If posterior_probabilities provided, compute information gain
  var posteriors = inp.posterior_probabilities;
  var gain = null;
  if (Array.isArray(posteriors) && posteriors.length === probs.length) {
    var Hp = 0;
    for (var i = 0; i < posteriors.length; i++) {
      var pp = Number(posteriors[i]);
      if (pp > 0) Hp -= pp * (Math.log(pp) / Math.log(2));
    }
    gain = H - Hp;
  }
  return buildResult(206, "INFORMATION_GAIN", {
    result: { prior_entropy: H, max_entropy: maxEntropy, normalized_entropy: normalizedEntropy, information_gain: gain },
    interpretation: "Prior entropy is " + H.toFixed(4) + " bits (max " + maxEntropy.toFixed(4) + ")." + (gain !== null ? " Information gain from measurement is " + gain.toFixed(4) + " bits." : " Provide posterior_probabilities to compute information gain."),
    confidence: 0.8, uncertainty: 0.2,
    severity: normalizedEntropy > 0.8 ? "high" : normalizedEntropy > 0.5 ? "medium" : "low",
    assumptions: ["Probabilities sum to 1 and represent mutually exclusive hypotheses"],
    limitations: ["Shannon entropy assumes discrete probability distribution"],
    proof_trace: { mathematical_basis: ["Shannon entropy", "information gain"], calculation_steps: ["H = -sum(p*log2(p)) = " + H.toFixed(6), "maxH = log2(" + probs.length + ") = " + maxEntropy.toFixed(6)].concat(gain !== null ? ["gain = " + H.toFixed(6) + " - Hp = " + gain.toFixed(6)] : []), required_human_review: false }
  });
}

// ============================================================
// 208 — CAUSAL ROOT CAUSE
// ============================================================

function calcCausalRootCause(inp) {
  var causes = inp.causes;
  if (!Array.isArray(causes) || causes.length === 0) return holdResult(208, "CAUSAL_ROOT_CAUSE", ["causes"]);
  // Each cause: { name, probability, evidence_strength }
  var totalScore = 0;
  var scored = [];
  for (var i = 0; i < causes.length; i++) {
    var c = causes[i];
    var prob = num(c.probability, 0.5);
    var evidence = num(c.evidence_strength, 0.5);
    var score = prob * evidence;
    scored.push({ name: c.name || ("Cause_" + i), probability: prob, evidence_strength: evidence, score: score });
    totalScore += score;
  }
  // Normalize and rank
  for (var i = 0; i < scored.length; i++) {
    scored[i].normalized_score = totalScore > 0 ? scored[i].score / totalScore : 0;
  }
  // Sort by score descending
  scored.sort(function(a, b) { return b.score - a.score; });
  var topCause = scored[0];
  return buildResult(208, "CAUSAL_ROOT_CAUSE", {
    result: { ranked_causes: scored, top_cause: topCause.name, top_score: topCause.normalized_score },
    interpretation: "Top root cause is '" + topCause.name + "' with normalized score " + (topCause.normalized_score * 100).toFixed(1) + "%. " + scored.length + " causes evaluated.",
    confidence: topCause.normalized_score > 0.5 ? 0.8 : 0.6,
    uncertainty: 1 - topCause.normalized_score,
    severity: topCause.normalized_score > 0.6 ? "high" : "medium",
    assumptions: ["Cause probabilities and evidence strengths are independently estimated", "Causes are approximately independent"],
    limitations: ["Does not model causal interactions or confounding", "Bayesian network would provide more rigorous inference"],
    proof_trace: { mathematical_basis: ["weighted cause scoring", "probability-evidence product"], calculation_steps: scored.map(function(s) { return s.name + ": " + s.probability + "*" + s.evidence_strength + "=" + s.score.toFixed(4) + " (norm=" + s.normalized_score.toFixed(4) + ")"; }), required_human_review: true }
  });
}

// ============================================================
// 218 — DIMENSIONAL SCALING (BUCKINGHAM PI)
// ============================================================

function calcDimensionalScaling(inp) {
  var m = getMissing(inp, ["model_value", "scale_ratio", "exponent"]);
  if (m.length) return holdResult(218, "DIMENSIONAL_SCALING", m);
  var modelVal = num(inp.model_value), scaleRatio = num(inp.scale_ratio), exponent = num(inp.exponent);
  var fullScale = modelVal * Math.pow(scaleRatio, exponent);
  return buildResult(218, "DIMENSIONAL_SCALING", {
    result: { full_scale_value: fullScale, model_value: modelVal, scale_ratio: scaleRatio, exponent: exponent },
    interpretation: "Full-scale value is " + fullScale.toFixed(4) + " (model=" + modelVal + ", ratio=" + scaleRatio + ", exponent=" + exponent + ").",
    confidence: 0.72, uncertainty: 0.28, severity: "info",
    assumptions: ["Buckingham Pi scaling applies to this physical phenomenon", "Scale ratio and exponent are correct for the governing dimensionless group"],
    limitations: ["Reynolds number or other similitude parameters may not match at different scales"],
    proof_trace: { mathematical_basis: ["Buckingham Pi theorem", "dimensional analysis"], calculation_steps: ["fullScale = " + modelVal + " * " + scaleRatio + "^" + exponent + " = " + fullScale.toFixed(6)], required_human_review: false }
  });
}

// ============================================================
// 219 — OPTIMIZATION UNDER UNCERTAINTY
// ============================================================

function calcOptimizationUncertainty(inp) {
  var m = getMissing(inp, ["objective_mean", "objective_std", "risk_tolerance"]);
  if (m.length) return holdResult(219, "OPTIMIZATION_UNCERTAINTY", m);
  var mean = num(inp.objective_mean), std = num(inp.objective_std), alpha = num(inp.risk_tolerance);
  // Robust objective: J = mean + alpha * std (penalize uncertainty)
  var robust = mean + alpha * std;
  // Value-at-risk style: worst case at given percentile
  var percentile = num(inp.percentile, 0.95);
  var zScore = percentile >= 0.99 ? 2.326 : percentile >= 0.975 ? 1.96 : percentile >= 0.95 ? 1.645 : percentile >= 0.9 ? 1.282 : 1.0;
  var worstCase = mean + zScore * std;
  return buildResult(219, "OPTIMIZATION_UNCERTAINTY", {
    result: { robust_objective: robust, worst_case_value: worstCase, percentile: percentile, z_score: zScore },
    interpretation: "Robust objective (mean + " + alpha + "*std) is " + robust.toFixed(4) + ". Worst-case at " + (percentile * 100).toFixed(0) + "th percentile is " + worstCase.toFixed(4) + ".",
    confidence: 0.74, uncertainty: 0.26, severity: alpha > 2 ? "high" : "medium",
    assumptions: ["Objective is approximately normally distributed", "Risk tolerance parameter reflects decision-maker preference"],
    limitations: ["Gaussian assumption may not capture tail risks", "Multi-objective problems require Pareto analysis"],
    proof_trace: { mathematical_basis: ["robust optimization", "mean-variance framework"], calculation_steps: ["robust = " + mean + " + " + alpha + "*" + std + " = " + robust.toFixed(6), "worstCase = " + mean + " + " + zScore + "*" + std + " = " + worstCase.toFixed(6)], required_human_review: false }
  });
}

// ============================================================
// 220 — DECISION UTILITY
// ============================================================

function calcDecisionUtility(inp) {
  var options = inp.options;
  if (!Array.isArray(options) || options.length === 0) return holdResult(220, "DECISION_UTILITY", ["options"]);
  // Each option: { name, outcomes: [{ probability, value }] }
  var riskAversion = num(inp.risk_aversion, 1.0);
  var evaluated = [];
  for (var i = 0; i < options.length; i++) {
    var opt = options[i];
    var outcomes = opt.outcomes;
    if (!Array.isArray(outcomes)) continue;
    var eu = 0;
    for (var j = 0; j < outcomes.length; j++) {
      var p = num(outcomes[j].probability, 0);
      var v = num(outcomes[j].value, 0);
      // CARA utility: u(v) = 1 - exp(-riskAversion * v) for risk_aversion > 0
      var utility = riskAversion > 0 ? (1 - Math.exp(-riskAversion * v)) : v;
      eu += p * utility;
    }
    evaluated.push({ name: opt.name || ("Option_" + i), expected_utility: eu });
  }
  evaluated.sort(function(a, b) { return b.expected_utility - a.expected_utility; });
  var best = evaluated.length > 0 ? evaluated[0] : { name: "none", expected_utility: 0 };
  return buildResult(220, "DECISION_UTILITY", {
    result: { ranked_options: evaluated, best_option: best.name, best_utility: best.expected_utility },
    interpretation: "Best option is '" + best.name + "' with expected utility " + best.expected_utility.toFixed(4) + ". " + evaluated.length + " options evaluated.",
    confidence: 0.76, uncertainty: 0.24,
    severity: "info",
    assumptions: ["Outcome probabilities sum to 1 for each option", "CARA utility function with risk_aversion=" + riskAversion],
    limitations: ["Does not model option interdependencies or sequential decisions"],
    proof_trace: { mathematical_basis: ["expected utility theory", "CARA utility function"], calculation_steps: evaluated.map(function(e) { return e.name + ": EU=" + e.expected_utility.toFixed(6); }), required_human_review: true }
  });
}

// ============================================================
// 221 — SIGNAL SPECTRAL (FFT PEAK FREQUENCY)
// ============================================================

function calcSignalSpectral(inp) {
  var signal = inp.signal;
  var sampleRate = num(inp.sample_rate, null);
  if (!Array.isArray(signal) || signal.length < 4 || sampleRate === null) {
    return holdResult(221, "SIGNAL_SPECTRAL", ["signal", "sample_rate"]);
  }
  // Simplified DFT for peak frequency detection (not full FFT for portability)
  var N = signal.length;
  var halfN = Math.floor(N / 2);
  var magnitudes = [];
  for (var k = 1; k <= halfN; k++) {
    var re = 0, im = 0;
    for (var n = 0; n < N; n++) {
      var angle = 2 * Math.PI * k * n / N;
      re += Number(signal[n]) * Math.cos(angle);
      im -= Number(signal[n]) * Math.sin(angle);
    }
    magnitudes.push({ bin: k, magnitude: Math.sqrt(re * re + im * im) / N, frequency: k * sampleRate / N });
  }
  // Find peak
  var peak = magnitudes[0];
  for (var i = 1; i < magnitudes.length; i++) {
    if (magnitudes[i].magnitude > peak.magnitude) peak = magnitudes[i];
  }
  // Top 3 peaks
  magnitudes.sort(function(a, b) { return b.magnitude - a.magnitude; });
  var topPeaks = magnitudes.slice(0, Math.min(3, magnitudes.length));
  return buildResult(221, "SIGNAL_SPECTRAL", {
    result: { peak_frequency: peak.frequency, peak_magnitude: peak.magnitude, top_peaks: topPeaks, signal_length: N, sample_rate: sampleRate },
    interpretation: "Dominant frequency is " + peak.frequency.toFixed(3) + " Hz with magnitude " + peak.magnitude.toFixed(4) + ". " + N + " samples at " + sampleRate + " Hz sample rate.",
    confidence: N >= 64 ? 0.8 : 0.65, uncertainty: N >= 64 ? 0.2 : 0.35,
    severity: "info",
    assumptions: ["Signal is stationary over analysis window", "Sample rate satisfies Nyquist criterion"],
    limitations: ["Simplified DFT — for large signals a proper FFT library is recommended", "Spectral leakage not windowed"],
    proof_trace: { mathematical_basis: ["discrete Fourier transform", "spectral analysis"], calculation_steps: ["N=" + N, "peakBin=" + peak.bin, "peakFreq=" + peak.frequency.toFixed(4) + " Hz"], required_human_review: false }
  });
}

// ============================================================
// 222 — INVERSE PROBLEM (TIKHONOV REGULARIZATION)
// ============================================================

function calcInverseProblem(inp) {
  var m = getMissing(inp, ["measured", "predicted", "lambda"]);
  if (m.length) return holdResult(222, "INVERSE_PROBLEM", m);
  var measured = inp.measured;
  var predicted = inp.predicted;
  if (!Array.isArray(measured) || !Array.isArray(predicted) || measured.length !== predicted.length) {
    return holdResult(222, "INVERSE_PROBLEM", ["measured", "predicted"]);
  }
  var lambda = num(inp.lambda);
  var n = measured.length;
  // Tikhonov solution for scalar parameter: minimize ||measured - a*predicted||^2 + lambda*a^2
  // Analytical: a = sum(m_i * p_i) / (sum(p_i^2) + lambda)
  var sumMP = 0, sumP2 = 0, sumResidual = 0;
  for (var i = 0; i < n; i++) {
    var mi = Number(measured[i]), pi = Number(predicted[i]);
    sumMP += mi * pi;
    sumP2 += pi * pi;
  }
  var a = (sumP2 + lambda) > 0 ? sumMP / (sumP2 + lambda) : 0;
  // Residual
  for (var i = 0; i < n; i++) {
    var res = Number(measured[i]) - a * Number(predicted[i]);
    sumResidual += res * res;
  }
  var rmse = Math.sqrt(sumResidual / n);
  return buildResult(222, "INVERSE_PROBLEM", {
    result: { estimated_parameter: a, regularization_lambda: lambda, rmse: rmse, data_points: n },
    interpretation: "Tikhonov estimated parameter is " + a.toFixed(6) + " (lambda=" + lambda + "). RMSE is " + rmse.toFixed(4) + ".",
    confidence: rmse < 0.1 ? 0.82 : rmse < 1.0 ? 0.7 : 0.55,
    uncertainty: clamp01(rmse),
    severity: "info",
    assumptions: ["Linear forward model with scalar parameter", "Tikhonov L2 regularization is appropriate"],
    limitations: ["Only estimates a single scalar parameter", "For matrix problems, use proper numerical linear algebra"],
    proof_trace: { mathematical_basis: ["Tikhonov regularization", "least squares with penalty"], calculation_steps: ["a = sum(m*p)/(sum(p^2)+lambda) = " + sumMP.toFixed(4) + "/(" + sumP2.toFixed(4) + "+" + lambda + ") = " + a.toFixed(6), "RMSE = " + rmse.toFixed(6)], required_human_review: false }
  });
}

// ============================================================
// 234 — HUMAN FACTORS RISK
// ============================================================

function calcHumanFactors(inp) {
  var factors = inp.factors;
  if (!Array.isArray(factors) || factors.length === 0) return holdResult(234, "HUMAN_FACTORS_RISK", ["factors"]);
  // Each factor: { name, base_error_rate, psf (performance shaping factor) }
  var compositeHEP = 1.0;
  var details = [];
  for (var i = 0; i < factors.length; i++) {
    var f = factors[i];
    var baseRate = num(f.base_error_rate, 0.01);
    var psf = num(f.psf, 1.0);
    var adjusted = clamp01(baseRate * psf);
    compositeHEP *= (1 - adjusted);
    details.push({ name: f.name || ("Factor_" + i), base_error_rate: baseRate, psf: psf, adjusted_error_rate: adjusted });
  }
  compositeHEP = 1 - compositeHEP; // P(at least one error)
  return buildResult(234, "HUMAN_FACTORS_RISK", {
    result: { composite_hep: compositeHEP, factor_details: details },
    interpretation: "Composite human error probability is " + (compositeHEP * 100).toFixed(2) + "%. " + factors.length + " factors evaluated.",
    confidence: 0.68, uncertainty: 0.32,
    severity: compositeHEP > 0.1 ? "critical" : compositeHEP > 0.05 ? "high" : compositeHEP > 0.01 ? "medium" : "low",
    assumptions: ["Error events are independent", "Performance shaping factors are multiplicative"],
    limitations: ["Does not model error recovery or dependent errors", "PSFs should be calibrated from domain-specific HRA data"],
    proof_trace: { mathematical_basis: ["human reliability analysis", "performance shaping factors"], calculation_steps: details.map(function(d) { return d.name + ": " + d.base_error_rate + "*" + d.psf + "=" + d.adjusted_error_rate.toFixed(6); }).concat(["compositeHEP = 1 - prod(1 - adjusted_i) = " + compositeHEP.toFixed(6)]), required_human_review: compositeHEP > 0.05 }
  });
}

// ============================================================
// 236 — CODE CONSTRAINT MATH
// ============================================================

function calcCodeConstraint(inp) {
  var m = getMissing(inp, ["actual_value", "code_limit"]);
  if (m.length) return holdResult(236, "CODE_CONSTRAINT", m);
  var actual = num(inp.actual_value), limit = num(inp.code_limit);
  var safetyFactor = num(inp.safety_factor, 1.0);
  var effectiveLimit = limit / safetyFactor;
  var utilization = effectiveLimit > 0 ? actual / effectiveLimit : 0;
  var passes = utilization <= 1.0;
  return buildResult(236, "CODE_CONSTRAINT", {
    result: { utilization_ratio: utilization, passes_code: passes, actual_value: actual, code_limit: limit, effective_limit: effectiveLimit, safety_factor: safetyFactor },
    interpretation: "Utilization ratio is " + (utilization * 100).toFixed(1) + "%. " + (passes ? "PASSES code constraint." : "FAILS code constraint — actual exceeds effective limit."),
    confidence: 0.9, uncertainty: 0.1,
    severity: !passes ? "critical" : utilization > 0.9 ? "high" : utilization > 0.75 ? "medium" : "low",
    assumptions: ["Code limit and safety factor are correctly specified", "Linear comparison is appropriate"],
    limitations: ["Does not interpret specific code clauses or interaction effects"],
    proof_trace: { mathematical_basis: ["code compliance check", "utilization ratio"], calculation_steps: ["effectiveLimit = " + limit + "/" + safetyFactor + " = " + effectiveLimit.toFixed(4), "utilization = " + actual + "/" + effectiveLimit.toFixed(4) + " = " + utilization.toFixed(4), passes ? "PASS" : "FAIL"], required_human_review: !passes || utilization > 0.9 }
  });
}

// ============================================================
// 237 — ECONOMIC OPTIMIZATION (NPV)
// ============================================================

function calcEconomicOptimization(inp) {
  var cashflows = inp.cashflows;
  var discountRate = num(inp.discount_rate, null);
  if (!Array.isArray(cashflows) || cashflows.length === 0 || discountRate === null) {
    return holdResult(237, "ECONOMIC_OPTIMIZATION", ["cashflows", "discount_rate"]);
  }
  var npv = 0;
  var steps = [];
  for (var i = 0; i < cashflows.length; i++) {
    var cf = Number(cashflows[i]);
    var pv = cf / Math.pow(1 + discountRate, i);
    npv += pv;
    steps.push("CF[" + i + "]=" + cf + " PV=" + pv.toFixed(2));
  }
  // Internal rate of return approximation via bisection (simplified)
  var irrLow = -0.5, irrHigh = 5.0;
  for (var iter = 0; iter < 50; iter++) {
    var irrMid = (irrLow + irrHigh) / 2;
    var npvMid = 0;
    for (var i = 0; i < cashflows.length; i++) {
      npvMid += Number(cashflows[i]) / Math.pow(1 + irrMid, i);
    }
    if (npvMid > 0) irrLow = irrMid;
    else irrHigh = irrMid;
  }
  var irr = (irrLow + irrHigh) / 2;
  return buildResult(237, "ECONOMIC_OPTIMIZATION", {
    result: { npv: npv, irr: irr, discount_rate: discountRate, periods: cashflows.length },
    interpretation: "NPV is " + npv.toFixed(2) + " at discount rate " + (discountRate * 100).toFixed(1) + "%. Estimated IRR is " + (irr * 100).toFixed(2) + "%.",
    confidence: 0.8, uncertainty: 0.2,
    severity: npv < 0 ? "high" : "low",
    assumptions: ["Cash flows occur at regular intervals", "Discount rate is constant"],
    limitations: ["IRR approximated via bisection — may not converge for non-standard cash flow patterns"],
    proof_trace: { mathematical_basis: ["net present value", "internal rate of return"], calculation_steps: steps.concat(["NPV = " + npv.toFixed(4), "IRR ~ " + (irr * 100).toFixed(4) + "%"]), required_human_review: false }
  });
}

// ============================================================
// 239 — ADVERSARIAL PROOF (CONTRADICTION-BASED SAFETY CLAIM)
// ============================================================

function calcAdversarialProof(inp) {
  var claim = inp.claim || "";
  var conditions = inp.conditions;
  if (!claim || !Array.isArray(conditions) || conditions.length === 0) {
    return holdResult(239, "ADVERSARIAL_PROOF", ["claim", "conditions"]);
  }
  // Each condition: { description, satisfied: boolean, criticality: "high"|"medium"|"low" }
  var violations = [];
  var satisfied = [];
  for (var i = 0; i < conditions.length; i++) {
    var c = conditions[i];
    if (c.satisfied === false || c.satisfied === "false") {
      violations.push({ description: c.description || ("Condition_" + i), criticality: c.criticality || "medium" });
    } else {
      satisfied.push({ description: c.description || ("Condition_" + i) });
    }
  }
  var hasCritical = false;
  for (var i = 0; i < violations.length; i++) {
    if (violations[i].criticality === "high" || violations[i].criticality === "critical") hasCritical = true;
  }
  var claimHolds = violations.length === 0;
  return buildResult(239, "ADVERSARIAL_PROOF", {
    result: { claim: claim, claim_holds: claimHolds, violations: violations, satisfied_conditions: satisfied.length, total_conditions: conditions.length },
    interpretation: claimHolds ? "Safety claim '" + claim + "' holds — all " + conditions.length + " conditions satisfied." : "Safety claim '" + claim + "' is CONTRADICTED — " + violations.length + " of " + conditions.length + " conditions violated." + (hasCritical ? " CRITICAL violation(s) present." : ""),
    confidence: claimHolds ? 0.85 : 0.9,
    uncertainty: claimHolds ? 0.15 : 0.1,
    severity: hasCritical ? "critical" : violations.length > 0 ? "high" : "low",
    assumptions: ["Conditions are exhaustive for the safety claim", "Condition satisfaction is correctly determined"],
    limitations: ["Does not perform formal theorem proving", "Adversarial testing scope limited to provided conditions"],
    proof_trace: { mathematical_basis: ["proof by contradiction", "safety case argumentation"], calculation_steps: ["claim: " + claim, "total conditions: " + conditions.length, "satisfied: " + satisfied.length, "violations: " + violations.length].concat(violations.map(function(v) { return "VIOLATION [" + v.criticality + "]: " + v.description; })), required_human_review: true }
  });
}

// ============================================================
// ENGINE MAP
// ============================================================

var ENGINE_MAP = {
  "205": calcInspectionOptimization, "INSPECTION_OPTIMIZATION": calcInspectionOptimization,
  "206": calcInformationGain, "INFORMATION_GAIN": calcInformationGain,
  "208": calcCausalRootCause, "CAUSAL_ROOT_CAUSE": calcCausalRootCause,
  "218": calcDimensionalScaling, "DIMENSIONAL_SCALING": calcDimensionalScaling,
  "219": calcOptimizationUncertainty, "OPTIMIZATION_UNCERTAINTY": calcOptimizationUncertainty,
  "220": calcDecisionUtility, "DECISION_UTILITY": calcDecisionUtility,
  "221": calcSignalSpectral, "SIGNAL_SPECTRAL": calcSignalSpectral,
  "222": calcInverseProblem, "INVERSE_PROBLEM": calcInverseProblem,
  "234": calcHumanFactors, "HUMAN_FACTORS_RISK": calcHumanFactors,
  "236": calcCodeConstraint, "CODE_CONSTRAINT": calcCodeConstraint,
  "237": calcEconomicOptimization, "ECONOMIC_OPTIMIZATION": calcEconomicOptimization,
  "239": calcAdversarialProof, "ADVERSARIAL_PROOF": calcAdversarialProof
};

function logRun(body, result) { try { var sb = createClient(supabaseUrl, supabaseKey); sb.from("advanced_math_engine_runs").insert({ org_id: body.org_id || null, case_id: body.case_id || null, asset_id: body.asset_id || null, finding_id: body.finding_id || null, engine_number: result.engine_number, engine_code: result.engine_code, input_payload: body.inputs || body.input || {}, output_payload: result.result, confidence: result.confidence, uncertainty: result.uncertainty, severity: result.severity, assumptions: result.assumptions, limitations: result.limitations, missing_inputs: result.missing_inputs, proof_trace: result.proof_trace }); } catch (e) {} }

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };
  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";
    if (action === "get_registry") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, deploy: DEPLOY, mode: "deterministic", purpose: "Advanced Decision Engine — inspection optimization, information gain, causal root cause, dimensional scaling, optimization under uncertainty, decision utility, signal spectral, inverse problem, human factors, code constraint, economic optimization, adversarial proof", sub_engines: [205, 206, 208, 218, 219, 220, 221, 222, 234, 236, 237, 239], actions: ["run_engine", "get_registry"] }) };
    }
    if (action === "run_engine") {
      var engineKey = String(body.engine_number || body.engine_code || "");
      var fn = ENGINE_MAP[engineKey];
      if (!fn) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown sub-engine: " + engineKey + ". Available: 205, 206, 208, 218, 219, 220, 221, 222, 234, 236, 237, 239" }) };
      var inputs = body.inputs || body.input || {};
      var result = fn(inputs);
      logRun(body, result);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: result }, null, 2) };
    }
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
  } catch (err) { return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) }; }
};
