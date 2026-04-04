// DEPLOY104 — netlify/functions/materials-core.ts
// FORGED NDT Intelligence OS — Materials Intelligence Layer v1.0
// Pre-Flaw Prediction | Microstructure + Degradation Engine
// Physics-First | 9-Engine Sequential Pipeline
// STRING CONCATENATION ONLY — NO TEMPLATE LITERALS ANYWHERE
// FORGED Educational Systems — Houston, Texas
// ASNT Annual Conference Build — October 2026

import { Handler } from "@netlify/functions";

// ================================================================
// MATERIAL DATABASE — Weldability and HAZ Properties
// ================================================================

interface MaterialWeldProps {
  carbonEquivalent: number;      // IIW CE formula typical
  hardenabilityRisk: string;     // LOW | MODERATE | HIGH | VERY_HIGH
  hicSusceptibility: string;     // NONE | LOW | MODERATE | HIGH
  sccSusceptibility: string;     // NONE | LOW | MODERATE | HIGH
  sensitizationRisk: string;     // NONE | LOW | MODERATE | HIGH
  creepStartTempC: number;       // T where creep becomes relevant
  hydrogenTrap: string;          // LOW | MODERATE | HIGH (reversible + irreversible traps)
  hardnessLimitHV: number;       // NACE/ISO limit
}

const MATERIAL_WELD_PROPS: Record<string, MaterialWeldProps> = {
  carbon_steel: {
    carbonEquivalent: 0.43,
    hardenabilityRisk: "MODERATE",
    hicSusceptibility: "MODERATE",
    sccSusceptibility: "LOW",
    sensitizationRisk: "NONE",
    creepStartTempC: 370,
    hydrogenTrap: "MODERATE",
    hardnessLimitHV: 250
  },
  low_alloy: {
    carbonEquivalent: 0.52,
    hardenabilityRisk: "HIGH",
    hicSusceptibility: "LOW",
    sccSusceptibility: "LOW",
    sensitizationRisk: "NONE",
    creepStartTempC: 450,
    hydrogenTrap: "HIGH",
    hardnessLimitHV: 248
  },
  austenitic_ss: {
    carbonEquivalent: 0.20,
    hardenabilityRisk: "LOW",
    hicSusceptibility: "NONE",
    sccSusceptibility: "HIGH",
    sensitizationRisk: "HIGH",
    creepStartTempC: 550,
    hydrogenTrap: "LOW",
    hardnessLimitHV: 200
  },
  duplex_ss: {
    carbonEquivalent: 0.25,
    hardenabilityRisk: "LOW",
    hicSusceptibility: "NONE",
    sccSusceptibility: "MODERATE",
    sensitizationRisk: "MODERATE",
    creepStartTempC: 300,  // Duplex limited above 300C
    hydrogenTrap: "LOW",
    hardnessLimitHV: 280
  },
  nickel_alloy: {
    carbonEquivalent: 0.15,
    hardenabilityRisk: "LOW",
    hicSusceptibility: "NONE",
    sccSusceptibility: "LOW",
    sensitizationRisk: "LOW",
    creepStartTempC: 650,
    hydrogenTrap: "LOW",
    hardnessLimitHV: 350
  },
  high_strength: {
    carbonEquivalent: 0.65,
    hardenabilityRisk: "VERY_HIGH",
    hicSusceptibility: "HIGH",
    sccSusceptibility: "HIGH",
    sensitizationRisk: "NONE",
    creepStartTempC: 350,
    hydrogenTrap: "VERY_HIGH" as any,
    hardnessLimitHV: 248
  },
  unknown: {
    carbonEquivalent: 0.45,
    hardenabilityRisk: "MODERATE",
    hicSusceptibility: "MODERATE",
    sccSusceptibility: "MODERATE",
    sensitizationRisk: "LOW",
    creepStartTempC: 370,
    hydrogenTrap: "MODERATE",
    hardnessLimitHV: 250
  }
};

// Weld process thermal input classification
const WELD_PROCESS_HI: Record<string, number> = {
  "SMAW": 1.0,
  "GMAW": 0.85,
  "FCAW": 0.85,
  "SAW": 1.1,
  "GTAW": 0.60,
  "PAW": 0.60,
  "ESW": 1.4,
  "EGW": 1.4,
  "unknown": 1.0
};

// ================================================================
// ENGINE M1: THERMAL CYCLE & HAZ ENGINE
// ================================================================

