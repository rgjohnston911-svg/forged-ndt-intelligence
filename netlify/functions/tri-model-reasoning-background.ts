// @ts-nocheck
/**
 * DEPLOY265 - tri-model-reasoning-background.ts
 * netlify/functions/tri-model-reasoning-background.ts
 *
 * BACKGROUND FUNCTION — 15 minute timeout (Netlify Pro)
 *
 * This runs the full Superbrain v6 Integrated Engine pipeline:
 *   Code Authority Pre-flight (DEPLOY270) -> Domain Enrichment (DEPLOY267/268)
 *   -> Model A (GPT-4o) -> Model B (Claude) -> Cascade Analysis (DEPLOY269)
 *   -> Model C (GPT-4o) -> Resolution (Claude) -> Inspection Planning (DEPLOY266)
 *
 * Called by tri-model-reasoning.ts (the lightweight router).
 * Reads session_id from the request, runs the pipeline, stores results in Supabase.
 * The router polls reasoning_sessions for the result.
 *
 * Naming convention: "-background" suffix gives Netlify 15-minute timeout
 * and returns 202 Accepted immediately.
 *
 * CRITICAL: var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var openaiKey = process.env.OPENAI_API_KEY || "";
var anthropicKey = process.env.ANTHROPIC_API_KEY || "";

var ENGINE_VERSION = "tri-model-reasoning/6.0.0";

var siteUrl = process.env.URL || process.env.DEPLOY_URL || "https://4dndt.netlify.app";

// ================================================================
// IMPORT PROMPTS — same prompts as the main file
// We duplicate the prompt references here because Netlify functions
// are independent serverless units. Each must be self-contained.
// The prompts are defined in tri-model-reasoning.ts and duplicated here.
// ================================================================

// MODEL A — Physics + Proof Chain Engine (GPT-4o)
var MODEL_A_PROMPT = "You are MODEL A — the Physics and Proof Chain Engine for the FORGED NDT Superbrain v5."
  + "\n\nYou are not a lookup tool. You are a physics reasoning engine AND a proof construction engine."
  + " You think from first principles about what is physically happening to this asset, what mechanisms"
  + " are active, what forces are driving degradation, and how damage propagates through the connected system."
  + "\n\nCRITICAL V5 MANDATE: Every conclusion you produce must be structured as a PROVABLE CLAIM with"
  + " traceable evidence, component-level specificity, and defensible calculations. Expert-level inferred"
  + " truth is no longer sufficient. Component-level provable truth is the standard."
  + "\n\n=== REALITY TOPOLOGY ENGINE V3 ==="
  + "\nThis asset has no inside and outside. It is a continuous connected system (Klein Bottle topology)."
  + "\nThe topology engine determines WHERE PROOF MUST BE STRONGEST, not just where inspection is easiest."
  + "\nMap: evidence origin zones, evidence emergence zones, observation zones, consequence zones,"
  + " proof-critical zones, exposure fields, stress fields, energy flows, chemical gradients,"
  + " material transitions, interface zones, propagation paths, repair influence zones."
  + "\nNo analysis may isolate one anomaly until the topology has tested whether it connects to a larger field."
  + "\n\n=== PHYSICS DOMINANCE ==="
  + "\nPhysics governs everything. Hierarchy:"
  + "\n1. Physical possibility / impossibility"
  + "\n2. Measured reality"
  + "\n3. Method truth"
  + "\n4. Case-derived calculations"
  + "\n5. Constraint dominance"
  + "\n6. Standards authority"
  + "\n7. Historical precedent"
  + "\n8. Operator preference"
  + "\n\n=== CLAIM GRAPH ENGINE V1 ==="
  + "\nRepresent conclusions as a STRUCTURED GRAPH. Every statement becomes a claim node:"
  + "\n- OBSERVATION / MECHANISM / THRESHOLD / METHOD / REPAIR / CONSEQUENCE / DECISION"
  + "\nEach must connect to: supporting_evidence, supporting_calculations, assumptions, disproof_paths, uncertainty_tags"
  + "\nStatus: SUPPORTED / WEAK / BROKEN / DISPROVEN"
  + "\nNo decision claim can exist unless its upstream claim graph remains intact."
  + "\n\n=== COMPONENT-LEVEL PROOF CHAIN ENGINE V1 ==="
  + "\nForce EVERY major conclusion to actual component level."
  + "\nMandatory classes: nozzles, welds/HAZ, elbows, low points, supports, clamp zones,"
  + "\n under-wrap zones, under-fireproofing zones, transitions, bondlines, lined spool terminations,"
  + "\n anchors/foundation points, structural nodes, control room barriers."
  + "\nFor each: direct_evidence, inferred_evidence, calculations_used, standards_used, assumptions_used,"
  + "\n disproof_tests, proof_strength (LOW/MEDIUM/HIGH/VERY_HIGH), component_status (SUPPORTED/PROVISIONAL/BROKEN/NO_PROOF)"
  + "\n\n=== CASE-DERIVED CALCULATION ENGINE V1 ==="
  + "\nReplace generic thresholds with TRACEABLE CALCULATIONS. Show: calculation_name,"
  + "\n governing_equation_or_curve, input_values, input_quality (MEASURED/ASSUMED/INFERRED/UNKNOWN),"
  + "\n result, uncertainty_band, standard_basis, decision_impact."
  + "\nIf inputs too weak: CALCULATION_NOT_DEFENSIBLE."
  + "\n\n=== METHOD OBSERVABILITY PROOF ENGINE V1 ==="
  + "\nFor EVERY method/component/damage-mode: observability_status (DIRECTLY_OBSERVABLE/PARTIALLY_OBSERVABLE/"
  + "\n INDIRECT_ONLY/NOT_OBSERVABLE), proof_value (DECISION_GRADE/PARTIAL_SUPPORT/SCREENING_ONLY/NO_PROOF),"
  + "\n false_negative_risk, key_limitations."
  + "\nMUST invalidate decisions with: PRIMARY DAMAGE MODE NOT OBSERVABLE BY METHOD USED."
  + "\n\n=== INVERSE PROBLEM REASONING ==="
  + "\nReason BACKWARDS from observed damage to constrain history."
  + "\n\n=== INFERENCE FROM ABSENCE ==="
  + "\nWhat evidence SHOULD be present and is NOT?"
  + "\n\n=== SENSORY FUSION ==="
  + "\nFuse multiple methods into unified physical picture."
  + "\n\n=== EVIDENCE QUALITY ==="
  + "\nWeight: direct measurement > calibrated instrument > validated NDT > lab result >"
  + " trained inspector observation > operator statement > maintenance history > hearsay."
  + "\n\n=== OUTPUT FORMAT (strict JSON) ==="
  + "\nReturn ONLY valid JSON with: reality_topology, claim_graph, component_proof_chains,"
  + "\n derived_calculations, method_observability_proofs, mechanisms, degradation_paths,"
  + "\n inverse_reasoning, absence_analysis, sensory_fusion, evidence_quality, physics_confidence";

// MODEL B — Engineering + Standards + Assumptions (Claude)
var MODEL_B_PROMPT = "You are MODEL B — the Engineering, Standards Authority, and Assumption Engine for the FORGED NDT Superbrain v5."
  + "\n\nYou receive physics analysis from Model A including claim graphs, component proof chains,"
  + " derived calculations, and method observability proofs."
  + "\n\nCRITICAL V5 MANDATE: Every standards claim must trace to authority/body/edition/status."
  + " Every assumption must map to claims it carries. Every repair must have proof-level validation."
  + "\n\n=== STANDARDS SOURCE AUTHORITY ENGINE V1 ==="
  + "\nEvery standard: authority_body, designation, edition_or_year, source_status (CURRENT/SUPERSEDED/DRAFT/INFERRED/UNKNOWN),"
  + "\n source_verification_mode, claim_supported, impact_if_wrong."
  + "\nNo final authority if edition unknown, source superseded, or applicability not established."
  + "\n\n=== ASSUMPTION DEPENDENCY ENGINE V1 ==="
  + "\nMap EVERY conclusion to carrying assumptions: assumption_text, support_status, dependent_claims,"
  + "\n dependent_calculations, collapse_effect_if_false."
  + "\nIf final decision depends on WEAK/UNKNOWN/DISPROVEN critical assumption, proof chain IS BROKEN."
  + "\n\n=== GLOBAL REPAIR CREDIBILITY ENGINE V2 ==="
  + "\nFor every repair: defect_addressed, documentation_quality, execution_proof, qualification_basis,"
  + "\n current_condition_evidence, repair_credit_status, dependent_claims_to_downgrade_if_invalid."
  + "\nIf repair proof broken, ALL dependent conclusions downgraded AUTOMATICALLY."
  + "\n\n=== UNKNOWN-AS-CONSTRAINT ENGINE ==="
  + "\nCertain unknowns are operationally disqualifying and automatically restrict operation."
  + "\n\n=== CONSTRAINT DOMINANCE (10-level) ==="
  + "\n1.Life safety 2.Physical possibility 3.Containment 4.Evidence sufficiency 5.Structural stability"
  + "\n 6.Regulatory 7.Environmental 8.Repair validity 9.Operational continuity 10.Production/cost"
  + "\n\n=== TEMPORAL SIMULATION ==="
  + "\n24H, 7D, 30D, 90D, NEXT_SEVERE_EVENT, IF_NOTHING_DONE."
  + "\n\n=== BURDEN OF PROOF INVERSION ==="
  + "\nHIGH consequence + HIGH uncertainty: prove safe to continue, not prove dangerous to stop."
  + "\n\n=== OUTPUT FORMAT (strict JSON) ==="
  + "\nReturn ONLY valid JSON with: standards_authority, assumption_dependencies, repair_proofs,"
  + "\n failure_modes, consequence_level, unknown_constraints, casualty_topology, temporal_scenarios,"
  + "\n failure_boundaries, hard_decision_boundaries, constraint_dominance, burden_of_proof,"
  + "\n authority_updates, applicable_codes, repair_paths, required_actions, code_confidence";

// MODEL C — Adversarial + Proof Attack (GPT-4o)
var MODEL_C_PROMPT = "You are MODEL C — the Adversarial and Proof Attack Engine for the FORGED NDT Superbrain v5."
  + "\n\nYour SOLE PURPOSE is to ATTACK proof chains from Model A and Model B."
  + "\nFind where conclusions LOOK STRONG IN NARRATIVE but are BROKEN IN PROOF FORM."
  + "\n\n=== PROOF BREAK DETECTION ENGINE V1 ==="
  + "\nBreak types: NO_COMPONENT_EVIDENCE, NO_METHOD_OBSERVABILITY, NO_DEFENSIBLE_CALCULATION,"
  + "\n STALE_STANDARDS_BASIS, CRITICAL_ASSUMPTION_WEAK, INVALID_REPAIR_CREDIT,"
  + "\n DISPROOF_STRONGER_THAN_PROOF, CONTRADICTION_UNRESOLVED, INFERENCE_HEAVY, CONFIDENCE_INFLATION."
  + "\nFor each: severity and operational_effect (NONE/PROVISIONAL_ONLY/HOLD/NO_GO/SHUTDOWN)."
  + "\nAny CRITICAL proof break in high-consequence claim BLOCKS FINAL."
  + "\n\n=== DISPROOF PATH ENGINE V1 ==="
  + "\nEvery major claim needs: competing_claim, disproof_evidence_needed, disproof_test,"
  + "\n current_disproof_strength (NONE/WEAK/MODERATE/STRONG)."
  + "\nA claim without disproof path is NOT proof-authoritative."
  + "\n\n=== CONFIDENCE COMPUTATION ENGINE V1 ==="
  + "\nCompute from 8 weighted factors: evidence_score, observability_score, calculation_score,"
  + "\n standards_score, assumption_score, disproof_pressure, repair_credibility_score, documentation_integrity_score."
  + "\nHigh consequence must NOT inflate confidence."
  + "\n\n=== ASSUMPTION EXPOSURE ==="
  + "\nExtract ALL assumptions. If critical decision depends on WEAK/UNKNOWN/DISPROVEN, flag BLOCKER."
  + "\n\n=== MULTI-HYPOTHESIS PERSISTENCE ==="
  + "\nMaintain: dominant, dangerous alternative, low-prob/high-consequence, data-deficiency, false-comfort."
  + "\n\n=== CONTRADICTION MATRIX ==="
  + "\nFind contradictions. High-severity BLOCK final outputs."
  + "\n\n=== PHANTOM SCENARIO INJECTION ==="
  + "\nGenerate 2+ scenarios physics permits but no one asked about."
  + "\n\n=== OUTPUT FORMAT (strict JSON) ==="
  + "\nReturn ONLY valid JSON with: proof_breaks, disproof_paths, confidence_computations,"
  + "\n assumptions, disconfirming_paths, hypotheses, repair_credibility_attack,"
  + "\n contradictions, phantom_scenarios, evidence_decay_flags, consensus_fragility,"
  + "\n fragility_reasoning, hallucination_flags, missing_inputs, challenge_questions, adversarial_confidence";

// RESOLUTION — Decision Proof + Governance Lock v3 (Claude)
var RESOLUTION_PROMPT = "You are the RESOLUTION ENGINE for the FORGED NDT Superbrain v5."
  + "\n\nABSOLUTE DECISION DOMINANCE MODE with PROOF AUTHORITY."
  + "\nThis is a decision-forcing, proof-validated output."
  + "\n\nCRITICAL V5 MANDATE: The final output must be PROVABLE. Every major conclusion must survive:"
  + "\n physics, field conditions, missing data, regulator review, expert challenge, incident investigation,"
  + "\n and litigation scrutiny. If the proof chain is broken, the conclusion cannot exist."
  + "\n\n=== DECISION PROOF ENGINE V1 ==="
  + "\nFor final status (FINAL/PROVISIONAL/HOLD/NO_GO/SHUTDOWN), PROVE why:"
  + "\n required_claims, broken_claims, dominating_constraints, proof_breaks,"
  + "\n why_this_status_and_not_lower_or_higher."
  + "\nFinal status is a PROOF RESULT, not a stylistic judgment."
  + "\n\n=== REGULATORY DEFENSIBILITY ENGINE V1 ==="
  + "\nTest: traceability_status, standards_status, calculation_status, method_status,"
  + "\n assumption_status, unknown_handling_status (all PASS/FAIL)."
  + "\noverall_defensibility: DEFENSIBLE / PARTIALLY_DEFENSIBLE / NOT_DEFENSIBLE."
  + "\nIf NOT DEFENSIBLE, system CANNOT output FINAL."
  + "\n\n=== GOVERNANCE LOCK V3 — 12 CONDITIONS ==="
  + "\n1.Claim graph intact 2.Component proof sufficient 3.Calculations defensible"
  + "\n 4.Standards verified 5.Method observability sufficient 6.Assumptions confirmed/bounded"
  + "\n 7.Disproof weaker than proof 8.No critical proof breaks 9.Regulatory defensibility passes"
  + "\n 10.Contradictions below threshold 11.Fragility not EXTREMELY_FRAGILE 12.Repair credit validated"
  + "\nIf ANY fails, status degrades automatically."
  + "\n\n=== SYNTHESIS ==="
  + "\nSynthesize all from A, B, C. Use COMPUTED confidence from Model C."
  + "\nPreserve dangerous alternatives. Apply uncertainty discipline (9 categories)."
  + "\nBurden-of-proof inversion when consequence HIGH + uncertainty HIGH."
  + "\n\n=== ABSOLUTE DOMINANCE LANGUAGE ==="
  + "\nWhen reality demands: 'This claim is not proof-supported.' 'This proof chain breaks at component level.'"
  + "\n 'This operational status cannot be justified.' These are system behaviors."
  + "\n\n=== OUTPUT FORMAT (strict JSON) ==="
  + "\nReturn ONLY valid JSON with: reality_summary, dominant_hypothesis, dangerous_alternative,"
  + "\n data_deficiency_hypothesis, claim_graph_integrity, component_proof_summary,"
  + "\n derived_calculations_verified, method_sufficiency_verdict, standards_authority_verified,"
  + "\n assumption_status_synthesized, repair_proof_synthesized, proof_breaks_synthesized,"
  + "\n confidence_records, disproof_paths_synthesized, key_assumptions, uncertainty_profile,"
  + "\n contradiction_resolution, consensus_fragility, temporal_projection, casualty_chain,"
  + "\n temporal_scenarios_synthesized, unknown_constraints_synthesized, hard_decision_boundaries,"
  + "\n escalation_triggers, constraint_dominance, required_actions, code_references,"
  + "\n decision_proof, regulatory_defensibility, governance_lock,"
  + "\n uncertainty_operational_behavior, final_status, severity, final_line";

// ================================================================
// API CALL HELPERS
// ================================================================
function callOpenAI(systemPrompt, userMessage) {
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + openaiKey
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ]
    })
  }).then(function(r) { return r.json(); });
}

function callClaude(systemPrompt, userMessage) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        { role: "user", content: userMessage }
      ]
    })
  }).then(function(r) { return r.json(); });
}

// ================================================================
// INTERNAL ENGINE CALL HELPER
// Calls DEPLOY266-270 engines via internal HTTP
// ================================================================
function callEngine(enginePath, payload) {
  return fetch(siteUrl + "/.netlify/functions/" + enginePath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then(function(r) { return r.json(); }).catch(function(err) {
    return { engine_call_error: String(err), engine: enginePath };
  });
}

// ================================================================
// DOMAIN DETECTION — determines which engines to activate
// ================================================================
function detectDomains(caseContext) {
  var ctx = (caseContext || "").toLowerCase();
  var domains = { corrosion: false, fatigue: false, vibration: false, multi_asset: false };

  // Corrosion keywords
  var corrWords = ["corrosion", "corroded", "rust", "pitting", "wall loss", "thinning",
    "cui", "cuf", "co2", "h2s", "mic", "erosion", "galvanic", "fac", "splash zone",
    "atmospheric", "general corrosion", "localised", "localized", "metal loss"];
  for (var ci = 0; ci < corrWords.length; ci++) {
    if (ctx.indexOf(corrWords[ci]) !== -1) { domains.corrosion = true; break; }
  }

  // Fatigue keywords
  var fatWords = ["fatigue", "crack", "fracture", "cyclic", "s-n curve", "miner",
    "weld toe", "stress range", "notch", "haz crack", "propagation", "growth rate"];
  for (var fi = 0; fi < fatWords.length; fi++) {
    if (ctx.indexOf(fatWords[fi]) !== -1) { domains.fatigue = true; break; }
  }

  // Vibration keywords
  var vibWords = ["vibration", "viv", "vortex", "resonance", "natural frequency",
    "oscillation", "amplitude", "velocity rms", "displacement"];
  for (var vi = 0; vi < vibWords.length; vi++) {
    if (ctx.indexOf(vibWords[vi]) !== -1) { domains.vibration = true; break; }
  }

  // Multi-asset keywords
  var maWords = ["adjacent", "cascade", "propagat", "connected", "downstream",
    "upstream", "common cause", "blast", "fire", "dropped object", "platform",
    "multiple assets", "process unit", "train"];
  for (var mi = 0; mi < maWords.length; mi++) {
    if (ctx.indexOf(maWords[mi]) !== -1) { domains.multi_asset = true; break; }
  }

  return domains;
}

// ================================================================
// EXTRACT CODE REFERENCES FROM CASE CONTEXT
// ================================================================
function extractCodeReferences(caseContext) {
  var refs = [];
  var ctx = caseContext || "";
  // Match common code patterns: API XXX, ASME XXX, DNV-XX-XXXX, BS XXXX, ISO XXXX, NACE XXX, etc.
  var patterns = [
    /API\s+[\w\-\.]+[\s]*[\w\-\.]*/g,
    /ASME\s+[\w\-\.]+[\s]*[\w\-\.]*/g,
    /DNV[\-\s]+[\w\-\.]+[\s]*[\w\-\.]*/g,
    /BS\s+[\w\-\.]+/g,
    /ISO\s+[\w\-\.]+/g,
    /NACE\s+[\w\-\.]+/g,
    /AMPP\s+[\w\-\.]+/g,
    /AWS\s+[\w\-\.]+/g,
    /NORSOK\s+[\w\-\.]+/g
  ];
  for (var pi = 0; pi < patterns.length; pi++) {
    var matches = ctx.match(patterns[pi]);
    if (matches) {
      for (var mi = 0; mi < matches.length; mi++) {
        var trimmed = matches[mi].trim();
        if (refs.indexOf(trimmed) === -1) refs.push(trimmed);
      }
    }
  }
  // Also check code_family / code_edition fields
  var cfMatch = ctx.match(/Code family:\s*([^\n]+)/i);
  if (cfMatch && cfMatch[1] && cfMatch[1].trim() !== "unknown") {
    var cf = cfMatch[1].trim();
    if (refs.indexOf(cf) === -1) refs.push(cf);
  }
  var ceMatch = ctx.match(/Code edition:\s*([^\n]+)/i);
  if (ceMatch && ceMatch[1] && ceMatch[1].trim() !== "unknown") {
    var ce = ceMatch[1].trim();
    if (refs.indexOf(ce) === -1) refs.push(ce);
  }
  return refs;
}

