// ============================================================
// DEPLOY355 — Six AI specialist client wrappers
//
// Path B smoke test: each wrapper makes a real minimal-token
// provider call to verify API keys, model names, and
// extended-thinking config before Sprint 2 builds the
// deliberation orchestrator on top.
//
// Wrappers never throw — failures return { ok: false, ... } so
// Promise.allSettled in the health endpoint resolves cleanly.
//
// Resilience: every provider call is wrapped in exponential-
// backoff retry (max 3 retries, 1s/2s/4s with ±20% jitter) for
// transient overload responses (Anthropic 529, OpenAI 5xx/529).
// 4xx and client-side network errors surface immediately.
// ============================================================

import type {
  SpecialistOutput,
  SpecialistCallContext,
  SpecialistRole,
} from "./types";

const SMOKE_PROMPT = "Respond with the single word OK and nothing else.";

// The visible-output budget. Anthropic's max_tokens and OpenAI's
// max_output_tokens both count thinking/reasoning tokens too, so
// when thinking/reasoning is enabled we add this on top of the
// thinking budget rather than using it as the absolute cap.
const RESPONSE_TOKEN_ALLOWANCE = 10;

// TODO: centralize pricing in a single source of truth alongside
// any other AI call sites (e.g. tri-model-reasoning). Numbers
// below are public per-1M-token pricing as of 2026-05.
const SMOKE_TEST_PRICING: Record<
  string,
  { input_per_mtok: number; output_per_mtok: number }
> = {
  "claude-sonnet-4-6": { input_per_mtok: 3, output_per_mtok: 15 },
  "claude-opus-4-6": { input_per_mtok: 15, output_per_mtok: 75 },
  "gpt-4o": { input_per_mtok: 2.5, output_per_mtok: 10 },
  // Reactivate when OpenAI org verification completes:
  // "gpt-5": { input_per_mtok: 1.25, output_per_mtok: 10 },
};

interface SpecialistSpec {
  role: SpecialistRole;
  provider: "anthropic" | "openai";
  model: string;
  code_name: string;
  notes: string;
  thinking?: { type: "enabled"; budget_tokens: number };
  reasoning_effort?: "low" | "medium" | "high";
}

const SPECS: Record<SpecialistRole, SpecialistSpec> = {
  inspector: {
    role: "inspector",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    code_name: "cross_domain:inspector",
    notes: "Anthropic sonnet — no extended thinking",
  },
  engineer: {
    role: "engineer",
    provider: "anthropic",
    model: "claude-opus-4-6",
    code_name: "cross_domain:engineer",
    // Sprint 2 raises to 16000.
    notes: "Anthropic opus — extended_thinking budget 1024 (smoke test)",
    thinking: { type: "enabled", budget_tokens: 1024 },
  },
  researcher: {
    role: "researcher",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    code_name: "cross_domain:researcher",
    // Sprint 2 adds web_search_20250305 tool.
    notes: "Anthropic sonnet — no extended thinking, no web_search tool (smoke test)",
  },
  devils_advocate: {
    role: "devils_advocate",
    provider: "openai",
    model: "gpt-4o",
    code_name: "cross_domain:devils_advocate",
    // Sprint 2 may upgrade to a reasoning-tier model (o1, o3, or
    // gpt-5 if org verification completes) with reasoning.effort:"high".
    // For now, gpt-4o without the reasoning param — gpt-4o is not a
    // reasoning-tier model and doesn't need org verification.
    notes: "OpenAI gpt-4o Responses API — no reasoning (smoke test)",
  },
  historian: {
    role: "historian",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    code_name: "cross_domain:historian",
    notes: "Anthropic sonnet — no extended thinking",
  },
  synthesizer: {
    role: "synthesizer",
    provider: "anthropic",
    model: "claude-opus-4-6",
    code_name: "cross_domain:synthesizer",
    // Sprint 2 raises to 32000.
    notes: "Anthropic opus — extended_thinking budget 1024 (smoke test)",
    thinking: { type: "enabled", budget_tokens: 1024 },
  },
};

function computeCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const p = SMOKE_TEST_PRICING[model];
  if (!p) return 0;
  return (
    (inputTokens / 1_000_000) * p.input_per_mtok +
    (outputTokens / 1_000_000) * p.output_per_mtok
  );
}

