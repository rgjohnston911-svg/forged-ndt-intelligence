// ============================================================================
// situational-awareness-brief.cjs   (SA layer L9.4)
// FORGED 4D NDT - Situational Awareness  -  DEPLOY370 / Stage 9 (engine)
//
// Executive Decision Brief. A one-page TYPED RENDERING of the upstream SA
// outputs (L9.1 stakeholder views via L9.2 ConflictMatrix, the frozen
// DecisionPackage, the L9.0 ValidatedEvidenceSet, and -- once Stage 10 lands --
// the L9.3 ConsequenceScenarios). It SUMMARIZES; it produces NO new evidence.
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
//   * No LLM (patent 1(ix)); produces_new_evidence is always false.
//   * No clock read here.
// ============================================================================
'use strict';

// Disposition -> plain-language recommended action.
var DISPOSITION_ACTION = {
  REJECT_FROM_SERVICE: 'Remove the asset from service.',
  REPORT_TO_JURISDICTIONAL_AUTHORITY: 'Remove from service and file the required jurisdictional report.',
  HALT_AND_ESCALATE: 'Halt operation and escalate immediately.',
  REPAIR: 'Take the asset offline for repair.',
  FFS_LEVEL_2_REQUIRED: 'Perform an API 579 Level 2 fitness-for-service assessment before continued operation.',
  FFS_LEVEL_3_REQUIRED: 'Perform an API 579 Level 3 fitness-for-service assessment before continued operation.',
  HOLD_FOR_INPUT: 'Hold. Collect the missing evidence before a disposition can be issued.',
  REINSPECT_BY_METHOD: 'Re-inspect using the recommended method before issuing a disposition.',
  ACCEPT_WITH_MONITORING: 'Continue operation with the specified monitoring cadence.',
  ACCEPT_FOR_CONTINUED_SERVICE: 'Continue operation at the normal inspection cadence.'
};

// Dispositions that imply the asset cannot keep running as-is (life-safety lens).
var SHUTDOWN_DISPOSITIONS = {
  REJECT_FROM_SERVICE: true,
  REPORT_TO_JURISDICTIONAL_AUTHORITY: true,
  HALT_AND_ESCALATE: true,
  REPAIR: true
};

var SEVERITY_ORDER = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

// Question-id keywords that mark validated entries as financial inputs.
var FINANCIAL_KEYWORDS = [
  'cost', 'revenue', 'financial', 'budget', 'production', 'downtime',
  'shutdown_cost', 'intervention_cost', 'dollars', 'price', 'loss_per_day'
];

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

function maxSeverity(a, b) {
  var ra = SEVERITY_ORDER[a] || 0;
  var rb = SEVERITY_ORDER[b] || 0;
  return (rb > ra) ? b : a;
}

// Shared confidence model: pkg.confidence minus 0.10 per unresolved CRITICAL.
function overallConfidence(pkg, validatedSet) {
  var base = (pkg && isNumber(pkg.confidence)) ? clamp01(pkg.confidence) : 0;
  var crit = 0;
  if (validatedSet && validatedSet.stats && isNumber(validatedSet.stats.criticalUnresolved)) {
    crit = validatedSet.stats.criticalUnresolved;
  }
  var adj = base - (0.10 * crit);
  if (adj < 0) { adj = 0; }
  return roundTo2(clamp01(adj));
}

// ----------------------------------------------------------------------------
// Recommendation
// ----------------------------------------------------------------------------
function buildRecommendation(pkg, consequenceScenarios) {
  var disp = (pkg && typeof pkg.disposition === 'string') ? pkg.disposition : 'UNKNOWN';
  var action = DISPOSITION_ACTION[disp];
  if (!action) { action = 'Review the deterministic disposition.'; }

  var simulatorInformed = false;
  if (consequenceScenarios && consequenceScenarios.length) {
    for (var i = 0; i < consequenceScenarios.length; i++) {
      var sc = consequenceScenarios[i];
      if (sc && isNumber(sc.confidence) && sc.confidence > 0) { simulatorInformed = true; break; }
    }
  }

  var basis = 'Deterministic disposition ' + disp +
    (simulatorInformed ? '; weighted by consequence simulator.' : '; consequence simulator not yet available.');

  return { action: action, disposition: disp, basis: basis, simulator_informed: simulatorInformed };
}

// ----------------------------------------------------------------------------
// Risk (life-safety, financial, regulatory) - qualitative levels only.
// ----------------------------------------------------------------------------
function lifeSafetyRisk(pkg) {
  var disp = (pkg && pkg.disposition) ? pkg.disposition : 'UNKNOWN';
  var hardLockCount = (pkg && pkg.hardLocks && pkg.hardLocks.length) ? pkg.hardLocks.length : 0;
  var tier = (pkg && pkg.consequence && pkg.consequence.tier) ? pkg.consequence.tier : 'UNKNOWN';
  // DEPLOY427: CRITICAL must also map to HIGH life-safety. The prior check only
  // caught tier === 'HIGH', so a CRITICAL hazardous-release case fell through to
  // LOW - a life-safety contradiction. 
  if (hardLockCount > 0 || SHUTDOWN_DISPOSITIONS[disp] === true || tier === 'HIGH' || tier === 'CRITICAL') { return 'HIGH'; }
  if (tier === 'MEDIUM') { return 'MEDIUM'; }
  return 'LOW';
}

