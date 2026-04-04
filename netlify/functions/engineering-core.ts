// DEPLOY101 — netlify/functions/engineering-core.ts
// FORGED NDT Intelligence OS — Engineering Intelligence Layer v1.0
// Dual-Core Inspector + Engineering Decision Engine
// Physics-First | 7-Engine Sequential Pipeline | Dual-Core Arbitration
// STRING CONCATENATION ONLY — NO TEMPLATE LITERALS ANYWHERE
// FORGED Educational Systems — Houston, Texas
// ASNT Annual Conference Build — October 2026

import { Handler } from "@netlify/functions";

// ================================================================
// SECTION 1: MATERIAL DEFAULTS
// ================================================================

interface MaterialDefaults {
  yieldStrengthMPa: number;
  kICMPaSqrtM: number;
  parisC: number;
  parisM: number;
  tMeltC: number;
  label: string;
}

const MATERIAL_DEFAULTS: Record<string, MaterialDefaults> = {
  carbon_steel: {
    yieldStrengthMPa: 250,
    kICMPaSqrtM: 50,
    parisC: 6.9e-12,
    parisM: 3.0,
    tMeltC: 1510,
    label: "Carbon Steel (Grade B / A36 conservative default)"
  },
  low_alloy: {
    yieldStrengthMPa: 350,
    kICMPaSqrtM: 80,
    parisC: 5.0e-12,
    parisM: 3.0,
    tMeltC: 1500,
    label: "Low Alloy Steel (A516-70 / P91 conservative default)"
  },
  austenitic_ss: {
    yieldStrengthMPa: 210,
    kICMPaSqrtM: 150,
    parisC: 3.0e-12,
    parisM: 3.2,
    tMeltC: 1400,
    label: "Austenitic Stainless (304/316 conservative default)"
  },
  duplex_ss: {
    yieldStrengthMPa: 450,
    kICMPaSqrtM: 100,
    parisC: 4.0e-12,
    parisM: 3.0,
    tMeltC: 1400,
    label: "Duplex SS (2205 conservative default)"
  },
  nickel_alloy: {
    yieldStrengthMPa: 550,
    kICMPaSqrtM: 120,
    parisC: 2.0e-12,
    parisM: 3.0,
    tMeltC: 1350,
    label: "Nickel Alloy (625/825 conservative default)"
  },
  high_strength: {
    yieldStrengthMPa: 900,
    kICMPaSqrtM: 60,
    parisC: 5.0e-12,
    parisM: 3.0,
    tMeltC: 1500,
    label: "High Strength Steel (>690 MPa — H embrittlement risk)"
  },
  unknown: {
    yieldStrengthMPa: 200,
    kICMPaSqrtM: 40,
    parisC: 1.0e-11,
    parisM: 3.0,
    tMeltC: 1500,
    label: "UNKNOWN MATERIAL — Ultra-Conservative Defaults Applied"
  }
};

// Stress concentration factors by component
const KT_DEFAULTS: Record<string, number> = {
  weld_toe: 2.5,
  weld_root: 3.0,
  nozzle: 3.5,
  thread: 4.0,
  fillet: 2.0,
  notch: 3.0,
  smooth: 1.0,
  unknown: 2.5
};

// ================================================================
// SECTION 2: ENGINE TYPE INTERFACES
// ================================================================

interface E1StressResult {
  hoopStressMPa: number | null;
  longitudinalStressMPa: number | null;
  ktFactor: number;
  effectiveStressMPa: number;
  stressRangeMPa: number;
  stressRatioR: number | null;
  dominantLoadMode: string;
  assumptions: string[];
  confidence: number;
}

interface E2FailureModeResult {
  primaryMode: string;
  primaryConfidence: number;
  secondaryMode: string | null;
  environmentSeverity: string;
  crackGrowthLaw: string;
  parisC: number;
  parisM: number;
  envFactor: number;
  recommendedNDTMethod: string;
  assumptions: string[];
}

interface E3FractureResult {
  kI: number | null;
  kIC: number;
  kr: number | null;
  lr: number;
  fadSafetyMarginPct: number | null;
  fadStatus: string;
  proximityToBoundary: string;
  assessmentLevel: number;
  hardGate: boolean;
  hardGateReason: string;
  assumptions: string[];
}

interface E4FFSResult {
  apiPart: string;
  disposition: string;
  rsf: number | null;
  correctedMAWP: number | null;
  ffsVerdict: string;
  hardGate: boolean;
  assumptions: string[];
}

interface E5LifeResult {
  cyclesRemainingLow: number | null;
  cyclesRemainingBest: number | null;
  calendarMonthsLow: number | null;
  calendarMonthsBest: number | null;
  minerDamageFraction: number | null;
  corrosionRateMmYear: number | null;
  criticalFlawSizeMM: number | null;
  hardGate: boolean;
  hardGateReason: string;
  assumptions: string[];
}

interface E6RiskResult {
  pofCategory: number;
  cofCategory: number;
  riskScore: number;
  riskLevel: string;
  inspectionIntervalMonths: number;
  actionPriority: string;
  hardGate: boolean;
}

interface E7IntegrityResult {
  allAssumptions: string[];
  domainViolations: string[];
  kIUncertaintyLow: number | null;
  kIUncertaintyHigh: number | null;
  lifeUncertaintyLowMonths: number | null;
  lifeUncertaintyHighMonths: number | null;
  evidenceIntegrityScore: number;
  evidenceIntegrityLabel: string;
  auditTrail: string[];
  hardGate: boolean;
}

interface ArbitrationResult {
  engineeringOverrideFlag: boolean;
  overrideReason: string;
  finalDisposition: string;
  finalSignificance: string;
  restrictions: string[];
  disagreementSummary: string;
  requiresEngineeringSignoff: boolean;
}

interface EngineeringOutput {
  caseId: string;
  engineeringSignificance: string;
  dominantFailureMode: string;
  failureModeConfidencePct: number;
  safetyMarginPct: number | null;
  remainingLifeSummary: string;
  riskRanking: string;
  engineeringVerdict: string;
  engineeringRestrictions: string[];
  engineeringOverrideFlag: boolean;
  overrideReason: string;
  ffsLevel: string;
  primaryAuthority: string;
  inspectionIntervalMonths: number;
  recommendedNDTMethod: string;
  evidenceIntegrityScore: number;
  evidenceIntegrityLabel: string;
  assumptionFlags: string[];
  domainViolations: string[];
  auditTrail: string[];
  arbitration: ArbitrationResult;
  simpleNarrative: string;
  expertNarrative: string;
  e1: E1StressResult;
  e2: E2FailureModeResult;
  e3: E3FractureResult;
  e4: E4FFSResult;
  e5: E5LifeResult;
  e6: E6RiskResult;
  e7: E7IntegrityResult;
}

// ================================================================
// ENGINE 1: STRESS STATE ENGINE
// ================================================================
// PURPOSE: Resolve full stress state at flaw location.
// All downstream engines are invalid without this foundation.
// ================================================================

function runE1(input: any): E1StressResult {
  const assumptions: string[] = [];
  const mat = MATERIAL_DEFAULTS[input.materialClass || "unknown"];

  // Determine stress concentration factor
  let kt = 2.5;
  const compType = (input.componentType || "").toLowerCase();
  for (const key of Object.keys(KT_DEFAULTS)) {
    if (compType.includes(key)) { kt = KT_DEFAULTS[key]; break; }
  }
  if (!input.componentType || compType === "unknown") {
    assumptions.push("Stress concentration Kt=2.5 assumed (weld toe default) — actual component geometry not specified");
  }

  let hoopStress: number | null = null;
  let longStress: number | null = null;
  let effectiveStress = 0;
  let stressRange = 0;
  let stressRatioR: number | null = null;
  let dominantMode = "UNKNOWN";
  let confidenceScore = 0.1;

  // --- Pressure vessel calculation (if geometry provided) ---
  if (input.operatingPressureMPa && input.wallThicknessMM && input.outsideDiameterMM) {
    const P = Number(input.operatingPressureMPa);
    const t = Number(input.wallThicknessMM);
    const OD = Number(input.outsideDiameterMM);
    const r_inner = OD / 2 - t;
    hoopStress = (P * r_inner) / t;
    longStress = (P * r_inner) / (2 * t);
    effectiveStress = kt * hoopStress;
    dominantMode = "HOOP_PRESSURE";
    confidenceScore += 0.5;
  } else {
    // Consequence-tier based conservative estimate
    if (!input.operatingPressureMPa) assumptions.push("Operating pressure not provided — stress estimated from consequence tier");
    if (!input.wallThicknessMM) assumptions.push("Wall thickness not provided — geometry-based stress bypassed");

    const tier = (input.consequenceTier || "MODERATE").toUpperCase();
    if (tier === "CRITICAL") {
      effectiveStress = 200;
      assumptions.push("Effective stress assumed 200 MPa (CRITICAL asset — ultra-conservative pressure vessel default)");
    } else if (tier === "HIGH") {
      effectiveStress = 150;
      assumptions.push("Effective stress assumed 150 MPa (HIGH consequence conservative default)");
    } else {
      effectiveStress = 90;
      assumptions.push("Effective stress assumed 90 MPa (MODERATE consequence default)");
    }
    dominantMode = "ESTIMATED_FROM_CONSEQUENCE";
  }

  // --- Cyclic stress range ---
  if (input.stressRangeMPa) {
    stressRange = Number(input.stressRangeMPa);
    confidenceScore += 0.2;
  } else if (input.isCyclicService) {
    stressRange = effectiveStress * 0.40;
    assumptions.push("Cyclic stress range assumed 40% of effective stress — measured cycle amplitude not provided");
  } else {
    // Conservative: assume background cycling
    stressRange = effectiveStress * 0.15;
    assumptions.push("Low-amplitude cycling assumed (15% stress range) — service cycle profile not confirmed");
  }

  // --- Stress ratio R ---
  if (effectiveStress > 0 && stressRange > 0) {
    const sigMax = effectiveStress;
    const sigMin = effectiveStress - stressRange;
    stressRatioR = sigMin / sigMax;
  }

  // Confidence: sum of known inputs
  if (input.materialClass) confidenceScore += 0.1;
  if (input.stressRangeMPa) confidenceScore += 0.1;
  if (input.operatingTempC) confidenceScore += 0.05;

  return {
    hoopStressMPa: hoopStress,
    longitudinalStressMPa: longStress,
    ktFactor: kt,
    effectiveStressMPa: effectiveStress,
    stressRangeMPa: stressRange,
    stressRatioR: stressRatioR,
    dominantLoadMode: dominantMode,
    assumptions: assumptions,
    confidence: Math.min(confidenceScore, 1.0)
  };
}

