// @ts-nocheck
/**
 * DEPLOY288 - vessel-class-registry.ts
 * netlify/functions/vessel-class-registry.ts
 *
 * VESSEL CLASS REGISTRY + STRUCTURAL SYSTEMS ENGINE
 *
 * Classifies vessels, maps structural systems, identifies failure
 * modes, determines inspection constraints, and routes to correct
 * domain engines.
 *
 * POST /api/vessel-class-registry
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var ENGINE_ID = "vessel-class-registry";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY288";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

var VESSEL_CLASSES = {
  tug: { category: "small_utility", name: "Tug Boat", consequence_class: "moderate", typical_materials: ["mild_steel_A", "AH32", "AH36"], design_life_years: 25, survey_regime: "class_annual", critical_areas: ["hull_waterline", "tow_point_structure", "engine_foundation", "deck_fittings"], codes: ["class_rules", "SOLAS", "load_line"] },
  workboat: { category: "small_utility", name: "Workboat / Utility Vessel", consequence_class: "moderate", typical_materials: ["mild_steel_A", "aluminum_marine"], design_life_years: 20, survey_regime: "class_annual", critical_areas: ["hull_bottom", "deck_openings", "crane_foundation"], codes: ["class_rules", "flag_state"] },
  crew_boat: { category: "small_utility", name: "Crew Transfer Vessel", consequence_class: "high", typical_materials: ["aluminum_marine", "FRP_composite"], design_life_years: 15, survey_regime: "class_annual", critical_areas: ["hull_bottom_slamming", "structural_connections", "fendering"], codes: ["class_rules", "HSC_code"] },
  container_ship: { category: "cargo_transport", name: "Container Ship", consequence_class: "major", typical_materials: ["AH32", "AH36", "DH36", "EH36"], design_life_years: 25, survey_regime: "class_5yr_special", critical_areas: ["hatch_corners", "deck_openings", "container_supports", "bottom_shell", "side_shell_waterline", "transverse_bulkheads"], codes: ["IACS_CSR", "SOLAS", "MARPOL"] },
  bulk_carrier: { category: "cargo_transport", name: "Bulk Carrier", consequence_class: "catastrophic", typical_materials: ["AH32", "AH36", "DH36"], design_life_years: 25, survey_regime: "class_5yr_special_ESP", critical_areas: ["side_shell_frames", "double_bottom", "hatch_coamings", "transverse_bulkheads", "topside_tanks", "hopper_tanks"], codes: ["IACS_CSR_BC", "SOLAS", "MARPOL"] },
  crude_tanker: { category: "cargo_transport", name: "Crude Oil Tanker", consequence_class: "catastrophic", typical_materials: ["AH32", "AH36", "DH36", "EH36"], design_life_years: 25, survey_regime: "class_5yr_special_ESP", critical_areas: ["cargo_tank_coating", "ballast_tank_coating", "deck_plating", "bottom_plating", "longitudinal_bulkheads", "web_frames"], codes: ["IACS_CSR_OT", "SOLAS", "MARPOL", "CAS"] },
  product_tanker: { category: "cargo_transport", name: "Product / Chemical Tanker", consequence_class: "catastrophic", typical_materials: ["stainless_316L", "duplex", "coated_mild_steel"], design_life_years: 25, survey_regime: "class_5yr_special", critical_areas: ["cargo_tank_lining", "cargo_piping", "heating_coils", "pump_rooms"], codes: ["IBC_code", "IACS_CSR", "SOLAS", "MARPOL"] },
  lng_carrier: { category: "cargo_transport", name: "LNG Carrier", consequence_class: "catastrophic", typical_materials: ["9_percent_nickel", "invar_membrane", "AH36", "EH36"], design_life_years: 30, survey_regime: "class_5yr_special", critical_areas: ["containment_system", "insulation", "cofferdam", "hull_structure", "cargo_piping"], codes: ["IGC_code", "class_rules", "SOLAS"] },
  psv: { category: "offshore_support", name: "Platform Supply Vessel", consequence_class: "high", typical_materials: ["AH32", "AH36"], design_life_years: 25, survey_regime: "class_annual", critical_areas: ["cargo_deck", "tank_tops", "hull_bottom", "thruster_tunnels"], codes: ["class_rules", "SOLAS", "DP_rules"] },
  ahts: { category: "offshore_support", name: "Anchor Handling Tug Supply", consequence_class: "high", typical_materials: ["AH36", "DH36"], design_life_years: 25, survey_regime: "class_annual", critical_areas: ["stern_roller", "towing_winch_foundation", "aft_deck_structure", "hull_bottom"], codes: ["class_rules", "SOLAS", "anchor_handling_rules"] },
  construction_vessel: { category: "offshore_support", name: "Construction / Pipelay Vessel", consequence_class: "major", typical_materials: ["AH36", "DH36", "EH36"], design_life_years: 30, survey_regime: "class_5yr_special", critical_areas: ["crane_foundations", "pipelay_ramp", "moonpool", "hull_side_shell"], codes: ["class_rules", "SOLAS", "crane_rules"] },
  fpso: { category: "offshore_production", name: "FPSO / FSO", consequence_class: "catastrophic", typical_materials: ["AH32", "AH36", "DH36", "EH36"], design_life_years: 30, survey_regime: "continuous_survey_SPS", critical_areas: ["turret_bearing", "hull_topside_interface", "cargo_tanks", "ballast_tanks", "side_shell_waterline", "deck_longitudinals", "transverse_frames", "riser_interface", "flare_tower_base"], codes: ["class_rules_FPSO", "MODU_code", "SPS_code", "API_RP_2FPS"] },
  floating_platform: { category: "offshore_production", name: "Floating Production Platform", consequence_class: "catastrophic", typical_materials: ["AH36", "DH36", "EH36"], design_life_years: 30, survey_regime: "continuous_survey", critical_areas: ["column_connections", "pontoon_structure", "brace_nodes", "deck_structure", "riser_interface"], codes: ["class_rules", "MODU_code"] },
  drillship: { category: "drilling", name: "Drillship", consequence_class: "catastrophic", typical_materials: ["AH36", "DH36", "EH36"], design_life_years: 30, survey_regime: "class_5yr_special", critical_areas: ["moonpool", "derrick_foundation", "hull_midships", "thruster_tunnels", "riser_hang_off"], codes: ["MODU_code", "class_rules", "DP_rules"] },
  semi_submersible: { category: "drilling", name: "Semi-Submersible", consequence_class: "catastrophic", typical_materials: ["AH36", "DH36", "EH36"], design_life_years: 30, survey_regime: "class_5yr_special", critical_areas: ["column_brace_nodes", "pontoon_connections", "deck_box_corners", "chain_lockers", "ballast_tanks"], codes: ["MODU_code", "class_rules"] },
  jackup: { category: "drilling", name: "Jack-Up Rig", consequence_class: "catastrophic", typical_materials: ["high_strength_steel_690MPa", "AH36", "DH36"], design_life_years: 25, survey_regime: "class_5yr_special", critical_areas: ["leg_chord_nodes", "leg_rack", "spudcan", "hull_leg_interface", "cantilever_structure", "jacking_system"], codes: ["MODU_code", "class_rules", "SNAME_guidelines"] },
  heavy_lift: { category: "specialized", name: "Heavy Lift Vessel", consequence_class: "major", typical_materials: ["AH36", "DH36", "EH36"], design_life_years: 30, survey_regime: "class_5yr_special", critical_areas: ["crane_pedestal", "deck_structure", "ballast_system", "hull_bottom"], codes: ["class_rules", "SOLAS", "heavy_lift_rules"] },
  cable_layer: { category: "specialized", name: "Cable Lay Vessel", consequence_class: "moderate", typical_materials: ["AH32", "AH36"], design_life_years: 25, survey_regime: "class_annual", critical_areas: ["cable_tanks", "tensioner_foundation", "chute_structure"], codes: ["class_rules", "SOLAS"] }
};

var STRUCTURAL_SYSTEMS = {
  hull_plating: { name: "Hull Shell Plating", role: "primary", failure_modes: ["corrosion_thinning", "buckling", "fatigue_cracking", "impact_deformation"], inspection_methods: ["UT_thickness", "visual", "close_up_survey"] },
  frames_stiffeners: { name: "Frames / Stiffeners", role: "primary", failure_modes: ["web_corrosion", "flange_buckling", "tripping", "end_connection_cracking"], inspection_methods: ["visual", "UT_thickness", "MPI_at_connections"] },
  longitudinal_girders: { name: "Longitudinal Girders", role: "primary", failure_modes: ["corrosion_thinning", "fatigue_at_cutouts", "buckling"], inspection_methods: ["UT_thickness", "visual", "close_up"] },
  transverse_bulkheads: { name: "Transverse Bulkheads", role: "primary", failure_modes: ["corrosion", "buckling", "weld_cracking", "flooding_boundary_failure"], inspection_methods: ["UT_thickness", "visual", "tank_testing"] },
  deck_plating: { name: "Deck Plating", role: "primary", failure_modes: ["corrosion", "fatigue_at_openings", "deformation_from_loads"], inspection_methods: ["UT_thickness", "visual", "MPI_at_openings"] },
  double_bottom: { name: "Double Bottom Structure", role: "primary", failure_modes: ["internal_corrosion", "coating_failure", "frame_cracking"], inspection_methods: ["internal_UT", "visual_internal", "tank_testing"] },
  web_frames: { name: "Web Frames", role: "primary", failure_modes: ["corrosion_at_brackets", "fatigue_at_cutouts", "buckling_of_web"], inspection_methods: ["UT", "visual", "close_up_survey"] },
  turret_system: { name: "Turret System (FPSO)", role: "critical", failure_modes: ["bearing_wear", "fatigue", "corrosion", "seal_failure"], inspection_methods: ["specialized_turret_survey", "vibration_monitoring"], applies_to: ["fpso"] },
  column_structure: { name: "Column Structure (Semi-Sub)", role: "critical", failure_modes: ["fatigue_at_nodes", "corrosion", "impact_damage"], inspection_methods: ["UT", "MPI", "FMD", "visual"], applies_to: ["semi_submersible", "floating_platform"] },
  jackup_legs: { name: "Jack-Up Legs", role: "critical", failure_modes: ["fatigue_at_nodes", "corrosion", "rack_wear", "punch_through"], inspection_methods: ["MPI_at_nodes", "UT", "visual", "rack_measurement"], applies_to: ["jackup"] }
};

var VESSEL_ZONES = {
  topsides: { severity: 1.0, cp: "none", coating: "atmospheric_marine" },
  main_deck: { severity: 1.2, cp: "none", coating: "deck_coating_nonskid" },
  waterline: { severity: 2.0, cp: "partial", coating: "boot_top_antifouling" },
  splash: { severity: 2.5, cp: "minimal", coating: "splash_zone_system" },
  underwater_hull: { severity: 1.0, cp: "effective", coating: "antifouling_system" },
  cargo_tanks: { severity: 1.8, cp: "none", coating: "cargo_tank_coating_or_CRA" },
  ballast_tanks: { severity: 2.0, cp: "none_or_anodes", coating: "ballast_tank_epoxy" },
  void_spaces: { severity: 1.2, cp: "none", coating: "shop_primer_only" },
  machinery_spaces: { severity: 1.0, cp: "none", coating: "machinery_space_paint" }
};

function classifyVessel(vesselType, context) {
  var vesselDef = VESSEL_CLASSES[vesselType];
  if (!vesselDef) {
    var keys = Object.keys(VESSEL_CLASSES);
    for (var i = 0; i < keys.length; i++) {
      if (vesselType && keys[i].indexOf(vesselType.toLowerCase()) >= 0) {
        vesselDef = VESSEL_CLASSES[keys[i]];
        vesselType = keys[i];
        break;
      }
    }
  }
  if (!vesselDef) return { classified: false, error: "Unknown vessel type. Available: " + Object.keys(VESSEL_CLASSES).join(", ") };
  var age = context ? context.age_years || 0 : 0;
  var ageStatus = age > vesselDef.design_life_years ? "beyond_design_life" : (age > vesselDef.design_life_years * 0.8 ? "approaching_end_of_life" : (age > vesselDef.design_life_years * 0.5 ? "mid_life" : "within_design_life"));
  return { classified: true, vessel_type: vesselType, category: vesselDef.category, name: vesselDef.name, consequence_class: vesselDef.consequence_class, typical_materials: vesselDef.typical_materials, design_life_years: vesselDef.design_life_years, age_years: age, age_status: ageStatus, survey_regime: vesselDef.survey_regime, critical_areas: vesselDef.critical_areas, codes: vesselDef.codes };
}

function getStructuralSystems(vesselType) {
  var applicable = [];
  var keys = Object.keys(STRUCTURAL_SYSTEMS);
  for (var i = 0; i < keys.length; i++) {
    var sys = STRUCTURAL_SYSTEMS[keys[i]];
    if (!sys.applies_to || sys.applies_to.indexOf(vesselType) >= 0) {
      applicable.push({ id: keys[i], name: sys.name, role: sys.role, failure_modes: sys.failure_modes, inspection_methods: sys.inspection_methods });
    }
  }
  return applicable;
}

function routeVesselEngines(vesselType, context) {
  var engines = [
    { engine: "coatings-intelligence-authority", reason: "always" },
    { engine: "corrosion-loop-engine", reason: "always" },
    { engine: "mechanism-causality-engine", reason: "always" },
    { engine: "uncertainty-boundary-engine", reason: "always" },
    { engine: "evidence-contract-engine", reason: "always" },
    { engine: "decision-liability-engine", reason: "always" },
    { engine: "interaction-mesh", reason: "always" },
    { engine: "root-cause-prevention", reason: "always" },
    { engine: "fatigue-vibration-proof", reason: "vessel_motion_fatigue" },
    { engine: "weld-acceptance-authority", reason: "structural_welds" },
    { engine: "stability-engine", reason: "vessel_stability" },
    { engine: "vessel-motion-engine", reason: "vessel_hydrodynamics" },
    { engine: "marine-vessel-orchestrator", reason: "vessel_domain" }
  ];
  var vesselDef = VESSEL_CLASSES[vesselType];
  if (vesselDef && (vesselDef.category === "offshore_production" || vesselDef.category === "drilling")) {
    engines.push({ engine: "subsea-structures-orchestrator", reason: "subsea_interface" });
  }
  if (context && context.external_event) {
    engines.push({ engine: "external-interaction-engine", reason: "damage_event" });
  }
  return { engines_to_fire: engines, total: engines.length, vessel_type: vesselType };
}

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";

    if (action === "get_registry") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, deploy: DEPLOY, mode: "deterministic", purpose: "Vessel Class Registry + Structural Systems Engine", vessel_classes: Object.keys(VESSEL_CLASSES).length, structural_systems: Object.keys(STRUCTURAL_SYSTEMS).length, vessel_zones: Object.keys(VESSEL_ZONES).length, actions: ["classify_vessel", "get_structural_systems", "get_vessel_zones", "route_engines", "get_vessel_registry", "get_registry"] }) };
    }
    if (action === "classify_vessel") {
      if (!body.vessel_type) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "vessel_type required" }) };
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: classifyVessel(body.vessel_type, body.context || {}) }, null, 2) };
    }
    if (action === "get_structural_systems") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, systems: getStructuralSystems(body.vessel_type || "all") }, null, 2) };
    }
    if (action === "get_vessel_zones") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, zones: VESSEL_ZONES }, null, 2) };
    }
    if (action === "route_engines") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: routeVesselEngines(body.vessel_type || "unknown", body.context || {}) }, null, 2) };
    }
    if (action === "get_vessel_registry") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, vessel_classes: VESSEL_CLASSES }, null, 2) };
    }
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
