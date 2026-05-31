'use strict';
// DEPLOY392 - DIVERSITY regression lock. Guards against (a) regressing the
// robustness rebuild and (b) silently re-overfitting to the templated corpora.
// Runs the org + forecast engines over 56 DIVERSE real-world scenarios (varied
// assets/jurisdictions/phrasings) and asserts detection stays high.
var fs = require('fs'); var path = require('path');
var org = require('../netlify/functions/situational-awareness-organizational.cjs');
var fut = require('../netlify/functions/future-state-forecaster.cjs');
function assert(c, m) { if (!c) { throw new Error('FAIL: ' + m); } }

var md = fs.readFileSync(path.join(__dirname, 'fixtures', 'ndt-real-world-sa-scenarios.md'), 'utf8');
var blocks = md.split(/\nCASE\s+\d+/).slice(1);
assert(blocks.length >= 56, 'parsed >=56 diverse cases (got ' + blocks.length + ')');

var orgF = 0, futF = 0;
blocks.forEach(function (t) {
  if (org.detectOrganizationalFailures({ transcript: t }).indicators.length > 0) orgF++;
  if (fut.forecastFutureState({ remainingLifeYears: 5, nextInterventionMonths: 24, signals: { transcript: t } }).drivers.length > 0) futF++;
});

// Pre-rebuild baseline was org ~5/56, forecast ~4/56. Lock the gains with margin.
assert(orgF >= 28, 'org engine detects organizational failure in >=28/56 diverse cases (got ' + orgF + ')');
assert(futF >= 38, 'forecaster detects a future driver in >=38/56 diverse cases (got ' + futF + ')');

console.log('All DEPLOY392 diversity checks passed (org ' + orgF + '/56, forecast ' + futF + '/56; baseline was ~5 and ~4).');