// ================================================================
// ENGINE 2: FAILURE MODE IDENTIFICATION ENGINE
// ================================================================
// PURPOSE: Identify dominant damage mechanism BEFORE fracture
// mechanics runs. Wrong failure mode = wrong Paris Law constants =
// remaining life overestimate by orders of magnitude (SCC case).
// This is the non-obvious sequencing decision.
// ================================================================

function runE2(input: any): E2FailureModeResult {
  const assumptions: string[] = [];
  const matClass = (input.materialClass || "unknown").toLowerCase();
  const tempC = input.operatingTempC ? Number(input.operatingTempC) : 20;
  const chloride = input.chloridePPM ? Number(input.chloridePPM) : 0;
  const h2s = input.h2sPartialPressureMPa ? Number(input.h2sPartialPressureMPa) : 0;
  const pH = input.pH ? Number(input.pH) : 7;
  const isCyclic = input.isCyclicService === true || input.isCyclicService === "true";
  const narrative = (input.incidentNarrative || "").toLowerCase();
  const mat = MATERIAL_DEFAULTS[matClass] || MATERIAL_DEFAULTS["unknown"];

  let primaryMode = "MECHANICAL_FATIGUE";
  let primaryConf = 0.50;
  let secondaryMode: string | null = null;
  let envSeverity = "LOW";
  let crackLaw = "PARIS_AIR";
  let parisC = mat.parisC;
  let parisM = mat.parisM;
  let envFactor = 1.0;
  let ndtMethod = "MT_PT";

  // ---- SCC Decision (susceptible material + tensile stress + environment) ----
  const sccChlorideSS = (matClass === "austenitic_ss" || matClass === "duplex_ss") &&
    chloride > 50 && tempC > 60;
  const sccH2SSteel = (matClass === "carbon_steel" || matClass === "low_alloy") &&
    h2s > 0.0003;
  const sccDuplexHigh = matClass === "duplex_ss" && chloride > 200 && tempC > 80;
  const sccNickelH2S = matClass === "nickel_alloy" && h2s > 0.001;
  const sccKeyword = narrative.includes("scc") || narrative.includes("stress corrosion") ||
    narrative.includes("branching") || narrative.includes("intergranular");
  const sccRisk = sccChlorideSS || sccH2SSteel || sccDuplexHigh || sccNickelH2S || sccKeyword;

  // ---- HIC Decision (H2S + susceptible steel — no stress required) ----
  const hicRisk = (matClass === "carbon_steel" || matClass === "low_alloy") && h2s > 0.0003;
  const hicKeyword = narrative.includes("hic") || narrative.includes("hydrogen induced") ||
    narrative.includes("blister") || narrative.includes("step crack");

  // ---- Corrosion Fatigue (aqueous environment + cyclic) ----
  const corrFatigue = isCyclic && (chloride > 100 || h2s > 0 ||
    narrative.includes("wet") || narrative.includes("aqueous"));

  // ---- Creep (T > 0.4 * Tmelt) ----
  const creepTemp = 0.4 * mat.tMeltC;
  const creepRisk = tempC > creepTemp || narrative.includes("creep") ||
    narrative.includes("elevated temperature");

  // ---- Hydrogen Embrittlement (high strength + H source) ----
  const heRisk = (mat.yieldStrengthMPa > 900 || matClass === "high_strength") &&
    (h2s > 0 || narrative.includes("cathodic") || narrative.includes("h embrittlement"));

  // ---- Pitting Corrosion ----
  const pittingRisk = (matClass === "austenitic_ss" || matClass === "duplex_ss") &&
    chloride > 100;
  const pittingKeyword = narrative.includes("pitting") || narrative.includes("pit");

  // ---- Erosion-Corrosion ----
  const erosionRisk = narrative.includes("erosion") || narrative.includes("velocity") ||
    narrative.includes("flow accelerated");

  // ---- DECISION TREE (priority order) ----

  if (hicRisk || hicKeyword) {
    primaryMode = "HYDROGEN_INDUCED_CRACKING";
    primaryConf = hicKeyword ? 0.80 : 0.70;
    envSeverity = "HIGH";
    crackLaw = "HIC_PROPAGATION";
    parisC = 2.0e-10;
    parisM = 2.0;
    envFactor = 20.0;
    ndtMethod = "UT_TOFD_ASCAN";
    secondaryMode = sccH2SSteel ? "SSC_SULFIDE_STRESS_CRACKING" : null;
    assumptions.push("HIC risk from H2S exposure in susceptible steel — stepwise subsurface cracking pattern expected");
    if (!input.chloridePPM && !input.h2sPartialPressureMPa) {
      primaryConf = 0.55;
      assumptions.push("H2S partial pressure not measured — HIC threshold (0.0003 MPa H2S) may or may not be exceeded");
    }
  } else if (sccRisk) {
    primaryMode = "STRESS_CORROSION_CRACKING";
    primaryConf = sccKeyword ? 0.82 : 0.72;
    envSeverity = "HIGH";
    crackLaw = "SCC_SUSTAINED_LOAD";
    parisC = 1.0e-10;
    parisM = 2.0;
    envFactor = 50.0;
    ndtMethod = "TOFD_AET_MONITORING";
    if (isCyclic) secondaryMode = "CORROSION_FATIGUE";
    assumptions.push("SCC assumed active: K_ISCC threshold not confirmed — sustained load crack growth rate applied");
    assumptions.push("SCC growth rate 50x faster than air fatigue — remaining life may be significantly less than fatigue-only estimate");
  } else if (creepRisk) {
    primaryMode = "CREEP_DAMAGE";
    primaryConf = narrative.includes("creep") ? 0.78 : 0.65;
    envSeverity = "MODERATE";
    crackLaw = "LARSON_MILLER_CREEP";
    parisC = 1.0e-10;
    parisM = 2.5;
    envFactor = 3.0;
    ndtMethod = "UT_CREEP_WAVE_HARDNESS";
    assumptions.push("Creep damage assumed: operating temperature exceeds 40% of absolute melting point");
    assumptions.push("Larson-Miller parameter calculation requires time-at-temperature history — estimated from service years");
  } else if (heRisk) {
    primaryMode = "HYDROGEN_EMBRITTLEMENT";
    primaryConf = 0.65;
    envSeverity = "HIGH";
    crackLaw = "BRITTLE_FRACTURE_HYDROGEN";
    parisC = 5.0e-10;
    parisM = 2.0;
    envFactor = 10.0;
    ndtMethod = "HARDNESS_UT_VELOCITY_IMPACT";
    assumptions.push("H embrittlement risk in high-strength steel — yield strength >900 MPa with H source present");
  } else if (corrFatigue) {
    primaryMode = "CORROSION_FATIGUE";
    primaryConf = 0.65;
    envSeverity = "MODERATE";
    crackLaw = "PARIS_ENVIRONMENT_CORRECTED";
    parisC = parisC * 5.0;
    envFactor = 5.0;
    ndtMethod = "TOFD_UT_IMMERSION_PT";
    if (sccRisk) secondaryMode = "SCC_INITIATION";
    assumptions.push("Corrosion fatigue: Paris Law air constants multiplied by environmental factor 5x");
  } else if (pittingRisk || pittingKeyword) {
    primaryMode = "PITTING_CORROSION";
    primaryConf = pittingKeyword ? 0.75 : 0.60;
    envSeverity = "MODERATE";
    crackLaw = "PIT_GROWTH_TO_CRACK";
    parisC = mat.parisC;
    envFactor = 2.0;
    ndtMethod = "UT_CSCAN_PAUT_THICKNESS";
    assumptions.push("Pitting assessed as hemispherical pit growth — pit-to-crack transition depends on pit depth/stress state");
  } else if (erosionRisk) {
    primaryMode = "EROSION_CORROSION";
    primaryConf = 0.70;
    envSeverity = "MODERATE";
    crackLaw = "WALL_LOSS_PROJECTION";
    envFactor = 3.0;
    ndtMethod = "UT_THICKNESS_MAPPING";
    assumptions.push("Erosion-corrosion identified from flow disruption indicators — velocity and fluid abrasivity not quantified");
  } else if (isCyclic) {
    primaryMode = "MECHANICAL_FATIGUE";
    primaryConf = 0.72;
    envSeverity = "LOW";
    crackLaw = "PARIS_AIR";
    envFactor = 1.0;
    ndtMethod = "MT_PT_TOFD";
  } else {
    primaryMode = "STATIC_OVERLOAD_OR_UNKNOWN";
    primaryConf = 0.40;
    ndtMethod = "VT_MT_UT_PAUT";
    assumptions.push("No cyclic service or environmental trigger confirmed — static overload or unknown mechanism assessed");
  }

  // Confidence penalties for missing data
  if (!input.materialClass) {
    primaryConf *= 0.70;
    assumptions.push("Material class unknown — failure mode confidence reduced; conservative defaults applied");
  }
  if (!input.operatingTempC) {
    assumptions.push("Operating temperature not provided — creep and SCC temperature checks may be inaccurate");
  }
  if (!input.chloridePPM && !input.h2sPartialPressureMPa && !input.pH) {
    assumptions.push("No chemistry data provided — environment-assisted failure modes assessed from asset class and narrative only");
  }

  return {
    primaryMode: primaryMode,
    primaryConfidence: primaryConf,
    secondaryMode: secondaryMode,
    environmentSeverity: envSeverity,
    crackGrowthLaw: crackLaw,
    parisC: parisC,
    parisM: parisM,
    envFactor: envFactor,
    recommendedNDTMethod: ndtMethod,
    assumptions: assumptions
  };
}

