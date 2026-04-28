// netlify/functions/mic-intelligence.js
// FORGED NDT Intelligence OS - MIC Intelligence Engine
// Version: v1.0.0
// Purpose: Microbiologically Influenced Corrosion environment classifier,
//          biofilm state model, pattern library, and DDE prior modifier.
//          Outputs MIC susceptibility, probable microbe populations,
//          biofilm state, corrosion rate acceleration, evidence requirements,
//          and Bayesian prior adjustments for the DDE.
//
// Pure JavaScript only: no TypeScript, no template literals, var only,
// string concatenation only, module.exports pattern.
//
// I/O Contract
// ------------
// INPUT (event.body JSON):
//   {
//     domain: "fixed",
//     equipment_type: "storage_tank",
//     material: "carbon_steel",
//     environment: {
//       water_type: "produced_water",
//       temperature: 95,
//       pH: 6.8,
//       oxygen_level: "low",
//       flow_condition: "stagnant",
//       chloride: 500,
//       sulfide: 50,
//       CO2: true,
//       nutrient_sources: ["hydrocarbons", "sulfate"]
//     },
//     observed_features: ["pitting", "black_deposit", "rotten_egg_odor"],
//     deposits: "black_sludge",
//     location_context: "tank_bottom",
//     service_history: {
//       years_in_service: 12,
//       biocide_program: false,
//       previous_mic_findings: true,
//       stagnant_periods: true
//     }
//   }
//
// OUTPUT (200 JSON):
//   {
//     mic_susceptibility: "HIGH",
//     mic_score: 0.85,
//     probable_microbes: [...],
//     biofilm_state: "MATURE",
//     corrosion_rate_modifier: 3.5,
//     environment_classification: "AGGRESSIVE",
//     pattern_matches: [...],
//     dde_prior_adjustments: {...},
//     evidence_required: [...],
//     ndt_plan: [...],
//     mitigation: {...},
//     confidence: 0.78,
//     version: "v1.0.0"
//   }
// =============================================================================


// =============================================================================
// SECTION 1 - MICROBE PROFILES
// =============================================================================
// Each profile defines conditions favoring that microbe type, corrosion
// contribution, and detection methods.

var MICROBE_PROFILES = {
  SRB: {
    name: "Sulfate-Reducing Bacteria",
    code: "SRB",
    conditions: {
      oxygen: ["anaerobic", "low", "depleted"],
      temperature_range: [50, 140],    // Fahrenheit optimal
      temperature_max: 200,
      pH_range: [5.5, 9.0],
      requires_sulfate: true,
      favored_by: ["stagnant", "low_flow", "dead_leg"]
    },
    corrosion_contribution: {
      mechanism: "cathodic_depolarization_and_sulfide_attack",
      rate_multiplier: 3.0,
      morphology: "hemispherical_pitting_under_black_deposit",
      byproducts: ["H2S", "FeS", "iron_sulfide"]
    },
    indicators: ["black_deposit", "rotten_egg_odor", "H2S", "iron_sulfide",
                 "hemispherical_pitting", "tubercle", "black_sludge"],
    detection: ["SRB_culture", "ATP_test", "qPCR_dsrB", "sulfide_test"],
    severity: "HIGH"
  },
  APB: {
    name: "Acid-Producing Bacteria",
    code: "APB",
    conditions: {
      oxygen: ["aerobic", "facultative", "low", "moderate"],
      temperature_range: [50, 120],
      temperature_max: 150,
      pH_range: [3.0, 9.0],
      requires_sulfate: false,
      favored_by: ["organic_nutrients", "hydrocarbons", "stagnant"]
    },
    corrosion_contribution: {
      mechanism: "localized_acid_attack",
      rate_multiplier: 2.0,
      morphology: "sharp_pitting_with_organic_deposit",
      byproducts: ["organic_acids", "acetic_acid", "formic_acid"]
    },
    indicators: ["localized_pitting", "organic_deposit", "low_pH_under_deposit",
                 "biofilm", "slime"],
    detection: ["APB_culture", "ATP_test", "pH_under_deposit", "organic_acid_analysis"],
    severity: "MODERATE"
  },
  IOB: {
    name: "Iron-Oxidizing Bacteria",
    code: "IOB",
    conditions: {
      oxygen: ["aerobic", "microaerophilic", "moderate"],
      temperature_range: [50, 110],
      temperature_max: 140,
      pH_range: [5.5, 8.5],
      requires_sulfate: false,
      favored_by: ["iron_rich_water", "low_flow", "aerated"]
    },
    corrosion_contribution: {
      mechanism: "tubercle_formation_differential_aeration",
      rate_multiplier: 2.5,
      morphology: "tubercle_with_pit_underneath",
      byproducts: ["iron_hydroxide", "rust_tubercle", "ochre_deposit"]
    },
    indicators: ["rust_tubercle", "orange_deposit", "ochre", "tubercle",
                 "nodular_deposit", "differential_aeration"],
    detection: ["IOB_culture", "microscopy", "deposit_analysis_XRD"],
    severity: "MODERATE"
  },
  NRB: {
    name: "Nitrate-Reducing Bacteria",
    code: "NRB",
    conditions: {
      oxygen: ["anaerobic", "facultative", "low"],
      temperature_range: [50, 130],
      temperature_max: 170,
      pH_range: [5.0, 9.0],
      requires_sulfate: false,
      favored_by: ["nitrate_present", "injection_water", "produced_water"]
    },
    corrosion_contribution: {
      mechanism: "nitrite_attack_and_biofilm",
      rate_multiplier: 1.5,
      morphology: "general_pitting_with_biofilm",
      byproducts: ["nitrite", "nitrogen_gas", "biofilm"]
    },
    indicators: ["biofilm", "nitrite_presence", "general_pitting"],
    detection: ["NRB_culture", "nitrate_nitrite_test", "ATP_test"],
    severity: "LOW"
  },
  METHANOGENS: {
    name: "Methanogenic Archaea",
    code: "METHANOGENS",
    conditions: {
      oxygen: ["strictly_anaerobic", "anaerobic"],
      temperature_range: [60, 150],
      temperature_max: 200,
      pH_range: [6.0, 8.5],
      requires_sulfate: false,
      favored_by: ["CO2_rich", "deep_anaerobic", "produced_water"]
    },
    corrosion_contribution: {
      mechanism: "direct_electron_uptake_from_iron",
      rate_multiplier: 2.0,
      morphology: "general_corrosion_with_carbonate_deposits",
      byproducts: ["methane", "carbonate"]
    },
    indicators: ["methane_bubbles", "carbonate_deposit", "deep_anaerobic"],
    detection: ["qPCR_mcrA", "methane_measurement", "specialized_culture"],
    severity: "MODERATE"
  }
};


