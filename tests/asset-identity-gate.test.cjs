'use strict';
// DEPLOY463 - ASSET IDENTITY GATE. decision-core halts (asset_identity_unresolved) when the
// Authority Lock could not map the asset to a governing primary authority (status != LOCKED) -
// the cascade-root fix (ESD-7 -> bridge_concrete -> AASHTO + corrosion wall becomes a clean HOLD).
// No-regression: a LOCKED asset proceeds; an absent authority_lock (offline harness) does NOT fire.
var cp = require('child_process'); var fs = require('fs'); var os = require('os'); var path = require('path');
var ROOT = path.join(__dirname, '..');
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aig-'));
// copy every function (deps) as .cjs, then compile decision-core.ts -> .js in the same dir
fs.readdirSync(path.join(ROOT, 'netlify/functions')).forEach(function (f) {
  if (f.slice(-3) === '.js') { fs.copyFileSync(path.join(ROOT, 'netlify/functions', f), path.join(tmp, f.slice(0, -3) + '.cjs')); }
  else if (f.slice(-4) === '.cjs') { fs.copyFileSync(path.join(ROOT, 'netlify/functions', f), path.join(tmp, f)); }
});
cp.execSync('npx tsc netlify/functions/decision-core.ts --outDir "' + tmp + '" --module commonjs --target es2019 --skipLibCheck --esModuleInterop', { cwd: ROOT, stdio: 'pipe' });
fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"commonjs"}');
process.env.NDT_API_KEY = 'k';
process.env.NODE_PATH = path.join(ROOT, 'node_modules');
require('module').Module._initPaths();
var DC = require(path.join(tmp, 'decision-core.js'));
var pass = 0; var fails = [];
function ok(c, m) { if (c) { pass++; } else { fails.push(m); } }

var T = "Emergency Shutdown System ESD-7 protecting high-pressure synthesis loop. Shutdown valves stroke within requirements, no leakage. Logic solver self-test passed. Last proof test PASS. No corrosion, no cracking, no active damage mechanism identified.";
function run(assetClass, authStatus) {
  var authority_lock = authStatus ? { status: authStatus, primary_authority: (authStatus === "LOCKED" ? "API 510" : null) } : null;
  var body = { transcript: T, parsed: { numeric_values: {} }, asset: { asset_class: assetClass, confidence: 0.8 }, confirmed_flags: {}, reality_lock: null, evidence_provenance: null, authority_lock: authority_lock, sa_responses: [] };
  return Promise.resolve(DC.handler({ httpMethod: 'POST', headers: { 'X-API-Key': 'k' }, body: JSON.stringify(body) }))
    .then(function (r) { var b = JSON.parse(r.body); return b.decision_core || b; });
}

(async function () {
  var held = await run("bridge_concrete", "PARTIAL");   // ESD misclassified, authority not mappable
  ok(held.asset_identity_unresolved === true && held.domain_not_supported === true, "PARTIAL authority -> asset identity HOLD (no downstream report)");
  ok(!held.consequence_reality && !held.damage_reality, "HOLD emits no consequence/mechanism analysis");

  var locked = await run("pressure_vessel", "LOCKED");  // golden physical asset
  ok(!locked.asset_identity_unresolved, "LOCKED authority -> proceeds (no identity hold)");
  ok(!locked.domain_not_supported, "LOCKED authority -> full assessment, not refused");

  var offline = await run("pressure_vessel", null);     // offline harness path (no authority_lock)
  ok(!offline.asset_identity_unresolved, "absent authority_lock -> gate does NOT fire (engine-level tests unaffected)");

  var unresolvedAuth = await run("offshore_platform", "UNRESOLVED");
  ok(unresolvedAuth.asset_identity_unresolved === true, "UNRESOLVED authority -> identity HOLD");

  fs.rmSync(tmp, { recursive: true, force: true });
  if (fails.length) { console.log('FAIL asset-identity-gate: ' + fails.length); fails.forEach(function (f) { console.log('   - ' + f); }); process.exit(1); }
  console.log('asset-identity-gate: all ' + pass + ' checks passed (not-LOCKED authority -> HOLD with no downstream; LOCKED proceeds; absent authority_lock inert).');
})();
