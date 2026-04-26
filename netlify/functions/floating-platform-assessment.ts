// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ══════════════════════════════════════════════════════════════════════════════
// FLOATING PLATFORM ASSESSMENT ENGINE
// DEPLOY343
//
// Comprehensive structural and integrity assessment for floating production
// and drilling systems. Covers every major floating platform type:
//
//   FPSO  — Floating Production Storage Offloading
//   TLP   — Tension Leg Platform
//   Semi  — Semi-Submersible (production and drilling)
//   SPAR  — Deep-draft cylinder platforms
//   CT    — Compliant Tower (hybrid fixed/floating)
//   MODU  — Mobile Offshore Drilling Units
//   FSO   — Floating Storage and Offloading
//   FLNG  — Floating Liquefied Natural Gas
//
// Standards implemented:
//   API RP 2FPS  — Floating Production Systems design/operation
//   API RP 2T    — Tension Leg Platforms
//   API RP 2SK   — Stationkeeping (mooring interface)
//   DNV-OS-C101  — Design of Offshore Steel Structures
//   DNV-OS-C103  — Structural Design of Column-Stabilised Units
//   DNV-OS-C106  — Structural Design of Deep-Draught Floating Units
//   ABS Rules     — Floating Production Installations
//   IACS UR S     — Structural requirements for ships and FPSOs
//   ISO 19904-1  — Floating Offshore Structures (general)
//
// Assessment areas:
//   1. Hull structural assessment (plating, frames, bulkheads)
//   2. Column/pontoon assessment (semi-subs, SPARs)
//   3. Turret system assessment (FPSO internal/external turret)
//   4. Topside-hull interface (module support stools, deck integration)
//   5. Air gap analysis (wave crest clearance for survival conditions)
//   6. Motion-induced fatigue (springing, whipping, slamming)
//   7. Tendon assessment (TLP tendons — fatigue, corrosion, creep)
//   8. Hull corrosion and coating assessment
//   9. Ballast system integrity
//  10. Green water / deck wetness assessment
//
// Actions:
// - get_registry: Return engine capabilities
// - assess_hull: Full hull structural assessment
// - assess_column: Column/pontoon assessment (semi-sub, SPAR)
// - assess_turret: Turret bearing and structure assessment (FPSO)
// - assess_tendon: TLP tendon integrity assessment
// - assess_topside_interface: Module support / deck integration
// - assess_air_gap: Wave crest clearance analysis
// - assess_motion_fatigue: Springing, whipping, VIM fatigue
// - assess_green_water: Deck wetness and green water loading
// - assess_hull_corrosion: Corrosion zones and coating condition
// - classify_platform: Determine platform type and critical areas
// - get_history: Retrieve past assessments
//
// ══════════════════════════════════════════════════════════════════════════════

var ENGINE_VERSION = "FPA-1.0.0";

var ACTION_REGISTRY = {
  "get_registry": { description: "Return engine capabilities", method: "GET_OR_POST" },
  "assess_hull": { description: "Full hull structural assessment (plating, frames, bulkheads)", method: "POST" },
  "assess_column": { description: "Column/pontoon structural assessment (semi-sub, SPAR)", method: "POST" },
  "assess_turret": { description: "FPSO turret bearing and structure assessment", method: "POST" },
  "assess_tendon": { description: "TLP tendon integrity (fatigue, corrosion, creep)", method: "POST" },
  "assess_topside_interface": { description: "Module support stool and deck integration check", method: "POST" },
  "assess_air_gap": { description: "Wave crest clearance for survival sea states", method: "POST" },
  "assess_motion_fatigue": { description: "Motion-induced fatigue (springing, whipping, VIM, slamming)", method: "POST" },
  "assess_green_water": { description: "Deck wetness and green water loading assessment", method: "POST" },
  "assess_hull_corrosion": { description: "Hull corrosion zones and coating condition", method: "POST" },
  "classify_platform": { description: "Determine platform type and map critical areas", method: "POST" },
  "get_history": { description: "Retrieve past floating platform assessments", method: "POST" }
};

