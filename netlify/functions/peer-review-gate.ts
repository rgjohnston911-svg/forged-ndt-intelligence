// PEER REVIEW GATE ENGINE v1.0
// DEPLOY354 — Self-Review Quality Gate
// File: netlify/functions/peer-review-gate.ts
//
// PURPOSE: Acts as an automated peer reviewer on assembled assessment output.
// Runs AFTER all engines complete but BEFORE the final report is delivered.
// Catches consistency errors, authority mismatches, and logic gaps that
// individual engines may miss because they lack cross-engine context.
//
// DESIGN: Uses an LLM review pass (Claude) with a physics-grounded prompt
// that checks ~15 categories of potential errors. Returns a structured
// review with findings, severity, and recommended fixes. The system can
// auto-correct certain classes of errors and flag others for human review.
//
// HOUSE STYLE: var-only, no backtick templates, no destructuring,
// string concat only, explicit types on all declarations

var ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

// ============================================================
// DETERMINISTIC PRE-CHECKS (run before LLM review)
// These are fast, rule-based checks that catch common errors
// without needing an LLM call.
// ============================================================

interface ReviewFinding {
  id: string;
  category: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  title: string;
  detail: string;
  recommendation: string;
  auto_correctable: boolean;
  correction: Record<string, any> | null;
}

interface ReviewResult {
  status: "PASS" | "PASS_WITH_WARNINGS" | "FAIL_REVIEW_REQUIRED";
  findings: ReviewFinding[];
  deterministic_checks: DeterministicCheckResult[];
  llm_review: LLMReviewResult | null;
  metadata: Record<string, any>;
}

interface DeterministicCheckResult {
  check: string;
  passed: boolean;
  detail: string;
}

interface LLMReviewResult {
  model: string;
  findings: ReviewFinding[];
  overall_assessment: string;
  confidence: number;
}

// COMPONENT-TYPE TO AUTHORITY MAPPING
// Used by deterministic checks to verify authority chain correctness
var COMPONENT_AUTHORITY_MAP: Record<string, { primary: string; construction: string; description: string }> = {
  "piping": { primary: "API 570", construction: "ASME B31.3", description: "Process piping" },
  "header": { primary: "API 570", construction: "ASME B31.3", description: "Production/process header (piping)" },
  "production_header": { primary: "API 570", construction: "ASME B31.3", description: "Production header (piping)" },
  "flowline": { primary: "API 570", construction: "ASME B31.3", description: "Flowline (piping)" },
  "riser": { primary: "API 570", construction: "ASME B31.3", description: "Riser (piping)" },
  "manifold": { primary: "API 570", construction: "ASME B31.3", description: "Manifold (piping)" },
  "pressure_vessel": { primary: "API 510", construction: "ASME Section VIII", description: "Pressure vessel" },
  "vessel": { primary: "API 510", construction: "ASME Section VIII", description: "Pressure vessel" },
  "separator": { primary: "API 510", construction: "ASME Section VIII", description: "Separator (vessel)" },
  "heat_exchanger": { primary: "API 510", construction: "ASME Section VIII", description: "Heat exchanger" },
  "storage_tank": { primary: "API 653", construction: "API 650", description: "Storage tank" },
  "boiler": { primary: "NB-23 (NBIC)", construction: "ASME Section I", description: "Boiler" },
  "structural": { primary: "AWS D1.1", construction: "AWS D1.1", description: "Structural steel" },
  "offshore_structure": { primary: "API RP 2A", construction: "AWS D1.1", description: "Offshore structural member" },
  "pipeline": { primary: "PHMSA / ASME B31.8", construction: "ASME B31.8", description: "Pipeline" }
};

// Keywords that indicate a piping component in descriptions
var PIPING_KEYWORDS: string[] = [
  "header", "piping", "pipe", "spool", "riser", "flowline", "manifold",
  "branch connection", "weldolet", "nozzle", "reducer", "elbow", "tee",
  "flange", "coupling", "fitting", "valve", "production header", "process header",
  "sour-service", "sour service"
];

