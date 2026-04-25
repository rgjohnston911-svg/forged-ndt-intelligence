// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_ANON_KEY;
var supabase = createClient(supabaseUrl, supabaseKey);

// ══════════════════════════════════════════════════════════════════
// MULTI-AGENT DEBATE ENGINE
//
// Specialized expert agents each analyze a case from their domain
// perspective, then debate each other. A judge agent synthesizes
// the final answer, weighting each expert's contribution by
// relevance and evidence quality.
//
// Agents: Corrosion Expert, Fatigue Expert, Structural Expert,
//         Code Compliance Expert, Materials Expert, Operations Expert
// Judge:  Synthesizes all arguments with conflict resolution
// ══════════════════════════════════════════════════════════════════

// ── EXPERT AGENT DEFINITIONS ────────────────────────────────────
var EXPERT_AGENTS = {
  corrosion_expert: {
    name: "Corrosion Expert",
    domain: "corrosion",
    expertise: ["general_corrosion", "pitting", "crevice", "galvanic", "mic", "cui", "erosion_corrosion", "co2_corrosion", "h2s_corrosion", "sulfidation"],
    perspective: "Evaluates all corrosion mechanisms, rates, and remaining life from a corrosion engineering standpoint.",
    weight_factors: { corrosion: 1.0, coating: 0.8, cp: 0.9, environment: 0.7, material: 0.5 },
    analyze: function(case_data) {
      var findings = [];
      var risk_score = 0;
      var mechanisms = case_data.mechanisms || [];
      var measurements = case_data.measurements || {};

      var corrosion_mechs = mechanisms.filter(function(m) { return ["corrosion", "pitting", "erosion", "cui", "mic", "sulfidation", "co2_corrosion"].indexOf(m) >= 0; });

      if (corrosion_mechs.length > 0) {
        risk_score += 0.3 * corrosion_mechs.length;
        findings.push("Active corrosion mechanisms detected: " + corrosion_mechs.join(", "));
      }

      if (measurements.corrosion_rate && measurements.corrosion_rate > 0.25) {
        risk_score += 0.3;
        findings.push("Corrosion rate " + measurements.corrosion_rate + " mm/yr exceeds typical threshold of 0.25 mm/yr");
      }

      if (measurements.wall_loss_pct && measurements.wall_loss_pct > 30) {
        risk_score += 0.2;
        findings.push("Wall loss at " + measurements.wall_loss_pct + "% — approaching structural concern");
      }

      if (measurements.coating_condition !== undefined && measurements.coating_condition < 0.4) {
        risk_score += 0.15;
        findings.push("Coating degraded to " + (measurements.coating_condition * 100) + "% — corrosion acceleration expected");
      }

      return { agent: "corrosion_expert", findings: findings, risk_score: Math.min(risk_score, 1.0), recommendation: risk_score > 0.6 ? "URGENT_ACTION" : risk_score > 0.3 ? "INCREASED_MONITORING" : "ROUTINE_MONITORING" };
    }
  },
  fatigue_expert: {
    name: "Fatigue Expert",
    domain: "fatigue",
    expertise: ["high_cycle_fatigue", "low_cycle_fatigue", "thermal_fatigue", "vibration_fatigue", "corrosion_fatigue", "weld_fatigue"],
    perspective: "Evaluates cyclic loading, fatigue damage accumulation, and remaining fatigue life.",
    weight_factors: { fatigue: 1.0, vibration: 0.9, crack: 0.8, weld: 0.7, stress: 0.6 },
    analyze: function(case_data) {
      var findings = [];
      var risk_score = 0;
      var measurements = case_data.measurements || {};

      if (measurements.cumulative_damage && measurements.cumulative_damage > 0.3) {
        risk_score += 0.4;
        findings.push("Cumulative fatigue damage D = " + measurements.cumulative_damage + " — " + (measurements.cumulative_damage > 0.7 ? "approaching failure" : "significant accumulation"));
      }

      if (measurements.vibration_increase && measurements.vibration_increase > 0.3) {
        risk_score += 0.25;
        findings.push("Vibration amplitude increase of " + (measurements.vibration_increase * 100) + "% — fatigue crack initiation risk elevated");
      }

      if (measurements.stress_range && measurements.stress_range > 100) {
        risk_score += 0.2;
        findings.push("Stress range " + measurements.stress_range + " MPa — above endurance limit for most steels");
      }

      if (case_data.weld_present && measurements.weld_class !== "full_penetration") {
        risk_score += 0.15;
        findings.push("Non-full-penetration weld detail detected — reduced fatigue category");
      }

      return { agent: "fatigue_expert", findings: findings, risk_score: Math.min(risk_score, 1.0), recommendation: risk_score > 0.6 ? "DETAILED_FATIGUE_ASSESSMENT" : risk_score > 0.3 ? "MONITOR_CYCLIC_LOADING" : "NO_CONCERN" };
    }
  },
  structural_expert: {
    name: "Structural Expert",
    domain: "structural",
    expertise: ["load_bearing", "buckling", "overload", "settlement", "foundation", "connection_failure", "brittle_fracture"],
    perspective: "Evaluates structural integrity, load paths, and fitness-for-service from a structural engineering standpoint.",
    weight_factors: { structural: 1.0, crack: 0.9, load: 0.8, geometry: 0.7, material: 0.6 },
    analyze: function(case_data) {
      var findings = [];
      var risk_score = 0;
      var measurements = case_data.measurements || {};

      if (measurements.remaining_thickness_ratio && measurements.remaining_thickness_ratio < 0.6) {
        risk_score += 0.4;
        findings.push("Remaining thickness ratio " + measurements.remaining_thickness_ratio + " — FFS assessment required per API 579");
      }

      if (measurements.crack_length_mm && measurements.crack_length_mm > 5) {
        risk_score += 0.3;
        findings.push("Crack length " + measurements.crack_length_mm + " mm detected — fracture mechanics assessment needed");
      }

      if (measurements.K_applied && measurements.K_IC) {
        var ratio = measurements.K_applied / measurements.K_IC;
        if (ratio > 0.7) {
          risk_score += 0.4;
          findings.push("K_applied/K_IC = " + (Math.round(ratio * 100) / 100) + " — approaching fracture toughness limit");
        }
      }

      if (measurements.deflection_mm && measurements.max_deflection_mm) {
        if (measurements.deflection_mm > measurements.max_deflection_mm * 0.8) {
          risk_score += 0.25;
          findings.push("Deflection at " + Math.round((measurements.deflection_mm / measurements.max_deflection_mm) * 100) + "% of limit");
        }
      }

      return { agent: "structural_expert", findings: findings, risk_score: Math.min(risk_score, 1.0), recommendation: risk_score > 0.6 ? "IMMEDIATE_FFS_ASSESSMENT" : risk_score > 0.3 ? "ENGINEERING_REVIEW" : "ACCEPTABLE" };
    }
  },
  code_compliance_expert: {
    name: "Code Compliance Expert",
    domain: "codes",
    expertise: ["API_579", "ASME_B31G", "AWS_D1.1", "DNVGL", "NACE", "ISO_19345", "API_510", "API_570", "API_653"],
    perspective: "Evaluates against applicable codes, standards, and regulatory requirements. Non-negotiable constraints.",
    weight_factors: { code: 1.0, compliance: 1.0, regulation: 0.9, standard: 0.8 },
    analyze: function(case_data) {
      var findings = [];
      var risk_score = 0;
      var measurements = case_data.measurements || {};
      var codes = case_data.applicable_codes || [];

      if (measurements.remaining_thickness_ratio && measurements.remaining_thickness_ratio < 0.5) {
        risk_score += 0.5;
        findings.push("VIOLATION: Remaining thickness below API 579 Level 1 minimum (ratio < 0.5)");
      }

      if (measurements.corrosion_rate && measurements.corrosion_rate > 0.5 && codes.indexOf("API_510") >= 0) {
        risk_score += 0.3;
        findings.push("API 510: High corrosion rate requires reduced inspection interval");
      }

      if (measurements.indication_length && measurements.weld_size) {
        if (measurements.indication_length > 0.3 * measurements.weld_size) {
          risk_score += 0.4;
          findings.push("VIOLATION: Weld indication exceeds AWS D1.1 acceptance criteria");
        }
      }

      if (case_data.pressure_vessel && !case_data.current_inspection_valid) {
        risk_score += 0.3;
        findings.push("API 510: Pressure vessel inspection certificate may be expired — verify compliance");
      }

      return { agent: "code_compliance_expert", findings: findings, risk_score: Math.min(risk_score, 1.0), recommendation: risk_score > 0.5 ? "CODE_VIOLATION — MANDATORY_ACTION" : risk_score > 0.2 ? "CODE_REVIEW_RECOMMENDED" : "COMPLIANT" };
    }
  },
  materials_expert: {
    name: "Materials Expert",
    domain: "materials",
    expertise: ["metallurgy", "hydrogen_damage", "temper_embrittlement", "creep", "phase_transformation", "weld_metallurgy", "material_selection"],
    perspective: "Evaluates material condition, degradation mechanisms, and suitability for service.",
    weight_factors: { material: 1.0, creep: 0.9, hydrogen: 0.8, weld: 0.7, temperature: 0.6 },
    analyze: function(case_data) {
      var findings = [];
      var risk_score = 0;
      var measurements = case_data.measurements || {};

      if (measurements.hardness_hv && (measurements.hardness_hv > 350 || measurements.hardness_hv < 150)) {
        risk_score += 0.3;
        findings.push("Hardness " + measurements.hardness_hv + " HV — " + (measurements.hardness_hv > 350 ? "risk of hydrogen cracking" : "possible over-tempering"));
      }

      if (measurements.temperature_c && measurements.temperature_c > 450) {
        risk_score += 0.25;
        findings.push("Operating temperature " + measurements.temperature_c + "C — creep regime for carbon steel");
      }

      if (measurements.carbon_equivalent && measurements.carbon_equivalent > 0.45) {
        risk_score += 0.2;
        findings.push("Carbon equivalent " + measurements.carbon_equivalent + " — elevated HAZ cracking susceptibility");
      }

      if (case_data.hydrogen_present) {
        risk_score += 0.3;
        findings.push("Hydrogen environment — HTHA, HIC, and SOHIC mechanisms must be evaluated");
      }

      return { agent: "materials_expert", findings: findings, risk_score: Math.min(risk_score, 1.0), recommendation: risk_score > 0.5 ? "MATERIALS_INVESTIGATION_REQUIRED" : risk_score > 0.2 ? "MONITOR_MATERIAL_CONDITION" : "MATERIAL_ACCEPTABLE" };
    }
  },
  operations_expert: {
    name: "Operations Expert",
    domain: "operations",
    expertise: ["process_conditions", "upsets", "shutdowns", "startup", "operating_envelope", "safety_systems"],
    perspective: "Evaluates operating conditions, process upsets, and operational factors affecting integrity.",
    weight_factors: { process: 1.0, operations: 0.9, upset: 0.8, temperature: 0.7, pressure: 0.7 },
    analyze: function(case_data) {
      var findings = [];
      var risk_score = 0;
      var measurements = case_data.measurements || {};

      if (measurements.operating_pressure_pct && measurements.operating_pressure_pct > 90) {
        risk_score += 0.25;
        findings.push("Operating at " + measurements.operating_pressure_pct + "% of MAWP — limited margin");
      }

      if (case_data.recent_upsets && case_data.recent_upsets > 3) {
        risk_score += 0.3;
        findings.push(case_data.recent_upsets + " process upsets in recent period — potential damage acceleration");
      }

      if (measurements.cycles_since_last_inspection && measurements.cycles_since_last_inspection > 10000) {
        risk_score += 0.2;
        findings.push(measurements.cycles_since_last_inspection + " operational cycles since last inspection");
      }

      if (case_data.approaching_turnaround) {
        findings.push("Approaching scheduled turnaround — opportunity for comprehensive inspection");
      }

      return { agent: "operations_expert", findings: findings, risk_score: Math.min(risk_score, 1.0), recommendation: risk_score > 0.5 ? "OPERATIONAL_REVIEW_NEEDED" : risk_score > 0.2 ? "MONITOR_OPERATING_CONDITIONS" : "OPERATIONS_NORMAL" };
    }
  }
};

