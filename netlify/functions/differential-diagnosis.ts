// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ══════════════════════════════════════════════════════════════════════════════
// DIFFERENTIAL DIAGNOSIS ENGINE (DDE) v1.0.0
// DEPLOY341
//
// Bayesian damage mechanism ranking for non-destructive inspection workflows.
//
// Architecture:
// 1. Prerequisite pruning — deterministic elimination of impossible mechanisms
// 2. Prior selection — base rates by domain:service:material
// 3. Log-likelihood scoring — P(E|M) across observed categorical evidence
// 4. Posterior normalization — P(M|E) via Bayes' theorem
// 5. Discriminating evidence — surfaces unobserved dimensions that would
//    most cleanly separate the top hypotheses
//
// This is NOT multi-agent debate. It is deterministic Bayesian ranking of
// pre-defined mechanisms. The "competition" is math, not LLMs arguing.
// Priors are hand-calibrated and version-controlled.
// Final disposition is still inspector + engineer.
//
// Actions:
// - get_registry: Return engine capabilities
// - diagnose: Full differential diagnosis (the main action)
// - rank_mechanisms: Posterior ranking only (no discriminating evidence)
// - get_discriminating_tests: Discriminating evidence for given top-N
// - check_prerequisites: Prerequisite check only
// - get_kb_info: Return KB mechanism list for a domain
// - get_history: Retrieve past DDE assessments from DB
//
// ══════════════════════════════════════════════════════════════════════════════

import { MECHANISMS_FIXED } from "./dde-mechanism-kb-fixed";
import { MECHANISMS_SUBSEA } from "./dde-mechanism-kb-subsea";
import { MECHANISMS_MARINE } from "./dde-mechanism-kb-marine";
import { MECHANISMS_FLOATING } from "./dde-mechanism-kb-floating";
import { MECHANISMS_PRODUCTION } from "./dde-mechanism-kb-production";
import { PRIORS } from "./dde-prior-base-rates";
import { mapEvidence, assessCompleteness } from "./dde-evidence-mapper";

// ── CONSTANTS ──────────────────────────────────────────────────────────
var ENGINE_VERSION = "DDE-1.0.0";
var LIKELIHOOD_FLOOR = 0.01;    // Never 0 — unseen values reduce, don't eliminate
var FMD_PRIOR_BOOST = 1.5;      // FMD dominant mode gets 1.5x prior boost
var MAX_HYPOTHESES_RETURNED = 3;
var MAX_DISCRIMINATING_TESTS = 3;
var CONFIDENCE_CAP_NO_SERVICE = 0.65;

// ── ACTION REGISTRY ────────────────────────────────────────────────────
var ACTION_REGISTRY = {
  "get_registry": { description: "Return engine capabilities and KB summary", method: "GET_OR_POST" },
  "diagnose": { description: "Full differential diagnosis with Bayesian ranking and discriminating evidence", method: "POST" },
  "rank_mechanisms": { description: "Posterior ranking only — no discriminating evidence computation", method: "POST" },
  "get_discriminating_tests": { description: "Compute discriminating evidence for given mechanism set", method: "POST" },
  "check_prerequisites": { description: "Check which mechanisms pass/fail prerequisites for given context", method: "POST" },
  "get_kb_info": { description: "Return mechanism list and metadata for a domain", method: "POST" },
  "get_history": { description: "Retrieve past DDE assessments from database", method: "POST" }
};

// ── KB LOADER ──────────────────────────────────────────────────────────
function loadKB(domain: string): any {
  if (domain === "fixed") return MECHANISMS_FIXED;
  if (domain === "subsea") return MECHANISMS_SUBSEA;
  if (domain === "marine") return MECHANISMS_MARINE;
  if (domain === "floating") return MECHANISMS_FLOATING;
  if (domain === "production") return MECHANISMS_PRODUCTION;
  return null;
}

