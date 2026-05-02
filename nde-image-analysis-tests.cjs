/**
 * NDE Image Analysis Engine — Integration Test Suite
 * Tests all 3 tiers, all modalities, edge cases, and pipeline integrity
 *
 * Run: node nde-image-analysis-tests.cjs
 * Target: https://4dndt.netlify.app/.netlify/functions/nde-image-analysis
 */

var https = require("https");

var BASE_URL = "https://4dndt.netlify.app/.netlify/functions/nde-image-analysis";

function post(body) {
  return new Promise(function (resolve, reject) {
    var data = JSON.stringify(body);
    var url = new URL(BASE_URL);
    var options = {
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    };
    var req = https.request(options, function (res) {
      var chunks = [];
      res.on("data", function (c) { chunks.push(c); });
      res.on("end", function () {
        var raw = Buffer.concat(chunks).toString();
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch (e) {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

var passed = 0;
var failed = 0;
var errors = [];

function assert(testId, label, condition, detail) {
  if (condition) {
    passed++;
    console.log("  PASS  Case " + testId + ": " + label);
  } else {
    failed++;
    var msg = "  FAIL  Case " + testId + ": " + label + (detail ? " — " + detail : "");
    console.log(msg);
    errors.push(msg);
  }
}

async function runTests() {
  console.log("=== NDE IMAGE ANALYSIS ENGINE — INTEGRATION TESTS ===\n");

  // ============================================================
  // SECTION 1: Registry & Tier Tests
  // ============================================================
  console.log("--- Section 1: Registry & Tier Capabilities ---");

  // Case 1: get_registry returns valid structure
  var r1 = await post({ action: "get_registry" });
  assert(1, "get_registry returns 200", r1.status === 200);
  assert(2, "engine name correct", r1.body.engine === "nde-image-analysis");
  assert(3, "version is v2.0.0", r1.body.version === "v2.0.0");
  assert(4, "has 3 tiers", r1.body.tier_matrix && Object.keys(r1.body.tier_matrix).length === 3);
  assert(5, "has modalities", r1.body.supported_modalities && r1.body.supported_modalities.length >= 8);
  assert(6, "has codes", r1.body.supported_codes && r1.body.supported_codes.length >= 3);
  assert(7, "has discontinuities", r1.body.discontinuity_count >= 20);
  assert(8, "has 12 actions", r1.body.actions && r1.body.actions.length === 12);

  // Case 9: get_tier_capabilities — all tiers
  var r9 = await post({ action: "get_tier_capabilities" });
  assert(9, "tier capabilities returns all tiers", r9.status === 200 && r9.body.tiers && r9.body.tiers.basic && r9.body.tiers.pro && r9.body.tiers.main);

  // Case 10: get_tier_capabilities — specific tier
  var r10 = await post({ action: "get_tier_capabilities", tier: "pro" });
  assert(10, "pro tier has PAUT", r10.body.tier && r10.body.tier.supported_modalities.indexOf("PAUT") !== -1);

  // ============================================================
  // SECTION 2: Basic Tier — Student Weld Photo Analysis
  // ============================================================
  console.log("\n--- Section 2: Basic Tier — Student Weld Photos ---");

  // Case 11: Simple porosity detection from phone camera
  var r11 = await post({
    action: "analyze_image",
    tier: "basic",
    modality: "VT",
    governing_code: "aws_d1_1",
    observations: {
      features: ["porosity", "surface", "small", "round", "holes", "scattered"],
      raw_description: "Small round holes visible on the surface of the weld bead, scattered pattern",
      regions: []
    }
  });
  assert(11, "basic analysis returns 200", r11.status === 200);
  assert(12, "tier is basic", r11.body.tier === "basic");
  assert(13, "detects porosity", r11.body.vision && r11.body.vision.discontinuities_detected >= 1);
  assert(14, "has educational feedback", r11.body.educational_feedback !== null);
  assert(15, "has study tips", r11.body.educational_feedback && r11.body.educational_feedback.study_tips.length > 0);
  assert(16, "has skill assessment", r11.body.educational_feedback && r11.body.educational_feedback.skill_assessment !== null);
  assert(17, "no physics consequence (basic)", r11.body.physics_consequence === null);
  assert(18, "no proof trace (basic)", r11.body.proof_trace === null);

  // Case 19: Crack detection — critical finding
  var r19 = await post({
    action: "analyze_image",
    tier: "basic",
    modality: "VT",
    governing_code: "aws_d1_1",
    observations: {
      features: ["crack", "linear", "longitudinal", "dark", "line", "parallel", "weld"],
      raw_description: "Linear dark line running parallel to the weld axis, appears to be a longitudinal crack",
      regions: [{ label: "longitudinal_crack", x: 100, y: 50, w: 200, h: 10 }]
    }
  });
  assert(19, "crack detected", r19.body.vision && r19.body.vision.discontinuities_detected >= 1);
  assert(20, "disposition is REJECT", r19.body.disposition && r19.body.disposition.result === "REJECT");
  assert(21, "educational feedback says REJECT", r19.body.educational_feedback && r19.body.educational_feedback.summary.indexOf("REJECTED") !== -1);
  assert(22, "teaching note present", r19.body.educational_feedback && r19.body.educational_feedback.discontinuities_found.length > 0);

  // Case 23: Basic tier cannot use PAUT
  var r23 = await post({
    action: "analyze_image",
    tier: "basic",
    modality: "PAUT",
    observations: { features: ["lack_of_fusion"] }
  });
  assert(23, "PAUT blocked in basic tier", r23.status === 400 || (r23.body && r23.body.error === "MODALITY_NOT_AVAILABLE_IN_TIER"));

  // Case 24: No discontinuities found
  var r24 = await post({
    action: "analyze_image",
    tier: "basic",
    modality: "VT",
    governing_code: "aws_d1_1",
    observations: {
      features: ["clean", "smooth", "uniform"],
      raw_description: "Clean, smooth weld bead with uniform appearance and good tie-in at toes"
    }
  });
  assert(24, "clean weld analysis succeeds", r24.status === 200 && r24.body.disposition);
  assert(25, "educational feedback for clean weld", r24.body.educational_feedback && r24.body.educational_feedback.summary.length > 0);

  // ============================================================
  // SECTION 3: Pro Tier — CWI / Level II-III Analysis
  // ============================================================
  console.log("\n--- Section 3: Pro Tier — Professional NDE ---");

  // Case 26: RT film analysis — slag inclusion
  var r26 = await post({
    action: "analyze_image",
    tier: "pro",
    modality: "RT",
    governing_code: "asme_bpvc_ix",
    observations: {
      features: ["slag", "inclusion", "irregular", "dark", "spots", "elongated", "interpass"],
      raw_description: "Irregular dark spots with less defined edges, elongated shape at interpass boundary",
      regions: [{ label: "slag_inclusion", x: 150, y: 80, w: 30, h: 10 }]
    },
    context: {
      wall_thickness_mm: 12.7,
      material: "carbon_steel",
      service_condition: "static"
    }
  });
  assert(26, "pro RT analysis returns 200", r26.status === 200);
  assert(27, "detects slag inclusion", r26.body.vision && r26.body.vision.discontinuities_detected >= 1);
  assert(28, "has physics consequence", r26.body.physics_consequence !== null);
  assert(29, "has proof trace", r26.body.proof_trace !== null);
  assert(30, "no educational feedback (pro)", r26.body.educational_feedback === null);
  assert(31, "code authority references ASME", r26.body.code_authority && r26.body.code_authority.code.indexOf("ASME") !== -1);

  // Case 32: PAUT sector scan — lack of fusion
  var r32 = await post({
    action: "analyze_image",
    tier: "pro",
    modality: "PAUT",
    governing_code: "aws_d1_1",
    observations: {
      features: ["lack_of_fusion", "strong", "reflection", "sidewall", "smooth", "reflector"],
      raw_description: "Strong reflection from sidewall region, smooth reflector characteristic of lack of fusion"
    },
    context: {
      wall_thickness_mm: 25.4,
      material: "carbon_steel",
      service_condition: "cyclic"
    }
  });
  assert(32, "PAUT detects LOF", r32.body.vision && r32.body.vision.discontinuities_detected >= 1);
  assert(33, "LOF is REJECT under AWS D1.1", r32.body.disposition && r32.body.disposition.result === "REJECT");
  assert(34, "physics escalation for cyclic", r32.body.physics_consequence && r32.body.physics_consequence.escalation_factors.length > 0);
  assert(35, "proof trace has 3 stages", r32.body.proof_trace && r32.body.proof_trace.pipeline_stages.length === 3);

  // Case 36: TOFD interpretation
  var r36 = await post({
    action: "analyze_image",
    tier: "pro",
    modality: "TOFD",
    governing_code: "api_1104",
    observations: {
      features: ["crack", "root", "diffraction", "signal", "root_crack"],
      raw_description: "Diffraction signal at root depth indicating root crack"
    },
    context: {
      wall_thickness_mm: 9.5,
      material: "carbon_steel",
      service_condition: "sour"
    }
  });
  assert(36, "TOFD detects root crack", r36.body.vision && r36.body.vision.discontinuities_detected >= 1);
  assert(37, "sour service escalation", r36.body.physics_consequence && r36.body.physics_consequence.overall_risk === "CRITICAL" || r36.body.physics_consequence && r36.body.physics_consequence.overall_risk === "HIGH");

  // Case 38: MT surface crack
  var r38 = await post({
    action: "analyze_image",
    tier: "pro",
    modality: "MT",
    governing_code: "aws_d1_1",
    observations: {
      features: ["surface_crack", "toe", "linear", "indication", "toe_crack"],
      raw_description: "Linear indication at weld toe under UV light, surface breaking crack"
    }
  });
  assert(38, "MT detects toe crack", r38.body.vision && r38.body.vision.discontinuities_detected >= 1);

  // ============================================================
  // SECTION 4: Main Platform — Enterprise Features
  // ============================================================
  console.log("\n--- Section 4: Main Platform — Enterprise ---");

  // Case 39: Full pipeline with all features
  var r39 = await post({
    action: "analyze_image",
    tier: "main",
    modality: "PAUT",
    governing_code: "asme_bpvc_ix",
    observations: {
      features: ["crack", "fatigue", "toe_crack", "high", "amplitude", "reflection", "corner", "echo"],
      raw_description: "High amplitude corner echo from toe region with tip diffraction signal, consistent with fatigue crack at weld toe"
    },
    context: {
      wall_thickness_mm: 19.0,
      design_pressure_psi: 1500,
      material: "carbon_steel",
      service_condition: "cyclic",
      temperature_f: 650
    }
  });
  assert(39, "main platform returns full analysis", r39.status === 200 && r39.body.tier === "main");
  assert(40, "main has proof trace", r39.body.proof_trace !== null);
  assert(41, "physics consequence present", r39.body.physics_consequence !== null);

  // Case 42: Scan comparison (Main only)
  var r42 = await post({
    action: "compare_scans",
    tier: "main",
    modality: "PAUT",
    scan_a: {
      date: "2025-06-15",
      observations: {
        features: ["porosity", "small", "scattered"],
        raw_description: "Minor scattered porosity"
      }
    },
    scan_b: {
      date: "2026-01-15",
      observations: {
        features: ["porosity", "small", "scattered", "crack", "toe", "linear"],
        raw_description: "Scattered porosity plus new linear indication at toe"
      }
    }
  });
  assert(42, "scan comparison returns result", r42.status === 200 && r42.body.comparison);
  assert(43, "comparison detects new findings", r42.body.comparison && r42.body.comparison.new_findings.length > 0);
  assert(44, "trend calculated", r42.body.comparison && r42.body.comparison.trend);

  // Case 45: Scan comparison blocked for non-main tier
  var r45 = await post({ action: "compare_scans", tier: "pro" });
  assert(45, "compare_scans blocked for pro", r45.status === 403);

  // ============================================================
  // SECTION 5: Individual Actions
  // ============================================================
  console.log("\n--- Section 5: Individual Actions ---");

  // Case 46: classify_discontinuities standalone
  var r46 = await post({
    action: "classify_discontinuities",
    modality: "RT",
    observations: {
      features: ["porosity", "round", "dark", "spots", "cluster"],
      raw_description: "Cluster of round dark spots in localized area"
    }
  });
  assert(46, "classify returns results", r46.status === 200 && r46.body.results);

  // Case 47: get_acceptance_criteria
  var r47 = await post({ action: "get_acceptance_criteria", code: "aws_d1_1" });
  assert(47, "acceptance criteria returned", r47.status === 200 && r47.body.criteria);
  assert(48, "crack is not accepted", r47.body.criteria && r47.body.criteria.crack && r47.body.criteria.crack.accept === false);

  // Case 49: evaluate_indication with measurements
  var r49 = await post({
    action: "evaluate_indication",
    code: "aws_d1_1",
    discontinuity_type: "undercut",
    measured_depth_mm: 1.2
  });
  assert(49, "indication evaluation", r49.status === 200 && r49.body.result);
  assert(50, "undercut exceeds limit", r49.body.result && r49.body.result.measurement_verdict === "EXCEEDS_LIMIT");

  // Case 51: evaluate_indication — within limits
  var r51 = await post({
    action: "evaluate_indication",
    code: "aws_d1_1",
    discontinuity_type: "undercut",
    measured_depth_mm: 0.5
  });
  assert(51, "undercut within limits", r51.body.result && r51.body.result.measurement_verdict === "WITHIN_LIMITS");

  // Case 52: get_modality_guide
  var r52 = await post({ action: "get_modality_guide", modality: "PAUT" });
  assert(52, "modality guide returned", r52.status === 200 && r52.body.guide);
  assert(53, "PAUT has detectable list", r52.body.guide && r52.body.guide.detectable && r52.body.guide.detectable.length > 10);
  assert(54, "PAUT has not_detectable list", r52.body.guide && r52.body.guide.not_detectable && r52.body.guide.not_detectable.length > 0);

  // Case 55: get_modality_guide — no modality
  var r55 = await post({ action: "get_modality_guide" });
  assert(55, "returns available modalities", r55.status === 200 && r55.body.available_modalities);

  // Case 56: get_roi_detail
  var r56 = await post({ action: "get_roi_detail", discontinuity_type: "lack_of_fusion" });
  assert(56, "ROI detail returned", r56.status === 200 && r56.body.detail);
  assert(57, "LOF is critical severity", r56.body.detail && r56.body.detail.severity === "critical");
  assert(58, "detectable_by methods listed", r56.body.detectable_by && r56.body.detectable_by.length > 0);

  // Case 59: get_educational_feedback standalone
  var r59 = await post({
    action: "get_educational_feedback",
    modality: "VT",
    discontinuities: [
      { discontinuity_type: "undercut", severity: "minor_to_major", confidence: 0.75 },
      { discontinuity_type: "porosity", severity: "minor_to_major", confidence: 0.68 }
    ],
    code_results: [
      { discontinuity: "undercut", code: "AWS D1.1", accept: "conditional", clause: "Table 8.9" }
    ]
  });
  assert(59, "educational feedback returned", r59.status === 200 && r59.body.feedback);
  assert(60, "has study tips", r59.body.feedback && r59.body.feedback.study_tips.length > 0);

  // ============================================================
  // SECTION 6: Batch Analysis (Pro/Main)
  // ============================================================
  console.log("\n--- Section 6: Batch Analysis ---");

  // Case 61: Batch analyze — pro tier
  var r61 = await post({
    action: "batch_analyze",
    tier: "pro",
    images: [
      {
        image_id: "weld_001",
        modality: "RT",
        governing_code: "aws_d1_1",
        observations: {
          features: ["porosity", "scattered", "round", "dark", "spots"],
          raw_description: "Scattered porosity"
        },
        context: { wall_thickness_mm: 10.0 }
      },
      {
        image_id: "weld_002",
        modality: "RT",
        governing_code: "aws_d1_1",
        observations: {
          features: ["crack", "longitudinal", "dark", "line"],
          raw_description: "Longitudinal crack"
        },
        context: { wall_thickness_mm: 10.0 }
      }
    ]
  });
  assert(61, "batch analyze returns results", r61.status === 200 && r61.body.results);
  assert(62, "batch has 2 results", r61.body.results && r61.body.results.length === 2);
  assert(63, "batch totals calculated", r61.body.total_discontinuities >= 2);
  assert(64, "batch has rejections", r61.body.total_rejections >= 1);

  // Case 65: Batch blocked for basic tier
  var r65 = await post({ action: "batch_analyze", tier: "basic", images: [{}] });
  assert(65, "batch blocked for basic", r65.status === 403);

  // ============================================================
  // SECTION 7: Edge Cases & Error Handling
  // ============================================================
  console.log("\n--- Section 7: Edge Cases ---");

  // Case 66: Unknown action
  var r66 = await post({ action: "unknown_action" });
  assert(66, "unknown action returns 400", r66.status === 400);

  // Case 67: Invalid tier
  var r67 = await post({ action: "analyze_image", tier: "platinum" });
  assert(67, "invalid tier returns 400", r67.status === 400);

  // Case 68: Empty observations
  var r68 = await post({
    action: "analyze_image",
    tier: "basic",
    modality: "VT",
    observations: {}
  });
  assert(68, "empty observations handled gracefully", r68.status === 200);

  // Case 69: Unknown code
  var r69 = await post({ action: "get_acceptance_criteria", code: "fake_code_999" });
  assert(69, "unknown code handled", r69.status === 200 && r69.body.error === "Code not found");

  // Case 70: Unknown discontinuity in ROI
  var r70 = await post({ action: "get_roi_detail", discontinuity_type: "nonexistent_flaw" });
  assert(70, "unknown discontinuity handled", r70.status === 200 && r70.body.error);

  // Case 71: evaluate_indication — crack always rejected
  var r71 = await post({
    action: "evaluate_indication",
    code: "aws_d1_1",
    discontinuity_type: "longitudinal_crack",
    measured_length_mm: 0.1
  });
  assert(71, "crack rejected regardless of size", r71.body.result && r71.body.result.measurement_verdict === "REJECTED_REGARDLESS_OF_SIZE");

  // Case 72: Multi-discontinuity interaction
  var r72 = await post({
    action: "analyze_image",
    tier: "pro",
    modality: "RT",
    governing_code: "aws_d1_1",
    observations: {
      features: ["crack", "slag", "inclusion", "porosity", "linear", "dark", "irregular", "round"],
      raw_description: "Multiple indications: linear crack, irregular slag inclusion, and scattered porosity"
    },
    context: {
      wall_thickness_mm: 15.0,
      service_condition: "cyclic"
    }
  });
  assert(72, "multi-discontinuity detected", r72.body.vision && r72.body.vision.discontinuities_detected >= 2);
  assert(73, "interaction risk assessed", r72.body.physics_consequence && r72.body.physics_consequence.consequence_details.length >= 2);

  // Case 74: DNV code test
  var r74 = await post({ action: "get_acceptance_criteria", code: "dnv_os_c401" });
  assert(74, "DNV code criteria returned", r74.status === 200 && r74.body.criteria);

  // Case 75: API 1104 — LOF conditional acceptance
  var r75 = await post({
    action: "evaluate_indication",
    code: "api_1104",
    discontinuity_type: "lack_of_fusion"
  });
  assert(75, "API 1104 LOF is conditional", r75.body.result && r75.body.result.accept === "conditional");

  // ============================================================
  // SECTION 8: Physics Consequence Depth
  // ============================================================
  console.log("\n--- Section 8: Physics Consequence ---");

  // Case 76: Sour service + crack = CRITICAL
  var r76 = await post({
    action: "analyze_image",
    tier: "main",
    modality: "PAUT",
    governing_code: "asme_bpvc_ix",
    observations: {
      features: ["crack", "stress_corrosion_cracking", "branching", "pattern"],
      raw_description: "Branching crack pattern consistent with stress corrosion cracking"
    },
    context: {
      service_condition: "sour",
      material: "carbon_steel"
    }
  });
  assert(76, "SCC in sour service is HIGH or CRITICAL", r76.body.physics_consequence && (r76.body.physics_consequence.overall_risk === "CRITICAL" || r76.body.physics_consequence.overall_risk === "HIGH"));

  // Case 77: Burn-through is high physics impact
  var r77 = await post({
    action: "analyze_image",
    tier: "pro",
    modality: "VT",
    governing_code: "aws_d1_1",
    observations: {
      features: ["burn_through", "hole", "root", "excessive", "penetration"],
      raw_description: "Hole on root side with excessive penetration and metal loss — burn through"
    },
    context: { wall_thickness_mm: 6.0 }
  });
  assert(77, "burn-through detected", r77.body.vision && r77.body.vision.discontinuities_detected >= 1);

  // Case 78: Cryogenic + crack
  var r78 = await post({
    action: "analyze_image",
    tier: "main",
    modality: "PAUT",
    governing_code: "asme_bpvc_ix",
    observations: {
      features: ["crack", "fatigue_crack", "toe", "corner", "echo"],
      raw_description: "Fatigue crack at toe"
    },
    context: {
      service_condition: "cryogenic",
      temperature_f: -100,
      material: "stainless_steel"
    }
  });
  assert(78, "cryogenic crack escalation", r78.body.physics_consequence && r78.body.physics_consequence.escalation_factors.length > 0);

  // ============================================================
  // SECTION 9: New Welding Codes — Full Coverage
  // ============================================================
  console.log("\n--- Section 9: New Welding Code Coverage ---");

  // Case 79: API 650 — storage tank crack rejection
  var r79 = await post({ action: "get_acceptance_criteria", code: "api_650" });
  assert(79, "API 650 criteria returned", r79.status === 200 && r79.body.criteria);
  assert(80, "API 650 crack reject", r79.body.criteria && r79.body.criteria.crack && r79.body.criteria.crack.accept === false);
  assert(81, "API 650 has misalignment", r79.body.criteria && r79.body.criteria.misalignment);

  // Case 82: AWS D1.2 aluminum
  var r82 = await post({ action: "get_acceptance_criteria", code: "aws_d1_2" });
  assert(82, "AWS D1.2 aluminum criteria", r82.status === 200 && r82.body.criteria);
  assert(83, "AWS D1.2 crack reject", r82.body.criteria && r82.body.criteria.crack && r82.body.criteria.crack.accept === false);
  assert(84, "AWS D1.2 has porosity", r82.body.criteria && r82.body.criteria.porosity);

  // Case 85: AWS D1.4 reinforcing steel
  var r85 = await post({ action: "get_acceptance_criteria", code: "aws_d1_4" });
  assert(85, "AWS D1.4 rebar criteria", r85.status === 200 && r85.body.criteria);
  assert(86, "AWS D1.4 LOF reject", r85.body.criteria && r85.body.criteria.lack_of_fusion && r85.body.criteria.lack_of_fusion.accept === false);

  // Case 87: AWS D1.5 bridge — tighter undercut
  var r87 = await post({ action: "get_acceptance_criteria", code: "aws_d1_5" });
  assert(87, "AWS D1.5 bridge criteria", r87.status === 200 && r87.body.criteria);
  assert(88, "AWS D1.5 undercut max 0.25mm FCM", r87.body.criteria && r87.body.criteria.undercut && r87.body.criteria.undercut.max_depth_mm === 0.25);

  // Case 89: AWS D1.6 stainless
  var r89 = await post({ action: "get_acceptance_criteria", code: "aws_d1_6" });
  assert(89, "AWS D1.6 stainless criteria", r89.status === 200 && r89.body.criteria);

  // Case 90: AWS D1.8 seismic
  var r90 = await post({ action: "get_acceptance_criteria", code: "aws_d1_8" });
  assert(90, "AWS D1.8 seismic criteria", r90.status === 200 && r90.body.criteria);
  assert(91, "AWS D1.8 undercut max 0.25mm demand-critical", r90.body.criteria && r90.body.criteria.undercut && r90.body.criteria.undercut.max_depth_mm === 0.25);

  // Case 92: AWS D17.1 aerospace
  var r92 = await post({ action: "get_acceptance_criteria", code: "aws_d17_1" });
  assert(92, "AWS D17.1 aerospace criteria", r92.status === 200 && r92.body.criteria);
  assert(93, "AWS D17.1 tightest undercut limit", r92.body.criteria && r92.body.criteria.undercut && r92.body.criteria.undercut.max_depth_mm === 0.13);
  assert(94, "AWS D17.1 has misalignment", r92.body.criteria && r92.body.criteria.misalignment);

  // Case 95: ASME Section III nuclear
  var r95 = await post({ action: "get_acceptance_criteria", code: "asme_section_iii" });
  assert(95, "ASME III nuclear criteria", r95.status === 200 && r95.body.criteria);
  assert(96, "ASME III crack reject", r95.body.criteria && r95.body.criteria.crack && r95.body.criteria.crack.accept === false);
  assert(97, "ASME III undercut tighter than VIII", r95.body.criteria && r95.body.criteria.undercut && r95.body.criteria.undercut.max_depth_mm === 0.4);

  // Case 98: AREMA railroad
  var r98 = await post({ action: "get_acceptance_criteria", code: "arema" });
  assert(98, "AREMA railroad criteria", r98.status === 200 && r98.body.criteria);
  assert(99, "AREMA has misalignment", r98.body.criteria && r98.body.criteria.misalignment);

  // Case 100: ISO 5817 quality levels
  var r100 = await post({ action: "get_acceptance_criteria", code: "iso_5817" });
  assert(100, "ISO 5817 criteria", r100.status === 200 && r100.body.criteria);

  // Case 101: ASME B31.1 power piping
  var r101 = await post({ action: "get_acceptance_criteria", code: "asme_b31_1" });
  assert(101, "ASME B31.1 criteria", r101.status === 200 && r101.body.criteria);

  // Case 102: ASME B31.3 process piping
  var r102 = await post({ action: "get_acceptance_criteria", code: "asme_b31_3" });
  assert(102, "ASME B31.3 criteria", r102.status === 200 && r102.body.criteria);

  // Case 103: ASME B31.4 liquid pipeline
  var r103 = await post({ action: "get_acceptance_criteria", code: "asme_b31_4" });
  assert(103, "ASME B31.4 criteria", r103.status === 200 && r103.body.criteria);

  // Case 104: ASME B31.8 gas pipeline
  var r104 = await post({ action: "get_acceptance_criteria", code: "asme_b31_8" });
  assert(104, "ASME B31.8 criteria", r104.status === 200 && r104.body.criteria);

  // ============================================================
  // SECTION 10: Coatings Standards
  // ============================================================
  console.log("\n--- Section 10: Coatings Standards ---");

  // Case 105: SSPC-PA 2
  var r105 = await post({ action: "get_acceptance_criteria", code: "sspc_pa_2" });
  assert(105, "SSPC-PA 2 criteria", r105.status === 200 && r105.body.criteria);
  assert(106, "SSPC has DFT variance", r105.body.criteria && r105.body.criteria.coating_dft_variance);

  // Case 107: NACE SP0188
  var r107 = await post({ action: "get_acceptance_criteria", code: "nace_sp0188" });
  assert(107, "NACE SP0188 criteria", r107.status === 200 && r107.body.criteria);
  assert(108, "NACE holiday reject", r107.body.criteria && r107.body.criteria.coating_holiday && r107.body.criteria.coating_holiday.accept === false);

  // Case 109: ISO 12944
  var r109 = await post({ action: "get_acceptance_criteria", code: "iso_12944" });
  assert(109, "ISO 12944 criteria", r109.status === 200 && r109.body.criteria);
  assert(110, "ISO 12944 has blistering", r109.body.criteria && r109.body.criteria.coating_blistering);
  assert(111, "ISO 12944 peeling reject", r109.body.criteria && r109.body.criteria.coating_peeling && r109.body.criteria.coating_peeling.accept === false);

  // Case 112: ISO 8501
  var r112 = await post({ action: "get_acceptance_criteria", code: "iso_8501" });
  assert(112, "ISO 8501 criteria", r112.status === 200 && r112.body.criteria);

  // ============================================================
  // SECTION 11: In-Service Inspection Codes
  // ============================================================
  console.log("\n--- Section 11: In-Service Inspection ---");

  // Case 113: API 510
  var r113 = await post({ action: "get_acceptance_criteria", code: "api_510" });
  assert(113, "API 510 criteria", r113.status === 200 && r113.body.criteria);
  assert(114, "API 510 has general corrosion", r113.body.criteria && r113.body.criteria.general_corrosion);
  assert(115, "API 510 HTHA reject", r113.body.criteria && r113.body.criteria.htha && r113.body.criteria.htha.accept === false);

  // Case 116: API 570
  var r116 = await post({ action: "get_acceptance_criteria", code: "api_570" });
  assert(116, "API 570 criteria", r116.status === 200 && r116.body.criteria);

  // Case 117: API 653
  var r117 = await post({ action: "get_acceptance_criteria", code: "api_653" });
  assert(117, "API 653 criteria", r117.status === 200 && r117.body.criteria);
  assert(118, "API 653 has settlement", r117.body.criteria && r117.body.criteria.settlement);

  // ============================================================
  // SECTION 12: Architectural / Engineering Codes
  // ============================================================
  console.log("\n--- Section 12: Architectural / Engineering ---");

  // Case 119: AISC 360
  var r119 = await post({ action: "get_acceptance_criteria", code: "aisc_360" });
  assert(119, "AISC 360 criteria", r119.status === 200 && r119.body.criteria);

  // Case 120: IBC
  var r120 = await post({ action: "get_acceptance_criteria", code: "ibc_welding" });
  assert(120, "IBC welding criteria", r120.status === 200 && r120.body.criteria);

  // ============================================================
  // SECTION 13: New NDE Modalities
  // ============================================================
  console.log("\n--- Section 13: New NDE Modalities ---");

  // Case 121: PEC modality guide
  var r121 = await post({ action: "get_modality_guide", modality: "PEC" });
  assert(121, "PEC guide returned", r121.status === 200 && r121.body.guide);
  assert(122, "PEC detects wall thinning", r121.body.guide && r121.body.guide.detectable.indexOf("wall_thinning") !== -1);

  // Case 123: GWT modality guide
  var r123 = await post({ action: "get_modality_guide", modality: "GWT" });
  assert(123, "GWT guide returned", r123.status === 200 && r123.body.guide);

  // Case 124: IRIS modality guide
  var r124 = await post({ action: "get_modality_guide", modality: "IRIS" });
  assert(124, "IRIS guide returned", r124.status === 200 && r124.body.guide);
  assert(125, "IRIS 360-degree profiling", r124.body.guide && r124.body.guide.sizing_capability === "wall_thickness_360_degree_profile");

  // Case 126: ADVANCED_UT modality guide
  var r126 = await post({ action: "get_modality_guide", modality: "ADVANCED_UT" });
  assert(126, "ADVANCED_UT guide returned", r126.status === 200 && r126.body.guide);
  assert(127, "ADVANCED_UT highest confidence", r126.body.guide && r126.body.guide.confidence_base >= 0.95);

  // ============================================================
  // SECTION 14: New Discontinuity Types
  // ============================================================
  console.log("\n--- Section 14: New Discontinuity Types ---");

  // Case 128: Hydrogen cracking ROI
  var r128 = await post({ action: "get_roi_detail", discontinuity_type: "hydrogen_crack" });
  assert(128, "hydrogen crack detail", r128.status === 200 && r128.body.detail);
  assert(129, "hydrogen crack is critical", r128.body.detail && r128.body.detail.severity === "critical");

  // Case 130: Lamellar tearing ROI
  var r130 = await post({ action: "get_roi_detail", discontinuity_type: "lamellar_tear" });
  assert(130, "lamellar tear detail", r130.status === 200 && r130.body.detail);

  // Case 131: HTHA ROI
  var r131 = await post({ action: "get_roi_detail", discontinuity_type: "htha" });
  assert(131, "HTHA detail", r131.status === 200 && r131.body.detail);
  assert(132, "HTHA is critical", r131.body.detail && r131.body.detail.severity === "critical");

  // Case 133: Creep damage ROI
  var r133 = await post({ action: "get_roi_detail", discontinuity_type: "creep_damage" });
  assert(133, "creep damage detail", r133.status === 200 && r133.body.detail);

  // Case 134: Coating blistering ROI
  var r134 = await post({ action: "get_roi_detail", discontinuity_type: "coating_blistering" });
  assert(134, "coating blistering detail", r134.status === 200 && r134.body.detail);
  assert(135, "coating blistering group is coating", r134.body.detail && r134.body.detail.group === "coating");

  // Case 136: Coating holiday ROI
  var r136 = await post({ action: "get_roi_detail", discontinuity_type: "coating_holiday" });
  assert(136, "coating holiday detail", r136.status === 200 && r136.body.detail);

  // ============================================================
  // SECTION 15: Cross-Domain Pipeline Tests
  // ============================================================
  console.log("\n--- Section 15: Cross-Domain Pipeline Tests ---");

  // Case 137: Aerospace weld with D17.1
  var r137 = await post({
    action: "analyze_image",
    tier: "pro",
    modality: "RT",
    governing_code: "aws_d17_1",
    observations: {
      features: ["porosity", "small", "round", "dark"],
      raw_description: "Small round dark spots in titanium weld — porosity"
    },
    context: { material: "titanium", service_condition: "fatigue" }
  });
  assert(137, "aerospace RT analysis works", r137.status === 200 && r137.body.vision);
  assert(138, "D17.1 code routed", r137.body.code_authority && r137.body.code_authority.code.indexOf("D17.1") !== -1);

  // Case 139: Nuclear vessel with ASME III
  var r139 = await post({
    action: "analyze_image",
    tier: "main",
    modality: "PAUT",
    governing_code: "asme_section_iii",
    observations: {
      features: ["slag", "inclusion", "irregular", "interpass"],
      raw_description: "Irregular indication at interpass boundary in reactor vessel weld"
    },
    context: { material: "stainless_steel", service_condition: "nuclear" }
  });
  assert(139, "nuclear analysis works", r139.status === 200);
  assert(140, "ASME III routed", r139.body.code_authority && r139.body.code_authority.code.indexOf("ASME") !== -1);

  // Case 141: Storage tank with API 650
  var r141 = await post({
    action: "analyze_image",
    tier: "pro",
    modality: "RT",
    governing_code: "api_650",
    observations: {
      features: ["crack", "longitudinal", "shell", "weld"],
      raw_description: "Longitudinal crack in tank shell course weld"
    },
    context: { wall_thickness_mm: 12.0 }
  });
  assert(141, "tank crack rejected by API 650", r141.body.disposition && r141.body.disposition.result === "REJECT");

  // Case 142: Railroad rail weld with AREMA
  var r142 = await post({
    action: "analyze_image",
    tier: "pro",
    modality: "VT",
    governing_code: "arema",
    observations: {
      features: ["porosity", "surface", "small", "pores"],
      raw_description: "Small surface porosity in thermite rail weld"
    }
  });
  assert(142, "AREMA analysis works", r142.status === 200);

  // Case 143: Bridge weld with D1.5
  var r143 = await post({
    action: "evaluate_indication",
    code: "aws_d1_5",
    discontinuity_type: "undercut",
    measured_depth_mm: 0.3
  });
  assert(143, "bridge undercut 0.3mm exceeds 0.25mm FCM limit", r143.body.result && r143.body.result.measurement_verdict === "EXCEEDS_LIMIT");

  // Case 144: Coating analysis — holiday in immersion
  var r144 = await post({
    action: "analyze_image",
    tier: "pro",
    modality: "VT",
    governing_code: "nace_sp0188",
    observations: {
      features: ["holiday", "pinhole", "coating", "bare", "spot"],
      raw_description: "Pinhole holiday detected by spark tester on tank internal coating"
    },
    context: { service_condition: "immersion" }
  });
  assert(144, "coating holiday analysis", r144.status === 200);

  // Case 145: HTHA physics consequence — always critical
  var r145 = await post({
    action: "analyze_image",
    tier: "main",
    modality: "ADVANCED_UT",
    governing_code: "api_510",
    observations: {
      features: ["htha", "backscatter", "increased", "attenuation", "backwall"],
      raw_description: "Increased backscatter and backwall attenuation consistent with HTHA"
    },
    context: { material: "carbon_steel", temperature_f: 850, service_condition: "hydrogen" }
  });
  assert(145, "HTHA detected", r145.body.vision && r145.body.vision.discontinuities_detected >= 1);
  assert(146, "HTHA is CRITICAL physics", r145.body.physics_consequence && r145.body.physics_consequence.overall_risk === "CRITICAL");

  // Case 147: Updated registry has expanded counts
  var r147 = await post({ action: "get_registry" });
  assert(147, "expanded code count", r147.body.supported_codes && r147.body.supported_codes.length >= 20);
  assert(148, "expanded modality count", r147.body.supported_modalities && r147.body.supported_modalities.length >= 12);
  assert(149, "expanded discontinuity count", r147.body.discontinuity_count >= 40);

  // ============================================================
  // FINAL SUMMARY
  // ============================================================
  console.log("\n=============================================");
  console.log("RESULTS: " + passed + "/" + (passed + failed) + " PASSED");
  if (failed > 0) {
    console.log("FAILURES:");
    for (var ei = 0; ei < errors.length; ei++) {
      console.log("  " + errors[ei]);
    }
  } else {
    console.log("ALL TESTS PASSED");
  }
  console.log("=============================================\n");
}

runTests().catch(function (e) {
  console.error("Test suite error:", e);
  process.exit(1);
});