function runM1(input: any): any {
  const assumptions: string[] = [];
  const matClass = (input.materialClass || "unknown").toLowerCase();
  const weldProcess = (input.weldProcess || "unknown").toUpperCase();
  const heatInputKJmm = input.heatInputKJmm || null;
  const preheatC = input.preheatTempC || 20;
  const pwhtApplied = input.pwhtApplied || false;

  const props = MATERIAL_WELD_PROPS[matClass] || MATERIAL_WELD_PROPS["unknown"];

  // Estimate heat input from process if not provided
  let heatInput = heatInputKJmm;
  if (!heatInput) {
    const processFactor = WELD_PROCESS_HI[weldProcess] || 1.0;
    heatInput = 1.0 * processFactor;  // assume 1 kJ/mm baseline
    assumptions.push("Heat input estimated from weld process (" + weldProcess + ") at " + heatInput.toFixed(2) + " kJ/mm — actual WPS heat input required");
  }

  // Cooling rate estimate (simplified t8/5 for thick plate)
  // t8/5 = (6700 - 5*T0) * Q / (1-(T0/800)^2) ... simplified
  const t0 = preheatC;
  const t85 = Math.max(1, (6700 - 5 * t0) * heatInput / (1 - Math.pow(t0 / 800, 2)));
  const coolingRateSec = t85;  // seconds from 800-500C

  // HAZ zone classification
  let hazProfile = {
    cgHAZ: "Present — highest hardness and embrittlement risk zone",
    fgHAZ: "Present — refined grain, moderate toughness",
    icHAZ: "Present — intercritical zone, sensitization risk in SS",
    scHAZ: "Present — subcritical zone, low transformation"
  };

  // Hardness prediction (simplified)
  const CE = props.carbonEquivalent;
  let hvHAZPeak = 90 + 1080 * (CE - 0.1) * Math.exp(-t85 / 40);
  if (pwhtApplied) hvHAZPeak *= 0.80;  // PWHT reduces peak hardness
  hvHAZPeak = Math.max(150, Math.min(550, hvHAZPeak));

  // Cold cracking risk from CEV and H
  let coldCrackRisk = "LOW";
  if (hvHAZPeak > 380 || (CE > 0.45 && preheatC < 100)) {
    coldCrackRisk = "HIGH";
    assumptions.push("Cold cracking risk is HIGH — preheat adequacy should be verified against WPS");
  } else if (hvHAZPeak > 300 || CE > 0.40) {
    coldCrackRisk = "MODERATE";
  }

  // Heat input classification
  let hiClassification = "NORMAL";
  if (heatInput < 0.5) hiClassification = "LOW_HEAT_INPUT";
  else if (heatInput > 2.0) hiClassification = "HIGH_HEAT_INPUT";

  if (!input.weldProcess) {
    assumptions.push("Weld process not specified — thermal cycle estimated from generic process defaults");
  }
  if (!input.preheatTempC) {
    assumptions.push("Preheat temperature assumed ambient (20C) — if preheat was applied, hardness estimate is conservative");
  }
  if (!input.pwhtApplied) {
    assumptions.push("PWHT status not confirmed — residual stress and hardness estimates assume no PWHT");
  }

  return {
    heatInputKJmm: heatInput,
    coolingRateT85Sec: Math.round(t85),
    hvHAZPeak: Math.round(hvHAZPeak),
    hazProfile: hazProfile,
    coldCrackRisk: coldCrackRisk,
    hiClassification: hiClassification,
    preheatApplied: preheatC > 50,
    pwhtApplied: pwhtApplied,
    carbonEquivalent: CE,
    assumptions: assumptions
  };
}

// ================================================================
// ENGINE M2: PHASE TRANSFORMATION & HARDNESS ENGINE
// ================================================================

function runM2(input: any, m1: any): any {
  const assumptions: string[] = [];
  const matClass = (input.materialClass || "unknown").toLowerCase();
  const props = MATERIAL_WELD_PROPS[matClass] || MATERIAL_WELD_PROPS["unknown"];

  const hvHAZ = m1.hvHAZPeak;
  const hvLimit = props.hardnessLimitHV;

  // Martensite fraction estimate (simplified: proportional to CE and cooling rate)
  const CE = m1.carbonEquivalent || props.carbonEquivalent;
  let martensiteFraction = Math.min(1.0, Math.max(0, (CE - 0.2) / 0.5));
  if (m1.coolingRateT85Sec < 10) martensiteFraction = Math.min(1.0, martensiteFraction * 1.5);
  if (m1.pwhtApplied) martensiteFraction *= 0.3;  // PWHT tempers martensite

  // Hardness status
  let hardnessStatus = "ACCEPTABLE";
  let embrittlementRisk = "LOW";
  if (hvHAZ > 450) {
    hardnessStatus = "SEVERELY_EXCEEDED";
    embrittlementRisk = "CRITICAL";
  } else if (hvHAZ > 380) {
    hardnessStatus = "EXCEEDED_COLD_CRACK_RISK";
    embrittlementRisk = "HIGH";
  } else if (hvHAZ > hvLimit) {
    hardnessStatus = "EXCEEDED_LIMIT";
    embrittlementRisk = "MODERATE";
  } else if (hvHAZ > hvLimit * 0.9) {
    hardnessStatus = "NEAR_LIMIT";
    embrittlementRisk = "LOW_ELEVATED";
  }

  // SCC susceptibility at this hardness level
  let sccHardnessRisk = "LOW";
  if (hvHAZ > 350 && (matClass === "carbon_steel" || matClass === "low_alloy")) {
    sccHardnessRisk = "HIGH";
    assumptions.push("HAZ hardness >350 HV increases SCC susceptibility in H2S environments (NACE MR0175 limit 248 HV)");
  }

  if (matClass === "unknown") {
    assumptions.push("Hardness assessment uses conservative unknown material defaults");
  }

  return {
    martensiteFraction: martensiteFraction,
    hvHAZPeak: hvHAZ,
    hvHardnessLimit: hvLimit,
    hardnessStatus: hardnessStatus,
    embrittlementRisk: embrittlementRisk,
    sccHardnessRisk: sccHardnessRisk,
    preheatAdequate: m1.preheatApplied || hvHAZ <= hvLimit,
    assumptions: assumptions
  };
}

// ================================================================
// ENGINE M3: SENSITIZATION ENGINE (SS and high-alloy)
// ================================================================

