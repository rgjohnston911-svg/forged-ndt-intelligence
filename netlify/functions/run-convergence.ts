/**
 * DEPLOY32_run-convergence.ts
 * Deploy to: netlify/functions/run-convergence.ts (REPLACEMENT)
 *
 * REALITY CONVERGENCE ENGINE v2
 * Now with:
 * - Method-specific defect affinity tables (SMAW/GMAW/FCAW/GTAW/SAW)
 * - Visual Authority Layer (observable facts pre-filter)
 * - Evidence weight modifiers per welding method
 * - Suppressed discontinuity penalties
 * - Convergence threshold adjustments per method
 * - Tuned thresholds for VT-only evidence
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
   METHOD PHYSICS PROFILES
   Each method defines: slag system, shielding, typical/suppressed
   defects, evidence weight modifiers, convergence adjustments
   ================================================================ */

var METHOD_PROFILES: Record<string, any> = {
  SMAW: {
    slagSystem: true, externalGas: false, tungstenElectrode: false,
    typicalDefects: ["slag_inclusion", "porosity", "undercut", "spatter", "incomplete_fusion", "incomplete_penetration", "crater_defect", "arc_strike"],
    suppressedDefects: ["tungsten_inclusion"],
    evidenceWeights: { morphology: 1.25, location: 1.0, process: 1.25, material: 1.0, method: 1.3 },
    convergence: { lockBonus: 0.08, ambiguityReduction: 0.05, escalateAdjust: -0.03 },
    causes: ["electrode moisture", "long arc length", "poor rod angle", "poor slag removal", "contamination", "incorrect amperage", "poor restart technique"],
    teaching: ["arc length control", "travel angle", "work angle", "slag removal between passes", "rod manipulation", "moisture control"]
  },
  GMAW: {
    slagSystem: false, externalGas: true, tungstenElectrode: false,
    typicalDefects: ["porosity", "incomplete_fusion", "incomplete_penetration", "undercut", "overlap", "spatter", "burn_through"],
    suppressedDefects: ["slag_inclusion", "tungsten_inclusion"],
    evidenceWeights: { morphology: 1.3, location: 1.0, process: 1.35, material: 1.0, method: 1.35 },
    convergence: { lockBonus: 0.10, ambiguityReduction: 0.04, escalateAdjust: -0.04 },
    causes: ["shielding gas interruption", "draft or wind", "gas flow error", "dirty base metal", "stickout error", "voltage-wire feed imbalance", "poor travel speed"],
    teaching: ["gas coverage", "contact tip distance", "wire feed / voltage balance", "travel speed", "gun angle", "clean base metal"]
  },
  FCAW: {
    slagSystem: true, externalGas: true, tungstenElectrode: false,
    typicalDefects: ["slag_inclusion", "porosity", "undercut", "incomplete_fusion", "incomplete_penetration", "spatter", "irregular_profile"],
    suppressedDefects: ["tungsten_inclusion"],
    evidenceWeights: { morphology: 1.3, location: 1.0, process: 1.4, material: 1.0, method: 1.4 },
    convergence: { lockBonus: 0.09, ambiguityReduction: 0.05, escalateAdjust: -0.03 },
    causes: ["poor shielding gas coverage", "slag entrapment", "wire parameter mismatch", "wrong technique angle", "dirty material", "excessive travel speed", "insufficient interpass cleaning"],
    teaching: ["gas plus flux interaction", "drag angle", "interpass cleaning", "parameter tuning", "travel speed", "wire extension control"]
  },
  GTAW: {
    slagSystem: false, externalGas: true, tungstenElectrode: true,
    typicalDefects: ["porosity", "tungsten_inclusion", "incomplete_fusion", "incomplete_penetration", "undercut", "crater_defect", "oxide_inclusion"],
    suppressedDefects: ["slag_inclusion", "spatter"],
    evidenceWeights: { morphology: 1.35, location: 1.05, process: 1.35, material: 1.1, method: 1.4 },
    convergence: { lockBonus: 0.10, ambiguityReduction: 0.04, escalateAdjust: -0.03 },
    causes: ["poor gas shielding", "tungsten contamination", "dirty joint prep", "poor fitup", "arc length instability", "filler addition timing", "oxidation"],
    teaching: ["arc length discipline", "torch angle", "tungsten prep", "shielding integrity", "filler timing", "joint cleanliness"]
  },
  SAW: {
    slagSystem: true, externalGas: false, tungstenElectrode: false,
    typicalDefects: ["slag_inclusion", "porosity", "incomplete_fusion", "incomplete_penetration", "undercut", "crack"],
    suppressedDefects: ["spatter", "tungsten_inclusion"],
    evidenceWeights: { morphology: 1.2, location: 1.0, process: 1.4, material: 1.05, method: 1.45 },
    convergence: { lockBonus: 0.06, ambiguityReduction: 0.06, escalateAdjust: 0.01 },
    causes: ["flux condition issue", "moisture in flux", "improper travel rate", "joint prep issue", "parameter mismatch", "slag entrapment"],
    teaching: ["flux condition", "joint prep consistency", "travel rate", "parameter control", "slag management"]
  },
  unknown: {
    slagSystem: false, externalGas: false, tungstenElectrode: false,
    typicalDefects: ["porosity", "incomplete_fusion", "undercut", "irregular_profile"],
    suppressedDefects: [],
    evidenceWeights: { morphology: 1.0, location: 0.95, process: 0.7, material: 1.0, method: 0.5 },
    convergence: { lockBonus: -0.02, ambiguityReduction: -0.05, escalateAdjust: 0.08 },
    causes: ["method not selected", "physics environment not locked"],
    teaching: ["select actual welding process before trusting output"]
  }
};

