// @ts-nocheck
/**
 * DEPLOY217 - planner-agent.ts
 * netlify/functions/planner-agent.ts
 *
 * The investigator. Reads the latest decision-spine bundle on a case
 * and emits a prioritized, owner-assigned, rationale-bearing action
 * plan. Pure rule-based first cut: deterministic, auditable, fast,
 * zero LLM token cost per case. The LLM-narration layer is a thin
 * future wrapper.
 *
 * What it converts:
 *   - physics_coverage.checks[].missing_inputs[]  -> data-gathering actions
 *   - ood.ood_flag                                -> escalation actions
 *   - similar_cases (disposition mix)             -> precedent-conflict actions
 *   - thickness_summary.verdict                   -> repair / FFS actions
 *   - findings (unmeasured criticals)             -> sizing actions
 *
 * What it emits per action:
 *   { action_id, kind, priority, owner_role, title, rationale,
 *     expected_information_gain, estimated_effort, source_check_id }
 *
 * Plan-level status:
 *   - ready_to_lock        - no actions required, can proceed
 *   - actions_required     - at least one action open
 *   - escalate             - human-authority escalation present
 *   - unknown              - no spine bundle yet
 *
 * POST { case_id: string }
 *
 * CRITICAL: String concatenation only. No backtick template literals.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var PLANNER_VERSION = "planner-agent/1.0.0";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

// Priority weights for sorting (higher = more urgent)
var PRIORITY_WEIGHT = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25,
  info: 10
};

function priCmp(a, b) {
  var wa = PRIORITY_WEIGHT[a.priority] || 0;
  var wb = PRIORITY_WEIGHT[b.priority] || 0;
  return wb - wa;
}

function mkAction(kind, priority, owner_role, title, rationale, opts) {
  opts = opts || {};
  return {
    action_id: kind + "_" + Math.random().toString(36).substring(2, 10),
    kind: kind,
    priority: priority,
    owner_role: owner_role,
    title: title,
    rationale: rationale,
    expected_information_gain: opts.gain || null,
    estimated_effort: opts.effort || null,
    source_check_id: opts.source || null,
    references: opts.references || []
  };
}

// ================================================================
// PLANNER RULES
// ================================================================
function plan(caseRow, bundle) {
  var actions = [];

  if (!bundle) {
    return {
      planner_version: PLANNER_VERSION,
      generated_at: new Date().toISOString(),
      status: "unknown",
      actions: [],
      summary: "No decision-spine bundle exists yet. Run the spine first to enable planning."
    };
  }

  var ood = bundle.ood || {};
  var physics = bundle.physics_coverage || {};
  var checks = physics.checks || [];
  var neighbors = bundle.similar_cases || [];
  var thkSummary = bundle.thickness_summary || null;
  var findings = bundle.findings || [];
  var authority = bundle.authority || {};

  // ----------- RULE 1: OOD escalation -----------
  if (ood.ood_flag === "out_of_distribution") {
    actions.push(mkAction(
      "escalate_to_human",
      "critical",
      "supervisor",
      "Escalate to senior engineer: novel-case review",
      "OOD detector flagged this case as out-of-distribution (top neighbor similarity " +
        (ood.top_similarity != null ? Number(ood.top_similarity).toFixed(3) : "n/a") +
        "). No close prior exists in the case library; machine confidence should be discounted. " +
        "Senior human authority must review before the disposition is locked.",
      { gain: "Prevents misclassification of novel failure modes.", effort: "30-60 min review" }
    ));
  } else if (ood.ood_flag === "marginal") {
    actions.push(mkAction(
      "review_neighbors",
      "high",
      "integrity_engineer",
      "Compare against top-K neighbors before sign-off",
      "Top neighbor similarity " + (ood.top_similarity != null ? Number(ood.top_similarity).toFixed(3) : "n/a") +
        " is in the marginal band. The retrieved neighbors offer partial precedent but not strong precedent. " +
        "Open the Similar Cases panel and confirm the proposed disposition is consistent with the closest prior.",
      { gain: "Catches edge cases where the rules give a confident answer but the neighbor library disagrees.", effort: "10-15 min" }
    ));
  }

  // ----------- RULE 2: Physics-coverage gaps -----------
  for (var i = 0; i < checks.length; i++) {
    var ch = checks[i];
    if (!ch.required) continue;
    if (!ch.missing_inputs || ch.missing_inputs.length === 0) continue;

    // One action per missing input on each required check
    for (var m = 0; m < ch.missing_inputs.length; m++) {
      var miss = ch.missing_inputs[m];
      var owner = "inspector";
      var pri = "medium";
      var kind = "gather_data";

      // Tune owner + priority by what's missing
      if (/thickness_readings/i.test(miss)) {
        owner = "inspector"; pri = "high";
      } else if (/crack length/i.test(miss) || /crack depth/i.test(miss)) {
        owner = "level_ii_inspector"; pri = "high";
        kind = "rescan_with_sizing_technique";
      } else if (/fracture toughness/i.test(miss)) {
        owner = "materials_engineer"; pri = "medium";
      } else if (/operating stress/i.test(miss) || /load condition/i.test(miss)) {
        owner = "integrity_engineer"; pri = "medium";
      } else if (/cycle count/i.test(miss) || /stress range/i.test(miss) || /temperature history/i.test(miss) || /stress history/i.test(miss)) {
        owner = "ops_liaison"; pri = "medium";
        kind = "pull_operations_history";
      } else if (/SN curve/i.test(miss) || /creep rupture/i.test(miss) || /Larson-Miller/i.test(miss)) {
        owner = "materials_engineer"; pri = "medium";
      } else if (/nominal/i.test(miss)) {
        owner = "inspector"; pri = "high";
      }

      actions.push(mkAction(
        kind,
        pri,
        owner,
        "Gather: " + miss,
        "Required for the " + ch.check_id + " check (" + ch.code_ref +
          "). Without this input the check cannot run, so the case cannot be evaluated against the applicable code.",
        {
          gain: "Closes the " + ch.check_id + " coverage gap.",
          effort: kind === "rescan_with_sizing_technique" ? "1-3 hours field" :
                  kind === "pull_operations_history" ? "30 min from DCS / historian" :
                  "5-30 min",
          source: ch.check_id,
          references: [ch.code_ref]
        }
      ));
    }
  }

  // ----------- RULE 3: Thickness verdict-driven actions -----------
  if (thkSummary && thkSummary.verdict) {
    if (thkSummary.verdict === "reject") {
      actions.push(mkAction(
        "initiate_repair",
        "critical",
        "inspector",
        "Initiate repair work order per governing procedure",
        "Wall thickness reading of " + Number(thkSummary.min_in).toFixed(4) + " in is " +
          (thkSummary.pct_of_nominal != null ? "(" + Math.round(thkSummary.pct_of_nominal * 1000) / 10 + "% of nominal) " : "") +
          "below the API 510/570 reject threshold (50% of nominal). Component must be repaired or replaced before return to service. Document defect location, sketch, and inspector ID.",
        { gain: "Compliance with code; prevents in-service failure.", effort: "Variable; depends on repair scope.",
          references: ["API 510", "API 570"] }
      ));
    } else if (thkSummary.verdict === "ffs_review") {
      actions.push(mkAction(
        "run_ffs_assessment",
        "high",
        "integrity_engineer",
        "Run API 579 Level 1 FFS assessment on lowest CML group",
        "Wall thickness reading of " + Number(thkSummary.min_in).toFixed(4) + " in is " +
          (thkSummary.pct_of_nominal != null ? "(" + Math.round(thkSummary.pct_of_nominal * 1000) / 10 + "% of nominal) " : "") +
          "in the 50-80% band. Code requires a fitness-for-service assessment (Level 1 first; escalate to Level 2 or 3 if Level 1 fails). " +
          "Output (remaining strength factor, MAWP) feeds the disposition.",
        { gain: "Either justifies continued service or triggers reject.", effort: "1-3 hours engineer time",
          references: ["API 579-1 Part 5"] }
      ));
    }
  }

  // ----------- RULE 4: Critical findings without measurements -----------
  var CRITICAL_TYPES = ["crack", "incomplete_fusion", "incomplete_penetration", "lack_of_fusion"];
  for (var f = 0; f < findings.length; f++) {
    var fd = findings[f];
    var ft = (fd.finding_type || fd.label || "").toLowerCase();
    var isCrit = false;
    for (var ct = 0; ct < CRITICAL_TYPES.length; ct++) {
      if (ft.indexOf(CRITICAL_TYPES[ct]) >= 0) { isCrit = true; break; }
    }
    if (isCrit && (fd.confidence == null || Number(fd.confidence) >= 0.5)) {
      // Already handled in physics coverage if length/depth missing; this is the catch-all reminder.
      actions.push(mkAction(
        "size_critical_flaw",
        "critical",
        "level_ii_inspector",
        "Size and characterize " + ft,
        "A " + ft + " was identified by " + (fd.source || "AI extraction") +
          " at confidence " + (fd.confidence != null ? Math.round(Number(fd.confidence) * 100) + "%" : "n/a") +
          ". Critical-flaw types require precise sizing (length, depth, orientation) to support either rejection or a Part 9 FFS justification. " +
          "Re-scan with TOFD or PAUT and record dimensions before disposition.",
        { gain: "Converts a categorical finding into a quantified flaw the rules engine can adjudicate.",
          effort: "1-3 hours field",
          references: ["API 579 Part 9", "ASME Sec V Article 4"] }
      ));
    }
  }

  // ----------- RULE 5: Neighbor precedent conflict -----------
  if (neighbors.length >= 3 && authority.disposition) {
    var dispCounts = {};
    for (var n = 0; n < neighbors.length; n++) {
      var d = neighbors[n].disposition || "unknown";
      dispCounts[d] = (dispCounts[d] || 0) + 1;
    }
    var keys = Object.keys(dispCounts);
    var topNeighborDisp = null;
    var topNeighborCount = 0;
    for (var kk = 0; kk < keys.length; kk++) {
      if (dispCounts[keys[kk]] > topNeighborCount) {
        topNeighborCount = dispCounts[keys[kk]];
        topNeighborDisp = keys[kk];
      }
    }
    if (topNeighborDisp && topNeighborDisp !== authority.disposition && topNeighborCount >= Math.ceil(neighbors.length / 2)) {
      actions.push(mkAction(
        "resolve_precedent_conflict",
        "high",
        "integrity_engineer",
        "Reconcile disposition with neighbor precedent",
        "Authority disposition is '" + authority.disposition + "' but " + topNeighborCount +
          " of " + neighbors.length + " similar prior cases were dispositioned '" + topNeighborDisp +
          "'. Either document the case-specific factor that justifies departing from precedent, or re-evaluate.",
        { gain: "Catches subtle drift between rule outputs and historical practice; protects the case library from contradictory entries.",
          effort: "15-30 min review" }
      ));
    }
  }

  // ----------- RULE 6: Authority not yet locked but inputs are complete -----------
  var allCoverageClosed = true;
  for (var cc = 0; cc < checks.length; cc++) {
    if (checks[cc].required && checks[cc].missing_inputs && checks[cc].missing_inputs.length > 0) {
      allCoverageClosed = false; break;
    }
  }
  if (allCoverageClosed && !authority.locked && actions.length === 0) {
    actions.push(mkAction(
      "lock_authority",
      "medium",
      "inspector",
      "Lock the authority disposition",
      "All required physics checks have inputs. OOD flag is " + (ood.ood_flag || "unknown") +
        ". No outstanding gather, escalation, or precedent-conflict actions remain. Click Run Authority Lock to commit the disposition.",
      { gain: "Closes the case for downstream workflow (work orders, archival, regulator export).",
        effort: "1 click + 30 sec server" }
    ));
  }

  // -------- Sort + status --------
  actions.sort(priCmp);

  var status = "ready_to_lock";
  var hasEsc = false;
  var hasOpen = false;
  for (var aa = 0; aa < actions.length; aa++) {
    if (actions[aa].kind === "escalate_to_human") hasEsc = true;
    if (actions[aa].kind !== "lock_authority") hasOpen = true;
  }
  if (hasEsc) status = "escalate";
  else if (hasOpen) status = "actions_required";
  else if (actions.length === 0) status = "ready_to_lock";

  // -------- Summary narrative --------
  var summary;
  if (status === "escalate") {
    summary = "ESCALATE. Human-authority review required before this case can be locked. " +
      actions.length + " action" + (actions.length === 1 ? "" : "s") + " queued.";
  } else if (status === "actions_required") {
    summary = actions.length + " action" + (actions.length === 1 ? "" : "s") +
      " required before lock. Highest priority: " +
      actions[0].title + " (" + actions[0].owner_role.replace(/_/g, " ") + ").";
  } else {
    summary = "Ready to lock. All physics coverage closed, no escalation, no precedent conflict.";
  }

  return {
    planner_version: PLANNER_VERSION,
    generated_at: new Date().toISOString(),
    status: status,
    summary: summary,
    actions: actions,
    inputs_considered: {
      ood_flag: ood.ood_flag || null,
      physics_coverage_pct: physics.coverage_pct != null ? physics.coverage_pct : null,
      neighbor_count: neighbors.length,
      finding_count: findings.length,
      thickness_verdict: thkSummary ? thkSummary.verdict : null,
      authority_disposition: authority.disposition || null,
      authority_locked: !!authority.locked
    }
  };
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

    var caseRes = await sb.from("inspection_cases")
      .select("id, case_number, decision_bundle")
      .eq("id", caseId)
      .single();

    if (caseRes.error || !caseRes.data) {
      return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "case not found" }) };
    }

    var bundle = caseRes.data.decision_bundle;
    var actionPlan = plan(caseRes.data, bundle);
    var generatedAt = new Date().toISOString();

    var upd = await sb.from("inspection_cases").update({
      action_plan: actionPlan,
      action_plan_generated_at: generatedAt,
      action_plan_status: actionPlan.status
    }).eq("id", caseId);

    if (upd.error) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "persist failed", detail: upd.error.message }) };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        planner_version: PLANNER_VERSION,
        generated_at: generatedAt,
        status: actionPlan.status,
        action_count: actionPlan.actions.length,
        summary: actionPlan.summary,
        plan: actionPlan
      })
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
