// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ══════════════════════════════════════════════════════════════════════════════
// OFFSHORE STRUCTURAL INTEGRITY ASSESSMENT ENGINE
// DEPLOY340
//
// Comprehensive assessment of fixed offshore steel structures per:
//   - API RP 2A-WSD (Recommended Practice for Planning, Designing, and
//     Constructing Fixed Offshore Platforms - Working Stress Design)
//   - API RP 2SIM (Recommended Practice for In-Service Inspection,
//     Maintenance, Repair, and Life Extension of Existing Platforms)
//   - DNV-RP-C203 (Fatigue Design of Offshore Steel Structures)
//
// This engine is built on commercial diving/UDT (Underwater Demolition Team)
// background expertise. Implements expert-level tubular member and joint
// assessment with stress concentration, fatigue, and corrosion evaluation.
//
// Core Assessment Areas:
// 1. Tubular member capacity (axial, bending, combined, hydrostatic)
// 2. Tubular joint capacity (K, T/Y, X-joint types)
// 3. Fatigue life assessment (S-N curves, Miner's rule, SCF parametrics)
// 4. Corrosion impact evaluation (wall loss effects)
// 5. Inspection planning per API RP 2SIM risk-based methodology
//
// Actions:
// - get_registry: Return engine capabilities
// - assess_member: Full member unity check
// - assess_joint: Tubular joint capacity check
// - assess_fatigue: Fatigue life assessment
// - assess_corrosion_impact: Wall loss effect on capacity
// - plan_inspection: API RP 2SIM inspection planning
// - compute_scf: Stress concentration factor (Efthymiou)
// - get_sn_curves: Available S-N curve data
// - get_history: Retrieve past assessments
// ══════════════════════════════════════════════════════════════════════════════

// ── ACTION REGISTRY ────────────────────────────────────────────────────────
var ACTION_REGISTRY = {
  "get_registry": { description: "Return engine capabilities", method: "GET_OR_POST" },
  "assess_member": { description: "Full member unity check (axial, bending, combined, hydrostatic)", method: "POST" },
  "assess_joint": { description: "Tubular joint capacity check", method: "POST" },
  "assess_fatigue": { description: "Fatigue life assessment with S-N curves and Miner's rule", method: "POST" },
  "assess_corrosion_impact": { description: "Wall loss effect on member capacity", method: "POST" },
  "plan_inspection": { description: "API RP 2SIM inspection planning", method: "POST" },
  "compute_scf": { description: "Stress concentration factor (Efthymiou parametric)", method: "POST" },
  "get_sn_curves": { description: "Available S-N curve data (API RP 2A, DNV)", method: "GET_OR_POST" },
  "get_history": { description: "Retrieve past assessments", method: "POST" }
};

// ── MATERIAL PROPERTIES (API RP 2A Section 5) ──────────────────────────────
// Allowable stresses in PSI for fixed offshore structures
var MATERIAL_PROPERTIES = {
  "ASTM_A36": { Fy: 36000, E: 29000000, Ftu: 58000, rho: 0.283 },
  "ASTM_A572_Gr50": { Fy: 50000, E: 29000000, Ftu: 65000, rho: 0.283 },
  "ASTM_A588": { Fy: 50000, E: 29000000, Ftu: 70000, rho: 0.283 },
  "ASTM_A131_AH36": { Fy: 51000, E: 29000000, Ftu: 71000, rho: 0.283 },
  "API_2H": { Fy: 50000, E: 29000000, Ftu: 70000, rho: 0.283 }
};

// ── S-N CURVES (API RP 2A Section 5 + DNV-RP-C203) ────────────────────────
// log N = a - b * log S, where N = cycles to failure, S = stress range in ksi
var SN_CURVES = {
  "API_RP2A_X_air": {
    description: "API RP 2A X curve (tubular joints in air)",
    a: 9.3507,
    b: 3.0,
    N_transition: 1e7,
    valid_range: [1, 200],
    notes: "For stress ranges 1-200 ksi"
  },
  "API_RP2A_X_seawater_cp": {
    description: "API RP 2A X' curve (tubular joints in seawater with CP)",
    a: 8.9867,
    b: 3.0,
    N_transition: 1e7,
    valid_range: [1, 150],
    notes: "Cathodic protection assumed effective"
  },
  "DNV_B1": {
    description: "DNV B1 (butt welds, ground flush)",
    a: 12.164,
    b: 3.0,
    N_transition: 1e7,
    valid_range: [1, 300],
    notes: "For butt welds with grinding"
  },
  "DNV_D": {
    description: "DNV D (fillet welds, cruciform joints)",
    a: 11.764,
    b: 3.0,
    N_transition: 1e7,
    valid_range: [1, 250],
    notes: "Typical for tubular K-joints"
  },
  "DNV_F": {
    description: "DNV F (root failures, weld roots)",
    a: 11.455,
    b: 3.0,
    N_transition: 1e7,
    valid_range: [1, 200],
    notes: "Conservative for unground root failures"
  },
  "DNV_T": {
    description: "DNV T (tubular joints, general)",
    a: 11.764,
    b: 3.0,
    N_transition: 1e7,
    b_high: 5.0,
    N_high_transition: 1e8,
    valid_range: [1, 250],
    notes: "Slope increases to 5.0 beyond N=10^8"
  }
};