// ── PLATFORM TYPE REGISTRY ─────────────────────────────────────────────
// Critical areas, typical failure modes, and inspection priorities per type
var PLATFORM_TYPES = {
  FPSO: {
    display_name: "FPSO — Floating Production Storage Offloading",
    hull_type: "ship_shaped",
    mooring: ["internal_turret", "external_turret", "spread_moored"],
    critical_areas: [
      { zone: "turret_bearing", severity: "critical", failure_mode: "fatigue_wear", inspection_method: "VT + UT gauging" },
      { zone: "side_shell_waterline", severity: "high", failure_mode: "corrosion_fatigue", inspection_method: "UT C-scan + PAUT" },
      { zone: "deck_longitudinals", severity: "high", failure_mode: "fatigue_cracking", inspection_method: "MPI + PAUT" },
      { zone: "bottom_plating", severity: "high", failure_mode: "corrosion_pitting", inspection_method: "UT thickness survey" },
      { zone: "cargo_tank_internals", severity: "high", failure_mode: "corrosion_coating_breakdown", inspection_method: "VT + UT + coating survey" },
      { zone: "ballast_tank_internals", severity: "high", failure_mode: "corrosion_MIC", inspection_method: "VT + UT + anode check" },
      { zone: "topside_module_stools", severity: "critical", failure_mode: "fatigue_at_connections", inspection_method: "MPI + PAUT" },
      { zone: "bow_slamming_zone", severity: "high", failure_mode: "slamming_fatigue", inspection_method: "VT + crack detection" },
      { zone: "midship_section", severity: "medium", failure_mode: "still_water_bending", inspection_method: "UT thickness + VT" },
      { zone: "riser_porches", severity: "critical", failure_mode: "fatigue_dynamic_loading", inspection_method: "MPI + PAUT + ROV" }
    ],
    design_life_years: 25,
    class_survey_interval: 5,
    code_references: ["API RP 2FPS", "ABS FPI Rules", "DNV-OS-C102", "IACS UR S"]
  },
  TLP: {
    display_name: "TLP — Tension Leg Platform",
    hull_type: "column_stabilised",
    mooring: ["tendons"],
    critical_areas: [
      { zone: "tendon_top_connector", severity: "critical", failure_mode: "fatigue_fretting", inspection_method: "UT + MPI + RT" },
      { zone: "tendon_bottom_connector", severity: "critical", failure_mode: "fatigue_corrosion", inspection_method: "ROV + UT" },
      { zone: "tendon_body", severity: "high", failure_mode: "corrosion_fatigue", inspection_method: "ROV visual + UT" },
      { zone: "hull_column_brace", severity: "high", failure_mode: "fatigue_cracking", inspection_method: "FMD + PAUT" },
      { zone: "pontoon_connections", severity: "critical", failure_mode: "fatigue_at_nodes", inspection_method: "MPI + PAUT" },
      { zone: "foundation_template", severity: "high", failure_mode: "scour_corrosion", inspection_method: "ROV + sonar" },
      { zone: "deck_to_column_connection", severity: "critical", failure_mode: "fatigue_stress_concentration", inspection_method: "PAUT + MPI" },
      { zone: "porches_guides", severity: "medium", failure_mode: "wear_corrosion", inspection_method: "ROV + VT" }
    ],
    design_life_years: 30,
    class_survey_interval: 5,
    code_references: ["API RP 2T", "API RP 2FPS", "DNV-OS-C105", "ISO 19904-1"]
  },
  SEMI_SUB: {
    display_name: "Semi-Submersible Platform",
    hull_type: "column_stabilised",
    mooring: ["catenary", "taut_leg", "dynamic_positioning"],
    critical_areas: [
      { zone: "column_brace_nodes", severity: "critical", failure_mode: "fatigue_cracking", inspection_method: "PAUT + MPI" },
      { zone: "pontoon_plating", severity: "high", failure_mode: "corrosion_pitting", inspection_method: "UT thickness" },
      { zone: "column_hull_connection", severity: "critical", failure_mode: "fatigue_wave_induced", inspection_method: "PAUT + TOFD" },
      { zone: "brace_connections", severity: "critical", failure_mode: "fatigue_at_joints", inspection_method: "MPI + PAUT" },
      { zone: "pontoon_internal_structure", severity: "medium", failure_mode: "corrosion_ballast_tanks", inspection_method: "VT + UT" },
      { zone: "deck_box_connections", severity: "high", failure_mode: "fatigue_operational_loading", inspection_method: "MPI + UT" },
      { zone: "chain_hawse", severity: "high", failure_mode: "wear_corrosion", inspection_method: "VT + UT gauging" },
      { zone: "fairlead_area", severity: "high", failure_mode: "fatigue_mooring_loads", inspection_method: "MPI + UT" }
    ],
    design_life_years: 25,
    class_survey_interval: 5,
    code_references: ["API RP 2FPS", "DNV-OS-C103", "ABS MODU Rules", "ISO 19904-1"]
  },
  SPAR: {
    display_name: "SPAR — Deep-Draft Caisson Vessel",
    hull_type: "deep_draft_cylinder",
    mooring: ["catenary", "taut_leg"],
    critical_areas: [
      { zone: "hard_tank_soft_tank_transition", severity: "critical", failure_mode: "fatigue_stress_concentration", inspection_method: "PAUT + MPI" },
      { zone: "strake_attachments", severity: "high", failure_mode: "fatigue_VIV_suppression", inspection_method: "ROV + UT" },
      { zone: "moonpool_area", severity: "high", failure_mode: "corrosion_splash_internal", inspection_method: "VT + UT" },
      { zone: "keel_tank", severity: "medium", failure_mode: "corrosion_ballast", inspection_method: "ROV + UT" },
      { zone: "chain_fairlead_area", severity: "high", failure_mode: "fatigue_mooring", inspection_method: "MPI + UT" },
      { zone: "hull_shell_plating", severity: "medium", failure_mode: "corrosion_marine_growth", inspection_method: "UT thickness + ROV" },
      { zone: "topside_deck_interface", severity: "critical", failure_mode: "fatigue_heave_response", inspection_method: "PAUT + MPI" }
    ],
    design_life_years: 30,
    class_survey_interval: 5,
    code_references: ["API RP 2FPS", "DNV-OS-C106", "ABS SPAR Rules"]
  },
  COMPLIANT_TOWER: {
    display_name: "Compliant Tower",
    hull_type: "flexible_tower",
    mooring: ["none_fixed_to_seabed"],
    critical_areas: [
      { zone: "flex_element_connections", severity: "critical", failure_mode: "fatigue_cyclic_bending", inspection_method: "PAUT + MPI" },
      { zone: "tower_base_foundation", severity: "critical", failure_mode: "scour_settlement", inspection_method: "ROV + sonar" },
      { zone: "conductor_guides", severity: "high", failure_mode: "wear_vibration", inspection_method: "VT + UT" },
      { zone: "buoyancy_tank", severity: "medium", failure_mode: "corrosion_flooding", inspection_method: "UT + pressure test" },
      { zone: "splash_zone_members", severity: "high", failure_mode: "corrosion_accelerated", inspection_method: "UT thickness + VT" }
    ],
    design_life_years: 30,
    class_survey_interval: 5,
    code_references: ["API RP 2A-WSD", "API RP 2FPS", "DNV-OS-C101"]
  },
  FSO: {
    display_name: "FSO — Floating Storage and Offloading",
    hull_type: "ship_shaped",
    mooring: ["spread_moored", "single_point"],
    critical_areas: [
      { zone: "cargo_tank_structure", severity: "high", failure_mode: "corrosion_coating_breakdown", inspection_method: "VT + UT + coating" },
      { zone: "ballast_tanks", severity: "high", failure_mode: "corrosion_pitting_MIC", inspection_method: "VT + UT + anode" },
      { zone: "side_shell", severity: "high", failure_mode: "corrosion_fatigue", inspection_method: "UT C-scan" },
      { zone: "offloading_system", severity: "critical", failure_mode: "hose_fatigue_wear", inspection_method: "VT + pressure test" },
      { zone: "mooring_connections", severity: "critical", failure_mode: "fatigue_chain", inspection_method: "MPI + UT" }
    ],
    design_life_years: 25,
    class_survey_interval: 5,
    code_references: ["ABS FSO Guide", "IACS UR S", "API RP 2FPS"]
  },
  FLNG: {
    display_name: "FLNG — Floating Liquefied Natural Gas",
    hull_type: "ship_shaped",
    mooring: ["internal_turret", "spread_moored"],
    critical_areas: [
      { zone: "lng_containment", severity: "critical", failure_mode: "cryogenic_fatigue_leak", inspection_method: "Specialized LNG survey" },
      { zone: "turret_system", severity: "critical", failure_mode: "bearing_fatigue", inspection_method: "VT + UT + bearing monitor" },
      { zone: "process_module_stools", severity: "critical", failure_mode: "fatigue_vibration", inspection_method: "PAUT + MPI" },
      { zone: "hull_cryogenic_zone", severity: "critical", failure_mode: "brittle_fracture_low_temp", inspection_method: "UT + PAUT + temp monitor" },
      { zone: "side_shell", severity: "high", failure_mode: "corrosion_fatigue", inspection_method: "UT C-scan" }
    ],
    design_life_years: 30,
    class_survey_interval: 5,
    code_references: ["IGC Code", "ABS FLNG Guide", "DNV-OS-C102", "ISO 19904-1"]
  },
  MODU: {
    display_name: "MODU — Mobile Offshore Drilling Unit",
    hull_type: "column_stabilised",
    mooring: ["catenary", "dynamic_positioning"],
    critical_areas: [
      { zone: "derrick_substructure", severity: "critical", failure_mode: "fatigue_drilling_loads", inspection_method: "MPI + UT" },
      { zone: "column_brace_joints", severity: "critical", failure_mode: "fatigue_wave_motion", inspection_method: "PAUT + MPI" },
      { zone: "cantilever_rails", severity: "high", failure_mode: "wear_fatigue", inspection_method: "VT + MPI + UT" },
      { zone: "pontoon_structure", severity: "high", failure_mode: "corrosion_ballast", inspection_method: "VT + UT thickness" },
      { zone: "jacking_system", severity: "critical", failure_mode: "fatigue_preload_cycling", inspection_method: "MPI + UT (jack-ups)" },
      { zone: "spud_cans", severity: "high", failure_mode: "punch_through_scour", inspection_method: "ROV + sonar" }
    ],
    design_life_years: 25,
    class_survey_interval: 5,
    code_references: ["IMO MODU Code", "ABS MODU Rules", "DNV-OS-C104", "SOLAS"]
  }
};

