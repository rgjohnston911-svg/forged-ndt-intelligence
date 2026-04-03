// DEPLOY87 — decision-dominance.ts v1
// Decision Dominance Layer — Engine 8
// Mechanism suppression + Confidence degradation + Hard locks + Structural authority
// Post-processes chain output to produce authoritative, defensible decisions
// NO TEMPLATE LITERALS — STRING CONCATENATION ONLY

declare var process: any;

// ================================================================
// MECHANISM CLASSIFICATION SETS
// ================================================================

// Long-term degradation mechanisms — suppress during acute incident response
var LONG_TERM_MECHANISMS: { [key: string]: boolean } = {
  "ASR": true,
  "REBAR_CORROSION": true,
  "FREEZE_THAW": true,
  "PRESTRESS_LOSS": true,
  "CARBURIZATION": true,
  "SPHEROIDIZATION": true,
  "SOFTENING_SPHEROIDIZATION": true,
  "GRAPHITIZATION": true,
  "TEMPER_EMBRITTLEMENT": true,
  "HIGH_TEMPERATURE_OXIDATION": true
};

// Need sustained high temp + long duration — not a brief fire
var HIGH_TEMP_LONG_DURATION: { [key: string]: boolean } = {
  "CREEP": true,
  "GRAPHITIZATION": true,
  "TEMPER_EMBRITTLEMENT": true,
  "SPHEROIDIZATION": true,
  "SOFTENING_SPHEROIDIZATION": true,
  "CARBURIZATION": true,
  "HIGH_TEMPERATURE_OXIDATION": true
};

// Concrete-only mechanisms — suppress on steel assets
var CONCRETE_ONLY: { [key: string]: boolean } = {
  "CONCRETE_SPALLING": true,
  "REBAR_CORROSION": true,
  "CONCRETE_CRACKING_STRUCTURAL": true,
  "CONCRETE_CRUSHING": true,
  "PRESTRESS_LOSS": true,
  "ASR": true,
  "FREEZE_THAW": true
};

// Bridge-only mechanisms — suppress on non-bridge assets
var BRIDGE_ONLY: { [key: string]: boolean } = {
  "BRIDGE_IMPACT_DAMAGE": true,
  "GIRDER_DEFORMATION": true,
  "BEARING_FAILURE": true,
  "LOAD_PATH_DISRUPTION": true,
  "GUSSET_PLATE_FAILURE": true
};

// Offshore-only mechanisms
var OFFSHORE_ONLY: { [key: string]: boolean } = {
  "MARINE_CORROSION": true,
  "CP_DEFICIENCY": true
};

// Concrete material families
var CONCRETE_MATERIALS: { [key: string]: boolean } = {
  "concrete": true,
  "reinforced_concrete": true,
  "prestressed_concrete": true,
  "bridge_concrete": true
};

// ================================================================
// EVIDENCE FLAG BUILDER
// Derives evidence flags from chain output + parsed data
// so the frontend doesn't have to construct them manually
// ================================================================