// ── PRIOR LOADER ───────────────────────────────────────────────────────
function loadPriors(domain: string, service: string | null, material: string | null): any {
  var exactKey = domain + ":" + (service || "default") + ":" + (material || "default");
  if (PRIORS[exactKey]) {
    return { priors: PRIORS[exactKey], source: exactKey };
  }

  // Try domain:service (no material)
  var serviceKey = domain + ":" + (service || "default");
  // Check all keys that start with serviceKey
  for (var key in PRIORS) {
    if (key.indexOf(serviceKey + ":") === 0) {
      return { priors: PRIORS[key], source: key + " (partial_match)" };
    }
  }

  // Fallback to domain default
  var defaultKey = domain + ":default";
  if (PRIORS[defaultKey]) {
    return { priors: PRIORS[defaultKey], source: defaultKey + " (domain_default)" };
  }

  // Ultimate fallback — uniform priors
  return { priors: null, source: "uniform_fallback" };
}

// ── PREREQUISITE CHECKER ───────────────────────────────────────────────
// Returns { passed: boolean, failed_prereq: string | null }
function checkPrerequisites(mechanism: any, assetContext: any): any {
  var prereqs = mechanism.prerequisites;
  if (!prereqs) return { passed: true, failed_prereq: null };

  for (var key in prereqs) {
    var required = prereqs[key];
    var actual = assetContext[key];

    // Array prerequisite: actual value must be in the required list
    if (Array.isArray(required)) {
      if (!actual || required.indexOf(actual) === -1) {
        return {
          passed: false,
          failed_prereq: key,
          reason: "Required " + key + " in [" + required.join(", ") + "], got: " + (actual || "not_specified")
        };
      }
      continue;
    }

    // Boolean prerequisite: must be true in context
    if (required === true) {
      if (!actual) {
        return {
          passed: false,
          failed_prereq: key,
          reason: key + " required but not present or false in asset context"
        };
      }
      continue;
    }

    // Numeric minimum (e.g., service_temp_above_f: 425)
    if (typeof required === "number" && key.indexOf("_above_") !== -1) {
      var numActual = Number(actual);
      if (isNaN(numActual) || numActual < required) {
        return {
          passed: false,
          failed_prereq: key,
          reason: key + " requires >= " + required + ", got: " + (actual || "not_specified")
        };
      }
      continue;
    }

    // pH range prerequisite [min, max]
    if (Array.isArray(required) && required.length === 2 && key === "ph_range") {
      if (actual !== null && actual !== undefined) {
        var ph = Number(actual);
        if (!isNaN(ph) && (ph < required[0] || ph > required[1])) {
          return {
            passed: false,
            failed_prereq: key,
            reason: "pH " + ph + " outside required range [" + required[0] + ", " + required[1] + "]"
          };
        }
      }
      // If pH not provided, don't fail — we can't confirm or deny
      continue;
    }

    // Exact match for anything else
    if (required !== actual && actual !== undefined) {
      return {
        passed: false,
        failed_prereq: key,
        reason: key + " requires " + JSON.stringify(required) + ", got: " + JSON.stringify(actual)
      };
    }
  }

  return { passed: true, failed_prereq: null };
}

// ── LOG-LIKELIHOOD COMPUTATION ─────────────────────────────────────────
// P(E|M) in log space to avoid underflow
function computeLogLikelihood(mechanism: any, evidence: any): any {
  var logL = 0;
  var dimensionsUsed = 0;
  var contributions: any[] = [];

  for (var dim in evidence) {
    if (evidence[dim] === null || evidence[dim] === undefined) continue;
    if (!mechanism.indicators || !mechanism.indicators[dim]) continue;

    var observedValue = evidence[dim];
    var p = mechanism.indicators[dim][observedValue];

    if (p === undefined || p === null) {
      p = LIKELIHOOD_FLOOR; // Unseen value — small but non-zero
    }

    logL += Math.log(p);
    dimensionsUsed++;
    contributions.push({
      dim: dim,
      value: observedValue,
      weight: p
    });
  }

  return {
    logLikelihood: logL,
    likelihood: Math.exp(logL),
    dimensionsUsed: dimensionsUsed,
    contributions: contributions
  };
}

