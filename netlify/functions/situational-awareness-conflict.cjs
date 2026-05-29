// ============================================================================
// situational-awareness-conflict.cjs   (SA layer L9.2)
// FORGED 4D NDT - Situational Awareness  -  DEPLOY369 / Stage 8
//
// Conflict Detection Engine. Operates on the 9 StakeholderRealityViews from
// L9.1 (situational-awareness-stakeholder.cjs) and emits one typed
// ConflictMatrix. Implements a FIXED, ENUMERATED bias/conflict ruleset.
//
// PURE DETERMINISTIC MODULE.
//   - No callers at Stage 8 (additive, fully revertable).
//   - No LLM. No network. No filesystem. No Date.now() / Math.random().
//   - Does NOT import decision-core or any L0-L8 engine, and does NOT import
//     L9.1; it consumes L9.1's output that the caller passes in.
//   - var only. String concatenation only. No template literals. No arrow fns.
//   - module.exports.
//
// Patent / determinism guarantees honored:
//   * Read-only over the L9.1 views; nothing is written back (Directive 3).
//   * No field added to the DecisionPackage (Directive 4): this is a separate
//     ConflictMatrix artifact.
//   * No LLM anywhere; every conflict and every contamination flag comes from
//     an enumerated rule (patent 1(ix)).
//   * No clock is read here.
// ============================================================================
'use strict';

// Canonical decision options, in fixed order. Used to order the options list.
var CANONICAL_OPTIONS = ['CONTINUE', 'DERATE', 'SHUTDOWN', 'MORE_DATA'];

// Fixed conflict-resolution precedence. Safety and regulatory authority
// dominate; operations and financial (the contamination-prone roles) rank last;
// student carries no decision authority. This ordering is a constant, never
// computed from the case.
var CONFLICT_RESOLUTION_PRIORITY = [
  'SAFETY',
  'LEGAL',
  'ENGINEER',
  'RELIABILITY',
  'INSPECTOR',
  'TECHNICIAN',
  'OPS_MANAGER',
  'FINANCIAL',
  'STUDENT'
];

// Enumerated opposing-stance axes. For each axis, every role on sideA is in
// conflict with every role on sideB.
var CONFLICT_AXES = [
  { axis: 'shutdown_now', sideA: 'SHUTDOWN', sideB: 'CONTINUE' },
  { axis: 'gather_more_data', sideA: 'MORE_DATA', sideB: 'CONTINUE' }
];

// Role -> contamination type for view-derived flags (when a role's own L9.1
// contamination risk is MEDIUM or HIGH).
var ROLE_BIAS_TYPE = {
  OPS_MANAGER: 'PRODUCTION_PRESSURE',
  FINANCIAL: 'COST_PRESSURE'
};

// Enumerated evidence-keyword bias rules (the framework's named ruleset:
// production-bonus, prior trauma, missing calibration). Scanned against the
// validated evidence question ids / values when a ValidatedEvidenceSet is
// supplied. Each type attributes deterministically to one role.
var BIAS_EVIDENCE_RULES = [
  { type: 'PRODUCTION_PRESSURE', role: 'OPS_MANAGER',
    keywords: ['bonus', 'incentive', 'production_target', 'quota', 'uptime_bonus'] },
  { type: 'COST_PRESSURE', role: 'FINANCIAL',
    keywords: ['cost_overrun', 'budget_pressure', 'penalty', 'contract_deadline'] },
  { type: 'PRIOR_INCIDENT_TRAUMA', role: 'ENGINEER',
    keywords: ['prior_incident', 'previous_failure', 'past_leak', 'last_failure', 'trauma'] },
  { type: 'MISSING_CALIBRATION', role: 'INSPECTOR',
    keywords: ['uncalibrated', 'calibration_overdue', 'no_calibration', 'cal_expired'] }
];

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
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

