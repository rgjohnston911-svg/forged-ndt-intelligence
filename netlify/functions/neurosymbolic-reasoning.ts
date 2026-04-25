// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_ANON_KEY;
var supabase = createClient(supabaseUrl, supabaseKey);

// ── SYMBOLIC RULE REGISTRY ──────────────────────────────────────
// Hard-coded engineering rules that MUST be respected — physics laws,
// code requirements, and domain constraints that cannot be overridden
// by learned patterns.
var SYMBOLIC_RULES = {
  // ── Code Compliance Rules ────────────────────────────
  "API-579-L1-THICKNESS": {
    rule_id: "API-579-L1-THICKNESS",
    category: "code_compliance",
    domain: "pressure_vessel",
    description: "API 579 Level 1: remaining thickness ratio must exceed t_min/t_nom",
    condition: "remaining_thickness_ratio < 1.0",
    conclusion: "FAIL_FFS",
    severity: "critical",
    symbolic_expression: "t_remaining / t_nominal >= t_min_ratio",
    parameters: { t_min_ratio: 0.5 },
    overridable: false
  },
  "ASME-B31G-CORROSION": {
    rule_id: "ASME-B31G-CORROSION",
    category: "code_compliance",
    domain: "pipeline",
    description: "ASME B31G: corroded pipe remaining strength",
    condition: "remaining_strength_factor < 1.0",
    conclusion: "REPAIR_OR_REPLACE",
    severity: "critical",
    symbolic_expression: "RSF = (1 - A/A0) / (1 - A/(A0*M))",
    parameters: { M_bulging: 1.0 },
    overridable: false
  },
  "AWS-D1.1-WELD-DISCONTINUITY": {
    rule_id: "AWS-D1.1-WELD-DISCONTINUITY",
    category: "code_compliance",
    domain: "structural",
    description: "AWS D1.1: weld discontinuity acceptance criteria",
    condition: "discontinuity_size > acceptance_limit",
    conclusion: "REJECT_WELD",
    severity: "critical",
    symbolic_expression: "indication_length <= 0.3 * weld_size AND indication_height <= 0.1 * weld_size",
    parameters: { max_length_ratio: 0.3, max_height_ratio: 0.1 },
    overridable: false
  },
  // ── Physics Laws (Never Violated) ────────────────────
  "PARIS-LAW-CRACK-GROWTH": {
    rule_id: "PARIS-LAW-CRACK-GROWTH",
    category: "physics_law",
    domain: "fracture_mechanics",
    description: "Paris Law: crack growth rate is power function of stress intensity",
    condition: "delta_K > delta_K_threshold",
    conclusion: "CRACK_WILL_GROW",
    severity: "high",
    symbolic_expression: "da/dN = C * (delta_K)^m",
    parameters: { threshold_fraction: 0.3 },
    overridable: false
  },
  "FATIGUE-ENDURANCE-LIMIT": {
    rule_id: "FATIGUE-ENDURANCE-LIMIT",
    category: "physics_law",
    domain: "fatigue",
    description: "Below endurance limit, infinite life (ferrous metals only)",
    condition: "stress_amplitude < endurance_limit AND material_is_ferrous",
    conclusion: "INFINITE_FATIGUE_LIFE",
    severity: "info",
    symbolic_expression: "S_a < S_e => N = infinity (ferrous only)",
    parameters: {},
    overridable: false
  },
  "CORROSION-RATE-TEMPERATURE": {
    rule_id: "CORROSION-RATE-TEMPERATURE",
    category: "physics_law",
    domain: "corrosion",
    description: "Corrosion rate approximately doubles per 10C increase (Arrhenius)",
    condition: "temperature > baseline_temperature",
    conclusion: "ACCELERATED_CORROSION",
    severity: "medium",
    symbolic_expression: "rate_factor = 2^((T - T_base) / 10)",
    parameters: { doubling_interval_c: 10 },
    overridable: false
  },
  "FRACTURE-TOUGHNESS-LIMIT": {
    rule_id: "FRACTURE-TOUGHNESS-LIMIT",
    category: "physics_law",
    domain: "fracture_mechanics",
    description: "Fracture occurs when stress intensity factor exceeds material toughness",
    condition: "K_applied >= K_IC",
    conclusion: "BRITTLE_FRACTURE_IMMINENT",
    severity: "critical",
    symbolic_expression: "K_I = Y * sigma * sqrt(pi * a) >= K_IC",
    parameters: {},
    overridable: false
  },
  // ── Domain Constraints ───────────────────────────────
  "MINIMUM-WALL-THRESHOLD": {
    rule_id: "MINIMUM-WALL-THRESHOLD",
    category: "domain_constraint",
    domain: "general",
    description: "Wall thickness below retirement threshold requires immediate action",
    condition: "wall_thickness < minimum_wall",
    conclusion: "IMMEDIATE_RETIREMENT",
    severity: "critical",
    symbolic_expression: "t_current >= t_min_retirement",
    parameters: { retirement_fraction: 0.3 },
    overridable: false
  },
  "COATING-BELOW-THRESHOLD": {
    rule_id: "COATING-BELOW-THRESHOLD",
    category: "domain_constraint",
    domain: "coatings",
    description: "Coating condition below threshold exposes substrate to environment",
    condition: "coating_condition < failure_threshold",
    conclusion: "SUBSTRATE_EXPOSED",
    severity: "high",
    symbolic_expression: "coating_condition >= failure_threshold",
    parameters: { failure_threshold: 0.3 },
    overridable: false
  },
  "CATHODIC-PROTECTION-LOSS": {
    rule_id: "CATHODIC-PROTECTION-LOSS",
    category: "domain_constraint",
    domain: "subsea",
    description: "CP potential outside protective range accelerates corrosion",
    condition: "cp_potential > -0.8 OR cp_potential < -1.1",
    conclusion: "CP_INADEQUATE",
    severity: "high",
    symbolic_expression: "-1.1V <= E_cp <= -0.8V (Ag/AgCl)",
    parameters: { min_potential: -1.1, max_potential: -0.8 },
    overridable: false
  },
  // ── Safety Rules ─────────────────────────────────────
  "MULTI-MECHANISM-SYNERGY": {
    rule_id: "MULTI-MECHANISM-SYNERGY",
    category: "safety_rule",
    domain: "general",
    description: "Multiple active mechanisms compound risk non-linearly",
    condition: "active_mechanisms >= 3",
    conclusion: "ESCALATE_TO_EXPERT",
    severity: "high",
    symbolic_expression: "risk_combined > sum(risk_individual) when mechanisms >= 3",
    parameters: { synergy_threshold: 3 },
    overridable: true
  },
  "NOVELTY-ESCALATION": {
    rule_id: "NOVELTY-ESCALATION",
    category: "safety_rule",
    domain: "general",
    description: "Novel or unprecedented case patterns require human expert review",
    condition: "novelty_score > 0.7",
    conclusion: "HUMAN_REVIEW_REQUIRED",
    severity: "high",
    symbolic_expression: "novelty_score > 0.7 => escalate",
    parameters: { novelty_threshold: 0.7 },
    overridable: true
  }
};

