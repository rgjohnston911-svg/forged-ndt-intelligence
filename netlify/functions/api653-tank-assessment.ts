// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ══════════════════════════════════════════════════════════════════════════════
// API 653 ABOVEGROUND STORAGE TANK INTEGRITY ASSESSMENT ENGINE
// DEPLOY338
//
// This engine implements the complete API 653:2014 (API Standard for
// Tank Inspection, Repair, Alteration, and Reconstruction) assessment
// methodology for aboveground storage tanks used in refining, terminals,
// and pipeline operations.
//
// Core Assessment Areas:
// - Shell course minimum thickness (Section 4.3) - API 650 design formulas
// - Corrosion rate and remaining life (Section 4.4)
// - Bottom plate evaluation (Section 6)
// - Settlement evaluation (Section 12) - uniform, differential, edge, bulging
// - Roof evaluation (Section 5) - frangibility, thickness, condition
// - Foundation assessment
//
// Core Outputs:
// - Minimum thickness (tmin) for each shell course at next inspection
// - Corrosion rate (short-term and long-term)
// - Remaining life years before replacement needed
// - Next inspection interval per API 653 Table 2.3
// - Settlement assessment verdict
// - Overall fitness-for-service acceptance
//
// Actions:
// - get_registry: Return engine capabilities
// - assess: Full tank assessment (shell, bottom, settlement, roof)
// - assess_shell: Shell course evaluation only
// - assess_bottom: Bottom plate evaluation only
// - assess_settlement: Settlement evaluation only
// - compute_tmin: Compute minimum thickness for given course
// - compute_remaining_life: Compute remaining life for each course
// - plan_inspection: Calculate next inspection date
// - get_history: Retrieve past assessments from DB
//
// ══════════════════════════════════════════════════════════════════════════════

// ── ACTION REGISTRY ────────────────────────────────────────────────────────
var ACTION_REGISTRY = {
  "get_registry": { description: "Return engine capabilities", method: "GET_OR_POST" },
  "assess": { description: "Full tank assessment (shell, bottom, settlement, roof)", method: "POST" },
  "assess_shell": { description: "Shell course evaluation only", method: "POST" },
  "assess_bottom": { description: "Bottom plate evaluation only", method: "POST" },
  "assess_settlement": { description: "Settlement evaluation only", method: "POST" },
  "compute_tmin": { description: "Compute minimum thickness for course", method: "POST" },
  "compute_remaining_life": { description: "Compute remaining life for each course", method: "POST" },
  "plan_inspection": { description: "Calculate next inspection date per API 653 intervals", method: "POST" },
  "get_history": { description: "Retrieve past assessments", method: "POST" }
};

// ── MATERIAL ALLOWABLE STRESS DATA ─────────────────────────────────────────
// Per API 650 Table 5.2 and historical practice, in PSI
var MATERIAL_ALLOWABLE_STRESS = {
  "A36": 21000,
  "A36_new": 24000,
  "A283_C": 21000,
  "A516_70": 25400,
  "A537_1": 28800,
  "A573_70": 25400
};

// ── WELD EFFICIENCY FACTORS ────────────────────────────────────────────────
// Per API 650 Section 5.4.3, Table 5.3
var WELD_EFFICIENCY = {
  "fully_radiographed": 1.0,
  "spot_radiographed": 0.85,
  "not_radiographed": 0.70,
  "lap_weld": 0.65
};

// ── SHELL MINIMUM THICKNESS - API 650 ONE-FOOT METHOD ──────────────────────
// API 653 Section 4.3 references API 650 design formula
// tmin = (2.6 * D * (H - 1) * G) / (Sd * E)
// where:
//   D = tank diameter in feet
//   H = height from bottom of course to design liquid level in feet
//   G = specific gravity of stored liquid
//   Sd = allowable tensile stress at design conditions (PSI)
//   E = weld efficiency factor
function compute_tmin_design(D, H, G, Sd, E) {
  if (!D || !H || !G || !Sd || !E) return null;
  if (H < 1) return 0;

  var numerator = 2.6 * D * (H - 1) * G;
  var denominator = Sd * E;
  var tmin_d = numerator / denominator;
  return tmin_d;
}

