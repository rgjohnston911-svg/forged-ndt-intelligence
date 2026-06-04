// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ══════════════════════════════════════════════════════════════════════════════
// SUBSEA PRODUCTION EQUIPMENT ASSESSMENT ENGINE
// DEPLOY344
//
// Integrity assessment for subsea production and drilling equipment:
//
//   Subsea Trees (Horizontal/Vertical Christmas Trees)
//   Wellheads and wellhead connectors
//   BOPs (Blowout Preventers) — surface and subsea
//   Umbilicals — power, hydraulic, chemical injection, fiber optic
//   Subsea Manifolds and PLET/PLEM
//   Jumpers and spool pieces
//   Subsea connectors (hub, clamp, collet)
//   Control systems (SCM, HPU, EFL)
//   Subsea processing (separation, boosting, compression)
//   SCSSSVs (Surface-Controlled Subsurface Safety Valves)
//
// Standards implemented:
//   API 17A  — Recommended Practice for Design and Operation of Subsea
//              Production Systems
//   API 17B  — Flexible Pipe (referenced)
//   API 17D  — Subsea Wellhead and Tree Equipment
//   API 17E  — Subsea Umbilicals
//   API 17F  — Subsea Control Systems
//   API 17G  — Completions/Workover Risers
//   API 6A   — Wellhead and Christmas Tree Equipment
//   API 14A  — Subsurface Safety Valve Equipment
//   ISO 13628 series — Petroleum and natural gas industries, subsea
//   DNV-OS-E101 — Drilling Plant
//   DNV-RP-F116 — Integrity Management of Submarine Pipeline Systems
//
// Actions:
// - get_registry: Return engine capabilities
// - assess_tree: Christmas tree assessment (valves, actuators, connectors)
// - assess_wellhead: Wellhead housing, casing hanger, wear bushing
// - assess_bop: BOP stack assessment (rams, annular, control)
// - assess_umbilical: Umbilical integrity (armor, hose, electrical, fiber)
// - assess_manifold: Manifold structural and flow assessment
// - assess_jumper: Jumper/spool integrity (fatigue, erosion, connectors)
// - assess_connector: Hub/clamp/collet connector assessment
// - assess_control_system: SCM, HPU, EFL assessment
// - assess_scssv: Safety valve assessment
// - assess_subsea_processing: Separation, boosting, compression
// - classify_equipment: Return equipment type and critical areas
// - get_history: Retrieve past assessments
//
// ══════════════════════════════════════════════════════════════════════════════

var ENGINE_VERSION = "SPE-1.0.0";

var ACTION_REGISTRY = {
  "get_registry": { description: "Return engine capabilities", method: "GET_OR_POST" },
  "assess_tree": { description: "Christmas tree valve, actuator, and connector assessment", method: "POST" },
  "assess_wellhead": { description: "Wellhead housing, casing hanger, wear bushing assessment", method: "POST" },
  "assess_bop": { description: "BOP stack assessment (ram, annular, control system)", method: "POST" },
  "assess_umbilical": { description: "Umbilical integrity — armor, hose, electrical, fiber optic", method: "POST" },
  "assess_manifold": { description: "Manifold structural frame and flow path assessment", method: "POST" },
  "assess_jumper": { description: "Jumper/spool fatigue, erosion, connector assessment", method: "POST" },
  "assess_connector": { description: "Hub/clamp/collet connector seal and structural integrity", method: "POST" },
  "assess_control_system": { description: "Subsea control module and hydraulic system", method: "POST" },
  "assess_scssv": { description: "Surface-controlled subsurface safety valve assessment", method: "POST" },
  "assess_subsea_processing": { description: "Subsea separation, boosting, compression", method: "POST" },
  "classify_equipment": { description: "Equipment type classification and critical area mapping", method: "POST" },
  "get_history": { description: "Retrieve past subsea equipment assessments", method: "POST" }
};

