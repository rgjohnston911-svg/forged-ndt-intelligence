// DEPLOY82 — Incident-to-Inspection Intelligence Chain v1
// 6 Deterministic Engines — Replaces GPT-4o Reasoning Layer
// Reference Standards: API 571, API 579-1/ASME FFS-1, API 510, API 570, API 653,
//   ASME PCC-2, AWS D1.1, ASME B31.3, ASME B31.8, API RP 2A, API RP 941,
//   NACE MR0175/ISO 15156, NACE SP0472
// NO TEMPLATE LITERALS — STRING CONCATENATION ONLY
// ALL LOGIC INLINED — NO LIB IMPORTS

import { Handler } from "@netlify/functions";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ParsedIncident {
  events: string[];
  environment: string[];
  numeric_values: {
    wind_speed_mph?: number;
    wave_height_ft?: number;
    pressure_psi?: number;
    temperature_f?: number;
    distance_miles?: number;
    thickness_in?: number;
    diameter_in?: number;
    duration_hours?: number;
    [key: string]: number | undefined;
  };
  raw_text: string;
}

interface ResolvedAsset {
  asset_class: string;
  asset_type: string;
  confidence: number;
  material_group?: string;
}

interface DamageMechanism {
  id: string;
  name: string;
  api_571_ref: string;
  description: string;
  source_trigger: string;
  severity: "critical" | "high" | "medium" | "low";
  requires_immediate_action: boolean;
  susceptible_materials: string[];
  temperature_range_f?: { min: number; max: number } | null;
  contributing_factors: string[];
}

interface AffectedZone {
  zone_id: string;
  zone_name: string;
  priority: number;
  damage_mechanisms: string[];
  rationale: string;
  asset_specific: boolean;
}

interface InspectionMethod {
  method_id: string;
  method_name: string;
  technique_variant: string;
  target_mechanism: string;
  target_zone: string;
  detection_capability: string;
  sizing_capability: string;
  code_reference: string;
  rationale: string;
  priority: number;
  personnel_qualification: string;
  limitations: string;
}

interface CodeActionPath {
  finding_type: string;
  primary_code: string;
  code_section: string;
  required_action: string;
  ffs_assessment: string;
  repair_standard: string;
  documentation_required: string[];
  engineering_review_required: boolean;
}

interface EscalationTier {
  tier_name: string;
  time_window: string;
  hours_min: number;
  hours_max: number;
  actions: string[];
  personnel_required: string[];
  notifications: string[];
  documentation: string[];
}

interface ExecutionPackage {
  role: string;
  summary: string;
  action_items: string[];
  timeline: string;
  key_decisions: string[];
  resources_needed: string[];
}

interface ChainOutput {
  engine_version: string;
  timestamp: string;
  input_summary: {
    asset_class: string;
    asset_type: string;
    events: string[];
    environment: string[];
    numeric_values: { [key: string]: number | undefined };
  };
  engine_1_damage_mechanisms: DamageMechanism[];
  engine_2_affected_zones: AffectedZone[];
  engine_3_inspection_methods: InspectionMethod[];
  engine_4_code_action_paths: CodeActionPath[];
  engine_5_escalation_timeline: EscalationTier[];
  engine_6_execution_packages: ExecutionPackage[];
  confidence_scores: {
    mechanism_confidence: number;
    zone_confidence: number;
    method_confidence: number;
    overall_confidence: number;
  };
  warnings: string[];
}


// ============================================================================
// ENGINE 1: EVENT-TO-DAMAGE MECHANISM ENGINE
// Reference: API 571 (Damage Mechanisms Affecting Fixed Equipment in the
//   Refining Industry), NACE MR0175/ISO 15156, API RP 941
// ============================================================================

// --- SERVICE ENVIRONMENT TO DAMAGE MECHANISM MAPPINGS ---
// Each mapping includes API 571 section references where applicable

var SERVICE_MECHANISM_MAP: { [key: string]: Array<{
  id: string;
  name: string;
  api_571_ref: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  requires_immediate: boolean;
  susceptible_materials: string[];
  temp_range_f: { min: number; max: number } | null;
  contributing_factors: string[];
}> } = {

  "sour_service": [
    {
      id: "SSC",
      name: "Sulfide Stress Cracking",
      api_571_ref: "API 571 5.1.2.3 (Wet H2S Damage — SSC)",
      description: "Cracking of susceptible metals under tensile stress in the presence of water and H2S. Occurs in high-hardness zones, weld HAZs, and cold-worked areas. Can cause sudden brittle fracture without warning.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["carbon_steel_high_hardness", "low_alloy_steel", "high_strength_bolting", "400_series_SS"],
      temp_range_f: { min: 32, max: 300 },
      contributing_factors: ["hardness_above_22HRC", "high_tensile_stress", "pH_below_4", "H2S_partial_pressure", "cold_working", "inadequate_PWHT"]
    },
    {
      id: "HIC",
      name: "Hydrogen Induced Cracking",
      api_571_ref: "API 571 5.1.2.3 (Wet H2S Damage — HIC)",
      description: "Stepwise internal cracking caused by hydrogen atom recombination at non-metallic inclusions (MnS stringers). Blistering at surface, internal stepwise cracking through wall. Not stress-dependent.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["carbon_steel", "low_alloy_steel", "non_HIC_resistant_plate"],
      temp_range_f: { min: 32, max: 300 },
      contributing_factors: ["MnS_inclusions", "banding", "high_sulfur_content_steel", "pH_below_5", "cyanides_present", "non_HIC_resistant_steel"]
    },
    {
      id: "SOHIC",
      name: "Stress-Oriented Hydrogen Induced Cracking",
      api_571_ref: "API 571 5.1.2.3 (Wet H2S Damage — SOHIC)",
      description: "Array of HIC cracks stacked and linked in the through-wall direction by SSC, driven by high local stress at weld toes and HAZs. Combines HIC and SSC mechanisms. Most dangerous form of wet H2S damage.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["carbon_steel", "low_alloy_steel"],
      temp_range_f: { min: 32, max: 300 },
      contributing_factors: ["high_residual_stress", "inadequate_PWHT", "MnS_inclusions", "weld_HAZ", "high_constraint_geometry"]
    },
    {
      id: "BLISTERING",
      name: "Hydrogen Blistering",
      api_571_ref: "API 571 5.1.2.3 (Wet H2S Damage — Blistering)",
      description: "Surface bulges caused by hydrogen accumulation at laminations or inclusions near the surface. May not affect structural integrity directly but indicates active hydrogen charging.",
      severity: "high",
      requires_immediate: false,
      susceptible_materials: ["carbon_steel", "low_alloy_steel"],
      temp_range_f: { min: 32, max: 300 },
      contributing_factors: ["laminations", "inclusions", "low_pH", "cyanides", "high_H2S"]
    },
    {
      id: "SULFIDATION",
      name: "High Temperature Sulfidation",
      api_571_ref: "API 571 5.1.1.3 (High Temperature H2S / H2 Corrosion — Sulfidation)",
      description: "Corrosion by H2S and sulfur compounds at elevated temperatures. Forms iron sulfide scale. Rate increases significantly above 500F. Cr-Mo steels and 300-series SS more resistant.",
      severity: "high",
      requires_immediate: false,
      susceptible_materials: ["carbon_steel", "low_chrome_alloys"],
      temp_range_f: { min: 500, max: 1400 },
      contributing_factors: ["high_temperature", "sulfur_content", "naphthenic_acids", "velocity"]
    }
  ],

  "hydrogen_service": [
    {
      id: "HTHA",
      name: "High Temperature Hydrogen Attack",
      api_571_ref: "API 571 5.1.3.1 (HTHA) / API RP 941",
      description: "Hydrogen diffuses into steel at high temperature and pressure, reacts with carbon to form methane at grain boundaries. Causes irreversible fissuring and decarburization. Nelson Curves (API RP 941) define safe operating limits. Damage is NOT detectable by conventional UT — requires AUBT or advanced PAUT.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["carbon_steel", "C-0.5Mo_steel", "low_chrome_below_2.25Cr"],
      temp_range_f: { min: 400, max: 1200 },
      contributing_factors: ["hydrogen_partial_pressure", "temperature_above_Nelson_curve", "time_at_temperature", "carbon_content", "prior_PWHT_quality"]
    },
    {
      id: "HIC_H2",
      name: "Hydrogen Induced Cracking (Hydrogen Service)",
      api_571_ref: "API 571 5.1.2.3",
      description: "Hydrogen charging from high-pressure hydrogen environments. Same mechanism as wet H2S HIC but hydrogen source is gaseous H2 at high pressure rather than H2S dissociation.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["carbon_steel", "low_alloy_steel"],
      temp_range_f: { min: 32, max: 600 },
      contributing_factors: ["hydrogen_partial_pressure", "inclusions", "banding", "high_strength_steel"]
    },
    {
      id: "H2_EMBRITTLEMENT",
      name: "Hydrogen Embrittlement",
      api_571_ref: "API 571 5.1.2.2 (Hydrogen Embrittlement)",
      description: "Loss of ductility and tensile strength from dissolved hydrogen. Particularly dangerous in high-strength steels, bolting, and hardened components. Reversible if hydrogen removed before cracking initiates.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["high_strength_steel", "martensitic_SS", "precipitation_hardened_alloys", "high_strength_bolting"],
      temp_range_f: { min: -100, max: 300 },
      contributing_factors: ["yield_strength_above_90ksi", "hardness_above_22HRC", "cold_working", "plating_or_coating", "slow_strain_rate"]
    }
  ],

  "high_temperature": [
    {
      id: "CREEP",
      name: "Creep / Stress Rupture",
      api_571_ref: "API 571 5.1.3.2 (Creep / Stress Rupture)",
      description: "Time-dependent deformation and eventual rupture under sustained stress at elevated temperature. Carbon steel susceptible above 700F, Cr-Mo above 750-900F depending on grade. Three stages: primary (decreasing rate), secondary (steady state), tertiary (accelerating to rupture).",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["carbon_steel", "low_alloy_steel", "Cr_Mo_steel", "300_series_SS"],
      temp_range_f: { min: 700, max: 1500 },
      contributing_factors: ["operating_temperature", "stress_level", "time_at_temperature", "prior_overheating", "weld_quality"]
    },
    {
      id: "THERMAL_FATIGUE",
      name: "Thermal Fatigue",
      api_571_ref: "API 571 5.1.3.3 (Thermal Fatigue)",
      description: "Cracking from cyclic thermal stresses caused by temperature fluctuations. Occurs at mixing points, quench zones, and areas with differential thermal expansion. Cracks are typically transgranular.",
      severity: "high",
      requires_immediate: false,
      susceptible_materials: ["carbon_steel", "low_alloy_steel", "300_series_SS", "nickel_alloys"],
      temp_range_f: { min: 200, max: 1200 },
      contributing_factors: ["thermal_cycling", "temperature_differential", "constraint", "mixing_points", "quench_operations"]
    },
    {
      id: "GRAPHITIZATION",
      name: "Graphitization",
      api_571_ref: "API 571 5.1.3.4 (Graphitization)",
      description: "Decomposition of pearlite (iron carbide) into ferrite and graphite nodules at elevated temperature over long periods. Carbon and C-0.5Mo steels susceptible above 800F. Causes localized loss of strength, particularly in HAZs.",
      severity: "high",
      requires_immediate: false,
      susceptible_materials: ["carbon_steel", "C-0.5Mo_steel"],
      temp_range_f: { min: 800, max: 1100 },
      contributing_factors: ["long_time_at_temperature", "weld_HAZ", "aluminum_killed_steel"]
    },
    {
      id: "SPHEROIDIZATION",
      name: "Softening / Spheroidization",
      api_571_ref: "API 571 5.1.3.5 (Softening / Temper Embrittlement)",
      description: "Spheroidization of carbides at elevated temperature causing gradual loss of strength and hardness. Particularly affects carbon steel and C-0.5Mo above 850F over extended service.",
      severity: "medium",
      requires_immediate: false,
      susceptible_materials: ["carbon_steel", "C-0.5Mo_steel"],
      temp_range_f: { min: 850, max: 1200 },
      contributing_factors: ["extended_service_above_850F", "original_heat_treatment"]
    },
    {
      id: "CARBURIZATION",
      name: "Carburization",
      api_571_ref: "API 571 5.1.3.7 (Carburization)",
      description: "Carbon absorption into metal at high temperature in carbon-rich environments (coke, hydrocarbons). Increases hardness and reduces ductility. Common in ethylene pyrolysis furnace tubes.",
      severity: "medium",
      requires_immediate: false,
      susceptible_materials: ["300_series_SS", "Cr_Mo_steel", "nickel_alloys"],
      temp_range_f: { min: 1100, max: 2000 },
      contributing_factors: ["hydrocarbon_environment", "high_temperature", "reducing_conditions"]
    },
    {
      id: "OXIDATION",
      name: "High Temperature Oxidation",
      api_571_ref: "API 571 5.1.3.8 (Oxidation)",
      description: "Formation and growth of oxide scale at elevated temperatures. Scale may spall during thermal cycling, exposing fresh metal. Rate increases exponentially with temperature.",
      severity: "medium",
      requires_immediate: false,
      susceptible_materials: ["carbon_steel", "low_alloy_steel"],
      temp_range_f: { min: 900, max: 1500 },
      contributing_factors: ["temperature", "oxygen_partial_pressure", "thermal_cycling", "velocity"]
    },
    {
      id: "TEMPER_EMBRITTLEMENT",
      name: "Temper Embrittlement",
      api_571_ref: "API 571 5.1.3.5 (Temper Embrittlement)",
      description: "Shift of ductile-to-brittle transition temperature upward due to segregation of tramp elements (P, Sn, As, Sb) to grain boundaries during long-term exposure at 650-1070F. Detected by Charpy impact testing or hardness. NOT visible by NDE during operation.",
      severity: "high",
      requires_immediate: false,
      susceptible_materials: ["2.25Cr-1Mo", "3Cr-1Mo", "Cr_Mo_V_steels"],
      temp_range_f: { min: 650, max: 1070 },
      contributing_factors: ["tramp_elements_P_Sn_As_Sb", "long_exposure", "J_factor_above_100", "X_bar_above_15"]
    }
  ],

  "cyclic_service": [
    {
      id: "MECH_FATIGUE",
      name: "Mechanical Fatigue",
      api_571_ref: "API 571 5.1.2.1 (Mechanical Fatigue)",
      description: "Progressive cracking from cyclic mechanical loading. Initiates at stress concentrators (notches, weld toes, thread roots, pits) and propagates under continued cycling. Beach marks and striations on fracture surface.",
      severity: "high",
      requires_immediate: false,
      susceptible_materials: ["all_metals"],
      temp_range_f: null,
      contributing_factors: ["cyclic_loading", "stress_concentrators", "weld_toe_geometry", "vibration", "pressure_cycling", "lack_of_PWHT"]
    },
    {
      id: "VIB_FATIGUE",
      name: "Vibration-Induced Fatigue",
      api_571_ref: "API 571 5.1.2.1 (subset — vibration fatigue)",
      description: "Fatigue cracking caused by flow-induced vibration, mechanical vibration from rotating equipment, or acoustic-induced vibration. Particularly affects small-bore connections, socket welds, and branch connections.",
      severity: "high",
      requires_immediate: true,
      susceptible_materials: ["all_metals", "small_bore_piping", "socket_welds"],
      temp_range_f: null,
      contributing_factors: ["flow_induced_vibration", "rotating_equipment", "acoustic_excitation", "resonance", "inadequate_support"]
    }
  ],

  "corrosion": [
    {
      id: "GENERAL_CORROSION",
      name: "General / Uniform Corrosion",
      api_571_ref: "API 571 5.1.1.1 (General — various sections)",
      description: "Relatively uniform thinning of metal from electrochemical or chemical reaction. Predictable by corrosion rate monitoring. Most common damage mechanism by frequency.",
      severity: "medium",
      requires_immediate: false,
      susceptible_materials: ["carbon_steel", "low_alloy_steel"],
      temp_range_f: null,
      contributing_factors: ["process_fluid", "water", "pH", "temperature", "velocity", "oxygen"]
    },
    {
      id: "PITTING",
      name: "Pitting Corrosion",
      api_571_ref: "API 571 5.1.1.1 (Localized corrosion)",
      description: "Localized attack forming small cavities or pits. More dangerous than general corrosion because depth-to-area ratio is high, difficult to detect, and can cause through-wall penetration at low overall metal loss.",
      severity: "high",
      requires_immediate: false,
      susceptible_materials: ["carbon_steel", "300_series_SS", "duplex_SS"],
      temp_range_f: null,
      contributing_factors: ["stagnant_conditions", "chlorides", "under_deposits", "MIC", "oxygen_concentration_cells"]
    },
    {
      id: "CUI",
      name: "Corrosion Under Insulation",
      api_571_ref: "API 571 5.1.1.2 (CUI)",
      description: "External corrosion under thermal insulation. Water ingress through damaged insulation, jacketing, or sealant failures causes accelerated corrosion. Carbon steel loses 25-100+ mpy. 300-series SS subject to chloride SCC under insulation. Most prevalent between 25-350F.",
      severity: "high",
      requires_immediate: false,
      susceptible_materials: ["carbon_steel", "300_series_SS"],
      temp_range_f: { min: 25, max: 350 },
      contributing_factors: ["damaged_insulation", "water_ingress", "intermittent_service", "steam_tracing", "chloride_contamination", "missing_vapor_barrier"]
    },
    {
      id: "MIC",
      name: "Microbiologically Influenced Corrosion",
      api_571_ref: "API 571 5.1.1.4 (MIC)",
      description: "Corrosion caused or accelerated by microorganisms (SRB, APB, IOB). Creates localized pitting under biofilms. Common in stagnant water systems, tank bottoms, and dead legs.",
      severity: "high",
      requires_immediate: false,
      susceptible_materials: ["carbon_steel", "300_series_SS", "copper_alloys"],
      temp_range_f: { min: 32, max: 175 },
      contributing_factors: ["stagnant_water", "low_flow", "dead_legs", "nutrients", "warm_temperature"]
    },
    {
      id: "EROSION",
      name: "Erosion / Erosion-Corrosion",
      api_571_ref: "API 571 5.1.1.5 (Erosion/Erosion-Corrosion)",
      description: "Metal loss from impingement of fluid, particles, or droplets. Accelerated at changes in direction, restrictions, and areas of turbulence. Thinning pattern follows flow path.",
      severity: "high",
      requires_immediate: false,
      susceptible_materials: ["carbon_steel", "copper_alloys", "low_alloy_steel"],
      temp_range_f: null,
      contributing_factors: ["high_velocity", "particulates", "two_phase_flow", "changes_in_direction", "restrictions"]
    },
    {
      id: "FAC",
      name: "Flow-Accelerated Corrosion",
      api_571_ref: "API 571 5.1.1.6 (FAC — applies to power/utility but also process)",
      description: "Dissolution of normally protective oxide layer by flowing water or wet steam. Creates scalloped or orange-peel surface pattern. Most severe in carbon steel between 200-500F, single-phase or two-phase flow.",
      severity: "high",
      requires_immediate: false,
      susceptible_materials: ["carbon_steel"],
      temp_range_f: { min: 200, max: 500 },
      contributing_factors: ["low_pH", "low_oxygen", "high_velocity", "turbulence", "geometry_changes"]
    }
  ],

  "amine_service": [
    {
      id: "AMINE_SCC",
      name: "Amine Stress Corrosion Cracking",
      api_571_ref: "API 571 5.1.2.4 (Amine Cracking)",
      description: "Alkaline stress corrosion cracking in amine treating units (MEA, DEA, MDEA). Occurs in carbon steel at weld HAZs without adequate PWHT. Cracking is intergranular and typically tight.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["carbon_steel"],
      temp_range_f: null,
      contributing_factors: ["lean_amine", "rich_amine", "no_PWHT", "high_residual_stress", "amine_concentration", "acid_gas_loading"]
    },
    {
      id: "AMINE_CORROSION",
      name: "Amine Corrosion",
      api_571_ref: "API 571 5.1.1.8 (Amine Corrosion)",
      description: "Corrosion in amine treating systems from acid gas loading, degradation products, and heat stable salts. Most severe in hot lean amine areas, reboiler tubes, and overhead systems.",
      severity: "medium",
      requires_immediate: false,
      susceptible_materials: ["carbon_steel"],
      temp_range_f: { min: 200, max: 500 },
      contributing_factors: ["high_acid_gas_loading", "degradation_products", "heat_stable_salts", "high_velocity"]
    }
  ],

  "caustic_service": [
    {
      id: "CAUSTIC_SCC",
      name: "Caustic Stress Corrosion Cracking",
      api_571_ref: "API 571 5.1.2.5 (Caustic SCC / Caustic Embrittlement)",
      description: "Intergranular SCC of carbon steel in caustic (NaOH, KOH) environments. Risk increases with concentration and temperature. NACE SP0403 defines safe limits. PWHT required for all welds in caustic service above threshold.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["carbon_steel", "low_alloy_steel"],
      temp_range_f: { min: 120, max: 500 },
      contributing_factors: ["caustic_concentration", "temperature", "no_PWHT", "high_residual_stress", "concentration_mechanisms"]
    },
    {
      id: "CAUSTIC_CORROSION",
      name: "Caustic Corrosion / Gouging",
      api_571_ref: "API 571 5.1.1.9 (Caustic Corrosion)",
      description: "Localized corrosion or gouging attack from concentrated caustic solutions. Creates smooth, rounded pits or grooves. Common under deposits where caustic concentrates.",
      severity: "medium",
      requires_immediate: false,
      susceptible_materials: ["carbon_steel"],
      temp_range_f: { min: 150, max: 500 },
      contributing_factors: ["caustic_concentration", "temperature", "heat_flux", "deposits"]
    }
  ],

  "chloride_service": [
    {
      id: "CL_SCC",
      name: "Chloride Stress Corrosion Cracking",
      api_571_ref: "API 571 5.1.2.6 (Chloride SCC)",
      description: "Transgranular branching SCC of austenitic stainless steels in chloride-containing environments above ~140F. Common in 304/316 SS. Duplex SS and high-nickel alloys more resistant.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["304_SS", "316_SS", "321_SS", "347_SS", "300_series_SS"],
      temp_range_f: { min: 140, max: 600 },
      contributing_factors: ["chloride_concentration", "temperature", "tensile_stress", "oxygen", "pH", "concentration_by_evaporation"]
    }
  ],

  "naphthenic_acid": [
    {
      id: "NAC",
      name: "Naphthenic Acid Corrosion",
      api_571_ref: "API 571 5.1.1.10 (Naphthenic Acid Corrosion)",
      description: "Corrosion from naphthenic acids in crude oil at elevated temperatures. TAN (Total Acid Number) above 0.5 indicates risk. Most severe at 430-750F. Creates sharp-edged erosion-like patterns.",
      severity: "high",
      requires_immediate: false,
      susceptible_materials: ["carbon_steel", "5Cr_steel", "9Cr_steel"],
      temp_range_f: { min: 430, max: 750 },
      contributing_factors: ["high_TAN", "high_temperature", "high_velocity", "sulfur_content_interaction"]
    }
  ],

  "polythionic_acid": [
    {
      id: "PTA_SCC",
      name: "Polythionic Acid Stress Corrosion Cracking",
      api_571_ref: "API 571 5.1.2.7 (PTA SCC)",
      description: "Intergranular SCC of sensitized austenitic SS exposed to polythionic acids during shutdowns. Formed when iron sulfide scale reacts with moisture and oxygen. Prevented by soda ash neutralization or N2 purge per NACE SP0170.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["304_SS", "316_SS", "321_SS", "347_SS", "sensitized_austenitic_SS"],
      temp_range_f: { min: 32, max: 150 },
      contributing_factors: ["sensitization", "sulfide_scale", "moisture", "oxygen", "shutdown_conditions"]
    }
  ],

  "offshore": [
    {
      id: "MARINE_CORROSION",
      name: "Marine / Seawater Corrosion",
      api_571_ref: "General — NACE/DNV/API RP 2A",
      description: "Accelerated corrosion in marine environments. Splash zone most severe (5-15 mpy CS). Submerged zones protected by CP. Atmospheric zone moderate. CP effectiveness critical for submerged structures.",
      severity: "high",
      requires_immediate: false,
      susceptible_materials: ["carbon_steel", "low_alloy_steel"],
      temp_range_f: null,
      contributing_factors: ["splash_zone", "tidal_zone", "CP_deficiency", "coating_breakdown", "marine_growth", "salinity"]
    },
    {
      id: "CP_DEFICIENCY",
      name: "Cathodic Protection Deficiency",
      api_571_ref: "NACE SP0176 / DNV-RP-B401",
      description: "Inadequate cathodic protection leading to accelerated corrosion of submerged or buried steel. Anode depletion, cable damage, or interference can cause under-protection.",
      severity: "high",
      requires_immediate: false,
      susceptible_materials: ["carbon_steel"],
      temp_range_f: null,
      contributing_factors: ["anode_depletion", "coating_damage", "interference", "increased_current_demand"]
    }
  ],

  "fire_exposure": [
    {
      id: "FIRE_DAMAGE",
      name: "Fire Damage / Short-Term Overheating",
      api_571_ref: "API 571 5.1.3.6 (Short-Term Overheating) / API 579-1 Part 11",
      description: "Metallurgical changes, distortion, and potential creep damage from fire exposure. Above 1000F: potential metallurgical changes. Above 1200F: significant property degradation. Springback test, hardness survey, and metallographic replication required for assessment.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["all_metals"],
      temp_range_f: { min: 700, max: 2500 },
      contributing_factors: ["fire_duration", "peak_temperature", "cooling_rate", "applied_stress_during_fire", "original_design_margin"]
    },
    {
      id: "METALLURGICAL_CHANGE",
      name: "Metallurgical Changes from Fire",
      api_571_ref: "API 579-1 Part 11 / API 571 5.1.3",
      description: "Phase transformations, grain growth, carbide dissolution, sensitization, or other irreversible metallurgical changes from fire exposure. Carbon steel above 1350F may transform. Stainless steels may sensitize.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["all_metals"],
      temp_range_f: { min: 1000, max: 2500 },
      contributing_factors: ["peak_temperature", "time_at_temperature", "cooling_rate", "material_composition"]
    }
  ],

  "impact_event": [
    {
      id: "MECH_DAMAGE",
      name: "Mechanical Damage (Denting / Gouging)",
      api_571_ref: "API 579-1 Part 12 (Dents, Gouges, and Dent-Gouge Combinations)",
      description: "Physical deformation from impact, dropped objects, or external forces. Dents cause local stress concentration. Gouges remove material and may introduce cracks. Dent-gouge combinations are most severe.",
      severity: "high",
      requires_immediate: true,
      susceptible_materials: ["all_metals"],
      temp_range_f: null,
      contributing_factors: ["impact_force", "object_type", "wall_thickness", "material_ductility"]
    },
    {
      id: "STRUCTURAL_OVERLOAD",
      name: "Structural Overload / Deformation",
      api_571_ref: "API 579-1 Part 8 (Weld Misalignment and Shell Distortion)",
      description: "Gross plastic deformation exceeding design allowances from impact, explosion, or extreme loading. Requires dimensional survey and structural integrity assessment.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["all_metals"],
      temp_range_f: null,
      contributing_factors: ["load_magnitude", "load_duration", "geometry", "restraint"]
    }
  ],

  "seismic_event": [
    {
      id: "FOUNDATION_DAMAGE",
      name: "Foundation / Anchor Bolt Damage",
      api_571_ref: "API 579-1 / API 653 Annex M (Seismic assessment)",
      description: "Damage to foundations, anchor bolts, and support structures from seismic loading. Includes bolt elongation, concrete cracking, grout deterioration, and pedestal damage.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["anchor_bolts", "foundation_concrete", "grout"],
      temp_range_f: null,
      contributing_factors: ["seismic_magnitude", "soil_conditions", "natural_frequency_match", "anchor_bolt_design"]
    },
    {
      id: "NOZZLE_PIPING_LOADS",
      name: "Nozzle and Piping Overloads",
      api_571_ref: "ASME B31.3 / API 579-1",
      description: "Overstress of nozzle connections and piping from seismic-induced relative movement. Spring hangers bottomed out, snubbers engaged, expansion joints exceeded travel.",
      severity: "high",
      requires_immediate: true,
      susceptible_materials: ["all_metals"],
      temp_range_f: null,
      contributing_factors: ["relative_movement", "support_adequacy", "flexibility_analysis"]
    }
  ],

  "hurricane_event": [
    {
      id: "WIND_STRUCTURAL",
      name: "Wind Damage — Structural",
      api_571_ref: "API RP 2A / AISC 360 / ASCE 7",
      description: "Structural damage from extreme wind loading. Includes brace buckling, joint overload, platform deck damage, and equipment displacement. Offshore platforms and elevated structures most vulnerable.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["structural_steel", "connections", "braces"],
      temp_range_f: null,
      contributing_factors: ["wind_speed", "duration", "gust_factor", "structure_natural_period", "fatigue_prior_damage"]
    },
    {
      id: "WAVE_LOADING",
      name: "Wave / Storm Surge Loading",
      api_571_ref: "API RP 2A / API RP 2MET",
      description: "Hydrodynamic loading from waves and storm surge on offshore structures. Includes wave-in-deck loading if surge raises water level to platform deck. Can cause jacket leg buckling, mudline scour, and foundation displacement.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["structural_steel", "jacket_legs", "piles"],
      temp_range_f: null,
      contributing_factors: ["wave_height", "storm_surge", "wave_in_deck", "scour", "fatigue_accumulation"]
    },
    {
      id: "DEBRIS_IMPACT",
      name: "Debris / Projectile Impact",
      api_571_ref: "General engineering assessment",
      description: "Impact damage from wind-borne debris, displaced equipment, or collision with vessels/barges that broke free during storm.",
      severity: "high",
      requires_immediate: true,
      susceptible_materials: ["all_metals", "piping", "vessels", "instrumentation"],
      temp_range_f: null,
      contributing_factors: ["debris_type", "velocity", "impact_location", "wall_thickness_at_impact"]
    }
  ],

  "vibration": [
    {
      id: "VIB_FATIGUE_V",
      name: "Vibration-Induced Fatigue",
      api_571_ref: "API 571 5.1.2.1 / ASME B31.3 / API RP 581",
      description: "High-cycle fatigue from continuous mechanical or flow-induced vibration. Small-bore connections, unsupported spans, and socket welds are highest risk. Can progress from initiation to through-wall in days to weeks under resonance.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["all_metals", "socket_welds", "small_bore_connections", "threaded_connections"],
      temp_range_f: null,
      contributing_factors: ["vibration_amplitude", "frequency", "resonance", "damping", "support_spacing", "connection_type"]
    }
  ],

  "explosion": [
    {
      id: "BLAST_DAMAGE",
      name: "Blast / Overpressure Damage",
      api_571_ref: "API 579-1 / ASCE blast loading guidelines",
      description: "Damage from blast overpressure wave. Includes vessel distortion, piping displacement, structural member buckling, and instrument destruction. Blast effects diminish with distance but reflected waves can amplify locally.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["all_metals", "instruments", "electrical"],
      temp_range_f: null,
      contributing_factors: ["blast_overpressure", "standoff_distance", "confinement", "reflection"]
    }
  ],

  "overpressure": [
    {
      id: "OVERPRESSURE_DAMAGE",
      name: "Overpressure Event Damage",
      api_571_ref: "API 579-1 Part 8 / ASME BPVC Section VIII",
      description: "Yielding, bulging, or cracking from pressure exceeding design limits. May cause permanent deformation, loss of circularity, or nozzle/flange leakage. Requires dimensional survey and FFS assessment.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["all_metals"],
      temp_range_f: null,
      contributing_factors: ["pressure_magnitude", "duration", "rate_of_pressurization", "temperature_at_event"]
    }
  ],

  "flood": [
    {
      id: "FLOOD_DAMAGE",
      name: "Flood / Submersion Damage",
      api_571_ref: "General — API 575 / engineering assessment",
      description: "Foundation undermining, CUI acceleration from saturation, soil corrosion of buried components, electrical and instrumentation damage from submersion. Debris impact may also occur.",
      severity: "high",
      requires_immediate: true,
      susceptible_materials: ["carbon_steel", "foundations", "electrical", "instrumentation"],
      temp_range_f: null,
      contributing_factors: ["water_depth", "duration", "debris", "soil_type", "drainage"]
    }
  ]
};

