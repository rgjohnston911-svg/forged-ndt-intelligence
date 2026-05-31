// ============================================================================
// situational-awareness-package.test.cjs   (Stage 11 acceptance gate)
// LOCAL-ONLY (tests/*.cjs is git-ignored). Run:
//   node tests/situational-awareness-package.test.cjs
// Full chain L9.1 -> L9.2 -> L9.3 -> L9.4 -> assemble. Proves the SA package
// hashes/signs INDEPENDENTLY and references (never recomputes) the DP hash.
// ============================================================================
'use strict';

var sa = require('../netlify/functions/situational-awareness-stakeholder.cjs');
var cd = require('../netlify/functions/situational-awareness-conflict.cjs');
var cs = require('../netlify/functions/situational-awareness-consequence.cjs');
var br = require('../netlify/functions/situational-awareness-brief.cjs');
var ap = require('../netlify/functions/situational-awareness-package.cjs');

function assert(cond, msg) { if (!cond) { throw new Error('FAIL: ' + msg); } }

function reverseKeys(obj) {
  if (obj === null || typeof obj !== 'object') { return obj; }
  if (Array.isArray(obj)) {
    var arr = [];
    for (var i = 0; i < obj.length; i++) { arr.push(reverseKeys(obj[i])); }
    return arr;
  }
  var keys = Object.keys(obj);
  var out = {};
  for (var k = keys.length - 1; k >= 0; k--) { out[keys[k]] = reverseKeys(obj[keys[k]]); }
  return out;
}

// ---------------------------------------------------------------------------
// Build a full SA stack. Note: pkg.packageHash is intentionally a value that is
// NOT the canonical hash of pkg, to prove the assembler REFERENCES it as-is.
// ---------------------------------------------------------------------------
var pkg = {
  disposition: 'REJECT_FROM_SERVICE', confidence: 0.91,
  packageHash: 'DP_HASH_FROM_CORE_abc123',
  hardLocks: [{ trigger: 'CODE_ALLOWABLE_EXCEEDED', severity: 'CRITICAL' }],
  fmd: { dominant: 'general_corrosion', margin: 0.42 },
  timeline: { timeToActionDays: 0 }, consequence: { tier: 'HIGH' },
  bindingClauses: [{ code: 'API 510', clause: '7.4', requirement: 'min thickness' }]
};
var validated = {
  validated: [
    { questionId: 'wall_thickness_measured', questionDecisionImpact: 'CRITICAL',
      answerValue: '0.118', answerSource: 'INSTRUMENT', answerProvenance: 'MEASURED' },
    { questionId: 'revenue_at_risk_per_day', questionDecisionImpact: 'MEDIUM',
      answerValue: '85000', answerSource: 'DOCUMENT', answerProvenance: 'DOCUMENTED' }
  ],
  rejected: [], unresolvedQuestions: [], stats: { submitted: 2, validated: 2, rejected: 0, criticalUnresolved: 0 }
};

var views = sa.projectStakeholders(pkg, validated);
var matrix = cd.detectConflicts(views, validated);
var scenarios = cs.buildConsequenceScenarios(pkg, matrix, validated, null);
var brief = br.buildExecutiveBrief(pkg, validated, matrix, scenarios);

function buildParts() {
  return {
    decisionPackage: pkg,
    validatedEvidenceSet: validated,
    stakeholderViews: views,
    conflictMatrix: matrix,
    consequenceScenarios: scenarios,
    executiveBrief: brief
  };
}

var saPkg = ap.assembleSaPackage(buildParts());

// ---------------------------------------------------------------------------
// 1. Shape: all 7 contract fields present.
// ---------------------------------------------------------------------------
assert(typeof saPkg.decisionPackageHash === 'string', 'has decisionPackageHash');
assert(saPkg.validatedEvidenceSet !== undefined, 'has validatedEvidenceSet');
assert(Array.isArray(saPkg.stakeholderViews) && saPkg.stakeholderViews.length === 9, 'has 9 stakeholderViews');
assert(saPkg.conflictMatrix && Array.isArray(saPkg.conflictMatrix.active_conflicts), 'has conflictMatrix');
assert(Array.isArray(saPkg.consequenceScenarios), 'has consequenceScenarios');
assert(saPkg.executiveBrief && saPkg.executiveBrief.recommendation, 'has executiveBrief');
assert(typeof saPkg.saPackageHash === 'string' && saPkg.saPackageHash.length === 64, 'has 64-hex saPackageHash');