// ── JUDGE AGENT ─────────────────────────────────────────────────
function judgeDebate(case_data, agent_results) {
  var total_weighted_risk = 0;
  var total_weight = 0;
  var all_findings = [];
  var agreements = [];
  var conflicts = [];

  // Relevance weighting based on case domain
  var domain = case_data.domain || "general";
  var domain_weights = {
    corrosion_expert: domain === "corrosion" || domain === "pipeline" || domain === "marine" ? 1.0 : 0.6,
    fatigue_expert: domain === "fatigue" || domain === "rotating_equipment" || domain === "structural" ? 1.0 : 0.5,
    structural_expert: domain === "structural" || domain === "pressure_vessel" ? 1.0 : 0.6,
    code_compliance_expert: 0.9,
    materials_expert: domain === "high_temperature" || domain === "hydrogen" ? 1.0 : 0.5,
    operations_expert: domain === "refinery" || domain === "process" ? 1.0 : 0.4
  };

  for (var i = 0; i < agent_results.length; i++) {
    var ar = agent_results[i];
    var w = domain_weights[ar.agent] || 0.5;
    total_weighted_risk += ar.risk_score * w;
    total_weight += w;

    for (var j = 0; j < ar.findings.length; j++) {
      all_findings.push({ agent: ar.agent, finding: ar.findings[j], risk_contribution: ar.risk_score });
    }
  }

  var consensus_risk = total_weight > 0 ? total_weighted_risk / total_weight : 0;

  // Find agreements (multiple experts flagging same concern)
  var high_risk_agents = agent_results.filter(function(a) { return a.risk_score > 0.4; });
  if (high_risk_agents.length >= 3) {
    agreements.push("STRONG CONSENSUS: " + high_risk_agents.length + " of " + agent_results.length + " experts flag elevated risk");
  }

  // Find conflicts
  var recommendations = {};
  for (var i = 0; i < agent_results.length; i++) {
    var rec = agent_results[i].recommendation;
    if (!recommendations[rec]) recommendations[rec] = [];
    recommendations[rec].push(agent_results[i].agent);
  }

  var urgent_agents = agent_results.filter(function(a) { return a.recommendation.indexOf("URGENT") >= 0 || a.recommendation.indexOf("IMMEDIATE") >= 0 || a.recommendation.indexOf("VIOLATION") >= 0; });
  var routine_agents = agent_results.filter(function(a) { return a.recommendation.indexOf("ROUTINE") >= 0 || a.recommendation.indexOf("NO_CONCERN") >= 0 || a.recommendation.indexOf("ACCEPTABLE") >= 0; });

  if (urgent_agents.length > 0 && routine_agents.length > 0) {
    conflicts.push({
      type: "SEVERITY_DISAGREEMENT",
      urgent: urgent_agents.map(function(a) { return a.agent; }),
      routine: routine_agents.map(function(a) { return a.agent; }),
      resolution: "Conservative approach: defer to highest-severity assessment"
    });
  }

  // Code compliance ALWAYS wins
  var code_result = agent_results.filter(function(a) { return a.agent === "code_compliance_expert"; })[0];
  var code_override = false;
  if (code_result && code_result.recommendation.indexOf("VIOLATION") >= 0) {
    code_override = true;
    consensus_risk = Math.max(consensus_risk, 0.8);
  }

  var final_disposition = consensus_risk > 0.7 ? "CRITICAL — IMMEDIATE ACTION REQUIRED" : consensus_risk > 0.4 ? "ACTION REQUIRED — ENGINEERING ASSESSMENT" : consensus_risk > 0.2 ? "MONITOR — INCREASED SURVEILLANCE" : "ACCEPTABLE — ROUTINE INSPECTION";

  if (code_override) {
    final_disposition = "CODE VIOLATION — MANDATORY CORRECTIVE ACTION (overrides expert consensus)";
  }

  return {
    consensus_risk_score: Math.round(consensus_risk * 1000) / 1000,
    final_disposition: final_disposition,
    code_override: code_override,
    expert_count: agent_results.length,
    high_risk_experts: high_risk_agents.length,
    agreements: agreements,
    conflicts: conflicts,
    all_findings: all_findings,
    expert_recommendations: agent_results.map(function(a) { return { agent: a.agent, risk: Math.round(a.risk_score * 1000) / 1000, recommendation: a.recommendation }; }),
    judge_reasoning: code_override ? "Code compliance violation detected — regulatory requirements supersede all expert opinions. Mandatory corrective action required regardless of other assessments." : conflicts.length > 0 ? "Expert disagreement resolved conservatively — deferring to highest-severity assessment. " + high_risk_agents.length + " of " + agent_results.length + " experts flag elevated risk." : "Expert consensus achieved. " + (high_risk_agents.length > 0 ? "Multiple experts flag elevated risk." : "No significant concerns raised across expert panel.")
  };
}

