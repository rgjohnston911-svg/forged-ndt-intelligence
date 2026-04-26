// @ts-nocheck
var Handler = require("@netlify/functions").Handler;
var createClient = require("@supabase/supabase-js").createClient;

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_ANON_KEY || "";
var supabase = createClient(supabaseUrl, supabaseKey);

var handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ error: "POST only" })
    };
  }

  if (event.headers["origin"]) {
    var origin = event.headers["origin"];
  }

  var body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": origin || "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ error: "Invalid JSON" })
    };
  }

  var action = body.action || "";
  var params = body.params || {};
  var assetId = body.asset_id || "";
  var timestamp = new Date().toISOString();

  var result = {};

  if (action === "assess_ssc") {
    result = assessSSC(params);
  } else if (action === "assess_hic") {
    result = assessHIC(params);
  } else if (action === "assess_sohic") {
    result = assessSOHIC(params);
  } else if (action === "assess_co2_corrosion") {
    result = assessCO2Corrosion(params);
  } else if (action === "assess_material_suitability") {
    result = assessMaterialSuitability(params);
  } else if (action === "assess_corrosion_allowance") {
    result = assessCorrosionAllowance(params);
  } else if (action === "assess_combined") {
    result = assessCombined(params);
  } else if (action === "get_nace_region") {
    result = getNACERegion(params);
  } else {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": origin || "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ error: "Unknown action: " + action })
    };
  }

  if (assetId) {
    try {
      var dbRecord = {
        asset_id: assetId,
        action: action,
        result: result,
        created_at: timestamp
      };
      var insertRes = await supabase
        .from("sour_service_assessments")
        .insert([dbRecord]);
      if (insertRes.error) {
        console.error("DB insert error: " + JSON.stringify(insertRes.error));
      }
    } catch (dbErr) {
      console.error("DB write exception: " + String(dbErr));
    }
  }

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(result)
  };
};

function assessSSC(params) {
  var hardnessHRC = params.hardness_hrc || 0;
  var h2sPressure = params.h2s_pressure || 0;
  var temperature = params.temperature_c || 0;
  var pH = params.ph || 7;
  var materialGrade = params.material_grade || "carbon_steel";

  var sscRegion = 0;
  var susceptibility = "immune";

  if (h2sPressure >= 0.05 && hardnessHRC > 22) {
    if (h2sPressure >= 1.0) {
      sscRegion = 1;
    } else if (h2sPressure >= 0.3) {
      sscRegion = 2;
    } else {
      sscRegion = 3;
    }
    susceptibility = "high";
  } else if (h2sPressure >= 0.05 && hardnessHRC <= 22) {
    if (h2sPressure >= 1.0) {
      sscRegion = 1;
      susceptibility = "medium";
    } else if (h2sPressure >= 0.3) {
      sscRegion = 2;
      susceptibility = "medium";
    } else {
      sscRegion = 3;
      susceptibility = "low";
    }
  } else if (h2sPressure > 0 && h2sPressure < 0.05) {
    sscRegion = 3;
    susceptibility = "low";
  } else {
    sscRegion = 0;
    susceptibility = "immune";
  }

  var hardnessOK = hardnessHRC <= 22;
  var temperatureAllowance = 1.0;
  if (temperature > 60) {
    temperatureAllowance = 0.9;
  }
  if (temperature > 100) {
    temperatureAllowance = 0.7;
  }

  var pHFactor = 1.0;
  if (pH < 4) {
    pHFactor = 1.3;
  }
  if (pH > 8) {
    pHFactor = 0.8;
  }

  var acceptanceStatus = "CONDITIONAL";
  if (susceptibility === "immune") {
    acceptanceStatus = "ACCEPTED";
  } else if (susceptibility === "high" && !hardnessOK) {
    acceptanceStatus = "REJECTED";
  }

  var recommendations = [];
  if (!hardnessOK) {
    recommendations.push("Reduce hardness to <= 22 HRC per NACE MR0175");
  }
  if (susceptibility === "high") {
    recommendations.push("Consider PWHT or stress relief");
  }
  if (pH < 5) {
    recommendations.push("Monitor pH; maintain pH >= 5 in bulk fluid");
  }

  return {
    deterministic: {
      h2s_partial_pressure_bar: h2sPressure,
      hardness_hrc: hardnessHRC,
      temperature_c: temperature,
      ph: pH,
      ssc_region: sscRegion,
      hardness_compliant: hardnessOK,
      temperature_allowance: temperatureAllowance,
      ph_factor: pHFactor
    },
    interpreted: {
      susceptibility: susceptibility,
      risk_level: susceptibility === "immune" ? "NONE" : (susceptibility === "high" ? "CRITICAL" : "MODERATE"),
      acceptance_status: acceptanceStatus,
      recommended_actions: recommendations
    },
    provenance: {
      engine: "NACE_MR0175_SSC_v1",
      version: "1.0",
      deploy: "DEPLOY346",
      standards: ["NACE MR0175/ISO 15156 Part 1", "NACE MR0175/ISO 15156 Part 2"],
      timestamp: new Date().toISOString(),
      calculation_method: "Hardness/H2S/Temperature matrix per NACE MR0175"
    }
  };
}

