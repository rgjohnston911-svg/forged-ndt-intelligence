// ============================================================================
// DEPLOY114 — SUPERBRAIN SYNTHESIS v1.1
// Single GPT-4o call → All Five Magic Features + Action Card + Reviewer Brief
// Every claim constrained by decision-core v2.3 JSON — no hallucination
// v1.1: Field map corrected to match actual decision-core v2.3 output structure
//   FIX 1: physics_computations — was fad_position/remaining_life_fraction/gate_status (non-existent)
//          now fatigue.days_to_critical, wall_loss.remaining_life_years, critical_flaw.stress_ratio, leak_vs_burst.tendency
//   FIX 2: decision_reality — was accept_reject/confidence_level/hold_points (non-existent)
//          now disposition/disposition_basis/gates/guided_recovery/hard_locks/decision_trace
//   FIX 3: inspection_reality — was recommended_methods/inspection_interval/technique_notes (non-existent)
//          now proposed_methods/recommended_package/best_method/sufficiency_verdict/missing_coverage
//   FIX 4: authority_reality — was primary_code/applicable_codes/ffs_required (non-existent)
//          now primary_authority/secondary_authorities/conditional_authorities/code_gaps/physics_code_alignment
//   FIX 5: damage_reality — was secondary_mechanisms/damage_morphology/flaw_type (non-existent)
//          now validated_mechanisms/rejected_mechanisms/primary_mechanism/mechanism_count/physics_narrative
//   FIX 6: Added reality_confidence to field map (was missing entirely)
//   FIX 7: evidence_trace minimum raised from 5 to 8 entries
//   FIX 8: Added trace_warnings validation — checks evidence_trace paths against DC prefixes
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
    // BUILD CONSTRAINED SYSTEM PROMPT — v1.1
    // Field map corrected to match actual decision-core v2.3 output
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
      "5. Tag every claim with its source field path (e.g. 'damage_reality.primary_mechanism.name').",
      "",
      "DECISION-CORE FIELD MAP (use these EXACT paths in evidence_trace):",
      "",
      "  physical_reality:",
      "    stress: { primary_load_types[], cyclic_loading, cyclic_source, stress_concentration_present,",
      "      stress_concentration_locations[], tensile_stress, compressive_stress,",
      "      load_path_criticality, residual_stress_likely }",
      "    thermal: { operating_temp_c, operating_temp_f, thermal_cycling, fire_exposure,",
      "      fire_duration_min, creep_range, cryogenic }",
      "    chemical: { corrosive_environment, environment_agents[], h2s_present, co2_present,",
      "      chlorides_present, caustic_present, hydrogen_present, material_susceptibility[],",
      "      coating_intact, sour_service }",
      "    energy: { pressure_cycling, vibration, impact_event, impact_description,",
      "      flow_erosion_risk, cavitation, stored_energy_significant }",
      "    time: { service_years, cycles_estimated, time_since_inspection_years }",
      "    field_interaction: (object — describes how physics fields interact)",
      "    physics_summary: (string — narrative summary of physical state)",
      "    context_inferred: [ { field, inferred, basis } ] — inferences from industrial context",
      "",
      "  damage_reality:",
      "    validated_mechanisms: [ { id, name, physics_basis, preconditions_met[],",
      "      reality_state (confirmed|probable|possible|unverified), reality_score,",
      "      evidence_for[], evidence_against[], severity } ]",
      "    rejected_mechanisms: [ { id, name, rejection_reason, missing_precondition } ]",
      "    primary_mechanism: { id, name, physics_basis, reality_state, reality_score,",
      "      evidence_for[], evidence_against[], severity }",
      "    mechanism_count: { validated, rejected, confirmed, probable, possible, unverified }",
      "    damage_confidence: (number 0-1)",
      "    physics_narrative: (string — damage mechanism narrative)",
      "",
      "  consequence_reality:",
      "    consequence_tier: (CRITICAL|HIGH|ELEVATED|MODERATE|LOW)",
      "    failure_mode: (string — how it would fail)",
      "    failure_physics: (string — physics of failure)",
      "    consequence_basis: (string — why this tier)",
      "    human_impact, environmental_impact, operational_impact: (strings)",
      "    enforcement_requirements: (string or array)",
      "    damage_state, degradation_certainty: (strings)",
      "    damage_trajectory: (string — where damage is heading)",
      "    threshold_score: (number), threshold_reasons: (array)",
      "    monitoring_urgency: (string)",
      "",
      "  authority_reality:",
      "    primary_authority: (string — primary code e.g. 'API 570 + ASME B31.3')",
      "    secondary_authorities: [ strings ]",
      "    conditional_authorities: [ { code, cond } ]",
      "    physics_code_alignment: (string — FULL|PARTIAL|MISALIGNED + explanation)",
      "    code_gaps: [ strings — what codes do NOT cover ]",
      "    design_state_warning: (string or null)",
      "    authority_confidence: (number 0-1)",
      "",
      "  inspection_reality:",
      "    proposed_methods: [ strings ]",
      "    recommended_package: (string — full inspection package description)",
      "    method_assessments: (object — per-method analysis)",
      "    all_method_scores: (object — scored methods)",
      "    best_method: { method, overall_score, verdict, scores: { detection, sizing,",
      "      coverage, reliability }, reasons_for[], reasons_against[],",
      "      blind_spots[], complementary_methods[] }",
      "    sufficiency_verdict: (string — SUFFICIENT|INSUFFICIENT + explanation)",
      "    physics_reason: (string — physics basis for inspection approach)",
      "    required_methods: [ strings ]",
      "    missing_coverage: [ strings — gaps in inspection coverage ]",
      "    constraint_analysis: (object — access/cost/time constraints)",
      "    inspection_confidence: (number 0-1)",
      "",
      "  physics_computations:",
      "    fatigue: { enabled, delta_k, growth_per_cycle_m, days_to_critical, status, narrative }",
      "    critical_flaw: { enabled, critical_depth_mm, stress_ratio, status, narrative }",
      "    wall_loss: { enabled, remaining_life_years, severity_ratio, status, narrative }",
      "    leak_vs_burst: { enabled, tendency (LEAK_BEFORE_BREAK|BURST_FAVORED|",
      "      UNSTABLE_FRACTURE|PLASTIC_COLLAPSE), through_wall_risk, fracture_risk, narrative }",
      "",
      "  reality_confidence:",
      "    physics_confidence, damage_confidence, consequence_confidence,",
      "    authority_confidence, inspection_confidence: (numbers 0-1)",
      "    overall: (number 0-1), band: (HIGH|MODERATE|LOW)",
      "    certainty_state: (string), decision_lock: (boolean)",
      "    escalation_required: (boolean)",
      "    limiting_factors: [ strings ]",
      "    contradiction_flags: [ strings ]",
      "    confidence_narrative: (string)",
      "",
      "  decision_reality:",
      "    disposition: (string — ACCEPT|REJECT|CONDITIONAL_HOLD|MONITOR|IMMEDIATE_ACTION)",
      "    disposition_basis: (string — why this disposition)",
      "    gates: [ { gate, result (PASS|FAIL|PENDING|UNKNOWN), reason, required_action } ]",
      "    guided_recovery: [ { priority, action, physics_reason, who } ]",
      "    phased_strategy: [ { phase, name, objective, actions[], gate, time_frame } ]",
      "    hard_locks: [ { code, reason, disposition, physics_basis } ]",
      "    decision_trace: [ strings — decision chain ]",
      "",
      "OUTPUT FORMAT — respond with ONLY valid JSON, no markdown, no preamble:",
      "{",
      "  \"failure_narrative\": \"Physics-traced narrative. Every sentence backed by DC data. Written as a technical report paragraph. References specific mechanisms, materials, conditions from decision-core. Cite field paths in parentheses.\",",
      "",
      "  \"contradiction_matrix\": [",
      "    {",
      "      \"framework\": \"Code name from authority_reality.primary_authority or secondary_authorities\",",
      "      \"verdict\": \"ACCEPT or REJECT per that code\",",
      "      \"basis\": \"What the code evaluates\",",
      "      \"limitation\": \"What the code does NOT evaluate — reference authority_reality.code_gaps\",",
      "      \"gap_reason\": \"Why physics may disagree — reference authority_reality.physics_code_alignment\"",
      "    }",
      "  ],",
      "",
      "  \"pre_inspection_briefing\": {",
      "    \"target_zones\": [\"Where to focus — derived from damage_reality + physical_reality.stress\"],",
      "    \"expected_flaws\": [\"Flaw morphology from damage_reality.validated_mechanisms\"],",
      "    \"method_recommendations\": [\"From inspection_reality.proposed_methods and best_method with rationale\"],",
      "    \"sensitivity_settings\": \"From inspection_reality.best_method.scores or sufficiency_verdict\",",
      "    \"watch_items\": [\"From inspection_reality.missing_coverage and reality_confidence.limiting_factors\"]",
      "  },",
      "",
      "  \"procedure_forensics\": {",
      "    \"likely_causes\": [\"Root cause chain from damage_reality.primary_mechanism back to physical_reality conditions\"],",
      "    \"procedural_gaps\": [\"What procedure or parameter was insufficient — from inspection_reality.missing_coverage and authority_reality.code_gaps\"],",
      "    \"reverse_inference_chain\": [\"Step-by-step: observed flaw -> mechanism -> enabling condition -> procedural gap\"]",
      "  },",
      "",
      "  \"live_physics_state\": {",
      "    \"fad_position\": \"From physics_computations.critical_flaw.stress_ratio or state NOT CALCULATED if critical_flaw.enabled is false\",",
      "    \"remaining_life\": \"From physics_computations.wall_loss.remaining_life_years or NOT CALCULATED if wall_loss.enabled is false\",",
      "    \"threshold_proximity\": \"From physics_computations.critical_flaw.stress_ratio and wall_loss.severity_ratio or NOT CALCULATED\",",
      "    \"gate_status\": \"From decision_reality.gates — summarize each gate result\",",
      "    \"critical_values\": \"From physics_computations: critical_flaw.critical_depth_mm, fatigue.days_to_critical, leak_vs_burst.tendency + fracture_risk\"",
      "  },",
      "",
      "  \"inspector_action_card\": [",
      "    {",
      "      \"step\": \"Specific action — derived from decision_reality.guided_recovery\",",
      "      \"rationale\": \"Why — traced to decision_reality.gates or inspection_reality.missing_coverage\",",
      "      \"threshold_if_positive\": \"What happens if this finding is confirmed — how does disposition change\",",
      "      \"threshold_if_negative\": \"What happens if this finding is NOT confirmed — how does disposition change\"",
      "    }",
      "  ],",
      "",
      "  \"reviewer_brief\": \"Concise summary for engineering reviewer. Reference decision_reality.disposition, decision_reality.disposition_basis, reality_confidence.limiting_factors, and consequence_reality.consequence_tier. 3-5 sentences.\",",
      "",
      "  \"evidence_trace\": [",
      "    {",
      "      \"claim\": \"A specific claim made in any feature above\",",
      "      \"source_field\": \"Exact decision-core field path (e.g. damage_reality.primary_mechanism.name, physics_computations.wall_loss.status, decision_reality.gates[0].result)\",",
      "      \"confidence\": \"HIGH / MEDIUM / LOW based on data completeness\",",
      "      \"claim_class\": \"OBSERVED | INFERRED | CALCULATED | PREDICTED\"",
      "    }",
      "  ]",
      "}",
      "",
      "QUALITY REQUIREMENTS:",
      "- failure_narrative: minimum 4 sentences, maximum 8. Technical prose, not bullets.",
      "- contradiction_matrix: one entry per authority from authority_reality (primary + secondary + conditional).",
      "- pre_inspection_briefing: actionable for a Level II technician arriving on site.",
      "- procedure_forensics: reverse-engineer from the flaw to the root procedural cause.",
      "- live_physics_state: if a physics_computations sub-engine has enabled=false or status=insufficient_input, state NOT CALCULATED for that value.",
      "- inspector_action_card: 3-6 ranked steps from decision_reality.guided_recovery. Most decision-changing action first.",
      "- reviewer_brief: written for an engineering manager. No jargon without definition.",
      "- evidence_trace: minimum 8 entries covering the most critical claims across ALL features. Use exact dot-notation field paths."
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
      "Use EXACT field paths from the JSON in your evidence_trace entries.",
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
    // VALIDATE EVIDENCE TRACE FIELD PATHS — v1.1
    // Check that source_field entries reference actual DC field paths
    // ======================================================================

    var validPrefixes = [
      "physical_reality", "damage_reality", "consequence_reality",
      "authority_reality", "inspection_reality", "decision_reality",
      "physics_computations", "reality_confidence", "context_inferred"
    ];
    var traceWarnings = [];
    if (synthesis.evidence_trace && Array.isArray(synthesis.evidence_trace)) {
      for (var ti = 0; ti < synthesis.evidence_trace.length; ti++) {
        var et = synthesis.evidence_trace[ti];
        if (et.source_field) {
          var pathValid = false;
          for (var pi = 0; pi < validPrefixes.length; pi++) {
            if (et.source_field.indexOf(validPrefixes[pi]) === 0) {
              pathValid = true;
              break;
            }
          }
          if (!pathValid) {
            traceWarnings.push("evidence_trace[" + ti + "].source_field '" + et.source_field + "' does not match any DC field prefix");
          }
        }
      }
    }

    // ======================================================================
    // ADD METADATA AND RETURN
    // ======================================================================

    var result = {
      superbrain_version: "1.1",
      engine_version: "decision-core-v2.3",
      timestamp: new Date().toISOString(),
      token_usage: openaiData.usage || null,
      trace_warnings: traceWarnings.length > 0 ? traceWarnings : null,
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