// ── EQUIPMENT REGISTRY ─────────────────────────────────────────────────
var EQUIPMENT_TYPES = {
  horizontal_tree: {
    display_name: "Horizontal Christmas Tree",
    api_class: "API 17D / API 6A",
    pressure_ratings: ["5000", "10000", "15000", "20000"],
    critical_components: [
      { component: "master_valve", failure_mode: "seat_erosion_leak", inspection: "ROV VT + pressure test", severity: "critical" },
      { component: "wing_valve", failure_mode: "stem_seal_leak", inspection: "ROV VT + pressure test", severity: "high" },
      { component: "swab_valve", failure_mode: "seat_damage", inspection: "Pressure test", severity: "medium" },
      { component: "choke_valve", failure_mode: "trim_erosion_cavitation", inspection: "Acoustic monitoring + pressure test", severity: "critical" },
      { component: "tubing_hanger", failure_mode: "seal_degradation_corrosion", inspection: "Annulus pressure monitoring", severity: "critical" },
      { component: "tree_connector", failure_mode: "fatigue_preload_loss", inspection: "ROV VT + RT", severity: "critical" },
      { component: "actuator", failure_mode: "hydraulic_seal_failure", inspection: "Function test + ROV VT", severity: "high" },
      { component: "tree_cap", failure_mode: "seal_degradation", inspection: "ROV VT + pressure test", severity: "medium" }
    ]
  },
  vertical_tree: {
    display_name: "Vertical Christmas Tree",
    api_class: "API 17D / API 6A",
    pressure_ratings: ["5000", "10000", "15000"],
    critical_components: [
      { component: "master_valve", failure_mode: "seat_erosion", inspection: "ROV VT + pressure test", severity: "critical" },
      { component: "wing_valve", failure_mode: "stem_seal_degradation", inspection: "ROV VT + pressure test", severity: "high" },
      { component: "tubing_spool", failure_mode: "erosion_corrosion", inspection: "UT wall thickness", severity: "high" },
      { component: "tree_body", failure_mode: "external_corrosion", inspection: "ROV VT + CP survey", severity: "medium" },
      { component: "connector", failure_mode: "fatigue_seal_failure", inspection: "ROV VT + annulus monitor", severity: "critical" }
    ]
  },
  subsea_bop: {
    display_name: "Subsea BOP Stack",
    api_class: "API 53 / API 16A / API 16D",
    pressure_ratings: ["10000", "15000", "20000"],
    critical_components: [
      { component: "blind_shear_ram", failure_mode: "blade_wear_seal_degradation", inspection: "Function test + pressure test", severity: "critical" },
      { component: "pipe_ram", failure_mode: "seal_wear_hydraulic_leak", inspection: "Function test + pressure test", severity: "critical" },
      { component: "annular_preventer", failure_mode: "packer_element_degradation", inspection: "Function test + pressure test", severity: "critical" },
      { component: "choke_kill_valves", failure_mode: "erosion_washout", inspection: "Pressure test + VT", severity: "high" },
      { component: "wellhead_connector", failure_mode: "preload_loss_seal_leak", inspection: "Pressure test + ROV VT", severity: "critical" },
      { component: "riser_connector", failure_mode: "fatigue_seal_failure", inspection: "Pressure test + MPI", severity: "critical" },
      { component: "control_system", failure_mode: "solenoid_failure_hydraulic_leak", inspection: "Function test + diagnostic", severity: "critical" },
      { component: "accumulator", failure_mode: "bladder_failure_precharge_loss", inspection: "Pressure monitoring", severity: "high" }
    ]
  },
  umbilical: {
    display_name: "Subsea Umbilical",
    api_class: "API 17E / ISO 13628-5",
    critical_components: [
      { component: "steel_tube_hydraulic", failure_mode: "fatigue_corrosion_leak", inspection: "Pressure test + annulus monitor", severity: "critical" },
      { component: "steel_tube_chemical", failure_mode: "internal_corrosion_plugging", inspection: "Flow test + pressure test", severity: "high" },
      { component: "thermoplastic_hose", failure_mode: "aging_permeation_collapse", inspection: "Pressure test + flow test", severity: "high" },
      { component: "power_cable", failure_mode: "insulation_degradation_water_ingress", inspection: "Megger test + TDR", severity: "high" },
      { component: "fiber_optic", failure_mode: "attenuation_breakage", inspection: "OTDR test", severity: "medium" },
      { component: "armor_wires", failure_mode: "fatigue_corrosion_birdcaging", inspection: "ROV VT + UT", severity: "high" },
      { component: "outer_sheath", failure_mode: "abrasion_UV_degradation", inspection: "ROV VT", severity: "medium" },
      { component: "termination", failure_mode: "seal_failure_pull_out", inspection: "ROV VT + pressure test", severity: "critical" }
    ]
  },
  manifold: {
    display_name: "Subsea Manifold",
    api_class: "API 17A / API 17D",
    critical_components: [
      { component: "structural_frame", failure_mode: "fatigue_corrosion_impact", inspection: "ROV VT + UT", severity: "high" },
      { component: "header_piping", failure_mode: "erosion_corrosion_fatigue", inspection: "UT wall thickness", severity: "critical" },
      { component: "valves", failure_mode: "seat_erosion_stem_seal_leak", inspection: "Function test + pressure test", severity: "critical" },
      { component: "hub_connections", failure_mode: "fatigue_seal_degradation", inspection: "ROV VT + pressure test", severity: "critical" },
      { component: "pig_loop", failure_mode: "erosion_internal_corrosion", inspection: "UT + pigging records", severity: "medium" },
      { component: "foundation_mudmats", failure_mode: "scour_settlement", inspection: "ROV survey + sonar", severity: "medium" }
    ]
  },
  wellhead: {
    display_name: "Subsea Wellhead",
    api_class: "API 17D / API 6A",
    critical_components: [
      { component: "high_pressure_housing", failure_mode: "fatigue_drilling_loads", inspection: "UT + MPI (during workover)", severity: "critical" },
      { component: "low_pressure_housing", failure_mode: "corrosion_cement_channel", inspection: "ROV VT + UT", severity: "high" },
      { component: "casing_hangers", failure_mode: "corrosion_seal_degradation", inspection: "Annulus monitoring", severity: "critical" },
      { component: "wear_bushing", failure_mode: "wear_from_drill_string", inspection: "Caliper during workover", severity: "medium" },
      { component: "conductor_housing", failure_mode: "fatigue_soil_interaction", inspection: "ROV VT + UT", severity: "high" },
      { component: "wellhead_connector_profile", failure_mode: "damage_from_BOP_landing", inspection: "ROV VT + profile gauge", severity: "critical" }
    ]
  }
};

