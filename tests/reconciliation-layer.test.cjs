'use strict';
// DEPLOY446 / Phases 8+9 gate - the reconciliation layer: deterministic three-axis
// floor + Tier-1 hard vetoes (evidence / consistency / scope / confidence floor) with
// cited reasons + conflict surfacing + the FINAL PRINCIPLE dual conclusion.
var cp = require('child_process'); var fs = require('fs'); var os = require('os'); var path = require('path');
var ROOT = path.join(__dirname, '..');
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p9-rec-'));
cp.execSync('npx tsc src/lib/governingAxes.ts src/lib/evidenceGate.ts src/lib/authorityDerivation.ts src/lib/noDestructiveOverride.ts src/lib/reconciliationLayer.ts --outDir "' + tmp + '" --module commonjs --target es2019 --skipLibCheck --esModuleInterop', { cwd: ROOT, stdio: 'pipe' });
var R = require(path.join(tmp, 'reconciliationLayer.js'));
var AX = require(path.join(tmp, 'governingAxes.js'));
var pass = 0; var fails = [];
function ok(c, m) { if (c) { pass++; } else { fails.push(m); } }

var breakers = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/system-breakers.json'), 'utf8')).cases;
function byId(id) { for (var i = 0; i < breakers.length; i++) { if (breakers[i].id === id) return breakers[i]; } return null; }

// ---- deterministic axis floor hits every breaker target ----
breakers.forEach(function (c) {
  var ax = R.deriveAxesDeterministic(c.transcript); var tf = c.axis_target_future || {};
  if (tf.physical) ok(ax.physical === tf.physical, c.id + ' physical ' + ax.physical + ' == ' + tf.physical);
  if (tf.assurance) ok(ax.assurance === tf.assurance, c.id + ' assurance ' + ax.assurance + ' == ' + tf.assurance);
  if (tf.operational) ok(ax.operational === tf.operational, c.id + ' operational ' + ax.operational + ' == ' + tf.operational);
  if (tf.final_principle_dual_output) ok(AX.isPhysicallyAcceptableButNotDispositionable(ax) === true, c.id + ' FINAL PRINCIPLE dual conclusion holds');
});

// ---- FINAL PRINCIPLE end-to-end: furnace reconcile yields the dual conclusion + restricted disposition ----
var recA = R.reconcile({ transcript: byId('BREAKER_A_furnace_process_drift').transcript, assetClaims: [{ value: 'pressure_vessel', confidence: 0.9, kind: 'explicit-asset' }] });
ok(recA.physicallyAcceptableNotDispositionable === true, 'furnace: physically-acceptable-but-not-dispositionable');
ok(recA.finalDisposition === 'restricted_reassessment_required', 'furnace disposition = restricted_reassessment_required (got ' + recA.finalDisposition + ')');
ok(recA.governingReality.physical === 'ACCEPTABLE' && recA.governingReality.assurance === 'LOST_DESIGN_BASIS', 'furnace tuple ACCEPTABLE/LOST_DESIGN_BASIS');

// ---- Tier-1 EVIDENCE veto: a hypothesis claiming CONFIRMED_DAMAGE with no direct evidence is downgraded ----
var hypOverclaim = { meta: { ok: true }, asset: { value: 'storage_tank', confidence: 0.9 }, physicalCondition: 'CONFIRMED_DAMAGE', assuranceState: 'UNKNOWN_STATE', operationalChange: 'STABLE' };
var recB = R.reconcile({ transcript: byId('BREAKER_B_lng_assurance_failure').transcript, hypothesis: hypOverclaim, assetClaims: [{ value: 'storage_tank', confidence: 0.9, kind: 'explicit-asset' }] });
ok(recB.governingReality.physical !== 'CONFIRMED_DAMAGE', 'evidence veto: overclaimed CONFIRMED_DAMAGE downgraded (got ' + recB.governingReality.physical + ')');
ok(recB.vetoes.some(function (v) { return v.tier === 1 && v.type === 'evidence'; }), 'evidence veto recorded as Tier-1 with reason');

// ---- Tier-1 CONSISTENCY veto: cited code disagrees with asset family ----
var recC = R.reconcile({ transcript: 'process piping line, sour service', assetClaims: [{ value: 'process_piping', confidence: 0.9, kind: 'component' }], citedCodes: ['API 653'] });
ok(recC.vetoes.some(function (v) { return v.type === 'consistency'; }), 'consistency veto: API 653 on piping flagged');
ok(recC.finalAuthority === 'API 570', 'piping authority derived as API 570 regardless of bad cited code');

// ---- Tier-1 SCOPE refusal ----
var recS = R.reconcile({ transcript: 'Nuclear reactor core containment and spent fuel pool inspection.', assetClaims: [{ value: 'pressure_vessel', confidence: 0.8, kind: 'explicit-asset' }] });
ok(recS.vetoes.some(function (v) { return v.type === 'scope'; }) && recS.finalDisposition === 'refer_out_of_scope', 'scope refusal: nuclear referred out');

// ---- Tier-1 CONFIDENCE FLOOR ----
var recLo = R.reconcile({ transcript: 'some equipment with measured wall loss of 30%', assetClaims: [{ value: 'pressure_vessel', confidence: 0.4, kind: 'explicit-asset' }], aggregateConfidence: 0.4 });
ok(recLo.vetoes.some(function (v) { return v.type === 'confidence_floor'; }) && recLo.finalDisposition === 'hold_for_review', 'confidence floor: < 0.60 forces HOLD');

// ---- conflict surfacing + requiresHumanReview ----
var recConf = R.reconcile({ transcript: 'furnace', assetClaims: [{ value: 'pressure_vessel', confidence: 0.9, kind: 'explicit-asset' }, { value: 'offshore_platform', confidence: 0.3, kind: 'domain-keyword' }] });
ok(recConf.finalAsset === 'pressure_vessel', 'conflict: explicit asset survives domain-keyword challenge');
ok(recConf.conflicts.length > 0 && recConf.requiresHumanReview === true, 'conflict surfaced + requiresHumanReview');

fs.rmSync(tmp, { recursive: true, force: true });
if (fails.length) { console.log('FAIL reconciliation-layer: ' + fails.length); fails.forEach(function (f) { console.log('   - ' + f); }); process.exit(1); }
console.log('All reconciliation-layer Phases 8+9 checks passed (' + pass + ' assertions: deterministic axis floor for all breakers, FINAL PRINCIPLE end-to-end, Tier-1 evidence/consistency/scope/confidence vetoes, conflict surfacing).');
