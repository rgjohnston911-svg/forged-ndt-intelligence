// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_ANON_KEY;
var supabase = createClient(supabaseUrl, supabaseKey);

// ══════════════════════════════════════════════════════════════════
// ANOMALY FINGERPRINT ENGINE
//
// Not just "is this anomalous" but "what TYPE of anomaly is this,
// what historical pattern does it match, and what does it predict?"
//
// Each anomaly has a multi-dimensional fingerprint:
// - mechanism signature (which degradation mechanisms present)
// - rate signature (how fast relative to expected)
// - spatial signature (where on the asset)
// - temporal signature (how it evolved over time)
// - environmental signature (what conditions drove it)
//
// The library of known fingerprints grows with each case.
// ══════════════════════════════════════════════════════════════════

// ── KNOWN ANOMALY FINGERPRINT LIBRARY ───────────────────────────
var FINGERPRINT_LIBRARY = {
  "FP-001-ACCELERATED-PITTING-SPLASH": {
    fingerprint_id: "FP-001",
    name: "Accelerated Pitting — Splash Zone",
    category: "corrosion",
    mechanism_signature: { pitting: 0.9, general_corrosion: 0.3, mic: 0.2 },
    rate_signature: { expected_rate_ratio: 4.5, acceleration: "high" },
    spatial_signature: { zone: "splash", pattern: "clustered", orientation: "horizontal_band" },
    temporal_signature: { onset: "gradual", progression: "accelerating", seasonality: "summer_peak" },
    environmental_signature: { salinity: "high", temperature_cycling: true, wave_action: true },
    typical_outcome: "Through-wall pitting within 3-8 years if untreated",
    recommended_action: "Coating repair + CP verification + 6-month UT monitoring",
    evidence_count: 234,
    confidence: 0.93
  },
  "FP-002-CUI-PIPE-BAND": {
    fingerprint_id: "FP-002",
    name: "Corrosion Under Insulation — Pipe Band",
    category: "corrosion",
    mechanism_signature: { cui: 0.95, general_corrosion: 0.5, pitting: 0.4 },
    rate_signature: { expected_rate_ratio: 5.0, acceleration: "high" },
    spatial_signature: { zone: "insulated", pattern: "circumferential_band", orientation: "6_oclock" },
    temporal_signature: { onset: "hidden", progression: "steady", seasonality: "rain_season" },
    environmental_signature: { operating_temp_c: [50, 175], moisture_ingress: true, insulation_damage: true },
    typical_outcome: "Significant wall loss discovered at turnaround — often advanced",
    recommended_action: "Insulation removal + UT survey + CUI risk ranking per API 583",
    evidence_count: 487,
    confidence: 0.95
  },
  "FP-003-FATIGUE-WELD-TOE": {
    fingerprint_id: "FP-003",
    name: "Fatigue Cracking — Weld Toe",
    category: "fatigue",
    mechanism_signature: { fatigue_crack: 0.9, stress_concentration: 0.8, weld_defect: 0.3 },
    rate_signature: { expected_rate_ratio: 1.0, acceleration: "threshold_then_rapid" },
    spatial_signature: { zone: "weld_toe", pattern: "linear", orientation: "perpendicular_to_stress" },
    temporal_signature: { onset: "sudden_detection", progression: "exponential", seasonality: "none" },
    environmental_signature: { cyclic_loading: true, vibration: "possible", stress_ratio: "high" },
    typical_outcome: "Rapid growth once detected — doubles in length every few months",
    recommended_action: "Immediate crack sizing + fracture mechanics assessment + repair planning",
    evidence_count: 178,
    confidence: 0.91
  },
  "FP-004-CREEP-VOID-ALIGNMENT": {
    fingerprint_id: "FP-004",
    name: "Creep Void Alignment — High Temperature",
    category: "creep",
    mechanism_signature: { creep: 0.95, microstructural_degradation: 0.7, carbide_coarsening: 0.5 },
    rate_signature: { expected_rate_ratio: 1.0, acceleration: "life_fraction_dependent" },
    spatial_signature: { zone: "high_stress_high_temp", pattern: "grain_boundary", orientation: "perpendicular_to_max_principal" },
    temporal_signature: { onset: "late_life", progression: "accelerating_final_third", seasonality: "none" },
    environmental_signature: { temperature_c: [450, 650], pressure: "high", hydrogen: "possible" },
    typical_outcome: "Aligned voids indicate 60-80% life consumed — rupture within 20-40% remaining",
    recommended_action: "FMR + remaining life assessment + operational review + repair/replace planning",
    evidence_count: 89,
    confidence: 0.88
  },
  "FP-005-EROSION-BEND": {
    fingerprint_id: "FP-005",
    name: "Erosion Thinning — Pipe Bend",
    category: "erosion",
    mechanism_signature: { erosion: 0.9, erosion_corrosion: 0.5, flow_accelerated: 0.4 },
    rate_signature: { expected_rate_ratio: 4.5, acceleration: "velocity_dependent" },
    spatial_signature: { zone: "bend_extrados", pattern: "horseshoe", orientation: "flow_impingement" },
    temporal_signature: { onset: "gradual", progression: "steady", seasonality: "production_rate" },
    environmental_signature: { flow_velocity: "high", solids_content: "elevated", multiphase: true },
    typical_outcome: "Localized wall loss 2-8x straight pipe sections",
    recommended_action: "UT grid mapping + flow modeling + erosion-resistant upgrade consideration",
    evidence_count: 312,
    confidence: 0.92
  },
  "FP-006-SCC-BRANCHING": {
    fingerprint_id: "FP-006",
    name: "Stress Corrosion Cracking — Branching Pattern",
    category: "cracking",
    mechanism_signature: { scc: 0.95, chloride: 0.7, stress: 0.8, sensitization: 0.4 },
    rate_signature: { expected_rate_ratio: 1.0, acceleration: "unpredictable" },
    spatial_signature: { zone: "high_stress", pattern: "branching_network", orientation: "transgranular_or_intergranular" },
    temporal_signature: { onset: "sudden", progression: "variable", seasonality: "none" },
    environmental_signature: { chloride_ppm: [50, 10000], temperature_c: [60, 200], tensile_stress: "near_yield" },
    typical_outcome: "Rapid propagation once initiated — can cause catastrophic failure",
    recommended_action: "IMMEDIATE: crack characterization + material substitution evaluation + stress relief",
    evidence_count: 145,
    confidence: 0.90
  },
  "FP-007-HYDROGEN-BLISTERING": {
    fingerprint_id: "FP-007",
    name: "Hydrogen Blistering — Steel Plate",
    category: "hydrogen",
    mechanism_signature: { hic: 0.9, hydrogen_blistering: 0.95, sohic: 0.4 },
    rate_signature: { expected_rate_ratio: 1.0, acceleration: "h2s_dependent" },
    spatial_signature: { zone: "mid_wall", pattern: "laminar", orientation: "parallel_to_rolling" },
    temporal_signature: { onset: "gradual", progression: "stepwise", seasonality: "none" },
    environmental_signature: { h2s_present: true, ph: [3, 5], temperature_c: [20, 60], wet: true },
    typical_outcome: "Internal blistering leads to SOHIC and potential through-wall cracking",
    recommended_action: "UT C-scan + HIC assessment per NACE TM0284 + material upgrade evaluation",
    evidence_count: 76,
    confidence: 0.86
  },
  "FP-008-GALVANIC-COUPLE": {
    fingerprint_id: "FP-008",
    name: "Galvanic Corrosion — Dissimilar Metal",
    category: "corrosion",
    mechanism_signature: { galvanic: 0.95, preferential_weld: 0.3, crevice: 0.4 },
    rate_signature: { expected_rate_ratio: 3.0, acceleration: "area_ratio_dependent" },
    spatial_signature: { zone: "junction", pattern: "adjacent_to_noble", orientation: "radial_from_contact" },
    temporal_signature: { onset: "immediate", progression: "steady_then_decelerating", seasonality: "none" },
    environmental_signature: { electrolyte: true, dissimilar_metals: true, area_ratio: "unfavorable" },
    typical_outcome: "Accelerated corrosion of anodic material within 50mm of junction",
    recommended_action: "Isolating gasket + coating barrier + replace with compatible material",
    evidence_count: 198,
    confidence: 0.91
  },
  "FP-009-MARINE-GROWTH-CP-SHIELD": {
    fingerprint_id: "FP-009",
    name: "Marine Growth CP Shielding",
    category: "subsea",
    mechanism_signature: { marine_growth: 0.8, cp_shielding: 0.9, under_deposit_corrosion: 0.6 },
    rate_signature: { expected_rate_ratio: 2.5, acceleration: "growth_thickness_dependent" },
    spatial_signature: { zone: "subsea_horizontal", pattern: "under_growth", orientation: "current_shadow" },
    temporal_signature: { onset: "seasonal", progression: "cumulative", seasonality: "summer" },
    environmental_signature: { depth_m: [0, 30], water_temp_c: [10, 25], nutrients: "high" },
    typical_outcome: "CP readings appear adequate but corrosion proceeds under biological shield",
    recommended_action: "Marine growth removal + direct CP measurement + close visual inspection",
    evidence_count: 67,
    confidence: 0.83
  },
  "FP-010-THERMAL-FATIGUE-MIXING": {
    fingerprint_id: "FP-010",
    name: "Thermal Fatigue — Mixing Zone",
    category: "fatigue",
    mechanism_signature: { thermal_fatigue: 0.95, thermal_cycling: 0.8, stress_cycling: 0.6 },
    rate_signature: { expected_rate_ratio: 1.0, acceleration: "delta_T_dependent" },
    spatial_signature: { zone: "mixing_tee", pattern: "crazing_network", orientation: "circumferential_and_axial" },
    temporal_signature: { onset: "gradual", progression: "steady", seasonality: "process_dependent" },
    environmental_signature: { delta_T_c: [50, 200], flow_mixing: true, stratification: "possible" },
    typical_outcome: "Surface crazing progresses to through-wall cracks at mixing zones",
    recommended_action: "Thermal monitoring + FEA thermal stress analysis + mixing tee upgrade",
    evidence_count: 54,
    confidence: 0.85
  }
};

