// DEPLOY103 — netlify/functions/architecture-core.ts
// FORGED NDT Intelligence OS — Architectural Reality Engine v1.0
// Layer 3: System / Facility Intelligence
// Physics-First | 9-Engine Sequential Pipeline | Triple-Layer Arbitration
// STRING CONCATENATION ONLY — NO TEMPLATE LITERALS ANYWHERE
// FORGED Educational Systems — Houston, Texas
// ASNT Annual Conference Build — October 2026

import { Handler } from "@netlify/functions";

// ================================================================
// FACILITY CLASSIFICATION TABLES
// ================================================================

interface FacilityProfile {
  consequenceCategory: string;
  importanceFactor: number;
  consequenceMultiplier: number;
  regulatoryBody: string;
  governingCodes: string[];
  psmFlag: boolean;
  rmpFlag: boolean;
}

const FACILITY_PROFILES: Record<string, FacilityProfile> = {
  refinery: {
    consequenceCategory: "CRITICAL_HAZMAT",
    importanceFactor: 1.5,
    consequenceMultiplier: 2.0,
    regulatoryBody: "OSHA_PSM_EPA_RMP_API",
    governingCodes: ["API 579", "API 570", "API 510", "API 580", "ASME VIII", "NFPA"],
    psmFlag: true,
    rmpFlag: true
  },
  petrochemical: {
    consequenceCategory: "CRITICAL_HAZMAT",
    importanceFactor: 1.5,
    consequenceMultiplier: 2.0,
    regulatoryBody: "OSHA_PSM_EPA_RMP",
    governingCodes: ["API 579", "API 570", "ASME VIII", "API 580"],
    psmFlag: true,
    rmpFlag: true
  },
  offshore_platform: {
    consequenceCategory: "CRITICAL_LIFE_SAFETY",
    importanceFactor: 2.0,
    consequenceMultiplier: 2.5,
    regulatoryBody: "BSEE_USCG_API",
    governingCodes: ["API RP 2A", "API 579", "ASME IX", "API 1104"],
    psmFlag: false,
    rmpFlag: false
  },
  bridge: {
    consequenceCategory: "CRITICAL_PUBLIC_SAFETY",
    importanceFactor: 2.0,
    consequenceMultiplier: 2.5,
    regulatoryBody: "FHWA_DOT_AASHTO",
    governingCodes: ["AASHTO MBE", "AASHTO LRFD", "AWS D1.5", "FHWA BIM"],
    psmFlag: false,
    rmpFlag: false
  },
  railroad: {
    consequenceCategory: "CRITICAL_PUBLIC_SAFETY",
    importanceFactor: 2.0,
    consequenceMultiplier: 2.5,
    regulatoryBody: "FRA_AASHTO",
    governingCodes: ["AASHTO MBE", "AREMA", "FRA Track Safety Standards"],
    psmFlag: false,
    rmpFlag: false
  },
  pvho: {
    consequenceCategory: "CRITICAL_LIFE_SAFETY",
    importanceFactor: 2.5,
    consequenceMultiplier: 3.0,
    regulatoryBody: "ASME_USCG_PVHO",
    governingCodes: ["ASME PVHO-1", "ASME VIII", "API 579"],
    psmFlag: false,
    rmpFlag: false
  },
  decompression_chamber: {
    consequenceCategory: "CRITICAL_LIFE_SAFETY",
    importanceFactor: 2.5,
    consequenceMultiplier: 3.0,
    regulatoryBody: "ASME_USCG_PVHO_ADCI",
    governingCodes: ["ASME PVHO-1", "ADCI Consensus Standards", "USCG"],
    psmFlag: false,
    rmpFlag: false
  },
  nuclear: {
    consequenceCategory: "CRITICAL_NUCLEAR",
    importanceFactor: 3.0,
    consequenceMultiplier: 4.0,
    regulatoryBody: "NRC",
    governingCodes: ["ASME Section XI", "10 CFR 50", "RG 1.150"],
    psmFlag: false,
    rmpFlag: false
  },
  pipeline: {
    consequenceCategory: "HIGH_HAZMAT",
    importanceFactor: 1.5,
    consequenceMultiplier: 1.8,
    regulatoryBody: "PHMSA_DOT",
    governingCodes: ["ASME B31.8", "API 1104", "API 579", "49 CFR 192/195"],
    psmFlag: false,
    rmpFlag: true
  },
  pressure_vessel: {
    consequenceCategory: "HIGH_PRESSURE",
    importanceFactor: 1.3,
    consequenceMultiplier: 1.5,
    regulatoryBody: "ASME_NB",
    governingCodes: ["ASME VIII", "API 579", "API 510"],
    psmFlag: false,
    rmpFlag: false
  },
  storage_tank: {
    consequenceCategory: "HIGH_HAZMAT",
    importanceFactor: 1.2,
    consequenceMultiplier: 1.4,
    regulatoryBody: "EPA_API",
    governingCodes: ["API 653", "API 579", "STI SP001"],
    psmFlag: false,
    rmpFlag: true
  },
  power_generation: {
    consequenceCategory: "HIGH_CRITICAL_INFRASTRUCTURE",
    importanceFactor: 1.5,
    consequenceMultiplier: 1.8,
    regulatoryBody: "NERC_FERC",
    governingCodes: ["ASME B31.1", "ASME VIII", "API 579"],
    psmFlag: false,
    rmpFlag: false
  },
  marine: {
    consequenceCategory: "HIGH_MARITIME",
    importanceFactor: 1.4,
    consequenceMultiplier: 1.6,
    regulatoryBody: "USCG_ABS_DNV",
    governingCodes: ["AWS D1.1", "ABS Rules", "DNV-GL OS-C101"],
    psmFlag: false,
    rmpFlag: false
  },
  industrial: {
    consequenceCategory: "MODERATE_INDUSTRIAL",
    importanceFactor: 1.0,
    consequenceMultiplier: 1.0,
    regulatoryBody: "OSHA_LOCAL",
    governingCodes: ["AWS D1.1", "ASME VIII", "API 579"],
    psmFlag: false,
    rmpFlag: false
  },
  educational: {
    consequenceCategory: "LOW_SIMULATED",
    importanceFactor: 0.5,
    consequenceMultiplier: 0.5,
    regulatoryBody: "NONE_EDUCATIONAL",
    governingCodes: ["AWS D1.1"],
    psmFlag: false,
    rmpFlag: false
  },
  unknown: {
    consequenceCategory: "UNKNOWN_CONSERVATIVE",
    importanceFactor: 1.5,
    consequenceMultiplier: 1.8,
    regulatoryBody: "UNKNOWN",
    governingCodes: ["API 579", "AWS D1.1"],
    psmFlag: false,
    rmpFlag: false
  }
};

