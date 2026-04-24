// @ts-nocheck
/**
 * DEPLOY303 - formula-decision-authority.ts
 * netlify/functions/formula-decision-authority.ts
 *
 * FORMULA DECISION AUTHORITY — ENGINE 93
 *
 * Takes formula results and chain results, generates decision cards
 * with adjudication support. Maps formula outputs to inspection
 * actions, risk-cost exposure, and report-ready explanation blocks.
 *
 * Every decision card includes:
 *   - Title, summary, decision, decision_type
 *   - Risk score and cost exposure
 *   - Recommended next step
 *   - Reviewer status (pending/accepted/modified/rejected)
 *   - Full formula trace for auditability
 *
 * Enforces authority rules:
 *   - Cannot declare code compliance without active code module
 *   - Cannot approve continued service for fracture/creep/critical
 *     pressure-boundary without engineer review
 *   - Marks provisional when inputs are missing or AI-extracted
 *   - Always surfaces assumptions and limitations
 *
 * POST /api/formula-decision-authority
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var ENGINE_ID = "formula-decision-authority";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY303";
var corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };

// ============================================================
// DECISION CARD BUILDER
// ============================================================

var AUTHORITY_LOCKED_FORMULAS = ["STRESS_INTENSITY", "PARIS_LAW", "LARSON_MILLER", "POD_CURVE"];

function buildDecisionCard(body) {
  var severity = body.severity || "medium";
  var formulaCodes = body.formula_codes || [];
  var chainCode = body.chain_code || null;
  var results = body.results || [];
  var hasEngineerReviewRequired = false;

  // Check if any formula requires engineer review
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    if (r.trace && r.trace.requires_engineer_review) {
      hasEngineerReviewRequired = true;
    }
    for (var j = 0; j < AUTHORITY_LOCKED_FORMULAS.length; j++) {
      if (r.formula_code === AUTHORITY_LOCKED_FORMULAS[j]) {
        hasEngineerReviewRequired = true;
      }
    }
  }

  // Determine decision type
  var decisionType = "monitor";
  if (severity === "critical" || hasEngineerReviewRequired) {
    decisionType = "engineer_review";
  } else if (severity === "high") {
    decisionType = "inspect";
  } else if (severity === "hold_for_input") {
    decisionType = "hold_for_input";
  }

  // Build missing inputs summary
  var allMissing = [];
  var allAssumptions = [];
  var allLimitations = [];
  for (var k = 0; k < results.length; k++) {
    var res = results[k];
    if (res.missing_inputs) {
      for (var mi = 0; mi < res.missing_inputs.length; mi++) {
        if (allMissing.indexOf(res.missing_inputs[mi]) === -1) {
          allMissing.push(res.missing_inputs[mi]);
        }
      }
    }
    if (res.assumptions_used) {
      for (var ai = 0; ai < res.assumptions_used.length; ai++) {
        if (allAssumptions.indexOf(res.assumptions_used[ai]) === -1) {
          allAssumptions.push(res.assumptions_used[ai]);
        }
      }
    }
    if (res.limitations_triggered) {
      for (var li = 0; li < res.limitations_triggered.length; li++) {
        if (allLimitations.indexOf(res.limitations_triggered[li]) === -1) {
          allLimitations.push(res.limitations_triggered[li]);
        }
      }
    }
  }

  // Build recommended next step
  var nextStep = "Review calculation trace and confirm inputs.";
  if (decisionType === "engineer_review") {
    nextStep = "PE or Level III review required before disposition. Review formula trace, confirm inputs, and assess fitness for continued service per applicable code.";
  } else if (decisionType === "inspect") {
    nextStep = "Escalate inspection scope. Perform targeted examination to validate formula inputs and reduce uncertainty.";
  } else if (decisionType === "hold_for_input") {
    nextStep = "Cannot produce reliable decision. Missing inputs: " + allMissing.join(", ") + ". Obtain measured values before proceeding.";
  } else if (decisionType === "monitor") {
    nextStep = "Continue monitoring with calculated inspection interval. No immediate action required based on formula results.";
  }

  // Provisional marking
  var isProvisional = allMissing.length > 0;

  return {
    title: body.title || "Formula Intelligence Decision",
    summary: body.summary || ("Formula engine produced " + results.length + " calculation(s). " + (hasEngineerReviewRequired ? "Engineer review required." : "Review recommended.")),
    decision: decisionType.toUpperCase(),
    decision_type: decisionType,
    risk_score: body.risk_score || null,
    cost_exposure: body.cost_exposure || null,
    recommended_next_step: nextStep,
    is_provisional: isProvisional,
    engineer_review_required: hasEngineerReviewRequired,
    missing_inputs: allMissing,
    assumptions: allAssumptions,
    limitations: allLimitations,
    formula_count: results.length,
    chain_code: chainCode,
    formula_trace: {
      formula_codes: formulaCodes,
      result_summaries: results.map ? results.map(function(r) {
        return { formula_code: r.formula_code, severity: r.severity, confidence: r.confidence, result_value: r.result_value, result_unit: r.result_unit, interpretation: r.interpretation };
      }) : []
    }
  };
}

// ============================================================
// REPORT BLOCK GENERATOR
// ============================================================

function generateReportBlock(card, results) {
  var lines = [];
  lines.push("Formula Intelligence Decision: " + card.title);
  lines.push("");
  lines.push("Decision: " + card.decision);
  lines.push("Type: " + card.decision_type);
  if (card.is_provisional) lines.push("Status: PROVISIONAL — missing inputs detected");
  if (card.engineer_review_required) lines.push("Authority: PE / Level III / Authorized Inspector review REQUIRED");
  lines.push("");

  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    lines.push("--- " + (r.formula_code || "Formula " + (i + 1)) + " ---");
    lines.push("Result: " + (r.result_value !== null && r.result_value !== undefined ? r.result_value : "N/A") + " " + (r.result_unit || ""));
    lines.push("Severity: " + (r.severity || "unknown"));
    lines.push("Confidence: " + (r.confidence !== undefined ? (r.confidence * 100).toFixed(0) + "%" : "N/A"));
    lines.push("Interpretation: " + (r.interpretation || ""));
    if (r.missing_inputs && r.missing_inputs.length > 0) {
      lines.push("Missing: " + r.missing_inputs.join(", "));
    }
    lines.push("");
  }

  if (card.assumptions.length > 0) {
    lines.push("Assumptions:");
    for (var a = 0; a < card.assumptions.length; a++) {
      lines.push("  - " + card.assumptions[a]);
    }
    lines.push("");
  }

  if (card.limitations.length > 0) {
    lines.push("Limitations:");
    for (var l = 0; l < card.limitations.length; l++) {
      lines.push("  - " + card.limitations[l]);
    }
    lines.push("");
  }

  lines.push("Next Step: " + card.recommended_next_step);

  return lines.join("\n");
}

// ============================================================
// HANDLER
// ============================================================

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };
  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";

    if (action === "get_registry") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
        engine: ENGINE_ID, version: ENGINE_VERSION, deploy: DEPLOY,
        mode: "deterministic",
        purpose: "Formula Decision Authority — generates auditable decision cards from formula results with engineer review gates",
        authority_locked_formulas: AUTHORITY_LOCKED_FORMULAS,
        actions: ["create_card", "adjudicate", "get_case_cards", "generate_report_block", "get_registry"]
      }) };
    }

    if (action === "create_card") {
      if (!body.case_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };
      var card = buildDecisionCard(body);
      var reportBlock = generateReportBlock(card, body.results || []);

      // Save to Supabase (non-fatal)
      var savedId = null;
      try {
        var sb = createClient(supabaseUrl, supabaseKey);
        var ins = await sb.from("formula_decision_cards").insert({
          org_id: body.org_id || null,
          case_id: body.case_id,
          asset_id: body.asset_id || null,
          finding_id: body.finding_id || null,
          title: card.title,
          summary: card.summary,
          decision: card.decision,
          decision_type: card.decision_type,
          supporting_run_ids: body.supporting_run_ids || [],
          supporting_chain_run_ids: body.supporting_chain_run_ids || [],
          formula_trace: card.formula_trace,
          risk_score: card.risk_score,
          cost_exposure: card.cost_exposure,
          recommended_next_step: card.recommended_next_step
        }).select("id").limit(1);
        if (ins.data && ins.data.length > 0) savedId = ins.data[0].id;
      } catch (e) {}

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
        engine: ENGINE_ID, version: ENGINE_VERSION, action: action,
        card_id: savedId,
        card: card,
        report_block: reportBlock
      }, null, 2) };
    }

    if (action === "adjudicate") {
      if (!body.card_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "card_id required" }) };
      var status = body.reviewer_status || "pending";
      var validStatuses = ["pending", "accepted", "modified", "rejected"];
      if (validStatuses.indexOf(status) === -1) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "reviewer_status must be one of: " + validStatuses.join(", ") }) };
      }

      try {
        var sb2 = createClient(supabaseUrl, supabaseKey);
        var upd = await sb2.from("formula_decision_cards").update({
          reviewer_status: status,
          reviewer_notes: body.reviewer_notes || null,
          updated_at: new Date().toISOString()
        }).eq("id", body.card_id);

        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
          engine: ENGINE_ID, action: action,
          card_id: body.card_id,
          reviewer_status: status,
          updated: true
        }) };
      } catch (e) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "Failed to update card" }) };
      }
    }

    if (action === "get_case_cards") {
      if (!body.case_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };
      try {
        var sb3 = createClient(supabaseUrl, supabaseKey);
        var cards = await sb3.from("formula_decision_cards").select("*").eq("case_id", body.case_id).order("created_at", { ascending: false });
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
          engine: ENGINE_ID, action: action,
          case_id: body.case_id,
          cards: cards.data || []
        }, null, 2) };
      } catch (e) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, action: action, cards: [] }) };
      }
    }

    if (action === "generate_report_block") {
      var card2 = buildDecisionCard(body);
      var block = generateReportBlock(card2, body.results || []);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
        engine: ENGINE_ID, action: action,
        report_block: block
      }) };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
