/**
 * DEPLOY41 — run-code-applicability.ts
 * netlify/functions/run-code-applicability.ts
 *
 * Code + Standard Applicability Router — INLINED (no lib imports)
 * Routes by asset type, inspection context, lifecycle stage, material class, industry
 * to determine governing code families before acceptance criteria apply.
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

interface StandardReference {
  family: string;
  standardName: string;
  shortLabel: string;
  applicabilityReason: string;
  priority: number;
  category: string;
}

interface ApplicabilityDecision {
  allowedHardDisposition: boolean;
  authorityLevel: string;
  routingConfidence: string;
  primaryStandards: StandardReference[];
  secondaryStandards: StandardReference[];
  warnings: string[];
  rationale: string[];
}

interface CodeApplicabilityInput {
  inspectionContext?: string | null;
  lifecycleStage?: string | null;
  industrySector?: string | null;
  assetType?: string | null;
  materialClass?: string | null;
  userSpecifiedCode?: string | null;
  ownerSpecProvided?: boolean | null;
  ndtMethodKnown?: boolean | null;
  weldingProcedureKnown?: boolean | null;
  inServiceAsset?: boolean | null;
  educationalMode?: boolean | null;
}

/* ================================================================
   INLINED ENGINE — NORMALIZERS
================================================================ */

function normLS(input?: string | null): string {
  var v = (input || "").trim().toUpperCase();
  var allowed = ["FABRICATION","NEW_CONSTRUCTION_ACCEPTANCE","IN_SERVICE","REPAIR_OR_ALTERATION","FITNESS_FOR_SERVICE","FAILURE_ANALYSIS","EDUCATIONAL_TRAINING","UNKNOWN"];
  return allowed.indexOf(v) !== -1 ? v : "UNKNOWN";
}

function normIS(input?: string | null): string {
  var v = (input || "").trim().toUpperCase();
  var allowed = ["STRUCTURAL_STEEL","PIPELINE","PROCESS_PIPING","PRESSURE_VESSEL","STORAGE_TANK","POWER_GENERATION","SHIPBUILDING_MARINE","AEROSPACE","AUTOMOTIVE","GENERAL_MANUFACTURING","COMMERCIAL_DIVING_MARINE","CIVIL_INFRASTRUCTURE","PLASTICS_PROCESSING","COMPOSITES_MANUFACTURING","UNKNOWN"];
  return allowed.indexOf(v) !== -1 ? v : "UNKNOWN";
}

function normAT(input?: string | null): string {
  var v = (input || "").trim().toUpperCase();
  var allowed = ["WELDMENT","PIPE","PIPING_SYSTEM","PRESSURE_VESSEL","STORAGE_TANK","STRUCTURAL_MEMBER","PLATE","TUBE","NOZZLE","FLANGE","VALVE","CASTING","FORGING","COMPOSITE_PANEL","FRP_TANK","PLASTIC_PIPE","COATING","LINER","CIVIL_CONCRETE_MEMBER","GENERAL_COMPONENT","UNKNOWN"];
  return allowed.indexOf(v) !== -1 ? v : "UNKNOWN";
}

function normIC(input?: string | null): string {
  var v = (input || "").trim().toUpperCase();
  var allowed = ["WELD","BASE_MATERIAL","HAZ","COMPONENT","COATING","UNKNOWN"];
  return allowed.indexOf(v) !== -1 ? v : "UNKNOWN";
}

function normMC(input?: string | null): string {
  var v = (input || "").trim().toUpperCase();
  var allowed = ["METALLIC","POLYMER","COMPOSITE","CERAMIC_GLASS","ELASTOMER","CIVIL_MINERAL","COATING_LINER","UNKNOWN"];
  return allowed.indexOf(v) !== -1 ? v : "UNKNOWN";
}

/* ================================================================
   INLINED ENGINE — HELPERS
================================================================ */

function mkStd(family: string, standardName: string, shortLabel: string, reason: string, priority: number, category: string): StandardReference {
  return { family: family, standardName: standardName, shortLabel: shortLabel, applicabilityReason: reason, priority: priority, category: category };
}