/* ================================================================
   DEFECT AFFINITY TABLES (0-100 per defect per method)
   Higher = more likely with this process
   ================================================================ */

var AFFINITIES: Record<string, Record<string, number>> = {
  SMAW: { porosity: 75, slag_inclusion: 90, incomplete_fusion: 80, incomplete_penetration: 75, undercut: 80, overlap: 45, reinforcement_excess: 55, spatter: 80, crack: 40, burn_through: 40, arc_strike: 70, cluster_porosity: 60, distortion: 45, lamination: 20, lack_of_sidewall_fusion: 80 },
  GMAW: { porosity: 90, slag_inclusion: 0, incomplete_fusion: 85, incomplete_penetration: 80, undercut: 75, overlap: 75, reinforcement_excess: 55, spatter: 70, crack: 30, burn_through: 60, arc_strike: 30, cluster_porosity: 70, distortion: 45, lamination: 20, lack_of_sidewall_fusion: 85 },
  FCAW: { porosity: 90, slag_inclusion: 90, incomplete_fusion: 85, incomplete_penetration: 75, undercut: 80, overlap: 50, reinforcement_excess: 55, spatter: 75, crack: 35, burn_through: 45, arc_strike: 25, cluster_porosity: 65, distortion: 40, lamination: 20, lack_of_sidewall_fusion: 85 },
  GTAW: { porosity: 80, slag_inclusion: 0, incomplete_fusion: 80, incomplete_penetration: 80, undercut: 65, overlap: 35, reinforcement_excess: 50, spatter: 0, crack: 30, burn_through: 55, arc_strike: 25, cluster_porosity: 55, distortion: 35, lamination: 20, lack_of_sidewall_fusion: 80 },
  SAW: { porosity: 70, slag_inclusion: 90, incomplete_fusion: 85, incomplete_penetration: 80, undercut: 55, overlap: 25, reinforcement_excess: 45, spatter: 0, crack: 60, burn_through: 30, arc_strike: 0, cluster_porosity: 50, distortion: 35, lamination: 20, lack_of_sidewall_fusion: 85 },
  unknown: { porosity: 50, slag_inclusion: 40, incomplete_fusion: 50, incomplete_penetration: 45, undercut: 50, overlap: 40, reinforcement_excess: 40, spatter: 40, crack: 20, burn_through: 25, arc_strike: 20, cluster_porosity: 40, distortion: 30, lamination: 20, lack_of_sidewall_fusion: 50 }
};

/* ================================================================
   DEFECT KNOWLEDGE BASE (16 types)
   ================================================================ */

