/**
 * DEPLOY35v2 — run-universal-route.ts
 * netlify/functions/run-universal-route.ts
 *
 * Universal Inspection Context Engine — INLINED
 * No external lib import — engine code is embedded directly.
 *
 * CONSTRAINT: No backtick template literals (Git Bash paste corruption)
 */
import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/* ================================================================
   INLINED ENGINE — TYPES
================================================================ */

type InspectionContext = "WELD" | "BASE_MATERIAL" | "HAZ" | "COMPONENT" | "COATING" | "UNKNOWN";
type MaterialClass = "METALLIC" | "POLYMER" | "COMPOSITE" | "CERAMIC_GLASS" | "ELASTOMER" | "CIVIL_MINERAL" | "COATING_LINER" | "UNKNOWN";

type InspectionEngineRoute =
  | "WELD_FABRICATION_ENGINE" | "METALLIC_DAMAGE_ENGINE" | "POLYMER_DEGRADATION_ENGINE"
  | "COMPOSITE_DAMAGE_ENGINE" | "CERAMIC_GLASS_DAMAGE_ENGINE" | "ELASTOMER_DEGRADATION_ENGINE"
  | "CIVIL_MINERAL_DAMAGE_ENGINE" | "COATING_LINER_ENGINE" | "COMPONENT_GENERAL_ENGINE" | "UNKNOWN_ENGINE";

type ServiceEnvironment =
  | "ATMOSPHERIC" | "MARINE" | "BURIED" | "IMMERSION_FRESH_WATER" | "IMMERSION_SALT_WATER"
  | "SOUR_SERVICE" | "CHEMICAL_PROCESS" | "HIGH_TEMPERATURE" | "LOW_TEMPERATURE"
  | "ABRASIVE_FLOW" | "CYCLIC_PRESSURE" | "UV_EXPOSURE" | "STEAM_SERVICE" | "UNKNOWN";

type MaterialConditionCode =
  | "UNIFORM_CORROSION" | "PITTING_CORROSION" | "CREVICE_CORROSION" | "GALVANIC_CORROSION"
  | "EROSION" | "EROSION_CORROSION" | "CAVITATION_DAMAGE" | "FATIGUE_CRACKING"
  | "STRESS_CORROSION_CRACKING" | "HYDROGEN_DAMAGE" | "THERMAL_CRACKING" | "LAMINATION"
  | "DELAMINATION" | "LOCAL_METAL_LOSS" | "GENERAL_WALL_LOSS" | "HEAT_TINT_OXIDATION"
  | "OVERHEAT_DAMAGE" | "MECHANICAL_GOUGE" | "MECHANICAL_DENT" | "MECHANICAL_SCORE"
  | "ABRASION_DAMAGE" | "DEFORMATION" | "BULGING" | "OVALITY"
  | "MISALIGNMENT_COMPONENT" | "LEAK_PATH_INDICATION"
  | "CREEP_DEFORMATION" | "ENVIRONMENTAL_STRESS_CRACKING" | "UV_DEGRADATION"
  | "SWELLING" | "SOFTENING" | "EMBRITTLEMENT" | "THERMAL_WARPING" | "CHEMICAL_ATTACK_POLYMER"
  | "FIBER_BREAKAGE" | "MATRIX_CRACKING" | "IMPACT_DAMAGE" | "DISBOND"
  | "MOISTURE_INGRESS" | "VOIDS" | "CORE_CRUSH"
  | "BRITTLE_CRACKING" | "CHIPPING" | "SPALLING" | "THERMAL_SHOCK_DAMAGE" | "GLAZE_FAILURE"
  | "TEARING" | "COMPRESSION_SET" | "HARDENING" | "OZONE_CRACKING"
  | "BLISTERING" | "COATING_FAILURE" | "COATING_DISBONDMENT" | "PINHOLES"
  | "UNDERFILM_CORROSION" | "LINER_SEPARATION"
  | "SURFACE_SCALING" | "CRACKING_CIVIL" | "DELAMINATION_CIVIL" | "CHEMICAL_ATTACK_CIVIL"
  | "UNKNOWN_CONDITION";

