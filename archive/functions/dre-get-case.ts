/**
 * DEPLOY59 — dre-get-case.ts
 * netlify/functions/dre-get-case.ts
 *
 * Damage Reality Engine — Get Case + Latest Evaluation
 * Returns damage case, asset, latest evaluation, and underwater extension if present
 *
 * GET ?damage_case_id=UUID&org_id=UUID
 *
 * CONSTRAINT: String concatenation only — no backtick template literals
 */

import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

var handler: Handler = async function(event) {
  try {
    if (event.httpMethod !== "GET") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
    }

    var params = event.queryStringParameters || {};
    var damageCaseId = params.damage_case_id;
    var orgId = params.org_id;
    if (!damageCaseId || !orgId) {
      return { statusCode: 400, body: JSON.stringify({ error: "damage_case_id and org_id required" }) };
    }

    var supabase = getSupabase();

    /* Fetch damage case */
    var dcRes = await supabase
      .from("damage_cases")
      .select("*")
      .eq("id", damageCaseId)
      .eq("org_id", orgId)
      .single();

    if (dcRes.error) {
      return { statusCode: 404, body: JSON.stringify({ error: "Damage case not found" }) };
    }

    /* Fetch asset */
    var assetRes = await supabase
      .from("assets")
      .select("*")
      .eq("id", dcRes.data.asset_id)
      .eq("org_id", orgId)
      .single();

    /* Fetch latest evaluation */
    var evalRes = await supabase
      .from("damage_evaluations")
      .select("*")
      .eq("damage_case_id", damageCaseId)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1);

    var latestEval = (evalRes.data && evalRes.data.length > 0) ? evalRes.data[0] : null;

    /* Fetch underwater extension if evaluation exists */
    var uwExt = null;
    if (latestEval) {
      try {
        var uwRes = await supabase
          .from("underwater_evaluation_extensions")
          .select("*")
          .eq("damage_evaluation_id", latestEval.id)
          .single();
        if (uwRes.data) uwExt = uwRes.data;
      } catch (e) { /* no extension */ }
    }

    /* Fetch underwater asset profile if exists */
    var uwProfile = null;
    try {
      var uwpRes = await supabase
        .from("underwater_asset_profiles")
        .select("*")
        .eq("asset_id", dcRes.data.asset_id)
        .single();
      if (uwpRes.data) uwProfile = uwpRes.data;
    } catch (e) { /* no profile */ }

    /* Fetch dive operation profile if exists */
    var diveProfile = null;
    try {
      var dpRes = await supabase
        .from("dive_operation_profiles")
        .select("*")
        .eq("damage_case_id", damageCaseId)
        .single();
      if (dpRes.data) diveProfile = dpRes.data;
    } catch (e) { /* no dive profile */ }

    /* Fetch what-if runs */
    var whatifRes = await supabase
      .from("damage_whatif_runs")
      .select("*")
      .eq("damage_case_id", damageCaseId)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    /* Fetch linked inspection cases */
    var linkedCases = null;
    try {
      var lcRes = await supabase
        .from("inspection_cases")
        .select("id, case_number, title, method, status, final_disposition")
        .eq("damage_case_id", damageCaseId);
      if (lcRes.data && lcRes.data.length > 0) linkedCases = lcRes.data;
    } catch (e) { /* column may not exist yet */ }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        damage_case: dcRes.data,
        asset: assetRes.data || null,
        latest_evaluation: latestEval,
        underwater_extension: uwExt,
        underwater_asset_profile: uwProfile,
        dive_operation_profile: diveProfile,
        whatif_runs: whatifRes.data || [],
        linked_inspection_cases: linkedCases,
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Unexpected error" }),
    };
  }
};

export { handler };
