// @ts-nocheck
// ══════════════════════════════════════════════════════════════════════════════
// DDE MECHANISM KNOWLEDGE BASE — SUBSEA / OFFSHORE STRUCTURES
// 28 damage mechanisms for subsea pipelines, risers, jackets, and nodes
//
// Sources: DNV-RP-F101, DNV-RP-C203, API RP 2A-WSD, NORSOK M-001/M-503,
//          DNVGL-RP-0005, ISO 19902, NACE SP0176
//
// Indicator dimensions for subsea:
//   zone_depth, cp_status, marine_growth_grade, crack_orientation,
//   crack_location, morphology, wall_loss_pattern, coating_condition,
//   water_depth_range, current_exposure
// ══════════════════════════════════════════════════════════════════════════════

var MECHANISMS_SUBSEA = {

  // ── 1. FREE CORROSION (CP Failure) ─────────────────────────────────────
  free_corrosion_cp_failure: {
    id: "free_corrosion_cp_failure",
    display_name: "Free Corrosion Due to CP System Failure",
    domain: "subsea",
    prerequisites: {
      environment: ["seawater", "marine"],
      material_family: ["carbon_steel", "low_alloy_steel"]
    },
    indicators: {
      cp_status: {
        inadequate: 0.80,
        marginal: 0.15,
        adequate: 0.03,
        overprotected: 0.02
      },
      wall_loss_pattern: {
        uniform: 0.50,
        pitting: 0.25,
        grooving: 0.10,
        localized_blistering: 0.05,
        none_visible: 0.10
      },
      coating_condition: {
        failed: 0.70,
        degraded: 0.20,
        intact: 0.05,
        absent: 0.05
      },
      zone_depth: {
        splash_zone: 0.35,
        tidal_zone: 0.25,
        submerged: 0.25,
        mudline: 0.10,
        buried: 0.05
      },
      marine_growth_grade: {
        heavy: 0.15,
        moderate: 0.25,
        light: 0.35,
        none: 0.25
      }
    },
    synergistic_with: ["MIC_marine"],
    competes_with: ["splash_zone_corrosion", "erosion_scour"],
    severity_default: "high",
    typical_consequence: "wall_thinning_structural_weakening",
    code_reference: "DNV-RP-B401, NACE SP0176, ISO 15589-2"
  },

  // ── 2. SPLASH ZONE CORROSION ───────────────────────────────────────────
  splash_zone_corrosion: {
    id: "splash_zone_corrosion",
    display_name: "Splash Zone Accelerated Corrosion",
    domain: "subsea",
    prerequisites: {
      zone_includes_splash: true,
      material_family: ["carbon_steel", "low_alloy_steel"]
    },
    indicators: {
      zone_depth: {
        splash_zone: 0.80,
        tidal_zone: 0.15,
        submerged: 0.03,
        mudline: 0.01,
        buried: 0.01
      },
      wall_loss_pattern: {
        uniform: 0.40,
        pitting: 0.30,
        grooving: 0.15,
        localized_blistering: 0.05,
        none_visible: 0.10
      },
      coating_condition: {
        failed: 0.45,
        degraded: 0.30,
        intact: 0.15,
        absent: 0.10
      },
      cp_status: {
        inadequate: 0.50,
        marginal: 0.25,
        adequate: 0.15,
        overprotected: 0.10
      },
      marine_growth_grade: {
        none: 0.50,
        light: 0.30,
        moderate: 0.15,
        heavy: 0.05
      }
    },
    synergistic_with: ["free_corrosion_cp_failure"],
    competes_with: ["fatigue_tubular_joint", "anchor_impact"],
    severity_default: "high",
    typical_consequence: "section_loss_in_splash_zone",
    code_reference: "API RP 2A-WSD §5, NORSOK M-001, DNV-RP-B401"
  },

  // ── 3. FATIGUE AT TUBULAR JOINTS ───────────────────────────────────────
  fatigue_tubular_joint: {
    id: "fatigue_tubular_joint",
    display_name: "Fatigue Cracking at Tubular Joints",
    domain: "subsea",
    prerequisites: {
      has_tubular_joints: true,
      wave_loading_present: true,
      material_family: ["carbon_steel", "low_alloy_steel", "high_strength_steel"]
    },
    indicators: {
      crack_orientation: {
        circumferential: 0.50,
        perpendicular_to_plate: 0.25,
        axial: 0.10,
        parallel_to_plate: 0.05,
        random: 0.10
      },
      crack_location: {
        weld_toe: 0.65,
        weld_root: 0.15,
        od_surface: 0.10,
        id_surface: 0.05,
        mid_wall: 0.05
      },
      morphology: {
        transgranular: 0.60,
        single_planar: 0.25,
        branched: 0.05,
        intergranular: 0.05,
        stepwise_blistering: 0.05
      },
      zone_depth: {
        submerged: 0.40,
        splash_zone: 0.25,
        tidal_zone: 0.20,
        mudline: 0.10,
        buried: 0.05
      },
      marine_growth_grade: {
        heavy: 0.35,
        moderate: 0.30,
        light: 0.20,
        none: 0.15
      }
    },
    synergistic_with: ["splash_zone_corrosion", "free_corrosion_cp_failure"],
    competes_with: ["anchor_impact", "weld_defect_subsea"],
    severity_default: "high",
    typical_consequence: "fatigue_crack_through_wall_at_joint",
    code_reference: "DNV-RP-C203, API RP 2A-WSD §5.4, ISO 19902 §16"
  },

  // ── 4. ANCHOR / DROPPED OBJECT IMPACT ──────────────────────────────────
  anchor_impact: {
    id: "anchor_impact",
    display_name: "Mechanical Damage — Anchor Strike / Dropped Object",
    domain: "subsea",
    prerequisites: {
      marine_traffic_exposure: true
    },
    indicators: {
      wall_loss_pattern: {
        localized_blistering: 0.55,
        grooving: 0.25,
        pitting: 0.10,
        uniform: 0.05,
        none_visible: 0.05
      },
      crack_orientation: {
        random: 0.60,
        circumferential: 0.15,
        axial: 0.10,
        perpendicular_to_plate: 0.10,
        parallel_to_plate: 0.05
      },
      morphology: {
        single_planar: 0.40,
        transgranular: 0.30,
        branched: 0.15,
        intergranular: 0.05,
        stepwise_blistering: 0.10
      },
      zone_depth: {
        submerged: 0.50,
        mudline: 0.25,
        tidal_zone: 0.10,
        splash_zone: 0.10,
        buried: 0.05
      },
      coating_condition: {
        failed: 0.55,
        degraded: 0.25,
        intact: 0.10,
        absent: 0.10
      }
    },
    synergistic_with: ["free_corrosion_cp_failure"],
    competes_with: ["fatigue_tubular_joint", "weld_defect_subsea"],
    severity_default: "high",
    typical_consequence: "dent_gouge_immediate_structural_concern",
    code_reference: "DNV-RP-F107, API RP 2A-WSD §17, DNV-OS-F101"
  },

  // ── 5. WELD DEFECTS (SUBSEA) ──────────────────────────────────────────
  weld_defect_subsea: {
    id: "weld_defect_subsea",
    display_name: "Weld Fabrication Defects",
    domain: "subsea",
    prerequisites: {
      has_welded_connections: true
    },
    indicators: {
      crack_location: {
        weld_toe: 0.35,
        weld_root: 0.40,
        mid_wall: 0.15,
        id_surface: 0.05,
        od_surface: 0.05
      },
      morphology: {
        single_planar: 0.45,
        transgranular: 0.20,
        branched: 0.10,
        intergranular: 0.15,
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
        shallow_lt_25pct: 0.40,
        moderate_25_50pct: 0.35,
        deep_gt_50pct: 0.25
      }
    },
    synergistic_with: ["fatigue_tubular_joint"],
    competes_with: ["anchor_impact"],
    severity_default: "medium",
    typical_consequence: "crack_initiation_from_defect",
    code_reference: "AWS D1.1, API 1104, DNV-OS-C401"
  },

  // ── 6. J-TUBE / RISER CORROSION ───────────────────────────────────────
  j_tube_corrosion: {
    id: "j_tube_corrosion",
    display_name: "J-Tube and Riser Annulus Corrosion",
    domain: "subsea",
    prerequisites: {
      has_j_tube_or_riser: true,
      material_family: ["carbon_steel", "low_alloy_steel"]
    },
    indicators: {
      zone_depth: {
        splash_zone: 0.40,
        tidal_zone: 0.30,
        submerged: 0.20,
        mudline: 0.05,
        buried: 0.05
      },
      wall_loss_pattern: {
        pitting: 0.40,
        uniform: 0.30,
        grooving: 0.15,
        localized_blistering: 0.10,
        none_visible: 0.05
      },
      cp_status: {
        inadequate: 0.55,
        marginal: 0.25,
        adequate: 0.10,
        overprotected: 0.10
      },
      coating_condition: {
        failed: 0.50,
        degraded: 0.30,
        intact: 0.10,
        absent: 0.10
      }
    },
    synergistic_with: ["splash_zone_corrosion", "free_corrosion_cp_failure"],
    competes_with: ["riser_fatigue"],
    severity_default: "high",
    typical_consequence: "riser_wall_loss_hydrocarbon_release_risk",
    code_reference: "DNV-OS-F101, API RP 2A-WSD, NORSOK M-503"
  },

  // ── 7. RISER / CONDUCTOR FATIGUE ──────────────────────────────────────
  riser_fatigue: {
    id: "riser_fatigue",
    display_name: "Riser / Conductor Fatigue",
    domain: "subsea",
    prerequisites: {
      has_j_tube_or_riser: true,
      wave_loading_present: true
    },
    indicators: {
      crack_orientation: {
        circumferential: 0.60,
        perpendicular_to_plate: 0.20,
        axial: 0.10,
        random: 0.05,
        parallel_to_plate: 0.05
      },
      crack_location: {
        weld_toe: 0.55,
        weld_root: 0.20,
        od_surface: 0.15,
        id_surface: 0.05,
        mid_wall: 0.05
      },
      morphology: {
        transgranular: 0.60,
        single_planar: 0.25,
        branched: 0.05,
        intergranular: 0.05,
        stepwise_blistering: 0.05
      },
      current_exposure: {
        high_current: 0.50,
        moderate_current: 0.30,
        low_current: 0.15,
        sheltered: 0.05
      }
    },
    synergistic_with: ["j_tube_corrosion"],
    competes_with: ["fatigue_tubular_joint", "viv_fatigue"],
    severity_default: "high",
    typical_consequence: "riser_fatigue_crack_propagation",
    code_reference: "DNV-RP-C203, API RP 2RD, DNV-OS-F201"
  },

  // ── 8. VIV FATIGUE (Vortex-Induced Vibration) ─────────────────────────
  viv_fatigue: {
    id: "viv_fatigue",
    display_name: "Vortex-Induced Vibration Fatigue",
    domain: "subsea",
    prerequisites: {
      has_free_span: true,
      current_loading_present: true
    },
    indicators: {
      crack_orientation: {
        circumferential: 0.65,
        perpendicular_to_plate: 0.15,
        axial: 0.10,
        random: 0.05,
        parallel_to_plate: 0.05
      },
      crack_location: {
        weld_toe: 0.45,
        mid_wall: 0.20,
        od_surface: 0.20,
        weld_root: 0.10,
        id_surface: 0.05
      },
      current_exposure: {
        high_current: 0.65,
        moderate_current: 0.25,
        low_current: 0.08,
        sheltered: 0.02
      },
      water_depth_range: {
        shallow_lt_30m: 0.15,
        moderate_30_100m: 0.35,
        deep_100_500m: 0.35,
        ultra_deep_gt_500m: 0.15
      },
      marine_growth_grade: {
        heavy: 0.40,
        moderate: 0.30,
        light: 0.20,
        none: 0.10
      }
    },
    synergistic_with: ["riser_fatigue"],
    competes_with: ["fatigue_tubular_joint"],
    severity_default: "high",
    typical_consequence: "span_fatigue_failure",
    code_reference: "DNV-RP-F105, DNV-RP-C205"
  },

  // ── 9. EROSION / SCOUR ────────────────────────────────────────────────
  erosion_scour: {
    id: "erosion_scour",
    display_name: "Seabed Erosion and Scour",
    domain: "subsea",
    prerequisites: {
      near_seabed: true,
      current_loading_present: true
    },
    indicators: {
      zone_depth: {
        mudline: 0.65,
        buried: 0.20,
        submerged: 0.10,
        tidal_zone: 0.03,
        splash_zone: 0.02
      },
      current_exposure: {
        high_current: 0.55,
        moderate_current: 0.30,
        low_current: 0.12,
        sheltered: 0.03
      },
      wall_loss_pattern: {
        grooving: 0.40,
        uniform: 0.30,
        pitting: 0.15,
        localized_blistering: 0.05,
        none_visible: 0.10
      },
      coating_condition: {
        failed: 0.40,
        degraded: 0.25,
        absent: 0.20,
        intact: 0.15
      }
    },
    synergistic_with: ["free_corrosion_cp_failure"],
    competes_with: ["splash_zone_corrosion"],
    severity_default: "medium",
    typical_consequence: "foundation_undermining_free_span",
    code_reference: "DNV-RP-F107, DNV-RP-F105, API RP 2GEO"
  },

  // ── 10. MIC (MARINE) ──────────────────────────────────────────────────
  MIC_marine: {
    id: "MIC_marine",
    display_name: "Microbiologically Influenced Corrosion (Marine)",
    domain: "subsea",
    prerequisites: {
      environment: ["seawater", "marine"],
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
      zone_depth: {
        mudline: 0.40,
        buried: 0.30,
        submerged: 0.20,
        tidal_zone: 0.05,
        splash_zone: 0.05
      },
      cp_status: {
        inadequate: 0.45,
        marginal: 0.30,
        adequate: 0.15,
        overprotected: 0.10
      },
      marine_growth_grade: {
        heavy: 0.45,
        moderate: 0.30,
        light: 0.15,
        none: 0.10
      }
    },
    synergistic_with: ["free_corrosion_cp_failure", "erosion_scour"],
    competes_with: ["splash_zone_corrosion"],
    severity_default: "medium",
    typical_consequence: "localized_pitting_in_low_flow_areas",
    code_reference: "NACE TM0194, NACE SP0176, DNV-RP-B401"
  },

  // ── 11. HYDROGEN CRACKING (CP OVERPROTECTION) ─────────────────────────
  hydrogen_cracking_cp: {
    id: "hydrogen_cracking_cp",
    display_name: "Hydrogen Cracking from CP Overprotection",
    domain: "subsea",
    prerequisites: {
      cp_system_present: true,
      material_family: ["high_strength_steel", "low_alloy_steel"]
    },
    indicators: {
      cp_status: {
        overprotected: 0.75,
        adequate: 0.10,
        marginal: 0.05,
        inadequate: 0.10
      },
      crack_location: {
        weld_toe: 0.40,
        weld_root: 0.25,
        od_surface: 0.20,
        id_surface: 0.05,
        mid_wall: 0.10
      },
      morphology: {
        intergranular: 0.50,
        transgranular: 0.20,
        single_planar: 0.15,
        branched: 0.10,
        stepwise_blistering: 0.05
      },
      crack_orientation: {
        perpendicular_to_plate: 0.45,
        circumferential: 0.25,
        axial: 0.15,
        random: 0.10,
        parallel_to_plate: 0.05
      }
    },
    synergistic_with: ["fatigue_tubular_joint"],
    competes_with: ["weld_defect_subsea"],
    severity_default: "high",
    typical_consequence: "hydrogen_assisted_cracking_at_welds",
    code_reference: "DNV-RP-B401, NACE MR0175, ISO 15156"
  },

  // ── 12. CONCRETE DETERIORATION ────────────────────────────────────────
  concrete_deterioration: {
    id: "concrete_deterioration",
    display_name: "Concrete Gravity Structure Deterioration",
    domain: "subsea",
    prerequisites: {
      has_concrete_elements: true,
      environment: ["seawater", "marine"]
    },
    indicators: {
      zone_depth: {
        splash_zone: 0.40,
        tidal_zone: 0.30,
        submerged: 0.20,
        mudline: 0.05,
        buried: 0.05
      },
      surface_condition: {
        corroded: 0.30,
        scaled: 0.35,
        blistered: 0.25,
        clean: 0.10
      },
      wall_loss_pattern: {
        uniform: 0.40,
        pitting: 0.25,
        localized_blistering: 0.20,
        grooving: 0.05,
        none_visible: 0.10
      }
    },
    synergistic_with: ["splash_zone_corrosion"],
    competes_with: ["free_corrosion_cp_failure"],
    severity_default: "medium",
    typical_consequence: "rebar_exposure_structural_degradation",
    code_reference: "ACI 318, DNV-OS-C502, ISO 19903"
  },

  // ── 13. INTERNAL CORROSION — CO2 ───────────────────────────────────────
  internal_corrosion_co2: {
    id: "internal_corrosion_co2",
    display_name: "Internal Corrosion — CO2 in Flowlines",
    domain: "subsea",
    prerequisites: {
      internal_environment: true,
      co2_present: true,
      material_family: ["carbon_steel", "low_alloy_steel"]
    },
    indicators: {
      wall_loss_pattern: {
        localized: 0.45,
        uniform: 0.40,
        none: 0.15
      },
      morphology: {
        mesa_attack: 0.40,
        pitting: 0.35,
        general_thinning: 0.20,
        none: 0.05
      },
      zone_depth: {
        deepwater: 0.30,
        shallow: 0.35,
        splash: 0.05,
        tidal: 0.05,
        buried: 0.25
      }
    },
    synergistic_with: ["internal_corrosion_h2s"],
    competes_with: ["wax_deposition_damage"],
    severity_default: "high",
    typical_consequence: "internal_wall_loss_pipeline_failure",
    code_reference: "DNV-RP-F101, NACE SP0106"
  },

  // ── 14. INTERNAL CORROSION — H2S/SOUR ──────────────────────────────────
  internal_corrosion_h2s: {
    id: "internal_corrosion_h2s",
    display_name: "Internal Corrosion — H2S/Sour Service",
    domain: "subsea",
    prerequisites: {
      internal_environment: true,
      h2s_present: true,
      material_family: ["carbon_steel", "low_alloy_steel"]
    },
    indicators: {
      morphology: {
        pitting: 0.40,
        cracking: 0.30,
        general_thinning: 0.20,
        blistering: 0.10
      },
      wall_loss_pattern: {
        localized: 0.55,
        uniform: 0.30,
        none: 0.15
      },
      cp_status: {
        adequate: 0.30,
        marginal: 0.30,
        failed: 0.20,
        overprotected: 0.20
      }
    },
    synergistic_with: ["internal_corrosion_co2"],
    competes_with: ["hydrate_plug_damage"],
    severity_default: "high",
    typical_consequence: "sour_service_crack_initiation",
    code_reference: "NACE MR0175/ISO 15156"
  },

  // ── 15. WELD ROOT CORROSION ────────────────────────────────────────────
  weld_root_corrosion: {
    id: "weld_root_corrosion",
    display_name: "Preferential Weld Root Corrosion",
    domain: "subsea",
    prerequisites: {
      has_welded_connections: true,
      material_family: ["carbon_steel", "low_alloy_steel"]
    },
    indicators: {
      crack_location: {
        weld: 0.65,
        weld_haz: 0.25,
        base_metal: 0.05,
        external: 0.05
      },
      morphology: {
        grooving: 0.45,
        pitting: 0.30,
        general_thinning: 0.20,
        none: 0.05
      },
      wall_loss_pattern: {
        localized: 0.60,
        uniform: 0.25,
        none: 0.15
      }
    },
    synergistic_with: ["internal_corrosion_co2", "internal_corrosion_h2s"],
    competes_with: ["weld_defect_subsea"],
    severity_default: "high",
    typical_consequence: "weld_root_thinning_leakage_risk",
    code_reference: "DNV-RP-F116"
  },

  // ── 16. CATHODIC DISBONDMENT ───────────────────────────────────────────
  cathodic_disbondment: {
    id: "cathodic_disbondment",
    display_name: "Coating Cathodic Disbondment",
    domain: "subsea",
    prerequisites: {
      cp_system_present: true,
      has_external_coating: true
    },
    indicators: {
      cp_status: {
        overprotected: 0.60,
        adequate: 0.20,
        marginal: 0.15,
        failed: 0.05
      },
      coating_condition: {
        disbonded: 0.55,
        damaged: 0.25,
        intact: 0.10,
        absent: 0.10
      },
      zone_depth: {
        deepwater: 0.35,
        shallow: 0.30,
        buried: 0.25,
        tidal: 0.05,
        splash: 0.05
      }
    },
    synergistic_with: ["free_corrosion_cp_failure"],
    competes_with: ["splash_zone_corrosion"],
    severity_default: "medium",
    typical_consequence: "coating_loss_accelerated_corrosion",
    code_reference: "DNV-RP-F103"
  },

  // ── 17. HISC FROM OVERPROTECTION ───────────────────────────────────────
  hisc_overprotection: {
    id: "hisc_overprotection",
    display_name: "Hydrogen Induced Stress Cracking — CP Overprotection",
    domain: "subsea",
    prerequisites: {
      cp_system_present: true,
      material_family: ["high_strength_steel", "low_alloy_steel"]
    },
    indicators: {
      cp_status: {
        overprotected: 0.65,
        adequate: 0.15,
        marginal: 0.10,
        failed: 0.10
      },
      crack_orientation: {
        transverse: 0.45,
        linear: 0.30,
        branched: 0.15,
        none: 0.10
      },
      morphology: {
        intergranular: 0.45,
        transgranular: 0.25,
        cleavage: 0.20,
        none: 0.10
      }
    },
    synergistic_with: ["hydrogen_cracking_cp"],
    competes_with: ["fatigue_tubular_joint"],
    severity_default: "high",
    typical_consequence: "brittle_fracture_under_stress",
    code_reference: "DNV-RP-F112"
  },

  // ── 18. RISER WEAR AT GUIDES/CLAMPS ────────────────────────────────────
  riser_wear_guide: {
    id: "riser_wear_guide",
    display_name: "Riser Wear at Guides and Clamps",
    domain: "subsea",
    prerequisites: {
      has_j_tube_or_riser: true,
      has_guide_structures: true
    },
    indicators: {
      wall_loss_pattern: {
        localized: 0.70,
        uniform: 0.15,
        none: 0.15
      },
      morphology: {
        fretting: 0.50,
        grooving: 0.30,
        general_thinning: 0.15,
        none: 0.05
      },
      zone_depth: {
        splash: 0.35,
        tidal: 0.30,
        shallow: 0.25,
        deepwater: 0.05,
        buried: 0.05
      }
    },
    synergistic_with: ["riser_fatigue"],
    competes_with: ["j_tube_corrosion"],
    severity_default: "high",
    typical_consequence: "riser_wear_through_at_contact",
    code_reference: "API RP 2RD"
  },

  // ── 19. FLEXIBLE RISER ARMOR WIRE FATIGUE ──────────────────────────────
  flexible_riser_armor_fatigue: {
    id: "flexible_riser_armor_fatigue",
    display_name: "Flexible Riser Armor Wire Fatigue",
    domain: "subsea",
    prerequisites: {
      has_flexible_riser: true,
      wave_loading_present: true
    },
    indicators: {
      crack_orientation: {
        transverse: 0.50,
        linear: 0.30,
        none: 0.15,
        branched: 0.05
      },
      morphology: {
        transgranular: 0.45,
        beach_marks: 0.30,
        none: 0.15,
        intergranular: 0.10
      },
      current_exposure: {
        high: 0.45,
        moderate: 0.35,
        low: 0.15,
        none: 0.05
      }
    },
    synergistic_with: ["riser_fatigue"],
    competes_with: ["flexible_riser_armor_fatigue"],
    severity_default: "high",
    typical_consequence: "armor_wire_breaking_integrity_loss",
    code_reference: "API RP 17B"
  },

  // ── 20. SUBSEA BOLTING CORROSION ───────────────────────────────────────
  subsea_bolting_corrosion: {
    id: "subsea_bolting_corrosion",
    display_name: "Subsea Bolting and Fastener Corrosion",
    domain: "subsea",
    prerequisites: {
      has_bolted_connections: true,
      material_family: ["stainless_steel", "carbon_steel", "duplex_steel"]
    },
    indicators: {
      cp_status: {
        failed: 0.40,
        marginal: 0.30,
        adequate: 0.20,
        overprotected: 0.10
      },
      morphology: {
        pitting: 0.40,
        cracking: 0.25,
        general_thinning: 0.25,
        none: 0.10
      },
      zone_depth: {
        deepwater: 0.30,
        shallow: 0.35,
        tidal: 0.20,
        splash: 0.10,
        buried: 0.05
      }
    },
    synergistic_with: ["free_corrosion_cp_failure"],
    competes_with: ["splash_zone_corrosion"],
    severity_default: "medium",
    typical_consequence: "fastener_failure_joint_separation",
    code_reference: "NORSOK M-001"
  },

  // ── 21. SUBSEA SEAL DEGRADATION ────────────────────────────────────────
  seal_degradation_subsea: {
    id: "seal_degradation_subsea",
    display_name: "Subsea Seal and Gasket Degradation",
    domain: "subsea",
    prerequisites: {
      has_seals_gaskets: true,
      high_pressure_environment: true
    },
    indicators: {
      zone_depth: {
        deepwater: 0.40,
        shallow: 0.30,
        tidal: 0.15,
        splash: 0.10,
        buried: 0.05
      },
      water_depth_range: {
        deep_gt300m: 0.40,
        moderate_100_300m: 0.30,
        shallow_lt100m: 0.20,
        ultra_deep_gt1500m: 0.10
      },
      morphology: {
        extrusion: 0.40,
        cracking: 0.30,
        hardening: 0.20,
        none: 0.10
      }
    },
    synergistic_with: ["internal_corrosion_co2"],
    competes_with: ["hydrate_plug_damage"],
    severity_default: "high",
    typical_consequence: "seal_failure_hydrocarbon_leakage",
    code_reference: "API 6A/17D"
  },

  // ── 22. SUBSEA CHOKE/VALVE EROSION ────────────────────────────────────
  choke_erosion_subsea: {
    id: "choke_erosion_subsea",
    display_name: "Subsea Choke and Valve Erosion",
    domain: "subsea",
    prerequisites: {
      has_choke_valve: true,
      high_velocity_flow: true
    },
    indicators: {
      wall_loss_pattern: {
        localized: 0.65,
        uniform: 0.20,
        none: 0.15
      },
      morphology: {
        washout: 0.45,
        grooving: 0.30,
        pitting: 0.15,
        none: 0.10
      },
      current_exposure: {
        high: 0.40,
        moderate: 0.35,
        low: 0.20,
        none: 0.05
      }
    },
    synergistic_with: ["sand_erosion_flowline"],
    competes_with: ["internal_corrosion_co2"],
    severity_default: "high",
    typical_consequence: "choke_flow_path_restriction",
    code_reference: "API 6AV1"
  },

  // ── 23. SAND EROSION IN FLOWLINES ──────────────────────────────────────
  sand_erosion_flowline: {
    id: "sand_erosion_flowline",
    display_name: "Sand Erosion in Subsea Flowlines",
    domain: "subsea",
    prerequisites: {
      high_velocity_flow: true,
      sand_production: true
    },
    indicators: {
      wall_loss_pattern: {
        localized: 0.60,
        uniform: 0.25,
        none: 0.15
      },
      morphology: {
        horseshoe: 0.40,
        grooving: 0.30,
        general_thinning: 0.20,
        none: 0.10
      },
      zone_depth: {
        deepwater: 0.30,
        shallow: 0.30,
        buried: 0.25,
        tidal: 0.10,
        splash: 0.05
      }
    },
    synergistic_with: ["choke_erosion_subsea"],
    competes_with: ["internal_corrosion_co2"],
    severity_default: "high",
    typical_consequence: "erosion_wall_loss_pipeline_failure",
    code_reference: "DNV-RP-O501"
  },

  // ── 24. HYDRATE PLUG MECHANICAL DAMAGE ────────────────────────────────
  hydrate_plug_damage: {
    id: "hydrate_plug_damage",
    display_name: "Hydrate Plug Mechanical Damage",
    domain: "subsea",
    prerequisites: {
      deep_water_pipeline: true,
      cold_service: true
    },
    indicators: {
      wall_loss_pattern: {
        localized: 0.50,
        none: 0.35,
        uniform: 0.15
      },
      morphology: {
        denting: 0.40,
        cracking: 0.25,
        none: 0.25,
        general_thinning: 0.10
      },
      water_depth_range: {
        deep_gt300m: 0.40,
        moderate_100_300m: 0.30,
        shallow_lt100m: 0.20,
        ultra_deep_gt1500m: 0.10
      }
    },
    synergistic_with: ["seal_degradation_subsea"],
    competes_with: ["wax_deposition_damage"],
    severity_default: "medium",
    typical_consequence: "hydrate_blockage_flow_restriction",
    code_reference: "API RP 17A"
  },

  // ── 25. WAX/PARAFFIN DEPOSITION DAMAGE ────────────────────────────────
  wax_deposition_damage: {
    id: "wax_deposition_damage",
    display_name: "Wax and Paraffin Deposition Damage",
    domain: "subsea",
    prerequisites: {
      hydrocarbon_production: true,
      cool_pipeline_environment: true
    },
    indicators: {
      wall_loss_pattern: {
        uniform: 0.40,
        localized: 0.35,
        none: 0.25
      },
      morphology: {
        none: 0.40,
        general_thinning: 0.30,
        restriction: 0.20,
        pitting: 0.10
      },
      zone_depth: {
        deepwater: 0.40,
        shallow: 0.25,
        buried: 0.25,
        tidal: 0.05,
        splash: 0.05
      }
    },
    synergistic_with: ["hydrate_plug_damage"],
    competes_with: ["internal_corrosion_co2"],
    severity_default: "medium",
    typical_consequence: "pipeline_blockage_production_loss",
    code_reference: "API RP 17A"
  },

  // ── 26. THERMAL CYCLING FATIGUE ────────────────────────────────────────
  thermal_cycling_fatigue_subsea: {
    id: "thermal_cycling_fatigue_subsea",
    display_name: "Thermal Cycling Fatigue at Startup/Shutdown",
    domain: "subsea",
    prerequisites: {
      thermal_transient_loading: true,
      material_family: ["carbon_steel", "low_alloy_steel"]
    },
    indicators: {
      crack_orientation: {
        transverse: 0.45,
        linear: 0.30,
        branched: 0.15,
        none: 0.10
      },
      crack_location: {
        weld: 0.40,
        weld_haz: 0.30,
        base_metal: 0.20,
        external: 0.10
      },
      morphology: {
        transgranular: 0.45,
        beach_marks: 0.25,
        crazing: 0.20,
        none: 0.10
      }
    },
    synergistic_with: ["riser_fatigue"],
    competes_with: ["fatigue_tubular_joint"],
    severity_default: "high",
    typical_consequence: "thermal_fatigue_crack_initiation",
    code_reference: "DNV-RP-C203"
  },

  // ── 27. PIPELINE WALKING ──────────────────────────────────────────────
  pipeline_walking: {
    id: "pipeline_walking",
    display_name: "Pipeline Walking and Axial Displacement",
    domain: "subsea",
    prerequisites: {
      buried_pipeline: true,
      high_temperature_service: true
    },
    indicators: {
      zone_depth: {
        deepwater: 0.45,
        shallow: 0.25,
        buried: 0.20,
        tidal: 0.05,
        splash: 0.05
      },
      morphology: {
        buckling: 0.40,
        ovalization: 0.30,
        none: 0.20,
        cracking: 0.10
      },
      wall_loss_pattern: {
        none: 0.50,
        localized: 0.35,
        uniform: 0.15
      }
    },
    synergistic_with: ["upheaval_buckling"],
    competes_with: ["free_corrosion_cp_failure"],
    severity_default: "high",
    typical_consequence: "axial_displacement_anchor_overload",
    code_reference: "DNV-RP-F110"
  },

  // ── 28. UPHEAVAL/LATERAL BUCKLING ────────────────────────────────────
  upheaval_buckling: {
    id: "upheaval_buckling",
    display_name: "Upheaval and Lateral Buckling",
    domain: "subsea",
    prerequisites: {
      buried_pipeline: true,
      thermal_loading: true
    },
    indicators: {
      zone_depth: {
        buried: 0.50,
        deepwater: 0.25,
        shallow: 0.15,
        tidal: 0.05,
        splash: 0.05
      },
      morphology: {
        buckling: 0.50,
        ovalization: 0.25,
        cracking: 0.15,
        none: 0.10
      },
      wall_loss_pattern: {
        none: 0.45,
        localized: 0.40,
        uniform: 0.15
      }
    },
    synergistic_with: ["pipeline_walking"],
    competes_with: ["erosion_scour"],
    severity_default: "high",
    typical_consequence: "buckle_propagation_structural_failure",
    code_reference: "DNV-RP-F110"
  },

  // ── CHLORIDE SCC — Chloride Stress Corrosion Cracking
  chloride_scc: {
    id: "chloride_scc",
    display_name: "Chloride Stress Corrosion Cracking",
    domain: "subsea",
    prerequisites: {
      service_contains_chlorides: true,
      material_family: ["austenitic_stainless", "duplex_stainless"]
    },
    indicators: {
      crack_orientation: {
        random: 0.30,
        linear: 0.25,
        circumferential: 0.20,
        axial: 0.15,
        perpendicular_to_plate: 0.05,
        parallel_to_plate: 0.05
      },
      crack_location: {
        od_surface: 0.35,
        base_metal: 0.25,
        weld_toe: 0.20,
        id_surface: 0.12,
        weld_root: 0.05,
        mid_wall: 0.03
      },
      morphology: {
        branched: 0.55,
        transgranular: 0.25,
        intergranular: 0.08,
        single_planar: 0.08,
        stepwise_blistering: 0.02,
        linear: 0.02
      },
      zone_depth: {
        splash_zone: 0.20,
        tidal_zone: 0.15,
        submerged: 0.40,
        mudline: 0.15,
        buried: 0.10
      },
      water_depth_range: {
        shallow_lt_30m: 0.10,
        moderate_30_100m: 0.20,
        deep_100_500m: 0.40,
        ultra_deep_gt_500m: 0.30
      },
      cp_status: {
        inadequate: 0.20,
        marginal: 0.30,
        adequate: 0.35,
        overprotected: 0.15
      },
      coating_condition: {
        failed: 0.35,
        degraded: 0.30,
        intact: 0.25,
        absent: 0.10
      }
    },
    synergistic_with: ["pitting_corrosion", "weld_root_corrosion"],
    competes_with: ["internal_corrosion_h2s"],
    severity_default: "high",
    typical_consequence: "through_wall_crack_in_stainless_subsea_components",
    code_reference: "DNV-RP-F101, API RP 2A-WSD, NACE SP0110"
  }
};

export { MECHANISMS_SUBSEA };
