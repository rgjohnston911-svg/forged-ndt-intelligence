// FAILURE MODE DOMINANCE ENGINE v1.4.0
// File: netlify/functions/failure-mode-dominance.js
// NO TYPESCRIPT -- PURE JAVASCRIPT
//
// v1.4.0: DEPLOY174+ CATALOG FAMILY MAP
//        Adds CATALOG_FAMILY_MAP that maps all 21 decision-core catalog
//        mechanism IDs to their canonical FMD failure mode families.
//        Classification loop checks the map FIRST before keyword fallback.
//        Prevents drift between decision-core catalog and FMD classification
//        (e.g. sulfidation, creep, brittle_fracture, fire_damage, hydrogen_damage
//        were falling through to otherMechanisms because no keyword matched).
//
// v1.3.2 HOTFIX: MISALIGNMENT CONTEXT DISCRIMINATOR
//        "misalignment" / "misaligned" / "out of alignment" were in the
//        unconditional globalIndicators list in v1.3.1 (inherited from v1.2),
//        so any mention of local fitup misalignment at a branch reinforcement
//        or nozzle connection triggered false STRUCTURAL_INSTABILITY promotion
//        with GLOBAL_PLASTIC_DEFORMATION capacity state.
//
//        Scenario that exposed this: "Slight misalignment visible at a nearby
//        branch reinforcement area" -- local piping fitup concern, NOT global
//        structural instability. Engine was governing STRUCTURAL_INSTABILITY
//        on a 16-inch hot hydrocarbon overhead line that had no global
//        deformation evidence whatsoever.
//
//        Fix: move misalignment terms into ambiguousTerms so they go through
//        the ±60 char context window check against localContextWords. Also
//        add "distortion" to ambiguousTerms (was missing; "distorted" was
//        there but "distortion" wasn't) and add piping-specific local context
//        words: "branch reinforcement", "branch connection", "fitup",
//        "fit up", "fit-up", "nozzle connection".
//
//        Regression tested: tank scenario with REAL "out of plumb" + "out of
//        round" + "differential settlement" still correctly triggers
//        STRUCTURAL_INSTABILITY. Scenario 3 misalignment-at-branch no longer
//        triggers. Zero behavior change on real structural distress cases.
//
// v1.3.1 HOTFIX: WORD-BOUNDARY GUARDS on structural keyword scans.
//        Naive indexOf() was matching "cleaning" -> "leaning",
//        "blistering" -> "listing"/"list", producing false STRUCTURAL_INSTABILITY
//        promotions on scenarios with no actual tilt/lean/settlement evidence.
//        Adds hasWordBoundaryMatch() helper and applies it to:
//          - transcript scans for tilt/lean/list/settlement/buckling
//          - mechanism classifier's structural branch (tilt/lean/list tokens)
//        Zero behavior change on scenarios with real structural evidence.
//        Kills the "cleaning the weld area" -> CRITICAL STRUCTURAL INSTABILITY
//        cascade on the SWS scenario 2 run.
//
// v1.3: CONFIRMATION-STATE GATE on brittle_fracture_risk.
//       Bare presence of "hic" / "ssc" / "scc" / "crack" in a mechanism list
//       or transcript is NO LONGER sufficient to trigger brittle fracture risk
//       or govern as CRACKING. Engine now scans ±80 chars around each cracking
//       keyword to infer confirmation state:
//         "observed"           -- WFMT/PAUT hit, confirmed, detected, found
//         "screening_required" -- potential, possible, susceptible, known DM list
//         "ruled_out"          -- no cracks, none found, negative result
//       brittle_fracture_risk fires only on "observed" OR when caller explicitly
//       passes body.cracking_confirmed = true.
//       When cracking is screening_required only and corrosion is active,
//       governing mode = CORROSION and a screening_gate is emitted so disposition
//       cannot finalize until crack-specific NDE is performed.
//
// v1.2: Deformation context discriminator (unchanged).
// v1.1: STRUCTURAL_INSTABILITY third path (unchanged).

// ============================================================================
// v1.2 HELPER -- DEFORMATION CONTEXT DISCRIMINATOR (unchanged)
// ============================================================================
function isGlobalDeformation(text) {
  var globalIndicators = [
    "out of round", "out-of-round", "ovality", "ovalization",
    "bowed", "bowing", "sagging", " sag ", " sag.",
    "wrinkle", "wrinkling",
    "permanent displacement", "excessive displacement", "gross displacement",
    "load path failure", "load path loss", "loss of load path",
    "gross deformation", "global deformation", "severe deformation",
    "pipe displaced", "line displaced", "line moved", "member displaced",
    "lost plumb", "out of plumb", "off vertical",
    "collapsed", "collapse of", "partial collapse",
    "plastic hinge", "yielded member", "yielded section",
    "permanent set", "permanent strain"
  ];
  for (var i = 0; i < globalIndicators.length; i++) {
    if (text.indexOf(globalIndicators[i]) >= 0) return true;
  }
  // v1.3.2: misalignment/misaligned/out of alignment/distortion moved here
  // so they go through the ±60 char context check before triggering structural.
  var ambiguousTerms = ["deformation", "deformed", " bent ", " bent.", " bent,",
                        "distorted", "distortion",
                        "misalignment", "misaligned", "out of alignment"];
  var localContextWords = [
    "shoe", "lug", "clip", "bracket", "gusset", " pad ", " pad.", " pad,",
    "saddle", "attachment", "repad", "re-pad", "reinforcement pad",
    "stiffener", "support attachment", "shoe attachment", "lug attachment",
    "anchor bolt", "flange bolt", "bolt hole", "nozzle repad",
    "pipe shoe", "shoe support", "u-bolt", "hold down",
    "clamp", "strap", "hanger", "hanger rod",
    // v1.3.2: piping-specific local contexts for misalignment/distortion
    "branch reinforcement", "branch connection", "nozzle connection",
    "fitup", "fit up", "fit-up", "fabrication fit"
  ];
  for (var a = 0; a < ambiguousTerms.length; a++) {
    var term = ambiguousTerms[a];
    var searchFrom = 0;
    var idx = text.indexOf(term, searchFrom);
    while (idx >= 0) {
      var start = Math.max(0, idx - 60);
      var end = Math.min(text.length, idx + term.length + 60);
      var context = text.substring(start, end);
      var isLocal = false;
      for (var c = 0; c < localContextWords.length; c++) {
        if (context.indexOf(localContextWords[c]) >= 0) {
          isLocal = true;
          break;
        }
      }
      if (!isLocal) return true;
      searchFrom = idx + term.length;
      idx = text.indexOf(term, searchFrom);
    }
  }
  return false;
}

