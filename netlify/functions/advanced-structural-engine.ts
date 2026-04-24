// @ts-nocheck
/**
 * DEPLOY306 - advanced-structural-engine.ts
 * netlify/functions/advanced-structural-engine.ts
 *
 * ADVANCED STRUCTURAL ENGINE — ENGINE 96
 *
 * Sub-engines 210, 216, 223, 224, 229, 230, 232:
 *   210 - Multi-Physics Coupling (multiplicative damage factors)
 *   216 - Tensor Stress + Strain (3D von Mises, principal stresses)
 *   223 - Finite Difference Approximation (second derivative)
 *   224 - Fluid-Structure Interaction (vortex shedding frequency)
 *   229 - Civil Structural (Euler buckling demand/capacity)
 *   230 - Marine Subsea Hydrodynamics (drag force)
 *   232 - Rotating Machinery Dynamics (shaft and defect frequencies)
 *
 * POST /api/advanced-structural-engine
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var ENGINE_ID = "advanced-structural-engine";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY306";
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
// 210 — MULTI-PHYSICS COUPLING
// ============================================================

function calcMultiPhysicsCoupling(inp) {
  var m = getMissing(inp, ["base_damage_rate", "stress_factor", "thermal_factor", "vibration_factor", "coating_factor", "time"]);
  if (m.length) return holdResult(210, "MULTIPHYSICS_COUPLING", m);
  var base = num(inp.base_damage_rate), sf = num(inp.stress_factor), tf = num(inp.thermal_factor);
  var vf = num(inp.vibration_factor), cf = num(inp.coating_factor), time = num(inp.time);
  var coupledRate = base * sf * tf * vf * cf;
  var accumulated = coupledRate * time;
  return buildResult(210, "MULTIPHYSICS_COUPLING", {
    result: { coupled_damage_rate: coupledRate, accumulated_damage: accumulated },
    interpretation: "Coupled damage rate is " + coupledRate.toFixed(4) + " and accumulated damage is " + accumulated.toFixed(4) + ".",
    confidence: 0.74, uncertainty: 0.26,
    severity: accumulated > 1 ? "critical" : accumulated > 0.7 ? "high" : accumulated > 0.4 ? "medium" : "low",
    assumptions: ["Multiplicative coupling is appropriate for screening"],
    limitations: ["True coupled physics may require calibrated nonlinear model"],
    proof_trace: { mathematical_basis: ["multi-physics damage coupling", "time accumulation"], calculation_steps: ["rate=" + base + "*" + sf + "*" + tf + "*" + vf + "*" + cf + "=" + coupledRate, "damage=" + coupledRate + "*" + time + "=" + accumulated], required_human_review: accumulated > 0.7 }
  });
}

// ============================================================
// 216 — TENSOR STRESS + STRAIN (3D VON MISES)
// ============================================================

function calcTensorStress(inp) {
  var m = getMissing(inp, ["s1", "s2", "s3"]);
  if (m.length) return holdResult(216, "TENSOR_STRESS_STRAIN", m);
  var s1 = num(inp.s1), s2 = num(inp.s2), s3 = num(inp.s3);
  var vm = Math.sqrt(0.5 * ((s1 - s2) * (s1 - s2) + (s2 - s3) * (s2 - s3) + (s3 - s1) * (s3 - s1)));
  var allowable = num(inp.allowable, null);
  var sev = "medium";
  if (allowable !== null && vm > allowable) sev = "critical";
  else if (allowable !== null && vm > allowable * 0.9) sev = "high";
  return buildResult(216, "TENSOR_STRESS_STRAIN", {
    result: { von_mises_3d: vm, principal_stresses: [s1, s2, s3] },
    interpretation: "3D von Mises stress is " + vm.toFixed(3) + " MPa." + (sev === "critical" ? " EXCEEDS allowable stress." : ""),
    confidence: 0.82, uncertainty: 0.18, severity: sev,
    assumptions: ["Principal stresses are correctly determined"],
    limitations: ["Does not account for residual stress or dynamic loading without additional input"],
    proof_trace: { mathematical_basis: ["stress tensor invariants", "3D von Mises"], calculation_steps: ["vm = sqrt(0.5*((s1-s2)^2+(s2-s3)^2+(s3-s1)^2)) = " + vm], required_human_review: true }
  });
}

// ============================================================
// 223 — FINITE DIFFERENCE APPROXIMATION
// ============================================================

function calcNumericalApprox(inp) {
  var m = getMissing(inp, ["left", "center", "right", "dx"]);
  if (m.length) return holdResult(223, "NUMERICAL_APPROX", m);
  var left = num(inp.left), center = num(inp.center), right = num(inp.right), dx = num(inp.dx);
  var d2 = (left - 2 * center + right) / (dx * dx);
  return buildResult(223, "NUMERICAL_APPROX", {
    result: { second_derivative: d2 },
    interpretation: "Finite difference second derivative is " + d2.toFixed(4) + ".",
    confidence: 0.7, uncertainty: 0.3, severity: "info",
    assumptions: ["Equally spaced grid points", "Smooth underlying function"],
    limitations: ["Accuracy depends on grid spacing — smaller dx gives better approximation"],
    proof_trace: { mathematical_basis: ["central finite difference"], calculation_steps: ["d2f/dx2 = (f_left - 2*f_center + f_right)/dx^2 = " + d2], required_human_review: false }
  });
}

// ============================================================
// 224 — FLUID-STRUCTURE INTERACTION
// ============================================================

function calcFluidStructure(inp) {
  var m = getMissing(inp, ["St", "v", "D"]);
  if (m.length) return holdResult(224, "FLUID_STRUCTURE", m);
  var St = num(inp.St), v = num(inp.v), D = num(inp.D);
  var f = St * v / D;
  var fn = num(inp.natural_frequency, null);
  var ratio = fn !== null ? f / fn : null;
  var sev = ratio !== null && Math.abs(ratio - 1) < 0.15 ? "high" : "medium";
  return buildResult(224, "FLUID_STRUCTURE", {
    result: { vortex_shedding_frequency: f, frequency_ratio: ratio },
    interpretation: "Vortex shedding frequency is " + f.toFixed(3) + " Hz." + (ratio !== null ? " Frequency ratio to natural frequency is " + ratio.toFixed(3) + "." : "") + (sev === "high" ? " WARNING — near resonance condition." : ""),
    confidence: 0.76, uncertainty: 0.24, severity: sev,
    assumptions: ["Strouhal number is appropriate for the cross-section shape", "Steady flow conditions"],
    limitations: ["Turbulence intensity and multi-mode response not captured"],
    proof_trace: { mathematical_basis: ["Strouhal relation", "vortex-induced vibration"], calculation_steps: ["f = St*v/D = " + St + "*" + v + "/" + D + " = " + f], required_human_review: sev === "high" }
  });
}

// ============================================================
// 229 — CIVIL STRUCTURAL (EULER BUCKLING)
// ============================================================

function calcCivilStructural(inp) {
  var m = getMissing(inp, ["P", "L", "E", "I", "K"]);
  if (m.length) return holdResult(229, "CIVIL_ARCH_STRUCTURAL", m);
  var P = num(inp.P), L = num(inp.L), E = num(inp.E), Iv = num(inp.I), K = num(inp.K);
  var Pcr = Math.PI * Math.PI * E * Iv / ((K * L) * (K * L));
  var ratio = P / Pcr;
  return buildResult(229, "CIVIL_ARCH_STRUCTURAL", {
    result: { euler_buckling_capacity: Pcr, demand_capacity_ratio: ratio, applied_load: P },
    interpretation: "Euler buckling capacity is " + Pcr.toFixed(1) + ". Demand/capacity ratio is " + ratio.toFixed(3) + "." + (ratio > 1 ? " EXCEEDS buckling capacity — failure predicted." : ratio > 0.8 ? " Approaching capacity limit." : ""),
    confidence: 0.78, uncertainty: 0.22,
    severity: ratio > 1 ? "critical" : ratio > 0.8 ? "high" : ratio > 0.6 ? "medium" : "low",
    assumptions: ["Ideal column with uniform cross-section", "Effective length factor K is correct for boundary conditions"],
    limitations: ["Does not account for imperfections, residual stress, or lateral-torsional buckling"],
    proof_trace: { mathematical_basis: ["Euler buckling"], calculation_steps: ["Pcr = pi^2*E*I/(K*L)^2 = " + Pcr, "ratio = P/Pcr = " + ratio], required_human_review: ratio > 0.8 }
  });
}

// ============================================================
// 230 — MARINE SUBSEA HYDRODYNAMICS (DRAG)
// ============================================================

function calcMarineHydro(inp) {
  var m = getMissing(inp, ["rho", "Cd", "A", "v"]);
  if (m.length) return holdResult(230, "MARINE_SUBSEA_HYDRO", m);
  var rho = num(inp.rho), Cd = num(inp.Cd), A = num(inp.A), v = num(inp.v);
  var Fd = 0.5 * rho * Cd * A * v * v;
  return buildResult(230, "MARINE_SUBSEA_HYDRO", {
    result: { drag_force: Fd },
    interpretation: "Hydrodynamic drag force is " + Fd.toFixed(3) + " N.",
    confidence: 0.78, uncertainty: 0.22, severity: "medium",
    assumptions: ["Steady-state flow", "Drag coefficient is valid for Reynolds number range"],
    limitations: ["Does not include added mass, inertia, or wave orbital velocity components"],
    proof_trace: { mathematical_basis: ["drag equation"], calculation_steps: ["Fd = 0.5*rho*Cd*A*v^2 = 0.5*" + rho + "*" + Cd + "*" + A + "*" + v + "^2 = " + Fd], required_human_review: false }
  });
}

// ============================================================
// 232 — ROTATING MACHINERY DYNAMICS
// ============================================================

function calcRotatingMachinery(inp) {
  var m = getMissing(inp, ["rpm", "bearing_defect_multiplier"]);
  if (m.length) return holdResult(232, "ROTATING_MACHINERY", m);
  var rpm = num(inp.rpm), bdm = num(inp.bearing_defect_multiplier);
  var shaftHz = rpm / 60;
  var defectHz = shaftHz * bdm;
  var fn = num(inp.natural_frequency, null);
  var nearResonance = fn !== null && Math.abs(defectHz - fn) / fn < 0.1;
  return buildResult(232, "ROTATING_MACHINERY", {
    result: { shaft_frequency_hz: shaftHz, defect_frequency_hz: defectHz, near_resonance: nearResonance },
    interpretation: "Shaft frequency is " + shaftHz.toFixed(2) + " Hz; expected bearing defect frequency is " + defectHz.toFixed(2) + " Hz." + (nearResonance ? " WARNING — defect frequency near structural natural frequency." : ""),
    confidence: 0.8, uncertainty: 0.2,
    severity: nearResonance ? "high" : "info",
    assumptions: ["Bearing geometry multiplier is correct for the bearing type"],
    limitations: ["Does not account for sidebands, harmonics, or modulation effects"],
    proof_trace: { mathematical_basis: ["rotating machinery frequency analysis"], calculation_steps: ["shaftHz = " + rpm + "/60 = " + shaftHz, "defectHz = " + shaftHz + "*" + bdm + " = " + defectHz], required_human_review: nearResonance }
  });
}

// ============================================================
// ENGINE MAP
// ============================================================

var ENGINE_MAP = {
  "210": calcMultiPhysicsCoupling, "MULTIPHYSICS_COUPLING": calcMultiPhysicsCoupling,
  "216": calcTensorStress, "TENSOR_STRESS_STRAIN": calcTensorStress,
  "223": calcNumericalApprox, "NUMERICAL_APPROX": calcNumericalApprox,
  "224": calcFluidStructure, "FLUID_STRUCTURE": calcFluidStructure,
  "229": calcCivilStructural, "CIVIL_ARCH_STRUCTURAL": calcCivilStructural,
  "230": calcMarineHydro, "MARINE_SUBSEA_HYDRO": calcMarineHydro,
  "232": calcRotatingMachinery, "ROTATING_MACHINERY": calcRotatingMachinery
};

function logRun(body, result) { try { var sb = createClient(supabaseUrl, supabaseKey); sb.from("advanced_math_engine_runs").insert({ org_id: body.org_id || null, case_id: body.case_id || null, asset_id: body.asset_id || null, finding_id: body.finding_id || null, engine_number: result.engine_number, engine_code: result.engine_code, input_payload: body.inputs || body.input || {}, output_payload: result.result, confidence: result.confidence, uncertainty: result.uncertainty, severity: result.severity, assumptions: result.assumptions, limitations: result.limitations, missing_inputs: result.missing_inputs, proof_trace: result.proof_trace }); } catch (e) {} }

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };
  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";
    if (action === "get_registry") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, deploy: DEPLOY, mode: "deterministic", purpose: "Advanced Structural Engine — multi-physics coupling, 3D tensor stress, finite difference, fluid-structure interaction, civil buckling, marine hydrodynamics, rotating machinery", sub_engines: [210, 216, 223, 224, 229, 230, 232], actions: ["run_engine", "get_registry"] }) };
    }
    if (action === "run_engine") {
      var engineKey = String(body.engine_number || body.engine_code || "");
      var fn = ENGINE_MAP[engineKey];
      if (!fn) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown sub-engine: " + engineKey }) };
      var inputs = body.inputs || body.input || {};
      var result = fn(inputs);
      logRun(body, result);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: result }, null, 2) };
    }
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
  } catch (err) { return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) }; }
};
