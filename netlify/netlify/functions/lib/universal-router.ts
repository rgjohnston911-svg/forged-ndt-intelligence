/**
 * DEPLOY34 — Universal Inspection Context Router + Material Condition Engine v1
 * netlify/functions/lib/universal-router.ts
 *
 * Routes inspection logic by context, material class, material family,
 * service environment, and evidence observed.
 *
 * PREVENTS:
 *   - treating every surface as a weld
 *   - treating every material as metal
 *   - applying weld discontinuity logic to pipe wall loss
 *   - applying corrosion logic to composites or plastics
 *
 * CONSTRAINT: No backtick template literals (Git Bash paste corruption)
 */

/* ================================================================
   CORE ROUTING TYPES
================================================================ */

export type InspectionContext =
  | "WELD"
  | "BASE_MATERIAL"
  | "HAZ"
  | "COMPONENT"
  | "COATING"
  | "UNKNOWN";

export type MaterialClass =
  | "METALLIC"
  | "POLYMER"
  | "COMPOSITE"
  | "CERAMIC_GLASS"
  | "ELASTOMER"
  | "CIVIL_MINERAL"
  | "COATING_LINER"
  | "UNKNOWN";

export type InspectionEngineRoute =
  | "WELD_FABRICATION_ENGINE"
  | "METALLIC_DAMAGE_ENGINE"
  | "POLYMER_DEGRADATION_ENGINE"
  | "COMPOSITE_DAMAGE_ENGINE"
  | "CERAMIC_GLASS_DAMAGE_ENGINE"
  | "ELASTOMER_DEGRADATION_ENGINE"
  | "CIVIL_MINERAL_DAMAGE_ENGINE"
  | "COATING_LINER_ENGINE"
  | "COMPONENT_GENERAL_ENGINE"
  | "UNKNOWN_ENGINE";

export type InspectionSurfaceType =
  | "PIPE" | "PLATE" | "VESSEL" | "STRUCTURAL_MEMBER" | "TUBE"
  | "NOZZLE" | "FLANGE" | "FITTING" | "VALVE_BODY" | "CASTING"
  | "FORGING" | "MACHINED_PART" | "TANK" | "RAIL" | "PANEL"
  | "LINER" | "COATING_LAYER" | "CONCRETE_MEMBER"
  | "GENERAL_COMPONENT" | "UNKNOWN";

export type ServiceEnvironment =
  | "ATMOSPHERIC" | "MARINE" | "BURIED"
  | "IMMERSION_FRESH_WATER" | "IMMERSION_SALT_WATER"
  | "SOUR_SERVICE" | "CHEMICAL_PROCESS"
  | "HIGH_TEMPERATURE" | "LOW_TEMPERATURE"
  | "ABRASIVE_FLOW" | "CYCLIC_PRESSURE"
  | "UV_EXPOSURE" | "STEAM_SERVICE" | "UNKNOWN";

/* ================================================================
   MATERIAL CONDITION CODES
================================================================ */

