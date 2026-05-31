'use strict';
// DEPLOY432 - regression gate for two TEST 15 fixes:
//  (1) FMD structural discriminator: deformation of a wear pad / guide (sacrificial
//      accessory) must NOT be read as global plastic deformation / structural instability.
//  (2) authority-lock: an LNG / marine transfer or loading LINE is piping (API 570 /
//      ASME B31.3), not a pressure vessel (API 510 / Section VIII).
var cp = require('child_process'); var fs = require('fs'); var os = require('os'); var path = require('path');
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dc432-'));
// copy all engine files so cross-requires (auth-guard, supabase) resolve
fs.readdirSync('netlify/functions').forEach(function (f) {
  if (f.slice(-4) === '.cjs' || f.slice(-3) === '.js') { try { fs.copyFileSync(path.join('netlify/functions', f), path.join(tmp, f.slice(-3) === '.js' ? f.slice(0, -3) + '.cjs' : f)); } catch (e) {} }
});
process.env.NODE_PATH = path.join(__dirname, '..', 'node_modules');
require('module').Module._initPaths();
var FMD = require(path.join(tmp, 'failure-mode-dominance.cjs'));
var AL = require(path.join(tmp, 'authority-lock.cjs'));
function assert(c, m) { if (!c) { throw new Error('FAIL: ' + m); } }

// (1) structural discriminator
assert(FMD.isGlobalDeformation('guide shows abnormal wear, polished contact surfaces, deformation of wear pads, accepted as cosmetic') === false,
  'wear-pad deformation is LOCAL, not global structural');
assert(FMD.isGlobalDeformation('pipe is severely bowed and out of plumb with gross deformation of the main run') === true,
  'genuine severe bowing IS global structural');
assert(FMD.isGlobalDeformation('deformation noted at the pipe guide near the expansion loop') === false,
  'deformation at a pipe guide is LOCAL');

// (2) authority routing
var pending = 2;
function route(desc, assetType, cb) {
  AL.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ asset_type: assetType, component_description: desc, service_environment: 'cryogenic lng', damage_mechanisms: ['fatigue'], has_cracking: false, is_pressure_boundary: true, jurisdiction: '' }) })
    .then(function (r) { var b = JSON.parse(r.body); cb((b.authority_chain || []).map(function (a) { return a.code; })); });
}
route('24-inch stainless steel loading line connected to articulated marine loading arm flng cryogenic lng', 'tank', function (codes) {
  assert(codes.indexOf('API 570') >= 0 && codes.indexOf('API 510') < 0, 'LNG loading line -> API 570 piping (not API 510 vessel); got ' + JSON.stringify(codes));
  if (--pending === 0) finish();
});
route('vertical separator vessel with nozzle piping', 'pressure_vessel', function (codes) {
  assert(codes.indexOf('API 510') >= 0, 'vessel + nozzle piping stays API 510 (no regression); got ' + JSON.stringify(codes));
  if (--pending === 0) finish();
});
function finish() { fs.rmSync(tmp, { recursive: true, force: true }); console.log('DEPLOY432 structural + authority-routing gate passed.'); }
