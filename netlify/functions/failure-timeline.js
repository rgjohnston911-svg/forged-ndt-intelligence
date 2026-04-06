// FAILURE TIMELINE ENGINE v1.0
// File: netlify/functions/failure-timeline.js
// NO TYPESCRIPT — PURE JAVASCRIPT
// Purpose: Project time-to-failure for corrosion (wall loss) and cracking (Paris Law)

var handler = async function(event) {
  "use strict";

  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    var body = JSON.parse(event.body || "{}");

    // CORROSION INPUTS
    var nominalWall = parseFloat(body.nominal_wall) || 0;
    var currentWall = parseFloat(body.current_wall) || parseFloat(body.measured_minimum_wall) || 0;
    var retirementWall = parseFloat(body.retirement_wall) || 0;
    var corrosionRateMpy = parseFloat(body.corrosion_rate_mpy) || 0; // mils per year
    var thicknessHistory = body.thickness_history || []; // array of {date, thickness}

    // CRACK INPUTS
    var currentCrackLength = parseFloat(body.crack_length) || 0;
    var currentCrackDepth = parseFloat(body.crack_depth) || 0;
    var criticalCrackSize = parseFloat(body.critical_crack_size) || 0;
    var stressRange = parseFloat(body.stress_range_ksi) || 0; // ksi
    var cyclesPerDay = parseFloat(body.cycles_per_day) || 0;

    // GENERAL INPUTS
    var hasCorrosion = body.has_corrosion || false;
    var hasCracking = body.has_cracking || false;
    var serviceEnvironment = (body.service_environment || "").toLowerCase().trim();
    var materialClass = (body.material_class || "").toLowerCase().trim();

    // ====================================================================
    // CORROSION REMAINING LIFE PROJECTION
    // ====================================================================

    var corrosionTimeline = {
      enabled: false,
      method: "none",
      current_wall: currentWall,
      retirement_wall: retirementWall,
      corrosion_rate_mpy: corrosionRateMpy,
      remaining_wall_inches: 0,
      remaining_wall_mils: 0,
      remaining_life_years: null,
      half_life_years: null,
      next_inspection_max_years: null,
      confidence: "none",
      notes: []
    };

    if (hasCorrosion || currentWall > 0) {
      corrosionTimeline.enabled = true;

      // Auto-derive corrosion rate from thickness history if available
      var derivedRate = 0;
      if (thicknessHistory.length >= 2) {
        // Sort by date
        var sorted = thicknessHistory.slice().sort(function(a, b) {
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        });
        var first = sorted[0];
        var last = sorted[sorted.length - 1];
        var thicknessLoss = parseFloat(first.thickness) - parseFloat(last.thickness);
        var yearsSpan = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (365.25 * 24 * 3600 * 1000);
        if (yearsSpan > 0 && thicknessLoss >= 0) {
          derivedRate = (thicknessLoss * 1000) / yearsSpan; // mpy
          corrosionTimeline.method = "DERIVED_FROM_HISTORY";
          corrosionTimeline.notes.push("Corrosion rate derived from " + sorted.length + " thickness readings spanning " + yearsSpan.toFixed(1) + " years");
          if (corrosionRateMpy === 0) corrosionRateMpy = derivedRate;
          corrosionTimeline.corrosion_rate_mpy = corrosionRateMpy;
        }
      }

      if (corrosionRateMpy > 0 && currentWall > 0) {
        if (corrosionTimeline.method === "none") {
          corrosionTimeline.method = "PROVIDED_RATE";
        }

        // Use retirement wall if provided, otherwise default to 50% of nominal or code minimum estimate
        var retireWall = retirementWall;
        if (retireWall === 0 && nominalWall > 0) {
          retireWall = nominalWall * 0.50; // Conservative default
          corrosionTimeline.notes.push("Retirement wall not provided - using 50% of nominal as conservative default");
        }
        if (retireWall === 0) {
          retireWall = currentWall * 0.50;
          corrosionTimeline.notes.push("Retirement wall and nominal not provided - using 50% of current as fallback");
        }
        corrosionTimeline.retirement_wall = retireWall;

        var remainingWall = currentWall - retireWall;
        corrosionTimeline.remaining_wall_inches = parseFloat(remainingWall.toFixed(4));
        corrosionTimeline.remaining_wall_mils = parseFloat((remainingWall * 1000).toFixed(1));

        if (remainingWall > 0) {
          var remainingLife = (remainingWall * 1000) / corrosionRateMpy;
          corrosionTimeline.remaining_life_years = parseFloat(remainingLife.toFixed(2));
          corrosionTimeline.half_life_years = parseFloat((remainingLife / 2).toFixed(2));
          corrosionTimeline.next_inspection_max_years = parseFloat(Math.min(remainingLife / 2, 10).toFixed(2));
          corrosionTimeline.confidence = derivedRate > 0 ? "HIGH" : "MODERATE";
        } else {
          corrosionTimeline.remaining_life_years = 0;
          corrosionTimeline.half_life_years = 0;
          corrosionTimeline.next_inspection_max_years = 0;
          corrosionTimeline.notes.push("CRITICAL: Current wall is at or below retirement threshold");
          corrosionTimeline.confidence = "HIGH";
        }

        // Sour service modifier
        if (serviceEnvironment.indexOf("sour") >= 0 || serviceEnvironment.indexOf("h2s") >= 0) {
          corrosionTimeline.notes.push("Sour service: corrosion rates can be variable - consider 50% safety factor on remaining life");
        }
      } else {
        corrosionTimeline.notes.push("Insufficient data for corrosion timeline - need current wall + corrosion rate or thickness history");
      }
    }

    // ====================================================================
    // CRACK GROWTH PROJECTION (Paris Law)
    // ====================================================================
    // Paris Law: da/dN = C * (delta_K)^m
    // For ferritic steels in air: C ≈ 6.9e-12, m ≈ 3 (BS 7910)
    // For ferritic steels in marine/sour: C ≈ 1.65e-11, m ≈ 3 (BS 7910)

    var crackTimeline = {
      enabled: false,
      method: "none",
      current_crack_length: currentCrackLength,
      current_crack_depth: currentCrackDepth,
      critical_crack_size: criticalCrackSize,
      cycles_to_failure: null,
      time_to_failure_years: null,
      paris_C: 0,
      paris_m: 3,
      delta_K_ksi_sqrt_in: 0,
      growth_per_cycle_inches: 0,
      next_inspection_max_years: null,
      confidence: "none",
      notes: []
    };

    if (hasCracking || currentCrackLength > 0 || currentCrackDepth > 0) {
      crackTimeline.enabled = true;
      crackTimeline.method = "PARIS_LAW";

      // Select Paris Law constants based on environment
      var paris_C = 6.9e-12; // ferritic steel in air
      var paris_m = 3.0;
      var environmentLabel = "air";

      if (serviceEnvironment.indexOf("sour") >= 0 || serviceEnvironment.indexOf("h2s") >= 0) {
        paris_C = 1.65e-11; // sour environment - faster growth
        environmentLabel = "sour/H2S";
      } else if (serviceEnvironment.indexOf("marine") >= 0 || serviceEnvironment.indexOf("seawater") >= 0) {
        paris_C = 1.65e-11; // marine environment
        environmentLabel = "marine";
      }

      // Stainless / nickel alloys have different constants
      if (materialClass.indexOf("stainless") >= 0 || materialClass.indexOf("austenitic") >= 0) {
        paris_C = 5.6e-12;
        paris_m = 3.25;
      }

      crackTimeline.paris_C = paris_C;
      crackTimeline.paris_m = paris_m;
      crackTimeline.notes.push("Paris Law constants for " + environmentLabel + " environment: C=" + paris_C.toExponential(2) + ", m=" + paris_m.toFixed(2));

      // Calculate stress intensity factor range (delta K)
      // Simplified: delta_K = stress_range * sqrt(pi * a) * Y
      // where Y is geometry factor (~1.12 for surface flaw)
      if (currentCrackDepth > 0 && stressRange > 0) {
        var geometryFactor = 1.12;
        var crackDepthInches = currentCrackDepth;
        var deltaK = stressRange * Math.sqrt(Math.PI * crackDepthInches) * geometryFactor;
        crackTimeline.delta_K_ksi_sqrt_in = parseFloat(deltaK.toFixed(3));

        // Growth per cycle
        var growthPerCycle = paris_C * Math.pow(deltaK, paris_m);
        crackTimeline.growth_per_cycle_inches = parseFloat(growthPerCycle.toExponential(3));

        // Cycles to failure (simplified linear integration)
        if (criticalCrackSize > 0 && criticalCrackSize > crackDepthInches) {
          var crackGrowthRequired = criticalCrackSize - crackDepthInches;
          var cyclesToFailure = Math.round(crackGrowthRequired / growthPerCycle);
          crackTimeline.cycles_to_failure = cyclesToFailure;
          crackTimeline.notes.push("Linear integration estimate - actual integration over crack growth is more accurate");

          if (cyclesPerDay > 0) {
            var daysToFailure = cyclesToFailure / cyclesPerDay;
            var yearsToFailure = daysToFailure / 365.25;
            crackTimeline.time_to_failure_years = parseFloat(yearsToFailure.toFixed(2));
            crackTimeline.next_inspection_max_years = parseFloat(Math.min(yearsToFailure / 2, 5).toFixed(2));
            crackTimeline.confidence = "MODERATE";
          } else {
            crackTimeline.notes.push("Cycles per day not provided - cannot convert cycles to time. Use cycle-based monitoring.");
            crackTimeline.confidence = "LOW_TIME";
          }
        } else if (criticalCrackSize === 0) {
          crackTimeline.notes.push("Critical crack size not provided - cannot calculate cycles to failure");
          crackTimeline.confidence = "LOW";
        } else {
          crackTimeline.notes.push("Current crack already exceeds critical size - immediate action required");
          crackTimeline.cycles_to_failure = 0;
          crackTimeline.time_to_failure_years = 0;
          crackTimeline.confidence = "HIGH";
        }
      } else if (currentCrackLength > 0 && currentCrackDepth === 0) {
        crackTimeline.notes.push("Crack length provided but depth missing - depth required for Paris Law calculation");
        crackTimeline.confidence = "INSUFFICIENT_DATA";
      } else {
        crackTimeline.notes.push("Crack dimensions or stress range missing - Paris Law projection not possible");
        crackTimeline.confidence = "INSUFFICIENT_DATA";
      }

      crackTimeline.notes.push("Linear elastic fracture mechanics assumption - valid for small-scale yielding only");
      crackTimeline.notes.push("Sour service note: hydrogen-assisted cracking can produce sudden failure independent of fatigue cycles");
    }

    // ====================================================================
    // GOVERNING TIMELINE
    // ====================================================================

    var governingMode = "none";
    var governingTimeYears = null;
    var governingBasis = "";

    var corLife = corrosionTimeline.remaining_life_years;
    var craLife = crackTimeline.time_to_failure_years;

    if (corLife !== null && craLife !== null) {
      if (craLife < corLife) {
        governingMode = "CRACKING";
        governingTimeYears = craLife;
        governingBasis = "Cracking time-to-failure (" + craLife + " yr) governs over corrosion (" + corLife + " yr)";
      } else {
        governingMode = "CORROSION";
        governingTimeYears = corLife;
        governingBasis = "Corrosion remaining life (" + corLife + " yr) governs over cracking (" + craLife + " yr)";
      }
    } else if (corLife !== null) {
      governingMode = "CORROSION";
      governingTimeYears = corLife;
      governingBasis = "Corrosion remaining life is the only quantified timeline";
    } else if (craLife !== null) {
      governingMode = "CRACKING";
      governingTimeYears = craLife;
      governingBasis = "Cracking time-to-failure is the only quantified timeline";
    } else {
      governingBasis = "Insufficient data to project failure timeline for any mechanism";
    }

    // Recommended re-inspection interval (half of governing remaining life, capped at 5 years)
    var recommendedInterval = null;
    if (governingTimeYears !== null) {
      recommendedInterval = parseFloat(Math.min(governingTimeYears / 2, 5).toFixed(2));
    }

    // Urgency classification
    var urgency = "STANDARD";
    if (governingTimeYears !== null) {
      if (governingTimeYears <= 0) urgency = "EMERGENCY";
      else if (governingTimeYears < 1) urgency = "CRITICAL";
      else if (governingTimeYears < 3) urgency = "PRIORITY";
      else if (governingTimeYears < 10) urgency = "ELEVATED";
    }

    // ====================================================================
    // RESPONSE
    // ====================================================================

    var result = {
      governing_failure_mode: governingMode,
      governing_time_years: governingTimeYears,
      governing_basis: governingBasis,
      recommended_inspection_interval_years: recommendedInterval,
      urgency: urgency,
      corrosion_timeline: corrosionTimeline,
      crack_timeline: crackTimeline,
      metadata: {
        engine: "failure-timeline",
        version: "1.0",
        method: "Linear corrosion projection + Paris Law crack growth",
        timestamp: new Date().toISOString()
      }
    };

    return { statusCode: 200, headers: headers, body: JSON.stringify(result) };

  } catch (err) {
    return { statusCode: 500, headers: headers, body: JSON.stringify({ error: "Failure timeline error: " + (err.message || String(err)) }) };
  }
};

module.exports = { handler: handler };