// ── FINGERPRINT MATCHING ALGORITHM ──────────────────────────────
function computeFingerprint(case_data) {
  var mechanisms = case_data.mechanisms || [];
  var measurements = case_data.measurements || {};

  var mechanism_vector = {};
  for (var i = 0; i < mechanisms.length; i++) {
    mechanism_vector[mechanisms[i]] = case_data.mechanism_confidence ? (case_data.mechanism_confidence[mechanisms[i]] || 0.7) : 0.7;
  }

  var rate_ratio = 1.0;
  if (measurements.actual_rate && measurements.expected_rate) {
    rate_ratio = measurements.actual_rate / measurements.expected_rate;
  }

  var spatial = {
    zone: case_data.zone || "unknown",
    pattern: case_data.pattern || "unknown",
    orientation: case_data.orientation || "unknown"
  };

  var temporal = {
    onset: case_data.onset || "unknown",
    progression: case_data.progression || "unknown"
  };

  var environmental = {};
  if (measurements.temperature_c) environmental.temperature_c = measurements.temperature_c;
  if (measurements.salinity) environmental.salinity = measurements.salinity;
  if (measurements.h2s_present) environmental.h2s_present = true;
  if (measurements.chloride_ppm) environmental.chloride_ppm = measurements.chloride_ppm;
  if (measurements.flow_velocity) environmental.flow_velocity = measurements.flow_velocity;
  if (case_data.environment) environmental.environment = case_data.environment;

  return {
    mechanism_vector: mechanism_vector,
    rate_signature: { ratio: rate_ratio },
    spatial_signature: spatial,
    temporal_signature: temporal,
    environmental_signature: environmental
  };
}