// ------------------------------------------------------------
// Retry plumbing
// ------------------------------------------------------------

class ProviderHttpError extends Error {
  readonly status: number;
  readonly provider: "anthropic" | "openai";
  constructor(provider: "anthropic" | "openai", status: number, body: string) {
    super(`${provider} ${status}: ${body.slice(0, 300)}`);
    this.name = "ProviderHttpError";
    this.provider = provider;
    this.status = status;
  }
}

class RetryExhaustedError extends Error {
  readonly attempts: number;
  readonly cause: Error;
  constructor(attempts: number, cause: Error) {
    super(cause.message);
    this.name = "RetryExhaustedError";
    this.attempts = attempts;
    this.cause = cause;
  }
}

const OPENAI_RETRYABLE_STATUSES = new Set([500, 502, 503, 504, 529]);

function isRetryable(err: unknown): boolean {
  if (!(err instanceof ProviderHttpError)) return false;
  if (err.provider === "anthropic") return err.status === 529;
  return OPENAI_RETRYABLE_STATUSES.has(err.status);
}

interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  jitterPct: number;
}

function defaultRetryOptions(): RetryOptions {
  // CROSS_DOMAIN_RETRY_BASE_MS exists so tests can shrink the
  // 1s/2s/4s schedule to single digits without changing call sites.
  const envBase = Number(process.env.CROSS_DOMAIN_RETRY_BASE_MS);
  const baseDelayMs = Number.isFinite(envBase) && envBase >= 0 ? envBase : 1000;
  return { maxRetries: 3, baseDelayMs, jitterPct: 0.2 };
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function callWithRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = defaultRetryOptions()
): Promise<{ value: T; attempts: number }> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    try {
      const value = await fn();
      return { value, attempts: attempt };
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      lastError = e;
      const retryable = isRetryable(err);
      if (!retryable || attempt > opts.maxRetries) {
        throw new RetryExhaustedError(attempt, e);
      }
      const status =
        err instanceof ProviderHttpError ? err.status : "client-error";
      console.warn(
        `[cross-domain retry] attempt ${attempt}/${opts.maxRetries + 1} failed with ${status}; backing off`
      );
      const baseDelay = opts.baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = baseDelay * opts.jitterPct * (Math.random() * 2 - 1);
      await sleep(Math.max(0, baseDelay + jitter));
    }
  }
  // Unreachable; loop either returns or throws.
  throw new RetryExhaustedError(opts.maxRetries + 1, lastError ?? new Error("retry loop exited unexpectedly"));
}

// ------------------------------------------------------------
// Provider calls
// ------------------------------------------------------------

interface ProviderCallResult {
  response: string | null;
  input_tokens: number;
  output_tokens: number;
  request_id: string | null;
}

async function callAnthropic(spec: SpecialistSpec): Promise<ProviderCallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  // max_tokens must exceed thinking budget — Anthropic counts thinking
  // tokens toward the same cap as visible output.
  const maxTokens = spec.thinking
    ? spec.thinking.budget_tokens + RESPONSE_TOKEN_ALLOWANCE
    : RESPONSE_TOKEN_ALLOWANCE;

  const body: Record<string, unknown> = {
    model: spec.model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: SMOKE_PROMPT }],
  };
  if (spec.thinking) body.thinking = spec.thinking;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ProviderHttpError("anthropic", res.status, text);
  }
  const data = (await res.json()) as {
    id?: string;
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const textBlock = (data.content ?? []).find((b) => b.type === "text");
  return {
    response: textBlock?.text?.trim() ?? null,
    input_tokens: data.usage?.input_tokens ?? 0,
    output_tokens: data.usage?.output_tokens ?? 0,
    request_id: data.id ?? null,
  };
}

