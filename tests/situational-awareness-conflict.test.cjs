// ============================================================================
// situational-awareness-conflict.test.cjs   (Stage 8 acceptance gate)
// LOCAL-ONLY (tests/*.cjs is git-ignored). Run:
//   node tests/situational-awareness-conflict.test.cjs
// Determinism + conflict/contamination correctness for L9.2. Chains L9.1->L9.2.
// ============================================================================
'use strict';

var sa = require('../netlify/functions/situational-awareness-stakeholder.cjs');
var cd = require('../netlify/functions/situational-awareness-conflict.cjs');

function assert(cond, msg) { if (!cond) { throw new Error('FAIL: ' + msg); } }

function stableStringify(value) {
  if (value === null || typeof value !== 'object') { return JSON.stringify(value); }
  if (Array.isArray(value)) {
    var parts = [];
    for (var i = 0; i < value.length; i++) { parts.push(stableStringify(value[i])); }
    return '[' + parts.join(',') + ']';
  }
  var keys = Object.keys(value).sort();
  var kv = [];
  for (var k = 0; k < keys.length; k++) {
    kv.push(JSON.stringify(keys[k]) + ':' + stableStringify(value[keys[k]]));
  }
  return '{' + kv.join(',') + '}';
}

function reverseKeys(obj) {
  if (obj === null || typeof obj !== 'object') { return obj; }
  if (Array.isArray(obj)) {
    var arr = [];
    for (var i = 0; i < obj.length; i++) { arr.push(reverseKeys(obj[i])); }
    return arr;
  }
  var keys = Object.keys(obj);
  var out = {};
  for (var k = keys.length - 1; k >= 0; k--) { out[keys[k]] = reverseKeys(obj[keys[k]]); }
  return out;
}

function hasConflict(matrix, roleA, roleB, axis) {
  for (var i = 0; i < matrix.active_conflicts.length; i++) {
    var c = matrix.active_conflicts[i];
    if (c.axis !== axis) { continue; }
    var b = c.between;
    if ((b[0] === roleA && b[1] === roleB) || (b[0] === roleB && b[1] === roleA)) { return c; }
  }
  return null;
}

