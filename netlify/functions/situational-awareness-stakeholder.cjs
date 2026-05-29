// ============================================================================
// situational-awareness-stakeholder.cjs   (SA layer L9.1)
// FORGED 4D NDT - Situational Awareness  -  DEPLOY367 / Stage 7
//
// Stakeholder Reality Engine. Extends the PIL's 6 role projections to 9 by
// adding RELIABILITY, FINANCIAL, and LEGAL. Projects the FROZEN DecisionPackage
// (plus the L9.0 ValidatedEvidenceSet) into one typed StakeholderRealityView
// per role.
//
// PURE DETERMINISTIC MODULE.
//   - No callers at Stage 7 (additive, fully revertable).
//   - No LLM. No network. No filesystem. No Date.now() / Math.random().
//   - Does NOT import decision-core or any L0-L8 engine. One-way: SA -> package.
//   - var only. String concatenation only. No template literals. No arrow fns.
//   - module.exports.
//
// Patent / determinism guarantees honored:
//   * The DecisionPackage is read-only; nothing is written back (Directive 3).
//   * No field is added to the DecisionPackage (Directive 4): this module
//     returns a SEPARATE StakeholderRealityView[] artifact.
//   * FINANCIAL and LEGAL signals are sourced ONLY from validated, user-provided
//     evidence and the authority chain already inside the package. They are
//     NEVER LLM-inferred (patent 1(ix); brief Section 4.3 / Stage 7).
//   * No clock is read here; staleness is the gate's concern (L9.0).
// ============================================================================
'use strict';

// Fixed, ordered role list. Order is part of the deterministic contract.
var STAKEHOLDER_ROLES = [
  'INSPECTOR',
  'ENGINEER',
  'TECHNICIAN',
  'OPS_MANAGER',
  'SAFETY',
  'STUDENT',
  'RELIABILITY',
  'FINANCIAL',
  'LEGAL'
];

// Dispositions that mean the asset cannot keep running as-is.
var SHUTDOWN_DISPOSITIONS = {
  REJECT_FROM_SERVICE: true,
  REPORT_TO_JURISDICTIONAL_AUTHORITY: true,
  HALT_AND_ESCALATE: true,
  REPAIR: true
};

// Dispositions that mean "we do not yet know enough".
var MORE_DATA_DISPOSITIONS = {
  HOLD_FOR_INPUT: true,
  REINSPECT_BY_METHOD: true,
  FFS_LEVEL_2_REQUIRED: true,
  FFS_LEVEL_3_REQUIRED: true
};

// Dispositions that mean "keep operating" (possibly with monitoring).
var CONTINUE_DISPOSITIONS = {
  ACCEPT_FOR_CONTINUED_SERVICE: true,
  ACCEPT_WITH_MONITORING: true
};

// Dispositions that require a jurisdictional / regulatory report.
var REPORTABLE_DISPOSITIONS = {
  REPORT_TO_JURISDICTIONAL_AUTHORITY: true
};

// Question-id keyword registries used ONLY to select which already-validated
// evidence entries ground the FINANCIAL and LEGAL positions. These do not
// create evidence; they filter the ValidatedEvidenceSet, so the
// "user-provided-only" guarantee is preserved.
var FINANCIAL_KEYWORDS = [
  'cost', 'revenue', 'financial', 'budget', 'production', 'downtime',
  'shutdown_cost', 'intervention_cost', 'dollars', 'price', 'loss_per_day'
];
var LEGAL_KEYWORDS = [
  'report', 'jurisdiction', 'regulatory', 'compliance', 'permit',
  'notification', 'authority', 'osha', 'statute', 'code_required'
];

// ----------------------------------------------------------------------------
// Small deterministic helpers
// ----------------------------------------------------------------------------
function isNumber(x) {
  return (typeof x === 'number') && !isNaN(x);
}

function clamp01(x) {
  if (!isNumber(x)) { return 0; }
  if (x < 0) { return 0; }
  if (x > 1) { return 1; }
  return x;
}

// Deterministic 2-decimal rounding (avoids cross-platform float drift in output).
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

// ----------------------------------------------------------------------------
// Read-only accessors over the frozen DecisionPackage (defensive)
// ----------------------------------------------------------------------------
function getDisposition(pkg) {
  if (pkg && typeof pkg.disposition === 'string') { return pkg.disposition; }
  return 'UNKNOWN';
}

function getConfidence(pkg) {
  if (pkg && isNumber(pkg.confidence)) { return clamp01(pkg.confidence); }
  return 0;
}