// =============================================================================
// SECTION 2 - MIC PATTERN LIBRARY
// =============================================================================
// Nine canonical MIC patterns with triggers, indicators, and inspection strategies

var MIC_PATTERNS = {
  DEAD_LEG_MIC: {
    name: "Dead Leg MIC",
    description: "MIC in stagnant dead legs and bypassed piping sections",
    domain: ["fixed", "production", "pipeline"],
    equipment: ["piping", "pipe", "small_bore", "dead_leg"],
    triggers: {
      flow_condition: ["stagnant", "no_flow", "dead_leg", "bypassed"],
      water_presence: true,
      temperature_range: [50, 150]
    },
    primary_microbes: ["SRB", "APB"],
    morphology: "localized_pitting_at_6_oclock",
    typical_rate_mpy: { low: 5, typical: 20, severe: 80 },
    ndt_strategy: ["UT_T_grid", "AUT_scan", "PROFILE_RT", "VT_internal_if_accessible"],
    lab_tests: ["SRB_culture", "APB_culture", "ATP_test", "water_chemistry", "deposit_analysis"],
    mitigation: {
      immediate: ["flush_dead_leg", "biocide_slug", "drain_stagnant_water"],
      long_term: ["eliminate_dead_leg", "install_flow_through", "chemical_injection_program"]
    }
  },
  TANK_BOTTOM_MIC: {
    name: "Tank Bottom MIC",
    description: "MIC in storage tank bottoms with water settling",
    domain: ["fixed", "production"],
    equipment: ["storage_tank", "tank", "aboveground_tank"],
    triggers: {
      location_context: ["tank_bottom", "bottom", "sump"],
      water_settling: true,
      stagnant_periods: true
    },
    primary_microbes: ["SRB", "APB", "IOB"],
    morphology: "scattered_pitting_on_bottom_plates",
    typical_rate_mpy: { low: 3, typical: 15, severe: 60 },
    ndt_strategy: ["AUT_floor_scan", "MFL_floor_scan", "UT_T_grid", "VT_internal"],
    lab_tests: ["SRB_culture", "APB_culture", "water_chemistry", "bottom_sample", "deposit_XRD"],
    mitigation: {
      immediate: ["drain_water_bottoms", "biocide_treatment", "tank_cleaning"],
      long_term: ["water_draw_off_program", "internal_coating", "CP_upgrade_per_API_651", "chemical_program"]
    }
  },
  BALLAST_TANK_MIC: {
    name: "Ballast Tank MIC",
    description: "MIC in marine ballast tanks with seawater exposure",
    domain: ["marine", "floating"],
    equipment: ["ballast_tank", "hull", "marine_vessel"],
    triggers: {
      water_type: ["seawater", "ballast_water"],
      oxygen_cycling: true,
      coating_breakdown: true
    },
    primary_microbes: ["SRB", "IOB", "APB"],
    morphology: "pitting_at_coating_holidays_and_weld_seams",
    typical_rate_mpy: { low: 5, typical: 25, severe: 100 },
    ndt_strategy: ["VT_close", "UT_T_grid_at_pits", "WFMT_welds", "coating_survey"],
    lab_tests: ["SRB_culture", "seawater_chemistry", "deposit_analysis", "coating_adhesion"],
    mitigation: {
      immediate: ["ballast_exchange", "biocide_treatment", "spot_coating_repair"],
      long_term: ["ICCP_system", "coating_renewal", "ballast_treatment_system"]
    }
  },
  FIREWATER_MIC: {
    name: "Firewater System MIC",
    description: "MIC in stagnant firewater systems",
    domain: ["fixed", "production", "subsea"],
    equipment: ["firewater_piping", "piping", "deluge_system", "firewater"],
    triggers: {
      water_type: ["fresh_water", "potable_water", "firewater"],
      flow_condition: ["stagnant", "rarely_flushed"],
      system_type: ["firewater", "deluge"]
    },
    primary_microbes: ["IOB", "SRB", "APB"],
    morphology: "tubercle_formation_with_pitting",
    typical_rate_mpy: { low: 3, typical: 15, severe: 50 },
    ndt_strategy: ["UT_T_at_low_points", "VT_internal_fiberscope", "PROFILE_RT", "GWUT_screening"],
    lab_tests: ["water_chemistry", "IOB_culture", "SRB_culture", "ATP_test", "iron_count"],
    mitigation: {
      immediate: ["system_flush", "biocide_injection", "pig_cleaning"],
      long_term: ["regular_flushing_program", "nitrogen_blanket", "chemical_treatment", "material_upgrade"]
    }
  },
  SUBSEA_MIC: {
    name: "Subsea Equipment MIC",
    description: "MIC in subsea pipelines and equipment with anaerobic seabed conditions",
    domain: ["subsea", "pipeline"],
    equipment: ["pipeline", "flowline", "subsea_manifold", "riser_base"],
    triggers: {
      environment: ["subsea", "seabed", "anaerobic_sediment"],
      water_type: ["seawater", "produced_water"],
      temperature_range: [35, 100],
      burial: true
    },
    primary_microbes: ["SRB", "METHANOGENS"],
    morphology: "external_pitting_under_marine_growth_or_burial",
    typical_rate_mpy: { low: 2, typical: 10, severe: 40 },
    ndt_strategy: ["ROV_CP_survey", "subsea_UT", "intelligent_pig", "AUT_at_risers"],
    lab_tests: ["sediment_SRB_culture", "CP_potential_survey", "seawater_chemistry"],
    mitigation: {
      immediate: ["CP_system_check", "marine_growth_removal"],
      long_term: ["CP_system_upgrade", "coating_repair", "burial_protection", "pipeline_pig_program"]
    }
  },
  CUI_MIC: {
    name: "CUI with MIC Component",
    description: "MIC accelerating corrosion under insulation where moisture ingress creates stagnant conditions",
    domain: ["fixed", "production"],
    equipment: ["piping", "pressure_vessel", "column", "heat_exchanger"],
    triggers: {
      insulation: true,
      moisture_ingress: true,
      temperature_range: [32, 300],
      coating_condition: ["degraded", "failed", "unknown"]
    },
    primary_microbes: ["SRB", "IOB"],
    morphology: "pitting_under_insulation_with_biological_deposits",
    typical_rate_mpy: { low: 5, typical: 20, severe: 70 },
    ndt_strategy: ["insulation_strip_VT_UT", "PEC_screening", "IR_thermography", "PROFILE_RT"],
    lab_tests: ["deposit_analysis", "SRB_culture", "moisture_content", "pH_under_insulation"],
    mitigation: {
      immediate: ["strip_insulation", "clean_surface", "biocide_if_wet", "coating_repair"],
      long_term: ["insulation_upgrade_per_API_583", "coating_system_per_SP0198", "moisture_barrier", "CUI_inspection_program"]
    }
  },
  PIPELINE_LOW_FLOW_MIC: {
    name: "Pipeline Low-Flow MIC",
    description: "MIC in pipelines with low flow velocities allowing biofilm development",
    domain: ["pipeline", "production"],
    equipment: ["pipeline", "flowline", "gathering_line"],
    triggers: {
      flow_condition: ["low_flow", "intermittent", "turndown"],
      water_cut: "high",
      temperature_range: [50, 150]
    },
    primary_microbes: ["SRB", "APB", "METHANOGENS"],
    morphology: "pitting_at_6_oclock_and_low_points",
    typical_rate_mpy: { low: 5, typical: 25, severe: 100 },
    ndt_strategy: ["intelligent_pig_MFL_UT", "UT_T_at_low_points", "excavation_VT_UT"],
    lab_tests: ["pig_debris_analysis", "water_chemistry", "SRB_culture", "corrosion_coupon"],
    mitigation: {
      immediate: ["increase_flow_velocity", "biocide_batch", "pig_pipeline"],
      long_term: ["chemical_injection_program", "regular_pigging", "velocity_management", "water_removal"]
    }
  },
  COOLING_WATER_MIC: {
    name: "Cooling Water System MIC",
    description: "MIC in open and closed cooling water systems",
    domain: ["fixed", "production"],
    equipment: ["heat_exchanger", "cooling_tower", "condenser", "piping"],
    triggers: {
      water_type: ["cooling_water", "recirculated_water"],
      temperature_range: [70, 130],
      nutrient_rich: true
    },
    primary_microbes: ["IOB", "SRB", "APB", "NRB"],
    morphology: "tubercle_and_pitting_in_tubes_and_shell",
    typical_rate_mpy: { low: 3, typical: 15, severe: 50 },
    ndt_strategy: ["IRIS_tubes", "ECT_tubes", "UT_T_shell", "VT_internal"],
    lab_tests: ["water_chemistry", "Legionella_test", "IOB_culture", "SRB_culture", "biofilm_coupon"],
    mitigation: {
      immediate: ["biocide_shock_treatment", "system_flush", "tube_cleaning"],
      long_term: ["chemical_treatment_program", "biofilm_monitoring", "corrosion_coupon_program", "material_upgrade"]
    }
  },
  PRODUCED_WATER_MIC: {
    name: "Produced Water MIC",
    description: "MIC in systems handling produced water with high organic and sulfate content",
    domain: ["production", "pipeline"],
    equipment: ["separator", "water_knockout", "piping", "injection_well", "flowline"],
    triggers: {
      water_type: ["produced_water"],
      sulfate_content: "high",
      organic_content: "high",
      temperature_range: [80, 180]
    },
    primary_microbes: ["SRB", "APB", "METHANOGENS", "NRB"],
    morphology: "severe_pitting_under_black_deposit",
    typical_rate_mpy: { low: 10, typical: 40, severe: 150 },
    ndt_strategy: ["UT_T_at_low_points", "AUT_mapping", "PROFILE_RT", "intelligent_pig"],
    lab_tests: ["produced_water_full_analysis", "SRB_serial_dilution", "ATP", "H2S_test", "corrosion_coupon"],
    mitigation: {
      immediate: ["biocide_injection", "increase_velocity", "pig_line"],
      long_term: ["continuous_chemical_program", "produced_water_treatment", "material_upgrade_CRA", "regular_monitoring"]
    }
  }
};


