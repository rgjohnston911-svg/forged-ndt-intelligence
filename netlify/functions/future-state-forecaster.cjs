// ============================================================================
// future-state-forecaster.cjs   (Future Reality / digital-twin decision layer)
// FORGED 4D NDT  -  DEPLOY391
//
// The decision-relevant forecasting layer. The platform already computes a
// LINEAR remaining life (failure-timeline) and probability-weighted failure
// timing (survival bridge). This engine answers the question those don't:
//
//   "The asset is acceptable TODAY. Given the forecast operating reality
//    (degradation trend, production change, deferred turnaround, staffing,
//    weather), will it breach its minimum BEFORE the next planned intervention?"
//
// It projects condition forward to 3/6/12/24-month horizons, adjusts the
// time-to-minimum for the forecast variables (conservatively -- modifiers only
// SHORTEN life), compares it to the next planned intervention, and names the
// dominant risk driver.
//
// PURE DETERMINISTIC. No LLM, no network, no clock, no random, no DB. var only,
// string concatenation only, no template literals, no arrow functions.
// ============================================================================
'use strict';

// Forecast-variable detectors. Each: id, label, rate multiplier (>=1, shortens
// life), and keyword phrases matched against the narrative.
var FORECAST_DRIVERS = [
  { id: 'TREND_ACCELERATION', label: 'Degradation/measurement trend accelerating', mult: 1.5,
    keywords: ['accelerated degradation', 'accelerating', 'degradation increasing', 'degradation rate has increased',
               'trend worsening', 'increasing severity', 'rate increasing', 'worsening trend', 'rate doubled',
               'doubled', 'tripled', 'quadrupled', '4x', '340%', 'settlement rate doubled', 'vibration increased',
               'vibration increasing', 'increasing vibration', 'near misses increasing', 'startups doubled',
               'startups tripled', 'thermal cycling doubled', 'crack growth', 'growth', 'rising',
               'accelerated', 'has accelerated', 'trend has accelerated', 'accelerated over',
               'rate has increased', 'rate increased', 'corrosion rate increased', 'corrosion rate has increased',
               'getting worse', 'worsened', 'has worsened', 'trend has worsened', 'progressively worse'] },
  { id: 'PRODUCTION_INCREASE', label: 'Production / throughput increase', mult: 1.2,
    keywords: ['production increase', 'increased throughput', 'throughput increase', 'throughput increased',
               'increase production', 'ramp up', 'higher utilization', 'above design capacity', 'over design capacity',
               'output increased', 'load doubled', 'load increased', 'export demand', 'record exports', 'demand spike',
               'all-time high', 'flaring rates rising', 'throughput', 'production increase planned',
               'flow rate increased', 'flow rates increased', 'flow increased', 'velocity increased', 'slurry velocity', 'rate increased'] },
  { id: 'LOADING_CHANGE', label: 'Operating loading change beyond design basis', mult: 1.2,
    keywords: ['heavier', 'larger vessel', 'larger vessels', 'vessel sizes increased', 'increased vessel size',
               'larger trainsets', 'new trainsets heavier', 'heavier locomotives', 'uprate', 'uprating',
               'new operating pressure', 'new pressure regime', 'traffic increased', 'traffic density increased',
               'increased loading', 'loading criteria', 'larger vessel in facility'] },
  { id: 'WEATHER_LOADING', label: 'Severe weather / storm loading forecast', mult: 1.0,
    keywords: ['storm risk', 'storm within', 'storm forecast', 'storm season', 'hurricane', 'tropical', 'severe weather',
               'high wind', 'cold front', 'cyclone', 'typhoon', 'monsoon', 'flood forecast', 'flood season',
               'rainfall forecast exceeds', 'weather window'] },
  { id: 'DEFERRED_INTERVENTION', label: 'Planned turnaround / outage deferred', mult: 1.0,
    keywords: ['turnaround delayed', 'turnaround deferred', 'turnaround postponed', 'outage delayed', 'outage deferred',
               'deferred turnaround', 'intervention delayed', 'maintenance deferred', 'postponed outage', 'postponed',
               'deferred pigging', 'spillway unavailable', 'exceeds approval period',
               'deferred', 'has been deferred', 'turnaround has been deferred', 'turnaround pushed',
               'pushed back', 'pushed out', 'deferral', 'slipped', 'turnaround slipped', 'outage slipped',
               'maintenance postponed', 'interval extended', 'turnaround extended', 'overdue'] },
  { id: 'STAFF_REDUCTION', label: 'Experienced-staff reduction (detection/response risk)', mult: 1.0,
    keywords: ['staff reduction', 'experienced staff reduction', 'personnel reduction', 'reduced staffing',
               'staff turnover', 'crew reduction', 'departed', 'aging workforce', 'operator overtime', 'control room turnover'] },
  { id: 'LOSS_OF_REDUNDANCY', label: 'Loss of redundancy / resilience (no spare or backup)', mult: 1.0,
    keywords: ['spare unavailable', 'spare compressor unavailable', 'spare pod', 'backup unavailable', 'backup offline',
               'backup train offline', 'backup cooling', 'backup intake', 'redundancy compromised', 'redundancy unavailable',
               'replacement unavailable', 'replacement crane', 'only personnel access', 'only access route', 'loss of redundancy',
               'loss of resilience', 'two backup', 'already unavailable', 'no redundancy', 'control redundancy unavailable'] },
  { id: 'EXTERNAL_THREAT', label: 'External / third-party threat', mult: 1.0,
    keywords: ['illegal excavation', 'third-party excavation', 'security incidents', 'fishing activity', 'seismic survey',
               'anchor strike', 'encroachment', 'sabotage'] }
];