// Component role criticality weights
const ROLE_CRITICALITY: Record<string, string> = {
  primary_structural: "CRITICAL",
  primary_pressure_boundary: "CRITICAL",
  containment_critical: "CRITICAL",
  support_restraint_critical: "HIGH",
  process_flow_critical: "HIGH",
  access_safety_critical: "HIGH",
  secondary_structural: "MODERATE",
  secondary_pressure_boundary: "MODERATE",
  redundancy_sensitive: "MODERATE",
  non_structural: "LOW",
  attachment_only: "LOW",
  unknown_role: "MODERATE"
};

// ================================================================
// ENGINE A1: FACILITY / ASSET CLASSIFICATION ENGINE
// ================================================================

function runA1(input: any): any {
  const assumptions: string[] = [];
  const narrative = (input.incidentNarrative || "").toLowerCase();
  const assetClass = (input.assetClass || "").toLowerCase();
  const assetSubtype = (input.assetSubtype || "").toLowerCase();

  let facilityType = "unknown";

  // Classify from asset class / narrative
  if (assetClass.includes("pvho") || assetClass.includes("decompression") ||
    narrative.includes("decompression chamber") || narrative.includes("pvho") ||
    narrative.includes("diving chamber") || narrative.includes("recompression")) {
    facilityType = "decompression_chamber";
  } else if (assetClass.includes("nuclear") || narrative.includes("nuclear")) {
    facilityType = "nuclear";
  } else if (assetClass.includes("offshore") || assetClass.includes("platform") ||
    narrative.includes("offshore") || narrative.includes("jacket") ||
    narrative.includes("topside")) {
    facilityType = "offshore_platform";
  } else if (assetClass.includes("bridge") || narrative.includes("bridge") ||
    narrative.includes("girder") || narrative.includes("truss")) {
    facilityType = assetClass.includes("railroad") || narrative.includes("railroad") ? "railroad" : "bridge";
  } else if (assetClass.includes("pipeline") || narrative.includes("pipeline") ||
    narrative.includes("transmission line")) {
    facilityType = "pipeline";
  } else if (assetClass.includes("refinery") || narrative.includes("refinery") ||
    narrative.includes("crude") || narrative.includes("fractionation")) {
    facilityType = "refinery";
  } else if (assetClass.includes("petrochemical") || narrative.includes("petrochemical") ||
    narrative.includes("ethylene") || narrative.includes("cracker")) {
    facilityType = "petrochemical";
  } else if (assetClass.includes("storage") || assetClass.includes("tank") ||
    narrative.includes("storage tank") || narrative.includes("tank farm")) {
    facilityType = "storage_tank";
  } else if (assetClass.includes("pressure") || assetClass.includes("vessel") ||
    narrative.includes("pressure vessel") || narrative.includes("reactor vessel")) {
    facilityType = "pressure_vessel";
  } else if (assetClass.includes("power") || narrative.includes("power plant") ||
    narrative.includes("turbine") || narrative.includes("boiler")) {
    facilityType = "power_generation";
  } else if (assetClass.includes("marine") || narrative.includes("marine") ||
    narrative.includes("ship") || narrative.includes("vessel hull")) {
    facilityType = "marine";
  } else if (narrative.includes("educational") || narrative.includes("simulation") ||
    narrative.includes("training scenario")) {
    facilityType = "educational";
  } else if (assetClass.includes("industrial") || narrative.includes("industrial")) {
    facilityType = "industrial";
  } else {
    assumptions.push("Facility type could not be confidently classified from available context — conservative defaults applied");
  }

  const profile = FACILITY_PROFILES[facilityType] || FACILITY_PROFILES["unknown"];

  if (facilityType === "unknown") {
    assumptions.push("Facility classification UNKNOWN — consequence multiplier and regulatory basis are conservative estimates only");
  }

  const classificationConfidence = facilityType === "unknown" ? 0.35 :
    (assetClass.length > 3 ? 0.80 : 0.60);

  return {
    facilityType: facilityType,
    consequenceCategory: profile.consequenceCategory,
    importanceFactor: profile.importanceFactor,
    consequenceMultiplier: profile.consequenceMultiplier,
    regulatoryBody: profile.regulatoryBody,
    governingCodes: profile.governingCodes,
    psmFlag: profile.psmFlag,
    rmpFlag: profile.rmpFlag,
    classificationConfidence: classificationConfidence,
    assumptions: assumptions
  };
}

// ================================================================
// ENGINE A2: STRUCTURAL / PROCESS SYSTEM CONTEXT ENGINE
// ================================================================