// =============================================================================
// SECTION 3 - ENVIRONMENT CLASSIFICATION
// =============================================================================

var ENV_CLASS_THRESHOLDS = {
  AGGRESSIVE: 0.70,
  MODERATE: 0.40,
  MILD: 0.15
  // below 0.15 = NEGLIGIBLE
};

function classifyEnvironment(env, serviceHistory) {
  var score = 0;
  var factors = [];

  // Water type contribution
  var waterScores = {
    produced_water: 0.25, seawater: 0.20, ballast_water: 0.20,
    cooling_water: 0.15, fresh_water: 0.10, firewater: 0.15,
    injection_water: 0.20, potable_water: 0.05, condensate: 0.10
  };
  var wType = env && env.water_type ? env.water_type.toLowerCase() : "";
  var wScore = waterScores[wType] || 0.05;
  score = score + wScore;
  if (wScore >= 0.15) factors.push("water_type:" + wType + " (" + wScore + ")");

  // Temperature suitability (mesophilic sweet spot 70-130F is worst)
  var temp = env && env.temperature !== undefined ? env.temperature : null;
  if (temp !== null) {
    if (temp >= 70 && temp <= 130) {
      score = score + 0.20;
      factors.push("temperature:" + temp + "F in optimal MIC range");
    } else if (temp >= 50 && temp <= 180) {
      score = score + 0.10;
      factors.push("temperature:" + temp + "F in viable MIC range");
    } else if (temp > 180 || temp < 32) {
      // Too hot or frozen - reduces MIC risk
      score = score - 0.10;
      factors.push("temperature:" + temp + "F outside viable MIC range");
    }
  }

  // Flow condition
  var flowScores = {
    stagnant: 0.25, no_flow: 0.25, dead_leg: 0.25, bypassed: 0.20,
    low_flow: 0.15, intermittent: 0.15, turndown: 0.10,
    moderate_flow: 0.05, high_flow: -0.05, turbulent: -0.10
  };
  var flow = env && env.flow_condition ? env.flow_condition.toLowerCase() : "";
  var fScore = flowScores[flow] || 0.05;
  score = score + fScore;
  if (fScore >= 0.10) factors.push("flow:" + flow + " favors biofilm");

  // Oxygen level
  var o2Scores = {
    anaerobic: 0.20, depleted: 0.15, low: 0.15,
    microaerophilic: 0.10, moderate: 0.05, aerobic: 0.05,
    high: 0.0, saturated: 0.0
  };
  var o2 = env && env.oxygen_level ? env.oxygen_level.toLowerCase() : "";
  var o2Score = o2Scores[o2] || 0.05;
  score = score + o2Score;
  if (o2Score >= 0.10) factors.push("oxygen:" + o2 + " favors anaerobic microbes");

  // pH
  var pH = env && env.pH !== undefined ? env.pH : null;
  if (pH !== null) {
    if (pH >= 5.5 && pH <= 8.5) {
      score = score + 0.05;
    } else if (pH < 4.0 || pH > 10.0) {
      score = score - 0.10;
      factors.push("pH:" + pH + " outside viable MIC range");
    }
  }

  // Nutrient sources
  var nutrients = env && env.nutrient_sources ? env.nutrient_sources : [];
  if (nutrients.length > 0) {
    var nutrientScore = Math.min(nutrients.length * 0.05, 0.15);
    score = score + nutrientScore;
    factors.push("nutrients: " + nutrients.join(", "));
  }

  // Sulfate presence (critical for SRB)
  var sulfide = env && env.sulfide !== undefined ? env.sulfide : 0;
  if (sulfide > 0) {
    score = score + 0.10;
    factors.push("sulfide:" + sulfide + "ppm present");
  }

  // CO2 presence
  if (env && env.CO2) {
    score = score + 0.05;
    factors.push("CO2 present - supports methanogen activity");
  }

  // Service history modifiers
  if (serviceHistory) {
    if (serviceHistory.previous_mic_findings) {
      score = score + 0.15;
      factors.push("previous MIC findings confirmed");
    }
    if (serviceHistory.stagnant_periods) {
      score = score + 0.10;
      factors.push("history of stagnant periods");
    }
    if (serviceHistory.biocide_program === false) {
      score = score + 0.05;
      factors.push("no biocide program in place");
    } else if (serviceHistory.biocide_program === true) {
      score = score - 0.10;
      factors.push("active biocide program (risk reduction)");
    }
    if (serviceHistory.years_in_service && serviceHistory.years_in_service > 10) {
      score = score + 0.05;
      factors.push("long service life (" + serviceHistory.years_in_service + " years)");
    }
  }

  // Clamp
  if (score < 0) score = 0;
  if (score > 1.0) score = 1.0;

  var classification;
  if (score >= ENV_CLASS_THRESHOLDS.AGGRESSIVE) classification = "AGGRESSIVE";
  else if (score >= ENV_CLASS_THRESHOLDS.MODERATE) classification = "MODERATE";
  else if (score >= ENV_CLASS_THRESHOLDS.MILD) classification = "MILD";
  else classification = "NEGLIGIBLE";

  return {
    score: Math.round(score * 100) / 100,
    classification: classification,
    factors: factors
  };
}


