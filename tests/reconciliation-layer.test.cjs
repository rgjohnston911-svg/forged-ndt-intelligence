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

// ---- DEPLOY448 governingStatement (the cutover renders THIS as the live banner) ----
var brk = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/fixtures/system-breakers.json"), "utf8")).cases;
function txt(id){ var c=brk.filter(function(x){return x.id===id;})[0]; return c?c.transcript:""; }
var sE = R.reconcile({ transcript: txt("BREAKER_E_monitoring_assurance"), assetClaims:[{value:"instrumentation_monitoring",confidence:0.9,kind:"explicit-asset"}] }).governingStatement;
ok(/not dispositionable|loss of confidence/i.test(sE), "TEST25 statement frames assurance failure (got: "+sE.slice(0,60)+")");
ok(!/\bcorrosion\b/i.test(sE), "TEST25 statement does NOT say corrosion");
var sA = R.reconcile({ transcript: txt("BREAKER_A_furnace_process_drift"), assetClaims:[{value:"pressure_vessel",confidence:0.9,kind:"explicit-asset"}] }).governingStatement;
ok(/design basis/i.test(sA), "furnace statement names lost design basis");
var sF = R.reconcile({ transcript: txt("BREAKER_F_flaregas_monitoring_trust"), assetClaims:[{value:"process_piping",confidence:0.9,kind:"explicit-asset"}] }).governingStatement;
ok(/monitoring\/assurance failure governs|cannot be independently validated/i.test(sF), "flare-gas statement frames monitoring-assurance failure (got: "+sF.slice(0,60)+")");
ok(!/\bcorrosion\b/i.test(sF), "flare-gas statement does NOT say corrosion");
var sC = R.reconcile({ transcript: txt("BREAKER_C_software_fleet_failure"), assetClaims:[{value:"wind_turbine",confidence:0.9,kind:"explicit-asset"}] }).governingStatement;
ok(/fleet/i.test(sC) && !/\bcorrosion\b/i.test(sC), "fleet statement is systemic, not corrosion");

// ---- DEPLOY453 FLEET_PATTERN disposition stopgap: a fleet pattern GOVERNS over a clean
// physical pass; disposition must match the "fleet governs" statement (not continue). ----
var hypFleet = { meta: { ok: true }, asset: { value: 'wind_turbine', confidence: 0.9 }, physicalCondition: 'ACCEPTABLE', assuranceState: 'ESTABLISHED', operationalChange: 'FLEET_PATTERN' };
var recFleet = R.reconcile({ transcript: 'three sister turbines, common software change, two gearbox failures across the fleet, third shows same signature; no corrosion, no tilt', hypothesis: hypFleet, assetClaims: [{ value: 'wind_turbine', confidence: 0.9, kind: 'explicit-asset' }], aggregateConfidence: 0.85 });
ok(recFleet.governingReality.operational === 'FLEET_PATTERN', 'FLEET stopgap: operational axis is FLEET_PATTERN (got ' + recFleet.governingReality.operational + ')');
ok(recFleet.finalDisposition === 'restricted_reassessment_required', 'FLEET stopgap: disposition governs (restricted_reassessment_required), NOT continue (got ' + recFleet.finalDisposition + ')');
ok(/fleet/i.test(recFleet.governingStatement), 'FLEET stopgap: statement and disposition agree (statement names fleet)');

// ---- DEPLOY455 CP1: reconcile emits three well-formed AxisBids (perception layer). Tuple
// unchanged; bids carry the same axis states + a provenance tier (not a score). ----
var recBids = R.reconcile({ transcript: byId("BREAKER_E_monitoring_assurance").transcript, assetClaims: [{ value: "instrumentation_monitoring", confidence: 0.9, kind: "explicit-asset" }] });
ok(Array.isArray(recBids.bids) && recBids.bids.length === 3, "CP1: exactly three bids emitted (got " + (recBids.bids ? recBids.bids.length : "none") + ")");
var axesSeen = recBids.bids.map(function (b) { return b.axis; }).sort().join(",");
ok(axesSeen === "ASSURANCE,OPERATIONAL,PHYSICAL", "CP1: one bid per axis (" + axesSeen + ")");
var validTiers = { DIRECT_MEASURED: 1, DOCUMENTED: 1, ABSENCE_CONFIRMED: 1, NONE: 1 };
ok(recBids.bids.every(function (b) { return validTiers[b.tier] === 1; }), "CP1: every bid tier is a valid EvidenceTier");
var physBid = recBids.bids.filter(function (b) { return b.axis === "PHYSICAL"; })[0];
ok(physBid && physBid.state === recBids.governingReality.physical, "CP1: physical bid state matches the tuple (perception is consistent)");
ok(recBids.bids.every(function (b) { return typeof b.rationale === "string" && b.rationale.length > 0 && Array.isArray(b.evidenceRefs); }), "CP1: every bid has a rationale + evidenceRefs");
// CP1 must NOT change disposition: the existing arbiter still decides (contest wires in CP2).
ok(typeof recBids.finalDisposition === "string" && recBids.finalDisposition.length > 0, "CP1: disposition still produced by existing arbiter (unchanged this checkpoint)");