function runA2(input: any, a1: any): any {
  const assumptions: string[] = [];
  const narrative = (input.incidentNarrative || "").toLowerCase();
  const componentType = (input.componentType || "").toLowerCase();
  const facilityType = a1.facilityType;

  let loadPathRole = "unknown";
  let systemRole = "unknown_role";
  let criticalityClass = "MODERATE";
  let redundancyHint = "unknown";
  let designIntent = "";
  let behaviorConflict = false;
  let topologyConfidence = 0.45;

  // Determine system role from component type and narrative
  const isPrimary = narrative.includes("primary") || narrative.includes("main") ||
    narrative.includes("critical") || narrative.includes("main beam") ||
    narrative.includes("main chord") || narrative.includes("primary pipe") ||
    componentType.includes("primary") || componentType.includes("main");

  const isSecondary = narrative.includes("secondary") || narrative.includes("brace") ||
    narrative.includes("stiffener") || narrative.includes("gusset") ||
    componentType.includes("secondary") || componentType.includes("brace");

  const isStructural = narrative.includes("structural") || narrative.includes("load bearing") ||
    narrative.includes("column") || narrative.includes("beam") ||
    narrative.includes("girder") || narrative.includes("truss") ||
    narrative.includes("chord") || componentType.includes("structural");

  const isPressure = narrative.includes("pressure boundary") || narrative.includes("shell") ||
    narrative.includes("head") || narrative.includes("nozzle") ||
    narrative.includes("seam weld") || facilityType === "pressure_vessel" ||
    facilityType === "pvho" || facilityType === "decompression_chamber";

  const isSupport = narrative.includes("support") || narrative.includes("bearing") ||
    narrative.includes("anchor") || narrative.includes("foundation") ||
    narrative.includes("leg") || narrative.includes("jacket leg");

  const isContainment = narrative.includes("containment") || narrative.includes("seal") ||
    narrative.includes("liner") || narrative.includes("annular");

  // Assign role
  if (facilityType === "decompression_chamber" || facilityType === "pvho") {
    systemRole = "primary_pressure_boundary";
    loadPathRole = "pressure_containment_path";
    criticalityClass = "CRITICAL";
    designIntent = "Life-safety pressure containment — personnel inside at pressure";
    redundancyHint = "single_point_of_failure";
    topologyConfidence = 0.90;
  } else if (facilityType === "bridge" || facilityType === "railroad") {
    if (narrative.includes("girder") || narrative.includes("chord") ||
      narrative.includes("main member") || isPrimary) {
      systemRole = "primary_structural";
      loadPathRole = "gravity_load_path";
      criticalityClass = "CRITICAL";
      designIntent = "Primary gravity and live load transfer path";
      redundancyHint = "low_redundancy";
      topologyConfidence = 0.80;
    } else if (isSecondary || narrative.includes("cross frame") || narrative.includes("diaphragm")) {
      systemRole = "secondary_structural";
      loadPathRole = "lateral_load_path";
      criticalityClass = "MODERATE";
      redundancyHint = "moderate_redundancy";
      topologyConfidence = 0.70;
    } else {
      systemRole = "primary_structural";
      loadPathRole = "gravity_load_path";
      criticalityClass = "CRITICAL";
      designIntent = "Bridge primary load path — conservative assumption";
      redundancyHint = "low_redundancy";
      assumptions.push("Bridge component role assumed primary structural — verify from drawings");
      topologyConfidence = 0.50;
    }
  } else if (isPressure) {
    systemRole = "primary_pressure_boundary";
    loadPathRole = "pressure_containment_path";
    criticalityClass = "CRITICAL";
    designIntent = "Pressure boundary integrity";
    redundancyHint = "single_point_of_failure";
    topologyConfidence = 0.75;
  } else if (isSupport) {
    systemRole = "support_restraint_critical";
    loadPathRole = "support_reaction_path";
    criticalityClass = "HIGH";
    designIntent = "Structural support and load transfer";
    redundancyHint = "low_redundancy";
    topologyConfidence = 0.65;
  } else if (isContainment) {
    systemRole = "containment_critical";
    loadPathRole = "pressure_containment_path";
    criticalityClass = "CRITICAL";
    topologyConfidence = 0.70;
  } else if (isStructural && isPrimary) {
    systemRole = "primary_structural";
    loadPathRole = "gravity_load_path";
    criticalityClass = "CRITICAL";
    redundancyHint = "low_redundancy";
    topologyConfidence = 0.65;
  } else if (isStructural && isSecondary) {
    systemRole = "secondary_structural";
    loadPathRole = "lateral_load_path";
    criticalityClass = "MODERATE";
    redundancyHint = "moderate_redundancy";
    topologyConfidence = 0.60;
  } else {
    systemRole = "unknown_role";
    criticalityClass = "MODERATE";
    assumptions.push("Component system role not determinable from narrative — MODERATE criticality assumed conservatively");
    topologyConfidence = 0.30;
  }

  criticalityClass = ROLE_CRITICALITY[systemRole] || criticalityClass;

  // Check for behavior conflict: engineering says low risk but architecture says critical location
  const engSignificance = (input.engineeringSignificance || "").toUpperCase();
  if ((criticalityClass === "CRITICAL") && (engSignificance === "LOW" || engSignificance === "MODERATE")) {
    behaviorConflict = true;
    assumptions.push("CONFLICT: Engineering rates component LOW/MODERATE significance but Architecture identifies CRITICAL system role — architecture escalation applies");
  }

  if (!input.componentType) {
    assumptions.push("Component type not specified — system role derived from narrative only");
  }

  return {
    loadPathRole: loadPathRole,
    systemRole: systemRole,
    criticalityClass: criticalityClass,
    redundancyHint: redundancyHint,
    designIntent: designIntent,
    observedBehaviorConflict: behaviorConflict,
    topologyConfidence: topologyConfidence,
    assumptions: assumptions
  };
}

// ================================================================
// ENGINE A3: REDUNDANCY + LOAD REDISTRIBUTION ENGINE
// ================================================================

