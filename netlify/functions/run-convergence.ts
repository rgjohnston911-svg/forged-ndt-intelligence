/**
 * DEPLOY26_run-convergence.ts
 * Deploy to: netlify/functions/run-convergence.ts
 *
 * REALITY CONVERGENCE ENGINE v1
 *
 * Takes AI findings + physics + process context and determines
 * the single most physically valid inspection reality.
 *
 * Pipeline: Observations -> Hypotheses -> Scoring -> Elimination -> Convergence
 *
 * CRITICAL: String concatenation only. No backtick template literals.
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

/* ================================================================
   DEFECT KNOWLEDGE BASE
   16 defect types with physics signatures
   ================================================================ */

var DEFECT_KB: Record<string, any> = {
  crack: {
    locations: ["weld_toe", "weld_root", "haz", "centerline"],
    morphology: ["linear", "sharp", "surface-breaking", "branched"],
    processes: ["all"],
    contradictions: ["rounded", "uniformly spherical"],
    hard_reject: true,
    causes: ["hydrogen", "restraint", "rapid cooling", "stress concentration", "crater termination"],
    basis: "Sharp-tipped discontinuity creating severe stress concentration. Non-permissible across most codes."
  },
  undercut: {
    locations: ["weld_toe"],
    morphology: ["toe-groove", "linear", "edge-depression", "surface-breaking"],
    processes: ["SMAW", "GMAW", "FCAW", "GTAW"],
    contradictions: ["internal", "rounded isolated pore"],
    hard_reject: false,
    causes: ["excessive travel speed", "high amperage", "poor electrode angle", "arc blow"],
    basis: "Groove melted into base metal at weld toe. Critical due to section loss or fatigue initiation depending on loading."
  },
  porosity: {
    locations: ["throughout_weld", "weld_face", "internal", "centerline"],
    morphology: ["rounded", "spherical", "clustered", "gas-pocket"],
    processes: ["GMAW", "FCAW", "GTAW", "SMAW"],
    contradictions: ["sharp planar line", "toe-groove"],
    hard_reject: false,
    causes: ["contamination", "poor shielding", "moisture", "long arc", "dirty base metal"],
    basis: "Volumetric gas-related discontinuity. Rounded voids with SCF ~2.0 vs infinite for cracks."
  },
  slag_inclusion: {
    locations: ["between_passes", "sidewall", "internal", "weld_root"],
    morphology: ["linear", "elongated", "interpass", "nonmetallic-trap"],
    processes: ["SMAW", "FCAW", "SAW"],
    contradictions: ["single toe groove", "isolated rounded pore"],
    hard_reject: false,
    causes: ["poor interpass cleaning", "low heat input", "poor manipulation", "improper bead placement"],
    basis: "Nonmetallic entrapped materials associated with multi-pass welds and slag-forming processes."
  },
  incomplete_fusion: {
    locations: ["sidewall", "between_passes", "weld_root", "groove_face"],
    morphology: ["planar", "linear", "unbonded-interface", "sharp"],
    processes: ["all"],
    contradictions: ["rounded void", "surface toe groove only"],
    hard_reject: true,
    causes: ["low heat input", "poor angle", "poor access", "oxide contamination", "improper pass sequence"],
    basis: "Planar unbonded interface behaving like a crack under load. Zero cross-section in through-thickness direction."
  },
  incomplete_penetration: {
    locations: ["weld_root", "centerline", "internal"],
    morphology: ["root-line", "linear", "planar", "unbonded-root"],
    processes: ["all"],
    contradictions: ["toe-groove", "rounded face porosity"],
    hard_reject: true,
    causes: ["poor root opening", "low amperage", "poor fit-up", "excessive land", "misalignment"],
    basis: "Reduces effective throat. Root remains partially unbonded. Critical in pressure-retaining applications."
  },
  overlap: {
    locations: ["weld_toe", "cap"],
    morphology: ["rolled-edge", "lip", "metal-overhang", "unfused-toe"],
    processes: ["SMAW", "FCAW", "GMAW"],
    contradictions: ["internal indication", "rounded pore"],
    hard_reject: true,
    causes: ["slow travel speed", "poor angle", "excess deposition", "low manipulation control"],
    basis: "Unfused metal beyond the weld toe creating a mechanical notch. Non-permissible because it indicates lack of fusion."
  },
  reinforcement_excess: {
    locations: ["cap", "weld_face"],
    morphology: ["convex", "height-excess", "crown-high"],
    processes: ["all"],
    contradictions: ["internal planar line"],
    hard_reject: false,
    causes: ["slow travel speed", "excess filler", "poor parameter balance"],
    basis: "Creates stress concentration at weld toe due to abrupt geometric transition."
  },
  burn_through: {
    locations: ["weld_root", "internal", "centerline"],
    morphology: ["root-hole", "excess root melt", "drop-through"],
    processes: ["GTAW", "GMAW", "SMAW"],
    contradictions: ["toe groove only"],
    hard_reject: false,
    causes: ["excessive heat", "poor fit-up", "thin wall", "slow travel"],
    basis: "Compromises root profile and wall integrity. Root inaccessible for repair after installation."
  },
  arc_strike: {
    locations: ["haz", "surface"],
    morphology: ["localized melt spot", "surface strike", "small crater"],
    processes: ["SMAW", "FCAW", "GMAW"],
    contradictions: ["internal only"],
    hard_reject: false,
    causes: ["poor arc start/stop discipline", "grounding issues"],
    basis: "Creates hardened local zones and crack initiation risk depending on material and service."
  },
  spatter: {
    locations: ["surface", "haz", "cap"],
    morphology: ["small globules", "scattered deposits", "surface-adhered"],
    processes: ["GMAW", "FCAW", "SMAW"],
    contradictions: ["planar internal line"],
    hard_reject: false,
    causes: ["parameter instability", "long arc", "poor gas coverage"],
    basis: "Generally superficial unless service or code-specific cleanliness requirements apply."
  },
  cluster_porosity: {
    locations: ["weld_face", "internal", "centerline"],
    morphology: ["clustered", "rounded", "multiple gas pockets"],
    processes: ["GMAW", "FCAW", "GTAW"],
    contradictions: ["sharp single planar line"],
    hard_reject: false,
    causes: ["localized contamination", "unstable shielding gas", "moisture"],
    basis: "Grouped gas discontinuity pattern distinct from isolated pore indications."
  },
  lack_of_sidewall_fusion: {
    locations: ["sidewall"],
    morphology: ["planar", "linear", "unbonded-interface"],
    processes: ["all"],
    contradictions: ["rounded pore"],
    hard_reject: true,
    causes: ["poor angle", "low heat input", "poor access"],
    basis: "Planar discontinuity critically reducing bond integrity at the fusion boundary."
  },
  lamination: {
    locations: ["internal"],
    morphology: ["planar", "rolled-in", "base-metal discontinuity"],
    processes: ["all"],
    contradictions: ["toe groove"],
    hard_reject: false,
    causes: ["parent material defect from rolling"],
    basis: "Base metal discontinuity related to rolling that can affect fitness for service."
  },
  distortion: {
    locations: ["unknown"],
    morphology: ["warpage", "misalignment", "angular change"],
    processes: ["all"],
    contradictions: [],
    hard_reject: false,
    causes: ["heat imbalance", "restraint", "sequence error"],
    basis: "Results from thermal expansion/contraction imbalance rather than classic discontinuity."
  },
  unknown_discontinuity: {
    locations: ["unknown"],
    morphology: [],
    processes: ["all"],
    contradictions: [],
    hard_reject: false,
    causes: ["undetermined"],
    basis: "Requires additional method confirmation before deterministic disposition."
  }
};