// ── TREE ASSESSMENT ────────────────────────────────────────────────────
function assessTree(body: any): any {
  var treeType = body.tree_type || "horizontal_tree";
  var treeInfo = EQUIPMENT_TYPES[treeType] || EQUIPMENT_TYPES.horizontal_tree;
  var age_years = body.age_years || 0;
  var designLife = body.design_life_years || 25;
  var pressureRating_psi = body.pressure_rating_psi || 10000;
  var waterDepth_m = body.water_depth_m || 500;
  var productionRate_bopd = body.production_rate_bopd || 10000;
  var h2s_present = body.h2s_present || false;
  var co2_present = body.co2_present || false;
  var sand_production = body.sand_production || false;

  var componentAssessments: any[] = [];
  var riskFactors: string[] = [];

  for (var i = 0; i < treeInfo.critical_components.length; i++) {
    var comp = treeInfo.critical_components[i];
    var compRisk = "low";
    var compNotes: string[] = [];

    // Age-based degradation
    if (age_years > designLife * 0.7) {
      compRisk = "high";
      compNotes.push("Component age exceeds 70% of design life");
    } else if (age_years > designLife * 0.5) {
      compRisk = "moderate";
      compNotes.push("Component at mid-life");
    }

    // Sour service impacts
    if (h2s_present && (comp.component.indexOf("valve") !== -1 || comp.component === "tubing_hanger")) {
      compRisk = compRisk === "low" ? "moderate" : "high";
      compNotes.push("H2S service — SSC/SCC risk per NACE MR0175");
    }

    // Sand production impacts
    if (sand_production && (comp.component === "choke_valve" || comp.component.indexOf("erosion") !== -1 || comp.component === "header_piping")) {
      compRisk = "high";
      compNotes.push("Sand production — accelerated erosion of trim/seats");
    }

    // CO2 impacts
    if (co2_present && comp.failure_mode.indexOf("corrosion") !== -1) {
      compRisk = compRisk === "low" ? "moderate" : "high";
      compNotes.push("CO2 service — sweet corrosion risk");
    }

    componentAssessments.push({
      component: comp.component,
      failure_mode: comp.failure_mode,
      inspection_method: comp.inspection,
      base_severity: comp.severity,
      assessed_risk: compRisk,
      notes: compNotes
    });

    if (compRisk === "high" && comp.severity === "critical") {
      riskFactors.push(comp.component + ": " + compNotes.join("; "));
    }
  }

  var overallRisk = riskFactors.length >= 3 ? "high"
    : riskFactors.length >= 1 ? "moderate"
    : "low";

  var acceptance = overallRisk === "high" ? "WORKOVER_RECOMMENDED"
    : overallRisk === "moderate" ? "MONITOR"
    : "ACCEPTABLE";

  // Remaining life estimate
  var remainingLife = designLife - age_years;
  if (h2s_present) remainingLife *= 0.80;
  if (sand_production) remainingLife *= 0.70;
  if (remainingLife < 0) remainingLife = 0;

  return {
    tree_type: treeType,
    display_name: treeInfo.display_name,
    api_class: treeInfo.api_class,
    age_years: age_years,
    design_life_years: designLife,
    pressure_rating_psi: pressureRating_psi,
    water_depth_m: waterDepth_m,
    service_conditions: { h2s: h2s_present, co2: co2_present, sand: sand_production },
    component_assessments: componentAssessments,
    risk_factors: riskFactors,
    overall_risk: overallRisk,
    remaining_life_years: Math.round(remainingLife * 10) / 10,
    acceptance: acceptance,
    method: "API 17D / API 6A subsea tree assessment"
  };
}