// ── HULL SECTION MODULUS REQUIREMENTS ───────────────────────────────────
// Minimum section modulus per IACS UR S / classification rules
// SM_min = C1 * L^2 * B * (Cb + 0.7) * 10^-3  (cm^2-m)
function computeMinSectionModulus(L_m: number, B_m: number, Cb: number, C1: number): number {
  if (!C1) C1 = 10.75; // Default for unrestricted service
  var SM = C1 * L_m * L_m * B_m * (Cb + 0.7) * 0.001;
  return SM;
}

// ── HULL GIRDER BENDING MOMENT ─────────────────────────────────────────
// Still water + wave-induced bending per IACS UR S
function computeHullBendingMoment(L_m: number, B_m: number, Cb: number, type: string): any {
  // Still water sagging (IACS UR S-11)
  var Msw_sag = -0.065 * 1.025 * L_m * L_m * B_m * Cb; // kN-m (negative = sagging)
  // Still water hogging
  var Msw_hog = 0.035 * 1.025 * L_m * L_m * B_m * (Cb + 0.3);

  // Wave-induced bending (IACS UR S-11)
  var C_wave = 10.75 - ((300 - L_m) / 100) * ((300 - L_m) / 100) * ((300 - L_m) / 100) / 150;
  if (L_m > 300) C_wave = 10.75;
  if (L_m < 90) C_wave = 10.75 - ((300 - L_m) / 100) * ((300 - L_m) / 100) * ((300 - L_m) / 100) / 150;

  var Mw_sag = -0.11 * C_wave * L_m * L_m * B_m * (Cb + 0.7);
  var Mw_hog = 0.19 * C_wave * L_m * L_m * B_m * Cb;

  return {
    still_water_sagging_kNm: Math.round(Msw_sag),
    still_water_hogging_kNm: Math.round(Msw_hog),
    wave_sagging_kNm: Math.round(Mw_sag),
    wave_hogging_kNm: Math.round(Mw_hog),
    total_sagging_kNm: Math.round(Msw_sag + Mw_sag),
    total_hogging_kNm: Math.round(Msw_hog + Mw_hog),
    governing: Math.abs(Msw_sag + Mw_sag) > Math.abs(Msw_hog + Mw_hog) ? "sagging" : "hogging"
  };
}

// ── PLATE BUCKLING CHECK ───────────────────────────────────────────────
// Elastic buckling stress for flat plate under uniaxial compression
// sigma_cr = k * pi^2 * E / (12 * (1 - nu^2)) * (t/b)^2
function checkPlateBuckling(t_mm: number, b_mm: number, sigma_applied_MPa: number, Fy_MPa: number): any {
  var E = 210000; // MPa for steel
  var nu = 0.3;
  var k = 4.0; // Simply supported on all edges
  var t_b_ratio = t_mm / b_mm;

  var sigma_cr = k * Math.PI * Math.PI * E / (12 * (1 - nu * nu)) * t_b_ratio * t_b_ratio;

  // Johnson-Ostenfeld correction for inelastic buckling
  var sigma_cr_corrected = sigma_cr;
  if (sigma_cr > 0.5 * Fy_MPa) {
    sigma_cr_corrected = Fy_MPa * (1 - Fy_MPa / (4 * sigma_cr));
  }

  var utilization = sigma_applied_MPa / sigma_cr_corrected;
  var acceptance = utilization <= 0.80 ? "ACCEPTABLE" : utilization <= 1.0 ? "MARGINAL" : "BUCKLING_RISK";

  return {
    elastic_buckling_stress_MPa: Math.round(sigma_cr * 100) / 100,
    corrected_buckling_stress_MPa: Math.round(sigma_cr_corrected * 100) / 100,
    applied_stress_MPa: sigma_applied_MPa,
    utilization: Math.round(utilization * 1000) / 1000,
    acceptance: acceptance,
    method: "IACS UR S / DNV-OS-C101 plate buckling"
  };
}

