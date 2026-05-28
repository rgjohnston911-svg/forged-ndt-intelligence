// netlify/functions/perspective-projection.cjs
// FORGED NDT Intelligence OS - Perspective Intelligence Layer (PIL)
// DEPLOY##X / v##.x - Main Projection Function (Hardened)
//
// Per provisional patent disclosure: deterministic projection function that
// transforms a frozen DecisionPackage into a role-specific RoleView.
//
// Guarantees:
//   - Pure function: identical inputs produce bitwise-identical outputs
//   - Suppression Validator: every safety-critical disclosure surfaces in
//     every role view, with deterministic fallback on failure
//   - Projection Contract: role layer may translate truth but never alter it
//   - Audit trail: every projection produces a coherence record with
//     reproducible package and view hashes
//
// Modules:
//   1.  Role Resolver (with credential validity hardening)
//   2.  Task Context Resolver
//   3.  Decision Burden Engine
//   4.  Risk Visibility Engine
//   5.  Blind-Spot Detector
//   6.  Next-Best-Action Engine (role-authority bounded)
//   7.  Communication Translator (deterministic templates; LLM optional)
//   8.  Escalation Trigger Engine (deterministic, hard-locked)
//   9.  Information Suppression Validator (SAFETY GATE)
//   10. Cross-Role Coherence Logger
//   11. Must-Not-Conclude Surface
//   12. Perspective Projection Contract (version-referenced)
//   13. Deterministic Canonicalization + Stable Hashing (deep)
//   14. Input Schema + Role Credential Validation
//   15. Projection Contract Enforcement (anti-drift gate)
//   16. Role-Safe Fallback Redaction
'use strict';
var crypto = require('crypto');
// ============================================================================
// CORS
// ============================================================================
var CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
// ============================================================================
// PROJECTION CONTRACT VERSION (Module 12)
// Full contract spec hosted separately. Each view carries the version only,
// not the full contract object, to avoid duplicating bytes per response.
// ============================================================================
var PROJECTION_CONTRACT_VERSION = '1.0';
var PERSPECTIVE_PROJECTION_CONTRACT = Object.freeze({
  version: PROJECTION_CONTRACT_VERSION,
  invariantTruthFields: ['disposition', 'hardLocks', 'bindingClauses', 'contradictions', 'packageHash'],
  roleViewMayChange: ['language', 'priority', 'riskFraming', 'decisionBurden', 'nextBestActions', 'communicationStyle', 'teachingDepth'],
  roleViewMayNotChange: ['disposition', 'hardLocks', 'authorityClauses', 'contradictions', 'evidenceProvenance', 'mechanismDominance'],
  rule: 'Projection may change perspective only. It may not change engineering, safety, code, or contradiction truth.'
});
// ============================================================================
// ROLE DEFINITIONS (Module 1)
// ============================================================================
var ROLES = {
  INSPECTOR: {
    label: 'Inspector',
    acceptedCertifications: ['API_ICP', 'AWS_CWI', 'ASNT_LEVEL_II', 'ASNT_LEVEL_III', 'NACE_CIP'],
    authorizedActions: ['CAPTURE_OBSERVATION', 'REQUEST_REINSPECTION', 'FLAG_FOR_ENGINEER_REVIEW', 'ESCALATE_SAFETY_HAZARD', 'DOCUMENT_FINDINGS'],
    deniedActions: ['ISSUE_FFS_LEVEL_2', 'AUTHORIZE_REPAIR', 'APPROVE_CONTINUED_SERVICE', 'WAIVE_CODE_REQUIREMENT', 'OVERRIDE_HARD_LOCK']
  },
  ENGINEER: {
    label: 'Integrity Engineer',
    acceptedCertifications: ['PE', 'API_510', 'API_570', 'API_653', 'API_580'],
    authorizedActions: ['ISSUE_DISPOSITION', 'AUTHORIZE_FFS_LEVEL_2', 'AUTHORIZE_FFS_LEVEL_3', 'APPROVE_REPAIR_DESIGN', 'APPROVE_CONTINUED_SERVICE', 'SET_INSPECTION_INTERVAL', 'REQUEST_OPERATIONS_ACTION'],
    deniedActions: ['WAIVE_CODE_REQUIREMENT', 'OVERRIDE_HARD_LOCK', 'SUPPRESS_SAFETY_FINDING']
  },
  TECHNICIAN: {
    label: 'NDT Technician',
    acceptedCertifications: ['ASNT_LEVEL_I', 'ASNT_LEVEL_II'],
    authorizedActions: ['EXECUTE_INSPECTION_PROCEDURE', 'CAPTURE_DATA', 'CALIBRATE_EQUIPMENT', 'REPORT_HAZARD', 'REQUEST_LEVEL_II_REVIEW'],
    deniedActions: ['ISSUE_DISPOSITION', 'INTERPRET_FINDINGS', 'AUTHORIZE_REPAIR', 'WAIVE_CODE_REQUIREMENT']
  },
  OPS_MANAGER: {
    label: 'Operations Manager',
    acceptedCertifications: [],
    authorizedActions: ['AUTHORIZE_PLANNED_SHUTDOWN', 'AUTHORIZE_PRODUCTION_RATE_CHANGE', 'ESCALATE_TO_LEADERSHIP', 'REQUEST_ENGINEERING_REVIEW', 'COMMIT_RESOURCES'],
    deniedActions: ['OVERRIDE_ENGINEERING_DISPOSITION', 'WAIVE_CODE_REQUIREMENT', 'SUPPRESS_SAFETY_FINDING']
  },
  SAFETY: {
    label: 'Safety Officer',
    acceptedCertifications: ['OSHA_30', 'NEBOSH', 'CSP', 'CIH'],
    authorizedActions: ['ISSUE_STOP_WORK', 'REQUIRE_PERSONNEL_EVACUATION', 'FILE_JURISDICTIONAL_REPORT', 'DECLARE_HAZARDOUS_CONDITION', 'OVERRIDE_PRODUCTION_DECISION'],
    deniedActions: ['WAIVE_PPE_REQUIREMENT', 'AUTHORIZE_EXPOSURE_ABOVE_PEL']
  },
  STUDENT: {
    label: 'Student / Trainee',
    acceptedCertifications: [],
    authorizedActions: ['VIEW_TEACHING_PROJECTION', 'PRACTICE_ON_RECORDED_CASE'],
    deniedActions: ['ISSUE_DISPOSITION', 'CAPTURE_OFFICIAL_OBSERVATION', 'INFLUENCE_LIVE_DECISION']
  }
};
// ============================================================================
// SAFETY-CRITICAL DISPOSITIONS (Module 9 input)
// ============================================================================
var SAFETY_CRITICAL_DISPOSITIONS = [
  'REJECT_FROM_SERVICE',
  'REPORT_TO_JURISDICTIONAL_AUTHORITY',
  'HOLD_FOR_INPUT',
  'HALT_AND_ESCALATE'
];
// ============================================================================
// BLIND-SPOT RULES (Module 5)
// ============================================================================
var BLIND_SPOT_RULES = [
  { role: 'INSPECTOR', condition: function (pkg) { return pkg.fmd && pkg.fmd.margin < 0.15; },
    message: 'FMD margin is below 0.15 - dominant mechanism not clearly distinguished. Consider additional inspection data.' },
  { role: 'INSPECTOR', condition: function (pkg) { return pkg.provenance && pkg.provenance.lowestProvenance === 'ASSUMED'; },
    message: 'Disposition depends on at least one ASSUMED value. Re-inspection may change the recommended action.' },
  { role: 'ENGINEER', condition: function (pkg) { return pkg.contradictions && pkg.contradictions.some(function (c) { return c.resolved === false; }); },
    message: 'One or more contradictions remain unresolved. Review before issuing final disposition.' },
  { role: 'ENGINEER', condition: function (pkg) { return pkg.timeline && pkg.timeline.rateControllingMechanism === null && pkg.timeline.compound === true; },
    message: 'Compound mechanism with no dominant rate-controller. Joint envelope in use. Confirm acceptability.' },
  { role: 'OPS_MANAGER', condition: function (pkg) { return pkg.disposition === 'ACCEPT_WITH_MONITORING' && pkg.timeline && pkg.timeline.timeToActionDays < 30; },
    message: 'Monitoring interval under 30 days. Confirm resources and scheduling can execute without slipping.' },
  { role: 'OPS_MANAGER', condition: function (pkg) { return pkg.hardLocks && pkg.hardLocks.length > 0; },
    message: 'Safety hard locks have triggered. These cannot be overridden by ops decisions.' },
  { role: 'TECHNICIAN', condition: function (pkg) { return pkg.resolved && pkg.resolved.environment && pkg.resolved.environment.hazards && pkg.resolved.environment.hazards.length > 0; },
    message: 'Hazardous environment factors present. Review PPE and entry permits before inspection.' },
  { role: 'SAFETY', condition: function (pkg) { return pkg.disposition === 'ACCEPT_FOR_CONTINUED_SERVICE' && pkg.confidence < 0.7; },
    message: 'ACCEPT disposition but confidence below 0.70. Confirm risk tolerance is appropriate.' },
  { role: 'STUDENT', condition: function (pkg) { return pkg.fmd && pkg.fmd.candidates && pkg.fmd.candidates.length >= 3; },
    message: 'Multiple mechanisms plausible. Practice walking through each and why the dominant ranked higher.' }
];
// ============================================================================
// ESCALATION TRIGGER RULES (Module 8)
// ============================================================================
var ESCALATION_TRIGGER_RULES = [
  { id: 'ESC_LOSS_OF_CONTAINMENT_IMMINENT',
    condition: function (pkg) { return pkg.hardLocks && pkg.hardLocks.some(function (h) { return h.trigger === 'LOSS_OF_CONTAINMENT_IMMINENT'; }); },
    severity: 'CRITICAL',
    affectedRoles: ['INSPECTOR', 'ENGINEER', 'TECHNICIAN', 'OPS_MANAGER', 'SAFETY'],
    requiredAction: 'IMMEDIATE_EVACUATION_AND_ISOLATION',
    authorityClause: 'OSHA 29 CFR 1910.119 - Process Safety Management' },
  { id: 'ESC_NACE_HARDNESS_EXCEEDED',
    condition: function (pkg) { return pkg.hardLocks && pkg.hardLocks.some(function (h) { return h.trigger === 'NACE_HARDNESS_EXCEEDED'; }); },
    severity: 'HIGH',
    affectedRoles: ['INSPECTOR', 'ENGINEER', 'OPS_MANAGER', 'SAFETY'],
    requiredAction: 'REMOVE_FROM_WET_H2S_SERVICE',
    authorityClause: 'NACE MR0175 / ISO 15156 hardness limit' },
  { id: 'ESC_CODE_ALLOWABLE_EXCEEDED',
    condition: function (pkg) { return pkg.hardLocks && pkg.hardLocks.some(function (h) { return h.trigger === 'CODE_ALLOWABLE_EXCEEDED'; }); },
    severity: 'HIGH',
    affectedRoles: ['INSPECTOR', 'ENGINEER', 'OPS_MANAGER'],
    requiredAction: 'REJECT_FROM_SERVICE',
    authorityClause: 'API 510/570/653 minimum thickness requirement' },
  { id: 'ESC_JURISDICTIONAL_REPORT_REQUIRED',
    condition: function (pkg) { return pkg.disposition === 'REPORT_TO_JURISDICTIONAL_AUTHORITY'; },
    severity: 'HIGH',
    affectedRoles: ['ENGINEER', 'OPS_MANAGER', 'SAFETY'],
    requiredAction: 'FILE_REPORT_WITH_JURISDICTION',
    authorityClause: 'State boiler inspection authority / OSHA reporting requirements' },
  { id: 'ESC_METHOD_MECHANISM_MISMATCH',
    condition: function (pkg) { return pkg.contradictions && pkg.contradictions.some(function (c) { return c.type === 'METHOD_MECHANISM_MISMATCH' && c.resolved === false; }); },
    severity: 'MEDIUM',
    affectedRoles: ['INSPECTOR', 'ENGINEER', 'TECHNICIAN'],
    requiredAction: 'CHANGE_INSPECTION_METHOD_BEFORE_PROCEEDING',
    authorityClause: 'ASNT recommended practice for method selection' }
];
// ============================================================================
// MODULE 13: DETERMINISTIC CANONICALIZATION + STABLE HASHING
// Deep recursive sort. Fixes shallow-sort bug in v1.
// ============================================================================
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
function canonicalJson(obj) {
  return stableStringify(obj);
}
function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}
function deterministicProjectionTimestamp(pkg, roleContext) {
  // Never use current time inside the projection. Use a frozen timestamp.
  if (pkg) {
    if (pkg.projectionTimestamp) return pkg.projectionTimestamp;
    if (pkg.decisionTimestamp) return pkg.decisionTimestamp;
    if (pkg.packageTimestamp) return pkg.packageTimestamp;
    if (pkg.timestamp) return pkg.timestamp;
  }
  if (roleContext && roleContext.requestTimestamp) return roleContext.requestTimestamp;
  return null;
}
// Hash the set of binding clauses (sorted by code+clause) for invariant check.
// Reordering for presentation is allowed; adding/removing is not.
function bindingClausesHash(clauses) {
  if (!clauses || !Array.isArray(clauses) || clauses.length === 0) return sha256('[]');
  var normalized = clauses.map(function (c) {
    return {
      code: c.code || '',
      clause: c.clause || '',
      requirement: c.requirement || ''
    };
  });
  normalized.sort(function (a, b) {
    var ka = a.code + '::' + a.clause;
    var kb = b.code + '::' + b.clause;
    return ka < kb ? -1 : (ka > kb ? 1 : 0);
  });
  return sha256(canonicalJson(normalized));
}
function countUnresolvedContradictions(pkg) {
  if (!pkg || !pkg.contradictions || !Array.isArray(pkg.contradictions)) return 0;
  return pkg.contradictions.filter(function (c) { return c && c.resolved === false; }).length;
}
// ============================================================================
// MODULE 14: INPUT SCHEMA VALIDATION
// ============================================================================
function validateDecisionPackage(pkg) {
  var errors = [];
  if (!pkg || typeof pkg !== 'object') {
    errors.push('decisionPackage must be an object');
    return { ok: false, errors: errors };
  }
  if (!pkg.disposition) errors.push('decisionPackage.disposition is required');
  if (pkg.hardLocks && !Array.isArray(pkg.hardLocks)) errors.push('decisionPackage.hardLocks must be an array');
  if (pkg.contradictions && !Array.isArray(pkg.contradictions)) errors.push('decisionPackage.contradictions must be an array');
  if (pkg.bindingClauses && !Array.isArray(pkg.bindingClauses)) errors.push('decisionPackage.bindingClauses must be an array');
  if (typeof pkg.confidence !== 'undefined' && (typeof pkg.confidence !== 'number' || pkg.confidence < 0 || pkg.confidence > 1)) {
    errors.push('decisionPackage.confidence must be a number between 0 and 1');
  }
  return { ok: errors.length === 0, errors: errors };
}
function validateRoleContext(roleContext) {
  var errors = [];
  if (!roleContext || typeof roleContext !== 'object') {
    errors.push('roleContext must be an object');
    return { ok: false, errors: errors };
  }
  if (!roleContext.role) errors.push('roleContext.role is required');
  if (roleContext.certifications && !Array.isArray(roleContext.certifications)) {
    errors.push('roleContext.certifications must be an array');
  }
  return { ok: errors.length === 0, errors: errors };
}
// ============================================================================
// MODULE 1: ROLE RESOLVER (with credential validity hardening)
// ============================================================================
function resolveRole(roleContext, packageTimestamp) {
  if (!roleContext || !roleContext.role) {
    return { ok: false, error: 'Role context missing role identifier' };
  }
  var roleDef = ROLES[roleContext.role];
  if (!roleDef) {
    return { ok: false, error: 'Unknown role: ' + roleContext.role };
  }
  // Credential validation: status ACTIVE, not expired (against frozen
  // timestamp, never wall clock), jurisdiction compatible, tenant matched
  // where provided.
  if (roleDef.acceptedCertifications.length > 0) {
    var presentedCerts = Array.isArray(roleContext.certifications) ? roleContext.certifications : [];
    var refIso = roleContext.evaluationTimestamp || roleContext.requestTimestamp || packageTimestamp || null;
    var hasAcceptable = presentedCerts.some(function (cert) {
      if (!cert || roleDef.acceptedCertifications.indexOf(cert.type) < 0) return false;
      if (cert.status && cert.status !== 'ACTIVE') return false;
      if (cert.expiresAt && refIso && cert.expiresAt < refIso) return false;
      if (cert.jurisdiction && roleContext.jurisdiction && cert.jurisdiction !== roleContext.jurisdiction && cert.jurisdiction !== 'GLOBAL') return false;
      if (roleContext.tenantId && cert.tenantId && cert.tenantId !== roleContext.tenantId) return false;
      return true;
    });
    if (!hasAcceptable) {
      return {
        ok: false,
        error: 'Role ' + roleContext.role + ' requires an active, non-expired, jurisdiction-compatible credential of one of: ' + roleDef.acceptedCertifications.join(', ')
      };
    }
  }
  return {
    ok: true,
    role: roleContext.role,
    roleDef: roleDef,
    userId: roleContext.userId || 'unknown',
    tenantId: roleContext.tenantId || 'unknown',
    jurisdiction: roleContext.jurisdiction || 'UNSPECIFIED',
    taskContext: roleContext.taskContext || 'DESKTOP_LIVE'
  };
}
// ============================================================================
// MODULE 3: DECISION BURDEN ENGINE
// ============================================================================
function computeDecisionBurden(pkg, resolvedRole) {
  var role = resolvedRole.role;
  var disp = pkg.disposition;
  if (role === 'INSPECTOR') {
    if (disp === 'HOLD_FOR_INPUT') return 'Collect the missing evidence specified below, then re-submit.';
    if (disp === 'REINSPECT_BY_METHOD') return 'Execute the recommended re-inspection method, then document findings.';
    return 'Verify the captured observations match field conditions, then document.';
  }
  if (role === 'ENGINEER') {
    if (disp === 'REJECT_FROM_SERVICE') return 'Confirm REJECT disposition; authorize removal from service; document basis.';
    if (disp === 'FFS_LEVEL_2_REQUIRED') return 'Initiate FFS Level 2 assessment per API 579-1.';
    if (disp === 'FFS_LEVEL_3_REQUIRED') return 'Initiate FFS Level 3 assessment; consider third-party review.';
    if (disp === 'REPAIR') return 'Approve repair design and execution plan.';
    if (disp === 'ACCEPT_FOR_CONTINUED_SERVICE') return 'Confirm acceptance; set or adjust inspection interval.';
    if (disp === 'ACCEPT_WITH_MONITORING') return 'Confirm monitoring plan parameters and interval.';
    return 'Review the deterministic disposition and confirm or escalate.';
  }
  if (role === 'TECHNICIAN') {
    if (disp === 'REINSPECT_BY_METHOD') return 'Execute the recommended inspection method per procedure. Do not interpret findings.';
    return 'Execute assigned procedure; capture data; report any hazards.';
  }
  if (role === 'OPS_MANAGER') {
    if (disp === 'REJECT_FROM_SERVICE') return 'Plan immediate removal from service. Coordinate shutdown logistics.';
    if (disp === 'REPAIR') return 'Plan outage window for repair execution.';
    if (disp === 'ACCEPT_WITH_MONITORING') return 'Confirm monitoring resources and scheduling are committed.';
    return 'Acknowledge disposition; ensure scheduling and resourcing align.';
  }
  if (role === 'SAFETY') {
    if (pkg.hardLocks && pkg.hardLocks.length > 0) return 'Verify all hard-lock conditions are addressed; issue stop-work if conditions warrant.';
    if (disp === 'REPORT_TO_JURISDICTIONAL_AUTHORITY') return 'File required jurisdictional report; ensure notifications are documented.';
    return 'Review safety implications; confirm no exposure or stop-work conditions exist.';
  }
  if (role === 'STUDENT') {
    return 'Study the decision path; identify which concepts and code rules apply.';
  }
  return 'Review disposition.';
}
// ============================================================================
// MODULE 4: RISK VISIBILITY ENGINE
// ============================================================================
function estimateProductionImpact(pkg) {
  if (pkg.disposition === 'REJECT_FROM_SERVICE') return 'Immediate removal required';
  if (pkg.disposition === 'REPAIR') return 'Planned outage required';
  if (pkg.disposition === 'ACCEPT_WITH_MONITORING') return 'Continued operation with elevated inspection cadence';
  if (pkg.disposition === 'ACCEPT_FOR_CONTINUED_SERVICE') return 'Continued operation at normal cadence';
  if (pkg.disposition === 'HOLD_FOR_INPUT') return 'Disposition pending - assume worst-case until resolved';
  return 'See engineering disposition';
}
function computeRiskVisibility(pkg, resolvedRole) {
  var role = resolvedRole.role;
  var consequenceTier = (pkg.consequence && pkg.consequence.tier) || 'UNKNOWN';
  var ttaDays = (pkg.timeline && typeof pkg.timeline.timeToActionDays === 'number') ? pkg.timeline.timeToActionDays : null;
  var visibility = {
    consequenceTier: consequenceTier,
    primaryFraming: '',
    secondaryMetrics: []
  };
  if (role === 'INSPECTOR') {
    visibility.primaryFraming = 'Mechanism: ' + (pkg.fmd && pkg.fmd.dominant ? pkg.fmd.dominant : 'undetermined') +
      ' | Margin: ' + (pkg.fmd && typeof pkg.fmd.margin === 'number' ? pkg.fmd.margin.toFixed(2) : 'n/a');
    if (ttaDays !== null) visibility.secondaryMetrics.push('Time to action: ' + ttaDays + ' days');
    if (pkg.provenance) visibility.secondaryMetrics.push('Lowest provenance: ' + pkg.provenance.lowestProvenance);
  } else if (role === 'ENGINEER') {
    var rsf = pkg.remainingStrength && pkg.remainingStrength.rsf;
    var mawp = pkg.remainingStrength && pkg.remainingStrength.mawp;
    visibility.primaryFraming = 'RSF: ' + (typeof rsf === 'number' ? rsf.toFixed(3) : 'n/a') +
      ' | MAWP: ' + (typeof mawp === 'number' ? mawp.toFixed(1) + ' psi' : 'n/a');
    if (ttaDays !== null) visibility.secondaryMetrics.push('Time to action: ' + ttaDays + ' days');
    visibility.secondaryMetrics.push('Confidence: ' + (typeof pkg.confidence === 'number' ? (pkg.confidence * 100).toFixed(0) + '%' : 'n/a'));
    visibility.secondaryMetrics.push('Consequence tier: ' + consequenceTier);
  } else if (role === 'TECHNICIAN') {
    visibility.primaryFraming = 'Procedure required: ' + (pkg.recommendedMethod || 'as assigned');
    visibility.secondaryMetrics.push('Hazards present: ' + (pkg.resolved && pkg.resolved.environment && pkg.resolved.environment.hazards ? pkg.resolved.environment.hazards.join(', ') : 'none flagged'));
  } else if (role === 'OPS_MANAGER') {
    visibility.primaryFraming = 'Disposition: ' + pkg.disposition + ' | Action window: ' + (ttaDays !== null ? ttaDays + ' days' : 'n/a');
    visibility.secondaryMetrics.push('Consequence tier: ' + consequenceTier);
    visibility.secondaryMetrics.push('Production impact: ' + estimateProductionImpact(pkg));
  } else if (role === 'SAFETY') {
    var hazardCount = (pkg.resolved && pkg.resolved.environment && pkg.resolved.environment.hazards) ? pkg.resolved.environment.hazards.length : 0;
    var hardLockCount = pkg.hardLocks ? pkg.hardLocks.length : 0;
    visibility.primaryFraming = 'Hard locks: ' + hardLockCount + ' | Hazards: ' + hazardCount + ' | Consequence: ' + consequenceTier;
    visibility.secondaryMetrics.push('Reporting required: ' + (pkg.disposition === 'REPORT_TO_JURISDICTIONAL_AUTHORITY' ? 'YES' : 'no'));
  } else if (role === 'STUDENT') {
    visibility.primaryFraming = 'Teaching case: ' + (pkg.fmd && pkg.fmd.dominant ? pkg.fmd.dominant : 'mechanism analysis');
    visibility.secondaryMetrics.push('Code basis: ' + (pkg.bindingClauses && pkg.bindingClauses.length > 0 ? pkg.bindingClauses[0].code : 'n/a'));
  }
  return visibility;
}
// ============================================================================
// MODULE 5: BLIND-SPOT DETECTOR
// ============================================================================
function detectBlindSpots(pkg, resolvedRole) {
  var flags = [];
  for (var i = 0; i < BLIND_SPOT_RULES.length; i++) {
    var rule = BLIND_SPOT_RULES[i];
    if (rule.role !== resolvedRole.role) continue;
    try {
      if (rule.condition(pkg)) {
        flags.push({ message: rule.message, dismissible: true });
      }
    } catch (e) {
      // Defensive: a malformed package should not crash the projector
    }
  }
  return flags;
}
// ============================================================================
// MODULE 6: NEXT-BEST-ACTION ENGINE (role-authority bounded)
// ============================================================================
function computeNextBestAction(pkg, resolvedRole) {
  var actions = [];
  var roleDef = resolvedRole.roleDef;
  var disp = pkg.disposition;
  var candidates = [];
  if (disp === 'HOLD_FOR_INPUT') {
    candidates.push({ action: 'REQUEST_REINSPECTION', detail: 'Collect missing evidence: ' + ((pkg.requiredInspections || []).map(function (r) { return r.description; }).join('; ') || 'see HOLD spec') });
  }
  if (disp === 'REINSPECT_BY_METHOD') {
    candidates.push({ action: 'EXECUTE_INSPECTION_PROCEDURE', detail: 'Perform ' + (pkg.recommendedMethod || 'recommended method') + ' per procedure' });
    candidates.push({ action: 'CAPTURE_DATA', detail: 'Record findings with required photo evidence' });
  }
  if (disp === 'REJECT_FROM_SERVICE') {
    candidates.push({ action: 'ISSUE_DISPOSITION', detail: 'Formally issue REJECT disposition' });
    candidates.push({ action: 'AUTHORIZE_PLANNED_SHUTDOWN', detail: 'Coordinate removal-from-service logistics' });
    candidates.push({ action: 'ISSUE_STOP_WORK', detail: 'If continued operation poses imminent hazard, issue stop-work' });
  }
  if (disp === 'FFS_LEVEL_2_REQUIRED' || disp === 'FFS_LEVEL_3_REQUIRED') {
    candidates.push({ action: 'AUTHORIZE_FFS_LEVEL_2', detail: 'Initiate FFS Level 2 per API 579-1' });
    candidates.push({ action: 'AUTHORIZE_FFS_LEVEL_3', detail: 'Escalate to FFS Level 3 if Level 2 insufficient' });
  }
  if (disp === 'REPAIR') {
    candidates.push({ action: 'APPROVE_REPAIR_DESIGN', detail: 'Review and approve repair plan' });
    candidates.push({ action: 'AUTHORIZE_PLANNED_SHUTDOWN', detail: 'Schedule repair outage' });
  }
  if (disp === 'ACCEPT_WITH_MONITORING') {
    candidates.push({ action: 'SET_INSPECTION_INTERVAL', detail: 'Confirm or adjust inspection interval based on timeline' });
  }
  if (pkg.hardLocks && pkg.hardLocks.length > 0) {
    candidates.push({ action: 'ESCALATE_SAFETY_HAZARD', detail: 'Notify safety officer of triggered hard lock(s)' });
  }
  // Filter by role authorization
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    var authorized = roleDef.authorizedActions.indexOf(c.action) >= 0;
    var denied = roleDef.deniedActions.indexOf(c.action) >= 0;
    if (authorized && !denied) {
      actions.push(c);
    }
  }
  // If nothing authorized for this role on a high-stakes disposition, surface
  // a "request review" action
  if (actions.length === 0 && (disp === 'REJECT_FROM_SERVICE' || disp === 'FFS_LEVEL_2_REQUIRED' || disp === 'FFS_LEVEL_3_REQUIRED')) {
    actions.push({ action: 'FLAG_FOR_ENGINEER_REVIEW', detail: 'This decision is above your authorization scope - flag for engineer review.' });
  }
  return actions;
}
// ============================================================================
// MODULE 7: COMMUNICATION TRANSLATOR (deterministic templates)
// ============================================================================
function communicationStyle(role) {
  if (role === 'INSPECTOR') return { tone: 'direct-procedural', detail: 'high', jargon: 'NDT-specific' };
  if (role === 'ENGINEER') return { tone: 'technical-formal', detail: 'high', jargon: 'engineering' };
  if (role === 'TECHNICIAN') return { tone: 'imperative-checklist', detail: 'step-by-step', jargon: 'minimal' };
  if (role === 'OPS_MANAGER') return { tone: 'executive-summary', detail: 'medium', jargon: 'business' };
  if (role === 'SAFETY') return { tone: 'authoritative-regulatory', detail: 'high', jargon: 'regulatory' };
  if (role === 'STUDENT') return { tone: 'instructive-explanatory', detail: 'expanded', jargon: 'defined' };
  return { tone: 'neutral', detail: 'medium', jargon: 'minimal' };
}
// ============================================================================
// MODULE 8: ESCALATION TRIGGER ENGINE
// ============================================================================
function computeEscalationTriggers(pkg, resolvedRole) {
  var triggers = [];
  for (var i = 0; i < ESCALATION_TRIGGER_RULES.length; i++) {
    var rule = ESCALATION_TRIGGER_RULES[i];
    try {
      if (rule.condition(pkg) && rule.affectedRoles.indexOf(resolvedRole.role) >= 0) {
        triggers.push({
          id: rule.id,
          severity: rule.severity,
          requiredAction: rule.requiredAction,
          authorityClause: rule.authorityClause,
          locked: true
        });
      }
    } catch (e) {
      // Defensive
    }
  }
  return triggers;
}
// ============================================================================
// MODULE 11: MUST-NOT-CONCLUDE SURFACE
// ============================================================================
function buildMustNotConclude(pkg, resolvedRole) {
  var items = [];
  if (pkg.mustNotConclude && Array.isArray(pkg.mustNotConclude)) {
    for (var i = 0; i < pkg.mustNotConclude.length; i++) {
      items.push(pkg.mustNotConclude[i]);
    }
  }
  if (pkg.provenance && pkg.provenance.lowestProvenance === 'ASSUMED') {
    items.push('Do NOT treat this disposition as final - it depends on ASSUMED values. Upgrade provenance via re-inspection before finalizing.');
  }
  if (pkg.fmd && typeof pkg.fmd.margin === 'number' && pkg.fmd.margin < 0.10) {
    items.push('Do NOT lock in the dominant mechanism - FMD margin is below 0.10 and a second mechanism is statistically tied.');
  }
  if (typeof pkg.confidence === 'number' && pkg.confidence < 0.60) {
    items.push('Do NOT issue a confident disposition - overall confidence is below 0.60. Additional evidence is needed.');
  }
  if (pkg.contradictions && pkg.contradictions.some(function (c) { return c.resolved === false; })) {
    items.push('Do NOT proceed past unresolved contradictions - review and resolve them before disposition is final.');
  }
  return items;
}
// ============================================================================
// CRITICAL DISCLOSURES BUILDER
// ============================================================================
function buildCriticalDisclosures(pkg) {
  var disclosures = [];
  if (pkg.hardLocks && pkg.hardLocks.length > 0) {
    for (var i = 0; i < pkg.hardLocks.length; i++) {
      var lock = pkg.hardLocks[i];
      disclosures.push({
        kind: 'HARD_LOCK',
        trigger: lock.trigger,
        safeStateOutput: lock.safeStateOutput,
        severity: lock.severity || 'CRITICAL',
        mandatory: true
      });
    }
  }
  if (SAFETY_CRITICAL_DISPOSITIONS.indexOf(pkg.disposition) >= 0) {
    disclosures.push({
      kind: 'SAFETY_CRITICAL_DISPOSITION',
      disposition: pkg.disposition,
      mandatory: true
    });
  }
  if (pkg.contradictions && pkg.contradictions.length > 0) {
    var unresolved = pkg.contradictions.filter(function (c) { return c.resolved === false; });
    for (var j = 0; j < unresolved.length; j++) {
      disclosures.push({
        kind: 'UNRESOLVED_CONTRADICTION',
        type: unresolved[j].type,
        description: unresolved[j].description,
        mandatory: true
      });
    }
  }
  return disclosures;
}
// ============================================================================
// MODULE 9: SUPPRESSION VALIDATOR (SAFETY GATE)
// ============================================================================
function validateSuppression(roleView, pkg) {
  var required = buildCriticalDisclosures(pkg);
  var present = roleView.criticalDisclosures || [];
  var missing = [];
  for (var i = 0; i < required.length; i++) {
    var req = required[i];
    var found = false;
    for (var j = 0; j < present.length; j++) {
      var p = present[j];
      if (p.kind === req.kind) {
        if (req.kind === 'HARD_LOCK' && p.trigger === req.trigger) { found = true; break; }
        if (req.kind === 'SAFETY_CRITICAL_DISPOSITION' && p.disposition === req.disposition) { found = true; break; }
        if (req.kind === 'UNRESOLVED_CONTRADICTION' && p.type === req.type) { found = true; break; }
      }
    }
    if (!found) missing.push(req);
  }
  return { ok: missing.length === 0, missing: missing };
}
// ============================================================================
// MODULE 15: PROJECTION CONTRACT ENFORCEMENT (anti-drift gate)
// Verifies that no projection step has mutated invariant truth fields.
// ============================================================================
function enforceProjectionContract(roleView, pkg, packageHashValue) {
  var violations = [];
  if (!roleView.invariantTruth) {
    violations.push('invariantTruth block missing from role view');
    return { ok: false, violations: violations };
  }
  if (roleView.invariantTruth.disposition !== pkg.disposition) {
    violations.push('disposition changed during projection');
  }
  if (roleView.invariantTruth.packageHash !== packageHashValue) {
    violations.push('packageHash changed during projection');
  }
  var expectedHardLockCount = pkg.hardLocks ? pkg.hardLocks.length : 0;
  if (roleView.invariantTruth.hardLockCount !== expectedHardLockCount) {
    violations.push('hardLock count changed during projection');
  }
  if (roleView.invariantTruth.unresolvedContradictionCount !== countUnresolvedContradictions(pkg)) {
    violations.push('unresolved contradiction count changed during projection');
  }
  var expectedClausesHash = bindingClausesHash(pkg.bindingClauses);
  if (roleView.invariantTruth.bindingClausesHash !== expectedClausesHash) {
    violations.push('bindingClauses set changed during projection (add/remove detected)');
  }
  return { ok: violations.length === 0, violations: violations };
}
// ============================================================================
// MODULE 16: ROLE-SAFE FALLBACK REDACTION
// The fallback raw view dumps the package. Redact sensitive identifiers for
// roles that should not see them (notably STUDENT). Extend as needed for
// your asset metadata fields.
// ============================================================================
var SENSITIVE_FIELDS = [
  'assetId', 'assetName', 'assetTag',
  'customerId', 'customerName', 'operatorName',
  'siteId', 'siteName', 'location', 'gps', 'address',
  'serialNumber', 'workOrderId', 'inspectorEmail', 'inspectorPhone'
];
function deepRedact(value, fieldsToRedact) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map(function (v) { return deepRedact(v, fieldsToRedact); });
  }
  var out = {};
  var keys = Object.keys(value);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (fieldsToRedact.indexOf(k) >= 0) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = deepRedact(value[k], fieldsToRedact);
    }
  }
  return out;
}
function redactForRole(pkg, role) {
  // STUDENT must not see asset or customer identifiers in teaching cases.
  if (role === 'STUDENT') {
    return deepRedact(pkg, SENSITIVE_FIELDS);
  }
  // Other roles see the full package. Extend here for stricter policies
  // (e.g., redact customer financial fields for OPS_MANAGER, etc.).
  return pkg;
}
// ============================================================================
// FALLBACK RAW VIEW (with role-safe redaction)
// ============================================================================
function buildFallbackRawView(pkg, role) {
  var redactedPkg = redactForRole(pkg, role);
  return {
    role: 'FALLBACK_RAW',
    originatingRole: role,
    headline: 'Raw decision package (role projection failed validation)',
    criticalDisclosures: buildCriticalDisclosures(pkg),
    decisionBurden: 'Review the raw package directly. A role-specific view could not be safely generated.',
    riskVisibility: { primaryFraming: 'Disposition: ' + pkg.disposition, secondaryMetrics: [] },
    blindSpots: [],
    nextBestActions: [],
    escalationTriggers: [],
    mustNotConclude: pkg.mustNotConclude || [],
    rawPackage: redactedPkg,
    fallback: true
  };
}
// ============================================================================
// MODULE 10: CROSS-ROLE COHERENCE LOGGER
// Fixed: receives roleContext so deterministicProjectionTimestamp resolves.
// In production: replace console.log with persistent storage (see File 8 -
// coherence-log function backed by Netlify Blobs).
// ============================================================================
function logCoherence(pkg, resolvedRole, roleContext, roleView, packageHashValue) {
  var viewHash = sha256(canonicalJson(roleView));
  var record = {
    projectionTimestamp: deterministicProjectionTimestamp(pkg, roleContext),
    packageHash: packageHashValue,
    role: resolvedRole.role,
    userId: resolvedRole.userId,
    tenantId: resolvedRole.tenantId,
    jurisdiction: resolvedRole.jurisdiction,
    taskContext: resolvedRole.taskContext,
    viewHash: viewHash,
    disposition: pkg.disposition,
    hardLockCount: pkg.hardLocks ? pkg.hardLocks.length : 0,
    unresolvedContradictionCount: countUnresolvedContradictions(pkg)
  };
  console.log('[PIL_COHERENCE]', JSON.stringify(record));
  return record;
}
// ============================================================================
// HEADLINE BUILDER
// ============================================================================
function buildHeadline(pkg, resolvedRole) {
  var role = resolvedRole.role;
  var disp = pkg.disposition;
  if (pkg.hardLocks && pkg.hardLocks.length > 0) {
    return 'HARD LOCK ACTIVE: ' + pkg.hardLocks[0].trigger + ' - safe-state output mandated';
  }
  if (role === 'INSPECTOR') {
    if (disp === 'HOLD_FOR_INPUT') return 'Insufficient evidence - additional inspection required';
    return 'Disposition: ' + disp + ' - review required evidence and next inspection';
  }
  if (role === 'ENGINEER') {
    return 'Disposition: ' + disp + ' - confirm and document basis';
  }
  if (role === 'TECHNICIAN') {
    return 'Field procedure: ' + (pkg.recommendedMethod || 'see assignment');
  }
  if (role === 'OPS_MANAGER') {
    return 'Operational action required: ' + estimateProductionImpact(pkg);
  }
  if (role === 'SAFETY') {
    return 'Safety status: ' + (pkg.hardLocks && pkg.hardLocks.length > 0 ? 'HARD LOCK' : (pkg.disposition === 'ACCEPT_FOR_CONTINUED_SERVICE' ? 'No active stop conditions' : 'Review required'));
  }
  if (role === 'STUDENT') {
    return 'Teaching case: ' + (pkg.fmd && pkg.fmd.dominant ? pkg.fmd.dominant : 'mechanism analysis');
  }
  return 'Decision projection';
}
// ============================================================================
// MAIN PROJECTION FUNCTION
// ============================================================================
function projectForRole(pkg, roleContext) {
  // Validate inputs
  var pkgValidation = validateDecisionPackage(pkg);
  if (!pkgValidation.ok) {
    return { error: 'Invalid decisionPackage: ' + pkgValidation.errors.join('; '), statusCode: 400 };
  }
  var roleValidation = validateRoleContext(roleContext);
  if (!roleValidation.ok) {
    return { error: 'Invalid roleContext: ' + roleValidation.errors.join('; '), statusCode: 400 };
  }
  // Resolve role with hardened credential checks
  var packageTimestamp = pkg.projectionTimestamp || pkg.decisionTimestamp || pkg.packageTimestamp || pkg.timestamp || null;
  var resolved = resolveRole(roleContext, packageTimestamp);
  if (!resolved.ok) {
    return { error: resolved.error, statusCode: 403 };
  }
  // Compute packageHash once, reuse everywhere
  var packageHashValue = pkg.packageHash || sha256(canonicalJson(pkg));
  var clausesHashValue = bindingClausesHash(pkg.bindingClauses);
  var unresolvedCount = countUnresolvedContradictions(pkg);
  // Build the role view
  var view = {
    role: resolved.role,
    roleLabel: resolved.roleDef.label,
    jurisdiction: resolved.jurisdiction,
    taskContext: resolved.taskContext,
    projectionTimestamp: deterministicProjectionTimestamp(pkg, roleContext),
    packageId: pkg.packageId || 'unknown',
    packageHash: packageHashValue,
    projectionContractVersion: PROJECTION_CONTRACT_VERSION,
    communicationStyle: communicationStyle(resolved.role),
    // Invariant truth - the fields the projection contract guarantees
    // will be unchanged from the source package.
    invariantTruth: {
      disposition: pkg.disposition,
      packageHash: packageHashValue,
      hardLockCount: pkg.hardLocks ? pkg.hardLocks.length : 0,
      unresolvedContradictionCount: unresolvedCount,
      bindingClausesHash: clausesHashValue,
      bindingClauses: pkg.bindingClauses || []
    },
    // Module outputs
    decisionBurden: computeDecisionBurden(pkg, resolved),
    riskVisibility: computeRiskVisibility(pkg, resolved),
    blindSpots: detectBlindSpots(pkg, resolved),
    nextBestActions: computeNextBestAction(pkg, resolved),
    escalationTriggers: computeEscalationTriggers(pkg, resolved),
    mustNotConclude: buildMustNotConclude(pkg, resolved),
    criticalDisclosures: buildCriticalDisclosures(pkg),
    headline: buildHeadline(pkg, resolved)
  };
  // SAFETY GATE: Suppression Validator
  var suppression = validateSuppression(view, pkg);
  if (!suppression.ok) {
    var fallbackS = buildFallbackRawView(pkg, resolved.role);
    fallbackS.suppressionFailure = suppression.missing;
    logCoherence(pkg, resolved, roleContext, fallbackS, packageHashValue);
    return { ok: true, view: fallbackS, suppressionFailure: suppression.missing };
  }
  // ANTI-DRIFT GATE: Projection Contract Enforcement
  var contract = enforceProjectionContract(view, pkg, packageHashValue);
  if (!contract.ok) {
    var fallbackC = buildFallbackRawView(pkg, resolved.role);
    fallbackC.projectionContractFailure = contract.violations;
    logCoherence(pkg, resolved, roleContext, fallbackC, packageHashValue);
    return { ok: true, view: fallbackC, projectionContractFailure: contract.violations };
  }
  // Sign the view
  view.suppressionValidatorOk = true;
  view.projectionContractOk = true;
  view.viewHash = sha256(canonicalJson(view));

  // DEPLOY354 - Persist the DecisionPackage for future replay verification.
  // Fire-and-forget: failure here must not block the projection.
  persistPackage(pkg, packageHashValue);
  // Log coherence (Module 10)
  logCoherence(pkg, resolved, roleContext, view, packageHashValue);
  return { ok: true, view: view };
}
// ============================================================================
// ============================================================================
// PERSIST PACKAGE — DEPLOY354 fire-and-forget store to /package-store
// ============================================================================
function persistPackage(pkg, packageHashValue) {
  try {
    var base = process.env.URL || process.env.DEPLOY_URL || '';
    if (!base) return;
    // Idempotent fire-and-forget. We don\'t await this.
    var bodyToSend = JSON.stringify({ decisionPackage: pkg });
    fetch(base + '/.netlify/functions/package-store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyToSend
    }).catch(function () {
      // Best-effort: persistence failure should not affect the projection
    });
  } catch (e) {
    // Defensive
  }
}

// HANDLER
// ============================================================================
exports.handler = async function (event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  try {
    var body = JSON.parse(event.body || '{}');
    var pkg = body.decisionPackage;
    var roleContext = body.roleContext;
    if (!pkg) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'decisionPackage is required' }) };
    }
    if (!roleContext) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'roleContext is required' }) };
    }
    var result = projectForRole(pkg, roleContext);
    if (result.error) {
      return { statusCode: result.statusCode || 400, headers: CORS_HEADERS, body: JSON.stringify({ error: result.error }) };
    }
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(result) };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Projection failed: ' + (err.message || 'unknown error') })
    };
  }
};
