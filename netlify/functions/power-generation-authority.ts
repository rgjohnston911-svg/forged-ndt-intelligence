// @ts-nocheck
/**
 * DEPLOY312 — power-generation-authority.ts
 * netlify/functions/power-generation-authority.ts
 *
 * Engine 103: Power Generation Intelligence Authority v1
 * Physics-first reasoning across boilers, HRSGs, turbines, piping,
 * and balance-of-plant assets for fossil, gas, combined-cycle,
 * cogeneration, biomass, waste-to-energy, and industrial steam systems.
 *
 * Actions:
 *   route_asset          — classify asset domain, codes, damage families
 *   run_damage_model     — evaluate boiler/HRSG damage mechanisms
 *   run_creep_analysis   — creep life staging and remaining life
 *   run_fatigue_analysis — LCF/thermal fatigue from cycle history
 *   run_fac_analysis     — flow-accelerated corrosion risk
 *   run_turbine_analysis — gas/steam turbine failure intelligence
 *   run_thermal_stress   — thermal stress screening
 *   run_consequence      — consequence/criticality assessment
 *   resolve_code_authority — determine governing code/standard
 *   run_decision_lock    — enforce hard decision locks
 *   run_full_authority   — run complete pipeline (all engines)
 *   get_registry         — return damage mechanism registry
 *   get_operating_history — summarize operating events
 *   log_operating_event  — record a startup/shutdown/trip/transient
 *   health               — health check
 *
 * House style: var only, string concatenation, POST-only, non-fatal DB ops.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var ENGINE_NUMBER = 103;
var ENGINE_CODE = "POWER_GEN_AUTHORITY";
var ENGINE_VERSION = "power-generation-authority/1.0.0";

// ================================================================
// ASSET DOMAIN CLASSIFICATION
// ================================================================
var PRESSURE_PARTS = ["BOILER", "HRSG", "STEAM_DRUM", "MUD_DRUM", "SUPERHEATER",
  "REHEATER", "ECONOMIZER", "WATERWALL", "BURNER_ASSEMBLY"];
var POWER_PIPING = ["STEAM_PIPE", "FEEDWATER_PIPE", "CONDENSATE_PIPE", "HEADER"];
var ROTATING_EQUIPMENT = ["GAS_TURBINE", "STEAM_TURBINE", "TURBINE_BLADE_ROW",
  "TURBINE_ROTOR", "GENERATOR"];
var PRESSURE_EQUIPMENT = ["HEAT_EXCHANGER", "DEAERATOR", "CONDENSER", "EXPANSION_JOINT"];
var BOP = ["COOLING_TOWER", "TRANSFORMER", "PUMP", "VALVE", "SUPPORT_HANGER",
  "BALANCE_OF_PLANT"];

// High-temperature threshold (Celsius)
var HIGH_TEMP_THRESHOLD = 400;
// FAC susceptible temperature range
var FAC_TEMP_MIN = 100;
var FAC_TEMP_MAX = 250;

// ================================================================
// HELPER: buildResult / holdResult
// ================================================================
function buildResult(result, interpretation, confidence, severity, extras) {
  var out = {
    engine_number: ENGINE_NUMBER,
    engine_code: ENGINE_CODE,
    engine_version: ENGINE_VERSION,
    result: result,
    interpretation: interpretation,
    confidence: confidence,
    severity: severity,
    timestamp: new Date().toISOString()
  };
  if (extras) {
    var keys = Object.keys(extras);
    for (var i = 0; i < keys.length; i++) {
      out[keys[i]] = extras[keys[i]];
    }
  }
  return out;
}

function holdResult(missingInputs, context) {
  return buildResult(
    "hold_for_input",
    "Insufficient inputs: " + missingInputs.join(", "),
    0,
    "hold_for_input",
    { missing_inputs: missingInputs, hold_context: context || null }
  );
}

// ================================================================
// ENGINE 1: ASSET ROUTER
// Classify asset domain, applicable codes, damage families
// ================================================================
function routeAsset(input) {
  var assetType = (input.asset_type || "").toUpperCase();
  var temp = input.operating_temperature || input.design_temperature || 0;
  var material = (input.material_spec || input.material || "").toLowerCase();
  var domain = "UNKNOWN";
  var codeCandidates = [];
  var damageFamilies = [];
  var inspectionPriority = "ROUTINE";

  // Domain classification
  if (PRESSURE_PARTS.indexOf(assetType) !== -1) {
    domain = "PRESSURE_PARTS";
    codeCandidates = ["ASME_SECTION_I", "NBIC", "JURISDICTIONAL_BOILER_RULES", "ASME_SECTION_V"];
    damageFamilies = ["CREEP", "FATIGUE", "CORROSION", "EROSION"];
    if (temp > HIGH_TEMP_THRESHOLD) {
      damageFamilies.push("HIGH_TEMPERATURE_DEGRADATION");
      inspectionPriority = "ELEVATED";
    }
  } else if (POWER_PIPING.indexOf(assetType) !== -1) {
    domain = "POWER_PIPING";
    codeCandidates = ["ASME_B31_1", "ASME_SECTION_V", "NBIC", "OWNER_USER_PROGRAM"];
    damageFamilies = ["CREEP", "FATIGUE", "FAC", "EXPANSION_STRESS"];
    if (temp > HIGH_TEMP_THRESHOLD) {
      damageFamilies.push("HIGH_TEMPERATURE_DEGRADATION");
      inspectionPriority = "ELEVATED";
    }
  } else if (ROTATING_EQUIPMENT.indexOf(assetType) !== -1) {
    domain = "ROTATING_EQUIPMENT";
    codeCandidates = ["OEM_MANUAL", "EPRI_GUIDANCE", "ISO_VIBRATION", "OWNER_RELIABILITY_PROGRAM"];
    damageFamilies = ["BLADE_FATIGUE", "ROTOR_CREEP_FATIGUE", "EROSION", "VIBRATION"];
    inspectionPriority = "ELEVATED";
  } else if (PRESSURE_EQUIPMENT.indexOf(assetType) !== -1) {
    domain = "PRESSURE_EQUIPMENT";
    codeCandidates = ["ASME_SECTION_VIII", "API_510", "ASME_SECTION_V"];
    damageFamilies = ["CORROSION", "FATIGUE", "EROSION"];
  } else if (BOP.indexOf(assetType) !== -1) {
    domain = "BALANCE_OF_PLANT";
    codeCandidates = ["OWNER_PROGRAM", "OEM_MANUAL"];
    damageFamilies = ["MECHANICAL", "CORROSION"];
  }

  // Material-specific additions
  if (material.indexOf("carbon") !== -1 && temp > 425) {
    damageFamilies.push("GRAPHITIZATION");
  }
  if ((material.indexOf("cr-mo") !== -1 || material.indexOf("alloy") !== -1) && temp > 340) {
    damageFamilies.push("TEMPER_EMBRITTLEMENT");
  }

  // FAC susceptibility
  if (material.indexOf("carbon") !== -1 && temp >= FAC_TEMP_MIN && temp <= FAC_TEMP_MAX) {
    if (POWER_PIPING.indexOf(assetType) !== -1 || assetType === "ECONOMIZER" || assetType === "DEAERATOR") {
      if (damageFamilies.indexOf("FAC") === -1) damageFamilies.push("FAC");
    }
  }

  // Evidence contract — what data is required for this asset domain
  var requiredEvidence = ["visual_inspection", "thickness_readings"];
  if (domain === "PRESSURE_PARTS" && temp > HIGH_TEMP_THRESHOLD) {
    requiredEvidence.push("replication", "hardness", "temperature_history", "service_hours");
  }
  if (domain === "ROTATING_EQUIPMENT") {
    requiredEvidence.push("vibration_data", "borescope", "operating_hours", "start_count");
  }
  if (damageFamilies.indexOf("FAC") !== -1) {
    requiredEvidence.push("thickness_grid", "water_chemistry", "flow_velocity");
  }
  if (damageFamilies.indexOf("FATIGUE") !== -1 || damageFamilies.indexOf("BLADE_FATIGUE") !== -1) {
    requiredEvidence.push("cycle_history", "crack_inspection");
  }

  return buildResult(
    { domain: domain, code_candidates: codeCandidates, damage_families: damageFamilies,
      required_evidence: requiredEvidence, inspection_priority: inspectionPriority },
    "Asset classified as " + domain + " with " + damageFamilies.length + " damage families",
    0.85,
    inspectionPriority === "ELEVATED" ? "medium" : "low",
    { asset_type: assetType, asset_domain: domain }
  );
}

// ================================================================
// ENGINE 2: BOILER/HRSG DAMAGE MODEL
// Evaluate damage based on location, temperature, chemistry, history
// ================================================================
function runBoilerDamageModel(input) {
  var missing = [];
  if (!input.asset_type) missing.push("asset_type");
  if (!input.operating_temperature && !input.temperature) missing.push("operating_temperature");
  if (missing.length > 0) return holdResult(missing, "boiler_damage_model");

  var temp = input.operating_temperature || input.temperature || 0;
  var assetType = (input.asset_type || "").toUpperCase();
  var fuelType = (input.fuel_type || "").toLowerCase();
  var hasChemistry = !!(input.water_chemistry || input.ph || input.dissolved_oxygen);
  var hasThickness = !!(input.thickness_readings || input.wall_thickness);
  var hasVisual = !!(input.visual_findings || input.findings);
  var hasThermalHistory = !!(input.thermal_events || input.event_history);

  var mechanisms = [];
  var confidence = 0.3;
  var explanation = [];

  // Creep assessment for high-temp zones
  if (temp > HIGH_TEMP_THRESHOLD) {
    var creepConf = 0.3;
    if (input.swelling || input.hardness_shift) creepConf += 0.2;
    if (input.replication_results) creepConf += 0.3;
    if (input.service_hours && input.service_hours > 100000) creepConf += 0.1;
    mechanisms.push({ mechanism: "CREEP", confidence: Math.min(creepConf, 0.95),
      evidence: temp > HIGH_TEMP_THRESHOLD ? "high_temperature_zone" : "none" });
    explanation.push("High-temperature zone (" + temp + "C) — creep assessment activated");
  }

  // FAC for economizer/feedwater areas
  if (assetType === "ECONOMIZER" || assetType === "FEEDWATER_PIPE" || assetType === "CONDENSATE_PIPE") {
    if (temp >= FAC_TEMP_MIN && temp <= FAC_TEMP_MAX) {
      var facConf = 0.35;
      if (input.wall_thinning || input.thinning_at_elbows) facConf += 0.25;
      if (hasChemistry && input.dissolved_oxygen && input.dissolved_oxygen < 5) facConf += 0.15;
      mechanisms.push({ mechanism: "FLOW_ACCELERATED_CORROSION", confidence: Math.min(facConf, 0.9),
        evidence: "susceptible_geometry_and_temperature" });
      explanation.push("FAC-susceptible temperature range and geometry detected");
    }
  }

  // Under-deposit corrosion
  if (input.waterside_deposits || input.localized_wastage) {
    mechanisms.push({ mechanism: "BOILER_TUBE_CORROSION", confidence: 0.5,
      subtype: "under_deposit", evidence: "deposit_and_wastage" });
    explanation.push("Waterside deposits with localized wastage — under-deposit corrosion suspected");
  }

  // Fireside corrosion/erosion
  if (input.fireside_deposits || input.external_wastage || fuelType === "coal" || fuelType === "biomass") {
    var fsConf = 0.3;
    if (input.fireside_deposits) fsConf += 0.2;
    if (input.external_wastage) fsConf += 0.2;
    if (fuelType === "coal" || fuelType === "biomass") fsConf += 0.1;
    mechanisms.push({ mechanism: "BOILER_TUBE_CORROSION", confidence: Math.min(fsConf, 0.85),
      subtype: "fireside", evidence: "fireside_indicators" });
    explanation.push("Fireside corrosion/erosion indicators present");
  }

  // LCF from startup/shutdown
  if (hasThermalHistory || input.cold_starts || input.rapid_ramping) {
    var lcfConf = 0.3;
    if (input.cracking_at_attachment || input.nozzle_crack || input.header_crack) lcfConf += 0.3;
    if (input.cold_starts && input.cold_starts > 100) lcfConf += 0.15;
    mechanisms.push({ mechanism: "LOW_CYCLE_FATIGUE", confidence: Math.min(lcfConf, 0.85),
      evidence: "thermal_cycling_history" });
    explanation.push("Startup/shutdown cycling history — LCF assessment activated");
  }

  // Hydrogen damage
  if (input.hydrogen_damage_suspected || (input.ut_attenuation && input.ut_attenuation > 0)) {
    mechanisms.push({ mechanism: "HYDROGEN_DAMAGE", confidence: 0.4,
      evidence: "ut_attenuation_or_suspected" });
    explanation.push("Hydrogen damage indicators — requires metallographic confirmation");
  }

  // Calculate overall confidence
  if (mechanisms.length > 0) {
    var maxConf = 0;
    for (var mi = 0; mi < mechanisms.length; mi++) {
      if (mechanisms[mi].confidence > maxConf) maxConf = mechanisms[mi].confidence;
    }
    confidence = maxConf;
  }

  // Determine severity
  var severity = "low";
  if (confidence > 0.7) severity = "high";
  else if (confidence > 0.5) severity = "medium";

  // Check for critical indicators
  for (var ci = 0; ci < mechanisms.length; ci++) {
    if (mechanisms[ci].mechanism === "HYDROGEN_DAMAGE" && mechanisms[ci].confidence > 0.5) severity = "critical";
    if (mechanisms[ci].mechanism === "CREEP" && input.replication_results &&
        (input.replication_results === "microcracking" || input.replication_results === "macrocracking")) {
      severity = "critical";
    }
  }

  // Recommended next methods
  var nextMethods = [];
  if (!hasThickness) nextMethods.push("UT_THICKNESS");
  if (!input.replication_results && temp > HIGH_TEMP_THRESHOLD) nextMethods.push("REPLICATION");
  if (!input.hardness_readings) nextMethods.push("HARDNESS_TESTING");
  if (mechanisms.length > 0 && !input.paut_results) nextMethods.push("PAUT_TOFD");

  return buildResult(
    { mechanisms: mechanisms, next_methods: nextMethods, mechanism_count: mechanisms.length },
    mechanisms.length + " damage mechanism(s) identified for " + assetType,
    confidence,
    severity,
    { explanation: explanation, asset_type: assetType }
  );
}

// ================================================================
// ENGINE 3: CREEP LIFE ENGINE
// Estimate creep stage, damage index, remaining life confidence
// ================================================================
function runCreepAnalysis(input) {
  var missing = [];
  if (!input.material && !input.material_spec) missing.push("material");
  if (!input.operating_temperature && !input.temperature) missing.push("operating_temperature");
  if (missing.length > 0) return holdResult(missing, "creep_analysis");

  var temp = input.operating_temperature || input.temperature || 0;
  var stress = input.operating_stress || input.stress || 0;
  var serviceHours = input.service_hours || 0;
  var material = (input.material || input.material_spec || "").toLowerCase();
  var replication = (input.replication_results || "").toLowerCase();
  var hardness = input.hardness_results || null;
  var deformation = input.deformation_measurements || input.swelling || null;
  var tempExcursions = input.temperature_excursions || 0;

  // If below creep threshold, return clean
  if (temp < HIGH_TEMP_THRESHOLD) {
    return buildResult(
      { creep_stage: "NOT_APPLICABLE", creep_damage_index: 0, remaining_life_band: "N/A",
        inspection_escalation: "NONE" },
      "Operating temperature (" + temp + "C) below creep threshold (" + HIGH_TEMP_THRESHOLD + "C)",
      0.9, "low", {}
    );
  }

  // Determine creep stage from evidence
  var creepStage = "SUSPECTED";
  var damageIndex = 0.1;
  var confidence = 0.3;

  if (replication) {
    confidence = 0.7;
    if (replication.indexOf("no voids") !== -1 || replication.indexOf("none") !== -1 || replication === "clean") {
      creepStage = "NONE_OBSERVED";
      damageIndex = 0.05;
      confidence = 0.85;
    } else if (replication.indexOf("isolated") !== -1 || replication.indexOf("scattered") !== -1 || replication.indexOf("early") !== -1) {
      creepStage = "EARLY_VOIDING";
      damageIndex = 0.25;
    } else if (replication.indexOf("aligned") !== -1 || replication.indexOf("oriented") !== -1 || replication.indexOf("chain") !== -1) {
      creepStage = "ALIGNED_VOIDING";
      damageIndex = 0.5;
      confidence = 0.8;
    } else if (replication.indexOf("micro") !== -1) {
      creepStage = "MICROCRACKING";
      damageIndex = 0.75;
      confidence = 0.85;
    } else if (replication.indexOf("macro") !== -1) {
      creepStage = "MACROCRACKING";
      damageIndex = 0.9;
      confidence = 0.9;
    }
  } else {
    // No replication — infer from other data
    if (serviceHours > 200000 && temp > 500) {
      creepStage = "SUSPECTED";
      damageIndex = 0.3;
    } else if (serviceHours > 100000 && temp > HIGH_TEMP_THRESHOLD) {
      creepStage = "SUSPECTED";
      damageIndex = 0.15;
    }
    if (deformation) {
      damageIndex += 0.15;
      creepStage = damageIndex > 0.4 ? "EARLY_VOIDING" : "SUSPECTED";
    }
    if (hardness && typeof hardness === "string" && hardness.indexOf("drop") !== -1) {
      damageIndex += 0.1;
    }
    confidence = Math.min(confidence, 0.4); // Cap confidence without replication
  }

  // Temperature excursion penalty
  if (tempExcursions > 5) {
    damageIndex = Math.min(damageIndex + 0.1, 1.0);
  }

  // Remaining life band
  var remainingLifeBand = "UNKNOWN";
  if (damageIndex < 0.1) remainingLifeBand = "LONG (>100,000 hrs)";
  else if (damageIndex < 0.25) remainingLifeBand = "MODERATE (50,000-100,000 hrs)";
  else if (damageIndex < 0.5) remainingLifeBand = "LIMITED (10,000-50,000 hrs)";
  else if (damageIndex < 0.75) remainingLifeBand = "SHORT (<10,000 hrs)";
  else remainingLifeBand = "IMMEDIATE CONCERN";

  // Inspection escalation
  var escalation = "ROUTINE";
  if (creepStage === "EARLY_VOIDING") escalation = "INCREASED_FREQUENCY";
  else if (creepStage === "ALIGNED_VOIDING") escalation = "ENGINEERING_ASSESSMENT";
  else if (creepStage === "MICROCRACKING") escalation = "REMOVE_FROM_SERVICE_PENDING_REVIEW";
  else if (creepStage === "MACROCRACKING") escalation = "IMMEDIATE_REMOVAL";

  // Authority lock
  var authorityLock = "PROVISIONAL";
  if (creepStage === "MICROCRACKING" || creepStage === "MACROCRACKING") {
    authorityLock = "REMOVE_FROM_SERVICE_RECOMMENDED";
  }
  if (creepStage === "MACROCRACKING" || creepStage === "FAILURE_IMMINENT") {
    authorityLock = "DO_NOT_RETURN_TO_SERVICE";
  }
  if (!replication && serviceHours > 100000 && temp > HIGH_TEMP_THRESHOLD) {
    authorityLock = "HOLD_FOR_INPUT";
  }

  // Severity
  var severity = "low";
  if (creepStage === "MICROCRACKING" || creepStage === "MACROCRACKING" || creepStage === "FAILURE_IMMINENT") severity = "critical";
  else if (creepStage === "ALIGNED_VOIDING") severity = "high";
  else if (creepStage === "EARLY_VOIDING") severity = "medium";
  else if (creepStage === "SUSPECTED" && damageIndex > 0.2) severity = "medium";

  // Missing evidence
  var missingEvidence = [];
  if (!replication) missingEvidence.push("metallographic_replication");
  if (!hardness) missingEvidence.push("hardness_testing");
  if (!deformation) missingEvidence.push("dimensional_survey");
  if (serviceHours === 0) missingEvidence.push("service_hours");

  return buildResult(
    { creep_stage: creepStage, creep_damage_index: Math.round(damageIndex * 1000) / 1000,
      remaining_life_band: remainingLifeBand, inspection_escalation: escalation,
      authority_lock: authorityLock, missing_evidence: missingEvidence },
    "Creep stage: " + creepStage + " | Damage index: " + (Math.round(damageIndex * 100)) + "% | " + remainingLifeBand,
    confidence,
    severity,
    { material: material, temperature: temp, service_hours: serviceHours }
  );
}

// ================================================================
// ENGINE 4: FATIGUE CYCLE ENGINE
// Model LCF and thermal fatigue from operating history
// ================================================================
function runFatigueAnalysis(input) {
  var coldStarts = input.cold_starts || 0;
  var warmStarts = input.warm_starts || 0;
  var hotStarts = input.hot_starts || 0;
  var trips = input.trips || 0;
  var loadRejections = input.load_rejections || 0;
  var rampRate = input.ramp_rate || 0;
  var thermalGradient = input.thermal_gradient || 0;
  var crackEvidence = input.crack_evidence || false;
  var attemperatorEvents = input.attemperator_events || 0;

  var totalCycles = coldStarts + warmStarts + hotStarts + trips + loadRejections;
  if (totalCycles === 0 && !crackEvidence && attemperatorEvents === 0) {
    return holdResult(["cycle_history (cold_starts, warm_starts, hot_starts, trips)"], "fatigue_analysis");
  }

  // Equivalent damage cycles using weighting factors
  var equivalentCycles = (coldStarts * 1.0) + (warmStarts * 0.5) + (hotStarts * 0.2)
    + (trips * 1.5) + (loadRejections * 1.2);

  // Fatigue risk scoring
  var riskScore = 0;
  if (equivalentCycles > 5000) riskScore += 40;
  else if (equivalentCycles > 2000) riskScore += 25;
  else if (equivalentCycles > 500) riskScore += 15;
  else riskScore += 5;

  // Ramp rate penalty
  if (rampRate > 5) riskScore += 15;
  else if (rampRate > 3) riskScore += 8;

  // Trip penalty (trips are severe)
  if (trips > 20) riskScore += 20;
  else if (trips > 5) riskScore += 10;

  // Crack evidence boost
  if (crackEvidence) riskScore += 25;

  // Thermal fatigue from attemperator
  var thermalFatigueRisk = "LOW";
  if (attemperatorEvents > 100) {
    thermalFatigueRisk = "HIGH";
    riskScore += 15;
  } else if (attemperatorEvents > 20) {
    thermalFatigueRisk = "MEDIUM";
    riskScore += 8;
  }

  // Thermal gradient penalty
  if (thermalGradient > 200) riskScore += 15;
  else if (thermalGradient > 100) riskScore += 8;

  riskScore = Math.min(riskScore, 100);

  // Critical locations
  var criticalLocations = [];
  if (coldStarts > 50 || warmStarts > 200) {
    criticalLocations.push("drum_nozzles", "header_ligaments", "tube_to_header_welds");
  }
  if (trips > 5) {
    criticalLocations.push("turbine_rotor", "blade_roots", "thick_to_thin_transitions");
  }
  if (attemperatorEvents > 20) {
    criticalLocations.push("attemperator_zone", "downstream_piping", "spray_nozzle_welds");
  }
  if (rampRate > 3) {
    criticalLocations.push("pipe_supports", "restraint_points", "anchor_bolts");
  }

  // Determine severity and confidence
  var severity = "low";
  var confidence = 0.5;
  if (riskScore > 70) { severity = "critical"; confidence = 0.75; }
  else if (riskScore > 50) { severity = "high"; confidence = 0.65; }
  else if (riskScore > 30) { severity = "medium"; confidence = 0.55; }

  if (crackEvidence) confidence = Math.min(confidence + 0.15, 0.9);

  // Inspection plan
  var inspectionPlan = [];
  if (riskScore > 50) {
    inspectionPlan.push("PAUT/TOFD at critical weld locations");
    inspectionPlan.push("PT/MT at nozzle and attachment welds");
  }
  if (thermalFatigueRisk !== "LOW") {
    inspectionPlan.push("Circumferential crack inspection at attemperator zones");
  }
  if (trips > 10) {
    inspectionPlan.push("Rotor bore and dovetail inspection");
  }

  return buildResult(
    { equivalent_damage_cycles: Math.round(equivalentCycles),
      fatigue_risk_score: riskScore, thermal_fatigue_risk: thermalFatigueRisk,
      critical_locations: criticalLocations, inspection_plan: inspectionPlan,
      cycle_summary: { cold: coldStarts, warm: warmStarts, hot: hotStarts,
        trips: trips, load_rejections: loadRejections, attemperator: attemperatorEvents } },
    "Equivalent damage cycles: " + Math.round(equivalentCycles) + " | Risk score: " + riskScore + "/100",
    confidence,
    severity,
    { total_actual_cycles: totalCycles }
  );
}

// ================================================================
// ENGINE 5: THERMAL STRESS SCREENING
// Simplified thermal stress calculation with FEA hook
// ================================================================
function runThermalStress(input) {
  var missing = [];
  if (!input.wall_thickness && !input.thickness) missing.push("wall_thickness");
  if (!input.thermal_gradient && !input.delta_t) missing.push("thermal_gradient or delta_t");
  if (missing.length > 0) return holdResult(missing, "thermal_stress");

  var wallThickness = input.wall_thickness || input.thickness || 0;
  var deltaT = input.thermal_gradient || input.delta_t || 0;
  var elasticModulus = input.elastic_modulus || 200; // GPa default for steel
  var cte = input.cte || input.material_cte || 12e-6; // /C default for carbon steel
  var constraintFactor = input.constraint_factor || 0.7;
  var geometryFactor = input.geometry_factor || 1.0;
  var yieldStrength = input.yield_strength || 250; // MPa default

  // Convert elastic modulus to MPa if given in GPa
  var eMpa = elasticModulus;
  if (elasticModulus < 1000) eMpa = elasticModulus * 1000;

  // Thermal stress = E * alpha * deltaT * constraint * geometry
  var thermalStress = eMpa * cte * deltaT * constraintFactor * geometryFactor;
  thermalStress = Math.round(thermalStress * 100) / 100;

  // Stress ratio
  var stressRatio = thermalStress / yieldStrength;
  stressRatio = Math.round(stressRatio * 1000) / 1000;

  // Severity classification
  var stressSeverity = "LOW";
  var severity = "low";
  var feaRequired = false;
  if (stressRatio > 0.9) {
    stressSeverity = "CRITICAL";
    severity = "critical";
    feaRequired = true;
  } else if (stressRatio > 0.6) {
    stressSeverity = "HIGH";
    severity = "high";
    feaRequired = true;
  } else if (stressRatio > 0.3) {
    stressSeverity = "MODERATE";
    severity = "medium";
  }

  // Vulnerable locations based on geometry
  var vulnerableLocations = [];
  if (wallThickness > 25) vulnerableLocations.push("thick_wall_transitions", "nozzle_corners");
  if (deltaT > 150) vulnerableLocations.push("spray_zones", "mixing_tees", "bypass_junctions");
  if (constraintFactor > 0.8) vulnerableLocations.push("anchored_points", "rigid_supports");

  return buildResult(
    { thermal_stress_mpa: thermalStress, stress_ratio: stressRatio,
      stress_severity: stressSeverity, fea_required: feaRequired,
      vulnerable_locations: vulnerableLocations,
      inputs_used: { wall_thickness: wallThickness, delta_t: deltaT,
        elastic_modulus_gpa: elasticModulus, cte: cte,
        constraint_factor: constraintFactor, yield_strength: yieldStrength } },
    "Thermal stress: " + thermalStress + " MPa (" + (Math.round(stressRatio * 100)) + "% yield) — " + stressSeverity,
    0.7,
    severity,
    { fea_hook: feaRequired ? "FEA_RECOMMENDED" : "SCREENING_SUFFICIENT" }
  );
}

// ================================================================
// ENGINE 6: FAC ENGINE
// Flow-accelerated corrosion risk evaluation
// ================================================================
function runFACAnalysis(input) {
  var missing = [];
  if (!input.material && !input.material_spec) missing.push("material");
  if (!input.temperature && !input.operating_temperature) missing.push("temperature");
  if (missing.length > 0) return holdResult(missing, "fac_analysis");

  var material = (input.material || input.material_spec || "").toLowerCase();
  var temp = input.temperature || input.operating_temperature || 0;
  var flowVelocity = input.flow_velocity || 0;
  var dissolvedOxygen = input.dissolved_oxygen || null;
  var ph = input.ph || null;
  var geometry = (input.geometry || "").toLowerCase();
  var wallThickness = input.wall_thickness || null;
  var minRequired = input.min_required_thickness || null;
  var thinningRate = input.thinning_rate || null;

  // Material susceptibility
  var materialSusceptible = material.indexOf("carbon") !== -1 || material.indexOf("a106") !== -1
    || material.indexOf("a335 p1") !== -1 || material.indexOf("sa-106") !== -1;
  if (!materialSusceptible && material.indexOf("chrome") === -1 && material.indexOf("cr") === -1) {
    materialSusceptible = true; // Assume susceptible if unknown and not chrome
  }

  // Temperature susceptibility (peak FAC around 150C for single-phase)
  var tempSusceptible = temp >= FAC_TEMP_MIN && temp <= FAC_TEMP_MAX;

  // Geometry susceptibility
  var geometrySusceptible = geometry.indexOf("elbow") !== -1 || geometry.indexOf("tee") !== -1
    || geometry.indexOf("reducer") !== -1 || geometry.indexOf("downstream") !== -1
    || geometry.indexOf("orifice") !== -1;

  // FAC probability
  var facProbability = 0.1;
  if (materialSusceptible) facProbability += 0.2;
  if (tempSusceptible) facProbability += 0.2;
  if (geometrySusceptible) facProbability += 0.15;
  if (flowVelocity > 6) facProbability += 0.15;
  else if (flowVelocity > 3) facProbability += 0.08;
  if (dissolvedOxygen !== null && dissolvedOxygen < 5) facProbability += 0.1;
  if (ph !== null && ph < 9.0) facProbability += 0.1;
  facProbability = Math.min(facProbability, 0.95);

  // Remaining life estimate
  var remainingLife = null;
  if (wallThickness && minRequired && thinningRate && thinningRate > 0) {
    var margin = wallThickness - minRequired;
    remainingLife = margin > 0 ? Math.round((margin / thinningRate) * 10) / 10 : 0;
  }

  // Severity
  var severity = "low";
  if (facProbability > 0.7) severity = "critical";
  else if (facProbability > 0.5) severity = "high";
  else if (facProbability > 0.3) severity = "medium";

  if (remainingLife !== null && remainingLife < 2) severity = "critical";
  if (remainingLife !== null && remainingLife <= 0) severity = "critical";

  // Required UT grid
  var utGrid = [];
  if (facProbability > 0.3) {
    utGrid.push("downstream_of_valves", "elbows_and_bends", "reducers_and_expansions");
    if (facProbability > 0.5) utGrid.push("tee_intersections", "orifice_downstream", "pump_discharge");
  }

  // Replacement priority
  var replacementPriority = "MONITOR";
  if (remainingLife !== null && remainingLife < 1) replacementPriority = "IMMEDIATE_REPLACEMENT";
  else if (remainingLife !== null && remainingLife < 3) replacementPriority = "SCHEDULED_REPLACEMENT";
  else if (severity === "high" || severity === "critical") replacementPriority = "ENGINEERING_REVIEW";

  return buildResult(
    { fac_probability: Math.round(facProbability * 100) / 100,
      remaining_life_years: remainingLife, thinning_rate: thinningRate,
      material_susceptible: materialSusceptible, temp_susceptible: tempSusceptible,
      geometry_susceptible: geometrySusceptible, required_ut_grid: utGrid,
      replacement_priority: replacementPriority },
    "FAC probability: " + (Math.round(facProbability * 100)) + "%" +
      (remainingLife !== null ? " | Remaining life: " + remainingLife + " years" : ""),
    hasData(wallThickness, dissolvedOxygen, ph) ? 0.75 : 0.45,
    severity,
    {}
  );
}

function hasData() {
  for (var i = 0; i < arguments.length; i++) {
    if (arguments[i] !== null && arguments[i] !== undefined) return true;
  }
  return false;
}

// ================================================================
// ENGINE 7: TURBINE FAILURE INTELLIGENCE
// Gas/steam turbine risk analysis
// ================================================================
function runTurbineAnalysis(input) {
  var missing = [];
  if (!input.turbine_type && !input.asset_type) missing.push("turbine_type");
  if (missing.length > 0) return holdResult(missing, "turbine_analysis");

  var turbineType = (input.turbine_type || input.asset_type || "").toUpperCase();
  var vibrationTrend = input.vibration_trend || input.vibration || null;
  var borescope = input.borescope_observations || input.borescope || null;
  var bladeCondition = input.blade_condition || null;
  var rotorHours = input.rotor_hours || input.operating_hours || 0;
  var starts = input.starts || 0;
  var trips = input.trips || 0;
  var overspeedEvents = input.overspeed_events || 0;
  var tempSpreads = input.temperature_spreads || null;
  var lubeOil = input.lube_oil_data || null;
  var ndtResults = input.ndt_results || null;

  var bladeRisk = "LOW";
  var rotorRisk = "LOW";
  var bearingRisk = "LOW";
  var casingRisk = "LOW";
  var explanation = [];
  var operatingRestriction = null;
  var inspectionRec = [];

  // Blade risk assessment
  var bladeScore = 0;
  if (vibrationTrend === "rising" || vibrationTrend === "increasing") {
    bladeScore += 30;
    explanation.push("Rising vibration trend detected — blade degradation possible");
  }
  if (borescope && (typeof borescope === "string") &&
      (borescope.indexOf("crack") !== -1 || borescope.indexOf("pit") !== -1 ||
       borescope.indexOf("erosion") !== -1 || borescope.indexOf("fod") !== -1)) {
    bladeScore += 35;
    explanation.push("Borescope findings indicate blade damage");
  }
  if (bladeCondition === "degraded" || bladeCondition === "damaged") {
    bladeScore += 25;
  }
  if (trips > 5) { bladeScore += 10; explanation.push(trips + " trips recorded — increased blade fatigue loading"); }
  if (bladeScore > 60) bladeRisk = "CRITICAL";
  else if (bladeScore > 40) bladeRisk = "HIGH";
  else if (bladeScore > 20) bladeRisk = "MEDIUM";

  // Rotor risk assessment
  var rotorScore = 0;
  if (rotorHours > 200000) { rotorScore += 20; explanation.push("Rotor hours >200k — creep-fatigue accumulation"); }
  else if (rotorHours > 100000) rotorScore += 10;
  if (starts > 1000) { rotorScore += 15; explanation.push(starts + " starts — LCF loading on rotor"); }
  if (overspeedEvents > 0) {
    rotorScore += 25 * overspeedEvents;
    explanation.push(overspeedEvents + " overspeed event(s) — rotor integrity concern");
  }
  if (tempSpreads && (typeof tempSpreads === "string") && tempSpreads.indexOf("high") !== -1) {
    rotorScore += 15;
  }
  if (rotorScore > 50) rotorRisk = "CRITICAL";
  else if (rotorScore > 30) rotorRisk = "HIGH";
  else if (rotorScore > 15) rotorRisk = "MEDIUM";

  // Bearing risk
  if (lubeOil && (typeof lubeOil === "string") &&
      (lubeOil.indexOf("metal") !== -1 || lubeOil.indexOf("particle") !== -1 || lubeOil.indexOf("debris") !== -1)) {
    bearingRisk = "HIGH";
    explanation.push("Lube oil analysis indicates bearing distress");
  }
  if (vibrationTrend === "rising") bearingRisk = bearingRisk === "LOW" ? "MEDIUM" : bearingRisk;

  // Operating restriction
  if (bladeRisk === "CRITICAL" || rotorRisk === "CRITICAL") {
    operatingRestriction = "DO_NOT_RETURN_TO_SERVICE_WITHOUT_ENGINEERING_REVIEW";
  } else if (bladeRisk === "HIGH" && vibrationTrend === "rising") {
    operatingRestriction = "LOAD_RESTRICTION_PENDING_INSPECTION";
  }

  // Inspection recommendations
  if (bladeRisk !== "LOW") inspectionRec.push("Borescope inspection of all blade rows");
  if (rotorRisk !== "LOW") inspectionRec.push("Rotor bore and surface NDE");
  if (bearingRisk !== "LOW") inspectionRec.push("Bearing inspection and lube oil trending");
  if (bladeRisk === "CRITICAL") inspectionRec.push("Blade removal and bench inspection");
  if (rotorRisk === "CRITICAL") inspectionRec.push("Full rotor life assessment per OEM/EPRI");
  if (overspeedEvents > 0) inspectionRec.push("Post-overspeed inspection per OEM protocol");

  // Overall severity
  var maxRisk = "LOW";
  var risks = [bladeRisk, rotorRisk, bearingRisk, casingRisk];
  var riskOrder = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  for (var ri = 0; ri < risks.length; ri++) {
    if (riskOrder.indexOf(risks[ri]) > riskOrder.indexOf(maxRisk)) maxRisk = risks[ri];
  }

  var severity = "low";
  if (maxRisk === "CRITICAL") severity = "critical";
  else if (maxRisk === "HIGH") severity = "high";
  else if (maxRisk === "MEDIUM") severity = "medium";

  return buildResult(
    { blade_risk: bladeRisk, rotor_risk: rotorRisk, bearing_risk: bearingRisk,
      casing_risk: casingRisk, operating_restriction: operatingRestriction,
      inspection_recommendation: inspectionRec,
      operating_summary: { hours: rotorHours, starts: starts, trips: trips,
        overspeed_events: overspeedEvents } },
    turbineType + " analysis: blade=" + bladeRisk + " rotor=" + rotorRisk +
      " bearing=" + bearingRisk + (operatingRestriction ? " | RESTRICTION: " + operatingRestriction : ""),
    vibrationTrend || borescope || ndtResults ? 0.7 : 0.4,
    severity,
    { explanation: explanation, turbine_type: turbineType }
  );
}

// ================================================================
// ENGINE 8: CONSEQUENCE/CRITICALITY
// ================================================================
function runConsequence(input) {
  var pressure = input.pressure || input.operating_pressure || input.design_pressure || 0;
  var temp = input.temperature || input.operating_temperature || input.design_temperature || 0;
  var personnelExposure = (input.personnel_exposure || "").toUpperCase();
  var mwImpact = input.unit_mw || input.load_mw || 0;
  var replacementCost = input.replacement_cost || 0;
  var outageCost = input.outage_cost_per_day || 0;
  var envImpact = (input.environmental_impact || "").toUpperCase();
  var cascadePotential = input.cascading_failure_potential || false;

  // Stored energy proxy (pressure * temp is a rough proxy)
  var storedEnergy = pressure * temp;

  // Safety risk
  var safetyScore = 0;
  if (pressure > 100) safetyScore += 20; // bar
  if (temp > 500) safetyScore += 20;
  if (storedEnergy > 50000) safetyScore += 15;
  if (personnelExposure === "HIGH" || personnelExposure === "CONTINUOUS") safetyScore += 25;
  else if (personnelExposure === "MEDIUM" || personnelExposure === "REGULAR") safetyScore += 15;
  var safetyRisk = "LOW";
  if (safetyScore > 50) safetyRisk = "CRITICAL";
  else if (safetyScore > 35) safetyRisk = "HIGH";
  else if (safetyScore > 20) safetyRisk = "MEDIUM";

  // Business risk
  var businessScore = 0;
  if (mwImpact > 200) businessScore += 30;
  else if (mwImpact > 50) businessScore += 15;
  if (outageCost > 500000) businessScore += 25;
  else if (outageCost > 100000) businessScore += 15;
  if (replacementCost > 5000000) businessScore += 20;
  else if (replacementCost > 1000000) businessScore += 10;
  var businessRisk = "LOW";
  if (businessScore > 50) businessRisk = "CRITICAL";
  else if (businessScore > 30) businessRisk = "HIGH";
  else if (businessScore > 15) businessRisk = "MEDIUM";

  // Environmental
  var envRisk = "LOW";
  if (envImpact === "CRITICAL" || envImpact === "HIGH") envRisk = envImpact;
  else if (envImpact === "MEDIUM") envRisk = "MEDIUM";

  // Cascade
  var cascadeRisk = cascadePotential ? "HIGH" : "LOW";

  // Overall consequence
  var overallScores = [safetyRisk, businessRisk, envRisk, cascadeRisk];
  var consequenceLevel = "LOW";
  if (overallScores.indexOf("CRITICAL") !== -1) consequenceLevel = "CRITICAL";
  else if (overallScores.indexOf("HIGH") !== -1) consequenceLevel = "HIGH";
  else if (overallScores.indexOf("MEDIUM") !== -1) consequenceLevel = "MEDIUM";

  // Criticality score (0-100)
  var criticalityScore = Math.min(safetyScore + businessScore + (envRisk === "HIGH" ? 15 : envRisk === "MEDIUM" ? 8 : 0) + (cascadePotential ? 15 : 0), 100);

  return buildResult(
    { consequence_level: consequenceLevel, safety_risk: safetyRisk,
      business_risk: businessRisk, outage_risk: businessRisk,
      environmental_risk: envRisk, cascade_risk: cascadeRisk,
      criticality_score: criticalityScore },
    "Consequence: " + consequenceLevel + " | Safety: " + safetyRisk + " | Business: " + businessRisk + " | Score: " + criticalityScore,
    0.75,
    consequenceLevel === "CRITICAL" ? "critical" : consequenceLevel === "HIGH" ? "high" : consequenceLevel === "MEDIUM" ? "medium" : "low",
    {}
  );
}

// ================================================================
// ENGINE 9: CODE AUTHORITY RESOLUTION
// ================================================================
function resolveCodeAuthority(input) {
  var assetType = (input.asset_type || "").toUpperCase();
  var domain = (input.domain || input.asset_domain || "").toUpperCase();
  var hasFFS = input.fitness_for_service || input.ffs_required || false;
  var isTurbine = ROTATING_EQUIPMENT.indexOf(assetType) !== -1;
  var isBoiler = PRESSURE_PARTS.indexOf(assetType) !== -1;
  var isPiping = POWER_PIPING.indexOf(assetType) !== -1;
  var isPV = PRESSURE_EQUIPMENT.indexOf(assetType) !== -1;

  var primary = "OWNER_PROGRAM";
  var secondary = [];
  var conflicts = [];
  var humanRequired = [];

  if (isBoiler) {
    primary = "ASME_SECTION_I";
    secondary = ["NBIC", "JURISDICTIONAL_BOILER_RULES", "ASME_SECTION_V"];
    humanRequired.push("Jurisdictional boiler inspector authority required for final disposition");
    if (hasFFS) {
      secondary.push("API_579_FFS");
      conflicts.push("ASME Section I does not directly reference API 579 — engineering justification required for FFS approach");
    }
  } else if (isPiping) {
    primary = "ASME_B31_1";
    secondary = ["ASME_SECTION_V", "NBIC", "OWNER_USER_PROGRAM"];
    if (hasFFS) secondary.push("API_579_FFS");
  } else if (isTurbine) {
    primary = "OEM_ENGINEERING_AUTHORITY";
    secondary = ["EPRI_GUIDANCE", "ISO_VIBRATION", "OWNER_RELIABILITY_PROGRAM"];
    humanRequired.push("OEM or turbine specialist engineering review required");
    conflicts.push("Generic pressure codes do not govern rotating equipment internals — OEM authority dominates");
  } else if (isPV) {
    primary = "ASME_SECTION_VIII";
    secondary = ["API_510", "ASME_SECTION_V"];
    if (hasFFS) secondary.push("API_579_FFS");
  }

  // Always add safety requirements
  secondary.push("OSHA_PLANT_SAFETY");

  // Authority lock
  var authorityLock = "RESOLVED";
  if (primary === "OWNER_PROGRAM") authorityLock = "UNRESOLVED";
  if (humanRequired.length > 0) authorityLock = "REQUIRES_HUMAN_AUTHORITY";

  return buildResult(
    { primary_authority: primary, secondary_authorities: secondary,
      authority_conflicts: conflicts, required_human_authority: humanRequired,
      authority_lock: authorityLock },
    "Primary authority: " + primary + " | " + (conflicts.length > 0 ? conflicts.length + " conflict(s)" : "No conflicts"),
    primary !== "OWNER_PROGRAM" ? 0.85 : 0.4,
    authorityLock === "UNRESOLVED" ? "medium" : "low",
    { asset_type: assetType, domain: domain }
  );
}

// ================================================================
// ENGINE 10: DECISION LOCK ENGINE
// Enforce hard locks preventing unsafe conclusions
// ================================================================
function runDecisionLock(input) {
  var mechanisms = input.suspected_mechanisms || [];
  var severity = (input.severity || "").toUpperCase();
  var confidence = input.confidence || 0;
  var consequenceLevel = (input.consequence_level || "").toUpperCase();
  var primaryAuthority = input.primary_authority || "";
  var creepStage = (input.creep_stage || "").toUpperCase();
  var missingEvidence = input.missing_evidence || [];
  var crackEvidence = input.crack_evidence || false;
  var activeLeak = input.active_leak || false;
  var bladeRisk = (input.blade_risk || "").toUpperCase();
  var vibrationTrend = (input.vibration_trend || "").toLowerCase();
  var wallLossRapid = input.wall_loss_rapid || false;
  var unknownMaterial = input.unknown_material || false;
  var deformation = input.deformation || false;
  var evidenceConflict = input.evidence_conflict || false;

  var lockState = "CLEAR_TO_CLOSE";
  var lockReasons = [];
  var hardLocks = [];

  // === HARD LOCK CHECKS ===

  // Crack in high-energy pressure boundary
  if (crackEvidence && (consequenceLevel === "CRITICAL" || consequenceLevel === "HIGH")) {
    lockState = "ENGINEERING_REVIEW_REQUIRED";
    hardLocks.push("Crack-like indication in high-energy pressure boundary");
  }

  // Active leak
  if (activeLeak) {
    lockState = "REMOVE_FROM_SERVICE_RECOMMENDED";
    hardLocks.push("Active leak in boiler/steam pressure part");
  }

  // Creep microcracking or worse
  if (creepStage === "MICROCRACKING") {
    lockState = "REMOVE_FROM_SERVICE_RECOMMENDED";
    hardLocks.push("Creep microcracking detected — removal from service required pending engineering review");
  }
  if (creepStage === "MACROCRACKING" || creepStage === "FAILURE_IMMINENT") {
    lockState = "DO_NOT_RETURN_TO_SERVICE";
    hardLocks.push("Creep macrocracking/failure imminent — do not return to service");
  }

  // Turbine blade crack with vibration trend
  if (bladeRisk === "CRITICAL" || (bladeRisk === "HIGH" && vibrationTrend === "rising")) {
    if (lockState !== "DO_NOT_RETURN_TO_SERVICE") {
      lockState = "DO_NOT_RETURN_TO_SERVICE";
    }
    hardLocks.push("Turbine blade crack with rising vibration — do not return to service without specialist review");
  }

  // Rapid wall loss in FAC-susceptible piping
  if (wallLossRapid && mechanisms.indexOf("FLOW_ACCELERATED_CORROSION") !== -1) {
    if (lockState !== "DO_NOT_RETURN_TO_SERVICE") {
      lockState = "ENGINEERING_REVIEW_REQUIRED";
    }
    hardLocks.push("Rapid wall loss in FAC-susceptible piping");
  }

  // Unknown material in high-temperature service
  if (unknownMaterial) {
    if (lockState === "CLEAR_TO_CLOSE" || lockState === "PROVISIONAL") {
      lockState = "HOLD_FOR_INPUT";
    }
    hardLocks.push("Unknown material in high-temperature service — material confirmation required");
  }

  // Missing thickness where wall loss suspected
  if (missingEvidence.indexOf("thickness_readings") !== -1 || missingEvidence.indexOf("wall_thickness") !== -1) {
    if (lockState === "CLEAR_TO_CLOSE") lockState = "HOLD_FOR_INPUT";
    lockReasons.push("Missing thickness data where wall loss suspected");
  }

  // Pressure boundary deformation
  if (deformation) {
    if (lockState === "CLEAR_TO_CLOSE" || lockState === "PROVISIONAL") {
      lockState = "ENGINEERING_REVIEW_REQUIRED";
    }
    hardLocks.push("Pressure boundary deformation detected");
  }

  // Evidence conflict
  if (evidenceConflict) {
    if (lockState === "CLEAR_TO_CLOSE") lockState = "HOLD_FOR_INPUT";
    lockReasons.push("Evidence conflict between visual and NDT — resolution required");
  }

  // Code authority unresolved
  if (!primaryAuthority || primaryAuthority === "OWNER_PROGRAM" || primaryAuthority === "UNKNOWN") {
    if (lockState === "CLEAR_TO_CLOSE") lockState = "HOLD_FOR_INPUT";
    lockReasons.push("Code authority unresolved");
  }

  // Consequence CRITICAL with low confidence
  if (consequenceLevel === "CRITICAL" && confidence < 0.75) {
    if (lockState === "CLEAR_TO_CLOSE" || lockState === "PROVISIONAL") {
      lockState = "HOLD_FOR_INPUT";
    }
    lockReasons.push("Consequence CRITICAL with confidence below 0.75 — additional evidence required");
  }

  // === SOFT LOCK CHECKS (if no hard lock triggered) ===
  if (hardLocks.length === 0) {
    if (severity === "CRITICAL") {
      if (lockState === "CLEAR_TO_CLOSE") lockState = "ENGINEERING_REVIEW_REQUIRED";
      lockReasons.push("Severity CRITICAL requires engineering review");
    } else if (severity === "HIGH") {
      if (lockState === "CLEAR_TO_CLOSE") lockState = "PROVISIONAL";
      lockReasons.push("Severity HIGH — provisional pending confirmation");
    }
  }

  // Missing evidence check
  if (missingEvidence.length > 3 && lockState === "CLEAR_TO_CLOSE") {
    lockState = "HOLD_FOR_INPUT";
    lockReasons.push("Multiple evidence gaps (" + missingEvidence.length + " items missing)");
  }

  var allReasons = hardLocks.concat(lockReasons);

  return buildResult(
    { decision_lock: lockState, hard_locks: hardLocks, lock_reasons: lockReasons,
      is_hard_locked: hardLocks.length > 0, can_close: lockState === "CLEAR_TO_CLOSE",
      requires_human: lockState !== "CLEAR_TO_CLOSE" && lockState !== "PROVISIONAL" },
    "Decision lock: " + lockState + (hardLocks.length > 0 ? " (" + hardLocks.length + " hard lock(s))" : ""),
    0.9,
    lockState === "DO_NOT_RETURN_TO_SERVICE" ? "critical" :
      lockState === "REMOVE_FROM_SERVICE_RECOMMENDED" ? "critical" :
      lockState === "ENGINEERING_REVIEW_REQUIRED" ? "high" :
      lockState === "HOLD_FOR_INPUT" ? "medium" :
      lockState === "PROVISIONAL" ? "low" : "low",
    { all_reasons: allReasons }
  );
}

// ================================================================
// FULL AUTHORITY PIPELINE
// Runs all applicable engines in sequence
// ================================================================
function runFullAuthority(input) {
  var startTime = Date.now();

  // Step 1: Route asset
  var routing = routeAsset(input);
  var domain = routing.result ? routing.result.domain : "UNKNOWN";
  var damageFamilies = routing.result ? routing.result.damage_families : [];

  // Step 2: Run applicable damage/physics engines
  var creepResult = null;
  var fatigueResult = null;
  var facResult = null;
  var turbineResult = null;
  var thermalStressResult = null;
  var boilerDamageResult = null;

  var temp = input.operating_temperature || input.design_temperature || input.temperature || 0;

  // Boiler/HRSG damage model
  if (domain === "PRESSURE_PARTS") {
    boilerDamageResult = runBoilerDamageModel(input);
  }

  // Creep — if high temperature service
  if (temp > HIGH_TEMP_THRESHOLD || damageFamilies.indexOf("CREEP") !== -1 ||
      damageFamilies.indexOf("HIGH_TEMPERATURE_DEGRADATION") !== -1) {
    creepResult = runCreepAnalysis(input);
  }

  // Fatigue — if cycling history present
  if (input.cold_starts || input.warm_starts || input.trips || input.cycle_history ||
      damageFamilies.indexOf("FATIGUE") !== -1) {
    fatigueResult = runFatigueAnalysis(input);
  }

  // Thermal stress — if thermal transient data present
  if (input.thermal_gradient || input.delta_t || input.ramp_rate) {
    thermalStressResult = runThermalStress(input);
  }

  // FAC — if feedwater/condensate/economizer/piping
  if (domain === "POWER_PIPING" || damageFamilies.indexOf("FAC") !== -1 ||
      (input.asset_type && (input.asset_type.toUpperCase() === "FEEDWATER_PIPE" ||
       input.asset_type.toUpperCase() === "CONDENSATE_PIPE" || input.asset_type.toUpperCase() === "ECONOMIZER"))) {
    facResult = runFACAnalysis(input);
  }

  // Turbine — if rotating equipment
  if (domain === "ROTATING_EQUIPMENT") {
    turbineResult = runTurbineAnalysis(input);
  }

  // Step 3: Consequence
  var consequenceResult = runConsequence(input);

  // Step 4: Code authority
  var codeResult = resolveCodeAuthority({
    asset_type: input.asset_type,
    domain: domain,
    fitness_for_service: input.fitness_for_service || false
  });

  // Step 5: Collect suspected mechanisms and evidence
  var suspectedMechanisms = [];
  var allMissingEvidence = [];
  var maxSeverity = "low";
  var maxConfidence = 0;
  var severityOrder = ["low", "medium", "high", "critical"];

  // Collect from boiler damage
  if (boilerDamageResult && boilerDamageResult.result && boilerDamageResult.result.mechanisms) {
    var bm = boilerDamageResult.result.mechanisms;
    for (var bmi = 0; bmi < bm.length; bmi++) {
      if (suspectedMechanisms.indexOf(bm[bmi].mechanism) === -1) suspectedMechanisms.push(bm[bmi].mechanism);
    }
    if (severityOrder.indexOf(boilerDamageResult.severity) > severityOrder.indexOf(maxSeverity)) maxSeverity = boilerDamageResult.severity;
    if (boilerDamageResult.confidence > maxConfidence) maxConfidence = boilerDamageResult.confidence;
  }

  // Collect from creep
  if (creepResult && creepResult.severity !== "hold_for_input") {
    if (creepResult.result && creepResult.result.creep_stage && creepResult.result.creep_stage !== "NOT_APPLICABLE" && creepResult.result.creep_stage !== "NONE_OBSERVED") {
      if (suspectedMechanisms.indexOf("CREEP") === -1) suspectedMechanisms.push("CREEP");
    }
    if (creepResult.result && creepResult.result.missing_evidence) {
      var cme = creepResult.result.missing_evidence;
      for (var cmei = 0; cmei < cme.length; cmei++) {
        if (allMissingEvidence.indexOf(cme[cmei]) === -1) allMissingEvidence.push(cme[cmei]);
      }
    }
    if (severityOrder.indexOf(creepResult.severity) > severityOrder.indexOf(maxSeverity)) maxSeverity = creepResult.severity;
    if (creepResult.confidence > maxConfidence) maxConfidence = creepResult.confidence;
  }

  // Collect from fatigue
  if (fatigueResult && fatigueResult.severity !== "hold_for_input") {
    if (fatigueResult.result && fatigueResult.result.fatigue_risk_score > 30) {
      if (suspectedMechanisms.indexOf("LOW_CYCLE_FATIGUE") === -1) suspectedMechanisms.push("LOW_CYCLE_FATIGUE");
    }
    if (fatigueResult.result && fatigueResult.result.thermal_fatigue_risk !== "LOW") {
      if (suspectedMechanisms.indexOf("THERMAL_FATIGUE") === -1) suspectedMechanisms.push("THERMAL_FATIGUE");
    }
    if (severityOrder.indexOf(fatigueResult.severity) > severityOrder.indexOf(maxSeverity)) maxSeverity = fatigueResult.severity;
    if (fatigueResult.confidence > maxConfidence) maxConfidence = fatigueResult.confidence;
  }

  // Collect from FAC
  if (facResult && facResult.severity !== "hold_for_input") {
    if (facResult.result && facResult.result.fac_probability > 0.3) {
      if (suspectedMechanisms.indexOf("FLOW_ACCELERATED_CORROSION") === -1) suspectedMechanisms.push("FLOW_ACCELERATED_CORROSION");
    }
    if (severityOrder.indexOf(facResult.severity) > severityOrder.indexOf(maxSeverity)) maxSeverity = facResult.severity;
    if (facResult.confidence > maxConfidence) maxConfidence = facResult.confidence;
  }

  // Collect from turbine
  if (turbineResult && turbineResult.severity !== "hold_for_input") {
    if (turbineResult.result) {
      if (turbineResult.result.blade_risk !== "LOW") {
        if (suspectedMechanisms.indexOf("TURBINE_BLADE_FATIGUE") === -1) suspectedMechanisms.push("TURBINE_BLADE_FATIGUE");
      }
      if (turbineResult.result.rotor_risk !== "LOW") {
        if (suspectedMechanisms.indexOf("TURBINE_ROTOR_CREEP_FATIGUE") === -1) suspectedMechanisms.push("TURBINE_ROTOR_CREEP_FATIGUE");
      }
    }
    if (severityOrder.indexOf(turbineResult.severity) > severityOrder.indexOf(maxSeverity)) maxSeverity = turbineResult.severity;
    if (turbineResult.confidence > maxConfidence) maxConfidence = turbineResult.confidence;
  }

  // Step 6: Decision lock
  var lockInput = {
    suspected_mechanisms: suspectedMechanisms,
    severity: maxSeverity,
    confidence: maxConfidence,
    consequence_level: consequenceResult.result ? consequenceResult.result.consequence_level : "UNKNOWN",
    primary_authority: codeResult.result ? codeResult.result.primary_authority : "",
    creep_stage: creepResult && creepResult.result ? creepResult.result.creep_stage : "",
    missing_evidence: allMissingEvidence,
    crack_evidence: input.crack_evidence || false,
    active_leak: input.active_leak || false,
    blade_risk: turbineResult && turbineResult.result ? turbineResult.result.blade_risk : "",
    vibration_trend: input.vibration_trend || input.vibration || "",
    wall_loss_rapid: input.wall_loss_rapid || false,
    unknown_material: !input.material && !input.material_spec,
    deformation: input.deformation || input.swelling || false,
    evidence_conflict: input.evidence_conflict || false
  };
  var decisionResult = runDecisionLock(lockInput);

  // Recommended methods
  var recommendedMethods = [];
  if (routing.result && routing.result.required_evidence) {
    var re = routing.result.required_evidence;
    for (var rei = 0; rei < re.length; rei++) {
      if (recommendedMethods.indexOf(re[rei]) === -1) recommendedMethods.push(re[rei]);
    }
  }
  if (boilerDamageResult && boilerDamageResult.result && boilerDamageResult.result.next_methods) {
    var nm = boilerDamageResult.result.next_methods;
    for (var nmi = 0; nmi < nm.length; nmi++) {
      if (recommendedMethods.indexOf(nm[nmi]) === -1) recommendedMethods.push(nm[nmi]);
    }
  }

  // Next actions
  var nextActions = [];
  if (decisionResult.result && decisionResult.result.hard_locks) {
    var hl = decisionResult.result.hard_locks;
    for (var hli = 0; hli < hl.length; hli++) nextActions.push(hl[hli]);
  }
  if (allMissingEvidence.length > 0) {
    nextActions.push("Obtain missing evidence: " + allMissingEvidence.join(", "));
  }
  if (fatigueResult && fatigueResult.result && fatigueResult.result.inspection_plan) {
    var fp = fatigueResult.result.inspection_plan;
    for (var fpi = 0; fpi < fp.length; fpi++) nextActions.push(fp[fpi]);
  }
  if (turbineResult && turbineResult.result && turbineResult.result.inspection_recommendation) {
    var tr = turbineResult.result.inspection_recommendation;
    for (var tri = 0; tri < tr.length; tri++) nextActions.push(tr[tri]);
  }

  var executionMs = Date.now() - startTime;

  return buildResult(
    {
      asset_domain: domain,
      suspected_mechanisms: suspectedMechanisms,
      mechanism_count: suspectedMechanisms.length,
      decision_lock: decisionResult.result ? decisionResult.result.decision_lock : "HOLD_FOR_INPUT",
      consequence_level: consequenceResult.result ? consequenceResult.result.consequence_level : "UNKNOWN",
      primary_authority: codeResult.result ? codeResult.result.primary_authority : "UNKNOWN",
      secondary_authorities: codeResult.result ? codeResult.result.secondary_authorities : [],
      required_evidence: allMissingEvidence,
      recommended_methods: recommendedMethods,
      next_actions: nextActions,
      routing: routing.result,
      creep_assessment: creepResult,
      fatigue_assessment: fatigueResult,
      fac_assessment: facResult,
      turbine_assessment: turbineResult,
      thermal_stress_assessment: thermalStressResult,
      boiler_damage_assessment: boilerDamageResult,
      consequence_assessment: consequenceResult,
      code_authority: codeResult,
      decision_lock_detail: decisionResult,
      execution_ms: executionMs
    },
    suspectedMechanisms.length + " mechanism(s) | " +
      (decisionResult.result ? decisionResult.result.decision_lock : "UNKNOWN") +
      " | " + maxSeverity.toUpperCase(),
    maxConfidence,
    maxSeverity,
    { execution_ms: executionMs }
  );
}

// ================================================================
// NON-FATAL DB LOGGING
// ================================================================
function logDecision(sb, input, result) {
  try {
    return sb.from("pg_case_decisions").insert({
      org_id: input.org_id || null,
      case_id: input.case_id || null,
      asset_id: input.asset_id || null,
      run_id: input.run_id || null,
      asset_type: input.asset_type || null,
      asset_domain: result.result ? result.result.asset_domain : null,
      suspected_mechanisms: result.result ? result.result.suspected_mechanisms : [],
      mechanism_details: result.result ? result.result : {},
      confidence: result.confidence || 0,
      severity: result.severity || "UNKNOWN",
      consequence_level: result.result ? result.result.consequence_level : "UNKNOWN",
      primary_authority: result.result ? result.result.primary_authority : null,
      secondary_authorities: result.result ? result.result.secondary_authorities : [],
      decision_lock: result.result ? result.result.decision_lock : "HOLD_FOR_INPUT",
      required_evidence: result.result ? result.result.required_evidence : [],
      recommended_methods: result.result ? result.result.recommended_methods : [],
      next_actions: result.result ? result.result.next_actions : [],
      physics_reasoning: result.result ? {
        creep: result.result.creep_assessment,
        fatigue: result.result.fatigue_assessment,
        fac: result.result.fac_assessment,
        turbine: result.result.turbine_assessment,
        thermal_stress: result.result.thermal_stress_assessment,
        boiler_damage: result.result.boiler_damage_assessment
      } : {},
      consequence_assessment: result.result ? result.result.consequence_assessment : null,
      code_authority_resolution: result.result ? result.result.code_authority : null,
      explanation: result.result ? result.result.next_actions : [],
      execution_ms: result.result ? result.result.execution_ms : 0,
      engine_version: ENGINE_VERSION
    }).then(function() {}).catch(function() {});
  } catch (e) { /* non-fatal */ }
}

