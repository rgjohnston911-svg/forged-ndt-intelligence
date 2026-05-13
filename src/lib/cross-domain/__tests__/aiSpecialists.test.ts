import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  callInspector,
  callEngineer,
  callResearcher,
  callDevilsAdvocate,
  callHistorian,
  callSynthesizer,
  SPECIALIST_SPECS,
} from "../aiSpecialists";
import { makeMockSupabase } from "./fixtures";

const ORG = "22222222-2222-2222-2222-222222222222";

const ROLES = [
  ["inspector", callInspector, "claude-sonnet-4-6", "cross_domain:inspector"],
  ["engineer", callEngineer, "claude-opus-4-6", "cross_domain:engineer"],
  ["researcher", callResearcher, "claude-sonnet-4-6", "cross_domain:researcher"],
  ["devils_advocate", callDevilsAdvocate, "gpt-4o", "cross_domain:devils_advocate"],
  ["historian", callHistorian, "claude-sonnet-4-6", "cross_domain:historian"],
  ["synthesizer", callSynthesizer, "claude-opus-4-6", "cross_domain:synthesizer"],
] as const;

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

interface FetchCall {
  url: string;
  init: FetchInit;
}

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const ORIGINAL_OPENAI_KEY = process.env.OPENAI_API_KEY;
const ORIGINAL_RETRY_BASE = process.env.CROSS_DOMAIN_RETRY_BASE_MS;

let fetchCalls: FetchCall[] = [];

