// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_ANON_KEY;
var supabase = createClient(supabaseUrl, supabaseKey);

// ── INSPECTION TYPE REGISTRY ────────────────────────────────────
// Each inspection type has cost, time, and information gain properties
var INSPECTION_TYPES = {
  visual: {
    name: "Visual Inspection",
    cost_usd: 500,
    time_hours: 2,
    base_uncertainty_reduction: 0.10,
    applicable_mechanisms: ["corrosion", "coating", "structural", "marine_growth"],
    requires_access: "external",
    skill_level: "Level II"
  },
  ut_thickness: {
    name: "Ultrasonic Thickness",
    cost_usd: 1500,
    time_hours: 4,
    base_uncertainty_reduction: 0.35,
    applicable_mechanisms: ["corrosion", "erosion", "wall_thinning"],
    requires_access: "surface",
    skill_level: "Level II"
  },
  ut_shear_wave: {
    name: "UT Shear Wave (Weld)",
    cost_usd: 3000,
    time_hours: 8,
    base_uncertainty_reduction: 0.40,
    applicable_mechanisms: ["cracking", "weld_defect", "fatigue_crack"],
    requires_access: "surface",
    skill_level: "Level II"
  },
  phased_array: {
    name: "Phased Array UT",
    cost_usd: 5000,
    time_hours: 6,
    base_uncertainty_reduction: 0.50,
    applicable_mechanisms: ["cracking", "corrosion", "weld_defect", "lamination"],
    requires_access: "surface",
    skill_level: "Level II"
  },
  tofd: {
    name: "Time of Flight Diffraction",
    cost_usd: 4000,
    time_hours: 6,
    base_uncertainty_reduction: 0.45,
    applicable_mechanisms: ["cracking", "fatigue_crack", "stress_corrosion"],
    requires_access: "surface",
    skill_level: "Level II"
  },
  radiography: {
    name: "Radiographic Testing",
    cost_usd: 4500,
    time_hours: 8,
    base_uncertainty_reduction: 0.42,
    applicable_mechanisms: ["weld_defect", "corrosion", "erosion", "casting_defect"],
    requires_access: "dual_side",
    skill_level: "Level II"
  },
  mpi: {
    name: "Magnetic Particle Inspection",
    cost_usd: 1000,
    time_hours: 3,
    base_uncertainty_reduction: 0.25,
    applicable_mechanisms: ["surface_crack", "fatigue_crack", "weld_defect"],
    requires_access: "surface",
    skill_level: "Level II"
  },
  dye_penetrant: {
    name: "Liquid Penetrant Testing",
    cost_usd: 800,
    time_hours: 3,
    base_uncertainty_reduction: 0.20,
    applicable_mechanisms: ["surface_crack", "porosity", "weld_defect"],
    requires_access: "surface",
    skill_level: "Level I"
  },
  eddy_current: {
    name: "Eddy Current Testing",
    cost_usd: 2500,
    time_hours: 4,
    base_uncertainty_reduction: 0.35,
    applicable_mechanisms: ["surface_crack", "subsurface_defect", "coating_thickness"],
    requires_access: "surface",
    skill_level: "Level II"
  },
  rvi: {
    name: "Remote Visual Inspection (RVI)",
    cost_usd: 3500,
    time_hours: 6,
    base_uncertainty_reduction: 0.15,
    applicable_mechanisms: ["corrosion", "erosion", "blockage", "structural"],
    requires_access: "internal",
    skill_level: "Level II"
  },
  guided_wave: {
    name: "Guided Wave UT",
    cost_usd: 8000,
    time_hours: 8,
    base_uncertainty_reduction: 0.30,
    applicable_mechanisms: ["corrosion", "erosion", "wall_thinning"],
    requires_access: "pipe_segment",
    skill_level: "Level III"
  },
  cp_survey: {
    name: "Cathodic Protection Survey",
    cost_usd: 2000,
    time_hours: 4,
    base_uncertainty_reduction: 0.30,
    applicable_mechanisms: ["cp_degradation", "anode_depletion", "stray_current"],
    requires_access: "subsea",
    skill_level: "Level II"
  },
  fmd_replication: {
    name: "Field Metallographic Replication",
    cost_usd: 3500,
    time_hours: 6,
    base_uncertainty_reduction: 0.45,
    applicable_mechanisms: ["creep", "microstructural_degradation", "phase_transformation"],
    requires_access: "surface",
    skill_level: "Level III"
  },
  hardness_test: {
    name: "Hardness Testing",
    cost_usd: 800,
    time_hours: 2,
    base_uncertainty_reduction: 0.20,
    applicable_mechanisms: ["temper_embrittlement", "hydrogen_damage", "heat_treatment"],
    requires_access: "surface",
    skill_level: "Level II"
  },
  vibration_analysis: {
    name: "Vibration Analysis",
    cost_usd: 2000,
    time_hours: 4,
    base_uncertainty_reduction: 0.30,
    applicable_mechanisms: ["fatigue", "misalignment", "bearing_failure", "resonance"],
    requires_access: "external",
    skill_level: "Level II"
  },
  diving_inspection: {
    name: "Diving Inspection",
    cost_usd: 25000,
    time_hours: 16,
    base_uncertainty_reduction: 0.40,
    applicable_mechanisms: ["corrosion", "marine_growth", "cp_degradation", "structural"],
    requires_access: "subsea",
    skill_level: "Commercial Diver + Level II"
  },
  rov_inspection: {
    name: "ROV Inspection",
    cost_usd: 35000,
    time_hours: 24,
    base_uncertainty_reduction: 0.35,
    applicable_mechanisms: ["corrosion", "marine_growth", "structural", "scour"],
    requires_access: "deep_subsea",
    skill_level: "ROV Pilot + Level II"
  }
};

