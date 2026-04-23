// @ts-nocheck
/**
 * DEPLOY299 - refinery-mechanism-authority.ts
 * netlify/functions/refinery-mechanism-authority.ts
 *
 * REFINERY MECHANISM AUTHORITY — PHYSICS-FIRST DAMAGE MECHANISMS
 *
 * Deep refinery/chemical plant damage mechanism knowledge base.
 * 20 mechanisms with physics-based screening, material susceptibility,
 * prerequisite conditions, failure modes, recommended NDT methods,
 * code triggers, and Klein bottle interaction effects.
 *
 * Key mechanisms with real engineering depth:
 * - HTHA with API 941 Nelson curve screening logic
 * - CUI with moisture/temperature susceptibility profiles
 * - Sulfidation with modified McConomy curve temperature bands
 * - Amine SCC with lean/rich amine distinction
 * - SSC/HIC with NACE MR0175 hardness thresholds
 * - Naphthenic acid with TAN/temperature correlation
 * - Creep with Larson-Miller parameter concept
 * - Chloride SCC with austenitic stainless threshold
 *
 * POST /api/refinery-mechanism-authority
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var ENGINE_ID = "refinery-mechanism-authority";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY299";
var corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };

// ============================================================
// REFINERY DAMAGE MECHANISM KNOWLEDGE BASE
// ============================================================

var MECHANISMS = {
  htha: {
    name: "High Temperature Hydrogen Attack",
    family: "hydrogen_damage",
    api_571_ref: "5.1.3.1",
    physics: "Atomic hydrogen diffuses into steel at elevated temperature and pressure. Reacts with carbon in steel to form methane (CH4). Methane cannot diffuse out — accumulates at grain boundaries causing decarburization, fissuring, and eventual cracking. Damage is internal and irreversible.",
    prerequisites: ["hydrogen_partial_pressure_above_50_psia", "temperature_above_400F_for_carbon_steel", "carbon_or_low_alloy_steel", "time_at_temperature"],
    susceptible_materials: ["carbon_steel", "C-0.5Mo", "1Cr-0.5Mo", "1.25Cr-0.5Mo"],
    resistant_materials: ["2.25Cr-1Mo", "2.25Cr-1Mo-V", "3Cr-1Mo", "stainless_steel_300_series", "Cr-Mo_steels_above_2.25Cr"],
    nelson_curve_screening: { carbon_steel_limit_F: 400, c_half_mo_limit_F: 500, one_cr_limit_F: 550, two_quarter_cr_limit_F: 700, note: "API 941 Nelson curves define safe operating envelopes. C-0.5Mo has been removed from some curves due to unreliable performance." },
    failure_modes: ["internal_decarburization", "grain_boundary_fissuring", "through_wall_cracking", "catastrophic_brittle_rupture"],
    ndt_methods: { primary: ["advanced_ut", "tofd", "paut"], confirmatory: ["replica_metallography"], screening: ["ut_thickness", "hardness_testing"], insufficient: ["vt", "mt", "pt"] },
    code_triggers: ["api_941", "api_571", "api_579", "api_510"],
    severity_weight: 0.95,
    consequence: "Catastrophic — HTHA can cause sudden brittle rupture without warning. Loss of containment of hydrogen at high temperature results in immediate fire/explosion.",
    downstream_effects: ["decarburization_reduces_strength", "fissuring_reduces_toughness", "wall_integrity_compromised", "leak_before_break_not_assured"],
    key_insight: "HTHA is invisible to conventional UT thickness measurement. Advanced UT with velocity ratio, backscatter, or spectral analysis is required. Replica metallography is the gold standard for confirmation."
  },
  cui: {
    name: "Corrosion Under Insulation",
    family: "external_corrosion",
    api_571_ref: "5.1.1.3",
    physics: "Moisture penetrates insulation through damaged jacketing, caulking failures, or vapor barrier breaches. Trapped moisture on steel surface creates continuous wet corrosion cell. Insulation prevents evaporation and hides damage from visual inspection. Temperature cycling pumps moisture in and prevents drying.",
    prerequisites: ["insulated_equipment", "moisture_source", "carbon_steel_or_low_alloy", "operating_temperature_25F_to_350F"],
    susceptible_materials: ["carbon_steel", "low_alloy_steel"],
    temperature_profile: { highest_risk_F: { min: 150, max: 250 }, moderate_risk_F: { min: 25, max: 150 }, lower_risk_F: { min: 250, max: 350 }, minimal_risk_above_F: 350, note: "Below 350F moisture remains liquid. Above 350F water evaporates. 150-250F is worst — warm enough for fast corrosion, not hot enough to dry." },
    failure_modes: ["external_wall_thinning", "pitting", "leak_under_insulation", "structural_support_failure"],
    ndt_methods: { primary: ["ut_thickness", "guided_wave_ut"], screening: ["thermography", "neutron_backscatter"], confirmatory: ["rt", "vt_after_insulation_removal"], insufficient: ["vt_without_removal", "mt", "pt"] },
    code_triggers: ["api_570", "api_510", "api_571", "api_579"],
    severity_weight: 0.75,
    consequence: "Loss of containment from hidden wall thinning. CUI is the number one cause of piping leaks in refineries.",
    hotspot_locations: ["pipe_supports", "dead_legs", "nozzles", "manways", "valve_bodies", "flange_pairs", "insulation_termination_points", "areas_of_damaged_jacketing", "steam_traced_lines"],
    downstream_effects: ["wall_thickness_unknown", "coating_condition_unknown", "corrosion_rate_unknown_without_trending"],
    key_insight: "CUI is the refinery Klein bottle problem — you cannot assess wall condition without removing insulation or using screening tools. Unknown wall condition means unknown remaining life means unknown risk."
  },
  sulfidation: {
    name: "Sulfidation (High-Temperature Sulfur Corrosion)",
    family: "high_temperature_corrosion",
    api_571_ref: "5.1.1.4",
    physics: "Sulfur compounds in process streams react with steel at elevated temperatures to form iron sulfide scale. Corrosion rate follows modified McConomy curves — exponential increase with temperature above 500F. Silicon content in steel dramatically affects resistance.",
    prerequisites: ["sulfur_compounds_present", "temperature_above_500F", "carbon_steel_or_low_alloy"],
    susceptible_materials: ["carbon_steel", "carbon_steel_low_silicon", "C-0.5Mo"],
    resistant_materials: ["5Cr-0.5Mo", "9Cr-1Mo", "12Cr", "stainless_steel_300_series", "high_silicon_carbon_steel"],
    temperature_bands: { below_500F: { rate: "negligible", note: "Sulfidation rate negligible below 500F" }, band_500_600F: { rate: "low", note: "Measurable but typically manageable" }, band_600_750F: { rate: "moderate", note: "Significant thinning rates — monitoring intervals must account for rate" }, above_750F: { rate: "high", note: "Aggressive thinning — Cr-Mo or stainless steel recommended" } },
    silicon_effect: "Carbon steel with Si > 0.10% has significantly better sulfidation resistance than low-Si steel. Material verification (PMI) is essential.",
    failure_modes: ["uniform_wall_thinning", "accelerated_thinning_at_hot_spots", "scale_buildup_masking_wall_loss"],
    ndt_methods: { primary: ["ut_thickness"], screening: ["rt"], confirmatory: ["pmi"], insufficient: ["vt_alone"] },
    code_triggers: ["api_571", "api_939_c", "api_579", "api_510", "api_570"],
    severity_weight: 0.80,
    consequence: "Loss of containment from wall thinning. Released hydrocarbon at high temperature ignites immediately.",
    downstream_effects: ["wall_thickness_reduced", "remaining_life_reduced", "corrosion_rate_data_needed_for_trending"],
    key_insight: "PMI is critical — one low-silicon carbon steel spool in a high-Cr circuit corrodes at 10x the rate of surrounding pipe. Single-point failures from wrong material."
  },
  chloride_scc: {
    name: "Chloride Stress Corrosion Cracking",
    family: "environmentally_assisted_cracking",
    api_571_ref: "5.1.2.3",
    physics: "Chloride ions attack the passive film on austenitic stainless steel in the presence of tensile stress and temperature. Cracking is transgranular, branching, and can propagate rapidly to failure. Threshold temperature approximately 140F (60C) for 300-series stainless.",
    prerequisites: ["austenitic_stainless_steel", "chloride_ions_present", "tensile_stress", "temperature_above_140F"],
    susceptible_materials: ["304_stainless", "316_stainless", "321_stainless", "347_stainless", "all_300_series"],
    resistant_materials: ["duplex_stainless", "super_duplex", "nickel_alloys", "carbon_steel_immune_to_cl_scc"],
    threshold: { temperature_F: 140, chloride_ppm: 10, note: "Below 140F risk is very low. Above 300F with >50 ppm Cl risk is high." },
    failure_modes: ["transgranular_branching_cracks", "rapid_crack_propagation", "sudden_leak_or_rupture"],
    ndt_methods: { primary: ["pt", "paut"], screening: ["vt_for_surface_cracks"], confirmatory: ["tofd", "rt"], insufficient: ["ut_thickness_alone"] },
    code_triggers: ["api_571", "api_579", "asme_b31_3", "api_570"],
    severity_weight: 0.85,
    consequence: "Rapid through-wall cracking possible. Leak before break not assured in some geometries.",
    downstream_effects: ["crack_growth_rate_unknown", "remaining_life_uncertain", "material_change_may_be_required"],
    key_insight: "Chloride SCC does not affect carbon steel — material selection is the primary defense. If you find branching cracks in stainless, chloride SCC is the first suspect."
  },
  ssc: {
    name: "Sulfide Stress Cracking",
    family: "hydrogen_damage",
    api_571_ref: "5.1.2.2",
    physics: "Hydrogen generated by wet H2S corrosion diffuses into steel. High-hardness microstructures (>22 HRC / 248 HV) are susceptible to sudden brittle cracking under applied or residual stress. NACE MR0175/ISO 15156 defines material requirements.",
    prerequisites: ["wet_h2s_environment", "high_hardness_material_or_weld", "tensile_stress"],
    susceptible_materials: ["carbon_steel_high_hardness", "low_alloy_steel_high_hardness", "non_NACE_compliant_materials"],
    hardness_limits: { nace_mr0175_HRC: 22, weld_HAZ_HV: 248, note: "Materials exceeding these limits are susceptible. PWHT required to reduce hardness." },
    failure_modes: ["sudden_brittle_cracking", "weld_HAZ_cracking", "bolt_cracking"],
    ndt_methods: { primary: ["mt", "pt", "hardness_testing"], confirmatory: ["paut", "tofd"], screening: ["vt"], insufficient: ["ut_thickness_alone"] },
    code_triggers: ["nace_mr0175", "api_571", "api_579"],
    severity_weight: 0.85,
    consequence: "Sudden brittle fracture without warning. Bolting and high-hardness welds are common failure points.",
    downstream_effects: ["material_compliance_verification_needed", "hardness_survey_required", "pwht_verification_needed"],
    key_insight: "SSC is a materials problem, not an inspection problem. If the material is NACE-compliant and properly heat-treated, SSC risk is low. Hardness testing is the critical verification."
  },
  hic: {
    name: "Hydrogen Induced Cracking",
    family: "hydrogen_damage",
    api_571_ref: "5.1.2.1",
    physics: "Atomic hydrogen from wet H2S corrosion diffuses into steel and recombines at inclusions (especially manganese sulfide stringers) to form molecular hydrogen. Pressure buildup creates internal blisters and stepwise cracking (HIC/SOHIC) that can link to form through-wall cracks.",
    prerequisites: ["wet_h2s_environment", "susceptible_steel_with_inclusions", "no_applied_stress_required_for_HIC"],
    susceptible_materials: ["carbon_steel_with_high_sulfur", "carbon_steel_with_banding", "non_HIC_resistant_plate"],
    resistant_materials: ["HIC_resistant_steel_per_NACE_TM0284", "low_sulfur_clean_steel", "clad_vessels"],
    failure_modes: ["internal_blistering", "stepwise_cracking", "SOHIC_at_welds", "through_wall_crack_linkage"],
    ndt_methods: { primary: ["paut", "tofd", "ut_shearwave"], screening: ["vt_for_surface_blisters"], confirmatory: ["advanced_ut"], insufficient: ["mt_alone", "pt_alone"] },
    code_triggers: ["nace_mr0175", "nace_tm0284", "api_571", "api_579"],
    severity_weight: 0.80,
    consequence: "Through-wall cracking from internal hydrogen damage. Surface blisters may be visible but subsurface stepwise cracking is the real threat.",
    downstream_effects: ["internal_damage_state_unknown_without_ut", "wall_integrity_uncertain", "leak_risk_if_cracks_link"],
    key_insight: "HIC happens without applied stress — unlike SSC. Clean steel (low S, low inclusion content) is the prevention. PAUT/TOFD are required to map internal stepwise cracking."
  },
  amine_scc: {
    name: "Amine Stress Corrosion Cracking",
    family: "environmentally_assisted_cracking",
    api_571_ref: "5.1.2.4",
    physics: "Alkaline amine solutions attack carbon steel welds and HAZ, causing intergranular cracking. Lean amine (low acid gas loading) is more aggressive than rich amine. Non-PWHT welds are highly susceptible.",
    prerequisites: ["amine_service", "carbon_steel", "non_PWHT_welds_or_high_residual_stress"],
    susceptible_materials: ["carbon_steel", "carbon_steel_non_PWHT_welds"],
    lean_vs_rich: { lean_amine: { risk: "high", note: "Lean amine is more alkaline — higher SCC risk" }, rich_amine: { risk: "moderate", note: "Rich amine has lower pH — general corrosion more likely than SCC" } },
    failure_modes: ["intergranular_cracking_at_welds", "HAZ_cracking", "leak_at_weld_seam"],
    ndt_methods: { primary: ["wet_fluorescent_mpi", "paut"], screening: ["pt"], confirmatory: ["tofd"], insufficient: ["ut_thickness_alone"] },
    code_triggers: ["api_571", "api_945", "api_579", "api_570"],
    severity_weight: 0.80,
    consequence: "Cracking at welds leading to loss of containment of amine solution.",
    downstream_effects: ["weld_integrity_uncertain", "pwht_verification_needed", "inspection_of_all_welds_in_amine_circuit"],
    key_insight: "PWHT is the defense against amine SCC. API 945 requires PWHT for carbon steel in amine service. If PWHT status is unknown, assume susceptible."
  },
  caustic_scc: {
    name: "Caustic Stress Corrosion Cracking",
    family: "environmentally_assisted_cracking",
    api_571_ref: "5.1.2.5",
    physics: "Concentrated caustic solutions attack carbon steel grain boundaries under tensile stress, causing intergranular cracking. Risk increases sharply above 150F. Caustic concentration can occur through evaporation even in dilute systems.",
    prerequisites: ["caustic_environment", "carbon_steel", "temperature_above_150F", "tensile_stress"],
    susceptible_materials: ["carbon_steel", "low_alloy_steel"],
    temperature_concentration_curve: { below_150F: "low_risk", range_150_200F: "moderate_risk_above_5_percent_NaOH", above_200F: "high_risk_even_at_low_concentration", note: "API 945 caustic service chart defines PWHT requirements by temperature and concentration." },
    failure_modes: ["intergranular_cracking", "weld_HAZ_cracking", "caustic_gouging_under_deposits"],
    ndt_methods: { primary: ["wet_fluorescent_mpi", "pt"], screening: ["vt"], confirmatory: ["paut"], insufficient: ["ut_thickness_alone"] },
    code_triggers: ["api_571", "api_945", "api_579"],
    severity_weight: 0.75,
    consequence: "Cracking and loss of containment of caustic solution.",
    downstream_effects: ["weld_integrity_verification_needed", "pwht_status_critical"],
    key_insight: "Caustic concentration through evaporation is a hidden trigger — dilute caustic can concentrate at hot surfaces to cracking thresholds."
  },
  creep: {
    name: "Creep Damage",
    family: "high_temperature_degradation",
    api_571_ref: "5.1.3.2",
    physics: "Time-dependent deformation and damage accumulation at elevated temperature under sustained stress. Progresses through three stages: primary (decelerating), secondary (steady-state), tertiary (accelerating to rupture). Larson-Miller parameter relates temperature, time, and stress to remaining life.",
    prerequisites: ["temperature_above_creep_threshold", "sustained_stress", "long_service_time"],
    creep_thresholds_F: { carbon_steel: 700, c_half_mo: 750, one_cr: 800, two_quarter_cr: 850, stainless_304: 1000, note: "Creep becomes significant above these temperatures for each material." },
    susceptible_materials: ["carbon_steel", "low_alloy_steel", "austenitic_stainless"],
    failure_modes: ["creep_voids", "grain_boundary_cavitation", "macrocracking", "stress_rupture"],
    ndt_methods: { primary: ["replica_metallography"], screening: ["hardness_testing", "dimensional_measurement"], confirmatory: ["advanced_ut"], insufficient: ["vt_alone", "ut_thickness_alone"] },
    code_triggers: ["api_571", "api_579", "api_530"],
    severity_weight: 0.85,
    consequence: "Progressive damage leading to rupture. Fired heater tubes and high-temperature vessels are primary concerns.",
    downstream_effects: ["remaining_life_calculation_required", "material_condition_degrading_with_time", "inspection_interval_must_account_for_creep_rate"],
    key_insight: "Replica metallography is the only field method that can classify creep damage stage. Hardness may decrease as creep progresses. Dimensional changes (bulging) indicate advanced creep."
  },
  naphthenic_acid_corrosion: {
    name: "Naphthenic Acid Corrosion",
    family: "high_temperature_corrosion",
    api_571_ref: "5.1.1.5",
    physics: "Naphthenic acids in crude oil attack steel at elevated temperatures (430-750F). Corrosion rate correlates with Total Acid Number (TAN) and temperature but is also influenced by sulfur content, velocity, and turbulence. Above 750F acids decompose and corrosion stops.",
    prerequisites: ["naphthenic_acid_present_TAN_above_0_5", "temperature_430_to_750F", "susceptible_material"],
    susceptible_materials: ["carbon_steel", "low_alloy_steel", "standard_stainless_316"],
    resistant_materials: ["317L_stainless", "alloy_625", "alloy_825", "high_Mo_alloys"],
    tan_temperature_correlation: { low_risk: "TAN < 0.5 or temp < 430F", moderate_risk: "TAN 0.5-1.0 and temp 430-650F", high_risk: "TAN > 1.0 and temp 500-750F", note: "Sulfur can inhibit naphthenic acid corrosion at some conditions — NAC/sulfidation interaction is complex." },
    failure_modes: ["localized_thinning", "grooving_at_turbulent_areas", "transfer_line_failures"],
    ndt_methods: { primary: ["ut_thickness"], screening: ["rt"], confirmatory: ["laser_scan"], insufficient: ["vt_alone"] },
    code_triggers: ["api_571", "api_579", "api_570"],
    severity_weight: 0.80,
    consequence: "Rapid localized thinning leading to loss of containment of hot hydrocarbons.",
    downstream_effects: ["wall_thickness_monitoring_critical", "corrosion_rate_data_essential", "crude_quality_changes_affect_rate"],
    key_insight: "Crude quality changes can dramatically shift naphthenic acid corrosion rates. A refinery that has never seen NAC may suddenly experience it with a crude switch."
  },
  erosion_corrosion: {
    name: "Erosion-Corrosion",
    family: "flow_assisted_degradation",
    api_571_ref: "5.1.1.8",
    physics: "Fluid flow removes protective corrosion product film, exposing fresh metal to continued corrosion. Rate depends on velocity, turbulence, particle content, fluid chemistry, and material. Elbows, tees, reducers, and downstream of control valves are preferential locations.",
    prerequisites: ["high_velocity_or_turbulent_flow", "corrosive_fluid", "susceptible_geometry"],
    susceptible_materials: ["carbon_steel", "copper_alloys"],
    resistant_materials: ["stainless_steel", "high_alloy", "lined_pipe"],
    failure_modes: ["localized_thinning_at_flow_disturbances", "horseshoe_pattern_wall_loss", "elbow_blowout"],
    ndt_methods: { primary: ["ut_thickness"], screening: ["rt", "guided_wave_ut"], confirmatory: ["laser_scan", "paut"], insufficient: ["vt_alone"] },
    code_triggers: ["api_571", "api_579", "api_570"],
    severity_weight: 0.75,
    consequence: "Loss of containment at predictable locations — elbows and flow disturbances.",
    downstream_effects: ["wall_thickness_at_specific_locations_critical", "flow_modeling_may_predict_worst_locations"],
    key_insight: "Erosion-corrosion is predictable — it happens at elbows, tees, and downstream of restrictions. UT thickness surveys should target these locations specifically."
  },
  general_corrosion: { name: "General / Uniform Corrosion", family: "corrosion", api_571_ref: "5.1.1.1", physics: "Uniform electrochemical dissolution of metal surface in corrosive environment.", prerequisites: ["corrosive_environment", "susceptible_material"], susceptible_materials: ["carbon_steel", "low_alloy"], failure_modes: ["uniform_wall_thinning", "leak", "rupture_at_minimum_wall"], ndt_methods: { primary: ["ut_thickness"], screening: ["guided_wave_ut"], confirmatory: ["rt"], insufficient: ["vt_alone_for_quantification"] }, code_triggers: ["api_570", "api_510", "api_579"], severity_weight: 0.50, key_insight: "General corrosion is manageable if corrosion rate is known and monitored. The danger is when rate accelerates due to process change and previous trending becomes non-conservative." },
  pitting_corrosion: { name: "Pitting Corrosion", family: "corrosion", api_571_ref: "5.1.1.2", physics: "Localized electrochemical attack creating small-diameter deep pits. Pit depth can far exceed average wall loss.", prerequisites: ["chlorides_or_oxidizing_conditions", "stagnant_areas", "deposit_shielding"], susceptible_materials: ["stainless_steel", "carbon_steel", "aluminum"], failure_modes: ["pit_perforation", "leak", "stress_concentration_initiating_fatigue"], ndt_methods: { primary: ["ut_thickness", "paut"], screening: ["vt", "pt"], confirmatory: ["rt"], insufficient: ["single_point_ut_may_miss_pits"] }, code_triggers: ["api_571", "api_579"], severity_weight: 0.65, key_insight: "Pitting is dangerous because pit depth can be 10x average wall loss. Scanning UT or PAUT is needed — single-point UT readings miss pits." },
  mic: { name: "Microbiologically Influenced Corrosion", family: "corrosion", api_571_ref: "5.1.1.9", physics: "Bacteria (SRB, APB, IOB) create localized corrosive environments under biofilms. Can cause rapid pitting and under-deposit corrosion in stagnant water systems.", prerequisites: ["water_present", "stagnant_or_low_flow", "temperature_40_to_180F", "nutrients_available"], susceptible_materials: ["carbon_steel", "stainless_steel", "copper_alloys"], failure_modes: ["under_deposit_pitting", "rapid_localized_perforation"], ndt_methods: { primary: ["ut_thickness", "vt"], screening: ["biological_testing"], confirmatory: ["metallography"], insufficient: ["ut_alone_may_miss_localized_attack"] }, code_triggers: ["api_571"], severity_weight: 0.60, key_insight: "MIC is commonly found in idle equipment, dead legs, and water-containing systems. Systems that sit stagnant during shutdowns are highest risk." },
  fatigue: { name: "Mechanical / Thermal Fatigue", family: "cracking", api_571_ref: "5.1.2.8", physics: "Progressive cracking from cyclic stress. Initiates at stress concentrations (weld toes, notches, geometric transitions). Propagates with each cycle until critical crack size causes failure.", prerequisites: ["cyclic_loading", "stress_concentration", "sufficient_cycle_count"], susceptible_materials: ["all_metals"], failure_modes: ["fatigue_crack_initiation", "crack_propagation", "fracture"], ndt_methods: { primary: ["mt", "pt"], screening: ["vt"], confirmatory: ["paut", "tofd"], insufficient: ["ut_thickness_alone"] }, code_triggers: ["api_571", "api_579", "asme_viii"], severity_weight: 0.80, key_insight: "Fatigue cracks start at the surface at stress concentrations. MT and PT at weld toes and geometric transitions are the primary detection methods." },
  external_corrosion: { name: "Atmospheric / External Corrosion", family: "external_corrosion", api_571_ref: "5.1.1.6", physics: "Corrosion of external surfaces exposed to atmosphere, rain, marine environment, or process spills.", prerequisites: ["unprotected_external_surface", "moisture", "corrosive_atmosphere"], susceptible_materials: ["carbon_steel", "low_alloy_steel"], failure_modes: ["external_wall_thinning", "support_section_loss", "structural_failure"], ndt_methods: { primary: ["vt", "ut_thickness"], screening: ["coating_dft"], confirmatory: ["pit_gauge"], insufficient: ["remote_vt_alone"] }, code_triggers: ["api_571", "api_570", "api_510"], severity_weight: 0.50, key_insight: "External corrosion at pipe supports and structural connections is a safety issue — section loss can cause collapse." },
  under_deposit_corrosion: { name: "Under-Deposit Corrosion", family: "corrosion", api_571_ref: "5.1.1.7", physics: "Corrosion beneath deposits, scale, or fouling. Deposits create oxygen concentration cells and trap corrosive species.", prerequisites: ["deposits_or_fouling", "corrosive_process_fluid", "stagnant_areas"], susceptible_materials: ["carbon_steel", "stainless_steel"], failure_modes: ["localized_thinning_under_deposits", "pitting", "perforation"], ndt_methods: { primary: ["ut_thickness_after_cleaning"], screening: ["vt_for_deposit_location"], confirmatory: ["paut"], insufficient: ["ut_through_deposits"] }, code_triggers: ["api_571", "api_579"], severity_weight: 0.60, key_insight: "UT readings through deposits are unreliable. Surface must be cleaned before meaningful thickness measurement." },
  coating_breakdown: { name: "Protective Coating Breakdown", family: "coating_degradation", api_571_ref: "N/A", physics: "Coating system failure exposes substrate to corrosive environment. Predecessor to CUI, external corrosion, and CP failure.", prerequisites: ["coated_surface", "age_or_damage", "environmental_exposure"], susceptible_materials: ["all_coated_surfaces"], failure_modes: ["adhesion_loss", "blistering", "chalking", "cracking", "undercutting"], ndt_methods: { primary: ["vt", "coating_dft", "adhesion_testing"], screening: ["holiday_testing"], confirmatory: ["lab_analysis"], insufficient: ["remote_vt_at_distance"] }, code_triggers: ["sspc", "nace_coating_standards"], severity_weight: 0.45, key_insight: "Coating failure is the precursor to corrosion. In the Klein bottle, coating condition determines CP demand, which determines corrosion rate, which determines remaining life." },
  oxidation: { name: "High-Temperature Oxidation", family: "high_temperature_degradation", api_571_ref: "5.1.3.3", physics: "Formation of oxide scale on steel surface at elevated temperatures. Scale can be protective or non-protective depending on temperature, alloy, and environment.", prerequisites: ["high_temperature", "oxygen_present", "susceptible_material"], susceptible_materials: ["carbon_steel_above_900F", "low_alloy_above_1000F"], failure_modes: ["scale_formation", "wall_thinning", "scale_spalling"], ndt_methods: { primary: ["ut_thickness", "vt"], screening: ["dimensional_measurement"], confirmatory: ["metallography"], insufficient: ["none_specific"] }, code_triggers: ["api_571", "api_530"], severity_weight: 0.60, key_insight: "Oxide scale can mask true wall thickness — UT may read to the scale/metal interface but scale is not structural. Descaling before measurement improves accuracy." },
  carburization: { name: "Carburization / Metal Dusting", family: "high_temperature_degradation", api_571_ref: "5.1.3.4", physics: "Carbon absorption into steel at high temperature in carbonaceous environments. Increases hardness and reduces ductility. Metal dusting is catastrophic pitting form at 800-1100F in carbon-rich gas.", prerequisites: ["high_temperature", "carbon_rich_environment", "susceptible_material"], susceptible_materials: ["carbon_steel", "low_alloy", "stainless_steel_in_some_conditions"], failure_modes: ["embrittlement", "metal_dusting_pits", "catastrophic_localized_attack"], ndt_methods: { primary: ["hardness_testing", "metallography"], screening: ["vt_for_metal_dusting_pits"], confirmatory: ["advanced_ut"], insufficient: ["ut_thickness_alone"] }, code_triggers: ["api_571"], severity_weight: 0.70, key_insight: "Metal dusting causes rapid catastrophic pitting — a single pit can perforate a tube in weeks. Seen in reformer systems, syngas plants, and ethylene furnaces." }
};

// ============================================================
// CORE FUNCTIONS
// ============================================================

function screenMechanism(mechKey, input) {
  var mech = MECHANISMS[mechKey];
  if (!mech) return null;

  var probability = 0.20;
  var severity = mech.severity_weight;
  var confidence = 0.50;
  var triggers = [];
  var missingData = [];
  var screeningResult = "not_screened";

  var modifiers = input.mechanism_modifiers || {};
  if (modifiers[mechKey]) {
    probability = probability + modifiers[mechKey];
    triggers.push("process_condition_modifier: +" + modifiers[mechKey]);
  }

  var mat = (input.material_family || "").toLowerCase() + " " + (input.material_grade || "").toLowerCase();
  if (mech.susceptible_materials) {
    for (var s = 0; s < mech.susceptible_materials.length; s++) {
      if (mat.indexOf(mech.susceptible_materials[s].toLowerCase().replace(/_/g, " ")) >= 0 || mat.indexOf(mech.susceptible_materials[s].toLowerCase().replace(/_/g, "")) >= 0) {
        probability = probability + 0.10;
        triggers.push("material_susceptible: " + mech.susceptible_materials[s]);
        break;
      }
    }
  }
  if (mech.resistant_materials) {
    for (var r = 0; r < mech.resistant_materials.length; r++) {
      if (mat.indexOf(mech.resistant_materials[r].toLowerCase().replace(/_/g, " ")) >= 0) {
        probability = probability - 0.20;
        triggers.push("material_resistant: " + mech.resistant_materials[r]);
        break;
      }
    }
  }

  if (mechKey === "htha" && input.operating_temperature_F && input.hydrogen_partial_pressure_psia) {
    var temp = input.operating_temperature_F;
    var hpp = input.hydrogen_partial_pressure_psia;
    var limit = mech.nelson_curve_screening.carbon_steel_limit_F;
    if (mat.indexOf("2.25cr") >= 0 || mat.indexOf("2-1/4cr") >= 0) limit = mech.nelson_curve_screening.two_quarter_cr_limit_F;
    else if (mat.indexOf("1cr") >= 0 || mat.indexOf("1-1/4cr") >= 0) limit = mech.nelson_curve_screening.one_cr_limit_F;
    else if (mat.indexOf("c-0.5mo") >= 0 || mat.indexOf("c-half-mo") >= 0) limit = mech.nelson_curve_screening.c_half_mo_limit_F;

    if (temp > limit && hpp > 50) {
      probability = probability + 0.30;
      screeningResult = "ABOVE_NELSON_CURVE";
      triggers.push("nelson_curve_exceeded: temp " + temp + "F > limit " + limit + "F at " + hpp + " psia H2");
    } else if (temp > limit * 0.9) {
      probability = probability + 0.15;
      screeningResult = "NEAR_NELSON_CURVE";
      triggers.push("near_nelson_curve: within 10% of limit");
    } else {
      screeningResult = "BELOW_NELSON_CURVE";
    }
    if (!input.material_grade) missingData.push("material_grade_for_nelson_curve");
    if (!input.exposure_years) missingData.push("exposure_years_at_conditions");
  }

  if (mechKey === "cui" && input.operating_temperature_F) {
    var cuiTemp = input.operating_temperature_F;
    if (cuiTemp >= 150 && cuiTemp <= 250) { probability = probability + 0.25; screeningResult = "HIGHEST_CUI_RISK_ZONE"; triggers.push("cui_highest_risk_zone: 150-250F"); }
    else if (cuiTemp >= 25 && cuiTemp < 150) { probability = probability + 0.15; screeningResult = "MODERATE_CUI_RISK"; triggers.push("cui_moderate_zone: 25-150F"); }
    else if (cuiTemp > 250 && cuiTemp <= 350) { probability = probability + 0.10; screeningResult = "LOWER_CUI_RISK"; triggers.push("cui_lower_zone: 250-350F"); }
    else if (cuiTemp > 350) { probability = probability - 0.10; screeningResult = "MINIMAL_CUI_RISK"; triggers.push("cui_minimal: above 350F water evaporates"); }
    if (!input.insulation_condition) missingData.push("insulation_condition");
    if (!input.jacketing_condition) missingData.push("jacketing_condition");
  }

  if (mechKey === "sulfidation" && input.operating_temperature_F) {
    var sulTemp = input.operating_temperature_F;
    if (sulTemp > 750) { probability = probability + 0.25; screeningResult = "HIGH_SULFIDATION_RATE"; }
    else if (sulTemp > 600) { probability = probability + 0.15; screeningResult = "MODERATE_SULFIDATION"; }
    else if (sulTemp > 500) { probability = probability + 0.05; screeningResult = "LOW_SULFIDATION"; }
    else { probability = probability - 0.15; screeningResult = "NEGLIGIBLE_SULFIDATION"; }
    if (!input.silicon_content) missingData.push("silicon_content_for_sulfidation_resistance");
  }

  if (mechKey === "ssc") {
    if (input.hardness_HRC && input.hardness_HRC > 22) { probability = probability + 0.25; triggers.push("hardness_exceeds_NACE_limit: " + input.hardness_HRC + " HRC > 22 HRC"); screeningResult = "NON_NACE_COMPLIANT"; }
    else if (input.hardness_HRC && input.hardness_HRC <= 22) { probability = probability - 0.15; triggers.push("hardness_NACE_compliant: " + input.hardness_HRC + " HRC"); screeningResult = "NACE_COMPLIANT"; }
    if (!input.hardness_HRC) missingData.push("hardness_HRC");
    if (!input.pwht_status) missingData.push("pwht_status");
  }

  if (mechKey === "creep" && input.operating_temperature_F && input.material_family) {
    var creepLimit = mech.creep_thresholds_F[input.material_family] || mech.creep_thresholds_F.carbon_steel || 700;
    if (input.operating_temperature_F > creepLimit) { probability = probability + 0.20; screeningResult = "ABOVE_CREEP_THRESHOLD"; triggers.push("temperature_above_creep_threshold"); }
  }

  if (mechKey === "chloride_scc") {
    if (mat.indexOf("304") >= 0 || mat.indexOf("316") >= 0 || mat.indexOf("321") >= 0 || mat.indexOf("347") >= 0 || mat.indexOf("300") >= 0 || mat.indexOf("austenitic") >= 0) {
      probability = probability + 0.15;
      triggers.push("austenitic_stainless_susceptible");
    }
    if (input.operating_temperature_F && input.operating_temperature_F > 140) {
      probability = probability + 0.10;
      triggers.push("above_chloride_scc_threshold_140F");
    }
  }

  if (!input.material_family && !input.material_grade) { missingData.push("material_identification"); confidence = confidence - 0.15; }
  if (!input.operating_temperature_F) { missingData.push("operating_temperature"); confidence = confidence - 0.10; }

  probability = Math.max(0, Math.min(0.95, probability));
  confidence = Math.max(0.25, Math.min(0.95, confidence));

  return {
    mechanism_key: mechKey,
    mechanism_name: mech.name,
    family: mech.family,
    probability: Math.round(probability * 100) / 100,
    severity: severity,
    confidence: Math.round(confidence * 100) / 100,
    screening_result: screeningResult,
    triggers: triggers,
    missing_data: missingData,
    physics: mech.physics,
    failure_modes: mech.failure_modes,
    ndt_methods: mech.ndt_methods,
    code_triggers: mech.code_triggers,
    key_insight: mech.key_insight,
    downstream_effects: mech.downstream_effects || [],
    consequence: mech.consequence || ""
  };
}

function evaluateRefinery(input) {
  var activeMechanisms = input.active_mechanism_keys || Object.keys(MECHANISMS);
  var results = [];
  for (var i = 0; i < activeMechanisms.length; i++) {
    var result = screenMechanism(activeMechanisms[i], input);
    if (result && (result.probability >= 0.25 || (input.mechanism_modifiers && input.mechanism_modifiers[activeMechanisms[i]]))) {
      results.push(result);
    }
  }
  results.sort(function(a, b) { return (b.probability * b.severity) - (a.probability * a.severity); });

  var topRisk = 0;
  for (var j = 0; j < results.length; j++) {
    var risk = results[j].probability * results[j].severity;
    if (risk > topRisk) topRisk = risk;
  }

  return {
    active_mechanisms: results,
    mechanism_count: results.length,
    top_risk_score: Math.round(topRisk * 100) / 100,
    critical_mechanisms: results.filter(function(m) { return m.probability * m.severity >= 0.50; }).length,
    assumptions_for_mesh: {
      active_mechanisms: results.map(function(m) { return m.mechanism_key; }),
      material_condition: results.some(function(m) { return m.missing_data.indexOf("material_identification") >= 0; }) ? "unknown" : "identified",
      wall_thickness: results.some(function(m) { return m.mechanism_key === "cui" || m.mechanism_key === "sulfidation" || m.mechanism_key === "erosion_corrosion" || m.mechanism_key === "general_corrosion"; }) ? "thinning_mechanisms_active" : "no_thinning_expected"
    }
  };
}

// ============================================================
// HANDLER
// ============================================================

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };
  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";
    if (action === "get_registry") { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, deploy: DEPLOY, mode: "deterministic", purpose: "Refinery Mechanism Authority — 20 damage mechanisms with physics-first screening, Nelson curves, McConomy bands, NACE thresholds", mechanism_count: Object.keys(MECHANISMS).length, actions: ["evaluate_mechanisms", "screen_mechanism", "get_mechanism_database", "get_registry"] }) }; }
    if (action === "evaluate_mechanisms") {
      var evalResult = evaluateRefinery(body);
      try { var sb = createClient(supabaseUrl, supabaseKey); await sb.from("refinery_mechanism_assessments").insert({ org_id: body.org_id || null, case_id: body.case_id || null, asset_id: body.asset_id || null, mechanism_key: "multi_mechanism_evaluation", mechanism_name: "Full Refinery Mechanism Screening", probability: evalResult.top_risk_score, severity: null, confidence: null, screening_result: evalResult.critical_mechanisms + " critical of " + evalResult.mechanism_count + " active", result_json: evalResult }); } catch (e) {}
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: evalResult }, null, 2) };
    }
    if (action === "screen_mechanism") {
      var mechResult = screenMechanism(body.mechanism_key, body);
      if (!mechResult) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown mechanism: " + body.mechanism_key + ". Available: " + Object.keys(MECHANISMS).join(", ") }) };
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: mechResult }, null, 2) };
    }
    if (action === "get_mechanism_database") { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, mechanisms: MECHANISMS }, null, 2) }; }
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
  } catch (err) { return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) }; }
};