// =============================================================================
// SECTION 4 - MICROBE PROBABILITY ENGINE
// =============================================================================

function evaluateMicrobes(env, observedFeatures, deposits) {
  var results = [];
  var features = observedFeatures || [];
  var depStr = (deposits || "").toLowerCase();
  var allIndicators = features.concat(depStr ? [depStr] : []);
  var indicatorStr = allIndicators.join(" ").toLowerCase();

  for (var code in MICROBE_PROFILES) {
    if (!MICROBE_PROFILES.hasOwnProperty(code)) continue;
    var profile = MICROBE_PROFILES[code];
    var probability = 0;
    var evidence = [];

    // Check oxygen compatibility
    var o2 = env && env.oxygen_level ? env.oxygen_level.toLowerCase() : "";
    var o2Match = false;
    for (var i = 0; i < profile.conditions.oxygen.length; i++) {
      if (o2 === profile.conditions.oxygen[i] || o2.indexOf(profile.conditions.oxygen[i]) !== -1) {
        o2Match = true;
        break;
      }
    }
    if (o2Match) {
      probability = probability + 0.20;
      evidence.push("oxygen_compatible");
    }

    // Check temperature
    var temp = env && env.temperature !== undefined ? env.temperature : null;
    if (temp !== null) {
      if (temp >= profile.conditions.temperature_range[0] && temp <= profile.conditions.temperature_range[1]) {
        probability = probability + 0.15;
        evidence.push("optimal_temperature");
      } else if (temp <= profile.conditions.temperature_max) {
        probability = probability + 0.05;
        evidence.push("viable_temperature");
      }
    }

    // Check pH
    var pH = env && env.pH !== undefined ? env.pH : null;
    if (pH !== null) {
      if (pH >= profile.conditions.pH_range[0] && pH <= profile.conditions.pH_range[1]) {
        probability = probability + 0.10;
        evidence.push("pH_compatible");
      }
    }

    // Check flow conditions
    var flow = env && env.flow_condition ? env.flow_condition.toLowerCase() : "";
    for (var j = 0; j < profile.conditions.favored_by.length; j++) {
      if (flow === profile.conditions.favored_by[j] || flow.indexOf(profile.conditions.favored_by[j]) !== -1) {
        probability = probability + 0.15;
        evidence.push("flow_favors:" + profile.conditions.favored_by[j]);
        break;
      }
    }

    // Check indicator matches
    var indicatorHits = 0;
    for (var k = 0; k < profile.indicators.length; k++) {
      if (indicatorStr.indexOf(profile.indicators[k].toLowerCase()) !== -1) {
        indicatorHits++;
      }
    }
    if (indicatorHits > 0) {
      var indicatorScore = Math.min(indicatorHits * 0.10, 0.30);
      probability = probability + indicatorScore;
      evidence.push(indicatorHits + "_indicator_matches");
    }

    // Sulfate requirement for SRB
    if (profile.conditions.requires_sulfate) {
      var nutrients = env && env.nutrient_sources ? env.nutrient_sources : [];
      var hasSulfate = false;
      for (var m = 0; m < nutrients.length; m++) {
        if (nutrients[m].toLowerCase().indexOf("sulfate") !== -1 || nutrients[m].toLowerCase().indexOf("sulphate") !== -1) {
          hasSulfate = true;
          break;
        }
      }
      var sulfide = env && env.sulfide !== undefined ? env.sulfide : 0;
      if (hasSulfate || sulfide > 0) {
        probability = probability + 0.10;
        evidence.push("sulfate_source_available");
      }
    }

    // Clamp
    if (probability > 1.0) probability = 1.0;

    if (probability >= 0.20) {
      results.push({
        code: profile.code,
        name: profile.name,
        probability: Math.round(probability * 100) / 100,
        severity: profile.severity,
        evidence: evidence,
        corrosion_mechanism: profile.corrosion_contribution.mechanism,
        rate_multiplier: profile.corrosion_contribution.rate_multiplier,
        morphology: profile.corrosion_contribution.morphology,
        detection_methods: profile.detection
      });
    }
  }

  // Sort by probability descending
  results.sort(function(a, b) { return b.probability - a.probability; });
  return results;
}


