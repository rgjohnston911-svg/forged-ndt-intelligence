// REMAINING STRENGTH CALCULATOR v1.0
// File: netlify/functions/remaining-strength.js
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

    var nominalWall = parseFloat(body.nominal_wall);
    var measuredMinWall = parseFloat(body.measured_minimum_wall);
    var flawLength = parseFloat(body.flaw_length);
    var pipeOD = parseFloat(body.pipe_od);
    var smys = parseFloat(body.smys);
    var designFactor = parseFloat(body.design_factor);
    var operatingPressure = parseFloat(body.operating_pressure);
    var materialGrade = (body.material_grade || "").toUpperCase().trim();

    var errors = [];

    if (isNaN(nominalWall) || nominalWall <= 0) errors.push("nominal_wall required (inches, > 0)");
    if (isNaN(measuredMinWall) || measuredMinWall <= 0) errors.push("measured_minimum_wall required (inches, > 0)");
    if (isNaN(flawLength) || flawLength <= 0) errors.push("flaw_length required (inches, > 0)");
    if (isNaN(pipeOD) || pipeOD <= 0) errors.push("pipe_od required (inches, > 0)");
    if (isNaN(operatingPressure) || operatingPressure < 0) errors.push("operating_pressure required (psi, >= 0)");

    if (isNaN(smys) || smys <= 0) {
      var smysLookup = {
        "A": 30000, "B": 35000,
        "X42": 42000, "X46": 46000, "X52": 52000, "X56": 56000,
        "X60": 60000, "X65": 65000, "X70": 70000, "X80": 80000,
        "X90": 90000, "X100": 100000, "X120": 120000,
        "GR.B": 35000, "GR B": 35000,
        "GR.X42": 42000, "GR.X52": 52000, "GR.X60": 60000,
        "GR.X65": 65000, "GR.X70": 70000
      };
      smys = smysLookup[materialGrade] || 0;
      if (smys === 0) {
        errors.push("smys required (psi) or valid material_grade (e.g. X52, X65, B)");
      }
    }

    if (isNaN(designFactor) || designFactor <= 0 || designFactor > 1.0) {
      designFactor = 0.72;
    }

    if (errors.length > 0) {
      return { statusCode: 400, headers: headers, body: JSON.stringify({ error: "Validation failed", details: errors }) };
    }

    var wallLoss = nominalWall - measuredMinWall;
    var wallLossPercent = (wallLoss / nominalWall) * 100;
    var depthRatio = wallLoss / nominalWall;
    var z = (flawLength * flawLength) / (pipeOD * nominalWall);

    // ORIGINAL B31G
    var M_b31g;
    if (z <= 20) {
      M_b31g = Math.sqrt(1 + 0.8 * z);
    } else {
      M_b31g = 0.032 * z + 3.3;
    }

    var areaRatio_b31g = (2.0 / 3.0) * depthRatio;
    var rsf_b31g;
    if (areaRatio_b31g >= 1.0) {
      rsf_b31g = 0;
    } else {
      rsf_b31g = (1.0 - areaRatio_b31g) / (1.0 - (areaRatio_b31g / M_b31g));
    }
    if (rsf_b31g < 0) rsf_b31g = 0;
    if (rsf_b31g > 1) rsf_b31g = 1;

    var barlow_pressure = (2 * smys * nominalWall * designFactor) / pipeOD;
    var maop_b31g = barlow_pressure * rsf_b31g;

    // MODIFIED B31G
    var sqrtArg = 1 + 0.6275 * z - 0.003375 * z * z;
    var M_mod;
    if (sqrtArg > 0 && z <= 50) {
      M_mod = Math.sqrt(sqrtArg);
    } else {
      M_mod = 0.032 * z + 3.3;
    }

    var areaRatio_mod = 0.85 * depthRatio;
    var rsf_mod;
    if (areaRatio_mod >= 1.0) {
      rsf_mod = 0;
    } else {
      rsf_mod = (1.0 - areaRatio_mod) / (1.0 - (areaRatio_mod / M_mod));
    }
    if (rsf_mod < 0) rsf_mod = 0;
    if (rsf_mod > 1) rsf_mod = 1;

    var maop_mod = barlow_pressure * rsf_mod;

    // SAFE ENVELOPE
    var governing_maop = Math.min(maop_b31g, maop_mod);
    var governing_method = maop_b31g <= maop_mod ? "B31G_ORIGINAL" : "MODIFIED_B31G";
    var operatingRatio = operatingPressure / governing_maop;

    var safeEnvelope;
    var recommendation = "";
    var pressureReduction = 0;

    if (operatingRatio <= 0.80) {
      safeEnvelope = "WITHIN";
      recommendation = "Operating pressure is within safe envelope (" + (operatingRatio * 100).toFixed(1) + "% of MAOP). Continue monitoring per inspection interval.";
    } else if (operatingRatio <= 1.00) {
      safeEnvelope = "MARGINAL";
      var targetPressure = governing_maop * 0.80;
      pressureReduction = operatingPressure - targetPressure;
      recommendation = "Operating pressure is MARGINAL (" + (operatingRatio * 100).toFixed(1) + "% of MAOP). Recommend pressure reduction of " + pressureReduction.toFixed(0) + " psi to achieve 80% safe operating margin, or expedited engineering assessment per API 579-1.";
    } else {
      safeEnvelope = "EXCEEDS";
      var targetPressureSafe = governing_maop * 0.80;
      pressureReduction = operatingPressure - targetPressureSafe;
      recommendation = "CRITICAL: Operating pressure EXCEEDS calculated MAOP (" + (operatingRatio * 100).toFixed(1) + "%). IMMEDIATE pressure reduction of " + pressureReduction.toFixed(0) + " psi required. Mandatory engineering assessment per API 579-1 before resuming normal operations.";
    }

    var notes = [];
    if (wallLossPercent > 80) notes.push("CRITICAL: Wall loss exceeds 80%.");
    else if (wallLossPercent > 60) notes.push("SEVERE: Wall loss exceeds 60%.");
    else if (wallLossPercent > 40) notes.push("SIGNIFICANT: Wall loss exceeds 40%.");
    if (depthRatio > 0.8) notes.push("Flaw depth exceeds 80% of wall - B31G equations approach limits.");
    if (flawLength > Math.sqrt(20 * pipeOD * nominalWall)) notes.push("Flaw length exceeds B31G short-flaw assumption. Consider RSTRENG effective area method.");
    notes.push("B31G methods assume general/local metal loss. NOT applicable to crack-like flaws.");
    notes.push("Results are Level 1 screening. Level 2/3 per API 579-1 may yield less conservative results.");

    var result = {
      maop_b31g: Math.round(maop_b31g),
      maop_modified_b31g: Math.round(maop_mod),
      governing_maop: Math.round(governing_maop),
      governing_method: governing_method,
      barlow_design_pressure: Math.round(barlow_pressure),
      operating_pressure: operatingPressure,
      operating_ratio: parseFloat(operatingRatio.toFixed(4)),
      safe_envelope: safeEnvelope,
      recommendation: recommendation,
      pressure_reduction_required: pressureReduction > 0 ? Math.round(pressureReduction) : 0,
      calculations: {
        wall_loss_inches: parseFloat(wallLoss.toFixed(4)),
        wall_loss_percent: parseFloat(wallLossPercent.toFixed(2)),
        depth_ratio: parseFloat(depthRatio.toFixed(4)),
        d_over_t: parseFloat((pipeOD / nominalWall).toFixed(2)),
        folias_z: parseFloat(z.toFixed(4)),
        b31g_folias_factor: parseFloat(M_b31g.toFixed(4)),
        b31g_rsf: parseFloat(rsf_b31g.toFixed(4)),
        modified_folias_factor: parseFloat(M_mod.toFixed(4)),
        modified_rsf: parseFloat(rsf_mod.toFixed(4))
      },
      inputs: {
        nominal_wall: nominalWall,
        measured_minimum_wall: measuredMinWall,
        flaw_length: flawLength,
        pipe_od: pipeOD,
        smys: smys,
        material_grade: materialGrade || "custom",
        design_factor: designFactor,
        operating_pressure: operatingPressure
      },
      notes: notes,
      metadata: {
        engine: "remaining-strength",
        version: "1.0",
        method: "B31G + Modified B31G (RSTRENG Simplified)",
        level: "Level 1 Screening",
        timestamp: new Date().toISOString()
      }
    };

    return { statusCode: 200, headers: headers, body: JSON.stringify(result) };

  } catch (err) {
    return { statusCode: 500, headers: headers, body: JSON.stringify({ error: "Remaining strength calculation error: " + (err.message || String(err)) }) };
  }
};

module.exports = { handler: handler };
