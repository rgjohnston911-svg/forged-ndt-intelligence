// ============================================================
// Sprint 4A — memoryRetrieval tests
//
// Coverage:
//   - happy path: rpc returns 3 rows → 3 AnalogousCase[] with
//     similarity preserved, deliberation hydration applied
//   - empty result (cold-start) → ok:true, cases:[]
//   - excludeDeliberationId filters out the caller's own rows
// ============================================================

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { retrieveAnalogousCases } from "../memoryRetrieval";

const ORG = "22222222-2222-2222-2222-222222222222";
const PRIOR_DELIB = "11111111-1111-1111-1111-111111111111";
const SELF_DELIB = "33333333-3333-3333-3333-333333333333";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_OPENAI = process.env.OPENAI_API_KEY;
const ORIGINAL_RETRY_BASE = process.env.CROSS_DOMAIN_RETRY_BASE_MS;

function installEmbeddingFetchMock() {
  process.env.OPENAI_API_KEY = "test-openai-key";
  process.env.CROSS_DOMAIN_RETRY_BASE_MS = "1";
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        data: [{ embedding: new Array(1536).fill(0.02) }],
        usage: { prompt_tokens: 30 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )) as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = ORIGINAL_FETCH;
  if (ORIGINAL_OPENAI === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = ORIGINAL_OPENAI;
  if (ORIGINAL_RETRY_BASE === undefined)
    delete process.env.CROSS_DOMAIN_RETRY_BASE_MS;
  else process.env.CROSS_DOMAIN_RETRY_BASE_MS = ORIGINAL_RETRY_BASE;
}

interface RetrievalState {
  rpcRows: Array<Record<string, unknown>>;
  deliberations: Array<{
    id: string;
    org_id: string;
    consensus_level: string;
    synthesizer_decision: { summary?: string } | null;
  }>;
}

