'use strict';
// DEPLOY391 - Future-State Forecaster. Unit logic + 150-case digital-twin corpus.
var f = require('../netlify/functions/future-state-forecaster.cjs');
var fs = require('fs'); var path = require('path');
function assert(c, m) { if (!c) { throw new Error('FAIL: ' + m); } }

// --- Verdict logic (synthetic numeric inputs) ---
// Accelerating + production increase shorten a 3yr life; turnaround at 30 mo -> breach.
var r1 = f.forecastFutureState({ remainingLifeYears: 3, nextInterventionMonths: 30,
  signals: { transcript: 'Accelerated degradation. Production increase planned. Turnaround in 30 months.' } });
assert(r1.base_life_months === 36, 'base life 36 mo');
assert(r1.combined_rate_multiplier === 1.8, '1.5 (accel) * 1.2 (prod) = 1.8 (got ' + r1.combined_rate_multiplier + ')');
assert(Math.abs(r1.adjusted_life_months - 20) < 0.6, 'adjusted ~20 mo (36/1.8) (got ' + r1.adjusted_life_months + ')');
assert(r1.verdict === 'BREACH_BEFORE_NEXT_INTERVENTION', 'breach: 20mo < 30mo (got ' + r1.verdict + ')');
assert(r1.dominant_driver && r1.dominant_driver.id === 'TREND_ACCELERATION', 'dominant driver = acceleration');

// Stable asset, intervention soon -> acceptable through.
var r2 = f.forecastFutureState({ remainingLifeYears: 8, nextInterventionMonths: 24, signals: { transcript: 'Stable trend. Normal operation.' } });
assert(r2.verdict === 'ACCEPTABLE_THROUGH_NEXT_INTERVENTION', '8yr life, 24mo intervention -> acceptable (got ' + r2.verdict + ')');
assert(r2.combined_rate_multiplier === 1, 'no drivers -> multiplier 1');

// Deferred turnaround, no explicit new date -> timing unknown verdict.
var r3 = f.forecastFutureState({ remainingLifeYears: 2, signals: { transcript: 'Turnaround delayed. Degradation increasing.' } });
assert(r3.verdict === 'INTERVENTION_DEFERRED_TIMING_UNKNOWN', 'deferred + no date -> deferred-unknown (got ' + r3.verdict + ')');

// No quantified life -> qualitative-only but still flags drivers.
var r4 = f.forecastFutureState({ signals: { transcript: 'Production increase planned. Turnaround delayed. Storm risk within 30 days.' } });
assert(r4.verdict === 'QUALITATIVE_ONLY', 'no life -> qualitative (got ' + r4.verdict + ')');
assert(r4.drivers.length >= 3, 'qualitative still detects drivers (got ' + r4.drivers.length + ')');

// parse explicit interval
assert(f.parseNextInterventionMonths('next turnaround in 18 months') === 18, 'parse 18 months');
assert(f.parseNextInterventionMonths('outage scheduled in 2 years') === 24, 'parse 2 years -> 24');

// --- Corpus: driver detection across the 150 digital-twin cases ---
var md = fs.readFileSync(path.join(__dirname, 'fixtures', 'ndt-digital-twin-150-case-battery.md'), 'utf8');
var blocks = md.split(/\nCASE\s+\d+/).slice(1);
assert(blocks.length >= 100, 'parsed digital-twin cases (got ' + blocks.length + ')');
var anyDriver = 0, prod = 0, defer = 0, accel = 0;
blocks.forEach(function (b) {
  var r = f.forecastFutureState({ remainingLifeYears: 4, nextInterventionMonths: 24, signals: { transcript: b } });
  if (r.drivers.length > 0) anyDriver++;
  for (var i = 0; i < r.drivers.length; i++) {
    if (r.drivers[i].id === 'PRODUCTION_INCREASE') prod++;
    if (r.drivers[i].id === 'DEFERRED_INTERVENTION') defer++;
    if (r.drivers[i].id === 'TREND_ACCELERATION') accel++;
  }
});
assert(anyDriver >= blocks.length * 0.8, 'forecast drivers detected in >=80% of corpus cases (got ' + anyDriver + '/' + blocks.length + ')');

console.log('All DEPLOY391 future-state checks passed. Corpus: ' + blocks.length + ' cases, drivers in ' + anyDriver +
  ' (production=' + prod + ', deferred=' + defer + ', acceleration=' + accel + ').');