// =============================================================================
// SECTION 5 - BIOFILM STATE MODEL
// =============================================================================
// Simplified 3-state model: ABSENT → ACTIVE → MATURE
// Based on environment conditions, observed features, and service history

function assessBiofilmState(envClassification, observedFeatures, serviceHistory, microbes) {
  var features = (observedFeatures || []).join(" ").toLowerCase();
  var score = 0;

  // Environment contribution
  if (envClassification === "AGGRESSIVE") score = score + 3;
  else if (envClassification === "MODERATE") score = score + 2;
  else if (envClassification === "MILD") score = score + 1;

  // Observed biofilm indicators
  var biofilmKeywords = ["biofilm", "slime", "biofouling", "biological", "organic_deposit",
                         "tubercle", "nodular", "biological_growth"];
  for (var i = 0; i < biofilmKeywords.length; i++) {
    if (features.indexOf(biofilmKeywords[i]) !== -1) {
      score = score + 2;
      break;
    }
  }

  // Deposit indicators
  var depositKeywords = ["black_deposit", "black_sludge", "iron_sulfide", "orange_deposit",
                         "ochre", "rust_tubercle"];
  for (var j = 0; j < depositKeywords.length; j++) {
    if (features.indexOf(depositKeywords[j]) !== -1) {
      score = score + 1;
      break;
    }
  }

  // Service history
  if (serviceHistory) {
    if (serviceHistory.previous_mic_findings) score = score + 2;
    if (serviceHistory.stagnant_periods) score = score + 1;
    if (serviceHistory.years_in_service && serviceHistory.years_in_service > 5) score = score + 1;
    if (serviceHistory.biocide_program === false) score = score + 1;
  }

  // Multiple microbe types detected suggests established biofilm
  if (microbes && microbes.length >= 3) score = score + 1;
  if (microbes && microbes.length >= 2) score = score + 1;

  var state;
  var description;
  if (score >= 7) {
    state = "MATURE";
    description = "Established biofilm with active microbial communities. MIC corrosion likely in progress. Accelerated wall loss expected.";
  } else if (score >= 4) {
    state = "ACTIVE";
    description = "Biofilm formation conditions present. Early to mid-stage biological colonization. MIC susceptibility is elevated.";
  } else {
    state = "ABSENT";
    description = "Environmental conditions do not strongly support biofilm development. MIC risk is low under current conditions.";
  }

  return {
    state: state,
    score: score,
    description: description
  };
}


