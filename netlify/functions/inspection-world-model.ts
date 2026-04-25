// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_ANON_KEY;
var supabase = createClient(supabaseUrl, supabaseKey);

// ── PHYSICS CONSTANTS ───────────────────────────────────────────
var CRACK_GROWTH_PARAMS = {
  carbon_steel: { C: 3.0e-12, m: 3.0, K_IC: 55, yield_strength: 250 },
  stainless_steel: { C: 5.0e-12, m: 3.25, K_IC: 80, yield_strength: 205 },
  aluminum: { C: 1.0e-11, m: 3.1, K_IC: 30, yield_strength: 270 },
  duplex_steel: { C: 2.5e-12, m: 2.9, K_IC: 90, yield_strength: 450 },
  nickel_alloy: { C: 4.0e-12, m: 3.15, K_IC: 100, yield_strength: 300 },
  titanium: { C: 1.5e-12, m: 3.4, K_IC: 70, yield_strength: 880 }
};

var CORROSION_PARAMS = {
  marine_immersed: { k: 0.25, n: 0.8, pitting_factor: 5.0 },
  marine_splash: { k: 0.35, n: 0.9, pitting_factor: 6.0 },
  marine_atmospheric: { k: 0.08, n: 0.6, pitting_factor: 3.0 },
  industrial: { k: 0.05, n: 0.7, pitting_factor: 4.0 },
  chemical_process: { k: 0.15, n: 0.85, pitting_factor: 5.5 },
  high_temp: { k: 0.30, n: 1.0, pitting_factor: 2.0 },
  buried_soil: { k: 0.06, n: 0.65, pitting_factor: 4.5 },
  freshwater: { k: 0.03, n: 0.5, pitting_factor: 2.5 }
};

var FATIGUE_PARAMS = {
  carbon_steel: { S_ref: 400, b: 3.5, endurance_limit: 200, cycles_at_ref: 1e6 },
  stainless_steel: { S_ref: 350, b: 4.0, endurance_limit: 170, cycles_at_ref: 1e6 },
  aluminum: { S_ref: 200, b: 3.0, endurance_limit: 0, cycles_at_ref: 1e6 },
  duplex_steel: { S_ref: 500, b: 3.8, endurance_limit: 250, cycles_at_ref: 1e6 },
  nickel_alloy: { S_ref: 450, b: 4.2, endurance_limit: 220, cycles_at_ref: 1e6 }
};

var COATING_PARAMS = {
  epoxy: { design_life: 15, gamma: 1.5, failure_threshold: 0.3 },
  polyurethane: { design_life: 12, gamma: 1.3, failure_threshold: 0.25 },
  zinc_rich: { design_life: 20, gamma: 1.8, failure_threshold: 0.35 },
  thermal_spray_aluminum: { design_life: 25, gamma: 2.0, failure_threshold: 0.4 },
  fusion_bonded_epoxy: { design_life: 18, gamma: 1.6, failure_threshold: 0.3 },
  coal_tar_epoxy: { design_life: 10, gamma: 1.2, failure_threshold: 0.2 }
};

var ENVIRONMENT_MULTIPLIERS = {
  arctic: { corrosion: 0.6, fatigue: 1.3, coating: 1.4, crack: 1.2 },
  tropical: { corrosion: 1.4, fatigue: 0.9, coating: 1.6, crack: 1.0 },
  desert: { corrosion: 0.4, fatigue: 1.0, coating: 1.2, crack: 0.9 },
  offshore: { corrosion: 1.5, fatigue: 1.4, coating: 1.8, crack: 1.3 },
  refinery: { corrosion: 1.3, fatigue: 1.1, coating: 1.5, crack: 1.1 },
  power_plant: { corrosion: 1.0, fatigue: 1.2, coating: 1.0, crack: 1.2 },
  subsea: { corrosion: 1.6, fatigue: 1.5, coating: 2.0, crack: 1.4 }
};

