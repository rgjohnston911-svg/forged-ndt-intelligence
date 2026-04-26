// @ts-nocheck
// ══════════════════════════════════════════════════════════════════════════════
// DDE MECHANISM KNOWLEDGE BASE — MARINE VESSELS / MODUs
// 10 damage mechanisms for ship hulls, MODUs, marine structures
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
  }
};

export { MECHANISMS_MARINE };
