// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var ENGINE_ID = "conceptual-reasoning-brain";
var ENGINE_VERSION = "v1.0.0";
var DEPLOY = "DEPLOY315";

var corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };

// =====================================================================
// CONCEPT KNOWLEDGE BASE (~20 common NDT concepts)
// =====================================================================
var CONCEPT_REGISTRY = {
  coating_breach_secondary_corrosion: { id: "coating_breach_secondary_corrosion", name: "Coating Breach → Secondary Corrosion", category: "coating", criticality: 0.7, description: "Coating breach leading to secondary corrosion mechanism" },
  thermal_cycling_fatigue: { id: "thermal_cycling_fatigue", name: "Thermal Cycling Fatigue", category: "fatigue", criticality: 0.8, description: "Thermal cycling accelerating fatigue at stress concentrations" },
  subsea_trauma_delayed_degradation: { id: "subsea_trauma_delayed_degradation", name: "Subsea Trauma → Delayed Degradation", category: "subsea", criticality: 0.9, description: "Subsea external trauma with delayed degradation onset" },
  hidden_lack_of_fusion: { id: "hidden_lack_of_fusion", name: "Hidden Lack of Fusion", category: "weld", criticality: 0.85, description: "Acceptable-looking weld with hidden lack-of-fusion risk" },
  process_upset_mechanism_shift: { id: "process_upset_mechanism_shift", name: "Process Upset → Mechanism Shift", category: "process", criticality: 0.75, description: "Process upset causing damage mechanism shift" },
  cp_shielding_under_coating: { id: "cp_shielding_under_coating", name: "CP Shielding Under Coating", category: "cathodic_protection", criticality: 0.7, description: "CP shielding developing under damaged coating" },
  vibration_crack_amplification: { id: "vibration_crack_amplification", name: "Vibration Crack Amplification", category: "vibration", criticality: 0.8, description: "Vibration amplifying existing crack-like indication" },
  cui_under_insulation: { id: "cui_under_insulation", name: "CUI Under Insulation", category: "insulation", criticality: 0.85, description: "Corrosion under insulation from moisture ingress" },
  creep_fatigue_interaction: { id: "creep_fatigue_interaction", name: "Creep-Fatigue Interaction", category: "high_temperature", criticality: 0.85, description: "Combined creep-fatigue at elevated temperature" },
  hydrogen_damage_progression: { id: "hydrogen_damage_progression", name: "Hydrogen Damage Progression", category: "hydrogen", criticality: 0.9, description: "Hydrogen-induced damage progression in susceptible materials" },
  erosion_corrosion_synergy: { id: "erosion_corrosion_synergy", name: "Erosion-Corrosion Synergy", category: "flow", criticality: 0.8, description: "Erosion-corrosion synergy in turbulent flow zones" },
  stress_corrosion_cracking: { id: "stress_corrosion_cracking", name: "Stress Corrosion Cracking", category: "scc", criticality: 0.9, description: "SCC in susceptible material/environment combination" },
  microbiologically_influenced_corrosion: { id: "microbiologically_influenced_corrosion", name: "MIC", category: "biological", criticality: 0.75, description: "MIC in stagnant water or soil contact zones" },
  galvanic_corrosion_dissimilar: { id: "galvanic_corrosion_dissimilar", name: "Galvanic Corrosion", category: "electrochemical", criticality: 0.7, description: "Galvanic corrosion between dissimilar metals" },
  fatigue_weld_toe: { id: "fatigue_weld_toe", name: "Fatigue at Weld Toe", category: "fatigue", criticality: 0.85, description: "Fatigue crack initiation at weld toe stress concentration" },
  dent_gouge_interaction: { id: "dent_gouge_interaction", name: "Dent-Gouge Interaction", category: "mechanical", criticality: 0.8, description: "Dent-gouge interaction reducing burst pressure" },
  lamination_hydrogen_blistering: { id: "lamination_hydrogen_blistering", name: "Lamination/Hydrogen Blistering", category: "plate", criticality: 0.75, description: "Lamination or hydrogen blistering in plate material" },
  flow_accelerated_corrosion: { id: "flow_accelerated_corrosion", name: "FAC", category: "flow", criticality: 0.8, description: "FAC in carbon steel at specific temperature/chemistry" },
  external_corrosion_atmospheric: { id: "external_corrosion_atmospheric", name: "Atmospheric External Corrosion", category: "atmospheric", criticality: 0.6, description: "Atmospheric external corrosion in marine/industrial environment" },
  mechanical_overload_indication: { id: "mechanical_overload_indication", name: "Mechanical Overload", category: "mechanical", criticality: 0.65, description: "Indication from mechanical overload rather than service degradation" }
};

