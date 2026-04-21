// @ts-nocheck
/**
 * DEPLOY241 - maritime-offshore.ts
 * netlify/functions/maritime-offshore.ts
 *
 * MARITIME & OFFSHORE INDUSTRY VERTICAL
 * Hull inspection, offshore platforms, subsea, marine coatings
 * ABS / DNV / Lloyd's / IMO classification frameworks
 *
 * POST /api/maritime-offshore { action, ... }
 *
 * Actions:
 *   identify_damage    - identify damage mechanisms for marine component
 *   assess_case        - full case assessment with maritime context
 *   get_survey_requirements - class survey requirements by vessel/structure type
 *   get_registry       - return full mechanism + classification registry
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

// ── DAMAGE MECHANISM REGISTRY ──────────────────────────────────────

var DAMAGE_MECHANISMS = [
  // Hull & Structure
  {
    id: "mar_general_corrosion_hull",
    name: "General Corrosion (Hull Plating)",
    category: "hull_structure",
    description: "Uniform material loss on hull shell plating, deck plating, and internal structure from seawater and cargo environment exposure",
    keywords: ["general corrosion", "hull", "shell plating", "deck", "wastage", "diminution"],
    materials: ["mild steel", "high tensile steel", "ah32", "ah36", "dh32", "dh36"],
    components: ["bottom shell", "side shell", "deck plating", "inner bottom", "bulkhead"],
    ndt_methods: ["UT thickness", "UWILD", "close-up survey", "visual"],
    severity_base: 0.6,
    references: ["IACS UR Z10", "IACS UR S6", "DNV-RU-SHIP Pt.7"]
  },
  {
    id: "mar_pitting_ballast",
    name: "Pitting Corrosion (Ballast Tanks)",
    category: "hull_structure",
    description: "Localized deep pitting in ballast tank structure from coating breakdown and stagnant seawater creating differential aeration cells",
    keywords: ["pitting", "ballast tank", "coating breakdown", "localized", "deep pit"],
    materials: ["mild steel", "high tensile steel"],
    components: ["ballast tank", "double bottom", "topside tank", "hopper tank", "wing tank"],
    ndt_methods: ["UT thickness", "pit depth gauge", "close-up survey", "visual"],
    severity_base: 0.7,
    references: ["IACS UR Z10.2", "IMO PSPC", "DNV-CG-0182"]
  },
  {
    id: "mar_fatigue_cracking",
    name: "Structural Fatigue Cracking",
    category: "hull_structure",
    description: "Fatigue cracks at structural details including bracket toes, cutouts, slot welds, and intersecting stiffeners from wave-induced cyclic loading",
    keywords: ["fatigue", "cracking", "bracket toe", "cutout", "slot weld", "structural detail", "wave loading"],
    materials: ["mild steel", "high tensile steel"],
    components: ["web frame", "bracket", "stiffener", "longitudinal", "transverse bulkhead", "hatch corner"],
    ndt_methods: ["MPI", "visual", "ACFM", "UT"],
    severity_base: 0.8,
    references: ["IACS CSR", "DNV-CG-0129", "ABS Guide for Fatigue Assessment"]
  },
  {
    id: "mar_grooving_corrosion",
    name: "Grooving Corrosion (Weld Seams)",
    category: "hull_structure",
    description: "Preferential corrosion attack along weld heat-affected zones in hull structure creating groove-like material loss at weld toes",
    keywords: ["grooving", "weld", "heat affected zone", "haz", "weld toe", "preferential"],
    materials: ["mild steel", "high tensile steel"],
    components: ["butt weld", "fillet weld", "hull seam", "tank boundary"],
    ndt_methods: ["UT thickness", "visual", "MPI"],
    severity_base: 0.65,
    references: ["IACS UR Z10", "DNV-RU-SHIP Pt.7"]
  },

  // Offshore Platform
  {
    id: "mar_splash_zone_corrosion",
    name: "Splash Zone Corrosion",
    category: "offshore_platform",
    description: "Accelerated corrosion in the splash zone of offshore jacket legs and risers from cyclic wetting/drying with high oxygen availability",
    keywords: ["splash zone", "jacket leg", "riser", "tidal", "cyclic wetting", "marine growth"],
    materials: ["carbon steel", "high tensile steel", "duplex stainless"],
    components: ["jacket leg", "riser", "conductor", "j-tube", "boat landing"],
    ndt_methods: ["UT thickness", "visual", "ACFM", "underwater inspection"],
    severity_base: 0.75,
    references: ["ISO 19902", "NORSOK M-501", "API RP 2A"]
  },
  {
    id: "mar_cp_degradation",
    name: "Cathodic Protection System Degradation",
    category: "offshore_platform",
    description: "Depletion or detachment of sacrificial anodes and degradation of impressed current CP systems leading to under-protection of submerged steel",
    keywords: ["cathodic protection", "cp", "anode", "sacrificial", "impressed current", "potential"],
    materials: ["zinc anode", "aluminum anode", "coated steel"],
    components: ["jacket", "subsea pipeline", "riser", "caisson", "mooring"],
    ndt_methods: ["CP survey", "potential measurement", "visual", "anode wastage measurement"],
    severity_base: 0.6,
    references: ["DNV-RP-B401", "NACE SP0176", "ISO 15589-2"]
  },
  {
    id: "mar_fatigue_tubular_joint",
    name: "Tubular Joint Fatigue (Offshore)",
    category: "offshore_platform",
    description: "Fatigue cracking at welded tubular joints in offshore jacket structures from wave and current cyclic loading at hot spots",
    keywords: ["tubular joint", "fatigue", "jacket", "node", "hot spot", "brace"],
    materials: ["high tensile steel", "structural steel"],
    components: ["k-joint", "t-joint", "y-joint", "kt-joint", "brace", "chord"],
    ndt_methods: ["ACFM", "MPI", "flooded member detection", "UT"],
    severity_base: 0.85,
    references: ["ISO 19902", "API RP 2A", "DNV-RP-C203", "HSE OTO 97/045"]
  },
  {
    id: "mar_scour",
    name: "Seabed Scour and Foundation Erosion",
    category: "offshore_platform",
    description: "Removal of seabed material around platform foundations, monopiles, and jacket legs from current and wave action reducing structural support",
    keywords: ["scour", "seabed", "foundation", "mudline", "erosion", "monopile"],
    materials: ["seabed soil", "grout"],
    components: ["jacket foundation", "monopile", "gravity base", "mudmat", "pile sleeve"],
    ndt_methods: ["ROV survey", "multibeam sonar", "bathymetric survey"],
    severity_base: 0.7,
    references: ["DNV-ST-0126", "API RP 2GEO", "ISO 19901-4"]
  },

  // Subsea
  {
    id: "mar_subsea_pipeline_corrosion",
    name: "Subsea Pipeline External Corrosion",
    category: "subsea",
    description: "External corrosion of subsea pipelines from coating damage, CP depletion, and marine environment exposure including MIC in anaerobic sediment",
    keywords: ["subsea", "pipeline", "external corrosion", "coating damage", "mic", "burial"],
    materials: ["carbon steel", "clad pipe", "corrosion resistant alloy"],
    components: ["flowline", "export pipeline", "riser base", "pipeline crossing", "free span"],
    ndt_methods: ["intelligent pig", "UT thickness", "ROV visual", "CP survey"],
    severity_base: 0.75,
    references: ["DNV-ST-F101", "API 1160", "ASME B31.4/B31.8"]
  },
  {
    id: "mar_flexible_riser_damage",
    name: "Flexible Riser Degradation",
    category: "subsea",
    description: "Armor wire fatigue, annulus flooding, carcass collapse, and outer sheath damage in unbonded flexible risers and flowlines",
    keywords: ["flexible riser", "armor wire", "annulus", "carcass", "outer sheath", "bend stiffener"],
    materials: ["carbon steel wire", "stainless steel", "pvdf", "hdpe", "nylon"],
    components: ["flexible riser", "flexible flowline", "dynamic umbilical", "bend stiffener"],
    ndt_methods: ["annulus testing", "visual", "radiography", "magnetic", "weight measurement"],
    severity_base: 0.8,
    references: ["API 17B", "API 17J", "DNV-ST-F201", "OTC 26563"]
  },

  // Marine Coating
  {
    id: "mar_coating_breakdown",
    name: "Marine Coating System Breakdown",
    category: "coating_system",
    description: "Progressive degradation of marine protective coating systems including blistering, cracking, chalking, and delamination exposing substrate steel",
    keywords: ["coating", "paint", "breakdown", "blistering", "delamination", "chalking", "rust"],
    materials: ["epoxy", "polyurethane", "zinc silicate", "coal tar epoxy", "antifouling"],
    components: ["hull", "ballast tank", "deck", "superstructure", "cargo tank"],
    ndt_methods: ["DFT gauge", "adhesion test", "holiday detection", "visual ISO 4628"],
    severity_base: 0.45,
    references: ["IMO PSPC MSC.215(82)", "NORSOK M-501", "ISO 12944", "SSPC"]
  },

  // Mooring
  {
    id: "mar_mooring_chain_fatigue",
    name: "Mooring Chain/Line Fatigue and Corrosion",
    category: "mooring",
    description: "Combined fatigue and corrosion degradation of mooring chains, wire ropes, and synthetic lines from dynamic vessel motions and marine environment",
    keywords: ["mooring", "chain", "wire rope", "fatigue", "corrosion", "fpso", "anchor"],
    materials: ["r4 chain steel", "r4s chain steel", "wire rope", "polyester", "hmpe"],
    components: ["mooring chain", "wire rope segment", "synthetic rope", "anchor", "fairlead", "chain stopper"],
    ndt_methods: ["MPI", "visual", "dimensional", "break test", "proof load"],
    severity_base: 0.85,
    references: ["API RP 2SK", "DNV-OS-E301", "IACS UR W22", "OTC 27446"]
  }
];

// ── CLASS SURVEY REGISTRY ──────────────────────────────────────────

var SURVEY_TYPES = [
  {
    id: "annual_survey",
    name: "Annual Survey",
    description: "General examination of hull, machinery, and safety equipment to confirm vessel maintained in class condition",
    interval: "12 months",
    scope: "External hull, weather deck, safety equipment, machinery spot checks",
    applies_to: ["vessel", "mobile_offshore_unit"],
    classification: ["ABS", "DNV", "Lloyd's", "BV", "ClassNK", "RINA"]
  },
  {
    id: "intermediate_survey",
    name: "Intermediate Survey",
    description: "Extended examination of hull structure at 2.5 years into 5-year cycle, including ballast tank entry and thickness measurements",
    interval: "2.5 years (within class cycle)",
    scope: "Ballast tank inspection, UT thickness measurements, coating condition",
    applies_to: ["bulk_carrier", "tanker", "vessel"],
    classification: ["IACS"]
  },
  {
    id: "special_survey",
    name: "Special Survey / Class Renewal",
    description: "Comprehensive structural survey at 5-year intervals including extensive UT thickness measurements, tank entry, and close-up inspection",
    interval: "5 years",
    scope: "Complete structural review, extensive UT gauging, all tanks, close-up of critical areas",
    applies_to: ["vessel", "bulk_carrier", "tanker", "container_ship"],
    classification: ["IACS", "ABS", "DNV", "Lloyd's"]
  },
  {
    id: "underwater_survey",
    name: "In-Water Survey (IWS)",
    description: "Underwater inspection of hull, propeller, rudder, sea chests, and CP system as alternative to drydocking",
    interval: "2.5 years (alternate drydock)",
    scope: "Hull plating, propeller, rudder, sea valves, CP anodes, marine growth",
    applies_to: ["vessel"],
    classification: ["IACS", "ABS", "DNV", "Lloyd's"]
  },
  {
    id: "offshore_periodic",
    name: "Offshore Periodic Survey",
    description: "Scheduled inspection of fixed and floating offshore installations covering structural integrity, topsides, and marine systems",
    interval: "5 years (with annual reviews)",
    scope: "Jacket/hull structure, topsides, safety systems, CP system, risers",
    applies_to: ["fixed_platform", "fpso", "semi_submersible", "jack_up"],
    classification: ["DNV", "ABS", "Lloyd's", "BV"]
  },
  {
    id: "subsea_inspection",
    name: "Subsea Inspection (General Visual / Close Visual / NDT)",
    description: "Tiered underwater inspection of subsea structures: GVI by ROV, CVI with cleaning, and detailed NDT of critical areas",
    interval: "Annual GVI, 3-5 year CVI, risk-based NDT",
    scope: "Jacket nodes, risers, pipelines, CP system, seabed, marine growth",
    applies_to: ["fixed_platform", "subsea_pipeline", "subsea_equipment"],
    classification: ["DNV-RP-C210", "ISO 19902", "API RP 2SIM"]
  }
];

// ── MATCHING ENGINE ────────────────────────────────────────────────

function matchMechanisms(params) {
  var description = (params.description || "").toLowerCase();
  var material = (params.material || "").toLowerCase();
  var component = (params.component || "").toLowerCase();
  var category = (params.category || "").toLowerCase();

  var scored = [];
  for (var i = 0; i < DAMAGE_MECHANISMS.length; i++) {
    var mech = DAMAGE_MECHANISMS[i];
    var score = 0;

    for (var k = 0; k < mech.keywords.length; k++) {
      if (description.indexOf(mech.keywords[k]) !== -1) score += 20;
      if (component.indexOf(mech.keywords[k]) !== -1) score += 20;
    }

    for (var m = 0; m < mech.materials.length; m++) {
      if (material.indexOf(mech.materials[m]) !== -1) score += 15;
    }

    for (var c = 0; c < mech.components.length; c++) {
      if (component.indexOf(mech.components[c]) !== -1) score += 15;
      if (description.indexOf(mech.components[c]) !== -1) score += 10;
    }

    if (category && mech.category === category) score += 25;

    if (score > 0) {
      scored.push({
        mechanism: mech,
        relevance_score: score,
        confidence: score >= 60 ? "high" : (score >= 30 ? "medium" : "low")
      });
    }
  }

  scored.sort(function(a, b) { return b.relevance_score - a.relevance_score; });
  return scored;
}

// ── HANDLER ────────────────────────────────────────────────────────

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";

    // ── get_registry ──
    if (action === "get_registry") {
      var byCat = {};
      for (var i = 0; i < DAMAGE_MECHANISMS.length; i++) {
        var cat = DAMAGE_MECHANISMS[i].category;
        if (!byCat[cat]) byCat[cat] = 0;
        byCat[cat]++;
      }
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "maritime-offshore",
          deploy: "DEPLOY241",
          version: "1.0.0",
          total_mechanisms: DAMAGE_MECHANISMS.length,
          by_category: byCat,
          categories: ["hull_structure", "offshore_platform", "subsea", "coating_system", "mooring"],
          survey_types: SURVEY_TYPES.length,
          mechanisms: DAMAGE_MECHANISMS.map(function(m) {
            return { id: m.id, name: m.name, category: m.category, severity_base: m.severity_base };
          }),
          surveys: SURVEY_TYPES.map(function(s) {
            return { id: s.id, name: s.name, interval: s.interval };
          })
        })
      };
    }

    // ── identify_damage ──
    if (action === "identify_damage") {
      var matches = matchMechanisms({
        description: body.description || "",
        material: body.material || "",
        component: body.component || "",
        category: body.category || ""
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "identify_damage",
          input: { description: body.description, material: body.material, component: body.component, category: body.category },
          matches_found: matches.length,
          mechanisms: matches.slice(0, 10).map(function(m) {
            return {
              id: m.mechanism.id,
              name: m.mechanism.name,
              category: m.mechanism.category,
              description: m.mechanism.description,
              relevance_score: m.relevance_score,
              confidence: m.confidence,
              severity_base: m.mechanism.severity_base,
              recommended_ndt: m.mechanism.ndt_methods,
              references: m.mechanism.references
            };
          })
        })
      };
    }

    // ── get_survey_requirements ──
    if (action === "get_survey_requirements") {
      var structureType = (body.structure_type || body.vessel_type || "").toLowerCase();
      var matchedSurveys = [];

      for (var si = 0; si < SURVEY_TYPES.length; si++) {
        var survey = SURVEY_TYPES[si];
        var applies = false;
        for (var ai = 0; ai < survey.applies_to.length; ai++) {
          if (structureType.indexOf(survey.applies_to[ai]) !== -1 || survey.applies_to[ai] === "vessel") {
            applies = true;
            break;
          }
        }
        if (applies || !structureType) {
          matchedSurveys.push(survey);
        }
      }

      // find applicable damage mechanisms for this structure type
      var catMap = {
        "vessel": "hull_structure",
        "bulk_carrier": "hull_structure",
        "tanker": "hull_structure",
        "container_ship": "hull_structure",
        "fixed_platform": "offshore_platform",
        "fpso": "offshore_platform",
        "semi_submersible": "offshore_platform",
        "jack_up": "offshore_platform",
        "subsea_pipeline": "subsea"
      };
      var relevantCat = catMap[structureType] || "";
      var relevantMechs = [];
      if (relevantCat) {
        for (var ri = 0; ri < DAMAGE_MECHANISMS.length; ri++) {
          if (DAMAGE_MECHANISMS[ri].category === relevantCat) {
            relevantMechs.push({ id: DAMAGE_MECHANISMS[ri].id, name: DAMAGE_MECHANISMS[ri].name, severity_base: DAMAGE_MECHANISMS[ri].severity_base });
          }
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "get_survey_requirements",
          structure_type: structureType || "all",
          applicable_surveys: matchedSurveys,
          common_damage_mechanisms: relevantMechs,
          classification_bodies: ["ABS", "DNV", "Lloyd's Register", "Bureau Veritas", "ClassNK", "RINA"]
        })
      };
    }

    // ── assess_case ──
    if (action === "assess_case") {
      if (!body.case_id) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };
      }

      var sb = createClient(supabaseUrl, supabaseKey);
      var caseRes = await sb.from("inspection_cases").select("*").eq("id", body.case_id).single();
      if (caseRes.error || !caseRes.data) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ action: "assess_case", case_id: body.case_id, error: "case_not_found" }) };
      }

      var caseData = caseRes.data;
      var findingsRes = await sb.from("findings").select("*").eq("case_id", body.case_id);
      var findings = (findingsRes.data || []);

      var caseDesc = (caseData.component_name || "") + " " + (caseData.inspection_method || "") + " " + (caseData.notes || "");
      for (var fi = 0; fi < findings.length; fi++) {
        caseDesc += " " + (findings[fi].description || "") + " " + (findings[fi].severity || "");
      }

      var caseMechs = matchMechanisms({
        description: caseDesc,
        material: body.material || "",
        component: caseData.component_name || "",
        category: body.category || ""
      });

      // maritime-specific risk flags
      var riskFlags = [];
      if (caseMechs.length > 0 && caseMechs[0].mechanism.severity_base >= 0.8) {
        riskFlags.push("high_severity_mechanism");
      }
      if (caseMechs.some(function(m) { return m.mechanism.category === "mooring"; })) {
        riskFlags.push("safety_critical_mooring_system");
      }
      if (caseMechs.some(function(m) { return m.mechanism.id === "mar_fatigue_tubular_joint"; })) {
        riskFlags.push("primary_structure_fatigue");
      }
      if (findings.length > 3) {
        riskFlags.push("multiple_findings");
      }

      var classAction = "routine_monitoring";
      if (riskFlags.length >= 2 || (caseMechs.length > 0 && caseMechs[0].mechanism.severity_base >= 0.85)) {
        classAction = "class_notification_required";
      } else if (caseMechs.length > 0 && caseMechs[0].mechanism.severity_base >= 0.7) {
        classAction = "enhanced_survey_scope";
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "assess_case",
          case_id: body.case_id,
          case_status: caseData.status,
          component: caseData.component_name,
          identified_mechanisms: caseMechs.slice(0, 5).map(function(m) {
            return {
              id: m.mechanism.id,
              name: m.mechanism.name,
              category: m.mechanism.category,
              relevance_score: m.relevance_score,
              confidence: m.confidence,
              severity_base: m.mechanism.severity_base,
              recommended_ndt: m.mechanism.ndt_methods
            };
          }),
          findings_count: findings.length,
          risk_flags: riskFlags,
          classification_action: classAction,
          maritime_recommendation: caseMechs.length > 0 ? (
            classAction === "class_notification_required" ? "notify_classification_society_and_flag_state" :
            classAction === "enhanced_survey_scope" ? "expand_survey_scope_at_next_inspection" :
            "continue_planned_maintenance"
          ) : "insufficient_data"
        })
      };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action, valid_actions: ["identify_damage", "assess_case", "get_survey_requirements", "get_registry"] }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
