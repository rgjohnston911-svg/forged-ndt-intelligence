// ============================================================================
// DEPLOY170.2 — SUPERBRAIN SYNTHESIS v1.2
// ============================================================================
// Backend constraint hardening. Closes two GPT coker eval findings:
//   (1) Narrative contradicting FMD governing mode
//   (2) Contradiction matrix accepting irrelevant frameworks (e.g. B31.1 for
//       refinery process piping)
//
// ROOT CAUSE (identified during planning):
//   Superbrain v1.1 was never given access to the Build 1+2+3 engine outputs
//   (ALR, RSR, FMD, DPR, FTR, PAR). It synthesized narrative from decision-
//   core internals only. FMD governing mode and ALR locked chain were
//   computed, displayed in the report, and then thrown away before synthesis.
//   The narrative and contradiction matrix drifted because the authoritative
//   data was not in superbrain's context window.
//
// FIX (this deploy):
//   1. Accept optional engine fields in request body (FMD, ALR, RSR, DPR,
//      FTR, PAR). All optional, all default to null. Behaves exactly like
//      v1.1 when called without the new fields -- no breaking change.
//   2. Expanded field map in system prompt documents the engine outputs.
//   3. Conditional FMD GOVERNING MODE OVERRIDE block injected when FMD is
//      present with a non-NONE governing mode. Forces narrative to frame
//      around the governing mode in its first sentence.
//   4. Conditional CONTRADICTION MATRIX SCOPE RULE injected when ALR is
//      present with at least one authority_chain entry. Requires matrix
//      to contain one entry per ALR code and nothing else.
//   5. Post-response narrative safety net -- if GPT still fails to name
//      FMD governing mode in first 300 chars of failure_narrative, a
//      correction sentence is prepended automatically. narrative_corrected
//      flag reported in metadata.
//   6. Post-response contradiction_matrix filter -- drops any entry whose
//      framework does not fuzzy-match an ALR code. Reports removed entries
//      in metadata.
//
// Plus version bumps: superbrain v1.1 -> v1.2, engine ref v2.3 -> v2.5.4,
// new synthesis_constraint_version field in output metadata.
//
// FRONTEND COORDINATION:
//   Frontend v16.6k (DEPLOY170.1) still sends only { decision_core, transcript }.
//   This backend change is defensive -- engine fields default to null and
//   the conditional prompt blocks only activate when the data is present.
//   DEPLOY170.3 will be a tiny frontend patch that starts passing the
//   engine results. Until that ships, this backend behaves identically to
//   v1.1 in production (same output quality, new metadata fields only).
//
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

    // DEPLOY170.2: optional engine fields, all default to null.
    // Frontend may or may not send these; backend handles both cases.
    var fmd = body.failure_mode_dominance || null;
    var alr = body.authority_lock || null;
    var rsr = body.remaining_strength || null;
    var dpr = body.disposition_pathway || null;
    var ftr = body.failure_timeline || null;
    var par = body.photo_analysis || null;

    if (!decisionCore) {
      return {
        statusCode: 400,
        headers: headers,
        body: JSON.stringify({ error: "Missing decision_core in request body" })
      };
    }

    var anyEngine = !!(alr || rsr || fmd || dpr || ftr || par);
    var fmdGoverningPresent = fmd && fmd.governing_failure_mode && fmd.governing_failure_mode !== "NONE";
    var alrScopePresent = alr && alr.authority_chain && alr.authority_chain.length > 0;

    // ======================================================================
    // BASE SYSTEM PROMPT (decision-core field map, preserved from v1.1)
    // ======================================================================

    var basePrompt = [
      "You are the FORGED Superbrain Synthesis Engine.",
      "You receive a decision-core JSON output, engine results from the deterministic Build 1+2+3 engines, and the original field transcript.",
      "Your job: produce all five intelligence features plus supporting outputs.",
      "",
      "ABSOLUTE RULES:",
      "1. Every claim you make MUST trace to a specific field in the provided JSON.",
      "2. You MUST NOT invent data, codes, thresholds, or physics not present in the JSON.",
      "3. You MUST NOT reference external knowledge -- only the data provided.",
      "4. If the data does not contain enough information for a feature, say so explicitly.",
      "5. Tag every claim with its exact source field path (e.g. 'damage_reality.primary_mechanism.name' or 'failure_mode_dominance.governing_failure_mode').",
      "6. When engine results are provided, they are AUTHORITATIVE and outrank decision-core internal reasoning where they conflict.",
      "",
      "DECISION-CORE FIELD MAP (use these EXACT paths in evidence_trace):",
      "",
      "  physical_reality:",
      "    stress: { primary_load_types[], cyclic_loading, cyclic_source, stress_concentration_present,",
      "      stress_concentration_locations[], tensile_stress, compressive_stress, load_path_criticality, residual_stress_likely }",
      "    thermal: { operating_temp_c, operating_temp_f, thermal_cycling, fire_exposure, fire_duration_min, creep_range, cryogenic }",
      "    chemical: { corrosive_environment, environment_agents[], h2s_present, co2_present, chlorides_present, caustic_present,",
      "      hydrogen_present, material_susceptibility[], coating_intact, sour_service }",
      "    energy: { pressure_cycling, vibration, impact_event, impact_description, flow_erosion_risk, cavitation, stored_energy_significant }",
      "    time: { service_years, cycles_estimated, time_since_inspection_years }",
      "    field_interaction: (object), physics_summary: (string), context_inferred: [ { field, inferred, basis } ]",
      "",
      "  damage_reality:",
      "    validated_mechanisms: [ { id, name, physics_basis, preconditions_met[],",
      "      reality_state (confirmed|probable|possible|unverified), reality_score, evidence_for[], evidence_against[], severity } ]",
      "    rejected_mechanisms: [ { id, name, rejection_reason, missing_precondition } ]",
      "    primary_mechanism: { id, name, physics_basis, reality_state, reality_score, evidence_for[], evidence_against[], severity }",
      "    mechanism_count: { validated, rejected, confirmed, probable, possible, unverified }",
      "    damage_confidence: (number 0-1), physics_narrative: (string)",
      "",
      "  consequence_reality:",
      "    consequence_tier: (CRITICAL|HIGH|ELEVATED|MODERATE|LOW)",
      "    failure_mode, failure_physics, consequence_basis, human_impact, environmental_impact, operational_impact",
      "    enforcement_requirements, damage_state, degradation_certainty, damage_trajectory",
      "    threshold_score, threshold_reasons[], monitoring_urgency",
      "",
      "  authority_reality:",
      "    primary_authority, secondary_authorities[], conditional_authorities[]",
      "    physics_code_alignment, code_gaps[], design_state_warning, authority_confidence",
      "",
      "  inspection_reality:",
      "    proposed_methods[], recommended_package, method_assessments, all_method_scores",
      "    best_method: { method, overall_score, verdict, scores { detection, sizing, coverage, reliability },",
      "      reasons_for[], reasons_against[], blind_spots[], complementary_methods[] }",
      "    sufficiency_verdict, physics_reason, required_methods[], missing_coverage[], constraint_analysis, inspection_confidence",
      "",
      "  physics_computations:",
      "    fatigue: { enabled, delta_k, growth_per_cycle_m, days_to_critical, status, narrative }",
      "    critical_flaw: { enabled, critical_depth_mm, stress_ratio, status, narrative }",
      "    wall_loss: { enabled, remaining_life_years, severity_ratio, status, narrative }",
      "    leak_vs_burst: { enabled, tendency (LEAK_BEFORE_BREAK|BURST_FAVORED|UNSTABLE_FRACTURE|PLASTIC_COLLAPSE),",
      "      through_wall_risk, fracture_risk, narrative }",
      "",
      "  reality_confidence:",
      "    physics_confidence, damage_confidence, consequence_confidence, authority_confidence, inspection_confidence",
      "    overall, band (HIGH|MODERATE|LOW), certainty_state, decision_lock, escalation_required",
      "    limiting_factors[], contradiction_flags[], confidence_narrative",
      "",
      "  decision_reality:",
      "    disposition, disposition_basis",
      "    gates: [ { gate, result (PASS|FAIL|PENDING|UNKNOWN), reason, required_action } ]",
      "    guided_recovery: [ { priority, action, physics_reason, who } ]",
      "    phased_strategy: [ { phase, name, objective, actions[], gate, time_frame } ]",
      "    hard_locks: [ { code, reason, disposition, physics_basis } ]",
      "    decision_trace: [ strings ]"
    ].join("\n");

    // ======================================================================
    // DEPLOY170.2: ENGINE RESULTS FIELD MAP (conditional, only present engines)
    // ======================================================================

    var enginePrompt = "";
    if (anyEngine) {
      var engineLines = [
        "",
        "============================================================",
        "BUILD 1+2+3 ENGINE RESULTS FIELD MAP",
        "============================================================",
        "These are deterministic engine outputs. They are AUTHORITATIVE.",
        "When they conflict with decision-core internal fields, engine outputs win.",
        ""
      ];

      if (alr) {
        engineLines.push("  authority_lock (ALR):");
        engineLines.push("    status (LOCKED|PARTIAL|UNLOCKED), confidence");
        engineLines.push("    authority_chain: [ { code, title, role, description } ]   <- PRIMARY codes");
        engineLines.push("    supplemental_codes: [ { code, title, role, description } ] <- SECONDARY codes");
        engineLines.push("    lock_reasons[], trigger_b31g, trigger_crack_assessment, trigger_sour_service");
        engineLines.push("");
      }
      if (rsr) {
        engineLines.push("  remaining_strength (RSR):");
        engineLines.push("    data_quality, safe_envelope (WITHIN|MARGINAL|EXCEEDS), severity_tier");
        engineLines.push("    governing_maop, governing_method, operating_pressure, operating_ratio, pressure_reduction_required");
        engineLines.push("    calculations: { wall_loss_percent, folias_factor, b31g_folias_factor, ... }");
        engineLines.push("    recommendation, derivation_notes[]");
        engineLines.push("");
      }
      if (fmd) {
        engineLines.push("  failure_mode_dominance (FMD):");
        engineLines.push("    governing_failure_mode (STRUCTURAL_INSTABILITY|CRACKING|CORROSION|COMPOUND|NONE)");
        engineLines.push("    governing_severity (LOW|MODERATE|HIGH|CRITICAL), governing_failure_pressure, governing_code_reference");
        engineLines.push("    governing_basis (string -- WHY this is governing)");
        engineLines.push("    structural_path: { active, capacity_loss_state, indicators, assessment_method, mechanisms }");
        engineLines.push("    corrosion_path: { active, severity, failure_pressure, wall_loss_percent }");
        engineLines.push("    cracking_path: { active, severity, brittle_fracture_risk }");
        engineLines.push("    interaction_flag, interaction_type, interaction_detail");
        engineLines.push("");
      }
      if (dpr) {
        engineLines.push("  disposition_pathway (DPR):");
        engineLines.push("    disposition (IMMEDIATE_ACTION|HOLD_FOR_DATA|ENGINEERING_ASSESSMENT|MONITOR|CONTINUE_SERVICE)");
        engineLines.push("    urgency, interval, disposition_basis");
        engineLines.push("    actions: [ { priority, action, timeframe, detail } ]");
        engineLines.push("    conditions, temporary_controls, escalation_triggers");
        engineLines.push("");
      }
      if (ftr) {
        engineLines.push("  failure_timeline (FTR):");
        engineLines.push("    governing_failure_mode, governing_time_years, governing_basis, urgency, recommended_inspection_interval_years");
        engineLines.push("    progression_state (unstable_critical|accelerating|active_likely|active_possible|stable_known|dormant_possible|insufficient_data)");
        engineLines.push("    progression_state_basis");
        engineLines.push("    corrosion_timeline: { enabled, method, corrosion_rate_mpy, confidence, remaining_life_years, retirement_wall }");
        engineLines.push("    crack_timeline: { enabled, ... }");
        engineLines.push("");
      }
      if (par) {
        engineLines.push("  photo_analysis (PAR):");
        engineLines.push("    image_quality, analysis: { asset_identification, material_degradation_severity, ... }");
        engineLines.push("    transcript_addendum");
        engineLines.push("");
      }
      enginePrompt = engineLines.join("\n");
    }

    // ======================================================================
    // DEPLOY170.2: FMD GOVERNING MODE OVERRIDE BLOCK (conditional)
    // ======================================================================

    var fmdOverridePrompt = "";
    if (fmdGoverningPresent) {
      var govModeLabel = String(fmd.governing_failure_mode).replace(/_/g, " ").toUpperCase();
      var govSeverity = fmd.governing_severity ? String(fmd.governing_severity) : "not stated";
      var govBasis = fmd.governing_basis ? String(fmd.governing_basis) : "see failure_mode_dominance.governing_basis";

      fmdOverridePrompt = [
        "",
        "============================================================",
        "FMD GOVERNING MODE OVERRIDE -- ABSOLUTE RULE",
        "============================================================",
        "The Failure Mode Dominance engine has determined the governing failure mode:",
        "",
        "  GOVERNING FAILURE MODE: " + govModeLabel,
        "  GOVERNING SEVERITY: " + govSeverity,
        "  GOVERNING BASIS: " + govBasis,
        "",
        "This is the authoritative deterministic result. Your failure_narrative MUST:",
        "",
        "1. Name " + govModeLabel + " as the governing concern in the FIRST sentence of failure_narrative.",
        "2. Frame the entire analysis around " + govModeLabel + " as the primary concern.",
        "3. If damage_reality.primary_mechanism differs from " + govModeLabel + ", describe damage_reality.primary_mechanism",
        "   as a CONTRIBUTING or SECONDARY mechanism, NOT as the primary.",
        "4. Do NOT describe any mechanism other than " + govModeLabel + " as the 'primary mechanism of concern'.",
        "5. Cite failure_mode_dominance.governing_failure_mode and failure_mode_dominance.governing_basis in evidence_trace.",
        "",
        "The FMD engine outranks decision-core internal damage reasoning. When they disagree, FMD wins."
      ].join("\n");
    }

    // ======================================================================
    // DEPLOY170.2: CONTRADICTION MATRIX SCOPE RULE (conditional)
    // ======================================================================

    var alrScopePrompt = "";
    if (alrScopePresent) {
      var scopeLines = [
        "",
        "============================================================",
        "CONTRADICTION MATRIX SCOPE RULE -- ABSOLUTE",
        "============================================================",
        "The Authority Lock engine has locked the authority chain for this case.",
        "",
        "LOCKED PRIMARY AUTHORITIES:"
      ];
      for (var aci = 0; aci < alr.authority_chain.length; aci++) {
        var ac = alr.authority_chain[aci] || {};
        var acId = ac.code || ac.standard || ac.name || ac.id || ac.title || "(unnamed)";
        var acTitle = ac.title || ac.description || ac.full_name || "";
        var acRole = ac.role || ac.purpose || ac.applicability || "";
        var line = "  - " + acId;
        if (acTitle && acTitle !== acId) line = line + " (" + acTitle + ")";
        if (acRole) line = line + " [" + acRole + "]";
        scopeLines.push(line);
      }
      if (alr.supplemental_codes && alr.supplemental_codes.length > 0) {
        scopeLines.push("");
        scopeLines.push("SUPPLEMENTAL CODES:");
        for (var sci = 0; sci < alr.supplemental_codes.length; sci++) {
          var sc = alr.supplemental_codes[sci] || {};
          var scId = sc.code || sc.standard || sc.name || sc.id || sc.title || "(unnamed)";
          var scTitle = sc.title || sc.description || sc.full_name || "";
          var scRole = sc.role || sc.purpose || sc.applicability || "";
          var sline = "  - " + scId;
          if (scTitle && scTitle !== scId) sline = sline + " (" + scTitle + ")";
          if (scRole) sline = sline + " [" + scRole + "]";
          scopeLines.push(sline);
        }
      }
      scopeLines.push("");
      scopeLines.push("contradiction_matrix MUST contain ONE entry per code listed above and NOTHING ELSE.");
      scopeLines.push("");
      scopeLines.push("1. Do NOT include any framework not in the locked authority chain or supplemental codes.");
      scopeLines.push("2. Do NOT include ASME B31.1 unless it appears above. B31.1 is power piping and does NOT apply to");
      scopeLines.push("   refinery process piping or pressure vessels.");
      scopeLines.push("3. Do NOT include generic framework names like 'ASME Section V' unless they appear above.");
      scopeLines.push("4. Each entry's 'framework' field must match a code identifier from the list above (substring permitted).");
      scopeLines.push("5. Cite authority_lock.authority_chain and authority_lock.supplemental_codes in evidence_trace.");
      alrScopePrompt = scopeLines.join("\n");
    }

    // ======================================================================
    // OUTPUT FORMAT AND QUALITY REQUIREMENTS
    // ======================================================================

    var outputPrompt = [
      "",
      "",
      "OUTPUT FORMAT -- respond with ONLY valid JSON, no markdown, no preamble:",
      "{",
      "  \"failure_narrative\": \"Physics-traced narrative. First sentence names governing failure mode (from FMD if present). Every sentence backed by DC or engine data. Cite field paths in parentheses.\",",
      "  \"contradiction_matrix\": [",
      "    {",
      "      \"framework\": \"Code from authority_lock.authority_chain or supplemental_codes (when ALR present); otherwise from authority_reality\",",
      "      \"verdict\": \"ACCEPT or REJECT\",",
      "      \"basis\": \"What the code evaluates\",",
      "      \"limitation\": \"What the code does NOT evaluate\",",
      "      \"gap_reason\": \"Why physics may disagree\"",
      "    }",
      "  ],",
      "  \"pre_inspection_briefing\": {",
      "    \"target_zones\": [\"from damage_reality + physical_reality.stress + fmd governing path\"],",
      "    \"expected_flaws\": [\"from damage_reality.validated_mechanisms and fmd paths\"],",
      "    \"method_recommendations\": [\"from inspection_reality.proposed_methods and best_method\"],",
      "    \"sensitivity_settings\": \"from inspection_reality.best_method.scores or sufficiency_verdict\",",
      "    \"watch_items\": [\"from inspection_reality.missing_coverage, reality_confidence.limiting_factors, ftr.progression_state_basis\"]",
      "  },",
      "  \"procedure_forensics\": {",
      "    \"likely_causes\": [\"root cause chain from fmd.governing_failure_mode or damage_reality.primary_mechanism back to physical_reality\"],",
      "    \"procedural_gaps\": [\"from inspection_reality.missing_coverage and authority_reality.code_gaps\"],",
      "    \"reverse_inference_chain\": [\"observed flaw -> mechanism -> enabling condition -> procedural gap\"]",
      "  },",
      "  \"live_physics_state\": {",
      "    \"fad_position\": \"from physics_computations.critical_flaw.stress_ratio or NOT CALCULATED\",",
      "    \"remaining_life\": \"from ftr.governing_time_years if present, else physics_computations.wall_loss.remaining_life_years, else NOT CALCULATED\",",
      "    \"threshold_proximity\": \"from rsr.safe_envelope + rsr.operating_ratio if present, else physics_computations.critical_flaw.stress_ratio, else NOT CALCULATED\",",
      "    \"gate_status\": \"from decision_reality.gates -- summarize each gate\",",
      "    \"critical_values\": \"from rsr.governing_maop, fmd.governing_failure_pressure, ftr.corrosion_timeline.corrosion_rate_mpy, physics_computations fields\"",
      "  },",
      "  \"inspector_action_card\": [",
      "    {",
      "      \"step\": \"from dpr.actions if present, else decision_reality.guided_recovery\",",
      "      \"rationale\": \"traced to decision_reality.gates, inspection_reality.missing_coverage, or fmd.governing_basis\",",
      "      \"threshold_if_positive\": \"what happens if confirmed\",",
      "      \"threshold_if_negative\": \"what happens if not confirmed\"",
      "    }",
      "  ],",
      "  \"reviewer_brief\": \"3-5 sentences. Reference fmd.governing_failure_mode if present, dpr.disposition if present, reality_confidence.limiting_factors, consequence_reality.consequence_tier.\",",
      "  \"evidence_trace\": [",
      "    {",
      "      \"claim\": \"specific claim from any feature above\",",
      "      \"source_field\": \"exact field path (e.g. failure_mode_dominance.governing_failure_mode, authority_lock.authority_chain[0].code, remaining_strength.safe_envelope)\",",
      "      \"confidence\": \"HIGH | MEDIUM | LOW\",",
      "      \"claim_class\": \"OBSERVED | INFERRED | CALCULATED | PREDICTED\"",
      "    }",
      "  ]",
      "}",
      "",
      "QUALITY REQUIREMENTS:",
      "- failure_narrative: 4-8 sentences. Technical prose. First sentence names governing mode when FMD present.",
      "- contradiction_matrix: ONLY codes from ALR chain when ALR present. Otherwise one entry per authority_reality framework.",
      "- pre_inspection_briefing: actionable for a Level II technician.",
      "- procedure_forensics: reverse-engineer from flaw to root procedural cause.",
      "- live_physics_state: state NOT CALCULATED for any value whose source engine is disabled or null.",
      "- inspector_action_card: 3-6 ranked steps. Prefer dpr.actions when present.",
      "- reviewer_brief: written for an engineering manager.",
      "- evidence_trace: minimum 8 entries covering the most critical claims across all features."
    ].join("\n");

    var systemPrompt = basePrompt + enginePrompt + fmdOverridePrompt + alrScopePrompt + outputPrompt;

    // ======================================================================
    // USER PROMPT: transcript + decision-core + engine bundle
    // ======================================================================

    var userPromptLines = [
      "FIELD TRANSCRIPT:",
      "---",
      transcript,
      "---",
      "",
      "DECISION-CORE OUTPUT (v2.5.4):",
      "---",
      JSON.stringify(decisionCore, null, 2),
      "---"
    ];

    if (anyEngine) {
      userPromptLines.push("");
      userPromptLines.push("BUILD 1+2+3 ENGINE RESULTS (AUTHORITATIVE):");
      userPromptLines.push("---");
      var engineBundle = {};
      if (alr) engineBundle.authority_lock = alr;
      if (rsr) engineBundle.remaining_strength = rsr;
      if (fmd) engineBundle.failure_mode_dominance = fmd;
      if (dpr) engineBundle.disposition_pathway = dpr;
      if (ftr) engineBundle.failure_timeline = ftr;
      if (par) engineBundle.photo_analysis = par;
      userPromptLines.push(JSON.stringify(engineBundle, null, 2));
      userPromptLines.push("---");
    }

    userPromptLines.push("");
    userPromptLines.push("Produce the complete Superbrain Synthesis output.");
    userPromptLines.push("Every claim must trace to the JSON above.");
    userPromptLines.push("Use EXACT field paths in your evidence_trace entries.");
    if (fmdGoverningPresent) {
      userPromptLines.push("REMINDER: The FMD governing mode override rule is in effect. Your failure_narrative MUST name the governing mode in its first sentence.");
    }
    if (alrScopePresent) {
      userPromptLines.push("REMINDER: The contradiction matrix scope rule is in effect. ONLY codes from the ALR chain above.");
    }
    userPromptLines.push("Respond with ONLY the JSON object. No markdown. No preamble.");

    var userPrompt = userPromptLines.join("\n");

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
    var rawContent = openaiData.choices && openaiData.choices[0] && openaiData.choices[0].message && openaiData.choices[0].message.content;

    if (!rawContent) {
      return {
        statusCode: 502,
        headers: headers,
        body: JSON.stringify({ error: "Empty response from OpenAI" })
      };
    }

    // ======================================================================
    // PARSE AND VALIDATE
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

    var requiredFields = [
      "failure_narrative", "contradiction_matrix", "pre_inspection_briefing",
      "procedure_forensics", "live_physics_state", "inspector_action_card",
      "reviewer_brief", "evidence_trace"
    ];
    var missingFields = [];
    for (var rfi = 0; rfi < requiredFields.length; rfi++) {
      if (!synthesis[requiredFields[rfi]]) missingFields.push(requiredFields[rfi]);
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
    // DEPLOY170.2: POST-RESPONSE NARRATIVE GOVERNING-MODE SAFETY NET
    // ======================================================================
    // If FMD governing mode is set and the narrative opening (first 300 chars)
    // does not reference it, prepend a correction sentence. The prompt rule
    // should prevent this from triggering in most cases, but this is the
    // belt-and-suspenders guarantee that the narrative never silently
    // contradicts FMD.

    var narrativeCorrected = false;
    var narrativeCorrectionReason = null;
    if (fmdGoverningPresent && synthesis.failure_narrative) {
      var govModeText = String(fmd.governing_failure_mode).toLowerCase().replace(/_/g, " ");
      var govModeTerms = govModeText.split(" ");
      var narrativeLower = String(synthesis.failure_narrative).toLowerCase();
      var narrativeOpening = narrativeLower.substring(0, 300);

      // Check if ANY of the governing mode terms appear in the opening.
      // Allows "structural instability" to match "structural" in the opening.
      var opensWithGoverning = false;
      for (var gti = 0; gti < govModeTerms.length; gti++) {
        var term = govModeTerms[gti];
        if (term && term.length > 3 && narrativeOpening.indexOf(term) >= 0) {
          opensWithGoverning = true;
          break;
        }
      }

      if (!opensWithGoverning) {
        var govLabel = String(fmd.governing_failure_mode).replace(/_/g, " ").toUpperCase();
        var govSev = fmd.governing_severity ? String(fmd.governing_severity) : "";
        var correctionPrefix = "GOVERNING FAILURE MODE (per deterministic Failure Mode Dominance engine): " + govLabel;
        if (govSev) correctionPrefix = correctionPrefix + ". Severity: " + govSev;
        correctionPrefix = correctionPrefix + ". ";
        synthesis.failure_narrative = correctionPrefix + synthesis.failure_narrative;
        narrativeCorrected = true;
        narrativeCorrectionReason = "FMD governing mode '" + fmd.governing_failure_mode + "' not referenced in narrative opening (first 300 chars); correction sentence prepended";
      }
    }

    // ======================================================================
    // DEPLOY170.2: POST-RESPONSE CONTRADICTION MATRIX FILTER
    // ======================================================================
    // Drop any matrix entry whose framework does not fuzzy-match an ALR code.
    // Fuzzy match handles variations like "API 570" vs "API 570 - Piping
    // Inspection Code". Reports removed entries in metadata so anomalies
    // surface in trace_warnings.

    var matrixRemoved = [];
    var matrixFilterApplied = false;
    if (alrScopePresent && synthesis.contradiction_matrix && Array.isArray(synthesis.contradiction_matrix)) {
      matrixFilterApplied = true;
      var allowedFrameworks = [];
      for (var afci = 0; afci < alr.authority_chain.length; afci++) {
        var afac = alr.authority_chain[afci] || {};
        var afacId = afac.code || afac.standard || afac.name || afac.id || afac.title || "";
        if (afacId) allowedFrameworks.push(String(afacId).toLowerCase());
      }
      if (alr.supplemental_codes && Array.isArray(alr.supplemental_codes)) {
        for (var afsi = 0; afsi < alr.supplemental_codes.length; afsi++) {
          var afsc = alr.supplemental_codes[afsi] || {};
          var afscId = afsc.code || afsc.standard || afsc.name || afsc.id || afsc.title || "";
          if (afscId) allowedFrameworks.push(String(afscId).toLowerCase());
        }
      }

      var matrixFiltered = [];
      for (var mi = 0; mi < synthesis.contradiction_matrix.length; mi++) {
        var entry = synthesis.contradiction_matrix[mi] || {};
        var entryFramework = String(entry.framework || "").toLowerCase();
        var matched = false;
        if (entryFramework) {
          for (var afi = 0; afi < allowedFrameworks.length; afi++) {
            var allowed = allowedFrameworks[afi];
            // Fuzzy substring match either direction
            if (entryFramework.indexOf(allowed) >= 0 || allowed.indexOf(entryFramework) >= 0) {
              matched = true;
              break;
            }
          }
        }
        if (matched) {
          matrixFiltered.push(entry);
        } else {
          matrixRemoved.push(entry.framework || "(unnamed)");
        }
      }
      synthesis.contradiction_matrix = matrixFiltered;
    }

    // ======================================================================
    // VALIDATE EVIDENCE TRACE FIELD PATHS (v1.1 behavior, expanded prefixes)
    // ======================================================================

    var validPrefixes = [
      "physical_reality", "damage_reality", "consequence_reality",
      "authority_reality", "inspection_reality", "decision_reality",
      "physics_computations", "reality_confidence", "context_inferred",
      // DEPLOY170.2: new engine namespaces
      "authority_lock", "remaining_strength", "failure_mode_dominance",
      "disposition_pathway", "failure_timeline", "photo_analysis"
    ];
    var traceWarnings = [];
    if (synthesis.evidence_trace && Array.isArray(synthesis.evidence_trace)) {
      for (var ti = 0; ti < synthesis.evidence_trace.length; ti++) {
        var et = synthesis.evidence_trace[ti];
        if (et && et.source_field) {
          var pathValid = false;
          for (var pi = 0; pi < validPrefixes.length; pi++) {
            if (et.source_field.indexOf(validPrefixes[pi]) === 0) {
              pathValid = true;
              break;
            }
          }
          if (!pathValid) {
            traceWarnings.push("evidence_trace[" + ti + "].source_field '" + et.source_field + "' does not match any known field prefix");
          }
        }
      }
    }

    // ======================================================================
    // METADATA AND RETURN
    // ======================================================================

    var constraintMetadata = {
      fmd_override_applied: fmdGoverningPresent,
      alr_scope_applied: alrScopePresent,
      narrative_corrected: narrativeCorrected,
      narrative_correction_reason: narrativeCorrectionReason,
      matrix_filter_applied: matrixFilterApplied,
      matrix_entries_removed: matrixRemoved.length > 0 ? matrixRemoved : null,
      engines_received: {
        authority_lock: !!alr,
        remaining_strength: !!rsr,
        failure_mode_dominance: !!fmd,
        disposition_pathway: !!dpr,
        failure_timeline: !!ftr,
        photo_analysis: !!par
      }
    };

    var result = {
      superbrain_version: "1.2",
      synthesis_constraint_version: "v1.2",
      engine_version: "decision-core-v2.5.4",
      timestamp: new Date().toISOString(),
      token_usage: openaiData.usage || null,
      trace_warnings: traceWarnings.length > 0 ? traceWarnings : null,
      constraint_metadata: constraintMetadata,
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
