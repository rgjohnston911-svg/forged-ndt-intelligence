// ============================================================================
// tests/fleet-peripheral-aggregation.test.cjs  -  COHORT-AWARE AGGREGATION GATE
// FORGED 4D NDT  -  DEPLOY414
//
// Systemic != "many assets flagged X" (corrosion is common -> floods). Systemic =
// "more than the shared context predicts": CLUSTER (cohort vs rest-of-fleet) or
// PREVALENCE (fleet vs sound-asset expected rate; degrades to ELEVATED_NO_CONTRAST
// without one). This gate runs whole-fleet golden cases + the deviance guard.
//
// Run: node tests/fleet-peripheral-aggregation.test.cjs
// ============================================================================
'use strict';
var AGG = require('../netlify/functions/fleet-peripheral-aggregation.cjs');
var PER = require('../netlify/functions/peripheral-referral.cjs');

var S = ['fixed_support']; var none = [];
function A(id, cohort, flags) { return { id: id, cohort: cohort, flags: flags }; }

var FLEETS = [
  { name: 'F1 localized coating-batch cluster', expected_rates: {},
    assets: [A('a1','batch_1998',S),A('a2','batch_1998',S),A('a3','batch_1998',S),A('a4','batch_1998',S),
             A('a5','batch_2015',none),A('a6','batch_2015',none),A('a7','batch_2015',none),A('a8','batch_2015',none),
             A('a9','batch_2015',none),A('a10','batch_2015',none),A('a11','batch_2015',none),A('a12','batch_2015',none)],
    expect: ['fixed_support:CLUSTER:batch_1998'] },
  { name: 'F2 fleet-wide CP failure, expected rate known', expected_rates: { fixed_support: 0.2 },
    assets: [A('b1','u1',S),A('b2','u1',S),A('b3','u1',S),A('b4','u1',S),A('b5','u1',none),
             A('b6','u2',S),A('b7','u2',S),A('b8','u2',S),A('b9','u2',S),A('b10','u2',none)],
    expect: ['fixed_support:PREVALENCE:fleet'] },
  { name: 'F3 marine fleet -- corrosion IS the baseline (must stay silent)', expected_rates: { fixed_support: 0.5 },
    assets: [A('c1','u1',S),A('c2','u1',S),A('c3','u1',none),A('c4','u1',none),A('c5','u1',none),
             A('c6','u2',S),A('c7','u2',S),A('c8','u2',none),A('c9','u2',none),A('c10','u2',none)],
    expect: [] },
  { name: 'F4 sparse noise (below MIN_AFFECTED)', expected_rates: {},
    assets: [A('d1','u1',S),A('d2','u2',S),A('d3','u1',none),A('d4','u1',none),A('d5','u2',none),
             A('d6','u2',none),A('d7','u1',none),A('d8','u2',none),A('d9','u1',none),A('d10','u2',none),A('d11','u1',none),A('d12','u2',none)],
    expect: [] },
  { name: 'F5 tiny cohort at 100% (below MIN_COHORT)', expected_rates: {},
    assets: [A('e1','temp',['temp_repair']),A('e2','temp',['temp_repair']),
             A('e3','main',none),A('e4','main',none),A('e5','main',none),A('e6','main',none),
             A('e7','main',none),A('e8','main',none),A('e9','main',none),A('e10','main',none),A('e11','main',none),A('e12','main',none)],
    expect: [] },
  { name: 'F6 multi-actor: one clusters, one scattered noise', expected_rates: {},
    assets: [A('g1','batch_A',['fixed_support','insulation']),A('g2','batch_A',S),A('g3','batch_A',S),A('g4','batch_A',S),
             A('g5','batch_B',['insulation']),A('g6','batch_B',none),A('g7','batch_B',none),A('g8','batch_B',none),
             A('g9','batch_B',none),A('g10','batch_B',none),A('g11','batch_B',none),A('g12','batch_B',none)],
    expect: ['fixed_support:CLUSTER:batch_A'] }
];