// ── POSTERIOR COMPUTATION ──────────────────────────────────────────────
// Full Bayes: P(M|E) = P(E|M) * P(M) / Σ P(E|M') * P(M')
function computePosteriors(candidates: any[], evidence: any, priorTable: any, fmdDominant: string | null): any[] {
  var results: any[] = [];
  var totalWeight = 0;

  for (var i = 0; i < candidates.length; i++) {
    var mech = candidates[i];
    var ll = computeLogLikelihood(mech, evidence);

    // Get prior
    var prior = (priorTable && priorTable[mech.id]) ? priorTable[mech.id] : (1.0 / candidates.length);

    // FMD boost: if decision-core's FMD picked this mechanism, boost its prior
    if (fmdDominant && mech.id === fmdDominant) {
      prior = prior * FMD_PRIOR_BOOST;
    }

    // Joint = P(E|M) * P(M)
    var joint = ll.likelihood * prior;
    totalWeight += joint;

    results.push({
      mechanism_id: mech.id,
      display_name: mech.display_name,
      prior: prior,
      logLikelihood: ll.logLikelihood,
      likelihood: ll.likelihood,
      joint: joint,
      posterior: 0, // Will be normalized below
      supporting_evidence: ll.contributions.filter(function(c: any) { return c.weight >= 0.30; }),
      contradicting_evidence: ll.contributions.filter(function(c: any) { return c.weight <= 0.05; }),
      dimensions_used: ll.dimensionsUsed,
      code_reference: mech.code_reference,
      severity_default: mech.severity_default,
      typical_consequence: mech.typical_consequence,
      synergistic_with: mech.synergistic_with,
      competes_with: mech.competes_with
    });
  }

  // Normalize to get posteriors
  if (totalWeight > 0) {
    for (var j = 0; j < results.length; j++) {
      results[j].posterior = results[j].joint / totalWeight;
    }
  }

  // Sort by posterior descending
  results.sort(function(a: any, b: any) { return b.posterior - a.posterior; });

  return results;
}

// ── DISCRIMINATING EVIDENCE COMPUTATION ────────────────────────────────
// For the top-N hypotheses, find unobserved dimensions that would most
// cleanly separate them. This is the ASNT money shot.
function computeDiscriminatingEvidence(topHypotheses: any[], kb: any, evidence: any): any[] {
  if (topHypotheses.length < 2) return [];

  // Get the actual mechanism objects from KB
  var mechObjects: any[] = [];
  for (var i = 0; i < topHypotheses.length; i++) {
    var mechId = topHypotheses[i].mechanism_id;
    if (kb[mechId]) mechObjects.push(kb[mechId]);
  }

  if (mechObjects.length < 2) return [];

  // Collect all indicator dimensions across top hypotheses
  var allDims: any = {};
  for (var m = 0; m < mechObjects.length; m++) {
    if (!mechObjects[m].indicators) continue;
    for (var dim in mechObjects[m].indicators) {
      allDims[dim] = true;
    }
  }

  // For each UNOBSERVED dimension, compute discriminating power
  var dimScores: any[] = [];

  for (var dim in allDims) {
    // Skip if already observed
    if (evidence[dim] !== undefined && evidence[dim] !== null) continue;

    // Collect all possible values for this dimension
    var allValues: any = {};
    for (var m2 = 0; m2 < mechObjects.length; m2++) {
      if (mechObjects[m2].indicators && mechObjects[m2].indicators[dim]) {
        for (var val in mechObjects[m2].indicators[dim]) {
          allValues[val] = true;
        }
      }
    }

    // For each value, compute max spread across hypotheses
    var maxSpread = 0;
    var bestValue = null;
    var decisionLogic: any = {};

    for (var val2 in allValues) {
      var probs: any[] = [];
      for (var m3 = 0; m3 < mechObjects.length; m3++) {
        var p = LIKELIHOOD_FLOOR;
        if (mechObjects[m3].indicators && mechObjects[m3].indicators[dim] && mechObjects[m3].indicators[dim][val2] !== undefined) {
          p = mechObjects[m3].indicators[dim][val2];
        }
        probs.push({ mechId: mechObjects[m3].id, displayName: mechObjects[m3].display_name, prob: p });
      }

      // Spread = max(P) - min(P) across mechanisms
      var maxP = 0;
      var minP = 1;
      var bestMech = "";
      for (var k = 0; k < probs.length; k++) {
        if (probs[k].prob > maxP) {
          maxP = probs[k].prob;
          bestMech = probs[k].displayName;
        }
        if (probs[k].prob < minP) minP = probs[k].prob;
      }

      var spread = maxP - minP;
      if (spread > maxSpread) {
        maxSpread = spread;
        bestValue = val2;
      }

      // Build decision logic for this value
      if (spread >= 0.15) { // Only include values with meaningful discrimination
        var shiftPct = Math.round(spread * 100);
        decisionLogic[val2] = "Strongly favors " + bestMech + " (posterior shift +" + shiftPct + "%)";
      }
    }

    // Suggest inspection method based on dimension
    var methodSuggestion = suggestMethod(dim);
    var costRelative = estimateCost(dim);

    dimScores.push({
      dimension: dim,
      discriminating_power: maxSpread,
      best_discriminating_value: bestValue,
      method_suggestion: methodSuggestion,
      cost_relative: costRelative,
      decision_logic: decisionLogic
    });
  }

  // Sort by discriminating power descending
  dimScores.sort(function(a: any, b: any) { return b.discriminating_power - a.discriminating_power; });

  // Return top N
  return dimScores.slice(0, MAX_DISCRIMINATING_TESTS);
}

