// ============================================================================
// situational-awareness-stakeholder.test.cjs   (Stage 7 acceptance gate)
// Pure-function determinism + projection-correctness checks for L9.1.
// Run: node netlify/functions/situational-awareness-stakeholder.test.cjs
// ============================================================================
'use strict';

var sa = require('./situational-awareness-stakeholder.cjs');

function assert(cond, msg) { if (!cond) { throw new Error('FAIL: ' + msg); } }

// Stable stringify so we can compare outputs byte-for-byte (deep key sort).
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
// A REJECT package with a hard lock, financial + legal validated evidence.
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
      answerValue: '85000', answerSource: 'DOCUMENT', answerProvenance: 'DOCUMENTED' },
    { questionId: 'jurisdiction_report_required', questionDecisionImpact: 'HIGH',
      answerValue: 'state boiler authority', answerSource: 'REGISTRY', answerProvenance: 'DOCUMENTED' }
  ],
  rejected: [],
  unresolvedQuestions: [],
  stats: { submitted: 3, validated: 3, rejected: 0, criticalUnresolved: 0 }
};

// An ACCEPT_WITH_MONITORING package, no financial/legal inputs, one unresolved CRITICAL.
var pkgAccept = {
  disposition: 'ACCEPT_WITH_MONITORING',
  confidence: 0.74,
  hardLocks: [],
  fmd: { dominant: 'fatigue', margin: 0.10 },
  timeline: { timeToActionDays: 120 },
  consequence: { tier: 'MEDIUM' },
  bindingClauses: []
};
var validatedAccept = {
  validated: [
    { questionId: 'vibration_source', questionDecisionImpact: 'HIGH',
      answerValue: 'pump pulsation', answerSource: 'INSPECTOR_FIELD', answerProvenance: 'OBSERVED' }
  ],
  rejected: [],
  unresolvedQuestions: ['active_leak'],
  stats: { submitted: 2, validated: 1, rejected: 1, criticalUnresolved: 1 }
};

// ---------------------------------------------------------------------------
// 1. Shape: exactly 9 roles, in the fixed contract order.
// ---------------------------------------------------------------------------
var views = sa.projectStakeholders(pkgReject, validatedReject);
assert(views.length === 9, 'produces exactly 9 stakeholder views');
for (var i = 0; i < sa.STAKEHOLDER_ROLES.length; i++) {
  assert(views[i].role === sa.STAKEHOLDER_ROLES[i],
    'role order index ' + i + ' is ' + sa.STAKEHOLDER_ROLES[i]);
}

// Every view carries the full typed contract.
for (var v = 0; v < views.length; v++) {
  var rv = views[v];
  assert(typeof rv.position === 'string', rv.role + ' has position string');
  assert(Array.isArray(rv.evidence_basis), rv.role + ' has evidence_basis array');
  assert(typeof rv.confidence === 'number' && rv.confidence >= 0 && rv.confidence <= 1,
    rv.role + ' confidence in [0,1]');
  assert(['CONTINUE', 'DERATE', 'SHUTDOWN', 'MORE_DATA', 'N/A'].indexOf(rv.what_they_want) >= 0,
    rv.role + ' what_they_want is a valid enum');
  assert(typeof rv.what_they_fear === 'string', rv.role + ' has what_they_fear string');
  assert(['LOW', 'MEDIUM', 'HIGH'].indexOf(rv.decision_contamination_risk) >= 0,
    rv.role + ' contamination risk is a valid enum');
}

// ---------------------------------------------------------------------------
// 2. DETERMINISM: identical inputs -> byte-identical output (repeat calls).
// ---------------------------------------------------------------------------
var a = stableStringify(sa.projectStakeholders(pkgReject, validatedReject));
var b = stableStringify(sa.projectStakeholders(pkgReject, validatedReject));
assert(a === b, 'repeated calls are byte-identical');

// DETERMINISM under input key-order permutation (rebuild package with keys reversed).
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
var permuted = stableStringify(sa.projectStakeholders(reverseKeys(pkgReject), reverseKeys(validatedReject)));
assert(a === permuted, 'output invariant under input key-order permutation');

// ---------------------------------------------------------------------------
// 3. SAFETY leans SHUTDOWN when a hard lock is active.
// ---------------------------------------------------------------------------
function byRole(vs, role) {
  for (var i = 0; i < vs.length; i++) { if (vs[i].role === role) { return vs[i]; } }
  return null;
}
assert(byRole(views, 'SAFETY').what_they_want === 'SHUTDOWN', 'SAFETY wants SHUTDOWN on hard lock');
assert(byRole(views, 'SAFETY').decision_contamination_risk === 'LOW',
  'SAFETY conservative bias is not flagged as contamination');