function assessHIC(params) {
  var h2sPressure = params.h2s_pressure || 0;
  var carbonEquivalent = params.carbon_equivalent || 0;
  var clrThreshold = params.clr_threshold || 0;
  var ctrThreshold = params.ctr_threshold || 0;
  var steelCleanliness = params.steel_cleanliness || "clean";
  var rollingDirection = params.rolling_direction || "longitudinal";

  var ceCompliant = carbonEquivalent < 0.43;
  var hicSusceptible = false;
  var riskLevel = "LOW";

  if (h2sPressure >= 0.3 && !ceCompliant) {
    hicSusceptible = true;
    riskLevel = "HIGH";
  } else if (h2sPressure >= 0.3 && ceCompliant) {
    riskLevel = "MODERATE";
  }

  var clrStatus = "PASS";
  if (clrThreshold > 5) {
    clrStatus = "FAIL";
    hicSusceptible = true;
    riskLevel = "CRITICAL";
  }

  var ctrStatus = "PASS";
  if (ctrThreshold > 15) {
    ctrStatus = "FAIL";
    hicSusceptible = true;
    riskLevel = "CRITICAL";
  }

  var cleanlinessScore = 0;
  if (steelCleanliness === "clean") {
    cleanlinessScore = 1.0;
  } else if (steelCleanliness === "moderate") {
    cleanlinessScore = 0.7;
  } else {
    cleanlinessScore = 0.4;
  }

  var transverseVulnerability = 0.8;
  if (rollingDirection === "transverse") {
    transverseVulnerability = 1.3;
  }

  var acceptanceStatus = "ACCEPTED";
  if (hicSusceptible) {
    acceptanceStatus = "REJECTED";
  }

  var recommendations = [];
  if (!ceCompliant) {
    recommendations.push("Carbon equivalent exceeds 0.43; review microalloying");
  }
  if (clrStatus === "FAIL") {
    recommendations.push("CLR exceeds 5%; perform additional metallurgical work or stress relief");
  }
  if (ctrStatus === "FAIL") {
    recommendations.push("CTR exceeds 15%; examine through-wall cracking progression");
  }
  if (steelCleanliness !== "clean") {
    recommendations.push("Improve steel cleanliness via vacuum degassing or ESR");
  }
  if (rollingDirection === "transverse") {
    recommendations.push("Avoid transverse loading through the thickness; verify stress state");
  }

  return {
    deterministic: {
      h2s_partial_pressure_bar: h2sPressure,
      carbon_equivalent: carbonEquivalent,
      ce_compliant: ceCompliant,
      clr_percent: clrThreshold,
      clr_status: clrStatus,
      ctr_percent: ctrThreshold,
      ctr_status: ctrStatus,
      steel_cleanliness: steelCleanliness,
      cleanliness_score: cleanlinessScore,
      rolling_direction: rollingDirection,
      transverse_vulnerability_factor: transverseVulnerability
    },
    interpreted: {
      hic_susceptible: hicSusceptible,
      risk_level: riskLevel,
      acceptance_status: acceptanceStatus,
      recommended_actions: recommendations
    },
    provenance: {
      engine: "NACE_TM0284_HIC_v1",
      version: "1.0",
      deploy: "DEPLOY346",
      standards: ["NACE TM0284-2016", "NACE MR0175/ISO 15156 Part 2", "NACE TM0298"],
      timestamp: new Date().toISOString(),
      calculation_method: "HIC threshold assessment: CLR, CTR, CE, steelCleanliness per NACE TM0284"
    }
  };
}

