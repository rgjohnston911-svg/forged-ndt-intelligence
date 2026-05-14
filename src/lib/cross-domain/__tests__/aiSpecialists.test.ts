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
      assert.equal(body.max_tokens, 20);
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
    // OpenAI Responses API requires >= 16 for non-reasoning models; we use 20.
    assert.equal(body.max_output_tokens, 20);
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

import type {
  DeliberationInput,
  AnalogousCase,
  SpecialistAnalysis,
} from "../types";
import {
  deliberateAsInspector,
  deliberateAsHistorian,
  deliberateAsResearcher,
  deliberateAsSynthesizer,
  buildUserPrompt,
  buildSystemPrompt,
  parseAnthropicMixedContent,
  getWebSearchToolsForRole,
  WEB_SEARCH_COST_PER_CALL_USD,
  WEB_SEARCH_MAX_USES,
} from "../aiSpecialists";

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

// ============================================================
// Sprint 4B — Researcher web_search wiring
//
// Coverage:
//   1. happy path: text + 2 server_tool_use + 2 web_search_tool_result
//      → cited_sources populated, search cost added, JSON still parses
//   2. model doesn't search: only text blocks → cited_sources: []
//   3. tool error: web_search_tool_result with is_error: true → wrapper
//      proceeds with whatever else parsed
//   4. backward compat: pure-text response shape still parses (existing
//      121 tests cover this via other specialists)
//   5. type-level: getWebSearchToolsForRole gates to researcher only
// ============================================================

function researcherValidJsonText(extras: { withCitations?: boolean } = {}): string {
  const inlineCite = extras.withCitations
    ? "Per ASME PVP-2024-89234, similar wall loss patterns at riser TDPs were documented."
    : "Wall loss patterns at riser TDPs are documented in industry literature.";
  return JSON.stringify({
    summary:
      "Researcher synthesis grounded in current industry literature.",
    claims: [
      {
        text: inlineCite,
        confidence: 0.75,
        supporting_evidence_ids: [],
        cited_mechanism_codes: ["pitting_corrosion"],
      },
    ],
    open_questions: [],
    cited_mechanisms: ["pitting_corrosion"],
    cited_evidence: [],
  });
}

