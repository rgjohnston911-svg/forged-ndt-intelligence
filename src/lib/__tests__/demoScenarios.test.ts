// @ts-nocheck
// ============================================================================
// demoScenarios.test.ts  -  the public /demo is held to the SAME gates as the
// product. FORGED 4D NDT  -  DEPLOY418.   Run: npx tsx --test src/lib/__tests__/demoScenarios.test.ts
//
//  - every single-asset demo narrative passes report-provenance (PASS): our own
//    marketing demo may not ship a number that does not trace to a source field.
//  - the HOLD scenario actually holds (the "correct refusal" beat is real).
//  - the fleet CLUSTER is reproducible from the aggregation engine, not hand-faked.
// ============================================================================
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEMO_SINGLE, DEMO_FLEET } from "../demoScenarios";
import RP from "../../../netlify/functions/report-provenance.cjs";
import AGG from "../../../netlify/functions/fleet-peripheral-aggregation.cjs";

describe("public /demo is held to the product's gates", function () {
  it("every single-asset narrative passes report-provenance (no unsourced number shipped)", function () {
    for (var i = 0; i < DEMO_SINGLE.length; i++) {
      var s = DEMO_SINGLE[i];
      var r = RP.validateProvenance(s.report_narrative, s.provenance_source, s.provenance_disposition);
      assert.equal(r.verdict, "PASS", s.id + " provenance: " + JSON.stringify(r.unsourced_claims) + " dispo " + r.stated_disposition + " vs " + r.engine_disposition);
    }
  });

  it("the HOLD scenario actually holds (correct-refusal beat is real)", function () {
    var hold = DEMO_SINGLE.filter(function (s) { return s.id === "insufficient-data-hold"; })[0];
    assert.ok(hold, "HOLD scenario present");
    assert.equal(hold.decision.disposition, "hold_for_review");
    assert.ok(hold.report_narrative.indexOf("insufficient") >= 0 || hold.report_narrative.indexOf("holds") >= 0);
  });

  it("the fleet CLUSTER is reproducible from the aggregation engine (not hand-faked)", function () {
    var assets = [];
    var k;
    for (k = 0; k < 4; k++) { assets.push({ id: "c" + k, cohort: "batch_1998", flags: ["fixed_support"] }); }
    for (k = 0; k < 6; k++) { assets.push({ id: "n" + k, cohort: "batch_2015", flags: [] }); }
    var got = AGG.aggregatePeripherals({ assets: assets }, AGG.CONFIG).map(function (f) { return f.actor + ":" + f.signal + ":" + f.cohort; });
    assert.ok(got.indexOf("fixed_support:CLUSTER:batch_1998") >= 0, "engine produces the CLUSTER the demo shows");
    var baked = DEMO_FLEET.systemic_findings.map(function (f) { return f.actor + ":" + f.signal + ":" + f.cohort; });
    assert.ok(baked.indexOf("fixed_support:CLUSTER:batch_1998") >= 0, "baked finding matches the engine output");
  });
});
