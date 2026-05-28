// FORGED NDT Intelligence OS - DecisionPackage Persistent Store
// DEPLOY##X / v##.x
//
// Stores DecisionPackages by their packageHash. Idempotent: writing the same
// package twice is a no-op. Backed by Netlify Blobs.
//
// Endpoints:
//   POST /package-store          - store a package, returns { hash }
//   GET  /package-store?hash=X   - retrieve a package by hash
//   GET  /package-store/list     - list recent stored package hashes
'use strict';
// DEPLOY355 - @netlify/blobs is ESM-only; use dynamic import() instead of require()
var blobsModule = null;
async function loadBlobs() {
  if (blobsModule) return blobsModule;
  try {
    blobsModule = await import('@netlify/blobs');
    return blobsModule;
  } catch (e) {
    console.log('[package-store] Failed to import @netlify/blobs: ' + (e.message || e));
    return null;
  }
}
var crypto = require('crypto');
var CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};
var STORE_NAME = 'pil-package-store';
async function getStore() {
  var blobs = await loadBlobs();
  if (!blobs || !blobs.getStore) return null;
  try {
    return blobs.getStore(STORE_NAME);
  } catch (e) {
    console.log('[package-store] Failed to get store: ' + (e.message || e));
    return null;
  }
}
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(function (item) { return stableStringify(item); }).join(',') + ']';
  }
  var keys = Object.keys(value).sort();
  return '{' + keys.map(function (key) {
    return JSON.stringify(key) + ':' + stableStringify(value[key]);
  }).join(',') + '}';
}
function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}
async function storePackage(pkg) {
  var store = await getStore();
  if (!store) {
    return { ok: false, error: 'Package store unavailable', fallback: true };
  }
  // Compute hash if not already present
  var hash = pkg.packageHash || sha256(stableStringify(pkg));
  try {
    // Check if already stored (idempotent)
    var existing = await store.get(hash, { type: 'json' });
    if (existing) {
      return { ok: true, hash: hash, alreadyStored: true };
    }
    // Add storage metadata
    var record = {
      packageHash: hash,
      storedAt: new Date().toISOString(),
      decisionPackage: pkg
    };
    await store.setJSON(hash, record);
    return { ok: true, hash: hash, alreadyStored: false };
  } catch (e) {
    return { ok: false, error: e.message || 'store failed' };
  }
}
async function fetchPackage(hash) {
  var store = await getStore();
  if (!store) return { ok: false, error: 'Package store unavailable' };
  try {
    var record = await store.get(hash, { type: 'json' });
    if (!record) return { ok: false, error: 'Package not found', notFound: true };
    return { ok: true, packageHash: hash, storedAt: record.storedAt, decisionPackage: record.decisionPackage };
  } catch (e) {
    return { ok: false, error: e.message || 'fetch failed' };
  }
}
async function listPackages(limit) {
  var store = await getStore();
  if (!store) return { ok: false, hashes: [] };
  try {
    var list = await store.list();
    var hashes = list.blobs.map(function (b) { return b.key; });
    if (limit && typeof limit === 'number' && limit > 0) {
      hashes = hashes.slice(0, limit);
    }
    return { ok: true, hashes: hashes, count: hashes.length };
  } catch (e) {
    return { ok: false, error: e.message || 'list failed', hashes: [] };
  }
}
exports.handler = async function (event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod === 'POST') {
    try {
      var body = JSON.parse(event.body || '{}');
      var pkg = body.decisionPackage;
      if (!pkg || typeof pkg !== 'object') {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'decisionPackage required' }) };
      }
      var result = await storePackage(pkg);
      var status = result.ok ? 200 : 500;
      return { statusCode: status, headers: CORS_HEADERS, body: JSON.stringify(result) };
    } catch (e) {
      return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'store failed: ' + (e.message || 'unknown') }) };
    }
  }
  if (event.httpMethod === 'GET') {
    var params = event.queryStringParameters || {};
    if (params.list === 'true') {
      var limit = params.limit ? parseInt(params.limit, 10) : 50;
      var listResult = await listPackages(limit);
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(listResult) };
    }
    if (params.hash) {
      var fetchResult = await fetchPackage(params.hash);
      var status = fetchResult.ok ? 200 : (fetchResult.notFound ? 404 : 500);
      return { statusCode: status, headers: CORS_HEADERS, body: JSON.stringify(fetchResult) };
    }
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'hash parameter required, or list=true' }) };
  }
  return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
};