// Rank a contamination risk for deterministic comparison.
function contaminationRank(risk) {
  if (risk === 'HIGH') { return 3; }
  if (risk === 'MEDIUM') { return 2; }
  if (risk === 'LOW') { return 1; }
  return 0;
}

// Pick the stronger of two severities.
function maxSeverity(a, b) {
  var order = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
  var ra = order[a] || 0;
  var rb = order[b] || 0;
  return (rb > ra) ? b : a;
}

// Build a lookup of role -> view (preserving the L9.1 order separately).
function indexViews(views) {
  var byRole = {};
  var list = (views && views.length) ? views : [];
  for (var i = 0; i < list.length; i++) {
    var v = list[i];
    if (v && typeof v.role === 'string') { byRole[v.role] = v; }
  }
  return byRole;
}

// Ordered list of roles exactly as they appear in the supplied views.
function orderedRoles(views) {
  var roles = [];
  var list = (views && views.length) ? views : [];
  for (var i = 0; i < list.length; i++) {
    if (list[i] && typeof list[i].role === 'string') { roles.push(list[i].role); }
  }
  return roles;
}

// ----------------------------------------------------------------------------
// options: the distinct, non-N/A wants present across the views, in canonical order.
// ----------------------------------------------------------------------------
function buildOptions(views, roles, byRole) {
  var present = {};
  for (var i = 0; i < roles.length; i++) {
    var w = byRole[roles[i]].what_they_want;
    if (w && w !== 'N/A') { present[w] = true; }
  }
  var out = [];
  for (var j = 0; j < CANONICAL_OPTIONS.length; j++) {
    if (present[CANONICAL_OPTIONS[j]] === true) { out.push(CANONICAL_OPTIONS[j]); }
  }
  return out;
}

// ----------------------------------------------------------------------------
// stakeholder_positions: role -> { wants, rationale }, all roles in view order.
// ----------------------------------------------------------------------------
function buildStakeholderPositions(roles, byRole) {
  var positions = {};
  for (var i = 0; i < roles.length; i++) {
    var v = byRole[roles[i]];
    positions[roles[i]] = {
      wants: v.what_they_want,
      rationale: v.position
    };
  }
  return positions;
}

// ----------------------------------------------------------------------------
// active_conflicts: enumerated opposing-stance pairs, in deterministic order.
// ----------------------------------------------------------------------------
function severityForShutdownNow(shutdownRole, continueRole, byRole) {
  var sev = 'MEDIUM';
  var continueRisk = byRole[continueRole].decision_contamination_risk;
  if (shutdownRole === 'SAFETY') { sev = 'HIGH'; }
  if (contaminationRank(continueRisk) >= 3) { sev = maxSeverity(sev, 'HIGH'); }
  if (shutdownRole === 'SAFETY' && contaminationRank(continueRisk) >= 3) { sev = 'CRITICAL'; }
  return sev;
}

function severityForGatherMoreData(dataRole, continueRole, byRole) {
  var sev = 'LOW';
  if (dataRole === 'RELIABILITY' || dataRole === 'ENGINEER') { sev = 'MEDIUM'; }
  if (contaminationRank(byRole[continueRole].decision_contamination_risk) >= 3) {
    sev = maxSeverity(sev, 'MEDIUM');
  }
  return sev;
}

function buildActiveConflicts(roles, byRole) {
  var conflicts = [];
  for (var a = 0; a < CONFLICT_AXES.length; a++) {
    var axisDef = CONFLICT_AXES[a];
    // Collect each side in view order for deterministic pairing.
    var sideARoles = [];
    var sideBRoles = [];
    for (var i = 0; i < roles.length; i++) {
      var want = byRole[roles[i]].what_they_want;
      if (want === axisDef.sideA) { sideARoles.push(roles[i]); }
      if (want === axisDef.sideB) { sideBRoles.push(roles[i]); }
    }
    for (var x = 0; x < sideARoles.length; x++) {
      for (var y = 0; y < sideBRoles.length; y++) {
        var sev;
        if (axisDef.axis === 'shutdown_now') {
          sev = severityForShutdownNow(sideARoles[x], sideBRoles[y], byRole);
        } else {
          sev = severityForGatherMoreData(sideARoles[x], sideBRoles[y], byRole);
        }
        conflicts.push({
          between: [sideARoles[x], sideBRoles[y]],
          axis: axisDef.axis,
          severity: sev
        });
      }
    }
  }
  return conflicts;
}

