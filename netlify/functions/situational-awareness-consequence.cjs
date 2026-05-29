// ============================================================================
// situational-awareness-consequence.cjs   (SA layer L9.3)
// FORGED 4D NDT - Situational Awareness  -  DEPLOY371 / Stage 10
//
// Consequence Simulator. For each decision option it emits one typed
// ConsequenceScenario. It DOES NOT INVENT PROBABILITIES. Probability-weighted
// outcomes are passed through ONLY from a caller-supplied probabilityBasis
// (sourced upstream from L4 Failure Timeline and the asset registry's precedent
// failures). When no basis exists for an option, the scenario is emitted with
// confidence = 0 and probability_weighted_outcomes = [] (brief Stage 10 gate).
//
// PURE DETERMINISTIC MODULE.
//   - No callers at this stage (additive, fully revertable).
//   - No LLM. No network. No filesystem. No Date.now() / Math.random().
//   - Imports nothing. Consumes only what the caller passes in.
//   - var only. String concatenation only. No template literals. No arrow fns.
//   - module.exports.
//
// Patent / determinism guarantees honored:
//   * Read-only over upstream artifacts; nothing written back (Directive 3).
//   * No field added to the DecisionPackage (Directive 4): separate artifact.
//   * No LLM, no fabricated probabilities (patent 1(ix); brief Stage 10).
//   * No clock read here.
// ============================================================================
'use strict';

// Canonical decision options, fixed order. Used when no ConflictMatrix options.
var CANONICAL_OPTIONS = ['CONTINUE', 'DERATE', 'SHUTDOWN', 'MORE_DATA'];

// Question-id keywords marking validated entries as financial inputs.
var FINANCIAL_KEYWORDS = [
  'cost', 'revenue', 'financial', 'budget', 'production', 'downtime',
  'shutdown_cost', 'intervention_cost', 'dollars', 'price', 'loss_per_day'
];

var UNQUANTIFIED = 'UNQUANTIFIED';

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function isNumber(x) { return (typeof x === 'number') && !isNaN(x); }

function clamp01(x) {
  if (!isNumber(x)) { return 0; }
  if (x < 0) { return 0; }
  if (x > 1) { return 1; }
  return x;
}

function roundTo2(x) {
  if (!isNumber(x)) { return 0; }
  return Math.round(x * 100) / 100;
}

function isValidProbability(p) {
  return isNumber(p) && p >= 0 && p <= 1;
}

function normalizeId(value) {
  if (value === null || value === undefined) { return ''; }
  return String(value).toLowerCase();
}

function keywordMatch(value, keywords) {
  var id = normalizeId(value);
  if (id === '') { return false; }
  for (var i = 0; i < keywords.length; i++) {
    if (id.indexOf(keywords[i]) >= 0) { return true; }
  }
  return false;
}

function financialInputsPresent(validatedSet) {
  var validated = (validatedSet && validatedSet.validated && validatedSet.validated.length)
    ? validatedSet.validated : [];
  for (var i = 0; i < validated.length; i++) {
    if (validated[i] && keywordMatch(validated[i].questionId, FINANCIAL_KEYWORDS)) { return true; }
  }
  return false;
}

// Resolve the option list deterministically.
function resolveOptions(conflictMatrix) {
  if (conflictMatrix && conflictMatrix.options && conflictMatrix.options.length) {
    var out = [];
    for (var i = 0; i < conflictMatrix.options.length; i++) { out.push(conflictMatrix.options[i]); }
    return out;
  }
  var canon = [];
  for (var j = 0; j < CANONICAL_OPTIONS.length; j++) { canon.push(CANONICAL_OPTIONS[j]); }
  return canon;
}

// Validate and normalize a single supplied outcome. Returns null if invalid
// (a missing/out-of-range probability is NOT coerced — it is dropped, never invented).
function normalizeOutcome(raw) {
  if (!raw || typeof raw !== 'object') { return null; }
  if (!isValidProbability(raw.probability)) { return null; }
  var sources = [];
  if (raw.evidence_source && raw.evidence_source.length) {
    for (var i = 0; i < raw.evidence_source.length; i++) { sources.push(raw.evidence_source[i]); }
  }
  return {
    outcome: (typeof raw.outcome === 'string') ? raw.outcome : '',
    probability: roundTo2(raw.probability),
    consequence_basis: (typeof raw.consequence_basis === 'string') ? raw.consequence_basis : '',
    evidence_source: sources
  };
}

