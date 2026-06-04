// netlify/functions/api-standards-authority.js
// FORGED NDT Intelligence OS - API Standards Authority Engine
// Version: v1.0.0
// Purpose: Centralized standards resolution engine that any other engine
//          can query. Returns the complete applicable code stack with
//          section references, applicability notes, and inspection
//          requirements for any combination of domain, equipment type,
//          damage mechanism, and service conditions.
//
// Pure JavaScript only: no TypeScript, no template literals, var only,
// string concatenation only, module.exports pattern.
//
// I/O Contract
// ------------
// INPUT (event.body JSON):
//   {
//     domain: "fixed",
//     equipment_type: "pressure_vessel",
//     damage_mechanism: "CUI",
//     service_conditions: {
//       temperature: 275,
//       pressure: 150,
//       fluid: "steam",
//       h2s_service: false,
//       hydrogen_service: false,
//       cyclic_service: false,
//       high_energy: false
//     },
//     query_context: "rbi"  // optional: rbi | ffs | inspection | welding | all
//   }
//
// OUTPUT (200 JSON):
//   {
//     primary_inspection_code: {...},
//     applicable_standards: [...],
//     damage_mechanism_standards: [...],
//     service_condition_standards: [...],
//     ffs_standards: [...],
//     inspection_requirements: {...},
//     version: "v1.0.0"
//   }
// =============================================================================


// =============================================================================
// SECTION 1 - MASTER STANDARDS DATABASE
// =============================================================================
// Each standard entry includes: code, full title, scope, edition year,
// key sections relevant to FORGED-NDT, and applicability tags.