function flagFor(matrix, stakeholder, type) {
  for (var i = 0; i < matrix.decision_contamination_flags.length; i++) {
    var f = matrix.decision_contamination_flags[i];
    if (f.stakeholder === stakeholder && f.type === type) { return f; }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Fixtures: a REJECT case with financial inputs (FINANCIAL pulls CONTINUE).
// ---------------------------------------------------------------------------
var pkgReject = {
  disposition: 'REJECT_FROM_SERVICE',
  confidence: 0.91,
  hardLocks: [{ trigger: 'CODE_ALLOWABLE_EXCEEDED', severity: 'CRITICAL' }],
  fmd: { dominant: 'general_corrosion', margin: 0.42 },
  timeline: { timeToActionDays: 0 },
  consequence: { tier: 'HIGH' },
  bindingClauses: [{ code: 'API 510', clause: '7.4', requirement: 'min thickness' }]
};
var validatedReject = {
  validated: [
    { questionId: 'wall_thickness_measured', questionDecisionImpact: 'CRITICAL',
      answerValue: '0.118', answerSource: 'INSTRUMENT', answerProvenance: 'MEASURED' },
    { questionId: 'revenue_at_risk_per_day', questionDecisionImpact: 'MEDIUM',
      answerValue: '85000', answerSource: 'DOCUMENT', answerProvenance: 'DOCUMENTED' }
  ],
  rejected: [], unresolvedQuestions: [],
  stats: { submitted: 2, validated: 2, rejected: 0, criticalUnresolved: 0 }
};

var viewsReject = sa.projectStakeholders(pkgReject, validatedReject);
var matrix = cd.detectConflicts(viewsReject, validatedReject);

// ---------------------------------------------------------------------------
// 1. Shape
// ---------------------------------------------------------------------------
assert(Array.isArray(matrix.options), 'options is array');
assert(matrix.stakeholder_positions && typeof matrix.stakeholder_positions === 'object',
  'stakeholder_positions is object');
assert(Array.isArray(matrix.active_conflicts), 'active_conflicts is array');
assert(Array.isArray(matrix.decision_contamination_flags), 'contamination flags is array');
assert(Array.isArray(matrix.conflict_resolution_priority), 'priority is array');

// All 9 roles have a position with wants + rationale.
assert(Object.keys(matrix.stakeholder_positions).length === 9, 'positions for all 9 roles');
assert(matrix.stakeholder_positions.SAFETY.wants === 'SHUTDOWN', 'SAFETY position wants SHUTDOWN');
assert(typeof matrix.stakeholder_positions.SAFETY.rationale === 'string', 'SAFETY has rationale');

// options should be exactly the canonical-ordered distinct wants: CONTINUE + SHUTDOWN.
assert(stableStringify(matrix.options) === stableStringify(['CONTINUE', 'SHUTDOWN']),
  'options = [CONTINUE, SHUTDOWN] (got ' + JSON.stringify(matrix.options) + ')');

// ---------------------------------------------------------------------------
// 2. Fixed resolution priority is a constant.
// ---------------------------------------------------------------------------
assert(stableStringify(matrix.conflict_resolution_priority) ===
  stableStringify(cd.CONFLICT_RESOLUTION_PRIORITY), 'priority equals fixed constant');
assert(matrix.conflict_resolution_priority[0] === 'SAFETY', 'SAFETY is top priority');
assert(matrix.conflict_resolution_priority.indexOf('FINANCIAL') >
  matrix.conflict_resolution_priority.indexOf('ENGINEER'), 'FINANCIAL ranks below ENGINEER');

// ---------------------------------------------------------------------------
// 3. DETERMINISM: repeat + input key-order permutation.
// ---------------------------------------------------------------------------
var m1 = stableStringify(cd.detectConflicts(viewsReject, validatedReject));
var m2 = stableStringify(cd.detectConflicts(viewsReject, validatedReject));
assert(m1 === m2, 'repeated calls byte-identical');
var mPerm = stableStringify(cd.detectConflicts(reverseKeys(viewsReject), reverseKeys(validatedReject)));
assert(m1 === mPerm, 'output invariant under input key-order permutation');

// ---------------------------------------------------------------------------
// 4. Conflict detection: SAFETY(SHUTDOWN) vs FINANCIAL(CONTINUE) -> CRITICAL.
// ---------------------------------------------------------------------------
var sf = hasConflict(matrix, 'SAFETY', 'FINANCIAL', 'shutdown_now');
assert(sf !== null, 'SAFETY vs FINANCIAL shutdown_now conflict exists');
assert(sf.severity === 'CRITICAL', 'SAFETY-vs-HIGH-contamination-CONTINUE is CRITICAL (got ' + sf.severity + ')');

// A non-safety shutdown role vs FINANCIAL is HIGH (FINANCIAL is HIGH contamination).
var ef = hasConflict(matrix, 'ENGINEER', 'FINANCIAL', 'shutdown_now');
assert(ef !== null && ef.severity === 'HIGH', 'ENGINEER vs FINANCIAL is HIGH');

// ---------------------------------------------------------------------------
// 5. Contamination flags: FINANCIAL COST_PRESSURE (HIGH) + OPS PRODUCTION_PRESSURE.
// ---------------------------------------------------------------------------
var finFlag = flagFor(matrix, 'FINANCIAL', 'COST_PRESSURE');
assert(finFlag !== null && finFlag.severity === 'HIGH', 'FINANCIAL COST_PRESSURE flagged HIGH');
var opsFlag = flagFor(matrix, 'OPS_MANAGER', 'PRODUCTION_PRESSURE');
assert(opsFlag !== null, 'OPS_MANAGER PRODUCTION_PRESSURE flagged');

// SAFETY (conservative bias) must NOT be flagged as contaminated.
assert(flagFor(matrix, 'SAFETY', 'PRODUCTION_PRESSURE') === null &&
  flagFor(matrix, 'SAFETY', 'DECISION_PRESSURE') === null, 'SAFETY not flagged as contaminated');

// ---------------------------------------------------------------------------
// 6. Evidence-derived named bias: a "uncalibrated" entry -> MISSING_CALIBRATION
//    attributed to INSPECTOR.
// ---------------------------------------------------------------------------
var validatedCal = {
  validated: [
    { questionId: 'ut_probe_uncalibrated', questionDecisionImpact: 'HIGH',
      answerValue: 'cal sticker expired', answerSource: 'INSPECTOR_FIELD', answerProvenance: 'OBSERVED' }
  ],
  rejected: [], unresolvedQuestions: [],
  stats: { submitted: 1, validated: 1, rejected: 0, criticalUnresolved: 0 }
};
var viewsCal = sa.projectStakeholders(pkgReject, validatedCal);
var matrixCal = cd.detectConflicts(viewsCal, validatedCal);
var calFlag = flagFor(matrixCal, 'INSPECTOR', 'MISSING_CALIBRATION');
assert(calFlag !== null, 'MISSING_CALIBRATION attributed to INSPECTOR from evidence keyword');
assert(calFlag.evidence && calFlag.evidence.questionId === 'ut_probe_uncalibrated',
  'MISSING_CALIBRATION flag references the triggering evidence entry');

// ---------------------------------------------------------------------------
// 7. Empty / pre-SA path: no views must not throw.
// ---------------------------------------------------------------------------
var empty = cd.detectConflicts([], null);
assert(empty.active_conflicts.length === 0, 'no conflicts with no views');
assert(empty.decision_contamination_flags.length === 0, 'no flags with no views');
assert(stableStringify(empty.conflict_resolution_priority) ===
  stableStringify(cd.CONFLICT_RESOLUTION_PRIORITY), 'priority constant even when empty');

console.log('All Stage 8 conflict-detection checks passed (deterministic ConflictMatrix).');
