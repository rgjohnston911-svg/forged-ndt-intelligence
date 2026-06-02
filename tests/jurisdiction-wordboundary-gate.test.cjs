'use strict';
// DEPLOY466 - jurisdiction word-boundary. The Mexico location tagger must not match the "Mexico"
// inside "Gulf of Mexico" (US offshore) or "New Mexico" (US state) - those stay United States - while
// a genuine Mexico (Pemex / offshore Mexico / Mexican) still tags. The US/BSEE overlay path is unchanged.
var cp = require('child_process'); var fs = require('fs'); var os = require('os'); var path = require('path');
var ROOT = path.join(__dirname, '..');
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'juris-'));
fs.readdirSync(path.join(ROOT, 'netlify/functions')).forEach(function (f) {
  if (f.slice(-3) === '.js') { fs.copyFileSync(path.join(ROOT, 'netlify/functions', f), path.join(tmp, f.slice(0, -3) + '.cjs')); }
  else if (f.slice(-4) === '.cjs') { fs.copyFileSync(path.join(ROOT, 'netlify/functions', f), path.join(tmp, f)); }
});
cp.execSync('npx tsc netlify/functions/global-authority-engine.ts --outDir "' + tmp + '" --module commonjs --target es2019 --skipLibCheck --esModuleInterop', { cwd: ROOT, stdio: 'pipe' });
fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"commonjs"}');
process.env.NDT_API_KEY = 'k';
process.env.NODE_PATH = path.join(ROOT, 'node_modules');
require('module').Module._initPaths();
var GAE = require(path.join(tmp, 'global-authority-engine.js'));
var pass = 0; var fails = [];
function ok(c, m) { if (c) { pass++; } else { fails.push(m); } }
function country(t) { return Promise.resolve(GAE.handler({ httpMethod: 'POST', headers: { 'X-API-Key': 'k' }, body: JSON.stringify({ asset_description: t, location_text: t, asset_type: 'offshore_platform', requested_code: 'API RP 2A', industry_domain: 'oil_gas' }) })).then(function (r) { return JSON.parse(r.body).country; }); }

(async function () {
  ok(await country("Offshore Gulf of Mexico Production Platform, United States") === "United States", "Gulf of Mexico (US) -> United States, NOT Mexico");
  ok(await country("New Mexico refinery, United States") === "United States", "New Mexico (US state) -> United States, NOT Mexico");
  ok(await country("Pemex offshore production platform, Bay of Campeche, Mexico") === "Mexico", "genuine Pemex/Mexico -> Mexico");
  ok(await country("Offshore Mexico deepwater field operated by a Mexican operator") === "Mexico", "offshore Mexico / Mexican -> Mexico");

  fs.rmSync(tmp, { recursive: true, force: true });
  if (fails.length) { console.log('FAIL jurisdiction-wordboundary-gate: ' + fails.length); fails.forEach(function (f) { console.log('   - ' + f); }); process.exit(1); }
  console.log('jurisdiction-wordboundary-gate: all ' + pass + ' checks passed (Gulf of Mexico + New Mexico stay US; genuine Mexico tags).');
})();
