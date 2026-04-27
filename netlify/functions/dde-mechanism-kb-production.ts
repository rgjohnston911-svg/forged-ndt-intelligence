// @ts-nocheck
// ══════════════════════════════════════════════════════════════════════════════
// DDE MECHANISM KNOWLEDGE BASE — PRODUCTION EQUIPMENT
// 25 damage mechanisms for subsea production trees, umbilicals, mooring systems,
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
  },

  // ── 8. XMAS TREE VALVE EROSION ──────────────────────────────────────────
  xmas_tree_valve_erosion: {
    id: "xmas_tree_valve_erosion",
    display_name: "Xmas Tree Valve Body Erosion from Sand-Laden Flow",
    domain: "production",
    prerequisites: {
      has_subsea_tree: true,
      sand_production_present: true
    },
    indicators: {
      production_component: {
        tree: 0.80,
        wellhead: 0.10,
        manifold: 0.07,
        connector: 0.03
      },
      service_fluid: {
        multiphase: 0.45,
        oil: 0.20,
        gas: 0.18,
        condensate: 0.12,
        water: 0.05
      },
      wall_loss_pattern: {
        grooving: 0.45,
        pitting: 0.25,
        uniform: 0.15,
        localized_blistering: 0.10,
        none_visible: 0.05
      },
      service_age_bracket: {
        elderly_gt_25yr: 0.30,
        aging_15_25yr: 0.35,
        mid_5_15yr: 0.25,
        new_lt_5yr: 0.10
      },
      water_depth_range: {
        shallow_lt_30m: 0.05,
        moderate_30_100m: 0.15,
        deep_100_500m: 0.50,
        ultra_deep_gt_500m: 0.30
      }
    },
    synergistic_with: ["flow_erosion_sand", "tree_seal_degradation"],
    competes_with: ["hydrate_wax_blockage"],
    severity_default: "high",
    typical_consequence: "valve_body_erosion_loss_of_containment",
    code_reference: "API 17D, API 6A, DNV-RP-O501"
  },

  // ── 9. UMBILICAL HYDRAULIC FATIGUE ──────────────────────────────────────
  umbilical_hydraulic_fatigue: {
    id: "umbilical_hydraulic_fatigue",
    display_name: "Umbilical Hydraulic Tube Fatigue from Pressure Cycling",
    domain: "production",
    prerequisites: {
      has_umbilical: true
    },
    indicators: {
      production_component: {
        umbilical: 0.85,
        connector: 0.08,
        tree: 0.04,
        manifold: 0.03
      },
      service_age_bracket: {
        elderly_gt_25yr: 0.30,
        aging_15_25yr: 0.35,
        mid_5_15yr: 0.25,
        new_lt_5yr: 0.10
      },
      water_depth_range: {
        shallow_lt_30m: 0.05,
        moderate_30_100m: 0.15,
        deep_100_500m: 0.50,
        ultra_deep_gt_500m: 0.30
      },
      current_exposure: {
        high_current: 0.40,
        moderate_current: 0.30,
        low_current: 0.20,
        sheltered: 0.10
      },
      morphology: {
        transgranular: 0.55,
        single_planar: 0.25,
        branched: 0.10,
        intergranular: 0.06,
        stepwise_blistering: 0.04
      }
    },
    synergistic_with: ["umbilical_armor_corrosion"],
    competes_with: ["connector_make_break_fatigue"],
    severity_default: "high",
    typical_consequence: "hydraulic_tube_fatigue_crack_loss_of_control",
    code_reference: "API 17E, ISO 13628-5"
  },

  // ── 10. FLOWLINE INTERNAL CORROSION ─────────────────────────────────────
  flowline_internal_corrosion: {
    id: "flowline_internal_corrosion",
    display_name: "Flowline/Pipeline Internal Corrosion (CO2/H2S)",
    domain: "production",
    prerequisites: {
      has_production_flow: true
    },
    indicators: {
      production_component: {
        flowline: 0.75,
        jumper: 0.12,
        manifold: 0.08,
        tree: 0.05
      },
      h2s_presence: {
        high: 0.50,
        moderate: 0.25,
        trace: 0.15,
        none: 0.10
      },
      service_fluid: {
        multiphase: 0.40,
        water: 0.25,
        oil: 0.15,
        gas: 0.12,
        condensate: 0.08
      },
      wall_loss_pattern: {
        uniform: 0.35,
        pitting: 0.30,
        grooving: 0.20,
        localized_blistering: 0.10,
        none_visible: 0.05
      },
      water_depth_range: {
        shallow_lt_30m: 0.08,
        moderate_30_100m: 0.22,
        deep_100_500m: 0.45,
        ultra_deep_gt_500m: 0.25
      }
    },
    synergistic_with: ["flow_erosion_sand", "hydrate_wax_blockage"],
    competes_with: ["tree_seal_degradation"],
    severity_default: "high",
    typical_consequence: "flowline_wall_thinning_leak_before_break",
    code_reference: "NORSOK M-506, DNV-RP-F101"
  },

  // ── 11. HIPPS VALVE RELIABILITY ─────────────────────────────────────────
  hipps_valve_reliability: {
    id: "hipps_valve_reliability",
    display_name: "HIPPS Valve Reliability Degradation",
    domain: "production",
    prerequisites: {
      has_hipps: true
    },
    indicators: {
      production_component: {
        tree: 0.50,
        manifold: 0.25,
        flowline: 0.15,
        wellhead: 0.10
      },
      service_age_bracket: {
        elderly_gt_25yr: 0.35,
        aging_15_25yr: 0.30,
        mid_5_15yr: 0.25,
        new_lt_5yr: 0.10
      },
      h2s_presence: {
        high: 0.45,
        moderate: 0.25,
        trace: 0.18,
        none: 0.12
      },
      service_fluid: {
        multiphase: 0.40,
        gas: 0.25,
        oil: 0.15,
        condensate: 0.12,
        water: 0.08
      },
      water_depth_range: {
        shallow_lt_30m: 0.05,
        moderate_30_100m: 0.10,
        deep_100_500m: 0.50,
        ultra_deep_gt_500m: 0.35
      }
    },
    synergistic_with: ["tree_seal_degradation", "flowline_internal_corrosion"],
    competes_with: ["hydrate_wax_blockage"],
    severity_default: "high",
    typical_consequence: "hipps_spurious_trip_or_failure_to_close",
    code_reference: "API 17O, IEC 61508/61511"
  },

  // ── 12. SUBSEA PUMP DEGRADATION ────────────────────────────────────────
  subsea_pump_degradation: {
    id: "subsea_pump_degradation",
    display_name: "Subsea Pump Impeller and Bearing Degradation",
    domain: "production",
    prerequisites: {
      has_subsea_pump: true
    },
    indicators: {
      production_component: {
        tree: 0.35,
        manifold: 0.30,
        flowline: 0.20,
        connector: 0.15
      },
      service_fluid: {
        multiphase: 0.45,
        water: 0.20,
        oil: 0.18,
        gas: 0.12,
        condensate: 0.05
      },
      service_age_bracket: {
        elderly_gt_25yr: 0.25,
        aging_15_25yr: 0.35,
        mid_5_15yr: 0.30,
        new_lt_5yr: 0.10
      },
      wall_loss_pattern: {
        grooving: 0.40,
        pitting: 0.25,
        uniform: 0.20,
        localized_blistering: 0.10,
        none_visible: 0.05
      },
      water_depth_range: {
        shallow_lt_30m: 0.03,
        moderate_30_100m: 0.12,
        deep_100_500m: 0.50,
        ultra_deep_gt_500m: 0.35
      }
    },
    synergistic_with: ["flow_erosion_sand"],
    competes_with: ["hydrate_wax_blockage"],
    severity_default: "high",
    typical_consequence: "pump_impeller_erosion_bearing_failure",
    code_reference: "API 17O, ISO 13628-6"
  },

  // ── 13. HYDRAULIC FLUID CONTAMINATION ──────────────────────────────────
  hydraulic_fluid_contamination: {
    id: "hydraulic_fluid_contamination",
    display_name: "Hydraulic Control Fluid Contamination and System Degradation",
    domain: "production",
    prerequisites: {
      has_hydraulic_control: true
    },
    indicators: {
      production_component: {
        umbilical: 0.45,
        tree: 0.30,
        manifold: 0.15,
        connector: 0.10
      },
      service_age_bracket: {
        elderly_gt_25yr: 0.30,
        aging_15_25yr: 0.35,
        mid_5_15yr: 0.25,
        new_lt_5yr: 0.10
      },
      water_depth_range: {
        shallow_lt_30m: 0.05,
        moderate_30_100m: 0.15,
        deep_100_500m: 0.50,
        ultra_deep_gt_500m: 0.30
      },
      h2s_presence: {
        high: 0.35,
        moderate: 0.30,
        trace: 0.20,
        none: 0.15
      }
    },
    synergistic_with: ["umbilical_armor_corrosion", "tree_seal_degradation"],
    competes_with: ["connector_make_break_fatigue"],
    severity_default: "medium",
    typical_consequence: "hydraulic_fluid_degradation_slow_valve_response",
    code_reference: "API 17F, ISO 13628-6"
  },

  // ── 14. MANIFOLD GASKET DEGRADATION ────────────────────────────────────
  manifold_gasket_degradation: {
    id: "manifold_gasket_degradation",
    display_name: "Manifold Hub Gasket Degradation and Leakage",
    domain: "production",
    prerequisites: {
      has_manifold: true
    },
    indicators: {
      production_component: {
        manifold: 0.75,
        connector: 0.12,
        tree: 0.08,
        jumper: 0.05
      },
      service_age_bracket: {
        elderly_gt_25yr: 0.35,
        aging_15_25yr: 0.30,
        mid_5_15yr: 0.25,
        new_lt_5yr: 0.10
      },
      h2s_presence: {
        high: 0.45,
        moderate: 0.25,
        trace: 0.18,
        none: 0.12
      },
      wall_loss_pattern: {
        pitting: 0.35,
        grooving: 0.25,
        localized_blistering: 0.20,
        uniform: 0.15,
        none_visible: 0.05
      },
      water_depth_range: {
        shallow_lt_30m: 0.05,
        moderate_30_100m: 0.15,
        deep_100_500m: 0.50,
        ultra_deep_gt_500m: 0.30
      }
    },
    synergistic_with: ["flowline_internal_corrosion"],
    competes_with: ["tree_seal_degradation"],
    severity_default: "high",
    typical_consequence: "gasket_extrusion_manifold_hub_leak",
    code_reference: "API 17D, API 6A"
  },

  // ── 15. PLET FATIGUE ────────────────────────────────────────────────────
  plet_fatigue: {
    id: "plet_fatigue",
    display_name: "Pipeline End Termination (PLET) Structural Fatigue",
    domain: "production",
    prerequisites: {
      has_plet: true
    },
    indicators: {
      production_component: {
        connector: 0.45,
        flowline: 0.30,
        manifold: 0.15,
        jumper: 0.10
      },
      crack_location: {
        weld_toe: 0.50,
        od_surface: 0.20,
        weld_root: 0.15,
        mid_wall: 0.10,
        id_surface: 0.05
      },
      morphology: {
        transgranular: 0.55,
        single_planar: 0.25,
        branched: 0.10,
        intergranular: 0.06,
        stepwise_blistering: 0.04
      },
      current_exposure: {
        high_current: 0.40,
        moderate_current: 0.30,
        low_current: 0.20,
        sheltered: 0.10
      },
      water_depth_range: {
        shallow_lt_30m: 0.05,
        moderate_30_100m: 0.15,
        deep_100_500m: 0.50,
        ultra_deep_gt_500m: 0.30
      }
    },
    synergistic_with: ["flowline_internal_corrosion", "connector_make_break_fatigue"],
    competes_with: ["mooring_chain_fatigue"],
    severity_default: "medium",
    typical_consequence: "plet_structural_fatigue_crack_leak",
    code_reference: "DNV-OS-F101, API 17D"
  },

  // ── 16. JUMPER CONNECTOR FATIGUE ───────────────────────────────────────
  jumper_connector_fatigue: {
    id: "jumper_connector_fatigue",
    display_name: "Rigid/Flexible Jumper Connector Fatigue",
    domain: "production",
    prerequisites: {
      has_jumper: true
    },
    indicators: {
      production_component: {
        jumper: 0.75,
        connector: 0.15,
        manifold: 0.07,
        flowline: 0.03
      },
      crack_location: {
        weld_toe: 0.50,
        od_surface: 0.20,
        weld_root: 0.15,
        mid_wall: 0.10,
        id_surface: 0.05
      },
      morphology: {
        transgranular: 0.55,
        single_planar: 0.25,
        branched: 0.10,
        intergranular: 0.06,
        stepwise_blistering: 0.04
      },
      service_age_bracket: {
        elderly_gt_25yr: 0.30,
        aging_15_25yr: 0.35,
        mid_5_15yr: 0.25,
        new_lt_5yr: 0.10
      },
      current_exposure: {
        high_current: 0.35,
        moderate_current: 0.30,
        low_current: 0.25,
        sheltered: 0.10
      }
    },
    synergistic_with: ["connector_make_break_fatigue", "plet_fatigue"],
    competes_with: ["flow_erosion_sand"],
    severity_default: "high",
    typical_consequence: "jumper_end_fitting_fatigue_leak",
    code_reference: "API 17D, API 17J"
  },

  // ── 17. CHEMICAL INJECTION BLOCKAGE ────────────────────────────────────
  chemical_injection_blockage: {
    id: "chemical_injection_blockage",
    display_name: "Chemical Injection Line Blockage and Scaling",
    domain: "production",
    prerequisites: {
      has_chemical_injection: true
    },
    indicators: {
      production_component: {
        umbilical: 0.50,
        tree: 0.25,
        manifold: 0.15,
        flowline: 0.10
      },
      service_fluid: {
        water: 0.40,
        multiphase: 0.25,
        condensate: 0.15,
        gas: 0.12,
        oil: 0.08
      },
      service_age_bracket: {
        elderly_gt_25yr: 0.30,
        aging_15_25yr: 0.30,
        mid_5_15yr: 0.30,
        new_lt_5yr: 0.10
      },
      water_depth_range: {
        shallow_lt_30m: 0.05,
        moderate_30_100m: 0.15,
        deep_100_500m: 0.50,
        ultra_deep_gt_500m: 0.30
      }
    },
    synergistic_with: ["hydrate_wax_blockage", "flowline_internal_corrosion"],
    competes_with: ["umbilical_armor_corrosion"],
    severity_default: "medium",
    typical_consequence: "injection_line_scale_blockage_loss_of_chemical_treatment",
    code_reference: "API 17E, ISO 13628-5"
  },

  // ── 18. TUBING HANGER SEAL FAILURE ─────────────────────────────────────
  tubing_hanger_seal_failure: {
    id: "tubing_hanger_seal_failure",
    display_name: "Tubing Hanger Seal Degradation and Annulus Communication",
    domain: "production",
    prerequisites: {
      has_subsea_tree: true
    },
    indicators: {
      production_component: {
        wellhead: 0.50,
        tree: 0.35,
        connector: 0.10,
        manifold: 0.05
      },
      h2s_presence: {
        high: 0.50,
        moderate: 0.25,
        trace: 0.15,
        none: 0.10
      },
      service_age_bracket: {
        elderly_gt_25yr: 0.35,
        aging_15_25yr: 0.30,
        mid_5_15yr: 0.25,
        new_lt_5yr: 0.10
      },
      service_fluid: {
        multiphase: 0.40,
        gas: 0.25,
        oil: 0.15,
        water: 0.12,
        condensate: 0.08
      },
      water_depth_range: {
        shallow_lt_30m: 0.05,
        moderate_30_100m: 0.15,
        deep_100_500m: 0.45,
        ultra_deep_gt_500m: 0.35
      }
    },
    synergistic_with: ["tree_seal_degradation", "casing_annulus_corrosion"],
    competes_with: ["connector_make_break_fatigue"],
    severity_default: "high",
    typical_consequence: "tubing_hanger_seal_leak_annulus_pressure_buildup",
    code_reference: "API 17D, API 6A"
  },

  // ── 19. WELLHEAD FATIGUE ───────────────────────────────────────────────
  wellhead_fatigue: {
    id: "wellhead_fatigue",
    display_name: "Subsea Wellhead and Conductor Fatigue",
    domain: "production",
    prerequisites: {
      has_wellhead: true
    },
    indicators: {
      production_component: {
        wellhead: 0.80,
        tree: 0.10,
        connector: 0.07,
        manifold: 0.03
      },
      crack_location: {
        weld_toe: 0.50,
        od_surface: 0.20,
        weld_root: 0.15,
        mid_wall: 0.10,
        id_surface: 0.05
      },
      current_exposure: {
        high_current: 0.40,
        moderate_current: 0.30,
        low_current: 0.20,
        sheltered: 0.10
      },
      morphology: {
        transgranular: 0.55,
        single_planar: 0.25,
        branched: 0.10,
        intergranular: 0.06,
        stepwise_blistering: 0.04
      },
      water_depth_range: {
        shallow_lt_30m: 0.03,
        moderate_30_100m: 0.12,
        deep_100_500m: 0.50,
        ultra_deep_gt_500m: 0.35
      }
    },
    synergistic_with: ["tree_seal_degradation", "tubing_hanger_seal_failure"],
    competes_with: ["mooring_chain_fatigue"],
    severity_default: "high",
    typical_consequence: "wellhead_fatigue_crack_conductor_housing_failure",
    code_reference: "API 17D, DNV-RP-E103"
  },

  // ── 20. CASING ANNULUS CORROSION ───────────────────────────────────────
  casing_annulus_corrosion: {
    id: "casing_annulus_corrosion",
    display_name: "Casing/Annulus Corrosion from Trapped Fluids",
    domain: "production",
    prerequisites: {
      has_wellhead: true
    },
    indicators: {
      production_component: {
        wellhead: 0.55,
        tree: 0.25,
        connector: 0.12,
        manifold: 0.08
      },
      h2s_presence: {
        high: 0.50,
        moderate: 0.25,
        trace: 0.15,
        none: 0.10
      },
      wall_loss_pattern: {
        pitting: 0.35,
        uniform: 0.30,
        localized_blistering: 0.20,
        grooving: 0.10,
        none_visible: 0.05
      },
      service_age_bracket: {
        elderly_gt_25yr: 0.35,
        aging_15_25yr: 0.30,
        mid_5_15yr: 0.25,
        new_lt_5yr: 0.10
      },
      water_depth_range: {
        shallow_lt_30m: 0.05,
        moderate_30_100m: 0.15,
        deep_100_500m: 0.50,
        ultra_deep_gt_500m: 0.30
      }
    },
    synergistic_with: ["tubing_hanger_seal_failure", "wellhead_fatigue"],
    competes_with: ["flowline_internal_corrosion"],
    severity_default: "high",
    typical_consequence: "casing_corrosion_annulus_pressure_well_integrity_loss",
    code_reference: "API 17D, NORSOK D-010"
  },

  // ── 21. BOP CONNECTOR FATIGUE ──────────────────────────────────────────
  bop_connector_fatigue: {
    id: "bop_connector_fatigue",
    display_name: "BOP/LMRP Connector Fatigue from Drilling Riser Motion",
    domain: "production",
    prerequisites: {
      has_bop: true
    },
    indicators: {
      production_component: {
        connector: 0.60,
        wellhead: 0.25,
        tree: 0.10,
        manifold: 0.05
      },
      crack_location: {
        weld_toe: 0.45,
        od_surface: 0.25,
        weld_root: 0.15,
        mid_wall: 0.10,
        id_surface: 0.05
      },
      morphology: {
        transgranular: 0.55,
        single_planar: 0.25,
        branched: 0.10,
        intergranular: 0.06,
        stepwise_blistering: 0.04
      },
      current_exposure: {
        high_current: 0.40,
        moderate_current: 0.30,
        low_current: 0.20,
        sheltered: 0.10
      },
      water_depth_range: {
        shallow_lt_30m: 0.03,
        moderate_30_100m: 0.12,
        deep_100_500m: 0.50,
        ultra_deep_gt_500m: 0.35
      }
    },
    synergistic_with: ["wellhead_fatigue", "connector_make_break_fatigue"],
    competes_with: ["mooring_chain_fatigue"],
    severity_default: "high",
    typical_consequence: "bop_connector_fatigue_loss_of_well_control",
    code_reference: "API 53, API 17D"
  },

  // ── 22. FLEXIBLE JUMPER ARMOR CORROSION ────────────────────────────────
  flexible_jumper_armor_corrosion: {
    id: "flexible_jumper_armor_corrosion",
    display_name: "Flexible Jumper/Riser Armor Wire Corrosion",
    domain: "production",
    prerequisites: {
      has_flexible_pipe: true
    },
    indicators: {
      production_component: {
        jumper: 0.65,
        flowline: 0.15,
        connector: 0.12,
        umbilical: 0.08
      },
      coating_condition: {
        failed: 0.55,
        degraded: 0.25,
        intact: 0.12,
        absent: 0.08
      },
      water_depth_range: {
        shallow_lt_30m: 0.05,
        moderate_30_100m: 0.15,
        deep_100_500m: 0.50,
        ultra_deep_gt_500m: 0.30
      },
      service_age_bracket: {
        elderly_gt_25yr: 0.35,
        aging_15_25yr: 0.30,
        mid_5_15yr: 0.25,
        new_lt_5yr: 0.10
      },
      current_exposure: {
        high_current: 0.35,
        moderate_current: 0.30,
        low_current: 0.25,
        sheltered: 0.10
      }
    },
    synergistic_with: ["umbilical_armor_corrosion", "flowline_internal_corrosion"],
    competes_with: ["connector_make_break_fatigue"],
    severity_default: "high",
    typical_consequence: "armor_wire_corrosion_annulus_breach_pipe_failure",
    code_reference: "API 17J, API 17B"
  },

  // ── 23. RISER BASE SPOOL FATIGUE ───────────────────────────────────────
  riser_base_spool_fatigue: {
    id: "riser_base_spool_fatigue",
    display_name: "Riser Base / Stress Joint Spool Fatigue",
    domain: "production",
    prerequisites: {
      has_riser_base: true
    },
    indicators: {
      production_component: {
        connector: 0.50,
        flowline: 0.25,
        jumper: 0.15,
        wellhead: 0.10
      },
      crack_location: {
        weld_toe: 0.50,
        od_surface: 0.20,
        weld_root: 0.15,
        mid_wall: 0.10,
        id_surface: 0.05
      },
      morphology: {
        transgranular: 0.55,
        single_planar: 0.25,
        branched: 0.10,
        intergranular: 0.06,
        stepwise_blistering: 0.04
      },
      current_exposure: {
        high_current: 0.40,
        moderate_current: 0.30,
        low_current: 0.20,
        sheltered: 0.10
      },
      water_depth_range: {
        shallow_lt_30m: 0.03,
        moderate_30_100m: 0.12,
        deep_100_500m: 0.50,
        ultra_deep_gt_500m: 0.35
      }
    },
    synergistic_with: ["wellhead_fatigue", "connector_make_break_fatigue"],
    competes_with: ["mooring_chain_fatigue"],
    severity_default: "high",
    typical_consequence: "riser_base_fatigue_crack_hydrocarbon_release",
    code_reference: "API RP 2RD, DNV-OS-F201"
  },

  // ── 24. HOT STAB CONNECTOR WEAR ────────────────────────────────────────
  hot_stab_connector_wear: {
    id: "hot_stab_connector_wear",
    display_name: "Hot Stab / ROV Interface Connector Wear",
    domain: "production",
    prerequisites: {
      has_rov_interface: true
    },
    indicators: {
      production_component: {
        connector: 0.70,
        manifold: 0.15,
        tree: 0.10,
        umbilical: 0.05
      },
      service_age_bracket: {
        elderly_gt_25yr: 0.25,
        aging_15_25yr: 0.35,
        mid_5_15yr: 0.30,
        new_lt_5yr: 0.10
      },
      water_depth_range: {
        shallow_lt_30m: 0.05,
        moderate_30_100m: 0.15,
        deep_100_500m: 0.50,
        ultra_deep_gt_500m: 0.30
      },
      wall_loss_pattern: {
        grooving: 0.40,
        pitting: 0.25,
        uniform: 0.20,
        localized_blistering: 0.10,
        none_visible: 0.05
      }
    },
    synergistic_with: ["connector_make_break_fatigue"],
    competes_with: ["tree_seal_degradation"],
    severity_default: "medium",
    typical_consequence: "hot_stab_wear_hydraulic_leak_rov_intervention_failure",
    code_reference: "API 17H, ISO 13628-8"
  },

  // ── 25. PRODUCTION CHOKE EROSION ───────────────────────────────────────
  production_choke_erosion: {
    id: "production_choke_erosion",
    display_name: "Production Choke Trim and Body Erosion",
    domain: "production",
    prerequisites: {
      has_production_choke: true
    },
    indicators: {
      production_component: {
        tree: 0.55,
        manifold: 0.20,
        flowline: 0.15,
        wellhead: 0.10
      },
      service_fluid: {
        multiphase: 0.45,
        gas: 0.20,
        oil: 0.15,
        condensate: 0.12,
        water: 0.08
      },
      wall_loss_pattern: {
        grooving: 0.50,
        pitting: 0.20,
        uniform: 0.15,
        localized_blistering: 0.10,
        none_visible: 0.05
      },
      service_age_bracket: {
        elderly_gt_25yr: 0.25,
        aging_15_25yr: 0.35,
        mid_5_15yr: 0.30,
        new_lt_5yr: 0.10
      },
      water_depth_range: {
        shallow_lt_30m: 0.05,
        moderate_30_100m: 0.15,
        deep_100_500m: 0.50,
        ultra_deep_gt_500m: 0.30
      }
    },
    synergistic_with: ["xmas_tree_valve_erosion", "flow_erosion_sand"],
    competes_with: ["hydrate_wax_blockage"],
    severity_default: "high",
    typical_consequence: "choke_trim_erosion_loss_of_flow_control",
    code_reference: "API 6A, API RP 14E, DNV-RP-O501"
  }
};

export { MECHANISMS_PRODUCTION };
