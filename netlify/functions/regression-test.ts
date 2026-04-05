// DEPLOY119 — regression-test.ts v2.1
// Golden Case Regression Suite — 20 cases
// Validates decision-core outputs against locked expected results
// POST: Accepts decision_core output + case_id, returns pass/fail
// GET: Returns all golden case definitions
// NO TEMPLATE LITERALS — STRING CONCATENATION ONLY
// v2.1 FIX: Disposition format normalization (snake_case → DISPLAY FORMAT)

var GOLDEN_CASES: any = {

  // ============================================================================
  // CATEGORY 1: PIPING — CORROSION/THINNING SCENARIOS
  // ============================================================================

  "amine_line": {
    name: "Amine Absorber Outlet Line — Wall Loss Primary",
    category: "piping_corrosion",
    transcript: "8 inch carbon steel amine absorber outlet line, 15 years in service, amine cracking suspected. Ultrasonic inspection found 40 percent wall loss at the 6 o'clock position downstream of the elbow. Operating temperature 150 degrees F, operating pressure 200 psi. MDMT concern. Last inspected 5 years ago, no previous findings",
    expected: {
      asset_class: "piping",
      asset_corrected: true,
      primary_authority_contains: "API 570",
      failure_physics_contains: "wall thinning",
      failure_physics_must_not_contain: "Paris Law",
      consequence_tier: "HIGH",
      disposition_one_of: ["ENGINEERING REVIEW REQUIRED", "HOLD FOR REVIEW"],
      primary_mechanism_id_contains: "corrosion"
    },
    critical_fields: ["asset_class", "failure_physics_contains", "failure_physics_must_not_contain", "primary_authority_contains"],
    added_date: "2026-04-05",
    added_reason: "DEPLOY115 evidence hierarchy — wall loss must outrank suspected cracking"
  },

  "hydro_line": {
    name: "Hydrocracking Outlet Line — Thinning with Reactor Context",
    category: "piping_corrosion",
    transcript: "We're on that hot hydro line coming off the reactor right past that elbow going into the exchanger. Pipe's got some scale on it, coating's cooked. UT grid shows it's thinned out pretty good on the intrados maybe 35-40% down.",
    expected: {
      asset_class: "piping",
      asset_corrected: true,
      primary_authority_contains: "API 570",
      failure_physics_contains: "wall thinning",
      failure_physics_must_not_contain: "Paris Law",
      consequence_tier: "HIGH",
      disposition_one_of: ["ENGINEERING REVIEW REQUIRED", "HOLD FOR REVIEW"]
    },
    critical_fields: ["asset_class", "failure_physics_contains", "failure_physics_must_not_contain"],
    added_date: "2026-04-05",
    added_reason: "DEPLOY115 piping lock — reactor must not override piping. Field slang thinned out must trigger corrosion."
  },

  "cui_refinery": {
    name: "CUI on Refinery Piping — Localized Thinning at Support",
    category: "piping_corrosion",
    transcript: "6 inch carbon steel line near the elbow. Rusty spot, looks like it's been sweating under the insulation. Damaged insulation and wet lagging. External rust staining at 6 o'clock. Area at pipe support near elbow. Last inspection 5 years ago, previous readings within acceptable limits. UT at exposed area shows 0.190 inch versus 0.280 nominal.",
    expected: {
      asset_class: "piping",
      primary_authority_contains: "API 570",
      failure_physics_contains: "wall thinning",
      consequence_tier_one_of: ["HIGH", "MEDIUM"],
      disposition_one_of: ["ENGINEERING REVIEW REQUIRED", "HOLD FOR REVIEW", "CONDITIONAL ACCEPT"]
    },
    critical_fields: ["asset_class", "primary_authority_contains", "failure_physics_contains"],
    added_date: "2026-04-05",
    added_reason: "Standard CUI scenario — corrosion must be primary, wall thinning narrative."
  },

  "negated_crack": {
    name: "Explicit Negation — No Crack Found, Wall Loss Confirmed",
    category: "piping_negation",
    transcript: "8 inch carbon steel line, no cracking found, wall loss confirmed at 30 percent, no leaks. Hydrocarbon service, 250 psi, 120 degrees F.",
    expected: {
      asset_class: "piping",
      failure_physics_contains: "wall thinning",
      failure_physics_must_not_contain: "Paris Law",
      primary_mechanism_id_contains: "corrosion"
    },
    critical_fields: ["failure_physics_contains", "failure_physics_must_not_contain", "primary_mechanism_id_contains"],
    added_date: "2026-04-05",
    added_reason: "DEPLOY117 negation — no crack found must suppress cracking, corrosion must win."
  },

  // ============================================================================
  // CATEGORY 2: PIPING — CRACKING SCENARIOS (fatigue/SCC should win)
  // ============================================================================

  "confirmed_crack_piping": {
    name: "Confirmed Crack in Piping — Fatigue Should Win",
    category: "piping_cracking",
    transcript: "12 inch carbon steel steam header, crack confirmed at circumferential weld by MT and TOFD. Crack is 4 inches long, 3mm deep. Cyclic thermal loading from daily startup shutdown. 600 degrees F, 400 psi. 20 years service.",
    expected: {
      asset_class: "piping",
      primary_authority_contains: "API 570",
      primary_mechanism_id_contains: "fatigue",
      consequence_tier_one_of: ["HIGH", "CRITICAL"],
      disposition_one_of: ["ENGINEERING REVIEW REQUIRED", "REPAIR BEFORE RESTART", "HOLD FOR REVIEW"]
    },
    critical_fields: ["primary_mechanism_id_contains"],
    added_date: "2026-04-05",
    added_reason: "Regression check — when cracking IS confirmed by NDE, fatigue must still win over corrosion."
  },

  "scc_caustic_piping": {
    name: "Caustic SCC — Amine Service with Confirmed Cracking",
    category: "piping_cracking",
    transcript: "10 inch carbon steel amine regenerator overhead line. Crack confirmed at weld toe by wet fluorescent MT. Branching crack morphology consistent with caustic stress corrosion cracking. Amine service, 200 degrees F, 100 psi. 18 years service.",
    expected: {
      asset_class: "piping",
      primary_authority_contains: "API 570",
      consequence_tier_one_of: ["HIGH", "CRITICAL"],
      disposition_one_of: ["ENGINEERING REVIEW REQUIRED", "REPAIR BEFORE RESTART"]
    },
    critical_fields: ["asset_class", "primary_authority_contains"],
    added_date: "2026-04-05",
    added_reason: "SCC scenario — confirmed cracking with morphology should escalate."
  },

  // ============================================================================
  // CATEGORY 3: STRUCTURAL — BRIDGE SCENARIOS
  // ============================================================================

  "railroad_bridge": {
    name: "Railroad Bridge Girder — Structural Domain Lock",
    category: "bridge",
    transcript: "That lower girder's been taking a beating. We got rust bleed around the connection and that old repair looks like it might be opening up again. Web's got a little wrinkle near the brace tie-in, not bad-bad but it doesn't look right. There's a line at the toe of that weld hard to tell if it's just paint break or an actual crack. UT was kind of jumpy around the plate stack-up, and the mag showed a faint pull but not super clean. Bottom flange has some loss where the water sits and the stiffener area is pretty eaten up. With these coal trains pounding over it, this might be one of those fatigue spots.",
    expected: {
      asset_class_one_of: ["rail_bridge", "bridge", "bridge_steel"],
      asset_corrected: false,
      primary_authority_contains: "AASHTO",
      failure_physics_must_not_contain: "hoop stress",
      failure_physics_must_not_contain_2: "pinhole leak",
      failure_physics_must_not_contain_3: "pressure boundary",
      consequence_tier_one_of: ["HIGH", "CRITICAL"],
      disposition_one_of: ["ENGINEERING REVIEW REQUIRED", "HOLD FOR REVIEW", "REPAIR BEFORE RESTART"]
    },
    critical_fields: ["asset_class_one_of", "primary_authority_contains", "failure_physics_must_not_contain"],
    added_date: "2026-04-05",
    added_reason: "DEPLOY115 structural domain lock — bridge must never be classified as piping."
  },

  "highway_bridge": {
    name: "Highway Bridge — Fatigue at Gusset Connection",
    category: "bridge",
    transcript: "Highway bridge over river. Steel girder with gusset plate connection showing fatigue crack at toe of fillet weld. Traffic loading, 45 years service. Crack confirmed by MT, 6 inches long along weld toe. Section loss at bottom flange from splash zone corrosion.",
    expected: {
      asset_class_one_of: ["bridge", "bridge_steel"],
      primary_authority_contains: "AASHTO",
      failure_physics_must_not_contain: "hoop stress",
      consequence_tier_one_of: ["HIGH", "CRITICAL"]
    },
    critical_fields: ["asset_class_one_of", "primary_authority_contains"],
    added_date: "2026-04-05",
    added_reason: "Bridge with confirmed fatigue crack — must stay structural, never become piping."
  },

  // ============================================================================
  // CATEGORY 4: OFFSHORE
  // ============================================================================

  "deepwater_offshore": {
    name: "Deepwater Sour-Service Platform — Multi-Mechanism Post-Storm",
    category: "offshore",
    transcript: "Deepwater offshore gas production and compression platform. Water depth 4200 ft. Wet sour gas with CO2 H2S chlorides condensate sand production and amine carryover risk. 17 years operating. Severe storm loading followed by compressor upset emergency shutdown rapid depressurization. Abnormal vibration in export compressor train. Pressure fluctuation downstream of second-stage compression. Intermittent sour gas detector alarms near pipe rack. Unexpected amine foaming and carryover. Elevated iron sulfide in process drains. Unexplained wall-thickness loss trend in one 18-inch elbow spool. Storm-induced motion plus existing fatigue damage may have accelerated cracking. ROV reported coating damage and possible clamp movement near subsea riser guide. Marine growth shadowing around brace connection. Possible impact damage from storm debris on subsea caisson support frame. One anode bank partially detached.",
    expected: {
      asset_class: "offshore_platform",
      asset_corrected: false,
      primary_authority_contains: "API RP 2A",
      failure_physics_must_not_contain: "hoop stress",
      failure_physics_must_not_contain_2: "pinhole leak",
      consequence_tier_one_of: ["HIGH", "CRITICAL"],
      disposition_one_of: ["HOLD FOR REVIEW", "ENGINEERING REVIEW REQUIRED", "REPAIR BEFORE RESTART"]
    },
    critical_fields: ["asset_class", "primary_authority_contains", "failure_physics_must_not_contain"],
    added_date: "2026-04-05",
    added_reason: "Multi-mechanism offshore — must maintain structural classification and refuse unsafe disposition."
  },

  // ============================================================================
  // CATEGORY 5: PRESSURE VESSEL
  // ============================================================================

  "pressure_vessel_hydrogen": {
    name: "Hydrocracker Reactor Vessel — Hydrogen Service",
    category: "vessel",
    transcript: "Hydrocracker reactor vessel. 2.25 chrome 1 moly steel. Wall thickness 4.5 inches. Hydrogen service at 2000 psi and 800 degrees F. 25 years service. UT scanning shows no wall loss. Hardness survey at weld shows elevated readings. Concern for temper embrittlement and hydrogen attack.",
    expected: {
      asset_class: "pressure_vessel",
      primary_authority_contains: "API 510",
      consequence_tier_one_of: ["HIGH", "CRITICAL"]
    },
    critical_fields: ["asset_class", "primary_authority_contains"],
    added_date: "2026-04-05",
    added_reason: "Vessel scenario — must classify as pressure_vessel, not piping."
  },

  "separator_vessel": {
    name: "HP Separator — Internal Corrosion",
    category: "vessel",
    transcript: "High pressure separator vessel. Carbon steel. Sour gas service with H2S and water. Internal inspection found 25 percent wall loss on bottom head. Pitting corrosion at liquid level interface. 500 psi, 180 degrees F. 15 years service. No cracking detected by MT on all welds.",
    expected: {
      asset_class: "pressure_vessel",
      primary_authority_contains: "API 510",
      failure_physics_contains: "wall thinning",
      primary_mechanism_id_contains: "corrosion"
    },
    critical_fields: ["asset_class", "primary_mechanism_id_contains"],
    added_date: "2026-04-05",
    added_reason: "Vessel with confirmed corrosion and negative crack finding — corrosion must be primary."
  },

  // ============================================================================
  // CATEGORY 6: FIRE DAMAGE
  // ============================================================================

  "fire_damage_piping": {
    name: "Fire-Exposed Piping — Post-Fire Assessment",
    category: "fire",
    transcript: "8 inch carbon steel process line exposed to fire for approximately 45 minutes during unit fire. External coating completely burned off. Visible discoloration and scale on pipe surface. No visible deformation. Hardness testing not yet performed. Material properties unknown. 300 psi, 400 degrees F normal operation.",
    expected: {
      asset_class: "piping",
      primary_authority_contains: "API 570",
      consequence_tier_one_of: ["HIGH", "CRITICAL"],
      disposition_one_of: ["ENGINEERING REVIEW REQUIRED", "HOLD FOR REVIEW", "REPAIR BEFORE RESTART"]
    },
    critical_fields: ["asset_class", "consequence_tier_one_of"],
    added_date: "2026-04-05",
    added_reason: "Fire scenario — must escalate, cannot accept without hardness/material validation."
  },

  // ============================================================================
  // CATEGORY 7: FIELD SLANG / ADVERSARIAL INPUTS
  // ============================================================================

  "field_slang_heavy": {
    name: "Heavy Field Slang — Elbow Erosion",
    category: "adversarial_slang",
    transcript: "That elbow's been eating itself up real bad. Bottom side is paper thin. Looks like the flow's been chewing on it. Coating's shot, you can see daylight almost. Been running like this for who knows how long. Probably needs to come out.",
    expected: {
      asset_class: "piping",
      failure_physics_contains: "wall thinning",
      primary_mechanism_id_contains: "corrosion",
      consequence_tier_one_of: ["HIGH", "CRITICAL"]
    },
    critical_fields: ["asset_class", "failure_physics_contains"],
    added_date: "2026-04-05",
    added_reason: "Field slang test — eating, paper thin, chewing must trigger corrosion/erosion, not fatigue."
  },

  "ambiguous_mixed": {
    name: "Ambiguous Mixed Input — Multiple Damage Modes",
    category: "adversarial_ambiguous",
    transcript: "Something's going on with this line. There's rust, there might be a crack, the support looks off, and the insulation is wet. Could be corrosion, could be fatigue, could be CUI, hard to tell really. It's been in service forever.",
    expected: {
      disposition_one_of: ["HOLD FOR REVIEW", "ENGINEERING REVIEW REQUIRED"]
    },
    critical_fields: ["disposition_one_of"],
    added_date: "2026-04-05",
    added_reason: "Ambiguity test — system must not over-commit to single mechanism, must hold for review."
  },

  "minimal_input": {
    name: "Minimal Input — Almost No Data",
    category: "adversarial_sparse",
    transcript: "There's a problem with the pipe.",
    expected: {
      asset_class: "piping",
      disposition_one_of: ["HOLD FOR REVIEW", "ENGINEERING REVIEW REQUIRED"]
    },
    critical_fields: ["disposition_one_of"],
    added_date: "2026-04-05",
    added_reason: "Sparse input test — system must not make confident disposition with almost no data."
  },

  // ============================================================================
  // CATEGORY 8: NEGATION SCENARIOS
  // ============================================================================

  "all_negated": {
    name: "All Findings Negated — Clean Inspection",
    category: "negation",
    transcript: "8 inch carbon steel piping. No corrosion found. No cracking detected. No deformation observed. No leaks. Coating intact. Insulation dry. All thickness readings within acceptable limits. 200 psi, 300 degrees F. Hydrocarbon service.",
    expected: {
      asset_class: "piping",
      primary_authority_contains: "API 570"
    },
    critical_fields: ["asset_class"],
    added_date: "2026-04-05",
    added_reason: "Clean inspection — negated findings should not inflate mechanism scores."
  },

  "partial_negation": {
    name: "Partial Negation — Corrosion Yes, Crack No",
    category: "negation",
    transcript: "10 inch carbon steel steam line. Corrosion confirmed at support, 20 percent wall loss by UT. No cracking found by MT at all weld toes. No leaks. 450 degrees F, 600 psi.",
    expected: {
      asset_class: "piping",
      primary_mechanism_id_contains: "corrosion",
      failure_physics_contains: "wall thinning"
    },
    critical_fields: ["primary_mechanism_id_contains", "failure_physics_contains"],
    added_date: "2026-04-05",
    added_reason: "Partial negation — corrosion confirmed + crack ruled out. Corrosion must be primary, fatigue suppressed."
  },

  // ============================================================================
  // CATEGORY 9: HIGH-CONSEQUENCE EDGE CASES
  // ============================================================================

  "hydrogen_recycle_line": {
    name: "Hydrogen Recycle Line — Multi-Mechanism with Vibration",
    category: "high_consequence",
    transcript: "10 inch hydrogen recycle line, carbon steel, hydrotreater unit. 22 years service. 1200 psi, 650 degrees F. Recent upset with rapid cooldown. Line chattering, support shifted. Lagging shot, wet insulation, rust bleeding through. Bottom side thin, been eating for a while. Little line at weld toe, could be crack could be junk, hard to tell. Last inspection 6 years ago.",
    expected: {
      asset_class: "piping",
      consequence_tier: "HIGH",
      disposition_one_of: ["HOLD FOR REVIEW", "ENGINEERING REVIEW REQUIRED"]
    },
    critical_fields: ["asset_class", "consequence_tier", "disposition_one_of"],
    added_date: "2026-04-05",
    added_reason: "Multi-mechanism hydrogen scenario — must not oversimplify, must hold for review."
  },

  "hvl_line": {
    name: "HVL (Highly Volatile Liquid) Line — Maximum Consequence",
    category: "high_consequence",
    transcript: "4 inch carbon steel propane line. LPG service. 300 psi, ambient temperature. Wall loss found at thread connection, 30 percent. Located near occupied control room. Vibration from nearby compressor.",
    expected: {
      asset_class: "piping",
      consequence_tier_one_of: ["HIGH", "CRITICAL"],
      disposition_one_of: ["ENGINEERING REVIEW REQUIRED", "HOLD FOR REVIEW", "REPAIR BEFORE RESTART"]
    },
    critical_fields: ["consequence_tier_one_of"],
    added_date: "2026-04-05",
    added_reason: "HVL near occupied area — consequence must be HIGH or CRITICAL."
  },

  // ============================================================================
  // CATEGORY 10: TANK
  // ============================================================================

  "storage_tank_bottom": {
    name: "Aboveground Storage Tank — Floor Corrosion",
    category: "tank",
    transcript: "Aboveground storage tank. Carbon steel. Crude oil service. Tank bottom inspection found widespread corrosion on floor plates. Average remaining thickness 0.180 inches versus 0.250 nominal. Several pits below 0.100 inches. No shell corrosion above product level. 30 years service.",
    expected: {
      asset_class_one_of: ["tank", "storage_tank"],
      primary_mechanism_id_contains: "corrosion",
      failure_physics_contains: "wall thinning"
    },
    critical_fields: ["asset_class_one_of", "primary_mechanism_id_contains"],
    added_date: "2026-04-05",
    added_reason: "Tank scenario — must classify as tank, corrosion primary."
  }

};

