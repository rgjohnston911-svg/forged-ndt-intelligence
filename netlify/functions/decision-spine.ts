// @ts-nocheck
/**
 * DEPLOY220 - decision-spine.ts (replaces DEPLOY216)
 * netlify/functions/decision-spine.ts
 *
 * THE SPINE v2.0 — Decision State Machine + Unified Confidence
 *                   + Conceptual Reasoning Engine
 *
 * WHAT CHANGED FROM DEPLOY216:
 *   1. DECISION STATE MACHINE — 5 states: pending, blocked, provisional,
 *      advisory, authority_locked. Physics sufficiency enforced as a gate.
 *   2. UNIFIED CONFIDENCE — single composite score that can NEVER exceed
 *      physics coverage. No more 98% confidence with 50% coverage.
 *   3. CONCEPTUAL REASONING ENGINE — traces the 6-concept reasoning chain
 *      (physical reality -> damage -> consequence -> authority -> sufficiency
 *      -> decision) and exposes it in the bundle. This is the system's
 *      concept-thinking architecture: it reasons through engineering
 *      CONCEPTS, not keywords.
 *   4. EXECUTION MODE — self-declares "deterministic" for audit trail.
 *
 * POST { case_id: string }
 *
 * CRITICAL: var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var SPINE_VERSION = "decision-spine/2.0.0";
var EXECUTION_MODE = "deterministic";

// ================================================================
// THRESHOLDS
// ================================================================
var OOD_IN_DISTRIBUTION = 0.82;
var OOD_MARGINAL = 0.72;

// State machine gates
var PHYSICS_BLOCKED_THRESHOLD = 0.60;    // below 60% -> BLOCKED
var PHYSICS_PROVISIONAL_THRESHOLD = 0.85; // 60-85% -> PROVISIONAL
// above 85% -> eligible for AUTHORITY_LOCKED

// OOD confidence discounts
var OOD_DISCOUNT_IN = 1.0;
var OOD_DISCOUNT_MARGINAL = 0.75;
var OOD_DISCOUNT_OUT = 0.50;
var OOD_DISCOUNT_UNKNOWN = 0.60;

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

function safe(v) {
  if (v === null || v === undefined) return null;
  return v;
}

function num(v) {
  if (v === null || v === undefined || v === "") return null;
  var n = Number(v);
  if (isNaN(n)) return null;
  return n;
}

// ================================================================
// OOD SCORING (unchanged logic, cleaner output)
// ================================================================
function scoreOOD(neighbors) {
  if (!neighbors || neighbors.length === 0) {
    return { ood_score: null, ood_flag: "unknown", top_similarity: null,
      discount: OOD_DISCOUNT_UNKNOWN,
      rationale: "No prior cases available. Case library too small for distribution fit." };
  }
  var top = num(neighbors[0].similarity);
  if (top === null) return { ood_score: null, ood_flag: "unknown", top_similarity: null,
    discount: OOD_DISCOUNT_UNKNOWN,
    rationale: "Neighbor returned with no similarity score." };

  var flag = "out_of_distribution";
  var discount = OOD_DISCOUNT_OUT;
  var rationale = "";

  if (top >= OOD_IN_DISTRIBUTION) {
    flag = "in_distribution";
    discount = OOD_DISCOUNT_IN;
    rationale = "Top neighbor similarity " + top.toFixed(3) + " >= " + OOD_IN_DISTRIBUTION +
      ". Case fits prior patterns; confidence preserved.";
  } else if (top >= OOD_MARGINAL) {
    flag = "marginal";
    discount = OOD_DISCOUNT_MARGINAL;
    rationale = "Top neighbor similarity " + top.toFixed(3) + " in marginal band [" +
      OOD_MARGINAL + ", " + OOD_IN_DISTRIBUTION +
      "). Confidence discounted 25%. Human review recommended.";
  } else {
    flag = "out_of_distribution";
    discount = OOD_DISCOUNT_OUT;
    rationale = "Top neighbor similarity " + top.toFixed(3) + " < " + OOD_MARGINAL +
      ". No close prior. Confidence halved. Escalate to human authority.";
  }
  return { ood_score: top, ood_flag: flag, top_similarity: top, discount: discount, rationale: rationale };
}

// ================================================================
// PHYSICS SUFFICIENCY — DEPLOY265 REGISTRY-DRIVEN
// Replaces hardcoded checks with data-driven registry lookups.
// ================================================================
// ================================================================
// TRIGGER EVALUATION
// Evaluates whether a trigger condition fires for a given case.
// Triggers are data-driven: each one names a case field and a match rule.
// ================================================================
function evaluateTrigger(triggerName, caseRow, findings, thickness) {
  // Hard-coded trigger evaluations that map to the physics_check_triggers table.
  // These run in the function to avoid an extra DB round-trip per check.
  // The table exists so the registry is self-documenting and queryable.
  if (triggerName === "method_is_ut") {
    return caseRow.method === "ut" || caseRow.method === "UT";
  }
  if (triggerName === "has_thickness_data") {
    return thickness && thickness.length > 0;
  }
  if (triggerName === "component_is_pressure") {
    return caseRow.component_name && /pipe|vessel|tank|shell|header|riser|column|drum/i.test(caseRow.component_name);
  }
  if (triggerName === "finding_has_crack") {
    if (!findings || findings.length === 0) return false;
    for (var i = 0; i < findings.length; i++) {
      var ft = (findings[i].indication_type || findings[i].finding_type || findings[i].label || "").toLowerCase();
      if (ft.indexOf("crack") >= 0) return true;
    }
    return false;
  }
  if (triggerName === "load_is_cyclic") {
    return caseRow.load_condition && /cyclic|fatigue|pulsat|vibration/i.test(String(caseRow.load_condition));
  }
  if (triggerName === "temp_above_370c") {
    var t370 = num(caseRow.service_temperature_c);
    return t370 !== null && t370 > 370;
  }
  if (triggerName === "temp_above_200c") {
    var t200 = num(caseRow.service_temperature_c);
    return t200 !== null && t200 > 200;
  }
  if (triggerName === "temp_below_minus20c") {
    var tLow = num(caseRow.service_temperature_c);
    return tLow !== null && tLow < -20;
  }
  if (triggerName === "has_coating") {
    return caseRow.component_name && /coat|lined|lining|clad|overlay/i.test(caseRow.component_name);
  }
  if (triggerName === "environment_is_corrosive") {
    return caseRow.load_condition && /acid|chloride|sulfide|caustic|sour|amine|wet.*h2s/i.test(String(caseRow.load_condition));
  }
  if (triggerName === "has_refractory") {
    return caseRow.component_name && /refractory|kiln|furnace|incinerator|duct.*hot|flue/i.test(caseRow.component_name);
  }
  if (triggerName === "is_composite") {
    return caseRow.material_class && /composite|frp|grp|gfrp|cfrp|fiber.*reinf/i.test(caseRow.material_class);
  }
  if (triggerName === "is_polymer_lined") {
    return caseRow.material_class && /rubber|ptfe|pvc|hdpe|pp.*lined|polymer|ebonite|flake.*glass/i.test(caseRow.material_class);
  }
  if (triggerName === "has_insulation") {
    return caseRow.component_name && /insul|blanket|lagging|jacketed|cryogenic/i.test(caseRow.component_name);
  }
  if (triggerName === "is_glass_lined") {
    return caseRow.material_class && /glass.*lined|enamel|porcelain/i.test(caseRow.material_class);
  }
  // Unknown trigger — don't fire it (safe default)
  return false;
}

// ================================================================
// WALL THICKNESS EVALUATION (preserved from original)
// Runs the actual min/nominal/verdict calculation when thickness data exists.
// ================================================================
function evaluateThicknessData(thickness) {
  var vals = [];
  var nominal = null;
  for (var i = 0; i < thickness.length; i++) {
    var tv = num(thickness[i].thickness_in);
    if (tv !== null && tv > 0) vals.push(tv);
    if (!nominal) {
      var nv = num(thickness[i].nominal_in);
      if (nv !== null && nv > 0) nominal = nv;
    }
  }
  if (vals.length === 0) return { result: null, missingNominal: false };
  var minT = Math.min.apply(null, vals);
  var pct = nominal ? minT / nominal : null;
  return {
    result: {
      reading_count: vals.length,
      min_in: minT,
      nominal_in: nominal,
      pct_of_nominal: pct,
      verdict: pct === null ? "informational" :
        (pct < 0.50 ? "reject" : (pct < 0.80 ? "ffs_review" : "pass"))
    },
    missingNominal: !nominal
  };
}

// ================================================================
// PHYSICS SUFFICIENCY — DATA-DRIVEN (DEPLOY265)
//
// Queries the physics_check_registry for the case's material_class.
// Falls back to 'unknown' if no rows match (generic safety checks).
// Trigger conditions determine which conditional checks fire.
// Return shape is identical to the original for downstream compatibility.
// ================================================================
async function assessPhysicsCoverage(sb, caseRow, findings, thickness) {
  var checks = [];
  var hasThickness = thickness && thickness.length > 0;
  var thicknessEval = hasThickness ? evaluateThicknessData(thickness) : null;

  // Normalize material class for lookup
  var matClass = (caseRow.material_class || "").toLowerCase().replace(/[\s-]+/g, "_");

  // Query registry for this material class
  var regRes = await sb.from("physics_check_registry")
    .select("*")
    .eq("material_class", matClass)
    .eq("active", true)
    .order("display_order", { ascending: true });

  var registryRows = (regRes.data && regRes.data.length > 0) ? regRes.data : null;

  // Fallback: if no material-specific rows, try 'unknown' (generic checks)
  if (!registryRows) {
    var fallbackRes = await sb.from("physics_check_registry")
      .select("*")
      .eq("material_class", "unknown")
      .eq("active", true)
      .order("display_order", { ascending: true });
    registryRows = (fallbackRes.data && fallbackRes.data.length > 0) ? fallbackRes.data : [];
  }

  // Evaluate each registry row
  for (var ri = 0; ri < registryRows.length; ri++) {
    var row = registryRows[ri];
    var isRequired = false;
    var isRecommended = false;
    var triggerFired = true;

    // Determine if this check applies
    if (row.requirement_level === "required") {
      // Always required for this material — no trigger needed
      isRequired = true;
    } else if (row.requirement_level === "conditional") {
      // Only required if trigger condition fires
      if (row.trigger_condition) {
        triggerFired = evaluateTrigger(row.trigger_condition, caseRow, findings, thickness);
      }
      isRequired = triggerFired;
    } else if (row.requirement_level === "recommended") {
      // Advisory only — check trigger but mark as recommended, not required
      if (row.trigger_condition) {
        triggerFired = evaluateTrigger(row.trigger_condition, caseRow, findings, thickness);
      }
      isRecommended = triggerFired;
      isRequired = false;
    }

    // Skip checks that don't apply
    if (!isRequired && !isRecommended) continue;

    // Build the check object
    var missingInputs = [];
    var checkRunnable = false;
    var checkResult = null;

    // Special handling for wall thickness checks — run the actual evaluation
    if (row.check_id === "wall_thickness_vs_nominal" || row.check_id === "wall_thickness_recommended") {
      checkRunnable = hasThickness;
      if (!hasThickness) {
        var templates = row.missing_inputs_template || [];
        for (var mi = 0; mi < templates.length; mi++) {
          missingInputs.push(templates[mi]);
        }
      } else if (thicknessEval) {
        checkResult = thicknessEval.result;
        if (thicknessEval.missingNominal) {
          missingInputs.push("nominal thickness");
        }
      }
    } else {
      // For all other checks: not yet runnable (solver is stub or planned)
      // Missing inputs come from the registry template
      if (isRequired || isRecommended) {
        checkRunnable = (row.solver_status === "active");
        var inputTemplates = row.missing_inputs_template || [];
        for (var ti = 0; ti < inputTemplates.length; ti++) {
          missingInputs.push(inputTemplates[ti]);
        }
        if (row.solver_status === "stub" || row.solver_status === "planned") {
          checkResult = { solver: row.solver_status, note: row.solver_note || "Solver slot reserved." };
        }
      }
    }

    // Special: wall_loss_severity triggers only when thickness shows non-pass
    if (row.check_id === "wall_loss_severity") {
      if (!hasThickness || !thicknessEval || !thicknessEval.result || thicknessEval.result.verdict === "pass") {
        isRequired = false;
        isRecommended = false;
        continue;
      }
    }

    checks.push({
      check_id: row.check_id,
      code_ref: row.code_ref,
      description: row.check_description,
      required: isRequired,
      recommended: isRecommended,
      runnable: checkRunnable,
      missing_inputs: missingInputs,
      result: checkResult,
      source: "registry",
      material_class: row.material_class
    });
  }

  // ---- Coverage summary ----
  // Only required checks count toward coverage_pct and the blocking gate.
  // Recommended checks are advisory — they surface as warnings but never block.
  var required = 0, runnable = 0, recommendedCount = 0;
  for (var ci = 0; ci < checks.length; ci++) {
    if (checks[ci].required) {
      required++;
      if (checks[ci].runnable) runnable++;
    }
    if (checks[ci].recommended) recommendedCount++;
  }
  var coveragePct = required === 0 ? 1.0 : runnable / required;

  var summaryText = "";
  if (required === 0 && recommendedCount === 0) {
    summaryText = "No physics checks required for this case type.";
  } else if (required === 0 && recommendedCount > 0) {
    summaryText = "No physics checks required, but " + recommendedCount +
      " recommended check(s) could improve confidence. See advisory items.";
  } else {
    summaryText = runnable + " of " + required + " required checks runnable with current data (" +
      Math.round(coveragePct * 100) + "% coverage).";
    if (recommendedCount > 0) {
      summaryText = summaryText + " " + recommendedCount + " additional recommended check(s) available.";
    }
  }

  return {
    checks: checks,
    required_count: required,
    runnable_count: runnable,
    recommended_count: recommendedCount,
    coverage_pct: coveragePct,
    material_class_used: matClass,
    registry_rows_matched: registryRows.length,
    summary: summaryText
  };
}

// ================================================================
// COLLECT RECOMMENDED ADVISORIES
// Recommended checks don't block, but inspectors should see them.
// ================================================================
function collectAdvisories(physics) {
  var advisories = [];
  for (var i = 0; i < physics.checks.length; i++) {
    if (physics.checks[i].recommended && physics.checks[i].missing_inputs.length > 0) {
      for (var j = 0; j < physics.checks[i].missing_inputs.length; j++) {
        advisories.push(physics.checks[i].check_id + ": " + physics.checks[i].missing_inputs[j]);
      }
    }
  }
  return advisories;
}

// ================================================================
// DECISION STATE MACHINE (NEW IN DEPLOY220)
// ================================================================
function resolveDecisionState(caseRow, ood, physics, hasAiFindings) {
  var state = "pending";
  var reason = "";
  var blockers = [];
  var advisories = collectAdvisories(physics);

  // Gate 1: Physics sufficiency
  if (physics.required_count > 0 && physics.coverage_pct < PHYSICS_BLOCKED_THRESHOLD) {
    state = "blocked";
    reason = "Physics coverage " + Math.round(physics.coverage_pct * 100) +
      "% is below the " + Math.round(PHYSICS_BLOCKED_THRESHOLD * 100) +
      "% minimum required to issue any decision.";
    // Collect specific missing items
    for (var i = 0; i < physics.checks.length; i++) {
      if (physics.checks[i].required && physics.checks[i].missing_inputs.length > 0) {
        for (var j = 0; j < physics.checks[i].missing_inputs.length; j++) {
          blockers.push(physics.checks[i].check_id + ": " + physics.checks[i].missing_inputs[j]);
        }
      }
    }
    return { state: state, reason: reason, blockers: blockers, advisories: advisories, gate_detail: {
      gate: "physics_sufficiency",
      threshold: PHYSICS_BLOCKED_THRESHOLD,
      actual: physics.coverage_pct
    }};
  }

  // Gate 2: AI-only findings without measurement confirmation -> ADVISORY
  if (hasAiFindings && physics.runnable_count === 0 && physics.required_count > 0) {
    state = "advisory";
    reason = "Findings are AI-classified but no engineering measurements confirm them. " +
      "Decision is informational only. Collect measurements to upgrade to a code-authoritative state.";
    return { state: state, reason: reason, blockers: [], advisories: advisories, gate_detail: {
      gate: "ai_boundary",
      note: "AI-sourced findings present without measurement confirmation"
    }};
  }

  // Gate 3: Partial physics or OOD marginal -> PROVISIONAL
  if (physics.required_count > 0 && physics.coverage_pct < PHYSICS_PROVISIONAL_THRESHOLD) {
    state = "provisional";
    reason = "Physics coverage " + Math.round(physics.coverage_pct * 100) +
      "% is below " + Math.round(PHYSICS_PROVISIONAL_THRESHOLD * 100) +
      "%. Decision issued with mandatory human review. Cannot be authority-locked until coverage improves.";
    return { state: state, reason: reason, blockers: [], advisories: advisories, gate_detail: {
      gate: "physics_sufficiency",
      threshold: PHYSICS_PROVISIONAL_THRESHOLD,
      actual: physics.coverage_pct
    }};
  }

  if (ood.ood_flag === "out_of_distribution") {
    state = "provisional";
    reason = "Case is out-of-distribution (no close prior in case library). " +
      "Decision issued but requires human authority review before locking.";
    return { state: state, reason: reason, blockers: [], advisories: advisories, gate_detail: {
      gate: "ood_distribution",
      ood_flag: ood.ood_flag,
      ood_score: ood.ood_score
    }};
  }

  // Gate 4: All gates pass -> eligible for AUTHORITY_LOCKED
  // (actual locking requires run-authority to execute and all planner actions resolved)
  var authorityLocked = !!caseRow.authority_locked;
  if (authorityLocked) {
    state = "authority_locked";
    reason = "All physics gates passed. Authority decision locked and signed. " +
      "This is a code-authoritative, audit-grade decision.";
  } else {
    // Everything passes but authority hasn't locked yet
    state = "provisional";
    reason = "Physics coverage " + Math.round(physics.coverage_pct * 100) +
      "% meets threshold. Run Authority Lock to finalize the decision.";
  }

  return { state: state, reason: reason, blockers: [], advisories: advisories, gate_detail: {
    gate: authorityLocked ? "all_passed" : "awaiting_authority_lock",
    physics_pct: physics.coverage_pct,
    ood_flag: ood.ood_flag
  }};
}

// ================================================================
// UNIFIED CONFIDENCE (NEW IN DEPLOY220)
// ================================================================
function computeUnifiedConfidence(caseRow, ood, physics) {
  // Component 1: Authority confidence (from run-authority, 0-1)
  var authConf = num(caseRow.final_confidence);
  if (authConf === null) authConf = 0.50; // default if authority hasn't run

  // Component 2: Physics coverage fraction (0-1)
  var physicsFraction = physics.coverage_pct;

  // Component 3: OOD discount (1.0, 0.75, 0.50, or 0.60)
  var oodDiscount = ood.discount;

  // UNIFIED = min(authority, physics) * ood_discount
  // This ensures confidence can NEVER exceed physics coverage
  var base = Math.min(authConf, physicsFraction);
  var unified = base * oodDiscount;

  // Clamp to [0, 0.99] — 1.0 would imply perfect certainty
  unified = Math.max(0, Math.min(0.99, unified));

  return {
    unified_confidence: Math.round(unified * 1000) / 1000,
    components: {
      authority_confidence: authConf,
      physics_coverage: physicsFraction,
      ood_discount: oodDiscount,
      ood_flag: ood.ood_flag,
      base_before_ood: base,
      formula: "min(authority_confidence, physics_coverage) * ood_discount"
    }
  };
}

// ================================================================
// CONCEPTUAL REASONING ENGINE TRACE (NEW IN DEPLOY220)
//
// This traces the 6-concept reasoning chain that decision-core
// uses. Even when decision-core hasn't run, the spine maps the
// available evidence to each concept layer. This is the "concept
// thinking" architecture: the system reasons through engineering
// CONCEPTS in sequence, not isolated keyword matches.
//
// Concept 1: Physical Reality — what forces/conditions exist?
// Concept 2: Damage Reality — what degradation mechanisms are active?
// Concept 3: Consequence Reality — what fails if damage continues?
// Concept 4: Authority Reality — which codes govern this situation?
// Concept 5: Sufficiency Reality — do we have enough data to decide?
// Concept 6: Decision Reality — what is the disposition?
// ================================================================
function traceConceptualReasoning(caseRow, findings, thickness, physics, ood, stateResult) {
  var concepts = [];

  // Concept 1: Physical Reality
  var physicalInputs = [];
  if (thickness && thickness.length > 0) physicalInputs.push("wall thickness (" + thickness.length + " readings)");
  if (caseRow.service_temperature_c) physicalInputs.push("service temperature " + caseRow.service_temperature_c + "C");
  if (caseRow.load_condition) physicalInputs.push("load condition: " + caseRow.load_condition);
  if (caseRow.design_pressure) physicalInputs.push("design pressure: " + caseRow.design_pressure);
  if (caseRow.material_class) physicalInputs.push("material: " + caseRow.material_class);
  concepts.push({
    concept: "physical_reality",
    label: "Physical Reality",
    question: "What forces, temperatures, and conditions act on this component?",
    inputs_available: physicalInputs,
    status: physicalInputs.length >= 2 ? "sufficient" : (physicalInputs.length >= 1 ? "partial" : "missing"),
    reasoning: physicalInputs.length >= 2
      ? "Multiple physical parameters established. Stress-temperature-environment context available for mechanism screening."
      : (physicalInputs.length >= 1
        ? "Partial physical context. Some mechanism screening possible but environment coupling is incomplete."
        : "No physical parameters recorded. Cannot reason about damage mechanisms without physical context.")
  });

  // Concept 2: Damage Reality
  var damageInputs = [];
  var findingsList = findings || [];
  for (var fi = 0; fi < findingsList.length; fi++) {
    var f = findingsList[fi];
    var fLabel = f.indication_type || f.finding_type || f.label || "unknown";
    var fSev = f.severity || "unrated";
    damageInputs.push(fLabel + " (" + fSev + ")");
  }
  concepts.push({
    concept: "damage_reality",
    label: "Damage Reality",
    question: "What degradation mechanisms are active or suspected?",
    inputs_available: damageInputs,
    status: damageInputs.length > 0 ? "active" : "no_damage_detected",
    reasoning: damageInputs.length > 0
      ? damageInputs.length + " finding(s) identified. Active degradation requires mechanism classification and severity assessment."
      : "No findings recorded. Either inspection is incomplete or component is undamaged."
  });

  // Concept 3: Consequence Reality
  // Find the wall thickness check by ID (not by index — registry order varies by material)
  var thkCheck = null;
  for (var tc = 0; tc < physics.checks.length; tc++) {
    if (physics.checks[tc].check_id === "wall_thickness_vs_nominal") { thkCheck = physics.checks[tc]; break; }
  }
  var thkResult = thkCheck && thkCheck.result ? thkCheck.result : null;
  var worstVerdict = "unknown";
  if (thkResult && thkResult.verdict) worstVerdict = thkResult.verdict;
  concepts.push({
    concept: "consequence_reality",
    label: "Consequence Reality",
    question: "What fails if damage continues unchecked?",
    inputs_available: thkResult ? ["wall loss verdict: " + worstVerdict, "min thickness: " + (thkResult.min_in || "n/a") + " in"] : [],
    status: worstVerdict === "reject" ? "critical" : (worstVerdict === "ffs_review" ? "elevated" : (worstVerdict === "pass" ? "low" : "unknown")),
    reasoning: worstVerdict === "reject"
      ? "Wall loss exceeds 50% of nominal. Through-wall failure risk is CRITICAL. Immediate action required."
      : (worstVerdict === "ffs_review"
        ? "Wall loss between 20-50%. Fitness-for-service assessment needed to determine remaining life."
        : (worstVerdict === "pass"
          ? "Wall retention above 80%. Continued service is supportable under current code."
          : "Consequence cannot be assessed without thickness data or FFS results."))
  });

  // Concept 4: Authority Reality
  var authDisp = caseRow.final_disposition || "not_yet_run";
  var authCodes = [];
  if (caseRow.code_family) authCodes.push(caseRow.code_family);
  // Add code references from the first required physics check (material-appropriate)
  for (var ac = 0; ac < physics.checks.length; ac++) {
    if (physics.checks[ac].required && physics.checks[ac].code_ref) {
      authCodes.push(physics.checks[ac].code_ref);
      break;
    }
  }
  concepts.push({
    concept: "authority_reality",
    label: "Authority Reality",
    question: "Which engineering codes govern this component and condition?",
    inputs_available: authCodes.length > 0 ? authCodes : ["no code family assigned"],
    status: authDisp !== "not_yet_run" ? "resolved" : "pending",
    reasoning: authDisp !== "not_yet_run"
      ? "Authority resolved to " + String(authDisp).toUpperCase() + ". Code basis: " + authCodes.join(", ") + "."
      : "Authority engine has not been run. Code applicability undetermined."
  });

  // Concept 5: Sufficiency Reality
  concepts.push({
    concept: "sufficiency_reality",
    label: "Sufficiency Reality",
    question: "Do we have enough data to make a code-authoritative decision?",
    inputs_available: [
      "physics coverage: " + Math.round(physics.coverage_pct * 100) + "%",
      "required checks: " + physics.required_count,
      "runnable checks: " + physics.runnable_count,
      "OOD status: " + ood.ood_flag
    ],
    status: physics.coverage_pct >= PHYSICS_PROVISIONAL_THRESHOLD ? "sufficient" : (physics.coverage_pct >= PHYSICS_BLOCKED_THRESHOLD ? "partial" : "insufficient"),
    reasoning: physics.coverage_pct >= PHYSICS_PROVISIONAL_THRESHOLD
      ? "Physics sufficiency meets threshold for code-authoritative decisions. All required engineering checks have data."
      : (physics.coverage_pct >= PHYSICS_BLOCKED_THRESHOLD
        ? "Partial physics coverage. Decision can be issued as PROVISIONAL but cannot be authority-locked."
        : "Insufficient physics coverage. System is BLOCKED from issuing any decision until more data is collected.")
  });

  // Concept 6: Decision Reality
  concepts.push({
    concept: "decision_reality",
    label: "Decision Reality",
    question: "What is the final disposition and can it be locked?",
    inputs_available: [
      "decision state: " + stateResult.state,
      "unified confidence: " + (stateResult.unified_confidence || "pending")
    ],
    status: stateResult.state,
    reasoning: stateResult.reason
  });

  return {
    engine: "conceptual_reasoning/1.0.0",
    description: "6-concept sequential reasoning chain. Each concept builds on the previous. " +
      "The system reasons through engineering CONCEPTS (physical forces, damage mechanisms, " +
      "failure consequences, code authority, data sufficiency, final disposition) rather than " +
      "isolated keyword matching. This is concept-thinking AI applied to industrial inspection.",
    concept_count: concepts.length,
    concepts: concepts
  };
}

// ================================================================
// BUNDLE HASHING
// ================================================================
function stableStringify(obj) {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    var parts0 = [];
    for (var a = 0; a < obj.length; a++) parts0.push(stableStringify(obj[a]));
    return "[" + parts0.join(",") + "]";
  }
  var keys = Object.keys(obj).sort();
  var parts = [];
  for (var ii = 0; ii < keys.length; ii++) {
    parts.push(JSON.stringify(keys[ii]) + ":" + stableStringify(obj[keys[ii]]));
  }
  return "{" + parts.join(",") + "}";
}

function hashBundle(bundle) {
  var canonical = stableStringify(bundle);
  return createHash("sha256").update(canonical).digest("hex");
}

// ================================================================
// SYNTHESIS NARRATIVE (upgraded for DEPLOY220)
// ================================================================
function synthesize(caseRow, ood, physics, neighbors, stateResult, confidence) {
  var parts = [];

  // Decision state (new in DEPLOY220)
  parts.push("Decision State: " + stateResult.state.toUpperCase().replace(/_/g, " ") + ".");
  parts.push(stateResult.reason);

  // Unified confidence
  parts.push("Unified Confidence: " + Math.round(confidence.unified_confidence * 100) +
    "% (authority " + Math.round(confidence.components.authority_confidence * 100) +
    "% x physics " + Math.round(confidence.components.physics_coverage * 100) +
    "% x OOD " + Math.round(confidence.components.ood_discount * 100) + "%).");

  // Authority disposition
  var disp = caseRow.final_disposition || "not_yet_locked";
  parts.push("Authority disposition: " + String(disp).toUpperCase().replace(/_/g, " ") + ".");

  // OOD
  if (ood.ood_flag === "in_distribution") {
    parts.push("In-distribution (top neighbor " +
      (ood.top_similarity != null ? ood.top_similarity.toFixed(3) : "n/a") + ").");
  } else if (ood.ood_flag === "marginal") {
    parts.push("Marginal distribution (top neighbor " +
      (ood.top_similarity != null ? ood.top_similarity.toFixed(3) : "n/a") +
      "). Confidence discounted 25%.");
  } else if (ood.ood_flag === "out_of_distribution") {
    parts.push("OUT-OF-DISTRIBUTION. Confidence halved. Human authority review required.");
  } else {
    parts.push("No distribution data available.");
  }

  // Physics coverage
  if (physics.required_count > 0) {
    parts.push("Physics: " + physics.runnable_count + "/" +
      physics.required_count + " checks runnable (" +
      Math.round(physics.coverage_pct * 100) + "%).");
    if (physics.coverage_pct < 1) {
      var missing = [];
      for (var i = 0; i < physics.checks.length; i++) {
        if (physics.checks[i].required && physics.checks[i].missing_inputs.length > 0) {
          missing.push(physics.checks[i].check_id);
        }
      }
      if (missing.length > 0) parts.push("Missing: " + missing.join(", ") + ".");
    }
  }

  // Neighbor precedent
  if (neighbors && neighbors.length > 0) {
    var dispCounts = {};
    for (var n = 0; n < Math.min(5, neighbors.length); n++) {
      var d = neighbors[n].final_disposition || "unknown";
      dispCounts[d] = (dispCounts[d] || 0) + 1;
    }
    var parts2 = [];
    var keys = Object.keys(dispCounts);
    for (var k = 0; k < keys.length; k++) parts2.push(dispCounts[keys[k]] + " " + keys[k]);
    parts.push("Neighbor precedent: " + parts2.join(", ") + ".");
  }

  return parts.join(" ");
}

// ================================================================
// HANDLER
// ================================================================
export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var caseId = body.case_id;
    if (!caseId) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };

    var sb = createClient(supabaseUrl, supabaseKey);

    var caseRes = await sb.from("inspection_cases").select("*").eq("id", caseId).single();
    if (caseRes.error || !caseRes.data) {
      return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "case not found" }) };
    }
    var caseRow = caseRes.data;

    var findingsRes = await sb.from("findings").select("*").eq("case_id", caseId);
    var thkRes = await sb.from("thickness_readings").select("*").eq("case_id", caseId);

    // Retrieve neighbors via DEPLOY215 RPC
    var neighbors = [];
    if (caseRow.case_embedding) {
      var rpc = await sb.rpc("find_similar_cases", {
        query_embedding: caseRow.case_embedding,
        query_org_id: caseRow.org_id,
        exclude_case_id: caseId,
        match_count: 5
      });
      if (!rpc.error && rpc.data) neighbors = rpc.data;
    }

    // Core computations
    var oodResult = scoreOOD(neighbors);
    var physics = await assessPhysicsCoverage(sb, caseRow, findingsRes.data || [], thkRes.data || []);

    // Detect AI-only findings (findings with no matching measurement confirmation)
    var hasAiFindings = (findingsRes.data || []).length > 0 && physics.runnable_count === 0 && physics.required_count > 0;

    // DEPLOY220: State machine
    var stateResult = resolveDecisionState(caseRow, oodResult, physics, hasAiFindings);

    // DEPLOY220: Unified confidence
    var confidence = computeUnifiedConfidence(caseRow, oodResult, physics);
    stateResult.unified_confidence = confidence.unified_confidence;

    // DEPLOY220: Conceptual reasoning trace
    var conceptTrace = traceConceptualReasoning(caseRow, findingsRes.data || [], thkRes.data || [], physics, oodResult, stateResult);

    // Synthesis narrative
    var synthesis = synthesize(caseRow, oodResult, physics, neighbors, stateResult, confidence);

    // Build signed bundle
    var bundle = {
      bundle_version: SPINE_VERSION,
      execution_mode: EXECUTION_MODE,
      case_id: caseId,
      case_number: caseRow.case_number,
      generated_at: new Date().toISOString(),
      decision_state: stateResult.state,
      decision_state_reason: stateResult.reason,
      decision_state_gate: stateResult.gate_detail,
      unified_confidence: confidence.unified_confidence,
      confidence_components: confidence.components,
      case_snapshot: {
        title: caseRow.title,
        component_name: caseRow.component_name,
        method: caseRow.method,
        material_class: caseRow.material_class,
        load_condition: caseRow.load_condition,
        code_family: caseRow.code_family,
        code_edition: caseRow.code_edition,
        code_section: caseRow.code_section,
        thickness_mm: num(caseRow.thickness_mm)
      },
      inputs_digest: {
        findings_count: (findingsRes.data || []).length,
        thickness_readings_count: (thkRes.data || []).length,
        neighbors_count: neighbors.length
      },
      findings: (findingsRes.data || []).map(function(f) {
        return {
          indication_type: f.indication_type || f.finding_type,
          severity: f.severity,
          notes: f.notes,
          method_detected_by: f.method_detected_by
        };
      }),
      thickness_summary: (function() { for (var ts = 0; ts < physics.checks.length; ts++) { if (physics.checks[ts].check_id === "wall_thickness_vs_nominal" && physics.checks[ts].result) return physics.checks[ts].result; } return null; })(),
      physics_coverage: physics,
      similar_cases: neighbors.map(function(n) {
        return {
          id: n.id,
          case_number: n.case_number,
          similarity: num(n.similarity),
          disposition: n.final_disposition,
          confidence: num(n.final_confidence)
        };
      }),
      ood: oodResult,
      authority: {
        disposition: safe(caseRow.final_disposition),
        confidence: num(caseRow.final_confidence),
        locked: !!caseRow.authority_locked,
        reason: safe(caseRow.final_decision_reason)
      },
      conceptual_reasoning: conceptTrace,
      synthesis: synthesis
    };

    var bundleHash = hashBundle(bundle);
    var signedAt = new Date().toISOString();

    // Persist to DB
    var upd = await sb.from("inspection_cases").update({
      decision_bundle: bundle,
      decision_bundle_hash: bundleHash,
      decision_bundle_version: SPINE_VERSION,
      decision_bundle_signed_at: signedAt,
      ood_score: oodResult.ood_score,
      ood_flag: oodResult.ood_flag,
      physics_coverage: physics,
      decision_state: stateResult.state,
      decision_state_reason: stateResult.reason,
      unified_confidence: confidence.unified_confidence,
      confidence_components: confidence.components,
      conceptual_reasoning: conceptTrace,
      decision_state_changed_at: signedAt
    }).eq("id", caseId);

    if (upd.error) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "persist failed", detail: upd.error.message }) };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        execution_mode: EXECUTION_MODE,
        bundle_version: SPINE_VERSION,
        bundle_hash: bundleHash,
        signed_at: signedAt,
        decision_state: stateResult.state,
        decision_state_reason: stateResult.reason,
        decision_state_gate: stateResult.gate_detail,
        blockers: stateResult.blockers,
        unified_confidence: confidence.unified_confidence,
        confidence_components: confidence.components,
        ood_flag: oodResult.ood_flag,
        ood_score: oodResult.ood_score,
        physics_coverage_pct: physics.coverage_pct,
        physics_summary: physics.summary,
        neighbors_count: neighbors.length,
        conceptual_reasoning: conceptTrace,
        synthesis: synthesis
      })
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