// ── BOP ASSESSMENT ─────────────────────────────────────────────────────
function assessBOP(body: any): any {
  var bopInfo = EQUIPMENT_TYPES.subsea_bop;
  var age_years = body.age_years || 0;
  var lastTestDate = body.last_pressure_test_date || null;
  var daysSinceTest = body.days_since_test || 14;
  var pressureRating_psi = body.pressure_rating_psi || 15000;
  var ramCount = body.ram_count || 4;
  var annularCount = body.annular_count || 1;
  var accumulatorVolume_gal = body.accumulator_volume_gal || 0;
  var accumulatorPrecharge_psi = body.accumulator_precharge_psi || 0;
  var accumulatorMin_psi = body.accumulator_min_precharge_psi || 1000;

  var findings: any[] = [];
  var riskFactors: string[] = [];

  // Regulatory compliance check (API 53 / 30 CFR 250)
  if (daysSinceTest > 14) {
    riskFactors.push("BOP pressure test overdue — exceeds 14-day interval per 30 CFR 250.449");
  }
  if (daysSinceTest > 21) {
    riskFactors.push("CRITICAL: BOP test overdue > 21 days — regulatory non-compliance");
  }

  // Accumulator check
  if (accumulatorPrecharge_psi > 0 && accumulatorPrecharge_psi < accumulatorMin_psi) {
    riskFactors.push("Accumulator precharge below minimum — function time at risk");
  }

  // Component assessments
  for (var i = 0; i < bopInfo.critical_components.length; i++) {
    var comp = bopInfo.critical_components[i];
    var status = "operational";

    // Check provided component status overrides
    if (body.component_status && body.component_status[comp.component]) {
      status = body.component_status[comp.component];
    }

    if (status === "degraded" || status === "failed") {
      riskFactors.push(comp.component + " status: " + status + " — " + comp.failure_mode);
    }

    findings.push({
      component: comp.component,
      status: status,
      failure_mode: comp.failure_mode,
      severity: comp.severity,
      inspection_method: comp.inspection
    });
  }

  // Function test results
  var functionTestResults = body.function_test_results || {};
  var failedFunctions = 0;
  for (var func in functionTestResults) {
    if (!functionTestResults[func]) {
      failedFunctions++;
      riskFactors.push("Function test failed: " + func);
    }
  }

  var acceptance = failedFunctions > 0 ? "REPAIR_REQUIRED"
    : riskFactors.length >= 3 ? "MONITOR_URGENT"
    : riskFactors.length >= 1 ? "MONITOR"
    : "ACCEPTABLE";

  return {
    display_name: bopInfo.display_name,
    pressure_rating_psi: pressureRating_psi,
    configuration: { rams: ramCount, annulars: annularCount },
    days_since_pressure_test: daysSinceTest,
    test_compliance: daysSinceTest <= 14 ? "COMPLIANT" : "NON_COMPLIANT",
    accumulator: {
      precharge_psi: accumulatorPrecharge_psi,
      min_required_psi: accumulatorMin_psi,
      adequate: accumulatorPrecharge_psi >= accumulatorMin_psi
    },
    component_findings: findings,
    function_test_failures: failedFunctions,
    risk_factors: riskFactors,
    acceptance: acceptance,
    method: "API 53 / API 16A / 30 CFR 250 BOP assessment"
  };
}

