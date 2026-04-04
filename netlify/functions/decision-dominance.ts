// DEPLOY87b — decision-dominance.ts v2.1
// Decision Dominance Layer — Engine 8
// v2.1: Added method suppression (concrete methods on steel, steel methods on concrete)
// Fixes from GPT eval:
//   1. Universal mechanism set (load path never asset-suppressed)
//   2. Creep/graphitization suppressed for short-duration fire
//   3. Thermal fatigue suppressed without cyclic evidence
//   4. Mechanism family merge (VIB_FATIGUE + VIB_FATIGUE_V → one family)
//   5. Grouped confidence penalties with caps + floor at 40%
//   6. Evidence sufficiency score separate from confidence
// NO TEMPLATE LITERALS — STRING CONCATENATION ONLY

declare var process: any;

// ================================================================
// MECHANISM FAMILY MAP — merges duplicate codes into families
// ================================================================

var FAMILY_MAP: { [key: string]: { family: string; name: string } } = {
  // Universal / structural — NEVER asset-suppressed
  "LOAD_PATH_DISRUPTION": { family: "LOAD_PATH_DISRUPTION", name: "Load Path Disruption" },
  "STRUCTURAL_OVERLOAD": { family: "STRUCTURAL_OVERLOAD", name: "Structural Overload / Deformation" },
  "STRUCTURAL_INSTABILITY": { family: "STRUCTURAL_INSTABILITY", name: "Structural Instability" },
  // Mechanical damage
  "MECH_DAMAGE": { family: "MECHANICAL_DAMAGE", name: "Mechanical Damage (Dent / Gouge / Impact)" },
  // Fatigue — merge VIB_FATIGUE variants
  "MECH_FATIGUE": { family: "MECHANICAL_FATIGUE", name: "Mechanical Fatigue" },
  "VIB_FATIGUE": { family: "VIBRATION_FATIGUE", name: "Vibration-Induced Fatigue" },
  "VIB_FATIGUE_V": { family: "VIBRATION_FATIGUE", name: "Vibration-Induced Fatigue" },
  "THERMAL_FATIGUE": { family: "THERMAL_FATIGUE", name: "Thermal Fatigue" },
  // Fire / temperature
  "FIRE_DAMAGE": { family: "FIRE_DAMAGE", name: "Fire Damage / Short-Term Overheating" },
  "METALLURGICAL_CHANGE": { family: "METALLURGICAL_CHANGE", name: "Metallurgical Change from Fire" },
  "CREEP": { family: "CREEP", name: "Creep / Stress Rupture" },
  "GRAPHITIZATION": { family: "GRAPHITIZATION", name: "Graphitization" },
  "TEMPER_EMBRITTLEMENT": { family: "TEMPER_EMBRITTLEMENT", name: "Temper Embrittlement" },
  "SPHEROIDIZATION": { family: "SPHEROIDIZATION", name: "Spheroidization / Softening" },
  "SOFTENING_SPHEROIDIZATION": { family: "SPHEROIDIZATION", name: "Spheroidization / Softening" },
  "CARBURIZATION": { family: "CARBURIZATION", name: "Carburization" },
  "HIGH_TEMPERATURE_OXIDATION": { family: "HIGH_TEMPERATURE_OXIDATION", name: "High Temperature Oxidation" },
  // Offshore
  "MARINE_CORROSION": { family: "MARINE_CORROSION", name: "Marine / Seawater Corrosion" },
  "CP_DEFICIENCY": { family: "CP_DEFICIENCY", name: "Cathodic Protection Deficiency" },
  // Bridge-specific
  "BRIDGE_IMPACT_DAMAGE": { family: "BRIDGE_IMPACT_DAMAGE", name: "Bridge-Specific Impact Damage" },
  "GIRDER_DEFORMATION": { family: "BRIDGE_GIRDER_DEFORMATION", name: "Bridge Girder Deformation" },
  "BEARING_FAILURE": { family: "SUPPORT_SYSTEM_FAILURE", name: "Support / Restraint System Failure" },
  "GUSSET_PLATE_FAILURE": { family: "GUSSET_PLATE_FAILURE", name: "Gusset Plate Failure" },
  // Concrete
  "CONCRETE_SPALLING": { family: "CONCRETE_SPALLING", name: "Concrete Spalling / Delamination" },
  "REBAR_CORROSION": { family: "REBAR_CORROSION", name: "Reinforcement Corrosion" },
  "CONCRETE_CRACKING_STRUCTURAL": { family: "CONCRETE_STRUCTURAL_CRACKING", name: "Concrete Structural Cracking" },
  "CONCRETE_CRUSHING": { family: "CONCRETE_CRUSHING", name: "Concrete Crushing" },
  "PRESTRESS_LOSS": { family: "PRESTRESS_LOSS", name: "Prestress Loss / Tendon Failure" },
  "ASR": { family: "ASR", name: "Alkali-Silica Reaction" },
  "FREEZE_THAW": { family: "FREEZE_THAW", name: "Freeze-Thaw Damage" }
};