// ================================================================
// ENGINE 3: FRACTURE MECHANICS ENGINE (FAD APPROACH)
// ================================================================
// PURPOSE: Determine if detected flaw is safe under service conditions.
// BS 7910 / API 579 Failure Assessment Diagram.
// Kr > 0.9 triggers hard gate to Level 3 review — CANNOT BE BYPASSED.
// ================================================================

function fadLine(lr: number): number {
  // BS 7910 / API 579 Level 2 FAD failure line
  if (lr >= 1.0) return 0.0;  // plastic collapse zone
  const term1 = 1.0 - 0.14 * lr * lr;
  const term2 = 0.3 + 0.7 * Math.exp(-0.65 * Math.pow(lr, 6.0));
  return term1 * term2;
}

function runE3(input: any, e1: E1StressResult, e2: E2FailureModeResult): E3FractureResult {
  const assumptions: string[] = [];
  const mat = MATERIAL_DEFAULTS[input.materialClass || "unknown"];
  const kIC = input.fractureToughnessMPa ? Number(input.fractureToughnessMPa) : mat.kICMPaSqrtM;
  const sigYS = input.yieldStrengthMPa ? Number(input.yieldStrengthMPa) : mat.yieldStrengthMPa;

  if (!input.fractureToughnessMPa) {
    assumptions.push("Fracture toughness K_IC from generic table: " + kIC + " MPa.sqrt(m) (" + mat.label + ") — mill certificate values preferred; actual toughness may differ");
  }
  if (!input.yieldStrengthMPa) {
    assumptions.push("Yield strength from class default: " + sigYS + " MPa — actual cert value required for Level 2 assessment");
  }

  const sigEff = e1.effectiveStressMPa;
  const lr = Math.min(sigEff / sigYS, 1.2);  // cap at 1.2 (outside FAD = plastic collapse)

  // Surface crack geometry factor F (Raju-Newman conservative for surface crack)
  const F = 1.12;
  let kI: number | null = null;
  let kr: number | null = null;
  let fadSafetyMarginPct: number | null = null;
  let fadStatus = "INSUFFICIENT_FLAW_DATA";
  let proximityToBoundary = "UNKNOWN — flaw dimensions not provided";
  let assessmentLevel = 1;
  let hardGate = false;
  let hardGateReason = "";

  // --- Critical crack size (ac): K_IC = sigma * F * sqrt(pi * ac)
  const ac_m = Math.pow(kIC / (sigEff * F), 2.0) / Math.PI;
  const ac_mm = ac_m * 1000;

  // --- K_I calculation ---
  let a_m: number;
  if (input.flawDepthMM) {
    a_m = Number(input.flawDepthMM) / 1000.0;
    if (!input.flawLengthMM) {
      assumptions.push("Flaw aspect ratio assumed 1:2 (depth:length) — through-sizing not confirmed");
    }
  } else if (input.flawLengthMM) {
    a_m = Number(input.flawLengthMM) / 2000.0;  // half-crack from total length
    assumptions.push("Flaw depth estimated as half of reported length — surface breaking assumed; embedded crack depth may differ");
  } else {
    // No flaw size — use minimum detectable conservative
    a_m = 0.003;  // 3mm conservative minimum
    assumptions.push("Flaw dimensions not measured — fracture mechanics uses conservative assumed minimum (a=3mm); actual flaw may be larger and safety margin lower");
  }

  kI = sigEff * F * Math.sqrt(Math.PI * a_m);
  kr = kI / kIC;

  // FAD safety margin
  const fadLimitAtLr = fadLine(lr);
  if (fadLimitAtLr > 0 && kr !== null) {
    fadSafetyMarginPct = Math.max(0, (1.0 - kr / fadLimitAtLr) * 100.0);
  } else if (lr >= 1.0) {
    fadSafetyMarginPct = 0;
  }

  // FAD status classification
  if (lr >= 1.0) {
    fadStatus = "PLASTIC_COLLAPSE_ZONE";
    proximityToBoundary = "OUTSIDE FAD — Plastic collapse risk. L_r >= 1.0";
    hardGate = true;
    hardGateReason = "L_r >= 1.0: stress exceeds yield strength — plastic collapse possible";
    assessmentLevel = 3;
  } else if (kr !== null && kr > 0.90) {
    fadStatus = "NEAR_FAILURE_BOUNDARY";
    proximityToBoundary = "CRITICAL: within 10% of FAD failure line — Level 3 review mandatory";
    hardGate = true;
    hardGateReason = "K_r > 0.90: assessment point within 10% of FAD failure boundary — hard gate per BS 7910 / API 579";
    assessmentLevel = 3;
  } else if (kr !== null && kr > 0.70) {
    fadStatus = "ELEVATED_PROXIMITY";
    proximityToBoundary = "HIGH: within 30% of FAD failure line";
    assessmentLevel = 2;
  } else if (kr !== null && kr > 0.50) {
    fadStatus = "MODERATE_MARGIN";
    proximityToBoundary = "MODERATE: acceptable margin exists — monitor";
    assessmentLevel = 2;
  } else if (kr !== null) {
    fadStatus = "ADEQUATE_MARGIN";
    proximityToBoundary = "LOW proximity — adequate fracture safety margin at current load";
    assessmentLevel = 1;
  }

  // Domain violation: EPFM should govern when L_r > 0.8
  if (lr > 0.8) {
    assumptions.push("Domain note: L_r=" + lr.toFixed(2) + " exceeds 0.8 — EPFM (J-integral) should govern; LEFM K_r is non-conservative in this plasticity regime. Engineering Level 3 assessment required.");
    if (!hardGate) {
      hardGate = true;
      hardGateReason = "L_r > 0.8: LEFM domain violation — EPFM required for valid assessment";
    }
  }

  // Environment correction on effective K_I for SCC
  if (e2.primaryMode === "STRESS_CORROSION_CRACKING" && kI !== null) {
    const kI_env = kI * Math.sqrt(e2.envFactor);  // SCC accelerates effective driving force
    if (kI_env > kIC) {
      fadStatus = "SCC_THRESHOLD_EXCEEDED";
      proximityToBoundary = "CRITICAL: Effective K_I under SCC exceeds K_IC threshold — active SCC growth expected";
      hardGate = true;
      hardGateReason = "SCC: environment-corrected K_I (" + kI_env.toFixed(1) + " MPa.sqrt(m)) exceeds K_IC (" + kIC + " MPa.sqrt(m))";
      assessmentLevel = 3;
    }
  }

  return {
    kI: kI,
    kIC: kIC,
    kr: kr,
    lr: lr,
    fadSafetyMarginPct: fadSafetyMarginPct,
    fadStatus: fadStatus,
    proximityToBoundary: proximityToBoundary,
    assessmentLevel: assessmentLevel,
    hardGate: hardGate,
    hardGateReason: hardGateReason,
    assumptions: assumptions,
  };
}