function installFetchMock() {
  fetchCalls = [];
  process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
  process.env.OPENAI_API_KEY = "test-openai-key";
  // Collapse 1s/2s/4s schedule to ~1/2/4ms for fast tests.
  process.env.CROSS_DOMAIN_RETRY_BASE_MS = "1";
  globalThis.fetch = (async (input: FetchInput, init?: FetchInit) => {
    const url = typeof input === "string" ? input : (input as URL | Request).toString();
    fetchCalls.push({ url, init });
    if (url.includes("api.anthropic.com")) {
      return new Response(
        JSON.stringify({
          id: "msg_test_123",
          content: [{ type: "text", text: "OK" }],
          usage: { input_tokens: 12, output_tokens: 1 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (url.includes("api.openai.com")) {
      return new Response(
        JSON.stringify({
          id: "resp_test_123",
          output_text: "OK",
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "OK" }],
            },
          ],
          usage: { input_tokens: 8, output_tokens: 1 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(JSON.stringify({ error: "unmocked" }), { status: 500 });
  }) as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = ORIGINAL_FETCH;
  if (ORIGINAL_ANTHROPIC_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = ORIGINAL_ANTHROPIC_KEY;
  if (ORIGINAL_OPENAI_KEY === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = ORIGINAL_OPENAI_KEY;
  if (ORIGINAL_RETRY_BASE === undefined) delete process.env.CROSS_DOMAIN_RETRY_BASE_MS;
  else process.env.CROSS_DOMAIN_RETRY_BASE_MS = ORIGINAL_RETRY_BASE;
}

describe("AI specialist wrappers — happy path", () => {
  beforeEach(installFetchMock);
  afterEach(restoreFetch);

  for (const [role, fn, expectedModel, expectedCode] of ROLES) {
    it(`${role}: returns ok with correct model + code_name + response`, async () => {
      const out = await fn(`test prompt for ${role}`);
      assert.equal(out.ok, true, out.error ?? "");
      assert.equal(out.role, role);
      assert.equal(out.model, expectedModel);
      assert.equal(out.cost.code_name, expectedCode);
      assert.equal(out.cost.smoke_test, true);
      assert.equal(out.response, "OK");
      assert.equal(typeof out.latency_ms, "number");
      assert.equal(out.attempts, 1);
      assert.ok(out.cost.cost_usd >= 0);
    });
  }

  it("anthropic wrappers hit /v1/messages with x-api-key and version header", async () => {
    await callInspector("hi");
    const call = fetchCalls.find((c) => c.url.includes("anthropic.com"));
    assert.ok(call, "expected anthropic fetch");
    const headers = (call!.init?.headers ?? {}) as Record<string, string>;
    assert.equal(headers["x-api-key"], "test-anthropic-key");
    assert.equal(headers["anthropic-version"], "2023-06-01");
  });

  it("engineer + synthesizer send extended_thinking budget 1024", async () => {
    await callEngineer("hi");
    await callSynthesizer("hi");
    const calls = fetchCalls.filter((c) => c.url.includes("anthropic.com"));
    assert.equal(calls.length, 2);
    for (const c of calls) {
      const body = JSON.parse(String(c.init?.body ?? "{}"));
      assert.deepEqual(body.thinking, { type: "enabled", budget_tokens: 1024 });
      // max_tokens must exceed thinking budget
      assert.ok(body.max_tokens > 1024);
    }
  });

  it("inspector/researcher/historian send NO thinking block", async () => {
    await callInspector("hi");
    await callResearcher("hi");
    await callHistorian("hi");
    const calls = fetchCalls.filter((c) => c.url.includes("anthropic.com"));
    assert.equal(calls.length, 3);
    for (const c of calls) {
      const body = JSON.parse(String(c.init?.body ?? "{}"));
      assert.equal(body.thinking, undefined);
      assert.equal(body.max_tokens, 10);
    }
  });

  it("researcher does NOT send web_search tool in smoke test", async () => {
    await callResearcher("hi");
    const call = fetchCalls.find((c) => c.url.includes("anthropic.com"));
    const body = JSON.parse(String(call!.init?.body ?? "{}"));
    assert.equal(body.tools, undefined);
  });

  it("devils_advocate hits OpenAI /v1/responses with gpt-4o and no reasoning param", async () => {
    await callDevilsAdvocate("hi");
    const call = fetchCalls.find((c) => c.url.includes("openai.com"));
    assert.ok(call);
    assert.ok(call!.url.includes("/v1/responses"));
    const headers = (call!.init?.headers ?? {}) as Record<string, string>;
    assert.equal(headers["Authorization"], "Bearer test-openai-key");
    const body = JSON.parse(String(call!.init?.body ?? "{}"));
    assert.equal(body.model, "gpt-4o");
    // gpt-4o is non-reasoning — the reasoning param must be absent.
    assert.equal(body.reasoning, undefined);
    // Without reasoning, max_output_tokens is the bare visible-allowance.
    assert.equal(body.max_output_tokens, 10);
  });
});

describe("AI specialist wrappers — cost log writes", () => {
  beforeEach(installFetchMock);
  afterEach(restoreFetch);

  it("inserts an ai_cost_log row with real token counts and cost", async () => {
    const supabase = makeMockSupabase({ ai_cost_log: [] });
    const out = await callInspector("hello inspector", {
      cost: { orgId: ORG, supabaseAdmin: supabase as never },
    });
    assert.equal(out.ok, true);
    const rows = supabase.__store.ai_cost_log;
    assert.equal(rows.length, 1);
    const row = rows[0] as Record<string, unknown>;
    assert.equal(row.code_name, "cross_domain:inspector");
    assert.equal(row.model, "claude-sonnet-4-6");
    assert.equal(row.org_id, ORG);
    assert.equal(row.input_tokens, 12);
    assert.equal(row.output_tokens, 1);
    assert.ok((row.cost_usd as number) > 0);
    assert.equal(row.request_id, "msg_test_123");
    assert.equal((row.metadata as { smoke_test: boolean }).smoke_test, true);
  });

  it("writes a row for every specialist when cost ctx is provided", async () => {
    const supabase = makeMockSupabase({ ai_cost_log: [] });
    const ctx = { cost: { orgId: ORG, supabaseAdmin: supabase as never } };
    await callInspector("p", ctx);
    await callEngineer("p", ctx);
    await callResearcher("p", ctx);
    await callDevilsAdvocate("p", ctx);
    await callHistorian("p", ctx);
    await callSynthesizer("p", ctx);

    const rows = supabase.__store.ai_cost_log;
    assert.equal(rows.length, 6);
    const codeNames = rows.map((r) => (r as Record<string, unknown>).code_name);
    assert.deepEqual(codeNames, [
      "cross_domain:inspector",
      "cross_domain:engineer",
      "cross_domain:researcher",
      "cross_domain:devils_advocate",
      "cross_domain:historian",
      "cross_domain:synthesizer",
    ]);
  });

  it("does not write when no cost context is provided", async () => {
    const supabase = makeMockSupabase({ ai_cost_log: [] });
    await callInspector("hello");
    assert.equal(supabase.__store.ai_cost_log.length, 0);
  });
});

describe("AI specialist wrappers — error handling + retry", () => {
  beforeEach(() => {
    fetchCalls = [];
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.CROSS_DOMAIN_RETRY_BASE_MS = "1";
  });
  afterEach(restoreFetch);

  it("returns ok:false with error message on provider 4xx, does not throw", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response(JSON.stringify({ error: "invalid_model" }), { status: 400 });
    }) as typeof fetch;

    const out = await callInspector("hi");
    assert.equal(out.ok, false);
    assert.equal(out.response, null);
    assert.ok(out.error && out.error.includes("400"));
    assert.equal(out.attempts, 1);
    assert.equal(calls, 1, "4xx must not retry");
    assert.equal(typeof out.latency_ms, "number");
  });

  it("does NOT retry on 401 (auth error) — surfaces immediately", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response(JSON.stringify({ error: "invalid_api_key" }), { status: 401 });
    }) as typeof fetch;

    const out = await callInspector("hi");
    assert.equal(out.ok, false);
    assert.equal(out.response, null);
    assert.equal(out.attempts, 1);
    assert.equal(calls, 1, "401 must not retry");
    assert.ok(out.error && out.error.includes("401"));
  });

  it("retries on Anthropic 529 with exponential backoff — 529 twice then 200 = attempts:3", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      if (calls <= 2) {
        return new Response(JSON.stringify({ error: "overloaded" }), { status: 529 });
      }
      return new Response(
        JSON.stringify({
          id: "msg_after_retry",
          content: [{ type: "text", text: "OK" }],
          usage: { input_tokens: 12, output_tokens: 1 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const out = await callInspector("hi");
    assert.equal(out.ok, true, out.error ?? "");
    assert.equal(out.response, "OK");
    assert.equal(out.attempts, 3);
    assert.equal(calls, 3);
  });

  it("exhausts retries on persistent 529 — 4 attempts then ok:false", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response(JSON.stringify({ error: "overloaded" }), { status: 529 });
    }) as typeof fetch;

    const out = await callInspector("hi");
    assert.equal(out.ok, false);
    assert.equal(out.attempts, 4);
    assert.equal(calls, 4);
    assert.ok(out.error && out.error.includes("529"));
  });

  it("retries on OpenAI 503 — 503 once then 200 = attempts:2", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      if (calls === 1) {
        return new Response(JSON.stringify({ error: "service_unavailable" }), { status: 503 });
      }
      return new Response(
        JSON.stringify({
          id: "resp_after_retry",
          output_text: "OK",
          usage: { input_tokens: 8, output_tokens: 1 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const out = await callDevilsAdvocate("hi");
    assert.equal(out.ok, true, out.error ?? "");
    assert.equal(out.attempts, 2);
    assert.equal(calls, 2);
  });

  it("does NOT retry on client-side network errors (TypeError)", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      throw new TypeError("fetch failed: network");
    }) as typeof fetch;

    const out = await callInspector("hi");
    assert.equal(out.ok, false);
    assert.equal(out.attempts, 1);
    assert.equal(calls, 1, "client-side network errors must not retry");
  });

  it("returns ok:false when ANTHROPIC_API_KEY is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    globalThis.fetch = (async () => {
      throw new Error("should not be called");
    }) as typeof fetch;

    const out = await callInspector("hi");
    assert.equal(out.ok, false);
    assert.equal(out.response, null);
    assert.equal(out.attempts, 1);
    assert.ok(out.error && out.error.includes("ANTHROPIC_API_KEY"));
  });
});

