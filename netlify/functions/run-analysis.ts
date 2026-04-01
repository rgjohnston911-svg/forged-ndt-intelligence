/**
 * DEPLOY14_run_analysis.ts
 * Netlify Function: run-analysis
 * Deploy to: netlify/functions/run-analysis.ts
 *
 * Orchestrator that chains:
 *   Stage 2: GPT-4o Observation Layer
 *   Stage 3: Claude Causal Reasoning
 *   Stage 4: Deterministic Truth Engine
 *
 * Called from the frontend after evidence is uploaded.
 * Each stage runs as a separate function call to stay under
 * the 60-second Netlify timeout.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var supabase = createClient(supabaseUrl, supabaseKey);

var siteUrl = process.env.URL || "";

export var handler: Handler = async function(event) {
  try {
    var body = JSON.parse(event.body || "{}");
    var caseId = body.case_id;

    if (!caseId) {
      return { statusCode: 400, body: JSON.stringify({ error: "case_id required" }) };
    }

    var results: any = {
      observation: null,
      reasoning: null,
      truth: null,
      errors: []
    };

    // Log analysis start
    await supabase.from("case_events").insert({
      case_id: caseId,
      event_type: "analysis_started",
      actor_id: body.user_id || null,
      event_json: { triggered_by: "run-analysis" }
    });

    // Stage 2: Observation Layer (GPT-4o)
    try {
      var obsResp = await fetch(siteUrl + "/.netlify/functions/observation-layer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId })
      });
      var obsJson = await obsResp.json();
      if (obsResp.ok) {
        results.observation = obsJson;
      } else {
        results.errors.push({ stage: "observation", error: obsJson.error || "Failed" });
      }
    } catch (obsErr: any) {
      results.errors.push({ stage: "observation", error: obsErr.message });
    }

    // Stage 3: Reasoning Layer (Claude)
    try {
      var reasonResp = await fetch(siteUrl + "/.netlify/functions/reasoning-layer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId })
      });
      var reasonJson = await reasonResp.json();
      if (reasonResp.ok) {
        results.reasoning = reasonJson;
      } else {
        results.errors.push({ stage: "reasoning", error: reasonJson.error || "Failed" });
      }
    } catch (reasonErr: any) {
      results.errors.push({ stage: "reasoning", error: reasonErr.message });
    }

    // Stage 4: Truth Engine (Deterministic)
    try {
      var truthResp = await fetch(siteUrl + "/.netlify/functions/truth-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId })
      });
      var truthJson = await truthResp.json();
      if (truthResp.ok) {
        results.truth = truthJson;
      } else {
        results.errors.push({ stage: "truth", error: truthJson.error || "Failed" });
      }
    } catch (truthErr: any) {
      results.errors.push({ stage: "truth", error: truthErr.message });
    }

    // Update case to finalized if truth completed
    if (results.truth && results.truth.disposition) {
      await supabase
        .from("inspection_cases")
        .update({ status: "finalized", updated_at: new Date().toISOString() })
        .eq("id", caseId);
    }

    // Log analysis complete
    await supabase.from("case_events").insert({
      case_id: caseId,
      event_type: "analysis_complete",
      actor_id: null,
      event_json: {
        observation_ok: !!results.observation,
        reasoning_ok: !!results.reasoning,
        truth_ok: !!results.truth,
        errors: results.errors,
        final_disposition: results.truth ? results.truth.disposition : null
      }
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: results.errors.length === 0,
        results: results
      })
    };

  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "run-analysis failed" })
    };
  }
};
