// @ts-nocheck
// ══════════════════════════════════════════════════════════════════════════════
// DDE MECHANISM KNOWLEDGE BASE — PRODUCTION EQUIPMENT
// 7 damage mechanisms for subsea production trees, umbilicals, mooring systems,
// and flow assurance systems.
//
// Sources: API 17D, API 17E, API 6A, API RP 2SK, API RP 2SM, API RP 14E,
//          ISO 13628-4, ISO 13628-5, ISO 13628-7, ISO 19901-7, DNV-OS-E302,
//          DNV-OS-E303, DNV-RP-O501, NORSOK M-506
//
// Indicator dimensions for production:
//   production_component, mooring_component, service_fluid, h2s_presence,
//   service_age_bracket, water_depth_range, zone_depth, wall_loss_pattern,
//   coating_condition, cp_status, current_exposure, marine_growth_grade,
//   crack_location, morphology
// ══════════════════════════════════════════════════════════════════════════════

var MECHANISMS_PRODUCTION = {

  // ── 1. TREE SEAL DEGRADATION ─────────────────────────────────────────────
  tree_seal_degradation: {
    id: "tree_seal_degradation",
    display_name: "Subsea Tree Valve/Seal Failure",
    domain: "production",
    prerequisites: {
      has_subsea_tree: true
    },
    indicators: {
      production_component: {
        tree: 0.85,
        wellhead: 0.10,
        manifold: 0.03,
        connector: 0.02
      },
      h2s_presence: {
        high: 0.60,
        moderate: 0.20,
        trace: 0.10,
        none: 0.10
      },
      service_age_bracket: {
        new_lt_5yr: 0.10,
        mid_5_15yr: 0.25,
        aging_15_25yr: 0.45,
        elderly_gt_25yr: 0.20
      },
      wall_loss_pattern: {
        uniform: 0.35,
        pitting: 0.30,
        localized_blistering: 0.20,
        grooving: 0.10,
        none_visible: 0.05
      },
      water_depth_range: {
        shallow_lt_30m: 0.05,
        moderate_30_100m: 0.15,
        deep_100_500m: 0.50,
        ultra_deep_gt_500m: 0.30
      }
    },
    synergistic_with: ["umbilical_armor_corrosion", "connector_make_break_fatigue"],
    competes_with: ["flow_erosion_sand", "hydrate_wax_blockage"],
    severity_default: "high",
    typical_consequence: "tree_valve_seal_extrusion_loss_of_flow_control",
    code_reference: "API 17D, API 6A, ISO 13628-4"
  },

  // ── 2. UMBILICAL ARMOR CORROSION ─────────────────────────────────────────
  umbilical_armor_corrosion: {
    id: "umbilical_armor_corrosion",
    display_name: "Umbilical Armor Wire Corrosion and Degradation",
    domain: "production",
    prerequisites: {
      has_umbilical: true
    },
    indicators: {
      production_component: {
        umbilical: 0.90,
        connector: 0.07,
        jumper: 0.02,
        flowline: 0.01
      },
      coating_condition: {
        failed: 0.65,
        degraded: 0.25,
        intact: 0.07,
        absent: 0.03
      },
      water_depth_range: {
        shallow_lt_30m: 0.10,
        moderate_30_100m: 0.20,
        deep_100_500m: 0.45,
        ultra_deep_gt_500m: 0.25
      },
      service_age_bracket: {
        new_lt_5yr: 0.12,
        mid_5_15yr: 0.28,
        aging_15_25yr: 0.40,
        elderly_gt_25yr: 0.20
      },
      current_exposure: {
        high_current: 0.35,
        moderate_current: 0.30,
        low_current: 0.20,
        sheltered: 0.15
      }
    },
    synergistic_with: ["tree_seal_degradation", "flow_erosion_sand"],
    competes_with: ["synthetic_rope_creep"],
    severity_default: "high",
    typical_consequence: "armor_wire_loss_hydraulic_line_failure_signal_attenuation",
    code_reference: "API 17E, ISO 13628-5, DNV-OS-E302"
  },

  // ── 3. CONNECTOR MAKE-BREAK FATIGUE ──────────────────────────────────────
  connector_make_break_fatigue: {
    id: "connector_make_break_fatigue",
    display_name: "Hub/Clamp Connector Fatigue from Make-Break Cycles",
    domain: "production",
    prerequisites: {
      has_subsea_connectors: true
    },
    indicators: {
      production_component: {
        connector: 0.85,
        jumper: 0.10,
        manifold: 0.03,
        umbilical: 0.02
      },
      service_age_bracket: {
        new_lt_5yr: 0.15,
        mid_5_15yr: 0.30,
        aging_15_25yr: 0.35,
        elderly_gt_25yr: 0.20
      },
      crack_location: {
        weld_toe: 0.50,
        weld_root: 0.20,
        od_surface: 0.15,
        id_surface: 0.10,
        mid_wall: 0.05
      },
      morphology: {
        transgranular: 0.55,
        single_planar: 0.25,
        branched: 0.10,
        intergranular: 0.05,
        stepwise_blistering: 0.05
      }
    },
    synergistic_with: ["tree_seal_degradation", "umbilical_armor_corrosion"],
    competes_with: ["mooring_chain_fatigue"],
    severity_default: "high",
    typical_consequence: "connector_clamp_fatigue_crack_seal_loss_spillage",
    code_reference: "API 17D, API 6A, ISO 13628-7"
  },

  // ── 4. MOORING CHAIN FATIGUE ────────────────────────────────────────────
  mooring_chain_fatigue: {
    id: "mooring_chain_fatigue",
    display_name: "Mooring Chain Link Fatigue and Diameter Loss",
    domain: "production",
    prerequisites: {
      has_mooring_system: true
    },
    indicators: {
      mooring_component: {
        chain: 0.88,
        wire_rope: 0.08,
        anchor: 0.02,
        fairlead: 0.02
      },
      zone_depth: {
        splash_zone: 0.45,
        tidal_zone: 0.25,
        submerged: 0.20,
        mudline: 0.07,
        buried: 0.03
      },
      cp_status: {
        inadequate: 0.60,
        marginal: 0.20,
        adequate: 0.10,
        overprotected: 0.10
      },
      current_exposure: {
        high_current: 0.50,
        moderate_current: 0.30,
        low_current: 0.15,
        sheltered: 0.05
      },
      service_age_bracket: {
        new_lt_5yr: 0.08,
        mid_5_15yr: 0.22,
        aging_15_25yr: 0.45,
        elderly_gt_25yr: 0.25
      }
    },
    synergistic_with: ["synthetic_rope_creep"],
    competes_with: ["connector_make_break_fatigue"],
    severity_default: "high",
    typical_consequence: "chain_link_diameter_loss_interlink_wear_mooring_failure",
    code_reference: "API RP 2SK, DNV-OS-E302, IACS UR A"
  },

  // ── 5. SYNTHETIC ROPE CREEP ─────────────────────────────────────────────
  synthetic_rope_creep: {
    id: "synthetic_rope_creep",
    display_name: "HMPE/Polyester Mooring Rope Creep and Degradation",
    domain: "production",
    prerequisites: {
      has_synthetic_mooring: true
    },
    indicators: {
      mooring_component: {
        synthetic_rope: 0.90,
        wire_rope: 0.06,
        chain: 0.02,
        connector_mooring: 0.02
      },
      service_age_bracket: {
        new_lt_5yr: 0.12,
        mid_5_15yr: 0.30,
        aging_15_25yr: 0.38,
        elderly_gt_25yr: 0.20
      },
      current_exposure: {
        high_current: 0.45,
        moderate_current: 0.30,
        low_current: 0.20,
        sheltered: 0.05
      },
      marine_growth_grade: {
        heavy: 0.50,
        moderate: 0.25,
        light: 0.15,
        none: 0.10
      }
    },
    synergistic_with: ["mooring_chain_fatigue"],
    competes_with: ["umbilical_armor_corrosion"],
    severity_default: "high",
    typical_consequence: "rope_creep_uv_degradation_strength_loss_abrasion",
    code_reference: "API RP 2SM, DNV-OS-E303, ISO 19901-7"
  },

  // ── 6. FLOW EROSION / SAND ──────────────────────────────────────────────
  flow_erosion_sand: {
    id: "flow_erosion_sand",
    display_name: "Sand Erosion in Subsea Flowlines and Manifolds",
    domain: "production",
    prerequisites: {
      has_production_flow: true,
      sand_production_present: true
    },
    indicators: {
      production_component: {
        manifold: 0.45,
        jumper: 0.30,
        flowline: 0.20,
        wellhead: 0.05
      },
      wall_loss_pattern: {
        grooving: 0.50,
        pitting: 0.20,
        uniform: 0.15,
        localized_blistering: 0.10,
        none_visible: 0.05
      },
      service_fluid: {
        multiphase: 0.50,
        oil: 0.20,
        gas: 0.15,
        condensate: 0.10,
        water: 0.05
      },
      water_depth_range: {
        shallow_lt_30m: 0.08,
        moderate_30_100m: 0.22,
        deep_100_500m: 0.45,
        ultra_deep_gt_500m: 0.25
      }
    },
    synergistic_with: ["umbilical_armor_corrosion", "hydrate_wax_blockage"],
    competes_with: ["tree_seal_degradation"],
    severity_default: "high",
    typical_consequence: "manifold_header_bend_erosion_wall_perforation_leakage",
    code_reference: "API RP 14E, DNV-RP-O501, NORSOK M-506"
  },

  // ── 7. HYDRATE / WAX BLOCKAGE ───────────────────────────────────────────
  hydrate_wax_blockage: {
    id: "hydrate_wax_blockage",
    display_name: "Hydrate Formation and Wax Deposition Blockage",
    domain: "production",
    prerequisites: {
      has_production_flow: true,
      subsea_temperature_conditions: true
    },
    indicators: {
      production_component: {
        flowline: 0.50,
        jumper: 0.25,
        manifold: 0.15,
        tree: 0.10
      },
      service_fluid: {
        gas: 0.45,
        condensate: 0.25,
        multiphase: 0.20,
        oil: 0.08,
        water: 0.02
      },
      water_depth_range: {
        shallow_lt_30m: 0.02,
        moderate_30_100m: 0.08,
        deep_100_500m: 0.45,
        ultra_deep_gt_500m: 0.45
      },
      service_age_bracket: {
        new_lt_5yr: 0.15,
        mid_5_15yr: 0.30,
        aging_15_25yr: 0.35,
        elderly_gt_25yr: 0.20
      }
    },
    synergistic_with: ["flow_erosion_sand"],
    competes_with: ["tree_seal_degradation", "umbilical_armor_corrosion"],
    severity_default: "high",
    typical_consequence: "complete_flow_blockage_production_shutdown_remedial_heater_cost",
    code_reference: "API RP 14E, API 17A, ISO 13628-1"
  }
};

export { MECHANISMS_PRODUCTION };
