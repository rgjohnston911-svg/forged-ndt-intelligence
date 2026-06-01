'use strict';
// DEPLOY442 / Phase 4 gate - confidence-tagged classification.
// resolve-asset + reality-lock must each emit { value, confidence, evidence, source, isDefault }.
// "No evidence => no confidence": an unmatched transcript yields isDefault=true, confidence=0,
// evidence=[]. This is the raw material Phase 7 (no-destructive-override) and Phase 9
// (reconciliation) consume. Runs offline through the REAL handlers.
var cp = require('child_process'); var fs = require('fs'); var os = require('os'); var path = require('path');
var ROOT = path.join(__dirname, '..');
process.env.NDT_API_KEY = 'eval-key';
process.env.NODE_PATH = path.join(ROOT, 'node_modules');
require('module').Module._initPaths();

var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p4-cls-'));
cp.execSync('npx tsc netlify/functions/resolve-asset.ts netlify/functions/reality-lock.ts --outDir "' + tmp + '" --module commonjs --target es2019 --skipLibCheck --esModuleInterop', { cwd: ROOT, stdio: 'pipe' });
fs.readdirSync(path.join(ROOT, 'netlify/functions')).forEach(function (f) {
  if (f.slice(-4) === '.cjs' || f.slice(-3) === '.js') {
    var dst = f.slice(-3) === '.js' ? f.slice(0, -3) + '.cjs' : f;
    try { fs.copyFileSync(path.join(ROOT, 'netlify/functions', f), path.join(tmp, dst)); } catch (e) {}
  }
});
var RA = require(path.join(tmp, 'resolve-asset.js'));
var RL = require(path.join(tmp, 'reality-lock.js'));

function post(mod, body) {
  return Promise.resolve(mod.handler({ httpMethod: 'POST', headers: { 'X-API-Key': 'eval-key' }, body: JSON.stringify(body) }))
    .then(function (r) { return JSON.parse(r.body); });
}
var pass = 0; var fails = [];
function ok(c, m) { if (c) { pass++; } else { fails.push(m); } }

var FURNACE = 'Large coastal petrochemical complex. Ethylene cracker furnace F-7. Tube ultrasonic readings show no significant wall loss. Coking rate increasing.';
var GARBAGE = 'zzz qqq the thing near the area had some marks after the weekend xyzzy';

(async function () {
  // ---- resolve-asset: real asset -> evidence-backed classification ----
  var ra1 = (await post(RA, { raw_text: FURNACE })).resolved;
  ok(ra1.value === 'pressure_vessel', 'RA furnace value=pressure_vessel (got ' + ra1.value + ')');
  ok(ra1.source === 'alias-match', 'RA furnace source=alias-match (got ' + ra1.source + ')');
  ok(ra1.isDefault === false, 'RA furnace isDefault=false');
  ok(ra1.confidence > 0, 'RA furnace confidence>0 (got ' + ra1.confidence + ')');
  ok(ra1.evidence && ra1.evidence.indexOf('furnace') >= 0, 'RA furnace evidence cites "furnace" (got ' + JSON.stringify(ra1.evidence) + ')');

  // ---- resolve-asset: no match -> default, no evidence, no confidence ----
  var ra2 = (await post(RA, { raw_text: GARBAGE })).resolved;
  ok(ra2.isDefault === true, 'RA garbage isDefault=true');
  ok(ra2.source === 'default', 'RA garbage source=default (got ' + ra2.source + ')');
  ok(ra2.confidence === 0, 'RA garbage confidence=0 (no evidence => no confidence) (got ' + ra2.confidence + ')');
  ok(ra2.evidence && ra2.evidence.length === 0, 'RA garbage evidence=[]');

  // ---- reality-lock: domain classification carries the same contract ----
  var rl1 = (await post(RL, { transcript: FURNACE, parsed_asset_class: 'pressure_vessel', parsed_asset_confidence: 0.9 })).reality_lock;
  rl1 = rl1 || (await post(RL, { transcript: FURNACE, parsed_asset_class: 'pressure_vessel', parsed_asset_confidence: 0.9 }));
  ok(rl1.classification && rl1.classification.value === 'refinery', 'RL furnace classification.value=refinery (got ' + (rl1.classification && rl1.classification.value) + ')');
  ok(rl1.classification.isDefault === false, 'RL furnace classification.isDefault=false');
  ok(rl1.classification.source === 'domain-keyword', 'RL furnace source=domain-keyword');
  ok(rl1.classification.confidence > 0, 'RL furnace confidence>0');
  ok(rl1.classification.evidence && rl1.classification.evidence.length > 0, 'RL furnace evidence non-empty');

  // ---- reality-lock: no domain keyword -> default, no confidence ----
  var rl2 = (await post(RL, { transcript: GARBAGE, parsed_asset_class: 'pressure_vessel', parsed_asset_confidence: 0 }));
  rl2 = rl2.reality_lock || rl2;
  ok(rl2.classification.isDefault === true, 'RL garbage classification.isDefault=true (got ' + rl2.classification.isDefault + ')');
  ok(rl2.classification.confidence === 0, 'RL garbage confidence=0');

  fs.rmSync(tmp, { recursive: true, force: true });
  if (fails.length) {
    console.log('FAIL classification-confidence: ' + fails.length + ' assertion(s) failed');
    fails.forEach(function (f) { console.log('   - ' + f); });
    process.exit(1);
  }
  console.log('All classification-confidence Phase-4 checks passed (' + pass + ' assertions: resolve-asset + reality-lock emit {value,confidence,evidence,source,isDefault}; no evidence => no confidence; defaults flagged).');
})();
