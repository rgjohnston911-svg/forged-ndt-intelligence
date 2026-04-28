// @ts-nocheck
// ══════════════════════════════════════════════════════════════════════════════
// DDE MECHANISM KNOWLEDGE BASE — FIXED EQUIPMENT
// 40 damage mechanisms for refining / petrochemical fixed equipment
//
// Sources: API 571 (Damage Mechanisms Affecting Fixed Equipment in the
// Refining Industry), API 579-1, NACE MR0175/ISO 15156
//
// Each mechanism has:
//   prerequisites  — hard gates; if ANY fails, mechanism is eliminated
//   indicators     — P(observation | mechanism) conditional probability tables
//   synergistic_with / competes_with — mechanism interaction flags
//   severity_default, typical_consequence, code_reference — display metadata
//
// Indicator dimensions for fixed equipment:
//   crack_orientation, crack_location, morphology, service_temperature_f,
//   wall_loss_pattern, wall_loss_percent_range, surface_condition,
//   weld_proximity, ph_environment, crack_depth_ratio
// ══════════════════════════════════════════════════════════════════════════════

var MECHANISMS_FIXED = {

  // ── 1. HIC — Hydrogen-Induced Cracking ──────────────────────────────────
  HIC: {
    id: "HIC",
    display_name: "Hydrogen-Induced Cracking",
    domain: "fixed",
    prerequisites: {
      service_contains_h2s: true,
      material_family: ["carbon_steel", "low_alloy_steel"],
      ph_range: [0, 7],
      water_phase_present: true
    },
    indicators: {
      crack_orientation: {
        parallel_to_plate: 0.75,
        perpendicular_to_plate: 0.05,
        random: 0.15,
        circumferential: 0.03,
        axial: 0.02
      },
      crack_location: {
        mid_wall: 0.70,
        id_surface: 0.20,
        od_surface: 0.03,
        weld_toe: 0.05,
        weld_root: 0.02
      },
      morphology: {
        stepwise_blistering: 0.65,
        single_planar: 0.20,
        branched: 0.10,
        transgranular: 0.03,
        intergranular: 0.02
      },
      service_temperature_f: {
        below_150: 0.60,
        "150_to_300": 0.30,
        "300_to_500": 0.08,
        above_500: 0.02
      },
      wall_loss_pattern: {
        localized_blistering: 0.70,
        uniform: 0.05,
        pitting: 0.10,
        grooving: 0.05,
        none_visible: 0.10
      },
      surface_condition: {
        blistered: 0.75,
        clean: 0.10,
        corroded: 0.10,
        scaled: 0.05
      }
    },
    synergistic_with: ["SOHIC", "SSC"],
    competes_with: ["fatigue", "creep", "naphthenic_acid_corrosion"],
    severity_default: "high",
    typical_consequence: "through_wall_leak",
    code_reference: "API 571 §5.1.2.3, NACE MR0175/ISO 15156"
  },

  // ── 2. SSC — Sulfide Stress Cracking ────────────────────────────────────
  SSC: {
    id: "SSC",
    display_name: "Sulfide Stress Cracking",
    domain: "fixed",
    prerequisites: {
      service_contains_h2s: true,
      material_family: ["carbon_steel", "low_alloy_steel", "high_strength_steel"],
      hardness_above_22hrc: true
    },
    indicators: {
      crack_orientation: {
        perpendicular_to_plate: 0.60,
        parallel_to_plate: 0.10,
        random: 0.10,
        circumferential: 0.15,
        axial: 0.05
      },
      crack_location: {
        weld_toe: 0.40,
        weld_root: 0.15,
        id_surface: 0.25,
        od_surface: 0.05,
        mid_wall: 0.15
      },
      morphology: {
        branched: 0.15,
        single_planar: 0.45,
        transgranular: 0.10,
        intergranular: 0.25,
        stepwise_blistering: 0.05
      },
      service_temperature_f: {
        below_150: 0.55,
        "150_to_300": 0.35,
        "300_to_500": 0.08,
        above_500: 0.02
      },
      weld_proximity: {
        at_weld: 0.55,
        near_weld_haz: 0.30,
        away_from_weld: 0.15
      },
      crack_depth_ratio: {
        shallow_lt_25pct: 0.20,
        moderate_25_50pct: 0.35,
        deep_gt_50pct: 0.45
      }
    },
    synergistic_with: ["HIC", "SOHIC"],
    competes_with: ["chloride_scc", "caustic_cracking", "fatigue"],
    severity_default: "high",
    typical_consequence: "sudden_brittle_fracture",
    code_reference: "API 571 §5.1.2.2, NACE MR0175/ISO 15156, NACE TM0177"
  },

  // ── 3. SOHIC — Stress-Oriented HIC ─────────────────────────────────────
  SOHIC: {
    id: "SOHIC",
    display_name: "Stress-Oriented Hydrogen-Induced Cracking",
    domain: "fixed",
    prerequisites: {
      service_contains_h2s: true,
      material_family: ["carbon_steel", "low_alloy_steel"],
      water_phase_present: true,
      residual_or_applied_stress: true
    },
    indicators: {
      crack_orientation: {
        perpendicular_to_plate: 0.65,
        parallel_to_plate: 0.15,
        random: 0.10,
        circumferential: 0.05,
        axial: 0.05
      },
      crack_location: {
        weld_toe: 0.45,
        weld_root: 0.15,
        id_surface: 0.20,
        mid_wall: 0.15,
        od_surface: 0.05
      },
      morphology: {
        stepwise_blistering: 0.35,
        single_planar: 0.15,
        branched: 0.10,
        intergranular: 0.20,
        transgranular: 0.20
      },
      service_temperature_f: {
        below_150: 0.50,
        "150_to_300": 0.35,
        "300_to_500": 0.12,
        above_500: 0.03
      },
      weld_proximity: {
        at_weld: 0.50,
        near_weld_haz: 0.35,
        away_from_weld: 0.15
      }
    },
    synergistic_with: ["HIC", "SSC"],
    competes_with: ["fatigue", "caustic_cracking"],
    severity_default: "high",
    typical_consequence: "through_wall_crack_at_weld",
    code_reference: "API 571 §5.1.2.4"
  },

  // ── 4. AMINE CRACKING ──────────────────────────────────────────────────
  amine_cracking: {
    id: "amine_cracking",
    display_name: "Amine Stress Corrosion Cracking",
    domain: "fixed",
    prerequisites: {
      service_contains_amine: true,
      material_family: ["carbon_steel"],
      residual_or_applied_stress: true
    },
    indicators: {
      crack_orientation: {
        circumferential: 0.40,
        perpendicular_to_plate: 0.15,
        transverse: 0.12,
        axial: 0.10,
        parallel_to_plate: 0.08,
        random: 0.08,
        linear: 0.07
      },
      crack_location: {
        weld_toe: 0.30,
        HAZ: 0.25,
        weld_root: 0.10,
        base_metal: 0.10,
        id_surface: 0.10,
        mid_wall: 0.10,
        od_surface: 0.05
      },
      morphology: {
        intergranular: 0.65,
        transgranular: 0.15,
        branched: 0.10,
        single_planar: 0.08,
        stepwise_blistering: 0.02
      },
      service_temperature_f: {
        below_150: 0.30,
        "150_to_300": 0.50,
        "300_to_500": 0.15,
        above_500: 0.05
      },
      weld_proximity: {
        at_weld: 0.60,
        near_weld_haz: 0.25,
        away_from_weld: 0.15
      }
    },
    synergistic_with: ["general_corrosion"],
    competes_with: ["caustic_cracking", "SSC", "chloride_scc"],
    severity_default: "high",
    typical_consequence: "through_wall_crack_at_weld",
    code_reference: "API 571 §5.1.2.7, API RP 945"
  },

  // ── 5. CAUSTIC CRACKING (Caustic SCC) ──────────────────────────────────
  caustic_cracking: {
    id: "caustic_cracking",
    display_name: "Caustic Stress Corrosion Cracking",
    domain: "fixed",
    prerequisites: {
      service_contains_caustic: true,
      material_family: ["carbon_steel", "low_alloy_steel"],
      service_temp_above_f: 120
    },
    indicators: {
      crack_orientation: {
        circumferential: 0.40,
        axial: 0.15,
        perpendicular_to_plate: 0.20,
        parallel_to_plate: 0.10,
        random: 0.15
      },
      crack_location: {
        weld_toe: 0.45,
        weld_root: 0.20,
        id_surface: 0.20,
        od_surface: 0.05,
        mid_wall: 0.10
      },
      morphology: {
        intergranular: 0.70,
        transgranular: 0.10,
        branched: 0.10,
        single_planar: 0.08,
        stepwise_blistering: 0.02
      },
      service_temperature_f: {
        below_150: 0.10,
        "150_to_300": 0.50,
        "300_to_500": 0.30,
        above_500: 0.10
      },
      surface_condition: {
        clean: 0.15,
        corroded: 0.30,
        scaled: 0.40,
        blistered: 0.15
      }
    },
    synergistic_with: [],
    competes_with: ["amine_cracking", "SSC", "chloride_scc"],
    severity_default: "high",
    typical_consequence: "sudden_brittle_fracture",
    code_reference: "API 571 §5.1.2.6, NACE SP0403"
  },

  // ── 6. CHLORIDE SCC ────────────────────────────────────────────────────
  chloride_scc: {
    id: "chloride_scc",
    display_name: "Chloride Stress Corrosion Cracking",
    domain: "fixed",
    prerequisites: {
      service_contains_chlorides: true,
      material_family: ["austenitic_stainless", "duplex_stainless"],
      service_temp_above_f: 140
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
        od_surface: 0.30,
        base_metal: 0.25,
        id_surface: 0.20,
        weld_toe: 0.15,
        weld_root: 0.05,
        mid_wall: 0.05
      },
      morphology: {
        branched: 0.55,
        transgranular: 0.25,
        intergranular: 0.08,
        single_planar: 0.08,
        stepwise_blistering: 0.02,
        linear: 0.02
      },
      service_temperature_f: {
        below_150: 0.10,
        "150_to_300": 0.45,
        "300_to_500": 0.35,
        above_500: 0.10
      },
      surface_condition: {
        corroded: 0.30,
        clean: 0.20,
        scaled: 0.15,
        blistered: 0.35
      }
    },
    synergistic_with: ["pitting_corrosion"],
    competes_with: ["caustic_cracking", "amine_cracking", "SSC"],
    severity_default: "high",
    typical_consequence: "through_wall_crack",
    code_reference: "API 571 §5.1.2.1, NACE SP0110"
  },

  // ── 7. NAPHTHENIC ACID CORROSION ───────────────────────────────────────
  naphthenic_acid_corrosion: {
    id: "naphthenic_acid_corrosion",
    display_name: "Naphthenic Acid Corrosion",
    domain: "fixed",
    prerequisites: {
      service_contains_naphthenic_acid: true,
      service_temp_above_f: 425,
      tan_above_threshold: true
    },
    indicators: {
      wall_loss_pattern: {
        grooving: 0.30,
        general_loss: 0.18,
        general: 0.15,
        uniform: 0.12,
        pitting: 0.10,
        none_visible: 0.10,
        localized_blistering: 0.05
      },
      wall_loss_percent_range: {
        lt_10: 0.10,
        "10_to_25": 0.25,
        "25_to_50": 0.40,
        gt_50: 0.25
      },
      service_temperature_f: {
        below_150: 0.01,
        "150_to_300": 0.02,
        "300_to_500": 0.17,
        above_500: 0.80
      },
      surface_condition: {
        corroded: 0.50,
        clean: 0.05,
        scaled: 0.25,
        blistered: 0.10,
        carburized: 0.10
      },
      crack_location: {
        id_surface: 0.55,
        base_metal: 0.15,
        weld_toe: 0.10,
        od_surface: 0.05,
        weld_root: 0.05,
        mid_wall: 0.10
      }
    },
    synergistic_with: ["sulfidation"],
    competes_with: ["general_corrosion", "HIC"],
    severity_default: "medium",
    typical_consequence: "accelerated_thinning",
    code_reference: "API 571 §5.1.1.2, NACE 34105"
  },

  // ── 8. GENERAL CORROSION ───────────────────────────────────────────────
  general_corrosion: {
    id: "general_corrosion",
    display_name: "General / Uniform Corrosion",
    domain: "fixed",
    prerequisites: {
      material_family: ["carbon_steel", "low_alloy_steel", "austenitic_stainless", "duplex_stainless"]
    },
    indicators: {
      wall_loss_pattern: {
        uniform: 0.65,
        pitting: 0.10,
        grooving: 0.10,
        localized_blistering: 0.05,
        none_visible: 0.10
      },
      wall_loss_percent_range: {
        lt_10: 0.30,
        "10_to_25": 0.35,
        "25_to_50": 0.25,
        gt_50: 0.10
      },
      surface_condition: {
        corroded: 0.65,
        scaled: 0.20,
        clean: 0.10,
        blistered: 0.05
      },
      crack_location: {
        id_surface: 0.45,
        od_surface: 0.35,
        weld_toe: 0.10,
        weld_root: 0.05,
        mid_wall: 0.05
      },
      service_temperature_f: {
        below_150: 0.25,
        "150_to_300": 0.30,
        "300_to_500": 0.30,
        above_500: 0.15
      }
    },
    synergistic_with: [],
    competes_with: ["naphthenic_acid_corrosion", "CUI", "MIC", "erosion_corrosion"],
    severity_default: "medium",
    typical_consequence: "wall_thinning",
    code_reference: "API 571 §5.1.1.1, API 579 Part 4/5"
  },

  // ── 9. CUI — Corrosion Under Insulation ────────────────────────────────
  CUI: {
    id: "CUI",
    display_name: "Corrosion Under Insulation",
    domain: "fixed",
    prerequisites: {
      insulation_present: true,
      material_family: ["carbon_steel", "low_alloy_steel", "austenitic_stainless"]
    },
    indicators: {
      wall_loss_pattern: {
        localized_blistering: 0.35,
        uniform: 0.25,
        pitting: 0.25,
        grooving: 0.05,
        none_visible: 0.10
      },
      morphology: {
        volumetric: 0.35,
        general: 0.25,
        pitting: 0.25,
        localized: 0.10,
        branched: 0.05
      },
      crack_orientation: {
        circumferential: 0.35,
        axial: 0.25,
        linear: 0.20,
        random: 0.15,
        transverse: 0.05
      },
      crack_location: {
        od_surface: 0.65,
        base_metal: 0.15,
        id_surface: 0.05,
        weld_toe: 0.05,
        weld_root: 0.02,
        mid_wall: 0.08
      },
      service_temperature_f: {
        below_150: 0.25,
        "150_to_300": 0.50,
        "300_to_500": 0.20,
        above_500: 0.05
      },
      surface_condition: {
        corroded: 0.60,
        blistered: 0.20,
        scaled: 0.15,
        clean: 0.05
      },
      wall_loss_percent_range: {
        lt_10: 0.20,
        "10_to_25": 0.35,
        "25_to_50": 0.30,
        gt_50: 0.15
      }
    },
    synergistic_with: ["chloride_scc"],
    competes_with: ["general_corrosion", "erosion_corrosion"],
    severity_default: "high",
    typical_consequence: "hidden_wall_loss_under_insulation",
    code_reference: "API 571 §5.1.1.3, API RP 583, NACE SP0198"
  },

  // ── 9b. SYSTEMIC_CUI — Systemic Corrosion Under Insulation ────────────────
  systemic_CUI: {
    id: "systemic_CUI",
    display_name: "Systemic Corrosion Under Insulation",
    domain: "fixed",
    prerequisites: {
      insulation_present: true
    },
    indicators: {
      wall_loss_pattern: {
        localized: 0.20,
        uniform: 0.25,
        pitting: 0.25,
        general: 0.20,
        network: 0.10
      },
      morphology: {
        volumetric: 0.40,
        general: 0.30,
        pitting: 0.20,
        localized: 0.10
      },
      service_temperature_f: {
        below_150: 0.25,
        "150_to_300": 0.50,
        "300_to_500": 0.20,
        above_500: 0.05
      },
      surface_condition: {
        corroded: 0.60,
        blistered: 0.20,
        scaled: 0.15,
        clean: 0.05
      }
    },
    synergistic_with: ["CUI", "chloride_scc"],
    competes_with: ["general_corrosion", "erosion_corrosion"],
    severity_default: "high",
    typical_consequence: "widespread_corrosion_under_insulation",
    code_reference: "API 571 §5.1.1.3, API RP 583, NACE SP0198"
  },

  // ── 10. MIC — Microbiologically Influenced Corrosion ───────────────────
  MIC: {
    id: "MIC",
    display_name: "Microbiologically Influenced Corrosion",
    domain: "fixed",
    prerequisites: {
      water_phase_present: true,
      material_family: ["carbon_steel", "low_alloy_steel", "austenitic_stainless"]
    },
    indicators: {
      wall_loss_pattern: {
        pitting: 0.60,
        localized_blistering: 0.15,
        uniform: 0.10,
        grooving: 0.05,
        none_visible: 0.10
      },
      crack_location: {
        id_surface: 0.65,
        weld_toe: 0.15,
        weld_root: 0.10,
        od_surface: 0.05,
        mid_wall: 0.05
      },
      surface_condition: {
        corroded: 0.40,
        blistered: 0.30,
        scaled: 0.20,
        clean: 0.10
      },
      service_temperature_f: {
        below_150: 0.60,
        "150_to_300": 0.30,
        "300_to_500": 0.08,
        above_500: 0.02
      },
      wall_loss_percent_range: {
        lt_10: 0.20,
        "10_to_25": 0.30,
        "25_to_50": 0.35,
        gt_50: 0.15
      }
    },
    synergistic_with: ["general_corrosion"],
    competes_with: ["pitting_corrosion", "CUI"],
    severity_default: "medium",
    typical_consequence: "localized_pitting_perforation",
    code_reference: "API 571 §5.1.1.4, NACE TM0194, NACE SP0106"
  },

  // ── 11. FATIGUE ────────────────────────────────────────────────────────
  fatigue: {
    id: "fatigue",
    display_name: "Mechanical / Vibration Fatigue",
    domain: "fixed",
    prerequisites: {
      cyclic_loading_present: true,
      material_family: ["carbon_steel", "low_alloy_steel", "austenitic_stainless", "duplex_stainless", "high_strength_steel"]
    },
    indicators: {
      crack_orientation: {
        perpendicular_to_plate: 0.60,
        circumferential: 0.20,
        axial: 0.10,
        parallel_to_plate: 0.05,
        random: 0.05
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
        branched: 0.05,
        intergranular: 0.05,
        stepwise_blistering: 0.10
      },
      surface_condition: {
        clean: 0.55,
        corroded: 0.25,
        scaled: 0.10,
        blistered: 0.10
      },
      crack_depth_ratio: {
        shallow_lt_25pct: 0.30,
        moderate_25_50pct: 0.40,
        deep_gt_50pct: 0.30
      }
    },
    synergistic_with: ["general_corrosion"],
    competes_with: ["HIC", "SSC", "creep"],
    severity_default: "high",
    typical_consequence: "fatigue_crack_propagation",
    code_reference: "API 571 §5.1.3.1, API 579 Part 9, BS 7910"
  },

  // ── 12. CREEP ──────────────────────────────────────────────────────────
  creep: {
    id: "creep",
    display_name: "High Temperature Creep",
    domain: "fixed",
    prerequisites: {
      service_temp_above_f: 700,
      material_family: ["carbon_steel", "low_alloy_steel", "high_strength_steel"]
    },
    indicators: {
      crack_orientation: {
        random: 0.30,
        circumferential: 0.25,
        axial: 0.20,
        perpendicular_to_plate: 0.15,
        parallel_to_plate: 0.10
      },
      crack_location: {
        weld_toe: 0.35,
        weld_root: 0.25,
        od_surface: 0.15,
        id_surface: 0.15,
        mid_wall: 0.10
      },
      morphology: {
        intergranular: 0.65,
        single_planar: 0.15,
        branched: 0.10,
        transgranular: 0.05,
        stepwise_blistering: 0.05
      },
      service_temperature_f: {
        below_150: 0.01,
        "150_to_300": 0.02,
        "300_to_500": 0.07,
        above_500: 0.90
      },
      surface_condition: {
        scaled: 0.50,
        corroded: 0.25,
        clean: 0.15,
        blistered: 0.10
      }
    },
    synergistic_with: ["sulfidation"],
    competes_with: ["fatigue", "HIC"],
    severity_default: "high",
    typical_consequence: "creep_rupture",
    code_reference: "API 571 §5.1.3.2, API 579 Part 10, API 530"
  },

  // ── 13. HYDROGEN EMBRITTLEMENT ─────────────────────────────────────────
  hydrogen_embrittlement: {
    id: "hydrogen_embrittlement",
    display_name: "Hydrogen Embrittlement",
    domain: "fixed",
    prerequisites: {
      hydrogen_charging_present: true,
      material_family: ["carbon_steel", "low_alloy_steel", "high_strength_steel"]
    },
    indicators: {
      crack_orientation: {
        perpendicular_to_plate: 0.50,
        random: 0.20,
        circumferential: 0.15,
        axial: 0.10,
        parallel_to_plate: 0.05
      },
      crack_location: {
        weld_toe: 0.35,
        weld_root: 0.20,
        id_surface: 0.25,
        od_surface: 0.10,
        mid_wall: 0.10
      },
      morphology: {
        intergranular: 0.55,
        transgranular: 0.20,
        single_planar: 0.15,
        branched: 0.08,
        stepwise_blistering: 0.02
      },
      service_temperature_f: {
        below_150: 0.50,
        "150_to_300": 0.35,
        "300_to_500": 0.12,
        above_500: 0.03
      },
      crack_depth_ratio: {
        shallow_lt_25pct: 0.15,
        moderate_25_50pct: 0.35,
        deep_gt_50pct: 0.50
      }
    },
    synergistic_with: ["SSC", "HIC"],
    competes_with: ["fatigue", "creep"],
    severity_default: "high",
    typical_consequence: "sudden_brittle_fracture",
    code_reference: "API 571 §5.1.2.5, NACE MR0175"
  },

  // ── 14. EROSION-CORROSION ──────────────────────────────────────────────
  erosion_corrosion: {
    id: "erosion_corrosion",
    display_name: "Erosion-Corrosion",
    domain: "fixed",
    prerequisites: {
      high_velocity_or_turbulent_flow: true,
      material_family: ["carbon_steel", "low_alloy_steel", "austenitic_stainless"]
    },
    indicators: {
      wall_loss_pattern: {
        grooving: 0.50,
        uniform: 0.15,
        pitting: 0.15,
        localized_blistering: 0.10,
        none_visible: 0.10
      },
      wall_loss_percent_range: {
        lt_10: 0.10,
        "10_to_25": 0.25,
        "25_to_50": 0.40,
        gt_50: 0.25
      },
      crack_location: {
        id_surface: 0.70,
        weld_toe: 0.10,
        od_surface: 0.05,
        weld_root: 0.05,
        mid_wall: 0.10
      },
      surface_condition: {
        corroded: 0.40,
        clean: 0.30,
        scaled: 0.15,
        blistered: 0.15
      },
      service_temperature_f: {
        below_150: 0.20,
        "150_to_300": 0.35,
        "300_to_500": 0.30,
        above_500: 0.15
      }
    },
    synergistic_with: ["general_corrosion"],
    competes_with: ["CUI", "naphthenic_acid_corrosion"],
    severity_default: "medium",
    typical_consequence: "accelerated_thinning_at_bends",
    code_reference: "API 571 §5.1.1.5, API RP 14E"
  },

  // ── 15. TEMPER EMBRITTLEMENT ───────────────────────────────────────────
  temper_embrittlement: {
    id: "temper_embrittlement",
    display_name: "Temper Embrittlement",
    domain: "fixed",
    prerequisites: {
      service_temp_above_f: 650,
      material_family: ["low_alloy_steel", "carbon_steel"],
      contains_tramp_elements: true
    },
    indicators: {
      morphology: {
        intergranular: 0.75,
        transgranular: 0.10,
        single_planar: 0.10,
        branched: 0.03,
        stepwise_blistering: 0.02
      },
      crack_location: {
        weld_toe: 0.30,
        weld_root: 0.20,
        mid_wall: 0.25,
        id_surface: 0.15,
        od_surface: 0.10
      },
      service_temperature_f: {
        below_150: 0.05,
        "150_to_300": 0.05,
        "300_to_500": 0.10,
        above_500: 0.80
      },
      crack_depth_ratio: {
        shallow_lt_25pct: 0.15,
        moderate_25_50pct: 0.30,
        deep_gt_50pct: 0.55
      }
    },
    synergistic_with: ["creep"],
    competes_with: ["hydrogen_embrittlement", "SSC"],
    severity_default: "high",
    typical_consequence: "brittle_fracture_on_cooldown",
    code_reference: "API 571 §5.1.3.3, API 579 Part 3 (brittle fracture assessment)"
  },

  // ── 16. HTHA — High Temperature Hydrogen Attack ──────────────────────────
  HTHA: {
    id: "HTHA",
    display_name: "High Temperature Hydrogen Attack",
    domain: "fixed",
    prerequisites: {
      service_temperature_f: 400,
      hydrogen_service: true
    },
    indicators: {
      service_temperature_f: {
        high_gt600: 0.60,
        moderate_400_600: 0.35,
        low_lt400: 0.05
      },
      wall_loss_pattern: {
        uniform: 0.15,
        localized: 0.25,
        none: 0.60
      },
      morphology: {
        fissuring: 0.50,
        volumetric: 0.45,
        decarburization: 0.30,
        blistering: 0.10,
        none: 0.05
      },
      crack_location: {
        mid_wall: 0.45,
        base_metal: 0.40,
        internal: 0.30,
        external: 0.10,
        weld: 0.05
      },
      wall_loss_pattern: {
        none: 0.55,
        localized: 0.25,
        uniform: 0.15
      },
      surface_condition: {
        clean: 0.35,
        discolored: 0.30,
        blistered: 0.25,
        pitted: 0.10
      }
    },
    synergistic_with: ["creep", "sulfidation"],
    competes_with: ["HIC", "general_corrosion"],
    severity_default: "high",
    typical_consequence: "subsurface_fissuring_and_decarburization",
    code_reference: "API 941"
  },

  // ── 17. SULFIDATION — High Temperature Sulfidation ──────────────────────
  sulfidation: {
    id: "sulfidation",
    display_name: "High Temperature Sulfidation",
    domain: "fixed",
    prerequisites: {
      sulfur_present: true,
      service_temperature_f: 450
    },
    indicators: {
      service_temperature_f: {
        high_gt600: 0.55,
        moderate_400_600: 0.40,
        low_lt400: 0.05
      },
      wall_loss_pattern: {
        uniform: 0.35,
        general: 0.30,
        localized: 0.20,
        pitting: 0.10,
        network: 0.05
      },
      morphology: {
        volumetric: 0.35,
        general: 0.25,
        uniform: 0.20,
        pitting: 0.15,
        localized: 0.05
      },
      surface_condition: {
        scale_sulfide: 0.60,
        clean: 0.10,
        pitted: 0.20,
        cracked: 0.10
      }
    },
    synergistic_with: ["naphthenic_acid_corrosion", "HTHA"],
    competes_with: ["general_corrosion", "creep"],
    severity_default: "high",
    typical_consequence: "accelerated_uniform_loss",
    code_reference: "API 571 Section 4.4.2"
  },

  // ── 18. POLYTHIONIC ACID SCC — Polythionic Acid Stress Corrosion Cracking
  polythionic_acid_scc: {
    id: "polythionic_acid_scc",
    display_name: "Polythionic Acid SCC",
    domain: "fixed",
    prerequisites: {
      austenitic_ss: true,
      sulfide_scale: true
    },
    indicators: {
      crack_orientation: {
        branched: 0.45,
        intergranular: 0.25,
        longitudinal: 0.10,
        transgranular: 0.08,
        linear: 0.08,
        none: 0.04
      },
      morphology: {
        intergranular: 0.55,
        mixed: 0.15,
        planar: 0.12,
        transgranular: 0.10,
        none: 0.04,
        branched: 0.04
      },
      crack_location: {
        weld_haz: 0.30,
        heat_affected_zone: 0.20,
        base_metal: 0.25,
        external: 0.15,
        internal: 0.10
      }
    },
    synergistic_with: ["chloride_scc"],
    competes_with: ["caustic_cracking"],
    severity_default: "high",
    typical_consequence: "intergranular_cracking",
    code_reference: "API 571 Section 4.5.3"
  },

  // ── 19. GALVANIC CORROSION — Galvanic/Bimetallic Corrosion ───────────────
  galvanic_corrosion: {
    id: "galvanic_corrosion",
    display_name: "Galvanic/Bimetallic Corrosion",
    domain: "fixed",
    prerequisites: {
      dissimilar_metals: true
    },
    indicators: {
      wall_loss_pattern: {
        localized: 0.65,
        uniform: 0.25,
        none: 0.10
      },
      crack_location: {
        weld: 0.40,
        external: 0.35,
        internal: 0.20,
        base_metal: 0.05
      },
      morphology: {
        pitting: 0.30,
        general_thinning: 0.50,
        grooving: 0.15,
        none: 0.05
      }
    },
    synergistic_with: ["general_corrosion", "erosion_corrosion"],
    competes_with: ["MIC", "oxygen_pitting"],
    severity_default: "medium",
    typical_consequence: "localized_attack_at_junction",
    code_reference: "NACE SP0169"
  },

  // ── 20. CO2 CORROSION — CO2/Sweet Corrosion ──────────────────────────────
  CO2_corrosion: {
    id: "CO2_corrosion",
    display_name: "CO2/Sweet Corrosion",
    domain: "fixed",
    prerequisites: {
      co2_present: true,
      aqueous: true
    },
    indicators: {
      wall_loss_pattern: {
        localized: 0.45,
        uniform: 0.40,
        none: 0.15
      },
      morphology: {
        mesa_attack: 0.40,
        general_thinning: 0.35,
        pitting: 0.20,
        none: 0.05
      },
      ph_environment: {
        acidic_lt4: 0.55,
        mildly_acidic_4_6: 0.35,
        neutral_6_8: 0.08,
        alkaline_gt8: 0.02
      }
    },
    synergistic_with: ["oxygen_pitting", "flow_accelerated_corrosion"],
    competes_with: ["general_corrosion"],
    severity_default: "medium",
    typical_consequence: "localized_or_uniform_thinning",
    code_reference: "NACE SP0106"
  },

  // ── 21. WELD LACK OF FUSION — Weld Lack of Fusion ────────────────────────
  weld_lack_of_fusion: {
    id: "weld_lack_of_fusion",
    display_name: "Weld Lack of Fusion",
    domain: "fixed",
    prerequisites: {},
    indicators: {
      crack_orientation: {
        linear: 0.60,
        none: 0.20,
        transverse: 0.15,
        branched: 0.05
      },
      crack_location: {
        weld: 0.70,
        weld_haz: 0.20,
        base_metal: 0.05,
        external: 0.05
      },
      morphology: {
        planar: 0.65,
        volumetric: 0.20,
        none: 0.10,
        linear: 0.05
      },
      wall_loss_pattern: {
        none: 0.80,
        localized: 0.15,
        uniform: 0.05
      }
    },
    synergistic_with: ["fatigue"],
    competes_with: ["weld_slag_inclusion", "weld_porosity"],
    severity_default: "high",
    typical_consequence: "stress_concentration_point",
    code_reference: "ASME IX, AWS D1.1"
  },

  // ── 22. WELD POROSITY — Weld Porosity ────────────────────────────────────
  weld_porosity: {
    id: "weld_porosity",
    display_name: "Weld Porosity",
    domain: "fixed",
    prerequisites: {},
    indicators: {
      morphology: {
        volumetric: 0.65,
        scattered: 0.25,
        clustered: 0.08,
        none: 0.02
      },
      crack_location: {
        weld: 0.75,
        weld_haz: 0.15,
        base_metal: 0.05,
        external: 0.05
      },
      wall_loss_pattern: {
        none: 0.85,
        localized: 0.10,
        uniform: 0.05
      }
    },
    synergistic_with: ["fatigue"],
    competes_with: ["weld_slag_inclusion", "weld_lack_of_fusion"],
    severity_default: "low",
    typical_consequence: "pressure_tightness_loss",
    code_reference: "ASME IX"
  },

  // ── 23. WELD SLAG INCLUSION — Weld Slag Inclusion ────────────────────────
  weld_slag_inclusion: {
    id: "weld_slag_inclusion",
    display_name: "Weld Slag Inclusion",
    domain: "fixed",
    prerequisites: {},
    indicators: {
      morphology: {
        volumetric: 0.55,
        linear: 0.35,
        none: 0.08,
        scattered: 0.02
      },
      crack_location: {
        weld: 0.70,
        weld_haz: 0.20,
        base_metal: 0.05,
        external: 0.05
      },
      wall_loss_pattern: {
        none: 0.80,
        localized: 0.15,
        uniform: 0.05
      }
    },
    synergistic_with: ["fatigue"],
    competes_with: ["weld_porosity", "weld_lack_of_fusion"],
    severity_default: "medium",
    typical_consequence: "fatigue_initiation_site",
    code_reference: "ASME IX"
  },

  // ── 24. GRAPHITIZATION — Graphitization ──────────────────────────────────
  graphitization: {
    id: "graphitization",
    display_name: "Graphitization",
    domain: "fixed",
    prerequisites: {
      carbon_steel: true,
      service_temperature_f: 800
    },
    indicators: {
      service_temperature_f: {
        high_gt600: 0.70,
        moderate_400_600: 0.25,
        low_lt400: 0.05
      },
      morphology: {
        graphite_nodules: 0.60,
        decarburization: 0.25,
        none: 0.10,
        general_thinning: 0.05
      },
      crack_location: {
        weld_haz: 0.50,
        base_metal: 0.35,
        weld: 0.10,
        external: 0.05
      }
    },
    synergistic_with: ["creep", "HTHA"],
    competes_with: ["temper_embrittlement"],
    severity_default: "high",
    typical_consequence: "loss_of_ductility",
    code_reference: "API 571 Section 4.2.4"
  },

  // ── 25. CARBURIZATION — Carburization/Metal Dusting ──────────────────────
  carburization: {
    id: "carburization",
    display_name: "Carburization/Metal Dusting",
    domain: "fixed",
    prerequisites: {
      high_temperature: true,
      carbon_rich: true
    },
    indicators: {
      service_temperature_f: {
        high_gt600: 0.65,
        moderate_400_600: 0.30,
        low_lt400: 0.05
      },
      morphology: {
        pitting: 0.45,
        metal_dusting: 0.35,
        general_thinning: 0.15,
        none: 0.05
      },
      wall_loss_pattern: {
        localized: 0.55,
        uniform: 0.30,
        none: 0.15
      }
    },
    synergistic_with: ["sulfidation", "HTHA"],
    competes_with: ["general_corrosion"],
    severity_default: "high",
    typical_consequence: "rapid_metal_loss_and_disintegration",
    code_reference: "API 571 Section 4.2.5"
  },

  // ── 26. SIGMA PHASE EMBRITTLEMENT — Sigma Phase Embrittlement ────────────
  sigma_phase_embrittlement: {
    id: "sigma_phase_embrittlement",
    display_name: "Sigma Phase Embrittlement",
    domain: "fixed",
    prerequisites: {
      austenitic_or_duplex_ss: true,
      temp_600_1000F: true
    },
    indicators: {
      service_temperature_f: {
        high_gt600: 0.65,
        moderate_400_600: 0.30,
        low_lt400: 0.05
      },
      morphology: {
        intergranular: 0.55,
        brittle_fracture: 0.30,
        none: 0.10,
        transgranular: 0.05
      },
      crack_location: {
        weld_haz: 0.45,
        weld: 0.30,
        base_metal: 0.20,
        external: 0.05
      }
    },
    synergistic_with: ["creep"],
    competes_with: ["chloride_scc"],
    severity_default: "high",
    typical_consequence: "brittleness_at_elevated_temperature",
    code_reference: "API 571 Section 4.2.6"
  },

  // ── 27. 885F EMBRITTLEMENT — 885 Degree F Embrittlement ──────────────────
  "885f_embrittlement": {
    id: "885f_embrittlement",
    display_name: "885°F Embrittlement",
    domain: "fixed",
    prerequisites: {
      ferritic_ss_or_duplex: true,
      temp_700_1000F: true
    },
    indicators: {
      service_temperature_f: {
        high_gt600: 0.70,
        moderate_400_600: 0.25,
        low_lt400: 0.05
      },
      morphology: {
        brittle_fracture: 0.55,
        intergranular: 0.30,
        none: 0.10,
        transgranular: 0.05
      },
      crack_orientation: {
        none: 0.50,
        transverse: 0.25,
        linear: 0.15,
        branched: 0.10
      }
    },
    synergistic_with: ["temper_embrittlement"],
    competes_with: ["hydrogen_embrittlement"],
    severity_default: "high",
    typical_consequence: "service_embrittlement_around_885_deg_f",
    code_reference: "API 571 Section 4.2.7"
  },

  // ── 28. BRITTLE FRACTURE — Brittle Fracture ──────────────────────────────
  brittle_fracture: {
    id: "brittle_fracture",
    display_name: "Brittle Fracture",
    domain: "fixed",
    prerequisites: {
      low_temperature_or_impact: true
    },
    indicators: {
      service_temperature_f: {
        low_lt400: 0.55,
        moderate_400_600: 0.25,
        high_gt600: 0.20
      },
      morphology: {
        cleavage: 0.55,
        brittle_fracture: 0.30,
        transgranular: 0.10,
        none: 0.05
      },
      crack_orientation: {
        transverse: 0.45,
        linear: 0.35,
        branched: 0.10,
        none: 0.10
      }
    },
    synergistic_with: ["hydrogen_embrittlement"],
    competes_with: ["fatigue"],
    severity_default: "high",
    typical_consequence: "sudden_catastrophic_failure",
    code_reference: "API 579-1 Part 3"
  },

  // ── 29. REHEAT CRACKING — Reheat/Stress Relief Cracking ──────────────────
  reheat_cracking: {
    id: "reheat_cracking",
    display_name: "Reheat/Stress Relief Cracking",
    domain: "fixed",
    prerequisites: {
      cr_mo_steel_or_ss: true,
      pwht: true
    },
    indicators: {
      crack_location: {
        weld_haz: 0.55,
        weld: 0.20,
        base_metal: 0.05,
        external: 0.05,
        HAZ: 0.15
      },
      morphology: {
        intergranular: 0.55,
        transgranular: 0.14,
        none: 0.15,
        mixed: 0.10,
        planar: 0.06
      },
      crack_orientation: {
        transverse: 0.40,
        linear: 0.35,
        branched: 0.10,
        none: 0.10,
        axial: 0.05
      }
    },
    synergistic_with: [],
    competes_with: ["fatigue", "SOHIC"],
    severity_default: "high",
    typical_consequence: "delayed_cracking_post_stress_relief",
    code_reference: "API 571 Section 4.2.15"
  },

  // ── 30. UNDER-DEPOSIT CORROSION — Under-Deposit Corrosion ────────────────
  under_deposit_corrosion: {
    id: "under_deposit_corrosion",
    display_name: "Under-Deposit Corrosion",
    domain: "fixed",
    prerequisites: {},
    indicators: {
      wall_loss_pattern: {
        localized: 0.55,
        pitting: 0.60,
        uniform: 0.15,
        general: 0.20,
        none: 0.10
      },
      morphology: {
        pitting: 0.50,
        volumetric: 0.45,
        general_thinning: 0.25,
        mesa_attack: 0.15,
        none: 0.05
      },
      surface_condition: {
        sludge_covered: 0.70,
        deposits: 0.65,
        scale_sulfide: 0.20,
        fouled: 0.50,
        pitted: 0.15,
        clean: 0.05
      },
      coating_condition: {
        failed: 0.55,
        damaged: 0.45,
        absent: 0.40,
        not_applicable: 0.30,
        good: 0.05
      },
      weld_proximity: {
        at_weld: 0.45,
        in_weld: 0.40,
        near_weld: 0.35,
        away_from_weld: 0.20
      }
    },
    synergistic_with: ["oxygen_pitting", "MIC"],
    competes_with: ["general_corrosion", "MIC"],
    severity_default: "medium",
    typical_consequence: "localized_thinning_under_deposits",
    code_reference: "API 571 Section 4.3.7"
  },

  // ── 31. ACID DEW POINT CORROSION — Acid Dew Point Corrosion ──────────────
  acid_dew_point_corrosion: {
    id: "acid_dew_point_corrosion",
    display_name: "Acid Dew Point Corrosion",
    domain: "fixed",
    prerequisites: {
      flue_gas_or_overhead: true
    },
    indicators: {
      service_temperature_f: {
        low_lt400: 0.55,
        moderate_400_600: 0.35,
        high_gt600: 0.10
      },
      wall_loss_pattern: {
        localized: 0.50,
        uniform: 0.35,
        none: 0.15
      },
      morphology: {
        pitting: 0.45,
        general_thinning: 0.40,
        none: 0.10,
        mesa_attack: 0.05
      }
    },
    synergistic_with: ["general_corrosion"],
    competes_with: ["boiler_water_corrosion"],
    severity_default: "medium",
    typical_consequence: "corrosion_at_dew_point_temperatures",
    code_reference: "API 571 Section 4.3.5"
  },

  // ── 32. BOILER WATER CORROSION — Boiler Water/Steam Side Corrosion ───────
  boiler_water_corrosion: {
    id: "boiler_water_corrosion",
    display_name: "Boiler Water/Steam Side Corrosion",
    domain: "fixed",
    prerequisites: {
      boiler_or_steam: true
    },
    indicators: {
      wall_loss_pattern: {
        localized: 0.50,
        uniform: 0.35,
        none: 0.15
      },
      morphology: {
        gouging: 0.45,
        pitting: 0.30,
        general_thinning: 0.20,
        none: 0.05
      },
      ph_environment: {
        alkaline_gt8: 0.50,
        neutral_6_8: 0.30,
        acidic_lt4: 0.10,
        mildly_acidic_4_6: 0.10
      }
    },
    synergistic_with: ["caustic_gouging"],
    competes_with: ["general_corrosion"],
    severity_default: "medium",
    typical_consequence: "uniform_or_localized_wall_loss",
    code_reference: "API 571 Section 4.3.4"
  },

  // ── 33. CAUSTIC GOUGING — Caustic Gouging ────────────────────────────────
  caustic_gouging: {
    id: "caustic_gouging",
    display_name: "Caustic Gouging",
    domain: "fixed",
    prerequisites: {
      caustic_service: true
    },
    indicators: {
      wall_loss_pattern: {
        localized: 0.60,
        uniform: 0.25,
        none: 0.15
      },
      morphology: {
        gouging: 0.55,
        general_thinning: 0.25,
        pitting: 0.15,
        none: 0.05
      },
      ph_environment: {
        alkaline_gt8: 0.70,
        neutral_6_8: 0.20,
        mildly_acidic_4_6: 0.05,
        acidic_lt4: 0.05
      }
    },
    synergistic_with: ["boiler_water_corrosion"],
    competes_with: ["caustic_cracking"],
    severity_default: "medium",
    typical_consequence: "localized_gouging_and_thinning",
    code_reference: "API 571 Section 4.3.3"
  },

  // ── 34. FLOW-ACCELERATED CORROSION — Flow-Accelerated Corrosion (FAC) ─────
  flow_accelerated_corrosion: {
    id: "flow_accelerated_corrosion",
    display_name: "Flow-Accelerated Corrosion (FAC)",
    domain: "fixed",
    prerequisites: {
      carbon_steel: true,
      steam_or_wet: true
    },
    indicators: {
      wall_loss_pattern: {
        localized: 0.55,
        uniform: 0.35,
        none: 0.10
      },
      morphology: {
        scalloping: 0.50,
        general_thinning: 0.30,
        orange_peel: 0.15,
        none: 0.05
      },
      crack_location: {
        external: 0.15,
        internal: 0.60,
        weld: 0.20,
        base_metal: 0.05
      }
    },
    synergistic_with: ["erosion_corrosion"],
    competes_with: ["general_corrosion"],
    severity_default: "high",
    typical_consequence: "accelerated_loss_in_wet_steam",
    code_reference: "EPRI FAC guidelines"
  },

  // ── 35. THERMAL FATIGUE — Thermal Fatigue/Thermal Cycling ────────────────
  thermal_fatigue: {
    id: "thermal_fatigue",
    display_name: "Thermal Fatigue/Thermal Cycling",
    domain: "fixed",
    prerequisites: {},
    indicators: {
      crack_orientation: {
        transverse: 0.40,
        linear: 0.30,
        branched: 0.20,
        none: 0.10
      },
      morphology: {
        crazing: 0.40,
        transgranular: 0.30,
        elephant_hide: 0.20,
        none: 0.10
      },
      crack_location: {
        weld: 0.35,
        external: 0.30,
        weld_haz: 0.25,
        base_metal: 0.10
      },
      service_temperature_f: {
        high_gt600: 0.50,
        moderate_400_600: 0.35,
        low_lt400: 0.15
      }
    },
    synergistic_with: ["fatigue"],
    competes_with: ["creep"],
    severity_default: "high",
    typical_consequence: "thermal_stress_cracking",
    code_reference: "API 571 Section 4.2.16"
  },

  // ── 36. MECHANICAL FATIGUE — Mechanical/Vibration Fatigue ────────────────
  mechanical_fatigue: {
    id: "mechanical_fatigue",
    display_name: "Mechanical/Vibration Fatigue",
    domain: "fixed",
    prerequisites: {},
    indicators: {
      crack_orientation: {
        transverse: 0.50,
        linear: 0.30,
        none: 0.15,
        branched: 0.05
      },
      morphology: {
        beach_marks: 0.50,
        transgranular: 0.30,
        striations: 0.15,
        none: 0.05
      },
      crack_location: {
        weld: 0.35,
        weld_haz: 0.25,
        base_metal: 0.25,
        external: 0.15
      }
    },
    synergistic_with: ["general_corrosion"],
    competes_with: ["thermal_fatigue"],
    severity_default: "high",
    typical_consequence: "progressive_crack_growth",
    code_reference: "API 579-1 Part 14"
  },

  // ── 37. DEALLOYING — Dealloying/Selective Leaching ───────────────────────
  dealloying: {
    id: "dealloying",
    display_name: "Dealloying/Selective Leaching",
    domain: "fixed",
    prerequisites: {
      susceptible_alloy: true
    },
    indicators: {
      morphology: {
        spongy: 0.50,
        plug_type: 0.25,
        layer_type: 0.20,
        none: 0.05
      },
      wall_loss_pattern: {
        localized: 0.55,
        uniform: 0.30,
        none: 0.15
      },
      surface_condition: {
        discolored: 0.50,
        pitted: 0.25,
        clean: 0.15,
        cracked: 0.10
      }
    },
    synergistic_with: ["general_corrosion"],
    competes_with: ["oxygen_pitting"],
    severity_default: "medium",
    typical_consequence: "loss_of_strength_and_tightness",
    code_reference: "API 571 Section 4.3.9"
  },

  // ── 38. CAVITATION — Cavitation Damage ──────────────────────────────────
  cavitation: {
    id: "cavitation",
    display_name: "Cavitation Damage",
    domain: "fixed",
    prerequisites: {
      pump_or_valve: true
    },
    indicators: {
      wall_loss_pattern: {
        localized: 0.65,
        uniform: 0.20,
        none: 0.15
      },
      morphology: {
        cratering: 0.55,
        pitting: 0.30,
        roughened: 0.10,
        none: 0.05
      },
      crack_location: {
        internal: 0.60,
        external: 0.15,
        weld: 0.15,
        base_metal: 0.10
      }
    },
    synergistic_with: ["erosion_corrosion"],
    competes_with: ["general_corrosion"],
    severity_default: "medium",
    typical_consequence: "roughened_and_pitted_surfaces",
    code_reference: "API 571 Section 4.3.10"
  },

  // ── 39. OXYGEN PITTING — Oxygen Pitting ────────────────────────────────
  oxygen_pitting: {
    id: "oxygen_pitting",
    display_name: "Oxygen Pitting",
    domain: "fixed",
    prerequisites: {
      aqueous_with_oxygen: true
    },
    indicators: {
      wall_loss_pattern: {
        localized: 0.60,
        uniform: 0.25,
        none: 0.15
      },
      morphology: {
        pitting: 0.65,
        general_thinning: 0.20,
        tuberculation: 0.10,
        none: 0.05
      },
      ph_environment: {
        neutral_6_8: 0.45,
        mildly_acidic_4_6: 0.30,
        alkaline_gt8: 0.15,
        acidic_lt4: 0.10
      }
    },
    synergistic_with: ["under_deposit_corrosion"],
    competes_with: ["general_corrosion", "MIC"],
    severity_default: "medium",
    typical_consequence: "pitting_and_perforation",
    code_reference: "API 571 Section 4.3.6"
  },

  // ── 40. ATMOSPHERIC CORROSION — Atmospheric/External Corrosion ──────────
  atmospheric_corrosion: {
    id: "atmospheric_corrosion",
    display_name: "Atmospheric/External Corrosion",
    domain: "fixed",
    prerequisites: {},
    indicators: {
      wall_loss_pattern: {
        uniform: 0.40,
        localized: 0.45,
        general: 0.35,
        general_loss: 0.35,
        pitting: 0.30,
        none: 0.10
      },
      surface_condition: {
        heavily_corroded: 0.65,
        corroded: 0.55,
        pitted: 0.45,
        scale_sulfide: 0.25,
        discolored: 0.20,
        clean: 0.05,
        cracked: 0.05
      },
      morphology: {
        general_thinning: 0.40,
        volumetric: 0.40,
        pitting: 0.30,
        none: 0.10,
        flaking: 0.10
      },
      coating_condition: {
        absent: 0.60,
        damaged: 0.50,
        failed: 0.50,
        fair: 0.20,
        good: 0.05
      },
      cp_status: {
        inadequate: 0.55,
        not_applicable: 0.30,
        adequate: 0.10,
        marginal: 0.35
      }
    },
    synergistic_with: ["general_corrosion"],
    competes_with: ["CUI"],
    severity_default: "low",
    typical_consequence: "weathering_and_surface_loss",
    code_reference: "API 571 Section 4.3.2"
  }
};

export { MECHANISMS_FIXED };