var DEFECT_KB: Record<string, any> = {
  crack: { locations: ["weld_toe", "weld_root", "haz", "centerline"], morphology: ["linear", "sharp", "surface-breaking", "branched"], contradictions: ["rounded", "uniformly spherical"], hard_reject: true, basis: "Sharp-tipped discontinuity. Non-permissible across most codes." },
  undercut: { locations: ["weld_toe"], morphology: ["toe-groove", "linear", "edge-depression", "surface-breaking"], contradictions: ["internal", "rounded isolated pore"], hard_reject: false, basis: "Groove at weld toe. Critical for fatigue." },
  porosity: { locations: ["throughout_weld", "weld_face", "internal", "centerline"], morphology: ["rounded", "spherical", "clustered", "gas-pocket", "pinholes"], contradictions: ["sharp planar line", "toe-groove"], hard_reject: false, basis: "Gas-related rounded voids. SCF ~2.0." },
  slag_inclusion: { locations: ["between_passes", "sidewall", "internal", "weld_root"], morphology: ["linear", "elongated", "interpass", "nonmetallic-trap"], contradictions: ["single toe groove", "isolated rounded pore"], hard_reject: false, basis: "Nonmetallic entrapped materials from slag-forming processes." },
  incomplete_fusion: { locations: ["sidewall", "between_passes", "weld_root", "groove_face"], morphology: ["planar", "linear", "unbonded-interface", "sharp"], contradictions: ["rounded void", "surface toe groove only"], hard_reject: true, basis: "Planar unbonded interface. Behaves like crack under load." },
  incomplete_penetration: { locations: ["weld_root", "centerline", "internal"], morphology: ["root-line", "linear", "planar", "unbonded-root"], contradictions: ["toe-groove", "rounded face porosity"], hard_reject: true, basis: "Reduces effective throat. Root partially unbonded." },
  overlap: { locations: ["weld_toe", "cap"], morphology: ["rolled-edge", "lip", "metal-overhang", "unfused-toe"], contradictions: ["internal indication", "rounded pore"], hard_reject: true, basis: "Unfused metal at toe. Mechanical notch." },
  reinforcement_excess: { locations: ["cap", "weld_face"], morphology: ["convex", "height-excess", "crown-high"], contradictions: ["internal planar line"], hard_reject: false, basis: "Stress concentration at toe from geometric transition." },
  burn_through: { locations: ["weld_root", "internal", "centerline"], morphology: ["root-hole", "excess root melt", "drop-through"], contradictions: ["toe groove only"], hard_reject: false, basis: "Root inaccessible after installation." },
  arc_strike: { locations: ["haz", "surface"], morphology: ["localized melt spot", "surface strike"], contradictions: ["internal only"], hard_reject: false, basis: "Hardened local zones and crack initiation risk." },
  spatter: { locations: ["surface", "haz", "cap"], morphology: ["small globules", "scattered deposits"], contradictions: ["planar internal line"], hard_reject: false, basis: "Generally superficial unless code-specific." },
  cluster_porosity: { locations: ["weld_face", "internal", "centerline"], morphology: ["clustered", "rounded", "multiple gas pockets"], contradictions: ["sharp single planar line"], hard_reject: false, basis: "Grouped gas discontinuity pattern." },
  lack_of_sidewall_fusion: { locations: ["sidewall"], morphology: ["planar", "linear", "unbonded-interface"], contradictions: ["rounded pore"], hard_reject: true, basis: "Planar discontinuity at fusion boundary." },
  lamination: { locations: ["internal"], morphology: ["planar", "rolled-in"], contradictions: ["toe groove"], hard_reject: false, basis: "Base metal defect from rolling." },
  distortion: { locations: ["unknown"], morphology: ["warpage", "misalignment"], contradictions: [], hard_reject: false, basis: "Thermal expansion/contraction imbalance." },
  weld_profile: { locations: ["weld_face", "cap", "entire_weld", "throughout_weld"], morphology: ["irregular", "inconsistent", "rough", "uneven", "ropey"], contradictions: [], hard_reject: false, basis: "Profile irregularity indicates technique or parameter instability." },
  poor_weld_technique: { locations: ["entire_weld", "throughout_weld", "unknown"], morphology: ["irregular", "inconsistent", "rough"], contradictions: [], hard_reject: false, basis: "Systematic parameter or technique issues." },
  unknown_discontinuity: { locations: ["unknown"], morphology: [], contradictions: [], hard_reject: false, basis: "Requires additional method confirmation." }
};

/* ================================================================
   TUNED SCORING WEIGHTS AND THRESHOLDS
   ================================================================ */

var W_EVIDENCE = 0.22;
var W_LOCATION = 0.12;
var W_MORPHOLOGY = 0.22;
var W_PROCESS = 0.16;
var W_MATERIAL = 0.08;
var W_METHOD = 0.10;
var W_CRITICALITY = 0.10;

var T_RESOLVED = 0.65;
var T_PROBABLE = 0.52;
var T_GAP_RESOLVED = 0.08;
var T_GAP_PROBABLE = 0.04;

/* ================================================================
   HELPERS
   ================================================================ */

function clamp(v: number): number { return v < 0 ? 0 : v > 1 ? 1 : v; }
function avgArr(vals: number[]): number { if (!vals.length) return 0; var s = 0; for (var i = 0; i < vals.length; i++) s += vals[i]; return s / vals.length; }
function isSlagProcess(p: string): boolean { return p === "SMAW" || p === "FCAW" || p === "FCAW_S" || p === "FCAW_G" || p === "SAW"; }
function normalizeProcess(p: string): string { if (!p) return "unknown"; var u = p.toUpperCase().trim(); if (u === "FCAW_S" || u === "FCAW_G" || u === "FCAW-S" || u === "FCAW-G") return "FCAW"; if (METHOD_PROFILES[u]) return u; return "unknown"; }
function affinityMultiplier(score: number): number { return 0.7 + (score / 100) * 0.6; }

/* ================================================================
   VISUAL AUTHORITY LAYER
   Extract observable facts from findings BEFORE hypothesis scoring
   ================================================================ */