// --- EVENT KEYWORD TO SERVICE ENVIRONMENT MAPPING ---
// Used to cross-reference parse-incident event detection with service environments

var EVENT_TO_ENVIRONMENT: { [key: string]: string[] } = {
  "hurricane": ["hurricane_event", "offshore"],
  "typhoon": ["hurricane_event", "offshore"],
  "tropical_storm": ["hurricane_event", "offshore"],
  "storm": ["hurricane_event"],
  "fire": ["fire_exposure", "high_temperature"],
  "explosion": ["explosion", "fire_exposure", "impact_event"],
  "earthquake": ["seismic_event"],
  "seismic": ["seismic_event"],
  "vibration": ["vibration", "cyclic_service"],
  "impact": ["impact_event"],
  "collision": ["impact_event"],
  "overpressure": ["overpressure"],
  "flood": ["flood"],
  "tsunami": ["flood", "seismic_event"],
  "corrosion": ["corrosion"],
  "erosion": ["corrosion"],
  "fatigue": ["cyclic_service"],
  "leak": ["corrosion"],
  "crack": ["cyclic_service"],
  "upset": ["overpressure", "high_temperature"]
};

// --- ADDITIONAL ENVIRONMENT DETECTION FROM TRANSCRIPT KEYWORDS ---

var TRANSCRIPT_ENV_KEYWORDS: { [key: string]: string[] } = {
  "sour": ["sour_service"],
  "h2s": ["sour_service"],
  "hydrogen sulfide": ["sour_service"],
  "wet h2s": ["sour_service"],
  "hydrogen": ["hydrogen_service"],
  "hydroprocessing": ["hydrogen_service", "high_temperature"],
  "hydrotreater": ["hydrogen_service", "high_temperature"],
  "hydrocracker": ["hydrogen_service", "high_temperature"],
  "reformer": ["hydrogen_service", "high_temperature"],
  "amine": ["amine_service"],
  "mea": ["amine_service"],
  "dea": ["amine_service"],
  "mdea": ["amine_service"],
  "caustic": ["caustic_service"],
  "sodium hydroxide": ["caustic_service"],
  "naoh": ["caustic_service"],
  "chloride": ["chloride_service"],
  "brackish": ["chloride_service"],
  "naphthenic": ["naphthenic_acid"],
  "high tan": ["naphthenic_acid"],
  "crude": ["naphthenic_acid", "corrosion"],
  "offshore": ["offshore"],
  "subsea": ["offshore"],
  "platform": ["offshore"],
  "jacket": ["offshore"],
  "riser": ["offshore"],
  "high temperature": ["high_temperature"],
  "creep range": ["high_temperature"],
  "furnace": ["high_temperature"],
  "heater": ["high_temperature"],
  "boiler": ["high_temperature"],
  "cyclic": ["cyclic_service"],
  "shutdown startup": ["cyclic_service", "polythionic_acid"],
  "thermal cycling": ["cyclic_service", "high_temperature"],
  "insulated": ["corrosion"],
  "insulation": ["corrosion"],
  "cui": ["corrosion"]
};


// --- ENGINE 1 FUNCTION ---

function runEngine1(
  parsed: ParsedIncident,
  asset: ResolvedAsset
): DamageMechanism[] {

  var mechanisms: DamageMechanism[] = [];
  var seen_ids: { [key: string]: boolean } = {};
  var all_environments: string[] = [];

  // Step 1: Collect environments from parsed incident
  if (parsed.environment && parsed.environment.length > 0) {
    for (var i = 0; i < parsed.environment.length; i++) {
      if (all_environments.indexOf(parsed.environment[i]) === -1) {
        all_environments.push(parsed.environment[i]);
      }
    }
  }

  // Step 2: Map events to environments
  if (parsed.events && parsed.events.length > 0) {
    for (var i = 0; i < parsed.events.length; i++) {
      var evt = parsed.events[i].toLowerCase().replace(/[^a-z0-9_]/g, "_");
      var mapped = EVENT_TO_ENVIRONMENT[evt];
      if (mapped) {
        for (var j = 0; j < mapped.length; j++) {
          if (all_environments.indexOf(mapped[j]) === -1) {
            all_environments.push(mapped[j]);
          }
        }
      }
    }
  }

  // Step 3: Scan transcript for additional environment keywords
  var raw_lower = (parsed.raw_text || "").toLowerCase();
  var keyword_keys = Object.keys(TRANSCRIPT_ENV_KEYWORDS);
  for (var k = 0; k < keyword_keys.length; k++) {
    if (raw_lower.indexOf(keyword_keys[k]) !== -1) {
      var envs = TRANSCRIPT_ENV_KEYWORDS[keyword_keys[k]];
      for (var j = 0; j < envs.length; j++) {
        if (all_environments.indexOf(envs[j]) === -1) {
          all_environments.push(envs[j]);
        }
      }
    }
  }

  // Step 4: Temperature-based environment inference
  var temp_f = parsed.numeric_values ? parsed.numeric_values.temperature_f : undefined;
  if (temp_f !== undefined) {
    if (temp_f > 700 && all_environments.indexOf("high_temperature") === -1) {
      all_environments.push("high_temperature");
    }
  }

  // Step 5: Look up damage mechanisms for each environment
  var temp_filtered: string[] = [];

  for (var e = 0; e < all_environments.length; e++) {
    var env = all_environments[e];
    var env_mechanisms = SERVICE_MECHANISM_MAP[env];
    if (!env_mechanisms) continue;

    for (var m = 0; m < env_mechanisms.length; m++) {
      var mech = env_mechanisms[m];

      // Deduplicate
      if (seen_ids[mech.id]) continue;

      // Temperature range filter if available
      if (temp_f !== undefined && mech.temp_range_f) {
        // Allow some margin (50F) for uncertainty
        if (temp_f < mech.temp_range_f.min - 50 || temp_f > mech.temp_range_f.max + 50) {
          temp_filtered.push(mech.id + " (" + mech.name + ") [active " + mech.temp_range_f.min + "-" + mech.temp_range_f.max + "F, reported temp: " + temp_f + "F]");
          continue;
        }
      }

      seen_ids[mech.id] = true;
      mechanisms.push({
        id: mech.id,
        name: mech.name,
        api_571_ref: mech.api_571_ref,
        description: mech.description,
        source_trigger: "environment:" + env,
        severity: mech.severity,
        requires_immediate_action: mech.requires_immediate,
        susceptible_materials: mech.susceptible_materials,
        temperature_range_f: mech.temp_range_f,
        contributing_factors: mech.contributing_factors
      });
    }
  }

  // Step 5b: If mechanisms were filtered by temperature, add as warnings
  // Multi-temperature-zone equipment may still have these mechanisms at cooler zones
  if (temp_filtered.length > 0) {
    for (var tf = 0; tf < temp_filtered.length; tf++) {
      mechanisms.push({
        id: "TEMP_FILTERED_" + tf,
        name: "TEMPERATURE-EXCLUDED (verify multi-zone applicability): " + temp_filtered[tf],
        api_571_ref: "Review if equipment has multiple temperature zones",
        description: "This mechanism was excluded because the reported operating temperature is outside its active range. However, if the equipment has multiple temperature zones (e.g., inlet vs outlet, top vs bottom, shell vs head), this mechanism may still be active at cooler locations. Engineering review recommended.",
        source_trigger: "temperature_filter_advisory",
        severity: "medium",
        requires_immediate_action: false,
        susceptible_materials: [],
        temperature_range_f: null,
        contributing_factors: ["multi_temperature_zone_equipment", "inlet_outlet_temperature_gradient", "ambient_cooling_at_supports"]
      });
    }
  }

  // Step 6: Sort by severity (critical first, then high, medium, low)
  var severity_order: { [key: string]: number } = {
    "critical": 0,
    "high": 1,
    "medium": 2,
    "low": 3
  };
  mechanisms.sort(function(a, b) {
    return (severity_order[a.severity] || 3) - (severity_order[b.severity] || 3);
  });

  return mechanisms;
}


// ============================================================================
// ENGINE 2: AFFECTED ZONE PREDICTION ENGINE
// Maps damage mechanisms + asset class to specific inspection zones with priority
// ============================================================================

// --- ZONE MAPS BY ASSET CLASS ---
// Each zone includes which mechanisms target it and the priority (1=highest)

