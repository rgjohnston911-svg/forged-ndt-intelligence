// @ts-nocheck
/**
 * DEPLOY283 - subsea-domain-registry.ts
 * netlify/functions/subsea-domain-registry.ts
 *
 * SUBSEA DOMAIN REGISTRY + ZONE SEVERITY ENGINE
 *
 * The routing brain for all subsea intelligence. Classifies assets,
 * determines zones, applies severity multipliers, and routes cases
 * to the correct sub-engines.
 *
 * Klein Bottle: zones are not boundaries — splash zone is where
 * atmospheric, marine, and mechanical factors converge on one surface.
 *
 * POST /api/subsea-domain-registry
 *
 * Actions:
 *   classify_asset         — identify asset class, geometry, load role
 *   evaluate_zone          — determine zone and severity multipliers
 *   get_inspection_constraints — zone-specific inspection limitations
 *   get_failure_locations   — typical failure locations for asset class
 *   route_engines           — determine which engines to fire for this asset
 *   get_asset_registry      — full asset class database
 *   get_zone_registry       — full zone database
 *   get_registry            — engine metadata
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var ENGINE_ID = "subsea-domain-registry";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY283";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

// ============================================================
// SUBSEA ASSET CLASS REGISTRY
// ============================================================

var ASSET_CLASSES = {
  // PRIMARY STRUCTURE
  jacket: {
    category: "primary_structure",
    name: "Jacket Structure",
    geometry: "tubular_frame",
    load_role: "primary_load_bearing",
    consequence_class: "catastrophic",
    typical_materials: ["structural_steel_S355", "API_2H_grade_50", "API_2W_grade_50"],
    typical_failure_locations: [
      { location: "node_connections", mechanism: ["fatigue", "corrosion_fatigue"], severity: "critical" },
      { location: "splash_zone_members", mechanism: ["corrosion", "coating_failure", "CP_shielding"], severity: "critical" },
      { location: "mudline_connections", mechanism: ["scour", "crevice_corrosion", "MIC"], severity: "high" },
      { location: "conductor_guides", mechanism: ["fretting", "wear", "fatigue"], severity: "moderate" },
      { location: "launch_runners", mechanism: ["corrosion", "marine_growth"], severity: "low" }
    ],
    inspection_constraints: {
      atmospheric: { access: "scaffold_or_rope", visibility: "good", methods: ["visual", "MPI", "UT"] },
      splash: { access: "difficult_sea_state_dependent", visibility: "variable", methods: ["visual", "UT", "MPI"] },
      submerged: { access: "diver_or_ROV", visibility: "variable_marine_growth", methods: ["visual", "CP_survey", "UT", "FMD"] },
      mudline: { access: "diver_limited_visibility", visibility: "poor", methods: ["visual", "UT", "CP_survey"] }
    },
    design_life_years: 25,
    codes: ["API_RP_2A", "ISO_19902", "NORSOK_N004"]
  },
  jacket_node: {
    category: "primary_structure",
    name: "Jacket Node / Tubular Joint",
    geometry: "tubular_intersection",
    load_role: "primary_load_path",
    consequence_class: "catastrophic",
    typical_materials: ["structural_steel_S355", "cast_steel_nodes"],
    typical_failure_locations: [
      { location: "weld_toe_hot_spots", mechanism: ["fatigue", "corrosion_fatigue"], severity: "critical" },
      { location: "brace_chord_intersection", mechanism: ["fatigue"], severity: "critical" },
      { location: "can_to_cone_transition", mechanism: ["fatigue", "SCC"], severity: "high" }
    ],
    inspection_constraints: {
      submerged: { access: "diver_cleaning_required", visibility: "requires_marine_growth_removal", methods: ["MPI_underwater", "UT", "ACFM", "FMD"] }
    },
    design_life_years: 25,
    codes: ["API_RP_2A", "BS_7910", "DNV_RP_C203"]
  },
  pile: {
    category: "primary_structure",
    name: "Foundation Pile",
    geometry: "tubular",
    load_role: "foundation",
    consequence_class: "catastrophic",
    typical_materials: ["API_5L_X52", "API_5L_X60"],
    typical_failure_locations: [
      { location: "pile_jacket_connection", mechanism: ["fatigue", "corrosion"], severity: "critical" },
      { location: "mudline_transition", mechanism: ["corrosion", "scour", "MIC"], severity: "high" },
      { location: "below_mudline", mechanism: ["corrosion_limited_by_oxygen", "MIC"], severity: "moderate" }
    ],
    inspection_constraints: {
      mudline: { access: "diver_excavation_required", visibility: "very_poor", methods: ["UT", "CP_survey"] },
      buried: { access: "not_inspectable_without_excavation", visibility: "none", methods: ["CP_survey_indirect"] }
    },
    design_life_years: 30,
    codes: ["API_RP_2A", "ISO_19902"]
  },
  // FLOW ASSETS
  pipeline: {
    category: "flow_asset",
    name: "Subsea Pipeline",
    geometry: "tubular",
    load_role: "containment",
    consequence_class: "major_to_catastrophic",
    typical_materials: ["API_5L_X60", "API_5L_X65", "API_5L_X70", "duplex_stainless", "CRA_clad"],
    typical_failure_locations: [
      { location: "field_joints", mechanism: ["corrosion", "coating_failure", "CP_shielding"], severity: "critical" },
      { location: "free_spans", mechanism: ["fatigue", "VIV"], severity: "critical" },
      { location: "buckle_arrestor_locations", mechanism: ["stress_concentration", "corrosion"], severity: "high" },
      { location: "riser_base_transition", mechanism: ["fatigue", "corrosion"], severity: "critical" },
      { location: "crossing_points", mechanism: ["abrasion", "point_load"], severity: "moderate" },
      { location: "internal_6_oclock", mechanism: ["internal_corrosion", "erosion", "MIC"], severity: "high" }
    ],
    inspection_constraints: {
      submerged: { access: "ROV", visibility: "good_unless_buried", methods: ["visual", "CP_survey", "FFL_survey"] },
      buried: { access: "survey_only", visibility: "none", methods: ["CP_survey", "ILI_if_piggable"] }
    },
    design_life_years: 25,
    codes: ["DNV_ST_F101", "API_5L", "ASME_B31_8"]
  },
  riser_rigid: {
    category: "flow_asset",
    name: "Rigid Riser",
    geometry: "tubular",
    load_role: "containment_plus_structural",
    consequence_class: "catastrophic",
    typical_materials: ["API_5L_X60", "API_5L_X65", "super_duplex"],
    typical_failure_locations: [
      { location: "splash_zone", mechanism: ["corrosion", "coating_failure", "fatigue"], severity: "critical" },
      { location: "hang_off_clamp", mechanism: ["fretting", "fatigue", "crevice"], severity: "critical" },
      { location: "riser_guide_clamps", mechanism: ["wear", "crevice_corrosion"], severity: "high" },
      { location: "J_tube_entry", mechanism: ["abrasion", "corrosion"], severity: "high" }
    ],
    inspection_constraints: {
      splash: { access: "rope_access_sea_state_dependent", visibility: "variable", methods: ["visual", "UT", "MPI"] },
      submerged: { access: "diver_or_ROV", visibility: "marine_growth_obstruction", methods: ["visual", "CP_survey", "UT"] }
    },
    design_life_years: 25,
    codes: ["API_RP_2RD", "DNV_ST_F201"]
  },
  riser_flexible: {
    category: "flow_asset",
    name: "Flexible Riser",
    geometry: "multi_layer_composite",
    load_role: "containment_plus_structural",
    consequence_class: "catastrophic",
    typical_materials: ["multi_layer_polymer_steel"],
    typical_failure_locations: [
      { location: "end_fitting", mechanism: ["fatigue", "corrosion", "seal_failure"], severity: "critical" },
      { location: "touch_down_point", mechanism: ["fatigue", "abrasion", "overbending"], severity: "critical" },
      { location: "bend_stiffener_base", mechanism: ["fatigue", "overbending"], severity: "critical" },
      { location: "outer_sheath", mechanism: ["mechanical_damage", "ageing", "annulus_flooding"], severity: "high" }
    ],
    inspection_constraints: {
      submerged: { access: "ROV", visibility: "outer_sheath_only", methods: ["visual", "annulus_monitoring", "curvature_monitoring"] }
    },
    design_life_years: 20,
    codes: ["API_17J", "API_17B"]
  },
  manifold: {
    category: "flow_asset",
    name: "Subsea Manifold",
    geometry: "complex_assembly",
    load_role: "containment_plus_flow_control",
    consequence_class: "major",
    typical_materials: ["forged_steel", "duplex_stainless", "super_duplex"],
    typical_failure_locations: [
      { location: "hub_connections", mechanism: ["fatigue", "corrosion", "seal_degradation"], severity: "critical" },
      { location: "valve_bodies", mechanism: ["erosion", "internal_corrosion"], severity: "high" },
      { location: "structural_frame", mechanism: ["corrosion", "marine_growth_loading"], severity: "moderate" }
    ],
    inspection_constraints: {
      submerged: { access: "ROV", visibility: "complex_geometry_limited", methods: ["visual", "CP_survey", "leak_detection"] }
    },
    design_life_years: 25,
    codes: ["API_17D", "API_6A"]
  },
  jumper_spool: {
    category: "flow_asset",
    name: "Jumper / Spool Piece",
    geometry: "tubular_with_bends",
    load_role: "containment",
    consequence_class: "major",
    typical_materials: ["duplex_stainless", "super_duplex", "CRA_clad"],
    typical_failure_locations: [
      { location: "bend_intrados", mechanism: ["erosion_corrosion", "fatigue"], severity: "high" },
      { location: "hub_connections", mechanism: ["fatigue", "seal_degradation"], severity: "critical" },
      { location: "VIV_susceptible_spans", mechanism: ["fatigue", "VIV"], severity: "high" }
    ],
    inspection_constraints: {
      submerged: { access: "ROV", visibility: "good", methods: ["visual", "CP_survey"] }
    },
    design_life_years: 25,
    codes: ["DNV_ST_F101", "API_17D"]
  },
  // SUPPORT / INTERFACE
  clamp: {
    category: "support_interface",
    name: "Structural Clamp / Repair Clamp",
    geometry: "curved_plate",
    load_role: "secondary_structural",
    consequence_class: "moderate",
    typical_materials: ["structural_steel", "duplex_stainless"],
    typical_failure_locations: [
      { location: "clamp_member_interface", mechanism: ["crevice_corrosion", "fretting"], severity: "high" },
      { location: "bolt_connections", mechanism: ["corrosion", "loosening", "hydrogen_embrittlement"], severity: "high" },
      { location: "grout_annulus", mechanism: ["grout_degradation", "water_ingress"], severity: "moderate" }
    ],
    inspection_constraints: {
      submerged: { access: "diver_or_ROV", visibility: "requires_cleaning", methods: ["visual", "UT"] }
    },
    design_life_years: 15,
    codes: ["DNV_RP_C203", "proprietary"]
  },
  anode_system: {
    category: "support_interface",
    name: "Sacrificial Anode System",
    geometry: "bracelet_or_standoff",
    load_role: "cathodic_protection",
    consequence_class: "moderate",
    typical_materials: ["aluminum_alloy_anode", "zinc_alloy_anode"],
    typical_failure_locations: [
      { location: "anode_connection", mechanism: ["corrosion_of_connection", "mechanical_failure"], severity: "high" },
      { location: "anode_body", mechanism: ["normal_consumption", "passivation"], severity: "moderate" }
    ],
    inspection_constraints: {
      submerged: { access: "diver_or_ROV", visibility: "marine_growth_masking", methods: ["visual", "CP_survey", "anode_measurement"] }
    },
    design_life_years: 25,
    codes: ["DNV_RP_B401", "NACE_SP0176"]
  },
  protection_frame: {
    category: "support_interface",
    name: "Protection Frame / Guard Structure",
    geometry: "tubular_frame",
    load_role: "impact_protection",
    consequence_class: "minor_to_moderate",
    typical_materials: ["structural_steel"],
    typical_failure_locations: [
      { location: "impact_zone", mechanism: ["mechanical_damage", "coating_loss"], severity: "moderate" },
      { location: "base_connections", mechanism: ["fatigue", "corrosion"], severity: "moderate" }
    ],
    inspection_constraints: {
      submerged: { access: "ROV", visibility: "good", methods: ["visual"] }
    },
    design_life_years: 25,
    codes: ["API_RP_2A"]
  },
  // SPECIAL SYSTEMS
  mooring: {
    category: "special_system",
    name: "Mooring System",
    geometry: "chain_wire_synthetic",
    load_role: "station_keeping",
    consequence_class: "catastrophic",
    typical_materials: ["R4_chain", "spiral_strand_wire", "polyester_rope"],
    typical_failure_locations: [
      { location: "fairlead", mechanism: ["wear", "fatigue", "corrosion"], severity: "critical" },
      { location: "chain_hawse", mechanism: ["wear", "corrosion"], severity: "critical" },
      { location: "splash_zone_chain", mechanism: ["corrosion", "fatigue", "OPB"], severity: "critical" },
      { location: "seabed_touchdown", mechanism: ["abrasion", "corrosion", "MIC"], severity: "high" },
      { location: "connectors", mechanism: ["fatigue", "corrosion", "wear"], severity: "critical" }
    ],
    inspection_constraints: {
      splash: { access: "difficult", visibility: "variable", methods: ["visual", "chain_measurement"] },
      submerged: { access: "ROV", visibility: "marine_growth", methods: ["visual", "chain_diameter_measurement"] }
    },
    design_life_years: 20,
    codes: ["API_RP_2SK", "DNV_OS_E301"]
  },
  suction_pile: {
    category: "special_system",
    name: "Suction Pile / Caisson",
    geometry: "large_diameter_tubular",
    load_role: "foundation",
    consequence_class: "catastrophic",
    typical_materials: ["structural_steel_S355"],
    typical_failure_locations: [
      { location: "pad_eye_connection", mechanism: ["fatigue", "corrosion"], severity: "critical" },
      { location: "top_plate_welds", mechanism: ["fatigue"], severity: "high" },
      { location: "mudline_transition", mechanism: ["scour", "corrosion"], severity: "high" }
    ],
    inspection_constraints: {
      submerged: { access: "ROV", visibility: "sediment", methods: ["visual", "CP_survey"] },
      buried: { access: "none", visibility: "none", methods: ["pull_test_indirect"] }
    },
    design_life_years: 25,
    codes: ["DNV_RP_E303", "API_RP_2A"]
  }
};

// ============================================================
// ZONE SEVERITY REGISTRY
// ============================================================

var ZONES = {
  atmospheric: {
    name: "Atmospheric Zone",
    description: "Above splash zone. Exposed to weather, UV, temperature cycling.",
    severity_multiplier: 1.0,
    corrosion_driver: "atmospheric_moisture_salt",
    cp_effectiveness: "not_applicable",
    coating_criticality: "high",
    typical_corrosion_rate_mm_yr: { min: 0.05, typical: 0.1, max: 0.3 },
    inspection_access: "scaffold_rope_access",
    inspection_confidence: "high",
    key_mechanisms: ["atmospheric_corrosion", "UV_degradation", "CUI_if_insulated"],
    interaction_note: "Atmospheric zone interfaces with splash zone. Coating condition at the boundary drives corrosion transition."
  },
  splash: {
    name: "Splash Zone",
    description: "CRITICAL ZONE. Alternating wet/dry. Maximum oxygen, maximum wetting cycles, minimum CP effectiveness, maximum mechanical loading. All factors converge here.",
    severity_multiplier: 2.5,
    corrosion_driver: "wet_dry_cycling_high_oxygen",
    cp_effectiveness: "minimal_to_none",
    coating_criticality: "critical",
    typical_corrosion_rate_mm_yr: { min: 0.3, typical: 0.5, max: 1.5 },
    inspection_access: "sea_state_dependent_difficult",
    inspection_confidence: "moderate_to_low",
    key_mechanisms: ["accelerated_corrosion", "coating_failure", "mechanical_damage", "fatigue", "CP_ineffective"],
    interaction_note: "Splash zone is the Klein bottle singularity — atmospheric, marine, structural, and protection systems all fail to provide full coverage simultaneously. No single protective measure is fully effective."
  },
  tidal: {
    name: "Tidal Zone",
    description: "Periodically submerged. CP partially effective when submerged.",
    severity_multiplier: 1.8,
    corrosion_driver: "intermittent_immersion",
    cp_effectiveness: "intermittent",
    coating_criticality: "high",
    typical_corrosion_rate_mm_yr: { min: 0.2, typical: 0.4, max: 1.0 },
    inspection_access: "tide_dependent",
    inspection_confidence: "moderate",
    key_mechanisms: ["corrosion", "biofouling", "coating_degradation"],
    interaction_note: "Tidal zone coating must handle both atmospheric and immersion conditions. CP only protects when submerged."
  },
  submerged: {
    name: "Submerged Zone",
    description: "Continuously submerged. CP effective if designed correctly. Lower oxygen than splash.",
    severity_multiplier: 1.0,
    corrosion_driver: "seawater_immersion_oxygen_limited",
    cp_effectiveness: "effective_if_designed",
    coating_criticality: "moderate",
    typical_corrosion_rate_mm_yr: { min: 0.05, typical: 0.15, max: 0.4 },
    inspection_access: "diver_or_ROV",
    inspection_confidence: "moderate",
    key_mechanisms: ["marine_growth", "CP_dependent_corrosion", "galvanic_corrosion", "fatigue"],
    interaction_note: "Submerged corrosion is moderated by CP + coating. If both fail, corrosion accelerates but remains below splash zone rates due to lower oxygen."
  },
  mudline: {
    name: "Mudline Zone",
    description: "Soil-water interface. Scour exposure, low oxygen, anaerobic bacteria risk.",
    severity_multiplier: 1.5,
    corrosion_driver: "anaerobic_MIC_crevice",
    cp_effectiveness: "variable_shielding_risk",
    coating_criticality: "high",
    typical_corrosion_rate_mm_yr: { min: 0.1, typical: 0.3, max: 0.8 },
    inspection_access: "diver_limited_visibility",
    inspection_confidence: "low",
    key_mechanisms: ["MIC", "crevice_corrosion", "scour", "CP_shielding", "under_deposit_corrosion"],
    interaction_note: "Mudline is where anaerobic MIC and aerobic corrosion boundaries meet. Scour can suddenly expose buried sections, changing the corrosion environment entirely."
  },
  buried: {
    name: "Buried Zone",
    description: "Below seabed. Low oxygen, anaerobic conditions. CP may be shielded by coatings or deposits.",
    severity_multiplier: 1.2,
    corrosion_driver: "anaerobic_soil_chemistry",
    cp_effectiveness: "uncertain_possible_shielding",
    coating_criticality: "critical_if_CP_shielded",
    typical_corrosion_rate_mm_yr: { min: 0.01, typical: 0.05, max: 0.3 },
    inspection_access: "not_directly_inspectable",
    inspection_confidence: "very_low",
    key_mechanisms: ["MIC", "CP_shielding", "soil_corrosion", "coating_disbondment"],
    interaction_note: "Buried zone is the hardest to assess. Coating that disbonds can shield CP while trapping corrosive soil chemistry against the steel — the Klein bottle effect where protection becomes the attack vector."
  },
  internal: {
    name: "Internal / Process-Wetted Zone",
    description: "Inside the pipe/vessel. Exposed to process fluid. No CP protection. Lining/inhibitor dependent.",
    severity_multiplier: 1.5,
    corrosion_driver: "process_fluid_chemistry",
    cp_effectiveness: "not_applicable_internal",
    coating_criticality: "critical_if_lining_present",
    typical_corrosion_rate_mm_yr: { min: 0.05, typical: 0.3, max: 5.0 },
    inspection_access: "ILI_or_UT_from_external",
    inspection_confidence: "variable",
    key_mechanisms: ["CO2_corrosion", "H2S_corrosion", "erosion", "erosion_corrosion", "MIC_internal", "hydrate", "wax", "scale"],
    interaction_note: "Internal damage thins the wall, which changes external stress state and fatigue life. Internal corrosion + external coating failure = accelerated through-wall failure. The wall itself is the Klein bottle surface."
  }
};

// ============================================================
// ENGINE ROUTING LOGIC
// ============================================================

var ENGINE_ROUTING = {
  always: [
    "coatings-intelligence-authority",
    "corrosion-loop-engine",
    "mechanism-causality-engine",
    "uncertainty-boundary-engine",
    "evidence-contract-engine",
    "decision-liability-engine",
    "interaction-mesh",
    "root-cause-prevention"
  ],
  if_structural: [
    "fatigue-vibration-proof",
    "weld-acceptance-authority",
    "multi-asset-cascade"
  ],
  if_flow_asset: [
    "fatigue-vibration-proof"
  ],
  if_cp_present: [
    "cp-intelligence"
  ],
  if_marine_growth: [
    "marine-growth-engine"
  ],
  if_external_event: [
    "external-interaction-engine"
  ],
  if_subsea: [
    "subsea-structures-orchestrator"
  ]
};

// ============================================================
// CORE FUNCTIONS
// ============================================================

function classifyAsset(assetType, context) {
  var assetDef = ASSET_CLASSES[assetType];
  if (!assetDef) {
    // Try fuzzy match
    var keys = Object.keys(ASSET_CLASSES);
    for (var i = 0; i < keys.length; i++) {
      if (assetType && keys[i].indexOf(assetType.toLowerCase()) >= 0) {
        assetDef = ASSET_CLASSES[keys[i]];
        assetType = keys[i];
        break;
      }
    }
  }

  if (!assetDef) {
    return {
      classified: false,
      asset_type: assetType,
      error: "Unknown asset type. Available types: " + Object.keys(ASSET_CLASSES).join(", ")
    };
  }

  return {
    classified: true,
    asset_type: assetType,
    category: assetDef.category,
    name: assetDef.name,
    geometry: assetDef.geometry,
    load_role: assetDef.load_role,
    consequence_class: assetDef.consequence_class,
    typical_materials: assetDef.typical_materials,
    design_life_years: assetDef.design_life_years,
    codes: assetDef.codes,
    typical_failure_locations: assetDef.typical_failure_locations,
    inspection_constraints: assetDef.inspection_constraints
  };
}

function evaluateZone(zoneName, assetType, context) {
  var zoneDef = ZONES[zoneName];
  if (!zoneDef) {
    return { error: "Unknown zone. Available: " + Object.keys(ZONES).join(", ") };
  }

  var assetDef = ASSET_CLASSES[assetType] || null;
  var assetConstraints = null;
  if (assetDef && assetDef.inspection_constraints && assetDef.inspection_constraints[zoneName]) {
    assetConstraints = assetDef.inspection_constraints[zoneName];
  }

  var zoneFailureLocations = [];
  if (assetDef && assetDef.typical_failure_locations) {
    for (var i = 0; i < assetDef.typical_failure_locations.length; i++) {
      var loc = assetDef.typical_failure_locations[i];
      if (zoneName === "splash" && (loc.location.indexOf("splash") >= 0 || loc.mechanism.indexOf("coating_failure") >= 0)) {
        zoneFailureLocations.push(loc);
      } else if (zoneName === "submerged" && (loc.location.indexOf("node") >= 0 || loc.location.indexOf("connection") >= 0 || loc.location.indexOf("span") >= 0)) {
        zoneFailureLocations.push(loc);
      } else if (zoneName === "mudline" && (loc.location.indexOf("mudline") >= 0 || loc.location.indexOf("seabed") >= 0)) {
        zoneFailureLocations.push(loc);
      } else if (zoneName === "internal" && (loc.location.indexOf("internal") >= 0 || loc.location.indexOf("6_oclock") >= 0)) {
        zoneFailureLocations.push(loc);
      }
    }
  }

  var adjustedMultiplier = zoneDef.severity_multiplier;
  var modifierReasons = [];

  if (context) {
    if (context.age_years && context.age_years > 20) {
      adjustedMultiplier = adjustedMultiplier * 1.2;
      modifierReasons.push("Asset age > 20 years: +20% severity");
    }
    if (context.coating_condition === "failed" || context.coating_condition === "severe_degradation") {
      adjustedMultiplier = adjustedMultiplier * 1.3;
      modifierReasons.push("Coating failed/severe: +30% severity");
    }
    if (context.cp_status === "ineffective" || context.cp_status === "depleted") {
      adjustedMultiplier = adjustedMultiplier * 1.2;
      modifierReasons.push("CP ineffective/depleted: +20% severity");
    }
    if (context.previous_damage === true) {
      adjustedMultiplier = adjustedMultiplier * 1.15;
      modifierReasons.push("Previous damage recorded: +15% severity");
    }
    if (context.sour_service === true && zoneName === "internal") {
      adjustedMultiplier = adjustedMultiplier * 1.5;
      modifierReasons.push("Sour service (internal): +50% severity");
    }
  }

  adjustedMultiplier = Math.round(adjustedMultiplier * 100) / 100;

  return {
    zone: zoneName,
    zone_name: zoneDef.name,
    description: zoneDef.description,
    base_severity_multiplier: zoneDef.severity_multiplier,
    adjusted_severity_multiplier: adjustedMultiplier,
    modifier_reasons: modifierReasons,
    corrosion_driver: zoneDef.corrosion_driver,
    cp_effectiveness: zoneDef.cp_effectiveness,
    coating_criticality: zoneDef.coating_criticality,
    typical_corrosion_rate: zoneDef.typical_corrosion_rate_mm_yr,
    key_mechanisms: zoneDef.key_mechanisms,
    inspection_access: assetConstraints ? assetConstraints.access : zoneDef.inspection_access,
    inspection_methods: assetConstraints ? assetConstraints.methods : [],
    inspection_confidence: assetConstraints ? assetConstraints.visibility : zoneDef.inspection_confidence,
    zone_failure_locations: zoneFailureLocations,
    interaction_note: zoneDef.interaction_note
  };
}

function routeEngines(assetType, zone, context) {
  var engines = [];
  for (var a = 0; a < ENGINE_ROUTING.always.length; a++) {
    engines.push({ engine: ENGINE_ROUTING.always[a], reason: "always_required" });
  }

  var assetDef = ASSET_CLASSES[assetType];
  if (assetDef) {
    if (assetDef.load_role === "primary_load_bearing" || assetDef.load_role === "primary_load_path" || assetDef.load_role === "foundation" || assetDef.load_role === "station_keeping" || assetDef.load_role === "secondary_structural") {
      for (var s = 0; s < ENGINE_ROUTING.if_structural.length; s++) {
        engines.push({ engine: ENGINE_ROUTING.if_structural[s], reason: "structural_asset" });
      }
    }
    if (assetDef.category === "flow_asset") {
      for (var f = 0; f < ENGINE_ROUTING.if_flow_asset.length; f++) {
        var already = false;
        for (var chk = 0; chk < engines.length; chk++) {
          if (engines[chk].engine === ENGINE_ROUTING.if_flow_asset[f]) { already = true; break; }
        }
        if (!already) engines.push({ engine: ENGINE_ROUTING.if_flow_asset[f], reason: "flow_asset" });
      }
    }
  }

  if (zone !== "atmospheric" && zone !== "internal") {
    for (var cp = 0; cp < ENGINE_ROUTING.if_cp_present.length; cp++) {
      engines.push({ engine: ENGINE_ROUTING.if_cp_present[cp], reason: "subsea_cp_applicable" });
    }
  }

  if (zone === "submerged" || zone === "mudline" || zone === "tidal") {
    for (var mg = 0; mg < ENGINE_ROUTING.if_marine_growth.length; mg++) {
      engines.push({ engine: ENGINE_ROUTING.if_marine_growth[mg], reason: "marine_growth_zone" });
    }
  }

  if (context && context.external_event) {
    for (var ext = 0; ext < ENGINE_ROUTING.if_external_event.length; ext++) {
      engines.push({ engine: ENGINE_ROUTING.if_external_event[ext], reason: "external_event_reported" });
    }
  }

  for (var sub = 0; sub < ENGINE_ROUTING.if_subsea.length; sub++) {
    engines.push({ engine: ENGINE_ROUTING.if_subsea[sub], reason: "subsea_domain" });
  }

  return {
    engines_to_fire: engines,
    total_engines: engines.length,
    asset_type: assetType,
    zone: zone
  };
}

// ============================================================
// HANDLER
// ============================================================

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body
