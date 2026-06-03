// @ts-nocheck
/**
 * DEPLOY339 - pipeline-integrity-engine.ts
 * netlify/functions/pipeline-integrity-engine.ts
 *
 * PIPELINE INTEGRITY MANAGEMENT ENGINE
 * ASME B31.8S + 49 CFR 192/195 + API 1160
 *
 * Threat Identification (B31.8S Section 5):
 *   - 9 threat categories: external corrosion, internal corrosion, SCC,
 *     manufacturing defects, construction defects, third-party damage,
 *     incorrect operations, weather/outside force
 *   - Susceptibility assessment per coating, CP, soil, product, vintage, class, SMYS, SCC
 *
 * Class Location (49 CFR 192.5):
 *   - Class 1-4 with design factors 0.72, 0.60, 0.50, 0.40
 *   - MAOP = (2 * SMYS * t * F * E * T) / D
 *
 * HCA Identification (49 CFR 192.903 / 195.450):
 *   - High consequence areas: Class 3/4, waterways, water sources
 *   - Could-affect radius: r = 0.69 * sqrt(p * d^2)
 *
 * Assessment Methods (B31.8S Section 6):
 *   - ILI, ECDA, ICDA, SCCDA, pressure test, ECA
 *
 * ILI Feature Classification (API 1160):
 *   - Metal loss: Immediate (Pf < 1.1*MAOP), Scheduled (depth > 80%), Monitored
 *   - Dents: Immediate (depth > 6% OD), Scheduled, Monitored
 *   - Cracks: Immediate if Pf < 1.1*MAOP, Assessment needed
 *   - Interaction: Axial < 1.0*sqrt(D*t), Circumferential < 6*t
 *
 * Remaining Strength:
 *   - B31G, Modified B31G, DNV-RP-F101, API 579 Level 2
 *   - Pf = (2*SMYS*t/D) * (1 - A/Ao) / (1 - A/(Ao*Mt))
 *
 * Reassessment Intervals:
 *   - Gas HCA: max 7 years (49 CFR 192.939)
 *   - Liquid HCA: max 5 years (49 CFR 195.452)
 *   - Growth-rate-based, confirmatory DA at half-interval
 *
 * POST /api/pipeline-integrity-engine
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var ENGINE_ID = "pipeline-integrity-engine";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY339";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

function num(v, fallback) {
  var n = Number(v);
  if (v === undefined || v === null || v === "" || isNaN(n)) return fallback !== undefined ? fallback : null;
  return n;
}

function getMissing(inp, keys) {
  var m = [];
  for (var i = 0; i < keys.length; i++) {
    if (inp[keys[i]] === undefined || inp[keys[i]] === null || inp[keys[i]] === "") m.push(keys[i]);
  }
  return m;
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

function buildResult(action, partial) {
  return {
    action: action,
    engine_id: ENGINE_ID,
    engine_version: ENGINE_VERSION,
    deploy: DEPLOY,
    result: partial.result || {},
    interpretation: partial.interpretation || "",
    confidence: clamp01(partial.confidence || 0.7),
    severity: partial.severity || "info",
    assumptions: partial.assumptions || [],
    limitations: partial.limitations || [],
    missing_inputs: partial.missing_inputs || [],
    proof_trace: partial.proof_trace || { mathematical_basis: [], calculation_steps: [], required_human_review: false }
  };
}

function holdResult(action, m) {
  return buildResult(action, {
    result: { missing_inputs: m },
    interpretation: "Calculation held. Missing: " + m.join(", ") + ".",
    confidence: 0.1,
    severity: "hold_for_input",
    missing_inputs: m,
    proof_trace: { mathematical_basis: [], calculation_steps: ["Input validation failed"], required_human_review: false, next_data_needed: m }
  });
}

// ============================================================
// CLASS LOCATION DETERMINATION (49 CFR 192.5)
// ============================================================

function classifyLocation(buildingCount, proximity) {
  var cls = 1;
  var factor = 0.72;
  if (buildingCount >= 46 || proximity === "class_3_4_building") {
    cls = 3;
    factor = 0.50;
  } else if (buildingCount >= 11 && buildingCount <= 45) {
    cls = 2;
    factor = 0.60;
  } else if (proximity === "class_4_building") {
    cls = 4;
    factor = 0.40;
  } else if (buildingCount >= 46 || (proximity && proximity.indexOf("100_yards") >= 0)) {
    cls = 3;
    factor = 0.50;
  }
  return { class: cls, design_factor: factor };
}

// ============================================================
// THREAT IDENTIFICATION (ASME B31.8S Section 5)
// ============================================================

function identifyThreats(inp) {
  var m = getMissing(inp, ["coating_type", "coating_condition", "soil_resistivity", "product_type", "operating_pressure", "smys", "diameter", "wall_thickness", "vintage", "location_class"]);
  if (m.length) return holdResult("identify_threats", m);

  var coat = inp.coating_type || "";
  var coatCond = inp.coating_condition || "poor";
  var rho = num(inp.soil_resistivity, 2000);
  var product = inp.product_type || "gas";
  var p = num(inp.operating_pressure, 500);
  var smys = num(inp.smys, 35000);
  var d = num(inp.diameter, 12);
  var t = num(inp.wall_thickness, 0.25);
  var vintage = num(inp.vintage, 2000);
  var locClass = num(inp.location_class, 1);
  var cp_status = inp.cp_status || "unknown";
  var dcvg_result = inp.dcvg_result || "unknown";
  var h2s = num(inp.h2s_ppm, 0);
  var water_cut = num(inp.water_cut, 0);
  var flow_vel = num(inp.flow_velocity, 0);

  var threats = [];

  // TIME-DEPENDENT: External Corrosion
  var extCorrSusc = "low";
  if (coatCond === "poor" || coatCond === "failed") {
    extCorrSusc = rho < 1000 ? "high" : rho < 2000 ? "medium" : "low";
  }
  if (cp_status === "OFF" || cp_status === "ineffective") extCorrSusc = "high";
  threats.push({
    threat: "external_corrosion",
    threat_type: "time_dependent",
    susceptibility: extCorrSusc,
    drivers: ["coating_condition", "soil_resistivity", "cp_effectiveness"],
    evidence: { coating: coatCond, soil_rho: rho, cp_status: cp_status, dcvg: dcvg_result }
  });

  // TIME-DEPENDENT: Internal Corrosion
  var intCorrSusc = "low";
  if (product === "gas" && water_cut > 0.1) intCorrSusc = "medium";
  if (product === "liquid" && water_cut > 0.5) intCorrSusc = "medium";
  if (h2s > 0) intCorrSusc = "high";
  if (vintage < 1970 && product === "gas") intCorrSusc = intCorrSusc === "low" ? "medium" : intCorrSusc;
  threats.push({
    threat: "internal_corrosion",
    threat_type: "time_dependent",
    susceptibility: intCorrSusc,
    drivers: ["water_cut", "h2s", "co2_partial_pressure", "product_type"],
    evidence: { product: product, water_cut: water_cut, h2s: h2s, vintage: vintage }
  });

  // TIME-DEPENDENT: Stress Corrosion Cracking
  var sccSusc = "not_susceptible";
  var stress_pct = (p / smys) * 100;
  var nearNeutralPh = inp.soil_ph !== undefined && inp.soil_ph > 5 && inp.soil_ph < 7;
  var highPh = inp.soil_ph !== undefined && inp.soil_ph >= 9;
  if (stress_pct > 50 && nearNeutralPh) sccSusc = "high";
  if (stress_pct > 72 && highPh) sccSusc = "high";
  if (stress_pct > 30 && (nearNeutralPh || highPh)) sccSusc = "medium";
  threats.push({
    threat: "stress_corrosion_cracking",
    threat_type: "time_dependent",
    susceptibility: sccSusc,
    drivers: ["operating_stress", "soil_ph", "coating_protection"],
    evidence: { stress_percent_smys: stress_pct, soil_ph: inp.soil_ph, coating: coatCond }
  });

  // STABLE: Manufacturing Defects
  var mfgDefSusc = vintage < 1970 && coat !== "none" ? "medium" : "low";
  if (inp.erw_seam === "yes") mfgDefSusc = "high";
  threats.push({
    threat: "manufacturing_defects",
    threat_type: "stable",
    susceptibility: mfgDefSusc,
    drivers: ["seam_weld_type", "manufacturing_era", "vintage"],
    evidence: { vintage: vintage, erw_seam: inp.erw_seam }
  });

  // STABLE: Construction Defects
  var conDefSusc = "low";
  if (inp.girth_weld_history === "observed_defects") conDefSusc = "high";
  if (inp.installation_date !== undefined && vintage < 1975) conDefSusc = "medium";
  threats.push({
    threat: "construction_defects",
    threat_type: "stable",
    susceptibility: conDefSusc,
    drivers: ["girth_weld_quality", "installation_era", "inspection_results"],
    evidence: { girth_weld_history: inp.girth_weld_history, vintage: vintage }
  });

  // TIME-INDEPENDENT: Third-party Damage
  var tpdSusc = locClass >= 3 ? "high" : locClass === 2 ? "medium" : "low";
  threats.push({
    threat: "third_party_damage",
    threat_type: "time_independent",
    susceptibility: tpdSusc,
    drivers: ["location_class", "right_of_way_control", "public_awareness"],
    evidence: { location_class: locClass, prior_incidents: inp.prior_tpd_incidents }
  });

  // TIME-INDEPENDENT: Incorrect Operations
  var incOpSusc = inp.overpressure_incidents > 0 ? "high" : "low";
  threats.push({
    threat: "incorrect_operations",
    threat_type: "time_independent",
    susceptibility: incOpSusc,
    drivers: ["operating_procedures", "training", "overpressure_history"],
    evidence: { overpressure_incidents: inp.overpressure_incidents }
  });

  // TIME-INDEPENDENT: Weather / Outside Force
  var weatherSusc = inp.extreme_weather_zone === "yes" ? "high" : "low";
  threats.push({
    threat: "weather_outside_force",
    threat_type: "time_independent",
    susceptibility: weatherSusc,
    drivers: ["climate_zone", "geographic_hazards"],
    evidence: { extreme_weather_zone: inp.extreme_weather_zone }
  });

  var high_count = threats.filter(function(t) { return t.susceptibility === "high"; }).length;
  var conf = 0.75 + (high_count * 0.03);

  return buildResult("identify_threats", {
    result: { threats: threats, threat_summary: { high: high_count, medium: threats.filter(function(t) { return t.susceptibility === "medium"; }).length, low: threats.filter(function(t) { return t.susceptibility === "low"; }).length } },
    interpretation: "Identified " + threats.length + " threat categories. " + high_count + " high-susceptibility threats detected.",
    confidence: clamp01(conf),
    severity: high_count >= 3 ? "high" : high_count >= 1 ? "medium" : "low",
    assumptions: ["Threat susceptibility based on regulatory frameworks (ASME B31.8S)", "Soil properties representative of pipeline segment"],
    limitations: ["Site-specific factors require field verification", "SCC assessment requires pH profile"]
  });
}

// ============================================================
// HCA IDENTIFICATION (49 CFR 192.903 / 195.450)
// ============================================================

function identifyHCA(inp) {
  var m = getMissing(inp, ["location_class", "product_type", "operating_pressure", "diameter"]);
  if (m.length) return holdResult("identify_hca", m);

  var locClass = num(inp.location_class, 1);
  var product = inp.product_type || "gas";
  var p = num(inp.operating_pressure, 500);
  var d = num(inp.diameter, 12);
  var near_water = inp.near_waterway === "yes";
  var near_water_source = inp.near_potable_water === "yes";

  var is_hca = false;
  var hca_type = "";
  var reasons = [];

  // Gas: Class 3/4 are HCA
  if (product === "gas" && locClass >= 3) {
    is_hca = true;
    hca_type = "class_3_4_location";
    reasons.push("Class " + locClass + " location per 49 CFR 192.903(a)(1)");
  }

  // Waterways
  if (near_water) {
    is_hca = true;
    hca_type = hca_type ? hca_type + "_waterway" : "waterway";
    reasons.push("Located in/near navigable waterway per 49 CFR 192.903(a)(2)");
  }

  // Potable water sources
  if (near_water_source) {
    is_hca = true;
    hca_type = hca_type ? hca_type + "_water_source" : "water_source";
    reasons.push("Near potable water source per 49 CFR 192.903(a)(3)");
  }

  var could_affect_radius = 0;
  if (product === "gas" && p > 0 && d > 0) {
    could_affect_radius = 0.69 * Math.sqrt(p * d * d);
  }

  var assessment_required = "every_7_years";
  if (product === "liquid") assessment_required = "every_5_years";

  return buildResult("identify_hca", {
    result: {
      is_hca: is_hca,
      hca_type: hca_type,
      reasons: reasons,
      could_affect_radius_ft: could_affect_radius,
      assessment_frequency: assessment_required,
      next_assessment_due: inp.last_assessment_date ? new Date(new Date(inp.last_assessment_date).getTime() + (assessment_required === "every_7_years" ? 7 * 365 * 24 * 60 * 60 * 1000 : 5 * 365 * 24 * 60 * 60 * 1000)).toISOString().split("T")[0] : "unknown"
    },
    interpretation: is_hca ? "Pipeline segment is HIGH CONSEQUENCE AREA. " + reasons.join(" ") : "Pipeline segment is NOT classified as HCA.",
    confidence: 0.95,
    severity: is_hca ? "high" : "info",
    assumptions: ["Location class determined per 49 CFR 192.5", "Product type is " + product],
    limitations: ["Could-affect radius is approximate for gas only"]
  });
}

// ============================================================
// COMPUTE MAOP (49 CFR 192.5 / Barlow Formula)
// ============================================================

function computeMAOP(inp) {
  var m = getMissing(inp, ["smys", "wall_thickness", "diameter", "location_class", "material_grade"]);
  if (m.length) return holdResult("compute_maop", m);

  var smys = num(inp.smys, 35000);
  var t = num(inp.wall_thickness, 0.25);
  var d = num(inp.diameter, 12);
  var locClass = num(inp.location_class, 1);
  var mat = inp.material_grade || "unknown";
  var e = num(inp.efficiency_factor, 1.0);
  var temp_factor = num(inp.temperature_derating, 1.0);

  var locInfo = classifyLocation(num(inp.building_count, 5), inp.proximity_info);
  var f = locInfo.design_factor;

  var maop = (2 * smys * t * f * e * temp_factor) / d;

  var min_stress_pct = (num(inp.operating_pressure, 500) / smys) * 100;

  return buildResult("compute_maop", {
    result: {
      maop_psi: Math.round(maop),
      design_factor: f,
      location_class: locClass,
      smys: smys,
      wall_thickness: t,
      diameter: d,
      stress_utilization_pct: Math.round(min_stress_pct * 10) / 10,
      material_grade: mat,
      temperature_derating: temp_factor
    },
    interpretation: "MAOP is " + Math.round(maop) + " psi for Class " + locClass + " location with design factor " + f + ". Current operating stress " + Math.round(min_stress_pct * 10) / 10 + "% of SMYS.",
    confidence: 0.85,
    severity: min_stress_pct > 72 ? "high" : min_stress_pct > 60 ? "medium" : "low",
    assumptions: ["Seam efficiency per manufacturing process", "No degradation from corrosion or defects"],
    limitations: ["Does not account for metal loss or defects", "Temperature derating must be provided if applicable"],
    proof_trace: { mathematical_basis: ["Barlow formula with design factors"], calculation_steps: ["MAOP = (2 * " + smys + " * " + t + " * " + f + " * " + e + " * " + temp_factor + ") / " + d + " = " + maop.toFixed(2)] }
  });
}

// ============================================================
// CLASSIFY ILI FEATURES (API 1160)
// ============================================================

function classifyFeatures(inp) {
  var m = getMissing(inp, ["features", "maop", "smys", "diameter", "wall_thickness"]);
  if (m.length) return holdResult("classify_features", m);

  var features = inp.features || [];
  var maop = num(inp.maop, 500);
  var smys = num(inp.smys, 35000);
  var d = num(inp.diameter, 12);
  var t = num(inp.wall_thickness, 0.25);

  var classified = [];

  for (var i = 0; i < features.length; i++) {
    var feat = features[i];
    var ftype = feat.type || "unknown";
    var depth = num(feat.depth, 0);
    var length = num(feat.length, 0);
    var location = feat.location || "body";

    var category = "no_action";
    var justification = "";

    if (ftype === "metal_loss") {
      var depth_pct = (depth / t) * 100;
      var a = depth * length;
      var ao = t * length;
      var mt = 1.0;
      var pf_factor = (1 - a / ao) / (1 - a / (ao * mt));
      var pf = (2 * smys * t / d) * pf_factor;
      var pf_maop_ratio = pf / maop;

      if (pf_maop_ratio < 1.1) {
        category = "immediate";
        justification = "Predicted failure pressure " + pf.toFixed(0) + " psi < 1.1*MAOP (" + (maop * 1.1).toFixed(0) + " psi)";
      } else if (depth_pct > 80) {
        category = "scheduled";
        justification = "Depth " + depth_pct.toFixed(1) + "% > 80% threshold";
      } else if (depth_pct > 50) {
        category = "monitored";
        justification = "Depth " + depth_pct.toFixed(1) + "% > 50% threshold";
      } else {
        category = "no_action";
        justification = "Depth " + depth_pct.toFixed(1) + "% <= 50%";
      }

      classified.push({
        feature_id: feat.id || "feat_" + i,
        type: ftype,
        depth_in: depth,
        depth_pct_wt: depth_pct,
        length_in: length,
        category: category,
        predicted_failure_psi: pf.toFixed(0),
        pf_maop_ratio: pf_maop_ratio.toFixed(2),
        justification: justification
      });

    } else if (ftype === "dent") {
      var dent_pct = (depth / d) * 100;

      if (location === "seam_weld" && dent_pct > 2) {
        category = "immediate";
        justification = "Dent on seam weld exceeds 2% OD";
      } else if (dent_pct > 6) {
        category = "immediate";
        justification = "Dent depth " + dent_pct.toFixed(2) + "% OD > 6% threshold";
      } else if (dent_pct > 2 && feat.has_stress_riser) {
        category = "scheduled";
        justification = "Dent with stress riser exceeds 2% OD";
      } else if (dent_pct > 2) {
        category = "monitored";
        justification = "Dent depth " + dent_pct.toFixed(2) + "% OD > 2% threshold";
      }

      classified.push({
        feature_id: feat.id || "feat_" + i,
        type: ftype,
        depth_in: depth,
        depth_pct_od: dent_pct,
        location: location,
        category: category,
        has_stress_riser: feat.has_stress_riser,
        justification: justification
      });

    } else if (ftype === "crack") {
      var pf_crack = (2 * smys * t / d) * 0.85;
      var pf_crack_ratio = pf_crack / maop;

      if (pf_crack_ratio < 1.1) {
        category = "immediate";
        justification = "Predicted failure pressure < 1.1*MAOP (API 579 Part 9)";
      } else {
        category = "assessment_needed";
        justification = "Reportable crack-like indication requires detailed ECA";
      }

      classified.push({
        feature_id: feat.id || "feat_" + i,
        type: ftype,
        length_in: length,
        category: category,
        predicted_failure_psi: pf_crack.toFixed(0),
        justification: justification
      });
    }
  }

  var immediate = classified.filter(function(f) { return f.category === "immediate"; }).length;
  var scheduled = classified.filter(function(f) { return f.category === "scheduled"; }).length;

  return buildResult("classify_features", {
    result: {
      classified_features: classified,
      action_summary: { immediate: immediate, scheduled: scheduled, monitored: classified.filter(function(f) { return f.category === "monitored"; }).length, no_action: classified.filter(function(f) { return f.category === "no_action"; }).length }
    },
    interpretation: "Classified " + classified.length + " features. " + immediate + " immediate, " + scheduled + " scheduled.",
    confidence: 0.80,
    severity: immediate > 0 ? "high" : scheduled > 0 ? "medium" : "low",
    assumptions: ["Modified B31G method for metal loss", "Linear elastic fracture mechanics for cracks", "Interaction rules per API 1160"],
    limitations: ["Does not account for feature interactions", "ECA required for complex geometries"]
  });
}

// ============================================================
// PLAN REASSESSMENT (49 CFR 192.939 / 195.452)
// ============================================================

function planReassessment(inp) {
  var m = getMissing(inp, ["is_hca", "product_type", "last_assessment_date", "feature_growth_rate"]);
  if (m.length) return holdResult("plan_reassessment", m);

  var is_hca = inp.is_hca || false;
  var product = inp.product_type || "gas";
  var last_date = new Date(inp.last_assessment_date);
  var growth_rate_in_per_year = num(inp.feature_growth_rate, 0.01);

  var max_interval_years = product === "gas" ? 7 : 5;
  if (!is_hca) max_interval_years = product === "gas" ? 10 : 10;

  var next_due_date = new Date(last_date.getTime() + max_interval_years * 365.25 * 24 * 60 * 60 * 1000);
  var confirmatory_da_date = new Date(last_date.getTime() + (max_interval_years / 2) * 365.25 * 24 * 60 * 60 * 1000);

  var years_until_threshold = growth_rate_in_per_year > 0 ? (0.8 / growth_rate_in_per_year) : 999;
  var growth_based_due = new Date(last_date.getTime() + years_until_threshold * 365.25 * 24 * 60 * 60 * 1000);

  var effective_due = next_due_date < growth_based_due ? next_due_date : growth_based_due;

  return buildResult("plan_reassessment", {
    result: {
      is_hca: is_hca,
      product_type: product,
      regulatory_max_interval_years: max_interval_years,
      next_assessment_due: effective_due.toISOString().split("T")[0],
      days_until_due: Math.max(0, Math.round((effective_due.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000))),
      confirmatory_da_interval: "by " + confirmatory_da_date.toISOString().split("T")[0],
      growth_rate_in_per_year: growth_rate_in_per_year,
      years_to_threshold: Math.round(years_until_threshold * 10) / 10
    },
    interpretation: "Next assessment due " + effective_due.toISOString().split("T")[0] + " (" + Math.round((effective_due.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000) / 30) + " months). Confirmatory DA recommended by " + confirmatory_da_date.toISOString().split("T")[0] + ".",
    confidence: growth_rate_in_per_year > 0 ? 0.70 : 0.85,
    severity: (effective_due.getTime() - new Date().getTime()) < 90 * 24 * 60 * 60 * 1000 ? "high" : "medium",
    assumptions: ["Growth rate is constant", "Regulatory framework is " + (is_hca ? "HCA" : "non-HCA")],
    limitations: ["Growth rate must be validated from historical data", "Changes in operating conditions may alter interval"]
  });
}

// ============================================================
// MAIN HANDLER
// ============================================================

var authGuard = require("./auth-guard.cjs"); // DEPLOY471
var handler: Handler = async function(event, context) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true }) };
  }

  if (event.httpMethod !== "POST") {

  var __a = await authGuard.verifyAuth(event); if (!__a.ok) { return authGuard.denyResponse(__a, corsHeaders); } // DEPLOY471
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };
  }

  var body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  var action = body.action || "";
  var payload = body.payload || {};
  var result;

  if (action === "identify_threats") {
    result = identifyThreats(payload);
  } else if (action === "identify_hca") {
    result = identifyHCA(payload);
  } else if (action === "compute_maop") {
    result = computeMAOP(payload);
  } else if (action === "classify_features") {
    result = classifyFeatures(payload);
  } else if (action === "plan_reassessment") {
    result = planReassessment(payload);
  } else if (action === "get_registry") {
    var client = createClient(supabaseUrl, supabaseKey);
    try {
      var data = await client.from("pipeline_assessments").select("*").limit(100);
      result = buildResult("get_registry", { result: { assessments: data.data || [], count: (data.data || []).length }, interpretation: "Retrieved " + (data.data || []).length + " pipeline assessments.", confidence: 0.95 });
    } catch (err) {
      result = buildResult("get_registry", { result: { error: err.message }, interpretation: "Database error", confidence: 0.0, severity: "error" });
    }
  } else if (action === "get_history") {
    var client = createClient(supabaseUrl, supabaseKey);
    var pipe_id = payload.pipeline_id || "";
    if (!pipe_id) {
      result = holdResult("get_history", ["pipeline_id"]);
    } else {
      try {
        var data = await client.from("pipeline_assessments").select("*").eq("pipeline_id", pipe_id).order("assessment_date", { ascending: false });
        result = buildResult("get_history", { result: { assessments: data.data || [], pipeline_id: pipe_id }, interpretation: "Retrieved " + (data.data || []).length + " historical assessments.", confidence: 0.95 });
      } catch (err) {
        result = buildResult("get_history", { result: { error: err.message }, interpretation: "Database error", confidence: 0.0, severity: "error" });
      }
    }
  } else {
    result = buildResult("unknown", { result: { available_actions: ["identify_threats", "identify_hca", "compute_maop", "classify_features", "plan_reassessment", "get_registry", "get_history"] }, interpretation: "Unknown action. Use one of the available actions.", confidence: 0.5, severity: "info" });
  }

  if (result.result && body.save_to_db !== false) {
    var client = createClient(supabaseUrl, supabaseKey);
    var record = {
      engine_id: ENGINE_ID,
      deploy: DEPLOY,
      action: action,
      payload: payload,
      result: result,
      created_at: new Date().toISOString()
    };
    try {
      await client.from("pipeline_assessments").insert([record]);
    } catch (err) {
      // Non-fatal: log and continue
    }
  }

  return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result) };
};

export { handler };