var ZONE_MAP: { [asset_class: string]: { [mechanism_pattern: string]: Array<{
  zone_id: string;
  zone_name: string;
  priority: number;
  rationale: string;
}> } } = {

  "pressure_vessel": {
    "SSC|SOHIC|AMINE_SCC|CAUSTIC_SCC": [
      { zone_id: "PV-WELD-CIRC", zone_name: "Circumferential Shell Welds + HAZ", priority: 1, rationale: "Highest residual stress zones. SSC/SCC initiate at weld toes in HAZ where hardness is elevated." },
      { zone_id: "PV-WELD-LONG", zone_name: "Longitudinal Shell Welds + HAZ", priority: 1, rationale: "Under hoop stress — primary membrane stress direction. SSC/SCC cracks orient perpendicular to max stress." },
      { zone_id: "PV-NOZZLE", zone_name: "Nozzle-to-Shell Welds + Reinforcement Pads", priority: 1, rationale: "High triaxial stress concentration. Multiple stress risers from geometry change." },
      { zone_id: "PV-HEAD-SHELL", zone_name: "Head-to-Shell Junction Welds", priority: 2, rationale: "Geometric discontinuity with bending stresses. Often inadequate PWHT coverage." },
      { zone_id: "PV-ATTACHMENT", zone_name: "Internal Attachment Welds (trays, baffles, clips)", priority: 2, rationale: "Fillet welds with high restraint. Often missed in PWHT. Crevice geometry traps process fluid." },
      { zone_id: "PV-MANWAY", zone_name: "Manway and Handhole Nozzles", priority: 3, rationale: "Repeated opening/closing introduces local stress. Gasket face examination also required." }
    ],
    "HIC|HIC_H2|BLISTERING": [
      { zone_id: "PV-SHELL-PLATE", zone_name: "Shell Plates (mid-wall scanning)", priority: 1, rationale: "HIC initiates at MnS inclusions/banding deep in plate. Requires straight-beam UT scanning of entire plate area." },
      { zone_id: "PV-WELD-HAZ-HIC", zone_name: "Weld HAZ Zones (SOHIC check)", priority: 1, rationale: "SOHIC develops at weld toes where HIC and SSC interact under residual stress." },
      { zone_id: "PV-NOZZLE-PAD", zone_name: "Nozzle Reinforcement Pad Plates", priority: 2, rationale: "Reinforcement pads are additional plate material susceptible to HIC. Trapped fluid under pads can concentrate H2S." },
      { zone_id: "PV-BOTTOM-HEAD", zone_name: "Bottom Head (liquid contact area)", priority: 2, rationale: "Water and acid settle. Highest H2S concentration in liquid phase." }
    ],
    "HTHA": [
      { zone_id: "PV-HOTWALL", zone_name: "Hot-Wall Sections (highest temperature zone)", priority: 1, rationale: "HTHA occurs at highest temperature exposure. Map isotherms to identify affected zones." },
      { zone_id: "PV-WELD-HTHA", zone_name: "Weld Metal and HAZ in Hot Zone", priority: 1, rationale: "Weld HAZ may have different carbon content and microstructure affecting HTHA susceptibility." },
      { zone_id: "PV-OUTLET-NOZZLE", zone_name: "Outlet Nozzles (hot side)", priority: 2, rationale: "Hot product exit — highest temperature exposure at nozzle." },
      { zone_id: "PV-TRANSITION", zone_name: "Temperature Transition Zones", priority: 2, rationale: "Boundary between HTHA-affected and unaffected zones may have micro-fissuring." }
    ],
    "CREEP": [
      { zone_id: "PV-HOTWALL-CR", zone_name: "Hot-Wall Shell Sections", priority: 1, rationale: "Maximum temperature = maximum creep rate. Look for bulging, distortion, increased diameter." },
      { zone_id: "PV-WELD-CR", zone_name: "Circumferential Welds in Creep Zone (Type IV cracking)", priority: 1, rationale: "Type IV creep cracking occurs in fine-grained HAZ. Most common creep failure mode in Cr-Mo welds." },
      { zone_id: "PV-SUPPORT-CR", zone_name: "Support Attachment Welds in Creep Zone", priority: 2, rationale: "Localized bending stresses from dead weight at elevated temperature." }
    ],
    "GENERAL_CORROSION|PITTING|EROSION|NAC": [
      { zone_id: "PV-BOTTOM", zone_name: "Bottom Head and Lower Shell Course", priority: 1, rationale: "Liquid level zone — highest corrosion rate. Sediment and water accumulation." },
      { zone_id: "PV-INLET", zone_name: "Inlet Nozzle Area and Impingement Zone", priority: 1, rationale: "High velocity, two-phase flow, erosion-corrosion at inlet." },
      { zone_id: "PV-LIQUID-LEVEL", zone_name: "Liquid Level / Interface Zone", priority: 2, rationale: "Phase boundary corrosion. Water-hydrocarbon interface most aggressive." },
      { zone_id: "PV-OUTLET-LOWER", zone_name: "Outlet and Drain Nozzles", priority: 2, rationale: "Dead legs, sediment accumulation, under-deposit corrosion." }
    ],
    "CUI": [
      { zone_id: "PV-CUI-TERMINATION", zone_name: "Insulation Termination Points", priority: 1, rationale: "Water ingress at insulation edges. Most common CUI initiation point." },
      { zone_id: "PV-CUI-PENETRATION", zone_name: "Insulation Penetrations (nozzles, supports)", priority: 1, rationale: "Breaks in vapor barrier allow water entry." },
      { zone_id: "PV-CUI-LOW", zone_name: "Low Points and Horizontal Surfaces Under Insulation", priority: 2, rationale: "Water collects at low points and on horizontal surfaces." },
      { zone_id: "PV-CUI-DAMAGED", zone_name: "Damaged or Missing Jacketing Areas", priority: 1, rationale: "Visual evidence of potential water ingress. Priority inspection locations." }
    ],
    "FIRE_DAMAGE|METALLURGICAL_CHANGE": [
      { zone_id: "PV-FIRE-DIRECT", zone_name: "Directly Flame-Impinged Zones", priority: 1, rationale: "Highest temperature exposure. Potential metallurgical changes and creep damage." },
      { zone_id: "PV-FIRE-ABOVE", zone_name: "Shell Above Liquid Level During Fire", priority: 1, rationale: "Unwetted shell cannot dissipate heat — reaches highest temperature." },
      { zone_id: "PV-FIRE-SUPPORT", zone_name: "Support Skirt/Saddle and Foundation", priority: 2, rationale: "Structural supports affected by fire — buckling, distortion, bolt damage." },
      { zone_id: "PV-FIRE-NOZZLE", zone_name: "Nozzle Connections and Flanges", priority: 2, rationale: "Differential expansion may cause leakage or distortion at flanged connections." }
    ],
    "MECH_DAMAGE|STRUCTURAL_OVERLOAD|BLAST_DAMAGE|DEBRIS_IMPACT": [
      { zone_id: "PV-IMPACT-POINT", zone_name: "Point of Impact / Damage", priority: 1, rationale: "Direct damage zone — denting, gouging, or deformation." },
      { zone_id: "PV-IMPACT-ADJ", zone_name: "Adjacent Shell (within 2x diameter from impact)", priority: 2, rationale: "Stress redistribution zone — secondary cracking possible." },
      { zone_id: "PV-IMPACT-WELD", zone_name: "Nearest Welds to Impact Point", priority: 2, rationale: "Pre-existing stress concentrators may have cracked from impulse loading." }
    ],
    "SULFIDATION|NAC": [
      { zone_id: "PV-SULFID-HOTWALL", zone_name: "Hot-Wall Sections (highest sulfidation rate)", priority: 1, rationale: "Sulfidation rate increases exponentially with temperature. Highest temperature zones see highest metal loss per McConomy curves." },
      { zone_id: "PV-SULFID-TRANSFER", zone_name: "Transfer Line Nozzle and Outlet Piping Connections", priority: 1, rationale: "Highest velocity and temperature at outlet. Naphthenic acid corrosion also concentrates here." },
      { zone_id: "PV-SULFID-INLET", zone_name: "Feed Inlet and Impingement Areas", priority: 1, rationale: "Two-phase flow impingement accelerates sulfidation. Velocity-dependent damage." },
      { zone_id: "PV-SULFID-TRAY", zone_name: "Tray Support Rings and Internal Attachment Welds", priority: 2, rationale: "Internals at process temperature. Thinning of tray supports affects mechanical integrity." }
    ],
    "WIND_STRUCTURAL|WAVE_LOADING|DEBRIS_IMPACT": [
      { zone_id: "PV-STORM-SUPPORT", zone_name: "Vessel Support Structure (skirt, saddle, legs)", priority: 1, rationale: "Wind and wave loading transfers through supports. Anchor bolt stretch, skirt buckling, saddle displacement." },
      { zone_id: "PV-STORM-NOZZLE", zone_name: "Nozzle Connections and Piping Attachments", priority: 1, rationale: "Relative movement between vessel and piping during storm loading causes nozzle overloads and flange leakage." },
      { zone_id: "PV-STORM-FOUNDATION", zone_name: "Foundation and Anchor Bolts", priority: 1, rationale: "Wind uplift and lateral loads on foundation. Anchor bolt elongation or fracture." },
      { zone_id: "PV-STORM-PLATFORM", zone_name: "Access Platforms, Ladders, and Appurtenances", priority: 2, rationale: "Wind loading on appendages. Attachment welds to shell are stress points." },
      { zone_id: "PV-STORM-INSTRUMENT", zone_name: "Instrument Connections and Small-Bore Piping", priority: 2, rationale: "Wind vibration and debris impact damage to instrumentation and small-bore connections." }
    ],
    "MARINE_CORROSION|CP_DEFICIENCY": [
      { zone_id: "PV-EXT-SPLASH", zone_name: "External Surfaces in Splash Zone", priority: 1, rationale: "Vessels on offshore platforms in splash zone have accelerated external corrosion. Coating condition critical." },
      { zone_id: "PV-EXT-BASE", zone_name: "Base Plate and Support Interfaces", priority: 1, rationale: "Crevice corrosion at support contact points. Trapped moisture accelerates attack." },
      { zone_id: "PV-EXT-COATING", zone_name: "External Coating System (full survey)", priority: 2, rationale: "Coating breakdown leads to accelerated external corrosion in marine environment." }
    ],
    "OVERPRESSURE_DAMAGE": [
      { zone_id: "PV-OP-SHELL", zone_name: "Shell Plates (dimensional survey)", priority: 1, rationale: "Check for permanent bulging, out-of-roundness, increased diameter." },
      { zone_id: "PV-OP-HEAD", zone_name: "Heads (especially flat/cone)", priority: 1, rationale: "Heads under highest bending stress during overpressure." },
      { zone_id: "PV-OP-NOZZLE", zone_name: "Nozzle/Shell Junctions", priority: 1, rationale: "Stress concentration amplifies overpressure effects." },
      { zone_id: "PV-OP-FLANGE", zone_name: "Flange Connections (leak check)", priority: 2, rationale: "Gasket compression may be exceeded. Bolts may have yielded." }
    ]
  },

  "process_piping": {
    "SSC|SOHIC|AMINE_SCC|CAUSTIC_SCC|CL_SCC|PTA_SCC": [
      { zone_id: "PP-WELD", zone_name: "Girth Welds + HAZ (all accessible)", priority: 1, rationale: "Residual stress at welds drives SCC. HAZ hardness critical for SSC." },
      { zone_id: "PP-BRANCH", zone_name: "Branch Connections and Tee Junctions", priority: 1, rationale: "High stress concentration at branch intersections. Geometric discontinuity." },
      { zone_id: "PP-SOCKET", zone_name: "Socket Welds and Threaded Connections", priority: 2, rationale: "Crevice geometry traps corrosive fluid. Residual stress from welding." },
      { zone_id: "PP-DEADLEG", zone_name: "Dead Legs and Stagnant Sections", priority: 2, rationale: "Stagnant fluid concentrates corrosives. Temperature may differ from main flow." }
    ],
    "VIB_FATIGUE|VIB_FATIGUE_V|MECH_FATIGUE": [
      { zone_id: "PP-SBC", zone_name: "Small-Bore Connections (NPS 2 and below)", priority: 1, rationale: "Highest fatigue failure rate in process piping. Cantilevered mass amplifies vibration." },
      { zone_id: "PP-SOCKET-FAT", zone_name: "Socket Welds (especially un-gapped)", priority: 1, rationale: "Socket weld root is unfused — acts as crack initiator under cyclic loading." },
      { zone_id: "PP-BRANCH-FAT", zone_name: "Branch Connections at Main Headers", priority: 1, rationale: "Branch connections collect vibration energy from main piping system." },
      { zone_id: "PP-SUPPORT", zone_name: "Pipe Supports and Restraints (first unsupported span)", priority: 2, rationale: "Reaction points where vibration mode shapes have maximum stress." },
      { zone_id: "PP-THREAD", zone_name: "Threaded Connections", priority: 2, rationale: "Thread root acts as stress concentrator. Cannot be inspected by MT/PT." }
    ],
    "GENERAL_CORROSION|PITTING|EROSION|FAC|NAC": [
      { zone_id: "PP-ELBOW", zone_name: "Elbows and Return Bends (extrados)", priority: 1, rationale: "Flow impingement on outer radius. Erosion-corrosion and FAC targets." },
      { zone_id: "PP-TEE", zone_name: "Tees and Reducers", priority: 1, rationale: "Flow disturbance, turbulence, velocity change zones." },
      { zone_id: "PP-DOWNSTREAM-CV", zone_name: "Downstream of Control Valves (10D)", priority: 1, rationale: "Flashing, cavitation, high turbulence downstream of pressure letdown." },
      { zone_id: "PP-INJECTION", zone_name: "Injection Points (downstream 10-25D)", priority: 1, rationale: "Chemical mixing creates localized corrosion. API 570 requires monitoring." },
      { zone_id: "PP-LOW-POINT", zone_name: "Low Points and Drains", priority: 2, rationale: "Water and sediment accumulation. Under-deposit corrosion." }
    ],
    "CUI": [
      { zone_id: "PP-CUI-SUPPORT", zone_name: "Pipe Support Penetrations Through Insulation", priority: 1, rationale: "Every support is a break in the insulation system. Water entry point." },
      { zone_id: "PP-CUI-TERM", zone_name: "Insulation Termination Points", priority: 1, rationale: "Water runs down pipe and enters at insulation edges." },
      { zone_id: "PP-CUI-VALVE", zone_name: "Valves and Flanges Under Insulation", priority: 2, rationale: "Complex geometry makes sealing difficult. Water trapped in crevices." },
      { zone_id: "PP-CUI-6OCLOCK", zone_name: "6 O'Clock Position on Horizontal Runs", priority: 1, rationale: "Gravity — water collects at the bottom of horizontal pipes." }
    ],
    "THERMAL_FATIGUE": [
      { zone_id: "PP-MIX", zone_name: "Mixing Points (hot/cold fluid junction)", priority: 1, rationale: "Thermal stratification and cycling at mixing tees causes transgranular cracking." },
      { zone_id: "PP-BYPASS", zone_name: "Bypass and Recirculation Lines", priority: 2, rationale: "Intermittent flow causes thermal cycling." }
    ],
    "FIRE_DAMAGE|METALLURGICAL_CHANGE": [
      { zone_id: "PP-FIRE-SAG", zone_name: "Spans Showing Visible Sag or Deflection", priority: 1, rationale: "Visible deformation indicates material reached creep temperature under dead weight." },
      { zone_id: "PP-FIRE-FLANGE", zone_name: "Flanged Connections (bolt check + gasket)", priority: 1, rationale: "Bolts may have relaxed or yielded. Gaskets may be compromised." },
      { zone_id: "PP-FIRE-SUPPORT", zone_name: "Pipe Supports (spring hangers, guides, anchors)", priority: 2, rationale: "Support hardware may have exceeded design temperature and lost function." }
    ]
  },

  "storage_tank": {
    "GENERAL_CORROSION|PITTING|MIC": [
      { zone_id: "ST-BOTTOM", zone_name: "Tank Bottom Plates", priority: 1, rationale: "Soil-side and product-side corrosion. MIC common on soil side. Pitting from water settling." },
      { zone_id: "ST-ANNULAR", zone_name: "Annular Ring (critical zone per API 653)", priority: 1, rationale: "Highest stressed bottom plate. API 653 requires minimum thickness at annular ring." },
      { zone_id: "ST-FIRST-COURSE", zone_name: "First Shell Course (lowest 8 feet)", priority: 1, rationale: "Maximum hydrostatic head. Water interface zone." },
      { zone_id: "ST-BTL-WELD", zone_name: "Shell-to-Bottom Weld", priority: 1, rationale: "Critical structural weld. Settlement loads. Corrosion at soil contact." },
      { zone_id: "ST-SUMP", zone_name: "Sump and Drain Areas", priority: 2, rationale: "Water accumulation. Sediment buildup. Accelerated corrosion." }
    ],
    "FOUNDATION_DAMAGE": [
      { zone_id: "ST-SETTLE", zone_name: "Foundation and Settlement Profile", priority: 1, rationale: "Differential settlement causes shell stress and bottom plate stress. API 653 Annex B limits." },
      { zone_id: "ST-ANCHOR", zone_name: "Anchor Bolts and Anchor Chairs", priority: 1, rationale: "Seismic and wind uplift resistance. Corrosion of embedded bolts." },
      { zone_id: "ST-RINGWALL", zone_name: "Ringwall Foundation", priority: 2, rationale: "Cracking, settling, erosion of foundation material." }
    ],
    "WIND_STRUCTURAL|HURRICANE_EVENT": [
      { zone_id: "ST-ROOF", zone_name: "Roof Plates, Rafters, and Seal", priority: 1, rationale: "Wind uplift and external pressure. Floating roof seal damage." },
      { zone_id: "ST-WIND-GIRDER", zone_name: "Wind Girder and Top Angle", priority: 1, rationale: "Buckling resistance. Wind ovaling forces." },
      { zone_id: "ST-UPPER-SHELL", zone_name: "Upper Shell Courses", priority: 2, rationale: "Wind buckling. Empty or partially filled tanks most vulnerable." },
      { zone_id: "ST-APPURT", zone_name: "Appurtenances (stairway, platform, nozzles)", priority: 2, rationale: "Wind loading on appendages transfers to shell. Check attachment welds." }
    ],
    "FIRE_DAMAGE": [
      { zone_id: "ST-FIRE-SHELL", zone_name: "Shell Plates in Fire Zone", priority: 1, rationale: "Direct flame impingement. Unwetted shell above liquid level most at risk." },
      { zone_id: "ST-FIRE-ROOF", zone_name: "Roof Structure", priority: 1, rationale: "Roof fires common. Structural failure of rafters and plates." },
      { zone_id: "ST-FIRE-BOTTOM-WELD", zone_name: "Shell-to-Bottom Weld (integrity check)", priority: 2, rationale: "Critical structural connection. Must verify after any fire event." }
    ]
  },

  "structural_steel": {
    "WIND_STRUCTURAL|WAVE_LOADING|HURRICANE_EVENT": [
      { zone_id: "SS-JOINT", zone_name: "Tubular Joint Connections (node welds)", priority: 1, rationale: "Highest stress concentration. Hot-spot stress drives fatigue. Visual + UT/MT." },
      { zone_id: "SS-BRACE", zone_name: "Diagonal Braces (buckling check)", priority: 1, rationale: "Compression braces may have buckled under extreme loading." },
      { zone_id: "SS-LEG", zone_name: "Jacket Legs (splash zone to mudline)", priority: 1, rationale: "Primary load path. Corrosion + fatigue + direct loading." },
      { zone_id: "SS-MUDLINE", zone_name: "Mudline Zone (scour assessment)", priority: 1, rationale: "Scour reduces embedment. Storm waves cause severe mudline scour." },
      { zone_id: "SS-DECK", zone_name: "Deck Structure and Equipment Supports", priority: 2, rationale: "Wave-in-deck loading if surge exceeded air gap. Equipment sliding." },
      { zone_id: "SS-APPURT", zone_name: "Appurtenances (boat landings, risers, caissons, conductors)", priority: 2, rationale: "Hydrodynamic loading on appurtenances. Clamp and attachment integrity." }
    ],
    "MARINE_CORROSION|CP_DEFICIENCY": [
      { zone_id: "SS-SPLASH", zone_name: "Splash Zone (all members)", priority: 1, rationale: "No CP protection. Coating condition critical. Highest corrosion rate zone." },
      { zone_id: "SS-ANODE", zone_name: "Anode Condition Survey (submerged zone)", priority: 1, rationale: "Anode depletion assessment. Remaining life calculation." },
      { zone_id: "SS-SUB-LEG", zone_name: "Submerged Jacket Legs", priority: 2, rationale: "CP protected but verify protection level and coating condition." }
    ],
    "MECH_FATIGUE": [
      { zone_id: "SS-JOINT-FAT", zone_name: "Fatigue-Critical Tubular Joints (per analysis)", priority: 1, rationale: "Joints with highest cumulative fatigue damage ratio. Inspection priority per API RP 2A." },
      { zone_id: "SS-CAISSON", zone_name: "Caisson and Conductor Clamps", priority: 2, rationale: "Cyclic wave loading on conductors transfers to clamps and support structure." }
    ],
    "MECH_DAMAGE|STRUCTURAL_OVERLOAD|DEBRIS_IMPACT": [
      { zone_id: "SS-IMPACT-MEMBER", zone_name: "Impacted Member (dent/gouge/deformation survey)", priority: 1, rationale: "Direct damage assessment at point of impact. Measure dent depth, gouge depth, deformation extent. Check for cracking." },
      { zone_id: "SS-IMPACT-JOINT-ABOVE", zone_name: "Joint Connection Above Impact Point", priority: 1, rationale: "Impact load transfers through member to nearest joint. Weld cracking at joint from impulse loading." },
      { zone_id: "SS-IMPACT-JOINT-BELOW", zone_name: "Joint Connection Below Impact Point", priority: 1, rationale: "Impact load transfers to lower joint connection. Check for weld cracking, plate buckling at node." },
      { zone_id: "SS-IMPACT-ADJACENT", zone_name: "Adjacent Braces and Members at Same Bay", priority: 2, rationale: "Load redistribution to adjacent members after impact damage. Verify no secondary buckling or overload." },
      { zone_id: "SS-IMPACT-COATING", zone_name: "Coating Damage Zone at Impact", priority: 2, rationale: "Impact strips coating, exposing bare steel to accelerated corrosion. Map extent for coating repair." }
    ]
  },

  "heat_exchanger": {
    "VIB_FATIGUE|VIB_FATIGUE_V": [
      { zone_id: "HX-TUBE-TS", zone_name: "Tube-to-Tubesheet Welds / Expansion Joints", priority: 1, rationale: "Flow-induced vibration causes tube fatigue at tubesheet. Most common HX failure mode." },
      { zone_id: "HX-BAFFLE", zone_name: "Tube Midspan at Baffle Holes", priority: 1, rationale: "Tubes vibrate between baffles. Fretting wear at baffle holes." },
      { zone_id: "HX-IMPINGEMENT", zone_name: "Inlet Impingement Zone", priority: 2, rationale: "High velocity at shell inlet causes tube vibration excitation." }
    ],
    "GENERAL_CORROSION|PITTING|EROSION": [
      { zone_id: "HX-TUBE-END", zone_name: "Tube Ends (first 2 inches from tubesheet)", priority: 1, rationale: "Highest velocity, turbulence, and erosion at tube inlet. Galvanic cell at dissimilar metal." },
      { zone_id: "HX-CHANNEL", zone_name: "Inlet Channel and Pass Partition", priority: 1, rationale: "Erosion-corrosion from high velocity. Pass partition plate wastage." },
      { zone_id: "HX-TUBES-GEN", zone_name: "Tube Bundle (representative sampling)", priority: 2, rationale: "Internal and external tube corrosion. IRIS or RFEC for inspection." }
    ],
    "CL_SCC|PTA_SCC": [
      { zone_id: "HX-TUBE-SCC", zone_name: "Tubes (austenitic SS) — Full Length", priority: 1, rationale: "Cl-SCC from cooling water side. PTA-SCC during shutdowns." },
      { zone_id: "HX-TS-SCC", zone_name: "Tubesheet (if austenitic SS)", priority: 1, rationale: "Highest stress location. Tube holes act as stress concentrators." }
    ],
    "FIRE_DAMAGE": [
      { zone_id: "HX-FIRE-SHELL", zone_name: "Shell Side (flame-impinged)", priority: 1, rationale: "Shell overheating causes tube bundle distortion and support damage." },
      { zone_id: "HX-FIRE-TUBE", zone_name: "Tube Bundle (distortion check)", priority: 1, rationale: "Differential expansion between tubes and shell. Bundle pull required." }
    ]
  },

  "pipeline": {
    "GENERAL_CORROSION|PITTING|EROSION|MIC": [
      { zone_id: "PL-LOW", zone_name: "Low Points and Sags", priority: 1, rationale: "Water accumulation in low points. Internal corrosion and MIC." },
      { zone_id: "PL-GIRTH-WELD", zone_name: "Girth Welds", priority: 1, rationale: "Preferential weld corrosion. Stress concentration at weld profile." },
      { zone_id: "PL-ELBOW", zone_name: "Elbows and Bends", priority: 2, rationale: "Flow acceleration on extrados. Erosion-corrosion." }
    ],
    "SSC|HIC": [
      { zone_id: "PL-WELD-SSC", zone_name: "Girth Welds + HAZ (sour service)", priority: 1, rationale: "SSC at HAZ. HIC in plate. Per NACE MR0175." },
      { zone_id: "PL-PLATE-HIC", zone_name: "Pipe Body (HIC scanning)", priority: 1, rationale: "HIC develops in pipe body away from welds. Requires long-seam and plate scanning." }
    ],
    "MECH_DAMAGE|STRUCTURAL_OVERLOAD": [
      { zone_id: "PL-DENT", zone_name: "Dent Location (ILI-identified or visual)", priority: 1, rationale: "Dent depth and strain assessment per ASME B31.8 / API 579-1 Part 12." },
      { zone_id: "PL-GOUGE", zone_name: "Gouge or Metal Loss at Dent", priority: 1, rationale: "Dent-gouge combination is most severe. Immediate assessment required." }
    ],
    "MARINE_CORROSION|CP_DEFICIENCY": [
      { zone_id: "PL-RISER", zone_name: "Riser (splash zone and transition)", priority: 1, rationale: "Splash zone on risers — no CP, coating critical." },
      { zone_id: "PL-ANODE", zone_name: "Anode Survey (submarine pipeline)", priority: 1, rationale: "Bracelet anode depletion assessment." },
      { zone_id: "PL-SPAN", zone_name: "Free Spans", priority: 2, rationale: "Vortex-induced vibration fatigue at free spans. Seabed scour." }
    ]
  },

  "offshore_platform": {
    "WIND_STRUCTURAL|WAVE_LOADING|HURRICANE_EVENT": [
      { zone_id: "OP-JACKET", zone_name: "Jacket Structure (global inspection)", priority: 1, rationale: "Primary structure. Check all joint cans, braces, legs." },
      { zone_id: "OP-DECK", zone_name: "Deck and Module Supports", priority: 1, rationale: "Wave-in-deck if surge exceeded air gap. Equipment anchorage." },
      { zone_id: "OP-RISER", zone_name: "Risers and Caissons", priority: 1, rationale: "Hydrodynamic loading. Clamp integrity. Guide wear." },
      { zone_id: "OP-MUDLINE", zone_name: "Mudline and Scour", priority: 1, rationale: "Post-storm scour assessment required. Pile embedment." },
      { zone_id: "OP-BOAT-LANDING", zone_name: "Boat Landings and Barge Bumpers", priority: 2, rationale: "Vessel impact during storm. Structural connection to jacket." }
    ],
    "MARINE_CORROSION|CP_DEFICIENCY": [
      { zone_id: "OP-SPLASH", zone_name: "Splash Zone (all members)", priority: 1, rationale: "Highest corrosion rate. Coating and wrap condition survey." },
      { zone_id: "OP-CP", zone_name: "CP System (anode survey)", priority: 1, rationale: "Post-storm CP verification. Anode damage assessment." }
    ]
  },

  "refinery_process_facility": {
    "FIRE_DAMAGE|METALLURGICAL_CHANGE|BLAST_DAMAGE": [
      { zone_id: "RPF-FIRE-ZONE", zone_name: "All Equipment in Fire/Blast Zone", priority: 1, rationale: "Comprehensive assessment of every piece of equipment exposed to fire or blast." },
      { zone_id: "RPF-PIPE-RACK", zone_name: "Pipe Rack and Piping in Fire Zone", priority: 1, rationale: "Piping sag, support damage, flange leaks, instrument damage." },
      { zone_id: "RPF-STRUCTURE", zone_name: "Steel Structure (columns, beams, bracing)", priority: 1, rationale: "Structural steel fire damage assessment per AISC." },
      { zone_id: "RPF-FOUNDATION", zone_name: "Foundations and Equipment Supports", priority: 2, rationale: "Concrete spalling, anchor bolt damage, grout degradation from heat." }
    ],
    "GENERAL_CORROSION|PITTING|CUI|SULFIDATION|NAC": [
      { zone_id: "RPF-HIGH-TEMP", zone_name: "High Temperature Circuits", priority: 1, rationale: "Sulfidation and naphthenic acid corrosion in high-temperature crude and vacuum units." },
      { zone_id: "RPF-CUI-CIRCUIT", zone_name: "CUI-Susceptible Circuits (25-350F)", priority: 1, rationale: "Intermittent service piping and vessels in CUI temperature range." },
      { zone_id: "RPF-DEADLEG-SYSTEM", zone_name: "Dead Legs and Stagnant Connections", priority: 2, rationale: "Accelerated corrosion in stagnant areas." }
    ]
  }
};


