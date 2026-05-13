// ============================================================
// Sprint 4A — OpenAI embeddings wrapper
//
// Single entry point: embedText(text, opts). Mirrors the aiSpecialists.ts
// wrapper shape (ok / cost_usd / latency_ms / error). Embedding cost
// is logged to ai_cost_log under code_name 'cross_domain:embedding'.
//
// Model: text-embedding-3-large @ 1536 dimensions to match the
// vector(1536) column on cd_tenant_memory_index and cd_concept_graph
// (per the canonical migration DEPLOY355_cross_domain_foundation.sql).
//
// Retry policy mirrors specialists: transient 5xx + 529 retried with
// exponential backoff; 4xx surfaces immediately.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

// text-embedding-3-large pricing (Jan 2026 public): $0.13 / 1M input tokens.
const EMBEDDING_MODEL = "text-embedding-3-large";
const EMBEDDING_PRICE_PER_MTOK = 0.13;
const DEFAULT_DIMENSIONS = 1536;

// OpenAI embedding endpoint hard-limits input around 8192 tokens. We
// truncate by character count as a cheap proxy — average English token
// is ~4 chars, so 32000 chars is a safe ceiling.
const MAX_INPUT_CHARS = 32_000;

const EMBEDDING_RETRY_STATUSES = new Set([500, 502, 503, 504, 529]);

class EmbeddingHttpError extends Error {
  readonly status: number;
  constructor(status: number, body: string) {
    super(`openai embeddings ${status}: ${body.slice(0, 300)}`);
    this.name = "EmbeddingHttpError";
    this.status = status;
  }
}

interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  jitterPct: number;
}

function defaultRetryOptions(): RetryOptions {
  // Reuse the cross-domain retry tuning so tests can collapse the
  // 1s/2s/4s schedule via CROSS_DOMAIN_RETRY_BASE_MS=1.
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
      const retryable =
        err instanceof EmbeddingHttpError &&
        EMBEDDING_RETRY_STATUSES.has(err.status);
      if (!retryable || attempt > opts.maxRetries) {
        throw e;
      }
      const baseDelay = opts.baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = baseDelay * opts.jitterPct * (Math.random() * 2 - 1);
      console.warn(
        `[embedding retry] attempt ${attempt}/${opts.maxRetries + 1} status=${
          (err as EmbeddingHttpError).status
        }; backing off`
      );
      await sleep(Math.max(0, baseDelay + jitter));
    }
  }
  throw lastError ?? new Error("embedding retry loop exited unexpectedly");
}

export interface EmbeddingCostContext {
  orgId: string | null;
  supabaseAdmin: SupabaseClient;
}

export interface EmbedTextOptions {
  dimensions?: number;
  cost?: EmbeddingCostContext;
}

export interface EmbedTextResult {
  ok: boolean;
  embedding?: number[];
  cost_usd?: number;
  latency_ms: number;
  input_tokens?: number;
  truncated?: boolean;
  error?: string;
}

function truncateForEmbedding(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_INPUT_CHARS) return { text, truncated: false };
  console.warn(
    `[embedding] input ${text.length} chars exceeds ${MAX_INPUT_CHARS} char ceiling; truncating from the front`
  );
  return { text: text.slice(0, MAX_INPUT_CHARS), truncated: true };
}

async function logEmbeddingCost(
  ctx: EmbeddingCostContext | undefined,
  inputTokens: number,
  costUsd: number,
  extra: Record<string, unknown> = {}
): Promise<void> {
  if (!ctx) return;
  try {
    await ctx.supabaseAdmin.from("ai_cost_log").insert({
      org_id: ctx.orgId,
      code_name: "cross_domain:embedding",
      model: EMBEDDING_MODEL,
      input_tokens: inputTokens,
      output_tokens: 0,
      cost_usd: costUsd,
      request_id: null,
      metadata: { sprint: "4A", ...extra },
    });
  } catch (err) {
    // Cost logging is best-effort — never fail the embedding call.
    console.warn(
      `[embedding] ai_cost_log insert failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export async function embedText(
  rawText: string,
  opts: EmbedTextOptions = {}
): Promise<EmbedTextResult> {
  const t0 = Date.now();
  const dimensions = opts.dimensions ?? DEFAULT_DIMENSIONS;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      latency_ms: Date.now() - t0,
      error: "OPENAI_API_KEY not configured",
    };
  }

  if (!rawText || rawText.trim().length === 0) {
    return {
      ok: false,
      latency_ms: Date.now() - t0,
      error: "empty input text",
    };
  }

  const { text, truncated } = truncateForEmbedding(rawText);

  try {
    const { value } = await callWithRetry(async () => {
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: text,
          dimensions,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new EmbeddingHttpError(res.status, body);
      }
      const data = (await res.json()) as {
        data?: Array<{ embedding?: number[] }>;
        usage?: { prompt_tokens?: number };
      };
      const embedding = data.data?.[0]?.embedding;
      if (!Array.isArray(embedding) || embedding.length !== dimensions) {
        throw new EmbeddingHttpError(
          500,
          `response missing or wrong-dimension embedding (got ${
            embedding?.length ?? 0
          }, expected ${dimensions})`
        );
      }
      return {
        embedding,
        inputTokens: data.usage?.prompt_tokens ?? 0,
      };
    });

    const latency_ms = Date.now() - t0;
    const cost_usd =
      (value.inputTokens / 1_000_000) * EMBEDDING_PRICE_PER_MTOK;
    await logEmbeddingCost(opts.cost, value.inputTokens, cost_usd, {
      latency_ms,
      dimensions,
      truncated,
    });
    return {
      ok: true,
      embedding: value.embedding,
      cost_usd,
      latency_ms,
      input_tokens: value.inputTokens,
      truncated,
    };
  } catch (err) {
    const latency_ms = Date.now() - t0;
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, latency_ms, error: message };
  }
}

export const EMBEDDING_CONSTANTS = {
  EMBEDDING_MODEL,
  EMBEDDING_PRICE_PER_MTOK,
  DEFAULT_DIMENSIONS,
  MAX_INPUT_CHARS,
};