function assessSOHIC(params) {
  var h2sPressure = params.h2s_pressure || 0;
  var carbonEquivalent = params.carbon_equivalent || 0;
  var residualStress = params.residual_stress_percent || 0;
  var pwhtApplied = params.pwht_applied || false;
  var pwhtTemperature = params.pwht_temperature_c || 0;
  var triaxialStressIndex = params.triaxial_stress_index || 0;
  var clrThreshold = params.clr_threshold || 0;

  var baseHICRisk = 0;
  if (h2sPressure >= 0.3 && carbonEquivalent >= 0.43) {
    baseHICRisk = 0.8;
  } else if (h2sPressure >= 0.3) {
    baseHICRisk = 0.4;
  } else {
    baseHICRisk = 0.1;
  }

  var stressMultiplier = 1.0;
  if (residualStress > 50) {
    stressMultiplier = 1.5;
  } else if (residualStress > 30) {
    stressMultiplier = 1.2;
  }

  var triaxialMultiplier = 1.0 + (triaxialStressIndex * 0.3);

  var pwhtReliability = 0;
  if (pwhtApplied) {
    if (pwhtTemperature >= 600 && pwhtTemperature <= 750) {
      pwhtReliability = 0.7;
    } else if (pwhtTemperature < 600) {
      pwhtReliability = 0.3;
    } else {
      pwhtReliability = 0.5;
    }
  }

  var sohicRisk = baseHICRisk * stressMultiplier * triaxialMultiplier;
  sohicRisk = Math.max(0, sohicRisk - pwhtReliability);

  var sohicSusceptible = sohicRisk > 0.5;
  var riskLevel = "LOW";
  if (sohicRisk > 0.8) {
    riskLevel = "CRITICAL";
  } else if (sohicRisk > 0.5) {
    riskLevel = "HIGH";
  } else if (sohicRisk > 0.2) {
    riskLevel = "MODERATE";
  }

  var acceptanceStatus = "CONDITIONAL";
  if (sohicRisk < 0.2) {
    acceptanceStatus = "ACCEPTED";
  } else if (sohicRisk > 0.7) {
    acceptanceStatus = "REJECTED";
  }

  var recommendations = [];
  if (residualStress > 50) {
    recommendations.push("High residual stress detected; perform stress relief PWHT at 600-750C");
  }
  if (triaxialStressIndex > 1.5) {
    recommendations.push("Severe triaxial stress state near weld; redesign joint geometry or preheat scheme");
  }
  if (!pwhtApplied && baseHICRisk > 0.5) {
    recommendations.push("PWHT mandatory for high HIC/SOHIC risk; apply 600-750C hold");
  }
  if (pwhtApplied && pwhtTemperature < 600) {
    recommendations.push("PWHT temperature below optimal range; increase to 600-750C if feasible");
  }
  if (clrThreshold > 5) {
    recommendations.push("CLR exceeds 5%; evaluate through-wall cracking propagation");
  }

  return {
    deterministic: {
      h2s_partial_pressure_bar: h2sPressure,
      carbon_equivalent: carbonEquivalent,
      residual_stress_percent: residualStress,
      residual_stress_multiplier: stressMultiplier,
      triaxial_stress_index: triaxialStressIndex,
      triaxial_multiplier: triaxialMultiplier,
      pwht_applied: pwhtApplied,
      pwht_temperature_c: pwhtTemperature,
      pwht_reliability: pwhtReliability,
      clr_threshold: clrThreshold,
      base_hic_risk: baseHICRisk,
      sohic_risk_factor: parseFloat(sohicRisk.toFixed(3))
    },
    interpreted: {
      sohic_susceptible: sohicSusceptible,
      risk_level: riskLevel,
      acceptance_status: acceptanceStatus,
      recommended_actions: recommendations
    },
    provenance: {
      engine: "NACE_SOHIC_v1",
      version: "1.0",
      deploy: "DEPLOY346",
      standards: ["NACE MR0175/ISO 15156 Part 2", "NACE TM0284-2016", "API 579-1/ASME FFS-1"],
      timestamp: new Date().toISOString(),
      calculation_method: "Stress-oriented HIC = baseHIC × stressMultiplier × triaxialMultiplier - pwhtReliability"
    }
  };
}