describe("SPECIALIST_SPECS", () => {
  it("covers all six roles", () => {
    assert.deepEqual(
      Object.keys(SPECIALIST_SPECS).sort(),
      ["devils_advocate", "engineer", "historian", "inspector", "researcher", "synthesizer"]
    );
  });
});

// ============================================================
// Sprint 3.2 — deliberate() parse-failure handling.
//
// Production bug: when JSON parsing failed, the wrapper returned
// raw_response: "" and discarded the model's actual output. These
// tests pin the fix: raw_response is preserved on every parse
// failure, parse_error is populated, and retry behavior is bounded.
// ============================================================

import type { DeliberationInput, AnalogousCase } from "../types";
import { deliberateAsInspector, deliberateAsHistorian, buildUserPrompt } from "../aiSpecialists";

const DELIB_INPUT: DeliberationInput = {
  anomaly: {
    id: "anom-1",
    asset_id: "asset-1",
    description: "test anomaly",
    severity: "cat_2_moderate",
    observed_at: new Date().toISOString(),
    mechanism_key: null,
  },
  asset: {
    id: "asset-1",
    asset_name: "Test Asset",
    asset_type: "vessel",
    domain: "industrial",
    material: null,
    service_environment: null,
    criticality: "moderate",
    age_years: null,
  },
  evidence: [],
  priorAnalyses: [],
  mechanismVocabulary: [],
};

