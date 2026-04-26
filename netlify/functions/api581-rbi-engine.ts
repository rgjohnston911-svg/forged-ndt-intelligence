// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_ANON_KEY;
var supabase = createClient(supabaseUrl, supabaseKey);

// ── API 581 RP 581 RISK-BASED INSPECTION ENGINE ────────────────────────────────
// Reference: API Recommended Practice 581, 3rd Edition (2016)
// Implements quantitative RBI methodology per Sections 5-8
// DEPLOY337 - Production Risk Calculations

// ── GENERIC FAILURE FREQUENCY (GFF) ────────────────────────────────────
// Table 5.1 - Base failure rates per equipment type per year
var GFF_BY_EQUIPMENT = {
  pipe: 3.06e-5,
  vessel: 7.56e-5,
  tank_bottom: 6.26e-4,
  heat_exchanger_tube: 1.05e-3,
  pump_casing: 2.41e-4,
  fired_heater_tube: 1.41e-4,
  separator: 1.37e-4,
  compressor_casing: 1.05e-4
};

// ── DAMAGE FACTOR LOOKUP TABLES ────────────────────────────────────
// Table 5.11/5.12 - Thinning damage factor based on Art and inspections
// Art = (tnom - tmm) / (tnom - tmin) = fractional wall loss
var THINNING_DF_TABLE = {
  zero_inspections: [
    { art: 0.0, df: 1 },
    { art: 0.1, df: 1 },
    { art: 0.2, df: 30 },
    { art: 0.3, df: 350 },
    { art: 0.4, df: 1500 },
    { art: 0.5, df: 5100 },
    { art: 0.6, df: 18000 },
    { art: 0.7, df: 55000 },
    { art: 0.8, df: 160000 },
    { art: 0.9, df: 450000 },
    { art: 1.0, df: 1200000 }
  ],
  one_inspection_a: [
    { art: 0.0, df: 1 },
    { art: 0.2, df: 3 },
    { art: 0.3, df: 35 },
    { art: 0.5, df: 510 },
    { art: 0.7, df: 5500 },
    { art: 0.9, df: 45000 }
  ],
  two_inspections_a: [
    { art: 0.0, df: 1 },
    { art: 0.2, df: 0.6 },
    { art: 0.5, df: 102 },
    { art: 0.8, df: 3200 },
    { art: 1.0, df: 24000 }
  ],
  three_inspections_a: [
    { art: 0.0, df: 1 },
    { art: 0.3, df: 1.75 },
    { art: 0.6, df: 90 },
    { art: 0.9, df: 2250 }
  ]
};

// ── INSPECTION EFFECTIVENESS CATEGORIES ────────────────────────────────
// Section 5.3.1 - POD and PoI relationships
var EFFECTIVENESS_BY_CATEGORY = {
  A: { pod_min: 0.90, poi: 0.90, name: "Highly Effective" },
  B: { pod_min: 0.70, poi: 0.70, name: "Usually Effective" },
  C: { pod_min: 0.50, poi: 0.50, name: "Fairly Effective" },
  D: { pod_min: 0.30, poi: 0.30, name: "Poorly Effective" },
  E: { pod_min: 0.0, poi: 0.10, name: "Ineffective" }
};

// ── FLUID CONSEQUENCE COEFFICIENTS ────────────────────────────────────
// Table 8.1 - Flammable consequence area = a * mass^b
// Release consequence models per API 581 Section 8.2
var FLUID_CONSEQUENCE_COEFS = {
  c1_c2: { a: 8.669, b: 0.98, name: "Methane/Ethane", model: "jet_fire" },
  c3_c4: { a: 55.13, b: 0.95, name: "Propane/Butane", model: "jet_fire" },
  c5: { a: 96.53, b: 0.92, name: "Pentane", model: "jet_fire" },
  c6_c8: { a: 130.2, b: 0.90, name: "Gasoline Range", model: "jet_fire" },
  c9_c12: { a: 103.4, b: 0.88, name: "Diesel Range", model: "jet_fire" },
  c13_c16: { a: 79.94, b: 0.85, name: "Gas Oil", model: "jet_fire" },
  c17_c25: { a: 60.07, b: 0.82, name: "Crude Oil Range", model: "jet_fire" },
  hydrogen: { a: 16.47, b: 0.96, name: "Hydrogen", model: "auto_ignition" },
  h2s: { a: 0, b: 0, name: "H2S", model: "toxic" },
  steam: { a: 0, b: 0, name: "Steam", model: "thermal" }
};