function runM3(input: any, m1: any): any {
  const assumptions: string[] = [];
  const matClass = (input.materialClass || "unknown").toLowerCase();
  const props = MATERIAL_WELD_PROPS[matClass] || MATERIAL_WELD_PROPS["unknown"];
  const tempC = input.operatingTempC || 20;

  let dosIndex = 0.0;
  let chromiumDepletionRisk = "NONE";
  let sccSusceptibility = props.sccSusceptibility;
  let sensitizationStatus = "NOT_APPLICABLE";

  if (matClass === "austenitic_ss" || matClass === "duplex_ss") {
    // Sensitization occurs at 450-850C for austenitic SS
    const heatInput = m1.heatInputKJmm || 1.0;
    const timeInSensitizationZone = heatInput * 30;  // seconds (simplified)

    // DOS estimation (simplified kinetic model)
    dosIndex = Math.min(1.0, (timeInSensitizationZone / 200) * (heatInput > 1.5 ? 1.5 : 1.0));

    // Carbon content effect
    const isLowCarbon = (input.materialGrade || "").toLowerCase().includes("l") ||
      (input.materialGrade || "").toLowerCase().includes("316l") ||
      (input.materialGrade || "").toLowerCase().includes("304l");
    if (isLowCarbon) {
      dosIndex *= 0.3;
      assumptions.push("Low-carbon grade (L) significantly reduces sensitization risk");
    }

    if (dosIndex > 0.40) {
      sensitizationStatus = "SEVERELY_SENSITIZED";
      chromiumDepletionRisk = "SEVERE";
    } else if (dosIndex > 0.20) {
      sensitizationStatus = "SENSITIZED";
      chromiumDepletionRisk = "MODERATE";
    } else if (dosIndex > 0.10) {
      sensitizationStatus = "PARTIALLY_SENSITIZED";
      chromiumDepletionRisk = "LOW";
    } else {
      sensitizationStatus = "MINIMAL_SENSITIZATION";
      chromiumDepletionRisk = "MINIMAL";
    }

    // Elevated temperature service accelerates sensitization
    if (tempC > 400 && tempC < 850) {
      dosIndex = Math.min(1.0, dosIndex * 1.5);
      assumptions.push("Service temperature in sensitization range (400-850C) — in-service sensitization may have occurred beyond weld thermal cycle effect");
    }

    if (!input.materialGrade) {
      assumptions.push("Material grade not specified — sensitization assessment uses standard (non-L grade) conservative assumption");
    }
  } else {
    sensitizationStatus = "NOT_APPLICABLE_FOR_MATERIAL";
    dosIndex = 0;
  }

  return {
    dosIndex: dosIndex,
    sensitizationStatus: sensitizationStatus,
    chromiumDepletionRisk: chromiumDepletionRisk,
    igaSusceptibility: dosIndex > 0.20 ? "HIGH" : dosIndex > 0.10 ? "MODERATE" : "LOW",
    sccFromSensitization: matClass === "austenitic_ss" && dosIndex > 0.20 && (input.chloridePPM || 0) > 50,
    assumptions: assumptions
  };
}

// ================================================================
// ENGINE M4: HYDROGEN DIFFUSION ENGINE
// ================================================================

function runM4(input: any, m1: any, m2: any): any {
  const assumptions: string[] = [];
  const matClass = (input.materialClass || "unknown").toLowerCase();
  const props = MATERIAL_WELD_PROPS[matClass] || MATERIAL_WELD_PROPS["unknown"];
  const h2sPPa = input.h2sPartialPressureMPa || 0;
  const pH = input.pH || 7;
  const tempC = input.operatingTempC || 20;

  // Hydrogen fugacity from H2S
  let hydrogenFugacity = 0;
  if (h2sPPa > 0) {
    // Simplified Sievert's law approximation
    hydrogenFugacity = Math.sqrt(h2sPPa * 1000) * (pH < 5 ? 3.0 : pH < 7 ? 1.5 : 1.0);
  }

  // Effective diffusivity (m^2/s) - temperature dependent
  const D0 = matClass === "austenitic_ss" ? 1.0e-13 : 1.0e-11;
  const Q = matClass === "austenitic_ss" ? 55000 : 28000;  // J/mol activation energy
  const R = 8.314;
  const T_K = tempC + 273;
  const Deff = D0 * Math.exp(-Q / (R * T_K));

  // Hydrogen concentration at crack tip (simplified)
  const C_tip = hydrogenFugacity * Math.sqrt(Deff * 1e10);  // normalized

  // Embrittlement threshold
  const kIC = input.fractureToughnessMPa || (MATERIAL_WELD_PROPS[matClass] || MATERIAL_WELD_PROPS["unknown"]).hardnessLimitHV * 0.5;
  const kIH = kIC * (1 - 0.3 * Math.min(1, C_tip));  // H reduces toughness

  // Risk classification
  let hicRisk = "LOW";
  let heRisk = "LOW";
  let hydrogenRiskLevel = "LOW";

  if (h2sPPa > 0.0003 && (matClass === "carbon_steel" || matClass === "low_alloy" || matClass === "high_strength")) {
    hicRisk = "HIGH";
    hydrogenRiskLevel = "HIGH";
    assumptions.push("H2S partial pressure exceeds NACE threshold (0.0003 MPa) — SSC and HIC conditions met for susceptible steels");
  } else if (h2sPPa > 0 && h2sPPa <= 0.0003) {
    hicRisk = "MODERATE";
    hydrogenRiskLevel = "MODERATE";
    assumptions.push("H2S present but below NACE threshold — monitor, threshold may be exceeded under upset conditions");
  }

  if (m2.hvHAZPeak > 350 && h2sPPa > 0) {
    heRisk = "HIGH";
    assumptions.push("HAZ hardness " + m2.hvHAZPeak + " HV with H2S exposure — hydrogen embrittlement risk is HIGH (hardness limit 248 HV per NACE MR0175)");
  }

  if (!input.h2sPartialPressureMPa) {
    assumptions.push("H2S partial pressure not provided — hydrogen risk assessment based on narrative/context only");
  }
  if (!input.pH) {
    assumptions.push("pH not provided — neutral (7.0) assumed; acidic conditions would significantly increase hydrogen absorption");
  }

  return {
    hydrogenFugacity: hydrogenFugacity,
    effectiveDiffusivity: Deff,
    concentrationAtTip: C_tip,
    kIHReduced: kIH,
    hicRisk: hicRisk,
    heRisk: heRisk,
    hydrogenRiskLevel: hydrogenRiskLevel,
    h2sThresholdExceeded: h2sPPa > 0.0003,
    assumptions: assumptions
  };
}