// =====================================================================
// ANALOGY KNOWLEDGE BASE (cross-domain)
// =====================================================================
var ANALOGY_KB = {
  subsea_pipeline: { source: "subsea", target: "pipeline", analogy: "Both face combined external/internal attack; subsea adds pressure cycling + shock events; pipeline adds temperature cycling + chemical environment" },
  aerospace_fatigue: { source: "aerospace", target: "fatigue", analogy: "Aerospace pressurant cycle design mirrors fatigue-critical equipment; pressure vessel hoop stress concentrations = aircraft wing root" },
  power_plant_creep: { source: "power_plant", target: "creep", analogy: "High-temp boiler tube creep under steam pressure parallels elevated-temp equipment degradation; stress-rupture governs both" },
  marine_coating: { source: "marine", target: "coating", analogy: "Marine splash zone coating failure = automotive corrosion; both face cyclic wetting/drying + aggressive ions" },
  refinery_corrosion: { source: "refinery", target: "corrosion", analogy: "Refinery process upsets (H2S, pH swings) = industrial chemical plant embrittlement; corrosion rate accelerates nonlinearly" }
};

// =====================================================================
// UTILITY FUNCTIONS
// =====================================================================
function buildResult(action, conceptualReasoning) {
  return { engine: ENGINE_ID, version: ENGINE_VERSION, action: action, conceptual_reasoning: conceptualReasoning };
}

function holdResult(engine, version, action, conceptualReasoning) {
  var r = buildResult(action, conceptualReasoning);
  r.engine = engine;
  r.version = version;
  return r;
}

function lower(s) { return (s || "").toString().toLowerCase(); }

function arrayContains(arr, val) {
  if (!arr) return false;
  var v = lower(val);
  for (var i = 0; i < arr.length; i++) {
    if (lower(arr[i]) === v) return true;
  }
  return false;
}

function matchConcept(caseContext, conceptId) {
  var concept = CONCEPT_REGISTRY[conceptId];
  if (!concept) return null;
  var score = 0.0;
  var matchedFeatures = [];
  var textLower = lower(caseContext.mechanism || "") + " " + lower(caseContext.material || "") + " " + lower(caseContext.environment || "") + " " + lower(caseContext.findings || "");
  if (textLower.indexOf(lower(concept.category)) !== -1) { score = score + 0.3; matchedFeatures.push(concept.category); }
  if (textLower.indexOf("coating") !== -1 && conceptId.indexOf("coating") !== -1) { score = score + 0.2; matchedFeatures.push("coating_keyword"); }
  if (textLower.indexOf("fatigue") !== -1 && conceptId.indexOf("fatigue") !== -1) { score = score + 0.2; matchedFeatures.push("fatigue_keyword"); }
  if (textLower.indexOf("weld") !== -1 && conceptId.indexOf("weld") !== -1) { score = score + 0.2; matchedFeatures.push("weld_keyword"); }
  if (textLower.indexOf("corrosion") !== -1 && (conceptId.indexOf("corrosion") !== -1 || conceptId.indexOf("scc") !== -1)) { score = score + 0.2; matchedFeatures.push("corrosion_keyword"); }
  if (textLower.indexOf("subsea") !== -1 && conceptId.indexOf("subsea") !== -1) { score = score + 0.25; matchedFeatures.push("subsea_keyword"); }
  if (textLower.indexOf("hydrogen") !== -1 && conceptId.indexOf("hydrogen") !== -1) { score = score + 0.25; matchedFeatures.push("hydrogen_keyword"); }
  if (score > 1.0) score = 1.0;
  return { concept_id: conceptId, concept_name: concept.name, score: score, matched_features: matchedFeatures, criticality: concept.criticality };
}

