// REMAINING STRENGTH CALCULATOR v1.1
// File: netlify/functions/remaining-strength.js
// NO TYPESCRIPT -- PURE JAVASCRIPT
//
// v1.1: PARTIAL DATA PATH -- engine no longer returns HTTP 400 when inputs
//       are incomplete. Instead, it derives missing inputs from whatever is
//       available and reports data_quality tier. Four tiers:
//
//         TIER A "complete"              -- all inputs provided, full B31G
//         TIER B "schedule_derived"      -- NPS + wall_loss_percent + material;
//                                          derives nominal_wall from NPS STD
//                                          wall table, OD from NPS table,
//                                          measured_min_wall from wall_loss_pct,
//                                          flaw_length assumed infinite
//                                          (most conservative). MAOP computed.
//         TIER C "no_pressure"           -- same as B but operating_pressure
//                                          absent; MAOP returned, operating
//                                          ratio and safe_envelope = "UNKNOWN"
//         TIER D "qualitative"           -- only wall_loss_percent available;
//                                          returns severity band, no MAOP,
//                                          governing_maop = null
//
//       Key design: FMD reads rsr.governing_maop. If it's a number, FMD
//       treats corrosion path as quantified. If null, FMD falls back to
//       wall_loss severity logic. Both paths now work correctly downstream.
//
//       Also adds NPS->OD table, NPS->STD wall table, expanded SMYS lookup
//       (A106 Gr B/A/C, A53, A333, A516, carbon_steel category default).
//       Accepts alternate input field names (diameter_inches for pipe_od,
//       pressure_psi for operating_pressure, material for material_grade,
//       wall_loss_percent as direct input).
//
//       Always returns 200 unless a crash. Caller should null-check
//       rsr.governing_maop rather than rsr itself.
//
// v1.0: Initial B31G + Modified B31G (RSTRENG Simplified) Level 1 screening.

// ============================================================================
// LOOKUP TABLES
// ============================================================================

// NPS -> OD (inches). For NPS >= 14, NPS == OD.
var NPS_OD_TABLE = {
  "0.5": 0.840, "0.75": 1.050, "1": 1.315, "1.25": 1.660, "1.5": 1.900,
  "2": 2.375, "2.5": 2.875, "3": 3.500, "3.5": 4.000, "4": 4.500,
  "5": 5.563, "6": 6.625, "8": 8.625, "10": 10.750, "12": 12.750,
  "14": 14.000, "16": 16.000, "18": 18.000, "20": 20.000, "22": 22.000,
  "24": 24.000, "26": 26.000, "28": 28.000, "30": 30.000, "32": 32.000,
  "34": 34.000, "36": 36.000, "42": 42.000, "48": 48.000
};

// NPS -> Standard (STD) wall thickness (inches). Caps at 0.375" for NPS >= 12.
// This is the most common schedule for process piping in refineries.
var NPS_STD_WALL_TABLE = {
  "0.5": 0.109, "0.75": 0.113, "1": 0.133, "1.25": 0.140, "1.5": 0.145,
  "2": 0.154, "2.5": 0.203, "3": 0.216, "3.5": 0.226, "4": 0.237,
  "5": 0.258, "6": 0.280, "8": 0.322, "10": 0.365, "12": 0.375,
  "14": 0.375, "16": 0.375, "18": 0.375, "20": 0.375, "22": 0.375,
  "24": 0.375, "26": 0.375, "28": 0.375, "30": 0.375, "32": 0.375,
  "34": 0.375, "36": 0.375, "42": 0.375, "48": 0.375
};

