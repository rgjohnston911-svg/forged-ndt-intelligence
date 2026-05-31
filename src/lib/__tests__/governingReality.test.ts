import { test } from "node:test";
import assert from "node:assert";
import { resolveGoverningReality } from "../governingReality";

var BEHAVIORAL = /complacen|normalization of deviance|confirmation bias|\bego\b|\bfear\b|negligen|\blazy\b|attitude|mindset|culture/i;
function noBehavioral(r: any) {
  return !BEHAVIORAL.test(r.statement) && !BEHAVIORAL.test((r.contributing || []).join(" "));
}

test("TEST 14: operational change + reassessment gap + suspected fatigue -> OPERATIONAL_CHANGE_WITHOUT_REASSESSMENT", () => {
  var r = resolveGoverningReality({
    consequenceTier: "CRITICAL", disposition: "hold_for_review",
    suspectedGoverning: ["vibration-induced fatigue"], dispositionDriver: "unresolved fatigue risk",
    convergenceStreamIds: ["VIBRATION", "OPERATIONAL_CHANGE", "STRUCTURAL_INTERFACE", "DEFERRED_MAINTENANCE"],
    orgFailureScore: 7,
    transcript: "Compressor throughput increased 35%. No vibration study performed since the throughput increase. No MOC documentation found."
  });
  assert.equal(r.class, "OPERATIONAL_CHANGE_WITHOUT_REASSESSMENT");
  assert.match(r.statement, /operational change/i);
  assert.match(r.statement, /vibration study|moc/i);
  assert.match(r.statement, /fatigue/i);
});

test("no behavioral / motive language is ever emitted", () => {
  var r = resolveGoverningReality({
    disposition: "hold_for_review", suspectedGoverning: ["vibration-induced fatigue"],
    convergenceStreamIds: ["OPERATIONAL_CHANGE", "DEFERRED_MAINTENANCE"], orgFailureScore: 8,
    transcript: "management directed avoid shutdown, review not completed, production target critical, operations considers this normal"
  });
  assert.ok(noBehavioral(r), "statement/contributing must contain no behavioral inference");
});

test("anti-contamination: operational change WITHOUT a reassessment gap does not fire class 2", () => {
  var r = resolveGoverningReality({
    disposition: "hold_for_review", suspectedGoverning: ["fatigue"],
    convergenceStreamIds: ["OPERATIONAL_CHANGE"],
    transcript: "throughput increased 35%, vibration study completed and reviewed"
  });
  assert.notEqual(r.class, "OPERATIONAL_CHANGE_WITHOUT_REASSESSMENT");
});

test("confirmed critical damage governs decisively", () => {
  var r = resolveGoverningReality({ disposition: "no_go", hardLockCount: 1, governingFailureMode: "CRACKING" });
  assert.equal(r.class, "CONFIRMED_CRITICAL_DAMAGE");
  assert.equal(r.governs, true);
});

test("suspected mechanism without operational-change root -> SUSPECTED_GOVERNING_MECHANISM", () => {
  var r = resolveGoverningReality({
    disposition: "hold_for_review", suspectedGoverning: ["stress corrosion cracking"], governingFailureMode: "CORROSION"
  });
  assert.equal(r.class, "SUSPECTED_GOVERNING_MECHANISM");
});

test("forward trajectory governs when forecast breaches before intervention", () => {
  var r = resolveGoverningReality({
    disposition: "acceptable", futureVerdict: "BREACH_BEFORE_NEXT_INTERVENTION",
    futureDominantDriver: "trend acceleration", futureAdjustedLifeMonths: 14, futureNextInterventionMonths: 36
  });
  assert.equal(r.class, "FORWARD_TRAJECTORY_GOVERNS");
});

test("organizational assurance gaps govern when no mechanism present", () => {
  var r = resolveGoverningReality({ disposition: "hold_for_review", orgFailureScore: 6, orgIndicatorCount: 3 });
  assert.equal(r.class, "ORGANIZATIONAL_ASSURANCE_FAILURE");
});

test("measured damage governs when it is the controlling confirmed mechanism", () => {
  var r = resolveGoverningReality({ disposition: "repair", governingFailureMode: "CORROSION", governingSeverity: "SEVERE" });
  assert.ok(r.class === "MEASURED_DAMAGE_GOVERNS" || r.class === "CONFIRMED_CRITICAL_DAMAGE");
});

test("insufficient evidence -> HOLD class", () => {
  var r = resolveGoverningReality({ disposition: "hold_for_review", transcript: "vague, no data" });
  assert.equal(r.class, "INSUFFICIENT_EVIDENCE_HOLD");
});

test("benign scenario -> NONE (asserts nothing)", () => {
  var r = resolveGoverningReality({ disposition: "acceptable", transcript: "routine survey nominal" });
  assert.equal(r.class, "NONE");
  assert.equal(r.governs, false);
});
