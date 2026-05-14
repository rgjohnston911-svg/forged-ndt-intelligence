// ============================================================
// Sprint 4D — predictionCapture tests
//
// Coverage:
//   1. Happy path: finalized deliberation + consequence + causal chain
//      rows → INSERT happens, all fields populated, prediction_id
//      returned.
//   2. Idempotency: rerun on same deliberation → returns the existing
//      prediction_id with note=already_captured, no second INSERT.
//   3. consensus='unresolved' → capture skipped, note returned.
//   4. Consequence row missing → capture still proceeds, consequence
//      fields nulled (defensive against Sprint 4C-style gaps).
//   5. supabase.insert returns error → ok:false, error preserved.
//   6. Causal chain row missing → primary_mechanism null but capture
//      still succeeds.
// ============================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { captureDeliberationPrediction } from "../predictionCapture";

const ORG = "55555555-5555-5555-5555-555555555555";
const DELIB = "aaaaaaaa-1111-2222-3333-444444444444";
const ANOMALY = "bbbbbbbb-1111-2222-3333-555555555555";
const ASSET = "cccccccc-1111-2222-3333-666666666666";

// ------------------------------------------------------------
// Inline supabase mock — only handles the tables predictionCapture
// touches: cd_deliberation_log (select), cd_deliberation_predictions
// (select count + insert), cd_anomaly_consequence_assessments (select),
// cd_causal_chains (select with .contains), cd_asset_anomalies (select).
// ------------------------------------------------------------

interface MockState {
  deliberation: Record<string, unknown> | null;
  predictions: Array<Record<string, unknown>>;
  consequenceByDelib: Array<Record<string, unknown>>;
  consequenceByAnomaly: Array<Record<string, unknown>>;
  causalChains: Array<Record<string, unknown>>;
  anomaly: Record<string, unknown> | null;
  forcePredictionInsertError: boolean;
  // Sprint 4 Polish 2 (Fix 1): simulate the production-observed
  // "insert succeeded but RETURNING came back empty" case. When true,
  // cd_deliberation_predictions inserts resolve with data:null /
  // error:null (no row, no error), pushing the empty-prediction_id
  // path in captureDeliberationPrediction.
  forcePredictionInsertEmptyReturn?: boolean;
}