// ================================================================
// CLASSIFICATION SETS
// ================================================================

// Universal mechanisms — NEVER asset-suppressed, preserved if any structural evidence
var UNIVERSAL_MECHANISMS: { [key: string]: boolean } = {
  "LOAD_PATH_DISRUPTION": true,
  "STRUCTURAL_OVERLOAD": true,
  "STRUCTURAL_INSTABILITY": true
};

var CONCRETE_ONLY: { [key: string]: boolean } = {
  "CONCRETE_SPALLING": true, "REBAR_CORROSION": true, "CONCRETE_STRUCTURAL_CRACKING": true,
  "CONCRETE_CRUSHING": true, "PRESTRESS_LOSS": true, "ASR": true, "FREEZE_THAW": true
};

var BRIDGE_ONLY: { [key: string]: boolean } = {
  "BRIDGE_IMPACT_DAMAGE": true, "BRIDGE_GIRDER_DEFORMATION": true, "GUSSET_PLATE_FAILURE": true
};

var OFFSHORE_ONLY: { [key: string]: boolean } = {
  "MARINE_CORROSION": true, "CP_DEFICIENCY": true
};

var LONG_DURATION_HIGH_TEMP: { [key: string]: boolean } = {
  "CREEP": true, "GRAPHITIZATION": true, "TEMPER_EMBRITTLEMENT": true,
  "SPHEROIDIZATION": true, "CARBURIZATION": true, "HIGH_TEMPERATURE_OXIDATION": true
};

var CYCLIC_ONLY: { [key: string]: boolean } = {
  "THERMAL_FATIGUE": true
};

var CONCRETE_MATERIALS: { [key: string]: boolean } = {
  "concrete": true, "reinforced_concrete": true, "prestressed_concrete": true, "bridge_concrete": true
};

// Methods that only apply to concrete assets — suppress on steel
var CONCRETE_ONLY_METHODS: { [key: string]: boolean } = {
  "SOUNDING": true, "GPR": true, "COVERMETER": true, "HALFCELL": true,
  "CHLORIDE": true, "IMPACT_ECHO": true, "PETROGRAPHY": true, "REBOUND": true
};

// Methods that only apply to steel/metal assets — suppress on concrete
var STEEL_ONLY_METHODS: { [key: string]: boolean } = {
  "MT": true, "PAUT": true, "TOFD": true, "REPLICA": true, "HARDNESS": true
};

// Confidence group caps
var DATA_UNKNOWNS_CAP = -20;
var ACCESS_LIMITATIONS_CAP = -20;
var OPERATIONAL_UNKNOWNS_CAP = -10;
var CONFIDENCE_FLOOR = 40;

// ================================================================
// HELPERS
// ================================================================

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function maxSeverity(a: string, b: string): string {
  var rank: { [key: string]: number } = { "low": 1, "medium": 2, "high": 3, "critical": 4 };
  return (rank[a] || 0) >= (rank[b] || 0) ? a : b;
}

// ================================================================
// EVIDENCE FLAG BUILDER — auto-derives from transcript + chain
// ================================================================