export type MaterialConditionCode =
  /* Metallic */
  | "UNIFORM_CORROSION" | "PITTING_CORROSION" | "CREVICE_CORROSION"
  | "GALVANIC_CORROSION" | "EROSION" | "EROSION_CORROSION"
  | "CAVITATION_DAMAGE" | "FATIGUE_CRACKING" | "STRESS_CORROSION_CRACKING"
  | "HYDROGEN_DAMAGE" | "THERMAL_CRACKING" | "LAMINATION" | "DELAMINATION"
  | "LOCAL_METAL_LOSS" | "GENERAL_WALL_LOSS" | "HEAT_TINT_OXIDATION"
  | "OVERHEAT_DAMAGE"
  /* Mechanical */
  | "MECHANICAL_GOUGE" | "MECHANICAL_DENT" | "MECHANICAL_SCORE"
  | "ABRASION_DAMAGE" | "DEFORMATION" | "BULGING" | "OVALITY"
  | "MISALIGNMENT_COMPONENT" | "LEAK_PATH_INDICATION"
  /* Polymer */
  | "CREEP_DEFORMATION" | "ENVIRONMENTAL_STRESS_CRACKING"
  | "UV_DEGRADATION" | "SWELLING" | "SOFTENING" | "EMBRITTLEMENT"
  | "THERMAL_WARPING" | "CHEMICAL_ATTACK_POLYMER"
  /* Composite */
  | "FIBER_BREAKAGE" | "MATRIX_CRACKING" | "IMPACT_DAMAGE"
  | "DISBOND" | "MOISTURE_INGRESS" | "VOIDS" | "CORE_CRUSH"
  /* Ceramic / glass */
  | "BRITTLE_CRACKING" | "CHIPPING" | "SPALLING"
  | "THERMAL_SHOCK_DAMAGE" | "GLAZE_FAILURE"
  /* Elastomer */
  | "TEARING" | "COMPRESSION_SET" | "HARDENING" | "OZONE_CRACKING"
  /* Coatings / liners */
  | "BLISTERING" | "COATING_FAILURE" | "COATING_DISBONDMENT"
  | "PINHOLES" | "UNDERFILM_CORROSION" | "LINER_SEPARATION"
  /* Civil / mineral */
  | "SURFACE_SCALING" | "CRACKING_CIVIL" | "DELAMINATION_CIVIL"
  | "CHEMICAL_ATTACK_CIVIL"
  | "UNKNOWN_CONDITION";

/* ================================================================
   INPUT / OUTPUT TYPES
================================================================ */

export interface UniversalInspectionInput {
  inspectionContext?: string | null;
  materialClass?: string | null;
  materialFamily?: string | null;
  surfaceType?: string | null;
  serviceEnvironment?: string | null;
  weldingMethod?: string | null;

  evidence?: {
    visibleWeldBead?: boolean;
    visibleToeLine?: boolean;
    visibleRootProfile?: boolean;
    visibleBaseMetalOnly?: boolean;
    pittingVisible?: boolean;
    widespreadWallLossVisible?: boolean;
    directionalWearVisible?: boolean;
    crackingVisible?: boolean;
    dentVisible?: boolean;
    gougeVisible?: boolean;
    bulgingVisible?: boolean;
    rustScaleVisible?: boolean;
    heatDiscolorationVisible?: boolean;
    leakTraceVisible?: boolean;
    deformationVisible?: boolean;
    coatingPeelingVisible?: boolean;
    blisteringVisible?: boolean;
    pinholesVisible?: boolean;
    underfilmRustVisible?: boolean;
    crazingVisible?: boolean;
    chalkingVisible?: boolean;
    swellingVisible?: boolean;
    softeningVisible?: boolean;
    embrittlementVisible?: boolean;
    warpVisible?: boolean;
    fiberExposureVisible?: boolean;
    delaminationVisible?: boolean;
    matrixCrackVisible?: boolean;
    impactZoneVisible?: boolean;
    coreCrushVisible?: boolean;
    chippingVisible?: boolean;
    spallingVisible?: boolean;
    shatteredOrBrittleCrackVisible?: boolean;
    tearingVisible?: boolean;
    compressionSetVisible?: boolean;
    ozoneCrackPatternVisible?: boolean;
    scalingVisible?: boolean;
    mapCrackingVisible?: boolean;
  };

  candidateConditions?: Array<{
    code: MaterialConditionCode;
    baseScore: number;
  }>;
}

export interface RouteDecision {
  context: InspectionContext;
  materialClass: MaterialClass;
  route: InspectionEngineRoute;
  warnings: string[];
  rationale: string[];
}

export interface AdjustedCondition {
  code: MaterialConditionCode;
  originalScore: number;
  adjustedScore: number;
  notes: string[];
}

export interface EngineProfile {
  route: InspectionEngineRoute;
  dominantMechanisms: MaterialConditionCode[];
  likelyCauses: string[];
  recommendedMethods: string[];
  evidenceWeighting: {
    morphology: number;
    environment: number;
    material: number;
    location: number;
    service: number;
  };
  authorityPenaltyIfUnknown: number;
  teachingFocus: string[];
}