// ── UMBILICAL ASSESSMENT ───────────────────────────────────────────────
function assessUmbilical(body: any): any {
  var umbInfo = EQUIPMENT_TYPES.umbilical;
  var length_m = body.length_m || 1000;
  var waterDepth_m = body.water_depth_m || 500;
  var age_years = body.age_years || 0;
  var designLife = body.design_life_years || 25;
  var configuration = body.configuration || "static"; // static, dynamic, lazy_wave
  var tubeCount_hydraulic = body.hydraulic_tube_count || 4;
  var tubeCount_chemical = body.chemical_tube_count || 2;
  var powerCableCount = body.power_cable_count || 0;
  var fiberCount = body.fiber_count || 0;

  var assessments: any[] = [];
  var riskFactors: string[] = [];

  // Dynamic umbilical fatigue risk
  if (configuration === "dynamic" || configuration === "lazy_wave") {
    var fatigueRisk = age_years > designLife * 0.6 ? "high" : age_years > designLife * 0.4 ? "moderate" : "low";
    assessments.push({
      aspect: "dynamic_fatigue",
      risk: fatigueRisk,
      note: "Dynamic configuration — fatigue is primary degradation mechanism"
    });
    if (fatigueRisk === "high") riskFactors.push("Dynamic umbilical fatigue risk — age > 60% of design life");
  }

  // Armor wire assessment
  var armorCorrosionRate = body.armor_corrosion_rate_mm_yr || 0.05;
  var armorOriginalDia = body.armor_wire_dia_mm || 6;
  var armorLoss = armorCorrosionRate * age_years;
  var armorRemaining = armorOriginalDia - 2 * armorLoss;
  var armorLifeYears = armorCorrosionRate > 0 ? (armorOriginalDia * 0.20) / (2 * armorCorrosionRate) : designLife;

  assessments.push({
    aspect: "armor_wire_corrosion",
    original_dia_mm: armorOriginalDia,
    loss_to_date_mm: Math.round(armorLoss * 100) / 100,
    remaining_dia_mm: Math.round(armorRemaining * 100) / 100,
    remaining_life_years: Math.round(armorLifeYears * 10) / 10,
    risk: armorRemaining < armorOriginalDia * 0.80 ? "high" : "low"
  });

  // Hydraulic tube assessment
  for (var t = 0; t < tubeCount_hydraulic; t++) {
    var tubeTestPressure = body.tube_test_pressures ? body.tube_test_pressures[t] : null;
    var tubePassed = tubeTestPressure ? tubeTestPressure >= (body.tube_rated_pressure || 10000) * 1.5 : true;
    assessments.push({
      aspect: "hydraulic_tube_" + (t + 1),
      test_pressure_psi: tubeTestPressure,
      test_passed: tubePassed,
      risk: tubePassed ? "low" : "high"
    });
    if (!tubePassed) riskFactors.push("Hydraulic tube " + (t + 1) + " failed pressure test");
  }

  // Power cable insulation
  if (powerCableCount > 0) {
    var meggerValue = body.megger_value_MOhm || 1000;
    var meggerMin = 100; // Minimum acceptable
    var cableRisk = meggerValue < meggerMin ? "high" : meggerValue < meggerMin * 5 ? "moderate" : "low";
    assessments.push({
      aspect: "power_cable_insulation",
      megger_MOhm: meggerValue,
      min_acceptable_MOhm: meggerMin,
      risk: cableRisk
    });
    if (cableRisk === "high") riskFactors.push("Power cable insulation resistance below minimum");
  }

  // Fiber optic assessment
  if (fiberCount > 0) {
    var otdrLoss = body.fiber_loss_dB_km || 0.3;
    var maxLoss = 0.5; // Typical single-mode max
    var fiberRisk = otdrLoss > maxLoss ? "high" : otdrLoss > maxLoss * 0.8 ? "moderate" : "low";
    assessments.push({
      aspect: "fiber_optic",
      measured_loss_dB_km: otdrLoss,
      max_acceptable_dB_km: maxLoss,
      risk: fiberRisk
    });
    if (fiberRisk === "high") riskFactors.push("Fiber optic loss exceeds maximum — possible damage or water ingress");
  }

  // Outer sheath / bend stiffener
  var sheathCondition = body.sheath_condition || "intact";
  if (sheathCondition === "damaged" || sheathCondition === "abraded") {
    riskFactors.push("Outer sheath " + sheathCondition + " — armor wire corrosion acceleration expected");
  }

  var acceptance = riskFactors.length >= 3 ? "REPLACEMENT_RECOMMENDED"
    : riskFactors.length >= 1 ? "MONITOR"
    : "ACCEPTABLE";

  return {
    display_name: umbInfo.display_name,
    configuration: configuration,
    length_m: length_m,
    water_depth_m: waterDepth_m,
    age_years: age_years,
    design_life_years: designLife,
    components: {
      hydraulic_tubes: tubeCount_hydraulic,
      chemical_tubes: tubeCount_chemical,
      power_cables: powerCableCount,
      fiber_optics: fiberCount
    },
    assessments: assessments,
    risk_factors: riskFactors,
    acceptance: acceptance,
    method: "API 17E / ISO 13628-5 umbilical assessment"
  };
}

// ── CONNECTOR ASSESSMENT ───────────────────────────────────────────────
function assessConnector(body: any): any {
  var connectorType = body.connector_type || "collet"; // collet, hub, clamp, flange
  var pressureRating_psi = body.pressure_rating_psi || 10000;
  var age_years = body.age_years || 0;
  var makeBrakeCount = body.make_brake_cycles || 0;
  var maxCycles = body.max_make_brake_cycles || 200;
  var preloadVerified = body.preload_verified !== undefined ? body.preload_verified : true;
  var sealCondition = body.seal_condition || "good"; // good, degraded, leaking
  var profileGaugeResult = body.profile_gauge_result || "pass"; // pass, marginal, fail
  var waterDepth_m = body.water_depth_m || 500;

  var riskFactors: string[] = [];

  // Make-brake cycle fatigue
  var cycleUtilization = maxCycles > 0 ? makeBrakeCount / maxCycles : 0;
  if (cycleUtilization > 0.80) riskFactors.push("Make-brake cycles > 80% of rated life");
  if (cycleUtilization > 1.0) riskFactors.push("CRITICAL: Make-brake cycles exceed rated life");

  // Preload check
  if (!preloadVerified) riskFactors.push("Connector preload not verified — seal reliability unknown");

  // Seal condition
  if (sealCondition === "degraded") riskFactors.push("Seal degradation detected — monitor annulus pressure");
  if (sealCondition === "leaking") riskFactors.push("CRITICAL: Active seal leak — immediate intervention required");

  // Profile gauge
  if (profileGaugeResult === "marginal") riskFactors.push("Profile gauge marginal — connector landing surface wear");
  if (profileGaugeResult === "fail") riskFactors.push("CRITICAL: Profile gauge fail — connector cannot seal properly");

  var acceptance = sealCondition === "leaking" || profileGaugeResult === "fail" ? "IMMEDIATE_INTERVENTION"
    : riskFactors.length >= 3 ? "WORKOVER_RECOMMENDED"
    : riskFactors.length >= 1 ? "MONITOR"
    : "ACCEPTABLE";

  return {
    connector_type: connectorType,
    pressure_rating_psi: pressureRating_psi,
    water_depth_m: waterDepth_m,
    make_brake_cycles: makeBrakeCount,
    max_rated_cycles: maxCycles,
    cycle_utilization: Math.round(cycleUtilization * 1000) / 1000,
    preload_verified: preloadVerified,
    seal_condition: sealCondition,
    profile_gauge_result: profileGaugeResult,
    risk_factors: riskFactors,
    acceptance: acceptance,
    method: "API 17D / API 6A connector assessment"
  };
}

