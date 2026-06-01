'use strict';
// ============================================================================
// eval-sa.cjs - OFFLINE BATCH SITUATIONAL-AWARENESS SCORER
// ----------------------------------------------------------------------------
// DEPLOY440 / Stabilization Phase 1: every case now begins from RAW TRANSCRIPT
// and runs the REAL front end:
//     transcript -> resolve-asset -> reality-lock (with live override logic)
//                -> decision-core -> authority-lock -> FMD -> convergence
//                -> organizational -> governing-reality
// Previously the harness fed a hand-set asset_class straight in and SKIPPED
// resolve-asset + reality-lock - exactly where the furnace->offshore failure
// lived. That blind spot is now closed: the derived classification is computed,
// surfaced on every line, and assertable (asset_class_in / asset_class_not).
//
// Scores each case on:
//   - derived classification (asset_class_in / asset_class_not)
//   - structured labels: authority codes (includes/excludes), consequence tier,
//     governing-reality class, disposition
//   - ANTI-CONTAMINATION: per-case must_not_contain + a global behavioral_guard
//
// Runs TWO corpora: tests/fixtures/sa-eval-cases.json (regression) and
// tests/fixtures/system-breakers.json (the architecture stress cases).
// Run: node scripts/eval-sa.cjs        (exit 1 if any case fails)
// ============================================================================
var cp = require('child_process'); var fs = require('fs'); var os = require('os'); var path = require('path');
var ROOT = path.join(__dirname, '..');
process.env.NDT_API_KEY = 'eval-key';
process.env.NODE_PATH = path.join(ROOT, 'node_modules');
require('module').Module._initPaths();

var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-eval-'));
function sh(c) { cp.execSync(c, { cwd: ROOT, stdio: 'ignore' }); }
// compile the TS engines we need (now including the front-end classifiers)
sh('npx tsc netlify/functions/decision-core.ts netlify/functions/resolve-asset.ts netlify/functions/reality-lock.ts --outDir "' + tmp + '" --module commonjs --target es2019 --skipLibCheck --esModuleInterop');
sh('npx tsc src/lib/governingReality.ts src/lib/governingAxes.ts src/lib/evidenceGate.ts src/lib/authorityDerivation.ts src/lib/noDestructiveOverride.ts src/lib/reconciliationLayer.ts --outDir "' + tmp + '" --module commonjs --target es2019 --skipLibCheck --esModuleInterop');
// copy every engine so cross-requires (auth-guard, supabase, domain-classifier) resolve; .js -> .cjs
fs.readdirSync(path.join(ROOT, 'netlify/functions')).forEach(function (f) {
  if (f.slice(-4) === '.cjs' || f.slice(-3) === '.js') {
    var dst = f.slice(-3) === '.js' ? f.slice(0, -3) + '.cjs' : f;
    try { fs.copyFileSync(path.join(ROOT, 'netlify/functions', f), path.join(tmp, dst)); } catch (e) {}
  }
});
var DC = require(path.join(tmp, 'decision-core.js'));
var RA = require(path.join(tmp, 'resolve-asset.js'));
var RL = require(path.join(tmp, 'reality-lock.js'));
var AL = require(path.join(tmp, 'authority-lock.cjs'));
var FMD = require(path.join(tmp, 'failure-mode-dominance.cjs'));
var CV = require(path.join(tmp, 'situational-awareness-convergence.cjs'));
var ORG = require(path.join(tmp, 'situational-awareness-organizational.cjs'));
var GR = require(path.join(tmp, 'governingReality.js'));
var RECON = require(path.join(tmp, 'reconciliationLayer.js'));
var AX = require(path.join(tmp, 'governingAxes.js'));

var MECH_KW = [['crack', 'cracking'], ['corrosion', 'corrosion'], ['pitting', 'pitting'], ['wall loss', 'wall_loss'],
  ['hic', 'hic'], ['sohic', 'sohic'], ['ssc', 'ssc'], ['mic', 'mic'], ['fatigue', 'fatigue'], ['erosion', 'erosion'],
  ['scc', 'scc'], ['cui', 'cui'], ['metal loss', 'wall_loss'], ['thinning', 'wall_loss']];