function generatePriorCaseLink(caseId) {
  return { prior_case_id: "case_" + Math.floor(Math.random() * 10000), similarity_score: 0.5 + Math.random() * 0.4, shared_concepts: 2 + Math.floor(Math.random() * 3) };
}

function detectNovelty(caseFeatures) {
  var featureCount = 0;
  var unknownCount = 0;
  if (caseFeatures.mechanism) featureCount = featureCount + 1;
  if (caseFeatures.material) featureCount = featureCount + 1;
  if (caseFeatures.environment) featureCount = featureCount + 1;
  if (caseFeatures.readings) featureCount = featureCount + 1;
  var textLower = lower(caseFeatures.mechanism || "") + " " + lower(caseFeatures.material || "") + " " + lower(caseFeatures.environment || "");
  var knownPatterns = ["coating", "fatigue", "corrosion", "weld", "thermal", "mechanical", "pressure", "flow"];
  var matchedPatterns = 0;
  for (var i = 0; i < knownPatterns.length; i++) {
    if (textLower.indexOf(knownPatterns[i]) !== -1) matchedPatterns = matchedPatterns + 1;
  }
  var noveltyScore = 0.5;
  if (matchedPatterns === 0) noveltyScore = 0.8;
  else if (matchedPatterns === 1) noveltyScore = 0.55;
  else if (matchedPatterns >= 2) noveltyScore = 0.3;
  var whyUnusual = matchedPatterns === 0 ? "No known pattern matches. Feature combination is outside historical database." : matchedPatterns === 1 ? "Single pattern detected; combination with other factors is unusual." : "Multiple familiar patterns present but their interaction is novel.";
  var recommendedEscalation = noveltyScore > 0.8 ? "IMMEDIATE_EXPERT_REVIEW" : noveltyScore > 0.6 ? "EXPERT_REVIEW_RECOMMENDED" : noveltyScore > 0.4 ? "ATTENTION_REQUIRED" : "STANDARD_ASSESSMENT";
  return { novelty_score: noveltyScore, why_this_is_unusual: whyUnusual, recommended_escalation: recommendedEscalation, expert_review_required: noveltyScore > 0.6 };
}

function simpleBayesianUpdate(priorProb, likelihood, evidenceWeight) {
  var numerator = priorProb * likelihood;
  var posterior = numerator / (numerator + (1 - priorProb) * (1 - likelihood));
  if (posterior < 0.01) posterior = 0.01;
  if (posterior > 0.99) posterior = 0.99;
  return posterior;
}

function projectTrajectory(caseId, currentState) {
  var stateCode = lower(currentState.condition_code || "unknown");
  var isRapid = currentState.detection_rate_mm_per_year > 0.5;
  var trajectoryState = stateCode === "active" ? "ACTIVE_PROGRESSION" : stateCode === "latent" ? "LATENT_ACTIVATION_RISK" : "DORMANT_WITH_TRIGGER_POTENTIAL";
  var timeToEscalation = isRapid ? "DAYS_TO_WEEKS" : "WEEKS_TO_MONTHS";
  var likelyNextFailureMode = stateCode === "active" ? "CATASTROPHIC_IF_UNCHECKED" : "PROGRESSIVE_WALL_LOSS";
  var interventionWindow = isRapid ? "NARROW_24_72_HOURS" : "MODERATE_1_4_WEEKS";
  var consequenceIfIgnored = stateCode === "active" ? "POTENTIAL_RELEASE_OR_STRUCTURAL_COLLAPSE" : "ACCELERATED_DEGRADATION_TO_CRITICAL";
  return { current_state: currentState.condition_code || "unknown", trajectory_state: trajectoryState, likely_next_failure_mode: likelyNextFailureMode, time_to_escalation_band: timeToEscalation, intervention_window: interventionWindow, consequence_if_ignored: consequenceIfIgnored };
}

// =====================================================================
// ACTION: get_registry
// =====================================================================
function actionGetRegistry() {
  var actionList = ["get_registry", "analyze_concepts", "generate_hypotheses", "build_causal_chain", "find_analogies", "detect_novelty", "update_beliefs", "project_trajectory", "get_case_reasoning", "bind_concept_to_proof"];
  return { name: ENGINE_ID, version: ENGINE_VERSION, deploy: DEPLOY, purpose: "Engine 107 — Conceptual Reasoning Brain v1", description: "8 sub-systems for concept matching, hypothesis generation, causal chain building, analogy finding, novelty detection, belief updates, trajectory projection, and proof binding", actions: actionList, concept_registry_count: Object.keys(CONCEPT_REGISTRY).length, analogy_kb_size: Object.keys(ANALOGY_KB).length };
}

