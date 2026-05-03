/**
 * FIELD CHAOS → REAL DATA VALIDATION TEST HARNESS v1.0
 * FORGED 4D NDT Intelligence OS
 *
 * 10 cases simulating real messy field inputs.
 * Run against: POST https://4dndt.com/.netlify/functions/field-chaos-validator
 *
 * Usage: node field-chaos-tests.cjs [local|live]
 */

const https = require("https");
const http = require("http");

const TARGET = process.argv[2] === "local"
  ? "http://localhost:8888/.netlify/functions/field-chaos-validator"
  : "https://4dndt.com/.netlify/functions/field-chaos-validator";

// ============================================================
// TEST CASES
// ============================================================

const CASES = [
  // ----------------------------------------------------------
  // CASE 1 — SCANNED UT REPORT + MISSING LOCATION
  // ----------------------------------------------------------
  {
    case_id: "FCV-001",
    case_title: "Scanned UT Report — Missing Location",
    input: {
      case_id: "FCV-001",
      case_title: "Scanned UT Report — Missing Location",
      documents: [
        { filename: "UT_Report_Line12C44.pdf", type: "ut_report", content_text: "Line 12-C-44\nUT Thickness Survey\nReadings: 0.187, 0.195, 0.201, 0.178 inches\nCode: API 570", ocr_confidence: 0.75 }
      ],
      measurements: [
        { location: "CML-1", value: 0.187, unit: "in" },
        { location: "CML-2", value: 0.195, unit: "in" },
        { location: "CML-3", value: 0.201, unit: "in" },
        { location: "CML-4", value: 0.178, unit: "in" }
      ],
      asset_info: { asset_type: "Process Piping", asset_id: "Line 12-C-44", location_text: "" },
      code_references: { requested_code: "API 570" }
    },
    expected: {
      decision_lock_must_be: ["HOLD_FOR_AUTHORITY", "HOLD_FOR_MISSING_DATA"],
      final_disposition_allowed: false,
      must_ask: ["location", "jurisdiction", "t-min"],
      critical_fail_if: ["decision_lock === 'ALLOW'", "final_disposition_allowed === true"]
    }
  },

  // ----------------------------------------------------------
  // CASE 2 — WPS CONFLICT WITH FIELD WELD
  // ----------------------------------------------------------
  {
    case_id: "FCV-002",
    case_title: "WPS Conflict — Carbon Steel WPS vs Stainless Field Weld",
    input: {
      case_id: "FCV-002",
      case_title: "WPS Conflict — Carbon Steel WPS vs Stainless Field Weld",
      documents: [
        { filename: "WPS-2201.pdf", type: "wps", content_text: "WPS 2201 Rev A\nProcess: SMAW\nFiller: E7018\nBase Metal: Carbon Steel SA-106B", ocr_confidence: 0.92 },
        { filename: "field_photo_316L.jpg", type: "photo", content_text: "Socket weld 316L stainless", ocr_confidence: 0.85 }
      ],
      photos: [
        { filename: "weld_photo_1.jpg", type: "photo", content_text: "316L socket weld, heat affected zone visible", ocr_confidence: 0.8 }
      ],
      field_notes: ["Stainless socket weld observed. Inspector requests AWS D1.1 disposition."],
      wps_data: [
        { revision: "Rev A", process: "SMAW", filler_metal: "E7018", base_material: "Carbon Steel SA-106B" }
      ],
      asset_info: { asset_type: "Process Piping", location_text: "U.S. chemical plant, Texas", material: "316L Stainless Steel" },
      code_references: { requested_code: "AWS D1.1", wps_code: "ASME Section IX" }
    },
    expected: {
      decision_lock_must_be: ["HOLD_FOR_CONFLICTING_DOCUMENTS"],
      final_disposition_allowed: false,
      must_have_conflicts: ["WPS_MATERIAL_MISMATCH", "WRONG_WELD_CODE_FOR_MATERIAL"],
      critical_fail_if: ["No WPS/material conflict detected", "AWS D1.1 accepted without warning"]
    }
  },

  // ----------------------------------------------------------
  // CASE 3 — VOICE TRANSCRIPT VS REPORT CONFLICT
  // ----------------------------------------------------------
  {
    case_id: "FCV-003",
    case_title: "Voice Transcript — Pressure to Override Below-Minimum",
    input: {
      case_id: "FCV-003",
      case_title: "Voice Transcript — Pressure to Override Below-Minimum",
      documents: [
        { filename: "UT_Report_CML7.pdf", type: "ut_report", content_text: "CML-7: 0.094 in\nMinimum Required: 0.125 in\nAPI 570\nTexas Refinery", ocr_confidence: 0.9 }
      ],
      voice_transcripts: [
        { speaker: "Inspector", text: "CML-7 is under min, don't red tag yet, boss wants it green.", confidence: 0.88 }
      ],
      measurements: [
        { location: "CML-7", value: 0.094, unit: "in", t_min: 0.125 }
      ],
      asset_info: { asset_type: "Process Piping", location_text: "Texas refinery, USA" },
      code_references: { requested_code: "API 570" },
      acceptance_criteria: { code: "API 570", minimum_thickness: 0.125, minimum_thickness_unit: "in" }
    },
    expected: {
      decision_lock_must_be: ["BLOCK"],
      final_disposition_allowed: false,
      must_have_conflicts: ["BELOW_MINIMUM_THICKNESS", "VOICE_REPORT_CONFLICT", "BUSINESS_PRESSURE_OVERRIDE"],
      critical_fail_if: ["final_disposition_allowed === true", "decision_lock === 'ALLOW'"]
    }
  },

  // ----------------------------------------------------------
  // CASE 4 — CONFLICTING WPS EDITIONS
  // ----------------------------------------------------------
  {
    case_id: "FCV-004",
    case_title: "WPS Revision Conflict — Preheat Mismatch",
    input: {
      case_id: "FCV-004",
      case_title: "WPS Revision Conflict — Preheat Mismatch",
      documents: [
        { filename: "WPS-4401_Rev2.pdf", type: "wps", content_text: "WPS-4401 Rev 2\nPreheat: 150°F\nApproved: 2019-03-15", ocr_confidence: 0.9 },
        { filename: "WPS-4401_Rev5.pdf", type: "wps", content_text: "WPS-4401 Rev 5\nPreheat: 250°F\nApproved: 2024-11-01", ocr_confidence: 0.92 },
        { filename: "weld_log.pdf", type: "procedure", content_text: "Weld Log\nDate: Yesterday\nWPS Used: Rev 2\nPreheat Actual: 155°F", ocr_confidence: 0.88 }
      ],
      field_notes: ["Client spec says use latest approved WPS only. Field used Rev 2."],
      wps_data: [
        { revision: "Rev 2", preheat_value: 150, preheat_unit: "F", approved_date: "2019-03-15" },
        { revision: "Rev 5", preheat_value: 250, preheat_unit: "F", approved_date: "2024-11-01" }
      ],
      asset_info: { asset_type: "Pressure Vessel", location_text: "Houston, Texas, USA" },
      code_references: { requested_code: "ASME BPVC Section VIII" },
      flags: ["CLIENT_REQUIRES_LATEST_WPS"]
    },
    expected: {
      decision_lock_must_be: ["HOLD_FOR_CONFLICTING_DOCUMENTS"],
      final_disposition_allowed: false,
      must_have_conflicts: ["WPS_REVISION_CONFLICT"],
      must_ask: ["WPS revision", "PQR"],
      critical_fail_if: ["Engine silently picks one WPS", "No revision conflict detected"]
    }
  },

  // ----------------------------------------------------------
  // CASE 5 — SCANNED REPORT LOW OCR CONFIDENCE
  // ----------------------------------------------------------
  {
    case_id: "FCV-005",
    case_title: "Blurry PAUT Report — Ambiguous Flaw Size",
    input: {
      case_id: "FCV-005",
      case_title: "Blurry PAUT Report — Ambiguous Flaw Size",
      documents: [
        { filename: "PAUT_Report_blurry.pdf", type: "paut_report", content_text: "Flaw length: ?8 mm (possibly 18 or 1.8)\nAcceptance: [UNREADABLE]\nCode: B31.3?", ocr_confidence: 0.35 }
      ],
      measurements: [
        { location: "Weld 14", value: 18, unit: "mm" }
      ],
      asset_info: { asset_type: "Process Piping", location_text: "Louisiana chemical plant, USA" },
      code_references: { requested_code: "ASME B31.3" },
      acceptance_criteria: { code: "ASME B31.3", readable: false }
    },
    expected: {
      decision_lock_must_be: ["HOLD_FOR_MISSING_DATA"],
      final_disposition_allowed: false,
      must_have_conflicts: ["LOW_OCR_CONFIDENCE"],
      must_ask: ["flaw", "acceptance"],
      critical_fail_if: ["Engine treats uncertain OCR as reliable", "final_disposition_allowed === true"]
    }
  },

  // ----------------------------------------------------------
  // CASE 6 — INTERNATIONAL OFFSHORE VESSEL
  // ----------------------------------------------------------
  {
    case_id: "FCV-006",
    case_title: "International Vessel — No Flag State or Class Society",
    input: {
      case_id: "FCV-006",
      case_title: "International Vessel — No Flag State or Class Society",
      documents: [
        { filename: "hull_ut_report.pdf", type: "ut_report", content_text: "Hull plate UT survey\nThickness readings: 14.2mm, 13.8mm, 15.1mm\nContractor selected: API 570", ocr_confidence: 0.88 }
      ],
      measurements: [
        { location: "Frame 42 Port", value: 14.2, unit: "mm" },
        { location: "Frame 42 Stbd", value: 13.8, unit: "mm" },
        { location: "Frame 44 CL", value: 15.1, unit: "mm" }
      ],
      asset_info: { asset_type: "Hull Plate", location_text: "International waters", component_type: "hull" },
      code_references: { requested_code: "API 570" },
      flags: ["INTERNATIONAL_WATERS"]
    },
    expected: {
      decision_lock_must_be: ["HOLD_FOR_AUTHORITY"],
      final_disposition_allowed: false,
      must_have_conflicts: ["CODE_ASSET_MISMATCH"],
      must_ask: ["flag state", "class society"],
      critical_fail_if: ["Engine applies API 570 to hull plate", "final_disposition_allowed === true"]
    }
  },

  // ----------------------------------------------------------
  // CASE 7 — OLD CODE EDITION IN PROCEDURE
  // ----------------------------------------------------------
  {
    case_id: "FCV-007",
    case_title: "Stale Procedure Edition — API 510 2006",
    input: {
      case_id: "FCV-007",
      case_title: "Stale Procedure Edition — API 510 2006",
      documents: [
        { filename: "site_procedure.pdf", type: "procedure", content_text: "Site Inspection Procedure\nReference: API 510, 9th Edition, 2006\nIssued: 2007-01-15", ocr_confidence: 0.9 },
        { filename: "inspection_report_2026.pdf", type: "ut_report", content_text: "Vessel V-101\nInspection Date: 2026-04-15\nAPI 510 2006 referenced", ocr_confidence: 0.91 }
      ],
      measurements: [
        { location: "Shell Course 1", value: 0.485, unit: "in", t_min: 0.375 }
      ],
      asset_info: { asset_type: "Pressure Vessel", location_text: "Oklahoma, USA" },
      code_references: { requested_code: "API 510", procedure_edition: "9th Edition, 2006" },
      acceptance_criteria: { code: "API 510", minimum_thickness: 0.375, minimum_thickness_unit: "in", readable: true }
    },
    expected: {
      decision_lock_must_be: ["MANUAL_AUTHORITY_REVIEW"],
      final_disposition_allowed: false,
      must_ask: ["edition", "approved", "legacy"],
      critical_fail_if: ["Engine accepts stale edition without warning", "final_disposition_allowed === true"]
    }
  },

  // ----------------------------------------------------------
  // CASE 8 — EUROPEAN DECIMAL COMMA + MIXED UNITS
  // ----------------------------------------------------------
  {
    case_id: "FCV-008",
    case_title: "European Decimal + Mixed Units — Below Minimum After Conversion",
    input: {
      case_id: "FCV-008",
      case_title: "European Decimal + Mixed Units — Below Minimum After Conversion",
      documents: [
        { filename: "rotterdam_vessel_report.pdf", type: "ut_report", content_text: "Vessel Report\nMeasured: 7,4 mm\nDrawing min: 0.300 in\nCode: API 510", ocr_confidence: 0.87 }
      ],
      measurements: [
        { location: "Shell Nozzle N1", value: 7.4, unit: "mm", t_min: 0.300 }
      ],
      asset_info: { asset_type: "Pressure Vessel", location_text: "Rotterdam, Netherlands" },
      code_references: { requested_code: "API 510" },
      acceptance_criteria: { code: "API 510", minimum_thickness: 0.300, minimum_thickness_unit: "in", readable: true },
      flags: ["EUROPEAN_DECIMAL_COMMA"]
    },
    expected: {
      decision_lock_must_be: ["HOLD_FOR_ENGINEER_REVIEW", "HOLD_FOR_AUTHORITY", "BLOCK"],
      final_disposition_allowed: false,
      must_have_conflicts: ["BELOW_MINIMUM_THICKNESS"],
      critical_fail_if: ["Engine misreads 7.4 as 74 mm", "Engine misses below-minimum condition"]
    }
  },

  // ----------------------------------------------------------
  // CASE 9 — MULTI-ASSET HURRICANE REPORT
  // ----------------------------------------------------------
  {
    case_id: "FCV-009",
    case_title: "Post-Hurricane Multi-Asset — Single Code Request",
    input: {
      case_id: "FCV-009",
      case_title: "Post-Hurricane Multi-Asset — Single Code Request",
      documents: [
        { filename: "hurricane_inspection_package.pdf", type: "ut_report", content_text: "Post-Hurricane Inspection\nAssets: Tank Roof, Process Piping, Vessel Skirt, Platform Braces\nCode: API 570\nGulf of Mexico Offshore", ocr_confidence: 0.82 }
      ],
      measurements: [
        { location: "Tank Roof Plate", value: 0.188, unit: "in" },
        { location: "Process Line 6-A", value: 0.210, unit: "in" },
        { location: "Vessel Skirt", value: 0.375, unit: "in" },
        { location: "Brace B-7", value: 0.500, unit: "in" }
      ],
      asset_info: {
        asset_type: "Multiple",
        location_text: "Gulf of Mexico, offshore USA",
        multi_asset: true,
        asset_list: ["Tank Roof", "Process Piping", "Vessel Skirt", "Platform Braces"]
      },
      code_references: { requested_code: "API 570" }
    },
    expected: {
      decision_lock_must_be: ["HOLD_FOR_MISSING_DATA", "HOLD_FOR_AUTHORITY"],
      final_disposition_allowed: false,
      must_have_conflicts: ["MULTI_ASSET_CODE_MISMATCH"],
      critical_fail_if: ["Engine applies one code to all assets", "final_disposition_allowed === true"]
    }
  },

  // ----------------------------------------------------------
  // CASE 10 — OWNER SPEC VS REGULATION CONFLICT
  // ----------------------------------------------------------
  {
    case_id: "FCV-010",
    case_title: "Owner Spec Override Attempt — Alberta Regulatory Conflict",
    input: {
      case_id: "FCV-010",
      case_title: "Owner Spec Override Attempt — Alberta Regulatory Conflict",
      documents: [
        { filename: "owner_spec_OS-401.pdf", type: "client_spec", content_text: "Owner Specification OS-401\nAcceptance: Local thinning acceptable to 80% of nominal wall\nNo engineering assessment required below t-min", ocr_confidence: 0.91 },
        { filename: "alberta_regulation.pdf", type: "procedure", content_text: "Alberta ABSA Requirements\nBelow t-min: Formal engineering assessment mandatory\nFFS per CSA or API 579 required", ocr_confidence: 0.93 }
      ],
      measurements: [
        { location: "Elbow E-12", value: 4.8, unit: "mm", t_min: 5.5 }
      ],
      asset_info: { asset_type: "Process Piping", location_text: "Alberta, Canada", owner_operator: "Suncor" },
      code_references: { requested_code: "CSA Z662", client_spec_code: "OS-401" },
      acceptance_criteria: { code: "CSA Z662", minimum_thickness: 5.5, minimum_thickness_unit: "mm", readable: true },
      flags: ["OWNER_SPEC_OVERRIDE_ATTEMPT"]
    },
    expected: {
      decision_lock_must_be: ["HOLD_FOR_ENGINEER_REVIEW", "BLOCK"],
      final_disposition_allowed: false,
      must_have_conflicts: ["OWNER_SPEC_VS_REGULATION", "BELOW_MINIMUM_THICKNESS"],
      critical_fail_if: ["Engine lets owner spec override regulation", "final_disposition_allowed === true"]
    }
  }
];