function deriveMechs(lt) { var m = []; for (var i = 0; i < MECH_KW.length; i++) { if (lt.indexOf(MECH_KW[i][0]) >= 0 && m.indexOf(MECH_KW[i][1]) < 0) m.push(MECH_KW[i][1]); } return m; }

function wbContains(text, phrase) {
  var esc = String(phrase).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('\\b' + esc + '\\b', 'i').test(text);
}
function post(handlerMod, body) {
  return Promise.resolve(handlerMod.handler({ httpMethod: 'POST', headers: { 'X-API-Key': 'eval-key' }, body: JSON.stringify(body) }))
    .then(function (r) { return JSON.parse(r.body); });
}

// PHASE 1: derive the asset classification from raw transcript the SAME WAY the
// live frontend does (VoiceInspectionPage handleGenerate):
//   resolve-asset -> reality-lock -> apply override iff asset_conflict && asset_override.
async function deriveClassification(transcript) {
  var raBody = await post(RA, { raw_text: transcript });
  var resolved = (raBody && raBody.resolved) ? raBody.resolved : (raBody || {});
  var assetClass = resolved.asset_class || 'unknown';
  var confidence = (typeof resolved.confidence === 'number') ? resolved.confidence : 0;
  var source = 'resolve-asset';
  var rl = null;
  try {
    var rlBody = await post(RL, { transcript: transcript, parsed_asset_class: assetClass, parsed_asset_confidence: confidence });
    rl = rlBody.reality_lock || rlBody;
    if (rl && rl.asset_conflict && rl.asset_override) {
      assetClass = rl.asset_override; source = 'reality-lock-override';
    }
  } catch (e) { /* reality-lock unavailable -> keep resolve-asset result */ }
  return {
    asset_class: assetClass, confidence: confidence, source: source,
    resolved_class: resolved.asset_class || 'unknown',
    detected_domain: rl ? rl.detected_domain : null,
    asset_override: rl ? rl.asset_override : null,
    domain_supported: rl ? rl.domain_supported : null
  };
}

async function runCase(c) {
  var lt = c.transcript.toLowerCase();
  var mechs = deriveMechs(lt);
  var hasCracking = lt.indexOf('crack') >= 0 && lt.indexOf('no crack') < 0 && lt.indexOf('no cracking') < 0;

  // ---- PHASE 1: classification now comes from the real front end, not c.asset_class ----
  var cls = await deriveClassification(c.transcript);
  var effectiveAsset = cls.asset_class;

  var dcBody = await post(DC, { transcript: c.transcript, parsed: { numeric_values: {} }, asset: { asset_class: effectiveAsset, confidence: cls.confidence || 0.85 }, confirmed_flags: {}, reality_lock: null, evidence_provenance: null, authority_lock: null, sa_responses: [] });
  var dc = dcBody.decision_core || dcBody;
  var con = dc.consequence_reality || {}; var dec = dc.decision_reality || {};
  var tier = con.consequence_tier || 'UNKNOWN'; var disp = dec.disposition || 'unknown';
  var hardLocks = (dec.hard_locks && dec.hard_locks.length) ? dec.hard_locks.length : 0;

  var alBody = await post(AL, { asset_type: effectiveAsset || '', component_description: c.transcript, service_environment: lt.indexOf('sour') >= 0 || lt.indexOf('h2s') >= 0 ? 'sour' : '', damage_mechanisms: mechs, has_cracking: hasCracking, is_pressure_boundary: true, jurisdiction: '' });
  var authCodes = (alBody.authority_chain || []).map(function (a) { return a.code; });

  var fmdBody = await post(FMD, { damage_mechanisms: mechs, has_cracking: hasCracking, transcript: c.transcript, wall_loss_percent: 0 });
  var conv = CV.detectConvergence({ transcript: c.transcript });
  var org = ORG.detectOrganizationalFailures({ transcript: c.transcript });
  var streamIds = (conv.primary_hypothesis && conv.primary_hypothesis.supporting_streams) ? conv.primary_hypothesis.supporting_streams.map(function (x) { return x.id; }) : [];

  var gr = GR.resolveGoverningReality({
    consequenceTier: tier, disposition: disp, hardLockCount: hardLocks,
    governingFailureMode: fmdBody.governing_failure_mode, governingSeverity: fmdBody.governing_severity,
    suspectedGoverning: fmdBody.suspected_governing_mechanism, dispositionDriver: fmdBody.disposition_driver,
    convergencePrimaryId: conv.primary_hypothesis && conv.primary_hypothesis.id, convergenceStreamIds: streamIds,
    orgFailureScore: org.organizational_failure_score, orgIndicatorCount: (org.indicators || []).length,
    futureVerdict: null, transcript: c.transcript
  });

  // Report text scanned for contamination (everything the report would surface),
  // now INCLUDING the derived asset class + detected domain so a furnace->offshore
  // classification can be caught as contamination too.
  var reportText = [cls.asset_class, cls.detected_domain || '', gr.statement, (gr.contributing || []).join(' '), fmdBody.governing_failure_mode,
    (fmdBody.suspected_governing_mechanism || []).join(' '), conv.summary,
    (conv.primary_hypothesis ? conv.primary_hypothesis.narrative : ''), authCodes.join(' '),
    (con.consequence_basis || con.basis || []).join ? (con.consequence_basis || con.basis || []).join(' ') : ''].join(' || ').toLowerCase();

  var axes = RECON.deriveAxesDeterministic(c.transcript);
  return { classification: cls, tier: tier, disp: disp, authCodes: authCodes, grClass: gr.class, grStatement: gr.statement || '', suspected: fmdBody.suspected_governing_mechanism || [], reportText: reportText, axes: axes };
}