// --- ENGINE 2 FUNCTION ---

function runEngine2(
  mechanisms: DamageMechanism[],
  asset: ResolvedAsset
): AffectedZone[] {

  var zones: AffectedZone[] = [];
  var seen_zone_ids: { [key: string]: boolean } = {};
  var asset_class = asset.asset_class || "pressure_vessel";

  // Get zone map for this asset class
  var asset_zones = ZONE_MAP[asset_class];
  if (!asset_zones) {
    // Fall back to pressure_vessel as default
    asset_zones = ZONE_MAP["pressure_vessel"];
    if (!asset_zones) {
      return [{
        zone_id: "UNKNOWN",
        zone_name: "Full Equipment Inspection Required (asset class not mapped)",
        priority: 1,
        damage_mechanisms: mechanisms.map(function(m) { return m.id; }),
        rationale: "Asset class '" + asset_class + "' does not have zone mapping. Perform comprehensive inspection.",
        asset_specific: false
      }];
    }
  }

  // For each mechanism, find matching zone patterns
  for (var m = 0; m < mechanisms.length; m++) {
    var mech_id = mechanisms[m].id;

    var pattern_keys = Object.keys(asset_zones);
    for (var p = 0; p < pattern_keys.length; p++) {
      var pattern = pattern_keys[p];
      var pattern_parts = pattern.split("|");

      // Check if this mechanism matches the pattern
      var matches = false;
      for (var pp = 0; pp < pattern_parts.length; pp++) {
        if (pattern_parts[pp] === mech_id) {
          matches = true;
          break;
        }
      }

      if (!matches) continue;

      // Add all zones for this pattern
      var pattern_zones = asset_zones[pattern];
      for (var z = 0; z < pattern_zones.length; z++) {
        var zone = pattern_zones[z];
        if (seen_zone_ids[zone.zone_id]) {
          // Already added — append this mechanism to the existing zone
          for (var ez = 0; ez < zones.length; ez++) {
            if (zones[ez].zone_id === zone.zone_id) {
              if (zones[ez].damage_mechanisms.indexOf(mech_id) === -1) {
                zones[ez].damage_mechanisms.push(mech_id);
              }
              // Upgrade priority if this mechanism assigns higher priority
              if (zone.priority < zones[ez].priority) {
                zones[ez].priority = zone.priority;
              }
              break;
            }
          }
        } else {
          seen_zone_ids[zone.zone_id] = true;
          zones.push({
            zone_id: zone.zone_id,
            zone_name: zone.zone_name,
            priority: zone.priority,
            damage_mechanisms: [mech_id],
            rationale: zone.rationale,
            asset_specific: true
          });
        }
      }
    }
  }

  // Sort by priority (1=highest)
  zones.sort(function(a, b) {
    return a.priority - b.priority;
  });

  return zones;
}


// ============================================================================
// ENGINE 3: INSPECTION METHOD SELECTION ENGINE
// Maps damage mechanism + zone to specific NDT methods with full rationale
// Reference: ASNT Body of Knowledge, API 571 Table 2, API 510/570/653
// ============================================================================

// --- METHOD SELECTION RULES ---
// Key: mechanism_id → array of recommended methods with prioritization

