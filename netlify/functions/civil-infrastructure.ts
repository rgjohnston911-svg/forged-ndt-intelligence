// @ts-nocheck
/**
 * DEPLOY242 - civil-infrastructure.ts
 * netlify/functions/civil-infrastructure.ts
 *
 * CIVIL INFRASTRUCTURE INDUSTRY VERTICAL
 * Bridges, concrete structures, tunnels, dams, pipelines
 * AASHTO / ACI / FHWA / ASCE frameworks
 *
 * POST /api/civil-infrastructure { action, ... }
 *
 * Actions:
 *   identify_damage    - identify deterioration mechanisms
 *   assess_case        - full case assessment with civil context
 *   get_inspection_requirements - inspection intervals by structure type
 *   get_registry       - return full mechanism + structure registry
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

// ── DETERIORATION MECHANISM REGISTRY ───────────────────────────────

var DAMAGE_MECHANISMS = [
  // Concrete Deterioration
  {
    id: "civ_chloride_corrosion",
    name: "Chloride-Induced Reinforcement Corrosion",
    category: "concrete_deterioration",
    description: "Corrosion of reinforcing steel from chloride ion penetration (deicing salts or marine exposure) causing delamination, spalling, and section loss",
    keywords: ["chloride", "corrosion", "rebar", "reinforcement", "deicing", "salt", "delamination", "spalling"],
    materials: ["reinforced concrete", "prestressed concrete", "post-tensioned concrete"],
    components: ["bridge deck", "substructure", "pier cap", "abutment", "column", "parking garage"],
    ndt_methods: ["half-cell potential", "GPR", "chain drag", "impact echo", "chloride sampling"],
    severity_base: 0.75,
    references: ["ACI 222R", "AASHTO LRFD", "FHWA-RD-01-156", "ASTM C876"]
  },
  {
    id: "civ_carbonation",
    name: "Carbonation-Induced Corrosion",
    category: "concrete_deterioration",
    description: "Reduction of concrete alkalinity by atmospheric CO2 penetration lowering pH below 9.5 and depassivating reinforcing steel",
    keywords: ["carbonation", "co2", "ph", "depassivation", "alkalinity", "cover"],
    materials: ["reinforced concrete", "precast concrete"],
    components: ["building column", "beam", "slab", "wall", "facade", "retaining wall"],
    ndt_methods: ["phenolphthalein test", "cover meter", "carbonation depth", "half-cell"],
    severity_base: 0.55,
    references: ["ACI 201.2R", "EN 14630", "fib Model Code 2010"]
  },
  {
    id: "civ_asr",
    name: "Alkali-Silica Reaction (ASR)",
    category: "concrete_deterioration",
    description: "Internal expansion from reaction between alkali hydroxides in cement and reactive silica in aggregates causing map cracking and structural distress",
    keywords: ["asr", "alkali silica", "map cracking", "gel", "expansion", "reactive aggregate"],
    materials: ["concrete with reactive aggregate"],
    components: ["dam", "bridge pier", "foundation", "pavement", "barrier wall"],
    ndt_methods: ["visual", "core analysis", "petrography", "expansion monitoring", "DRI"],
    severity_base: 0.7,
    references: ["ACI 221.1R", "FHWA-HIF-09-004", "AASHTO R 80", "CSA A864"]
  },
  {
    id: "civ_freeze_thaw",
    name: "Freeze-Thaw Deterioration",
    category: "concrete_deterioration",
    description: "Progressive scaling, cracking, and disintegration of concrete from cyclic freezing and thawing of absorbed water in inadequately air-entrained concrete",
    keywords: ["freeze thaw", "scaling", "frost", "air entrainment", "d-cracking", "popout"],
    materials: ["concrete", "non-air-entrained concrete"],
    components: ["bridge deck", "barrier", "curb", "sidewalk", "retaining wall", "pavement"],
    ndt_methods: ["visual", "impact echo", "UPV", "core analysis"],
    severity_base: 0.55,
    references: ["ACI 201.2R", "ASTM C666", "AASHTO T 161"]
  },
  {
    id: "civ_sulfate_attack",
    name: "External Sulfate Attack",
    category: "concrete_deterioration",
    description: "Chemical attack from sulfate-bearing soils or groundwater causing ettringite and gypsum formation leading to expansion and deterioration",
    keywords: ["sulfate attack", "ettringite", "thaumasite", "groundwater", "soil", "expansion"],
    materials: ["concrete", "non-sulfate-resistant concrete"],
    components: ["foundation", "footing", "pile cap", "buried structure", "tunnel lining"],
    ndt_methods: ["core analysis", "sulfate content test", "petrography", "visual"],
    severity_base: 0.6,
    references: ["ACI 201.2R", "ACI 318", "ASTM C1012"]
  },

  // Steel Structure
  {
    id: "civ_fatigue_steel_bridge",
    name: "Fatigue Cracking (Steel Bridge Details)",
    category: "steel_structure",
    description: "Fatigue crack growth at welded details, coverplate terminations, web gaps, and connection plates from cyclic traffic loading",
    keywords: ["fatigue", "cracking", "weld", "coverplate", "web gap", "detail category", "out of plane"],
    materials: ["structural steel", "weathering steel", "a588", "a709"],
    components: ["girder", "floorbeam", "connection plate", "coverplate", "stiffener", "diaphragm"],
    ndt_methods: ["visual", "MPI", "UT", "ACFM", "dye penetrant"],
    severity_base: 0.85,
    references: ["AASHTO LRFD Bridge Design", "FHWA-IF-12-052", "AWS D1.5", "AREMA Ch.15"]
  },
  {
    id: "civ_section_loss_steel",
    name: "Corrosion Section Loss (Steel Bridge)",
    category: "steel_structure",
    description: "General and localized corrosion causing section loss in steel bridge members particularly at drainage paths, bearing areas, and pack rust locations",
    keywords: ["corrosion", "section loss", "rust", "pack rust", "bearing", "drainage", "weathering steel"],
    materials: ["structural steel", "weathering steel", "painted steel"],
    components: ["web", "bottom flange", "bearing area", "fascia girder", "pin", "gusset plate"],
    ndt_methods: ["UT thickness", "visual", "pit depth", "3D scanning"],
    severity_base: 0.7,
    references: ["AASHTO Manual for Bridge Evaluation", "FHWA-HIF-11-004", "NSBA"]
  },
  {
    id: "civ_gusset_plate",
    name: "Gusset Plate Distress",
    category: "steel_structure",
    description: "Buckling, yielding, or fracture of truss gusset plates from inadequate design capacity, corrosion section loss, or load path eccentricity",
    keywords: ["gusset", "plate", "truss", "buckling", "yielding", "i-35w", "load rating"],
    materials: ["structural steel"],
    components: ["gusset plate", "truss node", "truss connection"],
    ndt_methods: ["visual", "UT thickness", "3D scanning", "load rating analysis"],
    severity_base: 0.9,
    references: ["FHWA-IF-09-014", "AASHTO MBE", "NCHRP Report 197"]
  },

  // Prestressed Concrete
  {
    id: "civ_tendon_corrosion",
    name: "Post-Tensioning Tendon Corrosion",
    category: "prestressed_concrete",
    description: "Corrosion of post-tensioning strands from grout voids, bleed water, chloride contamination, or environmental exposure at anchorage zones",
    keywords: ["tendon", "post-tension", "strand", "grout void", "anchorage", "bleed water", "pt"],
    materials: ["prestressing strand", "high strength steel", "grout"],
    components: ["internal tendon", "external tendon", "anchorage", "deviator", "blister"],
    ndt_methods: ["magnetic flux leakage", "impact echo", "GPR", "borescope", "radiography"],
    severity_base: 0.9,
    references: ["FHWA-HRT-13-027", "PTI M55", "ACI 423.4R", "NCHRP Report 654"]
  },
  {
    id: "civ_wire_break",
    name: "Prestressing Wire/Strand Break",
    category: "prestressed_concrete",
    description: "Fracture of individual prestressing wires or strands from corrosion, hydrogen embrittlement, or stress corrosion cracking causing loss of prestress force",
    keywords: ["wire break", "strand break", "prestress loss", "hydrogen embrittlement", "scc"],
    materials: ["prestressing wire", "7-wire strand", "high strength steel"],
    components: ["pretensioned beam", "box girder", "cylinder pipe", "tank"],
    ndt_methods: ["acoustic emission", "magnetic flux", "impact echo", "visual"],
    severity_base: 0.85,
    references: ["ACI 222.2R", "FHWA-RD-01-160", "PTI DC80.3"]
  },

  // Substructure / Geotechnical
  {
    id: "civ_scour_bridge",
    name: "Bridge Foundation Scour",
    category: "substructure",
    description: "Erosion of streambed material around bridge piers and abutments from flowing water reducing foundation bearing capacity and stability",
    keywords: ["scour", "erosion", "pier", "abutment", "streambed", "flood", "contraction", "local"],
    materials: ["riverbed", "alluvial soil"],
    components: ["pier foundation", "abutment foundation", "pile", "spread footing", "cofferdam"],
    ndt_methods: ["sonar", "bathymetry", "diving inspection", "GPR", "tilt monitoring"],
    severity_base: 0.9,
    references: ["FHWA-HIF-12-003 HEC-18", "AASHTO HEC-20", "NCHRP Report 396"]
  },
  {
    id: "civ_settlement",
    name: "Foundation Settlement and Movement",
    category: "substructure",
    description: "Differential settlement, lateral movement, or rotation of foundations from consolidation, slope instability, or seismic displacement",
    keywords: ["settlement", "differential", "movement", "tilt", "rotation", "slope", "lateral"],
    materials: ["soil", "rock", "concrete foundation"],
    components: ["abutment", "pier", "retaining wall", "embankment", "pile group"],
    ndt_methods: ["survey monitoring", "inclinometer", "tilt meter", "SAR InSAR", "GPS"],
    severity_base: 0.75,
    references: ["AASHTO LRFD", "FHWA-NHI-06-089", "NCHRP Report 651"]
  },

  // Tunnel
  {
    id: "civ_tunnel_lining_distress",
    name: "Tunnel Lining Deterioration",
    category: "tunnel",
    description: "Cracking, spalling, delamination, and water ingress in tunnel linings from ground pressure, chemical attack, fire damage, or aging",
    keywords: ["tunnel", "lining", "spalling", "leakage", "ingress", "ring", "segment"],
    materials: ["cast-in-place concrete", "precast segment", "shotcrete", "cast iron", "steel liner"],
    components: ["tunnel lining", "crown", "invert", "sidewall", "portal", "ventilation shaft"],
    ndt_methods: ["GPR", "impact echo", "visual", "chain drag", "thermography", "laser scanning"],
    severity_base: 0.75,
    references: ["FHWA-HIF-15-005", "AASHTO tunnel inspection manual", "ITA guidelines"]
  },

  // Dam
  {
    id: "civ_dam_seepage",
    name: "Dam Seepage and Internal Erosion",
    category: "dam",
    description: "Uncontrolled water seepage through dam body or foundation causing internal erosion, piping, and potential progressive failure",
    keywords: ["seepage", "piping", "internal erosion", "dam", "embankment", "foundation drain"],
    materials: ["earthfill", "rockfill", "concrete"],
    components: ["dam body", "foundation", "abutment", "spillway", "outlet works"],
    ndt_methods: ["seepage monitoring", "piezometer", "self-potential", "resistivity", "visual"],
    severity_base: 0.95,
    references: ["FEMA P-1025", "USACE EM 1110-2-1901", "ICOLD Bulletin 164"]
  }
];

// ── STRUCTURE TYPE REGISTRY ────────────────────────────────────────

var STRUCTURE_TYPES = [
  {
    id: "highway_bridge",
    name: "Highway Bridge",
    description: "Steel, concrete, and prestressed concrete highway bridges",
    inspection_interval: "24 months routine, 48/60 months in-depth per element",
    inspection_standard: "FHWA NBIS (23 CFR 650)",
    methods: ["visual", "chain drag", "UT", "MPI", "GPR", "half-cell", "load testing"],
    rating_system: "NBI condition rating (0-9) and element-level (AASHTO CoRe)",
    risk_factors: ["ADT", "truck traffic", "age", "material", "environment", "scour critical"]
  },
  {
    id: "railroad_bridge",
    name: "Railroad Bridge",
    description: "Steel and timber railroad bridges and trestles",
    inspection_interval: "12 months per FRA (49 CFR 237)",
    inspection_standard: "FRA Bridge Safety Standards, AREMA Manual",
    methods: ["visual", "MPI", "UT", "timber coring", "load rating"],
    rating_system: "FRA condition rating",
    risk_factors: ["tonnage", "train speed", "age", "material", "flooding"]
  },
  {
    id: "concrete_building",
    name: "Concrete Building / Parking Structure",
    description: "Reinforced and post-tensioned concrete buildings and parking garages",
    inspection_interval: "Condition-based (ACI 562), typically 3-5 years for parking",
    inspection_standard: "ACI 562, IBC, local code",
    methods: ["visual", "chain drag", "GPR", "half-cell", "core testing", "load testing"],
    rating_system: "ACI condition assessment",
    risk_factors: ["age", "exposure", "deicing salt use", "waterproofing condition", "load"]
  },
  {
    id: "tunnel_structure",
    name: "Tunnel",
    description: "Highway, railroad, and transit tunnels with various lining systems",
    inspection_interval: "24 months per FHWA NTIS",
    inspection_standard: "FHWA-HIF-15-005, AASHTO Tunnel Inspection Manual",
    methods: ["visual", "GPR", "chain drag", "impact echo", "laser scanning", "thermography"],
    rating_system: "FHWA tunnel element condition states",
    risk_factors: ["age", "ground conditions", "water table", "traffic", "fire events"]
  },
  {
    id: "dam_structure",
    name: "Dam",
    description: "Concrete, earthfill, and rockfill dams including spillways and outlet works",
    inspection_interval: "Annual (FERC), 5-year comprehensive (Part 12D)",
    inspection_standard: "FERC Engineering Guidelines, FEMA P-93, USACE ER 1110-2-1156",
    methods: ["visual", "seepage monitoring", "survey", "piezometer", "resistivity", "sonar"],
    rating_system: "Dam hazard classification (high/significant/low), DSAC rating",
    risk_factors: ["hazard class", "age", "seismic zone", "spillway capacity", "instrumentation"]
  },
  {
    id: "pipeline_infrastructure",
    name: "Buried Pipeline (Water/Sewer/Gas)",
    description: "Municipal water, wastewater, and gas distribution pipelines",
    inspection_interval: "Risk-based, NASSCO PACP for sewer, AWWA for water",
    inspection_standard: "NASSCO PACP/MACP, AWWA M28, PHMSA 49 CFR 192",
    methods: ["CCTV", "sonar", "LIDAR", "smart pig", "leak detection", "DCVG/CIPS"],
    rating_system: "NASSCO defect grading (1-5), AWWA condition assessment",
    risk_factors: ["material", "age", "soil conditions", "pipe diameter", "pressure", "criticality"]
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
          engine: "civil-infrastructure",
          deploy: "DEPLOY242",
          version: "1.0.0",
          total_mechanisms: DAMAGE_MECHANISMS.length,
          by_category: byCat,
          categories: ["concrete_deterioration", "steel_structure", "prestressed_concrete", "substructure", "tunnel", "dam"],
          structure_types: STRUCTURE_TYPES.length,
          mechanisms: DAMAGE_MECHANISMS.map(function(m) {
            return { id: m.id, name: m.name, category: m.category, severity_base: m.severity_base };
          }),
          structures: STRUCTURE_TYPES.map(function(s) {
            return { id: s.id, name: s.name, inspection_interval: s.inspection_interval };
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
      var structType = (body.structure_type || "").toLowerCase();
      var matched = null;
      for (var si = 0; si < STRUCTURE_TYPES.length; si++) {
        if (structType.indexOf(STRUCTURE_TYPES[si].id) !== -1 ||
            STRUCTURE_TYPES[si].name.toLowerCase().indexOf(structType) !== -1 ||
            (structType && STRUCTURE_TYPES[si].description.toLowerCase().indexOf(structType) !== -1)) {
          matched = STRUCTURE_TYPES[si];
          break;
        }
      }

      if (!matched && structType) {
        // fuzzy match
        for (var fi = 0; fi < STRUCTURE_TYPES.length; fi++) {
          var words = structType.split(" ");
          var hits = 0;
          for (var w = 0; w < words.length; w++) {
            if (words[w].length > 3 && STRUCTURE_TYPES[fi].description.toLowerCase().indexOf(words[w]) !== -1) hits++;
          }
          if (hits >= 1) { matched = STRUCTURE_TYPES[fi]; break; }
        }
      }

      if (!matched) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            action: "get_inspection_requirements",
            error: "structure_type_not_found",
            available_types: STRUCTURE_TYPES.map(function(s) { return { id: s.id, name: s.name }; })
          })
        };
      }

      // relevant mechanisms
      var relMechs = [];
      for (var ri = 0; ri < DAMAGE_MECHANISMS.length; ri++) {
        var dm = DAMAGE_MECHANISMS[ri];
        // check if any component keywords overlap with structure description
        var overlap = false;
        for (var ci = 0; ci < dm.components.length; ci++) {
          if (matched.description.toLowerCase().indexOf(dm.components[ci].split(" ")[0]) !== -1) {
            overlap = true;
            break;
          }
        }
        if (overlap) {
          relMechs.push({ id: dm.id, name: dm.name, severity_base: dm.severity_base });
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "get_inspection_requirements",
          structure_type: matched,
          applicable_mechanisms: relMechs,
          inspection_program: {
            interval: matched.inspection_interval,
            standard: matched.inspection_standard,
            methods: matched.methods,
            rating_system: matched.rating_system,
            risk_factors: matched.risk_factors
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

      // civil infrastructure risk flags
      var riskFlags = [];
      if (caseMechs.length > 0 && caseMechs[0].mechanism.severity_base >= 0.85) {
        riskFlags.push("critical_severity_mechanism");
      }
      if (caseMechs.some(function(m) { return m.mechanism.id === "civ_scour_bridge"; })) {
        riskFlags.push("scour_critical");
      }
      if (caseMechs.some(function(m) { return m.mechanism.id === "civ_tendon_corrosion" || m.mechanism.id === "civ_wire_break"; })) {
        riskFlags.push("prestress_system_at_risk");
      }
      if (caseMechs.some(function(m) { return m.mechanism.id === "civ_dam_seepage"; })) {
        riskFlags.push("dam_safety_concern");
      }
      if (caseMechs.some(function(m) { return m.mechanism.id === "civ_gusset_plate"; })) {
        riskFlags.push("fracture_critical_member");
      }
      if (findings.length > 3) {
        riskFlags.push("multiple_findings");
      }

      // NBI-style condition assessment
      var conditionRating = 6; // default "satisfactory"
      if (caseMechs.length > 0) {
        var topSev = caseMechs[0].mechanism.severity_base;
        if (topSev >= 0.9) conditionRating = 3; // "serious"
        else if (topSev >= 0.8) conditionRating = 4; // "poor"
        else if (topSev >= 0.7) conditionRating = 5; // "fair"
        else conditionRating = 6; // "satisfactory"
      }
      if (riskFlags.length >= 3) conditionRating = Math.min(conditionRating, 3);

      var conditionLabels = { 9: "excellent", 8: "very_good", 7: "good", 6: "satisfactory", 5: "fair", 4: "poor", 3: "serious", 2: "critical", 1: "imminent_failure", 0: "failed" };

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
          condition_assessment: {
            nbi_rating: conditionRating,
            condition_label: conditionLabels[conditionRating] || "unknown",
            scale: "NBI 0-9 (9=excellent, 0=failed)"
          },
          civil_recommendation: conditionRating <= 3 ? "immediate_load_posting_or_closure_evaluation" :
            conditionRating <= 4 ? "priority_repair_and_increased_inspection_frequency" :
            conditionRating <= 5 ? "schedule_rehabilitation_within_planning_cycle" :
            "continue_routine_inspection"
        })
      };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action, valid_actions: ["identify_damage", "assess_case", "get_inspection_requirements", "get_registry"] }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
