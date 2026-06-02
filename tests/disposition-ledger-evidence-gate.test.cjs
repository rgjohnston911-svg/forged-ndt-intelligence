'use strict';
// DEPLOY460 CP3 commit-4 gate: the disposition ledger / required-inspection-plan only generates
// mechanism-specific evidence requirements + NDE for CONFIRMED or genuinely-evidenced candidates.
// A phantom mechanism at score ~0.05 (unverified, no basis) gets NO ledger entry and NO inspection
// plan - this is the TEST 31/32 fatigue/TOFD/MT leak. Universal, asset-agnostic.
var fs = require('fs'); var os = require('os'); var path = require('path');
var ROOT = path.join(__dirname, '..');
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cp3-dp-'));
var dir = path.join(ROOT, 'netlify/functions');
fs.readdirSync(dir).forEach(function (f) {
  if (f.slice(-3) === '.js') { fs.copyFileSync(path.join(dir, f), path.join(tmp, f.slice(0, -3) + '.cjs')); }
  else if (f.slice(-4) === '.cjs') { fs.copyFileSync(path.join(dir, f), path.join(tmp, f)); }
});
process.env.NDT_API_KEY = 'k';
process.env.NODE_PATH = path.join(ROOT, 'node_modules');
require('module').Module._initPaths();
var DP = require(path.join(tmp, 'disposition-pathway.cjs'));
var pass = 0; var fails = [];
function ok(c, m) { if (c) { pass++; } else { fails.push(m); } }

function run(mechs) {
  return Promise.resolve(DP.handler({ httpMethod: 'POST', headers: { 'X-API-Key': 'k' }, body: JSON.stringify({ governing_failure_mode: 'NONE', consequence_tier: 'HIGH', reality_confidence_overall: 0.5, validated_mechanisms: mechs }) }))
    .then(function (r) {
      var b = JSON.parse(r.body);
      var led = (b.required_evidence_ledger || []).map(function (e) { return e.mechanism_id; });
      var plan = (b.required_inspection_plan || []).map(function (e) { return e.mechanism_id; });
      return { led: led, plan: plan };
    });
}

(async function () {
  // phantom (0.05, unverified) alongside a confirmed mechanism + a genuine candidate
  var r = await run([
    { id: 'fatigue_mechanical', reality_state: 'unverified', reality_score: 0.05 },   // phantom
    { id: 'general_corrosion', reality_state: 'confirmed', reality_score: 0.9 },       // confirmed
    { id: 'fatigue_vibration', reality_state: 'probable', reality_score: 0.4 }         // genuine candidate
  ]);
  ok(r.led.indexOf('fatigue_mechanical') < 0, 'phantom fatigue (0.05) -> NO evidence-ledger entry (got ledger: ' + r.led.join(',') + ')');
  ok(r.plan.indexOf('fatigue_mechanical') < 0, 'phantom fatigue (0.05) -> NO inspection-plan entry (no TOFD/MT for a no-evidence mechanism)');
  ok(r.led.indexOf('fatigue_vibration') >= 0, 'genuine candidate (probable 0.4) -> KEEPS its evidence-ledger entry');
  ok(r.plan.indexOf('fatigue_vibration') >= 0, 'genuine candidate (probable 0.4) -> KEEPS its inspection-plan entry');
  ok(r.led.indexOf('general_corrosion') < 0, 'confirmed corrosion -> excluded from ledger (already confirmed)');
  ok(r.plan.indexOf('general_corrosion') >= 0, 'confirmed corrosion -> kept in inspection plan (severity quantification NDE)');

  fs.rmSync(tmp, { recursive: true, force: true });
  if (fails.length) { console.log('FAIL disposition-ledger-evidence-gate: ' + fails.length); fails.forEach(function (f) { console.log('   - ' + f); }); process.exit(1); }
  console.log('disposition-ledger-evidence-gate: all ' + pass + ' checks passed (phantom mechanism gets no ledger/plan; genuine candidate + confirmed handled correctly).');
})();