function buildEvidenceFlags(parsed: any, chain: any, asset: any): any {
  var events = (parsed && parsed.events) || [];
  var transcript = (parsed && parsed.raw_text) || "";
  var lt = transcript.toLowerCase();
  var mechanisms = (chain && chain.engine_1_damage_mechanisms) || [];

  function hasEvent(term: string): boolean {
    for (var i = 0; i < events.length; i++) {
      if (events[i].toLowerCase().indexOf(term) !== -1) return true;
    }
    return false;
  }
  function inText(term: string): boolean { return lt.indexOf(term) !== -1; }
  function hasMech(code: string): boolean {
    for (var i = 0; i < mechanisms.length; i++) {
      if ((mechanisms[i].id || "").toUpperCase() === code) return true;
    }
    return false;
  }

  var fireDuration: number | null = null;
  var fireMatch = /(\d+)\s*(?:minutes?|mins?)\s*(?:before|fire|burn|controlled|extinguish)/i.exec(transcript);
  if (fireMatch) fireDuration = parseInt(fireMatch[1], 10);

  return {
    visible_deformation: hasEvent("deformation") || inText("dent") || inText("deform") || inText("buckl"),
    visible_cracking: hasEvent("possible_cracking") || hasEvent("cracking") || inText("crack"),
    crack_confirmed: inText("crack confirmed") || inText("cracking confirmed"),
    crack_in_primary_member: inText("crack") && (inText("jacket leg") || inText("primary") || inText("girder")),
    primary_member_involved: inText("jacket leg") || inText("primary") || inText("girder") || inText("main member") || inText("brace"),
    load_path_interruption_possible: hasMech("LOAD_PATH_DISRUPTION") || hasMech("STRUCTURAL_OVERLOAD") || inText("load path"),
    leak_suspected: hasEvent("possible_leakage") || inText("leak") || inText("staining"),
    leak_confirmed: inText("confirmed leak") || inText("active leak"),
    pressure_boundary_involved: inText("piping") || inText("psv") || inText("flange") || inText("pressure"),
    pressure_boundary_damage_possible: hasEvent("possible_leakage") || inText("leak") || inText("psv lifted"),
    fire_exposure: hasEvent("fire") || inText("fire"),
    fire_duration_minutes: fireDuration,
    hardness_validation_complete: false,
    metallurgical_validation_complete: false,
    cyclic_temperature_profile_known: false,
    bearing_displacement: inText("bearing") && (inText("displace") || inText("shift")),
    support_shift: inText("support") && (inText("displace") || inText("shift") || inText("misalign") || inText("abnormal alignment")),
    dent_or_gouge_present: inText("dent") || inText("gouge"),
    major_vibration_reported: hasEvent("vibration") || inText("vibration"),
    underwater_access_limited: inText("ft of water") || inText("feet of water") || inText("underwater") || inText("subsea"),
    rov_visibility_poor: inText("limited visibility") || inText("poor visibility"),
    missing_repair_history: true,
    unknown_material: !inText("carbon steel") && !inText("stainless") && !inText("alloy"),
    unknown_geometry: !inText("inch") && !inText("diameter") && !inText("thickness"),
    unknown_operating_temperature: !inText("degrees") && !inText("temperature"),
    unknown_wall_thickness: true,
    shutdown_in_place: inText("shut") || inText("evacuate")
  };
}

// ================================================================
// ASSET / MATERIAL RESOLVERS
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
  return "carbon_steel";
}

// ================================================================
// STEP 1: MERGE MECHANISMS INTO FAMILIES
// ================================================================

function mergeFamilies(mechanisms: any[]): any[] {
  var familyMap: { [key: string]: any } = {};

  for (var i = 0; i < mechanisms.length; i++) {
    var code = ((mechanisms[i].id || mechanisms[i].code || "").trim()).toUpperCase();
    var mapped = FAMILY_MAP[code];
    var familyCode = mapped ? mapped.family : code;
    var familyName = mapped ? mapped.name : (mechanisms[i].name || code);

    if (!familyMap[familyCode]) {
      familyMap[familyCode] = {
        family_code: familyCode,
        family_name: familyName,
        merged_codes: [code],
        severity: mechanisms[i].severity || "medium",
        relevance_score: 100,
        kept: true,
        reasons: []
      };
    } else {
      // Merge: add code, take max severity
      var existing = familyMap[familyCode];
      var found = false;
      for (var j = 0; j < existing.merged_codes.length; j++) {
        if (existing.merged_codes[j] === code) { found = true; break; }
      }
      if (!found) existing.merged_codes.push(code);
      existing.severity = maxSeverity(existing.severity, mechanisms[i].severity || "medium");
    }
  }

  var result: any[] = [];
  for (var key in familyMap) {
    if (familyMap.hasOwnProperty(key)) result.push(familyMap[key]);
  }
  return result;
}

// ================================================================
// STEP 2: RELEVANCE FILTER (with universal preservation)
// ================================================================