// ============================================================================
// DISPOSITION FORMAT NORMALIZATION
// ============================================================================
// Decision-core returns snake_case (e.g. "hold_for_review")
// Golden cases use DISPLAY FORMAT (e.g. "HOLD FOR REVIEW")
// This normalizer maps both directions so comparison works regardless of format

var DISPOSITION_MAP: any = {
  "hold_for_review": "HOLD FOR REVIEW",
  "engineering_review_required": "ENGINEERING REVIEW REQUIRED",
  "repair_before_restart": "REPAIR BEFORE RESTART",
  "conditional_accept": "CONDITIONAL ACCEPT",
  "accept": "ACCEPT",
  "reject": "REJECT",
  "go": "GO",
  "no_go": "NO GO",
  "indeterminate": "INDETERMINATE"
};

function normalizeDisposition(raw: string): string {
  if (!raw) return "";
  var lower = String(raw).toLowerCase().replace(/\s+/g, "_");
  if (DISPOSITION_MAP[lower]) return DISPOSITION_MAP[lower];
  // If already in DISPLAY FORMAT, return as-is
  var upper = String(raw).toUpperCase().replace(/_/g, " ");
  return upper;
}

// ============================================================================
// VALIDATION ENGINE (v2.1 — disposition normalization added)
// ============================================================================