var VESSEL_KEYWORDS: string[] = [
  "vessel", "separator", "drum", "reactor", "column", "tower", "scrubber",
  "accumulator", "receiver", "knockout"
];

var STRUCTURAL_KEYWORDS: string[] = [
  "jacket", "brace", "beam", "truss", "deck plate", "framing",
  "caisson", "mudline", "structural member", "leg"
];

function inferComponentType(description: string): string {
  var d = (description || "").toLowerCase();
  for (var i = 0; i < PIPING_KEYWORDS.length; i++) {
    if (d.indexOf(PIPING_KEYWORDS[i]) >= 0) return "piping";
  }
  for (var j = 0; j < VESSEL_KEYWORDS.length; j++) {
    if (d.indexOf(VESSEL_KEYWORDS[j]) >= 0) return "pressure_vessel";
  }
  for (var k = 0; k < STRUCTURAL_KEYWORDS.length; k++) {
    if (d.indexOf(STRUCTURAL_KEYWORDS[k]) >= 0) return "structural";
  }
  return "unknown";
}

function runDeterministicChecks(reportData: Record<string, any>): { checks: DeterministicCheckResult[]; findings: ReviewFinding[] } {
  var checks: DeterministicCheckResult[] = [];
  var findings: ReviewFinding[] = [];
  var findingId = 0;

  // ---- CHECK 1: Authority chain matches component type ----
  var assetType = (reportData.asset_type || reportData.asset_classification || "").toLowerCase();
  var componentDesc = (reportData.component_description || reportData.transcript || "").toLowerCase();
  var primaryAuthority = (reportData.primary_authority || "").toUpperCase();
  var inferredType = inferComponentType(componentDesc);

  if (inferredType !== "unknown") {
    var expectedAuth = COMPONENT_AUTHORITY_MAP[inferredType];
    if (expectedAuth) {
      var authorityMatches = primaryAuthority.indexOf(expectedAuth.primary.toUpperCase()) >= 0;
      checks.push({
        check: "authority_component_match",
        passed: authorityMatches,
        detail: authorityMatches
          ? "Primary authority " + primaryAuthority + " correctly matches " + inferredType + " component type"
          : "MISMATCH: Primary authority " + primaryAuthority + " does not match inferred component type '" + inferredType + "' — expected " + expectedAuth.primary
      });

      if (!authorityMatches) {
        findingId++;
        findings.push({
          id: "DET-" + String(findingId).padStart(3, "0"),
          category: "authority_mismatch",
          severity: "CRITICAL",
          title: "Primary authority does not match component type",
          detail: "The report assigns " + primaryAuthority + " as primary authority, but the component described ('" + componentDesc.substring(0, 100) + "...') is " + expectedAuth.description + ". The correct primary authority for " + inferredType + " is " + expectedAuth.primary + " with " + expectedAuth.construction + " as the construction/design code.",
          recommendation: "Replace primary authority with " + expectedAuth.primary + ". Add " + expectedAuth.construction + " as design code reference. " + primaryAuthority + " should only apply if the component is structural steel on the platform.",
          auto_correctable: true,
          correction: {
            primary_authority: expectedAuth.primary,
            construction_code: expectedAuth.construction,
            original_authority: primaryAuthority,
            reason: "Component-type discriminator override: " + inferredType + " on " + assetType
          }
        });
      }
    }
  }

  // ---- CHECK 2: Sour service requires NACE MR0175 ----
  var hasSourService = componentDesc.indexOf("sour") >= 0 || componentDesc.indexOf("h2s") >= 0 ||
                       componentDesc.indexOf("hydrogen sulfide") >= 0;
  var allCodes = JSON.stringify(reportData.all_codes || reportData.authority_chain || []).toUpperCase();
  var hasNace = allCodes.indexOf("NACE") >= 0 || allCodes.indexOf("ISO 15156") >= 0 || allCodes.indexOf("MR0175") >= 0;

  if (hasSourService) {
    checks.push({
      check: "sour_service_nace",
      passed: hasNace,
      detail: hasNace
        ? "NACE MR0175/ISO 15156 present in authority chain for sour service component"
        : "MISSING: Sour service detected but NACE MR0175/ISO 15156 not in authority chain"
    });

    if (!hasNace) {
      findingId++;
      findings.push({
        id: "DET-" + String(findingId).padStart(3, "0"),
        category: "missing_authority",
        severity: "HIGH",
        title: "Sour service component missing NACE MR0175/ISO 15156",
        detail: "The component operates in sour/H2S service but the authority chain does not include NACE MR0175/ISO 15156 material suitability requirements.",
        recommendation: "Add NACE MR0175/ISO 15156 to the authority chain as a material suitability overlay.",
        auto_correctable: true,
        correction: {
          add_authority: "NACE MR0175/ISO 15156",
          role: "material_suitability"
        }
      });
    }
  }

  // ---- CHECK 3: Confidence gate consistency ----
  var confidence = reportData.overall_confidence || reportData.reality_confidence_overall || 0;
  var consequenceTier = (reportData.consequence_tier || "").toUpperCase();
  var disposition = (reportData.disposition || "").toUpperCase();
  var threshold = (consequenceTier === "CRITICAL" || consequenceTier === "HIGH") ? 0.60 : 0.58;

  if (confidence > 0 && confidence < threshold) {
    var dispositionIsBlocked = disposition.indexOf("HOLD") >= 0 || disposition.indexOf("PROVISIONAL") >= 0 || disposition.indexOf("BLOCKED") >= 0;
    checks.push({
      check: "confidence_gate_enforcement",
      passed: dispositionIsBlocked,
      detail: dispositionIsBlocked
        ? "Confidence " + confidence + " below threshold " + threshold + " and disposition correctly blocked"
        : "ERROR: Confidence " + confidence + " below threshold " + threshold + " but disposition is " + disposition + " (should be blocked)"
    });

    if (!dispositionIsBlocked) {
      findingId++;
      findings.push({
        id: "DET-" + String(findingId).padStart(3, "0"),
        category: "confidence_gate_violation",
        severity: "CRITICAL",
        title: "Final disposition issued despite low confidence",
        detail: "Overall confidence is " + confidence + " which is below the enforcement threshold of " + threshold + " for a " + consequenceTier + " consequence tier, but a final disposition of '" + disposition + "' was issued.",
        recommendation: "Block final disposition. Set to HOLD FOR REVIEW until confidence exceeds " + threshold + ".",
        auto_correctable: true,
        correction: {
          disposition: "HOLD FOR REVIEW",
          reason: "Hard confidence gate enforcement"
        }
      });
    }
  }

  // ---- CHECK 4: Cracking mechanisms require crack-specific NDE ----
  var mechanisms = reportData.damage_mechanisms || reportData.mechanism_list || [];
  var mechanismStr = JSON.stringify(mechanisms).toLowerCase();
  var hasCracking = mechanismStr.indexOf("crack") >= 0 || mechanismStr.indexOf("scc") >= 0 ||
                    mechanismStr.indexOf("hic") >= 0 || mechanismStr.indexOf("fatigue") >= 0;
  var inspectionPlan = JSON.stringify(reportData.inspection_plan || reportData.required_inspection_plan || {}).toUpperCase();
  var hasCrackNDE = inspectionPlan.indexOf("TOFD") >= 0 || inspectionPlan.indexOf("PAUT") >= 0 ||
                    inspectionPlan.indexOf("MT") >= 0 || inspectionPlan.indexOf("PT") >= 0 ||
                    inspectionPlan.indexOf("WFMT") >= 0;

  if (hasCracking) {
    checks.push({
      check: "cracking_nde_coverage",
      passed: hasCrackNDE,
      detail: hasCrackNDE
        ? "Crack-specific NDE methods present in inspection plan for cracking mechanisms"
        : "WARNING: Cracking mechanisms identified but no crack-specific NDE in inspection plan"
    });

    if (!hasCrackNDE) {
      findingId++;
      findings.push({
        id: "DET-" + String(findingId).padStart(3, "0"),
        category: "inspection_gap",
        severity: "HIGH",
        title: "Cracking mechanisms without crack-specific NDE methods",
        detail: "The assessment identifies cracking-related mechanisms but the inspection plan does not include crack-specific NDE methods (TOFD, PAUT, MT/WFMT, PT).",
        recommendation: "Add appropriate crack detection methods: TOFD for depth sizing, PAUT for volumetric scanning, MT/WFMT for surface-breaking cracks.",
        auto_correctable: false,
        correction: null
      });
    }
  }

  // ---- CHECK 5: Mechanism scores vs service conditions ----
  if (hasSourService) {
    var sscScore = 0;
    var hicScore = 0;
    var co2Score = 0;
    if (Array.isArray(mechanisms)) {
      for (var m = 0; m < mechanisms.length; m++) {
        var mech = mechanisms[m];
        var mechName = ((mech.name || mech.mechanism || "") + "").toLowerCase();
        var mechScore = mech.score || mech.plausibility || 0;
        if (mechName.indexOf("sulfide_stress") >= 0 || mechName === "ssc") sscScore = mechScore;
        if (mechName.indexOf("hydrogen_induced") >= 0 || mechName === "hic") hicScore = mechScore;
        if (mechName.indexOf("co2") >= 0) co2Score = mechScore;
      }
    }

    if (sscScore === 0 && hicScore === 0) {
      findingId++;
      findings.push({
        id: "DET-" + String(findingId).padStart(3, "0"),
        category: "mechanism_score_inconsistency",
        severity: "MEDIUM",
        title: "Sour service environment with zero SSC/HIC screening scores",
        detail: "The component operates in sour/H2S service but both SSC and HIC mechanism screening scores are 0.00. In a confirmed sour environment, these should carry a minimum screening score of at least 0.10-0.15 even without direct evidence.",
        recommendation: "Set minimum SSC and HIC screening scores to 0.10 for sour service environments. These are plausible mechanisms that must be actively ruled out, not assumed absent.",
        auto_correctable: true,
        correction: {
          ssc_minimum_score: 0.10,
          hic_minimum_score: 0.10,
          reason: "Sour service environment minimum screening"
        }
      });
    }
  }

  // ---- CHECK 6: CO2 in service should elevate CO2 corrosion score ----
  var hasCO2Service = componentDesc.indexOf("co2") >= 0 || componentDesc.indexOf("carbon dioxide") >= 0;
  if (hasCO2Service && co2Score !== undefined && co2Score === 0) {
    findingId++;
    findings.push({
      id: "DET-" + String(findingId).padStart(3, "0"),
      category: "mechanism_score_inconsistency",
      severity: "MEDIUM",
      title: "CO2 in service fluid but CO2 corrosion score is 0.00",
      detail: "The service environment explicitly includes CO2 but the CO2 corrosion mechanism screening score is 0.00.",
      recommendation: "Set minimum CO2 corrosion screening score to 0.10-0.15 when CO2 is confirmed in the service fluid.",
      auto_correctable: true,
      correction: {
        co2_corrosion_minimum_score: 0.10,
        reason: "CO2 confirmed in service fluid"
      }
    });
  }

  // ---- CHECK 7: API 571 should be referenced for damage mechanism identification ----
  var hasApi571 = allCodes.indexOf("API 571") >= 0 || allCodes.indexOf("571") >= 0;
  var hasDamageAnalysis = mechanisms.length > 3;

  if (hasDamageAnalysis && !hasApi571) {
    checks.push({
      check: "api_571_reference",
      passed: false,
      detail: "Multiple damage mechanisms identified but API 571 not in authority chain"
    });
    findingId++;
    findings.push({
      id: "DET-" + String(findingId).padStart(3, "0"),
      category: "missing_reference",
      severity: "LOW",
      title: "API 571 not referenced for damage mechanism analysis",
      detail: "The assessment identifies " + mechanisms.length + " damage mechanisms but does not reference API 571 (Damage Mechanisms Affecting Fixed Equipment in the Refining Industry) as a supporting authority.",
      recommendation: "Add API 571 as a supplemental reference for damage mechanism identification and characterization.",
      auto_correctable: true,
      correction: {
        add_supplemental: "API 571",
        role: "damage_mechanism_reference"
      }
    });
  }

  // ---- CHECK 8: ASME Section V for NDE method authority ----
  var hasNDEPlan = inspectionPlan.length > 10;
  var hasASMEV = allCodes.indexOf("ASME") >= 0 && allCodes.indexOf("SECTION V") >= 0 ||
                 allCodes.indexOf("ASME BPVC SECTION V") >= 0 || allCodes.indexOf("ASME V") >= 0;

  if (hasNDEPlan && !hasASMEV) {
    checks.push({
      check: "asme_section_v_reference",
      passed: false,
      detail: "NDE inspection plan present but ASME Section V not referenced as method authority"
    });
    findingId++;
    findings.push({
      id: "DET-" + String(findingId).padStart(3, "0"),
      category: "missing_reference",
      severity: "LOW",
      title: "ASME Section V not referenced for NDE method authority",
      detail: "The inspection plan specifies NDE methods but does not reference ASME BPVC Section V as the governing standard for NDE procedures.",
      recommendation: "Add ASME BPVC Section V as NDE method authority.",
      auto_correctable: true,
      correction: {
        add_supplemental: "ASME BPVC Section V",
        role: "nde_method_authority"
      }
    });
  }

  return { checks: checks, findings: findings };
}