// ================================================================
// ENGINE M5: FATIGUE INITIATION ENGINE
// ================================================================

function runM5(input: any, m1: any, m2: any): any {
  const assumptions: string[] = [];
  const matClass = (input.materialClass || "unknown").toLowerCase();
  const props = MATERIAL_WELD_PROPS[matClass] || MATERIAL_WELD_PROPS["unknown"];
  const sigmaNom = input.effectiveStressMPa || 100;
  const sigmaRange = input.stressRangeMPa || (sigmaNom * 0.3);
  const isCyclic = input.isCyclicService || sigmaRange > 20;

  // Stress concentration at weld toe (Kt)
  let kt = 2.5;
  const componentType = (input.componentType || "").toLowerCase();
  if (componentType.includes("weld_root")) kt = 3.0;
  else if (componentType.includes("nozzle")) kt = 3.5;
  else if (componentType.includes("groove")) kt = 1.8;

  const sigmaLocal = sigmaNom * kt;
  const deltaKt = sigmaRange * kt;

  // S-N fatigue initiation (simplified AWS D1.1 Curve B/C approach)
  // N_i = (C_sn / delta_sigma_local)^m_sn
  const m_sn = 3.0;
  const C_sn = 1.0e12;  // Weld class B/C typical range (MPa^3 cycles)

  let N_initiation: number | null = null;
  if (isCyclic && deltaKt > 0) {
    N_initiation = C_sn / Math.pow(deltaKt, m_sn);
    if (N_initiation > 1e9) N_initiation = 1e9;  // Cap at infinite life domain
  }

  // Weld toe SCF factor for initiation location
  const toeSCFRisk = kt > 2.5 ? "HIGH" : kt > 2.0 ? "MODERATE" : "LOW";
  const initiationLocation = kt > 2.5 ? "Weld toe / weld root stress concentration — highest initiation risk" :
    "Weld toe — standard stress concentration location";

  // Convert to calendar time
  let initiationMonths: number | null = null;
  if (N_initiation !== null && isCyclic) {
    const cyclesPerDay = input.cyclesPerDay || 100;
    initiationMonths = N_initiation / cyclesPerDay / 30;
    initiationMonths = Math.min(initiationMonths, 1200);
    if (!input.cyclesPerDay) {
      assumptions.push("Fatigue initiation life calculated at assumed " + cyclesPerDay + " cycles/day — actual cycle rate required");
    }
  }

  if (!isCyclic) {
    assumptions.push("No cyclic service confirmed — fatigue initiation life not calculated");
  }
  if (!input.stressRangeMPa) {
    assumptions.push("Stress range assumed 30% of effective stress for fatigue initiation estimate — measured cycle amplitude preferred");
  }

  return {
    ktWeldToe: kt,
    sigmaLocalMPa: sigmaLocal,
    stressRangeLocalMPa: deltaKt,
    N_initiation: N_initiation,
    initiationMonths: initiationMonths,
    toeSCFRisk: toeSCFRisk,
    initiationLocation: initiationLocation,
    isCyclicService: isCyclic,
    assumptions: assumptions
  };
}

// ================================================================
// ENGINE M6: CREEP DAMAGE ENGINE
// ================================================================

function runM6(input: any, m1: any): any {
  const assumptions: string[] = [];
  const matClass = (input.materialClass || "unknown").toLowerCase();
  const props = MATERIAL_WELD_PROPS[matClass] || MATERIAL_WELD_PROPS["unknown"];
  const tempC = input.operatingTempC || 20;
  const serviceYears = input.serviceYears || 5;
  const sigmaMPa = input.effectiveStressMPa || 100;

  const creepStartC = props.creepStartTempC;
  let creepDamageFraction = 0;
  let creepRate = 0;
  let creepStatus = "NOT_APPLICABLE";
  let larsonMillerParameter = 0;
  let tertiaryCreepFlag = false;

  if (tempC > creepStartC) {
    // Larson-Miller Parameter: LMP = T * (C + log(t_r)) where T in Rankine, t_r in hours
    // Simplified: use normalized form
    const T_R = (tempC + 273) * 1.8;  // Kelvin to Rankine
    const C_LM = 20;  // typical for steels
    const t_elapsed_hr = serviceYears * 8760;

    larsonMillerParameter = T_R * (C_LM + Math.log10(t_elapsed_hr)) / 1000;

    // Creep damage fraction (Omega method simplified)
    const tempNorm = (tempC - creepStartC) / (1000 - creepStartC);
    const stressNorm = sigmaMPa / 200;  // normalize to 200 MPa reference
    creepDamageFraction = Math.min(1.0, tempNorm * stressNorm * serviceYears / 100);
    creepRate = creepDamageFraction / (serviceYears * 8760);

    if (creepDamageFraction > 0.5) {
      creepStatus = "CRITICAL_TERTIARY";
      tertiaryCreepFlag = true;
    } else if (creepDamageFraction > 0.20) {
      creepStatus = "SIGNIFICANT_SECONDARY";
    } else if (creepDamageFraction > 0.05) {
      creepStatus = "MINOR_PRIMARY";
    } else {
      creepStatus = "MINIMAL";
    }

    assumptions.push("Creep damage estimated from normalized Larson-Miller — actual component stress rupture data required for precision");
    if (!input.serviceYears) {
      assumptions.push("Service years assumed 5 for creep accumulation — actual service history required");
    }
  } else {
    creepStatus = "BELOW_THRESHOLD_TEMP";
    assumptions.push("Operating temperature " + tempC + "C is below creep threshold (" + creepStartC + "C for " + matClass + ") — creep not active");
  }

  return {
    creepDamageFraction: creepDamageFraction,
    creepRate: creepRate,
    creepStatus: creepStatus,
    larsonMillerParameter: larsonMillerParameter,
    tertiaryCreepFlag: tertiaryCreepFlag,
    creepThresholdTempC: creepStartC,
    isAboveCreepThreshold: tempC > creepStartC,
    assumptions: assumptions
  };
}