function assessCO2Corrosion(params) {
  var temperature = params.temperature_c || 20;
  var pCO2 = params.pco2_bar || 1;
  var pH = params.ph || 6;
  var flowVelocity = params.flow_velocity_ms || 1;
  var protectiveScale = params.protective_scale || "none";
  var glycolContent = params.glycol_content_percent || 0;

  var tempKelvin = temperature + 273.15;
  var log10pCO2 = Math.log10(pCO2);

  var baseCorrosionRate = Math.pow(10, 5.8 - (1710 / tempKelvin) + (0.67 * log10pCO2));

  var pHFactor = 1.0;
  if (pH >= 5 && pH <= 6) {
    pHFactor = 1.0;
  } else if (pH < 5) {
    pHFactor = Math.pow(10, (7.5 - pH) * 0.15);
  } else if (pH > 6) {
    pHFactor = Math.pow(10, -(pH - 6) * 0.1);
  }

  var scaleFactor = 1.0;
  if (protectiveScale === "feco3_good") {
    scaleFactor = 0.1;
  } else if (protectiveScale === "feco3_moderate") {
    scaleFactor = 0.3;
  } else if (protectiveScale === "feco3_poor") {
    scaleFactor = 0.6;
  }

  var velocityFactor = 1.0;
  if (flowVelocity > 2) {
    velocityFactor = 1.0 + (0.1 * (flowVelocity - 2));
  }

  var glycolFactor = 1.0;
  if (glycolContent > 0) {
    glycolFactor = 1.0 - (glycolContent / 100) * 0.3;
  }

  var corrosionRate = baseCorrosionRate * pHFactor * scaleFactor * velocityFactor * glycolFactor;

  var riskLevel = "LOW";
  if (corrosionRate > 1.0) {
    riskLevel = "CRITICAL";
  } else if (corrosionRate > 0.5) {
    riskLevel = "HIGH";
  } else if (corrosionRate > 0.1) {
    riskLevel = "MODERATE";
  }

  var acceptanceStatus = corrosionRate < 0.5 ? "ACCEPTED" : "CONDITIONAL";
  if (corrosionRate > 1.5) {
    acceptanceStatus = "REJECTED";
  }

  var recommendations = [];
  if (corrosionRate > 0.5) {
    recommendations.push("Corrosion rate elevated; implement inhibitor package or increase wall thickness");
  }
  if (pH < 5.5) {
    recommendations.push("pH below optimal; target 5.5-7.0 via carbonate buffering or pH control");
  }
  if (protectiveScale !== "feco3_good") {
    recommendations.push("Scale protection inadequate; optimize chemistry to promote FeCO3 formation");
  }
  if (flowVelocity > 2) {
    recommendations.push("Flow velocity elevated; consider line sizing or velocity reduction");
  }

  return {
    deterministic: {
      temperature_c: temperature,
      temperature_k: parseFloat(tempKelvin.toFixed(2)),
      pco2_bar: pCO2,
      log10_pco2: parseFloat(log10pCO2.toFixed(3)),
      ph: pH,
      flow_velocity_ms: flowVelocity,
      protective_scale: protectiveScale,
      glycol_content_percent: glycolContent,
      base_corrosion_rate_mm_yr: parseFloat(baseCorrosionRate.toFixed(4)),
      ph_factor: parseFloat(pHFactor.toFixed(3)),
      scale_factor: scaleFactor,
      velocity_factor: parseFloat(velocityFactor.toFixed(3)),
      glycol_factor: parseFloat(glycolFactor.toFixed(3)),
      combined_corrosion_rate_mm_yr: parseFloat(corrosionRate.toFixed(4))
    },
    interpreted: {
      risk_level: riskLevel,
      acceptance_status: acceptanceStatus,
      recommended_actions: recommendations,
      inhibitor_required: corrosionRate > 0.3
    },
    provenance: {
      engine: "DEWAARDMILLIAMS_CO2_v1",
      version: "1.0",
      deploy: "DEPLOY346",
      standards: ["NACE MR0175/ISO 15156 Part 1", "Norsok M-506", "de Waard-Milliams CO2 model"],
      timestamp: new Date().toISOString(),
      calculation_method: "log10(CR) = 5.8 - 1710/(T+273) + 0.67*log10(pCO2); corrected for pH, scale, velocity, glycol"
    }
  };
}