// ============================================================
// LLM REVIEW PASS
// Sends the assembled report to Claude for cross-engine
// consistency review. This catches issues that rule-based
// checks cannot detect (e.g., narrative contradictions,
// reasoning gaps, missing context).
// ============================================================

var REVIEW_SYSTEM_PROMPT = [
  "You are a Senior Level III NDT inspector and fitness-for-service engineer reviewing an automated assessment report for quality and consistency.",
  "Your job is to find errors, inconsistencies, and gaps that the automated engines may have missed.",
  "",
  "Review the report against these criteria:",
  "",
  "1. AUTHORITY CHAIN: Does the primary authority match the COMPONENT being assessed (not the facility it sits on)?",
  "   - Piping (headers, flowlines, risers, spools) -> API 570 + ASME B31.3",
  "   - Pressure vessels (separators, drums, columns) -> API 510 + ASME Section VIII",
  "   - Storage tanks -> API 653 + API 650",
  "   - Structural steel -> AWS D1.1 (+ API RP 2A only for offshore STRUCTURAL members)",
  "   - Pipelines -> PHMSA / ASME B31.8 or B31.4",
  "   - API RP 2A is ONLY for platform structural steel, NOT for piping/vessels on the platform",
  "",
  "2. MECHANISM CONSISTENCY: Do mechanism screening scores match the service environment?",
  "   - Sour/H2S service -> SSC and HIC should NOT be 0.00 (minimum 0.10 screening)",
  "   - CO2 in fluid -> CO2 corrosion should NOT be 0.00",
  "   - Insulated components -> CUI should be evaluated",
  "   - High-temperature H2S -> HTHA should be considered",
  "",
  "3. INSPECTION PLAN: Are NDE methods appropriate for the identified mechanisms?",
  "   - Cracking mechanisms REQUIRE crack-specific NDE (TOFD, PAUT, MT, PT)",
  "   - HIC requires volumetric inspection (straight beam UT or TOFD) — surface methods miss it",
  "   - CUI requires insulation removal or PEC screening",
  "   - Fatigue requires depth sizing capability (TOFD)",
  "",
  "4. CONFIDENCE GATE: If consequence tier is HIGH/CRITICAL and confidence < 0.60, disposition MUST be blocked",
  "",
  "5. NARRATIVE CONSISTENCY: Does the failure narrative match the mechanism analysis?",
  "   - If corrosion is governing, the narrative should not focus primarily on cracking",
  "   - If cracking is a screening candidate, it should be acknowledged even if not governing",
  "",
  "6. MISSING OVERLAYS: Are required supplemental codes included?",
  "   - Sour service -> NACE MR0175/ISO 15156",
  "   - Damage mechanisms -> API 571",
  "   - NDE methods -> ASME Section V",
  "   - Fitness-for-service -> API 579-1",
  "",
  "Return your findings as a JSON array of objects with these fields:",
  "  id: string (e.g. 'LLM-001')",
  "  category: string",
  "  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'",
  "  title: string",
  "  detail: string",
  "  recommendation: string",
  "",
  "Also return:",
  "  overall_assessment: string (1-2 sentence summary)",
  "  confidence: number (0-1, your confidence in this review)",
  "",
  "If no issues found, return an empty findings array with a positive overall_assessment.",
  "",
  "IMPORTANT: Be specific and technical. Reference specific API codes, ASME sections, and NACE standards.",
  "Do not flag issues you are not confident about. Only flag clear errors or gaps."
].join("\n");