// ================================================================
// ENGINE M7: CORROSION & ELECTROCHEMISTRY ENGINE
// ================================================================

function runM7(input: any, m3: any): any {
  const assumptions: string[] = [];
  const matClass = (input.materialClass || "unknown").toLowerCase();
  const chloride = input.chloridePPM || 0;
  const h2sPPa = input.h2sPartialPressureMPa || 0;
  const pH = input.pH || 7;
  const tempC = input.operatingTempC || 20;
  const wallThicknessNom = input.wallThicknessMM || null;
  const serviceYears = input.serviceYears || 5;
  const narrative = (input.incidentNarrative || "").toLowerCase();

  let corrosionRate = 0;  // mm/year
  let pittingRisk = "LOW";
  let sccIndex = 0;
  let galvanicRisk = "NONE";
  let corrosionMechanism = "NONE";
  let electrochemicalState = "PASSIVE";

  // General corrosion rate estimate
  if (matClass === "carbon_steel" || matClass === "low_alloy") {
    if (h2sPPa > 0 || chloride > 100) {
      corrosionRate = 0.3 + (chloride / 10000) + (h2sPPa * 100);
      corrosionMechanism = h2sPPa > 0 ? "H2S_CORROSION" : "CHLORIDE_CORROSION";
      electrochemicalState = "ACTIVE";
    } else if (narrative.includes("corrosion") || narrative.includes("rust")) {
      corrosionRate = 0.15;
      corrosionMechanism = "GENERAL_ATMOSPHERIC";
      electrochemicalState = "ACTIVE";
    }
  } else if (matClass === "austenitic_ss") {
    if (chloride > 200 && tempC > 50) {
      pittingRisk = tempC > 100 ? "CRITICAL" : "HIGH";
      corrosionMechanism = "PITTING_SCC";
      electrochemicalState = "PITTING";
      sccIndex = Math.min(1.0, (chloride / 1000) * (tempC / 100) * (m3.dosIndex + 0.1));
      corrosionRate = 0.02 + (chloride / 50000);
    } else if (chloride > 50) {
      pittingRisk = "MODERATE";
      corrosionRate = 0.01;
    }
  } else if (matClass === "duplex_ss") {
    if (chloride > 500 && tempC > 60) {
      pittingRisk = "HIGH";
      sccIndex = Math.min(0.8, (chloride / 2000) * (tempC / 80));
      corrosionMechanism = "PITTING_SCC_DUPLEX";
    } else if (chloride > 100) {
      pittingRisk = "MODERATE";
    }
  }

  // Galvanic risk from narrative
  if (narrative.includes("galvanic") || narrative.includes("dissimilar metal") ||
    narrative.includes("stainless contact") || narrative.includes("copper")) {
    galvanicRisk = "HIGH";
    assumptions.push("Galvanic corrosion risk from dissimilar metal contact detected in narrative — isolation required");
  }

  // Remaining wall life from corrosion
  let corrosionLifeMonths: number | null = null;
  if (corrosionRate > 0 && wallThicknessNom) {
    const tMin = wallThicknessNom * 0.875;
    const tLoss = wallThicknessNom * 0.05;  // 5% assumed current loss
    const tCurrent = wallThicknessNom - tLoss;
    if (tCurrent > tMin) {
      corrosionLifeMonths = ((tCurrent - tMin) / corrosionRate) * 12;
    }
    if (!input.wallThicknessMM) {
      assumptions.push("Wall thickness assumed from nominal for corrosion life calculation");
    }
  }

  if (!input.chloridePPM && !input.h2sPartialPressureMPa) {
    assumptions.push("No chemistry data — corrosion rate and pitting risk estimated from asset class and narrative only");
  }

  return {
    corrosionRateMmYear: corrosionRate,
    pittingRisk: pittingRisk,
    sccIndex: sccIndex,
    galvanicRisk: galvanicRisk,
    corrosionMechanism: corrosionMechanism,
    electrochemicalState: electrochemicalState,
    corrosionLifeMonths: corrosionLifeMonths,
    assumptions: assumptions
  };
}

// ================================================================
// ENGINE M8: RESIDUAL STRESS & INTEGRITY AUDIT ENGINE
// ================================================================

