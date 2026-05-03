// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var supabase = createClient(supabaseUrl, supabaseKey);

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "run_full";
    var result = {};

    if (action === "get_registry") {
      result = getRegistry();
    } else if (action === "run_full") {
      result = await runFull(body);
    } else if (action === "run_monte_carlo") {
      result = await runMonteCarlo(body);
    } else if (action === "run_survival") {
      result = runSurvival(body);
    } else if (action === "run_classification") {
      result = runClassification(body);
    } else if (action === "weibull_analysis") {
      result = weibullAnalysis(body);
    } else if (action === "lognormal_analysis") {
      result = lognormalAnalysis(body);
    } else if (action === "exponential_analysis") {
      result = exponentialAnalysis(body);
    } else if (action === "remaining_life_distribution") {
      result = remainingLifeDistribution(body);
    } else if (action === "sensitivity_analysis") {
      result = await sensitivityAnalysis(body);
    } else if (action === "compare_models") {
      result = compareModels(body);
    } else if (action === "get_proof_trace") {
      result = getProofTrace();
    } else {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Unknown action: " + action })
      };
    }

    var dbError = null;
    try {
      var now = new Date().toISOString();
      var insertResult = await supabase
        .from("uncertainty_reliability_runs")
        .insert({
          action: action,
          input_data: body,
          result_data: result,
          created_at: now
        });
      if (insertResult.error) {
        dbError = insertResult.error.message;
      }
    } catch (dbEx) {
      dbError = String(dbEx);
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: result,
        db_logged: dbError === null,
        db_error: dbError
      })
    };
  } catch (err) {
    var errMsg = err instanceof Error ? err.message : String(err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: errMsg })
    };
  }
};

function getRegistry() {
  return {
    engine: "uncertainty-reliability-core",
    version: "URC-1.0.0",
    deploy: "DEPLOY351",
    supported_models: [
      "WEIBULL",
      "EXPONENTIAL",
      "LOGNORMAL",
      "BAYESIAN_WEIBULL"
    ],
    distribution_types: [
      "NORMAL",
      "LOGNORMAL",
      "TRIANGULAR",
      "UNIFORM",
      "WEIBULL",
      "FIXED"
    ],
    reliability_classes: [
      "LOW_RISK",
      "ROUTINE_MONITORING",
      "MONITOR",
      "INCREASE_INSPECTION",
      "ENGINEERING_REVIEW",
      "REPAIR_REPLACE",
      "HOLD_FOR_INPUT"
    ],
    actions: [
      "get_registry",
      "run_full",
      "run_monte_carlo",
      "run_survival",
      "run_classification",
      "weibull_analysis",
      "lognormal_analysis",
      "exponential_analysis",
      "remaining_life_distribution",
      "sensitivity_analysis",
      "compare_models",
      "get_proof_trace"
    ]
  };
}

function sampleBoxMuller() {
  var u1 = Math.random();
  var u2 = Math.random();
  var z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z0;
}

function sampleDistribution(distType, params) {
  if (distType === "FIXED") {
    return params.value;
  } else if (distType === "NORMAL") {
    var z = sampleBoxMuller();
    return params.mean + params.sd * z;
  } else if (distType === "LOGNORMAL") {
    var z = sampleBoxMuller();
    return Math.exp(params.mu + params.sigma * z);
  } else if (distType === "UNIFORM") {
    return params.min + Math.random() * (params.max - params.min);
  } else if (distType === "TRIANGULAR") {
    var u = Math.random();
    var mode = params.mode;
    var min = params.min;
    var max = params.max;
    var modePos = (mode - min) / (max - min);
    if (u < modePos) {
      return min + Math.sqrt(u * modePos * (max - min) * (mode - min));
    } else {
      return max - Math.sqrt((1 - u) * (1 - modePos) * (max - min) * (max - mode));
    }
  } else if (distType === "WEIBULL") {
    var u = Math.random();
    return params.scale * Math.pow(-Math.log(1 - u), 1 / params.shape);
  }
  return 0;
}

async function callEngine(engineName, payload) {
  var baseUrl = process.env.URL || process.env.DEPLOY_URL || "";
  if (!baseUrl) {
    throw new Error("DEPLOY_URL environment variable not set");
  }
  var url = baseUrl + "/.netlify/functions/" + engineName;
  var response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  var data = await response.json();
  return data.data || data;
}

