'use strict';
// DEPLOY387 - SEC: auth-guard enforcement logic. Set env BEFORE require (the
// module reads process.env at load). The X-API-Key and no-token paths return
// before any Supabase network call, so this runs fully offline.
process.env.NDT_API_KEY = 'test-server-key-ABC123';
var ag = require('../netlify/functions/auth-guard.cjs');
function assert(c, m) { if (!c) { throw new Error('FAIL: ' + m); } }

var pending = 0;
function done() { pending--; if (pending === 0) { console.log('All DEPLOY387 auth-guard checks passed (fail-closed; X-API-Key + JWT-missing paths verified).'); } }

// 1) No credentials -> deny 401 (fail closed)
pending++;
ag.verifyAuth({ headers: {} }).then(function (r) {
  assert(r.ok === false, 'no creds -> ok:false');
  assert(r.status === 401, 'no creds -> 401 (got ' + r.status + ')');
  done();
});

// 2) Correct server X-API-Key -> allow as service principal (no Supabase call)
pending++;
ag.verifyAuth({ headers: { 'x-api-key': 'test-server-key-ABC123' } }).then(function (r) {
  assert(r.ok === true, 'valid X-API-Key -> ok:true');
  assert(r.principal === 'service', 'valid X-API-Key -> principal service');
  done();
});

// 3) Wrong X-API-Key, no Authorization -> deny 401
pending++;
ag.verifyAuth({ headers: { 'x-api-key': 'wrong-key' } }).then(function (r) {
  assert(r.ok === false && r.status === 401, 'wrong key, no JWT -> 401');
  done();
});

// 4) Header lookup is case-insensitive (X-API-Key vs x-api-key)
pending++;
ag.verifyAuth({ headers: { 'X-API-Key': 'test-server-key-ABC123' } }).then(function (r) {
  assert(r.ok === true && r.principal === 'service', 'case-insensitive header match');
  done();
});

// 5) denyResponse shape: status, CORS header passthrough, JSON error body
var resp = ag.denyResponse({ status: 401, error: 'Missing auth token' }, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' });
assert(resp.statusCode === 401, 'denyResponse status 401');
assert(resp.headers['Access-Control-Allow-Origin'] === '*', 'denyResponse keeps CORS header');
assert(JSON.parse(resp.body).error === 'Missing auth token', 'denyResponse JSON error body');

// 6) stripBearer + getHeader helpers
assert(ag.stripBearer('Bearer abc.def') === 'abc.def', 'stripBearer removes scheme');
assert(ag.getHeader({ headers: { authorization: 'X' } }, 'Authorization') === 'X', 'getHeader case-insensitive');