function buildEvidenceFlags(parsed: any, chain: any, asset: any): any {
  var events = (parsed && parsed.events) || [];
  var environment = (parsed && parsed.environment) || [];
  var mechanisms = (chain && chain.engine_1_damage_mechanisms) || [];
  var transcript = (parsed && parsed.raw_text) || "";
  var lt = transcript.toLowerCase();

  // Helper to check if event list contains a term
  function hasEvent(term: string): boolean {
    for (var i = 0; i < events.length; i++) {
      if (events[i].toLowerCase().indexOf(term) !== -1) return true;
    }
    return false;
  }

  function hasInTranscript(term: string): boolean {
    return lt.indexOf(term) !== -1;
  }

  function hasMechanism(code: string): boolean {
    for (var i = 0; i < mechanisms.length; i++) {
      if ((mechanisms[i].id || "").toUpperCase() === code.toUpperCase()) return true;
    }
    return false;
  }

  var fireDuration = null;
  // Try to extract fire duration from transcript
  var fireMinMatch = /(\d+)\s*(?:minutes?|mins?)\s*(?:before|fire|burn|controlled|extinguish)/i.exec(transcript);
  if (fireMinMatch) fireDuration = parseInt(fireMinMatch[1], 10);

  return {
    visible_deformation: hasEvent("deformation") || hasInTranscript("dent") || hasInTranscript("deform") || hasInTranscript("buckl"),
    visible_cracking: hasEvent("possible_cracking") || hasEvent("cracking") || hasInTranscript("crack"),
    leak_suspected: hasEvent("possible_leakage") || hasInTranscript("leak") || hasInTranscript("staining"),
    leak_confirmed: hasInTranscript("confirmed leak") || hasInTranscript("active leak"),
    fire_exposure: hasEvent("fire") || hasInTranscript("fire"),
    fire_duration_minutes: fireDuration,
    metallurgical_validation_complete: false,
    hardness_validation_complete: false,
    primary_member_involved: hasInTranscript("jacket leg") || hasInTranscript("primary") || hasInTranscript("girder") || hasInTranscript("main member") || hasInTranscript("brace"),
    bearing_displacement: hasInTranscript("bearing") && (hasInTranscript("displace") || hasInTranscript("shift")),
    support_shift: hasInTranscript("support") && (hasInTranscript("displace") || hasInTranscript("shift") || hasInTranscript("misalign") || hasInTranscript("abnormal alignment")),
    load_path_interruption_possible: hasMechanism("LOAD_PATH_DISRUPTION") || hasMechanism("STRUCTURAL_OVERLOAD") || hasInTranscript("load path"),
    pressure_boundary_involved: hasInTranscript("pressure") || hasInTranscript("piping") || hasInTranscript("psv") || hasInTranscript("flange"),
    pressure_boundary_damage_possible: hasEvent("possible_leakage") || hasInTranscript("leak") || hasInTranscript("psv lifted"),
    underwater_access_limited: hasInTranscript("underwater") || hasInTranscript("subsea") || (hasInTranscript("ft of water") || hasInTranscript("feet of water")),
    rov_visibility_poor: hasInTranscript("limited visibility") || hasInTranscript("poor visibility"),
    missing_repair_history: true, // Conservative default — field rarely has full history
    unknown_material: !hasInTranscript("carbon steel") && !hasInTranscript("stainless") && !hasInTranscript("alloy"),
    unknown_geometry: !hasInTranscript("inch") && !hasInTranscript("diameter") && !hasInTranscript("thickness"),
    unknown_operating_temperature: !hasInTranscript("degrees") && !hasInTranscript("temperature"),
    unknown_wall_thickness: !hasInTranscript("wall") || !hasInTranscript("thick"),
    crack_confirmed: hasInTranscript("crack confirmed") || hasInTranscript("cracking confirmed"),
    crack_in_primary_member: (hasInTranscript("crack") && (hasInTranscript("jacket leg") || hasInTranscript("primary") || hasInTranscript("girder"))),
    dent_or_gouge_present: hasInTranscript("dent") || hasInTranscript("gouge"),
    major_vibration_reported: hasEvent("vibration") || hasInTranscript("vibration"),
    shutdown_in_place: hasInTranscript("shut") || hasInTranscript("shutdown") || hasInTranscript("evacuate")
  };
}

// ================================================================
// DERIVE ASSET FAMILY FROM ASSET CLASS
// ================================================================

function resolveAssetFamily(assetClass: string): string {
  var ac = (assetClass || "").toLowerCase();
  if (ac.indexOf("offshore") !== -1 || ac.indexOf("platform") !== -1 || ac.indexOf("jacket") !== -1) return "offshore_platform";
  if (ac.indexOf("bridge_steel") !== -1 || ac.indexOf("bridge_concrete") !== -1 || ac.indexOf("bridge") !== -1) return "bridge";
  if (ac.indexOf("rail") !== -1) return "rail";
  if (ac.indexOf("pipeline") !== -1) return "pipeline";
  if (ac.indexOf("pressure_vessel") !== -1) return "pressure_vessel";
  if (ac.indexOf("piping") !== -1 || ac.indexOf("process_piping") !== -1) return "piping";
  if (ac.indexOf("storage_tank") !== -1) return "storage_tank";
  if (ac.indexOf("refinery") !== -1) return "refinery";
  return "unknown";
}