// A basis entry is usable only if it carries at least one valid outcome AND an
// explicit numeric confidence. Otherwise there is no basis -> confidence 0.
function buildOutcomes(basisEntry) {
  var outcomes = [];
  if (basisEntry && basisEntry.outcomes && basisEntry.outcomes.length) {
    for (var i = 0; i < basisEntry.outcomes.length; i++) {
      var n = normalizeOutcome(basisEntry.outcomes[i]);
      if (n) { outcomes.push(n); }
    }
  }
  return outcomes;
}

// Expected value is passed through from the basis entry only. Financial may fall
// back to "SEE_PROVIDED_INPUTS" when the user supplied financial evidence;
// otherwise everything is UNQUANTIFIED. Nothing is fabricated.
function buildExpectedValue(basisEntry, hasBasis, finPresent) {
  var ev = (basisEntry && basisEntry.expected_value) ? basisEntry.expected_value : null;
  var financial = UNQUANTIFIED;
  if (ev && (typeof ev.financial === 'string' || isNumber(ev.financial))) {
    financial = ev.financial;
  } else if (finPresent) {
    financial = 'SEE_PROVIDED_INPUTS';
  }
  var safety = (ev && (typeof ev.safety === 'string' || isNumber(ev.safety))) ? ev.safety : UNQUANTIFIED;
  var regulatory = (ev && (typeof ev.regulatory === 'string' || isNumber(ev.regulatory))) ? ev.regulatory : UNQUANTIFIED;
  return { financial: financial, safety: safety, regulatory: regulatory };
}

// Aggregate the evidence entries referenced by the basis entry.
function buildEvidenceBasis(basisEntry) {
  var out = [];
  if (basisEntry && basisEntry.evidence_basis && basisEntry.evidence_basis.length) {
    for (var i = 0; i < basisEntry.evidence_basis.length; i++) { out.push(basisEntry.evidence_basis[i]); }
  }
  return out;
}

// ----------------------------------------------------------------------------
// Public entry point.
//   decisionPackage      : frozen DecisionPackage (read-only; used only for context)
//   conflictMatrix       : L9.2 output; supplies the option set (may be null)
//   validatedEvidenceSet : L9.0 output; used to detect financial inputs (may be null)
//   probabilityBasis     : caller-supplied, sourced from L4 timeline / precedents:
//                          { byOption: { <OPTION>: { outcomes:[...], confidence:<0-1>,
//                                                    expected_value:{...}, evidence_basis:[...] } } }
//                          When absent for an option, that scenario is confidence 0.
// Returns ConsequenceScenario[] (one per resolved option, in option order).
// ----------------------------------------------------------------------------
function buildConsequenceScenarios(decisionPackage, conflictMatrix, validatedEvidenceSet, probabilityBasis) {
  var options = resolveOptions(conflictMatrix);
  var finPresent = financialInputsPresent(validatedEvidenceSet);
  var byOption = (probabilityBasis && probabilityBasis.byOption) ? probabilityBasis.byOption : {};

  var scenarios = [];
  for (var i = 0; i < options.length; i++) {
    var option = options[i];
    var basisEntry = byOption[option] || null;
    var outcomes = buildOutcomes(basisEntry);

    // Basis is valid only with >=1 valid outcome AND an explicit numeric confidence.
    var hasBasis = (outcomes.length > 0) && basisEntry && isNumber(basisEntry.confidence);

    scenarios.push({
      option: option,
      probability_weighted_outcomes: hasBasis ? outcomes : [],
      expected_value: buildExpectedValue(basisEntry, hasBasis, finPresent),
      confidence: hasBasis ? roundTo2(clamp01(basisEntry.confidence)) : 0,
      evidence_basis: hasBasis ? buildEvidenceBasis(basisEntry) : []
    });
  }
  return scenarios;
}

module.exports = {
  buildConsequenceScenarios: buildConsequenceScenarios,
  // exported for unit tests / downstream stages:
  CANONICAL_OPTIONS: CANONICAL_OPTIONS,
  isValidProbability: isValidProbability,
  FINANCIAL_KEYWORDS: FINANCIAL_KEYWORDS
};