// ── MANAGEMENT SYSTEMS FACTOR ────────────────────────────────────
// Section 5.4 - FMS ranges 0.5 to 2.0
var PSM_QUALITY_FACTOR = function(psm_score) {
  if (psm_score >= 4.5) return 0.5;
  if (psm_score >= 4.0) return 0.6;
  if (psm_score >= 3.5) return 0.75;
  if (psm_score >= 3.0) return 1.0;
  if (psm_score >= 2.5) return 1.25;
  if (psm_score >= 2.0) return 1.5;
  if (psm_score >= 1.0) return 1.75;
  return 2.0;
};

// ── RISK MATRIX CATEGORIES ────────────────────────────────────
// Table 9.1 - 5x5 Risk matrix with probability and consequence ranges
var RISK_CATEGORIES = {
  low_low: 1,
  low_medium: 2,
  low_high: 3,
  medium_medium: 4,
  medium_high: 5,
  high_high: 9
};

// ── INTERPOLATE DF FROM LOOKUP TABLE ────────────────────────────────
var interpolateDf = function(art, table) {
  var lower = null;
  var upper = null;
  var i = 0;

  while (i < table.length) {
    if (table[i].art <= art) lower = table[i];
    if (table[i].art >= art && upper === null) upper = table[i];
    i = i + 1;
  }

  if (lower === null) return table[0].df;
  if (upper === null) return table[table.length - 1].df;
  if (lower.art === upper.art) return lower.df;

  var fraction = (art - lower.art) / (upper.art - lower.art);
  var result = lower.df + (upper.df - lower.df) * fraction;

  return result;
};

// ── SELECT APPROPRIATE THINNING TABLE ────────────────────────────────
var selectThinningSccTable = function(num_a_inspections) {
  if (num_a_inspections >= 3) return THINNING_DF_TABLE.three_inspections_a;
  if (num_a_inspections === 2) return THINNING_DF_TABLE.two_inspections_a;
  if (num_a_inspections === 1) return THINNING_DF_TABLE.one_inspection_a;
  return THINNING_DF_TABLE.zero_inspections;
};

// ── COMPUTE THINNING DAMAGE FACTOR ────────────────────────────────
// Section 5.3.2 - Localized corrosion/thinning
var computeDfThinning = function(input) {
  var tnom = input.tnom;
  var tmm = input.tmm;
  var tmin = input.tmin;
  var num_a_inspections = input.num_a_inspections || 0;
  var inspection_effectiveness = input.inspection_effectiveness || "E";

  if (tnom <= tmin) {
    var msg = "Nominal thickness must exceed minimum allowable";
    throw new Error(msg);
  }

  var art = (tnom - tmm) / (tnom - tmin);
  art = art < 0 ? 0 : art;
  art = art > 1 ? 1 : art;

  var table = selectThinningSccTable(num_a_inspections);
  var df_base = interpolateDf(art, table);

  // Apply inspection effectiveness reduction (POD factor)
  var eff = EFFECTIVENESS_BY_CATEGORY[inspection_effectiveness];
  var pod = eff ? eff.pod_min : 0.0;
  var df_reduced = df_base * (1 - pod) + (df_base * pod / 10);

  return {
    art: art,
    df_base: df_base,
    df_reduced: df_reduced,
    pod: pod,
    num_inspections: num_a_inspections
  };
};

