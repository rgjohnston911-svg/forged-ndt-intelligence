// ============================================================================
// tests/peripheral-extractor.test.cjs  -  EXTRACTOR ACCEPTANCE GATE
// FORGED 4D NDT  -  DEPLOY412
//
// The scorer's 9/9 proves ROUTING given clean inputs. This suite proves the
// EXTRACTOR produces clean inputs: raw scenario text in, expected structured ref
// out - asserting it (a) picked the right ACTOR TYPE and (b) pulled the right
// CATALOG coupling (the structural property, NOT a hand-tuned number) and
// link_type, and (c) routed correctly given the INHERITED primary consequence.
//
// Run: node tests/peripheral-extractor.test.cjs   (git-ignored, run locally)
// ============================================================================
'use strict';
var P = require('../netlify/functions/peripheral-referral.cjs');
var CAT = P.COUPLING_CATALOG;

// Each case: text + inherited primary tier -> expect actor, coupling, link, routing.
// coupling expectations are catalog_base (+/- 0.08 extent) ROUNDED to 2 dp.
var CASES = [
  { name: '1 fixed support corroded (plain), CRITICAL', text: 'the pipe support beneath the line is corroded.', tier: 'CRITICAL',
    actor: 'fixed_support', coupling: 0.85, link: 'LOAD_PATH', route: 'REFER' },
  { name: '2 fixed support BADLY corroded (+extent), CRITICAL', text: 'the pipe support is badly corroded.', tier: 'CRITICAL',
    actor: 'fixed_support', coupling: 0.93, link: 'LOAD_PATH', route: 'REFER' },
  { name: '3 fixed support SLIGHT corrosion (-extent), HIGH', text: 'the pipe support shows slight surface corrosion.', tier: 'HIGH',
    actor: 'fixed_support', coupling: 0.77, link: 'LOAD_PATH', route: 'REFER' },
  { name: '4 spring hanger seized (+extent), HIGH', text: 'the spring hanger appears seized at the rack.', tier: 'HIGH',
    actor: 'spring_hanger', coupling: 0.78, link: 'LOAD_PATH', route: 'REFER' },
  { name: '5 CALIBRATION: guide corrosion, MEDIUM -> NOTE (LOAD_PATH floor; 0.60*0.4=0.24 < note, but load-path never silently drops)', text: 'the pipe guide shows corrosion.', tier: 'MEDIUM',
    actor: 'guide', coupling: 0.60, link: 'LOAD_PATH', route: 'NOTE' },
  { name: '5b CALIBRATION: fixed support corroded, MEDIUM -> NOTE (knife-edge 0.85*0.4=0.34 floored to NOTE, not silently suppressed)', text: 'the pipe support shows corrosion.', tier: 'MEDIUM',
    actor: 'fixed_support', coupling: 0.85, link: 'LOAD_PATH', route: 'NOTE' },
  { name: '5c CALIBRATION: foundation (CONSEQUENCE) corroded, MEDIUM -> SUPPRESS (non-load-path stays plausibility-gated)', text: 'foundation grout shows corrosion at the base.', tier: 'MEDIUM',
    actor: 'foundation', coupling: 0.60, link: 'CONSEQUENCE', route: 'SUPPRESS' },
  { name: '6 same guide but HIGH consequence -> REFER (consequence carries it)', text: 'the pipe guide is corroded.', tier: 'HIGH',
    actor: 'guide', coupling: 0.60, link: 'LOAD_PATH', route: 'REFER' },
  { name: '7 axial anchor failed (+extent), HIGH', text: 'the axial anchor has failed, allowing thermal growth.', tier: 'HIGH',
    actor: 'anchor', coupling: 0.98, link: 'LOAD_PATH', route: 'REFER' },
  { name: '8 foundation settlement under vessel, CRITICAL', text: 'foundation settlement observed beneath the vessel.', tier: 'CRITICAL',
    actor: 'foundation', coupling: 0.60, link: 'CONSEQUENCE', route: 'REFER' },
  { name: '9 cable tray heavily corroded, CRITICAL -> SUPPRESS (catalog NONE link)', text: 'a heavily corroded cable tray nearby.', tier: 'CRITICAL',
    actor: 'cable_tray', coupling: 0.13, link: 'NONE', route: 'SUPPRESS' },
  { name: '10 ENV: standing water at base, MEDIUM -> SUPPRESS (0.45*0.4=0.18)', text: 'standing water pooling at the support base.', tier: 'MEDIUM',
    actor: 'drainage', coupling: 0.45, link: 'ENVIRONMENTAL', route: 'SUPPRESS' },
  { name: '11 ENV: same standing water but HIGH -> REFER (consequence carries it)', text: 'standing water pooling at the support base.', tier: 'HIGH',
    actor: 'drainage', coupling: 0.45, link: 'ENVIRONMENTAL', route: 'REFER' },
  { name: '12 temp clamp undocumented, HIGH', text: 'an undocumented temporary clamp on the line.', tier: 'HIGH',
    actor: 'temp_repair', coupling: 0.40, link: 'CONSEQUENCE', route: 'REFER' },
  { name: '13 wet insulation (CUI), HIGH', text: 'wet insulation observed; possible CUI under the cladding.', tier: 'HIGH',
    actor: 'insulation', coupling: 0.70, link: 'ENVIRONMENTAL', route: 'REFER' },
  { name: '14 disconnection: adjacent line corroded but UNRELATED -> NONE/SUPPRESS', text: 'corroded adjacent line, unrelated separate system.', tier: 'CRITICAL',
    actor: 'adjacent_equip', coupling: 0.50, link: 'NONE', route: 'SUPPRESS' }
];