// ── SHELL MINIMUM THICKNESS - HYDROSTATIC TEST METHOD ────────────────────
// API 653 Section 4.3
// tmin_test = (2.6 * D * (H - 1)) / St
// where:
//   St = allowable tensile stress at hydrostatic test conditions (typically 0.9*Sy)
function compute_tmin_hydro(D, H, St) {
  if (!D || !H || !St) return null;
  if (H < 1) return 0;

  var numerator = 2.6 * D * (H - 1);
  var denominator = St;
  var tmin_t = numerator / denominator;
  return tmin_t;
}

// ── COURSE MINIMUM THICKNESS (takes MAX of design and hydro) ──────────────
function get_course_tmin(course) {
  var tmin_d = compute_tmin_design(
    course.tank_diameter_ft,
    course.height_ft,
    course.specific_gravity,
    course.allowable_stress_design,
    course.weld_efficiency
  );

  var St = (course.allowable_stress_design * 0.9); // Hydro at 90% of design stress
  var tmin_t = compute_tmin_hydro(course.tank_diameter_ft, course.height_ft, St);

  var tmin = Math.max(tmin_d, tmin_t);
  return {
    tmin_design: tmin_d,
    tmin_hydro: tmin_t,
    tmin: tmin,
    source: "API 653 Section 4.3, API 650 Section 4.3.1"
  };
}

// ── CORROSION RATE ASSESSMENT - API 653 Section 4.4 ────────────────────────
// Determine short-term and long-term corrosion rates
function compute_corrosion_rate(t_original, t_previous, t_current, years_previous, years_in_service) {
  var corr_result = {
    short_term: null,
    long_term: null,
    corrosion_rate_used: null
  };

  // Short-term rate: measured from previous inspection
  if (t_previous !== undefined && t_previous !== null && years_previous > 0) {
    corr_result.short_term = (t_previous - t_current) / years_previous;
  }

  // Long-term rate: from original thickness to current
  if (t_original !== undefined && t_original !== null && years_in_service > 0) {
    corr_result.long_term = (t_original - t_current) / years_in_service;
  }

  // Use the HIGHER of the two (conservative per API 653)
  if (corr_result.short_term !== null && corr_result.long_term !== null) {
    corr_result.corrosion_rate_used = Math.max(corr_result.short_term, corr_result.long_term);
  } else if (corr_result.short_term !== null) {
    corr_result.corrosion_rate_used = corr_result.short_term;
  } else if (corr_result.long_term !== null) {
    corr_result.corrosion_rate_used = corr_result.long_term;
  }

  return corr_result;
}

// ── REMAINING LIFE CALCULATION - API 653 Section 4.4 ───────────────────────
// Remaining life = (t_current - tmin) / corrosion_rate
function compute_remaining_life_years(t_current, tmin, corrosion_rate) {
  if (!corrosion_rate || corrosion_rate <= 0) return null;
  if (t_current <= tmin) return 0; // No remaining life

  var life = (t_current - tmin) / corrosion_rate;
  return life;
}

// ── NEXT INSPECTION INTERVAL - API 653 Table 2.3 ──────────────────────────
// Based on remaining life: next inspection is at remaining_life / 2 years
// (conservative interval halving)
function compute_next_inspection_interval(remaining_life) {
  if (!remaining_life || remaining_life < 0) return null;

  var interval = remaining_life / 2;

  // API 653 Table 2.3 caps maximum intervals
  if (interval > 10) interval = 10; // No more than 10 years between inspections
  if (interval < 1) interval = 1;  // Minimum 1 year (urgent cases get more frequent checks)

  return interval;
}