// ── COMPUTE SCC DAMAGE FACTOR ────────────────────────────────────
// Section 5.3.3 - Stress corrosion cracking
var computeDfScc = function(input) {
  var susceptibility = input.susceptibility;
  var time_in_service = input.time_in_service;
  var num_inspections = input.num_inspections || 0;
  var last_inspection_negative = input.last_inspection_negative;

  var df_base = 1;

  if (susceptibility === "high") {
    df_base = 3500 * Math.exp(-0.15 * time_in_service);
  } else if (susceptibility === "medium") {
    df_base = 1000 * Math.exp(-0.10 * time_in_service);
  } else if (susceptibility === "low") {
    df_base = 100 * Math.exp(-0.05 * time_in_service);
  } else {
    df_base = 1;
  }

  // Inspection reduction
  if (last_inspection_negative && num_inspections > 0) {
    df_base = df_base / (1 + num_inspections * 0.5);
  }

  return {
    df: df_base,
    susceptibility: susceptibility,
    time_in_service: time_in_service,
    inspections: num_inspections
  };
};

// ── COMPUTE EXTERNAL CORROSION DAMAGE FACTOR ────────────────────────────
// Section 5.3.4
var computeDfExternalCorrosion = function(input) {
  var coating_condition = input.coating_condition;
  var insulation_type = input.insulation_type;
  var operating_temperature = input.operating_temperature;

  var df = 1;

  // Coating degradation
  if (coating_condition === "poor") df = df * 8;
  else if (coating_condition === "fair") df = df * 3;
  else if (coating_condition === "good") df = df * 0.5;

  // High temperature accelerates
  if (operating_temperature > 80) {
    df = df * (1 + (operating_temperature - 80) / 100);
  }

  // Insulation traps moisture
  if (insulation_type === "none" || insulation_type === null) {
    df = df * 1;
  } else {
    df = df * 2;
  }

  return {
    df: df,
    coating: coating_condition,
    insulation: insulation_type,
    temperature_c: operating_temperature
  };
};

// ── COMPUTE HTHA DAMAGE FACTOR ────────────────────────────────────
// Section 5.3.5 - High-temperature hydrogen attack (Nelson curve)
var computeDfHtha = function(input) {
  var temp_f = input.temp_f;
  var ph2_psi = input.ph2_psi;
  var material_grade = input.material_grade;

  // Simplified Nelson curve: exposure zones
  var df = 1;

  // Zone 1: Safe (below Nelson curve)
  if (temp_f < 400) df = 1;
  // Zone 2: Moderate risk (400-800F, depending on H2 pressure)
  else if (temp_f < 600 && ph2_psi < 1000) df = 10;
  else if (temp_f < 700 && ph2_psi < 500) df = 15;
  // Zone 3: High risk (above 800F or high pressure)
  else df = 100;

  // Material grade mitigation
  if (material_grade === "1cr1stvo" || material_grade === "2cr1stvo") {
    df = df * 0.1;
  } else if (material_grade === "1cr0.5mo") {
    df = df * 0.3;
  }

  return {
    df: df,
    temp_f: temp_f,
    ph2_psi: ph2_psi,
    material: material_grade,
    nelson_zone: temp_f > 800 ? "risk" : "moderate"
  };
};

// ── COMPUTE BRITTLE FRACTURE DAMAGE FACTOR ────────────────────────────
// Section 5.3.6
var computeDfBrittleFracture = function(input) {
  var operating_temp = input.operating_temp;
  var design_temp = input.design_temp;
  var material = input.material;
  var thickness = input.thickness;

  // Charpy energy test (MAT = MDMT + margin)
  var mat = input.mat;
  var margin = design_temp - mat;

  var df = 1;

  // Below MAT is risk of brittle fracture
  if (operating_temp < mat) {
    df = 50;
  } else if (margin < 10) {
    df = 20;
  } else if (margin < 20) {
    df = 5;
  } else if (margin < 50) {
    df = 2;
  } else {
    df = 1;
  }

  // Thick sections more vulnerable
  if (thickness > 1.0) {
    df = df * 1.5;
  }

  return {
    df: df,
    operating_temp: operating_temp,
    mat: mat,
    margin: margin,
    thickness: thickness
  };
};

