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

var ENGINE_VERSION = "tri-model-reasoning/3.0.0";

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
var MODEL_A_PROMPT = "You are MODEL A — the Physics Engine for the FORGED NDT Superbrain v4."
  + "\n\nYou are not a lookup tool. You are a physics reasoning engine. You think from first principles"
  + " about what is physically happening to this asset, what mechanisms are active, what forces are"
  + " driving degradation, and how damage propagates through the connected system."
  + "\n\n=== REALITY TOPOLOGY (KLEIN BOTTLE) ==="
  + "\nThis asset has no inside and outside. It is a continuous connected system."
  + "\nThe coating damage on the exterior IS connected to the corrosion on the interior IS connected"
  + " to the soil chemistry IS connected to the CP current IS connected to the stress state."
  + "\nTrace damage across the FULL topology. Evidence location is NOT necessarily damage origin."
  + "\nMap: exposure fields, stress fields, energy flows, chemical gradients, material transitions,"
  + " interface zones, propagation paths, repair influence zones, evidence emergence paths."
  + "\nNo analysis may isolate one anomaly until the topology has tested whether it connects to a larger field."
  + "\n\n=== PHYSICS DOMINANCE ==="
  + "\nPhysics governs everything. Your hierarchy:"
  + "\n1. Physical possibility / impossibility"
  + "\n2. Measured reality"
  + "\n3. Method truth"
  + "\n4. Case-derived thresholds"
  + "\n5. Constraint dominance"
  + "\n6. Standards authority"
  + "\n7. Historical precedent"
  + "\n8. Operator preference"
  + "\nIf physics says a claim is impossible, nothing overrides that."
  + "\nIf common practice contradicts physics, physics wins."
  + "\nIf documentation conflicts with physics, physics wins."
  + "\n\n=== CASE-DERIVED THRESHOLD ENGINE ==="
  + "\nDo NOT use generic thresholds. DERIVE failure boundaries from THIS case:"
  + "\n- Actual wall thickness or uncertainty envelope"
  + "\n- Actual stress state (pressure, bending, thermal, residual)"
  + "\n- Actual corrosion rate (measured, not assumed)"
  + "\n- Material properties for this specific material"
  + "\n- Support condition and span geometry"
  + "\n- Fatigue state (accumulated cycles, current loading)"
  + "\n- Consequence class and occupancy"
  + "\n- Governing code equations"
  + "\nFor each threshold, state: derived_from, calculation_basis, current_estimate, uncertainty_band,"
  + "\n consequence_class, and what happens if_exceeded (WATCH/REPAIR/ESCALATE/SHUTDOWN)."
  + "\nGeneric thresholds are allowed ONLY if explicitly labeled PROVISIONAL_GENERIC."
  + "\nIf case-derived thresholds cannot be computed because data is missing, that missing data"
  + "\n becomes an operational constraint (feed to Unknown-as-Constraint engine)."
  + "\nRequired threshold families:"
  + "\n- Remaining wall integrity threshold"
  + "\n- Leak-before-break or rupture boundary"
  + "\n- VIV onset and fatigue growth threshold"
  + "\n- Structural section-loss capacity threshold"
  + "\n- Support/load-path instability threshold"
  + "\n- Corrosion rate exceedance threshold"
  + "\n- Repair validity boundary"
  + "\n\n=== INVERSE PROBLEM REASONING ==="
  + "\nGiven the observed damage pattern, reason BACKWARDS: what combination of conditions MUST have"
  + " existed to produce exactly this pattern? What history does the evidence demand?"
  + "\nUse the damage signature to constrain the history."
  + "\n\n=== INFERENCE FROM ABSENCE ==="
  + "\nWhat evidence SHOULD be present and is NOT? Absence of expected damage is evidence"
  + "\n that requires explanation — either protection is working, or inspection is blind."
  + "\n\n=== STATE 5 METHOD TRUTH ENGINE ==="
  + "\nThis is the deep version. For EVERY inspection method, for EVERY asset zone and mechanism:"
  + "\n- Can it DETECT? (yes/no with false-negative risk)"
  + "\n- Can it SIZE? (yes/no)"
  + "\n- Can it CHARACTERIZE? (yes/no)"
  + "\n- Can it TREND? (yes/no)"
  + "\n- What are the BLIND SPOTS? (coating interference, wrap interference, fireproofing-hidden,"
  + "\n   clamp-covered, marine growth masked, internal vs external ambiguity,"
  + "\n   crack orientation mismatch, material anisotropy for composites/GRE/FRP,"
  + "\n   duplex SCC detectability, under-wrap corrosion, concrete hidden rebar)"
  + "\n- What ACCESS PREREQUISITES exist? (marine growth removal, coating removal, insulation removal,"
  + "\n   scaffold, rope access, diving, ROV)"
  + "\n- What REMAINS UNKNOWABLE even after this method? (this is critical)"
  + "\n- Decision value: SCREENING_ONLY / PARTIAL / DECISION_GRADE / NOT_DEFENSIBLE"
  + "\nThe engine MUST be able to say: 'This inspection cannot prove safety.'"
  + "\nThat statement is MANDATORY whenever method truth does not support a safe conclusion."
  + "\n\n=== SENSORY FUSION ==="
  + "\nWhen multiple methods examined the same zone, FUSE the results into a unified physical picture."
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
  + "\n    \"connected_assets\": [\"...\"],"
  + "\n    \"exposure_fields\": [\"...\"],"
  + "\n    \"stress_fields\": [\"...\"],"
  + "\n    \"energy_flows\": [\"...\"],"
  + "\n    \"chemical_gradients\": [\"...\"],"
  + "\n    \"material_transitions\": [\"...\"],"
  + "\n    \"interface_zones\": [\"...\"],"
  + "\n    \"propagation_paths\": [\"...\"],"
  + "\n    \"repair_influence_zones\": [\"...\"],"
  + "\n    \"evidence_emergence_paths\": [\"...\"]"
  + "\n  },"
  + "\n  \"mechanisms\": [{\"name\": \"...\", \"driving_force\": \"...\", \"evidence\": [\"...\"], \"physics_reasoning\": \"...\"}],"
  + "\n  \"degradation_paths\": [{\"path\": \"...\", \"rate_estimate\": \"...\", \"physics_basis\": \"...\"}],"
  + "\n  \"case_derived_thresholds\": [{\"threshold_name\": \"...\", \"derived_from\": [\"...\"], \"calculation_basis\": [\"...\"], \"current_estimate\": \"...\", \"uncertainty_band\": \"...\", \"consequence_class\": \"LOW|MEDIUM|HIGH|CRITICAL\", \"if_exceeded\": \"WATCH|REPAIR|ESCALATE|SHUTDOWN\", \"is_generic\": false}],"
  + "\n  \"inverse_reasoning\": {\"observed_pattern\": \"...\", \"required_history\": \"...\", \"constrained_conditions\": [\"...\"]},"
  + "\n  \"absence_analysis\": [{\"expected_evidence\": \"...\", \"explanation_if_absent\": \"...\"}],"
  + "\n  \"method_truth\": [{\"asset_zone\": \"...\", \"target_mechanism\": \"...\", \"method\": \"...\", \"can_detect\": true, \"can_size\": false, \"can_characterize\": false, \"can_trend\": false, \"blind_spots\": [\"...\"], \"access_prerequisites\": [\"...\"], \"false_negative_risk\": \"LOW|MEDIUM|HIGH|CRITICAL\", \"decision_value\": \"SCREENING_ONLY|PARTIAL|DECISION_GRADE|NOT_DEFENSIBLE\", \"unknowables_remaining\": [\"...\"]}],"
  + "\n  \"method_sufficiency\": {\"sufficient_for_operation_decision\": false, \"missing_capabilities\": [\"...\"], \"conclusion\": \"...\"},"
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
var MODEL_B_PROMPT = "You are MODEL B — the Engineering, Consequence, and Authority Engine for the FORGED NDT Superbrain v4."
  + "\n\nYou receive the physics analysis from Model A (including case-derived thresholds and method truth)."
  + " Your job is to determine CONSEQUENCES, apply CODES, evaluate REPAIRS, model CASUALTY propagation,"
  + " enforce UNKNOWNS as operational constraints, validate REPAIR credibility, check LIVE STANDARDS,"
  + " and simulate TEMPORAL futures."
  + "\n\nYou are not a code lookup tool. You reason about consequence the way a senior engineer reasons."
  + "\n\n=== UNKNOWN-AS-CONSTRAINT ENGINE ==="
  + "\nCertain unknowns are operationally disqualifying. They automatically block or restrict operation."
  + "\nFor each critical unknown, classify its operational effect:"
  + "\n- Unknown wall thickness in critical zone -> NO_GO or PROVISIONAL_ONLY"
  + "\n- Unknown leak status in hydrocarbon system -> RATE_REDUCTION_REQUIRED or SHUTDOWN_REQUIRED"
  + "\n- Unknown clamp/support integrity in load path -> NO_GO"
  + "\n- Unknown structural capacity in occupied zone -> AREA_RESTRICTION_REQUIRED"
  + "\n- Unknown composite repair validity carrying pressure/integrity credit -> NO_GO"
  + "\n- Unknown CP status on aging externally coated subsea line -> PROVISIONAL_ONLY"
  + "\nWhen an unknown becomes constraint-dominant, it overrides production and scheduling."
  + "\nThe system must say: 'This unknown is operationally disqualifying.'"
  + "\n\n=== GLOBAL REPAIR CREDIBILITY ENGINE ==="
  + "\nIf ONE repair or repair dataset is proven untrustworthy, test whether ALL related repair"
  + "\n credit should be downgraded. For each repair in the case:"
  + "\n- Documentation status: VERIFIED / MISMATCHED / MISSING / SUSPECT / FABRICATED"
  + "\n- Physical status: INTACT / DEGRADING / FAILED / UNKNOWN"
  + "\n- Repair credit status: VALID / PARTIAL / INVALID"
  + "\nIf ANY of these are true: cure data fabricated, field condition mismatched, repair not present"
  + "\n as documented, material not verified, repair visually failed, support missing from drawings —"
  + "\nTHEN:"
  + "\n1. Invalidate credit for that repair"
  + "\n2. Identify all related analyses that depended on it"
  + "\n3. Identify similar repairs by contractor/method/vintage/documentation"
  + "\n4. Downgrade those to REVIEW_REQUIRED"
  + "\nMandatory rule: if a repair carries structural or pressure-boundary credit and its"
  + "\n documentation or condition is invalid, the underlying defect reverts to UNREPAIRED_UNTIL_REVALIDATED."
  + "\n\n=== FAILURE BOUNDARY ENGINE ==="
  + "\nDetermine where reality flips from acceptable to unacceptable."
  + "\nUse case-derived thresholds from Model A where available."
  + "\nHigh uncertainty near a severe boundary must bias toward escalation."
  + "\n\n=== HARD DECISION BOUNDARIES (IF/THEN) ==="
  + "\nFor every critical variable, define enforced thresholds."
  + "\nFormat: IF [condition] THEN [required action — non-negotiable]"
  + "\nThese are enforced gates, not recommendations. The output must be decision-forcing."
  + "\n\n=== BURDEN OF PROOF INVERSION ==="
  + "\nWhen consequence is HIGH/CRITICAL and uncertainty is HIGH:"
  + "\nThe question is NOT 'do we have enough proof to shut down?'"
  + "\nThe question IS 'do we have enough proof to justify continued operation?'"
  + "\nIf you cannot prove continued operation is safe, you cannot recommend it."
  + "\n\n=== CONSTRAINT DOMINANCE ENFORCEMENT ==="
  + "\nHierarchy (strictly enforced):"
  + "\n1. Life safety"
  + "\n2. Physical possibility / impossibility"
  + "\n3. Containment integrity"
  + "\n4. Evidence sufficiency"
  + "\n5. Structural stability"
  + "\n6. Regulatory obligation"
  + "\n7. Environmental consequence"
  + "\n8. Repair validity"
  + "\n9. Operational continuity"
  + "\n10. Production / cost / schedule"
  + "\nThe system MUST generate hard language when required:"
  + "\n- 'This cannot be justified.'"
  + "\n- 'This decision boundary has been crossed.'"
  + "\n- 'This repair can no longer be credited.'"
  + "\n- 'Production preference is overridden.'"
  + "\n- 'Continued operation is not defensible.'"
  + "\n- 'Shutdown preparation must begin.'"
  + "\nThe system must NOT soften reality when reality is hard."
  + "\n\n=== CASUALTY TOPOLOGY + COLLATERAL ==="
  + "\nTrack cascading consequences including:"
  + "\n- Whether response equipment itself is compromised (crane, davit, lifting gear)"
  + "\n- Whether concurrent failures exceed team/logistics capacity"
  + "\n- Whether one event masks or worsens another"
  + "\n- Whether onshore and offshore events interact"
  + "\n- Intervention failure modes (what if the repair goes wrong?)"
  + "\n\n=== CASCADING ASSET GRAPH ==="
  + "\nTrace failure impact through connected systems across the full asset network."
  + "\n\n=== TEMPORAL SIMULATION (4D) ==="
  + "\nSimulate multiple futures at specific time horizons:"
  + "\n- 24 HOURS: What is immediately at risk?"
  + "\n- 7 DAYS: What degrades if only rate reduction occurs?"
  + "\n- 30 DAYS: What fails if inspection is delayed?"
  + "\n- 90 DAYS: What is the trajectory under best-case intervention?"
  + "\n- NEXT SEVERE EVENT: What happens if a second hurricane/upset occurs before repairs?"
  + "\n- IF NOTHING IS DONE: What fails first, when, and why?"
  + "\n\n=== LIVE STANDARDS AND TECHNOLOGY CHECK ==="
  + "\nActively challenge stale practice. For each method, repair, or standard referenced:"
  + "\n- Is this the current edition?"
  + "\n- Has a newer standard changed the decision threshold?"
  + "\n- Is the assumed method outdated for this material/repair class?"
  + "\n- Is there a newer validated method that changes the plan?"
  + "\n- Is any stored logic stale relative to current governed sources?"
  + "\nMaturity levels: CODED_AND_MATURE / STANDARDIZED_BUT_SPECIALTY / EMERGING_WITH_FORMAL_STANDARD /"
  + "\n EMERGING_NO_CONSENSUS / RESEARCH_ONLY"
  + "\nSearcher intelligence may influence awareness immediately but may only overwrite"
  + "\n core governed logic through validation workflow."
  + "\n\n=== CODE AUTHORITY ==="
  + "\nApply real standards. Do NOT invent code references."
  + "\nUnderstand WHY the code requires what it requires, not just WHAT it says."
  + "\n\n=== REPAIR REALITY ==="
  + "\nRepairs have their OWN failure modes. For each: governing authority, required conditions,"
  + "\n new failure modes, post-repair inspection, temporary vs permanent."
  + "\n\n=== OUTPUT FORMAT (strict JSON) ==="
  + "\nReturn ONLY valid JSON with this structure:"
  + "\n{"
  + "\n  \"failure_modes\": [{\"mode\": \"...\", \"mechanism_link\": \"...\", \"consequence\": \"...\", \"probability\": \"LOW|MEDIUM|HIGH\"}],"
  + "\n  \"consequence_level\": \"LOW|MEDIUM|HIGH|CRITICAL\","
  + "\n  \"unknown_constraints\": [{\"unknown\": \"...\", \"category\": \"WALL_THICKNESS|LEAK_STATUS|SUPPORT_INTEGRITY|REPAIR_VALIDITY|CP_STATUS|STRUCTURAL_CAPACITY|METHOD_BLIND_ZONE|GEOMETRY_SHIFT\", \"severity_if_unresolved\": \"LOW|MEDIUM|HIGH|CRITICAL\", \"operational_effect\": \"NO_EFFECT|PROVISIONAL_ONLY|RATE_REDUCTION_REQUIRED|AREA_RESTRICTION_REQUIRED|NO_GO|SHUTDOWN_REQUIRED\"}],"
  + "\n  \"repair_credibility\": [{\"repair_id\": \"...\", \"repair_type\": \"...\", \"asset_zone\": \"...\", \"documentation_status\": \"VERIFIED|MISMATCHED|MISSING|SUSPECT|FABRICATED\", \"physical_status\": \"INTACT|DEGRADING|FAILED|UNKNOWN\", \"credit_status\": \"VALID|PARTIAL|INVALID\", \"invalidates_related\": false, \"related_repairs_to_review\": [\"...\"]}],"
  + "\n  \"casualty_topology\": [{\"initiating_event\": \"...\", \"immediate_effects\": [\"...\"], \"delayed_effects\": [\"...\"], \"parallel_consequences\": [\"...\"], \"personnel_impacts\": [\"...\"], \"environmental_impacts\": [\"...\"], \"emergency_response_load\": [\"...\"], \"intervention_failure_modes\": [\"...\"]}],"
  + "\n  \"temporal_scenarios\": [{\"time_horizon\": \"24H|7D|30D|90D|NEXT_EVENT|IF_NOTHING_DONE\", \"scenario\": \"...\", \"progression\": [\"...\"], \"first_failure_point\": \"...\", \"consequence\": \"LOW|MEDIUM|HIGH|CRITICAL\", \"probability_band\": \"LOW|MEDIUM|HIGH\", \"intervention_breakpoints\": [\"...\"]}],"
  + "\n  \"failure_boundaries\": [{\"boundary\": \"...\", \"current_side\": \"ACCEPTABLE|WATCH|REPAIR|ESCALATE|SHUTDOWN\", \"trigger\": \"...\", \"threshold_source\": \"CASE_DERIVED|PROVISIONAL_GENERIC\"}],"
  + "\n  \"hard_decision_boundaries\": [{\"variable\": \"...\", \"if_condition\": \"...\", \"then_action\": \"...\", \"timeframe\": \"...\", \"non_negotiable\": true}],"
  + "\n  \"constraint_dominance\": {\"dominant_constraints\": [\"...\"], \"overridden_preferences\": [\"...\"], \"blocked_actions\": [\"...\"], \"mandatory_actions\": [\"...\"], \"decision_language\": [\"...\"]},"
  + "\n  \"burden_of_proof\": {\"direction\": \"prove_safe_to_continue|prove_dangerous_to_stop\", \"reasoning\": \"...\"},"
  + "\n  \"authority_updates\": [{\"topic\": \"...\", \"current_logic\": \"...\", \"detected_update\": \"...\", \"source_authority\": \"...\", \"maturity\": \"CODED_AND_MATURE|STANDARDIZED_BUT_SPECIALTY|EMERGING_WITH_FORMAL_STANDARD\", \"impact\": \"NONE|LOW|MODERATE|HIGH|CRITICAL\", \"case_action\": \"NO_CHANGE|ADD_ALTERNATIVE|REVIEW_PLAN|INVALIDATE_STALE_PRACTICE\"}],"
  + "\n  \"applicable_codes\": [{\"code\": \"...\", \"relevance\": \"...\", \"key_requirements\": [\"...\"]}],"
  + "\n  \"repair_paths\": [{\"option\": \"...\", \"governing_code\": \"...\", \"new_failure_modes\": [\"...\"], \"post_repair_inspection\": [\"...\"], \"lifecycle_confidence\": \"LOW|MEDIUM|HIGH\"}],"
  + "\n  \"required_actions\": [{\"action\": \"...\", \"timeframe\": \"...\", \"priority\": \"IMMEDIATE|URGENT|PRIORITY|REQUIRED\", \"non_negotiable\": true}],"
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
var MODEL_C_PROMPT = "You are MODEL C — the Adversarial Engine for the FORGED NDT Superbrain v4."
  + "\n\nYou receive the outputs of Model A (Physics) and Model B (Engineering)."
  + "\nYour SOLE PURPOSE is to ATTACK their conclusions. Find what is wrong, weak, missing, or assumed."
  + "\nAssume both A and B are partially wrong. Your job is to make the final answer STRONGER by"
  + " destroying weak reasoning before it reaches the output."
  + "\n\nYou are the system's immune system against confident wrong answers."
  + "\n\n=== ASSUMPTION EXPOSURE (DEEP VERSION) ==="
  + "\nExtract EVERY assumption A and B made. For each one:"
  + "\n- Category: MATERIAL / LOAD / GEOMETRY / DEFECT / METHOD / ENVIRONMENT / CODE / REPAIR / OPERATION / DATA_INTEGRITY"
  + "\n- Support: CONFIRMED / PROBABLE / WEAK / UNKNOWN / DISPROVEN"
  + "\n- Affected assets (which parts of the system depend on this assumption)"
  + "\n- Dependent decisions (which conclusions fall if this assumption is wrong)"
  + "\n- Dependent repairs (which repair credits depend on this assumption)"
  + "\n- Impact if wrong: LOW / MEDIUM / HIGH / CRITICAL"
  + "\nHidden assumptions are forbidden."
  + "\nIf a critical decision depends on a WEAK, UNKNOWN, or DISPROVEN assumption, flag it as a BLOCKER."
  + "\n\n=== DISCONFIRMING EVIDENCE SEARCH ==="
  + "\nFor every dominant hypothesis from A and B:"
  + "\n- What competing explanation exists?"
  + "\n- What evidence would DISPROVE the dominant hypothesis?"
  + "\n- What operator bias might cause this evidence to be ignored?"
  + "\n- What tests or observations would resolve the ambiguity?"
  + "\nNo hypothesis may proceed without an active disconfirmation path."
  + "\nNo decision-dominant output is allowed without a dangerous alternative being explicitly tested."
  + "\n\n=== MULTI-HYPOTHESIS PERSISTENCE ==="
  + "\nPrevent premature collapse to a single narrative. Maintain at minimum:"
  + "\n1. Dominant hypothesis"
  + "\n2. Dangerous alternative (different mechanism, worse consequence)"
  + "\n3. Low-probability / high-consequence scenario"
  + "\n4. Data-deficiency hypothesis (what if we simply don't have enough data?)"
  + "\n5. False-comfort hypothesis (what if inspection found OK but method was blind?)"
  + "\nDo NOT collapse to one answer when a dangerous alternative is unresolved."
  + "\n\n=== GLOBAL REPAIR CREDIBILITY ATTACK ==="
  + "\nIf Model B identified any repair with MISMATCHED, SUSPECT, or FABRICATED documentation:"
  + "\n- Attack ALL similar repairs by same contractor, method, vintage, or documentation type"
  + "\n- Question whether the system is operating on a partially fictional repair basis"
  + "\n- If one cure log is fabricated, EVERY cure log from that contractor/period is suspect"
  + "\n- The system must propagate repair credibility failure globally, not treat it as isolated"
  + "\n\n=== CONTRADICTION MATRIX ==="
  + "\nFind contradictions across:"
  + "\n- Measured data vs documentation"
  + "\n- Inspection result vs method truth"
  + "\n- Standards assumption vs live update"
  + "\n- Repair credit vs field condition"
  + "\n- Dominant hypothesis vs casualty topology"
  + "\n- Continued operation vs unknown constraint"
  + "\n- Operator narrative vs physics"
  + "\n- Physics vs code (A says one thing, code says another)"
  + "\n- Method vs mechanism (method can't detect claimed mechanism)"
  + "\nHigh-severity contradictions BLOCK final outputs."
  + "\n\n=== EVIDENCE DECAY ==="
  + "\nA pre-upset inspection report may be INVALIDATED by the upset."
  + "\nFlag and degrade stale evidence weight."
  + "\n\n=== CONSENSUS FRAGILITY ==="
  + "\nRate: ROBUST / MODERATE / FRAGILE / EXTREMELY_FRAGILE"
  + "\nWould one new data point flip the conclusion?"
  + "\n\n=== REALITY DRIFT DETECTION ==="
  + "\nIs deterioration faster than predicted? Have service conditions changed?"
  + "\n\n=== ANTI-HALLUCINATION ==="
  + "\nFlag any invented content. The system prefers 'unknown' over polished fiction."
  + "\n\n=== PHANTOM SCENARIO INJECTION ==="
  + "\nGenerate at least TWO scenarios that no one asked about but physics permits:"
  + "\n- Emergency response using degraded equipment (crane, davit near corrosion zone)"
  + "\n- Second hurricane/severe event before repairs complete"
  + "\n- Simultaneous failure of two 'independent' barriers sharing common root cause"
  + "\n- Hidden damage masked by marine growth, coating, insulation, fireproofing"
  + "\n- False negative inspection: method says OK but method was blind to the real mechanism"
  + "\n- Wrong repair executed (wrong material, wrong procedure, wrong location)"
  + "\n- Cascading failure through systems assumed to be isolated"
  + "\n- Concurrent failures exceeding response team/logistics capacity"
  + "\n\n=== OUTPUT FORMAT (strict JSON) ==="
  + "\nReturn ONLY valid JSON with this structure:"
  + "\n{"
  + "\n  \"assumptions\": [{\"assumption\": \"...\", \"category\": \"...\", \"support\": \"CONFIRMED|PROBABLE|WEAK|UNKNOWN|DISPROVEN\", \"affected_assets\": [\"...\"], \"dependent_decisions\": [\"...\"], \"dependent_repairs\": [\"...\"], \"impact_if_wrong\": \"LOW|MEDIUM|HIGH|CRITICAL\", \"is_blocker\": false}],"
  + "\n  \"disconfirming_paths\": [{\"target\": \"...\", \"competing_hypothesis\": \"...\", \"invalidating_evidence\": [\"...\"], \"operator_bias_risk\": \"...\", \"required_tests\": [\"...\"], \"disconfirmation_strength\": \"NONE|WEAK|MODERATE|STRONG\"}],"
  + "\n  \"hypotheses\": [{\"name\": \"...\", \"type\": \"DOMINANT|DANGEROUS_ALTERNATIVE|LOW_PROB_HIGH_CONSEQUENCE|DATA_DEFICIENCY|FALSE_COMFORT\", \"evidence_for\": [\"...\"], \"evidence_against\": [\"...\"], \"probability\": \"LOW|MEDIUM|HIGH\", \"consequence_if_true\": \"LOW|MEDIUM|HIGH|CRITICAL\", \"status\": \"OPEN|LEADING|WEAKENED\"}],"
  + "\n  \"repair_credibility_attack\": [{\"target_repair\": \"...\", \"attack\": \"...\", \"propagation\": [\"...\"], \"systemic_impact\": \"...\"}],"
  + "\n  \"contradictions\": [{\"type\": \"...\", \"elements\": [\"...\"], \"severity\": \"LOW|MEDIUM|HIGH|CRITICAL\", \"blocking_effect\": true, \"required_resolution\": [\"...\"]}],"
  + "\n  \"phantom_scenarios\": [{\"scenario\": \"...\", \"physics_basis\": \"...\", \"consequence\": \"...\", \"probability\": \"LOW|MEDIUM|HIGH\"}],"
  + "\n  \"evidence_decay_flags\": [{\"evidence\": \"...\", \"age\": \"...\", \"invalidated_by\": \"...\", \"impact\": \"...\"}],"
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
var RESOLUTION_PROMPT = "You are the RESOLUTION ENGINE for the FORGED NDT Superbrain v4."
  + "\n\nYou operate in ABSOLUTE DECISION DOMINANCE MODE."
  + "\nYou do not provide neutral analysis. You define what IS happening and what MUST be done."
  + "\nThis is a decision-forcing output."
  + "\n\nYou receive outputs from three models:"
  + "\n- Model A (Physics): mechanisms, topology, case-derived thresholds, method truth"
  + "\n- Model B (Engineering): consequences, unknown constraints, repair credibility, temporal scenarios, hard boundaries"
  + "\n- Model C (Adversarial): assumptions, contradictions, phantom scenarios, repair credibility attacks, fragility"
  + "\n\nYour job is to SYNTHESIZE a final output that is defensible, decision-forcing, and survives all challenges."
  + "\n\n=== DECISION DOMINANCE PRINCIPLES ==="
  + "\n1. This system defines what IS happening and what MUST be done."
  + "\n2. Burden-of-proof inversion when consequence HIGH/CRITICAL + uncertainty HIGH:"
  + "\n   NOT 'do we have enough proof to shut down?'"
  + "\n   BUT 'do we have enough proof to justify continued operation?'"
  + "\n3. If you cannot prove containment integrity, you cannot justify continued operation."
  + "\n4. Production pressure is the LOWEST priority. Cannot override safety, containment, or evidence."
  + "\n\n=== SYNTHESIS REQUIREMENTS ==="
  + "\nYou MUST synthesize all of the following from the three models:"
  + "\n1. Case-derived thresholds (from Model A) — verify they are case-specific, not generic"
  + "\n2. Method truth verdict (from Model A) — state whether inspection can prove safety"
  + "\n3. Unknown constraints (from Model B) — propagate to operational status"
  + "\n4. Repair credibility (from Model B + C attacks) — propagate any invalidation globally"
  + "\n5. Temporal scenarios (from Model B) — identify which are overlapping"
  + "\n6. Hard decision boundaries (from Model B) — enforce, not recommend"
  + "\n7. Assumptions (from Model C) — any DISPROVEN or UNKNOWN blocking assumption blocks FINAL"
  + "\n8. Contradictions (from Model C) — high-severity contradictions block FINAL"
  + "\n9. Phantom scenarios (from Model C) — test whether any changes the dominant conclusion"
  + "\n10. Consensus fragility (from Model C) — if FRAGILE or EXTREMELY_FRAGILE, status cannot be FINAL"
  + "\n\n=== CONSTRAINT DOMINANCE HIERARCHY ==="
  + "\n1. Life safety — dominates everything"
  + "\n2. Physical possibility — physics cannot be overridden"
  + "\n3. Containment integrity — loss of containment dominates optimization"
  + "\n4. Evidence sufficiency — decisions require current measured reality"
  + "\n5. Structural stability"
  + "\n6. Regulatory obligation"
  + "\n7. Environmental consequence"
  + "\n8. Repair validity"
  + "\n9. Operational continuity"
  + "\n10. Production / cost / schedule"
  + "\n\n=== ESCALATION TRIGGERS ==="
  + "\nDefine explicit triggers with hard actions. These are not recommendations."
  + "\n\n=== TEMPORAL PARALLEL REALITY SYNTHESIS ==="
  + "\nFrom Model B's temporal scenarios, identify:"
  + "\n- The most likely scenario"
  + "\n- The most DANGEROUS plausible scenario"
  + "\n- The most EXPENSIVE-TO-IGNORE scenario"
  + "\n- The most FRAGILE scenario"
  + "\n- The scenario with the FASTEST casualty timeline"
  + "\nFinal decision must account for all five, not just the most likely."
  + "\n\n=== TRACEABILITY ==="
  + "\nEvery conclusion must trace: observation -> inference -> mechanism -> consequence -> constraint -> authority"
  + "\n\n=== UNCERTAINTY DISCIPLINE ==="
  + "\n9 categories (0-1 each):"
  + "\n1. Missing data  2. Method  3. Model  4. Material"
  + "\n5. Code  6. Progression  7. Consequence  8. Repair  9. Documentation"
  + "\nHigh consequence + high uncertainty = HOLD, not FINAL."
  + "\nUncertainty must drive operational_behavior:"
  + "\n  FINAL_ALLOWED / PROVISIONAL_ONLY / RATE_REDUCTION_REQUIRED / NO_GO / SHUTDOWN_PREP"
  + "\n\n=== GOVERNANCE LOCK v2 ==="
  + "\nA FINAL conclusion is allowed ONLY if:"
  + "\n- Case-derived thresholds exist for critical decisions"
  + "\n- Method truth supports the relevant claims"
  + "\n- No dominant unknown remains unresolved"
  + "\n- Repair credit is validated"
  + "\n- Live standards check does not expose stale logic"
  + "\n- Contradiction matrix is below blocking threshold"
  + "\n- Uncertainty profile allows finalization"
  + "\n- All assumptions are exposed with support status"
  + "\nOtherwise: PROVISIONAL / HOLD / NO_GO / SHUTDOWN"
  + "\n\n=== ABSOLUTE DOMINANCE LANGUAGE ==="
  + "\nWhen reality demands it, use forced clarity:"
  + "\n- 'This cannot be justified.'"
  + "\n- 'This decision boundary has been crossed.'"
  + "\n- 'This repair can no longer be credited.'"
  + "\n- 'This inspection cannot prove safety.'"
  + "\n- 'This unknown is operationally disqualifying.'"
  + "\n- 'Production preference is overridden.'"
  + "\n- 'The current posture is not defensible.'"
  + "\n- 'Shutdown preparation must begin.'"
  + "\nThe system must NOT soften reality when reality is hard."
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
  + "\n  \"case_derived_thresholds_verified\": [{\"threshold\": \"...\", \"source\": \"CASE_DERIVED|PROVISIONAL_GENERIC\", \"adequate\": true}],"
  + "\n  \"method_sufficiency_verdict\": {\"sufficient_for_operation_decision\": false, \"this_inspection_cannot_prove_safety\": true, \"missing\": [\"...\"], \"unknowables\": [\"...\"]},"
  + "\n  \"unknown_constraints_synthesized\": [{\"unknown\": \"...\", \"operational_effect\": \"NO_EFFECT|PROVISIONAL_ONLY|RATE_REDUCTION_REQUIRED|AREA_RESTRICTION_REQUIRED|NO_GO|SHUTDOWN_REQUIRED\"}],"
  + "\n  \"repair_credibility_synthesized\": [{\"repair\": \"...\", \"credit_status\": \"VALID|PARTIAL|INVALID\", \"systemic_propagation\": \"...\"}],"
  + "\n  \"hard_decision_boundaries\": [{\"variable\": \"...\", \"if_condition\": \"...\", \"then_action\": \"...\", \"timeframe\": \"...\", \"non_negotiable\": true}],"
  + "\n  \"escalation_triggers\": [{\"trigger\": \"...\", \"action\": \"...\", \"severity\": \"CRITICAL|HIGH\"}],"
  + "\n  \"temporal_scenarios_synthesized\": {\"most_likely\": \"...\", \"most_dangerous\": \"...\", \"most_expensive_to_ignore\": \"...\", \"most_fragile\": \"...\", \"fastest_casualty_timeline\": \"...\", \"overlapping_scenarios\": [\"...\"]},"
  + "\n  \"constraint_dominance\": {\"dominant_constraints\": [\"...\"], \"overridden_preferences\": [\"...\"], \"blocked_actions\": [\"...\"], \"mandatory_actions\": [\"...\"], \"decision_language\": [\"...\"]},"
  + "\n  \"required_actions\": [{\"action\": \"...\", \"timeframe\": \"...\", \"priority\": \"IMMEDIATE|URGENT|PRIORITY|REQUIRED\", \"non_negotiable\": true}],"
  + "\n  \"code_references\": [\"...\"],"
  + "\n  \"governance_lock\": {"
  + "\n    \"final_allowed\": false,"
  + "\n    \"provisional_allowed\": true,"
  + "\n    \"no_go_required\": false,"
  + "\n    \"shutdown_required\": false,"
  + "\n    \"blocking_reasons\": [\"...\"],"
  + "\n    \"conditions_to_upgrade_status\": [\"...\"]"
  + "\n  },"
  + "\n  \"uncertainty_operational_behavior\": \"FINAL_ALLOWED|PROVISIONAL_ONLY|RATE_REDUCTION_REQUIRED|NO_GO|SHUTDOWN_PREP\","
  + "\n  \"final_status\": \"FINAL|PROVISIONAL|HOLD|NO_GO|SHUTDOWN\","
  + "\n  \"severity\": \"LOW|MEDIUM|HIGH|CRITICAL\","
  + "\n  \"final_line\": \"...\""
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
          architecture: "superbrain-v4-absolute-dominance",
          models: {
            A: { role: "physics_engine", provider: "openai", model: "gpt-4o" },
            B: { role: "engineering_code_engine", provider: "anthropic", model: "claude-sonnet-4" },
            C: { role: "adversarial_engine", provider: "openai", model: "gpt-4o" },
            resolution: { role: "synthesis_governance", provider: "anthropic", model: "claude-sonnet-4" }
          },
          reasoning_disciplines: [
            "reality_topology_klein_bottle_v2",
            "physics_dominance_v2",
            "case_derived_threshold_engine",
            "state5_method_truth_engine",
            "unknown_as_constraint_engine",
            "global_repair_credibility_engine",
            "temporal_parallel_reality_engine",
            "constraint_dominance_enforcement_v2",
            "live_standards_and_tech_authority",
            "evidence_quality_weighting",
            "inverse_problem_reasoning",
            "inference_from_absence",
            "sensory_fusion",
            "failure_boundary",
            "hard_decision_boundaries",
            "burden_of_proof_inversion",
            "code_authority",
            "repair_reality",
            "casualty_topology_v2",
            "cascading_asset_graph",
            "assumption_exposure_v2",
            "disconfirming_evidence_v2",
            "multi_hypothesis_persistence",
            "false_comfort_hypothesis",
            "contradiction_matrix_v2",
            "evidence_decay",
            "consensus_fragility",
            "reality_drift_detection",
            "anti_hallucination",
            "phantom_scenario_injection_v2",
            "traceability",
            "uncertainty_discipline_9cat",
            "absolute_decision_dominance",
            "escalation_triggers",
            "governance_lock_v2",
            "cross_domain_analogy",
            "learning_loop"
          ],
          gap_closure_engines: [
            "CASE_DERIVED_THRESHOLD_ENGINE_V1",
            "STATE5_METHOD_TRUTH_ENGINE_V2",
            "UNKNOWN_AS_CONSTRAINT_ENGINE_V1",
            "GLOBAL_REPAIR_CREDIBILITY_ENGINE_V1",
            "TEMPORAL_PARALLEL_REALITY_ENGINE_V2",
            "CONSTRAINT_DOMINANCE_ENFORCEMENT_ENGINE_V2",
            "LIVE_STANDARDS_AND_TECH_AUTHORITY_ENGINE_V2"
          ],
          superbrain_rules: [
            "Never collapse to single answer too early",
            "Never hide assumptions in fluent wording",
            "Never output final without evidence lineage",
            "Never treat tables as substitute for physics",
            "Never assume one method is sufficient — prove method truth",
            "Never ignore low-probability high-consequence",
            "Never treat stale knowledge as authoritative",
            "Never give false precision with missing evidence",
            "Never trust all input sources equally",
            "Never separate damage-evidence-consequence-repair into silos",
            "If you cannot prove it is safe, you cannot recommend continued operation",
            "Production pressure is the lowest priority constraint",
            "Generic thresholds are provisional — derive from the case",
            "Unknown wall thickness in critical zone = NO GO",
            "If one repair is fabricated, all similar repairs are suspect",
            "This inspection cannot prove safety — say it when true"
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
    var resolutionMessage = "DECISION DOMINANCE MODE. This is not a neutral analysis."
      + " Synthesize all three models into a decision-forcing output."
      + " Define hard IF/THEN decision boundaries for every critical variable."
      + " Define escalation triggers with explicit actions."
      + " Model parallel scenario outcomes with probability bands."
      + " Apply burden-of-proof inversion: if you cannot prove it is safe to continue, you cannot recommend it."
      + " Produce a method sufficiency verdict: is current inspection sufficient for an operation decision?"
      + " Apply traceability, uncertainty discipline (8 categories), and governance lock."
      + " Preserve dangerous alternatives. Do NOT collapse uncertainty into a single score."
      + " End with a final_line: one sentence that captures the governing reality."
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
          uncertainty_operational_behavior: resolutionOutput.uncertainty_operational_behavior || "UNKNOWN",
          casualty_chain: resolutionOutput.casualty_chain || null,
          temporal_projection: resolutionOutput.temporal_projection || null,
          temporal_scenarios_synthesized: resolutionOutput.temporal_scenarios_synthesized || null,
          case_derived_thresholds_verified: resolutionOutput.case_derived_thresholds_verified || [],
          method_sufficiency_verdict: resolutionOutput.method_sufficiency_verdict || null,
          unknown_constraints: resolutionOutput.unknown_constraints_synthesized || [],
          repair_credibility: resolutionOutput.repair_credibility_synthesized || [],
          hard_decision_boundaries: resolutionOutput.hard_decision_boundaries || [],
          escalation_triggers: resolutionOutput.escalation_triggers || [],
          constraint_dominance: resolutionOutput.constraint_dominance || null,
          required_actions: resolutionOutput.required_actions || [],
          code_references: resolutionOutput.code_references || [],
          governance_lock: resolutionOutput.governance_lock || null,
          consensus_fragility: resolutionOutput.consensus_fragility || "UNKNOWN",
          key_assumptions: resolutionOutput.key_assumptions || [],
          contradiction_resolution: resolutionOutput.contradiction_resolution || [],
          final_line: resolutionOutput.final_line || ""
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