function evaluateFamily(family: any, assetFamily: string, materialFamily: string, events: string[], evidence: any): any {
  var fc = family.family_code;
  var score = family.relevance_score;
  var reasons: string[] = [];
  var severity = family.severity;
  var fireDuration = evidence.fire_duration_minutes || 0;

  // Check if incident-dominant
  var isIncident = false;
  var incidentTerms = ["impact", "fire", "explosion", "deformation", "cracking", "hydrocarbon", "leakage"];
  for (var i = 0; i < events.length; i++) {
    var ev = events[i].toLowerCase();
    for (var j = 0; j < incidentTerms.length; j++) {
      if (ev.indexOf(incidentTerms[j]) !== -1) { isIncident = true; break; }
    }
    if (isIncident) break;
  }

  // === UNIVERSAL MECHANISMS — never asset-suppressed ===
  if (UNIVERSAL_MECHANISMS[fc]) {
    reasons.push("universal_mechanism_preserved");
    // Boost if structural evidence exists
    if (evidence.primary_member_involved || evidence.load_path_interruption_possible || evidence.visible_deformation || evidence.support_shift) {
      score = Math.max(score, 95);
      reasons.push("evidence_supported");
    }
    // Skip all suppression rules — return early
    family.relevance_score = clamp(score, 0, 100);
    family.kept = true;
    family.reasons = reasons;
    return family;
  }

  // === Concrete-only on non-concrete ===
  if (CONCRETE_ONLY[fc] && !CONCRETE_MATERIALS[materialFamily]) {
    score -= 80;
    reasons.push("material_mismatch");
  }

  // === Bridge-only on non-bridge ===
  if (BRIDGE_ONLY[fc] && assetFamily !== "bridge" && assetFamily !== "rail") {
    score -= 75;
    reasons.push("asset_mismatch");
  }

  // === Offshore-only on non-offshore ===
  if (OFFSHORE_ONLY[fc] && assetFamily !== "offshore_platform") {
    score -= 75;
    reasons.push("asset_mismatch");
  }

  // === Long-duration high-temp: suppress for short fire ===
  if (LONG_DURATION_HIGH_TEMP[fc] && evidence.fire_exposure && fireDuration > 0 && fireDuration < 60) {
    score -= 85;
    reasons.push("duration_not_supported");
    reasons.push("acute_fire_not_sufficient");
  }

  // === Cyclic-only: suppress without cyclic evidence ===
  if (CYCLIC_ONLY[fc] && !evidence.cyclic_temperature_profile_known) {
    score -= 85;
    reasons.push("cyclic_evidence_missing");
  }

  // === Lifecycle suppression during acute incident ===
  if (isIncident && (fc === "ASR" || fc === "FREEZE_THAW" || fc === "REBAR_CORROSION" || fc === "PRESTRESS_LOSS")) {
    score -= 25;
    reasons.push("incident_dominance_suppressed");
  }

  // === Positive: event support ===
  var hasImpact = false, hasFire = false, hasVib = false, hasMarine = false;
  for (var k = 0; k < events.length; k++) {
    var e2 = events[k].toLowerCase();
    if (e2.indexOf("impact") !== -1 || e2.indexOf("deformation") !== -1) hasImpact = true;
    if (e2.indexOf("fire") !== -1) hasFire = true;
    if (e2.indexOf("vibration") !== -1) hasVib = true;
    if (e2.indexOf("marine") !== -1 || e2.indexOf("offshore") !== -1) hasMarine = true;
  }

  if (fc === "MECHANICAL_DAMAGE" && (hasImpact || evidence.dent_or_gouge_present)) { score += 5; reasons.push("event_supported"); }
  if (fc === "FIRE_DAMAGE" && hasFire) { score += 5; reasons.push("event_supported"); }
  if (fc === "METALLURGICAL_CHANGE" && hasFire) { score += 5; reasons.push("event_supported"); }
  if (fc === "VIBRATION_FATIGUE" && (hasVib || evidence.major_vibration_reported)) { score += 5; reasons.push("event_supported"); }
  if (fc === "MECHANICAL_FATIGUE" && (hasVib || hasImpact)) { score += 5; reasons.push("event_supported"); }
  if ((fc === "MARINE_CORROSION" || fc === "CP_DEFICIENCY") && (hasMarine || assetFamily === "offshore_platform")) { score += 5; reasons.push("environment_supported"); }

  if (reasons.length === 0) reasons.push("insufficient_evidence");

  score = clamp(score, 0, 100);
  family.relevance_score = score;
  family.kept = score >= 45;
  family.reasons = reasons;
  return family;
}

// ================================================================
// STEP 3: EVIDENCE SUFFICIENCY (separate from confidence)
// ================================================================

function computeEvidenceSufficiency(evidence: any): any {
  var score = 50;
  if (evidence.visible_deformation) score += 10;
  if (evidence.visible_cracking) score += 8;
  if (evidence.crack_confirmed) score += 10;
  if (evidence.fire_exposure) score += 8;
  if (evidence.pressure_boundary_involved) score += 8;
  if (evidence.load_path_interruption_possible) score += 8;
  if (evidence.dent_or_gouge_present) score += 5;
  if (evidence.major_vibration_reported) score += 5;

  if (evidence.underwater_access_limited) score -= 8;
  if (evidence.rov_visibility_poor) score -= 8;
  if (evidence.unknown_material) score -= 5;
  if (evidence.unknown_geometry) score -= 5;

  score = clamp(score, 0, 100);
  var label = "limited";
  if (score >= 75) label = "strong";
  else if (score >= 55) label = "adequate";
  else if (score >= 35) label = "limited";
  else label = "poor";

  return { score: score, label: label };
}