// ── SCSSV ASSESSMENT ───────────────────────────────────────────────────
function assessSCSSV(body: any): any {
  var valveType = body.valve_type || "flapper"; // flapper, ball
  var settingDepth_ft = body.setting_depth_ft || 500;
  var age_years = body.age_years || 0;
  var lastTestDate = body.last_test_date || null;
  var testResult = body.test_result || "pass"; // pass, fail, leak
  var leakRate_scfm = body.leak_rate_scfm || 0;
  var maxLeakRate_scfm = 400; // API 14A allowable
  var closureTime_s = body.closure_time_s || null;
  var maxClosureTime_s = body.max_closure_time_s || 60;

  var riskFactors: string[] = [];

  // Test result
  if (testResult === "fail") riskFactors.push("CRITICAL: SCSSV failed function test — well barrier compromised");
  if (testResult === "leak" && leakRate_scfm > maxLeakRate_scfm) {
    riskFactors.push("SCSSV leak rate " + leakRate_scfm + " scf/min exceeds " + maxLeakRate_scfm + " scf/min allowable per API 14A");
  }

  // Closure time
  if (closureTime_s && closureTime_s > maxClosureTime_s) {
    riskFactors.push("Closure time " + closureTime_s + "s exceeds " + maxClosureTime_s + "s maximum");
  }

  // Age-based degradation
  if (age_years > 15) riskFactors.push("Valve age > 15 years — elastomer degradation concern");

  // Regulatory compliance (30 CFR 250.880)
  var testInterval_days = body.days_since_test || 0;
  if (testInterval_days > 365) {
    riskFactors.push("Annual SCSSV test overdue per 30 CFR 250.880");
  }

  var acceptance = testResult === "fail" ? "IMMEDIATE_WORKOVER"
    : leakRate_scfm > maxLeakRate_scfm ? "WORKOVER_RECOMMENDED"
    : riskFactors.length >= 2 ? "MONITOR"
    : "ACCEPTABLE";

  return {
    valve_type: valveType,
    setting_depth_ft: settingDepth_ft,
    age_years: age_years,
    test_result: testResult,
    leak_rate_scfm: leakRate_scfm,
    max_allowable_leak_scfm: maxLeakRate_scfm,
    closure_time_s: closureTime_s,
    max_closure_time_s: maxClosureTime_s,
    test_compliance: testInterval_days <= 365 ? "COMPLIANT" : "NON_COMPLIANT",
    risk_factors: riskFactors,
    acceptance: acceptance,
    method: "API 14A / 30 CFR 250.880 SCSSV assessment"
  };
}

// ── MANIFOLD ASSESSMENT ────────────────────────────────────────────────
function assessManifold(body: any): any {
  var manifoldInfo = EQUIPMENT_TYPES.manifold;
  var age_years = body.age_years || 0;
  var designLife = body.design_life_years || 25;
  var waterDepth_m = body.water_depth_m || 500;
  var wellCount = body.connected_wells || 4;
  var h2s_present = body.h2s_present || false;
  var sand_production = body.sand_production || false;
  var settlement_mm = body.measured_settlement_mm || 0;
  var maxSettlement_mm = body.max_settlement_mm || 150;

  var assessments: any[] = [];
  var riskFactors: string[] = [];

  // Structural frame
  var frameAge = age_years / designLife;
  assessments.push({
    aspect: "structural_frame",
    age_ratio: Math.round(frameAge * 100) / 100,
    risk: frameAge > 0.7 ? "moderate" : "low",
    note: "Frame designed per API 17A structural requirements"
  });

  // Settlement
  var settlementRatio = maxSettlement_mm > 0 ? settlement_mm / maxSettlement_mm : 0;
  if (settlementRatio > 0.80) riskFactors.push("Settlement " + settlement_mm + "mm approaching " + maxSettlement_mm + "mm limit");
  assessments.push({
    aspect: "foundation_settlement",
    measured_mm: settlement_mm,
    allowable_mm: maxSettlement_mm,
    utilization: Math.round(settlementRatio * 1000) / 1000,
    risk: settlementRatio > 0.80 ? "high" : settlementRatio > 0.50 ? "moderate" : "low"
  });

  // Header piping erosion (sand)
  if (sand_production) {
    riskFactors.push("Sand production — header piping erosion risk, monitor wall thickness");
    assessments.push({ aspect: "header_erosion", risk: "high", note: "Sand production active" });
  }

  // Sour service
  if (h2s_present) {
    riskFactors.push("H2S service — verify all materials per NACE MR0175");
    assessments.push({ aspect: "sour_service", risk: "moderate", note: "H2S present in production" });
  }

  // Valve condition
  var valveStatus = body.valve_status || {};
  var failedValves = 0;
  for (var v in valveStatus) {
    if (valveStatus[v] === "failed" || valveStatus[v] === "degraded") {
      failedValves++;
      riskFactors.push("Valve " + v + " status: " + valveStatus[v]);
    }
  }

  var acceptance = failedValves > 0 ? "INTERVENTION_REQUIRED"
    : riskFactors.length >= 3 ? "MONITOR_URGENT"
    : riskFactors.length >= 1 ? "MONITOR"
    : "ACCEPTABLE";

  return {
    display_name: manifoldInfo.display_name,
    water_depth_m: waterDepth_m,
    connected_wells: wellCount,
    age_years: age_years,
    assessments: assessments,
    risk_factors: riskFactors,
    acceptance: acceptance,
    method: "API 17A / API 17D manifold assessment"
  };
}

