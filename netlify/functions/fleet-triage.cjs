// ============================================================================
// fleet-triage.cjs   (Fleet Triage / multi-asset ranking layer)
// FORGED 4D NDT  -  DEPLOY405
//
// Ranks N assets evaluated by the existing per-asset pipeline into a single
// defensible ORDER OF ACTION. Built for the multi-asset decision under time
// pressure (e.g. several platforms in a hurricane's path): which asset does the
// operator address FIRST?
//
// This is NOT a new diagnosis. It consumes the verdicts the per-asset engines
// already emit (consequence tier, disposition, governing severity, future-state
// verdict, support cascade, organizational-failure score, confidence) plus an
// optional external-threat flag (storm), and produces an auditable urgency
// score per asset. Every point in the score is traceable to a named driver --
// no hidden weighting. This is the Decision-Arbiter principle applied across a
// fleet: surface the ranking and show the work; the operator owns the call.
//
// PURE DETERMINISTIC. No LLM, no network, no clock, no random, no DB. var only,
// string concatenation only, no template literals, no arrow functions.
// ============================================================================
'use strict';

var CONSEQUENCE_POINTS = { CRITICAL: 60, HIGH: 40, MEDIUM: 22, LOW: 8, UNKNOWN: 22 };
var DISPOSITION_POINTS = {
  no_go: 25, "no-go": 25, NO_GO: 25,
  hold_for_review: 15, hold: 15, HOLD_FOR_REVIEW: 15,
  monitor: 5, conditional: 8,
  continue_service: 0, continue: 0, go: 0
};
var SEVERITY_POINTS = { CRITICAL: 12, SEVERE: 9, HIGH: 6, MODERATE: 3, LOW: 1, none: 0, UNDETERMINED: 4 };

function norm(s) { if (s === null || s === undefined) { return ''; } return String(s).toLowerCase().trim(); }
function clamp(x, lo, hi) { if (x < lo) { return lo; } if (x > hi) { return hi; } return x; }

// Score a single asset summary. Returns { score, drivers } where drivers is an
// ordered list of { axis, points, why } so the contribution is fully auditable.
function scoreAsset(asset) {
  var a = asset || {};
  var drivers = [];
  var score = 0;

  var ct = String(a.consequence_tier || 'UNKNOWN').toUpperCase();
  var cPts = (CONSEQUENCE_POINTS[ct] !== undefined) ? CONSEQUENCE_POINTS[ct] : 22;
  score += cPts;
  drivers.push({ axis: 'consequence', points: cPts, why: 'Consequence tier ' + ct });

  var dispKey = norm(a.disposition).replace(/\s+/g, '_');
  var dPts = (DISPOSITION_POINTS[dispKey] !== undefined) ? DISPOSITION_POINTS[dispKey] : (dispKey ? 8 : 0);
  if (dPts > 0) { score += dPts; drivers.push({ axis: 'disposition', points: dPts, why: 'Disposition ' + (a.disposition || dispKey) }); }

  var sev = String(a.governing_severity || 'none').toUpperCase();
  var sPts = (SEVERITY_POINTS[sev] !== undefined) ? SEVERITY_POINTS[sev] : 0;
  if (sPts > 0) { score += sPts; drivers.push({ axis: 'governing_severity', points: sPts, why: 'Governing severity ' + sev + (a.governing_failure_mode ? ' (' + a.governing_failure_mode + ')' : '') }); }

  var fs = a.future_state || null;
  if (fs) {
    var verdict = String(fs.verdict || '').toUpperCase();
    if (verdict === 'BREACH_BEFORE_NEXT_INTERVENTION') {
      score += 12; drivers.push({ axis: 'forward_risk', points: 12, why: 'Forecast to breach minimum before next intervention' + (fs.dominant_driver_label ? ' (' + fs.dominant_driver_label + ')' : '') });
    } else if (verdict.indexOf('DEFERRED') >= 0 || (fs.dominant_driver_label && String(fs.dominant_driver_label).length > 0)) {
      score += 6; drivers.push({ axis: 'forward_risk', points: 6, why: 'Active forward-risk driver' + (fs.dominant_driver_label ? ' (' + fs.dominant_driver_label + ')' : '') });
    }
  }

  if (a.support_cascade) {
    score += 12; drivers.push({ axis: 'support_cascade', points: 12, why: 'Support failure would cascade onto adjacent critical equipment' });
  } else if (a.support_failure_governs) {
    score += 6; drivers.push({ axis: 'support', points: 6, why: 'Degrading support governs over a within-limits primary' });
  }

  var org = Number(a.org_failure_score);
  if (!isNaN(org) && org > 0) {
    var oPts = Math.round((org / 10) * 8);
    if (oPts > 0) { score += oPts; drivers.push({ axis: 'organizational', points: oPts, why: 'Management-system / asset-integrity assurance risk ' + org + '/10' }); }
  }

  var band = String(a.confidence_band || '').toUpperCase();
  if ((band === 'LOW' || band === 'GUARDED') && (ct === 'CRITICAL' || ct === 'HIGH')) {
    score += 8; drivers.push({ axis: 'confidence', points: 8, why: 'Low/guarded confidence on a ' + ct + ' asset -- verify before relying on it' });
  }

  if (a.storm_exposure) {
    score += 15; drivers.push({ axis: 'storm_exposure', points: 15, why: 'In the path of an imminent external threat (storm/hurricane)' });
  }

  score = clamp(Math.round(score), 0, 100);
  drivers.sort(function (x, y) { return y.points - x.points; });
  return { score: score, drivers: drivers };
}