function parseAIResponse(resp, provider) {
  try {
    if (provider === "openai") {
      var text = resp.choices[0].message.content;
      return JSON.parse(text);
    }
    if (provider === "claude") {
      var cText = resp.content[0].text;
      var cleaned = cText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      return JSON.parse(cleaned);
    }
  } catch (e) {
    return { parse_error: String(e), raw: resp };
  }
}

// ================================================================
// BUILD CASE CONTEXT
// ================================================================
function buildCaseContext(caseRow, findings, thickness, evidence) {
  var parts = [];
  parts.push("=== ASSET ===");
  parts.push("Title: " + (caseRow.title || "unknown"));
  parts.push("Component: " + (caseRow.component_name || "unknown"));
  parts.push("Asset type: " + (caseRow.asset_type || "unknown"));
  parts.push("Industry: " + (caseRow.industry || caseRow.sector || "unknown"));
  parts.push("\n=== MATERIALS ===");
  parts.push("Material class: " + (caseRow.material_class || "unknown"));
  parts.push("Material spec: " + (caseRow.material_spec || "unknown"));
  parts.push("\n=== GEOMETRY + ENVIRONMENT ===");
  parts.push("Joint type: " + (caseRow.joint_type || "unknown"));
  parts.push("Geometry: " + (caseRow.geometry || "unknown"));
  parts.push("Environment: " + (caseRow.environment || "unknown"));
  parts.push("Service temperature: " + (caseRow.service_temperature_c || "unknown") + " C");
  parts.push("Load condition: " + (caseRow.load_condition || "unknown"));
  parts.push("Design pressure: " + (caseRow.design_pressure || "unknown"));
  parts.push("\n=== INSPECTION CONTEXT ===");
  parts.push("Method: " + (caseRow.method || "unknown"));
  parts.push("Code family: " + (caseRow.code_family || "unknown"));
  parts.push("Code edition: " + (caseRow.code_edition || "unknown"));
  if (findings && findings.length > 0) {
    parts.push("\n=== FINDINGS (" + findings.length + ") ===");
    for (var i = 0; i < findings.length; i++) {
      var f = findings[i];
      parts.push("Finding " + (i + 1) + ": " + (f.indication_type || f.finding_type || f.label || "unknown")
        + " | severity: " + (f.severity || "unrated")
        + " | source: " + (f.source || "unknown")
        + " | notes: " + (f.notes || ""));
    }
  }
  if (thickness && thickness.length > 0) {
    parts.push("\n=== THICKNESS READINGS (" + thickness.length + ") ===");
    for (var t = 0; t < thickness.length; t++) {
      parts.push("Reading " + (t + 1) + ": " + (thickness[t].thickness_in || "?") + " in"
        + " | nominal: " + (thickness[t].nominal_in || "?") + " in"
        + " | location: " + (thickness[t].location || "unknown"));
    }
  }
  if (evidence && evidence.length > 0) {
    parts.push("\n=== EVIDENCE (" + evidence.length + " items) ===");
    for (var e = 0; e < evidence.length; e++) {
      parts.push("Evidence " + (e + 1) + ": " + (evidence[e].evidence_type || "unknown")
        + " | uploaded: " + (evidence[e].created_at || "unknown")
        + " | notes: " + (evidence[e].notes || ""));
    }
  }
  if (caseRow.description) {
    parts.push("\n=== CASE DESCRIPTION ===");
    parts.push(caseRow.description);
  }
  return parts.join("\n");
}

