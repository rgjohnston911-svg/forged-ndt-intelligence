// DEPLOY115 — regression-test.ts
// Golden Case Regression Suite v1.0
// Validates decision-core outputs against locked expected results
// POST: Accepts decision_core output + case_id, returns pass/fail
// GET: Returns all golden case definitions
// NO TEMPLATE LITERALS — STRING CONCATENATION ONLY

var GOLDEN_CASES: any = {

  // ============================================================================
  // GOLDEN CASE 1: AMINE LINE
  // Input: 8 inch carbon steel amine absorber outlet line, 15 years in service,
  //   amine cracking suspected. Ultrasonic inspection found 40 percent wall loss
  //   at the 6 o'clock position downstream of the elbow. Operating temperature
  //   150 degrees F, operating pressure 200 psi. MDMT concern. Last inspected
  //   5 years ago, no previous findings
  // ============================================================================
  "amine_line": {
    name: "Amine Absorber Outlet Line — Wall Loss Primary",
    transcript: "8 inch carbon steel amine absorber outlet line, 15 years in service, amine cracking suspected. Ultrasonic inspection found 40 percent wall loss at the 6 o'clock position downstream of the elbow. Operating temperature 150 degrees F, operating pressure 200 psi. MDMT concern. Last inspected 5 years ago, no previous findings",
    expected: {
      asset_class: "piping",
      asset_corrected: true,
      primary_authority_contains: "API 570",
      failure_physics_contains: "wall thinning",
      failure_physics_must_not_contain: "Paris Law",
      consequence_tier: "HIGH",
      disposition_one_of: ["ENGINEERING REVIEW REQUIRED", "HOLD FOR REVIEW"],
      primary_mechanism_id_contains: "corrosion",
      damage_confidence_min: 0.5,
      damage_confidence_max: 0.85
    },
    critical_fields: ["asset_class", "failure_physics_contains", "failure_physics_must_not_contain", "primary_authority_contains"],
    added_date: "2026-04-05",
    added_reason: "DEPLOY115 evidence hierarchy — wall loss must outrank suspected cracking"
  },

  // ============================================================================
  // GOLDEN CASE 2: HYDRO LINE
  // Input: We're on that hot hydro line coming off the reactor... thinned out...
  //   35-40% down...
  // ============================================================================
  "hydro_line": {
    name: "Hydrocracking Outlet Line — Thinning with Reactor Context",
    transcript: "We're on that hot hydro line coming off the reactor right past that elbow going into the exchanger. Pipe's got some scale on it, coating's cooked. UT grid shows it's thinned out pretty good on the intrados maybe 35-40% down.",
    expected: {
      asset_class: "piping",
      asset_corrected: true,
      primary_authority_contains: "API 570",
      failure_physics_contains: "wall thinning",
      failure_physics_must_not_contain: "Paris Law",
      consequence_tier: "HIGH",
      disposition_one_of: ["ENGINEERING REVIEW REQUIRED", "HOLD FOR REVIEW"],
      primary_mechanism_id_contains: "corrosion",
      damage_confidence_min: 0.5,
      damage_confidence_max: 0.9
    },
    critical_fields: ["asset_class", "failure_physics_contains", "failure_physics_must_not_contain"],
    added_date: "2026-04-05",
    added_reason: "DEPLOY115 piping lock — reactor must not override piping. Field slang thinned out must trigger corrosion."
  },

  // ============================================================================
  // GOLDEN CASE 3: RAILROAD BRIDGE
  // Input: That lower girder's been taking a beating... coal trains...
  // ============================================================================
  "railroad_bridge": {
    name: "Railroad Bridge Girder — Structural Domain Lock",
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
    added_reason: "DEPLOY115 structural domain lock — bridge must never be classified as piping. steel must not match tee."
  }

};

// ============================================================================
// VALIDATION ENGINE
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

  // Extract DC fields
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
  var primaryMechId = "";
  if (dc.damage_reality && dc.damage_reality.primary_mechanism && dc.damage_reality.primary_mechanism.id) {
    primaryMechId = dc.damage_reality.primary_mechanism.id;
  }
  var damageConf = 0;
  if (dc.damage_reality && dc.damage_reality.primary_mechanism && dc.damage_reality.primary_mechanism.reality_score) {
    damageConf = dc.damage_reality.primary_mechanism.reality_score;
  }

  // Run checks
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

  // GET: Return all golden case definitions
  if (event.httpMethod === "GET") {
    var caseList: any[] = [];
    for (var key in GOLDEN_CASES) {
      if (GOLDEN_CASES.hasOwnProperty(key)) {
        caseList.push({
          case_id: key,
          name: GOLDEN_CASES[key].name,
          transcript: GOLDEN_CASES[key].transcript,
          expected: GOLDEN_CASES[key].expected,
          critical_fields: GOLDEN_CASES[key].critical_fields,
          added_date: GOLDEN_CASES[key].added_date,
          added_reason: GOLDEN_CASES[key].added_reason
        });
      }
    }
    return { statusCode: 200, headers: headers, body: JSON.stringify({ golden_cases: caseList, count: caseList.length }) };
  }

  // POST: Validate a decision-core output against a golden case
  if (event.httpMethod === "POST") {
    try {
      var body = JSON.parse(event.body || "{}");
      var caseId = body.case_id || "";
      var dcOutput = body.decision_core_output || body.decision_core || {};

      if (!caseId) {
        // Validate all cases if array of results provided
        if (body.results && Array.isArray(body.results)) {
          var batchResults: any[] = [];
          var batchAllPassed = true;
          for (var bi = 0; bi < body.results.length; bi++) {
            var br = body.results[bi];
            var bResult = validateCase(br.case_id, br.decision_core_output || br.decision_core || {});
            batchResults.push(bResult);
            if (!bResult.passed) batchAllPassed = false;
          }
          return {
            statusCode: 200, headers: headers,
            body: JSON.stringify({ batch: true, all_passed: batchAllPassed, results: batchResults })
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