// ----------------------------------------------------------------------------
// decision_contamination_flags: view-derived (own risk) + evidence-derived
// (enumerated named-bias keyword scan). De-duplicated by stakeholder+type.
// ----------------------------------------------------------------------------
function firstEvidenceOrNull(view) {
  if (view && view.evidence_basis && view.evidence_basis.length) {
    return view.evidence_basis[0];
  }
  return null;
}

function buildContaminationFlags(roles, byRole, validatedEvidenceSet) {
  var flags = [];
  var seen = {};

  // (1) View-derived: any role whose own L9.1 contamination is MEDIUM or HIGH.
  for (var i = 0; i < roles.length; i++) {
    var role = roles[i];
    var risk = byRole[role].decision_contamination_risk;
    if (contaminationRank(risk) >= 2) {
      var type = ROLE_BIAS_TYPE[role] || 'DECISION_PRESSURE';
      var key = role + '::' + type;
      if (!seen[key]) {
        seen[key] = true;
        flags.push({
          stakeholder: role,
          type: type,
          severity: risk,
          evidence: firstEvidenceOrNull(byRole[role])
        });
      }
    }
  }

  // (2) Evidence-derived: enumerated named-bias keyword scan over validated evidence.
  var validated = (validatedEvidenceSet && validatedEvidenceSet.validated &&
                   validatedEvidenceSet.validated.length) ? validatedEvidenceSet.validated : [];
  for (var e = 0; e < validated.length; e++) {
    var entry = validated[e];
    for (var r = 0; r < BIAS_EVIDENCE_RULES.length; r++) {
      var rule = BIAS_EVIDENCE_RULES[r];
      var hit = keywordMatch(entry.questionId, rule.keywords) ||
                keywordMatch(entry.answerValue, rule.keywords);
      if (hit) {
        var k2 = rule.role + '::' + rule.type;
        if (!seen[k2]) {
          seen[k2] = true;
          flags.push({
            stakeholder: rule.role,
            type: rule.type,
            severity: 'MEDIUM',
            evidence: entry
          });
        }
      }
    }
  }

  return flags;
}

// ----------------------------------------------------------------------------
// Public entry point.
//   stakeholderViews     : StakeholderRealityView[] from L9.1
//   validatedEvidenceSet : optional; enables the named-bias evidence scan
// Returns a typed ConflictMatrix.
// ----------------------------------------------------------------------------
function detectConflicts(stakeholderViews, validatedEvidenceSet) {
  var roles = orderedRoles(stakeholderViews);
  var byRole = indexViews(stakeholderViews);

  return {
    options: buildOptions(stakeholderViews, roles, byRole),
    stakeholder_positions: buildStakeholderPositions(roles, byRole),
    active_conflicts: buildActiveConflicts(roles, byRole),
    decision_contamination_flags: buildContaminationFlags(roles, byRole, validatedEvidenceSet),
    conflict_resolution_priority: CONFLICT_RESOLUTION_PRIORITY
  };
}

module.exports = {
  detectConflicts: detectConflicts,
  // exported for unit tests / downstream stages:
  CANONICAL_OPTIONS: CANONICAL_OPTIONS,
  CONFLICT_RESOLUTION_PRIORITY: CONFLICT_RESOLUTION_PRIORITY,
  CONFLICT_AXES: CONFLICT_AXES,
  BIAS_EVIDENCE_RULES: BIAS_EVIDENCE_RULES
};