// ── EFTHYMIOU PARAMETRIC SCF EQUATIONS (API RP 2A Section 4.10) ─────────────
// Stress Concentration Factors for tubular joints
// SCF = alpha * beta^a * gamma^b * tau^c * sin(theta)^d
// Different equations for crown (saddle) points and loading types (AX, IPB, OPB)
var SCF_PARAMETERS = {
  "crown_axial": {
    alpha: 4.95,
    beta_exp: 0.80,
    gamma_exp: 0.30,
    tau_exp: -0.30,
    theta_exp: 0.50,
    notes: "Crown point, axial loading (AX)"
  },
  "saddle_axial": {
    alpha: 3.70,
    beta_exp: 0.80,
    gamma_exp: 0.35,
    tau_exp: -0.30,
    theta_exp: 0.00,
    notes: "Saddle point, axial loading (AX)"
  },
  "crown_ipb": {
    alpha: 5.20,
    beta_exp: 0.70,
    gamma_exp: 0.25,
    tau_exp: -0.20,
    theta_exp: 0.60,
    notes: "Crown point, in-plane bending (IPB)"
  },
  "saddle_ipb": {
    alpha: 4.10,
    beta_exp: 0.70,
    gamma_exp: 0.30,
    tau_exp: -0.20,
    theta_exp: 0.10,
    notes: "Saddle point, in-plane bending (IPB)"
  },
  "crown_opb": {
    alpha: 4.40,
    beta_exp: 0.60,
    gamma_exp: 0.20,
    tau_exp: -0.15,
    theta_exp: 0.50,
    notes: "Crown point, out-of-plane bending (OPB)"
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION: Compute member allowable stress (tensile)
// API RP 2A Section 3.6.1
// ═════════════════════════════════════════════════════════════════════════════
function compute_allowable_tension(Fy) {
  if (!Fy) return null;
  var Ft = 0.6 * Fy;
  return Ft;
}

// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION: Compute critical slenderness ratio (API RP 2A Section 3.7.1)
// Cc = sqrt(2 * pi^2 * E / Fy)
// ═════════════════════════════════════════════════════════════════════════════
function compute_Cc(E, Fy) {
  if (!E || !Fy) return null;
  var numerator = 2 * Math.PI * Math.PI * E;
  var Cc = Math.sqrt(numerator / Fy);
  return Cc;
}

// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION: Compute column buckling stress (API RP 2A Section 3.7.1)
// Short columns (KL/r < Cc):
//   Fa = [1 - (KL/r)^2 / (2*Cc^2)] * Fy / FS
//   FS = 5/3 + 3(KL/r)/(8*Cc) - (KL/r)^3/(8*Cc^3)
// Long columns (KL/r >= Cc):
//   Fa = pi^2 * E / (FS * (KL/r)^2)
//   FS = 12 * pi^2 / (23 * (KL/r)^2)
// ═════════════════════════════════════════════════════════════════════════════
function compute_column_buckling(KLr, E, Fy, Cc) {
  if (!KLr || !E || !Fy || !Cc) return null;

  var Fa;
  var FS;

  if (KLr < Cc) {
    var term1 = (KLr * KLr) / (2 * Cc * Cc);
    FS = 5 / 3 + 3 * KLr / (8 * Cc) - (KLr * KLr * KLr) / (8 * Cc * Cc * Cc);
    Fa = (1 - term1) * Fy / FS;
  } else {
    var KLr_sq = KLr * KLr;
    FS = 12 * Math.PI * Math.PI / (23 * KLr_sq);
    Fa = (Math.PI * Math.PI * E) / (FS * KLr_sq);
  }

  return { Fa: Fa, FS: FS, regime: KLr < Cc ? "short_column" : "long_column" };
}

// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION: Compute allowable bending stress (API RP 2A Section 3.8)
// For compact sections: Fb = 0.75 * Fy
// ═════════════════════════════════════════════════════════════════════════════
function compute_allowable_bending(Fy) {
  if (!Fy) return null;
  var Fb = 0.75 * Fy;
  return Fb;
}

// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION: Compute allowable shear stress (API RP 2A Section 3.9)
// Fv = 0.4 * Fy
// ═════════════════════════════════════════════════════════════════════════════
function compute_allowable_shear(Fy) {
  if (!Fy) return null;
  var Fv = 0.4 * Fy;
  return Fv;
}

// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION: Compute hoop stress from external hydrostatic pressure
// API RP 2A Section 3.10 (external pressure, hydrostatic)
// fh = p * D / (2 * t)
// ═════════════════════════════════════════════════════════════════════════════
function compute_hoop_stress(p, D, t) {
  if (!p || !D || !t) return null;
  if (t <= 0 || D <= 0) return null;

  var fh = (p * D) / (2 * t);
  return fh;
}

// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION: Compute elastic buckling stress (external hydrostatic pressure)
// API RP 2A Section 3.10.2
// Fhe = 2 * C * E * (t/D)
// where C = 0.44 * t/D for fabricated tubes (typical)
// ═════════════════════════════════════════════════════════════════════════════
function compute_elastic_buckling_stress(E, D, t) {
  if (!E || !D || !t) return null;
  if (D <= 0 || t <= 0) return null;

  var tD_ratio = t / D;
  var C = 0.44 * tD_ratio;
  var Fhe = 2 * C * E * tD_ratio;
  return Fhe;
}

// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION: Member unity check (combined stress evaluation)
// API RP 2A Section 3.11
// For axial + bending without explicit column buckling amplification:
//   fa / Fa + sqrt(fbx^2 + fby^2) / Fb <= 1.0
// With amplification factor Cm for column-type members:
//   fa / (0.6*Fy) + Cm*fb / ((1 - fa/Fe')*Fb) <= 1.0
// ═════════════════════════════════════════════════════════════════════════════
function assess_member_unity(inputs) {
  var D = inputs.D;
  var t = inputs.t;
  var L = inputs.L;
  var K = inputs.K || 1.0;
  var E = inputs.E;
  var Fy = inputs.Fy;
  var P_axial = inputs.P_axial || 0;
  var M_bending = inputs.M_bending || 0;
  var V_shear = inputs.V_shear || 0;
  var p_external = inputs.p_external || 0;
  var material = inputs.material || "ASTM_A36";

  var result = {
    engine: "offshore_structural_assessment",
    timestamp: new Date().toISOString(),
    member_type: "tubular",
    member_id: inputs.member_id || "unknown",
    input_hash: JSON.stringify(inputs),
    computations: {},
    checks: [],
    summary: "",
    pass_fail: false
  };

  // Cross-sectional properties
  var A = Math.PI * (D - 2 * t) * t;
  var I = Math.PI * (D * D * D * D - (D - 2 * t) * (D - 2 * t) * (D - 2 * t) * (D - 2 * t)) / 64;
  var S = I / (D / 2);
  var r = Math.sqrt(I / A);

  result.computations.area = A;
  result.computations.moment_inertia = I;
  result.computations.section_modulus = S;
  result.computations.radius_gyration = r;

  // Slenderness ratio
  var KLr = (K * L) / r;
  result.computations.slenderness_ratio = KLr;

  // Material allowables
  var mat = MATERIAL_PROPERTIES[material] || MATERIAL_PROPERTIES["ASTM_A36"];
  var Ft = compute_allowable_tension(mat.Fy);
  var Cc = compute_Cc(mat.E, mat.Fy);
  var buckling_result = compute_column_buckling(KLr, mat.E, mat.Fy, Cc);
  var Fa_compression = buckling_result.Fa;
  var Fb = compute_allowable_bending(mat.Fy);
  var Fv = compute_allowable_shear(mat.Fy);

  result.computations.Ft = Ft;
  result.computations.Fa = Fa_compression;
  result.computations.Fb = Fb;
  result.computations.Fv = Fv;
  result.computations.Cc = Cc;
  result.computations.buckling_regime = buckling_result.regime;

  // Axial stress
  var fa = P_axial > 0 ? P_axial / A : 0;
  var fa_ratio = fa > 0 ? fa / Ft : 0;
  result.computations.fa = fa;
  result.computations.fa_ratio = fa_ratio;

  var check_tension = {
    name: "Tensile stress check",
    formula: "fa / Ft <= 1.0",
    fa: fa,
    Ft: Ft,
    ratio: fa_ratio,
    pass: fa_ratio <= 1.0
  };
  result.checks.push(check_tension);

  // Compression (column buckling)
  var fa_compression = P_axial < 0 ? Math.abs(P_axial) / A : 0;
  var fa_comp_ratio = fa_compression > 0 ? fa_compression / Fa_compression : 0;

  var check_compression = {
    name: "Column buckling check",
    formula: "fa / Fa <= 1.0",
    fa: fa_compression,
    Fa: Fa_compression,
    ratio: fa_comp_ratio,
    pass: fa_comp_ratio <= 1.0
  };
  result.checks.push(check_compression);

  // Bending stress
  var fb = M_bending > 0 ? M_bending / S : 0;
  var fb_ratio = fb > 0 ? fb / Fb : 0;
  result.computations.fb = fb;
  result.computations.fb_ratio = fb_ratio;

  var check_bending = {
    name: "Bending stress check",
    formula: "fb / Fb <= 1.0",
    fb: fb,
    Fb: Fb,
    ratio: fb_ratio,
    pass: fb_ratio <= 1.0
  };
  result.checks.push(check_bending);

  // Shear stress
  var A_shear = 2 * t * (D - 2 * t);
  var fv = V_shear > 0 ? V_shear / A_shear : 0;
  var fv_ratio = fv > 0 ? fv / Fv : 0;
  result.computations.fv = fv;
  result.computations.fv_ratio = fv_ratio;

  var check_shear = {
    name: "Shear stress check",
    formula: "fv / Fv <= 1.0",
    fv: fv,
    Fv: Fv,
    ratio: fv_ratio,
    pass: fv_ratio <= 1.0
  };
  result.checks.push(check_shear);

  // Hydrostatic external pressure (submerged members)
  if (p_external > 0) {
    var fh = compute_hoop_stress(p_external, D, t);
    var Fhe = compute_elastic_buckling_stress(mat.E, D, t);
    var fh_ratio = fh > 0 ? fh / Fhe : 0;
    result.computations.fh = fh;
    result.computations.Fhe = Fhe;
    result.computations.fh_ratio = fh_ratio;

    var check_hydrostatic = {
      name: "Hydrostatic buckling check",
      formula: "fh / Fhe <= 1.0 (external pressure)",
      fh: fh,
      Fhe: Fhe,
      ratio: fh_ratio,
      pass: fh_ratio <= 1.0
    };
    result.checks.push(check_hydrostatic);
  }

  // Combined stress (axial + bending)
  var combined_ratio = Math.max(fa_ratio, fa_comp_ratio) + fb_ratio;
  var check_combined = {
    name: "Combined stress check",
    formula: "fa/Fa + fb/Fb <= 1.0",
    total_ratio: combined_ratio,
    pass: combined_ratio <= 1.0
  };
  result.checks.push(check_combined);

  // Overall verdict
  var all_pass = result.checks.every(function(c) { return c.pass; });
  result.pass_fail = all_pass;
  result.unity_check_ratio = combined_ratio;

  if (all_pass) {
    result.summary = "Member passes all stress checks (unity check = " + combined_ratio.toFixed(3) + ")";
  } else {
    var failed = result.checks.filter(function(c) { return !c.pass; });
    result.summary = "Member fails: " + failed.map(function(c) { return c.name; }).join(", ");
  }

  return result;
}

// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION: Tubular joint capacity assessment
// API RP 2A Section 4 (K, T/Y, X-joint types)
// ═════════════════════════════════════════════════════════════════════════════
function assess_joint_capacity(inputs) {
  var joint_type = inputs.joint_type;
  var d = inputs.d;
  var D = inputs.D;
  var T = inputs.T;
  var t = inputs.t;
  var theta = inputs.theta;
  var Fy = inputs.Fy || 50000;
  var load_type = inputs.load_type || "axial";
  var Pu_applied = inputs.Pu_applied;

  var result = {
    engine: "offshore_structural_assessment",
    timestamp: new Date().toISOString(),
    joint_type: joint_type,
    joint_id: inputs.joint_id || "unknown",
    input_hash: JSON.stringify(inputs),
    computations: {},
    capacity_check: {},
    summary: ""
  };

  // Beta and gamma ratios
  var beta = d / D;
  var gamma = D / (2 * T);
  var tau = t / T;
  var sin_theta = Math.sin((theta * Math.PI) / 180);

  result.computations.beta = beta;
  result.computations.gamma = gamma;
  result.computations.tau = tau;
  result.computations.sin_theta = sin_theta;

  // Qu (strength factor) - simplified per API RP 2A Table 4.2
  var Qu;

  if (joint_type === "K_axial") {
    Qu = (3.4 + 19 * beta) * 1.0;
  } else if (joint_type === "T_Y_axial_compression") {
    Qu = 3.4 + 19 * beta;
  } else if (joint_type === "T_Y_axial_tension") {
    Qu = 3.4 + 19 * beta;
  } else if (joint_type === "X_axial") {
    Qu = (3.4 + 19 * beta) / (1 + 0.25 * gamma);
  } else {
    Qu = 3.4 + 19 * beta;
  }

  result.computations.Qu = Qu;

  // Qf (chord stress factor) - simplified version
  // Qf = 1 - lambda * gamma * A^2, where A is chord utilization
  var A = inputs.chord_utilization || 0.5;
  var lambda = 0.3;
  var Qf = Math.max(0.5, 1 - lambda * gamma * A * A);
  result.computations.Qf = Qf;

  // Joint capacity: Pu = Qu * Qf * Fy * T^2 / sin(theta)
  var Pu_capacity = (Qu * Qf * Fy * T * T) / sin_theta;
  result.computations.Pu_capacity = Pu_capacity;

  // Capacity ratio
  var capacity_ratio = Pu_applied > 0 ? Pu_applied / Pu_capacity : 0;
  result.computations.capacity_ratio = capacity_ratio;

  result.capacity_check = {
    joint_type: joint_type,
    load_type: load_type,
    Pu_applied: Pu_applied,
    Pu_capacity: Pu_capacity,
    ratio: capacity_ratio,
    pass: capacity_ratio <= 1.0,
    formula: "Pu_applied / Pu_capacity <= 1.0"
  };

  if (capacity_ratio <= 1.0) {
    result.summary = "Joint PASSES capacity check (ratio = " + capacity_ratio.toFixed(3) + ")";
    result.pass_fail = true;
  } else {
    result.summary = "Joint FAILS capacity check (ratio = " + capacity_ratio.toFixed(3) + ")";
    result.pass_fail = false;
  }

  return result;
}

// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION: Stress concentration factor (Efthymiou parametric)
// API RP 2A Section 4.10
// ═════════════════════════════════════════════════════════════════════════════
function compute_stress_concentration_factor(inputs) {
  var beta = inputs.beta;
  var gamma = inputs.gamma;
  var tau = inputs.tau;
  var theta = inputs.theta;
  var position = inputs.position || "crown";
  var load_type = inputs.load_type || "axial";

  var key = position + "_" + load_type;
  var params = SCF_PARAMETERS[key];

  if (!params) {
    return { error: "Unknown SCF combination: " + key };
  }

  var sin_theta = Math.sin((theta * Math.PI) / 180);
  var SCF = params.alpha * Math.pow(beta, params.beta_exp) * Math.pow(gamma, params.gamma_exp) *
            Math.pow(tau, params.tau_exp) * Math.pow(sin_theta, params.theta_exp);

  return {
    SCF: SCF,
    position: position,
    load_type: load_type,
    formula: "SCF = " + params.alpha.toFixed(2) + " * beta^" + params.beta_exp +
             " * gamma^" + params.gamma_exp + " * tau^" + params.tau_exp + " * sin(theta)^" + params.theta_exp,
    parameters: params
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION: Fatigue assessment (S-N curves + Miner's rule)
// API RP 2A Section 5, DNV-RP-C203
// ═════════════════════════════════════════════════════════════════════════════
function assess_fatigue_life(inputs) {
  var sn_curve = inputs.sn_curve || "API_RP2A_X_seawater_cp";
  var stress_ranges = inputs.stress_ranges || [];
  var scf = inputs.scf || 1.0;
  var design_fatigue_factor = inputs.dff || 2.0;
  var service_life_years = inputs.service_life_years || 20;

  var result = {
    engine: "offshore_structural_assessment",
    timestamp: new Date().toISOString(),
    assessment_type: "fatigue_life",
    member_id: inputs.member_id || "unknown",
    input_hash: JSON.stringify(inputs),
    computations: {},
    sn_curve: sn_curve,
    summary: ""
  };

  var curve_data = SN_CURVES[sn_curve];
  if (!curve_data) {
    result.error = "Unknown S-N curve: " + sn_curve;
    return result;
  }

  result.computations.curve_equation = "log N = " + curve_data.a + " - " + curve_data.b + " * log S";

  // Miner's rule: D = sum(ni / Ni)
  var total_damage = 0;
  var damage_details = [];

  for (var i = 0; i < stress_ranges.length; i++) {
    var S_nominal = stress_ranges[i].stress_range;
    var n_cycles = stress_ranges[i].cycles;

    var S_effective = S_nominal * scf;

    var log_S = Math.log10(S_effective);
    var log_N = curve_data.a - curve_data.b * log_S;
    var N = Math.pow(10, log_N);

    var di = n_cycles / N;
    total_damage += di;

    damage_details.push({
      stress_range: S_nominal,
      scf_adjusted: S_effective,
      cycles: n_cycles,
      N_to_failure: N,
      damage_increment: di
    });
  }

  result.computations.stress_ranges = damage_details;
  result.computations.total_damage = total_damage;
  result.computations.allowable_damage = 1.0 / design_fatigue_factor;

  var allowable_damage = 1.0 / design_fatigue_factor;
  var damage_ratio = total_damage / allowable_damage;

  result.damage_assessment = {
    total_damage_ratio: total_damage,
    design_fatigue_factor: design_fatigue_factor,
    allowable_damage: allowable_damage,
    normalized_damage_ratio: damage_ratio,
    pass_fail: damage_ratio <= 1.0
  };

  // Remaining fatigue life
  if (total_damage > 0 && total_damage < 1.0) {
    var remaining_fraction = (1.0 / design_fatigue_factor - total_damage);
    var remaining_years = (remaining_fraction / total_damage) * service_life_years;
    result.remaining_fatigue_life_years = remaining_years;
  } else {
    result.remaining_fatigue_life_years = 0;
  }

  result.pass_fail = damage_ratio <= 1.0;

  if (damage_ratio <= 1.0) {
    result.summary = "Fatigue assessment PASSES (Miner's rule damage = " + total_damage.toFixed(3) +
                     " / " + allowable_damage.toFixed(3) + ")";
  } else {
    result.summary = "Fatigue assessment FAILS (damage ratio exceeds allowable by " +
                     ((damage_ratio - 1.0) * 100).toFixed(1) + "%)";
  }

  return result;
}

// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION: Corrosion impact assessment
// API RP 2A Section 3, API RP 2SIM Section 3
// ═════════════════════════════════════════════════════════════════════════════
function assess_corrosion_impact(inputs) {
  var D = inputs.D;
  var t_original = inputs.t_original;
  var t_measured = inputs.t_measured;
  var location = inputs.location || "splash_zone";
  var years_in_service = inputs.years_in_service || 10;
  var Fy = inputs.Fy || 50000;
  var E = inputs.E || 29000000;

  var result = {
    engine: "offshore_structural_assessment",
    timestamp: new Date().toISOString(),
    assessment_type: "corrosion_impact",
    member_id: inputs.member_id || "unknown",
    input_hash: JSON.stringify(inputs),
    computations: {},
    summary: ""
  };

  var wall_loss = t_original - t_measured;
  var corrosion_rate = wall_loss / years_in_service;

  result.computations.wall_loss = wall_loss;
  result.computations.corrosion_rate_mmyr = corrosion_rate;

  // Typical corrosion rates (mm/yr)
  var typical_rates = {
    splash_zone: { min: 0.3, max: 0.5, typical: 0.40 },
    atmospheric: { min: 0.1, max: 0.3, typical: 0.20 },
    submerged_cp: { min: 0.05, max: 0.1, typical: 0.075 },
    buried: { min: 0.01, max: 0.2, typical: 0.10 }
  };

  var typical = typical_rates[location] || typical_rates.atmospheric;
  result.computations.typical_rate_range = typical;

  // Remaining capacity with degraded section
  var A_original = Math.PI * (D - 2 * t_original) * t_original;
  var A_degraded = Math.PI * (D - 2 * t_measured) * t_measured;

  var I_original = Math.PI * (Math.pow(D, 4) - Math.pow(D - 2 * t_original, 4)) / 64;
  var I_degraded = Math.PI * (Math.pow(D, 4) - Math.pow(D - 2 * t_measured, 4)) / 64;

  var S_original = I_original / (D / 2);
  var S_degraded = I_degraded / (D / 2);

  result.computations.area_loss_percent = ((A_original - A_degraded) / A_original) * 100;
  result.computations.section_loss_percent = ((S_original - S_degraded) / S_original) * 100;

  // Allowable stresses (unchanged by corrosion, but capacity changes)
  var Ft = 0.6 * Fy;
  var P_original = Ft * A_original;
  var P_degraded = Ft * A_degraded;
  var capacity_ratio = P_degraded / P_original;

  result.computations.tensile_capacity_retention = capacity_ratio;

  // Bending capacity
  var M_original = 0.75 * Fy * S_original;
  var M_degraded = 0.75 * Fy * S_degraded;
  var bending_capacity_ratio = M_degraded / M_original;
  result.computations.bending_capacity_retention = bending_capacity_ratio;

  result.capacity_assessment = {
    location: location,
    wall_loss_mm: wall_loss,
    corrosion_rate: corrosion_rate,
    area_retention: capacity_ratio,
    bending_retention: bending_capacity_ratio,
    severity: corrosion_rate > typical.max ? "SEVERE" : corrosion_rate > typical.typical ? "MODERATE" : "NORMAL"
  };

  result.pass_fail = capacity_ratio > 0.75;

  if (capacity_ratio > 0.75) {
    result.summary = "Corrosion impact acceptable. Remaining capacity = " + (capacity_ratio * 100).toFixed(1) + "%";
  } else {
    result.summary = "CRITICAL: Remaining capacity severely degraded to " + (capacity_ratio * 100).toFixed(1) + "%";
  }

  return result;
}

// ═════════════════════════════════════════════════════════════════════════════
// FUNCTION: Inspection planning per API RP 2SIM
// Risk-based approach with consequence/likelihood matrices
// ═════════════════════════════════════════════════════════════════════════════
function plan_inspection(inputs) {
  var member_id = inputs.member_id;
  var fatigue_damage_ratio = inputs.fatigue_damage_ratio || 0.0;
  var corrosion_rate = inputs.corrosion_rate || 0.1;
  var joint_type = inputs.joint_type;
  var redundancy = inputs.redundancy || "yes";
  var inspection_history = inputs.inspection_history || [];

  var result = {
    engine: "offshore_structural_assessment",
    timestamp: new Date().toISOString(),
    assessment_type: "inspection_planning",
    member_id: member_id,
    input_hash: JSON.stringify(inputs),
    computations: {},
    summary: ""
  };

  // Consequence category (API RP 2SIM Table 5.2)
  var consequence;
  if (!redundancy || redundancy === "no") {
    consequence = "C1";
  } else if (fatigue_damage_ratio > 0.5 || corrosion_rate > 0.3) {
    consequence = "C2";
  } else if (fatigue_damage_ratio > 0.2 || corrosion_rate > 0.15) {
    consequence = "C3";
  } else {
    consequence = "C4";
  }

  result.computations.consequence_category = consequence;

  // Likelihood category (based on fatigue, corrosion, inspection)
  var likelihood;
  if (fatigue_damage_ratio > 0.8 || corrosion_rate > 0.4) {
    likelihood = "L3";
  } else if (fatigue_damage_ratio > 0.5 || corrosion_rate > 0.25) {
    likelihood = "L2";
  } else {
    likelihood = "L1";
  }

  result.computations.likelihood_category = likelihood;

  // Risk matrix: consequence x likelihood
  var risk_matrix = {
    "C1L3": { risk: "CRITICAL", level: 5, interval_years: 1 },
    "C1L2": { risk: "HIGH", level: 4, interval_years: 2 },
    "C1L1": { risk: "MEDIUM", level: 3, interval_years: 3 },
    "C2L3": { risk: "HIGH", level: 4, interval_years: 2 },
    "C2L2": { risk: "MEDIUM", level: 3, interval_years: 3 },
    "C2L1": { risk: "MEDIUM", level: 3, interval_years: 3 },
    "C3L3": { risk: "MEDIUM", level: 3, interval_years: 3 },
    "C3L2": { risk: "LOW", level: 2, interval_years: 5 },
    "C3L1": { risk: "LOW", level: 2, interval_years: 5 },
    "C4L3": { risk: "LOW", level: 2, interval_years: 5 },
    "C4L2": { risk: "LOW", level: 2, interval_years: 5 },
    "C4L1": { risk: "MINIMAL", level: 1, interval_years: 10 }
  };

  var risk_key = consequence + likelihood;
  var risk_data = risk_matrix[risk_key] || { risk: "UNKNOWN", level: 3, interval_years: 3 };

  result.computations.risk_category = risk_data.risk;
  result.computations.risk_level = risk_data.level;

  // Inspection scope (API RP 2SIM Section 5.3)
  var inspection_level;
  if (risk_data.level >= 5) {
    inspection_level = "Level IV (NDE)";
  } else if (risk_data.level >= 4) {
    inspection_level = "Level III (Close visual + NDE)";
  } else if (risk_data.level >= 3) {
    inspection_level = "Level II (General underwater visual)";
  } else {
    inspection_level = "Level I (Visual monitoring)";
  }

  result.inspection_plan = {
    risk_category: risk_data.risk,
    consequence: consequence,
    likelihood: likelihood,
    inspection_level: inspection_level,
    interval_years: risk_data.interval_years,
    next_inspection_date: new Date(Date.now() + risk_data.interval_years * 365.25 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  };

  result.summary = "Risk: " + risk_data.risk + ". Inspect every " + risk_data.interval_years + " year(s) at Level " +
                  inspection_level.substring(inspection_level.length - 1) + ".";

  return result;
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═════════════════════════════════════════════════════════════════════════════
var handler = async function(event, context) {
  var body_str = event.body || "{}";
  var body = body_str ? JSON.parse(body_str) : {};
  var action = body.action || "get_registry";

  var response_data = {};

  try {
    if (action === "get_registry") {
      response_data = {
        engine: "offshore_structural_assessment",
        version: "1.0.0",
        deploy: "DEPLOY340",
        standards: [
          "API RP 2A-WSD (Working Stress Design)",
          "API RP 2SIM (In-Service Inspection & Maintenance)",
          "DNV-RP-C203 (Fatigue Design)"
        ],
        capabilities: ACTION_REGISTRY,
        material_database: Object.keys(MATERIAL_PROPERTIES),
        sn_curves_available: Object.keys(SN_CURVES),
        scf_equations: Object.keys(SCF_PARAMETERS)
      };
    } else if (action === "assess_member") {
      response_data = assess_member_unity(body);
    } else if (action === "assess_joint") {
      response_data = assess_joint_capacity(body);
    } else if (action === "assess_fatigue") {
      response_data = assess_fatigue_life(body);
    } else if (action === "assess_corrosion_impact") {
      response_data = assess_corrosion_impact(body);
    } else if (action === "plan_inspection") {
      response_data = plan_inspection(body);
    } else if (action === "compute_scf") {
      response_data = compute_stress_concentration_factor(body);
    } else if (action === "get_sn_curves") {
      response_data = {
        engine: "offshore_structural_assessment",
        timestamp: new Date().toISOString(),
        sn_curves: SN_CURVES
      };
    } else if (action === "get_history") {
      var supabase = createClient(supabaseUrl, supabaseKey);

      try {
        var history_result = await supabase
          .from("offshore_structural_assessments")
          .select("*")
          .eq("member_id", body.member_id)
          .order("timestamp", { ascending: false })
          .limit(10);

        response_data = {
          engine: "offshore_structural_assessment",
          timestamp: new Date().toISOString(),
          member_id: body.member_id,
          assessments: history_result.data || [],
          total_count: history_result.data ? history_result.data.length : 0
        };
      } catch (db_error) {
        response_data = {
          engine: "offshore_structural_assessment",
          timestamp: new Date().toISOString(),
          member_id: body.member_id,
          assessments: [],
          db_warning: "Non-fatal: could not retrieve history from database"
        };
      }
    } else {
      response_data = { error: "Unknown action: " + action };
    }
  } catch (error) {
    response_data = { error: error.message || "Unknown error" };
  }

  // Save to database (non-fatal)
  if (action !== "get_registry" && action !== "get_sn_curves" && action !== "get_history") {
    try {
      var supabase = createClient(supabaseUrl, supabaseKey);

      var save_payload = {
        timestamp: response_data.timestamp,
        engine: response_data.engine,
        action: action,
        member_id: response_data.member_id || null,
        joint_id: response_data.joint_id || null,
        assessment_type: response_data.assessment_type,
        result_json: response_data,
        pass_fail: response_data.pass_fail
      };

      await supabase
        .from("offshore_structural_assessments")
        .insert([save_payload]);
    } catch (db_save_error) {
      response_data.db_save_warning = "Non-fatal: could not save assessment to database";
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify(response_data)
  };
};

export { handler };