// ── COMPUTE RELEASE RATE ────────────────────────────────────
// Section 8.3.1 - Hole/rupture model
var computeReleaseRate = function(input) {
  var hole_diameter_mm = input.hole_diameter_mm;
  var operating_pressure_bar = input.operating_pressure_bar;
  var density_kg_m3 = input.density_kg_m3;
  var phase = input.phase;

  var cd = 0.7;
  var area_m2 = Math.PI * Math.pow(hole_diameter_mm / 1000, 2) / 4;
  var pressure_pa = operating_pressure_bar * 100000;

  var release_rate_kg_s = 0;

  if (phase === "liquid") {
    release_rate_kg_s = cd * area_m2 * Math.sqrt(2 * density_kg_m3 * pressure_pa);
  } else if (phase === "gas") {
    var temp_k = input.temp_k || 298;
    var mw = input.molecular_weight || 32;
    var z = input.compressibility || 1.0;
    release_rate_kg_s = cd * area_m2 * pressure_pa * mw / Math.sqrt(z * 8.314 * temp_k * mw * density_kg_m3);
  }

  return {
    release_rate_kg_s: release_rate_kg_s,
    hole_diameter_mm: hole_diameter_mm,
    pressure_bar: operating_pressure_bar,
    phase: phase
  };
};

// ── COMPUTE CONSEQUENCE AREA (FLAMMABLE) ────────────────────────────────
// Section 8.2 - Consequence distance based on fluid type
var computeConsequenceArea = function(input) {
  var release_mass_kg = input.release_mass_kg;
  var fluid_category = input.fluid_category;
  var ignition_type = input.ignition_type;

  var coefs = FLUID_CONSEQUENCE_COEFS[fluid_category];

  if (!coefs) {
    return {
      consequence_area_m2: 0,
      consequence_radius_m: 0,
      error: "Unknown fluid category"
    };
  }

  var a = coefs.a;
  var b = coefs.b;

  // CA = a * mass^b (API 581 Table 8.1)
  var ca = a * Math.pow(release_mass_kg, b);

  // Convert area to radius
  var radius = Math.sqrt(ca / Math.PI);

  return {
    consequence_area_m2: ca,
    consequence_radius_m: radius,
    fluid_category: fluid_category,
    model: coefs.model,
    a_coef: a,
    b_coef: b
  };
};

// ── COMPUTE PROBABILITY OF FAILURE ────────────────────────────────
var computeProbabilityOfFailure = function(input) {
  var equipment_type = input.equipment_type;
  var equipment_length_m = input.equipment_length_m || 1;
  var df_thinning = input.df_thinning || 1;
  var df_scc = input.df_scc || 1;
  var df_external = input.df_external || 1;
  var df_htha = input.df_htha || 1;
  var df_brittle = input.df_brittle || 1;
  var psm_quality = input.psm_quality || 3.0;

  var gff = GFF_BY_EQUIPMENT[equipment_type];
  if (!gff) {
    return { error: "Unknown equipment type: " + equipment_type };
  }

  // For piping: scale by length; for vessels: gff already per item
  if (equipment_type === "pipe") {
    gff = gff * equipment_length_m;
  }

  // Combine all damage factors (most severe dominates)
  var df_combined = Math.max(df_thinning, df_scc, df_external, df_htha, df_brittle);

  // Management systems factor
  var fms = PSM_QUALITY_FACTOR(psm_quality);

  // PoF = gff * Df * FMS per Section 5.2
  var pof = gff * df_combined * fms;

  return {
    gff: gff,
    df_combined: df_combined,
    fms: fms,
    pof: pof,
    pof_per_year: pof,
    equipment_type: equipment_type,
    length_m: equipment_type === "pipe" ? equipment_length_m : null
  };
};

