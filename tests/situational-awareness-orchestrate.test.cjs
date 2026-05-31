// ============================================================================
// situational-awareness-orchestrate.test.cjs   (Stage 9 Part 2b backend gate)
// LOCAL-ONLY (tests/*.cjs is git-ignored). Run:
//   node tests/situational-awareness-orchestrate.test.cjs
// Exercises the full SA chain against a REAL captured decisionPackage.
// ============================================================================
'use strict';

var fs = require('fs');
var path = require('path');
var orch = require('../netlify/functions/situational-awareness-orchestrate.cjs');

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
  for (var k = 0; k < keys.length; k++) { kv.push(JSON.stringify(keys[k]) + ':' + stableStringify(value[keys[k]])); }
  return '{' + kv.join(',') + '}';
}

// Load the real captured response.
var probe = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '_probe-response.json'), 'utf8'));
var decisionPackage = probe.decisionPackage;
assert(decisionPackage && decisionPackage.packageHash, 'probe has a decisionPackage with packageHash');

// Synthetic ValidatedEvidenceSet (the probe ran without sa_responses, so its
// own validated_evidence_set is null). Include one CRITICAL unresolved + a
// financial input + a regulatory input to exercise the chain.
var ves = {
  validated: [
    { questionId: 'wall_thickness_measured', questionDecisionImpact: 'CRITICAL',
      answerValue: '0.118', answerSource: 'INSTRUMENT', answerProvenance: 'MEASURED' },
    { questionId: 'shutdown_cost_per_day', questionDecisionImpact: 'MEDIUM',
      answerValue: '60000', answerSource: 'DOCUMENT', answerProvenance: 'DOCUMENTED' }
  ],
  rejected: [],
  unresolvedQuestions: ['active_leak'],
  stats: { submitted: 3, validated: 2, rejected: 1, criticalUnresolved: 1 }
};

var out = orch.orchestrateSa({
  decisionPackage: decisionPackage,
  validatedEvidenceSet: ves,
  referenceIso: '2026-05-29T12:00:00Z'
});
var sap = out.situationalAwarenessPackage;

// ---------------------------------------------------------------------------
// 1. Full SA package assembled.
// ---------------------------------------------------------------------------
assert(sap && typeof sap === 'object', 'returns a SituationalAwarenessPackage');
assert(sap.stakeholderViews.length === 9, '9 stakeholder views');
assert(sap.conflictMatrix && Array.isArray(sap.conflictMatrix.active_conflicts), 'conflict matrix present');
assert(Array.isArray(sap.consequenceScenarios), 'consequence scenarios present');
assert(sap.executiveBrief && sap.executiveBrief.recommendation, 'executive brief present');
assert(typeof sap.saPackageHash === 'string' && sap.saPackageHash.length === 64, '64-hex saPackageHash');

// ---------------------------------------------------------------------------
// 2. DP hash referenced verbatim (Directive 4) — equals the probe packageHash.
// ---------------------------------------------------------------------------
assert(sap.decisionPackageHash === decisionPackage.packageHash,
  'decisionPackageHash references the probe packageHash, not a recomputed value');

// ---------------------------------------------------------------------------
// 3. fmd.dominant normalized: mechanism name flows through (was a dict).
// ---------------------------------------------------------------------------
var inspectorView = null;
for (var i = 0; i < sap.stakeholderViews.length; i++) {
  if (sap.stakeholderViews[i].role === 'INSPECTOR') { inspectorView = sap.stakeholderViews[i]; }
}
assert(inspectorView.position.indexOf('Mechanical Fatigue') >= 0,
  'mechanism name (Mechanical Fatigue) normalized into the projection, not "undetermined"');
// The original package object must be untouched (still a dict).
assert(typeof decisionPackage.fmd.dominant === 'object',
  'original decisionPackage.fmd.dominant is NOT mutated (still an object)');

// ---------------------------------------------------------------------------
// 4. Brief reflects the real disposition + unresolved CRITICAL.
// ---------------------------------------------------------------------------
assert(sap.executiveBrief.recommendation.disposition === 'HOLD_FOR_INPUT', 'brief carries HOLD_FOR_INPUT');
assert(sap.executiveBrief.unknowns.unresolved_questions.indexOf('active_leak') >= 0, 'unresolved question surfaced');
assert(sap.executiveBrief.unknowns.critical_unresolved_count === 1, 'critical unresolved count surfaced');
assert(sap.executiveBrief.risk.life_safety === 'HIGH', 'life-safety HIGH (consequence tier HIGH)');
assert(sap.executiveBrief.risk.financial === 'QUANTIFIED_FROM_PROVIDED_INPUTS', 'financial input recognized');

// ---------------------------------------------------------------------------
// 5. Coherence event uses the supplied referenceIso (no clock read).
// ---------------------------------------------------------------------------
assert(out.coherenceEvent.event === 'SA_PACKAGE_ASSEMBLED', 'coherence event type');
assert(out.coherenceEvent.referenceIso === '2026-05-29T12:00:00Z', 'coherence event uses caller referenceIso');
assert(out.coherenceEvent.saPackageHash === sap.saPackageHash, 'coherence event carries SA hash');

// ---------------------------------------------------------------------------
// 6. Determinism: same input -> identical SA package hash + identical bytes.
// ---------------------------------------------------------------------------
var out2 = orch.orchestrateSa({ decisionPackage: decisionPackage, validatedEvidenceSet: ves, referenceIso: '2026-05-29T12:00:00Z' });
assert(out2.situationalAwarenessPackage.saPackageHash === sap.saPackageHash, 'saPackageHash deterministic');
assert(stableStringify(out2) === stableStringify(out), 'full orchestration output byte-identical across calls');

// ---------------------------------------------------------------------------
// 7. Null-safe: no validatedEvidenceSet still produces a valid package.
// ---------------------------------------------------------------------------
var bare = orch.orchestrateSa({ decisionPackage: decisionPackage });
assert(bare.situationalAwarenessPackage.stakeholderViews.length === 9, 'works with no VES');
assert(bare.situationalAwarenessPackage.executiveBrief.unknowns.critical_unresolved_count === 0, 'no unresolved without VES');

console.log('All Stage 9 Part 2b orchestrator checks passed (real decisionPackage, full SA chain).');
