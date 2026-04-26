// @ts-nocheck
// ══════════════════════════════════════════════════════════════════════════════
// DDE MECHANISM KNOWLEDGE BASE — FLOATING PRODUCTION PLATFORMS
// 8 damage mechanisms for FPSO, TLP, Semi-Sub, SPAR, FLNG, FSO, MODU
//
// Sources: DNV-OS-C102, DNV-OS-C103, DNV-OS-C105, DNV-OS-C106, API RP 2FPS,
//          API RP 2T, IACS UR S-11, ISO 19904-1, DNV-RP-C203
//
// Indicator dimensions for floating:
//   platform_type, structural_zone, service_age_bracket, crack_orientation,
//   crack_location, morphology, wall_loss_pattern, coating_condition,
//   cp_status, current_exposure, zone_depth
// ══════════════════════════════════════════════════════════════════════════════

var MECHANISMS_FLOATING = {

  // ── 1. HULL FATIGUE (FPSO) ────────────────────────────────────────────────
  hull_fatigue_fpso: {
    id: "hull_fatigue_fpso",
    display_name: "FPSO Hull Structural Fatigue — Hogging/Sagging Cycles",
    domain: "floating",
    prerequisites: {
      platform_type: ["fpso", "fso", "flng"],
      wave_loading_present: true
    },
    indicators: {
      crack_orientation: {
        circumferential: 0.55,
        axial: 0.20,
        perpendicular_to_plate: 0.15,
        parallel_to_plate: 0.05,
        random: 0.05
      },
      crack_location: {
        weld_toe: 0.50,
        weld_root: 0.15,
        od_surface: 0.20,
        id_surface: 0.05,
        mid_wall: 0.10
      },
      morphology: {
        transgranular: 0.65,
        single_planar: 0.20,
        branched: 0.05,
        intergranular: 0.05,
        stepwise_blistering: 0.05
      },
      structural_zone: {
        side_shell: 0.35,
        bottom_plating: 0.30,
        main_deck: 0.20,
        topside_support: 0.10,
        column: 0.05
      },
      platform_type: {
        fpso: 0.50,
        fso: 0.25,
        flng: 0.20,
        semi_sub: 0.03,
        tlp: 0.02
      }
    },
    synergistic_with: ["green_water_damage", "motion_induced_fatigue"],
    competes_with: ["column_plate_buckling"],
    severity_default: "high",
    typical_consequence: "fatigue_crack_initiation_at_welds_midship",
    code_reference: "DNV-OS-C102, IACS UR S-11, API RP 2FPS"
  },

  // ── 2. TURRET BEARING WEAR ─────────────────────────────────────────────────
  turret_bearing_wear: {
    id: "turret_bearing_wear",
    display_name: "Turret/Swivel Bearing Degradation and Seal Failure",
    domain: "floating",
    prerequisites: {
      has_turret_system: true
    },
    indicators: {
      platform_type: {
        fpso: 0.60,
        flng: 0.25,
        fso: 0.10,
        semi_sub: 0.03,
        spar: 0.02
      },
      service_age_bracket: {
        elderly_gt_25yr: 0.45,
        aging_15_25yr: 0.30,
        mid_5_15yr: 0.18,
        new_lt_5yr: 0.07
      },
      wall_loss_pattern: {
        localized_blistering: 0.40,
        uniform: 0.25,
        grooving: 0.20,
        pitting: 0.10,
        none_visible: 0.05
      },
      coating_condition: {
        failed: 0.50,
        degraded: 0.30,
        intact: 0.12,
        absent: 0.08
      }
    },
    synergistic_with: ["internal_corrosion_fpso", "hull_fatigue_fpso"],
    competes_with: ["topside_interface_cracking"],
    severity_default: "high",
    typical_consequence: "bearing_swivel_degradation_rotation_impedance",
    code_reference: "API RP 2FPS, DNV-OS-C102"
  },

  // ── 3. TENDON FATIGUE (TLP) ────────────────────────────────────────────────
  tendon_fatigue_tlp: {
    id: "tendon_fatigue_tlp",
    display_name: "TLP Tendon Fatigue and Corrosion-Fatigue",
    domain: "floating",
    prerequisites: {
      platform_type: ["tlp"]
    },
    indicators: {
      crack_orientation: {
        circumferential: 0.60,
        axial: 0.20,
        perpendicular_to_plate: 0.10,
        parallel_to_plate: 0.05,
        random: 0.05
      },
      crack_location: {
        weld_toe: 0.55,
        weld_root: 0.20,
        od_surface: 0.15,
        id_surface: 0.05,
        mid_wall: 0.05
      },
      morphology: {
        transgranular: 0.70,
        single_planar: 0.15,
        branched: 0.05,
        intergranular: 0.05,
        stepwise_blistering: 0.05
      },
      cp_status: {
        inadequate: 0.50,
        marginal: 0.25,
        adequate: 0.15,
        overprotected: 0.10
      },
      current_exposure: {
        high_current: 0.40,
        moderate_current: 0.35,
        low_current: 0.18,
        sheltered: 0.07
      }
    },
    synergistic_with: ["motion_induced_fatigue"],
    competes_with: ["hull_fatigue_fpso"],
    severity_default: "high",
    typical_consequence: "tendon_fatigue_crack_tension_loss",
    code_reference: "API RP 2T, DNV-OS-C105"
  },

  // ── 4. GREEN WATER DAMAGE ─────────────────────────────────────────────────
  green_water_damage: {
    id: "green_water_damage",
    display_name: "Green Water Impact Loading — Deck and Topside Structures",
    domain: "floating",
    prerequisites: {
      wave_loading_present: true,
      has_exposed_deck: true
    },
    indicators: {
      structural_zone: {
        bow_area: 0.50,
        main_deck: 0.30,
        topside_support: 0.12,
        side_shell: 0.05,
        column: 0.03
      },
      platform_type: {
        fpso: 0.40,
        semi_sub: 0.35,
        fso: 0.12,
        flng: 0.08,
        spar: 0.03,
        tlp: 0.02
      },
      wall_loss_pattern: {
        localized_blistering: 0.45,
        grooving: 0.25,
        uniform: 0.15,
        pitting: 0.10,
        none_visible: 0.05
      },
      coating_condition: {
        failed: 0.55,
        degraded: 0.25,
        intact: 0.12,
        absent: 0.08
      }
    },
    synergistic_with: ["hull_fatigue_fpso", "topside_interface_cracking"],
    competes_with: ["motion_induced_fatigue"],
    severity_default: "high",
    typical_consequence: "dent_plastic_deformation_impact_damage",
    code_reference: "DNV-OS-C102, API RP 2FPS"
  },

  // ── 5. COLUMN PLATE BUCKLING ──────────────────────────────────────────────
  column_plate_buckling: {
    id: "column_plate_buckling",
    display_name: "Hull/Column/Pontoon Plate Buckling",
    domain: "floating",
    prerequisites: {
      has_column_structure: true
    },
    indicators: {
      structural_zone: {
        column: 0.55,
        pontoon: 0.25,
        bottom_plating: 0.12,
        side_shell: 0.05,
        main_deck: 0.03
      },
      platform_type: {
        semi_sub: 0.45,
        spar: 0.30,
        tlp: 0.15,
        fpso: 0.05,
        flng: 0.05
      },
      wall_loss_pattern: {
        localized_blistering: 0.35,
        uniform: 0.30,
        pitting: 0.20,
        grooving: 0.10,
        none_visible: 0.05
      },
      crack_orientation: {
        perpendicular_to_plate: 0.45,
        circumferential: 0.30,
        axial: 0.15,
        parallel_to_plate: 0.05,
        random: 0.05
      }
    },
    synergistic_with: ["motion_induced_fatigue"],
    competes_with: ["hull_fatigue_fpso"],
    severity_default: "high",
    typical_consequence: "local_buckling_column_compression_failure",
    code_reference: "DNV-OS-C103, DNV-OS-C106, API RP 2T"
  },

  // ── 6. MOTION-INDUCED FATIGUE ─────────────────────────────────────────────
  motion_induced_fatigue: {
    id: "motion_induced_fatigue",
    display_name: "Motion-Induced Fatigue — Springing, Whipping, Slamming, VIM",
    domain: "floating",
    prerequisites: {
      wave_loading_present: true
    },
    indicators: {
      crack_orientation: {
        circumferential: 0.50,
        perpendicular_to_plate: 0.25,
        axial: 0.12,
        parallel_to_plate: 0.08,
        random: 0.05
      },
      crack_location: {
        weld_toe: 0.48,
        od_surface: 0.20,
        weld_root: 0.18,
        mid_wall: 0.08,
        id_surface: 0.06
      },
      morphology: {
        transgranular: 0.60,
        single_planar: 0.25,
        branched: 0.08,
        intergranular: 0.04,
        stepwise_blistering: 0.03
      },
      platform_type: {
        spar: 0.35,
        semi_sub: 0.30,
        fpso: 0.20,
        tlp: 0.10,
        flng: 0.05
      },
      current_exposure: {
        high_current: 0.35,
        moderate_current: 0.35,
        low_current: 0.20,
        sheltered: 0.10
      }
    },
    synergistic_with: ["hull_fatigue_fpso", "tendon_fatigue_tlp"],
    competes_with: ["column_plate_buckling"],
    severity_default: "high",
    typical_consequence: "high_cycle_fatigue_springing_slamming_loads",
    code_reference: "DNV-OS-C106, API RP 2FPS, DNV-RP-C203"
  },

  // ── 7. TOPSIDE INTERFACE CRACKING ──────────────────────────────────────────
  topside_interface_cracking: {
    id: "topside_interface_cracking",
    display_name: "Topside Interface Cracking — Hull-to-Module Connections",
    domain: "floating",
    prerequisites: {
      has_topside_modules: true
    },
    indicators: {
      crack_orientation: {
        circumferential: 0.40,
        perpendicular_to_plate: 0.35,
        axial: 0.15,
        parallel_to_plate: 0.05,
        random: 0.05
      },
      crack_location: {
        weld_toe: 0.60,
        weld_root: 0.15,
        od_surface: 0.12,
        id_surface: 0.07,
        mid_wall: 0.06
      },
      morphology: {
        transgranular: 0.55,
        single_planar: 0.30,
        branched: 0.08,
        intergranular: 0.04,
        stepwise_blistering: 0.03
      },
      structural_zone: {
        topside_support: 0.50,
        main_deck: 0.30,
        side_shell: 0.12,
        column: 0.05,
        bottom_plating: 0.03
      }
    },
    synergistic_with: ["green_water_damage", "motion_induced_fatigue"],
    competes_with: ["hull_fatigue_fpso"],
    severity_default: "medium",
    typical_consequence: "module_support_stool_crack_initiation",
    code_reference: "DNV-OS-C101, API RP 2FPS, ISO 19904-1"
  },

  // ── 8. INTERNAL CORROSION (FPSO) ───────────────────────────────────────────
  internal_corrosion_fpso: {
    id: "internal_corrosion_fpso",
    display_name: "Internal Corrosion — Cargo/Ballast Tanks (FPSO/FSO)",
    domain: "floating",
    prerequisites: {
      has_cargo_tanks: true,
      platform_type: ["fpso", "fso"]
    },
    indicators: {
      wall_loss_pattern: {
        uniform: 0.45,
        pitting: 0.30,
        localized_blistering: 0.15,
        grooving: 0.05,
        none_visible: 0.05
      },
      coating_condition: {
        failed: 0.65,
        degraded: 0.20,
        intact: 0.10,
        absent: 0.05
      },
      zone_depth: {
        bottom_plating: 0.50,
        mudline: 0.20,
        submerged: 0.18,
        tidal_zone: 0.07,
        splash_zone: 0.05
      },
      structural_zone: {
        bottom_plating: 0.55,
        side_shell: 0.25,
        column: 0.12,
        pontoon: 0.05,
        main_deck: 0.03
      }
    },
    synergistic_with: ["turret_bearing_wear"],
    competes_with: ["green_water_damage"],
    severity_default: "high",
    typical_consequence: "tank_wall_thinning_hydrocarbon_containment_risk",
    code_reference: "IACS UR S-31/S-32, DNV Rules for Ships"
  }
};

export { MECHANISMS_FLOATING };