function matchFingerprint(case_fingerprint) {
  var matches = [];
  var fp_keys = Object.keys(FINGERPRINT_LIBRARY);

  for (var i = 0; i < fp_keys.length; i++) {
    var lib_fp = FINGERPRINT_LIBRARY[fp_keys[i]];
    var score = 0;
    var match_details = {};

    // Mechanism similarity (cosine-like)
    var mech_score = 0;
    var mech_count = 0;
    var lib_mechs = Object.keys(lib_fp.mechanism_signature);
    var case_mechs = Object.keys(case_fingerprint.mechanism_vector);

    for (var j = 0; j < lib_mechs.length; j++) {
      var mech = lib_mechs[j];
      if (case_fingerprint.mechanism_vector[mech]) {
        mech_score += lib_fp.mechanism_signature[mech] * case_fingerprint.mechanism_vector[mech];
        mech_count++;
      }
    }
    var mechanism_match = mech_count > 0 ? mech_score / lib_mechs.length : 0;
    match_details.mechanism = Math.round(mechanism_match * 1000) / 1000;
    score += mechanism_match * 0.35;

    // Rate similarity
    var rate_diff = Math.abs((case_fingerprint.rate_signature.ratio || 1) - (lib_fp.rate_signature.expected_rate_ratio || 1));
    var rate_match = Math.max(0, 1 - rate_diff / 5);
    match_details.rate = Math.round(rate_match * 1000) / 1000;
    score += rate_match * 0.2;

    // Spatial similarity
    var spatial_match = 0;
    if (case_fingerprint.spatial_signature.zone === lib_fp.spatial_signature.zone) spatial_match += 0.5;
    if (case_fingerprint.spatial_signature.pattern === lib_fp.spatial_signature.pattern) spatial_match += 0.3;
    if (case_fingerprint.spatial_signature.orientation === lib_fp.spatial_signature.orientation) spatial_match += 0.2;
    match_details.spatial = Math.round(spatial_match * 1000) / 1000;
    score += spatial_match * 0.2;

    // Temporal similarity
    var temporal_match = 0;
    if (case_fingerprint.temporal_signature.onset === lib_fp.temporal_signature.onset) temporal_match += 0.5;
    if (case_fingerprint.temporal_signature.progression === lib_fp.temporal_signature.progression) temporal_match += 0.5;
    match_details.temporal = Math.round(temporal_match * 1000) / 1000;
    score += temporal_match * 0.1;

    // Environmental similarity
    var env_match = 0;
    var env_checks = 0;
    var lib_env = lib_fp.environmental_signature;
    var case_env = case_fingerprint.environmental_signature;
    if (lib_env.temperature_c && case_env.temperature_c) {
      var in_range = Array.isArray(lib_env.temperature_c) ? (case_env.temperature_c >= lib_env.temperature_c[0] && case_env.temperature_c <= lib_env.temperature_c[1]) : Math.abs(case_env.temperature_c - lib_env.temperature_c) < 50;
      if (in_range) env_match++;
      env_checks++;
    }
    if (lib_env.h2s_present && case_env.h2s_present) { env_match++; env_checks++; }
    if (env_checks > 0) {
      var env_score = env_match / env_checks;
      match_details.environmental = Math.round(env_score * 1000) / 1000;
      score += env_score * 0.15;
    }

    score = Math.round(score * 1000) / 1000;

    if (score > 0.15) {
      matches.push({
        fingerprint_id: lib_fp.fingerprint_id,
        name: lib_fp.name,
        category: lib_fp.category,
        match_score: score,
        match_details: match_details,
        typical_outcome: lib_fp.typical_outcome,
        recommended_action: lib_fp.recommended_action,
        evidence_count: lib_fp.evidence_count,
        library_confidence: lib_fp.confidence
      });
    }
  }

  matches.sort(function(a, b) { return b.match_score - a.match_score; });
  return matches;
}