function assessMaterialSuitability(params) {
  var materialClass = params.material_class || "carbon_steel";
  var h2sPressure = params.h2s_pressure || 0;
  var temperature = params.temperature_c || 20;
  var hardness = params.hardness_hrc || 0;
  var pCO2 = params.pco2_bar || 1;

  var material = {
    carbon_steel: { h2s_max: 0.05, temp_max: 60, hardness_max: 22, co2_ok: false },
    low_alloy_steel: { h2s_max: 0.3, temp_max: 100, hardness_max: 22, co2_ok: true },
    martensitic_ss: { h2s_max: 0.1, temp_max: 80, hardness_max: 28, co2_ok: false },
    duplex_ss: { h2s_max: 1.0, temp_max: 150, hardness_max: 30, co2_ok: true },
    austenitic_ss: { h2s_max: 2.0, temp_max: 200, hardness_max: 30, co2_ok: true },
    nickel_alloy: { h2s_max: 5.0, temp_max: 250, hardness_max: 32, co2_ok: true },
    titanium: { h2s_max: 0.1, temp_max: 300, hardness_max: 32, co2_ok: true },
    cra_clad: { h2s_max: 2.0, temp_max: 180, hardness_max: 28, co2_ok: true }
  };

  var spec = material[materialClass] || material.carbon_steel;

  var h2sOK = h2sPressure <= spec.h2s_max;
  var tempOK = temperature <= spec.temp_max;
  var hardnessOK = hardness <= spec.hardness_max;
  var co2OK = !spec.co2_ok || pCO2 < 0.5 || (pCO2 >= 0.5 && materialClass !== "carbon_steel");

  var isAccepted = h2sOK && tempOK && hardnessOK && co2OK;

  var riskLevel = "NONE";
  var failureCount = 0;
  if (!h2sOK) failureCount++;
  if (!tempOK) failureCount++;
  if (!hardnessOK) failureCount++;
  if (!co2OK) failureCount++;

  if (failureCount >= 2) {
    riskLevel = "CRITICAL";
  } else if (failureCount === 1) {
    riskLevel = "HIGH";
  }

  var acceptanceStatus = isAccepted ? "ACCEPTED" : "REJECTED";

  var recommendations = [];
  if (!h2sOK) {
    recommendations.push("Material class does not meet H2S limit (" + spec.h2s_max + " bar); upgrade to higher corrosion resistance");
  }
  if (!tempOK) {
    recommendations.push("Temperature exceeds material limit (" + spec.temp_max + "C); select higher-temperature grade or cooling");
  }
  if (!hardnessOK) {
    recommendations.push("Hardness exceeds " + spec.hardness_max + " HRC; perform stress relief or select annealed condition");
  }
  if (!co2OK) {
    recommendations.push("CO2 service with current material; add inhibitors or upgrade to CRA/duplex");
  }

  return {
    deterministic: {
      material_class: materialClass,
      h2s_partial_pressure_bar: h2sPressure,
      h2s_limit_bar: spec.h2s_max,
      h2s_compliant: h2sOK,
      temperature_c: temperature,
      temperature_limit_c: spec.temp_max,
      temperature_compliant: tempOK,
      hardness_hrc: hardness,
      hardness_limit_hrc: spec.hardness_max,
      hardness_compliant: hardnessOK,
      pco2_bar: pCO2,
      co2_compliant: co2OK,
      material_grades_in_class: Object.keys(material).length
    },
    interpreted: {
      material_suitable: isAccepted,
      risk_level: riskLevel,
      acceptance_status: acceptanceStatus,
      recommended_actions: recommendations,
      alternative_materials: !isAccepted ? ["duplex_ss", "austenitic_ss", "nickel_alloy", "cra_clad"] : []
    },
    provenance: {
      engine: "NACE_MATERIAL_MATRIX_v1",
      version: "1.0",
      deploy: "DEPLOY346",
      standards: ["NACE MR0175/ISO 15156 Part 2", "NACE MR0175/ISO 15156 Part 3", "ASME B31.3", "ASME B31.8"],
      timestamp: new Date().toISOString(),
      calculation_method: "Material class matrix: 8 classes with H2S/temp/hardness/CO2 thresholds per NACE MR0175"
    }
  };
}