// ── INFORMATION GAIN COMPUTATION ────────────────────────────────
// Uses information-theoretic approach: expected reduction in entropy
function computeInformationGain(inspection_type, asset_state) {
  var insp = INSPECTION_TYPES[inspection_type];
  if (!insp) return { gain: 0, error: "Unknown inspection type" };

  var current_uncertainty = asset_state.uncertainty || 0.5;
  var mechanisms = asset_state.active_mechanisms || [];
  var last_inspection_days = asset_state.days_since_last_inspection || 365;
  var risk_level = asset_state.risk_level || "medium";

  // Base reduction from inspection capability
  var base_reduction = insp.base_uncertainty_reduction;

  // Mechanism relevance multiplier
  var mechanism_overlap = 0;
  for (var i = 0; i < mechanisms.length; i++) {
    if (insp.applicable_mechanisms.indexOf(mechanisms[i]) >= 0) mechanism_overlap++;
  }
  var relevance = mechanisms.length > 0 ? mechanism_overlap / mechanisms.length : 0.5;

  // Time decay: longer since last inspection = more information gain
  var time_factor = Math.min(2.0, 1.0 + (last_inspection_days / 365) * 0.3);

  // Risk amplification: higher risk = more value in reducing uncertainty
  var risk_factor = risk_level === "critical" ? 1.5 : risk_level === "high" ? 1.3 : risk_level === "medium" ? 1.0 : 0.8;

  // Diminishing returns: already-low uncertainty gains less
  var diminishing = current_uncertainty > 0.3 ? 1.0 : current_uncertainty / 0.3;

  var expected_gain = base_reduction * relevance * time_factor * risk_factor * diminishing;
  expected_gain = Math.min(expected_gain, current_uncertainty);

  var new_uncertainty = current_uncertainty - expected_gain;
  var cost_per_uncertainty_point = insp.cost_usd / (expected_gain || 0.001);

  return {
    inspection_type: inspection_type,
    inspection_name: insp.name,
    current_uncertainty: Math.round(current_uncertainty * 1000) / 1000,
    expected_uncertainty_after: Math.round(new_uncertainty * 1000) / 1000,
    expected_information_gain: Math.round(expected_gain * 10000) / 10000,
    uncertainty_reduction_pct: Math.round((expected_gain / current_uncertainty) * 1000) / 10,
    cost_usd: insp.cost_usd,
    time_hours: insp.time_hours,
    cost_per_uncertainty_point: Math.round(cost_per_uncertainty_point),
    efficiency_score: Math.round((expected_gain / (insp.cost_usd / 10000)) * 10000) / 10000,
    mechanism_relevance: Math.round(relevance * 1000) / 1000,
    factors: {
      base_reduction: base_reduction,
      mechanism_relevance: Math.round(relevance * 1000) / 1000,
      time_factor: Math.round(time_factor * 100) / 100,
      risk_factor: risk_factor,
      diminishing_returns: Math.round(diminishing * 100) / 100
    }
  };
}