// ── AIR GAP ANALYSIS ───────────────────────────────────────────────────
// Minimum clearance between underside of deck and wave crest
// Per API RP 2FPS / DNV-OS-C103
function assessAirGap(deck_elevation_m: number, max_wave_crest_m: number, heave_m: number, tide_m: number, subsidence_m: number, safety_margin_m: number): any {
  if (!safety_margin_m) safety_margin_m = 1.5; // DNV minimum 1.5m

  var total_water_rise = max_wave_crest_m + tide_m + subsidence_m;
  var effective_deck_clearance = deck_elevation_m - heave_m; // Heave reduces clearance
  var air_gap = effective_deck_clearance - total_water_rise;
  var air_gap_ratio = air_gap / safety_margin_m;

  var acceptance = "ACCEPTABLE";
  if (air_gap < 0) acceptance = "NEGATIVE_AIR_GAP_CRITICAL";
  else if (air_gap < safety_margin_m) acceptance = "INSUFFICIENT_CLEARANCE";
  else if (air_gap < safety_margin_m * 1.5) acceptance = "MARGINAL";

  return {
    deck_elevation_m: deck_elevation_m,
    max_wave_crest_m: max_wave_crest_m,
    heave_amplitude_m: heave_m,
    tide_m: tide_m,
    subsidence_m: subsidence_m,
    total_water_surface_rise_m: Math.round(total_water_rise * 100) / 100,
    effective_clearance_m: Math.round(effective_deck_clearance * 100) / 100,
    air_gap_m: Math.round(air_gap * 100) / 100,
    required_minimum_m: safety_margin_m,
    air_gap_ratio: Math.round(air_gap_ratio * 100) / 100,
    acceptance: acceptance,
    method: "API RP 2FPS / DNV-OS-C103 air gap assessment"
  };
}

// ── TURRET ASSESSMENT (FPSO) ───────────────────────────────────────────
// Turret bearing, swivel stack, riser interface assessment
function assessTurret(turretData: any): any {
  var turretType = turretData.turret_type || "internal"; // internal or external
  var bearingAge_years = turretData.bearing_age_years || 0;
  var designLife = turretData.design_life_years || 25;
  var swivelCount = turretData.swivel_count || 0;
  var riserCount = turretData.riser_count || 0;
  var rotationCycles = turretData.rotation_cycles || 0;
  var bearingWear_mm = turretData.bearing_wear_mm || 0;
  var maxBearingWear_mm = turretData.max_bearing_wear_mm || 10;
  var chainStopperCount = turretData.chain_stopper_count || 0;

  // Bearing wear rate
  var wearRate = bearingAge_years > 0 ? bearingWear_mm / bearingAge_years : 0;
  var projectedWear = wearRate * designLife;
  var bearingLifeRemaining = maxBearingWear_mm > bearingWear_mm && wearRate > 0
    ? (maxBearingWear_mm - bearingWear_mm) / wearRate
    : designLife;

  // Swivel stack assessment
  var swivelFatigueLife = swivelCount > 0 ? designLife * 1.5 : null; // Typical DFF = 1.5
  var swivelSealsAge = turretData.swivel_seal_age_years || 0;
  var swivelSealLimit = 7; // Typical replacement interval

  // Risk factors
  var riskFactors: string[] = [];
  if (bearingWear_mm > maxBearingWear_mm * 0.7) riskFactors.push("Bearing wear above 70% of allowable");
  if (swivelSealsAge > swivelSealLimit) riskFactors.push("Swivel seals past replacement interval");
  if (projectedWear > maxBearingWear_mm) riskFactors.push("Projected bearing wear exceeds allowable at design life");
  if (turretType === "external" && bearingAge_years > 15) riskFactors.push("External turret bearing age > 15 years — corrosion concerns");

  var acceptance = riskFactors.length === 0 ? "ACCEPTABLE"
    : riskFactors.length <= 2 ? "MONITOR"
    : "REPAIR_REQUIRED";

  return {
    turret_type: turretType,
    bearing_age_years: bearingAge_years,
    bearing_wear_mm: bearingWear_mm,
    bearing_wear_rate_mm_yr: Math.round(wearRate * 1000) / 1000,
    bearing_life_remaining_years: Math.round(bearingLifeRemaining * 10) / 10,
    projected_wear_at_design_life_mm: Math.round(projectedWear * 100) / 100,
    swivel_count: swivelCount,
    swivel_seal_age_years: swivelSealsAge,
    swivel_seal_replacement_due: swivelSealsAge >= swivelSealLimit,
    riser_count: riserCount,
    chain_stopper_count: chainStopperCount,
    rotation_cycles: rotationCycles,
    risk_factors: riskFactors,
    acceptance: acceptance,
    method: "API RP 2FPS turret assessment / OEM specifications"
  };
}

