// ============================================================================
// auth-guard.cjs   (shared auth helper)  -  DEPLOY379 / API Auth Phase 1
//
// Shared request authenticator for the NDT Netlify functions. Phase 1 ships
// the helper with NO callers (it deploys as a no-op, like the SA modules).
// Functions adopt it incrementally in Phase 3.
//
// verifyAuth(event) accepts EITHER:
//   * a valid Supabase USER JWT  (Authorization: Bearer <access_token>) — the
//     SPA path; verified with supabase.auth.getUser() using the service-role
//     client, exactly mirroring the proven pattern in create-case.ts.
//   * a valid SERVER key         (X-API-Key === process.env.NDT_API_KEY) — the
//     server-to-server path used by the WeldScan 4dnt-proxy.
//
// FAIL CLOSED: any verification failure, missing config, or thrown error
// returns ok:false. Callers must deny on ok:false. (Adopt this helper via a
// TOP-LEVEL require so a bundling failure 500s the function rather than
// silently allowing — never wrap the require in a permissive try/catch.)
//
// Style: var only, string concatenation only, no template literals, no arrow
// functions (git-bash paste safety, per the repo convention).
// ============================================================================
'use strict';

var createClient = require('@supabase/supabase-js').createClient;

var SUPABASE_URL = process.env.SUPABASE_URL || '';
var SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
var NDT_API_KEY = process.env.NDT_API_KEY || '';

// Case-insensitive header lookup (Netlify lowercases, but be defensive).
function getHeader(event, name) {
  if (!event || !event.headers) { return ''; }
  var h = event.headers;
  var lower = name.toLowerCase();
  if (typeof h[name] === 'string') { return h[name]; }
  if (typeof h[lower] === 'string') { return h[lower]; }
  var upper = name.toUpperCase();
  if (typeof h[upper] === 'string') { return h[upper]; }
  return '';
}

function stripBearer(value) {
  if (!value) { return ''; }
  return String(value).replace(/^Bearer\s+/i, '').replace(/^ +| +$/g, '');
}

// Verify a request. Returns a Promise of:
//   { ok: true,  principal: 'user',    user }     (valid Supabase JWT)
//   { ok: true,  principal: 'service', user: null}(valid X-API-Key)
//   { ok: false, status: 401|500, error }         (deny)
function verifyAuth(event) {
  return new Promise(function (resolve) {
    // 1) Server-to-server key (e.g., WeldScan proxy). Only honored when the
    //    server has an NDT_API_KEY configured.
    if (NDT_API_KEY) {
      var apiKey = getHeader(event, 'X-API-Key');
      if (apiKey && apiKey === NDT_API_KEY) {
        resolve({ ok: true, principal: 'service', user: null });
        return;
      }
    }

    // 2) Supabase user JWT.
    var token = stripBearer(getHeader(event, 'Authorization'));
    if (!token) {
      resolve({ ok: false, status: 401, error: 'Missing auth token' });
      return;
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      // Misconfiguration must fail closed, not open.
      resolve({ ok: false, status: 500, error: 'Auth not configured' });
      return;
    }

    var sb;
    try {
      sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    } catch (e) {
      resolve({ ok: false, status: 500, error: 'Auth client init failed' });
      return;
    }

    sb.auth.getUser(token).then(function (res) {
      if (res && !res.error && res.data && res.data.user) {
        resolve({ ok: true, principal: 'user', user: res.data.user });
      } else {
        resolve({ ok: false, status: 401, error: 'Invalid auth token' });
      }
    }).catch(function () {
      resolve({ ok: false, status: 401, error: 'Auth verification failed' });
    });
  });
}

// Convenience: standard 401/500 response body for a denied request.
function denyResponse(authResult, corsHeaders) {
  var status = (authResult && authResult.status) ? authResult.status : 401;
  var hdrs = corsHeaders || { 'Content-Type': 'application/json' };
  return {
    statusCode: status,
    headers: hdrs,
    body: JSON.stringify({ error: (authResult && authResult.error) ? authResult.error : 'Unauthorized' })
  };
}

module.exports = {
  verifyAuth: verifyAuth,
  denyResponse: denyResponse,
  // exported for tests:
  getHeader: getHeader,
  stripBearer: stripBearer
};