function assessCorrosionAllowance(params) {
  var nominalThickness = params.nominal_thickness_mm || 10;
  var measuredThickness = params.measured_thickness_mm || 9;
  var corrosionRate = params.corrosion_rate_mm_yr || 0.1;
  var remainingDesignLife = params.remaining_design_life_yr || 10;

  var futureCorrosion = corrosionRate * remainingDesignLife;
  var caRemaining = nominalThickness - measuredThickness - futureCorrosion;

  var yearsToRetirement = 0;
  if (corrosionRate > 0) {
    yearsToRetirement = ((nominalThickness - measuredThickness) / corrosionRate);
  } else {
    yearsToRetirement = 100;
  }

  var caPercentRemaining = (caRemaining / nominalThickness) * 100;

  var riskLevel = "LOW";
  if (caRemaining < 0) {
    riskLevel = "CRITICAL";
  } else if (caPercentRemaining < 10) {
    riskLevel = "HIGH";
  } else if (caPercentRemaining < 25) {
    riskLevel = "MODERATE";
  }

  var acceptanceStatus = "ACCEPTED";
  if (caRemaining <= 0) {
    acceptanceStatus = "REJECTED";
  } else if (caPercentRemaining < 10) {
    acceptanceStatus = "CONDITIONAL";
  }

  var recommendations = [];
  if (caRemaining <= 0) {
    recommendations.push("Corrosion allowance exhausted; pipe retirement or replacement required immediately");
  } else if (yearsToRetirement < remainingDesignLife) {
    recommendations.push("Retirement timeline (" + Math.floor(yearsToRetirement) + " yrs) shorter than design life; plan replacement");
  } else if (caPercentRemaining < 25) {
    recommendations.push("Corrosion allowance below 25%; increase monitoring frequency or apply protective coating");
  }

  return {
    deterministic: {
      nominal_thickness_mm: nominalThickness,
      measured_thickness_mm: measuredThickness,
      loss_to_date_mm: parseFloat((nominalThickness - measuredThickness).toFixed(2)),
      corrosion_rate_mm_yr: corrosionRate,
      remaining_design_life_yr: remainingDesignLife,
      future_corrosion_mm: parseFloat(futureCorrosion.toFixed(2)),
      ca_remaining_mm: parseFloat(caRemaining.toFixed(2)),
      ca_percent_remaining: parseFloat(caPercentRemaining.toFixed(1)),
      years_to_retirement: parseFloat(yearsToRetirement.toFixed(1))
    },
    interpreted: {
      risk_level: riskLevel,
      acceptance_status: acceptanceStatus,
      retirement_imminent: caRemaining <= 0,
      recommended_actions: recommendations
    },
    provenance: {
      engine: "CORROSION_ALLOWANCE_v1",
      version: "1.0",
      deploy: "DEPLOY346",
      standards: ["NACE SP0106", "API 579-1/ASME FFS-1", "DNV-RP-F101"],
      timestamp: new Date().toISOString(),
      calculation_method: "CA_remaining = nominal - measured - (rate × life); yearsToRetirement = (nominal - measured) / rate"
    }
  };
}

