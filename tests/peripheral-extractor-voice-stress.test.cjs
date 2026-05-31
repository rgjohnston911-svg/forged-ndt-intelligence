'use strict';
// ============================================================================
// PERIPHERAL EXTRACTOR -- VOICE-TRANSCRIPT-STRESS CORPUS  (DEPLOY417)
//
// MEDIUM probe: production input is voice-transcribed field speech (run-ons, no
// punctuation, packed utterances, disfluency). The attribution fix (clause
// scoping) needs clause boundaries that this medium often lacks. /fleet is shown
// LIVE on stage, so a packed utterance must not throw a CONFIDENT phantom referral
// that rolls into a phantom systemic finding in front of the room.
//
// TIER 1  speech the extractor SHOULD handle (fillers, missing punctuation, spoken
//         negation, spoken future/done remediation) -> LOCKED.
// TIER 2  run-on attribution -> SAFE DEGRADATION, now LOCKED. When clause-scoping
//         cannot bind (a degradation cue and a 'this one is fine' cue share a clause
//         with no boundary), the extractor refuses to REFER and emits
//         NEEDS_CONFIRMATION instead. It can no longer feed a phantom systemic flag
//         (flagsFromReferrals counts REFER only). The "correct refusal" beat.
//
// *** STILL KNOWN-OPEN (narrowed): WHICH actor is the real finding inside a run-on
// is not resolved here - the safe-FAIL direction is guaranteed, but correct
// attribution within a packed utterance needs REAL field audio (task #54). ***
//
// Run: node tests/peripheral-extractor-voice-stress.test.cjs
// ============================================================================
var P = require('../netlify/functions/peripheral-referral.cjs');
function scored(text) { return P.scoreReferrals(P.extractPeripheralsFromText(text, 'HIGH')).referrals; }
function emittedREFER(text) { return scored(text).filter(function (x) { return x.routing.action === 'REFER'; }).map(function (x) { return x.secondary_asset.type; }).sort(); }
function actions(text) { return scored(text).map(function (x) { return x.secondary_asset.type + ':' + x.routing.action; }); }
function eq(a, b) { a = a.slice().sort(); b = b.slice().sort(); return JSON.stringify(a) === JSON.stringify(b); }
function pad(s, n) { s = String(s); while (s.length < n) { s = s + ' '; } return s; }

var pass = 0, total = 0;
function check(n, c) { total++; if (c) { pass++; console.log('  PASS ' + n); } else { console.log('  FAIL ' + n); } }

// ---- TIER 1: LOCKED (disfluency / no punctuation / spoken negation+remediation) ----
console.log('--- TIER 1 (LOCKED: speech the extractor handles) ---');
var TIER1 = [
  { t: 'uh so yeah the pipe support is uh badly corroded',            want: ['fixed_support'] },
  { t: 'the spring hanger is seized',                                 want: ['spring_hanger'] },
  { t: 'the pipe support is corroded gonna get replaced next outage', want: ['fixed_support'] },
  { t: 'nah the pipe support is fine no corrosion there',             want: [] },
  { t: 'pipe support was corroded but it got replaced last turnaround', want: [] }
];
for (var i = 0; i < TIER1.length; i++) {
  check(pad('[' + emittedREFER(TIER1[i].t).join(',') + ']', 18) + TIER1[i].t, eq(emittedREFER(TIER1[i].t), TIER1[i].want));
}

// ---- TIER 2: SAFE DEGRADATION, now LOCKED (run-on -> no confident REFER) ----
console.log('--- TIER 2 (LOCKED: run-on degrades safely, never a confident phantom REFER) ---');
var RUNONS = [
  'uh the pipe support the corrosion is on the line not the support that one is fine',
  'so the line has got corrosion the pipe support under it looks okay',
  'pipe support corroded guide is fine spring hanger seized'
];
for (var j = 0; j < RUNONS.length; j++) {
  var refers = emittedREFER(RUNONS[j]);
  // SAFE-FAIL guarantee: a packed run-on yields ZERO confident REFERs (so it cannot feed a
  // phantom systemic CLUSTER). It surfaces as NEEDS_CONFIRMATION instead.
  var hasNeedsConfirm = actions(RUNONS[j]).some(function (a) { return a.indexOf(':NEEDS_CONFIRMATION') >= 0; });
  check('run-on emits no confident REFER  ' + pad('[' + refers.join(',') + ']', 14) + RUNONS[j].slice(0, 48), refers.length === 0 && hasNeedsConfirm);
}

console.log('\nVOICE-STRESS GATE: ' + pass + ' / ' + total + ' passed (Tier-1 + Tier-2 safe-degradation locked)');
console.log('KNOWN-OPEN (narrowed): correct attribution WITHIN a run-on still needs real field audio (#54).');
if (pass !== total) { process.exitCode = 1; }