function extractVisualAuthority(findings: any[]): any {
  var authority: any = {
    visiblePores: false,
    toeGroove: false,
    overlapLip: false,
    heavySpatter: false,
    poorBead: false,
    slagLines: false,
    crackLike: false,
    primaryObservation: null,
    primaryConfidence: 0
  };

  for (var i = 0; i < findings.length; i++) {
    var f = findings[i];
    var dt = f.defect_type;
    var conf = f.confidence || 0;
    var tags = f.morphology_tags || [];

    if (dt === "porosity" || dt === "gas_porosity_(scattered)" || dt === "gas_porosity_scattered") {
      authority.visiblePores = true;
      if (conf > authority.primaryConfidence) { authority.primaryObservation = "porosity"; authority.primaryConfidence = conf; }
    }
    if (dt === "undercut") {
      authority.toeGroove = true;
      if (conf > authority.primaryConfidence) { authority.primaryObservation = "undercut"; authority.primaryConfidence = conf; }
    }
    if (dt === "overlap") authority.overlapLip = true;
    if (dt === "spatter" || dt === "spatter_excessive") authority.heavySpatter = true;
    if (dt === "weld_profile" || dt === "poor_weld_technique" || dt === "poor_weld_profile/inconsistent_penetration" || dt === "irregular_profile") {
      authority.poorBead = true;
      if (conf > authority.primaryConfidence) { authority.primaryObservation = "weld_profile"; authority.primaryConfidence = conf; }
    }
    if (dt === "slag_inclusion") authority.slagLines = true;
    if (dt === "crack") authority.crackLike = true;

    if (tags.indexOf("rounded") >= 0 || tags.indexOf("pinholes") >= 0 || tags.indexOf("gas-pocket") >= 0) authority.visiblePores = true;
    if (tags.indexOf("toe-groove") >= 0) authority.toeGroove = true;
    if (tags.indexOf("rolled-edge") >= 0 || tags.indexOf("lip") >= 0) authority.overlapLip = true;
  }

  return authority;
}

/* ================================================================
   SCORING FUNCTIONS (enhanced with method affinity)
   ================================================================ */

function scoreEvidence(dt: string, findings: any[]): number {
  var matches = findings.filter(function(f) { return f.defect_type === dt; });
  if (!matches.length) return 0.20;
  return clamp(avgArr(matches.map(function(m) { return m.confidence || 0; })));
}

function scoreLocation(dt: string, findings: any[]): any {
  var kb = DEFECT_KB[dt];
  if (!kb) return { score: 0.25, reasons: [], rejections: [] };
  var matches = findings.filter(function(f) { return f.defect_type === dt; });
  var reasons: string[] = []; var rejections: string[] = [];
  if (!matches.length) { return { score: 0.25, reasons: reasons, rejections: ["No finding supports this location."] }; }
  var scores = matches.map(function(m) {
    var loc = m.location || "unknown";
    if (kb.locations.indexOf(loc) >= 0) { reasons.push("Location '" + loc + "' matches expected " + dt + " behavior."); return 1.0; }
    if (loc === "unknown" || loc === "entire_weld" || loc === "throughout_weld") { return 0.50; }
    rejections.push("Location '" + loc + "' is atypical for " + dt + "."); return 0.25;
  });
  return { score: clamp(avgArr(scores)), reasons: reasons, rejections: rejections };
}

function scoreMorphology(dt: string, findings: any[], visualAuth: any): any {
  var kb = DEFECT_KB[dt];
  if (!kb) return { score: 0.25, reasons: [], rejections: [] };
  var matches = findings.filter(function(f) { return f.defect_type === dt; });
  var reasons: string[] = []; var rejections: string[] = [];

  // Visual Authority boost
  var vaBoost = 0;
  if (dt === "porosity" && visualAuth.visiblePores) { vaBoost = 0.20; reasons.push("Visual authority: visible pores confirmed."); }
  if (dt === "undercut" && visualAuth.toeGroove) { vaBoost = 0.20; reasons.push("Visual authority: toe groove confirmed."); }
  if (dt === "overlap" && visualAuth.overlapLip) { vaBoost = 0.20; reasons.push("Visual authority: overlap lip confirmed."); }
  if ((dt === "weld_profile" || dt === "poor_weld_technique" || dt === "irregular_profile") && visualAuth.poorBead) { vaBoost = 0.20; reasons.push("Visual authority: poor bead uniformity confirmed."); }
  if (dt === "slag_inclusion" && visualAuth.slagLines) { vaBoost = 0.15; reasons.push("Visual authority: slag indicators observed."); }
  if (dt === "crack" && visualAuth.crackLike) { vaBoost = 0.25; reasons.push("Visual authority: crack-like indication observed."); }

  if (!matches.length && vaBoost === 0) {
    return { score: 0.25, reasons: reasons, rejections: ["No morphology supports this."] };
  }

  var baseScore = 0.25;
  if (matches.length > 0) {
    var scores = matches.map(function(m) {
      var tags = m.morphology_tags || [];
      var pos = 0; var neg = 0;
      for (var i = 0; i < (kb.morphology || []).length; i++) { if (tags.indexOf(kb.morphology[i]) >= 0) pos++; }
      for (var j = 0; j < (kb.contradictions || []).length; j++) { if (tags.indexOf(kb.contradictions[j]) >= 0) neg++; }
      if (pos > 0) reasons.push("Morphology tags support " + dt + ".");
      if (neg > 0) rejections.push("Morphology contradicts " + dt + ".");
      var b = pos > 0 ? Math.min(1, 0.55 + pos * 0.15) : 0.25;
      return clamp(b - neg * 0.25);
    });
    baseScore = avgArr(scores);
  }

  return { score: clamp(baseScore + vaBoost), reasons: reasons, rejections: rejections };
}

