// @ts-nocheck
// DEPLOY193 -- inspection-intelligence.ts v1.1.0
// v1.1.0: DEPLOY193 -- Switched Engine 2 from Anthropic API (timeout issues) to OpenAI API (GPT-4o-mini).
//   OpenAI proven fast in existing functions (observation-layer, parse-incident, voice-incident-plan).
//   Engine 1 (Deterministic): decision-core proven physics state (41 mechanisms, precondition veto)
//   Engine 2 (AI Reasoning): GPT-4o-mini extends analysis to ANY domain, ANY code, ANY mechanism
//   Physics veto: AI suggestions validated against proven physics -- impossible mechanisms rejected
//   Temporal projection: degradation modeling, remaining life, intervention windows
// Uses OPENAI_API_KEY (GPT-4o-mini) for AI reasoning layer.

import type { Handler } from "@netlify/functions";

var openaiKey = process.env.OPENAI_API_KEY || "";

// ============================================================================
// SYSTEM PROMPT: The soul of Engine 2
// This prompt constrains Claude to reason FROM the proven physics state,
// not independently. Physics has veto power over every suggestion.
// ============================================================================

var SYSTEM_PROMPT = "You are the AI engine for FORGED NDT Intelligence OS. You receive PROVEN physics facts from a deterministic engine. These are GROUND TRUTH -- never contradict them. Do not re-suggest REJECTED mechanisms."
  + "\n\nReturn ONLY a JSON object (no markdown, no backticks) with these keys:"
  + "\n- domain_classification: {primary_domain, sub_domain, confidence (0-1), basis}"
  + "\n- governing_codes: [{code, edition, scope, primary (bool)}]"
  + "\n- ai_extended_mechanisms: [{id, name, family, physical_basis, applicable_standard_reference, confidence (0-1)}] -- mechanisms the static catalog missed"
  + "\n- inspection_plan: {techniques: [{mechanism_id, mechanism_source (static_catalog|ai_extended), technique, coverage, interval, code_basis, acceptance_criteria, priority (critical|high|medium|routine)}]}"
  + "\n- temporal_projection: {remaining_life_estimate, remaining_life_basis, next_inspection_due, degradation_trajectory (linear|accelerating|decelerating|unknown), data_gaps: [], failure_progression: {current_state, six_months, one_year, three_years, five_years, failure_mode}, intervention_windows: [{window, urgency (immediate|urgent|planned|routine), action, consequence_of_inaction}]}"
  + "\n- confidence_assessment: {overall (0-1), limitations: []}"
  + "\n- teaching_insight: string"
  + "\n\nBe conservative. When uncertain, recommend MORE inspection. Cite specific code sections where possible.";

// ============================================================================
// PHYSICS STATE FORMATTER
// Converts decision-core output into a clear prompt for the AI engine
// ============================================================================