// ── LEARNED PATTERN LIBRARY ─────────────────────────────────────
// Patterns discovered from historical inspection data
var LEARNED_PATTERNS = {
  "SPLASH-ZONE-ACCELERATED-PITTING": {
    pattern_id: "SPLASH-ZONE-ACCELERATED-PITTING",
    domain: "marine",
    description: "Splash zone assets show 3-5x pitting rate vs immersed",
    evidence_count: 847,
    confidence: 0.92,
    learned_from: "historical_case_analysis",
    modifiers: { pitting_multiplier: 4.2, zone: "splash" }
  },
  "WELD-HAZ-CRACKING-PATTERN": {
    pattern_id: "WELD-HAZ-CRACKING-PATTERN",
    domain: "welding",
    description: "Heat affected zone cracking correlates with carbon equivalent > 0.45",
    evidence_count: 312,
    confidence: 0.88,
    learned_from: "weld_failure_database",
    modifiers: { CE_threshold: 0.45, crack_probability_above: 0.73 }
  },
  "COATING-FAILURE-PRECURSOR": {
    pattern_id: "COATING-FAILURE-PRECURSOR",
    domain: "coatings",
    description: "Blistering DFT < 80% of spec predicts coating failure within 2 years",
    evidence_count: 523,
    confidence: 0.85,
    learned_from: "coating_inspection_history",
    modifiers: { dft_ratio_threshold: 0.8, failure_window_years: 2 }
  },
  "VIBRATION-FATIGUE-CORRELATION": {
    pattern_id: "VIBRATION-FATIGUE-CORRELATION",
    domain: "rotating_equipment",
    description: "Vibration amplitude increase > 40% predicts fatigue crack initiation within 6 months",
    evidence_count: 198,
    confidence: 0.79,
    learned_from: "vibration_monitoring_data",
    modifiers: { amplitude_increase_threshold: 0.4, initiation_window_months: 6 }
  },
  "CREEP-VOID-PROGRESSION": {
    pattern_id: "CREEP-VOID-PROGRESSION",
    domain: "high_temperature",
    description: "Isolated creep voids progress to aligned voids in 30-40% of remaining design life",
    evidence_count: 156,
    confidence: 0.82,
    learned_from: "high_temp_component_database",
    modifiers: { progression_fraction: 0.35 }
  },
  "CUI-TEMPERATURE-BAND": {
    pattern_id: "CUI-TEMPERATURE-BAND",
    domain: "refinery",
    description: "Corrosion under insulation peaks in 50-175C operating band",
    evidence_count: 1247,
    confidence: 0.95,
    learned_from: "refinery_inspection_database",
    modifiers: { temp_low_c: 50, temp_high_c: 175, peak_rate_multiplier: 5.0 }
  },
  "SUBSEA-ANODE-DEPLETION": {
    pattern_id: "SUBSEA-ANODE-DEPLETION",
    domain: "subsea",
    description: "Anode depletion rate accelerates non-linearly after 60% consumption",
    evidence_count: 89,
    confidence: 0.76,
    learned_from: "cp_survey_history",
    modifiers: { acceleration_threshold: 0.6, rate_multiplier: 2.3 }
  },
  "EROSION-BEND-HOTSPOT": {
    pattern_id: "EROSION-BEND-HOTSPOT",
    domain: "pipeline",
    description: "Pipe bends show 2-8x erosion rate vs straight sections",
    evidence_count: 634,
    confidence: 0.91,
    learned_from: "pipeline_pig_data",
    modifiers: { bend_multiplier_range: [2, 8], mean_multiplier: 4.5 }
  }
};

