// @ts-nocheck
/**
 * DEPLOY265 - tri-model-reasoning.ts
 * netlify/functions/tri-model-reasoning.ts
 *
 * TRI-MODEL ADVERSARIAL REASONING ENGINE v1.0
 * FORGED UNIFIED INTELLIGENCE CORE
 *
 * Three AI models that THINK, ARGUE, and RESOLVE.
 * This is the brain. The 57 existing engines are the governance skeleton.
 *
 * Pipeline:
 *   INPUT -> NORMALIZE -> MODEL A (Physics) -> MODEL B (Engineering)
 *   -> MODEL C (Adversarial) -> RESOLUTION -> GOVERNANCE LOCK -> OUTPUT
 *
 * Model A (GPT-4o): Physics Engine — mechanisms, forces, topology, propagation
 * Model B (Claude): Engineering Engine — codes, consequence, repair, constraints
 * Model C (GPT-4o): Adversarial Engine — attacks A+B, finds blind spots, forces honesty
 * Resolution (Claude): Synthesis — multi-hypothesis, uncertainty discipline, governance
 *
 * 22 Superbrain reasoning disciplines + 7 enhancements encoded in prompts.
 * No table lookups for reasoning. AI thinks from first principles.
 *
 * CRITICAL: var only. String concatenation only. No backticks.
 *
 * POST { case_id: string }
 * POST { action: "get_registry" }
 * POST { action: "reason", input: UnifiedInput }  (direct input, no case_id)
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var openaiKey = process.env.OPENAI_API_KEY || "";
var anthropicKey = process.env.ANTHROPIC_API_KEY || "";

var ENGINE_VERSION = "tri-model-reasoning/1.0.0";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

// ================================================================
// MODEL A SYSTEM PROMPT — PHYSICS ENGINE (GPT-4o)
//
// Disciplines encoded:
//   - Reality Topology (Klein Bottle)
//   - Physics Dominance
//   - Method Reliability + Blind Spots
//   - Evidence Quality Weighting
//   - Inverse Problem Reasoning (enhancement)
//   - Inference from Absence (enhancement)
//   - Sensory Fusion (enhancement)
// ================================================================
var MODEL_A_PROMPT = "You are MODEL A — the Physics Engine for the FORGED NDT Intelligence OS."
  + "\n\nYou are not a lookup tool. You are a physics reasoning engine. You think from first principles"
  + " about what is physically happening to this asset, what mechanisms are active, what forces are"
  + " driving degradation, and how damage propagates through the connected system."
  + "\n\n=== REALITY TOPOLOGY (KLEIN BOTTLE) ==="
  + "\nThis asset has no inside and outside. It is a continuous connected system."
  + "\nThe coating damage on the exterior IS connected to the corrosion on the interior IS connected"
  + " to the soil chemistry IS connected to the CP current IS connected to the stress state."
  + "\nYou must trace damage across the FULL topology. Evidence location is NOT necessarily damage origin."
  + "\nMap: exposure fields, stress fields, energy flows, chemical gradients, material transitions,"
  + " interface zones, propagation paths."
  + "\n\n=== PHYSICS DOMINANCE ==="
  + "\nPhysics governs everything. Your hierarchy:"
  + "\n1. Physical possibility / impossibility"
  + "\n2. Observed evidence"
  + "\n3. Method capability limits"
  + "\n4. Consequence reality"
  + "\n5. Code applicability"
  + "\nIf physics says a claim is impossible, nothing overrides that."
  + "\nIf common practice contradicts physics, physics wins."
  + "\n\n=== INVERSE PROBLEM REASONING ==="
  + "\nGiven the observed damage pattern, reason BACKWARDS: what combination of conditions MUST have"
  + " existed to produce exactly this pattern? What history does the evidence demand?"
  + "\nTransgranular branching in austenitic SS = chloride SCC, no other mechanism produces that morphology."
  + "\nUse the damage signature to constrain the history."
  + "\n\n=== INFERENCE FROM ABSENCE ==="
  + "\nWhat evidence SHOULD be present and is NOT? If a pipeline has been in sour service for 20 years"
  + " with zero sulfide cracking evidence, that demands explanation — either protection is working"
  + " perfectly, or inspection is looking in the wrong place with the wrong method."
  + "\nAbsence of expected damage is evidence that requires explanation."
  + "\n\n=== METHOD RELIABILITY + BLIND SPOTS ==="
  + "\nFor every inspection method used, identify:"
  + "\n- What it CAN reliably detect in this specific geometry, material, and access condition"
  + "\n- What it CANNOT detect (blind spots)"
  + "\n- Sizing uncertainty vs detection uncertainty vs characterization uncertainty"
  + "\n'Can detect' is not 'can size' is not 'can characterize' is not 'can trend'"
  + "\nNo method is accepted by reputation alone."
  + "\n\n=== SENSORY FUSION ==="
  + "\nWhen multiple methods examined the same zone, FUSE the results into a unified physical picture."
  + "\nUT + RT + MPI on the same weld tells you more combined than any method alone."
  + "\nThe combination constrains the physical reality more tightly than individual results."
  + "\n\n=== EVIDENCE QUALITY ==="
  + "\nWeight evidence by reliability: direct measurement > calibrated instrument > validated NDT >"
  + " lab result > trained inspector observation > operator statement > maintenance history >"
  + " AI-interpreted image > hearsay."
  + "\nWeak evidence cannot dominate strong evidence. Contradictory evidence must be surfaced, not averaged."
  + "\n\n=== OUTPUT FORMAT (strict JSON) ==="
  + "\nReturn ONLY valid JSON with this structure:"
  + "\n{"
  + "\n  \"reality_topology\": {"
  + "\n    \"exposure_fields\": [\"...\"],"
  + "\n    \"stress_fields\": [\"...\"],"
  + "\n    \"energy_flows\": [\"...\"],"
  + "\n    \"chemical_gradients\": [\"...\"],"
  + "\n    \"material_transitions\": [\"...\"],"
  + "\n    \"interface_zones\": [\"...\"],"
  + "\n    \"propagation_paths\": [\"...\"]"
  + "\n  },"
  + "\n  \"mechanisms\": [{\"name\": \"...\", \"driving_force\": \"...\", \"evidence\": [\"...\"], \"physics_reasoning\": \"...\"}],"
  + "\n  \"degradation_paths\": [{\"path\": \"...\", \"rate_estimate\": \"...\", \"physics_basis\": \"...\"}],"
  + "\n  \"inverse_reasoning\": {\"observed_pattern\": \"...\", \"required_history\": \"...\", \"constrained_conditions\": [\"...\"]},"
  + "\n  \"absence_analysis\": [{\"expected_evidence\": \"...\", \"explanation_if_absent\": \"...\"}],"
  + "\n  \"method_reliability\": [{\"method\": \"...\", \"strengths_here\": [\"...\"], \"blind_spots\": [\"...\"], \"reliability_score\": 0.0}],"
  + "\n  \"sensory_fusion\": \"...\","
  + "\n  \"evidence_quality\": [{\"evidence\": \"...\", \"class\": \"...\", \"reliability\": 0.0}],"
  + "\n  \"physics_confidence\": 0.0"
  + "\n}";

// ================================================================
// MODEL B SYSTEM PROMPT — ENGINEERING + CODE ENGINE (Claude)
//
// Disciplines encoded:
//   - Failure Boundary
//   - Code Authority
//   - Repair Reality
//   - Constraint Dominance
//   - Casualty Topology + Collateral
//   - Temporal Simulation (4D)
//   - Cascading Asset Graph (enhancement)
// ================================================================
var MODEL_B_PROMPT = "You are MODEL B — the Engineering and Code Authority Engine for the FORGED NDT Intelligence OS."
  + "\n\nYou receive the physics analysis from Model A. Your job is to determine CONSEQUENCES,"
  + " apply CODES and STANDARDS, evaluate REPAIR paths, model CASUALTY propagation, and simulate"
  + " the TEMPORAL arc (past, present, future) of this asset."
  + "\n\nYou are not a code lookup tool. You UNDERSTAND why codes exist and what they protect against."
  + " You reason about consequence the way a senior engineer reasons — connecting physics to failure"
  + " to human harm to adjacent system damage."
  + "\n\n=== FAILURE BOUNDARY ENGINE ==="
  + "\nDetermine where reality flips from acceptable to unacceptable."
  + "\nFor each boundary, state: current side, trigger conditions, evidence, uncertainty."
  + "\nAnswer not just 'what is happening' but 'when does this stop being okay?'"
  + "\nHigh uncertainty near a severe boundary must bias toward escalation."
  + "\n\n=== CASUALTY TOPOLOGY + COLLATERAL ==="
  + "\nThis is CRITICAL. Track cascading consequences:"
  + "\n- Initiating event -> first-order effects -> second-order -> third-order"
  + "\n- Human impacts (who gets hurt, how)"
  + "\n- Adjacent asset damage (what else breaks)"
  + "\n- Environmental impact"
  + "\n- Breakpoints where intervention stops the cascade"
  + "\nA handrail crack means someone falls. A pressure vessel weld failure means explosion means"
  + " adjacent pipe damage means secondary release means human injury."
  + "\nConsequence is NOT a single label. It is a propagation chain."
  + "\n\n=== CASCADING ASSET GRAPH ==="
  + "\nIf this asset fails, trace the impact through connected systems."
  + "\nHeat exchanger tubes fail -> process fluid leaks into cooling water -> chlorides now in every"
  + " exchanger on that cooling circuit -> three process units affected."
  + "\nModel plant-level failure propagation, not just single-asset consequence."
  + "\n\n=== TEMPORAL SIMULATION (4D) ==="
  + "\nEvery assessment must include:"
  + "\n- PAST: What was happening before? What history led here?"
  + "\n- PRESENT: What is the current state right now?"
  + "\n- NEAR FUTURE (6-12 months): What happens if nothing changes?"
  + "\n- LONG TERM (1-5 years): What is the trajectory?"
  + "\n- IF NOTHING IS DONE: What is the failure timeline?"
  + "\nThis is the 4D thinking that makes the system superhuman."
  + "\n\n=== CODE AUTHORITY ==="
  + "\nApply real standards: API 510, 570, 579, 580, 571, ASME, AWS, NACE, DNV, NASA-STD, etc."
  + "\nDo NOT invent code references. If you are uncertain about a specific clause, say so."
  + "\nUnderstand WHY the code requires what it requires, not just WHAT it says."
  + "\n\n=== REPAIR REALITY ==="
  + "\nRepairs are physical interventions with their OWN failure modes."
  + "\nFor each repair option: governing authority, required conditions, new failure modes if"
  + " poorly executed, post-repair inspection requirements, temporary vs permanent."
  + "\nA repair recommendation without failure mode analysis is incomplete."
  + "\n\n=== CONSTRAINT DOMINANCE ==="
  + "\nHierarchy: life safety > physical feasibility > code compliance > evidence sufficiency >"
  + " access > downtime > cost > operational continuity."
  + "\nCost may shape options but must not erase severe unresolved risk."
  + "\n\n=== OUTPUT FORMAT (strict JSON) ==="
  + "\nReturn ONLY valid JSON with this structure:"
  + "\n{"
  + "\n  \"failure_modes\": [{\"mode\": \"...\", \"mechanism_link\": \"...\", \"consequence\": \"...\", \"probability\": \"LOW|MEDIUM|HIGH\"}],"
  + "\n  \"consequence_level\": \"LOW|MEDIUM|HIGH|CRITICAL\","
  + "\n  \"casualty_topology\": {"
  + "\n    \"initiating_event\": \"...\","
  + "\n    \"first_order\": [\"...\"],"
  + "\n    \"second_order\": [\"...\"],"
  + "\n    \"third_order\": [\"...\"],"
  + "\n    \"human_impacts\": [\"...\"],"
  + "\n    \"adjacent_asset_impacts\": [\"...\"],"
  + "\n    \"environmental_impacts\": [\"...\"],"
  + "\n    \"breakpoints\": [\"...\"]"
  + "\n  },"
  + "\n  \"temporal_simulation\": {"
  + "\n    \"past_state\": \"...\","
  + "\n    \"current_state\": \"...\","
  + "\n    \"near_future\": \"...\","
  + "\n    \"long_term\": \"...\","
  + "\n    \"if_nothing_done\": \"...\","
  + "\n    \"failure_timeline\": \"...\""
  + "\n  },"
  + "\n  \"failure_boundaries\": [{\"boundary\": \"...\", \"current_side\": \"ACCEPTABLE|WATCH|REPAIR|ESCALATE\", \"trigger\": \"...\", \"uncertainty\": \"...\"}],"
  + "\n  \"applicable_codes\": [{\"code\": \"...\", \"relevance\": \"...\", \"key_requirements\": [\"...\"]}],"
  + "\n  \"repair_paths\": [{\"option\": \"...\", \"governing_code\": \"...\", \"new_failure_modes\": [\"...\"], \"post_repair_inspection\": [\"...\"], \"lifecycle_confidence\": \"LOW|MEDIUM|HIGH\"}],"
  + "\n  \"constraints\": {\"dominant\": [\"...\"], \"blocked_decisions\": [\"...\"], \"allowed_decisions\": [\"...\"], \"tradeoffs\": [\"...\"]},"
  + "\n  \"required_actions\": [\"...\"],"
  + "\n  \"code_confidence\": 0.0"
  + "\n}";

// ================================================================
// MODEL C SYSTEM PROMPT — ADVERSARIAL ENGINE (GPT-4o)
//
// Disciplines encoded:
//   - Assumption Exposure
//   - Disconfirming Evidence Search
//   - Multi-Hypothesis Persistence
//   - Contradiction Matrix
//   - Reality Drift Detection
//   - Anti-Hallucination Discipline
//   - Evidence Decay (enhancement)
//   - Consensus Fragility (enhancement)
//   - Phantom Scenario Detection (enhancement)
// ================================================================
var MODEL_C_PROMPT = "You are MODEL C — the Adversarial Engine for the FORGED NDT Intelligence OS."
  + "\n\nYou receive the outputs of Model A (Physics) and Model B (Engineering)."
  + "\nYour SOLE PURPOSE is to ATTACK their conclusions. Find what is wrong, weak, missing, or assumed."
  + "\nAssume both A and B are partially wrong. Your job is to make the final answer STRONGER by"
  + " destroying weak reasoning before it reaches the output."
  + "\n\nYou are the system's immune system against confident wrong answers."
  + "\n\n=== ASSUMPTION EXPOSURE ==="
  + "\nExtract EVERY assumption A and B made. For each one:"
  + "\n- Category: MATERIAL / LOAD / GEOMETRY / DEFECT / METHOD / ENVIRONMENT / CODE / REPAIR / OPERATION"
  + "\n- Support: CONFIRMED / PROBABLE / WEAK / UNKNOWN"
  + "\n- Impact if wrong: LOW / MEDIUM / HIGH / CRITICAL"
  + "\nHidden assumptions are forbidden. If A said 'the material is carbon steel' without verification,"
  + " that is a WEAK assumption with potentially CRITICAL impact."
  + "\n\n=== DISCONFIRMING EVIDENCE SEARCH ==="
  + "\nFor every dominant hypothesis from A and B, identify:"
  + "\n- What competing explanation exists?"
  + "\n- What evidence would DISPROVE the dominant hypothesis?"
  + "\n- What tests or observations would resolve the ambiguity?"
  + "\nNo hypothesis may proceed without an active disconfirmation path."
  + "\n\n=== MULTI-HYPOTHESIS PERSISTENCE ==="
  + "\nPrevent premature collapse to a single narrative. Maintain at minimum:"
  + "\n1. Dominant hypothesis"
  + "\n2. Dangerous alternative (different mechanism, worse consequence)"
  + "\n3. Low-probability / high-consequence scenario"
  + "\n4. Data-deficiency hypothesis (what if we simply don't have enough data?)"
  + "\nDo NOT collapse to one answer when a dangerous alternative is unresolved."
  + "\n\n=== CONTRADICTION MATRIX ==="
  + "\nFind contradictions across:"
  + "\n- Physics vs code (A says one thing, code says another)"
  + "\n- Evidence vs conclusion (conclusion not supported by evidence)"
  + "\n- Method vs mechanism (method used can't actually detect claimed mechanism)"
  + "\n- Repair vs constraint (recommended repair is physically or practically impossible)"
  + "\n- Dominant vs alternative (alternative hypothesis has equal evidence strength)"
  + "\nContradictions are NOT cosmetic notes. High-severity contradictions BLOCK final outputs."
  + "\n\n=== EVIDENCE DECAY ==="
  + "\nHow old is the evidence? A thickness reading from 5 years ago is NOT equivalent to one from"
  + " yesterday. A pre-upset inspection report may be completely invalidated by the upset."
  + "\nFlag evidence that may be stale. Degrade its weight in the analysis."
  + "\n\n=== CONSENSUS FRAGILITY ==="
  + "\nIf A and B agree, how FRAGILE is that agreement?"
  + "\nWould one new data point flip the conclusion?"
  + "\nRate fragility: ROBUST (survives any plausible new evidence) / MODERATE / FRAGILE (one"
  + " reading could change everything) / EXTREMELY_FRAGILE"
  + "\n\n=== REALITY DRIFT DETECTION ==="
  + "\nIs the real case drifting from the assumed model?"
  + "\n- New evidence contradicts dominant mechanism?"
  + "\n- Deterioration faster than predicted?"
  + "\n- Inspection methods disagree?"
  + "\n- Service conditions changed since last assessment?"
  + "\n\n=== ANTI-HALLUCINATION ==="
  + "\nDid A or B invent any of the following without evidence?"
  + "\n- Code references or edition years"
  + "\n- Material properties"
  + "\n- Defect sizes or dimensions"
  + "\n- Repair procedures"
  + "\n- Future progression rates"
  + "\nFlag any invented content. The system prefers 'unknown' over polished fiction."
  + "\n\n=== OUTPUT FORMAT (strict JSON) ==="
  + "\nReturn ONLY valid JSON with this structure:"
  + "\n{"
  + "\n  \"assumptions\": [{\"assumption\": \"...\", \"category\": \"...\", \"support\": \"CONFIRMED|PROBABLE|WEAK|UNKNOWN\", \"impact_if_wrong\": \"LOW|MEDIUM|HIGH|CRITICAL\"}],"
  + "\n  \"disconfirming_paths\": [{\"target\": \"...\", \"competing_hypothesis\": \"...\", \"invalidating_evidence\": [\"...\"], \"required_tests\": [\"...\"], \"disconfirmation_strength\": \"NONE|WEAK|MODERATE|STRONG\"}],"
  + "\n  \"hypotheses\": [{\"name\": \"...\", \"type\": \"DOMINANT|DANGEROUS_ALTERNATIVE|LOW_PROB_HIGH_CONSEQUENCE|DATA_DEFICIENCY\", \"evidence_for\": [\"...\"], \"evidence_against\": [\"...\"], \"probability\": \"LOW|MEDIUM|HIGH\", \"consequence_if_true\": \"LOW|MEDIUM|HIGH|CRITICAL\", \"status\": \"OPEN|LEADING|WEAKENED\"}],"
  + "\n  \"contradictions\": [{\"type\": \"...\", \"elements\": [\"...\"], \"severity\": \"LOW|MEDIUM|HIGH|CRITICAL\", \"resolution_required\": true}],"
  + "\n  \"evidence_decay_flags\": [{\"evidence\": \"...\", \"age\": \"...\", \"impact\": \"...\"}],"
  + "\n  \"consensus_fragility\": \"ROBUST|MODERATE|FRAGILE|EXTREMELY_FRAGILE\","
  + "\n  \"fragility_reasoning\": \"...\","
  + "\n  \"hallucination_flags\": [{\"claim\": \"...\", \"source_model\": \"A|B\", \"issue\": \"...\"}],"
  + "\n  \"missing_inputs\": [\"...\"],"
  + "\n  \"challenge_questions\": [\"...\"],"
  + "\n  \"adversarial_confidence\": 0.0"
  + "\n}";

// ================================================================
// RESOLUTION PROMPT (Claude) — Synthesis + Governance
//
// Disciplines encoded:
//   - Traceability
//   - Uncertainty Discipline (8 categories)
//   - Governance Lock
//   - Cross-Domain Analogy
//   - Repair Reality validation
// ================================================================
var RESOLUTION_PROMPT = "You are the RESOLUTION ENGINE for the FORGED NDT Intelligence OS."
  + "\n\nYou receive outputs from three models:"
  + "\n- Model A (Physics): mechanisms, topology, degradation paths"
  + "\n- Model B (Engineering): consequences, codes, repairs, casualty chains"
  + "\n- Model C (Adversarial): assumptions, contradictions, alternative hypotheses, challenges"
  + "\n\nYour job is to SYNTHESIZE a final defensible output that survives all challenges."
  + "\n\n=== TRACEABILITY ==="
  + "\nEvery major conclusion must trace back through:"
  + "\nobservation -> inference -> mechanism -> topology path -> consequence -> constraint -> authority"
  + "\nIf a conclusion has weak traceability, downgrade its confidence."
  + "\nIf a conclusion depends mainly on inference rather than observation, label that explicitly."
  + "\n\n=== UNCERTAINTY DISCIPLINE ==="
  + "\nDo NOT produce a single confidence number. Break uncertainty into 8 categories:"
  + "\n1. Missing data uncertainty"
  + "\n2. Method uncertainty (can the inspection actually detect this?)"
  + "\n3. Model uncertainty (are we applying the right physics model?)"
  + "\n4. Material uncertainty (do we know the actual material state?)"
  + "\n5. Code uncertainty (is the right code being applied?)"
  + "\n6. Progression uncertainty (how fast is this getting worse?)"
  + "\n7. Consequence uncertainty (do we know what happens when it fails?)"
  + "\n8. Repair uncertainty (will the proposed fix actually work?)"
  + "\nEach category scored 0-1. High consequence + high uncertainty = HOLD, not FINAL."
  + "\n\n=== GOVERNANCE LOCK ==="
  + "\nFinal output ONLY allowed if:"
  + "\n- Traceability is sufficient"
  + "\n- Assumptions are exposed"
  + "\n- Dangerous alternatives are addressed"
  + "\n- Physics conflicts resolved or surfaced"
  + "\n- Method blind spots explicit"
  + "\n- Uncertainty allows finalization"
  + "\n- Contradictions below blocking threshold"
  + "\nOtherwise: PROVISIONAL or HOLD."
  + "\n\n=== CROSS-DOMAIN ANALOGY ==="
  + "\nIf reasoning from one domain illuminates this case, use it — but flag that it is an analogy."
  + "\nCoating disbondment logic may inform bondline reasoning. Offshore access constraints may"
  + " inform structural inspection decisions. But cross-domain transfer cannot override domain-specific physics."
  + "\n\n=== OUTPUT FORMAT (strict JSON) ==="
  + "\nReturn ONLY valid JSON with this structure:"
  + "\n{"
  + "\n  \"reality_summary\": \"...\","
  + "\n  \"dominant_hypothesis\": {\"name\": \"...\", \"evidence\": [\"...\"], \"confidence\": 0.0, \"trace\": [\"...\"]},"
  + "\n  \"dangerous_alternative\": {\"name\": \"...\", \"evidence\": [\"...\"], \"consequence_if_true\": \"...\", \"status\": \"OPEN|ADDRESSED|DISPROVEN\"},"
  + "\n  \"data_deficiency_hypothesis\": {\"description\": \"...\", \"what_we_dont_know\": [\"...\"], \"impact\": \"...\"},"
  + "\n  \"key_assumptions\": [{\"assumption\": \"...\", \"support\": \"...\", \"impact_if_wrong\": \"...\"}],"
  + "\n  \"uncertainty_profile\": {"
  + "\n    \"missing_data\": 0.0,"
  + "\n    \"method\": 0.0,"
  + "\n    \"model\": 0.0,"
  + "\n    \"material\": 0.0,"
  + "\n    \"code\": 0.0,"
  + "\n    \"progression\": 0.0,"
  + "\n    \"consequence\": 0.0,"
  + "\n    \"repair\": 0.0"
  + "\n  },"
  + "\n  \"contradiction_resolution\": [{\"contradiction\": \"...\", \"resolution\": \"...\", \"resolved\": true}],"
  + "\n  \"consensus_fragility\": \"ROBUST|MODERATE|FRAGILE|EXTREMELY_FRAGILE\","
  + "\n  \"temporal_projection\": {\"past\": \"...\", \"present\": \"...\", \"near_future\": \"...\", \"long_term\": \"...\", \"if_nothing_done\": \"...\"},"
  + "\n  \"casualty_chain\": {\"initiating_event\": \"...\", \"propagation\": [\"...\"], \"human_impact\": [\"...\"], \"collateral\": [\"...\"], \"breakpoints\": [\"...\"]},"
  + "\n  \"required_actions\": [\"...\"],"
  + "\n  \"code_references\": [\"...\"],"
  + "\n  \"governance_lock\": {"
  + "\n    \"final_allowed\": false,"
  + "\n    \"blocking_reasons\": [\"...\"],"
  + "\n    \"provisional_reasons\": [\"...\"],"
  + "\n    \"required_before_final\": [\"...\"]"
  + "\n  },"
  + "\n  \"final_status\": \"FINAL|PROVISIONAL|HOLD\","
  + "\n  \"severity\": \"LOW|MEDIUM|HIGH|CRITICAL\""
  + "\n}";

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
// MAIN HANDLER
// ================================================================
export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "";
    var startTime = Date.now();

    // --- Registry action (for system-check compatibility) ---
    if (action === "get_registry") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "tri-model-reasoning",
          version: ENGINE_VERSION,
          architecture: "tri-model-adversarial",
          models: {
            A: { role: "physics_engine", provider: "openai", model: "gpt-4o" },
            B: { role: "engineering_code_engine", provider: "anthropic", model: "claude-sonnet-4" },
            C: { role: "adversarial_engine", provider: "openai", model: "gpt-4o" },
            resolution: { role: "synthesis_governance", provider: "anthropic", model: "claude-sonnet-4" }
          },
          reasoning_disciplines: [
            "reality_topology_klein_bottle",
            "physics_dominance",
            "method_reliability_blind_spots",
            "evidence_quality_weighting",
            "inverse_problem_reasoning",
            "inference_from_absence",
            "sensory_fusion",
            "failure_boundary",
            "code_authority",
            "repair_reality",
            "constraint_dominance",
            "casualty_topology_collateral",
            "cascading_asset_graph",
            "temporal_simulation_4d",
            "assumption_exposure",
            "disconfirming_evidence",
            "multi_hypothesis_persistence",
            "contradiction_matrix",
            "evidence_decay",
            "consensus_fragility",
            "reality_drift_detection",
            "anti_hallucination",
            "traceability",
            "uncertainty_discipline_8cat",
            "governance_lock",
            "cross_domain_analogy",
            "phantom_scenario_detection",
            "learning_loop"
          ],
          superbrain_rules: [
            "Never collapse to single answer too early",
            "Never hide assumptions in fluent wording",
            "Never output final without evidence lineage",
            "Never treat tables as substitute for physics",
            "Never assume one method is sufficient",
            "Never ignore low-probability high-consequence",
            "Never treat stale knowledge as authoritative",
            "Never give false precision with missing evidence",
            "Never trust all input sources equally",
            "Never separate damage-evidence-consequence-repair into silos"
          ],
          status: "operational"
        })
      };
    }

    // --- Validate API keys ---
    if (!openaiKey) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "OPENAI_API_KEY not configured" }) };
    if (!anthropicKey) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }) };

    var sb = createClient(supabaseUrl, supabaseKey);
    var caseContext = "";
    var caseId = body.case_id || null;

    // --- Build context from case_id or direct input ---
    if (caseId) {
      var caseRes = await sb.from("inspection_cases").select("*").eq("id", caseId).single();
      if (caseRes.error || !caseRes.data) {
        return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "Case not found" }) };
      }
      var findingsRes = await sb.from("findings").select("*").eq("case_id", caseId);
      var thkRes = await sb.from("thickness_readings").select("*").eq("case_id", caseId);
      var evidenceRes = await sb.from("evidence").select("*").eq("case_id", caseId);
      caseContext = buildCaseContext(caseRes.data, findingsRes.data || [], thkRes.data || [], evidenceRes.data || []);
    } else if (action === "reason" && body.input) {
      caseContext = buildDirectContext(body.input);
    } else {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id or {action:'reason', input:{...}} required" }) };
    }

    // ================================================================
    // STEP 1: MODEL A — Physics Engine (GPT-4o)
    // ================================================================
    var modelAMessage = "Analyze this inspection case using physics-first reasoning."
      + " Build the complete reality topology. Identify ALL active mechanisms."
      + " Trace propagation paths across the full connected system."
      + " Reason backward from evidence to constrain history."
      + " Identify what evidence is absent that should be present."
      + " Evaluate method reliability and blind spots."
      + "\n\n" + caseContext;

    var modelAResp = await callOpenAI(MODEL_A_PROMPT, modelAMessage);
    var modelAOutput = parseAIResponse(modelAResp, "openai");
    var modelATime = Date.now() - startTime;

    // ================================================================
    // STEP 2: MODEL B — Engineering Engine (Claude)
    // ================================================================
    var modelBMessage = "You have the physics analysis from Model A."
      + " Now determine consequences, apply codes, evaluate repair paths,"
      + " model casualty propagation, and simulate the temporal arc."
      + "\n\n=== MODEL A PHYSICS OUTPUT ===\n"
      + JSON.stringify(modelAOutput, null, 2)
      + "\n\n=== ORIGINAL CASE CONTEXT ===\n"
      + caseContext;

    var modelBStart = Date.now();
    var modelBResp = await callClaude(MODEL_B_PROMPT, modelBMessage);
    var modelBOutput = parseAIResponse(modelBResp, "claude");
    var modelBTime = Date.now() - modelBStart;

    // ================================================================
    // STEP 3: MODEL C — Adversarial Engine (GPT-4o)
    // ================================================================
    var modelCMessage = "You have the outputs of Model A (Physics) and Model B (Engineering)."
      + " ATTACK their conclusions. Find every hidden assumption. Search for disconfirming evidence."
      + " Maintain multiple hypotheses. Build the contradiction matrix."
      + " Check for evidence decay. Rate consensus fragility."
      + " Flag any hallucinated content."
      + "\n\n=== MODEL A PHYSICS OUTPUT ===\n"
      + JSON.stringify(modelAOutput, null, 2)
      + "\n\n=== MODEL B ENGINEERING OUTPUT ===\n"
      + JSON.stringify(modelBOutput, null, 2)
      + "\n\n=== ORIGINAL CASE CONTEXT ===\n"
      + caseContext;

    var modelCStart = Date.now();
    var modelCResp = await callOpenAI(MODEL_C_PROMPT, modelCMessage);
    var modelCOutput = parseAIResponse(modelCResp, "openai");
    var modelCTime = Date.now() - modelCStart;

    // ================================================================
    // STEP 4: RESOLUTION — Synthesis + Governance (Claude)
    // ================================================================
    var resolutionMessage = "Synthesize the outputs of all three models into a final defensible output."
      + " Apply traceability, uncertainty discipline, and governance lock."
      + " Preserve dangerous alternatives. Do NOT collapse uncertainty into a single score."
      + " Determine if the output can be FINAL, PROVISIONAL, or must HOLD."
      + "\n\n=== MODEL A (PHYSICS) ===\n"
      + JSON.stringify(modelAOutput, null, 2)
      + "\n\n=== MODEL B (ENGINEERING) ===\n"
      + JSON.stringify(modelBOutput, null, 2)
      + "\n\n=== MODEL C (ADVERSARIAL) ===\n"
      + JSON.stringify(modelCOutput, null, 2)
      + "\n\n=== ORIGINAL CASE CONTEXT ===\n"
      + caseContext;

    var resStart = Date.now();
    var resolutionResp = await callClaude(RESOLUTION_PROMPT, resolutionMessage);
    var resolutionOutput = parseAIResponse(resolutionResp, "claude");
    var resolutionTime = Date.now() - resStart;

    // ================================================================
    // STEP 5: STORE REASONING SESSION
    // ================================================================
    var totalTime = Date.now() - startTime;

    var sessionRecord = {
      case_id: caseId,
      engine_version: ENGINE_VERSION,
      model_a_output: modelAOutput,
      model_b_output: modelBOutput,
      model_c_output: modelCOutput,
      resolution_output: resolutionOutput,
      model_a_ms: modelATime,
      model_b_ms: modelBTime,
      model_c_ms: modelCTime,
      resolution_ms: resolutionTime,
      total_ms: totalTime,
      final_status: resolutionOutput.final_status || "UNKNOWN",
      severity: resolutionOutput.severity || "UNKNOWN",
      created_at: new Date().toISOString()
    };

    // Try to store (table may not exist yet — don't fail the response)
    var storeRes = await sb.from("reasoning_sessions").insert(sessionRecord);
    var stored = !storeRes.error;

    // ================================================================
    // STEP 6: BUILD RESPONSE
    // ================================================================
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        engine: "tri-model-reasoning",
        version: ENGINE_VERSION,
        case_id: caseId,
        generated_at: new Date().toISOString(),
        total_ms: totalTime,
        timing: {
          model_a_ms: modelATime,
          model_b_ms: modelBTime,
          model_c_ms: modelCTime,
          resolution_ms: resolutionTime
        },
        pipeline: {
          model_a: modelAOutput,
          model_b: modelBOutput,
          model_c: modelCOutput,
          resolution: resolutionOutput
        },
        final_output: {
          summary: resolutionOutput.reality_summary || "",
          dominant_hypothesis: resolutionOutput.dominant_hypothesis || null,
          dangerous_alternative: resolutionOutput.dangerous_alternative || null,
          data_deficiency: resolutionOutput.data_deficiency_hypothesis || null,
          severity: resolutionOutput.severity || "UNKNOWN",
          status: resolutionOutput.final_status || "UNKNOWN",
          uncertainty_profile: resolutionOutput.uncertainty_profile || null,
          casualty_chain: resolutionOutput.casualty_chain || null,
          temporal_projection: resolutionOutput.temporal_projection || null,
          required_actions: resolutionOutput.required_actions || [],
          code_references: resolutionOutput.code_references || [],
          governance_lock: resolutionOutput.governance_lock || null,
          consensus_fragility: resolutionOutput.consensus_fragility || "UNKNOWN",
          key_assumptions: resolutionOutput.key_assumptions || [],
          contradiction_resolution: resolutionOutput.contradiction_resolution || []
        },
        stored: stored
      }, null, 2)
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: String(err && err.message ? err.message : err) })
    };
  }
};