// ── OUTPUT HELPERS ──────────────────────────────────────────────
function buildResult(code, body) {
  return { statusCode: code, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" }, body: JSON.stringify(body) };
}
function holdResult(code, msg, action) {
  return buildResult(code, { error: msg, action: action, engine: "inspection-world-model", timestamp: new Date().toISOString() });
}

// ── SIMULATION: CRACK GROWTH (Paris Law) ────────────────────────
function simulateCrackGrowth(params) {
  var material = params.material || "carbon_steel";
  var mat = CRACK_GROWTH_PARAMS[material] || CRACK_GROWTH_PARAMS.carbon_steel;
  var env = ENVIRONMENT_MULTIPLIERS[params.environment] || { crack: 1.0 };

  var a0 = params.initial_crack_mm || 2.0;
  var wall_thickness = params.wall_thickness_mm || 25.0;
  var stress_range = params.stress_range_mpa || 100;
  var cycles_per_year = params.cycles_per_year || 1e5;
  var geometry_factor = params.geometry_factor || 1.12;
  var years = params.time_horizon_years || 20;
  var steps = params.time_steps || Math.min(years * 4, 80);

  var C = mat.C * env.crack;
  var m = mat.m;
  var a_critical = wall_thickness * 0.8;

  var dt = years / steps;
  var timeline = [];
  var a = a0;
  var failed = false;
  var time_to_critical = null;

  for (var i = 0; i <= steps; i++) {
    var t = i * dt;
    var a_mm = Math.round(a * 1000) / 1000;
    var remaining_wall = wall_thickness - a;
    var delta_K = geometry_factor * stress_range * Math.sqrt(Math.PI * (a / 1000));
    var growth_rate = C * Math.pow(delta_K, m) * 1000;
    var remaining_life_pct = Math.max(0, Math.round((1 - a / a_critical) * 1000) / 10);

    var state = {
      year: Math.round(t * 100) / 100,
      crack_length_mm: a_mm,
      remaining_wall_mm: Math.round(remaining_wall * 100) / 100,
      delta_K_mpa_sqrt_m: Math.round(delta_K * 100) / 100,
      growth_rate_mm_per_year: Math.round(growth_rate * cycles_per_year * 1e6) / 1e6,
      remaining_life_pct: remaining_life_pct,
      status: a >= a_critical ? "CRITICAL" : a >= a_critical * 0.7 ? "WARNING" : "SAFE"
    };
    timeline.push(state);

    if (a >= a_critical && !failed) {
      failed = true;
      time_to_critical = Math.round(t * 100) / 100;
    }

    if (i < steps) {
      var dN = cycles_per_year * dt;
      var da = C * Math.pow(delta_K, m) * dN * 1000;
      a = a + da;
      if (a > wall_thickness) a = wall_thickness;
    }
  }

  return {
    simulation_type: "crack_growth",
    physics_model: "Paris Law (da/dN = C * dK^m)",
    material: material,
    parameters: { C: C, m: m, K_IC: mat.K_IC, geometry_factor: geometry_factor },
    initial_crack_mm: a0,
    final_crack_mm: Math.round(a * 1000) / 1000,
    critical_crack_mm: a_critical,
    time_to_critical_years: time_to_critical,
    failure_predicted: failed,
    time_horizon_years: years,
    time_steps: steps,
    timeline: timeline,
    intervention_window: time_to_critical ? (time_to_critical > 5 ? "PLANNED" : time_to_critical > 2 ? "URGENT" : "IMMEDIATE") : "NO_FAILURE_PREDICTED",
    confidence: failed ? 0.85 : 0.78
  };
}

// ── SIMULATION: CORROSION PROPAGATION ───────────────────────────
function simulateCorrosion(params) {
  var environment = params.environment || "marine_immersed";
  var env = CORROSION_PARAMS[environment] || CORROSION_PARAMS.marine_immersed;
  var envMult = ENVIRONMENT_MULTIPLIERS[params.climate] || { corrosion: 1.0 };

  var wall_thickness = params.wall_thickness_mm || 25.0;
  var initial_loss = params.initial_loss_mm || 0;
  var include_pitting = params.include_pitting !== false;
  var temperature_c = params.temperature_c || 25;
  var years = params.time_horizon_years || 20;
  var steps = params.time_steps || Math.min(years * 4, 80);
  var min_wall = params.minimum_wall_mm || wall_thickness * 0.4;

  var k = env.k * envMult.corrosion;
  var n = env.n;
  var temp_factor = 1.0 + Math.max(0, (temperature_c - 25) * 0.02);
  k = k * temp_factor;

  var dt = years / steps;
  var timeline = [];
  var breach_time = null;

  for (var i = 0; i <= steps; i++) {
    var t = i * dt;
    var age = t + (params.current_age_years || 0);
    var general_loss = age > 0 ? k * Math.pow(age, n) : 0;
    var pitting_depth = include_pitting ? general_loss * env.pitting_factor : 0;
    var total_loss = initial_loss + general_loss;
    var remaining = wall_thickness - total_loss;
    var pitting_remaining = wall_thickness - initial_loss - pitting_depth;

    var corrosion_rate = age > 0 ? k * n * Math.pow(age, n - 1) : k;

    var state = {
      year: Math.round(t * 100) / 100,
      general_loss_mm: Math.round(general_loss * 1000) / 1000,
      pitting_depth_mm: Math.round(pitting_depth * 1000) / 1000,
      remaining_wall_mm: Math.round(remaining * 100) / 100,
      pitting_remaining_mm: Math.round(pitting_remaining * 100) / 100,
      corrosion_rate_mm_yr: Math.round(corrosion_rate * 1000) / 1000,
      wall_loss_pct: Math.round((total_loss / wall_thickness) * 1000) / 10,
      status: remaining <= min_wall ? "CRITICAL" : remaining <= min_wall * 1.3 ? "WARNING" : "SAFE"
    };
    timeline.push(state);

    if (remaining <= min_wall && !breach_time) {
      breach_time = Math.round(t * 100) / 100;
    }
  }

  return {
    simulation_type: "corrosion_propagation",
    physics_model: "Power Law (d = k * t^n) + Pitting Factor",
    environment: environment,
    parameters: { k: Math.round(k * 10000) / 10000, n: n, pitting_factor: env.pitting_factor, temp_factor: Math.round(temp_factor * 100) / 100 },
    initial_wall_mm: wall_thickness,
    minimum_wall_mm: min_wall,
    time_to_minimum_wall_years: breach_time,
    failure_predicted: breach_time !== null,
    time_horizon_years: years,
    time_steps: steps,
    timeline: timeline,
    intervention_window: breach_time ? (breach_time > 10 ? "PLANNED" : breach_time > 3 ? "URGENT" : "IMMEDIATE") : "NO_FAILURE_PREDICTED",
    confidence: 0.82
  };
}

// ── SIMULATION: FATIGUE EVOLUTION (Miner's Rule) ────────────────
function simulateFatigue(params) {
  var material = params.material || "carbon_steel";
  var mat = FATIGUE_PARAMS[material] || FATIGUE_PARAMS.carbon_steel;
  var env = ENVIRONMENT_MULTIPLIERS[params.environment] || { fatigue: 1.0 };

  var stress_ranges = params.stress_ranges || [{ amplitude_mpa: 150, cycles_per_year: 50000 }, { amplitude_mpa: 100, cycles_per_year: 200000 }, { amplitude_mpa: 60, cycles_per_year: 500000 }];
  var years = params.time_horizon_years || 20;
  var steps = params.time_steps || Math.min(years * 4, 80);
  var initial_damage = params.initial_damage || 0;

  var dt = years / steps;
  var timeline = [];
  var D = initial_damage;
  var failure_time = null;

  for (var i = 0; i <= steps; i++) {
    var t = i * dt;

    var state = {
      year: Math.round(t * 100) / 100,
      cumulative_damage: Math.round(D * 10000) / 10000,
      remaining_life_pct: Math.max(0, Math.round((1 - D) * 1000) / 10),
      damage_rate_per_year: 0,
      status: D >= 1.0 ? "FAILED" : D >= 0.7 ? "CRITICAL" : D >= 0.4 ? "WARNING" : "SAFE"
    };

    var annual_damage = 0;
    for (var j = 0; j < stress_ranges.length; j++) {
      var sr = stress_ranges[j];
      var S_a = sr.amplitude_mpa;
      if (mat.endurance_limit > 0 && S_a <= mat.endurance_limit) continue;

      var N_f = mat.cycles_at_ref * Math.pow(mat.S_ref / S_a, mat.b);
      N_f = N_f / env.fatigue;
      var n_i = sr.cycles_per_year;
      annual_damage = annual_damage + (n_i / N_f);
    }
    state.damage_rate_per_year = Math.round(annual_damage * 100000) / 100000;
    timeline.push(state);

    if (D >= 1.0 && !failure_time) {
      failure_time = Math.round(t * 100) / 100;
    }

    if (i < steps) {
      D = D + annual_damage * dt;
    }
  }

  var total_annual = 0;
  for (var j = 0; j < stress_ranges.length; j++) {
    var sr = stress_ranges[j];
    var S_a = sr.amplitude_mpa;
    if (mat.endurance_limit > 0 && S_a <= mat.endurance_limit) continue;
    var N_f = mat.cycles_at_ref * Math.pow(mat.S_ref / S_a, mat.b);
    N_f = N_f / env.fatigue;
    total_annual = total_annual + (sr.cycles_per_year / N_f);
  }
  var estimated_life = total_annual > 0 ? (1.0 - initial_damage) / total_annual : Infinity;

  return {
    simulation_type: "fatigue_evolution",
    physics_model: "Miner's Rule (D = sum(n_i/N_i)) + S-N Curve",
    material: material,
    parameters: { S_ref: mat.S_ref, b: mat.b, endurance_limit: mat.endurance_limit, environment_factor: env.fatigue },
    stress_spectrum: stress_ranges,
    estimated_life_years: Math.round(estimated_life * 100) / 100,
    failure_predicted: failure_time !== null || estimated_life <= years,
    time_to_failure_years: failure_time || (estimated_life <= years ? Math.round(estimated_life * 100) / 100 : null),
    final_damage: Math.round(D * 10000) / 10000,
    time_horizon_years: years,
    time_steps: steps,
    timeline: timeline,
    intervention_window: failure_time ? (failure_time > 10 ? "PLANNED" : failure_time > 3 ? "URGENT" : "IMMEDIATE") : estimated_life <= years ? "PLANNED" : "NO_FAILURE_PREDICTED",
    confidence: 0.80
  };
}

// ── SIMULATION: COATING BREAKDOWN ───────────────────────────────
function simulateCoatingBreakdown(params) {
  var coating_type = params.coating_type || "epoxy";
  var coat = COATING_PARAMS[coating_type] || COATING_PARAMS.epoxy;
  var env = ENVIRONMENT_MULTIPLIERS[params.environment] || { coating: 1.0 };

  var current_age = params.current_age_years || 0;
  var years = params.time_horizon_years || 20;
  var steps = params.time_steps || Math.min(years * 4, 80);

  var effective_life = coat.design_life / env.coating;
  var dt = years / steps;
  var timeline = [];
  var failure_time = null;

  for (var i = 0; i <= steps; i++) {
    var t = i * dt;
    var total_age = current_age + t;
    var condition = Math.max(0, 1.0 - Math.pow(total_age / effective_life, coat.gamma));
    var degradation_rate = total_age > 0 ? (coat.gamma / effective_life) * Math.pow(total_age / effective_life, coat.gamma - 1) : 0;

    var state = {
      year: Math.round(t * 100) / 100,
      coating_condition: Math.round(condition * 1000) / 1000,
      degradation_rate_per_year: Math.round(degradation_rate * 10000) / 10000,
      effective_protection_pct: Math.round(condition * 1000) / 10,
      status: condition <= coat.failure_threshold ? "FAILED" : condition <= coat.failure_threshold * 1.5 ? "CRITICAL" : condition <= 0.6 ? "WARNING" : "GOOD"
    };
    timeline.push(state);

    if (condition <= coat.failure_threshold && !failure_time) {
      failure_time = Math.round(t * 100) / 100;
    }
  }

  var time_to_failure_total = effective_life * Math.pow(1 - coat.failure_threshold, 1 / coat.gamma);
  var remaining_from_now = time_to_failure_total - current_age;

  return {
    simulation_type: "coating_breakdown",
    physics_model: "Service Life Model (C = 1 - (t/L)^gamma)",
    coating_type: coating_type,
    parameters: { design_life: coat.design_life, effective_life: Math.round(effective_life * 100) / 100, gamma: coat.gamma, failure_threshold: coat.failure_threshold, environment_factor: env.coating },
    current_age_years: current_age,
    remaining_life_years: Math.max(0, Math.round(remaining_from_now * 100) / 100),
    failure_predicted: remaining_from_now <= years,
    time_to_failure_years: failure_time,
    time_horizon_years: years,
    time_steps: steps,
    timeline: timeline,
    recoat_recommendation: remaining_from_now <= 2 ? "IMMEDIATE" : remaining_from_now <= 5 ? "PLAN_NOW" : "MONITOR",
    confidence: 0.85
  };
}

// ── SIMULATION: MULTI-MECHANISM INTERACTION ─────────────────────
function simulateMultiMechanism(params) {
  var crack_result = simulateCrackGrowth(params.crack || params);
  var corrosion_result = simulateCorrosion(params.corrosion || params);
  var fatigue_result = simulateFatigue(params.fatigue || params);
  var coating_result = simulateCoatingBreakdown(params.coating || params);

  var years = params.time_horizon_years || 20;
  var steps = Math.min(crack_result.timeline.length, corrosion_result.timeline.length, fatigue_result.timeline.length, coating_result.timeline.length);
  var interaction_factor = params.interaction_factor || 1.3;

  var combined_timeline = [];
  var critical_time = null;

  for (var i = 0; i < steps; i++) {
    var crack_state = crack_result.timeline[i] || {};
    var corr_state = corrosion_result.timeline[i] || {};
    var fatigue_state = fatigue_result.timeline[i] || {};
    var coat_state = coating_result.timeline[i] || {};

    var crack_damage = 1 - (crack_state.remaining_life_pct || 100) / 100;
    var corr_damage = (corr_state.wall_loss_pct || 0) / 100;
    var fatigue_damage = fatigue_state.cumulative_damage || 0;
    var coat_damage = 1 - (coat_state.coating_condition || 1);

    var coat_accel = coat_damage > 0.5 ? 1.0 + (coat_damage - 0.5) * 2 : 1.0;
    var combined_damage = (0.3 * crack_damage + 0.3 * corr_damage * coat_accel + 0.25 * fatigue_damage + 0.15 * coat_damage) * interaction_factor;
    combined_damage = Math.min(combined_damage, 1.0);

    var state = {
      year: crack_state.year || Math.round((i * years / (steps - 1)) * 100) / 100,
      crack_damage: Math.round(crack_damage * 1000) / 1000,
      corrosion_damage: Math.round(corr_damage * 1000) / 1000,
      fatigue_damage: Math.round(fatigue_damage * 1000) / 1000,
      coating_damage: Math.round(coat_damage * 1000) / 1000,
      combined_damage_index: Math.round(combined_damage * 1000) / 1000,
      dominant_mechanism: crack_damage >= corr_damage && crack_damage >= fatigue_damage ? "crack_growth" : corr_damage >= fatigue_damage ? "corrosion" : "fatigue",
      coating_acceleration: Math.round(coat_accel * 100) / 100,
      status: combined_damage >= 0.8 ? "CRITICAL" : combined_damage >= 0.5 ? "WARNING" : "SAFE"
    };
    combined_timeline.push(state);

    if (combined_damage >= 0.8 && !critical_time) {
      critical_time = state.year;
    }
  }

  var earliest_failure = null;
  var mechanisms_at_risk = [];
  if (crack_result.time_to_critical_years) { earliest_failure = crack_result.time_to_critical_years; mechanisms_at_risk.push("crack_growth"); }
  if (corrosion_result.time_to_minimum_wall_years) {
    if (!earliest_failure || corrosion_result.time_to_minimum_wall_years < earliest_failure) earliest_failure = corrosion_result.time_to_minimum_wall_years;
    mechanisms_at_risk.push("corrosion");
  }
  if (fatigue_result.time_to_failure_years) {
    if (!earliest_failure || fatigue_result.time_to_failure_years < earliest_failure) earliest_failure = fatigue_result.time_to_failure_years;
    mechanisms_at_risk.push("fatigue");
  }
  if (coating_result.time_to_failure_years) {
    if (!earliest_failure || coating_result.time_to_failure_years < earliest_failure) earliest_failure = coating_result.time_to_failure_years;
    mechanisms_at_risk.push("coating_failure");
  }

  return {
    simulation_type: "multi_mechanism_interaction",
    physics_model: "Weighted Combined Damage Index with Coating Acceleration",
    interaction_factor: interaction_factor,
    individual_simulations: {
      crack_growth: { failure_predicted: crack_result.failure_predicted, time_to_critical: crack_result.time_to_critical_years },
      corrosion: { failure_predicted: corrosion_result.failure_predicted, time_to_critical: corrosion_result.time_to_minimum_wall_years },
      fatigue: { failure_predicted: fatigue_result.failure_predicted, time_to_critical: fatigue_result.time_to_failure_years },
      coating: { failure_predicted: coating_result.failure_predicted, time_to_critical: coating_result.time_to_failure_years }
    },
    earliest_failure_years: earliest_failure,
    critical_combined_damage_years: critical_time,
    mechanisms_at_risk: mechanisms_at_risk,
    combined_timeline: combined_timeline,
    intervention_window: critical_time ? (critical_time > 10 ? "PLANNED" : critical_time > 3 ? "URGENT" : "IMMEDIATE") : "MONITOR",
    recommendation: mechanisms_at_risk.length > 2 ? "MULTI_MECHANISM_SYNERGY_DETECTED — accelerated degradation likely" : mechanisms_at_risk.length > 0 ? "SINGLE_DOMINANT_MECHANISM — standard monitoring" : "LOW_RISK — continue routine inspection",
    confidence: 0.77
  };
}

// ── GENERATE FUTURE STATES ──────────────────────────────────────
function generateFutureStates(params) {
  var simulation_type = params.simulation_type || "multi_mechanism";

  var result;
  if (simulation_type === "crack_growth") {
    result = simulateCrackGrowth(params);
  } else if (simulation_type === "corrosion") {
    result = simulateCorrosion(params);
  } else if (simulation_type === "fatigue") {
    result = simulateFatigue(params);
  } else if (simulation_type === "coating") {
    result = simulateCoatingBreakdown(params);
  } else {
    result = simulateMultiMechanism(params);
  }

  var milestones = [];
  var tl = result.timeline || result.combined_timeline || [];
  for (var i = 0; i < tl.length; i++) {
    if (i === 0 || tl[i].status !== tl[i - 1].status) {
      milestones.push({ year: tl[i].year, transition: (i > 0 ? tl[i - 1].status : "INITIAL") + " → " + tl[i].status });
    }
  }

  return {
    action: "generate_future_states",
    simulation_type: simulation_type,
    current_state: tl.length > 0 ? tl[0] : null,
    future_states: {
      year_1: tl.length > 4 ? tl[4] : null,
      year_5: tl.length > 20 ? tl[20] : null,
      year_10: tl.length > 40 ? tl[40] : null,
      final: tl.length > 0 ? tl[tl.length - 1] : null
    },
    milestones: milestones,
    full_simulation: result,
    confidence: result.confidence || 0.78
  };
}

// ── WHAT-IF SCENARIO RUNNER ─────────────────────────────────────
function runWhatIf(params) {
  var baseline_params = params.baseline || params;
  var scenarios = params.scenarios || [];

  var baseline = simulateMultiMechanism(baseline_params);

  var scenario_results = [];
  for (var i = 0; i < scenarios.length; i++) {
    var sc = scenarios[i];
    var merged = Object.assign({}, baseline_params, sc.parameters || {});
    if (sc.parameters && sc.parameters.crack) merged.crack = Object.assign({}, baseline_params.crack || baseline_params, sc.parameters.crack);
    if (sc.parameters && sc.parameters.corrosion) merged.corrosion = Object.assign({}, baseline_params.corrosion || baseline_params, sc.parameters.corrosion);
    if (sc.parameters && sc.parameters.fatigue) merged.fatigue = Object.assign({}, baseline_params.fatigue || baseline_params, sc.parameters.fatigue);
    if (sc.parameters && sc.parameters.coating) merged.coating = Object.assign({}, baseline_params.coating || baseline_params, sc.parameters.coating);

    var sc_result = simulateMultiMechanism(merged);

    var baseline_critical = baseline.critical_combined_damage_years || baseline.earliest_failure_years || 999;
    var sc_critical = sc_result.critical_combined_damage_years || sc_result.earliest_failure_years || 999;

    scenario_results.push({
      scenario_name: sc.name || "Scenario " + (i + 1),
      scenario_description: sc.description || "",
      modified_parameters: sc.parameters || {},
      critical_time_years: sc_critical < 999 ? sc_critical : null,
      baseline_critical_years: baseline_critical < 999 ? baseline_critical : null,
      life_extension_years: sc_critical - baseline_critical,
      improvement_pct: baseline_critical > 0 ? Math.round(((sc_critical - baseline_critical) / baseline_critical) * 1000) / 10 : 0,
      mechanisms_at_risk: sc_result.mechanisms_at_risk,
      recommendation: sc_result.recommendation
    });
  }

  scenario_results.sort(function(a, b) { return (b.life_extension_years || 0) - (a.life_extension_years || 0); });

  return {
    action: "run_what_if",
    baseline: {
      critical_time_years: baseline.critical_combined_damage_years || baseline.earliest_failure_years,
      mechanisms_at_risk: baseline.mechanisms_at_risk,
      intervention_window: baseline.intervention_window
    },
    scenarios: scenario_results,
    best_scenario: scenario_results.length > 0 ? scenario_results[0].scenario_name : null,
    worst_scenario: scenario_results.length > 0 ? scenario_results[scenario_results.length - 1].scenario_name : null,
    confidence: 0.75
  };
}

// ── DB PERSISTENCE ──────────────────────────────────────────────
async function saveSimulation(case_id, simulation_type, params, result) {
  try {
    var row = {
      case_id: case_id,
      asset_id: params.asset_id || null,
      simulation_type: simulation_type,
      initial_state: params,
      boundary_conditions: { environment: params.environment, climate: params.climate, material: params.material },
      physics_parameters: result.parameters || {},
      time_horizon_years: params.time_horizon_years || 20,
      time_steps: params.time_steps || 80,
      results: result,
      critical_threshold: { time_to_critical: result.time_to_critical_years || result.time_to_minimum_wall_years || result.time_to_failure_years || result.critical_combined_damage_years },
      time_to_critical: (result.time_to_critical_years || result.time_to_minimum_wall_years || result.time_to_failure_years || result.critical_combined_damage_years || "none") + " years",
      confidence: result.confidence || 0.78,
      status: "completed"
    };
    await supabase.from("world_model_simulations").insert([row]);
  } catch (e) { /* non-fatal */ }
}

async function getSimulationHistory(params) {
  var query = supabase.from("world_model_simulations").select("*").order("created_at", { ascending: false }).limit(params.limit || 20);
  if (params.case_id) query = query.eq("case_id", params.case_id);
  if (params.simulation_type) query = query.eq("simulation_type", params.simulation_type);
  if (params.asset_id) query = query.eq("asset_id", params.asset_id);

  try {
    var res = await query;
    return { action: "get_simulation_history", simulations: (res.data || []), count: (res.data || []).length };
  } catch (e) {
    return { action: "get_simulation_history", simulations: [], count: 0, note: "DB unavailable" };
  }
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
      engine_code: "inspection-world-model",
      engine_version: "1.0.0",
      engine_name: "Inspection World Model Engine",
      deploy: "DEPLOY317",
      layer: "Layer 1 — Physical World Model",
      description: "Simulates damage progression over time using embedded physics models. Generates future states, runs parallel what-if scenarios, and predicts failure timelines.",
      physics_models: ["Paris Law (crack growth)", "Power Law (corrosion)", "Miners Rule + S-N Curve (fatigue)", "Service Life Model (coating)", "Combined Damage Index (multi-mechanism)"],
      supported_materials: Object.keys(CRACK_GROWTH_PARAMS),
      supported_environments: Object.keys(CORROSION_PARAMS),
      supported_coatings: Object.keys(COATING_PARAMS),
      actions: ["get_registry", "simulate_crack_growth", "simulate_corrosion", "simulate_fatigue", "simulate_coating", "simulate_multi_mechanism", "generate_future_states", "run_what_if", "get_simulation_history"],
      status: "operational"
    });
  }

  if (action === "simulate_crack_growth") {
    var result = simulateCrackGrowth(requestData);
    if (requestData.case_id) await saveSimulation(requestData.case_id, "crack_growth", requestData, result);
    return buildResult(200, { action: action, engine: "inspection-world-model", result: result, timestamp: new Date().toISOString() });
  }

  if (action === "simulate_corrosion") {
    var result = simulateCorrosion(requestData);
    if (requestData.case_id) await saveSimulation(requestData.case_id, "corrosion", requestData, result);
    return buildResult(200, { action: action, engine: "inspection-world-model", result: result, timestamp: new Date().toISOString() });
  }

  if (action === "simulate_fatigue") {
    var result = simulateFatigue(requestData);
    if (requestData.case_id) await saveSimulation(requestData.case_id, "fatigue", requestData, result);
    return buildResult(200, { action: action, engine: "inspection-world-model", result: result, timestamp: new Date().toISOString() });
  }

  if (action === "simulate_coating") {
    var result = simulateCoatingBreakdown(requestData);
    if (requestData.case_id) await saveSimulation(requestData.case_id, "coating", requestData, result);
    return buildResult(200, { action: action, engine: "inspection-world-model", result: result, timestamp: new Date().toISOString() });
  }

  if (action === "simulate_multi_mechanism") {
    var result = simulateMultiMechanism(requestData);
    if (requestData.case_id) await saveSimulation(requestData.case_id, "multi_mechanism", requestData, result);
    return buildResult(200, { action: action, engine: "inspection-world-model", result: result, timestamp: new Date().toISOString() });
  }

  if (action === "generate_future_states") {
    var result = generateFutureStates(requestData);
    if (requestData.case_id) await saveSimulation(requestData.case_id, "future_states", requestData, result);
    return buildResult(200, { action: action, engine: "inspection-world-model", result: result, timestamp: new Date().toISOString() });
  }

  if (action === "run_what_if") {
    var result = runWhatIf(requestData);
    return buildResult(200, { action: action, engine: "inspection-world-model", result: result, timestamp: new Date().toISOString() });
  }

  if (action === "get_simulation_history") {
    var result = await getSimulationHistory(requestData);
    return buildResult(200, { action: action, engine: "inspection-world-model", result: result, timestamp: new Date().toISOString() });
  }

  return holdResult(400, "Unknown action: " + action, action);
};
