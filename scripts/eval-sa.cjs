'use strict';
// ============================================================================
// eval-sa.cjs - OFFLINE BATCH SITUATIONAL-AWARENESS SCORER
// ----------------------------------------------------------------------------
// Ends the one-scenario-at-a-time manual loop. Runs the FULL deterministic
// pipeline (decision-core -> authority-lock -> FMD -> convergence ->
// organizational -> governing-reality) offline over a labeled multi-domain
// corpus, and scores each case on:
//   - structured labels: authority codes (includes/excludes), consequence tier,
//     governing-reality class, disposition
//   - ANTI-CONTAMINATION: per-case must_not_contain + a global behavioral_guard
//     (the report text may not assert a mechanism/behavior that isn't evidenced)
// Every past TEST 10-15 bug is encoded here, so it can never silently return.
// Run: node scripts/eval-sa.cjs        (exit 1 if any case fails)
// ============================================================================
var cp = require('child_process'); var fs = require('fs'); var os = require('os'); var path = require('path');
var ROOT = path.join(__dirname, '..');
process.env.NDT_API_KEY = 'eval-key';
process.env.NODE_PATH = path.join(ROOT, 'node_modules');
require('module').Module._initPaths();

var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-eval-'));
function sh(c) { cp.execSync(c, { cwd: ROOT, stdio: 'ignore' }); }
// compile the two TS engines we need
sh('npx tsc netlify/functions/decision-core.ts --outDir "' + tmp + '" --module commonjs --target es2019 --skipLibCheck --esModuleInterop');
sh('npx tsc src/lib/governingReality.ts --outDir "' + tmp + '" --module commonjs --target es2019 --skipLibCheck --esModuleInterop');
// copy every engine so cross-requires (auth-guard, supabase) resolve; .js -> .cjs
fs.readdirSync(path.join(ROOT, 'netlify/functions')).forEach(function (f) {
  if (f.slice(-4) === '.cjs' || f.slice(-3) === '.js') {
    var dst = f.slice(-3) === '.js' ? f.slice(0, -3) + '.cjs' : f;
    try { fs.copyFileSync(path.join(ROOT, 'netlify/functions', f), path.join(tmp, dst)); } catch (e) {}
  }
});
var DC = require(path.join(tmp, 'decision-core.js'));
var AL = require(path.join(tmp, 'authority-lock.cjs'));
var FMD = require(path.join(tmp, 'failure-mode-dominance.cjs'));
var CV = require(path.join(tmp, 'situational-awareness-convergence.cjs'));
var ORG = require(path.join(tmp, 'situational-awareness-organizational.cjs'));
var GR = require(path.join(tmp, 'governingReality.js'));

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

async function runCase(c) {
  var lt = c.transcript.toLowerCase();
  var mechs = deriveMechs(lt);
  var hasCracking = lt.indexOf('crack') >= 0 && lt.indexOf('no crack') < 0 && lt.indexOf('no cracking') < 0;

  var dcBody = await post(DC, { transcript: c.transcript, parsed: { numeric_values: {} }, asset: { asset_class: c.asset_class || 'unknown', confidence: 0.85 }, confirmed_flags: {}, reality_lock: null, evidence_provenance: null, authority_lock: null, sa_responses: [] });
  var dc = dcBody.decision_core || dcBody;
  var con = dc.consequence_reality || {}; var dec = dc.decision_reality || {};
  var tier = con.consequence_tier || 'UNKNOWN'; var disp = dec.disposition || 'unknown';
  var hardLocks = (dec.hard_locks && dec.hard_locks.length) ? dec.hard_locks.length : 0;

  var alBody = await post(AL, { asset_type: c.asset_class || '', component_description: c.transcript, service_environment: lt.indexOf('sour') >= 0 || lt.indexOf('h2s') >= 0 ? 'sour' : '', damage_mechanisms: mechs, has_cracking: hasCracking, is_pressure_boundary: true, jurisdiction: '' });
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

  // Assembled report text scanned for contamination (everything the report would surface)
  var reportText = [gr.statement, (gr.contributing || []).join(' '), fmdBody.governing_failure_mode,
    (fmdBody.suspected_governing_mechanism || []).join(' '), conv.summary,
    (conv.primary_hypothesis ? conv.primary_hypothesis.narrative : ''), authCodes.join(' '),
    (con.consequence_basis || con.basis || []).join ? (con.consequence_basis || con.basis || []).join(' ') : ''].join(' || ').toLowerCase();

  return { tier: tier, disp: disp, authCodes: authCodes, grClass: gr.class, suspected: fmdBody.suspected_governing_mechanism || [], reportText: reportText };
}

var data = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/sa-eval-cases.json'), 'utf8'));
var behavioral = data.behavioral_guard || [];

(async function () {
  var passed = 0, failed = 0; var details = [];
  for (var i = 0; i < data.cases.length; i++) {
    var c = data.cases[i]; var fails = [];
    try {
      var r = await runCase(c); var e = c.expect || {};
      if (e.authority_includes) e.authority_includes.forEach(function (code) { if (r.authCodes.indexOf(code) < 0) fails.push('authority missing ' + code + ' (got ' + JSON.stringify(r.authCodes) + ')'); });
      if (e.authority_excludes) e.authority_excludes.forEach(function (code) { if (r.authCodes.indexOf(code) >= 0) fails.push('authority WRONGLY includes ' + code); });
      if (e.consequence_tier_in && e.consequence_tier_in.indexOf(r.tier) < 0) fails.push('consequence tier ' + r.tier + ' not in ' + JSON.stringify(e.consequence_tier_in));
      if (e.consequence_tier_not && e.consequence_tier_not.indexOf(r.tier) >= 0) fails.push('consequence tier ' + r.tier + ' must NOT be ' + JSON.stringify(e.consequence_tier_not));
      if (e.governing_class && r.grClass !== e.governing_class) fails.push('governing class ' + r.grClass + ' != ' + e.governing_class);
      if (e.disposition && r.disp !== e.disposition) fails.push('disposition ' + r.disp + ' != ' + e.disposition);
      (c.must_contain || []).forEach(function (s) { if (!wbContains(r.reportText, s)) fails.push('MISSING: report should contain "' + s + '"'); });
      if (e.suspected_leads && (String((r.suspected[0] || '')).toLowerCase() !== e.suspected_leads.toLowerCase())) fails.push('suspected-governing should LEAD with ' + e.suspected_leads + ' (got ' + JSON.stringify(r.suspected) + ')');
      (c.must_not_contain || []).forEach(function (s) { if (wbContains(r.reportText, s)) fails.push('CONTAMINATION: report contains forbidden "' + s + '"'); });
      behavioral.forEach(function (s) { if (r.reportText.indexOf(s.toLowerCase()) >= 0) fails.push('BEHAVIORAL: report contains "' + s.trim() + '"'); });
    } catch (err) { fails.push('THREW: ' + (err && err.message ? err.message : String(err))); }
    if (fails.length) { failed++; details.push('FAIL  ' + c.id); fails.forEach(function (f) { details.push('        - ' + f); }); }
    else { passed++; details.push('PASS  ' + c.id); }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(details.join('\n'));
  console.log('\nSA EVAL: ' + passed + ' / ' + (passed + failed) + ' cases passed');
  if (failed > 0) process.exit(1);
})();