// ── COMPUTE CONSEQUENCE OF FAILURE ────────────────────────────────
var computeConsequenceOfFailure = function(input) {
  var release_rate_kg_s = input.release_rate_kg_s || 0;
  var detection_time_s = input.detection_time_s || 60;
  var isolation_time_s = input.isolation_time_s || 300;
  var release_mass_kg = release_rate_kg_s * (detection_time_s + isolation_time_s);

  // Get consequence area
  var ca_input = {
    release_mass_kg: release_mass_kg,
    fluid_category: input.fluid_category,
    ignition_type: input.ignition_type || "auto"
  };
  var ca_result = computeConsequenceArea(ca_input);

  // Financial consequence
  var equipment_value_usd = input.equipment_value_usd || 50000;
  var production_loss_usd_per_day = input.production_loss_usd_per_day || 10000;
  var downtime_days = 3;
  var environmental_cost_usd = input.environmental_cost_usd || 100000;
  var injury_cost_usd = input.injury_cost_usd || 0;

  var financial_cof = equipment_value_usd + (production_loss_usd_per_day * downtime_days) + environmental_cost_usd + injury_cost_usd;

  // Number of people potentially affected
  var population_at_risk = Math.floor(ca_result.consequence_radius_m * 10);

  return {
    release_mass_kg: release_mass_kg,
    consequence_area_m2: ca_result.consequence_area_m2,
    consequence_radius_m: ca_result.consequence_radius_m,
    financial_cof_usd: financial_cof,
    population_at_risk: population_at_risk,
    model: ca_result.model,
    detection_time_s: detection_time_s,
    isolation_time_s: isolation_time_s
  };
};

// ── COMPUTE RISK RANKING ────────────────────────────────────
var computeRiskRanking = function(pof, cof) {
  // Simplified 5x5 matrix
  // PoF bins: 1e-5, 1e-4, 1e-3, 1e-2, 1e-1
  // CoF bins: 1, 10, 100, 1000, 10000 (arbitrary scale)

  var pof_level = 1;
  if (pof > 1e-4) pof_level = 2;
  if (pof > 1e-3) pof_level = 3;
  if (pof > 1e-2) pof_level = 4;
  if (pof > 1e-1) pof_level = 5;

  var cof_level = 1;
  if (cof > 1000) cof_level = 2;
  if (cof > 10000) cof_level = 3;
  if (cof > 100000) cof_level = 4;
  if (cof > 1000000) cof_level = 5;

  var matrix_position = (pof_level - 1) * 5 + cof_level;

  var risk_level = "low";
  if (pof_level >= 3 && cof_level >= 3) risk_level = "high";
  else if (pof_level >= 2 || cof_level >= 2) risk_level = "medium";

  return {
    matrix_position: matrix_position,
    pof_level: pof_level,
    cof_level: cof_level,
    risk_level: risk_level
  };
};