// ── TLP TENDON ASSESSMENT ──────────────────────────────────────────────
// Tendon body fatigue, connector fatigue, corrosion assessment
function assessTendon(tendonData: any): any {
  var OD_mm = tendonData.OD_mm || 900;
  var WT_mm = tendonData.WT_mm || 40;
  var length_m = tendonData.length_m || 500;
  var Fy_MPa = tendonData.yield_strength_MPa || 550;
  var pretension_kN = tendonData.pretension_kN || 10000;
  var max_tension_kN = tendonData.max_tension_kN || 18000;
  var min_tension_kN = tendonData.min_tension_kN || 5000;
  var age_years = tendonData.age_years || 0;
  var corrosion_rate_mm_yr = tendonData.corrosion_rate_mm_yr || 0.1;
  var cp_status = tendonData.cp_status || "adequate";

  // Cross-section properties
  var ID_mm = OD_mm - 2 * WT_mm;
  var A_mm2 = Math.PI / 4 * (OD_mm * OD_mm - ID_mm * ID_mm);

  // Stress calculations
  var pretension_stress = pretension_kN * 1000 / A_mm2;
  var max_stress = max_tension_kN * 1000 / A_mm2;
  var min_stress = min_tension_kN * 1000 / A_mm2;
  var stress_range = max_stress - min_stress;
  var mean_stress = (max_stress + min_stress) / 2;
  var utilization = max_stress / (0.6 * Fy_MPa); // API RP 2T: 0.6 * Fy allowable

  // Corrosion assessment
  var wallLossToDate = corrosion_rate_mm_yr * age_years;
  var effectiveWT = WT_mm - wallLossToDate;
  var remainingLife = effectiveWT > 0 && corrosion_rate_mm_yr > 0
    ? (effectiveWT - WT_mm * 0.125) / corrosion_rate_mm_yr // 12.5% retirement threshold
    : 999;

  // Fatigue assessment (simplified S-N approach)
  // Using API RP 2T guidance: DFF = 10 for tendons
  var DFF = 10;
  var logN = 12.164 - 3.0 * Math.log10(stress_range); // D-curve approximation
  var N_cycles = Math.pow(10, logN);
  var annual_cycles = tendonData.annual_wave_cycles || 5e6;
  var fatigue_damage_per_year = annual_cycles / N_cycles;
  var fatigue_life_years = 1.0 / (fatigue_damage_per_year * DFF);

  // Min tension check (must stay positive to avoid slack)
  var slackRisk = min_tension_kN <= 0;

  var riskFactors: string[] = [];
  if (utilization > 0.80) riskFactors.push("Tendon stress utilization > 80%");
  if (effectiveWT < WT_mm * 0.80) riskFactors.push("Wall loss exceeds 20% of original");
  if (fatigue_life_years < age_years * 1.5) riskFactors.push("Fatigue life approaching consumed fraction");
  if (slackRisk) riskFactors.push("CRITICAL: Minimum tension goes slack — loss of station risk");
  if (cp_status === "inadequate") riskFactors.push("CP system inadequate — accelerated corrosion expected");
  if (stress_range > 0.3 * Fy_MPa) riskFactors.push("High stress range — fatigue-sensitive");

  var acceptance = slackRisk ? "CRITICAL_SLACK_RISK"
    : utilization > 1.0 ? "OVERSTRESSED"
    : riskFactors.length === 0 ? "ACCEPTABLE"
    : riskFactors.length <= 2 ? "MONITOR"
    : "REPAIR_REQUIRED";

  return {
    geometry: { OD_mm: OD_mm, WT_mm: WT_mm, effective_WT_mm: Math.round(effectiveWT * 100) / 100, length_m: length_m },
    stress: {
      pretension_MPa: Math.round(pretension_stress * 10) / 10,
      max_stress_MPa: Math.round(max_stress * 10) / 10,
      min_stress_MPa: Math.round(min_stress * 10) / 10,
      stress_range_MPa: Math.round(stress_range * 10) / 10,
      mean_stress_MPa: Math.round(mean_stress * 10) / 10,
      utilization: Math.round(utilization * 1000) / 1000,
      slack_risk: slackRisk
    },
    corrosion: {
      rate_mm_yr: corrosion_rate_mm_yr,
      wall_loss_to_date_mm: Math.round(wallLossToDate * 100) / 100,
      cp_status: cp_status,
      remaining_life_years: Math.round(remainingLife * 10) / 10
    },
    fatigue: {
      stress_range_MPa: Math.round(stress_range * 10) / 10,
      design_fatigue_factor: DFF,
      fatigue_life_years: Math.round(fatigue_life_years * 10) / 10,
      annual_damage: fatigue_damage_per_year > 0 ? (Math.round(fatigue_damage_per_year * 1e8) / 1e8) : 0
    },
    risk_factors: riskFactors,
    acceptance: acceptance,
    method: "API RP 2T tendon assessment / DNV-RP-C203 fatigue"
  };
}

// ── MOTION-INDUCED FATIGUE ─────────────────────────────────────────────
// Springing, whipping, slamming, VIM contributions
function assessMotionFatigue(motionData: any): any {
  var platformType = motionData.platform_type || "FPSO";
  var L_m = motionData.length_m || 200;
  var significantWaveHeight_m = motionData.Hs_m || 5;
  var peakPeriod_s = motionData.Tp_s || 12;
  var age_years = motionData.age_years || 0;
  var designLife = motionData.design_life_years || 25;

  var naturalPeriods = motionData.natural_periods || {};
  var heave_period = naturalPeriods.heave_s || 10;
  var pitch_period = naturalPeriods.pitch_s || 12;
  var roll_period = naturalPeriods.roll_s || 14;

  // Springing check (2-node hull vibration): risk when wave encounter period ~ hull natural period
  var springingRisk = "low";
  var springingNote = "";
  if (platformType === "FPSO" || platformType === "FSO" || platformType === "FLNG") {
    var hullNaturalPeriod = 0.011 * L_m + 1.5; // Approximate 2-node period
    if (Math.abs(peakPeriod_s / 2 - hullNaturalPeriod) < 1.5) {
      springingRisk = "high";
      springingNote = "Wave encounter period near hull 2-node frequency — springing fatigue risk";
    } else if (Math.abs(peakPeriod_s / 2 - hullNaturalPeriod) < 3.0) {
      springingRisk = "moderate";
      springingNote = "Wave encounter period within range of hull natural frequency";
    }
  }

  // Whipping check (transient hull vibration from slamming)
  var whippingRisk = "low";
  if (platformType === "FPSO" || platformType === "FSO" || platformType === "FLNG") {
    if (significantWaveHeight_m > 6 && L_m > 150) whippingRisk = "high";
    else if (significantWaveHeight_m > 4) whippingRisk = "moderate";
  }

  // Slamming fatigue contribution
  var slammingRisk = "low";
  if (significantWaveHeight_m > 5) slammingRisk = "high";
  else if (significantWaveHeight_m > 3) slammingRisk = "moderate";

  // VIM check (for column-stabilised and SPARs)
  var vimRisk = "low";
  var vimNote = "";
  if (platformType === "SPAR" || platformType === "SEMI_SUB" || platformType === "TLP") {
    var currentSpeed = motionData.current_speed_ms || 0;
    if (currentSpeed > 1.0) {
      vimRisk = "high";
      vimNote = "Current speed > 1.0 m/s — VIM lock-in risk for column structures";
    } else if (currentSpeed > 0.5) {
      vimRisk = "moderate";
      vimNote = "Current speed may excite VIM in column structures";
    }
  }

  // Parametric rolling check (for ship-shaped platforms)
  var parametricRollRisk = "low";
  if (platformType === "FPSO" || platformType === "FSO" || platformType === "FLNG") {
    if (Math.abs(peakPeriod_s - 2 * roll_period) < 2.0) {
      parametricRollRisk = "high";
    } else if (Math.abs(peakPeriod_s - 2 * roll_period) < 4.0) {
      parametricRollRisk = "moderate";
    }
  }

  // Combined fatigue acceleration factor
  var fatigueAcceleration = 1.0;
  if (springingRisk === "high") fatigueAcceleration += 0.30;
  else if (springingRisk === "moderate") fatigueAcceleration += 0.15;
  if (whippingRisk === "high") fatigueAcceleration += 0.25;
  else if (whippingRisk === "moderate") fatigueAcceleration += 0.10;
  if (slammingRisk === "high") fatigueAcceleration += 0.20;
  if (vimRisk === "high") fatigueAcceleration += 0.35;
  else if (vimRisk === "moderate") fatigueAcceleration += 0.15;

  return {
    platform_type: platformType,
    environment: {
      Hs_m: significantWaveHeight_m,
      Tp_s: peakPeriod_s,
      current_speed_ms: motionData.current_speed_ms || 0
    },
    motion_risks: {
      springing: { risk: springingRisk, note: springingNote },
      whipping: { risk: whippingRisk },
      slamming: { risk: slammingRisk },
      vim: { risk: vimRisk, note: vimNote },
      parametric_roll: { risk: parametricRollRisk }
    },
    fatigue_acceleration_factor: Math.round(fatigueAcceleration * 100) / 100,
    effective_fatigue_life_reduction_pct: Math.round((1 - 1 / fatigueAcceleration) * 100),
    method: "API RP 2FPS / DNV-OS-C103 motion-induced fatigue assessment"
  };
}