var METHOD_RULES: { [mechanism_id: string]: Array<{
  method: string;
  technique: string;
  detection: string;
  sizing: string;
  code_ref: string;
  rationale: string;
  priority: number;
  qualification: string;
  limitations: string;
}> } = {

  "SSC": [
    { method: "UT", technique: "TOFD (Time-of-Flight Diffraction)", detection: "Surface and subsurface cracking, through-wall extent", sizing: "Accurate through-wall sizing (+/- 1mm) per BS EN ISO 10863", code_ref: "API 510 / ASME V Art. 4 / BS EN ISO 10863", rationale: "TOFD provides the most accurate through-wall sizing for SCC. Essential for fitness-for-service assessment per API 579-1 Part 9. Detects both surface-breaking and embedded cracks.", priority: 1, qualification: "ASNT Level II UT-TOFD or PCN Level 2", limitations: "Requires parallel surfaces. Dead zone at near surface (~2mm). Requires experienced operator for interpretation." },
    { method: "UT", technique: "PAUT (Phased Array UT) — Sectorial Scan", detection: "Surface-breaking and subsurface cracking at weld toes and HAZ", sizing: "Height and length sizing with encoded data", code_ref: "API 510 / ASME V Art. 4 / ASME CC-2235", rationale: "PAUT sectorial scanning provides real-time imaging of weld cross-section. Detects SSC at weld toes which is the primary initiation site. Encoded data allows permanent record.", priority: 1, qualification: "ASNT Level II UT-PA or equivalent", limitations: "Surface condition must allow coupling. Requires calibration on representative mock-ups." },
    { method: "MT", technique: "WFMT (Wet Fluorescent Magnetic Particle)", detection: "Surface-breaking cracks at weld toes and HAZ", sizing: "Length only — no depth information", code_ref: "ASME V Art. 7 / API 510", rationale: "WFMT is the most sensitive surface method for ferromagnetic materials. SSC cracks are tight and often missed by visible MT. Fluorescent particles under UV-A light improve detection of fine cracking.", priority: 2, qualification: "ASNT Level II MT", limitations: "Surface method only — does not detect subsurface or mid-wall cracking. Requires clean, dry surface. Only for ferromagnetic materials." },
    { method: "UT", technique: "Conventional Shear Wave (manual angle beam)", detection: "Crack detection at welds", sizing: "Limited sizing accuracy (6dB drop or DGS)", code_ref: "ASME V Art. 4", rationale: "Baseline manual scan when PAUT/TOFD not available. Less accurate for sizing but adequate for detection.", priority: 3, qualification: "ASNT Level II UT", limitations: "Operator-dependent. No permanent record unless encoded. Less accurate sizing than TOFD/PAUT." }
  ],

  "HIC": [
    { method: "UT", technique: "Straight Beam (C-Scan or Grid Mapping)", detection: "Internal hydrogen blistering and stepwise cracking", sizing: "Areal extent and through-wall position of HIC damage", code_ref: "API 510 / NACE SP0296 / API RP 945", rationale: "Straight beam UT is the primary detection method for HIC. Stepwise cracking appears as series of back-wall loss or mid-wall reflectors. C-scan mapping documents extent and position.", priority: 1, qualification: "ASNT Level II UT (HIC-experienced)", limitations: "Cannot always distinguish HIC from laminations without supplementary techniques. Requires experienced operator." },
    { method: "UT", technique: "PAUT — Linear Scan (straight beam) with Sectorial", detection: "HIC/SOHIC detection and mapping through wall thickness", sizing: "Depth, extent, and through-wall distribution", code_ref: "ASME V Art. 4 / API RP 945", rationale: "PAUT provides superior mapping of HIC distribution through wall. Sectorial scan at weld toes detects SOHIC. Encoded data creates permanent volumetric record.", priority: 1, qualification: "ASNT Level II UT-PA", limitations: "More time-consuming than conventional UT. Requires encoded scanner." },
    { method: "VT", technique: "Visual Examination — Close Visual (within 6 inches)", detection: "Surface blistering, bulges, coating disbondment", sizing: "Blister diameter and height measurement", code_ref: "API 510 / API 571", rationale: "First indication of HIC is often surface blistering. Every vessel in wet H2S service should have internal visual examination for blistering during turnaround.", priority: 2, qualification: "ASNT Level II VT or API 510 Inspector", limitations: "Cannot detect subsurface HIC without surface blistering. Many HIC conditions have no surface indication." }
  ],

  "SOHIC": [
    { method: "UT", technique: "TOFD (centered on weld HAZ)", detection: "Through-wall cracking from stacked HIC linked by SSC", sizing: "Through-wall height — critical for FFS", code_ref: "API 510 / BS EN ISO 10863 / API 579-1 Part 9", rationale: "SOHIC is the most dangerous form of wet H2S damage — stacked HIC linked by SSC at weld toes. TOFD is essential for through-wall sizing. Focus on weld HAZ regions.", priority: 1, qualification: "ASNT Level II UT-TOFD (experienced in SOHIC)", limitations: "SOHIC can be subtle. Requires operator experienced in wet H2S damage patterns." },
    { method: "UT", technique: "PAUT (Sectorial at weld toes — both sides)", detection: "Detection of cracking at weld toe HAZ", sizing: "Height and length with encoded data", code_ref: "ASME V Art. 4 / ASME CC-2235", rationale: "PAUT sectorial scan from both sides of weld captures SOHIC developing from either weld toe. Complements TOFD.", priority: 1, qualification: "ASNT Level II UT-PA", limitations: "Must scan from both sides of weld. Surface preparation required." },
    { method: "MT", technique: "WFMT (at weld toes)", detection: "Surface-breaking SOHIC/SSC cracks at weld toes", sizing: "Length only", code_ref: "ASME V Art. 7", rationale: "Surface complement to volumetric UT examination. Catches any surface-breaking cracking that may be at early stage.", priority: 2, qualification: "ASNT Level II MT", limitations: "Surface only. SOHIC often propagates from mid-wall before reaching surface." }
  ],

  "HTHA": [
    { method: "UT", technique: "AUBT (Advanced Ultrasonic Backscatter Technique)", detection: "Micro-fissuring from HTHA — the ONLY reliable detection method for early-stage HTHA", sizing: "Qualitative — extent of affected zone", code_ref: "API RP 941 / API 571 / Industry Best Practice", rationale: "AUBT detects backscatter from HTHA micro-voids and fissures that conventional UT CANNOT detect. This is the PRIMARY and often ONLY reliable NDE method for HTHA detection. Conventional UT will not detect early/intermediate HTHA.", priority: 1, qualification: "Specialist AUBT operator — requires specific training and qualification beyond standard ASNT Level II", limitations: "Requires specialized equipment and highly trained operators. Not widely available. Should be supplemented by PAUT." },
    { method: "UT", technique: "PAUT (Velocity Ratio — supplemental to AUBT)", detection: "Advanced HTHA with macro-fissuring", sizing: "Extent of macro-fissured zone", code_ref: "API RP 941 (2016+)", rationale: "PAUT with velocity ratio measurement can detect later-stage HTHA. Supplements AUBT but does NOT replace it for early detection. Encoded sectorial data documents extent.", priority: 1, qualification: "ASNT Level II UT-PA with HTHA experience", limitations: "Cannot reliably detect early-stage HTHA (micro-void stage). Complements but does not replace AUBT." },
    { method: "HARDNESS", technique: "Field Hardness Testing (portable Leeb or UCI)", detection: "Decarburization from HTHA (reduced hardness)", sizing: "Not applicable", code_ref: "API RP 941 / ASTM A1038", rationale: "HTHA causes decarburization which reduces hardness. Significant hardness reduction vs. baseline indicates advanced HTHA. Supplementary test — not primary detection.", priority: 2, qualification: "ASNT Level II or trained technician", limitations: "Only detects advanced decarburization. Surface measurement only. Insensitive to early HTHA." },
    { method: "REPLICA", technique: "In-Situ Metallographic Replication", detection: "Microstructural evidence of HTHA (fissuring, decarburization, void formation)", sizing: "Qualitative", code_ref: "API RP 941 / ASTM E1351", rationale: "Direct evidence of HTHA microstructural damage. Confirms UT findings. Documents extent of decarburization and fissuring.", priority: 2, qualification: "Metallurgist or Level III with replication experience", limitations: "Surface technique only — cannot detect mid-wall HTHA. Requires grinding and polishing in-situ." }
  ],

  "CREEP": [
    { method: "REPLICA", technique: "In-Situ Metallographic Replication", detection: "Creep void formation, alignment, and micro-cracking at grain boundaries", sizing: "Qualitative — creep damage classification (A through D per Neubauer)", code_ref: "API 571 / API 579-1 Part 10 / ASTM E1351", rationale: "Replication is the PRIMARY method for detecting and classifying creep damage in Cr-Mo steels. Neubauer classification (A=undamaged through D=macro-cracking) drives remaining life assessment. Essential at weld HAZ for Type IV cracking.", priority: 1, qualification: "Metallurgist or Level III with creep replication experience", limitations: "Surface technique only. Requires site preparation. Does not detect subsurface creep voids. Sampling method — may miss localized damage." },
    { method: "UT", technique: "PAUT or TOFD (at welds in creep zone)", detection: "Creep cracking at weld HAZ (Type IV)", sizing: "Through-wall height of creep cracks", code_ref: "ASME V Art. 4 / API 579-1 Part 10", rationale: "Detects macro-cracking from advanced creep damage. Type IV creep cracking in fine-grained HAZ is the most common failure mode for Cr-Mo weldments in creep range.", priority: 1, qualification: "ASNT Level II UT-PA/TOFD", limitations: "Cannot detect early-stage creep (void formation). Only detects damage that has progressed to cracking." },
    { method: "HARDNESS", technique: "Field Hardness Survey", detection: "Softening from creep-related microstructural degradation", sizing: "Not applicable", code_ref: "API 579-1 Part 10", rationale: "Hardness reduction indicates microstructural degradation (spheroidization, over-tempering). Trend data vs. baseline shows degradation rate.", priority: 2, qualification: "ASNT Level II or trained technician", limitations: "Surface measurement. Scatter in field measurements. Must compare to baseline." },
    { method: "DIMENSIONAL", technique: "Diameter/Strain Measurement", detection: "Creep strain (bulging, diameter increase)", sizing: "Quantitative — % strain", code_ref: "API 579-1 Part 10", rationale: "Creep causes measurable increase in diameter under hoop stress. Strapping or laser measurement detects cumulative creep strain. Above 1-2% strain indicates significant creep damage.", priority: 2, qualification: "Inspector with precision measurement capability", limitations: "Only detects significant accumulated creep strain. Not sensitive to early creep." }
  ],

  "GENERAL_CORROSION": [
    { method: "UT", technique: "UT Thickness Measurement (grid pattern)", detection: "Wall thinning — remaining wall thickness", sizing: "Quantitative — minimum remaining thickness and corrosion profile", code_ref: "API 510 / API 570 / API 653 / ASME V Art. 5", rationale: "PRIMARY method for corrosion monitoring. Grid measurements establish thickness profile and corrosion rate when compared to previous data. CML (Condition Monitoring Location) approach per API 510/570.", priority: 1, qualification: "ASNT Level II UT", limitations: "Point measurements — may miss localized thinning between grid points. Contact required." },
    { method: "UT", technique: "Automated UT C-Scan or Encoded Corrosion Mapping", detection: "Detailed corrosion profile mapping", sizing: "Full coverage thickness map with sub-millimeter resolution", code_ref: "API 510/570 / ASME V Art. 4", rationale: "Encoded UT scanning provides complete thickness mapping versus point measurements. Essential for FFS assessments requiring accurate minimum thickness and remaining life. Identifies local thin areas that grid measurements may miss.", priority: 1, qualification: "ASNT Level II UT (automated)", limitations: "More time-consuming and expensive than grid UT. Requires scanner setup." },
    { method: "VT", technique: "Close Visual Examination", detection: "Surface condition, scale, pitting patterns, general condition", sizing: "General extent assessment", code_ref: "API 510/570/653 / ASME V Art. 9", rationale: "Visual examination provides overall condition context. Identifies areas requiring more detailed examination. Required per all API inspection codes as first-line method.", priority: 2, qualification: "ASNT Level II VT or API Inspector", limitations: "Cannot determine remaining wall thickness. Subjective assessment." }
  ],

  "PITTING": [
    { method: "UT", technique: "UT Thickness Grid (tight grid in pitted areas)", detection: "Minimum remaining wall thickness at pits", sizing: "Pit depth and remaining ligament", code_ref: "API 510/570 / API 579-1 Part 6", rationale: "Tight grid UT measurements in pitted areas to find minimum remaining thickness. Pit depth = nominal wall minus minimum reading. Required for API 579-1 Part 6 Level 1 or 2 assessment.", priority: 1, qualification: "ASNT Level II UT", limitations: "Small-diameter probes needed for individual pits. May not capture deepest pit if grid too coarse." },
    { method: "VT", technique: "Pit Gauge Measurement", detection: "Individual pit depth from surface", sizing: "Pit depth, diameter, and pit density", code_ref: "API 579-1 Part 6 / ASME V", rationale: "Direct measurement of pit depth from internal surface. Required for API 579-1 Part 6 assessment — pit depth, pit diameter, pit pair spacing, and pit density.", priority: 1, qualification: "API Inspector or ASNT Level II VT", limitations: "Requires direct access to pitted surface. Manual and time-consuming for large areas." }
  ],

  "CUI": [
    { method: "RT", technique: "Profile Radiography (tangential)", detection: "Wall loss under insulation without insulation removal", sizing: "Remaining wall thickness profile", code_ref: "API 570 / API RP 581 / ASME V Art. 2", rationale: "Profile RT allows wall thickness measurement without removing insulation. Tangential shots show wall profile. Most cost-effective screening method for CUI.", priority: 1, qualification: "ASNT Level II RT", limitations: "Limited to pipes/vessels where tangential shot geometry works. Radiation safety requirements." },
    { method: "UT", technique: "UT Thickness (at insulation removal points)", detection: "Accurate wall thickness where insulation is removed", sizing: "Quantitative remaining wall", code_ref: "API 570 / API 510", rationale: "Most accurate method but requires insulation removal. Used at suspect areas identified by screening methods or at planned removal points.", priority: 1, qualification: "ASNT Level II UT", limitations: "Requires insulation removal — costly and time-consuming. Only covers removed areas." },
    { method: "ET", technique: "Pulsed Eddy Current (PEC)", detection: "Wall loss through insulation, weather jacketing, and coatings", sizing: "Average wall thickness in probe footprint", code_ref: "API RP 581 / Industry practice", rationale: "PEC measures wall thickness through insulation without removal. Screening method for large-area CUI surveys. Fast coverage rate.", priority: 2, qualification: "ASNT Level II ET (PEC specialist)", limitations: "Averaging effect over probe footprint — cannot detect small pitting. Requires calibration for insulation thickness. Less accurate than direct UT." },
    { method: "IR", technique: "Infrared Thermography (passive)", detection: "Moisture in insulation indicating potential CUI", sizing: "Extent of wet insulation (indirect indicator)", code_ref: "API RP 581 / ASTM C1153", rationale: "IR detects wet insulation by temperature differential. Wet insulation = potential CUI. Screening method for identifying inspection priorities. Fast large-area coverage.", priority: 3, qualification: "Level II Thermographer", limitations: "Indirect method — detects moisture, not corrosion. Ambient conditions affect reliability. Day/night temperature differential needed." }
  ],

  "FIRE_DAMAGE": [
    { method: "VT", technique: "Visual Examination — Comprehensive Fire Damage Survey", detection: "Distortion, discoloration, sagging, buckling, coating damage", sizing: "Extent of visible fire damage zones", code_ref: "API 579-1 Part 11 / API 510/570/653", rationale: "FIRST step in any fire damage assessment. Visual survey establishes fire exposure zones, identifies equipment requiring detailed assessment, and documents visible damage. Color changes in steel indicate temperature exposure range.", priority: 1, qualification: "API Inspector", limitations: "Cannot determine metallurgical changes. Must be supplemented by NDE and metallurgy." },
    { method: "HARDNESS", technique: "Hardness Survey (portable)", detection: "Softening from overheating, or hardening from rapid cooling", sizing: "Map of hardness values across fire zone", code_ref: "API 579-1 Part 11 / ASTM A1038", rationale: "Hardness mapping establishes temperature exposure zones. Significant hardness change vs. baseline indicates metallurgical transformation. Carbon steel above 1350F will show changes. Required per API 579-1 Part 11.", priority: 1, qualification: "ASNT Level II or trained technician", limitations: "Surface measurement. Must compare to known baseline or nominal values." },
    { method: "REPLICA", technique: "In-Situ Metallographic Replication", detection: "Microstructural changes — grain growth, phase transformation, decarburization", sizing: "Qualitative — extent of metallurgical change", code_ref: "API 579-1 Part 11 / ASTM E1351", rationale: "Confirms metallurgical condition where hardness survey indicates changes. Identifies grain growth, spheroidization, decarburization, phase transformations. Required to determine if equipment can return to service.", priority: 1, qualification: "Metallurgist or experienced Level III", limitations: "Surface only. Representative sampling required. Requires grinding/polishing in-situ." },
    { method: "UT", technique: "UT Thickness Survey (baseline in fire zone)", detection: "Pre-existing corrosion now in fire-affected zone", sizing: "Remaining wall thickness", code_ref: "API 579-1 Part 11", rationale: "Establishes current wall thickness for stress analysis at elevated temperature exposure. Combined with fire damage assessment to determine structural adequacy.", priority: 2, qualification: "ASNT Level II UT", limitations: "Standard thickness measurement. Fire scale may affect coupling." },
    { method: "DIMENSIONAL", technique: "Dimensional Survey (laser scanning or conventional)", detection: "Permanent deformation, bulging, out-of-roundness", sizing: "Quantitative dimensional changes vs. original or nameplate", code_ref: "API 579-1 Part 8 and 11", rationale: "Detects permanent deformation from fire-induced creep. Diameter increase, shell out-of-roundness, and local bulging indicate high-temperature exposure with potential structural compromise.", priority: 1, qualification: "Inspector with precision measurement / surveying", limitations: "Requires original dimensional data for comparison. Laser scanning preferred for complex geometries." }
  ],

  "MECH_DAMAGE": [
    { method: "VT", technique: "Close Visual Examination of Damage Zone", detection: "Dent depth, gouge depth/length, deformation extent", sizing: "Dent and gouge dimensions", code_ref: "API 579-1 Part 12 / ASME B31.8", rationale: "First-line assessment. Measure dent depth (% of diameter), gouge depth, length, and orientation. Document with photographs. Determines need for further NDE.", priority: 1, qualification: "API Inspector", limitations: "Cannot detect cracking within dent or gouge by visual alone." },
    { method: "MT", technique: "MPI at Dent/Gouge Apex and Edges", detection: "Cracking within or adjacent to mechanical damage", sizing: "Crack length", code_ref: "API 579-1 Part 12 / ASME V Art. 7", rationale: "CRITICAL — mechanical damage may have associated cracking. MPI of the entire damaged zone is REQUIRED before any disposition. Gouges especially may have embedded cracks at the root.", priority: 1, qualification: "ASNT Level II MT", limitations: "May be difficult to achieve adequate field direction on complex dent geometry." },
    { method: "UT", technique: "UT Thickness at Damage Zone", detection: "Remaining wall at gouged area", sizing: "Minimum remaining wall thickness", code_ref: "API 579-1 Part 12", rationale: "Must establish remaining wall at gouge root. Combined with dent depth for API 579-1 Part 12 Level 1/2 assessment.", priority: 1, qualification: "ASNT Level II UT", limitations: "Surface irregularity at gouge may make coupling difficult. Small probe or pencil probe may be needed." },
    { method: "DIMENSIONAL", technique: "Profile Measurement of Dent", detection: "Dent depth and strain", sizing: "Maximum depth, length, width, and calculated strain", code_ref: "API 579-1 Part 12 / ASME B31.8", rationale: "Precise dent profiling needed for API 579-1 Part 12 assessment. Strain calculation from dent profile determines severity. Dent-gouge combination assessment requires accurate profiles.", priority: 2, qualification: "Inspector with profiling tools", limitations: "Manual measurement may be imprecise for complex shapes. Laser scanning preferred." }
  ],

  "WIND_STRUCTURAL": [
    { method: "VT", technique: "General Visual Inspection — All Structural Members", detection: "Buckling, deformation, displacement, connection damage, missing components", sizing: "Extent of visible damage", code_ref: "API RP 2A / AISC 360 / AWS D1.1", rationale: "Comprehensive visual survey is first priority after hurricane/wind event. Identifies all visible damage for prioritized detailed inspection.", priority: 1, qualification: "Structural Engineer or experienced API Inspector", limitations: "Cannot detect cracking within connections. Subsurface damage requires NDE." },
    { method: "UT", technique: "UT Shear Wave or PAUT at Welded Connections", detection: "Cracking in tubular joint welds and brace connections", sizing: "Crack length and depth", code_ref: "API RP 2A / AWS D1.1 Chapter 6", rationale: "Post-storm UT of critical joints to detect cracking from overload or accumulated fatigue. Focus on joints with highest utilization ratio.", priority: 1, qualification: "ASNT Level II UT", limitations: "Complex joint geometry makes scanning difficult. May require ACFM as supplement." },
    { method: "MT", technique: "MPI at Critical Weld Connections", detection: "Surface-breaking fatigue or overload cracking at weld toes", sizing: "Crack length", code_ref: "AWS D1.1 Chapter 6 / API RP 2A", rationale: "Surface examination of weld toes at highest-stressed joints. Complements UT for surface-breaking cracks.", priority: 2, qualification: "ASNT Level II MT", limitations: "Offshore access and cleaning challenges. Surface prep required." },
    { method: "SURVEY", technique: "Global Platform Survey (inclination, displacement)", detection: "Platform tilt, displacement from original position", sizing: "Quantitative displacement and tilt angle", code_ref: "API RP 2A", rationale: "Post-storm survey of global platform position. Significant displacement or tilt indicates structural damage requiring immediate engineering assessment.", priority: 1, qualification: "Survey crew", limitations: "Does not identify specific damage — indicates overall structural condition." }
  ],

  "WAVE_LOADING": [
    { method: "DIVE_SURVEY", technique: "Underwater General Visual (Level I/II per API RP 2I)", detection: "Scour, member damage, marine growth, anode condition, debris", sizing: "Extent of observed conditions", code_ref: "API RP 2I / API RP 2A / 30 CFR 250", rationale: "Underwater inspection is REQUIRED after hurricane for submerged structure. Level I for general condition. Level II cleaning and close-up at critical joints. Scour assessment at mudline.", priority: 1, qualification: "Certified Underwater Inspector", limitations: "Visibility dependent. Marine growth removal required for Level II. Diver safety considerations." },
    { method: "UT", technique: "Underwater UT Thickness (wrist-mount or ROV-deployed)", detection: "Wall loss on jacket legs, braces, piles in splash/submerged zone", sizing: "Remaining wall thickness", code_ref: "API RP 2I / API RP 2A", rationale: "Wall thickness measurement of critical submerged members. Focus on splash zone, mudline, and any areas of visible damage or CP deficiency.", priority: 1, qualification: "ASNT Level II UT (underwater-qualified)", limitations: "Surface prep underwater is difficult. Marine growth removal required. Accuracy affected by conditions." },
    { method: "CP", technique: "Cathodic Protection Survey (half-cell potential)", detection: "CP system effectiveness, anode depletion", sizing: "Protection levels vs. criteria (-850mV or -950mV)", code_ref: "NACE SP0176 / DNV-RP-B401", rationale: "Post-storm CP survey verifies cathodic protection still effective. Anodes may be damaged, cables severed, or current demand increased from coating damage.", priority: 1, qualification: "CP Technician / NACE certified", limitations: "IR drop effects in survey. Must account for marine growth and anode proximity." }
  ],

  "THERMAL_FATIGUE": [
    { method: "PT", technique: "Liquid Penetrant — Fluorescent (FWPT)", detection: "Surface-breaking thermal fatigue cracks (transgranular)", sizing: "Crack length at surface", code_ref: "ASME V Art. 6 / API 570", rationale: "Thermal fatigue cracks are typically transgranular and tight — fluorescent PT provides best surface detection sensitivity. Preferred over MT for austenitic stainless steels.", priority: 1, qualification: "ASNT Level II PT", limitations: "Surface-breaking only. Surface must be clean and dry. Temperature limitations on penetrant." },
    { method: "UT", technique: "PAUT at Mixing/Cycling Zones", detection: "Through-wall extent of thermal fatigue cracking", sizing: "Crack depth and length", code_ref: "ASME V Art. 4", rationale: "Sizes thermal fatigue cracks for fitness-for-service assessment. Focus on mixing tees, quench points, and areas of known thermal cycling.", priority: 1, qualification: "ASNT Level II UT-PA", limitations: "Requires access to scanning surface. Complex geometry at mixing points." }
  ],

  "MIC": [
    { method: "UT", technique: "UT Thickness Survey (focused on stagnant areas)", detection: "Localized wall loss from MIC attack", sizing: "Remaining wall thickness", code_ref: "API 510/570/653", rationale: "MIC causes localized thinning under biofilms. Tight-grid UT at dead legs, tank bottoms, and stagnant areas.", priority: 1, qualification: "ASNT Level II UT", limitations: "MIC pitting may be very localized — grid spacing critical." },
    { method: "VT", technique: "Visual for Biofilm, Tuberculation, and Deposit Patterns", detection: "Evidence of biological activity", sizing: "Extent of deposits", code_ref: "API 571 / NACE", rationale: "Characteristic deposits (tubercles, slime, black deposits) indicate MIC activity. Sampling of deposits for biological assay.", priority: 1, qualification: "Inspector with MIC awareness training", limitations: "Indirect method. Must be confirmed by biological testing." }
  ],

  "EROSION": [
    { method: "UT", technique: "UT Thickness (focused on flow-path geometry)", detection: "Wall thinning in erosion pattern", sizing: "Remaining wall thickness profile along flow path", code_ref: "API 510/570", rationale: "Targeted UT at elbows (extrados), tees, downstream of restrictions, and impingement zones. Erosion pattern follows fluid flow path.", priority: 1, qualification: "ASNT Level II UT", limitations: "Point measurements may miss worst area. Encoded scanning preferred for erosion." },
    { method: "RT", technique: "Profile Radiography (at elbows and tees)", detection: "Wall thinning profile without insulation removal", sizing: "Remaining wall profile", code_ref: "API 570 / ASME V Art. 2", rationale: "Profile RT at elbows captures the erosion pattern on extrados. Efficient screening method.", priority: 2, qualification: "ASNT Level II RT", limitations: "Requires source and film/DR setup. Radiation safety." }
  ],

  "FAC": [
    { method: "UT", technique: "UT Grid Mapping at FAC-Susceptible Locations", detection: "Wall thinning from FAC", sizing: "Remaining wall and thinning rate", code_ref: "EPRI FAC Guidelines / API 570", rationale: "Grid UT at locations identified by FAC predictive software (CHECWORKS or equivalent). Focus on single-phase and two-phase flow conditions at 200-500F in carbon steel.", priority: 1, qualification: "ASNT Level II UT", limitations: "FAC creates smooth thinning — hard to detect visually. Requires UT." }
  ],

  "OVERPRESSURE_DAMAGE": [
    { method: "DIMENSIONAL", technique: "Complete Dimensional Survey", detection: "Permanent deformation, bulging, diameter increase, out-of-roundness", sizing: "Quantitative dimensional changes", code_ref: "API 579-1 Part 8", rationale: "PRIMARY assessment method after overpressure event. Compare to nameplate/design dimensions. Diameter increase indicates yielding.", priority: 1, qualification: "Inspector with precision measurement", limitations: "Requires original dimensional data or nameplate." },
    { method: "MT", technique: "MPI at All Weld Connections", detection: "Cracking from overpressure", sizing: "Crack length", code_ref: "API 510 / ASME V Art. 7", rationale: "Check all welds for cracking from overload. Nozzle welds and head-to-shell welds are highest priority.", priority: 1, qualification: "ASNT Level II MT", limitations: "Surface method only." },
    { method: "UT", technique: "UT Thickness + Shear Wave at Critical Locations", detection: "Wall thickness and cracking", sizing: "Remaining wall and crack dimensions", code_ref: "API 510 / API 579-1 Part 8", rationale: "Thickness to verify no pre-existing thinning that exacerbated overpressure effects. Shear wave at welds for cracking.", priority: 1, qualification: "ASNT Level II UT", limitations: "Standard examination." }
  ],

  "FOUNDATION_DAMAGE": [
    { method: "VT", technique: "Visual Survey of All Foundation Elements", detection: "Concrete cracking, grout deterioration, anchor bolt damage, settlement", sizing: "Extent and severity of visible damage", code_ref: "ACI 349 / API 579-1 / API 653 Annex B", rationale: "Comprehensive visual survey of foundations, anchor bolts, grout pads, and concrete. Look for settlement, cracking, corrosion staining from embedded bolts.", priority: 1, qualification: "Structural Engineer or API Inspector", limitations: "Embedded portions of anchor bolts not visible." },
    { method: "UT", technique: "UT of Anchor Bolts (length and defect)", detection: "Cracking or section loss in anchor bolts", sizing: "Remaining cross section and crack depth", code_ref: "ACI 349 / ASTM E587", rationale: "Ultrasonic examination of accessible anchor bolts for cracking and cross-section loss. Especially important post-seismic or post-hurricane.", priority: 2, qualification: "ASNT Level II UT", limitations: "Access to bolt top required. Thread root reflections complicate interpretation." },
    { method: "SURVEY", technique: "Settlement and Level Survey", detection: "Differential and total settlement", sizing: "Quantitative elevation measurements", code_ref: "API 653 Annex B / API 579-1", rationale: "Precision survey of settlement points. Differential settlement is more damaging than total settlement. API 653 Annex B provides acceptance limits for tanks.", priority: 1, qualification: "Survey crew", limitations: "Requires reference benchmarks outside affected area." }
  ],

  "H2_EMBRITTLEMENT": [
    { method: "MT", technique: "WFMT of Bolting and High-Strength Components", detection: "Surface cracking from hydrogen embrittlement", sizing: "Crack length", code_ref: "ASTM F606 / API 574", rationale: "Hydrogen embrittlement in high-strength bolting is a sudden fracture risk. WFMT of all high-strength bolts in hydrogen service during shutdowns.", priority: 1, qualification: "ASNT Level II MT", limitations: "Requires bolt removal for full examination. In-situ limited to accessible areas." },
    { method: "UT", technique: "UT of Bolt/Component Cross-Section", detection: "Internal cracking", sizing: "Crack depth and position", code_ref: "ASME V Art. 4", rationale: "Ultrasonic examination detects internal hydrogen cracking in bolts and high-strength components.", priority: 1, qualification: "ASNT Level II UT", limitations: "Thread geometry complicates scanning. Calibration on representative sample required." }
  ],

  "BLISTERING": [
    { method: "VT", technique: "Visual Mapping of Blisters", detection: "Surface blisters — location, size, height", sizing: "Blister diameter and height measurement", code_ref: "API 510 / API 579-1 Part 7", rationale: "Map all blisters with dimensions. API 579-1 Part 7 Level 1 assessment uses blister diameter and projection.", priority: 1, qualification: "API Inspector", limitations: "Does not detect subsurface HIC without surface blistering." },
    { method: "UT", technique: "Straight Beam UT (remaining ligament under/over blisters)", detection: "Remaining ligament between blister and surface", sizing: "Minimum ligament thickness", code_ref: "API 579-1 Part 7", rationale: "Critical measurement for API 579-1 assessment. Minimum ligament determines if blister can be left in service. Scan around and over each blister.", priority: 1, qualification: "ASNT Level II UT", limitations: "Blister geometry may scatter ultrasound. Multiple angles may be needed." }
  ],

  "VIB_FATIGUE_V": [
    { method: "VT", technique: "Visual Examination for Visible Cracking and Leaks", detection: "Through-wall cracks (staining, weeping, visible cracks)", sizing: "Crack length at surface", code_ref: "API 570 / ASME B31.3", rationale: "First check — look for visible signs of leakage or cracking at socket welds, small-bore connections, and branch connections. Staining, discoloration, or weeping indicates active leak.", priority: 1, qualification: "API Inspector", limitations: "Cannot detect sub-critical cracks. Only catches near-failure or through-wall." },
    { method: "PT", technique: "Liquid Penetrant (visible or fluorescent)", detection: "Surface-breaking fatigue cracks at weld toes", sizing: "Crack length", code_ref: "ASME V Art. 6 / API 570", rationale: "Surface examination of socket welds, fillet welds, and attachment welds for fatigue cracking. Applicable to non-ferromagnetic materials where MT cannot be used.", priority: 1, qualification: "ASNT Level II PT", limitations: "Surface only. May not detect tight, oxide-filled fatigue cracks." },
    { method: "MT", technique: "MPI at Weld Toes of Small-Bore Connections", detection: "Surface-breaking fatigue cracks", sizing: "Crack length", code_ref: "ASME V Art. 7 / API 570", rationale: "MPI at socket weld toes, branch connection weld toes, and attachment welds. These are primary fatigue crack initiation sites.", priority: 1, qualification: "ASNT Level II MT", limitations: "Access may be limited on in-service piping. Ferromagnetic materials only." },
    { method: "UT", technique: "UT Shear Wave at Socket Weld Root", detection: "Root cracking in socket welds", sizing: "Crack depth from root", code_ref: "ASME V Art. 4", rationale: "Socket weld root gap is a known fatigue initiation site. UT from pipe OD to detect root cracking. Specialized technique required.", priority: 2, qualification: "ASNT Level II UT (experienced)", limitations: "Geometry makes inspection difficult. Requires specific technique development." }
  ],

  "MECH_FATIGUE": [
    { method: "MT", technique: "MPI at Stress Concentrators and Weld Toes", detection: "Surface-breaking fatigue cracks", sizing: "Crack length", code_ref: "ASME V Art. 7 / API 510/570", rationale: "Fatigue cracks initiate at stress concentrators — weld toes, notches, thread roots, keyways. WFMT preferred for maximum sensitivity.", priority: 1, qualification: "ASNT Level II MT", limitations: "Surface only. Ferromagnetic materials only." },
    { method: "UT", technique: "PAUT or TOFD at Fatigue-Susceptible Welds", detection: "Fatigue cracking from weld toe", sizing: "Through-wall height for FFS assessment", code_ref: "ASME V Art. 4 / API 579-1 Part 9", rationale: "Volumetric examination of welds at locations where fatigue analysis shows high utilization. Sizing for remaining life assessment.", priority: 1, qualification: "ASNT Level II UT-PA/TOFD", limitations: "Requires knowledge of fatigue-critical locations from analysis." }
  ],

  "DEBRIS_IMPACT": [
    { method: "VT", technique: "Visual Survey of Impact Zones", detection: "Visible damage from debris impact", sizing: "Damage extent", code_ref: "General engineering assessment", rationale: "Comprehensive visual survey to identify all impact damage zones.", priority: 1, qualification: "API Inspector", limitations: "May not identify internal damage." },
    { method: "MT", technique: "MPI at Impact Points", detection: "Cracking from impact", sizing: "Crack length", code_ref: "ASME V Art. 7", rationale: "Check for cracking at and around impact points.", priority: 1, qualification: "ASNT Level II MT", limitations: "Surface only." },
    { method: "UT", technique: "UT Thickness at Impact Zones", detection: "Wall loss from gouging", sizing: "Remaining wall", code_ref: "API 579-1 Part 12", rationale: "Measure remaining wall at gouge locations.", priority: 1, qualification: "ASNT Level II UT", limitations: "Surface irregularity may affect measurement." }
  ],

  "MARINE_CORROSION": [
    { method: "UT", technique: "UT Thickness (splash zone and submerged members)", detection: "Wall loss from marine corrosion", sizing: "Remaining wall thickness", code_ref: "API RP 2I / API RP 2A", rationale: "Wall thickness measurement at splash zone (highest corrosion rate), tidal zone, and submerged zone members.", priority: 1, qualification: "ASNT Level II UT (underwater-qualified where applicable)", limitations: "Surface prep required — marine growth removal." },
    { method: "VT", technique: "Coating/Wrap Condition Survey", detection: "Coating breakdown, wrap damage, bare metal exposure", sizing: "Extent of coating damage", code_ref: "NACE SP0108 / API RP 2I", rationale: "Coating condition directly correlates to corrosion rate. Map all areas of coating breakdown for repair prioritization.", priority: 1, qualification: "Coating Inspector (NACE CIP or equivalent)", limitations: "Does not measure wall thickness." }
  ],

  "CL_SCC": [
    { method: "PT", technique: "Fluorescent Penetrant Testing", detection: "Surface-breaking Cl-SCC (branching transgranular cracks)", sizing: "Crack length and branching extent", code_ref: "ASME V Art. 6", rationale: "Fluorescent PT is preferred over MT for austenitic SS (non-ferromagnetic). Cl-SCC produces fine, tight, branching cracks best detected by fluorescent method.", priority: 1, qualification: "ASNT Level II PT", limitations: "Surface only. Must be clean and dry." },
    { method: "UT", technique: "PAUT at Suspected SCC Zones", detection: "Through-wall extent of SCC", sizing: "Crack depth for FFS assessment", code_ref: "ASME V Art. 4 / API 579-1 Part 9", rationale: "Sizes Cl-SCC for fitness-for-service assessment. Branching nature makes sizing challenging — PAUT with sectorial imaging preferred.", priority: 1, qualification: "ASNT Level II UT-PA", limitations: "Branching crack morphology causes signal scatter. Experienced operator required." },
    { method: "ET", technique: "Eddy Current (for tubing applications)", detection: "SCC in heat exchanger tubes", sizing: "Depth and length", code_ref: "ASME V Art. 8", rationale: "For austenitic SS tubes in heat exchangers, eddy current (conventional or array) is primary inspection method for Cl-SCC.", priority: 1, qualification: "ASNT Level II ET", limitations: "Tube geometry applications only." }
  ],

  "AMINE_SCC": [
    { method: "MT", technique: "WFMT at All Welds (comprehensive)", detection: "Surface-breaking amine SCC at weld HAZ", sizing: "Crack length", code_ref: "API 945 / API 571", rationale: "Amine SCC occurs at weld HAZ of carbon steel without adequate PWHT. WFMT of ALL welds in amine service is standard practice during turnarounds.", priority: 1, qualification: "ASNT Level II MT", limitations: "Surface only. Internal welds may require entry." },
    { method: "UT", technique: "TOFD or PAUT at Welds", detection: "Subsurface and through-wall amine cracking", sizing: "Through-wall depth", code_ref: "ASME V Art. 4 / API 579-1 Part 9", rationale: "Volumetric examination to detect and size cracking that has progressed beyond surface-detectable stage.", priority: 1, qualification: "ASNT Level II UT-TOFD/PA", limitations: "Standard UT limitations." }
  ],

  "CAUSTIC_SCC": [
    { method: "MT", technique: "WFMT at All Welds in Caustic Service", detection: "Surface-breaking caustic SCC (intergranular)", sizing: "Crack length", code_ref: "NACE SP0403 / API 571", rationale: "Caustic SCC is intergranular — occurs at weld HAZ in caustic above threshold. WFMT all welds during inspection.", priority: 1, qualification: "ASNT Level II MT", limitations: "Surface only." },
    { method: "UT", technique: "PAUT/TOFD at Welds", detection: "Through-wall cracking", sizing: "Crack depth for disposition", code_ref: "ASME V Art. 4", rationale: "Size any detected cracking for engineering assessment.", priority: 1, qualification: "ASNT Level II UT-PA/TOFD", limitations: "Standard UT limitations." }
  ],

  "PTA_SCC": [
    { method: "PT", technique: "Fluorescent PT at All Welds (austenitic SS equipment during shutdown)", detection: "Surface-breaking PTA-SCC (intergranular)", sizing: "Crack length", code_ref: "NACE SP0170 / API 571", rationale: "PTA-SCC occurs in sensitized austenitic SS during shutdowns when sulfide scale contacts moisture and oxygen. Fluorescent PT is primary detection method for non-ferromagnetic SS.", priority: 1, qualification: "ASNT Level II PT", limitations: "Must be performed early in shutdown before neutralization. Surface preparation critical." },
    { method: "UT", technique: "PAUT at Welds (if cracking detected)", detection: "Through-wall extent", sizing: "Crack depth for repair/replace decision", code_ref: "ASME V Art. 4", rationale: "Size any detected cracking to determine repair scope.", priority: 1, qualification: "ASNT Level II UT-PA", limitations: "Standard limitations." }
  ],

  "SULFIDATION": [
    { method: "UT", technique: "UT Thickness (grid pattern at high-temperature locations)", detection: "Wall thinning from sulfidation", sizing: "Remaining wall thickness and corrosion rate", code_ref: "API 510/570 / API 571", rationale: "Sulfidation causes uniform-to-localized thinning at elevated temperatures. UT grid measurements at CMLs per API 510/570. Compare to McConomy curves for expected rates.", priority: 1, qualification: "ASNT Level II UT", limitations: "Standard thickness measurement. Scale may affect coupling." },
    { method: "PMI", technique: "Positive Material Identification (XRF or OES)", detection: "Material verification — confirm Cr content matches design", sizing: "Not applicable", code_ref: "API 578 / API 571", rationale: "Material mix-up is a leading cause of accelerated sulfidation. Verify actual Cr content matches specified material. API 578 provides PMI program guidance.", priority: 1, qualification: "PMI Technician", limitations: "Surface measurement. May be affected by scale or coating." }
  ],

  "NAC": [
    { method: "UT", technique: "UT Thickness at High-Temperature Crude Oil Circuits", detection: "Wall thinning from naphthenic acid attack", sizing: "Remaining wall and corrosion rate", code_ref: "API 510/570 / API 571", rationale: "NAC creates sharp-edged, erosion-like thinning. Monitor at highest-temperature locations in crude and vacuum units. Compare to TAN data.", priority: 1, qualification: "ASNT Level II UT", limitations: "Localized attack may be missed by grid spacing." },
    { method: "PMI", technique: "Positive Material Identification", detection: "Material verification — confirm Mo content (316 vs 304)", sizing: "Not applicable", code_ref: "API 578 / API 571", rationale: "Mo-bearing alloys (316/317) are resistant to NAC. Verify material at all locations in NAC-susceptible service.", priority: 1, qualification: "PMI Technician", limitations: "Surface measurement." }
  ],

  "BLAST_DAMAGE": [
    { method: "VT", technique: "Comprehensive Visual Survey of Blast Zone", detection: "Deformation, displacement, buckling, instrument damage", sizing: "Extent of visible damage", code_ref: "API 579-1 / General engineering", rationale: "Map all visible damage from blast overpressure. Identify every affected piece of equipment.", priority: 1, qualification: "Structural Engineer / API Inspector", limitations: "Cannot detect internal damage." },
    { method: "DIMENSIONAL", technique: "Dimensional Survey of Vessels and Structure", detection: "Permanent deformation from blast loading", sizing: "Quantitative dimensional changes", code_ref: "API 579-1 Part 8", rationale: "Blast loading can cause permanent deformation without visible damage. Dimensional survey of all vessels and structures in blast zone.", priority: 1, qualification: "Inspector with measurement capability", limitations: "Requires baseline data." },
    { method: "MT", technique: "MPI at All Welds in Blast Zone", detection: "Cracking from blast-induced stress", sizing: "Crack length", code_ref: "ASME V Art. 7 / API 510/570", rationale: "Blast overpressure may crack welds — especially at stress concentrators.", priority: 1, qualification: "ASNT Level II MT", limitations: "Surface only." }
  ],

  "FLOOD_DAMAGE": [
    { method: "VT", technique: "Visual Survey of Submerged/Flooded Equipment", detection: "Water damage, debris impact, silt/mud accumulation, electrical damage", sizing: "Extent of flood damage", code_ref: "General engineering assessment", rationale: "Comprehensive visual survey after flood waters recede. Document all damage.", priority: 1, qualification: "API Inspector", limitations: "Subsurface damage may not be visible." },
    { method: "UT", technique: "UT Thickness (accelerated CUI after flood)", detection: "Wall thinning from water saturation of insulation", sizing: "Remaining wall thickness", code_ref: "API 510/570 / API 571 CUI", rationale: "Flood saturation of insulation dramatically accelerates CUI. Targeted UT at insulation removal points.", priority: 1, qualification: "ASNT Level II UT", limitations: "Insulation removal may be extensive." }
  ],

  "NOZZLE_PIPING_LOADS": [
    { method: "VT", technique: "Visual Examination of Nozzle Connections and Pipe Supports", detection: "Displacement, leakage, support damage", sizing: "Extent of visible issues", code_ref: "API 510/570 / ASME B31.3", rationale: "Check for nozzle leakage, flange separation, pipe support damage (spring hangers topped/bottomed, guides displaced, anchors damaged).", priority: 1, qualification: "API Inspector / Piping Engineer", limitations: "Cannot detect internal cracking." },
    { method: "MT", technique: "MPI at Nozzle Welds", detection: "Cracking from overload", sizing: "Crack length", code_ref: "ASME V Art. 7 / API 510", rationale: "Nozzle-to-shell welds under overload may crack. MPI of all nozzle welds in affected area.", priority: 1, qualification: "ASNT Level II MT", limitations: "Surface only." }
  ],

  "STRUCTURAL_OVERLOAD": [
    { method: "VT", technique: "Visual Survey of Deformed Structure", detection: "Visible deformation, buckling, displacement", sizing: "Extent of deformation", code_ref: "API 579-1 Part 8 / AISC 360", rationale: "Document all visible deformation with measurements and photographs.", priority: 1, qualification: "Structural Engineer", limitations: "Cannot detect cracking in deformed zones without NDE." },
    { method: "MT", technique: "MPI at Buckled/Deformed Locations", detection: "Cracking at deformed zones", sizing: "Crack length", code_ref: "ASME V Art. 7", rationale: "Buckling and plastic deformation may cause cracking. MPI required at all deformed connections.", priority: 1, qualification: "ASNT Level II MT", limitations: "Surface only." },
    { method: "UT", technique: "UT at Critical Connections in Deformed Zone", detection: "Subsurface cracking from overload", sizing: "Crack depth", code_ref: "ASME V Art. 4", rationale: "Volumetric examination of critical connections in the deformed zone.", priority: 2, qualification: "ASNT Level II UT", limitations: "Complex geometry in deformed areas." }
  ],

  "CP_DEFICIENCY": [
    { method: "CP", technique: "Close-Interval CP Survey", detection: "Protection levels along entire structure", sizing: "Potential measurements at close intervals", code_ref: "NACE SP0176 / DNV-RP-B401", rationale: "Detailed CP survey to map protection levels. Identify areas of under-protection.", priority: 1, qualification: "CP Technician / NACE certified", limitations: "Requires reference electrode placement. IR drop correction." },
    { method: "UT", technique: "UT Thickness at Under-Protected Locations", detection: "Corrosion damage from CP deficiency", sizing: "Remaining wall thickness", code_ref: "API RP 2I / NACE SP0176", rationale: "Measure wall thickness at any locations with inadequate CP to assess corrosion damage.", priority: 1, qualification: "ASNT Level II UT", limitations: "Access dependent. Marine growth removal required." }
  ]
};