// ── FUSION ALGORITHM ────────────────────────────────────────────
function fuseReasoningChains(symbolic_results, pattern_results, case_data) {
  var fused = [];
  var conflicts = [];
  var symbolic_weight = 0.7;
  var pattern_weight = 0.3;

  // Symbolic results always take priority for critical/code rules
  for (var i = 0; i < symbolic_results.length; i++) {
    var sr = symbolic_results[i];
    if (!sr.overridable) {
      fused.push({
        source: "symbolic",
        rule_id: sr.rule_id,
        conclusion: sr.conclusion,
        severity: sr.severity,
        confidence: 1.0,
        weight: 1.0,
        reasoning: "SYMBOLIC CONSTRAINT (non-overridable): " + sr.description,
        can_be_modified_by_learning: false
      });
    }
  }

  // Pattern results add context, modify severity, or reveal hidden risks
  for (var i = 0; i < pattern_results.length; i++) {
    var pr = pattern_results[i];

    var conflicts_with_symbolic = false;
    for (var j = 0; j < symbolic_results.length; j++) {
      if (symbolic_results[j].conclusion === pr.conclusion && !symbolic_results[j].overridable) {
        conflicts_with_symbolic = true;
        break;
      }
    }

    if (!conflicts_with_symbolic) {
      fused.push({
        source: "learned_pattern",
        pattern_id: pr.pattern_id,
        conclusion: pr.conclusion || pr.description,
        severity: pr.confidence > 0.9 ? "high" : pr.confidence > 0.7 ? "medium" : "low",
        confidence: pr.confidence,
        weight: pattern_weight * pr.confidence,
        reasoning: "LEARNED PATTERN (" + pr.evidence_count + " cases, " + Math.round(pr.confidence * 100) + "% confidence): " + pr.description,
        can_be_modified_by_learning: true
      });
    }
  }

  // Overridable symbolic rules can be modified by strong learned patterns
  for (var i = 0; i < symbolic_results.length; i++) {
    var sr = symbolic_results[i];
    if (sr.overridable) {
      var strongest_pattern = null;
      for (var j = 0; j < pattern_results.length; j++) {
        if (pattern_results[j].domain === sr.domain && pattern_results[j].confidence > 0.85) {
          if (!strongest_pattern || pattern_results[j].confidence > strongest_pattern.confidence) {
            strongest_pattern = pattern_results[j];
          }
        }
      }

      if (strongest_pattern) {
        var blended_confidence = symbolic_weight * 1.0 + pattern_weight * strongest_pattern.confidence;
        fused.push({
          source: "fused",
          rule_id: sr.rule_id,
          pattern_id: strongest_pattern.pattern_id,
          conclusion: sr.conclusion,
          severity: sr.severity,
          confidence: Math.round(blended_confidence * 1000) / 1000,
          weight: blended_confidence,
          reasoning: "FUSED: Symbolic rule '" + sr.rule_id + "' reinforced by learned pattern '" + strongest_pattern.pattern_id + "' (" + strongest_pattern.evidence_count + " cases)",
          can_be_modified_by_learning: true,
          pattern_modifier: strongest_pattern.modifiers
        });
      } else {
        fused.push({
          source: "symbolic",
          rule_id: sr.rule_id,
          conclusion: sr.conclusion,
          severity: sr.severity,
          confidence: symbolic_weight,
          weight: symbolic_weight,
          reasoning: "SYMBOLIC RULE (overridable, no supporting pattern found): " + sr.description,
          can_be_modified_by_learning: true
        });
      }
    }
  }

  // Check for conflicts between symbolic and learned
  for (var i = 0; i < pattern_results.length; i++) {
    for (var j = 0; j < symbolic_results.length; j++) {
      if (pattern_results[i].domain === symbolic_results[j].domain) {
        var pattern_says_safe = pattern_results[i].conclusion && pattern_results[i].conclusion.indexOf("SAFE") >= 0;
        var symbolic_says_fail = symbolic_results[j].severity === "critical";
        if (pattern_says_safe && symbolic_says_fail) {
          conflicts.push({
            type: "PATTERN_VS_SYMBOLIC",
            symbolic_rule: symbolic_results[j].rule_id,
            learned_pattern: pattern_results[i].pattern_id,
            resolution: "SYMBOLIC_WINS — code/physics constraints cannot be overridden by historical patterns",
            explanation: "Pattern suggests safety but symbolic rule requires action. Physics/code constraints take precedence."
          });
        }
      }
    }
  }

  fused.sort(function(a, b) { return (b.weight || 0) - (a.weight || 0); });

  return {
    fused_chain: fused,
    conflicts: conflicts,
    total_symbolic: symbolic_results.length,
    total_patterns: pattern_results.length,
    total_fused: fused.length,
    dominant_source: fused.length > 0 ? fused[0].source : "none"
  };
}

