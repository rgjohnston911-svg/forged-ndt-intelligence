// ============================================================================
// UNKNOWN STATE ENGINE v1.1 (HOTFIXED)
// Purpose: Determine if enough evidence exists to support disposition
// Blocks disposition when reality state is UNKNOWN
// Hotfix: threshold check uses 0-1 scale (>= 0.50 not >= 50)
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
    // INPUTS
    // ========================================================================

    var assetType = (body.asset_type || "").toLowerCase().trim();
    var serviceEnvironment = (body.service_environment || "").toLowerCase().trim();
    var mechanisms = body.damage_mechanisms || body.mechanisms || [];
    var wallLossPercent = body.wall_loss_percent || 0;
    var hasCracking = body.has_cracking || false;
    var transcript = (body.transcript || "").toLowerCase();
    var observedCount = body.observed_count || 0;
    var suspectedCount = body.suspected_count || 0;
    var contradictions = body.contradictions || [];
    var ambiguityScore = body.ambiguity_score || 0;
    var evidenceItems = body.evidence_items || [];
    var provenanceData = body.provenance || {};

    // ========================================================================
    // MINIMUM DATA REQUIREMENTS — what MUST be known to disposition
    // ========================================================================

    var minimumDataItems = [];

    // --- ALWAYS REQUIRED ---

    // Asset identification
    if (!assetType || assetType === "unknown" || assetType === "unspecified" || assetType === "") {
      minimumDataItems.push({
        item: "Asset Type Identification",
        reason: "Cannot select governing code or assessment method without knowing what the asset is",
        priority: "CRITICAL",
        resolved: false
      });
    } else {
      minimumDataItems.push({
        item: "Asset Type Identification",
        reason: "Asset identified as: " + assetType,
        priority: "CRITICAL",
        resolved: true
      });
    }

    // Service environment
    if (!serviceEnvironment || serviceEnvironment === "unknown" || serviceEnvironment === "unspecified" || serviceEnvironment === "") {
      minimumDataItems.push({
        item: "Service Environment",
        reason: "Service conditions determine mechanism susceptibility and material requirements",
        priority: "CRITICAL",
        resolved: false
      });
    } else {
      minimumDataItems.push({
        item: "Service Environment",
        reason: "Service identified as: " + serviceEnvironment,
        priority: "CRITICAL",
        resolved: true
      });
    }

    // Damage mechanism
    if (!mechanisms || mechanisms.length === 0) {
      minimumDataItems.push({
        item: "Damage Mechanism Identification",
        reason: "At least one damage mechanism must be identified or suspected to evaluate integrity",
        priority: "CRITICAL",
        resolved: false
      });
    } else {
      minimumDataItems.push({
        item: "Damage Mechanism Identification",
        reason: mechanisms.length + " mechanism(s) identified",
        priority: "CRITICAL",
        resolved: true
      });
    }

    // --- CONDITIONAL REQUIREMENTS ---

    // If wall loss detected, need sizing
    if (wallLossPercent > 0) {
      var hasNominalWall = transcript.indexOf("nominal") >= 0 || transcript.indexOf("schedule") >= 0 || transcript.indexOf("nom wall") >= 0;
      if (!hasNominalWall) {
        minimumDataItems.push({
          item: "Nominal Wall Thickness",
          reason: "Wall loss of " + wallLossPercent.toFixed(1) + "% reported but nominal wall not provided — cannot calculate remaining strength",
          priority: "CRITICAL",
          resolved: false
        });
      }

      var hasFlawLength = transcript.indexOf("flaw length") >= 0 || transcript.indexOf("defect length") >= 0 || transcript.indexOf("axial extent") >= 0 || transcript.indexOf("axial length") >= 0;
      if (!hasFlawLength) {
        minimumDataItems.push({
          item: "Flaw Axial Length",
          reason: "Wall loss detected but flaw length not provided — required for B31G remaining strength calculation",
          priority: "HIGH",
          resolved: false
        });
      }

      var hasDiameter = transcript.indexOf("diameter") >= 0 || transcript.indexOf("pipe od") >= 0 || transcript.indexOf("inch pipe") >= 0 || transcript.indexOf("\" pipe") >= 0 || transcript.indexOf("nps") >= 0;
      if (!hasDiameter && (assetType === "pipeline" || assetType === "piping" || assetType === "process_piping")) {
        minimumDataItems.push({
          item: "Pipe Diameter / OD",
          reason: "Required for B31G and Barlow pressure calculations",
          priority: "HIGH",
          resolved: false
        });
      }
    }

    // If sour service, need material verification
    var isSour = serviceEnvironment.indexOf("sour") >= 0 || transcript.indexOf("sour") >= 0 || transcript.indexOf("h2s") >= 0;
    if (isSour) {
      var hasMaterialVerification = transcript.indexOf("material cert") >= 0 || transcript.indexOf("mtr") >= 0 || transcript.indexOf("material test report") >= 0 || transcript.indexOf("pmi") >= 0 || transcript.indexOf("hardness") >= 0;
      if (!hasMaterialVerification) {
        minimumDataItems.push({
          item: "Material Verification (Sour Service)",
          reason: "Sour service requires material suitability verification per NACE MR0175 — hardness, chemistry, and/or PMI needed",
          priority: "CRITICAL",
          resolved: false
        });
      }
    }

    // If cracking detected, need crack characterization
    if (hasCracking) {
      var hasCrackSizing = transcript.indexOf("crack length") >= 0 || transcript.indexOf("crack depth") >= 0 || transcript.indexOf("flaw height") >= 0 || transcript.indexOf("through-wall") >= 0;
      if (!hasCrackSizing) {
        minimumDataItems.push({
          item: "Crack Sizing (Length + Depth)",
          reason: "Cracking detected but crack dimensions not provided — required for API 579-1 Part 9 assessment",
          priority: "CRITICAL",
          resolved: false
        });
      }

      var hasCrackOrientation = transcript.indexOf("axial crack") >= 0 || transcript.indexOf("circumferential") >= 0 || transcript.indexOf("longitudinal") >= 0 || transcript.indexOf("transverse") >= 0;
      if (!hasCrackOrientation) {
        minimumDataItems.push({
          item: "Crack Orientation",
          reason: "Crack orientation (axial vs circumferential) determines governing stress and assessment approach",
          priority: "HIGH",
          resolved: false
        });
      }
    }

    // Operating conditions
    var hasOperatingPressure = transcript.indexOf("operating pressure") >= 0 || transcript.indexOf("maop") >= 0 || transcript.indexOf("mawp") >= 0 || transcript.indexOf("psi") >= 0 || transcript.indexOf("operating at") >= 0;
    if (!hasOperatingPressure && (assetType === "pipeline" || assetType === "piping" || assetType === "pressure_vessel" || assetType === "vessel")) {
      minimumDataItems.push({
        item: "Operating Pressure",
        reason: "Operating pressure required to evaluate safe operating envelope and remaining strength adequacy",
        priority: "HIGH",
        resolved: false
      });
    }

    // Inspection method adequacy
    if (observedCount === 0 && suspectedCount > 0) {
      minimumDataItems.push({
        item: "Confirmatory Inspection Method",
        reason: "All evidence is SUSPECTED with zero OBSERVED — at least one finding must be confirmed by appropriate inspection method",
        priority: "CRITICAL",
        resolved: false
      });
    }

    // ========================================================================
    // REASON CODES — why state is UNKNOWN
    // ========================================================================

    var reasonCodes = [];

    // Check unresolved critical items
    var unresolvedCritical = minimumDataItems.filter(function(item) {
      return !item.resolved && item.priority === "CRITICAL";
    });

    var unresolvedHigh = minimumDataItems.filter(function(item) {
      return !item.resolved && item.priority === "HIGH";
    });

    if (unresolvedCritical.length > 0) {
      unresolvedCritical.forEach(function(item) {
        reasonCodes.push({
          code: "MISSING_CRITICAL_DATA",
          detail: item.item + " — " + item.reason,
          blocking: true
        });
      });
    }

    if (unresolvedHigh.length > 0) {
      unresolvedHigh.forEach(function(item) {
        reasonCodes.push({
          code: "MISSING_HIGH_DATA",
          detail: item.item + " — " + item.reason,
          blocking: false
        });
      });
    }

    // Contradictions block disposition
    if (contradictions.length > 0) {
      reasonCodes.push({
        code: "UNRESOLVED_CONTRADICTIONS",
        detail: contradictions.length + " contradiction(s) in evidence must be resolved before disposition",
        blocking: true
      });
    }

    // === HOTFIX: threshold uses 0-1 scale ===
    // ambiguityScore from reality-challenge is now 0-1
    if (ambiguityScore >= 0.50) {
      reasonCodes.push({
        code: "HIGH_AMBIGUITY",
        detail: "Ambiguity score " + (ambiguityScore * 100).toFixed(0) + "% exceeds 50% threshold — too much uncertainty for reliable disposition",
        blocking: true
      });
    }

    // Sour service cracking must be ruled out
    if (isSour && !hasCracking) {
      var crackingRuledOut = transcript.indexOf("no cracking") >= 0 || transcript.indexOf("cracking ruled out") >= 0 || transcript.indexOf("no indications") >= 0 || transcript.indexOf("crack-free") >= 0;
      if (!crackingRuledOut) {
        reasonCodes.push({
          code: "SOUR_CRACKING_NOT_RULED_OUT",
          detail: "Sour service cracking (SSC/HIC) must be ruled out before disposition — absence of evidence is not evidence of absence",
          blocking: true
        });
      }
    }

    // ========================================================================
    // DETERMINE REALITY STATE
    // ========================================================================

    var blockingReasons = reasonCodes.filter(function(r) { return r.blocking; });
    var nonBlockingReasons = reasonCodes.filter(function(r) { return !r.blocking; });

    var realityState = "KNOWN";
    var dispositionBlocked = false;
    var stateReason = "Sufficient data exists to support disposition";

    if (blockingReasons.length > 0) {
      realityState = "UNKNOWN";
      dispositionBlocked = true;
      stateReason = blockingReasons.length + " blocking condition(s) prevent disposition — additional data required";
    } else if (nonBlockingReasons.length >= 3) {
      realityState = "PARTIALLY_KNOWN";
      dispositionBlocked = false;
      stateReason = "Disposition may proceed with caveats — " + nonBlockingReasons.length + " non-critical data gaps noted";
    }

    // ========================================================================
    // RESPONSE
    // ========================================================================

    var result = {
      realityState: realityState,
      dispositionBlocked: dispositionBlocked,
      stateReason: stateReason,
      reasonCodes: reasonCodes,
      reasonCodeCount: reasonCodes.length,
      blockingCount: blockingReasons.length,
      nonBlockingCount: nonBlockingReasons.length,
      minimumDataRequired: minimumDataItems,
      minimumDataResolvedCount: minimumDataItems.filter(function(i) { return i.resolved; }).length,
      minimumDataUnresolvedCount: minimumDataItems.filter(function(i) { return !i.resolved; }).length,
      metadata: {
        engine: "unknown-state",
        version: "1.1",
        hotfix: "threshold_0_1_scale",
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
      body: JSON.stringify({ error: "Unknown state engine error: " + (err.message || String(err)) })
    };
  }
};

module.exports = { handler: handler };