async function runLLMReview(reportData: Record<string, any>): Promise<LLMReviewResult | null> {
  if (!ANTHROPIC_API_KEY) {
    return null;
  }

  var reportSummary = JSON.stringify(reportData, null, 2);
  // Truncate if too large (keep under 50k chars for token efficiency)
  if (reportSummary.length > 50000) {
    reportSummary = reportSummary.substring(0, 50000) + "\n... [truncated]";
  }

  try {
    var response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: REVIEW_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: "Review this assessment report for quality, consistency, and correctness. Return findings as JSON.\n\n" + reportSummary
          }
        ]
      })
    });

    if (!response.ok) {
      return null;
    }

    var responseBody = await response.json() as any;
    var content = responseBody.content && responseBody.content[0] && responseBody.content[0].text ? responseBody.content[0].text : "";

    // Extract JSON from response
    var jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        model: "claude-sonnet-4-20250514",
        findings: [],
        overall_assessment: "LLM review completed but response could not be parsed as JSON: " + content.substring(0, 200),
        confidence: 0.5
      };
    }

    var parsed = JSON.parse(jsonMatch[0]);
    var llmFindings: ReviewFinding[] = (parsed.findings || []).map(function(f: any) {
      return {
        id: f.id || "LLM-000",
        category: f.category || "general",
        severity: f.severity || "MEDIUM",
        title: f.title || "Untitled finding",
        detail: f.detail || "",
        recommendation: f.recommendation || "",
        auto_correctable: false,
        correction: null
      };
    });

    return {
      model: "claude-sonnet-4-20250514",
      findings: llmFindings,
      overall_assessment: parsed.overall_assessment || "Review complete",
      confidence: parsed.confidence || 0.75
    };

  } catch (err) {
    return {
      model: "claude-sonnet-4-20250514",
      findings: [],
      overall_assessment: "LLM review failed: " + ((err as any).message || String(err)),
      confidence: 0
    };
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================

var handler = async function(event: any) {
  var headers: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "review";

    if (action === "get_registry") {
      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({
          engine: "peer-review-gate",
          version: "1.0",
          deploy: "DEPLOY354",
          mode: "hybrid",
          description: "Self-review quality gate that acts as an automated peer reviewer on assembled assessment output. Runs deterministic rule-based checks and optional LLM review pass to catch consistency errors, authority mismatches, and logic gaps before the report is delivered.",
          actions: ["get_registry", "review", "deterministic_only"],
          deterministic_checks: [
            "authority_component_match",
            "sour_service_nace",
            "confidence_gate_enforcement",
            "cracking_nde_coverage",
            "mechanism_score_consistency",
            "co2_corrosion_score",
            "api_571_reference",
            "asme_section_v_reference"
          ],
          llm_review_categories: [
            "authority_chain",
            "mechanism_consistency",
            "inspection_plan",
            "confidence_gate",
            "narrative_consistency",
            "missing_overlays"
          ]
        })
      };
    }

    if (action === "deterministic_only") {
      var reportData = body.report_data || body;
      var detResult = runDeterministicChecks(reportData);

      var detStatus: "PASS" | "PASS_WITH_WARNINGS" | "FAIL_REVIEW_REQUIRED" = "PASS";
      var hasCritical = detResult.findings.some(function(f) { return f.severity === "CRITICAL"; });
      var hasHigh = detResult.findings.some(function(f) { return f.severity === "HIGH"; });
      if (hasCritical) {
        detStatus = "FAIL_REVIEW_REQUIRED";
      } else if (hasHigh || detResult.findings.length > 0) {
        detStatus = "PASS_WITH_WARNINGS";
      }

      var detReview: ReviewResult = {
        status: detStatus,
        findings: detResult.findings,
        deterministic_checks: detResult.checks,
        llm_review: null,
        metadata: {
          engine: "peer-review-gate",
          version: "1.0",
          mode: "deterministic_only",
          checks_run: detResult.checks.length,
          findings_count: detResult.findings.length,
          timestamp: new Date().toISOString()
        }
      };

      return { statusCode: 200, headers: headers, body: JSON.stringify(detReview) };
    }

    if (action === "review") {
      var fullReportData = body.report_data || body;
      var skipLLM = body.skip_llm === true;

      // Step 1: Run deterministic checks
      var deterministicResult = runDeterministicChecks(fullReportData);

      // Step 2: Run LLM review (unless skipped or no API key)
      var llmResult: LLMReviewResult | null = null;
      if (!skipLLM && ANTHROPIC_API_KEY) {
        llmResult = await runLLMReview(fullReportData);
      }

      // Step 3: Merge findings
      var allFindings: ReviewFinding[] = deterministicResult.findings.slice();
      if (llmResult && llmResult.findings) {
        for (var f = 0; f < llmResult.findings.length; f++) {
          allFindings.push(llmResult.findings[f]);
        }
      }

      // Step 4: Determine overall status
      var overallStatus: "PASS" | "PASS_WITH_WARNINGS" | "FAIL_REVIEW_REQUIRED" = "PASS";
      var criticalCount = 0;
      var highCount = 0;
      for (var s = 0; s < allFindings.length; s++) {
        if (allFindings[s].severity === "CRITICAL") criticalCount++;
        if (allFindings[s].severity === "HIGH") highCount++;
      }

      if (criticalCount > 0) {
        overallStatus = "FAIL_REVIEW_REQUIRED";
      } else if (highCount > 0 || allFindings.length > 2) {
        overallStatus = "PASS_WITH_WARNINGS";
      }

      // Step 5: Build auto-corrections list
      var autoCorrections: Record<string, any>[] = [];
      for (var c = 0; c < allFindings.length; c++) {
        if (allFindings[c].auto_correctable && allFindings[c].correction) {
          autoCorrections.push({
            finding_id: allFindings[c].id,
            category: allFindings[c].category,
            correction: allFindings[c].correction
          });
        }
      }

      var fullReview: ReviewResult = {
        status: overallStatus,
        findings: allFindings,
        deterministic_checks: deterministicResult.checks,
        llm_review: llmResult,
        metadata: {
          engine: "peer-review-gate",
          version: "1.0",
          mode: skipLLM ? "deterministic_only" : "full_review",
          deterministic_findings: deterministicResult.findings.length,
          llm_findings: llmResult ? llmResult.findings.length : 0,
          total_findings: allFindings.length,
          critical_count: criticalCount,
          high_count: highCount,
          auto_corrections_available: autoCorrections.length,
          auto_corrections: autoCorrections,
          timestamp: new Date().toISOString()
        }
      };

      return { statusCode: 200, headers: headers, body: JSON.stringify(fullReview) };
    }

    return { statusCode: 400, headers: headers, body: JSON.stringify({ error: "Unknown action: " + action }) };

  } catch (err) {
    return {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({ error: "Peer review gate error: " + ((err as any).message || String(err)) })
    };
  }
};

module.exports = { handler: handler };
