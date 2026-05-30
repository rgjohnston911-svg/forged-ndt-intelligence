// ============================================================================
// situational-awareness-survival-bridge.cjs   (SA layer L9.3 input bridge)
// FORGED 4D NDT - Situational Awareness  -  DEPLOY382 / SA Tier 2
//
// Converts the platform's L4 Failure Timeline output (a remaining-LIFE estimate
// in years + a qualitative confidence band) into a probabilityBasis the
// Consequence Simulator (L9.3) consumes. This is a standard reliability move
// (API 581 RBI): treat the engine's remaining-life estimate as the mean of a
// lognormal time-to-failure distribution, with the variance set by the
// timeline's OWN stated confidence band. It does NOT fabricate numbers out of
// thin air -- every probability is a deterministic function of the platform's
// own remaining-life estimate and its own confidence. When the timeline is not
// quantified (insufficient_data / dormant / no governing time), it returns an
// EMPTY basis so the simulator correctly emits confidence:0 (brief Stage 10).
//
// PURE DETERMINISTIC MODULE. No LLM, no network, no clock, no random.
// var only, string concatenation only, no template literals, no arrow fns.
// ============================================================================
'use strict';

function isNumber(x) { return (typeof x === 'number') && !isNaN(x); }
function clamp01(x) { if (!isNumber(x)) { return 0; } if (x < 0) { return 0; } if (x > 1) { return 1; } return x; }
function roundTo3(x) { if (!isNumber(x)) { return 0; } return Math.round(x * 1000) / 1000; }

// Abramowitz-Stegun erf approximation (deterministic).
function erf(x) {
  var s = (x < 0) ? -1 : 1;
  var ax = Math.abs(x);
  var a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  var t = 1 / (1 + p * ax);
  var y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return s * y;
}

// Lognormal CDF for time-to-failure with given mean (m) and coefficient of
// variation (cov). P(T <= t).
function lognormalFailureProb(t, m, cov) {
  if (!(m > 0) || !(cov > 0) || !(t > 0)) { return 0; }
  var sigma2 = Math.log(1 + cov * cov);
  var sigma = Math.sqrt(sigma2);
  var muLn = Math.log(m) - sigma2 / 2;
  var z = (Math.log(t) - muLn) / sigma;
  return clamp01(0.5 * (1 + erf(z / Math.SQRT2)));
}

// Map the timeline confidence band to a coefficient of variation (spread) and a
// scenario confidence. Tighter band means smaller spread, higher confidence.
function bandToModel(band) {
  var b = String(band || '').toUpperCase();
  if (b === 'HIGH') { return { cov: 0.30, conf: 0.80 }; }
  if (b === 'MODERATE') { return { cov: 0.50, conf: 0.60 }; }
  if (b === 'MODERATE_LIFETIME_AVG') { return { cov: 0.60, conf: 0.55 }; }
  if (b === 'LOW' || b === 'LOW_TIME') { return { cov: 0.75, conf: 0.40 }; }
  return { cov: 0, conf: 0 };
}

var NON_QUANTIFIED_STATES = { insufficient_data: true, dormant_possible: true };

function extractGoverning(ft) {
  if (!ft || typeof ft !== 'object') { return null; }
  var state = String(ft.progression_state || '').toLowerCase();
  if (NON_QUANTIFIED_STATES[state] === true) { return null; }
  var m = ft.governing_time_years;
  if (!isNumber(m) || m <= 0) { return null; }
  var band = '';
  if (ft.corrosion_timeline && ft.corrosion_timeline.confidence) { band = ft.corrosion_timeline.confidence; }
  if ((!band || band === 'none' || band === 'INSUFFICIENT_DATA') &&
      ft.crack_timeline && ft.crack_timeline.confidence) { band = ft.crack_timeline.confidence; }
  if (!band || band === 'none' || band === 'INSUFFICIENT_DATA') {
    if (state === 'accelerating' || state === 'active_likely') { band = 'MODERATE'; }
    else if (state === 'active_possible') { band = 'LOW'; }
    else if (state === 'stable_known') { band = 'HIGH'; }
  }
  return { mean: m, band: band, state: state };
}

function safetyFromP5(p5) {
  if (p5 >= 0.50) { return 'ELEVATED'; }
  if (p5 >= 0.20) { return 'MODERATE'; }
  return 'LOW';
}

function buildProbabilityBasis(failureTimeline, decisionPackage) {
  var g = extractGoverning(failureTimeline);
  if (!g) { return { byOption: {} }; }
  var model = bandToModel(g.band);
  if (!(model.cov > 0) || !(model.conf > 0)) { return { byOption: {} }; }

  var p1 = lognormalFailureProb(1, g.mean, model.cov);
  var p3 = lognormalFailureProb(3, g.mean, model.cov);
  var p5 = lognormalFailureProb(5, g.mean, model.cov);

  var band01 = roundTo3(p1);
  var band13 = roundTo3(Math.max(0, p3 - p1));
  var band35 = roundTo3(Math.max(0, p5 - p3));
  var bandSurv = roundTo3(Math.max(0, 1 - p5));

  var basisText = 'Lognormal time-to-failure from L4 remaining-life ' + g.mean +
    'y, CoV ' + model.cov + ' (timeline confidence ' + (g.band || g.state) + ')';

  var evidenceRef = [{
    source: 'L4_failure_timeline',
    governing_time_years: g.mean,
    progression_state: g.state,
    confidence_band: g.band
  }];

  var tier = (decisionPackage && decisionPackage.consequence && decisionPackage.consequence.tier)
    ? decisionPackage.consequence.tier : 'UNKNOWN';

  var continueOutcomes = [
    { outcome: 'Failure within 1 year', probability: band01, consequence_basis: basisText, evidence_source: evidenceRef },
    { outcome: 'Failure in 1-3 years', probability: band13, consequence_basis: basisText, evidence_source: evidenceRef },
    { outcome: 'Failure in 3-5 years', probability: band35, consequence_basis: basisText, evidence_source: evidenceRef },
    { outcome: 'Survives beyond 5 years', probability: bandSurv, consequence_basis: basisText, evidence_source: evidenceRef }
  ];

  var byOption = {
    CONTINUE: {
      confidence: model.conf,
      outcomes: continueOutcomes,
      expected_value: { financial: 'UNQUANTIFIED', safety: safetyFromP5(p5), regulatory: tier },
      evidence_basis: evidenceRef
    },
    SHUTDOWN: {
      confidence: model.conf,
      outcomes: [
        { outcome: 'In-service failure eliminated by removal from service', probability: 1.0,
          consequence_basis: 'Removal from service eliminates the in-service time-to-failure exposure', evidence_source: evidenceRef }
      ],
      expected_value: { financial: 'UNQUANTIFIED', safety: 'LOW', regulatory: tier },
      evidence_basis: evidenceRef
    }
  };

  return { byOption: byOption, model: { mean: g.mean, cov: model.cov, band: g.band, p1: roundTo3(p1), p3: roundTo3(p3), p5: roundTo3(p5) } };
}

module.exports = {
  buildProbabilityBasis: buildProbabilityBasis,
  lognormalFailureProb: lognormalFailureProb,
  bandToModel: bandToModel,
  extractGoverning: extractGoverning
};