// Material grade -> SMYS (psi). Expanded from v1.0 to include common
// refinery/pipeline grades and category fallbacks from grammar bridge.
var SMYS_LOOKUP = {
  // API 5L line pipe grades
  "A": 30000, "B": 35000,
  "X42": 42000, "X46": 46000, "X52": 52000, "X56": 56000,
  "X60": 60000, "X65": 65000, "X70": 70000, "X80": 80000,
  "X90": 90000, "X100": 100000, "X120": 120000,
  "GR.B": 35000, "GR B": 35000, "GRADE B": 35000,
  "GR.A": 30000, "GR A": 30000, "GRADE A": 30000,
  "GR.C": 40000, "GR C": 40000, "GRADE C": 40000,
  "GR.X42": 42000, "GR.X52": 52000, "GR.X60": 60000,
  "GR.X65": 65000, "GR.X70": 70000,

  // ASTM carbon steel pipe grades
  "A106": 35000, "A106_GR_B": 35000, "A106 GR B": 35000, "A106-B": 35000,
  "A106_GR_A": 30000, "A106_GR_C": 40000,
  "A53": 30000, "A53_GR_B": 35000, "A53 GR B": 35000,
  "A333": 35000, "A333_GR_6": 35000,

  // ASTM plate/vessel grades
  "A516": 38000, "A516_GR_70": 38000, "A516-70": 38000,
  "A516_GR_65": 35000, "A516_GR_60": 32000, "A515_GR_70": 38000,
  "A105": 36000,

  // Alloy steel (chrome-moly) lower-bound
  "P11": 30000, "P22": 30000, "P5": 30000, "P9": 30000, "P91": 60000,
  "1.25CR": 30000, "2.25CR": 30000, "5CR": 30000, "9CR": 60000,

  // Austenitic stainless conservative defaults
  "304": 30000, "304L": 25000, "316": 30000, "316L": 25000,
  "321": 30000, "347": 30000,

  // Duplex
  "2205": 65000, "2507": 80000,

  // CATEGORY FALLBACKS (from grammar bridge material categories)
  // Conservative defaults used when specific grade not identified.
  "CARBON_STEEL": 35000,        // assumes A106 Gr B
  "ALLOY_STEEL": 30000,          // conservative chrome-moly lower bound
  "STAINLESS_STEEL": 30000,      // conservative 304/316 SMYS
  "DUPLEX": 65000,               // 2205
  "NICKEL_ALLOY": 35000,         // conservative Inconel/Monel lower bound
  "CAST_IRON": 20000,            // very conservative
  "COPPER_ALLOY": 12000          // very conservative
};

// Severity bands for qualitative-only tier
var SEVERITY_BANDS = [
  { max: 20, tier: "LOW",       note: "Wall loss within normal monitoring band. No immediate action required." },
  { max: 40, tier: "MODERATE",  note: "Wall loss exceeds 20% -- trending and inspection interval review recommended." },
  { max: 60, tier: "HIGH",      note: "Wall loss exceeds 40% -- Level 1 API 579-1 screening required. Engineering assessment recommended." },
  { max: 80, tier: "SEVERE",    note: "Wall loss exceeds 60% -- significant section loss. Level 2 API 579-1 assessment and pressure reduction evaluation required." },
  { max: 100, tier: "CRITICAL", note: "Wall loss exceeds 80% -- imminent failure risk. Immediate pressure reduction or shutdown required pending engineering assessment." }
];

// ============================================================================
// LOOKUP HELPERS
// ============================================================================

function lookupNPS(diameter) {
  // Returns { od, std_wall, nps_label } or null if no match.
  if (diameter === null || diameter === undefined || isNaN(diameter)) return null;

  // Direct key match first
  var keys = ["0.5", "0.75", "1", "1.25", "1.5", "2", "2.5", "3", "3.5", "4",
              "5", "6", "8", "10", "12", "14", "16", "18", "20", "22",
              "24", "26", "28", "30", "32", "34", "36", "42", "48"];
  var dstr = String(diameter);
  if (NPS_OD_TABLE.hasOwnProperty(dstr)) {
    return { od: NPS_OD_TABLE[dstr], std_wall: NPS_STD_WALL_TABLE[dstr], nps_label: "NPS " + dstr };
  }

  // Nearest match (within 0.5 inch tolerance)
  var bestKey = null;
  var bestDiff = 999;
  for (var i = 0; i < keys.length; i++) {
    var k = parseFloat(keys[i]);
    var diff = Math.abs(k - diameter);
    if (diff < bestDiff) { bestDiff = diff; bestKey = keys[i]; }
  }
  if (bestDiff <= 0.5) {
    return { od: NPS_OD_TABLE[bestKey], std_wall: NPS_STD_WALL_TABLE[bestKey], nps_label: "NPS " + bestKey + " (nearest)" };
  }

  return null;
}

function lookupSMYS(materialGrade) {
  if (!materialGrade) return 0;
  var key = String(materialGrade).toUpperCase().trim();
  // Try direct match
  if (SMYS_LOOKUP.hasOwnProperty(key)) return SMYS_LOOKUP[key];
  // Try normalized variants
  var normalized = key.replace(/[\s\-_\.]/g, "");
  for (var k in SMYS_LOOKUP) {
    if (!SMYS_LOOKUP.hasOwnProperty(k)) continue;
    var kn = k.replace(/[\s\-_\.]/g, "");
    if (kn === normalized) return SMYS_LOOKUP[k];
  }
  return 0;
}