// ================================================================
// ENGINE 4: FFS ASSESSMENT ENGINE (API 579-1 / ASME FFS-1)
// ================================================================
// PURPOSE: Apply correct API 579 Part by flaw type.
// Level 1 = screening. Level 2 = FAD-based. Level 3 = escalate.
// Multi-flaw proximity rule: combined before individual assessment.
// ================================================================

function runE4(input: any, e1: E1StressResult, e3: E3FractureResult): E4FFSResult {
  const assumptions: string[] = [];
  const flawType = (input.flawType || "crack").toLowerCase();
  const narrative = (input.incidentNarrative || "").toLowerCase();
  const tier = (input.consequenceTier || "MODERATE").toUpperCase();

  let apiPart = "Part 9 (Crack-Like Flaws)";
  let disposition = "MONITOR";
  let rsf: number | null = null;
  let correctedMAWP: number | null = null;
  let ffsVerdict = "INDETERMINATE";
  let hardGate = false;

  // --- Route to correct API 579 Part ---
  const isMetalLoss = flawType.includes("corrosion") || flawType.includes("metal_loss") ||
    flawType.includes("wall_loss") || flawType.includes("thinning") ||
    narrative.includes("metal loss") || narrative.includes("thinning");
  const isPitting = flawType.includes("pitting") || flawType.includes("pit") ||
    narrative.includes("pitting") || narrative.includes("pit");
  const isDent = flawType.includes("dent") || flawType.includes("deform") ||
    narrative.includes("dent") || narrative.includes("buckl");
  const isLamination = flawType.includes("lamin") || narrative.includes("lamination");
  const isWeldMisalign = narrative.includes("misalign") || narrative.includes("hi-lo") ||
    narrative.includes("offset");

  if (isMetalLoss && !isPitting) {
    apiPart = "Part 4/5 (General Metal Loss / LTA)";
    if (input.wallThicknessMM && input.minimumMeasuredThicknessMM) {
      const t_req = Number(input.wallThicknessMM) * 0.875;
      const t_mm = Number(input.minimumMeasuredThicknessMM);
      rsf = t_mm / t_req;
      if (rsf >= 0.90) {
        disposition = "ACCEPT";
        ffsVerdict = "ACCEPT — RSF above minimum threshold";
      } else {
        disposition = "DERATE_MAWP";
        if (input.operatingPressureMPa) correctedMAWP = Number(input.operatingPressureMPa) * rsf;
        ffsVerdict = "CONDITIONAL — MAWP reduction required";
        hardGate = true;
      }
    } else {
      disposition = "INSPECTION_REQUIRED";
      ffsVerdict = "INSUFFICIENT DATA — UT thickness measurement required for metal loss FFS";
      assumptions.push("Metal loss FFS (API 579 Part 4) requires minimum remaining thickness — UT thickness survey not provided");
      hardGate = true;
    }
  } else if (isPitting) {
    apiPart = "Part 6 (Pitting Corrosion)";
    rsf = 0.85;  // Conservative without pit density survey
    assumptions.push("Pitting RSF conservatively estimated 0.85 without pit density survey — API 579 Part 6 Level 2 requires projected area ratio and pit depth map");
    if (rsf >= 0.90) {
      disposition = "ACCEPT";
      ffsVerdict = "ACCEPT — conservative RSF estimate above threshold";
    } else {
      disposition = "DERATE_MAWP";
      if (input.operatingPressureMPa) correctedMAWP = Number(input.operatingPressureMPa) * rsf;
      ffsVerdict = "CONDITIONAL — RSF below 0.90; MAWP reduction or pit density survey required";
      hardGate = true;
    }
  } else if (isDent) {
    apiPart = "Part 12 (Dents and Gouges)";
    disposition = "ENGINEERING_REVIEW_REQUIRED";
    ffsVerdict = "ESCALATE — Dent/deformation assessment requires strain calculation and OD ratio measurement";
    hardGate = true;
    assumptions.push("Dent assessment (API 579 Part 12) requires measured depth/OD ratio and strain limit check — escalated to engineering review");
  } else if (isLamination) {
    apiPart = "Part 13 (Laminations)";
    disposition = "ENGINEERING_REVIEW_REQUIRED";
    ffsVerdict = "ESCALATE — Lamination requires area extent, edge distance to weld, and UT mapping";
    hardGate = true;
    assumptions.push("Lamination FFS requires detailed UT mapping of extent and proximity to welds — insufficient data for disposition");
  } else if (isWeldMisalign) {
    apiPart = "Part 8 (Weld Misalignment)";
    assumptions.push("Weld misalignment adds secondary bending stress to nominal — combined stress used in FAD");
    // Fall through to crack-like FAD assessment with elevated stress
    apiPart = "Part 8 + Part 9 (Misalignment + Crack-Like)";
  }

  // --- Default to Part 9 crack-like FAD assessment ---
  if (disposition === "MONITOR" || disposition === "INDETERMINATE") {
    if (e3.kr !== null) {
      if (e3.fadSafetyMarginPct !== null && e3.fadSafetyMarginPct > 50) {
        disposition = "ACCEPT";
        ffsVerdict = "ACCEPT — FAD safety margin " + e3.fadSafetyMarginPct.toFixed(0) + "%";
      } else if (e3.kr < 0.50) {
        disposition = "ACCEPT";
        ffsVerdict = "ACCEPT — K_r " + e3.kr.toFixed(3) + " is well within FAD boundary";
      } else if (e3.kr < 0.70) {
        disposition = "ACCEPT_WITH_MONITORING";
        ffsVerdict = "ACCEPT WITH MONITORING — K_r " + e3.kr.toFixed(3) + " moderate; re-inspect within calculated interval";
      } else if (e3.kr < 0.90) {
        disposition = "RESTRICTED_OPERATION";
        ffsVerdict = "RESTRICTED — K_r " + e3.kr.toFixed(3) + "; operating restrictions required; engineering review recommended";
        hardGate = true;
      } else {
        disposition = "OUT_OF_SERVICE_ENGINEERING_REVIEW";
        ffsVerdict = "REJECT — K_r " + e3.kr.toFixed(3) + " at or beyond FAD failure boundary; take out of service";
        hardGate = true;
      }
    } else {
      disposition = "INSUFFICIENT_DATA_FOR_DISPOSITION";
      ffsVerdict = "INDETERMINATE — Flaw geometry and stress data insufficient for formal FFS assessment";
      assumptions.push("API 579 Level 2 FAD disposition requires measured flaw size and stress data — qualitative disposition only");
    }
  }

  // CRITICAL tier override: ACCEPT always needs engineering sign-off
  if (tier === "CRITICAL" && (disposition === "ACCEPT" || disposition === "ACCEPT_WITH_MONITORING")) {
    disposition = disposition + "_ENGINEERING_SIGNOFF_REQUIRED";
    ffsVerdict = ffsVerdict + " [CRITICAL asset: engineering sign-off required before return to service]";
  }

  return {
    apiPart: apiPart,
    disposition: disposition,
    rsf: rsf,
    correctedMAWP: correctedMAWP,
    ffsVerdict: ffsVerdict,
    hardGate: hardGate,
    assumptions: assumptions
  };
}

// ================================================================
// ENGINE 5: REMAINING LIFE + DAMAGE ACCUMULATION ENGINE
// ================================================================
// PURPOSE: Convert safety margin into time — how long before critical?
// Paris Law integration from a_0 to a_c.
// Environment factor from E2 applied to crack growth rate.
// Gate: life < 2x inspection interval → auto-escalate.
// ================================================================