interface RouteDecision {
  context: InspectionContext;
  materialClass: MaterialClass;
  route: InspectionEngineRoute;
  warnings: string[];
  rationale: string[];
}

interface AdjustedCondition {
  code: MaterialConditionCode;
  originalScore: number;
  adjustedScore: number;
  notes: string[];
}

interface EngineProfile {
  route: InspectionEngineRoute;
  dominantMechanisms: MaterialConditionCode[];
  likelyCauses: string[];
  recommendedMethods: string[];
  evidenceWeighting: { morphology: number; environment: number; material: number; location: number; service: number; };
  authorityPenaltyIfUnknown: number;
  teachingFocus: string[];
}

interface UniversalInspectionInput {
  inspectionContext?: string | null;
  materialClass?: string | null;
  materialFamily?: string | null;
  surfaceType?: string | null;
  serviceEnvironment?: string | null;
  weldingMethod?: string | null;
  evidence?: Record<string, boolean>;
  candidateConditions?: Array<{ code: MaterialConditionCode; baseScore: number }>;
}

interface UniversalInspectionOutput {
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
   INLINED ENGINE — NORMALIZERS
================================================================ */

function normalizeIC(input?: string | null): InspectionContext {
  var v = (input || "").trim().toUpperCase();
  if (v === "WELD") return "WELD";
  if (v === "BASE_MATERIAL") return "BASE_MATERIAL";
  if (v === "HAZ") return "HAZ";
  if (v === "COMPONENT") return "COMPONENT";
  if (v === "COATING") return "COATING";
  return "UNKNOWN";
}

function normalizeMC(input?: string | null): MaterialClass {
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

function normalizeSE(input?: string | null): ServiceEnvironment {
  var v = (input || "").trim().toUpperCase();
  var allowed = [
    "ATMOSPHERIC","MARINE","BURIED","IMMERSION_FRESH_WATER","IMMERSION_SALT_WATER",
    "SOUR_SERVICE","CHEMICAL_PROCESS","HIGH_TEMPERATURE","LOW_TEMPERATURE",
    "ABRASIVE_FLOW","CYCLIC_PRESSURE","UV_EXPOSURE","STEAM_SERVICE","UNKNOWN"
  ];
  return (allowed.includes(v) ? v : "UNKNOWN") as ServiceEnvironment;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/* ================================================================
   INLINED ENGINE — PROFILES
================================================================ */

var ENGINE_PROFILES: Record<InspectionEngineRoute, EngineProfile> = {
  WELD_FABRICATION_ENGINE: {
    route: "WELD_FABRICATION_ENGINE", dominantMechanisms: [],
    likelyCauses: ["fabrication discontinuity logic handled by weld engine"],
    recommendedMethods: ["VT","PT","MT","UT","RT"],
    evidenceWeighting: { morphology: 1.3, environment: 0.7, material: 1.0, location: 1.1, service: 0.5 },
    authorityPenaltyIfUnknown: 0.15, teachingFocus: ["weld context confirmed; use welding method engine"]
  },
  METALLIC_DAMAGE_ENGINE: {
    route: "METALLIC_DAMAGE_ENGINE",
    dominantMechanisms: ["UNIFORM_CORROSION","PITTING_CORROSION","CREVICE_CORROSION","GALVANIC_CORROSION","EROSION","EROSION_CORROSION","CAVITATION_DAMAGE","FATIGUE_CRACKING","STRESS_CORROSION_CRACKING","HYDROGEN_DAMAGE","THERMAL_CRACKING","LAMINATION","LOCAL_METAL_LOSS","GENERAL_WALL_LOSS","MECHANICAL_GOUGE","MECHANICAL_DENT","MECHANICAL_SCORE","DEFORMATION","BULGING","OVALITY","LEAK_PATH_INDICATION","OVERHEAT_DAMAGE","HEAT_TINT_OXIDATION"],
    likelyCauses: ["electrochemical attack","flow-assisted wall loss","service stress","cyclic loading","hydrogen exposure","mechanical impact","abrasive wear","chemical attack","localized crevice conditions"],
    recommendedMethods: ["VT","UT_THICKNESS","PT","MT","UT_SHEAR_WAVE","RT","ET"],
    evidenceWeighting: { morphology: 1.2, environment: 1.3, material: 1.2, location: 1.0, service: 1.35 },
    authorityPenaltyIfUnknown: 0.18, teachingFocus: ["damage mechanism identification","service/environment correlation","remaining wall evaluation"]
  },
  POLYMER_DEGRADATION_ENGINE: {
    route: "POLYMER_DEGRADATION_ENGINE",
    dominantMechanisms: ["CREEP_DEFORMATION","ENVIRONMENTAL_STRESS_CRACKING","UV_DEGRADATION","SWELLING","SOFTENING","EMBRITTLEMENT","THERMAL_WARPING","CHEMICAL_ATTACK_POLYMER","MECHANICAL_GOUGE","ABRASION_DAMAGE","LEAK_PATH_INDICATION"],
    likelyCauses: ["UV exposure","chemical incompatibility","long-term stress","temperature exposure","solvent attack","aging","mechanical abrasion","installation damage"],
    recommendedMethods: ["VT","DIMENSIONAL_CHECK","LEAK_TEST","THERMOGRAPHY","MATERIAL_COMPATIBILITY_REVIEW"],
    evidenceWeighting: { morphology: 1.2, environment: 1.35, material: 1.35, location: 0.95, service: 1.25 },
    authorityPenaltyIfUnknown: 0.22, teachingFocus: ["polymer compatibility","aging/degradation patterns","creep and stress cracking"]
  },
  COMPOSITE_DAMAGE_ENGINE: {
    route: "COMPOSITE_DAMAGE_ENGINE",
    dominantMechanisms: ["DELAMINATION","FIBER_BREAKAGE","MATRIX_CRACKING","IMPACT_DAMAGE","DISBOND","MOISTURE_INGRESS","VOIDS","CORE_CRUSH"],
    likelyCauses: ["impact loading","poor bonding","moisture ingress","resin degradation","fiber overload","manufacturing voids","core crushing"],
    recommendedMethods: ["VT","TAP_TEST","UT","THERMOGRAPHY","SHEAROGRAPHY","RT"],
    evidenceWeighting: { morphology: 1.25, environment: 1.1, material: 1.35, location: 1.0, service: 1.2 },
    authorityPenaltyIfUnknown: 0.24, teachingFocus: ["delamination recognition","impact zone mapping","bond/interface integrity"]
  },
  CERAMIC_GLASS_DAMAGE_ENGINE: {
    route: "CERAMIC_GLASS_DAMAGE_ENGINE",
    dominantMechanisms: ["BRITTLE_CRACKING","CHIPPING","SPALLING","THERMAL_SHOCK_DAMAGE","GLAZE_FAILURE"],
    likelyCauses: ["brittle impact damage","thermal shock","edge damage","surface stress concentration"],
    recommendedMethods: ["VT","DIMENSIONAL_CHECK","THERMAL_REVIEW","ACOUSTIC_TAP_CHECK"],
    evidenceWeighting: { morphology: 1.3, environment: 1.0, material: 1.3, location: 1.0, service: 1.15 },
    authorityPenaltyIfUnknown: 0.25, teachingFocus: ["brittle fracture patterns","thermal shock recognition","edge/chip damage"]
  },
  ELASTOMER_DEGRADATION_ENGINE: {
    route: "ELASTOMER_DEGRADATION_ENGINE",
    dominantMechanisms: ["TEARING","SWELLING","COMPRESSION_SET","HARDENING","SOFTENING","EMBRITTLEMENT","OZONE_CRACKING"],
    likelyCauses: ["chemical incompatibility","aging","UV/ozone exposure","compression fatigue","temperature effects"],
    recommendedMethods: ["VT","DIMENSIONAL_CHECK","HARDNESS_CHECK","SEAL_FIT_CHECK","LEAK_TEST"],
    evidenceWeighting: { morphology: 1.2, environment: 1.3, material: 1.3, location: 0.95, service: 1.2 },
    authorityPenaltyIfUnknown: 0.23, teachingFocus: ["seal degradation","swelling vs hardening","aging and ozone cracking"]
  },
  CIVIL_MINERAL_DAMAGE_ENGINE: {
    route: "CIVIL_MINERAL_DAMAGE_ENGINE",
    dominantMechanisms: ["SURFACE_SCALING","CRACKING_CIVIL","DELAMINATION_CIVIL","SPALLING","CHEMICAL_ATTACK_CIVIL"],
    likelyCauses: ["freeze-thaw damage","reinforcement-related distress","chemical attack","shrinkage cracking","surface deterioration"],
    recommendedMethods: ["VT","HAMMER_SOUNDING","REBOUND_CHECK","MOISTURE_CHECK","CORE_SAMPLING"],
    evidenceWeighting: { morphology: 1.2, environment: 1.2, material: 1.25, location: 1.0, service: 1.15 },
    authorityPenaltyIfUnknown: 0.24, teachingFocus: ["surface distress mapping","crack pattern interpretation","delamination/spall recognition"]
  },
  COATING_LINER_ENGINE: {
    route: "COATING_LINER_ENGINE",
    dominantMechanisms: ["BLISTERING","COATING_FAILURE","COATING_DISBONDMENT","PINHOLES","UNDERFILM_CORROSION","LINER_SEPARATION","CHEMICAL_ATTACK_POLYMER"],
    likelyCauses: ["poor adhesion","surface prep failure","moisture ingress","chemical attack","holiday/pinhole defects","underfilm corrosion","liner debonding"],
    recommendedMethods: ["VT","HOLIDAY_TEST","DFT_MEASUREMENT","ADHESION_TEST","SPARK_TEST"],
    evidenceWeighting: { morphology: 1.25, environment: 1.2, material: 1.2, location: 1.0, service: 1.2 },
    authorityPenaltyIfUnknown: 0.2, teachingFocus: ["adhesion failure patterns","holiday/pinhole logic","underfilm attack"]
  },
  COMPONENT_GENERAL_ENGINE: {
    route: "COMPONENT_GENERAL_ENGINE",
    dominantMechanisms: ["MISALIGNMENT_COMPONENT","MECHANICAL_GOUGE","MECHANICAL_DENT","DEFORMATION","BULGING","OVALITY","LEAK_PATH_INDICATION"],
    likelyCauses: ["mechanical damage","assembly error","overload","misfit","service distortion"],
    recommendedMethods: ["VT","DIMENSIONAL_CHECK","FIT_CHECK","LEAK_TEST"],
    evidenceWeighting: { morphology: 1.15, environment: 0.9, material: 1.0, location: 1.15, service: 1.0 },
    authorityPenaltyIfUnknown: 0.22, teachingFocus: ["component geometry","fit/alignment","damage vs fabrication separation"]
  },
  UNKNOWN_ENGINE: {
    route: "UNKNOWN_ENGINE",
    dominantMechanisms: ["UNKNOWN_CONDITION"],
    likelyCauses: ["inspection route not locked"],
    recommendedMethods: ["VT"],
    evidenceWeighting: { morphology: 1.0, environment: 0.8, material: 0.75, location: 1.0, service: 0.8 },
    authorityPenaltyIfUnknown: 0.35, teachingFocus: ["lock context and material before trusting results"]
  }
};

/* ================================================================
   INLINED ENGINE — ROUTING
================================================================ */

function determineRoute(input: UniversalInspectionInput): RouteDecision {
  var context = normalizeIC(input.inspectionContext);
  var materialClass = normalizeMC(input.materialClass);
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
    var classRouteMap: Record<string, InspectionEngineRoute> = {
      METALLIC: "METALLIC_DAMAGE_ENGINE",
      POLYMER: "POLYMER_DEGRADATION_ENGINE",
      COMPOSITE: "COMPOSITE_DAMAGE_ENGINE",
      CERAMIC_GLASS: "CERAMIC_GLASS_DAMAGE_ENGINE",
      ELASTOMER: "ELASTOMER_DEGRADATION_ENGINE",
      CIVIL_MINERAL: "CIVIL_MINERAL_DAMAGE_ENGINE",
      COATING_LINER: "COATING_LINER_ENGINE"
    };
    if (classRouteMap[materialClass]) {
      rationale.push("base material with " + materialClass.toLowerCase() + " class");
      return { context: context, materialClass: materialClass, route: classRouteMap[materialClass], warnings: warnings, rationale: rationale };
    }
  }

  warnings.push("inspection context and/or material class not sufficiently locked");
  warnings.push("final authority should be reduced and escalation threshold increased");
  return { context: context, materialClass: materialClass, route: "UNKNOWN_ENGINE", warnings: warnings, rationale: rationale.concat(["unable to lock inspection route confidently"]) };
}

/* ================================================================
   INLINED ENGINE — EVIDENCE + ENVIRONMENT
================================================================ */

function evidenceBoost(code: MaterialConditionCode, ev: Record<string, boolean>, route: InspectionEngineRoute): number {
  var b = 0;
  if (ev.pittingVisible && (code === "PITTING_CORROSION" || code === "LOCAL_METAL_LOSS")) b += 0.22;
  if (ev.widespreadWallLossVisible && (code === "UNIFORM_CORROSION" || code === "GENERAL_WALL_LOSS")) b += 0.20;
  if (ev.directionalWearVisible && (code === "EROSION" || code === "EROSION_CORROSION" || code === "ABRASION_DAMAGE")) b += 0.20;
  if (ev.crackingVisible && ["FATIGUE_CRACKING","STRESS_CORROSION_CRACKING","HYDROGEN_DAMAGE","THERMAL_CRACKING","BRITTLE_CRACKING","CRACKING_CIVIL"].includes(code)) b += 0.18;
  if (ev.dentVisible && code === "MECHANICAL_DENT") b += 0.22;
  if (ev.gougeVisible && code === "MECHANICAL_GOUGE") b += 0.22;
  if (ev.bulgingVisible && (code === "BULGING" || code === "DEFORMATION")) b += 0.20;
  if (ev.rustScaleVisible && (code === "UNIFORM_CORROSION" || code === "PITTING_CORROSION" || code === "UNDERFILM_CORROSION")) b += 0.16;
  if (ev.heatDiscolorationVisible && (code === "OVERHEAT_DAMAGE" || code === "HEAT_TINT_OXIDATION")) b += 0.18;
  if (ev.leakTraceVisible && code === "LEAK_PATH_INDICATION") b += 0.22;
  if (ev.deformationVisible && (code === "DEFORMATION" || code === "OVALITY" || code === "MISALIGNMENT_COMPONENT")) b += 0.18;
  if (ev.coatingPeelingVisible && (code === "COATING_FAILURE" || code === "COATING_DISBONDMENT" || code === "LINER_SEPARATION")) b += 0.22;
  if (ev.blisteringVisible && code === "BLISTERING") b += 0.24;
  if (ev.pinholesVisible && code === "PINHOLES") b += 0.24;
  if (ev.underfilmRustVisible && code === "UNDERFILM_CORROSION") b += 0.22;
  if (ev.crazingVisible && code === "ENVIRONMENTAL_STRESS_CRACKING") b += 0.20;
  if (ev.chalkingVisible && code === "UV_DEGRADATION") b += 0.18;
  if (ev.swellingVisible && (code === "SWELLING" || code === "CHEMICAL_ATTACK_POLYMER")) b += 0.22;
  if (ev.softeningVisible && (code === "SOFTENING" || code === "CHEMICAL_ATTACK_POLYMER")) b += 0.22;
  if (ev.embrittlementVisible && (code === "EMBRITTLEMENT" || code === "ENVIRONMENTAL_STRESS_CRACKING")) b += 0.18;
  if (ev.warpVisible && (code === "THERMAL_WARPING" || code === "CREEP_DEFORMATION")) b += 0.20;
  if (ev.fiberExposureVisible && code === "FIBER_BREAKAGE") b += 0.22;
  if (ev.delaminationVisible && code === "DELAMINATION") b += 0.24;
  if (ev.matrixCrackVisible && code === "MATRIX_CRACKING") b += 0.22;
  if (ev.impactZoneVisible && code === "IMPACT_DAMAGE") b += 0.24;
  if (ev.coreCrushVisible && code === "CORE_CRUSH") b += 0.24;
  if (ev.chippingVisible && code === "CHIPPING") b += 0.22;
  if (ev.spallingVisible && code === "SPALLING") b += 0.24;
  if (ev.shatteredOrBrittleCrackVisible && code === "BRITTLE_CRACKING") b += 0.24;
  if (ev.tearingVisible && code === "TEARING") b += 0.24;
  if (ev.compressionSetVisible && code === "COMPRESSION_SET") b += 0.24;
  if (ev.ozoneCrackPatternVisible && code === "OZONE_CRACKING") b += 0.24;
  if (ev.scalingVisible && code === "SURFACE_SCALING") b += 0.22;
  if (ev.mapCrackingVisible && code === "CRACKING_CIVIL") b += 0.22;
  if (ENGINE_PROFILES[route].dominantMechanisms.includes(code)) b += 0.05;
  return b;
}

function environmentBias(code: MaterialConditionCode, env: ServiceEnvironment): number {
  if (env === "MARINE" || env === "IMMERSION_SALT_WATER") {
    if (["UNIFORM_CORROSION","PITTING_CORROSION","CREVICE_CORROSION","GALVANIC_CORROSION","UNDERFILM_CORROSION"].includes(code)) return 0.12;
    if (["COATING_FAILURE","BLISTERING"].includes(code)) return 0.08;
  }
  if (env === "BURIED") {
    if (["GENERAL_WALL_LOSS","LOCAL_METAL_LOSS","PITTING_CORROSION","COATING_DISBONDMENT","UNDERFILM_CORROSION"].includes(code)) return 0.12;
  }
  if (env === "ABRASIVE_FLOW") {
    if (["EROSION","EROSION_CORROSION","ABRASION_DAMAGE","LOCAL_METAL_LOSS"].includes(code)) return 0.12;
  }
  if (env === "CYCLIC_PRESSURE") {
    if (["FATIGUE_CRACKING","DEFORMATION","BULGING","LEAK_PATH_INDICATION"].includes(code)) return 0.1;
  }
  if (env === "CHEMICAL_PROCESS") {
    if (["CHEMICAL_ATTACK_POLYMER","UNIFORM_CORROSION","PITTING_CORROSION","STRESS_CORROSION_CRACKING","BLISTERING"].includes(code)) return 0.12;
  }
  if (env === "HIGH_TEMPERATURE") {
    if (["THERMAL_CRACKING","OVERHEAT_DAMAGE","HEAT_TINT_OXIDATION","THERMAL_WARPING","HARDENING"].includes(code)) return 0.1;
  }
  if (env === "UV_EXPOSURE") {
    if (["UV_DEGRADATION","EMBRITTLEMENT","OZONE_CRACKING","COATING_FAILURE"].includes(code)) return 0.12;
  }
  return 0;
}

/* ================================================================
   INLINED ENGINE — MAIN
================================================================ */

function runEngine(input: UniversalInspectionInput): UniversalInspectionOutput {
  var routeDecision = determineRoute(input);
  var route = routeDecision.route;
  var profile = ENGINE_PROFILES[route];
  var env = normalizeSE(input.serviceEnvironment);
  var warnings = routeDecision.warnings.slice();
  var ev = input.evidence || {};

  var candidates = (input.candidateConditions && input.candidateConditions.length > 0)
    ? input.candidateConditions
    : profile.dominantMechanisms.map(function(code) { return { code: code, baseScore: 0.35 }; });

  var adjustedConditions: AdjustedCondition[] = candidates.map(function(candidate) {
    var score = candidate.baseScore;
    var notes: string[] = [];
    var eB = evidenceBoost(candidate.code, ev, route);
    if (eB > 0) { score += eB; notes.push("evidence boost +" + eB.toFixed(2)); }
    var envB = environmentBias(candidate.code, env);
    if (envB > 0) { score += envB; notes.push("environment bias +" + envB.toFixed(2) + " (" + env + ")"); }
    if (route === "UNKNOWN_ENGINE") { score -= profile.authorityPenaltyIfUnknown; notes.push("unknown-route penalty -" + profile.authorityPenaltyIfUnknown.toFixed(2)); }
    score = clamp01(score);
    return { code: candidate.code, originalScore: candidate.baseScore, adjustedScore: score, notes: notes };
  });

  adjustedConditions.sort(function(a, b) { return b.adjustedScore - a.adjustedScore; });

  var top = adjustedConditions[0] || null;
  var second = adjustedConditions[1] || null;
  var gap = top && second ? top.adjustedScore - second.adjustedScore : (top ? top.adjustedScore : 0);
  var primaryLocked = false;
  var confidenceBand: "LOW" | "MODERATE" | "HIGH" = "LOW";

  if (top) {
    if (top.adjustedScore >= 0.75 && gap >= 0.08 && route !== "UNKNOWN_ENGINE") { primaryLocked = true; confidenceBand = "HIGH"; }
    else if (top.adjustedScore >= 0.62 && gap >= 0.05) { primaryLocked = true; confidenceBand = "MODERATE"; }
  }
  if (!primaryLocked) { warnings.push("primary condition not sufficiently locked"); }

  return {
    routeDecision: routeDecision, profile: profile,
    adjustedConditions: adjustedConditions,
    probableCauses: profile.likelyCauses, recommendedMethods: profile.recommendedMethods,
    teachingFocus: profile.teachingFocus, warnings: warnings,
    primaryCondition: primaryLocked && top ? top.code : null,
    primaryLocked: primaryLocked, confidenceBand: confidenceBand
  };
}

/* ================================================================
   NETLIFY HANDLER
================================================================ */

function headers() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };
}

