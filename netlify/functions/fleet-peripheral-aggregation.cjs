// ============================================================================
// fleet-peripheral-aggregation.cjs   (Fleet Peripheral Aggregation - systemic)
// FORGED 4D NDT  -  DEPLOY414
//
// Turns per-asset PERIPHERAL REFERRALS (from peripheral-referral.cjs) into
// PROGRAM-LEVEL findings. The point is NOT "many assets flagged X" (corrosion is
// common -> that floods, the fleet-scale alarm flood). The signal is "more than
// the shared context predicts", which splits into two genuinely different signals:
//
//   CLUSTER     a cohort's incidence of actor X far exceeds the REST of the fleet
//               -> localized common cause (coating batch, one environment, one
//               install crew). Needs no external data.
//   PREVALENCE  fleet-wide incidence of X exceeds an EXPECTED rate for the context
//               -> fleet-wide systemic (CP / coating program failing). Needs an
//               expected rate; without one it degrades honestly to
//               ELEVATED_NO_CONTRAST ("high, but cannot confirm systemic").
//
// PARALLEL OUTPUT, by design: a program-level recommendation to the integrity /
// reliability owner. It NEVER dispositions an asset and NEVER re-ranks the fleet
// order of action. (Keeping it out of per-asset urgency is deliberate - a program
// issue like "review the CP program" is not a reason to bump asset 7's urgency.)
//
// EXPECTED-RATE DISCIPLINE: the baseline is anchored to what SOUND assets show
// (literature / expert prior), NOT the fleet's own running average. Observation
// may refine it DOWN automatically (safe: more sensitive); it may only be revised
// UP behind HUMAN REVIEW (gated). Otherwise a fleet-wide failure silently becomes
// its own baseline and the signal goes quiet exactly when the problem is worst
// (normalization of deviance: Piper Alpha, Columbia).
//
// PURE DETERMINISTIC. No LLM, no network, no clock, no random, no DB. var only,
// string concatenation only, no template literals, no arrow functions.
// ============================================================================
'use strict';

var CONFIG = {
  MIN_AFFECTED: 3,            // don't call 2 assets a pattern
  MIN_COHORT: 3,             // don't trust a rate from a 2-asset cohort
  EXCESS_MARGIN: 0.30,       // how far over baseline counts as a signal
  HIGH_PREVALENCE_FLOOR: 0.6 // uniform prevalence worth flagging when no expected rate exists
};

// ---- EXPECTED-RATE TABLE (sound-asset anchored; key = actor '|' context) ----
// HONESTY (DEPLOY415): the anchor VALUES below are UNSOURCED PLACEHOLDERS - illustrative
// numbers chosen by me, NOT taken from any published study or fleet history. The STRUCTURE
// (sound-asset anchoring, guarded up-revision, degrade-to-ELEVATED_NO_CONTRAST) is real and
// tested; the NUMBERS are not yet defensible. Until these are replaced with sourced values,
// any PREVALENCE finding is PROVISIONAL. CLUSTER needs none of this table (cohort-vs-rest is
// self-contained) and is the half that can be trusted today. source: 'PLACEHOLDER' marks this.
var EXPECTED_RATES = {
  'fixed_support|marine_splash': { anchor: 0.30, source: 'PLACEHOLDER', observed_mean: null, observed_n: 0, confidence: 'LOW', effective_expected: 0.30, review_pending: false, review_note: 'UNSOURCED placeholder anchor - replace before relying on PREVALENCE', last_reviewed: '2026-05-30' },
  'fixed_support|inland_dry':    { anchor: 0.05, source: 'PLACEHOLDER', observed_mean: null, observed_n: 0, confidence: 'LOW', effective_expected: 0.05, review_pending: false, review_note: 'UNSOURCED placeholder anchor - replace before relying on PREVALENCE', last_reviewed: '2026-05-30' },
  'insulation|insulated_hot':    { anchor: 0.40, source: 'PLACEHOLDER', observed_mean: null, observed_n: 0, confidence: 'LOW', effective_expected: 0.40, review_pending: false, review_note: 'UNSOURCED placeholder anchor - replace before relying on PREVALENCE', last_reviewed: '2026-05-30' }
  // Missing key => no expected rate => PREVALENCE degrades to ELEVATED_NO_CONTRAST,
  // never a false "systemic." The table need not be complete to ship.
};

