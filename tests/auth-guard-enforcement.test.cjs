'use strict';
// ============================================================================
// auth-guard-enforcement.test.cjs  -  locks the verifyAuth behavior the P0-1
// rollout depends on. FORGED DEPLOY420. (The Supabase JWT path needs a live
// service-role client + network, so it is NOT exercised here; this gates the
// fail-closed + X-API-Key paths, which are pure/offline.)
// ============================================================================
process.env.NDT_API_KEY = 'test-server-key-123';   // must be set BEFORE require (read at load)
var AG = require('../netlify/functions/auth-guard.cjs');

var pass = 0, total = 0;
function check(n, c) { total++; if (c) { pass++; console.log('PASS ' + n); } else { console.log('FAIL ' + n); } }

(async function () {
  // 1) no credentials -> 401 (fail closed)
  var r1 = await AG.verifyAuth({ headers: {} });
  check('no credentials -> ok:false, 401', r1.ok === false && r1.status === 401);

  // 2) valid server key -> ok:true (service principal)
  var r2 = await AG.verifyAuth({ headers: { 'X-API-Key': 'test-server-key-123' } });
  check('valid X-API-Key -> ok:true, principal service', r2.ok === true && r2.principal === 'service');

  // 3) wrong server key, no JWT -> 401
  var r3 = await AG.verifyAuth({ headers: { 'X-API-Key': 'wrong-key' } });
  check('wrong X-API-Key (no JWT) -> ok:false, 401', r3.ok === false && r3.status === 401);

  // 4) header lookup is case-insensitive
  var r4 = await AG.verifyAuth({ headers: { 'x-api-key': 'test-server-key-123' } });
  check('case-insensitive header (x-api-key) accepted', r4.ok === true);

  // 5) denyResponse is a well-formed 401 with an error body
  var d = AG.denyResponse(r1, { 'Content-Type': 'application/json' });
  var body = JSON.parse(d.body);
  check('denyResponse -> statusCode 401 + error body', d.statusCode === 401 && typeof body.error === 'string');

  console.log('\nAUTH-GUARD ENFORCEMENT GATE: ' + pass + ' / ' + total + ' passed');
  if (pass !== total) { process.exit(1); }
})();
