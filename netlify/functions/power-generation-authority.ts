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
  if (mechanisms.length > 0)
