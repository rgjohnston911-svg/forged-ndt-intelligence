'use strict';
// Jurisdiction benchmark layer (compile-based; zero risk to the live engine).
// global-authority-engine.ts is TypeScript, so this script compiles it to a temp
// dir, then scores the resolver against the benchmark's jurisdiction labels.
// Run: node benchmark/run-jurisdiction.cjs
var fs = require('fs'); var path = require('path'); var os = require('os');
var cp = require('child_process');

var ROOT = path.join(__dirname, '..');
var SRC = path.join(ROOT, 'netlify', 'functions', 'global-authority-engine.ts');
var OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'gae-'));

try {
  cp.execSync('npx tsc "' + SRC + '" --outDir "' + OUT + '" --skipLibCheck --target es2019 --module commonjs --esModuleInterop --moduleResolution node', { cwd: ROOT, stdio: 'pipe' });
} catch (e) { /* tsc emits despite type notes under skipLibCheck; continue if the .js exists */ }
var gaePath = path.join(OUT, 'global-authority-engine.js');
if (!fs.existsSync(gaePath)) { console.error('compile failed - no gae .js produced'); process.exit(1); }
var gae = require(gaePath);

var bench = JSON.parse(fs.readFileSync(path.join(__dirname, 'ndt-benchmark-v1.json'), 'utf8'));
function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z]/g, ''); }

(async function () {
  var hit = 0, tot = 0, miss = [];
  for (var i = 0; i < bench.cases.length; i++) {
    var c = bench.cases[i]; var exp = c.expected.jurisdiction; if (!exp) { continue; }
    var ev = { httpMethod: 'POST', body: JSON.stringify({ location_text: c.transcript, asset_description: c.transcript, asset_type: 'asset', industry_domain: 'oil_gas' }) };
    var r = JSON.parse((await gae.handler(ev)).body);
    var got = r.country; var g = norm(got);
    var ok;
    if (norm(exp) === 'unknown') { ok = (got === null || g === '' || g.indexOf('internationalwaters') >= 0 || g === 'unknown'); }
    else { ok = g === norm(exp) || g.indexOf(norm(exp)) >= 0 || norm(exp).indexOf(g) >= 0; }
    tot++; if (ok) { hit++; } else { miss.push(c.id + ' ' + exp + '->' + (got || 'null')); }
  }
  console.log('\nJurisdiction layer: ' + hit + '/' + tot + ' (' + Math.round(100 * hit / tot) + '%)');
  if (miss.length) { console.log('misses: ' + miss.join(' | ')); } else { console.log('no misses'); }
  try { fs.rmSync(OUT, { recursive: true, force: true }); } catch (e) {}
})();
