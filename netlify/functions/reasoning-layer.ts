/**
 * DEPLOY12_reasoning_layer.ts
 * Netlify Function: reasoning-layer
 * Deploy to: netlify/functions/reasoning-layer.ts
 *
 * Claude - The Reasoner
 * Takes observations + physics model and generates causal hypotheses.
 * Uses forward reasoning, inverse reasoning, and elimination logic.
 * Does NOT make final code decisions.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var supabase = createClient(supabaseUrl, supabaseKey);

var anthropicKey = process.env.ANTHROPIC_API_KEY || "";

var SYSTEM_PROMPT = "You are the causal reasoning layer for the FORGED NDT Intelligence OS - a physics-first NDT platform. "
  + "You receive observations from the observation layer (GPT-4o vision) plus a physics reality model. "
  + "\n\nYour job: "
  + "\n1. FORWARD REASONING: Given the observations, determine what physical conditions could produce them. "
  + "\n2. INVERSE REASONING: Given the material, geometry, and process, what should a sound component look like? Identify deviations. "
  + "\n3. ELIMINATION: Use physical laws to eliminate impossible interpretations. "
  + "\n4. CROSS-METHOD INSIGHT: Note what other methods would reveal about these findings. "
  + "\n\nYou must: "
  + "\n- Produce ranked defect hypotheses with physics justification "
  + "\n- Explain likely root causes tied to welding process, material, or geometry "
  + "\n- Eliminate weaker alternatives with physics reasoning "
  + "\n- Quantify uncertainty honestly "
  + "\n- Suggest what additional evidence would resolve ambiguity "
  + "\n\nYou must NOT: "
  + "\n- Make final legal/code accept/reject decisions "
  + "\n- Invent standards language or code references "
  + "\n- Overstate certainty "
  + "\n\nReturn strict JSON: "
  + "{\"summary\": \"reasoning summary\", "
  + "\"hypotheses\": [{\"defect_label\": \"string\", \"probability\": 0.0, \"reasoning\": \"physics-based explanation\", "
  + "\"evidence_refs\": [], \"possible_causes\": [], \"eliminated_alternatives\": [{\"label\": \"string\", \"reason\": \"string\"}]}], "
  + "\"likely_root_causes\": [], "
  + "\"cross_method_insights\": [{\"method\": \"VT|PT|MT|UT|RT|ET\", \"what_it_would_reveal\": \"string\"}], "
  + "\"additional_evidence_needed\": [], "
  + "\"inverse_prediction_comparison\": \"how do observations compare to what physics predicts for a sound component\", "
  + "\"confidence\": 0.0, "
  + "\"teaching_note\": \"one key physics insight a Level 2 inspector should learn from this case\"}";

export var handler: Handler = async function(event) {
  try {
    var body = JSON.parse(event.body || "{}");
    var caseId = body.case_id;

    if (!caseId) {
      return { statusCode: 400, body: JSON.stringify({ error: "case_id required" }) };
    }

    if (!anthropicKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }) };
    }

    // Fetch case
    var caseResult = await supabase.from("inspection_cases").select("*").eq("id", caseId).single();
    if (caseResult.error) throw caseResult.error;
    var inspectionCase = caseResult.data;

    // Fetch physics model
    var physicsResult = await supabase.from("physics_reality_models").select("*").eq("case_id", caseId).single();
    var physicsModel = physicsResult.data;

    // Fetch observations (findings from openai)
    var findingsResult = await supabase.from("findings").select("*").eq("case_id", caseId).eq("source", "openai");
    var observations = findingsResult.data || [];

    // Fetch latest AI vision run output
    var aiRunResult = await supabase.from("ai_runs").select("output_json")
      .eq("case_id", caseId).eq("run_type", "vision").order("created_at", { ascending: false }).limit(1).single();
    var visionOutput = aiRunResult.data ? aiRunResult.data.output_json : {};

    // Build context
    var contextText = "=== INSPECTION CASE ===\n"
      + "Method: " + inspectionCase.method + "\n"
      + "Material: " + inspectionCase.material_class + "\n"
      + "Load Condition: " + inspectionCase.load_condition + "\n"
      + "Thickness: " + (inspectionCase.thickness_mm || "unknown") + " mm\n"
      + "Joint Type: " + (inspectionCase.joint_type || "unknown") + "\n"
      + "Component: " + (inspectionCase.component_name || "unknown") + "\n"
      + "Code: " + (inspectionCase.code_family || "") + " " + (inspectionCase.code_edition || "") + "\n";

    if (physicsModel) {
      contextText = contextText + "\n=== PHYSICS REALITY MODEL ===\n"
        + "Material Properties: " + JSON.stringify(physicsModel.material_properties_json) + "\n"
        + "Geometry: " + JSON.stringify(physicsModel.geometry_json) + "\n"
        + "Process Context: " + JSON.stringify(physicsModel.process_context_json) + "\n"
        + "Service Context: " + JSON.stringify(physicsModel.service_context_json) + "\n"
        + "Predicted Discontinuities: " + JSON.stringify(physicsModel.probable_discontinuities_json) + "\n"
        + "Method Capability: " + JSON.stringify(physicsModel.method_capability_map_json) + "\n";
    }

    contextText = contextText + "\n=== OBSERVATIONS FROM VISION LAYER ===\n"
      + "Summary: " + (visionOutput.summary || "No vision summary available") + "\n"
      + "Observations: " + JSON.stringify(visionOutput.observations || observations) + "\n"
      + "Measurements: " + JSON.stringify(visionOutput.measurements || {}) + "\n"
      + "Signal Notes: " + JSON.stringify(visionOutput.signal_notes || {}) + "\n";

    // Call Claude
    var claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        temperature: 0.3,
        system: SYSTEM_PROMPT,
        messages: [
          { role: "user", content: "Analyze this NDT inspection case using physics-first causal reasoning.\n\n" + contextText }
        ]
      })
    });

    var claudeJson = await claudeResp.json();

    if (!claudeResp.ok) {
      throw new Error("Claude API error: " + JSON.stringify(claudeJson));
    }

    var responseText = claudeJson.content[0].text;

    // Parse JSON from response - handle potential markdown wrapping
    var cleanedText = responseText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    var reasoningOutput = JSON.parse(cleanedText);

    // Store reasoning findings
    if (reasoningOutput.hypotheses && reasoningOutput.hypotheses.length > 0) {
      var reasoningRows = reasoningOutput.hypotheses.map(function(h: any) {
        return {
          case_id: caseId,
          source: "claude",
          finding_type: "cause_hypothesis",
          label: h.defect_label,
          confidence: h.probability || null,
          structured_json: {
            reasoning: h.reasoning,
            possible_causes: h.possible_causes,
            eliminated_alternatives: h.eliminated_alternatives,
            evidence_refs: h.evidence_refs
          }
        };
      });
      await supabase.from("findings").insert(reasoningRows);
    }

    // Log AI run
    await supabase.from("ai_runs").insert({
      case_id: caseId,
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      run_type: "reasoning",
      prompt_version: "v1",
      input_json: { context_length: contextText.length, observations_count: observations.length },
      output_json: reasoningOutput
    });

    // Update case
    await supabase
      .from("inspection_cases")
      .update({
        status: "reasoning_complete",
        ai_claude_summary: reasoningOutput.summary || "",
        updated_at: new Date().toISOString()
      })
      .eq("id", caseId);

    // Log event
    await supabase.from("case_events").insert({
      case_id: caseId,
      event_type: "reasoning_complete",
      actor_id: null,
      event_json: {
        hypotheses_count: (reasoningOutput.hypotheses || []).length,
        confidence: reasoningOutput.confidence,
        summary: reasoningOutput.summary || ""
      }
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reasoningOutput)
    };

  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "reasoning-layer failed" })
    };
  }
};