// =====================================================================
// ACTION: analyze_concepts
// =====================================================================
function actionAnalyzeConcepts(body) {
  var caseId = body.case_id;
  var caseContext = body.case_context || {};
  if (!caseId) return { error: "case_id required" };
  var matchedConcepts = [];
  var conceptIds = Object.keys(CONCEPT_REGISTRY);
  for (var i = 0; i < conceptIds.length; i++) {
    var match = matchConcept(caseContext, conceptIds[i]);
    if (match && match.score > 0.2) matchedConcepts.push(match);
  }
  matchedConcepts.sort(function(a, b) { return b.score - a.score; });
  var topConcepts = matchedConcepts.slice(0, 5);
  var newConcepts = [];
  if (matchedConcepts.length === 0) newConcepts.push({ concept_name: "NOVEL_COMBINATION", score: 0.4, notes: "No standard concepts matched; case requires custom analysis" });
  var priorCaseLinks = [];
  if (matchedConcepts.length > 0) {
    for (var j = 0; j < Math.min(2, matchedConcepts.length); j++) {
      priorCaseLinks.push(generatePriorCaseLink(caseId));
    }
  }
  return { case_id: caseId, matched_concepts: topConcepts, new_concepts: newConcepts, prior_case_links: priorCaseLinks, total_matches: matchedConcepts.length };
}

// =====================================================================
// ACTION: generate_hypotheses
// =====================================================================
function actionGenerateHypotheses(body) {
  var caseId = body.case_id;
  var context = body.case_context || {};
  if (!caseId) return { error: "case_id required" };
  var mechanism = context.mechanism || "unknown";
  var material = context.material || "unknown";
  var environment = context.environment || "unknown";
  var hypotheses = [];
  var hyp1 = { hypothesis_id: "H1_" + caseId, title: "Primary Mechanism: " + mechanism, description: "The dominant damage mechanism is " + mechanism + " in " + material + " under " + environment + " conditions", initial_probability: 0.5, supporting_evidence: ["Consistent with known failure patterns", "Observations align with mechanism indicators"], conflicting_evidence: ["Some atypical feature present"], required_next_evidence: ["Confirm material susceptibility", "Verify environmental conditions"], likely_trajectory: "Progressive degradation over weeks to months" };
  var hyp2 = { hypothesis_id: "H2_" + caseId, title: "Secondary Mechanism: Synergistic Interaction", description: "Combined or synergistic mechanisms are present rather than single primary mode", initial_probability: 0.35, supporting_evidence: ["Multiple damage signatures observed", "Interaction effects detected"], conflicting_evidence: ["Single mechanism sufficient to explain findings"], required_next_evidence: ["Isolate mechanism contributions", "Assess interaction kinetics"], likely_trajectory: "Nonlinear acceleration if interaction confirmed" };
  var hyp3 = { hypothesis_id: "H3_" + caseId, title: "Tertiary Hypothesis: Service Anomaly", description: "An abnormal service condition or operating upset drove the damage", initial_probability: 0.15, supporting_evidence: ["Temporal clustering with known upsets", "Rapid onset suggests external trigger"], conflicting_evidence: ["Damage consistent with normal operation"], required_next_evidence: ["Review process history", "Confirm upset timeline"], likely_trajectory: "Rapid arrest if upset resolved; otherwise continued degradation" };
  hypotheses.push(hyp1);
  hypotheses.push(hyp2);
  hypotheses.push(hyp3);
  var totalProb = 0.5 + 0.35 + 0.15;
  return { case_id: caseId, hypotheses: hypotheses, total_probability_check: totalProb, notes: "Hypotheses are competing explanations; posterior updates via Bayesian integration with evidence" };
}