function formatPhysicsStateForAI(dcOutput: any) {
  var dc = dcOutput.decision_core || dcOutput;
  var pr = dc.physical_reality || {};
  var dr = dc.damage_reality || {};
  var cr = dc.consequence_reality || {};
  var ar = dc.authority_reality || {};
  var ir = dc.inspection_reality || {};
  var pc = dc.physics_computations || {};

  var text = "=== PROVEN PHYSICS STATE (from deterministic engine -- these are facts, not suggestions) ===\n\n";

  // Material
  var mat = pr.material || {};
  text = text + "MATERIAL: " + (mat.class || "unknown") + " (confidence: " + (mat.class_confidence || 0) + ")\n";
  if (mat.evidence && mat.evidence.length > 0) {
    text = text + "  Evidence: " + mat.evidence.join(", ") + "\n";
  }

  // Environment
  var env = pr.environment || {};
  text = text + "\nENVIRONMENT:\n";
  if (env.phases_present && env.phases_present.length > 0) {
    text = text + "  Agents present: " + env.phases_present.join(", ") + "\n";
  }
  if (env.phases_negated && env.phases_negated.length > 0) {
    text = text + "  Agents negated: " + env.phases_negated.join(", ") + "\n";
  }
  if (env.atmosphere_class) {
    text = text + "  Atmosphere class: " + env.atmosphere_class + "\n";
  }

  // Compact state summary -- only non-null/non-false/non-empty values to save tokens
  function compactState(label: string, obj: any) {
    var parts = [];
    for (var key in obj) {
      var val = obj[key];
      if (val === null || val === undefined || val === false || val === "" || val === 0) continue;
      if (Array.isArray(val) && val.length === 0) continue;
      if (typeof val === "object" && !Array.isArray(val) && Object.keys(val).length === 0) continue;
      parts.push(key + "=" + (typeof val === "object" ? JSON.stringify(val) : val));
    }
    if (parts.length === 0) return "";
    return label + ": " + parts.join(", ") + "\n";
  }

  text = text + compactState("THERMAL", pr.thermal || {});
  text = text + compactState("STRESS", pr.stress || {});
  text = text + compactState("CHEMICAL", pr.chemical || {});
  text = text + compactState("ENERGY", pr.energy || {});
  text = text + compactState("PROCESS_CHEMISTRY", pr.process_chemistry || {});
  text = text + compactState("FLOW_REGIME", pr.flow_regime || {});
  text = text + compactState("DEPOSITS", pr.deposits || {});

  // NPS inference
  var nps = pr.nps_inference || {};
  if (nps.nps_inch) {
    text = text + "\nPIPE GEOMETRY: NPS " + nps.nps_inch + " Schedule " + nps.schedule + " (wall: " + nps.nominal_wall_mm + "mm, source: " + nps.wall_source + ")\n";
  }

  // Context inferred
  var ctx = pr.context_inferred || [];
  if (ctx.length > 0) {
    var ctxSlice = ctx.slice(0, 8);
    text = text + "\nCONTEXT INFERRED (" + ctx.length + " total):\n";
    for (var i = 0; i < ctxSlice.length; i++) {
      text = text + "  - " + ctxSlice[i] + "\n";
    }
  }

  // Damage Reality -- what the static catalog already found
  text = text + "\n=== STATIC CATALOG RESULTS (41 mechanisms evaluated) ===\n\n";

  var validated = dr.validated_mechanisms || [];
  if (validated.length > 0) {
    text = text + "VALIDATED MECHANISMS (physics preconditions satisfied):\n";
    for (var j = 0; j < validated.length; j++) {
      var v = validated[j];
      text = text + "  - " + v.id + " (" + (v.name || v.id) + ") -- reality_state: " + (v.reality_state || "validated") + ", severity: " + (v.severity || "unknown") + "\n";
    }
  }

  var rejected = dr.rejected_mechanisms || [];
  if (rejected.length > 0) {
    var rejIds = rejected.map(function(r: any) { return r.id; });
    text = text + "\nREJECTED MECHANISMS (" + rejected.length + " total -- DO NOT re-suggest any of these): " + rejIds.join(", ") + "\n";
  }

  var primary = dr.primary_mechanism || {};
  if (primary.id) {
    text = text + "\nPRIMARY MECHANISM: " + primary.id + " (" + (primary.name || "") + ")\n";
  }

  // Consequence
  text = text + "\n=== CONSEQUENCE ASSESSMENT ===\n";
  text = text + "  Tier: " + (cr.consequence_tier || "unknown") + "\n";
  if (cr.consequence_undetermined) {
    text = text + "  WARNING: Consequence undetermined -- impacts: " + JSON.stringify(cr.undetermined_impacts || []) + "\n";
  }

  // Physics computations (remaining life, corrosion rates, etc.)
  if (pc && Object.keys(pc).length > 0) {
    text = text + "\n=== PHYSICS COMPUTATIONS ===\n";
    var dq = pc.data_quality || {};
    if (dq.wall_thickness_used_mm) {
      text = text + "  Wall thickness: " + dq.wall_thickness_used_mm + "mm (source: " + (dq.wall_source || "unknown") + ")\n";
    }
    if (pc.remaining_life_years !== undefined && pc.remaining_life_years !== null) {
      text = text + "  Remaining life: " + pc.remaining_life_years + " years\n";
    }
    if (pc.corrosion_rate_mm_yr !== undefined && pc.corrosion_rate_mm_yr !== null) {
      text = text + "  Corrosion rate: " + pc.corrosion_rate_mm_yr + " mm/yr\n";
    }
    if (pc.fitness_for_service) {
      text = text + "  Fitness for service: " + JSON.stringify(pc.fitness_for_service) + "\n";
    }
  }

  // Authority
  if (ar && ar.primary_code) {
    text = text + "\n=== AUTHORITY (from deterministic engine) ===\n";
    text = text + "  Primary code: " + ar.primary_code + "\n";
  }

  return text;
}

