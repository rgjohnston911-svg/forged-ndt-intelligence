// ============================================================================
// tests/fleet-isolation.test.cjs  -  SCENARIO ISOLATION GATE
// FORGED 4D NDT  -  DEPLOY405/412
//
// Batch features fail SILENTLY on shared-state bleed: no 500, just one asset's
// assessment quietly contaminated by another's. This gate asserts the invariant:
// a scenario scored SOLO must produce byte-identical output to the same scenario
// scored INSIDE a fleet (rank order excluded, by design).
//
// Covers the requireable deterministic engines (fleet-triage ranking + peripheral
// referral). The full per-asset pipeline incl. decision-core is verified by the
// offline isolation harness (forward-vs-reverse over 50 scenarios: 50/50).
//
// Run: node tests/fleet-isolation.test.cjs
// ============================================================================
'use strict';
var assert = require('assert');
var fleet = require('../netlify/functions/fleet-triage.cjs');
var per = require('../netlify/functions/peripheral-referral.cjs');

var pass = 0, total = 0;
function check(name, cond) { total++; if (cond) { pass++; console.log('PASS ' + name); } else { console.log('FAIL ' + name); } }

// --- A. fleet-triage ranking isolation: solo == in-fleet (score/band/drivers/action) ---
var fleetAssets = [
  { name: 'A', consequence_tier: 'CRITICAL', disposition: 'hold_for_review', governing_failure_mode: 'CRACKING', governing_severity: 'HIGH', storm_exposure: true },
  { name: 'B', consequence_tier: 'HIGH', disposition: 'hold_for_review', governing_failure_mode: 'CORROSION', governing_severity: 'MODERATE', support_cascade: true },
  { name: 'C', consequence_tier: 'MEDIUM', disposition: 'monitor', governing_failure_mode: 'CORROSION', governing_severity: 'LOW' },
  { name: 'D', consequence_tier: 'HIGH', disposition: 'hold_for_review', org_failure_score: 7.5, confidence_band: 'GUARDED' },
  { name: 'E', consequence_tier: 'CRITICAL', disposition: 'no_go', governing_failure_mode: 'STRUCTURAL_INSTABILITY', governing_severity: 'CRITICAL' }
];
function pick(name, ranked) { for (var i = 0; i < ranked.length; i++) { if (ranked[i].name === name) { return ranked[i]; } } return null; }
function essence(r) { return JSON.stringify({ s: r.urgency_score, b: r.urgency_band, d: r.drivers, a: r.recommended_action }); }

var full = fleet.rankFleet({ assets: fleetAssets }).ranked;
for (var i = 0; i < fleetAssets.length; i++) {
  var solo = fleet.rankFleet({ assets: [fleetAssets[i]] }).ranked[0];
  var inf = pick(fleetAssets[i].name, full);
  check('ranking isolation: ' + fleetAssets[i].name + ' solo == in-fleet', essence(solo) === essence(inf));
}

// --- B. rankFleet must not mutate caller input (re-run determinism) ---
var beforeJson = JSON.stringify(fleetAssets);
fleet.rankFleet({ assets: fleetAssets });
check('rankFleet does not mutate caller input array', JSON.stringify(fleetAssets) === beforeJson);
var r1 = JSON.stringify(fleet.rankFleet({ assets: fleetAssets }).ranked);
var r2 = JSON.stringify(fleet.rankFleet({ assets: fleetAssets }).ranked);
check('rankFleet is deterministic across repeated calls', r1 === r2);

// --- C. peripheral extract+score isolation: X alone == X after 11 others ---
var transcripts = [
  'the pipe support beneath the toxic line is badly corroded.',
  'foundation settlement observed beneath the vessel.',
  'wet insulation; possible cui under the cladding.',
  'an undocumented temporary clamp on the adjacent line.',
  'standing water pooling at the base.',
  'corroded cable tray nearby, no connection.',
  'spring hanger seized at the rack.',
  'the axial anchor has failed.',
  'pipe guide shows corrosion.',
  'coating chip on an unrelated line.',
  'foundation grout cracked.'
];
var target = 'the pipe support beneath the toxic line is badly corroded.';
function perEssence(t) { return JSON.stringify(per.scoreReferrals(per.extractPeripheralsFromText(t, 'CRITICAL')).referrals); }
var soloP = perEssence(target);
for (var j = 0; j < transcripts.length; j++) { perEssence(transcripts[j]); } // run a batch in between
var afterP = perEssence(target);
check('peripheral isolation: target == target after a batch of 11 others', soloP === afterP);

// scorePeripheral on a fresh ref does not leak into a second fresh ref
var refA = per.buildRef({ type: 'fixed_support', link_type: 'LOAD_PATH', coupling: 0.85, consequence: 'CRITICAL' });
var refB = per.buildRef({ type: 'fixed_support', link_type: 'LOAD_PATH', coupling: 0.85, consequence: 'CRITICAL' });
per.scorePeripheral(refA);
var bBefore = JSON.stringify(refB);
per.scorePeripheral(refB);
check('peripheral scoring of one ref does not contaminate another', JSON.stringify(per.scorePeripheral(per.buildRef({ type: 'fixed_support', link_type: 'LOAD_PATH', coupling: 0.85, consequence: 'CRITICAL' })).routing.action) === '"REFER"');

// --- D. ADVERSARIAL STATE-POISONERS (closes the 'corpus can't trip the failure mode'
// gap): run a deliberately extreme/garbage asset BETWEEN two runs of a normal target;
// if anything writes shared module state, the target's result changes. ---
var POISON = { name: 'POISON', consequence_tier: 'CRITICAL', disposition: 'no_go',
  governing_failure_mode: 'X'.repeat(5000), governing_severity: 'CRITICAL', org_failure_score: 999999,
  support_cascade: true, storm_exposure: true, confidence_band: 'LOW',
  future_state: { verdict: 'BREACH_BEFORE_NEXT_INTERVENTION', dominant_driver_label: '\u0000\uffff weird' } };
var TGT = { name: 'TGT', consequence_tier: 'HIGH', disposition: 'hold_for_review', governing_failure_mode: 'CORROSION', governing_severity: 'MODERATE' };
var soloTgt = essence(pick('TGT', fleet.rankFleet({ assets: [TGT] }).ranked));
var poisonedRanked = fleet.rankFleet({ assets: [TGT, POISON, JSON.parse(JSON.stringify(TGT))] }).ranked;
var tgtAfterPoison = essence(pick('TGT', poisonedRanked));
check('ranking: TGT unchanged when an extreme POISON asset is ranked alongside it', soloTgt === tgtAfterPoison);
// peripheral: extreme transcript (huge, repeated keywords, control chars) between target runs
var poisonText = ('pipe support corroded ' + 'standing water cable tray foundation settlement '.repeat(2000) + '\u0000\uffff').toString();
var soloPer2 = perEssence(target);
per.scoreReferrals(per.extractPeripheralsFromText(poisonText, 'CRITICAL'));
var afterPoisonPer = perEssence(target);
check('peripheral: target unchanged after an extreme/garbage poison transcript', soloPer2 === afterPoisonPer);

console.log('FLEET ISOLATION GATE: ' + pass + ' / ' + total + ' passed');
if (pass !== total) { process.exit(1); }