function confidenceFor(n) { return n >= 20 ? 'HIGH' : (n >= 5 ? 'MEDIUM' : 'LOW'); }

// GUARDED revision: refines DOWN automatically, gates UP behind human review.
function updateExpected(entry, observed_rate, observed_n) {
  var prevN = entry.observed_n || 0;
  var prevMean = (entry.observed_mean == null) ? observed_rate : entry.observed_mean;
  var n = prevN + observed_n;
  var blended = (prevMean * prevN + observed_rate * observed_n) / n;
  entry.observed_mean = blended;
  entry.observed_n = n;
  entry.confidence = confidenceFor(n);
  if (blended <= entry.anchor) {
    entry.effective_expected = blended;
    entry.review_pending = false;
  } else {
    entry.effective_expected = entry.anchor;   // CLAMP: our own degradation cannot raise the bar
    entry.review_pending = true;
    entry.review_note = 'observed (' + blended.toFixed(2) + ') sustained above sound-asset anchor (' + entry.anchor.toFixed(2) + '): HUMAN REVIEW -- program failure vs. genuine context. Do not auto-raise.';
  }
  return entry;
}

// Build the actor->expected map for a given context (what aggregatePeripherals consumes).
// Returns OBJECTS carrying provenance ({rate, confidence, source, observed_n}) so the
// PREVALENCE branch can gate signal STRENGTH on whether the anchor is actually backed.
// (A plain number is also accepted by aggregatePeripherals and treated as caller-asserted
// /confident - that is the path the gate's hand-specified rates use.)
function buildExpectedRates(context) {
  var out = {};
  if (!context) { return out; }
  var keys = Object.keys(EXPECTED_RATES);
  for (var i = 0; i < keys.length; i++) {
    var parts = keys[i].split('|');
    if (parts[1] === context) {
      var e = EXPECTED_RATES[keys[i]];
      out[parts[0]] = { rate: e.effective_expected, confidence: e.confidence, source: e.source, observed_n: e.observed_n };
    }
  }
  return out;
}
// An expected rate can produce a CONFIRMED PREVALENCE only if it is actually backed:
// not a PLACEHOLDER, not LOW confidence, and validated by at least a few observations.
// Otherwise the structure forbids a confident systemic call - it degrades to PROVISIONAL.
// A plain number (no provenance) is treated as caller-asserted/confident.
function resolveExpected(exp) {
  if (typeof exp === 'number') { return { rate: exp, confident: true }; }
  if (exp && typeof exp === 'object') {
    var r = (exp.rate != null) ? exp.rate : exp.effective_expected;
    var confident = !(exp.source === 'PLACEHOLDER' || exp.confidence === 'LOW' || (exp.observed_n || 0) < 5);
    return { rate: r, confident: confident };
  }
  return { rate: null, confident: false };
}

// Convert a per-asset peripheral-referral result into the flags[] this engine wants:
// the actor classes that asset emitted a REFER for (NOTE/SUPPRESS do not count).
function flagsFromReferrals(scoredReferrals) {
  var flags = [];
  var list = scoredReferrals || [];
  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    if (r && r.routing && r.routing.action === 'REFER' && r.secondary_asset && r.secondary_asset.type) {
      if (flags.indexOf(r.secondary_asset.type) < 0) { flags.push(r.secondary_asset.type); }
    }
  }
  return flags;
}

function rate(hits, n) { return n > 0 ? hits / n : 0; }