// ================================================================
// STEP 4: GROUPED CONFIDENCE DEGRADATION (with caps)
// ================================================================

function computeGroupedConfidence(initialConfidence: number, evidence: any): any {
  var groups: any[] = [];

  // Group 1: Data Unknowns (cap -20%)
  var dataRaw = 0;
  var dataReasons: string[] = [];
  if (evidence.unknown_material) { dataRaw -= 8; dataReasons.push("Material not confirmed"); }
  if (evidence.unknown_geometry) { dataRaw -= 8; dataReasons.push("Geometry baseline unknown"); }
  if (evidence.unknown_wall_thickness) { dataRaw -= 6; dataReasons.push("Wall thickness unknown"); }
  if (dataReasons.length > 0) {
    groups.push({ group: "Data Unknowns", raw_delta: dataRaw, capped_delta: Math.max(dataRaw, DATA_UNKNOWNS_CAP), reasons: dataReasons });
  }

  // Group 2: Access Limitations (cap -20%)
  var accessRaw = 0;
  var accessReasons: string[] = [];
  if (evidence.underwater_access_limited) { accessRaw -= 10; accessReasons.push("Underwater access limited"); }
  if (evidence.rov_visibility_poor) { accessRaw -= 8; accessReasons.push("Poor ROV/visual visibility"); }
  if (accessReasons.length > 0) {
    groups.push({ group: "Access Limitations", raw_delta: accessRaw, capped_delta: Math.max(accessRaw, ACCESS_LIMITATIONS_CAP), reasons: accessReasons });
  }

  // Group 3: Operational Unknowns (cap -10%)
  var opRaw = 0;
  var opReasons: string[] = [];
  if (evidence.missing_repair_history) { opRaw -= 8; opReasons.push("Missing repair history"); }
  if (evidence.unknown_operating_temperature) { opRaw -= 5; opReasons.push("Operating temperature unknown"); }
  if (opReasons.length > 0) {
    groups.push({ group: "Operational Unknowns", raw_delta: opRaw, capped_delta: Math.max(opRaw, OPERATIONAL_UNKNOWNS_CAP), reasons: opReasons });
  }

  var totalDelta = 0;
  for (var i = 0; i < groups.length; i++) {
    totalDelta += groups[i].capped_delta;
  }
  var finalConfidence = clamp(initialConfidence + totalDelta, CONFIDENCE_FLOOR, 99);

  return { groups: groups, total_delta: totalDelta, final_confidence: finalConfidence };
}

// ================================================================
// STEP 5: HARD LOCKS
// ================================================================

function buildHardLocks(evidence: any): any[] {
  return [
    {
      code: "HL_PRIMARY_MEMBER_CRACK", name: "Crack in Primary Load Member",
      fired: !!(evidence.crack_confirmed && evidence.crack_in_primary_member),
      rationale: "Confirmed crack in primary load-carrying member requires immediate engineering control.",
      code_basis: "AASHTO MBE, AWS D1.5, API 579 Part 9"
    },
    {
      code: "HL_LOAD_PATH_COMPROMISE", name: "Load Path Compromise",
      fired: !!(evidence.load_path_interruption_possible && (evidence.visible_deformation || evidence.primary_member_involved)),
      rationale: "Possible load-path interruption with visible damage prevents restart without engineering review.",
      code_basis: "AASHTO MBE, API 579 Part 8, API RP 2A"
    },
    {
      code: "HL_FIRE_NO_VALIDATION", name: "Fire Without Material Validation",
      fired: !!(evidence.fire_exposure && (!evidence.hardness_validation_complete || !evidence.metallurgical_validation_complete)),
      rationale: "Fire-exposed components require hardness and metallurgical validation before return to service.",
      code_basis: "API 579-1 Part 11, ASME PCC-2"
    },
    {
      code: "HL_PRESSURE_BOUNDARY", name: "Pressure Boundary Compromise",
      fired: !!(evidence.pressure_boundary_involved && (evidence.leak_confirmed || evidence.pressure_boundary_damage_possible)),
      rationale: "Suspected or confirmed pressure boundary compromise prevents restart.",
      code_basis: "API 510, API 570, ASME PCC-2, API 579"
    },
    {
      code: "HL_SUPPORT_DISPLACEMENT", name: "Support / Restraint Displacement",
      fired: !!(evidence.bearing_displacement || evidence.support_shift),
      rationale: "Support or restraint displacement may alter load path and stress distribution.",
      code_basis: "AASHTO LRFD, API RP 2A"
    },
    {
      code: "HL_MAJOR_DEFORMATION", name: "Major Visible Deformation",
      fired: !!evidence.visible_deformation,
      rationale: "Visible deformation in primary or connected components requires engineering disposition.",
      code_basis: "API 579 Part 8, AISC 303, AASHTO MBE Section 5"
    }
  ];
}