// --- ENGINE 3 FUNCTION ---

function runEngine3(
  mechanisms: DamageMechanism[],
  zones: AffectedZone[]
): InspectionMethod[] {

  var methods: InspectionMethod[] = [];
  var method_key_set: { [key: string]: boolean } = {};

  for (var m = 0; m < mechanisms.length; m++) {
    var mech_id = mechanisms[m].id;
    var mech_methods = METHOD_RULES[mech_id];
    if (!mech_methods) continue;

    // Find zones that reference this mechanism
    var mech_zones: AffectedZone[] = [];
    for (var z = 0; z < zones.length; z++) {
      if (zones[z].damage_mechanisms.indexOf(mech_id) !== -1) {
        mech_zones.push(zones[z]);
      }
    }

    for (var mm = 0; mm < mech_methods.length; mm++) {
      var rule = mech_methods[mm];

      // For each applicable zone, create a method entry
      var target_zones_for_method = mech_zones.length > 0 ? mech_zones : [{
        zone_id: "GENERAL",
        zone_name: "General — per inspector judgment",
        priority: 3,
        damage_mechanisms: [mech_id],
        rationale: "",
        asset_specific: false
      }];

      for (var tz = 0; tz < target_zones_for_method.length; tz++) {
        var zone_for_method = target_zones_for_method[tz];

        // Deduplicate by method+technique+zone combination
        var dedupe_key = rule.method + "|" + rule.technique + "|" + zone_for_method.zone_id;
        if (method_key_set[dedupe_key]) continue;
        method_key_set[dedupe_key] = true;

        methods.push({
          method_id: rule.method + "-" + mech_id + "-" + zone_for_method.zone_id,
          method_name: rule.method,
          technique_variant: rule.technique,
          target_mechanism: mech_id + " (" + mechanisms[m].name + ")",
          target_zone: zone_for_method.zone_name,
          detection_capability: rule.detection,
          sizing_capability: rule.sizing,
          code_reference: rule.code_ref,
          rationale: rule.rationale,
          priority: Math.min(rule.priority, zone_for_method.priority),
          personnel_qualification: rule.qualification,
          limitations: rule.limitations
        });
      }
    }
  }

  // Sort by priority
  methods.sort(function(a, b) {
    return a.priority - b.priority;
  });

  return methods;
}


// ============================================================================
// ENGINE 4: FINDING-TO-CODE-TO-ACTION ENGINE
// Maps anticipated finding types to specific code sections, FFS assessments,
// repair standards, and required documentation
// ============================================================================