export interface UniversalInspectionOutput {
  routeDecision: RouteDecision;
  profile: EngineProfile;
  adjustedConditions: AdjustedCondition[];
  probableCauses: string[];
  recommendedMethods: string[];
  teachingFocus: string[];
  warnings: string[];
  primaryCondition: MaterialConditionCode | null;
  primaryLocked: boolean;
  confidenceBand: "LOW" | "MODERATE" | "HIGH";
}

/* ================================================================
   NORMALIZERS
================================================================ */

function normalizeInspectionContext(input?: string | null): InspectionContext {
  var v = (input || "").trim().toUpperCase();
  if (v === "WELD") return "WELD";
  if (v === "BASE_MATERIAL") return "BASE_MATERIAL";
  if (v === "HAZ") return "HAZ";
  if (v === "COMPONENT") return "COMPONENT";
  if (v === "COATING") return "COATING";
  return "UNKNOWN";
}

function normalizeMaterialClass(input?: string | null): MaterialClass {
  var v = (input || "").trim().toUpperCase();
  if (v === "METALLIC") return "METALLIC";
  if (v === "POLYMER") return "POLYMER";
  if (v === "COMPOSITE") return "COMPOSITE";
  if (v === "CERAMIC_GLASS") return "CERAMIC_GLASS";
  if (v === "ELASTOMER") return "ELASTOMER";
  if (v === "CIVIL_MINERAL") return "CIVIL_MINERAL";
  if (v === "COATING_LINER") return "COATING_LINER";
  return "UNKNOWN";
}