// =============================================================================
// SECTION 6 - PATTERN MATCHER
// =============================================================================

function matchPatterns(input) {
  var matches = [];
  var domain = input.domain || "";
  var eqType = (input.equipment_type || "").toLowerCase();
  var env = input.environment || {};
  var flow = (env.flow_condition || "").toLowerCase();
  var waterType = (env.water_type || "").toLowerCase();
  var locationCtx = (input.location_context || "").toLowerCase();
  var features = (input.observed_features || []).join(" ").toLowerCase();

  for (var patternKey in MIC_PATTERNS) {
    if (!MIC_PATTERNS.hasOwnProperty(patternKey)) continue;
    var pattern = MIC_PATTERNS[patternKey];
    var matchScore = 0;
    var matchReasons = [];

    // Domain match
    var domainMatch = false;
    for (var i = 0; i < pattern.domain.length; i++) {
      if (domain === pattern.domain[i]) { domainMatch = true; break; }
    }
    if (domainMatch) { matchScore = matchScore + 1; matchReasons.push("domain"); }

    // Equipment match
    var eqMatch = false;
    for (var j = 0; j < pattern.equipment.length; j++) {
      if (eqType.indexOf(pattern.equipment[j]) !== -1) { eqMatch = true; break; }
    }
    if (eqMatch) { matchScore = matchScore + 2; matchReasons.push("equipment_type"); }

    // Trigger matches
    var triggers = pattern.triggers;
    if (triggers.flow_condition) {
      for (var k = 0; k < triggers.flow_condition.length; k++) {
        if (flow.indexOf(triggers.flow_condition[k]) !== -1) {
          matchScore = matchScore + 2;
          matchReasons.push("flow:" + triggers.flow_condition[k]);
          break;
        }
      }
    }
    if (triggers.water_type) {
      for (var m = 0; m < triggers.water_type.length; m++) {
        if (waterType.indexOf(triggers.water_type[m]) !== -1) {
          matchScore = matchScore + 1;
          matchReasons.push("water_type");
          break;
        }
      }
    }
    if (triggers.location_context) {
      for (var n = 0; n < triggers.location_context.length; n++) {
        if (locationCtx.indexOf(triggers.location_context[n]) !== -1) {
          matchScore = matchScore + 2;
          matchReasons.push("location:" + triggers.location_context[n]);
          break;
        }
      }
    }

    // Temperature match
    if (triggers.temperature_range && env.temperature !== undefined) {
      if (env.temperature >= triggers.temperature_range[0] && env.temperature <= triggers.temperature_range[1]) {
        matchScore = matchScore + 1;
        matchReasons.push("temperature_in_range");
      }
    }

    // Require minimum match score
    if (matchScore >= 3) {
      matches.push({
        pattern: patternKey,
        name: pattern.name,
        match_score: matchScore,
        match_reasons: matchReasons,
        primary_microbes: pattern.primary_microbes,
        morphology: pattern.morphology,
        typical_rate_mpy: pattern.typical_rate_mpy,
        ndt_strategy: pattern.ndt_strategy,
        lab_tests: pattern.lab_tests,
        mitigation: pattern.mitigation
      });
    }
  }

  // Sort by match score descending
  matches.sort(function(a, b) { return b.match_score - a.match_score; });
  return matches;
}


// =============================================================================
// SECTION 7 - DDE PRIOR ADJUSTMENT
// =============================================================================

