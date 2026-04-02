/**
 * DEPLOY44 — create-case.ts
 * netlify/functions/create-case.ts
 *
 * Adds: lifecycle_stage, industry_sector, asset_type columns.
 * Built from schema CSV + CHECK constraints.
 *
 * CONSTRAINT: No backtick template literals (Git Bash paste corruption)
 */
import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function headers() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };
}

/* ---- Map materialFamily to allowed material_class CHECK values ---- */
var ALLOWED_MATERIAL_CLASS = [
  "carbon_steel", "low_alloy_steel", "stainless_steel", "duplex_stainless",
  "aluminum", "nickel_alloy", "titanium", "copper_alloy", "cast_iron",
  "composite", "other", "unknown"
];

function mapMaterialClass(materialClassFromForm: string, materialFamilyFromForm: string): string {
  var familyLower = (materialFamilyFromForm || "").toLowerCase();
  if (ALLOWED_MATERIAL_CLASS.indexOf(familyLower) !== -1) return familyLower;
  var classUpper = (materialClassFromForm || "").toUpperCase();
  if (classUpper === "COMPOSITE") return "composite";
  if (classUpper === "METALLIC") return "unknown";
  if (classUpper === "POLYMER") return "other";
  if (classUpper === "CERAMIC_GLASS") return "other";
  if (classUpper === "ELASTOMER") return "other";
  if (classUpper === "CIVIL_MINERAL") return "other";
  if (classUpper === "COATING_LINER") return "other";
  return "unknown";
}

/* ---- 4D dimension defaults based on NDT method ---- */
function get4DDefaults(method: string) {
  var m = (method || "").toUpperCase();
  if (m === "VT") return { energy: "photon", interaction: "reflection", response: "visual_pattern", time: "snapshot" };
  if (m === "PT") return { energy: "chemical", interaction: "capillary", response: "bleed_out_pattern", time: "delayed" };
  if (m === "MT") return { energy: "magnetic_field", interaction: "flux_leakage", response: "particle_pattern", time: "snapshot" };
  if (m === "UT") return { energy: "acoustic_wave", interaction: "reflection", response: "echo_signal", time: "real_time" };
  if (m === "RT") return { energy: "ionizing_radiation", interaction: "transmission", response: "density_image", time: "snapshot" };
  if (m === "ET") return { energy: "electromagnetic_field", interaction: "eddy_current", response: "impedance_signal", time: "real_time" };
  return { energy: "unknown", interaction: "unknown", response: "unknown", time: "unknown" };
}

var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: headers(), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: headers(), body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    var authHeader = (event.headers["authorization"] || event.headers["Authorization"] || "");
    var token = authHeader.replace("Bearer ", "");
    if (!token) {
      return { statusCode: 401, headers: headers(), body: JSON.stringify({ error: "Missing auth token" }) };
    }

    var sb = createClient(supabaseUrl, supabaseKey);

    var userRes = await sb.auth.getUser(token);
    if (userRes.error || !userRes.data.user) {
      return { statusCode: 401, headers: headers(), body: JSON.stringify({ error: "Invalid auth token" }) };
    }
    var userId = userRes.data.user.id;

    var profileRes = await sb.from("profiles").select("org_id").eq("id", userId).single();
    var orgId = (profileRes.data && profileRes.data.org_id) ? profileRes.data.org_id : null;
    if (!orgId) {
      return { statusCode: 400, headers: headers(), body: JSON.stringify({ error: "No org_id found for user profile" }) };
    }

    var body = JSON.parse(event.body || "{}");

    var method = (body.method || "").trim();
    var componentName = (body.component || "").trim();
    var codeFamily = (body.code || "").trim() || null;

    var inspectionContext = (body.inspectionContext || "").trim() || null;
    var materialClassFromForm = (body.materialClass || "").trim() || "";
    var materialFamilyFromForm = (body.materialFamily || "").trim() || "";
    var surfaceType = (body.surfaceType || "").trim() || null;
    var serviceEnvironment = (body.serviceEnvironment || "").trim() || null;

    /* Code applicability router fields */
    var lifecycleStage = (body.lifecycleStage || "").trim() || null;
    var industrySector = (body.industrySector || "").trim() || null;
    var assetType = (body.assetType || "").trim() || null;

    var processContext = body.processContext || null;

    if (!method) {
      return { statusCode: 400, headers: headers(), body: JSON.stringify({ error: "method is required" }) };
    }
    if (!componentName) {
      return { statusCode: 400, headers: headers(), body: JSON.stringify({ error: "component is required" }) };
    }

    var caseNumber = "NDT-" + Date.now();
    var title = method + " - " + componentName;
    var fourD = get4DDefaults(method);
    var dbMaterialClass = mapMaterialClass(materialClassFromForm, materialFamilyFromForm);

    var caseRow: Record<string, any> = {
      org_id: orgId,
      case_number: caseNumber,
      title: title,
      method: method,
      created_by: userId,
      energy_type: fourD.energy,
      interaction_type: fourD.interaction,
      response_type: fourD.response,
      time_dimension_type: fourD.time,
      status: "draft",
      load_condition: "unknown",
      material_class: dbMaterialClass,
      component_name: componentName,
      code_family: codeFamily,
      inspection_context: inspectionContext,
      material_family: materialFamilyFromForm || null,
      surface_type: surfaceType,
      service_environment: serviceEnvironment,
      lifecycle_stage: lifecycleStage,
      industry_sector: industrySector,
      asset_type: assetType
    };

    var insertRes = await sb.from("inspection_cases").insert([caseRow]).select("id").single();

    if (insertRes.error) {
      console.log("create-case insert error: " + JSON.stringify(insertRes.error));
      return {
        statusCode: 500,
        headers: headers(),
        body: JSON.stringify({ error: "Failed to create case", detail: insertRes.error.message || insertRes.error })
      };
    }

    var caseId = insertRes.data.id;

    if (processContext && inspectionContext === "WELD") {
      var physRow = { case_id: caseId, process_context_json: processContext, created_at: new Date().toISOString() };
      var physRes = await sb.from("physics_reality_models").insert([physRow]);
      if (physRes.error) { console.log("WARNING: physics_reality_models insert failed: " + JSON.stringify(physRes.error)); }
    }

    return {
      statusCode: 200,
      headers: headers(),
      body: JSON.stringify({
        success: true,
        caseId: caseId,
        caseNumber: caseNumber,
        inspectionContext: inspectionContext,
        materialClass: dbMaterialClass,
        lifecycleStage: lifecycleStage,
        industrySector: industrySector,
        assetType: assetType
      })
    };

  } catch (err: any) {
    console.log("create-case error: " + String(err));
    return { statusCode: 500, headers: headers(), body: JSON.stringify({ error: "Internal error", detail: String(err) }) };
  }
};

export { handler };
