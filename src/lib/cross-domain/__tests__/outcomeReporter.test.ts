// ============================================================
// Sprint 4D — outcomeReporter tests
//
// Coverage:
//   - Happy path: outcome reported → row updated, calibration_delta
//     computed with the right shape.
//   - Double-reporting: row already has reported_at → error returned.
//   - Mechanism match: confirmed=true → 'correct'; false → 'incorrect';
//     null → 'unknown'.
//   - Tier-distance: predicted high (idx 3), actual severe (idx 4) →
//     delta = -1; predicted severe, actual moderate → delta = +2.
//   - Action alignment: predicted urgent_assessment, actual
//     immediate_remediation → 'under_predicted'.
//   - Time error: predicted 120 days, actual 90 → +30; either side
//     null → null.
//   - Prediction not found → ok:false error.
// ============================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  recordOutcome,
  computeCalibrationDelta,
  computeMechanismMatch,
  computeConsequenceTierDelta,
  computeActionAlignment,
} from "../outcomeReporter";
import type { ActualOutcome } from "../types";

const ORG = "77777777-7777-7777-7777-777777777777";
const PRED = "11111111-1111-2222-3333-444444444444";

interface MockState {
  prediction: Record<string, unknown> | null;
  updated: Record<string, unknown> | null;
  forceUpdateError: boolean;
}

function makeSupabase(state: MockState): unknown {
  return {
    from(table: string) {
      return {
        _table: table,
        _filters: [] as Array<(r: Record<string, unknown>) => boolean>,
        _isUpdate: false,
        _updatePayload: null as Record<string, unknown> | null,
        _isMaybeSingle: false,
        select(_cols?: string) {
          return this;
        },
        update(payload: Record<string, unknown>) {
          this._isUpdate = true;
          this._updatePayload = payload;
          return this;
        },
        eq(col: string, val: unknown) {
          this._filters.push((r) => r[col] === val);
          return this;
        },
        maybeSingle() {
          this._isMaybeSingle = true;
          return this;
        },
        then(onFulfilled: (v: unknown) => unknown) {
          if (this._isUpdate) {
            if (state.forceUpdateError) {
              return Promise.resolve({
                data: null,
                error: { message: "simulated update failure" },
              }).then(onFulfilled);
            }
            // Apply update to state.prediction if filter matches.
            if (
              state.prediction &&
              this._filters.every((f) => f(state.prediction!))
            ) {
              state.prediction = {
                ...state.prediction,
                ...(this._updatePayload ?? {}),
              };
              state.updated = state.prediction;
            }
            return Promise.resolve({ data: null, error: null }).then(
              onFulfilled
            );
          }
          // SELECT
          if (this._table === "cd_deliberation_predictions") {
            const rows = state.prediction ? [state.prediction] : [];
            const filtered = rows.filter((r) =>
              this._filters.every((f) => f(r))
            );
            return Promise.resolve({
              data: this._isMaybeSingle ? filtered[0] ?? null : filtered,
              error: null,
            }).then(onFulfilled);
          }
          return Promise.resolve({ data: [], error: null }).then(onFulfilled);
        },
      };
    },
  };
}

function mkActual(over: Partial<ActualOutcome> = {}): ActualOutcome {
  return {
    action_taken: "urgent_assessment",
    action_date: "2026-08-15",
    mechanism_confirmed: true,
    actual_consequence_tier: "high",
    days_to_actual_consequence: 120,
    reported_by: "test",
    free_text_notes: "test note",
    ...over,
  };
}

// ------------------------------------------------------------
// Pure-function tests
// ------------------------------------------------------------

describe("computeMechanismMatch", () => {
  it("true → correct, false → incorrect, null → unknown", () => {
    assert.equal(
      computeMechanismMatch(mkActual({ mechanism_confirmed: true })),
      "correct"
    );
    assert.equal(
      computeMechanismMatch(mkActual({ mechanism_confirmed: false })),
      "incorrect"
    );
    assert.equal(
      computeMechanismMatch(mkActual({ mechanism_confirmed: null })),
      "unknown"
    );
  });
});

describe("computeConsequenceTierDelta", () => {
  it("exact match → 0", () => {
    assert.equal(computeConsequenceTierDelta("high", "high"), 0);
  });
  it("predicted high (3), actual severe (4) → -1 (under-predicted)", () => {
    assert.equal(computeConsequenceTierDelta("high", "severe"), -1);
  });
  it("predicted severe (4), actual moderate (2) → +2 (over-predicted)", () => {
    assert.equal(computeConsequenceTierDelta("severe", "moderate"), 2);
  });
  it("both null → 0 (no information)", () => {
    assert.equal(computeConsequenceTierDelta(null, null), 0);
  });
});

describe("computeActionAlignment", () => {
  it("predicted urgent_assessment, actual immediate_remediation → under_predicted", () => {
    assert.equal(
      computeActionAlignment("urgent_assessment", "immediate_remediation"),
      "under_predicted"
    );
  });
  it("predicted immediate_remediation, actual urgent_assessment → over_predicted", () => {
    assert.equal(
      computeActionAlignment("immediate_remediation", "urgent_assessment"),
      "over_predicted"
    );
  });
  it("predicted urgent_assessment, actual urgent_assessment → matched", () => {
    assert.equal(
      computeActionAlignment("urgent_assessment", "urgent_assessment"),
      "matched"
    );
  });
  it("no_action_taken or other_action → unknown", () => {
    assert.equal(
      computeActionAlignment("urgent_assessment", "no_action_taken"),
      "unknown"
    );
    assert.equal(
      computeActionAlignment("urgent_assessment", "other_action"),
      "unknown"
    );
  });
});