function runE5(input: any, e1: E1StressResult, e2: E2FailureModeResult, e3: E3FractureResult): E5LifeResult {
  const assumptions: string[] = [];
  let cyclesLow: number | null = null;
  let cyclesBest: number | null = null;
  let calMonthsLow: number | null = null;
  let calMonthsBest: number | null = null;
  let minerD: number | null = null;
  let corrRate: number | null = null;
  let hardGate = false;
  let hardGateReason = "";

  const mat = MATERIAL_DEFAULTS[input.materialClass || "unknown"];
  const parisC = e2.parisC;
  const parisM = e2.parisM;
  const envFactor = e2.envFactor;
  const deltaSig = e1.stressRangeMPa;
  const sigEff = e1.effectiveStressMPa;
  const kIC = e3.kIC;
  const F = 1.12;

  // --- Critical crack size (fracture mechanics limit) ---
  const ac_m = Math.pow(kIC / (sigEff * F), 2.0) / Math.PI;
  const ac_mm = ac_m * 1000.0;

  // --- Initial flaw size ---
  let a0_m: number;
  if (input.flawDepthMM) {
    a0_m = Number(input.flawDepthMM) / 1000.0;
    if (a0_m >= ac_m) {
      // Flaw is already at or beyond critical size
      hardGate = true;
      hardGateReason = "CRITICAL: Detected flaw size (" + input.flawDepthMM + "mm) at or above critical flaw size (" + ac_mm.toFixed(1) + "mm) — immediate engineering review required";
      return {
        cyclesRemainingLow: 0,
        cyclesRemainingBest: 0,
        calendarMonthsLow: 0,
        calendarMonthsBest: 0,
        minerDamageFraction: 1.0,
        corrosionRateMmYear: null,
        criticalFlawSizeMM: ac_mm,
        hardGate: true,
        hardGateReason: hardGateReason,
        assumptions: assumptions
      };
    }
  } else if (input.flawLengthMM) {
    a0_m = Number(input.flawLengthMM) / 2000.0;
    assumptions.push("Initial crack size estimated from flaw length (half-crack assumption) — depth measurement preferred");
  } else {
    a0_m = 0.003;  // 3mm conservative minimum
    assumptions.push("Initial flaw size assumed 3mm (conservative minimum detectable) — actual flaw may be larger; life estimate is an upper bound");
  }

  // --- Paris Law integration (a_0 → a_c) ---
  // For m=3: N = (2 / (C * (F * Dsig * sqrt(pi))^3)) * (1/sqrt(a0) - 1/sqrt(ac))
  let N_best: number | null = null;

  if (deltaSig > 0 && parisC > 0 && ac_m > a0_m) {
    if (Math.abs(parisM - 3.0) < 0.15) {
      // m=3 closed form
      const groupTerm = Math.pow(F * deltaSig * Math.sqrt(Math.PI), 3.0);
      if (groupTerm > 0) {
        N_best = (2.0 / (parisC * groupTerm)) * (1.0 / Math.sqrt(a0_m) - 1.0 / Math.sqrt(ac_m));
      }
    } else if (Math.abs(parisM - 2.0) < 0.15) {
      // m=2 closed form
      const groupTerm = Math.pow(F * deltaSig * Math.sqrt(Math.PI), 2.0);
      if (groupTerm > 0) {
        N_best = (1.0 / (parisC * groupTerm)) * Math.log(ac_m / a0_m);
      }
    } else {
      // General: trapezoidal integration (30 steps)
      const steps = 30;
      const da = (ac_m - a0_m) / steps;
      let sum = 0.0;
      let a = a0_m + da / 2.0;
      for (let i = 0; i < steps; i++) {
        const dK = F * deltaSig * Math.sqrt(Math.PI * a);
        sum += da / (parisC * Math.pow(dK, parisM));
        a += da;
      }
      N_best = sum;
    }

    if (N_best !== null && N_best > 0) {
      cyclesBest = N_best;
      cyclesLow = N_best / envFactor;  // Environment reduces life by envFactor

      // Convert to calendar time
      const defaultCyclesPerDay = input.isCyclicService ? 200 : 20;
      const cyclesPerDay = input.cyclesPerDay ? Number(input.cyclesPerDay) : defaultCyclesPerDay;
      if (!input.cyclesPerDay) {
        assumptions.push("Cycles per day assumed " + cyclesPerDay + "/day — actual cycle rate required for accurate calendar life");
      }
      calMonthsBest = Math.min(cyclesBest / cyclesPerDay / 30.0, 1200);
      calMonthsLow = Math.min(cyclesLow / cyclesPerDay / 30.0, 1200);
    }
  } else {
    assumptions.push("Stress range insufficient for Paris Law integration — life estimate not computed");
  }

  // --- Miner's Rule damage fraction ---
  const serviceYrs = input.serviceYears ? Number(input.serviceYears) : 5;
  const serviceMonths = serviceYrs * 12.0;
  if (calMonthsBest && calMonthsBest > 0) {
    minerD = serviceMonths / (serviceMonths + calMonthsBest);
  }

  // --- Corrosion rate projection (wall loss) ---
  if (input.wallThicknessMM && input.serviceYears &&
    (e2.primaryMode !== "MECHANICAL_FATIGUE" && e2.primaryMode !== "STATIC_OVERLOAD_OR_UNKNOWN")) {
    const tNom = Number(input.wallThicknessMM);
    const approxLoss = tNom * 0.06;  // 6% conservative service loss estimate
    corrRate = approxLoss / serviceYrs;
    const tMin = tNom * 0.875;
    const tCurrent = tNom - approxLoss;
    if (corrRate > 0 && tCurrent > tMin) {
      const yearsToTmin = (tCurrent - tMin) / corrRate;
      const corrMonths = yearsToTmin * 12.0;
      // Use corrosion life if shorter than fatigue life
      if (calMonthsBest === null || corrMonths < calMonthsBest) {
        calMonthsBest = corrMonths;
        calMonthsLow = corrMonths * 0.50;
        assumptions.push("Corrosion life controls over fatigue life — wall loss rate estimated from service age; UT thickness survey required");
      }
    }
    assumptions.push("Corrosion rate estimated from nominal wall and service age — actual thickness readings required for accurate wall loss projection");
  }

  // --- Hard gate: life < 2x standard inspection interval ---
  const inspIntervalMonths = 12;
  if (calMonthsLow !== null && calMonthsLow < 2 * inspIntervalMonths) {
    hardGate = true;
    hardGateReason = "Remaining life lower bound (" + calMonthsLow.toFixed(0) + " months) is less than 2x inspection interval (" + (2 * inspIntervalMonths) + " months) — inspection frequency escalation required";
  }

  return {
    cyclesRemainingLow: cyclesLow,
    cyclesRemainingBest: cyclesBest,
    calendarMonthsLow: calMonthsLow,
    calendarMonthsBest: calMonthsBest,
    minerDamageFraction: minerD,
    corrosionRateMmYear: corrRate,
    criticalFlawSizeMM: ac_mm,
    hardGate: hardGate,
    hardGateReason: hardGateReason,
    assumptions: assumptions
  };
}

// ================================================================
// ENGINE 6: RISK ASSESSMENT ENGINE (API 580/581 RBI)
// ================================================================
// PURPOSE: PoF x CoF matrix → action priority and inspection interval.
// Drives from engineering reality, not just code verdict.
// ================================================================

function runE6(input: any, e3: E3FractureResult, e5: E5LifeResult): E6RiskResult {
  const narrative = (input.incidentNarrative || "").toLowerCase();
  const tier = (input.consequenceTier || "MODERATE").toUpperCase();

  // --- Probability of Failure (1–5 scale) ---
  let pof = 2;
  if (e3.kr !== null) {
    if (e3.kr > 0.90) pof = 5;
    else if (e3.kr > 0.70) pof = 4;
    else if (e3.kr > 0.50) pof = 3;
    else if (e3.kr > 0.30) pof = 2;
    else pof = 1;
  } else {
    // Fallback: consequence tier proxy
    if (tier === "CRITICAL") pof = 3;
    else if (tier === "HIGH") pof = 2;
    else pof = 2;
  }

  // Life-based PoF boost
  if (e5.calendarMonthsLow !== null) {
    if (e5.calendarMonthsLow < 6) pof = Math.min(5, pof + 2);
    else if (e5.calendarMonthsLow < 12) pof = Math.min(5, pof + 2);
    else if (e5.calendarMonthsLow < 24) pof = Math.min(5, pof + 1);
  }

  // Hard gate modes boost PoF
  if (e3.hardGate) pof = Math.min(5, pof + 1);
  if (e5.hardGate) pof = Math.min(5, pof + 1);

  // --- Consequence of Failure (1–5 scale) ---
  let cof = 3;  // default moderate
  if (tier === "CRITICAL") cof = 5;
  else if (tier === "HIGH") cof = 4;
  else if (tier === "MODERATE") cof = 3;
  else if (tier === "LOW") cof = 2;

  // Asset class modifiers
  const assetClass = (input.assetClass || "").toLowerCase();
  if (assetClass.includes("pvho") || assetClass.includes("decompression") ||
    assetClass.includes("chamber")) cof = Math.min(5, cof + 1);
  if (assetClass.includes("offshore") || assetClass.includes("subsea")) cof = Math.min(5, cof + 1);
  if (assetClass.includes("bridge") || assetClass.includes("railroad")) cof = Math.min(5, cof + 1);

  // Fluid/content modifiers
  if (narrative.includes("h2s") || narrative.includes("toxic") ||
    narrative.includes("lethal")) cof = Math.min(5, cof + 1);
  if (narrative.includes("flammable") || narrative.includes("hydrocarbon") ||
    narrative.includes("crude")) cof = Math.min(5, cof + 1);

  // --- Risk matrix ---
  const riskScore = pof * cof;
  let riskLevel = "LOW";
  if (riskScore >= 20) riskLevel = "CRITICAL";
  else if (riskScore >= 12) riskLevel = "HIGH";
  else if (riskScore >= 6) riskLevel = "MEDIUM";
  else riskLevel = "LOW";

  // --- Inspection interval and action ---
  let intervalMonths = 12;
  let actionPriority = "ROUTINE_INSPECTION";
  let hardGate = false;

  const lifeMonths = e5.calendarMonthsLow || 48;

  if (riskLevel === "CRITICAL") {
    intervalMonths = 0;
    actionPriority = "IMMEDIATE_OUT_OF_SERVICE";
    hardGate = true;
  } else if (riskLevel === "HIGH") {
    intervalMonths = Math.max(1, Math.round(lifeMonths * 0.25));
    actionPriority = "EXPEDITED_ENGINEERING_SIGNOFF_REQUIRED";
    hardGate = true;
  } else if (riskLevel === "MEDIUM") {
    intervalMonths = Math.max(3, Math.round(lifeMonths * 0.50));
    actionPriority = "NEXT_SCHEDULED_WITH_MONITORING";
  } else {
    intervalMonths = 12;
    actionPriority = "ROUTINE_CODE_SCHEDULE";
  }

  return {
    pofCategory: pof,
    cofCategory: cof,
    riskScore: riskScore,
    riskLevel: riskLevel,
    inspectionIntervalMonths: intervalMonths,
    actionPriority: actionPriority,
    hardGate: hardGate
  };
}

