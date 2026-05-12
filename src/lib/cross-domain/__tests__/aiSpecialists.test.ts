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
  ["devils_advocate", callDevilsAdvocate, "gpt-5", "cross_domain:devils_advocate"],
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

let fetchCalls: FetchCall[] = [];

function installFetchMock() {
  fetchCalls = [];
  process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
  process.env.OPENAI_API_KEY = "test-openai-key";
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

  it("devils_advocate hits OpenAI /v1/responses with reasoning.effort=low", async () => {
    await callDevilsAdvocate("hi");
    const call = fetchCalls.find((c) => c.url.includes("openai.com"));
    assert.ok(call);
    assert.ok(call!.url.includes("/v1/responses"));
    const headers = (call!.init?.headers ?? {}) as Record<string, string>;
    assert.equal(headers["Authorization"], "Bearer test-openai-key");
    const body = JSON.parse(String(call!.init?.body ?? "{}"));
    assert.equal(body.model, "gpt-5");
    assert.deepEqual(body.reasoning, { effort: "low" });
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

describe("AI specialist wrappers — error handling", () => {
  beforeEach(() => {
    fetchCalls = [];
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    process.env.OPENAI_API_KEY = "test-openai-key";
  });
  afterEach(restoreFetch);

  it("returns ok:false with error message on provider 4xx, does not throw", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "invalid_model" }), { status: 400 })) as typeof fetch;

    const out = await callInspector("hi");
    assert.equal(out.ok, false);
    assert.equal(out.response, null);
    assert.ok(out.error && out.error.includes("400"));
    assert.equal(typeof out.latency_ms, "number");
  });

  it("returns ok:false when ANTHROPIC_API_KEY is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    globalThis.fetch = (async () => {
      throw new Error("should not be called");
    }) as typeof fetch;

    const out = await callInspector("hi");
    assert.equal(out.ok, false);
    assert.equal(out.response, null);
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
