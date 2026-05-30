'use strict';
// PHASE 0 - Frozen benchmark scoring harness. Runs the OFFLINE-scoreable engines
// (domain classifier, organizational, future-state forecaster) against the
// labeled benchmark and prints a per-LAYER scorecard, then writes
// benchmark-report.md. Live-only layers (authority/mechanism/disposition/
// governing_risk) are NOT auto-scored here - they require the live full pipeline.
var fs = require('fs'); var path = require('path');
var dc = require('../netlify/functions/domain-classifier.cjs');
var org = require('../netlify/functions/situational-awareness-organizational.cjs');
var fut = require('../netlify/functions/future-state-forecaster.cjs');

var bench = JSON.parse(fs.readFileSync(path.join(__dirname, 'ndt-benchmark-v1.json'), 'utf8'));
var cases = bench.cases;

function pad(s, n) { s = String(s); while (s.length < n) { s += ' '; } return s.slice(0, n); }

// counters
var clsTotal = 0, clsHit = 0;
var orgTP = 0, orgTN = 0, orgFP = 0, orgFN = 0;
var futTP = 0, futTN = 0, futFP = 0, futFN = 0;
var rows = [];

cases.forEach(function (c) {
  var e = c.expected;
  var clsDomain = dc.classifyDomain(c.transcript).domain;
  var clsPass = clsDomain === e.domain;
  clsTotal++; if (clsPass) { clsHit++; }

  var orgFired = org.detectOrganizationalFailures({ transcript: c.transcript }).indicators.length > 0;
  if (e.org_failure && orgFired) orgTP++; else if (!e.org_failure && !orgFired) orgTN++;
  else if (!e.org_failure && orgFired) orgFP++; else orgFN++;

  var futFired = fut.forecastFutureState({ remainingLifeYears: 5, nextInterventionMonths: 24, signals: { transcript: c.transcript } }).drivers.length > 0;
  if (e.forecast_driver && futFired) futTP++; else if (!e.forecast_driver && !futFired) futTN++;
  else if (!e.forecast_driver && futFired) futFP++; else futFN++;

  rows.push({ id: c.id, title: c.title, clsDomain: clsDomain, clsExp: e.domain, clsPass: clsPass,
    org: (orgFired ? 'Y' : 'N') + '/' + (e.org_failure ? 'Y' : 'N'), orgPass: orgFired === e.org_failure,
    fut: (futFired ? 'Y' : 'N') + '/' + (e.forecast_driver ? 'Y' : 'N'), futPass: futFired === e.forecast_driver });
});

function pct(n, d) { return d === 0 ? '-' : (Math.round(1000 * n / d) / 10) + '%'; }
function f1(tp, fp, fn) { var p = tp + fp === 0 ? 0 : tp / (tp + fp); var r = tp + fn === 0 ? 0 : tp / (tp + fn); return (p + r === 0) ? 0 : Math.round(1000 * 2 * p * r / (p + r)) / 10; }

var clsAcc = pct(clsHit, clsTotal);
var orgAcc = pct(orgTP + orgTN, cases.length);
var futAcc = pct(futTP + futTN, cases.length);

console.log('\nFORGED 4D NDT - Phase 0 Benchmark v1  (' + cases.length + ' labeled cases)');
console.log('OFFLINE-scored layers only. Authority/mechanism/disposition = live-only.\n');
console.log(pad('LAYER', 22) + pad('ACCURACY', 12) + 'detail');
console.log(pad('Domain classification', 22) + pad(clsAcc, 12) + clsHit + '/' + clsTotal + ' exact domain match');
console.log(pad('Organizational detect', 22) + pad(orgAcc, 12) + 'F1 ' + f1(orgTP, orgFP, orgFN) + '  (TP' + orgTP + ' TN' + orgTN + ' FP' + orgFP + ' FN' + orgFN + ')');
console.log(pad('Forecast-driver detect', 22) + pad(futAcc, 12) + 'F1 ' + f1(futTP, futFP, futFN) + '  (TP' + futTP + ' TN' + futTN + ' FP' + futFP + ' FN' + futFN + ')');
console.log('\nPer-case (cls dom | org fired/exp | fut fired/exp):');
rows.forEach(function (r) {
  console.log('  ' + pad(r.id, 5) + (r.clsPass ? 'PASS ' : 'MISS ') + pad(r.clsDomain + (r.clsPass ? '' : '!=' + r.clsExp), 34) + 'org ' + r.org + (r.orgPass ? ' ' : '*') + '  fut ' + r.fut + (r.futPass ? '' : '*'));
});

// write report.md
var L = [];
L.push('# FORGED 4D NDT - Phase 0 Benchmark Report (v1)');
L.push('');
L.push('Labeled cases: **' + cases.length + '**. Offline-scored layers only; authority / mechanism / disposition / governing-risk require live full-pipeline runs and are not auto-scored here.');
L.push('');
L.push('## Per-layer scorecard');
L.push('');
L.push('| Layer | Accuracy | Detail |');
L.push('|---|---|---|');
L.push('| Domain classification | ' + clsAcc + ' | ' + clsHit + '/' + clsTotal + ' exact match |');
L.push('| Organizational detection | ' + orgAcc + ' | F1 ' + f1(orgTP, orgFP, orgFN) + ' (TP' + orgTP + ' TN' + orgTN + ' FP' + orgFP + ' FN' + orgFN + ') |');
L.push('| Forecast-driver detection | ' + futAcc + ' | F1 ' + f1(futTP, futFP, futFN) + ' (TP' + futTP + ' TN' + futTN + ' FP' + futFP + ' FN' + futFN + ') |');
L.push('');
L.push('## Misses (where to look next)');
rows.filter(function (r) { return !r.clsPass || !r.orgPass || !r.futPass; }).forEach(function (r) {
  var bits = [];
  if (!r.clsPass) bits.push('domain ' + r.clsDomain + ' != ' + r.clsExp);
  if (!r.orgPass) bits.push('org fired/exp ' + r.org);
  if (!r.futPass) bits.push('forecast fired/exp ' + r.fut);
  L.push('- **' + r.id + '** ' + r.title + ' — ' + bits.join('; '));
});
L.push('');
L.push('_Run: `node tests/benchmark-runner.cjs`. Benchmark frozen at tests/fixtures/benchmark/ndt-benchmark-v1.json._');
fs.writeFileSync(path.join(__dirname, '..', 'benchmark-report.md'), L.join('\n'));
console.log('\nwrote benchmark-report.md');