function anthropicResponseWithText(text: string): Response {
  return new Response(
    JSON.stringify({
      id: "msg_x",
      content: [{ type: "text", text }],
      usage: { input_tokens: 50, output_tokens: 30 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

describe("deliberate() — empty content guard (Sprint 3.2)", () => {
  beforeEach(() => {
    fetchCalls = [];
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.CROSS_DOMAIN_RETRY_BASE_MS = "1";
  });
  afterEach(restoreFetch);

  it("model returns empty string → ok:false, raw_response='', parse_error='model returned empty content', does NOT retry", async () => {
    let fetchCount = 0;
    globalThis.fetch = (async () => {
      fetchCount++;
      return anthropicResponseWithText("");
    }) as typeof fetch;

    const result = await deliberateAsInspector(DELIB_INPUT);
    assert.equal(result.ok, false);
    assert.equal(result.analysis.raw_response, "");
    assert.equal(result.analysis.parse_error, "model returned empty content");
    // Cost still recorded — model burned tokens, we have to pay.
    assert.ok(result.analysis.cost_usd > 0);
    assert.equal(fetchCount, 1, "must NOT retry on empty content");
  });
});

describe("deliberate() — malformed JSON preserves raw_response (Sprint 3.2)", () => {
  beforeEach(() => {
    fetchCalls = [];
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.CROSS_DOMAIN_RETRY_BASE_MS = "1";
  });
  afterEach(restoreFetch);

  it("model returns prose (no JSON braces) → ok:false, raw_response preserved, parse_error populated", async () => {
    const prose =
      "I cannot provide a response in JSON format as requested.";
    globalThis.fetch = (async () =>
      anthropicResponseWithText(prose)) as typeof fetch;

    const result = await deliberateAsInspector(DELIB_INPUT);
    assert.equal(result.ok, false);
    // RAW RESPONSE PRESERVED — this is the core Sprint 3.2 fix.
    assert.equal(result.analysis.raw_response, prose);
    assert.ok(
      result.analysis.parse_error &&
        result.analysis.parse_error.length > 0,
      "parse_error must be populated"
    );
    assert.ok(result.analysis.cost_usd > 0);
  });

  it("malformed JSON (mismatched braces) → ok:false, raw_response preserved, retried once max (2 fetches)", async () => {
    const malformed = '{"summary": "hi", "claims": [unclosed';
    let fetchCount = 0;
    globalThis.fetch = (async () => {
      fetchCount++;
      return anthropicResponseWithText(malformed);
    }) as typeof fetch;

    const result = await deliberateAsInspector(DELIB_INPUT);
    assert.equal(result.ok, false);
    assert.equal(result.analysis.raw_response, malformed);
    assert.ok(result.analysis.parse_error);
    // EXACTLY 2 fetches: initial + one parse-retry. NOT 3+.
    assert.equal(
      fetchCount,
      2,
      `must retry parse failure exactly once, got ${fetchCount} fetches`
    );
    assert.equal(result.analysis.attempts, 2);
  });

  it("valid JSON missing required field (no claims) → ok:false, raw preserved, parse_error from schema validation", async () => {
    const missingFields = JSON.stringify({ summary: "ok", open_questions: [] });
    let fetchCount = 0;
    globalThis.fetch = (async () => {
      fetchCount++;
      return anthropicResponseWithText(missingFields);
    }) as typeof fetch;

    const result = await deliberateAsInspector(DELIB_INPUT);
    assert.equal(result.ok, false);
    assert.equal(result.analysis.raw_response, missingFields);
    assert.ok(result.analysis.parse_error);
    // schema-validation failure looks like malformed to the retry
    // loop (the JSON parsed but validateAnalysisShape returned null),
    // so we do retry once.
    assert.equal(fetchCount, 2);
  });
});

describe("deliberate() — valid JSON happy path still works (Sprint 3.2 regression check)", () => {
  beforeEach(() => {
    fetchCalls = [];
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.CROSS_DOMAIN_RETRY_BASE_MS = "1";
  });
  afterEach(restoreFetch);

  it("valid SpecialistAnalysis JSON → ok:true, parse_error undefined", async () => {
    const validJson = JSON.stringify({
      summary: "inspector view",
      claims: [
        {
          text: "evidence shows X",
          confidence: 0.8,
          supporting_evidence_ids: [],
          cited_mechanism_codes: [],
        },
      ],
      open_questions: [],
      cited_mechanisms: [],
      cited_evidence: [],
    });
    let fetchCount = 0;
    globalThis.fetch = (async () => {
      fetchCount++;
      return anthropicResponseWithText(validJson);
    }) as typeof fetch;

    const result = await deliberateAsInspector(DELIB_INPUT);
    assert.equal(result.ok, true);
    assert.equal(result.analysis.summary, "inspector view");
    assert.equal(result.analysis.claims.length, 1);
    assert.equal(result.analysis.parse_error, undefined);
    assert.equal(result.analysis.raw_response, validJson);
    assert.equal(fetchCount, 1, "single fetch on parse success");
  });
});

// ============================================================
// Sprint 4A — Historian receives memory-backed analogous cases
//
// The buildUserPrompt path is exercised directly to verify the new
// vector-retrieval AnalogousCase shape (source_deliberation_id,
// text_content, similarity, …) is serialized into the prompt for
// Historian, and to verify cold-start tenants see the explicit
// "(none — cold-start tenant …)" line.
// ============================================================

function makeAnalogousCase(overrides: Partial<AnalogousCase> = {}): AnalogousCase {
  return {
    source_deliberation_id: "prior-deliberation-1",
    source_anomaly_id: "prior-anomaly-1",
    record_type: "synthesis_summary",
    text_content:
      "Pitting consistent with chloride exposure on a similarly aged riser.",
    similarity: 0.87,
    metadata: {
      prior_consensus_level: "unanimous",
      prior_synthesizer_summary: "Prior unanimous outcome.",
      cited_mechanisms: ["pitting_corrosion"],
      cited_evidence_ids: ["ev-prior-1"],
    },
    cited_mechanisms: ["pitting_corrosion"],
    created_at: new Date("2026-04-10").toISOString(),
    ...overrides,
  };
}

describe("Historian prompt — Sprint 4A memory-backed cases", () => {
  it("includes ANALOGOUS PRIOR CASES section with new shape when cases present", () => {
    const cases = [
      makeAnalogousCase({ similarity: 0.91 }),
      makeAnalogousCase({
        source_deliberation_id: "prior-deliberation-2",
        record_type: "specialist_claim",
        text_content: "Wall loss > 20% nominal.",
        similarity: 0.78,
      }),
    ];
    const inputWithCases: DeliberationInput = {
      ...DELIB_INPUT,
      analogousCases: cases,
    };
    const prompt = buildUserPrompt("historian", inputWithCases, null);
    assert.ok(
      prompt.includes("ANALOGOUS PRIOR CASES (vector retrieval"),
      "prompt must reference vector retrieval"
    );
    assert.ok(
      prompt.includes("prior-deliberation-1"),
      "prompt must include first prior deliberation id"
    );
    assert.ok(
      prompt.includes("prior-deliberation-2"),
      "prompt must include second prior deliberation id"
    );
    assert.ok(
      prompt.includes('"similarity": 0.91') || prompt.includes("0.91"),
      "prompt must surface similarity score"
    );
    assert.ok(
      prompt.includes("text_content"),
      "prompt must surface text_content field"
    );
  });

  it("cold-start tenant: empty analogousCases → prompt shows explicit none line", () => {
    const inputColdStart: DeliberationInput = {
      ...DELIB_INPUT,
      analogousCases: [],
    };
    const prompt = buildUserPrompt("historian", inputColdStart, null);
    assert.ok(
      prompt.includes("ANALOGOUS PRIOR CASES: (none"),
      "cold-start prompt must explicitly state no prior cases"
    );
    assert.ok(
      prompt.includes("cold-start"),
      "cold-start prompt must use 'cold-start' wording"
    );
  });

  it("undefined analogousCases also triggers the cold-start line", () => {
    const prompt = buildUserPrompt("historian", DELIB_INPUT, null);
    assert.ok(prompt.includes("ANALOGOUS PRIOR CASES: (none"));
  });

  it("non-historian roles do NOT receive an ANALOGOUS PRIOR CASES section", () => {
    const cases = [makeAnalogousCase()];
    const inputWithCases: DeliberationInput = {
      ...DELIB_INPUT,
      analogousCases: cases,
    };
    const inspectorPrompt = buildUserPrompt("inspector", inputWithCases, null);
    assert.ok(
      !inspectorPrompt.includes("ANALOGOUS PRIOR CASES"),
      "only Historian gets the analogous-cases section"
    );
  });
});

describe("Historian deliberation — Sprint 4A integration smoke", () => {
  beforeEach(installFetchMock);
  afterEach(restoreFetch);

  it("Historian runs to completion with non-empty analogous cases (parses valid JSON response)", async () => {
    // Override fetch with valid Historian JSON
    const validHistorianJson = JSON.stringify({
      summary:
        "Prior cases reinforce a pitting-corrosion hypothesis at similar service age.",
      claims: [
        {
          text: "Two prior deliberations cite pitting_corrosion at high similarity.",
          confidence: 0.8,
          supporting_evidence_ids: [],
          cited_mechanism_codes: ["pitting_corrosion"],
        },
      ],
      open_questions: [],
      cited_mechanisms: ["pitting_corrosion"],
      cited_evidence: [],
    });
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          id: "msg_hist",
          content: [{ type: "text", text: validHistorianJson }],
          usage: { input_tokens: 200, output_tokens: 80 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )) as typeof fetch;

    const cases = [makeAnalogousCase()];
    const result = await deliberateAsHistorian({
      ...DELIB_INPUT,
      analogousCases: cases,
    });
    assert.equal(result.ok, true, result.error ?? "");
    assert.equal(result.analysis.role, "historian");
    assert.ok(result.analysis.summary.length > 0);
    assert.ok(result.analysis.cited_mechanisms.includes("pitting_corrosion"));
  });
});