function runM8(input: any, m1: any, m2: any, m4: any): any {
  const assumptions: string[] = [];
  const pwhtApplied = m1.pwhtApplied;
  const hvHAZ = m2.hvHAZPeak;
  const sigmaYS = input.yieldStrengthMPa || 250;

  // Residual stress profile
  let residualStressMPa = sigmaYS * 0.8;  // Typical as-welded: ~80% yield
  let residualStressState = "AS_WELDED_HIGH";
  let kICorrection = 1.0;

  if (pwhtApplied) {
    residualStressMPa = sigmaYS * 0.15;
    residualStressState = "PWHT_RELIEVED";
    kICorrection = 0.85;
    assumptions.push("PWHT applied — residual stresses assumed reduced to 15% yield");
  } else if (input.shopeening || (input.incidentNarrative || "").toLowerCase().includes("shot peen")) {
    residualStressMPa = -0.2 * sigmaYS;  // Compressive from shot peening
    residualStressState = "SHOT_PEENED_COMPRESSIVE";
    kICorrection = 0.70;
    assumptions.push("Shot peening creates beneficial compressive residual stress layer — fatigue initiation life significantly extended");
  } else {
    assumptions.push("No PWHT confirmed — as-welded tensile residual stresses assumed at ~80% of yield strength");
  }

  // K_I correction for residual stress
  const kIResidualContrib = residualStressMPa > 0 ?
    residualStressMPa * 1.12 * Math.sqrt(Math.PI * 0.003) :  // 3mm reference crack
    0;

  // Cross-layer consistency
  const crossLayerConsistency: string[] = [];
  if (m4.hydrogenRiskLevel === "HIGH" && residualStressState === "AS_WELDED_HIGH") {
    crossLayerConsistency.push("HIGH RISK: High hydrogen + high tensile residual stress combination — SCC/HIC initiation conditions are optimal");
  }
  if (hvHAZ > props_hardness_limit(input) && !pwhtApplied) {
    crossLayerConsistency.push("Hardness exceeds limit AND no PWHT — SCC/cold crack risk compounded by residual stress");
  }

  return {
    residualStressMPa: residualStressMPa,
    residualStressState: residualStressState,
    kICorrection: kICorrection,
    kIResidualContrib: kIResidualContrib,
    pwhtAdequate: pwhtApplied,
    crossLayerConsistency: crossLayerConsistency,
    assumptions: assumptions
  };
}

function props_hardness_limit(input: any): number {
  const mat = MATERIAL_WELD_PROPS[(input.materialClass || "unknown").toLowerCase()] ||
    MATERIAL_WELD_PROPS["unknown"];
  return mat.hardnessLimitHV;
}

// ================================================================
// ENGINE M9: PRE-FLAW PREDICTION ENGINE
// ================================================================