function scoreProcess(dt: string, processStr: string, processCtx: any): any {
  var reasons: string[] = []; var rejections: string[] = [];
  var methodKey = normalizeProcess(processStr);
  var affinityTable = AFFINITIES[methodKey] || AFFINITIES["unknown"];
  var profile = METHOD_PROFILES[methodKey] || METHOD_PROFILES["unknown"];

  // Get affinity score (0-100) for this defect with this method
  var affinity = affinityTable[dt];
  if (affinity === undefined) affinity = 50;

  // Convert affinity to multiplied score
  var score = affinityMultiplier(affinity) * 0.65;

  if (affinity >= 80) { reasons.push(processStr + " has strong affinity (" + affinity + "/100) for " + dt + "."); }
  else if (affinity >= 50) { reasons.push(processStr + " has moderate affinity for " + dt + "."); }
  else if (affinity > 0) { rejections.push(processStr + " has low affinity (" + affinity + "/100) for " + dt + "."); }
  else { rejections.push(processStr + " has zero affinity for " + dt + ". Physically suppressed."); score = 0.05; }

  // Suppressed discontinuity check
  if (profile.suppressedDefects && profile.suppressedDefects.indexOf(dt) >= 0) {
    score = score * 0.3;
    rejections.push(dt + " is suppressed by " + processStr + " physics.");
  }

  // Process context bonuses
  if (dt === "slag_inclusion" && isSlagProcess(processStr)) {
    score += 0.05; reasons.push("Slag-forming process supports slag inclusion.");
    if (processCtx.interpass_cleaning_confirmed === false) { score += 0.08; reasons.push("No interpass cleaning confirmed."); }
  }
  if (dt === "slag_inclusion" && !isSlagProcess(processStr) && processStr !== "unknown") {
    score -= 0.15; rejections.push("Non-slag process penalizes slag hypothesis.");
  }
  if (dt === "undercut") {
    if (processCtx.travel_speed_relative === "fast") { score += 0.08; reasons.push("Fast travel supports undercut."); }
    if (processCtx.amperage_relative === "high" || processCtx.heat_input_relative === "high") { score += 0.08; reasons.push("High heat input supports toe washout."); }
  }
  if ((dt === "incomplete_fusion" || dt === "lack_of_sidewall_fusion") && processCtx.heat_input_relative === "low") {
    score += 0.08; reasons.push("Low heat input supports fusion deficiency.");
  }
  if (dt === "porosity" && profile.externalGas) {
    reasons.push("Gas-shielded process: porosity from shielding disruption is plausible.");
    score += 0.03;
  }

  return { score: clamp(score), reasons: reasons, rejections: rejections, causes: profile.causes || [] };
}

function scoreMaterial(dt: string, material: any): any {
  var reasons: string[] = []; var score = 0.65;
  if (dt === "crack" && (material.material_class === "carbon_steel" || material.material_class === "low_alloy_steel")) {
    score += 0.08; reasons.push("Steel with cooling sensitivity supports crack plausibility.");
  }
  return { score: clamp(score), reasons: reasons, rejections: [] };
}

function scoreMethod(dt: string, ndtMethod: string, methodKey: string): any {
  var reasons: string[] = []; var rejections: string[] = [];
  var profile = METHOD_PROFILES[methodKey] || METHOD_PROFILES["unknown"];
  var evWeights = profile.evidenceWeights || {};
  var score = 0.65;

  if (ndtMethod === "VT") {
    var surfaceTypes = ["undercut", "overlap", "reinforcement_excess", "spatter", "arc_strike", "weld_profile", "poor_weld_technique", "irregular_profile"];
    var internalTypes = ["incomplete_fusion", "incomplete_penetration", "slag_inclusion", "lamination", "lack_of_sidewall_fusion"];
    if (surfaceTypes.indexOf(dt) >= 0) { score = 0.92; reasons.push("VT excels at surface conditions like " + dt + "."); }
    else if (internalTypes.indexOf(dt) >= 0) { score = 0.42; rejections.push("VT cannot confirm internal conditions like " + dt + "."); }
    else if (dt === "crack") { score = 0.80; reasons.push("VT detects surface-breaking cracks."); }
    else if (dt === "porosity") { score = 0.75; reasons.push("VT detects surface porosity."); }
  }

  // Apply method evidence weight modifier
  score = score * (evWeights.method || 1.0);
  return { score: clamp(score), reasons: reasons, rejections: rejections };
}

function scoreCriticality(dt: string, loadingType: string, codeFamily: string): number {
  var kb = DEFECT_KB[dt]; if (!kb) return 0.5;
  var score = kb.hard_reject ? 1.0 : 0.55;
  if (dt === "undercut" && (loadingType === "dynamic" || loadingType === "cyclic")) score += 0.10;
  if (dt === "burn_through" && codeFamily === "API_1104") score += 0.10;
  return clamp(score);
}