var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: headers(), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: headers(), body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var caseId = body.caseId;
    if (!caseId) {
      return { statusCode: 400, headers: headers(), body: JSON.stringify({ error: "caseId is required" }) };
    }

    var sb = createClient(supabaseUrl, supabaseKey);

    var caseRes = await sb.from("inspection_cases").select("id, inspection_context, material_class, material_family, surface_type, service_environment").eq("id", caseId).single();
    if (caseRes.error || !caseRes.data) {
      return { statusCode: 404, headers: headers(), body: JSON.stringify({ error: "Case not found", detail: caseRes.error }) };
    }

    var caseData = caseRes.data;
    var engineInput: UniversalInspectionInput = {
      inspectionContext: caseData.inspection_context || null,
      materialClass: caseData.material_class || null,
      materialFamily: caseData.material_family || null,
      surfaceType: caseData.surface_type || null,
      serviceEnvironment: caseData.service_environment || null,
      weldingMethod: null,
      evidence: body.evidence || {},
      candidateConditions: body.candidateConditions || null
    };

    var result = runEngine(engineInput);

    var runRow = {
      case_id: caseId,
      inspection_context: result.routeDecision.context,
      material_class: result.routeDecision.materialClass,
      material_family: caseData.material_family || null,
      surface_type: caseData.surface_type || null,
      service_environment: caseData.service_environment || null,
      route_code: result.routeDecision.route,
      route_decision_json: result.routeDecision,
      adjusted_conditions_json: result.adjustedConditions,
      primary_condition: result.primaryCondition,
      primary_locked: result.primaryLocked,
      confidence_band: result.confidenceBand,
      warnings_json: result.warnings
    };

    var insertRes = await sb.from("universal_route_runs").insert([runRow]).select("id").single();
    if (insertRes.error) { console.log("WARNING: insert universal_route_runs failed: " + JSON.stringify(insertRes.error)); }

    var updateRes = await sb.from("inspection_cases").update({ universal_route_code: result.routeDecision.route }).eq("id", caseId);
    if (updateRes.error) { console.log("WARNING: update case route failed: " + JSON.stringify(updateRes.error)); }

    return {
      statusCode: 200,
      headers: headers(),
      body: JSON.stringify({
        success: true, caseId: caseId,
        routeDecision: result.routeDecision,
        profile: { route: result.profile.route, recommendedMethods: result.profile.recommendedMethods, teachingFocus: result.profile.teachingFocus, likelyCauses: result.profile.likelyCauses },
        adjustedConditions: result.adjustedConditions.slice(0, 10),
        primaryCondition: result.primaryCondition, primaryLocked: result.primaryLocked,
        confidenceBand: result.confidenceBand, warnings: result.warnings
      })
    };

  } catch (err: any) {
    console.log("run-universal-route error: " + String(err));
    return { statusCode: 500, headers: headers(), body: JSON.stringify({ error: "Internal error", detail: String(err) }) };
  }
};

export { handler };