// ── BOTTOM PLATE EVALUATION - API 653 Section 6 ────────────────────────────
function assess_bottom_plate(bottom_input, tank_diameter_ft, years_in_service) {
  var bottom_result = {
    t_measured_in: bottom_input.t_measured_in,
    t_original_in: bottom_input.t_original_in || null,
    minimum_bottom_thickness_in: 0.10, // API 653 Section 6.3.1
    critical_zone_distance_in: 3.0,    // Within 3" of shell-to-bottom weld
    assessment: {}
  };

  // Check if current thickness meets minimum
  if (bottom_input.t_measured_in < 0.10) {
    bottom_result.assessment.verdict = "REPAIR_REQUIRED";
    bottom_result.assessment.reason = "Bottom thickness (" + bottom_input.t_measured_in.toFixed(2) + " in) is below minimum 0.10 in (API 653 Section 6.3.1)";
  } else {
    bottom_result.assessment.verdict = "ACCEPTABLE";
  }

  // Corrosion rate if original thickness available
  if (bottom_input.t_original_in && years_in_service > 0) {
    var bottom_corr_rate = (bottom_input.t_original_in - bottom_input.t_measured_in) / years_in_service;
    var bottom_remaining_life = null;

    if (bottom_corr_rate > 0) {
      bottom_remaining_life = (bottom_input.t_measured_in - 0.10) / bottom_corr_rate;
    }

    bottom_result.assessment.corrosion_rate_ipy = bottom_corr_rate;
    bottom_result.assessment.remaining_life_years = bottom_remaining_life;
  }

  // Leak test recommendation
  bottom_result.assessment.leak_test_required = (bottom_input.t_measured_in < 0.15);
  bottom_result.assessment.code_reference = "API 653 Section 6.3, 6.4 (Bottom Evaluation)";

  return bottom_result;
}

// ── SETTLEMENT EVALUATION - API 653 Section 12 ─────────────────────────────
function assess_settlement(tank_diameter_ft, settlement_readings) {
  var settlement_result = {
    tank_diameter_ft: tank_diameter_ft,
    readings_count: settlement_readings ? settlement_readings.length : 0,
    settlement_assessment: {}
  };

  if (!settlement_readings || settlement_readings.length === 0) {
    settlement_result.settlement_assessment.verdict = "NO_DATA";
    return settlement_result;
  }

  var min_reading = Infinity;
  var max_reading = -Infinity;
  var sum_reading = 0;

  for (var ri = 0; ri < settlement_readings.length; ri++) {
    var reading = settlement_readings[ri].reading;
    sum_reading += reading;
    if (reading < min_reading) min_reading = reading;
    if (reading > max_reading) max_reading = reading;
  }

  var avg_settlement = sum_reading / settlement_readings.length;
  var differential_settlement = max_reading - min_reading;

  // API 653 Table 12.1: maximum differential settlement limits
  var max_differential_allowed = 0.005 * tank_diameter_ft; // 0.5% of diameter

  // Tilt = differential_settlement / diameter
  var tilt_ratio = (differential_settlement / tank_diameter_ft);

  settlement_result.settlement_assessment = {
    average_settlement_in: avg_settlement,
    differential_settlement_in: differential_settlement,
    max_differential_allowed_in: max_differential_allowed,
    tilt_ratio: tilt_ratio,
    tilt_limit: 0.005,
    verdict: (tilt_ratio > 0.005) ? "REPAIR_REQUIRED" : "ACCEPTABLE",
    reason: (tilt_ratio > 0.005)
      ? "Differential settlement exceeds API 653 Section 12.1 limit of 0.5% tank diameter"
      : "Settlement within acceptable limits per API 653 Section 12.1",
    code_reference: "API 653 Section 12 (Foundation Settlement)"
  };

  return settlement_result;
}