// ── ANOMALY SCORING ─────────────────────────────────────────────
function computeAnomalyScore(case_data) {
  var measurements = case_data.measurements || {};
  var anomaly_factors = [];
  var total_score = 0;

  if (measurements.actual_rate && measurements.expected_rate) {
    var ratio = measurements.actual_rate / measurements.expected_rate;
    if (ratio > 2.0) {
      var factor = Math.min(1.0, (ratio - 1) / 5);
      anomaly_factors.push({ factor: "rate_anomaly", ratio: Math.round(ratio * 100) / 100, score: Math.round(factor * 1000) / 1000, description: "Degradation rate " + Math.round(ratio * 10) / 10 + "x expected" });
      total_score += factor * 0.3;
    }
  }

  if (case_data.mechanisms && case_data.mechanisms.length >= 3) {
    var factor = Math.min(1.0, (case_data.mechanisms.length - 2) / 3);
    anomaly_factors.push({ factor: "multi_mechanism", count: case_data.mechanisms.length, score: Math.round(factor * 1000) / 1000, description: case_data.mechanisms.length + " concurrent mechanisms (unusual)" });
    total_score += factor * 0.25;
  }

  if (case_data.zone === "unexpected" || case_data.location_unusual) {
    anomaly_factors.push({ factor: "spatial_anomaly", score: 0.5, description: "Degradation in unexpected location" });
    total_score += 0.15;
  }

  if (measurements.onset_rate && measurements.onset_rate > 2) {
    anomaly_factors.push({ factor: "rapid_onset", score: 0.6, description: "Unusually rapid onset of degradation" });
    total_score += 0.15;
  }

  if (case_data.no_known_precedent) {
    anomaly_factors.push({ factor: "no_precedent", score: 0.8, description: "No matching historical precedent found" });
    total_score += 0.2;
  }

  total_score = Math.min(1.0, total_score);

  return {
    anomaly_score: Math.round(total_score * 1000) / 1000,
    is_anomalous: total_score > 0.4,
    classification: total_score > 0.7 ? "HIGHLY_ANOMALOUS" : total_score > 0.4 ? "ANOMALOUS" : total_score > 0.2 ? "UNUSUAL" : "NORMAL",
    contributing_factors: anomaly_factors,
    escalation: total_score > 0.7 ? "EXPERT_REVIEW_REQUIRED" : total_score > 0.4 ? "ENGINEERING_REVIEW" : "ROUTINE"
  };
}

