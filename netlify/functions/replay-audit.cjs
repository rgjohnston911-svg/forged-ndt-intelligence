// netlify/functions/replay-audit.cjs
// FORGED NDT Intelligence OS - Deterministic Replay Verifier
// DEPLOY##X / v##.x
//
// Re-runs a stored projection and verifies that the resulting viewHash
// matches the hash recorded at original projection time. Any mismatch
// indicates one of:
//   (a) tampering with the stored DecisionPackage
//   (b) tampering with the stored coherence record
//   (c) projection code version drift since original run
//   (d) non-determinism that escaped the stableStringify gate (bug)
//
// All four warrant investigation.
//
// Endpoint:
//   POST /replay-audit
//     body: { packageHash, role, roleContext, originalViewHash }
//     returns: { ok, match, originalViewHash, replayedViewHash, drift?, fetchedFrom }
'use strict';
var CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
function getBaseUrl(event) {
  if (process.env.URL) return process.env.URL;
  if (process.env.DEPLOY_URL) return process.env.DEPLOY_URL;
  // Fallback: construct from event
  var host = event.headers && (event.headers.host || event.headers.Host);
  var proto = event.headers && (event.headers['x-forwarded-proto'] || 'https');
  return proto + '://' + (host || 'localhost');
}
async function fetchPackage(baseUrl, packageHash) {
  var resp = await fetch(baseUrl + '/.netlify/functions/package-store?hash=' + encodeURIComponent(packageHash));
  if (!resp.ok) {
    if (resp.status === 404) return { ok: false, notFound: true };
    return { ok: false, error: 'fetch failed: ' + resp.status };
  }
  var data = await resp.json();
  return data;
}
async function reproject(baseUrl, decisionPackage, roleContext) {
  var resp = await fetch(baseUrl + '/.netlify/functions/perspective-projection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decisionPackage: decisionPackage, roleContext: roleContext })
  });
  if (!resp.ok) {
    return { ok: false, error: 'reproject failed: ' + resp.status };
  }
  return resp.json();
}
function buildDriftReport(originalView, replayedView) {
  // Both are full role views. Compare invariantTruth blocks and surface
  // any field that differs.
  var drift = [];
  if (!originalView || !replayedView) {
    drift.push({ field: 'view', issue: 'one or both views missing' });
    return drift;
  }
  var fields = ['disposition', 'packageHash', 'hardLockCount', 'unresolvedContradictionCount', 'bindingClausesHash'];
  var origInv = originalView.invariantTruth || {};
  var newInv = replayedView.invariantTruth || {};
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    if (origInv[f] !== newInv[f]) {
      drift.push({ field: 'invariantTruth.' + f, original: origInv[f], replayed: newInv[f] });
    }
  }
  if (originalView.role !== replayedView.role) {
    drift.push({ field: 'role', original: originalView.role, replayed: replayedView.role });
  }
  if (originalView.headline !== replayedView.headline) {
    drift.push({ field: 'headline', original: originalView.headline, replayed: replayedView.headline });
  }
  return drift;
}
exports.handler = async function (event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  try {
    var body = JSON.parse(event.body || '{}');
    var packageHash = body.packageHash;
    var roleContext = body.roleContext;
    var originalViewHash = body.originalViewHash;
    var originalView = body.originalView || null;
    if (!packageHash) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'packageHash required' }) };
    }
    if (!roleContext || !roleContext.role) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'roleContext with role required' }) };
    }
    if (!originalViewHash) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'originalViewHash required for comparison' }) };
    }
    var baseUrl = getBaseUrl(event);
    // Step 1: Fetch the stored DecisionPackage
    var fetchResult = await fetchPackage(baseUrl, packageHash);
    if (!fetchResult.ok) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          ok: true,
          match: false,
          replayFailure: 'PACKAGE_NOT_FOUND',
          message: 'DecisionPackage not in store - replay impossible. This itself is an audit finding.',
          packageHash: packageHash
        })
      };
    }
    // Step 2: Re-run the projection
    var projectionResult = await reproject(baseUrl, fetchResult.decisionPackage, roleContext);
    if (!projectionResult.ok || !projectionResult.view) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          ok: true,
          match: false,
          replayFailure: 'REPROJECT_FAILED',
          message: 'Projection over stored package failed - possible code version drift or package corruption.',
          detail: projectionResult.error || 'unknown'
        })
      };
    }
    // Step 3: Compare hashes
    var replayedViewHash = projectionResult.view.viewHash;
    var match = (replayedViewHash === originalViewHash);
    var report = {
      ok: true,
      match: match,
      packageHash: packageHash,
      role: roleContext.role,
      originalViewHash: originalViewHash,
      replayedViewHash: replayedViewHash,
      packageStoredAt: fetchResult.storedAt,
      replayPerformedAt: new Date().toISOString()
    };
    if (!match) {
      report.replayFailure = 'HASH_MISMATCH';
      report.message = 'Replayed view hash differs from original. Investigate: tampering, code drift, or determinism bug.';
      if (originalView) {
        report.drift = buildDriftReport(originalView, projectionResult.view);
      }
    }
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(report) };
  } catch (e) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Replay failed: ' + (e.message || 'unknown') })
    };
  }
};
