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

// ============================================================================
// DEPLOY425 - TEST 11 (produced-water reinjection, vibration-fatigue) + the
// anti-contamination guarantee. Prior bug: the engine emitted the canned
// "anchor drag / ovality / cathodic protection" narrative for this scenario.
// ============================================================================
var test11 = 'Offshore production platform produced water reinjection system 24-inch A106 Gr B. ' +
  'Design pressure 2,850 psi operating pressure 2,300 psi. Service produced water chlorides CO2 trace H2S. ' +
  'UT current wall 0.425 nominal 0.500 external corrosion survey. Significant vibration during high-rate injection, ' +
  'vibration increased over previous 8 months. Clamp support replaced 14 months ago. No vibration study conducted. ' +
  'Reinjection rates increased 40% last year. One pipe support is 18 inches from a branch connection. ' +
  'Support shoe has coating damage and slight metal-to-metal wear. Four years ago a nearly identical system had a ' +
  'branch connection fatigue crack resulting in produced water release. Tropical storm expected within 72 hours, ' +
  'wave height 14-18 ft. 47 open maintenance items, 9 overdue, 3 vibration-related.';
var r11 = c.detectConvergence({ transcript: test11 });

// The correct convergence is vibration-induced fatigue, NOT anchor drag.
assert(r11.primary_hypothesis && r11.primary_hypothesis.id === 'VIBRATION_INDUCED_FATIGUE',
  'TEST 11 primary = vibration-induced fatigue (got ' + (r11.primary_hypothesis && r11.primary_hypothesis.id) + ')');
assert(r11.convergence_count >= 5, 'TEST 11 strong convergence (got ' + r11.convergence_count + ')');

// ANTI-CONTAMINATION: the narrative + summary must NOT assert mechanisms that
// were never in the scenario.
var n11 = (r11.primary_hypothesis.narrative + ' ' + r11.summary).toLowerCase();
assert(n11.indexOf('anchor') < 0, 'TEST 11 must NOT mention anchor drag');
assert(n11.indexOf('ovality') < 0, 'TEST 11 must NOT mention ovality');
assert(n11.indexOf('cathodic') < 0, 'TEST 11 must NOT mention cathodic protection');

// the real converging streams are present under the primary
assert(hasStream(r11.primary_hypothesis, 'VIBRATION'), 'TEST 11 stream: vibration');
assert(hasStream(r11.primary_hypothesis, 'STRUCTURAL_INTERFACE'), 'TEST 11 stream: branch/support interface');
assert(hasStream(r11.primary_hypothesis, 'PRIOR_SIMILAR_FAILURE'), 'TEST 11 stream: prior similar failure');
assert(hasStream(r11.primary_hypothesis, 'OPERATIONAL_CHANGE'), 'TEST 11 stream: operational change');

// MECHANICAL_DISPLACEMENT must NOT fire here (no displacement / ovality signature)
var mech11 = null;
for (var mi = 0; mi < r11.hypotheses.length; mi++) {
  if (r11.hypotheses[mi].id === 'MECHANICAL_DISPLACEMENT_DRIVEN_INTEGRITY_LOSS') { mech11 = r11.hypotheses[mi]; }
}
assert(mech11 && mech11.eligible === false, 'TEST 11: mechanical-displacement hypothesis is NOT eligible (no displacement/ovality)');

// Signature gate proven: stripping vibration removes the fatigue claim entirely.
var noVib = c.detectConvergence({ transcript: test11.replace(/vibrat[a-z-]*/gi, 'noise') });
assert(!noVib.primary_hypothesis || noVib.primary_hypothesis.id !== 'VIBRATION_INDUCED_FATIGUE',
  'without the vibration signature, the fatigue hypothesis cannot fire');

console.log('DEPLOY425 anti-contamination checks passed (TEST 11 -> ' + r11.primary_hypothesis.id +
  ', ' + r11.convergence_count + ' streams, no anchor/ovality/CP contamination).');

console.log('All DEPLOY384 convergence checks passed (score ' + r.convergence_score + '/10, ' + r.convergence_count + ' independent streams converge -> ' + r.primary_hypothesis.id + ').');
