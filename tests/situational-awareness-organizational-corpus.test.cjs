'use strict';
// DEPLOY389 - SA organizational-coverage regression, locked by BOTH SA corpora.
// The org engine previously caught only 2 of the management-system failures these
// scenarios describe. After adding DEFERRED_MAINTENANCE / RECOMMENDATION_DOWNGRADED
// / PERSONNEL_TURNOVER / INCENTIVE_BIAS and hardening the degradation /
// production-pressure phrasings, it now detects the organizational dysfunction
// across both differently-worded corpora.
var fs = require('fs');
var path = require('path');
var org = require('../netlify/functions/situational-awareness-organizational.cjs');
function assert(c, m) { if (!c) { throw new Error('FAIL: ' + m); } }

function tally(file) {
  var md = fs.readFileSync(path.join(__dirname, 'fixtures', file), 'utf8');
  var blocks = md.split(/\nCASE\s+\d+/).slice(1);
  var t = { n: blocks.length, deferred: 0, downgraded: 0, turnover: 0, pressure: 0, degradation: 0, scoreSum: 0 };
  blocks.forEach(function (b) {
    var r = org.detectOrganizationalFailures({ transcript: b });
    t.scoreSum += r.organizational_failure_score;
    function h(id) { for (var i = 0; i < r.indicators.length; i++) if (r.indicators[i].id === id) return 1; return 0; }
    t.deferred += h('DEFERRED_MAINTENANCE'); t.downgraded += h('RECOMMENDATION_DOWNGRADED');
    t.turnover += h('PERSONNEL_TURNOVER'); t.pressure += h('SCHEDULE_PRESSURE_OVERRIDE'); t.degradation += h('DEGRADATION_IGNORED');
  });
  t.avg = t.scoreSum / t.n;
  return t;
}

// 100-case SA battery (templated)
var a = tally('ndt-sa-100-case-battery.md');
assert(a.n >= 100, '100-case: parsed >=100 (got ' + a.n + ')');
assert(a.deferred >= 90 && a.downgraded >= 90 && a.turnover >= 90, '100-case: new org indicators fire broadly');
assert(a.avg >= 7.5, '100-case: avg org score >= 7.5 (got ' + a.avg.toFixed(1) + ')');

// 150-case cross-domain battery (6 varied SA traps, differently worded)
var b = tally('ndt-cross-domain-sa-150-case-battery.md');
assert(b.n >= 150, '150-case: parsed >=150 (got ' + b.n + ')');
assert(b.deferred >= 140 && b.downgraded >= 140 && b.turnover >= 140, '150-case: new org indicators fire broadly');
assert(b.degradation >= 140, '150-case: hardened degradation phrasing now detected (got ' + b.degradation + ')');
assert(b.pressure >= 140, '150-case: hardened production-pressure phrasing now detected (got ' + b.pressure + ')');
assert(b.avg >= 9.0, '150-case: avg org score >= 9.0 (got ' + b.avg.toFixed(1) + ')');

console.log('All DEPLOY389 SA-org-coverage checks passed across BOTH corpora:');
console.log('  100-case: deferred=' + a.deferred + ' downgraded=' + a.downgraded + ' turnover=' + a.turnover + ' avg=' + a.avg.toFixed(1));
console.log('  150-case: deferred=' + b.deferred + ' downgraded=' + b.downgraded + ' turnover=' + b.turnover + ' pressure=' + b.pressure + ' degradation=' + b.degradation + ' avg=' + b.avg.toFixed(1));
