// ============================================================================
// DEPLOY202 — SUPERBRAIN SYNTHESIS v1.4
// v1.4 (DEPLOY202): Wire Engine 3 (inspection-retrieval) into synthesis.
//   - inspection_retrieval accepted as optional body field (same pattern as FMD, ALR, etc.)
//   - Engine 3 field map added to system prompt: mechanism_references, method_coverage,
//     ai_synthesis (inspection_plan, coverage_matrix, data_gaps, engineering_narrative)
//   - Conditional INSPECTION AUTHORITY block injected when Engine 3 is present.
//     Forces GPT-4o to use Engine 3's code citations and method rationale as ground truth
//     for pre_inspection_briefing and inspector_action_card.
//   - pre_inspection_briefing method_recommendations now trace to Engine 3 when present.
//   - New output field: inspection_intelligence_summary (Engine 3's engineering_narrative
//     passed through when available).
//   - constraint_metadata reports inspection_retrieval received flag.
//   - Version: superbrain v1.4, engine ref v2.10.0
// v1.3 (DEPLOY184): Wire consequence_undetermined into synthesis.
//   - consequence_undetermined + undetermined_impacts added to field map
//   - Conditional system prompt block forces GPT-4o to surface undetermined impacts
//   - Post-response safety net appends warning if GPT-4o omits it
//   - constraint_metadata reports consequence_undetermined_applied, impacts, warning_injected
// Previous: v1.2 (DEPLOY170.2)
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

    // ========================================================================
    // DEPLOY171.7: DOMAIN REFUSAL SHORT-CIRCUIT
    // The superbrain pays GPT-4o latency to synthesize narratives. When the
    // domain is unsupported, the decision-core returns null physics across all
    // six reality states. Running GPT against that produces garbage narratives
    // and wastes tokens. Short-circuit here.
    // ========================================================================
    var domainRefused = false;
    if (body.domain_not_supported === true) { domainRefused = true; }
    if (body.decision_core && body.decision_core.domain_not_supported === true) { domainRefused = true; }
    if (domainRefused) {
      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({
          domain_not_supported: true,
          refusal_reason: "Upstream decision-core refused this asset domain. Superbrain synthesis not performed — no physics to narrate.",
          narrative: null,
          executive_summary: "DOMAIN NOT SUPPORTED — The asset class is outside this engine build's supported domain set. No inspection intelligence was produced. Manual review by domain-qualified personnel is required.",
          section_summaries: {},
          confidence_narrative: null,
          engine_version: "superbrain-synthesis-v1.4-deploy202"
        })
      };
    }

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
    var ir = body.inspection_retrieval || null;

    if (!decisionCore) {
      return {
        statusCode: 400,
        headers: headers,
        body: JSON.stringify({ error: "Missing decision_core in request body" })
      };
    }

    var anyEngine = !!(alr || rsr || fmd || dpr || ftr || par || ir);
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
      "    consequence_undetermined: (boolean -- true when consequence cannot be fully determined from available data)",
      "    undetermined_impacts: [ strings -- which impact dimensions (human_impact, environmental_impact, operational_impact) lack evidence ]",
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
      if (ir) {
        engineLines.push("  inspection_retrieval (IR / Engine 3):");
        engineLines.push("    engine_version: (string)");
        engineLines.push("    mechanism_references: [ { mechanism_id, mechanism_name, api_571_section, governing_codes[],");
        engineLines.push("      primary_methods[], supplementary_methods[], critical_factors, acceptance_reference,");
        engineLines.push("      reality_state, severity } ]   <- AUTHORITATIVE code citations per validated mechanism");
        engineLines.push("    method_coverage: [ { method, full_name, standard, mechanisms_covered[], is_primary_for[] } ]");
        engineLines.push("      <- Sorted by coverage count. First entries cover most mechanisms. Use for multi-mechanism efficiency.");
        engineLines.push("    ai_synthesis: {   <- Claude AI inspection plan (may be null if AI call failed)");
        engineLines.push("      inspection_plan: { priority_order: [ { mechanism_id, mechanism_name, primary_method,");
        engineLines.push("        method_rationale, supplementary_methods[], code_basis, acceptance_criteria,");
        engineLines.push("        priority (critical|high|medium|routine), interval_guidance } ] }");
        engineLines.push("      coverage_matrix: [ { method, mechanisms_covered[], efficiency_note } ]");
        engineLines.push("      data_gaps: [ { gap_description, resolving_action, impact_if_unresolved } ]");
        engineLines.push("      authority_summary: (string)  <- 2-3 sentences identifying governing code framework");
        engineLines.push("      engineering_narrative: (string)  <- Level 3 NDT teaching-quality explanation");
        engineLines.push("      coating_assessment: { condition, type, impact_on_inspection }");
        engineLines.push("    }");
        engineLines.push("    ai_provider: (string)  <- which AI generated the synthesis");
        engineLines.push("    ai_error: (string|null)  <- if AI call failed, the error");
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
    // DEPLOY184: CONSEQUENCE UNDETERMINED WARNING BLOCK (conditional)
    // ======================================================================
    // When decision-core flags consequence_undetermined = true, one or more
    // impact dimensions (human, environmental, operational) could not be
    // determined from available data. The consequence tier may understate
    // actual risk. GPT-4o must surface this in its narrative and reviewer_brief.

    var consequenceUndetermined = decisionCore && decisionCore.consequence_reality && decisionCore.consequence_reality.consequence_undetermined === true;
    var undeterminedImpacts = (decisionCore && decisionCore.consequence_reality && decisionCore.consequence_reality.undetermined_impacts) || [];

    var consequenceUndeterminedPrompt = "";
    if (consequenceUndetermined) {
      var impactList = undeterminedImpacts.length > 0 ? undeterminedImpacts.join(", ") : "unspecified dimensions";
      consequenceUndeterminedPrompt = [
        "",
        "============================================================",
        "CONSEQUENCE UNDETERMINED WARNING -- ABSOLUTE RULE",
        "============================================================",
        "The decision-core has flagged consequence_undetermined = true.",
        "Undetermined impact dimensions: " + impactList,
        "",
        "This means the consequence tier may be UNDERSTATED because evidence for one or more",
        "impact dimensions (human, environmental, operational) was not available.",
        "Absence of evidence is NOT evidence of low consequence.",
        "",
        "Your outputs MUST:",
        "1. State in failure_narrative that consequence assessment is INCOMPLETE for: " + impactList + ".",
        "2. In reviewer_brief, explicitly warn that consequence tier may be understated and name the missing dimensions.",
        "3. In inspector_action_card, include a step to gather missing consequence data for: " + impactList + ".",
        "4. In live_physics_state, note consequence_undetermined status and the missing dimensions.",
        "5. Include consequence_reality.consequence_undetermined and consequence_reality.undetermined_impacts in evidence_trace."
      ].join("\n");
    }

    // ======================================================================
    // DEPLOY202: INSPECTION AUTHORITY BLOCK (conditional, Engine 3)
    // ======================================================================
    // When Engine 3 (inspection-retrieval) is present with mechanism references
    // and/or AI synthesis, its code citations and method rationale are authoritative.
    // GPT-4o must use Engine 3's references as ground truth for pre_inspection_briefing,
    // procedure_forensics, and inspector_action_card.

    var irPresent = ir && ((ir.mechanism_references && ir.mechanism_references.length > 0) || ir.ai_synthesis);
    var irOverridePrompt = "";
    if (irPresent) {
      var irLines = [
        "",
        "============================================================",
        "INSPECTION RETRIEVAL AUTHORITY -- ENGINE 3 OVERRIDE",
        "============================================================",
        "Engine 3 (inspection-retrieval) has provided authoritative code citations,",
        "method selections, and inspection planning data grounded in API 571 section",
        "references and NDT method standards. This data is AUTHORITATIVE.",
        ""
      ];
      if (ir.mechanism_references && ir.mechanism_references.length > 0) {
        irLines.push("MECHANISM REFERENCES (" + ir.mechanism_references.length + " validated mechanisms with code citations):");
        for (var iri = 0; iri < ir.mechanism_references.length; iri++) {
          var mref = ir.mechanism_references[iri];
          irLines.push("  - " + (mref.mechanism_name || mref.mechanism_id) + " [API 571 " + (mref.api_571_section || "?") + "]");
          irLines.push("    Codes: " + (mref.governing_codes || []).join(", "));
          irLines.push("    Primary: " + (mref.primary_methods || []).join(", "));
          if (mref.acceptance_reference) irLines.push("    Acceptance: " + mref.acceptance_reference);
        }
        irLines.push("");
      }
      if (ir.method_coverage && ir.method_coverage.length > 0) {
        irLines.push("METHOD COVERAGE MATRIX (sorted by multi-mechanism efficiency):");
        var maxCov = Math.min(ir.method_coverage.length, 8);
        for (var mci = 0; mci < maxCov; mci++) {
          var mc = ir.method_coverage[mci];
          irLines.push("  - " + (mc.method || "?") + " covers " + (mc.mechanisms_covered || []).length + " mechanisms: " + (mc.mechanisms_covered || []).join(", "));
        }
        irLines.push("");
      }
      irLines.push("YOUR OUTPUTS MUST:");
      irLines.push("1. pre_inspection_briefing.method_recommendations MUST use Engine 3's primary_methods and supplementary_methods.");
      irLines.push("   Do NOT invent methods not in Engine 3's references.");
      irLines.push("2. pre_inspection_briefing.sensitivity_settings MUST reference the specific standard from Engine 3's method reference.");
      irLines.push("3. inspector_action_card steps MUST cite the specific API 571 section and acceptance criteria from Engine 3.");
      irLines.push("4. procedure_forensics.procedural_gaps MUST cross-reference Engine 3's critical_factors for each mechanism.");
      irLines.push("5. When Engine 3's method_coverage shows one method covering multiple mechanisms, highlight this as an EFFICIENCY OPPORTUNITY.");
      irLines.push("6. Cite inspection_retrieval.mechanism_references and inspection_retrieval.method_coverage in evidence_trace.");

      if (ir.ai_synthesis) {
        irLines.push("");
        irLines.push("Engine 3 AI SYNTHESIS is also available. Use its engineering_narrative as supporting context");
        irLines.push("for your failure_narrative and reviewer_brief. Its inspection_plan.priority_order should inform");
        irLines.push("the ranking of inspector_action_card steps.");
        if (ir.ai_synthesis.data_gaps && ir.ai_synthesis.data_gaps.length > 0) {
          irLines.push("Engine 3 identified " + ir.ai_synthesis.data_gaps.length + " DATA GAPS -- address these in your inspector_action_card.");
        }
      }

      irOverridePrompt = irLines.join("\n");
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

    var systemPrompt = basePrompt + enginePrompt + fmdOverridePrompt + alrScopePrompt + irOverridePrompt + consequenceUndeterminedPrompt + outputPrompt;

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
      if (ir) engineBundle.inspection_retrieval = ir;
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
    if (consequenceUndetermined) {
      userPromptLines.push("REMINDER: Consequence is UNDETERMINED for: " + undeterminedImpacts.join(", ") + ". You MUST address this in failure_narrative and reviewer_brief. Absence of evidence is NOT evidence of low consequence.");
    }
    userPromptLines.push("Respond with ONLY the JSON object. No markdown. No preamble.");

    var userPrompt = userPromptLines.join("\n");

    // ======================================================================
    // DEPLOY202: DUAL-PROVIDER AI CALL WITH FAILOVER
    // Primary: OpenAI GPT-4o. Fallback: Anthropic Claude Sonnet.
    // If primary fails (network, timeout, API error, empty response, bad JSON),
    // automatically falls to secondary. Both keys already in Netlify env.
    // ======================================================================

    var openaiKey = process.env.OPENAI_API_KEY || "";
    var anthropicKey = process.env.ANTHROPIC_API_KEY || "";

    if (!openaiKey && !anthropicKey) {
      return {
        statusCode: 500,
        headers: headers,
        body: JSON.stringify({ error: "No AI API keys configured (need OPENAI_API_KEY or ANTHROPIC_API_KEY)" })
      };
    }

    var rawContent = null;
    var aiProvider = "none";
    var aiFailoverUsed = false;
    var aiPrimaryError = null;
    var tokenUsage = null;

    // --- ATTEMPT 1: OpenAI GPT-4o (primary) ---
    if (openaiKey) {
      aiProvider = "openai_gpt4o";
      try {
        var oaiAbort = new AbortController();
        var oaiTimeout = setTimeout(function() { oaiAbort.abort(); }, 22000);

        var openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          signal: oaiAbort.signal,
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
        clearTimeout(oaiTimeout);

        if (openaiResponse.ok) {
          var openaiData = await openaiResponse.json();
          tokenUsage = openaiData.usage || null;
          rawContent = (openaiData.choices && openaiData.choices[0] && openaiData.choices[0].message && openaiData.choices[0].message.content) || null;
          if (!rawContent) {
            aiPrimaryError = "OpenAI returned empty content";
            rawContent = null;
          }
        } else {
          var oaiErrText = await openaiResponse.text();
          aiPrimaryError = "OpenAI API error " + openaiResponse.status + ": " + oaiErrText.substring(0, 200);
        }
      } catch (oaiErr) {
        clearTimeout(oaiTimeout);
        if (oaiErr.name === "AbortError") {
          aiPrimaryError = "OpenAI timed out after 22 seconds";
        } else {
          aiPrimaryError = "OpenAI fetch error: " + (oaiErr.message || String(oaiErr));
        }
      }
    }

    // --- ATTEMPT 2: Anthropic Claude (fallback) ---
    if (!rawContent && anthropicKey) {
      aiFailoverUsed = true;
      aiProvider = "anthropic_claude_failover";
      try {
        var claudeAbort = new AbortController();
        var claudeTimeout = setTimeout(function() { claudeAbort.abort(); }, 24000);

        var claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          signal: claudeAbort.signal,
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            temperature: 0.2,
            system: systemPrompt + "\n\nCRITICAL: Respond with ONLY valid JSON. No markdown fences. No preamble. No explanation outside the JSON.",
            messages: [
              { role: "user", content: userPrompt }
            ]
          })
        });
        clearTimeout(claudeTimeout);

        if (claudeResponse.ok) {
          var claudeData = await claudeResponse.json();
          tokenUsage = { input_tokens: claudeData.usage ? claudeData.usage.input_tokens : null, output_tokens: claudeData.usage ? claudeData.usage.output_tokens : null };
          rawContent = (claudeData.content && claudeData.content[0] && claudeData.content[0].text) || null;
          if (rawContent) {
            // Strip markdown fences if Claude wraps in ```json
            rawContent = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
          }
          if (!rawContent) {
            aiPrimaryError = (aiPrimaryError ? aiPrimaryError + " | " : "") + "Claude also returned empty content";
          }
        } else {
          var claudeErrText = await claudeResponse.text();
          var claudeErrMsg = "Claude API error " + claudeResponse.status + ": " + claudeErrText.substring(0, 200);
          aiPrimaryError = (aiPrimaryError ? aiPrimaryError + " | " : "") + claudeErrMsg;
        }
      } catch (claudeErr) {
        clearTimeout(claudeTimeout);
        var claudeFetchMsg = claudeErr.name === "AbortError" ? "Claude timed out after 24 seconds" : "Claude fetch error: " + (claudeErr.message || String(claudeErr));
        aiPrimaryError = (aiPrimaryError ? aiPrimaryError + " | " : "") + claudeFetchMsg;
      }
    }

    // --- No AI response from either provider ---
    if (!rawContent) {
      return {
        statusCode: 502,
        headers: headers,
        body: JSON.stringify({
          error: "Both AI providers failed",
          detail: aiPrimaryError || "No API keys configured or both calls returned empty",
          failover_attempted: aiFailoverUsed
        })
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
          error: "AI response was not valid JSON (provider: " + aiProvider + ")",
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
    // DEPLOY184: POST-RESPONSE CONSEQUENCE UNDETERMINED SAFETY NET
    // ======================================================================
    // If consequence_undetermined is true and GPT-4o's narrative does not
    // reference undetermined/incomplete consequence, append a warning sentence.
    // Belt-and-suspenders guarantee that undetermined consequence is never
    // silently omitted from the synthesis.

    var consequenceWarningInjected = false;
    if (consequenceUndetermined && synthesis.failure_narrative) {
      var narrativeForCheck = String(synthesis.failure_narrative).toLowerCase();
      var hasUndeterminedRef = narrativeForCheck.indexOf("undetermined") >= 0 || narrativeForCheck.indexOf("incomplete") >= 0 || narrativeForCheck.indexOf("not fully determined") >= 0 || narrativeForCheck.indexOf("understated") >= 0;
      if (!hasUndeterminedRef) {
        var impactLabel = undeterminedImpacts.length > 0 ? undeterminedImpacts.join(", ") : "one or more impact dimensions";
        var warningText = " CONSEQUENCE WARNING: Consequence assessment is incomplete — " + impactLabel + " could not be fully determined from available data. The stated consequence tier may understate actual risk.";
        synthesis.failure_narrative = synthesis.failure_narrative + warningText;
        consequenceWarningInjected = true;
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
      // DEPLOY170.2: new engine namespaces; DEPLOY202: inspection_retrieval
      "authority_lock", "remaining_strength", "failure_mode_dominance",
      "disposition_pathway", "failure_timeline", "photo_analysis",
      "inspection_retrieval"
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
      ir_override_applied: irPresent,
      consequence_undetermined_applied: consequenceUndetermined,
      consequence_undetermined_impacts: undeterminedImpacts.length > 0 ? undeterminedImpacts : null,
      consequence_warning_injected: consequenceWarningInjected,
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
        photo_analysis: !!par,
        inspection_retrieval: !!ir
      }
    };

    // DEPLOY202: Pass through Engine 3's engineering narrative and inspection plan
    var inspectionIntelligenceSummary = null;
    if (ir && ir.ai_synthesis) {
      inspectionIntelligenceSummary = {
        engineering_narrative: ir.ai_synthesis.engineering_narrative || null,
        authority_summary: ir.ai_synthesis.authority_summary || null,
        inspection_plan: ir.ai_synthesis.inspection_plan || null,
        coverage_matrix: ir.ai_synthesis.coverage_matrix || null,
        data_gaps: ir.ai_synthesis.data_gaps || null,
        coating_assessment: ir.ai_synthesis.coating_assessment || null,
        ai_provider: ir.ai_provider || null
      };
    }

    var result = {
      superbrain_version: "1.4",
      synthesis_constraint_version: "v1.4",
      engine_version: "decision-core-v2.10.0",
      ai_provider: aiProvider,
      ai_failover_used: aiFailoverUsed,
      ai_primary_error: aiPrimaryError,
      timestamp: new Date().toISOString(),
      token_usage: tokenUsage,
      trace_warnings: traceWarnings.length > 0 ? traceWarnings : null,
      constraint_metadata: constraintMetadata,
      inspection_intelligence_summary: inspectionIntelligenceSummary,
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