function validateCase(caseId: string, dcOutput: any): any {
  var golden = GOLDEN_CASES[caseId];
  if (!golden) {
    return { error: "Unknown golden case: " + caseId, passed: false };
  }

  var expected = golden.expected;
  var results: any[] = [];
  var allPassed = true;
  var criticalFailed = false;
  var isCritical = function(field: string): boolean {
    if (!golden.critical_fields) return false;
    for (var i = 0; i < golden.critical_fields.length; i++) {
      if (golden.critical_fields[i] === field) return true;
    }
    return false;
  };

  var dc = dcOutput.decision_core || dcOutput;
  var assetClass = "";
  if (dc.asset_correction && dc.asset_correction.corrected_to) {
    assetClass = dc.asset_correction.corrected_to;
  } else if (dc.asset_correction && dc.asset_correction.original) {
    assetClass = dc.asset_correction.original;
  }
  var assetCorrected = !!(dc.asset_correction && dc.asset_correction.corrected);
  var primaryAuth = "";
  if (dc.authority_reality && dc.authority_reality.primary_authority) {
    primaryAuth = dc.authority_reality.primary_authority;
  }
  var failPhysics = "";
  if (dc.consequence_reality && dc.consequence_reality.failure_physics) {
    failPhysics = dc.consequence_reality.failure_physics;
  }
  var consTier = "";
  if (dc.consequence_reality && dc.consequence_reality.consequence_tier) {
    consTier = dc.consequence_reality.consequence_tier;
  }
  var disposition = "";
  if (dc.decision_reality && dc.decision_reality.disposition_label) {
    disposition = dc.decision_reality.disposition_label;
  } else if (dc.decision_reality && dc.decision_reality.disposition) {
    disposition = String(dc.decision_reality.disposition);
  }
  // DEPLOY119: Normalize disposition format before comparison
  disposition = normalizeDisposition(disposition);
  var primaryMechId = "";
  if (dc.damage_reality && dc.damage_reality.primary_mechanism && dc.damage_reality.primary_mechanism.id) {
    primaryMechId = dc.damage_reality.primary_mechanism.id;
  }
  var damageConf = 0;
  if (dc.damage_reality && dc.damage_reality.primary_mechanism && dc.damage_reality.primary_mechanism.reality_score) {
    damageConf = dc.damage_reality.primary_mechanism.reality_score;
  }

  function check(field: string, actual: any, expected: any, comparison: string) {
    var passed = false;
    if (comparison === "equals") passed = actual === expected;
    else if (comparison === "contains") passed = String(actual).indexOf(String(expected)) !== -1;
    else if (comparison === "not_contains") passed = String(actual).indexOf(String(expected)) === -1;
    else if (comparison === "one_of") {
      for (var oi = 0; oi < expected.length; oi++) { if (actual === expected[oi]) { passed = true; break; } }
    }
    else if (comparison === "gte") passed = actual >= expected;
    else if (comparison === "lte") passed = actual <= expected;

    var critical = isCritical(field);
    if (!passed) { allPassed = false; if (critical) criticalFailed = true; }
    results.push({ field: field, expected: expected, actual: actual, comparison: comparison, passed: passed, critical: critical });
  }

  if (expected.asset_class) check("asset_class", assetClass, expected.asset_class, "equals");
  if (expected.asset_class_one_of) check("asset_class_one_of", assetClass, expected.asset_class_one_of, "one_of");
  if (expected.asset_corrected !== undefined) check("asset_corrected", assetCorrected, expected.asset_corrected, "equals");
  if (expected.primary_authority_contains) check("primary_authority_contains", primaryAuth, expected.primary_authority_contains, "contains");
  if (expected.failure_physics_contains) check("failure_physics_contains", failPhysics, expected.failure_physics_contains, "contains");
  if (expected.failure_physics_must_not_contain) check("failure_physics_must_not_contain", failPhysics, expected.failure_physics_must_not_contain, "not_contains");
  if (expected.failure_physics_must_not_contain_2) check("failure_physics_must_not_contain_2", failPhysics, expected.failure_physics_must_not_contain_2, "not_contains");
  if (expected.failure_physics_must_not_contain_3) check("failure_physics_must_not_contain_3", failPhysics, expected.failure_physics_must_not_contain_3, "not_contains");
  if (expected.consequence_tier) check("consequence_tier", consTier, expected.consequence_tier, "equals");
  if (expected.consequence_tier_one_of) check("consequence_tier_one_of", consTier, expected.consequence_tier_one_of, "one_of");
  if (expected.disposition_one_of) check("disposition_one_of", disposition, expected.disposition_one_of, "one_of");
  if (expected.primary_mechanism_id_contains) check("primary_mechanism_id_contains", primaryMechId, expected.primary_mechanism_id_contains, "contains");
  if (expected.damage_confidence_min) check("damage_confidence_min", damageConf, expected.damage_confidence_min, "gte");
  if (expected.damage_confidence_max) check("damage_confidence_max", damageConf, expected.damage_confidence_max, "lte");

  return {
    case_id: caseId,
    case_name: golden.name,
    category: golden.category,
    passed: allPassed,
    critical_failed: criticalFailed,
    total_checks: results.length,
    passed_checks: results.filter(function(r: any) { return r.passed; }).length,
    failed_checks: results.filter(function(r: any) { return !r.passed; }),
    all_results: results
  };
}