function calcContradictions(dt: string, findings: any[], processStr: string, ndtMethod: string): any {
  var reasons: string[] = []; var penalty = 0;
  if (dt === "slag_inclusion" && !isSlagProcess(processStr) && processStr !== "unknown") { penalty += 0.18; reasons.push("Slag penalized: non-slag process."); }
  if (dt === "incomplete_penetration" && ndtMethod === "VT") { penalty += 0.10; reasons.push("Penetration cannot be confirmed from VT face view."); }
  if (dt === "incomplete_fusion" && ndtMethod === "VT") {
    var hasPlanar = false;
    for (var i = 0; i < findings.length; i++) { if ((findings[i].morphology_tags || []).indexOf("planar") >= 0) hasPlanar = true; }
    if (!hasPlanar) { penalty += 0.12; reasons.push("Incomplete fusion penalized: no planar evidence in VT."); }
  }
  return { penalty: clamp(penalty), reasons: reasons };
}

/* ================================================================
   HYPOTHESIS GENERATOR
   ================================================================ */

function generateCandidates(findings: any[], methodKey: string): string[] {
  var found: Record<string, boolean> = {};
  var candidates: Record<string, boolean> = {};
  for (var i = 0; i < findings.length; i++) { found[findings[i].defect_type] = true; candidates[findings[i].defect_type] = true; }

  // Add competitors
  if (found["undercut"]) { candidates["overlap"] = true; candidates["incomplete_fusion"] = true; }
  if (found["slag_inclusion"]) { candidates["incomplete_fusion"] = true; candidates["porosity"] = true; }
  if (found["porosity"]) { candidates["cluster_porosity"] = true; candidates["slag_inclusion"] = true; }
  if (found["incomplete_fusion"]) { candidates["lack_of_sidewall_fusion"] = true; candidates["slag_inclusion"] = true; }
  if (found["overlap"]) { candidates["undercut"] = true; }
  if (found["crack"]) { candidates["incomplete_fusion"] = true; }
  if (found["weld_profile"] || found["poor_weld_technique"] || found["irregular_profile"]) {
    candidates["undercut"] = true; candidates["porosity"] = true; candidates["overlap"] = true;
  }

  // Add typical defects for the selected method
  var profile = METHOD_PROFILES[methodKey] || METHOD_PROFILES["unknown"];
  if (profile.typicalDefects) {
    for (var t = 0; t < profile.typicalDefects.length; t++) {
      if (!candidates[profile.typicalDefects[t]]) candidates[profile.typicalDefects[t]] = true;
    }
  }

  var result = Object.keys(candidates);
  if (result.length === 0) result.push("unknown_discontinuity");
  return result;
}

function recommendNextMethod(primary: string, defect: string): string {
  if (primary === "VT") {
    var internal = ["incomplete_fusion", "incomplete_penetration", "slag_inclusion", "lamination", "lack_of_sidewall_fusion"];
    if (internal.indexOf(defect) >= 0) return "UT";
    if (defect === "crack") return "MT";
    return "PT";
  }
  if (primary === "MT") return "UT";
  if (primary === "PT") return "VT";
  if (primary === "UT") return "RT";
  return "UT";
}

/* ================================================================
   MAIN CONVERGENCE ENGINE v2
   ================================================================ */

