// FAILURE TIMELINE ENGINE v1.2
// File: netlify/functions/failure-timeline.js
// NO TYPESCRIPT -- PURE JAVASCRIPT
// v1.2 (DEPLOY184): Wire consequence_undetermined into timeline response.
//   - Extracts consequence_undetermined + undetermined_impacts from decision_core
//   - Surfaces consequence_context in response with warning when undetermined
//   - metadata.consequence_undetermined flag for downstream consumers
// Previous: v1.1 (DEPLOY165)
//
// v1.1 (DEPLOY165) additions:
//   1. New input: service_age_years
//   2. New corrosion rate derivation: DERIVED_FROM_WALL_LOSS_AND_AGE
//      formula: (nominal_wall - current_wall) / service_age_years * 1000
//      Fires when explicit rate absent AND thickness history absent AND
//      wall loss signal + service age both present. This closes the
//      "Insufficient data to project failure timeline" dead-end on any
//      scenario where the transcript mentions service age and a wall
//      loss percentage or measurement.
//   3. New input: wall_loss_percent -- derives current_wall from nominal
//      when explicit measured wall absent (matches frontend extraction).
//   4. New input: fmd_severity -- used ONLY to upgrade progression_state.
//      Never used to override timeline calculations.
//   5. New top-level field: progression_state (6-state taxonomy)
//        insufficient_data | dormant_possible | stable_known |
//        active_possible | active_likely | accelerating | unstable_critical
//   6. New top-level field: progression_state_basis (classification reasoning)
//
// Universality: no asset-type branches, reads universal physical fields
// only, degrades to insufficient_data when signals absent.
//
// Carries forward all v1.0 behavior unchanged for backward compat.

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

    // ========================================================================
    // DEPLOY171.7: DOMAIN REFUSAL SHORT-CIRCUIT
    // ========================================================================
    var domainRefused = false;
    if (body.domain_not_supported === true) { domainRefused = true; }
    if (body.decision_core && body.decision_core.domain_not_supported === true) { domainRefused = true; }
    if (domainRefused) {
      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({
          domain_not_supported: true,
          refusal_reason: "Upstream decision-core refused this asset domain. Failure timeline not computed.",
          corrosion_timeline: null,
          crack_timeline: null,
          creep_timeline: null,
          combined_remaining_life_years: null,
          governing_timeline: "DOMAIN_NOT_SUPPORTED",
          urgency_band: null,
          engine_version: "failure-timeline-v1.1-deploy171.7"
        })
      };
    }

    // ====================================================================
    // DEPLOY184: CONSEQUENCE UNDETERMINED CONTEXT
    // ====================================================================
    // Extract consequence_undetermined from decision_core so the timeline
    // response can surface that urgency band may need upward revision once
    // consequence dimensions are fully characterized.
    var dc = body.decision_core || {};
    var cr = dc.consequence_reality || {};
    var consequenceUndetermined = cr.consequence_undetermined === true;
    var undeterminedImpacts = cr.undetermined_impacts || [];
    var consequenceTier = cr.consequence_tier || null;

    // ====================================================================
    // CORROSION INPUTS
    // ====================================================================
    var nominalWall = parseFloat(body.nominal_wall) || 0;
    var currentWall = parseFloat(body.current_wall) || parseFloat(body.measured_minimum_wall) || 0;
    var retirementWall = parseFloat(body.retirement_wall) || 0;
    var corrosionRateMpy = parseFloat(body.corrosion_rate_mpy) || 0;
    var thicknessHistory = body.thickness_history || [];

    // v1.1 NEW INPUTS
    var serviceAgeYears = parseFloat(body.service_age_years) || 0;
    var wallLossPercent = parseFloat(body.wall_loss_percent) || 0;

    // v1.1: derive current_wall from nominal_wall * (1 - wall_loss_percent/100)
    // when measurement absent but percentage present. Matches frontend logic
    // and ensures backend can stand alone even if frontend extraction misses.
    if (currentWall === 0 && nominalWall > 0 && wallLossPercent > 0) {
      currentWall = nominalWall * (1 - wallLossPercent / 100);
    }

    // ====================================================================
    // CRACK INPUTS
    // ====================================================================
    var currentCrackLength = parseFloat(body.crack_length) || 0;
    var currentCrackDepth = parseFloat(body.crack_depth) || 0;
    var criticalCrackSize = parseFloat(body.critical_crack_size) || 0;
    var stressRange = parseFloat(body.stress_range_ksi) || 0;
    var cyclesPerDay = parseFloat(body.cycles_per_day) || 0;

    // ====================================================================
    // GENERAL INPUTS
    // ====================================================================
    var hasCorrosion = body.has_corrosion || false;
    var hasCracking = body.has_cracking || false;
    var serviceEnvironment = (body.service_environment || "").toLowerCase().trim();
    var materialClass = (body.material_class || "").toLowerCase().trim();

    // v1.1 NEW INPUT: FMD severity for progression_state upgrade only
    var fmdSeverity = (body.fmd_severity || "").toUpperCase().trim();

    // ====================================================================
    // CORROSION REMAINING LIFE PROJECTION
    // ====================================================================

    var corrosionTimeline = {
      enabled: false,
      method: "none",
      current_wall: currentWall,
      nominal_wall: nominalWall,
      retirement_wall: retirementWall,
      corrosion_rate_mpy: corrosionRateMpy,
      service_age_years: serviceAgeYears,
      remaining_wall_inches: 0,
      remaining_wall_mils: 0,
      remaining_life_years: null,
      half_life_years: null,
      next_inspection_max_years: null,
      confidence: "none",
      notes: []
    };

    if (hasCorrosion || currentWall > 0 || wallLossPercent > 0) {
      corrosionTimeline.enabled = true;

      // --- Method 1: derive from thickness history (v1.0) ---
      var derivedFromHistory = false;
      if (thicknessHistory.length >= 2) {
        var sorted = thicknessHistory.slice().sort(function(a, b) {
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        });
        var first = sorted[0];
        var last = sorted[sorted.length - 1];
        var thicknessLoss = parseFloat(first.thickness) - parseFloat(last.thickness);
        var yearsSpan = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (365.25 * 24 * 3600 * 1000);
        if (yearsSpan > 0 && thicknessLoss >= 0) {
          var derivedRate = (thicknessLoss * 1000) / yearsSpan;
          corrosionTimeline.method = "DERIVED_FROM_HISTORY";
          corrosionTimeline.notes.push("Corrosion rate derived from " + sorted.length + " thickness readings spanning " + yearsSpan.toFixed(1) + " years");
          if (corrosionRateMpy === 0) corrosionRateMpy = derivedRate;
          corrosionTimeline.corrosion_rate_mpy = corrosionRateMpy;
          derivedFromHistory = true;
        }
      }

      // --- Method 2: v1.1 NEW -- derive from wall loss and service age ---
      // Universal fallback when no explicit rate and no history, but we have
      // enough to back-calculate an average lifetime rate.
      var derivedFromWallLossAndAge = false;
      if (corrosionRateMpy === 0 && !derivedFromHistory && nominalWall > 0 && currentWall > 0 && serviceAgeYears > 0) {
        var totalLossInches = nominalWall - currentWall;
        if (totalLossInches > 0) {
          var avgRateMpy = (totalLossInches * 1000) / serviceAgeYears;
          corrosionRateMpy = avgRateMpy;
          corrosionTimeline.corrosion_rate_mpy = parseFloat(avgRateMpy.toFixed(2));
          corrosionTimeline.method = "DERIVED_FROM_WALL_LOSS_AND_AGE";
          corrosionTimeline.notes.push(
            "Corrosion rate derived from total wall loss (" +
            (totalLossInches * 1000).toFixed(1) +
            " mils) over service age (" +
            serviceAgeYears.toFixed(1) +
            " years) = " +
            avgRateMpy.toFixed(2) +
            " mpy average lifetime rate"
          );
          corrosionTimeline.notes.push(
            "LIFETIME AVERAGE: actual rate may be higher if corrosion accelerated recently. Recommend thickness monitoring to establish current active rate."
          );
          derivedFromWallLossAndAge = true;
        }
      }

      // --- Method 3: provided rate (v1.0 fallback) ---
      if (corrosionRateMpy > 0 && currentWall > 0) {
        if (corrosionTimeline.method === "none") {
          corrosionTimeline.method = "PROVIDED_RATE";
        }

        var retireWall = retirementWall;
        if (retireWall === 0 && nominalWall > 0) {
          retireWall = nominalWall * 0.50;
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
          if (derivedFromHistory) {
            corrosionTimeline.confidence = "HIGH";
          } else if (derivedFromWallLossAndAge) {
            corrosionTimeline.confidence = "MODERATE_LIFETIME_AVG";
          } else {
            corrosionTimeline.confidence = "MODERATE";
          }
        } else {
          corrosionTimeline.remaining_life_years = 0;
          corrosionTimeline.half_life_years = 0;
          corrosionTimeline.next_inspection_max_years = 0;
          corrosionTimeline.notes.push("CRITICAL: Current wall is at or below retirement threshold");
          corrosionTimeline.confidence = "HIGH";
        }

        if (serviceEnvironment.indexOf("sour") >= 0 || serviceEnvironment.indexOf("h2s") >= 0) {
          corrosionTimeline.notes.push("Sour service: corrosion rates can be variable - consider 50% safety factor on remaining life");
        }
      } else {
        corrosionTimeline.notes.push("Insufficient data for corrosion timeline - need (current wall + rate), (thickness history), or (nominal wall + current wall + service age)");
      }
    }

    // ====================================================================
    // CRACK GROWTH PROJECTION (Paris Law) -- unchanged from v1.0
    // ====================================================================

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

      var paris_C = 6.9e-12;
      var paris_m = 3.0;
      var environmentLabel = "air";

      if (serviceEnvironment.indexOf("sour") >= 0 || serviceEnvironment.indexOf("h2s") >= 0) {
        paris_C = 1.65e-11;
        environmentLabel = "sour/H2S";
      } else if (serviceEnvironment.indexOf("marine") >= 0 || serviceEnvironment.indexOf("seawater") >= 0) {
        paris_C = 1.65e-11;
        environmentLabel = "marine";
      }

      if (materialClass.indexOf("stainless") >= 0 || materialClass.indexOf("austenitic") >= 0) {
        paris_C = 5.6e-12;
        paris_m = 3.25;
      }

      crackTimeline.paris_C = paris_C;
      crackTimeline.paris_m = paris_m;
      crackTimeline.notes.push("Paris Law constants for " + environmentLabel + " environment: C=" + paris_C.toExponential(2) + ", m=" + paris_m.toFixed(2));

      if (currentCrackDepth > 0 && stressRange > 0) {
        var geometryFactor = 1.12;
        var crackDepthInches = currentCrackDepth;
        var deltaK = stressRange * Math.sqrt(Math.PI * crackDepthInches) * geometryFactor;
        crackTimeline.delta_K_ksi_sqrt_in = parseFloat(deltaK.toFixed(3));

        var growthPerCycle = paris_C * Math.pow(deltaK, paris_m);
        crackTimeline.growth_per_cycle_inches = parseFloat(growthPerCycle.toExponential(3));

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
    // GOVERNING TIMELINE (unchanged from v1.0)
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

    var recommendedInterval = null;
    if (governingTimeYears !== null) {
      recommendedInterval = parseFloat(Math.min(governingTimeYears / 2, 5).toFixed(2));
    }

    var urgency = "STANDARD";
    if (governingTimeYears !== null) {
      if (governingTimeYears <= 0) urgency = "EMERGENCY";
      else if (governingTimeYears < 1) urgency = "CRITICAL";
      else if (governingTimeYears < 3) urgency = "PRIORITY";
      else if (governingTimeYears < 10) urgency = "ELEVATED";
    }

    // ====================================================================
    // v1.1: PROGRESSION STATE CLASSIFICATION (6-state taxonomy)
    // ====================================================================
    // Universal classification reading corrosion_timeline + crack_timeline +
    // fmd_severity. No asset-type branches. Degrades to insufficient_data
    // gracefully. This is a DIAGNOSTIC label for UI/PDF clarity, never used
    // to override timeline calculations.
    //
    // States:
    //   insufficient_data   -- no quantified timeline, no signal
    //   dormant_possible    -- mechanism candidate flagged but no active evidence
    //   stable_known        -- timeline present AND rate very low (<3 mpy) AND long remaining life
    //   active_possible     -- wall loss or crack present, rate uncertain, moderate confidence
    //   active_likely       -- timeline quantified with MODERATE+ confidence and measurable progression
    //   accelerating        -- rate >= 20 mpy OR FMD severity HIGH OR derived rate > historical rate
    //   unstable_critical   -- remaining life < 1 year OR current wall <= retirement OR crack at critical size
    // ====================================================================

    var progressionState = "insufficient_data";
    var progressionBasis = "No quantified timeline data available";

    var haveCorTimeline = (corLife !== null);
    var haveCraTimeline = (craLife !== null);
    var haveAnyTimeline = haveCorTimeline || haveCraTimeline;

    // Level 7: unstable_critical
    if (governingTimeYears !== null && governingTimeYears <= 1) {
      progressionState = "unstable_critical";
      progressionBasis = "Remaining life " + governingTimeYears + " years -- critical threshold breached";
    } else if (corrosionTimeline.enabled && corrosionTimeline.remaining_wall_inches <= 0 && corrosionTimeline.method !== "none") {
      progressionState = "unstable_critical";
      progressionBasis = "Current wall at or below retirement threshold";
    } else if (crackTimeline.enabled && crackTimeline.time_to_failure_years === 0) {
      progressionState = "unstable_critical";
      progressionBasis = "Current crack size at or exceeds critical dimension";
    }
    // Level 6: accelerating
    else if (corrosionRateMpy >= 20) {
      progressionState = "accelerating";
      progressionBasis = "Corrosion rate " + corrosionRateMpy.toFixed(1) + " mpy exceeds accelerating threshold (>=20 mpy)";
    } else if (fmdSeverity === "HIGH" && haveAnyTimeline) {
      progressionState = "accelerating";
      progressionBasis = "FMD governing severity HIGH with quantified timeline -- progression advancing";
    } else if (fmdSeverity === "CRITICAL") {
      progressionState = "accelerating";
      progressionBasis = "FMD governing severity CRITICAL -- mechanism progression at or near unstable";
    }
    // Level 5: active_likely
    else if (haveAnyTimeline && (corrosionTimeline.confidence === "HIGH" || corrosionTimeline.confidence === "MODERATE")) {
      progressionState = "active_likely";
      progressionBasis = "Timeline quantified with " + corrosionTimeline.confidence + " confidence from " + corrosionTimeline.method;
    } else if (haveCraTimeline && (crackTimeline.confidence === "HIGH" || crackTimeline.confidence === "MODERATE")) {
      progressionState = "active_likely";
      progressionBasis = "Crack growth quantified with " + crackTimeline.confidence + " confidence via Paris Law";
    }
    // Level 4: active_possible
    else if (haveAnyTimeline && corrosionTimeline.confidence === "MODERATE_LIFETIME_AVG") {
      progressionState = "active_possible";
      progressionBasis = "Lifetime-average corrosion rate derived from wall loss and service age -- current active rate unconfirmed";
    } else if (hasCorrosion || hasCracking || currentWall > 0 || wallLossPercent > 0) {
      progressionState = "active_possible";
      progressionBasis = "Damage mechanism present but timeline projection lacks sufficient data for quantified rate";
    }
    // Level 3: stable_known (rate present but low, long life)
    else if (corrosionRateMpy > 0 && corrosionRateMpy < 3 && corLife !== null && corLife > 20) {
      progressionState = "stable_known";
      progressionBasis = "Low corrosion rate " + corrosionRateMpy.toFixed(1) + " mpy with long remaining life " + corLife + " years";
    }
    // Level 2: dormant_possible
    else if ((hasCorrosion || hasCracking) && !haveAnyTimeline) {
      progressionState = "dormant_possible";
      progressionBasis = "Mechanism candidate flagged but no active evidence or measurable progression";
    }
    // Level 1: insufficient_data (default already set)

    // FMD severity upgrade: never downgrade, only promote
    // active_likely + HIGH severity -> accelerating (already handled above)
    // stable_known + HIGH severity -> active_possible
    if (fmdSeverity === "HIGH" && progressionState === "stable_known") {
      progressionState = "active_possible";
      progressionBasis = progressionBasis + "; upgraded due to FMD HIGH severity";
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
      progression_state: progressionState,
      progression_state_basis: progressionBasis,
      corrosion_timeline: corrosionTimeline,
      crack_timeline: crackTimeline,
      consequence_context: {
        consequence_undetermined: consequenceUndetermined,
        undetermined_impacts: undeterminedImpacts,
        consequence_tier: consequenceTier,
        warning: consequenceUndetermined ? "Timeline computed against asset with undetermined consequence dimensions (" + undeterminedImpacts.join(", ") + "). Urgency band may need upward revision once consequence is fully characterized." : null
      },
      inputs_echo: {
        nominal_wall: nominalWall,
        current_wall: currentWall,
        wall_loss_percent: wallLossPercent,
        service_age_years: serviceAgeYears,
        corrosion_rate_mpy_input: parseFloat(body.corrosion_rate_mpy) || 0,
        corrosion_rate_mpy_final: corrosionRateMpy,
        fmd_severity: fmdSeverity,
        has_corrosion: hasCorrosion,
        has_cracking: hasCracking,
        service_environment: serviceEnvironment,
        material_class: materialClass
      },
      metadata: {
        engine: "failure-timeline",
        version: "1.2",
        method: "Linear corrosion projection + Paris Law crack growth + wall-loss/age derivation + 6-state progression taxonomy",
        consequence_undetermined: consequenceUndetermined,
        timestamp: new Date().toISOString()
      }
    };

    return { statusCode: 200, headers: headers, body: JSON.stringify(result) };

  } catch (err) {
    return { statusCode: 500, headers: headers, body: JSON.stringify({ error: "Failure timeline error: " + (err.message || String(err)) }) };
  }
};

module.exports = { handler: handler };
