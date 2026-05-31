'use strict';
// DEPLOY388 - corpus regression lock. Runs the 100-case multi-domain battery
// through the domain classifier and asserts the Test-3 failure CLASS can never
// recur: no valid industrial NDT scenario may route to a rocket/spacecraft
// (exotic) domain. This is the durable guarantee behind the one-keyword fix.
var fs = require('fs');
var path = require('path');
var c = require('../netlify/functions/domain-classifier.cjs');
function assert(cond, m) { if (!cond) { throw new Error('FAIL: ' + m); } }

var md = fs.readFileSync(path.join(__dirname, 'fixtures', 'ndt-100-case-battery.md'), 'utf8');
var blocks = md.split(/\nCASE\s+\d+/).slice(1);
assert(blocks.length === 100, 'parsed 100 cases (got ' + blocks.length + ')');

function grab(b, label) { var m = b.match(new RegExp(label + ':\\s*\\n?([^\\n]*)')); return m ? m[1].trim() : ''; }

var rocketOrSpace = [];   // the Test-3 failure mode (must stay empty)
var supportedCount = 0;
var lngDomain = null;

blocks.forEach(function (b) {
  var title = (b.match(/^[^\n]*/) || [''])[0].trim();
  var text = [title, grab(b, 'Expected Domain / Asset Class'), grab(b, 'Primary Damage Concern'), grab(b, 'Facility / Location')].join('. ');
  var r = c.classifyDomain(text);
  // Genuinely-aerospace corpus cases (AERO-*) SHOULD classify as aerospace/space;
  // the Test-3 invariant is that INDUSTRIAL (non-aerospace) cases must not.
  var isAero = /aero|spacecraft|satellite|rocket|aircraft|launch|on-orbit|propulsion/i.test(text);
  if (!isAero && (r.domain === 'aerospace_ground_test' || r.domain === 'spacecraft_satellite')) {
    rocketOrSpace.push(title + ' -> ' + r.domain);
  }
  if (r.supported) { supportedCount++; }
  if (title.indexOf('LNG Cryogenic Transfer Line') !== -1) { lngDomain = r.domain; }
});

// THE lock: zero industrial scenarios route to rocket/spacecraft (Test-3 class).
assert(rocketOrSpace.length === 0, 'no industrial case routes to rocket/spacecraft; offenders: ' + rocketOrSpace.join(' | '));

// The original Test-3 scenario specifically now lands in a supported domain.
assert(lngDomain === 'pressure_equipment', 'LNG Cryogenic Transfer Line -> pressure_equipment (got ' + lngDomain + ')');

// Sanity: the classifier still routes a meaningful share of industrial cases to
// supported domains (guards against an over-aggressive guard sending all to unknown).
assert(supportedCount >= 40, 'at least 40 cases classify into supported domains (got ' + supportedCount + ')');

console.log('All DEPLOY388 corpus checks passed (100 cases; 0 rocket/spacecraft misroutes; LNG -> pressure_equipment; ' + supportedCount + ' supported).');