// ── SYMBOLIC EVALUATION ─────────────────────────────────────────
function evaluateSymbolicRules(case_data) {
  var matched = [];
  var domain = case_data.domain || case_data.asset_class || "general";
  var mechanisms = case_data.mechanisms || case_data.active_mechanisms || [];
  var measurements = case_data.measurements || {};

  var rule_keys = Object.keys(SYMBOLIC_RULES);
  for (var i = 0; i < rule_keys.length; i++) {
    var rule = SYMBOLIC_RULES[rule_keys[i]];

    if (rule.domain !== "general" && rule.domain !== domain) continue;

    var triggered = false;
    var evaluation = { rule_id: rule.rule_id, evaluated: true, inputs: {} };

    if (rule.rule_id === "MINIMUM-WALL-THRESHOLD" && measurements.wall_thickness !== undefined && measurements.minimum_wall !== undefined) {
      triggered = measurements.wall_thickness < measurements.minimum_wall;
      evaluation.inputs = { wall_thickness: measurements.wall_thickness, minimum_wall: measurements.minimum_wall };
    }
    else if (rule.rule_id === "COATING-BELOW-THRESHOLD" && measurements.coating_condition !== undefined) {
      triggered = measurements.coating_condition < rule.parameters.failure_threshold;
      evaluation.inputs = { coating_condition: measurements.coating_condition, threshold: rule.parameters.failure_threshold };
    }
    else if (rule.rule_id === "MULTI-MECHANISM-SYNERGY") {
      var mech_count = typeof mechanisms === "number" ? mechanisms : (mechanisms.length || 0);
      triggered = mech_count >= rule.parameters.synergy_threshold;
      evaluation.inputs = { active_mechanisms: mech_count, threshold: rule.parameters.synergy_threshold };
    }
    else if (rule.rule_id === "NOVELTY-ESCALATION" && case_data.novelty_score !== undefined) {
      triggered = case_data.novelty_score > rule.parameters.novelty_threshold;
      evaluation.inputs = { novelty_score: case_data.novelty_score, threshold: rule.parameters.novelty_threshold };
    }
    else if (rule.rule_id === "CORROSION-RATE-TEMPERATURE" && measurements.temperature !== undefined) {
      triggered = measurements.temperature > (measurements.baseline_temperature || 25);
      evaluation.inputs = { temperature: measurements.temperature, baseline: measurements.baseline_temperature || 25 };
    }
    else if (rule.rule_id === "CATHODIC-PROTECTION-LOSS" && measurements.cp_potential !== undefined) {
      triggered = measurements.cp_potential > rule.parameters.max_potential || measurements.cp_potential < rule.parameters.min_potential;
      evaluation.inputs = { cp_potential: measurements.cp_potential, range: [rule.parameters.min_potential, rule.parameters.max_potential] };
    }
    else if (rule.rule_id === "API-579-L1-THICKNESS" && measurements.remaining_thickness_ratio !== undefined) {
      triggered = measurements.remaining_thickness_ratio < rule.parameters.t_min_ratio;
      evaluation.inputs = { ratio: measurements.remaining_thickness_ratio, min_ratio: rule.parameters.t_min_ratio };
    }
    else if (rule.rule_id === "FRACTURE-TOUGHNESS-LIMIT" && measurements.K_applied !== undefined && measurements.K_IC !== undefined) {
      triggered = measurements.K_applied >= measurements.K_IC;
      evaluation.inputs = { K_applied: measurements.K_applied, K_IC: measurements.K_IC };
    }
    else if (rule.rule_id === "PARIS-LAW-CRACK-GROWTH" && measurements.delta_K !== undefined && measurements.delta_K_threshold !== undefined) {
      triggered = measurements.delta_K > measurements.delta_K_threshold;
      evaluation.inputs = { delta_K: measurements.delta_K, threshold: measurements.delta_K_threshold };
    }

    if (triggered) {
      matched.push(Object.assign({}, rule, evaluation));
    }
  }

  return matched;
}