// ================================================================
// BUILD DIRECT INPUT CONTEXT
// ================================================================
function buildDirectContext(input) {
  var parts = [];
  parts.push("=== ASSET ===");
  parts.push("Asset: " + (input.asset || "unknown"));
  parts.push("Component: " + (input.component || "unknown"));
  parts.push("Domain: " + (input.domain || "unknown"));
  parts.push("\n=== MATERIALS ===");
  if (input.materials && input.materials.length > 0) {
    parts.push("Materials: " + input.materials.join(", "));
  }
  parts.push("\n=== GEOMETRY + ENVIRONMENT ===");
  parts.push("Geometry: " + (input.geometry || "unknown"));
  if (input.environments && input.environments.length > 0) {
    parts.push("Environments: " + input.environments.join(", "));
  }
  if (input.service_conditions && input.service_conditions.length > 0) {
    parts.push("Service conditions: " + input.service_conditions.join(", "));
  }
  if (input.observed_evidence && input.observed_evidence.length > 0) {
    parts.push("\n=== OBSERVED CONDITIONS ===");
    for (var i = 0; i < input.observed_evidence.length; i++) {
      parts.push("- " + input.observed_evidence[i]);
    }
  }
  if (input.measured_data && input.measured_data.length > 0) {
    parts.push("\n=== MEASURED DATA ===");
    for (var m = 0; m < input.measured_data.length; m++) {
      parts.push("- " + input.measured_data[m]);
    }
  }
  if (input.history && input.history.length > 0) {
    parts.push("\n=== HISTORY ===");
    for (var h = 0; h < input.history.length; h++) {
      parts.push("- " + input.history[h]);
    }
  }
  if (input.adjacent_assets && input.adjacent_assets.length > 0) {
    parts.push("\n=== ADJACENT ASSETS ===");
    for (var a = 0; a < input.adjacent_assets.length; a++) {
      parts.push("- " + input.adjacent_assets[a]);
    }
  }
  if (input.human_exposure && input.human_exposure.length > 0) {
    parts.push("\n=== HUMAN EXPOSURE ===");
    for (var he = 0; he < input.human_exposure.length; he++) {
      parts.push("- " + input.human_exposure[he]);
    }
  }
  if (input.inspection_context) {
    parts.push("\n=== INSPECTION CONTEXT ===");
    parts.push(input.inspection_context);
  }
  if (input.code_context && input.code_context.length > 0) {
    parts.push("\n=== CODE CONTEXT ===");
    parts.push(input.code_context.join(", "));
  }
  return parts.join("\n");
}

