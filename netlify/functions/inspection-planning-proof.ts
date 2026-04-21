// @ts-nocheck
/**
 * DEPLOY266 - inspection-planning-proof.ts
 * netlify/functions/inspection-planning-proof.ts
 *
 * INSPECTION PLANNING PROOF ENGINE v1.0.0
 * Closes the loop from "what data is missing" to "exactly how to find it."
 *
 * Takes proof breaks, missing evidence flags, component proof chains,
 * and method observability gaps from the Superbrain v5 output and generates
 * a defensible, prioritized, method-specific inspection workpack.
 *
 * 8 actions:
 *   get_registry           — engine overview
 *   generate_plan          — generate full inspection plan from proof gaps
 *   get_method_matrix      — NDT method capabilities vs damage modes
 *   get_access_methods     — access/scaffolding options for component locations
 *   prioritize_workpack    — re-prioritize existing workpack items
 *   estimate_plan          — cost/time estimates for a plan
 *   get_plan               — retrieve a stored plan
 *   get_plan_history       — list plans for a case
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var ENGINE_VERSION = "inspection-planning-proof/1.0.0";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

function ok(body) {
  return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(body) };
}
function errResp(code, msg) {
  return { statusCode: code, headers: corsHeaders, body: JSON.stringify({ error: msg }) };
}

// ============================================================
// NDT METHOD CAPABILITY MATRIX
// What each method can and cannot detect, with proof-level detail
// ============================================================
var METHOD_MATRIX = [
  {
    method: "UT_THICKNESS",
    full_name: "Ultrasonic Thickness Measurement",
    damage_modes: ["general_corrosion", "localised_corrosion", "erosion", "erosion_corrosion", "CUI", "flow_accelerated_corrosion"],
    cannot_detect: ["cracking", "SCC", "fatigue_cracks", "microbiological_corrosion_initiation", "hydrogen_damage"],
    min_wall_mm: 1.0,
    max_wall_mm: 300,
    accuracy_mm: 0.1,
    surface_access: "one_side",
    surface_prep: "paint_removal_or_couplant",
    temperature_limit_c: 500,
    personnel_cert: "UT Level II",
    code_basis: ["API 570", "ASME B31.3", "API 510"],
    proof_value: "DECISION_GRADE",
    limitations: ["Requires surface access", "Coating removal may be needed", "Cannot detect cracking orientation"]
  },
  {
    method: "UT_SHEAR_WAVE",
    full_name: "Ultrasonic Shear Wave (Angle Beam)",
    damage_modes: ["fatigue_cracks", "SCC", "hydrogen_cracking", "weld_defects", "lack_of_fusion"],
    cannot_detect: ["general_corrosion", "erosion", "pitting_below_resolution"],
    surface_access: "one_side",
    surface_prep: "ground_smooth",
    personnel_cert: "UT Level II",
    code_basis: ["ASME V Article 4", "AWS D1.1", "API 1104"],
    proof_value: "DECISION_GRADE",
    limitations: ["Requires skilled operator", "Geometry-dependent", "Calibration-critical"]
  },
  {
    method: "PAUT",
    full_name: "Phased Array Ultrasonic Testing",
    damage_modes: ["fatigue_cracks", "SCC", "corrosion_mapping", "weld_defects", "erosion", "hydrogen_cracking"],
    cannot_detect: ["surface_breaking_cracks_only_from_far_side"],
    surface_access: "one_side",
    surface_prep: "ground_smooth",
    personnel_cert: "PAUT Level II",
    code_basis: ["ASME V Article 4", "API 579-1 Part 9", "DNV-RP-F101"],
    proof_value: "DECISION_GRADE",
    limitations: ["More expensive than conventional UT", "Requires encoded scanning for defensibility"]
  },
  {
    method: "TOFD",
    full_name: "Time of Flight Diffraction",
    damage_modes: ["fatigue_cracks", "SCC", "weld_defects", "lack_of_fusion", "hydrogen_cracking"],
    cannot_detect: ["general_corrosion", "surface_pitting", "near_surface_defects"],
    surface_access: "one_side",
    surface_prep: "ground_smooth",
    personnel_cert: "TOFD Level II",
    code_basis: ["ASME V Article 4", "BS EN ISO 10863"],
    proof_value: "DECISION_GRADE",
    limitations: ["Dead zone near surfaces", "Requires parallel scanning surfaces"]
  },
  {
    method: "MPI",
    full_name: "Magnetic Particle Inspection",
    damage_modes: ["surface_cracks", "fatigue_cracks", "SCC_surface", "weld_toe_cracks", "grinding_cracks"],
    cannot_detect: ["subsurface_defects", "corrosion_wall_loss", "internal_erosion"],
    surface_access: "direct",
    surface_prep: "clean_dry",
    material_requirement: "ferromagnetic",
    personnel_cert: "MT Level II",
    code_basis: ["ASME V Article 7", "AWS D1.1", "API 570"],
    proof_value: "DECISION_GRADE_SURFACE_ONLY",
    limitations: ["Ferromagnetic materials only", "Surface/near-surface only", "Cannot size depth"]
  },
  {
    method: "PT",
    full_name: "Liquid Penetrant Testing",
    damage_modes: ["surface_cracks", "porosity_surface", "fatigue_cracks_surface", "SCC_surface"],
    cannot_detect: ["subsurface_defects", "corrosion_wall_loss", "embedded_defects"],
    surface_access: "direct",
    surface_prep: "clean_dry_smooth",
    personnel_cert: "PT Level II",
    code_basis: ["ASME V Article 6", "ASTM E165"],
    proof_value: "SCREENING",
    limitations: ["Surface-breaking only", "Cannot size depth", "Surface finish sensitive"]
  },
  {
    method: "VISUAL",
    full_name: "Visual Inspection",
    damage_modes: ["surface_corrosion", "coating_damage", "structural_deformation", "leaks", "insulation_damage"],
    cannot_detect: ["internal_corrosion", "subsurface_cracks", "wall_thinning", "internal_erosion"],
    surface_access: "direct_or_remote",
    surface_prep: "none",
    personnel_cert: "VT Level II or API 510/570/653",
    code_basis: ["API 510", "API 570", "API 653"],
    proof_value: "SCREENING",
    limitations: ["Surface only", "Subjective", "Cannot quantify wall loss"]
  },
  {
    method: "RT",
    full_name: "Radiographic Testing",
    damage_modes: ["internal_corrosion", "erosion", "weld_defects", "porosity", "inclusions"],
    cannot_detect: ["tight_cracks_parallel_to_beam", "SCC_perpendicular_to_surface"],
    surface_access: "two_sides_or_panoramic",
    surface_prep: "none",
    personnel_cert: "RT Level II",
    code_basis: ["ASME V Article 2", "API 1104", "AWS D1.1"],
    proof_value: "DECISION_GRADE",
    limitations: ["Radiation safety exclusion zone", "Two-side access often needed", "Crack orientation dependent"]
  },
  {
    method: "EC",
    full_name: "Eddy Current Testing",
    damage_modes: ["surface_cracks", "near_surface_cracks", "corrosion_under_coatings", "heat_exchanger_tube_wall_loss"],
    cannot_detect: ["deep_subsurface_defects", "volumetric_defects"],
    surface_access: "one_side",
    surface_prep: "minimal",
    personnel_cert: "ET Level II",
    code_basis: ["ASME V Article 8", "ASTM E309"],
    proof_value: "DECISION_GRADE",
    limitations: ["Conductive materials only", "Depth penetration limited", "Lift-off sensitive"]
  },
  {
    method: "AE",
    full_name: "Acoustic Emission Testing",
    damage_modes: ["active_cracking", "leak_detection", "fiber_breakage_composites", "corrosion_activity"],
    cannot_detect: ["static_defects", "dormant_cracks", "wall_thickness"],
    surface_access: "sensor_mount_points",
    surface_prep: "sensor_coupling",
    personnel_cert: "AE Level II",
    code_basis: ["ASME V Article 12", "ASTM E569"],
    proof_value: "MONITORING_GRADE",
    limitations: ["Detects active damage only", "Requires loading", "High noise susceptibility"]
  },
  {
    method: "GWT",
    full_name: "Guided Wave Testing",
    damage_modes: ["general_corrosion_screening", "CUI_screening", "erosion_screening"],
    cannot_detect: ["cracking", "localised_pitting_below_5pct", "small_defects"],
    surface_access: "ring_mount",
    surface_prep: "insulation_removal_at_collar",
    personnel_cert: "GWT Level II",
    code_basis: ["ASTM E2775", "BS 9690"],
    proof_value: "SCREENING",
    limitations: ["Screening only", "Cannot size accurately", "Follow-up UT required for indications"]
  },
  {
    method: "CP_SURVEY",
    full_name: "Cathodic Protection Survey",
    damage_modes: ["CP_system_degradation", "anode_depletion", "coating_breakdown_subsea"],
    cannot_detect: ["mechanical_damage", "fatigue", "erosion"],
    surface_access: "ROV_or_diver",
    surface_prep: "none",
    personnel_cert: "CP Specialist / NACE CP2",
    code_basis: ["NACE SP0176", "DNV-RP-B401", "ISO 15589-2"],
    proof_value: "DECISION_GRADE",
    limitations: ["Measures protection potential only", "Does not measure wall loss", "Access dependent"]
  },
  {
    method: "ROV_VISUAL",
    full_name: "ROV Visual Inspection (Subsea)",
    damage_modes: ["marine_growth", "scour", "free_spans", "anode_condition", "structural_deformation_subsea"],
    cannot_detect: ["internal_corrosion", "wall_thinning", "subsurface_cracks"],
    surface_access: "subsea_ROV",
    surface_prep: "marine_growth_cleaning",
    personnel_cert: "ROV Pilot + Inspector",
    code_basis: ["API RP 2I", "DNV-RP-F116", "ISO 19901-9"],
    proof_value: "SCREENING",
    limitations: ["Visual only", "Turbidity dependent", "Cannot quantify wall loss"]
  }
];

// ============================================================
// PRIORITY SCORING ENGINE
// Ranks workpack items by criticality
// ============================================================
function scorePriority(item) {
  var score = 0;

  // Consequence weighting
  var conseq = (item.consequence || "").toUpperCase();
  if (conseq === "CATASTROPHIC") score = score + 100;
  else if (conseq === "MAJOR") score = score + 75;
  else if (conseq === "MODERATE") score = score + 50;
  else if (conseq === "MINOR") score = score + 25;

  // Proof gap severity
  var proofGap = (item.proof_gap_type || "").toUpperCase();
  if (proofGap === "NO_PROOF") score = score + 80;
  else if (proofGap === "BROKEN") score = score + 60;
  else if (proofGap === "PROVISIONAL") score = score + 40;
  else if (proofGap === "WEAK") score = score + 20;

  // Governance lock failure
  if (item.governance_condition_failed) score = score + 30;

  // Human exposure
  if (item.human_exposure) score = score + 40;

  // Time sensitivity
  var urgency = (item.urgency || "").toUpperCase();
  if (urgency === "IMMEDIATE") score = score + 60;
  else if (urgency === "24H") score = score + 45;
  else if (urgency === "7D") score = score + 30;
  else if (urgency === "30D") score = score + 15;

  return score;
}

function assignPriority(score) {
  if (score >= 200) return "CRITICAL";
  if (score >= 150) return "HIGH";
  if (score >= 100) return "MEDIUM";
  return "LOW";
}

// ============================================================
// METHOD SELECTOR
// Picks the best NDT method for a given damage mode + component
// ============================================================
function selectMethods(damageMode, component, environment, constraints) {
  var selected = [];
  var dm = (damageMode || "").toLowerCase();
  var env = (environment || "").toLowerCase();

  for (var i = 0; i < METHOD_MATRIX.length; i++) {
    var method = METHOD_MATRIX[i];
    var match = false;

    for (var d = 0; d < method.damage_modes.length; d++) {
      if (method.damage_modes[d].indexOf(dm) >= 0 || dm.indexOf(method.damage_modes[d]) >= 0) {
        match = true;
        break;
      }
    }

    if (match) {
      // Check environment compatibility
      var envOk = true;
      if (env.indexOf("subsea") >= 0 && method.surface_access !== "subsea_ROV" && method.surface_access !== "ROV_or_diver") {
        envOk = false;
      }

      // Check material constraint
      if (constraints && constraints.non_ferromagnetic && method.material_requirement === "ferromagnetic") {
        envOk = false;
      }

      if (envOk) {
        selected.push({
          method: method.method,
          full_name: method.full_name,
          proof_value: method.proof_value,
          code_basis: method.code_basis,
          personnel_cert: method.personnel_cert,
          limitations: method.limitations
        });
      }
    }
  }

  // Sort by proof value — DECISION_GRADE first
  selected.sort(function(a, b) {
    var order = { "DECISION_GRADE": 1, "DECISION_GRADE_SURFACE_ONLY": 2, "MONITORING_GRADE": 3, "SCREENING": 4 };
    var oa = order[a.proof_value] || 5;
    var ob = order[b.proof_value] || 5;
    return oa - ob;
  });

  return selected;
}

// ============================================================
// PLAN GENERATOR
// Takes proof engine output and generates a complete workpack
// ============================================================
function generateWorkpack(input) {
  var items = [];
  var itemNumber = 1;

  // Source 1: Component proof chains with insufficient proof
  var components = input.component_proof_summary || input.component_proof_chains || {};
  var componentKeys = Object.keys(components);
  for (var c = 0; c < componentKeys.length; c++) {
    var compName = componentKeys[c];
    var compData = components[compName];
    var compStatus = "";
    if (typeof compData === "string") {
      compStatus = compData;
    } else if (compData && compData.component_status) {
      compStatus = compData.component_status;
    } else if (compData && compData.proof_strength) {
      compStatus = compData.proof_strength;
    }

    if (compStatus.indexOf("INSUFFICIENT") >= 0 || compStatus.indexOf("PROVISIONAL") >= 0 ||
        compStatus.indexOf("NO_PROOF") >= 0 || compStatus.indexOf("LOW") >= 0 || compStatus.indexOf("BROKEN") >= 0) {

      // Determine damage modes for this component
      var damageModes = [];
      if (compData && compData.disproof_tests) {
        for (var dt = 0; dt < compData.disproof_tests.length; dt++) {
          damageModes.push(compData.disproof_tests[dt]);
        }
      }

      // Default damage modes if not specified
      if (damageModes.length === 0) {
        if (compName.indexOf("riser") >= 0 || compName.indexOf("splash") >= 0) {
          damageModes = ["corrosion", "fatigue_cracks"];
        } else if (compName.indexOf("manifold") >= 0 || compName.indexOf("subsea") >= 0) {
          damageModes = ["corrosion", "scour"];
        } else if (compName.indexOf("structural") >= 0 || compName.indexOf("topsides") >= 0) {
          damageModes = ["corrosion", "CUI"];
        } else {
          damageModes = ["corrosion"];
        }
      }

      for (var dm = 0; dm < damageModes.length; dm++) {
        var methods = selectMethods(damageModes[dm], compName, input.environment || "", input.constraints || {});
        var primaryMethod = methods.length > 0 ? methods[0] : null;

        items.push({
          item_number: itemNumber,
          component: compName,
          damage_mode: damageModes[dm],
          inspection_method: primaryMethod ? primaryMethod.method : "ENGINEERING_ASSESSMENT",
          method_full_name: primaryMethod ? primaryMethod.full_name : "Engineering Assessment Required",
          method_justification: primaryMethod
            ? "Selected as highest proof-value method for " + damageModes[dm] + " detection. Proof value: " + primaryMethod.proof_value
            : "No automated method selection — engineering assessment required",
          proof_value: primaryMethod ? primaryMethod.proof_value : "NONE",
          code_basis: primaryMethod ? primaryMethod.code_basis.join(", ") : "N/A",
          personnel_cert: primaryMethod ? primaryMethod.personnel_cert : "Senior Engineer",
          proof_gap_closed: "Component proof chain for " + compName + " — current status: " + compStatus,
          proof_gap_type: compStatus.indexOf("NO_PROOF") >= 0 ? "NO_PROOF" : "PROVISIONAL",
          consequence: input.severity || "HIGH",
          urgency: input.urgency || "7D",
          human_exposure: false,
          governance_condition_failed: true,
          alternative_methods: methods.slice(1, 3),
          limitations: primaryMethod ? primaryMethod.limitations : []
        });

        itemNumber = itemNumber + 1;
      }
    }
  }

  // Source 2: Missing evidence from absence analysis
  var missing = input.missing_evidence || input.absence_analysis || [];
  if (missing && missing.missing_evidence) missing = missing.missing_evidence;
  if (typeof missing === "object" && !Array.isArray(missing)) {
    var missingArr = [];
    var mk = Object.keys(missing);
    for (var mi = 0; mi < mk.length; mi++) missingArr.push(missing[mk[mi]]);
    missing = missingArr;
  }

  for (var m = 0; m < missing.length; m++) {
    var missingItem = typeof missing[m] === "string" ? missing[m] : (missing[m].description || missing[m].evidence || String(missing[m]));
    var missingLower = missingItem.toLowerCase();

    // Check if we already have a workpack item covering this
    var alreadyCovered = false;
    for (var ac = 0; ac < items.length; ac++) {
      if (items[ac].proof_gap_closed.toLowerCase().indexOf(missingLower.substring(0, 20)) >= 0) {
        alreadyCovered = true;
        break;
      }
    }
    if (alreadyCovered) continue;

    var method = "ENGINEERING_ASSESSMENT";
    var methodName = "Engineering Assessment Required";
    if (missingLower.indexOf("ut") >= 0 || missingLower.indexOf("thickness") >= 0) {
      method = "UT_THICKNESS";
      methodName = "Ultrasonic Thickness Measurement";
    } else if (missingLower.indexOf("cp") >= 0 || missingLower.indexOf("cathodic") >= 0) {
      method = "CP_SURVEY";
      methodName = "Cathodic Protection Survey";
    } else if (missingLower.indexOf("material") >= 0 || missingLower.indexOf("cert") >= 0) {
      method = "PMI";
      methodName = "Positive Material Identification";
    }

    items.push({
      item_number: itemNumber,
      component: "GENERAL",
      damage_mode: "data_gap",
      inspection_method: method,
      method_full_name: methodName,
      method_justification: "Required to close evidence gap: " + missingItem,
      proof_value: method === "ENGINEERING_ASSESSMENT" ? "NONE" : "DECISION_GRADE",
      code_basis: "N/A",
      proof_gap_closed: missingItem,
      proof_gap_type: "NO_PROOF",
      consequence: input.severity || "HIGH",
      urgency: "7D",
      human_exposure: false,
      governance_condition_failed: true,
      alternative_methods: [],
      limitations: []
    });
    itemNumber = itemNumber + 1;
  }

  // Source 3: Proof breaks
  var proofBreaks = input.proof_breaks || [];
  for (var pb = 0; pb < proofBreaks.length; pb++) {
    var brk = proofBreaks[pb];
    var brkType = brk.type || brk;
    var brkDesc = brk.description || String(brk);

    if (typeof brkType === "string" && brkType.indexOf("NO_METHOD_OBSERVABILITY") >= 0) {
      // Already handled by component proof chains
      continue;
    }

    if (typeof brkType === "string" && brkType.indexOf("STALE_STANDARDS") >= 0) {
      items.push({
        item_number: itemNumber,
        component: "DOCUMENTATION",
        damage_mode: "standards_gap",
        inspection_method: "DOCUMENT_REVIEW",
        method_full_name: "Standards Verification Review",
        method_justification: "Required to resolve standards proof break: " + brkDesc,
        proof_value: "GOVERNANCE",
        code_basis: "N/A",
        proof_gap_closed: "Standards source authority — " + brkDesc,
        proof_gap_type: "BROKEN",
        consequence: "HIGH",
        urgency: "7D",
        human_exposure: false,
        governance_condition_failed: true,
        alternative_methods: [],
        limitations: []
      });
      itemNumber = itemNumber + 1;
    }
  }

  // Score and prioritize
  for (var s = 0; s < items.length; s++) {
    var pScore = scorePriority(items[s]);
    items[s].priority_score = pScore;
    items[s].priority = assignPriority(pScore);
  }

  // Sort by priority score descending
  items.sort(function(a, b) { return b.priority_score - a.priority_score; });

  // Renumber after sort
  for (var r = 0; r < items.length; r++) {
    items[r].item_number = r + 1;
  }

  return items;
}

// ============================================================
// HANDLER
// ============================================================
export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return errResp(405, "POST only");

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "";

    // ---- get_registry ----
    if (action === "get_registry") {
      return ok({
        engine: "inspection-planning-proof",
        version: ENGINE_VERSION,
        description: "Closes the loop from proof gaps to defensible inspection workpacks. Takes Superbrain v5 output and generates prioritized, method-specific inspection plans with proof-chain traceability.",
        actions: ["get_registry", "generate_plan", "get_method_matrix", "get_access_methods", "prioritize_workpack", "estimate_plan", "get_plan", "get_plan_history"],
        ndt_methods: METHOD_MATRIX.length,
        priority_levels: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
        proof_gap_types: ["NO_PROOF", "BROKEN", "PROVISIONAL", "WEAK"],
        status: "operational"
      });
    }

    // ---- get_method_matrix ----
    if (action === "get_method_matrix") {
      var filterDamage = body.damage_mode || null;
      var result = METHOD_MATRIX;
      if (filterDamage) {
        result = [];
        for (var fm = 0; fm < METHOD_MATRIX.length; fm++) {
          for (var fd = 0; fd < METHOD_MATRIX[fm].damage_modes.length; fd++) {
            if (METHOD_MATRIX[fm].damage_modes[fd].indexOf(filterDamage) >= 0) {
              result.push(METHOD_MATRIX[fm]);
              break;
            }
          }
        }
      }
      return ok({ engine: "inspection-planning-proof", method_count: result.length, methods: result });
    }

    // ---- generate_plan ----
    if (action === "generate_plan") {
      var input = body.input || body;
      if (!input.component_proof_summary && !input.component_proof_chains && !input.missing_evidence && !input.proof_breaks) {
        return errResp(400, "Input must contain at least one of: component_proof_summary, component_proof_chains, missing_evidence, proof_breaks");
      }

      var workpackItems = generateWorkpack(input);

      var plan = {
        engine: "inspection-planning-proof",
        version: ENGINE_VERSION,
        generated_at: new Date().toISOString(),
        input_severity: input.severity || "UNKNOWN",
        total_items: workpackItems.length,
        priority_summary: {
          CRITICAL: 0,
          HIGH: 0,
          MEDIUM: 0,
          LOW: 0
        },
        proof_gaps_addressed: [],
        governance_gaps_addressed: [],
        workpack: workpackItems
      };

      // Build summaries
      var gapSet = {};
      for (var wi = 0; wi < workpackItems.length; wi++) {
        plan.priority_summary[workpackItems[wi].priority] = (plan.priority_summary[workpackItems[wi].priority] || 0) + 1;
        if (workpackItems[wi].proof_gap_closed && !gapSet[workpackItems[wi].proof_gap_closed]) {
          plan.proof_gaps_addressed.push(workpackItems[wi].proof_gap_closed);
          gapSet[workpackItems[wi].proof_gap_closed] = true;
        }
        if (workpackItems[wi].governance_condition_failed) {
          plan.governance_gaps_addressed.push(workpackItems[wi].component + ": " + workpackItems[wi].damage_mode);
        }
      }

      // Store plan if Supabase available
      if (supabaseUrl && supabaseKey) {
        var sb = createClient(supabaseUrl, supabaseKey);
        var planInsert = await sb.from("inspection_plans").insert({
          case_id: body.case_id || null,
          session_id: body.session_id || null,
          plan_status: "draft",
          priority_ranking: plan.priority_summary,
          workpack_items: workpackItems,
          method_selections: {},
          proof_gaps_addressed: plan.proof_gaps_addressed,
          governance_gaps_addressed: plan.governance_gaps_addressed
        }).select("id").single();

        if (planInsert.data) {
          plan.plan_id = planInsert.data.id;
        }
      }

      return ok(plan);
    }

    // ---- prioritize_workpack ----
    if (action === "prioritize_workpack") {
      var items = body.workpack || [];
      for (var pi = 0; pi < items.length; pi++) {
        var ps = scorePriority(items[pi]);
        items[pi].priority_score = ps;
        items[pi].priority = assignPriority(ps);
      }
      items.sort(function(a, b) { return b.priority_score - a.priority_score; });
      for (var pn = 0; pn < items.length; pn++) items[pn].item_number = pn + 1;
      return ok({ engine: "inspection-planning-proof", total_items: items.length, workpack: items });
    }

    // ---- estimate_plan ----
    if (action === "estimate_plan") {
      var wpItems = body.workpack || [];
      var totalHours = 0;
      var totalCost = 0;
      var estimates = [];
      for (var ei = 0; ei < wpItems.length; ei++) {
        var est = { item_number: wpItems[ei].item_number || ei + 1, component: wpItems[ei].component, method: wpItems[ei].inspection_method };
        // Base estimates by method
        var meth = (wpItems[ei].inspection_method || "").toUpperCase();
        if (meth === "UT_THICKNESS") { est.hours = 2; est.cost = 800; }
        else if (meth === "PAUT") { est.hours = 4; est.cost = 2500; }
        else if (meth === "TOFD") { est.hours = 4; est.cost = 2000; }
        else if (meth === "MPI") { est.hours = 1.5; est.cost = 600; }
        else if (meth === "PT") { est.hours = 1; est.cost = 400; }
        else if (meth === "RT") { est.hours = 3; est.cost = 1800; }
        else if (meth === "EC") { est.hours = 2; est.cost = 1200; }
        else if (meth === "GWT") { est.hours = 3; est.cost = 3000; }
        else if (meth === "CP_SURVEY") { est.hours = 8; est.cost = 5000; }
        else if (meth === "ROV_VISUAL") { est.hours = 12; est.cost = 15000; }
        else if (meth === "AE") { est.hours = 8; est.cost = 4000; }
        else { est.hours = 2; est.cost = 1000; }

        // Scaffolding multiplier
        if (wpItems[ei].scaffolding_required) { est.hours = est.hours + 4; est.cost = est.cost + 3000; }

        totalHours = totalHours + est.hours;
        totalCost = totalCost + est.cost;
        estimates.push(est);
      }
      return ok({ engine: "inspection-planning-proof", total_items: estimates.length, total_hours: totalHours, total_cost_usd: totalCost, note: "Estimates are indicative. Actual costs depend on location, access, and mobilization.", items: estimates });
    }

    // ---- get_plan ----
    if (action === "get_plan") {
      if (!body.plan_id) return errResp(400, "plan_id required");
      if (!supabaseUrl || !supabaseKey) return errResp(500, "SUPABASE not configured");
      var sb2 = createClient(supabaseUrl, supabaseKey);
      var planRes = await sb2.from("inspection_plans").select("*").eq("id", body.plan_id).single();
      if (planRes.error || !planRes.data) return errResp(404, "Plan not found");
      return ok({ engine: "inspection-planning-proof", plan: planRes.data });
    }

    // ---- get_plan_history ----
    if (action === "get_plan_history") {
      if (!body.case_id) return errResp(400, "case_id required");
      if (!supabaseUrl || !supabaseKey) return errResp(500, "SUPABASE not configured");
      var sb3 = createClient(supabaseUrl, supabaseKey);
      var histRes = await sb3.from("inspection_plans").select("id, plan_status, priority_ranking, created_at").eq("case_id", body.case_id).order("created_at", { ascending: false });
      return ok({ engine: "inspection-planning-proof", case_id: body.case_id, plans: histRes.data || [] });
    }

    // ---- get_access_methods ----
    if (action === "get_access_methods") {
      return ok({
        engine: "inspection-planning-proof",
        access_methods: [
          { method: "DIRECT", description: "Direct access from grade or deck", scaffold: false, isolation: false, typical_setup_hours: 0 },
          { method: "SCAFFOLD", description: "Scaffolding required for elevated access", scaffold: true, isolation: false, typical_setup_hours: 8 },
          { method: "ROPE_ACCESS", description: "Rope access for difficult locations", scaffold: false, isolation: false, typical_setup_hours: 2 },
          { method: "ROV", description: "Remotely operated vehicle for subsea", scaffold: false, isolation: false, typical_setup_hours: 4 },
          { method: "CONFINED_SPACE", description: "Confined space entry required", scaffold: false, isolation: true, typical_setup_hours: 4 },
          { method: "HOT_TAP", description: "On-stream inspection via hot tap", scaffold: false, isolation: false, typical_setup_hours: 6 },
          { method: "SHUTDOWN_ONLY", description: "Requires full shutdown and isolation", scaffold: false, isolation: true, typical_setup_hours: 24 }
        ]
      });
    }

    return errResp(400, "Unknown action: " + action + ". Use get_registry for available actions.");

  } catch (err) {
    return errResp(500, String(err && err.message ? err.message : err));
  }
};