function runA3(input: any, a1: any, a2: any): any {
  const assumptions: string[] = [];
  const narrative = (input.incidentNarrative || "").toLowerCase();

  let redundancyState = a2.redundancyHint || "unknown";
  let redistributionSeverity = "UNKNOWN";
  let systemReliabilityState = "UNKNOWN";
  let spofFlag = false;
  let adjacentOverstressFlag = false;
  let redundancyIndex = 0.5;
  let reliabilityIndex = 3.5;
  let architectureMarginState = "UNKNOWN";
  const adjacentImpacted: string[] = [];

  // Determine redundancy from facility type and system role
  const isCritical = a2.criticalityClass === "CRITICAL";
  const facilityType = a1.facilityType;

  if (redundancyState === "unknown") {
    if (facilityType === "decompression_chamber" || facilityType === "pvho") {
      redundancyState = "single_point_of_failure";
    } else if (facilityType === "bridge" || facilityType === "railroad") {
      redundancyState = narrative.includes("two") || narrative.includes("multiple span") ?
        "moderate_redundancy" : "low_redundancy";
    } else if (facilityType === "pipeline") {
      redundancyState = "low_redundancy";
    } else if (a2.systemRole === "primary_structural" || a2.systemRole === "primary_pressure_boundary") {
      redundancyState = "low_redundancy";
    } else {
      redundancyState = "moderate_redundancy";
      assumptions.push("Redundancy state estimated as moderate — actual topology not confirmed");
    }
  }

  // Map redundancy to index and reliability estimate
  if (redundancyState === "single_point_of_failure") {
    spofFlag = true;
    redundancyIndex = 0.0;
    reliabilityIndex = 2.5;
    redistributionSeverity = "SEVERE";
    systemReliabilityState = "CRITICAL";
    architectureMarginState = "NONE";
    adjacentOverstressFlag = true;
  } else if (redundancyState === "low_redundancy") {
    redundancyIndex = 0.2;
    reliabilityIndex = 3.0;
    redistributionSeverity = "HIGH";
    systemReliabilityState = "REDUCED";
    architectureMarginState = "MINIMAL";
  } else if (redundancyState === "moderate_redundancy") {
    redundancyIndex = 0.5;
    reliabilityIndex = 3.5;
    redistributionSeverity = "MODERATE";
    systemReliabilityState = "ADEQUATE_WITH_MONITORING";
    architectureMarginState = "MODERATE";
  } else if (redundancyState === "high_redundancy") {
    redundancyIndex = 0.9;
    reliabilityIndex = 4.0;
    redistributionSeverity = "LOW";
    systemReliabilityState = "ACCEPTABLE";
    architectureMarginState = "ADEQUATE";
  } else {
    assumptions.push("Redundancy unknown — conservative low_redundancy assumed for consequence calculation");
    redundancyState = "low_redundancy";
    redundancyIndex = 0.2;
    reliabilityIndex = 3.0;
    redistributionSeverity = "HIGH";
    systemReliabilityState = "REDUCED";
    architectureMarginState = "MINIMAL";
  }

  // Adjacent components at risk
  if (spofFlag || redundancyState === "low_redundancy") {
    if (facilityType === "bridge" || facilityType === "railroad") {
      adjacentImpacted.push("Adjacent bridge members / load sharing elements");
      adjacentImpacted.push("Bearings and abutments receiving redistributed load");
      adjacentImpacted.push("Deck structure above affected member");
    } else if (facilityType === "decompression_chamber" || facilityType === "pvho") {
      adjacentImpacted.push("All penetrations and fittings in pressure zone");
      adjacentImpacted.push("Closure mechanism and sealing surfaces");
      adjacentImpacted.push("Adjacent shell segments");
    } else if (facilityType === "offshore_platform") {
      adjacentImpacted.push("Connected jacket tubular members");
      adjacentImpacted.push("Node joints receiving redistributed load");
      adjacentImpacted.push("Deck structure above affected tubular");
    } else if (facilityType === "pipeline") {
      adjacentImpacted.push("Adjacent girth welds (within 3m)");
      adjacentImpacted.push("Downstream process equipment");
      adjacentImpacted.push("Isolation valve effectiveness");
    } else if (facilityType === "refinery" || facilityType === "petrochemical") {
      adjacentImpacted.push("Connected nozzles and flanges");
      adjacentImpacted.push("Process piping attached to this component");
      adjacentImpacted.push("Supporting structure below equipment");
    }
  }

  return {
    redundancyState: redundancyState,
    redistributionSeverity: redistributionSeverity,
    systemReliabilityState: systemReliabilityState,
    spofFlag: spofFlag,
    adjacentOverstressFlag: adjacentOverstressFlag,
    redundancyIndex: redundancyIndex,
    reliabilityIndexEstimate: reliabilityIndex,
    architectureMarginState: architectureMarginState,
    adjacentImpactedComponents: adjacentImpacted,
    assumptions: assumptions
  };
}

// ================================================================
// ENGINE A4: INTERDEPENDENCY + CASCADE DETECTION ENGINE
// ================================================================

