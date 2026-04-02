/**
 * DEPLOY38 — create-case.ts
 * netlify/functions/create-case.ts
 *
 * Updated to store universal inspection context fields:
 *   - inspection_context
 *   - material_class
 *   - material_family
 *   - surface_type
 *   - service_environment
 *   - universal_route_code (set by run-universal-route later)
 *
 * Retains existing process_context_json for weld cases.
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

    /* ---- Parse body ---- */
    var body = JSON.parse(event.body || "{}");

    var method = (body.method || "").trim();
    var component = (body.component || "").trim();
    var code = (body.code || "").trim() || null;

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

    if (!component) {
      return {
        statusCode: 400,
        headers: headers(),
        body: JSON.stringify({ error: "component is required" })
      };
    }

    /* ---- Create case ---- */
    var caseRow: Record<string, any> = {
      user_id: userId,
      method: method,
      component: component,
      code: code,
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
      return {
        statusCode: 500,
        headers: headers(),
        body: JSON.stringify({ error: "Failed to create case", detail: insertRes.error })
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
        inspectionContext: inspectionContext,
        materialClass: materialClass,
        route: inspectionContext === "WELD" ? "WELD_FABRICATION_ENGINE" : "pending_universal_route"
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