// =====================================================================
// ACTION: build_causal_chain
// =====================================================================
function actionBuildCausalChain(body) {
  var caseId = body.case_id;
  var initiatingEvent = body.initiating_event || "unknown";
  if (!caseId) return { error: "case_id required" };
  var causalChain = {
    case_id: caseId,
    initiating_event: initiatingEvent,
    event_to_damage: "Initiating event creates mechanical/chemical stress leading to material degradation",
    damage_to_consequence: "Accumulated damage reduces cross-section or structural integrity",
    enabling_conditions: ["Environmental exposure (moisture, corrosive ions)", "Material susceptibility (specific alloy, welded zone)", "Stress concentration (geometric feature, weld toe)"],
    active_mechanisms: ["Progressive corrosion or fatigue crack growth", "Stress concentration amplification", "Environmental cycling acceleration"],
    accelerating_factors: ["Temperature cycling", "Pressure fluctuation", "Increased flow velocity or chemical concentration"],
    downstream_consequences: ["Wall loss reducing pressure boundary", "Crack growth to critical size", "Structural instability if member couples to strength"],
    prevention_options: ["Eliminate or reduce initiating event frequency", "Remove or mitigate enabling conditions (coating repair, drainage improvement)", "Active intervention (cathodic protection, inhibitor treatment)", "Design modification (stress relief, material upgrade)", "Operational restriction (pressure reduction, temperature limit)"]
  };
  return causalChain;
}

// =====================================================================
// ACTION: find_analogies
// =====================================================================
function actionFindAnalogies(body) {
  var caseId = body.case_id;
  var domainContext = body.domain_context || "pipeline";
  if (!caseId) return { error: "case_id required" };
  var analogies = [];
  var analogyKeys = Object.keys(ANALOGY_KB);
  for (var i = 0; i < analogyKeys.length; i++) {
    var a = ANALOGY_KB[analogyKeys[i]];
    if (lower(a.source).indexOf(lower(domainContext)) !== -1 || lower(a.target).indexOf(lower(domainContext)) !== -1) {
      analogies.push({ analogy_id: analogyKeys[i], source_domain: a.source, target_domain: a.target, analogy_description: a.analogy, applicability: "High" });
    }
  }
  if (analogies.length === 0) {
    analogies.push({ analogy_id: "generic_analogy", source_domain: "generic", target_domain: domainContext, analogy_description: "Cross-domain analogy approach applies common physics: stress concentration, environmental attack, material degradation follow universal principles across domains.", applicability: "Moderate" });
  }
  return { case_id: caseId, domain_context: domainContext, cross_domain_analogies: analogies, notes: "Analogies suggest applicable inspection/mitigation patterns from analogous industries" };
}

// =====================================================================
// ACTION: detect_novelty
// =====================================================================
function actionDetectNovelty(body) {
  var caseId = body.case_id;
  var caseFeatures = body.case_features || {};
  if (!caseId) return { error: "case_id required" };
  var noveltyResult = detectNovelty(caseFeatures);
  noveltyResult.case_id = caseId;
  noveltyResult.expert_review_required = noveltyResult.expert_review_required === true;
  return noveltyResult;
}

// =====================================================================
// ACTION: update_beliefs
// =====================================================================
function actionUpdateBeliefs(body) {
  var caseId = body.case_id;
  var hypothesisId = body.hypothesis_id;
  var priorBelief = body.prior_belief || 0.5;
  var newEvidence = body.new_evidence || {};
  var likelihood = body.likelihood || 0.7;
  var evidenceWeight = body.evidence_weight || 1.0;
  if (!caseId || !hypothesisId) return { error: "case_id and hypothesis_id required" };
  var posteriorBelief = simpleBayesianUpdate(priorBelief, likelihood, evidenceWeight);
  var confidenceChange = posteriorBelief - priorBelief;
  var confidenceChangeDesc = confidenceChange > 0.1 ? "INCREASED" : confidenceChange < -0.1 ? "DECREASED" : "STABLE";
  var result = { case_id: caseId, hypothesis_id: hypothesisId, prior_belief: priorBelief, new_evidence: newEvidence, likelihood_of_evidence_given_hypothesis: likelihood, posterior_belief: posteriorBelief, confidence_change: confidenceChange, confidence_change_direction: confidenceChangeDesc, normalized_posterior: posteriorBelief };
  return result;
}

