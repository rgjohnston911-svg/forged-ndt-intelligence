'use strict';
// DEPLOY385 - regression test for the Test-2 wall-loss / MAOP calculation bug.
// Bug: nominal/original wall not captured -> defaults to a thin NPS schedule
// below the measured reading -> negative wall loss (-96.3%) and bogus MAOP (9 psi).
// Load the CommonJS engine source in a CJS sandbox (repo package.json is
// "type":"module", so a direct require() of the .js fails as ESM). The engine
// is self-contained (only JS globals), so Function-eval is a faithful load.
var fs = require('fs');
var path = require('path');
var src = fs.readFileSync(path.join(__dirname, '..', 'netlify', 'functions', 'remaining-strength.js'), 'utf8');
var _m = { exports: {} };
(new Function('module', 'exports', 'require', src))(_m, _m.exports, require);
var mod = _m.exports;
function assert(c, m) { if (!c) { throw new Error('FAIL: ' + m); } }

function call(body, cb) {
  var ev = { httpMethod: 'POST', body: JSON.stringify(body) };
  var out = mod.handler(ev);
  if (out && typeof out.then === 'function') { return out.then(function (r) { cb(JSON.parse(r.body)); }); }
  cb(JSON.parse(out.body));
  return null;
}

var pending = 0;
function done() { pending--; if (pending === 0) { console.log('All DEPLOY385 remaining-strength guard checks passed.'); } }

// Case A: correct inputs (nominal captured) -> true ~57.2% wall loss, valid MAOP
pending++;
call({ nominal_wall: 0.500, measured_minimum_wall: 0.214, pipe_od: 8.625, smys: 35000, flaw_length: 8.4, operating_pressure: 600, design_factor: 0.72 }, function (r) {
  assert(r.data_quality !== 'inconsistent', 'A: valid inputs not flagged inconsistent');
  var wl = r.calculations && r.calculations.wall_loss_percent;
  assert(wl !== undefined && Math.abs(wl - 57.2) < 0.5, 'A: wall loss ~57.2% (got ' + wl + ')');
  assert(typeof r.governing_maop === 'number' && r.governing_maop > 0 && isFinite(r.governing_maop), 'A: positive finite MAOP (got ' + r.governing_maop + ')');
  done();
});

// Case B: the actual bug -- nominal defaulted thin (0.109) below measured (0.214)
pending++;
call({ nominal_wall: 0.109, measured_minimum_wall: 0.214, pipe_od: 0.840, smys: 35000, flaw_length: 2.0, operating_pressure: 600 }, function (r) {
  assert(r.data_quality === 'inconsistent', 'B: measured>=nominal flagged inconsistent (got ' + r.data_quality + ')');
  assert(r.governing_maop === null, 'B: no MAOP emitted (got ' + r.governing_maop + ')');
  assert(!(r.calculations && r.calculations.wall_loss_percent < 0), 'B: never emits a negative wall loss');
  assert(/original|nominal/i.test(r.recommendation), 'B: recommendation points at missing nominal/original wall');
  done();
});

// Case C: equal walls (measured == nominal) -> inconsistent
pending++;
call({ nominal_wall: 0.300, measured_minimum_wall: 0.300, pipe_od: 6.625, smys: 35000, flaw_length: 3.0 }, function (r) {
  assert(r.data_quality === 'inconsistent', 'C: measured==nominal flagged inconsistent');
  done();
});

// DEPLOY428 - input-consistency guard (understated grade -> INPUTS_INCONSISTENT, no false alarm).
pending++;
call({ nominal_wall: 0.5, measured_minimum_wall: 0.421, pipe_od: 36, material_grade: 'A106_GR_B', design_factor: 0.72, operating_pressure: 1420 }, function (r) {
  assert(r.safe_envelope === 'INPUTS_INCONSISTENT', 'C: 36in A106-B op1420 -> inputs-inconsistent (got ' + r.safe_envelope + ')');
  assert(r.material_consistency_flag === true, 'C: material_consistency_flag set');
  assert(r.pressure_reduction_required === 0, 'C: no false pressure-reduction figure');
  assert(typeof r.implied_smys === 'number' && r.implied_smys > 60000, 'C: implied SMYS X-grade (got ' + r.implied_smys + ')');
  done();
});
// DEPLOY428 - genuine exceedance must STILL flag EXCEEDS (not masked).
pending++;
call({ nominal_wall: 0.5, measured_minimum_wall: 0.30, pipe_od: 24, material_grade: 'A106_GR_B', design_factor: 0.72, operating_pressure: 900 }, function (r) {
  assert(r.safe_envelope === 'EXCEEDS', 'D: genuine exceedance still EXCEEDS (got ' + r.safe_envelope + ')');
  assert(r.material_consistency_flag === false, 'D: genuine case not mislabeled');
  assert(r.pressure_reduction_required > 0, 'D: real reduction recommended');
  done();
});