// ================================================================
// ENGINE 7: EVIDENCE INTEGRITY + CONFIDENCE AUDIT ENGINE
// ================================================================
// PURPOSE: Audit entire chain before output locks.
// Domain violation = output blocked / conservatively overridden.
// Uncertainty propagates through K_I and remaining life.
// Low confidence never silently produces high-confidence output.
// ================================================================

function runE7(
  input: any,
  e1: E1StressResult,
  e2: E2FailureModeResult,
  e3: E3FractureResult,
  e4: E4FFSResult,
  e5: E5LifeResult
): E7IntegrityResult {
  const allAssumptions: string[] = [
    ...e1.assumptions,
    ...e2.assumptions,
    ...e3.assumptions,
    ...e4.assumptions,
    ...e5.assumptions
  ];

  const domainViolations: string[] = [];
  const auditTrail: string[] = [];
  let hardGate = false;

  // --- Domain violation checks ---
  if (e3.lr > 0.8 && e2.primaryMode !== "CREEP_DAMAGE") {
    domainViolations.push(
      "E3: LEFM applied at L_r=" + e3.lr.toFixed(2) +
      " — EPFM (J-integral / BS 7910 Level 3) should govern above L_r=0.8. Fracture result is non-conservative in this regime."
    );
    hardGate = true;
  }

  if (e2.primaryMode === "STRESS_CORROSION_CRACKING" && e2.crackGrowthLaw === "PARIS_AIR") {
    domainViolations.push(
      "E5: Paris Law air constants applied to SCC-identified case — remaining life overestimated by up to 50x. SCC growth constants required."
    );
    hardGate = true;
  }

  if (e2.primaryMode === "CREEP_DAMAGE" && e2.crackGrowthLaw !== "LARSON_MILLER_CREEP") {
    domainViolations.push(
      "E5: Fatigue-based Paris Law applied to creep-dominant case — Larson-Miller approach required for valid life estimate."
    );
  }

  if (e3.lr >= 1.0) {
    domainViolations.push(
      "E3: L_r=" + e3.lr.toFixed(2) + " >= 1.0 — FAD plastic collapse zone. Reference stress exceeds yield strength. Fracture mechanics validity limit exceeded."
    );
    hardGate = true;
  }

  // Method sufficiency check
  if (e2.primaryMode === "HYDROGEN_INDUCED_CRACKING" &&
    !(input.ndtMethodsUsed || "").toLowerCase().includes("ut")) {
    domainViolations.push(
      "E3: HIC identified but subsurface-capable method (UT/TOFD) not confirmed in evidence — surface methods (MT/PT) cannot detect subsurface HIC. Detection confidence is unreliable."
    );
  }

  // --- Audit trail (every engine, every gate) ---
  auditTrail.push("E1_STRESS: mode=" + e1.dominantLoadMode + " | sigma_eff=" + e1.effectiveStressMPa.toFixed(0) + "MPa | Kt=" + e1.ktFactor + " | confidence=" + (e1.confidence * 100).toFixed(0) + "%");
  auditTrail.push("E2_FAILURE_MODE: primary=" + e2.primaryMode + " (" + (e2.primaryConfidence * 100).toFixed(0) + "%) | env=" + e2.environmentSeverity + " | growth_law=" + e2.crackGrowthLaw + " | env_factor=" + e2.envFactor);
  auditTrail.push("E3_FRACTURE: K_I=" + (e3.kI !== null ? e3.kI.toFixed(1) : "N/A") + " | K_IC=" + e3.kIC + " | K_r=" + (e3.kr !== null ? e3.kr.toFixed(3) : "N/A") + " | L_r=" + e3.lr.toFixed(3) + " | FAD=" + e3.fadStatus + " | safety_margin=" + (e3.fadSafetyMarginPct !== null ? e3.fadSafetyMarginPct.toFixed(0) + "%" : "N/A"));
  auditTrail.push("E3_GATE: " + (e3.hardGate ? "TRIGGERED — " + e3.hardGateReason : "CLEAR"));
  auditTrail.push("E4_FFS: part=" + e4.apiPart + " | verdict=" + e4.ffsVerdict + " | RSF=" + (e4.rsf !== null ? e4.rsf.toFixed(3) : "N/A"));
  auditTrail.push("E5_LIFE: a_c=" + (e5.criticalFlawSizeMM !== null ? e5.criticalFlawSizeMM.toFixed(1) + "mm" : "N/A") + " | life_low=" + (e5.calendarMonthsLow !== null ? e5.calendarMonthsLow.toFixed(0) + "mo" : "N/A") + " | life_best=" + (e5.calendarMonthsBest !== null ? e5.calendarMonthsBest.toFixed(0) + "mo" : "N/A") + " | Miner_D=" + (e5.minerDamageFraction !== null ? e5.minerDamageFraction.toFixed(2) : "N/A"));
  auditTrail.push("E5_GATE: " + (e5.hardGate ? "TRIGGERED — " + e5.hardGateReason : "CLEAR"));
  if (domainViolations.length > 0) {
    auditTrail.push("DOMAIN_VIOLATIONS: " + domainViolations.length + " detected — see violation log");
  }
  auditTrail.push("ASSUMPTION_COUNT: " + allAssumptions.length + " total (measured inputs would reduce uncertainty)");

  // --- Uncertainty propagation for K_I ---
  let kILow: number | null = null;
  let kIHigh: number | null = null;
  if (e3.kI !== null) {
    const sizingUnc = input.sizingUncertaintyMM ? Number(input.sizingUncertaintyMM) : 1.5;  // mm default
    const a_m = input.flawDepthMM ? Number(input.flawDepthMM) / 1000.0 : 0.003;
    const dFrac = 0.5 * (sizingUnc / 1000.0) / a_m;  // fractional K_I uncertainty from sizing
    kILow = e3.kI * Math.max(0, 1.0 - dFrac);
    kIHigh = e3.kI * (1.0 + dFrac);
  }

  // --- Uncertainty on remaining life (low=conservative, high=optimistic) ---
  const lifeUncLow = e5.calendarMonthsLow;
  const lifeUncHigh = e5.calendarMonthsBest ? e5.calendarMonthsBest * 1.5 : null;  // optimistic upper

  // --- Evidence integrity score (fraction of critical inputs that are measured) ---
  let measured = 0;
  const criticalInputs = 9;
  if (input.flawDepthMM || input.flawLengthMM) measured++;
  if (input.yieldStrengthMPa) measured++;
  if (input.fractureToughnessMPa) measured++;
  if (input.operatingPressureMPa) measured++;
  if (input.wallThicknessMM) measured++;
  if (input.operatingTempC) measured++;
  if (input.stressRangeMPa) measured++;
  if (input.chloridePPM !== undefined || input.h2sPartialPressureMPa !== undefined) measured++;
  if (input.cyclesPerDay) measured++;
  const integrityScore = measured / criticalInputs;

  let integrityLabel = "CRITICAL_DATA_GAPS";
  if (integrityScore >= 0.80) integrityLabel = "HIGH_CONFIDENCE";
  else if (integrityScore >= 0.55) integrityLabel = "MODERATE_CONFIDENCE";
  else if (integrityScore >= 0.30) integrityLabel = "LOW_CONFIDENCE_CONSERVATIVE_BOUNDS";
  else integrityLabel = "CRITICAL_DATA_GAPS_ULTRA_CONSERVATIVE";

  return {
    allAssumptions: allAssumptions,
    domainViolations: domainViolations,
    kIUncertaintyLow: kILow,
    kIUncertaintyHigh: kIHigh,
    lifeUncertaintyLowMonths: lifeUncLow,
    lifeUncertaintyHighMonths: lifeUncHigh,
    evidenceIntegrityScore: integrityScore,
    evidenceIntegrityLabel: integrityLabel,
    auditTrail: auditTrail,
    hardGate: hardGate
  };
}

