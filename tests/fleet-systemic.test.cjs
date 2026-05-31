'use strict';
// fleet-systemic composition gate (DEPLOY416): transcript -> flags -> aggregation.
var SYS = require('../netlify/functions/fleet-systemic.cjs');
var pass = 0, total = 0;
function check(n, c) { total++; if (c) { pass++; console.log('PASS ' + n); } else { console.log('FAIL ' + n); } }

// per-asset: a corroded support transcript yields a fixed_support flag
check('buildAssetFlags: corroded support -> fixed_support', SYS.buildAssetFlags({ transcript: 'the pipe support is badly corroded', consequence_tier: 'HIGH' }).indexOf('fixed_support') >= 0);
check('buildAssetFlags: clean support -> no flag', SYS.buildAssetFlags({ transcript: 'the pipe support is in good condition', consequence_tier: 'HIGH' }).length === 0);
check('buildAssetFlags: negated -> no flag', SYS.buildAssetFlags({ transcript: 'no corrosion on the pipe support', consequence_tier: 'HIGH' }).length === 0);

// fleet CLUSTER: a cohort of corroded supports vs a clean rest-of-fleet
function corr(id, cohort) { return { id: id, cohort: cohort, transcript: 'the pipe support is badly corroded', consequence_tier: 'HIGH' }; }
function clean(id, cohort) { return { id: id, cohort: cohort, transcript: 'asset inspected, wall thickness acceptable', consequence_tier: 'MEDIUM' }; }
var fleet = { assets: [
  corr('a1','batch_1998'), corr('a2','batch_1998'), corr('a3','batch_1998'), corr('a4','batch_1998'),
  clean('a5','batch_2015'), clean('a6','batch_2015'), clean('a7','batch_2015'), clean('a8','batch_2015'),
  clean('a9','batch_2015'), clean('a10','batch_2015') ] };
var out = SYS.computeSystemic(fleet);
var sig = out.systemic_findings.map(function (f) { return f.actor + ':' + f.signal + ':' + f.cohort; });
check('computeSystemic: cohort of corroded supports -> CLUSTER', sig.indexOf('fixed_support:CLUSTER:batch_1998') >= 0);
check('computeSystemic: clean cohort does not fire', sig.join(',').indexOf('batch_2015') < 0);
check('computeSystemic: never dispositions/re-ranks (findings carry no urgency)', out.systemic_findings.every(function (f) { return !('urgency_band' in f) && !('disposition' in f); }));

// a clean fleet -> silent
var allClean = { assets: [clean('b1','u'), clean('b2','u'), clean('b3','u'), clean('b4','u'), clean('b5','u')] };
check('computeSystemic: clean fleet is silent', SYS.computeSystemic(allClean).systemic_findings.length === 0);

console.log('FLEET-SYSTEMIC GATE: ' + pass + ' / ' + total + ' passed');
if (pass !== total) { process.exit(1); }
