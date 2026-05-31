'use strict';
// DEPLOY393 - locks the classifier disambiguation fixes found by the diverse
// real-world scenarios (unambiguous domain-defining override).
var c = require('../netlify/functions/domain-classifier.cjs');
function assert(cond, m) { if (!cond) { throw new Error('FAIL: ' + m); } }
function eq(name, txt, exp) { var d = c.classifyDomain(txt).domain; assert(d === exp, name + ' -> ' + d + ' (want ' + exp + ')'); }

// The three bugs the real-world set proved + regressions
eq('FPSO not bridge', 'Brazil deepwater FPSO turret mooring bearing assembly vibration', 'offshore_oil_gas');
eq('wind not offshore', 'North Sea offshore wind farm monopile foundation coating damage section loss', 'wind_energy');
eq('nuclear not unknown', 'France nuclear station feedwater system UT wall thinning FAC suspected', 'nuclear');
eq('aircraft classifies', 'aircraft engine pylon airframe fatigue', 'aircraft_aviation');
eq('subsea pipeline', 'Java Sea subsea gas export pipeline free span anchor strike', 'pipeline');
eq('LNG -> pressure_equipment', 'Singapore LNG export terminal cryogenic transfer line support', 'pressure_equipment');
eq('refinery', 'refinery delayed coker crude unit sulfidation overhead piping', 'refinery');
eq('rail bridge', 'England UK rail bridge gusset plate cracking', 'bridge_civil');
// the original Test-3 guard still holds: bare ambiguous term does NOT route to exotic
eq('bare cryogenic stays out of rocket', 'the cryogenic line developed frost near the flange', 'unknown');

console.log('All DEPLOY393 classifier-disambiguation checks passed (FPSO/wind/nuclear/aircraft correct; regressions intact).');