var NO_REF = [
  { name: 'A clean support in good condition -> NO referral', text: 'pipe support in good condition, recently painted.', tier: 'HIGH' },
  { name: 'B clean foundation, no finding -> NO referral', text: 'foundation inspected, no issues noted.', tier: 'CRITICAL' }
];

var pass = 0, total = 0, fails = [];

function approx(a, b) { return Math.abs(a - b) < 0.001; }

console.log('EXTRACTOR ACCEPTANCE GATE');
console.log(new Array(96).join('-'));
for (var i = 0; i < CASES.length; i++) {
  var c = CASES[i]; total++;
  var refs = P.extractPeripheralsFromText(c.text, c.tier);
  var scored = P.scoreReferrals(refs).referrals;
  // find the referral for the expected actor
  var r = null;
  for (var j = 0; j < scored.length; j++) { if (scored[j].secondary_asset.type === c.actor) { r = scored[j]; break; } }
  var ok = false, why = '';
  if (!r) { why = 'actor ' + c.actor + ' not extracted (got: ' + scored.map(function(x){return x.secondary_asset.type;}).join(',') + ')'; }
  else if (!approx(r.link_to_primary.coupling_strength, c.coupling)) { why = 'coupling ' + r.link_to_primary.coupling_strength + ' != catalog ' + c.coupling; }
  else if (r.link_to_primary.link_type !== c.link) { why = 'link ' + r.link_to_primary.link_type + ' != ' + c.link; }
  else if (r.routing.action !== c.route) { why = 'route ' + r.routing.action + ' != ' + c.route; }
  else { ok = true; }
  if (ok) { pass++; } else { fails.push(c.name + ' :: ' + why); }
  console.log((ok ? 'PASS ' : 'FAIL ') + c.name + (ok ? '' : '  [' + why + ']'));
}
for (var k = 0; k < NO_REF.length; k++) {
  var n = NO_REF[k]; total++;
  var refs2 = P.extractPeripheralsFromText(n.text, n.tier);
  var ok2 = (refs2.length === 0);
  if (ok2) { pass++; } else { fails.push(n.name + ' :: expected 0 referrals, got ' + refs2.length); }
  console.log((ok2 ? 'PASS ' : 'FAIL ') + n.name + (ok2 ? '' : '  [got ' + refs2.length + ']'));
}
console.log(new Array(96).join('-'));
console.log('EXTRACTOR GATE: ' + pass + ' / ' + total + ' passed');
if (pass !== total) { console.log('FAILURES:\n  ' + fails.join('\n  ')); process.exit(1); }