// ── ROOF EVALUATION - API 653 Section 5 ──────────────────────────────────
function assess_roof(roof_input) {
  var roof_result = {
    roof_type: roof_input.roof_type || "cone",
    assessment: {}
  };

  // Cone roof minimum thickness: 3/16" nominal per API 650
  if (roof_input.roof_type === "cone" || roof_input.roof_type === "fixed") {
    var min_cone_thickness = 0.1875; // 3/16 inch
    if (roof_input.thickness_in < min_cone_thickness) {
      roof_result.assessment.verdict = "REPAIR_REQUIRED";
      roof_result.assessment.reason = "Cone roof thickness (" + roof_input.thickness_in.toFixed(3) + " in) below minimum 3/16 in";
    } else {
      roof_result.assessment.verdict = "ACCEPTABLE";
    }
  }

  // Floating roof check
  if (roof_input.roof_type === "floating") {
    var min_pontoon_thickness = 0.125; // 1/8 inch
    if (roof_input.pontoon_thickness_in && roof_input.pontoon_thickness_in < min_pontoon_thickness) {
      roof_result.assessment.verdict = "REPAIR_REQUIRED";
      roof_result.assessment.reason = "Floating roof pontoon thickness below minimum 1/8 in";
    } else {
      roof_result.assessment.verdict = "ACCEPTABLE";
    }
  }

  // Frangible joint check (critical for safety)
  roof_result.assessment.frangible_joint_check = roof_input.frangible_joint_adequate || null;
  roof_result.assessment.code_reference = "API 653 Section 5.3 (Roof Evaluation)";

  return roof_result;
}