function runConvergence(findings: any[], material: any, processCtx: any, ndtMethod: string, codeFamily: string, loadingType: string): any {
  var processStr = processCtx.process || "unknown";
  var methodKey = normalizeProcess(processStr);
  var profile = METHOD_PROFILES[methodKey] || METHOD_PROFILES["unknown"];

  // VISUAL AUTHORITY LAYER - extract observable facts first
  var visualAuth = extractVisualAuthority(findings);

  var candidates = generateCandidates(findings, methodKey);
  var hypotheses: any[] = [];

  for (var c = 0; c < candidates.length; c++) {
    var dt = candidates[c];
    var evScore = scoreEvidence(dt, findings);
    var locResult = scoreLocation(dt, findings);
    var morResult = scoreMorphology(dt, findings, visualAuth);
    var proResult = scoreProcess(dt, processStr, processCtx);
    var matResult = scoreMaterial(dt, material);
    var metResult = scoreMethod(dt, ndtMethod, methodKey);
    var critScore = scoreCriticality(dt, loadingType, codeFamily);
    var contraResult = calcContradictions(dt, findings, processStr, ndtMethod);

    // Apply evidence weight modifiers from method profile
    var evWeights = profile.evidenceWeights || {};
    var total =
      evScore * W_EVIDENCE * (evWeights.morphology || 1.0) +
      locResult.score * W_LOCATION * (evWeights.location || 1.0) +
      morResult.score * W_MORPHOLOGY * (evWeights.morphology || 1.0) +
      proResult.score * W_PROCESS * (evWeights.process || 1.0) +
      matResult.score * W_MATERIAL * (evWeights.material || 1.0) +
      metResult.score * W_METHOD +
      critScore * W_CRITICALITY -
      contraResult.penalty;

    total = clamp(total);

    var supportReasons = locResult.reasons.concat(morResult.reasons).concat(proResult.reasons).concat(matResult.reasons).concat(metResult.reasons);
    var rejectReasons = locResult.rejections.concat(morResult.rejections).concat(proResult.rejections).concat(matResult.rejections).concat(metResult.rejections).concat(contraResult.reasons);

    hypotheses.push({
      defect_type: dt, plausible: total >= 0.45,
      scores: { evidence: evScore, location: locResult.score, morphology: morResult.score, process: proResult.score, material: matResult.score, method: metResult.score, criticality: critScore, contradiction: contraResult.penalty, total: total },
      support_reasons: supportReasons, rejection_reasons: rejectReasons,
      probable_causes: proResult.causes,
      why_it_fits: supportReasons.slice(0, 3).join(" "),
      why_not_fully: rejectReasons.slice(0, 2).join(" ") || null,
      engineering_basis: DEFECT_KB[dt] ? DEFECT_KB[dt].basis : ""
    });
  }

  hypotheses.sort(function(a, b) { return b.scores.total - a.scores.total; });
  for (var r = 0; r < hypotheses.length; r++) hypotheses[r].rank = r + 1;

  var top = hypotheses[0] || null;
  var second = hypotheses[1] || null;
  var rawGap = top && second ? top.scores.total - second.scores.total : 1.0;

  // Apply method-specific convergence adjustments
  var conv = profile.convergence || {};
  var adjTop = top ? clamp(top.scores.total + (conv.lockBonus || 0)) : 0;
  var adjGap = Math.max(0, rawGap + (conv.ambiguityReduction || 0));
  var adjResolvedThreshold = Math.max(0.50, T_RESOLVED + (conv.escalateAdjust || 0));
  var adjProbableThreshold = Math.max(0.40, T_PROBABLE + (conv.escalateAdjust || 0));

  var status = "unresolved";
  var escalationReason = null;
  var nextMethod = null;

  if (!top) {
    status = "escalate"; escalationReason = "No valid hypothesis."; nextMethod = "UT";
  } else if (adjTop >= adjResolvedThreshold && adjGap >= T_GAP_RESOLVED) {
    status = "resolved";
  } else if (adjTop >= adjProbableThreshold && adjGap >= T_GAP_PROBABLE) {
    status = "probable";
  } else {
    status = "escalate";
    escalationReason = "Score " + adjTop.toFixed(2) + " or gap " + adjGap.toFixed(2) + " insufficient. Method: " + processStr;
    nextMethod = recommendNextMethod(ndtMethod, top.defect_type);
  }

  var eliminated = [];
  for (var e = 1; e < hypotheses.length; e++) {
    eliminated.push({ defect_type: hypotheses[e].defect_type, reasons: hypotheses[e].rejection_reasons.slice(0, 3) });
  }

  var whyNotArr = eliminated.slice(0, 3).map(function(x) {
    var rr = x.reasons.filter(function(s: string) { return s; }).join(" ");
    return x.defect_type.replace(/_/g, " ") + ": " + (rr || "Lower physical consistency.");
  });

  var summary: any = {};
  if (!top) {
    summary = { what: "UNRESOLVED", why: "No hypothesis achieved consistency.", why_not: whyNotArr, how: "Apply additional method." };
  } else if (status === "resolved") {
    summary = {
      what: "PRIMARY REALITY: " + top.defect_type.replace(/_/g, " ").toUpperCase(),
      why: "Score " + adjTop.toFixed(2) + " (adjusted), gap " + adjGap.toFixed(2) + ". " + top.why_it_fits,
      why_not: whyNotArr,
      how: top.scores.criticality >= 0.9 ? "Route to Authority Lock for hard-reject." : "Collect measurements. Route to Authority Lock."
    };
  } else if (status === "probable") {
    summary = {
      what: "PROBABLE REALITY: " + top.defect_type.replace(/_/g, " ").toUpperCase(),
      why: "Score " + adjTop.toFixed(2) + " leads but margin moderate.",
      why_not: whyNotArr,
      how: "Proceed with measurement. Consider secondary method."
    };
  } else {
    summary = {
      what: "ESCALATE - " + top.defect_type.replace(/_/g, " ").toUpperCase() + " leads.",
      why: "Score " + adjTop.toFixed(2) + " insufficient or gap too small.",
      why_not: whyNotArr,
      how: "Apply " + (nextMethod || "secondary method") + ". Rerun convergence."
    };
  }

  return {
    status: status, dominant_reality: top ? top.defect_type : null,
    dominant_score: adjTop, runner_up: second ? second.defect_type : null,
    runner_up_score: second ? clamp(second.scores.total + (conv.lockBonus || 0)) : null,
    agreement_gap: adjGap, hypotheses: hypotheses, eliminated: eliminated,
    escalation_reason: escalationReason, recommended_next_method: nextMethod,
    summary: summary, visual_authority: visualAuth,
    method_profile: { method: methodKey, lockBonus: conv.lockBonus || 0, processKnown: methodKey !== "unknown" }
  };
}

/* ================================================================
   HANDLER
   ================================================================ */