function getHardLockCount(pkg) {
  if (pkg && pkg.hardLocks && pkg.hardLocks.length) { return pkg.hardLocks.length; }
  return 0;
}

function getDominantMechanism(pkg) {
  if (pkg && pkg.fmd && typeof pkg.fmd.dominant === 'string') { return pkg.fmd.dominant; }
  return 'undetermined';
}

function getFmdMargin(pkg) {
  if (pkg && pkg.fmd && isNumber(pkg.fmd.margin)) { return pkg.fmd.margin; }
  return null;
}

function getTimeToActionDays(pkg) {
  if (pkg && pkg.timeline && isNumber(pkg.timeline.timeToActionDays)) {
    return pkg.timeline.timeToActionDays;
  }
  return null;
}

function hasTimeline(pkg) {
  return !!(pkg && pkg.timeline);
}

function getBindingClauses(pkg) {
  if (pkg && pkg.bindingClauses && pkg.bindingClauses.length) { return pkg.bindingClauses; }
  return [];
}

function getConsequenceTier(pkg) {
  if (pkg && pkg.consequence && typeof pkg.consequence.tier === 'string') {
    return pkg.consequence.tier;
  }
  return 'UNKNOWN';
}

function getValidatedEntries(validatedSet) {
  if (validatedSet && validatedSet.validated && validatedSet.validated.length) {
    return validatedSet.validated;
  }
  return [];
}

function getCriticalUnresolved(validatedSet) {
  if (validatedSet && validatedSet.stats && isNumber(validatedSet.stats.criticalUnresolved)) {
    return validatedSet.stats.criticalUnresolved;
  }
  return 0;
}

// Filter the validated set by question-id keywords (preserves submission order).
function filterEvidenceByKeywords(validated, keywords) {
  var out = [];
  for (var i = 0; i < validated.length; i++) {
    var e = validated[i];
    if (e && keywordMatch(e.questionId, keywords)) { out.push(e); }
  }
  return out;
}

// ----------------------------------------------------------------------------
// Baseline directional stance from the disposition alone.
// Returns one of CONTINUE | DERATE | SHUTDOWN | MORE_DATA | N/A.
// ----------------------------------------------------------------------------
function baselineStance(disp) {
  if (SHUTDOWN_DISPOSITIONS[disp] === true) { return 'SHUTDOWN'; }
  if (MORE_DATA_DISPOSITIONS[disp] === true) { return 'MORE_DATA'; }
  if (CONTINUE_DISPOSITIONS[disp] === true) { return 'CONTINUE'; }
  return 'N/A';
}

// ----------------------------------------------------------------------------
// Confidence adjustment shared by all roles: each unresolved CRITICAL question
// lowers apparent role confidence by 0.10, floored at 0.
// ----------------------------------------------------------------------------
function adjustedBaseConfidence(pkg, validatedSet) {
  var base = getConfidence(pkg);
  var crit = getCriticalUnresolved(validatedSet);
  var adj = base - (0.10 * crit);
  if (adj < 0) { adj = 0; }
  return clamp01(adj);
}

