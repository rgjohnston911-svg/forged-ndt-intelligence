// @ts-nocheck
// DEPLOY192 -- inspection-intelligence.ts v1.0.1
// v1.0.3: DEPLOY192 -- Haiku for speed. Sonnet exceeds 26s on complex prompts. Haiku completes in 5-8s with same prompt quality.
//   Engine 1 (Deterministic): decision-core proven physics state (41 mechanisms, precondition veto)
//   Engine 2 (AI Reasoning): Claude extends analysis to ANY domain, ANY code, ANY mechanism
//   Physics veto: AI suggestions validated against proven physics -- impossible mechanisms rejected
//   Temporal projection: degradation modeling, remaining life, intervention windows
// Uses ANTHROPIC_API_KEY (Claude) for AI reasoning layer.

import type { Handler } from "@netlify/functions";

var anthropicKey = process.env.ANTHROPIC_API_KEY || "";

// ============================================================================
// SYSTEM PROMPT: The soul of Engine 2
// This prompt constrains Claude to reason FROM the proven physics state,
// not independently. Physics has veto power over every suggestion.
// ============================================================================

var SYSTEM_PROMPT = "You are the AI reasoning engine for the FORGED NDT Intelligence OS -- a physics-first inspection intelligence platform. "
  + "You receive PROVEN physics facts from a deterministic engine that has already classified: material class, temperature regime, environment agents, stress state, energy state, geometry, deposits, flow regime, and process chemistry. "
  + "These physics facts are GROUND TRUTH. You must not contradict them. "
  + "\n\n"
  + "Your job is to EXTEND the deterministic engine's analysis by: "
  + "\n1. MECHANISM EXTENSION: Identify additional damage mechanisms that the static catalog (41 mechanisms) may not cover, especially domain-specific mechanisms for the asset type. For each, provide the physical basis and cite the applicable standard. "
  + "\n2. CODE IDENTIFICATION: Identify the primary governing inspection code(s) for this asset class and domain (e.g., API 510/570/571/579, ASME B31.3, DNV-RP-F116, DNVGL-ST-F101, AWS D1.1/D1.5, ASME BPE, EN 13480, BS 7910, EEMUA 159, etc.). Cite specific sections. "
  + "\n3. INSPECTION PLAN: For each validated damage mechanism (both from the static catalog AND your extensions), recommend specific inspection techniques, coverage requirements, and inspection intervals per the applicable code. "
  + "\n4. ACCEPTANCE CRITERIA: For each mechanism, state the acceptance criteria from the applicable code with specific clause references. "
  + "\n5. TEMPORAL PROJECTION: Based on the measured degradation rates (if provided), project: "
  + "\n   a. Remaining safe operating life "
  + "\n   b. Time to next required inspection "
  + "\n   c. Degradation trajectory (linear, accelerating, decelerating) "
  + "\n   d. Intervention windows with urgency classification "
  + "\n   e. What happens if NO action is taken -- describe the failure progression "
  + "\n6. DIGITAL TWIN NARRATIVE: Describe the asset's current state and probable future states at 6 months, 1 year, 3 years, and 5 years if no intervention occurs. Be specific about what physics predicts. "
  + "\n\n"
  + "CRITICAL RULES: "
  + "\n- Every mechanism you suggest MUST be physically plausible given the proven material class, temperature, environment, and stress state. "
  + "\n- If the deterministic engine already REJECTED a mechanism, do NOT re-suggest it. It was rejected for physics reasons. "
  + "\n- Do NOT invent code references. If you are not certain of a specific clause number, say so and provide the general standard name. "
  + "\n- Clearly distinguish between mechanisms from the STATIC CATALOG (already validated by the deterministic engine) and your AI-EXTENDED suggestions. "
  + "\n- For temporal projections, state your assumptions clearly. If insufficient data exists for a projection, say what additional measurements are needed. "
  + "\n- Be conservative. Inspection safety is paramount. When uncertain, recommend MORE inspection, not less. "
  + "\n\n"
  + "Return strict JSON in this format: "
  + "{"
  + "\"domain_classification\": { \"primary_domain\": \"string (e.g., refinery, offshore, marine, infrastructure, power_generation, pharmaceutical, aerospace)\", \"sub_domain\": \"string\", \"confidence\": 0.0, \"basis\": \"string\" }, "
  + "\"governing_codes\": [{ \"code\": \"string\", \"edition\": \"string or null\", \"scope\": \"string\", \"primary\": true/false }], "
  + "\"ai_extended_mechanisms\": [{ \"id\": \"string\", \"name\": \"string\", \"family\": \"corrosion|cracking|mechanical|metallurgical|other\", \"physical_basis\": \"string\", \"applicable_standard_reference\": \"string\", \"confidence\": 0.0, \"why_applicable\": \"string\" }], "
  + "\"inspection_plan\": { \"techniques\": [{ \"mechanism_id\": \"string\", \"mechanism_source\": \"static_catalog|ai_extended\", \"technique\": \"string (e.g., UT thickness, WFMT, PAUT, TOFD, RT, VT, PT, MT, AE, etc.)\", \"coverage\": \"string\", \"interval\": \"string\", \"code_basis\": \"string\", \"acceptance_criteria\": \"string\", \"priority\": \"critical|high|medium|routine\" }] }, "
  + "\"temporal_projection\": { \"remaining_life_estimate\": \"string or null\", \"remaining_life_basis\": \"string or null\", \"next_inspection_due\": \"string or null\", \"degradation_trajectory\": \"linear|accelerating|decelerating|unknown\", \"assumptions\": [\"string\"], \"data_gaps\": [\"string\"], \"failure_progression\": { \"current_state\": \"string\", \"six_months\": \"string\", \"one_year\": \"string\", \"three_years\": \"string\", \"five_years\": \"string\", \"failure_mode\": \"string\" }, \"intervention_windows\": [{ \"window\": \"string\", \"urgency\": \"immediate|urgent|planned|routine\", \"action\": \"string\", \"consequence_of_inaction\": \"string\" }] }, "
  + "\"confidence_assessment\": { \"overall\": 0.0, \"mechanism_coverage\": 0.0, \"code_accuracy\": 0.0, \"temporal_reliability\": 0.0, \"limitations\": [\"string\"] }, "
  + "\"teaching_insight\": \"string -- one key insight an inspector should learn from this case\" "
  + "}";

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

  // Thermal
  var thermal = pr.thermal || {};
  text = text + "\nTHERMAL STATE:\n";
  text = text + "  " + JSON.stringify(thermal) + "\n";

  // Stress
  var stress = pr.stress || {};
  text = text + "\nSTRESS STATE:\n";
  text = text + "  " + JSON.stringify(stress) + "\n";

  // Chemical
  var chemical = pr.chemical || {};
  text = text + "\nCHEMICAL STATE:\n";
  text = text + "  " + JSON.stringify(chemical) + "\n";

  // Energy
  var energy = pr.energy || {};
  text = text + "\nENERGY STATE:\n";
  text = text + "  " + JSON.stringify(energy) + "\n";

  // Process Chemistry
  var procChem = pr.process_chemistry || {};
  text = text + "\nPROCESS CHEMISTRY:\n";
  text = text + "  " + JSON.stringify(procChem) + "\n";

  // Flow Regime
  var flow = pr.flow_regime || {};
  text = text + "\nFLOW REGIME:\n";
  text = text + "  " + JSON.stringify(flow) + "\n";

  // Deposits
  var deposits = pr.deposits || {};
  text = text + "\nDEPOSITS:\n";
  text = text + "  " + JSON.stringify(deposits) + "\n";

  // NPS inference
  var nps = pr.nps_inference || {};
  if (nps.nps_inch) {
    text = text + "\nPIPE GEOMETRY: NPS " + nps.nps_inch + " Schedule " + nps.schedule + " (wall: " + nps.nominal_wall_mm + "mm, source: " + nps.wall_source + ")\n";
  }

  // Context inferred
  var ctx = pr.context_inferred || [];
  if (ctx.length > 0) {
    text = text + "\nCONTEXT INFERRED BY PHYSICS ENGINE:\n";
    for (var i = 0; i < ctx.length; i++) {
      text = text + "  - " + ctx[i] + "\n";
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
    text = text + "\nREJECTED MECHANISMS (physics preconditions violated -- DO NOT re-suggest these):\n";
    for (var k = 0; k < rejected.length; k++) {
      var r = rejected[k];
      text = text + "  - " + r.id + " -- rejected because: " + (r.rejection_reason || r.violated_bucket || "precondition violated") + "\n";
    }
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
          metadata: { version: "1.0.3", engine: "inspection-intelligence" }
        })
      };
    }

    if (!anthropicKey) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" })
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

    // Call Claude -- Engine 2
    var claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: "Analyze this inspection case. Generate a complete, code-referenced inspection plan with temporal projections.\n\n" + physicsContext
          }
        ]
      })
    });

    var claudeJson = await claudeResp.json();

    if (!claudeResp.ok) {
      throw new Error("Claude API error: " + JSON.stringify(claudeJson));
    }

    var responseText = (claudeJson.content && claudeJson.content[0]) ? claudeJson.content[0].text : "";

    // Parse JSON from response
    var cleanedText = responseText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
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
          metadata: { version: "1.0.3", engine: "inspection-intelligence" }
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
        version: "1.0.3",
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
        metadata: { version: "1.0.3", engine: "inspection-intelligence" }
      })
    };
  }
};