function runA4(input: any, a1: any, a2: any, a3: any): any {
  const assumptions: string[] = [];
  const narrative = (input.incidentNarrative || "").toLowerCase();

  let cascadeProbability = 0.2;
  let architectureOverrideRecommended = false;
  const combinedRiskScenarios: string[] = [];
  const couplingFactors: string[] = [];
  const affectedDownstream: string[] = [...a3.adjacentImpactedComponents];
  const multiFlaw: string[] = [];

  // Cascade probability from redundancy + criticality
  if (a3.spofFlag) {
    cascadeProbability = 0.85;
    architectureOverrideRecommended = true;
    combinedRiskScenarios.push("Single-point failure: loss of component = system failure");
  } else if (a3.redundancyState === "low_redundancy" && a2.criticalityClass === "CRITICAL") {
    cascadeProbability = 0.60;
    architectureOverrideRecommended = true;
    combinedRiskScenarios.push("Low-redundancy critical path: component loss causes significant load redistribution");
  } else if (a3.redundancyState === "moderate_redundancy") {
    cascadeProbability = 0.30;
    combinedRiskScenarios.push("Moderate redundancy: system can tolerate limited degradation with monitoring");
  } else {
    cascadeProbability = 0.15;
  }

  // Facility-specific cascade scenarios
  const facilityType = a1.facilityType;

  if (facilityType === "decompression_chamber" || facilityType === "pvho") {
    couplingFactors.push("Personnel life-safety: occupants at pressure inside chamber");
    couplingFactors.push("Single-envelope pressure boundary: no backup containment");
    couplingFactors.push("Rapid decompression risk: catastrophic consequence of shell failure");
    combinedRiskScenarios.push("CATASTROPHIC: Any shell or closure failure at pressure results in immediate life-safety emergency");
    cascadeProbability = Math.max(cascadeProbability, 0.95);
    architectureOverrideRecommended = true;
  } else if (facilityType === "offshore_platform") {
    couplingFactors.push("Structural load redistribution through tubular network");
    couplingFactors.push("Subsea evacuation limitation if platform structural integrity compromised");
    combinedRiskScenarios.push("Progressive structural failure risk if primary tubular compromised in storm loading");
    if (a2.criticalityClass === "CRITICAL") cascadeProbability = Math.max(cascadeProbability, 0.65);
  } else if (facilityType === "bridge" || facilityType === "railroad") {
    couplingFactors.push("Traffic loading is dynamic and unpredictable — fatigue cycles ongoing during assessment");
    couplingFactors.push("Public access creates life-safety consequence from any structural failure");
    combinedRiskScenarios.push("Bridge deck collapse risk if primary girder integrity lost");
    if (narrative.includes("loaded") || narrative.includes("traffic") ||
      narrative.includes("heavy")) cascadeProbability = Math.max(cascadeProbability, 0.70);
  } else if (facilityType === "refinery" || facilityType === "petrochemical") {
    couplingFactors.push("Flammable / toxic inventory release");
    couplingFactors.push("Domino effect: adjacent vessels and piping");
    couplingFactors.push("PSM/RMP thresholds may be exceeded");
    combinedRiskScenarios.push("Process release triggering fire/explosion affecting adjacent equipment");
    if (a1.psmFlag) cascadeProbability = Math.max(cascadeProbability, 0.60);
  } else if (facilityType === "pipeline") {
    couplingFactors.push("Downstream process continuity");
    couplingFactors.push("Pipeline pressure isolation reliability");
    combinedRiskScenarios.push("Rupture with spill/fire along pipeline corridor");
  }

  // Multi-flaw detection
  if (narrative.includes("multiple") || narrative.includes("several") ||
    narrative.includes("additional") || narrative.includes("nearby")) {
    multiFlaw.push("Multiple indications detected — interaction effects may reduce effective critical flaw size");
    multiFlaw.push("Combined flaw assessment per API 579 Figure 9.1 proximity rules required");
    cascadeProbability = Math.min(1.0, cascadeProbability + 0.15);
  }

  return {
    cascadeProbability: cascadeProbability,
    affectedDownstreamComponents: affectedDownstream,
    couplingFactors: couplingFactors,
    combinedRiskScenarios: combinedRiskScenarios,
    multiFlaw: multiFlaw,
    architectureOverrideRecommended: architectureOverrideRecommended,
    assumptions: assumptions
  };
}

// ================================================================
// ENGINE A5: REGULATORY + CODE MAPPING ENGINE
// ================================================================

function runA5(input: any, a1: any): any {
  const assumptions: string[] = [];
  const engVerdict = (input.ndtVerdict || "INDETERMINATE").toUpperCase();
  const engSignificance = (input.engineeringSignificance || "MODERATE").toUpperCase();
  const facilityType = a1.facilityType;
  const profile = FACILITY_PROFILES[facilityType] || FACILITY_PROFILES["unknown"];

  let complianceDelta = "SAME";
  let stricterRegulatoryFlag = false;
  let regulatoryOverrideFlag = false;
  const requiredDocumentation: string[] = [];
  const applicableStandards: string[] = [...profile.governingCodes];
  let regulatoryNarrative = "";

  // PSM facilities: additional documentation required
  if (profile.psmFlag) {
    stricterRegulatoryFlag = true;
    complianceDelta = "STRICTER_REGULATORY";
    requiredDocumentation.push("PSM MOC (Management of Change) documentation required");
    requiredDocumentation.push("PHR/PHA review if operational changes result from finding");
    requiredDocumentation.push("Mechanical integrity record update per OSHA 1910.119");
    applicableStandards.push("OSHA 29 CFR 1910.119 (PSM)");
    if (engVerdict !== "REJECT" && engSignificance !== "CRITICAL") {
      regulatoryOverrideFlag = true;
    }
  }

  if (profile.rmpFlag) {
    requiredDocumentation.push("EPA RMP review may be required if change affects worst-case release scenario");
    applicableStandards.push("40 CFR Part 68 (RMP)");
  }

  // Facility-specific regulatory requirements
  if (facilityType === "decompression_chamber" || facilityType === "pvho") {
    stricterRegulatoryFlag = true;
    regulatoryOverrideFlag = true;
    complianceDelta = "STRICTER_REGULATORY";
    requiredDocumentation.push("ASME PVHO-1 re-qualification test required before return to manned service");
    requiredDocumentation.push("Qualified PVHO Inspector sign-off required");
    requiredDocumentation.push("Dive supervisor written authorization to resume operations");
    applicableStandards.push("ASME PVHO-1");
    applicableStandards.push("ADCI Consensus Standards for Commercial Diving");
    regulatoryNarrative = "PVHO/decompression chamber: Any pressure boundary finding requires ASME PVHO-1 re-qualification before manned use. This regulatory requirement is stricter than component-only engineering assessment.";
  } else if (facilityType === "bridge" || facilityType === "railroad") {
    stricterRegulatoryFlag = true;
    complianceDelta = "STRICTER_REGULATORY";
    requiredDocumentation.push("State DOT bridge inspection report per FHWA mandate");
    requiredDocumentation.push("National Bridge Inspection Standards (NBIS) documentation");
    requiredDocumentation.push("Load posting or closure order if findings affect load rating");
    applicableStandards.push("23 CFR Part 650 (NBIS)");
    if (engSignificance === "HIGH" || engSignificance === "CRITICAL") {
      regulatoryOverrideFlag = true;
      requiredDocumentation.push("Emergency load restriction or closure per FHWA/DOT authority");
    }
    regulatoryNarrative = "Public bridge / railroad: Federal NBIS requirements mandate documented inspection, load rating reassessment, and potential load posting or closure if structural adequacy is in question.";
  } else if (facilityType === "nuclear") {
    stricterRegulatoryFlag = true;
    regulatoryOverrideFlag = true;
    complianceDelta = "STRICTER_REGULATORY";
    requiredDocumentation.push("NRC 10x-day reportability assessment");
    requiredDocumentation.push("ASME Section XI repair/replacement plan");
    requiredDocumentation.push("Licensee Event Report (LER) if reportable condition");
    regulatoryNarrative = "Nuclear: NRC regulations impose documentation, reportability, and repair standards stricter than any component engineering analysis. Immediate licensing review required.";
  } else if (facilityType === "pipeline") {
    complianceDelta = "POTENTIALLY_STRICTER";
    requiredDocumentation.push("PHMSA/DOT integrity management documentation");
    requiredDocumentation.push("Operator Qualification verification for all personnel");
    if (engSignificance === "HIGH" || engSignificance === "CRITICAL") {
      stricterRegulatoryFlag = true;
      regulatoryOverrideFlag = true;
      requiredDocumentation.push("IMP (Integrity Management Program) immediate action criteria review");
    }
  }

  if (!regulatoryNarrative) {
    regulatoryNarrative = "Facility regulatory requirements are " + complianceDelta + " compared to component-only engineering basis.";
  }

  if (facilityType === "unknown") {
    assumptions.push("Regulatory mapping is based on conservative unknown-facility defaults — confirm facility type for accurate regulatory requirements");
  }

  return {
    applicableStandards: applicableStandards,
    regulatoryBody: profile.regulatoryBody,
    complianceDelta: complianceDelta,
    stricterRegulatoryFlag: stricterRegulatoryFlag,
    regulatoryOverrideFlag: regulatoryOverrideFlag,
    requiredDocumentation: requiredDocumentation,
    regulatoryNarrative: regulatoryNarrative,
    assumptions: assumptions
  };
}

