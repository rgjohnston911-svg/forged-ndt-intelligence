// ============================================================================
// REALITY CHALLENGE ENGINE v1.1 (HOTFIXED)
// Purpose: Evaluate alternate hypotheses + ambiguity for inspection scenarios
// Hotfix: ambiguityScore normalized to 0-1 scale (was 0-100, caused 9000% bug)
// Pattern: var handler, string concatenation, no template literals
// ============================================================================

var handler = async function(event) {
  "use strict";

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
    return { statusCode: 405, headers: headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    var body = JSON.parse(event.body || "{}");

    // ========================================================================
    // INPUTS — from pipeline data
    // ========================================================================

    var mechanisms = body.damage_mechanisms || body.mechanisms || [];
    var evidenceItems = body.evidence_items || body.evidence || [];
    var assetType = (body.asset_type || "").toLowerCase().trim();
    var serviceEnvironment = (body.service_environment || "").toLowerCase().trim();
    var wallLossPercent = body.wall_loss_percent || 0;
    var hasCracking = body.has_cracking || false;
    var transcript = (body.transcript || "").toLowerCase();
    var provenanceData = body.provenance || {};
    var observedCount = body.observed_count || 0;
    var suspectedCount = body.suspected_count || 0;
    var contradictions = body.contradictions || [];

    // ========================================================================
    // AMBIGUITY FLAG DETECTION
    // ========================================================================

    var ambiguityFlags = [];

    // Flag 1: Multiple competing mechanisms
    if (mechanisms.length > 1) {
      ambiguityFlags.push({
        flag: "MULTIPLE_MECHANISMS",
        detail: mechanisms.length + " damage mechanisms detected — competing failure modes",
        severity: "high"
      });
    }

    // Flag 2: Low observed-to-suspected ratio
    var totalEvidence = observedCount + suspectedCount;
    if (totalEvidence > 0 && observedCount < suspectedCount) {
      ambiguityFlags.push({
        flag: "LOW_OBSERVED_RATIO",
        detail: "Suspected evidence (" + suspectedCount + ") exceeds observed (" + observedCount + ") — conclusions may be speculative",
        severity: "high"
      });
    }

    // Flag 3: Contradictions present
    if (contradictions.length > 0) {
      ambiguityFlags.push({
        flag: "CONTRADICTIONS_DETECTED",
        detail: contradictions.length + " contradiction(s) in evidence — conflicting data must be resolved",
        severity: "critical"
      });
    }

    // Flag 4: Service environment not confirmed
    if (serviceEnvironment === "" || serviceEnvironment === "unknown" || serviceEnvironment === "unspecified") {
      ambiguityFlags.push({
        flag: "SERVICE_ENVIRONMENT_UNKNOWN",
        detail: "Service environment not specified — mechanism selection may be incorrect",
        severity: "medium"
      });
    }

    // Flag 5: Sour service without confirmation of H2S
    var isSourMentioned = serviceEnvironment.indexOf("sour") >= 0 || transcript.indexOf("sour") >= 0;
    var isH2SConfirmed = transcript.indexOf("h2s confirmed") >= 0 || transcript.indexOf("hydrogen sulfide confirmed") >= 0 || transcript.indexOf("h2s measured") >= 0;
    if (isSourMentioned && !isH2SConfirmed) {
      ambiguityFlags.push({
        flag: "SOUR_SERVICE_UNCONFIRMED",
        detail: "Sour service referenced but H2S presence not analytically confirmed",
        severity: "high"
      });
    }

    // Flag 6: Wall loss reported without UT grid or sizing
    if (wallLossPercent > 0) {
      var hasUTGrid = transcript.indexOf("ut grid") >= 0 || transcript.indexOf("grid survey") >= 0 || transcript.indexOf("thickness grid") >= 0;
      var hasSizing = transcript.indexOf("flaw length") >= 0 || transcript.indexOf("defect length") >= 0 || transcript.indexOf("axial extent") >= 0;
      if (!hasUTGrid && !hasSizing) {
        ambiguityFlags.push({
          flag: "WALL_LOSS_UNSIZED",
          detail: "Wall loss reported (" + wallLossPercent.toFixed(1) + "%) but no flaw sizing or UT grid data — B31G calculation may use assumed dimensions",
          severity: "medium"
        });
      }
    }

    // Flag 7: Cracking suspected but not confirmed by method
    if (hasCracking) {
      var crackConfirmed = transcript.indexOf("crack confirmed") >= 0 || transcript.indexOf("tofd") >= 0 || transcript.indexOf("paut confirmed") >= 0 || transcript.indexOf("crack verified") >= 0;
      if (!crackConfirmed) {
        ambiguityFlags.push({
          flag: "CRACKING_UNCONFIRMED",
          detail: "Cracking suspected but not confirmed by advanced method (TOFD, PAUT, or MT)",
          severity: "high"
        });
      }
    }

    // Flag 8: Material grade unknown
    var materialMentioned = transcript.indexOf("grade") >= 0 || transcript.indexOf("x52") >= 0 || transcript.indexOf("x65") >= 0 || transcript.indexOf("x70") >= 0 || transcript.indexOf("smys") >= 0;
    if (!materialMentioned && (assetType === "pipeline" || assetType === "piping" || assetType === "process_piping")) {
      ambiguityFlags.push({
        flag: "MATERIAL_GRADE_UNKNOWN",
        detail: "Material grade not specified — SMYS assumption required for strength calculations",
        severity: "medium"
      });
    }

    // Flag 9: MIC suspected without biological confirmation
    var micSuspected = false;
    mechanisms.forEach(function(m) {
      if ((m || "").toLowerCase().indexOf("mic") >= 0 || (m || "").toLowerCase().indexOf("microbiological") >= 0) {
        micSuspected = true;
      }
    });
    if (micSuspected) {
      var micConfirmed = transcript.indexOf("culture") >= 0 || transcript.indexOf("biological") >= 0 || transcript.indexOf("bacteria confirmed") >= 0 || transcript.indexOf("srb") >= 0;
      if (!micConfirmed) {
        ambiguityFlags.push({
          flag: "MIC_UNCONFIRMED",
          detail: "MIC suspected but no biological confirmation (culture, SRB testing) — morphology alone is insufficient",
          severity: "high"
        });
      }
    }

    // ========================================================================
    // ALTERNATE HYPOTHESIS GENERATION
    // ========================================================================

    var alternateHypotheses = [];

    // If corrosion reported in sour service, HIC/SOHIC is alternate
    var hasCorrosion = false;
    mechanisms.forEach(function(m) {
      if ((m || "").toLowerCase().indexOf("corrosion") >= 0 || (m || "").toLowerCase().indexOf("wall_loss") >= 0) {
        hasCorrosion = true;
      }
    });

    if (hasCorrosion && isSourMentioned) {
      alternateHypotheses.push({
        hypothesis: "HIC/SOHIC masquerading as general corrosion",
        basis: "Sour service environment with apparent wall loss — hydrogen-induced cracking can produce blistering and stepwise cracking that mimics general metal loss on conventional UT",
        test_to_resolve: "WFMT or PAUT with C-scan to differentiate volumetric loss from planar cracking",
        consequence_if_missed: "Catastrophic brittle fracture without warning — corrosion-rate-based monitoring would be non-conservative"
      });
    }

    // If external corrosion reported, CUI is alternate
    if (transcript.indexOf("external") >= 0 && hasCorrosion) {
      alternateHypotheses.push({
        hypothesis: "Corrosion under insulation (CUI)",
        basis: "External corrosion on insulated equipment frequently indicates CUI — localized readings may underestimate extent",
        test_to_resolve: "Insulation removal and full surface inspection, or profile radiography through insulation",
        consequence_if_missed: "Widespread hidden wall loss under insulation — single-point UT is non-representative"
      });
    }

    // If pitting reported, MIC is alternate
    if (transcript.indexOf("pitting") >= 0 && !micSuspected) {
      alternateHypotheses.push({
        hypothesis: "Microbiologically influenced corrosion (MIC)",
        basis: "Pitting morphology in certain environments (stagnant, low-flow, or with organic deposits) suggests possible MIC contribution",
        test_to_resolve: "Biological sampling, SRB culture, deposit analysis",
        consequence_if_missed: "Corrosion rate predictions based on chemical corrosion models would be non-conservative — MIC can accelerate pitting 10x"
      });
    }

    // If single-mechanism identified, fatigue is alternate for cyclic service
    var isCyclicService = transcript.indexOf("cyclic") >= 0 || transcript.indexOf("startup") >= 0 || transcript.indexOf("shutdown") >= 0 || transcript.indexOf("thermal cycling") >= 0 || transcript.indexOf("pressure cycling") >= 0;
    if (isCyclicService && !hasCracking) {
      alternateHypotheses.push({
        hypothesis: "Fatigue cracking at stress concentration",
        basis: "Cyclic service conditions reported — fatigue initiation at welds, nozzles, or geometric discontinuities is possible concurrent mechanism",
        test_to_resolve: "TOFD or PAUT at stress concentrations, review of cycle count history",
        consequence_if_missed: "Fatigue crack growth to critical size between inspection intervals"
      });
    }

    // If cracking in sour service, SSC is alternate
    if (hasCracking && isSourMentioned) {
      var hasSSC = false;
      mechanisms.forEach(function(m) {
        if ((m || "").toLowerCase().indexOf("ssc") >= 0 || (m || "").toLowerCase().indexOf("sscc") >= 0 || (m || "").toLowerCase().indexOf("sulfide stress") >= 0) {
          hasSSC = true;
        }
      });
      if (!hasSSC) {
        alternateHypotheses.push({
          hypothesis: "Sulfide stress cracking (SSC)",
          basis: "Cracking in sour service — SSC produces sudden brittle failure in high-hardness zones (HAZ, hard spots) without prior wall loss indication",
          test_to_resolve: "Hardness testing of base metal + HAZ, material verification against NACE MR0175 limits",
          consequence_if_missed: "Sudden brittle fracture — SSC failures are catastrophic with no leak-before-break behavior"
        });
      }
    }

    // ========================================================================
    // COMPUTE AMBIGUITY SCORE (0-1 scale)
    // ========================================================================

    var ambiguityScore = 0;
    var maxScore = 0;

    ambiguityFlags.forEach(function(flag) {
      if (flag.severity === "critical") {
        ambiguityScore = ambiguityScore + 30;
      } else if (flag.severity === "high") {
        ambiguityScore = ambiguityScore + 20;
      } else if (flag.severity === "medium") {
        ambiguityScore = ambiguityScore + 10;
      } else {
        ambiguityScore = ambiguityScore + 5;
      }
    });

    // Add for alternate hypotheses
    ambiguityScore = ambiguityScore + (alternateHypotheses.length * 10);

    // Cap at 100 then normalize to 0-1
    if (ambiguityScore > 100) {
      ambiguityScore = 100;
    }

    // === HOTFIX: normalize to 0-1 scale ===
    // RealityChallengeCard multiplies by 100 for display
    // Engine must output 0-1 decimals
    ambiguityScore = ambiguityScore / 100;

    // ========================================================================
    // DETERMINE STATUS
    // ========================================================================

    var status = "PASS";
    var statusReason = "No significant ambiguity detected";

    if (ambiguityScore >= 0.70) {
      status = "DEFER_TO_UNKNOWN";
      statusReason = "High ambiguity (" + (ambiguityScore * 100).toFixed(0) + "%) — too many unresolved factors to support confident disposition";
    } else if (ambiguityScore >= 0.40) {
      status = "CHALLENGE";
      statusReason = "Moderate ambiguity (" + (ambiguityScore * 100).toFixed(0) + "%) — alternate hypotheses should be evaluated before disposition";
    } else if (ambiguityScore >= 0.20) {
      status = "ADVISORY";
      statusReason = "Low ambiguity (" + (ambiguityScore * 100).toFixed(0) + "%) — minor gaps noted, disposition may proceed with caveats";
    }

    // ========================================================================
    // RESPONSE
    // ========================================================================

    var result = {
      status: status,
      statusReason: statusReason,
      ambiguityScore: ambiguityScore,
      ambiguityFlags: ambiguityFlags,
      ambiguityFlagCount: ambiguityFlags.length,
      alternateHypotheses: alternateHypotheses,
      alternateHypothesisCount: alternateHypotheses.length,
      metadata: {
        engine: "reality-challenge",
        version: "1.1",
        hotfix: "ambiguity_score_0_1_scale",
        timestamp: new Date().toISOString()
      }
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
      body: JSON.stringify({ error: "Reality challenge engine error: " + (err.message || String(err)) })
    };
  }
};

module.exports = { handler: handler };