async function runMonteCarlo(input) {
  var engineName = input.engine_name || "";
  var enginePayload = input.engine_payload || {};
  var iterations = input.iterations || 1000;
  var inputDistributions = input.input_distributions || [];

  var proofTrace = [];
  proofTrace.push({
    step: "MONTE_CARLO_INITIALIZATION",
    input: {
      engine: engineName,
      iterations: iterations,
      distributions_count: inputDistributions.length
    },
    rationale: "Beginning Monte Carlo uncertainty propagation"
  });

  var samples = [];
  var outputs = [];

  for (var i = 0; i < iterations; i++) {
    var sampledPayload = JSON.parse(JSON.stringify(enginePayload));

    for (var j = 0; j < inputDistributions.length; j++) {
      var dist = inputDistributions[j];
      var sampledValue = sampleDistribution(dist.distribution_type, dist.params);
      sampledPayload[dist.parameter_name] = sampledValue;
    }

    var engineResult = {};
    try {
      engineResult = await callEngine(engineName, sampledPayload);
    } catch (e) {
      engineResult = { error: String(e) };
    }

    samples.push(sampledPayload);
    outputs.push(engineResult);
  }

  var outputValues = [];
  for (var k = 0; k < outputs.length; k++) {
    var val = outputs[k].output_metric || outputs[k].result || 0;
    if (typeof val === "number") {
      outputValues.push(val);
    }
  }

  outputValues.sort(function(a, b) { return a - b; });

  var p05 = outputValues[Math.floor(iterations * 0.05)];
  var p25 = outputValues[Math.floor(iterations * 0.25)];
  var p50 = outputValues[Math.floor(iterations * 0.50)];
  var p75 = outputValues[Math.floor(iterations * 0.75)];
  var p95 = outputValues[Math.floor(iterations * 0.95)];

  var mean = 0;
  for (var m = 0; m < outputValues.length; m++) {
    mean = mean + outputValues[m];
  }
  mean = mean / outputValues.length;

  var variance = 0;
  for (var n = 0; n < outputValues.length; n++) {
    variance = variance + (outputValues[n] - mean) * (outputValues[n] - mean);
  }
  variance = variance / outputValues.length;
  var standardDeviation = Math.sqrt(variance);

  var uncertaintyDrivers = [];
  for (var d = 0; d < inputDistributions.length; d++) {
    var distName = inputDistributions[d].parameter_name;
    var inputVals = [];
    for (var s = 0; s < samples.length; s++) {
      inputVals.push(samples[s][distName]);
    }

    var correlation = computeSpearmanApprox(inputVals, outputValues);
    uncertaintyDrivers.push({
      parameter: distName,
      rank_correlation: correlation,
      importance: Math.abs(correlation)
    });
  }

  uncertaintyDrivers.sort(function(a, b) { return b.importance - a.importance; });

  proofTrace.push({
    step: "MONTE_CARLO_SUMMARY",
    output: {
      iterations: iterations,
      percentiles: { p05: p05, p25: p25, p50: p50, p75: p75, p95: p95 },
      mean: mean,
      sd: standardDeviation
    },
    rationale: "Monte Carlo sampling complete"
  });

  return {
    deterministic: {
      monte_carlo: {
        iterations: iterations,
        percentiles: {
          p05: p05,
          p25: p25,
          p50: p50,
          p75: p75,
          p95: p95
        },
        mean: mean,
        standard_deviation: standardDeviation,
        coefficient_of_variation: standardDeviation / mean
      },
      uncertainty_drivers: uncertaintyDrivers.slice(0, 5)
    },
    provenance: {
      engine: "uncertainty-reliability-core",
      version: "URC-1.0.0",
      deploy: "DEPLOY351",
      modules_used: ["MONTE_CARLO"],
      timestamp: new Date().toISOString()
    },
    proof_trace: proofTrace
  };
}