// ================================================================
// ENGINE A6: FACILITY / ASSET RISK AGGREGATION ENGINE
// ================================================================

function runA6(input: any, a1: any, a2: any, a3: any, a4: any, a5: any): any {
  // Combine component risk with architecture multipliers
  const baseRisk = (input.riskRanking || "MEDIUM").toUpperCase();
  const consequenceMultiplier = a1.consequenceMultiplier;
  const importanceFactor = a1.importanceFactor;

  // Convert base risk to numeric
  const baseRiskScore: Record<string, number> = {
    "CRITICAL": 20,
    "HIGH": 12,
    "MEDIUM": 6,
    "LOW": 2,
    "UNKNOWN": 6
  };

  let facilityRiskScore = (baseRiskScore[baseRisk] || 6) * consequenceMultiplier * importanceFactor;
  if (a3.spofFlag) facilityRiskScore *= 1.5;
  if (a4.architectureOverrideRecommended) facilityRiskScore *= 1.3;
  if (a5.regulatoryOverrideFlag) facilityRiskScore *= 1.2;
  if (a2.observedBehaviorConflict) facilityRiskScore *= 1.2;

  let facilityRiskRanking = "LOW";
  if (facilityRiskScore >= 30) facilityRiskRanking = "CRITICAL";
  else if (facilityRiskScore >= 18) facilityRiskRanking = "HIGH";
  else if (facilityRiskScore >= 9) facilityRiskRanking = "MEDIUM";
  else facilityRiskRanking = "LOW";

  // Repair priority
  let repairPriority = "PLANNED";
  let timeCritical = false;
  if (facilityRiskRanking === "CRITICAL" || a3.spofFlag || a5.regulatoryOverrideFlag) {
    repairPriority = "IMMEDIATE";
    timeCritical = true;
  } else if (facilityRiskRanking === "HIGH" || a4.architectureOverrideRecommended) {
    repairPriority = "URGENT";
    timeCritical = true;
  } else if (facilityRiskRanking === "MEDIUM") {
    repairPriority = "NEAR_TERM";
  } else {
    repairPriority = "DEFERRABLE";
  }

  // Trend state from life estimate
  let trendState = "UNKNOWN";
  const lifeMonths = input.remainingLifeMonthsLow;
  if (lifeMonths !== null && lifeMonths !== undefined) {
    if (lifeMonths < 6) trendState = "DETERIORATING_CRITICAL";
    else if (lifeMonths < 18) trendState = "DETERIORATING_ELEVATED";
    else if (lifeMonths < 48) trendState = "STABLE_MONITORING_REQUIRED";
    else trendState = "STABLE";
  }

  return {
    facilityRiskScore: Math.round(facilityRiskScore),
    facilityRiskRanking: facilityRiskRanking,
    repairPriority: repairPriority,
    timeCriticalEscalation: timeCritical,
    trendState: trendState,
    consequenceMultiplierApplied: consequenceMultiplier,
    importanceFactorApplied: importanceFactor
  };
}

// ================================================================
// ENGINE A7: ARCHITECTURE INTEGRITY AUDIT ENGINE
// ================================================================