function makeSupabase(state: MockState): unknown {
  return {
    from(table: string) {
      return {
        _table: table,
        _filters: [] as Array<(r: Record<string, unknown>) => boolean>,
        _isInsert: false,
        _insertPayload: null as unknown,
        _selectChained: false,
        _isMaybeSingle: false,
        _orderCol: null as string | null,
        _orderAsc: true,
        _limit: null as number | null,
        select(_cols?: string) {
          this._selectChained = true;
          return this;
        },
        insert(payload: unknown) {
          this._isInsert = true;
          this._insertPayload = payload;
          return this;
        },
        update(_payload: unknown) {
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
        contains(col: string, vals: unknown[]) {
          const set = new Set(vals);
          this._filters.push((r) => {
            const arr = r[col];
            if (!Array.isArray(arr)) return false;
            return vals.every((v) => arr.includes(v));
          });
          return this;
        },
        order(col: string, opts?: { ascending?: boolean }) {
          this._orderCol = col;
          this._orderAsc = opts?.ascending !== false;
          return this;
        },
        limit(n: number) {
          this._limit = n;
          return this;
        },
        maybeSingle() {
          this._isMaybeSingle = true;
          return this;
        },
        then(onFulfilled: (v: unknown) => unknown) {
          if (this._isInsert) {
            if (
              this._table === "cd_deliberation_predictions" &&
              state.forcePredictionInsertError
            ) {
              return Promise.resolve({
                data: null,
                error: { message: "simulated insert failure" },
              }).then(onFulfilled);
            }
            const payload = this._insertPayload as Record<string, unknown>;
            const id = (payload.id as string) ?? `mock-pred-${Math.random()}`;
            const row = { id, ...payload };
            if (this._table === "cd_deliberation_predictions") {
              state.predictions.push(row);
              // Sprint 4 Polish 2 (Fix 1): simulate the production-observed
              // "insert succeeded but RETURNING returned no row" case.
              if (state.forcePredictionInsertEmptyReturn) {
                return Promise.resolve({ data: null, error: null }).then(
                  onFulfilled
                );
              }
            }
            // Insert + .select().maybeSingle() returns the inserted row.
            return Promise.resolve({ data: { id }, error: null }).then(
              onFulfilled
            );
          }
          // SELECT
          const apply = (
            rows: Record<string, unknown>[]
          ): Record<string, unknown>[] => {
            let r = rows.filter((row) => this._filters.every((f) => f(row)));
            if (this._orderCol) {
              const col = this._orderCol;
              const asc = this._orderAsc;
              r = [...r].sort((a, b) => {
                const av = a[col] as string | number;
                const bv = b[col] as string | number;
                if (av === bv) return 0;
                return (av > bv ? 1 : -1) * (asc ? 1 : -1);
              });
            }
            if (this._limit !== null) r = r.slice(0, this._limit);
            return r;
          };

          if (this._table === "cd_deliberation_log") {
            const rows = state.deliberation ? [state.deliberation] : [];
            const filtered = apply(rows);
            return Promise.resolve({
              data: this._isMaybeSingle ? filtered[0] ?? null : filtered,
              error: null,
            }).then(onFulfilled);
          }
          if (this._table === "cd_deliberation_predictions") {
            const filtered = apply(state.predictions);
            return Promise.resolve({
              data: this._isMaybeSingle ? filtered[0] ?? null : filtered,
              error: null,
            }).then(onFulfilled);
          }
          if (this._table === "cd_anomaly_consequence_assessments") {
            // Distinguish "byDelib" filter vs "byAnomaly" by checking
            // which filter the caller put on. The caller uses .eq on
            // either deliberation_id OR anomaly_id. We expose both via
            // separate state arrays so tests can opt in.
            // Test the predicate set by reading filtered output from
            // BOTH lists and picking the one whose filters match.
            const byDelibFiltered = apply(state.consequenceByDelib);
            if (byDelibFiltered.length > 0) {
              return Promise.resolve({
                data: this._isMaybeSingle
                  ? byDelibFiltered[0]
                  : byDelibFiltered,
                error: null,
              }).then(onFulfilled);
            }
            const byAnomFiltered = apply(state.consequenceByAnomaly);
            return Promise.resolve({
              data: this._isMaybeSingle
                ? byAnomFiltered[0] ?? null
                : byAnomFiltered,
              error: null,
            }).then(onFulfilled);
          }
          if (this._table === "cd_causal_chains") {
            const filtered = apply(state.causalChains);
            return Promise.resolve({
              data: this._isMaybeSingle ? filtered[0] ?? null : filtered,
              error: null,
            }).then(onFulfilled);
          }
          if (this._table === "cd_asset_anomalies") {
            const rows = state.anomaly ? [state.anomaly] : [];
            const filtered = apply(rows);
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

function freshState(over: Partial<MockState> = {}): MockState {
  return {
    deliberation: {
      id: DELIB,
      org_id: ORG,
      finding_id: ANOMALY,
      finding_type: "cd_asset_anomaly",
      consensus_level: "unanimous",
      deliberation_completed_at: new Date().toISOString(),
      total_cost_usd: 0.9,
    },
    predictions: [],
    consequenceByDelib: [
      {
        id: "cons-1",
        org_id: ORG,
        deliberation_id: DELIB,
        anomaly_id: ANOMALY,
        asset_id: ASSET,
        overall_tier: "severe",
        recommended_action_tier: "immediate_remediation",
        time_to_consequence_days: 120,
        total_confidence: 0.74,
        created_at: new Date().toISOString(),
      },
    ],
    consequenceByAnomaly: [],
    causalChains: [
      {
        // Sprint 4 Polish (Fix B): production shape — asset_id present,
        // linked_mechanisms entries match what causalChainEngine writes
        // ({mechanism_key, display_name, fit_score, reasoning}), title
        // present for fallback parsing.
        id: "cc-1",
        org_id: ORG,
        asset_id: ASSET,
        title: "Causal chain for anomaly: Pitting Corrosion",
        linked_anomaly_ids: [ANOMALY],
        linked_mechanisms: [
          {
            mechanism_key: "pitting_corrosion",
            display_name: "Pitting Corrosion",
            fit_score: 0.85,
            reasoning: "primary",
          },
        ],
        created_at: new Date().toISOString(),
      },
    ],
    anomaly: { id: ANOMALY, org_id: ORG, asset_id: ASSET },
    forcePredictionInsertError: false,
    ...over,
  };
}

describe("captureDeliberationPrediction — happy path", () => {
  it("INSERTs a prediction row with all fields populated", async () => {
    const state = freshState();
    const supabase = makeSupabase(state);
    const r = await captureDeliberationPrediction(
      DELIB,
      ORG,
      supabase as never
    );
    assert.equal(r.ok, true, r.error ?? "");
    assert.equal(state.predictions.length, 1);
    const row = state.predictions[0];
    assert.equal(row.org_id, ORG);
    assert.equal(row.deliberation_id, DELIB);
    assert.equal(row.anomaly_id, ANOMALY);
    assert.equal(row.asset_id, ASSET);
    assert.equal(row.consensus_level, "unanimous");
    assert.equal(row.primary_mechanism, "pitting_corrosion");
    assert.equal(row.consequence_overall_tier, "severe");
    assert.equal(row.recommended_action_tier, "immediate_remediation");
    assert.equal(row.time_to_consequence_days, 120);
    assert.equal(row.total_confidence, 0.74);
  });
});

describe("captureDeliberationPrediction — idempotency", () => {
  it("rerun returns existing prediction_id with already_captured note, no second insert", async () => {
    const state = freshState();
    const supabase = makeSupabase(state);
    const first = await captureDeliberationPrediction(
      DELIB,
      ORG,
      supabase as never
    );
    assert.equal(first.ok, true);
    assert.equal(state.predictions.length, 1);

    const second = await captureDeliberationPrediction(
      DELIB,
      ORG,
      supabase as never
    );
    assert.equal(second.ok, true);
    assert.equal(second.note, "already_captured");
    assert.equal(state.predictions.length, 1);
  });
});

describe("captureDeliberationPrediction — consensus unresolved", () => {
  it("returns ok:false with note=consensus_unresolved_skipped, no insert", async () => {
    const state = freshState();
    state.deliberation!.consensus_level = "unresolved";
    const supabase = makeSupabase(state);
    const r = await captureDeliberationPrediction(
      DELIB,
      ORG,
      supabase as never
    );
    assert.equal(r.ok, false);
    assert.equal(r.note, "consensus_unresolved_skipped");
    assert.equal(state.predictions.length, 0);
  });
});

describe("captureDeliberationPrediction — missing sibling rows", () => {
  it("consequence row absent → capture proceeds with consequence fields null", async () => {
    const state = freshState();
    state.consequenceByDelib = [];
    state.consequenceByAnomaly = [];
    const supabase = makeSupabase(state);
    const r = await captureDeliberationPrediction(
      DELIB,
      ORG,
      supabase as never
    );
    assert.equal(r.ok, true, r.error ?? "");
    assert.equal(state.predictions.length, 1);
    const row = state.predictions[0];
    assert.equal(row.consequence_overall_tier, null);
    assert.equal(row.recommended_action_tier, null);
    assert.equal(row.time_to_consequence_days, null);
    assert.equal(row.total_confidence, null);
    // asset_id still resolved via cd_asset_anomalies fallback
    assert.equal(row.asset_id, ASSET);
  });

  it("causal chain row absent → primary_mechanism null, capture still succeeds", async () => {
    const state = freshState();
    state.causalChains = [];
    const supabase = makeSupabase(state);
    const r = await captureDeliberationPrediction(
      DELIB,
      ORG,
      supabase as never
    );
    assert.equal(r.ok, true);
    assert.equal(state.predictions[0].primary_mechanism, null);
  });
});

describe("captureDeliberationPrediction — INSERT error", () => {
  it("ok:false with error preserved, no throw", async () => {
    const state = freshState();
    state.forcePredictionInsertError = true;
    const supabase = makeSupabase(state);
    const r = await captureDeliberationPrediction(
      DELIB,
      ORG,
      supabase as never
    );
    assert.equal(r.ok, false);
    assert.ok(
      r.error && r.error.includes("simulated insert failure"),
      `error=${r.error}`
    );
  });
});

// ============================================================
// Sprint 4 Polish — Fix B: primary_mechanism extraction
// ============================================================

describe("Fix B — primary_mechanism extraction from production shape", () => {
  it("extracts mechanism_key from linked_mechanisms (production shape)", async () => {
    const state = freshState();
    const supabase = makeSupabase(state);
    const r = await captureDeliberationPrediction(
      DELIB,
      ORG,
      supabase as never
    );
    assert.equal(r.ok, true);
    assert.equal(
      state.predictions[0].primary_mechanism,
      "pitting_corrosion"
    );
  });

  it("picks highest fit_score when linked_mechanisms is unsorted", async () => {
    const state = freshState();
    state.causalChains = [
      {
        id: "cc-multi",
        org_id: ORG,
        asset_id: ASSET,
        title: "Causal chain for anomaly: Underfilm Corrosion",
        linked_anomaly_ids: [ANOMALY],
        // Sort defensively: alternative first by array order, primary
        // second — extractor should pick the higher fit_score.
        linked_mechanisms: [
          {
            mechanism_key: "general_corrosion",
            display_name: "General Corrosion",
            fit_score: 0.4,
          },
          {
            mechanism_key: "pitting_corrosion",
            display_name: "Pitting Corrosion",
            fit_score: 0.85,
          },
          {
            mechanism_key: "underfilm_corrosion",
            display_name: "Underfilm Corrosion",
            fit_score: 0.6,
          },
        ],
        created_at: new Date().toISOString(),
      },
    ];
    const supabase = makeSupabase(state);
    const r = await captureDeliberationPrediction(
      DELIB,
      ORG,
      supabase as never
    );
    assert.equal(r.ok, true);
    assert.equal(
      state.predictions[0].primary_mechanism,
      "pitting_corrosion",
      "highest fit_score (0.85) should win"
    );
  });

  it("title fallback: empty linked_mechanisms → parse display name from title", async () => {
    const state = freshState();
    state.causalChains = [
      {
        id: "cc-empty",
        org_id: ORG,
        asset_id: ASSET,
        title: "Causal chain for anomaly: Pitting Corrosion",
        linked_anomaly_ids: [ANOMALY],
        linked_mechanisms: [],
        created_at: new Date().toISOString(),
      },
    ];
    const supabase = makeSupabase(state);
    const r = await captureDeliberationPrediction(
      DELIB,
      ORG,
      supabase as never
    );
    assert.equal(r.ok, true);
    assert.equal(
      state.predictions[0].primary_mechanism,
      "pitting_corrosion",
      "title 'Pitting Corrosion' should snake_case to pitting_corrosion"
    );
  });

  it("no chain at all → primary_mechanism null, capture still succeeds", async () => {
    const state = freshState();
    state.causalChains = [];
    const supabase = makeSupabase(state);
    const r = await captureDeliberationPrediction(
      DELIB,
      ORG,
      supabase as never
    );
    assert.equal(r.ok, true);
    assert.equal(state.predictions[0].primary_mechanism, null);
  });
});

// ============================================================
// Sprint 4 Polish 2 — Fix 1: regression guards for the silent-skip
// production bug. Deliberation 4fb6cf2c-... completed with consensus
// majority_with_dissent but produced no row in cd_deliberation_predictions
// AND no arbitration_rules_applied.prediction_capture_error. These tests
// pin the specific behaviors that prevent that from happening again.
// ============================================================

describe("Fix 1 — no anomaly-matching chain → null mechanism, NOT silent contamination from foreign chain", () => {
  it("asset has a chain for a DIFFERENT anomaly → capture proceeds with primary_mechanism null, not the wrong mechanism", async () => {
    const state = freshState();
    state.causalChains = [
      {
        id: "cc-foreign",
        org_id: ORG,
        asset_id: ASSET,
        title: "Causal chain for OTHER anomaly: General Corrosion",
        linked_anomaly_ids: ["some-other-anomaly-uuid"],
        linked_mechanisms: [
          {
            mechanism_key: "general_corrosion",
            display_name: "General Corrosion",
            fit_score: 0.7,
          },
        ],
        created_at: new Date().toISOString(),
      },
    ];
    const supabase = makeSupabase(state);
    const r = await captureDeliberationPrediction(
      DELIB,
      ORG,
      supabase as never
    );
    assert.equal(r.ok, true, r.error ?? "");
    assert.equal(state.predictions.length, 1);
    // CRITICAL: must be null, NOT general_corrosion from the foreign chain.
    // Pre-Polish-2 the rows[0] fallback in loadLatestCausalChain would
    // have returned that foreign chain and capture would have written
    // general_corrosion as THIS deliberation's primary_mechanism.
    assert.equal(
      state.predictions[0].primary_mechanism,
      null,
      "must not silently inherit a mechanism from another anomaly's chain on the same asset"
    );
    // All other fields populated normally — capture didn't abort.
    assert.equal(state.predictions[0].consensus_level, "unanimous");
    assert.equal(state.predictions[0].consequence_overall_tier, "severe");
  });
});

describe("Fix 1 — empty prediction_id from insert is treated as failure, not silent ok:true", () => {
  it("insert returns success but RETURNING is empty → ok:false with explanatory error", async () => {
    const state = freshState();
    state.forcePredictionInsertEmptyReturn = true;
    const supabase = makeSupabase(state);
    const r = await captureDeliberationPrediction(
      DELIB,
      ORG,
      supabase as never
    );
    assert.equal(
      r.ok,
      false,
      "empty RETURNING must be surfaced as failure, NOT silent ok:true"
    );
    assert.ok(
      r.error && r.error.includes("prediction_insert_returned_no_row"),
      `error must explain the silent-insert case; got: ${r.error}`
    );
    // Confirm we did NOT short-circuit before the insert (the row was
    // pushed to state.predictions by the mock, even though the
    // RETURNING came back empty).
    assert.equal(state.predictions.length, 1);
  });
});
