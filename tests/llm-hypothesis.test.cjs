'use strict';
// DEPLOY441 / Phase 3 gate - the LLM hypothesis engine's TESTABLE surface:
// prompt contract, schema validation, graceful degradation, injected transport,
// and the three-axis FINAL PRINCIPLE predicate. No live LLM: callModel is faked,
// so this runs fully offline and deterministically as an acceptance gate.
var cp = require('child_process'); var fs = require('fs'); var os = require('os'); var path = require('path');
var ROOT = path.join(__dirname, '..');
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-hyp-'));
cp.execSync('npx tsc src/lib/governingAxes.ts src/lib/llmHypothesis.ts --outDir "' + tmp + '" --module commonjs --target es2019 --skipLibCheck --esModuleInterop', { cwd: ROOT, stdio: 'pipe' });
var H = require(path.join(tmp, 'llmHypothesis.js'));
var AX = require(path.join(tmp, 'governingAxes.js'));

var pass = 0; var fails = [];
function ok(cond, msg) { if (cond) { pass++; } else { fails.push(msg); } }

// ---- 1. prompt contract ----
var msgs = H.buildHypothesisPrompt('Furnace F-7, coking increasing, records lost.');
ok(msgs.length === 2 && msgs[0].role === 'system' && msgs[1].role === 'user', 'prompt has system+user');
ok(/JSON ONLY/i.test(msgs[0].content), 'prompt enforces JSON-only');
ok(/never infer human behavior/i.test(msgs[0].content), 'prompt forbids behavioral inference');
ok(/CONFIRMED_DAMAGE only with DIRECT evidence/i.test(msgs[0].content), 'prompt encodes evidence gate');
ok(msgs[1].content.indexOf('Furnace F-7') >= 0, 'prompt carries the transcript');

// ---- 2. valid JSON parses + clamps + coerces ----
var good = JSON.stringify({
  asset: { value: 'fired_heater', confidence: 0.9, evidence: ['Ethylene cracker furnace F-7'] },
  domain: { value: 'refinery', confidence: 0.8, evidence: ['petrochemical complex'] },
  authority: { value: 'API 530', confidence: 0.7, derivedFrom: 'fired heater tubes' },
  physicalCondition: 'ACCEPTABLE', assuranceState: 'LOST_DESIGN_BASIS', operationalChange: 'CHANGED_UNREASSESSED',
  suspectedMechanism: { value: null, confidence: 0, evidence: [] },
  disposition: 'reassessment_required',
  evidence: ['no significant wall loss'], missingEvidence: ['firing design basis records'], uncertainty: ['coking trajectory']
});
var hg = H.parseAndValidateHypothesis(good);
ok(hg.meta.ok === true, 'good hypothesis ok=true');
ok(hg.asset.value === 'fired_heater' && hg.asset.confidence === 0.9, 'asset parsed');
ok(hg.physicalCondition === 'ACCEPTABLE' && hg.assuranceState === 'LOST_DESIGN_BASIS' && hg.operationalChange === 'CHANGED_UNREASSESSED', 'axes parsed');
ok(hg.suspectedMechanism.value === null, 'null mechanism preserved');

// ---- 3. malformed JSON degrades gracefully (never throws) ----
var bad = H.parseAndValidateHypothesis('this is not json at all');
ok(bad.meta.ok === false && bad.meta.parseError, 'malformed -> ok=false with parseError');
ok(bad.physicalCondition === 'UNKNOWN' && bad.assuranceState === 'UNKNOWN_STATE', 'malformed -> safe UNKNOWN axes');
ok(bad.disposition === 'hold_for_review', 'malformed -> conservative disposition');

// ---- 4. out-of-range confidence clamped; unknown enum coerced ----
var weird = H.parseAndValidateHypothesis(JSON.stringify({
  asset: { value: 'x', confidence: 9, evidence: 'a single string not array' },
  physicalCondition: 'TOTALLY_BOGUS', assuranceState: 'NOPE', operationalChange: 'ALSO_BOGUS',
  suspectedMechanism: { value: 'fatigue', confidence: -3 }
}));
ok(weird.asset.confidence === 1, 'confidence > 1 clamped to 1');
ok(weird.suspectedMechanism.confidence === 0, 'confidence < 0 clamped to 0');
ok(weird.asset.evidence.length === 1 && weird.asset.evidence[0] === 'a single string not array', 'string evidence coerced to array');
ok(weird.physicalCondition === 'UNKNOWN' && weird.assuranceState === 'UNKNOWN_STATE' && weird.operationalChange === 'STABLE', 'bogus enums coerced to safe defaults');

// ---- 5. code-fence stripping ----
var fenced = H.parseAndValidateHypothesis('```json\n{"disposition":"monitor"}\n```');
ok(fenced.meta.ok === true && fenced.disposition === 'monitor', 'code-fenced JSON still parses');

// ---- 6. FINAL PRINCIPLE predicate (success criterion 10) ----
ok(AX.isPhysicallyAcceptableButNotDispositionable({ physical: 'ACCEPTABLE', assurance: 'LOST_DESIGN_BASIS', operational: 'STABLE' }) === true, 'ACCEPTABLE+LOST_DESIGN_BASIS => dual conclusion true');
ok(AX.isPhysicallyAcceptableButNotDispositionable({ physical: 'ACCEPTABLE', assurance: 'ESTABLISHED', operational: 'STABLE' }) === false, 'fully clean asset => not dual');
ok(AX.isPhysicallyAcceptableButNotDispositionable({ physical: 'CONFIRMED_DAMAGE', assurance: 'LOST_DESIGN_BASIS', operational: 'STABLE' }) === false, 'confirmed damage is not the dual case');

// ---- async transport tests ----
(async function () {
  // 7. injected fake model -> validated hypothesis
  var fake = function (messages, opts) { return Promise.resolve(good); };
  var h1 = await H.generateHypothesis('any transcript', { callModel: fake });
  ok(h1.meta.ok === true && h1.asset.value === 'fired_heater', 'generateHypothesis with fake model returns validated hypothesis');

  // 8. throwing transport degrades gracefully, never throws
  var boom = function () { return Promise.reject(new Error('network down')); };
  var h2 = await H.generateHypothesis('any transcript', { callModel: boom });
  ok(h2.meta.ok === false && /transport error/.test(String(h2.meta.parseError)), 'transport failure -> graceful ok=false');
  ok(h2.physicalCondition === 'UNKNOWN', 'transport failure -> UNKNOWN axes');

  fs.rmSync(tmp, { recursive: true, force: true });
  if (fails.length) {
    console.log('FAIL llm-hypothesis: ' + fails.length + ' assertion(s) failed');
    fails.forEach(function (f) { console.log('   - ' + f); });
    process.exit(1);
  }
  console.log('All llm-hypothesis Phase-3 checks passed (' + pass + ' assertions: prompt contract, schema validation, graceful degradation, injected transport, FINAL PRINCIPLE predicate).');
})();