function qualitativeSeverity(wallLossPercent) {
  for (var i = 0; i < SEVERITY_BANDS.length; i++) {
    if (wallLossPercent <= SEVERITY_BANDS[i].max) return SEVERITY_BANDS[i];
  }
  return SEVERITY_BANDS[SEVERITY_BANDS.length - 1];
}

// ============================================================================
// HANDLER
// ============================================================================

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

    // --------------------------------------------------------------------
    // v1.1: ACCEPT ALTERNATE INPUT FIELD NAMES
    // --------------------------------------------------------------------
    var nominalWall = parseFloat(body.nominal_wall);
    var measuredMinWall = parseFloat(body.measured_minimum_wall);
    var flawLength = parseFloat(body.flaw_length);
    var pipeOD = parseFloat(body.pipe_od);
    var smys = parseFloat(body.smys);
    var designFactor = parseFloat(body.design_factor);
    var operatingPressure = parseFloat(body.operating_pressure);
    var materialGrade = (body.material_grade || body.material || "").toUpperCase().trim();

    // v1.1 alternate inputs
    var diameterInches = parseFloat(body.diameter_inches);
    var wallLossPercentInput = parseFloat(body.wall_loss_percent);
    var pressurePsiAlt = parseFloat(body.pressure_psi);

    if (isNaN(operatingPressure) && !isNaN(pressurePsiAlt)) operatingPressure = pressurePsiAlt;
    if (isNaN(pipeOD) && !isNaN(diameterInches)) {
      // Will try NPS lookup below
    }

    if (isNaN(designFactor) || designFactor <= 0 || designFactor > 1.0) {
      designFactor = 0.72;
    }

    var derivationNotes = [];
    var inputsDerived = {};

    // --------------------------------------------------------------------
    // v1.1: DERIVATION PHASE -- try to derive missing inputs from partial data
    // --------------------------------------------------------------------

    // 1. OD from NPS lookup if missing
    if ((isNaN(pipeOD) || pipeOD <= 0) && !isNaN(diameterInches) && diameterInches > 0) {
      var nps = lookupNPS(diameterInches);
      if (nps) {
        pipeOD = nps.od;
        derivationNotes.push("pipe_od derived from " + nps.nps_label + " = " + nps.od + " in");
        inputsDerived.pipe_od_source = nps.nps_label;
      } else {
        // Fallback: for large diameters >= 14", NPS = OD
        if (diameterInches >= 14) {
          pipeOD = diameterInches;
          derivationNotes.push("pipe_od assumed = nominal diameter " + diameterInches + " in (NPS >= 14 rule)");
          inputsDerived.pipe_od_source = "nps_equals_od_rule";
        }
      }
    }

    // 2. Nominal wall from NPS STD lookup if missing
    if ((isNaN(nominalWall) || nominalWall <= 0) && !isNaN(diameterInches) && diameterInches > 0) {
      var nps2 = lookupNPS(diameterInches);
      if (nps2 && nps2.std_wall) {
        nominalWall = nps2.std_wall;
        derivationNotes.push("nominal_wall assumed as " + nps2.nps_label + " STD = " + nps2.std_wall + " in. If actual schedule differs, provide nominal_wall explicitly for accurate assessment.");
        inputsDerived.nominal_wall_source = nps2.nps_label + "_STD_schedule_assumption";
      }
    }

    // 3. SMYS from material grade/category if missing
    if ((isNaN(smys) || smys <= 0) && materialGrade) {
      var lookedUp = lookupSMYS(materialGrade);
      if (lookedUp > 0) {
        smys = lookedUp;
        derivationNotes.push("smys derived from material " + materialGrade + " = " + smys + " psi");
        inputsDerived.smys_source = materialGrade + "_lookup";
      }
    }

    // 4. Measured minimum wall from wall_loss_percent + nominal_wall if missing
    if ((isNaN(measuredMinWall) || measuredMinWall <= 0) && !isNaN(wallLossPercentInput) && wallLossPercentInput > 0 && !isNaN(nominalWall) && nominalWall > 0) {
      measuredMinWall = nominalWall * (1 - wallLossPercentInput / 100);
      derivationNotes.push("measured_minimum_wall derived from wall_loss_percent " + wallLossPercentInput + "% applied to nominal " + nominalWall.toFixed(3) + " in = " + measuredMinWall.toFixed(4) + " in");
      inputsDerived.measured_minimum_wall_source = "wall_loss_percent_applied_to_nominal";
    }

    // 5. Flaw length -- if not provided, use infinite-length conservative assumption
    //    (z >= 50 drives Folias factor to large values, RSF approaches (1 - 0.85*d/t))
    var flawLengthAssumedInfinite = false;
    if (isNaN(flawLength) || flawLength <= 0) {
      if (!isNaN(pipeOD) && pipeOD > 0 && !isNaN(nominalWall) && nominalWall > 0) {
        flawLength = 4 * Math.sqrt(20 * pipeOD * nominalWall);
        flawLengthAssumedInfinite = true;
        derivationNotes.push("flaw_length not provided -- using conservative infinite-length assumption (z > 50). This produces the MOST CONSERVATIVE MAOP for the given depth ratio. Provide actual flaw length for less conservative assessment.");
        inputsDerived.flaw_length_source = "infinite_length_conservative_assumption";
      }
    }

    // --------------------------------------------------------------------
    // v1.1: DETERMINE DATA QUALITY TIER
    // --------------------------------------------------------------------

    var haveFullCompute =
      !isNaN(nominalWall) && nominalWall > 0 &&
      !isNaN(measuredMinWall) && measuredMinWall > 0 &&
      !isNaN(flawLength) && flawLength > 0 &&
      !isNaN(pipeOD) && pipeOD > 0 &&
      !isNaN(smys) && smys > 0;

    var havePressure = !isNaN(operatingPressure) && operatingPressure >= 0;

    var haveWallLossOnly =
      !isNaN(wallLossPercentInput) && wallLossPercentInput > 0;

    // --------------------------------------------------------------------
    // TIER D: QUALITATIVE ONLY (no MAOP computation possible)
    // --------------------------------------------------------------------
    if (!haveFullCompute && haveWallLossOnly) {
      var band = qualitativeSeverity(wallLossPercentInput);
      var qualResult = {
        data_quality: "qualitative",
        governing_maop: null,
        governing_method: "none",
        operating_pressure: havePressure ? operatingPressure : null,
        operating_ratio: null,
        safe_envelope: "UNKNOWN",
        severity_tier: band.tier,
        recommendation: band.note + " (Qualitative assessment only -- insufficient data for quantified remaining strength computation.)",
        pressure_reduction_required: 0,
        calculations: {
          wall_loss_percent: wallLossPercentInput,
          depth_ratio: parseFloat((wallLossPercentInput / 100).toFixed(4))
        },
        inputs: {
          nominal_wall: isNaN(nominalWall) ? null : nominalWall,
          measured_minimum_wall: isNaN(measuredMinWall) ? null : measuredMinWall,
          flaw_length: isNaN(flawLength) ? null : flawLength,
          pipe_od: isNaN(pipeOD) ? null : pipeOD,
          smys: isNaN(smys) ? null : smys,
          material_grade: materialGrade || "unknown",
          design_factor: designFactor,
          operating_pressure: havePressure ? operatingPressure : null,
          wall_loss_percent: wallLossPercentInput
        },
        inputs_derived: inputsDerived,
        derivation_notes: derivationNotes,
        notes: [
          "QUALITATIVE TIER: Only wall loss percentage available.",
          "Cannot compute B31G MAOP without diameter, schedule, and material data.",
          "Recommendation: provide diameter_inches + material_grade to enable schedule-derived MAOP computation.",
          band.note
        ],
        metadata: {
          engine: "remaining-strength",
          version: "1.1",
          method: "Qualitative severity band (no MAOP computation)",
          level: "Pre-screening",
          timestamp: new Date().toISOString()
        }
      };
      return { statusCode: 200, headers: headers, body: JSON.stringify(qualResult) };
    }

    // --------------------------------------------------------------------
    // NO-COMPUTE: NOT ENOUGH DATA FOR ANY TIER
    // --------------------------------------------------------------------
    if (!haveFullCompute && !haveWallLossOnly) {
      var emptyResult = {
        data_quality: "insufficient",
        governing_maop: null,
        governing_method: "none",
        safe_envelope: "UNKNOWN",
        severity_tier: "UNKNOWN",
        recommendation: "Insufficient data for any remaining strength assessment. Minimum required: (a) wall_loss_percent + diameter_inches + material_grade, OR (b) nominal_wall + measured_minimum_wall + pipe_od + smys + flaw_length.",
        inputs: {
          nominal_wall: isNaN(nominalWall) ? null : nominalWall,
          measured_minimum_wall: isNaN(measuredMinWall) ? null : measuredMinWall,
          pipe_od: isNaN(pipeOD) ? null : pipeOD,
          smys: isNaN(smys) ? null : smys,
          operating_pressure: havePressure ? operatingPressure : null
        },
        inputs_derived: inputsDerived,
        derivation_notes: derivationNotes,
        notes: ["No assessment possible -- engine returned empty result rather than error so downstream can render 'data required' message."],
        metadata: {
          engine: "remaining-strength",
          version: "1.1",
          method: "none",
          level: "none",
          timestamp: new Date().toISOString()
        }
      };
      return { statusCode: 200, headers: headers, body: JSON.stringify(emptyResult) };
    }

    // --------------------------------------------------------------------
    // TIER A/B/C: B31G + MODIFIED B31G COMPUTATION
    // --------------------------------------------------------------------

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

    // SAFE ENVELOPE (only if we have operating pressure)
    var governing_maop = Math.min(maop_b31g, maop_mod);
    var governing_method = maop_b31g <= maop_mod ? "B31G_ORIGINAL" : "MODIFIED_B31G";

    var safeEnvelope = "UNKNOWN";
    var recommendation = "";
    var pressureReduction = 0;
    var operatingRatio = null;

    if (havePressure) {
      operatingRatio = operatingPressure / governing_maop;
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
    } else {
      recommendation = "MAOP calculated: " + Math.round(governing_maop) + " psi (" + governing_method + "). Operating pressure not provided -- provide actual operating pressure for safe envelope assessment.";
    }

    // Determine data_quality tier
    var dataQuality = "complete";
    if (derivationNotes.length > 0 && havePressure) dataQuality = "schedule_derived";
    if (derivationNotes.length > 0 && !havePressure) dataQuality = "no_pressure";
    if (!havePressure && derivationNotes.length === 0) dataQuality = "no_pressure";

    var notes = [];
    if (wallLossPercent > 80) notes.push("CRITICAL: Wall loss exceeds 80%.");
    else if (wallLossPercent > 60) notes.push("SEVERE: Wall loss exceeds 60%.");
    else if (wallLossPercent > 40) notes.push("SIGNIFICANT: Wall loss exceeds 40%.");
    if (depthRatio > 0.8) notes.push("Flaw depth exceeds 80% of wall -- B31G equations approach limits.");
    if (flawLength > Math.sqrt(20 * pipeOD * nominalWall) && !flawLengthAssumedInfinite) notes.push("Flaw length exceeds B31G short-flaw assumption. Consider RSTRENG effective area method.");
    if (flawLengthAssumedInfinite) notes.push("Flaw length assumed infinite (conservative). MAOP shown is the lower bound -- actual MAOP may be higher with measured flaw length.");
    notes.push("B31G methods assume general/local metal loss. NOT applicable to crack-like flaws.");
    notes.push("Results are Level 1 screening. Level 2/3 per API 579-1 may yield less conservative results.");
    if (dataQuality !== "complete") {
      notes.push("Data quality: " + dataQuality + ". Inputs were partially derived from grammar bridge output and lookup tables. See derivation_notes for details.");
    }

    // Severity tier label for downstream consumption
    var severityTier = qualitativeSeverity(wallLossPercent).tier;

    var result = {
      data_quality: dataQuality,
      maop_b31g: Math.round(maop_b31g),
      maop_modified_b31g: Math.round(maop_mod),
      governing_maop: Math.round(governing_maop),
      governing_method: governing_method,
      barlow_design_pressure: Math.round(barlow_pressure),
      operating_pressure: havePressure ? operatingPressure : null,
      operating_ratio: operatingRatio !== null ? parseFloat(operatingRatio.toFixed(4)) : null,
      safe_envelope: safeEnvelope,
      severity_tier: severityTier,
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
        operating_pressure: havePressure ? operatingPressure : null
      },
      inputs_derived: inputsDerived,
      derivation_notes: derivationNotes,
      notes: notes,
      metadata: {
        engine: "remaining-strength",
        version: "1.1",
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