// ── GREEN WATER ASSESSMENT ─────────────────────────────────────────────
function assessGreenWater(gwData: any): any {
  var freeboard_m = gwData.freeboard_m || 10;
  var Hs_100yr_m = gwData.Hs_100yr_m || 12;
  var bow_shape = gwData.bow_shape || "conventional"; // conventional, cylindrical, ship
  var heading = gwData.heading || "head_seas";

  // Simplified green water exceedance
  // Based on relative wave elevation exceeding freeboard
  var relativeWaveElevation = Hs_100yr_m * 0.65; // Approximate crest factor
  if (heading === "beam_seas") relativeWaveElevation *= 1.2;
  if (heading === "quartering") relativeWaveElevation *= 1.1;

  var exceedance = relativeWaveElevation - freeboard_m;
  var greenWaterRisk = exceedance > 2 ? "high" : exceedance > 0 ? "moderate" : "low";

  // Bow shape factor
  var bowFactor = 1.0;
  if (bow_shape === "cylindrical") bowFactor = 0.85; // Better wave deflection
  if (bow_shape === "ship") bowFactor = 1.0;

  // Green water load (simplified per DNV-OS-C102)
  var greenWaterPressure_kPa = exceedance > 0 ? 0.5 * 1025 * 9.81 * exceedance * exceedance / 1000 * bowFactor : 0;

  return {
    freeboard_m: freeboard_m,
    Hs_100yr_m: Hs_100yr_m,
    relative_wave_elevation_m: Math.round(relativeWaveElevation * 100) / 100,
    exceedance_m: Math.round(exceedance * 100) / 100,
    green_water_risk: greenWaterRisk,
    green_water_pressure_kPa: Math.round(greenWaterPressure_kPa * 10) / 10,
    bow_shape: bow_shape,
    heading: heading,
    recommendations: exceedance > 0
      ? ["Install green water protection barriers", "Review topside equipment securing", "Consider bow modification or operational heading restrictions"]
      : ["Current freeboard adequate for design conditions"],
    method: "DNV-OS-C102 / API RP 2FPS green water assessment"
  };
}

// ── HULL CORROSION ZONE ASSESSMENT ─────────────────────────────────────
function assessHullCorrosion(corrData: any): any {
  var zones = [];

  // Standard corrosion zones for floating platforms
  var zoneRates: any = {
    atmospheric_deck: { rate_mm_yr: 0.10, severity: "low", coating_critical: true },
    splash_zone: { rate_mm_yr: 0.50, severity: "high", coating_critical: true },
    tidal_zone: { rate_mm_yr: 0.30, severity: "medium", coating_critical: true },
    submerged_external: { rate_mm_yr: 0.15, severity: "medium", coating_critical: true },
    ballast_tank_tops: { rate_mm_yr: 0.25, severity: "high", coating_critical: true },
    ballast_tank_bottom: { rate_mm_yr: 0.15, severity: "medium", coating_critical: true },
    cargo_tank_bottom: { rate_mm_yr: 0.20, severity: "medium", coating_critical: true },
    void_spaces: { rate_mm_yr: 0.05, severity: "low", coating_critical: false },
    moonpool: { rate_mm_yr: 0.40, severity: "high", coating_critical: true }
  };

  var measurements = corrData.zone_measurements || {};
  var originalThicknesses = corrData.original_thicknesses || {};
  var age_years = corrData.age_years || 0;

  for (var zone in zoneRates) {
    var zr = zoneRates[zone];
    var measured = measurements[zone] || null;
    var original = originalThicknesses[zone] || corrData.nominal_thickness_mm || 20;
    var actualRate = measured && age_years > 0 ? (original - measured) / age_years : zr.rate_mm_yr;
    var remainingLife = actualRate > 0 ? (measured || original) * 0.875 / actualRate : 999; // 12.5% retirement

    zones.push({
      zone: zone,
      reference_rate_mm_yr: zr.rate_mm_yr,
      actual_rate_mm_yr: Math.round(actualRate * 1000) / 1000,
      original_thickness_mm: original,
      measured_thickness_mm: measured,
      wall_loss_mm: measured ? Math.round((original - measured) * 100) / 100 : null,
      remaining_life_years: Math.round(remainingLife * 10) / 10,
      severity: zr.severity,
      coating_critical: zr.coating_critical
    });
  }

  // Sort by remaining life ascending (worst first)
  zones.sort(function(a: any, b: any) { return a.remaining_life_years - b.remaining_life_years; });

  var minLife = zones.length > 0 ? zones[0].remaining_life_years : 999;
  var acceptance = minLife > 10 ? "ACCEPTABLE" : minLife > 5 ? "MONITOR" : minLife > 2 ? "MONITOR_URGENT" : "REPAIR_REQUIRED";

  return {
    zone_count: zones.length,
    zones: zones,
    worst_zone: zones.length > 0 ? zones[0].zone : null,
    min_remaining_life_years: Math.round(minLife * 10) / 10,
    acceptance: acceptance,
    method: "IACS UR S / Classification society hull corrosion assessment"
  };
}

