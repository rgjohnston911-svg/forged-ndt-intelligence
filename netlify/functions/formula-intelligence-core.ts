// @ts-nocheck
/**
 * DEPLOY301 - formula-intelligence-core.ts
 * netlify/functions/formula-intelligence-core.ts
 *
 * FORMULA INTELLIGENCE CORE — ENGINE 91
 *
 * The mathematical authority layer for the 4D NDT platform.
 * Contains all 33 deterministic formulas across 10 categories.
 * Every formula returns a structured result with severity,
 * confidence, interpretation, assumptions, limitations,
 * and missing-input tracking.
 *
 * When required inputs are missing, the formula returns
 * severity="hold_for_input" — never silently guesses.
 *
 * POST /api/formula-intelligence-core
 *
 * Actions:
 *   get_registry    - engine metadata
 *   get_formulas    - list all available formulas
 *   get_categories  - list formula categories
 *   run_formula     - execute a single formula
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var ENGINE_ID = "formula-intelligence-core";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY301";
var corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };

// ============================================================
// HELPERS
// ============================================================

function num(v) {
  var n = Number(v);
  if (v === undefined || v === null || v === "" || isNaN(n)) return null;
  return n;
}

function getMissing(inputs, keys) {
  var m = [];
  for (var i = 0; i < keys.length; i++) {
    if (inputs[keys[i]] === undefined || inputs[keys[i]] === null || inputs[keys[i]] === "") {
      m.push(keys[i]);
    }
  }
  return m;
}

function clamp01(v) {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function buildResult(formulaCode, value, unit, severity, confidence, interpretation, extras) {
  var r = {
    formula_code: formulaCode,
    result_value: value,
    result_unit: unit || null,
    severity: severity || "medium",
    confidence: clamp01(confidence || 0.7),
    interpretation: interpretation || "",
    missing_inputs: (extras && extras.missing_inputs) ? extras.missing_inputs : [],
    assumptions_used: (extras && extras.assumptions) ? extras.assumptions : [],
    limitations_triggered: (extras && extras.limitations) ? extras.limitations : [],
    output: (extras && extras.output) ? extras.output : {},
    trace: (extras && extras.trace) ? extras.trace : {}
  };
  return r;
}

function holdResult(formulaCode, missingKeys) {
  return buildResult(
    formulaCode,
    null,
    null,
    "hold_for_input",
    0.1,
    "Cannot compute — missing required inputs: " + missingKeys.join(", ") + ". Provide measured values before proceeding.",
    { missing_inputs: missingKeys }
  );
}

// ============================================================
// FORMULA IMPLEMENTATIONS
// ============================================================

function calcHoopStress(inp) {
  var m = getMissing(inp, ["P", "D", "t"]);
  if (m.length) return holdResult("HOOP_STRESS", m);
  var P = num(inp.P), D = num(inp.D), t = num(inp.t);
  var sigma = (P * D) / (2 * t);
  var sev = "low";
  if (inp.S_allow) {
    var ratio = sigma / num(inp.S_allow);
    if (ratio > 1) sev = "critical";
    else if (ratio > 0.9) sev = "high";
    else if (ratio > 0.75) sev = "medium";
  }
  return buildResult("HOOP_STRESS", sigma, "MPa", sev, 0.85,
    "Hoop stress is " + sigma.toFixed(2) + " MPa. " + (sev === "critical" ? "EXCEEDS allowable — immediate review required." : sev === "high" ? "Approaching allowable stress limit." : "Within acceptable range."),
    { assumptions: ["Thin-wall assumption (D/t > 10)"], limitations: ["Not valid for thick-walled cylinders"], output: { sigma_h: sigma, P: P, D: D, t: t } });
}

function calcLongStress(inp) {
  var m = getMissing(inp, ["P", "D", "t"]);
  if (m.length) return holdResult("LONGITUDINAL_STRESS", m);
  var P = num(inp.P), D = num(inp.D), t = num(inp.t);
  var sigma = (P * D) / (4 * t);
  return buildResult("LONGITUDINAL_STRESS", sigma, "MPa", "low", 0.85,
    "Longitudinal stress is " + sigma.toFixed(2) + " MPa.",
    { assumptions: ["Thin-wall assumption"], output: { sigma_L: sigma } });
}

function calcVonMises2D(inp) {
  var m = getMissing(inp, ["s1", "s2", "tau"]);
  if (m.length) return holdResult("VON_MISES_2D", m);
  var s1 = num(inp.s1), s2 = num(inp.s2), tau = num(inp.tau);
  var vm = Math.sqrt(s1 * s1 - s1 * s2 + s2 * s2 + 3 * tau * tau);
  return buildResult("VON_MISES_2D", vm, "MPa", "medium", 0.85,
    "Von Mises equivalent stress is " + vm.toFixed(2) + " MPa.",
    { assumptions: ["Plane stress assumed"], output: { sigma_vm: vm } });
}

function calcThermalStress(inp) {
  var m = getMissing(inp, ["E", "alpha", "deltaT"]);
  if (m.length) return holdResult("THERMAL_STRESS", m);
  var E = num(inp.E), alpha = num(inp.alpha), dT = num(inp.deltaT);
  var sigma = E * alpha * dT;
  return buildResult("THERMAL_STRESS", sigma, "MPa", "medium", 0.80,
    "Thermal stress is " + sigma.toFixed(2) + " MPa under full constraint.",
    { assumptions: ["Fully constrained condition"], limitations: ["Partial constraint requires FEA"], output: { sigma_T: sigma } });
}

function calcStressConcentration(inp) {
  var m = getMissing(inp, ["Kt", "sigma_nom"]);
  if (m.length) return holdResult("STRESS_CONCENTRATION", m);
  var Kt = num(inp.Kt), sn = num(inp.sigma_nom);
  var peak = Kt * sn;
  return buildResult("STRESS_CONCENTRATION", peak, "MPa", "medium", 0.80,
    "Peak stress at discontinuity is " + peak.toFixed(2) + " MPa (Kt=" + Kt + ").",
    { assumptions: ["Kt from handbook or FEA"], output: { sigma_peak: peak, Kt: Kt } });
}

function calcMAWP(inp) {
  var m = getMissing(inp, ["S", "E_weld", "t", "D"]);
  if (m.length) return holdResult("MAWP_CYLINDRICAL", m);
  var S = num(inp.S), Ew = num(inp.E_weld), t = num(inp.t), D = num(inp.D);
  var mawp = (2 * S * Ew * t) / (D - 2 * t);
  return buildResult("MAWP_CYLINDRICAL", mawp, "MPa", "medium", 0.85,
    "MAWP for cylindrical shell is " + mawp.toFixed(3) + " MPa.",
    { assumptions: ["Uniform wall thickness", "No corrosion allowance applied here"], output: { MAWP: mawp } });
}

function calcMinThickness(inp) {
  var m = getMissing(inp, ["P", "R", "S", "E_weld"]);
  if (m.length) return holdResult("MIN_THICKNESS", m);
  var P = num(inp.P), R = num(inp.R), S = num(inp.S), Ew = num(inp.E_weld);
  var tmin = (P * R) / (S * Ew - 0.6 * P);
  return buildResult("MIN_THICKNESS", tmin, "mm", "medium", 0.85,
    "Minimum required thickness is " + tmin.toFixed(3) + " mm. Must add corrosion allowance.",
    { assumptions: ["Circumferential stress governs"], limitations: ["Must add corrosion allowance to result"], output: { t_min: tmin } });
}

function calcWeldHeatInput(inp) {
  var m = getMissing(inp, ["V", "I", "speed"]);
  if (m.length) return holdResult("WELD_HEAT_INPUT", m);
  var V = num(inp.V), I = num(inp.I), sp = num(inp.speed);
  var hi = (V * I * 60) / (sp * 1000);
  return buildResult("WELD_HEAT_INPUT", hi, "kJ/mm", "low", 0.90,
    "Weld heat input is " + hi.toFixed(3) + " kJ/mm.",
    { assumptions: ["No efficiency factor applied"], output: { heat_input: hi } });
}

function calcCarbonEquivalent(inp) {
  var m = getMissing(inp, ["C", "Mn"]);
  if (m.length) return holdResult("CARBON_EQUIVALENT_IIW", m);
  var C = num(inp.C), Mn = num(inp.Mn);
  var Cr = num(inp.Cr) || 0, Mo = num(inp.Mo) || 0, V = num(inp.V) || 0;
  var Ni = num(inp.Ni) || 0, Cu = num(inp.Cu) || 0;
  var CE = C + Mn / 6 + (Cr + Mo + V) / 5 + (Ni + Cu) / 15;
  var sev = CE > 0.50 ? "high" : CE > 0.45 ? "medium" : "low";
  return buildResult("CARBON_EQUIVALENT_IIW", CE, "dimensionless", sev, 0.88,
    "IIW Carbon Equivalent is " + CE.toFixed(4) + ". " + (CE > 0.45 ? "Elevated cracking risk — preheat likely required." : "Acceptable weldability range."),
    { assumptions: ["Standard alloy content analysis available"], output: { CE_IIW: CE } });
}

function calcPCM(inp) {
  var m = getMissing(inp, ["C", "Si", "Mn"]);
  if (m.length) return holdResult("PCM_LOW_CARBON", m);
  var C = num(inp.C), Si = num(inp.Si), Mn = num(inp.Mn);
  var Cu = num(inp.Cu) || 0, Ni = num(inp.Ni) || 0, Cr = num(inp.Cr) || 0;
  var Mo = num(inp.Mo) || 0, V = num(inp.V) || 0, B = num(inp.B) || 0;
  var Pcm = C + Si / 30 + Mn / 20 + Cu / 20 + Ni / 60 + Cr / 20 + Mo / 15 + V / 10 + 5 * B;
  var sev = Pcm > 0.25 ? "high" : Pcm > 0.20 ? "medium" : "low";
  return buildResult("PCM_LOW_CARBON", Pcm, "dimensionless", sev, 0.88,
    "Ito-Bessyo Pcm is " + Pcm.toFixed(4) + ". " + (Pcm > 0.25 ? "Elevated cold cracking risk." : "Acceptable for low-carbon steel welding."),
    { assumptions: ["Low-carbon steel (C < 0.18%)"], output: { Pcm: Pcm } });
}

function calcRemainingLife(inp) {
  var m = getMissing(inp, ["t_actual", "t_min", "CR"]);
  if (m.length) return holdResult("REMAINING_LIFE", m);
  var ta = num(inp.t_actual), tmin = num(inp.t_min), cr = num(inp.CR);
  if (cr <= 0) return buildResult("REMAINING_LIFE", null, "years", "medium", 0.5, "Corrosion rate is zero or negative — remaining life is theoretically infinite but verify CR measurement.", { assumptions: ["CR must be positive and representative"] });
  var rl = (ta - tmin) / cr;
  var sev = rl < 2 ? "critical" : rl < 5 ? "high" : rl < 10 ? "medium" : "low";
  return buildResult("REMAINING_LIFE", rl, "years", sev, 0.82,
    "Remaining life is " + rl.toFixed(1) + " years at current corrosion rate of " + cr + " mm/yr.",
    { assumptions: ["Corrosion rate is steady and representative"], limitations: ["Does not account for accelerating corrosion"], output: { remaining_life: rl, t_actual: ta, t_min: tmin, CR: cr } });
}

function calcErosionalVelocity(inp) {
  var m = getMissing(inp, ["C_factor", "rho_mix"]);
  if (m.length) return holdResult("EROSIONAL_VELOCITY", m);
  var Cf = num(inp.C_factor), rho = num(inp.rho_mix);
  var Ve = Cf / Math.sqrt(rho);
  return buildResult("EROSIONAL_VELOCITY", Ve, "m/s", "medium", 0.80,
    "API 14E erosional velocity limit is " + Ve.toFixed(2) + " m/s.",
    { assumptions: ["Homogeneous mixture assumed"], output: { Ve: Ve } });
}

function calcStressIntensity(inp) {
  var m = getMissing(inp, ["Y", "sigma", "a"]);
  if (m.length) return holdResult("STRESS_INTENSITY", m);
  var Y = num(inp.Y), sigma = num(inp.sigma), a = num(inp.a);
  var KI = Y * sigma * Math.sqrt(Math.PI * a);
  var sev = "medium";
  if (inp.K_IC) {
    var ratio = KI / num(inp.K_IC);
    if (ratio > 1) sev = "critical";
    else if (ratio > 0.8) sev = "high";
  }
  return buildResult("STRESS_INTENSITY", KI, "MPa-sqrt-m", sev, 0.78,
    "Mode I stress intensity factor is " + KI.toFixed(3) + " MPa-sqrt-m. " + (sev === "critical" ? "EXCEEDS fracture toughness — failure predicted." : ""),
    { assumptions: ["LEFM applies"], trace: { requires_engineer_review: true }, output: { K_I: KI } });
}

function calcParisLaw(inp) {
  var m = getMissing(inp, ["C_paris", "m_paris", "delta_K"]);
  if (m.length) return holdResult("PARIS_LAW", m);
  var C = num(inp.C_paris), mp = num(inp.m_paris), dK = num(inp.delta_K);
  var dadN = C * Math.pow(dK, mp);
  return buildResult("PARIS_LAW", dadN, "mm/cycle", "high", 0.75,
    "Fatigue crack growth rate is " + dadN.toExponential(3) + " mm/cycle.",
    { assumptions: ["Region II (Paris regime) applies"], trace: { requires_engineer_review: true }, output: { da_dN: dadN } });
}

function calcMinersRule(inp) {
  var blocks = inp.load_blocks;
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) return holdResult("MINERS_RULE", ["load_blocks"]);
  var D = 0;
  for (var i = 0; i < blocks.length; i++) {
    var ni = num(blocks[i].n);
    var Ni = num(blocks[i].N);
    if (ni === null || Ni === null || Ni <= 0) continue;
    D += ni / Ni;
  }
  var sev = D >= 1 ? "critical" : D >= 0.7 ? "high" : D >= 0.4 ? "medium" : "low";
  return buildResult("MINERS_RULE", D, "dimensionless", sev, 0.78,
    "Miner cumulative damage fraction is " + D.toFixed(4) + ". " + (D >= 1 ? "Fatigue failure predicted." : ""),
    { assumptions: ["Linear damage accumulation"], limitations: ["Does not account for load sequence effects"], output: { D_miner: D } });
}

function calcLarsonMiller(inp) {
  var m = getMissing(inp, ["T_K", "t_r", "C_lm"]);
  if (m.length) return holdResult("LARSON_MILLER", m);
  var TK = num(inp.T_K), tr = num(inp.t_r), Clm = num(inp.C_lm);
  var LMP = TK * (Clm + Math.log10(tr));
  return buildResult("LARSON_MILLER", LMP, "dimensionless", "high", 0.72,
    "Larson-Miller parameter is " + LMP.toFixed(1) + ".",
    { assumptions: ["Steady-state creep conditions"], trace: { requires_engineer_review: true }, output: { LMP: LMP } });
}

function calcUTWavelength(inp) {
  var m = getMissing(inp, ["v", "f"]);
  if (m.length) return holdResult("UT_WAVELENGTH", m);
  var v = num(inp.v), f = num(inp.f);
  var lam = v / f;
  return buildResult("UT_WAVELENGTH", lam, "mm", "info", 0.92,
    "Ultrasonic wavelength is " + lam.toFixed(4) + " mm.",
    { assumptions: ["Homogeneous isotropic material"], output: { lambda: lam } });
}

function calcUTNearField(inp) {
  var m = getMissing(inp, ["D_t", "f", "v"]);
  if (m.length) return holdResult("UT_NEAR_FIELD", m);
  var Dt = num(inp.D_t), f = num(inp.f), v = num(inp.v);
  var N = (Dt * Dt * f) / (4 * v);
  return buildResult("UT_NEAR_FIELD", N, "mm", "info", 0.90,
    "Near field length is " + N.toFixed(2) + " mm. Reliable flaw detection begins beyond this distance.",
    { assumptions: ["Circular transducer", "Flat entry surface"], output: { near_field: N } });
}

function calcUTBeamSpread(inp) {
  var m = getMissing(inp, ["lambda", "D_t"]);
  if (m.length) return holdResult("UT_BEAM_SPREAD", m);
  var lam = num(inp.lambda), Dt = num(inp.D_t);
  var sinTheta = 1.22 * lam / Dt;
  if (sinTheta > 1) sinTheta = 1;
  var theta = Math.asin(sinTheta) * (180 / Math.PI);
  return buildResult("UT_BEAM_SPREAD", theta, "degrees", "info", 0.88,
    "Beam spread half-angle is " + theta.toFixed(2) + " degrees.",
    { assumptions: ["Far-field condition", "Circular transducer"], output: { theta_half: theta } });
}

function calcSnellsLaw(inp) {
  var m = getMissing(inp, ["theta1", "v1", "v2"]);
  if (m.length) return holdResult("SNELLS_LAW", m);
  var t1 = num(inp.theta1), v1 = num(inp.v1), v2 = num(inp.v2);
  var t1rad = t1 * Math.PI / 180;
  var sinT2 = Math.sin(t1rad) * v2 / v1;
  if (sinT2 > 1) return buildResult("SNELLS_LAW", null, "degrees", "info", 0.88, "Total internal reflection — refracted angle exceeds 90 degrees at this incidence angle and velocity ratio.", { output: { total_reflection: true } });
  var t2 = Math.asin(sinT2) * 180 / Math.PI;
  return buildResult("SNELLS_LAW", t2, "degrees", "info", 0.90,
    "Refracted angle is " + t2.toFixed(2) + " degrees.",
    { assumptions: ["Planar interface", "Isotropic materials"], output: { theta2: t2 } });
}

function calcRTUnsharpness(inp) {
  var m = getMissing(inp, ["f_source", "t_obj", "SFD"]);
  if (m.length) return holdResult("RT_UNSHARPNESS", m);
  var f = num(inp.f_source), tobj = num(inp.t_obj), SFD = num(inp.SFD);
  var Ug = f * tobj / SFD;
  return buildResult("RT_UNSHARPNESS", Ug, "mm", "info", 0.88,
    "Geometric unsharpness is " + Ug.toFixed(4) + " mm.",
    { assumptions: ["Single-wall single-image geometry"], output: { Ug: Ug } });
}

function calcPOD(inp) {
  var m = getMissing(inp, ["a", "alpha_pod", "beta_pod"]);
  if (m.length) return holdResult("POD_CURVE", m);
  var a = num(inp.a), alpha = num(inp.alpha_pod), beta = num(inp.beta_pod);
  var pod = 1 / (1 + Math.exp(-(alpha + beta * a)));
  var sev = pod < 0.5 ? "high" : pod < 0.9 ? "medium" : "low";
  return buildResult("POD_CURVE", pod, "probability", sev, 0.80,
    "Probability of detection for flaw size " + a + " is " + (pod * 100).toFixed(1) + "%." + (pod < 0.9 ? " Below 90% — consider supplementary methods." : ""),
    { assumptions: ["POD model parameters calibrated for specific method and procedure"], trace: { requires_engineer_review: true }, output: { POD: pod } });
}

function calcDFTfromWFT(inp) {
  var m = getMissing(inp, ["WFT", "VS"]);
  if (m.length) return holdResult("DFT_FROM_WFT", m);
  var WFT = num(inp.WFT), VS = num(inp.VS);
  var DFT = WFT * VS / 100;
  return buildResult("DFT_FROM_WFT", DFT, "microns", "info", 0.88,
    "Expected DFT is " + DFT.toFixed(1) + " microns from WFT of " + WFT + " microns at " + VS + "% volume solids.",
    { assumptions: ["Uniform application", "No solvent entrapment"], output: { DFT: DFT } });
}

function calcDewPoint(inp) {
  var m = getMissing(inp, ["T_air", "RH"]);
  if (m.length) return holdResult("DEW_POINT", m);
  var T = num(inp.T_air), RH = num(inp.RH);
  var a = 17.27, b = 237.7;
  var gamma = (a * T) / (b + T) + Math.log(RH / 100);
  var Td = (b * gamma) / (a - gamma);
  return buildResult("DEW_POINT", Td, "C", "info", 0.90,
    "Dew point is " + Td.toFixed(1) + " C. Surface must be at least 3C above dew point for coating application.",
    { assumptions: ["Standard atmospheric pressure"], output: { Td: Td, T_air: T, RH: RH } });
}

function calcOsmoticPressure(inp) {
  var m = getMissing(inp, ["M", "R_gas", "T_K"]);
  if (m.length) return holdResult("OSMOTIC_PRESSURE", m);
  var M = num(inp.M), Rg = num(inp.R_gas), TK = num(inp.T_K);
  var Pi = M * Rg * TK;
  return buildResult("OSMOTIC_PRESSURE", Pi, "Pa", "medium", 0.78,
    "Osmotic driving pressure is " + Pi.toFixed(1) + " Pa.",
    { assumptions: ["Dilute solution approximation"], limitations: ["Real coatings have complex permeability behavior"], output: { Pi: Pi } });
}

function calcAnodeLife(inp) {
  var m = getMissing(inp, ["W", "U", "E_cap", "I_req"]);
  if (m.length) return holdResult("ANODE_LIFE", m);
  var W = num(inp.W), U = num(inp.U), Ec = num(inp.E_cap), Ir = num(inp.I_req);
  var life = (W * U * Ec) / (Ir * 8760);
  var sev = life < 2 ? "critical" : life < 5 ? "high" : life < 10 ? "medium" : "low";
  return buildResult("ANODE_LIFE", life, "years", sev, 0.80,
    "Estimated anode life is " + life.toFixed(1) + " years." + (life < 2 ? " CRITICAL — anode replacement required." : ""),
    { assumptions: ["Constant current demand", "Uniform anode consumption"], output: { anode_life: life } });
}

function calcPotentialAttenuation(inp) {
  var m = getMissing(inp, ["V0", "alpha", "x"]);
  if (m.length) return holdResult("POTENTIAL_ATTENUATION", m);
  var V0 = num(inp.V0), alpha = num(inp.alpha), x = num(inp.x);
  var Vx = V0 * Math.exp(-alpha * x);
  return buildResult("POTENTIAL_ATTENUATION", Vx, "mV", "medium", 0.78,
    "CP potential at " + x + " m from source is " + Vx.toFixed(1) + " mV.",
    { assumptions: ["Uniform coating condition", "Constant soil resistivity"], output: { V_at_x: Vx } });
}

function calcReynoldsNumber(inp) {
  var m = getMissing(inp, ["rho", "v", "D_pipe", "mu"]);
  if (m.length) return holdResult("REYNOLDS_NUMBER", m);
  var rho = num(inp.rho), v = num(inp.v), D = num(inp.D_pipe), mu = num(inp.mu);
  var Re = (rho * v * D) / mu;
  var regime = Re < 2300 ? "laminar" : Re < 4000 ? "transitional" : "turbulent";
  return buildResult("REYNOLDS_NUMBER", Re, "dimensionless", "info", 0.90,
    "Reynolds number is " + Re.toFixed(0) + " (" + regime + " flow).",
    { assumptions: ["Steady flow", "Newtonian fluid"], output: { Re: Re, regime: regime } });
}

function calcDarcyWeisbach(inp) {
  var m = getMissing(inp, ["f_D", "L", "D_pipe", "rho", "v"]);
  if (m.length) return holdResult("DARCY_WEISBACH", m);
  var fD = num(inp.f_D), L = num(inp.L), D = num(inp.D_pipe), rho = num(inp.rho), v = num(inp.v);
  var dP = fD * (L / D) * (rho * v * v / 2);
  return buildResult("DARCY_WEISBACH", dP, "Pa", "info", 0.85,
    "Frictional pressure drop is " + dP.toFixed(1) + " Pa over " + L + " m.",
    { assumptions: ["Fully developed flow", "Constant cross-section"], output: { delta_P: dP } });
}

function calcNaturalFrequency(inp) {
  var m = getMissing(inp, ["C_beam", "E", "I", "rho_L", "L"]);
  if (m.length) return holdResult("NATURAL_FREQUENCY", m);
  var Cb = num(inp.C_beam), E = num(inp.E), Iv = num(inp.I), rhoL = num(inp.rho_L), L = num(inp.L);
  var fn = (Cb / (2 * Math.PI)) * Math.sqrt((E * Iv) / (rhoL * Math.pow(L, 4)));
  return buildResult("NATURAL_FREQUENCY", fn, "Hz", "info", 0.82,
    "First-mode natural frequency is " + fn.toFixed(3) + " Hz.",
    { assumptions: ["Simply supported or fixed boundary", "Uniform cross section"], output: { fn: fn } });
}

function calcRiskBasic(inp) {
  var m = getMissing(inp, ["Pf", "Cf"]);
  if (m.length) return holdResult("RISK_BASIC", m);
  var Pf = num(inp.Pf), Cf = num(inp.Cf);
  var risk = Pf * Cf;
  var sev = risk > 1000000 ? "critical" : risk > 100000 ? "high" : risk > 10000 ? "medium" : "low";
  return buildResult("RISK_BASIC", risk, "risk-units", sev, 0.78,
    "Basic risk score is " + risk.toFixed(2) + " (PoF=" + Pf + " x CoF=" + Cf + ").",
    { assumptions: ["Pf and Cf independently estimated"], output: { risk: risk } });
}

function calcReliabilityExp(inp) {
  var m = getMissing(inp, ["lambda", "t"]);
  if (m.length) return holdResult("RELIABILITY_EXP", m);
  var lam = num(inp.lambda), t = num(inp.t);
  var R = Math.exp(-lam * t);
  var sev = R < 0.5 ? "critical" : R < 0.75 ? "high" : R < 0.9 ? "medium" : "low";
  return buildResult("RELIABILITY_EXP", R, "probability", sev, 0.80,
    "Exponential reliability at time " + t + " is " + (R * 100).toFixed(1) + "%.",
    { assumptions: ["Constant failure rate (useful life period)"], output: { R: R, Pf: 1 - R } });
}

function calcExpectedCost(inp) {
  var m = getMissing(inp, ["Pf", "C_failure"]);
  if (m.length) return holdResult("EXPECTED_COST", m);
  var Pf = num(inp.Pf), Cf = num(inp.C_failure);
  var EC = Pf * Cf;
  return buildResult("EXPECTED_COST", EC, "currency", "medium", 0.78,
    "Expected cost of failure is " + EC.toFixed(2) + ".",
    { assumptions: ["Single failure mode", "Known consequence cost"], output: { expected_cost: EC } });
}

function calcCorrosionStressCoupling(inp) {
  var m = getMissing(inp, ["sigma", "sigma_allow", "CR", "CR_design", "n_coupling"]);
  if (m.length) return holdResult("CORROSION_STRESS_COUPLING", m);
  var sigma = num(inp.sigma), sa = num(inp.sigma_allow);
  var CR = num(inp.CR), CRd = num(inp.CR_design), nc = num(inp.n_coupling);
  var CSC = (sigma / sa) * Math.pow(1 + CR / CRd, nc);
  var sev = CSC > 2 ? "critical" : CSC > 1.5 ? "high" : CSC > 1 ? "medium" : "low";
  return buildResult("CORROSION_STRESS_COUPLING", CSC, "dimensionless", sev, 0.72,
    "Corrosion-stress coupling factor is " + CSC.toFixed(4) + ". " + (CSC > 1.5 ? "Coupled interaction is significant — engineering review required." : ""),
    { assumptions: ["Power-law coupling is a screening approximation"], trace: { requires_engineer_review: CSC > 1.5 }, output: { CSC: CSC } });
}

// ============================================================
// FORMULA MAP
// ============================================================

var FORMULA_MAP = {
  "HOOP_STRESS": calcHoopStress,
  "LONGITUDINAL_STRESS": calcLongStress,
  "VON_MISES_2D": calcVonMises2D,
  "THERMAL_STRESS": calcThermalStress,
  "STRESS_CONCENTRATION": calcStressConcentration,
  "MAWP_CYLINDRICAL": calcMAWP,
  "MIN_THICKNESS": calcMinThickness,
  "WELD_HEAT_INPUT": calcWeldHeatInput,
  "CARBON_EQUIVALENT_IIW": calcCarbonEquivalent,
  "PCM_LOW_CARBON": calcPCM,
  "REMAINING_LIFE": calcRemainingLife,
  "EROSIONAL_VELOCITY": calcErosionalVelocity,
  "STRESS_INTENSITY": calcStressIntensity,
  "PARIS_LAW": calcParisLaw,
  "MINERS_RULE": calcMinersRule,
  "LARSON_MILLER": calcLarsonMiller,
  "UT_WAVELENGTH": calcUTWavelength,
  "UT_NEAR_FIELD": calcUTNearField,
  "UT_BEAM_SPREAD": calcUTBeamSpread,
  "SNELLS_LAW": calcSnellsLaw,
  "RT_UNSHARPNESS": calcRTUnsharpness,
  "POD_CURVE": calcPOD,
  "DFT_FROM_WFT": calcDFTfromWFT,
  "DEW_POINT": calcDewPoint,
  "OSMOTIC_PRESSURE": calcOsmoticPressure,
  "ANODE_LIFE": calcAnodeLife,
  "POTENTIAL_ATTENUATION": calcPotentialAttenuation,
  "REYNOLDS_NUMBER": calcReynoldsNumber,
  "DARCY_WEISBACH": calcDarcyWeisbach,
  "NATURAL_FREQUENCY": calcNaturalFrequency,
  "RISK_BASIC": calcRiskBasic,
  "RELIABILITY_EXP": calcReliabilityExp,
  "EXPECTED_COST": calcExpectedCost,
  "CORROSION_STRESS_COUPLING": calcCorrosionStressCoupling
};

// ============================================================
// HANDLER
// ============================================================

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
        purpose: "Formula Intelligence Core — 33 deterministic formulas across 10 categories with holdResult pattern and full audit trace",
        formula_count: Object.keys(FORMULA_MAP).length,
        actions: ["run_formula", "get_formulas", "get_categories", "get_registry"]
      }) };
    }

    if (action === "get_formulas") {
      try {
        var sb = createClient(supabaseUrl, supabaseKey);
        var formulas = await sb.from("formula_registry").select("formula_code, formula_name, category_code, description, required_inputs, output_unit, authority_level").eq("is_active", true).order("formula_code");
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
          engine: ENGINE_ID, action: action,
          formulas: formulas.data || []
        }, null, 2) };
      } catch (e) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
          engine: ENGINE_ID, action: action,
          formulas: Object.keys(FORMULA_MAP),
          note: "Loaded from engine code — database unavailable"
        }) };
      }
    }

    if (action === "get_categories") {
      try {
        var sb2 = createClient(supabaseUrl, supabaseKey);
        var cats = await sb2.from("formula_categories").select("*").eq("is_active", true).order("category_code");
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
          engine: ENGINE_ID, action: action,
          categories: cats.data || []
        }, null, 2) };
      } catch (e) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
          engine: ENGINE_ID, action: action,
          categories: [],
          note: "Database unavailable"
        }) };
      }
    }

    if (action === "run_formula") {
      var formulaCode = body.formula_code;
      var inputs = body.inputs || {};
      if (!formulaCode) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "formula_code required" }) };
      var fn = FORMULA_MAP[formulaCode];
      if (!fn) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown formula: " + formulaCode + ". Available: " + Object.keys(FORMULA_MAP).join(", ") }) };

      var result = fn(inputs);

      // Log to Supabase (non-fatal)
      try {
        var sb3 = createClient(supabaseUrl, supabaseKey);
        await sb3.from("formula_execution_runs").insert({
          org_id: body.org_id || null,
          case_id: body.case_id || null,
          asset_id: body.asset_id || null,
          finding_id: body.finding_id || null,
          formula_code: formulaCode,
          input_payload: inputs,
          output_payload: result.output || {},
          result_value: result.result_value,
          result_unit: result.result_unit,
          confidence: result.confidence,
          severity: result.severity,
          interpretation: result.interpretation,
          missing_inputs: result.missing_inputs,
          assumptions_used: result.assumptions_used,
          limitations_triggered: result.limitations_triggered
        });
      } catch (e) {}

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
        engine: ENGINE_ID, version: ENGINE_VERSION, action: action,
        formula_code: formulaCode,
        result: result
      }, null, 2) };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
