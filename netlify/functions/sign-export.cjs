// netlify/functions/sign-export.cjs
// FORGED NDT Intelligence OS - Cryptographic Signing of Exports
// DEPLOY##X / v##.x
//
// Signs exported audit content with HMAC-SHA256. A regulator with the
// matching secret can verify offline that the exported content hasn't
// been modified since signing.
//
// Note: for true public verifiability without shared secrets, migrate to
// RSA/ECDSA asymmetric signing in a v2. HMAC is sufficient for v1 where
// the verification is performed by a trusted internal auditor.
//
// Env vars required:
//   PIL_SIGN_KEY_CURRENT - the current signing secret
//   PIL_SIGN_KEY_ID      - the identifier for the current key (e.g., '2026-Q2')
//   PIL_SIGN_KEY_PREV    - (optional) previous secret for verification only
//   PIL_SIGN_KEY_PREV_ID - (optional) previous key id
//
// Endpoints:
//   POST /sign-export           - sign content
//   POST /sign-export/verify    - verify a signature
'use strict';
var crypto = require('crypto');
var CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
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
function sha256Hex(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}
function hmacSha256Hex(secret, message) {
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}
function getKey(keyId) {
  var currentId = process.env.PIL_SIGN_KEY_ID || '';
  var currentSecret = process.env.PIL_SIGN_KEY_CURRENT || '';
  var prevId = process.env.PIL_SIGN_KEY_PREV_ID || '';
  var prevSecret = process.env.PIL_SIGN_KEY_PREV || '';
  if (keyId === currentId && currentSecret) return { secret: currentSecret, id: currentId };
  if (keyId === prevId && prevSecret) return { secret: prevSecret, id: prevId };
  if (!keyId && currentSecret) return { secret: currentSecret, id: currentId };
  return null;
}
function buildSignaturePayload(content, metadata) {
  // Canonical payload that gets signed. Includes content hash + metadata.
  return stableStringify({
    contentHash: sha256Hex(typeof content === 'string' ? content : stableStringify(content)),
    metadata: metadata || {}
  });
}
exports.handler = async function (event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  var path = event.path || '';
  var isVerify = path.indexOf('/verify') >= 0 || (event.queryStringParameters && event.queryStringParameters.action === 'verify');
  try {
    var body = JSON.parse(event.body || '{}');
    if (!isVerify) {
      // SIGN
      var content = body.content;
      if (content === undefined || content === null) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'content required' }) };
      }
      var metadata = {
        signedAt: new Date().toISOString(),
        signedBy: body.userId || 'unknown',
        role: body.role || 'unknown',
        exportType: body.exportType || 'unspecified',
        packageHash: body.packageHash || null
      };
      var key = getKey(null);
      if (!key) {
        return {
          statusCode: 503,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            error: 'Signing not configured',
            detail: 'Set PIL_SIGN_KEY_CURRENT and PIL_SIGN_KEY_ID env vars in Netlify'
          })
        };
      }
      var payload = buildSignaturePayload(content, metadata);
      var signature = hmacSha256Hex(key.secret, payload);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          ok: true,
          signature: signature,
          signerKeyId: key.id,
          algorithm: 'HMAC-SHA256',
          contentHash: sha256Hex(typeof content === 'string' ? content : stableStringify(content)),
          metadata: metadata,
          verificationNote: 'To verify: POST /sign-export/verify with { content, signature, signerKeyId, metadata }'
        })
      };
    } else {
      // VERIFY
      var vContent = body.content;
      var vSignature = body.signature;
      var vKeyId = body.signerKeyId;
      var vMetadata = body.metadata;
      if (vContent === undefined || !vSignature || !vKeyId || !vMetadata) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'content, signature, signerKeyId, and metadata required' }) };
      }
      var vKey = getKey(vKeyId);
      if (!vKey) {
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ ok: true, valid: false, reason: 'Unknown signerKeyId: ' + vKeyId })
        };
      }
      var vPayload = buildSignaturePayload(vContent, vMetadata);
      var expected = hmacSha256Hex(vKey.secret, vPayload);
      var valid = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(vSignature, 'hex'));
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          ok: true,
          valid: valid,
          signerKeyId: vKey.id,
          algorithm: 'HMAC-SHA256'
        })
      };
    }
  } catch (e) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Sign operation failed: ' + (e.message || 'unknown') })
    };
  }
};