function normalizeServiceEnvironment(input?: string | null): ServiceEnvironment {
  var v = (input || "").trim().toUpperCase();
  var allowed: ServiceEnvironment[] = [
    "ATMOSPHERIC","MARINE","BURIED","IMMERSION_FRESH_WATER","IMMERSION_SALT_WATER",
    "SOUR_SERVICE","CHEMICAL_PROCESS","HIGH_TEMPERATURE","LOW_TEMPERATURE",
    "ABRASIVE_FLOW","CYCLIC_PRESSURE","UV_EXPOSURE","STEAM_SERVICE","UNKNOWN"
  ];
  return (allowed.includes(v as ServiceEnvironment) ? v : "UNKNOWN") as ServiceEnvironment;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/* ================================================================
   ENGINE PROFILES
================================================================ */

export var ENGINE_PROFILES: Record<InspectionEngineRoute, EngineProfile> = {
  WELD_FABRICATION_ENGINE: {
    route: "WELD_FABRICATION_ENGINE",
    dominantMechanisms: [],
    likelyCauses: ["fabrication discontinuity logic handled by weld engine"],
    recommendedMethods: ["VT", "PT", "MT", "UT", "RT"],
    evidenceWeighting: { morphology: 1.3, environment: 0.7, material: 1.0, location: 1.1, service: 0.5 },
    authorityPenaltyIfUnknown: 0.15,
    teachingFocus: ["weld context confirmed; use welding method engine"]
  },

  METALLIC_DAMAGE_ENGINE: {
    route: "METALLIC_DAMAGE_ENGINE",
    dominantMechanisms: [
      "UNIFORM_CORROSION","PITTING_CORROSION","CREVICE_CORROSION","GALVANIC_CORROSION",
      "EROSION","EROSION_CORROSION","CAVITATION_DAMAGE","FATIGUE_CRACKING",
      "STRESS_CORROSION_CRACKING","HYDROGEN_DAMAGE","THERMAL_CRACKING",
      "LAMINATION","LOCAL_METAL_LOSS","GENERAL_WALL_LOSS","MECHANICAL_GOUGE",
      "MECHANICAL_DENT","MECHANICAL_SCORE","DEFORMATION","BULGING","OVALITY",
      "LEAK_PATH_INDICATION","OVERHEAT_DAMAGE","HEAT_TINT_OXIDATION"
    ],
    likelyCauses: [
      "electrochemical attack","flow-assisted wall loss","service stress","cyclic loading",
      "hydrogen exposure","mechanical impact","abrasive wear","chemical attack","localized crevice conditions"
    ],
    recommendedMethods: ["VT","UT_THICKNESS","PT","MT","UT_SHEAR_WAVE","RT","ET"],
    evidenceWeighting: { morphology: 1.2, environment: 1.3, material: 1.2, location: 1.0, service: 1.35 },
    authorityPenaltyIfUnknown: 0.18,
    teachingFocus: ["damage mechanism identification","service/environment correlation","remaining wall evaluation"]
  },

  POLYMER_DEGRADATION_ENGINE: {
    route: "POLYMER_DEGRADATION_ENGINE",
    dominantMechanisms: [
      "CREEP_DEFORMATION","ENVIRONMENTAL_STRESS_CRACKING","UV_DEGRADATION","SWELLING",
      "SOFTENING","EMBRITTLEMENT","THERMAL_WARPING","CHEMICAL_ATTACK_POLYMER",
      "MECHANICAL_GOUGE","ABRASION_DAMAGE","LEAK_PATH_INDICATION"
    ],
    likelyCauses: [
      "UV exposure","chemical incompatibility","long-term stress","temperature exposure",
      "solvent attack","aging","mechanical abrasion","installation damage"
    ],
    recommendedMethods: ["VT","DIMENSIONAL_CHECK","LEAK_TEST","THERMOGRAPHY","MATERIAL_COMPATIBILITY_REVIEW"],
    evidenceWeighting: { morphology: 1.2, environment: 1.35, material: 1.35, location: 0.95, service: 1.25 },
    authorityPenaltyIfUnknown: 0.22,
    teachingFocus: ["polymer compatibility","aging/degradation patterns","creep and stress cracking"]
  },

  COMPOSITE_DAMAGE_ENGINE: {
    route: "COMPOSITE_DAMAGE_ENGINE",
    dominantMechanisms: [
      "DELAMINATION","FIBER_BREAKAGE","MATRIX_CRACKING","IMPACT_DAMAGE",
      "DISBOND","MOISTURE_INGRESS","VOIDS","CORE_CRUSH"
    ],
    likelyCauses: [
      "impact loading","poor bonding","moisture ingress","resin degradation",
      "fiber overload","manufacturing voids","core crushing"
    ],
    recommendedMethods: ["VT","TAP_TEST","UT","THERMOGRAPHY","SHEAROGRAPHY","RT"],
    evidenceWeighting: { morphology: 1.25, environment: 1.1, material: 1.35, location: 1.0, service: 1.2 },
    authorityPenaltyIfUnknown: 0.24,
    teachingFocus: ["delamination recognition","impact zone mapping","bond/interface integrity"]
  },

  CERAMIC_GLASS_DAMAGE_ENGINE: {
    route: "CERAMIC_GLASS_DAMAGE_ENGINE",
    dominantMechanisms: [
      "BRITTLE_CRACKING","CHIPPING","SPALLING","THERMAL_SHOCK_DAMAGE","GLAZE_FAILURE"
    ],
    likelyCauses: [
      "brittle impact damage","thermal shock","edge damage","surface stress concentration"
    ],
    recommendedMethods: ["VT","DIMENSIONAL_CHECK","THERMAL_REVIEW","ACOUSTIC_TAP_CHECK"],
    evidenceWeighting: { morphology: 1.3, environment: 1.0, material: 1.3, location: 1.0, service: 1.15 },
    authorityPenaltyIfUnknown: 0.25,
    teachingFocus: ["brittle fracture patterns","thermal shock recognition","edge/chip damage"]
  },

  ELASTOMER_DEGRADATION_ENGINE: {
    route: "ELASTOMER_DEGRADATION_ENGINE",
    dominantMechanisms: [
      "TEARING","SWELLING","COMPRESSION_SET","HARDENING","SOFTENING",
      "EMBRITTLEMENT","OZONE_CRACKING"
    ],
    likelyCauses: [
      "chemical incompatibility","aging","UV/ozone exposure","compression fatigue","temperature effects"
    ],
    recommendedMethods: ["VT","DIMENSIONAL_CHECK","HARDNESS_CHECK","SEAL_FIT_CHECK","LEAK_TEST"],
    evidenceWeighting: { morphology: 1.2, environment: 1.3, material: 1.3, location: 0.95, service: 1.2 },
    authorityPenaltyIfUnknown: 0.23,
    teachingFocus: ["seal degradation","swelling vs hardening","aging and ozone cracking"]
  },

  CIVIL_MINERAL_DAMAGE_ENGINE: {
    route: "CIVIL_MINERAL_DAMAGE_ENGINE",
    dominantMechanisms: [
      "SURFACE_SCALING","CRACKING_CIVIL","DELAMINATION_CIVIL","SPALLING","CHEMICAL_ATTACK_CIVIL"
    ],
    likelyCauses: [
      "freeze-thaw damage","reinforcement-related distress","chemical attack","shrinkage cracking","surface deterioration"
    ],
    recommendedMethods: ["VT","HAMMER_SOUNDING","REBOUND_CHECK","MOISTURE_CHECK","CORE_SAMPLING"],
    evidenceWeighting: { morphology: 1.2, environment: 1.2, material: 1.25, location: 1.0, service: 1.15 },
    authorityPenaltyIfUnknown: 0.24,
    teachingFocus: ["surface distress mapping","crack pattern interpretation","delamination/spall recognition"]
  },

  COATING_LINER_ENGINE: {
    route: "COATING_LINER_ENGINE",
    dominantMechanisms: [
      "BLISTERING","COATING_FAILURE","COATING_DISBONDMENT","PINHOLES",
      "UNDERFILM_CORROSION","LINER_SEPARATION","CHEMICAL_ATTACK_POLYMER"
    ],
    likelyCauses: [
      "poor adhesion","surface prep failure","moisture ingress","chemical attack",
      "holiday/pinhole defects","underfilm corrosion","liner debonding"
    ],
    recommendedMethods: ["VT","HOLIDAY_TEST","DFT_MEASUREMENT","ADHESION_TEST","SPARK_TEST"],
    evidenceWeighting: { morphology: 1.25, environment: 1.2, material: 1.2, location: 1.0, service: 1.2 },
    authorityPenaltyIfUnknown: 0.2,
    teachingFocus: ["adhesion failure patterns","holiday/pinhole logic","underfilm attack"]
  },

  COMPONENT_GENERAL_ENGINE: {
    route: "COMPONENT_GENERAL_ENGINE",
    dominantMechanisms: [
      "MISALIGNMENT_COMPONENT","MECHANICAL_GOUGE","MECHANICAL_DENT","DEFORMATION",
      "BULGING","OVALITY","LEAK_PATH_INDICATION"
    ],
    likelyCauses: [
      "mechanical damage","assembly error","overload","misfit","service distortion"
    ],
    recommendedMethods: ["VT","DIMENSIONAL_CHECK","FIT_CHECK","LEAK_TEST"],
    evidenceWeighting: { morphology: 1.15, environment: 0.9, material: 1.0, location: 1.15, service: 1.0 },
    authorityPenaltyIfUnknown: 0.22,
    teachingFocus: ["component geometry","fit/alignment","damage vs fabrication separation"]
  },

  UNKNOWN_ENGINE: {
    route: "UNKNOWN_ENGINE",
    dominantMechanisms: ["UNKNOWN_CONDITION"],
    likelyCauses: ["inspection route not locked"],
    recommendedMethods: ["VT"],
    evidenceWeighting: { morphology: 1.0, environment: 0.8, material: 0.75, location: 1.0, service: 0.8 },
    authorityPenaltyIfUnknown: 0.35,
    teachingFocus: ["lock context and material before trusting results"]
  }
};

/* ================================================================
   ROUTING LOGIC
================================================================ */

export function determineInspectionRoute(input: UniversalInspectionInput): RouteDecision {
  var context = normalizeInspectionContext(input.inspectionContext);
  var materialClass = normalizeMaterialClass(input.materialClass);
  var warnings: string[] = [];
  var rationale: string[] = [];

  if (context === "WELD") {
    rationale.push("inspection context explicitly set to weld");
    return { context: context, materialClass: materialClass, route: "WELD_FABRICATION_ENGINE", warnings: warnings, rationale: rationale };
  }

  if (context === "COATING") {
    rationale.push("inspection context explicitly set to coating/liner");
    return { context: context, materialClass: materialClass, route: "COATING_LINER_ENGINE", warnings: warnings, rationale: rationale };
  }

  if (context === "COMPONENT") {
    rationale.push("inspection context explicitly set to component/assembly");
    return { context: context, materialClass: materialClass, route: "COMPONENT_GENERAL_ENGINE", warnings: warnings, rationale: rationale };
  }

  if (context === "BASE_MATERIAL" || context === "HAZ" || context === "UNKNOWN") {
    if (materialClass === "METALLIC") {
      rationale.push("base material with metallic class");
      return { context: context, materialClass: materialClass, route: "METALLIC_DAMAGE_ENGINE", warnings: warnings, rationale: rationale };
    }
    if (materialClass === "POLYMER") {
      rationale.push("base material with polymer class");
      return { context: context, materialClass: materialClass, route: "POLYMER_DEGRADATION_ENGINE", warnings: warnings, rationale: rationale };
    }
    if (materialClass === "COMPOSITE") {
      rationale.push("base material with composite class");
      return { context: context, materialClass: materialClass, route: "COMPOSITE_DAMAGE_ENGINE", warnings: warnings, rationale: rationale };
    }
    if (materialClass === "CERAMIC_GLASS") {
      rationale.push("base material with ceramic/glass class");
      return { context: context, materialClass: materialClass, route: "CERAMIC_GLASS_DAMAGE_ENGINE", warnings: warnings, rationale: rationale };
    }
    if (materialClass === "ELASTOMER") {
      rationale.push("base material with elastomer class");
      return { context: context, materialClass: materialClass, route: "ELASTOMER_DEGRADATION_ENGINE", warnings: warnings, rationale: rationale };
    }
    if (materialClass === "CIVIL_MINERAL") {
      rationale.push("base material with civil/mineral class");
      return { context: context, materialClass: materialClass, route: "CIVIL_MINERAL_DAMAGE_ENGINE", warnings: warnings, rationale: rationale };
    }
    if (materialClass === "COATING_LINER") {
      rationale.push("material class indicates coating/liner");
      return { context: context, materialClass: materialClass, route: "COATING_LINER_ENGINE", warnings: warnings, rationale: rationale };
    }
  }

  warnings.push("inspection context and/or material class not sufficiently locked");
  warnings.push("final authority should be reduced and escalation threshold increased");
  return {
    context: context,
    materialClass: materialClass,
    route: "UNKNOWN_ENGINE",
    warnings: warnings,
    rationale: rationale.concat(["unable to lock inspection route confidently"])
  };
}

/* ================================================================
   DEFAULT CANDIDATES BY ROUTE
================================================================ */

function getDefaultCandidates(route: InspectionEngineRoute): Array<{ code: MaterialConditionCode; baseScore: number }> {
  return ENGINE_PROFILES[route].dominantMechanisms.map(function(code) {
    return { code: code, baseScore: 0.35 };
  });
}

/* ================================================================
   EVIDENCE SCORING
================================================================ */

function evidenceBoost(code: MaterialConditionCode, input: UniversalInspectionInput, route: InspectionEngineRoute): number {
  var e = input.evidence || {};
  var boost = 0;

  /* Metallic */
  if (e.pittingVisible && (code === "PITTING_CORROSION" || code === "LOCAL_METAL_LOSS")) boost += 0.22;
  if (e.widespreadWallLossVisible && (code === "UNIFORM_CORROSION" || code === "GENERAL_WALL_LOSS")) boost += 0.20;
  if (e.directionalWearVisible && (code === "EROSION" || code === "EROSION_CORROSION" || code === "ABRASION_DAMAGE")) boost += 0.20;
  if (e.crackingVisible && ["FATIGUE_CRACKING","STRESS_CORROSION_CRACKING","HYDROGEN_DAMAGE","THERMAL_CRACKING","BRITTLE_CRACKING","CRACKING_CIVIL"].includes(code)) boost += 0.18;
  if (e.dentVisible && code === "MECHANICAL_DENT") boost += 0.22;
  if (e.gougeVisible && code === "MECHANICAL_GOUGE") boost += 0.22;
  if (e.bulgingVisible && (code === "BULGING" || code === "DEFORMATION")) boost += 0.20;
  if (e.rustScaleVisible && (code === "UNIFORM_CORROSION" || code === "PITTING_CORROSION" || code === "UNDERFILM_CORROSION")) boost += 0.16;
  if (e.heatDiscolorationVisible && (code === "OVERHEAT_DAMAGE" || code === "HEAT_TINT_OXIDATION")) boost += 0.18;
  if (e.leakTraceVisible && code === "LEAK_PATH_INDICATION") boost += 0.22;
  if (e.deformationVisible && (code === "DEFORMATION" || code === "OVALITY" || code === "MISALIGNMENT_COMPONENT")) boost += 0.18;

  /* Coating / liner */
  if (e.coatingPeelingVisible && (code === "COATING_FAILURE" || code === "COATING_DISBONDMENT" || code === "LINER_SEPARATION")) boost += 0.22;
  if (e.blisteringVisible && code === "BLISTERING") boost += 0.24;
  if (e.pinholesVisible && code === "PINHOLES") boost += 0.24;
  if (e.underfilmRustVisible && code === "UNDERFILM_CORROSION") boost += 0.22;

  /* Polymer */
  if (e.crazingVisible && code === "ENVIRONMENTAL_STRESS_CRACKING") boost += 0.20;
  if (e.chalkingVisible && code === "UV_DEGRADATION") boost += 0.18;
  if (e.swellingVisible && (code === "SWELLING" || code === "CHEMICAL_ATTACK_POLYMER")) boost += 0.22;
  if (e.softeningVisible && (code === "SOFTENING" || code === "CHEMICAL_ATTACK_POLYMER")) boost += 0.22;
  if (e.embrittlementVisible && (code === "EMBRITTLEMENT" || code === "ENVIRONMENTAL_STRESS_CRACKING")) boost += 0.18;
  if (e.warpVisible && (code === "THERMAL_WARPING" || code === "CREEP_DEFORMATION")) boost += 0.20;

  /* Composite */
  if (e.fiberExposureVisible && code === "FIBER_BREAKAGE") boost += 0.22;
  if (e.delaminationVisible && code === "DELAMINATION") boost += 0.24;
  if (e.matrixCrackVisible && code === "MATRIX_CRACKING") boost += 0.22;
  if (e.impactZoneVisible && code === "IMPACT_DAMAGE") boost += 0.24;
  if (e.coreCrushVisible && code === "CORE_CRUSH") boost += 0.24;

  /* Ceramic / glass */
  if (e.chippingVisible && code === "CHIPPING") boost += 0.22;
  if (e.spallingVisible && code === "SPALLING") boost += 0.24;
  if (e.shatteredOrBrittleCrackVisible && code === "BRITTLE_CRACKING") boost += 0.24;

  /* Elastomer */
  if (e.tearingVisible && code === "TEARING") boost += 0.24;
  if (e.compressionSetVisible && code === "COMPRESSION_SET") boost += 0.24;
  if (e.ozoneCrackPatternVisible && code === "OZONE_CRACKING") boost += 0.24;

  /* Civil / mineral */
  if (e.scalingVisible && code === "SURFACE_SCALING") boost += 0.22;
  if (e.mapCrackingVisible && code === "CRACKING_CIVIL") boost += 0.22;

  /* Route compatibility bonus */
  if (ENGINE_PROFILES[route].dominantMechanisms.includes(code)) boost += 0.05;

  return boost;
}

/* ================================================================
   ENVIRONMENT BIASES
================================================================ */

function environmentBias(code: MaterialConditionCode, env: ServiceEnvironment): number {
  switch (env) {
    case "MARINE":
    case "IMMERSION_SALT_WATER":
      if (["UNIFORM_CORROSION","PITTING_CORROSION","CREVICE_CORROSION","GALVANIC_CORROSION","UNDERFILM_CORROSION"].includes(code)) return 0.12;
      if (["COATING_FAILURE","BLISTERING"].includes(code)) return 0.08;
      return 0;

    case "BURIED":
      if (["GENERAL_WALL_LOSS","LOCAL_METAL_LOSS","PITTING_CORROSION","COATING_DISBONDMENT","UNDERFILM_CORROSION"].includes(code)) return 0.12;
      return 0;

    case "ABRASIVE_FLOW":
      if (["EROSION","EROSION_CORROSION","ABRASION_DAMAGE","LOCAL_METAL_LOSS"].includes(code)) return 0.12;
      return 0;

    case "CYCLIC_PRESSURE":
      if (["FATIGUE_CRACKING","DEFORMATION","BULGING","LEAK_PATH_INDICATION"].includes(code)) return 0.1;
      return 0;

    case "CHEMICAL_PROCESS":
      if (["CHEMICAL_ATTACK_POLYMER","UNIFORM_CORROSION","PITTING_CORROSION","STRESS_CORROSION_CRACKING","BLISTERING"].includes(code)) return 0.12;
      return 0;

    case "HIGH_TEMPERATURE":
      if (["THERMAL_CRACKING","OVERHEAT_DAMAGE","HEAT_TINT_OXIDATION","THERMAL_WARPING","HARDENING"].includes(code)) return 0.1;
      return 0;

    case "UV_EXPOSURE":
      if (["UV_DEGRADATION","EMBRITTLEMENT","OZONE_CRACKING","COATING_FAILURE"].includes(code)) return 0.12;
      return 0;

    default:
      return 0;
  }
}

/* ================================================================
   MAIN ENGINE
================================================================ */

export function runUniversalInspectionContextEngine(input: UniversalInspectionInput): UniversalInspectionOutput {
  var routeDecision = determineInspectionRoute(input);
  var route = routeDecision.route;
  var profile = ENGINE_PROFILES[route];
  var env = normalizeServiceEnvironment(input.serviceEnvironment);

  var warnings = routeDecision.warnings.slice();

  var candidates = (input.candidateConditions && input.candidateConditions.length > 0)
    ? input.candidateConditions
    : getDefaultCandidates(route);

  var adjustedConditions: AdjustedCondition[] = candidates.map(function(candidate) {
    var score = candidate.baseScore;
    var notes: string[] = [];

    var eBoost = evidenceBoost(candidate.code, input, route);
    if (eBoost > 0) {
      score += eBoost;
      notes.push("evidence boost +" + eBoost.toFixed(2));
    }

    var envBoost = environmentBias(candidate.code, env);
    if (envBoost > 0) {
      score += envBoost;
      notes.push("environment bias +" + envBoost.toFixed(2) + " (" + env + ")");
    }

    if (route === "UNKNOWN_ENGINE") {
      score -= profile.authorityPenaltyIfUnknown;
      notes.push("unknown-route penalty -" + profile.authorityPenaltyIfUnknown.toFixed(2));
    }

    score = clamp01(score);

    return {
      code: candidate.code,
      originalScore: candidate.baseScore,
      adjustedScore: score,
      notes: notes
    };
  });

  adjustedConditions.sort(function(a, b) { return b.adjustedScore - a.adjustedScore; });

  var top = adjustedConditions[0] || null;
  var second = adjustedConditions[1] || null;
  var gap = top && second ? top.adjustedScore - second.adjustedScore : (top ? top.adjustedScore : 0);

  var primaryLocked = false;
  var confidenceBand: "LOW" | "MODERATE" | "HIGH" = "LOW";

  if (top) {
    if (top.adjustedScore >= 0.75 && gap >= 0.08 && route !== "UNKNOWN_ENGINE") {
      primaryLocked = true;
      confidenceBand = "HIGH";
    } else if (top.adjustedScore >= 0.62 && gap >= 0.05) {
      primaryLocked = true;
      confidenceBand = "MODERATE";
    }
  }

  if (!primaryLocked) {
    warnings.push("primary condition not sufficiently locked");
  }

  return {
    routeDecision: routeDecision,
    profile: profile,
    adjustedConditions: adjustedConditions,
    probableCauses: profile.likelyCauses,
    recommendedMethods: profile.recommendedMethods,
    teachingFocus: profile.teachingFocus,
    warnings: warnings,
    primaryCondition: primaryLocked && top ? top.code : null,
    primaryLocked: primaryLocked,
    confidenceBand: confidenceBand
  };
}