var STANDARDS_DB = {
  // ─── FIXED EQUIPMENT INSPECTION ──────────────────────────────────────
  "API_510": {
    code: "API 510",
    title: "Pressure Vessel Inspection Code",
    scope: "In-service inspection, repair, alteration, and rerating of pressure vessels",
    edition: "11th Edition, 2022",
    category: "inspection_code",
    domains: ["fixed", "production"],
    equipment: ["pressure_vessel", "heat_exchanger", "reactor", "column", "drum", "boiler", "accumulator"],
    key_sections: {
      "Section 6": "Inspection planning and frequency",
      "Section 7": "Condition monitoring and inspection methods",
      "Section 8": "Evaluation, analysis, and recording of results",
      "Section 9": "Repair, alteration, and rerating"
    }
  },
  "API_570": {
    code: "API 570",
    title: "Piping Inspection Code",
    scope: "In-service inspection, rerating, repair, and alteration of piping systems",
    edition: "4th Edition, 2016",
    category: "inspection_code",
    domains: ["fixed", "production"],
    equipment: ["piping", "pipe", "small_bore", "flowline", "header", "manifold"],
    key_sections: {
      "Section 6": "Frequency and extent of inspection",
      "Section 7": "Inspection of specific piping system components",
      "Section 8": "Inspection data evaluation",
      "Section 9": "Piping repairs and alterations"
    }
  },
  "API_653": {
    code: "API 653",
    title: "Tank Inspection, Repair, Alteration, and Reconstruction",
    scope: "Inspection, repair, alteration, and reconstruction of aboveground storage tanks",
    edition: "6th Edition, 2022",
    category: "inspection_code",
    domains: ["fixed", "production"],
    equipment: ["tank", "storage_tank", "aboveground_tank"],
    key_sections: {
      "Section 6": "Routine in-service inspection",
      "Section 7": "External inspection",
      "Section 8": "Internal inspection",
      "Section 9": "Tank bottom inspection and evaluation",
      "Section 10": "Evaluation of tank shell, roof, and structure",
      "Section 12": "Tank repair, alteration, and reconstruction"
    }
  },

  // ─── RBI ─────────────────────────────────────────────────────────────
  "API_RP_580": {
    code: "API RP 580",
    title: "Risk-Based Inspection",
    scope: "Provides guidance on developing an RBI program for fixed equipment and piping",
    edition: "3rd Edition, 2016",
    category: "rbi",
    domains: ["fixed", "production", "pipeline"],
    equipment: ["all"],
    key_sections: {
      "Section 5": "RBI program management",
      "Section 6": "Data and information collection",
      "Section 7": "Damage mechanisms identification",
      "Section 8": "Risk analysis approaches",
      "Section 9": "Risk management with inspection"
    }
  },
  "API_RP_581": {
    code: "API RP 581",
    title: "Risk-Based Inspection Methodology",
    scope: "Quantitative RBI methodology - probability of failure, consequence analysis, inspection planning",
    edition: "3rd Edition, 2016",
    category: "rbi",
    domains: ["fixed", "production"],
    equipment: ["all"],
    key_sections: {
      "Part 2, Section 4": "Thinning damage factor",
      "Part 2, Section 5": "Component lining damage factor",
      "Part 2, Section 6": "External damage factor",
      "Part 2, Section 7": "SCC damage factor",
      "Part 2, Section 8": "HTHA damage factor",
      "Part 2, Section 9": "Brittle fracture damage factor",
      "Part 2, Annex 2.C": "Inspection effectiveness tables",
      "Part 3": "Consequence analysis"
    }
  },

  // ─── DAMAGE MECHANISMS ───────────────────────────────────────────────
  "API_RP_571": {
    code: "API RP 571",
    title: "Damage Mechanisms Affecting Fixed Equipment in the Refining Industry",
    scope: "Comprehensive catalog of damage mechanisms with description, susceptibility, inspection",
    edition: "3rd Edition, 2020",
    category: "damage_mechanisms",
    domains: ["fixed", "production", "pipeline"],
    equipment: ["all"],
    key_sections: {
      "Section 4.2": "Uniform and localized metal loss",
      "Section 4.3": "Surface connected cracking",
      "Section 4.4": "Subsurface cracking",
      "Section 4.5": "Microfissuring/micro-void formation",
      "Section 4.6": "Metallurgical failure mechanisms",
      "Section 5": "Process unit-specific information"
    },
    dm_sections: {
      GENERAL_THINNING: "4.2.1 - Galvanic Corrosion, 4.2.2 - Atmospheric Corrosion",
      LOCALIZED_THINNING: "4.2.3 - Pitting Corrosion",
      CUI: "4.2.7 - CUI",
      CL_SCC: "4.3.3 - Chloride SCC",
      CAUSTIC_SCC: "4.3.5 - Caustic SCC",
      AMINE_SCC: "4.3.8 - Amine SCC",
      SSC: "4.3.4 - SSC / 4.3.6 - HIC/SOHIC",
      HIC: "4.3.6 - HIC/SOHIC/SSWC",
      HTHA: "4.5.1 - HTHA",
      FATIGUE_CRACKING: "4.6.1 - Mechanical Fatigue, 4.6.2 - Vibration Fatigue",
      CREEP: "4.5.2 - Creep/Stress Rupture",
      EROSION_CORROSION: "4.2.14 - Erosion/Erosion-Corrosion",
      MIC: "4.3.8 - MIC",
      BRITTLE_FRACTURE: "4.6.6 - Brittle Fracture",
      CO2_CORROSION: "4.2.16 - CO2 Corrosion",
      H2S_CORROSION: "4.2.17 - Sour Water Corrosion",
      UNDER_DEPOSIT_CORROSION: "4.2.15 - Under-Deposit Corrosion",
      ATMOSPHERIC_CORROSION: "4.2.2 - Atmospheric Corrosion"
    }
  },

  // ─── FITNESS-FOR-SERVICE ─────────────────────────────────────────────
  "API_579": {
    code: "API 579-1/ASME FFS-1",
    title: "Fitness-for-Service",
    scope: "FFS assessment procedures for pressurized equipment with flaws or damage",
    edition: "3rd Edition, 2016",
    category: "ffs",
    domains: ["fixed", "production", "pipeline"],
    equipment: ["all"],
    key_sections: {
      "Part 2": "FFS engineering assessment procedures",
      "Part 3": "Brittle fracture assessment",
      "Part 4": "General metal loss assessment",
      "Part 5": "Local metal loss assessment",
      "Part 6": "Pitting assessment",
      "Part 7": "HIC/SOHIC assessment",
      "Part 8": "Weld misalignment and shell distortion",
      "Part 9": "Crack-like flaw assessment",
      "Part 10": "Creep assessment",
      "Part 11": "Fire damage assessment",
      "Part 12": "Dent assessment",
      "Part 13": "Lamination assessment",
      "Part 14": "Fatigue assessment"
    },
    dm_parts: {
      GENERAL_THINNING: { part: "Part 4", title: "Assessment of general metal loss" },
      LOCALIZED_THINNING: { part: "Part 5", title: "Assessment of local metal loss" },
      MIC: { part: "Part 6", title: "Assessment of pitting damage" },
      UNDER_DEPOSIT_CORROSION: { part: "Part 6", title: "Assessment of pitting damage" },
      HIC: { part: "Part 7", title: "Assessment of HIC/SOHIC damage" },
      CL_SCC: { part: "Part 9", title: "Assessment of crack-like flaws" },
      CAUSTIC_SCC: { part: "Part 9", title: "Assessment of crack-like flaws" },
      AMINE_SCC: { part: "Part 9", title: "Assessment of crack-like flaws" },
      SSC: { part: "Part 9", title: "Assessment of crack-like flaws" },
      FATIGUE_CRACKING: { part: "Part 9 + Part 14", title: "Crack-like flaw + fatigue assessment" },
      CREEP: { part: "Part 10", title: "Assessment of creep damage" },
      BRITTLE_FRACTURE: { part: "Part 3", title: "Assessment of brittle fracture" },
      EROSION_CORROSION: { part: "Part 5", title: "Assessment of local metal loss" }
    }
  },

  // ─── CORROSION & INTEGRITY ───────────────────────────────────────────
  "API_583": {
    code: "API 583",
    title: "Corrosion Under Insulation and Fireproofing",
    scope: "Guidelines for prevention, detection, and mitigation of CUI/CUF",
    edition: "1st Edition, 2014",
    category: "corrosion",
    domains: ["fixed", "production"],
    equipment: ["piping", "pressure_vessel", "column", "heat_exchanger", "drum"],
    applicable_dm: ["CUI"],
    key_sections: {
      "Section 4": "CUI susceptibility assessment",
      "Section 5": "Inspection methods for CUI",
      "Section 6": "CUI prevention and mitigation",
      "Section 7": "Insulation system design and maintenance"
    }
  },
  "API_584": {
    code: "API 584",
    title: "Integrity Operating Windows",
    scope: "Establishing and monitoring IOWs to maintain equipment integrity",
    edition: "1st Edition, 2014",
    category: "integrity",
    domains: ["fixed", "production"],
    equipment: ["all"],
    key_sections: {
      "Section 4": "IOW types and classification",
      "Section 5": "IOW establishment process",
      "Section 6": "IOW monitoring and response",
      "Section 7": "IOW documentation and review"
    }
  },
  "API_RP_651": {
    code: "API RP 651",
    title: "Cathodic Protection of Aboveground Petroleum Storage Tanks",
    scope: "CP system design, installation, and monitoring for tank bottoms",
    edition: "4th Edition, 2014",
    category: "corrosion",
    domains: ["fixed"],
    equipment: ["tank", "storage_tank", "aboveground_tank"],
    key_sections: {
      "Section 4": "CP system design criteria",
      "Section 5": "CP system types",
      "Section 6": "Monitoring and testing"
    }
  },
  "API_RP_652": {
    code: "API RP 652",
    title: "Lining of Aboveground Petroleum Storage Tank Bottoms",
    scope: "Internal lining systems for tank bottom corrosion protection",
    edition: "4th Edition, 2014",
    category: "corrosion",
    domains: ["fixed"],
    equipment: ["tank", "storage_tank", "aboveground_tank"],
    key_sections: {
      "Section 4": "Lining material selection",
      "Section 5": "Surface preparation",
      "Section 6": "Lining application and inspection"
    }
  },
  "API_941": {
    code: "API 941",
    title: "Steels for Hydrogen Service at Elevated Temperatures and Pressures",
    scope: "Nelson curves, HTHA screening criteria, material selection for hydrogen service",
    edition: "8th Edition, 2016",
    category: "materials",
    domains: ["fixed", "production"],
    equipment: ["pressure_vessel", "reactor", "heat_exchanger", "piping"],
    applicable_dm: ["HTHA"],
    key_sections: {
      "Section 3": "Nelson curve methodology",
      "Section 4": "Screening criteria",
      "Figure 1-7": "Nelson curves for various steels"
    }
  },

  // ─── PRESSURE RELIEF ─────────────────────────────────────────────────
  "API_520": {
    code: "API 520",
    title: "Sizing, Selection, and Installation of Pressure-Relieving Devices",
    scope: "Sizing and selection of PRDs in refineries and petrochemical plants",
    edition: "10th Edition, 2020",
    category: "pressure_relief",
    domains: ["fixed", "production"],
    equipment: ["relief_valve", "PSV", "PRD", "rupture_disk"],
    key_sections: {
      "Part I, Section 4": "Sizing of pressure relief valves",
      "Part II, Section 4": "Installation of pressure-relieving devices"
    }
  },
  "API_521": {
    code: "API 521",
    title: "Pressure-Relieving and Depressuring Systems",
    scope: "Design of pressure-relieving and depressuring systems including flare systems",
    edition: "7th Edition, 2020",
    category: "pressure_relief",
    domains: ["fixed", "production"],
    equipment: ["flare", "blowdown", "depressuring_system", "relief_header"],
    key_sections: {
      "Section 4": "Causes of overpressure",
      "Section 5": "Determination of relief requirements",
      "Section 7": "Disposal systems"
    }
  },
  "API_576": {
    code: "API 576",
    title: "Inspection of Pressure-Relieving Devices",
    scope: "Inspection and testing of pressure-relieving devices in-service",
    edition: "4th Edition, 2017",
    category: "inspection_code",
    domains: ["fixed", "production"],
    equipment: ["relief_valve", "PSV", "PRD", "rupture_disk"],
    key_sections: {
      "Section 5": "Causes of PRD malfunction",
      "Section 6": "Inspection and testing",
      "Section 7": "Record keeping"
    }
  },
  "API_2000": {
    code: "API 2000",
    title: "Venting Atmospheric and Low-Pressure Storage Tanks",
    scope: "Normal and emergency venting requirements for storage tanks",
    edition: "8th Edition, 2021",
    category: "pressure_relief",
    domains: ["fixed"],
    equipment: ["tank", "storage_tank", "aboveground_tank"],
    key_sections: {
      "Section 4": "Normal venting requirements",
      "Section 5": "Emergency venting requirements"
    }
  },

  // ─── PIPELINE ────────────────────────────────────────────────────────
  "API_1160": {
    code: "API 1160",
    title: "Managing System Integrity of Hazardous Liquid Pipelines",
    scope: "Integrity management programs for hazardous liquid pipelines",
    edition: "3rd Edition, 2019",
    category: "inspection_code",
    domains: ["pipeline"],
    equipment: ["pipeline", "gathering_line"],
    key_sections: {
      "Section 4": "Pipeline integrity management",
      "Section 5": "Data gathering and review",
      "Section 6": "Risk assessment",
      "Section 7": "Integrity assessment",
      "Section 8": "Mitigation and repair"
    }
  },
  "API_1173": {
    code: "API 1173",
    title: "Pipeline Safety Management Systems",
    scope: "Framework for pipeline safety management systems (PSMS)",
    edition: "2nd Edition, 2022",
    category: "pipeline_integrity",
    domains: ["pipeline"],
    equipment: ["pipeline", "gathering_line", "transmission_line"],
    key_sections: {
      "Section 4": "Leadership and management commitment",
      "Section 5": "Stakeholder engagement",
      "Section 7": "Risk management",
      "Section 9": "Incident investigation and lessons learned"
    }
  },
  "API_1104": {
    code: "API 1104",
    title: "Welding of Pipelines and Related Facilities",
    scope: "Welding procedures, welder qualification, and inspection for pipeline construction",
    edition: "22nd Edition, 2019",
    category: "welding",
    domains: ["pipeline"],
    equipment: ["pipeline", "gathering_line", "flowline"],
    key_sections: {
      "Section 5": "Qualification of welding procedures",
      "Section 6": "Qualification of welders",
      "Section 9": "Inspection and testing of production welds",
      "Section 12": "Mechanized welding with filler metal"
    }
  },
  "API_1183": {
    code: "API 1183",
    title: "Dent Assessment and Management",
    scope: "Assessment of dents and mechanical damage in pipelines",
    edition: "1st Edition, 2020",
    category: "pipeline_integrity",
    domains: ["pipeline"],
    equipment: ["pipeline"],
    applicable_dm: ["DENT", "MECHANICAL_DAMAGE"],
    key_sections: {
      "Section 4": "Dent characterization",
      "Section 5": "Dent assessment methods",
      "Section 6": "Interaction of dents with other features",
      "Section 7": "Dent management and monitoring"
    }
  },
  "API_RP_1110": {
    code: "API RP 1110",
    title: "Pressure Testing of Steel Pipelines",
    scope: "Hydrostatic and pneumatic pressure testing of steel pipelines",
    edition: "2nd Edition, 2019",
    category: "pipeline_integrity",
    domains: ["pipeline"],
    equipment: ["pipeline", "gathering_line"],
    key_sections: {
      "Section 4": "Test planning",
      "Section 5": "Pre-test requirements",
      "Section 6": "Hydrostatic testing",
      "Section 7": "Pneumatic testing"
    }
  },

  // ─── OFFSHORE / SUBSEA ──────────────────────────────────────────────
  "API_RP_2A": {
    code: "API RP 2A-WSD",
    title: "Planning, Designing, and Constructing Fixed Offshore Platforms - WSD",
    scope: "Design and construction of fixed offshore platforms using working stress design",
    edition: "22nd Edition, 2014",
    category: "offshore",
    domains: ["subsea", "floating"],
    equipment: ["jacket", "platform", "topside", "caisson", "conductor"],
    key_sections: {
      "Section 5": "Structural steel design",
      "Section 6": "Connections",
      "Section 11": "Material",
      "Section 14": "Inspection and survey"
    }
  },
  "API_RP_2SIM": {
    code: "API RP 2SIM",
    title: "Structural Integrity Management of Fixed and Floating Offshore Structures",
    scope: "SIM processes for maintaining structural integrity through lifecycle",
    edition: "2nd Edition, 2020",
    category: "offshore",
    domains: ["subsea", "floating", "marine"],
    equipment: ["jacket", "platform", "topside", "floating_production", "FPSO", "hull"],
    key_sections: {
      "Section 5": "SIM process",
      "Section 6": "Data management",
      "Section 7": "Evaluation and assessment",
      "Section 8": "Inspection and monitoring",
      "Section 9": "Mitigation and intervention"
    }
  },
  "API_RP_2SK": {
    code: "API RP 2SK",
    title: "Design and Analysis of Stationkeeping Systems for Floating Structures",
    scope: "Mooring system design, analysis, and integrity management",
    edition: "3rd Edition, 2005 (R2015)",
    category: "offshore",
    domains: ["floating", "subsea"],
    equipment: ["mooring", "mooring_chain", "mooring_line", "anchor"],
    key_sections: {
      "Section 5": "Environmental criteria",
      "Section 6": "Mooring system design",
      "Section 8": "Mooring system integrity management"
    }
  },
  "API_17D": {
    code: "API 17D",
    title: "Design and Operation of Subsea Production Systems",
    scope: "Subsea wellhead, tree equipment, and production system components",
    edition: "2nd Edition, 2011",
    category: "subsea",
    domains: ["subsea"],
    equipment: ["wellhead", "tree", "subsea_manifold", "subsea_template", "jumper"],
    key_sections: {
      "Section 5": "Wellhead systems",
      "Section 6": "Vertical trees",
      "Section 7": "Horizontal trees",
      "Section 11": "Materials"
    }
  },
  "API_17J": {
    code: "API 17J",
    title: "Specification for Unbonded Flexible Pipe",
    scope: "Design, manufacture, testing of unbonded flexible pipe for offshore applications",
    edition: "4th Edition, 2014",
    category: "subsea",
    domains: ["subsea", "floating"],
    equipment: ["flexible_pipe", "riser", "flowline", "umbilical"],
    key_sections: {
      "Section 5": "Functional requirements",
      "Section 6": "Design",
      "Section 7": "Materials",
      "Section 8": "Manufacture",
      "Section 10": "Factory acceptance testing"
    }
  },
  "API_RP_17B": {
    code: "API RP 17B",
    title: "Recommended Practice for Flexible Pipe",
    scope: "Guidance on design, analysis, manufacture, installation, and operation of flexible pipe",
    edition: "6th Edition, 2022",
    category: "subsea",
    domains: ["subsea", "floating"],
    equipment: ["flexible_pipe", "riser", "flowline"],
    key_sections: {
      "Section 4": "Application guidelines",
      "Section 5": "System design",
      "Section 6": "Pipe design",
      "Section 8": "Installation",
      "Section 9": "Operation and monitoring"
    }
  },
  "API_RP_17TR8": {
    code: "API RP 17TR8",
    title: "HPHT Design Guidelines for Subsea Equipment",
    scope: "High pressure high temperature design guidance for subsea production equipment",
    edition: "1st Edition, 2015",
    category: "subsea",
    domains: ["subsea"],
    equipment: ["wellhead", "tree", "subsea_manifold", "riser"],
    key_sections: {
      "Section 5": "HPHT material considerations",
      "Section 6": "Design considerations for HPHT",
      "Section 7": "Testing and qualification"
    }
  },

  // ─── SOUR SERVICE / MATERIALS ────────────────────────────────────────
  "NACE_MR0175": {
    code: "NACE MR0175/ISO 15156",
    title: "Petroleum and Natural Gas Industries - Materials for Use in H2S-containing Environments",
    scope: "Material requirements and selection for sour service (H2S)",
    edition: "2015 with amendments",
    category: "materials",
    domains: ["fixed", "production", "pipeline", "subsea"],
    equipment: ["all"],
    applicable_dm: ["SSC", "HIC", "H2S_CORROSION", "SOHIC"],
    key_sections: {
      "Part 1": "General principles",
      "Part 2": "Carbon and low alloy steels",
      "Part 3": "CRAs and other alloys"
    }
  },
  "NACE_SP0488": {
    code: "NACE SP0488",
    title: "In-Line Inspection of Pipelines",
    scope: "Standard practice for internal corrosion monitoring - includes MIC considerations",
    edition: "2018",
    category: "corrosion",
    domains: ["pipeline", "fixed", "production"],
    equipment: ["pipeline", "piping"],
    applicable_dm: ["MIC"],
    key_sections: {
      "Section 4": "Monitoring techniques",
      "Section 5": "Monitoring program design"
    }
  }
};


