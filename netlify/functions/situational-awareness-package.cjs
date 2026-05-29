// ============================================================================
// situational-awareness-package.cjs   (SA layer L9 assembler)
// FORGED 4D NDT - Situational Awareness  -  DEPLOY372 / Stage 11
//
// Assembles the SituationalAwarenessPackage from the L9.0-L9.4 outputs and
// computes the SA artifact's OWN independent hash (and optional signature).
//
// CRITICAL (brief Directive 4): the frozen DecisionPackage is referenced by its
// EXISTING hash. This module NEVER recomputes, reshapes, or modifies the
// DecisionPackage or its canonicalization. The SA package is a separate artifact
// that points at the DecisionPackage by hash; the DecisionPackage stays
// byte-for-byte identical and replay-audit keeps verifying it.
//
// PURE DETERMINISTIC MODULE.
//   - No callers at this stage (additive, fully revertable).
//   - No LLM. No network. No filesystem. No Date.now() / Math.random().
//   - Uses Node's crypto builtin for hashing/HMAC (a builtin, NOT a core engine).
//   - Does NOT import decision-core or any L0-L8 engine.
//   - var only. String concatenation only. No template literals. No arrow fns.
//   - module.exports.
//
// Determinism: hashing is over a DEEP canonical JSON (recursively key-sorted),
// so the saPackageHash is invariant to input key order. No clock is read; any
// timestamp in the coherence event is supplied by the caller (referenceIso).
// ============================================================================
'use strict';

var crypto = require('crypto');

// ----------------------------------------------------------------------------
// Deep canonical JSON + stable sha256 (same scheme as the PIL projector).
// ----------------------------------------------------------------------------
function stableStringify(value) {
  if (value === null || typeof value !== 'object') { return JSON.stringify(value); }
  if (Array.isArray(value)) {
    var parts = [];
    for (var i = 0; i < value.length; i++) { parts.push(stableStringify(value[i])); }
    return '[' + parts.join(',') + ']';
  }
  var keys = Object.keys(value).sort();
  var kv = [];
  for (var k = 0; k < keys.length; k++) {
    kv.push(JSON.stringify(keys[k]) + ':' + stableStringify(value[keys[k]]));
  }
  return '{' + kv.join(',') + '}';
}

function canonicalJson(obj) { return stableStringify(obj); }

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

// ----------------------------------------------------------------------------
// Resolve the DecisionPackage hash WITHOUT modifying the package.
//   - Prefer an explicit decisionPackageHash.
//   - Else use the package's own packageHash field (the canonical hash the core
//     already assigned). This is the normal path.
//   - Else, only as a last resort, derive a reference hash via the same scheme
//     the PIL uses for an unhashed package. This does not write back to the DP.
// ----------------------------------------------------------------------------
function resolveDecisionPackageHash(parts) {
  if (parts && typeof parts.decisionPackageHash === 'string' && parts.decisionPackageHash !== '') {
    return parts.decisionPackageHash;
  }
  var pkg = parts ? parts.decisionPackage : null;
  if (pkg && typeof pkg.packageHash === 'string' && pkg.packageHash !== '') {
    return pkg.packageHash;
  }
  if (pkg) { return sha256(canonicalJson(pkg)); }
  return '';
}

function asArray(v) { return (v && v.length) ? v : []; }