// ================================================================
// ARBITRATION ENGINE: NDT VERDICT vs ENGINEERING VERDICT
// ================================================================
// PURPOSE: Merge the two independent verdicts.
// Engineering Override Flag = the platform's most important output.
// When NDT code says ACCEPT but Engineering says ESCALATE/RESTRICT —
// this is the case that causes in-service failures.
// No existing commercial system surfaces this disagreement. FORGED does.
// ================================================================

function runArbitration(
  input: any,
  ndtVerdict: string,
  e3: E3FractureResult,
  e4: E4FFSResult,
  e5: E5LifeResult,
  e6: E6RiskResult,
  e7: E7IntegrityResult
): ArbitrationResult {
  let overrideFlag = false;
  let overrideReason = "";
  let finalDisposition = "HOLD_ENGINEERING_REVIEW";
  let finalSignificance = "CRITICAL";
  const restrictions: string[] = [];
  let disagreementSummary = "";
  let requiresSignoff = false;

  const ndtSaysAccept = ndtVerdict === "ACCEPT" || ndtVerdict === "GO" ||
    ndtVerdict.includes("ACCEPT");
  const engineeringSaysEscalate = e4.hardGate || e3.hardGate || e5.hardGate || e6.hardGate ||
    e7.hardGate || e6.riskLevel === "CRITICAL" || e6.riskLevel === "HIGH";
  const engineeringSaysRestrict = e6.riskLevel === "MEDIUM" || e4.disposition.includes("RESTRICTED") ||
    e4.disposition.includes("DERATE");

  // --- Engineering Override Flag logic ---
  if (ndtSaysAccept && engineeringSaysEscalate) {
    overrideFlag = true;
    overrideReason = "NDT code verdict: ACCEPT — Engineering verdict: " + e6.riskLevel + " risk";
    if (e5.calendarMonthsLow !== null && e5.calendarMonthsLow < 24) {
      overrideReason = overrideReason + " | Remaining life: " + e5.calendarMonthsLow.toFixed(0) + " months (low estimate)";
    }
    if (e3.kr !== null && e3.kr > 0.70) {
      overrideReason = overrideReason + " | FAD proximity: K_r=" + e3.kr.toFixed(3);
    }
    requiresSignoff = true;
    disagreementSummary = "CODE SAYS ACCEPT. ENGINEERING SAYS ESCALATE. This disagreement cannot be resolved without documented engineering sign-off. The final disposition is conservative (engineering governs).";
  } else if (ndtSaysAccept && engineeringSaysRestrict) {
    overrideFlag = true;
    overrideReason = "NDT code verdict: ACCEPT — Engineering assessment: operating restrictions warranted by " + e6.riskLevel + " risk and/or FFS outcome";
    requiresSignoff = true;
    disagreementSummary = "CODE SAYS ACCEPT. ENGINEERING SAYS RESTRICT. Restrictions applied. Engineering review recommended before unrestricted return to service.";
  }

  // --- Final disposition (engineering precedence under Physics-First rules) ---
  const allHardGates = e3.hardGate || e4.hardGate || e5.hardGate || e6.hardGate || e7.hardGate;

  if (allHardGates && e6.riskLevel === "CRITICAL") {
    finalDisposition = "OUT_OF_SERVICE";
    finalSignificance = "CRITICAL";
    restrictions.push("Immediate removal from service");
    restrictions.push("Emergency engineering review required");
    restrictions.push("Do not restart without written engineering authorization");
  } else if (allHardGates) {
    finalDisposition = "ENGINEERING_REVIEW_REQUIRED";
    finalSignificance = e6.riskLevel === "HIGH" ? "HIGH" : "HIGH";
    restrictions.push("No unrestricted operation until engineering review complete");
    if (e4.correctedMAWP) restrictions.push("MAWP derated to " + e4.correctedMAWP.toFixed(2) + " MPa pending review");
  } else if (e6.riskLevel === "HIGH") {
    finalDisposition = "RESTRICTED_GO_ENGINEERING_SIGNOFF";
    finalSignificance = "HIGH";
    restrictions.push("Reduced operating pressure/load required");
    restrictions.push("Expedited inspection within " + e6.inspectionIntervalMonths + " months");
    restrictions.push("Engineering sign-off required before continued service");
    requiresSignoff = true;
  } else if (e6.riskLevel === "MEDIUM") {
    finalDisposition = "GO_WITH_MONITORING";
    finalSignificance = "MODERATE";
    restrictions.push("Re-inspect within " + e6.inspectionIntervalMonths + " months");
    restrictions.push("Monitor for change in condition");
  } else {
    finalDisposition = "GO";
    finalSignificance = "LOW";
    restrictions.push("Routine inspection per code schedule");
  }

  // E7 domain violations force engineering review regardless
  if (e7.hardGate && !overrideFlag) {
    overrideFlag = true;
    overrideReason = "Engineering assessment domain violation — results may be non-conservative; engineering review required before disposition acceptance";
    finalDisposition = "ENGINEERING_REVIEW_REQUIRED";
    requiresSignoff = true;
  }

  return {
    engineeringOverrideFlag: overrideFlag,
    overrideReason: overrideReason,
    finalDisposition: finalDisposition,
    finalSignificance: finalSignificance,
    restrictions: restrictions,
    disagreementSummary: disagreementSummary,
    requiresEngineeringSignoff: requiresSignoff
  };
}

// ================================================================
// NARRATIVE GENERATOR
// ================================================================

function buildSimpleNarrative(input: any, e2: E2FailureModeResult, e3: E3FractureResult, e5: E5LifeResult, e6: E6RiskResult, arb: ArbitrationResult): string {
  let n = "";
  n = n + "The system identified " + e2.primaryMode.replace(/_/g, " ").toLowerCase();
  if (e2.secondaryMode) n = n + " with secondary " + e2.secondaryMode.replace(/_/g, " ").toLowerCase();
  n = n + " as the dominant damage mechanism. ";

  if (e3.fadSafetyMarginPct !== null) {
    n = n + "Structural safety margin is " + e3.fadSafetyMarginPct.toFixed(0) + "% (" + e3.fadStatus.replace(/_/g, " ") + "). ";
  }

  if (e5.calendarMonthsLow !== null && e5.calendarMonthsBest !== null) {
    n = n + "Estimated remaining life: " + e5.calendarMonthsLow.toFixed(0) + " to " + e5.calendarMonthsBest.toFixed(0) + " months at current growth rate. ";
  }

  n = n + "Risk ranking: " + e6.riskLevel + ". ";
  n = n + "Disposition: " + arb.finalDisposition.replace(/_/g, " ") + ". ";

  if (arb.engineeringOverrideFlag) {
    n = n + "ENGINEERING OVERRIDE ACTIVE: " + arb.overrideReason + ". Engineering sign-off required before return to service.";
  }

  return n;
}

function buildExpertNarrative(input: any, e1: E1StressResult, e2: E2FailureModeResult, e3: E3FractureResult, e4: E4FFSResult, e5: E5LifeResult, e6: E6RiskResult, e7: E7IntegrityResult, arb: ArbitrationResult): string {
  let n = "";
  n = n + "PHYSICS & STRESS: Effective stress " + e1.effectiveStressMPa.toFixed(0) + " MPa (Kt=" + e1.ktFactor + "), stress range " + e1.stressRangeMPa.toFixed(0) + " MPa, mode: " + e1.dominantLoadMode + ". ";
  n = n + "FAILURE MODE: " + e2.primaryMode + " (" + (e2.primaryConfidence * 100).toFixed(0) + "% confidence) — growth law: " + e2.crackGrowthLaw + ", env factor: " + e2.envFactor + "x. ";

  n = n + "FRACTURE MECHANICS (BS 7910/API 579 FAD): ";
  if (e3.kI !== null) n = n + "K_I=" + e3.kI.toFixed(1) + " MPa.sqrt(m), K_IC=" + e3.kIC + " MPa.sqrt(m), K_r=" + (e3.kr !== null ? e3.kr.toFixed(3) : "N/A") + ", L_r=" + e3.lr.toFixed(3) + ". ";
  if (e3.fadSafetyMarginPct !== null) n = n + "FAD safety margin: " + e3.fadSafetyMarginPct.toFixed(0) + "%. ";
  n = n + "Status: " + e3.fadStatus + ". ";
  if (e3.hardGate) n = n + "HARD GATE E3: " + e3.hardGateReason + ". ";

  n = n + "FFS ASSESSMENT: " + e4.apiPart + " — " + e4.ffsVerdict + ". ";
  if (e4.rsf !== null) n = n + "RSF=" + e4.rsf.toFixed(3) + ". ";
  if (e4.correctedMAWP !== null) n = n + "Corrected MAWP=" + e4.correctedMAWP.toFixed(2) + " MPa. ";

  n = n + "REMAINING LIFE: ";
  if (e5.criticalFlawSizeMM !== null) n = n + "Critical flaw size a_c=" + e5.criticalFlawSizeMM.toFixed(1) + "mm. ";
  if (e5.calendarMonthsLow !== null) n = n + "Life range: " + e5.calendarMonthsLow.toFixed(0) + " to " + (e5.calendarMonthsBest !== null ? e5.calendarMonthsBest.toFixed(0) : "N/A") + " months. ";
  if (e5.minerDamageFraction !== null) n = n + "Miner D=" + e5.minerDamageFraction.toFixed(2) + ". ";
  if (e5.hardGate) n = n + "HARD GATE E5: " + e5.hardGateReason + ". ";

  n = n + "RISK (API 580/581): PoF=" + e6.pofCategory + "/5, CoF=" + e6.cofCategory + "/5, Score=" + e6.riskScore + " (" + e6.riskLevel + "). Next inspection: " + (e6.inspectionIntervalMonths === 0 ? "IMMEDIATE" : e6.inspectionIntervalMonths + " months") + ". ";

  n = n + "EVIDENCE INTEGRITY: " + e7.evidenceIntegrityLabel + " (" + (e7.evidenceIntegrityScore * 100).toFixed(0) + "% of critical inputs measured). ";
  if (e7.domainViolations.length > 0) n = n + "DOMAIN VIOLATIONS: " + e7.domainViolations.join("; ") + ". ";

  n = n + "ARBITRATION: NDT verdict vs Engineering verdict — Override flag: " + (arb.engineeringOverrideFlag ? "SET" : "NOT SET") + ". ";
  if (arb.engineeringOverrideFlag) n = n + "Override reason: " + arb.overrideReason + ". ";
  n = n + "Final disposition: " + arb.finalDisposition + ". ";
  n = n + "Engineering sign-off required: " + (arb.requiresEngineeringSignoff ? "YES" : "NO") + ".";

  return n;
}

