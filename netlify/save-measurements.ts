/**
 * DEPLOY19_save-measurements.ts
 * Deploy to: netlify/functions/save-measurements.ts
 *
 * Saves inspector measurements to Supabase
 * Called by the MeasurementInput component
 */

import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var caseId = body.case_id;
    var measurementsList = body.measurements || [];
    var unitPreference = body.unit_preference || "imperial";

    if (!caseId || measurementsList.length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "case_id and measurements are required" })
      };
    }

    var supabase = createClient(supabaseUrl, supabaseKey);

    // Upsert each measurement
    var savedCount = 0;
    var errors: string[] = [];

    for (var i = 0; i < measurementsList.length; i++) {
      var m = measurementsList[i];
      var result = await supabase
        .from("case_measurements")
        .upsert({
          case_id: caseId,
          finding_type: m.finding_type,
          measurement_key: m.measurement_key,
          value_imperial: m.value_imperial,
          value_metric: m.value_metric,
          unit_imperial: m.unit_imperial || "in",
          unit_metric: m.unit_metric || "mm",
          measured_at: new Date().toISOString(),
          notes: m.notes || null
        }, {
          onConflict: "case_id,finding_type,measurement_key"
        });

      if (result.error) {
        errors.push(m.finding_type + "." + m.measurement_key + ": " + result.error.message);
      } else {
        savedCount = savedCount + 1;
      }
    }

    // Update case status
    await supabase
      .from("inspection_cases")
      .update({
        measurement_status: "completed",
        unit_preference: unitPreference
      })
      .eq("id", caseId);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: errors.length === 0,
        saved: savedCount,
        total: measurementsList.length,
        errors: errors
      })
    };

  } catch (err: any) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || "save-measurements failed" })
    };
  }
};

export { handler };
