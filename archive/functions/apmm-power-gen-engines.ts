// @ts-nocheck
/**
 * DEPLOY312 — apmm-power-gen-engines.ts
 * netlify/functions/apmm-power-gen-engines.ts
 *
 * APMM Sub-Engines 240-245: Power Generation Physics Calculations
 * These are lean deterministic engines that feed into the APMM Orchestrator.
 *
 * 240: CREEP_LIFE — Larson-Miller parameter creep life estimation
 * 241: POWER_FATIGUE_CYCLE — Equivalent damage cycle calculation
 * 242: FAC_RATE — Flow-accelerated corrosion thinning rate
 * 243: TURBINE_RISK — Turbine risk scoring from operating data
 * 244: THERMAL_STRESS_SCREEN — Thermal stress screening calculation
 * 245: BOILER_TUBE_DAMAGE — Boiler tube damage mechanism classification
 *
 * House style: var only, string concatenation, POST-only, buildResult/holdResult.
 */

import type { Handler } from "@netlify/functions";

var ENGINE_VERSION = "apmm-power-gen-engines/1.0.0";

// ================================================================
// HELPERS
// ================================================================
function buildResult(engineNum, engineCode, result, interpretation, confidence, severity, extras) {
  var out = {
    engine_number: engineNum,
    engine_code: engineCode,
    engine_version: ENGINE_VERSION,
    result: result,
    interpretation: interpretation,
    confidence: confidence,
    severity: severity,
    timestamp: new Date().toISOString()
  };
  if (extras) {
    var keys = Object.keys(extras);
    for (var i = 0; i < keys.length; i++) {
      out[keys[i]] = extras[keys[i]];
    }
  }
  return out;
}

function holdResult(engineNum, engineCode, missingInputs) {
  return buildResult(engineNum, engineCode, "hold_for_input",
    "Missing: " + missingInputs.join(", "), 0, "hold_for_input",
    { missing_inputs: missingInputs });
}

// ================================================================
// ENGINE 240: CREEP_LIFE — Larson-Miller Parameter
// ================================================================
function runCreepLife(input) {
  var missing = [];
  if (!input.temperature && !input.operating_temperature) missing.push("temperature (C)");
  if (!input.service_hours) missing.push("service_hours");
  if (missing.length > 0) return holdResult(240, "CREEP_LIFE", missing);

  var tempC = input.temperature || input.operating_temperature || 0;
  var tempK = tempC + 273.15;
  var serviceHours = input.service_hours || 0;
  var stress = input.stress || input.operating_stress || 100; // MPa default
  var material = (input.material || "").toLowerCase();

  // Larson-Miller constant (material-dependent, default 20 for Cr-Mo steels)
  var lmConstant = 20;
  if (material.indexOf("p91") !== -1 || material.indexOf("grade 91") !== -1) lmConstant = 30;
  else if (material.indexOf("p22") !== -1 || material.indexOf("grade 22") !== -1) lmConstant = 20;
  else if (material.indexOf("carbon") !== -1 || material.indexOf("a106") !== -1) lmConstant = 20;

  // LMP = T * (C + log10(t_rupture))
  // For current state: LMP_current = T * (C + log10(service_hours))
  var lmpCurrent = 0;
  if (serviceHours > 0) {
    lmpCurrent = tempK * (lmConstant + Math.log(serviceHours) / Math.log(10));
  }

  // Estimate rupture life at current conditions (simplified)
  // Using generic rupture data: log10(t_r) = LMP_rupture/T - C
  // Typical LMP at rupture for 100MPa stress:
  var lmpRupture = 40000; // Simplified — real implementation uses material-specific curves
  if (stress > 200) lmpRupture = 35000;
  else if (stress > 150) lmpRupture = 37000;
  else if (stress < 50) lmpRupture = 45000;

  var lifeFractionUsed = lmpCurrent > 0 ? lmpCurrent / lmpRupture : 0;
  lifeFractionUsed = Math.min(lifeFractionUsed, 1.0);
  lifeFractionUsed = Math.round(lifeFractionUsed * 1000) / 1000;

  var remainingFraction = 1.0 - lifeFractionUsed;
  var estimatedRemainingHours = remainingFraction > 0 ? Math.round(serviceHours * (remainingFraction / lifeFractionUsed)) : 0;
  if (lifeFractionUsed <= 0) estimatedRemainingHours = -1; // Cannot estimate

  var severity = "low";
  if (lifeFractionUsed > 0.8) severity = "critical";
  else if (lifeFractionUsed > 0.6) severity = "high";
  else if (lifeFractionUsed > 0.4) severity = "medium";

  return buildResult(240, "CREEP_LIFE",
    { lmp_current: Math.round(lmpCurrent), lmp_rupture: lmpRupture,
      life_fraction_used: lifeFractionUsed, remaining_fraction: Math.round(remainingFraction * 1000) / 1000,
      estimated_remaining_hours: estimatedRemainingHours,
      temperature_k: Math.round(tempK * 10) / 10, stress_mpa: stress,
      lm_constant: lmConstant },
    "Creep life fraction used: " + (Math.round(lifeFractionUsed * 100)) + "% | " +
      (estimatedRemainingHours > 0 ? "~" + estimatedRemainingHours + " hrs remaining" : "life estimate unavailable"),
    0.6, severity, {}
  );
}

