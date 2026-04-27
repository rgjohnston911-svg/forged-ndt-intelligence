// @ts-nocheck
// ══════════════════════════════════════════════════════════════════════════════
// DDE MECHANISM KNOWLEDGE BASE — MARINE VESSELS / MODUs
// 25 damage mechanisms for ship hulls, MODUs, marine structures
//
// Sources: IACS CSR, ABS Rules, DNV Rules for Classification,
//          SOLAS, IMO Performance Standards, IACS UR Z10.x
//
// Indicator dimensions for marine:
//   slamming_exposure, free_surface_state, crack_orientation,
//   crack_location, morphology, wall_loss_pattern, coating_condition,
//   structural_zone, service_temperature_f, ballast_history
// ══════════════════════════════════════════════════════════════════════════════

var MECHANISMS_MARINE = {

  // ── 1. GENERAL CORROSION (Marine) ──────────────────────────────────────
  general_corrosion_marine: {
    id: "general_corrosion_marine",
    display_name: "General Corrosion — Ballast Tanks & Hull",
    domain: "marine",
    prerequisites: {
      environment: ["seawater", "marine", "brackish"],
      material_family: ["carbon_steel", "low_alloy_steel"]
    },
    indicators: {
      wall_loss_pattern: {
        uniform: 0.55,
        pitting: 0.20,
        grooving: 0.10,
        localized_blistering: 0.05,
        none_visible: 0.10
      },
      structural_zone: {
        ballast_tank: 0.35,
        cargo_tank: 0.20,
        hull_bottom: 0.20,
        deck: 0.10,
        bulkhead: 0.15
      },
      coating_condition: {
        failed: 0.50,
        degraded: 0.30,
        intact: 0.10,
        absent: 0.10
      },
      ballast_history: {
        frequent_ballast_change: 0.45,
        static_ballast: 0.25,
        always_loaded: 0.15,
        dry: 0.15
      },
      service_temperature_f: {
        below_150: 0.80,
        "150_to_300": 0.15,
        "300_to_500": 0.04,
        above_500: 0.01
      }
    },
    synergistic_with: ["pitting_marine", "MIC_vessel"],
    competes_with: ["grooving_corrosion", "erosion_corrosion_marine"],
    severity_default: "medium",
    typical_consequence: "section_loss_structural_weakening",
    code_reference: "IACS CSR, ABS Rules Part 5C, DNV Rules Pt.3 Ch.1"
  },

  // ── 2. PITTING CORROSION (Marine) ──────────────────────────────────────
  pitting_marine: {
    id: "pitting_marine",
    display_name: "Pitting Corrosion — Cargo/Ballast Tanks",
    domain: "marine",
    prerequisites: {
      environment: ["seawater", "marine", "brackish"],
      material_family: ["carbon_steel", "low_alloy_steel", "austenitic_stainless"]
    },
    indicators: {
      wall_loss_pattern: {
        pitting: 0.75,
        localized_blistering: 0.10,
        uniform: 0.05,
        grooving: 0.05,
        none_visible: 0.05
      },
      structural_zone: {
        ballast_tank: 0.35,
        cargo_tank: 0.25,
        hull_bottom: 0.20,
        deck: 0.05,
        bulkhead: 0.15
      },
      coating_condition: {
        failed: 0.45,
        degraded: 0.30,
        intact: 0.15,
        absent: 0.10
      },
      ballast_history: {
        frequent_ballast_change: 0.50,
        static_ballast: 0.25,
        always_loaded: 0.15,
        dry: 0.10
      }
    },
    synergistic_with: ["general_corrosion_marine", "MIC_vessel"],
    competes_with: ["grooving_corrosion"],
    severity_default: "medium",
    typical_consequence: "localized_perforation_risk",
    code_reference: "IACS UR Z10.2, ABS Rules Part 7, DNV Rules Pt.3 Ch.1"
  },

  // ── 3. FATIGUE CRACKING (Marine) ───────────────────────────────────────
  fatigue_cracking_marine: {
    id: "fatigue_cracking_marine",
    display_name: "Fatigue Cracking — Structural Details",
    domain: "marine",
    prerequisites: {
      wave_loading_present: true,
      material_family: ["carbon_steel", "low_alloy_steel", "high_strength_steel"]
    },
    indicators: {
      crack_orientation: {
        perpendicular_to_plate: 0.50,
        circumferential: 0.20,
        axial: 0.15,
        random: 0.10,
        parallel_to_plate: 0.05
      },
      crack_location: {
        weld_toe: 0.55,
        weld_root: 0.20,
        od_surface: 0.10,
        id_surface: 0.10,
        mid_wall: 0.05
      },
      morphology: {
        transgranular: 0.60,
        single_planar: 0.25,
        branched: 0.05,
        intergranular: 0.05,
        stepwise_blistering: 0.05
      },
      structural_zone: {
        deck: 0.20,
        hull_bottom: 0.25,
        bulkhead: 0.25,
        ballast_tank: 0.15,
        cargo_tank: 0.15
      },
      slamming_exposure: {
        severe: 0.35,
        moderate: 0.35,
        mild: 0.20,
        none: 0.10
      }
    },
    synergistic_with: ["general_corrosion_marine"],
    competes_with: ["weld_defect_marine", "buckling_marine"],
    severity_default: "high",
    typical_consequence: "fatigue_crack_propagation_at_detail",
    code_reference: "IACS CSR, DNV-CG-0129, ABS Guide for Fatigue Assessment"
  },

  // ── 4. SLAMMING / IMPACT DAMAGE ───────────────────────────────────────
  slamming_damage: {
    id: "slamming_damage",
    display_name: "Bow Slamming and Impact Damage",
    domain: "marine",
    prerequisites: {
      bow_or_forward_section: true,
      wave_loading_present: true
    },
    indicators: {
      slamming_exposure: {
        severe: 0.70,
        moderate: 0.20,
        mild: 0.08,
        none: 0.02
      },
      structural_zone: {
        hull_bottom: 0.60,
        deck: 0.15,
        bulkhead: 0.15,
        ballast_tank: 0.05,
        cargo_tank: 0.05
      },
      wall_loss_pattern: {
        localized_blistering: 0.45,
        grooving: 0.20,
        pitting: 0.10,
        uniform: 0.10,
        none_visible: 0.15
      },
      crack_orientation: {
        random: 0.40,
        circumferential: 0.25,
        perpendicular_to_plate: 0.15,
        axial: 0.10,
        parallel_to_plate: 0.10
      }
    },
    synergistic_with: ["fatigue_cracking_marine"],
    competes_with: ["buckling_marine"],
    severity_default: "high",
    typical_consequence: "plate_deformation_cracking",
    code_reference: "IACS CSR, ABS Pt.3 Ch.1 §3, SOLAS II-1"
  },

  // ── 5. GROOVING CORROSION ─────────────────────────────────────────────
  grooving_corrosion: {
    id: "grooving_corrosion",
    display_name: "Grooving Corrosion at Weld Toes",
    domain: "marine",
    prerequisites: {
      has_welded_connections: true,
      material_family: ["carbon_steel", "low_alloy_steel"]
    },
    indicators: {
      wall_loss_pattern: {
        grooving: 0.75,
        pitting: 0.10,
        uniform: 0.05,
        localized_blistering: 0.05,
        none_visible: 0.05
      },
      crack_location: {
        weld_toe: 0.65,
        weld_root: 0.15,
        id_surface: 0.10,
        od_surface: 0.05,
        mid_wall: 0.05
      },
      structural_zone: {
        ballast_tank: 0.40,
        cargo_tank: 0.25,
        bulkhead: 0.20,
        hull_bottom: 0.10,
        deck: 0.05
      },
      coating_condition: {
        failed: 0.55,
        degraded: 0.25,
        intact: 0.10,
        absent: 0.10
      }
    },
    synergistic_with: ["general_corrosion_marine"],
    competes_with: ["pitting_marine", "fatigue_cracking_marine"],
    severity_default: "medium",
    typical_consequence: "localized_groove_at_weld_line",
    code_reference: "IACS UR Z10.2, ABS Rules Part 7"
  },

  // ── 6. WELD DEFECTS (Marine) ──────────────────────────────────────────
  weld_defect_marine: {
    id: "weld_defect_marine",
    display_name: "Weld Fabrication Defects",
    domain: "marine",
    prerequisites: {
      has_welded_connections: true
    },
    indicators: {
      crack_location: {
        weld_root: 0.40,
        weld_toe: 0.35,
        mid_wall: 0.15,
        id_surface: 0.05,
        od_surface: 0.05
      },
      morphology: {
        single_planar: 0.45,
        transgranular: 0.20,
        intergranular: 0.15,
        branched: 0.10,
        stepwise_blistering: 0.10
      },
      crack_orientation: {
        axial: 0.35,
        circumferential: 0.30,
        perpendicular_to_plate: 0.15,
        parallel_to_plate: 0.10,
        random: 0.10
      },
      crack_depth_ratio: {
        shallow_lt_25pct: 0.45,
        moderate_25_50pct: 0.35,
        deep_gt_50pct: 0.20
      }
    },
    synergistic_with: ["fatigue_cracking_marine"],
    competes_with: ["grooving_corrosion"],
    severity_default: "medium",
    typical_consequence: "crack_initiation_from_defect",
    code_reference: "IACS UR W, AWS D1.1, ABS Rules Part 2 Ch.4"
  },

  // ── 7. BUCKLING ───────────────────────────────────────────────────────
  buckling_marine: {
    id: "buckling_marine",
    display_name: "Plate / Stiffener Buckling",
    domain: "marine",
    prerequisites: {
      compressive_loading_present: true,
      material_family: ["carbon_steel", "low_alloy_steel", "high_strength_steel"]
    },
    indicators: {
      structural_zone: {
        deck: 0.30,
        hull_bottom: 0.25,
        bulkhead: 0.25,
        ballast_tank: 0.10,
        cargo_tank: 0.10
      },
      wall_loss_pattern: {
        uniform: 0.35,
        localized_blistering: 0.30,
        none_visible: 0.20,
        pitting: 0.10,
        grooving: 0.05
      },
      slamming_exposure: {
        severe: 0.40,
        moderate: 0.30,
        mild: 0.20,
        none: 0.10
      },
      free_surface_state: {
        slack_tank: 0.50,
        partially_filled: 0.25,
        full: 0.10,
        empty: 0.15
      }
    },
    synergistic_with: ["general_corrosion_marine"],
    competes_with: ["fatigue_cracking_marine", "slamming_damage"],
    severity_default: "high",
    typical_consequence: "local_buckling_structural_failure",
    code_reference: "IACS CSR, ABS Rules Part 5A, DNV Rules Pt.3 Ch.8"
  },

  // ── 8. MIC (Vessel Tanks) ─────────────────────────────────────────────
  MIC_vessel: {
    id: "MIC_vessel",
    display_name: "Microbiologically Influenced Corrosion (Vessel Tanks)",
    domain: "marine",
    prerequisites: {
      environment: ["seawater", "marine", "brackish"],
      material_family: ["carbon_steel", "low_alloy_steel"]
    },
    indicators: {
      wall_loss_pattern: {
        pitting: 0.60,
        localized_blistering: 0.15,
        uniform: 0.10,
        grooving: 0.05,
        none_visible: 0.10
      },
      structural_zone: {
        ballast_tank: 0.50,
        cargo_tank: 0.20,
        hull_bottom: 0.15,
        bulkhead: 0.10,
        deck: 0.05
      },
      ballast_history: {
        static_ballast: 0.45,
        frequent_ballast_change: 0.30,
        always_loaded: 0.15,
        dry: 0.10
      },
      coating_condition: {
        failed: 0.50,
        degraded: 0.30,
        intact: 0.10,
        absent: 0.10
      }
    },
    synergistic_with: ["general_corrosion_marine", "pitting_marine"],
    competes_with: ["grooving_corrosion"],
    severity_default: "medium",
    typical_consequence: "localized_pitting_in_stagnant_areas",
    code_reference: "NACE TM0194, IACS UR Z10.2"
  },

  // ── 9. COATING BREAKDOWN ──────────────────────────────────────────────
  coating_breakdown: {
    id: "coating_breakdown",
    display_name: "Protective Coating System Breakdown",
    domain: "marine",
    prerequisites: {
      coating_system_present: true
    },
    indicators: {
      coating_condition: {
        failed: 0.65,
        degraded: 0.25,
        intact: 0.05,
        absent: 0.05
      },
      structural_zone: {
        ballast_tank: 0.35,
        cargo_tank: 0.20,
        hull_bottom: 0.20,
        deck: 0.15,
        bulkhead: 0.10
      },
      wall_loss_pattern: {
        none_visible: 0.40,
        uniform: 0.25,
        pitting: 0.20,
        localized_blistering: 0.10,
        grooving: 0.05
      },
      ballast_history: {
        frequent_ballast_change: 0.40,
        static_ballast: 0.25,
        always_loaded: 0.20,
        dry: 0.15
      }
    },
    synergistic_with: ["general_corrosion_marine", "pitting_marine", "MIC_vessel"],
    competes_with: [],
    severity_default: "medium",
    typical_consequence: "accelerated_corrosion_onset",
    code_reference: "IACS UR Z9, IMO PSPC, NORSOK M-501"
  },

  // ── 10. EROSION-CORROSION (Marine) ────────────────────────────────────
  erosion_corrosion_marine: {
    id: "erosion_corrosion_marine",
    display_name: "Erosion-Corrosion — Sea Chest / Piping",
    domain: "marine",
    prerequisites: {
      high_velocity_seawater: true,
      material_family: ["carbon_steel", "low_alloy_steel", "copper_nickel"]
    },
    indicators: {
      wall_loss_pattern: {
        grooving: 0.50,
        uniform: 0.15,
        pitting: 0.15,
        localized_blistering: 0.10,
        none_visible: 0.10
      },
      structural_zone: {
        hull_bottom: 0.40,
        ballast_tank: 0.20,
        cargo_tank: 0.15,
        deck: 0.10,
        bulkhead: 0.15
      },
      coating_condition: {
        failed: 0.45,
        degraded: 0.25,
        intact: 0.15,
        absent: 0.15
      },
      service_temperature_f: {
        below_150: 0.80,
        "150_to_300": 0.15,
        "300_to_500": 0.04,
        above_500: 0.01
      }
    },
    synergistic_with: ["general_corrosion_marine"],
    competes_with: ["pitting_marine"],
    severity_default: "medium",
    typical_consequence: "accelerated_thinning_at_flow_changes",
    code_reference: "ABS Rules Part 7, IACS UR Z10, NACE SP0176"
  },

  // ── 11. DECK PLATE FATIGUE ────────────────────────────────────────────
  deck_plate_fatigue: {
    id: "deck_plate_fatigue",
    display_name: "Deck Plate Fatigue from Wheel Loads/Vibration",
    domain: "marine",
    prerequisites: {
      deck_loading_present: true,
      vibration_source_present: true,
      material_family: ["carbon_steel", "low_alloy_steel", "high_strength_steel"]
    },
    indicators: {
      crack_orientation: {
        transverse: 0.45,
        linear: 0.35,
        branched: 0.10,
        none: 0.10
      },
      structural_zone: {
        deck: 0.65,
        topsides: 0.20,
        hull: 0.10,
        bottom: 0.05
      },
      morphology: {
        transgranular: 0.45,
        beach_marks: 0.30,
        none: 0.15,
        crazing: 0.10
      }
    },
    synergistic_with: ["fatigue_cracking_marine"],
    competes_with: ["buckling_marine"],
    severity_default: "medium",
    typical_consequence: "fatigue_crack_initiation_deck",
    code_reference: "IACS CSR"
  },

  // ── 12. HATCH CORNER CRACKING ────────────────────────────────────────
  hatch_corner_cracking: {
    id: "hatch_corner_cracking",
    display_name: "Hatch Corner Stress Concentration Cracking",
    domain: "marine",
    prerequisites: {
      hatch_cover_present: true,
      material_family: ["carbon_steel", "low_alloy_steel", "high_strength_steel"]
    },
    indicators: {
      crack_location: {
        weld: 0.40,
        weld_haz: 0.30,
        base_metal: 0.25,
        external: 0.05
      },
      structural_zone: {
        deck: 0.70,
        hull: 0.20,
        topsides: 0.05,
        bottom: 0.05
      },
      crack_orientation: {
        linear: 0.50,
        transverse: 0.30,
        branched: 0.10,
        none: 0.10
      }
    },
    synergistic_with: ["fatigue_cracking_marine", "weld_defect_marine"],
    competes_with: ["buckling_marine"],
    severity_default: "high",
    typical_consequence: "stress_concentration_cracking",
    code_reference: "IACS UR S34"
  },

  // ── 13. BALLAST TANK CORROSION ────────────────────────────────────────
  ballast_tank_corrosion: {
    id: "ballast_tank_corrosion",
    display_name: "Ballast Tank Internal Corrosion",
    domain: "marine",
    prerequisites: {
      environment: ["seawater", "marine", "brackish"],
      material_family: ["carbon_steel", "low_alloy_steel"],
      ballast_tank_present: true
    },
    indicators: {
      wall_loss_pattern: {
        uniform: 0.40,
        localized: 0.40,
        none: 0.20
      },
      ballast_history: {
        frequent_changes: 0.50,
        static: 0.20,
        empty: 0.15,
        full: 0.15
      },
      coating_condition: {
        damaged: 0.40,
        disbonded: 0.25,
        intact: 0.20,
        absent: 0.15
      }
    },
    synergistic_with: ["general_corrosion_marine", "MIC_vessel"],
    competes_with: ["grooving_corrosion"],
    severity_default: "medium",
    typical_consequence: "internal_tank_thinning",
    code_reference: "IACS UR Z10.2"
  },

  // ── 14. PROPELLER SHAFT WEAR ──────────────────────────────────────────
  propeller_shaft_wear: {
    id: "propeller_shaft_wear",
    display_name: "Propeller Shaft Bearing Wear/Corrosion",
    domain: "marine",
    prerequisites: {
      propulsion_system_present: true,
      material_family: ["carbon_steel", "low_alloy_steel", "stainless_steel"]
    },
    indicators: {
      morphology: {
        fretting: 0.45,
        grooving: 0.30,
        pitting: 0.15,
        none: 0.10
      },
      wall_loss_pattern: {
        localized: 0.55,
        uniform: 0.30,
        none: 0.15
      },
      structural_zone: {
        bottom: 0.50,
        hull: 0.30,
        engine_room: 0.15,
        deck: 0.05
      }
    },
    synergistic_with: ["general_corrosion_marine", "erosion_corrosion_marine"],
    competes_with: ["pitting_marine"],
    severity_default: "medium",
    typical_consequence: "bearing_surface_degradation",
    code_reference: "IACS UR M68"
  },

  // ── 15. RUDDER STOCK CORROSION ────────────────────────────────────────
  rudder_stock_corrosion: {
    id: "rudder_stock_corrosion",
    display_name: "Rudder Stock/Pintle Corrosion-Fatigue",
    domain: "marine",
    prerequisites: {
      steering_system_present: true,
      material_family: ["carbon_steel", "low_alloy_steel", "stainless_steel"]
    },
    indicators: {
      crack_orientation: {
        transverse: 0.45,
        linear: 0.30,
        none: 0.15,
        branched: 0.10
      },
      morphology: {
        pitting: 0.35,
        transgranular: 0.30,
        general_thinning: 0.25,
        none: 0.10
      },
      wall_loss_pattern: {
        localized: 0.50,
        uniform: 0.35,
        none: 0.15
      }
    },
    synergistic_with: ["general_corrosion_marine", "fatigue_cracking_marine"],
    competes_with: ["buckling_marine"],
    severity_default: "high",
    typical_consequence: "rudder_integrity_compromise",
    code_reference: "IACS UR S10"
  },

  // ── 16. STERN TUBE CORROSION ──────────────────────────────────────────
  stern_tube_corrosion: {
    id: "stern_tube_corrosion",
    display_name: "Stern Tube Seal/Bearing Corrosion",
    domain: "marine",
    prerequisites: {
      propulsion_system_present: true,
      material_family: ["carbon_steel", "low_alloy_steel", "bronze"]
    },
    indicators: {
      morphology: {
        grooving: 0.40,
        pitting: 0.30,
        general_thinning: 0.20,
        none: 0.10
      },
      wall_loss_pattern: {
        localized: 0.50,
        uniform: 0.35,
        none: 0.15
      },
      structural_zone: {
        bottom: 0.55,
        hull: 0.30,
        engine_room: 0.10,
        deck: 0.05
      }
    },
    synergistic_with: ["general_corrosion_marine", "erosion_corrosion_marine"],
    competes_with: ["pitting_marine"],
    severity_default: "medium",
    typical_consequence: "seal_bearing_failure_risk",
    code_reference: "IACS UR M68"
  },

  // ── 17. UNDER-DECK CONDENSATION CORROSION ─────────────────────────────
  under_deck_condensation: {
    id: "under_deck_condensation",
    display_name: "Under-Deck Condensation Corrosion",
    domain: "marine",
    prerequisites: {
      climate_control_condition: ["poor", "none"],
      material_family: ["carbon_steel", "low_alloy_steel"]
    },
    indicators: {
      wall_loss_pattern: {
        uniform: 0.45,
        localized: 0.35,
        none: 0.20
      },
      coating_condition: {
        damaged: 0.35,
        absent: 0.30,
        disbonded: 0.20,
        intact: 0.15
      },
      structural_zone: {
        deck: 0.55,
        topsides: 0.25,
        hull: 0.15,
        bottom: 0.05
      }
    },
    synergistic_with: ["general_corrosion_marine", "coating_breakdown"],
    competes_with: [],
    severity_default: "low",
    typical_consequence: "condensation_surface_corrosion",
    code_reference: "IACS CSR"
  },

  // ── 18. CARGO HOLD CORROSION ──────────────────────────────────────────
  cargo_hold_corrosion: {
    id: "cargo_hold_corrosion",
    display_name: "Cargo Hold Corrosion from Cargo Interaction",
    domain: "marine",
    prerequisites: {
      cargo_contact_present: true,
      material_family: ["carbon_steel", "low_alloy_steel"]
    },
    indicators: {
      wall_loss_pattern: {
        localized: 0.45,
        uniform: 0.40,
        none: 0.15
      },
      morphology: {
        general_thinning: 0.40,
        pitting: 0.35,
        none: 0.15,
        grooving: 0.10
      },
      coating_condition: {
        damaged: 0.40,
        absent: 0.25,
        intact: 0.20,
        disbonded: 0.15
      }
    },
    synergistic_with: ["general_corrosion_marine", "coating_breakdown"],
    competes_with: ["grooving_corrosion"],
    severity_default: "medium",
    typical_consequence: "cargo_hold_thinning",
    code_reference: "IACS UR S25"
  },

  // ── 19. FIRE/EXPLOSION DAMAGE ASSESSMENT ──────────────────────────────
  fire_explosion_damage: {
    id: "fire_explosion_damage",
    display_name: "Fire/Explosion Structural Damage Assessment",
    domain: "marine",
    prerequisites: {
      fire_event_history: true,
      material_family: ["carbon_steel", "low_alloy_steel", "stainless_steel"]
    },
    indicators: {
      morphology: {
        buckling: 0.35,
        cracking: 0.25,
        general_thinning: 0.15,
        discoloration: 0.20,
        none: 0.05
      },
      structural_zone: {
        topsides: 0.35,
        deck: 0.30,
        engine_room: 0.25,
        hull: 0.05,
        bottom: 0.05
      },
      service_temperature_f: {
        high_gt600: 0.55,
        moderate_400_600: 0.30,
        low_lt400: 0.15
      }
    },
    synergistic_with: ["buckling_marine", "weld_defect_marine"],
    competes_with: [],
    severity_default: "high",
    typical_consequence: "post_fire_structural_integrity",
    code_reference: "SOLAS Ch II-2"
  },

  // ── 20. ICE DAMAGE ────────────────────────────────────────────────────
  ice_damage: {
    id: "ice_damage",
    display_name: "Ice Impact/Abrasion Damage",
    domain: "marine",
    prerequisites: {
      ice_operations: true,
      material_family: ["carbon_steel", "low_alloy_steel", "high_strength_steel"]
    },
    indicators: {
      wall_loss_pattern: {
        localized: 0.55,
        uniform: 0.30,
        none: 0.15
      },
      morphology: {
        denting: 0.40,
        abrasion: 0.30,
        cracking: 0.20,
        none: 0.10
      },
      structural_zone: {
        hull: 0.50,
        bottom: 0.25,
        deck: 0.15,
        topsides: 0.10
      }
    },
    synergistic_with: ["buckling_marine", "fatigue_cracking_marine"],
    competes_with: ["slamming_damage"],
    severity_default: "high",
    typical_consequence: "impact_deformation_cracking",
    code_reference: "IACS UR I"
  },

  // ── 21. HULL GIRDER FATIGUE ───────────────────────────────────────────
  hull_girder_fatigue: {
    id: "hull_girder_fatigue",
    display_name: "Hull Girder Primary Structure Fatigue",
    domain: "marine",
    prerequisites: {
      wave_loading_present: true,
      material_family: ["carbon_steel", "low_alloy_steel", "high_strength_steel"]
    },
    indicators: {
      crack_orientation: {
        transverse: 0.40,
        linear: 0.35,
        branched: 0.15,
        none: 0.10
      },
      structural_zone: {
        hull: 0.50,
        deck: 0.25,
        bottom: 0.20,
        topsides: 0.05
      },
      morphology: {
        transgranular: 0.45,
        beach_marks: 0.25,
        none: 0.15,
        intergranular: 0.15
      }
    },
    synergistic_with: ["fatigue_cracking_marine"],
    competes_with: ["buckling_marine"],
    severity_default: "high",
    typical_consequence: "primary_structure_fatigue",
    code_reference: "IACS CSR Part B"
  },

  // ── 22. LONGITUDINAL WELD SEAM CRACKING ───────────────────────────────
  weld_seam_cracking: {
    id: "weld_seam_cracking",
    display_name: "Longitudinal Weld Seam Cracking",
    domain: "marine",
    prerequisites: {
      has_welded_connections: true,
      material_family: ["carbon_steel", "low_alloy_steel", "high_strength_steel"]
    },
    indicators: {
      crack_location: {
        weld: 0.60,
        weld_haz: 0.25,
        base_metal: 0.10,
        external: 0.05
      },
      crack_orientation: {
        linear: 0.55,
        transverse: 0.25,
        branched: 0.10,
        none: 0.10
      },
      morphology: {
        transgranular: 0.40,
        intergranular: 0.25,
        none: 0.20,
        lamellar: 0.15
      }
    },
    synergistic_with: ["weld_defect_marine", "fatigue_cracking_marine"],
    competes_with: ["grooving_corrosion"],
    severity_default: "high",
    typical_consequence: "longitudinal_weld_failure",
    code_reference: "IACS UR W"
  },

  // ── 23. TANK TOP PITTING ──────────────────────────────────────────────
  tank_top_pitting: {
    id: "tank_top_pitting",
    display_name: "Tank Top Pitting from Stagnant Water",
    domain: "marine",
    prerequisites: {
      environment: ["seawater", "marine", "brackish"],
      material_family: ["carbon_steel", "low_alloy_steel"],
      stagnant_water_exposure: true
    },
    indicators: {
      wall_loss_pattern: {
        localized: 0.60,
        uniform: 0.25,
        none: 0.15
      },
      morphology: {
        pitting: 0.55,
        general_thinning: 0.25,
        none: 0.10,
        tuberculation: 0.10
      },
      ballast_history: {
        frequent_changes: 0.35,
        static: 0.40,
        empty: 0.15,
        full: 0.10
      }
    },
    synergistic_with: ["pitting_marine", "MIC_vessel"],
    competes_with: ["grooving_corrosion"],
    severity_default: "medium",
    typical_consequence: "tank_top_thinning_pitting",
    code_reference: "IACS CSR"
  },

  // ── 24. VOID SPACE/COFFERDAM CORROSION ────────────────────────────────
  void_space_corrosion: {
    id: "void_space_corrosion",
    display_name: "Void Space/Cofferdam Corrosion",
    domain: "marine",
    prerequisites: {
      void_space_present: true,
      material_family: ["carbon_steel", "low_alloy_steel"]
    },
    indicators: {
      wall_loss_pattern: {
        uniform: 0.40,
        localized: 0.40,
        none: 0.20
      },
      coating_condition: {
        absent: 0.45,
        damaged: 0.30,
        intact: 0.15,
        disbonded: 0.10
      },
      morphology: {
        general_thinning: 0.45,
        pitting: 0.30,
        none: 0.15,
        flaking: 0.10
      }
    },
    synergistic_with: ["general_corrosion_marine", "coating_breakdown"],
    competes_with: [],
    severity_default: "low",
    typical_consequence: "void_space_thinning",
    code_reference: "IACS UR Z10.4"
  },

  // ── 25. PIPE RACK VIBRATION FATIGUE ───────────────────────────────────
  pipe_rack_vibration_fatigue: {
    id: "pipe_rack_vibration_fatigue",
    display_name: "Pipe Rack/Small-Bore Connection Vibration Fatigue",
    domain: "marine",
    prerequisites: {
      piping_system_present: true,
      vibration_source_present: true,
      material_family: ["carbon_steel", "low_alloy_steel", "stainless_steel"]
    },
    indicators: {
      crack_orientation: {
        transverse: 0.50,
        linear: 0.30,
        none: 0.15,
        branched: 0.05
      },
      crack_location: {
        weld: 0.50,
        weld_haz: 0.25,
        base_metal: 0.15,
        external: 0.10
      },
      morphology: {
        transgranular: 0.45,
        beach_marks: 0.30,
        none: 0.15,
        striations: 0.10
      }
    },
    synergistic_with: ["fatigue_cracking_marine", "weld_defect_marine"],
    competes_with: ["grooving_corrosion"],
    severity_default: "medium",
    typical_consequence: "pipe_connection_fatigue_crack",
    code_reference: "DNV-RP-D101"
  }
};

export { MECHANISMS_MARINE };