function financialRisk(validatedSet) {
  var validated = (validatedSet && validatedSet.validated && validatedSet.validated.length)
    ? validatedSet.validated : [];
  for (var i = 0; i < validated.length; i++) {
    if (validated[i] && keywordMatch(validated[i].questionId, FINANCIAL_KEYWORDS)) {
      return 'QUANTIFIED_FROM_PROVIDED_INPUTS';
    }
  }
  return 'UNQUANTIFIED_NO_INPUTS_PROVIDED';
}

function regulatoryRisk(pkg) {
  var disp = (pkg && pkg.disposition) ? pkg.disposition : 'UNKNOWN';
  var clauseCount = (pkg && pkg.bindingClauses && pkg.bindingClauses.length) ? pkg.bindingClauses.length : 0;
  if (disp === 'REPORT_TO_JURISDICTIONAL_AUTHORITY') { return 'HIGH'; }
  if (clauseCount > 0) { return 'MEDIUM'; }
  return 'LOW';
}

// ----------------------------------------------------------------------------
// Unknowns (unresolved CRITICAL questions surfaced by L9.0)
// ----------------------------------------------------------------------------
function buildUnknowns(validatedSet) {
  var list = [];
  var count = 0;
  if (validatedSet) {
    if (validatedSet.unresolvedQuestions && validatedSet.unresolvedQuestions.length) {
      for (var i = 0; i < validatedSet.unresolvedQuestions.length; i++) {
        list.push(validatedSet.unresolvedQuestions[i]);
      }
    }
    if (validatedSet.stats && isNumber(validatedSet.stats.criticalUnresolved)) {
      count = validatedSet.stats.criticalUnresolved;
    }
  }
  return { unresolved_questions: list, critical_unresolved_count: count };
}

// ----------------------------------------------------------------------------
// Code basis (from L3 Authority Reality -> bindingClauses)
// ----------------------------------------------------------------------------
function buildCodeBasis(pkg) {
  var out = [];
  var clauses = (pkg && pkg.bindingClauses && pkg.bindingClauses.length) ? pkg.bindingClauses : [];
  for (var i = 0; i < clauses.length; i++) {
    var c = clauses[i] || {};
    out.push({
      code: c.code || '',
      clause: c.clause || '',
      requirement: c.requirement || ''
    });
  }
  return out;
}

// ----------------------------------------------------------------------------
// Conflict summary (from L9.2 ConflictMatrix)
// ----------------------------------------------------------------------------
function buildConflictSummary(conflictMatrix) {
  var summary = {
    active_conflict_count: 0,
    highest_severity: 'NONE',
    contamination_flag_count: 0,
    top_priority: null
  };
  if (!conflictMatrix) { return summary; }

  if (conflictMatrix.active_conflicts && conflictMatrix.active_conflicts.length) {
    summary.active_conflict_count = conflictMatrix.active_conflicts.length;
    var hi = 'NONE';
    for (var i = 0; i < conflictMatrix.active_conflicts.length; i++) {
      var sev = conflictMatrix.active_conflicts[i].severity;
      if (SEVERITY_ORDER[sev]) { hi = maxSeverity(hi === 'NONE' ? 'LOW' : hi, sev); }
    }
    summary.highest_severity = hi;
  }
  if (conflictMatrix.decision_contamination_flags && conflictMatrix.decision_contamination_flags.length) {
    summary.contamination_flag_count = conflictMatrix.decision_contamination_flags.length;
  }
  if (conflictMatrix.conflict_resolution_priority && conflictMatrix.conflict_resolution_priority.length) {
    summary.top_priority = conflictMatrix.conflict_resolution_priority[0];
  }
  return summary;
}

// ----------------------------------------------------------------------------
// Hard locks (carried through verbatim from the package)
// ----------------------------------------------------------------------------
function buildHardLocks(pkg) {
  var out = [];
  var locks = (pkg && pkg.hardLocks && pkg.hardLocks.length) ? pkg.hardLocks : [];
  for (var i = 0; i < locks.length; i++) {
    out.push(locks[i] && locks[i].trigger ? locks[i].trigger : 'UNSPECIFIED_LOCK');
  }
  return out;
}

// ----------------------------------------------------------------------------
// Public entry point.
//   decisionPackage      : frozen DecisionPackage (read-only)
//   validatedEvidenceSet : L9.0 output (may be null in the pre-SA path)
//   conflictMatrix       : L9.2 output (may be null)
//   consequenceScenarios : L9.3 output (absent until Stage 10; may be null)
// Returns a typed ExecutiveBrief. Produces no new evidence.
// ----------------------------------------------------------------------------
function buildExecutiveBrief(decisionPackage, validatedEvidenceSet, conflictMatrix, consequenceScenarios) {
  var pkg = decisionPackage || {};
  return {
    recommendation: buildRecommendation(pkg, consequenceScenarios),
    risk: {
      life_safety: lifeSafetyRisk(pkg),
      financial: financialRisk(validatedEvidenceSet),
      regulatory: regulatoryRisk(pkg)
    },
    confidence: overallConfidence(pkg, validatedEvidenceSet),
    unknowns: buildUnknowns(validatedEvidenceSet),
    code_basis: buildCodeBasis(pkg),
    conflict_summary: buildConflictSummary(conflictMatrix),
    hard_locks: buildHardLocks(pkg),
    produces_new_evidence: false
  };
}

module.exports = {
  buildExecutiveBrief: buildExecutiveBrief,
  // exported for unit tests / downstream stages:
  overallConfidence: overallConfidence,
  DISPOSITION_ACTION: DISPOSITION_ACTION,
  FINANCIAL_KEYWORDS: FINANCIAL_KEYWORDS
};