function resolveMaterialFamily(assetClass: string, transcript: string): string {
  var lt = (transcript || "").toLowerCase();
  if (lt.indexOf("stainless") !== -1) return "stainless_steel";
  if (lt.indexOf("duplex") !== -1) return "duplex";
  if (lt.indexOf("nickel") !== -1 || lt.indexOf("inconel") !== -1) return "nickel_alloy";
  if (lt.indexOf("concrete") !== -1 || lt.indexOf("prestress") !== -1) return "reinforced_concrete";
  var ac = (assetClass || "").toLowerCase();
  if (ac.indexOf("concrete") !== -1) return "reinforced_concrete";
  return "carbon_steel"; // Default for oil & gas / offshore
}

// ================================================================
// RELEVANCE FILTER ENGINE
// ================================================================

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function downgradeSeverity(band: string): string {
  if (band === "critical") return "high";
  if (band === "high") return "medium";
  if (band === "medium") return "low";
  return "low";
}

function evaluateMechanism(mech: any, assetFamily: string, materialFamily: string, events: string[], evidence: any): any {
  var code = ((mech.id || mech.code || "").trim()).toUpperCase();
  var name = mech.name || code;
  var severity = mech.severity || "medium";
  var score = 100;
  var reasons: string[] = [];
  var kept = true;
  var adjustedSeverity = severity;

  var fireDuration = evidence.fire_duration_minutes || 0;
  var isIncidentDominant = false;
  for (var i = 0; i < events.length; i++) {
    var ev = events[i].toLowerCase();
    if (ev.indexOf("impact") !== -1 || ev.indexOf("fire") !== -1 || ev.indexOf("explosion") !== -1 ||
        ev.indexOf("deformation") !== -1 || ev.indexOf("cracking") !== -1 || ev.indexOf("hydrocarbon") !== -1) {
      isIncidentDominant = true;
      break;
    }
  }

  // Suppress long-term lifecycle mechanisms during acute incident
  if (isIncidentDominant && LONG_TERM_MECHANISMS[code]) {
    score -= 45;
    reasons.push("incident_dominance_suppressed");
    adjustedSeverity = downgradeSeverity(adjustedSeverity);
  }

  // High-temp long-duration: suppress if fire was brief
  if (HIGH_TEMP_LONG_DURATION[code] && fireDuration > 0 && fireDuration < 60) {
    score -= 50;
    reasons.push("duration_not_supported");
    adjustedSeverity = downgradeSeverity(adjustedSeverity);
  }

  // Concrete-only on steel asset
  if (CONCRETE_ONLY[code] && !CONCRETE_MATERIALS[materialFamily]) {
    score -= 70;
    reasons.push("material_mismatch");
  }

  // Bridge-only on non-bridge asset
  if (BRIDGE_ONLY[code] && assetFamily !== "bridge" && assetFamily !== "rail") {
    score -= 70;
    reasons.push("asset_mismatch");
  }

  // Offshore-only on non-offshore asset
  if (OFFSHORE_ONLY[code] && assetFamily !== "offshore_platform") {
    score -= 70;
    reasons.push("asset_mismatch");
  }

  // Positive reinforcement for event-supported mechanisms
  var hasImpact = false;
  var hasFire = false;
  var hasVibration = false;
  var hasMarine = false;
  for (var j = 0; j < events.length; j++) {
    var e2 = events[j].toLowerCase();
    if (e2.indexOf("impact") !== -1 || e2.indexOf("deformation") !== -1) hasImpact = true;
    if (e2.indexOf("fire") !== -1) hasFire = true;
    if (e2.indexOf("vibration") !== -1) hasVibration = true;
    if (e2.indexOf("marine") !== -1 || e2.indexOf("offshore") !== -1) hasMarine = true;
  }

  if ((code === "MECH_DAMAGE" || code === "STRUCTURAL_OVERLOAD") && hasImpact) {
    score += 10;
    reasons.push("event_supported");
  }
  if ((code === "FIRE_DAMAGE" || code === "METALLURGICAL_CHANGE") && hasFire) {
    score += 10;
    reasons.push("event_supported");
  }
  if ((code === "VIB_FATIGUE" || code === "VIB_FATIGUE_V" || code === "MECH_FATIGUE") && (hasVibration || evidence.major_vibration_reported)) {
    score += 10;
    reasons.push("event_supported");
  }
  if ((code === "MARINE_CORROSION" || code === "CP_DEFICIENCY") && (hasMarine || assetFamily === "offshore_platform")) {
    score += 10;
    reasons.push("environment_supported");
  }

  if (reasons.length === 0) {
    reasons.push("insufficient_evidence");
  }

  score = clamp(score, 0, 100);
  if (score < 45) kept = false;

  return {
    code: code,
    name: name,
    original_severity: severity,
    adjusted_severity: adjustedSeverity,
    relevance_score: score,
    kept: kept,
    reasons: reasons
  };
}