// ============================================================================
// v1.3.1 HELPER -- WORD-BOUNDARY MATCH
// ============================================================================
// Returns true if keyword appears in text with word boundaries on both sides
// (non-word char before, non-word char after, or start/end of string).
// A "word char" is [a-z0-9_]. This kills the "cleaning" -> "leaning" and
// "blistering" -> "listing"/"list" false positives without requiring regex.
function hasWordBoundaryMatch(text, keyword) {
  if (!text || !keyword) return false;
  var searchFrom = 0;
  var idx = text.indexOf(keyword, searchFrom);
  while (idx >= 0) {
    var before = idx === 0 ? "" : text.charAt(idx - 1);
    var afterIdx = idx + keyword.length;
    var after = afterIdx >= text.length ? "" : text.charAt(afterIdx);
    var beforeOK = (before === "") || !isWordChar(before);
    var afterOK = (after === "") || !isWordChar(after);
    if (beforeOK && afterOK) return true;
    searchFrom = idx + 1;
    idx = text.indexOf(keyword, searchFrom);
  }
  return false;
}

function isWordChar(ch) {
  if (!ch) return false;
  var c = ch.charCodeAt(0);
  // 0-9
  if (c >= 48 && c <= 57) return true;
  // A-Z
  if (c >= 65 && c <= 90) return true;
  // a-z
  if (c >= 97 && c <= 122) return true;
  // underscore
  if (c === 95) return true;
  return false;
}

// ============================================================================
// v1.3 HELPER -- CRACK CONFIRMATION STATE INFERENCE
// ============================================================================
// For each occurrence of a cracking keyword in the transcript, scan ±80 chars
// of surrounding context and classify the mention as:
//   "observed"           -- strong evidence of confirmed finding
//   "ruled_out"          -- negative result from inspection
//   "screening_required" -- listed as mechanism class, no inspection evidence
// Returns the STRONGEST confirmation found across all occurrences.
// Precedence: observed > ruled_out > screening_required > none
function inferCrackConfirmationState(text, keyword) {
  var observedIndicators = [
    "observed", "confirmed", "detected", "crack found", "cracks found",
    "crack indication", "cracks indication", "linear indication",
    "crack-like indication", "cracklike indication",
    "wfmt hit", "wfmt indication", "wfmt positive", "wfmt found",
    "mt indication", "pt indication", "mt positive", "pt positive",
    "paut showed", "paut detected", "paut indication", "paut crack",
    "tofd showed", "tofd detected", "tofd indication",
    "crack measured", "crack sized", "crack dimensions",
    "visible crack", "visible cracking", "crack present",
    "crack verified", "cracking verified", "cracking confirmed",
    "hardness exceeded", "hardness above nace", "exceeds mr0175",
    "fractured", "fracture surface"
  ];

  var ruledOutIndicators = [
    "no crack", "no cracks", "no cracking", "cracks ruled out",
    "no indication", "no indications", "no linear indication",
    "wfmt clean", "wfmt negative", "wfmt clear",
    "mt clean", "pt clean", "mt negative", "pt negative",
    "paut clean", "paut negative", "tofd clean", "tofd negative",
    "cleared", "not detected", "none found", "none observed",
    "ruled out"
  ];

  var screeningIndicators = [
    "potential", "possible", "possibility", "susceptible", "susceptibility",
    "known damage mechanism", "known damage mechanisms",
    "damage mechanism context", "damage mechanisms:",
    "screening", "may occur", "risk of", "can occur", "could occur",
    "candidate mechanism", "candidate mechanisms",
    "typical for", "typical of", "expected mechanism",
    "plausible", "suspect", "suspected"
  ];

  var state = "none";
  var searchFrom = 0;
  var idx = text.indexOf(keyword, searchFrom);

  while (idx >= 0) {
    var start = Math.max(0, idx - 80);
    var end = Math.min(text.length, idx + keyword.length + 80);
    var context = text.substring(start, end);

    // Check ruled_out FIRST so "no cracks found" doesn't match "found"
    var foundRuledOut = false;
    for (var r = 0; r < ruledOutIndicators.length; r++) {
      if (context.indexOf(ruledOutIndicators[r]) >= 0) { foundRuledOut = true; break; }
    }

    if (foundRuledOut) {
      if (state === "none" || state === "screening_required") state = "ruled_out";
    } else {
      var foundObserved = false;
      for (var o = 0; o < observedIndicators.length; o++) {
        if (context.indexOf(observedIndicators[o]) >= 0) { foundObserved = true; break; }
      }
      if (foundObserved) {
        state = "observed"; // strongest -- short-circuit later
      } else {
        var foundScreening = false;
        for (var s = 0; s < screeningIndicators.length; s++) {
          if (context.indexOf(screeningIndicators[s]) >= 0) { foundScreening = true; break; }
        }
        if (foundScreening) {
          if (state === "none") state = "screening_required";
        }
      }
    }

    searchFrom = idx + keyword.length;
    idx = text.indexOf(keyword, searchFrom);
  }

  // If the keyword appears but no context indicators at all -> default conservative
  if (state === "none" && text.indexOf(keyword) >= 0) {
    state = "screening_required";
  }

  return state;
}