// ── METHOD SUGGESTION ──────────────────────────────────────────────────
function suggestMethod(dimension: string): string {
  var methods: any = {
    crack_orientation: "PAUT with sectorial scan or TOFD for crack plane determination",
    crack_location: "Phased Array UT (PAUT) B-scan for through-wall position",
    morphology: "Metallographic replica or cross-section (if accessible)",
    service_temperature_f: "Process data review — check DCS historian",
    wall_loss_pattern: "UT C-scan mapping or profile radiography",
    wall_loss_percent_range: "UT thickness grid survey per API 579 Part 4",
    surface_condition: "Visual inspection (VT) with surface preparation",
    weld_proximity: "PAUT or TOFD scan centered on weld",
    crack_depth_ratio: "TOFD or tip-diffraction PAUT for crack depth sizing",
    cp_status: "CP potential survey — half-cell measurement",
    marine_growth_grade: "Visual / ROV survey with cleaning",
    zone_depth: "Survey position relative to tide/splash boundaries",
    coating_condition: "Visual inspection with dry film thickness gauge",
    current_exposure: "Current meter data review or metocean study",
    water_depth_range: "Survey data / as-built drawings review",
    structural_zone: "General visual with zone classification per drawing",
    slamming_exposure: "Sea state records and operational route review",
    free_surface_state: "Tank loading records and stability calculation review",
    ballast_history: "Ballast log review and tank condition survey",
    ph_environment: "Process fluid sampling and pH measurement"
  };
  return methods[dimension] || "Targeted inspection of " + dimension.replace(/_/g, " ");
}

// ── COST ESTIMATION ────────────────────────────────────────────────────
function estimateCost(dimension: string): string {
  var costs: any = {
    crack_orientation: "moderate",
    crack_location: "moderate",
    morphology: "high",
    service_temperature_f: "low",
    wall_loss_pattern: "moderate",
    wall_loss_percent_range: "moderate",
    surface_condition: "low",
    weld_proximity: "moderate",
    crack_depth_ratio: "moderate",
    cp_status: "low",
    marine_growth_grade: "low",
    zone_depth: "low",
    coating_condition: "low",
    current_exposure: "low",
    water_depth_range: "low",
    structural_zone: "low",
    slamming_exposure: "low",
    free_surface_state: "low",
    ballast_history: "low",
    ph_environment: "low"
  };
  return costs[dimension] || "moderate";
}

