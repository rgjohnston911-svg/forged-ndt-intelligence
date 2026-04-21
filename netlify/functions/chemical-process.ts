// @ts-nocheck
/**
 * DEPLOY237 - chemical-process.ts
 * netlify/functions/chemical-process.ts
 *
 * CHEMICAL / PROCESS INDUSTRY VERTICAL
 *
 * Implements API 571 damage mechanism identification, process condition
 * coupling, and advanced degradation modeling for refinery, petrochemical,
 * and chemical plant equipment.
 *
 * POST /api/chemical-process { action: "identify_mechanisms", case_id }
 *   -> Identifies applicable damage mechanisms from case data per API 571
 *
 * POST /api/chemical-process { action: "evaluate_environment", case_id }
 *   -> Evaluates process environment and maps to damage susceptibility
 *
 * POST /api/chemical-process { action: "get_mechanism_detail", mechanism_id }
 *   -> Returns full detail for a specific damage mechanism
 *
 * POST /api/chemical-process { action: "get_mechanism_registry" }
 *   -> Returns all known damage mechanisms with categories
 *
 * POST /api/chemical-process { action: "assess_case", case_id }
 *   -> Full assessment: mechanisms + environment + recommendations
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var ENGINE_VERSION = "chemical-process/1.0.0";
var EXECUTION_MODE = "deterministic";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

// ================================================================
// API 571 DAMAGE MECHANISM REGISTRY
// Organized by category per API 571-1 (2020 edition)
// ================================================================
var MECHANISM_REGISTRY = {
  // --- GENERAL / UNIFORM CORROSION ---
  "571-4.2.1": {
    id: "571-4.2.1", name: "Atmospheric Corrosion",
    category: "general_corrosion", api571_section: "4.2.1",
    description: "Corrosion from exposure to atmospheric moisture, oxygen, and contaminants. Accelerated by chlorides, SO2, and marine environments.",
    materials_affected: ["carbon_steel", "low_alloy_steel"],
    environments: ["outdoor", "marine", "industrial_atmosphere", "coastal"],
    inspection_methods: ["VT", "UT"],
    severity_range: "low_to_moderate",
    keywords: ["atmospheric", "outdoor", "weather", "ambient"]
  },
  "571-4.2.2": {
    id: "571-4.2.2", name: "Corrosion Under Insulation (CUI)",
    category: "general_corrosion", api571_section: "4.2.2",
    description: "Corrosion of piping and vessels beneath insulation. Moisture trapped under insulation causes accelerated corrosion. Particularly dangerous because hidden from visual inspection.",
    materials_affected: ["carbon_steel", "low_alloy_steel", "stainless_300_series"],
    environments: ["insulated", "temperature_cycling", "steam_traced", "wet_climate"],
    temperature_range: { min_f: 25, max_f: 350, critical_range: "200-350F for CS, 140-400F for SS" },
    inspection_methods: ["UT", "RT", "pulsed_eddy_current", "insulation_removal"],
    severity_range: "moderate_to_critical",
    keywords: ["insulation", "cui", "hidden", "moisture", "jacketing"]
  },
  "571-4.2.3": {
    id: "571-4.2.3", name: "Galvanic Corrosion",
    category: "general_corrosion", api571_section: "4.2.3",
    description: "Accelerated corrosion when dissimilar metals are in electrical contact in a conductive electrolyte.",
    materials_affected: ["carbon_steel", "aluminum", "copper", "zinc"],
    environments: ["dissimilar_metals", "electrolyte_present", "seawater"],
    inspection_methods: ["VT", "UT"],
    severity_range: "low_to_moderate",
    keywords: ["galvanic", "dissimilar", "bimetallic", "couple"]
  },
  "571-4.2.7": {
    id: "571-4.2.7", name: "Boiler Water / Condensate Corrosion",
    category: "general_corrosion", api571_section: "4.2.7",
    description: "Corrosion in boiler systems from dissolved oxygen, low pH, and carbonic acid in condensate.",
    materials_affected: ["carbon_steel", "copper_alloys"],
    environments: ["boiler_water", "condensate", "steam_system"],
    inspection_methods: ["UT", "VT", "water_analysis"],
    severity_range: "moderate",
    keywords: ["boiler", "condensate", "steam", "feedwater", "dissolved_oxygen"]
  },
  "571-4.2.8": {
    id: "571-4.2.8", name: "CO2 Corrosion",
    category: "general_corrosion", api571_section: "4.2.8",
    description: "Corrosion from dissolved CO2 forming carbonic acid. Common in oil/gas production, wet gas systems.",
    materials_affected: ["carbon_steel"],
    environments: ["co2_present", "wet_gas", "production_systems"],
    inspection_methods: ["UT", "RT"],
    severity_range: "moderate_to_high",
    keywords: ["co2", "carbon_dioxide", "sweet_corrosion", "carbonic"]
  },

  // --- LOCALIZED CORROSION ---
  "571-4.3.3": {
    id: "571-4.3.3", name: "Pitting Corrosion",
    category: "localized_corrosion", api571_section: "4.3.3",
    description: "Highly localized corrosion forming small cavities or pits. Dangerous because it penetrates wall thickness locally while general surface appears sound.",
    materials_affected: ["carbon_steel", "stainless_steel", "aluminum", "copper"],
    environments: ["chloride", "stagnant", "acidic", "under_deposit"],
    inspection_methods: ["UT", "RT", "PAUT", "pit_gauge"],
    severity_range: "moderate_to_critical",
    keywords: ["pitting", "pit", "localized", "chloride", "stagnant"]
  },
  "571-4.3.5": {
    id: "571-4.3.5", name: "Microbiologically Influenced Corrosion (MIC)",
    category: "localized_corrosion", api571_section: "4.3.5",
    description: "Corrosion accelerated by microbial activity. Sulfate-reducing bacteria (SRB), acid-producing bacteria (APB), and iron-oxidizing bacteria create aggressive local environments.",
    materials_affected: ["carbon_steel", "stainless_steel", "copper_alloys"],
    environments: ["stagnant_water", "low_flow", "hydrotest_water", "cooling_water", "soil"],
    inspection_methods: ["UT", "RT", "biological_testing", "pit_gauge"],
    severity_range: "moderate_to_critical",
    keywords: ["mic", "microbial", "bacteria", "srb", "biological", "biofilm"]
  },
  "571-4.3.8": {
    id: "571-4.3.8", name: "Naphthenic Acid Corrosion (NAC)",
    category: "localized_corrosion", api571_section: "4.3.8",
    description: "High-temperature corrosion by naphthenic acids in crude oil. TAN (Total Acid Number) above 0.5 with temperatures 430-750F creates high risk.",
    materials_affected: ["carbon_steel", "low_alloy_steel", "stainless_316"],
    environments: ["crude_processing", "high_tan", "vacuum_distillation", "high_temperature"],
    temperature_range: { min_f: 430, max_f: 750 },
    inspection_methods: ["UT", "RT", "PAUT", "ER_probes"],
    severity_range: "high_to_critical",
    keywords: ["naphthenic", "nac", "tan", "acid", "crude", "vacuum"]
  },

  // --- HIGH TEMPERATURE ---
  "571-4.4.2": {
    id: "571-4.4.2", name: "High Temperature Hydrogen Attack (HTHA)",
    category: "high_temperature", api571_section: "4.4.2",
    description: "Hydrogen diffuses into steel at high temperature and pressure, reacts with carbon to form methane. Methane cannot diffuse out, creates internal voids and fissures. Catastrophic failure risk with no external wall loss.",
    materials_affected: ["carbon_steel", "c_half_mo", "low_alloy_steel"],
    environments: ["hydrogen_service", "high_temperature", "high_pressure", "hydroprocessing", "reformer"],
    temperature_range: { min_f: 400, max_f: 1200, note: "Use Nelson curves for specific limits" },
    inspection_methods: ["AUBT", "TOFD", "PAUT", "backscatter_UT", "in_situ_metallography"],
    severity_range: "critical",
    keywords: ["htha", "hydrogen_attack", "nelson", "methane", "fissuring", "hydroprocessing"]
  },
  "571-4.4.3": {
    id: "571-4.4.3", name: "Creep / Stress Rupture",
    category: "high_temperature", api571_section: "4.4.3",
    description: "Slow deformation under sustained stress at high temperature. Eventually leads to stress rupture (failure). Particularly relevant for heater tubes, headers, and high-temperature piping.",
    materials_affected: ["carbon_steel", "low_alloy_steel", "stainless_steel", "high_temp_alloys"],
    environments: ["high_temperature", "sustained_stress", "heater_tubes", "boiler"],
    temperature_range: { min_f: 700, note: "CS above 700F, SS above 1000F" },
    inspection_methods: ["VT", "dimensional", "replication", "hardness", "UT"],
    severity_range: "high_to_critical",
    keywords: ["creep", "stress_rupture", "high_temp", "heater", "tube", "deformation"]
  },
  "571-4.4.5": {
    id: "571-4.4.5", name: "Thermal Fatigue",
    category: "high_temperature", api571_section: "4.4.5",
    description: "Cracking from cyclic thermal stresses. Caused by temperature cycling, thermal shock, or differential expansion.",
    materials_affected: ["carbon_steel", "stainless_steel", "alloy_steel"],
    environments: ["temperature_cycling", "thermal_shock", "mix_points", "quench"],
    inspection_methods: ["PT", "MT", "PAUT", "TOFD"],
    severity_range: "moderate_to_high",
    keywords: ["thermal_fatigue", "cycling", "thermal_shock", "differential", "expansion"]
  },
  "571-4.4.8": {
    id: "571-4.4.8", name: "Sulfidation / Sulfidic Corrosion",
    category: "high_temperature", api571_section: "4.4.8",
    description: "Corrosion by sulfur compounds at elevated temperatures. Common in crude and vacuum distillation units. Uses modified McConomy curves for prediction.",
    materials_affected: ["carbon_steel", "low_alloy_steel"],
    environments: ["sulfur_compounds", "high_temperature", "crude_unit", "vacuum_unit"],
    temperature_range: { min_f: 450, max_f: 800 },
    inspection_methods: ["UT", "RT", "PAUT"],
    severity_range: "moderate_to_high",
    keywords: ["sulfidation", "sulfidic", "sulfur", "mcconomy", "h2s_high_temp"]
  },

  // --- ENVIRONMENT-ASSISTED CRACKING ---
  "571-4.5.1": {
    id: "571-4.5.1", name: "Chloride Stress Corrosion Cracking (Cl-SCC)",
    category: "environmental_cracking", api571_section: "4.5.1",
    description: "Cracking of austenitic stainless steels under tensile stress in chloride-containing environments. Particularly insidious because it can occur at low chloride concentrations.",
    materials_affected: ["stainless_300_series", "austenitic_stainless"],
    environments: ["chloride", "tensile_stress", "temperature_above_140f", "evaporation"],
    temperature_range: { min_f: 140, note: "Risk increases sharply above 150F" },
    inspection_methods: ["PT", "ET", "PAUT", "TOFD"],
    severity_range: "high_to_critical",
    keywords: ["chloride_scc", "cl_scc", "stress_corrosion", "austenitic", "304", "316"]
  },
  "571-4.5.2": {
    id: "571-4.5.2", name: "Caustic Stress Corrosion Cracking (Caustic Embrittlement)",
    category: "environmental_cracking", api571_section: "4.5.2",
    description: "Cracking in carbon steel and low alloy steels exposed to caustic (NaOH/KOH) solutions under stress. Particularly dangerous in concentration zones.",
    materials_affected: ["carbon_steel", "low_alloy_steel"],
    environments: ["caustic", "naoh", "koh", "concentration", "evaporation"],
    temperature_range: { min_f: 120, note: "Risk above 120F at >5% NaOH" },
    inspection_methods: ["WFMT", "PT", "PAUT", "TOFD"],
    severity_range: "high_to_critical",
    keywords: ["caustic", "embrittlement", "naoh", "koh", "alkaline", "caustic_scc"]
  },
  "571-4.5.3": {
    id: "571-4.5.3", name: "Hydrogen Embrittlement (HE)",
    category: "environmental_cracking", api571_section: "4.5.3",
    description: "Loss of ductility and cracking caused by atomic hydrogen absorption into steel. Particularly affects high-strength steels and weld heat-affected zones.",
    materials_affected: ["high_strength_steel", "carbon_steel_hard_welds", "martensitic_stainless"],
    environments: ["hydrogen", "cathodic_protection", "acid_service", "plating", "welding"],
    inspection_methods: ["MT", "PT", "UT", "TOFD", "hardness"],
    severity_range: "high_to_critical",
    keywords: ["hydrogen_embrittlement", "he", "hydrogen", "ductility", "hardness", "haz"]
  },
  "571-4.5.4": {
    id: "571-4.5.4", name: "Wet H2S Cracking (SOHIC / HIC / SSC)",
    category: "environmental_cracking", api571_section: "4.5.4",
    description: "Family of damage mechanisms in wet H2S environments: Hydrogen Induced Cracking (HIC), Stress Oriented Hydrogen Induced Cracking (SOHIC), and Sulfide Stress Cracking (SSC). Common in sour service equipment.",
    materials_affected: ["carbon_steel", "low_alloy_steel", "high_strength_steel"],
    environments: ["wet_h2s", "sour_service", "amine", "sour_water"],
    inspection_methods: ["WFMT", "PAUT", "TOFD", "AUBT", "AE"],
    severity_range: "critical",
    keywords: ["h2s", "sour", "hic", "sohic", "ssc", "hydrogen", "sulfide", "amine"]
  },
  "571-4.5.6": {
    id: "571-4.5.6", name: "Amine Cracking",
    category: "environmental_cracking", api571_section: "4.5.6",
    description: "Stress corrosion cracking in carbon steel equipment handling amine solutions (MEA, DEA, MDEA). Particularly affects welds that are not PWHT'd.",
    materials_affected: ["carbon_steel"],
    environments: ["amine", "mea", "dea", "mdea", "lean_amine", "rich_amine"],
    inspection_methods: ["WFMT", "PAUT", "TOFD", "PT"],
    severity_range: "high",
    keywords: ["amine", "mea", "dea", "mdea", "cracking", "pwht"]
  },
  "571-4.5.8": {
    id: "571-4.5.8", name: "Carbonate SCC",
    category: "environmental_cracking", api571_section: "4.5.8",
    description: "Cracking in carbon steel exposed to carbonate/bicarbonate solutions. Common in FCC wet gas systems and amine units.",
    materials_affected: ["carbon_steel"],
    environments: ["carbonate", "bicarbonate", "fcc_wet_gas", "alkaline_sour"],
    inspection_methods: ["WFMT", "PAUT", "AE"],
    severity_range: "moderate_to_high",
    keywords: ["carbonate", "bicarbonate", "fcc", "alkaline"]
  },

  // --- MECHANICAL / FATIGUE ---
  "571-4.6.1": {
    id: "571-4.6.1", name: "Vibration Fatigue",
    category: "mechanical_fatigue", api571_section: "4.6.1",
    description: "Cracking from cyclic mechanical vibration. Common at small-bore connections, socket welds, and instrument connections on reciprocating equipment.",
    materials_affected: ["all_metals"],
    environments: ["vibration", "reciprocating_equipment", "piping", "small_bore"],
    inspection_methods: ["VT", "PT", "MT", "vibration_monitoring"],
    severity_range: "moderate_to_high",
    keywords: ["vibration", "fatigue", "small_bore", "socket_weld", "reciprocating"]
  },
  "571-4.6.4": {
    id: "571-4.6.4", name: "Erosion / Erosion-Corrosion",
    category: "mechanical_fatigue", api571_section: "4.6.4",
    description: "Metal loss from high-velocity fluid, two-phase flow, or entrained particles. Accelerated when corrosion and erosion act together.",
    materials_affected: ["carbon_steel", "copper_alloys", "low_alloy_steel"],
    environments: ["high_velocity", "two_phase", "particulate", "slurry", "elbows", "tees"],
    inspection_methods: ["UT", "RT", "PAUT", "VT"],
    severity_range: "moderate_to_high",
    keywords: ["erosion", "velocity", "two_phase", "elbow", "tee", "impingement"]
  }
};

// ================================================================
// PROCESS ENVIRONMENT PROFILES
// ================================================================
var ENVIRONMENT_PROFILES = {
  crude_distillation: {
    name: "Crude Distillation Unit",
    typical_mechanisms: ["571-4.2.2", "571-4.3.8", "571-4.4.8", "571-4.3.3", "571-4.6.4"],
    typical_materials: ["carbon_steel", "stainless_316", "monel"],
    temperature_range: "ambient to 750F",
    key_concerns: ["Naphthenic acid corrosion at high TAN", "Sulfidation above 450F", "CUI on cold/warm piping"]
  },
  hydroprocessing: {
    name: "Hydroprocessing Unit (HDS/HCU)",
    typical_mechanisms: ["571-4.4.2", "571-4.5.4", "571-4.4.3", "571-4.5.3"],
    typical_materials: ["low_alloy_steel", "stainless_321", "stainless_347"],
    temperature_range: "500-900F at high H2 pressure",
    key_concerns: ["HTHA is the primary threat", "Nelson curve compliance", "Wet H2S in cold sections"]
  },
  fcc_unit: {
    name: "Fluid Catalytic Cracking Unit",
    typical_mechanisms: ["571-4.5.8", "571-4.5.4", "571-4.3.3", "571-4.6.4", "571-4.4.5"],
    typical_materials: ["carbon_steel", "stainless_304", "stainless_410"],
    temperature_range: "ambient to 1400F",
    key_concerns: ["Carbonate SCC in wet gas system", "Erosion from catalyst", "High-temp sulfidation in regen"]
  },
  amine_treating: {
    name: "Amine Treating Unit",
    typical_mechanisms: ["571-4.5.6", "571-4.5.4", "571-4.2.8"],
    typical_materials: ["carbon_steel"],
    temperature_range: "ambient to 250F",
    key_concerns: ["Amine cracking in non-PWHT welds", "Wet H2S in rich amine", "CO2 corrosion"]
  },
  sour_water: {
    name: "Sour Water System",
    typical_mechanisms: ["571-4.5.4", "571-4.3.5", "571-4.6.4"],
    typical_materials: ["carbon_steel"],
    temperature_range: "ambient to 200F",
    key_concerns: ["Wet H2S damage (HIC/SOHIC/SSC)", "MIC in stagnant areas", "Erosion at high velocity"]
  },
  cooling_water: {
    name: "Cooling Water System",
    typical_mechanisms: ["571-4.3.5", "571-4.3.3", "571-4.2.3", "571-4.6.4"],
    typical_materials: ["carbon_steel", "copper_alloys", "stainless_steel"],
    temperature_range: "ambient to 200F",
    key_concerns: ["MIC under deposits", "Pitting under stagnant conditions", "Galvanic at dissimilar joints"]
  },
  boiler_steam: {
    name: "Boiler / Steam System",
    typical_mechanisms: ["571-4.2.7", "571-4.4.3", "571-4.5.2", "571-4.4.5"],
    typical_materials: ["carbon_steel", "low_alloy_steel"],
    temperature_range: "200-1100F",
    key_concerns: ["Caustic cracking at concentration points", "Creep in high-temp headers", "Thermal fatigue at desuperheaters"]
  },
  sulfuric_acid: {
    name: "Sulfuric Acid Service",
    typical_mechanisms: ["571-4.3.3", "571-4.6.4", "571-4.5.1"],
    typical_materials: ["carbon_steel", "stainless_316", "alloy_20", "hastelloy"],
    temperature_range: "ambient to 400F",
    key_concerns: ["Velocity-dependent corrosion rate", "Concentration changes affect material selection", "SCC of SS in dilute acid"]
  }
};

// ================================================================
// MATCHING LOGIC
// ================================================================
function lower(s) { return (s || "").toString().toLowerCase(); }

function matchMechanisms(caseData) {
  var matches = [];
  var text = lower(caseData.damage_type) + " " + lower(caseData.material) + " " + lower(caseData.notes) + " " + lower(caseData.component_name) + " " + lower(caseData.asset_type) + " " + lower(caseData.state);

  var mechKeys = Object.keys(MECHANISM_REGISTRY);
  for (var i = 0; i < mechKeys.length; i++) {
    var mech = MECHANISM_REGISTRY[mechKeys[i]];
    var score = 0;
    var reasons = [];

    // Check keywords
    for (var k = 0; k < mech.keywords.length; k++) {
      if (text.indexOf(mech.keywords[k]) >= 0) {
        score += 20;
        reasons.push("keyword match: " + mech.keywords[k]);
      }
    }

    // Check material
    var matText = lower(caseData.material) + " " + lower(caseData.material_family);
    for (var m = 0; m < mech.materials_affected.length; m++) {
      if (matText.indexOf(lower(mech.materials_affected[m])) >= 0) {
        score += 15;
        reasons.push("material match: " + mech.materials_affected[m]);
      }
    }

    // Check environment keywords in notes/description
    for (var e = 0; e < mech.environments.length; e++) {
      if (text.indexOf(lower(mech.environments[e])) >= 0) {
        score += 10;
        reasons.push("environment match: " + mech.environments[e]);
      }
    }

    // Check damage_type against category
    if (lower(caseData.damage_type).indexOf(lower(mech.category.replace(/_/g, " "))) >= 0) {
      score += 25;
      reasons.push("category match: " + mech.category);
    }

    if (score > 0) {
      matches.push({
        mechanism_id: mech.id,
        name: mech.name,
        api571_section: mech.api571_section,
        category: mech.category,
        match_score: score,
        match_reasons: reasons,
        severity_range: mech.severity_range,
        recommended_inspection: mech.inspection_methods,
        description: mech.description
      });
    }
  }

  // Sort by match score descending
  matches.sort(function(a, b) { return b.match_score - a.match_score; });
  return matches;
}

function matchEnvironment(caseData) {
  var text = lower(caseData.notes) + " " + lower(caseData.component_name) + " " + lower(caseData.asset_type) + " " + lower(caseData.damage_type) + " " + lower(caseData.material);
  var matches = [];

  var envKeys = Object.keys(ENVIRONMENT_PROFILES);
  for (var i = 0; i < envKeys.length; i++) {
    var env = ENVIRONMENT_PROFILES[envKeys[i]];
    var score = 0;
    var nameWords = lower(env.name).split(/\s+/);
    for (var w = 0; w < nameWords.length; w++) {
      if (nameWords[w].length > 3 && text.indexOf(nameWords[w]) >= 0) {
        score += 15;
      }
    }

    // Check if any typical mechanisms match the damage type
    for (var m = 0; m < env.typical_mechanisms.length; m++) {
      var mech = MECHANISM_REGISTRY[env.typical_mechanisms[m]];
      if (mech) {
        for (var k = 0; k < mech.keywords.length; k++) {
          if (text.indexOf(mech.keywords[k]) >= 0) {
            score += 5;
          }
        }
      }
    }

    if (score > 0) {
      matches.push({
        environment: envKeys[i],
        name: env.name,
        match_score: score,
        typical_mechanisms: env.typical_mechanisms,
        key_concerns: env.key_concerns,
        temperature_range: env.temperature_range,
        typical_materials: env.typical_materials
      });
    }
  }

  matches.sort(function(a, b) { return b.match_score - a.match_score; });
  return matches;
}

// ================================================================
// HANDLER
// ================================================================
export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action;
    var sb = createClient(supabaseUrl, supabaseKey);
    var startTime = Date.now();

    // ── ACTION: get_mechanism_registry ──
    if (action === "get_mechanism_registry") {
      var registry = [];
      var categories = {};
      var mechKeys = Object.keys(MECHANISM_REGISTRY);
      for (var i = 0; i < mechKeys.length; i++) {
        var m = MECHANISM_REGISTRY[mechKeys[i]];
        registry.push({
          id: m.id, name: m.name, category: m.category,
          api571_section: m.api571_section, severity_range: m.severity_range,
          materials_affected: m.materials_affected, inspection_methods: m.inspection_methods
        });
        categories[m.category] = (categories[m.category] || 0) + 1;
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          total_mechanisms: registry.length,
          categories: categories,
          environment_profiles: Object.keys(ENVIRONMENT_PROFILES).length,
          mechanisms: registry,
          environments: Object.keys(ENVIRONMENT_PROFILES),
          engine_version: ENGINE_VERSION,
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: get_mechanism_detail ──
    if (action === "get_mechanism_detail") {
      if (!body.mechanism_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "mechanism_id required" }) };
      var mech = MECHANISM_REGISTRY[body.mechanism_id];
      if (!mech) return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "Mechanism not found: " + body.mechanism_id }) };

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          mechanism: mech,
          engine_version: ENGINE_VERSION,
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: identify_mechanisms ──
    if (action === "identify_mechanisms") {
      if (!body.case_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };

      var caseResult = await sb.from("inspection_cases").select("*").eq("id", body.case_id).single();
      if (caseResult.error || !caseResult.data) return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "Case not found" }) };

      var mechanisms = matchMechanisms(caseResult.data);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          case_id: body.case_id,
          identified_mechanisms: mechanisms,
          total_matches: mechanisms.length,
          primary_mechanism: mechanisms.length > 0 ? mechanisms[0] : null,
          engine_version: ENGINE_VERSION,
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: evaluate_environment ──
    if (action === "evaluate_environment") {
      if (!body.case_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };

      var envCase = await sb.from("inspection_cases").select("*").eq("id", body.case_id).single();
      if (envCase.error || !envCase.data) return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "Case not found" }) };

      var environments = matchEnvironment(envCase.data);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          case_id: body.case_id,
          matched_environments: environments,
          primary_environment: environments.length > 0 ? environments[0] : null,
          engine_version: ENGINE_VERSION,
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: assess_case ──
    if (action === "assess_case") {
      if (!body.case_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };

      var assessCase = await sb.from("inspection_cases").select("*").eq("id", body.case_id).single();
      if (assessCase.error || !assessCase.data) return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "Case not found" }) };

      var cd = assessCase.data;
      var mechs = matchMechanisms(cd);
      var envs = matchEnvironment(cd);

      // Build recommendations
      var inspectionMethods = {};
      for (var ri = 0; ri < mechs.length && ri < 5; ri++) {
        var recMethods = mechs[ri].recommended_inspection;
        for (var rm = 0; rm < recMethods.length; rm++) {
          inspectionMethods[recMethods[rm]] = (inspectionMethods[recMethods[rm]] || 0) + 1;
        }
      }

      // Sort methods by frequency
      var methodList = [];
      var methKeys = Object.keys(inspectionMethods);
      for (var ml = 0; ml < methKeys.length; ml++) {
        methodList.push({ method: methKeys[ml], relevance_count: inspectionMethods[methKeys[ml]] });
      }
      methodList.sort(function(a, b) { return b.relevance_count - a.relevance_count; });

      // Determine overall threat level
      var threatLevel = "low";
      if (mechs.length > 0) {
        var topSev = mechs[0].severity_range;
        if (topSev.indexOf("critical") >= 0) threatLevel = "critical";
        else if (topSev.indexOf("high") >= 0) threatLevel = "high";
        else if (topSev.indexOf("moderate") >= 0) threatLevel = "moderate";
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          case_id: body.case_id,
          assessment: {
            threat_level: threatLevel,
            primary_mechanism: mechs.length > 0 ? { id: mechs[0].mechanism_id, name: mechs[0].name, section: mechs[0].api571_section } : null,
            total_mechanisms_identified: mechs.length,
            primary_environment: envs.length > 0 ? { id: envs[0].environment, name: envs[0].name } : null,
            recommended_inspection_methods: methodList,
            key_concerns: envs.length > 0 ? envs[0].key_concerns : []
          },
          mechanisms: mechs,
          environments: envs,
          case_summary: {
            component: cd.component_name,
            material: cd.material,
            damage_type: cd.damage_type,
            asset_type: cd.asset_type,
            severity: cd.severity
          },
          engine_version: ENGINE_VERSION,
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action + ". Valid: identify_mechanisms, evaluate_environment, get_mechanism_detail, get_mechanism_registry, assess_case" }) };

  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