async function callOpenAI(spec: SpecialistSpec): Promise<ProviderCallResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  // When reasoning is enabled, reasoning tokens count toward
  // max_output_tokens. Effort:low still needs headroom — use the
  // same 1024 + visible-allowance pattern as Anthropic thinking.
  const maxOutputTokens = spec.reasoning_effort
    ? 1024 + RESPONSE_TOKEN_ALLOWANCE
    : RESPONSE_TOKEN_ALLOWANCE;

  const body: Record<string, unknown> = {
    model: spec.model,
    input: SMOKE_PROMPT,
    max_output_tokens: maxOutputTokens,
  };
  if (spec.reasoning_effort) {
    body.reasoning = { effort: spec.reasoning_effort };
  }

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ProviderHttpError("openai", res.status, text);
  }
  const data = (await res.json()) as {
    id?: string;
    output_text?: string;
    output?: Array<{
      type: string;
      content?: Array<{ type: string; text?: string }>;
    }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  let response: string | null = null;
  if (typeof data.output_text === "string" && data.output_text.length > 0) {
    response = data.output_text.trim();
  } else {
    for (const item of data.output ?? []) {
      if (item.type !== "message") continue;
      for (const c of item.content ?? []) {
        if (c.type === "output_text" && typeof c.text === "string") {
          response = c.text.trim();
          break;
        }
      }
      if (response) break;
    }
  }

  return {
    response,
    input_tokens: data.usage?.input_tokens ?? 0,
    output_tokens: data.usage?.output_tokens ?? 0,
    request_id: data.id ?? null,
  };
}

async function logCost(
  ctx: SpecialistCallContext | undefined,
  spec: SpecialistSpec,
  inputTokens: number,
  outputTokens: number,
  costUsd: number,
  requestId: string | null,
  extra: Record<string, unknown> = {}
): Promise<void> {
  if (!ctx?.cost?.supabaseAdmin) return;
  const { orgId, supabaseAdmin } = ctx.cost;
  await supabaseAdmin.from("ai_cost_log").insert({
    org_id: orgId,
    code_name: spec.code_name,
    model: spec.model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: costUsd,
    request_id: requestId,
    metadata: { smoke_test: true, role: spec.role, ...extra },
  });
}

async function callSpecialist(
  role: SpecialistRole,
  ctx?: SpecialistCallContext
): Promise<SpecialistOutput> {
  const spec = SPECS[role];
  const t0 = Date.now();
  try {
    const { value: r, attempts } = await callWithRetry(() =>
      spec.provider === "anthropic" ? callAnthropic(spec) : callOpenAI(spec)
    );
    const latency_ms = Date.now() - t0;
    const cost_usd = computeCostUsd(spec.model, r.input_tokens, r.output_tokens);

    await logCost(
      ctx,
      spec,
      r.input_tokens,
      r.output_tokens,
      cost_usd,
      r.request_id,
      { latency_ms, attempts }
    );

    return {
      role,
      model: spec.model,
      ok: true,
      response: r.response,
      latency_ms,
      attempts,
      cost: {
        input_tokens: r.input_tokens,
        output_tokens: r.output_tokens,
        cost_usd,
        request_id: r.request_id,
        code_name: spec.code_name,
        smoke_test: true,
      },
    };
  } catch (err) {
    const latency_ms = Date.now() - t0;
    let attempts = 1;
    let underlying: Error;
    if (err instanceof RetryExhaustedError) {
      attempts = err.attempts;
      underlying = err.cause;
    } else {
      underlying = err instanceof Error ? err : new Error(String(err));
    }
    return {
      role,
      model: spec.model,
      ok: false,
      response: null,
      latency_ms,
      attempts,
      cost: {
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
        request_id: null,
        code_name: spec.code_name,
        smoke_test: true,
      },
      error: underlying.message,
    };
  }
}

export function callInspector(_prompt: string, ctx?: SpecialistCallContext) {
  return callSpecialist("inspector", ctx);
}
export function callEngineer(_prompt: string, ctx?: SpecialistCallContext) {
  return callSpecialist("engineer", ctx);
}
export function callResearcher(_prompt: string, ctx?: SpecialistCallContext) {
  return callSpecialist("researcher", ctx);
}
export function callDevilsAdvocate(_prompt: string, ctx?: SpecialistCallContext) {
  return callSpecialist("devils_advocate", ctx);
}
export function callHistorian(_prompt: string, ctx?: SpecialistCallContext) {
  return callSpecialist("historian", ctx);
}
export function callSynthesizer(_prompt: string, ctx?: SpecialistCallContext) {
  return callSpecialist("synthesizer", ctx);
}

export const SPECIALIST_SPECS = SPECS;
export { SMOKE_TEST_PRICING, SMOKE_PROMPT };