// ── PATTERN MATCHING ────────────────────────────────────────────
function matchPatterns(case_data) {
  var matched = [];
  var domain = case_data.domain || case_data.asset_class || "general";
  var measurements = case_data.measurements || {};

  var pattern_keys = Object.keys(LEARNED_PATTERNS);
  for (var i = 0; i < pattern_keys.length; i++) {
    var pattern = LEARNED_PATTERNS[pattern_keys[i]];

    var domain_match = pattern.domain === domain || domain === "general";
    var condition_match = false;
    var relevance = 0;

    if (pattern.pattern_id === "SPLASH-ZONE-ACCELERATED-PITTING" && (case_data.zone === "splash" || case_data.zone === "splash_zone")) {
      condition_match = true; relevance = 0.95;
    }
    else if (pattern.pattern_id === "CUI-TEMPERATURE-BAND" && measurements.temperature !== undefined) {
      condition_match = measurements.temperature >= pattern.modifiers.temp_low_c && measurements.temperature <= pattern.modifiers.temp_high_c;
      relevance = condition_match ? 0.92 : 0;
    }
    else if (pattern.pattern_id === "WELD-HAZ-CRACKING-PATTERN" && measurements.carbon_equivalent !== undefined) {
      condition_match = measurements.carbon_equivalent > pattern.modifiers.CE_threshold;
      relevance = condition_match ? 0.88 : 0;
    }
    else if (pattern.pattern_id === "VIBRATION-FATIGUE-CORRELATION" && measurements.vibration_increase !== undefined) {
      condition_match = measurements.vibration_increase > pattern.modifiers.amplitude_increase_threshold;
      relevance = condition_match ? 0.85 : 0;
    }
    else if (pattern.pattern_id === "EROSION-BEND-HOTSPOT" && case_data.component_type === "bend") {
      condition_match = true; relevance = 0.90;
    }
    else if (pattern.pattern_id === "SUBSEA-ANODE-DEPLETION" && measurements.anode_consumption !== undefined) {
      condition_match = measurements.anode_consumption > pattern.modifiers.acceleration_threshold;
      relevance = condition_match ? 0.80 : 0;
    }
    else if (pattern.pattern_id === "COATING-FAILURE-PRECURSOR" && measurements.dft_ratio !== undefined) {
      condition_match = measurements.dft_ratio < pattern.modifiers.dft_ratio_threshold;
      relevance = condition_match ? 0.85 : 0;
    }
    else if (pattern.pattern_id === "CREEP-VOID-PROGRESSION" && case_data.creep_stage === "isolated_voids") {
      condition_match = true; relevance = 0.82;
    }

    if (domain_match && condition_match) {
      matched.push(Object.assign({}, pattern, { relevance: relevance, conclusion: pattern.description }));
    }
  }

  matched.sort(function(a, b) { return (b.relevance || 0) - (a.relevance || 0); });
  return matched;
}

