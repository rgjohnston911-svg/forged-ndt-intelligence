// ============================================================================
// situational-awareness-consequence.test.cjs   (Stage 10 acceptance gate)
// LOCAL-ONLY (tests/*.cjs is git-ignored). Run:
//   node tests/situational-awareness-consequence.test.cjs
// Core rule under test: the simulator NEVER invents probabilities.
// ============================================================================
'use strict';

var sa = require('../netlify/functions/situational-awareness-stakeholder.cjs');
var cd = require('../netlify/functions/situational-awareness-conflict.cjs');
var cs = require('../netlify/functions/situational-awareness-consequence.cjs');

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

function byOption(list, option) {
  for (var i = 0; i < list.length; i++) { if (list[i].option === option) { return list[i]; } }
  return null;
}

// ---------------------------------------------------------------------------
// Setup: an ACCEPT case (options CONTINUE + ... ) with a ConflictMatrix.
// ---------------------------------------------------------------------------
var pkg = {
  disposition: 'ACCEPT_WITH_MONITORING', confidence: 0.8, hardLocks: [],
  fmd: { dominant: 'general_corrosion', margin: 0.30 },
  timeline: { timeToActionDays: 200 }, consequence: { tier: 'MEDIUM' }, bindingClauses: []
};
var validated = {
  validated: [
    { questionId: 'shutdown_cost_per_day', questionDecisionImpact: 'MEDIUM',
      answerValue: '40000', answerSource: 'DOCUMENT', answerProvenance: 'DOCUMENTED' }
  ],
  rejected: [], unresolvedQuestions: [], stats: { submitted: 1, validated: 1, rejected: 0, criticalUnresolved: 0 }
};
var matrix = cd.detectConflicts(sa.projectStakeholders(pkg, validated), validated);

// ---------------------------------------------------------------------------
// 1. NO basis supplied -> every scenario confidence 0, empty outcomes.
// ---------------------------------------------------------------------------
var noBasis = cs.buildConsequenceScenarios(pkg, matrix, validated, null);
assert(noBasis.length === matrix.options.length, 'one scenario per resolved option');
for (var i = 0; i < noBasis.length; i++) {
  assert(noBasis[i].confidence === 0, noBasis[i].option + ' confidence 0 with no basis');
  assert(noBasis[i].probability_weighted_outcomes.length === 0, noBasis[i].option + ' no outcomes invented');
  assert(noBasis[i].expected_value.safety === 'UNQUANTIFIED', noBasis[i].option + ' safety UNQUANTIFIED');
}
// Financial input present -> financial expected value falls back to provided-inputs marker (NOT a number).
assert(byOption(noBasis, 'CONTINUE').expected_value.financial === 'SEE_PROVIDED_INPUTS',
  'financial reflects provided inputs without inventing a figure');

// ---------------------------------------------------------------------------
// 2. WITH a valid basis -> outcomes + confidence passed through (not invented).
// ---------------------------------------------------------------------------
var basis = {
  byOption: {
    CONTINUE: {
      confidence: 0.7,
      outcomes: [
        { outcome: 'leak within 12 months', probability: 0.25,
          consequence_basis: 'L4 Weibull projection', evidence_source: [{ questionId: 'wt_trend' }] },
        { outcome: 'no failure within 12 months', probability: 0.75, consequence_basis: 'L4 Weibull projection' }
      ],
      expected_value: { financial: '40000/day downtime avoided', safety: 'ELEVATED', regulatory: 'NONE' },
      evidence_basis: [{ questionId: 'wt_trend', answerProvenance: 'MEASURED' }]
    }
  }
};
var withBasis = cs.buildConsequenceScenarios(pkg, matrix, validated, basis);
var cont = byOption(withBasis, 'CONTINUE');
assert(cont.confidence === 0.7, 'CONTINUE confidence passed through from basis (got ' + cont.confidence + ')');
assert(cont.probability_weighted_outcomes.length === 2, 'both valid outcomes retained');
assert(cont.probability_weighted_outcomes[0].probability === 0.25, 'probability preserved, rounded');
assert(cont.expected_value.safety === 'ELEVATED', 'expected_value.safety passed through');
assert(cont.evidence_basis.length === 1, 'evidence_basis carried');

// Options without a basis entry remain confidence 0 even when others have basis.
var shut = byOption(withBasis, 'SHUTDOWN');
if (shut) { assert(shut.confidence === 0 && shut.probability_weighted_outcomes.length === 0, 'SHUTDOWN still 0 (no basis entry)'); }

// ---------------------------------------------------------------------------
// 3. Invalid probabilities are DROPPED, never coerced. If all drop -> no basis.
// ---------------------------------------------------------------------------
var badBasis = {
  byOption: {
    CONTINUE: { confidence: 0.9, outcomes: [
      { outcome: 'x', probability: 1.4 },        // out of range
      { outcome: 'y', probability: 'high' },     // non-numeric
      { outcome: 'z' }                            // missing probability
    ] }
  }
};
var bad = byOption(cs.buildConsequenceScenarios(pkg, matrix, validated, badBasis), 'CONTINUE');
assert(bad.probability_weighted_outcomes.length === 0, 'invalid probabilities dropped');
assert(bad.confidence === 0, 'no valid outcome -> no basis -> confidence 0 (no invention)');

// A basis with outcomes but NO explicit confidence is treated as no basis.
var noConf = { byOption: { CONTINUE: { outcomes: [{ outcome: 'a', probability: 0.5 }] } } };
var nc = byOption(cs.buildConsequenceScenarios(pkg, matrix, validated, noConf), 'CONTINUE');
assert(nc.confidence === 0 && nc.probability_weighted_outcomes.length === 0,
  'outcomes without explicit confidence are not a basis');

// ---------------------------------------------------------------------------
// 4. DETERMINISM: repeat + input key-order permutation.
// ---------------------------------------------------------------------------
var d1 = stableStringify(cs.buildConsequenceScenarios(pkg, matrix, validated, basis));
var d2 = stableStringify(cs.buildConsequenceScenarios(pkg, matrix, validated, basis));
assert(d1 === d2, 'repeated calls byte-identical');
var dPerm = stableStringify(cs.buildConsequenceScenarios(
  reverseKeys(pkg), reverseKeys(matrix), reverseKeys(validated), reverseKeys(basis)));
assert(d1 === dPerm, 'output invariant under input key-order permutation');

// ---------------------------------------------------------------------------
// 5. Null-safe: no matrix -> falls back to canonical options, all confidence 0.
// ---------------------------------------------------------------------------
var bare = cs.buildConsequenceScenarios(pkg, null, null, null);
assert(bare.length === cs.CANONICAL_OPTIONS.length, 'canonical options when no matrix');
for (var b = 0; b < bare.length; b++) {
  assert(bare[b].confidence === 0, 'canonical scenario confidence 0 without basis');
  assert(bare[b].expected_value.financial === 'UNQUANTIFIED', 'financial UNQUANTIFIED with no inputs at all');
}

console.log('All Stage 10 consequence-simulator checks passed (no invented probabilities).');
