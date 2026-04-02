/**
 * DEPLOY38 FINAL — create-case.ts
 * netlify/functions/create-case.ts
 *
 * Built from actual inspection_cases schema (59 columns).
 * All NOT NULL columns without defaults are explicitly provided.
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
    return {
      statusCode: 405,
      headers: headers(),
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    /* ---- Auth ---- */
    var authHeader = (event.headers["authorization"] || event.headers["Authorization"] || "");
    var token = authHeader.replace("Bearer ", "");

    if (!token) {
      return {
        statusCode: 401,
        headers: headers(),
        body: JSON.stringify({ error: "Missing auth token" })
      };
    }

    var sb = createClient(supabaseUrl, supabaseKey);

    var userRes = await sb.auth.getUser(token);
    if (userRes.error || !userRes.data.user) {
      return {
        statusCode: 401,
        headers: headers(),
        body: JSON.stringify({ error: "Invalid auth token" })
      };
    }

    var userId = userRes.data.user.id;

    /* ---- Get org_id from profiles ---- */
    var profileRes = await sb
      .from("profiles")
      .select("org_id")
      .eq("id", userId)
      .single();

    var orgId = (profileRes.data && profileRes.data.org_id) ? profileRes.data.org_id : null;

    if (!orgId) {
      return {
        statusCode: 400,
        headers: headers(),
        body: JSON.stringify({ error: "No org_id found for user profile" })
      };
    }

    /* ---- Parse body ---- */
    var body = JSON.parse(event.body || "{}");

    var method = (body.method || "").trim();
    var componentName = (body.component || "").trim();
    var codeFamily = (body.code || "").trim() || null;

    /* Universal context fields */
    var inspectionContext = (body.inspectionContext || "").trim() || null;
    var materialClass = (body.materialClass || "").trim() || "unknown";
    var materialFamily = (body.materialFamily || "").trim() || null;
    var surfaceType = (body.surfaceType || "").trim() || null;
    var serviceEnvironment = (body.serviceEnvironment || "").trim() || null;

    /* Process context (weld only) */
    var processContext = body.processContext || null;

    if (!method) {
      return {
        statusCode: 400,
        headers: headers(),
        body: JSON.stringify({ error: "method is required" })
      };
    }

    if (!componentName) {
      return {
        statusCode: 400,
        headers: headers(),
        body: JSON.stringify({ error: "component is required" })
      };
    }

    /* ---- Generate case number, title, 4D defaults ---- */
    var caseNumber = "NDT-" + Date.now();
    var title = method + " - " + componentName;
    var fourD = get4DDefaults(method);

    /* ---- Build row matching ALL not-null columns ---- */
    var caseRow: Record<string, any> = {
      /* required, no default */
      org_id: orgId,
      case_number: caseNumber,
      title: title,
      method: method,
      created_by: userId,
      energy_type: fourD.energy,
      interaction_type: fourD.interaction,
      response_type: fourD.response,
      time_dimension_type: fourD.time,

      /* has defaults but we set explicitly */
      status: "open",
      material_class: materialClass,
      load_condition: "unknown",

      /* nullable — universal context */
      component_name: componentName,
      code_family: codeFamily,
      inspection_context: inspectionContext,
      material_family: materialFamily,
      surface_type: surfaceType,
      service_environment: serviceEnvironment
    };

    var insertRes = await sb
      .from("inspection_cases")
      .insert([caseRow])
      .select("id")
      .single();

    if (insertRes.error) {
      console.log("create-case insert error: " + JSON.stringify(insertRes.error));
      return {
        statusCode: 500,
        headers: headers(),
        body: JSON.stringify({ error: "Failed to create case", detail: insertRes.error.message || insertRes.error })
      };
    }

    var caseId = insertRes.data.id;

    /* ---- Store process context in physics_reality_models if weld ---- */
    if (processContext && inspectionContext === "WELD") {
      var physRow = {
        case_id: caseId,
        process_context_json: processContext,
        created_at: new Date().toISOString()
      };

      var physRes = await sb
        .from("physics_reality_models")
        .insert([physRow]);

      if (physRes.error) {
        console.log("WARNING: failed to insert physics_reality_models: " + JSON.stringify(physRes.error));
      }
    }

    /* ---- Return ---- */
    return {
      statusCode: 200,
      headers: headers(),
      body: JSON.stringify({
        success: true,
        caseId: caseId,
        caseNumber: caseNumber,
        inspectionContext: inspectionContext,
        materialClass: materialClass
      })
    };

  } catch (err: any) {
    console.log("create-case error: " + String(err));
    return {
      statusCode: 500,
      headers: headers(),
      body: JSON.stringify({ error: "Internal error", detail: String(err) })
    };
  }
};

export { handler };