// ================================================================
// CONFIDENCE DEGRADATION ENGINE
// ================================================================

function computeConfidenceDegradation(evidence: any): any[] {
  var adjustments: any[] = [];
  if (evidence.missing_repair_history) adjustments.push({ reason: "Missing repair history", delta: -12 });
  if (evidence.unknown_material) adjustments.push({ reason: "Material not confirmed", delta: -8 });
  if (evidence.unknown_geometry) adjustments.push({ reason: "Geometry/dimensional baseline unknown", delta: -8 });
  if (evidence.underwater_access_limited) adjustments.push({ reason: "Underwater access limited", delta: -10 });
  if (evidence.rov_visibility_poor) adjustments.push({ reason: "Poor ROV/visual visibility", delta: -8 });
  if (evidence.unknown_operating_temperature) adjustments.push({ reason: "Operating temperature unknown", delta: -5 });
  if (evidence.unknown_wall_thickness) adjustments.push({ reason: "Baseline wall thickness unknown", delta: -5 });
  return adjustments;
}

// ================================================================
// HARD LOCK DECISION ENGINE
// ================================================================

function buildHardLocks(evidence: any): any[] {
  var triggers = [];

  triggers.push({
    trigger_code: "HL_PRIMARY_MEMBER_CRACK",
    trigger_name: "Crack in Primary Load Member",
    fired: !!(evidence.crack_confirmed && evidence.crack_in_primary_member),
    rationale: "Confirmed crack in primary load-carrying member requires immediate engineering control.",
    code_basis: "AASHTO MBE, AWS D1.5, Structural Engineering Assessment"
  });

  triggers.push({
    trigger_code: "HL_LOAD_PATH_COMPROMISE",
    trigger_name: "Load Path Compromise",
    fired: !!(evidence.load_path_interruption_possible && (evidence.visible_deformation || evidence.primary_member_involved)),
    rationale: "Possible load-path interruption with visible damage prevents restart without engineering review.",
    code_basis: "AASHTO MBE, API 579 Part 8, Owner Structural Integrity Program"
  });

  triggers.push({
    trigger_code: "HL_FIRE_NO_VALIDATION",
    trigger_name: "Fire Exposure Without Material Validation",
    fired: !!(evidence.fire_exposure && (!evidence.hardness_validation_complete || !evidence.metallurgical_validation_complete)),
    rationale: "Fire-exposed structural/pressure components require hardness and metallurgical validation before return to service.",
    code_basis: "API 579-1 Part 11, AISC fire assessment, NBIC / PCC-2"
  });

  triggers.push({
    trigger_code: "HL_PRESSURE_BOUNDARY",
    trigger_name: "Pressure Boundary Compromise",
    fired: !!(evidence.pressure_boundary_involved && (evidence.leak_confirmed || evidence.pressure_boundary_damage_possible)),
    rationale: "Suspected or confirmed pressure boundary compromise prevents restart.",
    code_basis: "API 510, API 570, ASME PCC-2, API 579"
  });

  triggers.push({
    trigger_code: "HL_SUPPORT_DISPLACEMENT",
    trigger_name: "Support/Bearing Displacement",
    fired: !!(evidence.bearing_displacement || evidence.support_shift),
    rationale: "Support or bearing displacement may alter load path and structural behavior.",
    code_basis: "AASHTO LRFD Section 14, AASHTO MBE, API RP 2A"
  });

  triggers.push({
    trigger_code: "HL_MAJOR_DEFORMATION",
    trigger_name: "Major Visible Deformation",
    fired: !!evidence.visible_deformation,
    rationale: "Visible deformation in primary or connected members requires engineering disposition before restart.",
    code_basis: "API 579 Part 8, AASHTO MBE Section 5, AISC 303"
  });

  return triggers;
}

