'use strict';
// DEPLOY464 - FUNCTIONAL_SAFETY asset class. A declared protective function (SIS/ESD/SIF/BMS)
// classifies as functional_safety on its DECLARED IDENTITY (full-phrase aliases, never bare
// acronyms - the matcher is substring-based), locks to IEC 61511 / ISA 84 (in-matrix, passes the
// Asset Identity Gate, cite+escalate only). A physical asset that merely MENTIONS a shutdown
// valve/interlock must NOT flip to functional_safety (the §2 over-classification guard).
var cp = require('child_process'); var fs = require('fs'); var os = require('os'); var path = require('path');
var ROOT = path.join(__dirname, '..');
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fsc-'));
// copy every function so resolve-asset/authority-lock sibling requires (auth-guard etc.) resolve
fs.readdirSync(path.join(ROOT, 'netlify/functions')).forEach(function (f) {
  if (f.slice(-3) === '.js') { fs.copyFileSync(path.join(ROOT, 'netlify/functions', f), path.join(tmp, f.slice(0, -3) + '.cjs')); }
  else if (f.slice(-4) === '.cjs') { fs.copyFileSync(path.join(ROOT, 'netlify/functions', f), path.join(tmp, f)); }
});
cp.execSync('npx tsc netlify/functions/resolve-asset.ts --outDir "' + tmp + '" --module commonjs --target es2019 --skipLibCheck --esModuleInterop', { cwd: ROOT, stdio: 'pipe' });
fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"commonjs"}');
process.env.NDT_API_KEY = 'k';
process.env.NODE_PATH = path.join(ROOT, 'node_modules');
require('module').Module._initPaths();
var RA = require(path.join(tmp, 'resolve-asset.js'));
var AL = require(path.join(tmp, 'authority-lock.cjs'));
var pass = 0; var fails = [];
function ok(c, m) { if (c) { pass++; } else { fails.push(m); } }
function cls(text) { return Promise.resolve(RA.handler({ httpMethod: 'POST', headers: { 'X-API-Key': 'k' }, body: JSON.stringify({ raw_text: text }) })).then(function (r) { return JSON.parse(r.body).resolved.asset_class; }); }
function lock(ac) { return Promise.resolve(AL.handler({ httpMethod: 'POST', headers: { 'X-API-Key': 'k' }, body: JSON.stringify({ asset_type: ac, component_description: '', service_environment: '', damage_mechanisms: [], is_pressure_boundary: false }) })).then(function (r) { var b = JSON.parse(r.body); return { status: b.status, codes: (b.authority_chain || b.authorities || []).map(function (a) { return a.code; }) }; }); }

(async function () {
  ok(await cls("Emergency Shutdown System (ESD-7) protecting high-pressure synthesis loop. Logic solver self-test passed.") === "functional_safety", "ESD system -> functional_safety");
  ok(await cls("Safety Instrumented System SIS-204 protecting furnace feed isolation. Pressure transmitters calibrated.") === "functional_safety", "SIS -> functional_safety (declared identity beats 'pressure transmitter')");
  ok(await cls("Burner management system on fired heater B-2. Logic solver passed self-test.") === "functional_safety", "BMS -> functional_safety");

  // §2 over-classification guard: a pressure vessel that merely MENTIONS a shutdown valve / interlock
  // must stay a physical asset (no full safety-function declared-identity phrase present).
  var vesselWithEsdValve = await cls("Pressure vessel V-101, carbon steel shell, equipped with an emergency shutdown valve and a high-pressure interlock. UT thickness 0.480 inch, measured wall loss 35 percent, corrosion product observed.");
  ok(vesselWithEsdValve !== "functional_safety", "vessel mentioning an ESD valve/interlock does NOT flip to functional_safety (got " + vesselWithEsdValve + ")");

  var fsAuth = await lock("functional_safety");
  ok(fsAuth.status === "LOCKED", "functional_safety -> authority LOCKED (in-matrix, passes identity gate)");
  ok(fsAuth.codes.some(function (c) { return /IEC 61511/.test(c); }), "functional_safety primary = IEC 61511");
  ok(!fsAuth.codes.some(function (c) { return /API 510|ASME (BPVC )?Section VIII|AASHTO/.test(c); }), "functional_safety does NOT route to API 510 / ASME VIII / AASHTO");

  fs.rmSync(tmp, { recursive: true, force: true });
  if (fails.length) { console.log('FAIL functional-safety-class: ' + fails.length); fails.forEach(function (f) { console.log('   - ' + f); }); process.exit(1); }
  console.log('functional-safety-class: all ' + pass + ' checks passed (SIS/ESD/BMS -> functional_safety -> IEC 61511 LOCKED; vessel mentioning a shutdown valve stays physical).');
})();