// =============================================================================
// SECTION 2 - SERVICE CONDITION STANDARD MAPS
// =============================================================================

var SERVICE_CONDITION_STANDARDS = {
  h2s_service: [
    { ref: "NACE_MR0175", relevance: "Material selection and qualification for H2S service", priority: "MANDATORY" }
  ],
  hydrogen_service: [
    { ref: "API_941", relevance: "HTHA screening and Nelson curve evaluation", priority: "MANDATORY" },
    { ref: "API_579", relevance: "Part 10 - Creep and HTHA remaining life assessment", priority: "RECOMMENDED" }
  ],
  cyclic_service: [
    { ref: "API_579", relevance: "Part 14 - Fatigue assessment for cyclic service", priority: "RECOMMENDED" }
  ],
  high_energy: [
    { ref: "API_579", relevance: "Part 9 - Crack-like flaw assessment for high-energy piping", priority: "RECOMMENDED" }
  ],
  elevated_temperature: [
    { ref: "API_579", relevance: "Part 10 - Creep damage assessment", priority: "RECOMMENDED" }
  ],
  cryogenic: [
    { ref: "API_579", relevance: "Part 3 - Brittle fracture assessment at low temperature", priority: "RECOMMENDED" }
  ]
};

// Temperature-based service classification
function classifyTemperatureService(tempF) {
  if (tempF === null || tempF === undefined) return null;
  if (tempF < -20) return "cryogenic";
  if (tempF > 750) return "elevated_temperature";
  return null;
}