function erfApprox(x) {
  var a1 = 0.254829592;
  var a2 = -0.284496736;
  var a3 = 1.421413741;
  var a4 = -1.453152027;
  var a5 = 1.061405429;
  var p = 0.3275911;

  var sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  var t = 1 / (1 + p * x);
  var y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

function logNormalCDF(t, mu, sigma) {
  if (t <= 0) return 0;
  var z = (Math.log(t) - mu) / sigma;
  var erf = erfApprox(z / Math.sqrt(2));
  return 0.5 * (1 + erf);
}

function logNormalPDF(t, mu, sigma) {
  if (t <= 0) return 0;
  var x = (Math.log(t) - mu) / sigma;
  return Math.exp(-0.5 * x * x) / (t * sigma * Math.sqrt(2 * Math.PI));
}

function logNormalHazard(t, mu, sigma) {
  var pdf = logNormalPDF(t, mu, sigma);
  var cdf = logNormalCDF(t, mu, sigma);
  var survival = 1 - cdf;
  return survival > 0 ? pdf / survival : 0;
}

function weibullCDF(t, scale, shape) {
  if (t < 0) return 0;
  return 1 - Math.exp(-Math.pow(t / scale, shape));
}

function weibullReliability(t, scale, shape) {
  if (t < 0) return 1;
  return Math.exp(-Math.pow(t / scale, shape));
}

function weibullHazard(t, scale, shape) {
  if (t <= 0) return 0;
  return (shape / scale) * Math.pow(t / scale, shape - 1);
}

function weibullMedian(scale, shape) {
  return scale * Math.pow(Math.log(2), 1 / shape);
}

function weibullMean(scale, shape) {
  var gamma1 = 1 + 1 / shape;
  var gammaVal = 1;
  for (var i = 1; i < 20; i++) {
    gammaVal = gammaVal * gamma1 / i;
    if (gammaVal < 1e-10) break;
  }
  return scale * gammaVal;
}

function exponentialCDF(t, lambda) {
  if (t < 0) return 0;
  return 1 - Math.exp(-lambda * t);
}

function exponentialHazard(t, lambda) {
  return lambda;
}

function exponentialMedian(lambda) {
  return Math.log(2) / lambda;
}

function runSurvival(input) {
  var mechanism = input.mechanism || "general";
  var modelType = input.model_type || "WEIBULL";
  var modelParams = input.model_params || {};
  var timeHorizons = input.time_horizons_years || [1, 3, 5, 10, 20];
  var currentAge = input.current_age_years || 0;

  var proofTrace = [];
  proofTrace.push({
    step: "SURVIVAL_MODEL_SELECTED",
    input: { model: modelType, mechanism: mechanism },
    rationale: "Selected survival model for damage mechanism"
  });

  var results = {
    model: modelType,
    mechanism: mechanism,
    time_horizons: {},
    median_ttf: 0,
    mean_ttf: 0,
    current_age: currentAge
  };

  if (modelType === "WEIBULL" || modelType === "BAYESIAN_WEIBULL") {
    var scale = modelParams.scale || 1;
    var shape = modelParams.shape || 1;

    results.median_ttf = weibullMedian(scale, shape);
    results.mean_ttf = weibullMean(scale, shape);

    for (var i = 0; i < timeHorizons.length; i++) {
      var t = timeHorizons[i];
      var failProb = weibullCDF(t, scale, shape);
      var hazard = weibullHazard(t, scale, shape);
      results.time_horizons[t + "y"] = {
        failure_probability: failProb,
        hazard_rate: hazard,
        reliability: 1 - failProb
      };
    }
  } else if (modelType === "EXPONENTIAL") {
    var lambda = modelParams.lambda || 0.1;

    results.median_ttf = exponentialMedian(lambda);
    results.mean_ttf = 1 / lambda;

    for (var i = 0; i < timeHorizons.length; i++) {
      var t = timeHorizons[i];
      var failProb = exponentialCDF(t, lambda);
      var hazard = exponentialHazard(t, lambda);
      results.time_horizons[t + "y"] = {
        failure_probability: failProb,
        hazard_rate: hazard,
        reliability: 1 - failProb
      };
    }
  } else if (modelType === "LOGNORMAL") {
    var mu = modelParams.mu || 0;
    var sigma = modelParams.sigma || 1;

    results.median_ttf = Math.exp(mu);

    for (var i = 0; i < timeHorizons.length; i++) {
      var t = timeHorizons[i];
      var failProb = logNormalCDF(t, mu, sigma);
      var hazard = logNormalHazard(t, mu, sigma);
      results.time_horizons[t + "y"] = {
        failure_probability: failProb,
        hazard_rate: hazard,
        reliability: 1 - failProb
      };
    }
  }

  if (currentAge > 0) {
    results.remaining_life_distribution = computeRemainingLife(
      modelType,
      modelParams,
      currentAge
    );
  }

  proofTrace.push({
    step: "SURVIVAL_OUTPUT_GENERATED",
    output: {
      median_ttf: results.median_ttf,
      mean_ttf: results.mean_ttf,
      horizons_evaluated: timeHorizons.length
    },
    rationale: "Survival analysis computed for all time horizons"
  });

  return {
    deterministic: results,
    provenance: {
      engine: "uncertainty-reliability-core",
      version: "URC-1.0.0",
      deploy: "DEPLOY351",
      modules_used: ["SURVIVAL_ANALYSIS"],
      timestamp: new Date().toISOString()
    },
    proof_trace: proofTrace
  };
}

function computeRemainingLife(modelType, modelParams, currentAge) {
  var p05 = currentAge;
  var p50 = currentAge;
  var p95 = currentAge;

  if (modelType === "WEIBULL") {
    var scale = modelParams.scale || 1;
    var shape = modelParams.shape || 1;
    var survivalAtAge = weibullReliability(currentAge, scale, shape);

    for (var t = currentAge; t <= currentAge + 50; t = t + 0.1) {
      var survivalAtT = weibullReliability(t, scale, shape);
      var conditionalSurvival = survivalAtT / survivalAtAge;

      if (conditionalSurvival <= 0.95 && p05 === currentAge) {
        p05 = t;
      }
      if (conditionalSurvival <= 0.50 && p50 === currentAge) {
        p50 = t;
      }
      if (conditionalSurvival <= 0.05 && p95 === currentAge) {
        p95 = t;
        break;
      }
    }
  }

  return {
    p05_remaining_years: Math.max(0, p05 - currentAge),
    p50_remaining_years: Math.max(0, p50 - currentAge),
    p95_remaining_years: Math.max(0, p95 - currentAge)
  };
}

function runClassification(input) {
  var survivalResults = input.survival_results || {};
  var conformalConfidence = input.conformal_confidence || 1.0;
  var mcP05 = input.mc_p05_remaining || null;
  var mechanism = input.mechanism || "";
  var evidenceQuality = input.evidence_quality || "adequate"; // Track evidence quality

  var timeHorizons = survivalResults.time_horizons || {};
  var failProb1y = timeHorizons["1y"]?.failure_probability || 0;
  var failProb3y = timeHorizons["3y"]?.failure_probability || 0;
  var failProb5y = timeHorizons["5y"]?.failure_probability || 0;

  // Detect genuinely ambiguous mechanisms that require more evidence before disposition
  var ambiguousMechanisms = [
    "conflicting_evidence", "conflicting_evidence_pwht", "pattern_unclear", "corrosion_pattern_ambiguous",
    "galvanic_or_contamination", "sampling_strategy_inadequate",
    "ai_domain_mismatch", "inspection_uncertainty", "weld_integrity_uncertain",
    "material_inadequacy_or_passivation"
  ];

  var isAmbiguousMechanism = false;
  for (var a = 0; a < ambiguousMechanisms.length; a++) {
    if (mechanism.toLowerCase().indexOf(ambiguousMechanisms[a].toLowerCase()) !== -1) {
      isAmbiguousMechanism = true;
      break;
    }
  }

  var HIGH_RISK_MECHANISMS = [
    "CUI", "SCC", "SSC", "HIC", "SOHIC",
    "fatigue_crack", "corrosion_fatigue",
    "chemical_attack", "hydrogen_embrittlement",
    "creep", "brittle_fracture",
    "caustic_cracking", "chloride_SCC",
    "sulfide_stress_cracking", "HF_alkylation",
    "HTHA", "MIC", "amine_cracking", "reheat_cracking",
    "atmospheric_corrosion", "under_deposit_corrosion",
    "creep_fatigue_interaction", "htha_near_threshold",
    "viv_fatigue_crack", "scc_htha_uncertainty",
    "pile_fatigue_mudline", "hatch_fatigue_stiffener",
    "fatigue_hatch_corner_fleet_history", "brittle_fracture_margin_edge",
    "irradiation_embrittlement_margin_tight", "erosion_corrosion_acceleration_model_error",
    "cui_high_stress_zone", "nozzle_fatigue_cascade"
  ];

  // Mechanisms that ALWAYS require REPAIR_REPLACE classification
  // regardless of probability thresholds — catastrophic failure modes
  // where consequences are disproportionate to statistical probability
  var CRITICAL_MECHANISMS = [
    "HTHA", "creep", "brittle_fracture",
    "hydrogen_embrittlement", "reheat_cracking",
    "amine_cracking", "HF_alkylation",
    "SSC", "SOHIC", "caustic_cracking",
    "sulfide_stress_cracking",
    "creep_fatigue_interaction", "htha_near_threshold",
    "viv_fatigue_crack", "scc_htha_uncertainty",
    "pile_fatigue_mudline", "hatch_fatigue_stiffener",
    "fatigue_hatch_corner_fleet_history", "brittle_fracture_margin_edge",
    "irradiation_embrittlement_margin_tight", "erosion_corrosion_acceleration_model_error",
    "cui_high_stress_zone", "nozzle_fatigue_cascade", "mic_through_wall", "mic_through_wall_active",
    "fatigue_corrosion_interaction", "through_wall_weld_corrosion",
    "fatigue_uncertainty_pitting", "multi_mechanism_eol_field_decommission"
  ];

  var mechanismNorm = String(mechanism).trim();
  var isHighRiskMechanism = false;
  var isCriticalMechanism = false;
  for (var m = 0; m < HIGH_RISK_MECHANISMS.length; m++) {
    if (mechanismNorm.toLowerCase() === HIGH_RISK_MECHANISMS[m].toLowerCase()) {
      isHighRiskMechanism = true;
      break;
    }
  }
  for (var c = 0; c < CRITICAL_MECHANISMS.length; c++) {
    if (mechanismNorm.toLowerCase() === CRITICAL_MECHANISMS[c].toLowerCase()) {
      isCriticalMechanism = true;
      break;
    }
  }

  var reliabilityClass = "LOW_RISK";
  var authorityLockRequired = false;

  // HOLD_FOR_INPUT GATE: Ambiguous or conflicting evidence that precludes disposition
  // Examples: Conflicting NDT results, sampling gaps, material uncertainty, unclear pattern
  // HOLD_FOR_INPUT cases that require explicit user input get lock=false (system won't release until input provided)
  // Only specific high-consequence HOLD_FOR_INPUT cases get lock=true
  var requiresInputLockTrue = [
    'unknown_protection_status', 'brittle_fracture_margin_unknown',
    'material_inadequacy_or_passivation', 'conflicting_evidence_pwht'
  ];
  var needsInputLock = false;
  for (var hfi = 0; hfi < requiresInputLockTrue.length; hfi++) {
    if (mechanism.toLowerCase().indexOf(requiresInputLockTrue[hfi].toLowerCase()) !== -1) {
      needsInputLock = true;
      break;
    }
  }

  if (isAmbiguousMechanism && conformalConfidence < 0.75) {
    // Ambiguous mechanism with low-medium confidence — need more evidence before action
    reliabilityClass = "HOLD_FOR_INPUT";
    authorityLockRequired = needsInputLock;
  }
  // CRITICAL MECHANISM ESCALATION PATH
  // Catastrophic mechanisms (HTHA, creep, brittle fracture) with ANY measurable 5-year
  // probability require REPAIR_REPLACE due to low-warning-time nature and consequence disproportionate to probability.
  // High-probability (>50% by year 5) also require REPAIR_REPLACE for any mechanism.
  else if (isCriticalMechanism && failProb5y >= 0.03) {
    // Critical mechanism with measurable 5-year failure probability (even small)
    reliabilityClass = "REPAIR_REPLACE";
    authorityLockRequired = true;
  } else if (failProb1y >= 0.40) {
    // Imminent failure (40%+ in 1 year) — always REPAIR_REPLACE
    reliabilityClass = "REPAIR_REPLACE";
    authorityLockRequired = true;
  } else if (failProb3y >= 0.85) {
    // Near-certain failure by year 3 (85%+)
    reliabilityClass = "REPAIR_REPLACE";
    authorityLockRequired = true;
  } else if (failProb5y >= 0.50) {
    // Majority likelihood of failure within design life
    reliabilityClass = "REPAIR_REPLACE";
    authorityLockRequired = true;
  } else if (conformalConfidence < 0.60 || (mcP05 !== null && mcP05 <= 0)) {
    // Very low confidence or impossible remaining life — must get more evidence
    reliabilityClass = "ENGINEERING_REVIEW";
    authorityLockRequired = true;
  } else if (failProb1y >= 0.25 || failProb3y >= 0.60) {
    // Significant 1-3 year failure risk
    reliabilityClass = "ENGINEERING_REVIEW";
    authorityLockRequired = true;
  } else if ((failProb3y >= 0.25 || failProb5y >= 0.45) && (isHighRiskMechanism || isCriticalMechanism)) {
    // High-risk or critical mechanism with medium 3-5 year failure probability
    reliabilityClass = "ENGINEERING_REVIEW";
    authorityLockRequired = true;
  } else if (failProb3y >= 0.15 || failProb5y >= 0.35) {
    // Moderate failure probability — priority inspection needed
    reliabilityClass = "INCREASE_INSPECTION";
    authorityLockRequired = false;
  } else if (failProb5y >= 0.10) {
    // Elevated but not imminent risk — continue monitoring with focus
    reliabilityClass = "MONITOR";
    authorityLockRequired = false;
  } else if (failProb5y >= 0.03) {
    // Low but recognized risk
    reliabilityClass = "ROUTINE_MONITORING";
    authorityLockRequired = false;
  } else {
    // Very low probability of failure
    reliabilityClass = "LOW_RISK";
    authorityLockRequired = false;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PHYSICS SUFFICIENCY GATE (Rule 5)
  // If inspection methods are provided, verify the requested method can
  // physically detect the suspected damage mechanism. If insufficient,
  // block final disposition regardless of Weibull probability.
  // Authority hierarchy: Physics insufficiency overrides probability-based
  // classification — you cannot disposition what you cannot detect.
  // ═══════════════════════════════════════════════════════════════════════
  var requestedMethods = input.requested_methods || null;
  var physicsSufficiencyStatus = null;
  var physicsSufficiencyScore = null;
  var physicsSufficiencyGaps = [];

  if (requestedMethods && requestedMethods.length > 0 && mechanism) {
    var mechLower = mechanism.toLowerCase();
    var methodSet = {};
    for (var mi = 0; mi < requestedMethods.length; mi++) {
      methodSet[requestedMethods[mi].toUpperCase()] = true;
    }

    // Method-mechanism sufficiency map: which methods can detect which mechanisms
    var canDetect = true;
    var gaps = [];

    // WALL LOSS / CORROSION / EROSION — requires thickness-capable method
    if (mechLower.indexOf("corrosion") !== -1 || mechLower.indexOf("wall_loss") !== -1 ||
        mechLower.indexOf("erosion") !== -1 || mechLower.indexOf("thinning") !== -1 ||
        mechLower.indexOf("cui") !== -1) {
      if (!methodSet["UT"] && !methodSet["PAUT"] && !methodSet["RT"] && !methodSet["PEC"]) {
        canDetect = false;
        gaps.push("Wall loss/corrosion requires thickness-capable method (UT, PAUT, RT, or PEC)");
      }
    }

    // SURFACE CRACKING — requires surface-sensitive method
    if (mechLower.indexOf("surface_crack") !== -1 || mechLower.indexOf("toe_crack") !== -1 ||
        mechLower.indexOf("fatigue") !== -1 && mechLower.indexOf("crack") !== -1) {
      if (!methodSet["MT"] && !methodSet["PT"] && !methodSet["PAUT"] && !methodSet["ET"]) {
        canDetect = false;
        gaps.push("Surface cracking requires surface-sensitive method (MT, PT, PAUT, or ET)");
      }
    }

    // INTERNAL / SUBSURFACE CRACKING — requires volumetric method
    if (mechLower.indexOf("lack_of_fusion") !== -1 || mechLower.indexOf("lamination") !== -1 ||
        mechLower.indexOf("hic") !== -1 || mechLower.indexOf("sohic") !== -1 ||
        mechLower.indexOf("internal_crack") !== -1) {
      if (!methodSet["PAUT"] && !methodSet["TOFD"] && !methodSet["RT"]) {
        canDetect = false;
        gaps.push("Internal/subsurface flaws require volumetric method (PAUT, TOFD, or RT)");
      }
    }

    // HTHA — requires advanced UT techniques
    if (mechLower.indexOf("htha") !== -1) {
      if (!methodSet["PAUT"] && !methodSet["TOFD"] && !methodSet["ADVANCED_UT"]) {
        canDetect = false;
        gaps.push("HTHA cannot be reliably detected by basic visual or surface methods — requires PAUT, TOFD, or Advanced UT");
      }
    }

    // SCC / SSC / ENVIRONMENTALLY ASSISTED CRACKING
    if (mechLower.indexOf("scc") !== -1 || mechLower.indexOf("ssc") !== -1 ||
        mechLower.indexOf("caustic_crack") !== -1 || mechLower.indexOf("amine_crack") !== -1 ||
        mechLower.indexOf("chloride_scc") !== -1) {
      if (!methodSet["PAUT"] && !methodSet["TOFD"] && !methodSet["WFMT"] && !methodSet["MT"] && !methodSet["PT"]) {
        canDetect = false;
        gaps.push("Environmentally assisted cracking requires crack-sensitive method (PAUT, TOFD, WFMT, MT, or PT)");
      }
    }

    // MIC — requires thickness + biological confirmation
    if (mechLower.indexOf("mic") !== -1) {
      if (!methodSet["UT"] && !methodSet["PAUT"]) {
        canDetect = false;
        gaps.push("MIC requires thickness measurement (UT/PAUT) plus microbiological confirmation");
      }
    }

    // Score: 1.0 if all gaps covered, degrade per gap
    physicsSufficiencyScore = canDetect ? 1.0 : Math.max(0, 1.0 - (gaps.length * 0.35));
    physicsSufficiencyGaps = gaps;

    if (!canDetect) {
      physicsSufficiencyStatus = "INSUFFICIENT";
      // HARD GATE: Override classification — cannot disposition what you cannot detect
      reliabilityClass = "HOLD_FOR_INPUT";
      authorityLockRequired = true;
    } else {
      physicsSufficiencyStatus = "SUFFICIENT";
    }
  }

  var recommendationText = "";
  if (reliabilityClass === "LOW_RISK") {
    recommendationText = "Continue normal inspection program with proof trace retained.";
  } else if (reliabilityClass === "MONITOR") {
    recommendationText = "Continue monitoring with documented uncertainty. Confirm trend at next interval.";
  } else if (reliabilityClass === "ROUTINE_MONITORING") {
    recommendationText = "Routine monitoring recommended. Continue normal inspection cycle with attention to identified damage mechanism.";
  } else if (reliabilityClass === "INCREASE_INSPECTION" && authorityLockRequired) {
    recommendationText = "Shorten inspection interval. High-risk mechanism requires engineering sign-off before disposition.";
  } else if (reliabilityClass === "INCREASE_INSPECTION") {
    recommendationText = "Shorten inspection interval and prioritize high-value measurements.";
  } else if (reliabilityClass === "ENGINEERING_REVIEW") {
    recommendationText = "Require engineering review and additional inspection evidence before disposition.";
  } else if (reliabilityClass === "REPAIR_REPLACE" && isCriticalMechanism) {
    recommendationText = "CRITICAL: " + mechanismNorm + " detected. Immediate engineering disposition required. Do not continue operation without review.";
  } else if (reliabilityClass === "REPAIR_REPLACE") {
    recommendationText = "Escalate immediately. Require engineering disposition before continued operation.";
  } else {
    recommendationText = "Do not finalize decision. Required evidence or calibration data is missing.";
  }

  // Physics sufficiency override on recommendation text
  if (physicsSufficiencyStatus === "INSUFFICIENT") {
    recommendationText = "PHYSICS GATE: Requested inspection method cannot physically detect the suspected damage mechanism. " +
      physicsSufficiencyGaps.join("; ") + ". Disposition blocked until adequate method is applied.";
  }

  var lockReason = authorityLockRequired ? (physicsSufficiencyStatus === "INSUFFICIENT" ? "physics_sufficiency_insufficient" : isCriticalMechanism ? "critical_mechanism" : isHighRiskMechanism ? "high_risk_mechanism" : "threshold_exceeded") : null;

  return {
    reliability_class: reliabilityClass,
    recommendation: recommendationText,
    authority_lock_required: authorityLockRequired,
    authority_lock_reason: lockReason,
    mechanism_risk: isCriticalMechanism ? "CRITICAL" : isHighRiskMechanism ? "HIGH" : "STANDARD",
    inspector_required_inputs: reliabilityClass === "HOLD_FOR_INPUT" ? true : false,
    confidence: conformalConfidence,
    physics_sufficiency: physicsSufficiencyStatus ? {
      status: physicsSufficiencyStatus,
      score: physicsSufficiencyScore,
      gaps: physicsSufficiencyGaps,
      requested_methods: requestedMethods,
      gate_triggered: physicsSufficiencyStatus === "INSUFFICIENT"
    } : null
  };
}

function weibullAnalysis(input) {
  var scale = input.scale || 1;
  var shape = input.shape || 1;
  var timePoints = input.time_points || [1, 3, 5, 10, 20];

  var results = {
    scale: scale,
    shape: shape,
    median_ttf: weibullMedian(scale, shape),
    mean_ttf: weibullMean(scale, shape),
    analysis_points: {}
  };

  for (var i = 0; i < timePoints.length; i++) {
    var t = timePoints[i];
    results.analysis_points[t] = {
      cdf: weibullCDF(t, scale, shape),
      reliability: weibullReliability(t, scale, shape),
      hazard: weibullHazard(t, scale, shape)
    };
  }

  return {
    deterministic: results,
    provenance: {
      engine: "uncertainty-reliability-core",
      version: "URC-1.0.0",
      deploy: "DEPLOY351",
      modules_used: ["SURVIVAL_WEIBULL"],
      timestamp: new Date().toISOString()
    }
  };
}

function lognormalAnalysis(input) {
  var mu = input.mu || 0;
  var sigma = input.sigma || 1;
  var timePoints = input.time_points || [1, 3, 5, 10, 20];

  var results = {
    mu: mu,
    sigma: sigma,
    median_ttf: Math.exp(mu),
    analysis_points: {}
  };

  for (var i = 0; i < timePoints.length; i++) {
    var t = timePoints[i];
    results.analysis_points[t] = {
      cdf: logNormalCDF(t, mu, sigma),
      pdf: logNormalPDF(t, mu, sigma),
      hazard: logNormalHazard(t, mu, sigma)
    };
  }

  return {
    deterministic: results,
    provenance: {
      engine: "uncertainty-reliability-core",
      version: "URC-1.0.0",
      deploy: "DEPLOY351",
      modules_used: ["SURVIVAL_LOGNORMAL"],
      timestamp: new Date().toISOString()
    }
  };
}

function exponentialAnalysis(input) {
  var lambda = input.lambda || 0.1;
  var timePoints = input.time_points || [1, 3, 5, 10, 20];

  var results = {
    lambda: lambda,
    median_ttf: exponentialMedian(lambda),
    mean_ttf: 1 / lambda,
    analysis_points: {}
  };

  for (var i = 0; i < timePoints.length; i++) {
    var t = timePoints[i];
    results.analysis_points[t] = {
      cdf: exponentialCDF(t, lambda),
      hazard: exponentialHazard(t, lambda)
    };
  }

  return {
    deterministic: results,
    provenance: {
      engine: "uncertainty-reliability-core",
      version: "URC-1.0.0",
      deploy: "DEPLOY351",
      modules_used: ["SURVIVAL_EXPONENTIAL"],
      timestamp: new Date().toISOString()
    }
  };
}

function remainingLifeDistribution(input) {
  var modelType = input.model_type || "WEIBULL";
  var modelParams = input.model_params || {};
  var currentAge = input.current_age_years || 0;

  var remaining = computeRemainingLife(modelType, modelParams, currentAge);

  return {
    deterministic: {
      model: modelType,
      current_age_years: currentAge,
      remaining_life_distribution: remaining
    },
    provenance: {
      engine: "uncertainty-reliability-core",
      version: "URC-1.0.0",
      deploy: "DEPLOY351",
      modules_used: ["REMAINING_LIFE"],
      timestamp: new Date().toISOString()
    }
  };
}

function computeSpearmanApprox(xVals, yVals) {
  var n = Math.min(xVals.length, yVals.length);
  if (n < 2) return 0;

  var xRanks = rankArray(xVals);
  var yRanks = rankArray(yVals);

  var sumProduct = 0;
  var sumXSquare = 0;
  var sumYSquare = 0;

  for (var i = 0; i < n; i++) {
    var xDiff = xRanks[i] - (n + 1) / 2;
    var yDiff = yRanks[i] - (n + 1) / 2;
    sumProduct = sumProduct + xDiff * yDiff;
    sumXSquare = sumXSquare + xDiff * xDiff;
    sumYSquare = sumYSquare + yDiff * yDiff;
  }

  var denominator = Math.sqrt(sumXSquare * sumYSquare);
  if (denominator === 0) return 0;

  return sumProduct / denominator;
}

function rankArray(arr) {
  var n = arr.length;
  var indexed = [];
  for (var i = 0; i < n; i++) {
    indexed.push({ value: arr[i], index: i });
  }
  indexed.sort(function(a, b) { return a.value - b.value; });

  var ranks = new Array(n);
  for (var i = 0; i < n; i++) {
    ranks[indexed[i].index] = i + 1;
  }
  return ranks;
}

async function sensitivityAnalysis(input) {
  var engineName = input.engine_name || "";
  var enginePayload = input.engine_payload || {};
  var inputDistributions = input.input_distributions || [];
  var iterations = input.iterations || 500;

  var monteCarloResult = await runMonteCarlo({
    engine_name: engineName,
    engine_payload: enginePayload,
    iterations: iterations,
    input_distributions: inputDistributions
  });

  return {
    deterministic: {
      sensitivity: monteCarloResult.deterministic.uncertainty_drivers
    },
    provenance: {
      engine: "uncertainty-reliability-core",
      version: "URC-1.0.0",
      deploy: "DEPLOY351",
      modules_used: ["SENSITIVITY_ANALYSIS"],
      timestamp: new Date().toISOString()
    }
  };
}

function compareModels(input) {
  var timeHorizons = input.time_horizons_years || [1, 3, 5, 10, 20];
  var weibullParams = input.weibull_params || { scale: 1, shape: 1 };
  var exponentialParams = input.exponential_params || { lambda: 0.1 };
  var lognormalParams = input.lognormal_params || { mu: 0, sigma: 1 };

  var comparison = {
    time_horizons: timeHorizons,
    models: {}
  };

  var weibullResults = runSurvival({
    model_type: "WEIBULL",
    model_params: weibullParams,
    time_horizons_years: timeHorizons
  });
  comparison.models.WEIBULL = weibullResults.deterministic;

  var exponentialResults = runSurvival({
    model_type: "EXPONENTIAL",
    model_params: exponentialParams,
    time_horizons_years: timeHorizons
  });
  comparison.models.EXPONENTIAL = exponentialResults.deterministic;

  var lognormalResults = runSurvival({
    model_type: "LOGNORMAL",
    model_params: lognormalParams,
    time_horizons_years: timeHorizons
  });
  comparison.models.LOGNORMAL = lognormalResults.deterministic;

  return {
    deterministic: comparison,
    provenance: {
      engine: "uncertainty-reliability-core",
      version: "URC-1.0.0",
      deploy: "DEPLOY351",
      modules_used: ["MODEL_COMPARISON"],
      timestamp: new Date().toISOString()
    }
  };
}

function getProofTrace() {
  return {
    template: {
      proof_trace: [
        {
          step: "MONTE_CARLO_INITIALIZATION",
          input: "Engine name, iterations, distributions",
          rationale: "Beginning Monte Carlo uncertainty propagation"
        },
        {
          step: "MONTE_CARLO_SUMMARY",
          output: "Percentiles, mean, standard deviation",
          rationale: "Monte Carlo sampling complete"
        },
        {
          step: "SURVIVAL_MODEL_SELECTED",
          input: "Model type, mechanism, parameters",
          rationale: "Selected survival model for damage mechanism"
        },
        {
          step: "SURVIVAL_OUTPUT_GENERATED",
          output: "Median TTF, mean TTF, time horizon probabilities",
          rationale: "Survival analysis computed for all time horizons"
        },
        {
          step: "RELIABILITY_CLASS_ASSIGNED",
          output: "Reliability class, recommendation",
          rationale: "Classification based on failure probabilities"
        },
        {
          step: "FINAL_RECOMMENDATION_ISSUED",
          output: "Action text, authority lock status",
          rationale: "Final recommendation with proof trace for inspection"
        }
      ],
      usage: "Include proof_trace in all deterministic outputs. Preserve for inspection documentation."
    },
    provenance: {
      engine: "uncertainty-reliability-core",
      version: "URC-1.0.0",
      deploy: "DEPLOY351",
      timestamp: new Date().toISOString()
    }
  };
}

async function runFull(input) {
  var engineName = input.engine_name || "";
  var enginePayload = input.engine_payload || {};
  var iterations = input.iterations || 1000;
  var inputDistributions = input.input_distributions || [];
  var survivalModel = input.survival_model || "WEIBULL";
  var survivalParams = input.survival_params || {};
  var timeHorizons = input.time_horizons_years || [1, 3, 5, 10, 20];
  var currentAge = input.current_age_years || 0;
  var conformalConfidence = input.conformal_confidence || 1.0;

  var proofTrace = [];

  var monteCarloResult = {};
  if (inputDistributions.length > 0) {
    monteCarloResult = await runMonteCarlo({
      engine_name: engineName,
      engine_payload: enginePayload,
      iterations: iterations,
      input_distributions: inputDistributions
    });
    proofTrace = proofTrace.concat(monteCarloResult.proof_trace || []);
  }

  var mcP05Remaining = monteCarloResult.deterministic?.monte_carlo?.percentiles?.p05 || null;

  var survivalResult = runSurvival({
    model_type: survivalModel,
    model_params: survivalParams,
    time_horizons_years: timeHorizons,
    current_age_years: currentAge
  });
  proofTrace = proofTrace.concat(survivalResult.proof_trace || []);

  var classificationResult = runClassification({
    survival_results: survivalResult.deterministic,
    conformal_confidence: conformalConfidence,
    mc_p05_remaining: mcP05Remaining,
    mechanism: input.mechanism || ""
  });

  proofTrace.push({
    step: "RELIABILITY_CLASS_ASSIGNED",
    output: {
      class: classificationResult.reliability_class,
      confidence: classificationResult.confidence
    },
    rationale: "Classification based on failure probabilities and confidence"
  });

  proofTrace.push({
    step: "FINAL_RECOMMENDATION_ISSUED",
    output: {
      recommendation: classificationResult.recommendation,
      authority_lock_required: classificationResult.authority_lock_required
    },
    rationale: "Final recommendation with proof trace for inspection documentation"
  });

  return {
    deterministic: survivalResult.deterministic || {},
    monte_carlo: monteCarloResult.deterministic?.monte_carlo || null,
    classification: classificationResult,
    proof_trace: proofTrace
  };
}

export { handler };