// ============================================================================
// NETLIFY HANDLER
// ============================================================================

var handler = async function(event: any): Promise<any> {
  var headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Content-Type": "application/json" };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: headers, body: "" };
  }

  if (event.httpMethod === "GET") {
    var caseList: any[] = [];
    var categories: any = {};
    for (var key in GOLDEN_CASES) {
      if (GOLDEN_CASES.hasOwnProperty(key)) {
        var gc = GOLDEN_CASES[key];
        caseList.push({
          case_id: key,
          name: gc.name,
          category: gc.category,
          transcript: gc.transcript,
          expected: gc.expected,
          critical_fields: gc.critical_fields,
          added_date: gc.added_date,
          added_reason: gc.added_reason
        });
        if (!categories[gc.category]) categories[gc.category] = 0;
        categories[gc.category]++;
      }
    }
    return { statusCode: 200, headers: headers, body: JSON.stringify({ golden_cases: caseList, count: caseList.length, categories: categories }) };
  }

  if (event.httpMethod === "POST") {
    try {
      var body = JSON.parse(event.body || "{}");
      var caseId = body.case_id || "";
      var dcOutput = body.decision_core_output || body.decision_core || {};

      if (!caseId) {
        if (body.results && Array.isArray(body.results)) {
          var batchResults: any[] = [];
          var batchAllPassed = true;
          var batchCriticalFailed = false;
          for (var bi = 0; bi < body.results.length; bi++) {
            var br = body.results[bi];
            var bResult = validateCase(br.case_id, br.decision_core_output || br.decision_core || {});
            batchResults.push(bResult);
            if (!bResult.passed) batchAllPassed = false;
            if (bResult.critical_failed) batchCriticalFailed = true;
          }
          return {
            statusCode: 200, headers: headers,
            body: JSON.stringify({ batch: true, all_passed: batchAllPassed, critical_failed: batchCriticalFailed, total: batchResults.length, passed: batchResults.filter(function(r: any) { return r.passed; }).length, failed: batchResults.filter(function(r: any) { return !r.passed; }).length, results: batchResults })
          };
        }
        return { statusCode: 400, headers: headers, body: JSON.stringify({ error: "case_id is required" }) };
      }

      var result = validateCase(caseId, dcOutput);
      return { statusCode: 200, headers: headers, body: JSON.stringify(result) };

    } catch (err: any) {
      return { statusCode: 500, headers: headers, body: JSON.stringify({ error: "regression-test error", message: err.message || "Unknown" }) };
    }
  }

  return { statusCode: 405, headers: headers, body: JSON.stringify({ error: "Method not allowed" }) };
};

export { handler };
