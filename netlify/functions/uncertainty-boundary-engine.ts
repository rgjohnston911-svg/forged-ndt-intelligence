// @ts-nocheck
/**
 * DEPLOY276 - Uncertainty Boundary Engine v1.0.0
 * netlify/functions/uncertainty-boundary-engine.ts
 *
 * Deterministic uncertainty quantification and confidence boundary engine.
 * Tracks what the system KNOWS vs what it ASSUMES vs what it CANNOT KNOW.
 * Prevents overconfident recommendations by enforcing epistemic honesty.
 *
 * Architecture: AI models produce confidence estimates. This engine validates
 * those estimates against physics, evidence quality, and known limitations.
 * It enforces hard ceilings on confidence and identifies uncertainty sources.
 *
 * Knowledge base:
 *   15 uncertainty source categories
 *   12 measurement uncertainty models (NDT method-specific)
 *   8 epistemic boundary rules
 *   10 confidence ceiling modifiers
 *   6 knowledge state classifications
 *   Uncertainty propagation logic
 *
 * 10 actions:
 *   get_registry
 *   evaluate_uncertainty       -- full uncertainty assessment
 *   compute_confidence_ceiling -- max achievable confidence
 *   classify_knowledge_state   -- known/assumed/unknown classification
 *   get_measurement_uncertainty -- NDT method uncertainty data
 *   get_uncertainty_sources    -- all uncertainty source categories
 *   get_epistemic_boundaries   -- hard limits on knowability
 *   validate_confidence_claim  -- check if claimed confidence is justified
 *   get_uncertainty_propagation -- how uncertainties combine
 *   get_ceiling_modifiers      -- what reduces maximum confidence
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var ENGINE_NAME = "uncertainty-boundary-engine";
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

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

function nowISO() {
  return new Date().toISOString();
}

// ============================================================
// UNCERTAINTY SOURCE CATEGORIES — 15 categories
// ============================================================

var UNCERTAINTY_SOURCES = {
  measurement_precision: {
    key: "measurement_precision",
    name: "Measurement Precision (Aleatory)",
    category: "aleatory",
    description: "Inherent variability in measurement readings — gauge resolution, operator variation, surface condition",
    reducible: true,
    reduction_method: "Multiple readings, calibrated equipment, trained operators, controlled conditions",
    typical_impact: "low_to_moderate",
    confidence_penalty: 0.05
  },
  measurement_accuracy: {
    key: "measurement_accuracy",
    name: "Measurement Accuracy (Systematic)",
    category: "aleatory",
    description: "Systematic bias in measurement — calibration drift, method limitations, environmental effects",
    reducible: true,
    reduction_method: "Regular calibration, reference standards, method validation, environmental compensation",
    typical_impact: "moderate",
    confidence_penalty: 0.08
  },
  material_variability: {
    key: "material_variability",
    name: "Material Property Variability",
    category: "aleatory",
    description: "Natural variation in material properties — yield strength, toughness, composition within specification",
    reducible: false,
    reduction_method: "Material testing of actual component — reduces but cannot eliminate",
    typical_impact: "moderate",
    confidence_penalty: 0.07
  },
  environmental_variability: {
    key: "environmental_variability",
    name: "Environmental Condition Variability",
    category: "aleatory",
    description: "Variation in operating environment — temperature, pressure, chemistry, flow conditions",
    reducible: true,
    reduction_method: "Process monitoring, historical data analysis, operating envelope definition",
    typical_impact: "moderate_to_high",
    confidence_penalty: 0.10
  },
  inspection_coverage: {
    key: "inspection_coverage",
    name: "Inspection Coverage Limitation",
    category: "epistemic",
    description: "Not all areas can be inspected — access limitations, insulation, internal features",
    reducible: true,
    reduction_method: "Alternative NDT methods, insulation removal, internal inspection, guided wave",
    typical_impact: "high",
    confidence_penalty: 0.15
  },
  detection_probability: {
    key: "detection_probability",
    name: "Probability of Detection (POD) Limitation",
    category: "epistemic",
    description: "NDT method may not detect all flaws — POD varies by method, flaw type, size, orientation",
    reducible: true,
    reduction_method: "Complementary methods, qualified procedures, POD studies, demonstration testing",
    typical_impact: "high",
    confidence_penalty: 0.12
  },
  mechanism_identification: {
    key: "mechanism_identification",
    name: "Damage Mechanism Uncertainty",
    category: "epistemic",
    description: "Uncertainty in which damage mechanism is active — multiple candidates, insufficient evidence",
    reducible: true,
    reduction_method: "Mechanism analysis, metallographic examination, environmental characterization",
    typical_impact: "very_high",
    confidence_penalty: 0.20
  },
  rate_prediction: {
    key: "rate_prediction",
    name: "Damage Rate Prediction Uncertainty",
    category: "epistemic",
    description: "Uncertainty in future damage progression rate — limited history, changing conditions",
    reducible: true,
    reduction_method: "Historical trending, corrosion monitoring, process data correlation",
    typical_impact: "high",
    confidence_penalty: 0.15
  },
  model_uncertainty: {
    key: "model_uncertainty",
    name: "Engineering Model Uncertainty",
    category: "epistemic",
    description: "Simplifications and assumptions in engineering models — fitness-for-service, remaining life, failure prediction",
    reducible: false,
    reduction_method: "Model validation, conservative assumptions, sensitivity analysis",
    typical_impact: "moderate",
    confidence_penalty: 0.10
  },
  historical_data_quality: {
    key: "historical_data_quality",
    name: "Historical Data Quality",
    category: "epistemic",
    description: "Reliability of historical inspection and operating data — missing records, uncertain accuracy",
    reducible: true,
    reduction_method: "Data validation, baseline inspection, corroborating measurements",
    typical_impact: "moderate_to_high",
    confidence_penalty: 0.12
  },
  human_factor: {
    key: "human_factor",
    name: "Human Factor Uncertainty",
    category: "epistemic",
    description: "Operator-dependent variability — interpretation, judgment, skill level, attention",
    reducible: true,
    reduction_method: "Qualification, training, procedures, automated analysis, peer review",
    typical_impact: "moderate",
    confidence_penalty: 0.08
  },
  hidden_damage: {
    key: "hidden_damage",
    name: "Hidden / Undetectable Damage",
    category: "epistemic",
    description: "Damage that exists but cannot be detected by available methods — subsurface, orientation-dependent",
    reducible: true,
    reduction_method: "Multiple complementary methods, advanced UT (TOFD, phased array), metallography",
    typical_impact: "very_high",
    confidence_penalty: 0.20
  },
  future_conditions: {
    key: "future_conditions",
    name: "Future Operating Condition Uncertainty",
    category: "epistemic",
    description: "Cannot predict future process changes, upsets, or environmental changes with certainty",
    reducible: false,
    reduction_method: "Conservative assumptions, monitoring, management of change procedures",
    typical_impact: "moderate",
    confidence_penalty: 0.10
  },
  interaction_effects: {
    key: "interaction_effects",
    name: "Mechanism Interaction Uncertainty",
    category: "epistemic",
    description: "Uncertainty in how multiple damage mechanisms interact — synergistic, antagonistic, sequential",
    reducible: true,
    reduction_method: "Mechanism analysis, research data, conservative combination rules",
    typical_impact: "high",
    confidence_penalty: 0.15
  },
  sample_size: {
    key: "sample_size",
    name: "Statistical Sample Size Limitation",
    category: "aleatory",
    description: "Limited number of measurements/readings may not represent population — sampling bias",
    reducible: true,
    reduction_method: "Increase sample size, stratified sampling, statistical analysis",
    typical_impact: "moderate",
    confidence_penalty: 0.08
  }
};

// ============================================================
// MEASUREMENT UNCERTAINTY MODELS — 12 NDT methods
// ============================================================

var MEASUREMENT_UNCERTAINTY = {
  ut_thickness: {
    key: "ut_thickness",
    method: "Ultrasonic Thickness Measurement",
    standard: "ASTM E797 / API 570",
    typical_accuracy_mm: 0.1,
    typical_accuracy_pct: 1,
    sources_of_error: ["calibration", "coupling", "surface_condition", "temperature", "mode_conversion", "internal_geometry", "operator"],
    minimum_detectable_mm: 1.0,
    notes: "Accuracy degrades with rough surfaces, high temperature, laminar steel. Dual-element probes preferred for corrosion monitoring.",
    pod_for_general_corrosion: 0.95,
    pod_for_pitting: 0.60,
    pod_for_cracking: 0.10
  },
  ut_shear_wave: {
    key: "ut_shear_wave",
    method: "Ultrasonic Shear Wave (Angle Beam) Examination",
    standard: "ASME V Article 4 / AWS D1.1",
    typical_accuracy_mm: 1.0,
    sources_of_error: ["beam_spread", "refraction", "mode_conversion", "geometry", "flaw_orientation", "operator"],
    minimum_detectable_mm: 1.5,
    notes: "Effective for detecting cracks oriented perpendicular to beam. Misses planar flaws parallel to beam.",
    pod_for_cracking_favorable: 0.85,
    pod_for_cracking_unfavorable: 0.40,
    orientation_dependent: true
  },
  tofd: {
    key: "tofd",
    method: "Time-of-Flight Diffraction",
    standard: "ASME V Article 4 / BS EN ISO 10863",
    typical_accuracy_mm: 0.5,
    sources_of_error: ["dead_zone_near_surface", "lateral_wave_masking", "grain_noise", "geometry"],
    minimum_detectable_mm: 1.0,
    dead_zone_mm: 3,
    notes: "Excellent for through-wall sizing of planar flaws. Dead zone near surfaces (3mm). Complementary with pulse-echo.",
    pod_for_cracking: 0.90,
    pod_for_mid_wall_flaws: 0.95
  },
  phased_array_ut: {
    key: "phased_array_ut",
    method: "Phased Array Ultrasonic Testing",
    standard: "ASME V Article 4 / ASTM E2491",
    typical_accuracy_mm: 0.5,
    sources_of_error: ["calibration", "focal_law", "geometry", "grain_noise", "dead_zone"],
    minimum_detectable_mm: 0.5,
    notes: "Multiple angles simultaneously — high detection probability. Excellent for weld inspection and corrosion mapping.",
    pod_for_cracking: 0.92,
    pod_for_corrosion_mapping: 0.95
  },
  radiography_film: {
    key: "radiography_film",
    method: "Film Radiography (RT)",
    standard: "ASME V Article 2 / ASTM E94",
    typical_sensitivity_pct: 2,
    sources_of_error: ["geometric_unsharpness", "exposure_technique", "film_processing", "viewing_conditions", "flaw_orientation"],
    minimum_detectable_wall_loss_pct: 2,
    notes: "2% sensitivity (2T hole IQI). Good for volumetric flaws — poor for tight planar flaws parallel to beam.",
    pod_for_volumetric: 0.90,
    pod_for_planar_parallel: 0.20,
    pod_for_planar_angled: 0.80,
    orientation_dependent: true
  },
  magnetic_particle: {
    key: "magnetic_particle",
    method: "Magnetic Particle Testing (MT)",
    standard: "ASME V Article 7 / ASTM E1444",
    typical_sensitivity_mm: 0.5,
    sources_of_error: ["magnetization_direction", "field_strength", "surface_condition", "particle_quality", "lighting", "operator"],
    minimum_detectable_mm: 0.25,
    notes: "Surface and near-surface flaws in ferromagnetic material only. Two magnetization directions required. Excellent POD for surface-breaking cracks.",
    pod_for_surface_cracking: 0.95,
    pod_for_subsurface: 0.50,
    material_limitation: "ferromagnetic_only"
  },
  liquid_penetrant: {
    key: "liquid_penetrant",
    method: "Liquid Penetrant Testing (PT)",
    standard: "ASME V Article 6 / ASTM E1417",
    typical_sensitivity_mm: 0.5,
    sources_of_error: ["surface_condition", "dwell_time", "cleaning", "developer_application", "lighting", "operator"],
    minimum_detectable_mm: 0.25,
    notes: "Surface-breaking flaws only. Works on all non-porous materials. Cannot detect subsurface flaws. Smeared metal can mask cracks.",
    pod_for_surface_cracking: 0.90,
    pod_for_tight_cracks: 0.60,
    pod_for_subsurface: 0.0,
    limitation: "surface_breaking_only"
  },
  eddy_current: {
    key: "eddy_current",
    method: "Eddy Current Testing (ECT)",
    standard: "ASME V Article 8 / ASTM E2096",
    typical_accuracy_mm: 0.5,
    sources_of_error: ["lift_off", "conductivity_variation", "permeability_variation", "geometry", "frequency_selection"],
    minimum_detectable_mm: 0.25,
    notes: "Surface and near-surface flaws. No couplant needed. Affected by material property variations. Pulsed EC for CUI screening.",
    pod_for_surface_cracking: 0.85,
    pod_for_tube_inspection: 0.90
  },
  visual_inspection: {
    key: "visual_inspection",
    method: "Visual Inspection (VT)",
    standard: "ASME V Article 9 / AWS D1.1",
    typical_sensitivity: "surface_flaws_visible_to_naked_eye",
    sources_of_error: ["lighting", "access", "surface_condition", "operator_attention", "interpretation"],
    notes: "Most fundamental NDT method. Requires minimum 500 lux (1000 for detailed). Detects surface conditions only.",
    pod_for_gross_defects: 0.95,
    pod_for_fine_cracks: 0.30,
    pod_for_subsurface: 0.0,
    limitation: "surface_conditions_only"
  },
  dft_measurement: {
    key: "dft_measurement",
    method: "Dry Film Thickness Measurement",
    standard: "SSPC-PA 2 / ASTM D7091",
    typical_accuracy_um: 5,
    typical_accuracy_pct: 3,
    sources_of_error: ["calibration", "substrate_roughness", "edge_effect", "substrate_curvature", "coating_magnetic_properties"],
    notes: "Magnetic gauges on ferrous, eddy current on non-ferrous. Surface roughness adds apparent DFT. V-groove correction needed at edges.",
    pod_for_thickness_deficiency: 0.90
  },
  holiday_test: {
    key: "holiday_test",
    method: "Holiday (Discontinuity) Testing",
    standard: "ASTM D5162 / NACE SP0188",
    typical_sensitivity: "through_coating_discontinuity",
    sources_of_error: ["voltage_setting", "travel_speed", "electrode_contact", "moisture", "temperature"],
    notes: "Detects through-coating discontinuities only. Low voltage (67.5V) for thin films, high voltage (calculated) for thick.",
    pod_for_holidays: 0.95,
    pod_for_partial_thickness_defect: 0.0,
    limitation: "through_coating_only"
  },
  hardness_testing: {
    key: "hardness_testing",
    method: "Hardness Testing (Field Portable)",
    standard: "ASTM A956 / ASTM E110",
    typical_accuracy_hv: 15,
    typical_accuracy_pct: 5,
    sources_of_error: ["surface_preparation", "indentation_spacing", "substrate_thickness", "calibration", "conversion_between_scales"],
    notes: "Field portable methods (Leeb, UCI, TIV) less accurate than lab methods. Minimum wall thickness required. Surface must be prepared.",
    pod_for_hard_zones: 0.80
  }
};

// ============================================================
// EPISTEMIC BOUNDARIES — hard limits on knowability
// ============================================================

var EPISTEMIC_BOUNDARIES = {
  surface_only_methods: {
    key: "surface_only_methods",
    name: "Surface-Only Method Limitation",
    description: "VT, PT, MT, ECT can only detect surface or near-surface conditions — subsurface damage is invisible",
    hard_limit: "Cannot achieve >60% confidence about internal condition using surface methods alone",
    ceiling: 0.60,
    resolution: "Add volumetric methods (UT, RT) for internal examination"
  },
  single_method: {
    key: "single_method",
    name: "Single NDT Method Limitation",
    description: "Any single NDT method has orientation, geometry, and flaw-type blind spots",
    hard_limit: "Cannot achieve >80% confidence with single NDT method — complementary methods required",
    ceiling: 0.80,
    resolution: "Use complementary methods — UT + MT, TOFD + phased array, RT + UT"
  },
  no_inspection_data: {
    key: "no_inspection_data",
    name: "No Current Inspection Data",
    description: "Assessment based on design data and operating history only — no current inspection",
    hard_limit: "Cannot achieve >40% confidence without current inspection data",
    ceiling: 0.40,
    resolution: "Perform inspection to establish current condition"
  },
  unknown_mechanism: {
    key: "unknown_mechanism",
    name: "Unknown Damage Mechanism",
    description: "Damage mechanism not identified or confirmed — treatment is speculative",
    hard_limit: "Cannot achieve >50% confidence when damage mechanism is unconfirmed",
    ceiling: 0.50,
    resolution: "Perform mechanism analysis — metallography, process review, root cause analysis"
  },
  limited_access: {
    key: "limited_access",
    name: "Limited Inspection Access",
    description: "Significant portions of component not accessible for inspection — under insulation, buried, internal",
    hard_limit: "Confidence reduced proportionally to uninspected area — max 70% if >30% inaccessible",
    ceiling: 0.70,
    resolution: "Insulation removal, internal entry, alternative screening methods (guided wave, pulsed EC)"
  },
  no_operating_history: {
    key: "no_operating_history",
    name: "No Operating History",
    description: "Operating history unknown — cannot establish damage rate trends or mechanism confirmation",
    hard_limit: "Cannot achieve >50% confidence for remaining life prediction without operating history",
    ceiling: 0.50,
    resolution: "Obtain operating records, establish baseline, begin monitoring"
  },
  ai_model_limit: {
    key: "ai_model_limit",
    name: "AI Model Confidence Limit",
    description: "AI-generated assessments inherently limited — cannot replace physical inspection or engineering judgment",
    hard_limit: "AI-only assessment (no physical inspection) capped at 65% confidence",
    ceiling: 0.65,
    resolution: "Physical inspection, engineering review, peer review required for higher confidence"
  },
  extrapolation_limit: {
    key: "extrapolation_limit",
    name: "Extrapolation Beyond Data Limit",
    description: "Predictions extrapolated beyond available data range — material behavior, temperature, time",
    hard_limit: "Extrapolation beyond 2x measured data range caps confidence at 50%",
    ceiling: 0.50,
    resolution: "Gather data in extrapolated range, use conservative models, increase safety factors"
  }
};

// ============================================================
// CONFIDENCE CEILING MODIFIERS — 10 modifiers
// ============================================================

var CEILING_MODIFIERS = {
  evidence_completeness: {
    key: "evidence_completeness",
    name: "Evidence Completeness",
    description: "How complete is the evidence package for this assessment",
    levels: {
      complete: { description: "All required evidence provided — inspection, process, material, history", modifier: 1.0 },
      substantial: { description: "Most evidence provided — some gaps in non-critical areas", modifier: 0.90 },
      moderate: { description: "Core evidence provided — significant gaps in supporting data", modifier: 0.75 },
      minimal: { description: "Limited evidence — major gaps in inspection or process data", modifier: 0.55 },
      insufficient: { description: "Insufficient evidence for meaningful assessment", modifier: 0.30 }
    }
  },
  inspection_quality: {
    key: "inspection_quality",
    name: "Inspection Quality / Qualification",
    description: "Quality of inspection data — qualified personnel, calibrated equipment, written procedures",
    levels: {
      qualified_procedure: { description: "Written qualified procedure, certified personnel, calibrated equipment", modifier: 1.0 },
      standard_practice: { description: "Standard practice followed, certified personnel", modifier: 0.90 },
      field_expedient: { description: "Field conditions, experienced personnel, portable equipment", modifier: 0.80 },
      screening: { description: "Screening inspection — not detailed or qualified", modifier: 0.65 },
      unqualified: { description: "Unqualified personnel or uncalibrated equipment", modifier: 0.40 }
    }
  },
  data_age: {
    key: "data_age",
    name: "Data Recency",
    description: "How recent is the inspection data relative to current assessment",
    levels: {
      current: { description: "Within 6 months", modifier: 1.0 },
      recent: { description: "6-24 months", modifier: 0.90 },
      aging: { description: "2-5 years", modifier: 0.75 },
      old: { description: "5-10 years", modifier: 0.55 },
      very_old: { description: "Greater than 10 years", modifier: 0.35 }
    }
  },
  corroboration: {
    key: "corroboration",
    name: "Data Corroboration",
    description: "Whether findings are confirmed by multiple independent sources or methods",
    levels: {
      multi_method_confirmed: { description: "Confirmed by 3+ independent methods/sources", modifier: 1.0 },
      dual_confirmed: { description: "Confirmed by 2 independent methods/sources", modifier: 0.95 },
      single_source: { description: "Single source/method only — no corroboration", modifier: 0.80 },
      contradicted: { description: "Conflicting data from different sources", modifier: 0.50 }
    }
  },
  severity_consequence: {
    key: "severity_consequence",
    name: "Consequence Severity Factor",
    description: "Higher consequences demand higher confidence — shifts burden of proof",
    levels: {
      low: { description: "Low consequence — cosmetic, no safety impact", modifier: 1.0 },
      moderate: { description: "Moderate consequence — minor environmental or production", modifier: 0.95 },
      high: { description: "High consequence — significant environmental, production loss", modifier: 0.85 },
      very_high: { description: "Very high consequence — injury potential, major environmental", modifier: 0.75 },
      catastrophic: { description: "Catastrophic — fatality potential, major disaster", modifier: 0.60 }
    }
  },
  model_agreement: {
    key: "model_agreement",
    name: "AI Model Agreement",
    description: "Whether multiple AI models agree on assessment — Superbrain tri-model consensus",
    levels: {
      full_consensus: { description: "All models agree on diagnosis and recommendation", modifier: 1.0 },
      strong_majority: { description: "2 of 3 models agree, third partially aligned", modifier: 0.90 },
      split: { description: "Models disagree on key aspects — resolution required", modifier: 0.70 },
      contradictory: { description: "Models fundamentally disagree", modifier: 0.50 }
    }
  },
  domain_coverage: {
    key: "domain_coverage",
    name: "Domain Engine Coverage",
    description: "Whether relevant domain engines were consulted — corrosion, weld, coating, fatigue",
    levels: {
      all_relevant: { description: "All relevant domain engines consulted and contributing", modifier: 1.0 },
      partial: { description: "Some relevant engines consulted — gaps in domain coverage", modifier: 0.85 },
      minimal: { description: "Only general assessment — no domain-specific engine", modifier: 0.65 },
      none: { description: "No domain engines consulted", modifier: 0.50 }
    }
  },
  standards_compliance: {
    key: "standards_compliance",
    name: "Standards Compliance Verification",
    description: "Whether assessment follows applicable codes and standards",
    levels: {
      code_compliant: { description: "Full code compliance verified by code authority engine", modifier: 1.0 },
      standard_referenced: { description: "Standards referenced but not formally verified", modifier: 0.90 },
      best_practice: { description: "Industry best practice followed — no specific code", modifier: 0.80 },
      no_standard: { description: "No applicable standard identified or referenced", modifier: 0.65 }
    }
  },
  peer_review: {
    key: "peer_review",
    name: "Peer Review / Engineering Oversight",
    description: "Whether assessment has been reviewed by qualified engineer",
    levels: {
      engineer_reviewed: { description: "Reviewed and approved by qualified engineer", modifier: 1.0 },
      engineer_available: { description: "Engineer available but not yet reviewed", modifier: 0.90 },
      ai_only: { description: "AI assessment only — no engineering review", modifier: 0.75 },
      contested: { description: "Engineering review disagrees with AI assessment", modifier: 0.50 }
    }
  },
  operating_envelope: {
    key: "operating_envelope",
    name: "Operating Envelope Clarity",
    description: "How well defined are the operating conditions for the assessment",
    levels: {
      well_defined: { description: "Operating envelope clearly defined with monitoring data", modifier: 1.0 },
      estimated: { description: "Operating conditions estimated from design or typical values", modifier: 0.85 },
      uncertain: { description: "Operating conditions uncertain — limited data", modifier: 0.65 },
      unknown: { description: "Operating conditions unknown", modifier: 0.45 }
    }
  }
};

// ============================================================
// KNOWLEDGE STATE CLASSIFICATIONS — 6 states
// ============================================================

var KNOWLEDGE_STATES = {
  known_measured: {
    key: "known_measured",
    name: "Known — Measured",
    description: "Directly measured by qualified inspection with calibrated equipment",
    confidence_range: "0.85-0.95",
    color: "green",
    example: "UT thickness reading by Level II technician with calibrated gauge"
  },
  known_calculated: {
    key: "known_calculated",
    name: "Known — Calculated from Measured Data",
    description: "Derived from measured data using validated engineering models",
    confidence_range: "0.75-0.90",
    color: "green",
    example: "Remaining life calculated from measured corrosion rate and current thickness"
  },
  inferred: {
    key: "inferred",
    name: "Inferred — From Available Evidence",
    description: "Inferred from indirect evidence — not directly measured but supported by data",
    confidence_range: "0.50-0.75",
    color: "yellow",
    example: "Damage mechanism inferred from process conditions and material of construction"
  },
  assumed: {
    key: "assumed",
    name: "Assumed — Engineering Judgment",
    description: "Based on engineering judgment, industry experience, or conservative assumption",
    confidence_range: "0.30-0.55",
    color: "orange",
    example: "Corrosion rate assumed from industry data — no site-specific measurement"
  },
  unknown_bounded: {
    key: "unknown_bounded",
    name: "Unknown — But Bounded",
    description: "Value unknown but physical limits or conservative bounds can be established",
    confidence_range: "0.20-0.40",
    color: "red",
    example: "Wall thickness unknown but cannot be less than retirement thickness (still in service)"
  },
  unknown_unbounded: {
    key: "unknown_unbounded",
    name: "Unknown — Unbounded",
    description: "Value unknown with no reasonable bounds — represents true epistemic gap",
    confidence_range: "0.0-0.20",
    color: "black",
    example: "Internal condition of uninspected buried pipeline — no data of any kind"
  }
};

// ============================================================
// EVALUATE UNCERTAINTY — full assessment
// ============================================================

function evaluateUncertainty(input) {
  var steps = [];
  var uncertaintySources = [];
  var totalPenalty = 0;
  var ceiling = 1.0;
  var knowledgeGaps = [];

  // Step 1: Identify active uncertainty sources
  var activeSources = input.uncertainty_sources || [];
  if (activeSources.length === 0) {
    // Auto-detect from input
    if (!input.inspection_data) {
      activeSources.push("no_inspection_data");
      activeSources.push("inspection_coverage");
    }
    if (!input.mechanism_confirmed) {
      activeSources.push("mechanism_identification");
    }
    if (!input.operating_history) {
      activeSources.push("historical_data_quality");
      activeSources.push("rate_prediction");
    }
    if (input.single_method) {
      activeSources.push("detection_probability");
    }
    if (input.ai_only) {
      activeSources.push("human_factor");
    }
    // Always present
    activeSources.push("measurement_precision");
    activeSources.push("model_uncertainty");
    activeSources.push("future_conditions");
  }

  for (var s = 0; s < activeSources.length; s++) {
    var sourceKey = activeSources[s];
    var source = UNCERTAINTY_SOURCES[sourceKey];
    if (source) {
      totalPenalty = totalPenalty + source.confidence_penalty;
      uncertaintySources.push({
        source: source.name,
        key: sourceKey,
        category: source.category,
        impact: source.typical_impact,
        penalty: source.confidence_penalty,
        reducible: source.reducible,
        reduction: source.reduction_method
      });
    }
  }

  steps.push("STEP 1: Identified " + uncertaintySources.length + " active uncertainty sources. Total penalty: " + round3(totalPenalty));

  // Step 2: Apply epistemic boundaries
  var activeBoundaries = [];
  if (!input.inspection_data) {
    activeBoundaries.push(EPISTEMIC_BOUNDARIES.no_inspection_data);
  }
  if (input.single_method) {
    activeBoundaries.push(EPISTEMIC_BOUNDARIES.single_method);
  }
  if (input.surface_methods_only) {
    activeBoundaries.push(EPISTEMIC_BOUNDARIES.surface_only_methods);
  }
  if (!input.mechanism_confirmed) {
    activeBoundaries.push(EPISTEMIC_BOUNDARIES.unknown_mechanism);
  }
  if (input.limited_access) {
    activeBoundaries.push(EPISTEMIC_BOUNDARIES.limited_access);
  }
  if (input.ai_only) {
    activeBoundaries.push(EPISTEMIC_BOUNDARIES.ai_model_limit);
  }
  if (!input.operating_history) {
    activeBoundaries.push(EPISTEMIC_BOUNDARIES.no_operating_history);
  }

  var lowestBoundaryCeiling = 1.0;
  for (var b = 0; b < activeBoundaries.length; b++) {
    if (activeBoundaries[b].ceiling < lowestBoundaryCeiling) {
      lowestBoundaryCeiling = activeBoundaries[b].ceiling;
    }
  }
  ceiling = Math.min(ceiling, lowestBoundaryCeiling);

  steps.push("STEP 2: Applied " + activeBoundaries.length + " epistemic boundaries. Lowest ceiling: " + round2(lowestBoundaryCeiling));

  // Step 3: Apply ceiling modifiers
  var modifierProduct = 1.0;
  var appliedModifiers = [];

  var modifierInputs = input.modifiers || {};
  var modifierKeys = Object.keys(CEILING_MODIFIERS);
  for (var cm = 0; cm < modifierKeys.length; cm++) {
    var modKey = modifierKeys[cm];
    var modDef = CEILING_MODIFIERS[modKey];
    var inputLevel = modifierInputs[modKey] || null;
    if (inputLevel && modDef.levels[inputLevel]) {
      var modValue = modDef.levels[inputLevel].modifier;
      modifierProduct = modifierProduct * modValue;
      appliedModifiers.push({
        modifier: modDef.name,
        level: inputLevel,
        description: modDef.levels[inputLevel].description,
        value: modValue
      });
    }
  }

  ceiling = ceiling * modifierProduct;
  steps.push("STEP 3: Applied " + appliedModifiers.length + " ceiling modifiers. Product: " + round3(modifierProduct) + ". Adjusted ceiling: " + round2(ceiling));

  // Step 4: Compute final confidence
  var rawConfidence = 1.0 - totalPenalty;
  if (rawConfidence < 0) rawConfidence = 0;
  var finalConfidence = Math.min(rawConfidence, ceiling);
  finalConfidence = round2(finalConfidence);

  // Step 5: Classify knowledge state
  var knowledgeState = "unknown_unbounded";
  if (finalConfidence >= 0.85) knowledgeState = "known_measured";
  else if (finalConfidence >= 0.75) knowledgeState = "known_calculated";
  else if (finalConfidence >= 0.50) knowledgeState = "inferred";
  else if (finalConfidence >= 0.30) knowledgeState = "assumed";
  else if (finalConfidence >= 0.20) knowledgeState = "unknown_bounded";

  // Step 6: Identify highest-impact reducible gaps
  var reducibleSources = [];
  for (var rs = 0; rs < uncertaintySources.length; rs++) {
    if (uncertaintySources[rs].reducible) {
      reducibleSources.push(uncertaintySources[rs]);
    }
  }
  reducibleSources.sort(function(a, b) { return b.penalty - a.penalty; });

  steps.push("STEP 4: Raw confidence: " + round2(rawConfidence) + ". Ceiling: " + round2(ceiling) + ". Final: " + finalConfidence);
  steps.push("STEP 5: Knowledge state: " + KNOWLEDGE_STATES[knowledgeState].name);
  steps.push("STEP 6: " + reducibleSources.length + " reducible uncertainty sources. Top improvement: " + (reducibleSources.length > 0 ? reducibleSources[0].source + " (-" + reducibleSources[0].penalty + ")" : "none"));

  return {
    engine: ENGINE_NAME,
    version: ENGINE_VERSION,
    action: "evaluate_uncertainty",
    final_confidence: finalConfidence,
    confidence_ceiling: round2(ceiling),
    raw_confidence: round2(rawConfidence),
    knowledge_state: knowledgeState,
    knowledge_state_name: KNOWLEDGE_STATES[knowledgeState].name,
    knowledge_state_color: KNOWLEDGE_STATES[knowledgeState].color,
    uncertainty_sources: uncertaintySources,
    epistemic_boundaries: activeBoundaries,
    ceiling_modifiers: appliedModifiers,
    top_improvement_opportunities: reducibleSources.slice(0, 5),
    steps: steps,
    timestamp: nowISO()
  };
}

// ============================================================
// VALIDATE CONFIDENCE CLAIM
// ============================================================

function validateConfidenceClaim(input) {
  var claimedConfidence = input.claimed_confidence || 0;
  var flags = [];
  var maxJustifiable = 1.0;

  // Check against epistemic boundaries
  if (input.ai_only && claimedConfidence > EPISTEMIC_BOUNDARIES.ai_model_limit.ceiling) {
    flags.push("OVERCONFIDENT: Claimed " + claimedConfidence + " exceeds AI-only ceiling " + EPISTEMIC_BOUNDARIES.ai_model_limit.ceiling + " — physical inspection required for higher confidence");
    maxJustifiable = Math.min(maxJustifiable, EPISTEMIC_BOUNDARIES.ai_model_limit.ceiling);
  }
  if (!input.inspection_data && claimedConfidence > EPISTEMIC_BOUNDARIES.no_inspection_data.ceiling) {
    flags.push("OVERCONFIDENT: Claimed " + claimedConfidence + " with no inspection data — ceiling is " + EPISTEMIC_BOUNDARIES.no_inspection_data.ceiling);
    maxJustifiable = Math.min(maxJustifiable, EPISTEMIC_BOUNDARIES.no_inspection_data.ceiling);
  }
  if (input.single_method && claimedConfidence > EPISTEMIC_BOUNDARIES.single_method.ceiling) {
    flags.push("OVERCONFIDENT: Claimed " + claimedConfidence + " from single NDT method — ceiling is " + EPISTEMIC_BOUNDARIES.single_method.ceiling);
    maxJustifiable = Math.min(maxJustifiable, EPISTEMIC_BOUNDARIES.single_method.ceiling);
  }
  if (!input.mechanism_confirmed && claimedConfidence > EPISTEMIC_BOUNDARIES.unknown_mechanism.ceiling) {
    flags.push("OVERCONFIDENT: Claimed " + claimedConfidence + " with unconfirmed mechanism — ceiling is " + EPISTEMIC_BOUNDARIES.unknown_mechanism.ceiling);
    maxJustifiable = Math.min(maxJustifiable, EPISTEMIC_BOUNDARIES.unknown_mechanism.ceiling);
  }

  // Never allow 1.0
  if (claimedConfidence >= 1.0) {
    flags.push("IMPOSSIBLE: Confidence of 1.0 (100%) is physically impossible — uncertainty always exists");
    maxJustifiable = Math.min(maxJustifiable, 0.95);
  }
  if (claimedConfidence > 0.95) {
    flags.push("EXTRAORDINARY: Confidence above 0.95 requires extraordinary evidence — qualified inspection, multiple methods, confirmed mechanism, engineering review");
  }

  var isValid = claimedConfidence <= maxJustifiable;

  return {
    engine: ENGINE_NAME,
    version: ENGINE_VERSION,
    action: "validate_confidence_claim",
    claimed_confidence: claimedConfidence,
    max_justifiable: round2(maxJustifiable),
    is_valid: isValid,
    flags: flags,
    recommendation: isValid ? "Claimed confidence is within justifiable range" : "Claimed confidence exceeds justifiable ceiling — reduce to " + round2(maxJustifiable) + " or provide additional evidence",
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
        "evaluate_uncertainty",
        "compute_confidence_ceiling",
        "classify_knowledge_state",
        "get_measurement_uncertainty",
        "get_uncertainty_sources",
        "get_epistemic_boundaries",
        "validate_confidence_claim",
        "get_uncertainty_propagation",
        "get_ceiling_modifiers"
      ],
      knowledge_base: {
        uncertainty_sources: Object.keys(UNCERTAINTY_SOURCES).length,
        measurement_models: Object.keys(MEASUREMENT_UNCERTAINTY).length,
        epistemic_boundaries: Object.keys(EPISTEMIC_BOUNDARIES).length,
        ceiling_modifiers: Object.keys(CEILING_MODIFIERS).length,
        knowledge_states: Object.keys(KNOWLEDGE_STATES).length
      },
      deploy: "DEPLOY276"
    });
  }

  // == evaluate_uncertainty ==
  if (action === "evaluate_uncertainty") {
    var result = evaluateUncertainty(body);
    try {
      await supabase.from("uncertainty_records").insert({
        org_id: orgId,
        case_id: body.case_id || null,
        final_confidence: result.final_confidence,
        confidence_ceiling: result.confidence_ceiling,
        knowledge_state: result.knowledge_state,
        sources_count: result.uncertainty_sources.length,
        result_json: result
      });
    } catch (e) { /* non-fatal */ }
    return ok(result);
  }

  // == compute_confidence_ceiling ==
  if (action === "compute_confidence_ceiling") {
    var ceilingResult = evaluateUncertainty(body);
    return ok({
      engine: ENGINE_NAME,
      action: "compute_confidence_ceiling",
      confidence_ceiling: ceilingResult.confidence_ceiling,
      limiting_factors: ceilingResult.epistemic_boundaries.map(function(b) { return b.name; }),
      ceiling_modifiers: ceilingResult.ceiling_modifiers,
      top_improvements: ceilingResult.top_improvement_opportunities.slice(0, 3),
      timestamp: nowISO()
    });
  }

  // == classify_knowledge_state ==
  if (action === "classify_knowledge_state") {
    var confidence = body.confidence || 0;
    var state = "unknown_unbounded";
    if (confidence >= 0.85) state = "known_measured";
    else if (confidence >= 0.75) state = "known_calculated";
    else if (confidence >= 0.50) state = "inferred";
    else if (confidence >= 0.30) state = "assumed";
    else if (confidence >= 0.20) state = "unknown_bounded";

    return ok({
      engine: ENGINE_NAME,
      action: "classify_knowledge_state",
      input_confidence: confidence,
      knowledge_state: state,
      classification: KNOWLEDGE_STATES[state],
      all_states: KNOWLEDGE_STATES,
      timestamp: nowISO()
    });
  }

  // == get_measurement_uncertainty ==
  if (action === "get_measurement_uncertainty") {
    var method = body.method || null;
    if (method && MEASUREMENT_UNCERTAINTY[method]) {
      return ok({ engine: ENGINE_NAME, method: method, uncertainty: MEASUREMENT_UNCERTAINTY[method], timestamp: nowISO() });
    }
    return ok({ engine: ENGINE_NAME, action: "get_measurement_uncertainty", methods: MEASUREMENT_UNCERTAINTY });
  }

  // == get_uncertainty_sources ==
  if (action === "get_uncertainty_sources") {
    return ok({ engine: ENGINE_NAME, action: "get_uncertainty_sources", count: Object.keys(UNCERTAINTY_SOURCES).length, sources: UNCERTAINTY_SOURCES });
  }

  // == get_epistemic_boundaries ==
  if (action === "get_epistemic_boundaries") {
    return ok({ engine: ENGINE_NAME, action: "get_epistemic_boundaries", count: Object.keys(EPISTEMIC_BOUNDARIES).length, boundaries: EPISTEMIC_BOUNDARIES });
  }

  // == validate_confidence_claim ==
  if (action === "validate_confidence_claim") {
    return ok(validateConfidenceClaim(body));
  }

  // == get_uncertainty_propagation ==
  if (action === "get_uncertainty_propagation") {
    return ok({
      engine: ENGINE_NAME,
      action: "get_uncertainty_propagation",
      rules: {
        combination: "Uncertainties combine — total penalty is sum of individual source penalties",
        ceiling_override: "Epistemic boundaries impose hard ceilings regardless of evidence quality",
        modifier_multiplication: "Ceiling modifiers multiply the ceiling — multiple moderate factors compound",
        irreducible_floor: "Some uncertainty is irreducible (aleatory) — even perfect data has measurement variability",
        conservatism_principle: "When uncertain, the engine enforces conservatism — lower confidence triggers more conservative recommendations",
        never_one: "Confidence of 1.0 (100%) is physically impossible — the engine will never output 1.0"
      },
      timestamp: nowISO()
    });
  }

  // == get_ceiling_modifiers ==
  if (action === "get_ceiling_modifiers") {
    return ok({ engine: ENGINE_NAME, action: "get_ceiling_modifiers", count: Object.keys(CEILING_MODIFIERS).length, modifiers: CEILING_MODIFIERS });
  }

  return fail(400, "Unknown action: " + action + ". Call get_registry for available actions.");
};

export { handler };
