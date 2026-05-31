// ============================================================================
// situational-awareness-brief.test.cjs   (Stage 9 engine acceptance gate)
// LOCAL-ONLY (tests/*.cjs is git-ignored). Run:
//   node tests/situational-awareness-brief.test.cjs
// Determinism + rendering correctness for L9.4. Chains L9.1 -> L9.2 -> L9.4.
// ============================================================================
'use strict';

var sa = require('../netlify/functions/situational-awareness-stakeholder.cjs');
var cd = require('../netlify/functions/situational-awareness-conflict.cjs');
var br = require('../netlify/functions/situational-awareness-brief.cjs');

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

// ---------------------------------------------------------------------------
// Fixture: REJECT with hard lock, financial + regulatory evidence, 0 unresolved.
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

var views = sa.projectStakeholders(pkgReject, validatedReject);
var matrix = cd.detectConflicts(views, validatedReject);
var brief = br.buildExecutiveBrief(pkgReject, validatedReject, matrix, null);

// ---------------------------------------------------------------------------
// 1. Shape + no-new-evidence invariant
// ---------------------------------------------------------------------------
assert(brief.recommendation && typeof brief.recommendation.action === 'string', 'has recommendation.action');
assert(brief.risk && brief.risk.life_safety && brief.risk.financial && brief.risk.regulatory, 'has risk triad');
assert(typeof brief.confidence === 'number', 'has numeric confidence');
assert(brief.unknowns && Array.isArray(brief.unknowns.unresolved_questions), 'has unknowns');
assert(Array.isArray(brief.code_basis), 'has code_basis');
assert(brief.conflict_summary && typeof brief.conflict_summary.active_conflict_count === 'number', 'has conflict_summary');
assert(Array.isArray(brief.hard_locks), 'has hard_locks');
assert(brief.produces_new_evidence === false, 'produces_new_evidence is always false');

// ---------------------------------------------------------------------------
// 2. Recommendation maps the disposition.
// ---------------------------------------------------------------------------
assert(brief.recommendation.disposition === 'REJECT_FROM_SERVICE', 'recommendation carries disposition');
assert(brief.recommendation.action === br.DISPOSITION_ACTION.REJECT_FROM_SERVICE, 'action matches disposition map');
assert(brief.recommendation.simulator_informed === false, 'simulator not informed (no scenarios at Stage 9)');

// ---------------------------------------------------------------------------
// 3. Risk triad.
// ---------------------------------------------------------------------------
assert(brief.risk.life_safety === 'HIGH', 'life-safety HIGH (hard lock + shutdown + HIGH tier)');
assert(brief.risk.financial === 'QUANTIFIED_FROM_PROVIDED_INPUTS', 'financial quantified from provided input');
assert(brief.risk.regulatory === 'MEDIUM', 'regulatory MEDIUM (binding clauses present, no report)');

// ---------------------------------------------------------------------------
// 4. Confidence model: 0.91, no unresolved critical -> 0.91.
// ---------------------------------------------------------------------------
assert(brief.confidence === 0.91, 'confidence 0.91 with no unresolved CRITICAL');

// ---------------------------------------------------------------------------
// 5. Code basis carried from binding clauses.
// ---------------------------------------------------------------------------
assert(brief.code_basis.length === 1 && brief.code_basis[0].code === 'API 510', 'code_basis from bindingClauses');

// ---------------------------------------------------------------------------
// 6. Conflict summary reflects the matrix (SAFETY vs FINANCIAL CRITICAL exists).
// ---------------------------------------------------------------------------
assert(brief.conflict_summary.active_conflict_count > 0, 'conflict count > 0');
assert(brief.conflict_summary.highest_severity === 'CRITICAL', 'highest severity CRITICAL');
assert(brief.conflict_summary.top_priority === 'SAFETY', 'top priority SAFETY');
assert(brief.conflict_summary.contamination_flag_count >= 2, 'contamination flags counted');

// ---------------------------------------------------------------------------
// 7. Hard locks carried through.
// ---------------------------------------------------------------------------
assert(brief.hard_locks.length === 1 && brief.hard_locks[0] === 'CODE_ALLOWABLE_EXCEEDED', 'hard lock trigger carried');

// ---------------------------------------------------------------------------
// 8. DETERMINISM: repeat + input key-order permutation.
// ---------------------------------------------------------------------------
var b1 = stableStringify(br.buildExecutiveBrief(pkgReject, validatedReject, matrix, null));
var b2 = stableStringify(br.buildExecutiveBrief(pkgReject, validatedReject, matrix, null));
assert(b1 === b2, 'repeated calls byte-identical');
var bPerm = stableStringify(br.buildExecutiveBrief(
  reverseKeys(pkgReject), reverseKeys(validatedReject), reverseKeys(matrix), null));
assert(b1 === bPerm, 'output invariant under input key-order permutation');

// ---------------------------------------------------------------------------
// 9. Unresolved CRITICAL flows into unknowns + lowers confidence.
// ---------------------------------------------------------------------------
var pkgHold = { disposition: 'HOLD_FOR_INPUT', confidence: 0.74, hardLocks: [], bindingClauses: [],
  fmd: { dominant: 'fatigue', margin: 0.10 }, timeline: { timeToActionDays: 120 }, consequence: { tier: 'MEDIUM' } };
var validatedHold = {
  validated: [], rejected: [], unresolvedQuestions: ['active_leak'],
  stats: { submitted: 1, validated: 0, rejected: 0, criticalUnresolved: 1 }
};
var briefHold = br.buildExecutiveBrief(pkgHold, validatedHold, cd.detectConflicts(sa.projectStakeholders(pkgHold, validatedHold), validatedHold), null);
assert(briefHold.unknowns.unresolved_questions.indexOf('active_leak') >= 0, 'unresolved question surfaced');
assert(briefHold.unknowns.critical_unresolved_count === 1, 'critical unresolved count surfaced');
assert(briefHold.confidence === 0.64, '0.74 - 0.10 (one unresolved CRITICAL) = 0.64');
assert(briefHold.risk.financial === 'UNQUANTIFIED_NO_INPUTS_PROVIDED', 'financial unquantified with no inputs');

// ---------------------------------------------------------------------------
// 10. Pre-SA / null path: must not throw.
// ---------------------------------------------------------------------------
var bare = br.buildExecutiveBrief({ disposition: 'ACCEPT_FOR_CONTINUED_SERVICE', confidence: 0.8 }, null, null, null);
assert(bare.conflict_summary.active_conflict_count === 0, 'no conflicts with null matrix');
assert(bare.risk.life_safety === 'LOW', 'life-safety LOW for clean accept');
assert(bare.produces_new_evidence === false, 'still produces no new evidence');

// ---------------------------------------------------------------------------
// 11. Consequence-scenario presence flips simulator_informed.
// ---------------------------------------------------------------------------
var withSim = br.buildExecutiveBrief(pkgReject, validatedReject, matrix,
  [{ option: 'SHUTDOWN', confidence: 0.6, probability_weighted_outcomes: [] }]);
assert(withSim.recommendation.simulator_informed === true, 'simulator_informed true when scenarios present');

console.log('All Stage 9 (engine) executive-brief checks passed (deterministic ExecutiveBrief).');