var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") { return { statusCode: 204, headers: corsHeaders, body: "" }; }
  if (event.httpMethod !== "POST") { return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) }; }

  try {
    var body = JSON.parse(event.body || "{}");
    var caseId = body.case_id;
    if (!caseId) { return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) }; }

    var supabase = createClient(supabaseUrl, supabaseKey);

    var caseResult = await supabase.from("inspection_cases").select("*").eq("id", caseId).single();
    var caseData = caseResult.data;
    if (!caseData) { return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "Case not found" }) }; }

    var findingsResult = await supabase.from("findings").select("*").eq("case_id", caseId);
    var rawFindings = findingsResult.data || [];
    var findings = rawFindings.map(function(f) {
      return {
        id: f.id, source: f.source,
        defect_type: (f.label || f.finding_type || "unknown").toLowerCase().replace(/ /g, "_"),
        location: (f.location_ref || "unknown").toLowerCase().replace(/ /g, "_"),
        severity: f.severity || "medium", confidence: f.confidence || 0.5,
        description: f.label || "",
        morphology_tags: f.structured_json && f.structured_json.morphology_tags ? f.structured_json.morphology_tags : []
      };
    });

    var physResult = await supabase.from("physics_reality_models").select("*").eq("case_id", caseId).single();
    var physData = physResult.data;

    var material = {
      material_class: caseData.material_class || "carbon_steel",
      ferromagnetic: physData && physData.material_properties_json ? physData.material_properties_json.ferromagnetic || false : false,
      density_kg_m3: physData && physData.material_properties_json ? physData.material_properties_json.density_kg_m3 || 7850 : 7850,
      thermal_conductivity_w_mk: physData && physData.material_properties_json ? physData.material_properties_json.thermal_conductivity_w_mk || 46 : 46
    };

    var processCtx = physData && physData.process_context_json ? physData.process_context_json : {};
    var ndtMethod = caseData.method || "VT";
    var codeFamily = caseData.code_family || "AWS_D1_1";
    var loadingType = caseData.load_condition || "unknown";

    var result = runConvergence(findings, material, processCtx, ndtMethod, codeFamily, loadingType);

    // Clean old runs
    var oldRuns = await supabase.from("ndt_reality_runs").select("id").eq("case_id", caseId);
    if (oldRuns.data && oldRuns.data.length > 0) {
      for (var d = 0; d < oldRuns.data.length; d++) {
        await supabase.from("ndt_reality_hypotheses").delete().eq("reality_run_id", oldRuns.data[d].id);
        await supabase.from("ndt_reality_eliminations").delete().eq("reality_run_id", oldRuns.data[d].id);
      }
      await supabase.from("ndt_reality_runs").delete().eq("case_id", caseId);
    }

    var runInsert = await supabase.from("ndt_reality_runs").insert({
      case_id: caseId, primary_method: ndtMethod, code_family: codeFamily, loading_type: loadingType,
      convergence_status: result.status, dominant_reality: result.dominant_reality,
      dominant_score: result.dominant_score, runner_up: result.runner_up,
      runner_up_score: result.runner_up_score, agreement_gap: result.agreement_gap,
      escalation_reason: result.escalation_reason, recommended_next_method: result.recommended_next_method,
      summary_what: result.summary.what, summary_why: result.summary.why,
      summary_why_not: result.summary.why_not, summary_how: result.summary.how,
      hypothesis_count: result.hypotheses.length, eliminated_count: result.eliminated.length
    }).select("id").single();

    if (runInsert.error) throw runInsert.error;
    var runId = runInsert.data.id;

    for (var h = 0; h < result.hypotheses.length; h++) {
      var hyp = result.hypotheses[h];
      await supabase.from("ndt_reality_hypotheses").insert({
        reality_run_id: runId, defect_type: hyp.defect_type, plausible: hyp.plausible,
        rank_position: hyp.rank, evidence_consistency: hyp.scores.evidence,
        location_consistency: hyp.scores.location, morphology_consistency: hyp.scores.morphology,
        process_consistency: hyp.scores.process, material_consistency: hyp.scores.material,
        method_consistency: hyp.scores.method, criticality_weight: hyp.scores.criticality,
        contradiction_penalty: hyp.scores.contradiction, total_score: hyp.scores.total,
        support_reasons: hyp.support_reasons, rejection_reasons: hyp.rejection_reasons,
        probable_causes: hyp.probable_causes, why_it_fits: hyp.why_it_fits,
        why_it_does_not_fully_fit: hyp.why_not_fully
      });
    }

    for (var el = 0; el < result.eliminated.length; el++) {
      await supabase.from("ndt_reality_eliminations").insert({
        reality_run_id: runId, defect_type: result.eliminated[el].defect_type, reasons: result.eliminated[el].reasons
      });
    }

    await supabase.from("inspection_cases").update({
      convergence_status: result.status, dominant_reality: result.dominant_reality,
      dominant_score: result.dominant_score, convergence_run_id: runId
    }).eq("id", caseId);

    await supabase.from("case_events").insert({
      case_id: caseId, event_type: "convergence_v2_completed",
      event_json: {
        status: result.status, dominant: result.dominant_reality, score: result.dominant_score,
        runner_up: result.runner_up, gap: result.agreement_gap,
        hypotheses_tested: result.hypotheses.length, process: processCtx.process || "unknown",
        visual_authority: result.visual_authority, method_profile: result.method_profile
      }
    });

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true, convergence_run_id: runId, result: result }) };

  } catch (err: any) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message || "run-convergence failed" }) };
  }
};

export { handler };