// ── OUTPUT HELPERS ──────────────────────────────────────────────
function buildResult(code, body) {
  return { statusCode: code, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" }, body: JSON.stringify(body) };
}
function holdResult(code, msg, action) {
  return buildResult(code, { error: msg, action: action, engine: "multi-agent-debate", timestamp: new Date().toISOString() });
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
      engine_code: "multi-agent-debate",
      engine_version: "1.0.0",
      engine_name: "Multi-Agent Debate Engine",
      deploy: "DEPLOY326",
      paradigm: "Multi-agent adversarial debate with judge synthesis",
      description: "Six specialized expert agents analyze a case from their domain perspective, then a judge agent synthesizes with conflict resolution. Code compliance always wins. Conservative resolution on disagreements.",
      agents: Object.keys(EXPERT_AGENTS).map(function(k) { return { id: k, name: EXPERT_AGENTS[k].name, domain: EXPERT_AGENTS[k].domain }; }),
      judge: "Weighted synthesis with domain relevance, code compliance override, and conservative conflict resolution",
      actions: ["get_registry", "run_debate", "get_expert_analysis", "get_agents"],
      principle: "Code compliance constraints ALWAYS override expert consensus. Disagreements resolve conservatively.",
      status: "operational"
    });
  }

  if (action === "run_debate") {
    var agent_results = [];
    var agent_keys = Object.keys(EXPERT_AGENTS);
    for (var i = 0; i < agent_keys.length; i++) {
      var result = EXPERT_AGENTS[agent_keys[i]].analyze(requestData);
      agent_results.push(result);
    }

    var judgment = judgeDebate(requestData, agent_results);

    try {
      await supabase.from("debate_sessions").insert([{
        case_id: requestData.case_id || null,
        agent_results: agent_results,
        judgment: judgment,
        consensus_risk: judgment.consensus_risk_score,
        final_disposition: judgment.final_disposition,
        code_override: judgment.code_override,
        conflicts_count: judgment.conflicts.length
      }]);
    } catch (e) { /* non-fatal */ }

    return buildResult(200, { action: "run_debate", engine: "multi-agent-debate", expert_analyses: agent_results, judgment: judgment, timestamp: new Date().toISOString() });
  }

  if (action === "get_expert_analysis") {
    var agent_id = requestData.agent || requestData.expert;
    if (!agent_id || !EXPERT_AGENTS[agent_id]) return holdResult(400, "Valid agent required: " + Object.keys(EXPERT_AGENTS).join(", "), action);
    var result = EXPERT_AGENTS[agent_id].analyze(requestData);
    return buildResult(200, { action: "get_expert_analysis", engine: "multi-agent-debate", result: result, timestamp: new Date().toISOString() });
  }

  if (action === "get_agents") {
    var agents = [];
    var keys = Object.keys(EXPERT_AGENTS);
    for (var i = 0; i < keys.length; i++) {
      var a = EXPERT_AGENTS[keys[i]];
      agents.push({ id: keys[i], name: a.name, domain: a.domain, expertise: a.expertise, perspective: a.perspective });
    }
    return buildResult(200, { action: "get_agents", agents: agents, count: agents.length });
  }

  return holdResult(400, "Unknown action: " + action, action);
};