// ================================================================
// ENGINE 241: POWER_FATIGUE_CYCLE — Equivalent Damage Cycles
// ================================================================
function runPowerFatigueCycle(input) {
  var coldStarts = input.cold_starts || 0;
  var warmStarts = input.warm_starts || 0;
  var hotStarts = input.hot_starts || 0;
  var trips = input.trips || 0;
  var loadRejections = input.load_rejections || 0;

  var total = coldStarts + warmStarts + hotStarts + trips + loadRejections;
  if (total === 0) return holdResult(241, "POWER_FATIGUE_CYCLE", ["cycle counts (cold_starts, warm_starts, hot_starts, trips)"]);

  // Weighting factors (relative to cold start = 1.0)
  var equivalentCycles = (coldStarts * 1.0) + (warmStarts * 0.5) + (hotStarts * 0.2)
    + (trips * 1.5) + (loadRejections * 1.2);
  equivalentCycles = Math.round(equivalentCycles * 10) / 10;

  // Design cycle allowance (typical thick-wall component ~10,000 equivalent cycles)
  var designAllowance = input.design_cycle_allowance || 10000;
  var cycleFractionUsed = equivalentCycles / designAllowance;
  cycleFractionUsed = Math.round(cycleFractionUsed * 1000) / 1000;

  var severity = "low";
  if (cycleFractionUsed > 0.8) severity = "critical";
  else if (cycleFractionUsed > 0.5) severity = "high";
  else if (cycleFractionUsed > 0.3) severity = "medium";

  return buildResult(241, "POWER_FATIGUE_CYCLE",
    { equivalent_cycles: equivalentCycles, design_allowance: designAllowance,
      cycle_fraction_used: cycleFractionUsed,
      breakdown: { cold: coldStarts, warm: warmStarts, hot: hotStarts,
        trips: trips, load_rejections: loadRejections },
      remaining_cycles: Math.round(designAllowance - equivalentCycles) },
    "Equivalent damage cycles: " + equivalentCycles + " of " + designAllowance +
      " (" + (Math.round(cycleFractionUsed * 100)) + "% consumed)",
    0.7, severity, {}
  );
}