function anthropicResponseWithBlocks(
  blocks: unknown[],
  usage: { input_tokens: number; output_tokens: number } = {
    input_tokens: 1500,
    output_tokens: 600,
  }
): Response {
  return new Response(
    JSON.stringify({
      id: "msg_researcher_x",
      content: blocks,
      usage,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

describe("parseAnthropicMixedContent — direct unit", () => {
  it("text + 2 server_tool_use + 2 web_search_tool_result → 2 sources, query linked, search_query populated", () => {
    const blocks = [
      { type: "text", text: "Let me search for that." },
      {
        type: "server_tool_use",
        id: "srvtu_1",
        name: "web_search",
        input: { query: "ASME PVP coating disbondment 2024" },
      },
      {
        type: "web_search_tool_result",
        tool_use_id: "srvtu_1",
        content: [
          {
            type: "web_search_result",
            url: "https://www.asme.org/codes-standards/find-codes-standards/pvp",
            title: "ASME PVP Conference Proceedings",
            page_age: "2024-08-15",
          },
        ],
      },
      { type: "text", text: "Now let me look at NACE." },
      {
        type: "server_tool_use",
        id: "srvtu_2",
        name: "web_search",
        input: { query: "NACE SP0169 CP shielding riser" },
      },
      {
        type: "web_search_tool_result",
        tool_use_id: "srvtu_2",
        content: [
          {
            type: "web_search_result",
            url: "https://www.nace.org/store/sp0169",
            title: "NACE SP0169 Cathodic Protection Standard",
          },
        ],
      },
      { type: "text", text: '{"summary":"x","claims":[],"open_questions":[],"cited_mechanisms":[],"cited_evidence":[]}' },
    ];
    const parsed = parseAnthropicMixedContent(blocks);
    assert.equal(parsed.searches_performed, 2);
    assert.equal(parsed.search_errors, 0);
    assert.equal(parsed.cited_sources.length, 2);
    assert.equal(
      parsed.cited_sources[0].url,
      "https://www.asme.org/codes-standards/find-codes-standards/pvp"
    );
    assert.equal(parsed.cited_sources[0].domain, "www.asme.org");
    assert.equal(
      parsed.cited_sources[0].search_query,
      "ASME PVP coating disbondment 2024"
    );
    assert.equal(parsed.cited_sources[0].page_age, "2024-08-15");
    assert.equal(parsed.cited_sources[1].domain, "www.nace.org");
    // Text blocks concatenated in source order — the final JSON block is at the end
    assert.ok(parsed.text.includes("Let me search"));
    assert.ok(parsed.text.includes("{\"summary\""));
  });

  it("tool error block → counted in search_errors, skipped from sources", () => {
    const blocks = [
      { type: "text", text: "Searching..." },
      {
        type: "server_tool_use",
        id: "srvtu_1",
        name: "web_search",
        input: { query: "x" },
      },
      {
        type: "web_search_tool_result",
        tool_use_id: "srvtu_1",
        is_error: true,
        content: [],
      },
      { type: "text", text: "{\"summary\":\"\",\"claims\":[],\"open_questions\":[],\"cited_mechanisms\":[],\"cited_evidence\":[]}" },
    ];
    const parsed = parseAnthropicMixedContent(blocks);
    assert.equal(parsed.searches_performed, 1);
    assert.equal(parsed.search_errors, 1);
    assert.equal(parsed.cited_sources.length, 0);
  });

  it("no tool blocks → empty sources, zero searches", () => {
    const blocks = [{ type: "text", text: "hello" }];
    const parsed = parseAnthropicMixedContent(blocks);
    assert.equal(parsed.searches_performed, 0);
    assert.equal(parsed.search_errors, 0);
    assert.equal(parsed.cited_sources.length, 0);
    assert.equal(parsed.text, "hello");
  });

  // Sprint 4 Polish (Fix C) — snippet capture from text-block citations
  it("text-block citations carry cited_text → snippet lifted onto the matching ExternalSource", () => {
    const blocks = [
      {
        type: "text",
        text: "Per NACE SP0169-2013, CP shielding under disbonded coatings is documented.",
        citations: [
          {
            type: "web_search_result_location",
            url: "https://www.nace.org/store/sp0169",
            title: "NACE SP0169-2013",
            cited_text:
              "Under-coating cathodic shielding is a known integrity threat where disbondment prevents CP current from reaching the substrate.",
          },
        ],
      },
      {
        type: "server_tool_use",
        id: "srvtu_1",
        name: "web_search",
        input: { query: "NACE SP0169 CP shielding" },
      },
      {
        type: "web_search_tool_result",
        tool_use_id: "srvtu_1",
        content: [
          {
            type: "web_search_result",
            url: "https://www.nace.org/store/sp0169",
            title: "NACE SP0169-2013",
            encrypted_content: "BASE64_OPAQUE_BYTES",
          },
        ],
      },
      { type: "text", text: '{"summary":"","claims":[],"open_questions":[],"cited_mechanisms":[],"cited_evidence":[]}' },
    ];
    const parsed = parseAnthropicMixedContent(blocks);
    assert.equal(parsed.cited_sources.length, 1);
    const source = parsed.cited_sources[0];
    assert.ok(
      source.snippet && source.snippet.length > 0,
      `snippet should be lifted from citation cited_text. got snippet="${source.snippet}"`
    );
    assert.ok(
      source.snippet!.includes("cathodic shielding"),
      "snippet should preserve the citation's substantive text"
    );
  });

  it("snippet capped at 500 chars", () => {
    const longSnippet = "x".repeat(750);
    const blocks = [
      {
        type: "text",
        text: "x",
        citations: [
          {
            url: "https://example.com/long",
            cited_text: longSnippet,
          },
        ],
      },
      {
        type: "server_tool_use",
        id: "srvtu_long",
        name: "web_search",
        input: { query: "x" },
      },
      {
        type: "web_search_tool_result",
        tool_use_id: "srvtu_long",
        content: [
          {
            type: "web_search_result",
            url: "https://example.com/long",
            title: "long",
          },
        ],
      },
    ];
    const parsed = parseAnthropicMixedContent(blocks);
    assert.equal(parsed.cited_sources.length, 1);
    assert.equal(parsed.cited_sources[0].snippet?.length, 500);
  });

  it("snippet falls back to result-level text fields when no citation present", () => {
    const blocks = [
      {
        type: "server_tool_use",
        id: "srvtu_b",
        name: "web_search",
        input: { query: "x" },
      },
      {
        type: "web_search_tool_result",
        tool_use_id: "srvtu_b",
        content: [
          {
            type: "web_search_result",
            url: "https://example.com/r",
            title: "fallback case",
            // No citation block above pointed at this URL. Look at
            // result-level fields the engine accepts.
            description: "A useful description that should land as snippet.",
          },
        ],
      },
    ];
    const parsed = parseAnthropicMixedContent(blocks);
    assert.equal(
      parsed.cited_sources[0].snippet,
      "A useful description that should land as snippet."
    );
  });

  it("encrypted_content alone (no plain text anywhere) → snippet stays undefined", () => {
    const blocks = [
      {
        type: "server_tool_use",
        id: "srvtu_e",
        name: "web_search",
        input: { query: "x" },
      },
      {
        type: "web_search_tool_result",
        tool_use_id: "srvtu_e",
        content: [
          {
            type: "web_search_result",
            url: "https://example.com/opaque",
            title: "opaque case",
            encrypted_content: "OPAQUE",
          },
        ],
      },
    ];
    const parsed = parseAnthropicMixedContent(blocks);
    assert.equal(parsed.cited_sources[0].snippet, undefined);
  });

  // Sprint 4 Polish (Fix D) — bare hostname for domain field
  it("plain URL → domain is bare hostname", () => {
    const blocks = [
      {
        type: "server_tool_use",
        id: "srvtu_h",
        name: "web_search",
        input: { query: "x" },
      },
      {
        type: "web_search_tool_result",
        tool_use_id: "srvtu_h",
        content: [
          {
            type: "web_search_result",
            url: "https://www.energy.gov/oe/articles/coatings-best-practices",
            title: "DOE Coatings Best Practices",
          },
        ],
      },
    ];
    const parsed = parseAnthropicMixedContent(blocks);
    assert.equal(parsed.cited_sources[0].domain, "www.energy.gov");
    assert.equal(
      parsed.cited_sources[0].url,
      "https://www.energy.gov/oe/articles/coatings-best-practices"
    );
  });

  it("markdown-wrapped URL → unwrapped before hostname extraction; domain is bare", () => {
    const blocks = [
      {
        type: "server_tool_use",
        id: "srvtu_md",
        name: "web_search",
        input: { query: "x" },
      },
      {
        type: "web_search_tool_result",
        tool_use_id: "srvtu_md",
        content: [
          {
            type: "web_search_result",
            // Production-observed bug: URL field arrives as markdown link.
            url: "[www.energy.gov](https://www.energy.gov/oe/articles/coatings-best-practices)",
            title: "DOE Coatings Best Practices (md-wrapped)",
          },
        ],
      },
    ];
    const parsed = parseAnthropicMixedContent(blocks);
    assert.equal(
      parsed.cited_sources[0].domain,
      "www.energy.gov",
      "domain must be bare hostname, NOT '[www.energy.gov](...)'"
    );
    // url field also unwrapped so downstream callers don't have to.
    assert.equal(
      parsed.cited_sources[0].url,
      "https://www.energy.gov/oe/articles/coatings-best-practices"
    );
  });

  it("angle-bracket URL → unwrapped to bare hostname", () => {
    const blocks = [
      {
        type: "server_tool_use",
        id: "srvtu_ab",
        name: "web_search",
        input: { query: "x" },
      },
      {
        type: "web_search_tool_result",
        tool_use_id: "srvtu_ab",
        content: [
          {
            type: "web_search_result",
            url: "<https://files.asme.org/pvp/2024/89234.pdf>",
            title: "ASME PVP 2024",
          },
        ],
      },
    ];
    const parsed = parseAnthropicMixedContent(blocks);
    assert.equal(parsed.cited_sources[0].domain, "files.asme.org");
  });

  // Sprint 4 Polish 2 (Fix 3) — broaden snippet harvest across all
  // citation nesting levels. Production smoke-test showed 0/30 sources
  // with snippets even when the parser found citations on text blocks;
  // root hypothesis is that Anthropic embeds citation objects at
  // varying nesting levels. These tests pin the new defensive walker.

  it("Fix 3: citation as a sibling of url on the search result itself (cited_text on result item)", () => {
    // Some response shapes attach cited_text directly to the
    // web_search_result item rather than emitting a separate citation
    // object on the text block.
    const blocks = [
      {
        type: "server_tool_use",
        id: "srvtu_sib",
        name: "web_search",
        input: { query: "x" },
      },
      {
        type: "web_search_tool_result",
        tool_use_id: "srvtu_sib",
        content: [
          {
            type: "web_search_result",
            url: "https://www.nace.org/sp0169",
            title: "NACE SP0169-2013",
            cited_text:
              "Cathodic shielding under disbonded coatings is documented at NACE SP0169 §6.4.",
          },
        ],
      },
    ];
    const parsed = parseAnthropicMixedContent(blocks);
    assert.equal(parsed.cited_sources.length, 1);
    assert.ok(parsed.cited_sources[0].snippet);
    assert.ok(
      parsed.cited_sources[0].snippet!.includes("Cathodic shielding"),
      `snippet not lifted from cited_text sibling; got: ${parsed.cited_sources[0].snippet}`
    );
  });

  it("Fix 3: citation nested inside a sub-content array of a text block", () => {
    // Some response shapes nest citations under content[] within a
    // text block (rather than directly under block.citations[]). The
    // recursive walker should still find them.
    const blocks = [
      {
        type: "text",
        text: "Per NACE SP0169-2013, CP shielding is documented.",
        content: [
          {
            type: "citation_group",
            citations: [
              {
                type: "web_search_result_location",
                url: "https://www.nace.org/sp0169",
                title: "NACE SP0169-2013",
                cited_text:
                  "CP shielding under disbonded coatings is a known threat per §6.4.",
              },
            ],
          },
        ],
      },
      {
        type: "server_tool_use",
        id: "srvtu_nest",
        name: "web_search",
        input: { query: "NACE" },
      },
      {
        type: "web_search_tool_result",
        tool_use_id: "srvtu_nest",
        content: [
          {
            type: "web_search_result",
            url: "https://www.nace.org/sp0169",
            title: "NACE SP0169-2013",
          },
        ],
      },
    ];
    const parsed = parseAnthropicMixedContent(blocks);
    assert.equal(parsed.cited_sources.length, 1);
    assert.ok(
      parsed.cited_sources[0].snippet &&
        parsed.cited_sources[0].snippet.includes("CP shielding"),
      `snippet not lifted from nested citation; got: ${parsed.cited_sources[0].snippet}`
    );
  });

  it("Fix 3: hostname-only fallback — citation URL has different path than search result URL", () => {
    // Production seen: text-block citation URL points at an article
    // path, web_search_tool_result URL points at the journal root.
    // canonicalUrlKey wouldn't match (different pathnames); hostname
    // fallback rescues the snippet.
    const blocks = [
      {
        type: "text",
        text: "Per ASME PVP 2024-89234, …",
        citations: [
          {
            url: "https://www.asme.org/codes-standards/find-codes-standards/pvp",
            cited_text:
              "ASME PVP coating disbondment proceedings discuss CP shielding under FBE.",
          },
        ],
      },
      {
        type: "server_tool_use",
        id: "srvtu_host",
        name: "web_search",
        input: { query: "ASME PVP" },
      },
      {
        type: "web_search_tool_result",
        tool_use_id: "srvtu_host",
        content: [
          {
            type: "web_search_result",
            // Different path — but same host.
            url: "https://www.asme.org/codes-standards/find-codes-standards/pvp/proceedings",
            title: "ASME PVP",
          },
        ],
      },
    ];
    const parsed = parseAnthropicMixedContent(blocks);
    assert.equal(parsed.cited_sources.length, 1);
    assert.ok(
      parsed.cited_sources[0].snippet &&
        parsed.cited_sources[0].snippet.includes("ASME PVP"),
      `hostname-only fallback should have lifted the snippet; got: ${parsed.cited_sources[0].snippet}`
    );
  });

  // ----- Sprint 4 Polish 2 (Fix 4) — domain unwrap: trailing
  // punctuation + chained wrappings collapse correctly -----

  it("Fix 4: URL with trailing comma → unwrapped to bare host", () => {
    const blocks = [
      {
        type: "server_tool_use",
        id: "srvtu_tp1",
        name: "web_search",
        input: { query: "x" },
      },
      {
        type: "web_search_tool_result",
        tool_use_id: "srvtu_tp1",
        content: [
          {
            type: "web_search_result",
            url: "https://www.researchgate.net/publication/abc,",
            title: "ResearchGate paper",
          },
        ],
      },
    ];
    const parsed = parseAnthropicMixedContent(blocks);
    assert.equal(parsed.cited_sources[0].domain, "www.researchgate.net");
    // url is unwrapped (no trailing comma in the canonical form)
    assert.ok(
      !parsed.cited_sources[0].url.endsWith(","),
      `url should not retain trailing comma: ${parsed.cited_sources[0].url}`
    );
  });

  it("Fix 4: URL with trailing period → unwrapped to bare host", () => {
    const blocks = [
      {
        type: "server_tool_use",
        id: "srvtu_tp2",
        name: "web_search",
        input: { query: "x" },
      },
      {
        type: "web_search_tool_result",
        tool_use_id: "srvtu_tp2",
        content: [
          {
            type: "web_search_result",
            url: "https://www.energy.gov/oe/articles/x.",
            title: "DOE article",
          },
        ],
      },
    ];
    const parsed = parseAnthropicMixedContent(blocks);
    assert.equal(parsed.cited_sources[0].domain, "www.energy.gov");
    assert.ok(!parsed.cited_sources[0].url.endsWith("."));
  });

  it("Fix 4: chained wrappings — markdown link inside angle brackets with trailing semicolon", () => {
    const blocks = [
      {
        type: "server_tool_use",
        id: "srvtu_chain",
        name: "web_search",
        input: { query: "x" },
      },
      {
        type: "web_search_tool_result",
        tool_use_id: "srvtu_chain",
        content: [
          {
            type: "web_search_result",
            url: "<[asme.org](https://files.asme.org/pvp/2024/89234.pdf)>;",
            title: "chained wrap",
          },
        ],
      },
    ];
    const parsed = parseAnthropicMixedContent(blocks);
    assert.equal(
      parsed.cited_sources[0].domain,
      "files.asme.org",
      `chained wrappings must collapse; got domain=${parsed.cited_sources[0].domain}`
    );
  });

  it("Fix 4: production-shape regression — researchgate markdown link → bare host", () => {
    // Production-observed shape from Sprint 4 Polish smoke test:
    // domain ended up as "[www.researchgate.net](https://www.researchgate.net)"
    // because the URL field arrived in markdown-link form. After Fix 4
    // the unwrap chain handles both ingress paths.
    const blocks = [
      {
        type: "server_tool_use",
        id: "srvtu_rg",
        name: "web_search",
        input: { query: "x" },
      },
      {
        type: "web_search_tool_result",
        tool_use_id: "srvtu_rg",
        content: [
          {
            type: "web_search_result",
            url: "[www.researchgate.net](https://www.researchgate.net/publication/abc)",
            title: "rg",
          },
        ],
      },
    ];
    const parsed = parseAnthropicMixedContent(blocks);
    assert.equal(parsed.cited_sources[0].domain, "www.researchgate.net");
  });

  it("Fix 3: harvester does NOT descend into encrypted_content (opaque base64)", () => {
    // Encrypted_content is base64 the model reads but humans cannot.
    // Walking into it wastes work and could surface garbled bytes
    // if the harvester wasn't careful. The walker explicitly skips it.
    const blocks = [
      {
        type: "server_tool_use",
        id: "srvtu_enc",
        name: "web_search",
        input: { query: "x" },
      },
      {
        type: "web_search_tool_result",
        tool_use_id: "srvtu_enc",
        content: [
          {
            type: "web_search_result",
            url: "https://example.com/opaque",
            title: "opaque",
            // Malicious-looking nested object pretending to be a
            // citation. Harvester must not pick this up.
            encrypted_content: {
              url: "https://example.com/opaque",
              cited_text: "this should not surface as a snippet",
            },
          },
        ],
      },
    ];
    const parsed = parseAnthropicMixedContent(blocks);
    assert.equal(parsed.cited_sources.length, 1);
    assert.equal(
      parsed.cited_sources[0].snippet,
      undefined,
      "harvester must not walk into encrypted_content"
    );
  });
});

describe("getWebSearchToolsForRole", () => {
  it("returns config only for researcher", () => {
    assert.equal(getWebSearchToolsForRole("inspector"), undefined);
    assert.equal(getWebSearchToolsForRole("engineer"), undefined);
    assert.equal(getWebSearchToolsForRole("devils_advocate"), undefined);
    assert.equal(getWebSearchToolsForRole("historian"), undefined);
    assert.equal(getWebSearchToolsForRole("synthesizer"), undefined);
    const r = getWebSearchToolsForRole("researcher");
    assert.ok(r);
    assert.equal(r!.length, 1);
    assert.equal(r![0].type, "web_search_20250305");
    assert.equal(r![0].name, "web_search");
    assert.equal(r![0].max_uses, WEB_SEARCH_MAX_USES);
  });
});

describe("Researcher deliberate() — Sprint 4B web_search", () => {
  beforeEach(installFetchMock);
  afterEach(restoreFetch);

  it("happy path: 2 searches surface 2 sources, JSON still parses, cost includes search fee", async () => {
    const jsonText = researcherValidJsonText({ withCitations: true });
    const blocks = [
      { type: "text", text: "Searching ASME first." },
      {
        type: "server_tool_use",
        id: "srvtu_1",
        name: "web_search",
        input: { query: "ASME PVP riser disbondment" },
      },
      {
        type: "web_search_tool_result",
        tool_use_id: "srvtu_1",
        content: [
          {
            type: "web_search_result",
            url: "https://asme.org/pvp/abc",
            title: "ASME PVP-2024-89234",
          },
        ],
      },
      { type: "text", text: "Now NACE." },
      {
        type: "server_tool_use",
        id: "srvtu_2",
        name: "web_search",
        input: { query: "NACE SP0169 CP" },
      },
      {
        type: "web_search_tool_result",
        tool_use_id: "srvtu_2",
        content: [
          {
            type: "web_search_result",
            url: "https://nace.org/sp0169",
            title: "NACE SP0169-2013",
          },
        ],
      },
      { type: "text", text: jsonText },
    ];
    globalThis.fetch = (async () =>
      anthropicResponseWithBlocks(blocks, {
        input_tokens: 4000,
        output_tokens: 800,
      })) as typeof fetch;

    const result = await deliberateAsResearcher(DELIB_INPUT);
    assert.equal(result.ok, true, result.error ?? "");
    assert.equal(result.analysis.role, "researcher");
    assert.equal(result.analysis.searches_performed, 2);
    assert.ok(result.analysis.cited_sources);
    assert.equal(result.analysis.cited_sources!.length, 2);
    assert.equal(result.analysis.cited_sources![0].url, "https://asme.org/pvp/abc");
    assert.equal(
      result.analysis.cited_sources![0].search_query,
      "ASME PVP riser disbondment"
    );
    // Cost = token cost + 2 * search_cost
    const expectedTokenCost = (4000 / 1_000_000) * 3 + (800 / 1_000_000) * 15;
    const expectedSearchCost = 2 * WEB_SEARCH_COST_PER_CALL_USD;
    const expectedTotal = expectedTokenCost + expectedSearchCost;
    assert.ok(
      Math.abs(result.analysis.cost_usd - expectedTotal) < 1e-9,
      `cost_usd ${result.analysis.cost_usd} expected ${expectedTotal}`
    );
    // Claims preserved from concatenated text JSON
    assert.equal(result.analysis.claims.length, 1);
    assert.ok(result.analysis.claims[0].text.includes("ASME"));
  });

  it("model doesn't search → cited_sources: [], searches_performed: 0, JSON still parses, no search cost", async () => {
    const jsonText = researcherValidJsonText();
    globalThis.fetch = (async () =>
      anthropicResponseWithBlocks(
        [{ type: "text", text: jsonText }],
        { input_tokens: 200, output_tokens: 100 }
      )) as typeof fetch;

    const result = await deliberateAsResearcher(DELIB_INPUT);
    assert.equal(result.ok, true, result.error ?? "");
    assert.equal(result.analysis.searches_performed, 0);
    assert.deepEqual(result.analysis.cited_sources, []);
    // Cost should be token-only (no $0.01 search fees)
    const expectedTokenCost = (200 / 1_000_000) * 3 + (100 / 1_000_000) * 15;
    assert.ok(
      Math.abs(result.analysis.cost_usd - expectedTokenCost) < 1e-9,
      `cost_usd ${result.analysis.cost_usd} expected ${expectedTokenCost}`
    );
  });

  it("tool error in result → wrapper proceeds, search_errors logged via metadata, JSON still parses", async () => {
    const jsonText = researcherValidJsonText();
    const blocks = [
      { type: "text", text: "Trying a search." },
      {
        type: "server_tool_use",
        id: "srvtu_1",
        name: "web_search",
        input: { query: "x" },
      },
      {
        type: "web_search_tool_result",
        tool_use_id: "srvtu_1",
        is_error: true,
        content: [],
      },
      { type: "text", text: jsonText },
    ];
    globalThis.fetch = (async () =>
      anthropicResponseWithBlocks(blocks)) as typeof fetch;

    const result = await deliberateAsResearcher(DELIB_INPUT);
    assert.equal(result.ok, true, result.error ?? "");
    assert.equal(result.analysis.searches_performed, 1);
    // Errored result yields no source row
    assert.deepEqual(result.analysis.cited_sources, []);
    // Claims still produced from the trailing JSON text block
    assert.equal(result.analysis.claims.length, 1);
  });

  it("non-researcher specialists do NOT receive cited_sources / searches_performed", async () => {
    const validJson = JSON.stringify({
      summary: "inspector synthesis",
      claims: [
        {
          text: "evidence x",
          confidence: 0.7,
          supporting_evidence_ids: [],
          cited_mechanism_codes: [],
        },
      ],
      open_questions: [],
      cited_mechanisms: [],
      cited_evidence: [],
    });
    globalThis.fetch = (async () =>
      anthropicResponseWithText(validJson)) as typeof fetch;
    const result = await deliberateAsInspector(DELIB_INPUT);
    assert.equal(result.ok, true);
    assert.equal(result.analysis.cited_sources, undefined);
    assert.equal(result.analysis.searches_performed, undefined);
  });

  it("Anthropic request body includes tools when researcher runs (smoke from outside-in)", async () => {
    let capturedBody = "";
    globalThis.fetch = (async (_url: FetchInput, init?: FetchInit) => {
      capturedBody = String(init?.body ?? "");
      return anthropicResponseWithBlocks([
        { type: "text", text: researcherValidJsonText() },
      ]);
    }) as typeof fetch;
    const result = await deliberateAsResearcher(DELIB_INPUT);
    assert.equal(result.ok, true);
    const body = JSON.parse(capturedBody);
    assert.ok(Array.isArray(body.tools), "tools must be in request body");
    assert.equal(body.tools.length, 1);
    assert.equal(body.tools[0].type, "web_search_20250305");
    assert.equal(body.tools[0].max_uses, WEB_SEARCH_MAX_USES);
  });
});

describe("SpecialistAnalysis — Sprint 4B optional cited_sources", () => {
  it("type allows cited_sources to be omitted (back-compat)", () => {
    const a: SpecialistAnalysis = {
      role: "inspector",
      model: "claude-sonnet-4-6",
      summary: "",
      claims: [],
      open_questions: [],
      cited_mechanisms: [],
      cited_evidence: [],
      cost_usd: 0,
      latency_ms: 0,
      attempts: 1,
      raw_response: "",
    };
    assert.equal(a.cited_sources, undefined);
  });
  it("type allows cited_sources as ExternalSource[]", () => {
    const a: SpecialistAnalysis = {
      role: "researcher",
      model: "claude-sonnet-4-6",
      summary: "",
      claims: [],
      open_questions: [],
      cited_mechanisms: [],
      cited_evidence: [],
      cost_usd: 0,
      latency_ms: 0,
      attempts: 1,
      raw_response: "",
      cited_sources: [
        { url: "https://asme.org/x", title: "t", domain: "asme.org" },
      ],
      searches_performed: 1,
    };
    assert.equal(a.cited_sources!.length, 1);
    assert.equal(a.searches_performed, 1);
  });
});

// ============================================================
// Sprint 4 Polish — Fix A: Synthesizer code-first / why / how
//
// Two-part test: (1) the system prompt now contains the directive
// language so the model is actually asked to structure summaries
// that way; (2) when the model returns a summary that opens with
// an authoritative-standard citation, the wrapper parses and
// surfaces it unchanged. The regex pin is the brief's acceptance
// criterion: the summary must match (API|ASME|NACE|DNV|PHMSA|BSEE|CFR|ISO|ASNT)[\s-][0-9A-Z-]+.
// ============================================================

const STANDARD_CITATION_REGEX =
  /\b(API|ASME|NACE|DNV|PHMSA|BSEE|CFR|ISO|ASNT)[\s\-]?[0-9A-Z][0-9A-Z\-.\/ ]*/;

describe("Fix A — Synthesizer system prompt contains code-first/why/how directive", () => {
  it("buildSystemPrompt('synthesizer') includes CODE-FIRST, WHY, and HOW language", () => {
    const sysPrompt = buildSystemPrompt("synthesizer");
    assert.ok(
      sysPrompt.includes("CODE-FIRST"),
      "synthesizer prompt must mention CODE-FIRST anchor"
    );
    assert.ok(
      sysPrompt.includes("WHY:") || sysPrompt.includes("(2) WHY"),
      "synthesizer prompt must mention WHY (reasoning)"
    );
    assert.ok(
      sysPrompt.includes("HOW:") || sysPrompt.includes("(3) HOW"),
      "synthesizer prompt must mention HOW (action)"
    );
    // Mentions authoritative bodies the operator might recognize
    assert.ok(
      /API|ASME|NACE|ASNT/.test(sysPrompt),
      "synthesizer prompt must name authoritative bodies"
    );
  });

  it("non-synthesizer roles do NOT receive the code-first directive", () => {
    for (const role of [
      "inspector",
      "engineer",
      "researcher",
      "devils_advocate",
      "historian",
    ] as const) {
      const p = buildSystemPrompt(role);
      assert.ok(
        !p.includes("CODE-FIRST"),
        `role ${role} should not receive the synthesizer code-first directive`
      );
    }
  });
});

describe("Fix A — Synthesizer summary parses cleanly when model leads with a code citation", () => {
  beforeEach(installFetchMock);
  afterEach(restoreFetch);

  it("model returns code-first/why/how summary → parses, summary regex-matches an authoritative standard", async () => {
    const codeFirstSummary =
      "Per API 579-1/ASME FFS-1 Part 5, the documented localized wall loss requires a Level 2 fitness-for-service assessment. The pitting morphology and CP shielding signature is consistent with under-coating localized corrosion because cathodic protection current cannot reach the disbonded substrate. Operator action: conduct Level 2 FFS assessment, regrid UT at 25 mm spacing, retrofit sacrificial anodes given the > 70% depletion at the riser TDP.";
    const validJson = JSON.stringify({
      summary: codeFirstSummary,
      claims: [
        {
          text: "Per API 579-1 Part 5, Level 2 FFS is required at the observed RSF.",
          confidence: 0.85,
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
          id: "msg_synth_codefirst",
          content: [{ type: "text", text: validJson }],
          usage: { input_tokens: 800, output_tokens: 220 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )) as typeof fetch;

    const result = await deliberateAsSynthesizer(DELIB_INPUT, {
      status: "accepted",
      reason: "no objections",
    });
    assert.equal(result.ok, true, result.error ?? "");
    assert.ok(
      STANDARD_CITATION_REGEX.test(result.analysis.summary),
      `summary should cite an authoritative standard. summary="${result.analysis.summary}"`
    );
    // Existing structural assertions still hold
    assert.equal(result.analysis.role, "synthesizer");
    assert.equal(result.analysis.claims.length, 1);
  });
});