// ================================================================
// STRUCTURAL AUTHORITY ENGINE
// ================================================================

function resolveStructuralAuthority(evidence: any, hardLocks: any[]): any {
  var status = "stable";
  var rationale: string[] = [];
  var primaryDamage = !!(evidence.primary_member_involved && (evidence.visible_deformation || evidence.crack_confirmed || evidence.crack_in_primary_member));
  var loadPathConcern = !!(evidence.load_path_interruption_possible || evidence.bearing_displacement || evidence.support_shift);

  if (primaryDamage) {
    status = "primary_member_damage_detected";
    rationale.push("Primary load-carrying member damage indicated.");
  }
  if (loadPathConcern) {
    status = "load_path_compromised";
    rationale.push("Load path interruption or redistribution concern exists.");
  }
  if (evidence.visible_deformation || evidence.crack_confirmed || evidence.fire_exposure) {
    if (status === "stable") status = "stability_uncertain";
    rationale.push("Structural stability cannot be assumed until critical areas are validated.");
  }

  // Check if hard locks fired that indicate unstable
  var unstableLocks = ["HL_PRIMARY_MEMBER_CRACK", "HL_LOAD_PATH_COMPROMISE", "HL_SUPPORT_DISPLACEMENT"];
  for (var i = 0; i < hardLocks.length; i++) {
    if (hardLocks[i].fired) {
      for (var j = 0; j < unstableLocks.length; j++) {
        if (hardLocks[i].trigger_code === unstableLocks[j]) {
          status = "unstable";
          rationale.push("Hard-lock criteria indicate unstable or not-yet-validated condition.");
          break;
        }
      }
      if (status === "unstable") break;
    }
  }

  return {
    status: status,
    status_label: status.replace(/_/g, " ").toUpperCase(),
    primary_member_damage: primaryDamage,
    load_path_concern: loadPathConcern,
    immediate_shoring_or_isolation_recommended: (status === "unstable" || status === "load_path_compromised" || status === "primary_member_damage_detected"),
    rationale: rationale
  };
}

// ================================================================
// DISPOSITION RESOLUTION
// ================================================================

function resolveDisposition(evidence: any, hardLocks: any[], structural: any): string {
  var firedCodes: string[] = [];
  for (var i = 0; i < hardLocks.length; i++) {
    if (hardLocks[i].fired) firedCodes.push(hardLocks[i].trigger_code);
  }

  function hasFired(code: string): boolean {
    for (var j = 0; j < firedCodes.length; j++) {
      if (firedCodes[j] === code) return true;
    }
    return false;
  }

  if (hasFired("HL_PRIMARY_MEMBER_CRACK") || hasFired("HL_LOAD_PATH_COMPROMISE") || hasFired("HL_PRESSURE_BOUNDARY")) {
    return "no_go";
  }
  if (hasFired("HL_FIRE_NO_VALIDATION") || hasFired("HL_SUPPORT_DISPLACEMENT") || hasFired("HL_MAJOR_DEFORMATION")) {
    return "repair_before_restart";
  }
  if (structural.status === "stability_uncertain" || evidence.visible_cracking || evidence.leak_suspected) {
    return "engineering_review_required";
  }
  if (evidence.major_vibration_reported || evidence.leak_suspected) {
    return "restricted_operation";
  }
  return "conditional_go";
}

function dispositionLabel(d: string): string {
  if (d === "no_go") return "NO GO";
  if (d === "repair_before_restart") return "REPAIR BEFORE RESTART";
  if (d === "engineering_review_required") return "ENGINEERING REVIEW REQUIRED";
  if (d === "restricted_operation") return "RESTRICTED OPERATION";
  if (d === "conditional_go") return "CONDITIONAL GO";
  return "GO";
}