// ── TOPSIDE-HULL INTERFACE ─────────────────────────────────────────────
function assessTopsideInterface(interfaceData: any): any {
  var moduleCount = interfaceData.module_count || 0;
  var stoolType = interfaceData.stool_type || "welded"; // welded, bolted, grillage
  var totalTopsideWeight_tonnes = interfaceData.topside_weight_tonnes || 0;
  var hullAge_years = interfaceData.age_years || 0;
  var inspectionFindings = interfaceData.inspection_findings || [];

  // Stool fatigue assessment (simplified)
  var stoolFatigueRisk = "low";
  if (hullAge_years > 15 && stoolType === "welded") stoolFatigueRisk = "high";
  else if (hullAge_years > 10 && stoolType === "welded") stoolFatigueRisk = "moderate";

  // Weight distribution check
  var avgModuleWeight = moduleCount > 0 ? totalTopsideWeight_tonnes / moduleCount : 0;
  var weightConcern = avgModuleWeight > 5000;

  var riskFactors: string[] = [];
  if (stoolFatigueRisk === "high") riskFactors.push("Module support stool fatigue risk — welded connections aging");
  if (weightConcern) riskFactors.push("High module weights — concentrated loading on hull structure");

  for (var i = 0; i < inspectionFindings.length; i++) {
    var finding = inspectionFindings[i];
    if (finding.type === "crack") riskFactors.push("Crack found at " + finding.location + " — " + finding.description);
    if (finding.type === "corrosion") riskFactors.push("Corrosion at " + finding.location + " — " + finding.description);
  }

  var acceptance = riskFactors.length === 0 ? "ACCEPTABLE"
    : riskFactors.length <= 2 ? "MONITOR"
    : "REPAIR_REQUIRED";

  return {
    module_count: moduleCount,
    stool_type: stoolType,
    topside_weight_tonnes: totalTopsideWeight_tonnes,
    stool_fatigue_risk: stoolFatigueRisk,
    risk_factors: riskFactors,
    acceptance: acceptance,
    recommendations: stoolFatigueRisk !== "low"
      ? ["PAUT inspection of module support stool welds", "MPI of high-stress connections", "Review structural monitoring data"]
      : ["Routine inspection per class survey schedule"],
    method: "API RP 2FPS / Classification society topside interface assessment"
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

    // ── GET_REGISTRY ──────────────────────────────────────────────
    if (action === "get_registry") {
      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({
          engine: "Floating Platform Assessment Engine",
          version: ENGINE_VERSION,
          deploy: "DEPLOY343",
          description: "Structural and integrity assessment for all floating production and drilling platforms: FPSO, TLP, semi-sub, SPAR, compliant tower, FSO, FLNG, MODU",
          actions: ACTION_REGISTRY,
          platform_types: Object.keys(PLATFORM_TYPES),
          standards: ["API RP 2FPS", "API RP 2T", "DNV-OS-C101/C102/C103/C105/C106", "ABS FPI/MODU Rules", "IACS UR S", "ISO 19904-1", "IMO MODU Code", "SOLAS", "IGC Code"],
          assessment_areas: [
            "Hull structural (plating, frames, bulkheads, section modulus)",
            "Column/pontoon (semi-sub, SPAR, TLP)",
            "Turret system (FPSO bearing, swivel, riser interface)",
            "TLP tendons (fatigue, corrosion, slack risk)",
            "Air gap (wave crest clearance)",
            "Motion-induced fatigue (springing, whipping, VIM, slamming, parametric roll)",
            "Green water / deck wetness",
            "Hull corrosion zones (9 zones with rates)",
            "Topside-hull interface (module support stools)",
            "Plate buckling (Johnson-Ostenfeld corrected)"
          ]
        })
      };
    }

    // ── CLASSIFY_PLATFORM ─────────────────────────────────────────
    if (action === "classify_platform") {
      var pType = body.platform_type || "FPSO";
      var pInfo = PLATFORM_TYPES[pType.toUpperCase()] || PLATFORM_TYPES.FPSO;
      return {
        statusCode: 200, headers: headers,
        body: JSON.stringify({ platform_type: pType, info: pInfo, engine_version: ENGINE_VERSION })
      };
    }

    // ── ASSESS_HULL ───────────────────────────────────────────────
    if (action === "assess_hull") {
      var L = body.length_m || 200;
      var B = body.beam_m || 40;
      var Cb = body.block_coefficient || 0.80;
      var bending = computeHullBendingMoment(L, B, Cb, body.platform_type || "FPSO");
      var minSM = computeMinSectionModulus(L, B, Cb, body.C1 || null);

      var buckling = null;
      if (body.plate_thickness_mm && body.plate_spacing_mm && body.applied_stress_MPa) {
        buckling = checkPlateBuckling(body.plate_thickness_mm, body.plate_spacing_mm, body.applied_stress_MPa, body.Fy_MPa || 355);
      }

      var result = {
        deterministic: {
          hull_bending: bending,
          min_section_modulus_cm2m: Math.round(minSM * 10) / 10,
          plate_buckling: buckling
        },
        provenance: { engine_version: ENGINE_VERSION, method: "IACS UR S hull girder assessment", timestamp: new Date().toISOString() }
      };
      return { statusCode: 200, headers: headers, body: JSON.stringify(result) };
    }

    // ── ASSESS_TURRET ─────────────────────────────────────────────
    if (action === "assess_turret") {
      var turretResult = assessTurret(body);
      return { statusCode: 200, headers: headers, body: JSON.stringify({ deterministic: turretResult, provenance: { engine_version: ENGINE_VERSION, timestamp: new Date().toISOString() } }) };
    }

    // ── ASSESS_TENDON ─────────────────────────────────────────────
    if (action === "assess_tendon") {
      var tendonResult = assessTendon(body);
      return { statusCode: 200, headers: headers, body: JSON.stringify({ deterministic: tendonResult, provenance: { engine_version: ENGINE_VERSION, timestamp: new Date().toISOString() } }) };
    }

    // ── ASSESS_AIR_GAP ────────────────────────────────────────────
    if (action === "assess_air_gap") {
      var agResult = assessAirGap(
        body.deck_elevation_m || 20,
        body.max_wave_crest_m || 15,
        body.heave_m || 3,
        body.tide_m || 1.5,
        body.subsidence_m || 0.5,
        body.safety_margin_m || 1.5
      );
      return { statusCode: 200, headers: headers, body: JSON.stringify({ deterministic: agResult, provenance: { engine_version: ENGINE_VERSION, timestamp: new Date().toISOString() } }) };
    }

    // ── ASSESS_MOTION_FATIGUE ─────────────────────────────────────
    if (action === "assess_motion_fatigue") {
      var mfResult = assessMotionFatigue(body);
      return { statusCode: 200, headers: headers, body: JSON.stringify({ deterministic: mfResult, provenance: { engine_version: ENGINE_VERSION, timestamp: new Date().toISOString() } }) };
    }

    // ── ASSESS_GREEN_WATER ────────────────────────────────────────
    if (action === "assess_green_water") {
      var gwResult = assessGreenWater(body);
      return { statusCode: 200, headers: headers, body: JSON.stringify({ deterministic: gwResult, provenance: { engine_version: ENGINE_VERSION, timestamp: new Date().toISOString() } }) };
    }

    // ── ASSESS_HULL_CORROSION ─────────────────────────────────────
    if (action === "assess_hull_corrosion") {
      var hcResult = assessHullCorrosion(body);
      return { statusCode: 200, headers: headers, body: JSON.stringify({ deterministic: hcResult, provenance: { engine_version: ENGINE_VERSION, timestamp: new Date().toISOString() } }) };
    }

    // ── ASSESS_TOPSIDE_INTERFACE ──────────────────────────────────
    if (action === "assess_topside_interface") {
      var tiResult = assessTopsideInterface(body);
      return { statusCode: 200, headers: headers, body: JSON.stringify({ deterministic: tiResult, provenance: { engine_version: ENGINE_VERSION, timestamp: new Date().toISOString() } }) };
    }

    // ── ASSESS_COLUMN ─────────────────────────────────────────────
    if (action === "assess_column") {
      // Column assessment for semi-subs and SPARs
      var colOD = body.column_OD_m || 20;
      var colWT = body.column_WT_mm || 50;
      var colHeight = body.column_height_m || 30;
      var colFy = body.Fy_MPa || 355;
      var colAxial = body.axial_load_kN || 0;
      var colBending = body.bending_moment_kNm || 0;
      var colHydrostatic = body.external_pressure_MPa || 0;

      // Cross-section
      var colID = colOD - 2 * colWT / 1000;
      var colA = Math.PI / 4 * (colOD * colOD - colID * colID) * 1e6; // mm^2
      var colI = Math.PI / 64 * (Math.pow(colOD * 1000, 4) - Math.pow(colID * 1000, 4)); // mm^4
      var colZ = colI / (colOD * 500); // mm^3

      var axialStress = colAxial * 1000 / colA;
      var bendingStress = colBending * 1e6 / colZ;
      var combinedStress = axialStress + bendingStress;
      var utilization = combinedStress / (0.6 * colFy);

      // Hydrostatic collapse check
      var collapseP = 2 * colFy * (colWT / 1000) / colOD * 0.80; // Simplified
      var hydroUtilization = colHydrostatic > 0 ? colHydrostatic / collapseP : 0;

      var acceptance = utilization > 1.0 ? "OVERSTRESSED"
        : hydroUtilization > 0.80 ? "HYDROSTATIC_RISK"
        : utilization > 0.80 ? "MARGINAL"
        : "ACCEPTABLE";

      return {
        statusCode: 200, headers: headers,
        body: JSON.stringify({
          deterministic: {
            geometry: { OD_m: colOD, WT_mm: colWT, height_m: colHeight },
            stress: { axial_MPa: Math.round(axialStress * 10) / 10, bending_MPa: Math.round(bendingStress * 10) / 10, combined_MPa: Math.round(combinedStress * 10) / 10, utilization: Math.round(utilization * 1000) / 1000 },
            hydrostatic: { external_pressure_MPa: colHydrostatic, collapse_pressure_MPa: Math.round(collapseP * 100) / 100, utilization: Math.round(hydroUtilization * 1000) / 1000 },
            acceptance: acceptance
          },
          provenance: { engine_version: ENGINE_VERSION, method: "DNV-OS-C103 / API RP 2FPS column assessment", timestamp: new Date().toISOString() }
        })
      };
    }

    // ── GET_HISTORY ───────────────────────────────────────────────
    if (action === "get_history") {
      if (!supabaseUrl || !supabaseKey) {
        return { statusCode: 200, headers: headers, body: JSON.stringify({ history: [], note: "Database not configured" }) };
      }
      var db = createClient(supabaseUrl, supabaseKey);
      var query = db.from("floating_platform_assessments").select("*").order("created_at", { ascending: false }).limit(body.limit || 20);
      if (body.platform_id) query = query.eq("platform_id", body.platform_id);
      var dbResult = await query;
      return { statusCode: 200, headers: headers, body: JSON.stringify({ history: dbResult.data || [], count: (dbResult.data || []).length }) };
    }

    return { statusCode: 200, headers: headers, body: JSON.stringify({ error: "Unknown action: " + action, available_actions: Object.keys(ACTION_REGISTRY), engine_version: ENGINE_VERSION }) };

  } catch (err: any) {
    return { statusCode: 200, headers: headers, body: JSON.stringify({ error: "Engine error: " + (err.message || String(err)), engine_version: ENGINE_VERSION }) };
  }
};

export { handler };
