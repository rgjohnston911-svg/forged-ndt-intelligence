'use strict';
var b = require('../netlify/functions/situational-awareness-survival-bridge.cjs');
function assert(c, m) { if (!c) { throw new Error('FAIL: ' + m); } }
function approx(a, x, tol) { return Math.abs(a - x) <= (tol || 0.02); }

var p1 = b.lognormalFailureProb(1, 5, 0.5);
var p5 = b.lognormalFailureProb(5, 5, 0.5);
var p10 = b.lognormalFailureProb(10, 5, 0.5);
assert(p1 >= 0 && p10 <= 1, 'probabilities in [0,1]');
assert(p1 < p5 && p5 < p10, 'CDF increases with horizon');
assert(p5 > 0.5 && p5 < 0.7, 'P(t=mean) > 0.5 for right-skewed lognormal (got ' + p5.toFixed(3) + ')');
assert(b.lognormalFailureProb(1, 0, 0.5) === 0, 'no mean -> 0');

assert(b.bandToModel('HIGH').cov < b.bandToModel('LOW').cov, 'HIGH tighter than LOW');
assert(b.bandToModel('INSUFFICIENT_DATA').conf === 0, 'insufficient -> no confidence');

assert(b.extractGoverning({ progression_state: 'insufficient_data', governing_time_years: 5 }) === null, 'insufficient -> null');
assert(b.extractGoverning({ progression_state: 'dormant_possible', governing_time_years: 5 }) === null, 'dormant -> null');
assert(b.extractGoverning({ progression_state: 'active_likely', governing_time_years: 0 }) === null, 'no time -> null');
var g = b.extractGoverning({ progression_state: 'active_likely', governing_time_years: 4, corrosion_timeline: { confidence: 'MODERATE' } });
assert(g && g.mean === 4 && g.band === 'MODERATE', 'extracts mean + band');

var empty = b.buildProbabilityBasis({ progression_state: 'insufficient_data', governing_time_years: null }, {});
assert(Object.keys(empty.byOption).length === 0, 'insufficient -> empty byOption');

var ft = { progression_state: 'active_likely', governing_time_years: 4, corrosion_timeline: { confidence: 'MODERATE' }, crack_timeline: { confidence: 'none' } };
var pkg = { consequence: { tier: 'HIGH' } };
var basis = b.buildProbabilityBasis(ft, pkg);
assert(basis.byOption.CONTINUE, 'CONTINUE present');
assert(basis.byOption.SHUTDOWN, 'SHUTDOWN present');
assert(!basis.byOption.DERATE && !basis.byOption.MORE_DATA, 'DERATE/MORE_DATA omitted');
assert(typeof basis.byOption.CONTINUE.confidence === 'number' && basis.byOption.CONTINUE.confidence > 0, 'CONTINUE numeric confidence');

var sum = 0;
for (var i = 0; i < basis.byOption.CONTINUE.outcomes.length; i++) { sum += basis.byOption.CONTINUE.outcomes[i].probability; }
assert(approx(sum, 1.0, 0.01), 'CONTINUE outcomes partition to ~1.0 (got ' + sum.toFixed(3) + ')');
for (var j = 0; j < basis.byOption.CONTINUE.outcomes.length; j++) { var p = basis.byOption.CONTINUE.outcomes[j].probability; assert(p >= 0 && p <= 1, 'prob in [0,1]'); }
assert(basis.byOption.CONTINUE.expected_value.regulatory === 'HIGH', 'expected_value.regulatory = tier');
assert(basis.byOption.CONTINUE.expected_value.financial === 'UNQUANTIFIED', 'financial unquantified');

var s1 = JSON.stringify(b.buildProbabilityBasis(ft, pkg));
var s2 = JSON.stringify(b.buildProbabilityBasis(ft, pkg));
assert(s1 === s2, 'deterministic');

var cs = require('../netlify/functions/situational-awareness-consequence.cjs');
var matrix = { options: ['CONTINUE', 'SHUTDOWN', 'MORE_DATA'] };
var scenarios = cs.buildConsequenceScenarios(pkg, matrix, null, basis);
function byOpt(list, o) { for (var i = 0; i < list.length; i++) { if (list[i].option === o) { return list[i]; } } return null; }
var contSc = byOpt(scenarios, 'CONTINUE');
assert(contSc.confidence > 0 && contSc.probability_weighted_outcomes.length === 4, 'simulator emits real CONTINUE scenario');
var mdSc = byOpt(scenarios, 'MORE_DATA');
assert(mdSc.confidence === 0 && mdSc.probability_weighted_outcomes.length === 0, 'MORE_DATA stays confidence:0');

console.log('All DEPLOY382 survival-bridge checks passed (real scenarios from L4 remaining-life; insufficient-data -> confidence:0).');