// ============================================================================
// PHYSICS VETO: Validates AI-suggested mechanisms against proven physics
// Returns only those that don't violate proven state
// ============================================================================

function physicsVetoAISuggestions(aiMechanisms: any[], physicsState: any) {
  var dc = physicsState.decision_core || physicsState;
  var pr = dc.physical_reality || {};
  var dr = dc.damage_reality || {};
  var mat = pr.material || {};
  var env = pr.environment || {};
  var thermal = pr.thermal || {};

  var rejectedIds = (dr.rejected_mechanisms || []).map(function(r: any) { return r.id; });
  var validatedIds = (dr.validated_mechanisms || []).map(function(v: any) { return v.id; });

  var vetoed = [];
  var approved = [];

  for (var i = 0; i < aiMechanisms.length; i++) {
    var mech = aiMechanisms[i];

    // Rule 1: If the static catalog already rejected this ID, veto it
    if (rejectedIds.indexOf(mech.id) >= 0) {
      mech.veto_reason = "Already rejected by deterministic engine precondition check";
      mech.veto_status = "VETOED";
      vetoed.push(mech);
      continue;
    }

    // Rule 2: If the static catalog already validated it, skip (already covered)
    if (validatedIds.indexOf(mech.id) >= 0) {
      mech.veto_reason = "Already validated by static catalog -- redundant";
      mech.veto_status = "REDUNDANT";
      vetoed.push(mech);
      continue;
    }

    // Rule 3: Basic physics plausibility checks
    var plausible = true;
    var vetoReason = "";

    // If AI suggests a high-temp mechanism but proven temp is low
    if (mech.family === "metallurgical" || mech.family === "creep") {
      var opTemp = 0;
      if (thermal.operating_temperature_f) {
        opTemp = thermal.operating_temperature_f;
      } else if (thermal.thermal_regime === "ambient" || thermal.thermal_regime === "cold") {
        opTemp = 100; // assume low
      }
      if (opTemp < 400 && mech.name && (mech.name.toLowerCase().indexOf("creep") >= 0 || mech.name.toLowerCase().indexOf("sigma") >= 0 || mech.name.toLowerCase().indexOf("carburiz") >= 0)) {
        plausible = false;
        vetoReason = "Physics veto: mechanism requires high temperature but proven thermal state is " + opTemp + "F";
      }
    }

    if (plausible) {
      mech.veto_status = "APPROVED";
      approved.push(mech);
    } else {
      mech.veto_reason = vetoReason;
      mech.veto_status = "VETOED";
      vetoed.push(mech);
    }
  }

  return { approved: approved, vetoed: vetoed };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export var handler: Handler = async function(event) {
  var startTime = Date.now();

  // CORS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ""
    };
  }

  try {
    var body = JSON.parse(event.body || "{}");

    // Accept either full decision-core output or pre-structured input
    var dcOutput = body.decision_core ? body : (body.decision_core_output || body);
    var transcript = body.transcript || "";
    var assetDescription = body.asset_description || "";

    // Check for domain refusal pass-through
    var dc = dcOutput.decision_core || dcOutput;
    if (dc.domain_not_supported === true) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          domain_not_supported: true,
          reason: "Decision core refused this domain. Inspection intelligence cannot extend a refused analysis.",
          metadata: { version: "1.1.0", engine: "inspection-intelligence" }
        })
      };
    }

    if (!openaiKey) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "OPENAI_API_KEY not configured" })
      };
    }

    // Format physics state for the AI
    var physicsContext = formatPhysicsStateForAI(dcOutput);

    // Add transcript if provided
    if (transcript) {
      physicsContext = physicsContext + "\n=== ORIGINAL INSPECTOR TRANSCRIPT ===\n" + transcript + "\n";
    }
    if (assetDescription) {
      physicsContext = physicsContext + "\n=== ASSET DESCRIPTION ===\n" + assetDescription + "\n";
    }

    // Call GPT-4o-mini -- Engine 2 (with 24s timeout to stay within Netlify 26s gateway limit)
    var abortController = new AbortController();
    var fetchTimeout = setTimeout(function() { abortController.abort(); }, 24000);

    var aiResp;
    var aiJson;
    try {
      aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: abortController.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + openaiKey
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 4096,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT
            },
            {
              role: "user",
              content: "Return ONLY raw JSON, no markdown. Analyze this inspection case and generate an inspection plan with temporal projections.\n\n" + physicsContext
            }
          ]
        })
      });
      clearTimeout(fetchTimeout);
    } catch (fetchErr: any) {
      clearTimeout(fetchTimeout);
      var isAbort = fetchErr.name === "AbortError";
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          error: isAbort ? "OpenAI API call timed out after 24 seconds" : "OpenAI API fetch failed: " + fetchErr.message,
          debug: {
            key_present: openaiKey.length > 0,
            key_prefix: openaiKey.substring(0, 10) + "...",
            physics_context_length: physicsContext.length,
            timeout: isAbort
          },
          metadata: { version: "1.1.0", engine: "inspection-intelligence" }
        })
      };
    }

    aiJson = await aiResp.json();

    if (!aiResp.ok) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          error: "OpenAI API returned error",
          status: aiResp.status,
          openai_error: aiJson,
          debug: {
            key_prefix: openaiKey.substring(0, 10) + "...",
            model: "gpt-4o-mini"
          },
          metadata: { version: "1.1.0", engine: "inspection-intelligence" }
        })
      };
    }

    var responseText = (aiJson.choices && aiJson.choices[0] && aiJson.choices[0].message) ? aiJson.choices[0].message.content : "";

    // Parse JSON from response -- strip markdown wrapping and find the JSON object
    var cleanedText = responseText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    // Find the first { and last } to extract JSON even if there's extra text
    var jsonStart = cleanedText.indexOf("{");
    var jsonEnd = cleanedText.lastIndexOf("}");
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      cleanedText = cleanedText.substring(jsonStart, jsonEnd + 1);
    }
    var aiOutput;
    try {
      aiOutput = JSON.parse(cleanedText);
    } catch (parseErr) {
      // If JSON parse fails, return raw text with error flag
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          error: "AI response was not valid JSON",
          raw_response: responseText.substring(0, 2000),
          metadata: { version: "1.1.0", engine: "inspection-intelligence" }
        })
      };
    }

    // Physics veto on AI-extended mechanisms
    var aiMechanisms = aiOutput.ai_extended_mechanisms || [];
    var vetoResult = physicsVetoAISuggestions(aiMechanisms, dcOutput);

    // Build combined output
    var dr = dc.damage_reality || {};
    var staticValidated = dr.validated_mechanisms || [];

    var elapsed = Date.now() - startTime;

    var finalOutput = {
      // Engine identification
      metadata: {
        version: "1.1.0",
        engine: "inspection-intelligence",
        architecture: "dual-engine-physics-first",
        elapsed_ms: elapsed,
        static_catalog_mechanisms: 41,
        static_validated_count: staticValidated.length,
        ai_suggested_count: aiMechanisms.length,
        ai_approved_count: vetoResult.approved.length,
        ai_vetoed_count: vetoResult.vetoed.length,
        physics_veto_active: true
      },

      // Domain classification (from AI)
      domain_classification: aiOutput.domain_classification || null,

      // Governing codes (from AI)
      governing_codes: aiOutput.governing_codes || [],

      // Combined mechanism results
      mechanisms: {
        // From Engine 1 (deterministic -- ground truth)
        static_catalog: {
          validated: staticValidated,
          rejected_count: (dr.rejected_mechanisms || []).length,
          primary: dr.primary_mechanism || null
        },
        // From Engine 2 (AI -- physics-vetoed)
        ai_extended: {
          approved: vetoResult.approved,
          vetoed: vetoResult.vetoed
        }
      },

      // Inspection plan (from AI, covering both static + extended mechanisms)
      inspection_plan: aiOutput.inspection_plan || null,

      // Temporal projection (from AI, constrained by physics)
      temporal_projection: aiOutput.temporal_projection || null,

      // Confidence assessment
      confidence_assessment: aiOutput.confidence_assessment || null,

      // Teaching insight
      teaching_insight: aiOutput.teaching_insight || null
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(finalOutput)
    };

  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        error: err.message || "inspection-intelligence failed",
        metadata: { version: "1.1.0", engine: "inspection-intelligence" }
      })
    };
  }
};
