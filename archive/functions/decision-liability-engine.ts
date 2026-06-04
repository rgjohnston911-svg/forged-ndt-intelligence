// @ts-nocheck
/**
 * DEPLOY277 - Decision Liability Engine v1.0.0
 * netlify/functions/decision-liability-engine.ts
 *
 * Deterministic decision mode governance and liability boundary engine.
 * Controls what the system CAN and CANNOT decide at each confidence level.
 * Enforces mandatory human-in-the-loop for safety-critical decisions.
 * Tracks decision provenance and audit trail for regulatory compliance.
 *
 * Architecture: AI models produce recommendations. This engine determines
 * whether the system has AUTHORITY to act on those recommendations or
 * whether human decision-maker intervention is REQUIRED.
 *
 * Knowledge base:
 *   5 decision modes (assist, advisory, supervisory, authority, locked)
 *   12 decision categories with mode requirements
 *   8 liability boundary rules
 *   10 regulatory framework references
 *   6 escalation triggers
 *   Human-in-the-loop enforcement logic
 *   Decision provenance tracking
 *
 * 10 actions:
 *   get_registry
 *   evaluate_decision_mode     -- determine allowed mode for decision
 *   check_authority            -- can system make this decision?
 *   get_escalation_triggers    -- what forces human review
 *   get_decision_categories    -- all decision types with requirements
 *   get_liability_boundaries   -- hard liability rules
 *   get_regulatory_framework   -- applicable regulations
 *   log_decision               -- record decision with provenance
 *   get_decision_audit         -- retrieve decision audit trail
 *   get_mode_definitions       -- all decision mode definitions
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var ENGINE_NAME = "decision-liability-engine";
var ENGINE_VERSION = "v1.0.0";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

var supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

function ok(data) {
  return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(data) };
}

function fail(code, msg) {
  return { statusCode: code, headers: corsHeaders, body: JSON.stringify({ error: msg }) };
}

function getOrg(event) {
  try {
    var auth = event.headers["authorization"] || "";
    if (!auth) return null;
    var token = auth.replace("Bearer ", "");
    var payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    return payload.app_metadata && payload.app_metadata.org_id ? payload.app_metadata.org_id : null;
  } catch (e) {
    return null;
  }
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function nowISO() {
  return new Date().toISOString();
}

// ============================================================
// DECISION MODES — 5 modes from least to most autonomous
// ============================================================

var DECISION_MODES = {
  assist: {
    key: "assist",
    name: "Assist Mode",
    level: 1,
    description: "System provides information and analysis only. All decisions made by human.",
    authority: "NONE — information provider only",
    human_role: "Full decision authority — system is a tool",
    confidence_range: "any — assist mode always available",
    min_confidence: 0,
    max_confidence: 1.0,
    outputs: ["data_presentation", "calculation_results", "reference_information", "measurement_display"],
    restrictions: "Cannot make recommendations. Cannot suggest dispositions. Information only.",
    liability: "Human retains all liability. System provides data accuracy only.",
    use_when: "Insufficient evidence, unqualified situation, or user preference"
  },
  advisory: {
    key: "advisory",
    name: "Advisory Mode",
    level: 2,
    description: "System provides recommendations with confidence levels. Human makes final decision.",
    authority: "Recommendation only — human decides",
    human_role: "Final decision authority — reviews and approves/rejects recommendations",
    confidence_range: "0.30-0.75",
    min_confidence: 0.30,
    max_confidence: 0.75,
    outputs: ["recommendations", "confidence_levels", "supporting_evidence", "alternative_options", "risk_assessment"],
    restrictions: "Must present alternatives. Must state confidence. Must identify uncertainties. Cannot auto-execute.",
    liability: "Human retains decision liability. System liable for recommendation quality and evidence accuracy.",
    use_when: "Moderate evidence, standard situations, qualified but needs human judgment"
  },
  supervisory: {
    key: "supervisory",
    name: "Supervisory Mode",
    level: 3,
    description: "System makes preliminary decisions subject to human review and approval before execution.",
    authority: "Preliminary decision — requires human approval",
    human_role: "Review and approve/reject/modify — gatekeeper role",
    confidence_range: "0.60-0.85",
    min_confidence: 0.60,
    max_confidence: 0.85,
    outputs: ["preliminary_decision", "decision_rationale", "evidence_summary", "confidence_assessment", "escalation_flags"],
    restrictions: "Decision queued for review. Cannot execute without approval. Must flag escalation triggers.",
    liability: "Shared — system liable for analysis quality, human liable for approval decision.",
    use_when: "Good evidence, well-understood situation, but consequences warrant human oversight"
  },
  authority: {
    key: "authority",
    name: "Authority Mode",
    level: 4,
    description: "System makes and executes decisions within defined boundaries. Human notified but approval not required.",
    authority: "Full decision authority within defined scope",
    human_role: "Oversight — notified of decisions, can override",
    confidence_range: "0.75-0.95",
    min_confidence: 0.75,
    max_confidence: 0.95,
    outputs: ["decision", "execution_record", "rationale", "confidence", "audit_trail"],
    restrictions: "Must stay within defined scope. Must log all decisions. Must notify human. Must respect hard boundaries.",
    liability: "System assumes decision liability within scope. Org assumes liability for scope definition.",
    use_when: "High evidence, deterministic situation, well-defined acceptance criteria, code-based decision"
  },
  locked: {
    key: "locked",
    name: "Locked Mode (Human Required)",
    level: 5,
    description: "System CANNOT make this decision under any circumstances. Human decision mandatory.",
    authority: "ZERO — decision explicitly reserved for qualified human",
    human_role: "Mandatory decision-maker — no AI delegation permitted",
    confidence_range: "N/A — locked regardless of confidence",
    min_confidence: 0,
    max_confidence: 0,
    outputs: ["information_package", "analysis_summary", "escalation_notice"],
    restrictions: "CANNOT recommend disposition. CANNOT suggest accept/reject. Must escalate to human.",
    liability: "Fully human. System provides information support only.",
    use_when: "Safety-critical, life-safety, regulatory requirement, catastrophic consequence, legal/contractual"
  }
};

// ============================================================
// DECISION CATEGORIES — 12 categories with mode requirements
// ============================================================

var DECISION_CATEGORIES = {
  code_compliance: {
    key: "code_compliance",
    name: "Code Compliance Determination",
    description: "Whether a finding meets or fails specific code acceptance criteria",
    minimum_mode: "authority",
    maximum_mode: "authority",
    rationale: "Deterministic — code criteria are binary (pass/fail). System has full code knowledge.",
    confidence_required: 0.75,
    human_override: true,
    examples: ["AWS D1.1 undercut 0.5mm vs 1.6mm limit", "SSPC-PA 2 DFT check", "ASME VIII flaw size vs table limits"]
  },
  fitness_for_service: {
    key: "fitness_for_service",
    name: "Fitness-for-Service Assessment",
    description: "Whether degraded equipment is safe to continue operating — API 579-1/ASME FFS-1",
    minimum_mode: "advisory",
    maximum_mode: "supervisory",
    rationale: "Complex engineering judgment required. Multiple assumptions. Conservative approach mandatory.",
    confidence_required: 0.60,
    human_override: true,
    locked_conditions: ["life_safety_consequence", "catastrophic_failure_potential"],
    examples: ["Remaining life assessment", "Level 1/2/3 FFS evaluation", "Corrosion allowance adequacy"]
  },
  continued_operation: {
    key: "continued_operation",
    name: "Continued Operation Decision",
    description: "Whether equipment can safely continue operating until next planned inspection/maintenance",
    minimum_mode: "advisory",
    maximum_mode: "supervisory",
    rationale: "Requires integration of inspection data, operating conditions, and risk assessment.",
    confidence_required: 0.65,
    human_override: true,
    locked_conditions: ["active_cracking_detected", "below_retirement_thickness", "leak_present"],
    examples: ["Run/repair/replace decision", "Interval extension justification", "Temporary repair acceptance"]
  },
  repair_method_selection: {
    key: "repair_method_selection",
    name: "Repair Method Selection",
    description: "Selection of appropriate repair method — weld repair, coating repair, replacement",
    minimum_mode: "advisory",
    maximum_mode: "authority",
    rationale: "Can be deterministic when repair method is specified by code/standard. Advisory when judgment required.",
    confidence_required: 0.60,
    human_override: true,
    examples: ["Weld repair procedure", "Coating spot repair", "Sleeve repair", "Hot tap"]
  },
  inspection_planning: {
    key: "inspection_planning",
    name: "Inspection Planning / Scope",
    description: "Determining inspection scope, methods, coverage, and priority",
    minimum_mode: "advisory",
    maximum_mode: "authority",
    rationale: "Can be authority when based on RBI methodology and established inspection protocols.",
    confidence_required: 0.50,
    human_override: true,
    examples: ["CML selection", "NDT method selection", "Inspection interval determination", "Coverage requirements"]
  },
  material_identification: {
    key: "material_identification",
    name: "Material Identification / Verification",
    description: "Confirming material of construction matches specification",
    minimum_mode: "advisory",
    maximum_mode: "authority",
    rationale: "Authority mode when PMI data confirms specification. Advisory when indirect methods used.",
    confidence_required: 0.70,
    human_override: true,
    examples: ["PMI verification", "Material test report review", "Hardness-based material estimation"]
  },
  mechanism_assignment: {
    key: "mechanism_assignment",
    name: "Damage Mechanism Assignment",
    description: "Identifying and confirming active damage mechanisms",
    minimum_mode: "advisory",
    maximum_mode: "supervisory",
    rationale: "Requires engineering judgment. Multiple mechanisms may be active. Misdiagnosis consequences severe.",
    confidence_required: 0.55,
    human_override: true,
    locked_conditions: ["multiple_competing_mechanisms", "no_metallographic_confirmation"],
    examples: ["Root cause determination", "Mechanism confirmation", "DMR development"]
  },
  shutdown_recommendation: {
    key: "shutdown_recommendation",
    name: "Emergency Shutdown Recommendation",
    description: "Recommending immediate equipment shutdown for safety reasons",
    minimum_mode: "locked",
    maximum_mode: "locked",
    rationale: "ALWAYS LOCKED — production and safety impact too severe for AI decision. Human authority mandatory.",
    confidence_required: 0,
    human_override: false,
    examples: ["Imminent failure warning", "Leak detection response", "Active crack propagation"],
    always_locked: true,
    locked_reason: "Shutdown decisions affect production, safety, and can cause cascade failures. Qualified human must decide."
  },
  life_safety: {
    key: "life_safety",
    name: "Life-Safety Decision",
    description: "Any decision where incorrect outcome could result in injury or fatality",
    minimum_mode: "locked",
    maximum_mode: "locked",
    rationale: "ALWAYS LOCKED — no AI system should make life-safety decisions. Human authority mandatory.",
    confidence_required: 0,
    human_override: false,
    examples: ["Occupied area exposure", "Pressure boundary integrity for personnel", "Toxic release potential"],
    always_locked: true,
    locked_reason: "Life-safety decisions are ethically and legally reserved for qualified humans."
  },
  regulatory_submission: {
    key: "regulatory_submission",
    name: "Regulatory Submission / Certification",
    description: "Reports or certifications submitted to regulatory authorities",
    minimum_mode: "locked",
    maximum_mode: "locked",
    rationale: "ALWAYS LOCKED — regulatory submissions require qualified engineer signature and professional liability.",
    confidence_required: 0,
    human_override: false,
    examples: ["NB-6 reports", "API 510/570 reports", "State jurisdiction filings", "Insurance submissions"],
    always_locked: true,
    locked_reason: "Regulatory submissions require professional engineer stamp and personal liability acceptance."
  },
  risk_acceptance: {
    key: "risk_acceptance",
    name: "Risk Acceptance Decision",
    description: "Accepting residual risk — deciding that known risk is acceptable for continued operation",
    minimum_mode: "locked",
    maximum_mode: "locked",
    rationale: "ALWAYS LOCKED — risk acceptance is a management/ownership decision, not a technical decision.",
    confidence_required: 0,
    human_override: false,
    examples: ["Accepting known corrosion rate", "Deferring repair", "Operating with known deficiency"],
    always_locked: true,
    locked_reason: "Risk acceptance is a business and legal decision that requires ownership authority."
  },
  data_recording: {
    key: "data_recording",
    name: "Data Recording / Documentation",
    description: "Recording inspection data, measurements, observations",
    minimum_mode: "assist",
    maximum_mode: "authority",
    rationale: "Data recording is mechanical — system can do this at any confidence level.",
    confidence_required: 0,
    human_override: true,
    examples: ["Thickness readings", "Visual observations", "Environmental conditions", "Equipment inventory"]
  }
};

// ============================================================
// LIABILITY BOUNDARY RULES — 8 hard rules
// ============================================================

var LIABILITY_BOUNDARIES = {
  no_life_safety: {
    key: "no_life_safety",
    name: "No Life-Safety AI Decisions",
    rule: "System SHALL NOT make any decision where incorrect outcome could result in injury or fatality",
    enforcement: "Hard block — system cannot output disposition for life-safety decisions",
    override: "No override permitted — this is an absolute boundary",
    regulatory_basis: "Professional engineering ethics, tort liability, product liability law"
  },
  no_regulatory_signature: {
    key: "no_regulatory_signature",
    name: "No AI Regulatory Signatures",
    rule: "System SHALL NOT sign, certify, or stamp any regulatory submission",
    enforcement: "Hard block — system cannot generate certification documents",
    override: "No override permitted",
    regulatory_basis: "State PE licensure laws, ASME certification requirements, API authorization programs"
  },
  human_in_the_loop: {
    key: "human_in_the_loop",
    name: "Mandatory Human-in-the-Loop",
    rule: "For supervisory and higher decisions, a qualified human MUST review before execution",
    enforcement: "Decision queued for human review — cannot auto-execute",
    override: "Organization can define auto-execute scope for authority mode within defined boundaries",
    regulatory_basis: "Industry best practice, ISO 55000, API RP 580/581"
  },
  confidence_gating: {
    key: "confidence_gating",
    name: "Confidence-Gated Decision Authority",
    rule: "System authority level is gated by confidence — low confidence forces lower authority mode",
    enforcement: "Automatic mode downgrade when confidence below category threshold",
    override: "Human can accept advisory recommendation at any confidence level",
    regulatory_basis: "Epistemic responsibility — system must not be overconfident"
  },
  audit_trail: {
    key: "audit_trail",
    name: "Complete Audit Trail Required",
    rule: "Every decision MUST be logged with full provenance — inputs, reasoning, confidence, mode, human actions",
    enforcement: "Decision logging is mandatory and non-bypassable",
    override: "No override — audit trail is always required",
    regulatory_basis: "API 510/570/653, ASME PCC-2, corporate governance, legal discovery requirements"
  },
  conservative_default: {
    key: "conservative_default",
    name: "Conservative Default on Uncertainty",
    rule: "When uncertain, system MUST default to the more conservative recommendation",
    enforcement: "Uncertainty penalty applied — system biases toward caution",
    override: "Human engineer can accept less conservative option with documented justification",
    regulatory_basis: "Engineering ethics, ASME/API code philosophy, precautionary principle"
  },
  scope_limitation: {
    key: "scope_limitation",
    name: "Defined Scope Limitation",
    rule: "System SHALL NOT make decisions outside its defined knowledge scope — must recognize boundaries",
    enforcement: "Scope check against engine capabilities — out-of-scope triggers assist mode",
    override: "Human can apply engineering judgment for out-of-scope situations",
    regulatory_basis: "Professional competency standards, API RP 580 corrosion specialist requirements"
  },
  version_tracking: {
    key: "version_tracking",
    name: "Decision Version Tracking",
    rule: "Every decision MUST record the engine versions, code editions, and knowledge base versions used",
    enforcement: "Version tags included in every decision record",
    override: "No override — version tracking is mandatory for reproducibility",
    regulatory_basis: "Quality management systems, ISO 9001, API Q1/Q2"
  }
};

// ============================================================
// ESCALATION TRIGGERS — 6 triggers that force human review
// ============================================================

var ESCALATION_TRIGGERS = {
  cracking_detected: {
    key: "cracking_detected",
    name: "Cracking Detected",
    description: "Any form of cracking detected in pressure boundary or structural component",
    action: "Escalate to supervisory or locked mode depending on crack type",
    mode_override: "supervisory",
    locked_if: "SCC, HIC, SSC, or any crack in pressure boundary",
    rationale: "Cracking is progressive and can lead to catastrophic failure — human judgment required"
  },
  near_retirement: {
    key: "near_retirement",
    name: "Approaching Retirement Thickness",
    description: "Wall thickness within 10% of calculated retirement/minimum thickness",
    action: "Escalate to supervisory mode — fitness-for-service required",
    mode_override: "supervisory",
    locked_if: "Below retirement thickness",
    rationale: "Operating near design limits requires engineering assessment of remaining life"
  },
  mechanism_change: {
    key: "mechanism_change",
    name: "Unexpected Damage Mechanism",
    description: "Damage mechanism not predicted by DMR or materially different from expected",
    action: "Escalate to advisory mode — mechanism review required",
    mode_override: "advisory",
    locked_if: "Catastrophic mechanism (SCC, HTHA, brittle fracture) identified",
    rationale: "Unexpected mechanisms may indicate process change or material issue — requires investigation"
  },
  rate_acceleration: {
    key: "rate_acceleration",
    name: "Damage Rate Acceleration",
    description: "Measured damage rate significantly exceeds predicted or historical rate (>2x)",
    action: "Escalate to supervisory mode — root cause analysis required",
    mode_override: "supervisory",
    locked_if: "Rate exceeds 5x predicted — imminent risk assessment required",
    rationale: "Rate acceleration indicates changed conditions — may require immediate action"
  },
  model_disagreement: {
    key: "model_disagreement",
    name: "AI Model Fundamental Disagreement",
    description: "Tri-model reasoning produces contradictory dispositions — no resolution achieved",
    action: "Escalate to advisory mode — present all perspectives to human",
    mode_override: "advisory",
    locked_if: "Disagreement on safety-critical aspect",
    rationale: "Model disagreement indicates ambiguity — human judgment needed to resolve"
  },
  evidence_contradiction: {
    key: "evidence_contradiction",
    name: "Evidence Self-Contradiction",
    description: "Available evidence contains internal contradictions — measurements conflict with observations",
    action: "Escalate to advisory mode — evidence review required",
    mode_override: "advisory",
    locked_if: "Contradiction affects safety-critical determination",
    rationale: "Contradictory evidence may indicate measurement error, wrong location, or complex situation"
  }
};

// ============================================================
// REGULATORY FRAMEWORK REFERENCES — 10 frameworks
// ============================================================

var REGULATORY_FRAMEWORKS = {
  api_510: { key: "api_510", name: "API 510 Pressure Vessel Inspection Code", scope: "In-service pressure vessel inspection, repair, alteration, rerating", authority_requirement: "Authorized API 510 Inspector", human_required: true },
  api_570: { key: "api_570", name: "API 570 Piping Inspection Code", scope: "In-service metallic piping inspection, repair, alteration, rerating", authority_requirement: "Authorized API 570 Inspector", human_required: true },
  api_653: { key: "api_653", name: "API 653 Tank Inspection, Repair, Alteration, and Reconstruction", scope: "Aboveground storage tanks", authority_requirement: "Authorized API 653 Inspector", human_required: true },
  api_579: { key: "api_579", name: "API 579-1/ASME FFS-1 Fitness-For-Service", scope: "FFS assessment of degraded equipment", authority_requirement: "Qualified Engineer", human_required: true },
  asme_pcc2: { key: "asme_pcc2", name: "ASME PCC-2 Repair of Pressure Equipment and Piping", scope: "Repair methods for pressure equipment", authority_requirement: "Qualified Engineer + Authorized Inspector", human_required: true },
  nb_inspection: { key: "nb_inspection", name: "National Board Inspection Code (NBIC)", scope: "Installation, inspection, repair, alteration of boilers and pressure vessels", authority_requirement: "National Board Commissioned Inspector", human_required: true },
  osha_psp: { key: "osha_psp", name: "OSHA Process Safety Management (PSM) 29 CFR 1910.119", scope: "Mechanical integrity of process equipment", authority_requirement: "Qualified Personnel per PSM program", human_required: true },
  epa_rmp: { key: "epa_rmp", name: "EPA Risk Management Program (RMP) 40 CFR Part 68", scope: "Prevention and response planning for chemical releases", authority_requirement: "Facility management", human_required: true },
  dot_phmsa: { key: "dot_phmsa", name: "DOT/PHMSA Pipeline Safety Regulations 49 CFR Parts 190-199", scope: "Pipeline integrity management", authority_requirement: "Qualified Individual per Operator Qualification", human_required: true },
  iso_55000: { key: "iso_55000", name: "ISO 55000 Asset Management", scope: "Asset management system — decision framework for asset lifecycle", authority_requirement: "Asset Manager", human_required: true }
};

// ============================================================
// EVALUATE DECISION MODE
// ============================================================

function evaluateDecisionMode(input) {
  var steps = [];
  var decisionCategory = input.decision_category || "data_recording";
  var confidence = input.confidence || 0;
  var consequence = input.consequence || "low";
  var escalationFlags = [];

  // Step 1: Look up decision category
  var category = DECISION_CATEGORIES[decisionCategory];
  if (!category) {
    return {
      engine: ENGINE_NAME,
      version: ENGINE_VERSION,
      error: "Unknown decision category: " + decisionCategory,
      available_categories: Object.keys(DECISION_CATEGORIES)
    };
  }

  steps.push("STEP 1: Decision category — " + category.name + ". Min mode: " + category.minimum_mode + ". Max mode: " + category.maximum_mode + ".");

  // Step 2: Check if always locked
  if (category.always_locked) {
    steps.push("STEP 2: LOCKED — " + category.locked_reason);
    return {
      engine: ENGINE_NAME,
      version: ENGINE_VERSION,
      action: "evaluate_decision_mode",
      decision_category: decisionCategory,
      category_name: category.name,
      allowed_mode: "locked",
      mode_details: DECISION_MODES.locked,
      reason: category.locked_reason,
      confidence: confidence,
      steps: steps,
      escalation_flags: ["ALWAYS_LOCKED: " + category.locked_reason],
      human_required: true,
      can_system_decide: false,
      timestamp: nowISO()
    };
  }

  // Step 3: Check locked conditions
  var lockedConditions = category.locked_conditions || [];
  var triggeredLocks = [];
  var inputConditions = input.conditions || [];
  for (var lc = 0; lc < lockedConditions.length; lc++) {
    for (var ic = 0; ic < inputConditions.length; ic++) {
      if (inputConditions[ic] === lockedConditions[lc]) {
        triggeredLocks.push(lockedConditions[lc]);
      }
    }
  }

  if (triggeredLocks.length > 0) {
    steps.push("STEP 3: Locked conditions triggered — " + triggeredLocks.join(", "));
    return {
      engine: ENGINE_NAME,
      version: ENGINE_VERSION,
      action: "evaluate_decision_mode",
      decision_category: decisionCategory,
      category_name: category.name,
      allowed_mode: "locked",
      mode_details: DECISION_MODES.locked,
      reason: "Locked condition(s) active: " + triggeredLocks.join(", "),
      confidence: confidence,
      steps: steps,
      escalation_flags: triggeredLocks,
      human_required: true,
      can_system_decide: false,
      timestamp: nowISO()
    };
  }

  steps.push("STEP 3: No locked conditions triggered.");

  // Step 4: Check escalation triggers
  var inputTriggers = input.escalation_triggers || [];
  for (var et = 0; et < inputTriggers.length; et++) {
    var trigger = ESCALATION_TRIGGERS[inputTriggers[et]];
    if (trigger) {
      escalationFlags.push(trigger.name + ": " + trigger.action);
    }
  }

  if (escalationFlags.length > 0) {
    steps.push("STEP 4: " + escalationFlags.length + " escalation trigger(s) active.");
  } else {
    steps.push("STEP 4: No escalation triggers.");
  }

  // Step 5: Determine mode from confidence
  var confidenceMode = "assist";
  if (confidence >= 0.75) confidenceMode = "authority";
  else if (confidence >= 0.60) confidenceMode = "supervisory";
  else if (confidence >= 0.30) confidenceMode = "advisory";

  steps.push("STEP 5: Confidence " + confidence + " maps to " + confidenceMode + " mode.");

  // Step 6: Apply category constraints
  var modeOrder = ["assist", "advisory", "supervisory", "authority", "locked"];
  var confidenceModeIndex = modeOrder.indexOf(confidenceMode);
  var maxModeIndex = modeOrder.indexOf(category.maximum_mode);
  var minModeIndex = modeOrder.indexOf(category.minimum_mode);

  var finalModeIndex = confidenceModeIndex;
  // Cannot exceed category maximum
  if (finalModeIndex > maxModeIndex) finalModeIndex = maxModeIndex;
  // Cannot be below category minimum (unless confidence forces lower)
  // Actually: if confidence is insufficient for minimum mode, downgrade to lower mode
  if (category.confidence_required && confidence < category.confidence_required) {
    // Confidence too low for this category — downgrade
    if (finalModeIndex >= minModeIndex) {
      finalModeIndex = Math.min(finalModeIndex, minModeIndex - 1);
      if (finalModeIndex < 0) finalModeIndex = 0;
    }
  }

  // Apply escalation downgrades
  for (var ed = 0; ed < inputTriggers.length; ed++) {
    var trig = ESCALATION_TRIGGERS[inputTriggers[ed]];
    if (trig) {
      var trigModeIndex = modeOrder.indexOf(trig.mode_override);
      if (trigModeIndex >= 0 && trigModeIndex < finalModeIndex) {
        finalModeIndex = trigModeIndex;
      }
      // Check if trigger forces locked
      if (trig.locked_if) {
        for (var lci = 0; lci < inputConditions.length; lci++) {
          if (trig.locked_if.toLowerCase().indexOf(inputConditions[lci].toLowerCase()) >= 0) {
            finalModeIndex = 4; // locked
          }
        }
      }
    }
  }

  // Apply consequence severity
  if (consequence === "catastrophic" && finalModeIndex > 2) {
    finalModeIndex = 2; // max supervisory for catastrophic
    escalationFlags.push("CONSEQUENCE_OVERRIDE: Catastrophic consequence caps mode at supervisory");
  }
  if (consequence === "very_high" && finalModeIndex > 3) {
    finalModeIndex = 2;
    escalationFlags.push("CONSEQUENCE_OVERRIDE: Very high consequence caps mode at supervisory");
  }

  var finalMode = modeOrder[finalModeIndex];
  var modeDetails = DECISION_MODES[finalMode];

  steps.push("STEP 6: Final mode: " + finalMode + " (level " + modeDetails.level + "). Category max: " + category.maximum_mode + ". Consequence: " + consequence + ".");

  var canSystemDecide = (finalMode === "authority");
  var humanRequired = (finalMode === "locked" || finalMode === "supervisory" || finalMode === "advisory");

  return {
    engine: ENGINE_NAME,
    version: ENGINE_VERSION,
    action: "evaluate_decision_mode",
    decision_category: decisionCategory,
    category_name: category.name,
    allowed_mode: finalMode,
    mode_level: modeDetails.level,
    mode_details: modeDetails,
    confidence: confidence,
    consequence: consequence,
    can_system_decide: canSystemDecide,
    human_required: humanRequired,
    human_role: modeDetails.human_role,
    escalation_flags: escalationFlags,
    applicable_regulations: [],
    steps: steps,
    timestamp: nowISO()
  };
}

// ============================================================
// HANDLER — 10 API actions
// ============================================================

var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return fail(405, "POST only");
  }

  var body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return fail(400, "Invalid JSON");
  }

  var action = body.action || "";
  var orgId = getOrg(event);

  // == get_registry ==
  if (action === "get_registry") {
    return ok({
      engine: ENGINE_NAME,
      version: ENGINE_VERSION,
      status: "operational",
      actions: [
        "get_registry",
        "evaluate_decision_mode",
        "check_authority",
        "get_escalation_triggers",
        "get_decision_categories",
        "get_liability_boundaries",
        "get_regulatory_framework",
        "log_decision",
        "get_decision_audit",
        "get_mode_definitions"
      ],
      knowledge_base: {
        decision_modes: Object.keys(DECISION_MODES).length,
        decision_categories: Object.keys(DECISION_CATEGORIES).length,
        liability_boundaries: Object.keys(LIABILITY_BOUNDARIES).length,
        escalation_triggers: Object.keys(ESCALATION_TRIGGERS).length,
        regulatory_frameworks: Object.keys(REGULATORY_FRAMEWORKS).length
      },
      deploy: "DEPLOY277"
    });
  }

  // == evaluate_decision_mode ==
  if (action === "evaluate_decision_mode") {
    return ok(evaluateDecisionMode(body));
  }

  // == check_authority ==
  if (action === "check_authority") {
    var modeResult = evaluateDecisionMode(body);
    return ok({
      engine: ENGINE_NAME,
      action: "check_authority",
      decision_category: body.decision_category,
      confidence: body.confidence || 0,
      can_system_decide: modeResult.can_system_decide,
      allowed_mode: modeResult.allowed_mode,
      human_required: modeResult.human_required,
      reason: modeResult.can_system_decide ? "System has authority for this decision at this confidence level" : "Human decision required — mode is " + modeResult.allowed_mode,
      timestamp: nowISO()
    });
  }

  // == get_escalation_triggers ==
  if (action === "get_escalation_triggers") {
    return ok({ engine: ENGINE_NAME, action: "get_escalation_triggers", count: Object.keys(ESCALATION_TRIGGERS).length, triggers: ESCALATION_TRIGGERS });
  }

  // == get_decision_categories ==
  if (action === "get_decision_categories") {
    return ok({ engine: ENGINE_NAME, action: "get_decision_categories", count: Object.keys(DECISION_CATEGORIES).length, categories: DECISION_CATEGORIES });
  }

  // == get_liability_boundaries ==
  if (action === "get_liability_boundaries") {
    return ok({ engine: ENGINE_NAME, action: "get_liability_boundaries", count: Object.keys(LIABILITY_BOUNDARIES).length, boundaries: LIABILITY_BOUNDARIES });
  }

  // == get_regulatory_framework ==
  if (action === "get_regulatory_framework") {
    return ok({ engine: ENGINE_NAME, action: "get_regulatory_framework", count: Object.keys(REGULATORY_FRAMEWORKS).length, frameworks: REGULATORY_FRAMEWORKS });
  }

  // == log_decision ==
  if (action === "log_decision") {
    var decisionRecord = {
      org_id: orgId,
      case_id: body.case_id || null,
      decision_category: body.decision_category || "unknown",
      decision_mode: body.decision_mode || "assist",
      confidence: body.confidence || 0,
      disposition: body.disposition || null,
      rationale: body.rationale || null,
      human_reviewer: body.human_reviewer || null,
      human_approved: body.human_approved || false,
      engine_versions: body.engine_versions || { decision_liability: ENGINE_VERSION },
      evidence_summary: body.evidence_summary || null,
      escalation_flags: body.escalation_flags || [],
      created_at: nowISO()
    };

    try {
      var result = await supabase.from("decision_audit_log").insert(decisionRecord).select();
      return ok({
        engine: ENGINE_NAME,
        action: "log_decision",
        logged: true,
        record_id: result.data && result.data[0] ? result.data[0].id : null,
        timestamp: nowISO()
      });
    } catch (e) {
      return ok({
        engine: ENGINE_NAME,
        action: "log_decision",
        logged: false,
        error: "Database insert failed — decision recorded in response only",
        record: decisionRecord,
        timestamp: nowISO()
      });
    }
  }

  // == get_decision_audit ==
  if (action === "get_decision_audit") {
    var caseId = body.case_id || null;
    if (!caseId) {
      return fail(400, "case_id required");
    }
    try {
      var auditResult = await supabase
        .from("decision_audit_log")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: true });
      return ok({
        engine: ENGINE_NAME,
        action: "get_decision_audit",
        case_id: caseId,
        decisions: auditResult.data || [],
        count: auditResult.data ? auditResult.data.length : 0,
        timestamp: nowISO()
      });
    } catch (e) {
      return ok({
        engine: ENGINE_NAME,
        action: "get_decision_audit",
        case_id: caseId,
        decisions: [],
        count: 0,
        error: "Query failed",
        timestamp: nowISO()
      });
    }
  }

  // == get_mode_definitions ==
  if (action === "get_mode_definitions") {
    return ok({ engine: ENGINE_NAME, action: "get_mode_definitions", count: Object.keys(DECISION_MODES).length, modes: DECISION_MODES });
  }

  return fail(400, "Unknown action: " + action + ". Call get_registry for available actions.");
};

export { handler };