function runA7(input: any, a1: any, a2: any, a3: any, a4: any, a5: any, a6: any): any {
  const allAssumptions: string[] = [
    ...a1.assumptions,
    ...a2.assumptions,
    ...a3.assumptions,
    ...a4.assumptions,
    ...a5.assumptions
  ];

  const domainViolations: string[] = [];
  const crossLayerFlags: string[] = [];
  const auditTrail: string[] = [];
  let hardGate = false;
  let outputBlockedFlag = false;

  // Cross-layer consistency checks
  if (a2.observedBehaviorConflict) {
    crossLayerFlags.push("CONFLICT: Engineering rates LOW significance on CRITICAL architecture component — architecture escalation applied");
    hardGate = true;
  }
  if (a3.spofFlag && (input.riskRanking === "LOW" || input.riskRanking === "MEDIUM")) {
    crossLayerFlags.push("CONFLICT: Component at single-point-of-failure location rated LOW/MEDIUM engineering risk — facility consequence requires elevation");
    hardGate = true;
  }
  if (a5.regulatoryOverrideFlag && !a5.stricterRegulatoryFlag) {
    domainViolations.push("Regulatory override flag set but stricter criterion not confirmed — verify regulatory requirements");
  }

  // Topology completeness score
  let topologyScore = a2.topologyConfidence;
  if (!input.componentType) topologyScore *= 0.8;
  if (!input.assetSubtype) topologyScore *= 0.9;
  if (a1.facilityType === "unknown") topologyScore *= 0.5;
  topologyScore = Math.max(0.1, Math.min(1.0, topologyScore));

  // Evidence of incomplete context
  if (topologyScore < 0.4) {
    outputBlockedFlag = false;  // Don't block, but caveat
    allAssumptions.push("TOPOLOGY INCOMPLETE: Architecture conclusions are provisional — facility context data needed for reliable system assessment");
  }

  // Audit trail
  auditTrail.push("A1_FACILITY: type=" + a1.facilityType + " | category=" + a1.consequenceCategory + " | mult=" + a1.consequenceMultiplier + " | confidence=" + (a1.classificationConfidence * 100).toFixed(0) + "%");
  auditTrail.push("A2_CONTEXT: role=" + a2.systemRole + " | criticality=" + a2.criticalityClass + " | loadpath=" + a2.loadPathRole + " | topology=" + (a2.topologyConfidence * 100).toFixed(0) + "%");
  auditTrail.push("A3_REDUNDANCY: state=" + a3.redundancyState + " | SPOF=" + a3.spofFlag + " | redistrib=" + a3.redistributionSeverity + " | reliability=" + a3.reliabilityIndexEstimate.toFixed(1));
  auditTrail.push("A4_CASCADE: probability=" + (a4.cascadeProbability * 100).toFixed(0) + "% | override=" + a4.architectureOverrideRecommended + " | scenarios=" + a4.combinedRiskScenarios.length);
  auditTrail.push("A5_REGULATORY: body=" + a5.regulatoryBody + " | delta=" + a5.complianceDelta + " | override=" + a5.regulatoryOverrideFlag);
  auditTrail.push("A6_FACILITY_RISK: score=" + a6.facilityRiskScore + " | ranking=" + a6.facilityRiskRanking + " | priority=" + a6.repairPriority + " | trend=" + a6.trendState);
  if (crossLayerFlags.length > 0) auditTrail.push("CROSS_LAYER_FLAGS: " + crossLayerFlags.length + " flags — review required");
  auditTrail.push("ASSUMPTION_COUNT: " + allAssumptions.length + " total");

  // Regulatory mapping confidence
  const regulatoryConfidence = a1.facilityType !== "unknown" ? 0.80 : 0.40;

  return {
    allAssumptions: allAssumptions,
    domainViolations: domainViolations,
    crossLayerConsistencyFlags: crossLayerFlags,
    topologyCompletenessScore: Math.round(topologyScore * 100),
    regulatoryMappingConfidence: Math.round(regulatoryConfidence * 100),
    dependencyGraphConfidence: Math.round(a2.topologyConfidence * 100),
    architectureOutputBlockedFlag: outputBlockedFlag,
    auditTrail: auditTrail,
    hardGate: hardGate
  };
}

// ================================================================
// ENGINE A8: ARCHITECTURE-TO-ENGINEERING FEEDBACK ENGINE
// ================================================================

function runA8(input: any, a1: any, a2: any, a3: any, a4: any, a5: any, a6: any): any {
  let revisedConsequenceMultiplier = a1.consequenceMultiplier;
  let architectureCriticalityEscalation = false;
  let revisedCoFState = input.engineeringCoF || 3;
  let cascadeEscalationFlag = a4.architectureOverrideRecommended;
  let regulatoryOverrideFlag = a5.regulatoryOverrideFlag;
  let architectureOverrideFlag = false;
  let engineeringRecomputeRequired = false;

  // Escalate if architecture finds higher consequence than engineering assumed
  const engSignificance = (input.engineeringSignificance || "MODERATE").toUpperCase();
  const archCriticality = a2.criticalityClass;

  if (archCriticality === "CRITICAL" && (engSignificance === "LOW" || engSignificance === "MODERATE")) {
    architectureCriticalityEscalation = true;
    architectureOverrideFlag = true;
    engineeringRecomputeRequired = true;
    revisedConsequenceMultiplier = Math.max(revisedConsequenceMultiplier, 2.0);
    revisedCoFState = Math.min(5, (revisedCoFState || 3) + 2);
  } else if (archCriticality === "HIGH" && engSignificance === "LOW") {
    architectureCriticalityEscalation = true;
    architectureOverrideFlag = true;
    revisedConsequenceMultiplier = Math.max(revisedConsequenceMultiplier, 1.5);
    revisedCoFState = Math.min(5, (revisedCoFState || 3) + 1);
  }

  if (a3.spofFlag && !architectureOverrideFlag) {
    architectureOverrideFlag = true;
    architectureCriticalityEscalation = true;
    engineeringRecomputeRequired = true;
    revisedConsequenceMultiplier = Math.max(revisedConsequenceMultiplier, 2.5);
  }

  if (a6.facilityRiskRanking === "CRITICAL" && !architectureOverrideFlag) {
    architectureOverrideFlag = true;
    engineeringRecomputeRequired = true;
  }

  return {
    revisedConsequenceMultiplier: revisedConsequenceMultiplier,
    architectureCriticalityEscalation: architectureCriticalityEscalation,
    revisedCoFState: revisedCoFState,
    cascadeEscalationFlag: cascadeEscalationFlag,
    regulatoryOverrideFlag: regulatoryOverrideFlag,
    architectureOverrideFlag: architectureOverrideFlag,
    engineeringRecomputeRequired: engineeringRecomputeRequired
  };
}

// ================================================================
// NARRATIVE GENERATORS
// ================================================================