// fleet = { assets: [{ id, cohort, flags:[actor,...] }], expected_rates?: {actor:rate} }
function aggregatePeripherals(fleet, config) {
  config = config || CONFIG;
  var assets = (fleet && fleet.assets) || [];
  var N = assets.length;
  var expected = (fleet && fleet.expected_rates) || {};

  var actors = {};
  for (var i = 0; i < assets.length; i++) {
    var fl = assets[i].flags || [];
    for (var f = 0; f < fl.length; f++) { actors[fl[f]] = true; }
  }

  var findings = [];
  Object.keys(actors).forEach(function (actor) {
    function flags(a) { return (a.flags || []).indexOf(actor) >= 0; }
    var fleetHits = assets.filter(flags).length;
    var fleetRate = rate(fleetHits, N);

    // CLUSTER: cohort vs rest-of-fleet
    var cohorts = {};
    assets.forEach(function (a) { (cohorts[a.cohort] = cohorts[a.cohort] || []).push(a); });
    var clustered = false;
    Object.keys(cohorts).forEach(function (ck) {
      var grp = cohorts[ck];
      if (grp.length < config.MIN_COHORT) { return; }
      var hits = grp.filter(flags).length;
      var cRate = rate(hits, grp.length);
      var restRate = rate(fleetHits - hits, N - grp.length);
      if (hits >= config.MIN_AFFECTED && (cRate - restRate) >= config.EXCESS_MARGIN) {
        findings.push({ actor: actor, signal: 'CLUSTER', cohort: ck, observed: cRate, baseline: restRate, n: hits,
          recommendation: 'Program review (integrity/reliability owner): ' + actor + ' degradation clusters in cohort "' + ck + '" (' + Math.round(cRate * 100) + '% vs ' + Math.round(restRate * 100) + '% rest-of-fleet) - investigate localized common cause (coating batch / environment / install crew).' });
        clustered = true;
      }
    });

    // PREVALENCE: fleet vs expected rate (or honest degrade)
    var exp = (expected[actor] != null) ? resolveExpected(expected[actor]) : null;
    if (exp != null && exp.rate != null) {
      if (fleetHits >= config.MIN_AFFECTED && (fleetRate - exp.rate) >= config.EXCESS_MARGIN) {
        if (exp.confident) {
          findings.push({ actor: actor, signal: 'PREVALENCE', cohort: 'fleet', observed: fleetRate, baseline: exp.rate, n: fleetHits,
            recommendation: 'Program review (integrity/reliability owner): fleet-wide ' + actor + ' incidence (' + Math.round(fleetRate * 100) + '%) exceeds the sound-asset expected rate (' + Math.round(exp.rate * 100) + '%) - investigate a fleet-wide systemic cause (CP / coating program).' });
        } else {
          // anchor is unsourced/LOW-confidence -> structurally cannot confirm systemic
          findings.push({ actor: actor, signal: 'PREVALENCE_PROVISIONAL', cohort: 'fleet', observed: fleetRate, baseline: exp.rate, n: fleetHits,
            recommendation: 'PROVISIONAL (integrity/reliability owner): fleet-wide ' + actor + ' incidence (' + Math.round(fleetRate * 100) + '%) exceeds an UNSOURCED placeholder expected rate (' + Math.round(exp.rate * 100) + '%) - cannot confirm systemic until a sourced/validated rate backs it. Treat as a flag to establish the baseline, not as a confirmed program failure.' });
        }
      }
    } else if (!clustered && fleetHits >= config.MIN_AFFECTED && fleetRate >= config.HIGH_PREVALENCE_FLOOR) {
      findings.push({ actor: actor, signal: 'ELEVATED_NO_CONTRAST', cohort: 'fleet', observed: fleetRate, baseline: null, n: fleetHits,
        recommendation: 'Note (integrity/reliability owner): fleet-wide ' + actor + ' incidence is high (' + Math.round(fleetRate * 100) + '%) but no sound-asset expected rate exists for this context - cannot confirm systemic. Establish an expected rate.' });
    }
  });
  return findings;
}

var CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

async function handler(event) {
  if (event.httpMethod === 'OPTIONS') { return { statusCode: 200, headers: CORS_HEADERS, body: '' }; }
  if (event.httpMethod !== 'POST') { return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }; }
  try {
    var body = JSON.parse(event.body || '{}');
    var expected = body.expected_rates || (body.context ? buildExpectedRates(body.context) : {});
    var findings = aggregatePeripherals({ assets: body.assets || [], expected_rates: expected }, CONFIG);
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({
      ok: true,
      asset_count: (body.assets || []).length,
      systemic_findings: findings,
      note: 'PROGRAM-LEVEL findings for the integrity/reliability owner. This layer never dispositions an asset and never re-ranks the fleet order of action. PREVALENCE on an unsourced placeholder anchor is emitted as PREVALENCE_PROVISIONAL only.'
    }) };
  } catch (e) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: String((e && e.message) || e) }) };
  }
}

module.exports = {
  CONFIG: CONFIG,
  EXPECTED_RATES: EXPECTED_RATES,
  confidenceFor: confidenceFor,
  updateExpected: updateExpected,
  buildExpectedRates: buildExpectedRates,
  resolveExpected: resolveExpected,
  flagsFromReferrals: flagsFromReferrals,
  aggregatePeripherals: aggregatePeripherals,
  handler: handler
};