function round1(x) { if (typeof x !== 'number' || isNaN(x)) { return 0; } return Math.round(x * 10) / 10; }
function round2(x) { if (typeof x !== 'number' || isNaN(x)) { return 0; } return Math.round(x * 100) / 100; }
function norm(s) { if (s === null || s === undefined) { return ''; } return String(s).toLowerCase().replace(/\s+/g, ' '); }

// DEPLOY394 - negation guard. A keyword hit is ignored if it is immediately
// preceded by a negation cue (no / not / without / never / free of). Prevents
// 'no severe weather' / 'no active leak' from firing a driver. Returns true only
// if at least one NON-negated occurrence exists.
function hitNotNegated(text, kw) {
  var from = 0;
  while (from <= text.length) {
    var idx = text.indexOf(kw, from);
    if (idx < 0) { return false; }
    var pre = text.substring(idx < 16 ? 0 : idx - 16, idx);
    if (!/(^|[^a-z])(no|not|without|never|free of|absence of)\s+$/.test(pre)) { return true; }
    from = idx + 1;
  }
  return false;
}

// Parse an explicit "next planned intervention / turnaround in N months|years".
// Returns months or null.
function parseNextInterventionMonths(text) {
  var m = text.match(/(?:next\s+)?(?:turnaround|outage|intervention|shutdown|inspection)\s+(?:is\s+)?(?:planned\s+|scheduled\s+|due\s+)?(?:in\s+)?(\d+(?:\.\d+)?)\s*(month|months|year|years|yr)/);
  if (!m) {
    m = text.match(/(?:in\s+)?(\d+(?:\.\d+)?)\s*(month|months|year|years|yr)\s+(?:until|to|before)\s+(?:the\s+)?(?:next\s+)?(?:turnaround|outage|intervention)/);
  }
  if (!m) { return null; }
  var n = parseFloat(m[1]);
  if (isNaN(n) || n <= 0) { return null; }
  return /year|yr/.test(m[2]) ? n * 12 : n;
}

