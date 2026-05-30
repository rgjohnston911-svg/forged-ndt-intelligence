// ============================================================================
// situational-awareness-orchestrate.cjs   (SA layer caller / endpoint)
// FORGED 4D NDT - Situational Awareness  -  DEPLOY374 / Stage 9 Part 2b (backend)
//
// The single SA caller. Runs the deterministic SA chain over a FROZEN
// DecisionPackage and the L9.0 ValidatedEvidenceSet, and returns the assembled
// SituationalAwarenessPackage:
//
//   L9.1 stakeholder -> L9.2 conflict -> L9.3 consequence -> L9.4 brief
//        -> Stage 11 assembler (saPackageHash, references DP by hash)
//
// PURE / DETERMINISTIC except for the HTTP boundary.
//   - No LLM. No filesystem. No Date.now()/Math.random() inside the chain.
//   - Imports ONLY the five SA modules (no decision-core / no L0-L8 engine).
//   - var only. String concatenation only. No template literals. No arrow fns.
//   - module.exports + exports.handler.
//
// Patent / determinism guarantees honored:
//   * Read-only over the DecisionPackage; nothing written back (Directive 3).
//   * The DecisionPackage is referenced by its EXISTING packageHash; never
//     recomputed or modified (Directive 4). fmd.dominant is normalized to a
//     name string ONLY in a shallow copy fed to the projection engines, so the
//     original package (and its hash) is untouched.
//   * No clock is read; any timestamp (referenceIso) is supplied by the caller.
// ============================================================================
'use strict';

var stakeholder = require('./situational-awareness-stakeholder.cjs');
var conflict = require('./situational-awareness-conflict.cjs');
var consequence = require('./situational-awareness-consequence.cjs');
var brief = require('./situational-awareness-brief.cjs');
var assembler = require('./situational-awareness-package.cjs');
var survivalBridge = require('./situational-awareness-survival-bridge.cjs');

var CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// ----------------------------------------------------------------------------
// Build a shallow projection-view of the DecisionPackage in which fmd.dominant
// is a name string (the runtime core emits it as an object). The ORIGINAL
// package object is never mutated; only this copy is fed to the engines. The
// hash reference still uses the original package.
// ----------------------------------------------------------------------------
function projectionPackage(pkg) {
  if (!pkg || typeof pkg !== 'object') { return pkg; }
  var fmd = pkg.fmd;
  if (!fmd || typeof fmd !== 'object') { return pkg; }
  var dom = fmd.dominant;
  // Only normalize when dominant is an object carrying a name/id.
  if (dom && typeof dom === 'object') {
    var name = 'undetermined';
    if (typeof dom.name === 'string' && dom.name !== '') { name = dom.name; }
    else if (typeof dom.id === 'string' && dom.id !== '') { name = dom.id; }
    var fmdCopy = {};
    for (var k in fmd) { if (fmd.hasOwnProperty(k)) { fmdCopy[k] = fmd[k]; } }
    fmdCopy.dominant = name;
    var pkgCopy = {};
    for (var j in pkg) { if (pkg.hasOwnProperty(j)) { pkgCopy[j] = pkg[j]; } }
    pkgCopy.fmd = fmdCopy;
    return pkgCopy;
  }
  return pkg;
}

// ----------------------------------------------------------------------------
// Pure orchestration (no HTTP). Returns { situationalAwarenessPackage,
// coherenceEvent, signature }.
//   parts = {
//     decisionPackage,            // FROZEN DecisionPackage (flat contract shape)
//     decisionPackageHash?,       // optional explicit hash (else pkg.packageHash)
//     validatedEvidenceSet?,      // L9.0 output
//     probabilityBasis?,          // L4/precedent basis for L9.3 (else confidence 0)
//     referenceIso?,              // caller-supplied timestamp for the coherence event
//     signingKey?                 // optional HMAC key
//   }
// ----------------------------------------------------------------------------
function orchestrateSa(parts) {
  var p = parts || {};
  var pkg = p.decisionPackage || {};
  var ves = p.validatedEvidenceSet || null;

  var viewPkg = projectionPackage(pkg);

  var views = stakeholder.projectStakeholders(viewPkg, ves);
  var matrix = conflict.detectConflicts(views, ves);
  // DEPLOY382 - Tier 2: when no explicit probabilityBasis is supplied but an L4
  // failure-timeline is, derive a basis from the platform's own remaining-life
  // estimate + confidence band (survival bridge). Never fabricated; empty basis
  // (confidence:0) when the timeline is not quantified.
  var probabilityBasis = p.probabilityBasis || null;
  if (!probabilityBasis && p.failureTimeline) {
    probabilityBasis = survivalBridge.buildProbabilityBasis(p.failureTimeline, pkg);
  }
  var scenarios = consequence.buildConsequenceScenarios(viewPkg, matrix, ves, probabilityBasis);
  var execBrief = brief.buildExecutiveBrief(viewPkg, ves, matrix, scenarios);

  var saPackage = assembler.assembleSaPackage({
    decisionPackage: pkg,                       // ORIGINAL -> hash referenced as-is
    decisionPackageHash: p.decisionPackageHash, // explicit wins if supplied
    validatedEvidenceSet: ves,
    stakeholderViews: views,
    conflictMatrix: matrix,
    consequenceScenarios: scenarios,
    executiveBrief: execBrief
  });

  var signature = null;
  if (p.signingKey) { signature = assembler.signSaPackage(saPackage, p.signingKey); }

  return {
    situationalAwarenessPackage: saPackage,
    coherenceEvent: assembler.buildCoherenceEvent(saPackage, p.referenceIso || null),
    signature: signature
  };
}

// ----------------------------------------------------------------------------
// HTTP handler.
// Body: { decisionPackage, validatedEvidenceSet?, probabilityBasis?,
//         referenceIso?, decisionPackageHash?, signingKey? }
// ----------------------------------------------------------------------------
exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  try {
    var body = JSON.parse(event.body || '{}');
    if (!body.decisionPackage) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'decisionPackage is required' }) };
    }
    var result = orchestrateSa({
      decisionPackage: body.decisionPackage,
      decisionPackageHash: body.decisionPackageHash,
      validatedEvidenceSet: body.validatedEvidenceSet || null,
      probabilityBasis: body.probabilityBasis || null,
      failureTimeline: body.failureTimeline || null,
      referenceIso: body.referenceIso || null,
      signingKey: body.signingKey || null
    });
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(result) };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'SA orchestration failed: ' + (err && err.message ? err.message : 'unknown error') })
    };
  }
};

module.exports.orchestrateSa = orchestrateSa;
module.exports.projectionPackage = projectionPackage;