describe("computeCalibrationDelta", () => {
  it("populates all fields including computed_at ISO timestamp", () => {
    const pred = {
      id: PRED,
      reported_at: null,
      primary_mechanism: "pitting_corrosion",
      consequence_overall_tier: "severe",
      recommended_action_tier: "immediate_remediation",
      time_to_consequence_days: 120,
    };
    const actual = mkActual({
      actual_consequence_tier: "high",
      action_taken: "urgent_assessment",
      days_to_actual_consequence: 90,
    });
    const delta = computeCalibrationDelta(pred, actual);
    assert.equal(delta.mechanism_match, "correct");
    assert.equal(delta.consequence_tier_delta, 1); // severe(4) − high(3)
    assert.equal(delta.action_tier_alignment, "over_predicted");
    assert.equal(delta.time_to_consequence_error_days, 30);
    assert.ok(typeof delta.computed_at === "string");
  });

  it("null time fields → time_to_consequence_error_days null", () => {
    const pred = {
      id: PRED,
      reported_at: null,
      primary_mechanism: null,
      consequence_overall_tier: "moderate",
      recommended_action_tier: "engineering_review",
      time_to_consequence_days: null,
    };
    const delta = computeCalibrationDelta(
      pred,
      mkActual({ days_to_actual_consequence: 100 })
    );
    assert.equal(delta.time_to_consequence_error_days, null);
  });
});

// ------------------------------------------------------------
// recordOutcome integration
// ------------------------------------------------------------

describe("recordOutcome — happy path", () => {
  it("UPDATEs the prediction row with reported_at, actual_outcome, calibration_delta", async () => {
    const state: MockState = {
      prediction: {
        id: PRED,
        org_id: ORG,
        reported_at: null,
        primary_mechanism: "pitting_corrosion",
        consequence_overall_tier: "high",
        recommended_action_tier: "urgent_assessment",
        time_to_consequence_days: 120,
      },
      updated: null,
      forceUpdateError: false,
    };
    const supabase = makeSupabase(state);
    const r = await recordOutcome({
      prediction_id: PRED,
      org_id: ORG,
      actual: mkActual({
        actual_consequence_tier: "high",
        action_taken: "urgent_assessment",
        days_to_actual_consequence: 130,
      }),
      supabase: supabase as never,
    });
    assert.equal(r.ok, true, r.error ?? "");
    assert.ok(r.calibration_delta);
    assert.equal(r.calibration_delta!.mechanism_match, "correct");
    assert.equal(r.calibration_delta!.consequence_tier_delta, 0);
    assert.equal(r.calibration_delta!.action_tier_alignment, "matched");
    assert.equal(r.calibration_delta!.time_to_consequence_error_days, -10);
    // State updated
    assert.ok(state.updated);
    assert.ok(state.updated!.reported_at);
    assert.ok(state.updated!.actual_outcome);
    assert.ok(state.updated!.calibration_delta);
  });
});

describe("recordOutcome — double-reporting", () => {
  it("returns ok:false when row already has reported_at", async () => {
    const state: MockState = {
      prediction: {
        id: PRED,
        org_id: ORG,
        reported_at: new Date().toISOString(),
        primary_mechanism: "x",
        consequence_overall_tier: "high",
        recommended_action_tier: "urgent_assessment",
        time_to_consequence_days: 100,
      },
      updated: null,
      forceUpdateError: false,
    };
    const supabase = makeSupabase(state);
    const r = await recordOutcome({
      prediction_id: PRED,
      org_id: ORG,
      actual: mkActual(),
      supabase: supabase as never,
    });
    assert.equal(r.ok, false);
    assert.equal(r.error, "prediction_already_reported");
  });
});

describe("recordOutcome — not found", () => {
  it("returns ok:false with prediction_not_found", async () => {
    const state: MockState = {
      prediction: null,
      updated: null,
      forceUpdateError: false,
    };
    const supabase = makeSupabase(state);
    const r = await recordOutcome({
      prediction_id: PRED,
      org_id: ORG,
      actual: mkActual(),
      supabase: supabase as never,
    });
    assert.equal(r.ok, false);
    assert.equal(r.error, "prediction_not_found");
  });
});

describe("recordOutcome — UPDATE error preserved", () => {
  it("ok:false with error message, no throw", async () => {
    const state: MockState = {
      prediction: {
        id: PRED,
        org_id: ORG,
        reported_at: null,
        primary_mechanism: "x",
        consequence_overall_tier: "high",
        recommended_action_tier: "urgent_assessment",
        time_to_consequence_days: 100,
      },
      updated: null,
      forceUpdateError: true,
    };
    const supabase = makeSupabase(state);
    const r = await recordOutcome({
      prediction_id: PRED,
      org_id: ORG,
      actual: mkActual(),
      supabase: supabase as never,
    });
    assert.equal(r.ok, false);
    assert.ok(r.error && r.error.includes("simulated update failure"));
  });
});
