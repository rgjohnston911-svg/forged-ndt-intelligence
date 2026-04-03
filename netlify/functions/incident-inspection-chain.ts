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
  ],

  "concrete_damage": [
    {
      id: "CONCRETE_SPALLING",
      name: "Concrete Spalling / Delamination",
      api_571_ref: "ACI 201.2R / AASHTO MBE / FHWA Bridge Inspector's Reference Manual",
      description: "Separation of surface concrete from substrate due to rebar corrosion expansion, freeze-thaw cycling, ASR, or impact. Delamination is subsurface separation detectable by sounding. Spalling is visible loss of concrete section.",
      severity: "high",
      requires_immediate: false,
      susceptible_materials: ["reinforced_concrete", "prestressed_concrete"],
      temp_range_f: null,
      contributing_factors: ["chloride_exposure", "carbonation", "freeze_thaw", "rebar_corrosion", "insufficient_cover", "poor_consolidation"]
    },
    {
      id: "REBAR_CORROSION",
      name: "Reinforcement Corrosion (Chloride or Carbonation-Induced)",
      api_571_ref: "ACI 222R / AASHTO MBE Section 6 / ASTM C876",
      description: "Corrosion of embedded steel reinforcement caused by chloride penetration (de-icing salts, marine environment) or carbonation of cover concrete. Produces expansive rust products causing cracking, delamination, and spalling. Section loss reduces load capacity.",
      severity: "critical",
      requires_immediate: false,
      susceptible_materials: ["carbon_steel_rebar", "prestress_strand", "post_tension_tendon"],
      temp_range_f: null,
      contributing_factors: ["chloride_concentration", "carbonation_depth", "cover_depth", "concrete_permeability", "moisture", "oxygen"]
    },
    {
      id: "CONCRETE_CRACKING_STRUCTURAL",
      name: "Structural Cracking (Shear / Flexural / Torsion)",
      api_571_ref: "AASHTO LRFD / ACI 318 / AASHTO MBE",
      description: "Cracking from structural loading beyond design capacity or fatigue. Shear cracks are diagonal (45-degree) typically near supports. Flexural cracks are vertical at midspan. Width, spacing, and pattern indicate severity and cause.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["reinforced_concrete", "prestressed_concrete"],
      temp_range_f: null,
      contributing_factors: ["overloading", "impact", "settlement", "loss_of_prestress", "reinforcement_corrosion", "design_deficiency"]
    },
    {
      id: "CONCRETE_CRUSHING",
      name: "Concrete Crushing / Compression Failure",
      api_571_ref: "AASHTO LRFD / ACI 318",
      description: "Crushing of concrete in compression zones from overloading or impact. Visible as crushed/fractured concrete with loss of section. In columns indicates imminent collapse risk. In beams indicates flexural compression failure.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["reinforced_concrete"],
      temp_range_f: null,
      contributing_factors: ["impact_force", "overloading", "eccentric_loading", "slenderness", "confinement_loss"]
    },
    {
      id: "ASR",
      name: "Alkali-Silica Reaction (ASR)",
      api_571_ref: "ACI 221.1R / FHWA-HIF-09-004",
      description: "Internal expansive reaction between alkali hydroxides in cement and reactive silica in aggregates. Produces gel that absorbs water and expands, causing map cracking, misalignment, and structural distress. Progressive and irreversible.",
      severity: "high",
      requires_immediate: false,
      susceptible_materials: ["concrete_with_reactive_aggregate"],
      temp_range_f: null,
      contributing_factors: ["reactive_aggregate", "high_alkali_cement", "moisture_availability", "temperature"]
    },
    {
      id: "FREEZE_THAW",
      name: "Freeze-Thaw Damage",
      api_571_ref: "ACI 201.2R / ASTM C666",
      description: "Progressive deterioration from repeated freezing and thawing of water in concrete pores. Causes scaling, D-cracking, and internal microcracking. Accelerated by de-icing chemicals. Non-air-entrained concrete most susceptible.",
      severity: "medium",
      requires_immediate: false,
      susceptible_materials: ["non_air_entrained_concrete"],
      temp_range_f: { min: -20, max: 40 },
      contributing_factors: ["freeze_thaw_cycles", "saturation", "deicing_chemicals", "lack_of_air_entrainment"]
    },
    {
      id: "PRESTRESS_LOSS",
      name: "Prestress Loss / Tendon Failure",
      api_571_ref: "AASHTO LRFD / PTI M55 / FHWA-HRT-13-027",
      description: "Loss of prestress force from tendon corrosion, relaxation, creep, or shrinkage. Tendon failure in post-tensioned bridges is catastrophic — can cause sudden span collapse. Grouting deficiencies leave tendons exposed to corrosion.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["prestress_strand", "post_tension_tendon", "anchorage_hardware"],
      temp_range_f: null,
      contributing_factors: ["grout_voids", "chloride_exposure", "hydrogen_embrittlement", "fretting_fatigue", "anchorage_failure"]
    }
  ],

  "bridge_overload": [
    {
      id: "BRIDGE_IMPACT_DAMAGE",
      name: "Bridge Impact Damage (Vehicle/Vessel/Railcar)",
      api_571_ref: "AASHTO MBE Section 5 / 23 CFR 650.305 / AREMA Ch. 15",
      description: "Direct impact damage to bridge members from vehicle collision, vessel strike, or train derailment. May cause member deformation, cracking, section loss, and load path disruption. Requires immediate assessment of structural stability.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["structural_steel", "reinforced_concrete", "prestressed_concrete"],
      temp_range_f: null,
      contributing_factors: ["impact_energy", "impact_angle", "member_type", "redundancy", "material_ductility"]
    },
    {
      id: "GIRDER_DEFORMATION",
      name: "Steel Girder Deformation / Lateral Distortion",
      api_571_ref: "AASHTO MBE / AWS D1.5 / AISC 360",
      description: "Permanent deformation of steel girders from impact, overloading, or instability. Includes lateral sweep, web buckling, flange local buckling, and overall member buckling. Deformation beyond tolerance requires load restriction or closure.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["structural_steel"],
      temp_range_f: null,
      contributing_factors: ["impact_force", "member_slenderness", "lateral_bracing", "load_eccentricity"]
    },
    {
      id: "BEARING_FAILURE",
      name: "Bearing Failure / Displacement",
      api_571_ref: "AASHTO LRFD Section 14 / AASHTO MBE",
      description: "Bearing damage from impact, overloading, or seismic event. Includes bearing displacement, elastomeric bearing distortion, steel bearing fracture, and loss of bearing function. Bearing failure changes load path and may cause superstructure instability.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["elastomeric_bearing", "steel_bearing", "pot_bearing", "PTFE_bearing"],
      temp_range_f: null,
      contributing_factors: ["impact", "seismic", "thermal_movement_exceeded", "corrosion", "debris_accumulation"]
    },
    {
      id: "LOAD_PATH_DISRUPTION",
      name: "Load Path Disruption",
      api_571_ref: "AASHTO MBE / Structural Engineering Assessment",
      description: "Interruption of the structural load path from member failure, connection failure, or bearing loss. In non-redundant structures (fracture-critical), single member failure can cause collapse. In redundant structures, load redistribution occurs but must be verified.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["all_bridge_materials"],
      temp_range_f: null,
      contributing_factors: ["member_failure", "connection_failure", "bearing_loss", "non_redundancy", "fracture_critical_members"]
    }
  ],

  "bridge_fire": [
    {
      id: "STEEL_STRENGTH_REDUCTION",
      name: "Steel Strength Reduction from Fire Exposure",
      api_571_ref: "AASHTO MBE / AISC Design Guide 19 (Fire) / FHWA Bridge Fire Report",
      description: "Steel loses strength rapidly above 600F. At 1000F, yield strength is approximately 60% of room temperature value. At 1200F, approximately 40%. Permanent strength loss may occur if steel exceeded critical temperature. Requires hardness survey and potential metallographic examination.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["structural_steel", "A36", "A572", "A588", "HPS_steel"],
      temp_range_f: { min: 600, max: 2500 },
      contributing_factors: ["fire_duration", "peak_temperature", "cooling_rate", "applied_load_during_fire", "steel_grade"]
    },
    {
      id: "CONCRETE_FIRE_DAMAGE",
      name: "Concrete Fire Damage",
      api_571_ref: "ACI 216.1 / AASHTO MBE / PCI MNL-124",
      description: "Concrete exposed to fire undergoes color changes (pink >570F, gray >1050F, buff >1650F), strength loss, spalling, and aggregate damage. Reinforcement loses bond. Prestress tendons are extremely sensitive — irreversible relaxation above 400F.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["reinforced_concrete", "prestressed_concrete"],
      temp_range_f: { min: 400, max: 2500 },
      contributing_factors: ["fire_duration", "peak_temperature", "moisture_content", "aggregate_type", "member_thickness", "prestress_level"]
    },
    {
      id: "COATING_FIRE_LOSS",
      name: "Protective Coating Loss from Fire",
      api_571_ref: "SSPC / AASHTO MBE",
      description: "Fire destroys paint and protective coatings on steel members. Exposes bare steel to accelerated corrosion. Also may indicate temperature exposure zone for damage assessment mapping.",
      severity: "high",
      requires_immediate: false,
      susceptible_materials: ["coated_steel"],
      temp_range_f: { min: 400, max: 2500 },
      contributing_factors: ["fire_temperature", "coating_type", "exposure_duration"]
    }
  ],

  "scour": [
    {
      id: "BRIDGE_SCOUR",
      name: "Foundation Scour (General / Contraction / Local)",
      api_571_ref: "FHWA HEC-18 / AASHTO MBE / 23 CFR 650.305",
      description: "Erosion of streambed material around bridge foundations from flowing water. General scour lowers entire bed. Contraction scour from flow acceleration at bridge. Local scour from vortex formation at piers/abutments. Leading cause of bridge failure in the US.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["foundation_soil", "riprap", "piles"],
      temp_range_f: null,
      contributing_factors: ["flow_velocity", "flood_event", "channel_geometry", "pier_shape", "debris_accumulation", "bed_material"]
    }
  ],

  "bridge_fatigue": [
    {
      id: "STEEL_FATIGUE_BRIDGE",
      name: "Fatigue Cracking at Connection Details (AASHTO Categories)",
      api_571_ref: "AASHTO LRFD Section 6.6 / AWS D1.5 / AASHTO MBE",
      description: "Fatigue cracking at welded connection details classified by AASHTO fatigue categories (A through E-prime). Category E and E-prime details (partial penetration welds, cover plate terminations, web gussets) have lowest fatigue resistance. Fracture-critical members require special attention.",
      severity: "high",
      requires_immediate: true,
      susceptible_materials: ["structural_steel_bridge"],
      temp_range_f: null,
      contributing_factors: ["truck_traffic_volume", "stress_range", "detail_category", "weld_quality", "constraint", "fracture_critical_designation"]
    },
    {
      id: "GUSSET_PLATE_FAILURE",
      name: "Gusset Plate Buckling / Failure",
      api_571_ref: "FHWA Guidance on Gusset Plates (post I-35W) / AASHTO MBE",
      description: "Buckling, yielding, or fracture of gusset plates at truss connections. I-35W bridge collapse (2007) was caused by under-designed gusset plates. Corrosion section loss, free-edge buckling, and Whitmore section yielding are primary failure modes.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["structural_steel"],
      temp_range_f: null,
      contributing_factors: ["original_design_adequacy", "section_loss_from_corrosion", "load_increase", "connection_eccentricity", "free_edge_length"]
    }
  ],

  "derailment_event": [
    {
      id: "DERAILMENT_IMPACT",
      name: "Train Derailment Impact on Structure",
      api_571_ref: "AREMA Chapter 15 / 49 CFR 237 / FRA Bridge Safety Standards",
      description: "Impact loading from derailed railcars striking bridge members. Impact energy depends on train speed, car weight (loaded freight cars 286,000 lbs), and impact angle. May cause primary member failure, track misalignment, bearing displacement, and fire from ruptured tank cars.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["structural_steel", "reinforced_concrete", "rail", "timber"],
      temp_range_f: null,
      contributing_factors: ["train_speed", "car_weight", "impact_angle", "number_of_cars_derailed", "hazmat_cargo", "member_hit"]
    },
    {
      id: "TRACK_MISALIGNMENT",
      name: "Track / Rail Misalignment",
      api_571_ref: "AREMA Chapter 5 / 49 CFR 213 (Track Safety Standards)",
      description: "Lateral or vertical displacement of rail from designed alignment. On bridges, track misalignment may indicate structural movement, bearing displacement, or substructure damage. Gauge widening exceeding FRA limits requires speed restriction or closure.",
      severity: "critical",
      requires_immediate: true,
      susceptible_materials: ["rail_steel", "tie_plate", "timber_tie", "concrete_tie"],
      temp_range_f: null,
      contributing_factors: ["impact_force", "substructure_movement", "bearing_displacement", "tie_damage", "fastener_failure"]
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
  "impact": ["impact_event", "bridge_overload"],
  "collision": ["impact_event", "bridge_overload"],
  "overpressure": ["overpressure"],
  "flood": ["flood", "scour"],
  "tsunami": ["flood", "seismic_event"],
  "corrosion": ["corrosion"],
  "erosion": ["corrosion"],
  "fatigue": ["cyclic_service", "bridge_fatigue"],
  "leak": ["corrosion"],
  "crack": ["cyclic_service"],
  "upset": ["overpressure", "high_temperature"],
  "derailment": ["derailment_event", "impact_event", "bridge_overload"],
  "derailed": ["derailment_event", "impact_event", "bridge_overload"],
  "train": ["derailment_event", "bridge_overload"],
  "railcar": ["derailment_event", "bridge_overload"],
  "scour": ["scour"],
  "overload": ["bridge_overload"],
  "deformation": ["impact_event", "bridge_overload"]
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
  "cui": ["corrosion"],
  "bridge": ["concrete_damage", "bridge_overload", "bridge_fatigue"],
  "girder": ["bridge_overload", "bridge_fatigue"],
  "overpass": ["concrete_damage", "bridge_overload"],
  "viaduct": ["concrete_damage", "bridge_overload"],
  "pier": ["concrete_damage"],
  "abutment": ["concrete_damage"],
  "deck": ["concrete_damage"],
  "bearing seat": ["bridge_overload"],
  "bearing": ["bridge_overload"],
  "gusset": ["bridge_fatigue"],
  "truss": ["bridge_fatigue", "bridge_overload"],
  "rail": ["derailment_event"],
  "track": ["derailment_event"],
  "railroad": ["derailment_event"],
  "railway": ["derailment_event"],
  "freight": ["derailment_event", "bridge_overload"],
  "locomotive": ["derailment_event"],
  "railcar": ["derailment_event"],
  "tank car": ["derailment_event", "fire_exposure"],
  "derail": ["derailment_event", "impact_event"],
  "spalling": ["concrete_damage"],
  "delamination": ["concrete_damage"],
  "rebar": ["concrete_damage"],
  "reinforcement": ["concrete_damage"],
  "prestress": ["concrete_damage"],
  "post-tension": ["concrete_damage"],
  "tendon": ["concrete_damage"],
  "scour": ["scour"],
  "flood": ["flood", "scour"],
  "dam": ["concrete_damage", "scour"],
  "concrete": ["concrete_damage"],
  "column": ["concrete_damage"]
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
  },

  "bridge_steel": {
    "BRIDGE_IMPACT_DAMAGE|GIRDER_DEFORMATION|DERAILMENT_IMPACT|MECH_DAMAGE|STRUCTURAL_OVERLOAD": [
      { zone_id: "BS-IMPACT-MEMBER", zone_name: "Impacted Girder/Member — Full Length", priority: 1, rationale: "Direct damage assessment. Measure lateral sweep, web buckling, flange distortion. Check for cracking at stiffener connections." },
      { zone_id: "BS-IMPACT-CONNECTION", zone_name: "Connections at Impacted Member Ends", priority: 1, rationale: "Load path through connections. Bolt shear, weld cracking, plate buckling at connection to pier cap/abutment." },
      { zone_id: "BS-BEARING", zone_name: "Bearings at Impacted Span", priority: 1, rationale: "Bearing displacement or damage changes load path. Check bearing alignment, anchor bolts, sole plate." },
      { zone_id: "BS-ADJACENT-GIRDER", zone_name: "Adjacent Girders and Cross-Frames", priority: 1, rationale: "Load redistribution to adjacent members. Check cross-frames, diaphragms, and lateral bracing for overstress." },
      { zone_id: "BS-SPLICE", zone_name: "Splice Plates and Bolted/Welded Connections in Impact Zone", priority: 1, rationale: "Splices are critical load transfer points. Impact may cause bolt loosening, plate buckling, or weld cracking." },
      { zone_id: "BS-DECK-ABOVE", zone_name: "Deck Above Impacted Girder", priority: 2, rationale: "Deck damage from below — cracking, shear connector damage, composite action loss." },
      { zone_id: "BS-ADJACENT-SPAN", zone_name: "Adjacent Spans (load redistribution check)", priority: 2, rationale: "If impacted span capacity is reduced, adjacent spans may carry redistributed loads." }
    ],
    "FIRE_DAMAGE|METALLURGICAL_CHANGE|STEEL_STRENGTH_REDUCTION|COATING_FIRE_LOSS": [
      { zone_id: "BS-FIRE-WEB", zone_name: "Girder Web in Fire Zone (buckling/distortion check)", priority: 1, rationale: "Thin web plates are most sensitive to fire-induced buckling and distortion. Check for web waviness and permanent set." },
      { zone_id: "BS-FIRE-FLANGE", zone_name: "Bottom Flange in Fire Zone (tension flange)", priority: 1, rationale: "Bottom flange carries tension in positive moment region. Fire damage to tension flange directly reduces flexural capacity." },
      { zone_id: "BS-FIRE-BEARING-STIFF", zone_name: "Bearing Stiffeners and Connection Plates in Fire Zone", priority: 1, rationale: "Stiffeners prevent web buckling. Fire damage to stiffeners reduces shear capacity near supports." },
      { zone_id: "BS-FIRE-LATERAL", zone_name: "Lateral Bracing and Cross-Frames in Fire Zone", priority: 2, rationale: "Lateral bracing prevents lateral-torsional buckling. Fire damage may reduce bracing effectiveness." },
      { zone_id: "BS-FIRE-COATING", zone_name: "Coating Condition in Fire Zone (exposure temperature mapping)", priority: 2, rationale: "Coating damage pattern maps fire exposure zones. Bare steel is accelerated corrosion risk." }
    ],
    "STEEL_FATIGUE_BRIDGE|MECH_FATIGUE|GUSSET_PLATE_FAILURE": [
      { zone_id: "BS-FATIGUE-COVERPLATE", zone_name: "Cover Plate Terminations (Category E/E')", priority: 1, rationale: "Lowest fatigue resistance details. Cracks initiate at weld toe at cover plate end. AASHTO Category E' for partial length." },
      { zone_id: "BS-FATIGUE-WEB-GAP", zone_name: "Web Gap Regions (out-of-plane distortion)", priority: 1, rationale: "Web gap cracking from out-of-plane distortion is most common fatigue problem in steel bridges. Occurs at connection plate terminations." },
      { zone_id: "BS-FATIGUE-FLOOR", zone_name: "Floorbeam-to-Girder Connections", priority: 1, rationale: "High stress range connection detail. Fatigue cracking at cope holes, weld terminations." },
      { zone_id: "BS-FATIGUE-GUSSET", zone_name: "Gusset Plates (corrosion + buckling check)", priority: 1, rationale: "Post I-35W collapse requirement. Check free-edge buckling, section loss, Whitmore section adequacy." },
      { zone_id: "BS-FATIGUE-STRINGER", zone_name: "Stringer-to-Floorbeam Connections", priority: 2, rationale: "Clip angle connections subject to fatigue. Check for cracks at rivet/bolt holes and angle legs." }
    ],
    "MARINE_CORROSION|GENERAL_CORROSION|PITTING": [
      { zone_id: "BS-CORR-BEARING", zone_name: "Steel at Bearings and Bearing Areas", priority: 1, rationale: "Debris and moisture accumulate at bearings. Pack rust between bearing components." },
      { zone_id: "BS-CORR-DRAIN", zone_name: "Areas Below Deck Joints and Drains", priority: 1, rationale: "Leaking deck joints deposit chloride-laden water on steel below. Highest corrosion rate areas." },
      { zone_id: "BS-CORR-FASCIA", zone_name: "Fascia Girder Exterior Face", priority: 2, rationale: "Exposed to road spray. Accelerated corrosion on exterior face." },
      { zone_id: "BS-CORR-BOTTOM", zone_name: "Bottom Flange (trapped moisture)", priority: 2, rationale: "Horizontal surfaces trap moisture and debris. Section loss at tension flange directly reduces capacity." }
    ],
    "BEARING_FAILURE|LOAD_PATH_DISRUPTION": [
      { zone_id: "BS-BEARING-SEAT", zone_name: "Bearing Seat and Masonry Plate", priority: 1, rationale: "Concrete bearing seat condition affects load transfer. Cracked or spalled bearing seats cannot support bearing loads." },
      { zone_id: "BS-BEARING-ANCHOR", zone_name: "Anchor Bolts at Bearings", priority: 1, rationale: "Anchor bolts resist lateral and uplift forces. Corroded or fractured anchor bolts compromise bearing function." },
      { zone_id: "BS-BEARING-DEVICE", zone_name: "Bearing Device (elastomeric/steel/pot)", priority: 1, rationale: "Bearing condition — elastomeric splitting/bulging, steel bearing corrosion/seizure, pot bearing seal failure." }
    ],
    "TRACK_MISALIGNMENT": [
      { zone_id: "BS-TRACK-ALIGN", zone_name: "Track Alignment on Bridge (gauge, profile, cross-level)", priority: 1, rationale: "Track geometry verification per FRA Class standards. Gauge, alignment, profile, cross-level, and warp measurements." },
      { zone_id: "BS-TRACK-FASTENER", zone_name: "Rail Fasteners, Tie Plates, and Guard Rails on Bridge", priority: 1, rationale: "Fastener condition — missing/broken clips, loose tie plates, guard rail damage." },
      { zone_id: "BS-TRACK-APPROACH", zone_name: "Bridge Approach Trackwork (50 feet each end)", priority: 2, rationale: "Approach track settlement or misalignment indicates possible substructure movement." }
    ]
  },

  "bridge_concrete": {
    "CONCRETE_SPALLING|REBAR_CORROSION|FREEZE_THAW|ASR": [
      { zone_id: "BC-DECK-TOP", zone_name: "Deck Top Surface and Wearing Surface", priority: 1, rationale: "Chloride exposure from deicing. Map cracking, spalling, patches, potholes. Chain drag or hammer sounding for delamination survey." },
      { zone_id: "BC-DECK-SOFFIT", zone_name: "Deck Soffit (bottom of deck)", priority: 1, rationale: "Efflorescence, staining, cracking, and spalling visible from below. Indicates water penetration through deck." },
      { zone_id: "BC-PIER-COL", zone_name: "Pier Columns (especially splash zone if over water)", priority: 1, rationale: "Chloride exposure at splash zone. Vertical cracking indicates rebar corrosion. Horizontal cracking indicates overloading." },
      { zone_id: "BC-PIER-CAP", zone_name: "Pier Cap Beam", priority: 1, rationale: "Critical load transfer element. Shear cracks near bearings. Flexural cracks at midspan. Check bearing seats for deterioration." },
      { zone_id: "BC-ABUTMENT", zone_name: "Abutment Faces, Wingwalls, and Backwalls", priority: 2, rationale: "Exposure to moisture and backfill pressure. Check for rotation, settlement, and drainage adequacy." },
      { zone_id: "BC-BARRIER", zone_name: "Barrier Rails and Parapets", priority: 2, rationale: "Impact damage, chloride exposure, delamination. Safety-critical element." },
      { zone_id: "BC-JOINT", zone_name: "Expansion Joints and Joint Headers", priority: 2, rationale: "Joint failure allows water and chlorides to reach substructure. Check for debris, seal damage, and header deterioration." }
    ],
    "CONCRETE_CRACKING_STRUCTURAL|CONCRETE_CRUSHING|BRIDGE_IMPACT_DAMAGE": [
      { zone_id: "BC-IMPACT-ZONE", zone_name: "Impact Zone on Concrete Member", priority: 1, rationale: "Direct assessment of impact damage — spalling, cracking pattern, rebar exposure, section loss." },
      { zone_id: "BC-COLUMN-TOP", zone_name: "Column Top Connection to Cap Beam", priority: 1, rationale: "Shear failure zone. Diagonal cracking from column into cap beam indicates critical shear distress." },
      { zone_id: "BC-COLUMN-BASE", zone_name: "Column Base Connection to Footing", priority: 1, rationale: "Plastic hinge zone under lateral loading. Check for cracking, spalling, and rebar buckling/exposure." },
      { zone_id: "BC-BEAM-ENDS", zone_name: "Beam/Girder Ends at Supports (shear zone)", priority: 1, rationale: "Maximum shear zone. Diagonal cracking indicates shear distress. Check bearing area condition." },
      { zone_id: "BC-MIDSPAN", zone_name: "Midspan Soffit of Beams/Girders (flexural zone)", priority: 2, rationale: "Maximum moment zone. Vertical cracking at midspan indicates flexural distress. Check crack widths." }
    ],
    "CONCRETE_FIRE_DAMAGE|FIRE_DAMAGE|COATING_FIRE_LOSS": [
      { zone_id: "BC-FIRE-SOFFIT", zone_name: "Deck Soffit in Fire Zone (direct flame exposure)", priority: 1, rationale: "Under-deck fires directly expose deck soffit. Color changes map temperature exposure. Spalling exposes reinforcement." },
      { zone_id: "BC-FIRE-COLUMN", zone_name: "Columns/Piers in Fire Zone", priority: 1, rationale: "Fire damage assessment of concrete columns — color change, spalling depth, rebar exposure, rebar temperature assessment." },
      { zone_id: "BC-FIRE-BEAM", zone_name: "Beams/Girders in Fire Zone", priority: 1, rationale: "Concrete beams exposed to fire — check for spalling, cracking, deflection increase, and prestress tendon condition." },
      { zone_id: "BC-FIRE-REBAR", zone_name: "Exposed Reinforcement in Fire Zone", priority: 1, rationale: "Rebar exposed by spalling in fire zone — hardness testing to assess thermal damage. Prestress tendons extremely sensitive." }
    ],
    "PRESTRESS_LOSS": [
      { zone_id: "BC-PT-ANCHOR", zone_name: "Post-Tension Anchorages", priority: 1, rationale: "Anchorage condition — corrosion, grout leakage, staining, cracking around anchorages indicates tendon problems." },
      { zone_id: "BC-PT-MIDSPAN", zone_name: "Midspan Bottom of Prestressed Beams", priority: 1, rationale: "Flexural cracking at midspan of prestressed beams indicates prestress loss. Should be in compression — any cracking is significant." },
      { zone_id: "BC-PT-DUCT", zone_name: "Post-Tension Duct Locations (grout void survey)", priority: 1, rationale: "Grout voids leave tendons unprotected. Impact echo, GPR, or borescope to locate voids." }
    ],
    "BRIDGE_SCOUR": [
      { zone_id: "BC-SCOUR-PIER", zone_name: "Pier Foundations (scour depth measurement)", priority: 1, rationale: "Measure scour depth at each pier. Compare to design scour depth. Foundation exposure reduces capacity." },
      { zone_id: "BC-SCOUR-ABUTMENT", zone_name: "Abutment Foundations", priority: 1, rationale: "Scour at abutments undermines support. Check for exposed footing, settlement, and rotation." },
      { zone_id: "BC-SCOUR-RIPRAP", zone_name: "Scour Countermeasures (riprap, sheet piling)", priority: 2, rationale: "Verify scour countermeasures are intact and functioning." }
    ]
  },

  "rail_bridge": {
    "DERAILMENT_IMPACT|BRIDGE_IMPACT_DAMAGE|GIRDER_DEFORMATION|MECH_DAMAGE": [
      { zone_id: "RB-IMPACT-GIRDER", zone_name: "Impacted Girder — Full Length Inspection", priority: 1, rationale: "Full-length assessment of impacted steel girder for deformation, cracking, section loss, and connection damage." },
      { zone_id: "RB-TRACK-BRIDGE", zone_name: "Track Structure on Bridge (rail, ties, fasteners, guard rail)", priority: 1, rationale: "Complete track inspection on bridge per AREMA/FRA requirements. Rail alignment, gauge, fasteners, tie condition." },
      { zone_id: "RB-BEARING-RB", zone_name: "Bearings (displacement and damage)", priority: 1, rationale: "Bearing assessment — check for displacement, anchor bolt damage, and proper function." },
      { zone_id: "RB-FLOOR-SYSTEM", zone_name: "Floor System (floorbeams, stringers, connections)", priority: 1, rationale: "Floor system carries direct wheel loads. Check floorbeam-to-girder connections for impact damage." },
      { zone_id: "RB-SUBSTRUCTURE", zone_name: "Substructure (piers, abutments, foundations)", priority: 1, rationale: "Check for substructure damage from impact loading transmitted through superstructure." },
      { zone_id: "RB-APPROACH", zone_name: "Approach Spans and Approach Trackwork", priority: 2, rationale: "Adjacent spans may have load redistribution. Approach track settlement indicates possible foundation movement." }
    ],
    "FIRE_DAMAGE|STEEL_STRENGTH_REDUCTION|CONCRETE_FIRE_DAMAGE|COATING_FIRE_LOSS": [
      { zone_id: "RB-FIRE-STEEL", zone_name: "Steel Members in Fire Exposure Zone", priority: 1, rationale: "Hardness survey and visual assessment of all steel in fire zone. Map coating damage extent." },
      { zone_id: "RB-FIRE-CONCRETE", zone_name: "Concrete Members in Fire Zone", priority: 1, rationale: "Concrete color change mapping, spalling assessment, rebar exposure check." },
      { zone_id: "RB-FIRE-TIMBER", zone_name: "Timber Components in Fire Zone (if timber deck/ties)", priority: 1, rationale: "Timber charring depth assessment. Cross-section loss from charring reduces capacity." },
      { zone_id: "RB-FIRE-RAIL", zone_name: "Rail in Fire Zone (heat damage)", priority: 1, rationale: "Rail may have thermal distortion, residual stress, or metallurgical changes from fire exposure." }
    ],
    "TRACK_MISALIGNMENT": [
      { zone_id: "RB-TRACK-GAUGE", zone_name: "Track Gauge Measurement (entire bridge length)", priority: 1, rationale: "FRA gauge limits — exceeding limits requires speed restriction or closure." },
      { zone_id: "RB-TRACK-SURFACE", zone_name: "Track Surface and Cross-Level", priority: 1, rationale: "Surface and cross-level deviations indicate structural movement." },
      { zone_id: "RB-TRACK-JOINT", zone_name: "Rail Joints on Bridge", priority: 2, rationale: "Joint bars and bolts — check for fracture, loose bolts, and battered ends." }
    ],
    "STEEL_FATIGUE_BRIDGE|GUSSET_PLATE_FAILURE": [
      { zone_id: "RB-FATIGUE-CONN", zone_name: "Fatigue-Prone Connection Details (AREMA fatigue categories)", priority: 1, rationale: "Railroad bridges have high cycle fatigue from heavy axle loads. Focus on AREMA-classified details." },
      { zone_id: "RB-FATIGUE-FCM", zone_name: "Fracture-Critical Members (if applicable)", priority: 1, rationale: "Non-redundant members whose failure would cause span collapse. Hands-on inspection with NDE required." }
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
  ],

  "CONCRETE_SPALLING": [
    { method: "VT", technique: "Visual Inspection — Condition State Assessment (AASHTO Element Level)", detection: "Spalling extent, delamination (sounding), efflorescence, staining, cracking pattern", sizing: "Area and depth of spalling, delamination extent", code_ref: "AASHTO MBE / NBIS / 23 CFR 650", rationale: "Element-level visual inspection per AASHTO MBEI. Map all spalling, delamination, and exposed reinforcement. Document condition states (CS1-CS4).", priority: 1, qualification: "NBIS-qualified Bridge Inspector / PE", limitations: "Subjective element. Requires access (snooper, rope access, or scaffolding)." },
    { method: "SOUNDING", technique: "Hammer Sounding / Chain Drag (deck delamination survey)", detection: "Subsurface delamination in concrete decks and soffits", sizing: "Delamination area mapping", code_ref: "ASTM D4580 / AASHTO MBE", rationale: "Chain drag for horizontal surfaces (deck), hammer sounding for vertical/overhead surfaces. Hollow sound indicates delamination. Most cost-effective concrete screening method.", priority: 1, qualification: "Bridge Inspector", limitations: "Cannot determine depth. Only detects delamination, not corrosion rate. Requires direct access." },
    { method: "GPR", technique: "Ground Penetrating Radar (concrete deck condition)", detection: "Rebar location, deck deterioration, chloride-affected zones, delamination", sizing: "Deterioration mapping of entire deck area", code_ref: "ASTM D6087 / AASHTO MBE", rationale: "GPR provides rapid full-coverage assessment of deck condition. Maps deterioration zones and rebar depth. Complement to chain drag for deck assessment.", priority: 2, qualification: "GPR technician with bridge experience", limitations: "Interpretation requires experience. Cannot detect early-stage corrosion. Signal affected by moisture and reinforcement congestion." }
  ],

  "REBAR_CORROSION": [
    { method: "HALFCELL", technique: "Half-Cell Potential Survey (ASTM C876)", detection: "Probability of active rebar corrosion (copper-copper sulfate reference)", sizing: "Corrosion probability map over surface area", code_ref: "ASTM C876 / AASHTO MBE", rationale: "Half-cell potential mapping determines probability of active rebar corrosion. Greater than -350mV (CSE) = >90% probability of active corrosion. Required for corrosion assessment of reinforced concrete.", priority: 1, qualification: "Corrosion technician / Bridge Inspector with training", limitations: "Requires moist concrete. Affected by concrete resistivity. Surface must be connected electrically." },
    { method: "COVERMETER", technique: "Cover Meter / Pachometer (rebar location and cover depth)", detection: "Rebar location, spacing, and concrete cover depth", sizing: "Cover depth measurement at grid points", code_ref: "BS 1881-204 / AASHTO MBE", rationale: "Verify actual cover depth vs. design. Insufficient cover allows faster chloride penetration to rebar. Map rebar locations for other testing.", priority: 1, qualification: "Bridge Inspector / Technician", limitations: "Limited depth range. Affected by congested reinforcement. Cannot detect corrosion directly." },
    { method: "CHLORIDE", technique: "Chloride Profiling (concrete powder samples)", detection: "Chloride concentration at rebar depth", sizing: "Chloride content vs. threshold for corrosion initiation", code_ref: "ASTM C1152 / AASHTO T260 / AASHTO MBE", rationale: "Concrete dust samples at incremental depths to profile chloride penetration. Compare chloride at rebar depth to corrosion threshold (typically 1.0-1.5 lb/yd3). Essential for remaining life prediction.", priority: 1, qualification: "Materials testing technician", limitations: "Destructive sampling. Point measurements. Lab analysis required." },
    { method: "GPR", technique: "Ground Penetrating Radar (corrosion zone mapping)", detection: "Deteriorated zones around corroding rebar", sizing: "Corrosion-affected area", code_ref: "ASTM D6087", rationale: "GPR signal attenuation indicates chloride-contaminated or deteriorated concrete around rebar.", priority: 2, qualification: "GPR technician", limitations: "Indirect method for corrosion. Best as screening tool." }
  ],

  "CONCRETE_CRACKING_STRUCTURAL": [
    { method: "VT", technique: "Crack Mapping — Width, Length, Pattern, and Orientation", detection: "Crack type identification (shear/flexural/torsion/settlement)", sizing: "Crack width (crack comparator), length, spacing", code_ref: "AASHTO MBE / ACI 224R / FHWA Bridge Inspector Reference Manual", rationale: "Crack pattern identifies cause: diagonal at supports = shear, vertical at midspan = flexural, map cracking = ASR/shrinkage. Width indicates severity: >0.013 in = structural concern for reinforced concrete, ANY cracking in prestressed = significant.", priority: 1, qualification: "NBIS-qualified Bridge Inspector / SE", limitations: "Visual only. Cannot determine depth or rebar condition. Must be supplemented by NDE for critical findings." },
    { method: "UT", technique: "UT Crack Depth Measurement (concrete)", detection: "Crack depth in concrete members", sizing: "Through-member crack depth", code_ref: "ASTM C597 / ACI 228.2R", rationale: "Ultrasonic pulse velocity across crack determines crack depth. Critical for shear cracks in pier columns and girder ends.", priority: 1, qualification: "ASNT Level II UT (concrete experience)", limitations: "Surface condition affects coupling. Requires crack access from both sides for transmission method." },
    { method: "IMPACT_ECHO", technique: "Impact Echo (internal flaw detection)", detection: "Internal cracks, voids, delamination, and member thickness", sizing: "Flaw depth and extent", code_ref: "ASTM C1383 / ACI 228.2R", rationale: "Impact echo detects internal defects in concrete including cracks, honeycombing, and voids not visible at surface. Useful for deck and pier assessment.", priority: 2, qualification: "Impact echo technician with concrete experience", limitations: "Member geometry affects results. Requires experienced interpretation." }
  ],

  "CONCRETE_CRUSHING": [
    { method: "VT", technique: "Visual Assessment of Crushing Zone", detection: "Extent of crushing, section loss, rebar exposure and buckling", sizing: "Crushing zone dimensions and depth", code_ref: "AASHTO MBE / Emergency assessment", rationale: "IMMEDIATE visual assessment. Concrete crushing in a column indicates imminent collapse risk. Document extent, check for rebar buckling or fracture.", priority: 1, qualification: "Structural Engineer / Bridge Inspector", limitations: "Safety concern — crushing zone may propagate. Establish exclusion zone." },
    { method: "REBOUND", technique: "Rebound Hammer (Schmidt Hammer) — Adjacent to Damage", detection: "Concrete compressive strength estimate in undamaged areas", sizing: "Relative strength correlation", code_ref: "ASTM C805 / ACI 228.1R", rationale: "Assess concrete quality adjacent to crushing zone. Determines if damage is localized or indicates systemic weakness.", priority: 2, qualification: "Technician", limitations: "Surface test only. Affected by moisture and surface condition. Not reliable for damaged concrete. Estimates only." }
  ],

  "ASR": [
    { method: "VT", technique: "Visual Pattern Assessment (map cracking, gel exudation)", detection: "Map/pattern cracking, gel staining, misalignment, expansion", sizing: "Extent of affected area", code_ref: "FHWA-HIF-09-004 / AASHTO MBE", rationale: "ASR produces characteristic map cracking with white gel deposits. Progressive expansion causes misalignment and joint closure.", priority: 1, qualification: "Bridge Inspector / Materials Engineer", limitations: "Visual alone cannot confirm ASR — must be verified by petrography." },
    { method: "PETROGRAPHY", technique: "Petrographic Analysis (concrete core examination)", detection: "Confirmation of ASR reaction products, gel, reactive aggregate", sizing: "Severity classification", code_ref: "ASTM C856 / FHWA-HIF-09-004", rationale: "Petrographic examination of concrete cores is the definitive method for confirming ASR and assessing severity. Required for positive identification.", priority: 1, qualification: "Petrographer / Materials Engineer", limitations: "Destructive sampling. Lab analysis required. Point samples." }
  ],

  "PRESTRESS_LOSS": [
    { method: "VT", technique: "Visual for Cracking in Prestressed Members (ANY crack is significant)", detection: "Flexural cracking at midspan of prestressed members — indicates prestress loss", sizing: "Crack width and extent", code_ref: "AASHTO MBE / PCI MNL-137", rationale: "Prestressed concrete should have no flexural cracking under service load. ANY cracking in the tension zone of a prestressed member is significant and indicates prestress loss exceeding design expectations.", priority: 1, qualification: "Structural Engineer / Bridge Inspector", limitations: "Cannot quantify prestress loss from visual alone." },
    { method: "IMPACT_ECHO", technique: "Impact Echo / Ultrasonic for Grout Void Detection", detection: "Voids in post-tension ducts where grout is missing", sizing: "Void length and location along tendon path", code_ref: "FHWA-HRT-13-027 / PTI M55", rationale: "Grout voids leave tendons unprotected and at risk of corrosion. Impact echo and UT methods can detect voids through concrete cover.", priority: 1, qualification: "Specialist NDE technician", limitations: "Complex interpretation. Access required along tendon path. Duct material affects results." },
    { method: "GPR", technique: "GPR for Tendon Location and Duct Condition", detection: "Tendon location, duct position, potential voids", sizing: "Mapping of tendon paths", code_ref: "ASTM D6087 / FHWA-HRT-13-027", rationale: "GPR locates post-tension ducts and can indicate void locations by signal characteristics.", priority: 2, qualification: "GPR technician", limitations: "Cannot definitively confirm voids. Supplement with impact echo." }
  ],

  "BRIDGE_IMPACT_DAMAGE": [
    { method: "VT", technique: "Emergency Visual Assessment — Structural Stability", detection: "Overall stability, load path integrity, immediate collapse risk", sizing: "Damage extent and member condition", code_ref: "AASHTO MBE Section 5 / NBIS", rationale: "FIRST ACTION: Determine if structure is stable enough for inspection access. Look for member displacement, connection failure, bearing displacement. Establish exclusion zones.", priority: 1, qualification: "Structural Engineer / NBIS Team Leader", limitations: "Preliminary — must be followed by detailed NDE." },
    { method: "MT", technique: "MPI at Steel Connections in Impact Zone", detection: "Cracking at welded and bolted connections", sizing: "Crack length", code_ref: "AWS D1.5 / AASHTO MBE", rationale: "Impact may crack welds at stiffener connections, splice plates, and gusset plates. WFMT for maximum sensitivity at weld toes.", priority: 1, qualification: "ASNT Level II MT", limitations: "Requires surface cleaning and access." },
    { method: "UT", technique: "UT at Welded Connections in Impact Zone", detection: "Subsurface cracking from impact loading", sizing: "Crack depth for engineering assessment", code_ref: "AWS D1.5 / ASME V Art. 4", rationale: "Volumetric examination of critical welds in the impact zone. Focus on stiffener-to-web welds, flange splices, and connection plates.", priority: 1, qualification: "ASNT Level II UT", limitations: "Complex connection geometry." },
    { method: "DIMENSIONAL", technique: "Dimensional Survey (deformation measurement)", detection: "Permanent deformation — sweep, camber change, twist, web buckling", sizing: "Quantitative deformation measurements vs. tolerances", code_ref: "AASHTO MBE / AISC Code of Standard Practice", rationale: "Precise measurement of girder deformation — lateral sweep (string line), web flatness (straightedge), camber (survey), and cross-frame alignment. Compare to AISC tolerances.", priority: 1, qualification: "Bridge Inspector / Surveyor", limitations: "Requires original geometry data or design drawings for comparison." },
    { method: "HARDNESS", technique: "Hardness Testing at Fire-Exposed Steel", detection: "Steel strength changes from thermal exposure", sizing: "Hardness map in fire zone", code_ref: "AISC Design Guide 19 / ASTM A1038", rationale: "If fire occurred with impact event — hardness mapping of steel in fire zone to assess thermal damage. Significant hardness change indicates metallurgical damage.", priority: 1, qualification: "ASNT Level II / Trained technician", limitations: "Only relevant when fire exposure occurred. Surface measurement." }
  ],

  "GIRDER_DEFORMATION": [
    { method: "DIMENSIONAL", technique: "Detailed Deformation Survey (sweep, camber, section distortion)", detection: "Permanent deformation beyond tolerance", sizing: "Maximum lateral sweep, web out-of-flatness, camber loss/gain", code_ref: "AASHTO MBE / AISC 303 (tolerance standards)", rationale: "PRIMARY assessment method for deformed girder. String line for lateral sweep, straightedge for web flatness, survey for camber. Values exceeding tolerances require engineering assessment or member replacement.", priority: 1, qualification: "Bridge Inspector / Surveyor / SE", limitations: "Requires reference to original geometry." },
    { method: "MT", technique: "MPI at All Connections of Deformed Member", detection: "Cracking from deformation/overload", sizing: "Crack length", code_ref: "AWS D1.5 / AASHTO MBE", rationale: "Deformation induces secondary stresses at connections. Check all welds and bolt groups at ends and intermediate connections of deformed member.", priority: 1, qualification: "ASNT Level II MT", limitations: "Surface method." },
    { method: "UT", technique: "UT Thickness (if section loss suspected at buckled areas)", detection: "Section loss from prior corrosion that may have contributed to buckling", sizing: "Remaining section thickness", code_ref: "AASHTO MBE", rationale: "If web buckling occurs at a location with corrosion, verify remaining section for engineering assessment.", priority: 2, qualification: "ASNT Level II UT", limitations: "Standard measurement." }
  ],

  "STEEL_STRENGTH_REDUCTION": [
    { method: "HARDNESS", technique: "Hardness Survey of Fire-Exposed Steel (REQUIRED)", detection: "Hardness changes indicating strength reduction from fire", sizing: "Hardness map across fire exposure zones", code_ref: "AISC Design Guide 19 / ASTM A1038 / AASHTO MBE", rationale: "REQUIRED for fire damage assessment of steel bridges. Map hardness across fire zone. Compare to expected hardness for steel grade. Significant reduction indicates strength loss. Combined with visual (paint/coating damage as temperature indicators).", priority: 1, qualification: "ASNT Level II / Metallurgist", limitations: "Surface measurement only. Must establish baseline values for comparison." },
    { method: "REPLICA", technique: "Metallographic Replication (if hardness indicates changes)", detection: "Microstructural evidence of thermal damage", sizing: "Qualitative assessment", code_ref: "ASTM E1351 / AISC DG19", rationale: "Confirms metallurgical condition where hardness indicates changes. Identifies grain growth, phase changes.", priority: 1, qualification: "Metallurgist", limitations: "Surface technique. Representative sampling." },
    { method: "DIMENSIONAL", technique: "Deformation Survey in Fire Zone", detection: "Thermal distortion and permanent set from fire exposure", sizing: "Quantitative deformation", code_ref: "AISC DG19 / AASHTO MBE", rationale: "Fire under sustained load causes creep deformation. Measure all members in fire zone for permanent distortion.", priority: 1, qualification: "Surveyor / Inspector", limitations: "Requires reference data." }
  ],

  "CONCRETE_FIRE_DAMAGE": [
    { method: "VT", technique: "Visual Assessment — Color Change Mapping", detection: "Temperature exposure zones from concrete color (pink >570F, gray >1050F, buff >1650F)", sizing: "Fire zone boundary mapping", code_ref: "ACI 216.1 / AASHTO MBE", rationale: "Concrete color changes with temperature exposure — this maps the fire intensity zones. Pink/red indicates 570-660F. Gray indicates 1050-1200F. Buff/white indicates >1650F. Combined with spalling depth.", priority: 1, qualification: "Structural Engineer / Bridge Inspector", limitations: "Color changes may be subtle or masked by soot. Must be cleaned." },
    { method: "REBOUND", technique: "Rebound Hammer at Multiple Depths (after spall removal)", detection: "Concrete strength at different depths from fire-exposed surface", sizing: "Residual strength estimate", code_ref: "ASTM C805 / ACI 228.1R / ACI 216.1", rationale: "Rebound hammer on exposed concrete at different depths (after incremental removal) maps the strength gradient from fire-exposed surface. Determines depth of strength-compromised concrete.", priority: 1, qualification: "Technician", limitations: "Requires surface preparation. Estimate only — calibrate with cores." },
    { method: "CORE", technique: "Concrete Core Testing (compressive strength)", detection: "Actual compressive strength of fire-damaged concrete", sizing: "Quantitative strength value", code_ref: "ASTM C42 / ACI 318 / ACI 216.1", rationale: "Cores from fire-damaged zone and undamaged reference zone. Lab testing for actual compressive strength comparison. Definitive method for fire damage assessment.", priority: 1, qualification: "Materials testing", limitations: "Destructive. Limited number of samples. Lab required." }
  ],

  "BEARING_FAILURE": [
    { method: "VT", technique: "Visual Bearing Inspection — Alignment, Condition, and Function", detection: "Bearing displacement, distortion, fracture, seizure", sizing: "Displacement measurement", code_ref: "AASHTO MBE / AASHTO LRFD Section 14", rationale: "Visual assessment of every bearing at affected span. Check alignment marks (if present), anchor bolt condition, sole plate, masonry plate, and elastomeric pad condition.", priority: 1, qualification: "Bridge Inspector", limitations: "May not detect internal damage in pot bearings. Requires cleaning." },
    { method: "DIMENSIONAL", technique: "Bearing Displacement Measurement", detection: "Bearing offset from design position", sizing: "Quantitative displacement", code_ref: "AASHTO MBE", rationale: "Measure bearing position relative to design. Lateral displacement, longitudinal displacement, and rotation. Compare to bearing movement capacity.", priority: 1, qualification: "Bridge Inspector", limitations: "Requires knowledge of design position." }
  ],

  "BRIDGE_SCOUR": [
    { method: "DIVE_SURVEY", technique: "Underwater Foundation Inspection", detection: "Scour depth, foundation exposure, undermining", sizing: "Scour hole dimensions and depth", code_ref: "FHWA HEC-18 / AASHTO MBE / 23 CFR 650", rationale: "Direct measurement of scour depth at each pier and abutment. Probing to determine foundation exposure. Required after flood events.", priority: 1, qualification: "Certified Underwater Bridge Inspector (FHWA)", limitations: "Water conditions affect access. Probe depth limited." },
    { method: "SONAR", technique: "Sonar / Bathymetric Survey", detection: "Channel cross-section and scour hole geometry", sizing: "Complete scour mapping", code_ref: "FHWA HEC-18", rationale: "Sonar survey maps the complete scour profile around foundations. Identifies scour extent and depth without dive entry.", priority: 1, qualification: "Hydrographic surveyor", limitations: "Equipment cost. Water depth and turbidity." }
  ],

  "STEEL_FATIGUE_BRIDGE": [
    { method: "VT", technique: "Visual Inspection of Fatigue-Prone Details (FCM hands-on)", detection: "Visible fatigue cracking, paint cracking at weld toes", sizing: "Crack length", code_ref: "AASHTO MBE / 23 CFR 650 (FCM requirements)", rationale: "Hands-on visual inspection of all fatigue-prone details per AASHTO. Fracture-critical members require arms-length hands-on inspection. Paint cracks at weld toes often precede structural cracks.", priority: 1, qualification: "NBIS Team Leader / PE (FCM qualified)", limitations: "May not detect tight cracks. Must supplement with NDE for critical details." },
    { method: "MT", technique: "MPI at Fatigue-Critical Weld Details", detection: "Surface-breaking fatigue cracks at weld toes", sizing: "Crack length", code_ref: "AWS D1.5 Chapter 6 / AASHTO MBE", rationale: "MPI of Category C through E' details. Focus on cover plate terminations, web gap regions, cope holes, and gusset plate connections.", priority: 1, qualification: "ASNT Level II MT", limitations: "Surface method only." },
    { method: "UT", technique: "UT at Known Fatigue Crack Locations (sizing)", detection: "Through-thickness crack depth", sizing: "Crack height for fracture mechanics assessment", code_ref: "AWS D1.5 / AASHTO MBE", rationale: "Size detected fatigue cracks for remaining life analysis and repair planning. TOFD or PAUT preferred for accuracy.", priority: 1, qualification: "ASNT Level II UT-PA/TOFD", limitations: "Requires crack detected by other method first." }
  ],

  "GUSSET_PLATE_FAILURE": [
    { method: "VT", technique: "Visual Assessment of Gusset Plates (FHWA guidance)", detection: "Buckling, distortion, corrosion section loss, cracking, bolt/rivet condition", sizing: "Section loss measurement, buckle amplitude", code_ref: "FHWA Guidance on Gusset Plates / AASHTO MBE", rationale: "Post I-35W requirement. Systematic visual assessment of every gusset plate — check for free-edge buckling, pack rust at interfaces, section loss, and connection condition.", priority: 1, qualification: "Bridge Inspector / SE", limitations: "Requires cleaning of debris and rust scale for accurate assessment." },
    { method: "UT", technique: "UT Thickness of Gusset Plates (section loss measurement)", detection: "Remaining plate thickness at corroded areas", sizing: "Minimum remaining section for capacity calculation", code_ref: "AASHTO MBE / FHWA Gusset Plate Guidance", rationale: "Measure remaining section at corroded gusset plates. Used for load rating calculation per FHWA guidance.", priority: 1, qualification: "ASNT Level II UT", limitations: "Surface preparation required. Pitting may affect measurements." }
  ],

  "TRACK_MISALIGNMENT": [
    { method: "SURVEY", technique: "Track Geometry Measurement (gauge, alignment, profile, cross-level, warp)", detection: "Track parameter deviations from FRA Class standards", sizing: "Quantitative deviations vs. FRA limits", code_ref: "49 CFR 213 (FRA Track Safety Standards) / AREMA", rationale: "Complete track geometry survey on bridge and approaches. Compare to FRA operating class limits. Exceeding limits requires speed restriction or closure.", priority: 1, qualification: "Track Inspector / Track Supervisor", limitations: "Manual measurement or track geometry car required." },
    { method: "UT", technique: "Rail Flaw Detection (if rail damage suspected)", detection: "Internal rail defects (transverse deficiency, detail fracture)", sizing: "Flaw characterization", code_ref: "AREMA / 49 CFR 213", rationale: "If rail shows signs of damage from derailment — check for internal defects. Rail UT detection for transverse defects.", priority: 2, qualification: "Rail flaw detection technician", limitations: "Requires specialized rail UT equipment." }
  ],

  "DERAILMENT_IMPACT": [
    { method: "VT", technique: "Comprehensive Post-Derailment Bridge Inspection", detection: "All visible damage to bridge structure from derailment", sizing: "Damage extent mapping", code_ref: "49 CFR 237 / AREMA Ch. 15 / FRA Bridge Safety Standards", rationale: "REQUIRED by FRA — comprehensive inspection after any derailment on a bridge. Every member, connection, bearing, and track component must be inspected. Structure must not be returned to service until inspection is complete.", priority: 1, qualification: "FRA-qualified Bridge Inspector / Railroad Bridge Engineer", limitations: "May require crane/equipment to remove derailed cars before full access." },
    { method: "MT", technique: "MPI at All Steel Connections in Damage Zone", detection: "Cracking from impact loading", sizing: "Crack length", code_ref: "AWS D1.5 / AREMA", rationale: "Impact loading from derailment may crack welded or bolted connections. Comprehensive MPI of all connections in and adjacent to impact zone.", priority: 1, qualification: "ASNT Level II MT", limitations: "Access after derailment debris is cleared." },
    { method: "DIMENSIONAL", technique: "Full Structure Dimensional Survey", detection: "Global and local deformation from impact", sizing: "Quantitative deformation measurements", code_ref: "AREMA / 49 CFR 237", rationale: "Survey of all primary members for deformation — girder sweep, vertical deflection, pier tilt, bearing displacement. Compare to pre-derailment condition or design geometry.", priority: 1, qualification: "Surveyor / Bridge Inspector", limitations: "Pre-event data may not exist. Use design drawings as reference." }
  ],

  "LOAD_PATH_DISRUPTION": [
    { method: "VT", technique: "Load Path Verification — Every Connection in Affected Zone", detection: "Connection failure, member displacement, bearing loss", sizing: "Extent of load path interruption", code_ref: "AASHTO MBE / Structural Engineering", rationale: "Trace the load path from deck to foundation. Verify every connection is intact. Any break in load path requires immediate load restriction or closure.", priority: 1, qualification: "Structural Engineer", limitations: "Requires structural engineering judgment." }
  ],

  "COATING_FIRE_LOSS": [
    { method: "VT", technique: "Coating Condition Survey in Fire Zone", detection: "Coating damage extent — blistering, charring, delamination, complete loss", sizing: "Area of coating damage by severity zone", code_ref: "SSPC-PA 2 / AASHTO MBE", rationale: "Map coating damage to establish fire exposure zones. Total coating loss indicates highest temperature. Blistering indicates moderate exposure. Intact coating indicates below damage threshold. Coating pattern is a temperature exposure map.", priority: 1, qualification: "Coating Inspector / Bridge Inspector", limitations: "Coating damage is not a direct structural assessment — but maps fire zones for steel assessment." }
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
  },

  "bridge_steel": {
    "crack": {
      primary_code: "AASHTO MBE / AWS D1.5",
      code_section: "AASHTO MBE Section 6.6 (Fatigue) + AWS D1.5 Chapter 6 (Inspection) + Chapter 5 (Repair)",
      required_action: "Size crack. Determine fatigue detail category. Perform fracture mechanics assessment for remaining life. Develop repair per AWS D1.5.",
      ffs_standard: "AASHTO MBE Load Rating + BS 7910 or API 579-1 Part 9",
      ffs_part: "Fracture mechanics assessment (fatigue remaining life + fracture toughness check)",
      repair_standard: "AWS D1.5 (Bridge Welding Code) — repair welding procedures",
      documentation: ["Crack location and detail category per AASHTO", "NDE report with crack dimensions", "Fracture mechanics remaining life calculation", "Repair welding procedure per AWS D1.5", "Load rating with crack (reduced section)", "Bridge file update per NBIS"],
      engineering_review: true
    },
    "deformation": {
      primary_code: "AASHTO MBE / AISC 303",
      code_section: "AASHTO MBE Section 5 (Emergency Assessment) + AISC 303 (tolerance standards)",
      required_action: "Dimensional survey. Compare to AISC tolerances. Load rating with deformed geometry. Determine if heat straightening or replacement required.",
      ffs_standard: "AASHTO MBE Load Rating with deformed geometry",
      ffs_part: "Structural adequacy assessment with deformed member properties",
      repair_standard: "AASHTO/AWS D1.5 — Heat straightening per FHWA guidelines",
      documentation: ["Dimensional survey data (sweep, camber, twist, web flatness)", "Comparison to AISC tolerances", "Load rating with deformed member", "Heat straightening plan or replacement plan", "Bridge file update"],
      engineering_review: true
    },
    "fire_damage": {
      primary_code: "AASHTO MBE / AISC Design Guide 19",
      code_section: "AASHTO MBE + AISC DG19 (Fire Design) + FHWA Bridge Fire Guidance",
      required_action: "Hardness survey. Metallographic examination if hardness indicates changes. Dimensional survey. Load rating at post-fire material properties.",
      ffs_standard: "AISC Design Guide 19 / AASHTO MBE Load Rating",
      ffs_part: "Material property assessment + structural adequacy at reduced properties",
      repair_standard: "AWS D1.5 / AISC — repair or replacement depending on damage severity",
      documentation: ["Fire zone mapping (coating damage, color change)", "Hardness survey data vs. baseline/expected values", "Metallographic replication results (if needed)", "Dimensional survey for thermal distortion", "Load rating at post-fire material properties", "Repair/replacement plan"],
      engineering_review: true
    },
    "bearing_damage": {
      primary_code: "AASHTO MBE / AASHTO LRFD Section 14",
      code_section: "AASHTO MBE + AASHTO LRFD Section 14 (Joints and Bearings)",
      required_action: "Assess bearing function. Determine if reset, repair, or replace. Check substructure bearing seats.",
      ffs_standard: "Bearing capacity assessment per AASHTO LRFD",
      ffs_part: "Bearing capacity and function verification",
      repair_standard: "AASHTO LRFD Section 14 — bearing replacement requirements",
      documentation: ["Bearing condition and displacement measurements", "Anchor bolt condition", "Bearing seat condition (concrete)", "Bearing replacement plan if needed"],
      engineering_review: true
    }
  },

  "bridge_concrete": {
    "structural_crack": {
      primary_code: "AASHTO MBE / ACI 318",
      code_section: "AASHTO MBE Section 6 (Load Rating) + ACI 318 (Concrete Design)",
      required_action: "Map crack pattern. Determine type (shear/flexural). Measure widths. Load rating at reduced capacity. Repair per ACI or replace.",
      ffs_standard: "AASHTO MBE Load Rating at reduced section capacity",
      ffs_part: "Load rating with observed damage (Condition Factor per AASHTO MBE)",
      repair_standard: "ACI 562 (Repair of Existing Concrete Structures) / ACI 546R",
      documentation: ["Crack map with widths, lengths, and pattern", "Structural analysis confirming crack type", "Load rating at reduced capacity", "Repair design per ACI 562", "Bridge file update"],
      engineering_review: true
    },
    "spalling_delamination": {
      primary_code: "AASHTO MBE / NBIS",
      code_section: "AASHTO MBE Section 4 (Inspection) + NBIS (23 CFR 650)",
      required_action: "Map all spalling and delamination. Sound all accessible surfaces. Determine rebar condition. Assess remaining section. Repair or rehabilitate.",
      ffs_standard: "AASHTO MBE Load Rating (condition-adjusted)",
      ffs_part: "Condition Factor application per AASHTO MBE Section 6",
      repair_standard: "ACI 562 / ACI 546R / ICRI Technical Guidelines",
      documentation: ["Spalling/delamination map with quantities", "Sounding survey results (chain drag or hammer)", "Rebar condition assessment (corrosion state)", "Half-cell potential data (if taken)", "Chloride profile data (if taken)", "Repair specifications"],
      engineering_review: false
    },
    "fire_damage_concrete": {
      primary_code: "AASHTO MBE / ACI 216.1",
      code_section: "AASHTO MBE + ACI 216.1 (Fire Resistance) + ACI 562 (Repair)",
      required_action: "Color change mapping. Spalling depth assessment. Core testing. Load rating at reduced properties. Repair or replace.",
      ffs_standard: "ACI 216.1 + AASHTO MBE Load Rating",
      ffs_part: "Strength assessment at fire-reduced material properties per ACI 216.1",
      repair_standard: "ACI 562 / ACI 546R / State DOT repair standards",
      documentation: ["Fire zone mapping with color change boundaries", "Spalling depth measurements", "Core compressive strength test results", "Rebound hammer data", "Load rating at post-fire properties", "Repair/replacement plan"],
      engineering_review: true
    },
    "scour": {
      primary_code: "23 CFR 650 / FHWA HEC-18 / AASHTO MBE",
      code_section: "FHWA HEC-18 (Scour) + AASHTO MBE Annex (Scour Assessment) + 23 CFR 650.305",
      required_action: "Measure scour depth. Compare to design scour and critical scour. Install scour countermeasures if needed. Update Scour Plan of Action.",
      ffs_standard: "FHWA HEC-18 Scour Assessment",
      ffs_part: "Foundation adequacy at observed scour depth",
      repair_standard: "FHWA HEC-23 (Scour Countermeasures) — riprap, sheet piling, etc.",
      documentation: ["Scour measurement data (dive report or sonar)", "Comparison to design scour depth", "Foundation stability assessment", "Scour countermeasure design", "Updated Scour Plan of Action"],
      engineering_review: true
    }
  },

  "rail_bridge": {
    "derailment_damage": {
      primary_code: "49 CFR 237 / AREMA Chapter 15",
      code_section: "FRA Bridge Safety Standards (49 CFR 237) + AREMA Manual Chapter 15",
      required_action: "REQUIRED: Complete bridge inspection per 49 CFR 237 before returning to service. Inspect all members, connections, bearings, track structure. Load rating if damage found.",
      ffs_standard: "AREMA Load Rating / FRA Bridge Safety Standards",
      ffs_part: "Load rating at post-damage condition per AREMA",
      repair_standard: "AREMA Chapter 15 / AWS D1.5 (for steel repairs) / Railroad engineering standards",
      documentation: ["FRA post-derailment bridge inspection report", "All NDE reports", "Dimensional survey data", "Track geometry measurements", "Load rating (if damage found)", "Repair plan per AREMA", "FRA notification per 49 CFR 237"],
      engineering_review: true
    },
    "track_damage": {
      primary_code: "49 CFR 213 / AREMA Chapter 5",
      code_section: "FRA Track Safety Standards (49 CFR 213) + AREMA Chapter 5 (Track)",
      required_action: "Complete track geometry survey. Compare to FRA Class limits. Replace damaged rail, ties, and fasteners. Verify track gauge before returning to service.",
      ffs_standard: "FRA Track Safety Standards (49 CFR 213)",
      ffs_part: "Track geometry compliance with operating class",
      repair_standard: "AREMA Chapter 5 / Railroad MOW standards",
      documentation: ["Track geometry measurement data", "FRA class compliance determination", "Rail condition assessment", "Repair/replacement records", "Speed restriction documentation if applicable"],
      engineering_review: true
    },
    "fire_damage_rail_bridge": {
      primary_code: "49 CFR 237 / AREMA / AISC DG19",
      code_section: "FRA Bridge Safety Standards + AREMA Chapter 15 + AISC DG19 for steel assessment",
      required_action: "Fire damage assessment per AISC DG19 for steel, ACI 216.1 for concrete. Load rating at post-fire properties. FRA notification.",
      ffs_standard: "AISC DG19 + ACI 216.1 + AREMA Load Rating",
      ffs_part: "Material property assessment + load rating at reduced capacity",
      repair_standard: "AWS D1.5 / ACI 562 / AREMA Chapter 15",
      documentation: ["Fire zone mapping", "Hardness survey (steel)", "Core testing (concrete)", "Load rating at post-fire properties", "Repair plan", "FRA notification"],
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

    // Bridge-specific mechanism to finding mappings
    if (mech_id === "BRIDGE_IMPACT_DAMAGE" || mech_id === "GIRDER_DEFORMATION" || mech_id === "DERAILMENT_IMPACT") {
      if (asset_class === "bridge_steel" || asset_class === "rail_bridge") {
        if (anticipated_findings.indexOf("deformation") === -1) anticipated_findings.push("deformation");
        if (anticipated_findings.indexOf("crack") === -1) anticipated_findings.push("crack");
      }
      if (asset_class === "bridge_concrete") {
        if (anticipated_findings.indexOf("structural_crack") === -1) anticipated_findings.push("structural_crack");
      }
      if (asset_class === "rail_bridge") {
        if (anticipated_findings.indexOf("derailment_damage") === -1) anticipated_findings.push("derailment_damage");
        if (anticipated_findings.indexOf("track_damage") === -1) anticipated_findings.push("track_damage");
      }
    }

    if (mech_id === "CONCRETE_SPALLING" || mech_id === "REBAR_CORROSION" || mech_id === "FREEZE_THAW" || mech_id === "ASR") {
      if (asset_class === "bridge_concrete" || asset_class === "rail_bridge") {
        if (anticipated_findings.indexOf("spalling_delamination") === -1) anticipated_findings.push("spalling_delamination");
      }
    }

    if (mech_id === "CONCRETE_CRACKING_STRUCTURAL" || mech_id === "CONCRETE_CRUSHING") {
      if (asset_class === "bridge_concrete" || asset_class === "rail_bridge") {
        if (anticipated_findings.indexOf("structural_crack") === -1) anticipated_findings.push("structural_crack");
      }
    }

    if (mech_id === "STEEL_STRENGTH_REDUCTION" || mech_id === "COATING_FIRE_LOSS") {
      if (asset_class === "bridge_steel" || asset_class === "rail_bridge") {
        if (anticipated_findings.indexOf("fire_damage") === -1) anticipated_findings.push("fire_damage");
      }
    }

    if (mech_id === "CONCRETE_FIRE_DAMAGE") {
      if (asset_class === "bridge_concrete" || asset_class === "rail_bridge") {
        if (anticipated_findings.indexOf("fire_damage_concrete") === -1) anticipated_findings.push("fire_damage_concrete");
      }
    }

    if (mech_id === "BEARING_FAILURE" || mech_id === "LOAD_PATH_DISRUPTION") {
      if (asset_class === "bridge_steel" || asset_class === "bridge_concrete" || asset_class === "rail_bridge") {
        if (anticipated_findings.indexOf("bearing_damage") === -1) anticipated_findings.push("bearing_damage");
      }
    }

    if (mech_id === "BRIDGE_SCOUR") {
      if (asset_class === "bridge_concrete" || asset_class === "bridge_steel" || asset_class === "rail_bridge") {
        if (anticipated_findings.indexOf("scour") === -1) anticipated_findings.push("scour");
      }
    }

    if (mech_id === "TRACK_MISALIGNMENT") {
      if (asset_class === "rail_bridge") {
        if (anticipated_findings.indexOf("track_damage") === -1) anticipated_findings.push("track_damage");
      }
    }

    if (mech_id === "STEEL_FATIGUE_BRIDGE" || mech_id === "GUSSET_PLATE_FAILURE") {
      if (asset_class === "bridge_steel" || asset_class === "rail_bridge") {
        if (anticipated_findings.indexOf("crack") === -1) anticipated_findings.push("crack");
      }
    }

    if (mech_id === "PRESTRESS_LOSS") {
      if (asset_class === "bridge_concrete") {
        if (anticipated_findings.indexOf("structural_crack") === -1) anticipated_findings.push("structural_crack");
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
// ENGINE 7: GO / NO-GO / RESTRICTED DECISION ENGINE
// Deterministic structural disposition based on mechanisms, severity, and findings
// ============================================================================

interface DispositionDecision {
  decision: "NO_GO" | "RESTRICTED" | "GO_WITH_MONITORING" | "GO";
  decision_label: string;
  rationale: string[];
  conditions: string[];
  required_before_upgrade: string[];
  authority_required: string;
}

function runEngine7(
  mechanisms: DamageMechanism[],
  zones: AffectedZone[],
  parsed: ParsedIncident,
  asset: ResolvedAsset
): DispositionDecision {

  var no_go_triggers: string[] = [];
  var restricted_triggers: string[] = [];
  var monitoring_triggers: string[] = [];

  for (var m = 0; m < mechanisms.length; m++) {
    var mech = mechanisms[m];
    var id = mech.id;

    // ---- ABSOLUTE NO-GO TRIGGERS ----

    // Structural collapse risk
    if (id === "LOAD_PATH_DISRUPTION") {
      no_go_triggers.push("Load path disruption detected — structure may not support design loads");
    }
    if (id === "CONCRETE_CRUSHING") {
      no_go_triggers.push("Concrete crushing in primary member — imminent structural failure risk");
    }
    if (id === "GUSSET_PLATE_FAILURE") {
      no_go_triggers.push("Gusset plate failure suspected — connection integrity compromised (ref: I-35W collapse)");
    }

    // Deformation beyond tolerance
    if (id === "GIRDER_DEFORMATION") {
      no_go_triggers.push("Primary girder deformation reported — load capacity unknown until dimensional survey and engineering assessment completed");
    }
    if (id === "STRUCTURAL_OVERLOAD" && (asset.asset_class === "bridge_steel" || asset.asset_class === "bridge_concrete" || asset.asset_class === "rail_bridge")) {
      no_go_triggers.push("Structural overload on bridge — engineering assessment required before any loading");
    }

    // Active cracking in primary members
    if (id === "CONCRETE_CRACKING_STRUCTURAL") {
      no_go_triggers.push("Structural cracking (shear/flexural) in primary concrete member — load rating required before opening");
    }

    // Derailment on bridge
    if (id === "DERAILMENT_IMPACT") {
      no_go_triggers.push("Train derailment on bridge — 49 CFR 237 requires complete inspection before return to service");
    }
    if (id === "TRACK_MISALIGNMENT") {
      no_go_triggers.push("Track misalignment on bridge — no train traffic until track geometry verified per FRA Class standards");
    }

    // Scour critical
    if (id === "BRIDGE_SCOUR") {
      no_go_triggers.push("Foundation scour detected — bridge must be closed until foundation adequacy is verified");
    }

    // Bearing failure
    if (id === "BEARING_FAILURE") {
      no_go_triggers.push("Bearing failure or displacement — superstructure support compromised");
    }

    // HTHA confirmed
    if (id === "HTHA") {
      no_go_triggers.push("High Temperature Hydrogen Attack suspected — equipment must not operate until AUBT assessment confirms condition");
    }

    // Prestress tendon failure
    if (id === "PRESTRESS_LOSS") {
      no_go_triggers.push("Prestress loss / tendon failure suspected — load capacity may be critically reduced");
    }

    // ---- RESTRICTED OPERATION TRIGGERS ----

    if (id === "BRIDGE_IMPACT_DAMAGE" && no_go_triggers.length === 0) {
      restricted_triggers.push("Impact damage reported — restrict to reduced loading until inspection complete");
    }
    if (id === "FIRE_DAMAGE" || id === "STEEL_STRENGTH_REDUCTION" || id === "CONCRETE_FIRE_DAMAGE") {
      if (no_go_triggers.length === 0) {
        restricted_triggers.push("Fire damage — restrict loading until material assessment (hardness/core testing) confirms residual capacity");
      }
    }
    if (id === "MECH_DAMAGE" && (asset.asset_class === "bridge_steel" || asset.asset_class === "structural_steel")) {
      if (no_go_triggers.length === 0) {
        restricted_triggers.push("Mechanical damage to structural member — restrict loading pending engineering assessment");
      }
    }
    if (id === "STEEL_FATIGUE_BRIDGE") {
      restricted_triggers.push("Fatigue cracking at connection details — restrict to reduced loading until crack sizing and remaining life assessment");
    }
    if (id === "OVERPRESSURE_DAMAGE") {
      restricted_triggers.push("Overpressure event — operate at reduced pressure until FFS assessment per API 579-1 Part 8");
    }
    if ((id === "SSC" || id === "SOHIC" || id === "HIC") && mech.severity === "critical") {
      restricted_triggers.push(mech.name + " — restrict to reduced conditions until NDE assessment confirms extent");
    }
    if (id === "CREEP" && mech.severity === "critical") {
      restricted_triggers.push("Creep damage suspected — restrict temperature/pressure pending replication and remaining life assessment");
    }

    // ---- MONITORING TRIGGERS ----

    if (id === "GENERAL_CORROSION" || id === "PITTING" || id === "CUI" || id === "MARINE_CORROSION") {
      monitoring_triggers.push(mech.name + " — continue operation with monitoring per API inspection code intervals");
    }
    if (id === "REBAR_CORROSION" && mech.severity !== "critical") {
      monitoring_triggers.push("Rebar corrosion — monitor with periodic inspection, plan rehabilitation");
    }
    if (id === "CONCRETE_SPALLING" && mech.severity !== "critical") {
      monitoring_triggers.push("Concrete spalling — monitor progression, schedule repair");
    }
    if (id === "ASR") {
      monitoring_triggers.push("ASR detected — monitor expansion rate, adjust load rating if needed");
    }
    if (id === "COATING_FIRE_LOSS") {
      monitoring_triggers.push("Coating loss — schedule coating repair to prevent accelerated corrosion");
    }
  }

  // ---- DETERMINE DECISION ----

  if (no_go_triggers.length > 0) {
    var authority = "Structural Engineer (PE/SE)";
    if (asset.asset_class === "rail_bridge") {
      authority = "Railroad Bridge Engineer per 49 CFR 237 + FRA notification required";
    } else if (asset.asset_class === "bridge_steel" || asset.asset_class === "bridge_concrete") {
      authority = "Bridge Engineer (PE/SE) + Bridge Owner notification per NBIS";
    } else if (asset.asset_class === "pressure_vessel") {
      authority = "API Authorized Inspector + Mechanical Engineer";
    } else if (asset.asset_class === "process_piping") {
      authority = "API Authorized Inspector + Piping Engineer";
    }

    return {
      decision: "NO_GO",
      decision_label: "NO-GO — CLOSED / SHUT DOWN until engineering assessment complete",
      rationale: no_go_triggers,
      conditions: [
        "No traffic, loading, or operation permitted",
        "Establish physical barriers and/or exclusion zones",
        "Post signage and notifications per applicable regulations",
        "Emergency responder access only under engineering supervision"
      ],
      required_before_upgrade: [
        "Complete NDE inspection of all priority zones",
        "Engineering assessment (load rating, FFS, or structural analysis)",
        "Repair of critical deficiencies per applicable code",
        "Post-repair verification NDE",
        "Written return-to-service authorization from Engineer of Record"
      ],
      authority_required: authority
    };
  }

  if (restricted_triggers.length > 0) {
    var rest_authority = "Engineer (PE)";
    if (asset.asset_class === "rail_bridge") {
      rest_authority = "Railroad Bridge Engineer — speed restriction per AREMA/FRA";
    } else if (asset.asset_class === "bridge_steel" || asset.asset_class === "bridge_concrete") {
      rest_authority = "Bridge Engineer — load posting per AASHTO MBE";
    } else if (asset.asset_class === "pressure_vessel" || asset.asset_class === "process_piping") {
      rest_authority = "Mechanical Engineer + API Inspector — de-rate per API 510/570";
    }

    return {
      decision: "RESTRICTED",
      decision_label: "RESTRICTED — Reduced loading / reduced operating conditions until assessment complete",
      rationale: restricted_triggers,
      conditions: [
        "Reduced loading, speed restriction, or de-rated operating conditions",
        "Increased monitoring frequency",
        "Engineering assessment in progress — complete within specified timeline",
        "Restrictions remain until engineer authorizes upgrade"
      ],
      required_before_upgrade: [
        "Complete NDE inspection per method selection",
        "Engineering assessment confirms adequate capacity at desired load level",
        "Any required repairs completed and verified",
        "Written authorization to remove restrictions"
      ],
      authority_required: rest_authority
    };
  }

  if (monitoring_triggers.length > 0) {
    return {
      decision: "GO_WITH_MONITORING",
      decision_label: "GO WITH MONITORING — Continue operation with enhanced inspection program",
      rationale: monitoring_triggers,
      conditions: [
        "Normal operation permitted",
        "Enhanced monitoring per inspection plan",
        "Report any changes in condition immediately",
        "Next scheduled inspection per applicable code"
      ],
      required_before_upgrade: [
        "Complete current inspection program",
        "Establish baseline measurements for monitoring",
        "Set re-inspection intervals per applicable code"
      ],
      authority_required: "Inspector per applicable code (API 510/570/653, NBIS, AREMA)"
    };
  }

  return {
    decision: "GO",
    decision_label: "GO — No immediate structural concern from identified mechanisms",
    rationale: ["No critical or high-severity mechanisms requiring immediate action were identified"],
    conditions: ["Normal operation", "Continue routine inspection program"],
    required_before_upgrade: [],
    authority_required: "Inspector per routine program"
  };
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

    var engine7_start = Date.now();
    var disposition = runEngine7(mechanisms, zones, parsed, asset);
    var engine7_time = Date.now() - engine7_start;

    var confidence = calculateConfidence(mechanisms, zones, methods, parsed, asset);

    var output = {
      engine_version: "incident-inspection-chain-v2.0-bridge",
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
      engine_7_disposition: disposition,
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
          engine_7_ms: engine7_time,
          total_ms: engine1_time + engine2_time + engine3_time + engine4_time + engine5_time + engine6_time + engine7_time
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