// ----------------------------------------------------------------------------
// Per-role projection. ctx carries everything precomputed once.
// ----------------------------------------------------------------------------
function buildRoleView(role, ctx) {
  var disp = ctx.disposition;
  var baseStance = ctx.baseStance;
  var hardLocks = ctx.hardLockCount;
  var mechanism = ctx.mechanism;
  var margin = ctx.margin;
  var tta = ctx.timeToActionDays;
  var baseConf = ctx.baseConfidence;

  // Defaults; each role overrides as needed.
  var position = '';
  var evidenceBasis = ctx.validated;
  var confidence = baseConf;
  var whatTheyWant = baseStance;
  var whatTheyFear = '';
  var contamination = 'LOW';

  var ttaText = (tta === null) ? 'not yet established' : (tta + ' days');
  var marginText = (margin === null) ? 'n/a' : roundTo2(margin).toFixed(2);

  if (role === 'INSPECTOR') {
    position = 'Inspector reality: dominant mechanism ' + mechanism +
      ' (FMD margin ' + marginText + '); disposition ' + disp +
      '. Confirm field observations match captured data before sign-off.';
    whatTheyFear = 'Missing or misread an indication that changes the dominant mechanism.';
    contamination = 'LOW';

  } else if (role === 'ENGINEER') {
    position = 'Integrity engineering reality: disposition ' + disp +
      ' on mechanism ' + mechanism + '; action window ' + ttaText +
      '. Confirm the deterministic basis and document.';
    whatTheyFear = 'Issuing a disposition that an unresolved contradiction or low margin later overturns.';
    contamination = 'LOW';

  } else if (role === 'TECHNICIAN') {
    position = 'Technician reality: execute the assigned procedure for ' + mechanism +
      ' and capture data. Interpretation is out of scope.';
    // Procedure execution does not turn on the continue/shutdown axis.
    whatTheyWant = 'N/A';
    whatTheyFear = 'Procedure or calibration error contaminating the captured data.';
    contamination = 'LOW';

  } else if (role === 'OPS_MANAGER') {
    // Operations leans toward keeping production unless a shutdown is mandated.
    if (baseStance === 'SHUTDOWN') {
      if (hardLocks > 0 || disp === 'REJECT_FROM_SERVICE' ||
          disp === 'REPORT_TO_JURISDICTIONAL_AUTHORITY' || disp === 'HALT_AND_ESCALATE') {
        // Mandated shutdown cannot be overridden by ops.
        whatTheyWant = 'SHUTDOWN';
        contamination = 'MEDIUM';
      } else {
        // REPAIR with no hard lock: production pressure pulls toward CONTINUE.
        whatTheyWant = 'CONTINUE';
        contamination = 'HIGH';
      }
    } else if (baseStance === 'MORE_DATA' || baseStance === 'DERATE') {
      whatTheyWant = 'CONTINUE';
      contamination = 'MEDIUM';
    } else {
      whatTheyWant = baseStance;
      contamination = 'LOW';
    }
    position = 'Operations reality: disposition ' + disp + '; action window ' + ttaText +
      '; consequence tier ' + ctx.consequenceTier +
      '. Schedule and resourcing must align with the engineering call.';
    whatTheyFear = 'Unplanned downtime and production loss from a shutdown that could have been planned.';

  } else if (role === 'SAFETY') {
    // Safety leans conservative; a conservative bias is protective, not contaminating.
    if (hardLocks > 0 || baseStance === 'SHUTDOWN' || baseConf < 0.60) {
      whatTheyWant = 'SHUTDOWN';
    } else if (baseStance === 'MORE_DATA') {
      whatTheyWant = 'MORE_DATA';
    } else {
      whatTheyWant = baseStance;
    }
    position = 'Safety reality: ' + (hardLocks > 0 ? (hardLocks + ' hard lock(s) active') : 'no active hard lock') +
      '; consequence tier ' + ctx.consequenceTier + '; disposition ' + disp + '.';
    whatTheyFear = 'A loss-of-containment or personnel-exposure event that the disposition under-weighted.';
    contamination = 'LOW';

  } else if (role === 'STUDENT') {
    position = 'Teaching reality: case turns on mechanism ' + mechanism +
      ' and disposition ' + disp + '. Walk the evidence-to-disposition path.';
    whatTheyWant = 'N/A';
    whatTheyFear = 'Learning a heuristic that does not generalize beyond this case.';
    contamination = 'LOW';

  } else if (role === 'RELIABILITY') {
    // Reliability cares about mechanism progression and time-to-failure (L4).
    var marginLow = (margin !== null && margin < 0.15);
    if (marginLow || !ctx.timelinePresent) {
      whatTheyWant = 'MORE_DATA';
    } else {
      whatTheyWant = baseStance;
    }
    confidence = ctx.timelinePresent ? baseConf : roundTo2(baseConf * 0.70);
    position = 'Reliability reality: mechanism ' + mechanism + ' progression; time-to-action ' +
      ttaText + (marginLow ? '; FMD margin below 0.15 (dominant mechanism not clearly separated)' : '') + '.';
    whatTheyFear = 'A faster-than-modeled progression or a precedent failure mode not captured in the timeline.';
    contamination = 'LOW';

  } else if (role === 'FINANCIAL') {
    // Sourced ONLY from validated, user-provided financial evidence. Never inferred.
    evidenceBasis = ctx.financialEvidence;
    if (ctx.financialEvidence.length === 0) {
      whatTheyWant = 'N/A';
      confidence = 0;
      position = 'Financial reality: no financial inputs were provided. ' +
        'No revenue-at-risk, shutdown cost, or intervention cost can be asserted (never inferred).';
      whatTheyFear = 'Decision made without quantified financial exposure.';
      contamination = 'LOW';
    } else {
      // Cost-avoidance pressure pulls toward CONTINUE against a shutdown call.
      if (baseStance === 'SHUTDOWN') {
        whatTheyWant = 'CONTINUE';
        contamination = 'HIGH';
      } else if (baseStance === 'MORE_DATA' || baseStance === 'DERATE') {
        whatTheyWant = 'CONTINUE';
        contamination = 'MEDIUM';
      } else {
        whatTheyWant = baseStance;
        contamination = 'LOW';
      }
      confidence = baseConf;
      position = 'Financial reality (from provided inputs only): disposition ' + disp +
        ' carries intervention and downtime cost. ' + ctx.financialEvidence.length +
        ' financial input(s) on record.';
      whatTheyFear = 'Avoidable revenue loss from an over-conservative or mistimed intervention.';
    }

  } else if (role === 'LEGAL') {
    // Sourced from the authority chain in the package (binding clauses) and any
    // validated regulatory evidence. Never inferred.
    evidenceBasis = ctx.legalEvidence;
    var reportRequired = (REPORTABLE_DISPOSITIONS[disp] === true);
    if (reportRequired) {
      whatTheyWant = 'SHUTDOWN';
    } else if (baseStance === 'CONTINUE' && ctx.bindingClauseCount === 0) {
      // No code basis on record for a continue call -> wants more documentation.
      whatTheyWant = 'MORE_DATA';
    } else {
      whatTheyWant = baseStance;
    }
    confidence = (ctx.bindingClauseCount > 0) ? baseConf : roundTo2(baseConf * 0.50);
    position = 'Legal/regulatory reality: ' + ctx.bindingClauseCount +
      ' binding clause(s) in the authority chain; ' +
      (reportRequired ? 'jurisdictional report required' : 'no jurisdictional report triggered') +
      '; disposition ' + disp + '.';
    whatTheyFear = 'Regulatory non-compliance or a missed mandatory reporting threshold.';
    contamination = 'LOW';

  } else {
    // Unknown role guard (should never occur given the closed list).
    position = 'Unrecognized role projection.';
    whatTheyWant = 'N/A';
    whatTheyFear = '';
    contamination = 'LOW';
    evidenceBasis = [];
    confidence = 0;
  }

  return {
    role: role,
    position: position,
    evidence_basis: evidenceBasis,
    confidence: roundTo2(clamp01(confidence)),
    what_they_want: whatTheyWant,
    what_they_fear: whatTheyFear,
    decision_contamination_risk: contamination
  };
}