// ----------------------------------------------------------------------------
// Public: forecast future state.
//   params = {
//     remainingLifeYears?,        // from failure-timeline (linear time-to-min)
//     nextInterventionMonths?,    // explicit; else parsed from transcript
//     signals: { transcript }
//   }
// Returns { drivers, dominant_driver, base_life_months, adjusted_life_months,
//           months_to_minimum, next_intervention_months, projections, verdict,
//           confidence, summary }.
// ----------------------------------------------------------------------------
function forecastFutureState(params) {
  var p = params || {};
  var text = norm((p.signals && p.signals.transcript) || '');

  // 1) Detect forecast drivers.
  var drivers = [];
  var combinedMult = 1.0;
  for (var i = 0; i < FORECAST_DRIVERS.length; i++) {
    var d = FORECAST_DRIVERS[i];
    var hit = '';
    for (var k = 0; k < d.keywords.length; k++) {
      if (hitNotNegated(text, d.keywords[k])) { hit = d.keywords[k]; break; }
    }
    if (hit) {
      drivers.push({ id: d.id, label: d.label, rate_multiplier: d.mult, evidence: hit });
      if (d.mult > 1.0) { combinedMult *= d.mult; }
    }
  }

  // Dominant driver = the active driver with the largest rate multiplier; if all
  // are non-rate (mult 1.0), the first detected qualitative driver.
  var dominant = null;
  for (var a = 0; a < drivers.length; a++) {
    if (!dominant || drivers[a].rate_multiplier > dominant.rate_multiplier) { dominant = drivers[a]; }
  }

  // 2) Base + adjusted time-to-minimum.
  var haveLife = (typeof p.remainingLifeYears === 'number' && p.remainingLifeYears > 0);
  var baseMonths = haveLife ? p.remainingLifeYears * 12 : null;
  var adjustedMonths = haveLife ? (baseMonths / combinedMult) : null;

  // 3) Next planned intervention.
  var nextIntervention = (typeof p.nextInterventionMonths === 'number' && p.nextInterventionMonths > 0)
    ? p.nextInterventionMonths : parseNextInterventionMonths(text);
  // A deferred turnaround with no explicit new date is an explicit unknown.
  var deferred = false;
  for (var di = 0; di < drivers.length; di++) { if (drivers[di].id === 'DEFERRED_INTERVENTION') { deferred = true; } }

  // 4) Horizon projections (fraction of adjusted life consumed by each horizon).
  var horizons = [3, 6, 12, 24];
  var projections = [];
  for (var h = 0; h < horizons.length; h++) {
    var hm = horizons[h];
    var acceptable = adjustedMonths === null ? null : (hm < adjustedMonths);
    var consumed = adjustedMonths === null ? null : round2(hm / adjustedMonths);
    projections.push({ horizon_months: hm, life_fraction_consumed: consumed, acceptable_at_horizon: acceptable });
  }

  // 5) Verdict.
  var verdict, summary;
  if (adjustedMonths === null) {
    verdict = 'QUALITATIVE_ONLY';
    summary = drivers.length
      ? ('No quantified remaining life available, but ' + drivers.length + ' forecast risk driver(s) are present (' +
         driverLabels(drivers) + '). Establish quantitative monitoring; current-condition acceptance does not account for these forward risks.')
      : 'No quantified remaining life and no forecast risk drivers detected.';
  } else if (nextIntervention === null) {
    verdict = deferred ? 'INTERVENTION_DEFERRED_TIMING_UNKNOWN' : 'INTERVENTION_TIMING_UNKNOWN';
    summary = 'Adjusted time-to-minimum is ' + round1(adjustedMonths) + ' months' +
      (combinedMult > 1.0 ? ' (shortened from ' + round1(baseMonths) + ' by forecast drivers)' : '') +
      '. Next planned intervention timing is ' + (deferred ? 'DEFERRED/unknown' : 'unknown') +
      ' -- cannot confirm the asset survives to it. Establish the intervention date.';
  } else if (adjustedMonths < nextIntervention) {
    verdict = 'BREACH_BEFORE_NEXT_INTERVENTION';
    summary = 'FORECAST BREACH: adjusted time-to-minimum (' + round1(adjustedMonths) + ' months) is BEFORE the next planned intervention (' +
      round1(nextIntervention) + ' months). The asset is acceptable today but is forecast to drop below minimum before the planned intervention' +
      (dominant ? ', driven primarily by ' + dominant.label.toLowerCase() : '') + '. Escalate: advance the intervention or add interim monitoring/mitigation.';
  } else {
    verdict = 'ACCEPTABLE_THROUGH_NEXT_INTERVENTION';
    summary = 'Forecast acceptable: adjusted time-to-minimum (' + round1(adjustedMonths) + ' months) exceeds the next planned intervention (' +
      round1(nextIntervention) + ' months). Continue per plan with monitoring of the identified drivers.';
  }

  // 6) Confidence.
  var confidence;
  if (!haveLife) { confidence = 'LOW'; }
  else if (nextIntervention === null) { confidence = 'MODERATE'; }
  else { confidence = drivers.length > 0 ? 'MODERATE' : 'HIGH'; }

  return {
    drivers: drivers,
    dominant_driver: dominant,
    combined_rate_multiplier: round2(combinedMult),
    base_life_months: baseMonths === null ? null : round1(baseMonths),
    adjusted_life_months: adjustedMonths === null ? null : round1(adjustedMonths),
    months_to_minimum: adjustedMonths === null ? null : round1(adjustedMonths),
    next_intervention_months: nextIntervention === null ? null : round1(nextIntervention),
    projections: projections,
    verdict: verdict,
    confidence: confidence,
    summary: summary
  };
}

function driverLabels(drivers) {
  var out = [];
  for (var i = 0; i < drivers.length; i++) { out.push(drivers[i].label); }
  return out.join('; ');
}

module.exports = {
  forecastFutureState: forecastFutureState,
  parseNextInterventionMonths: parseNextInterventionMonths,
  FORECAST_DRIVERS: FORECAST_DRIVERS
};
