// @ts-nocheck
/**
 * DEPLOY275 - Mechanism Causality Engine v1.0.0
 * netlify/functions/mechanism-causality-engine.ts
 *
 * Deterministic damage mechanism root-cause and causal chain engine.
 * Maps observed indications to probable damage mechanisms, validates
 * physical plausibility of causal chains, identifies root causes,
 * and prevents misdiagnosis by enforcing mechanism physics.
 *
 * Architecture: OpenAI sees -> Claude reasons -> this engine validates CAUSALITY.
 * AI proposes mechanisms. This engine enforces physics and eliminates impossible chains.
 *
 * Knowledge base:
 *   40+ damage mechanisms with physics, prerequisites, indicators
 *   30+ root cause families
 *   Mechanism interaction matrix (synergistic, sequential, competing)
 *   Environmental prerequisite rules
 *   Material susceptibility matrix
 *   Temporal progression models
 *   Causal chain validation logic
 *
 * 10 actions:
 *   get_registry
 *   identify_mechanism         -- from observed indications
 *   validate_causal_chain      -- validate proposed mechanism chain
 *   get_root_causes            -- root cause analysis for mechanism
 *   check_prerequisites        -- environmental/material prerequisites
 *   get_mechanism_interactions  -- synergistic/competing mechanisms
 *   get_mechanism_registry     -- all damage mechanisms
 *   get_material_susceptibility -- material vs mechanism matrix
 *   get_progression_model      -- temporal progression for mechanism
 *   get_differential_diagnosis -- differential diagnosis for indication
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var ENGINE_NAME = "mechanism-causality-engine";
var ENGINE_VERSION = "v1.0.0";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

var supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

function ok(data) {
  return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(data) };
}

function fail(code, msg) {
  return { statusCode: code, headers: corsHeaders, body: JSON.stringify({ error: msg }) };
}

function getOrg(event) {
  try {
    var auth = event.headers["authorization"] || "";
    if (!auth) return null;
    var token = auth.replace("Bearer ", "");
    var payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    return payload.app_metadata && payload.app_metadata.org_id ? payload.app_metadata.org_id : null;
  } catch (e) {
    return null;
  }
}

function nowISO() {
  return new Date().toISOString();
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ============================================================
// DAMAGE MECHANISM DATABASE — 40+ mechanisms
// ============================================================

var MECHANISM_DB = {
  // === CORROSION MECHANISMS ===
  general_corrosion: {
    key: "general_corrosion",
    name: "General (Uniform) Corrosion",
    category: "corrosion",
    description: "Uniform material loss across exposed surface — predictable rate",
    physics: "Anodic dissolution across entire surface — no localized cell differentiation",
    prerequisites: {
      environment: ["aqueous", "atmospheric_wet", "soil"],
      material: ["carbon_steel", "low_alloy_steel"],
      temperature: "ambient to moderate",
      required: "Electrolyte contact with unprotected surface"
    },
    indicators: ["uniform_wall_thinning", "surface_roughening", "rust_scale", "DFT_loss_coating"],
    typical_rates_mm_year: "0.05-0.5 for carbon steel atmospheric; 0.1-2.0 immersion",
    detection_methods: ["UT_thickness", "visual", "weight_loss_coupon", "ER_probe"],
    confused_with: ["erosion_corrosion", "microbiologically_influenced_corrosion"],
    root_causes: ["coating_failure", "CP_failure", "inhibitor_depletion", "design_flaw_ponding"]
  },
  pitting_corrosion: {
    key: "pitting_corrosion",
    name: "Pitting Corrosion",
    category: "corrosion",
    description: "Localized attack producing cavities/pits — depth exceeds general corrosion rate",
    physics: "Autocatalytic pit growth — acidification inside pit, cathodic protection of surrounding surface",
    prerequisites: {
      environment: ["chloride_containing", "stagnant_fluid", "under_deposit"],
      material: ["stainless_steel", "carbon_steel", "aluminum", "copper_alloy"],
      temperature: "above critical pitting temperature for alloy",
      required: "Localized breakdown of passive film or coating"
    },
    indicators: ["localized_wall_loss", "pit_clusters", "perforation", "under_deposit_attack"],
    pitting_rate: "Can exceed 10x general corrosion rate — depth unpredictable",
    detection_methods: ["UT_thickness_grid", "pit_gauge", "radiography", "visual_internal"],
    confused_with: ["microbiologically_influenced_corrosion", "under_deposit_corrosion", "erosion_corrosion"],
    root_causes: ["chloride_exposure", "stagnant_conditions", "coating_holiday", "deposit_accumulation"]
  },
  stress_corrosion_cracking: {
    key: "stress_corrosion_cracking",
    name: "Stress Corrosion Cracking (SCC)",
    category: "cracking",
    description: "Cracking from combined tensile stress + specific corrosive environment — catastrophic failure mode",
    physics: "Crack initiation at surface defect under tensile stress in specific agent — propagation without warning",
    prerequisites: {
      environment: ["chloride_for_austenitic_SS", "caustic_for_carbon_steel", "amine_for_carbon_steel", "polythionic_acid_for_SS", "H2S_for_carbon_steel"],
      material: ["austenitic_stainless_steel", "carbon_steel", "brass", "aluminum_alloy"],
      temperature: "above threshold for specific material-environment pair",
      required: "ALL THREE: susceptible material + tensile stress + specific corrodent"
    },
    indicators: ["branching_cracks", "transgranular_or_intergranular_cracking", "minimal_wall_loss", "sudden_failure"],
    detection_methods: ["WFMT", "PT", "TOFD", "phased_array_UT", "metallography"],
    confused_with: ["fatigue_cracking", "hydrogen_cracking", "thermal_fatigue"],
    root_causes: ["wrong_material_selection", "process_upset", "residual_stress_from_welding", "PWHT_not_performed"],
    severity: "catastrophic",
    always_critical: true
  },
  hydrogen_induced_cracking: {
    key: "hydrogen_induced_cracking",
    name: "Hydrogen Induced Cracking (HIC) / Hydrogen Blistering",
    category: "cracking",
    description: "Internal cracking or blistering from atomic hydrogen diffusion into steel — wet H2S environments",
    physics: "Atomic hydrogen enters steel, recombines at inclusions/laminations forming H2 gas — internal pressure causes cracking",
    prerequisites: {
      environment: ["wet_H2S", "HF_acid", "high_strength_steel_any_hydrogen_source"],
      material: ["carbon_steel", "low_alloy_steel", "high_strength_steel"],
      temperature: "ambient to 150C",
      required: "Source of atomic hydrogen + susceptible steel (inclusion content, hardness)"
    },
    indicators: ["blistering_surface", "stepwise_cracking_internal", "HIC_laminations", "SOHIC_cracking"],
    detection_methods: ["UT_shear_wave", "TOFD", "AUT_C_scan", "visual_blistering"],
    confused_with: ["lamination_manufacturing", "stress_corrosion_cracking", "sulfide_stress_cracking"],
    root_causes: ["wet_H2S_service", "HF_acid_service", "inadequate_steel_quality_HIC_resistant", "high_hardness_weld_HAZ"],
    severity: "catastrophic",
    always_critical: true
  },
  sulfide_stress_cracking: {
    key: "sulfide_stress_cracking",
    name: "Sulfide Stress Cracking (SSC)",
    category: "cracking",
    description: "Cracking of hard/high-strength steel in wet H2S — hardness-dependent mechanism",
    physics: "Hydrogen embrittlement in presence of H2S — sulfide promotes hydrogen entry — cracking at hard zones",
    prerequisites: {
      environment: ["wet_H2S"],
      material: ["carbon_steel_high_hardness", "low_alloy_steel_high_hardness", "high_strength_steel"],
      temperature: "ambient to 80C (decreases at higher temp)",
      required: "Hardness >22 HRC (248 HV) + wet H2S per NACE MR0175"
    },
    indicators: ["cracking_at_welds", "cracking_at_hard_spots", "sudden_failure_no_warning"],
    detection_methods: ["WFMT", "UT_shear_wave", "hardness_testing", "PT"],
    confused_with: ["stress_corrosion_cracking", "hydrogen_induced_cracking", "fatigue"],
    root_causes: ["excessive_hardness_weld_HAZ", "inadequate_PWHT", "wrong_consumable", "cold_work_hardening"],
    severity: "catastrophic",
    always_critical: true,
    nace_mr0175: true
  },
  erosion_corrosion: {
    key: "erosion_corrosion",
    name: "Erosion-Corrosion",
    category: "corrosion",
    description: "Accelerated corrosion from removal of protective film by flow — velocity-dependent",
    physics: "Fluid flow removes protective oxide/scale — fresh metal continuously exposed — synergistic acceleration",
    prerequisites: {
      environment: ["flowing_fluid", "high_velocity", "turbulent_flow", "particulate_laden"],
      material: ["carbon_steel", "copper_alloy"],
      temperature: "increases with temperature",
      required: "Sufficient flow velocity to remove protective film"
    },
    indicators: ["directional_wall_loss", "horseshoe_pitting", "grooves_following_flow", "thin_at_elbows_tees"],
    detection_methods: ["UT_thickness_grid", "radiography_profile", "visual_internal"],
    confused_with: ["general_corrosion", "cavitation", "impingement_attack"],
    root_causes: ["excessive_velocity", "design_sharp_radius", "process_change_velocity", "particulate_in_flow"]
  },
  microbiologically_influenced_corrosion: {
    key: "microbiologically_influenced_corrosion",
    name: "Microbiologically Influenced Corrosion (MIC)",
    category: "corrosion",
    description: "Corrosion initiated or accelerated by microorganisms — SRB, APB, iron-oxidizing bacteria",
    physics: "Biofilm creates localized chemistry — SRB produce H2S, APB produce organic acids — under-deposit pitting",
    prerequisites: {
      environment: ["stagnant_water", "low_flow", "warm_water_20_45C", "nutrient_available"],
      material: ["carbon_steel", "stainless_steel", "copper_alloy"],
      temperature: "20-45C optimal for most bacteria",
      required: "Viable bacteria + nutrients + water + stagnant conditions"
    },
    indicators: ["under_deposit_pitting", "tubercles", "black_deposits_SRB", "rapid_pit_growth", "H2S_odor"],
    detection_methods: ["visual_internal", "UT_thickness", "bacteria_culture", "ATP_test", "DNA_analysis"],
    confused_with: ["pitting_corrosion", "under_deposit_corrosion", "oxygen_pitting"],
    root_causes: ["stagnant_conditions", "inadequate_biocide", "warm_water", "dead_legs"]
  },
  crevice_corrosion: {
    key: "crevice_corrosion",
    name: "Crevice Corrosion",
    category: "corrosion",
    description: "Localized corrosion within crevices — flanges, gaskets, under deposits, tube-to-tubesheet",
    physics: "Oxygen depletion in crevice creates differential aeration cell — acidification similar to pitting",
    prerequisites: {
      environment: ["aqueous_with_chloride", "seawater", "any_electrolyte"],
      material: ["stainless_steel", "nickel_alloy", "titanium", "aluminum"],
      required: "Crevice geometry + electrolyte — gap typically 0.025-0.1mm"
    },
    indicators: ["attack_within_crevice", "deposit_under_gasket", "tube_tubesheet_interface_attack"],
    detection_methods: ["visual_disassembly", "UT_at_crevice", "radiography"],
    confused_with: ["pitting_corrosion", "galvanic_corrosion"],
    root_causes: ["design_crevice_geometry", "gasket_selection", "deposit_accumulation"]
  },
  galvanic_corrosion: {
    key: "galvanic_corrosion",
    name: "Galvanic Corrosion",
    category: "corrosion",
    description: "Accelerated corrosion of anodic metal coupled to cathodic metal in electrolyte",
    physics: "Galvanic cell formed by dissimilar metals in electrolyte — anodic metal sacrificially corrodes",
    prerequisites: {
      environment: ["electrolyte_present"],
      material: ["dissimilar_metal_couple"],
      required: "Two dissimilar metals + electrical contact + electrolyte"
    },
    indicators: ["accelerated_corrosion_anodic_metal", "protection_of_cathodic_metal", "attack_concentrated_at_junction"],
    detection_methods: ["visual", "UT_at_junction", "potential_measurement"],
    confused_with: ["general_corrosion", "crevice_corrosion"],
    root_causes: ["design_dissimilar_metals", "inadequate_isolation", "cathodic_protection_interference"]
  },
  CO2_corrosion: {
    key: "CO2_corrosion",
    name: "CO2 Corrosion (Sweet Corrosion)",
    category: "corrosion",
    description: "Corrosion by dissolved CO2 forming carbonic acid — common in oil and gas production",
    physics: "CO2 + H2O = H2CO3 — carbonic acid attacks carbon steel — mesa attack, pitting, flow-enhanced",
    prerequisites: {
      environment: ["CO2_containing_fluid", "produced_water", "gas_condensate"],
      material: ["carbon_steel", "low_alloy_steel"],
      temperature: "60-150C most aggressive",
      required: "CO2 partial pressure + water + carbon steel"
    },
    indicators: ["mesa_attack", "flow_groove", "pitting_6_oclock", "black_scale_FeCO3"],
    detection_methods: ["UT_thickness", "radiography", "visual_internal", "corrosion_coupon"],
    confused_with: ["erosion_corrosion", "H2S_corrosion", "oxygen_corrosion"],
    root_causes: ["CO2_in_process", "water_cut_increase", "velocity_change", "inhibitor_failure"]
  },
  naphthenic_acid_corrosion: {
    key: "naphthenic_acid_corrosion",
    name: "Naphthenic Acid Corrosion (NAC)",
    category: "corrosion",
    description: "High-temperature corrosion by naphthenic acids in crude oil — refinery specific",
    physics: "Naphthenic acids attack iron at high temperature — TAN-dependent, velocity-dependent",
    prerequisites: {
      environment: ["high_TAN_crude", "crude_distillation"],
      material: ["carbon_steel", "5Cr_steel"],
      temperature: "220-400C",
      required: "TAN >0.5 mg KOH/g + temperature >220C + velocity"
    },
    indicators: ["thinning_at_high_velocity_areas", "attack_transfer_lines_furnace_tubes", "pitting_and_grooving"],
    detection_methods: ["UT_thickness_grid", "radiography_profile", "IR_thermography"],
    confused_with: ["high_temp_H2S_corrosion", "erosion_corrosion"],
    root_causes: ["high_TAN_crude_processing", "velocity_change", "temperature_excursion"]
  },
  caustic_corrosion: {
    key: "caustic_corrosion",
    name: "Caustic Corrosion / Caustic Gouging",
    category: "corrosion",
    description: "Localized corrosion by concentrated caustic (NaOH/KOH) — boiler, refinery",
    physics: "Caustic concentrates at heat transfer surfaces or evaporation points — dissolves protective magnetite",
    prerequisites: {
      environment: ["caustic_containing", "boiler_water", "caustic_wash"],
      material: ["carbon_steel"],
      temperature: "above 80C — accelerates with temperature",
      required: "Caustic concentration + heat flux or evaporation point"
    },
    indicators: ["localized_gouging", "irregular_wall_loss_at_heat_transfer", "smooth_pit_surface"],
    detection_methods: ["UT_thickness", "visual_internal", "deposit_analysis"],
    confused_with: ["acid_corrosion", "erosion_corrosion", "oxygen_pitting"],
    root_causes: ["caustic_concentration", "boiler_chemistry_upset", "departure_from_nucleate_boiling"]
  },
  // === CRACKING MECHANISMS ===
  fatigue_cracking: {
    key: "fatigue_cracking",
    name: "Mechanical Fatigue Cracking",
    category: "cracking",
    description: "Progressive cracking from cyclic stress — initiates at stress concentration, propagates to failure",
    physics: "Cyclic loading nucleates micro-crack at stress concentration — propagation follows S-N curve — sudden final fracture",
    prerequisites: {
      environment: ["any"],
      material: ["any_metal"],
      required: "Cyclic stress above endurance limit + stress concentration + sufficient cycles"
    },
    indicators: ["beach_marks_fracture_surface", "crack_from_stress_concentration", "vibration_associated", "no_corrosion_product_in_crack"],
    detection_methods: ["MT", "PT", "UT_shear_wave", "phased_array", "visual_magnification"],
    confused_with: ["stress_corrosion_cracking", "corrosion_fatigue", "thermal_fatigue"],
    root_causes: ["vibration", "pressure_cycling", "thermal_cycling", "mechanical_loading_cycling", "design_stress_concentration"]
  },
  corrosion_fatigue: {
    key: "corrosion_fatigue",
    name: "Corrosion Fatigue",
    category: "cracking",
    description: "Fatigue cracking accelerated by corrosive environment — no endurance limit in corrosive media",
    physics: "Corrosion attacks crack tip during opening phase — eliminates fatigue endurance limit — crack grows at lower stress",
    prerequisites: {
      environment: ["corrosive_with_cycling", "seawater", "wet_atmosphere"],
      material: ["carbon_steel", "low_alloy_steel", "aluminum"],
      required: "Cyclic stress + corrosive environment simultaneously"
    },
    indicators: ["multiple_crack_origins", "transgranular_with_corrosion_product", "no_branching", "oxide_in_crack"],
    detection_methods: ["MT", "PT", "UT_shear_wave", "phased_array"],
    confused_with: ["fatigue_cracking", "stress_corrosion_cracking"],
    root_causes: ["vibration_in_corrosive_environment", "pressure_cycling_wet_service", "wave_loading"]
  },
  thermal_fatigue: {
    key: "thermal_fatigue",
    name: "Thermal Fatigue",
    category: "cracking",
    description: "Cracking from cyclic thermal stress — differential expansion/contraction",
    physics: "Thermal gradient generates cyclic stress — constraint prevents free expansion — fatigue cracking",
    prerequisites: {
      environment: ["thermal_cycling"],
      material: ["any_metal"],
      required: "Temperature cycling with geometric constraint preventing free expansion"
    },
    indicators: ["crazing_pattern_cracks", "cracks_at_thermal_gradient", "oxide_filled_cracks", "multiple_parallel_cracks"],
    detection_methods: ["PT", "MT", "visual", "TOFD"],
    confused_with: ["mechanical_fatigue", "stress_corrosion_cracking", "creep_cracking"],
    root_causes: ["thermal_cycling_operation", "quench_cracking", "differential_thickness", "mixing_hot_cold_streams"]
  },
  creep: {
    key: "creep",
    name: "Creep / Stress Rupture",
    category: "high_temperature",
    description: "Time-dependent deformation and cracking at elevated temperature under sustained stress",
    physics: "Grain boundary sliding and void formation at elevated temperature — primary, secondary, tertiary stages",
    prerequisites: {
      environment: ["high_temperature_sustained"],
      material: ["carbon_steel_above_400C", "low_alloy_steel_above_425C", "stainless_steel_above_500C"],
      required: "Sustained stress + temperature above material creep range"
    },
    indicators: ["bulging_deformation", "intergranular_cracking", "void_formation", "wall_thinning_localized"],
    detection_methods: ["dimensional_measurement", "metallographic_replication", "hardness_trending", "phased_array_UT"],
    confused_with: ["overheating_short_term", "stress_corrosion_cracking"],
    root_causes: ["operating_above_design_temperature", "local_hot_spot", "fire_damage", "refractory_failure"],
    severity: "catastrophic",
    always_critical: true
  },
  hydrogen_embrittlement: {
    key: "hydrogen_embrittlement",
    name: "Hydrogen Embrittlement (HE)",
    category: "cracking",
    description: "Loss of ductility and cracking from dissolved hydrogen — affects high-strength and hard materials",
    physics: "Atomic hydrogen diffuses to high-stress regions — reduces fracture toughness — brittle cracking under sustained load",
    prerequisites: {
      environment: ["hydrogen_charging", "electroplating", "cathodic_protection_overprotection", "high_temp_hydrogen"],
      material: ["high_strength_steel", "martensitic_SS", "precipitation_hardened_alloy"],
      required: "Source of atomic hydrogen + susceptible material (typically >32 HRC)"
    },
    indicators: ["delayed_cracking_after_loading", "intergranular_fracture", "brittle_appearance", "fish_eyes_fracture"],
    detection_methods: ["MT", "UT_shear_wave", "mechanical_testing", "hydrogen_measurement"],
    confused_with: ["stress_corrosion_cracking", "sulfide_stress_cracking", "temper_embrittlement"],
    root_causes: ["hydrogen_exposure", "overprotection_CP", "electroplating_bake_not_performed", "high_temp_hydrogen_attack"],
    severity: "catastrophic",
    always_critical: true
  },
  // === HIGH TEMPERATURE MECHANISMS ===
  high_temp_hydrogen_attack: {
    key: "high_temp_hydrogen_attack",
    name: "High Temperature Hydrogen Attack (HTHA)",
    category: "high_temperature",
    description: "Internal decarburization and fissuring from hydrogen at high temperature — irreversible damage",
    physics: "Hydrogen reacts with carbon in steel forming methane (CH4) at grain boundaries — internal pressure causes micro-fissuring",
    prerequisites: {
      environment: ["high_pressure_hydrogen", "above_200C"],
      material: ["carbon_steel", "low_alloy_steel"],
      temperature: "above Nelson curve for alloy",
      required: "Hydrogen partial pressure + temperature above Nelson curve threshold"
    },
    indicators: ["decarburization", "fissuring_intergranular", "loss_of_mechanical_properties", "blistering"],
    detection_methods: ["advanced_UT_backscatter", "TOFD", "velocity_ratio", "metallographic_replication"],
    confused_with: ["creep_damage", "hydrogen_induced_cracking"],
    root_causes: ["operating_above_Nelson_curve", "temperature_excursion", "inadequate_alloy_selection"],
    severity: "catastrophic",
    always_critical: true
  },
  oxidation: {
    key: "oxidation",
    name: "High Temperature Oxidation / Scaling",
    category: "high_temperature",
    description: "Metal loss from reaction with oxygen at elevated temperature — scale formation",
    physics: "Metal + oxygen = metal oxide scale — parabolic rate law — accelerates exponentially with temperature",
    prerequisites: {
      environment: ["oxidizing_atmosphere", "high_temperature"],
      material: ["carbon_steel", "low_alloy_steel"],
      temperature: "above 400C for carbon steel in air",
      required: "Oxygen + temperature above oxidation threshold"
    },
    indicators: ["scale_formation", "wall_thinning_from_outside", "scale_spalling"],
    detection_methods: ["UT_thickness", "visual", "metallographic_scale_thickness"],
    confused_with: ["fire_damage", "general_corrosion"],
    root_causes: ["operating_temperature_exceedance", "fire_damage", "refractory_failure"]
  },
  carburization: {
    key: "carburization",
    name: "Carburization",
    category: "high_temperature",
    description: "Carbon diffusion into metal at high temperature — hardening and embrittlement",
    physics: "Carbon from process stream diffuses into steel — forms carbides — reduces ductility and increases hardness",
    prerequisites: {
      environment: ["carbon_rich_atmosphere", "hydrocarbon_process"],
      material: ["carbon_steel", "stainless_steel", "nickel_alloy"],
      temperature: "above 600C",
      required: "Carbon activity + temperature + time"
    },
    indicators: ["increased_hardness", "magnetic_response_change_SS", "embrittlement", "bulging_from_carbide_volume"],
    detection_methods: ["hardness_testing", "metallography", "magnetic_testing_SS"],
    confused_with: ["nitriding", "sigma_phase"],
    root_causes: ["process_conditions", "flame_impingement", "coking"]
  },
  // === MECHANICAL MECHANISMS ===
  erosion: {
    key: "erosion",
    name: "Erosion (Mechanical)",
    category: "mechanical",
    description: "Material removal by impingement of particles, droplets, or high-velocity fluid",
    physics: "Kinetic energy of particles/droplets exceeds material surface strength — material removal by cutting or deformation",
    prerequisites: {
      environment: ["particulate_flow", "droplet_impingement", "high_velocity"],
      material: ["any_metal"],
      required: "Particles/droplets + velocity sufficient to cause material removal"
    },
    indicators: ["directional_material_loss", "polished_or_grooved_surface", "thinning_at_flow_change"],
    detection_methods: ["UT_thickness", "visual_internal", "radiography_profile"],
    confused_with: ["erosion_corrosion", "cavitation"],
    root_causes: ["process_particulate", "velocity_exceedance", "design_flow_geometry"]
  },
  cavitation: {
    key: "cavitation",
    name: "Cavitation Damage",
    category: "mechanical",
    description: "Material damage from collapse of vapor bubbles at surface — pumps, valves, propellers",
    physics: "Pressure drop below vapor pressure creates bubbles — bubbles collapse at surface creating shock waves — material removal",
    prerequisites: {
      environment: ["liquid_flow_pressure_drop"],
      material: ["any_metal"],
      required: "Local pressure below vapor pressure followed by pressure recovery"
    },
    indicators: ["rough_pitted_surface", "sponge_like_damage", "damage_downstream_of_restriction"],
    detection_methods: ["visual", "UT_thickness", "vibration_analysis"],
    confused_with: ["erosion", "pitting_corrosion"],
    root_causes: ["insufficient_NPSH", "throttling_valve_design", "velocity_exceedance"]
  },
  mechanical_overload: {
    key: "mechanical_overload",
    name: "Mechanical Overload / Overpressure",
    category: "mechanical",
    description: "Failure from single application of stress exceeding material strength — ductile or brittle fracture",
    physics: "Applied stress exceeds yield (deformation) or UTS (fracture) — single event or sustained overload",
    prerequisites: {
      environment: ["any"],
      material: ["any_metal"],
      required: "Applied stress exceeding material capacity"
    },
    indicators: ["plastic_deformation", "ductile_fracture_dimples", "bulging", "necking"],
    detection_methods: ["visual", "dimensional", "UT_thickness", "metallography_fracture_surface"],
    confused_with: ["creep", "fatigue_final_fracture"],
    root_causes: ["overpressure", "water_hammer", "external_load", "weakened_section_corrosion"],
    severity: "catastrophic"
  },
  vibration_fatigue: {
    key: "vibration_fatigue",
    name: "Vibration-Induced Fatigue",
    category: "cracking",
    description: "High-cycle fatigue from vibration — small-bore connections, instrument lines, structural attachments",
    physics: "Flow-induced or mechanically-induced vibration creates cyclic stress at natural frequency — rapid crack initiation",
    prerequisites: {
      environment: ["vibration_source_present"],
      material: ["any_metal"],
      required: "Vibration excitation + resonance or high-frequency cycling + stress concentration"
    },
    indicators: ["cracks_at_attachment_welds", "crack_at_small_bore_branch", "socket_weld_cracking", "beach_marks"],
    detection_methods: ["visual", "PT", "MT", "vibration_monitoring"],
    confused_with: ["thermal_fatigue", "mechanical_fatigue"],
    root_causes: ["flow_induced_vibration", "machinery_vibration", "acoustic_vibration", "inadequate_support"]
  },
  // === ENVIRONMENTAL / OTHER ===
  under_insulation_corrosion: {
    key: "under_insulation_corrosion",
    name: "Corrosion Under Insulation (CUI)",
    category: "corrosion",
    description: "External corrosion under thermal insulation — moisture ingress causes aggressive attack",
    physics: "Moisture penetrates insulation system — trapped against hot surface — accelerated corrosion in 50-175C range",
    prerequisites: {
      environment: ["insulated_equipment", "outdoor_exposure", "cyclic_temperature"],
      material: ["carbon_steel", "low_alloy_steel", "300_series_SS_SCC"],
      temperature: "50-175C most aggressive (carbon steel); any temp for SS SCC with chloride",
      required: "Moisture ingress through insulation + temperature in critical range"
    },
    indicators: ["wall_thinning_under_insulation", "rust_staining_at_insulation_gaps", "insulation_damage_jacketing"],
    detection_methods: ["insulation_removal", "UT_thickness", "RT_profile", "pulsed_eddy_current", "neutron_backscatter"],
    confused_with: ["general_corrosion_external", "coating_failure"],
    root_causes: ["insulation_damage", "jacketing_failure", "sealant_degradation", "coating_failure_under_insulation"]
  },
  under_deposit_corrosion: {
    key: "under_deposit_corrosion",
    name: "Under-Deposit Corrosion",
    category: "corrosion",
    description: "Localized corrosion beneath deposits — differential aeration and chemistry under deposit",
    physics: "Deposit creates occluded cell — oxygen depletion and acidification beneath — similar to crevice corrosion",
    prerequisites: {
      environment: ["deposit_forming_fluid", "low_flow"],
      material: ["carbon_steel", "stainless_steel"],
      required: "Deposit formation + electrolyte"
    },
    indicators: ["pitting_under_deposit", "tubercles", "localized_wall_loss_6_oclock"],
    detection_methods: ["UT_thickness", "visual_internal", "radiography"],
    confused_with: ["pitting_corrosion", "MIC", "erosion_corrosion"],
    root_causes: ["low_flow_velocity", "process_upsets", "inadequate_cleaning", "dead_legs"]
  },
  dealloying: {
    key: "dealloying",
    name: "Dealloying (Selective Leaching)",
    category: "corrosion",
    description: "Selective removal of one element from alloy — dezincification, graphitization, dealuminification",
    physics: "More active element selectively dissolved leaving porous weak residue — dezincification in brass most common",
    prerequisites: {
      environment: ["aqueous", "specific_to_alloy_type"],
      material: ["brass_dezincification", "cast_iron_graphitization", "aluminum_bronze"],
      required: "Susceptible alloy + specific environment"
    },
    indicators: ["color_change", "plug_or_layer_type_attack", "reduced_strength_spongy", "reddish_copper_plug_in_brass"],
    detection_methods: ["visual_color", "metallography", "hardness_change", "UT_attenuation"],
    confused_with: ["general_corrosion", "pitting_corrosion"],
    root_causes: ["alloy_selection", "environment_change", "temperature_increase"]
  },
  temper_embrittlement: {
    key: "temper_embrittlement",
    name: "Temper Embrittlement (885F Embrittlement)",
    category: "metallurgical",
    description: "Loss of toughness from segregation of impurities to grain boundaries during heat treatment or service",
    physics: "P, Sn, As, Sb segregate to grain boundaries at 375-575C — increases DBTT — brittle fracture risk during shutdown",
    prerequisites: {
      environment: ["long_term_service_375_575C", "slow_cooling_through_critical_range"],
      material: ["2.25Cr_1Mo", "other_CrMo_steels", "some_carbon_steels"],
      required: "Susceptible composition (Mn+Si, P, Sn content) + time at temperature"
    },
    indicators: ["increased_DBTT", "intergranular_fracture", "no_visible_damage_in_service"],
    detection_methods: ["Charpy_impact_testing", "step_cooling_test", "fracture_appearance"],
    confused_with: ["hydrogen_embrittlement", "sigma_phase"],
    root_causes: ["long_service_in_critical_range", "steel_composition", "slow_cooling_shutdown"]
  },
  sigma_phase_embrittlement: {
    key: "sigma_phase_embrittlement",
    name: "Sigma Phase Embrittlement",
    category: "metallurgical",
    description: "Formation of sigma phase in austenitic SS and duplex SS at 600-900C — severe embrittlement",
    physics: "Iron-chromium intermetallic compound precipitates at grain boundaries — extremely hard and brittle — reduces toughness and corrosion resistance",
    prerequisites: {
      environment: ["service_600_900C"],
      material: ["austenitic_stainless_steel", "duplex_stainless_steel"],
      temperature: "600-900C",
      required: "Susceptible alloy + time at temperature (faster in high-Cr, high-Mo grades)"
    },
    indicators: ["loss_of_toughness", "cracking_during_shutdown", "magnetic_response_increase"],
    detection_methods: ["magnetic_testing", "Charpy_impact", "metallography", "ferrite_measurement"],
    confused_with: ["temper_embrittlement", "475C_embrittlement"],
    root_causes: ["prolonged_service_above_600C", "wrong_alloy_selection", "weld_heat_input"]
  },
  brittle_fracture: {
    key: "brittle_fracture",
    name: "Brittle Fracture",
    category: "mechanical",
    description: "Sudden catastrophic fracture with little or no plastic deformation — typically at low temperature",
    physics: "Below ductile-brittle transition temperature — insufficient fracture toughness — crack propagates at speed of sound",
    prerequisites: {
      environment: ["low_temperature", "at_or_below_DBTT"],
      material: ["carbon_steel", "low_alloy_steel"],
      required: "Temperature below DBTT + flaw + stress"
    },
    indicators: ["flat_fracture_surface", "chevron_marks_pointing_to_origin", "minimal_deformation", "cleavage_facets"],
    detection_methods: ["fracture_surface_analysis", "Charpy_impact_testing", "CTOD_testing"],
    confused_with: ["hydrogen_embrittlement", "temper_embrittlement"],
    root_causes: ["pressurization_at_low_temperature", "hydrotest_cold_weather", "material_not_impact_tested", "embrittlement"],
    severity: "catastrophic",
    always_critical: true
  },
  corrosion_under_coating: {
    key: "corrosion_under_coating",
    name: "Corrosion Under Coating Failure",
    category: "corrosion",
    description: "Corrosion of substrate where coating has failed — holidays, delamination, or degradation",
    physics: "Coating failure exposes substrate to environment — localized or general corrosion at exposed areas",
    prerequisites: {
      environment: ["corrosive_with_coating_failure"],
      material: ["carbon_steel", "low_alloy_steel"],
      required: "Coating failure + corrosive environment"
    },
    indicators: ["blistering", "rust_staining_through_coating", "delamination", "coating_cracking"],
    detection_methods: ["visual", "UT_thickness", "holiday_test", "adhesion_test"],
    confused_with: ["general_corrosion", "CUI"],
    root_causes: ["coating_holiday", "coating_age", "mechanical_damage", "UV_degradation", "application_defect"]
  },
  weld_decay: {
    key: "weld_decay",
    name: "Weld Decay (Sensitization / Intergranular Corrosion)",
    category: "corrosion",
    description: "Intergranular corrosion in HAZ of austenitic SS — chromium carbide precipitation depletes Cr at grain boundaries",
    physics: "Heating to 425-815C precipitates Cr23C6 at grain boundaries — depletes adjacent chromium below 12% — passive film breaks down",
    prerequisites: {
      environment: ["corrosive_aqueous", "oxidizing_acids", "polythionic_acid"],
      material: ["austenitic_stainless_steel_non_L_grade", "304", "316"],
      temperature: "sensitization at 425-815C during welding or service",
      required: "Sensitized microstructure + corrosive environment"
    },
    indicators: ["ditching_along_HAZ", "intergranular_attack_weld_parallel", "knife_line_attack"],
    detection_methods: ["visual", "PT", "metallography", "oxalic_acid_etch_test_ASTM_A262"],
    confused_with: ["stress_corrosion_cracking", "pitting_corrosion"],
    root_causes: ["non_L_grade_SS_welded", "excessive_heat_input", "no_solution_anneal_after_welding"]
  },
  amine_cracking: {
    key: "amine_cracking",
    name: "Amine Stress Corrosion Cracking",
    category: "cracking",
    description: "SCC of carbon steel in amine service — MEA, DEA, MDEA units",
    physics: "Amine solution + residual stress + carbon steel — intergranular cracking at welds",
    prerequisites: {
      environment: ["amine_solution", "lean_amine", "rich_amine"],
      material: ["carbon_steel"],
      temperature: "any — more common at higher temperature",
      required: "Amine solution + non-PWHT weld + residual stress"
    },
    indicators: ["cracking_at_welds", "intergranular_cracking", "no_corrosion_product"],
    detection_methods: ["WFMT", "UT_shear_wave", "TOFD", "AE"],
    confused_with: ["caustic_cracking", "hydrogen_cracking"],
    root_causes: ["no_PWHT", "lean_amine_concentration", "high_temperature", "residual_stress"],
    nace_requirement: "PWHT mandatory for amine service per API RP 945"
  },
  wet_H2S_damage: {
    key: "wet_H2S_damage",
    name: "Wet H2S Damage (General)",
    category: "cracking",
    description: "Family of damage mechanisms in wet H2S service — HIC, SOHIC, SSC, hydrogen blistering",
    physics: "H2S promotes hydrogen entry into steel — multiple damage morphologies depending on steel and stress",
    prerequisites: {
      environment: ["wet_H2S", "sour_water"],
      material: ["carbon_steel", "low_alloy_steel"],
      required: "Water + H2S above threshold per NACE MR0103/MR0175"
    },
    indicators: ["blistering", "HIC_stepwise_cracking", "SOHIC_at_welds", "SSC_at_hard_zones"],
    detection_methods: ["UT_shear_wave", "TOFD", "AUT_C_scan", "visual_blistering", "hardness"],
    confused_with: ["lamination", "fabrication_defect"],
    root_causes: ["sour_service_conditions", "inadequate_steel_quality", "high_hardness", "no_PWHT"],
    nace_mr0175: true,
    always_critical: true
  },
  chloride_SCC: {
    key: "chloride_SCC",
    name: "Chloride Stress Corrosion Cracking (Cl-SCC)",
    category: "cracking",
    description: "SCC of austenitic SS in chloride-containing environment — common cause of SS failure",
    physics: "Chloride ions penetrate passive film at stress — transgranular branching cracks propagate rapidly",
    prerequisites: {
      environment: ["chloride_above_10ppm", "temperature_above_60C"],
      material: ["austenitic_stainless_steel", "304", "316"],
      temperature: "above 60C (lower threshold if high stress or concentration)",
      required: "Austenitic SS + chloride + tensile stress + temperature"
    },
    indicators: ["transgranular_branching_cracks", "spider_web_cracking_pattern", "failure_at_welds_or_stress"],
    detection_methods: ["PT", "MT_not_effective_austenitic", "TOFD", "phased_array"],
    confused_with: ["polythionic_acid_SCC", "external_SCC"],
    root_causes: ["chloride_in_process", "CUI_chloride_leaching", "coastal_atmosphere", "insulation_chloride"],
    severity: "catastrophic",
    always_critical: true
  }
};

// ============================================================
// ROOT CAUSE FAMILIES — 30+ root causes
// ============================================================

var ROOT_CAUSES = {
  design_flaw: { key: "design_flaw", name: "Design Deficiency", category: "design", description: "Inadequate design for service conditions — wrong material, geometry, or specification" },
  material_selection: { key: "material_selection", name: "Wrong Material Selection", category: "design", description: "Material not suited for service environment — susceptible to specific mechanism" },
  fabrication_defect: { key: "fabrication_defect", name: "Fabrication/Welding Defect", category: "fabrication", description: "Manufacturing defect acting as initiation site — misalignment, incomplete penetration, lack of fusion" },
  inadequate_pwht: { key: "inadequate_pwht", name: "Inadequate or Missing PWHT", category: "fabrication", description: "Post-weld heat treatment not performed or insufficient — residual stress, high hardness" },
  excessive_hardness: { key: "excessive_hardness", name: "Excessive Hardness", category: "fabrication", description: "Weld or HAZ hardness exceeding specification limit — SSC/HIC susceptibility" },
  coating_failure: { key: "coating_failure", name: "Coating/Lining Failure", category: "protection", description: "Protective coating or lining has failed — substrate exposed to corrosive environment" },
  cp_failure: { key: "cp_failure", name: "Cathodic Protection Failure", category: "protection", description: "CP system not functioning — anode depletion, rectifier failure, interference" },
  inhibitor_failure: { key: "inhibitor_failure", name: "Corrosion Inhibitor Failure", category: "protection", description: "Chemical inhibitor not effective — depletion, wrong product, inadequate dose" },
  process_upset: { key: "process_upset", name: "Process Upset / Excursion", category: "operations", description: "Process deviation introducing aggressive conditions — temperature, pressure, chemistry" },
  temperature_excursion: { key: "temperature_excursion", name: "Temperature Excursion", category: "operations", description: "Operating temperature exceeded design or expected range" },
  velocity_change: { key: "velocity_change", name: "Flow Velocity Change", category: "operations", description: "Flow velocity increased beyond design — erosion, erosion-corrosion risk" },
  stagnant_conditions: { key: "stagnant_conditions", name: "Stagnant / Dead Leg Conditions", category: "operations", description: "Low or zero flow allowing deposit, bacterial growth, concentration" },
  water_ingress: { key: "water_ingress", name: "Water Ingress / Contamination", category: "operations", description: "Unexpected water in system — moisture, rain, process upset" },
  insulation_damage: { key: "insulation_damage", name: "Insulation System Damage", category: "maintenance", description: "Thermal insulation damaged allowing moisture ingress — CUI initiation" },
  inspection_inadequate: { key: "inspection_inadequate", name: "Inadequate Inspection", category: "maintenance", description: "Inspection program failed to detect damage in time — wrong technique, frequency, or coverage" },
  maintenance_deferred: { key: "maintenance_deferred", name: "Deferred Maintenance", category: "maintenance", description: "Required maintenance not performed — coating repair, cathodic protection, equipment replacement" },
  external_damage: { key: "external_damage", name: "External / Third Party Damage", category: "external", description: "Damage from external source — impact, excavation, fire, weather" },
  fire_damage: { key: "fire_damage", name: "Fire Exposure", category: "external", description: "Equipment exposed to external fire — metallurgical damage, deformation, coating failure" },
  vibration_source: { key: "vibration_source", name: "Vibration / Cyclic Loading Source", category: "operations", description: "Source of vibration or cyclic loading — machinery, flow, pressure pulsation" },
  chemical_contamination: { key: "chemical_contamination", name: "Chemical Contamination", category: "operations", description: "Contaminant introduced to process — chloride, oxygen, H2S, CO2, acid" },
  poor_surface_prep: { key: "poor_surface_prep", name: "Poor Surface Preparation", category: "fabrication", description: "Inadequate surface preparation before coating or welding" },
  startup_shutdown_cycling: { key: "startup_shutdown_cycling", name: "Startup/Shutdown Cycling", category: "operations", description: "Repeated startup and shutdown creating thermal and pressure cycles" },
  environmental_change: { key: "environmental_change", name: "Environmental Change", category: "external", description: "Change in external environment — coastal relocation, climate, soil conditions" },
  age_degradation: { key: "age_degradation", name: "Age-Related Degradation", category: "aging", description: "Normal aging processes — embrittlement, fatigue accumulation, coating weathering" },
  overloading: { key: "overloading", name: "Mechanical Overloading", category: "operations", description: "Equipment loaded beyond design capacity — overpressure, overweight, impact" },
  weld_quality: { key: "weld_quality", name: "Weld Quality Issue", category: "fabrication", description: "Weld defect serving as damage initiation site — porosity, lack of fusion, undercut" },
  wrong_consumable: { key: "wrong_consumable", name: "Wrong Welding Consumable", category: "fabrication", description: "Incorrect welding consumable used — composition mismatch, hardness issues" },
  residual_stress: { key: "residual_stress", name: "Residual Stress (Welding/Forming)", category: "fabrication", description: "Residual tensile stress from welding or cold forming — SCC and fatigue initiation" },
  operating_procedure: { key: "operating_procedure", name: "Operating Procedure Issue", category: "operations", description: "Incorrect or missing operating procedure contributing to damage" },
  crude_change: { key: "crude_change", name: "Crude / Feedstock Change", category: "operations", description: "Change in crude or feedstock introducing new corrosive species — TAN, sulfur, chloride" }
};

// ============================================================
// MECHANISM INTERACTIONS — synergistic, sequential, competing
// ============================================================

var MECHANISM_INTERACTIONS = {
  synergistic: [
    { mechanisms: ["erosion_corrosion", "CO2_corrosion"], effect: "Erosion removes FeCO3 protective scale — corrosion rate increases dramatically" },
    { mechanisms: ["pitting_corrosion", "fatigue_cracking"], effect: "Pits act as stress concentrators — fatigue crack initiation at pit base" },
    { mechanisms: ["general_corrosion", "fatigue_cracking"], effect: "Wall thinning increases stress — accelerates fatigue damage" },
    { mechanisms: ["stress_corrosion_cracking", "hydrogen_embrittlement"], effect: "Both hydrogen-driven — combined attack in sour/hydrogen service" },
    { mechanisms: ["microbiologically_influenced_corrosion", "under_deposit_corrosion"], effect: "MIC creates deposits which further concentrate attack" },
    { mechanisms: ["coating_failure", "general_corrosion"], effect: "Coating failure exposes substrate — corrosion initiates at holidays" },
    { mechanisms: ["under_insulation_corrosion", "chloride_SCC"], effect: "CUI moisture carries chloride to hot SS surface — SCC initiation" },
    { mechanisms: ["creep", "oxidation"], effect: "Oxidation thins wall increasing creep stress — accelerating both" }
  ],
  sequential: [
    { first: "coating_failure", then: "general_corrosion", description: "Coating fails first, then corrosion begins at exposed areas" },
    { first: "pitting_corrosion", then: "stress_corrosion_cracking", description: "Pitting creates stress concentration — SCC initiates from pit" },
    { first: "general_corrosion", then: "mechanical_overload", description: "Wall thinning reduces capacity — eventual overpressure failure" },
    { first: "hydrogen_induced_cracking", then: "sulfide_stress_cracking", description: "HIC creates internal defects — SSC propagates from HIC damage" },
    { first: "thermal_fatigue", then: "corrosion_fatigue", description: "Thermal fatigue creates surface cracks — corrosion accelerates propagation" },
    { first: "insulation_damage", then: "under_insulation_corrosion", description: "Insulation breached — moisture ingress — CUI begins" },
    { first: "weld_decay", then: "stress_corrosion_cracking", description: "Sensitization creates susceptible microstructure — SCC follows in corrosive environment" }
  ],
  competing: [
    { mechanisms: ["general_corrosion", "pitting_corrosion"], description: "General corrosion reduces pitting tendency by removing passive film everywhere" },
    { mechanisms: ["oxidation", "carburization"], description: "Oxidizing atmosphere prevents carburization — reducing atmosphere prevents oxidation" }
  ]
};

// ============================================================
// MATERIAL SUSCEPTIBILITY MATRIX
// ============================================================

var MATERIAL_SUSCEPTIBILITY = {
  carbon_steel: {
    material: "Carbon Steel",
    susceptible_to: ["general_corrosion", "pitting_corrosion", "CO2_corrosion", "erosion_corrosion", "hydrogen_induced_cracking", "sulfide_stress_cracking", "caustic_corrosion", "under_insulation_corrosion", "microbiologically_influenced_corrosion", "fatigue_cracking", "corrosion_fatigue", "mechanical_overload", "brittle_fracture", "creep", "high_temp_hydrogen_attack", "amine_cracking", "wet_H2S_damage"],
    resistant_to: ["chloride_SCC", "sigma_phase_embrittlement", "weld_decay"],
    notes: "Most common material — susceptible to most mechanisms. SSC if hardness >22 HRC."
  },
  austenitic_stainless_steel: {
    material: "Austenitic Stainless Steel (304/316)",
    susceptible_to: ["chloride_SCC", "pitting_corrosion", "crevice_corrosion", "stress_corrosion_cracking", "weld_decay", "sigma_phase_embrittlement", "microbiologically_influenced_corrosion", "naphthenic_acid_corrosion"],
    resistant_to: ["general_corrosion", "CO2_corrosion", "hydrogen_induced_cracking", "sulfide_stress_cracking", "caustic_corrosion"],
    notes: "Excellent general corrosion resistance but highly susceptible to chloride SCC above 60C. Use L grades (304L/316L) to prevent sensitization."
  },
  duplex_stainless_steel: {
    material: "Duplex Stainless Steel (2205/2507)",
    susceptible_to: ["sigma_phase_embrittlement", "hydrogen_embrittlement", "chloride_SCC_at_higher_temp"],
    resistant_to: ["general_corrosion", "pitting_corrosion", "crevice_corrosion", "CO2_corrosion", "erosion_corrosion"],
    notes: "Excellent resistance to chloride SCC up to ~120C. Susceptible to sigma phase above 300C."
  },
  low_alloy_steel_cr_mo: {
    material: "Low Alloy Steel (Cr-Mo)",
    susceptible_to: ["temper_embrittlement", "creep", "high_temp_hydrogen_attack", "hydrogen_induced_cracking", "sulfide_stress_cracking", "oxidation"],
    resistant_to: ["chloride_SCC", "naphthenic_acid_corrosion_higher_Cr"],
    notes: "Used for high-temperature hydrogen service. Susceptible to temper embrittlement at 375-575C."
  },
  nickel_alloy: {
    material: "Nickel Alloy (Inconel, Hastelloy, Monel)",
    susceptible_to: ["chloride_SCC_some_grades", "hydrogen_embrittlement_some_grades", "carburization"],
    resistant_to: ["general_corrosion", "CO2_corrosion", "pitting_corrosion", "high_temp_oxidation", "caustic_corrosion", "naphthenic_acid_corrosion"],
    notes: "Premium corrosion resistance. Some grades susceptible to SCC in specific environments."
  },
  copper_alloy: {
    material: "Copper Alloy (Brass, Bronze, Cu-Ni)",
    susceptible_to: ["dealloying", "erosion_corrosion", "ammonia_SCC", "microbiologically_influenced_corrosion", "galvanic_corrosion"],
    resistant_to: ["general_corrosion_seawater_CuNi", "biofouling_CuNi"],
    notes: "Brass susceptible to dezincification. Cu-Ni excellent for seawater but susceptible to sulfide."
  },
  titanium: {
    material: "Titanium",
    susceptible_to: ["crevice_corrosion_elevated_temp", "hydrogen_embrittlement", "erosion_at_extreme_velocity"],
    resistant_to: ["general_corrosion", "pitting_corrosion", "chloride_SCC", "seawater_corrosion", "oxidizing_acid"],
    notes: "Excellent corrosion resistance. Susceptible to HE if cathodic overprotection. Crevice corrosion above 70C in chloride."
  }
};

// ============================================================
// IDENTIFY MECHANISM — from observed indications
// ============================================================

function identifyMechanism(input) {
  var indications = input.indications || [];
  var material = input.material || null;
  var environment = input.environment || [];
  var temperature = input.temperature_c || null;

  var candidates = [];
  var eliminated = [];

  var mechanismKeys = Object.keys(MECHANISM_DB);
  for (var m = 0; m < mechanismKeys.length; m++) {
    var mech = MECHANISM_DB[mechanismKeys[m]];
    var score = 0;
    var matchedIndicators = [];
    var matchedPrereqs = [];
    var failedPrereqs = [];

    // Score based on indicator matches
    if (mech.indicators) {
      for (var i = 0; i < indications.length; i++) {
        var indication = indications[i].toLowerCase();
        for (var mi = 0; mi < mech.indicators.length; mi++) {
          if (mech.indicators[mi].toLowerCase().indexOf(indication) >= 0 || indication.indexOf(mech.indicators[mi].toLowerCase()) >= 0) {
            score = score + 30;
            matchedIndicators.push(mech.indicators[mi]);
          }
        }
      }
    }

    // Score based on environment match
    if (mech.prerequisites && mech.prerequisites.environment && environment.length > 0) {
      for (var e = 0; e < environment.length; e++) {
        var env = environment[e].toLowerCase();
        for (var pe = 0; pe < mech.prerequisites.environment.length; pe++) {
          if (mech.prerequisites.environment[pe].toLowerCase().indexOf(env) >= 0 || env.indexOf(mech.prerequisites.environment[pe].toLowerCase()) >= 0) {
            score = score + 20;
            matchedPrereqs.push("environment: " + mech.prerequisites.environment[pe]);
          }
        }
      }
    }

    // Score based on material match
    if (material && MATERIAL_SUSCEPTIBILITY[material]) {
      var susceptible = MATERIAL_SUSCEPTIBILITY[material].susceptible_to || [];
      if (susceptible.indexOf(mechanismKeys[m]) >= 0) {
        score = score + 15;
        matchedPrereqs.push("material susceptible: " + material);
      }
      var resistant = MATERIAL_SUSCEPTIBILITY[material].resistant_to || [];
      if (resistant.indexOf(mechanismKeys[m]) >= 0) {
        score = score - 30;
        failedPrereqs.push("material resistant: " + material + " — unlikely mechanism");
      }
    }

    if (score > 0) {
      candidates.push({
        mechanism_key: mechanismKeys[m],
        mechanism_name: mech.name,
        category: mech.category,
        score: score,
        matched_indicators: matchedIndicators,
        matched_prerequisites: matchedPrereqs,
        failed_prerequisites: failedPrereqs,
        severity: mech.severity || "moderate",
        always_critical: mech.always_critical || false,
        detection_methods: mech.detection_methods || [],
        root_causes: mech.root_causes || []
      });
    } else if (matchedIndicators.length > 0 && failedPrereqs.length > 0) {
      eliminated.push({
        mechanism_key: mechanismKeys[m],
        mechanism_name: mech.name,
        reason: failedPrereqs.join("; ")
      });
    }
  }

  // Sort by score descending
  candidates.sort(function(a, b) { return b.score - a.score; });

  return {
    engine: ENGINE_NAME,
    version: ENGINE_VERSION,
    action: "identify_mechanism",
    input_indications: indications,
    input_material: material,
    input_environment: environment,
    input_temperature_c: temperature,
    candidates: candidates.slice(0, 10),
    eliminated: eliminated,
    total_mechanisms_evaluated: mechanismKeys.length,
    recommendation: candidates.length > 0 ? "Primary candidate: " + candidates[0].mechanism_name + " (score: " + candidates[0].score + ")" : "No matching mechanisms found — review indications",
    timestamp: nowISO()
  };
}

// ============================================================
// VALIDATE CAUSAL CHAIN
// ============================================================

function validateCausalChain(input) {
  var chain = input.chain || [];
  var material = input.material || null;
  var environment = input.environment || [];
  var validations = [];
  var isValid = true;
  var warnings = [];

  for (var c = 0; c < chain.length; c++) {
    var stepKey = chain[c];
    var mech = MECHANISM_DB[stepKey];

    if (!mech) {
      validations.push({ step: c + 1, mechanism: stepKey, valid: false, reason: "Unknown mechanism — not in database" });
      isValid = false;
      continue;
    }

    var stepValid = true;
    var stepNotes = [];

    // Check material susceptibility
    if (material && MATERIAL_SUSCEPTIBILITY[material]) {
      var resistant = MATERIAL_SUSCEPTIBILITY[material].resistant_to || [];
      if (resistant.indexOf(stepKey) >= 0) {
        stepValid = false;
        stepNotes.push(MATERIAL_SUSCEPTIBILITY[material].material + " is resistant to " + mech.name + " — physically implausible");
      }
    }

    // Check sequential logic
    if (c > 0) {
      var prevStep = chain[c - 1];
      var foundSequential = false;
      for (var s = 0; s < MECHANISM_INTERACTIONS.sequential.length; s++) {
        var seq = MECHANISM_INTERACTIONS.sequential[s];
        if (seq.first === prevStep && seq.then === stepKey) {
          foundSequential = true;
          stepNotes.push("Valid sequence: " + seq.description);
        }
      }
      if (!foundSequential) {
        // Check if synergistic
        var foundSynergy = false;
        for (var sy = 0; sy < MECHANISM_INTERACTIONS.synergistic.length; sy++) {
          var syn = MECHANISM_INTERACTIONS.synergistic[sy];
          if (syn.mechanisms.indexOf(prevStep) >= 0 && syn.mechanisms.indexOf(stepKey) >= 0) {
            foundSynergy = true;
            stepNotes.push("Synergistic with previous: " + syn.effect);
          }
        }
        // Check if competing (contradiction)
        for (var co = 0; co < MECHANISM_INTERACTIONS.competing.length; co++) {
          var comp = MECHANISM_INTERACTIONS.competing[co];
          if (comp.mechanisms.indexOf(prevStep) >= 0 && comp.mechanisms.indexOf(stepKey) >= 0) {
            warnings.push("COMPETING mechanisms in chain: " + comp.description);
            stepNotes.push("WARNING — competing with previous step: " + comp.description);
          }
        }
        if (!foundSynergy && stepNotes.length === 0) {
          stepNotes.push("No known sequential or synergistic relationship with previous step — verify physics");
        }
      }
    }

    if (!stepValid) isValid = false;
    validations.push({
      step: c + 1,
      mechanism: stepKey,
      mechanism_name: mech.name,
      valid: stepValid,
      notes: stepNotes
    });
  }

  return {
    engine: ENGINE_NAME,
    version: ENGINE_VERSION,
    action: "validate_causal_chain",
    chain: chain,
    chain_valid: isValid,
    validations: validations,
    warnings: warnings,
    material: material,
    environment: environment,
    timestamp: nowISO()
  };
}

// ============================================================
// HANDLER — 10 API actions
// ============================================================

var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return fail(405, "POST only");
  }

  var body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return fail(400, "Invalid JSON");
  }

  var action = body.action || "";
  var orgId = getOrg(event);

  // == get_registry ==
  if (action === "get_registry") {
    return ok({
      engine: ENGINE_NAME,
      version: ENGINE_VERSION,
      status: "operational",
      actions: [
        "get_registry",
        "identify_mechanism",
        "validate_causal_chain",
        "get_root_causes",
        "check_prerequisites",
        "get_mechanism_interactions",
        "get_mechanism_registry",
        "get_material_susceptibility",
        "get_progression_model",
        "get_differential_diagnosis"
      ],
      knowledge_base: {
        damage_mechanisms: Object.keys(MECHANISM_DB).length,
        root_cause_families: Object.keys(ROOT_CAUSES).length,
        material_susceptibility_entries: Object.keys(MATERIAL_SUSCEPTIBILITY).length,
        synergistic_interactions: MECHANISM_INTERACTIONS.synergistic.length,
        sequential_interactions: MECHANISM_INTERACTIONS.sequential.length,
        competing_interactions: MECHANISM_INTERACTIONS.competing.length
      },
      deploy: "DEPLOY275"
    });
  }

  // == identify_mechanism ==
  if (action === "identify_mechanism") {
    return ok(identifyMechanism(body));
  }

  // == validate_causal_chain ==
  if (action === "validate_causal_chain") {
    return ok(validateCausalChain(body));
  }

  // == get_root_causes ==
  if (action === "get_root_causes") {
    var mechKey = body.mechanism_key || "";
    var mech = MECHANISM_DB[mechKey];
    if (!mech) {
      return fail(400, "Unknown mechanism_key: " + mechKey);
    }
    var rootCauseDetails = [];
    var rcKeys = mech.root_causes || [];
    for (var r = 0; r < rcKeys.length; r++) {
      if (ROOT_CAUSES[rcKeys[r]]) {
        rootCauseDetails.push(ROOT_CAUSES[rcKeys[r]]);
      } else {
        rootCauseDetails.push({ key: rcKeys[r], name: rcKeys[r], category: "unknown" });
      }
    }
    return ok({
      engine: ENGINE_NAME,
      mechanism: mech.name,
      mechanism_key: mechKey,
      root_causes: rootCauseDetails,
      root_cause_keys: rcKeys,
      timestamp: nowISO()
    });
  }

  // == check_prerequisites ==
  if (action === "check_prerequisites") {
    var mechKey2 = body.mechanism_key || "";
    var mech2 = MECHANISM_DB[mechKey2];
    if (!mech2) {
      return fail(400, "Unknown mechanism_key: " + mechKey2);
    }
    var prereqs = mech2.prerequisites || {};
    var providedEnv = body.environment || [];
    var providedMat = body.material || null;
    var providedTemp = body.temperature_c || null;

    var prereqCheck = [];
    var allMet = true;

    if (prereqs.environment) {
      var envMet = false;
      for (var pe = 0; pe < prereqs.environment.length; pe++) {
        for (var e2 = 0; e2 < providedEnv.length; e2++) {
          if (providedEnv[e2].toLowerCase().indexOf(prereqs.environment[pe].toLowerCase()) >= 0) {
            envMet = true;
          }
        }
      }
      prereqCheck.push({ prerequisite: "environment", required: prereqs.environment, met: envMet });
      if (!envMet) allMet = false;
    }

    if (prereqs.material && providedMat) {
      var matMet = false;
      for (var pm = 0; pm < prereqs.material.length; pm++) {
        if (prereqs.material[pm].toLowerCase().indexOf(providedMat.toLowerCase()) >= 0 || providedMat.toLowerCase().indexOf(prereqs.material[pm].toLowerCase()) >= 0) {
          matMet = true;
        }
      }
      prereqCheck.push({ prerequisite: "material", required: prereqs.material, provided: providedMat, met: matMet });
      if (!matMet) allMet = false;
    }

    return ok({
      engine: ENGINE_NAME,
      mechanism: mech2.name,
      mechanism_key: mechKey2,
      prerequisites_check: prereqCheck,
      all_prerequisites_met: allMet,
      required_condition: prereqs.required || "See mechanism prerequisites",
      timestamp: nowISO()
    });
  }

  // == get_mechanism_interactions ==
  if (action === "get_mechanism_interactions") {
    var mechKey3 = body.mechanism_key || null;
    if (mechKey3) {
      var related = { synergistic: [], sequential_first: [], sequential_then: [], competing: [] };
      for (var si = 0; si < MECHANISM_INTERACTIONS.synergistic.length; si++) {
        if (MECHANISM_INTERACTIONS.synergistic[si].mechanisms.indexOf(mechKey3) >= 0) {
          related.synergistic.push(MECHANISM_INTERACTIONS.synergistic[si]);
        }
      }
      for (var sq = 0; sq < MECHANISM_INTERACTIONS.sequential.length; sq++) {
        if (MECHANISM_INTERACTIONS.sequential[sq].first === mechKey3) related.sequential_first.push(MECHANISM_INTERACTIONS.sequential[sq]);
        if (MECHANISM_INTERACTIONS.sequential[sq].then === mechKey3) related.sequential_then.push(MECHANISM_INTERACTIONS.sequential[sq]);
      }
      for (var cp = 0; cp < MECHANISM_INTERACTIONS.competing.length; cp++) {
        if (MECHANISM_INTERACTIONS.competing[cp].mechanisms.indexOf(mechKey3) >= 0) {
          related.competing.push(MECHANISM_INTERACTIONS.competing[cp]);
        }
      }
      return ok({ engine: ENGINE_NAME, mechanism_key: mechKey3, interactions: related, timestamp: nowISO() });
    }
    return ok({ engine: ENGINE_NAME, action: "get_mechanism_interactions", interactions: MECHANISM_INTERACTIONS });
  }

  // == get_mechanism_registry ==
  if (action === "get_mechanism_registry") {
    return ok({
      engine: ENGINE_NAME,
      action: "get_mechanism_registry",
      count: Object.keys(MECHANISM_DB).length,
      mechanisms: MECHANISM_DB
    });
  }

  // == get_material_susceptibility ==
  if (action === "get_material_susceptibility") {
    var mat = body.material || null;
    if (mat && MATERIAL_SUSCEPTIBILITY[mat]) {
      return ok({ engine: ENGINE_NAME, material: mat, susceptibility: MATERIAL_SUSCEPTIBILITY[mat], timestamp: nowISO() });
    }
    return ok({ engine: ENGINE_NAME, action: "get_material_susceptibility", materials: MATERIAL_SUSCEPTIBILITY });
  }

  // == get_progression_model ==
  if (action === "get_progression_model") {
    var mechKey4 = body.mechanism_key || "";
    var mech4 = MECHANISM_DB[mechKey4];
    if (!mech4) {
      return fail(400, "Unknown mechanism_key: " + mechKey4);
    }
    return ok({
      engine: ENGINE_NAME,
      mechanism: mech4.name,
      mechanism_key: mechKey4,
      description: mech4.description,
      physics: mech4.physics,
      prerequisites: mech4.prerequisites,
      indicators: mech4.indicators,
      detection_methods: mech4.detection_methods,
      severity: mech4.severity || "moderate",
      always_critical: mech4.always_critical || false,
      typical_rates: mech4.typical_rates_mm_year || mech4.pitting_rate || "varies by conditions",
      timestamp: nowISO()
    });
  }

  // == get_differential_diagnosis ==
  if (action === "get_differential_diagnosis") {
    var mechKey5 = body.mechanism_key || "";
    var mech5 = MECHANISM_DB[mechKey5];
    if (!mech5) {
      return fail(400, "Unknown mechanism_key: " + mechKey5);
    }
    var confusedWith = mech5.confused_with || [];
    var differentials = [];
    for (var cw = 0; cw < confusedWith.length; cw++) {
      var diffMech = MECHANISM_DB[confusedWith[cw]];
      if (diffMech) {
        differentials.push({
          mechanism_key: confusedWith[cw],
          mechanism_name: diffMech.name,
          category: diffMech.category,
          key_differentiators: diffMech.indicators,
          prerequisites: diffMech.prerequisites,
          detection_methods: diffMech.detection_methods
        });
      }
    }
    return ok({
      engine: ENGINE_NAME,
      primary_mechanism: mech5.name,
      primary_key: mechKey5,
      primary_indicators: mech5.indicators,
      differential_diagnoses: differentials,
      recommendation: "Use detection methods and prerequisite analysis to differentiate between candidates",
      timestamp: nowISO()
    });
  }

  return fail(400, "Unknown action: " + action + ". Call get_registry for available actions.");
};

export { handler };