// ── PORTFOLIO OPTIMIZATION ──────────────────────────────────────
function optimizePortfolio(assets, budget, time_window_hours) {
  var all_options = [];

  for (var i = 0; i < assets.length; i++) {
    var asset = assets[i];
    var insp_keys = Object.keys(INSPECTION_TYPES);

    for (var j = 0; j < insp_keys.length; j++) {
      var gain = computeInformationGain(insp_keys[j], asset);
      if (gain.expected_information_gain > 0.01) {
        all_options.push({
          asset_id: asset.asset_id || "asset_" + i,
          asset_name: asset.asset_name || "Asset " + (i + 1),
          inspection_type: insp_keys[j],
          inspection_name: gain.inspection_name,
          gain: gain.expected_information_gain,
          cost: gain.cost_usd,
          time: gain.time_hours,
          efficiency: gain.efficiency_score,
          risk_level: asset.risk_level || "medium"
        });
      }
    }
  }

  // Greedy knapsack: sort by efficiency, pack within budget + time
  all_options.sort(function(a, b) { return (b.efficiency || 0) - (a.efficiency || 0); });

  var selected = [];
  var total_cost = 0;
  var total_time = 0;
  var total_gain = 0;
  var inspected_assets = {};

  for (var i = 0; i < all_options.length; i++) {
    var opt = all_options[i];

    if (inspected_assets[opt.asset_id + "_" + opt.inspection_type]) continue;

    if (total_cost + opt.cost <= budget && total_time + opt.time <= time_window_hours) {
      selected.push(opt);
      total_cost += opt.cost;
      total_time += opt.time;
      total_gain += opt.gain;
      inspected_assets[opt.asset_id + "_" + opt.inspection_type] = true;
    }
  }

  return {
    selected_inspections: selected,
    total_inspections: selected.length,
    total_cost_usd: total_cost,
    total_time_hours: total_time,
    total_information_gain: Math.round(total_gain * 10000) / 10000,
    budget_used_pct: Math.round((total_cost / budget) * 1000) / 10,
    time_used_pct: Math.round((total_time / time_window_hours) * 1000) / 10,
    options_evaluated: all_options.length,
    optimization_method: "greedy_knapsack_by_efficiency"
  };
}

