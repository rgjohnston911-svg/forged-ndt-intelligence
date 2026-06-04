// @ts-nocheck
/**
 * DEPLOY298 - process-condition-authority.ts
 * netlify/functions/process-condition-authority.ts
 *
 * PROCESS CONDITION AUTHORITY — REFINERY & CHEMICAL PLANT
 *
 * Takes process conditions (temperature, pressure, chemistry,
 * service type) and outputs mechanism probability modifiers,
 * risk triggers, and missing data flags. This is the refinery
 * domain's input to the Klein bottle interaction mesh — process
 * conditions drive damage mechanisms, which drive inspection
 * method selection, which determines what you can know.
 *
 * 14 service condition triggers with physics-based mechanism modifiers.
 * Covers sour, chloride, amine, caustic, hydrogen, cryogenic,
 * high-temperature, cyclic, insulated, wet, erosive, naphthenic
 * acid, oxygen, and CO2 service environments.
 *
 * POST /api/process-condition-authority
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var ENGINE_ID = "process-condition-authority";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY298";
var corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };

// ============================================================
// SERVICE CONDITION TRIGGER DEFINITIONS
// ============================================================
// Each trigger maps process conditions to mechanism probability
// modifiers. The modifiers ADD to a mechanism's base probability.
// Multiple triggers can stack — sour + wet + high-temp compounds.
// ============================================================

var SERVICE_TRIGGERS = {
  sour_service: {
    name: "Sour Service (H2S)",
    detection_rules: { h2s_ppm_min: 1, keywords: ["h2s", "sour", "sulfide"] },
    mechanism_modifiers: { ssc: 0.30, hic: 0.25, sulfidation: 0.15, general_corrosion: 0.10 },
    nace_mr0175_applies: true,
    description: "H2S present — sulfide stress cracking and hydrogen damage mechanisms activated. NACE MR0175/ISO 15156 material requirements apply.",
    risk_level: "high",
    required_data: ["h2s_ppm", "material_grade", "hardness_HRC", "pwht_status"]
  },
  chloride_exposure: {
    name: "Chloride Exposure",
    detection_rules: { chloride_ppm_min: 10, keywords: ["chloride", "salt", "seawater", "brackish", "HCl"] },
    mechanism_modifiers: { chloride_scc: 0.30, pitting_corrosion: 0.25, crevice_corrosion: 0.20, under_deposit_corrosion: 0.15 },
    description: "Chloride ions present — stress corrosion cracking risk in austenitic stainless steels. Pitting and crevice corrosion activated in all alloys.",
    risk_level: "high",
    required_data: ["chloride_ppm", "material_family", "operating_temperature", "ph"]
  },
  amine_service: {
    name: "Amine Service",
    detection_rules: { keywords: ["amine", "mea", "dea", "mdea", "dga", "lean_amine", "rich_amine"] },
    mechanism_modifiers: { amine_scc: 0.30, general_corrosion: 0.10 },
    lean_vs_rich: { lean: { amine_scc: 0.35 }, rich: { amine_scc: 0.20, general_corrosion: 0.15 } },
    description: "Amine service — stress corrosion cracking of carbon steel, especially in lean amine service. Weld quality and PWHT status critical.",
    risk_level: "high",
    required_data: ["amine_type", "lean_or_rich", "pwht_status", "operating_temperature"]
  },
  caustic_service: {
    name: "Caustic Service",
    detection_rules: { keywords: ["caustic", "naoh", "koh", "sodium_hydroxide", "potassium_hydroxide"] },
    mechanism_modifiers: { caustic_scc: 0.30, caustic_gouging: 0.15 },
    temperature_threshold_F: 150,
    description: "Caustic environment — stress corrosion cracking risk increases sharply above 150F. PWHT required for carbon steel welds in caustic service per API 945.",
    risk_level: "high",
    required_data: ["caustic_concentration", "operating_temperature", "pwht_status"]
  },
  hot_hydrogen_service: {
    name: "Hot Hydrogen Service",
    detection_rules: { hydrogen_pp_min_psia: 50, temp_min_F: 400, keywords: ["hydrogen", "hydrotreater", "hydrocracker", "reformer"] },
    mechanism_modifiers: { htha: 0.35, hydrogen_embrittlement: 0.20, decarburization: 0.15 },
    api_941_applies: true,
    description: "Hot hydrogen service — High Temperature Hydrogen Attack (HTHA) risk. API 941 Nelson curve screening required. Carbon steel extremely susceptible above 400F with hydrogen partial pressure.",
    risk_level: "critical",
    required_data: ["hydrogen_partial_pressure_psia", "operating_temperature", "material_grade", "exposure_years", "clad_or_overlay"]
  },
  high_temperature: {
    name: "High Temperature Service (>750F / 400C)",
    detection_rules: { temp_min_F: 750 },
    mechanism_modifiers: { creep: 0.25, oxidation: 0.20, sulfidation: 0.20, stress_rupture: 0.15, carburization: 0.10, metal_dusting: 0.10 },
    description: "Elevated temperature service — time-dependent creep damage, high-temperature oxidation, and sulfidation activated. Remaining life assessment may be required.",
    risk_level: "high",
    required_data: ["operating_temperature", "design_temperature", "material_grade", "hours_at_temperature"]
  },
  cyclic_service: {
    name: "Cyclic / Thermal Cycling Service",
    detection_rules: { keywords: ["cyclic", "thermal_cycle", "startup_shutdown", "intermittent", "batch"] },
    mechanism_modifiers: { fatigue: 0.25, thermal_fatigue: 0.25, vibration_fatigue: 0.10 },
    description: "Cyclic loading or thermal cycling — fatigue cracking mechanisms activated. Weld toes and stress concentrations are primary targets.",
    risk_level: "medium",
    required_data: ["cycle_count_estimate", "temperature_range", "stress_concentration_locations"]
  },
  insulated_external: {
    name: "Insulated External Surface (CUI Risk)",
    detection_rules: { keywords: ["insulated", "insulation", "cui", "jacketing", "mineral_wool", "calcium_silicate"] },
    mechanism_modifiers: { cui: 0.35, external_corrosion: 0.15, coating_breakdown: 0.10 },
    cui_temperature_range_F: { min: 25, max: 350 },
    description: "Insulated equipment — Corrosion Under Insulation (CUI) is the dominant hidden threat. Carbon steel between 25F-350F with damaged jacketing or vapor barriers is highest risk.",
    risk_level: "high",
    required_data: ["insulation_type", "insulation_condition", "jacketing_condition", "operating_temperature", "coating_under_insulation"]
  },
  wet_service: {
    name: "Wet Service (Aqueous Phase Present)",
    detection_rules: { keywords: ["wet", "aqueous", "water", "condensate", "dew_point"] },
    mechanism_modifiers: { general_corrosion: 0.15, under_deposit_corrosion: 0.15, mic: 0.10, pitting_corrosion: 0.10 },
    description: "Aqueous phase present — electrochemical corrosion mechanisms activated. Stagnant areas and dead legs highest risk.",
    risk_level: "medium",
    required_data: ["water_source", "ph", "flow_regime", "dead_legs_present"]
  },
  erosive_flow: {
    name: "Erosive / High-Velocity Flow",
    detection_rules: { flow_velocity_fps_min: 20, keywords: ["erosion", "slurry", "catalyst", "abrasive", "sand", "high_velocity"] },
    mechanism_modifiers: { erosion: 0.30, erosion_corrosion: 0.25, cavitation: 0.15 },
    description: "High velocity or particle-laden flow — erosion and erosion-corrosion at elbows, reducers, tees, and downstream of control valves.",
    risk_level: "high",
    required_data: ["flow_velocity", "particle_content", "pipe_geometry", "material_hardness"]
  },
  naphthenic_acid: {
    name: "Naphthenic Acid Service",
    detection_rules: { keywords: ["naphthenic", "tan", "total_acid_number", "crude", "vacuum_distillation"] },
    mechanism_modifiers: { naphthenic_acid_corrosion: 0.30, sulfidation: 0.15 },
    tan_threshold: 0.5,
    temp_range_F: { min: 430, max: 750 },
    description: "Naphthenic acid corrosion — aggressive thinning in crude and vacuum distillation units above TAN 0.5 and 430-750F. Carbon steel and low-alloy highly susceptible.",
    risk_level: "high",
    required_data: ["total_acid_number", "operating_temperature", "sulfur_content", "material_grade"]
  },
  co2_corrosion: {
    name: "CO2 / Sweet Corrosion",
    detection_rules: { co2_ppm_min: 100, keywords: ["co2", "sweet_corrosion", "carbon_dioxide"] },
    mechanism_modifiers: { co2_corrosion: 0.25, mesa_attack: 0.15, general_corrosion: 0.10 },
    description: "CO2 dissolved in aqueous phase — sweet corrosion with characteristic mesa attack pattern. Flow regime and pH strongly influence rate.",
    risk_level: "medium",
    required_data: ["co2_partial_pressure", "ph", "flow_velocity", "water_cut"]
  },
  oxygen_ingress: {
    name: "Oxygen Ingress / Aeration",
    detection_rules: { oxygen_ppb_min: 20, keywords: ["oxygen", "aerated", "air_ingress"] },
    mechanism_modifiers: { oxygen_corrosion: 0.25, pitting_corrosion: 0.20 },
    description: "Oxygen present in system designed for deaerated service — accelerated corrosion, especially at elevated temperatures. Boiler feedwater and condensate systems most affected.",
    risk_level: "medium",
    required_data: ["oxygen_ppb", "operating_temperature", "system_type"]
  },
  cryogenic_service: {
    name: "Cryogenic Service",
    detection_rules: { temp_max_F: -50, keywords: ["cryogenic", "lng", "ethylene", "nitrogen", "liquid_oxygen"] },
    mechanism_modifiers: { embrittlement: 0.30, thermal_fatigue: 0.20, freeze_thaw_damage: 0.15 },
    description: "Cryogenic service — brittle fracture risk in materials not qualified for low-temperature service. Carbon steel prohibited below -20F without impact testing.",
    risk_level: "critical",
    required_data: ["minimum_design_temperature", "material_grade", "impact_test_temperature", "charpy_values"]
  }
};

// ============================================================
// CORE FUNCTIONS
// ============================================================

function detectTriggers(input) {
  var triggers = [];
  var allModifiers = {};
  var missingData = [];
  var riskFlags = [];
  var narrative = (input.narrative || "").toLowerCase() + " " + (input.process_fluid || "").toLowerCase() + " " + (input.service_type || "").toLowerCase() + " " + (input.environment || "").toLowerCase();
  var temp_F = input.operating_temperature_F !== undefined ? input.operating_temperature_F : null;
  var keys = Object.keys(SERVICE_TRIGGERS);

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var trigger = SERVICE_TRIGGERS[key];
    var rules = trigger.detection_rules;
    var activated = false;

    // Keyword detection
    if (rules.keywords) {
      for (var k = 0; k < rules.keywords.length; k++) {
        if (narrative.indexOf(rules.keywords[k]) >= 0) { activated = true; break; }
      }
    }

    // Numeric threshold detection
    if (rules.h2s_ppm_min && input.h2s_ppm >= rules.h2s_ppm_min) activated = true;
    if (rules.chloride_ppm_min && input.chloride_ppm >= rules.chloride_ppm_min) activated = true;
    if (rules.hydrogen_pp_min_psia && input.hydrogen_partial_pressure_psia >= rules.hydrogen_pp_min_psia && temp_F !== null && temp_F >= (rules.temp_min_F || 0)) activated = true;
    if (rules.temp_min_F && !rules.hydrogen_pp_min_psia && temp_F !== null && temp_F >= rules.temp_min_F) activated = true;
    if (rules.temp_max_F && temp_F !== null && temp_F <= rules.temp_max_F) activated = true;
    if (rules.co2_ppm_min && input.co2_ppm >= rules.co2_ppm_min) activated = true;
    if (rules.oxygen_ppb_min && input.oxygen_ppb >= rules.oxygen_ppb_min) activated = true;
    if (rules.flow_velocity_fps_min && input.flow_velocity_fps >= rules.flow_velocity_fps_min) activated = true;

    // Boolean flags
    if (key === "sour_service" && input.sour_service === true) activated = true;
    if (key === "wet_service" && input.wet_service === true) activated = true;
    if (key === "amine_service" && input.amine_service === true) activated = true;
    if (key === "caustic_service" && input.caustic_service === true) activated = true;
    if (key === "cyclic_service" && input.cyclic_service === true) activated = true;
    if (key === "cryogenic_service" && input.cryogenic_service === true) activated = true;

    if (activated) {
      triggers.push({ key: key, name: trigger.name, risk_level: trigger.risk_level, description: trigger.description });

      // Merge mechanism modifiers (stacking)
      var mods = trigger.mechanism_modifiers;
      var modKeys = Object.keys(mods);
      for (var m = 0; m < modKeys.length; m++) {
        var mechKey = modKeys[m];
        if (!allModifiers[mechKey]) allModifiers[mechKey] = 0;
        allModifiers[mechKey] = allModifiers[mechKey] + mods[mechKey];
      }

      // Collect missing data
      if (trigger.required_data) {
        for (var d = 0; d < trigger.required_data.length; d++) {
          var field = trigger.required_data[d];
          if (input[field] === undefined || input[field] === null || input[field] === "") {
            if (missingData.indexOf(field) < 0) missingData.push(field);
          }
        }
      }

      // Risk flags
      if (trigger.risk_level === "critical") riskFlags.push("CRITICAL: " + trigger.name + " — " + trigger.description);
      if (trigger.nace_mr0175_applies) riskFlags.push("NACE MR0175/ISO 15156 material compliance required for sour service.");
      if (trigger.api_941_applies) riskFlags.push("API 941 Nelson curve screening required for HTHA assessment.");
    }
  }

  // Cap modifiers at 0.95
  var cappedModifiers = {};
  var capKeys = Object.keys(allModifiers);
  for (var c = 0; c < capKeys.length; c++) {
    cappedModifiers[capKeys[c]] = Math.min(0.95, Math.round(allModifiers[capKeys[c]] * 100) / 100);
  }

  // Combined severity
  var combinedSeverity = "low";
  if (riskFlags.length > 0) combinedSeverity = "critical";
  else if (triggers.length >= 3) combinedSeverity = "high";
  else if (triggers.length >= 2) combinedSeverity = "medium";
  else if (triggers.length === 1) combinedSeverity = triggers[0].risk_level;

  // Confidence
  var confidence = 0.90;
  confidence = confidence - (missingData.length * 0.05);
  if (confidence < 0.30) confidence = 0.30;
  confidence = Math.round(confidence * 100) / 100;

  return {
    triggers: triggers,
    mechanism_modifiers: cappedModifiers,
    missing_data: missingData,
    risk_flags: riskFlags,
    combined_severity: combinedSeverity,
    confidence: confidence,
    trigger_count: triggers.length,
    modifier_count: capKeys.length,
    assumptions_for_mesh: {
      active_mechanisms: capKeys,
      material_condition: missingData.indexOf("material_grade") >= 0 ? "unknown_material" : "known",
      environment_severity: combinedSeverity,
      inspection_coverage: confidence >= 0.70 ? "adequate_data" : "data_gaps_present"
    },
    klein_bottle_note: "Process conditions are the ROOT INPUT to the Klein bottle mesh. Every downstream assessment — mechanisms, NDT selection, code authority, remaining life — depends on knowing the process environment. Missing process data propagates uncertainty through every engine."
  };
}

// ============================================================
// HANDLER
// ============================================================

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };
  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";
    if (action === "get_registry") { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, deploy: DEPLOY, mode: "deterministic", purpose: "Process Condition Authority — refinery/chemical service condition detection with mechanism probability modifiers for Klein bottle mesh", service_triggers: Object.keys(SERVICE_TRIGGERS).length, actions: ["evaluate_conditions", "get_trigger_database", "get_registry"] }) }; }
    if (action === "evaluate_conditions") {
      var result = detectTriggers(body);
      try { var sb = createClient(supabaseUrl, supabaseKey); await sb.from("process_condition_assessments").insert({ org_id: body.org_id || null, case_id: body.case_id || null, asset_id: body.asset_id || null, service_triggers: result.triggers, mechanism_modifiers: result.mechanism_modifiers, risk_flags: result.risk_flags, missing_data: result.missing_data, combined_severity: result.combined_severity, confidence: result.confidence, result_json: result }); } catch (e) {}
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: result }, null, 2) };
    }
    if (action === "get_trigger_database") { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, triggers: SERVICE_TRIGGERS }, null, 2) }; }
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
  } catch (err) { return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) }; }
};
