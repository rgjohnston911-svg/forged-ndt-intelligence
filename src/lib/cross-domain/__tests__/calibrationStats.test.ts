// ============================================================
// Sprint 4D — calibrationStats tests
//
// Coverage:
//   - 4-row scenario: 2 reported / 2 pending, 1 correct mechanism →
//     correct rates computed; total_predictions includes the pending
//     rows; predictions_with_outcomes counts only reported.
//   - Filter by asset_domain → only matching predictions counted.
//   - Empty result set → zero-valued stats, no throw.
//   - Mixed action_tier_alignment values → distribution sums to
//     predictions_with_outcomes.
//   - mechanism_match='unknown' rows excluded from match-rate denominator.
// ============================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeCalibrationStats } from "../calibrationStats";

const ORG = "88888888-8888-8888-8888-888888888888";

interface MockState {
  predictions: Array<Record<string, unknown>>;
  assets: Array<Record<string, unknown>>;
}

function makeSupabase(state: MockState): unknown {
  return {
    from(table: string) {
      return {
        _table: table,
        _filters: [] as Array<(r: Record<string, unknown>) => boolean>,
        select(_cols?: string) {
          return this;
        },
        eq(col: string, val: unknown) {
          this._filters.push((r) => r[col] === val);
          return this;
        },
        in(col: string, vals: unknown[]) {
          const set = new Set(vals);
          this._filters.push((r) => set.has(r[col]));
          return this;
        },
        gte(col: string, val: unknown) {
          this._filters.push((r) => {
            const v = r[col];
            if (v === undefined || v === null) return false;
            return (v as string | number) >= (val as string | number);
          });
          return this;
        },
        lte(col: string, val: unknown) {
          this._filters.push((r) => {
            const v = r[col];
            if (v === undefined || v === null) return false;
            return (v as string | number) <= (val as string | number);
          });
          return this;
        },
        then(onFulfilled: (v: unknown) => unknown) {
          if (this._table === "cd_deliberation_predictions") {
            const rows = state.predictions.filter((r) =>
              this._filters.every((f) => f(r))
            );
            return Promise.resolve({ data: rows, error: null }).then(
              onFulfilled
            );
          }
          if (this._table === "cd_asset_nodes") {
            const rows = state.assets.filter((r) =>
              this._filters.every((f) => f(r))
            );
            return Promise.resolve({ data: rows, error: null }).then(
              onFulfilled
            );
          }
          return Promise.resolve({ data: [], error: null }).then(onFulfilled);
        },
      };
    },
  };
}

function mkPrediction(
  id: string,
  over: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    id,
    org_id: ORG,
    asset_id: "asset-A",
    primary_mechanism: "pitting_corrosion",
    predicted_at: new Date("2026-04-01").toISOString(),
    reported_at: null,
    calibration_delta: null,
    ...over,
  };
}

function mkDelta(over: Partial<Record<string, unknown>> = {}) {
  return {
    mechanism_match: "correct",
    consequence_tier_delta: 0,
    time_to_consequence_error_days: 0,
    action_tier_alignment: "matched",
    computed_at: new Date().toISOString(),
    ...over,
  };
}

describe("computeCalibrationStats — mixed scenario", () => {
  it("4 predictions, 2 reported, 1 correct mechanism → mechanism_match_rate=0.5, exact tier rate=0.5", async () => {
    const state: MockState = {
      predictions: [
        mkPrediction("p1", {
          reported_at: new Date().toISOString(),
          calibration_delta: mkDelta({
            mechanism_match: "correct",
            consequence_tier_delta: 0,
            time_to_consequence_error_days: 10,
            action_tier_alignment: "matched",
          }),
        }),
        mkPrediction("p2", {
          reported_at: new Date().toISOString(),
          calibration_delta: mkDelta({
            mechanism_match: "incorrect",
            consequence_tier_delta: 2,
            time_to_consequence_error_days: -40,
            action_tier_alignment: "under_predicted",
          }),
        }),
        mkPrediction("p3"), // pending
        mkPrediction("p4"), // pending
      ],
      assets: [],
    };
    const supabase = makeSupabase(state);
    const stats = await computeCalibrationStats(
      { org_id: ORG },
      supabase as never
    );
    assert.equal(stats.total_predictions, 4);
    assert.equal(stats.predictions_with_outcomes, 2);
    assert.equal(stats.mechanism_match_rate, 0.5);
    assert.equal(stats.consequence_tier_match_rate, 0.5);
    assert.equal(stats.consequence_tier_within_1_rate, 0.5);
    assert.equal(stats.action_tier_alignment_distribution.matched, 1);
    assert.equal(
      stats.action_tier_alignment_distribution.under_predicted,
      1
    );
    // Mean absolute t2c error: (|10| + |-40|) / 2 = 25
    assert.equal(stats.time_to_consequence_mean_error_days, 25);
  });
});