function sortStds(items: StandardReference[]): StandardReference[] {
  return items.slice().sort(function(a, b) { return a.priority - b.priority || a.standardName.localeCompare(b.standardName); });
}

function dedupeStds(items: StandardReference[]): StandardReference[] {
  var seen: Record<string, boolean> = {};
  var out: StandardReference[] = [];
  for (var i = 0; i < items.length; i++) {
    var key = items[i].family + "|" + items[i].standardName + "|" + items[i].category;
    if (!seen[key]) { seen[key] = true; out.push(items[i]); }
  }
  return out;
}

function finalize(args: { primary: StandardReference[]; secondary: StandardReference[]; warnings: string[]; rationale: string[]; hard: boolean; authority: string; confidence: string; }): ApplicabilityDecision {
  return {
    allowedHardDisposition: args.hard,
    authorityLevel: args.authority,
    routingConfidence: args.confidence,
    primaryStandards: sortStds(dedupeStds(args.primary)),
    secondaryStandards: sortStds(dedupeStds(args.secondary)),
    warnings: args.warnings.filter(function(v, i, a) { return a.indexOf(v) === i; }),
    rationale: args.rationale.filter(function(v, i, a) { return a.indexOf(v) === i; })
  };
}

/* ================================================================
   INLINED ENGINE — MAIN ROUTER
================================================================ */

