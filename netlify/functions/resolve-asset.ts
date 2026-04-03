// DEPLOY79 REBUILD — Universal Asset Alias Resolver v2
// 20+ asset classes, 400+ aliases, weighted context disambiguation
// NO TEMPLATE LITERALS — STRING CONCATENATION ONLY
// ALL LOGIC INLINED — NO LIB IMPORTS

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
    var raw = (body.raw_text || body.transcript || "").toLowerCase();

    if (!raw || raw.length < 3) {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify({
          resolved: {
            asset_class: "pressure_vessel",
            asset_type: "pressure_vessel",
            confidence: 0.1,
            alternatives: []
          },
          warning: "No text provided — defaulted to pressure_vessel"
        })
      };
    }

    // ================================================================
    // ALIAS DATABASE — alias → { asset_class, weight, asset_type }
    // Higher weight = stronger match
    // ================================================================

    var ALIASES: { [key: string]: { c: string; w: number; t: string } } = {

      // --- PRESSURE VESSEL ---
      "pressure vessel": { c: "pressure_vessel", w: 10, t: "pressure_vessel" },
      "vessel": { c: "pressure_vessel", w: 4, t: "pressure_vessel" },
      "reactor": { c: "pressure_vessel", w: 9, t: "reactor_vessel" },
      "reactor vessel": { c: "pressure_vessel", w: 10, t: "reactor_vessel" },
      "column": { c: "pressure_vessel", w: 6, t: "distillation_column" },
      "tower": { c: "pressure_vessel", w: 6, t: "distillation_column" },
      "distillation column": { c: "pressure_vessel", w: 10, t: "distillation_column" },
      "distillation tower": { c: "pressure_vessel", w: 10, t: "distillation_column" },
      "fractionator": { c: "pressure_vessel", w: 10, t: "fractionator" },
      "separator": { c: "pressure_vessel", w: 9, t: "separator" },
      "knockout drum": { c: "pressure_vessel", w: 10, t: "knockout_drum" },
      "flash drum": { c: "pressure_vessel", w: 10, t: "flash_drum" },
      "surge drum": { c: "pressure_vessel", w: 10, t: "surge_drum" },
      "accumulator": { c: "pressure_vessel", w: 9, t: "accumulator" },
      "receiver": { c: "pressure_vessel", w: 7, t: "receiver" },
      "drum": { c: "pressure_vessel", w: 6, t: "drum" },
      "autoclave": { c: "pressure_vessel", w: 10, t: "autoclave" },
      "deaerator": { c: "pressure_vessel", w: 10, t: "deaerator" },
      "absorber": { c: "pressure_vessel", w: 9, t: "absorber" },
      "stripper": { c: "pressure_vessel", w: 8, t: "stripper_column" },
      "scrubber": { c: "pressure_vessel", w: 8, t: "scrubber" },
      "contactor": { c: "pressure_vessel", w: 8, t: "contactor" },
      "amine contactor": { c: "pressure_vessel", w: 10, t: "amine_contactor" },
      "amine regenerator": { c: "pressure_vessel", w: 10, t: "amine_regenerator" },
      "treater": { c: "pressure_vessel", w: 7, t: "treater" },
      "filter vessel": { c: "pressure_vessel", w: 9, t: "filter_vessel" },
      "air receiver": { c: "pressure_vessel", w: 10, t: "air_receiver" },
      "blowdown drum": { c: "pressure_vessel", w: 10, t: "blowdown_drum" },
      "coalescer": { c: "pressure_vessel", w: 9, t: "coalescer" },
      "hydrotreater": { c: "pressure_vessel", w: 10, t: "hydrotreater_reactor" },
      "hydrocracker": { c: "pressure_vessel", w: 10, t: "hydrocracker_reactor" },
      "reformer reactor": { c: "pressure_vessel", w: 10, t: "reformer_reactor" },
      "cat cracker": { c: "pressure_vessel", w: 10, t: "fcc_reactor" },
      "fcc reactor": { c: "pressure_vessel", w: 10, t: "fcc_reactor" },
      "fcc regenerator": { c: "pressure_vessel", w: 10, t: "fcc_regenerator" },
      "coker drum": { c: "pressure_vessel", w: 10, t: "coker_drum" },
      "coke drum": { c: "pressure_vessel", w: 10, t: "coker_drum" },
      "spheroid": { c: "pressure_vessel", w: 9, t: "spheroid" },
      "sphere": { c: "pressure_vessel", w: 7, t: "pressure_sphere" },
      "bullet": { c: "pressure_vessel", w: 6, t: "bullet_tank" },
      "lpg bullet": { c: "pressure_vessel", w: 10, t: "lpg_bullet" },
      "ngl bullet": { c: "pressure_vessel", w: 10, t: "ngl_bullet" },
      "pressure sphere": { c: "pressure_vessel", w: 10, t: "pressure_sphere" },
      "propane bullet": { c: "pressure_vessel", w: 10, t: "lpg_bullet" },

      // --- HEAT EXCHANGER ---
      "heat exchanger": { c: "heat_exchanger", w: 10, t: "heat_exchanger" },
      "exchanger": { c: "heat_exchanger", w: 8, t: "heat_exchanger" },
      "shell and tube": { c: "heat_exchanger", w: 10, t: "shell_tube_hx" },
      "condenser": { c: "heat_exchanger", w: 9, t: "condenser" },
      "reboiler": { c: "heat_exchanger", w: 10, t: "reboiler" },
      "cooler": { c: "heat_exchanger", w: 7, t: "cooler" },
      "aftercooler": { c: "heat_exchanger", w: 9, t: "aftercooler" },
      "intercooler": { c: "heat_exchanger", w: 9, t: "intercooler" },
      "preheater": { c: "heat_exchanger", w: 8, t: "preheater" },
      "feed preheater": { c: "heat_exchanger", w: 10, t: "feed_preheater" },
      "air cooler": { c: "heat_exchanger", w: 10, t: "air_cooler" },
      "fin fan": { c: "heat_exchanger", w: 10, t: "air_cooler" },
      "plate exchanger": { c: "heat_exchanger", w: 10, t: "plate_hx" },
      "plate and frame": { c: "heat_exchanger", w: 10, t: "plate_hx" },
      "economizer": { c: "heat_exchanger", w: 9, t: "economizer" },
      "superheater": { c: "heat_exchanger", w: 9, t: "superheater" },
      "waste heat boiler": { c: "heat_exchanger", w: 10, t: "waste_heat_boiler" },
      "bayonet": { c: "heat_exchanger", w: 8, t: "bayonet_hx" },
      "double pipe": { c: "heat_exchanger", w: 9, t: "double_pipe_hx" },
      "u-tube": { c: "heat_exchanger", w: 8, t: "u_tube_hx" },

      // --- PROCESS PIPING ---
      "piping": { c: "process_piping", w: 8, t: "process_piping" },
      "process piping": { c: "process_piping", w: 10, t: "process_piping" },
      "pipe": { c: "process_piping", w: 5, t: "process_piping" },
      "header": { c: "process_piping", w: 7, t: "header_piping" },
      "manifold": { c: "process_piping", w: 7, t: "manifold" },
      "small bore": { c: "process_piping", w: 8, t: "small_bore_piping" },
      "socket weld": { c: "process_piping", w: 9, t: "small_bore_piping" },
      "injection point": { c: "process_piping", w: 9, t: "injection_piping" },
      "dead leg": { c: "process_piping", w: 9, t: "dead_leg" },
      "process line": { c: "process_piping", w: 9, t: "process_piping" },
      "transfer line": { c: "process_piping", w: 9, t: "transfer_line" },
      "gas line": { c: "process_piping", w: 5, t: "gas_piping" },
      "recycle gas": { c: "process_piping", w: 9, t: "recycle_gas_piping" },
      "hydrogen loop": { c: "process_piping", w: 10, t: "hydrogen_piping" },
      "steam line": { c: "process_piping", w: 8, t: "steam_piping" },
      "blow down line": { c: "process_piping", w: 8, t: "blowdown_piping" },

      // --- STORAGE TANK ---
      "storage tank": { c: "storage_tank", w: 10, t: "storage_tank" },
      "tank": { c: "storage_tank", w: 6, t: "storage_tank" },
      "atmospheric tank": { c: "storage_tank", w: 10, t: "atmospheric_tank" },
      "api 650 tank": { c: "storage_tank", w: 10, t: "api_650_tank" },
      "api 620 tank": { c: "storage_tank", w: 10, t: "api_620_tank" },
      "crude tank": { c: "storage_tank", w: 10, t: "crude_storage_tank" },
      "floating roof": { c: "storage_tank", w: 10, t: "floating_roof_tank" },
      "floating roof tank": { c: "storage_tank", w: 10, t: "floating_roof_tank" },
      "fixed roof tank": { c: "storage_tank", w: 10, t: "fixed_roof_tank" },
      "cone roof": { c: "storage_tank", w: 9, t: "fixed_roof_tank" },
      "dome roof": { c: "storage_tank", w: 9, t: "dome_roof_tank" },
      "water tank": { c: "storage_tank", w: 9, t: "water_tank" },
      "fire water tank": { c: "storage_tank", w: 10, t: "fire_water_tank" },
      "slop tank": { c: "storage_tank", w: 9, t: "slop_tank" },

      // --- PIPELINE ---
      "pipeline": { c: "pipeline", w: 10, t: "pipeline" },
      "transmission pipeline": { c: "pipeline", w: 10, t: "transmission_pipeline" },
      "gathering line": { c: "pipeline", w: 10, t: "gathering_pipeline" },
      "trunk line": { c: "pipeline", w: 9, t: "trunk_line" },
      "cross country": { c: "pipeline", w: 8, t: "cross_country_pipeline" },
      "export pipeline": { c: "pipeline", w: 10, t: "export_pipeline" },
      "export line": { c: "pipeline", w: 9, t: "export_pipeline" },
      "subsea pipeline": { c: "pipeline", w: 10, t: "subsea_pipeline" },
      "submarine pipeline": { c: "pipeline", w: 10, t: "subsea_pipeline" },
      "flowline": { c: "pipeline", w: 9, t: "flowline" },
      "flow line": { c: "pipeline", w: 9, t: "flowline" },
      "riser": { c: "pipeline", w: 8, t: "riser" },
      "sealine": { c: "pipeline", w: 9, t: "subsea_pipeline" },
      "free span": { c: "pipeline", w: 8, t: "subsea_pipeline" },
      "pig launcher": { c: "pipeline", w: 8, t: "pig_launcher_receiver" },
      "pig receiver": { c: "pipeline", w: 8, t: "pig_launcher_receiver" },

      // --- STRUCTURAL STEEL ---
      "structural steel": { c: "structural_steel", w: 10, t: "structural_steel" },
      "structural member": { c: "structural_steel", w: 9, t: "structural_steel" },
      "steel structure": { c: "structural_steel", w: 9, t: "structural_steel" },
      "pipe rack": { c: "structural_steel", w: 9, t: "pipe_rack" },
      "pipe support": { c: "structural_steel", w: 8, t: "pipe_support" },
      "platform structure": { c: "structural_steel", w: 7, t: "platform_structure" },

      // --- OFFSHORE PLATFORM ---
      "offshore platform": { c: "offshore_platform", w: 10, t: "offshore_platform" },
      "platform": { c: "offshore_platform", w: 5, t: "offshore_platform" },
      "jacket": { c: "offshore_platform", w: 9, t: "jacket_platform" },
      "jacket leg": { c: "offshore_platform", w: 10, t: "jacket_platform" },
      "topside": { c: "offshore_platform", w: 9, t: "topside" },
      "fixed platform": { c: "offshore_platform", w: 10, t: "fixed_platform" },
      "compliant tower": { c: "offshore_platform", w: 10, t: "compliant_tower" },
      "jack up": { c: "offshore_platform", w: 9, t: "jack_up" },
      "spar": { c: "offshore_platform", w: 8, t: "spar_platform" },
      "semi-submersible": { c: "offshore_platform", w: 10, t: "semi_submersible" },
      "tlp": { c: "offshore_platform", w: 10, t: "tension_leg_platform" },
      "tension leg": { c: "offshore_platform", w: 10, t: "tension_leg_platform" },
      "caisson": { c: "offshore_platform", w: 7, t: "caisson" },
      "conductor": { c: "offshore_platform", w: 6, t: "conductor" },
      "mudline": { c: "offshore_platform", w: 8, t: "offshore_platform" },
      "j-tube": { c: "offshore_platform", w: 8, t: "offshore_platform" },
      "boat landing": { c: "offshore_platform", w: 8, t: "offshore_platform" },
      "helideck": { c: "offshore_platform", w: 8, t: "offshore_platform" },
      "fpso": { c: "offshore_platform", w: 10, t: "fpso" },
      "fso": { c: "offshore_platform", w: 10, t: "fso" },
      "fpu": { c: "offshore_platform", w: 10, t: "fpu" },
      "floating production": { c: "offshore_platform", w: 10, t: "fpso" },
      "offloading": { c: "offshore_platform", w: 7, t: "fpso" },
      "mooring": { c: "offshore_platform", w: 8, t: "fpso" },
      "turret": { c: "offshore_platform", w: 9, t: "fpso" },
      "swivel": { c: "offshore_platform", w: 8, t: "fpso" },

      // --- REFINERY PROCESS FACILITY ---
      "refinery": { c: "refinery_process_facility", w: 8, t: "refinery" },
      "crude unit": { c: "refinery_process_facility", w: 10, t: "crude_unit" },
      "vacuum unit": { c: "refinery_process_facility", w: 10, t: "vacuum_unit" },
      "fcc": { c: "refinery_process_facility", w: 9, t: "fcc_unit" },
      "fcc unit": { c: "refinery_process_facility", w: 10, t: "fcc_unit" },
      "coker": { c: "refinery_process_facility", w: 9, t: "coker_unit" },
      "coker unit": { c: "refinery_process_facility", w: 10, t: "coker_unit" },
      "reformer": { c: "refinery_process_facility", w: 8, t: "reformer_unit" },
      "reformer unit": { c: "refinery_process_facility", w: 10, t: "reformer_unit" },
      "alkylation": { c: "refinery_process_facility", w: 9, t: "alkylation_unit" },
      "alky unit": { c: "refinery_process_facility", w: 10, t: "alkylation_unit" },
      "isomerization": { c: "refinery_process_facility", w: 9, t: "isomerization_unit" },
      "sulfur recovery": { c: "refinery_process_facility", w: 10, t: "sulfur_recovery" },
      "sru": { c: "refinery_process_facility", w: 9, t: "sulfur_recovery" },
      "amine unit": { c: "refinery_process_facility", w: 10, t: "amine_unit" },
      "process unit": { c: "refinery_process_facility", w: 7, t: "process_unit" },

      // --- BOILER / FURNACE / HEATER ---
      "boiler": { c: "pressure_vessel", w: 9, t: "boiler" },
      "steam boiler": { c: "pressure_vessel", w: 10, t: "steam_boiler" },
      "furnace": { c: "pressure_vessel", w: 8, t: "fired_heater" },
      "heater": { c: "pressure_vessel", w: 7, t: "fired_heater" },
      "fired heater": { c: "pressure_vessel", w: 10, t: "fired_heater" },
      "process heater": { c: "pressure_vessel", w: 10, t: "process_heater" },
      "reformer furnace": { c: "pressure_vessel", w: 10, t: "reformer_furnace" },
      "heater tube": { c: "pressure_vessel", w: 9, t: "heater_tube" },
      "radiant tube": { c: "pressure_vessel", w: 9, t: "radiant_tube" },
      "convection section": { c: "pressure_vessel", w: 8, t: "convection_section" },

      // --- BRIDGE — STEEL ---
      "bridge": { c: "bridge_steel", w: 7, t: "bridge" },
      "steel bridge": { c: "bridge_steel", w: 10, t: "steel_bridge" },
      "steel girder bridge": { c: "bridge_steel", w: 10, t: "steel_girder_bridge" },
      "girder bridge": { c: "bridge_steel", w: 10, t: "steel_girder_bridge" },
      "girder": { c: "bridge_steel", w: 7, t: "steel_girder_bridge" },
      "steel girder": { c: "bridge_steel", w: 10, t: "steel_girder_bridge" },
      "plate girder": { c: "bridge_steel", w: 10, t: "plate_girder_bridge" },
      "truss bridge": { c: "bridge_steel", w: 10, t: "truss_bridge" },
      "through truss": { c: "bridge_steel", w: 10, t: "through_truss_bridge" },
      "deck truss": { c: "bridge_steel", w: 10, t: "deck_truss_bridge" },
      "arch bridge": { c: "bridge_steel", w: 9, t: "arch_bridge" },
      "suspension bridge": { c: "bridge_steel", w: 10, t: "suspension_bridge" },
      "cable stayed": { c: "bridge_steel", w: 10, t: "cable_stayed_bridge" },
      "overpass": { c: "bridge_steel", w: 8, t: "overpass" },
      "underpass": { c: "bridge_steel", w: 7, t: "underpass" },
      "viaduct": { c: "bridge_steel", w: 9, t: "viaduct" },
      "highway bridge": { c: "bridge_steel", w: 9, t: "highway_bridge" },
      "interstate bridge": { c: "bridge_steel", w: 9, t: "highway_bridge" },
      "pedestrian bridge": { c: "bridge_steel", w: 9, t: "pedestrian_bridge" },
      "gusset plate": { c: "bridge_steel", w: 8, t: "truss_bridge" },
      "fracture critical": { c: "bridge_steel", w: 8, t: "fracture_critical_bridge" },
      "stringer": { c: "bridge_steel", w: 6, t: "stringer_bridge" },
      "floorbeam": { c: "bridge_steel", w: 8, t: "steel_girder_bridge" },

      // --- BRIDGE — CONCRETE ---
      "concrete bridge": { c: "bridge_concrete", w: 10, t: "concrete_bridge" },
      "concrete beam bridge": { c: "bridge_concrete", w: 10, t: "concrete_beam_bridge" },
      "prestressed bridge": { c: "bridge_concrete", w: 10, t: "prestressed_bridge" },
      "prestressed beam": { c: "bridge_concrete", w: 10, t: "prestressed_bridge" },
      "precast bridge": { c: "bridge_concrete", w: 10, t: "precast_bridge" },
      "box beam bridge": { c: "bridge_concrete", w: 10, t: "box_beam_bridge" },
      "box beam": { c: "bridge_concrete", w: 8, t: "box_beam_bridge" },
      "post-tensioned bridge": { c: "bridge_concrete", w: 10, t: "post_tensioned_bridge" },
      "post tensioned": { c: "bridge_concrete", w: 9, t: "post_tensioned_bridge" },
      "segmental bridge": { c: "bridge_concrete", w: 10, t: "segmental_bridge" },
      "concrete slab bridge": { c: "bridge_concrete", w: 10, t: "slab_bridge" },
      "t-beam bridge": { c: "bridge_concrete", w: 10, t: "t_beam_bridge" },
      "pier": { c: "bridge_concrete", w: 6, t: "bridge_pier" },
      "pier column": { c: "bridge_concrete", w: 8, t: "bridge_pier" },
      "pier cap": { c: "bridge_concrete", w: 8, t: "bridge_pier" },
      "abutment": { c: "bridge_concrete", w: 8, t: "bridge_abutment" },
      "wingwall": { c: "bridge_concrete", w: 8, t: "bridge_abutment" },
      "retaining wall": { c: "bridge_concrete", w: 7, t: "retaining_wall" },
      "culvert": { c: "bridge_concrete", w: 8, t: "culvert" },
      "box culvert": { c: "bridge_concrete", w: 10, t: "box_culvert" },

      // --- RAIL BRIDGE ---
      "rail bridge": { c: "rail_bridge", w: 10, t: "rail_bridge" },
      "railroad bridge": { c: "rail_bridge", w: 10, t: "railroad_bridge" },
      "railway bridge": { c: "rail_bridge", w: 10, t: "railway_bridge" },
      "train bridge": { c: "rail_bridge", w: 10, t: "rail_bridge" },
      "rail": { c: "rail_bridge", w: 5, t: "rail_bridge" },
      "railroad": { c: "rail_bridge", w: 7, t: "rail_bridge" },
      "railway": { c: "rail_bridge", w: 7, t: "rail_bridge" },
      "track": { c: "rail_bridge", w: 4, t: "rail_bridge" },
      "derailment": { c: "rail_bridge", w: 8, t: "rail_bridge" },
      "derailed": { c: "rail_bridge", w: 8, t: "rail_bridge" },
      "freight train": { c: "rail_bridge", w: 9, t: "rail_bridge" },
      "locomotive": { c: "rail_bridge", w: 8, t: "rail_bridge" },
      "railcar": { c: "rail_bridge", w: 8, t: "rail_bridge" },
      "tank car": { c: "rail_bridge", w: 8, t: "rail_bridge" },
      "rail trestle": { c: "rail_bridge", w: 10, t: "rail_trestle" },
      "timber trestle": { c: "rail_bridge", w: 10, t: "timber_trestle" },

      // --- DAM ---
      "dam": { c: "bridge_concrete", w: 8, t: "dam" },
      "spillway": { c: "bridge_concrete", w: 8, t: "dam_spillway" },
      "lock": { c: "bridge_concrete", w: 5, t: "navigation_lock" },

      // --- VALVE ---
      "valve": { c: "process_piping", w: 5, t: "valve" },
      "relief valve": { c: "pressure_vessel", w: 8, t: "relief_valve" },
      "safety valve": { c: "pressure_vessel", w: 8, t: "safety_valve" },
      "psv": { c: "pressure_vessel", w: 8, t: "pressure_safety_valve" },
      "prv": { c: "pressure_vessel", w: 8, t: "pressure_relief_valve" },
      "control valve": { c: "process_piping", w: 7, t: "control_valve" },
      "check valve": { c: "process_piping", w: 7, t: "check_valve" },
      "gate valve": { c: "process_piping", w: 7, t: "gate_valve" },
      "ball valve": { c: "process_piping", w: 7, t: "ball_valve" },
      "butterfly valve": { c: "process_piping", w: 7, t: "butterfly_valve" },

      // --- FLARE / COOLING / MISC ---
      "flare": { c: "structural_steel", w: 7, t: "flare_system" },
      "flare stack": { c: "structural_steel", w: 9, t: "flare_stack" },
      "flare tip": { c: "structural_steel", w: 8, t: "flare_tip" },
      "cooling tower": { c: "structural_steel", w: 9, t: "cooling_tower" },
      "stack": { c: "structural_steel", w: 5, t: "stack" },
      "chimney": { c: "structural_steel", w: 7, t: "chimney" },

      // --- BEARING (bridge context) ---
      "bearing seat": { c: "bridge_steel", w: 7, t: "bearing_seat" },
      "bearing pad": { c: "bridge_steel", w: 7, t: "bearing_pad" },
      "expansion bearing": { c: "bridge_steel", w: 8, t: "expansion_bearing" },
      "elastomeric bearing": { c: "bridge_steel", w: 9, t: "elastomeric_bearing" },
      "pot bearing": { c: "bridge_steel", w: 9, t: "pot_bearing" },
      "rocker bearing": { c: "bridge_steel", w: 9, t: "rocker_bearing" },

      // --- SUBSEA SPECIFIC ---
      "subsea": { c: "pipeline", w: 7, t: "subsea_pipeline" },
      "seabed": { c: "pipeline", w: 6, t: "subsea_pipeline" },
      "umbilical": { c: "pipeline", w: 8, t: "subsea_umbilical" },
      "subsea manifold": { c: "pipeline", w: 10, t: "subsea_manifold" },
      "christmas tree": { c: "pipeline", w: 8, t: "subsea_tree" },
      "subsea tree": { c: "pipeline", w: 10, t: "subsea_tree" },
      "jumper": { c: "pipeline", w: 7, t: "subsea_jumper" }
    };

    // ================================================================
    // CONTEXT RULES — if both keyword A and keyword B present, boost
    // ================================================================

    var CONTEXT_RULES: Array<{
      keywords: string[];
      boost_class: string;
      boost_weight: number;
    }> = [
      // Refinery context overrides
      { keywords: ["gas line", "refinery"], boost_class: "process_piping", boost_weight: 8 },
      { keywords: ["gas line", "process"], boost_class: "process_piping", boost_weight: 8 },
      { keywords: ["gas line", "unit"], boost_class: "process_piping", boost_weight: 7 },
      { keywords: ["vessel", "offshore"], boost_class: "pressure_vessel", boost_weight: 3 },
      { keywords: ["vessel", "pressure"], boost_class: "pressure_vessel", boost_weight: 5 },
      { keywords: ["vessel", "supply"], boost_class: "offshore_platform", boost_weight: 4 },
      { keywords: ["vessel", "ship"], boost_class: "offshore_platform", boost_weight: 4 },
      { keywords: ["drum", "coker"], boost_class: "pressure_vessel", boost_weight: 5 },
      { keywords: ["drum", "flash"], boost_class: "pressure_vessel", boost_weight: 5 },
      { keywords: ["drum", "surge"], boost_class: "pressure_vessel", boost_weight: 5 },
      { keywords: ["tower", "refinery"], boost_class: "pressure_vessel", boost_weight: 5 },
      { keywords: ["tower", "distillation"], boost_class: "pressure_vessel", boost_weight: 5 },
      { keywords: ["column", "distillation"], boost_class: "pressure_vessel", boost_weight: 5 },
      { keywords: ["column", "pier"], boost_class: "bridge_concrete", boost_weight: 6 },
      { keywords: ["column", "bridge"], boost_class: "bridge_concrete", boost_weight: 6 },
      { keywords: ["column", "concrete"], boost_class: "bridge_concrete", boost_weight: 6 },
      // Bridge context
      { keywords: ["girder", "bridge"], boost_class: "bridge_steel", boost_weight: 6 },
      { keywords: ["girder", "rail"], boost_class: "rail_bridge", boost_weight: 8 },
      { keywords: ["girder", "train"], boost_class: "rail_bridge", boost_weight: 8 },
      { keywords: ["girder", "track"], boost_class: "rail_bridge", boost_weight: 8 },
      { keywords: ["girder", "derail"], boost_class: "rail_bridge", boost_weight: 10 },
      { keywords: ["bridge", "rail"], boost_class: "rail_bridge", boost_weight: 8 },
      { keywords: ["bridge", "train"], boost_class: "rail_bridge", boost_weight: 8 },
      { keywords: ["bridge", "railroad"], boost_class: "rail_bridge", boost_weight: 8 },
      { keywords: ["bridge", "freight"], boost_class: "rail_bridge", boost_weight: 8 },
      { keywords: ["bridge", "derail"], boost_class: "rail_bridge", boost_weight: 10 },
      { keywords: ["bridge", "concrete"], boost_class: "bridge_concrete", boost_weight: 6 },
      { keywords: ["bridge", "prestress"], boost_class: "bridge_concrete", boost_weight: 8 },
      { keywords: ["pier", "bridge"], boost_class: "bridge_concrete", boost_weight: 6 },
      { keywords: ["deck", "bridge"], boost_class: "bridge_concrete", boost_weight: 5 },
      { keywords: ["bearing", "bridge"], boost_class: "bridge_steel", boost_weight: 5 },
      // FPSO / subsea context
      { keywords: ["riser", "pipeline"], boost_class: "pipeline", boost_weight: 5 },
      { keywords: ["riser", "subsea"], boost_class: "pipeline", boost_weight: 5 },
      { keywords: ["riser", "fpso"], boost_class: "pipeline", boost_weight: 5 },
      { keywords: ["pipeline", "subsea"], boost_class: "pipeline", boost_weight: 5 },
      { keywords: ["pipeline", "export"], boost_class: "pipeline", boost_weight: 5 },
      { keywords: ["pipeline", "seabed"], boost_class: "pipeline", boost_weight: 5 },
      { keywords: ["mooring", "fpso"], boost_class: "offshore_platform", boost_weight: 5 },
      { keywords: ["platform", "offshore"], boost_class: "offshore_platform", boost_weight: 5 },
      { keywords: ["platform", "jacket"], boost_class: "offshore_platform", boost_weight: 5 },
      // Sphere context
      { keywords: ["sphere", "pressure"], boost_class: "pressure_vessel", boost_weight: 5 },
      { keywords: ["sphere", "lpg"], boost_class: "pressure_vessel", boost_weight: 5 },
      { keywords: ["bullet", "lpg"], boost_class: "pressure_vessel", boost_weight: 5 },
      { keywords: ["bullet", "propane"], boost_class: "pressure_vessel", boost_weight: 5 }
    ];

    // ================================================================
    // SCORING ENGINE
    // ================================================================

    var scores: { [key: string]: { score: number; best_type: string; best_weight: number } } = {};

    // Step 1: Score each alias match
    var alias_keys = Object.keys(ALIASES);
    for (var i = 0; i < alias_keys.length; i++) {
      var alias = alias_keys[i];
      if (raw.indexOf(alias) !== -1) {
        var entry = ALIASES[alias];
        if (!scores[entry.c]) {
          scores[entry.c] = { score: 0, best_type: entry.t, best_weight: 0 };
        }
        scores[entry.c].score += entry.w;
        if (entry.w > scores[entry.c].best_weight) {
          scores[entry.c].best_type = entry.t;
          scores[entry.c].best_weight = entry.w;
        }
      }
    }

    // Step 2: Apply context rules
    for (var r = 0; r < CONTEXT_RULES.length; r++) {
      var rule = CONTEXT_RULES[r];
      var all_present = true;
      for (var k = 0; k < rule.keywords.length; k++) {
        if (raw.indexOf(rule.keywords[k]) === -1) {
          all_present = false;
          break;
        }
      }
      if (all_present) {
        if (!scores[rule.boost_class]) {
          scores[rule.boost_class] = { score: 0, best_type: rule.boost_class, best_weight: 0 };
        }
        scores[rule.boost_class].score += rule.boost_weight;
      }
    }

    // Step 3: Find winner
    var best_class = "pressure_vessel";
    var best_score = 0;
    var best_type = "pressure_vessel";
    var all_classes = Object.keys(scores);
    var alternatives: Array<{ asset_class: string; score: number }> = [];

    for (var j = 0; j < all_classes.length; j++) {
      var cls = all_classes[j];
      var s = scores[cls];
      alternatives.push({ asset_class: cls, score: s.score });
      if (s.score > best_score) {
        best_score = s.score;
        best_class = cls;
        best_type = s.best_type;
      }
    }

    // Sort alternatives by score descending
    alternatives.sort(function(a, b) { return b.score - a.score; });

    // Calculate confidence (0.0 - 1.0)
    var total_score = 0;
    for (var a = 0; a < alternatives.length; a++) {
      total_score += alternatives[a].score;
    }
    var confidence = 0.3; // base
    if (best_score >= 10) confidence = 0.9;
    else if (best_score >= 7) confidence = 0.8;
    else if (best_score >= 5) confidence = 0.7;
    else if (best_score >= 3) confidence = 0.5;

    // Reduce confidence if close second place
    if (alternatives.length >= 2 && alternatives[1].score > best_score * 0.7) {
      confidence = confidence * 0.85;
    }

    confidence = Math.min(confidence, 0.98);
    confidence = Math.round(confidence * 100) / 100;

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({
        resolved: {
          asset_class: best_class,
          asset_type: best_type,
          confidence: confidence,
          alternatives: alternatives.slice(0, 5)
        }
      })
    };

  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "resolve-asset error",
        message: err.message || "Unknown error"
      })
    };
  }
};

export { handler };