// ── FULL TANK ASSESSMENT ───────────────────────────────────────────────────
function assess_tank(input) {
  var result = {
    engine: "api653-tank-assessment",
    deterministic: {},
    interpreted: {},
    provenance: {
      engine: "api653-tank-assessment",
      version: "1.0.0",
      deploy: "DEPLOY338",
      timestamp: new Date().toISOString()
    }
  };

  // ── INPUT VALIDATION ───────────────────────────────────────────────────
  if (!input.tank_diameter_ft || !input.tank_height_ft || !input.courses || input.courses.length === 0) {
    result.deterministic.error = "Missing required inputs: tank_diameter_ft, tank_height_ft, courses array";
    return result;
  }

  var tank_diameter = input.tank_diameter_ft;
  var tank_height = input.tank_height_ft;
  var specific_gravity = input.specific_gravity || 1.0;
  var courses = input.courses;
  var years_in_service = input.years_in_service || 0;
  var years_to_next = input.years_to_next_inspection || 5;

  // ── SHELL COURSE ASSESSMENT ────────────────────────────────────────────
  var course_assessments = [];
  var any_course_fails = false;
  var overall_remaining_life = null;

  for (var ci = 0; ci < courses.length; ci++) {
    var course = courses[ci];

    // Resolve material allowable stress
    var Sd = MATERIAL_ALLOWABLE_STRESS[course.material] || 21000;
    var E = WELD_EFFICIENCY[course.weld_efficiency] || 0.85;

    // Prepare course data for tmin calculation
    var course_data = {
      tank_diameter_ft: tank_diameter,
      height_ft: course.height_ft,
      specific_gravity: specific_gravity,
      allowable_stress_design: Sd,
      weld_efficiency: E
    };

    var tmin_result = get_course_tmin(course_data);
    var tmin = tmin_result.tmin;

    // Thickness at next inspection
    var corr_data = compute_corrosion_rate(
      course.t_original_in || null,
      course.t_previous_in || null,
      course.t_measured_in,
      course.years_since_previous || years_in_service,
      years_in_service
    );

    var t_at_next = course.t_measured_in - (corr_data.corrosion_rate_used || 0) * years_to_next;
    var meets_requirement = (t_at_next >= tmin);

    // Remaining life
    var remaining_life = null;
    if (corr_data.corrosion_rate_used && corr_data.corrosion_rate_used > 0) {
      remaining_life = compute_remaining_life_years(course.t_measured_in, tmin, corr_data.corrosion_rate_used);
    }

    // Next inspection interval
    var next_inspection_interval = null;
    if (remaining_life !== null) {
      next_inspection_interval = compute_next_inspection_interval(remaining_life);
    }

    var course_assessment = {
      course_number: course.course_number,
      material: course.material,
      height_ft: course.height_ft,
      t_measured_in: course.t_measured_in,
      t_nominal_in: course.tnom_in,

      // Calculated tmin
      tmin_in: tmin,
      tmin_design_in: tmin_result.tmin_design,
      tmin_hydro_in: tmin_result.tmin_hydro,

      // Corrosion
      corrosion_rate_ipy: corr_data.corrosion_rate_used,
      corrosion_rate_source: corr_data.short_term !== null ? "short-term" : "long-term",

      // Thickness projection
      t_at_next_inspection_in: t_at_next,
      meets_requirement_at_next: meets_requirement,

      // Life
      remaining_life_years: remaining_life,
      next_inspection_interval_years: next_inspection_interval,

      // Verdict
      verdict: meets_requirement ? "ACCEPTABLE" : "REPAIR_OR_REPLACEMENT",
      code_reference: "API 653 Section 4.3 (Shell Course Evaluation)"
    };

    course_assessments.push(course_assessment);

    if (!meets_requirement) {
      any_course_fails = true;
    }

    if (remaining_life !== null) {
      if (overall_remaining_life === null) {
        overall_remaining_life = remaining_life;
      } else {
        overall_remaining_life = Math.min(overall_remaining_life, remaining_life);
      }
    }
  }

  // ── BOTTOM PLATE ASSESSMENT ────────────────────────────────────────────
  var bottom_assessment = null;
  if (input.bottom) {
    bottom_assessment = assess_bottom_plate(input.bottom, tank_diameter, years_in_service);
  }

  // ── SETTLEMENT ASSESSMENT ─────────────────────────────────────────────
  var settlement_assessment = null;
  if (input.settlement && input.settlement.readings) {
    settlement_assessment = assess_settlement(tank_diameter, input.settlement.readings);
  }

  // ── ROOF ASSESSMENT ───────────────────────────────────────────────────
  var roof_assessment = null;
  if (input.roof) {
    roof_assessment = assess_roof(input.roof);
  }

  // ── OVERALL VERDICT ────────────────────────────────────────────────────
  var overall_verdict = "ACCEPTABLE";
  var overall_reason = "Tank meets all API 653 assessment criteria";

  if (any_course_fails) {
    overall_verdict = "REPAIR_REQUIRED";
    overall_reason = "One or more shell courses will be below minimum thickness at next inspection";
  }

  if (bottom_assessment && bottom_assessment.assessment.verdict === "REPAIR_REQUIRED") {
    overall_verdict = "REPAIR_REQUIRED";
    overall_reason = "Bottom plate below minimum thickness";
  }

  if (settlement_assessment && settlement_assessment.settlement_assessment.verdict === "REPAIR_REQUIRED") {
    overall_verdict = "REPAIR_REQUIRED";
    overall_reason = "Tank settlement exceeds API 653 limits";
  }

  // ── POPULATE RESULT ENVELOPE ───────────────────────────────────────────
  result.deterministic = {
    tank_id: input.tank_id || null,
    tank_diameter_ft: tank_diameter,
    tank_height_ft: tank_height,
    specific_gravity: specific_gravity,

    // Shell courses
    course_assessments: course_assessments,

    // Bottom
    bottom_assessment: bottom_assessment,

    // Settlement
    settlement_assessment: settlement_assessment,

    // Roof
    roof_assessment: roof_assessment,

    // Overall metrics
    overall_remaining_life_years: overall_remaining_life,
    overall_verdict: overall_verdict,

    // Regulatory
    code_references: [
      "API 653:2014 (Tank Inspection, Repair, Alteration, Reconstruction)",
      "API 650:2020 (Welded Tanks for Oil Storage)"
    ]
  };

  // ── INTERPRETED NARRATIVE ──────────────────────────────────────────────
  var summary = "Tank assessment per API 653:2014. Overall verdict: " + overall_verdict + ". " + overall_reason + ".";

  var risk_characterization = "";
  var recommendations = "";

  if (overall_verdict === "ACCEPTABLE") {
    risk_characterization = "LOW RISK. Tank is fit-for-service and meets all API 653 criteria. Continue monitoring.";

    if (overall_remaining_life !== null) {
      recommendations = "Schedule next inspection in " + Math.ceil(overall_remaining_life / 2) + " years. Continue operation with routine monitoring.";
    } else {
      recommendations = "Schedule next inspection per plant maintenance program. Continue operation.";
    }
  } else {
    risk_characterization = "HIGH RISK. Tank requires corrective action before continued operation at design conditions.";
    recommendations = "Immediately perform detailed inspection of failed courses/bottom. Evaluate repair scope (slurry coating, weld overlay, tank replacement). Do not exceed design pressure until corrected.";
  }

  result.interpreted = {
    summary: summary,
    risk_characterization: risk_characterization,
    recommendations: recommendations
  };

  return result;
}