// ----------------------------------------------------------------------------
// Public entry point.
//   decisionPackage   : the FROZEN DecisionPackage (read-only)
//   validatedEvidenceSet : output of L9.0 reality-validation-gate.validateSet()
//                          (may be null/empty in the pre-SA path)
// Returns StakeholderRealityView[] in the fixed STAKEHOLDER_ROLES order.
// ----------------------------------------------------------------------------
function projectStakeholders(decisionPackage, validatedEvidenceSet) {
  var pkg = decisionPackage || {};
  var validated = getValidatedEntries(validatedEvidenceSet);

  var ctx = {
    disposition: getDisposition(pkg),
    baseStance: baselineStance(getDisposition(pkg)),
    hardLockCount: getHardLockCount(pkg),
    mechanism: getDominantMechanism(pkg),
    margin: getFmdMargin(pkg),
    timeToActionDays: getTimeToActionDays(pkg),
    timelinePresent: hasTimeline(pkg),
    consequenceTier: getConsequenceTier(pkg),
    bindingClauseCount: getBindingClauses(pkg).length,
    baseConfidence: adjustedBaseConfidence(pkg, validatedEvidenceSet),
    validated: validated,
    financialEvidence: filterEvidenceByKeywords(validated, FINANCIAL_KEYWORDS),
    legalEvidence: filterEvidenceByKeywords(validated, LEGAL_KEYWORDS)
  };

  var views = [];
  for (var i = 0; i < STAKEHOLDER_ROLES.length; i++) {
    views.push(buildRoleView(STAKEHOLDER_ROLES[i], ctx));
  }
  return views;
}

module.exports = {
  projectStakeholders: projectStakeholders,
  // exported for unit tests / downstream stages:
  STAKEHOLDER_ROLES: STAKEHOLDER_ROLES,
  baselineStance: baselineStance,
  adjustedBaseConfidence: adjustedBaseConfidence,
  filterEvidenceByKeywords: filterEvidenceByKeywords,
  FINANCIAL_KEYWORDS: FINANCIAL_KEYWORDS,
  LEGAL_KEYWORDS: LEGAL_KEYWORDS
};
