// ============================================================================
// fleet-systemic.cjs   (Fleet Systemic composition - one call for the panel)
// FORGED 4D NDT  -  DEPLOY416
//
// Composes the per-asset PERIPHERAL extraction and the cohort-aware AGGREGATION
// into a single program-level call for the /fleet "Systemic Patterns" panel:
//   for each asset:  transcript -> extractPeripheralsFromText -> scoreReferrals
//                    -> flagsFromReferrals  (REFER actors only)
//   then:            aggregatePeripherals over the fleet (CLUSTER / PREVALENCE /
//                    PREVALENCE_PROVISIONAL / ELEVATED_NO_CONTRAST)
//
// PARALLEL by construction: returns program-level findings ONLY. It is handed the
// per-asset transcripts but never the ranked urgency, and it returns nothing that
// re-ranks or dispositions an asset. PURE DETERMINISTIC (composes two pure engines).
// ============================================================================
'use strict';
var PER = require('./peripheral-referral.cjs');
var AGG = require('./fleet-peripheral-aggregation.cjs');

function buildAssetFlags(asset) {
  var transcript = (asset && asset.transcript) || '';
  var tier = (asset && asset.consequence_tier) || 'HIGH';
  var scored = PER.scoreReferrals(PER.extractPeripheralsFromText(transcript, tier)).referrals;
  return AGG.flagsFromReferrals(scored);
}

function computeSystemic(body) {
  var assetsIn = (body && body.assets) || [];
  var context = (body && body.context) || null;
  var assets = [];
  for (var i = 0; i < assetsIn.length; i++) {
    var a = assetsIn[i] || {};
    assets.push({ id: a.id || ('asset_' + (i + 1)), cohort: a.cohort || 'fleet', flags: buildAssetFlags(a) });
  }
  var expected = context ? AGG.buildExpectedRates(context) : {};
  var findings = AGG.aggregatePeripherals({ assets: assets, expected_rates: expected }, AGG.CONFIG);
  return {
    ok: true,
    asset_count: assets.length,
    systemic_findings: findings,
    note: 'PROGRAM-LEVEL findings for the integrity/reliability owner. This layer never dispositions an asset and never re-ranks the fleet order of action.'
  };
}

var CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};
var authGuard = require('./auth-guard.cjs');
async function handler(event) {
  if (event.httpMethod === 'OPTIONS') { return { statusCode: 200, headers: CORS_HEADERS, body: '' }; }
  if (event.httpMethod !== 'POST') { return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }; }
  var __auth = await authGuard.verifyAuth(event); if (!__auth.ok) { return authGuard.denyResponse(__auth, CORS_HEADERS); }
  try {
    var body = JSON.parse(event.body || '{}');
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(computeSystemic(body)) };
  } catch (e) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: String((e && e.message) || e) }) };
  }
}
module.exports = { buildAssetFlags: buildAssetFlags, computeSystemic: computeSystemic, handler: handler };