describe("computeCalibrationStats — empty / zero-valued", () => {
  it("no predictions → zero stats, no throw", async () => {
    const supabase = makeSupabase({ predictions: [], assets: [] });
    const stats = await computeCalibrationStats(
      { org_id: ORG },
      supabase as never
    );
    assert.equal(stats.total_predictions, 0);
    assert.equal(stats.predictions_with_outcomes, 0);
    assert.equal(stats.mechanism_match_rate, 0);
    assert.equal(stats.time_to_consequence_mean_error_days, null);
  });

  it("predictions exist but none reported → counts total but reports zero rates", async () => {
    const state: MockState = {
      predictions: [mkPrediction("p1"), mkPrediction("p2"), mkPrediction("p3")],
      assets: [],
    };
    const stats = await computeCalibrationStats(
      { org_id: ORG },
      makeSupabase(state) as never
    );
    assert.equal(stats.total_predictions, 3);
    assert.equal(stats.predictions_with_outcomes, 0);
    assert.equal(stats.mechanism_match_rate, 0);
  });
});

describe("computeCalibrationStats — asset filter", () => {
  it("filtering by asset_domain pipeline keeps only pipeline-tagged predictions", async () => {
    const state: MockState = {
      predictions: [
        mkPrediction("p1", {
          asset_id: "asset-PIPE",
          reported_at: new Date().toISOString(),
          calibration_delta: mkDelta({ mechanism_match: "correct" }),
        }),
        mkPrediction("p2", {
          asset_id: "asset-STRUCT",
          reported_at: new Date().toISOString(),
          calibration_delta: mkDelta({ mechanism_match: "incorrect" }),
        }),
      ],
      assets: [
        { id: "asset-PIPE", org_id: ORG, domain: "pipeline", asset_type: "riser" },
        {
          id: "asset-STRUCT",
          org_id: ORG,
          domain: "structural",
          asset_type: "handrail",
        },
      ],
    };
    const stats = await computeCalibrationStats(
      { org_id: ORG, asset_domain: "pipeline" },
      makeSupabase(state) as never
    );
    assert.equal(stats.total_predictions, 1);
    assert.equal(stats.predictions_with_outcomes, 1);
    assert.equal(stats.mechanism_match_rate, 1);
    assert.ok(stats.filter_description.includes("domain=pipeline"));
  });
});

describe("computeCalibrationStats — unknown mechanism excluded from denominator", () => {
  it("'unknown' rows are not held against the platform in match-rate math", async () => {
    const state: MockState = {
      predictions: [
        mkPrediction("p1", {
          reported_at: new Date().toISOString(),
          calibration_delta: mkDelta({ mechanism_match: "correct" }),
        }),
        mkPrediction("p2", {
          reported_at: new Date().toISOString(),
          calibration_delta: mkDelta({ mechanism_match: "unknown" }),
        }),
      ],
      assets: [],
    };
    const stats = await computeCalibrationStats(
      { org_id: ORG },
      makeSupabase(state) as never
    );
    // 1 correct / 1 determinate = 1.0 (the unknown is excluded)
    assert.equal(stats.mechanism_match_rate, 1);
    assert.equal(stats.predictions_with_outcomes, 2);
  });
});