// ── SHELL-ONLY ASSESSMENT ─────────────────────────────────────────────────
function assess_shell_only(input) {
  var tank_data = {
    tank_diameter_ft: input.tank_diameter_ft,
    tank_height_ft: input.tank_height_ft,
    specific_gravity: input.specific_gravity || 1.0,
    courses: input.courses,
    years_in_service: input.years_in_service || 0,
    years_to_next_inspection: input.years_to_next_inspection || 5
  };

  return assess_tank(tank_data);
}

// ── BOTTOM-ONLY ASSESSMENT ────────────────────────────────────────────────
function assess_bottom_only(input) {
  var result = {
    engine: "api653-tank-assessment",
    deterministic: assess_bottom_plate(input.bottom, input.tank_diameter_ft, input.years_in_service || 0),
    provenance: {
      engine: "api653-tank-assessment",
      action: "assess_bottom",
      timestamp: new Date().toISOString()
    }
  };
  return result;
}

// ── SETTLEMENT-ONLY ASSESSMENT ────────────────────────────────────────────
function assess_settlement_only(input) {
  var result = {
    engine: "api653-tank-assessment",
    deterministic: assess_settlement(input.tank_diameter_ft, input.settlement.readings),
    provenance: {
      engine: "api653-tank-assessment",
      action: "assess_settlement",
      timestamp: new Date().toISOString()
    }
  };
  return result;
}

// ── TMIN COMPUTATION ONLY ──────────────────────────────────────────────────
function compute_tmin_only(input) {
  var Sd = MATERIAL_ALLOWABLE_STRESS[input.material] || 21000;
  var E = WELD_EFFICIENCY[input.weld_efficiency] || 0.85;

  var course_data = {
    tank_diameter_ft: input.tank_diameter_ft,
    height_ft: input.height_ft,
    specific_gravity: input.specific_gravity || 1.0,
    allowable_stress_design: Sd,
    weld_efficiency: E
  };

  var tmin_result = get_course_tmin(course_data);

  return {
    material: input.material,
    allowable_stress_design_psi: Sd,
    weld_efficiency: E,
    tmin_design_in: tmin_result.tmin_design,
    tmin_hydro_in: tmin_result.tmin_hydro,
    tmin_in: tmin_result.tmin,
    code_reference: tmin_result.source
  };
}

// ── REMAINING LIFE COMPUTATION ────────────────────────────────────────────
function compute_remaining_life_only(input) {
  var Sd = MATERIAL_ALLOWABLE_STRESS[input.material] || 21000;
  var E = WELD_EFFICIENCY[input.weld_efficiency] || 0.85;

  var tmin_d = compute_tmin_design(input.tank_diameter_ft, input.height_ft, input.specific_gravity || 1.0, Sd, E);
  var tmin = tmin_d;

  var corr_data = compute_corrosion_rate(
    input.t_original_in || null,
    input.t_previous_in || null,
    input.t_measured_in,
    input.years_since_previous || input.years_in_service || 0,
    input.years_in_service || 0
  );

  var remaining_life = null;
  if (corr_data.corrosion_rate_used && corr_data.corrosion_rate_used > 0) {
    remaining_life = compute_remaining_life_years(input.t_measured_in, tmin, corr_data.corrosion_rate_used);
  }

  return {
    t_measured_in: input.t_measured_in,
    tmin_in: tmin,
    corrosion_rate_ipy: corr_data.corrosion_rate_used,
    remaining_life_years: remaining_life,
    code_reference: "API 653 Section 4.4"
  };
}