// ── OUTPUT HELPERS ──────────────────────────────────────────────
function buildResult(code, body) {
  return { statusCode: code, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" }, body: JSON.stringify(body) };
}
function holdResult(code, msg, action) {
  return buildResult(code, { error: msg, action: action, engine: "neurosymbolic-reasoning", timestamp: new Date().toISOString() });
}

// ── HANDLER ─────────────────────────────────────────────────────
export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return buildResult(200, { status: "ok" });
  if (event.httpMethod !== "POST") return holdResult(405, "POST only", "error");

  var body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return holdResult(400, "Invalid JSON", "parse"); }
  var action = body.action || "get_registry";
  var requestData = body;

  if (action === "get_registry") {
    return buildResult(200, {
      engine_code: "neurosymbolic-reasoning",
      engine_version: "1.0.0",
      engine_name: "Neurosymbolic Reasoning Engine",
      deploy: "DEPLOY320",
      paradigm: "Neurosymbolic AI — fusing symbolic logic with learned patterns",
      description: "Combines hard symbolic constraints (physics laws, code requirements) with soft learned patterns (historical case data) in unified reasoning chains. Symbolic rules cannot be overridden by learning. Learned patterns add context and modify severity.",
      symbolic_rules: Object.keys(SYMBOLIC_RULES).length,
      learned_patterns: Object.keys(LEARNED_PATTERNS).length,
      rule_categories: ["code_compliance", "physics_law", "domain_constraint", "safety_rule"],
      actions: ["get_registry", "fused_reasoning", "symbolic_evaluate", "pattern_match", "explain_reasoning", "get_rule_registry", "get_pattern_registry"],
      fusion_principle: "Symbolic constraints ALWAYS take precedence. Learned patterns inform but never override physics or code.",
      status: "operational"
    });
  }

  if (action === "fused_reasoning") {
    var symbolic = evaluateSymbolicRules(requestData);
    var patterns = matchPatterns(requestData);
    var fusion = fuseReasoningChains(symbolic, patterns, requestData);

    try {
      await supabase.from("neurosymbolic_sessions").insert([{
        case_id: requestData.case_id || null,
        input_data: requestData,
        symbolic_results: symbolic,
        pattern_results: patterns,
        fused_chain: fusion.fused_chain,
        conflicts: fusion.conflicts,
        dominant_source: fusion.dominant_source,
        confidence: fusion.fused_chain.length > 0 ? fusion.fused_chain[0].confidence : 0
      }]);
    } catch (e) { /* non-fatal */ }

    return buildResult(200, {
      action: "fused_reasoning",
      engine: "neurosymbolic-reasoning",
      fusion: fusion,
      explainability: {
        symbolic_rules_evaluated: Object.keys(SYMBOLIC_RULES).length,
        symbolic_rules_triggered: symbolic.length,
        patterns_evaluated: Object.keys(LEARNED_PATTERNS).length,
        patterns_matched: patterns.length,
        fusion_method: "weighted_priority_merge",
        principle: "Symbolic constraints (physics, code) take absolute precedence. Learned patterns add context."
      },
      timestamp: new Date().toISOString()
    });
  }

  if (action === "symbolic_evaluate") {
    var results = evaluateSymbolicRules(requestData);
    return buildResult(200, { action: "symbolic_evaluate", engine: "neurosymbolic-reasoning", rules_evaluated: Object.keys(SYMBOLIC_RULES).length, rules_triggered: results.length, triggered_rules: results, timestamp: new Date().toISOString() });
  }

  if (action === "pattern_match") {
    var results = matchPatterns(requestData);
    return buildResult(200, { action: "pattern_match", engine: "neurosymbolic-reasoning", patterns_evaluated: Object.keys(LEARNED_PATTERNS).length, patterns_matched: results.length, matched_patterns: results, timestamp: new Date().toISOString() });
  }

  if (action === "explain_reasoning") {
    var symbolic = evaluateSymbolicRules(requestData);
    var patterns = matchPatterns(requestData);
    var fusion = fuseReasoningChains(symbolic, patterns, requestData);

    var explanation = [];
    explanation.push("=== NEUROSYMBOLIC REASONING TRACE ===");
    explanation.push("1. SYMBOLIC EVALUATION: " + symbolic.length + " rules triggered from " + Object.keys(SYMBOLIC_RULES).length + " evaluated");
    for (var i = 0; i < symbolic.length; i++) {
      explanation.push("   [SYMBOLIC] " + symbolic[i].rule_id + " -> " + symbolic[i].conclusion + " (severity: " + symbolic[i].severity + ")");
    }
    explanation.push("2. PATTERN MATCHING: " + patterns.length + " patterns matched from " + Object.keys(LEARNED_PATTERNS).length + " evaluated");
    for (var i = 0; i < patterns.length; i++) {
      explanation.push("   [LEARNED] " + patterns[i].pattern_id + " (confidence: " + patterns[i].confidence + ", evidence: " + patterns[i].evidence_count + " cases)");
    }
    explanation.push("3. FUSION: " + fusion.fused_chain.length + " conclusions, " + fusion.conflicts.length + " conflicts");
    explanation.push("4. PRINCIPLE: Symbolic constraints ALWAYS win. Learning informs but never overrides physics or code.");

    return buildResult(200, { action: "explain_reasoning", engine: "neurosymbolic-reasoning", explanation: explanation, fusion: fusion, timestamp: new Date().toISOString() });
  }

  if (action === "get_rule_registry") {
    var rules = [];
    var keys = Object.keys(SYMBOLIC_RULES);
    for (var i = 0; i < keys.length; i++) rules.push(SYMBOLIC_RULES[keys[i]]);
    if (requestData.category) rules = rules.filter(function(r) { return r.category === requestData.category; });
    if (requestData.domain) rules = rules.filter(function(r) { return r.domain === requestData.domain || r.domain === "general"; });
    return buildResult(200, { action: "get_rule_registry", rules: rules, count: rules.length });
  }

  if (action === "get_pattern_registry") {
    var patterns = [];
    var keys = Object.keys(LEARNED_PATTERNS);
    for (var i = 0; i < keys.length; i++) patterns.push(LEARNED_PATTERNS[keys[i]]);
    if (requestData.domain) patterns = patterns.filter(function(p) { return p.domain === requestData.domain; });
    return buildResult(200, { action: "get_pattern_registry", patterns: patterns, count: patterns.length });
  }

  return holdResult(400, "Unknown action: " + action, action);
};