// ── EVIDENCE CONTRACT VALIDATION ───────────────────────────────────────
function validateInput(body: any): any {
  var missing: string[] = [];

  if (!body.asset_context) {
    return { valid: false, status: "HOLD", missing: ["asset_context"], reason: "No asset context provided" };
  }
  if (!body.asset_context.domain) missing.push("asset_context.domain");
  if (!body.asset_context.material) missing.push("asset_context.material");

  // Check hold conditions
  if (missing.length > 0) {
    return {
      valid: false,
      status: "HOLD",
      missing: missing,
      reason: "Insufficient asset context to run differential diagnosis"
    };
  }

  return { valid: true, status: "OK", missing: [] };
}

// ── FULL DIAGNOSIS ─────────────────────────────────────────────────────
function runDiagnosis(body: any): any {
  var validation = validateInput(body);
  if (!validation.valid) {
    return {
      status: validation.status,
      reason: validation.reason,
      missing_fields: validation.missing,
      hypotheses: [],
      discriminating_evidence: [],
      ruled_out: [],
      engine_version: ENGINE_VERSION
    };
  }

  var domain = body.asset_context.domain;
  var service = body.asset_context.service || null;
  var material = body.asset_context.material || null;

  // Load domain KB
  var kb = loadKB(domain);
  if (!kb) {
    return {
      status: "HOLD",
      reason: "Unknown domain: " + domain + ". Supported: fixed, subsea, marine",
      missing_fields: [],
      hypotheses: [],
      discriminating_evidence: [],
      ruled_out: [],
      engine_version: ENGINE_VERSION
    };
  }

  // Map evidence
  var evidence = mapEvidence(
    body.observed_evidence || {},
    body.asset_context
  );

  var completeness = assessCompleteness(evidence, domain);

  // Load priors
  var priorResult = loadPriors(domain, service, material);
  var priorTable = priorResult.priors;

  // FMD dominant (from decision-core, if present)
  var fmdDominant = (body.decision_core_result && body.decision_core_result.fmd_dominant)
    ? body.decision_core_result.fmd_dominant
    : null;

  // Phase 1: Prerequisite pruning
  var candidates: any[] = [];
  var ruledOut: any[] = [];

  for (var mechId in kb) {
    var mech = kb[mechId];
    var prereqResult = checkPrerequisites(mech, body.asset_context);

    if (prereqResult.passed) {
      candidates.push(mech);
    } else {
      ruledOut.push({
        mechanism_id: mech.id,
        display_name: mech.display_name,
        reason: prereqResult.reason
      });
    }
  }

  // If no candidates survive, return insufficient discrimination
  if (candidates.length === 0) {
    return {
      status: "INSUFFICIENT_DISCRIMINATION",
      reason: "All mechanisms eliminated by prerequisites — check asset context",
      hypotheses: [],
      discriminating_evidence: [],
      ruled_out: ruledOut,
      confidence_ceiling: 0,
      confidence_floor: 0,
      prior_source: priorResult.source,
      evidence_dimensions_used: completeness.provided,
      evidence_dimensions_available: completeness.total_dimensions,
      engine_version: ENGINE_VERSION
    };
  }

  // Phase 2–4: Bayesian scoring
  var ranked = computePosteriors(candidates, evidence, priorTable, fmdDominant);

  // Take top N for output
  var topN = ranked.slice(0, MAX_HYPOTHESES_RETURNED);

  // Phase 5: Discriminating evidence (only for top hypotheses)
  var discriminating = computeDiscriminatingEvidence(topN, kb, evidence);

  // Compute confidence ceiling
  var confidenceCeiling = 1.0;
  if (!service) confidenceCeiling = Math.min(confidenceCeiling, CONFIDENCE_CAP_NO_SERVICE);
  if (completeness.provided < 2) confidenceCeiling = Math.min(confidenceCeiling, 0.50);

  // Cap posteriors at ceiling
  for (var r = 0; r < topN.length; r++) {
    if (topN[r].posterior > confidenceCeiling) {
      topN[r].posterior = confidenceCeiling;
      topN[r].capped = true;
    }
  }

  // Determine status
  var status = "RESOLVED";
  if (topN.length > 0 && topN[0].posterior < 0.15) {
    status = "INSUFFICIENT_DISCRIMINATION";
  }

  // Check for FMD divergence
  var fmdDivergence = null;
  if (fmdDominant && topN.length > 0 && topN[0].mechanism_id !== fmdDominant) {
    var fmdEntry = null;
    for (var f = 0; f < ranked.length; f++) {
      if (ranked[f].mechanism_id === fmdDominant) {
        fmdEntry = ranked[f];
        break;
      }
    }
    if (fmdEntry) {
      fmdDivergence = {
        fmd_selected: fmdDominant,
        dde_top: topN[0].mechanism_id,
        delta_posterior: Math.round((topN[0].posterior - fmdEntry.posterior) * 100) / 100,
        note: "FMD selected " + fmdDominant + "; differential diagnosis suggests " + topN[0].display_name + " is competitive (delta posterior " + Math.round((topN[0].posterior - fmdEntry.posterior) * 100) + "%)"
      };
    }
  }

  return {
    deterministic: {
      status: status,
      hypotheses: topN.map(function(h: any) {
        return {
          mechanism_id: h.mechanism_id,
          display_name: h.display_name,
          posterior: Math.round(h.posterior * 10000) / 10000,
          prior: Math.round(h.prior * 10000) / 10000,
          log_likelihood: Math.round(h.logLikelihood * 100) / 100,
          supporting_evidence: h.supporting_evidence,
          contradicting_evidence: h.contradicting_evidence,
          code_reference: h.code_reference,
          severity_default: h.severity_default,
          typical_consequence: h.typical_consequence
        };
      }),
      discriminating_evidence: discriminating,
      ruled_out: ruledOut,
      fmd_divergence: fmdDivergence,
      confidence_ceiling: confidenceCeiling,
      confidence_floor: 0.0,
      candidates_evaluated: candidates.length,
      candidates_eliminated: ruledOut.length
    },
    interpreted: {
      top_mechanism: topN.length > 0 ? topN[0].display_name : "none",
      top_posterior: topN.length > 0 ? Math.round(topN[0].posterior * 100) + "%" : "N/A",
      discrimination_quality: discriminating.length > 0
        ? (discriminating[0].discriminating_power > 0.40 ? "strong" : discriminating[0].discriminating_power > 0.20 ? "moderate" : "weak")
        : "no_unobserved_dimensions",
      next_best_test: discriminating.length > 0
        ? discriminating[0].method_suggestion
        : "All discriminating dimensions already observed"
    },
    provenance: {
      engine_version: ENGINE_VERSION,
      prior_source: priorResult.source,
      evidence_dimensions_used: completeness.provided,
      evidence_dimensions_available: completeness.total_dimensions,
      evidence_completeness: Math.round(completeness.completeness_ratio * 100) + "%",
      missing_dimensions: completeness.missing_dimensions,
      fmd_dominant_input: fmdDominant,
      domain: domain,
      kb_mechanisms_total: Object.keys(kb).length,
      timestamp: new Date().toISOString()
    }
  };
}