// =============================================================================
// SECTION 3 - RESOLUTION ENGINE
// =============================================================================

function resolveStandards(input) {
  var domain = (input.domain || "fixed").toLowerCase();
  var eqType = (input.equipment_type || "").toLowerCase();
  var dm = input.damage_mechanism || "";
  var service = input.service_conditions || {};
  var queryContext = (input.query_context || "all").toLowerCase();

  var result = {
    primary_inspection_code: null,
    applicable_standards: [],
    damage_mechanism_standards: [],
    service_condition_standards: [],
    ffs_standards: [],
    inspection_requirements: {},
    total_standards_count: 0,
    version: "v1.0.0"
  };

  var seen = {};
  function addStandard(arr, entry, relevance, priority) {
    var key = entry.code + "|" + (relevance || "");
    if (seen[key]) return;
    seen[key] = true;
    arr.push({
      code: entry.code,
      title: entry.title,
      scope: entry.scope,
      edition: entry.edition,
      category: entry.category,
      relevance: relevance || "",
      priority: priority || "REFERENCE",
      key_sections: entry.key_sections
    });
  }

  // ── Step 1: Find primary inspection code by equipment type ──
  for (var stdKey in STANDARDS_DB) {
    if (!STANDARDS_DB.hasOwnProperty(stdKey)) continue;
    var std = STANDARDS_DB[stdKey];

    // Match by equipment type first
    if (std.category === "inspection_code" && eqType) {
      var eqMatch = false;
      for (var i = 0; i < std.equipment.length; i++) {
        if (eqType.indexOf(std.equipment[i]) !== -1 || std.equipment[i].indexOf(eqType) !== -1) {
          eqMatch = true;
          break;
        }
      }
      if (eqMatch) {
        var domainMatch = false;
        for (var j = 0; j < std.domains.length; j++) {
          if (std.domains[j] === domain) { domainMatch = true; break; }
        }
        if (domainMatch || std.equipment.indexOf("all") !== -1) {
          if (!result.primary_inspection_code) {
            result.primary_inspection_code = {
              code: std.code,
              title: std.title,
              edition: std.edition,
              key_sections: std.key_sections
            };
          }
          addStandard(result.applicable_standards, std, "Primary inspection code for " + eqType, "MANDATORY");
        }
      }
    }
  }

  // ── Step 2: Domain-level standards ──
  if (queryContext === "all" || queryContext === "rbi" || queryContext === "inspection") {
    for (var stdKey2 in STANDARDS_DB) {
      if (!STANDARDS_DB.hasOwnProperty(stdKey2)) continue;
      var std2 = STANDARDS_DB[stdKey2];
      var domMatch2 = false;
      for (var d = 0; d < std2.domains.length; d++) {
        if (std2.domains[d] === domain) { domMatch2 = true; break; }
      }
      if (domMatch2) {
        var relevance2 = "Applicable to " + domain + " domain";
        var priority2 = "REFERENCE";
        if (std2.category === "rbi") priority2 = "RECOMMENDED";
        if (std2.category === "inspection_code") priority2 = "MANDATORY";
        addStandard(result.applicable_standards, std2, relevance2, priority2);
      }
    }
  }

  // ── Step 3: Damage mechanism standards ──
  if (dm) {
    // API RP 571 dm_sections
    var rp571 = STANDARDS_DB["API_RP_571"];
    if (rp571 && rp571.dm_sections && rp571.dm_sections[dm]) {
      addStandard(result.damage_mechanism_standards, rp571,
        "Section " + rp571.dm_sections[dm] + " covers " + dm, "MANDATORY");
    }

    // API 579 FFS parts
    var ffs = STANDARDS_DB["API_579"];
    if (ffs && ffs.dm_parts && ffs.dm_parts[dm]) {
      var ffsPart = ffs.dm_parts[dm];
      addStandard(result.ffs_standards, ffs,
        ffsPart.part + " - " + ffsPart.title + " for " + dm, "RECOMMENDED");
    }

    // DM-specific standards (API 583 for CUI, API 941 for HTHA, etc.)
    for (var stdKey3 in STANDARDS_DB) {
      if (!STANDARDS_DB.hasOwnProperty(stdKey3)) continue;
      var std3 = STANDARDS_DB[stdKey3];
      if (std3.applicable_dm) {
        for (var k = 0; k < std3.applicable_dm.length; k++) {
          if (std3.applicable_dm[k] === dm) {
            addStandard(result.damage_mechanism_standards, std3,
              "Specifically applicable to " + dm, "MANDATORY");
            break;
          }
        }
      }
    }
  }

  // ── Step 4: Service condition standards ──
  if (service.h2s_service) {
    var h2sStds = SERVICE_CONDITION_STANDARDS.h2s_service;
    for (var m = 0; m < h2sStds.length; m++) {
      var ref = STANDARDS_DB[h2sStds[m].ref];
      if (ref) addStandard(result.service_condition_standards, ref, h2sStds[m].relevance, h2sStds[m].priority);
    }
  }
  if (service.hydrogen_service) {
    var h2Stds = SERVICE_CONDITION_STANDARDS.hydrogen_service;
    for (var n = 0; n < h2Stds.length; n++) {
      var ref2 = STANDARDS_DB[h2Stds[n].ref];
      if (ref2) addStandard(result.service_condition_standards, ref2, h2Stds[n].relevance, h2Stds[n].priority);
    }
  }
  if (service.cyclic_service) {
    var cyStds = SERVICE_CONDITION_STANDARDS.cyclic_service;
    for (var o = 0; o < cyStds.length; o++) {
      var ref3 = STANDARDS_DB[cyStds[o].ref];
      if (ref3) addStandard(result.service_condition_standards, ref3, cyStds[o].relevance, cyStds[o].priority);
    }
  }
  // Temperature-based
  var tempClass = classifyTemperatureService(service.temperature);
  if (tempClass && SERVICE_CONDITION_STANDARDS[tempClass]) {
    var tempStds = SERVICE_CONDITION_STANDARDS[tempClass];
    for (var p = 0; p < tempStds.length; p++) {
      var ref4 = STANDARDS_DB[tempStds[p].ref];
      if (ref4) addStandard(result.service_condition_standards, ref4, tempStds[p].relevance, tempStds[p].priority);
    }
  }

  // ── Step 5: Always include 581 effectiveness basis ──
  var rp581 = STANDARDS_DB["API_RP_581"];
  if (rp581) {
    addStandard(result.applicable_standards, rp581, "Inspection effectiveness classification basis (Annex 2.C)", "REFERENCE");
  }

  // ── Step 6: Build inspection requirements summary ──
  result.inspection_requirements = {
    primary_code: result.primary_inspection_code ? result.primary_inspection_code.code : "Not determined",
    rbi_basis: "API RP 580/581",
    ffs_basis: dm && STANDARDS_DB["API_579"].dm_parts[dm] ? STANDARDS_DB["API_579"].dm_parts[dm].part : "API 579-1 (part TBD based on flaw type)",
    dm_reference: dm && rp571.dm_sections[dm] ? "API RP 571 " + rp571.dm_sections[dm] : "API RP 571 (section TBD)"
  };

  // Count
  result.total_standards_count = result.applicable_standards.length
    + result.damage_mechanism_standards.length
    + result.service_condition_standards.length
    + result.ffs_standards.length;

  return result;
}


// =============================================================================
// SECTION 4 - NETLIFY HANDLER
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
    result = resolveStandards(input);
  } catch (e) {
    return {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({ error: "Standards resolution exception", detail: e.message })
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
  resolveStandards: resolveStandards,
  STANDARDS_DB: STANDARDS_DB,
  SERVICE_CONDITION_STANDARDS: SERVICE_CONDITION_STANDARDS,
  classifyTemperatureService: classifyTemperatureService
};