// ── MAIN HANDLER ────────────────────────────────────────────────────────
var handler: Handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "POST only" })
    };
  }

  var body = JSON.parse(event.body || "{}");
  var action = body.action;

  try {
    var result = {};

    if (action === "assess_risk") {
      // Full RBI assessment: PoF + CoF + Risk
      var pof_result = computeProbabilityOfFailure(body);
      var cof_result = computeConsequenceOfFailure(body);
      var risk = pof_result.pof * cof_result.financial_cof_usd;
      var ranking = computeRiskRanking(pof_result.pof, cof_result.financial_cof_usd);

      result = {
        action: "assess_risk",
        pof: pof_result,
        cof: cof_result,
        risk_score: risk,
        risk_ranking: ranking,
        deterministic: { pof: pof_result.pof, cof_usd: cof_result.financial_cof_usd },
        interpreted: { risk_level: ranking.risk_level },
        provenance: { method: "API 581 Section 5-8", deploy: "DEPLOY337" }
      };

    } else if (action === "compute_pof") {
      result = {
        action: "compute_pof",
        pof: computeProbabilityOfFailure(body),
        deterministic: { equation: "PoF = gff * Df * FMS" },
        provenance: { reference: "API 581 Section 5.2" }
      };

    } else if (action === "compute_cof") {
      result = {
        action: "compute_cof",
        cof: computeConsequenceOfFailure(body),
        deterministic: { equation: "CoF = release_mass * area_model * cost" },
        provenance: { reference: "API 581 Section 8" }
      };

    } else if (action === "compute_damage_factor") {
      var inputs = body;
      var df_results = {};

      if (inputs.thinning_input) {
        df_results.thinning = computeDfThinning(inputs.thinning_input);
      }
      if (inputs.scc_input) {
        df_results.scc = computeDfScc(inputs.scc_input);
      }
      if (inputs.external_input) {
        df_results.external_corrosion = computeDfExternalCorrosion(inputs.external_input);
      }
      if (inputs.htha_input) {
        df_results.htha = computeDfHtha(inputs.htha_input);
      }
      if (inputs.brittle_input) {
        df_results.brittle_fracture = computeDfBrittleFracture(inputs.brittle_input);
      }

      result = {
        action: "compute_damage_factor",
        damage_factors: df_results,
        provenance: { reference: "API 581 Sections 5.3.1-5.3.6, Tables 5.11-5.12" }
      };

    } else if (action === "plan_inspection") {
      // Generate inspection plan to meet risk target
      var target_pof = body.target_pof || 1e-4;
      var current_pof = computeProbabilityOfFailure(body).pof;

      var inspections_needed = 0;
      var next_interval_years = 10;

      if (current_pof > target_pof) {
        inspections_needed = Math.ceil(Math.log(current_pof / target_pof) / Math.log(10));
        next_interval_years = Math.min(5, Math.max(1, 10 / inspections_needed));
      }

      var inspection_recommendation = {
        technique: body.damage_mechanism === "thinning" ? "UT_Thickness" : "UT_Shear_Wave",
        effectiveness_required: "B",
        inspections_to_achieve_target: inspections_needed,
        interval_years: next_interval_years,
        current_pof: current_pof,
        target_pof: target_pof,
        next_inspection_date: new Date(Date.now() + next_interval_years * 365.25 * 24 * 3600 * 1000).toISOString().split("T")[0]
      };

      result = {
        action: "plan_inspection",
        plan: inspection_recommendation,
        provenance: { reference: "API 581 Section 7 - Inspection Planning" }
      };

    } else if (action === "get_risk_matrix") {
      result = {
        action: "get_risk_matrix",
        matrix: {
          rows: 5,
          columns: 5,
          pof_bins: [1e-5, 1e-4, 1e-3, 1e-2, 1e-1],
          cof_bins: [1, 10, 100, 1000, 10000],
          current_position: computeRiskRanking(body.pof || 1e-4, body.cof || 10000)
        },
        provenance: { reference: "API 581 Section 9.1 - Risk Matrix" }
      };

    } else if (action === "get_registry") {
      result = {
        action: "get_registry",
        equipment_types: Object.keys(GFF_BY_EQUIPMENT),
        fluid_categories: Object.keys(FLUID_CONSEQUENCE_COEFS),
        effectiveness_categories: Object.keys(EFFECTIVENESS_BY_CATEGORY),
        damage_mechanisms: ["thinning", "scc", "external_corrosion", "htha", "brittle_fracture"]
      };

    } else if (action === "get_history") {
      var query = await supabase
        .from("rbi_assessments")
        .select("*")
        .eq("asset_id", body.asset_id)
        .order("created_at", { ascending: false })
        .limit(10);

      result = {
        action: "get_history",
        assessments: query.data || [],
        total_records: (query.data || []).length
      };

    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Unknown action: " + action })
      };
    }

    // Save assessment to database (non-fatal)
    if (action === "assess_risk" || action === "compute_pof" || action === "compute_cof") {
      try {
        await supabase.from("rbi_assessments").insert({
          asset_id: body.asset_id,
          action: action,
          equipment_type: body.equipment_type,
          pof: result.pof ? result.pof.pof : null,
          cof_usd: result.cof ? result.cof.financial_cof_usd : null,
          risk_level: result.risk_ranking ? result.risk_ranking.risk_level : null,
          input_data: body,
          result_data: result,
          created_at: new Date().toISOString()
        });
      } catch (dbError) {
        // Non-fatal: continue even if DB write fails
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        deploy: "DEPLOY337"
      })
    };
  }
};

export { handler };