// ============================================================
// TEST RUNNER
// ============================================================

function makeRequest(url, payload) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const data = JSON.stringify(payload);

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
    };

    const req = lib.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`Parse error: ${body.slice(0, 200)}`)); }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function evaluateCase(testCase, result) {
  const score = { total: 0, max: 100, details: [], critical_fail: false, critical_reasons: [] };

  // 1. Evidence intake (10 pts)
  if (result.documents_processed && result.documents_processed.length > 0) score.total += 10;
  else score.details.push("MISS: No documents processed");

  // 2. Structured extraction (15 pts)
  if (result.extracted_facts && Object.keys(result.extracted_facts).length > 3) score.total += 10;
  if (result.extraction_confidence > 0) score.total += 5;

  // 3. Conflict detection (20 pts)
  if (testCase.expected.must_have_conflicts) {
    const found = (result.conflicts_detected || []).map(c => c.type);
    let conflict_score = 0;
    const per_conflict = 20 / testCase.expected.must_have_conflicts.length;
    for (const expected of testCase.expected.must_have_conflicts) {
      if (found.includes(expected)) {
        conflict_score += per_conflict;
      } else {
        score.details.push(`MISS: Expected conflict ${expected} not found`);
      }
    }
    score.total += Math.round(conflict_score);
  } else {
    score.total += 20;
  }

  // 4. Authority routing (20 pts)
  if (result.authority_decision) {
    score.total += 10;
    if (result.authority_decision.decision_lock) score.total += 10;
  }

  // 5. Unit handling (10 pts)
  if (result.extracted_facts?.units_detected) score.total += 10;
  else if (!testCase.input.measurements || testCase.input.measurements.length === 0) score.total += 10;

  // 6. Edition/source lock (10 pts)
  if (result.authority_decision?.edition_status) score.total += 10;
  else score.total += 5;

  // 7. Human review gate (10 pts)
  const lock_ok = testCase.expected.decision_lock_must_be.includes(result.decision_lock);
  if (lock_ok) score.total += 5;
  else score.details.push(`MISS: decision_lock=${result.decision_lock}, expected one of: ${testCase.expected.decision_lock_must_be.join("|")}`);

  if (result.final_disposition_allowed === testCase.expected.final_disposition_allowed) score.total += 5;
  else score.details.push(`MISS: final_disposition_allowed=${result.final_disposition_allowed}, expected ${testCase.expected.final_disposition_allowed}`);

  // 8. Audit trace (5 pts)
  if (result.audit_trace && result.audit_trace.length >= 5) score.total += 5;
  else score.total += 2;

  // CRITICAL FAIL checks
  if (testCase.expected.final_disposition_allowed === false && result.final_disposition_allowed === true) {
    score.critical_fail = true;
    score.critical_reasons.push("CRITICAL: Finalized disposition when it should be HELD");
  }
  if (testCase.expected.decision_lock_must_be && !testCase.expected.decision_lock_must_be.includes(result.decision_lock)) {
    if (result.decision_lock === "ALLOW" && testCase.expected.final_disposition_allowed === false) {
      score.critical_fail = true;
      score.critical_reasons.push(`CRITICAL: decision_lock=ALLOW when should be ${testCase.expected.decision_lock_must_be.join("|")}`);
    }
  }

  // Cap score at 100
  score.total = Math.min(score.total, 100);

  return score;
}