// ================================================================
// ENGINE 242: FAC_RATE — Flow-Accelerated Corrosion Thinning Rate
// ================================================================
function runFACRate(input) {
  var missing = [];
  if (!input.temperature && !input.operating_temperature) missing.push("temperature (C)");
  if (missing.length > 0) return holdResult(242, "FAC_RATE", missing);

  var temp = input.temperature || input.operating_temperature || 0;
  var velocity = input.flow_velocity || 3; // m/s default
  var dissolvedOxygen = input.dissolved_oxygen || 10; // ppb
  var ph = input.ph || 9.2;
  var chromium = input.chromium_content || 0; // %
  var geometry = (input.geometry_factor || 1.0);

  // Simplified CHECWORKS-style FAC rate model
  // Base rate peaks around 150C for single-phase
  var tempFactor = 0;
  if (temp < 100) tempFactor = 0.1;
  else if (temp < 130) tempFactor = 0.5;
  else if (temp < 170) tempFactor = 1.0; // Peak
  else if (temp < 200) tempFactor = 0.7;
  else if (temp < 250) tempFactor = 0.3;
  else tempFactor = 0.05;

  // Velocity factor (approximately velocity^0.8)
  var velocityFactor = Math.pow(velocity / 3.0, 0.8);

  // Chemistry factor
  var chemFactor = 1.0;
  if (dissolvedOxygen > 20) chemFactor = 0.3; // High oxygen inhibits FAC
  else if (dissolvedOxygen > 5) chemFactor = 0.6;
  if (ph > 9.5) chemFactor = chemFactor * 0.5; // High pH inhibits
  else if (ph < 8.8) chemFactor = chemFactor * 1.3;

  // Chromium factor (Cr > 0.1% significantly reduces FAC)
  var crFactor = 1.0;
  if (chromium > 1.0) crFactor = 0.05;
  else if (chromium > 0.1) crFactor = 0.2;
  else if (chromium > 0.02) crFactor = 0.5;

  // Calculate rate (mm/yr) — base rate ~0.5 mm/yr at reference conditions
  var baseRate = 0.5;
  var facRate = baseRate * tempFactor * velocityFactor * chemFactor * crFactor * geometry;
  facRate = Math.round(facRate * 1000) / 1000;

  // Remaining life
  var remainingLife = null;
  if (input.wall_thickness && input.min_required_thickness) {
    var margin = input.wall_thickness - input.min_required_thickness;
    remainingLife = facRate > 0 ? Math.round((margin / facRate) * 10) / 10 : null;
  }

  var severity = "low";
  if (facRate > 1.0) severity = "critical";
  else if (facRate > 0.5) severity = "high";
  else if (facRate > 0.2) severity = "medium";
  if (remainingLife !== null && remainingLife < 2) severity = "critical";

  return buildResult(242, "FAC_RATE",
    { fac_rate_mmpy: facRate, remaining_life_years: remainingLife,
      factors: { temperature: tempFactor, velocity: velocityFactor,
        chemistry: chemFactor, chromium: crFactor, geometry: geometry },
      inputs: { temp_c: temp, velocity_ms: velocity, do_ppb: dissolvedOxygen,
        ph: ph, cr_pct: chromium } },
    "FAC thinning rate: " + facRate + " mm/yr" +
      (remainingLife !== null ? " | Remaining life: " + remainingLife + " years" : ""),
    0.6, severity, {}
  );
}

// ================================================================
// ENGINE 243: TURBINE_RISK — Risk Scoring
// ================================================================
function runTurbineRisk(input) {
  var missing = [];
  if (!input.operating_hours && !input.rotor_hours) missing.push("operating_hours");
  if (missing.length > 0) return holdResult(243, "TURBINE_RISK", missing);

  var hours = input.operating_hours || input.rotor_hours || 0;
  var starts = input.starts || 0;
  var trips = input.trips || 0;
  var overspeed = input.overspeed_events || 0;

  // Equivalent operating hours (starts and trips add equivalent fatigue hours)
  var equivalentHours = hours + (starts * 20) + (trips * 50) + (overspeed * 500);

  // Risk score (0-100)
  var riskScore = 0;
  if (equivalentHours > 200000) riskScore += 30;
  else if (equivalentHours > 100000) riskScore += 15;
  else if (equivalentHours > 50000) riskScore += 8;

  if (starts > 2000) riskScore += 20;
  else if (starts > 1000) riskScore += 12;
  else if (starts > 500) riskScore += 6;

  if (trips > 50) riskScore += 25;
  else if (trips > 20) riskScore += 15;
  else if (trips > 5) riskScore += 8;

  if (overspeed > 0) riskScore += 20 * Math.min(overspeed, 3);

  riskScore = Math.min(riskScore, 100);

  // Inspection interval recommendation
  var intervalHours = 32000;
  if (riskScore > 70) intervalHours = 8000;
  else if (riskScore > 50) intervalHours = 16000;
  else if (riskScore > 30) intervalHours = 24000;

  var severity = "low";
  if (riskScore > 70) severity = "critical";
  else if (riskScore > 50) severity = "high";
  else if (riskScore > 30) severity = "medium";

  return buildResult(243, "TURBINE_RISK",
    { risk_score: riskScore, equivalent_hours: Math.round(equivalentHours),
      recommended_interval_hours: intervalHours,
      inputs: { hours: hours, starts: starts, trips: trips, overspeed: overspeed } },
    "Turbine risk score: " + riskScore + "/100 | Equivalent hours: " + Math.round(equivalentHours) +
      " | Next inspection: " + intervalHours + " hrs",
    0.65, severity, {}
  );
}

