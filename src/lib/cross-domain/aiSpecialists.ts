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
  DeliberationInput,
  SpecialistAnalysis,
  Claim,
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

interface AnthropicCallOpts {
  userPrompt: string;
  systemPrompt?: string;
  maxTokens: number;
  thinking?: { type: "enabled"; budget_tokens: number };
}

async function callAnthropic(
  spec: SpecialistSpec,
  opts: AnthropicCallOpts
): Promise<ProviderCallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const body: Record<string, unknown> = {
    model: spec.model,
    max_tokens: opts.maxTokens,
    messages: [{ role: "user", content: opts.userPrompt }],
  };
  if (opts.systemPrompt) body.system = opts.systemPrompt;
  if (opts.thinking) body.thinking = opts.thinking;

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

interface OpenAICallOpts {
  userPrompt: string;
  systemPrompt?: string;
  maxOutputTokens: number;
  reasoningEffort?: "low" | "medium" | "high";
  jsonMode?: boolean;
}

async function callOpenAI(
  spec: SpecialistSpec,
  opts: OpenAICallOpts
): Promise<ProviderCallResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const body: Record<string, unknown> = {
    model: spec.model,
    input: opts.systemPrompt
      ? `${opts.systemPrompt}\n\n${opts.userPrompt}`
      : opts.userPrompt,
    max_output_tokens: opts.maxOutputTokens,
  };
  if (opts.reasoningEffort) {
    body.reasoning = { effort: opts.reasoningEffort };
  }
  if (opts.jsonMode) {
    // Responses API json mode is configured under `text.format`.
    body.text = { format: { type: "json_object" } };
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
      spec.provider === "anthropic"
        ? callAnthropic(spec, {
            userPrompt: SMOKE_PROMPT,
            maxTokens: spec.thinking
              ? spec.thinking.budget_tokens + RESPONSE_TOKEN_ALLOWANCE
              : RESPONSE_TOKEN_ALLOWANCE,
            thinking: spec.thinking,
          })
        : callOpenAI(spec, {
            userPrompt: SMOKE_PROMPT,
            maxOutputTokens: spec.reasoning_effort
              ? 1024 + RESPONSE_TOKEN_ALLOWANCE
              : RESPONSE_TOKEN_ALLOWANCE,
            reasoningEffort: spec.reasoning_effort,
          })
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

// ============================================================
// Sprint 2 — Deliberation entry points
//
// Each deliberateAs<Role>() takes a DeliberationInput and returns
// the parsed SpecialistAnalysis. Production thinking budgets
// (16000 for engineer, 32000 for synthesizer) replace the 1024
// smoke values. Existing call<Role>() smoke-test entries are
// unchanged.
// ============================================================

const DELIBERATION_MAX_OUTPUT_TOKENS = 2000;

// Engineer + Synthesizer use production thinking budgets in
// deliberation mode. Sprint 3 will allow per-request override
// (e.g., to drop engineer to 8k under budget pressure).
const DELIBERATION_THINKING_BUDGETS: Partial<Record<SpecialistRole, number>> = {
  engineer: 16000,
  synthesizer: 32000,
};

function specForDeliberation(role: SpecialistRole): SpecialistSpec {
  const base = SPECS[role];
  const budget = DELIBERATION_THINKING_BUDGETS[role];
  if (budget !== undefined) {
    return { ...base, thinking: { type: "enabled", budget_tokens: budget } };
  }
  // Devil's Advocate stays on gpt-4o without reasoning in Sprint 2.
  // Sprint 3 may upgrade to o1/o3/gpt-5 + reasoning:high.
  if (role === "devils_advocate") {
    return { ...base, reasoning_effort: undefined };
  }
  return base;
}

const JSON_SCHEMA_INSTRUCTIONS = `Respond with VALID JSON ONLY — no markdown, no code fences, no prose. The JSON object MUST match this exact schema:

{
  "summary": "<1-3 sentence headline>",
  "claims": [
    {
      "text": "<assertion>",
      "confidence": <number 0..1>,
      "supporting_evidence_ids": ["<evidence id from EVIDENCE list>"],
      "cited_mechanism_codes": ["<mechanism_key from VOCABULARY list>"]
    }
  ],
  "open_questions": ["<unresolved question>"],
  "cited_mechanisms": ["<mechanism_key>"],
  "cited_evidence": ["<evidence id>"]
}

STRICT RULES:
- mechanism_keys MUST come verbatim from the controlled VOCABULARY list. Do not invent new keys.
- evidence ids MUST come from the EVIDENCE list. Do not invent ids.
- confidence reflects actual support strength; values below 0.5 are valid.
- If you have no claims with high confidence, still return a well-formed JSON object with whatever you can support.`;

const ROLE_INSTRUCTIONS: Record<SpecialistRole, string> = {
  inspector:
    "You are the INSPECTION specialist. You are the first specialist in the chain. Observe the raw anomaly and evidence; produce a structured initial assessment focused on what the evidence directly supports. Be concise.",
  engineer:
    "You are the SENIOR ENGINEERING specialist. Use extended thinking to rigorously map the observed anomaly to candidate degradation mechanisms. Cite high-confidence mechanisms where evidence is strong; explicitly mark uncertainty where evidence is thin. Your cited_mechanisms drive the downstream causal chain engine.",
  researcher:
    "You are the RESEARCH specialist. Add industry-context reasoning grounded in your training knowledge — do NOT assume external resources are available (Sprint 3 adds web_search_20250305). Compare candidate mechanisms against accepted industry knowledge or analogous published cases.",
  devils_advocate:
    "You are the ADVERSARIAL REVIEWER. Identify AT LEAST 3 specific objections to the prior analyses. Each objection should target a specific claim from a prior specialist and explain WHY that claim is weak (insufficient evidence, alternate mechanism unconsidered, scoping assumption, etc.). State each objection as a claim with confidence reflecting your confidence IN the objection itself (typically 0.6+). If you genuinely find no significant gaps, return a single claim with text starting with 'No significant gaps found:' and explain why the analysis is robust.",
  historian:
    "You are the HISTORICAL CASES specialist. The PRIOR ANALYSES section includes any analogous past cases pre-filtered by org+asset_type+mechanism overlap (Sprint 2 placeholder; Sprint 4 replaces with vector retrieval over tenant_memory_index). Compare/contrast the current anomaly with those cases and surface lessons.",
  synthesizer:
    "You are the SYNTHESIZER. You produce the final authoritative analysis. Consider ALL prior outputs plus the ARBITRATION decision in the prompt. If arbitration.status is 'flagged_dissent', LEAD your summary with the dissent and explicitly defend or concede each unresolved objection. If 'rejected_low_confidence', LABEL your summary 'LOW-CONFIDENCE ADVISORY' and produce best-guess output without overstating certainty.",
};

function buildUserPrompt(
  role: SpecialistRole,
  input: DeliberationInput,
  arbitration: { status: string; reason: string } | null
): string {
  const parts: string[] = [];
  parts.push("ANOMALY:");
  parts.push(JSON.stringify(input.anomaly, null, 2));
  parts.push("\nASSET:");
  parts.push(JSON.stringify(input.asset, null, 2));
  parts.push("\nEVIDENCE (up to 20 most recent):");
  parts.push(JSON.stringify(input.evidence, null, 2));
  parts.push("\nCONTROLLED MECHANISM VOCABULARY (cite these mechanism_keys only):");
  parts.push(JSON.stringify(input.mechanismVocabulary, null, 2));
  if (input.priorAnalyses.length > 0) {
    parts.push("\nPRIOR SPECIALIST ANALYSES (in chain order):");
    parts.push(
      JSON.stringify(
        input.priorAnalyses.map((a) => ({
          role: a.role,
          summary: a.summary,
          claims: a.claims,
          open_questions: a.open_questions,
          cited_mechanisms: a.cited_mechanisms,
        })),
        null,
        2
      )
    );
  }
  if (input.causalChain) {
    parts.push("\nCAUSAL CHAIN RESULT (rules-based, deterministic):");
    parts.push(JSON.stringify(input.causalChain, null, 2));
  }
  if (role === "historian" && input.analogousCases && input.analogousCases.length > 0) {
    parts.push("\nANALOGOUS PRIOR CASES (pre-filtered by org+asset_type+mechanism overlap, last 90 days):");
    parts.push(JSON.stringify(input.analogousCases, null, 2));
  }
  if (role === "synthesizer" && arbitration) {
    parts.push("\nARBITRATION DECISION:");
    parts.push(JSON.stringify(arbitration, null, 2));
  }
  parts.push("\nYOUR TASK: produce your specialist analysis as JSON matching the schema.");
  return parts.join("\n");
}

function buildSystemPrompt(role: SpecialistRole): string {
  return `${ROLE_INSTRUCTIONS[role]}\n\n${JSON_SCHEMA_INSTRUCTIONS}`;
}

// Extract the JSON object from a model response that may include
// markdown fences, leading prose, or trailing chatter.
function extractJsonObject(text: string): unknown | null {
  if (!text) return null;
  let candidate = text.trim();
  // Strip code fences if present.
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) candidate = fence[1].trim();
  // Find outermost {...} span.
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  candidate = candidate.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function isClaim(x: unknown): x is Claim {
  if (!x || typeof x !== "object") return false;
  const c = x as Record<string, unknown>;
  return (
    typeof c.text === "string" &&
    typeof c.confidence === "number" &&
    Array.isArray(c.supporting_evidence_ids) &&
    Array.isArray(c.cited_mechanism_codes)
  );
}

interface ParsedAnalysisFields {
  summary: string;
  claims: Claim[];
  open_questions: string[];
  cited_mechanisms: string[];
  cited_evidence: string[];
}

function validateAnalysisShape(parsed: unknown): ParsedAnalysisFields | null {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  if (typeof o.summary !== "string") return null;
  if (!Array.isArray(o.claims)) return null;
  if (!Array.isArray(o.open_questions)) return null;
  if (!Array.isArray(o.cited_mechanisms)) return null;
  if (!Array.isArray(o.cited_evidence)) return null;
  const claims = o.claims.filter(isClaim);
  return {
    summary: o.summary,
    claims,
    open_questions: o.open_questions.filter(
      (q): q is string => typeof q === "string"
    ),
    cited_mechanisms: o.cited_mechanisms.filter(
      (m): m is string => typeof m === "string"
    ),
    cited_evidence: o.cited_evidence.filter(
      (e): e is string => typeof e === "string"
    ),
  };
}

export interface SpecialistDeliberationResult {
  ok: boolean;
  analysis: SpecialistAnalysis;
  error?: string;
}

async function runProviderCall(
  spec: SpecialistSpec,
  userPrompt: string,
  systemPrompt: string
): Promise<{ value: ProviderCallResult; attempts: number }> {
  return callWithRetry(() => {
    if (spec.provider === "anthropic") {
      const maxTokens = spec.thinking
        ? spec.thinking.budget_tokens + DELIBERATION_MAX_OUTPUT_TOKENS
        : DELIBERATION_MAX_OUTPUT_TOKENS;
      return callAnthropic(spec, {
        userPrompt,
        systemPrompt,
        maxTokens,
        thinking: spec.thinking,
      });
    }
    const maxOutputTokens = spec.reasoning_effort
      ? 1024 + DELIBERATION_MAX_OUTPUT_TOKENS
      : DELIBERATION_MAX_OUTPUT_TOKENS;
    return callOpenAI(spec, {
      userPrompt,
      systemPrompt,
      maxOutputTokens,
      reasoningEffort: spec.reasoning_effort,
      jsonMode: true,
    });
  });
}

async function deliberate(
  role: SpecialistRole,
  input: DeliberationInput,
  arbitration: { status: string; reason: string } | null,
  ctx?: SpecialistCallContext
): Promise<SpecialistDeliberationResult> {
  const spec = specForDeliberation(role);
  const t0 = Date.now();
  const systemPrompt = buildSystemPrompt(role);
  const userPrompt = buildUserPrompt(role, input, arbitration);

  const emptyAnalysis = (raw: string): SpecialistAnalysis => ({
    role,
    model: spec.model,
    summary: "",
    claims: [],
    open_questions: [],
    cited_mechanisms: [],
    cited_evidence: [],
    cost_usd: 0,
    latency_ms: Date.now() - t0,
    attempts: 1,
    raw_response: raw,
  });

  let totalCostUsd = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let lastRequestId: string | null = null;
  let totalAttempts = 0;

  // Up to 2 LLM passes: 1 initial + 1 parse-failure retry with stricter instruction.
  for (let pass = 1; pass <= 2; pass++) {
    let r: ProviderCallResult;
    let httpAttempts: number;
    try {
      const passUserPrompt =
        pass === 1
          ? userPrompt
          : `${userPrompt}\n\nIMPORTANT: Your previous response was not valid JSON. Respond with VALID JSON ONLY matching the schema. No prose, no markdown.`;
      const result = await runProviderCall(spec, passUserPrompt, systemPrompt);
      r = result.value;
      httpAttempts = result.attempts;
    } catch (err) {
      const latency_ms = Date.now() - t0;
      let attempts = totalAttempts + 1;
      let underlying: Error;
      if (err instanceof RetryExhaustedError) {
        attempts = totalAttempts + err.attempts;
        underlying = err.cause;
      } else {
        underlying = err instanceof Error ? err : new Error(String(err));
      }
      const a: SpecialistAnalysis = {
        ...emptyAnalysis(""),
        latency_ms,
        attempts,
        cost_usd: totalCostUsd,
      };
      await logCost(
        ctx,
        spec,
        totalInputTokens,
        totalOutputTokens,
        totalCostUsd,
        lastRequestId,
        { deliberation: true, role, pass, error: underlying.message }
      );
      return { ok: false, analysis: a, error: underlying.message };
    }

    totalAttempts += httpAttempts;
    totalInputTokens += r.input_tokens;
    totalOutputTokens += r.output_tokens;
    totalCostUsd += computeCostUsd(spec.model, r.input_tokens, r.output_tokens);
    lastRequestId = r.request_id ?? lastRequestId;

    const parsed = validateAnalysisShape(extractJsonObject(r.response ?? ""));
    if (parsed) {
      const latency_ms = Date.now() - t0;
      const analysis: SpecialistAnalysis = {
        role,
        model: spec.model,
        summary: parsed.summary,
        claims: parsed.claims,
        open_questions: parsed.open_questions,
        cited_mechanisms: parsed.cited_mechanisms,
        cited_evidence: parsed.cited_evidence,
        cost_usd: totalCostUsd,
        latency_ms,
        attempts: totalAttempts,
        raw_response: r.response ?? "",
      };
      await logCost(
        ctx,
        spec,
        totalInputTokens,
        totalOutputTokens,
        totalCostUsd,
        lastRequestId,
        { deliberation: true, role, passes: pass, latency_ms }
      );
      return { ok: true, analysis };
    }
    // Parse failed; loop once more with stricter instruction (pass 2),
    // then give up.
  }

  // Both passes failed to produce valid JSON.
  const latency_ms = Date.now() - t0;
  const analysis: SpecialistAnalysis = {
    ...emptyAnalysis(""),
    latency_ms,
    attempts: totalAttempts,
    cost_usd: totalCostUsd,
  };
  await logCost(
    ctx,
    spec,
    totalInputTokens,
    totalOutputTokens,
    totalCostUsd,
    lastRequestId,
    { deliberation: true, role, parse_failed: true }
  );
  return {
    ok: false,
    analysis,
    error: "specialist returned invalid JSON after retry",
  };
}

export function deliberateAsInspector(
  input: DeliberationInput,
  ctx?: SpecialistCallContext
) {
  return deliberate("inspector", input, null, ctx);
}
export function deliberateAsEngineer(
  input: DeliberationInput,
  ctx?: SpecialistCallContext
) {
  return deliberate("engineer", input, null, ctx);
}
export function deliberateAsResearcher(
  input: DeliberationInput,
  ctx?: SpecialistCallContext
) {
  return deliberate("researcher", input, null, ctx);
}
export function deliberateAsDevilsAdvocate(
  input: DeliberationInput,
  ctx?: SpecialistCallContext
) {
  return deliberate("devils_advocate", input, null, ctx);
}
export function deliberateAsHistorian(
  input: DeliberationInput,
  ctx?: SpecialistCallContext
) {
  return deliberate("historian", input, null, ctx);
}
export function deliberateAsSynthesizer(
  input: DeliberationInput,
  arbitration: { status: string; reason: string },
  ctx?: SpecialistCallContext
) {
  return deliberate("synthesizer", input, arbitration, ctx);
}

// Exported for orchestrator/test access:
export {
  specForDeliberation,
  buildSystemPrompt,
  buildUserPrompt,
  extractJsonObject,
  validateAnalysisShape,
  computeCostUsd,
};
