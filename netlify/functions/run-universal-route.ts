/**
 * DEPLOY35 — run-universal-route.ts
 * netlify/functions/run-universal-route.ts
 *
 * Netlify function that:
 *   1. Reads case context (inspection_context, material_class, etc.)
 *   2. Runs the Universal Inspection Context Engine
 *   3. Stores route decision + adjusted conditions in Supabase
 *   4. Updates inspection_cases with route columns
 *   5. Returns full result to frontend
 *
 * CONSTRAINT: No backtick template literals (Git Bash paste corruption)
 */
import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import {
  runUniversalInspectionContextEngine,
  UniversalInspectionInput
} from "./lib/universal-router";

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
    var body = JSON.parse(event.body || "{}");
    var caseId = body.caseId;

    if (!caseId) {
      return {
        statusCode: 400,
        headers: headers(),
        body: JSON.stringify({ error: "caseId is required" })
      };
    }

    var sb = createClient(supabaseUrl, supabaseKey);

    /* ---- Read case context ---- */
    var caseRes = await sb
      .from("inspection_cases")
      .select("id, inspection_context, material_class, material_family, surface_type, service_environment")
      .eq("id", caseId)
      .single();

    if (caseRes.error || !caseRes.data) {
      return {
        statusCode: 404,
        headers: headers(),
        body: JSON.stringify({ error: "Case not found", detail: caseRes.error })
      };
    }

    var caseData = caseRes.data;

    /* ---- Build engine input ---- */
    var engineInput: UniversalInspectionInput = {
      inspectionContext: caseData.inspection_context || null,
      materialClass: caseData.material_class || null,
      materialFamily: caseData.material_family || null,
      surfaceType: caseData.surface_type || null,
      serviceEnvironment: caseData.service_environment || null,
      weldingMethod: null,
      evidence: body.evidence || null,
      candidateConditions: body.candidateConditions || null
    };

    /* ---- Run engine ---- */
    var result = runUniversalInspectionContextEngine(engineInput);

    /* ---- Store run ---- */
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

    var insertRes = await sb
      .from("universal_route_runs")
      .insert([runRow])
      .select("id")
      .single();

    if (insertRes.error) {
      console.log("WARNING: failed to insert universal_route_runs: " + JSON.stringify(insertRes.error));
    }

    /* ---- Update case with route columns ---- */
    var updateRes = await sb
      .from("inspection_cases")
      .update({
        universal_route_code: result.routeDecision.route
      })
      .eq("id", caseId);

    if (updateRes.error) {
      console.log("WARNING: failed to update case route: " + JSON.stringify(updateRes.error));
    }

    /* ---- Return ---- */
    return {
      statusCode: 200,
      headers: headers(),
      body: JSON.stringify({
        success: true,
        caseId: caseId,
        routeDecision: result.routeDecision,
        profile: {
          route: result.profile.route,
          recommendedMethods: result.profile.recommendedMethods,
          teachingFocus: result.profile.teachingFocus,
          likelyCauses: result.profile.likelyCauses
        },
        adjustedConditions: result.adjustedConditions.slice(0, 10),
        primaryCondition: result.primaryCondition,
        primaryLocked: result.primaryLocked,
        confidenceBand: result.confidenceBand,
        warnings: result.warnings
      })
    };

  } catch (err: any) {
    console.log("run-universal-route error: " + String(err));
    return {
      statusCode: 500,
      headers: headers(),
      body: JSON.stringify({ error: "Internal error", detail: String(err) })
    };
  }
};

export { handler };