// ================================================================
// STEP 6: STRUCTURAL AUTHORITY
// ================================================================

function resolveStructuralAuthority(evidence: any, hardLocks: any[], survivingFamilies: any[]): any {
  var status = "stable";
  var rationale: string[] = [];

  var primaryDamage = !!(evidence.primary_member_involved && (evidence.visible_deformation || evidence.crack_confirmed || evidence.crack_in_primary_member));
  var loadPathConcern = !!(evidence.load_path_interruption_possible || evidence.support_shift || evidence.bearing_displacement);

  // Also check if LOAD_PATH_DISRUPTION survived as a mechanism
  for (var i = 0; i < survivingFamilies.length; i++) {
    if (survivingFamilies[i].family_code === "LOAD_PATH_DISRUPTION" && survivingFamilies[i].kept) {
      loadPathConcern = true;
      break;
    }
  }

  if (primaryDamage) {
    status = "primary_member_damage_detected";
    rationale.push("Primary load-carrying member damage indicated.");
  }
  if (loadPathConcern) {
    status = "load_path_compromised";
    rationale.push("Load path interruption or redistribution concern.");
  }
  if (evidence.visible_deformation || evidence.visible_cracking || evidence.fire_exposure) {
    if (status === "stable") status = "stability_uncertain";
    rationale.push("Structural stability cannot be assumed until critical areas validated.");
  }

  // Combined primary damage + load path = unstable
  if (primaryDamage && loadPathConcern && (evidence.visible_deformation || evidence.crack_confirmed)) {
    status = "unstable";
    rationale.push("Combined primary-member damage and load-path concern indicate unstable condition.");
  }

  // Also check hard locks
  var unstableLocks = ["HL_PRIMARY_MEMBER_CRACK", "HL_LOAD_PATH_COMPROMISE"];
  for (var h = 0; h < hardLocks.length; h++) {
    if (hardLocks[h].fired) {
      for (var u = 0; u < unstableLocks.length; u++) {
        if (hardLocks[h].code === unstableLocks[u]) {
          status = "unstable";
          if (rationale.indexOf("Hard-lock criteria confirm unstable condition.") === -1) {
            rationale.push("Hard-lock criteria confirm unstable condition.");
          }
        }
      }
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
// STEP 7: DISPOSITION
// ================================================================

function resolveDisposition(evidence: any, hardLocks: any[], structural: any, evidenceLabel: string): string {
  var firedCodes: string[] = [];
  for (var i = 0; i < hardLocks.length; i++) {
    if (hardLocks[i].fired) firedCodes.push(hardLocks[i].code);
  }
  function hasFired(code: string): boolean {
    for (var j = 0; j < firedCodes.length; j++) { if (firedCodes[j] === code) return true; }
    return false;
  }

  if (hasFired("HL_PRIMARY_MEMBER_CRACK") || hasFired("HL_LOAD_PATH_COMPROMISE") || hasFired("HL_PRESSURE_BOUNDARY")) return "no_go";
  if (hasFired("HL_FIRE_NO_VALIDATION") || hasFired("HL_SUPPORT_DISPLACEMENT") || hasFired("HL_MAJOR_DEFORMATION")) return "repair_before_restart";
  if (structural.status === "unstable" || structural.status === "load_path_compromised") return "repair_before_restart";
  if (structural.status === "stability_uncertain" || evidenceLabel === "poor" || evidenceLabel === "limited") return "engineering_review_required";
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

function riskFromDisposition(d: string): string {
  if (d === "no_go") return "critical";
  if (d === "repair_before_restart" || d === "engineering_review_required") return "high";
  return "moderate";
}

// ================================================================
// STEP 8: ZONE PRIORITIZATION
// ================================================================

function prioritizeZones(zones: any[], evidence: any, structural: any): any[] {
  var result: any[] = [];
  for (var i = 0; i < zones.length; i++) {
    var z = zones[i];
    var zl = (z.zone_name || z.zone || "").toLowerCase();
    var priority = z.priority || 2;

    if (structural.primary_member_damage && (zl.indexOf("leg") !== -1 || zl.indexOf("primary") !== -1 || zl.indexOf("girder") !== -1 || zl.indexOf("brace") !== -1)) priority = 1;
    if (structural.load_path_concern && (zl.indexOf("node") !== -1 || zl.indexOf("support") !== -1 || zl.indexOf("bearing") !== -1)) priority = 1;
    if (evidence.fire_exposure && zl.indexOf("fire") !== -1) priority = 1;
    if (evidence.leak_suspected && (zl.indexOf("flange") !== -1 || zl.indexOf("leak") !== -1)) priority = 1;
    if (zl.indexOf("impact") !== -1) priority = 1;

    result.push({ zone_name: z.zone_name || z.zone || "", priority: priority, rationale: z.rationale || "" });
  }
  result.sort(function(a: any, b: any) { return a.priority - b.priority; });
  return result;
}

// ================================================================
// STEP 9: TOP METHODS
// ================================================================

function resolveTopMethods(methods: any[], evidence: any, assetFamily: string): string[] {
  var preferred: string[] = [];
  if (evidence.visible_deformation) preferred.push("VT", "DIMENSIONAL", "UT", "MT");
  if (evidence.visible_cracking || evidence.crack_confirmed) preferred.push("MT", "PT", "UT", "PAUT", "TOFD");
  if (evidence.fire_exposure) preferred.push("HARDNESS", "REPLICA", "VT");
  if (assetFamily === "offshore_platform") preferred.push("CP");

  var allMethods: string[] = [];
  for (var i = 0; i < methods.length; i++) {
    var mn = (methods[i].method_name || methods[i].method || "").toUpperCase();
    if (mn) allMethods.push(mn);
  }

  // Order: preferred first, then remaining
  var ordered: string[] = [];
  var seen: { [key: string]: boolean } = {};

  for (var p = 0; p < preferred.length; p++) {
    if (!seen[preferred[p]]) {
      // Check it exists in available methods
      for (var a = 0; a < allMethods.length; a++) {
        if (allMethods[a] === preferred[p]) { ordered.push(preferred[p]); seen[preferred[p]] = true; break; }
      }
    }
  }
  for (var r = 0; r < allMethods.length; r++) {
    if (!seen[allMethods[r]]) { ordered.push(allMethods[r]); seen[allMethods[r]] = true; }
  }

  return ordered.slice(0, 6);
}

// ================================================================
// STEP 10: METHOD SUPPRESSION
// Removes concrete-only methods on steel assets and vice versa
// ================================================================

function filterMethods(methods: any[], materialFamily: string, assetFamily: string): any {
  var surviving: any[] = [];
  var suppressed: any[] = [];
  var isConcrete = !!CONCRETE_MATERIALS[materialFamily];

  for (var i = 0; i < methods.length; i++) {
    var m = methods[i];
    var mn = (m.method_name || m.method || "").toUpperCase();
    var reason = "";

    // Concrete-only methods on non-concrete asset
    if (CONCRETE_ONLY_METHODS[mn] && !isConcrete) {
      reason = "concrete_method_on_steel_asset";
    }

    // Steel-only methods on concrete asset
    if (STEEL_ONLY_METHODS[mn] && isConcrete) {
      reason = "steel_method_on_concrete_asset";
    }

    if (reason) {
      suppressed.push({ method_name: mn, technique_variant: m.technique_variant || mn, reason: reason, target_mechanism: m.target_mechanism || "" });
    } else {
      surviving.push(m);
    }
  }

  return { surviving: surviving, suppressed: suppressed, input_count: methods.length, surviving_count: surviving.length, suppressed_count: suppressed.length };
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
    ? Math.round(chain.confidence_scores.overall_confidence * 100) : 85;

  // Auto-derive evidence
  var evidence = buildEvidenceFlags(parsed, chain, asset);

  // Step 1: Merge families
  var rawMechs = (chain && chain.engine_1_damage_mechanisms) || [];
  var families = mergeFamilies(rawMechs);

  // Step 2: Evaluate relevance
  for (var i = 0; i < families.length; i++) {
    evaluateFamily(families[i], assetFamily, materialFamily, events, evidence);
  }

  var surviving: any[] = [];
  var suppressed: any[] = [];
  for (var j = 0; j < families.length; j++) {
    if (families[j].kept) surviving.push(families[j]);
    else suppressed.push(families[j]);
  }
  surviving.sort(function(a: any, b: any) { return b.relevance_score - a.relevance_score; });

  // Step 3: Evidence sufficiency
  var evidenceSuff = computeEvidenceSufficiency(evidence);

  // Step 4: Grouped confidence
  var confResult = computeGroupedConfidence(initialConfidence, evidence);

  // Step 5: Hard locks
  var hardLocks = buildHardLocks(evidence);

  // Step 6: Structural authority
  var structural = resolveStructuralAuthority(evidence, hardLocks, surviving);

  // Step 7: Disposition
  var disposition = resolveDisposition(evidence, hardLocks, structural, evidenceSuff.label);
  var riskBand = riskFromDisposition(disposition);

  // Step 8: Zone prioritization
  var zones = (chain && chain.engine_2_affected_zones) || [];
  var prioritizedZones = prioritizeZones(zones, evidence, structural);

  // Step 9: Top methods (with method suppression)
  var rawMethods = (chain && chain.engine_3_inspection_methods) || [];
  var methodFilter = filterMethods(rawMethods, materialFamily, assetFamily);
  var topMethods = resolveTopMethods(methodFilter.surviving, evidence, assetFamily);

  // Build decision trace
  var trace: string[] = [];
  trace.push("Asset family: " + assetFamily + ". Material family: " + materialFamily + ".");
  trace.push("Detected events: " + (events.join(", ") || "none") + ".");
  trace.push("Merged " + rawMechs.length + " raw mechanisms into " + families.length + " families.");
  trace.push(surviving.length + " mechanism families survived; " + suppressed.length + " suppressed.");
  trace.push(methodFilter.surviving_count + " methods survived; " + methodFilter.suppressed_count + " methods suppressed (material/asset mismatch).");
  trace.push("Evidence sufficiency: " + evidenceSuff.label + " (" + evidenceSuff.score + "/100).");

  for (var h = 0; h < hardLocks.length; h++) {
    if (hardLocks[h].fired) {
      trace.push("HARD LOCK: " + hardLocks[h].name + " [" + hardLocks[h].code_basis + "] — " + hardLocks[h].rationale);
    }
  }

  trace.push("Structural authority: " + structural.status_label + ".");
  trace.push("Disposition: " + dispositionLabel(disposition) + ".");
  trace.push("Confidence: " + initialConfidence + "% -> " + confResult.final_confidence + "% (delta: " + confResult.total_delta + ").");

  // Management summary
  var summary: string[] = [];
  summary.push(dispositionLabel(disposition) + " based on deterministic hard-lock and structural authority logic.");
  summary.push(surviving.length + " mechanism families confirmed; " + suppressed.length + " suppressed.");
  if (methodFilter.suppressed_count > 0) summary.push(methodFilter.suppressed_count + " inspection methods suppressed (material/asset mismatch).");
  if (structural.primary_member_damage) summary.push("Primary member damage concern.");
  if (structural.load_path_concern) summary.push("Load path compromise concern.");
  if (evidence.fire_exposure) summary.push("Fire exposure requires validation.");
  if (evidence.pressure_boundary_damage_possible) summary.push("Pressure boundary risk unresolved.");
  summary.push("Evidence sufficiency: " + evidenceSuff.label + ". Confidence: " + confResult.final_confidence + "%.");
  summary.push("Top methods: " + topMethods.join(", ") + ".");

  return {
    engine_version: "decision-dominance-v2.1",
    timestamp: new Date().toISOString(),
    elapsed_ms: Date.now() - startMs,
    disposition: disposition,
    disposition_label: dispositionLabel(disposition),
    risk_band: riskBand,
    initial_confidence: initialConfidence,
    final_confidence: confResult.final_confidence,
    confidence_adjustments: confResult.groups,
    confidence_total_delta: confResult.total_delta,
    evidence_sufficiency: evidenceSuff,
    structural_authority: structural,
    hard_lock_triggers: hardLocks,
    fired_lock_count: hardLocks.filter(function(t: any) { return t.fired; }).length,
    mechanism_summary: {
      raw_input_count: rawMechs.length,
      merged_family_count: families.length,
      surviving_count: surviving.length,
      suppressed_count: suppressed.length
    },
    surviving_mechanisms: surviving,
    suppressed_mechanisms: suppressed,
    method_filter: {
      input_count: methodFilter.input_count,
      surviving_count: methodFilter.surviving_count,
      suppressed_count: methodFilter.suppressed_count,
      suppressed_methods: methodFilter.suppressed
    },
    prioritized_inspection_sequence: prioritizedZones,
    top_methods: topMethods,
    decision_trace: trace,
    management_summary: summary.join(" "),
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
      return { statusCode: 400, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }, body: JSON.stringify({ error: "chain data is required" }) };
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