// ================================================================
// AUTHORITY RESOLVER
// ================================================================

function resolveAuthority(input: any, e2: E2FailureModeResult): string {
  const assetClass = (input.assetClass || "").toLowerCase();
  const flawType = (input.flawType || "crack").toLowerCase();

  if (assetClass.includes("bridge") || assetClass.includes("railroad")) return "AASHTO MBE / FHWA Bridge Inspector Manual";
  if (assetClass.includes("pvho") || assetClass.includes("chamber") || assetClass.includes("decompression")) return "ASME PVHO-1 / API 579 FFS";
  if (assetClass.includes("nuclear")) return "ASME Section XI";
  if (assetClass.includes("offshore") || assetClass.includes("platform")) return "API RP 2A / API 579 / BS 7910";
  if (assetClass.includes("pipeline")) return "API 1104 / API 579 / ASME B31.8";
  if (assetClass.includes("pressure") || assetClass.includes("vessel")) return "ASME VIII Div.1 / API 579-1 FFS";
  if (assetClass.includes("refinery") || assetClass.includes("piping")) return "API 579 / API 570 / API 580 RBI";

  if (e2.primaryMode === "STRESS_CORROSION_CRACKING") return "BS 7910 / API 579 / NACE MR0175";
  if (e2.primaryMode === "HYDROGEN_INDUCED_CRACKING") return "API 579 / NACE MR0175 / ISO 15156";
  if (flawType.includes("weld")) return "AWS D1.1 / API 579 Part 9 / BS 7910";

  return "API 579-1 / ASME FFS-1 (default FFS authority)";
}

// ================================================================
// SIGNIFICANCE RESOLVER
// ================================================================

function resolveEngineeringSignificance(e3: E3FractureResult, e6: E6RiskResult): string {
  if (e6.riskLevel === "CRITICAL" || e3.kr !== null && e3.kr > 0.90) return "CRITICAL";
  if (e6.riskLevel === "HIGH" || e3.kr !== null && e3.kr > 0.70) return "HIGH";
  if (e6.riskLevel === "MEDIUM" || e3.kr !== null && e3.kr > 0.50) return "MODERATE";
  return "LOW";
}

// ================================================================
// LIFE SUMMARY FORMATTER
// ================================================================

function formatLifeSummary(e5: E5LifeResult): string {
  if (e5.calendarMonthsLow === 0) return "BELOW CRITICAL SIZE — immediate action required";
  if (e5.calendarMonthsLow === null && e5.calendarMonthsBest === null) return "Cannot estimate — flaw size and stress cycle data required";

  let s = "";
  if (e5.calendarMonthsLow !== null && e5.calendarMonthsBest !== null) {
    s = e5.calendarMonthsLow.toFixed(0) + " to " + e5.calendarMonthsBest.toFixed(0) + " months";
  } else if (e5.calendarMonthsBest !== null) {
    s = "Up to " + e5.calendarMonthsBest.toFixed(0) + " months (conservative lower bound unavailable)";
  }
  if (e5.criticalFlawSizeMM !== null) {
    s = s + " (critical flaw size: " + e5.criticalFlawSizeMM.toFixed(1) + "mm)";
  }
  return s;
}

// ================================================================
// MAIN HANDLER
// ================================================================

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  // OPTIONS preflight
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

  let input: any;
  try {
    input = JSON.parse(event.body || "{}");
  } catch (parseErr) {
    return {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Invalid JSON input" })
    };
  }

  // Validate minimum required input
  if (!input.assetClass) {
    return {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "assetClass is required" })
    };
  }

  if (!input.consequenceTier) {
    input.consequenceTier = "MODERATE";
  }

  if (!input.ndtVerdict) {
    input.ndtVerdict = "INDETERMINATE";
  }

  try {
    // ---- SEQUENTIAL 7-ENGINE PIPELINE ----
    // Order is non-negotiable: E2 must precede E3 (failure mode before fracture mechanics)
    // E7 is always last — audits everything before output is locked

    const e1 = runE1(input);
    const e2 = runE2(input);
    const e3 = runE3(input, e1, e2);

    // E3 hard gate: K_r > 0.9 or domain violation — still run E4-E7 but flag escalation
    const e4 = runE4(input, e1, e3);
    const e5 = runE5(input, e1, e2, e3);
    const e6 = runE6(input, e3, e5);
    const e7 = runE7(input, e1, e2, e3, e4, e5);

    // Arbitration: merge NDT and Engineering verdicts
    const arb = runArbitration(input, input.ndtVerdict, e3, e4, e5, e6, e7);

    // Derived fields
    const engineeringSignificance = resolveEngineeringSignificance(e3, e6);
    const primaryAuthority = resolveAuthority(input, e2);
    const lifeSummary = formatLifeSummary(e5);

    const engineeringVerdict = arb.finalDisposition;
    const engineeringRestrictions = arb.restrictions;

    const simpleNarrative = buildSimpleNarrative(input, e2, e3, e5, e6, arb);
    const expertNarrative = buildExpertNarrative(input, e1, e2, e3, e4, e5, e6, e7, arb);

    const ffsLevelMap: Record<number, string> = { 1: "Level 1 (Screening)", 2: "Level 2 (FAD/Detailed)", 3: "Level 3 (Advanced — Escalate)" };
    const ffsLevel = ffsLevelMap[e3.assessmentLevel] || "Level 1";

    const output: EngineeringOutput = {
      caseId: input.caseId || ("ENG-" + Date.now().toString()),
      engineeringSignificance: engineeringSignificance,
      dominantFailureMode: e2.primaryMode,
      failureModeConfidencePct: Math.round(e2.primaryConfidence * 100),
      safetyMarginPct: e3.fadSafetyMarginPct !== null ? Math.round(e3.fadSafetyMarginPct) : null,
      remainingLifeSummary: lifeSummary,
      riskRanking: e6.riskLevel,
      engineeringVerdict: engineeringVerdict,
      engineeringRestrictions: engineeringRestrictions,
      engineeringOverrideFlag: arb.engineeringOverrideFlag,
      overrideReason: arb.overrideReason,
      ffsLevel: ffsLevel,
      primaryAuthority: primaryAuthority,
      inspectionIntervalMonths: e6.inspectionIntervalMonths,
      recommendedNDTMethod: e2.recommendedNDTMethod,
      evidenceIntegrityScore: Math.round(e7.evidenceIntegrityScore * 100),
      evidenceIntegrityLabel: e7.evidenceIntegrityLabel,
      assumptionFlags: e7.allAssumptions,
      domainViolations: e7.domainViolations,
      auditTrail: e7.auditTrail,
      arbitration: arb,
      simpleNarrative: simpleNarrative,
      expertNarrative: expertNarrative,
      e1: e1,
      e2: e2,
      e3: e3,
      e4: e4,
      e5: e5,
      e6: e6,
      e7: e7
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

  } catch (engineErr: any) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        error: "Engineering core pipeline error: " + (engineErr.message || String(engineErr)),
        caseId: input.caseId || "unknown"
      })
    };
  }
};
