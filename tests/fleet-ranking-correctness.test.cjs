// ============================================================================
// tests/fleet-ranking-correctness.test.cjs  -  RANKING CORRECTNESS GATE
// FORGED 4D NDT  -  DEPLOY413
//
// Isolation proves the ranking is STABLE/uncontaminated. It says nothing about
// whether the order is RIGHT. This gate is the product's acceptance test: a
// deliberately dangerous asset must land at the top and a deliberately benign one
// at the bottom, with hand-labeled bands and ordering invariants. Stability != correctness.
//
// Run: node tests/fleet-ranking-correctness.test.cjs
// ============================================================================
'use strict';
var F = require('../netlify/functions/fleet-triage.cjs');

// Hand-labeled fleet: each asset has a GROUND-TRUTH band (domain judgment).
var FLEET = [
  { name: 'DANGER',       consequence_tier: 'CRITICAL', disposition: 'no_go',           governing_failure_mode: 'CRACKING',  governing_severity: 'CRITICAL', confidence_band: 'LOW', storm_exposure: true,  gt: 'IMMEDIATE' },
  { name: 'CASCADE',      consequence_tier: 'CRITICAL', disposition: 'hold_for_review',  governing_failure_mode: 'CORROSION', governing_severity: 'MODERATE', support_cascade: true,                       gt: 'IMMEDIATE' },
  { name: 'BREACH',       consequence_tier: 'HIGH',     disposition: 'hold_for_review',  governing_failure_mode: 'CORROSION', governing_severity: 'HIGH', future_state: { verdict: 'BREACH_BEFORE_NEXT_INTERVENTION', dominant_driver_label: 'trend' }, gt: 'PRIORITY' },
  { name: 'ORG',          consequence_tier: 'HIGH',     disposition: 'hold_for_review',  org_failure_score: 8, confidence_band: 'GUARDED',                                                                gt: 'PRIORITY' },
  { name: 'CRACK_HI',     consequence_tier: 'HIGH',     disposition: 'hold_for_review',  governing_failure_mode: 'CRACKING',  governing_severity: 'MODERATE',                                              gt: 'PRIORITY' },
  { name: 'CORRODE_MED',  consequence_tier: 'MEDIUM',   disposition: 'monitor',          governing_failure_mode: 'CORROSION', governing_severity: 'LOW',                                                   gt: 'ELEVATED' },
  { name: 'BENIGN',       consequence_tier: 'LOW',      disposition: 'continue_service',                                                                                                                  gt: 'ROUTINE' },
  { name: 'STORM_TWIN',   consequence_tier: 'HIGH',     disposition: 'hold_for_review',  storm_exposure: true,                                                                                            gt: 'PRIORITY' },
  { name: 'NOSTORM_TWIN', consequence_tier: 'HIGH',     disposition: 'hold_for_review',                                                                                                                   gt: 'PRIORITY' },
  { name: 'LEAK_LOW',     consequence_tier: 'LOW',      disposition: 'no_go', active_failure: true,                                                                                                       gt: 'IMMEDIATE' }
];

var ranked = F.rankFleet({ assets: FLEET }).ranked;
function rk(n) { for (var i = 0; i < ranked.length; i++) { if (ranked[i].name === n) { return ranked[i].urgency_rank; } } return -1; }
function bnd(n) { for (var i = 0; i < ranked.length; i++) { if (ranked[i].name === n) { return ranked[i].urgency_band; } } return '?'; }
function tierOf(n) { for (var i = 0; i < FLEET.length; i++) { if (FLEET[i].name === n) { return String(FLEET[i].consequence_tier).toUpperCase(); } } return '?'; }

var pass = 0, total = 0;
function check(name, cond) { total++; if (cond) { pass++; console.log('PASS ' + name); } else { console.log('FAIL ' + name); } }

// 1) Hand-labeled band correctness
for (var i = 0; i < FLEET.length; i++) { check('band[' + FLEET[i].name + '] == ' + FLEET[i].gt + ' (got ' + bnd(FLEET[i].name) + ')', bnd(FLEET[i].name) === FLEET[i].gt); }

// 2) The core acceptance test: dangerous at top, benign at bottom
check('most-dangerous asset (DANGER) ranks #1', rk('DANGER') === 1);
check('most-benign asset (BENIGN) ranks last', rk('BENIGN') === ranked.length);

// 3) Ordering invariants
check('storm-exposed outranks identical no-storm twin', rk('STORM_TWIN') < rk('NOSTORM_TWIN'));
check('breach-before-intervention outranks a stable held HIGH (CRACK_HI)', rk('BREACH') < rk('CRACK_HI'));
// Among NON-active-failure assets, the consequence tier chain holds (a clean tier
// ladder). NOTE: global consequence-monotonicity is NOT a universal invariant - an
// active failure (LEAK_LOW) legitimately outranks higher-consequence not-yet-failed
// assets by urgency CLASS, so it is excluded from this ladder check.
check('tier ladder (non-failure): CASCADE(CRIT) > CRACK_HI(HIGH) > CORRODE_MED(MED) > BENIGN(LOW)',
  rk('CASCADE') < rk('CRACK_HI') && rk('CRACK_HI') < rk('CORRODE_MED') && rk('CORRODE_MED') < rk('BENIGN'));
// Active-failure floor: a confirmed active leak is IMMEDIATE-class regardless of its
// LOW consequence (the uncontested half of the A8-vs-A3 decision).
check('active-failure asset (LEAK_LOW) band == IMMEDIATE despite LOW consequence', bnd('LEAK_LOW') === 'IMMEDIATE');
check('active-failure asset is never ACCEPTABLE/ROUTINE', bnd('LEAK_LOW') !== 'ROUTINE');

console.log('RANKING CORRECTNESS GATE: ' + pass + ' / ' + total + ' passed');
if (pass !== total) { process.exit(1); }