// ---- DEPLOY456 CP2: runGovernanceContest is the sole arbiter. Multi-adverse axes MERGE,
// never escalate at the axis layer. The change->assurance causal link is recorded at perception
// (causedBy) and the contest absorbs the cause, so a monitoring case where a change drove the
// assurance doubt resolves to ASSURANCE GOVERNS, not a fabricated conflict. ----
var cpE = R.reconcile({ transcript: byId("BREAKER_E_monitoring_assurance").transcript, assetClaims: [{ value: "instrumentation_monitoring", confidence: 0.9, kind: "explicit-asset" }] });
var eAssur = cpE.bids.filter(function (b) { return b.axis === "ASSURANCE"; })[0];
ok(eAssur && eAssur.causedBy === "OPERATIONAL", "CP2: E records change->assurance causal link (assurance.causedBy=OPERATIONAL)");
ok(/monitoring\/assurance failure governs/i.test(cpE.governingStatement), "CP2: E -> assurance governs via causal merge (not escalate, got: " + cpE.governingStatement.slice(0,50) + ")");
ok(cpE.finalDisposition === "restricted_reassessment_required", "CP2: E disposition restricted (assurance governs)");
// FLEET governs by construction now (453 stopgap deleted; contest treats !=STABLE as adverse).
var cpC = R.reconcile({ transcript: byId("BREAKER_C_software_fleet_failure").transcript, assetClaims: [{ value: "wind_turbine", confidence: 0.9, kind: "explicit-asset" }] });
ok(cpC.finalDisposition === "restricted_reassessment_required" && /fleet/i.test(cpC.governingStatement), "CP2: FLEET governs via contest, no stopgap needed");
// Characterized wall loss still -> fitness_for_service (no regression on the physical 90%).
var cpFFS = R.reconcile({ transcript: "process piping, measured wall loss of 64 percent, remaining wall 0.12 inch, corrosion product observed", assetClaims: [{ value: "process_piping", confidence: 0.9, kind: "explicit-asset" }] });
ok(cpFFS.finalDisposition === "fitness_for_service_required", "CP2: confirmed wall loss -> fitness_for_service_required (got " + cpFFS.finalDisposition + ")");

// ---- DEPLOY462 CP4: SAFETY-FUNCTION ASSURANCE RECOGNIZER (TEST 29/31/32). A protective function
// with protective demand-up/response-down and/or a logic change with no independent validation has
// UNVERIFIED safety-function assurance -> assurance governs -> verify the safety function. Falsifiable;
// must NOT over-fire on a clean, independently-validated SIS, nor on a non-safety asset. ----
var sisDiverge = R.reconcile({ transcript: "Safety Instrumented System SIS-204 protecting furnace feed isolation. Valves stroke within time, no leakage, logic solver self-test passed, last proof test passed. Furnace trips decreased 88 percent. High-temperature excursions increased 34 percent. Events that previously caused automatic feed isolation now generate alarms only. Two SIS logic revisions installed. MOC records closed. Independent safety validation report not found. No corrosion, no cracking, no leak.", assetClaims: [{ value: "pressure_vessel", confidence: 0.9, kind: "explicit-asset" }] });
ok(sisDiverge.governingReality.assurance === "UNKNOWN_STATE", "CP4: SIS demand/response divergence + missing validation -> assurance UNKNOWN_STATE (got " + sisDiverge.governingReality.assurance + ")");
ok(sisDiverge.finalDisposition === "restricted_reassessment_required", "CP4: SIS -> assurance governs -> restricted_reassessment_required (got " + sisDiverge.finalDisposition + ")");
ok(/safety-function assurance failure governs/i.test(sisDiverge.governingStatement) && /IEC 61511/i.test(sisDiverge.governingStatement), "CP4: SIS statement names safety-function assurance + IEC 61511 (verify the safety function)");
ok(!/corrosion|cracking/i.test(sisDiverge.governingStatement), "CP4: SIS statement does NOT manufacture a physical mechanism");
var esdDiverge = R.reconcile({ transcript: "Emergency shutdown ESD system. ESD valves no leakage, stroke within spec. ESD trips decreased 92 percent over three years. Process upsets increased 37 percent. Several events that previously would have generated shutdowns now generated only alarms.", assetClaims: [{ value: "offshore_platform", confidence: 0.9, kind: "explicit-asset" }] });
ok(esdDiverge.governingReality.assurance === "UNKNOWN_STATE", "CP4: ESD demand/response divergence -> assurance UNKNOWN_STATE");
// NO over-fire: a clean, independently-validated SIS with stable demand/response stays ESTABLISHED
var sisClean = R.reconcile({ transcript: "Safety Instrumented System SIS-9. All proof tests passed. Independent safety validation completed and documented. No logic changes since commissioning. Trip demand rate stable, protective responses stable. No excursions.", assetClaims: [{ value: "pressure_vessel", confidence: 0.9, kind: "explicit-asset" }] });
ok(sisClean.governingReality.assurance === "ESTABLISHED", "CP4: clean independently-validated SIS does NOT over-fire (assurance ESTABLISHED, got " + sisClean.governingReality.assurance + ")");

fs.rmSync(tmp, { recursive: true, force: true });
if (fails.length) { console.log('FAIL reconciliation-layer: ' + fails.length); fails.forEach(function (f) { console.log('   - ' + f); }); process.exit(1); }
console.log('All reconciliation-layer Phases 8+9 checks passed (' + pass + ' assertions: deterministic axis floor for all breakers, FINAL PRINCIPLE end-to-end, Tier-1 evidence/consistency/scope/confidence vetoes, conflict surfacing).');