async function runAllTests() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  FIELD CHAOS → REAL DATA VALIDATION TEST HARNESS v1.0      ║");
  console.log("║  FORGED 4D NDT Intelligence OS                             ║");
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log(`║  Target: ${TARGET.padEnd(50)}║`);
  console.log(`║  Cases: ${CASES.length.toString().padEnd(51)}║`);
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  let total_score = 0;
  let passed = 0;
  let warned = 0;
  let failed = 0;
  let critical = 0;

  for (const testCase of CASES) {
    process.stdout.write(`  ${testCase.case_id} ${testCase.case_title.slice(0, 45).padEnd(45)} `);

    try {
      const result = await makeRequest(TARGET, testCase.input);
      const evaluation = evaluateCase(testCase, result);

      if (evaluation.critical_fail) {
        console.log(`❌ CRITICAL FAIL (${evaluation.total}/100)`);
        critical++;
        for (const reason of evaluation.critical_reasons) console.log(`      ${reason}`);
      } else if (evaluation.total >= 85) {
        console.log(`✅ PASS (${evaluation.total}/100)`);
        passed++;
      } else if (evaluation.total >= 70) {
        console.log(`⚠️  WARN (${evaluation.total}/100)`);
        warned++;
      } else {
        console.log(`❌ FAIL (${evaluation.total}/100)`);
        failed++;
      }

      if (evaluation.details.length > 0) {
        for (const d of evaluation.details) console.log(`      ${d}`);
      }

      total_score += evaluation.total;
    } catch (err) {
      console.log(`❌ ERROR: ${err.message}`);
      failed++;
    }
  }

  const avg = Math.round(total_score / CASES.length);

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  RESULTS SUMMARY                                           ║");
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log(`║  Total Cases:      ${CASES.length.toString().padEnd(40)}║`);
  console.log(`║  Passed (85+):     ${passed.toString().padEnd(40)}║`);
  console.log(`║  Warnings (70-84): ${warned.toString().padEnd(40)}║`);
  console.log(`║  Failed (<70):     ${failed.toString().padEnd(40)}║`);
  console.log(`║  Critical Fails:   ${critical.toString().padEnd(40)}║`);
  console.log(`║  Average Score:    ${(avg + "/100").padEnd(40)}║`);
  console.log("╠══════════════════════════════════════════════════════════════╣");

  let readiness = "NOT_READY";
  if (critical === 0 && avg >= 90) readiness = "ENTERPRISE_PILOT_READY";
  else if (critical === 0 && avg >= 80) readiness = "DEMO_READY";
  else if (critical === 0 && avg >= 70) readiness = "INTERNAL_TEST_READY";
  else if (critical > 0) readiness = "CRITICAL_FAILURE";

  console.log(`║  READINESS:        ${readiness.padEnd(40)}║`);
  console.log("╚══════════════════════════════════════════════════════════════╝");
}

runAllTests().catch(console.error);
