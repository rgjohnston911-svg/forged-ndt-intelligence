// @ts-nocheck
/**
 * DEPLOY273 - Evidence Contract Engine v1.0.0
 * netlify/functions/evidence-contract-engine.ts
 *
 * Defines minimum evidence requirements by domain, mechanism, severity,
 * and service condition BEFORE the system is allowed to sound confident.
 *
 * No authority engine may issue a definitive disposition when the
 * evidence contract is incomplete. This is the gatekeeper.
 *
 * Hardcoded contracts — same pattern as CWI Core and Live Code Authority.
 *
 * 6 actions:
 *   get_registry
 *   evaluate_contract     — check evidence against contract for a given domain
 *   get_contracts         — list all evidence contracts
 *   get_contract_by_domain — get contract for specific domain
 *   get_contract_by_mechanism — get contract for specific mechanism
 *   get_minimum_evidence  — quick lookup of minimum evidence for a scenario
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";

var ENGINE_NAME = "evidence-contract-engine";
var ENGINE_VERSION = "v1.0.0";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

function ok(data) {
  return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(data) };
}

function fail(code, msg) {
  return { statusCode: code, headers: corsHeaders, body: JSON.stringify({ error: msg }) };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ================================================================
// EVIDENCE CONTRACTS — by domain
// Each contract defines required, recommended, and optional evidence
// with scoring weights. Contract completeness gates confidence.
// ================================================================

var CONTRACTS = {

  // ============ WELD DOMAIN ============
  weld_visual: {
    domain: "weld", sub_domain: "visual_inspection",
    description: "Evidence contract for visual weld acceptance evaluation",
    required: [
      { key: "overview_image", name: "Weld overview photograph", weight: 15, critical: false, note: "Full weld length in context" },
      { key: "closeup_image", name: "Close-up photograph of indication", weight: 15, critical: false, note: "Sufficient resolution to identify discontinuity type" },
      { key: "code_route", name: "Governing code identified", weight: 20, critical: true, note: "Cannot determine acceptance without governing code" },
      { key: "discontinuity_id", name: "Discontinuity type identified", weight: 15, critical: true, note: "Must know what is being evaluated" }
    ],
    recommended: [
      { key: "profile_image", name: "Profile / side view photograph", weight: 10, note: "Required for reinforcement, throat, and convexity assessment" },
      { key: "calibration_ref", name: "Calibration reference in image", weight: 10, note: "Scale bar, ruler, or calibrated overlay for dimensional accuracy" },
      { key: "process_id", name: "Welding process identified", weight: 5, note: "Enables physics plausibility validation" },
      { key: "material_id", name: "Base material identified", weight: 5, note: "Enables material-specific acceptance and cracking risk" },
      { key: "thickness", name: "Material thickness", weight: 8, note: "Many acceptance criteria are thickness-dependent" },
      { key: "position_id", name: "Weld position identified", weight: 3, note: "Affects expected defect types" },
      { key: "joint_type", name: "Joint type identified", weight: 5, note: "CJP vs PJP affects acceptance" }
    ],
    optional: [
      { key: "loading_condition", name: "Loading condition (static/cyclic)", weight: 5, note: "Cyclic loading drastically tightens limits" },
      { key: "service_conditions", name: "Service conditions", weight: 5, note: "Sour, cryogenic, lethal, etc. tighten criteria" },
      { key: "wps_reference", name: "WPS reference number", weight: 2 },
      { key: "welder_id", name: "Welder identification", weight: 1 }
    ],
    authority_mode_minimum: 85,
    advisory_mode_minimum: 60,
    assist_mode_minimum: 30,
    confidence_ceiling_formula: "Evidence score caps confidence. Score < 50 caps confidence at 60. Score < 70 caps at 75."
  },

  weld_volumetric: {
    domain: "weld", sub_domain: "volumetric_nde",
    description: "Evidence contract for RT/UT weld evaluation",
    required: [
      { key: "nde_report", name: "NDE examination report", weight: 20, critical: true, note: "RT film interpretation or UT scan data" },
      { key: "code_route", name: "Governing code identified", weight: 20, critical: true },
      { key: "discontinuity_id", name: "Discontinuity type and dimensions", weight: 15, critical: true },
      { key: "technique_sheet", name: "NDE technique / procedure reference", weight: 10, critical: false, note: "Validates examination adequacy" }
    ],
    recommended: [
      { key: "calibration_record", name: "Equipment calibration record", weight: 10, note: "Validates measurement accuracy" },
      { key: "thickness", name: "Material thickness", weight: 8 },
      { key: "material_id", name: "Base material", weight: 5 },
      { key: "process_id", name: "Welding process", weight: 5 },
      { key: "coverage_map", name: "Examination coverage map", weight: 5, note: "Confirms full coverage" }
    ],
    optional: [
      { key: "comparison_film", name: "Comparison / reference radiograph", weight: 3 },
      { key: "operator_cert", name: "NDE operator certification level", weight: 2 }
    ],
    authority_mode_minimum: 90,
    advisory_mode_minimum: 70,
    assist_mode_minimum: 40
  },

  // ============ COATINGS DOMAIN ============
  coating_condition: {
    domain: "coating", sub_domain: "condition_assessment",
    description: "Evidence contract for coating condition evaluation",
    required: [
      { key: "overview_image", name: "Overview photograph of coating area", weight: 12, critical: false },
      { key: "closeup_image", name: "Close-up of defect or degradation", weight: 12, critical: false },
      { key: "coating_system_id", name: "Coating system identified", weight: 15, critical: true, note: "Cannot evaluate without knowing what was applied" },
      { key: "dft_readings", name: "Dry film thickness readings", weight: 15, critical: false, note: "Multiple spot readings per SSPC-PA 2" }
    ],
    recommended: [
      { key: "adhesion_test", name: "Adhesion test results", weight: 10, note: "Pull-off (ASTM D4541) or tape test (ASTM D3359)" },
      { key: "environment_readings", name: "Environmental readings", weight: 8, note: "Ambient temp, steel temp, humidity, dew point delta" },
      { key: "surface_prep_record", name: "Surface preparation record", weight: 8, note: "Prep standard, profile, cleanliness, contamination" },
      { key: "holiday_test", name: "Holiday detection results", weight: 8, note: "Critical for immersion and buried service" },
      { key: "substrate_material", name: "Substrate material identified", weight: 5 },
      { key: "service_environment", name: "Service environment class", weight: 8, note: "Marine, immersion, buried, atmospheric, CUI, splash zone" }
    ],
    optional: [
      { key: "cure_verification", name: "Cure state verification", weight: 5, note: "MEK rub test, hardness, or solvent resistance" },
      { key: "chloride_test", name: "Soluble salt / chloride test", weight: 5, note: "Critical for marine and immersion" },
      { key: "application_records", name: "Application records / batch data", weight: 3 },
      { key: "age_history", name: "Coating age and maintenance history", weight: 3 }
    ],
    authority_mode_minimum: 80,
    advisory_mode_minimum: 55,
    assist_mode_minimum: 25
  },

  coating_application: {
    domain: "coating", sub_domain: "application_qc",
    description: "Evidence contract for coating application quality control",
    required: [
      { key: "coating_system_id", name: "Coating system / specification", weight: 15, critical: true },
      { key: "surface_prep_record", name: "Surface preparation verification", weight: 15, critical: true, note: "Prep standard achieved, profile, cleanliness" },
      { key: "environment_readings", name: "Environmental conditions at application", weight: 15, critical: true, note: "Temp, humidity, dew point delta must be in spec" },
      { key: "dft_readings", name: "Wet and/or dry film thickness", weight: 15, critical: true }
    ],
    recommended: [
      { key: "adhesion_test", name: "Adhesion test", weight: 10 },
      { key: "holiday_test", name: "Holiday detection", weight: 8, note: "Required for immersion/buried service" },
      { key: "chloride_test", name: "Soluble salt test before coating", weight: 8 },
      { key: "profile_reading", name: "Surface profile measurement", weight: 5 },
      { key: "batch_records", name: "Material batch / lot numbers", weight: 3 },
      { key: "mixer_ratio", name: "Mix ratio verification", weight: 3, note: "For multi-component systems" }
    ],
    optional: [
      { key: "stripe_coat_record", name: "Stripe coat documentation", weight: 3 },
      { key: "overcoat_window", name: "Overcoat window compliance", weight: 3 },
      { key: "applicator_cert", name: "Applicator certification", weight: 2 }
    ],
    authority_mode_minimum: 85,
    advisory_mode_minimum: 65,
    assist_mode_minimum: 30
  },

  // ============ CORROSION DOMAIN ============
  corrosion_assessment: {
    domain: "corrosion", sub_domain: "mechanism_assessment",
    description: "Evidence contract for corrosion mechanism and rate assessment",
    required: [
      { key: "thickness_data", name: "Wall thickness measurement(s)", weight: 20, critical: true, note: "Current thickness or thickness profile" },
      { key: "component_id", name: "Component / location identity", weight: 10, critical: true },
      { key: "material_id", name: "Material of construction", weight: 10, critical: true },
      { key: "service_environment", name: "Service environment / fluid", weight: 15, critical: true, note: "Required for mechanism identification" }
    ],
    recommended: [
      { key: "thickness_history", name: "Historical thickness trend data", weight: 10, note: "Enables rate calculation" },
      { key: "process_conditions", name: "Operating conditions (T, P, flow)", weight: 8, note: "Temperature, pressure, flow rate, chemistry" },
      { key: "inspection_images", name: "Inspection photographs", weight: 5 },
      { key: "original_thickness", name: "Original / nominal thickness", weight: 8, note: "Required for remaining life calculation" },
      { key: "corrosion_allowance", name: "Design corrosion allowance", weight: 5 },
      { key: "insulation_type", name: "Insulation type and condition", weight: 5, note: "Critical for CUI assessment" }
    ],
    optional: [
      { key: "coupon_data", name: "Corrosion coupon data", weight: 3 },
      { key: "inhibitor_records", name: "Chemical treatment / inhibitor data", weight: 3 },
      { key: "previous_repairs", name: "Repair history", weight: 3 },
      { key: "cathodic_protection", name: "CP system status", weight: 3 }
    ],
    authority_mode_minimum: 80,
    advisory_mode_minimum: 55,
    assist_mode_minimum: 25
  },

  // ============ FATIGUE DOMAIN ============
  fatigue_assessment: {
    domain: "fatigue", sub_domain: "fatigue_life",
    description: "Evidence contract for fatigue life assessment",
    required: [
      { key: "joint_geometry", name: "Joint / detail geometry class", weight: 15, critical: true, note: "Required for S-N curve selection" },
      { key: "stress_range", name: "Stress range or loading spectrum", weight: 20, critical: true },
      { key: "material_id", name: "Material identification", weight: 10, critical: true },
      { key: "cycle_count", name: "Cycle count or frequency", weight: 15, critical: true }
    ],
    recommended: [
      { key: "crack_data", name: "Existing crack size if detected", weight: 10, note: "Required for crack growth assessment" },
      { key: "weld_quality", name: "Weld quality / discontinuity data", weight: 8, note: "Affects initial flaw assumption" },
      { key: "environment", name: "Environmental conditions", weight: 5, note: "Corrosion fatigue reduces life" },
      { key: "stress_concentration", name: "Stress concentration factor", weight: 8 },
      { key: "inspection_method", name: "NDE method and sensitivity", weight: 5, note: "Affects detectable flaw size" }
    ],
    optional: [
      { key: "residual_stress", name: "Residual stress data", weight: 3 },
      { key: "post_weld_treatment", name: "Post-weld improvement method", weight: 3 },
      { key: "temperature", name: "Operating temperature", weight: 3 }
    ],
    authority_mode_minimum: 85,
    advisory_mode_minimum: 60,
    assist_mode_minimum: 30
  },

  // ============ GENERAL / MULTI-DOMAIN ============
  general_case: {
    domain: "general", sub_domain: "multi_domain",
    description: "Evidence contract for general inspection case intake",
    required: [
      { key: "case_narrative", name: "Case description / narrative", weight: 20, critical: true, note: "Must describe what was found and where" },
      { key: "asset_type", name: "Asset type identified", weight: 10, critical: false },
      { key: "evidence_media", name: "At least one image or measurement", weight: 20, critical: true }
    ],
    recommended: [
      { key: "material_id", name: "Material of construction", weight: 8 },
      { key: "service_environment", name: "Service environment", weight: 8 },
      { key: "applicable_standards", name: "Applicable standards identified", weight: 8 },
      { key: "location_detail", name: "Specific location within asset", weight: 5 },
      { key: "operating_conditions", name: "Operating conditions", weight: 5 },
      { key: "inspection_history", name: "Previous inspection data", weight: 5 }
    ],
    optional: [
      { key: "design_data", name: "Design drawings or specifications", weight: 3 },
      { key: "maintenance_history", name: "Maintenance / repair history", weight: 3 },
      { key: "risk_ranking", name: "Existing risk ranking", weight: 2 }
    ],
    authority_mode_minimum: 75,
    advisory_mode_minimum: 50,
    assist_mode_minimum: 20
  },

  // ============ PRESSURE EQUIPMENT ============
  pressure_equipment: {
    domain: "pressure", sub_domain: "fitness_for_service",
    description: "Evidence contract for pressure equipment FFS assessment",
    required: [
      { key: "thickness_data", name: "Current wall thickness", weight: 15, critical: true },
      { key: "original_thickness", name: "Original / nominal thickness", weight: 10, critical: true },
      { key: "design_pressure", name: "Design pressure", weight: 10, critical: true },
      { key: "design_temperature", name: "Design temperature", weight: 10, critical: true },
      { key: "material_spec", name: "Material specification", weight: 10, critical: true },
      { key: "flaw_characterization", name: "Flaw type, size, location", weight: 15, critical: true }
    ],
    recommended: [
      { key: "operating_conditions", name: "Actual operating P and T", weight: 8 },
      { key: "stress_analysis", name: "Stress analysis or MAWP calc", weight: 8 },
      { key: "inspection_coverage", name: "Inspection coverage extent", weight: 5 },
      { key: "corrosion_rate", name: "Corrosion rate data", weight: 5 },
      { key: "code_route", name: "Governing construction code", weight: 5 }
    ],
    optional: [
      { key: "fea_results", name: "FEA results if available", weight: 3 },
      { key: "fracture_toughness", name: "Fracture toughness data", weight: 3 },
      { key: "hydrotest_history", name: "Hydrotest records", weight: 2 }
    ],
    authority_mode_minimum: 90,
    advisory_mode_minimum: 70,
    assist_mode_minimum: 35
  }
};

// ================================================================
// SEVERITY ESCALATION — higher severity demands more evidence
// ================================================================

var SEVERITY_ESCALATORS = {
  low: { multiplier: 1.0, extra_required: [] },
  moderate: { multiplier: 1.0, extra_required: [] },
  high: {
    multiplier: 1.1,
    extra_required: ["calibration_ref"],
    note: "High severity findings require calibrated measurement evidence"
  },
  critical: {
    multiplier: 1.2,
    extra_required: ["calibration_ref", "nde_report"],
    note: "Critical findings require NDE verification and calibrated evidence"
  },
  catastrophic: {
    multiplier: 1.3,
    extra_required: ["calibration_ref", "nde_report", "independent_verification"],
    note: "Catastrophic consequence requires independent verification"
  }
};

// ================================================================
// SERVICE CONDITION EVIDENCE ESCALATORS
// ================================================================

var SERVICE_EVIDENCE_ESCALATORS = {
  sour_service: {
    extra_required: ["hardness_survey"],
    note: "Sour service requires hardness survey evidence per NACE MR0175"
  },
  cryogenic: {
    extra_required: ["impact_test_data"],
    note: "Cryogenic service requires Charpy impact test evidence at MDMT"
  },
  lethal_service: {
    extra_required: ["full_volumetric_nde"],
    note: "Lethal service requires 100% volumetric NDE coverage evidence"
  },
  hydrogen_service: {
    extra_required: ["hardness_survey", "pwht_record"],
    note: "Hydrogen service requires hardness and PWHT documentation"
  },
  immersion: {
    extra_required: ["holiday_test"],
    note: "Immersion service requires holiday detection evidence"
  },
  buried: {
    extra_required: ["holiday_test", "cathodic_protection"],
    note: "Buried service requires holiday detection and CP verification"
  }
};


// ================================================================
// EVALUATE CONTRACT
// ================================================================

function evaluateContract(contractKey, providedEvidence, options) {
  var contract = CONTRACTS[contractKey];
  if (!contract) return { error: "Unknown contract: " + contractKey };

  var mode = (options && options.mode) || "advisory";
  var severity = (options && options.severity) || "moderate";
  var serviceConditions = (options && options.service_conditions) || [];

  var totalWeight = 0;
  var earnedWeight = 0;
  var missingRequired = [];
  var missingRecommended = [];
  var missingOptional = [];
  var providedItems = [];
  var criticalMissing = false;

  // Score required items
  for (var ri = 0; ri < contract.required.length; ri++) {
    var req = contract.required[ri];
    totalWeight += req.weight;
    if (providedEvidence[req.key]) {
      earnedWeight += req.weight;
      providedItems.push({ key: req.key, name: req.name, category: "required", weight: req.weight });
    } else {
      missingRequired.push({ key: req.key, name: req.name, weight: req.weight, critical: req.critical, note: req.note });
      if (req.critical) criticalMissing = true;
    }
  }

  // Score recommended items
  for (var rci = 0; rci < contract.recommended.length; rci++) {
    var rec = contract.recommended[rci];
    totalWeight += rec.weight;
    if (providedEvidence[rec.key]) {
      earnedWeight += rec.weight;
      providedItems.push({ key: rec.key, name: rec.name, category: "recommended", weight: rec.weight });
    } else {
      missingRecommended.push({ key: rec.key, name: rec.name, weight: rec.weight, note: rec.note });
    }
  }

  // Score optional items
  if (contract.optional) {
    for (var oi = 0; oi < contract.optional.length; oi++) {
      var opt = contract.optional[oi];
      totalWeight += opt.weight;
      if (providedEvidence[opt.key]) {
        earnedWeight += opt.weight;
        providedItems.push({ key: opt.key, name: opt.name, category: "optional", weight: opt.weight });
      } else {
        missingOptional.push({ key: opt.key, name: opt.name, weight: opt.weight });
      }
    }
  }

  // Apply severity escalation
  var sevEsc = SEVERITY_ESCALATORS[severity];
  var extraRequired = [];
  if (sevEsc) {
    for (var sei = 0; sei < sevEsc.extra_required.length; sei++) {
      var extraKey = sevEsc.extra_required[sei];
      if (!providedEvidence[extraKey]) {
        extraRequired.push({ key: extraKey, reason: "Required due to " + severity + " severity" });
      }
    }
  }

  // Apply service condition escalators
  var serviceExtras = [];
  for (var sci = 0; sci < serviceConditions.length; sci++) {
    var svcEsc = SERVICE_EVIDENCE_ESCALATORS[serviceConditions[sci]];
    if (svcEsc) {
      for (var svi = 0; svi < svcEsc.extra_required.length; svi++) {
        var svcKey = svcEsc.extra_required[svi];
        if (!providedEvidence[svcKey]) {
          serviceExtras.push({ key: svcKey, reason: svcEsc.note, service_condition: serviceConditions[sci] });
        }
      }
    }
  }

  // Compute score
  var rawScore = totalWeight > 0 ? round2((earnedWeight / totalWeight) * 100) : 0;

  // Apply severity multiplier penalty for missing escalated evidence
  var penaltyPoints = extraRequired.length * 5 + serviceExtras.length * 5;
  var adjustedScore = Math.max(0, rawScore - penaltyPoints);

  // Determine mode eligibility
  var authorityMin = contract.authority_mode_minimum || 85;
  var advisoryMin = contract.advisory_mode_minimum || 60;
  var assistMin = contract.assist_mode_minimum || 25;

  var authorityEligible = adjustedScore >= authorityMin && !criticalMissing;
  var advisoryEligible = adjustedScore >= advisoryMin && !criticalMissing;
  var assistEligible = adjustedScore >= assistMin;

  // Determine confidence ceiling
  var confidenceCeiling = 100;
  if (adjustedScore < 50) confidenceCeiling = 60;
  else if (adjustedScore < 70) confidenceCeiling = 75;
  else if (adjustedScore < 85) confidenceCeiling = 85;
  else if (adjustedScore < 95) confidenceCeiling = 95;

  if (criticalMissing) confidenceCeiling = Math.min(confidenceCeiling, 50);
  if (extraRequired.length > 0) confidenceCeiling = Math.min(confidenceCeiling, 70);
  if (serviceExtras.length > 0) confidenceCeiling = Math.min(confidenceCeiling, 65);

  // Determine what would help most
  var highestImpactMissing = [];
  var allMissing = missingRequired.concat(missingRecommended);
  allMissing.sort(function(a, b) { return (b.weight || 0) - (a.weight || 0); });
  for (var hm = 0; hm < Math.min(3, allMissing.length); hm++) {
    highestImpactMissing.push(allMissing[hm]);
  }

  // Overall status
  var status = "sufficient";
  if (criticalMissing) status = "critical_gap";
  else if (adjustedScore < assistMin) status = "critically_insufficient";
  else if (adjustedScore < advisoryMin) status = "insufficient_for_advisory";
  else if (adjustedScore < authorityMin) status = "insufficient_for_authority";

  // Mode determination
  var allowedMode = "assist";
  if (authorityEligible) allowedMode = "authority";
  else if (advisoryEligible) allowedMode = "advisory";

  var requestedModeAllowed = true;
  if (mode === "authority" && !authorityEligible) requestedModeAllowed = false;
  if (mode === "advisory" && !advisoryEligible) requestedModeAllowed = false;

  return {
    contract_key: contractKey,
    domain: contract.domain,
    sub_domain: contract.sub_domain,
    evidence_score: adjustedScore,
    raw_score: rawScore,
    status: status,
    critical_missing: criticalMissing,
    confidence_ceiling: confidenceCeiling,
    mode_eligibility: {
      requested_mode: mode,
      requested_mode_allowed: requestedModeAllowed,
      maximum_allowed_mode: allowedMode,
      authority_eligible: authorityEligible,
      advisory_eligible: advisoryEligible,
      assist_eligible: assistEligible,
      authority_threshold: authorityMin,
      advisory_threshold: advisoryMin
    },
    provided: providedItems,
    missing_required: missingRequired,
    missing_recommended: missingRecommended,
    missing_optional: missingOptional,
    severity_extras: extraRequired,
    service_condition_extras: serviceExtras,
    highest_impact_missing: highestImpactMissing,
    action_required: criticalMissing
      ? "CRITICAL: Missing critical evidence items. Cannot proceed with evaluation."
      : !requestedModeAllowed
      ? "Evidence insufficient for " + mode + " mode. Maximum allowed: " + allowedMode + ". Provide additional evidence or downgrade mode."
      : adjustedScore < 50
      ? "Evidence is weak. Results will carry low confidence (ceiling: " + confidenceCeiling + "%)."
      : null
  };
}


// ================================================================
// HANDLER
// ================================================================

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return fail(405, "POST only");

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "";

    // == get_registry ==
    if (action === "get_registry") {
      return ok({
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        status: "operational",
        capabilities: [
          "evaluate_contract",
          "get_contracts",
          "get_contract_by_domain",
          "get_contract_by_mechanism",
          "get_minimum_evidence"
        ],
        contracts_available: Object.keys(CONTRACTS).length,
        domains_covered: ["weld", "coating", "corrosion", "fatigue", "pressure", "general"],
        severity_levels: Object.keys(SEVERITY_ESCALATORS),
        service_condition_escalators: Object.keys(SERVICE_EVIDENCE_ESCALATORS),
        modes: ["assist", "advisory", "authority"],
        description: "Evidence contract gatekeeper. Defines minimum evidence by domain, mechanism, and severity before authority engines may issue dispositions."
      });
    }

    // == get_contracts ==
    if (action === "get_contracts") {
      var summaries = [];
      var keys = Object.keys(CONTRACTS);
      for (var i = 0; i < keys.length; i++) {
        var c = CONTRACTS[keys[i]];
        summaries.push({
          key: keys[i],
          domain: c.domain,
          sub_domain: c.sub_domain,
          description: c.description,
          required_count: c.required.length,
          recommended_count: c.recommended.length,
          optional_count: c.optional ? c.optional.length : 0,
          authority_minimum: c.authority_mode_minimum,
          advisory_minimum: c.advisory_mode_minimum
        });
      }
      return ok({ contracts: summaries, total: summaries.length });
    }

    // == get_contract_by_domain ==
    if (action === "get_contract_by_domain") {
      if (!body.domain) return fail(400, "domain required");
      var domainContracts = [];
      var allKeys = Object.keys(CONTRACTS);
      for (var di = 0; di < allKeys.length; di++) {
        if (CONTRACTS[allKeys[di]].domain === body.domain) {
          domainContracts.push({ key: allKeys[di], contract: CONTRACTS[allKeys[di]] });
        }
      }
      return ok({ domain: body.domain, contracts: domainContracts, total: domainContracts.length });
    }

    // == get_contract_by_mechanism ==
    if (action === "get_contract_by_mechanism") {
      if (!body.mechanism) return fail(400, "mechanism required");
      // Map mechanism to contract
      var mech = (body.mechanism || "").toLowerCase();
      var matched = null;
      if (mech.indexOf("weld") >= 0 || mech.indexOf("crack") >= 0 || mech.indexOf("fusion") >= 0 || mech.indexOf("porosity") >= 0) {
        matched = "weld_visual";
      } else if (mech.indexOf("coat") >= 0 || mech.indexOf("paint") >= 0 || mech.indexOf("lining") >= 0 || mech.indexOf("dft") >= 0) {
        matched = "coating_condition";
      } else if (mech.indexOf("corros") >= 0 || mech.indexOf("wall loss") >= 0 || mech.indexOf("thinning") >= 0 || mech.indexOf("pitting") >= 0) {
        matched = "corrosion_assessment";
      } else if (mech.indexOf("fatigue") >= 0 || mech.indexOf("cyclic") >= 0) {
        matched = "fatigue_assessment";
      } else if (mech.indexOf("pressure") >= 0 || mech.indexOf("ffs") >= 0 || mech.indexOf("fitness") >= 0) {
        matched = "pressure_equipment";
      } else {
        matched = "general_case";
      }
      return ok({ mechanism: body.mechanism, contract_key: matched, contract: CONTRACTS[matched] });
    }

    // == get_minimum_evidence ==
    if (action === "get_minimum_evidence") {
      var contractKey = body.contract_key || body.domain || "general_case";
      // Try direct key first
      var contract = CONTRACTS[contractKey];
      // If not found, try to match by domain
      if (!contract) {
        var cKeys = Object.keys(CONTRACTS);
        for (var ci = 0; ci < cKeys.length; ci++) {
          if (CONTRACTS[cKeys[ci]].domain === contractKey) {
            contract = CONTRACTS[cKeys[ci]];
            contractKey = cKeys[ci];
            break;
          }
        }
      }
      if (!contract) return fail(404, "No contract found for: " + contractKey);

      var mode = body.mode || "advisory";
      var minScore = mode === "authority" ? contract.authority_mode_minimum
        : mode === "advisory" ? contract.advisory_mode_minimum
        : contract.assist_mode_minimum;

      var requiredItems = contract.required.map(function(r) { return { key: r.key, name: r.name, critical: r.critical, note: r.note }; });
      var recommendedItems = contract.recommended.map(function(r) { return { key: r.key, name: r.name, note: r.note }; });

      return ok({
        contract_key: contractKey,
        mode: mode,
        minimum_score: minScore,
        required_evidence: requiredItems,
        recommended_evidence: recommendedItems,
        note: "For " + mode + " mode, evidence score must reach " + minScore + "%. Provide all required items plus enough recommended items to reach threshold."
      });
    }

    // == evaluate_contract ==
    if (action === "evaluate_contract") {
      if (!body.contract_key && !body.domain) return fail(400, "contract_key or domain required");
      if (!body.evidence) return fail(400, "evidence object required");

      var contractKey = body.contract_key;
      // Auto-detect contract from domain if not specified
      if (!contractKey && body.domain) {
        var dKeys = Object.keys(CONTRACTS);
        for (var dk = 0; dk < dKeys.length; dk++) {
          if (CONTRACTS[dKeys[dk]].domain === body.domain) {
            contractKey = dKeys[dk];
            break;
          }
        }
      }
      if (!contractKey || !CONTRACTS[contractKey]) {
        return fail(404, "No contract found. Available: " + Object.keys(CONTRACTS).join(", "));
      }

      var result = evaluateContract(contractKey, body.evidence, {
        mode: body.mode,
        severity: body.severity,
        service_conditions: body.service_conditions
      });

      return ok({
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        action: "evaluate_contract",
        result: result
      });
    }

    return fail(400, "Unknown action: " + action + ". Valid: get_registry, evaluate_contract, get_contracts, get_contract_by_domain, get_contract_by_mechanism, get_minimum_evidence");

  } catch (err) {
    return fail(500, String(err && err.message ? err.message : err));
  }
};