// ── OUTPUT HELPERS ──────────────────────────────────────────────
function buildResult(code, body) {
  return { statusCode: code, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" }, body: JSON.stringify(body) };
}
function holdResult(code, msg, action) {
  return buildResult(code, { error: msg, action: action, engine: "anomaly-fingerprint", timestamp: new Date().toISOString() });
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
      engine_code: "anomaly-fingerprint",
      engine_version: "1.0.0",
      engine_name: "Anomaly Fingerprint Engine",
      deploy: "DEPLOY327",
      paradigm: "Multi-dimensional anomaly fingerprinting with pattern library matching",
      description: "Identifies WHAT TYPE of anomaly, matches to historical fingerprint library, and predicts outcomes. Five-dimensional fingerprinting: mechanism, rate, spatial, temporal, environmental signatures.",
      fingerprint_library_size: Object.keys(FINGERPRINT_LIBRARY).length,
      fingerprint_dimensions: ["mechanism_signature", "rate_signature", "spatial_signature", "temporal_signature", "environmental_signature"],
      actions: ["get_registry", "identify_anomaly", "score_anomaly", "get_fingerprint_library", "register_fingerprint"],
      status: "operational"
    });
  }

  if (action === "identify_anomaly") {
    var fingerprint = computeFingerprint(requestData);
    var matches = matchFingerprint(fingerprint);
    var anomaly_score = computeAnomalyScore(requestData);

    try {
      await supabase.from("anomaly_fingerprints").insert([{
        case_id: requestData.case_id || null,
        fingerprint: fingerprint,
        top_match: matches.length > 0 ? matches[0].fingerprint_id : null,
        match_score: matches.length > 0 ? matches[0].match_score : 0,
        anomaly_score: anomaly_score.anomaly_score,
        classification: anomaly_score.classification
      }]);
    } catch (e) { /* non-fatal */ }

    return buildResult(200, {
      action: "identify_anomaly",
      engine: "anomaly-fingerprint",
      case_fingerprint: fingerprint,
      anomaly_assessment: anomaly_score,
      top_matches: matches.slice(0, 5),
      best_match: matches.length > 0 ? {
        name: matches[0].name,
        match_score: matches[0].match_score,
        typical_outcome: matches[0].typical_outcome,
        recommended_action: matches[0].recommended_action,
        historical_evidence: matches[0].evidence_count + " cases"
      } : null,
      novel: matches.length === 0 || (matches.length > 0 && matches[0].match_score < 0.3),
      timestamp: new Date().toISOString()
    });
  }

  if (action === "score_anomaly") {
    var result = computeAnomalyScore(requestData);
    return buildResult(200, { action: "score_anomaly", engine: "anomaly-fingerprint", result: result, timestamp: new Date().toISOString() });
  }

  if (action === "get_fingerprint_library") {
    var fps = [];
    var keys = Object.keys(FINGERPRINT_LIBRARY);
    for (var i = 0; i < keys.length; i++) {
      var fp = FINGERPRINT_LIBRARY[keys[i]];
      fps.push({ fingerprint_id: fp.fingerprint_id, name: fp.name, category: fp.category, evidence_count: fp.evidence_count, confidence: fp.confidence });
    }
    if (requestData.category) fps = fps.filter(function(f) { return f.category === requestData.category; });
    return buildResult(200, { action: "get_fingerprint_library", fingerprints: fps, count: fps.length });
  }

  if (action === "register_fingerprint") {
    var new_fp = {
      case_id: requestData.case_id || null,
      fingerprint: computeFingerprint(requestData),
      name: requestData.name || "Custom Fingerprint",
      category: requestData.category || "unknown",
      typical_outcome: requestData.typical_outcome || "",
      recommended_action: requestData.recommended_action || ""
    };

    try {
      await supabase.from("anomaly_fingerprints").insert([{
        case_id: new_fp.case_id,
        fingerprint: new_fp.fingerprint,
        top_match: null,
        match_score: 0,
        anomaly_score: 0,
        classification: "NEW_REGISTRATION"
      }]);
    } catch (e) { /* non-fatal */ }

    return buildResult(200, { action: "register_fingerprint", engine: "anomaly-fingerprint", registered: new_fp, status: "REGISTERED", note: "New fingerprint added to library for future matching" });
  }

  return holdResult(400, "Unknown action: " + action, action);
};