function makeRetrievalMockSupabase(state: RetrievalState): unknown {
  return {
    rpc(_name: string, _params: Record<string, unknown>) {
      return Promise.resolve({ data: state.rpcRows, error: null });
    },
    from(table: string) {
      const q = {
        _filters: [] as Array<(r: Record<string, unknown>) => boolean>,
        _isInsert: false,
        select(_cols?: string) {
          return this;
        },
        insert(_payload: unknown) {
          this._isInsert = true;
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
        maybeSingle() {
          return this;
        },
        then(onFulfilled: (v: unknown) => unknown) {
          if (this._isInsert) {
            return Promise.resolve({ data: null, error: null }).then(
              onFulfilled
            );
          }
          if (table === "cd_deliberation_log") {
            const filtered = state.deliberations.filter((r) =>
              this._filters.every((f) => f(r as unknown as Record<string, unknown>))
            );
            return Promise.resolve({ data: filtered, error: null }).then(
              onFulfilled
            );
          }
          return Promise.resolve({ data: [], error: null }).then(onFulfilled);
        },
      };
      return q;
    },
  };
}

function row(
  deliberation_id: string,
  similarity: number,
  text: string,
  cited: string[],
  recordType = "specialist_claim"
): Record<string, unknown> {
  return {
    id: `row-${deliberation_id}-${similarity}`,
    org_id: ORG,
    memory_type: "analogous_case",
    asset_id: "asset-1",
    anomaly_id: "anomaly-1",
    summary: text,
    context_jsonb: {
      deliberation_id,
      record_type: recordType,
      cited_mechanisms: cited,
      cited_evidence_ids: [],
    },
    similarity,
    created_at: new Date("2026-04-01").toISOString(),
  };
}

const PRIOR_DELIB_2 = "44444444-4444-4444-4444-444444444444";

describe("memoryRetrieval — happy path", () => {
  beforeEach(installEmbeddingFetchMock);
  afterEach(restoreFetch);

  it("returns AnalogousCase[] sized to topK with hydrated prior consensus", async () => {
    const state: RetrievalState = {
      rpcRows: [
        row(PRIOR_DELIB, 0.92, "Pitting confirmed by callout.", [
          "pitting_corrosion",
        ]),
        row(PRIOR_DELIB, 0.81, "Wall loss > 20%.", ["pitting_corrosion"]),
        row(PRIOR_DELIB_2, 0.74, "Adjacent weld had similar exposure.", [
          "weld_toe_cracking",
        ]),
      ],
      deliberations: [
        {
          id: PRIOR_DELIB,
          org_id: ORG,
          consensus_level: "unanimous",
          synthesizer_decision: { summary: "Prior synth summary A" },
        },
        {
          id: PRIOR_DELIB_2,
          org_id: ORG,
          consensus_level: "majority_with_dissent",
          synthesizer_decision: { summary: "Prior synth summary B" },
        },
      ],
    };
    const supabase = makeRetrievalMockSupabase(state);

    const r = await retrieveAnalogousCases(
      {
        anomalyDescription: "Localized wall loss near weld",
        assetContext: "Riser, subsea, carbon_steel",
        citedMechanisms: ["pitting_corrosion"],
        org_id: ORG,
        topK: 3,
      },
      supabase as never
    );
    assert.equal(r.ok, true, r.error ?? "");
    assert.equal(r.cases.length, 3);
    // Highest similarity first (rpc preserves order)
    assert.equal(r.cases[0].similarity, 0.92);
    assert.equal(r.cases[0].source_deliberation_id, PRIOR_DELIB);
    assert.deepEqual(r.cases[0].cited_mechanisms, ["pitting_corrosion"]);
    assert.equal(r.cases[0].record_type, "specialist_claim");
    // Hydration applied
    assert.equal(
      (r.cases[0].metadata as Record<string, unknown>).prior_consensus_level,
      "unanimous"
    );
    assert.equal(
      (r.cases[0].metadata as Record<string, unknown>).prior_synthesizer_summary,
      "Prior synth summary A"
    );
  });
});

describe("memoryRetrieval — cold start", () => {
  beforeEach(installEmbeddingFetchMock);
  afterEach(restoreFetch);

  it("empty rpc result → ok:true, cases:[], no error", async () => {
    const state: RetrievalState = { rpcRows: [], deliberations: [] };
    const supabase = makeRetrievalMockSupabase(state);
    const r = await retrieveAnalogousCases(
      {
        anomalyDescription: "anything",
        assetContext: "anything",
        citedMechanisms: [],
        org_id: ORG,
      },
      supabase as never
    );
    assert.equal(r.ok, true);
    assert.equal(r.cases.length, 0);
    assert.equal(r.error, undefined);
  });
});

describe("memoryRetrieval — self-match filter", () => {
  beforeEach(installEmbeddingFetchMock);
  afterEach(restoreFetch);

  it("excludeDeliberationId removes the current deliberation's rows", async () => {
    const state: RetrievalState = {
      rpcRows: [
        row(SELF_DELIB, 0.99, "Self match — must be filtered.", [
          "pitting_corrosion",
        ]),
        row(PRIOR_DELIB, 0.85, "Real prior match.", ["pitting_corrosion"]),
        row(PRIOR_DELIB_2, 0.80, "Another prior match.", ["weld_toe_cracking"]),
      ],
      deliberations: [
        {
          id: PRIOR_DELIB,
          org_id: ORG,
          consensus_level: "unanimous",
          synthesizer_decision: { summary: "A" },
        },
        {
          id: PRIOR_DELIB_2,
          org_id: ORG,
          consensus_level: "unanimous",
          synthesizer_decision: { summary: "B" },
        },
      ],
    };
    const supabase = makeRetrievalMockSupabase(state);
    const r = await retrieveAnalogousCases(
      {
        anomalyDescription: "x",
        assetContext: "y",
        citedMechanisms: [],
        org_id: ORG,
        topK: 5,
        excludeDeliberationId: SELF_DELIB,
      },
      supabase as never
    );
    assert.equal(r.ok, true);
    // Self-row filtered out → exactly 2 results remain
    assert.equal(r.cases.length, 2);
    for (const c of r.cases) {
      assert.notEqual(c.source_deliberation_id, SELF_DELIB);
    }
  });
});