var FINDING_CODE_MAP: { [asset_class: string]: { [finding_type: string]: {
  primary_code: string;
  code_section: string;
  required_action: string;
  ffs_standard: string;
  ffs_part: string;
  repair_standard: string;
  documentation: string[];
  engineering_review: boolean;
} } } = {

  "pressure_vessel": {
    "crack": {
      primary_code: "API 510",
      code_section: "API 510 Section 7 (Condition Assessment) + Section 8 (Repair/Alteration)",
      required_action: "Size crack (length, depth, orientation). Determine if surface-only or through-wall. Perform FFS assessment or repair/replace.",
      ffs_standard: "API 579-1/ASME FFS-1",
      ffs_part: "Part 9 (Assessment of Crack-Like Flaws)",
      repair_standard: "ASME PCC-2 (Repair of Pressure Equipment and Piping)",
      documentation: [
        "Crack location sketch with dimensions",
        "NDE report (method, technique, procedure, results)",
        "Flaw characterization (type, orientation, through-wall height, length)",
        "FFS assessment calculation per API 579-1 Part 9",
        "Material properties and operating conditions",
        "Repair procedure if applicable (ASME PCC-2 compliant)",
        "Authorized Inspector acceptance"
      ],
      engineering_review: true
    },
    "wall_thinning_general": {
      primary_code: "API 510",
      code_section: "API 510 Section 7.4 (Corrosion Rate and Remaining Life)",
      required_action: "Calculate remaining life = (t_actual - t_required) / corrosion_rate. Set next inspection date per API 510. Perform FFS if below retirement thickness.",
      ffs_standard: "API 579-1/ASME FFS-1",
      ffs_part: "Part 4 (Assessment of General Metal Loss)",
      repair_standard: "ASME PCC-2 (if repair needed) or NBIC Part 3",
      documentation: [
        "UT thickness data sheets with CML map",
        "Corrosion rate calculation (short-term and long-term)",
        "Remaining life calculation",
        "Minimum required wall thickness calculation (ASME VIII Div. 1 or 2)",
        "Next inspection interval determination per API 510",
        "FFS assessment if below retirement thickness"
      ],
      engineering_review: false
    },
    "wall_thinning_local": {
      primary_code: "API 510",
      code_section: "API 510 Section 7 + API 579-1 Part 5",
      required_action: "Map local thin area (LTA) dimensions. Perform FFS assessment per API 579-1 Part 5. Determine if LTA is acceptable, requires repair, or requires replacement.",
      ffs_standard: "API 579-1/ASME FFS-1",
      ffs_part: "Part 5 (Assessment of Local Metal Loss)",
      repair_standard: "ASME PCC-2",
      documentation: [
        "UT thickness grid data for LTA (critical thickness profile)",
        "LTA dimensions: length (s), width (c), minimum thickness (t_mm)",
        "Remaining strength factor (RSF) calculation",
        "FFS assessment per API 579-1 Part 5 Level 1 or 2",
        "MAWP at FFS condition"
      ],
      engineering_review: true
    },
    "pitting": {
      primary_code: "API 510",
      code_section: "API 510 Section 7 + API 579-1 Part 6",
      required_action: "Map pit field (pit depth, diameter, density, spacing). Perform FFS per API 579-1 Part 6. Determine remaining strength.",
      ffs_standard: "API 579-1/ASME FFS-1",
      ffs_part: "Part 6 (Assessment of Pitting Corrosion)",
      repair_standard: "ASME PCC-2",
      documentation: [
        "Pit map with individual pit measurements (depth, diameter)",
        "Pit pair spacing and pit density",
        "Maximum pit depth and remaining ligament",
        "FFS assessment per API 579-1 Part 6 (Level 1 or 2)",
        "Remaining life estimate based on pitting rate"
      ],
      engineering_review: true
    },
    "hic_blistering": {
      primary_code: "API 510",
      code_section: "API 510 + API 579-1 Part 7",
      required_action: "Map all blisters/HIC. Measure remaining ligament above and below damage. Assess per API 579-1 Part 7. Determine if monitoring or repair required.",
      ffs_standard: "API 579-1/ASME FFS-1",
      ffs_part: "Part 7 (Assessment of Hydrogen Blisters and HIC/SOHIC Damage)",
      repair_standard: "API RP 945 / ASME PCC-2",
      documentation: [
        "Blister/HIC map with dimensions and locations",
        "UT data showing through-wall position and remaining ligament",
        "HIC extent mapping (C-scan or encoded PAUT)",
        "FFS assessment per API 579-1 Part 7",
        "Weld proximity to HIC damage",
        "Process conditions (H2S concentration, pH, temperature)"
      ],
      engineering_review: true
    },
    "deformation": {
      primary_code: "API 510",
      code_section: "API 510 + API 579-1 Part 8",
      required_action: "Dimensional survey (diameter, out-of-roundness, local bulging). Assess per API 579-1 Part 8. Determine if within acceptable limits.",
      ffs_standard: "API 579-1/ASME FFS-1",
      ffs_part: "Part 8 (Assessment of Weld Misalignment and Shell Distortions)",
      repair_standard: "ASME PCC-2",
      documentation: [
        "Dimensional survey data (before and after if available)",
        "Out-of-roundness measurements",
        "Local bulge profile",
        "FFS assessment per API 579-1 Part 8",
        "Root cause of deformation"
      ],
      engineering_review: true
    },
    "fire_damage": {
      primary_code: "API 510",
      code_section: "API 510 + API 579-1 Part 11",
      required_action: "Fire damage assessment per API 579-1 Part 11. Hardness survey, metallographic replication, dimensional survey. Determine if equipment can return to service.",
      ffs_standard: "API 579-1/ASME FFS-1",
      ffs_part: "Part 11 (Assessment of Fire Damage)",
      repair_standard: "ASME PCC-2 / NBIC Part 3",
      documentation: [
        "Fire zone mapping with estimated temperature exposure",
        "Hardness survey data and comparison to baseline",
        "Metallographic replication results",
        "Dimensional survey (deformation check)",
        "UT thickness data in fire zone",
        "FFS assessment per API 579-1 Part 11",
        "Return-to-service determination by Engineer and AI"
      ],
      engineering_review: true
    },
    "dent_gouge": {
      primary_code: "API 510",
      code_section: "API 510 + API 579-1 Part 12",
      required_action: "Measure dent depth, gouge depth, remaining wall. Check for cracking. Assess per API 579-1 Part 12.",
      ffs_standard: "API 579-1/ASME FFS-1",
      ffs_part: "Part 12 (Assessment of Dents, Gouges, and Dent-Gouge Combinations)",
      repair_standard: "ASME PCC-2",
      documentation: [
        "Dent profile measurements (depth, length, width)",
        "Gouge measurements (depth, length, remaining wall)",
        "NDE results for cracking at damage zone",
        "FFS assessment per API 579-1 Part 12",
        "Strain calculation from dent profile"
      ],
      engineering_review: true
    },
    "creep_damage": {
      primary_code: "API 510",
      code_section: "API 510 + API 579-1 Part 10",
      required_action: "Metallographic replication for creep classification. Remaining life assessment per API 579-1 Part 10. Determine re-inspection interval or retirement.",
      ffs_standard: "API 579-1/ASME FFS-1",
      ffs_part: "Part 10 (Assessment of Components Operating in the Creep Range)",
      repair_standard: "ASME PCC-2",
      documentation: [
        "Replication results with Neubauer classification",
        "Hardness survey data",
        "Dimensional measurements (diameter/strain)",
        "Operating history (temperature, pressure, time)",
        "Remaining life assessment per API 579-1 Part 10 or Omega method",
        "Re-inspection interval determination"
      ],
      engineering_review: true
    }
  },

  "process_piping": {
    "crack": {
      primary_code: "API 570",
      code_section: "API 570 Section 7 (Inspection of Piping Systems)",
      required_action: "Size crack. FFS assessment per API 579-1 Part 9 or repair/replace per ASME PCC-2.",
      ffs_standard: "API 579-1/ASME FFS-1",
      ffs_part: "Part 9 (Crack-Like Flaws)",
      repair_standard: "ASME PCC-2 / ASME B31.3 Chapter IX",
      documentation: [
        "Crack characterization (location, orientation, dimensions)",
        "NDE report with sizing data",
        "FFS assessment per API 579-1 Part 9",
        "Repair procedure per ASME PCC-2 or B31.3"
      ],
      engineering_review: true
    },
    "wall_thinning": {
      primary_code: "API 570",
      code_section: "API 570 Section 7.1 (Thickness Measurements)",
      required_action: "Calculate remaining life and corrosion rate. Set next inspection. FFS if below retirement.",
      ffs_standard: "API 579-1/ASME FFS-1",
      ffs_part: "Part 4/5 (General/Local Metal Loss)",
      repair_standard: "ASME PCC-2 / ASME B31.3",
      documentation: [
        "UT thickness data at TMLs (Thickness Measurement Locations)",
        "Corrosion rate and remaining life",
        "Piping circuit minimum required thickness",
        "Next inspection interval per API 570"
      ],
      engineering_review: false
    },
    "vibration_fatigue_crack": {
      primary_code: "API 570",
      code_section: "API 570 Section 7 + ASME B31.3",
      required_action: "IMMEDIATE: isolate if through-wall or near-through-wall. Repair/replace affected connection. Root cause analysis — address vibration source.",
      ffs_standard: "API 579-1/ASME FFS-1",
      ffs_part: "Part 9 (Crack-Like Flaws) — but repair/replace is typically the action for SBC fatigue",
      repair_standard: "ASME B31.3 Chapter IX / ASME PCC-2",
      documentation: [
        "Crack location and dimensions at connection",
        "Vibration source identification",
        "Root cause analysis (modal analysis, piping stress analysis)",
        "Repair/replacement documentation per ASME B31.3",
        "Corrective action to address vibration (support addition, damper, reroute)"
      ],
      engineering_review: true
    }
  },

  "storage_tank": {
    "bottom_corrosion": {
      primary_code: "API 653",
      code_section: "API 653 Section 6 (Tank Bottom Evaluation)",
      required_action: "Floor scan. Minimum thickness assessment. Repair or reline per API 653.",
      ffs_standard: "API 579-1/ASME FFS-1",
      ffs_part: "Part 4 (General Metal Loss) for floor plates",
      repair_standard: "API 653 Section 9 / API Std 650 (new construction requirements for repairs)",
      documentation: [
        "Floor scan data (MFL or UT grid)",
        "Minimum bottom plate thickness",
        "Annular ring thickness (critical zone)",
        "Repair plan per API 653 Section 9"
      ],
      engineering_review: true
    },
    "shell_corrosion": {
      primary_code: "API 653",
      code_section: "API 653 Section 6.3 (Shell Evaluation)",
      required_action: "UT thickness measurement. Calculate minimum acceptable thickness per API 653 equation. Determine next inspection interval or repair.",
      ffs_standard: "API 579-1/ASME FFS-1",
      ffs_part: "Part 4/5 (General/Local Metal Loss)",
      repair_standard: "API 653 Section 9",
      documentation: [
        "Shell course thickness data (each course)",
        "Minimum required thickness calculation per API 653",
        "Corrosion rate and remaining life per course",
        "Maximum fill height determination if restricted"
      ],
      engineering_review: false
    },
    "settlement": {
      primary_code: "API 653",
      code_section: "API 653 Annex B (Evaluation of Tank Bottom Settlement)",
      required_action: "Settlement survey. Compare to API 653 Annex B acceptance criteria. Determine if releveling or repair required.",
      ffs_standard: "API 579-1/ASME FFS-1",
      ffs_part: "Part 8 (Shell Distortions) + API 653 Annex B specifically",
      repair_standard: "API 653 Section 9",
      documentation: [
        "Settlement survey data (edge and center points)",
        "Differential settlement calculation",
        "API 653 Annex B evaluation (rigid tilt, flexible settlement, edge settlement)",
        "Shell-to-bottom weld examination results"
      ],
      engineering_review: true
    }
  },

  "pipeline": {
    "crack": {
      primary_code: "ASME B31.8 / 49 CFR 192",
      code_section: "ASME B31.8 + API 579-1 Part 9",
      required_action: "Immediate pressure reduction if crack is significant. FFS assessment. Repair per ASME B31.8 or replace.",
      ffs_standard: "API 579-1/ASME FFS-1",
      ffs_part: "Part 9 (Crack-Like Flaws)",
      repair_standard: "ASME B31.8 / ASME PCC-2 / Composite repair per ASME PCC-2 Art. 4.1",
      documentation: [
        "ILI data or direct examination results",
        "Crack dimensions and orientation",
        "FFS assessment per API 579-1 Part 9",
        "Regulatory notification if required (49 CFR 192/195)"
      ],
      engineering_review: true
    },
    "dent_gouge": {
      primary_code: "ASME B31.8 / 49 CFR 192",
      code_section: "ASME B31.8 + API 579-1 Part 12",
      required_action: "Measure dent depth (% OD), gouge depth, check for cracking. Immediate repair if dent-gouge combination on bottom of pipe.",
      ffs_standard: "API 579-1/ASME FFS-1",
      ffs_part: "Part 12 (Dents, Gouges, and Dent-Gouge Combinations)",
      repair_standard: "ASME B31.8 / ASME PCC-2",
      documentation: [
        "ILI anomaly data or direct measurement",
        "Dent profile (depth, length, width, strain)",
        "Gouge depth and remaining wall",
        "NDE for cracking at dent/gouge",
        "FFS assessment per API 579-1 Part 12"
      ],
      engineering_review: true
    },
    "wall_thinning": {
      primary_code: "ASME B31.8 / 49 CFR 192",
      code_section: "ASME B31.8 + API 579-1 Part 4/5",
      required_action: "Assess remaining strength. Determine if safe operating pressure reduction needed. Repair or monitor.",
      ffs_standard: "API 579-1/ASME FFS-1",
      ffs_part: "Part 4/5 (General/Local Metal Loss) + ASME B31G (simplified)",
      repair_standard: "ASME B31.8 / Composite sleeve per ASME PCC-2",
      documentation: [
        "ILI data or direct UT measurements",
        "ASME B31G or RSTRENG assessment",
        "Safe operating pressure determination",
        "Monitoring plan or repair schedule"
      ],
      engineering_review: true
    }
  },

  "structural_steel": {
    "crack_at_joint": {
      primary_code: "AWS D1.1 / API RP 2A",
      code_section: "AWS D1.1 Chapter 6 (Inspection) / API RP 2A (for offshore)",
      required_action: "Size crack. Fatigue life assessment. Repair per AWS D1.1 Chapter 5 or engineering assessment.",
      ffs_standard: "API 579-1 Part 9 or BS 7910",
      ffs_part: "Part 9 (Crack-Like Flaws) — fracture + fatigue assessment",
      repair_standard: "AWS D1.1 Chapter 5 (Fabrication) / API RP 2A",
      documentation: [
        "Joint identification and location",
        "Crack dimensions (length, depth) from NDE",
        "Fatigue analysis (S-N or fracture mechanics)",
        "Repair procedure per AWS D1.1 or platform-specific repair procedure",
        "Structural analysis showing impact of crack on global integrity"
      ],
      engineering_review: true
    },
    "member_buckling": {
      primary_code: "API RP 2A / AISC 360",
      code_section: "API RP 2A Section 6 (Structural Assessment) / AISC 360 Chapter E",
      required_action: "Structural analysis of reduced capacity. Determine if member can be straightened or must be replaced. Temporary bracing if required.",
      ffs_standard: "Engineering assessment per API RP 2A or AISC 360",
      ffs_part: "Structural push-over analysis or linear assessment",
      repair_standard: "AWS D1.1 / Platform-specific repair procedures",
      documentation: [
        "Member identification and buckle measurements",
        "Structural analysis with damaged member",
        "Repair/replacement plan",
        "Temporary stabilization if needed"
      ],
      engineering_review: true
    },
    "corrosion_wall_loss": {
      primary_code: "API RP 2A / AISC 360",
      code_section: "API RP 2A Section 6",
      required_action: "Measure remaining wall. Calculate reduced section capacity. Determine if clamp repair, weld buildup, or replacement needed.",
      ffs_standard: "Structural adequacy assessment per API RP 2A",
      ffs_part: "Section capacity calculation with reduced wall",
      repair_standard: "AWS D1.1 / Engineered clamp repair",
      documentation: [
        "UT thickness data around member circumference",
        "Minimum remaining wall and location",
        "Structural capacity calculation with reduced section",
        "Repair plan (buildup, clamp, or replacement)"
      ],
      engineering_review: true
    }
  }
};


// --- ENGINE 4 FUNCTION ---

function runEngine4(
  mechanisms: DamageMechanism[],
  asset: ResolvedAsset
): CodeActionPath[] {

  var paths: CodeActionPath[] = [];
  var asset_class = asset.asset_class || "pressure_vessel";
  var asset_map = FINDING_CODE_MAP[asset_class];
  if (!asset_map) {
    asset_map = FINDING_CODE_MAP["pressure_vessel"];
  }
  if (!asset_map) return paths;

  // Map mechanisms to anticipated finding types
  var anticipated_findings: string[] = [];

  for (var m = 0; m < mechanisms.length; m++) {
    var mech_id = mechanisms[m].id;

    // Mechanism to finding type mapping
    if (mech_id === "SSC" || mech_id === "SOHIC" || mech_id === "AMINE_SCC" ||
        mech_id === "CAUSTIC_SCC" || mech_id === "CL_SCC" || mech_id === "PTA_SCC" ||
        mech_id === "MECH_FATIGUE" || mech_id === "VIB_FATIGUE" || mech_id === "VIB_FATIGUE_V" ||
        mech_id === "THERMAL_FATIGUE" || mech_id === "H2_EMBRITTLEMENT") {
      if (anticipated_findings.indexOf("crack") === -1) anticipated_findings.push("crack");
      if (asset_class === "process_piping" && (mech_id === "VIB_FATIGUE" || mech_id === "VIB_FATIGUE_V")) {
        if (anticipated_findings.indexOf("vibration_fatigue_crack") === -1) anticipated_findings.push("vibration_fatigue_crack");
      }
    }

    if (mech_id === "HIC" || mech_id === "HIC_H2" || mech_id === "BLISTERING") {
      if (anticipated_findings.indexOf("hic_blistering") === -1) anticipated_findings.push("hic_blistering");
    }

    if (mech_id === "GENERAL_CORROSION" || mech_id === "SULFIDATION" || mech_id === "NAC" ||
        mech_id === "FAC" || mech_id === "AMINE_CORROSION" || mech_id === "CAUSTIC_CORROSION" ||
        mech_id === "MARINE_CORROSION" || mech_id === "EROSION") {
      var thinning_type = "wall_thinning_general";
      if (asset_class === "process_piping") thinning_type = "wall_thinning";
      if (asset_class === "storage_tank") {
        if (anticipated_findings.indexOf("shell_corrosion") === -1) anticipated_findings.push("shell_corrosion");
        if (anticipated_findings.indexOf("bottom_corrosion") === -1) anticipated_findings.push("bottom_corrosion");
      } else if (asset_class === "pipeline") {
        thinning_type = "wall_thinning";
      } else if (asset_class === "structural_steel") {
        if (anticipated_findings.indexOf("corrosion_wall_loss") === -1) anticipated_findings.push("corrosion_wall_loss");
        thinning_type = "";
      }
      if (thinning_type && anticipated_findings.indexOf(thinning_type) === -1) {
        anticipated_findings.push(thinning_type);
      }
    }

    if (mech_id === "PITTING" || mech_id === "MIC") {
      if (asset_class !== "storage_tank" && asset_class !== "pipeline" && asset_class !== "structural_steel") {
        if (anticipated_findings.indexOf("pitting") === -1) anticipated_findings.push("pitting");
      }
    }

    if (mech_id === "CUI") {
      var cui_finding = asset_class === "process_piping" ? "wall_thinning" : "wall_thinning_local";
      if (anticipated_findings.indexOf(cui_finding) === -1) anticipated_findings.push(cui_finding);
    }

    if (mech_id === "FIRE_DAMAGE" || mech_id === "METALLURGICAL_CHANGE") {
      if (anticipated_findings.indexOf("fire_damage") === -1) anticipated_findings.push("fire_damage");
    }

    if (mech_id === "MECH_DAMAGE" || mech_id === "DEBRIS_IMPACT") {
      var dent_type = asset_class === "pipeline" ? "dent_gouge" : "dent_gouge";
      if (anticipated_findings.indexOf(dent_type) === -1) anticipated_findings.push(dent_type);
    }

    if (mech_id === "STRUCTURAL_OVERLOAD" || mech_id === "OVERPRESSURE_DAMAGE" ||
        mech_id === "BLAST_DAMAGE") {
      if (anticipated_findings.indexOf("deformation") === -1) anticipated_findings.push("deformation");
      if (asset_class === "structural_steel") {
        if (anticipated_findings.indexOf("member_buckling") === -1) anticipated_findings.push("member_buckling");
      }
    }

    if (mech_id === "CREEP" || mech_id === "GRAPHITIZATION" || mech_id === "SPHEROIDIZATION") {
      if (anticipated_findings.indexOf("creep_damage") === -1) anticipated_findings.push("creep_damage");
    }

    if (mech_id === "HTHA") {
      if (anticipated_findings.indexOf("crack") === -1) anticipated_findings.push("crack");
    }

    if (mech_id === "WIND_STRUCTURAL" || mech_id === "WAVE_LOADING") {
      if (asset_class === "structural_steel" || asset_class === "offshore_platform") {
        if (anticipated_findings.indexOf("crack_at_joint") === -1) anticipated_findings.push("crack_at_joint");
        if (anticipated_findings.indexOf("member_buckling") === -1) anticipated_findings.push("member_buckling");
      }
    }

    if (mech_id === "FOUNDATION_DAMAGE") {
      if (asset_class === "storage_tank") {
        if (anticipated_findings.indexOf("settlement") === -1) anticipated_findings.push("settlement");
      }
    }
  }

  // Build code action paths from anticipated findings
  for (var f = 0; f < anticipated_findings.length; f++) {
    var finding_type = anticipated_findings[f];
    var code_entry = asset_map[finding_type];
    if (!code_entry) continue;

    paths.push({
      finding_type: finding_type,
      primary_code: code_entry.primary_code,
      code_section: code_entry.code_section,
      required_action: code_entry.required_action,
      ffs_assessment: code_entry.ffs_standard + " " + code_entry.ffs_part,
      repair_standard: code_entry.repair_standard,
      documentation_required: code_entry.documentation,
      engineering_review_required: code_entry.engineering_review
    });
  }

  return paths;
}


