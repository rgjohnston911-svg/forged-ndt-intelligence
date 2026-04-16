// @ts-nocheck
/**
 * DEPLOY221 - outcome-simulation.ts
 * netlify/functions/outcome-simulation.ts
 *
 * PREDICTIVE TWINS ENGINE
 *
 * Pure physics-based projection engine. No AI, no LLM calls.
 * Given the current damage state, projects forward in time under
 * three scenarios:
 *
 *   1. DO NOTHING   — current degradation continues unchecked
 *   2. MONITOR      — inspection interval tightened, threshold triggers
 *   3. REPAIR NOW   — restore to near-original, restart degradation clock
 *
 * Physics models:
 *   - Linear corrosion projection (wall loss over time)
 *   - Crack growth projection (simplified Paris law)
 *   - Pitting depth projection (power law)
 *   - Coating remaining life (linear degradation)
 *
 * Each projection shows:
 *   - Time to failure threshold (code minimum)
 *   - Time to next required inspection
 *   - Projected condition at 6, 12, 24, 60 months
 *   - Risk level at each time step
 *
 * POST { case_id: string, corrosion_rate_mpy?: number }
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var EXECUTION_MODE = "deterministic";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

function num(v) {
  if (v === null || v === undefined || v === "") return null;
  var n = Number(v);
  if (isNaN(n)) return null;
  return n;
}

// ================================================================
// CORROSION RATE ESTIMATION
// ================================================================
function estimateCorrosionRate(thickness, caseRow) {
  // If user provides a rate, use it
  // If we have thickness + nominal, estimate from wall loss assuming age
  // Default conservative rate if nothing else available

  // Try to get nominal and min from thickness readings
  var nominal = null;
  var minThk = null;
  var vals = [];

  if (thickness && thickness.length > 0) {
    for (var i = 0; i < thickness.length; i++) {
      var tv = num(thickness[i].thickness_in);
      if (tv !== null && tv > 0) vals.push(tv);
      if (!nominal) {
        var nv = num(thickness[i].nominal_in);
        if (nv !== null && nv > 0) nominal = nv;
      }
    }
    if (vals.length > 0) minThk = Math.min.apply(null, vals);
  }

  // If we have nominal and min, estimate rate from assumed service life
  var wallLoss = (nominal && minThk) ? (nominal - minThk) : null;

  // Check case row for any age/date info
  var serviceYears = null;
  if (caseRow.installation_date) {
    var installed = new Date(caseRow.installation_date);
    if (!isNaN(installed.getTime())) {
      serviceYears = (Date.now() - installed.getTime()) / (365.25 * 24 * 3600 * 1000);
    }
  }
  // Default assumption: 10 years service if unknown
  if (!serviceYears || serviceYears <= 0) serviceYears = 10;

  var estimatedRate = null;
  if (wallLoss && wallLoss > 0) {
    // mpy = mils per year = (wall loss in inches * 1000) / years
    estimatedRate = (wallLoss * 1000) / serviceYears;
  }

  return {
    nominal_in: nominal,
    min_thickness_in: minThk,
    wall_loss_in: wallLoss,
    assumed_service_years: Math.round(serviceYears * 10) / 10,
    estimated_rate_mpy: estimatedRate ? Math.round(estimatedRate * 10) / 10 : null,
    reading_count: vals.length
  };
}

// ================================================================
// T-MIN CALCULATION (simplified API 510/570)
// ================================================================
function calculateTmin(nominal) {
  // Conservative: t_min = 50% of nominal for general corrosion
  // In real implementation this would use PD/2SE + CA from design data
  if (!nominal) return null;
  return nominal * 0.50;
}

// ================================================================
// PROJECTION ENGINE
// ================================================================
function projectTimeline(currentThk, nominal, rateMpy, tMin) {
  // rateMpy is in mils/year, convert to inches/year
  var rateInPerYear = rateMpy / 1000;

  // Time steps in months
  var timeSteps = [6, 12, 24, 36, 48, 60, 84, 120];
  var projections = [];

  for (var i = 0; i < timeSteps.length; i++) {
    var months = timeSteps[i];
    var years = months / 12;
    var projectedThk = currentThk - (rateInPerYear * years);
    var pctOfNominal = nominal ? projectedThk / nominal : null;
    var aboveTmin = tMin ? projectedThk > tMin : null;

    var risk = "low";
    if (pctOfNominal !== null) {
      if (pctOfNominal < 0.50) risk = "critical";
      else if (pctOfNominal < 0.65) risk = "high";
      else if (pctOfNominal < 0.80) risk = "medium";
    }

    projections.push({
      months: months,
      years: Math.round(years * 10) / 10,
      projected_thickness_in: Math.round(projectedThk * 10000) / 10000,
      pct_of_nominal: pctOfNominal ? Math.round(pctOfNominal * 1000) / 1000 : null,
      above_tmin: aboveTmin,
      risk: risk,
      breached_tmin: (aboveTmin === false)
    });
  }

  // Time to t_min breach
  var timeToBreachYears = null;
  var timeToBreachMonths = null;
  if (tMin && currentThk > tMin && rateInPerYear > 0) {
    timeToBreachYears = (currentThk - tMin) / rateInPerYear;
    timeToBreachMonths = Math.round(timeToBreachYears * 12);
    timeToBreachYears = Math.round(timeToBreachYears * 10) / 10;
  }

  // Time to FFS review threshold (80% of nominal)
  var timeToFfsYears = null;
  if (nominal && currentThk > nominal * 0.80 && rateInPerYear > 0) {
    timeToFfsYears = (currentThk - nominal * 0.80) / rateInPerYear;
    timeToFfsYears = Math.round(timeToFfsYears * 10) / 10;
  }

  return {
    projections: projections,
    time_to_tmin_breach_months: timeToBreachMonths,
    time_to_tmin_breach_years: timeToBreachYears,
    time_to_ffs_review_years: timeToFfsYears,
    failure_date: timeToBreachMonths ? new Date(Date.now() + timeToBreachMonths * 30.44 * 24 * 3600 * 1000).toISOString() : null
  };
}

// ================================================================
// THREE SCENARIOS
// ================================================================
function buildScenarios(currentThk, nominal, rateMpy, tMin, findings) {
  var scenarios = [];

  // SCENARIO 1: DO NOTHING
  var doNothing = projectTimeline(currentThk, nominal, rateMpy, tMin);
  scenarios.push({
    scenario: "do_nothing",
    label: "Do Nothing",
    description: "Current degradation continues at " + rateMpy + " mpy with no intervention.",
    corrosion_rate_mpy: rateMpy,
    timeline: doNothing.projections,
    time_to_failure_months: doNothing.time_to_tmin_breach_months,
    time_to_failure_years: doNothing.time_to_tmin_breach_years,
    time_to_ffs_review_years: doNothing.time_to_ffs_review_years,
    predicted_failure_date: doNothing.failure_date,
    recommendation: doNothing.time_to_tmin_breach_months && doNothing.time_to_tmin_breach_months < 12
      ? "CRITICAL: Projected failure within 12 months. Immediate repair or replacement required."
      : (doNothing.time_to_tmin_breach_months && doNothing.time_to_tmin_breach_months < 36
        ? "WARNING: Projected failure within 3 years. Schedule repair during next shutdown."
        : (doNothing.time_to_tmin_breach_months
          ? "Monitor condition. Next inspection recommended before " + Math.round(doNothing.time_to_tmin_breach_months * 0.5) + " months."
          : "Insufficient data for failure projection."))
  });

  // SCENARIO 2: MONITOR (tighten inspection interval, catch acceleration)
  // Assumes early detection reduces effective rate by 20% (catch & address sooner)
  var monitorRate = rateMpy * 0.80;
  var monitor = projectTimeline(currentThk, nominal, monitorRate, tMin);
  var inspectionInterval = 6; // months
  if (doNothing.time_to_tmin_breach_months) {
    // Half of remaining life, capped at 12 months
    inspectionInterval = Math.min(12, Math.max(3, Math.round(doNothing.time_to_tmin_breach_months / 4)));
  }
  scenarios.push({
    scenario: "monitor",
    label: "Monitor (Enhanced Surveillance)",
    description: "Tighten inspection interval to every " + inspectionInterval +
      " months. Effective rate reduced 20% through early intervention.",
    corrosion_rate_mpy: Math.round(monitorRate * 10) / 10,
    inspection_interval_months: inspectionInterval,
    timeline: monitor.projections,
    time_to_failure_months: monitor.time_to_tmin_breach_months,
    time_to_failure_years: monitor.time_to_tmin_breach_years,
    predicted_failure_date: monitor.failure_date,
    life_extension_months: (doNothing.time_to_tmin_breach_months && monitor.time_to_tmin_breach_months)
      ? monitor.time_to_tmin_breach_months - doNothing.time_to_tmin_breach_months
      : null,
    recommendation: "Establish CML (Condition Monitoring Location) grid. Re-measure at " +
      inspectionInterval + "-month intervals. Trigger repair if rate accelerates above " +
      Math.round(rateMpy * 1.5) + " mpy."
  });

  // SCENARIO 3: REPAIR NOW (restore to ~90% nominal, restart clock)
  var repairedThk = nominal ? nominal * 0.90 : currentThk * 1.5;
  var repairRate = rateMpy * 0.70; // post-repair coating/wrap slows degradation
  var repair = projectTimeline(repairedThk, nominal, repairRate, tMin);

  // Estimate repair method from findings
  var repairMethod = "weld overlay or sleeve repair";
  var hasComposite = false;
  var hasCoating = false;
  if (findings && findings.length > 0) {
    for (var fi = 0; fi < findings.length; fi++) {
      var fType = (findings[fi].indication_type || findings[fi].notes || "").toLowerCase();
      if (fType.indexOf("coating") >= 0 || fType.indexOf("paint") >= 0) hasCoating = true;
      if (fType.indexOf("composite") >= 0 || fType.indexOf("wrap") >= 0) hasComposite = true;
    }
  }
  if (hasComposite) repairMethod = "composite wrap repair (ASME PCC-2 Art. 4.1)";
  else if (hasCoating) repairMethod = "coating restoration + corrosion inhibitor";

  scenarios.push({
    scenario: "repair_now",
    label: "Repair Now",
    description: "Restore wall to ~90% nominal via " + repairMethod +
      ". Post-repair rate reduced 30% with protective measures.",
    repair_method: repairMethod,
    restored_thickness_in: Math.round(repairedThk * 10000) / 10000,
    corrosion_rate_mpy: Math.round(repairRate * 10) / 10,
    timeline: repair.projections,
    time_to_failure_months: repair.time_to_tmin_breach_months,
    time_to_failure_years: repair.time_to_tmin_breach_years,
    predicted_failure_date: repair.failure_date,
    life_extension_months: (doNothing.time_to_tmin_breach_months && repair.time_to_tmin_breach_months)
      ? repair.time_to_tmin_breach_months - doNothing.time_to_tmin_breach_months
      : null,
    recommendation: "Execute " + repairMethod + ". Post-repair inspection at 12 months to validate " +
      "repair effectiveness and establish new corrosion baseline."
  });

  return scenarios;
}

// ================================================================
// CRACK GROWTH PROJECTION (simplified)
// ================================================================
function projectCrackGrowth(measurements, findings) {
  // Look for crack measurements
  var crackLength = null;
  var crackDepth = null;

  if (measurements && measurements.length > 0) {
    for (var i = 0; i < measurements.length; i++) {
      var m = measurements[i];
      var mType = (m.measurement_type || "").toLowerCase();
      if (mType.indexOf("crack") >= 0 && mType.indexOf("length") >= 0) {
        crackLength = num(m.value);
      }
      if (mType.indexOf("crack") >= 0 && mType.indexOf("depth") >= 0) {
        crackDepth = num(m.value);
      }
    }
  }

  if (!crackLength && !crackDepth) return null;

  // Simplified crack growth: assume 10% per year without intervention
  // Real implementation would use Paris law with stress intensity factor
  var growthRate = 0.10; // 10% per year
  var timeSteps = [6, 12, 24, 36, 48, 60];
  var projections = [];

  for (var t = 0; t < timeSteps.length; t++) {
    var months = timeSteps[t];
    var years = months / 12;
    var factor = Math.pow(1 + growthRate, years);
    projections.push({
      months: months,
      projected_length_in: crackLength ? Math.round(crackLength * factor * 10000) / 10000 : null,
      projected_depth_in: crackDepth ? Math.round(crackDepth * factor * 10000) / 10000 : null,
      growth_factor: Math.round(factor * 100) / 100,
      risk: factor > 2.0 ? "critical" : (factor > 1.5 ? "high" : (factor > 1.2 ? "medium" : "low"))
    });
  }

  return {
    type: "crack_growth",
    model: "exponential_10pct_annual",
    note: "Simplified projection. Actual growth depends on stress intensity, material toughness, and environment. Commission fracture mechanics analysis (API 579 Part 9) for definitive assessment.",
    initial_length_in: crackLength,
    initial_depth_in: crackDepth,
    annual_growth_rate: growthRate,
    projections: projections
  };
}

// ================================================================
// PITTING PROJECTION
// ================================================================
function projectPitting(measurements) {
  var pittingDepth = null;
  var pittingDiameter = null;

  if (measurements && measurements.length > 0) {
    for (var i = 0; i < measurements.length; i++) {
      var m = measurements[i];
      var mType = (m.measurement_type || "").toLowerCase();
      if (mType.indexOf("pitting") >= 0 && mType.indexOf("depth") >= 0) {
        pittingDepth = num(m.value);
      }
      if (mType.indexOf("pitting") >= 0 && mType.indexOf("diameter") >= 0) {
        pittingDiameter = num(m.value);
      }
    }
  }

  if (!pittingDepth) return null;

  // Pitting follows power law: d = k * t^n (n typically 0.3-0.5)
  var n = 0.40;
  var timeSteps = [6, 12, 24, 36, 48, 60];
  var projections = [];

  for (var t = 0; t < timeSteps.length; t++) {
    var months = timeSteps[t];
    var years = months / 12;
    // project from current: depth_future = depth_current * ((age + years) / age)^n
    // Assume current age = 10 years if unknown
    var currentAge = 10;
    var factor = Math.pow((currentAge + years) / currentAge, n);
    projections.push({
      months: months,
      projected_depth_in: Math.round(pittingDepth * factor * 10000) / 10000,
      projected_diameter_in: pittingDiameter ? Math.round(pittingDiameter * factor * 10000) / 10000 : null,
      growth_factor: Math.round(factor * 100) / 100,
      risk: factor > 1.8 ? "critical" : (factor > 1.4 ? "high" : (factor > 1.15 ? "medium" : "low"))
    });
  }

  return {
    type: "pitting_growth",
    model: "power_law_n" + n,
    note: "Pitting follows power law growth. Rate depends on environment chemistry and material susceptibility.",
    initial_depth_in: pittingDepth,
    initial_diameter_in: pittingDiameter,
    exponent: n,
    projections: projections
  };
}

// ================================================================
// HANDLER
// ================================================================
export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var caseId = body.case_id;
    var userRate = body.corrosion_rate_mpy ? num(body.corrosion_rate_mpy) : null;
    if (!caseId) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };

    var sb = createClient(supabaseUrl, supabaseKey);

    var caseRes = await sb.from("inspection_cases").select("*").eq("id", caseId).single();
    if (caseRes.error || !caseRes.data) {
      return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "case not found" }) };
    }
    var caseRow = caseRes.data;

    var thkRes = await sb.from("thickness_readings").select("*").eq("case_id", caseId);
    var findingsRes = await sb.from("findings").select("*").eq("case_id", caseId);
    var measRes = await sb.from("case_measurements").select("*").eq("case_id", caseId);

    var thickness = thkRes.data || [];
    var findings = findingsRes.data || [];
    var measurements = measRes.data || [];

    // Estimate corrosion parameters
    var corrosionData = estimateCorrosionRate(thickness, caseRow);

    // Use user-provided rate if given, otherwise use estimated
    var rateMpy = userRate || corrosionData.estimated_rate_mpy;

    // If still no rate, use conservative default based on environment
    if (!rateMpy) {
      // Default rates by common environments (mpy)
      var inspCtx = (caseRow.inspection_context || "").toLowerCase();
      if (inspCtx.indexOf("marine") >= 0 || inspCtx.indexOf("offshore") >= 0 || inspCtx.indexOf("saltwater") >= 0) {
        rateMpy = 15; // aggressive marine
      } else if (inspCtx.indexOf("chemical") >= 0 || inspCtx.indexOf("acid") >= 0 || inspCtx.indexOf("sour") >= 0) {
        rateMpy = 20; // chemical/sour service
      } else if (inspCtx.indexOf("atmospheric") >= 0 || inspCtx.indexOf("outdoor") >= 0) {
        rateMpy = 5; // atmospheric
      } else {
        rateMpy = 10; // general industrial default
      }
      corrosionData.rate_source = "default_estimate";
    } else if (userRate) {
      corrosionData.rate_source = "user_provided";
    } else {
      corrosionData.rate_source = "calculated_from_wall_loss";
    }
    corrosionData.active_rate_mpy = rateMpy;

    var nominal = corrosionData.nominal_in;
    var currentThk = corrosionData.min_thickness_in;
    var tMin = calculateTmin(nominal);

    // Build response
    var simulation = {
      engine: "outcome-simulation/1.0.0",
      execution_mode: EXECUTION_MODE,
      generated_at: new Date().toISOString(),
      case_id: caseId,
      case_number: caseRow.case_number,
      corrosion_data: corrosionData,
      t_min_in: tMin,
      scenarios: [],
      crack_projection: null,
      pitting_projection: null,
      summary: ""
    };

    // Wall thickness scenarios (if we have thickness data)
    if (currentThk && nominal && rateMpy) {
      simulation.scenarios = buildScenarios(currentThk, nominal, rateMpy, tMin, findings);
    }

    // Crack growth projection
    simulation.crack_projection = projectCrackGrowth(measurements, findings);

    // Pitting projection
    simulation.pitting_projection = projectPitting(measurements);

    // Summary
    var summaryParts = [];
    if (simulation.scenarios.length > 0) {
      var doNothing = simulation.scenarios[0];
      if (doNothing.time_to_failure_months) {
        summaryParts.push("Wall thickness: projected failure in " + doNothing.time_to_failure_months +
          " months (" + doNothing.time_to_failure_years + " years) under do-nothing scenario at " +
          rateMpy + " mpy.");
        if (simulation.scenarios[2] && simulation.scenarios[2].time_to_failure_months) {
          summaryParts.push("Repair extends life to " + simulation.scenarios[2].time_to_failure_months +
            " months (+" + (simulation.scenarios[2].life_extension_months || 0) + " months gained).");
        }
      } else {
        summaryParts.push("Insufficient thickness data for failure projection.");
      }
    }
    if (simulation.crack_projection) {
      summaryParts.push("Active crack: " +
        (simulation.crack_projection.initial_length_in ? simulation.crack_projection.initial_length_in + " in length" : "") +
        (simulation.crack_projection.initial_depth_in ? ", " + simulation.crack_projection.initial_depth_in + " in depth" : "") +
        ". Projected 10% annual growth without intervention.");
    }
    if (simulation.pitting_projection) {
      summaryParts.push("Active pitting: " + simulation.pitting_projection.initial_depth_in +
        " in depth. Power-law projection indicates continued growth.");
    }
    if (summaryParts.length === 0) {
      summaryParts.push("No measurable damage data available for projection. Collect thickness readings, crack measurements, or pitting data to enable predictive simulation.");
    }
    simulation.summary = summaryParts.join(" ");

    // Persist
    var remainingLife = null;
    var failureDate = null;
    if (simulation.scenarios.length > 0 && simulation.scenarios[0].time_to_failure_months) {
      remainingLife = simulation.scenarios[0].time_to_failure_months;
      failureDate = simulation.scenarios[0].predicted_failure_date;
    }

    var upd = await sb.from("inspection_cases").update({
      outcome_simulation: simulation,
      outcome_simulation_generated_at: simulation.generated_at,
      remaining_life_months: remainingLife,
      predicted_failure_date: failureDate
    }).eq("id", caseId);

    if (upd.error) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "persist failed", detail: upd.error.message }) };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        execution_mode: EXECUTION_MODE,
        simulation: simulation
      })
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