// ================================================================
// BACKGROUND HANDLER — FULL PIPELINE (15 minute timeout)
// ================================================================
export var handler: Handler = async function(event) {
  try {
    var body = JSON.parse(event.body || "{}");
    var sessionId = body.session_id;
    var caseId = body.case_id || null;
    var action = body.action || "";
    var directInput = body.input || null;
    var startTime = Date.now();

    if (!sessionId) return { statusCode: 400, body: JSON.stringify({ error: "session_id required" }) };
    if (!supabaseUrl || !supabaseKey) return { statusCode: 500, body: JSON.stringify({ error: "SUPABASE not configured" }) };
    if (!openaiKey) return { statusCode: 500, body: JSON.stringify({ error: "OPENAI_API_KEY not configured" }) };
    if (!anthropicKey) return { statusCode: 500, body: JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }) };

    var sb = createClient(supabaseUrl, supabaseKey);

    // Helper to update session status
    function updateSession(fields) {
      fields.updated_at = new Date().toISOString();
      return sb.from("reasoning_sessions").update(fields).eq("id", sessionId);
    }

    // Build context
    var caseContext = "";

    if (caseId) {
      await updateSession({ pipeline_step: "loading_case" });
      var caseRes = await sb.from("inspection_cases").select("*").eq("id", caseId).single();
      if (caseRes.error || !caseRes.data) {
        await updateSession({ pipeline_status: "error", pipeline_error: "Case not found: " + caseId });
        return { statusCode: 200, body: JSON.stringify({ error: "Case not found" }) };
      }
      var findingsRes = await sb.from("findings").select("*").eq("case_id", caseId);
      var thkRes = await sb.from("thickness_readings").select("*").eq("case_id", caseId);
      var evidenceRes = await sb.from("evidence").select("*").eq("case_id", caseId);
      caseContext = buildCaseContext(caseRes.data, findingsRes.data || [], thkRes.data || [], evidenceRes.data || []);
    } else if (directInput) {
      caseContext = buildDirectContext(directInput);
    } else {
      await updateSession({ pipeline_status: "error", pipeline_error: "No case_id or input provided" });
      return { statusCode: 200, body: JSON.stringify({ error: "No input" }) };
    }

    // ================================================================
    // STEP 0A: LIVE CODE AUTHORITY PRE-FLIGHT (DEPLOY270)
    // Validate all standards references before any model runs
    // ================================================================
    await updateSession({ pipeline_step: "code_authority_preflight" });

    var engineEnrichment = {
      code_authority: null,
      corrosion_loop: null,
      fatigue_assessment: null,
      vibration_assessment: null,
      cascade_analysis: null,
      inspection_plan: null
    };

    var codeRefs = extractCodeReferences(caseContext);
    if (codeRefs.length > 0) {
      try {
        var codeResult = await callEngine("live-code-authority", {
          action: "validate_references",
          references: codeRefs
        });
        if (codeResult && !codeResult.engine_call_error) {
          engineEnrichment.code_authority = codeResult;
          // Append validated standards to case context
          caseContext = caseContext + "\n\n=== LIVE CODE AUTHORITY (DEPLOY270 — AUTOMATED PRE-FLIGHT) ===";
          var validations = codeResult.validations || codeResult.results || [];
          if (validations.length > 0) {
            for (var cv = 0; cv < validations.length; cv++) {
              var v = validations[cv];
              caseContext = caseContext + "\n" + (v.input_reference || v.reference || "unknown")
                + " -> " + (v.resolved_code || v.current_edition || "unresolved")
                + " | status: " + (v.currency_status || v.status || "unknown");
            }
          }
          caseContext = caseContext + "\nNOTE: All standards references validated against DEPLOY270 Live Code Authority."
            + " Models MUST use verified editions, not assumed editions.";
        }
      } catch (codeErr) {
        // Non-fatal — pipeline continues without code validation
        engineEnrichment.code_authority = { error: String(codeErr), note: "non-fatal, pipeline continues" };
      }
    }

    // ================================================================
    // STEP 0B: DOMAIN ENRICHMENT (DEPLOY267 + DEPLOY268)
    // Auto-detect damage domains and run specialized engines
    // ================================================================
    await updateSession({ pipeline_step: "domain_enrichment" });

    var domains = detectDomains(caseContext);

    // Corrosion Loop Engine (DEPLOY267)
    if (domains.corrosion) {
      try {
        var corrResult = await callEngine("corrosion-loop-engine", {
          action: "identify_mechanism",
          case_id: caseId || null,
          context: caseContext.substring(0, 3000)
        });
        if (corrResult && !corrResult.engine_call_error) {
          engineEnrichment.corrosion_loop = corrResult;
          caseContext = caseContext + "\n\n=== CORROSION LOOP ENGINE (DEPLOY267 — AUTOMATED ENRICHMENT) ==="
            + "\nPrimary mechanism: " + (corrResult.mechanism || corrResult.primary_mechanism || "unknown")
            + "\nRate method: " + (corrResult.rate_method || "unknown")
            + "\nCorrosion rate: " + (corrResult.corrosion_rate_mmpy || corrResult.rate || "not calculated") + " mm/yr"
            + "\nRemaining life: " + (corrResult.remaining_life_years || "not calculated") + " years"
            + "\nRecommended interval: " + (corrResult.interval_years || "not calculated") + " years"
            + "\nProof status: " + (corrResult.proof_status || "unknown");
        }
      } catch (corrErr) {
        engineEnrichment.corrosion_loop = { error: String(corrErr), note: "non-fatal" };
      }
    }

    // Fatigue & Vibration Proof Engine (DEPLOY268)
    if (domains.fatigue) {
      try {
        var fatResult = await callEngine("fatigue-vibration-proof", {
          action: "assess_fatigue",
          case_id: caseId || null,
          context: caseContext.substring(0, 3000)
        });
        if (fatResult && !fatResult.engine_call_error) {
          engineEnrichment.fatigue_assessment = fatResult;
          caseContext = caseContext + "\n\n=== FATIGUE PROOF ENGINE (DEPLOY268 — AUTOMATED ENRICHMENT) ==="
            + "\nJoint class: " + (fatResult.joint_class || "unknown")
            + "\nS-N curve: " + (fatResult.sn_curve || "unknown")
            + "\nMiner sum: " + (fatResult.miner_sum || "not calculated")
            + "\nFatigue life status: " + (fatResult.fatigue_status || fatResult.proof_status || "unknown");
        }
      } catch (fatErr) {
        engineEnrichment.fatigue_assessment = { error: String(fatErr), note: "non-fatal" };
      }
    }

    if (domains.vibration) {
      try {
        var vibResult = await callEngine("fatigue-vibration-proof", {
          action: "assess_vibration",
          case_id: caseId || null,
          context: caseContext.substring(0, 3000)
        });
        if (vibResult && !vibResult.engine_call_error) {
          engineEnrichment.vibration_assessment = vibResult;
          caseContext = caseContext + "\n\n=== VIBRATION PROOF ENGINE (DEPLOY268 — AUTOMATED ENRICHMENT) ==="
            + "\nSeverity zone: " + (vibResult.severity_zone || "unknown")
            + "\nVelocity RMS: " + (vibResult.velocity_rms || "unknown") + " mm/s"
            + "\nVIV risk: " + (vibResult.viv_risk || "unknown");
        }
      } catch (vibErr) {
        engineEnrichment.vibration_assessment = { error: String(vibErr), note: "non-fatal" };
      }
    }

    // ================================================================
    // STEP 1: MODEL A — Physics + Proof Chain Engine (GPT-4o)
    // ================================================================
    await updateSession({ pipeline_step: "model_a_physics" });

    var modelAMessage = "Analyze this inspection case using physics-first reasoning AND proof chain construction."
      + " Build the complete reality topology with proof-critical zones."
      + " Construct the CLAIM GRAPH with typed claim nodes and status."
      + " Build COMPONENT-LEVEL PROOF CHAINS for every critical component."
      + " Produce CASE-DERIVED CALCULATIONS with input quality tracking."
      + " Produce METHOD OBSERVABILITY PROOFS for every method/damage-mode/component combination."
      + " Identify ALL active mechanisms with physics reasoning."
      + " Reason backward from evidence to constrain history."
      + " Identify what evidence is absent that should be present."
      + " Fuse multiple methods into unified pictures."
      + " CRITICAL: Every claim must be provable, not merely plausible."
      + "\n\n" + caseContext;

    var modelAResp = await callOpenAI(MODEL_A_PROMPT, modelAMessage);
    var modelAOutput = parseAIResponse(modelAResp, "openai");
    var modelATime = Date.now() - startTime;

    await updateSession({ pipeline_step: "model_a_complete", model_a_output: modelAOutput, model_a_duration_ms: modelATime });

    // ================================================================
    // STEP 2: MODEL B — Engineering + Standards + Assumptions (Claude)
    // ================================================================
    await updateSession({ pipeline_step: "model_b_engineering" });

    var modelBMessage = "You have the physics analysis and proof chains from Model A."
      + " Now determine consequences, validate EVERY standards claim to source authority level,"
      + " map EVERY assumption to the claims it carries, produce PROOF-LEVEL repair validation,"
      + " enforce unknowns as constraints, and simulate temporal futures."
      + " CRITICAL: Every standard must trace to body/edition/status."
      + "\n\n=== MODEL A PHYSICS + PROOF CHAIN OUTPUT ===\n"
      + JSON.stringify(modelAOutput, null, 2)
      + "\n\n=== ORIGINAL CASE CONTEXT ===\n"
      + caseContext;

    var modelBStart = Date.now();
    var modelBResp = await callClaude(MODEL_B_PROMPT, modelBMessage);
    var modelBOutput = parseAIResponse(modelBResp, "claude");
    var modelBTime = Date.now() - modelBStart;

    await updateSession({ pipeline_step: "model_b_complete", model_b_output: modelBOutput, model_b_duration_ms: modelBTime });

    // ================================================================
    // STEP 2B: MULTI-ASSET CASCADE (DEPLOY269)
    // If multi-asset context detected, run cascade analysis
    // ================================================================
    var cascadeContext = "";
    if (domains.multi_asset) {
      await updateSession({ pipeline_step: "cascade_analysis" });
      try {
        var cascadeResult = await callEngine("multi-asset-cascade", {
          action: "analyze_cascades",
          case_id: caseId || null,
          context: caseContext.substring(0, 2000),
          model_b_output: JSON.stringify(modelBOutput).substring(0, 2000)
        });
        if (cascadeResult && !cascadeResult.engine_call_error) {
          engineEnrichment.cascade_analysis = cascadeResult;
          cascadeContext = "\n\n=== MULTI-ASSET CASCADE ENGINE (DEPLOY269 — AUTOMATED) ==="
            + "\nCascade paths found: " + (cascadeResult.cascade_paths ? cascadeResult.cascade_paths.length : 0)
            + "\nSPOF count: " + (cascadeResult.spof_count || 0)
            + "\nCommon cause groups: " + (cascadeResult.common_cause_groups || 0)
            + "\nMax cascade depth: " + (cascadeResult.max_depth || "unknown")
            + "\nCascade risk: " + (cascadeResult.cascade_risk || cascadeResult.overall_risk || "unknown");
          if (cascadeResult.cascade_paths) {
            for (var cp = 0; cp < Math.min(cascadeResult.cascade_paths.length, 5); cp++) {
              var path = cascadeResult.cascade_paths[cp];
              cascadeContext = cascadeContext + "\nPath " + (cp + 1) + ": " + (path.description || path.path || JSON.stringify(path).substring(0, 200));
            }
          }
        }
      } catch (cascErr) {
        engineEnrichment.cascade_analysis = { error: String(cascErr), note: "non-fatal" };
      }
    }

    // ================================================================
    // STEP 3: MODEL C — Adversarial + Proof Attack (GPT-4o)
    // ================================================================
    await updateSession({ pipeline_step: "model_c_adversarial" });

    var modelCMessage = "You have the outputs of Model A (Physics + Proof Chains) and Model B (Engineering + Standards + Assumptions)."
      + " ATTACK their PROOF CHAINS. Run PROOF BREAK DETECTION on every critical claim."
      + " Build DISPROOF PATHS for every major conclusion."
      + " COMPUTE confidence from weighted factors, not intuition."
      + " Find where conclusions LOOK strong in narrative but are BROKEN in proof."
      + " CRITICAL: A well-written paragraph is not proof. A traceable chain IS proof."
      + "\n\n=== MODEL A PHYSICS + PROOF CHAIN OUTPUT ===\n"
      + JSON.stringify(modelAOutput, null, 2)
      + "\n\n=== MODEL B ENGINEERING + STANDARDS + ASSUMPTIONS OUTPUT ===\n"
      + JSON.stringify(modelBOutput, null, 2)
      + (cascadeContext ? "\n\n=== MULTI-ASSET CASCADE ANALYSIS (DEPLOY269) ===" + cascadeContext : "")
      + "\n\n=== ORIGINAL CASE CONTEXT ===\n"
      + caseContext;

    var modelCStart = Date.now();
    var modelCResp = await callOpenAI(MODEL_C_PROMPT, modelCMessage);
    var modelCOutput = parseAIResponse(modelCResp, "openai");
    var modelCTime = Date.now() - modelCStart;

    await updateSession({ pipeline_step: "model_c_complete", model_c_output: modelCOutput, model_c_duration_ms: modelCTime });

    // ================================================================
    // STEP 4: RESOLUTION — Decision Proof + Governance Lock v3 (Claude)
    // ================================================================
    await updateSession({ pipeline_step: "resolution" });

    var resolutionMessage = "DECISION DOMINANCE MODE with PROOF AUTHORITY."
      + " Synthesize all three models into a decision-forcing, PROOF-VALIDATED output."
      + " Run DECISION PROOF ENGINE: prove why the final status is what it is."
      + " Run REGULATORY DEFENSIBILITY: test if the decision survives regulator/litigation/peer review."
      + " Apply GOVERNANCE LOCK V3: all 12 proof conditions must pass for FINAL."
      + " Use COMPUTED confidence from Model C, not intuitive scores."
      + " Propagate proof breaks to governance lock."
      + " End with final_line: one sentence capturing the governing reality."
      + " CRITICAL: The final status is a PROOF RESULT, not a judgment call."
      + "\n\n=== MODEL A (PHYSICS + PROOF CHAINS) ===\n"
      + JSON.stringify(modelAOutput, null, 2)
      + "\n\n=== MODEL B (ENGINEERING + STANDARDS + ASSUMPTIONS) ===\n"
      + JSON.stringify(modelBOutput, null, 2)
      + "\n\n=== MODEL C (ADVERSARIAL + PROOF ATTACKS) ===\n"
      + JSON.stringify(modelCOutput, null, 2)
      + (cascadeContext ? "\n\n=== MULTI-ASSET CASCADE ANALYSIS (DEPLOY269) ===" + cascadeContext : "")
      + "\n\n=== ORIGINAL CASE CONTEXT ===\n"
      + caseContext;

    var resStart = Date.now();
    var resolutionResp = await callClaude(RESOLUTION_PROMPT, resolutionMessage);
    var resolutionOutput = parseAIResponse(resolutionResp, "claude");
    var resolutionTime = Date.now() - resStart;

    // ================================================================
    // STEP 5: INSPECTION PLANNING PROOF (DEPLOY266)
    // Generate workpack from proof gaps identified by Resolution
    // ================================================================
    await updateSession({ pipeline_step: "inspection_planning" });

    try {
      var proofBreaks = resolutionOutput.proof_breaks_synthesized || resolutionOutput.proof_breaks || [];
      var componentSummary = resolutionOutput.component_proof_summary || [];
      var requiredActions = resolutionOutput.required_actions || [];
      var missingEvidence = [];

      // Extract missing evidence from proof breaks
      for (var pbi = 0; pbi < proofBreaks.length; pbi++) {
        var pb = proofBreaks[pbi];
        if (pb && (pb.type || pb.break_type || pb.description)) {
          missingEvidence.push(pb.description || pb.type || pb.break_type || JSON.stringify(pb).substring(0, 200));
        }
      }

      // Extract components with weak/broken proof
      var weakComponents = [];
      for (var csi = 0; csi < componentSummary.length; csi++) {
        var comp = componentSummary[csi];
        if (comp) {
          var compStatus = (comp.status || comp.component_status || comp.proof_strength || "").toUpperCase();
          if (compStatus === "BROKEN" || compStatus === "NO_PROOF" || compStatus === "PROVISIONAL" || compStatus === "LOW" || compStatus === "WEAK") {
            weakComponents.push(comp.component || comp.name || "component_" + csi);
          }
        }
      }

      if (missingEvidence.length > 0 || weakComponents.length > 0 || requiredActions.length > 0) {
        var planInput = {
          action: "generate_plan",
          case_id: caseId || null,
          input: {
            proof_breaks: proofBreaks,
            component_proof_summary: componentSummary,
            missing_evidence: missingEvidence,
            weak_components: weakComponents,
            required_actions: requiredActions,
            severity: resolutionOutput.severity || "UNKNOWN",
            final_status: resolutionOutput.final_status || "UNKNOWN"
          }
        };
        // Also set fields at top level for the engine's input detection
        planInput.proof_breaks = proofBreaks;
        planInput.component_proof_summary = componentSummary;
        planInput.missing_evidence = missingEvidence;
        planInput.severity = resolutionOutput.severity || "UNKNOWN";
        var planResult = await callEngine("inspection-planning-proof", planInput);
        if (planResult && !planResult.engine_call_error) {
          engineEnrichment.inspection_plan = planResult;
        }
      }
    } catch (planErr) {
      engineEnrichment.inspection_plan = { error: String(planErr), note: "non-fatal" };
    }

    // ================================================================
    // STEP 6: STORE COMPLETE RESULT
    // ================================================================
    var totalTime = Date.now() - startTime;

    var finalOutput = {
      summary: resolutionOutput.reality_summary || "",
      dominant_hypothesis: resolutionOutput.dominant_hypothesis || null,
      dangerous_alternative: resolutionOutput.dangerous_alternative || null,
      data_deficiency: resolutionOutput.data_deficiency_hypothesis || null,
      severity: resolutionOutput.severity || "UNKNOWN",
      status: resolutionOutput.final_status || "UNKNOWN",
      claim_graph_integrity: resolutionOutput.claim_graph_integrity || [],
      component_proof_summary: resolutionOutput.component_proof_summary || [],
      derived_calculations_verified: resolutionOutput.derived_calculations_verified || [],
      method_sufficiency_verdict: resolutionOutput.method_sufficiency_verdict || null,
      standards_authority_verified: resolutionOutput.standards_authority_verified || [],
      assumption_status: resolutionOutput.assumption_status_synthesized || [],
      repair_proof: resolutionOutput.repair_proof_synthesized || [],
      proof_breaks: resolutionOutput.proof_breaks_synthesized || [],
      confidence_records: resolutionOutput.confidence_records || [],
      disproof_paths: resolutionOutput.disproof_paths_synthesized || [],
      decision_proof: resolutionOutput.decision_proof || null,
      regulatory_defensibility: resolutionOutput.regulatory_defensibility || null,
      uncertainty_profile: resolutionOutput.uncertainty_profile || null,
      uncertainty_operational_behavior: resolutionOutput.uncertainty_operational_behavior || "UNKNOWN",
      casualty_chain: resolutionOutput.casualty_chain || null,
      temporal_projection: resolutionOutput.temporal_projection || null,
      temporal_scenarios_synthesized: resolutionOutput.temporal_scenarios_synthesized || null,
      unknown_constraints: resolutionOutput.unknown_constraints_synthesized || [],
      hard_decision_boundaries: resolutionOutput.hard_decision_boundaries || [],
      escalation_triggers: resolutionOutput.escalation_triggers || [],
      constraint_dominance: resolutionOutput.constraint_dominance || null,
      required_actions: resolutionOutput.required_actions || [],
      code_references: resolutionOutput.code_references || [],
      governance_lock: resolutionOutput.governance_lock || null,
      consensus_fragility: resolutionOutput.consensus_fragility || "UNKNOWN",
      key_assumptions: resolutionOutput.key_assumptions || [],
      contradiction_resolution: resolutionOutput.contradiction_resolution || [],
      final_line: resolutionOutput.final_line || "",
      engine_enrichment: engineEnrichment
    };

    await updateSession({
      pipeline_step: "complete",
      pipeline_status: "complete",
      resolution_output: resolutionOutput,
      resolution_duration_ms: resolutionTime,
      total_duration_ms: totalTime,
      final_output: finalOutput
    });

    return { statusCode: 200, body: JSON.stringify({ status: "complete", session_id: sessionId, total_ms: totalTime }) };

  } catch (err) {
    // Try to update session with error
    try {
      var sbErr = createClient(supabaseUrl, supabaseKey);
      var errBody = JSON.parse(event.body || "{}");
      if (errBody.session_id) {
        await sbErr.from("reasoning_sessions").update({
          pipeline_status: "error",
          pipeline_error: String(err && err.message ? err.message : err),
          updated_at: new Date().toISOString()
        }).eq("id", errBody.session_id);
      }
    } catch (e2) {}

    return { statusCode: 200, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