// ---------------------------------------------------------------------------
// 2. DP hash is REFERENCED, not recomputed (Directive 4).
// ---------------------------------------------------------------------------
assert(saPkg.decisionPackageHash === 'DP_HASH_FROM_CORE_abc123', 'uses the core-assigned packageHash verbatim');
// Explicit decisionPackageHash overrides the package field.
var saPkg2 = ap.assembleSaPackage({
  decisionPackage: pkg, decisionPackageHash: 'EXPLICIT_HASH_xyz',
  validatedEvidenceSet: validated, stakeholderViews: views,
  conflictMatrix: matrix, consequenceScenarios: scenarios, executiveBrief: brief
});
assert(saPkg2.decisionPackageHash === 'EXPLICIT_HASH_xyz', 'explicit decisionPackageHash wins');

// ---------------------------------------------------------------------------
// 3. saPackageHash is independent, deterministic, key-order invariant, and
//    EXCLUDES itself (recompute equals stored).
// ---------------------------------------------------------------------------
var again = ap.assembleSaPackage(buildParts());
assert(again.saPackageHash === saPkg.saPackageHash, 'saPackageHash deterministic across calls');

var permuted = ap.assembleSaPackage(reverseKeys(buildParts()));
assert(permuted.saPackageHash === saPkg.saPackageHash, 'saPackageHash invariant under input key-order permutation');

assert(ap.computeSaPackageHash(saPkg) === saPkg.saPackageHash, 'recomputed hash equals stored (excludes itself)');
assert(ap.verifySaPackage(saPkg) === true, 'verifySaPackage true for intact package');

// Tampering with SA content changes the hash; tampering and re-verifying fails.
var tampered = ap.assembleSaPackage(buildParts());
tampered.executiveBrief.recommendation.action = 'TAMPERED';
assert(ap.verifySaPackage(tampered) === false, 'verify fails after content tamper');

// Changing only the DP-hash reference changes the SA hash (it is part of the content).
assert(saPkg2.saPackageHash !== saPkg.saPackageHash, 'different DP-hash reference -> different saPackageHash');

// ---------------------------------------------------------------------------
// 4. Optional HMAC signature is deterministic per key; key-sensitive.
// ---------------------------------------------------------------------------
var sigA1 = ap.signSaPackage(saPkg, 'key-1');
var sigA2 = ap.signSaPackage(saPkg, 'key-1');
var sigB = ap.signSaPackage(saPkg, 'key-2');
assert(sigA1 === sigA2, 'signature deterministic for same key');
assert(sigA1 !== sigB, 'signature changes with key');
assert(ap.signSaPackage(saPkg, null) === null, 'no key -> no signature');

// ---------------------------------------------------------------------------
// 5. Coherence event: new SA event type, uses caller referenceIso (no clock).
// ---------------------------------------------------------------------------
var evt = ap.buildCoherenceEvent(saPkg, '2026-05-29T00:00:00Z');
assert(evt.event === 'SA_PACKAGE_ASSEMBLED', 'new SA event type');
assert(evt.referenceIso === '2026-05-29T00:00:00Z', 'uses caller-supplied referenceIso');
assert(evt.decisionPackageHash === saPkg.decisionPackageHash, 'event references DP hash');
assert(evt.saPackageHash === saPkg.saPackageHash, 'event carries SA hash');
assert(evt.stakeholderViewCount === 9, 'event counts stakeholder views');
var evtNoTime = ap.buildCoherenceEvent(saPkg);
assert(evtNoTime.referenceIso === null, 'no clock read when referenceIso omitted');

// ---------------------------------------------------------------------------
// 6. Null-safe: minimal/empty inputs must not throw.
// ---------------------------------------------------------------------------
var bare = ap.assembleSaPackage({});
assert(bare.decisionPackageHash === '' && bare.stakeholderViews.length === 0, 'empty assemble is safe');
assert(typeof bare.saPackageHash === 'string' && bare.saPackageHash.length === 64, 'empty still hashes');

console.log('All Stage 11 SA-package assembler checks passed (independent hash, DP referenced not modified).');