// ============================================================================
// ENGINE 5: INSPECTION ESCALATION TIMELINE ENGINE
// Priority-based scheduling with personnel and notification requirements
// ============================================================================

function runEngine5(
  mechanisms: DamageMechanism[],
  parsed: ParsedIncident
): EscalationTier[] {

  var tiers: EscalationTier[] = [];
  var has_critical = false;
  var has_high = false;
  var has_medium = false;
  var has_immediate = false;

  for (var m = 0; m < mechanisms.length; m++) {
    if (mechanisms[m].requires_immediate_action) has_immediate = true;
    if (mechanisms[m].severity === "critical") has_critical = true;
    if (mechanisms[m].severity === "high") has_high = true;
    if (mechanisms[m].severity === "medium") has_medium = true;
  }

  // Tier 1: IMMEDIATE (0-6 hours)
  if (has_immediate || has_critical) {
    var immediate_mechanisms: string[] = [];
    for (var m = 0; m < mechanisms.length; m++) {
      if (mechanisms[m].requires_immediate_action || mechanisms[m].severity === "critical") {
        immediate_mechanisms.push(mechanisms[m].name);
      }
    }

    tiers.push({
      tier_name: "IMMEDIATE",
      time_window: "0-6 hours",
      hours_min: 0,
      hours_max: 6,
      actions: [
        "Isolate affected equipment/area if safety concern exists",
        "Perform rapid visual assessment of all affected equipment",
        "Identify any active leaks, deformation, or imminent failure indicators",
        "Establish exclusion zones if structural integrity is uncertain",
        "Deploy emergency inspection team for critical mechanisms: " + immediate_mechanisms.join(", "),
        "Verify pressure relief devices are functional",
        "Confirm emergency shutdown systems are operational",
        "Begin photographic documentation of all damage"
      ],
      personnel_required: [
        "Operations Supervisor (on-scene incident commander)",
        "API Authorized Inspector (or designee)",
        "Safety Representative",
        "Process Engineer (available for consultation)"
      ],
      notifications: [
        "Plant Manager / Facility Manager",
        "Engineering Manager",
        "Regulatory agency if required (OSHA PSM, BSEE for offshore, PHMSA for pipeline)",
        "Insurance carrier (if significant damage)",
        "Corporate safety department"
      ],
      documentation: [
        "Initial damage assessment report (preliminary)",
        "Photographic documentation",
        "Equipment isolation status",
        "Personnel accountability"
      ]
    });
  }

  // Tier 2: URGENT (6-24 hours)
  if (has_critical || has_high) {
    var urgent_mechanisms: string[] = [];
    for (var m = 0; m < mechanisms.length; m++) {
      if (mechanisms[m].severity === "critical" || mechanisms[m].severity === "high") {
        urgent_mechanisms.push(mechanisms[m].name);
      }
    }

    tiers.push({
      tier_name: "URGENT",
      time_window: "6-24 hours",
      hours_min: 6,
      hours_max: 24,
      actions: [
        "Deploy NDE teams for detailed inspection of critical/high-severity mechanisms",
        "Perform UT thickness measurements at priority locations",
        "Conduct MPI/PT examination of welds at highest-risk zones",
        "Complete dimensional survey if deformation suspected",
        "Collect hardness data if fire exposure or creep suspected",
        "Begin metallographic replication if required (HTHA, creep, fire damage)",
        "Assess structural integrity of supports and foundations",
        "Activate Fitness-for-Service assessment process for critical findings",
        "Mechanisms requiring urgent NDE: " + urgent_mechanisms.join(", ")
      ],
      personnel_required: [
        "NDE Level II technicians (UT, MT, PT — as required by method selection)",
        "NDE Level III (on-call for interpretation of complex findings)",
        "API 510/570/653 Inspector (as applicable to equipment type)",
        "Mechanical/Structural Engineer",
        "Metallurgist (if HTHA, creep, or fire damage suspected)",
        "Underwater inspection team (if offshore/submerged structures)"
      ],
      notifications: [
        "Engineering review team assembled",
        "NDE contractor mobilized (if external resources needed)",
        "Spare parts and repair materials identified"
      ],
      documentation: [
        "NDE reports for all examinations performed",
        "Thickness data sheets",
        "Damage mapping and sketches",
        "Preliminary FFS assessment if immediate disposition needed"
      ]
    });
  }

  // Tier 3: PRIORITY (24-72 hours)
  if (has_high || has_medium) {
    tiers.push({
      tier_name: "PRIORITY",
      time_window: "24-72 hours",
      hours_min: 24,
      hours_max: 72,
      actions: [
        "Complete comprehensive NDE program for all identified zones",
        "Perform advanced NDE (PAUT, TOFD, AUBT) where specified by method selection",
        "Complete FFS assessments for all findings requiring engineering evaluation",
        "Determine remaining life and next inspection intervals",
        "Develop repair/replacement plan for items not meeting FFS criteria",
        "Verify cathodic protection system (if applicable)",
        "Complete CUI survey at susceptible locations",
        "Update inspection database with all findings",
        "Conduct root cause analysis for damage mechanisms"
      ],
      personnel_required: [
        "NDE Level II/III technicians (advanced techniques as needed)",
        "FFS assessment engineer (API 579-1 qualified)",
        "Corrosion Engineer",
        "CP Technician (if applicable)",
        "Data management / inspection records"
      ],
      notifications: [
        "Management update with preliminary findings",
        "Regulatory agency update if required",
        "Capital planning team (if major repairs/replacements needed)"
      ],
      documentation: [
        "Complete NDE report package",
        "FFS assessment calculations and conclusions",
        "Repair/replacement recommendations",
        "Root cause analysis (preliminary)",
        "Cost estimates for repairs"
      ]
    });
  }

  // Tier 4: SCHEDULED FOLLOW-UP (72 hours - 7 days)
  tiers.push({
    tier_name: "SCHEDULED FOLLOW-UP",
    time_window: "72 hours - 7 days",
    hours_min: 72,
    hours_max: 168,
    actions: [
      "Complete all remaining inspections from the inspection plan",
      "Finalize all FFS assessments",
      "Execute approved repairs",
      "Verify repair quality with post-repair NDE",
      "Update long-term inspection plan with new intervals",
      "Document lessons learned",
      "Update risk-based inspection (RBI) program if applicable",
      "Validate monitoring systems (corrosion probes, thickness monitoring) are functional",
      "Schedule follow-up inspections per assessment conclusions"
    ],
    personnel_required: [
      "Repair crews (welders, pipe fitters — qualified per applicable code)",
      "NDE technicians for post-repair examination",
      "Inspector for final acceptance",
      "Engineering for return-to-service authorization"
    ],
    notifications: [
      "Final incident report to management",
      "Regulatory close-out documentation",
      "Insurance claim documentation",
      "Updated inspection plan to stakeholders"
    ],
    documentation: [
      "Final inspection report (comprehensive)",
      "All NDE reports and data sheets",
      "FFS assessments (final)",
      "Repair records with supporting NDE",
      "Return-to-service authorization",
      "Updated inspection intervals and monitoring plan",
      "Lessons learned report"
    ]
  });

  return tiers;
}


// ============================================================================
// ENGINE 6: EXECUTION PACKAGE GENERATOR
// Role-specific outputs for supervisor, engineer, and executive
// ============================================================================

function runEngine6(
  mechanisms: DamageMechanism[],
  zones: AffectedZone[],
  methods: InspectionMethod[],
  code_paths: CodeActionPath[],
  timeline: EscalationTier[],
  parsed: ParsedIncident,
  asset: ResolvedAsset
): ExecutionPackage[] {

  var packages: ExecutionPackage[] = [];

  // Count critical/high items
  var critical_count = 0;
  var high_count = 0;
  var priority_1_zones = 0;
  var unique_methods: string[] = [];
  var needs_engineering = false;

  for (var m = 0; m < mechanisms.length; m++) {
    if (mechanisms[m].severity === "critical") critical_count++;
    if (mechanisms[m].severity === "high") high_count++;
  }
  for (var z = 0; z < zones.length; z++) {
    if (zones[z].priority === 1) priority_1_zones++;
  }
  for (var im = 0; im < methods.length; im++) {
    if (unique_methods.indexOf(methods[im].method_name) === -1) {
      unique_methods.push(methods[im].method_name);
    }
  }
  for (var cp = 0; cp < code_paths.length; cp++) {
    if (code_paths[cp].engineering_review_required) needs_engineering = true;
  }

  // --- SUPERVISOR PACKAGE ---
  var sup_actions: string[] = [];
  sup_actions.push("Mobilize NDE team with the following method capabilities: " + unique_methods.join(", "));
  sup_actions.push("Assign priority to " + String(priority_1_zones) + " Priority-1 inspection zones (see zone list)");

  if (critical_count > 0) {
    sup_actions.push("CRITICAL: " + String(critical_count) + " critical-severity damage mechanisms identified — begin inspection within 6 hours");
  }
  if (high_count > 0) {
    sup_actions.push(String(high_count) + " high-severity damage mechanisms — complete NDE within 24 hours");
  }

  // Add specific zone assignments
  for (var z = 0; z < zones.length; z++) {
    if (zones[z].priority === 1) {
      sup_actions.push("INSPECT: " + zones[z].zone_name + " — for " + zones[z].damage_mechanisms.join(", "));
    }
  }
  sup_actions.push("Ensure all NDE technicians have current qualifications for assigned methods");
  sup_actions.push("Establish safe work permits for all inspection activities");
  sup_actions.push("Report all findings to Engineer as they are identified — do not wait for completion");

  var sup_resources: string[] = [];
  for (var um = 0; um < unique_methods.length; um++) {
    sup_resources.push(unique_methods[um] + " equipment and qualified personnel");
  }
  sup_resources.push("Access equipment (scaffolding, rope access, or underwater dive team as needed)");
  sup_resources.push("Surface preparation equipment (grinding, cleaning)");
  sup_resources.push("Documentation supplies (camera, measurement tools, NDE report forms)");

  packages.push({
    role: "Inspection Supervisor / NDE Lead",
    summary: "Deploy NDE team for " + String(mechanisms.length) + " identified damage mechanisms across " + String(zones.length) + " inspection zones on " + (asset.asset_type || asset.asset_class) + ". " + String(critical_count) + " critical and " + String(high_count) + " high-severity mechanisms require immediate attention.",
    action_items: sup_actions,
    timeline: timeline.length > 0 ? timeline[0].tier_name + " (" + timeline[0].time_window + ")" : "As soon as possible",
    key_decisions: [
      "Sequence of zone inspections based on access and safety",
      "Method selection confirmation at each zone based on actual conditions",
      "Escalation to Engineer for any unexpected findings",
      "Stand-down decision if safety concern identified during inspection"
    ],
    resources_needed: sup_resources
  });

  // --- ENGINEER PACKAGE ---
  var eng_actions: string[] = [];
  eng_actions.push("Review all NDE findings as reported from field");
  eng_actions.push("Perform Fitness-for-Service assessments per API 579-1 for all findings requiring engineering evaluation");

  for (var cp = 0; cp < code_paths.length; cp++) {
    eng_actions.push("Anticipated finding: " + code_paths[cp].finding_type + " → assess per " + code_paths[cp].ffs_assessment);
  }

  eng_actions.push("Determine remaining life and set re-inspection intervals");
  eng_actions.push("Develop repair plan per " + (code_paths.length > 0 ? code_paths[0].repair_standard : "applicable repair code"));
  eng_actions.push("Prepare return-to-service documentation");
  if (needs_engineering) {
    eng_actions.push("ENGINEERING REVIEW REQUIRED: Multiple finding types require formal engineering assessment — assemble review team");
  }

  var eng_decisions: string[] = [];
  eng_decisions.push("Accept, repair, re-rate, or replace decision for each finding");
  eng_decisions.push("FFS assessment level (Level 1, 2, or 3) based on finding severity and available data");
  eng_decisions.push("Safe operating limits during repair period (reduced pressure, temperature restrictions)");
  eng_decisions.push("Repair method selection (weld repair, sleeve, composite, replacement)");

  packages.push({
    role: "Mechanical / Integrity Engineer",
    summary: "Engineering assessment required for " + String(code_paths.length) + " anticipated finding types on " + (asset.asset_type || asset.asset_class) + ". FFS assessments per API 579-1 will be needed. " + (needs_engineering ? "FORMAL ENGINEERING REVIEW REQUIRED for multiple items." : ""),
    action_items: eng_actions,
    timeline: timeline.length > 1 ? timeline[1].tier_name + " (" + timeline[1].time_window + ")" : "24-72 hours",
    key_decisions: eng_decisions,
    resources_needed: [
      "API 579-1/ASME FFS-1 (current edition)",
      "Equipment design data (nameplate, datasheet, original construction code)",
      "Material test reports (MTR) for affected equipment",
      "Operating history (temperature, pressure, process conditions)",
      "Previous inspection reports for baseline comparison",
      "FFS calculation software (if Level 2/3 assessment)"
    ]
  });

  // --- EXECUTIVE PACKAGE ---
  var exec_summary = "Incident involving " + (asset.asset_type || asset.asset_class);
  if (parsed.events && parsed.events.length > 0) {
    exec_summary = exec_summary + " following " + parsed.events.join(", ") + " event(s)";
  }
  exec_summary = exec_summary + ". " + String(mechanisms.length) + " damage mechanisms identified (" + String(critical_count) + " critical, " + String(high_count) + " high severity). ";
  exec_summary = exec_summary + String(zones.length) + " inspection zones mapped. ";
  if (critical_count > 0) {
    exec_summary = exec_summary + "IMMEDIATE inspection mobilization required (0-6 hour window). ";
  }
  exec_summary = exec_summary + "Full inspection and engineering assessment program estimated at 72 hours to 7 days.";

  var exec_actions: string[] = [];
  exec_actions.push("Authorize emergency inspection mobilization");
  exec_actions.push("Ensure NDE and engineering resources are available (internal or contract)");
  if (critical_count > 0) {
    exec_actions.push("DECISION NEEDED: Equipment isolation/shutdown decision for critical-severity items");
  }
  exec_actions.push("Regulatory notification if required by jurisdiction");
  exec_actions.push("Insurance carrier notification");
  exec_actions.push("Budget authorization for inspection program and potential repairs");

  packages.push({
    role: "Executive / Plant Manager",
    summary: exec_summary,
    action_items: exec_actions,
    timeline: "0-6 hours: Initial decision on equipment status. 6-24 hours: First NDE results. 24-72 hours: FFS assessments. 72h-7d: Repair/return-to-service.",
    key_decisions: [
      "Equipment shutdown vs. continued operation at reduced conditions",
      "Resource authorization (internal NDE team vs. contractor mobilization)",
      "Regulatory notification timing and content",
      "Production impact assessment and mitigation",
      "Capital expenditure authorization if replacement needed"
    ],
    resources_needed: [
      "Estimated inspection cost: varies by scope (NDE team, access, duration)",
      "Estimated engineering cost: FFS assessments and repair design",
      "Estimated repair cost: depends on findings (to be determined after inspection)",
      "Production impact: potential downtime or de-rate during inspection and repair"
    ]
  });

  return packages;
}


// ============================================================================
// CONFIDENCE SCORING
// ============================================================================

function calculateConfidence(
  mechanisms: DamageMechanism[],
  zones: AffectedZone[],
  methods: InspectionMethod[],
  parsed: ParsedIncident,
  asset: ResolvedAsset
): { mechanism_confidence: number; zone_confidence: number; method_confidence: number; overall_confidence: number } {

  var mechanism_conf = 0.5; // base
  var zone_conf = 0.5;
  var method_conf = 0.5;

  // Mechanism confidence
  if (mechanisms.length > 0) mechanism_conf = 0.7;
  if (mechanisms.length > 2) mechanism_conf = 0.8;
  if (parsed.environment && parsed.environment.length > 0) mechanism_conf += 0.05;
  if (parsed.events && parsed.events.length > 0) mechanism_conf += 0.05;
  if (parsed.numeric_values && parsed.numeric_values.temperature_f !== undefined) mechanism_conf += 0.05;
  if (parsed.numeric_values && parsed.numeric_values.pressure_psi !== undefined) mechanism_conf += 0.05;

  // Zone confidence
  if (zones.length > 0) zone_conf = 0.7;
  if (zones.some(function(z) { return z.asset_specific; })) zone_conf = 0.85;
  if (asset.confidence > 0.8) zone_conf += 0.05;

  // Method confidence
  if (methods.length > 0) method_conf = 0.75;
  if (methods.length > 3) method_conf = 0.85;
  if (mechanisms.length > 0 && zones.length > 0) method_conf += 0.05;

  // Caps
  mechanism_conf = Math.min(mechanism_conf, 0.98);
  zone_conf = Math.min(zone_conf, 0.98);
  method_conf = Math.min(method_conf, 0.98);

  var overall = (mechanism_conf * 0.35) + (zone_conf * 0.30) + (method_conf * 0.35);
  overall = Math.min(overall, 0.98);

  return {
    mechanism_confidence: Math.round(mechanism_conf * 100) / 100,
    zone_confidence: Math.round(zone_conf * 100) / 100,
    method_confidence: Math.round(method_conf * 100) / 100,
    overall_confidence: Math.round(overall * 100) / 100
  };
}


// ============================================================================
// HANDLER — NETLIFY FUNCTION ENTRY POINT
// ============================================================================

var handler = async function(event: any): Promise<any> {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "application/json"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    var body = JSON.parse(event.body || "{}");

    var parsed: ParsedIncident = body.parsed || {
      events: [],
      environment: [],
      numeric_values: {},
      raw_text: body.transcript || body.raw_text || ""
    };

    var asset: ResolvedAsset = body.asset || {
      asset_class: body.asset_class || "pressure_vessel",
      asset_type: body.asset_type || "pressure_vessel",
      confidence: body.asset_confidence || 0.5
    };

    // Ensure raw_text is available
    if (!parsed.raw_text && (body.transcript || body.raw_text)) {
      parsed.raw_text = body.transcript || body.raw_text || "";
    }

    var warnings: string[] = [];

    // Validate inputs
    if (!parsed.events || parsed.events.length === 0) {
      if (!parsed.environment || parsed.environment.length === 0) {
        if (!parsed.raw_text || parsed.raw_text.length < 10) {
          warnings.push("WARNING: No events, environments, or meaningful transcript provided. Results may be incomplete.");
        }
      }
    }

    // RUN ALL 6 ENGINES
    var engine1_start = Date.now();
    var mechanisms = runEngine1(parsed, asset);
    var engine1_time = Date.now() - engine1_start;

    if (mechanisms.length === 0) {
      warnings.push("WARNING: No damage mechanisms identified. Check that events and environment are correctly parsed.");
    }

    var engine2_start = Date.now();
    var zones = runEngine2(mechanisms, asset);
    var engine2_time = Date.now() - engine2_start;

    var engine3_start = Date.now();
    var methods = runEngine3(mechanisms, zones);
    var engine3_time = Date.now() - engine3_start;

    var engine4_start = Date.now();
    var code_paths = runEngine4(mechanisms, asset);
    var engine4_time = Date.now() - engine4_start;

    var engine5_start = Date.now();
    var timeline = runEngine5(mechanisms, parsed);
    var engine5_time = Date.now() - engine5_start;

    var engine6_start = Date.now();
    var exec_packages = runEngine6(mechanisms, zones, methods, code_paths, timeline, parsed, asset);
    var engine6_time = Date.now() - engine6_start;

    var confidence = calculateConfidence(mechanisms, zones, methods, parsed, asset);

    var output: ChainOutput = {
      engine_version: "incident-inspection-chain-v1.0",
      timestamp: new Date().toISOString(),
      input_summary: {
        asset_class: asset.asset_class,
        asset_type: asset.asset_type,
        events: parsed.events || [],
        environment: parsed.environment || [],
        numeric_values: parsed.numeric_values || {}
      },
      engine_1_damage_mechanisms: mechanisms,
      engine_2_affected_zones: zones,
      engine_3_inspection_methods: methods,
      engine_4_code_action_paths: code_paths,
      engine_5_escalation_timeline: timeline,
      engine_6_execution_packages: exec_packages,
      confidence_scores: confidence,
      warnings: warnings
    };

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        success: true,
        chain: output,
        performance: {
          engine_1_ms: engine1_time,
          engine_2_ms: engine2_time,
          engine_3_ms: engine3_time,
          engine_4_ms: engine4_time,
          engine_5_ms: engine5_time,
          engine_6_ms: engine6_time,
          total_ms: engine1_time + engine2_time + engine3_time + engine4_time + engine5_time + engine6_time
        }
      })
    };

  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Incident-to-Inspection Chain error",
        message: err.message || "Unknown error",
        stack: err.stack || ""
      })
    };
  }
};

export { handler };
