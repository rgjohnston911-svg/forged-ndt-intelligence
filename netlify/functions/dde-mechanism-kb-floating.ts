// @ts-nocheck
// ══════════════════════════════════════════════════════════════════════════════
// DDE MECHANISM KNOWLEDGE BASE — FLOATING PRODUCTION PLATFORMS
// 25 damage mechanisms for FPSO, TLP, Semi-Sub, SPAR, FLNG, FSO, MODU
//
// Sources: DNV-OS-C102, DNV-OS-C103, DNV-OS-C105, DNV-OS-C106, API RP 2FPS,
//          API RP 2T, IACS UR S-11, ISO 19904-1, DNV-RP-C203, DNV-RP-D101,
//          API 579-1, BV NR 604, DNV-OS-E301, DNV-OS-F201, API RP 2RD,
//          API RP 2SK, IACS CSR, NORSOK N-004, CAP 437, ICAO Annex 14,
//          IACS UR S-31/S-32, DNV Rules Ships, OEM specs
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
  },

  // ── 9. FPSO HULL DETAIL FATIGUE ────────────────────────────────────────────
  fpso_hull_detail_fatigue: {
    id: "fpso_hull_detail_fatigue",
    display_name: "FPSO Hull Detail Fatigue at Bracket Toes and Cutouts",
    domain: "floating",
    prerequisites: {
      platform_type: ["fpso", "fso", "flng"]
    },
    indicators: {
      structural_zone: {
        side_shell: 0.30,
        bottom_plating: 0.25,
        main_deck: 0.20,
        topside_support: 0.15,
        column: 0.10
      },
      platform_type: {
        fpso: 0.50,
        fso: 0.25,
        flng: 0.15,
        semi_sub: 0.07,
        spar: 0.03
      },
      crack_location: {
        weld_toe: 0.55,
        od_surface: 0.20,
        weld_root: 0.15,
        mid_wall: 0.07,
        id_surface: 0.03
      },
      morphology: {
        transgranular: 0.65,
        single_planar: 0.20,
        branched: 0.08,
        intergranular: 0.04,
        stepwise_blistering: 0.03
      },
      service_age_bracket: {
        elderly_gt_25yr: 0.35,
        aging_15_25yr: 0.35,
        mid_5_15yr: 0.20,
        new_lt_5yr: 0.10
      }
    },
    synergistic_with: ["hull_fatigue_fpso", "motion_induced_fatigue"],
    competes_with: ["topside_interface_cracking"],
    severity_default: "high",
    typical_consequence: "detail_fatigue_bracket_cutout_crack_propagation",
    code_reference: "DNV-RP-C203, IACS CSR"
  },

  // ── 10. TURRET SWIVEL SEAL FAILURE ─────────────────────────────────────────
  turret_swivel_seal_failure: {
    id: "turret_swivel_seal_failure",
    display_name: "Turret Swivel Stack Seal Degradation and Leakage",
    domain: "floating",
    prerequisites: {
      has_turret_system: true
    },
    indicators: {
      platform_type: {
        fpso: 0.65,
        flng: 0.20,
        fso: 0.10,
        semi_sub: 0.03,
        spar: 0.02
      },
      service_age_bracket: {
        elderly_gt_25yr: 0.40,
        aging_15_25yr: 0.30,
        mid_5_15yr: 0.20,
        new_lt_5yr: 0.10
      },
      coating_condition: {
        failed: 0.50,
        degraded: 0.30,
        intact: 0.15,
        absent: 0.05
      },
      wall_loss_pattern: {
        localized_blistering: 0.40,
        grooving: 0.25,
        uniform: 0.20,
        pitting: 0.10,
        none_visible: 0.05
      }
    },
    synergistic_with: ["turret_bearing_wear", "internal_corrosion_fpso"],
    competes_with: ["topside_interface_cracking"],
    severity_default: "high",
    typical_consequence: "swivel_seal_extrusion_hydrocarbon_leak",
    code_reference: "API RP 2FPS, OEM specs"
  },

  // ── 11. RISER HANGOFF FATIGUE ──────────────────────────────────────────────
  riser_hangoff_fatigue: {
    id: "riser_hangoff_fatigue",
    display_name: "Riser Hang-Off Fatigue at Turret/Balcony Interface",
    domain: "floating",
    prerequisites: {
      has_riser_system: true
    },
    indicators: {
      platform_type: {
        fpso: 0.45,
        semi_sub: 0.25,
        spar: 0.15,
        tlp: 0.10,
        flng: 0.05
      },
      crack_location: {
        weld_toe: 0.50,
        od_surface: 0.25,
        weld_root: 0.15,
        mid_wall: 0.07,
        id_surface: 0.03
      },
      crack_orientation: {
        circumferential: 0.55,
        axial: 0.20,
        perpendicular_to_plate: 0.15,
        parallel_to_plate: 0.05,
        random: 0.05
      },
      current_exposure: {
        high_current: 0.40,
        moderate_current: 0.30,
        low_current: 0.20,
        sheltered: 0.10
      },
      morphology: {
        transgranular: 0.60,
        single_planar: 0.25,
        branched: 0.08,
        intergranular: 0.04,
        stepwise_blistering: 0.03
      }
    },
    synergistic_with: ["motion_induced_fatigue", "hull_fatigue_fpso"],
    competes_with: ["tendon_fatigue_tlp"],
    severity_default: "high",
    typical_consequence: "riser_hangoff_fatigue_crack_hydrocarbon_release",
    code_reference: "API RP 2RD, DNV-OS-F201"
  },

  // ── 12. MOORING CHAIN OPB FATIGUE ──────────────────────────────────────────
  mooring_chain_opb_fatigue: {
    id: "mooring_chain_opb_fatigue",
    display_name: "Mooring Chain Out-of-Plane Bending (OPB) Fatigue",
    domain: "floating",
    prerequisites: {
      has_mooring_system: true
    },
    indicators: {
      platform_type: {
        fpso: 0.40,
        semi_sub: 0.25,
        spar: 0.20,
        flng: 0.10,
        tlp: 0.05
      },
      zone_depth: {
        splash_zone: 0.45,
        tidal_zone: 0.25,
        submerged: 0.20,
        mudline: 0.07,
        buried: 0.03
      },
      cp_status: {
        inadequate: 0.50,
        marginal: 0.25,
        adequate: 0.15,
        overprotected: 0.10
      },
      current_exposure: {
        high_current: 0.45,
        moderate_current: 0.30,
        low_current: 0.18,
        sheltered: 0.07
      },
      service_age_bracket: {
        elderly_gt_25yr: 0.35,
        aging_15_25yr: 0.35,
        mid_5_15yr: 0.20,
        new_lt_5yr: 0.10
      }
    },
    synergistic_with: ["motion_induced_fatigue"],
    competes_with: ["column_plate_buckling"],
    severity_default: "high",
    typical_consequence: "chain_link_opb_crack_mooring_line_failure",
    code_reference: "BV NR 604, DNV-RP-C203"
  },

  // ── 13. SPREAD MOORING ANCHOR DRAG ────────────────────────────────────────
  spread_mooring_anchor_drag: {
    id: "spread_mooring_anchor_drag",
    display_name: "Spread Mooring Anchor Holding Capacity Loss / Drag",
    domain: "floating",
    prerequisites: {
      has_mooring_system: true
    },
    indicators: {
      platform_type: {
        fpso: 0.35,
        semi_sub: 0.30,
        spar: 0.20,
        flng: 0.10,
        tlp: 0.05
      },
      zone_depth: {
        mudline: 0.50,
        buried: 0.30,
        submerged: 0.12,
        tidal_zone: 0.05,
        splash_zone: 0.03
      },
      current_exposure: {
        high_current: 0.45,
        moderate_current: 0.30,
        low_current: 0.18,
        sheltered: 0.07
      },
      service_age_bracket: {
        elderly_gt_25yr: 0.35,
        aging_15_25yr: 0.30,
        mid_5_15yr: 0.25,
        new_lt_5yr: 0.10
      }
    },
    synergistic_with: ["mooring_chain_opb_fatigue"],
    competes_with: ["column_plate_buckling"],
    severity_default: "high",
    typical_consequence: "anchor_drag_station_keeping_loss",
    code_reference: "API RP 2SK, DNV-OS-E301"
  },

  // ── 14. FPSO CARGO TANK CORROSION ──────────────────────────────────────────
  fpso_cargo_tank_corrosion: {
    id: "fpso_cargo_tank_corrosion",
    display_name: "FPSO Cargo Tank Bottom and Bulkhead Corrosion",
    domain: "floating",
    prerequisites: {
      has_cargo_tanks: true,
      platform_type: ["fpso", "fso"]
    },
    indicators: {
      structural_zone: {
        bottom_plating: 0.45,
        side_shell: 0.25,
        main_deck: 0.15,
        column: 0.10,
        pontoon: 0.05
      },
      coating_condition: {
        failed: 0.55,
        degraded: 0.25,
        intact: 0.12,
        absent: 0.08
      },
      wall_loss_pattern: {
        uniform: 0.35,
        pitting: 0.30,
        localized_blistering: 0.20,
        grooving: 0.10,
        none_visible: 0.05
      },
      service_age_bracket: {
        elderly_gt_25yr: 0.40,
        aging_15_25yr: 0.30,
        mid_5_15yr: 0.20,
        new_lt_5yr: 0.10
      },
      platform_type: {
        fpso: 0.55,
        fso: 0.25,
        flng: 0.12,
        semi_sub: 0.05,
        spar: 0.03
      }
    },
    synergistic_with: ["internal_corrosion_fpso"],
    competes_with: ["green_water_damage"],
    severity_default: "high",
    typical_consequence: "cargo_tank_wall_thinning_structural_weakness",
    code_reference: "IACS UR S-31/S-32, DNV Rules Ships"
  },

  // ── 15. TOPSIDES VIBRATION FATIGUE ────────────────────────────────────────
  topsides_vibration_fatigue: {
    id: "topsides_vibration_fatigue",
    display_name: "Topside Equipment and Piping Vibration-Induced Fatigue",
    domain: "floating",
    prerequisites: {
      has_topside_modules: true
    },
    indicators: {
      structural_zone: {
        topside_support: 0.50,
        main_deck: 0.30,
        side_shell: 0.10,
        column: 0.07,
        bottom_plating: 0.03
      },
      platform_type: {
        fpso: 0.35,
        semi_sub: 0.25,
        spar: 0.20,
        flng: 0.15,
        tlp: 0.05
      },
      crack_location: {
        weld_toe: 0.45,
        od_surface: 0.25,
        weld_root: 0.15,
        mid_wall: 0.10,
        id_surface: 0.05
      },
      morphology: {
        transgranular: 0.60,
        single_planar: 0.20,
        branched: 0.10,
        intergranular: 0.06,
        stepwise_blistering: 0.04
      }
    },
    synergistic_with: ["topside_interface_cracking", "motion_induced_fatigue"],
    competes_with: ["hull_fatigue_fpso"],
    severity_default: "medium",
    typical_consequence: "small_bore_connection_vibration_fatigue_leak",
    code_reference: "DNV-RP-D101, API 579-1"
  },

  // ── 16. HULL GIRDER ULTIMATE STRENGTH ──────────────────────────────────────
  hull_girder_ultimate_strength: {
    id: "hull_girder_ultimate_strength",
    display_name: "Hull Girder Ultimate Strength Degradation",
    domain: "floating",
    prerequisites: {
      platform_type: ["fpso", "fso", "flng"]
    },
    indicators: {
      structural_zone: {
        bottom_plating: 0.35,
        side_shell: 0.30,
        main_deck: 0.20,
        column: 0.10,
        pontoon: 0.05
      },
      platform_type: {
        fpso: 0.50,
        fso: 0.25,
        flng: 0.15,
        semi_sub: 0.07,
        spar: 0.03
      },
      wall_loss_pattern: {
        uniform: 0.40,
        pitting: 0.25,
        localized_blistering: 0.20,
        grooving: 0.10,
        none_visible: 0.05
      },
      service_age_bracket: {
        elderly_gt_25yr: 0.40,
        aging_15_25yr: 0.30,
        mid_5_15yr: 0.20,
        new_lt_5yr: 0.10
      },
      coating_condition: {
        failed: 0.45,
        degraded: 0.30,
        intact: 0.15,
        absent: 0.10
      }
    },
    synergistic_with: ["fpso_cargo_tank_corrosion", "internal_corrosion_fpso"],
    competes_with: ["column_plate_buckling"],
    severity_default: "high",
    typical_consequence: "hull_girder_section_modulus_reduction",
    code_reference: "IACS CSR, DNV-OS-C102"
  },

  // ── 17. BRACKET TOE FATIGUE ────────────────────────────────────────────────
  bracket_toe_fatigue: {
    id: "bracket_toe_fatigue",
    display_name: "Bracket Toe and Free-Edge Fatigue Cracking",
    domain: "floating",
    prerequisites: {
      wave_loading_present: true
    },
    indicators: {
      structural_zone: {
        side_shell: 0.30,
        bottom_plating: 0.25,
        main_deck: 0.20,
        topside_support: 0.15,
        column: 0.10
      },
      crack_location: {
        weld_toe: 0.60,
        od_surface: 0.20,
        weld_root: 0.10,
        mid_wall: 0.07,
        id_surface: 0.03
      },
      morphology: {
        transgranular: 0.65,
        single_planar: 0.20,
        branched: 0.08,
        intergranular: 0.04,
        stepwise_blistering: 0.03
      },
      platform_type: {
        fpso: 0.40,
        fso: 0.25,
        flng: 0.15,
        semi_sub: 0.12,
        spar: 0.08
      },
      crack_orientation: {
        circumferential: 0.45,
        perpendicular_to_plate: 0.30,
        axial: 0.15,
        parallel_to_plate: 0.05,
        random: 0.05
      }
    },
    synergistic_with: ["hull_fatigue_fpso", "fpso_hull_detail_fatigue"],
    competes_with: ["topside_interface_cracking"],
    severity_default: "medium",
    typical_consequence: "bracket_toe_crack_initiation_propagation",
    code_reference: "DNV-RP-C203, IACS UR S-11"
  },

  // ── 18. STRUCTURAL MISALIGNMENT ────────────────────────────────────────────
  structural_misalignment: {
    id: "structural_misalignment",
    display_name: "Structural Misalignment and Fabrication Defect-Induced Stress",
    domain: "floating",
    prerequisites: {},
    indicators: {
      crack_location: {
        weld_toe: 0.45,
        weld_root: 0.30,
        od_surface: 0.15,
        mid_wall: 0.07,
        id_surface: 0.03
      },
      structural_zone: {
        side_shell: 0.30,
        bottom_plating: 0.25,
        main_deck: 0.20,
        column: 0.15,
        topside_support: 0.10
      },
      platform_type: {
        fpso: 0.40,
        fso: 0.20,
        semi_sub: 0.20,
        flng: 0.12,
        spar: 0.08
      },
      morphology: {
        transgranular: 0.50,
        single_planar: 0.30,
        branched: 0.10,
        intergranular: 0.06,
        stepwise_blistering: 0.04
      },
      service_age_bracket: {
        new_lt_5yr: 0.40,
        mid_5_15yr: 0.30,
        aging_15_25yr: 0.20,
        elderly_gt_25yr: 0.10
      }
    },
    synergistic_with: ["hull_fatigue_fpso", "bracket_toe_fatigue"],
    competes_with: ["column_plate_buckling"],
    severity_default: "medium",
    typical_consequence: "misalignment_stress_concentration_premature_fatigue",
    code_reference: "DNV-OS-C401, IACS UR W-13"
  },

  // ── 19. GREEN WATER STRUCTURAL DETAIL ──────────────────────────────────────
  green_water_structural_detail: {
    id: "green_water_structural_detail",
    display_name: "Green Water Damage at Structural Details (Stiffeners/Brackets)",
    domain: "floating",
    prerequisites: {
      wave_loading_present: true,
      has_exposed_deck: true
    },
    indicators: {
      structural_zone: {
        bow_area: 0.45,
        main_deck: 0.30,
        topside_support: 0.15,
        side_shell: 0.07,
        column: 0.03
      },
      platform_type: {
        fpso: 0.45,
        semi_sub: 0.25,
        fso: 0.15,
        flng: 0.10,
        spar: 0.05
      },
      wall_loss_pattern: {
        localized_blistering: 0.40,
        grooving: 0.25,
        uniform: 0.20,
        pitting: 0.10,
        none_visible: 0.05
      },
      coating_condition: {
        failed: 0.50,
        degraded: 0.25,
        intact: 0.15,
        absent: 0.10
      }
    },
    synergistic_with: ["green_water_damage", "hull_fatigue_fpso"],
    competes_with: ["motion_induced_fatigue"],
    severity_default: "high",
    typical_consequence: "stiffener_bracket_deformation_green_water_impact",
    code_reference: "DNV-OS-C102, API RP 2FPS"
  },

  // ── 20. CAISSON FATIGUE ────────────────────────────────────────────────────
  caisson_fatigue: {
    id: "caisson_fatigue",
    display_name: "Caisson and J-Tube Fatigue from Wave/Current Loading",
    domain: "floating",
    prerequisites: {
      has_caisson: true
    },
    indicators: {
      structural_zone: {
        side_shell: 0.40,
        column: 0.25,
        bottom_plating: 0.15,
        main_deck: 0.12,
        topside_support: 0.08
      },
      platform_type: {
        fpso: 0.30,
        semi_sub: 0.30,
        spar: 0.20,
        tlp: 0.12,
        flng: 0.08
      },
      crack_location: {
        weld_toe: 0.50,
        od_surface: 0.25,
        weld_root: 0.15,
        mid_wall: 0.07,
        id_surface: 0.03
      },
      current_exposure: {
        high_current: 0.45,
        moderate_current: 0.30,
        low_current: 0.18,
        sheltered: 0.07
      },
      crack_orientation: {
        circumferential: 0.50,
        axial: 0.25,
        perpendicular_to_plate: 0.15,
        parallel_to_plate: 0.05,
        random: 0.05
      }
    },
    synergistic_with: ["motion_induced_fatigue"],
    competes_with: ["hull_fatigue_fpso"],
    severity_default: "medium",
    typical_consequence: "caisson_fatigue_crack_flooding_risk",
    code_reference: "DNV-RP-C203, API RP 2A"
  },

  // ── 21. FLARE TOWER FATIGUE ────────────────────────────────────────────────
  flare_tower_fatigue: {
    id: "flare_tower_fatigue",
    display_name: "Flare Tower / Boom Fatigue from Wind and Wave Motion",
    domain: "floating",
    prerequisites: {
      has_flare_system: true
    },
    indicators: {
      structural_zone: {
        topside_support: 0.55,
        main_deck: 0.25,
        side_shell: 0.10,
        column: 0.07,
        bottom_plating: 0.03
      },
      platform_type: {
        fpso: 0.35,
        semi_sub: 0.25,
        spar: 0.20,
        flng: 0.15,
        tlp: 0.05
      },
      crack_location: {
        weld_toe: 0.55,
        od_surface: 0.20,
        weld_root: 0.15,
        mid_wall: 0.07,
        id_surface: 0.03
      },
      morphology: {
        transgranular: 0.60,
        single_planar: 0.25,
        branched: 0.08,
        intergranular: 0.04,
        stepwise_blistering: 0.03
      },
      current_exposure: {
        high_current: 0.35,
        moderate_current: 0.35,
        low_current: 0.20,
        sheltered: 0.10
      }
    },
    synergistic_with: ["topsides_vibration_fatigue", "motion_induced_fatigue"],
    competes_with: ["topside_interface_cracking"],
    severity_default: "high",
    typical_consequence: "flare_tower_base_fatigue_crack_collapse_risk",
    code_reference: "DNV-RP-C203, NORSOK N-004"
  },

  // ── 22. HELIDECK STRUCTURAL FATIGUE ────────────────────────────────────────
  helideck_structural_fatigue: {
    id: "helideck_structural_fatigue",
    display_name: "Helideck Support Structure Fatigue",
    domain: "floating",
    prerequisites: {
      has_helideck: true
    },
    indicators: {
      structural_zone: {
        topside_support: 0.60,
        main_deck: 0.25,
        side_shell: 0.08,
        column: 0.04,
        bottom_plating: 0.03
      },
      platform_type: {
        fpso: 0.30,
        semi_sub: 0.30,
        spar: 0.15,
        flng: 0.15,
        tlp: 0.10
      },
      crack_location: {
        weld_toe: 0.50,
        od_surface: 0.25,
        weld_root: 0.12,
        mid_wall: 0.08,
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
      }
    },
    synergistic_with: ["motion_induced_fatigue", "topsides_vibration_fatigue"],
    competes_with: ["topside_interface_cracking"],
    severity_default: "high",
    typical_consequence: "helideck_support_fatigue_crack_safety_critical",
    code_reference: "CAP 437, ICAO Annex 14, DNV-OS-C102"
  },

  // ── 23. SWIVEL STACK EROSION ───────────────────────────────────────────────
  swivel_stack_erosion: {
    id: "swivel_stack_erosion",
    display_name: "Swivel Stack Internal Erosion from Produced Fluids",
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
      wall_loss_pattern: {
        grooving: 0.45,
        pitting: 0.25,
        uniform: 0.15,
        localized_blistering: 0.10,
        none_visible: 0.05
      },
      service_age_bracket: {
        elderly_gt_25yr: 0.35,
        aging_15_25yr: 0.30,
        mid_5_15yr: 0.25,
        new_lt_5yr: 0.10
      },
      coating_condition: {
        failed: 0.45,
        degraded: 0.30,
        intact: 0.18,
        absent: 0.07
      }
    },
    synergistic_with: ["turret_bearing_wear", "turret_swivel_seal_failure"],
    competes_with: ["internal_corrosion_fpso"],
    severity_default: "high",
    typical_consequence: "swivel_erosion_flow_path_wall_loss",
    code_reference: "API RP 2FPS, OEM specs"
  },

  // ── 24. TURRET BEARING CORROSION ───────────────────────────────────────────
  turret_bearing_corrosion: {
    id: "turret_bearing_corrosion",
    display_name: "Turret Main Bearing Corrosion in Splash/Tidal Zone",
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
      zone_depth: {
        splash_zone: 0.45,
        tidal_zone: 0.30,
        submerged: 0.15,
        mudline: 0.07,
        buried: 0.03
      },
      cp_status: {
        inadequate: 0.50,
        marginal: 0.25,
        adequate: 0.15,
        overprotected: 0.10
      },
      coating_condition: {
        failed: 0.50,
        degraded: 0.25,
        intact: 0.15,
        absent: 0.10
      },
      service_age_bracket: {
        elderly_gt_25yr: 0.40,
        aging_15_25yr: 0.30,
        mid_5_15yr: 0.20,
        new_lt_5yr: 0.10
      }
    },
    synergistic_with: ["turret_bearing_wear", "turret_swivel_seal_failure"],
    competes_with: ["internal_corrosion_fpso"],
    severity_default: "high",
    typical_consequence: "bearing_race_corrosion_rotation_impedance",
    code_reference: "API RP 2FPS, DNV-OS-C102"
  },

  // ── 25. MOONPOOL FATIGUE ───────────────────────────────────────────────────
  moonpool_fatigue: {
    id: "moonpool_fatigue",
    display_name: "Moonpool Structure Fatigue from Sloshing and Wave Action",
    domain: "floating",
    prerequisites: {
      has_moonpool: true
    },
    indicators: {
      structural_zone: {
        column: 0.40,
        bottom_plating: 0.25,
        side_shell: 0.20,
        main_deck: 0.10,
        topside_support: 0.05
      },
      platform_type: {
        semi_sub: 0.35,
        fpso: 0.25,
        spar: 0.20,
        flng: 0.12,
        tlp: 0.08
      },
      crack_location: {
        weld_toe: 0.50,
        od_surface: 0.20,
        weld_root: 0.15,
        mid_wall: 0.10,
        id_surface: 0.05
      },
      crack_orientation: {
        circumferential: 0.45,
        axial: 0.25,
        perpendicular_to_plate: 0.18,
        parallel_to_plate: 0.07,
        random: 0.05
      },
      current_exposure: {
        high_current: 0.35,
        moderate_current: 0.30,
        low_current: 0.25,
        sheltered: 0.10
      }
    },
    synergistic_with: ["motion_induced_fatigue", "hull_fatigue_fpso"],
    competes_with: ["column_plate_buckling"],
    severity_default: "medium",
    typical_consequence: "moonpool_wall_fatigue_crack_flooding",
    code_reference: "DNV-OS-C102, API RP 2FPS"
  }
};

export { MECHANISMS_FLOATING };