function urgencyBand(score) {
  if (score >= 80) { return 'IMMEDIATE'; }
  if (score >= 60) { return 'PRIORITY'; }
  if (score >= 40) { return 'ELEVATED'; }
  return 'ROUTINE';
}

// CONSEQUENCE-AWARE BAND FLOOR (correctness calibration). The additive score can
// leave a high-consequence asset a hair under a band threshold (HIGH+hold = 55, just
// under PRIORITY's 60) or collapse a MEDIUM asset into ROUTINE alongside a benign LOW.
// The band is a POLICY classification, not a raw-score bucket: a held high-consequence
// asset is at least PRIORITY; a high-consequence asset is never ROUTINE; a medium-
// consequence asset always warrants at least near-term review. Floors only RAISE the
// band, never lower it, and emit a traceable reason (no hidden override). Score and
// sort order are untouched - this relabels the band only.
var BAND_ORDER = { ROUTINE: 0, ELEVATED: 1, PRIORITY: 2, IMMEDIATE: 3 };
function applyBandFloor(band, asset) {
  var ct = String((asset && asset.consequence_tier) || '').toUpperCase();
  var disp = norm(asset && asset.disposition).replace(/\s+/g, '_');
  var withholds = disp.indexOf('hold') >= 0 || disp.indexOf('no_go') >= 0 || disp === 'no-go';
  var floor = 'ROUTINE', why = '';
  if (asset && asset.active_failure) { floor = 'IMMEDIATE'; why = 'confirmed active failure / loss of containment - act now regardless of consequence tier'; }
  else if (ct === 'CRITICAL') { floor = 'PRIORITY'; why = 'CRITICAL-consequence asset is never below PRIORITY'; }
  else if (ct === 'HIGH' && withholds) { floor = 'PRIORITY'; why = 'HIGH-consequence asset withholding continued-service approval (hold/no-go)'; }
  else if (ct === 'HIGH') { floor = 'ELEVATED'; why = 'HIGH-consequence asset is never ROUTINE'; }
  else if (ct === 'MEDIUM') { floor = 'ELEVATED'; why = 'MEDIUM-consequence asset warrants at least near-term review'; }
  if (BAND_ORDER[floor] > BAND_ORDER[band]) { return { band: floor, reason: 'band floored to ' + floor + ': ' + why }; }
  return { band: band, reason: null };
}

