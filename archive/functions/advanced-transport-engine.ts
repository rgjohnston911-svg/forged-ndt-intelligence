// @ts-nocheck
/**
 * DEPLOY307 - advanced-transport-engine.ts
 * netlify/functions/advanced-transport-engine.ts
 *
 * ADVANCED TRANSPORT ENGINE — ENGINE 97
 *
 * Sub-engines 202, 207, 217, 225, 226, 227, 228, 231, 233, 238:
 *   202 - Nonlinear Dynamics (runaway detection)
 *   207 - Digital Twin State-Space (linear state update)
 *   217 - PDE Transport (Fick/Fourier flux)
 *   225 - Thermodynamics Energy Balance (Q=mcpDT)
 *   226 - Electrochemistry Kinetics (Butler-Volmer)
 *   227 - Composite Anisotropic (fiber direction stress)
 *   228 - Coating Barrier Transport (permeability)
 *   231 - Aerospace Space Physics (dynamic pressure)
 *   233 - Fire Blast Physics (Hopkinson-Cranz scaled distance)
 *   238 - Learning Calibration (parameter update)
 *
 * POST /api/advanced-transport-engine
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var ENGINE_ID = "advanced-transport-engine";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY307";
var corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };

function num(v, fallback) { var n = Number(v); if (v === undefined || v === null || v === "" || isNaN(n)) return fallback !== undefined ? fallback : null; return n; }
function getMissing(inp, keys) { var m = []; for (var i = 0; i < keys.length; i++) { if (inp[keys[i]] === undefined || inp[keys[i]] === null || inp[keys[i]] === "") m.push(keys[i]); } return m; }
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function buildResult(en, ec, p) { return { engine_number: en, engine_code: ec, result: p.result || {}, interpretation: p.interpretation || "", confidence: clamp01(p.confidence || 0.7), uncertainty: clamp01(p.uncertainty || 0.3), severity: p.severity || "info", assumptions: p.assumptions || [], limitations: p.limitations || [], missing_inputs: p.missing_inputs || [], proof_trace: p.proof_trace || { mathematical_basis: [], calculation_steps: [], required_human_review: false } }; }
function holdResult(en, ec, m) { return buildResult(en, ec, { result: { missing_inputs: m }, interpretation: "Held. Missing: " + m.join(", ") + ".", confidence: 0.1, uncertainty: 0.9, severity: "hold_for_input", missing_inputs: m }); }

// ============================================================
// 202 — NONLINEAR DYNAMICS
// ============================================================

function calcNonlinearDynamics(inp) {
  var values = inp.values;
  if (!Array.isArray(values) || values.length < 4) return holdResult(202, "NONLINEAR_DYNAMICS", ["values (array, min 4 points)"]);
  var rates = [];
  for (var i = 1; i < values.length; i++) rates.push(values[i] - values[i - 1]);
  var accels = [];
  for (var j = 1; j < rates.length; j++) accels.push(rates[j] - rates[j - 1]);
  var latestRate = rates[rates.length - 1];
  var latestAccel = accels[accels.length - 1];
  var runawayIndex = latestRate > 0 ? latestAccel / Math.max(Math.abs(latestRate), 1e-9) : 0;
  var sev = runawayIndex > 0.5 ? "critical" : runawayIndex > 0.2 ? "high" : runawayIndex > 0.05 ? "medium" : "low";
  return buildResult(202, "NONLINEAR_DYNAMICS", {
    result: { rates: rates, accelerations: accels, runaway_index: runawayIndex },
    interpretation: "Nonlinear acceleration index is " + runawayIndex.toFixed(3) + "." + (sev === "critical" ? " RUNAWAY BEHAVIOR DETECTED — immediate review." : ""),
    confidence: 0.76, uncertainty: 0.24, severity: sev,
    assumptions: ["Data points are sequential and comparable"],
    limitations: ["Short time series may overstate or understate nonlinear behavior"],
    proof_trace: { mathematical_basis: ["finite differences", "nonlinear acceleration screening"], calculation_steps: ["runaway_index=" + runawayIndex], required_human_review: sev === "critical" }
  });
}

// ============================================================
// 207 — DIGITAL TWIN STATE-SPACE
// ============================================================

function calcDigitalTwin(inp) {
  var m = getMissing(inp, ["x", "A"]);
  if (m.length) return holdResult(207, "DIGITAL_TWIN_STATE_SPACE", m);
  var x = inp.x;
  var A = inp.A;
  var u = inp.u || [];
  var B = inp.B || [];
  if (!Array.isArray(x) || !Array.isArray(A)) return holdResult(207, "DIGITAL_TWIN_STATE_SPACE", ["x", "A"]);
  var xNext = [];
  for (var i = 0; i < A.length; i++) {
    var ax = 0;
    for (var j = 0; j < A[i].length; j++) ax += Number(A[i][j]) * Number(x[j] || 0);
    var bu = 0;
    if (B[i]) { for (var k = 0; k < B[i].length; k++) bu += Number(B[i][k]) * Number(u[k] || 0); }
    xNext.push(ax + bu);
  }
  return buildResult(207, "DIGITAL_TWIN_STATE_SPACE", {
    result: { current_state: x, next_state: xNext },
    interpretation: "Digital twin state advanced one step.",
    confidence: 0.78, uncertainty: 0.22, severity: "info",
    assumptions: ["Linear state-space approximation is acceptable for this step"],
    limitations: ["Nonlinear systems may require extended or unscented Kalman logic"],
    proof_trace: { mathematical_basis: ["state-space update", "linear systems"], calculation_steps: ["x_next = A*x + B*u = " + JSON.stringify(xNext)], required_human_review: false }
  });
}

// ============================================================
// 217 — PDE TRANSPORT (FICK/FOURIER)
// ============================================================

function calcPDETransport(inp) {
  var m = getMissing(inp, ["D", "gradient"]);
  if (m.length) return holdResult(217, "PDE_TRANSPORT", m);
  var D = num(inp.D), gradient = num(inp.gradient);
  var flux = -D * gradient;
  var highThreshold = num(inp.high_flux_threshold, Infinity);
  return buildResult(217, "PDE_TRANSPORT", {
    result: { flux: flux, diffusion_coefficient: D, gradient: gradient },
    interpretation: "Transport flux is " + flux.toExponential(3) + ".",
    confidence: 0.72, uncertainty: 0.28,
    severity: Math.abs(flux) > highThreshold ? "high" : "info",
    assumptions: ["Steady-state conditions", "Linear concentration or temperature gradient"],
    limitations: ["Does not capture time-dependent transient behavior"],
    proof_trace: { mathematical_basis: ["Fick/Fourier transport law"], calculation_steps: ["J = -D * gradient = -" + D + " * " + gradient + " = " + flux], required_human_review: false }
  });
}

// ============================================================
// 225 — THERMODYNAMICS ENERGY BALANCE
// ============================================================

function calcThermodynamics(inp) {
  var m = getMissing(inp, ["m", "cp", "deltaT"]);
  if (m.length) return holdResult(225, "THERMODYNAMICS_ENERGY", m);
  var mass = num(inp.m), cp = num(inp.cp), dT = num(inp.deltaT);
  var Q = mass * cp * dT;
  return buildResult(225, "THERMODYNAMICS_ENERGY", {
    result: { heat_energy: Q, mass: mass, specific_heat: cp, delta_T: dT },
    interpretation: "Heat energy change is " + Q.toFixed(3) + " J.",
    confidence: 0.82, uncertainty: 0.18, severity: "info",
    assumptions: ["Constant specific heat over temperature range", "No phase change"],
    limitations: ["Does not account for heat losses or phase transitions"],
    proof_trace: { mathematical_basis: ["energy balance", "Q=m*cp*dT"], calculation_steps: ["Q = " + mass + " * " + cp + " * " + dT + " = " + Q], required_human_review: false }
  });
}

// ============================================================
// 226 — ELECTROCHEMISTRY KINETICS (BUTLER-VOLMER)
// ============================================================

function calcElectrochemKinetics(inp) {
  var m = getMissing(inp, ["i0", "alphaA", "alphaC", "eta", "T"]);
  if (m.length) return holdResult(226, "ELECTROCHEM_KINETICS", m);
  var F = 96485;
  var R = 8.314;
  var i0 = num(inp.i0), aa = num(inp.alphaA), ac = num(inp.alphaC), eta = num(inp.eta), T = num(inp.T);
  var current = i0 * (Math.exp((aa * F * eta) / (R * T)) - Math.exp((-ac * F * eta) / (R * T)));
  var highThreshold = num(inp.high_current_threshold, Infinity);
  return buildResult(226, "ELECTROCHEM_KINETICS", {
    result: { corrosion_current_density: current },
    interpretation: "Butler-Volmer current density is " + current.toExponential(3) + " A/m2.",
    confidence: 0.68, uncertainty: 0.32,
    severity: Math.abs(current) > highThreshold ? "high" : "medium",
    assumptions: ["Electrode kinetics parameters are valid for the environment", "Temperature is constant"],
    limitations: ["Does not account for mass transport limitations or passivation"],
    proof_trace: { mathematical_basis: ["Butler-Volmer equation"], calculation_steps: ["i = i0*(exp(aa*F*eta/RT) - exp(-ac*F*eta/RT)) = " + current.toExponential(3)], required_human_review: true }
  });
}

// ============================================================
// 227 — COMPOSITE ANISOTROPIC
// ============================================================

function calcCompositeAnisotropic(inp) {
  var m = getMissing(inp, ["sigma_fiber", "fiber_angle_degrees"]);
  if (m.length) return holdResult(227, "COMPOSITE_ANISOTROPIC", m);
  var sigmaFiber = num(inp.sigma_fiber), angle = num(inp.fiber_angle_degrees);
  var theta = angle * Math.PI / 180;
  var effective = sigmaFiber * Math.cos(theta) * Math.cos(theta);
  return buildResult(227, "COMPOSITE_ANISOTROPIC", {
    result: { effective_fiber_direction_stress: effective, fiber_angle: angle },
    interpretation: "Effective fiber-direction stress component is " + effective.toFixed(3) + " MPa at " + angle + " degrees off-axis.",
    confidence: 0.66, uncertainty: 0.34, severity: "medium",
    assumptions: ["Simplified directional projection", "Unidirectional ply"],
    limitations: ["Not full laminate theory — does not account for ply interactions or matrix cracking"],
    proof_trace: { mathematical_basis: ["anisotropic stress transformation"], calculation_steps: ["sigma_eff = sigma*cos^2(theta) = " + sigmaFiber + "*cos^2(" + angle + ") = " + effective], required_human_review: true }
  });
}

// ============================================================
// 228 — COATING BARRIER TRANSPORT
// ============================================================

function calcCoatingBarrier(inp) {
  var m = getMissing(inp, ["D", "S"]);
  if (m.length) return holdResult(228, "COATING_BARRIER_TRANSPORT", m);
  var D = num(inp.D), S = num(inp.S);
  var P = D * S;
  var highThreshold = num(inp.high_permeability_threshold, Infinity);
  return buildResult(228, "COATING_BARRIER_TRANSPORT", {
    result: { permeability: P, diffusion_coefficient: D, solubility: S },
    interpretation: "Barrier permeability is " + P.toExponential(3) + ".",
    confidence: 0.76, uncertainty: 0.24,
    severity: P > highThreshold ? "high" : "info",
    assumptions: ["Steady-state diffusion through the coating", "Homogeneous coating film"],
    limitations: ["Does not account for pinholes, holidays, or mechanical damage"],
    proof_trace: { mathematical_basis: ["permeability = diffusion * solubility"], calculation_steps: ["P = D*S = " + D + "*" + S + " = " + P], required_human_review: false }
  });
}

// ============================================================
// 231 — AEROSPACE SPACE PHYSICS (DYNAMIC PRESSURE)
// ============================================================

function calcAerospacePhysics(inp) {
  var m = getMissing(inp, ["rho", "v"]);
  if (m.length) return holdResult(231, "AEROSPACE_SPACE", m);
  var rho = num(inp.rho), v = num(inp.v);
  var q = 0.5 * rho * v * v;
  var highThreshold = num(inp.high_q_threshold, Infinity);
  return buildResult(231, "AEROSPACE_SPACE", {
    result: { dynamic_pressure: q },
    interpretation: "Dynamic pressure is " + q.toFixed(3) + " Pa.",
    confidence: 0.74, uncertainty: 0.26,
    severity: q > highThreshold ? "high" : "medium",
    assumptions: ["Incompressible flow approximation or known density at altitude"],
    limitations: ["Does not account for shock waves at supersonic speeds"],
    proof_trace: { mathematical_basis: ["dynamic pressure", "q = 0.5*rho*v^2"], calculation_steps: ["q = 0.5*" + rho + "*" + v + "^2 = " + q], required_human_review: true }
  });
}

// ============================================================
// 233 — FIRE BLAST PHYSICS (HOPKINSON-CRANZ)
// ============================================================

function calcFireBlast(inp) {
  var m = getMissing(inp, ["W", "R"]);
  if (m.length) return holdResult(233, "FIRE_BLAST", m);
  var W = num(inp.W), R = num(inp.R);
  var Z = R / Math.cbrt(W);
  return buildResult(233, "FIRE_BLAST", {
    result: { scaled_distance: Z, charge_weight: W, standoff_distance: R },
    interpretation: "Blast scaled distance is " + Z.toFixed(3) + ". " + (Z < 5 ? "EXTREME blast severity — structural collapse likely." : Z < 10 ? "High blast severity — significant structural damage expected." : Z < 20 ? "Moderate blast severity." : "Low blast severity at this distance."),
    confidence: 0.68, uncertainty: 0.32,
    severity: Z < 5 ? "critical" : Z < 10 ? "high" : Z < 20 ? "medium" : "low",
    assumptions: ["Free-field blast without reflections", "TNT equivalent charge weight"],
    limitations: ["Does not account for confinement, reflection, or fragmentation"],
    proof_trace: { mathematical_basis: ["Hopkinson-Cranz scaled distance"], calculation_steps: ["Z = R/W^(1/3) = " + R + "/" + W + "^(1/3) = " + Z], required_human_review: true }
  });
}

// ============================================================
// 238 — LEARNING CALIBRATION
// ============================================================

function calcLearningCalibration(inp) {
  var m = getMissing(inp, ["old_parameter", "observed_error", "learning_rate"]);
  if (m.length) return holdResult(238, "LEARNING_CALIBRATION", m);
  var old = num(inp.old_parameter), err = num(inp.observed_error), lr = num(inp.learning_rate);
  var updated = old - lr * err;
  return buildResult(238, "LEARNING_CALIBRATION", {
    result: { updated_parameter: updated, old_parameter: old, adjustment: -lr * err },
    interpretation: "Model parameter updated from " + old.toFixed(4) + " to " + updated.toFixed(4) + ".",
    confidence: 0.6, uncertainty: 0.4, severity: "info",
    assumptions: ["Gradient-style update is appropriate", "Learning rate is tuned"],
    limitations: ["Learning updates must be governed and version-controlled", "Single-step update may not converge"],
    proof_trace: { mathematical_basis: ["parameter calibration", "gradient-style update"], calculation_steps: ["new = " + old + " - " + lr + "*" + err + " = " + updated], required_human_review: true }
  });
}

// ============================================================
// ENGINE MAP
// ============================================================

var ENGINE_MAP = {
  "202": calcNonlinearDynamics, "NONLINEAR_DYNAMICS": calcNonlinearDynamics,
  "207": calcDigitalTwin, "DIGITAL_TWIN_STATE_SPACE": calcDigitalTwin,
  "217": calcPDETransport, "PDE_TRANSPORT": calcPDETransport,
  "225": calcThermodynamics, "THERMODYNAMICS_ENERGY": calcThermodynamics,
  "226": calcElectrochemKinetics, "ELECTROCHEM_KINETICS": calcElectrochemKinetics,
  "227": calcCompositeAnisotropic, "COMPOSITE_ANISOTROPIC": calcCompositeAnisotropic,
  "228": calcCoatingBarrier, "COATING_BARRIER_TRANSPORT": calcCoatingBarrier,
  "231": calcAerospacePhysics, "AEROSPACE_SPACE": calcAerospacePhysics,
  "233": calcFireBlast, "FIRE_BLAST": calcFireBlast,
  "238": calcLearningCalibration, "LEARNING_CALIBRATION": calcLearningCalibration
};

function logRun(body, result) { try { var sb = createClient(supabaseUrl, supabaseKey); sb.from("advanced_math_engine_runs").insert({ org_id: body.org_id || null, case_id: body.case_id || null, asset_id: body.asset_id || null, finding_id: body.finding_id || null, engine_number: result.engine_number, engine_code: result.engine_code, input_payload: body.inputs || body.input || {}, output_payload: result.result, confidence: result.confidence, uncertainty: result.uncertainty, severity: result.severity, assumptions: result.assumptions, limitations: result.limitations, missing_inputs: result.missing_inputs, proof_trace: result.proof_trace }); } catch (e) {} }

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };
  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";
    if (action === "get_registry") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, deploy: DEPLOY, mode: "deterministic", purpose: "Advanced Transport Engine — nonlinear dynamics, digital twin, PDE transport, thermodynamics, electrochemistry, composites, coating barrier, aerospace, fire/blast, learning calibration", sub_engines: [202, 207, 217, 225, 226, 227, 228, 231, 233, 238], actions: ["run_engine", "get_registry"] }) };
    }
    if (action === "run_engine") {
      var engineKey = String(body.engine_number || body.engine_code || "");
      var fn = ENGINE_MAP[engineKey];
      if (!fn) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown sub-engine: " + engineKey }) };
      var result = fn(body.inputs || body.input || {});
      logRun(body, result);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: result }, null, 2) };
    }
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
  } catch (err) { return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) }; }
};