function loadCorpus(file) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')); } catch (e) { return null; }
}

var corpora = [
  { name: 'REGRESSION', data: loadCorpus('tests/fixtures/sa-eval-cases.json') },
  { name: 'SYSTEM-BREAKERS', data: loadCorpus('tests/fixtures/system-breakers.json') }
];

(async function () {
  var passed = 0, failed = 0, xfail = 0; var details = [];
  for (var g = 0; g < corpora.length; g++) {
    var corp = corpora[g];
    if (!corp.data || !corp.data.cases) { continue; }
    var behavioral = corp.data.behavioral_guard || [];
    details.push('\n=== ' + corp.name + ' (' + corp.data.cases.length + ' cases) ===');
    for (var i = 0; i < corp.data.cases.length; i++) {
      var c = corp.data.cases[i]; var fails = [];
      var clsLabel = '';
      try {
        var r = await runCase(c); var e = c.expect || {};
        clsLabel = ' [' + r.classification.asset_class + (r.classification.source === 'reality-lock-override' ? '*OVR' : '') + ' / dom:' + (r.classification.detected_domain || '-') + ']';
        if (e.asset_class_in && e.asset_class_in.indexOf(r.classification.asset_class) < 0) fails.push('asset_class ' + r.classification.asset_class + ' not in ' + JSON.stringify(e.asset_class_in));
        if (e.asset_class_not) e.asset_class_not.forEach(function (a) { if (r.classification.asset_class === a) fails.push('asset_class WRONGLY ' + a); });
        if (e.authority_includes) e.authority_includes.forEach(function (code) { if (r.authCodes.indexOf(code) < 0) fails.push('authority missing ' + code + ' (got ' + JSON.stringify(r.authCodes) + ')'); });
        if (e.authority_excludes) e.authority_excludes.forEach(function (code) { if (r.authCodes.indexOf(code) >= 0) fails.push('authority WRONGLY includes ' + code); });
        if (e.consequence_tier_in && e.consequence_tier_in.indexOf(r.tier) < 0) fails.push('consequence tier ' + r.tier + ' not in ' + JSON.stringify(e.consequence_tier_in));
        if (e.consequence_tier_not && e.consequence_tier_not.indexOf(r.tier) >= 0) fails.push('consequence tier ' + r.tier + ' must NOT be ' + JSON.stringify(e.consequence_tier_not));
        if (e.governing_class && r.grClass !== e.governing_class) fails.push('governing class ' + r.grClass + ' != ' + e.governing_class);
        if (e.governing_statement_contains) e.governing_statement_contains.forEach(function (ph) { if (!wbContains(r.grStatement, ph)) fails.push('governing statement should contain "' + ph + '" (got: ' + r.grStatement.slice(0, 80) + '...)'); });
        if (e.disposition && r.disp !== e.disposition) fails.push('disposition ' + r.disp + ' != ' + e.disposition);
        (c.must_contain || []).forEach(function (s) { if (!wbContains(r.reportText, s)) fails.push('MISSING: report should contain "' + s + '"'); });
        if (e.suspected_leads && (String((r.suspected[0] || '')).toLowerCase() !== e.suspected_leads.toLowerCase())) fails.push('suspected-governing should LEAD with ' + e.suspected_leads + ' (got ' + JSON.stringify(r.suspected) + ')');
        // PHASE 9: three-axis governing tuple assertions (only axes the fixture specifies)
        if (c.axis_target_future) {
          var ax = r.axes || {}; var tf = c.axis_target_future;
          if (tf.physical && ax.physical !== tf.physical) fails.push('axis physical ' + ax.physical + ' != ' + tf.physical);
          if (tf.assurance && ax.assurance !== tf.assurance) fails.push('axis assurance ' + ax.assurance + ' != ' + tf.assurance);
          if (tf.operational && ax.operational !== tf.operational) fails.push('axis operational ' + ax.operational + ' != ' + tf.operational);
          if (tf.final_principle_dual_output && !AX.isPhysicallyAcceptableButNotDispositionable(ax)) fails.push('FINAL PRINCIPLE: expected physically-acceptable-but-not-dispositionable (got ' + ax.physical + '/' + ax.assurance + '/' + ax.operational + ')');
        }
        (c.must_not_contain || []).forEach(function (s) { if (wbContains(r.reportText, s)) fails.push('CONTAMINATION: report contains forbidden "' + s + '"'); });
        behavioral.forEach(function (s) { if (r.reportText.indexOf(s.toLowerCase()) >= 0) fails.push('BEHAVIORAL: report contains "' + s.trim() + '"'); });
      } catch (err) { fails.push('THREW: ' + (err && err.message ? err.message : String(err))); }
      if (fails.length && c.baseline_known_fail) {
        xfail++; details.push('XFAIL ' + c.id + clsLabel + '  (tracked baseline debt)');
        fails.forEach(function (f) { details.push('        - ' + f); });
        if (c.baseline_note) { details.push('        > ' + c.baseline_note); }
      } else if (fails.length) { failed++; details.push('FAIL  ' + c.id + clsLabel); fails.forEach(function (f) { details.push('        - ' + f); }); }
      else { passed++; details.push('PASS  ' + c.id + clsLabel); }
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(details.join('\n'));
  // ---- Section 13 ARCHITECTURE-HEALTH metrics (anti-whack-a-mole ledger) ----
  // Both counts must be FLAT or DECREASING under this architecture. XFAIL must be
  // monotonically decreasing, target ZERO by Phase 9. A diff that raises a count is a
  // special-case smell; a diff that changes the hypothesis<->verifier contract is structural.
  var grClasses = 0, assetKw = 0;
  try { grClasses = (fs.readFileSync(path.join(ROOT, 'src/lib/governingReality.ts'), 'utf8').match(/class:\s*"[A-Z_]+"/g) || []).length; } catch (e) {}
  try { assetKw = (fs.readFileSync(path.join(ROOT, 'netlify/functions/domain-classifier.cjs'), 'utf8').match(/"[^"]+"/g) || []).length; } catch (e) {}
  console.log('\nSA EVAL: ' + passed + ' / ' + (passed + failed) + ' hard cases passed' + (xfail ? ('  (+ ' + xfail + ' tracked baseline XFAIL)') : ''));
  console.log('ARCH-HEALTH (S13): governing_reality_classes=' + grClasses + '  domain_classifier_keywords=' + assetKw + '  XFAIL=' + xfail + ' (target 0 by Phase 9, monotonically decreasing)');
  if (failed > 0) process.exit(1);
})();