// ---------------------------------------------------------------------------
// 4. OPS_MANAGER on a mandated REJECT: aligns to SHUTDOWN but flagged MEDIUM.
// ---------------------------------------------------------------------------
assert(byRole(views, 'OPS_MANAGER').what_they_want === 'SHUTDOWN', 'OPS aligns to mandated SHUTDOWN');
assert(byRole(views, 'OPS_MANAGER').decision_contamination_risk === 'MEDIUM',
  'OPS carries MEDIUM production-pressure contamination on shutdown');

// ---------------------------------------------------------------------------
// 5. FINANCIAL: sourced ONLY from provided inputs.
//    - With inputs (revenue_at_risk_per_day present) -> non-empty basis, want diverges.
// ---------------------------------------------------------------------------
var fin = byRole(views, 'FINANCIAL');
assert(fin.evidence_basis.length === 1, 'FINANCIAL basis = only the financial validated entry');
assert(fin.evidence_basis[0].questionId === 'revenue_at_risk_per_day', 'FINANCIAL basis is the cost input');
assert(fin.what_they_want === 'CONTINUE', 'FINANCIAL cost-pressure pulls CONTINUE against SHUTDOWN');
assert(fin.decision_contamination_risk === 'HIGH', 'FINANCIAL flagged HIGH against a shutdown call');

//    - Without any financial input -> N/A, confidence 0 (never inferred).
var finNone = byRole(sa.projectStakeholders(pkgAccept, validatedAccept), 'FINANCIAL');
assert(finNone.evidence_basis.length === 0, 'FINANCIAL basis empty when no inputs provided');
assert(finNone.what_they_want === 'N/A', 'FINANCIAL is N/A with no inputs');
assert(finNone.confidence === 0, 'FINANCIAL confidence 0 with no inputs (no inference)');

// ---------------------------------------------------------------------------
// 6. LEGAL: keys off the authority chain (binding clauses) + reporting.
// ---------------------------------------------------------------------------
var legal = byRole(views, 'LEGAL');
assert(legal.evidence_basis.length === 1, 'LEGAL basis = only the regulatory validated entry');
assert(legal.confidence === roundLocal(0.91), 'LEGAL full confidence with binding clauses present');

var legalNoClause = byRole(sa.projectStakeholders(pkgAccept, validatedAccept), 'LEGAL');
// pkgAccept has no binding clauses -> confidence halved off the criticalUnresolved-adjusted base.
// base = clamp(0.74) - 0.10*1 = 0.64 ; halved = 0.32
assert(legalNoClause.confidence === 0.32, 'LEGAL confidence halved with no binding clauses (got ' + legalNoClause.confidence + ')');

function roundLocal(x) { return Math.round(x * 100) / 100; }

// ---------------------------------------------------------------------------
// 7. Unresolved CRITICAL lowers confidence by 0.10 each (shared base).
// ---------------------------------------------------------------------------
assert(sa.adjustedBaseConfidence(pkgAccept, validatedAccept) === 0.64,
  'one unresolved CRITICAL drops 0.74 -> 0.64');
assert(sa.adjustedBaseConfidence(pkgReject, validatedReject) === 0.91,
  'no unresolved CRITICAL leaves 0.91 intact');

// ---------------------------------------------------------------------------
// 8. RELIABILITY wants MORE_DATA when FMD margin < 0.15.
// ---------------------------------------------------------------------------
var rel = byRole(sa.projectStakeholders(pkgAccept, validatedAccept), 'RELIABILITY');
assert(rel.what_they_want === 'MORE_DATA', 'RELIABILITY wants MORE_DATA on low FMD margin');

// ---------------------------------------------------------------------------
// 9. Empty / pre-SA path: no validated set must not throw, FINANCIAL N/A.
// ---------------------------------------------------------------------------
var bare = sa.projectStakeholders({ disposition: 'ACCEPT_FOR_CONTINUED_SERVICE', confidence: 0.8 }, null);
assert(bare.length === 9, 'handles null validatedEvidenceSet (pre-SA path)');
assert(byRole(bare, 'FINANCIAL').what_they_want === 'N/A', 'FINANCIAL N/A when no evidence set at all');

console.log('All Stage 7 stakeholder-projection checks passed (' + views.length + ' roles, deterministic).');