function runM9(input: any, m1: any, m2: any, m3: any, m4: any, m5: any, m6: any, m7: any, m8: any): any {
  const assumptions: string[] = [];

  const likely_initiation_zones: string[] = [];
  const inspection_priority: string[] = [];
  let expectedMechanism = "UNKNOWN";
  let timeToInitiationMonths: number | null = null;
  let expectedFlawMorphology = "Unknown — mechanism not yet identified";
  let materialsRiskLevel = "LOW";

  // Identify highest risk initiation zones
  if (m2.hardnessStatus === "SEVERELY_EXCEEDED" || m2.hardnessStatus === "EXCEEDED_COLD_CRACK_RISK") {
    likely_initiation_zones.push("CGHAZ (coarse grain HAZ) — highest hardness / martensite zone near fusion line");
    expectedMechanism = "HYDROGEN_COLD_CRACKING";
    expectedFlawMorphology = "Transgranular or intergranular crack initiating at weld toe or root";
    materialsRiskLevel = "CRITICAL";
    timeToInitiationMonths = 0;  // Can occur at or immediately after welding
    inspection_priority.push("IMMEDIATE: UT or TOFD of CGHAZ within 48 hours of welding complete");
  }

  if (m4.hicRisk === "HIGH" || m4.heRisk === "HIGH") {
    likely_initiation_zones.push("Mid-wall HAZ and base metal — hydrogen trap sites (inclusions, MnS, grain boundaries)");
    if (expectedMechanism === "UNKNOWN") expectedMechanism = "HYDROGEN_INDUCED_CRACKING";
    expectedFlawMorphology = "Subsurface stepwise cracking (HIC) or branched transgranular (SSC)";
    materialsRiskLevel = "CRITICAL";
    timeToInitiationMonths = timeToInitiationMonths === null ? 3 : Math.min(timeToInitiationMonths, 3);
    inspection_priority.push("URGENT: UT A-scan or TOFD for subsurface HIC — MT/PT will NOT detect these");
  }

  if (m3.sensitizationStatus === "SENSITIZED" || m3.sensitizationStatus === "SEVERELY_SENSITIZED") {
    likely_initiation_zones.push("Weld HAZ grain boundaries (intergranular) — chromium depletion zones");
    if (expectedMechanism === "UNKNOWN") expectedMechanism = "INTERGRANULAR_SCC";
    expectedFlawMorphology = "Branched intergranular cracking in chloride/aggressive environment";
    materialsRiskLevel = "HIGH";
    timeToInitiationMonths = timeToInitiationMonths === null ? 12 : Math.min(timeToInitiationMonths, 12);
    inspection_priority.push("HIGH: TOFD or AET monitoring of HAZ — sensitized zones in chloride service should be prioritized");
  }

  if (m7.pittingRisk === "CRITICAL" || m7.pittingRisk === "HIGH") {
    likely_initiation_zones.push("Surface pits — stress concentration sites for pit-to-crack transition");
    if (expectedMechanism === "UNKNOWN") expectedMechanism = "PIT_TO_CRACK_TRANSITION";
    expectedFlawMorphology = "Hemispherical pits transitioning to short cracks at pit mouth under cyclic stress";
    materialsRiskLevel = materialsRiskLevel === "CRITICAL" ? "CRITICAL" : "HIGH";
    timeToInitiationMonths = timeToInitiationMonths === null ? 18 : Math.min(timeToInitiationMonths, 18);
    inspection_priority.push("HIGH: UT C-scan or PAUT for pitting survey — pit depth measurement required");
  }

  if (m6.tertiaryCreepFlag) {
    likely_initiation_zones.push("Grain boundary triple points in high-temperature service zones");
    if (expectedMechanism === "UNKNOWN") expectedMechanism = "CREEP_CRACKING";
    expectedFlawMorphology = "Intergranular voids and cracks at grain boundaries";
    materialsRiskLevel = "CRITICAL";
    timeToInitiationMonths = 0;
    inspection_priority.push("IMMEDIATE: UT creep wave and hardness survey — tertiary creep indicates imminent failure");
  }

  if (m5.initiationMonths !== null && m5.N_initiation !== null) {
    likely_initiation_zones.push("Weld toe / stress concentration — highest cyclic damage accumulation");
    if (expectedMechanism === "UNKNOWN") expectedMechanism = "MECHANICAL_FATIGUE_INITIATION";
    expectedFlawMorphology = "Transgranular surface crack initiating at weld toe, beach marks under cycling";
    const fatigueMR = materialsRiskLevel;
    if (m5.initiationMonths < 12) materialsRiskLevel = "CRITICAL";
    else if (m5.initiationMonths < 36) materialsRiskLevel = "HIGH";
    else materialsRiskLevel = fatigueMR === "CRITICAL" ? "CRITICAL" : "MODERATE";
    if (timeToInitiationMonths === null) timeToInitiationMonths = m5.initiationMonths;
    else timeToInitiationMonths = Math.min(timeToInitiationMonths, m5.initiationMonths);
    inspection_priority.push("Weld toe MT/PT for fatigue crack initiation — inspect at " + (m5.initiationMonths * 0.5).toFixed(0) + " months (50% of estimated initiation life)");
  }

  if (m7.corrosionRateMmYear > 0.1 && m7.corrosionLifeMonths !== null) {
    likely_initiation_zones.push("Thinning areas — internal surface corrosion/erosion, downstream of flow changes");
    if (timeToInitiationMonths === null) timeToInitiationMonths = m7.corrosionLifeMonths;
    inspection_priority.push("UT thickness survey — focus on downstream elbows, tees, injection points");
  }

  if (m8.residualStressState === "AS_WELDED_HIGH" && m4.hydrogenRiskLevel === "HIGH") {
    likely_initiation_zones.push("Weld root — highest residual stress + hydrogen combination");
    timeToInitiationMonths = timeToInitiationMonths === null ? 1 : Math.min(timeToInitiationMonths, 1);
  }

  // Default if no specific driver found
  if (likely_initiation_zones.length === 0) {
    likely_initiation_zones.push("Weld toe and heat affected zone — standard initiation locations under service loading");
    expectedMechanism = "GENERAL_FATIGUE_OR_CORROSION";
    expectedFlawMorphology = "Surface-breaking crack at weld discontinuity";
    materialsRiskLevel = "LOW";
    timeToInitiationMonths = null;
    inspection_priority.push("Routine: VT and MT/PT at next scheduled inspection interval");
    assumptions.push("No elevated material risk drivers identified — routine inspection schedule applies");
  }

  return {
    likelyInitiationZones: likely_initiation_zones,
    expectedMechanism: expectedMechanism,
    timeToInitiationMonths: timeToInitiationMonths,
    inspectionPriority: inspection_priority,
    expectedFlawMorphology: expectedFlawMorphology,
    materialsRiskLevel: materialsRiskLevel,
    assumptions: assumptions
  };
}

// ================================================================
// NARRATIVE GENERATORS
// ================================================================

function buildMaterialsSimpleNarrative(m1: any, m2: any, m4: any, m7: any, m9: any): string {
  let n = "Material assessment: ";
  n = n + (m1.hvHAZPeak > m2.hvHardnessLimit ?
    "HAZ hardness exceeds safe limit (" + m1.hvHAZPeak + " HV vs limit " + m2.hvHardnessLimit + " HV). " :
    "HAZ hardness within acceptable range (" + m1.hvHAZPeak + " HV). ");
  n = n + "Dominant mechanism identified: " + m9.expectedMechanism.replace(/_/g, " ") + ". ";
  n = n + "Predicted next initiation zone: " + (m9.likelyInitiationZones[0] || "see inspection priority") + ". ";
  if (m9.timeToInitiationMonths !== null && m9.timeToInitiationMonths !== undefined) {
    n = n + "Estimated time to initiation: " + m9.timeToInitiationMonths.toFixed(0) + " months. ";
  }
  n = n + "Materials risk level: " + m9.materialsRiskLevel + ". ";
  if (m9.inspectionPriority.length > 0) {
    n = n + "Priority action: " + m9.inspectionPriority[0];
  }
  return n;
}

