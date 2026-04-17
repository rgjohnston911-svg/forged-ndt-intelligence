// @ts-nocheck
/**
 * DEPLOY246 - medical-bio.ts
 * netlify/functions/medical-bio.ts
 *
 * MEDICAL & BIOMEDICAL DEVICE INDUSTRY VERTICAL
 * Medical device inspection, implant integrity, sterilization validation,
 * biocompatibility, FDA 21 CFR / ISO 13485 / MDR frameworks
 *
 * POST /api/medical-bio { action, ... }
 *
 * Actions:
 *   identify_failure_mode  - identify failure/degradation modes for a device/implant
 *   assess_case            - full case assessment with medical device context
 *   get_inspection_requirements - inspection/testing requirements by device class
 *   get_registry           - full mechanism + classification registry
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

// ── FAILURE MODE REGISTRY ──────────────────────────────────────────

var FAILURE_MODES = [
  // Metallic Implants
  {
    id: "med_fatigue_implant",
    name: "Implant Fatigue Fracture",
    category: "metallic_implant",
    description: "Cyclic loading fatigue failure of orthopedic implants including hip stems, knee components, spinal rods, and fracture fixation plates from physiological loading",
    keywords: ["fatigue", "fracture", "implant", "hip stem", "knee", "spinal rod", "plate", "cyclic"],
    materials: ["titanium ti-6al-4v", "cobalt chrome", "316l stainless", "nitinol"],
    components: ["hip stem", "femoral component", "tibial tray", "spinal rod", "bone plate", "intramedullary nail"],
    ndt_methods: ["micro-CT", "SEM", "fractography", "dye penetrant", "radiography", "acoustic microscopy"],
    severity_base: 0.9,
    references: ["ASTM F2345", "ASTM F1160", "ISO 14801", "FDA guidance implant fatigue"]
  },
  {
    id: "med_corrosion_implant",
    name: "Implant Corrosion and Metal Ion Release",
    category: "metallic_implant",
    description: "Crevice corrosion, fretting corrosion, and galvanic corrosion at modular taper junctions releasing metal ions and causing adverse local tissue reactions",
    keywords: ["corrosion", "fretting", "taper", "trunnion", "metal ion", "altr", "metallosis", "galvanic"],
    materials: ["cobalt chrome", "titanium", "316l stainless", "mixed metals"],
    components: ["modular taper", "trunnion", "morse taper", "locking mechanism", "screw-plate interface"],
    ndt_methods: ["SEM-EDS", "metallography", "ion chromatography", "surface profilometry", "micro-CT"],
    severity_base: 0.85,
    references: ["ASTM F2129", "ASTM F897", "ISO 16428", "FDA guidance corrosion testing"]
  },
  {
    id: "med_wear_bearing",
    name: "Bearing Surface Wear (Joint Replacement)",
    category: "metallic_implant",
    description: "Wear of articulating bearing surfaces in hip and knee replacements generating wear debris causing osteolysis and aseptic loosening",
    keywords: ["wear", "bearing", "polyethylene", "osteolysis", "loosening", "debris", "articulating"],
    materials: ["uhmwpe", "cross-linked pe", "cobalt chrome", "ceramic alumina", "ceramic zirconia"],
    components: ["acetabular liner", "femoral head", "tibial insert", "bearing surface"],
    ndt_methods: ["gravimetric wear", "CMM", "profilometry", "micro-CT", "optical microscopy"],
    severity_base: 0.75,
    references: ["ASTM F2025", "ISO 14242", "ASTM F1714", "ISO 14243"]
  },

  // Polymer / Composite Devices
  {
    id: "med_polymer_degradation",
    name: "Polymer Degradation and Aging",
    category: "polymer_device",
    description: "Hydrolytic, oxidative, and enzymatic degradation of polymeric medical device materials causing embrittlement, discoloration, and mechanical property loss",
    keywords: ["polymer", "degradation", "hydrolysis", "oxidation", "aging", "embrittlement", "shelf life"],
    materials: ["uhmwpe", "peek", "silicone", "polyurethane", "plla", "plga", "nylon", "polycarbonate"],
    components: ["catheter", "tubing", "housing", "liner", "seal", "gasket", "implant body"],
    ndt_methods: ["FTIR", "DSC", "tensile testing", "oxidation index", "GPC", "visual"],
    severity_base: 0.65,
    references: ["ASTM F2003", "ISO 10993-13", "ASTM F2625", "ISO 11137"]
  },
  {
    id: "med_delamination_composite",
    name: "Composite Device Delamination",
    category: "polymer_device",
    description: "Layer separation in composite medical devices and carbon fiber orthopedic components from manufacturing defects, fatigue, or sterilization-induced degradation",
    keywords: ["delamination", "composite", "carbon fiber", "layer separation", "laminate"],
    materials: ["cfrp", "gfrp", "peek-cf", "ceramic composite"],
    components: ["orthopedic plate", "prosthetic limb", "device housing", "instrument shaft"],
    ndt_methods: ["ultrasonic C-scan", "acoustic microscopy", "micro-CT", "thermography"],
    severity_base: 0.7,
    references: ["ASTM D5528", "ISO 15024", "FDA guidance composite devices"]
  },

  // Cardiovascular Devices
  {
    id: "med_stent_fatigue",
    name: "Stent Fatigue and Fracture",
    category: "cardiovascular",
    description: "Fatigue fracture of coronary and peripheral stent struts from cardiac and musculoskeletal cyclic loading causing restenosis or vessel injury",
    keywords: ["stent", "fatigue", "strut fracture", "nitinol", "coronary", "peripheral", "restenosis"],
    materials: ["316l stainless", "cobalt chrome l605", "nitinol", "platinum chromium", "magnesium"],
    components: ["coronary stent", "peripheral stent", "stent graft", "drug-eluting stent"],
    ndt_methods: ["SEM", "micro-CT", "fatigue testing", "fluoroscopy", "optical microscopy"],
    severity_base: 0.9,
    references: ["ASTM F2477", "FDA guidance stent fatigue", "ISO 25539-2", "ASTM F2942"]
  },
  {
    id: "med_heart_valve_calcification",
    name: "Prosthetic Heart Valve Calcification / Structural Deterioration",
    category: "cardiovascular",
    description: "Calcification and structural valve deterioration of bioprosthetic heart valves causing stenosis or regurgitation over time",
    keywords: ["heart valve", "calcification", "bioprosthetic", "svd", "stenosis", "regurgitation", "leaflet"],
    materials: ["bovine pericardium", "porcine valve", "pyrolytic carbon", "titanium frame", "nitinol frame"],
    components: ["valve leaflet", "valve frame", "sewing ring", "tavr prosthesis"],
    ndt_methods: ["echocardiography", "micro-CT", "histology", "mechanical testing", "fatigue test"],
    severity_base: 0.95,
    references: ["ISO 5840", "FDA guidance heart valves", "ASTM F2064"]
  },
  {
    id: "med_lead_conductor_failure",
    name: "Cardiac Lead Conductor Failure",
    category: "cardiovascular",
    description: "Fracture or insulation breach of pacemaker and ICD lead conductors from mechanical fatigue at anchor points, subclavian crush, or material degradation",
    keywords: ["lead", "conductor", "pacemaker", "icd", "insulation", "fracture", "crush"],
    materials: ["mp35n", "dft wire", "silicone", "polyurethane", "etfe", "platinum iridium"],
    components: ["pacing lead", "icd lead", "conductor coil", "insulation", "connector"],
    ndt_methods: ["fluoroscopy", "impedance trending", "electrical testing", "SEM", "micro-CT"],
    severity_base: 0.95,
    references: ["ISO 14708-2", "FDA guidance active implants", "EN 45502-2-1"]
  },

  // Sterilization / Biocompatibility
  {
    id: "med_sterilization_failure",
    name: "Sterilization Process Failure / Residual Contamination",
    category: "sterilization",
    description: "Inadequate sterilization from process parameter deviations, bioburden exceedance, or residual ethylene oxide / radiation damage to device materials",
    keywords: ["sterilization", "bioburden", "eo", "ethylene oxide", "gamma", "e-beam", "sterility", "contamination"],
    materials: ["all device materials"],
    components: ["sterile packaged device", "surgical instrument", "implant", "single-use device"],
    ndt_methods: ["sterility test", "bioburden test", "BI challenge", "EO residual test", "dose audit", "package seal test"],
    severity_base: 0.85,
    references: ["ISO 11135", "ISO 11137", "ISO 11607", "FDA guidance sterilization", "21 CFR 820"]
  },
  {
    id: "med_biocompatibility_failure",
    name: "Biocompatibility / Adverse Tissue Response",
    category: "sterilization",
    description: "Cytotoxicity, sensitization, irritation, or systemic toxicity from extractable/leachable compounds or material degradation products",
    keywords: ["biocompatibility", "cytotoxicity", "leachable", "extractable", "tissue response", "sensitization"],
    materials: ["all contact materials", "adhesives", "coatings", "inks", "packaging"],
    components: ["implant surface", "blood-contacting device", "mucosal device", "skin-contact device"],
    ndt_methods: ["ISO 10993 battery", "cytotoxicity", "sensitization", "irritation", "extractables", "chemical characterization"],
    severity_base: 0.8,
    references: ["ISO 10993-1", "ISO 10993-5", "ISO 10993-10", "ISO 10993-12", "FDA guidance biocompatibility"]
  },

  // Surgical Instruments
  {
    id: "med_instrument_wear",
    name: "Reusable Surgical Instrument Wear / Damage",
    category: "surgical_instrument",
    description: "Progressive wear, corrosion, and mechanical damage to reusable surgical instruments from repeated use, cleaning, and sterilization cycles",
    keywords: ["instrument", "surgical", "reusable", "wear", "sharpness", "alignment", "reprocessing"],
    materials: ["stainless steel", "tungsten carbide", "titanium", "anodized aluminum"],
    components: ["scissors", "forceps", "retractor", "drill bit", "saw blade", "endoscope"],
    ndt_methods: ["visual", "functional test", "sharpness test", "alignment check", "leak test", "borescope"],
    severity_base: 0.6,
    references: ["ISO 17664", "AAMI TIR30", "AAMI ST79", "FDA guidance reprocessing"]
  },

  // Active Electronics
  {
    id: "med_electronics_reliability",
    name: "Active Device Electronics Failure",
    category: "active_device",
    description: "Electronic component failure in active medical devices from thermal stress, moisture ingress, battery degradation, or EMI susceptibility",
    keywords: ["electronics", "battery", "firmware", "emi", "moisture", "hermetic", "seal", "software"],
    materials: ["pcb", "lithium battery", "hermetic package", "feedthrough", "conformal coating"],
    components: ["pulse generator", "infusion pump", "ventilator", "monitor", "diagnostic equipment", "neurostimulator"],
    ndt_methods: ["electrical testing", "hermeticity test", "battery capacity", "EMC test", "environmental test", "software verification"],
    severity_base: 0.85,
    references: ["IEC 60601-1", "IEC 62368-1", "ISO 14708", "FDA guidance software", "IEC 62304"]
  }
];

// ── FDA DEVICE CLASSIFICATION ──────────────────────────────────────

var DEVICE_CLASSES = [
  {
    id: "class_i",
    name: "FDA Class I",
    description: "Low risk devices subject to general controls (registration, listing, labeling, GMP, premarket notification for some)",
    risk_level: "low",
    regulatory_path: "510(k) exempt (most) or 510(k)",
    examples: ["bandages", "tongue depressors", "examination gloves", "hand-held instruments"],
    inspection_rigor: "basic",
    qms_requirement: "21 CFR 820 (abbreviated for exempt)",
    references: ["21 CFR 860", "FDA device classification database"]
  },
  {
    id: "class_ii",
    name: "FDA Class II",
    description: "Moderate risk devices requiring general and special controls including performance standards and post-market surveillance",
    risk_level: "moderate",
    regulatory_path: "510(k) premarket notification",
    examples: ["powered wheelchairs", "infusion pumps", "surgical drapes", "pregnancy tests", "contact lenses"],
    inspection_rigor: "standard",
    qms_requirement: "21 CFR 820 full compliance",
    references: ["21 CFR 860", "21 CFR 807 Subpart E"]
  },
  {
    id: "class_iii",
    name: "FDA Class III",
    description: "High risk devices requiring premarket approval (PMA) with clinical data demonstrating safety and effectiveness",
    risk_level: "high",
    regulatory_path: "PMA (Premarket Approval) or De Novo",
    examples: ["heart valves", "hip implants", "pacemakers", "stents", "breast implants"],
    inspection_rigor: "comprehensive",
    qms_requirement: "21 CFR 820 full compliance + design controls",
    references: ["21 CFR 860", "21 CFR 814"]
  },
  {
    id: "eu_class_i",
    name: "EU MDR Class I",
    description: "Low risk devices under EU Medical Device Regulation 2017/745",
    risk_level: "low",
    regulatory_path: "Self-declaration (most) or Notified Body for Is/Im/Ir",
    examples: ["non-sterile non-measuring devices", "reusable surgical instruments"],
    inspection_rigor: "basic",
    qms_requirement: "ISO 13485 + EU MDR Annex II/III",
    references: ["EU MDR 2017/745 Annex VIII"]
  },
  {
    id: "eu_class_iia",
    name: "EU MDR Class IIa",
    description: "Medium-low risk devices requiring Notified Body conformity assessment",
    risk_level: "moderate_low",
    regulatory_path: "Notified Body audit (Annex IX or XI)",
    examples: ["dental fillings", "hearing aids", "surgical clamps", "suction equipment"],
    inspection_rigor: "standard",
    qms_requirement: "ISO 13485 + EU MDR technical documentation",
    references: ["EU MDR 2017/745 Annex VIII Rule 1-22"]
  },
  {
    id: "eu_class_iib",
    name: "EU MDR Class IIb",
    description: "Medium-high risk devices requiring more stringent Notified Body assessment",
    risk_level: "moderate_high",
    regulatory_path: "Notified Body audit (Annex IX)",
    examples: ["ventilators", "bone plates", "dialysis equipment", "blood bags"],
    inspection_rigor: "enhanced",
    qms_requirement: "ISO 13485 + EU MDR Annex II technical documentation + clinical evaluation",
    references: ["EU MDR 2017/745 Annex VIII"]
  },
  {
    id: "eu_class_iii",
    name: "EU MDR Class III",
    description: "High risk devices requiring most stringent conformity assessment including clinical investigation review",
    risk_level: "high",
    regulatory_path: "Notified Body full audit (Annex IX) + clinical scrutiny for implants",
    examples: ["heart valves", "hip implants", "drug-eluting stents", "breast implants"],
    inspection_rigor: "comprehensive",
    qms_requirement: "ISO 13485 + EU MDR full technical documentation + PMCF",
    references: ["EU MDR 2017/745 Annex VIII, IX"]
  }
];

// ── MATCHING ENGINE ────────────────────────────────────────────────

function matchFailureModes(params) {
  var description = (params.description || "").toLowerCase();
  var material = (params.material || "").toLowerCase();
  var component = (params.component || "").toLowerCase();
  var category = (params.category || "").toLowerCase();

  var scored = [];
  for (var i = 0; i < FAILURE_MODES.length; i++) {
    var fm = FAILURE_MODES[i];
    var score = 0;

    for (var k = 0; k < fm.keywords.length; k++) {
      if (description.indexOf(fm.keywords[k]) !== -1) score += 20;
      if (component.indexOf(fm.keywords[k]) !== -1) score += 20;
    }

    for (var m = 0; m < fm.materials.length; m++) {
      if (material.indexOf(fm.materials[m]) !== -1) score += 15;
    }

    for (var c = 0; c < fm.components.length; c++) {
      if (component.indexOf(fm.components[c]) !== -1) score += 15;
      if (description.indexOf(fm.components[c]) !== -1) score += 10;
    }

    if (category && fm.category === category) score += 25;

    if (score > 0) {
      scored.push({
        failure_mode: fm,
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
      for (var i = 0; i < FAILURE_MODES.length; i++) {
        var cat = FAILURE_MODES[i].category;
        if (!byCat[cat]) byCat[cat] = 0;
        byCat[cat]++;
      }
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "medical-bio",
          deploy: "DEPLOY246",
          version: "1.0.0",
          total_failure_modes: FAILURE_MODES.length,
          by_category: byCat,
          categories: ["metallic_implant", "polymer_device", "cardiovascular", "sterilization", "surgical_instrument", "active_device"],
          device_classes: DEVICE_CLASSES.length,
          regulatory_frameworks: ["FDA 21 CFR", "EU MDR 2017/745", "ISO 13485", "ISO 14971"],
          failure_modes: FAILURE_MODES.map(function(f) {
            return { id: f.id, name: f.name, category: f.category, severity_base: f.severity_base };
          }),
          classifications: DEVICE_CLASSES.map(function(d) {
            return { id: d.id, name: d.name, risk_level: d.risk_level, regulatory_path: d.regulatory_path };
          })
        })
      };
    }

    // ── identify_failure_mode ──
    if (action === "identify_failure_mode") {
      var matches = matchFailureModes({
        description: body.description || "",
        material: body.material || "",
        component: body.component || "",
        category: body.category || ""
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "identify_failure_mode",
          input: { description: body.description, material: body.material, component: body.component, category: body.category },
          matches_found: matches.length,
          failure_modes: matches.slice(0, 10).map(function(m) {
            return {
              id: m.failure_mode.id,
              name: m.failure_mode.name,
              category: m.failure_mode.category,
              description: m.failure_mode.description,
              relevance_score: m.relevance_score,
              confidence: m.confidence,
              severity_base: m.failure_mode.severity_base,
              recommended_testing: m.failure_mode.ndt_methods,
              references: m.failure_mode.references
            };
          })
        })
      };
    }

    // ── get_inspection_requirements ──
    if (action === "get_inspection_requirements") {
      var deviceClass = (body.device_class || "").toLowerCase();
      var matched = null;
      for (var di = 0; di < DEVICE_CLASSES.length; di++) {
        if (deviceClass.indexOf(DEVICE_CLASSES[di].id) !== -1 ||
            DEVICE_CLASSES[di].name.toLowerCase().indexOf(deviceClass) !== -1) {
          matched = DEVICE_CLASSES[di];
          break;
        }
      }

      if (!matched && deviceClass) {
        for (var fi = 0; fi < DEVICE_CLASSES.length; fi++) {
          if (DEVICE_CLASSES[fi].description.toLowerCase().indexOf(deviceClass) !== -1 ||
              DEVICE_CLASSES[fi].risk_level === deviceClass) {
            matched = DEVICE_CLASSES[fi];
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
            error: "device_class_not_found",
            available_classes: DEVICE_CLASSES.map(function(d) { return { id: d.id, name: d.name, risk_level: d.risk_level }; })
          })
        };
      }

      // relevant failure modes for this risk level
      var relevantFMs = [];
      if (matched.risk_level === "high" || matched.risk_level === "moderate_high") {
        relevantFMs = FAILURE_MODES.filter(function(f) { return f.severity_base >= 0.75; });
      } else if (matched.risk_level === "moderate" || matched.risk_level === "moderate_low") {
        relevantFMs = FAILURE_MODES.filter(function(f) { return f.severity_base >= 0.6; });
      } else {
        relevantFMs = FAILURE_MODES.filter(function(f) { return f.severity_base >= 0.8; });
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "get_inspection_requirements",
          device_class: matched,
          applicable_failure_modes: relevantFMs.map(function(f) { return { id: f.id, name: f.name, severity_base: f.severity_base }; }),
          required_testing_program: {
            risk_management: "ISO 14971 risk analysis required for all classes",
            design_verification: matched.inspection_rigor === "comprehensive" ? "Full design verification and validation per 21 CFR 820.30" :
              matched.inspection_rigor === "enhanced" ? "Design verification with clinical evaluation" :
              matched.inspection_rigor === "standard" ? "Performance testing per special controls" :
              "General controls compliance",
            biocompatibility: "ISO 10993 evaluation based on body contact and duration",
            sterilization: "ISO 11135/11137 validation if sterile device",
            shelf_life: "Accelerated and real-time aging studies per ASTM F1980"
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

      var caseFMs = matchFailureModes({
        description: caseDesc,
        material: body.material || "",
        component: caseData.component_name || "",
        category: body.category || ""
      });

      // regulatory risk flags
      var riskFlags = [];
      if (caseFMs.length > 0 && caseFMs[0].failure_mode.severity_base >= 0.9) {
        riskFlags.push("life_threatening_failure_mode");
      }
      if (caseFMs.some(function(m) { return m.failure_mode.category === "cardiovascular"; })) {
        riskFlags.push("cardiovascular_device_class_iii");
      }
      if (caseFMs.some(function(m) { return m.failure_mode.id === "med_sterilization_failure"; })) {
        riskFlags.push("sterility_compromise");
      }
      if (caseFMs.some(function(m) { return m.failure_mode.id === "med_biocompatibility_failure"; })) {
        riskFlags.push("biocompatibility_concern");
      }
      if (findings.length > 2) {
        riskFlags.push("multiple_findings");
      }

      // determine regulatory action
      var regulatoryAction = "document_in_dhr";
      if (riskFlags.indexOf("life_threatening_failure_mode") !== -1) {
        regulatoryAction = "mdr_report_and_capa_required";
      } else if (riskFlags.indexOf("sterility_compromise") !== -1) {
        regulatoryAction = "quarantine_and_investigate";
      } else if (riskFlags.length >= 2) {
        regulatoryAction = "capa_investigation_required";
      } else if (caseFMs.length > 0 && caseFMs[0].failure_mode.severity_base >= 0.75) {
        regulatoryAction = "ncr_and_risk_assessment";
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "assess_case",
          case_id: body.case_id,
          case_status: caseData.status,
          component: caseData.component_name,
          identified_failure_modes: caseFMs.slice(0, 5).map(function(m) {
            return {
              id: m.failure_mode.id,
              name: m.failure_mode.name,
              category: m.failure_mode.category,
              relevance_score: m.relevance_score,
              confidence: m.confidence,
              severity_base: m.failure_mode.severity_base,
              recommended_testing: m.failure_mode.ndt_methods
            };
          }),
          findings_count: findings.length,
          risk_flags: riskFlags,
          regulatory_action: regulatoryAction,
          reporting_obligations: {
            fda_mdr: riskFlags.indexOf("life_threatening_failure_mode") !== -1 ? "21 CFR 803 MDR report within 30 days (5 days if death)" : "evaluate per decision tree",
            eu_vigilance: riskFlags.indexOf("life_threatening_failure_mode") !== -1 ? "EU MDR Article 87 serious incident report" : "evaluate per MEDDEV 2.12/1",
            capa: regulatoryAction !== "document_in_dhr" ? "21 CFR 820.90 CAPA required" : "optional preventive action"
          },
          medical_recommendation: regulatoryAction === "mdr_report_and_capa_required" ? "immediate_quarantine_and_regulatory_notification" :
            regulatoryAction === "quarantine_and_investigate" ? "quarantine_affected_lots_and_root_cause_investigation" :
            regulatoryAction === "capa_investigation_required" ? "initiate_capa_with_risk_assessment" :
            regulatoryAction === "ncr_and_risk_assessment" ? "nonconformance_report_with_disposition" :
            "document_in_device_history_record"
        })
      };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action, valid_actions: ["identify_failure_mode", "assess_case", "get_inspection_requirements", "get_registry"] }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