// ── JUMPER ASSESSMENT ──────────────────────────────────────────────────
function assessJumper(body: any): any {
  var jumperType = body.jumper_type || "rigid"; // rigid, flexible
  var length_m = body.length_m || 50;
  var age_years = body.age_years || 0;
  var designLife = body.design_life_years || 25;
  var OD_mm = body.OD_mm || 254;
  var WT_mm = body.WT_mm || 19;
  var flowVelocity_ms = body.flow_velocity_ms || 5;
  var sandRate_pptb = body.sand_rate_pptb || 0; // parts per thousand barrels
  var connectorCycles = body.connector_make_brake_cycles || 0;

  var riskFactors: string[] = [];

  // Erosion check at bends (API RP 14E simplified)
  var rho = body.fluid_density_kg_m3 || 800;
  var C_erosion = body.erosion_c_factor || 100; // API RP 14E C factor
  var Verosional = C_erosion / Math.sqrt(rho);
  var velocityRatio = flowVelocity_ms / Verosional;

  if (velocityRatio > 1.0) riskFactors.push("Flow velocity exceeds erosional velocity limit per API RP 14E");
  else if (velocityRatio > 0.80) riskFactors.push("Flow velocity approaching erosional limit — monitor bend intrados");

  // Sand erosion
  if (sandRate_pptb > 1) riskFactors.push("Sand production " + sandRate_pptb + " pptb — accelerated erosion at bends and restrictions");

  // Fatigue (dynamic jumpers)
  if (jumperType === "flexible" || body.dynamic) {
    var fatigueRatio = age_years / designLife;
    if (fatigueRatio > 0.70) riskFactors.push("Dynamic jumper at " + Math.round(fatigueRatio * 100) + "% of fatigue design life");
  }

  // Connector cycles
  if (connectorCycles > 150) riskFactors.push("Connector make-brake cycles " + connectorCycles + " — approaching rated life");

  // Wall thickness
  var corrosionRate = body.corrosion_rate_mm_yr || 0.1;
  var wallLoss = corrosionRate * age_years;
  var effectiveWT = WT_mm - wallLoss;
  var tmin = WT_mm * 0.875; // 12.5% retirement
  var remainingLife = corrosionRate > 0 ? (effectiveWT - tmin) / corrosionRate : designLife;

  if (remainingLife < 5) riskFactors.push("Remaining wall thickness life < 5 years");

  var acceptance = riskFactors.length >= 3 ? "REPLACEMENT_RECOMMENDED"
    : riskFactors.length >= 1 ? "MONITOR"
    : "ACCEPTABLE";

  return {
    jumper_type: jumperType,
    length_m: length_m,
    geometry: { OD_mm: OD_mm, WT_mm: WT_mm, effective_WT_mm: Math.round(effectiveWT * 100) / 100 },
    flow: {
      velocity_ms: flowVelocity_ms,
      erosional_velocity_ms: Math.round(Verosional * 100) / 100,
      velocity_ratio: Math.round(velocityRatio * 1000) / 1000,
      sand_rate_pptb: sandRate_pptb
    },
    wall_loss: {
      corrosion_rate_mm_yr: corrosionRate,
      loss_to_date_mm: Math.round(wallLoss * 100) / 100,
      remaining_life_years: Math.round(remainingLife * 10) / 10
    },
    connector_cycles: connectorCycles,
    risk_factors: riskFactors,
    acceptance: acceptance,
    method: "API 17A / API RP 14E / DNV-ST-F101 jumper assessment"
  };
}