// ----------------------------------------------------------------------------
// Assemble the SituationalAwarenessPackage.
//   parts = {
//     decisionPackage?, decisionPackageHash?,   // one or the other (hash wins)
//     validatedEvidenceSet, stakeholderViews,    // L9.0 / L9.1
//     conflictMatrix, consequenceScenarios,      // L9.2 / L9.3
//     executiveBrief                             // L9.4
//   }
// Returns the package including its own saPackageHash (computed over all SA
// content + the decisionPackageHash reference, EXCLUDING saPackageHash itself).
// ----------------------------------------------------------------------------
function assembleSaPackage(parts) {
  var p = parts || {};
  var core = {
    decisionPackageHash: resolveDecisionPackageHash(p),
    validatedEvidenceSet: p.validatedEvidenceSet || null,
    stakeholderViews: asArray(p.stakeholderViews),
    conflictMatrix: p.conflictMatrix || null,
    consequenceScenarios: asArray(p.consequenceScenarios),
    executiveBrief: p.executiveBrief || null
  };

  // saPackageHash is computed over the SA content only — never includes itself.
  var saPackageHash = sha256(canonicalJson(core));

  return {
    decisionPackageHash: core.decisionPackageHash,
    validatedEvidenceSet: core.validatedEvidenceSet,
    stakeholderViews: core.stakeholderViews,
    conflictMatrix: core.conflictMatrix,
    consequenceScenarios: core.consequenceScenarios,
    executiveBrief: core.executiveBrief,
    saPackageHash: saPackageHash
  };
}

// Recompute the hash of an existing SA package (e.g., for verification). Strips
// the stored saPackageHash before hashing, so it must equal the stored value.
function computeSaPackageHash(saPackage) {
  if (!saPackage || typeof saPackage !== 'object') { return ''; }
  var core = {
    decisionPackageHash: saPackage.decisionPackageHash || '',
    validatedEvidenceSet: saPackage.validatedEvidenceSet || null,
    stakeholderViews: asArray(saPackage.stakeholderViews),
    conflictMatrix: saPackage.conflictMatrix || null,
    consequenceScenarios: asArray(saPackage.consequenceScenarios),
    executiveBrief: saPackage.executiveBrief || null
  };
  return sha256(canonicalJson(core));
}

function verifySaPackage(saPackage) {
  if (!saPackage || typeof saPackage.saPackageHash !== 'string') { return false; }
  return computeSaPackageHash(saPackage) === saPackage.saPackageHash;
}

// Optional deterministic signature over the saPackageHash (HMAC-SHA256). The
// caller supplies the key; identical key + hash always yields the same digest.
function signSaPackage(saPackage, signingKey) {
  if (!saPackage || typeof saPackage.saPackageHash !== 'string' || !signingKey) { return null; }
  return crypto.createHmac('sha256', String(signingKey)).update(saPackage.saPackageHash).digest('hex');
}

// Build a NEW coherence-log event type for the SA layer. Does not write; the
// caller persists it. No clock is read — referenceIso is supplied by the caller.
function buildCoherenceEvent(saPackage, referenceIso) {
  var sp = saPackage || {};
  var conflictCount = 0;
  if (sp.conflictMatrix && sp.conflictMatrix.active_conflicts && sp.conflictMatrix.active_conflicts.length) {
    conflictCount = sp.conflictMatrix.active_conflicts.length;
  }
  var criticalUnresolved = 0;
  if (sp.validatedEvidenceSet && sp.validatedEvidenceSet.stats &&
      typeof sp.validatedEvidenceSet.stats.criticalUnresolved === 'number') {
    criticalUnresolved = sp.validatedEvidenceSet.stats.criticalUnresolved;
  }
  return {
    event: 'SA_PACKAGE_ASSEMBLED',
    referenceIso: (typeof referenceIso === 'string') ? referenceIso : null,
    decisionPackageHash: sp.decisionPackageHash || '',
    saPackageHash: sp.saPackageHash || '',
    stakeholderViewCount: asArray(sp.stakeholderViews).length,
    activeConflictCount: conflictCount,
    criticalUnresolved: criticalUnresolved
  };
}

module.exports = {
  assembleSaPackage: assembleSaPackage,
  computeSaPackageHash: computeSaPackageHash,
  verifySaPackage: verifySaPackage,
  signSaPackage: signSaPackage,
  buildCoherenceEvent: buildCoherenceEvent,
  // exported for unit tests:
  canonicalJson: canonicalJson,
  sha256: sha256
};
