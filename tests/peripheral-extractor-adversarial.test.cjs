'use strict';
// ============================================================================
// PERIPHERAL EXTRACTOR -- ADVERSARIAL ROBUSTNESS GATE  (DEPLOY415)
//
// The 18/18 acceptance gate is SELF-AUTHORED with precise actor terms, so it
// cannot catch blind spots I did not think to write. This gate probes the ways
// the extractor mislabels REAL inspector language - the failure mode that
// matters most because the systemic (fleet aggregation) layer is only as clean
// as the referrals feeding it. A negation false-positive at fleet scale becomes
// a CONFIDENT systemic finding of a problem that is not there.
//
// Each case asserts the CORRECT actor set (often EMPTY). A naive extractor with
// no negation guard is run alongside as a FOIL and MUST fail the negation cases,
// proving the gate discriminates.
//
// HONESTY: these are still MY cases. They harden against the classes I could
// foresee (negation, substring, clean-mention, distractor). They do NOT
// substitute for an INDEPENDENT corpus of real inspector phrasings - that is the
// only thing that removes my authoring blind spot (see DEPLOY415 doc).
// ============================================================================
var P = require('../netlify/functions/peripheral-referral.cjs');

function actors(text) {
  var r = P.extractPeripheralsFromText(text, 'HIGH');
  return r.map(function (x) { return x.secondary_asset.type; }).sort();
}

// ---- NAIVE FOIL: keyword + un-negated degrade scan (the pre-fix behaviour) ----
function naiveActors(text) {
  var t = String(text).toLowerCase();
  var found = [];
  if (/(pipe support|rigid support|support beneath|trunnion|pipe shoe)/.test(t)) { found.push('fixed_support'); }
  if (/(spring hanger|spring support)/.test(t)) { found.push('spring_hanger'); }
  if (/(foundation|footing|pedestal|settlement)/.test(t)) { found.push('foundation'); }
  var degraded = /corro|crack|degrad|settl|rusted|wasting|section loss|damaged/.test(t);
  return degraded ? found.sort() : [];
}

var CASES = [
  // --- NEGATION (the bug this gate locks): a negated finding is NOT a finding ---
  { t: 'no corrosion found on the pipe support.',               want: [],                 naiveShouldFail: true },
  { t: 'the spring hanger shows no signs of degradation.',      want: [],                 naiveShouldFail: true },
  { t: 'foundation inspected, not settling, sound.',            want: [],                 naiveShouldFail: true },
  { t: 'pipe support: corrosion ruled out after UT.',           want: [],                 naiveShouldFail: true },
  // --- SUBSTRING SAFETY: actor token inside an unrelated word ---
  { t: 'the inspection guidelines were followed throughout.',   want: [],                 naiveShouldFail: false },
  // --- CLEAN MENTION: actor present, no degradation -> no referral ---
  { t: 'the pipe support is in good condition, recently painted.', want: [],              naiveShouldFail: false },
  // --- CONTROLS: a real, un-negated finding MUST still fire ---
  { t: 'the pipe support is badly corroded near the anchor.',   want: ['fixed_support'],  naiveShouldFail: false },
  { t: 'the spring hanger is seized and the can is rusted.',    want: ['spring_hanger'],  naiveShouldFail: false },
  { t: 'foundation showing settlement cracks beneath the vessel.', want: ['foundation'],  naiveShouldFail: false },
  // --- TEMPORAL: PLANNED remediation is not COMPLETED - the finding is still LIVE ---
  { t: 'the pipe support was corroded and will be replaced next shutdown.', want: ['fixed_support'], naiveShouldFail: false },
  { t: 'the pipe support is corroded, scheduled for replacement.',          want: ['fixed_support'], naiveShouldFail: false },
  // --- TEMPORAL: COMPLETED past remediation -> not a live referral ---
  { t: 'the pipe support was corroded last year but has since been replaced.', want: [], naiveShouldFail: true }
];

var pass = 0, foilCaught = 0, foilExpected = 0;
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function pad(s, n) { s = String(s); while (s.length < n) { s = s + ' '; } return s; }

for (var i = 0; i < CASES.length; i++) {
  var c = CASES[i];
  var got = actors(c.t);
  var ok = eq(got, c.want.slice().sort());
  if (ok) { pass++; }
  console.log('  ' + (ok ? 'PASS ' : 'FAIL ') + pad('[' + got.join(',') + ']', 18) + c.t);
  if (!ok) { console.log('        EXPECTED [' + c.want.join(',') + ']'); }
  if (c.naiveShouldFail) {
    foilExpected++;
    var naiveGot = naiveActors(c.t);
    if (!eq(naiveGot, c.want.slice().sort())) { foilCaught++; }
    else { console.log('        !! FOIL did not fail on a case it should have: ' + c.t); }
  }
}
console.log('\n' + pass + ' / ' + CASES.length + ' adversarial cases passed');
console.log('naive foil failed ' + foilCaught + ' / ' + foilExpected + ' negation cases (foil MUST fail these)');
var allGood = (pass === CASES.length) && (foilCaught === foilExpected);
if (!allGood) { process.exitCode = 1; }