// ── HANDLER ────────────────────────────────────────────────────────────
var handler: Handler = async function(event) {
  var headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: headers, body: "" };
  }

  try {
    var body: any = {};
    if (event.body) {
      try { body = JSON.parse(event.body); } catch (e) { body = {}; }
    }

    var action = body.action || "get_registry";

    // ── GET_REGISTRY ────────────────────────────────────────────────
    if (action === "get_registry") {
      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({
          engine: "Differential Diagnosis Engine",
          version: ENGINE_VERSION,
          deploy: "DEPLOY341",
          description: "Bayesian damage mechanism ranking with prerequisite pruning, posterior computation, and discriminating evidence surfacing for NDT inspection workflows",
          actions: ACTION_REGISTRY,
          domains: {
            fixed: { mechanisms: Object.keys(MECHANISMS_FIXED).length, description: "Refining / petrochemical fixed equipment" },
            subsea: { mechanisms: Object.keys(MECHANISMS_SUBSEA).length, description: "Subsea pipelines, risers, jackets, offshore structures" },
            marine: { mechanisms: Object.keys(MECHANISMS_MARINE).length, description: "Ship hulls, MODUs, marine vessels" },
            floating: { mechanisms: Object.keys(MECHANISMS_FLOATING).length, description: "Floating production platforms — FPSO, TLP, Semi-Sub, SPAR, FLNG" },
            production: { mechanisms: Object.keys(MECHANISMS_PRODUCTION).length, description: "Subsea production equipment, mooring systems, flow assurance" }
          },
          total_mechanisms: Object.keys(MECHANISMS_FIXED).length + Object.keys(MECHANISMS_SUBSEA).length + Object.keys(MECHANISMS_MARINE).length + Object.keys(MECHANISMS_FLOATING).length + Object.keys(MECHANISMS_PRODUCTION).length,
          mathematics: "Bayesian inference with categorical evidence — P(M|E) = P(E|M) * P(M) / sum(P(E|M_i) * P(M_i))",
          what_this_is_not: [
            "Not multi-agent debate — deterministic Bayesian ranking",
            "Not online learning — priors are hand-calibrated and version-controlled",
            "Not a replacement for engineering judgment — decision support only",
            "Not novel mathematics — textbook Bayesian inference, novel application architecture"
          ]
        })
      };
    }

    // ── DIAGNOSE (full pipeline) ────────────────────────────────────
    if (action === "diagnose") {
      var result = runDiagnosis(body);

      // Non-fatal DB write
      try {
        if (supabaseUrl && supabaseKey) {
          var db = createClient(supabaseUrl, supabaseKey);
          await db.from("dde_assessments").insert({
            case_id: (body.decision_core_result && body.decision_core_result.case_id) || null,
            domain: body.asset_context ? body.asset_context.domain : null,
            service: body.asset_context ? body.asset_context.service : null,
            material: body.asset_context ? body.asset_context.material : null,
            status: result.deterministic ? result.deterministic.status : (result.status || null),
            top_mechanism: result.deterministic ? result.deterministic.hypotheses[0]?.mechanism_id : null,
            top_posterior: result.deterministic ? result.deterministic.hypotheses[0]?.posterior : null,
            fmd_dominant: (body.decision_core_result && body.decision_core_result.fmd_dominant) || null,
            fmd_divergence: result.deterministic ? (result.deterministic.fmd_divergence !== null) : false,
            evidence_dimensions_used: result.provenance ? result.provenance.evidence_dimensions_used : 0,
            input_data: body,
            result_data: result
          });
        }
      } catch (dbErr) {
        // Non-fatal — DDE works without DB
      }

      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify(result)
      };
    }

    // ── RANK_MECHANISMS (posterior only, no discriminating) ──────────
    if (action === "rank_mechanisms") {
      var rankResult = runDiagnosis(body);
      // Strip discriminating evidence for lighter response
      if (rankResult.deterministic) {
        rankResult.deterministic.discriminating_evidence = [];
      }
      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify(rankResult)
      };
    }

    // ── CHECK_PREREQUISITES ─────────────────────────────────────────
    if (action === "check_prerequisites") {
      var domain = body.asset_context ? body.asset_context.domain : "fixed";
      var kb = loadKB(domain);
      if (!kb) {
        return {
          statusCode: 200,
          headers: headers,
          body: JSON.stringify({ error: "Unknown domain: " + domain })
        };
      }

      var prereqResults: any = { passed: [], failed: [] };
      for (var mechId in kb) {
        var prereqCheck = checkPrerequisites(kb[mechId], body.asset_context || {});
        if (prereqCheck.passed) {
          prereqResults.passed.push({ mechanism_id: mechId, display_name: kb[mechId].display_name });
        } else {
          prereqResults.failed.push({
            mechanism_id: mechId,
            display_name: kb[mechId].display_name,
            reason: prereqCheck.reason
          });
        }
      }

      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({
          domain: domain,
          total_mechanisms: Object.keys(kb).length,
          passed: prereqResults.passed.length,
          failed: prereqResults.failed.length,
          results: prereqResults,
          engine_version: ENGINE_VERSION
        })
      };
    }

    // ── GET_KB_INFO ─────────────────────────────────────────────────
    if (action === "get_kb_info") {
      var domain2 = body.domain || "fixed";
      var kb2 = loadKB(domain2);
      if (!kb2) {
        return {
          statusCode: 200,
          headers: headers,
          body: JSON.stringify({ error: "Unknown domain: " + domain2 })
        };
      }

      var mechanisms: any[] = [];
      for (var mechId2 in kb2) {
        var m = kb2[mechId2];
        mechanisms.push({
          id: m.id,
          display_name: m.display_name,
          severity_default: m.severity_default,
          typical_consequence: m.typical_consequence,
          code_reference: m.code_reference,
          prerequisite_count: Object.keys(m.prerequisites || {}).length,
          indicator_dimensions: Object.keys(m.indicators || {}).length,
          synergistic_with: m.synergistic_with,
          competes_with: m.competes_with
        });
      }

      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({
          domain: domain2,
          mechanism_count: mechanisms.length,
          mechanisms: mechanisms,
          engine_version: ENGINE_VERSION
        })
      };
    }

    // ── GET_DISCRIMINATING_TESTS ────────────────────────────────────
    if (action === "get_discriminating_tests") {
      var domain3 = body.asset_context ? body.asset_context.domain : "fixed";
      var kb3 = loadKB(domain3);
      if (!kb3) {
        return {
          statusCode: 200,
          headers: headers,
          body: JSON.stringify({ error: "Unknown domain: " + domain3 })
        };
      }

      var mechIds = body.mechanism_ids || [];
      var evidence3 = mapEvidence(body.observed_evidence || {}, body.asset_context || {});

      var topForDisc: any[] = [];
      for (var d = 0; d < mechIds.length; d++) {
        if (kb3[mechIds[d]]) {
          topForDisc.push({ mechanism_id: mechIds[d] });
        }
      }

      var discTests = computeDiscriminatingEvidence(topForDisc, kb3, evidence3);

      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({
          mechanisms_compared: mechIds,
          discriminating_evidence: discTests,
          engine_version: ENGINE_VERSION
        })
      };
    }

    // ── GET_HISTORY ─────────────────────────────────────────────────
    if (action === "get_history") {
      if (!supabaseUrl || !supabaseKey) {
        return {
          statusCode: 200,
          headers: headers,
          body: JSON.stringify({ history: [], note: "Database not configured" })
        };
      }

      var db2 = createClient(supabaseUrl, supabaseKey);
      var query = db2.from("dde_assessments").select("*").order("created_at", { ascending: false }).limit(body.limit || 20);

      if (body.case_id) query = query.eq("case_id", body.case_id);
      if (body.domain) query = query.eq("domain", body.domain);

      var dbResult = await query;

      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({
          history: dbResult.data || [],
          count: (dbResult.data || []).length,
          engine_version: ENGINE_VERSION
        })
      };
    }

    // ── UNKNOWN ACTION ──────────────────────────────────────────────
    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({
        error: "Unknown action: " + action,
        available_actions: Object.keys(ACTION_REGISTRY),
        engine_version: ENGINE_VERSION
      })
    };

  } catch (err: any) {
    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({
        error: "DDE engine error: " + (err.message || String(err)),
        engine_version: ENGINE_VERSION
      })
    };
  }
};

export { handler };
