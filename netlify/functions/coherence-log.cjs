// netlify/functions/coherence-log.cjs
// FORGED NDT Intelligence OS - Coherence Log + Chain-of-Custody (Hardened)
// DEPLOY##X / v##.x
//
// Two record types share one store:
//   - PROJECTION records (existing): one per role projection generated
//   - CUSTODY records (new): one per audit interaction (view/export/sign/etc)
//
// Endpoints:
//   POST   /coherence-log                              - write projection record
//   POST   /coherence-log?type=custody                 - write custody event
//   GET    /coherence-log?packageHash=X                - list all records for pkg
//   GET    /coherence-log?packageHash=X&check=coherence - run coherence audit
//   GET    /coherence-log?limit=N                      - recent records
//   GET    /coherence-log?packageHash=X&type=custody   - custody events only
'use strict';
// DEPLOY355 - @netlify/blobs is ESM-only; use dynamic import() instead of require()
var blobsModule = null;
async function loadBlobs() {
  if (blobsModule) return blobsModule;
  try {
    blobsModule = await import('@netlify/blobs');
    return blobsModule;
  } catch (e) {
    console.log('[coherence-log] Failed to import @netlify/blobs: ' + (e.message || e));
    return null;
  }
}
var CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};
var STORE_NAME = 'pil-coherence-log';
var CUSTODY_EVENT_TYPES = [
  'VIEWED',
  'EXPORTED',
  'ACKNOWLEDGED',
  'ESCALATED',
  'SIGNED',
  'COMMENTED',
  'REPLAYED'
];
async function getStore() {
  var blobs = await loadBlobs();
  if (!blobs || !blobs.getStore) return null;
  try {
    // DEPLOY356 - Try implicit context first; fall back to explicit siteID+token
    var siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
    var token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_API_TOKEN;
    if (siteID && token) {
      return blobs.getStore({ name: STORE_NAME, siteID: siteID, token: token });
    }
    return blobs.getStore(STORE_NAME);
  } catch (e) {
    console.log('[coherence-log] Failed to get store: ' + (e.message || e));
    return null;
  }
}
// ============================================================================
// WRITE PROJECTION RECORD (existing pattern)
// Key: PROJ:<packageHash>:<timestamp>:<role>
// ============================================================================
async function writeProjectionRecord(record) {
  var store = await getStore();
  if (!store) {
    console.log('[PIL_COHERENCE_FALLBACK]', JSON.stringify(record));
    return { ok: false, fallback: true };
  }
  var key = 'PROJ:' + (record.packageHash || 'no-hash') + ':' + (record.timestamp || new Date().toISOString()) + ':' + (record.role || 'unknown');
  try {
    record.recordType = 'PROJECTION';
    await store.setJSON(key, record);
    return { ok: true, key: key };
  } catch (e) {
    return { ok: false, error: e.message || 'write failed' };
  }
}
// ============================================================================
// WRITE CUSTODY RECORD (new)
// Key: CUST:<packageHash>:<timestamp>:<userId>
// ============================================================================
async function writeCustodyRecord(record) {
  var store = await getStore();
  if (!store) {
    console.log('[PIL_CUSTODY_FALLBACK]', JSON.stringify(record));
    return { ok: false, fallback: true };
  }
  if (!record.eventType || CUSTODY_EVENT_TYPES.indexOf(record.eventType) < 0) {
    return { ok: false, error: 'Invalid eventType. Must be one of: ' + CUSTODY_EVENT_TYPES.join(', ') };
  }
  if (!record.userId || !record.role) {
    return { ok: false, error: 'userId and role are required for custody events' };
  }
  if (!record.packageHash) {
    return { ok: false, error: 'packageHash is required for custody events' };
  }
  var ts = record.timestamp || new Date().toISOString();
  record.timestamp = ts;
  record.recordType = 'CUSTODY';
  var key = 'CUST:' + record.packageHash + ':' + ts + ':' + record.userId;
  try {
    await store.setJSON(key, record);
    return { ok: true, key: key };
  } catch (e) {
    return { ok: false, error: e.message || 'write failed' };
  }
}
// ============================================================================
// READ BY PACKAGE HASH (with optional type filter)
// ============================================================================
async function readByPackageHash(packageHash, typeFilter) {
  var store = await getStore();
  if (!store) return { ok: false, records: [] };
  try {
    var prefixes = [];
    if (typeFilter === 'projection') prefixes.push('PROJ:' + packageHash + ':');
    else if (typeFilter === 'custody') prefixes.push('CUST:' + packageHash + ':');
    else prefixes.push('PROJ:' + packageHash + ':', 'CUST:' + packageHash + ':');
    var records = [];
    for (var i = 0; i < prefixes.length; i++) {
      var list = await store.list({ prefix: prefixes[i] });
      for (var j = 0; j < list.blobs.length; j++) {
        var rec = await store.get(list.blobs[j].key, { type: 'json' });
        if (rec) records.push(rec);
      }
    }
    records.sort(function (a, b) {
      return (a.timestamp || '').localeCompare(b.timestamp || '');
    });
    return { ok: true, records: records };
  } catch (e) {
    return { ok: false, error: e.message || 'read failed', records: [] };
  }
}
// ============================================================================
// READ RECENT
// ============================================================================
async function readRecent(sinceIso, limit) {
  var store = await getStore();
  if (!store) return { ok: false, records: [] };
  try {
    var list = await store.list();
    var records = [];
    for (var i = 0; i < list.blobs.length; i++) {
      var rec = await store.get(list.blobs[i].key, { type: 'json' });
      if (rec && (!sinceIso || (rec.timestamp || '') >= sinceIso)) {
        records.push(rec);
      }
    }
    records.sort(function (a, b) {
      return (b.timestamp || '').localeCompare(a.timestamp || '');
    });
    if (limit && typeof limit === 'number' && limit > 0) {
      records = records.slice(0, limit);
    }
    return { ok: true, records: records };
  } catch (e) {
    return { ok: false, error: e.message || 'read failed', records: [] };
  }
}
// ============================================================================
// CROSS-ROLE REALITY CONSISTENCY ENGINE (GPT brief #1, expanded)
// ============================================================================
async function checkCoherence(packageHash) {
  var read = await readByPackageHash(packageHash, 'projection');
  if (!read.ok) return { ok: false, violations: [] };
  var records = read.records;
  if (records.length < 2) return { ok: true, violations: [], roleCount: records.length };
  var violations = [];
  var byRole = {};
  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    byRole[r.role] = r;
  }
  var roles = Object.keys(byRole);
  // Rule 1: Disposition divergence
  var dispositions = roles.map(function (r) { return byRole[r].disposition; });
  var uniqueDispositions = dispositions.filter(function (d, idx, arr) { return arr.indexOf(d) === idx; });
  if (uniqueDispositions.length > 1) {
    violations.push({
      type: 'DISPOSITION_DIVERGENCE',
      description: 'Role views logged different dispositions for the same package',
      detail: { byRole: dispositions, unique: uniqueDispositions }
    });
  }
  // Rule 2: Hard-lock count divergence (any role sees a different number)
  var hlCounts = roles.map(function (r) { return byRole[r].hardLockCount || 0; });
  var hlUnique = hlCounts.filter(function (c, idx, arr) { return arr.indexOf(c) === idx; });
  if (hlUnique.length > 1) {
    violations.push({
      type: 'HARD_LOCK_COUNT_DIVERGENCE',
      description: 'Different role views recorded different hard-lock counts',
      detail: { byRole: roles.map(function (r, i) { return { role: r, count: hlCounts[i] }; }) }
    });
  }
  // Rule 3: Unresolved contradiction count divergence
  var contraCounts = roles.map(function (r) { return byRole[r].unresolvedContradictionCount || 0; });
  var contraUnique = contraCounts.filter(function (c, idx, arr) { return arr.indexOf(c) === idx; });
  if (contraUnique.length > 1) {
    violations.push({
      type: 'UNRESOLVED_CONTRADICTION_COUNT_DIVERGENCE',
      description: 'Role views logged different unresolved-contradiction counts',
      detail: { byRole: roles.map(function (r, i) { return { role: r, count: contraCounts[i] }; }) }
    });
  }
  // Rule 4: Suppressed safety disposition (any safety-critical disp not seen by all roles)
  var safetyCriticalDispositions = ['REJECT_FROM_SERVICE', 'REPORT_TO_JURISDICTIONAL_AUTHORITY', 'HOLD_FOR_INPUT', 'HALT_AND_ESCALATE'];
  for (var k = 0; k < safetyCriticalDispositions.length; k++) {
    var d = safetyCriticalDispositions[k];
    var anyHas = roles.some(function (r) { return byRole[r].disposition === d; });
    var allHave = roles.every(function (r) { return byRole[r].disposition === d; });
    if (anyHas && !allHave) {
      violations.push({
        type: 'SUPPRESSED_SAFETY_DISPOSITION',
        description: 'Safety-critical disposition ' + d + ' was visible to some roles but not all',
        detail: { disposition: d, rolesWithDisposition: roles.filter(function (r) { return byRole[r].disposition === d; }), allRoles: roles }
      });
    }
  }
  return { ok: true, violations: violations, roleCount: records.length };
}
// ============================================================================
// HANDLER
// ============================================================================
exports.handler = async function (event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }
  var params = event.queryStringParameters || {};
  if (event.httpMethod === 'POST') {
    try {
      var body = JSON.parse(event.body || '{}');
      var recordType = (params.type === 'custody') ? 'custody' : 'projection';
      var result;
      if (recordType === 'custody') {
        result = await writeCustodyRecord(body);
      } else {
        if (!body.packageHash || !body.role) {
          return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'packageHash and role required for projection records' }) };
        }
        body.timestamp = body.timestamp || new Date().toISOString();
        result = await writeProjectionRecord(body);
      }
      return { statusCode: result.ok ? 200 : 500, headers: CORS_HEADERS, body: JSON.stringify(result) };
    } catch (e) {
      return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'write failed: ' + (e.message || 'unknown') }) };
    }
  }
  if (event.httpMethod === 'GET') {
    if (params.packageHash) {
      if (params.check === 'coherence') {
        var coherence = await checkCoherence(params.packageHash);
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(coherence) };
      }
      var typeFilter = params.type || null;
      var byHash = await readByPackageHash(params.packageHash, typeFilter);
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(byHash) };
    }
    var since = params.since || null;
    var limit = params.limit ? parseInt(params.limit, 10) : 50;
      var recent = await readRecent(since, limit);
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(recent) };
  }
  return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
};
