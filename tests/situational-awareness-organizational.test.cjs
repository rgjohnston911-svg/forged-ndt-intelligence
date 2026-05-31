'use strict';
var o = require('../netlify/functions/situational-awareness-organizational.cjs');
function assert(c, m) { if (!c) { throw new Error('FAIL: ' + m); } }
function hasInd(r, id) { for (var i = 0; i < r.indicators.length; i++) { if (r.indicators[i].id === id) { return r.indicators[i]; } } return null; }

// Clean narrative -> no indicators, score 0
var clean = o.detectOrganizationalFailures({ transcript: '24 inch pipe, UT readings nominal, inspection current, all reports filed.' });
assert(clean.indicators.length === 0 && clean.organizational_failure_score === 0, 'clean narrative -> 0');

// Real Test-1 scenario
var scenario = 'ROV survey. No damage report filed. Observation never entered into integrity database. ' +
  'Cathodic protection survey overdue by 19 months. Anode consumption significantly higher than predicted. ' +
  'No root cause investigation initiated. Operations manager states this is just coating damage. ' +
  'Project manager states shutdown cannot happen before hurricane season ends.';
var r = o.detectOrganizationalFailures({ transcript: scenario });

assert(hasInd(r, 'UNREPORTED_EVENT'), 'detects unreported event');
assert(hasInd(r, 'UNREPORTED_EVENT').severity === 'CRITICAL', 'unreported event is CRITICAL');
assert(hasInd(r, 'LOST_OBSERVATION'), 'detects lost observation');
assert(hasInd(r, 'MISSED_INSPECTION'), 'detects missed/overdue inspection');
assert(hasInd(r, 'NO_ROOT_CAUSE'), 'detects no RCA');
assert(hasInd(r, 'DEGRADATION_IGNORED'), 'detects ignored degradation');
assert(hasInd(r, 'SCHEDULE_PRESSURE_OVERRIDE'), 'detects schedule pressure');
assert(hasInd(r, 'NORMALIZED_DEVIATION'), 'detects complacency (just coating)');
assert(r.organizational_failure_score >= 8, 'high org-failure score (got ' + r.organizational_failure_score + ')');
assert(r.organizational_failure_score <= 10, 'score capped at 10');

// each indicator carries category + evidence snippet
for (var i = 0; i < r.indicators.length; i++) {
  assert(typeof r.indicators[i].category === 'string' && r.indicators[i].category.length > 0, 'indicator has category');
  assert(typeof r.indicators[i].evidence === 'string', 'indicator has evidence snippet');
}

// determinism
assert(JSON.stringify(o.detectOrganizationalFailures({ transcript: scenario })) === JSON.stringify(r), 'deterministic');

// null-safe
var bare = o.detectOrganizationalFailures(null);
assert(bare.indicators.length === 0 && bare.organizational_failure_score === 0, 'null signals -> safe empty');

// extraText corpus also scanned
var viaExtra = o.detectOrganizationalFailures({ transcript: '', extraText: ['No root cause investigation initiated.'] });
assert(hasInd(viaExtra, 'NO_ROOT_CAUSE'), 'scans extraText corpus too');

console.log('All DEPLOY383 organizational-failure checks passed (score ' + r.organizational_failure_score + '/10, ' + r.indicators.length + ' indicators on the Test-1 scenario).');