function logOperatingEvent(sb, input) {
  return sb.from("pg_operating_events").insert({
    org_id: input.org_id || null,
    asset_id: input.asset_id || null,
    case_id: input.case_id || null,
    event_type: input.event_type || "UNKNOWN",
    event_start: input.event_start || null,
    event_end: input.event_end || null,
    duration_minutes: input.duration_minutes || null,
    max_temperature: input.max_temperature || null,
    min_temperature: input.min_temperature || null,
    max_pressure: input.max_pressure || null,
    min_pressure: input.min_pressure || null,
    ramp_rate_temp: input.ramp_rate_temp || null,
    ramp_rate_pressure: input.ramp_rate_pressure || null,
    load_mw: input.load_mw || null,
    load_change_rate: input.load_change_rate || null,
    cycle_count_equivalent: input.cycle_count_equivalent || 1,
    abnormal_flag: input.abnormal_flag || false,
    operator_notes: input.operator_notes || null,
    source: input.source || "manual"
  });
}

// ================================================================
// ACTION ROUTER
// ================================================================
var ACTION_MAP = {
  "route_asset": function(input) { return routeAsset(input); },
  "run_damage_model": function(input) { return runBoilerDamageModel(input); },
  "run_creep_analysis": function(input) { return runCreepAnalysis(input); },
  "run_fatigue_analysis": function(input) { return runFatigueAnalysis(input); },
  "run_fac_analysis": function(input) { return runFACAnalysis(input); },
  "run_turbine_analysis": function(input) { return runTurbineAnalysis(input); },
  "run_thermal_stress": function(input) { return runThermalStress(input); },
  "run_consequence": function(input) { return runConsequence(input); },
  "resolve_code_authority": function(input) { return resolveCodeAuthority(input); },
  "run_decision_lock": function(input) { return runDecisionLock(input); },
  "run_full_authority": function(input) { return runFullAuthority(input); }
};