// ================================================================
// ENGINE 244: THERMAL_STRESS_SCREEN
// ================================================================
function runThermalStressScreen(input) {
  var missing = [];
  if (!input.delta_t && !input.thermal_gradient) missing.push("delta_t or thermal_gradient (C)");
  if (missing.length > 0) return holdResult(244, "THERMAL_STRESS_SCREEN", missing);

  var deltaT = input.delta_t || input.thermal_gradient || 0;
  var E = input.elastic_modulus || 200; // GPa
  if (E < 1000) E = E * 1000; // Convert to MPa
  var alpha = input.cte || 12e-6; // /C
  var constraint = input.constraint_factor || 0.7;
  var geometryF = input.geometry_factor || 1.0;
  var yieldStr = input.yield_strength || 250; // MPa

  var thermalStress = E * alpha * deltaT * constraint * geometryF;
  thermalStress = Math.round(thermalStress * 100) / 100;
  var ratio = Math.round((thermalStress / yieldStr) * 1000) / 1000;

  var category = "LOW";
  var severity = "low";
  if (ratio > 0.9) { category = "CRITICAL"; severity = "critical"; }
  else if (ratio > 0.6) { category = "HIGH"; severity = "high"; }
  else if (ratio > 0.3) { category = "MODERATE"; severity = "medium"; }

  return buildResult(244, "THERMAL_STRESS_SCREEN",
    { thermal_stress_mpa: thermalStress, stress_ratio: ratio, category: category,
      fea_required: ratio > 0.6,
      inputs: { delta_t: deltaT, E_mpa: E, alpha: alpha, constraint: constraint,
        geometry: geometryF, yield_mpa: yieldStr } },
    "Thermal stress: " + thermalStress + " MPa (" + (Math.round(ratio * 100)) + "% yield) — " + category,
    0.7, severity, {}
  );
}

// ================================================================
// ENGINE 245: BOILER_TUBE_DAMAGE — Mechanism Classification
// ================================================================
function runBoilerTubeDamage(input) {
  var missing = [];
  if (!input.temperature && !input.operating_temperature) missing.push("temperature");
  if (!input.location && !input.tube_bank) missing.push("location or tube_bank");
  if (missing.length > 0) return holdResult(245, "BOILER_TUBE_DAMAGE", missing);

  var temp = input.temperature || input.operating_temperature || 0;
  var location = (input.location || input.tube_bank || "").toLowerCase();
  var fuel = (input.fuel_type || "").toLowerCase();
  var hasChemistry = !!(input.ph || input.dissolved_oxygen);
  var wastageType = (input.wastage_type || "").toLowerCase();
  var failureMode = (input.failure_mode || "").toLowerCase();

  var mechanisms = [];
  var primaryMechanism = "UNKNOWN";
  var confidence = 0.3;

  // High-temp zone + long service = creep
  if (temp > 500 && (location.indexOf("superheat") !== -1 || location.indexOf("reheat") !== -1)) {
    mechanisms.push({ mechanism: "CREEP", probability: 0.4 });
  }

  // Waterside wastage patterns
  if (wastageType.indexOf("goug") !== -1 || wastageType.indexOf("caustic") !== -1) {
    mechanisms.push({ mechanism: "CAUSTIC_GOUGING", probability: 0.6 });
  }
  if (wastageType.indexOf("pit") !== -1 || wastageType.indexOf("oxygen") !== -1) {
    mechanisms.push({ mechanism: "OXYGEN_PITTING", probability: 0.55 });
  }
  if (wastageType.indexOf("under") !== -1 || wastageType.indexOf("deposit") !== -1) {
    mechanisms.push({ mechanism: "UNDER_DEPOSIT_CORROSION", probability: 0.5 });
  }

  // Fireside
  if (wastageType.indexOf("external") !== -1 || wastageType.indexOf("fireside") !== -1 ||
      fuel === "coal" || fuel === "biomass") {
    mechanisms.push({ mechanism: "FIRESIDE_CORROSION", probability: 0.45 });
  }

  // Hydrogen damage
  if (wastageType.indexOf("hydrogen") !== -1 || wastageType.indexOf("fissur") !== -1 ||
      failureMode.indexOf("window") !== -1) {
    mechanisms.push({ mechanism: "HYDROGEN_DAMAGE", probability: 0.5 });
  }

  // Overheating
  if (failureMode.indexOf("rupture") !== -1 || failureMode.indexOf("fish") !== -1 ||
      failureMode.indexOf("bulge") !== -1) {
    if (temp > 550) {
      mechanisms.push({ mechanism: "LONG_TERM_OVERHEATING", probability: 0.5 });
    } else {
      mechanisms.push({ mechanism: "SHORT_TERM_OVERHEATING", probability: 0.4 });
    }
  }

  // FAC in economizer
  if (location.indexOf("econom") !== -1 && temp >= 100 && temp <= 250) {
    mechanisms.push({ mechanism: "FAC", probability: 0.4 });
  }

  // Sort by probability
  mechanisms.sort(function(a, b) { return b.probability - a.probability; });

  if (mechanisms.length > 0) {
    primaryMechanism = mechanisms[0].mechanism;
    confidence = mechanisms[0].probability;
  }

  var severity = "low";
  if (primaryMechanism === "HYDROGEN_DAMAGE" || primaryMechanism === "SHORT_TERM_OVERHEATING") severity = "critical";
  else if (confidence > 0.5) severity = "high";
  else if (confidence > 0.3) severity = "medium";

  return buildResult(245, "BOILER_TUBE_DAMAGE",
    { primary_mechanism: primaryMechanism, all_mechanisms: mechanisms,
      mechanism_count: mechanisms.length,
      location: location, temperature: temp },
    "Primary mechanism: " + primaryMechanism + " (" + (Math.round(confidence * 100)) + "% confidence)" +
      " | " + mechanisms.length + " candidate(s)",
    confidence, severity, {}
  );
}