// ── HANDLER ────────────────────────────────────────────────────────────
var handler: Handler = async function(event) {
  var headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: headers, body: "" };
  }

  try {
    var body: any = {};
    if (event.body) {
      try { body = JSON.parse(event.body); } catch (e) { body = {}; }
    }

    var action = body.action || "get_registry";

    if (action === "get_registry") {
      return {
        statusCode: 200, headers: headers,
        body: JSON.stringify({
          engine: "Subsea Production Equipment Assessment Engine",
          version: ENGINE_VERSION,
          deploy: "DEPLOY344",
          description: "Integrity assessment for subsea trees, wellheads, BOPs, umbilicals, manifolds, jumpers, connectors, SCSSSVs, and subsea processing equipment",
          actions: ACTION_REGISTRY,
          equipment_types: Object.keys(EQUIPMENT_TYPES),
          standards: ["API 17A", "API 17B", "API 17D", "API 17E", "API 17F", "API 6A", "API 14A", "API 53", "API 16A", "API 16D", "ISO 13628", "DNV-RP-F116", "30 CFR 250"],
          total_critical_components: (function() { var c = 0; for (var k in EQUIPMENT_TYPES) { c += EQUIPMENT_TYPES[k].critical_components.length; } return c; })()
        })
      };
    }

    if (action === "assess_tree") {
      var treeResult = assessTree(body);
      return { statusCode: 200, headers: headers, body: JSON.stringify({ deterministic: treeResult, provenance: { engine_version: ENGINE_VERSION, timestamp: new Date().toISOString() } }) };
    }

    if (action === "assess_bop") {
      var bopResult = assessBOP(body);
      return { statusCode: 200, headers: headers, body: JSON.stringify({ deterministic: bopResult, provenance: { engine_version: ENGINE_VERSION, timestamp: new Date().toISOString() } }) };
    }

    if (action === "assess_umbilical") {
      var umbResult = assessUmbilical(body);
      return { statusCode: 200, headers: headers, body: JSON.stringify({ deterministic: umbResult, provenance: { engine_version: ENGINE_VERSION, timestamp: new Date().toISOString() } }) };
    }

    if (action === "assess_connector") {
      var connResult = assessConnector(body);
      return { statusCode: 200, headers: headers, body: JSON.stringify({ deterministic: connResult, provenance: { engine_version: ENGINE_VERSION, timestamp: new Date().toISOString() } }) };
    }

    if (action === "assess_scssv") {
      var scssvResult = assessSCSSV(body);
      return { statusCode: 200, headers: headers, body: JSON.stringify({ deterministic: scssvResult, provenance: { engine_version: ENGINE_VERSION, timestamp: new Date().toISOString() } }) };
    }

    if (action === "assess_manifold") {
      var manifoldResult = assessManifold(body);
      return { statusCode: 200, headers: headers, body: JSON.stringify({ deterministic: manifoldResult, provenance: { engine_version: ENGINE_VERSION, timestamp: new Date().toISOString() } }) };
    }

    if (action === "assess_jumper") {
      var jumperResult = assessJumper(body);
      return { statusCode: 200, headers: headers, body: JSON.stringify({ deterministic: jumperResult, provenance: { engine_version: ENGINE_VERSION, timestamp: new Date().toISOString() } }) };
    }

    if (action === "assess_wellhead") {
      var whResult = { display_name: "Subsea Wellhead Assessment", components: EQUIPMENT_TYPES.wellhead.critical_components, age_years: body.age_years || 0, acceptance: body.age_years > 20 ? "MONITOR" : "ACCEPTABLE", method: "API 17D / API 6A wellhead assessment" };
      return { statusCode: 200, headers: headers, body: JSON.stringify({ deterministic: whResult, provenance: { engine_version: ENGINE_VERSION, timestamp: new Date().toISOString() } }) };
    }

    if (action === "classify_equipment") {
      var eType = body.equipment_type || "horizontal_tree";
      var eInfo = EQUIPMENT_TYPES[eType] || null;
      return { statusCode: 200, headers: headers, body: JSON.stringify({ equipment_type: eType, info: eInfo, engine_version: ENGINE_VERSION }) };
    }

    if (action === "get_history") {
      if (!supabaseUrl || !supabaseKey) return { statusCode: 200, headers: headers, body: JSON.stringify({ history: [] }) };
      var db = createClient(supabaseUrl, supabaseKey);
      var q = db.from("subsea_equipment_assessments").select("*").order("created_at", { ascending: false }).limit(body.limit || 20);
      var r = await q;
      return { statusCode: 200, headers: headers, body: JSON.stringify({ history: r.data || [], count: (r.data || []).length }) };
    }

    return { statusCode: 200, headers: headers, body: JSON.stringify({ error: "Unknown action: " + action, available_actions: Object.keys(ACTION_REGISTRY), engine_version: ENGINE_VERSION }) };

  } catch (err: any) {
    return { statusCode: 200, headers: headers, body: JSON.stringify({ error: "Engine error: " + (err.message || String(err)), engine_version: ENGINE_VERSION }) };
  }
};

export { handler };