function computeDDEPriorAdjustments(micScore, microbes, envClassification) {
  var adjustments = {};

  // If MIC susceptibility is HIGH or AGGRESSIVE environment, boost MIC-related priors
  if (micScore >= 0.60) {
    adjustments.MIC = { direction: "increase", factor: 1.0 + micScore, reason: "High MIC environmental susceptibility" };
    adjustments.LOCALIZED_THINNING = { direction: "increase", factor: 1.0 + (micScore * 0.5), reason: "MIC produces localized pitting morphology" };
    adjustments.UNDER_DEPOSIT_CORROSION = { direction: "increase", factor: 1.0 + (micScore * 0.4), reason: "MIC often co-occurs with under-deposit corrosion" };
    // Reduce general thinning prior slightly (MIC is localized, not uniform)
    adjustments.GENERAL_THINNING = { direction: "decrease", factor: 0.85, reason: "MIC morphology is localized, not uniform" };
  } else if (micScore >= 0.30) {
    adjustments.MIC = { direction: "increase", factor: 1.0 + (micScore * 0.5), reason: "Moderate MIC environmental susceptibility" };
    adjustments.LOCALIZED_THINNING = { direction: "increase", factor: 1.0 + (micScore * 0.3), reason: "Possible MIC-driven pitting" };
  }

  // SRB-specific: boost H2S/sulfide-related mechanisms
  var hasSRB = false;
  for (var i = 0; i < (microbes || []).length; i++) {
    if (microbes[i].code === "SRB" && microbes[i].probability >= 0.40) {
      hasSRB = true;
      break;
    }
  }
  if (hasSRB) {
    adjustments.SSC = { direction: "increase", factor: 1.15, reason: "SRB produce H2S which can drive SSC in susceptible materials" };
    adjustments.H2S_CORROSION = { direction: "increase", factor: 1.20, reason: "SRB-generated H2S creates localized sour conditions" };
  }

  return adjustments;
}


// =============================================================================
// SECTION 8 - CORROSION RATE ESTIMATOR
// =============================================================================

function estimateCorrosionRate(microbes, envClassification, patternMatches) {
  // Base rate from environment classification (mpy - mils per year)
  var baseRates = { AGGRESSIVE: 15, MODERATE: 8, MILD: 3, NEGLIGIBLE: 1 };
  var baseRate = baseRates[envClassification] || 5;

  // Apply highest microbe rate multiplier
  var maxMultiplier = 1.0;
  for (var i = 0; i < (microbes || []).length; i++) {
    if (microbes[i].rate_multiplier > maxMultiplier) {
      maxMultiplier = microbes[i].rate_multiplier;
    }
  }

  // Weight by microbe probability
  var weightedMultiplier = 1.0 + ((maxMultiplier - 1.0) * (microbes.length > 0 ? microbes[0].probability : 0));

  var estimatedRate = baseRate * weightedMultiplier;

  // Cross-check with pattern typical rates
  if (patternMatches && patternMatches.length > 0) {
    var patternTypical = patternMatches[0].typical_rate_mpy.typical;
    // Blend estimate with pattern typical (70% calculated, 30% pattern)
    estimatedRate = (estimatedRate * 0.7) + (patternTypical * 0.3);
  }

  return {
    estimated_rate_mpy: Math.round(estimatedRate * 10) / 10,
    base_rate_mpy: baseRate,
    mic_multiplier: Math.round(weightedMultiplier * 100) / 100,
    rate_modifier: Math.round(weightedMultiplier * 100) / 100
  };
}


// =============================================================================
// SECTION 9 - EVIDENCE AND NDT PLAN BUILDER
// =============================================================================

function buildEvidencePlan(microbes, patternMatches, envClassification) {
  var evidenceRequired = [];
  var ndtPlan = [];
  var seen = {};

  function addUnique(arr, items) {
    for (var i = 0; i < items.length; i++) {
      if (!seen[items[i]]) {
        seen[items[i]] = true;
        arr.push(items[i]);
      }
    }
  }

  // Always require baseline biological testing for suspected MIC
  if (envClassification === "AGGRESSIVE" || envClassification === "MODERATE") {
    addUnique(evidenceRequired, ["ATP_test", "water_chemistry_full"]);
  }

  // Add microbe-specific detection methods
  for (var i = 0; i < (microbes || []).length; i++) {
    addUnique(evidenceRequired, microbes[i].detection_methods);
  }

  // Add pattern-specific NDT and lab tests
  for (var j = 0; j < (patternMatches || []).length; j++) {
    addUnique(ndtPlan, patternMatches[j].ndt_strategy);
    addUnique(evidenceRequired, patternMatches[j].lab_tests);
  }

  // Fallback NDT plan if no patterns matched
  if (ndtPlan.length === 0 && envClassification !== "NEGLIGIBLE") {
    ndtPlan = ["UT_T_grid_at_low_points", "AUT_mapping_if_accessible", "VT_internal"];
  }

  return {
    evidence_required: evidenceRequired,
    ndt_plan: ndtPlan
  };
}


// =============================================================================
// SECTION 10 - SUSCEPTIBILITY CLASSIFIER
// =============================================================================

function classifySusceptibility(envScore, microbes, biofilmState) {
  // Weighted composite
  var microbeScore = 0;
  if (microbes.length > 0) microbeScore = microbes[0].probability;

  var biofilmScore = 0;
  if (biofilmState === "MATURE") biofilmScore = 1.0;
  else if (biofilmState === "ACTIVE") biofilmScore = 0.5;

  // Composite: 40% environment, 35% microbes, 25% biofilm
  var composite = (envScore * 0.40) + (microbeScore * 0.35) + (biofilmScore * 0.25);

  var susceptibility;
  if (composite >= 0.70) susceptibility = "HIGH";
  else if (composite >= 0.45) susceptibility = "MODERATE";
  else if (composite >= 0.20) susceptibility = "LOW";
  else susceptibility = "NEGLIGIBLE";

  return {
    susceptibility: susceptibility,
    score: Math.round(composite * 100) / 100,
    confidence: Math.round(Math.min(0.5 + (microbes.length * 0.10) + (envScore * 0.20), 0.95) * 100) / 100
  };
}