// ── INSPECTION PLANNING ────────────────────────────────────────────────────
function plan_next_inspection(input) {
  var Sd = MATERIAL_ALLOWABLE_STRESS[input.material] || 21000;
  var E = WELD_EFFICIENCY[input.weld_efficiency] || 0.85;

  var tmin_d = compute_tmin_design(input.tank_diameter_ft, input.height_ft, input.specific_gravity || 1.0, Sd, E);

  var corr_data = compute_corrosion_rate(
    input.t_original_in || null,
    input.t_previous_in || null,
    input.t_measured_in,
    input.years_since_previous || 0,
    input.years_in_service || 0
  );

  var remaining_life = null;
  var next_inspection_interval = null;

  if (corr_data.corrosion_rate_used && corr_data.corrosion_rate_used > 0) {
    remaining_life = compute_remaining_life_years(input.t_measured_in, tmin_d, corr_data.corrosion_rate_used);
    next_inspection_interval = compute_next_inspection_interval(remaining_life);
  }

  var today = new Date();
  var next_inspection_date = null;

  if (next_inspection_interval) {
    next_inspection_date = new Date(today.getFullYear() + Math.ceil(next_inspection_interval), today.getMonth(), today.getDate());
  }

  return {
    last_inspection_date: input.last_inspection_date || null,
    next_inspection_date: next_inspection_date ? next_inspection_date.toISOString().split("T")[0] : null,
    interval_years: next_inspection_interval,
    remaining_life_years: remaining_life,
    code_reference: "API 653 Table 2.3 (Inspection Intervals)"
  };
}

// ── MAIN HANDLER ───────────────────────────────────────────────────────────
var handler = async function(event, context) {
  // POST-only handler
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed. Use POST." })
    };
  }

  var payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (parseErr) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON in request body" })
    };
  }

  var action = payload.action || "get_registry";
  var response = {};

  // ── DISPATCH TO ACTION ─────────────────────────────────────────────────
  if (action === "get_registry") {
    response = {
      engine: "api653-tank-assessment",
      version: "1.0.0",
      deploy: "DEPLOY338",
      description: "API 653 Aboveground Storage Tank Integrity Assessment",
      actions: ACTION_REGISTRY,
      codes: ["API 653:2014", "API 650:2020"]
    };
  } else if (action === "assess") {
    response = assess_tank(payload);

    // Non-fatal DB save
    if (supabaseUrl && supabaseKey) {
      var client = createClient(supabaseUrl, supabaseKey);
      try {
        var dbRecord = {
          case_id: payload.case_id || null,
          tank_diameter_ft: payload.tank_diameter_ft,
          tank_height_ft: payload.tank_height_ft,
          specific_gravity: payload.specific_gravity,
          overall_verdict: response.deterministic.overall_verdict,
          overall_remaining_life_years: response.deterministic.overall_remaining_life_years,
          course_count: (payload.courses || []).length,
          assessment_timestamp: new Date().toISOString()
        };
        await client.from("tank_assessments").insert([dbRecord]);
      } catch (dbErr) {
        console.log("DB save failed (non-fatal): " + dbErr.message);
      }
    }
  } else if (action === "assess_shell") {
    response = assess_shell_only(payload);
  } else if (action === "assess_bottom") {
    response = assess_bottom_only(payload);
  } else if (action === "assess_settlement") {
    response = assess_settlement_only(payload);
  } else if (action === "compute_tmin") {
    response = compute_tmin_only(payload);
  } else if (action === "compute_remaining_life") {
    response = compute_remaining_life_only(payload);
  } else if (action === "plan_inspection") {
    response = plan_next_inspection(payload);
  } else if (action === "get_history") {
    // Retrieve past assessments from DB
    if (supabaseUrl && supabaseKey) {
      var client = createClient(supabaseUrl, supabaseKey);
      try {
        var case_id = payload.case_id;
        var query = client.from("tank_assessments").select("*");
        if (case_id) {
          query = query.eq("case_id", case_id);
        }
        var { data, error } = await query.order("assessment_timestamp", { ascending: false }).limit(10);
        if (error) {
          response = { error: error.message };
        } else {
          response = { assessments: data || [] };
        }
      } catch (dbErr) {
        response = { error: dbErr.message };
      }
    } else {
      response = { error: "Database not configured" };
    }
  } else {
    response = { error: "Unknown action: " + action };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(response)
  };
};

export { handler };
