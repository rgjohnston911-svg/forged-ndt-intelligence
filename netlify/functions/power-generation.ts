// @ts-nocheck
/**
 * DEPLOY240 - power-generation.ts
 * netlify/functions/power-generation.ts
 *
 * POWER GENERATION INDUSTRY VERTICAL
 * Gas turbines, steam turbines, wind turbines, boiler tubes, HRSG
 *
 * POST /api/power-generation { action, ... }
 *
 * Actions:
 *   identify_damage    - identify damage mechanisms for a component
 *   assess_case        - full case assessment with power gen context
 *   get_inspection_requirements - interval/method requirements by component type
 *   get_registry       - return full mechanism + component registry
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
// Covers gas turbine, steam turbine, wind turbine, boiler, HRSG

var DAMAGE_MECHANISMS = [
  // Gas Turbine
  {
    id: "pgn_thermal_fatigue",
    name: "Thermal Mechanical Fatigue (TMF)",
    category: "gas_turbine",
    description: "Cyclic thermal stress from startup/shutdown and load changes causing crack initiation in hot gas path components",
    keywords: ["thermal fatigue", "tmf", "startup shutdown", "hot gas path", "blade", "vane", "combustor", "transition piece"],
    materials: ["nickel superalloy", "inconel", "hastelloy", "rene", "mar-m", "cmsx"],
    components: ["turbine blade", "nozzle vane", "combustor liner", "transition piece"],
    ndt_methods: ["FPI", "EC", "CT", "thermal imaging"],
    severity_base: 0.8,
    references: ["GE GER-3569", "EPRI 1025286", "ASME PCC-3"]
  },
  {
    id: "pgn_hot_corrosion_type1",
    name: "Type I Hot Corrosion (HTHC)",
    category: "gas_turbine",
    description: "Sulfidation attack above 850C from sodium sulfate deposits on turbine airfoils causing accelerated oxidation and material loss",
    keywords: ["hot corrosion", "sulfidation", "type 1", "sodium sulfate", "high temperature", "airfoil"],
    materials: ["nickel superalloy", "cobalt superalloy", "mcraly"],
    components: ["first stage blade", "first stage vane", "combustor"],
    ndt_methods: ["visual", "borescope", "dimensional", "metallography"],
    severity_base: 0.75,
    references: ["NASA TM-2003-212319", "EPRI TR-103834"]
  },
  {
    id: "pgn_hot_corrosion_type2",
    name: "Type II Hot Corrosion (LTHC)",
    category: "gas_turbine",
    description: "Low temperature hot corrosion between 600-800C from cobalt and nickel sulfates causing pitting on later-stage airfoils",
    keywords: ["hot corrosion", "type 2", "low temperature", "pitting", "later stage"],
    materials: ["nickel superalloy", "cobalt superalloy"],
    components: ["second stage blade", "third stage blade", "later stage vane"],
    ndt_methods: ["visual", "borescope", "pit depth gauge", "EC"],
    severity_base: 0.65,
    references: ["EPRI TR-103834", "NACE 6A192"]
  },
  {
    id: "pgn_creep_rupture",
    name: "Creep Rupture",
    category: "gas_turbine",
    description: "Time-dependent deformation and eventual rupture under sustained high temperature and stress in hot section components",
    keywords: ["creep", "rupture", "elongation", "bulging", "hot section", "blade tip"],
    materials: ["nickel superalloy", "single crystal", "ds alloy"],
    components: ["turbine blade", "nozzle vane", "combustor liner", "rotor disc"],
    ndt_methods: ["dimensional", "replica metallography", "phased array UT"],
    severity_base: 0.85,
    references: ["API 579-1/ASME FFS-1 Part 10", "EPRI 1025286"]
  },
  {
    id: "pgn_coating_degradation",
    name: "Thermal Barrier Coating (TBC) Degradation",
    category: "gas_turbine",
    description: "Spallation, sintering, and erosion of thermal barrier and bond coat systems on hot gas path components",
    keywords: ["tbc", "coating", "spallation", "bond coat", "sintering", "erosion"],
    materials: ["yttria stabilized zirconia", "mcraly", "platinum aluminide"],
    components: ["turbine blade", "nozzle vane", "combustor liner", "shroud"],
    ndt_methods: ["visual", "borescope", "infrared thermography", "EC", "luminescence"],
    severity_base: 0.6,
    references: ["NASA/TM-2005-213829", "EPRI 1012552"]
  },

  // Steam Turbine
  {
    id: "pgn_scc_disc",
    name: "Stress Corrosion Cracking (Disc/Blade Attachment)",
    category: "steam_turbine",
    description: "SCC in steam turbine disc bore, keyway, and blade attachment areas from caustic or chloride environments in wet steam",
    keywords: ["scc", "stress corrosion", "disc", "blade root", "keyway", "wet steam", "caustic"],
    materials: ["low alloy steel", "12cr steel", "17-4ph"],
    components: ["turbine disc", "blade root", "shrunk-on disc", "keyway"],
    ndt_methods: ["UT", "MPI", "phased array UT", "TOFD"],
    severity_base: 0.85,
    references: ["EPRI TR-104030", "ASTM E1820", "ASME Vol V"]
  },
  {
    id: "pgn_solid_particle_erosion",
    name: "Solid Particle Erosion (SPE)",
    category: "steam_turbine",
    description: "Erosion of blade leading edges and nozzle partitions from oxide scale exfoliated from superheater and reheater tubes",
    keywords: ["solid particle erosion", "spe", "oxide scale", "exfoliation", "blade erosion", "nozzle"],
    materials: ["12cr steel", "stellite", "low alloy steel"],
    components: ["first stage blade", "control stage nozzle", "nozzle partition", "diaphragm"],
    ndt_methods: ["visual", "dimensional", "surface profiling", "replica"],
    severity_base: 0.55,
    references: ["EPRI CS-3178", "ASME Paper 85-JPGC-PWR-28"]
  },
  {
    id: "pgn_lp_blade_pitting",
    name: "LP Blade Pitting and Corrosion Fatigue",
    category: "steam_turbine",
    description: "Pitting corrosion and corrosion fatigue cracking in LP turbine blades from wet steam chemistry upsets and phase transition zone deposits",
    keywords: ["pitting", "corrosion fatigue", "lp blade", "wet steam", "phase transition zone", "last stage"],
    materials: ["12cr steel", "17-4ph", "titanium"],
    components: ["lp blade", "last stage blade", "l-0 blade", "l-1 blade"],
    ndt_methods: ["FPI", "MPI", "visual", "EC"],
    severity_base: 0.7,
    references: ["EPRI 1013016", "EPRI TR-108943"]
  },

  // Wind Turbine
  {
    id: "pgn_blade_delamination",
    name: "Wind Turbine Blade Delamination",
    category: "wind_turbine",
    description: "Separation of composite laminate layers in wind turbine blades from manufacturing defects, fatigue, or moisture ingress",
    keywords: ["delamination", "blade", "wind", "composite", "fiberglass", "carbon fiber", "laminate"],
    materials: ["gfrp", "cfrp", "glass fiber", "carbon fiber", "epoxy", "polyester"],
    components: ["blade root", "spar cap", "trailing edge", "leading edge", "shear web"],
    ndt_methods: ["UT", "phased array UT", "tap test", "thermography", "acoustic emission"],
    severity_base: 0.7,
    references: ["IEC 61400-5", "DNV-ST-0376", "ASTM D5528"]
  },
  {
    id: "pgn_blade_erosion_wind",
    name: "Leading Edge Erosion",
    category: "wind_turbine",
    description: "Progressive material loss on blade leading edges from rain, hail, sand, and insect impact causing roughness and performance degradation",
    keywords: ["leading edge erosion", "rain erosion", "hail", "blade tip", "roughness", "lee"],
    materials: ["gelcoat", "polyurethane", "gfrp"],
    components: ["blade leading edge", "blade tip", "outer blade span"],
    ndt_methods: ["visual", "drone inspection", "surface profiling"],
    severity_base: 0.45,
    references: ["DNV-ST-0376", "IEC 61400-5", "Sandia SAND2019-1550"]
  },
  {
    id: "pgn_gearbox_fatigue",
    name: "Gearbox Bearing and Gear Tooth Fatigue",
    category: "wind_turbine",
    description: "Rolling contact fatigue, micropitting, and tooth root fatigue in wind turbine gearbox from variable loading and misalignment",
    keywords: ["gearbox", "bearing", "gear tooth", "micropitting", "spalling", "fatigue", "rcf"],
    materials: ["case hardened steel", "through hardened steel", "bearing steel"],
    components: ["planetary gear", "intermediate shaft", "high speed shaft", "main bearing"],
    ndt_methods: ["vibration analysis", "oil analysis", "borescope", "acoustic emission"],
    severity_base: 0.75,
    references: ["AGMA 6006-A03", "ISO 6336", "NREL/TP-5000-47681"]
  },

  // Boiler / HRSG
  {
    id: "pgn_boiler_tube_thinning",
    name: "Boiler Tube Wall Thinning (FAC/Erosion)",
    category: "boiler_hrsg",
    description: "Flow-accelerated corrosion and fly ash erosion causing progressive wall loss in boiler waterwall, economizer, and superheater tubes",
    keywords: ["wall thinning", "fac", "flow accelerated corrosion", "erosion", "boiler tube", "waterwall"],
    materials: ["carbon steel", "low alloy steel", "t11", "t22"],
    components: ["waterwall tube", "economizer tube", "superheater tube", "reheater tube"],
    ndt_methods: ["UT thickness", "EMAT", "phased array UT", "RT"],
    severity_base: 0.7,
    references: ["EPRI 1008082", "ASME Section I", "API 573"]
  },
  {
    id: "pgn_hydrogen_damage_boiler",
    name: "Hydrogen Damage (Boiler Tube)",
    category: "boiler_hrsg",
    description: "Intergranular micro-fissuring and decarburization from atomic hydrogen penetration in boiler tubes due to under-deposit corrosion",
    keywords: ["hydrogen damage", "under deposit", "decarburization", "micro fissure", "boiler"],
    materials: ["carbon steel", "low alloy steel"],
    components: ["waterwall tube", "high heat flux tube", "burner zone"],
    ndt_methods: ["UT shear wave", "metallography", "EMAT", "ultrasonic attenuation"],
    severity_base: 0.85,
    references: ["EPRI TR-102433", "ASME Section I", "NACE SP0590"]
  },
  {
    id: "pgn_superheater_creep",
    name: "Long-Term Overheating / Creep (Superheater/Reheater)",
    category: "boiler_hrsg",
    description: "Creep damage in superheater and reheater tubes from sustained operation at or above design temperature causing swelling and eventual rupture",
    keywords: ["creep", "overheating", "superheater", "reheater", "swelling", "long term"],
    materials: ["t22", "t91", "t11", "stainless steel", "tp304h", "tp347h"],
    components: ["superheater tube", "reheater tube", "outlet header", "stub tube"],
    ndt_methods: ["UT thickness", "replica metallography", "dimensional", "oxide scale UT"],
    severity_base: 0.8,
    references: ["EPRI CS-4774", "API 579-1 Part 10", "ASME Section I"]
  },
  {
    id: "pgn_hrsg_fac",
    name: "HRSG Flow-Accelerated Corrosion",
    category: "boiler_hrsg",
    description: "FAC in HRSG low pressure evaporator and economizer circuits from single-phase and two-phase flow causing wall loss",
    keywords: ["hrsg", "fac", "flow accelerated", "evaporator", "economizer", "combined cycle"],
    materials: ["carbon steel", "low alloy steel"],
    components: ["lp evaporator", "lp economizer", "ip evaporator", "feedwater piping"],
    ndt_methods: ["UT thickness grid", "EMAT", "RT"],
    severity_base: 0.7,
    references: ["EPRI 1008082", "EPRI 3002012944", "ASME Section I"]
  }
];

// ── COMPONENT TYPE REGISTRY ────────────────────────────────────────

var COMPONENT_TYPES = [
  {
    id: "gas_turbine_hot_section",
    name: "Gas Turbine Hot Section",
    description: "Combustors, transition pieces, first and second stage blades and vanes",
    interval_hours: 24000,
    interval_label: "Major inspection at 24,000 EOH or 900 starts",
    methods: ["borescope", "FPI", "EC", "dimensional", "CMM"],
    standards: ["GE TIL", "Siemens TN", "OEM service bulletin", "ASME PCC-3"],
    risk_factors: ["firing temperature", "fuel quality", "start count", "trip count"]
  },
  {
    id: "gas_turbine_compressor",
    name: "Gas Turbine Compressor",
    description: "Compressor blades, vanes, disc, and casing",
    interval_hours: 48000,
    interval_label: "Major at 48,000 EOH",
    methods: ["borescope", "FPI", "MPI", "EC", "visual"],
    standards: ["OEM service bulletin", "ASME PCC-3"],
    risk_factors: ["inlet filtration", "compressor washing", "FOD history"]
  },
  {
    id: "steam_turbine_hp_ip",
    name: "Steam Turbine HP/IP Section",
    description: "HP and IP rotors, blades, nozzles, diaphragms, and casings",
    interval_hours: 60000,
    interval_label: "Major at ~60,000 hours or 8-10 years",
    methods: ["UT", "MPI", "FPI", "phased array UT", "TOFD", "replica metallography"],
    standards: ["EPRI turbine inspection guidelines", "ASME Vol V", "OEM service bulletin"],
    risk_factors: ["steam chemistry", "cycling frequency", "operating hours", "material grade"]
  },
  {
    id: "steam_turbine_lp",
    name: "Steam Turbine LP Section",
    description: "LP rotor, last-stage blades, disc rim, blade attachments",
    interval_hours: 60000,
    interval_label: "Major at ~60,000 hours",
    methods: ["MPI", "FPI", "UT", "phased array UT", "visual"],
    standards: ["EPRI TR-104030", "ASME Vol V"],
    risk_factors: ["wet steam chemistry", "condenser leaks", "blade vibration", "dissolved oxygen"]
  },
  {
    id: "wind_turbine_blade",
    name: "Wind Turbine Blade",
    description: "Composite blade structure including spar cap, shear web, root, and trailing/leading edges",
    interval_hours: 8760,
    interval_label: "Annual external + 5-year internal",
    methods: ["visual", "drone", "UT", "tap test", "thermography", "acoustic emission"],
    standards: ["IEC 61400-5", "DNV-ST-0376", "GL guidelines"],
    risk_factors: ["lightning strikes", "leading edge protection", "age", "offshore environment"]
  },
  {
    id: "wind_turbine_drivetrain",
    name: "Wind Turbine Drivetrain",
    description: "Main bearing, gearbox, generator, main shaft",
    interval_hours: 8760,
    interval_label: "Annual CMS review + 5-year borescope",
    methods: ["vibration analysis", "oil analysis", "borescope", "acoustic emission", "thermography"],
    standards: ["AGMA 6006-A03", "ISO 10816", "IEC 61400-25"],
    risk_factors: ["turbulence class", "misalignment", "oil condition", "operating temperature"]
  },
  {
    id: "boiler_tube",
    name: "Boiler Tube (Waterwall/SH/RH/Econ)",
    description: "Pressure part tubing in waterwalls, superheaters, reheaters, and economizers",
    interval_hours: 17520,
    interval_label: "2-year outage cycle typical",
    methods: ["UT thickness", "EMAT", "RT", "visual", "replica metallography"],
    standards: ["ASME Section I", "EPRI boiler tube failure guidelines", "API 573"],
    risk_factors: ["water chemistry", "heat flux", "sootblower impingement", "tube temperature"]
  },
  {
    id: "hrsg_pressure_part",
    name: "HRSG Pressure Parts",
    description: "LP/IP/HP evaporator, economizer, superheater modules and headers",
    interval_hours: 17520,
    interval_label: "2-year outage + FAC monitoring",
    methods: ["UT thickness grid", "EMAT", "visual", "phased array UT"],
    standards: ["ASME Section I", "EPRI HRSG guidelines", "EPRI 3002012944"],
    risk_factors: ["cycling count", "water chemistry", "attemperator operation", "thermal transients"]
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

    // keyword match (20 pts each)
    for (var k = 0; k < mech.keywords.length; k++) {
      if (description.indexOf(mech.keywords[k]) !== -1) score += 20;
      if (component.indexOf(mech.keywords[k]) !== -1) score += 20;
    }

    // material match (15 pts each)
    for (var m = 0; m < mech.materials.length; m++) {
      if (material.indexOf(mech.materials[m]) !== -1) score += 15;
    }

    // component match (15 pts each)
    for (var c = 0; c < mech.components.length; c++) {
      if (component.indexOf(mech.components[c]) !== -1) score += 15;
      if (description.indexOf(mech.components[c]) !== -1) score += 10;
    }

    // category match (25 pts)
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

function getComponentType(component) {
  var comp = (component || "").toLowerCase();
  for (var i = 0; i < COMPONENT_TYPES.length; i++) {
    var ct = COMPONENT_TYPES[i];
    if (comp.indexOf(ct.id) !== -1) return ct;
    var nameLower = ct.name.toLowerCase();
    if (comp.indexOf(nameLower) !== -1) return ct;
    // partial match on keywords in description
    var descWords = ct.description.toLowerCase();
    var compWords = comp.split(" ");
    var matchCount = 0;
    for (var w = 0; w < compWords.length; w++) {
      if (compWords[w].length > 3 && descWords.indexOf(compWords[w]) !== -1) matchCount++;
    }
    if (matchCount >= 2) return ct;
  }
  return null;
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
          engine: "power-generation",
          deploy: "DEPLOY240",
          version: "1.0.0",
          total_mechanisms: DAMAGE_MECHANISMS.length,
          by_category: byCat,
          categories: ["gas_turbine", "steam_turbine", "wind_turbine", "boiler_hrsg"],
          component_types: COMPONENT_TYPES.length,
          mechanisms: DAMAGE_MECHANISMS.map(function(m) {
            return { id: m.id, name: m.name, category: m.category, severity_base: m.severity_base };
          }),
          components: COMPONENT_TYPES.map(function(c) {
            return { id: c.id, name: c.name, interval_label: c.interval_label };
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

    // ── get_inspection_requirements ──
    if (action === "get_inspection_requirements") {
      var compType = getComponentType(body.component_type || body.component || "");
      if (!compType) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            action: "get_inspection_requirements",
            error: "component_type_not_found",
            available_types: COMPONENT_TYPES.map(function(c) { return { id: c.id, name: c.name }; })
          })
        };
      }

      // find applicable mechanisms
      var applicableMechs = [];
      for (var mi = 0; mi < DAMAGE_MECHANISMS.length; mi++) {
        var dm = DAMAGE_MECHANISMS[mi];
        if (dm.category === compType.id.split("_").slice(0, -1).join("_") ||
            compType.description.toLowerCase().indexOf(dm.category.replace("_", " ")) !== -1) {
          applicableMechs.push({ id: dm.id, name: dm.name, severity_base: dm.severity_base });
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "get_inspection_requirements",
          component_type: compType,
          applicable_mechanisms: applicableMechs,
          inspection_program: {
            interval: compType.interval_label,
            methods: compType.methods,
            standards: compType.standards,
            risk_factors: compType.risk_factors
          }
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

      // identify mechanisms from case context
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

      // component type match
      var caseCompType = getComponentType(caseData.component_name || "");

      // power gen risk factors
      var riskFactors = [];
      if (caseMechs.length > 0 && caseMechs[0].mechanism.severity_base >= 0.8) {
        riskFactors.push("high_severity_mechanism_identified");
      }
      if (findings.length > 3) {
        riskFactors.push("multiple_findings");
      }
      if (caseMechs.length >= 3) {
        riskFactors.push("multiple_damage_mechanisms_active");
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
          component_type: caseCompType ? { id: caseCompType.id, name: caseCompType.name, interval: caseCompType.interval_label } : null,
          findings_count: findings.length,
          risk_factors: riskFactors,
          power_gen_recommendation: caseMechs.length > 0 ? (
            caseMechs[0].mechanism.severity_base >= 0.8 ? "immediate_engineering_review" :
            caseMechs[0].mechanism.severity_base >= 0.6 ? "schedule_follow_up_inspection" :
            "continue_monitoring"
          ) : "insufficient_data"
        })
      };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action, valid_actions: ["identify_damage", "assess_case", "get_inspection_requirements", "get_registry"] }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
