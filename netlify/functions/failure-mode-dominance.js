// FAILURE MODE DOMINANCE ENGINE v1.0
// File: netlify/functions/failure-mode-dominance.js
// NO TYPESCRIPT — PURE JAVASCRIPT

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

    var mechanisms = (body.damage_mechanisms || []).map(function(m) { return (m || "").toLowerCase().trim(); });
    var remainingStrength = body.remaining_strength || null;
    var authorityLock = body.authority_lock || null;
    var wallLossPercent = body.wall_loss_percent || 0;
    var hasCracking = body.has_cracking || false;
    var serviceEnvironment = (body.service_environment || "").toLowerCase().trim();
    var transcript = (body.transcript || "").toLowerCase();
    var operatingPressure = body.operating_pressure || 0;
    var nominalWall = body.nominal_wall || 0;
    var measuredMinWall = body.measured_minimum_wall || 0;
    var pipeOD = body.pipe_od || 0;
    var smys = body.smys || 0;

    // ====================================================================
    // CLASSIFY EACH MECHANISM INTO FAILURE MODE CATEGORY
    // ====================================================================

    var corrosionMechanisms = [];
    var crackingMechanisms = [];
    var otherMechanisms = [];

    mechanisms.forEach(function(mech) {
      // Cracking family
      if (mech.indexOf("crack") >= 0 || mech.indexOf("scc") >= 0 || mech.indexOf("ssc") >= 0 ||
          mech.indexOf("sscc") >= 0 || mech.indexOf("hic") >= 0 || mech.indexOf("sohic") >= 0 ||
          mech.indexOf("fatigue") >= 0 || mech === "hydrogen_induced_cracking" ||
          mech === "sulfide_stress_cracking" || mech === "stress_corrosion_cracking" ||
          mech.indexOf("cwb") >= 0 || mech.indexOf("hydrogen_embrittlement") >= 0) {
        crackingMechanisms.push(mech);
      }
      // Corrosion family
      else if (mech.indexOf("corrosion") >= 0 || mech.indexOf("wall_loss") >= 0 ||
               mech.indexOf("pitting") >= 0 || mech.indexOf("erosion") >= 0 ||
               mech.indexOf("mic") >= 0 || mech.indexOf("co2") >= 0 ||
               mech.indexOf("thinning") >= 0 || mech.indexOf("galvanic") >= 0 ||
               mech.indexOf("cui") >= 0 || mech.indexOf("metal_loss") >= 0) {
        corrosionMechanisms.push(mech);
      }
      // Other
      else {
        otherMechanisms.push(mech);
      }
    });

    // Also check transcript for cracking keywords
    if (transcript.indexOf("crack") >= 0 || transcript.indexOf("scc") >= 0 ||
        transcript.indexOf("hic") >= 0 || transcript.indexOf("sohic") >= 0) {
      hasCracking = true;
    }

    if (hasCracking && crackingMechanisms.length === 0) {
      crackingMechanisms.push("cracking_unspecified");
    }

    var hasCorrosionMode = corrosionMechanisms.length > 0 || wallLossPercent > 0;
    var hasCrackingMode = crackingMechanisms.length > 0 || hasCracking;

    // ====================================================================
    // EVALUATE CORROSION FAILURE PATH
    // ====================================================================

    var corrosionPath = {
      active: hasCorrosionMode,
      mechanisms: corrosionMechanisms,
      failure_pressure: null,
      failure_pressure_source: "none",
      wall_loss_percent: wallLossPercent,
      severity: "none",
      assessment_method: "none",
      notes: []
    };

    if (hasCorrosionMode) {
      // Use B31G MAOP if available from remaining-strength engine
      if (remainingStrength && remainingStrength.governing_maop) {
        corrosionPath.failure_pressure = remainingStrength.governing_maop;
        corrosionPath.failure_pressure_source = "B31G_CALCULATED";
        corrosionPath.assessment_method = remainingStrength.governing_method || "B31G";
      }
      // Estimate from wall loss if no B31G data
      else if (wallLossPercent > 0 && nominalWall > 0 && pipeOD > 0 && smys > 0) {
        var remainingWall = nominalWall * (1 - wallLossPercent / 100);
        var estimatedMAOP = (2 * smys * remainingWall * 0.72) / pipeOD;
        corrosionPath.failure_pressure = Math.round(estimatedMAOP);
        corrosionPath.failure_pressure_source = "BARLOW_ESTIMATED";
        corrosionPath.assessment_method = "Barlow_simplified";
        corrosionPath.notes.push("No B31G data available - using simplified Barlow estimate");
      }

      // Severity classification
      if (wallLossPercent > 80) {
        corrosionPath.severity = "CRITICAL";
        corrosionPath.notes.push("Wall loss > 80% - imminent failure risk");
      } else if (wallLossPercent > 60) {
        corrosionPath.severity = "SEVERE";
        corrosionPath.notes.push("Wall loss > 60% - significant structural compromise");
      } else if (wallLossPercent > 40) {
        corrosionPath.severity = "HIGH";
        corrosionPath.notes.push("Wall loss > 40% - engineering assessment required");
      } else if (wallLossPercent > 20) {
        corrosionPath.severity = "MODERATE";
        corrosionPath.notes.push("Wall loss > 20% - monitoring and trending required");
      } else if (wallLossPercent > 0) {
        corrosionPath.severity = "LOW";
      }

      // MIC flag
      var hasMIC = corrosionMechanisms.some(function(m) { return m.indexOf("mic") >= 0; });
      if (hasMIC) {
        corrosionPath.notes.push("MIC detected - corrosion rate predictions from chemical models may be non-conservative (MIC can accelerate 10x)");
      }
    }

    // ====================================================================
    // EVALUATE CRACKING FAILURE PATH
    // ====================================================================

    var crackingPath = {
      active: hasCrackingMode,
      mechanisms: crackingMechanisms,
      failure_pressure: null,
      failure_pressure_source: "none",
      severity: "none",
      assessment_method: "none",
      brittle_fracture_risk: false,
      notes: []
    };

    if (hasCrackingMode) {
      crackingPath.assessment_method = "API_579_Part_9";

      // Sour service cracking = elevated severity always
      var isSour = serviceEnvironment.indexOf("sour") >= 0 || serviceEnvironment.indexOf("h2s") >= 0 ||
                   transcript.indexOf("sour") >= 0 || transcript.indexOf("h2s") >= 0;

      var hasSSC = crackingMechanisms.some(function(m) { return m.indexOf("ssc") >= 0 || m.indexOf("sscc") >= 0 || m.indexOf("sulfide") >= 0; });
      var hasHIC = crackingMechanisms.some(function(m) { return m.indexOf("hic") >= 0 || m.indexOf("sohic") >= 0; });
      var hasFatigue = crackingMechanisms.some(function(m) { return m.indexOf("fatigue") >= 0; });
      var hasSCC = crackingMechanisms.some(function(m) { return m.indexOf("scc") >= 0 || m.indexOf("stress_corrosion") >= 0; });

      // SSC = always critical (sudden brittle fracture)
      if (hasSSC) {
        crackingPath.severity = "CRITICAL";
        crackingPath.brittle_fracture_risk = true;
        crackingPath.notes.push("SSC produces sudden brittle fracture with NO leak-before-break behavior");
        crackingPath.notes.push("Material hardness verification against NACE MR0175 limits is mandatory");
      }
      // HIC/SOHIC in sour = high to critical
      else if (hasHIC && isSour) {
        crackingPath.severity = "HIGH";
        crackingPath.brittle_fracture_risk = true;
        crackingPath.notes.push("HIC/SOHIC in sour service - stepwise cracking can produce sudden failure");
        crackingPath.notes.push("WFMT or PAUT with C-scan required to characterize crack morphology");
      }
      // SCC = high
      else if (hasSCC) {
        crackingPath.severity = "HIGH";
        crackingPath.notes.push("SCC requires identification of driving environment + stress + material susceptibility triad");
      }
      // Fatigue = depends on cycle count
      else if (hasFatigue) {
        crackingPath.severity = "MODERATE";
        crackingPath.notes.push("Fatigue crack growth governed by Paris Law - requires cycle count and stress range data");
        crackingPath.notes.push("TOFD or PAUT required for crack sizing at stress concentrations");
      }
      // Generic cracking
      else {
        crackingPath.severity = "HIGH";
        crackingPath.notes.push("Cracking mechanism not fully characterized - assume high severity until confirmed");
      }

      // Estimate cracking failure pressure (simplified FAD approach)
      // Without actual crack dimensions, we can only flag that corrosion MAOP is non-applicable
      if (corrosionPath.failure_pressure) {
        // Cracking failure pressure is typically LOWER than corrosion failure pressure
        // because cracks concentrate stress and can cause brittle fracture below yield
        var crackReductionFactor = 0.60; // Conservative: cracks typically reduce capacity 40-60%
        if (crackingPath.brittle_fracture_risk) {
          crackReductionFactor = 0.40; // Brittle fracture = even lower
        }
        crackingPath.failure_pressure = Math.round(corrosionPath.failure_pressure * crackReductionFactor);
        crackingPath.failure_pressure_source = "ESTIMATED_FROM_CORROSION_MAOP";
        crackingPath.notes.push("Crack failure pressure estimated (no crack dimensions provided). Actual API 579-1 Part 9 assessment required.");
      } else {
        crackingPath.failure_pressure_source = "NOT_CALCULABLE";
        crackingPath.notes.push("Cannot calculate cracking failure pressure without crack dimensions and material toughness data");
      }
    }

    // ====================================================================
    // DETERMINE GOVERNING FAILURE MODE
    // ====================================================================

    var governingMode = "NONE";
    var governingPressure = null;
    var governingBasis = "";
    var interactionFlag = false;
    var interactionType = "none";
    var interactionDetail = "";

    if (hasCorrosionMode && hasCrackingMode) {
      // COMPOUND — both active
      interactionFlag = true;

      // Check for specific dangerous interactions
      var hasMICAndHIC = corrosionMechanisms.some(function(m) { return m.indexOf("mic") >= 0; }) &&
                         crackingMechanisms.some(function(m) { return m.indexOf("hic") >= 0; });
      var hasCUIAndFatigue = corrosionMechanisms.some(function(m) { return m.indexOf("cui") >= 0; }) &&
                             crackingMechanisms.some(function(m) { return m.indexOf("fatigue") >= 0; });
      var hasErosionAndSCC = corrosionMechanisms.some(function(m) { return m.indexOf("erosion") >= 0; }) &&
                             crackingMechanisms.some(function(m) { return m.indexOf("scc") >= 0; });

      if (hasMICAndHIC) {
        interactionType = "SYNERGY";
        interactionDetail = "MIC + HIC: microbiological activity generates hydrogen that feeds HIC. Corrosion rate models are non-conservative.";
      } else if (hasCUIAndFatigue) {
        interactionType = "CASCADE";
        interactionDetail = "CUI + Fatigue: hidden wall loss under insulation reduces section, accelerating fatigue crack initiation.";
      } else if (hasErosionAndSCC) {
        interactionType = "SYNERGY";
        interactionDetail = "Erosion + SCC: erosion removes protective films, exposing fresh metal to corrosive environment.";
      } else {
        interactionType = "PARALLEL";
        interactionDetail = "Multiple failure modes active simultaneously. Each must be assessed independently.";
      }

      // Compare failure pressures
      if (crackingPath.failure_pressure && corrosionPath.failure_pressure) {
        if (crackingPath.failure_pressure < corrosionPath.failure_pressure) {
          governingMode = "CRACKING";
          governingPressure = crackingPath.failure_pressure;
          governingBasis = "Cracking failure pressure (" + crackingPath.failure_pressure + " psi) < corrosion failure pressure (" + corrosionPath.failure_pressure + " psi)";
        } else {
          governingMode = "CORROSION";
          governingPressure = corrosionPath.failure_pressure;
          governingBasis = "Corrosion failure pressure (" + corrosionPath.failure_pressure + " psi) <= cracking failure pressure (" + crackingPath.failure_pressure + " psi)";
        }
      } else if (crackingPath.brittle_fracture_risk) {
        governingMode = "CRACKING";
        governingPressure = crackingPath.failure_pressure;
        governingBasis = "Brittle fracture risk from cracking overrides corrosion assessment - crack failure is sudden and catastrophic";
      } else {
        governingMode = "COMPOUND";
        governingBasis = "Both failure modes active but insufficient data to determine governing mode. Both must be assessed.";
      }
    } else if (hasCrackingMode) {
      governingMode = "CRACKING";
      governingPressure = crackingPath.failure_pressure;
      governingBasis = "Cracking is the sole active failure mode";
    } else if (hasCorrosionMode) {
      governingMode = "CORROSION";
      governingPressure = corrosionPath.failure_pressure;
      governingBasis = "Corrosion/metal loss is the sole active failure mode";
    } else {
      governingMode = "NONE";
      governingBasis = "No active failure modes identified from available data";
    }

    // Severity = max of both paths
    var severityRank = { "CRITICAL": 5, "SEVERE": 4, "HIGH": 3, "MODERATE": 2, "LOW": 1, "none": 0 };
    var corSev = severityRank[corrosionPath.severity] || 0;
    var craSev = severityRank[crackingPath.severity] || 0;
    var governingSeverity = corSev >= craSev ? corrosionPath.severity : crackingPath.severity;
    if (governingSeverity === "none") governingSeverity = "UNDETERMINED";

    // Governing code reference
    var governingCode = "API 579-1/ASME FFS-1";
    if (governingMode === "CORROSION") {
      governingCode = "API 579-1 Part 4/5 (Metal Loss)";
    } else if (governingMode === "CRACKING") {
      governingCode = "API 579-1 Part 9 (Crack-Like Flaws)";
    } else if (governingMode === "COMPOUND") {
      governingCode = "API 579-1 Part 4/5 + Part 9 (Both Required)";
    }

    // ====================================================================
    // RESPONSE
    // ====================================================================

    var result = {
      governing_failure_mode: governingMode,
      governing_failure_pressure: governingPressure,
      governing_severity: governingSeverity,
      governing_basis: governingBasis,
      governing_code_reference: governingCode,
      interaction_flag: interactionFlag,
      interaction_type: interactionType,
      interaction_detail: interactionDetail,
      corrosion_path: corrosionPath,
      cracking_path: crackingPath,
      mechanism_count: {
        total: mechanisms.length,
        corrosion: corrosionMechanisms.length,
        cracking: crackingMechanisms.length,
        other: otherMechanisms.length
      },
      metadata: {
        engine: "failure-mode-dominance",
        version: "1.0",
        timestamp: new Date().toISOString()
      }
    };

    return { statusCode: 200, headers: headers, body: JSON.stringify(result) };

  } catch (err) {
    return { statusCode: 500, headers: headers, body: JSON.stringify({ error: "Failure mode dominance error: " + (err.message || String(err)) }) };
  }
};

module.exports = { handler: handler };
