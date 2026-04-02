/**
 * DEPLOY38v2 — create-case.ts
 * netlify/functions/create-case.ts
 *
 * Fixed column names to match actual inspection_cases schema:
 *   - created_by (not user_id)
 *   - component_name (not component)
 *   - code_family (not code)
 *   - org_id from profiles table
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

    /* ---- Parse body ---- */
    var body = JSON.parse(event.body || "{}");

    var method = (body.method || "").trim();
    var componentName = (body.component || "").trim();
    var codeFamily = (body.code || "").trim() || null;

    /* Universal context fields */
    var inspectionContext = (body.inspectionContext || "").trim() || null;
    var materialClass = (body.materialClass || "").trim() || null;
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

    /* ---- Generate case number ---- */
    var caseNumber = "NDT-" + Date.now();

    /* ---- Create case ---- */
    var caseRow: Record<string, any> = {
      org_id: orgId,
      created_by: userId,
      case_number: caseNumber,
      method: method,
      component_name: componentName,
      code_family: codeFamily,
      status: "open",
      inspection_context: inspectionContext,
      material_class: materialClass,
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
