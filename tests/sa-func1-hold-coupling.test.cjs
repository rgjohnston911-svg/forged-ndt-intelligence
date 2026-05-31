'use strict';
// DEPLOY386 - FUNC-1 regression: the unresolved-CRITICAL -> confidence-penalty/HOLD
// coupling. Bug was decision-core passing [] as requiredQuestions, so
// stats.criticalUnresolved was ALWAYS 0 and the penalty could never fire.
// This test replicates decision-core's NEW derivation (requiredQuestions built
// from sa_responses' own questionId + questionDecisionImpact) against the real
// gate, and proves criticalUnresolved now reflects reality.
var gate = require('../netlify/functions/situational-awareness-gate.cjs');
function assert(c, m) { if (!c) { throw new Error('FAIL: ' + m); } }

// Mirror decision-core.ts derivation exactly.
function deriveRequired(saResponses) {
  var out = [];
  for (var i = 0; i < saResponses.length; i++) {
    var r = saResponses[i];
    if (r && r.questionId) { out.push({ questionId: r.questionId, decisionImpact: r.questionDecisionImpact || 'MEDIUM' }); }
  }
  return out;
}
function run(saResponses) {
  return gate.validateSet(saResponses, deriveRequired(saResponses), 0);
}
// Frontend-shaped response (matches VoiceInspectionPage sa_responses builder).
function opinion(qid, impact, val) {
  return { questionId: qid, questionText: qid, questionDecisionImpact: impact, answerValue: val || 'yes', answerSource: 'STAKEHOLDER_OPINION', answerProvenance: 'REPORTED' };
}
function measured(qid, impact, val) {
  return { questionId: qid, questionText: qid, questionDecisionImpact: impact, answerValue: val || '0.214', answerSource: 'INSTRUMENT', answerProvenance: 'MEASURED' };
}

// --- BEFORE-FIX BASELINE: hardcoded [] required -> criticalUnresolved always 0 ---
var baseline = gate.validateSet([opinion('q-cp', 'CRITICAL'), opinion('q-leak', 'CRITICAL')], [], 0);
assert(baseline.stats.criticalUnresolved === 0, 'baseline ([] required) -> criticalUnresolved 0 (the bug)');

// --- AFTER FIX: opinion-only CRITICAL questions are unresolved -> penalty fires ---
var r1 = run([opinion('q-cp', 'CRITICAL'), opinion('q-leak', 'CRITICAL')]);
assert(r1.stats.criticalUnresolved === 2, 'two opinion CRITICAL -> criticalUnresolved 2 (got ' + r1.stats.criticalUnresolved + ')');
// Mirror decision-core penalty math: min(0.30, n*0.10)
var pen = Math.min(0.30, r1.stats.criticalUnresolved * 0.10);
assert(Math.abs(pen - 0.20) < 1e-9, 'penalty for 2 unresolved CRITICAL = 0.20');

// --- penalty cap at 0.30 (>=3 unresolved CRITICAL) ---
var r2 = run([opinion('a', 'CRITICAL'), opinion('b', 'CRITICAL'), opinion('c', 'CRITICAL'), opinion('d', 'CRITICAL')]);
assert(r2.stats.criticalUnresolved === 4, 'four opinion CRITICAL -> 4 unresolved');
assert(Math.min(0.30, r2.stats.criticalUnresolved * 0.10) === 0.30, 'penalty capped at 0.30');

// --- a CRITICAL answered with MEASURED (strong) provenance is RESOLVED -> no penalty ---
var r3 = run([measured('q-cp', 'CRITICAL')]);
assert(r3.stats.criticalUnresolved === 0, 'MEASURED CRITICAL -> resolved, criticalUnresolved 0');

// --- NON-critical opinion answers never drive the penalty ---
var r4 = run([opinion('q-x', 'MEDIUM'), opinion('q-y', 'HIGH'), opinion('q-z', 'LOW')]);
assert(r4.stats.criticalUnresolved === 0, 'non-CRITICAL opinion -> criticalUnresolved 0');

// --- mixed: 1 resolved CRITICAL + 1 opinion CRITICAL -> exactly 1 unresolved ---
var r5 = run([measured('q-cp', 'CRITICAL'), opinion('q-leak', 'CRITICAL')]);
assert(r5.stats.criticalUnresolved === 1, 'mixed -> exactly 1 unresolved CRITICAL (got ' + r5.stats.criticalUnresolved + ')');

// --- empty responses -> no required, no penalty (and decision-core skips the block entirely) ---
var r6 = run([]);
assert(r6.stats.criticalUnresolved === 0, 'empty -> criticalUnresolved 0');

// --- determinism ---
assert(JSON.stringify(run([opinion('q-cp','CRITICAL'), opinion('q-leak','CRITICAL')])) === JSON.stringify(r1), 'deterministic');

console.log('All DEPLOY386 FUNC-1 HOLD-coupling checks passed (opinion CRITICAL now drives criticalUnresolved + penalty; strong provenance resolves; non-critical ignored).');