function assessCombined(params) {
  var sscResult = assessSSC(params);
  var hicResult = assessHIC(params);
  var co2Result = assessCO2Corrosion(params);
  var matResult = assessMaterialSuitability(params);

  var riskScores = {
    ssc_risk: sscResult.interpreted.risk_level === "CRITICAL" ? 3 : (sscResult.interpreted.risk_level === "MODERATE" ? 1.5 : 0),
    hic_risk: hicResult.interpreted.risk_level === "CRITICAL" ? 3 : (hicResult.interpreted.risk_level === "MODERATE" ? 1.5 : 0),
    co2_risk: co2Result.interpreted.risk_level === "CRITICAL" ? 3 : (co2Result.interpreted.risk_level === "MODERATE" ? 1.5 : 0),
    material_risk: matResult.interpreted.risk_level === "CRITICAL" ? 3 : (matResult.interpreted.risk_level === "MODERATE" ? 1.5 : 0)
  };

  var totalRisk = riskScores.ssc_risk + riskScores.hic_risk + riskScores.co2_risk + riskScores.material_risk;
  var overallRisk = "LOW";
  if (totalRisk >= 8) {
    overallRisk = "CRITICAL";
  } else if (totalRisk >= 4) {
    overallRisk = "HIGH";
  } else if (totalRisk > 0) {
    overallRisk = "MODERATE";
  }

  var allAccepted = sscResult.interpreted.acceptance_status === "ACCEPTED" &&
                    hicResult.interpreted.acceptance_status === "ACCEPTED" &&
                    co2Result.interpreted.acceptance_status === "ACCEPTED" &&
                    matResult.interpreted.acceptance_status === "ACCEPTED";

  var overallStatus = allAccepted ? "ACCEPTED" : "CONDITIONAL";
  if (totalRisk >= 8 || (sscResult.interpreted.acceptance_status === "REJECTED" ||
                          hicResult.interpreted.acceptance_status === "REJECTED" ||
                          co2Result.interpreted.acceptance_status === "REJECTED" ||
                          matResult.interpreted.acceptance_status === "REJECTED")) {
    overallStatus = "REJECTED";
  }

  var combinedActions = [];
  if (sscResult.interpreted.risk_level === "CRITICAL") {
    combinedActions.push("SSC: " + sscResult.interpreted.recommended_actions[0]);
  }
  if (hicResult.interpreted.risk_level === "CRITICAL") {
    combinedActions.push("HIC: " + hicResult.interpreted.recommended_actions[0]);
  }
  if (co2Result.interpreted.risk_level === "CRITICAL") {
    combinedActions.push("CO2: " + co2Result.interpreted.recommended_actions[0]);
  }
  if (matResult.interpreted.risk_level === "CRITICAL") {
    combinedActions.push("Material: " + matResult.interpreted.recommended_actions[0]);
  }

  return {
    deterministic: {
      ssc_region: sscResult.deterministic.ssc_region,
      h2s_pressure_bar: params.h2s_pressure || 0,
      pco2_bar: params.pco2_bar || 0,
      temperature_c: params.temperature_c || 0,
      material_class: params.material_class || "carbon_steel",
      risk_scores: riskScores,
      total_risk_score: parseFloat(totalRisk.toFixed(2))
    },
    interpreted: {
      ssc_verdict: sscResult.interpreted.acceptance_status,
      hic_verdict: hicResult.interpreted.acceptance_status,
      co2_verdict: co2Result.interpreted.acceptance_status,
      material_verdict: matResult.interpreted.acceptance_status,
      overall_risk_level: overallRisk,
      overall_acceptance_status: overallStatus,
      recommended_actions: combinedActions.length > 0 ? combinedActions : ["All aspects compliant; proceed with normal operation"]
    },
    provenance: {
      engine: "NACE_COMBINED_ASSESSMENT_v1",
      version: "1.0",
      deploy: "DEPLOY346",
      standards: ["NACE MR0175/ISO 15156 Parts 1-3", "NACE TM0284", "NACE SP0106", "Norsok M-506", "DNV-RP-F101", "API RP 571"],
      timestamp: new Date().toISOString(),
      calculation_method: "Integrated SSC, HIC, SOHIC, CO2, and material assessment pipeline"
    }
  };
}