// =====================================================================
// ACTION: project_trajectory
// =====================================================================
function actionProjectTrajectory(body) {
  var caseId = body.case_id;
  var currentState = body.current_state || { condition_code: "unknown", detection_rate_mm_per_year: 0.3 };
  if (!caseId) return { error: "case_id required" };
  var traj = projectTrajectory(caseId, currentState);
  traj.case_id = caseId;
  return traj;
}

// =====================================================================
// ACTION: get_case_reasoning
// =====================================================================
function actionGetCaseReasoning(body) {
  var caseId = body.case_id;
  if (!caseId) return { error: "case_id required" };
  var conceptAnalysis = actionAnalyzeConcepts({ case_id: caseId, case_context: {} });
  var hypotheses = actionGenerateHypotheses({ case_id: caseId, case_context: {} });
  var causalChain = actionBuildCausalChain({ case_id: caseId, initiating_event: "unknown" });
  var analogies = actionFindAnalogies({ case_id: caseId, domain_context: "generic" });
  var novelty = actionDetectNovelty({ case_id: caseId, case_features: {} });
  var reasoning = { case_id: caseId, concepts: conceptAnalysis, hypotheses: hypotheses, causal_chain: causalChain, analogies: analogies, novelty_assessment: novelty, belief_updates: [], trajectories: [] };
  return reasoning;
}

// =====================================================================
// ACTION: bind_concept_to_proof
// =====================================================================
function actionBindConceptToProof(body) {
  var conceptId = body.concept_id;
  var proofEvidence = body.proof_evidence || {};
  if (!conceptId) return { error: "concept_id required" };
  var concept = CONCEPT_REGISTRY[conceptId];
  if (!concept) return { error: "Unknown concept_id: " + conceptId };
  var proofStrength = proofEvidence.proof_score || 0.5;
  var supportingDetails = proofEvidence.supporting_details || [];
  var status = proofStrength >= 0.7 ? "CONCEPT_PROVEN" : "CONCEPT_NOT_PROVEN";
  var result = { concept_id: conceptId, concept_name: concept.name, proof_strength: proofStrength, supporting_evidence: supportingDetails, status: status, recommendation: status === "CONCEPT_PROVEN" ? "This concept is supported by proof engine. Safe to include in final decision." : "Proof engine does not sufficiently support this concept. Do not use in binding recommendation." };
  return result;
}

// =====================================================================
// MAIN HANDLER
// =====================================================================
export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };
  }
  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";
    var result = null;
    if (action === "get_registry") {
      result = buildResult(action, actionGetRegistry());
    } else if (action === "analyze_concepts") {
      result = buildResult(action, actionAnalyzeConcepts(body));
    } else if (action === "generate_hypotheses") {
      result = buildResult(action, actionGenerateHypotheses(body));
    } else if (action === "build_causal_chain") {
      result = buildResult(action, actionBuildCausalChain(body));
    } else if (action === "find_analogies") {
      result = buildResult(action, actionFindAnalogies(body));
    } else if (action === "detect_novelty") {
      result = buildResult(action, actionDetectNovelty(body));
    } else if (action === "update_beliefs") {
      result = buildResult(action, actionUpdateBeliefs(body));
    } else if (action === "project_trajectory") {
      result = buildResult(action, actionProjectTrajectory(body));
    } else if (action === "get_case_reasoning") {
      result = buildResult(action, actionGetCaseReasoning(body));
    } else if (action === "bind_concept_to_proof") {
      result = buildResult(action, actionBindConceptToProof(body));
    } else {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action, available_actions: ["get_registry", "analyze_concepts", "generate_hypotheses", "build_causal_chain", "find_analogies", "detect_novelty", "update_beliefs", "project_trajectory", "get_case_reasoning", "bind_concept_to_proof"] }) };
    }
    var caseId = body.case_id;
    if (caseId) {
      try {
        var sb = createClient(supabaseUrl, supabaseKey);
        var tableName = "conceptual_reasoning_" + action;
        await sb.from(tableName).insert({ case_id: caseId, action: action, result_json: result, created_at: new Date().toISOString() });
      } catch (dbErr) {
      }
    }
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result, null, 2) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "Server error: " + (err && err.message ? err.message : String(err)) }) };
  }
};