// ================================================================
// HANDLER
// ================================================================
export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "POST only" }) };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "";

    // Health check
    if (action === "health") {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          engine_number: ENGINE_NUMBER,
          engine_code: ENGINE_CODE,
          engine_version: ENGINE_VERSION,
          status: "operational",
          actions: Object.keys(ACTION_MAP).concat(["health", "get_registry", "get_operating_history", "log_operating_event"]),
          damage_mechanisms: 17,
          timestamp: new Date().toISOString()
        })
      };
    }

    // Get damage mechanism registry
    if (action === "get_registry") {
      if (supabaseUrl && supabaseKey) {
        try {
          var sb = createClient(supabaseUrl, supabaseKey);
          var regRes = await sb.from("pg_damage_mechanisms").select("*").eq("is_active", true).order("mechanism_code");
          if (regRes.data) {
            return {
              statusCode: 200,
              headers: { "Access-Control-Allow-Origin": "*" },
              body: JSON.stringify(buildResult(
                { mechanisms: regRes.data, count: regRes.data.length },
                regRes.data.length + " damage mechanisms in registry",
                1.0, "low", {}
              ))
            };
          }
        } catch (e) { /* fall through to empty */ }
      }
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(buildResult({ mechanisms: [], count: 0 },
          "Registry not available", 0, "low", {}))
      };
    }

    // Get operating history
    if (action === "get_operating_history") {
      if (!body.asset_id) {
        return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify(holdResult(["asset_id"], "get_operating_history")) };
      }
      if (supabaseUrl && supabaseKey) {
        try {
          var sb2 = createClient(supabaseUrl, supabaseKey);
          var histRes = await sb2.from("pg_operating_events").select("*")
            .eq("asset_id", body.asset_id).order("event_start", { ascending: false }).limit(200);
          var events = histRes.data || [];
          // Summarize
          var summary = { total_events: events.length, cold_starts: 0, warm_starts: 0,
            hot_starts: 0, trips: 0, forced_shutdowns: 0, abnormal_events: 0 };
          for (var ei = 0; ei < events.length; ei++) {
            var et = (events[ei].event_type || "").toUpperCase();
            if (et === "COLD_START") summary.cold_starts++;
            else if (et === "WARM_START") summary.warm_starts++;
            else if (et === "HOT_START") summary.hot_starts++;
            else if (et === "TRIP" || et === "TURBINE_TRIP" || et === "BOILER_TRIP") summary.trips++;
            else if (et === "SHUTDOWN_FORCED") summary.forced_shutdowns++;
            if (events[ei].abnormal_flag) summary.abnormal_events++;
          }
          return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify(buildResult(
              { events: events, summary: summary },
              summary.total_events + " operating events | " + summary.trips + " trips | " + summary.cold_starts + " cold starts",
              0.9, "low", {}
            ))
          };
        } catch (e) { /* fall through */ }
      }
      return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(buildResult({ events: [], summary: {} }, "No history available", 0, "low", {})) };
    }

    // Log operating event
    if (action === "log_operating_event") {
      if (!body.event_type) {
        return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify(holdResult(["event_type"], "log_operating_event")) };
      }
      if (supabaseUrl && supabaseKey) {
        try {
          var sb3 = createClient(supabaseUrl, supabaseKey);
          var insRes = await logOperatingEvent(sb3, body);
          return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify(buildResult(
              { logged: true, event_type: body.event_type },
              "Operating event logged: " + body.event_type, 1.0, "low", {}
            ))
          };
        } catch (e) {
          return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify(buildResult({ logged: false, error: String(e) },
              "Failed to log event", 0, "low", {})) };
        }
      }
    }

    // Standard action routing
    var fn = ACTION_MAP[action];
    if (!fn) {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          error: "Unknown action: " + action,
          available_actions: Object.keys(ACTION_MAP).concat(["health", "get_registry", "get_operating_history", "log_operating_event"])
        })
      };
    }

    var result = fn(body);

    // Log full authority runs to DB (non-fatal)
    if (action === "run_full_authority" && supabaseUrl && supabaseKey) {
      try {
        var sb4 = createClient(supabaseUrl, supabaseKey);
        logDecision(sb4, body, result);
      } catch (e) { /* non-fatal */ }
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(result)
    };

  } catch (err) {
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        error: String(err && err.message ? err.message : err),
        engine_number: ENGINE_NUMBER,
        engine_code: ENGINE_CODE
      })
    };
  }
};