function routeCodeApplicability(input: CodeApplicabilityInput): ApplicabilityDecision {
  var ic = normIC(input.inspectionContext);
  var ls = normLS(input.lifecycleStage);
  var is_ = normIS(input.industrySector);
  var at = normAT(input.assetType);
  var mc = normMC(input.materialClass);

  var w: string[] = [];
  var r: string[] = [];
  var ps: StandardReference[] = [];
  var ss: StandardReference[] = [];

  var edu = Boolean(input.educationalMode) || ls === "EDUCATIONAL_TRAINING";
  var ownerSpec = Boolean(input.ownerSpecProvided);
  var inService = Boolean(input.inServiceAsset) || ls === "IN_SERVICE";
  var userCode = (input.userSpecifiedCode || "").trim();
  var isFab = ls === "FABRICATION" || ls === "NEW_CONSTRUCTION_ACCEPTANCE";
  var isRepair = ls === "REPAIR_OR_ALTERATION";

  /* Educational */
  if (edu) {
    r.push("educational/training mode selected");
    ps.push(mkStd("TRAINING_ONLY", "Educational / training logic only", "Training Mode", "Training mode should not claim regulatory acceptance authority", 1, "TRAINING"));
    ps.push(mkStd("AWS_EDUCATIONAL", "AWS educational welding guidance", "AWS Educational", "Useful for teaching-oriented welding flows", 2, "TRAINING"));
    ps.push(mkStd("ASNT_METHOD_PRACTICE", "ASNT personnel / NDT practice guidance", "ASNT Practice", "Useful as educational method context", 3, "TRAINING"));
    if (ownerSpec) ss.push(mkStd("OEM_OWNER_SPEC", "Owner / school / internal spec", "Owner Spec", "User provided local instructional requirements", 1, "OWNER_SPEC"));
    return finalize({ primary: ps, secondary: ss, warnings: w, rationale: r, hard: false, authority: "LOW", confidence: "HIGH" });
  }

  if (userCode) {
    r.push("user specified code: " + userCode);
    ss.push(mkStd("OEM_OWNER_SPEC", userCode, "User-Specified Code", "User-specified code should override generic assumptions after validation", 1, "OWNER_SPEC"));
    w.push("User-specified code provided; generic routing is provisional until validated.");
  }

  /* Structural steel */
  if (is_ === "STRUCTURAL_STEEL" || at === "STRUCTURAL_MEMBER" || (ic === "WELD" && at === "WELDMENT" && is_ === "UNKNOWN")) {
    r.push("structural steel / weldment logic matched");
    ps.push(mkStd("AWS_STRUCTURAL", "AWS D1.1 Structural Welding Code-Steel", "AWS D1.1", "Common governing structural steel welding code", 1, "GOVERNING_CONSTRUCTION_CODE"));
    ps.push(mkStd("ASNT_METHOD_PRACTICE", "ASNT recommended practice", "ASNT Practice", "NDT personnel and practice context", 3, "NDT_METHOD"));
    ps.push(mkStd("ASTM_METHOD_STANDARD", "Applicable ASTM test methods", "ASTM Methods", "Method-specific testing standards", 4, "NDT_METHOD"));
    if (isFab) {
      r.push("fabrication / new construction structural stage");
      ss.push(mkStd("ASME_BPVC_SECTION_V", "ASME Section V NDE", "ASME Sec V", "Method execution standards may inform NDT practice", 2, "NDT_METHOD"));
    } else if (inService) {
      w.push("Structural asset in-service. Construction code alone is not enough for condition/disposition logic.");
      ss.push(mkStd("OEM_OWNER_SPEC", "Owner / engineer of record procedure", "Owner/EOR Spec", "In-service structural evaluation depends on owner/engineer requirements", 2, "OWNER_SPEC"));
    }
    return finalize({ primary: ps, secondary: ss, warnings: w, rationale: r, hard: isFab, authority: isFab ? "HIGH" : "MODERATE", confidence: "HIGH" });
  }

  /* Pipeline */
  if (is_ === "PIPELINE") {
    r.push("pipeline sector matched");
    if (ic === "WELD" && (isFab || isRepair)) {
      ps.push(mkStd("API_PIPELINE", "API 1104 Welding of Pipelines", "API 1104", "Primary pipeline welding code", 1, "GOVERNING_CONSTRUCTION_CODE"));
      ps.push(mkStd("ASME_BPVC_SECTION_V", "ASME Section V NDE", "ASME Sec V", "Method execution framework", 3, "NDT_METHOD"));
      ps.push(mkStd("ASNT_METHOD_PRACTICE", "ASNT recommended practice", "ASNT Practice", "Personnel qualification context", 4, "NDT_METHOD"));
      return finalize({ primary: ps, secondary: ss, warnings: w, rationale: r, hard: true, authority: "HIGH", confidence: "HIGH" });
    }
    if (inService || ls === "FITNESS_FOR_SERVICE") {
      ps.push(mkStd("API_FITNESS_FOR_SERVICE", "API 579 Fitness-For-Service", "API 579", "FFS evaluation for in-service flaws", 1, "FITNESS_FOR_SERVICE"));
      ps.push(mkStd("OEM_OWNER_SPEC", "Pipeline operator integrity management", "Owner Integrity Spec", "Operator procedures and regulations", 2, "OWNER_SPEC"));
      w.push("Pipeline in-service requires operator/regulatory integrity framework.");
      return finalize({ primary: ps, secondary: ss, warnings: w, rationale: r, hard: false, authority: "MODERATE", confidence: "MODERATE" });
    }
  }

  /* Process piping */
  if (is_ === "PROCESS_PIPING" || at === "PIPING_SYSTEM") {
    r.push("process piping logic matched");
    if (isFab || isRepair) {
      ps.push(mkStd("ASME_B31_3", "ASME B31.3 Process Piping", "ASME B31.3", "Primary process piping code", 1, "GOVERNING_CONSTRUCTION_CODE"));
      ps.push(mkStd("ASME_BPVC_SECTION_V", "ASME Section V NDE", "ASME Sec V", "NDT method execution framework", 2, "NDT_METHOD"));
      ps.push(mkStd("ASME_BPVC_SECTION_IX", "ASME Section IX Welding Qualifications", "ASME Sec IX", "Welding qualification framework", 3, "WELDING_QUALIFICATION"));
      return finalize({ primary: ps, secondary: ss, warnings: w, rationale: r, hard: true, authority: "HIGH", confidence: "HIGH" });
    }
    if (inService) {
      ps.push(mkStd("API_IN_SERVICE_PIPING", "API 570 Piping Inspection Code", "API 570", "Primary in-service piping code", 1, "IN_SERVICE_CODE"));
      ps.push(mkStd("API_FITNESS_FOR_SERVICE", "API 579 Fitness-For-Service", "API 579", "Flaw significance / remaining strength", 2, "FITNESS_FOR_SERVICE"));
      return finalize({ primary: ps, secondary: ss, warnings: w, rationale: r, hard: false, authority: "HIGH", confidence: "HIGH" });
    }
  }

  /* Pressure vessels */
  if (is_ === "PRESSURE_VESSEL" || at === "PRESSURE_VESSEL") {
    r.push("pressure vessel logic matched");
    if (isFab || isRepair) {
      ps.push(mkStd("ASME_BPVC_SECTION_VIII", "ASME Section VIII Pressure Vessels", "ASME Sec VIII", "Primary pressure vessel construction code", 1, "GOVERNING_CONSTRUCTION_CODE"));
      ps.push(mkStd("ASME_BPVC_SECTION_V", "ASME Section V NDE", "ASME Sec V", "NDT method framework", 2, "NDT_METHOD"));
      ps.push(mkStd("ASME_BPVC_SECTION_IX", "ASME Section IX Welding Qualifications", "ASME Sec IX", "Qualification framework", 3, "WELDING_QUALIFICATION"));
      return finalize({ primary: ps, secondary: ss, warnings: w, rationale: r, hard: true, authority: "HIGH", confidence: "HIGH" });
    }
    if (inService || ls === "FITNESS_FOR_SERVICE") {
      ps.push(mkStd("API_IN_SERVICE_VESSEL", "API 510 Pressure Vessel Inspection", "API 510", "Primary in-service vessel code", 1, "IN_SERVICE_CODE"));
      ps.push(mkStd("API_FITNESS_FOR_SERVICE", "API 579 Fitness-For-Service", "API 579", "Flaw significance / remaining life", 2, "FITNESS_FOR_SERVICE"));
      return finalize({ primary: ps, secondary: ss, warnings: w, rationale: r, hard: false, authority: "HIGH", confidence: "HIGH" });
    }
  }

  /* Storage tanks */
  if (is_ === "STORAGE_TANK" || at === "STORAGE_TANK") {
    r.push("storage tank logic matched");
    if (inService || ls === "IN_SERVICE" || ls === "FITNESS_FOR_SERVICE") {
      ps.push(mkStd("API_IN_SERVICE_TANK", "API 653 Tank Inspection", "API 653", "Primary in-service tank code", 1, "IN_SERVICE_CODE"));
      ps.push(mkStd("API_FITNESS_FOR_SERVICE", "API 579 Fitness-For-Service", "API 579", "Detailed flaw evaluation", 2, "FITNESS_FOR_SERVICE"));
      return finalize({ primary: ps, secondary: ss, warnings: w, rationale: r, hard: false, authority: "HIGH", confidence: "HIGH" });
    }
    if (isFab) {
      w.push("Tank fabrication routing may require a construction code not encoded in this router.");
      ps.push(mkStd("OEM_OWNER_SPEC", "Owner / project tank construction spec", "Tank Construction Spec", "Construction code should be explicitly selected", 1, "OWNER_SPEC"));
      return finalize({ primary: ps, secondary: ss, warnings: w, rationale: r, hard: false, authority: "MODERATE", confidence: "MODERATE" });
    }
  }

  /* Coatings / liners */
  if (ic === "COATING" || at === "COATING" || at === "LINER" || mc === "COATING_LINER") {
    r.push("coating / liner logic matched");
    ps.push(mkStd("AMPP_COATING_LINING", "AMPP coating-lining standards", "AMPP Coatings", "Primary coating/lining inspection family", 1, "COATING_LINING"));
    ps.push(mkStd("ASTM_METHOD_STANDARD", "ASTM coating test methods", "ASTM Coating Methods", "Method-specific testing standards", 2, "NDT_METHOD"));
    if (!ownerSpec) w.push("Coating acceptance depends heavily on owner/manufacturer specification.");
    return finalize({ primary: ps, secondary: ss, warnings: w, rationale: r, hard: ownerSpec, authority: ownerSpec ? "HIGH" : "MODERATE", confidence: ownerSpec ? "HIGH" : "MODERATE" });
  }

  /* Civil / concrete */
  if (is_ === "CIVIL_INFRASTRUCTURE" || at === "CIVIL_CONCRETE_MEMBER" || mc === "CIVIL_MINERAL") {
    r.push("civil / concrete logic matched");
    ps.push(mkStd("ACI_CIVIL_CONCRETE", "ACI concrete evaluation standards", "ACI", "Primary concrete-related logic", 1, "CIVIL"));
    ps.push(mkStd("ASCE_STRUCTURAL_CIVIL", "ASCE structural / civil evaluation", "ASCE", "Structural evaluation context", 2, "CIVIL"));
    w.push("Civil acceptance depends on project-specific design basis and engineer-of-record.");
    return finalize({ primary: ps, secondary: ss, warnings: w, rationale: r, hard: false, authority: "MODERATE", confidence: "MODERATE" });
  }

  /* Nonmetallic */
  if (mc === "POLYMER" || mc === "COMPOSITE" || at === "PLASTIC_PIPE" || at === "FRP_TANK" || at === "COMPOSITE_PANEL") {
    r.push("nonmetallic material logic matched");
    ps.push(mkStd("ASTM_METHOD_STANDARD", "ASTM material / test method standards", "ASTM Methods", "Nonmetallic evaluation is material-specific", 1, "NDT_METHOD"));
    ps.push(mkStd("OEM_OWNER_SPEC", "Owner / OEM specification", "OEM/Owner Spec", "Nonmetallic acceptance is product-specific", 2, "OWNER_SPEC"));
    w.push("Nonmetallic assets require explicit governing standard selection.");
    var hasSpec = ownerSpec || Boolean(userCode);
    return finalize({ primary: ps, secondary: ss, warnings: w, rationale: r, hard: hasSpec, authority: hasSpec ? "MODERATE" : "LOW", confidence: hasSpec ? "MODERATE" : "LOW" });
  }

  /* Power generation */
  if (is_ === "POWER_GENERATION") {
    r.push("power generation logic matched");
    ps.push(mkStd("ASME_B31_1", "ASME B31.1 Power Piping", "ASME B31.1", "Primary power piping code", 1, "GOVERNING_CONSTRUCTION_CODE"));
    ps.push(mkStd("ASME_BPVC_SECTION_V", "ASME Section V NDE", "ASME Sec V", "NDT method framework", 2, "NDT_METHOD"));
    if (inService) {
      w.push("In-service power assets may require owner/regulatory programs.");
      ss.push(mkStd("OEM_OWNER_SPEC", "Owner / utility integrity program", "Owner Integrity Program", "Owner/regulatory procedures", 1, "OWNER_SPEC"));
    }
    return finalize({ primary: ps, secondary: ss, warnings: w, rationale: r, hard: !inService, authority: inService ? "MODERATE" : "HIGH", confidence: "MODERATE" });
  }

  /* OEM / manufacturing sectors */
  if (is_ === "AEROSPACE" || is_ === "AUTOMOTIVE" || is_ === "GENERAL_MANUFACTURING" || is_ === "SHIPBUILDING_MARINE" || is_ === "COMMERCIAL_DIVING_MARINE") {
    r.push("OEM / manufacturing sector logic matched");
    ps.push(mkStd("OEM_OWNER_SPEC", "OEM / owner / contract specification", "OEM/Owner Spec", "Primary governing document is contract-specific", 1, "OWNER_SPEC"));
    ps.push(mkStd("ASTM_METHOD_STANDARD", "ASTM test method standards", "ASTM Methods", "Method execution standards", 2, "NDT_METHOD"));
    w.push("Manufacturing-sector acceptance is often contract/OEM-specific.");
    var hasSpec2 = ownerSpec || Boolean(userCode);
    return finalize({ primary: ps, secondary: ss, warnings: w, rationale: r, hard: hasSpec2, authority: hasSpec2 ? "MODERATE" : "LOW", confidence: "MODERATE" });
  }

  /* Fallback */
  r.push("no strong code family match found");
  w.push("Unable to identify a confident governing code family.");
  w.push("Hard disposition should be blocked until governing standard is locked.");
  ps.push(mkStd("UNKNOWN", "Unknown governing standard", "Unknown Standard", "Insufficient information to route confidently", 1, "GENERAL"));
  ps.push(mkStd("OEM_OWNER_SPEC", "Owner / project specification", "Owner Spec", "Project-specific requirements may control", 2, "OWNER_SPEC"));
  return finalize({ primary: ps, secondary: ss, warnings: w, rationale: r, hard: false, authority: "LOW", confidence: "LOW" });
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

    /* Read case context */
    var caseRes = await sb.from("inspection_cases").select("id, inspection_context, material_class, lifecycle_stage, industry_sector, asset_type, code_family").eq("id", caseId).single();
    if (caseRes.error || !caseRes.data) {
      return { statusCode: 404, headers: headers(), body: JSON.stringify({ error: "Case not found", detail: caseRes.error }) };
    }

    var cd = caseRes.data;

    /* Build input */
    var engineInput: CodeApplicabilityInput = {
      inspectionContext: cd.inspection_context || null,
      lifecycleStage: cd.lifecycle_stage || body.lifecycleStage || null,
      industrySector: cd.industry_sector || body.industrySector || null,
      assetType: cd.asset_type || body.assetType || null,
      materialClass: cd.material_class || null,
      userSpecifiedCode: cd.code_family || body.userSpecifiedCode || null,
      ownerSpecProvided: body.ownerSpecProvided || false,
      ndtMethodKnown: body.ndtMethodKnown || true,
      weldingProcedureKnown: body.weldingProcedureKnown || false,
      inServiceAsset: body.inServiceAsset || false,
      educationalMode: body.educationalMode || false
    };

    /* Run engine */
    var result = routeCodeApplicability(engineInput);

    /* Store run */
    var runRow = {
      case_id: caseId,
      inspection_context: cd.inspection_context || null,
      lifecycle_stage: engineInput.lifecycleStage,
      industry_sector: engineInput.industrySector,
      asset_type: engineInput.assetType,
      material_class: cd.material_class || null,
      user_specified_code: engineInput.userSpecifiedCode || null,
      owner_spec_provided: engineInput.ownerSpecProvided || false,
      ndt_method_known: engineInput.ndtMethodKnown || false,
      welding_procedure_known: engineInput.weldingProcedureKnown || false,
      in_service_asset: engineInput.inServiceAsset || false,
      educational_mode: engineInput.educationalMode || false,
      decision_json: result
    };

    var insertRes = await sb.from("inspection_code_applicability_runs").insert([runRow]).select("id").single();
    if (insertRes.error) { console.log("WARNING: insert code_applicability_runs failed: " + JSON.stringify(insertRes.error)); }

    /* Update case */
    var updateRes = await sb.from("inspection_cases").update({
      code_authority_level: result.authorityLevel,
      code_routing_confidence: result.routingConfidence,
      hard_disposition_allowed: result.allowedHardDisposition
    }).eq("id", caseId);
    if (updateRes.error) { console.log("WARNING: update case code fields failed: " + JSON.stringify(updateRes.error)); }

    /* Return */
    return {
      statusCode: 200,
      headers: headers(),
      body: JSON.stringify({
        success: true,
        caseId: caseId,
        authorityLevel: result.authorityLevel,
        routingConfidence: result.routingConfidence,
        allowedHardDisposition: result.allowedHardDisposition,
        primaryStandards: result.primaryStandards,
        secondaryStandards: result.secondaryStandards,
        warnings: result.warnings,
        rationale: result.rationale
      })
    };

  } catch (err: any) {
    console.log("run-code-applicability error: " + String(err));
    return { statusCode: 500, headers: headers(), body: JSON.stringify({ error: "Internal error", detail: String(err) }) };
  }
};

export { handler };