// ── OUTPUT HELPERS ──────────────────────────────────────────────
function buildResult(code, body) {
  return { statusCode: code, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" }, body: JSON.stringify(body) };
}
function holdResult(code, msg, action) {
  return buildResult(code, { error: msg, action: action, engine: "active-inspection-optimizer", timestamp: new Date().toISOString() });
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
      engine_code: "active-inspection-optimizer",
      engine_version: "1.0.0",
      engine_name: "Active Inspection Optimizer",
      deploy: "DEPLOY322",
      paradigm: "Active Learning + Information-Theoretic Inspection Scheduling",
      description: "Recommends optimal next inspection for maximum uncertainty reduction across the asset portfolio. Uses information gain computation, cost-efficiency ranking, and greedy knapsack optimization for budget-constrained scheduling.",
      inspection_types: Object.keys(INSPECTION_TYPES).length,
      actions: ["get_registry", "recommend_next", "compute_information_gain", "optimize_schedule", "get_portfolio_uncertainty", "get_inspection_types", "record_outcome"],
      optimization_method: "Greedy knapsack by efficiency score (information gain per dollar)",
      status: "operational"
    });
  }

  if (action === "recommend_next") {
    var asset_state = requestData;
    var candidates = [];
    var insp_keys = Object.keys(INSPECTION_TYPES);

    for (var i = 0; i < insp_keys.length; i++) {
      var gain = computeInformationGain(insp_keys[i], asset_state);
      if (gain.expected_information_gain > 0.01) {
        candidates.push(gain);
      }
    }

    candidates.sort(function(a, b) { return (b.efficiency_score || 0) - (a.efficiency_score || 0); });

    var top_by_gain = candidates.slice().sort(function(a, b) { return (b.expected_information_gain || 0) - (a.expected_information_gain || 0); });
    var top_by_cost = candidates.slice().sort(function(a, b) { return (a.cost_per_uncertainty_point || 0) - (b.cost_per_uncertainty_point || 0); });

    try {
      if (requestData.asset_id) {
        await supabase.from("inspection_priorities").insert([{
          asset_id: requestData.asset_id,
          recommended_inspection: candidates.length > 0 ? candidates[0].inspection_type : null,
          information_gain: candidates.length > 0 ? candidates[0].expected_information_gain : 0,
          current_uncertainty: requestData.uncertainty || 0.5,
          risk_level: requestData.risk_level || "medium",
          candidates_evaluated: candidates.length
        }]);
      }
    } catch (e) { /* non-fatal */ }

    return buildResult(200, {
      action: "recommend_next",
      engine: "active-inspection-optimizer",
      best_by_efficiency: candidates.length > 0 ? candidates[0] : null,
      best_by_information_gain: top_by_gain.length > 0 ? top_by_gain[0] : null,
      best_by_cost_effectiveness: top_by_cost.length > 0 ? top_by_cost[0] : null,
      all_candidates: candidates,
      recommendation: candidates.length > 0 ? "Recommended: " + candidates[0].inspection_name + " — expected " + Math.round(candidates[0].uncertainty_reduction_pct) + "% uncertainty reduction at $" + candidates[0].cost_usd : "No applicable inspections identified",
      timestamp: new Date().toISOString()
    });
  }

  if (action === "compute_information_gain") {
    var inspection_type = requestData.inspection_type;
    if (!inspection_type) return holdResult(400, "inspection_type required", action);
    var gain = computeInformationGain(inspection_type, requestData);
    return buildResult(200, { action: "compute_information_gain", engine: "active-inspection-optimizer", result: gain, timestamp: new Date().toISOString() });
  }

  if (action === "optimize_schedule") {
    var assets = requestData.assets || [];
    var budget = requestData.budget_usd || 100000;
    var time_window = requestData.time_window_hours || 160;

    if (assets.length === 0) return holdResult(400, "assets array required", action);

    var result = optimizePortfolio(assets, budget, time_window);
    return buildResult(200, { action: "optimize_schedule", engine: "active-inspection-optimizer", result: result, timestamp: new Date().toISOString() });
  }

  if (action === "get_portfolio_uncertainty") {
    try {
      var res = await supabase.from("inspection_priorities").select("*").order("created_at", { ascending: false }).limit(requestData.limit || 50);
      var priorities = res.data || [];

      var total_uncertainty = 0;
      var high_uncertainty = [];
      for (var i = 0; i < priorities.length; i++) {
        total_uncertainty += (priorities[i].current_uncertainty || 0);
        if ((priorities[i].current_uncertainty || 0) > 0.6) high_uncertainty.push(priorities[i]);
      }

      return buildResult(200, {
        action: "get_portfolio_uncertainty",
        total_assets_tracked: priorities.length,
        mean_uncertainty: priorities.length > 0 ? Math.round((total_uncertainty / priorities.length) * 1000) / 1000 : null,
        high_uncertainty_assets: high_uncertainty.length,
        assets_needing_inspection: high_uncertainty,
        portfolio_health: high_uncertainty.length === 0 ? "EXCELLENT" : high_uncertainty.length <= 3 ? "GOOD" : "ATTENTION_NEEDED"
      });
    } catch (e) {
      return buildResult(200, { action: "get_portfolio_uncertainty", total_assets_tracked: 0, note: "DB unavailable" });
    }
  }

  if (action === "get_inspection_types") {
    var types = [];
    var keys = Object.keys(INSPECTION_TYPES);
    for (var i = 0; i < keys.length; i++) {
      types.push(Object.assign({ type_code: keys[i] }, INSPECTION_TYPES[keys[i]]));
    }
    if (requestData.mechanism) {
      types = types.filter(function(t) { return t.applicable_mechanisms.indexOf(requestData.mechanism) >= 0; });
    }
    return buildResult(200, { action: "get_inspection_types", types: types, count: types.length });
  }

  if (action === "record_outcome") {
    var inspection_type = requestData.inspection_type;
    var actual_uncertainty_reduction = requestData.actual_uncertainty_reduction;

    if (!inspection_type || actual_uncertainty_reduction === undefined) {
      return holdResult(400, "inspection_type and actual_uncertainty_reduction required", action);
    }

    try {
      await supabase.from("inspection_priorities").insert([{
        asset_id: requestData.asset_id || null,
        recommended_inspection: inspection_type,
        information_gain: actual_uncertainty_reduction,
        current_uncertainty: requestData.uncertainty_before || null,
        risk_level: requestData.risk_level || null,
        candidates_evaluated: 0
      }]);
    } catch (e) { /* non-fatal */ }

    return buildResult(200, {
      action: "record_outcome",
      inspection_type: inspection_type,
      actual_uncertainty_reduction: actual_uncertainty_reduction,
      expected_reduction: INSPECTION_TYPES[inspection_type] ? INSPECTION_TYPES[inspection_type].base_uncertainty_reduction : null,
      performance_ratio: INSPECTION_TYPES[inspection_type] ? Math.round((actual_uncertainty_reduction / INSPECTION_TYPES[inspection_type].base_uncertainty_reduction) * 100) / 100 : null,
      feedback: "Outcome recorded for future optimization learning",
      status: "RECORDED"
    });
  }

  return holdResult(400, "Unknown action: " + action, action);
};
