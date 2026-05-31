// ============================================================================
// situational-awareness-gate.test.cjs
// Stage 1 unit tests for the SA gate. Run with `node tests/situational-awareness-gate.test.cjs`.
// Pure JS. No test framework dependency. Deterministic. No network. No clock.
// All time-sensitive checks pass a fixed referenceMs explicitly.
// ============================================================================
'use strict';

var gate = require("../netlify/functions/situational-awareness-gate.cjs");

var passed = 0;
var failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log("  PASS  " + msg);
  } else {
    failed++;
    console.log("  FAIL  " + msg);
  }
}

console.log("");
console.log("=== Non-Evidence Token Registry ===");
assert(gate.isNonEvidenceToken("Unknown") === true, "Unknown is non-evidence");
assert(gate.isNonEvidenceToken("unknown") === true, "lowercase unknown is non-evidence");
assert(gate.isNonEvidenceToken(" Unknown ") === true, "Unknown with whitespace is non-evidence");
assert(gate.isNonEvidenceToken("N/A") === true, "N/A is non-evidence");
assert(gate.isNonEvidenceToken("TBD") === true, "TBD is non-evidence");
assert(gate.isNonEvidenceToken("not sure") === true, "not sure is non-evidence");
assert(gate.isNonEvidenceToken("Maybe") === true, "Maybe is non-evidence");
assert(gate.isNonEvidenceToken("not applicable") === true, "not applicable is non-evidence");
assert(gate.isNonEvidenceToken("0.418") === false, "measurement value is evidence");
assert(gate.isNonEvidenceToken("Steel") === false, "Steel (material name) is evidence");
assert(gate.isNonEvidenceToken("") === true, "empty string is non-evidence");
assert(gate.isNonEvidenceToken(null) === true, "null is non-evidence");
assert(gate.isNonEvidenceToken(undefined) === true, "undefined is non-evidence");

console.log("");
console.log("=== validateEntry: structural rejections ===");
assert(
  gate.validateEntry(null, 0).ok === false,
  "null entry rejected"
);
assert(
  gate.validateEntry({}, 0).reason === "MISSING_REQUIRED_FIELD",
  "empty entry rejected MISSING_REQUIRED_FIELD"
);
assert(
  gate.validateEntry({
    questionId: "q1", questionDecisionImpact: "HIGH",
    answerSource: "INSPECTOR_FIELD", answerProvenance: "OBSERVED",
    answerValue: "Unknown"
  }, 0).reason === "NON_EVIDENCE_TOKEN",
  "answerValue Unknown rejected NON_EVIDENCE_TOKEN"
);

console.log("");
console.log("=== validateEntry: provenance non-increase (Claim 1(iv)) ===");
var r_llm_observed = gate.validateEntry({
  questionId: "q-llm-1", questionDecisionImpact: "HIGH",
  answerValue: "wall loss present", answerSource: "LLM_INFERENCE",
  answerProvenance: "OBSERVED"
}, 0);
assert(
  r_llm_observed.ok === false && r_llm_observed.reason === "PROVENANCE_INFLATION",
  "LLM_INFERENCE cannot assert OBSERVED (claim 1(iv))"
);

var r_llm_measured = gate.validateEntry({
  questionId: "q-llm-2", questionDecisionImpact: "CRITICAL",
  answerValue: "0.418", answerSource: "LLM_INFERENCE",
  answerProvenance: "MEASURED"
}, 0);
assert(
  r_llm_measured.ok === false && r_llm_measured.reason === "PROVENANCE_INFLATION",
  "LLM_INFERENCE cannot assert MEASURED (claim 1(ix) structural)"
);

var r_stake_observed = gate.validateEntry({
  questionId: "q-stake-1", questionDecisionImpact: "HIGH",
  answerValue: "we shut it down", answerSource: "STAKEHOLDER_OPINION",
  answerProvenance: "OBSERVED"
}, 0);
assert(
  r_stake_observed.ok === false && r_stake_observed.reason === "PROVENANCE_INFLATION",
  "STAKEHOLDER_OPINION cannot assert OBSERVED"
);

console.log("");
console.log("=== validateEntry: accepted entries ===");
var r_inst = gate.validateEntry({
  questionId: "q-inst-1", questionDecisionImpact: "CRITICAL",
  answerValue: "0.418", answerSource: "INSTRUMENT",
  answerProvenance: "MEASURED"
}, 0);
assert(r_inst.ok === true, "INSTRUMENT MEASURED accepted");