// =============================================================================
// SECTION 11 - MITIGATION AGGREGATOR
// =============================================================================

function buildMitigation(patternMatches, envClassification, biofilmState) {
  var immediate = [];
  var longTerm = [];
  var seen = {};

  function addUnique(arr, items) {
    for (var i = 0; i < items.length; i++) {
      if (!seen[items[i]]) {
        seen[items[i]] = true;
        arr.push(items[i]);
      }
    }
  }

  // Pattern-specific mitigations
  for (var i = 0; i < (patternMatches || []).length; i++) {
    var mit = patternMatches[i].mitigation;
    if (mit.immediate) addUnique(immediate, mit.immediate);
    if (mit.long_term) addUnique(longTerm, mit.long_term);
  }

  // Generic mitigations if no patterns
  if (immediate.length === 0 && envClassification !== "NEGLIGIBLE") {
    immediate = ["biocide_treatment", "system_flush", "water_removal"];
  }
  if (longTerm.length === 0 && envClassification !== "NEGLIGIBLE") {
    longTerm = ["chemical_treatment_program", "regular_monitoring", "corrosion_coupon_program"];
  }

  // Biofilm-specific urgency
  if (biofilmState === "MATURE") {
    addUnique(immediate, ["mechanical_cleaning_before_biocide"]);
  }

  return {
    immediate: immediate,
    long_term: longTerm
  };
}


// =============================================================================
// SECTION 12 - CORE ANALYZER
// =============================================================================

function analyzeMIC(input) {
  var env = input.environment || {};
  var serviceHistory = input.service_history || {};
  var observedFeatures = input.observed_features || [];
  var deposits = input.deposits || "";

  // Step 1: Classify environment
  var envResult = classifyEnvironment(env, serviceHistory);

  // Step 2: Evaluate probable microbes
  var microbes = evaluateMicrobes(env, observedFeatures, deposits);

  // Step 3: Assess biofilm state
  var biofilm = assessBiofilmState(envResult.classification, observedFeatures, serviceHistory, microbes);

  // Step 4: Match patterns
  var patterns = matchPatterns(input);

  // Step 5: Classify susceptibility
  var susceptibility = classifySusceptibility(envResult.score, microbes, biofilm.state);

  // Step 6: Estimate corrosion rate
  var rateEstimate = estimateCorrosionRate(microbes, envResult.classification, patterns);

  // Step 7: Compute DDE prior adjustments
  var ddePriors = computeDDEPriorAdjustments(susceptibility.score, microbes, envResult.classification);

  // Step 8: Build evidence and NDT plan
  var evidencePlan = buildEvidencePlan(microbes, patterns, envResult.classification);

  // Step 9: Build mitigation
  var mitigation = buildMitigation(patterns, envResult.classification, biofilm.state);

  return {
    mic_susceptibility: susceptibility.susceptibility,
    mic_score: susceptibility.score,
    probable_microbes: microbes,
    biofilm_state: biofilm.state,
    biofilm_detail: biofilm,
    corrosion_rate_modifier: rateEstimate.rate_modifier,
    corrosion_rate_estimate_mpy: rateEstimate.estimated_rate_mpy,
    environment_classification: envResult.classification,
    environment_detail: envResult,
    pattern_matches: patterns,
    dde_prior_adjustments: ddePriors,
    evidence_required: evidencePlan.evidence_required,
    ndt_plan: evidencePlan.ndt_plan,
    mitigation: mitigation,
    confidence: susceptibility.confidence,
    version: "v1.0.0"
  };
}


// =============================================================================
// SECTION 13 - NETLIFY HANDLER
// =============================================================================

var handler = async function(event) {
  "use strict";

  var headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: headers,
      body: JSON.stringify({ error: "Method not allowed. Use POST." })
    };
  }

  var input;
  try {
    input = JSON.parse(event.body || "{}");
  } catch (e) {
    return {
      statusCode: 400,
      headers: headers,
      body: JSON.stringify({ error: "Invalid JSON body", detail: e.message })
    };
  }

  var result;
  try {
    result = analyzeMIC(input);
  } catch (e) {
    return {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({ error: "MIC analysis exception", detail: e.message })
    };
  }

  return {
    statusCode: 200,
    headers: headers,
    body: JSON.stringify(result)
  };
};

module.exports = { handler: handler };

// Export internals for unit testing
module.exports._internal = {
  analyzeMIC: analyzeMIC,
  classifyEnvironment: classifyEnvironment,
  evaluateMicrobes: evaluateMicrobes,
  assessBiofilmState: assessBiofilmState,
  matchPatterns: matchPatterns,
  classifySusceptibility: classifySusceptibility,
  computeDDEPriorAdjustments: computeDDEPriorAdjustments,
  estimateCorrosionRate: estimateCorrosionRate,
  MICROBE_PROFILES: MICROBE_PROFILES,
  MIC_PATTERNS: MIC_PATTERNS
};
