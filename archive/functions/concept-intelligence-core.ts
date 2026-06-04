// @ts-nocheck
/**
 * DEPLOY252 - concept-intelligence-core.ts
 * netlify/functions/concept-intelligence-core.ts
 *
 * CONCEPT INTELLIGENCE CORE v2.0.0
 * The "Thinking AI" layer — encodes experienced inspector instinct
 * as deterministic mechanism chains, contradiction detection,
 * blind spot identification, and failure pathway simulation.
 *
 * 12 Concept Engines across 5 Reality Families:
 *   governing_reality:    Constraint Dominance, Physics Sufficiency, Decision Boundary
 *   propagation_reality:  Mechanism Propagation, Mechanism Interaction, Failure Pathway
 *   uncertainty_reality:  Contradiction Detection, Blind Spot Detector, Confidence Collapse
 *   action_reality:       Information Gain, Parallel Reality
 *   origin_reality:       Causal Root
 *
 * 100+ mechanism chains encoding "if I see X, always check Y"
 *
 * POST /api/concept-intelligence-core { action, ... }
 *
 * Actions:
 *   get_registry       - engine capabilities
 *   analyze_case       - full concept intelligence pack from case_id
 *   get_chains         - browse mechanism chain database
 *   get_chain_for      - get chains triggered by a specific finding
 *   validate_rules     - validate concept rule integrity
 *   get_registry       - engine info
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

var ENGINE_VERSION = "v2.0.0";

// =====================================================================
// UTILITY FUNCTIONS
// =====================================================================

function lower(s) { return (s || "").toString().toLowerCase(); }

function scoreConcept(base, bonuses, penalties) {
  var raw = base;
  for (var i = 0; i < bonuses.length; i++) raw = raw + bonuses[i];
  for (var j = 0; j < penalties.length; j++) raw = raw - penalties[j];
  if (raw < 0) return 0;
  if (raw > 1) return 1;
  return Math.round(raw * 1000) / 1000;
}

function hitList(hay, list) {
  var h = lower(hay);
  var out = [];
  for (var i = 0; i < list.length; i++) {
    if (h.indexOf(lower(list[i])) !== -1) out.push(list[i]);
  }
  return out;
}

function arrayOverlap(a, b) {
  if (!a || !b) return false;
  for (var i = 0; i < a.length; i++) {
    for (var j = 0; j < b.length; j++) {
      if (lower(a[i]) === lower(b[j])) return true;
    }
  }
  return false;
}

function containsAny(haystack, needles) {
  var h = lower(haystack);
  for (var i = 0; i < needles.length; i++) {
    if (h.indexOf(lower(needles[i])) !== -1) return true;
  }
  return false;
}

// =====================================================================
// MECHANISM CHAIN DATABASE — "If I see X, always check Y"
// 100+ chains across 9 categories
// =====================================================================

var MECHANISM_CHAINS = [

  // ── CATEGORY 1: DAMAGE MECHANISM CASCADE (API 571 on steroids) ────

  {
    id: "MC-001",
    category: "mechanism_cascade",
    name: "Coating Disbond to Corrosion Under Coating",
    primary_trigger: ["coating_disbond", "coating_blister", "coating_lifting", "coating_failure", "paint_blister", "bubbling_under_paint", "blistering"],
    material_filter: ["carbon_steel", "low_alloy", "cs", "carbon"],
    secondary_risks: [
      { mechanism: "corrosion_under_coating", probability: 0.85, severity: "high", basis: "Coating breach traps moisture against substrate — corrosion initiates within weeks on carbon steel" },
      { mechanism: "pitting_under_coating", probability: 0.60, severity: "high", basis: "Localized moisture trapping under disbonded coating creates pitting cells" },
      { mechanism: "under_deposit_corrosion", probability: 0.40, severity: "medium", basis: "Corrosion products accumulate under coating creating deposit corrosion cells" }
    ],
    recommended_actions: ["UT_thickness_at_disbond_zone", "coating_removal_and_substrate_VT", "pit_depth_gauge_survey"],
    scope_expansion: "Check adjacent coating zones within 1m radius — disbond rarely isolated",
    physics_basis: "Broken coating acts as moisture dam. On carbon steel, localized cell forms within days in humid or marine environment."
  },
  {
    id: "MC-002",
    category: "mechanism_cascade",
    name: "CUI — Corrosion Under Insulation Cascade",
    primary_trigger: ["cui", "corrosion_under_insulation", "wet_insulation", "insulation_damage", "jacketing_breach", "caulk_failure"],
    material_filter: ["carbon_steel", "low_alloy", "austenitic_ss", "stainless"],
    secondary_risks: [
      { mechanism: "general_wall_thinning", probability: 0.80, severity: "high", basis: "Trapped moisture causes accelerated general corrosion on carbon steel" },
      { mechanism: "pitting_corrosion", probability: 0.70, severity: "high", basis: "Crevice conditions under insulation promote localized pitting" },
      { mechanism: "chloride_scc", probability: 0.65, severity: "critical", basis: "On austenitic SS, chloride-laden moisture under insulation causes SCC — API 571 4.3.3" },
      { mechanism: "coating_breakdown_under_insulation", probability: 0.75, severity: "medium", basis: "Coating degrades faster in trapped moisture environment" }
    ],
    recommended_actions: ["insulation_removal_inspection", "UT_thickness_grid", "profile_radiography", "pulsed_eddy_current"],
    scope_expansion: "Expand to all insulated sections at same elevation — gravity drainage paths — low points — pipe supports under insulation",
    physics_basis: "Water ingress through jacketing defects accumulates at low points. Carbon steel corrodes rapidly. Austenitic SS cracks from chlorides. API 571 4.3.3, API 583."
  },
  {
    id: "MC-003",
    category: "mechanism_cascade",
    name: "Surface Crack to Fatigue Propagation",
    primary_trigger: ["surface_crack", "crack_indication", "linear_indication", "toe_crack", "weld_toe_crack"],
    material_filter: null,
    secondary_risks: [
      { mechanism: "fatigue_crack_growth", probability: 0.75, severity: "critical", basis: "Surface crack is a stress concentrator — fatigue propagation is the primary failure mode if cyclic loading present" },
      { mechanism: "crack_branching", probability: 0.35, severity: "high", basis: "In corrosive environments, crack may branch — single indication may be tip of larger network" },
      { mechanism: "through_wall_penetration", probability: 0.30, severity: "critical", basis: "Unmonitored crack growth leads to through-wall leak or rupture" }
    ],
    recommended_actions: ["MT_PT_for_surface_confirmation", "UT_PAUT_for_depth_sizing", "TOFD_for_critical_welds", "crack_growth_rate_assessment"],
    scope_expansion: "Check similar geometry welds — same welder — same weld procedure — same service conditions",
    physics_basis: "Surface cracks concentrate stress by factor of 3-5x. Under cyclic loading, propagation follows Paris law until critical crack size."
  },
  {
    id: "MC-004",
    category: "mechanism_cascade",
    name: "Flow-Induced Vibration Cascade",
    primary_trigger: ["fiv", "flow_induced_vibration", "aiv", "acoustic_induced_vibration", "pipe_vibration", "line_singing", "pipe_shaking", "turbulence_vibration", "vortex_shedding", "pulsation"],
    material_filter: null,
    secondary_risks: [
      { mechanism: "high_cycle_fatigue_cracking", probability: 0.80, severity: "critical", basis: "FIV generates high-cycle fatigue — cracks initiate at stress concentrations (welds, small-bore connections, supports)" },
      { mechanism: "small_bore_connection_failure", probability: 0.75, severity: "critical", basis: "Small-bore branches are classic AIV failure mode — branch-to-header welds fail first" },
      { mechanism: "support_loosening", probability: 0.65, severity: "high", basis: "Vibration loosens clamps, U-bolts, and spring hangers — pipe moves beyond design envelope" },
      { mechanism: "weld_toe_cracking", probability: 0.70, severity: "critical", basis: "Weld toes are highest stress concentration — first to crack under vibratory loading" },
      { mechanism: "socket_weld_fatigue", probability: 0.60, severity: "critical", basis: "Socket welds with gap create notch effect — fatigue life dramatically reduced under FIV" },
      { mechanism: "threaded_connection_failure", probability: 0.55, severity: "high", basis: "Thread roots are stress concentrators — vibration causes thread fatigue and leakage" }
    ],
    recommended_actions: ["vibration_survey_accelerometer", "VT_all_small_bore_connections", "MT_PT_at_branch_welds", "support_condition_survey", "modal_analysis_if_resonance_suspected"],
    scope_expansion: "All small-bore connections within 15m of vibration source — all socket welds — all threaded connections — check downstream of PRVs, control valves, and orifice plates",
    physics_basis: "Gas flow past restrictions creates pressure waves (AIV) or turbulence forces. Natural frequency lock-in causes resonance. Small-bore connections fail in hours to weeks when resonance occurs."
  },
  {
    id: "MC-005",
    category: "mechanism_cascade",
    name: "High Temperature Sulfidation Cascade",
    primary_trigger: ["sulfidation", "high_temp_h2s", "sulfide_corrosion", "naphthenic_acid", "high_temperature_corrosion"],
    material_filter: ["carbon_steel", "low_alloy", "5cr", "9cr"],
    secondary_risks: [
      { mechanism: "creep_damage", probability: 0.55, severity: "critical", basis: "Components in sulfidation temperature range (>260C) are also in creep range" },
      { mechanism: "metallurgical_degradation", probability: 0.50, severity: "high", basis: "Prolonged high temperature causes spheroidization, graphitization, temper embrittlement" },
      { mechanism: "carburization", probability: 0.35, severity: "high", basis: "High-temperature carbon-rich environments cause carburization and loss of ductility" }
    ],
    recommended_actions: ["UT_thickness_grid_mapping", "hardness_survey", "replica_metallography", "retirement_thickness_calculation"],
    scope_expansion: "All components in same temperature circuit — check elbows, reducers, and dead legs in sulfidation zone",
    physics_basis: "Sulfidation and creep share the same temperature regime. API 571 4.4.2. McConomy curves govern corrosion rate by temperature and chromium content."
  },
  {
    id: "MC-006",
    category: "mechanism_cascade",
    name: "Hydrogen Damage Cascade (Sour Service)",
    primary_trigger: ["hic", "hydrogen_induced_cracking", "sohic", "hydrogen_blistering", "sscc", "sulfide_stress_cracking", "sour_service_crack"],
    material_filter: ["carbon_steel", "low_alloy"],
    secondary_risks: [
      { mechanism: "stepwise_cracking", probability: 0.70, severity: "critical", basis: "HIC blisters link up through wall in stepwise pattern — SOHIC" },
      { mechanism: "through_wall_hydrogen_crack", probability: 0.45, severity: "critical", basis: "SOHIC progresses to through-wall crack at stress concentrations" },
      { mechanism: "hydrogen_embrittlement_at_welds", probability: 0.60, severity: "critical", basis: "Hard heat-affected zones trap hydrogen — embrittlement risk at welds" },
      { mechanism: "loss_of_ductility", probability: 0.55, severity: "high", basis: "Hydrogen charging reduces elongation and impact toughness" }
    ],
    recommended_actions: ["WFMT_wet_fluorescent_MT", "UT_shear_wave_for_HIC", "AUBT_automated_UT_for_blistering", "hardness_survey_at_welds", "TOFD_for_SOHIC_at_welds"],
    scope_expansion: "All carbon steel in sour service — prioritize welds, nozzles, and areas with hardness > 200 HB",
    physics_basis: "H2S dissociates on steel surface — atomic hydrogen diffuses into steel — recombines at inclusions creating internal pressure — blisters, HIC, SOHIC. NACE MR0175 / API 571 5.1.2."
  },
  {
    id: "MC-007",
    category: "mechanism_cascade",
    name: "Scour and Undermining — Bridge/Civil",
    primary_trigger: ["scour", "bridge_scour", "riverbed_erosion", "sediment_removal", "foundation_exposure", "pier_undermining"],
    material_filter: null,
    secondary_risks: [
      { mechanism: "foundation_undermining", probability: 0.80, severity: "critical", basis: "Scour removes supporting soil from around foundation — bearing capacity lost" },
      { mechanism: "differential_settlement", probability: 0.65, severity: "critical", basis: "Uneven scour causes differential settlement — structural distortion" },
      { mechanism: "pile_exposure_and_corrosion", probability: 0.55, severity: "high", basis: "Exposed piles in water are subject to accelerated corrosion — especially splash zone" },
      { mechanism: "riprap_displacement", probability: 0.70, severity: "high", basis: "Scour undermines protective riprap — countermeasure failure" },
      { mechanism: "structural_misalignment", probability: 0.45, severity: "high", basis: "Settlement from scour causes deck misalignment and bearing damage" }
    ],
    recommended_actions: ["underwater_inspection_dive_or_ROV", "bathymetric_survey", "foundation_depth_probe", "structural_alignment_survey", "geotechnical_assessment"],
    scope_expansion: "All piers and abutments in same waterway — check upstream debris accumulation — check downstream channel migration",
    physics_basis: "Flowing water removes bed material around obstructions (piers). Scour depth increases with flow velocity squared. During flood events, scour can expose foundations within hours. FHWA HEC-18."
  },
  {
    id: "MC-008",
    category: "mechanism_cascade",
    name: "Fatigue at Welded Connections — Structural",
    primary_trigger: ["fatigue_crack", "weld_fatigue", "cyclic_loading", "dynamic_loading", "vibration_crack"],
    material_filter: null,
    secondary_risks: [
      { mechanism: "adjacent_weld_fatigue", probability: 0.60, severity: "high", basis: "If one weld detail fatigues, similar details at same stress range are at same life" },
      { mechanism: "gusset_plate_cracking", probability: 0.50, severity: "high", basis: "Gusset plate terminations are high fatigue category — check all similar details" },
      { mechanism: "bolt_loosening", probability: 0.45, severity: "medium", basis: "Cyclic loading loosens bolted connections — check torque on adjacent connections" },
      { mechanism: "crack_propagation_to_main_member", probability: 0.40, severity: "critical", basis: "Fatigue crack in attachment can propagate into primary structural member" }
    ],
    recommended_actions: ["MT_PT_at_all_similar_weld_details", "UT_for_crack_depth", "fatigue_life_assessment", "stress_range_verification"],
    scope_expansion: "All similar weld details in same fatigue category — all connections under same loading — check for section loss reducing fatigue resistance",
    physics_basis: "Fatigue is a statistical process — if one detail has cracked, others at same stress range are near end of life. AWS D1.1 fatigue categories. AASHTO fatigue provisions."
  },
  {
    id: "MC-009",
    category: "mechanism_cascade",
    name: "Erosion-Corrosion Cascade",
    primary_trigger: ["erosion_corrosion", "erosion", "wall_thinning_at_bend", "impingement", "flow_accelerated_corrosion", "fac"],
    material_filter: ["carbon_steel", "low_alloy"],
    secondary_risks: [
      { mechanism: "downstream_thinning", probability: 0.75, severity: "high", basis: "Erosion-corrosion at bend means downstream straight sections are also thinning" },
      { mechanism: "preferential_weld_attack", probability: 0.55, severity: "high", basis: "Turbulence at weld roots causes preferential erosion-corrosion at girth welds" },
      { mechanism: "dead_leg_corrosion", probability: 0.45, severity: "medium", basis: "Stagnant fluid in dead legs creates under-deposit corrosion" }
    ],
    recommended_actions: ["UT_thickness_grid_at_elbows_tees", "UT_downstream_of_flow_change", "internal_VT_if_accessible", "flow_modeling_for_rate_prediction"],
    scope_expansion: "All elbows, tees, reducers, and orifice plates in same system — check 5D downstream of each flow disturbance",
    physics_basis: "Fluid velocity removes protective oxide layer — fresh metal exposed to corrosion. Worst at changes in direction (elbows) and restrictions (orifice plates). API 571 4.3.5."
  },
  {
    id: "MC-010",
    category: "mechanism_cascade",
    name: "Creep Damage Cascade",
    primary_trigger: ["creep", "creep_void", "creep_crack", "bulging", "dimensional_change", "high_temp_service"],
    material_filter: ["carbon_steel", "low_alloy", "1cr", "2cr", "5cr", "9cr"],
    secondary_risks: [
      { mechanism: "creep_void_coalescence", probability: 0.65, severity: "critical", basis: "Isolated creep voids coalesce into microcracks — then macrocracks" },
      { mechanism: "weld_creep_cracking", probability: 0.70, severity: "critical", basis: "Type IV cracking in HAZ is most common creep failure mode in welds" },
      { mechanism: "metallurgical_degradation", probability: 0.60, severity: "high", basis: "Spheroidization and graphitization reduce strength at temperature" },
      { mechanism: "stress_relaxation_cracking", probability: 0.40, severity: "high", basis: "During shutdowns, stressed components crack from relaxation of creep strain" }
    ],
    recommended_actions: ["replica_metallography_at_welds", "hardness_survey", "dimensional_survey_for_bulging", "remaining_life_assessment_API579_Part10"],
    scope_expansion: "All components in same temperature circuit — prioritize welds, nozzles, and high-stress locations",
    physics_basis: "Creep is time + temperature + stress dependent. Voids form at grain boundaries, coalesce, then crack. API 579 Part 10. EPRI guidelines."
  },
  {
    id: "MC-011",
    category: "mechanism_cascade",
    name: "Microbiologically Influenced Corrosion Cascade",
    primary_trigger: ["mic", "microbiological", "bacterial_corrosion", "biofilm", "sulfate_reducing_bacteria", "srb"],
    material_filter: null,
    secondary_risks: [
      { mechanism: "underdeposit_pitting", probability: 0.75, severity: "high", basis: "Biofilm creates anaerobic zones — aggressive pitting under deposits" },
      { mechanism: "weld_preferential_attack", probability: 0.60, severity: "high", basis: "MIC preferentially attacks welds and HAZ due to microstructural differences" },
      { mechanism: "rapid_through_wall_pitting", probability: 0.50, severity: "critical", basis: "MIC pitting rates can be 10x higher than abiotic corrosion" }
    ],
    recommended_actions: ["internal_VT_with_deposit_mapping", "pit_depth_measurement", "microbiological_sampling", "UT_at_6_oclock_position"],
    scope_expansion: "All stagnant and low-flow areas in same system — dead legs — low points — bypass lines",
    physics_basis: "SRB produce H2S locally under biofilm — creates aggressive localized corrosion cell. Worst in stagnant water, low flow, and warm conditions (25-45C). NACE TM0194."
  },
  {
    id: "MC-012",
    category: "mechanism_cascade",
    name: "Stress Corrosion Cracking Cascade — Austenitic SS",
    primary_trigger: ["scc", "stress_corrosion", "chloride_cracking", "caustic_cracking", "branching_crack", "transgranular_crack"],
    material_filter: ["austenitic_ss", "304", "316", "stainless", "321", "347"],
    secondary_risks: [
      { mechanism: "branching_crack_network", probability: 0.70, severity: "critical", basis: "SCC in austenitic SS creates branching networks — single visible crack is tip of iceberg" },
      { mechanism: "hidden_through_wall_cracks", probability: 0.50, severity: "critical", basis: "SCC can penetrate to ID with minimal surface evidence" },
      { mechanism: "sensitization_at_welds", probability: 0.55, severity: "high", basis: "Weld HAZ sensitization creates preferential SCC path" }
    ],
    recommended_actions: ["PT_full_coverage", "PAUT_for_crack_depth_network", "metallographic_examination", "chloride_deposit_analysis"],
    scope_expansion: "All austenitic SS in same chloride exposure — especially under insulation, near coast, or in steam systems",
    physics_basis: "Three requirements: susceptible material (austenitic SS) + tensile stress + corrosive environment (chlorides > 10 ppm at > 60C). Once one location cracks, others in same conditions are at risk."
  },

  // ── CATEGORY 2: CROSS-METHOD NDT TRIGGERING ──────────────────────

  {
    id: "CM-001",
    category: "cross_method_triggering",
    name: "VT Crack Found — Escalate to Sizing",
    primary_trigger: ["vt_crack", "visual_crack", "surface_crack_vt", "linear_indication_vt"],
    material_filter: null,
    secondary_risks: [
      { mechanism: "unquantified_crack_depth", probability: 0.90, severity: "high", basis: "VT confirms presence but cannot size depth — engineering assessment impossible without depth" }
    ],
    recommended_actions: ["MT_PT_for_surface_confirmation_and_extent", "UT_PAUT_for_depth_sizing", "TOFD_if_critical_weld", "radiography_if_access_limited"],
    scope_expansion: "All welds in same circuit inspected by VT only — VT misses tight cracks",
    physics_basis: "Visual examination has zero depth resolution. Fitness-for-service per API 579 requires flaw depth. Method escalation is mandatory for crack-like indications."
  },
  {
    id: "CM-002",
    category: "cross_method_triggering",
    name: "Conventional UT Finds Complex Flaw — Escalate to PAUT/TOFD",
    primary_trigger: ["ut_complex_indication", "ut_cannot_size", "ut_ambiguous", "manual_ut_limitation"],
    material_filter: null,
    secondary_risks: [
      { mechanism: "undersized_flaw", probability: 0.65, severity: "critical", basis: "Manual UT underestimates flaw size in complex geometries — leads to unconservative assessment" }
    ],
    recommended_actions: ["PAUT_for_flaw_characterization", "TOFD_for_through_wall_sizing", "combined_PAUT_TOFD"],
    scope_expansion: null,
    physics_basis: "Manual UT has +/- 1-2mm sizing accuracy. PAUT improves to +/- 0.5mm. TOFD provides diffraction-based sizing independent of reflectivity. BS 7910 Annex T."
  },
  {
    id: "CM-003",
    category: "cross_method_triggering",
    name: "RT Finds Volumetric Indication — Verify with UT",
    primary_trigger: ["rt_indication", "radiographic_indication", "porosity_rt", "slag_rt", "incomplete_fusion_rt"],
    material_filter: null,
    secondary_risks: [
      { mechanism: "mischaracterized_planar_flaw", probability: 0.40, severity: "critical", basis: "RT can show planar flaws (lack of fusion) as volumetric if orientation unfavorable — UT confirms true nature" }
    ],
    recommended_actions: ["UT_for_flaw_characterization", "PAUT_if_complex_geometry"],
    scope_expansion: null,
    physics_basis: "Radiography is projection-based — crack-like flaws oriented parallel to beam may appear as volumetric or be missed entirely. UT is complementary."
  },

  // ── CATEGORY 3: CODE-BASED MANDATORY FOLLOW-UPS ──────────────────

  {
    id: "CF-001",
    category: "code_enforcement_chain",
    name: "Below Minimum Thickness — API 579 FFS Required",
    primary_trigger: ["below_tmin", "below_minimum_thickness", "wall_loss_exceeds_limit", "thickness_below_code"],
    material_filter: null,
    secondary_risks: [
      { mechanism: "code_rejection_without_ffs", probability: 0.95, severity: "critical", basis: "Below tmin requires either repair/replacement or fitness-for-service assessment per API 579" }
    ],
    recommended_actions: ["API_579_Level_1_assessment", "remaining_life_calculation", "engineering_review_required", "corrosion_rate_determination"],
    scope_expansion: "All CMLs in same circuit — determine if localized or general thinning",
    physics_basis: "ASME B31.3 / API 570 / API 510 all require minimum thickness for pressure retention. Below tmin, component is not code-compliant. API 579 provides alternative acceptance pathway."
  },
  {
    id: "CF-002",
    category: "code_enforcement_chain",
    name: "Crack in Pressure Boundary — Mandatory Engineering Review",
    primary_trigger: ["pressure_boundary_crack", "crack_in_vessel", "crack_in_pipe", "crack_in_tank"],
    material_filter: null,
    secondary_risks: [
      { mechanism: "loss_of_pressure_integrity", probability: 0.60, severity: "critical", basis: "Crack in pressure boundary is potential leak/rupture path" },
      { mechanism: "code_mandated_repair", probability: 0.80, severity: "critical", basis: "Most codes do not accept cracks without FFS assessment — API 579 Part 9" }
    ],
    recommended_actions: ["immediate_engineering_notification", "crack_sizing_PAUT_TOFD", "API_579_Part_9_assessment", "fracture_mechanics_evaluation"],
    scope_expansion: "Similar welds and details in same pressure system",
    physics_basis: "Cracks are stress concentrators with theoretically infinite stress at tip. Fracture mechanics governs remaining life. API 579 Part 9 is mandatory assessment path."
  },
  {
    id: "CF-003",
    category: "code_enforcement_chain",
    name: "Hardness Exceeds Limit in Sour Service",
    primary_trigger: ["hardness_above_limit", "hardness_above_22hrc", "hardness_above_248hb", "hard_weld", "hard_haz"],
    material_filter: ["carbon_steel", "low_alloy"],
    secondary_risks: [
      { mechanism: "sscc_susceptibility", probability: 0.80, severity: "critical", basis: "NACE MR0175 limits hardness to 22 HRC in sour service — above this, SSC risk is severe" },
      { mechanism: "hydrogen_embrittlement", probability: 0.70, severity: "critical", basis: "Hard microstructures trap hydrogen — embrittlement and cracking risk" }
    ],
    recommended_actions: ["hardness_survey_per_NACE", "WFMT_at_hard_zones", "metallographic_examination", "PWHT_evaluation"],
    scope_expansion: "All welds by same welder/WPS in sour service — all similar joints in same circuit",
    physics_basis: "Hard microstructures (martensite) have low hydrogen diffusivity — trap atomic hydrogen — crack under combined stress and H2S. NACE MR0175 / ISO 15156."
  },

  // ── CATEGORY 4: FAILURE MECHANISM COUPLING ────────────────────────

  {
    id: "FI-001",
    category: "mechanism_interaction",
    name: "Creep + Fatigue Interaction",
    primary_trigger: ["creep_fatigue", "high_temp_cyclic", "thermal_fatigue"],
    material_filter: ["carbon_steel", "low_alloy", "cr_mo"],
    secondary_risks: [
      { mechanism: "accelerated_crack_growth", probability: 0.75, severity: "critical", basis: "Combined creep-fatigue damage accumulates faster than either alone — synergistic effect" }
    ],
    interaction_multiplier: 1.5,
    recommended_actions: ["replica_metallography", "remaining_life_creep_fatigue", "cycle_counting", "temperature_history_review"],
    scope_expansion: "All components seeing both high temperature and cyclic loading",
    physics_basis: "Creep voids at grain boundaries accelerate fatigue crack initiation. Fatigue cracks grow faster in creep-damaged material. ASME NH / API 579."
  },
  {
    id: "FI-002",
    category: "mechanism_interaction",
    name: "HIC + SCC in Sour Service",
    primary_trigger: ["hic_and_scc", "sour_service_cracking", "hydrogen_and_stress"],
    material_filter: ["carbon_steel", "low_alloy"],
    secondary_risks: [
      { mechanism: "synergistic_hydrogen_cracking", probability: 0.80, severity: "critical", basis: "HIC weakens ligaments between blisters — tensile stress causes SOHIC — catastrophic coupling" }
    ],
    interaction_multiplier: 2.0,
    recommended_actions: ["AUBT_for_blistering", "TOFD_at_welds_for_SOHIC", "stress_analysis", "consider_hydrogen_outgassing"],
    scope_expansion: "Entire sour service circuit — all welds and nozzles",
    physics_basis: "HIC creates internal crack planes. Applied or residual stress links HIC planes (SOHIC). Combined effect is through-wall cracking where neither mechanism alone would cause failure."
  },
  {
    id: "FI-003",
    category: "mechanism_interaction",
    name: "Erosion + Corrosion Synergy",
    primary_trigger: ["erosion_and_corrosion", "erosion_corrosion"],
    material_filter: ["carbon_steel"],
    secondary_risks: [
      { mechanism: "accelerated_wall_loss", probability: 0.85, severity: "critical", basis: "Erosion removes protective corrosion scale — fresh metal exposed — corrosion accelerates — cycle repeats" }
    ],
    interaction_multiplier: 1.8,
    recommended_actions: ["UT_thickness_mapping", "corrosion_rate_recalculation", "flow_velocity_verification"],
    scope_expansion: "All bends, tees, and restrictions in same flow system",
    physics_basis: "Erosion-corrosion rate exceeds sum of individual rates. Protective magnetite scale is mechanically removed by particle impact or turbulence. API 571 4.3.5."
  },

  // ── CATEGORY 5: ENVIRONMENTAL EVENT CASCADE ───────────────────────

  {
    id: "EV-001",
    category: "environmental_event",
    name: "Hurricane / Storm Exposure — Offshore",
    primary_trigger: ["hurricane", "storm_damage", "extreme_weather", "typhoon", "cyclone", "storm_event"],
    material_filter: null,
    secondary_risks: [
      { mechanism: "fatigue_at_welded_joints", probability: 0.70, severity: "critical", basis: "Extreme wave loading imposes millions of high-stress cycles on tubular joints" },
      { mechanism: "coating_damage", probability: 0.80, severity: "high", basis: "Wave impact and debris damage protective coatings — initiates corrosion" },
      { mechanism: "structural_misalignment", probability: 0.45, severity: "critical", basis: "Extreme loading may cause permanent deformation or foundation shift" },
      { mechanism: "scour_at_foundations", probability: 0.65, severity: "critical", basis: "Storm surge and extreme currents cause rapid scour around foundations" },
      { mechanism: "riser_and_caisson_damage", probability: 0.55, severity: "critical", basis: "Wave loading on risers and caissons exceeds normal design envelope" }
    ],
    recommended_actions: ["post_storm_structural_survey", "underwater_inspection", "coating_condition_survey", "bathymetric_survey_for_scour", "bolt_torque_verification"],
    scope_expansion: "Entire facility — prioritize splash zone, tubular joints, and foundations",
    physics_basis: "100-year storm loads exceed design fatigue life consumed per cycle by orders of magnitude. Single event can consume years of fatigue life."
  },
  {
    id: "EV-002",
    category: "environmental_event",
    name: "Freeze-Thaw Event — Concrete/Civil",
    primary_trigger: ["freeze_thaw", "frost_damage", "winter_damage", "ice_damage", "scaling"],
    material_filter: ["concrete", "reinforced_concrete"],
    secondary_risks: [
      { mechanism: "concrete_spalling", probability: 0.70, severity: "high", basis: "Water in pores expands 9% on freezing — pops surface concrete off" },
      { mechanism: "rebar_exposure", probability: 0.50, severity: "critical", basis: "Spalling exposes reinforcing steel to direct corrosion" },
      { mechanism: "delamination", probability: 0.60, severity: "high", basis: "Ice lensing creates horizontal delamination planes" },
      { mechanism: "joint_sealant_failure", probability: 0.65, severity: "medium", basis: "Freeze-thaw cycles degrade joint sealants — water infiltration path" }
    ],
    recommended_actions: ["chain_drag_delamination_survey", "GPR_for_rebar_condition", "core_sampling_for_chloride_profile", "visual_spall_mapping"],
    scope_expansion: "All exposed concrete in same environment — deck surfaces, barrier walls, substructure splash zones",
    physics_basis: "Water expands 9% when freezing. Repeated cycles cause progressive deterioration. ACI 201.2R. Aggregates with high absorption are most susceptible."
  },
  {
    id: "EV-003",
    category: "environmental_event",
    name: "Seismic Event — Post-Earthquake Inspection",
    primary_trigger: ["earthquake", "seismic_event", "ground_motion", "seismic_damage"],
    material_filter: null,
    secondary_risks: [
      { mechanism: "anchor_bolt_damage", probability: 0.60, severity: "critical", basis: "Seismic base shear loads anchor bolts beyond capacity" },
      { mechanism: "tank_elephant_foot_buckling", probability: 0.55, severity: "critical", basis: "Storage tanks develop elephant foot buckling at base from sloshing and base shear" },
      { mechanism: "piping_support_failure", probability: 0.65, severity: "high", basis: "Seismic loads exceed piping support design — guides and snubbers fail" },
      { mechanism: "foundation_settlement", probability: 0.50, severity: "critical", basis: "Soil liquefaction causes differential settlement" }
    ],
    recommended_actions: ["post_earthquake_facility_walkdown", "anchor_bolt_survey", "piping_alignment_check", "tank_shell_survey", "foundation_level_survey"],
    scope_expansion: "Entire facility — prioritize critical equipment, pressure vessels, storage tanks, and emergency systems",
    physics_basis: "Seismic loads are inertial — mass x acceleration. Connections and supports are weakest links. API 653 Annex I for tanks. ASCE 7 for structures."
  },

  // ── CATEGORY 6: ASSET PROPAGATION ─────────────────────────────────

  {
    id: "AP-001",
    category: "asset_propagation",
    name: "Crack in One Nozzle — Check All Similar Nozzles",
    primary_trigger: ["nozzle_crack", "nozzle_weld_crack", "branch_connection_crack"],
    material_filter: null,
    secondary_risks: [
      { mechanism: "fleet_wide_nozzle_cracking", probability: 0.55, severity: "critical", basis: "Same design, same stress, same service — if one cracks, others are near end of life" }
    ],
    recommended_actions: ["inspect_all_similar_nozzles_same_vessel", "fleet_inspection_similar_vessels", "design_review_for_stress_concentration"],
    scope_expansion: "All nozzles of same size and type on same vessel — all similar vessels in fleet",
    physics_basis: "Nozzle welds see concentrated stress from piping loads and internal pressure. Identical nozzles have identical stress fields — common cause failure mode."
  },
  {
    id: "AP-002",
    category: "asset_propagation",
    name: "Failure in One Unit — Check Sibling Units",
    primary_trigger: ["unit_failure", "equipment_failure", "unexpected_failure"],
    material_filter: null,
    secondary_risks: [
      { mechanism: "common_cause_in_fleet", probability: 0.50, severity: "high", basis: "Same manufacturer, same vintage, same service — common cause applies to fleet" }
    ],
    recommended_actions: ["fleet_wide_inspection_notice", "design_review", "root_cause_analysis", "operating_history_comparison"],
    scope_expansion: "All equipment from same manufacturer, same vintage, in same service",
    physics_basis: "Common cause analysis. Same design flaws, same material lots, same fabrication shop all create fleet-wide risk."
  },

  // ── CATEGORY 7: HUMAN ERROR / PROCESS DEVIATION ───────────────────

  {
    id: "HE-001",
    category: "human_process_intelligence",
    name: "Poor Weld Profile — Check Welder and Procedure",
    primary_trigger: ["poor_weld_profile", "excessive_reinforcement", "undercut", "overlap", "incomplete_penetration", "bad_weld"],
    material_filter: null,
    secondary_risks: [
      { mechanism: "improper_heat_input", probability: 0.60, severity: "high", basis: "Poor profile indicates process deviation — heat input may be outside WPS range" },
      { mechanism: "adjacent_welds_by_same_welder", probability: 0.55, severity: "high", basis: "Systematic error — check all welds by same welder for same defect pattern" },
      { mechanism: "wps_non_compliance", probability: 0.50, severity: "high", basis: "Visual defects suggest WPS may not have been followed" }
    ],
    recommended_actions: ["welder_qualification_review", "WPS_compliance_audit", "inspect_adjacent_welds_same_welder", "hardness_test_if_heat_input_concern"],
    scope_expansion: "All welds by same welder in same campaign — all welds using same WPS",
    physics_basis: "Weld defects are often systematic, not random. Same welder making same error repeatedly. Same WPS issue affects all welds made to that procedure."
  },
  {
    id: "HE-002",
    category: "human_process_intelligence",
    name: "Incorrect Material Installed",
    primary_trigger: ["wrong_material", "material_mix_up", "material_mismatch", "pmi_failure", "incorrect_alloy"],
    material_filter: null,
    secondary_risks: [
      { mechanism: "accelerated_corrosion", probability: 0.70, severity: "critical", basis: "Wrong material in corrosive service corrodes at design-incompatible rate" },
      { mechanism: "galvanic_corrosion_at_joints", probability: 0.60, severity: "high", basis: "Dissimilar material creates galvanic couple at connections" },
      { mechanism: "scc_susceptibility", probability: 0.55, severity: "critical", basis: "Material not rated for service environment may be SCC-susceptible" }
    ],
    recommended_actions: ["PMI_all_suspect_components", "corrosion_rate_reassessment", "material_substitution_engineering_review"],
    scope_expansion: "All components from same supply chain / installation campaign",
    physics_basis: "Wrong material in wrong service is a leading cause of premature failure. PMI verification catches material substitution before failure occurs."
  },

  // ── CATEGORY 8: RISK ESCALATION & CONSEQUENCE ─────────────────────

  {
    id: "RE-001",
    category: "consequence_chain",
    name: "Leak in Sour Service — H2S Release",
    primary_trigger: ["sour_service_leak", "h2s_leak", "sour_gas_leak"],
    material_filter: null,
    secondary_risks: [
      { mechanism: "h2s_personnel_exposure", probability: 0.90, severity: "critical", basis: "H2S is immediately dangerous to life at 100 ppm — lethal at 500 ppm" },
      { mechanism: "fire_explosion_risk", probability: 0.70, severity: "critical", basis: "H2S-containing gas is flammable — ignition creates SO2 which is also toxic" }
    ],
    recommended_actions: ["immediate_area_isolation", "emergency_shutdown_evaluation", "atmospheric_monitoring", "repair_priority_critical"],
    scope_expansion: "All sour service lines in area — check for similar degradation",
    physics_basis: "H2S is denser than air — accumulates in low areas — immediately dangerous. OSHA PEL 10 ppm. NIOSH IDLH 50 ppm. Zero tolerance for active leaks."
  },
  {
    id: "RE-002",
    category: "consequence_chain",
    name: "Wall Loss on High-Energy Line",
    primary_trigger: ["wall_loss_high_energy", "thinning_steam_line", "thinning_high_pressure"],
    material_filter: null,
    secondary_risks: [
      { mechanism: "rupture_risk", probability: 0.50, severity: "critical", basis: "High-energy line rupture releases stored energy — blast and thermal hazard" },
      { mechanism: "secondary_equipment_damage", probability: 0.60, severity: "high", basis: "Rupture damages adjacent piping and equipment — cascading failure" }
    ],
    recommended_actions: ["engineering_review_immediate", "operating_pressure_review", "derating_if_warranted", "remaining_life_calculation"],
    scope_expansion: "Entire high-energy circuit — elbows, reducers, and areas downstream of flow disturbances",
    physics_basis: "Stored energy in high-pressure steam or hydrocarbon systems makes rupture a high-consequence event. ASME B31.1 / B31.3 critical piping classification."
  },

  // ── CATEGORY 9: ADAPTIVE INSPECTION PLANNING ──────────────────────

  {
    id: "IP-001",
    category: "adaptive_planning",
    name: "Accelerating Corrosion Rate — Increase Frequency",
    primary_trigger: ["accelerating_rate", "increasing_corrosion_rate", "rate_increase", "rate_exceeds_prediction"],
    material_filter: null,
    secondary_risks: [
      { mechanism: "remaining_life_shorter_than_planned", probability: 0.80, severity: "high", basis: "If rate is accelerating, linear prediction underestimates damage" }
    ],
    recommended_actions: ["increase_inspection_frequency", "recalculate_remaining_life_with_current_rate", "investigate_root_cause_of_acceleration", "consider_inhibitor_or_lining"],
    scope_expansion: "All CMLs in same circuit — check if acceleration is localized or system-wide",
    physics_basis: "Corrosion rate acceleration indicates process change, inhibitor failure, or material depassivation. Previous interval was set on old rate — too long for current rate."
  },
  {
    id: "IP-002",
    category: "adaptive_planning",
    name: "Repeated Finding at Same Location",
    primary_trigger: ["repeat_finding", "recurring_indication", "same_location_finding"],
    material_filter: null,
    secondary_risks: [
      { mechanism: "chronic_damage_mechanism", probability: 0.75, severity: "high", basis: "Repeat findings at same location indicate root cause not addressed — mechanism is active and ongoing" }
    ],
    recommended_actions: ["root_cause_analysis", "method_upgrade_for_better_characterization", "design_modification_evaluation", "permanent_monitoring_consideration"],
    scope_expansion: "Track finding history at this location — compare with similar locations",
    physics_basis: "Repeat findings are not random — they indicate a persistent driving force (stress, environment, flow pattern) that will continue until root cause is eliminated."
  },

  // ── ADDITIONAL HIGH-VALUE CHAINS ──────────────────────────────────

  {
    id: "MC-013",
    category: "mechanism_cascade",
    name: "Thermal Spray Coating Failure — Offshore",
    primary_trigger: ["tsa_failure", "thermal_spray_failure", "tsc_failure", "metallizing_failure"],
    material_filter: ["carbon_steel"],
    secondary_risks: [
      { mechanism: "rapid_splash_zone_corrosion", probability: 0.85, severity: "critical", basis: "Splash zone corrosion rate without TSA is 1-3 mm/year — structural failure within 2-5 years" },
      { mechanism: "cathodic_protection_inadequacy", probability: 0.60, severity: "high", basis: "TSA failure may indicate CP system also inadequate in splash zone" }
    ],
    recommended_actions: ["splash_zone_UT_thickness_survey", "CP_survey", "TSA_repair_or_alternative_coating"],
    scope_expansion: "All TSA-coated members in splash zone",
    physics_basis: "Splash zone is most aggressive corrosion zone offshore — alternating wet/dry with oxygen. TSA (aluminum) provides both barrier and galvanic protection. Loss of TSA is critical."
  },
  {
    id: "MC-014",
    category: "mechanism_cascade",
    name: "Tank Bottom Corrosion — Storage Tank",
    primary_trigger: ["tank_bottom_corrosion", "tank_floor_thinning", "tank_bottom_pit", "tank_soil_side_corrosion"],
    material_filter: ["carbon_steel"],
    secondary_risks: [
      { mechanism: "soil_side_corrosion", probability: 0.70, severity: "high", basis: "If product-side corrosion is active, soil-side is likely too — cannot inspect externally without lifting tank" },
      { mechanism: "annular_plate_thinning", probability: 0.65, severity: "critical", basis: "Annular plates carry shell load — thinning is structurally critical" },
      { mechanism: "foundation_damage_from_leaks", probability: 0.50, severity: "high", basis: "Bottom leaks saturate foundation — causes settlement and further bottom stress" }
    ],
    recommended_actions: ["MFL_floor_scan", "annular_plate_UT", "soil_side_CP_survey", "leak_detection_system_verification"],
    scope_expansion: "Adjacent tanks on same pad — same age, same product, same foundation design",
    physics_basis: "API 653 tank inspection. Bottom corrosion is driven by water dropout, microbes, and soil-side moisture. Annular plates per API 653 Table 4.4."
  },
  {
    id: "MC-015",
    category: "mechanism_cascade",
    name: "Weld Overlay / Cladding Disbond",
    primary_trigger: ["cladding_disbond", "overlay_disbond", "cladding_crack", "weld_overlay_defect"],
    material_filter: null,
    secondary_risks: [
      { mechanism: "substrate_corrosion_under_cladding", probability: 0.80, severity: "critical", basis: "Cladding provides corrosion barrier — disbond exposes carbon steel substrate to process fluid" },
      { mechanism: "hydrogen_trapping_at_bond_line", probability: 0.55, severity: "high", basis: "Disbond at cladding-substrate interface traps hydrogen — creates HIC risk at bond line" }
    ],
    recommended_actions: ["UT_shear_wave_for_disbond_mapping", "PAUT_for_bond_line_assessment", "UT_thickness_through_cladding"],
    scope_expansion: "All clad vessels and piping in same service — prioritize areas of highest corrosion severity",
    physics_basis: "CRA cladding protects carbon steel substrate from corrosive process. Disbond creates crevice where process fluid contacts unprotected carbon steel. API 945."
  },
  {
    id: "MC-016",
    category: "mechanism_cascade",
    name: "Nuclear — Irradiation Embrittlement Cascade",
    primary_trigger: ["irradiation_embrittlement", "fluence_exposure", "neutron_damage", "rtndt_shift"],
    material_filter: ["low_alloy", "reactor_vessel_steel", "sa508", "sa533"],
    secondary_risks: [
      { mechanism: "pressurized_thermal_shock_risk", probability: 0.65, severity: "critical", basis: "Embrittled vessel cannot sustain PTS events — fracture toughness reduced below safety margin" },
      { mechanism: "surveillance_capsule_exhaustion", probability: 0.40, severity: "high", basis: "Limited surveillance capsules — if exhausted, no way to directly monitor material condition" }
    ],
    recommended_actions: ["surveillance_capsule_testing", "RTNDT_calculation_update", "PTS_screening_per_10CFR50.61", "master_curve_analysis"],
    scope_expansion: "All weld seams in beltline region — especially with high copper and nickel content",
    physics_basis: "Neutron fluence causes copper precipitation hardening and matrix damage — shifts ductile-to-brittle transition temperature upward. 10 CFR 50.61. Reg Guide 1.99 Rev 2."
  },
  {
    id: "MC-017",
    category: "mechanism_cascade",
    name: "Aerospace — Fatigue Crack at Fastener Hole",
    primary_trigger: ["fastener_hole_crack", "rivet_hole_crack", "bolt_hole_crack", "fatigue_at_fastener"],
    material_filter: ["aluminum", "al_alloy", "7075", "2024"],
    secondary_risks: [
      { mechanism: "multi_site_damage", probability: 0.60, severity: "critical", basis: "MSD — multiple fastener holes cracking simultaneously — leads to rapid link-up and catastrophic failure" },
      { mechanism: "widespread_fatigue_damage", probability: 0.50, severity: "critical", basis: "WFD — damage at multiple structural elements simultaneously" }
    ],
    recommended_actions: ["eddy_current_all_fastener_holes_in_row", "BVID_inspection_at_repair_doublers", "fleet_AD_evaluation"],
    scope_expansion: "All fastener holes in same row, same panel, same structural element — all aircraft of same type at similar flight hours",
    physics_basis: "Aging aircraft. Aloha Airlines 1988. MSD at rivet holes caused explosive decompression. FAA AC 120-104. Damage tolerance and WFD assessment."
  },
  {
    id: "MC-018",
    category: "mechanism_cascade",
    name: "Power Gen — Boiler Tube Failure Cascade",
    primary_trigger: ["boiler_tube_failure", "tube_leak", "tube_rupture", "boiler_tube_thinning"],
    material_filter: ["carbon_steel", "low_alloy", "t11", "t22"],
    secondary_risks: [
      { mechanism: "adjacent_tube_erosion_from_leak", probability: 0.75, severity: "high", basis: "Steam jet from failed tube erodes adjacent tubes — causes cascading failures within hours" },
      { mechanism: "waterwall_thinning_pattern", probability: 0.60, severity: "high", basis: "FAC or fireside corrosion is position-dependent — adjacent tubes in same position are at same risk" },
      { mechanism: "sootblower_erosion_at_nearby_tubes", probability: 0.50, severity: "medium", basis: "Sootblower lanes cause localized erosion — check all tubes in sootblower path" }
    ],
    recommended_actions: ["UT_thickness_grid_adjacent_tubes", "tube_sampling_for_metallography", "remaining_life_calculation", "sootblower_alignment_check"],
    scope_expansion: "All tubes at same elevation and same burner position — all tubes in same sootblower lane",
    physics_basis: "Boiler tube failure mechanisms are position-dependent (fireside corrosion, FAC, sootblower erosion). One failure indicates mechanism is active at that position across multiple tubes."
  },
  {
    id: "MC-019",
    category: "mechanism_cascade",
    name: "Maritime — Ballast Tank Corrosion Cascade",
    primary_trigger: ["ballast_tank_corrosion", "tank_coating_failure", "ballast_tank_pitting"],
    material_filter: ["carbon_steel", "mild_steel"],
    secondary_risks: [
      { mechanism: "structural_section_loss", probability: 0.70, severity: "critical", basis: "Ballast tank corrosion reduces frame and stiffener cross-section — structural inadequacy" },
      { mechanism: "coating_system_failure_propagation", probability: 0.75, severity: "high", basis: "Coating failure in one area accelerates adjacent coating breakdown" },
      { mechanism: "anode_depletion", probability: 0.55, severity: "high", basis: "Sacrificial anodes may be depleted — check anode condition and wastage" }
    ],
    recommended_actions: ["close_up_survey_per_IACS", "UT_gauging_at_frames_and_stiffeners", "anode_survey", "coating_condition_grading"],
    scope_expansion: "All ballast tanks — adjacent tanks — void spaces at same level",
    physics_basis: "IACS Common Structural Rules. Ballast tanks are most aggressive environment on ship — seawater + air + biological fouling. Class society special surveys. PSPC coating standard."
  },
  {
    id: "MC-020",
    category: "mechanism_cascade",
    name: "Medical Device — Implant Fatigue Failure",
    primary_trigger: ["implant_fatigue", "implant_crack", "device_fatigue_failure"],
    material_filter: ["titanium", "ti6al4v", "cobalt_chrome", "nitinol", "stainless_steel_implant"],
    secondary_risks: [
      { mechanism: "fretting_corrosion_at_interface", probability: 0.65, severity: "critical", basis: "Modular implant interfaces fret under cyclic loading — releases metal debris into tissue" },
      { mechanism: "adverse_tissue_reaction", probability: 0.55, severity: "critical", basis: "Metal debris causes metallosis, ALTR, and tissue necrosis" },
      { mechanism: "lot_wide_implant_defect", probability: 0.40, severity: "critical", basis: "Manufacturing defect may affect entire production lot — recall evaluation required" }
    ],
    recommended_actions: ["retrieval_analysis", "lot_traceability_review", "MDR_reporting_evaluation", "fleet_wide_surveillance"],
    scope_expansion: "All implants from same lot, same manufacturer, same design — all patients with same device",
    physics_basis: "ASTM F2345 for spinal implant fatigue. ISO 14801 for dental. In-vivo loading is complex multiaxial fatigue. Manufacturing inclusions or surface defects reduce fatigue life."
  }
];


// =====================================================================
// METHOD CAPABILITY MAP — What each NDT method can and cannot do
// =====================================================================

var METHOD_CAPABILITIES = {
  VT: { can_detect: ["surface_defects", "corrosion", "deformation", "coating_damage"], cannot_do: ["depth_sizing", "subsurface_detection", "crack_depth"], reliability: "low_for_tight_cracks" },
  MT: { can_detect: ["surface_cracks", "near_surface_cracks"], cannot_do: ["depth_sizing", "subsurface_beyond_3mm", "non_ferromagnetic"], reliability: "high_for_surface_cracks" },
  PT: { can_detect: ["surface_breaking_cracks", "porosity", "laps"], cannot_do: ["depth_sizing", "subsurface_detection"], reliability: "high_for_surface_breaking" },
  UT: { can_detect: ["wall_thickness", "subsurface_flaws", "laminations"], cannot_do: ["complex_flaw_characterization", "near_surface_zone"], reliability: "medium_for_sizing" },
  PAUT: { can_detect: ["flaw_characterization", "flaw_sizing", "complex_geometry", "depth_sizing"], cannot_do: ["very_rough_surfaces"], reliability: "high_for_sizing" },
  TOFD: { can_detect: ["through_wall_sizing", "crack_height", "diffraction_sizing"], cannot_do: ["near_surface_detection", "very_thin_wall"], reliability: "high_for_depth" },
  RT: { can_detect: ["volumetric_flaws", "porosity", "slag", "burn_through"], cannot_do: ["tight_crack_detection", "depth_sizing"], reliability: "low_for_planar_flaws" },
  ET: { can_detect: ["surface_cracks", "near_surface", "conductivity_changes"], cannot_do: ["deep_subsurface", "thick_components"], reliability: "high_for_tubing" },
  MFL: { can_detect: ["wall_loss", "corrosion", "metal_loss"], cannot_do: ["crack_detection", "precise_depth"], reliability: "high_for_tank_floors" },
  AE: { can_detect: ["active_crack_growth", "leak_detection", "fiber_break"], cannot_do: ["flaw_sizing", "dormant_flaw_detection"], reliability: "high_for_active_damage" }
};


// =====================================================================
// CONCEPT ENGINE 1: CONSTRAINT DOMINANCE
// What is actually governing this case?
// =====================================================================

function runConstraintDominance(caseData, findings, evidence) {
  var haystack = buildHaystack(caseData, findings);
  var constraints = [];

  // Check code limits
  if (caseData.code_compliance_status === "below_tmin" || containsAny(haystack, ["below_minimum", "below_tmin", "wall_loss_exceeds"])) {
    constraints.push({ constraint: "code_minimum_thickness", score: 0.95, family: "code_limit", summary: "Measured thickness is below code minimum — code compliance governs the case" });
  }

  // Check evidence quality
  var hasOnlyVT = true;
  for (var fi = 0; fi < findings.length; fi++) {
    var method = lower(findings[fi].method || findings[fi].ndt_method || "");
    if (method !== "vt" && method !== "visual" && method !== "") hasOnlyVT = false;
  }
  if (findings.length > 0 && hasOnlyVT && containsAny(haystack, ["crack", "linear", "planar"])) {
    constraints.push({ constraint: "evidence_insufficiency", score: 0.88, family: "evidence_quality", summary: "Crack-like indication found by VT only — evidence is insufficient for sizing and disposition" });
  }

  // Check if sour service governs
  if (containsAny(haystack, ["sour", "h2s", "nace", "mr0175"])) {
    constraints.push({ constraint: "sour_service_compliance", score: 0.92, family: "regulatory", summary: "Sour service requirements (NACE MR0175) govern material and hardness limits" });
  }

  // Sort by score descending
  constraints.sort(function(a, b) { return b.score - a.score; });

  return {
    governing: constraints.length > 0 ? constraints[0] : null,
    all_constraints: constraints
  };
}


// =====================================================================
// CONCEPT ENGINE 2: PHYSICS SUFFICIENCY
// Are the inspection methods adequate for the findings?
// =====================================================================

function runPhysicsSufficiency(caseData, findings) {
  var gaps = [];

  for (var i = 0; i < findings.length; i++) {
    var f = findings[i];
    var fType = lower(f.indication_type || f.type || f.finding_type || "");
    var fMethod = lower(f.method || f.ndt_method || "");

    // Crack found by VT or RT — needs depth sizing
    if (containsAny(fType, ["crack", "linear", "planar"])) {
      if (fMethod === "vt" || fMethod === "visual" || fMethod === "rt" || fMethod === "radiography") {
        gaps.push({
          finding: fType,
          current_method: fMethod,
          gap: "Cannot size crack depth",
          required_capability: "depth_sizing",
          recommended_method: "PAUT or TOFD",
          score: 0.85
        });
      }
    }

    // Subsurface indication found by surface method
    if (containsAny(fType, ["subsurface", "embedded", "lamination", "inclusion"])) {
      if (fMethod === "vt" || fMethod === "mt" || fMethod === "pt") {
        gaps.push({
          finding: fType,
          current_method: fMethod,
          gap: "Surface method cannot characterize subsurface flaw",
          required_capability: "subsurface_detection",
          recommended_method: "UT or PAUT",
          score: 0.80
        });
      }
    }

    // Complex geometry with basic UT
    if (containsAny(fType, ["complex", "nozzle", "branch", "attachment", "intersection"])) {
      if (fMethod === "ut" || fMethod === "manual_ut") {
        gaps.push({
          finding: fType,
          current_method: fMethod,
          gap: "Manual UT insufficient for complex geometry flaw characterization",
          required_capability: "flaw_characterization",
          recommended_method: "PAUT",
          score: 0.75
        });
      }
    }
  }

  return {
    sufficient: gaps.length === 0,
    gaps: gaps,
    requires_method_escalation: gaps.length > 0
  };
}


// =====================================================================
// CONCEPT ENGINE 3: MECHANISM PROPAGATION — The Core Chain Engine
// "If I see X, always check Y"
// =====================================================================

function runMechanismPropagation(caseData, findings) {
  var haystack = buildHaystack(caseData, findings);
  var triggered = [];

  for (var ci = 0; ci < MECHANISM_CHAINS.length; ci++) {
    var chain = MECHANISM_CHAINS[ci];

    // Check if primary trigger matches
    var triggerMatch = false;
    for (var ti = 0; ti < chain.primary_trigger.length; ti++) {
      if (haystack.indexOf(lower(chain.primary_trigger[ti])) !== -1) {
        triggerMatch = true;
        break;
      }
    }

    if (!triggerMatch) continue;

    // Check material filter if specified
    if (chain.material_filter) {
      var materialMatch = false;
      for (var mi = 0; mi < chain.material_filter.length; mi++) {
        if (haystack.indexOf(lower(chain.material_filter[mi])) !== -1) {
          materialMatch = true;
          break;
        }
      }
      if (!materialMatch) continue;
    }

    triggered.push({
      chain_id: chain.id,
      chain_name: chain.name,
      category: chain.category,
      secondary_risks: chain.secondary_risks,
      recommended_actions: chain.recommended_actions,
      scope_expansion: chain.scope_expansion,
      physics_basis: chain.physics_basis,
      interaction_multiplier: chain.interaction_multiplier || 1.0
    });
  }

  return {
    chains_evaluated: MECHANISM_CHAINS.length,
    chains_triggered: triggered.length,
    triggered: triggered
  };
}


// =====================================================================
// CONCEPT ENGINE 4: MECHANISM INTERACTION
// Detect coupled mechanisms that amplify each other
// =====================================================================

function runMechanismInteraction(caseData, findings) {
  var haystack = buildHaystack(caseData, findings);
  var interactions = [];

  // Define interaction pairs
  var INTERACTION_PAIRS = [
    { pair: ["creep", "fatigue"], name: "Creep-Fatigue Interaction", multiplier: 1.5, basis: "Creep voids accelerate fatigue crack initiation and propagation" },
    { pair: ["hic", "scc"], name: "HIC-SCC Synergy (SOHIC)", multiplier: 2.0, basis: "HIC weakens ligaments — stress causes stepwise cracking" },
    { pair: ["erosion", "corrosion"], name: "Erosion-Corrosion Synergy", multiplier: 1.8, basis: "Erosion removes protective scale — accelerates corrosion" },
    { pair: ["vibration", "corrosion"], name: "Corrosion-Fatigue", multiplier: 1.6, basis: "Corrosive environment reduces fatigue life by order of magnitude" },
    { pair: ["sulfidation", "creep"], name: "Sulfidation-Creep Coupling", multiplier: 1.4, basis: "Both active at high temperature — combined wall loss and embrittlement" },
    { pair: ["mic", "under_deposit"], name: "MIC-Under Deposit Corrosion", multiplier: 1.5, basis: "Biofilm creates deposits that trap corrosive species" },
    { pair: ["stress_corrosion", "hydrogen"], name: "SCC-Hydrogen Synergy", multiplier: 1.7, basis: "Stress corrosion and hydrogen embrittlement share crack paths" },
    { pair: ["coating_failure", "cathodic_protection"], name: "Coating-CP System Failure", multiplier: 1.6, basis: "Loss of both barriers means unprotected metal in aggressive environment" },
    { pair: ["thermal_cycling", "chloride"], name: "Thermal Cycling + Chloride SCC", multiplier: 1.5, basis: "Thermal cycling concentrates chlorides at evaporation zones — SCC on austenitic SS" }
  ];

  for (var pi = 0; pi < INTERACTION_PAIRS.length; pi++) {
    var pair = INTERACTION_PAIRS[pi];
    var match0 = containsAny(haystack, [pair.pair[0]]);
    var match1 = containsAny(haystack, [pair.pair[1]]);
    if (match0 && match1) {
      interactions.push({
        interaction_key: pair.name,
        mechanisms: pair.pair,
        interaction_multiplier: pair.multiplier,
        summary: pair.basis
      });
    }
  }

  return { interactions: interactions };
}


// =====================================================================
// CONCEPT ENGINE 5: CONTRADICTION DETECTION
// Flag conflicts between evidence, context, and conclusions
// =====================================================================

function runContradictionDetection(caseData, findings) {
  var haystack = buildHaystack(caseData, findings);
  var contradictions = [];

  // Visual benign but UT shows wall loss
  if (containsAny(haystack, ["visual_ok", "looks_good", "no_visual", "benign", "acceptable_vt"]) && containsAny(haystack, ["wall_loss", "thinning", "below_tmin", "pit"])) {
    contradictions.push({
      type: "evidence_conflict",
      description: "Visual condition appears benign but thickness measurements indicate wall loss — possible hidden corrosion (CUI, soil-side, or internal)",
      severity: "high",
      requires_resolution: true
    });
  }

  // High confidence but insufficient method
  if (caseData.confidence_score > 0.80) {
    var methodsUsed = [];
    for (var fi = 0; fi < findings.length; fi++) {
      var m = lower(findings[fi].method || findings[fi].ndt_method || "");
      if (m && methodsUsed.indexOf(m) === -1) methodsUsed.push(m);
    }
    if (methodsUsed.length === 1 && (methodsUsed[0] === "vt" || methodsUsed[0] === "visual")) {
      contradictions.push({
        type: "confidence_method_mismatch",
        description: "Decision confidence is " + caseData.confidence_score + " but only VT was performed — confidence may be inflated",
        severity: "high",
        requires_resolution: true
      });
    }
  }

  // Crack found but disposition is accept
  if (containsAny(haystack, ["crack", "linear_indication", "planar_flaw"]) && (lower(caseData.final_decision || "") === "accept" || lower(caseData.status) === "accepted")) {
    contradictions.push({
      type: "finding_disposition_conflict",
      description: "Crack-like indication recorded but case disposition is accept — verify FFS assessment supports acceptance",
      severity: "high",
      requires_resolution: true
    });
  }

  return { contradictions: contradictions };
}


// =====================================================================
// CONCEPT ENGINE 6: BLIND SPOT DETECTOR
// What's missing that should have been checked?
// =====================================================================

function runBlindSpotDetection(caseData, findings) {
  var haystack = buildHaystack(caseData, findings);
  var blindSpots = [];

  // Weld inspection without HAZ coverage
  if (containsAny(haystack, ["weld", "butt_weld", "fillet_weld", "girth_weld"])) {
    var hazChecked = containsAny(haystack, ["haz", "heat_affected", "haz_examined"]);
    if (!hazChecked) {
      blindSpots.push({
        type: "coverage_gap",
        description: "Weld inspected but HAZ (heat-affected zone) not directly assessed",
        risk_created: "Missed crack extension, sensitization, or hardness deviation in HAZ",
        recommended_follow_up: ["targeted_surface_exam_at_HAZ", "hardness_test_at_HAZ"]
      });
    }
  }

  // Piping inspection without supports checked
  if (containsAny(haystack, ["pipe", "piping", "pipeline", "line"])) {
    if (!containsAny(haystack, ["support", "hanger", "guide", "anchor", "shoe"])) {
      blindSpots.push({
        type: "scope_gap",
        description: "Piping inspected but pipe supports not assessed",
        risk_created: "Corrosion under support shoes, support failure, or pipe movement",
        recommended_follow_up: ["support_condition_survey", "UT_at_support_contact_points"]
      });
    }
  }

  // Vessel inspection without nozzle focus
  if (containsAny(haystack, ["vessel", "pressure_vessel", "drum", "tower", "column"])) {
    if (!containsAny(haystack, ["nozzle", "manway", "davit", "attachment"])) {
      blindSpots.push({
        type: "scope_gap",
        description: "Vessel body inspected but nozzle and attachment welds not specifically assessed",
        risk_created: "Nozzle welds are highest stress locations — cracking and corrosion hotspots",
        recommended_follow_up: ["nozzle_weld_MT_PT", "nozzle_bore_UT"]
      });
    }
  }

  // CUI assessment without checking low points
  if (containsAny(haystack, ["cui", "insulation", "under_insulation"])) {
    if (!containsAny(haystack, ["low_point", "drain", "dead_leg", "support_under_insulation"])) {
      blindSpots.push({
        type: "coverage_gap",
        description: "CUI assessment performed but low points, drains, and supports under insulation not specifically targeted",
        risk_created: "Water accumulates at low points — worst CUI damage location",
        recommended_follow_up: ["inspect_all_low_points", "insulation_removal_at_supports"]
      });
    }
  }

  // No baseline comparison
  if (!containsAny(haystack, ["baseline", "previous_inspection", "trend", "comparison", "historical"])) {
    blindSpots.push({
      type: "context_gap",
      description: "No baseline or historical data referenced in assessment",
      risk_created: "Cannot determine if condition is stable, improving, or degrading without trend data",
      recommended_follow_up: ["retrieve_inspection_history", "establish_baseline_for_trending"]
    });
  }

  return { blind_spots: blindSpots };
}


// =====================================================================
// CONCEPT ENGINE 7: INFORMATION GAIN
// Rank next actions by uncertainty reduction value
// =====================================================================

function runInformationGain(physicsGaps, blindSpots, propagation) {
  var actions = [];

  // From physics sufficiency gaps
  for (var gi = 0; gi < physicsGaps.length; gi++) {
    var gap = physicsGaps[gi];
    actions.push({
      action: gap.recommended_method,
      priority: gap.score >= 0.80 ? "critical" : "high",
      reason: gap.gap + " — " + gap.recommended_method + " resolves this",
      expected_information_gain: gap.score,
      effort_estimate: 0.40
    });
  }

  // From blind spots
  for (var bi = 0; bi < blindSpots.length; bi++) {
    var bs = blindSpots[bi];
    if (bs.recommended_follow_up) {
      for (var ri = 0; ri < bs.recommended_follow_up.length; ri++) {
        actions.push({
          action: bs.recommended_follow_up[ri],
          priority: "high",
          reason: "Blind spot: " + bs.description,
          expected_information_gain: 0.65,
          effort_estimate: 0.30
        });
      }
    }
  }

  // From propagation chains — top 5 recommended actions
  var chainActions = [];
  for (var ci = 0; ci < propagation.length && ci < 5; ci++) {
    var chain = propagation[ci];
    for (var ai = 0; ai < chain.recommended_actions.length; ai++) {
      chainActions.push({
        action: chain.recommended_actions[ai],
        priority: "high",
        reason: "Mechanism chain: " + chain.chain_name,
        expected_information_gain: 0.60,
        effort_estimate: 0.35
      });
    }
  }
  actions = actions.concat(chainActions);

  // Sort by information gain descending
  actions.sort(function(a, b) { return (b.expected_information_gain || 0) - (a.expected_information_gain || 0); });

  // Deduplicate by action name
  var seen = {};
  var unique = [];
  for (var ui = 0; ui < actions.length; ui++) {
    var key = lower(actions[ui].action);
    if (!seen[key]) {
      seen[key] = true;
      unique.push(actions[ui]);
    }
  }

  return unique.slice(0, 15);
}


// =====================================================================
// CONCEPT ENGINE 8: FAILURE PATHWAY SIMULATOR
// What happens if this finding is ignored?
// =====================================================================

function runFailurePathway(caseData, findings, propagation) {
  var haystack = buildHaystack(caseData, findings);
  var pathways = [];

  if (containsAny(haystack, ["crack", "linear", "planar"])) {
    pathways.push({
      path: "crack_to_rupture",
      plausibility: 0.65,
      consequence_level: "critical",
      time_horizon: "months_to_years",
      nodes: ["surface_crack_detected", "fatigue_propagation_under_service", "critical_crack_size_reached", "through_wall_penetration", "leak_or_rupture"]
    });
  }

  if (containsAny(haystack, ["thinning", "wall_loss", "erosion", "corrosion"])) {
    pathways.push({
      path: "thinning_to_failure",
      plausibility: 0.55,
      consequence_level: "critical",
      time_horizon: "years",
      nodes: ["active_wall_thinning", "remaining_wall_below_safety_margin", "localized_bulging_or_distortion", "burst_or_leak_at_weakest_point"]
    });
  }

  if (containsAny(haystack, ["coating_failure", "coating_disbond", "blister"])) {
    pathways.push({
      path: "coating_failure_to_structural_loss",
      plausibility: 0.50,
      consequence_level: "high",
      time_horizon: "months_to_years",
      nodes: ["coating_disbond", "moisture_trapped_against_substrate", "corrosion_initiates_under_coating", "wall_thinning_progresses_undetected", "code_minimum_breached"]
    });
  }

  if (containsAny(haystack, ["scour", "undermining", "foundation_exposure"])) {
    pathways.push({
      path: "scour_to_structural_collapse",
      plausibility: 0.60,
      consequence_level: "critical",
      time_horizon: "event_driven",
      nodes: ["scour_around_foundation", "bearing_capacity_reduced", "differential_settlement", "structural_distortion", "collapse_during_next_flood_event"]
    });
  }

  if (containsAny(haystack, ["vibration", "fiv", "aiv"])) {
    pathways.push({
      path: "vibration_to_branch_failure",
      plausibility: 0.70,
      consequence_level: "critical",
      time_horizon: "days_to_weeks_if_resonance",
      nodes: ["flow_induced_vibration_active", "high_cycle_fatigue_at_connections", "crack_initiation_at_weld_toe", "rapid_propagation", "small_bore_branch_separation"]
    });
  }

  return pathways;
}


// =====================================================================
// CONCEPT ENGINE 9: PARALLEL REALITY
// What happens under different response strategies?
// =====================================================================

function runParallelReality(caseData, pathways) {
  var branches = [];

  branches.push({
    branch: "monitor_and_trend",
    summary: "Continue operating with increased monitoring frequency",
    relative_risk: 0.65,
    projected_outcome: "Acceptable if degradation rate is slow and stable. Unacceptable if rate is accelerating or mechanism is crack-like."
  });

  branches.push({
    branch: "repair_in_place",
    summary: "Perform localized repair without shutdown",
    relative_risk: 0.30,
    projected_outcome: "Reduces immediate risk. May not address root cause. Monitor repaired area plus surrounding zone."
  });

  branches.push({
    branch: "replace_component",
    summary: "Full replacement of affected component",
    relative_risk: 0.05,
    projected_outcome: "Eliminates current damage. Highest cost but lowest residual risk. Verify replacement material is correct grade."
  });

  if (pathways.length > 0 && pathways[0].plausibility > 0.60) {
    branches.push({
      branch: "immediate_shutdown",
      summary: "Take out of service immediately for detailed assessment",
      relative_risk: 0.10,
      projected_outcome: "Required if failure pathway plausibility exceeds 60% and consequence is critical."
    });
  }

  return branches;
}


// =====================================================================
// CONCEPT ENGINE 10: CONFIDENCE COLLAPSE
// When should we reduce confidence?
// =====================================================================

function runConfidenceCollapse(caseData, physicsSufficiency, contradictions, blindSpots) {
  var originalConfidence = caseData.confidence_score || caseData.risk_score || 0.75;
  var collapseFactors = [];
  var totalPenalty = 0;

  // Physics insufficiency
  if (!physicsSufficiency.sufficient) {
    var penalty = 0.05 * physicsSufficiency.gaps.length;
    totalPenalty = totalPenalty + penalty;
    collapseFactors.push("method_capability_gaps (" + physicsSufficiency.gaps.length + " gaps, -" + (penalty * 100).toFixed(0) + "%)");
  }

  // Contradictions
  if (contradictions.length > 0) {
    var cPenalty = 0.08 * contradictions.length;
    totalPenalty = totalPenalty + cPenalty;
    collapseFactors.push("evidence_contradictions (" + contradictions.length + " conflicts, -" + (cPenalty * 100).toFixed(0) + "%)");
  }

  // Blind spots
  if (blindSpots.length > 0) {
    var bPenalty = 0.04 * blindSpots.length;
    totalPenalty = totalPenalty + bPenalty;
    collapseFactors.push("coverage_blind_spots (" + blindSpots.length + " gaps, -" + (bPenalty * 100).toFixed(0) + "%)");
  }

  // Single method only
  if (containsAny(lower(JSON.stringify(caseData)), ["single_method", "vt_only", "one_method"])) {
    totalPenalty = totalPenalty + 0.10;
    collapseFactors.push("single_method_only (-10%)");
  }

  var adjusted = Math.max(0, Math.round((originalConfidence - totalPenalty) * 1000) / 1000);
  var holdTriggered = adjusted < 0.50 || (contradictions.length > 0 && adjusted < 0.65);

  return {
    original_confidence: originalConfidence,
    adjusted_confidence: adjusted,
    collapse_factors: collapseFactors,
    hold_triggered: holdTriggered
  };
}


// =====================================================================
// CONCEPT ENGINE 11: DECISION BOUNDARY
// Is the case near an accept/reject threshold?
// =====================================================================

function runDecisionBoundary(caseData) {
  var state = "stable";
  var reason = "Decision is well within acceptance margins";
  var criticalVars = [];

  // Check thickness margin
  var tNom = caseData.nominal_thickness || caseData.thickness_nominal || 0;
  var tMeas = caseData.measured_thickness || caseData.thickness_measured || 0;
  var tMin = caseData.minimum_thickness || caseData.tmin || 0;

  if (tMeas > 0 && tMin > 0) {
    var margin = (tMeas - tMin) / tMin;
    if (margin < 0) {
      state = "cliff_edge";
      reason = "Measured thickness is BELOW minimum — already past the boundary";
      criticalVars.push("measured_thickness");
    } else if (margin < 0.10) {
      state = "unstable_boundary";
      reason = "Measured thickness is within 10% of minimum — measurement uncertainty may straddle the limit";
      criticalVars.push("measured_thickness");
      criticalVars.push("measurement_uncertainty");
    }
  }

  // Check confidence boundary
  var conf = caseData.confidence_score || 0;
  if (conf > 0 && conf < 0.65) {
    if (state !== "cliff_edge") state = "unstable_boundary";
    reason = reason + ". Confidence score is borderline (" + conf + ")";
    criticalVars.push("confidence_score");
  }

  // Check risk score boundary
  var risk = caseData.risk_score || 0;
  if (risk >= 0.68 && risk <= 0.78) {
    if (state === "stable") state = "provisional";
    reason = reason + ". Risk score (" + risk + ") sits near accept/reject threshold";
    criticalVars.push("risk_score");
  }

  return {
    state: state,
    reason: reason,
    critical_variables: criticalVars
  };
}


// =====================================================================
// CONCEPT ENGINE 12: CAUSAL ROOT
// What likely caused the observed condition?
// =====================================================================

function runCausalRoot(caseData, findings) {
  var haystack = buildHaystack(caseData, findings);
  var hypotheses = [];

  if (containsAny(haystack, ["corrosion", "thinning", "wall_loss", "pitting"])) {
    hypotheses.push({ cause: "Process environment — corrosive species in service fluid", confidence: 0.70, evidence_basis: ["corrosion_indicators_in_findings"] });
    hypotheses.push({ cause: "External environment — weather, insulation, soil, splash zone", confidence: 0.55, evidence_basis: ["external_exposure_context"] });
    hypotheses.push({ cause: "Inhibitor or coating failure — protection system degraded", confidence: 0.45, evidence_basis: ["coating_or_chemical_treatment_status"] });
  }

  if (containsAny(haystack, ["crack", "fatigue", "vibration"])) {
    hypotheses.push({ cause: "Cyclic loading — mechanical or thermal fatigue", confidence: 0.75, evidence_basis: ["crack_morphology", "loading_history"] });
    hypotheses.push({ cause: "Design deficiency — inadequate fatigue detail category", confidence: 0.50, evidence_basis: ["weld_detail_classification"] });
    hypotheses.push({ cause: "Fabrication defect — poor weld profile or undercut acting as crack initiator", confidence: 0.45, evidence_basis: ["weld_quality_records"] });
  }

  if (containsAny(haystack, ["wrong_material", "material_mismatch", "pmi_fail"])) {
    hypotheses.push({ cause: "Supply chain error — incorrect material installed", confidence: 0.85, evidence_basis: ["pmi_results", "material_certificates"] });
  }

  if (containsAny(haystack, ["hard_weld", "hardness_above", "high_hardness"])) {
    hypotheses.push({ cause: "Welding process deviation — excessive cooling rate or incorrect preheat", confidence: 0.70, evidence_basis: ["hardness_values", "wps_records"] });
  }

  // Sort by confidence
  hypotheses.sort(function(a, b) { return b.confidence - a.confidence; });

  return hypotheses.slice(0, 5);
}


// =====================================================================
// HAYSTACK BUILDER — Aggregates all text for keyword matching
// =====================================================================

function buildHaystack(caseData, findings) {
  var parts = [];

  // Case-level fields
  var textFields = [
    "transcript", "narrative", "description", "summary", "notes",
    "title", "inspector_notes", "observations", "remarks", "background",
    "context", "history", "asset_description", "inspection_context",
    "material_class", "material_family", "component_name", "component_type",
    "service_type", "environment", "industry_vertical",
    "final_decision", "final_decision_reason", "status",
    "code_compliance_status"
  ];

  for (var ti = 0; ti < textFields.length; ti++) {
    var val = caseData[textFields[ti]];
    if (typeof val === "string" && val.length > 0) parts.push(val);
  }

  // Finding-level fields
  for (var fi = 0; fi < findings.length; fi++) {
    var f = findings[fi];
    if (f.indication_type) parts.push(f.indication_type);
    if (f.type) parts.push(f.type);
    if (f.finding_type) parts.push(f.finding_type);
    if (f.notes) parts.push(f.notes);
    if (f.method) parts.push(f.method);
    if (f.ndt_method) parts.push(f.ndt_method);
    if (f.recommended_action) parts.push(f.recommended_action);
    if (f.location) parts.push(f.location);
    if (f.severity) parts.push(f.severity);
  }

  return lower(parts.join(" "));
}


// =====================================================================
// NARRATIVE BUILDER — Human-readable audit explanation
// =====================================================================

function buildNarrative(constraintResult, propagationResult, contradictions, blindSpots, confidence, stability, pathways) {
  var shortParts = [];
  var fullParts = [];

  fullParts.push("Concept Intelligence Core v2.0.0 analysis complete.");

  // Governing constraint
  if (constraintResult.governing) {
    shortParts.push("Governing: " + constraintResult.governing.constraint);
    fullParts.push("GOVERNING CONSTRAINT: " + constraintResult.governing.summary + " (score: " + constraintResult.governing.score + ").");
  }

  // Propagation
  if (propagationResult.chains_triggered > 0) {
    shortParts.push(propagationResult.chains_triggered + " mechanism chain(s) triggered");
    fullParts.push("MECHANISM CHAINS: " + propagationResult.chains_triggered + " chain(s) triggered out of " + propagationResult.chains_evaluated + " evaluated.");
    for (var ci = 0; ci < propagationResult.triggered.length && ci < 3; ci++) {
      fullParts.push("  - " + propagationResult.triggered[ci].chain_name + ": " + propagationResult.triggered[ci].physics_basis);
    }
  }

  // Contradictions
  if (contradictions.length > 0) {
    shortParts.push(contradictions.length + " contradiction(s)");
    fullParts.push("CONTRADICTIONS: " + contradictions.length + " evidence conflict(s) require resolution.");
  }

  // Blind spots
  if (blindSpots.length > 0) {
    shortParts.push(blindSpots.length + " blind spot(s)");
    fullParts.push("BLIND SPOTS: " + blindSpots.length + " coverage gap(s) identified.");
  }

  // Confidence
  if (confidence.collapse_factors.length > 0) {
    shortParts.push("confidence adjusted from " + confidence.original_confidence + " to " + confidence.adjusted_confidence);
    fullParts.push("CONFIDENCE: Adjusted from " + confidence.original_confidence + " to " + confidence.adjusted_confidence + " due to: " + confidence.collapse_factors.join("; ") + ".");
  }

  // Stability
  if (stability.state !== "stable") {
    shortParts.push("decision " + stability.state);
    fullParts.push("DECISION STABILITY: " + stability.state + " — " + stability.reason);
  }

  // Pathways
  if (pathways.length > 0) {
    fullParts.push("FAILURE PATHWAYS: " + pathways.length + " plausible failure pathway(s) identified if findings are not addressed.");
  }

  return {
    short: shortParts.length > 0 ? shortParts.join(" | ") : "No major escalations detected — case appears stable",
    full: fullParts.join(" ")
  };
}


// =====================================================================
// RECOMMENDED STATE FLAGS
// =====================================================================

function buildRecommendedState(contradictions, confidence, stability, physicsSufficiency) {
  var state = {
    allow_final_disposition: true,
    hold_for_input: false,
    requires_engineering_review: false,
    requires_method_escalation: false
  };

  if (contradictions.length > 0) {
    state.allow_final_disposition = false;
    state.hold_for_input = true;
  }

  if (confidence.hold_triggered) {
    state.allow_final_disposition = false;
    state.hold_for_input = true;
  }

  if (stability.state === "cliff_edge") {
    state.allow_final_disposition = false;
    state.requires_engineering_review = true;
  }

  if (stability.state === "unstable_boundary") {
    state.requires_engineering_review = true;
  }

  if (physicsSufficiency.requires_method_escalation) {
    state.requires_method_escalation = true;
  }

  return state;
}


// =====================================================================
// MAIN HANDLER
// =====================================================================

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";

    // ── get_registry ──
    if (action === "get_registry") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "concept-intelligence-core",
          deploy: "DEPLOY252",
          version: ENGINE_VERSION,
          concept_engines: [
            { key: "constraint_dominance", family: "governing_reality", deterministic: true },
            { key: "physics_sufficiency", family: "governing_reality", deterministic: true },
            { key: "mechanism_propagation", family: "propagation_reality", deterministic: true },
            { key: "mechanism_interaction", family: "propagation_reality", deterministic: true },
            { key: "contradiction_detection", family: "uncertainty_reality", deterministic: true },
            { key: "blind_spot_detection", family: "uncertainty_reality", deterministic: true },
            { key: "information_gain", family: "action_reality", deterministic: true },
            { key: "failure_pathway", family: "propagation_reality", deterministic: true },
            { key: "parallel_reality", family: "action_reality", deterministic: true },
            { key: "confidence_collapse", family: "uncertainty_reality", deterministic: true },
            { key: "decision_boundary", family: "governing_reality", deterministic: true },
            { key: "causal_root", family: "origin_reality", deterministic: false }
          ],
          mechanism_chains: MECHANISM_CHAINS.length,
          method_capabilities: Object.keys(METHOD_CAPABILITIES).length,
          chain_categories: ["mechanism_cascade", "cross_method_triggering", "code_enforcement_chain", "mechanism_interaction", "environmental_event", "asset_propagation", "human_process_intelligence", "consequence_chain", "adaptive_planning"],
          philosophy: "Encoding experienced inspector instinct as deterministic system behavior. If I see X, always check Y. The system thinks like a senior inspector — flags what is missing, what contradicts, what propagates, and what fails if ignored."
        })
      };
    }

    var sb = createClient(supabaseUrl, supabaseKey);

    // ── get_chains ── Browse the mechanism chain database
    if (action === "get_chains") {
      var filterCategory = body.category || null;
      var chains = [];
      for (var gci = 0; gci < MECHANISM_CHAINS.length; gci++) {
        if (!filterCategory || MECHANISM_CHAINS[gci].category === filterCategory) {
          chains.push({
            id: MECHANISM_CHAINS[gci].id,
            category: MECHANISM_CHAINS[gci].category,
            name: MECHANISM_CHAINS[gci].name,
            primary_trigger: MECHANISM_CHAINS[gci].primary_trigger,
            secondary_risk_count: MECHANISM_CHAINS[gci].secondary_risks.length,
            action_count: MECHANISM_CHAINS[gci].recommended_actions.length
          });
        }
      }
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "get_chains",
          filter_category: filterCategory,
          total_chains: MECHANISM_CHAINS.length,
          returned: chains.length,
          chains: chains
        })
      };
    }

    // ── get_chain_for ── Get chains triggered by a specific finding/keyword
    if (action === "get_chain_for") {
      var keyword = lower(body.keyword || body.finding || "");
      if (!keyword) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "keyword or finding required" }) };
      }
      var matched = [];
      for (var ki = 0; ki < MECHANISM_CHAINS.length; ki++) {
        var chain = MECHANISM_CHAINS[ki];
        for (var kti = 0; kti < chain.primary_trigger.length; kti++) {
          if (lower(chain.primary_trigger[kti]).indexOf(keyword) !== -1 || keyword.indexOf(lower(chain.primary_trigger[kti])) !== -1) {
            matched.push(chain);
            break;
          }
        }
      }
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "get_chain_for",
          keyword: keyword,
          matched_chains: matched.length,
          chains: matched
        })
      };
    }

    // ── analyze_case ── Full concept intelligence pack
    if (action === "analyze_case") {
      var caseId = body.case_id;
      if (!caseId) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };

      // Load case
      var caseQ = await sb.from("inspection_cases").select("*").eq("id", caseId).single();
      if (caseQ.error || !caseQ.data) {
        return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "case_not_found" }) };
      }
      var caseData = caseQ.data;

      // Load findings
      var findQ = await sb.from("findings").select("*").eq("case_id", caseId);
      var findings = findQ.data || [];

      // Load evidence
      var evidQ = await sb.from("evidence").select("*").eq("case_id", caseId);
      var evidence = evidQ.data || [];

      // Run all 12 concept engines
      var constraintResult = runConstraintDominance(caseData, findings, evidence);
      var physicsResult = runPhysicsSufficiency(caseData, findings);
      var propagationResult = runMechanismPropagation(caseData, findings);
      var interactionResult = runMechanismInteraction(caseData, findings);
      var contradictionResult = runContradictionDetection(caseData, findings);
      var blindSpotResult = runBlindSpotDetection(caseData, findings);
      var infoGainResult = runInformationGain(physicsResult.gaps, blindSpotResult.blind_spots, propagationResult.triggered);
      var pathwayResult = runFailurePathway(caseData, findings, propagationResult.triggered);
      var parallelResult = runParallelReality(caseData, pathwayResult);
      var confidenceResult = runConfidenceCollapse(caseData, physicsResult, contradictionResult.contradictions, blindSpotResult.blind_spots);
      var boundaryResult = runDecisionBoundary(caseData);
      var causalResult = runCausalRoot(caseData, findings);

      var narrative = buildNarrative(constraintResult, propagationResult, contradictionResult.contradictions, blindSpotResult.blind_spots, confidenceResult, boundaryResult, pathwayResult);
      var recommendedState = buildRecommendedState(contradictionResult.contradictions, confidenceResult, boundaryResult, physicsResult);

      // Build active concepts list
      var activeConcepts = [];
      if (constraintResult.governing) {
        activeConcepts.push({ key: "constraint_dominance", family: "governing_reality", score: constraintResult.governing.score, summary: constraintResult.governing.summary });
      }
      if (!physicsResult.sufficient) {
        activeConcepts.push({ key: "physics_sufficiency", family: "governing_reality", score: 0.85, summary: physicsResult.gaps.length + " method capability gap(s) identified" });
      }
      if (propagationResult.chains_triggered > 0) {
        activeConcepts.push({ key: "mechanism_propagation", family: "propagation_reality", score: 0.80, summary: propagationResult.chains_triggered + " mechanism chain(s) triggered" });
      }
      if (interactionResult.interactions.length > 0) {
        activeConcepts.push({ key: "mechanism_interaction", family: "propagation_reality", score: 0.82, summary: interactionResult.interactions.length + " mechanism interaction(s) detected" });
      }
      if (contradictionResult.contradictions.length > 0) {
        activeConcepts.push({ key: "contradiction_detection", family: "uncertainty_reality", score: 0.88, summary: contradictionResult.contradictions.length + " contradiction(s) found" });
      }
      if (blindSpotResult.blind_spots.length > 0) {
        activeConcepts.push({ key: "blind_spot_detection", family: "uncertainty_reality", score: 0.75, summary: blindSpotResult.blind_spots.length + " blind spot(s) identified" });
      }
      if (confidenceResult.collapse_factors.length > 0) {
        activeConcepts.push({ key: "confidence_collapse", family: "uncertainty_reality", score: 0.85, summary: "Confidence adjusted from " + confidenceResult.original_confidence + " to " + confidenceResult.adjusted_confidence });
      }
      if (boundaryResult.state !== "stable") {
        activeConcepts.push({ key: "decision_boundary", family: "governing_reality", score: 0.83, summary: "Decision stability: " + boundaryResult.state });
      }

      // Build propagation flags for output
      var propagationFlags = [];
      for (var pi = 0; pi < propagationResult.triggered.length; pi++) {
        var t = propagationResult.triggered[pi];
        for (var si = 0; si < t.secondary_risks.length; si++) {
          var sr = t.secondary_risks[si];
          propagationFlags.push({
            flag: sr.mechanism,
            triggered_by: [t.chain_name],
            severity: sr.severity,
            probability: sr.probability,
            basis: sr.basis,
            recommended_follow_up: t.recommended_actions,
            scope_expansion: t.scope_expansion
          });
        }
      }

      // Build output pack
      var output = {
        concept_pack_id: null,
        case_id: caseId,
        engine_version: ENGINE_VERSION,
        governing_concept: constraintResult.governing ? {
          key: constraintResult.governing.constraint,
          family: constraintResult.governing.family,
          score: constraintResult.governing.score,
          summary: constraintResult.governing.summary
        } : null,
        active_concepts: activeConcepts,
        propagation_flags: propagationFlags,
        interaction_flags: interactionResult.interactions,
        contradictions: contradictionResult.contradictions,
        blind_spots: blindSpotResult.blind_spots,
        information_gain_actions: infoGainResult,
        failure_pathways: pathwayResult,
        parallel_realities: parallelResult,
        confidence_adjustment: confidenceResult,
        decision_stability: boundaryResult,
        root_cause_hypotheses: causalResult,
        audit_narrative: narrative,
        recommended_state: recommendedState,
        chain_summary: {
          chains_evaluated: propagationResult.chains_evaluated,
          chains_triggered: propagationResult.chains_triggered,
          total_secondary_risks: propagationFlags.length,
          total_recommended_actions: infoGainResult.length
        }
      };

      // Persist to concept_runs if table exists
      try {
        var orgId = caseData.org_id || caseData.user_id || "default";
        var runInsert = await sb.from("concept_runs").insert({
          case_id: caseId,
          org_id: orgId,
          governing_concept: output.governing_concept ? output.governing_concept.key : null,
          output_json: output,
          engine_version: ENGINE_VERSION
        }).select().single();

        if (!runInsert.error && runInsert.data) {
          output.concept_pack_id = runInsert.data.id;
        }
      } catch (persistErr) {
        // Non-fatal — concept_runs table may not exist yet
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "analyze_case",
          success: true,
          output: output
        })
      };
    }

    // ── validate_rules ──
    if (action === "validate_rules") {
      var issues = [];

      // Validate chain database integrity
      for (var vi = 0; vi < MECHANISM_CHAINS.length; vi++) {
        var vc = MECHANISM_CHAINS[vi];
        if (!vc.id) issues.push({ chain_index: vi, issue: "Missing chain id" });
        if (!vc.primary_trigger || vc.primary_trigger.length === 0) issues.push({ chain_id: vc.id, issue: "Empty primary_trigger" });
        if (!vc.secondary_risks || vc.secondary_risks.length === 0) issues.push({ chain_id: vc.id, issue: "No secondary_risks defined" });
        if (!vc.recommended_actions || vc.recommended_actions.length === 0) issues.push({ chain_id: vc.id, issue: "No recommended_actions" });
        if (!vc.physics_basis) issues.push({ chain_id: vc.id, issue: "Missing physics_basis" });

        // Validate probability bounds
        for (var vsi = 0; vsi < (vc.secondary_risks || []).length; vsi++) {
          var vsr = vc.secondary_risks[vsi];
          if (vsr.probability < 0 || vsr.probability > 1) {
            issues.push({ chain_id: vc.id, risk: vsr.mechanism, issue: "Probability out of bounds: " + vsr.probability });
          }
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "validate_rules",
          engine: "concept-intelligence-core",
          version: ENGINE_VERSION,
          total_chains: MECHANISM_CHAINS.length,
          valid: issues.length === 0,
          issues: issues
        })
      };
    }

    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Unknown action: " + action,
        valid_actions: ["get_registry", "analyze_case", "get_chains", "get_chain_for", "validate_rules"]
      })
    };

  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
