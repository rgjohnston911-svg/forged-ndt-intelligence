// @ts-nocheck
/**
 * DEPLOY238 - nuclear-vertical.ts
 * netlify/functions/nuclear-vertical.ts
 *
 * NUCLEAR INDUSTRY VERTICAL
 *
 * Implements ASME Section XI ISI requirements, NRC regulatory frameworks,
 * radiation-induced degradation mechanisms, and nuclear safety classification.
 *
 * POST /api/nuclear-vertical { action: "classify_component", case_id }
 *   -> Safety classification (Class 1/2/3/MC/non-safety) and ISI requirements
 *
 * POST /api/nuclear-vertical { action: "identify_degradation", case_id }
 *   -> Nuclear-specific degradation mechanisms (IASCC, irradiation embrittlement, etc.)
 *
 * POST /api/nuclear-vertical { action: "get_isi_requirements", safety_class }
 *   -> ASME Section XI ISI examination requirements for a safety class
 *
 * POST /api/nuclear-vertical { action: "assess_case", case_id }
 *   -> Full nuclear assessment: classification + degradation + ISI + NRC
 *
 * POST /api/nuclear-vertical { action: "get_registry" }
 *   -> All nuclear degradation mechanisms and safety classes
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var ENGINE_VERSION = "nuclear-vertical/1.0.0";
var EXECUTION_MODE = "deterministic";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

// ================================================================
// ASME SECTION XI SAFETY CLASSIFICATIONS
// ================================================================
var SAFETY_CLASSES = {
  class_1: {
    id: "class_1", name: "ASME Class 1",
    description: "Reactor coolant pressure boundary components. Highest safety significance.",
    examples: ["reactor_vessel", "pressurizer", "rcp_casing", "main_coolant_piping", "safety_injection_piping"],
    nrc_10cfr: "10 CFR 50.55a",
    section_xi_table: "IWB-2500-1",
    examination_categories: [
      { cat: "B-A", desc: "Reactor vessel welds", method: "UT/VT", interval: "10 years" },
      { cat: "B-B", desc: "Pressure retaining welds in piping", method: "UT/VT", interval: "10 years" },
      { cat: "B-D", desc: "Full penetration welds of nozzles", method: "UT/VT", interval: "10 years" },
      { cat: "B-F", desc: "Pressure retaining dissimilar metal welds", method: "UT/VT", interval: "10 years" },
      { cat: "B-G-1", desc: "Reactor vessel closure studs", method: "UT/VT/MT", interval: "10 years" },
      { cat: "B-J", desc: "Pressure retaining welds in piping", method: "UT", interval: "10 years" },
      { cat: "B-N-1", desc: "Interior of reactor vessel", method: "VT-3", interval: "10 years" },
      { cat: "B-P", desc: "All pressure retaining components", method: "system_pressure_test", interval: "10 years" }
    ],
    augmented_programs: ["reactor_vessel_integrity", "boric_acid_corrosion", "alloy_600_management"]
  },
  class_2: {
    id: "class_2", name: "ASME Class 2",
    description: "Systems that perform safety functions but are not part of the reactor coolant pressure boundary.",
    examples: ["safety_injection_tanks", "residual_heat_removal", "containment_spray", "steam_generators_secondary"],
    nrc_10cfr: "10 CFR 50.55a",
    section_xi_table: "IWC-2500-1",
    examination_categories: [
      { cat: "C-A", desc: "Pressure retaining welds in pressure vessels", method: "UT", interval: "10 years" },
      { cat: "C-B", desc: "Pressure retaining welds in piping", method: "UT", interval: "10 years" },
      { cat: "C-F-1", desc: "Pressure retaining welds in piping", method: "UT/surface", interval: "10 years" },
      { cat: "C-H", desc: "All Class 2 pressure retaining components", method: "system_pressure_test", interval: "10 years" }
    ],
    augmented_programs: ["flow_accelerated_corrosion", "service_water_integrity"]
  },
  class_3: {
    id: "class_3", name: "ASME Class 3",
    description: "Components of safety systems not covered by Class 1 or 2.",
    examples: ["cooling_water_piping", "component_cooling", "service_water", "fuel_pool_cooling"],
    nrc_10cfr: "10 CFR 50.55a",
    section_xi_table: "IWD-2500-1",
    examination_categories: [
      { cat: "D-A", desc: "Systems in Class 3", method: "system_pressure_test", interval: "10 years" },
      { cat: "D-B", desc: "All Class 3 pressure retaining components", method: "VT-2", interval: "10 years" }
    ],
    augmented_programs: ["service_water_integrity", "buried_piping"]
  },
  class_mc: {
    id: "class_mc", name: "Class MC (Metal Containment)",
    description: "Metal containment vessel and penetrations.",
    examples: ["containment_vessel", "containment_penetrations", "airlock_doors", "bellows"],
    nrc_10cfr: "10 CFR 50.55a, Appendix J",
    section_xi_table: "IWE-2500-1",
    examination_categories: [
      { cat: "E-A", desc: "Containment surfaces accessible", method: "VT-1/VT-3", interval: "10 years" },
      { cat: "E-C", desc: "Containment surfaces requiring augmented examination", method: "UT", interval: "10 years" },
      { cat: "E-P", desc: "All containment pressure retaining components", method: "ILRT/LLRT", interval: "10 years" }
    ],
    augmented_programs: ["containment_degradation", "liner_plate_corrosion"]
  }
};

// ================================================================
// NUCLEAR-SPECIFIC DEGRADATION MECHANISMS
// ================================================================
var NUCLEAR_DEGRADATION = {
  iascc: {
    id: "iascc", name: "Irradiation-Assisted Stress Corrosion Cracking (IASCC)",
    category: "radiation_induced",
    description: "Neutron irradiation changes grain boundary chemistry and local stress state, making austenitic stainless steels susceptible to intergranular SCC in reactor coolant. Threshold at ~0.5 dpa.",
    materials_affected: ["austenitic_stainless", "stainless_304", "stainless_316"],
    components: ["core_internals", "baffle_bolts", "core_shroud", "top_guide"],
    fluence_threshold: "0.5 dpa (5x10^20 n/cm2, E>1MeV)",
    inspection_methods: ["VT-1", "VT-3", "UT", "EVT-1"],
    severity: "critical",
    nrc_references: ["GL 88-01", "MRP-227-A"]
  },
  irradiation_embrittlement: {
    id: "irradiation_embrittlement", name: "Neutron Irradiation Embrittlement",
    category: "radiation_induced",
    description: "Neutron bombardment creates displacement cascades that increase yield strength and shift DBTT upward. Critical for reactor pressure vessel beltline materials. Monitored via surveillance capsule program.",
    materials_affected: ["carbon_steel", "low_alloy_steel", "sa508", "sa533"],
    components: ["reactor_vessel_beltline", "reactor_vessel_welds"],
    fluence_threshold: "Depends on Cu/Ni content per Reg Guide 1.99 Rev 2",
    inspection_methods: ["surveillance_capsules", "master_curve_testing", "charpy_testing"],
    severity: "critical",
    nrc_references: ["10 CFR 50.61", "Reg Guide 1.99 Rev 2", "ASTM E185"]
  },
  pwscc: {
    id: "pwscc", name: "Primary Water Stress Corrosion Cracking (PWSCC)",
    category: "environmental_cracking",
    description: "SCC of nickel-base alloys (Alloy 600, 182, 82) in primary water environment. Driven by temperature, stress, and material susceptibility. Major issue for reactor vessel head penetrations.",
    materials_affected: ["alloy_600", "alloy_182_welds", "alloy_82_welds"],
    components: ["crdm_penetrations", "bmc_nozzles", "pressurizer_heater_sleeves", "instrument_nozzles"],
    temperature_range: "above 550F, accelerates with temperature",
    inspection_methods: ["UT", "ET", "VT", "bare_metal_visual"],
    severity: "critical",
    nrc_references: ["Order EA-03-009", "MRP-139", "ASME Code Case N-729-1"]
  },
  flow_accelerated_corrosion: {
    id: "flow_accelerated_corrosion", name: "Flow-Accelerated Corrosion (FAC)",
    category: "general_corrosion",
    description: "Dissolution of protective oxide layer on carbon steel by flowing water/steam. Affected by temperature, pH, dissolved oxygen, flow velocity, and geometry. Managed by predictive software (CHECWORKS).",
    materials_affected: ["carbon_steel", "low_alloy_steel"],
    components: ["feedwater_piping", "extraction_steam", "heater_drains", "moisture_separator"],
    temperature_range: "200-550F (peak at ~300F single-phase, ~350F two-phase)",
    inspection_methods: ["UT_grid", "RT"],
    severity: "high",
    nrc_references: ["GL 89-08", "NSAC-202L"]
  },
  boric_acid_corrosion: {
    id: "boric_acid_corrosion", name: "Boric Acid Corrosion",
    category: "general_corrosion",
    description: "Concentrated boric acid from primary coolant leaks corrodes carbon and low-alloy steel. Davis-Besse RPV head wastage event demonstrated potential for rapid material loss.",
    materials_affected: ["carbon_steel", "low_alloy_steel"],
    components: ["reactor_vessel_head", "crdm_housings", "bolted_connections", "valve_bodies"],
    inspection_methods: ["VT", "bare_metal_visual", "UT"],
    severity: "critical",
    nrc_references: ["GL 88-05", "Order EA-03-009", "First Revised Order EA-03-009"]
  },
  thermal_aging_embrittlement: {
    id: "thermal_aging_embrittlement", name: "Thermal Aging Embrittlement",
    category: "high_temperature",
    description: "Long-term exposure to operating temperatures causes spinodal decomposition in cast austenitic stainless steel (CASS), reducing fracture toughness. Particularly affects CF8M (cast 316) with high ferrite content.",
    materials_affected: ["cast_austenitic_ss", "cf8", "cf8m", "cf3", "cf3m"],
    components: ["reactor_coolant_pump_casings", "valve_bodies", "piping_elbows"],
    temperature_range: "above 500F for extended service",
    inspection_methods: ["UT_with_EPRI_methodology", "ferrite_measurement"],
    severity: "high",
    nrc_references: ["NUREG/CR-4513", "NUREG/CR-6177", "MRP-175"]
  },
  swelling: {
    id: "swelling", name: "Void Swelling",
    category: "radiation_induced",
    description: "At high neutron fluence, vacancy clusters form voids that cause dimensional changes in austenitic stainless steels. Relevant for long-life core internals.",
    materials_affected: ["austenitic_stainless", "stainless_304", "stainless_316"],
    components: ["core_baffle", "core_barrel", "former_plates"],
    fluence_threshold: "above 1-5 dpa (material dependent)",
    inspection_methods: ["dimensional_measurement", "VT-3"],
    severity: "moderate",
    nrc_references: ["MRP-227-A"]
  },
  sg_tube_degradation: {
    id: "sg_tube_degradation", name: "Steam Generator Tube Degradation",
    category: "multi_mechanism",
    description: "Multiple degradation mechanisms affect SG tubes: PWSCC on primary side, ODSCC from deposits on secondary side, pitting, wastage, denting, and intergranular attack. Managed per NEI 97-06.",
    materials_affected: ["alloy_600", "alloy_690", "alloy_800"],
    components: ["sg_tubes", "sg_tubesheet", "sg_tube_support_plates"],
    inspection_methods: ["ET_bobbin", "ET_rotating", "MRPC", "plus_point"],
    severity: "critical",
    nrc_references: ["Reg Guide 1.121", "NEI 97-06", "EPRI SG Guidelines"]
  }
};

// ================================================================
// MATCHING LOGIC
// ================================================================
function lower(s) { return (s || "").toString().toLowerCase(); }

function classifyComponent(caseData) {
  var text = lower(caseData.component_name) + " " + lower(caseData.asset_type) + " " + lower(caseData.notes);
  var matches = [];

  var classKeys = Object.keys(SAFETY_CLASSES);
  for (var i = 0; i < classKeys.length; i++) {
    var cls = SAFETY_CLASSES[classKeys[i]];
    var score = 0;
    for (var e = 0; e < cls.examples.length; e++) {
      var exWords = cls.examples[e].replace(/_/g, " ").split(" ");
      for (var w = 0; w < exWords.length; w++) {
        if (exWords[w].length > 3 && text.indexOf(exWords[w]) >= 0) {
          score += 10;
        }
      }
    }
    if (score > 0) {
      matches.push({ class_id: cls.id, name: cls.name, score: score, description: cls.description });
    }
  }

  matches.sort(function(a, b) { return b.score - a.score; });
  return matches;
}

function identifyNuclearDegradation(caseData) {
  var text = lower(caseData.damage_type) + " " + lower(caseData.material) + " " + lower(caseData.notes) + " " + lower(caseData.component_name) + " " + lower(caseData.asset_type);
  var matches = [];

  var degKeys = Object.keys(NUCLEAR_DEGRADATION);
  for (var i = 0; i < degKeys.length; i++) {
    var deg = NUCLEAR_DEGRADATION[degKeys[i]];
    var score = 0;
    var reasons = [];

    // Check component matches
    for (var c = 0; c < deg.components.length; c++) {
      var compWords = deg.components[c].replace(/_/g, " ").split(" ");
      for (var cw = 0; cw < compWords.length; cw++) {
        if (compWords[cw].length > 3 && text.indexOf(compWords[cw]) >= 0) {
          score += 15;
          reasons.push("component: " + deg.components[c]);
          break;
        }
      }
    }

    // Check material matches
    for (var m = 0; m < deg.materials_affected.length; m++) {
      var matWords = deg.materials_affected[m].replace(/_/g, " ").split(" ");
      for (var mw = 0; mw < matWords.length; mw++) {
        if (matWords[mw].length > 2 && text.indexOf(matWords[mw]) >= 0) {
          score += 10;
          reasons.push("material: " + deg.materials_affected[m]);
          break;
        }
      }
    }

    // Check keywords from name and category
    var nameWords = lower(deg.name).split(/[\s\-\/\(\)]+/);
    for (var n = 0; n < nameWords.length; n++) {
      if (nameWords[n].length > 3 && text.indexOf(nameWords[n]) >= 0) {
        score += 10;
        reasons.push("name keyword: " + nameWords[n]);
      }
    }

    if (score > 0) {
      matches.push({
        mechanism_id: deg.id,
        name: deg.name,
        category: deg.category,
        match_score: score,
        match_reasons: reasons,
        severity: deg.severity,
        inspection_methods: deg.inspection_methods,
        nrc_references: deg.nrc_references,
        description: deg.description
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

    // ── ACTION: get_registry ──
    if (action === "get_registry") {
      var degList = [];
      var degKeys = Object.keys(NUCLEAR_DEGRADATION);
      for (var i = 0; i < degKeys.length; i++) {
        var d = NUCLEAR_DEGRADATION[degKeys[i]];
        degList.push({ id: d.id, name: d.name, category: d.category, severity: d.severity, components: d.components, nrc_references: d.nrc_references });
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          safety_classes: Object.keys(SAFETY_CLASSES).length,
          degradation_mechanisms: degList.length,
          classes: Object.keys(SAFETY_CLASSES),
          mechanisms: degList,
          engine_version: ENGINE_VERSION,
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: get_isi_requirements ──
    if (action === "get_isi_requirements") {
      if (!body.safety_class) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "safety_class required (class_1, class_2, class_3, class_mc)" }) };
      var cls = SAFETY_CLASSES[body.safety_class];
      if (!cls) return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "Unknown safety class: " + body.safety_class }) };

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ safety_class: cls, engine_version: ENGINE_VERSION, response_ms: Date.now() - startTime }, null, 2)
      };
    }

    // ── ACTION: classify_component ──
    if (action === "classify_component") {
      if (!body.case_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };
      var caseResult = await sb.from("inspection_cases").select("*").eq("id", body.case_id).single();
      if (caseResult.error || !caseResult.data) return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "Case not found" }) };

      var classifications = classifyComponent(caseResult.data);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          case_id: body.case_id,
          classifications: classifications,
          primary_class: classifications.length > 0 ? classifications[0] : { class_id: "non_safety", name: "Non-Safety Related", score: 0 },
          engine_version: ENGINE_VERSION,
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: identify_degradation ──
    if (action === "identify_degradation") {
      if (!body.case_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };
      var degCase = await sb.from("inspection_cases").select("*").eq("id", body.case_id).single();
      if (degCase.error || !degCase.data) return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "Case not found" }) };

      var degradation = identifyNuclearDegradation(degCase.data);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          case_id: body.case_id,
          degradation_mechanisms: degradation,
          total_matches: degradation.length,
          primary_mechanism: degradation.length > 0 ? degradation[0] : null,
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
      var clsList = classifyComponent(cd);
      var degList2 = identifyNuclearDegradation(cd);

      var primaryClass = clsList.length > 0 ? clsList[0] : { class_id: "non_safety", name: "Non-Safety Related" };
      var isiReqs = SAFETY_CLASSES[primaryClass.class_id] || null;

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          case_id: body.case_id,
          nuclear_assessment: {
            safety_classification: primaryClass,
            isi_examination_categories: isiReqs ? isiReqs.examination_categories : [],
            augmented_programs: isiReqs ? isiReqs.augmented_programs : [],
            degradation_mechanisms: degList2,
            primary_mechanism: degList2.length > 0 ? { id: degList2[0].mechanism_id, name: degList2[0].name, severity: degList2[0].severity } : null,
            nrc_regulatory_basis: isiReqs ? isiReqs.nrc_10cfr : "N/A",
            recommended_actions: degList2.length > 0 && degList2[0].severity === "critical" ? "Immediate engineering evaluation required. Notify NRC per 10 CFR 50.72/50.73 if applicable." : degList2.length > 0 ? "Schedule examination per ASME Section XI requirements. Evaluate for augmented inspection." : "Standard ISI program examination."
          },
          case_summary: {
            component: cd.component_name,
            material: cd.material,
            damage_type: cd.damage_type,
            asset_type: cd.asset_type
          },
          engine_version: ENGINE_VERSION,
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action + ". Valid: classify_component, identify_degradation, get_isi_requirements, assess_case, get_registry" }) };

  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
