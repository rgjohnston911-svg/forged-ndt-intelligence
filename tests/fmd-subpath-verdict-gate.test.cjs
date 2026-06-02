'use strict';
// DEPLOY459 CP3 commit-3 gate: FMD sub-paths (corrosion/cracking/structural) consume the single
// mechanism-evidence verdict. NONE -> path inactive, no severity. CONFIRMED -> active with severity.
// Kills the "corrosion path active HIGH" leak on an unevidenced asset (TEST 30/31) while keeping
// real corrosion/crack paths active.
var cp = require('child_process'); var fs = require('fs'); var os = require('os'); var path = require('path');
var ROOT = path.join(__dirname, '..');
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cp3-fmd-'));
// copy every function so FMD's sibling requires (auth-guard, _mechanism-evidence) resolve
var dir = path.join(ROOT, 'netlify/functions');
fs.readdirSync(dir).forEach(function (f) {
  if (f.slice(-3) === '.js') { fs.copyFileSync(path.join(dir, f), path.join(tmp, f.slice(0, -3) + '.cjs')); }
  else if (f.slice(-4) === '.cjs') { fs.copyFileSync(path.join(dir, f), path.join(tmp, f)); }
});
process.env.NDT_API_KEY = 'k';
// resolve the repo's node_modules for the copied functions (auth-guard -> @supabase/supabase-js)
process.env.NODE_PATH = path.join(ROOT, 'node_modules');
require('module').Module._initPaths();
var FMD = require(path.join(tmp, 'failure-mode-dominance.cjs'));
var pass = 0; var fails = [];
function ok(c, m) { if (c) { pass++; } else { fails.push(m); } }

function fmd(body) {
  return Promise.resolve(FMD.handler({ httpMethod: 'POST', headers: { 'X-API-Key': 'k' }, body: JSON.stringify(body) }))
    .then(function (r) { var b = JSON.parse(r.body); return { c: b.corrosion_path || {}, k: b.cracking_path || {}, s: b.structural_path || {}, mode: b.governing_failure_mode }; });
}

(async function () {
  // TEST 30 hydrogen piping within limits, even with inferred hic/corrosion + has_cracking -> NO active paths
  var t30 = await fmd({ transcript: 'high-pressure hydrogen recycle piping 2.25Cr-1Mo, UT thickness within limits, no corrosion, PAUT no crack indications, no leak, within design limits, no H2S present', damage_mechanisms: ['hic', 'corrosion'], has_cracking: true, wall_loss_percent: 0, asset_class: 'process_piping' });
  ok(t30.c.active === false && t30.k.active === false && t30.s.active === false, 'TEST30: no active corrosion/cracking/structural path despite inferred mechanisms');
  ok(t30.c.severity !== 'HIGH' && t30.c.severity !== 'SEVERE' && t30.c.severity !== 'CRITICAL', 'TEST30: corrosion path carries no active severity number (got ' + t30.c.severity + ')');
  ok(t30.mode === 'NONE', 'TEST30: governing mode NONE');

  // TEST 31 SIS clean -> nothing active
  var t31 = await fmd({ transcript: 'safety instrumented system, valves stroke within time, no corrosion, no cracking, no leak, no damage mechanism', damage_mechanisms: [], has_cracking: false, wall_loss_percent: 0, asset_class: 'pressure_vessel' });
  ok(t31.c.active === false && t31.k.active === false && t31.s.active === false, 'TEST31 SIS clean: no active paths');

  // Real corrosion (measured loss) -> corrosion path active with severity (no regression)
  var corr = await fmd({ transcript: 'piping elbow, measured wall loss of 64 percent, corrosion product observed', damage_mechanisms: ['corrosion'], has_cracking: false, wall_loss_percent: 64, asset_class: 'process_piping' });
  ok(corr.c.active === true && (corr.c.severity === 'SEVERE' || corr.c.severity === 'HIGH' || corr.c.severity === 'CRITICAL'), 'real corrosion -> corrosion path active with severity (got active=' + corr.c.active + ' sev=' + corr.c.severity + ')');

  // Real crack -> cracking path active (no regression)
  var crack = await fmd({ transcript: 'PAUT detected crack-like linear indication, through-wall crack confirmed', damage_mechanisms: ['crack'], has_cracking: true, wall_loss_percent: 0, asset_class: 'pressure_vessel' });
  ok(crack.k.active === true, 'real crack -> cracking path active (got ' + crack.k.active + ')');

  fs.rmSync(tmp, { recursive: true, force: true });
  if (fails.length) { console.log('FAIL fmd-subpath-verdict-gate: ' + fails.length); fails.forEach(function (f) { console.log('   - ' + f); }); process.exit(1); }
  console.log('fmd-subpath-verdict-gate: all ' + pass + ' checks passed (sub-paths gate on the verdict; TEST30/31 no active paths; real corrosion/crack still active).');
})();