// ================================================================
// ENGINE MAP
// ================================================================
var ENGINE_MAP = {
  "240": runCreepLife,
  "241": runPowerFatigueCycle,
  "242": runFACRate,
  "243": runTurbineRisk,
  "244": runThermalStressScreen,
  "245": runBoilerTubeDamage,
  "CREEP_LIFE": runCreepLife,
  "POWER_FATIGUE_CYCLE": runPowerFatigueCycle,
  "FAC_RATE": runFACRate,
  "TURBINE_RISK": runTurbineRisk,
  "THERMAL_STRESS_SCREEN": runThermalStressScreen,
  "BOILER_TUBE_DAMAGE": runBoilerTubeDamage
};

// ================================================================
// HANDLER
// ================================================================
export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "POST only" }) };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "";

    // Health check
    if (action === "health") {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          status: "operational",
          engine_version: ENGINE_VERSION,
          engines: [
            { number: 240, code: "CREEP_LIFE", name: "Larson-Miller Creep Life" },
            { number: 241, code: "POWER_FATIGUE_CYCLE", name: "Power Fatigue Cycle Calculator" },
            { number: 242, code: "FAC_RATE", name: "FAC Thinning Rate" },
            { number: 243, code: "TURBINE_RISK", name: "Turbine Risk Scoring" },
            { number: 244, code: "THERMAL_STRESS_SCREEN", name: "Thermal Stress Screening" },
            { number: 245, code: "BOILER_TUBE_DAMAGE", name: "Boiler Tube Damage Classification" }
          ],
          timestamp: new Date().toISOString()
        })
      };
    }

    // Route to engine by number or code
    var engineKey = body.engine || body.engine_number || body.engine_code || action;
    var engineFn = ENGINE_MAP[String(engineKey)];

    if (!engineFn) {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          error: "Unknown engine: " + engineKey,
          available: ["240/CREEP_LIFE", "241/POWER_FATIGUE_CYCLE", "242/FAC_RATE",
            "243/TURBINE_RISK", "244/THERMAL_STRESS_SCREEN", "245/BOILER_TUBE_DAMAGE"]
        })
      };
    }

    var result = engineFn(body);
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(result)
    };

  } catch (err) {
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: String(err && err.message ? err.message : err) })
    };
  }
};