/* ================================================================
   SCORING WEIGHTS AND THRESHOLDS
   ================================================================ */

var W_EVIDENCE = 0.24;
var W_LOCATION = 0.14;
var W_MORPHOLOGY = 0.18;
var W_PROCESS = 0.14;
var W_MATERIAL = 0.10;
var W_METHOD = 0.10;
var W_CRITICALITY = 0.10;

var T_RESOLVED = 0.78;
var T_PROBABLE = 0.64;
var T_GAP_RESOLVED = 0.12;
var T_GAP_PROBABLE = 0.08;

/* ================================================================
   HELPER FUNCTIONS
   ================================================================ */

function clamp(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function avgArr(values: number[]): number {
  if (!values.length) return 0;
  var sum = 0;
  for (var i = 0; i < values.length; i++) sum += values[i];
  return sum / values.length;
}

function hasAny(haystack: string[], needles: string[]): boolean {
  for (var i = 0; i < needles.length; i++) {
    for (var j = 0; j < haystack.length; j++) {
      if (haystack[j].toLowerCase() === needles[i].toLowerCase()) return true;
    }
  }
  return false;
}

function isSlagProcess(p: string): boolean {
  return p === "SMAW" || p === "FCAW" || p === "SAW";
}

/* ================================================================
   SCORING FUNCTIONS
   ================================================================ */

function scoreEvidence(defectType: string, findings: any[]): number {
  var matches = findings.filter(function(f) { return f.defect_type === defectType; });
  if (!matches.length) return 0.20;
  return clamp(avgArr(matches.map(function(m) { return m.confidence || 0; })));
}

function scoreLocation(defectType: string, findings: any[]): any {
  var kb = DEFECT_KB[defectType];
  if (!kb) return { score: 0.25, reasons: [], rejections: [] };
  var matches = findings.filter(function(f) { return f.defect_type === defectType; });
  var reasons: string[] = [];
  var rejections: string[] = [];

  if (!matches.length) {
    rejections.push("No finding supports this location pattern.");
    return { score: 0.25, reasons: reasons, rejections: rejections };
  }

  var scores = matches.map(function(m) {
    var loc = m.location || "unknown";
    if (kb.locations.indexOf(loc) >= 0) {
      reasons.push("Location '" + loc + "' aligns with expected " + defectType + " behavior.");
      return 1.0;
    }
    rejections.push("Location '" + loc + "' is atypical for " + defectType + ".");
    return 0.25;
  });

  return { score: clamp(avgArr(scores)), reasons: reasons, rejections: rejections };
}

function scoreMorphology(defectType: string, findings: any[]): any {
  var kb = DEFECT_KB[defectType];
  if (!kb) return { score: 0.25, reasons: [], rejections: [] };
  var matches = findings.filter(function(f) { return f.defect_type === defectType; });
  var reasons: string[] = [];
  var rejections: string[] = [];

  if (!matches.length) {
    rejections.push("No morphology directly supports this hypothesis.");
    return { score: 0.25, reasons: reasons, rejections: rejections };
  }

  var scores = matches.map(function(m) {
    var tags = m.morphology_tags || [];
    var positiveHits = 0;
    var contradictionHits = 0;

    for (var i = 0; i < kb.morphology.length; i++) {
      if (tags.indexOf(kb.morphology[i]) >= 0) positiveHits++;
    }
    for (var j = 0; j < (kb.contradictions || []).length; j++) {
      if (tags.indexOf(kb.contradictions[j]) >= 0) contradictionHits++;
    }

    if (positiveHits > 0) {
      reasons.push("Morphology tags [" + tags.join(", ") + "] support " + defectType + ".");
    }
    if (contradictionHits > 0) {
      rejections.push("Morphology tags [" + tags.join(", ") + "] contradict " + defectType + ".");
    }

    var base = positiveHits > 0 ? Math.min(1, 0.55 + positiveHits * 0.15) : 0.25;
    base = base - contradictionHits * 0.25;
    return clamp(base);
  });

  return { score: avgArr(scores), reasons: reasons, rejections: rejections };
}

function scoreProcess(defectType: string, process: any): any {
  var kb = DEFECT_KB[defectType];
  if (!kb) return { score: 0.5, reasons: [], rejections: [], causes: [] };
  var reasons: string[] = [];
  var rejections: string[] = [];
  var causes: string[] = kb.causes.slice(0);
  var p = process.process || "unknown";
  var score = 0.5;

  if (kb.processes.indexOf("all") >= 0) {
    score = 0.75;
    reasons.push(defectType + " can occur across multiple welding processes.");
  } else if (kb.processes.indexOf(p) >= 0) {
    score = 0.95;
    reasons.push(p + " is strongly associated with " + defectType + ".");
  } else {
    score = 0.30;
    rejections.push(p + " is not a strong process affinity for " + defectType + ".");
  }

  if (defectType === "slag_inclusion") {
    if (isSlagProcess(p)) {
      score += 0.05;
      reasons.push("Slag-forming process increases plausibility.");
    } else {
      score -= 0.20;
      rejections.push("Non-slag-forming process weakens slag hypothesis.");
    }
    if (process.interpass_cleaning_confirmed === false) {
      score += 0.08;
      reasons.push("Missing interpass cleaning supports slag entrapment.");
    }
  }

  if (defectType === "undercut") {
    if (process.travel_speed_relative === "fast") { score += 0.08; reasons.push("Fast travel speed supports undercut."); }
    if (process.amperage_relative === "high") { score += 0.08; reasons.push("High amperage supports toe washout."); }
  }

  if (defectType === "incomplete_fusion" || defectType === "lack_of_sidewall_fusion") {
    if (process.heat_input_relative === "low") { score += 0.08; reasons.push("Low heat input supports fusion deficiency."); }
  }

  return { score: clamp(score), reasons: reasons, rejections: rejections, causes: causes };
}

function scoreMaterial(defectType: string, material: any): any {
  var reasons: string[] = [];
  var rejections: string[] = [];
  var score = 0.65;

  if (defectType === "undercut" && material.thermal_conductivity_w_mk && material.thermal_conductivity_w_mk > 35) {
    score += 0.05;
    reasons.push("Higher thermal conductivity affects toe heat dissipation patterns.");
  }
  if (defectType === "crack" && (material.material_class === "carbon_steel" || material.material_class === "low_alloy_steel")) {
    score += 0.08;
    reasons.push("Steel with cooling sensitivity supports crack plausibility under adverse conditions.");
  }
  if (defectType === "porosity" || defectType === "cluster_porosity") {
    reasons.push("Gas entrapment plausible across common weldable materials.");
  }

  return { score: clamp(score), reasons: reasons, rejections: rejections };
}

function scoreMethod(defectType: string, method: string): any {
  var reasons: string[] = [];
  var rejections: string[] = [];
  var score = 0.65;

  if (method === "VT") {
    var surfaceTypes = ["undercut", "overlap", "reinforcement_excess", "spatter", "arc_strike"];
    var internalTypes = ["incomplete_fusion", "incomplete_penetration", "slag_inclusion", "lamination"];

    if (surfaceTypes.indexOf(defectType) >= 0) {
      score = 0.92;
      reasons.push("VT is well-suited for surface/profile indications like " + defectType + ".");
    } else if (internalTypes.indexOf(defectType) >= 0) {
      score = 0.42;
      rejections.push("VT is limited for confirming internal/subsurface conditions like " + defectType + ".");
    } else if (defectType === "crack") {
      score = 0.80;
      reasons.push("VT can detect surface-breaking cracks when visibility is adequate.");
    } else if (defectType === "porosity") {
      score = 0.70;
      reasons.push("VT can detect surface porosity but not internal.");
    }
  }

  return { score: score, reasons: reasons, rejections: rejections };
}

function scoreCriticality(defectType: string, loadingType: string, codeFamily: string): number {
  var kb = DEFECT_KB[defectType];
  if (!kb) return 0.5;
  var score = kb.hard_reject ? 1.0 : 0.55;
  if (defectType === "undercut" && (loadingType === "dynamic" || loadingType === "cyclic")) score += 0.10;
  if (defectType === "burn_through" && codeFamily === "API_1104") score += 0.10;
  return clamp(score);
}

function calcContradictionPenalty(defectType: string, findings: any[], process: any, method: string): any {
  var reasons: string[] = [];
  var penalty = 0;

  if (defectType === "slag_inclusion" && !isSlagProcess(process.process || "")) {
    penalty += 0.18;
    reasons.push("Slag inclusion penalized: process is not slag-forming.");
  }
  if (defectType === "incomplete_penetration" && process.joint_type === "fillet") {
    penalty += 0.10;
    reasons.push("Incomplete penetration less applicable as primary label for fillet joints.");
  }
  if (defectType === "incomplete_fusion" && method === "VT") {
    var hasPlanar = false;
    for (var i = 0; i < findings.length; i++) {
      if ((findings[i].morphology_tags || []).indexOf("planar") >= 0) hasPlanar = true;
    }
    if (!hasPlanar) {
      penalty += 0.12;
      reasons.push("Incomplete fusion penalized: no planar morphology evidenced in VT.");
    }
  }
  if (defectType === "porosity") {
    for (var j = 0; j < findings.length; j++) {
      if ((findings[j].morphology_tags || []).indexOf("sharp") >= 0) {
        penalty += 0.12;
        reasons.push("Porosity penalized: sharp morphology inconsistent with rounded gas voids.");
        break;
      }
    }
  }

  return { penalty: clamp(penalty), reasons: reasons };
}

/* ================================================================
   HYPOTHESIS GENERATOR
   ================================================================ */

function generateCandidates(findings: any[]): string[] {
  var found: Record<string, boolean> = {};
  var candidates: Record<string, boolean> = {};

  for (var i = 0; i < findings.length; i++) {
    var dt = findings[i].defect_type;
    found[dt] = true;
    candidates[dt] = true;
  }

  // Add intelligent competitors
  if (found["undercut"]) { candidates["overlap"] = true; candidates["incomplete_fusion"] = true; }
  if (found["slag_inclusion"]) { candidates["incomplete_fusion"] = true; candidates["porosity"] = true; }
  if (found["porosity"]) { candidates["cluster_porosity"] = true; candidates["slag_inclusion"] = true; }
  if (found["incomplete_fusion"]) { candidates["lack_of_sidewall_fusion"] = true; candidates["slag_inclusion"] = true; }
  if (found["overlap"]) { candidates["undercut"] = true; }
  if (found["crack"]) { candidates["incomplete_fusion"] = true; }

  var result = Object.keys(candidates);
  if (result.length === 0) result.push("unknown_discontinuity");
  return result;
}

/* ================================================================
   METHOD ESCALATION
   ================================================================ */

function recommendNextMethod(primary: string, defect: string): string {
  if (primary === "VT") {
    var internalTypes = ["incomplete_fusion", "incomplete_penetration", "slag_inclusion", "lamination", "lack_of_sidewall_fusion"];
    if (internalTypes.indexOf(defect) >= 0) return "UT";
    if (defect === "crack") return "MT";
    return "PT";
  }
  if (primary === "MT") return "UT";
  if (primary === "PT") return "VT";
  if (primary === "UT") return "RT";
  if (primary === "RT") return "UT";
  return "UT";
}

/* ================================================================
   MAIN CONVERGENCE ENGINE
   ================================================================ */

function runConvergence(findings: any[], material: any, process: any, methodStr: string, codeFamily: string, loadingType: string): any {
  var candidates = generateCandidates(findings);
  var hypotheses: any[] = [];

  for (var c = 0; c < candidates.length; c++) {
    var dt = candidates[c];
    var evScore = scoreEvidence(dt, findings);
    var locResult = scoreLocation(dt, findings);
    var morResult = scoreMorphology(dt, findings);
    var proResult = scoreProcess(dt, process);
    var matResult = scoreMaterial(dt, material);
    var metResult = scoreMethod(dt, methodStr);
    var critScore = scoreCriticality(dt, loadingType, codeFamily);
    var contraResult = calcContradictionPenalty(dt, findings, process, methodStr);

    var total =
      evScore * W_EVIDENCE +
      locResult.score * W_LOCATION +
      morResult.score * W_MORPHOLOGY +
      proResult.score * W_PROCESS +
      matResult.score * W_MATERIAL +
      metResult.score * W_METHOD +
      critScore * W_CRITICALITY -
      contraResult.penalty;

    total = clamp(total);

    var supportReasons = locResult.reasons.concat(morResult.reasons).concat(proResult.reasons).concat(matResult.reasons).concat(metResult.reasons);
    var rejectReasons = locResult.rejections.concat(morResult.rejections).concat(proResult.rejections).concat(matResult.rejections).concat(metResult.rejections).concat(contraResult.reasons);

    hypotheses.push({
      defect_type: dt,
      plausible: total >= 0.45,
      scores: {
        evidence: evScore,
        location: locResult.score,
        morphology: morResult.score,
        process: proResult.score,
        material: matResult.score,
        method: metResult.score,
        criticality: critScore,
        contradiction: contraResult.penalty,
        total: total
      },
      support_reasons: supportReasons,
      rejection_reasons: rejectReasons,
      probable_causes: proResult.causes,
      why_it_fits: supportReasons.slice(0, 3).join(" "),
      why_not_fully: rejectReasons.slice(0, 2).join(" ") || null,
      engineering_basis: DEFECT_KB[dt] ? DEFECT_KB[dt].basis : ""
    });
  }

  // Sort by total score descending
  hypotheses.sort(function(a, b) { return b.scores.total - a.scores.total; });

  // Assign ranks
  for (var r = 0; r < hypotheses.length; r++) {
    hypotheses[r].rank = r + 1;
  }

  var top = hypotheses[0] || null;
  var second = hypotheses[1] || null;
  var gap = top && second ? top.scores.total - second.scores.total : 1.0;

  // Determine convergence status
  var status = "unresolved";
  var escalationReason = null;
  var nextMethod = null;

  if (!top) {
    status = "escalate";
    escalationReason = "No valid hypothesis generated.";
    nextMethod = "UT";
  } else if (top.scores.total >= T_RESOLVED && gap >= T_GAP_RESOLVED) {
    status = "resolved";
  } else if (top.scores.total >= T_PROBABLE && gap >= T_GAP_PROBABLE) {
    status = "probable";
  } else {
    status = "escalate";
    escalationReason = "Top hypotheses too close or insufficiently supported for reality lock. Score: " + top.scores.total.toFixed(2) + ", Gap: " + gap.toFixed(2);
    nextMethod = recommendNextMethod(methodStr, top.defect_type);
  }

  // Build eliminated alternatives
  var eliminated = [];
  for (var e = 1; e < hypotheses.length; e++) {
    eliminated.push({
      defect_type: hypotheses[e].defect_type,
      reasons: hypotheses[e].rejection_reasons.slice(0, 3)
    });
  }

  // Build summary
  var whyNotArr = eliminated.slice(0, 3).map(function(x) {
    var r = x.reasons.filter(function(s: string) { return s; }).join(" ");
    return x.defect_type + ": " + (r || "Lower overall physical consistency.");
  });

  var summary: any = {};
  if (!top) {
    summary = {
      what: "UNRESOLVED - No dominant physical reality established.",
      why: "No hypothesis achieved sufficient evidence and physics consistency.",
      why_not: whyNotArr,
      how: "Acquire higher quality evidence. Apply additional method" + (nextMethod ? " (" + nextMethod + ")" : "") + "."
    };
  } else if (status === "resolved") {
    summary = {
      what: "PRIMARY REALITY: " + top.defect_type.replace(/_/g, " ").toUpperCase(),
      why: "Highest total consistency score (" + top.scores.total.toFixed(2) + "), exceeded runner-up by " + gap.toFixed(2) + ". " + top.why_it_fits,
      why_not: whyNotArr,
      how: top.scores.criticality >= 0.9
        ? "Route to Inspection Authority Lock Engine for hard-reject evaluation."
        : "Collect required measurements and pass to Authority Lock Engine."
    };
  } else if (status === "probable") {
    summary = {
      what: "PROBABLE REALITY: " + top.defect_type.replace(/_/g, " ").toUpperCase(),
      why: "Leads convergence with score " + top.scores.total.toFixed(2) + " but margin is moderate (gap " + gap.toFixed(2) + ").",
      why_not: whyNotArr,
      how: "Proceed with measurement capture. Consider secondary method confirmation before final lock."
    };
  } else {
    summary = {
      what: "ESCALATE - Reality not sufficiently locked. " + top.defect_type.replace(/_/g, " ").toUpperCase() + " currently leads.",
      why: "Score " + top.scores.total.toFixed(2) + " insufficient for deterministic convergence, or gap to runner-up too small.",
      why_not: whyNotArr,
      how: "Apply secondary method" + (nextMethod ? " (" + nextMethod + ")" : "") + ". Gather more evidence. Rerun convergence."
    };
  }

  return {
    status: status,
    dominant_reality: top ? top.defect_type : null,
    dominant_score: top ? top.scores.total : null,
    runner_up: second ? second.defect_type : null,
    runner_up_score: second ? second.scores.total : null,
    agreement_gap: gap,
    hypotheses: hypotheses,
    eliminated: eliminated,
    escalation_reason: escalationReason,
    recommended_next_method: nextMethod,
    summary: summary
  };
}

/* ================================================================
   HANDLER
   ================================================================ */

var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var caseId = body.case_id;
    if (!caseId) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };
    }

    var supabase = createClient(supabaseUrl, supabaseKey);

    // Load case
    var caseResult = await supabase.from("inspection_cases").select("*").eq("id", caseId).single();
    var caseData = caseResult.data;
    if (!caseData) {
      return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "Case not found" }) };
    }

    // Load findings and normalize defect_type from label
    var findingsResult = await supabase.from("findings").select("*").eq("case_id", caseId);
    var rawFindings = findingsResult.data || [];

    var findings = rawFindings.map(function(f) {
      return {
        id: f.id,
        source: f.source,
        defect_type: (f.label || f.finding_type || "unknown").toLowerCase().replace(/ /g, "_"),
        location: (f.location_ref || "unknown").toLowerCase().replace(/ /g, "_"),
        severity: f.severity || "medium",
        confidence: f.confidence || 0.5,
        description: f.label || "",
        morphology_tags: f.structured_json && f.structured_json.morphology_tags ? f.structured_json.morphology_tags : []
      };
    });

    // Load physics model
    var physResult = await supabase.from("physics_reality_models").select("*").eq("case_id", caseId).single();
    var physData = physResult.data;

    var material = {
      material_class: caseData.material_class || "carbon_steel",
      ferromagnetic: physData && physData.material_properties_json ? physData.material_properties_json.ferromagnetic || false : false,
      density_kg_m3: physData && physData.material_properties_json ? physData.material_properties_json.density_kg_m3 || 7850 : 7850,
      acoustic_velocity_longitudinal_ms: physData && physData.material_properties_json ? physData.material_properties_json.acoustic_velocity_longitudinal_ms || 5900 : 5900,
      acoustic_velocity_shear_ms: physData && physData.material_properties_json ? physData.material_properties_json.acoustic_velocity_shear_ms || 3230 : 3230,
      acoustic_impedance_mrayl: physData && physData.material_properties_json ? physData.material_properties_json.acoustic_impedance || 46 : 46,
      attenuation_coefficient: physData && physData.material_properties_json ? physData.material_properties_json.attenuation_coefficient || 0.02 : 0.02,
      electrical_conductivity_ms_m: physData && physData.material_properties_json ? physData.material_properties_json.electrical_conductivity_ms_m || 6.99 : 6.99,
      magnetic_permeability: physData && physData.material_properties_json ? physData.material_properties_json.magnetic_permeability || 1000 : 1000,
      thermal_conductivity_w_mk: physData && physData.material_properties_json ? physData.material_properties_json.thermal_conductivity_w_mk || 46 : 46
    };

    var process = physData && physData.process_context_json ? physData.process_context_json : {};
    var methodStr = caseData.method || "VT";
    var codeFamily = caseData.code_family || "AWS_D1_1";
    var loadingType = caseData.load_condition || "unknown";

    // RUN THE ENGINE
    var result = runConvergence(findings, material, process, methodStr, codeFamily, loadingType);

    // Delete old convergence data for this case
    var oldRuns = await supabase.from("ndt_reality_runs").select("id").eq("case_id", caseId);
    if (oldRuns.data && oldRuns.data.length > 0) {
      for (var d = 0; d < oldRuns.data.length; d++) {
        await supabase.from("ndt_reality_hypotheses").delete().eq("reality_run_id", oldRuns.data[d].id);
        await supabase.from("ndt_reality_eliminations").delete().eq("reality_run_id", oldRuns.data[d].id);
      }
      await supabase.from("ndt_reality_runs").delete().eq("case_id", caseId);
    }

    // Store convergence run
    var runInsert = await supabase.from("ndt_reality_runs").insert({
      case_id: caseId,
      primary_method: methodStr,
      code_family: codeFamily,
      loading_type: loadingType,
      convergence_status: result.status,
      dominant_reality: result.dominant_reality,
      dominant_score: result.dominant_score,
      runner_up: result.runner_up,
      runner_up_score: result.runner_up_score,
      agreement_gap: result.agreement_gap,
      escalation_reason: result.escalation_reason,
      recommended_next_method: result.recommended_next_method,
      summary_what: result.summary.what,
      summary_why: result.summary.why,
      summary_why_not: result.summary.why_not,
      summary_how: result.summary.how,
      hypothesis_count: result.hypotheses.length,
      eliminated_count: result.eliminated.length
    }).select("id").single();

    if (runInsert.error) throw runInsert.error;
    var runId = runInsert.data.id;

    // Store hypotheses
    for (var h = 0; h < result.hypotheses.length; h++) {
      var hyp = result.hypotheses[h];
      await supabase.from("ndt_reality_hypotheses").insert({
        reality_run_id: runId,
        defect_type: hyp.defect_type,
        plausible: hyp.plausible,
        rank_position: hyp.rank,
        evidence_consistency: hyp.scores.evidence,
        location_consistency: hyp.scores.location,
        morphology_consistency: hyp.scores.morphology,
        process_consistency: hyp.scores.process,
        material_consistency: hyp.scores.material,
        method_consistency: hyp.scores.method,
        criticality_weight: hyp.scores.criticality,
        contradiction_penalty: hyp.scores.contradiction,
        total_score: hyp.scores.total,
        support_reasons: hyp.support_reasons,
        rejection_reasons: hyp.rejection_reasons,
        probable_causes: hyp.probable_causes,
        why_it_fits: hyp.why_it_fits,
        why_it_does_not_fully_fit: hyp.why_not_fully
      });
    }

    // Store eliminations
    for (var el = 0; el < result.eliminated.length; el++) {
      await supabase.from("ndt_reality_eliminations").insert({
        reality_run_id: runId,
        defect_type: result.eliminated[el].defect_type,
        reasons: result.eliminated[el].reasons
      });
    }

    // Update case
    await supabase.from("inspection_cases").update({
      convergence_status: result.status,
      dominant_reality: result.dominant_reality,
      dominant_score: result.dominant_score,
      convergence_run_id: runId
    }).eq("id", caseId);

    // Log event
    await supabase.from("case_events").insert({
      case_id: caseId,
      event_type: "convergence_completed",
      event_json: {
        status: result.status,
        dominant: result.dominant_reality,
        score: result.dominant_score,
        runner_up: result.runner_up,
        gap: result.agreement_gap,
        hypotheses_tested: result.hypotheses.length,
        eliminated: result.eliminated.length
      }
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: true,
        convergence_run_id: runId,
        result: result
      })
    };

  } catch (err: any) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || "run-convergence failed" })
    };
  }
};

export { handler };
