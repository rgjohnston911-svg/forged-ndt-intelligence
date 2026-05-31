'use strict';
var c = require('../netlify/functions/situational-awareness-convergence.cjs');
function assert(cond, m) { if (!cond) { throw new Error('FAIL: ' + m); } }
function hasStream(hyp, id) {
  if (!hyp) { return null; }
  for (var i = 0; i < hyp.supporting_streams.length; i++) {
    if (hyp.supporting_streams[i].id === id) { return hyp.supporting_streams[i]; }
  }
  return null;
}

// Clean / isolated narrative -> no convergence
var clean = c.detectConvergence({ transcript: 'Routine UT survey. Wall thickness nominal. Nothing else of note.' });
assert(clean.convergence_count < 2, 'single stream -> no convergence');
assert(clean.convergence_score === 0, 'no convergence -> score 0');

// Real Test-1 subsea pipeline scenario
var scenario = 'ROV survey at KP 14.7. External coating damage, coating disbondment, marine growth, ' +
  'evidence of external corrosion. ACFM indication. UT scanner remaining wall 0.318 in, wall loss 36.4%. ' +
  'Geometry scan shows pipeline ovality 7.8% exceeds design limit of 3%. ' +
  'Three weeks earlier the platform experienced an anchor drag event and a supply vessel lost position in a storm. ' +
  'ROV pilot notes the pipe looked slightly displaced compared to last year. ' +
  'Cathodic protection survey overdue by 19 months. Anode consumption significantly higher than predicted. ' +
  'Sour crude, produced water, CO2 present. Flow rate increased 27% over last 8 months.';
var r = c.detectConvergence({ transcript: scenario });

var primary = r.primary_hypothesis;
assert(primary && primary.id === 'MECHANICAL_DISPLACEMENT_DRIVEN_INTEGRITY_LOSS', 'primary = mechanical displacement hypothesis (got ' + (primary && primary.id) + ')');

// All five+ independent streams the eval named should be present under the primary
assert(hasStream(primary, 'INCIDENT_HISTORY'), 'stream: anchor drag / incident history');
assert(hasStream(primary, 'VISUAL_DISPLACEMENT'), 'stream: ROV visual displacement');
assert(hasStream(primary, 'GEOMETRY_OVALITY'), 'stream: geometry ovality');
assert(hasStream(primary, 'COATING_DAMAGE'), 'stream: coating damage');
assert(hasStream(primary, 'CP_DEGRADATION'), 'stream: CP degradation');
assert(hasStream(primary, 'WALL_LOSS'), 'stream: wall loss / corrosion');

assert(r.convergence_count >= 5, 'at least five independent converging streams (got ' + r.convergence_count + ')');
assert(r.convergence_score >= 9, 'high convergence score (got ' + r.convergence_score + ')');
assert(r.convergence_score <= 10, 'score capped at 10');

// each supporting stream carries an independent source label + evidence snippet
for (var i = 0; i < primary.supporting_streams.length; i++) {
  assert(typeof primary.supporting_streams[i].source === 'string' && primary.supporting_streams[i].source.length > 0, 'stream has source');
  assert(typeof primary.supporting_streams[i].evidence === 'string', 'stream has evidence snippet');
}

// independence: sources are distinct
var seen = {};
for (var j = 0; j < primary.supporting_streams.length; j++) {
  var src = primary.supporting_streams[j].id;
  assert(!seen[src], 'stream ids are distinct (independent)');
  seen[src] = true;
}

// secondary hypothesis (internal corrosion) is also evaluated and present in the list
var foundInternal = false;
for (var k = 0; k < r.hypotheses.length; k++) {
  if (r.hypotheses[k].id === 'INTERNAL_CORROSION_PROGRESSION') { foundInternal = true; }
}
assert(foundInternal, 'internal-corrosion hypothesis is evaluated too');

// summary names the count and the narrative
assert(r.summary.indexOf(String(r.convergence_count)) >= 0, 'summary states stream count');
assert(r.summary.toLowerCase().indexOf('converge') >= 0, 'summary mentions convergence');

// determinism
assert(JSON.stringify(c.detectConvergence({ transcript: scenario })) === JSON.stringify(r), 'deterministic');

// null-safe
var bare = c.detectConvergence(null);
assert(bare.convergence_count === 0 && bare.convergence_score === 0, 'null signals -> safe empty');

// extraText corpus also scanned
var viaExtra = c.detectConvergence({ transcript: '', extraText: ['anchor drag event', 'pipe looked displaced', 'ovality exceeds design limit'] });
assert(viaExtra.convergence_count >= 3, 'scans extraText corpus too (got ' + viaExtra.convergence_count + ')');

console.log('All DEPLOY384 convergence checks passed (score ' + r.convergence_score + '/10, ' + r.convergence_count + ' independent streams converge -> ' + r.primary_hypothesis.id + ').');