var r_field = gate.validateEntry({
  questionId: "q-field-1", questionDecisionImpact: "HIGH",
  answerValue: "wet spot at elbow", answerSource: "INSPECTOR_FIELD",
  answerProvenance: "OBSERVED"
}, 0);
assert(r_field.ok === true, "INSPECTOR_FIELD OBSERVED accepted");

var r_doc = gate.validateEntry({
  questionId: "q-doc-1", questionDecisionImpact: "HIGH",
  answerValue: "SA-106-B per CMTR", answerSource: "DOCUMENT",
  answerProvenance: "DOCUMENTED"
}, 0);
assert(r_doc.ok === true, "DOCUMENT DOCUMENTED accepted");

var r_stake_reported = gate.validateEntry({
  questionId: "q-stake-2", questionDecisionImpact: "MEDIUM",
  answerValue: "we cannot shut down this month", answerSource: "STAKEHOLDER_OPINION",
  answerProvenance: "REPORTED"
}, 0);
assert(r_stake_reported.ok === true, "STAKEHOLDER_OPINION REPORTED accepted as opinion record");

console.log("");
console.log("=== validateSet: CRITICAL resolution requires strong provenance ===");
var set_opinion_on_critical = gate.validateSet(
  [{
    questionId: "leak-active", questionDecisionImpact: "CRITICAL",
    answerValue: "probably not", answerSource: "STAKEHOLDER_OPINION",
    answerProvenance: "REPORTED"
  }],
  [{ questionId: "leak-active", decisionImpact: "CRITICAL" }],
  0
);
assert(
  set_opinion_on_critical.stats.criticalUnresolved === 1,
  "opinion does not resolve CRITICAL question"
);
assert(
  set_opinion_on_critical.unresolvedQuestions.indexOf("leak-active") !== -1,
  "leak-active reported as unresolved"
);

var set_measured_on_critical = gate.validateSet(
  [{
    questionId: "leak-active", questionDecisionImpact: "CRITICAL",
    answerValue: "no leak detected by sniffer", answerSource: "INSTRUMENT",
    answerProvenance: "MEASURED"
  }],
  [{ questionId: "leak-active", decisionImpact: "CRITICAL" }],
  0
);
assert(
  set_measured_on_critical.stats.criticalUnresolved === 0,
  "MEASURED resolves CRITICAL question"
);

console.log("");
console.log("=== validateSet: duplicate collapse (strongest wins) ===");
var set_dup = gate.validateSet(
  [
    {
      questionId: "wall-thk", questionDecisionImpact: "HIGH",
      answerValue: "thin-ish", answerSource: "STAKEHOLDER_OPINION",
      answerProvenance: "REPORTED"
    },
    {
      questionId: "wall-thk", questionDecisionImpact: "HIGH",
      answerValue: "0.418", answerSource: "INSTRUMENT",
      answerProvenance: "MEASURED"
    }
  ],
  [{ questionId: "wall-thk", decisionImpact: "HIGH" }],
  0
);
assert(
  set_dup.validated.length === 1,
  "duplicate collapsed to single entry"
);
assert(
  set_dup.validated[0].answerProvenance === "MEASURED",
  "stronger provenance (MEASURED) kept over REPORTED"
);
assert(
  set_dup.rejected.length === 1 && set_dup.rejected[0].reason === "DUPLICATE_COLLAPSED",
  "weaker duplicate rejected with DUPLICATE_COLLAPSED reason"
);

console.log("");
console.log("=== validateSet: staleness (caller-supplied referenceMs) ===");
var REFERENCE_MS_2026_05_29 = 1779513600000; // 2026-05-29T00:00:00Z (deterministic constant; not from clock)
var ten_days_ago_iso = new Date(REFERENCE_MS_2026_05_29 - (10 * 24 * 60 * 60 * 1000)).toISOString();
var set_stale_critical = gate.validateSet(
  [{
    questionId: "cal-valid", questionDecisionImpact: "CRITICAL",
    answerValue: "calibrated", answerSource: "INSTRUMENT",
    answerProvenance: "MEASURED",
    observedAtIso: ten_days_ago_iso
  }],
  [{ questionId: "cal-valid", decisionImpact: "CRITICAL" }],
  REFERENCE_MS_2026_05_29
);
assert(
  set_stale_critical.stats.criticalUnresolved === 1,
  "10-day-old MEASURED entry stale for CRITICAL (7-day window)"
);

