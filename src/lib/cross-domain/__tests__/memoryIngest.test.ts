// ============================================================
// Sprint 4A — memoryIngest tests
//
// Coverage:
//   - happy path: 1 summary + 2 high-confidence claims → 3 rows inserted
//   - claims below confidence floor are skipped
//   - idempotency: a second call after the same deliberation already
//     ingested → rows_inserted: 0, note: already_ingested
//   - consensus 'unresolved' is skipped (note: consensus_unresolved_skipped)
//   - one claim embed failure → ingest continues, partial success
// ============================================================

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { ingestDeliberationMemory } from "../memoryIngest";

const ORG = "11111111-1111-1111-1111-111111111111";
const DELIB_ID = "deadbeef-1234-5678-9012-aaaaaaaaaaaa";
const FINDING_ID = "feedface-aaaa-bbbb-cccc-111111111111";
const ASSET_ID = "cafebabe-aaaa-bbbb-cccc-222222222222";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_OPENAI = process.env.OPENAI_API_KEY;
const ORIGINAL_RETRY_BASE = process.env.CROSS_DOMAIN_RETRY_BASE_MS;

function installEmbeddingFetchMock(failOnNthCall: number | null = null) {
  let callCount = 0;
  process.env.OPENAI_API_KEY = "test-openai-key";
  process.env.CROSS_DOMAIN_RETRY_BASE_MS = "1";
  globalThis.fetch = (async () => {
    callCount++;
    if (failOnNthCall !== null && callCount === failOnNthCall) {
      return new Response(JSON.stringify({ error: "boom" }), { status: 400 });
    }
    return new Response(
      JSON.stringify({
        data: [{ embedding: new Array(1536).fill(0.01) }],
        usage: { prompt_tokens: 42 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = ORIGINAL_FETCH;
  if (ORIGINAL_OPENAI === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = ORIGINAL_OPENAI;
  if (ORIGINAL_RETRY_BASE === undefined)
    delete process.env.CROSS_DOMAIN_RETRY_BASE_MS;
  else process.env.CROSS_DOMAIN_RETRY_BASE_MS = ORIGINAL_RETRY_BASE;
}

// ------------------------------------------------------------
// Targeted in-memory Supabase mock — covers exactly the surface
// area memoryIngest touches.
// ------------------------------------------------------------

interface MockState {
  deliberation: {
    id: string;
    org_id: string;
    finding_id: string | null;
    deliberation_completed_at: string | null;
    consensus_level: string | null;
    synthesizer_decision: unknown;
  } | null;
  anomaly: {
    id: string;
    org_id: string;
    asset_id: string;
  } | null;
  memoryRows: Array<Record<string, unknown>>;
  costLogRows: Array<Record<string, unknown>>;
}

function makeIngestMockSupabase(state: MockState): unknown {
  const insertFailures = new Map<string, boolean>();
  // Allow tests to mark a table's insert as failing.
  const api = {
    __state: state,
    __markInsertFailure(table: string): void {
      insertFailures.set(table, true);
    },
    from(table: string) {
      const q = {
        _table: table,
        _filters: [] as Array<(r: Record<string, unknown>) => boolean>,
        _isInsert: false,
        _insertPayload: null as unknown,
        _mode: "list" as "list" | "maybeSingle",
        select(_cols?: string) {
          return this;
        },
        insert(payload: unknown) {
          this._isInsert = true;
          this._insertPayload = payload;
          return this;
        },
        eq(col: string, val: unknown) {
          // Support JSON path equality: context_jsonb->>key
          const m = col.match(/^([a-z_]+)->>(.+)$/);
          if (m) {
            const root = m[1];
            const key = m[2];
            this._filters.push((r) => {
              const j = r[root] as Record<string, unknown> | undefined;
              return j != null && j[key] === val;
            });
          } else {
            this._filters.push((r) => r[col] === val);
          }
          return this;
        },
        in(col: string, vals: unknown[]) {
          const set = new Set(vals);
          this._filters.push((r) => set.has(r[col]));
          return this;
        },
        maybeSingle() {
          this._mode = "maybeSingle";
          return this;
        },
        then(onFulfilled: (v: unknown) => unknown) {
          return Promise.resolve(this._exec()).then(onFulfilled);
        },
        _exec() {
          if (this._isInsert) {
            if (insertFailures.get(this._table)) {
              return { data: null, error: { message: "forced insert failure" } };
            }
            if (this._table === "cd_tenant_memory_index") {
              const rows = Array.isArray(this._insertPayload)
                ? (this._insertPayload as Array<Record<string, unknown>>)
                : [this._insertPayload as Record<string, unknown>];
              for (const r of rows) state.memoryRows.push({ ...r });
              return { data: null, error: null };
            }
            if (this._table === "ai_cost_log") {
              state.costLogRows.push(
                this._insertPayload as Record<string, unknown>
              );
              return { data: null, error: null };
            }
            return { data: null, error: null };
          }
          // SELECT path
          if (this._table === "cd_deliberation_log") {
            const rows = state.deliberation ? [state.deliberation] : [];
            const filtered = rows.filter((r) =>
              this._filters.every((f) => f(r as Record<string, unknown>))
            );
            if (this._mode === "maybeSingle") {
              return { data: filtered[0] ?? null, error: null };
            }
            return { data: filtered, error: null };
          }
          if (this._table === "cd_tenant_memory_index") {
            const filtered = state.memoryRows.filter((r) =>
              this._filters.every((f) => f(r))
            );
            if (this._mode === "maybeSingle") {
              return { data: filtered[0] ?? null, error: null };
            }
            return { data: filtered, error: null };
          }
          if (this._table === "cd_asset_anomalies") {
            const rows = state.anomaly ? [state.anomaly] : [];
            const filtered = rows.filter((r) =>
              this._filters.every((f) => f(r as Record<string, unknown>))
            );
            if (this._mode === "maybeSingle") {
              return { data: filtered[0] ?? null, error: null };
            }
            return { data: filtered, error: null };
          }
          return { data: [], error: null };
        },
      };
      return q;
    },
  };
  return api;
}

function makeSynthDecision(
  claims: Array<{ text: string; confidence: number }>,
  summary = "Synthesizer headline summary."
): unknown {
  return {
    summary,
    claims: claims.map((c) => ({
      text: c.text,
      confidence: c.confidence,
      supporting_evidence_ids: ["ev-1"],
      cited_mechanism_codes: ["pitting_corrosion"],
    })),
    cited_mechanisms: ["pitting_corrosion"],
    cited_evidence: ["ev-1"],
  };
}

function freshState(overrides: Partial<MockState> = {}): MockState {
  return {
    deliberation: {
      id: DELIB_ID,
      org_id: ORG,
      finding_id: FINDING_ID,
      deliberation_completed_at: new Date().toISOString(),
      consensus_level: "unanimous",
      synthesizer_decision: makeSynthDecision([
        { text: "Pitting consistent with chloride exposure.", confidence: 0.85 },
        { text: "Wall loss exceeds 20% nominal.", confidence: 0.72 },
        { text: "Possible MIC contribution.", confidence: 0.3 },
      ]),
    },
    anomaly: { id: FINDING_ID, org_id: ORG, asset_id: ASSET_ID },
    memoryRows: [],
    costLogRows: [],
    ...overrides,
  };
}

describe("memoryIngest — happy path", () => {
  beforeEach(() => installEmbeddingFetchMock());
  afterEach(restoreFetch);

  it("inserts 1 summary + 2 high-confidence claims; skips low-confidence claim", async () => {
    const state = freshState();
    const supabase = makeIngestMockSupabase(state);
    const result = await ingestDeliberationMemory(
      DELIB_ID,
      ORG,
      supabase as never
    );
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.rows_inserted, 3);
    assert.equal(state.memoryRows.length, 3);
    // Validate row shape
    const summaryRow = state.memoryRows.find(
      (r) =>
        (r.context_jsonb as Record<string, unknown>).record_type ===
        "synthesis_summary"
    );
    assert.ok(summaryRow, "summary row should be present");
    assert.equal(summaryRow!.org_id, ORG);
    assert.equal(summaryRow!.memory_type, "analogous_case");
    assert.equal(summaryRow!.anomaly_id, FINDING_ID);
    assert.equal(summaryRow!.asset_id, ASSET_ID);
    assert.equal((summaryRow!.embedding as number[]).length, 1536);
    assert.equal(
      (summaryRow!.context_jsonb as Record<string, unknown>).deliberation_id,
      DELIB_ID
    );

    const claimRows = state.memoryRows.filter(
      (r) =>
        (r.context_jsonb as Record<string, unknown>).record_type ===
        "specialist_claim"
    );
    assert.equal(claimRows.length, 2, "low-confidence claim must be skipped");
    for (const c of claimRows) {
      const ctx = c.context_jsonb as Record<string, unknown>;
      assert.ok(typeof ctx.confidence === "number");
      assert.ok((ctx.confidence as number) >= 0.5);
    }
    assert.ok(result.total_cost_usd >= 0);
  });
});

describe("memoryIngest — idempotency", () => {
  beforeEach(() => installEmbeddingFetchMock());
  afterEach(restoreFetch);

  it("second call after successful ingest returns rows_inserted: 0 with already_ingested note", async () => {
    const state = freshState();
    const supabase = makeIngestMockSupabase(state);
    const first = await ingestDeliberationMemory(
      DELIB_ID,
      ORG,
      supabase as never
    );
    assert.equal(first.ok, true);
    assert.ok(first.rows_inserted > 0);

    const second = await ingestDeliberationMemory(
      DELIB_ID,
      ORG,
      supabase as never
    );
    assert.equal(second.rows_inserted, 0);
    assert.equal(second.note, "already_ingested");
    // Memory rows unchanged
    assert.equal(state.memoryRows.length, first.rows_inserted);
  });
});

describe("memoryIngest — unresolved consensus", () => {
  beforeEach(() => installEmbeddingFetchMock());
  afterEach(restoreFetch);

  it("consensus_level === 'unresolved' → returns early, no rows", async () => {
    const state = freshState();
    state.deliberation!.consensus_level = "unresolved";
    const supabase = makeIngestMockSupabase(state);
    const result = await ingestDeliberationMemory(
      DELIB_ID,
      ORG,
      supabase as never
    );
    assert.equal(result.rows_inserted, 0);
    assert.equal(result.note, "consensus_unresolved_skipped");
    assert.equal(state.memoryRows.length, 0);
  });
});

describe("memoryIngest — partial failure", () => {
  afterEach(restoreFetch);

  it("one embed call fails → ingest continues, returns partial success with errors", async () => {
    // 1 summary call + 2 claim calls = 3 embed calls. Fail the 2nd
    // (first claim) so summary + last claim still succeed.
    installEmbeddingFetchMock(2);
    const state = freshState();
    const supabase = makeIngestMockSupabase(state);
    const result = await ingestDeliberationMemory(
      DELIB_ID,
      ORG,
      supabase as never
    );
    // Two rows inserted (summary + 2nd high-conf claim), 1 error logged
    assert.equal(result.rows_inserted, 2, JSON.stringify(result));
    assert.equal(state.memoryRows.length, 2);
    assert.ok(result.errors.length >= 1, "at least one error expected");
    assert.equal(result.ok, true, "partial insert still counts as ok");
  });
});