function recommendedAction(band, asset) {
  if (band === 'IMMEDIATE') {
    return 'Address first. Shut-in / protective-action candidate; resolve or verify before the asset is relied upon' + (asset && asset.storm_exposure ? ' or the storm arrives.' : '.');
  }
  if (band === 'PRIORITY') {
    return 'Address early. Engineering review and required NDE before continued-service approval.';
  }
  if (band === 'ELEVATED') {
    return 'Schedule near-term review; monitor for change.';
  }
  return 'Routine handling; no elevated action indicated.';
}

function consequenceRank(ct) {
  var t = String(ct || '').toUpperCase();
  if (t === 'CRITICAL') { return 4; } if (t === 'HIGH') { return 3; } if (t === 'MEDIUM' || t === 'UNKNOWN') { return 2; } return 1;
}

// Public: rank a fleet of asset summaries. params = { assets: [...] }.
function rankFleet(params) {
  var p = params || {};
  var assets = (p.assets && p.assets.length) ? p.assets : [];
  var scored = [];

  for (var i = 0; i < assets.length; i++) {
    var a = assets[i] || {};
    var res = scoreAsset(a);
    var scoreBand = urgencyBand(res.score);
    var floored = applyBandFloor(scoreBand, a);
    var band = floored.band;
    scored.push({
      name: a.name || a.asset_id || ('Asset ' + (i + 1)),
      consequence_tier: a.consequence_tier || 'UNKNOWN',
      disposition: a.disposition || null,
      governing_failure_mode: a.governing_failure_mode || null,
      suspected: a.suspected || null,
      urgency_score: res.score,
      urgency_band: band,
      band_floor_reason: floored.reason,
      drivers: res.drivers,
      recommended_action: recommendedAction(band, a),
      input_index: i
    });
  }

  scored.sort(function (x, y) {
    if (y.urgency_score !== x.urgency_score) { return y.urgency_score - x.urgency_score; }
    var cr = consequenceRank(y.consequence_tier) - consequenceRank(x.consequence_tier);
    if (cr !== 0) { return cr; }
    return x.input_index - y.input_index;
  });

  var criticalCount = 0, immediateCount = 0, holdCount = 0;
  for (var j = 0; j < scored.length; j++) {
    scored[j].urgency_rank = j + 1;
    if (String(scored[j].consequence_tier).toUpperCase() === 'CRITICAL') { criticalCount++; }
    if (scored[j].urgency_band === 'IMMEDIATE') { immediateCount++; }
    var dk = norm(scored[j].disposition).replace(/\s+/g, '_');
    if (dk.indexOf('hold') >= 0 || dk.indexOf('no_go') >= 0 || dk === 'no-go') { holdCount++; }
  }

  var narrative;
  if (scored.length === 0) {
    narrative = 'No assets supplied.';
  } else {
    var first = scored[0];
    narrative = 'Act first on ' + first.name + ' (' + first.urgency_band + ', score ' + first.urgency_score + '/100, ' + String(first.consequence_tier).toUpperCase() + ').';
    if (scored.length > 1) {
      narrative += ' ' + immediateCount + ' immediate, ' + criticalCount + ' CRITICAL-consequence, ' + holdCount + ' withholding continued-service approval, across ' + scored.length + ' assets.';
    }
  }

  return {
    ranked: scored,
    fleet_summary: {
      count: scored.length,
      immediate_count: immediateCount,
      critical_count: criticalCount,
      hold_count: holdCount,
      highest: scored.length > 0 ? scored[0].name : null,
      narrative: narrative
    },
    count: scored.length,
    engine: 'fleet-triage',
    version: '1.0.0'
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
    var result = rankFleet({ assets: body.assets || [] });
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(result) };
  } catch (err) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'fleet-triage failed: ' + (err && err.message ? err.message : 'unknown error') }) };
  }
}

module.exports = { rankFleet: rankFleet, scoreAsset: scoreAsset, urgencyBand: urgencyBand, handler: handler };
