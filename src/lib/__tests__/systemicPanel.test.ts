// ============================================================================
// systemicPanel.test.ts  -  the PARALLEL-NOT-COUPLED discipline as a falsifiable
// gate, so it cannot silently leak the next time someone "improves" the layout.
// FORGED 4D NDT  -  DEPLOY416.   Run: npx tsx --test src/lib/__tests__/systemicPanel.test.ts
//
// Four machine-checks on the design call (two coupling, two honesty):
//   1. FIREBREAK    findings render only inside data-region="systemic"; the view is
//                   built from findings alone and carries no urgency identity.
//   2. NO COUPLING  the panel HTML contains no urgency band colour or band name.
//   3. PROVISIONAL  a PREVALENCE_PROVISIONAL finding never renders without "cannot confirm".
//   4. HONEST CHIP  chip count == rendered findings; chip "confirmed" == teal findings.
// ============================================================================
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSystemicView, renderSystemicPanelHTML, renderCountChipHTML,
  URGENCY_BAND_COLORS, URGENCY_BAND_NAMES
} from "../systemicPanel";

var FINDINGS = [
  { actor: "fixed_support", signal: "CLUSTER", cohort: "batch_1998", observed: 1.0, baseline: 0.0, n: 4, recommendation: "clusters in cohort batch_1998" },
  { actor: "insulation", signal: "PREVALENCE_PROVISIONAL", cohort: "fleet", observed: 0.7, baseline: 0.4, n: 7, recommendation: "exceeds an unsourced placeholder rate" },
  { actor: "drainage", signal: "ELEVATED_NO_CONTRAST", cohort: "fleet", observed: 0.8, baseline: null, n: 8, recommendation: "high but no expected rate" }
];

function countOccurrences(hay: string, needle: string): number {
  var n = 0, i = hay.indexOf(needle);
  while (i >= 0) { n++; i = hay.indexOf(needle, i + needle.length); }
  return n;
}

describe("systemic panel - parallel-not-coupled discipline", function () {
  var view = buildSystemicView(FINDINGS);
  var panel = renderSystemicPanelHTML(view);

  it("CHECK 1 (firebreak): findings live inside exactly one data-region=systemic, no item carries an urgency palette", function () {
    assert.equal(countOccurrences(panel, 'data-region="systemic"'), 1);
    assert.equal(countOccurrences(panel, "data-signal="), FINDINGS.length);
    for (var i = 0; i < view.items.length; i++) {
      assert.ok(view.items[i].palette === "teal" || view.items[i].palette === "gray",
        "item palette must be teal/gray, got " + view.items[i].palette);
    }
  });

  it("CHECK 2 (no coupling): panel HTML contains no urgency band colour or band name", function () {
    for (var c = 0; c < URGENCY_BAND_COLORS.length; c++) {
      assert.equal(panel.indexOf(URGENCY_BAND_COLORS[c]), -1, "panel must not contain band colour " + URGENCY_BAND_COLORS[c]);
    }
    var humanFacing = panel.replace(/data-signal="[^"]*"/g, "");
    for (var b = 0; b < URGENCY_BAND_NAMES.length; b++) {
      assert.equal(humanFacing.indexOf(URGENCY_BAND_NAMES[b]), -1, "panel must not surface band name " + URGENCY_BAND_NAMES[b]);
    }
  });

  it("CHECK 3 (provisional honesty): a PREVALENCE_PROVISIONAL finding always renders with its 'cannot confirm' caveat", function () {
    var provView = buildSystemicView([{ actor: "insulation", signal: "PREVALENCE_PROVISIONAL", cohort: "fleet", observed: 0.7, baseline: 0.4, n: 7 }]);
    var provPanel = renderSystemicPanelHTML(provView);
    assert.ok(provPanel.indexOf('data-signal="PREVALENCE_PROVISIONAL"') >= 0);
    assert.ok(provPanel.indexOf("cannot confirm") >= 0, "provisional finding rendered without its caveat");
    assert.equal(provView.items[0].palette, "gray");
    assert.equal(provView.items[0].confirmed, false);
  });

  it("CHECK 4 (honest chip): chip count == rendered findings; confirmed == teal findings", function () {
    var chip = renderCountChipHTML(view);
    var renderedCount = countOccurrences(panel, "data-signal=");
    assert.equal(view.chip.total, renderedCount, "chip total must equal rendered finding count");
    assert.ok(chip.indexOf('data-count="' + renderedCount + '"') >= 0, "chip data-count must equal rendered count");
    assert.equal(view.chip.confirmed, 1);
    assert.ok(chip.indexOf('data-confirmed="1"') >= 0);
  });

  it("graceful degrade: zero findings -> one calm line, no scary empty box, no chip", function () {
    var emptyView = buildSystemicView([]);
    var emptyPanel = renderSystemicPanelHTML(emptyView);
    assert.ok(emptyView.empty);
    assert.ok(emptyPanel.indexOf('data-empty="1"') >= 0);
    assert.ok(emptyPanel.indexOf("No program-level patterns") >= 0);
    assert.equal(countOccurrences(emptyPanel, "data-signal="), 0);
    assert.equal(renderCountChipHTML(emptyView), "");
  });
});