function key(f) { return f.actor + ':' + f.signal + ':' + f.cohort; }
var pass = 0, total = 0;
function check(name, cond) { total++; if (cond) { pass++; console.log('PASS ' + name); } else { console.log('FAIL ' + name); } }

for (var k = 0; k < FLEETS.length; k++) {
  var fl = FLEETS[k];
  var got = AGG.aggregatePeripherals({ assets: fl.assets, expected_rates: fl.expected_rates }, AGG.CONFIG).map(key).sort();
  var want = fl.expect.slice().sort();
  check(fl.name, JSON.stringify(got) === JSON.stringify(want));
}

// Deviance guard: a sustained failing program (0.80) over a 0.30 anchor must NOT
// self-train the baseline down to silence; effective_expected stays clamped at the
// anchor and review_pending fires.
var entry = JSON.parse(JSON.stringify(AGG.EXPECTED_RATES['fixed_support|marine_splash']));
for (var p = 0; p < 6; p++) { AGG.updateExpected(entry, 0.80, 10); }
check('deviance guard: effective_expected stays clamped at anchor 0.30 (not self-trained to 0.80)', Math.abs(entry.effective_expected - 0.30) < 1e-9);
check('deviance guard: review_pending raised (human review: program failure vs context)', entry.review_pending === true);
check('PREVALENCE still fires after 6 failing passes (0.80 - 0.30 >= 0.30 margin)', (0.80 - entry.effective_expected) >= 0.30);

// Integration: peripheral-referral REFERs -> aggregation flags[]
var refs = PER.scoreReferrals(PER.extractPeripheralsFromText('the pipe support beneath the toxic line is badly corroded.', 'CRITICAL')).referrals;
var flags = AGG.flagsFromReferrals(refs);
check('flagsFromReferrals extracts REFER actor (fixed_support) from a peripheral result', flags.indexOf('fixed_support') >= 0);

// STRUCTURAL ANCHOR GATING (DEPLOY415b): a PLACEHOLDER / LOW-confidence / zero-sample
// anchor must NOT be able to emit a CONFIRMED PREVALENCE - it degrades to PROVISIONAL.
// (A plain-number expected rate, as in F2, stays confident - caller-asserted.)
var phFleet = { assets: [A('p1','u1',S),A('p2','u1',S),A('p3','u1',S),A('p4','u1',S),A('p5','u1',none),
                         A('p6','u2',S),A('p7','u2',S),A('p8','u2',S),A('p9','u2',none),A('p10','u2',none)],
  expected_rates: { fixed_support: { rate: 0.20, source: 'PLACEHOLDER', confidence: 'LOW', observed_n: 0 } } };
var phOut = AGG.aggregatePeripherals(phFleet, AGG.CONFIG).map(key);
check('PLACEHOLDER anchor does NOT emit a confirmed PREVALENCE', phOut.indexOf('fixed_support:PREVALENCE:fleet') < 0);
check('PLACEHOLDER anchor degrades to PREVALENCE_PROVISIONAL instead', phOut.indexOf('fixed_support:PREVALENCE_PROVISIONAL:fleet') >= 0);
// same fleet, but a SOURCED/validated anchor -> confirmed PREVALENCE is allowed
var srcFleet = { assets: phFleet.assets,
  expected_rates: { fixed_support: { rate: 0.20, source: 'EMPIRICAL', confidence: 'HIGH', observed_n: 40 } } };
var srcOut = AGG.aggregatePeripherals(srcFleet, AGG.CONFIG).map(key);
check('a SOURCED/validated anchor DOES emit a confirmed PREVALENCE', srcOut.indexOf('fixed_support:PREVALENCE:fleet') >= 0);

console.log('AGGREGATION GATE: ' + pass + ' / ' + total + ' passed');
if (pass !== total) { process.exit(1); }