function buildArchSimpleNarrative(a1: any, a2: any, a3: any, a4: any, a5: any, a6: any, a8: any): string {
  let n = "This component is part of the " + a2.systemRole.replace(/_/g, " ") +
    " in a " + a1.facilityType.replace(/_/g, " ") + " system. ";
  n = n + "Architectural importance is " + a2.criticalityClass + ". ";
  n = n + "The system is " + a3.redundancyState.replace(/_/g, " ") + " — ";
  if (a3.spofFlag) {
    n = n + "there is NO backup capacity at this location. ";
  } else if (a3.redundancyState === "low_redundancy") {
    n = n + "limited backup capacity exists. ";
  } else {
    n = n + "the system can tolerate some degradation with monitoring. ";
  }
  if (a4.couplingFactors.length > 0) {
    n = n + "Connected risk factors: " + a4.couplingFactors[0] + ". ";
  }
  n = n + "Facility-level risk: " + a6.facilityRiskRanking + ". ";
  n = n + "Repair priority: " + a6.repairPriority.replace(/_/g, " ") + ". ";
  if (a5.regulatoryOverrideFlag) {
    n = n + "Regulatory override ACTIVE: " + a5.regulatoryNarrative;
  }
  if (a8.architectureOverrideFlag) {
    n = n + " ARCHITECTURE OVERRIDE SET: System consequence exceeds component-only engineering assessment.";
  }
  return n;
}

function buildArchExpertNarrative(a1: any, a2: any, a3: any, a4: any, a5: any, a6: any, a7: any, a8: any): string {
  let n = "FACILITY: " + a1.facilityType + " | category=" + a1.consequenceCategory +
    " | multiplier=" + a1.consequenceMultiplier + " | importance=" + a1.importanceFactor + ". ";
  n = n + "SYSTEM CONTEXT: role=" + a2.systemRole + " | criticality=" + a2.criticalityClass +
    " | load_path=" + a2.loadPathRole + " | topology_confidence=" + (a2.topologyConfidence * 100).toFixed(0) + "%. ";
  n = n + "REDUNDANCY: state=" + a3.redundancyState + " | SPOF=" + a3.spofFlag +
    " | redistrib_severity=" + a3.redistributionSeverity + " | reliability=" + a3.reliabilityIndexEstimate.toFixed(1) + ". ";
  n = n + "CASCADE: probability=" + (a4.cascadeProbability * 100).toFixed(0) + "% | override=" + a4.architectureOverrideRecommended + ". ";
  n = n + "REGULATORY: body=" + a5.regulatoryBody + " | delta=" + a5.complianceDelta +
    " | override=" + a5.regulatoryOverrideFlag + ". ";
  n = n + "FACILITY RISK: score=" + a6.facilityRiskScore + " | ranking=" + a6.facilityRiskRanking +
    " | priority=" + a6.repairPriority + " | trend=" + a6.trendState + ". ";
  n = n + "FEEDBACK: arch_override=" + a8.architectureOverrideFlag +
    " | revised_CoF=" + a8.revisedCoFState + " | recompute=" + a8.engineeringRecomputeRequired + ".";
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

  if (!input.assetClass) {
    return {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "assetClass is required" })
    };
  }

  try {
    // SEQUENTIAL 9-ENGINE PIPELINE
    const a1 = runA1(input);
    const a2 = runA2(input, a1);
    const a3 = runA3(input, a1, a2);
    const a4 = runA4(input, a1, a2, a3);
    const a5 = runA5(input, a1);
    const a6 = runA6(input, a1, a2, a3, a4, a5);
    const a7 = runA7(input, a1, a2, a3, a4, a5, a6);
    const a8 = runA8(input, a1, a2, a3, a4, a5, a6);

    const simpleNarrative = buildArchSimpleNarrative(a1, a2, a3, a4, a5, a6, a8);
    const expertNarrative = buildArchExpertNarrative(a1, a2, a3, a4, a5, a6, a7, a8);

    const output = {
      caseId: input.caseId || ("ARCH-" + Date.now()),
      facilityType: a1.facilityType,
      consequenceCategory: a1.consequenceCategory,
      loadPathRole: a2.loadPathRole,
      criticalityClass: a2.criticalityClass,
      systemRole: a2.systemRole,
      designIntent: a2.designIntent,
      observedBehaviorConflict: a2.observedBehaviorConflict,
      redundancyState: a3.redundancyState,
      spofFlag: a3.spofFlag,
      architectureMarginState: a3.architectureMarginState,
      adjacentImpactedComponents: a3.adjacentImpactedComponents,
      cascadeProbability: a4.cascadeProbability,
      combinedRiskScenarios: a4.combinedRiskScenarios,
      couplingFactors: a4.couplingFactors,
      multiFlaw: a4.multiFlaw,
      applicableStandards: a5.applicableStandards,
      regulatoryBody: a5.regulatoryBody,
      regulatoryOverrideFlag: a5.regulatoryOverrideFlag,
      complianceDelta: a5.complianceDelta,
      requiredDocumentation: a5.requiredDocumentation,
      regulatoryNarrative: a5.regulatoryNarrative,
      facilityRiskRanking: a6.facilityRiskRanking,
      facilityRiskScore: a6.facilityRiskScore,
      repairPriority: a6.repairPriority,
      timeCriticalEscalation: a6.timeCriticalEscalation,
      trendState: a6.trendState,
      consequenceMultiplierApplied: a6.consequenceMultiplierApplied,
      architectureOverrideFlag: a8.architectureOverrideFlag,
      revisedConsequenceMultiplier: a8.revisedConsequenceMultiplier,
      engineeringRecomputeRequired: a8.engineeringRecomputeRequired,
      architectureCriticalityEscalation: a8.architectureCriticalityEscalation,
      topologyCompletenessScore: a7.topologyCompletenessScore,
      regulatoryMappingConfidence: a7.regulatoryMappingConfidence,
      assumptionRegister: a7.allAssumptions,
      domainViolations: a7.domainViolations,
      crossLayerFlags: a7.crossLayerConsistencyFlags,
      auditTrail: a7.auditTrail,
      psmFlag: a1.psmFlag,
      rmpFlag: a1.rmpFlag,
      governingCodes: a1.governingCodes,
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
      body: JSON.stringify({ error: "Architecture core error: " + (err.message || String(err)) })
    };
  }
};
