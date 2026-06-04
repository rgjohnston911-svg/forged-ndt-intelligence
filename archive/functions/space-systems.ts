// @ts-nocheck
/**
 * DEPLOY243 - space-systems.ts
 * netlify/functions/space-systems.ts
 *
 * SPACE SYSTEMS INDUSTRY VERTICAL
 * Launch vehicles, spacecraft, satellites, ground support equipment
 * NASA / ESA / ECSS / MIL-STD frameworks
 *
 * POST /api/space-systems { action, ... }
 *
 * Actions:
 *   identify_damage    - identify damage/degradation mechanisms
 *   assess_case        - full case assessment with space systems context
 *   get_inspection_requirements - inspection requirements by system type
 *   get_registry       - return full mechanism + system registry
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
  // Thermal Protection
  {
    id: "spc_tps_degradation",
    name: "Thermal Protection System (TPS) Degradation",
    category: "thermal_protection",
    description: "Ablation, erosion, tile cracking, and gap filler displacement in thermal protection systems from re-entry heating, micrometeoroid impact, and launch vibration",
    keywords: ["tps", "thermal protection", "heat shield", "ablation", "tile", "gap filler", "re-entry"],
    materials: ["reinforced carbon-carbon", "silica tile", "pica", "avcoat", "nextel", "sip"],
    components: ["heat shield", "leading edge", "nose cap", "tile acreage", "blanket insulation"],
    ndt_methods: ["thermography", "laser scanning", "UT", "visual", "tap test", "CT"],
    severity_base: 0.95,
    references: ["NASA-STD-5009", "NASA-HDBK-5010", "ECSS-E-ST-32-10C"]
  },
  {
    id: "spc_cryogenic_embrittlement",
    name: "Cryogenic Embrittlement and Thermal Cycling",
    category: "propulsion",
    description: "Material embrittlement and micro-cracking from exposure to cryogenic propellants (LH2 at -253C, LOX at -183C) and repeated thermal cycling between ambient and cryo temperatures",
    keywords: ["cryogenic", "embrittlement", "thermal cycling", "lh2", "lox", "propellant", "cryo"],
    materials: ["aluminum 2195", "aluminum 2219", "inconel 718", "stainless 316l", "invar"],
    components: ["propellant tank", "feedline", "valve body", "turbopump housing", "insulation"],
    ndt_methods: ["UT", "leak testing", "acoustic emission", "dye penetrant", "proof test"],
    severity_base: 0.85,
    references: ["NASA-STD-5019", "ECSS-E-ST-32C", "MIL-STD-1522"]
  },
  {
    id: "spc_hydrogen_embrittlement_space",
    name: "Hydrogen Environment Embrittlement (HEE)",
    category: "propulsion",
    description: "Degradation of metallic components exposed to gaseous or liquid hydrogen causing reduced ductility, subcritical crack growth, and premature fracture",
    keywords: ["hydrogen embrittlement", "hee", "gaseous hydrogen", "liquid hydrogen", "ductility"],
    materials: ["inconel 718", "a286", "titanium", "high strength steel", "waspaloy"],
    components: ["turbopump", "main engine", "hydrogen valve", "feedline", "injector"],
    ndt_methods: ["UT", "FPI", "proof test", "acoustic emission", "fracture mechanics analysis"],
    severity_base: 0.9,
    references: ["NASA-TM-1999-209163", "ASTM G142", "NASA MSFC-STD-3029"]
  },
  {
    id: "spc_combustion_damage",
    name: "Combustion Chamber / Nozzle Erosion",
    category: "propulsion",
    description: "Thermal erosion, hot gas wall thinning, and channel wall cracking in rocket engine combustion chambers and nozzle throats from extreme temperature and pressure",
    keywords: ["combustion", "nozzle", "erosion", "hot gas", "throat", "channel wall", "blanching"],
    materials: ["narloy-z", "copper alloy", "niobium c103", "rhenium", "iridium", "carbon-carbon"],
    components: ["combustion chamber", "nozzle throat", "nozzle extension", "injector face", "channel wall"],
    ndt_methods: ["borescope", "dimensional", "CT", "metallography", "thermography"],
    severity_base: 0.85,
    references: ["NASA SP-8089", "NASA-STD-5009", "JANNAF guidelines"]
  },

  // Structural
  {
    id: "spc_fatigue_launch_loads",
    name: "Launch Vibration and Acoustic Fatigue",
    category: "structural",
    description: "Fatigue damage in spacecraft structure from launch vibration, acoustic loads, transient events, and random vibration during ascent",
    keywords: ["vibration", "acoustic", "launch loads", "random vibration", "fatigue", "transient"],
    materials: ["aluminum", "titanium", "cfrp", "honeycomb panel"],
    components: ["payload adapter", "strut", "bracket", "equipment panel", "solar array hinge"],
    ndt_methods: ["visual", "FPI", "UT", "CT", "modal analysis", "accelerometer data review"],
    severity_base: 0.7,
    references: ["NASA-STD-5001", "NASA-HDBK-7005", "ECSS-E-ST-10-03C"]
  },
  {
    id: "spc_composite_overwrap",
    name: "Composite Overwrapped Pressure Vessel (COPV) Degradation",
    category: "structural",
    description: "Stress rupture, impact damage, and fiber degradation in COPVs used for pressurant storage from sustained loading, thermal cycling, and environmental exposure",
    keywords: ["copv", "pressure vessel", "composite overwrap", "stress rupture", "pressurant", "helium tank"],
    materials: ["carbon fiber", "kevlar", "glass fiber", "titanium liner", "inconel liner"],
    components: ["helium pressurant tank", "nitrogen tank", "copv", "oxygen tank"],
    ndt_methods: ["acoustic emission", "visual", "proof test", "laser shearography", "CT"],
    severity_base: 0.9,
    references: ["NASA-STD-6016", "AIAA S-081B", "ANSI/AIAA S-080"]
  },

  // On-Orbit Degradation
  {
    id: "spc_mmod_impact",
    name: "Micrometeoroid and Orbital Debris (MMOD) Impact",
    category: "on_orbit",
    description: "Hypervelocity impact damage from micrometeoroids and orbital debris causing penetration, spallation, and secondary debris generation in spacecraft surfaces",
    keywords: ["mmod", "micrometeoroid", "orbital debris", "hypervelocity", "impact", "penetration", "whipple"],
    materials: ["aluminum", "nextel", "kevlar", "mli", "glass"],
    components: ["pressure shell", "radiator panel", "solar array", "window", "shielding"],
    ndt_methods: ["visual", "leak detection", "photography", "laser scanning"],
    severity_base: 0.85,
    references: ["NASA-STD-8719.14", "NASA-TM-2009-214785", "IADC guidelines"]
  },
  {
    id: "spc_atomic_oxygen",
    name: "Atomic Oxygen Erosion (LEO)",
    category: "on_orbit",
    description: "Surface erosion and mass loss of spacecraft materials in low Earth orbit from highly reactive atomic oxygen flux degrading polymers, composites, and thin films",
    keywords: ["atomic oxygen", "ao", "erosion", "leo", "ram direction", "mass loss", "fluence"],
    materials: ["kapton", "teflon", "silver", "osmium", "carbon fiber", "silicone"],
    components: ["solar array blanket", "thermal blanket", "antenna", "tether", "ram surface"],
    ndt_methods: ["visual", "mass measurement", "reflectance measurement", "photography"],
    severity_base: 0.6,
    references: ["NASA-TM-2014-218415", "ASTM E2089", "ECSS-Q-ST-70-04C"]
  },
  {
    id: "spc_radiation_damage",
    name: "Radiation Degradation",
    category: "on_orbit",
    description: "Degradation of electronics, solar cells, and optical components from trapped radiation belts, solar particle events, and galactic cosmic rays",
    keywords: ["radiation", "total ionizing dose", "displacement damage", "single event", "solar cell", "degradation"],
    materials: ["silicon", "gallium arsenide", "optical glass", "polymer"],
    components: ["solar cell", "electronic box", "sensor", "optical element", "cable insulation"],
    ndt_methods: ["electrical testing", "performance trending", "dosimetry", "bit error monitoring"],
    severity_base: 0.65,
    references: ["NASA-HDBK-4002A", "ECSS-E-ST-10-12C", "MIL-STD-883 TM 1019"]
  },
  {
    id: "spc_thermal_distortion",
    name: "On-Orbit Thermal Distortion and Fatigue",
    category: "on_orbit",
    description: "Structural distortion and fatigue from extreme thermal cycling in orbit (e.g., -150C to +150C every 90 minutes in LEO) causing joint loosening and material fatigue",
    keywords: ["thermal distortion", "thermal cycling", "orbit", "hot cold", "joint loosening", "deployment"],
    materials: ["aluminum", "cfrp", "invar", "titanium", "mli"],
    components: ["solar array", "antenna boom", "truss structure", "mechanism", "deployment hinge"],
    ndt_methods: ["performance monitoring", "alignment check", "thermography", "visual"],
    severity_base: 0.6,
    references: ["NASA-STD-5001", "ECSS-E-ST-32-01C", "AIAA-2004-1908"]
  },

  // Ground Support
  {
    id: "spc_ground_corrosion",
    name: "Launch Pad / Ground Support Corrosion",
    category: "ground_support",
    description: "Severe corrosion of launch pad steel structure and ground support equipment from rocket exhaust products (HCl from SRBs), coastal marine environment, and deluge water",
    keywords: ["launch pad", "ground support", "corrosion", "hcl", "exhaust", "flame trench", "gse"],
    materials: ["carbon steel", "stainless steel", "concrete", "refractory"],
    components: ["launch tower", "flame trench", "sound suppression", "umbilical", "mobile launcher"],
    ndt_methods: ["UT thickness", "visual", "MPI", "concrete GPR", "coating inspection"],
    severity_base: 0.65,
    references: ["NASA-STD-5020", "KSC-STD-Z-0004", "NACE SP0198"]
  }
];

// ── SYSTEM TYPE REGISTRY ───────────────────────────────────────────

var SYSTEM_TYPES = [
  {
    id: "launch_vehicle",
    name: "Launch Vehicle",
    description: "Expendable and reusable launch vehicles including stages, fairings, and interstage structures",
    inspection_approach: "Pre-flight acceptance, post-flight (reusable), and manufacturing inspection",
    standards: ["NASA-STD-5009", "NASA-STD-5019", "ECSS-E-ST-32C", "FAA 14 CFR 450"],
    methods: ["UT", "RT/CT", "FPI", "proof test", "leak test", "acoustic emission", "visual"],
    risk_factors: ["flight heritage", "reuse count", "propellant type", "max-Q loads", "thermal environment"]
  },
  {
    id: "spacecraft_crewed",
    name: "Crewed Spacecraft",
    description: "Human-rated spacecraft including capsules, modules, and life support systems",
    inspection_approach: "Fracture control (NASA-STD-5019), safe-life/fail-safe, human rating requirements",
    standards: ["NASA-STD-5001", "NASA-STD-5019", "NPR 8705.2", "ECSS-E-ST-32C"],
    methods: ["UT", "RT/CT", "FPI", "proof test", "leak test", "NDE of every critical weld"],
    risk_factors: ["crew safety", "abort capability", "ECLSS reliability", "MMOD protection", "reuse"]
  },
  {
    id: "satellite",
    name: "Satellite / Uncrewed Spacecraft",
    description: "Communication, Earth observation, navigation, and science satellites",
    inspection_approach: "Manufacturing NDE, pre-launch environmental testing, on-orbit health monitoring",
    standards: ["NASA-STD-5001", "ECSS-E-ST-10-03C", "ECSS-Q-ST-20C", "MIL-STD-1540"],
    methods: ["visual", "UT", "CT", "vibration test", "thermal vacuum test", "acoustic test"],
    risk_factors: ["mission duration", "orbit environment", "radiation dose", "thermal cycling count"]
  },
  {
    id: "rocket_engine",
    name: "Rocket Engine / Propulsion System",
    description: "Liquid and solid rocket engines, thrusters, tanks, and feed systems",
    inspection_approach: "Hot-fire acceptance, inter-flight inspection (reusable), fracture mechanics life analysis",
    standards: ["NASA SP-8089", "NASA-STD-5009", "JANNAF", "ECSS-E-ST-35C"],
    methods: ["borescope", "FPI", "UT", "CT", "dimensional", "metallography", "proof test"],
    risk_factors: ["hot-fire count", "mixture ratio", "chamber pressure", "start/shutdown transients"]
  },
  {
    id: "ground_support_equipment",
    name: "Ground Support Equipment (GSE) and Launch Infrastructure",
    description: "Launch pads, mobile launchers, cranes, fluid systems, and integration facilities",
    inspection_approach: "Periodic structural inspection, corrosion control, pressure system certification",
    standards: ["NASA-STD-5020", "OSHA 1910/1926", "ASME B31.3", "AWS D1.1"],
    methods: ["UT", "MPI", "visual", "proof test", "coating inspection", "load test"],
    risk_factors: ["coastal environment", "exhaust exposure", "age", "operational tempo"]
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
          engine: "space-systems",
          deploy: "DEPLOY243",
          version: "1.0.0",
          total_mechanisms: DAMAGE_MECHANISMS.length,
          by_category: byCat,
          categories: ["thermal_protection", "propulsion", "structural", "on_orbit", "ground_support"],
          system_types: SYSTEM_TYPES.length,
          mechanisms: DAMAGE_MECHANISMS.map(function(m) {
            return { id: m.id, name: m.name, category: m.category, severity_base: m.severity_base };
          }),
          systems: SYSTEM_TYPES.map(function(s) {
            return { id: s.id, name: s.name };
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
      var sysType = (body.system_type || "").toLowerCase();
      var matched = null;
      for (var si = 0; si < SYSTEM_TYPES.length; si++) {
        if (sysType.indexOf(SYSTEM_TYPES[si].id) !== -1 ||
            SYSTEM_TYPES[si].name.toLowerCase().indexOf(sysType) !== -1) {
          matched = SYSTEM_TYPES[si];
          break;
        }
      }

      if (!matched && sysType) {
        for (var fi = 0; fi < SYSTEM_TYPES.length; fi++) {
          if (SYSTEM_TYPES[fi].description.toLowerCase().indexOf(sysType) !== -1) {
            matched = SYSTEM_TYPES[fi];
            break;
          }
        }
      }

      if (!matched) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            action: "get_inspection_requirements",
            error: "system_type_not_found",
            available_types: SYSTEM_TYPES.map(function(s) { return { id: s.id, name: s.name }; })
          })
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "get_inspection_requirements",
          system_type: matched
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
      for (var fii = 0; fii < findings.length; fii++) {
        caseDesc += " " + (findings[fii].description || "") + " " + (findings[fii].severity || "");
      }

      var caseMechs = matchMechanisms({
        description: caseDesc,
        material: body.material || "",
        component: caseData.component_name || "",
        category: body.category || ""
      });

      // space systems criticality assessment
      var critFlags = [];
      if (caseMechs.length > 0 && caseMechs[0].mechanism.severity_base >= 0.9) {
        critFlags.push("mission_critical_mechanism");
      }
      if (caseMechs.some(function(m) { return m.mechanism.id === "spc_tps_degradation"; })) {
        critFlags.push("crew_safety_tps");
      }
      if (caseMechs.some(function(m) { return m.mechanism.id === "spc_composite_overwrap"; })) {
        critFlags.push("catastrophic_failure_potential");
      }
      if (caseMechs.some(function(m) { return m.mechanism.category === "propulsion"; })) {
        critFlags.push("propulsion_system_integrity");
      }
      if (findings.length > 2) {
        critFlags.push("multiple_findings");
      }

      // NASA fracture control classification
      var fractureClass = "standard";
      if (critFlags.indexOf("crew_safety_tps") !== -1 || critFlags.indexOf("catastrophic_failure_potential") !== -1) {
        fractureClass = "fracture_critical";
      } else if (caseMechs.length > 0 && caseMechs[0].mechanism.severity_base >= 0.8) {
        fractureClass = "mission_critical";
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
          criticality_flags: critFlags,
          fracture_control_class: fractureClass,
          space_recommendation: fractureClass === "fracture_critical" ? "hold_for_fracture_control_board_review" :
            fractureClass === "mission_critical" ? "engineering_disposition_required_before_flight" :
            caseMechs.length > 0 ? "document_and_track_per_nde_requirements" :
            "insufficient_data"
        })
      };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action, valid_actions: ["identify_damage", "assess_case", "get_inspection_requirements", "get_registry"] }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
