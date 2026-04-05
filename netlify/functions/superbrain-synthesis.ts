// ============================================================================
// DEPLOY112 — SUPERBRAIN SYNTHESIS
// Single GPT-4o call → All Five Magic Features + Action Card + Reviewer Brief
// Every claim constrained by decision-core v2.3 JSON — no hallucination
// ============================================================================
// NETLIFY FUNCTION CONSTRAINTS:
//   - String concatenation only (no template literals)
//   - var declarations only
//   - var handler = async function(event) export pattern
//   - All logic inlined, no lib/ imports
// ============================================================================

var handler = async function(event) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: headers,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var decisionCore = body.decision_core;
    var transcript = body.transcript || "";

    if (!decisionCore) {
      return {
        statusCode: 400,
        headers: headers,
        body: JSON.stringify({ error: "Missing decision_core in request body" })
      };
    }

    // ======================================================================
    // BUILD CONSTRAINED SYSTEM PROMPT
    // ======================================================================
    // The system prompt locks GPT-4o to decision-core data ONLY.
    // Every claim must trace to a specific field in the JSON.
    // No external knowledge. No hallucination. No invention.
    // ======================================================================

    var systemPrompt = [
      "You are the FORGED Superbrain Synthesis Engine.",
      "You receive a decision-core JSON output and the original field transcript.",
      "Your job: produce ALL five intelligence features plus supporting outputs.",
      "",
      "ABSOLUTE RULES:",
      "1. Every claim you make MUST trace to a specific field in the decision-core JSON.",
      "2. You MUST NOT invent data, codes, thresholds, or physics not present in the JSON.",
      "3. You MUST NOT reference external knowledge — only decision-core data.",
      "4. If the decision-core does not contain enough data for a feature, say so explicitly.",
      "5. Tag every claim with its source field path (e.g. 'physical_reality.material_class').",
      "",
      "DECISION-CORE FIELD MAP (use these paths in evidence_trace):",
      "  physical_reality: asset_class, material_class, material_group, material_subgroup,",
      "    environment, temperature_range, operating_conditions, geometry, stress_state",
      "  damage_reality: primary_mechanism, secondary_mechanisms, damage_morphology,",
      "    flaw_type, flaw_location, severity_factors, enabling_conditions,",
      "    hydrogen_damage_flags, environmental_flags",
      "  consequence_reality: consequence_class, urgency, failure_mode,",
      "    safety_impact, environmental_impact, production_impact",
      "  authority_reality: primary_code, applicable_codes, acceptance_criteria,",
      "    ffs_required, code_limitations, regulatory_requirements",
      "  inspection_reality: recommended_methods, inspection_interval,",
      "    coverage_requirements, sensitivity_requirements, technique_notes",
      "  decision_reality: disposition, accept_reject, confidence_level,",
      "    limiting_factor, decision_basis, conditions, hold_points",
      "  physics_computations: fad_position, remaining_life_fraction,",
      "    threshold_proximity, critical_size, growth_rate, gate_status,",
      "    safety_factor, stress_ratio, toughness_ratio",
      "  context_inferred: (array of inferences made from industrial context)",
      "",
      "OUTPUT FORMAT — respond with ONLY valid JSON, no markdown, no preamble:",
      "{",
      "  \"failure_narrative\": \"Physics-traced narrative. Every sentence backed by DC data. Written as a technical report paragraph. References specific mechanisms, materials, conditions from decision-core.\",",
      "",
      "  \"contradiction_matrix\": [",
      "    {",
      "      \"framework\": \"Code or standard name from authority_reality\",",
      "      \"verdict\": \"ACCEPT or REJECT per that code\",",
      "      \"basis\": \"What the code evaluates\",",
      "      \"limitation\": \"What the code does NOT evaluate\",",
      "      \"gap_reason\": \"Why physics may disagree with code verdict\"",
      "    }",
      "  ],",
      "",
      "  \"pre_inspection_briefing\": {",
      "    \"target_zones\": [\"Where to focus inspection based on damage_reality + physical_reality\"],",
      "    \"expected_flaws\": [\"Flaw morphology expected based on primary/secondary mechanisms\"],",
      "    \"method_recommendations\": [\"From inspection_reality.recommended_methods with rationale\"],",
      "    \"sensitivity_settings\": \"From inspection_reality.sensitivity_requirements\",",
      "    \"watch_items\": [\"Things that change the assessment if found\"]",
      "  },",
      "",
      "  \"procedure_forensics\": {",
      "    \"likely_causes\": [\"Root cause chain from damage_reality back to operating conditions\"],",
      "    \"procedural_gaps\": [\"What procedure or parameter was insufficient\"],",
      "    \"reverse_inference_chain\": [\"Step-by-step: observed flaw -> mechanism -> enabling condition -> procedural gap\"]",
      "  },",
      "",
      "  \"live_physics_state\": {",
      "    \"fad_position\": \"From physics_computations.fad_position or state NOT CALCULATED\",",
      "    \"remaining_life\": \"From physics_computations.remaining_life_fraction or NOT CALCULATED\",",
      "    \"threshold_proximity\": \"From physics_computations.threshold_proximity or NOT CALCULATED\",",
      "    \"gate_status\": \"From physics_computations.gate_status or array of gate states\",",
      "    \"critical_values\": \"Any critical thresholds from physics_computations\"",
      "  },",
      "",
      "  \"inspector_action_card\": [",
      "    {",
      "      \"step\": \"Specific action the inspector should take\",",
      "      \"rationale\": \"Why — traced to decision_reality or inspection_reality\",",
      "      \"threshold_if_positive\": \"What happens if this finding is confirmed\",",
      "      \"threshold_if_negative\": \"What happens if this finding is NOT confirmed\"",
      "    }",
      "  ],",
      "",
      "  \"reviewer_brief\": \"Concise summary for engineering reviewer. Evidence-aware, threshold-aware. References disposition from decision_reality, limiting factors, and key uncertainties. 3-5 sentences.\",",
      "",
      "  \"evidence_trace\": [",
      "    {",
      "      \"claim\": \"A specific claim made in any feature above\",",
      "      \"source_field\": \"decision-core field path (e.g. damage_reality.primary_mechanism)\",",
      "      \"confidence\": \"HIGH / MEDIUM / LOW based on data completeness\",",
      "      \"claim_class\": \"OBSERVED | INFERRED | CALCULATED | PREDICTED\"",
      "    }",
      "  ]",
      "}",
      "",
      "QUALITY REQUIREMENTS:",
      "- failure_narrative: minimum 4 sentences, maximum 8. Technical prose, not bullets.",
      "- contradiction_matrix: one entry per applicable code from authority_reality.",
      "- pre_inspection_briefing: actionable for a Level II technician arriving on site.",
      "- procedure_forensics: reverse-engineer from the flaw to the root procedural cause.",
      "- live_physics_state: if physics_computations fields are empty, state NOT CALCULATED.",
      "- inspector_action_card: 3-6 ranked steps. Most decision-changing action first.",
      "- reviewer_brief: written for an engineering manager. No jargon without definition.",
      "- evidence_trace: minimum 5 entries covering the most critical claims across features."
    ].join("\n");

    // ======================================================================
    // BUILD USER PROMPT WITH DECISION-CORE DATA
    // ======================================================================

    var userPrompt = [
      "FIELD TRANSCRIPT:",
      "---",
      transcript,
      "---",
      "",
      "DECISION-CORE OUTPUT (v2.3):",
      "---",
      JSON.stringify(decisionCore, null, 2),
      "---",
      "",
      "Produce the complete Superbrain Synthesis output.",
      "Every claim must trace to the decision-core JSON above.",
      "Respond with ONLY the JSON object. No markdown. No preamble."
    ].join("\n");

    // ======================================================================
    // SINGLE GPT-4o CALL
    // ======================================================================

    var openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return {
        statusCode: 500,
        headers: headers,
        body: JSON.stringify({ error: "OPENAI_API_KEY not configured" })
      };
    }

    var openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + openaiKey
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.2,
        max_tokens: 4000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!openaiResponse.ok) {
      var errText = await openaiResponse.text();
      return {
        statusCode: 502,
        headers: headers,
        body: JSON.stringify({
          error: "OpenAI API error",
          status: openaiResponse.status,
          detail: errText
        })
      };
    }

    var openaiData = await openaiResponse.json();
    var rawContent = openaiData.choices
      && openaiData.choices[0]
      && openaiData.choices[0].message
      && openaiData.choices[0].message.content;

    if (!rawContent) {
      return {
        statusCode: 502,
        headers: headers,
        body: JSON.stringify({ error: "Empty response from OpenAI" })
      };
    }

    // ======================================================================
    // PARSE AND VALIDATE OUTPUT
    // ======================================================================

    var synthesis;
    try {
      synthesis = JSON.parse(rawContent);
    } catch (parseErr) {
      return {
        statusCode: 502,
        headers: headers,
        body: JSON.stringify({
          error: "Failed to parse GPT-4o response as JSON",
          raw: rawContent.substring(0, 500)
        })
      };
    }

    // Validate required fields exist
    var requiredFields = [
      "failure_narrative",
      "contradiction_matrix",
      "pre_inspection_briefing",
      "procedure_forensics",
      "live_physics_state",
      "inspector_action_card",
      "reviewer_brief",
      "evidence_trace"
    ];

    var missingFields = [];
    for (var i = 0; i < requiredFields.length; i++) {
      if (!synthesis[requiredFields[i]]) {
        missingFields.push(requiredFields[i]);
      }
    }

    if (missingFields.length > 0) {
      return {
        statusCode: 502,
        headers: headers,
        body: JSON.stringify({
          error: "GPT-4o response missing required fields",
          missing: missingFields,
          partial: synthesis
        })
      };
    }

    // ======================================================================
    // ADD METADATA AND RETURN
    // ======================================================================

    var result = {
      superbrain_version: "1.0",
      engine_version: "decision-core-v2.3",
      timestamp: new Date().toISOString(),
      token_usage: openaiData.usage || null,
      synthesis: synthesis
    };

    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify(result)
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({
        error: "Superbrain synthesis failed",
        message: err.message || String(err)
      })
    };
  }
};

module.exports = { handler: handler };