// ======================================================================
// DEPLOY174+: CATALOG FAMILY MAP
// Maps all 28 decision-core catalog mechanism IDs to their canonical FMD
// failure mode family. When a mechanism ID is recognized in this map, the
// classification loop uses the map instead of keyword matching. This
// prevents drift between decision-core's catalog and FMD's classification.
//
// Families: "corrosion", "cracking", "structural", "thermal_degradation"
// thermal_degradation is a new family for mechanisms that don't fit the
// traditional corrosion/cracking/structural split but need to be tracked
// separately from "other" (which implies truly unknown).
// ======================================================================
var CATALOG_FAMILY_MAP = {
  // Corrosion family (wall thinning / material loss)
  "cui": "corrosion",
  "general_corrosion": "corrosion",
  "pitting": "corrosion",
  "co2_corrosion": "corrosion",
  "erosion": "corrosion",
  "sulfidation": "corrosion",
  "mic": "corrosion",
  "underdeposit_corrosion": "corrosion",
  // Cracking family (crack initiation / propagation)
  "cscc": "cracking",
  "scc_chloride": "cracking",
  "scc_caustic": "cracking",
  "ssc_sulfide": "cracking",
  "hic": "cracking",
  "fatigue_mechanical": "cracking",
  "fatigue_thermal": "cracking",
  "fatigue_vibration": "cracking",
  "hydrogen_damage": "cracking",
  // Structural family (geometry / stability)
  "overload_buckling": "structural",
  // Thermal degradation family (property loss, not wall loss)
  "creep": "thermal_degradation",
  "brittle_fracture": "thermal_degradation",
  "fire_damage": "thermal_degradation",
  // DEPLOY185: Naphthenic acid corrosion + Polythionic acid SCC
  "naphthenic_acid_corrosion": "corrosion",
  "polythionic_acid_scc": "cracking",
  // DEPLOY186: Amine cracking + Carbonate SCC
  "amine_cracking": "cracking",
  "carbonate_scc": "cracking",
  // DEPLOY187: Embrittlement mechanisms
  "embrittlement_885f": "thermal_degradation",
  "sigma_phase_embrittlement": "thermal_degradation",
  "temper_embrittlement": "thermal_degradation"
};

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
    // DEPLOY171.7: DOMAIN REFUSAL SHORT-CIRCUIT
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
          refusal_reason: "Upstream decision-core refused this asset domain. Failure mode dominance analysis not performed.",
          governing_failure_mode: "DOMAIN_NOT_SUPPORTED",
          governing_mechanism: null,
          failure_mode_scores: {},
          structural_override: false,
          misalignment_flags: [],
          engine_version: "failure-mode-dominance-v1.3.2-deploy171.7"
        })
      };
    }

    var mechanisms = (body.damage_mechanisms || []).map(function(m) { return (m || "").toLowerCase().trim(); });
    var remainingStrength = body.remaining_strength || null;
    var authorityLock = body.authority_lock || null;
    var wallLossPercent = body.wall_loss_percent || 0;
    var hasCracking = body.has_cracking || false;
    var crackingConfirmed = body.cracking_confirmed || false; // v1.3 caller override
    var serviceEnvironment = (body.service_environment || "").toLowerCase().trim();
    var transcript = (body.transcript || "").toLowerCase();
    var operatingPressure = body.operating_pressure || 0;
    var nominalWall = body.nominal_wall || 0;
    var measuredMinWall = body.measured_minimum_wall || 0;
    var pipeOD = body.pipe_od || 0;
    var smys = body.smys || 0;

    var hasTilt = body.has_tilt || body.has_lean || false;
    var hasSettlement = body.has_settlement || body.has_foundation_movement || false;
    var hasBuckling = body.has_buckling || false;
    var hasDeformation = body.has_deformation || false;
    var assetClass = (body.asset_class || "").toLowerCase().trim();

    // ====================================================================
    // CLASSIFY EACH MECHANISM INTO FAILURE MODE CATEGORY
    // ====================================================================

    var corrosionMechanisms = [];
    var crackingMechanisms = [];
    var structuralMechanisms = [];
    var otherMechanisms = [];

    mechanisms.forEach(function(mech) {
      // v1.3.1: normalize underscores to spaces so word-boundary helper works
      // on snake_case mechanism tokens (e.g. "tilt_severe" -> "tilt severe")
      var mechNorm = mech.replace(/_/g, " ");

      // DEPLOY174+: Check catalog family map FIRST before keyword fallback
      var catalogFamily = CATALOG_FAMILY_MAP[mech] || null;
      if (catalogFamily === "corrosion") {
        corrosionMechanisms.push(mech);
      } else if (catalogFamily === "cracking") {
        crackingMechanisms.push(mech);
      } else if (catalogFamily === "structural") {
        structuralMechanisms.push(mech);
      } else if (catalogFamily === "thermal_degradation") {
        // Thermal degradation mechanisms (creep, brittle fracture, fire damage)
        // are tracked in corrosion path for FFS purposes -- wall thinning and
        // property degradation both route through API 579-1 Part 4/10/11.
        // They don't belong in "other" because they are known, real mechanisms.
        corrosionMechanisms.push(mech);
      } else if (mech.indexOf("crack") >= 0 || mech.indexOf("scc") >= 0 || mech.indexOf("ssc") >= 0 ||
          mech.indexOf("sscc") >= 0 || mech.indexOf("hic") >= 0 || mech.indexOf("sohic") >= 0 ||
          mech.indexOf("fatigue") >= 0 || mech === "hydrogen_induced_cracking" ||
          mech === "sulfide_stress_cracking" || mech === "stress_corrosion_cracking" ||
          mech.indexOf("cwb") >= 0 || mech.indexOf("hydrogen_embrittlement") >= 0) {
        crackingMechanisms.push(mech);
      }
      else if (mech.indexOf("corrosion") >= 0 || mech.indexOf("wall_loss") >= 0 ||
               mech.indexOf("pitting") >= 0 || mech.indexOf("erosion") >= 0 ||
               mech.indexOf("mic") >= 0 || mech.indexOf("co2") >= 0 ||
               mech.indexOf("thinning") >= 0 || mech.indexOf("galvanic") >= 0 ||
               mech.indexOf("cui") >= 0 || mech.indexOf("metal_loss") >= 0 ||
               mech.indexOf("blister") >= 0) {
        // v1.3.1: "blister" -> corrosion family (was falling into structural via "list" substring)
        corrosionMechanisms.push(mech);
      }
      // Structural instability family -- v1.3.1 uses word-boundary matching
      // on the short ambiguous keywords (tilt/lean/list) to prevent substring
      // collisions like "blistering" -> "listing" / "list".
      else if (hasWordBoundaryMatch(mechNorm, "tilt") ||
               hasWordBoundaryMatch(mechNorm, "lean") ||
               hasWordBoundaryMatch(mechNorm, "list") ||
               mech.indexOf("settlement") >= 0 || mech.indexOf("buckling") >= 0 ||
               mech.indexOf("foundation") >= 0 ||
               mech.indexOf("instability") >= 0 || mech.indexOf("misalignment") >= 0 ||
               mech.indexOf("displacement") >= 0 || mech.indexOf("collapse") >= 0 ||
               mech.indexOf("section_loss") >= 0 || mech.indexOf("member_loss") >= 0 ||
               mech.indexOf("subsidence") >= 0 || mech.indexOf("sinking") >= 0 ||
               mech.indexOf("global_deformation") >= 0 || mech.indexOf("gross_deformation") >= 0 ||
               mech.indexOf("plastic_hinge") >= 0) {
        structuralMechanisms.push(mech);
      }
      else {
        otherMechanisms.push(mech);
      }
    });

    // Transcript cracking keyword scan (presence only; confirmation inferred below)
    if (transcript.indexOf("crack") >= 0 || transcript.indexOf("scc") >= 0 ||
        transcript.indexOf("hic") >= 0 || transcript.indexOf("sohic") >= 0) {
      hasCracking = true;
    }

    // Structural transcript scan -- v1.3.1 uses word-boundary matching to
    // prevent "cleaning" -> "leaning", "blistering" -> "listing" false positives.
    if (hasWordBoundaryMatch(transcript, "tilt") ||
        hasWordBoundaryMatch(transcript, "tilted") ||
        hasWordBoundaryMatch(transcript, "tilting") ||
        hasWordBoundaryMatch(transcript, "leaning") ||
        hasWordBoundaryMatch(transcript, "listing") ||
        hasWordBoundaryMatch(transcript, "not plumb") ||
        hasWordBoundaryMatch(transcript, "out of plumb") ||
        hasWordBoundaryMatch(transcript, "off vertical")) {
      hasTilt = true;
      if (structuralMechanisms.indexOf("tilt") < 0) structuralMechanisms.push("tilt");
    }
    if (hasWordBoundaryMatch(transcript, "settlement") ||
        hasWordBoundaryMatch(transcript, "settling") ||
        hasWordBoundaryMatch(transcript, "foundation movement") ||
        hasWordBoundaryMatch(transcript, "subsidence")) {
      hasSettlement = true;
      if (structuralMechanisms.indexOf("settlement") < 0) structuralMechanisms.push("settlement");
    }
    if (hasWordBoundaryMatch(transcript, "buckling") ||
        hasWordBoundaryMatch(transcript, "buckled")) {
      hasBuckling = true;
      if (structuralMechanisms.indexOf("buckling") < 0) structuralMechanisms.push("buckling");
    }
    if (isGlobalDeformation(transcript)) {
      hasDeformation = true;
      if (structuralMechanisms.indexOf("deformation") < 0) structuralMechanisms.push("deformation");
    }

    if (hasCracking && crackingMechanisms.length === 0) {
      crackingMechanisms.push("cracking_unspecified");
    }

    // ====================================================================
    // v1.3 -- INFER CRACK CONFIRMATION STATES
    // ====================================================================
    // For each cracking keyword that appears, determine observed vs screening.
    // Caller override: if body.cracking_confirmed=true, all cracking is observed.

    var crackConfirmationStates = {
      hic:    { present: false, state: "none" },
      sohic:  { present: false, state: "none" },
      ssc:    { present: false, state: "none" },
      sscc:   { present: false, state: "none" },
      scc:    { present: false, state: "none" },
      fatigue:{ present: false, state: "none" },
      generic:{ present: false, state: "none" }
    };

    var hasHIC_token = crackingMechanisms.some(function(m) { return m.indexOf("hic") >= 0 || m.indexOf("sohic") >= 0; }) || transcript.indexOf("hic") >= 0;
    var hasSSC_token = crackingMechanisms.some(function(m) { return m.indexOf("ssc") >= 0 || m.indexOf("sscc") >= 0 || m.indexOf("sulfide") >= 0; }) || transcript.indexOf("ssc") >= 0 || transcript.indexOf("sulfide stress") >= 0;
    var hasSCC_token = crackingMechanisms.some(function(m) { return m.indexOf("scc") >= 0 || m.indexOf("stress_corrosion") >= 0; }) || transcript.indexOf("stress corrosion") >= 0;
    var hasFatigue_token = crackingMechanisms.some(function(m) { return m.indexOf("fatigue") >= 0; }) || transcript.indexOf("fatigue") >= 0;
    var hasGenericCrack_token = transcript.indexOf("crack") >= 0;

    if (hasHIC_token) {
      crackConfirmationStates.hic.present = true;
      crackConfirmationStates.hic.state = crackingConfirmed ? "observed" : inferCrackConfirmationState(transcript, "hic");
    }
    if (hasSSC_token) {
      crackConfirmationStates.ssc.present = true;
      crackConfirmationStates.ssc.state = crackingConfirmed ? "observed" : inferCrackConfirmationState(transcript, "ssc");
      if (crackConfirmationStates.ssc.state === "none") {
        crackConfirmationStates.ssc.state = inferCrackConfirmationState(transcript, "sulfide stress");
      }
    }
    if (hasSCC_token) {
      crackConfirmationStates.scc.present = true;
      crackConfirmationStates.scc.state = crackingConfirmed ? "observed" : inferCrackConfirmationState(transcript, "stress corrosion");
    }
    if (hasFatigue_token) {
      crackConfirmationStates.fatigue.present = true;
      crackConfirmationStates.fatigue.state = crackingConfirmed ? "observed" : inferCrackConfirmationState(transcript, "fatigue");
    }
    if (hasGenericCrack_token) {
      crackConfirmationStates.generic.present = true;
      crackConfirmationStates.generic.state = crackingConfirmed ? "observed" : inferCrackConfirmationState(transcript, "crack");
    }

    // Aggregate: is ANY cracking mechanism OBSERVED?
    var anyCrackObserved = false;
    var anyCrackScreeningOnly = false;
    var screeningMechanisms = [];
    var observedMechanisms = [];
    var ruledOutMechanisms = [];

    var stateKeys = ["hic", "ssc", "scc", "fatigue", "generic"];
    for (var k = 0; k < stateKeys.length; k++) {
      var key = stateKeys[k];
      var entry = crackConfirmationStates[key];
      if (!entry.present) continue;
      if (entry.state === "observed") {
        anyCrackObserved = true;
        observedMechanisms.push(key);
      } else if (entry.state === "screening_required") {
        anyCrackScreeningOnly = true;
        screeningMechanisms.push(key);
      } else if (entry.state === "ruled_out") {
        ruledOutMechanisms.push(key);
      }
    }

    var hasCorrosionMode = corrosionMechanisms.length > 0 || wallLossPercent > 0;
    var hasCrackingMode_observed = anyCrackObserved; // v1.3: only observed counts as active cracking mode
    var hasCrackingMode_screeningOnly = anyCrackScreeningOnly && !anyCrackObserved;
    var hasCrackingMode_anyPresence = crackingMechanisms.length > 0 || hasCracking;
    var hasStructuralMode = structuralMechanisms.length > 0 || hasTilt || hasSettlement || hasBuckling || hasDeformation;

    // ====================================================================
    // CORROSION PATH (unchanged from v1.2)
    // ====================================================================

    var corrosionPath = {
      active: hasCorrosionMode,
      mechanisms: corrosionMechanisms,
      failure_pressure: null,
      failure_pressure_source: "none",
      wall_loss_percent: wallLossPercent,
      severity: "none",
      assessment_method: "none",
      notes: []
    };

    if (hasCorrosionMode) {
      if (remainingStrength && remainingStrength.governing_maop) {
        corrosionPath.failure_pressure = remainingStrength.governing_maop;
        corrosionPath.failure_pressure_source = "B31G_CALCULATED";
        corrosionPath.assessment_method = remainingStrength.governing_method || "B31G";
      }
      else if (wallLossPercent > 0 && nominalWall > 0 && pipeOD > 0 && smys > 0) {
        var remainingWall = nominalWall * (1 - wallLossPercent / 100);
        var estimatedMAOP = (2 * smys * remainingWall * 0.72) / pipeOD;
        corrosionPath.failure_pressure = Math.round(estimatedMAOP);
        corrosionPath.failure_pressure_source = "BARLOW_ESTIMATED";
        corrosionPath.assessment_method = "Barlow_simplified";
        corrosionPath.notes.push("No B31G data available - using simplified Barlow estimate");
      }

      if (wallLossPercent > 80) {
        corrosionPath.severity = "CRITICAL";
        corrosionPath.notes.push("Wall loss > 80% - imminent failure risk");
      } else if (wallLossPercent > 60) {
        corrosionPath.severity = "SEVERE";
        corrosionPath.notes.push("Wall loss > 60% - significant structural compromise");
      } else if (wallLossPercent > 40) {
        corrosionPath.severity = "HIGH";
        corrosionPath.notes.push("Wall loss > 40% - engineering assessment required");
      } else if (wallLossPercent > 20) {
        corrosionPath.severity = "MODERATE";
        corrosionPath.notes.push("Wall loss > 20% - monitoring and trending required");
      } else if (wallLossPercent > 0) {
        corrosionPath.severity = "LOW";
      } else if (corrosionMechanisms.length > 0) {
        // v1.3: corrosion present but no quantified wall loss -> HIGH default
        // (wet H2S / sour / chlorides in mechanism list = high until quantified)
        corrosionPath.severity = "HIGH";
        corrosionPath.notes.push("Corrosion mechanism(s) identified but wall loss not quantified - assume HIGH severity until measured");
      }

      var hasMIC = corrosionMechanisms.some(function(m) { return m.indexOf("mic") >= 0; });
      if (hasMIC) {
        corrosionPath.notes.push("MIC detected - corrosion rate predictions from chemical models may be non-conservative (MIC can accelerate 10x)");
      }
    }

    // ====================================================================
    // CRACKING PATH (v1.3 -- confirmation-state gated)
    // ====================================================================

    var crackingPath = {
      active: hasCrackingMode_observed || hasCrackingMode_screeningOnly,
      confirmation_state: "none",
      mechanisms: crackingMechanisms,
      observed_mechanisms: observedMechanisms,
      screening_mechanisms: screeningMechanisms,
      ruled_out_mechanisms: ruledOutMechanisms,
      failure_pressure: null,
      failure_pressure_source: "none",
      severity: "none",
      assessment_method: "none",
      brittle_fracture_risk: false,
      screening_required: false,
      notes: []
    };

    if (hasCrackingMode_observed || hasCrackingMode_screeningOnly) {
      crackingPath.assessment_method = "API_579_Part_9";

      var isSour = serviceEnvironment.indexOf("sour") >= 0 || serviceEnvironment.indexOf("h2s") >= 0 ||
                   transcript.indexOf("sour") >= 0 || transcript.indexOf("h2s") >= 0;

      // v1.3: route on confirmation state
      if (hasCrackingMode_observed) {
        crackingPath.confirmation_state = "observed";

        // SSC observed = always CRITICAL (sudden brittle fracture)
        if (crackConfirmationStates.ssc.state === "observed") {
          crackingPath.severity = "CRITICAL";
          crackingPath.brittle_fracture_risk = true;
          crackingPath.notes.push("SSC CONFIRMED - produces sudden brittle fracture with NO leak-before-break behavior");
          crackingPath.notes.push("Material hardness verification against NACE MR0175/MR0103 limits is mandatory");
        }
        // HIC/SOHIC observed in sour = HIGH + brittle fracture risk
        else if (crackConfirmationStates.hic.state === "observed" && isSour) {
          crackingPath.severity = "HIGH";
          crackingPath.brittle_fracture_risk = true;
          crackingPath.notes.push("HIC/SOHIC CONFIRMED in sour service - stepwise cracking can produce sudden failure");
          crackingPath.notes.push("WFMT or PAUT with C-scan required to characterize crack morphology and depth");
        }
        // SCC observed
        else if (crackConfirmationStates.scc.state === "observed") {
          crackingPath.severity = "HIGH";
          crackingPath.notes.push("SCC CONFIRMED - identify driving environment + stress + material susceptibility triad");
        }
        // Fatigue observed
        else if (crackConfirmationStates.fatigue.state === "observed") {
          crackingPath.severity = "MODERATE";
          crackingPath.notes.push("Fatigue cracking CONFIRMED - Paris Law crack growth, requires cycle count and stress range data");
          crackingPath.notes.push("TOFD or PAUT required for crack sizing at stress concentrations");
        }
        // Generic observed cracking
        else {
          crackingPath.severity = "HIGH";
          crackingPath.notes.push("Cracking CONFIRMED but mechanism not fully characterized - assume high severity until typed");
        }
      }
      else if (hasCrackingMode_screeningOnly) {
        // v1.3 KEY CHANGE: screening-only = NOT brittle fracture risk yet
        crackingPath.confirmation_state = "screening_required";
        crackingPath.screening_required = true;
        crackingPath.brittle_fracture_risk = false;
        crackingPath.severity = "MODERATE";

        var screeningList = screeningMechanisms.join(", ").toUpperCase();
        crackingPath.notes.push("CRACKING MECHANISM(S) LISTED AS SCREENING CANDIDATES: " + screeningList);
        crackingPath.notes.push("NO CRACKING OBSERVED OR MEASURED - these mechanisms appear as potential/possible/known-DM entries only");
        crackingPath.notes.push("Crack-specific NDE (WFMT + PAUT or TOFD) REQUIRED to confirm or rule out before disposition can finalize");
        if (isSour) {
          crackingPath.notes.push("Sour service: hardness testing of base metal + HAZ per NACE MR0175/MR0103 required as part of screening");
        }
      }

      // Failure pressure estimation (only when observed)
      if (hasCrackingMode_observed && corrosionPath.failure_pressure) {
        var crackReductionFactor = 0.60;
        if (crackingPath.brittle_fracture_risk) {
          crackReductionFactor = 0.40;
        }
        crackingPath.failure_pressure = Math.round(corrosionPath.failure_pressure * crackReductionFactor);
        crackingPath.failure_pressure_source = "ESTIMATED_FROM_CORROSION_MAOP";
        crackingPath.notes.push("Crack failure pressure estimated (no crack dimensions provided). Actual API 579-1 Part 9 assessment required.");
      } else if (hasCrackingMode_observed) {
        crackingPath.failure_pressure_source = "NOT_CALCULABLE";
        crackingPath.notes.push("Cannot calculate cracking failure pressure without crack dimensions and material toughness data");
      } else {
        crackingPath.failure_pressure_source = "NOT_APPLICABLE_SCREENING_ONLY";
      }
    }

    // ====================================================================
    // STRUCTURAL PATH (unchanged from v1.2)
    // ====================================================================

    var structuralPath = {
      active: hasStructuralMode,
      mechanisms: structuralMechanisms,
      indicators: {
        tilt: hasTilt,
        settlement: hasSettlement,
        buckling: hasBuckling,
        deformation: hasDeformation
      },
      severity: "none",
      capacity_loss_state: "none",
      assessment_method: "none",
      notes: []
    };

    if (hasStructuralMode) {
      structuralPath.assessment_method = "Structural FFS / Engineering Assessment";

      if (hasTilt && hasSettlement) {
        structuralPath.severity = "CRITICAL";
        structuralPath.capacity_loss_state = "PROGRESSIVE_FAILURE_IN_PROGRESS";
        structuralPath.notes.push("Tilt + settlement = active progressive failure. Foundation or pile system has lost integrity.");
      } else if (hasBuckling) {
        structuralPath.severity = "CRITICAL";
        structuralPath.capacity_loss_state = "COMPRESSIVE_CAPACITY_EXCEEDED";
        structuralPath.notes.push("Visible buckling = compressive capacity already exceeded. Member or system has lost load-carrying ability.");
      } else if (hasTilt) {
        structuralPath.severity = "CRITICAL";
        structuralPath.capacity_loss_state = "GLOBAL_GEOMETRY_DEVIATION";
        structuralPath.notes.push("Visible tilt = global geometry has deviated from designed position. Underlying capacity loss has manifested as displacement.");
      } else if (hasSettlement) {
        structuralPath.severity = "SEVERE";
        structuralPath.capacity_loss_state = "FOUNDATION_INSTABILITY";
        structuralPath.notes.push("Foundation settlement = support condition has changed. Load redistribution is occurring.");
      } else if (hasDeformation) {
        structuralPath.severity = "HIGH";
        structuralPath.capacity_loss_state = "GLOBAL_PLASTIC_DEFORMATION";
        structuralPath.notes.push("Global deformation indicators present - member has yielded beyond elastic range. Residual capacity uncertain.");
      } else if (structuralMechanisms.length > 0) {
        structuralPath.severity = "HIGH";
        structuralPath.capacity_loss_state = "STRUCTURAL_DISTRESS";
      }

      structuralPath.notes.push("Required reasoning: load path evaluation, support condition evaluation, member capacity loss check");
      structuralPath.notes.push("Required NDE: laser/total station tilt survey, photogrammetry, structural FFS per applicable code");

      if (assetClass.indexOf("offshore") >= 0 || assetClass.indexOf("platform") >= 0 || assetClass.indexOf("jacket") >= 0) {
        structuralPath.notes.push("Offshore structure: ROV/diver inspection of submerged jacket, pile, and foundation system required");
      }
      if (assetClass.indexOf("tank") >= 0) {
        structuralPath.notes.push("Storage tank: settlement survey, shell-to-bottom weld inspection, foundation differential measurement required");
      }
      if (assetClass.indexOf("bridge") >= 0) {
        structuralPath.notes.push("Bridge: load rating reassessment, deflection survey, support condition inspection required");
      }
    }

    // ====================================================================
    // DETERMINE GOVERNING FAILURE MODE (v1.3 -- screening-aware)
    // ====================================================================

    var governingMode = "NONE";
    var governingPressure = null;
    var governingBasis = "";
    var interactionFlag = false;
    var interactionType = "none";
    var interactionDetail = "";
    var screeningGate = null; // v1.3

    if (hasStructuralMode) {
      governingMode = "STRUCTURAL_INSTABILITY";
      governingBasis = "Structural instability indicators (" + structuralMechanisms.join(", ") + ") represent capacity already exceeded - global geometry has deviated from designed position. This outranks corrosion/cracking mechanism analysis because the failure consequence has already manifested.";

      if (hasCorrosionMode && hasCrackingMode_observed) {
        interactionFlag = true;
        interactionType = "COMPOUND_DRIVER";
        interactionDetail = "Structural instability with both corrosion and confirmed cracking active. All three failure paths must be assessed.";
      } else if (hasCorrosionMode) {
        interactionFlag = true;
        interactionType = "SYNERGY";
        interactionDetail = "Structural instability driven by corrosion-induced section loss.";
      } else if (hasCrackingMode_observed) {
        interactionFlag = true;
        interactionType = "CASCADE";
        interactionDetail = "Structural instability with confirmed cracking. Brittle fracture risk is elevated.";
      } else {
        interactionType = "STRUCTURAL_PRIMARY";
        interactionDetail = "Structural instability without identified mechanism driver.";
      }
    }
    // v1.3: CONFIRMED cracking AND corrosion both active
    else if (hasCorrosionMode && hasCrackingMode_observed) {
      interactionFlag = true;

      var hasMICAndHIC = corrosionMechanisms.some(function(m) { return m.indexOf("mic") >= 0; }) &&
                         observedMechanisms.indexOf("hic") >= 0;
      var hasCUIAndFatigue = corrosionMechanisms.some(function(m) { return m.indexOf("cui") >= 0; }) &&
                             observedMechanisms.indexOf("fatigue") >= 0;
      var hasErosionAndSCC = corrosionMechanisms.some(function(m) { return m.indexOf("erosion") >= 0; }) &&
                             observedMechanisms.indexOf("scc") >= 0;

      if (hasMICAndHIC) {
        interactionType = "SYNERGY";
        interactionDetail = "MIC + confirmed HIC: microbiological activity generates hydrogen that feeds HIC. Corrosion rate models are non-conservative.";
      } else if (hasCUIAndFatigue) {
        interactionType = "CASCADE";
        interactionDetail = "CUI + confirmed fatigue: hidden wall loss under insulation reduces section, accelerating fatigue crack initiation.";
      } else if (hasErosionAndSCC) {
        interactionType = "SYNERGY";
        interactionDetail = "Erosion + confirmed SCC: erosion removes protective films, exposing fresh metal to corrosive environment.";
      } else {
        interactionType = "PARALLEL";
        interactionDetail = "Multiple confirmed failure modes active simultaneously. Each must be assessed independently.";
      }

      if (crackingPath.failure_pressure && corrosionPath.failure_pressure) {
        if (crackingPath.failure_pressure < corrosionPath.failure_pressure) {
          governingMode = "CRACKING";
          governingPressure = crackingPath.failure_pressure;
          governingBasis = "Confirmed cracking failure pressure (" + crackingPath.failure_pressure + " psi) < corrosion failure pressure (" + corrosionPath.failure_pressure + " psi)";
        } else {
          governingMode = "CORROSION";
          governingPressure = corrosionPath.failure_pressure;
          governingBasis = "Corrosion failure pressure (" + corrosionPath.failure_pressure + " psi) <= confirmed cracking failure pressure (" + crackingPath.failure_pressure + " psi)";
        }
      } else if (crackingPath.brittle_fracture_risk) {
        governingMode = "CRACKING";
        governingPressure = crackingPath.failure_pressure;
        governingBasis = "Confirmed brittle fracture risk (observed SSC or HIC in sour service) overrides corrosion assessment - crack failure is sudden and catastrophic";
      } else {
        governingMode = "COMPOUND";
        governingBasis = "Both confirmed failure modes active but insufficient pressure data to rank. Both must be assessed.";
      }
    }
    // v1.3 KEY CHANGE: corrosion active + cracking SCREENING ONLY -> govern on corrosion
    else if (hasCorrosionMode && hasCrackingMode_screeningOnly) {
      governingMode = "CORROSION";
      governingPressure = corrosionPath.failure_pressure;
      governingBasis = "Corrosion is the confirmed mechanism (" + corrosionMechanisms.join(", ") + "). Cracking mechanisms (" + screeningMechanisms.join(", ").toUpperCase() + ") are listed as screening candidates only - no observation or measurement evidence. Govern on confirmed mechanism; screening gate emitted for cracking.";
      interactionFlag = true;
      interactionType = "CORROSION_CONFIRMED_CRACKING_SCREENING";
      interactionDetail = "Confirmed corrosion with unconfirmed cracking mechanism candidates. Disposition cannot finalize until cracking screening NDE is performed.";
      screeningGate = {
        required: true,
        reason: "Cracking mechanism(s) listed but not confirmed. WFMT + PAUT/TOFD required before final disposition.",
        mechanisms: screeningMechanisms,
        required_nde: ["WFMT on weld toes and HAZ", "PAUT or TOFD on body of line for HIC/SOHIC screening", "Hardness testing base metal + HAZ per NACE MR0175/MR0103"],
        blocks_finalization: true
      };
    }
    // Only observed cracking
    else if (hasCrackingMode_observed) {
      governingMode = "CRACKING";
      governingPressure = crackingPath.failure_pressure;
      governingBasis = "Confirmed cracking is the sole active failure mode";
    }
    // Only corrosion
    else if (hasCorrosionMode) {
      governingMode = "CORROSION";
      governingPressure = corrosionPath.failure_pressure;
      governingBasis = "Corrosion/metal loss is the sole active failure mode";
    }
    // Only screening-level cracking, no corrosion
    else if (hasCrackingMode_screeningOnly) {
      governingMode = "SCREENING_REQUIRED";
      governingBasis = "Only unconfirmed cracking mechanism candidates present (" + screeningMechanisms.join(", ").toUpperCase() + "). No confirmed failure mode. Crack-specific NDE required before governing mode can be determined.";
      screeningGate = {
        required: true,
        reason: "No confirmed mechanism; cracking candidates listed only.",
        mechanisms: screeningMechanisms,
        required_nde: ["WFMT on weld toes and HAZ", "PAUT or TOFD for crack screening", "Hardness testing per NACE MR0175/MR0103 if sour"],
        blocks_finalization: true
      };
    }
    else {
      governingMode = "NONE";
      governingBasis = "No active failure modes identified from available data";
    }

    // Severity (unchanged logic)
    var severityRank = { "CRITICAL": 5, "SEVERE": 4, "HIGH": 3, "MODERATE": 2, "LOW": 1, "none": 0 };
    var corSev = severityRank[corrosionPath.severity] || 0;
    var craSev = severityRank[crackingPath.severity] || 0;
    var strSev = severityRank[structuralPath.severity] || 0;
    var maxSev = Math.max(corSev, craSev, strSev);
    var governingSeverity = "UNDETERMINED";
    if (maxSev === strSev && maxSev > 0) governingSeverity = structuralPath.severity;
    else if (maxSev === corSev && maxSev > 0) governingSeverity = corrosionPath.severity;
    else if (maxSev === craSev && maxSev > 0) governingSeverity = crackingPath.severity;

    // Governing code reference (v1.3: adds screening-aware selection)
    var governingCode = "API 579-1/ASME FFS-1";
    if (governingMode === "CORROSION") {
      governingCode = "API 579-1 Part 4/5 (Metal Loss)";
    } else if (governingMode === "CRACKING") {
      governingCode = "API 579-1 Part 9 (Crack-Like Flaws)";
    } else if (governingMode === "COMPOUND") {
      governingCode = "API 579-1 Part 4/5 + Part 9 (Both Required)";
    } else if (governingMode === "SCREENING_REQUIRED") {
      governingCode = "API 579-1 Part 9 screening NDE required before governing code can be locked";
    } else if (governingMode === "STRUCTURAL_INSTABILITY") {
      if (assetClass.indexOf("offshore") >= 0 || assetClass.indexOf("platform") >= 0 || assetClass.indexOf("jacket") >= 0) {
        governingCode = "API RP 2A / API RP 2SIM (Offshore Structural FFS)";
      } else if (assetClass.indexOf("tank") >= 0) {
        governingCode = "API 653 (Tank Settlement & Shell Stability)";
      } else if (assetClass.indexOf("bridge") >= 0) {
        governingCode = "AASHTO MBE (Manual for Bridge Evaluation)";
      } else if (assetClass.indexOf("vessel") >= 0 || assetClass.indexOf("pressure") >= 0) {
        governingCode = "API 579-1 Part 8 (Distortions) + ASME FFS-1";
      } else {
        governingCode = "Structural Engineering Assessment Required (asset-specific code)";
      }
    }

    // ====================================================================
    // RESPONSE
    // ====================================================================

    var result = {
      governing_failure_mode: governingMode,
      governing_failure_pressure: governingPressure,
      governing_severity: governingSeverity,
      governing_basis: governingBasis,
      governing_code_reference: governingCode,
      interaction_flag: interactionFlag,
      interaction_type: interactionType,
      interaction_detail: interactionDetail,
      screening_gate: screeningGate,
      crack_confirmation_states: crackConfirmationStates,
      corrosion_path: corrosionPath,
      cracking_path: crackingPath,
      structural_path: structuralPath,
      mechanism_count: {
        total: mechanisms.length,
        corrosion: corrosionMechanisms.length,
        cracking: crackingMechanisms.length,
        structural: structuralMechanisms.length,
        other: otherMechanisms.length
      },
      metadata: {
        engine: "failure-mode-dominance",
        version: "1.4.0",
        timestamp: new Date().toISOString()
      }
    };

    return { statusCode: 200, headers: headers, body: JSON.stringify(result) };

  } catch (err) {
    return { statusCode: 500, headers: headers, body: JSON.stringify({ error: "Failure mode dominance error: " + (err.message || String(err)) }) };
  }
};

module.exports = { handler: handler };