function getNACERegion(params) {
  var h2sPressure = params.h2s_pressure || 0;
  var pH = params.ph || 7;
  var temperature = params.temperature_c || 20;

  var region = 0;
  var regionName = "Non-Sour";
  var description = "No H2S service conditions";

  if (h2sPressure < 0.05) {
    region = 0;
    regionName = "Non-Sour";
    description = "H2S < 0.05 bar; general corrosion only";
  } else if (h2sPressure >= 0.05 && h2sPressure < 0.3) {
    if (pH >= 5) {
      region = 3;
      regionName = "Region 3 (Mild)";
      description = "H2S 0.05-0.3 bar, pH >= 5; limited SSC/HIC risk";
    } else {
      region = 2;
      regionName = "Region 2 (Moderate)";
      description = "H2S 0.05-0.3 bar, pH < 5; moderate SSC/HIC risk";
    }
  } else if (h2sPressure >= 0.3 && h2sPressure < 1.0) {
    region = 2;
    regionName = "Region 2 (Moderate)";
    description = "H2S 0.3-1.0 bar; moderate SSC/HIC risk";
  } else {
    region = 1;
    regionName = "Region 1 (SSC Conditions)";
    description = "H2S >= 1.0 bar; high SSC/HIC risk";
  }

  var requirements = [];
  if (region >= 1) {
    requirements.push("Hardness <= 22 HRC per NACE MR0175");
    requirements.push("Stress relief / PWHT 600-750C recommended");
    requirements.push("Avoid susceptible materials (carbon steel grades)");
  }
  if (region >= 2) {
    requirements.push("HIC screening per NACE TM0284");
    requirements.push("Material suitability matrix evaluation");
  }
  if (region === 1) {
    requirements.push("Enhanced design review and NDT inspection");
    requirements.push("Consider CRA/duplex alloys");
  }

  return {
    deterministic: {
      h2s_partial_pressure_bar: h2sPressure,
      ph: pH,
      temperature_c: temperature,
      nace_region_code: region
    },
    interpreted: {
      region_name: regionName,
      region_description: description,
      requirements: requirements
    },
    provenance: {
      engine: "NACE_REGION_CLASSIFIER_v1",
      version: "1.0",
      deploy: "DEPLOY346",
      standards: ["NACE MR0175/ISO 15156 Part 1"],
      timestamp: new Date().toISOString(),
      calculation_method: "H2S/pH/temp threshold-based NACE region assignment"
    }
  };
}

export { handler };