var one_day_ago_iso = new Date(REFERENCE_MS_2026_05_29 - (1 * 24 * 60 * 60 * 1000)).toISOString();
var set_fresh_critical = gate.validateSet(
  [{
    questionId: "cal-valid", questionDecisionImpact: "CRITICAL",
    answerValue: "calibrated", answerSource: "INSTRUMENT",
    answerProvenance: "MEASURED",
    observedAtIso: one_day_ago_iso
  }],
  [{ questionId: "cal-valid", decisionImpact: "CRITICAL" }],
  REFERENCE_MS_2026_05_29
);
assert(
  set_fresh_critical.stats.criticalUnresolved === 0,
  "1-day-old MEASURED entry fresh for CRITICAL (7-day window)"
);

console.log("");
console.log("=== validateSet: NDT TEST 2 regression (flood of Unknowns) ===");
var ndt_test_2_form_responses = [
  { questionId: "material", questionDecisionImpact: "LOW",
    answerValue: "Steel", answerSource: "STAKEHOLDER_OPINION", answerProvenance: "REPORTED" },
  { questionId: "leak-location", questionDecisionImpact: "CRITICAL",
    answerValue: "Mid-span", answerSource: "STAKEHOLDER_OPINION", answerProvenance: "REPORTED" },
  { questionId: "leak-active", questionDecisionImpact: "CRITICAL",
    answerValue: "Unknown", answerSource: "STAKEHOLDER_OPINION", answerProvenance: "REPORTED" },
  { questionId: "report-timing", questionDecisionImpact: "HIGH",
    answerValue: "Immediate reporting required", answerSource: "STAKEHOLDER_OPINION", answerProvenance: "REPORTED" },
  { questionId: "cal-valid", questionDecisionImpact: "CRITICAL",
    answerValue: "Unknown", answerSource: "STAKEHOLDER_OPINION", answerProvenance: "REPORTED" },
  { questionId: "fatigue-margin", questionDecisionImpact: "CRITICAL",
    answerValue: "N/A", answerSource: "STAKEHOLDER_OPINION", answerProvenance: "REPORTED" }
];
var set_ndt2 = gate.validateSet(
  ndt_test_2_form_responses,
  [
    { questionId: "leak-location", decisionImpact: "CRITICAL" },
    { questionId: "leak-active", decisionImpact: "CRITICAL" },
    { questionId: "cal-valid", decisionImpact: "CRITICAL" },
    { questionId: "fatigue-margin", decisionImpact: "CRITICAL" }
  ],
  0
);
assert(
  set_ndt2.stats.criticalUnresolved === 4,
  "all 4 CRITICAL questions remain unresolved when answers are opinions or Non-Evidence Tokens"
);
assert(
  set_ndt2.rejected.length >= 3,
  "Unknown/Unknown/N/A rejected as NON_EVIDENCE_TOKEN"
);

console.log("");
console.log("=== validateSet: determinism (same input -> same output) ===");
var det_input = [
  { questionId: "a", questionDecisionImpact: "HIGH",
    answerValue: "0.418", answerSource: "INSTRUMENT", answerProvenance: "MEASURED" },
  { questionId: "b", questionDecisionImpact: "MEDIUM",
    answerValue: "wet spot at elbow", answerSource: "INSPECTOR_FIELD", answerProvenance: "OBSERVED" }
];
var det_required = [
  { questionId: "a", decisionImpact: "HIGH" },
  { questionId: "b", decisionImpact: "MEDIUM" }
];
var run_1 = gate.validateSet(det_input, det_required, 0);
var run_2 = gate.validateSet(det_input, det_required, 0);
var run_3 = gate.validateSet(det_input, det_required, 0);
assert(
  JSON.stringify(run_1) === JSON.stringify(run_2) &&
  JSON.stringify(run_2) === JSON.stringify(run_3),
  "three identical runs produce identical output (claim 1(ii) determinism)"
);

console.log("");
console.log("========================================");
console.log("  Total: " + (passed + failed));
console.log("  PASS:  " + passed);
console.log("  FAIL:  " + failed);
console.log("========================================");
if (failed > 0) {
  process.exit(1);
}