function riskFromDisposition(d: string, survivingMechs: any[]): string {
  if (d === "no_go") return "critical";
  if (d === "repair_before_restart" || d === "engineering_review_required") return "high";
  if (d === "restricted_operation" || d === "conditional_go") return "moderate";
  // Also check max mechanism severity
  var maxW = 0;
  for (var i = 0; i < survivingMechs.length; i++) {
    var s = survivingMechs[i].adjusted_severity;
    var w = s === "critical" ? 4 : s === "high" ? 3 : s === "medium" ? 2 : 1;
    if (w > maxW) maxW = w;
  }
  if (maxW >= 4) return "critical";
  if (maxW >= 3) return "high";
  return "moderate";
}

// ================================================================
// ZONE PRIORITIZATION ENGINE
// ================================================================

function prioritizeZones(zones: any[], assetFamily: string, evidence: any): any[] {
  var result = [];
  for (var i = 0; i < zones.length; i++) {
    var z = zones[i];
    var zl = (z.zone_name || z.zone || "").toLowerCase();
    var priority = z.priority || 2;

    // Boost based on evidence
    if (evidence.primary_member_involved && (zl.indexOf("leg") !== -1 || zl.indexOf("primary") !== -1 || zl.indexOf("girder") !== -1 || zl.indexOf("brace") !== -1)) {
      priority = 1;
    }
    if (evidence.fire_exposure && zl.indexOf("fire") !== -1) priority = 1;
    if (evidence.leak_suspected && (zl.indexOf("flange") !== -1 || zl.indexOf("leak") !== -1)) priority = 1;
    if (zl.indexOf("impact") !== -1) priority = 1;

    result.push({
      zone_name: z.zone_name || z.zone || "",
      priority: priority,
      rationale: z.rationale || ""
    });
  }

  // Sort by priority ascending
  result.sort(function(a: any, b: any) { return a.priority - b.priority; });
  return result;
}

// ================================================================
// MANAGEMENT SUMMARY BUILDER
// ================================================================

function buildManagementSummary(disposition: string, structural: any, evidence: any, survivingCount: number, suppressedCount: number, finalConfidence: number, topMethods: string[]): string {
  var parts: string[] = [];
  parts.push(dispositionLabel(disposition) + " based on validated incident-dominant damage logic.");
  parts.push(survivingCount + " mechanisms confirmed relevant; " + suppressedCount + " suppressed as non-applicable to this scenario.");

  if (structural.primary_member_damage) parts.push("Primary member damage concern exists.");
  if (structural.load_path_concern) parts.push("Load path compromise concern exists.");
  if (structural.status === "unstable") parts.push("Structural stability NOT confirmed — isolation/shoring recommended.");
  if (evidence.fire_exposure) parts.push("Fire exposure requires hardness and metallurgical validation before restart.");
  if (evidence.pressure_boundary_damage_possible) parts.push("Pressure boundary risk must be resolved before restart.");

  parts.push("Adjusted confidence: " + finalConfidence + "%.");
  if (topMethods.length > 0) parts.push("Priority methods: " + topMethods.join(", ") + ".");

  return parts.join(" ");
}

// ================================================================
// MAIN ENGINE
// ================================================================

