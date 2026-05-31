'use strict';
// ============================================================================
// decision-core-hold.test.cjs  -  the insufficient-evidence HOLD beat, gated.
// FORGED 4D NDT  -  DEPLOY419
//
// Independent probe of decision-core's disposition logic. Proves it FAILS SAFE:
//   INV1 confirmed hard-lock evidence (correct flags) -> a DECISIVE call
//        (no_go / repair_before_restart), never a soft hold.
//   INV2 absent / unverified evidence at HIGH consequence -> hold_for_review.
//   INV3 PARTIAL evidence (a confirmed defect with its companion flag missing)
//        degrades to HOLD - never to a false GO. The error direction is always
//        conservative.
//   INV4 (the dangerous direction) NO unverified/partial scenario ever yields a
//        confident go / conditional_go.
//
// Self-contained: compiles decision-core.ts to a temp dir (the established offline
// pattern) and invokes the real handler. Slower than the pure .cjs gates (~tsc
// compile) but it exercises the REAL decision path, not a mirror.
// Run: node tests/decision-core-hold.test.cjs
// ============================================================================
var cp = require('child_process');
var fs = require('fs');
var os = require('os');
var path = require('path');

process.env.NDT_API_KEY = 'gate-server-key';  // DEPLOY420: decision-core now requires auth; gate uses the X-API-Key path
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dc-hold-'));
cp.execSync('npx tsc netlify/functions/decision-core.ts --outDir "' + tmp + '" --module commonjs --target es2019 --skipLibCheck --esModuleInterop', { stdio: 'ignore' });
var cjs = fs.readdirSync('netlify/functions').filter(function (f) { return f.slice(-4) === '.cjs'; });
cjs.forEach(function (f) { fs.copyFileSync(path.join('netlify/functions', f), path.join(tmp, f)); });
// decision-core (in /tmp) now requires auth-guard.cjs -> @supabase/supabase-js; point
// module resolution at the repo's node_modules so the nested require resolves.
process.env.NODE_PATH = path.join(__dirname, '..', 'node_modules');
require('module').Module._initPaths();
var DC = require(path.join(tmp, 'decision-core.js'));
var handler = DC.handler;

function disp(flags, asset, transcript) {
  var ev = { httpMethod: 'POST', headers: { 'X-API-Key': 'gate-server-key' }, body: JSON.stringify({
    transcript: transcript || 'asset under evaluation', parsed: { numeric_values: {} },
    asset: asset || { asset_class: 'piping', confidence: 0.85 }, confirmed_flags: flags,
    reality_lock: null, evidence_provenance: null, authority_lock: null, sa_responses: [] }) };
  return handler(ev).then(function (res) { var b = JSON.parse(res.body); var dc = b.decision_core || b; return (dc.decision_reality || {}).disposition; });
}

var pass = 0, total = 0;
function check(n, c) { total++; if (c) { pass++; console.log('PASS ' + n); } else { console.log('FAIL ' + n); } }
var CONFIDENT_GO = { go: 1, conditional_go: 1 };

(async function () {
  // INV1 - decisive on confirmed hard-lock evidence
  check('through-wall leak -> no_go', (await disp({ through_wall_leak_confirmed: true, pressure_boundary_involved: true })) === 'no_go');
  check('primary crack -> no_go', (await disp({ crack_confirmed: true, primary_member_involved: true })) === 'no_go');
  check('critical wall loss -> repair_before_restart', (await disp({ critical_wall_loss_confirmed: true })) === 'repair_before_restart');
  check('support collapse -> no_go', (await disp({ support_collapse_confirmed: true })) === 'no_go');

  // INV2 - fail-safe HOLD on absent/unverified evidence
  check('no evidence, vague -> hold_for_review', (await disp(null, { asset_class: 'piping', confidence: 0.7 }, 'sour gas line possible cracking not yet inspected')) === 'hold_for_review');
  check('empty flags, suspected only -> hold_for_review', (await disp({}, { asset_class: 'pressure_vessel', confidence: 0.7 }, 'refinery column suspected sulfidation no data')) === 'hold_for_review');

  // INV3 - partial evidence degrades to HOLD, never a false GO
  var crackOnly = await disp({ crack_confirmed: true });
  var leakOnly = await disp({ leak_confirmed: true });
  check('crack_confirmed only (companion missing) -> not a confident go', !CONFIDENT_GO[crackOnly]);
  check('leak_confirmed only (companion missing) -> not a confident go', !CONFIDENT_GO[leakOnly]);

  // INV4 - the dangerous direction: none of the unverified/partial scenarios go
  var unverified = [ await disp(null, { asset_class: 'piping', confidence: 0.7 }, 'maybe corroded not sure'),
                     await disp({}, { asset_class: 'pressure_vessel', confidence: 0.6 }, 'want FFS no thickness data'),
                     crackOnly, leakOnly ];
  check('NO unverified scenario yields go/conditional_go', unverified.every(function (d) { return !CONFIDENT_GO[d]; }));

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('\nDECISION-CORE HOLD GATE: ' + pass + ' / ' + total + ' invariants held');
  if (pass !== total) { process.exit(1); }
})();