function buildMaterialsExpertNarrative(m1: any, m2: any, m3: any, m4: any, m5: any, m6: any, m7: any, m8: any, m9: any): string {
  let n = "THERMAL: HI=" + m1.heatInputKJmm.toFixed(2) + "kJ/mm | t8/5=" + m1.coolingRateT85Sec + "s | HV_HAZ=" + m1.hvHAZPeak + " | cold_crack=" + m1.coldCrackRisk + ". ";
  n = n + "HARDNESS: status=" + m2.hardnessStatus + " | martensite=" + (m2.martensiteFraction * 100).toFixed(0) + "% | embrittlement=" + m2.embrittlementRisk + ". ";
  n = n + "SENSITIZATION: DOS=" + m3.dosIndex.toFixed(2) + " | status=" + m3.sensitizationStatus + ". ";
  n = n + "HYDROGEN: H_risk=" + m4.hydrogenRiskLevel + " | HIC=" + m4.hicRisk + " | HE=" + m4.heRisk + " | H2S_threshold=" + m4.h2sThresholdExceeded + ". ";
  n = n + "FATIGUE INITIATION: N_i=" + (m5.N_initiation !== null ? m5.N_initiation.toExponential(2) : "N/A") + " | months=" + (m5.initiationMonths !== null ? m5.initiationMonths.toFixed(0) : "N/A") + " | Kt=" + m5.ktWeldToe + ". ";
  n = n + "CREEP: damage=" + m6.creepDamageFraction.toFixed(2) + " | status=" + m6.creepStatus + " | tertiary=" + m6.tertiaryCreepFlag + ". ";
  n = n + "CORROSION: rate=" + m7.corrosionRateMmYear.toFixed(2) + "mm/yr | pitting=" + m7.pittingRisk + " | SCC_index=" + m7.sccIndex.toFixed(2) + ". ";
  n = n + "RESIDUAL: state=" + m8.residualStressState + " | sigma_res=" + m8.residualStressMPa.toFixed(0) + "MPa | kI_correction=" + m8.kICorrection + ". ";
  n = n + "PREDICTION: mechanism=" + m9.expectedMechanism + " | zones=" + m9.likelyInitiationZones.length + " | time_to_init=" + (m9.timeToInitiationMonths !== null ? m9.timeToInitiationMonths.toFixed(0) + "mo" : "N/A") + " | risk=" + m9.materialsRiskLevel + ".";
  return n;
}

// ================================================================
// MAIN HANDLER
// ================================================================

export const handler: Handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  let input: any;
  try {
    input = JSON.parse(event.body || "{}");
  } catch (e) {
    return {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Invalid JSON" })
    };
  }

  try {
    // SEQUENTIAL 9-ENGINE PIPELINE
    const m1 = runM1(input);
    const m2 = runM2(input, m1);
    const m3 = runM3(input, m1);
    const m4 = runM4(input, m1, m2);
    const m5 = runM5(input, m1, m2);
    const m6 = runM6(input, m1);
    const m7 = runM7(input, m3);
    const m8 = runM8(input, m1, m2, m4);
    const m9 = runM9(input, m1, m2, m3, m4, m5, m6, m7, m8);

    const allAssumptions = [
      ...m1.assumptions, ...m2.assumptions, ...m3.assumptions,
      ...m4.assumptions, ...m5.assumptions, ...m6.assumptions,
      ...m7.assumptions, ...m8.assumptions, ...m9.assumptions
    ];

    const simpleNarrative = buildMaterialsSimpleNarrative(m1, m2, m4, m7, m9);
    const expertNarrative = buildMaterialsExpertNarrative(m1, m2, m3, m4, m5, m6, m7, m8, m9);

    const output = {
      caseId: input.caseId || ("MAT-" + Date.now()),
      dominantDamageMechanism: m9.expectedMechanism,
      materialsRiskLevel: m9.materialsRiskLevel,
      hvHAZPeak: m1.hvHAZPeak,
      hardnessStatus: m2.hardnessStatus,
      embrittlementRisk: m2.embrittlementRisk,
      coldCrackRisk: m1.coldCrackRisk,
      sensitizationStatus: m3.sensitizationStatus,
      sensitizationDOS: m3.dosIndex,
      hydrogenRiskLevel: m4.hydrogenRiskLevel,
      hicRisk: m4.hicRisk,
      heRisk: m4.heRisk,
      h2sThresholdExceeded: m4.h2sThresholdExceeded,
      fatigueInitiationMonths: m5.initiationMonths,
      fatigueN_initiation: m5.N_initiation,
      fatigueInitiationLocation: m5.initiationLocation,
      creepDamageFraction: m6.creepDamageFraction,
      creepStatus: m6.creepStatus,
      tertiaryCreepFlag: m6.tertiaryCreepFlag,
      corrosionRateMmYear: m7.corrosionRateMmYear,
      pittingRisk: m7.pittingRisk,
      sccIndex: m7.sccIndex,
      corrosionLifeMonths: m7.corrosionLifeMonths,
      residualStressState: m8.residualStressState,
      residualStressMPa: m8.residualStressMPa,
      likelyInitiationZones: m9.likelyInitiationZones,
      timeToInitiationMonths: m9.timeToInitiationMonths,
      expectedFlawMorphology: m9.expectedFlawMorphology,
      inspectionPriority: m9.inspectionPriority,
      carbonEquivalent: m1.carbonEquivalent,
      heatInputKJmm: m1.heatInputKJmm,
      pwhtApplied: m1.pwhtApplied,
      assumptionRegister: allAssumptions,
      simpleNarrative: simpleNarrative,
      expertNarrative: expertNarrative
    };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type"
      },
      body: JSON.stringify(output)
    };

  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Materials core error: " + (err.message || String(err)) })
    };
  }
};