function runDecisionDominance(parsed: any, chain: any, asset: any): any {
  var startMs = Date.now();

  var assetClass = (asset && asset.asset_class) || "unknown";
  var assetFamily = resolveAssetFamily(assetClass);
  var materialFamily = resolveMaterialFamily(assetClass, (parsed && parsed.raw_text) || "");
  var events = (parsed && parsed.events) || [];
  var initialConfidence = (chain && chain.confidence_scores && chain.confidence_scores.overall_confidence)
    ? Math.round(chain.confidence_scores.overall_confidence * 100)
    : 85;

  // Build evidence flags from existing data
  var evidence = buildEvidenceFlags(parsed, chain, asset);

  // Run relevance filter on all mechanisms
  var mechanisms = (chain && chain.engine_1_damage_mechanisms) || [];
  var mechDecisions: any[] = [];
  for (var i = 0; i < mechanisms.length; i++) {
    mechDecisions.push(evaluateMechanism(mechanisms[i], assetFamily, materialFamily, events, evidence));
  }

  var surviving: any[] = [];
  var suppressed: any[] = [];
  for (var j = 0; j < mechDecisions.length; j++) {
    if (mechDecisions[j].kept) {
      surviving.push(mechDecisions[j]);
    } else {
      suppressed.push(mechDecisions[j]);
    }
  }

  // Sort surviving by relevance score descending
  surviving.sort(function(a: any, b: any) { return b.relevance_score - a.relevance_score; });

  // Confidence degradation
  var confAdjustments = computeConfidenceDegradation(evidence);
  var confDelta = 0;
  for (var k = 0; k < confAdjustments.length; k++) {
    confDelta += confAdjustments[k].delta;
  }
  var finalConfidence = clamp(initialConfidence + confDelta, 15, 99);

  // Hard locks
  var hardLocks = buildHardLocks(evidence);

  // Structural authority
  var structural = resolveStructuralAuthority(evidence, hardLocks);

  // Disposition
  var disposition = resolveDisposition(evidence, hardLocks, structural);
  var riskBand = riskFromDisposition(disposition, surviving);

  // Zone prioritization
  var zones = (chain && chain.engine_2_affected_zones) || [];
  var prioritizedZones = prioritizeZones(zones, assetFamily, evidence);

  // Top methods (from surviving mechanisms — first 6 unique method names from chain)
  var methods = (chain && chain.engine_3_inspection_methods) || [];
  var topMethodNames: string[] = [];
  for (var m = 0; m < methods.length; m++) {
    var mn = methods[m].method_name || "";
    var found = false;
    for (var n = 0; n < topMethodNames.length; n++) {
      if (topMethodNames[n] === mn) { found = true; break; }
    }
    if (!found && mn) topMethodNames.push(mn);
    if (topMethodNames.length >= 6) break;
  }

  // Decision trace
  var trace: string[] = [];
  trace.push("Asset family: " + assetFamily + ". Material family: " + materialFamily + ".");
  trace.push("Detected events: " + (events.join(", ") || "none") + ".");
  trace.push(surviving.length + " mechanisms survived relevance filtering; " + suppressed.length + " suppressed.");

  var firedLocks: string[] = [];
  for (var h = 0; h < hardLocks.length; h++) {
    if (hardLocks[h].fired) {
      trace.push("HARD LOCK: " + hardLocks[h].trigger_name + " — " + hardLocks[h].rationale + " [" + hardLocks[h].code_basis + "]");
      firedLocks.push(hardLocks[h].trigger_name);
    }
  }

  trace.push("Structural authority: " + structural.status_label + ".");
  trace.push("Disposition: " + dispositionLabel(disposition) + ".");
  trace.push("Confidence adjusted from " + initialConfidence + "% to " + finalConfidence + "% (" + confDelta + " total penalty).");

  // Management summary
  var summary = buildManagementSummary(disposition, structural, evidence, surviving.length, suppressed.length, finalConfidence, topMethodNames);

  var elapsedMs = Date.now() - startMs;

  return {
    engine_version: "decision-dominance-v1.0",
    timestamp: new Date().toISOString(),
    elapsed_ms: elapsedMs,
    disposition: disposition,
    disposition_label: dispositionLabel(disposition),
    risk_band: riskBand,
    initial_confidence: initialConfidence,
    final_confidence: finalConfidence,
    confidence_adjustments: confAdjustments,
    structural_authority: structural,
    hard_lock_triggers: hardLocks,
    fired_lock_count: firedLocks.length,
    surviving_mechanisms: surviving,
    surviving_count: surviving.length,
    suppressed_mechanisms: suppressed,
    suppressed_count: suppressed.length,
    prioritized_inspection_sequence: prioritizedZones,
    top_methods: topMethodNames,
    decision_trace: trace,
    management_summary: summary,
    evidence_flags: evidence,
    asset_family: assetFamily,
    material_family: materialFamily
  };
}


// ================================================================
// NETLIFY HANDLER
// ================================================================

var handler = async function(event: any): Promise<any> {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var parsed = body.parsed || null;
    var chain = body.chain || null;
    var asset = body.asset || null;

    if (!chain) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify({ error: "chain data is required" })
      };
    }

    var result = runDecisionDominance(parsed, chain, asset);

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, dominance: result })
    };

  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ error: "decision-dominance error", message: err.message || "Unknown" })
    };
  }
};

export { handler };
