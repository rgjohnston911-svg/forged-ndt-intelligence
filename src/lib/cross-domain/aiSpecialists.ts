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
  ExternalSource,
} from "./types";

const SMOKE_PROMPT = "Respond with the single word OK and nothing else.";

// The visible-output budget. Anthropic's max_tokens and OpenAI's
// max_output_tokens both count thinking/reasoning tokens too, so
// when thinking/reasoning is enabled we add this on top of the
// thinking budget rather than using it as the absolute cap.
// OpenAI Responses API requires max_output_tokens >= 16 for
// non-reasoning models (gpt-4o etc.). 20 gives us a small safety
// margin while keeping health-check responses tight ("OK").
const RESPONSE_TOKEN_ALLOWANCE = 20;

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

// Sprint 4 Polish 3 (Fix 3): Anthropic prompt-caching multipliers
// against the normal input-token rate (Anthropic public pricing):
//   - cache WRITE (cache_creation_input_tokens): 1.25× input rate
//   - cache READ  (cache_read_input_tokens):     0.10× input rate
//   - regular input_tokens:                      1.00× input rate
// When caching is active, `input_tokens` is ONLY the uncached portion;
// the cached portion appears in cache_read/cache_creation. So all three
// counts are additive — never double-count.
const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.1;

function computeCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadInputTokens: number = 0,
  cacheCreationInputTokens: number = 0
): number {
  const p = SMOKE_TEST_PRICING[model];
  if (!p) return 0;
  return (
    (inputTokens / 1_000_000) * p.input_per_mtok +
    (cacheCreationInputTokens / 1_000_000) *
      p.input_per_mtok *
      CACHE_WRITE_MULTIPLIER +
    (cacheReadInputTokens / 1_000_000) *
      p.input_per_mtok *
      CACHE_READ_MULTIPLIER +
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
  // Sprint 4 Polish 3 (Fix 3): Anthropic prompt-caching token counts.
  // cache_read = tokens served from a warm ephemeral cache (billed
  // 0.1×); cache_creation = tokens written to the cache this call
  // (billed 1.25×). Both 0 when caching wasn't used / wasn't a hit.
  // OpenAI calls leave these 0.
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  // Sprint 4B: populated when the response includes server_tool_use
  // / web_search_tool_result blocks. Undefined when tools weren't
  // enabled or the response didn't include any tool blocks.
  cited_sources?: ExternalSource[];
  searches_performed?: number;
  search_errors?: number;
}

// Sprint 4B: Anthropic server-side web_search tool spec. The brief
// uses max_uses: 3 to cap search cost at ~$0.03 per Researcher call.
export interface WebSearchToolConfig {
  type: "web_search_20250305";
  name: "web_search";
  max_uses: number;
}

interface AnthropicCallOpts {
  userPrompt: string;
  systemPrompt?: string;
  maxTokens: number;
  thinking?: { type: "enabled"; budget_tokens: number };
  tools?: WebSearchToolConfig[];
}

// Sprint 4B: parse the mixed-content array Anthropic returns when
// server-side tools are enabled. Concatenates text blocks (the
// model's natural-language output) and extracts citation metadata
// from server_tool_use / web_search_tool_result block pairs.
interface AnthropicContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: { query?: string };
  tool_use_id?: string;
  is_error?: boolean;
  // Sprint 4 Polish 3 (Fix 1): `content` is an ARRAY of web_search_result
  // items on success, but an OBJECT
  // {type:"web_search_tool_result_error", error_code:"..."} on error.
  // Confirmed against a real captured web_search response — see the
  // Fix 1 diagnosis in the PR body. The prior `Array<...>`-only type
  // hid the error shape and the parser silently swallowed search errors.
  content?: Array<Record<string, unknown>> | Record<string, unknown>;
  // Sprint 4 Polish (Fix C): text blocks carry citations[] arrays
  // pointing back to web_search results with cited_text — that's
  // where the human-readable snippet actually lives. Confirmed shape:
  // each entry is {type:"web_search_result_location", cited_text, url,
  // title, encrypted_index}; cited_text holds the human-readable excerpt.
  citations?: Array<Record<string, unknown>>;
}

// Sprint 4 Polish (Fix C): centralized snippet picker. Anthropic's
// web_search_result items expose encrypted_content (opaque) and
// occasionally other text fields; the readable snippet usually lives
// on text-block citations (cited_text). This helper picks the first
// non-empty plausible field, with truncation to 500 chars for storage.
function pickSnippet(
  ...candidates: Array<unknown>
): string | undefined {
  for (const c of candidates) {
    if (typeof c === "string") {
      const trimmed = c.trim();
      if (trimmed.length > 0) {
        return trimmed.length > 500 ? trimmed.slice(0, 500) : trimmed;
      }
    }
  }
  return undefined;
}

// Sprint 4 Polish (Fix D) + Polish 2 (Fix 4): defensive against
// markdown-wrapped URLs. Production smoke-test still showed
// `[www.researchgate.net](https://www.researchgate.net)` in some
// domain fields after Polish 1's Fix D — meaning a URL ingress path
// was missed. Fix 4 makes the unwrap chain comprehensive: markdown
// link, angle brackets, AND trailing punctuation (the model
// sometimes emits URLs followed by `,` / `.` / `;` in prose, and
// citation URLs can inherit that). Loop runs to fixpoint so chained
// wrappings (e.g., `<[host](url)>.`) collapse correctly.
function unwrapUrl(raw: string): string {
  let s = raw.trim();
  for (let i = 0; i < 6; i++) {
    const before = s;
    // Strip prose-trailing punctuation FIRST so the markdown/angle
    // unwrap can match the inner form. ) and ] are intentionally
    // EXCLUDED — they belong to markdown link / angle bracket
    // delimiters that the next two rules consume.
    const trailing = s.match(/^(.+?)[.,;:]$/);
    if (trailing) s = trailing[1];
    const mdLink = s.match(/^\[[^\]]*\]\(([^)\s]+)\)$/);
    if (mdLink) s = mdLink[1];
    const angle = s.match(/^<(.+)>$/);
    if (angle) s = angle[1];
    s = s.trim();
    if (s === before) break;
  }
  return s;
}

function extractHostname(url: string): string | undefined {
  try {
    return new URL(unwrapUrl(url)).hostname;
  } catch {
    return undefined;
  }
}

function parseAnthropicMixedContent(
  blocks: AnthropicContentBlock[]
): {
  text: string;
  cited_sources: ExternalSource[];
  searches_performed: number;
  search_errors: number;
} {
  let combinedText = "";
  // tool_use_id -> the search query that produced the result
  const queryByToolUseId = new Map<string, string>();
  // Sprint 4 Polish 2 (Fix 3): production smoke-test had 0/30 sources
  // with snippets even though my Sprint 4 Polish (Fix C) parser
  // harvested text-block citations. Hypothesis: Anthropic's actual
  // response embeds snippet-bearing citations at MULTIPLE nesting
  // levels (text blocks' citations[]; web_search_tool_result content
  // items themselves carrying cited_text; or under nested content[]
  // sub-arrays). The previous parser only handled one location.
  //
  // New approach: harvest defensively in two passes.
  //   Pass 1: walk EVERY block recursively, collect URL→snippet pairs
  //           from any object that has a `url` AND any text-like field.
  //           Index by canonical (hostname+path) URL key AND by
  //           hostname-only as a fallback so near-match URLs still hit.
  //   Pass 2: walk web_search_tool_result blocks to emit sources,
  //           pulling snippets from the harvested maps.
  const snippetByUrlKey = new Map<string, string>();
  const snippetByHostname = new Map<string, string>();
  let searches = 0;
  let errors = 0;

  const canonicalUrlKey = (url: string): string => {
    try {
      const u = new URL(unwrapUrl(url));
      return `${u.hostname}${u.pathname}`.replace(/\/$/, "");
    } catch {
      return url.trim();
    }
  };

  // Pass 1a: collect anything that looks like a citation object.
  // Recursive walker — Anthropic's response is deeply nested in
  // ways that may evolve (citations on text blocks, on result items,
  // on nested content arrays). Walking generically protects against
  // shape drift between API versions.
  const SNIPPET_FIELDS = [
    "cited_text",
    "text",
    "snippet",
    "excerpt",
    "description",
    "summary",
  ];
  const harvestFrom = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) harvestFrom(item);
      return;
    }
    const obj = node as Record<string, unknown>;
    // If this object has a URL, see if any text-like sibling field is
    // populated, and harvest the snippet.
    const rawUrl = typeof obj.url === "string" ? obj.url : "";
    if (rawUrl) {
      const url = unwrapUrl(rawUrl);
      const snippetCandidates = SNIPPET_FIELDS.map((k) => obj[k]);
      const snippet = pickSnippet(...snippetCandidates);
      if (snippet) {
        const key = canonicalUrlKey(url);
        if (!snippetByUrlKey.has(key)) snippetByUrlKey.set(key, snippet);
        const host = extractHostname(url);
        if (host && !snippetByHostname.has(host)) {
          snippetByHostname.set(host, snippet);
        }
      }
    }
    // Recurse into nested arrays / objects under known sub-keys.
    // Don't recurse into encrypted_content — it's opaque base64 the
    // model reads but humans cannot, and walking it wastes work.
    for (const [k, v] of Object.entries(obj)) {
      if (k === "encrypted_content") continue;
      if (v && typeof v === "object") harvestFrom(v);
    }
  };

  // Pass 1b: walk top-level blocks, gather text + search counts,
  // and harvest citations along the way.
  for (const block of blocks) {
    if (block.type === "text" && typeof block.text === "string") {
      combinedText += (combinedText ? "\n" : "") + block.text;
    } else if (
      block.type === "server_tool_use" &&
      (block.name === "web_search" || block.name === undefined)
    ) {
      searches++;
      const id = block.id ?? "";
      const query = block.input?.query ?? "";
      if (id) queryByToolUseId.set(id, query);
    }
    harvestFrom(block);
  }

  // Pass 2: emit sources from web_search_tool_result blocks, pulling
  // snippets from the harvested maps.
  const sources: ExternalSource[] = [];
  for (const block of blocks) {
    if (block.type !== "web_search_tool_result") continue;
    // Sprint 4 Polish 3 (Fix 1): errored web_search_tool_result blocks
    // carry `content` as an OBJECT
    // {type:"web_search_tool_result_error", error_code:"..."} — NOT a
    // block-level is_error flag and NOT an array. Confirmed against a
    // real captured response. The prior code only checked block.is_error
    // (never set by the API) and treated a non-array content as []
    // — so genuine search errors (max_uses_exceeded, unavailable, etc.)
    // were silently swallowed as 0 sources / 0 errors. We now detect
    // both: the legacy is_error flag AND the real error-content shape.
    const content = block.content;
    const isErrorContent =
      !!content &&
      !Array.isArray(content) &&
      typeof content === "object" &&
      (content as Record<string, unknown>).type ===
        "web_search_tool_result_error";
    if (block.is_error || isErrorContent) {
      errors++;
      if (isErrorContent) {
        const code = (content as Record<string, unknown>).error_code;
        console.warn(
          `[web_search] tool_result_error code=${
            typeof code === "string" ? code : "unknown"
          } — proceeding with whatever other results parsed`
        );
      }
      continue;
    }
    const searchQuery = block.tool_use_id
      ? queryByToolUseId.get(block.tool_use_id)
      : undefined;
    const results = Array.isArray(content) ? content : [];
    for (const r of results) {
      const recordType = String(r.type ?? "");
      if (recordType !== "web_search_result") continue;
      const rawUrl = typeof r.url === "string" ? r.url : "";
      if (!rawUrl) continue;
      const url = unwrapUrl(rawUrl);
      const domain = extractHostname(url);
      // Try in order: canonical URL key (most precise), hostname-only
      // (catches paths that differ slightly), then this result's own
      // text-like fields. encrypted_content is intentionally excluded —
      // see harvestFrom().
      const fromUrlKey = snippetByUrlKey.get(canonicalUrlKey(url));
      const fromHostname = domain
        ? snippetByHostname.get(domain)
        : undefined;
      const snippet = pickSnippet(
        fromUrlKey,
        fromHostname,
        r.cited_text,
        r.text,
        r.snippet,
        r.excerpt,
        r.description
      );
      const source: ExternalSource = {
        url,
        title: typeof r.title === "string" ? r.title : undefined,
        snippet,
        domain,
        search_query: searchQuery,
        page_age: typeof r.page_age === "string" ? r.page_age : undefined,
      };
      // Sprint 4 Polish 3 (Fix 2): defense-in-depth guard. `domain` is
      // ALWAYS derived above via extractHostname(unwrapUrl(...)), which
      // cannot itself emit bracket/paren chars (URL.hostname never
      // contains them, and a parse failure yields undefined). The audit
      // confirmed this is the sole domain-assignment path. But the
      // production smoke test reported a markdown-wrapped domain, so —
      // belt and suspenders — if `domain` ever contains [, ], ( or ),
      // log it and re-derive from the (already-unwrapped) url. Cheap
      // insurance against a future code path or API-shape change.
      if (source.domain && /[[\]()]/.test(source.domain)) {
        console.warn(
          `[web_search] domain field contained markup ("${source.domain}") — re-deriving from url`
        );
        source.domain = extractHostname(unwrapUrl(source.url));
      }
      sources.push(source);
    }
  }

  return {
    text: combinedText.trim(),
    cited_sources: sources,
    searches_performed: searches,
    search_errors: errors,
  };
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
  // Sprint 4 Polish 3 (Fix 3): send the system prompt as a single
  // content block with cache_control: ephemeral. The 5 Anthropic
  // specialists' system prompts are static 1.5-3.5k tokens re-sent on
  // every call; ephemeral caching bills cache HITS at ~10% of the
  // normal input rate (and the ~5-minute TTL stays warm across the
  // back-to-back calls of smoke tests / regression suites). User
  // messages stay plain strings — they vary per deliberation and
  // aren't usefully cacheable.
  if (opts.systemPrompt) {
    body.system = [
      {
        type: "text",
        text: opts.systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ];
  }
  if (opts.thinking) body.thinking = opts.thinking;
  if (opts.tools && opts.tools.length > 0) body.tools = opts.tools;

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
    content?: AnthropicContentBlock[];
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      // Sprint 4 Polish 3 (Fix 3): prompt-caching token counts.
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
  const blocks = data.content ?? [];
  const cache_read_input_tokens = data.usage?.cache_read_input_tokens ?? 0;
  const cache_creation_input_tokens =
    data.usage?.cache_creation_input_tokens ?? 0;

  // Sprint 4B: when tools are enabled we must walk the full content
  // array (text blocks interleaved with server_tool_use /
  // web_search_tool_result). The pure-text path is preserved as a
  // fast path for specialists without tools.
  if (opts.tools && opts.tools.length > 0) {
    const parsed = parseAnthropicMixedContent(blocks);
    return {
      response: parsed.text.length > 0 ? parsed.text : null,
      input_tokens: data.usage?.input_tokens ?? 0,
      output_tokens: data.usage?.output_tokens ?? 0,
      request_id: data.id ?? null,
      cache_read_input_tokens,
      cache_creation_input_tokens,
      cited_sources: parsed.cited_sources,
      searches_performed: parsed.searches_performed,
      search_errors: parsed.search_errors,
    };
  }
  const textBlock = blocks.find((b) => b.type === "text");
  return {
    response: textBlock?.text?.trim() ?? null,
    input_tokens: data.usage?.input_tokens ?? 0,
    output_tokens: data.usage?.output_tokens ?? 0,
    request_id: data.id ?? null,
    cache_read_input_tokens,
    cache_creation_input_tokens,
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
    // Sprint 4 Polish 3 (Fix 3): cache_read_input_tokens /
    // cache_creation_input_tokens flow through `extra` from the call
    // sites so the ai_cost_log row records prompt-cache hit/write
    // counts — the smoke test reads these to confirm caching fired.
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
    const cacheRead = r.cache_read_input_tokens ?? 0;
    const cacheCreation = r.cache_creation_input_tokens ?? 0;
    const cost_usd = computeCostUsd(
      spec.model,
      r.input_tokens,
      r.output_tokens,
      cacheRead,
      cacheCreation
    );

    await logCost(
      ctx,
      spec,
      r.input_tokens,
      r.output_tokens,
      cost_usd,
      r.request_id,
      {
        latency_ms,
        attempts,
        cache_read_input_tokens: cacheRead,
        cache_creation_input_tokens: cacheCreation,
      }
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

// Sprint 4B: Anthropic web_search server-side tool. $0.01 per search,
// independent of token cost. Researcher gets max_uses: 3 → ≤$0.03 of
// search cost per call. Token cost increases too because tool results
// inflate input tokens.
const WEB_SEARCH_COST_PER_CALL_USD = 0.01;
const WEB_SEARCH_MAX_USES = 3;
// Larger output budget for Researcher when tools are enabled — the
// model interleaves narration with tool calls before producing the
// final JSON, so 2000 (the regular DELIBERATION_MAX_OUTPUT_TOKENS) is
// tight. Brief Part 3a calls for 4096.
const RESEARCHER_WEB_SEARCH_MAX_TOKENS = 4096;

// Sprint 4 Polish 4 Phase 1 (Lever 1): Historian-specific output
// budget. Historian runs near the end of the chain — its prompt
// carries Inspector + Engineer + Researcher + Devil's Advocate
// outputs plus the retrieved analogous-case memory artifacts
// (~38k input tokens in production). At the regular 2000-token
// DELIBERATION_MAX_OUTPUT_TOKENS budget its JSON response truncated
// mid-structure on BOTH passes (the 4000 seen in ai_cost_log.metadata
// was the 2-pass sum), yielding parse_failed: true and empty
// claims/cited_evidence. 8000 gives generous headroom; the prompt-side
// constraints (Levers 2+3 below) attack the verbosity cause so the
// model should land well under this ceiling. Scoped to Historian
// ONLY — the global DELIBERATION_MAX_OUTPUT_TOKENS is deliberately
// left untouched (changing it would also affect Inspector and the
// Researcher/DA base budget — out of scope for this one-fix PR).
const HISTORIAN_MAX_OUTPUT_TOKENS = 8000;

function getWebSearchToolsForRole(
  role: SpecialistRole
): WebSearchToolConfig[] | undefined {
  if (role !== "researcher") return undefined;
  return [
    {
      type: "web_search_20250305",
      name: "web_search",
      max_uses: WEB_SEARCH_MAX_USES,
    },
  ];
}

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
    "You are the RESEARCH specialist. You have access to a web_search tool. Use it 1-3 times to find: (a) current industry standards, recommended practices, or code clauses relevant to the candidate mechanisms (ASME, API, NACE, ASNT, ISO, IMCA, ABS, DNV, etc.); (b) recent (2023-2026) technical papers, vendor bulletins, or industry case studies; (c) regulatory advisories or incident reports. Prefer authoritative sources over generic blog posts. Reference each source inline in your claim text using natural citations (e.g., 'per ASME PVP-2024-89234' or 'per NACE SP0169-2013 §6.4') so readers can match the citation to the structured source list. For each source you cite, the wrapper auto-captures the URL and search query. If web_search returns no useful results, say so explicitly in your output rather than fabricating sources. Do not invent URLs.",
  devils_advocate:
    "You are the ADVERSARIAL REVIEWER. Identify AT LEAST 3 specific objections to the prior analyses. Each objection should target a specific claim from a prior specialist and explain WHY that claim is weak (insufficient evidence, alternate mechanism unconsidered, scoping assumption, etc.). State each objection as a claim with confidence reflecting your confidence IN the objection itself (typically 0.6+). If you genuinely find no significant gaps, return a single claim with text starting with 'No significant gaps found:' and explain why the analysis is robust.",
  historian:
    "You are the HISTORICAL CASES specialist. The ANALOGOUS PRIOR CASES section contains tenant-memory reasoning artifacts (synthesizer summaries and high-confidence specialist claims from past deliberations) retrieved by semantic similarity over the cd_tenant_memory_index. Each case includes text_content, the originating deliberation's consensus outcome, cited mechanisms, and similarity score. Your tasks: (1) summarize what these prior cases suggest about the current anomaly, (2) note mechanism patterns that recur across cases, (3) compare/contrast each case with the current anomaly. If the ANALOGOUS PRIOR CASES section is empty or absent, this is a cold-start tenant — produce a useful output that explicitly states 'No analogous prior cases in tenant memory; reasoning from current evidence and the degradation mechanism database only.' Do NOT fabricate prior cases. " +
    // Sprint 4 Polish 4 Phase 1 (Lever 2): tighten output to attack the
    // verbosity CAUSE of the JSON truncation, not just the symptom.
    "OUTPUT CONSTRAINTS: " +
    "- Reference AT MOST 5 analogous cases from memory retrieval. " +
    "- For each case, keep the summary to AT MOST 100 words. " +
    "- Cite a recurring mechanism pattern ONCE, not once per case. " +
    "- Do NOT repeat content from prior specialists' outputs — assume the reader already has them. " +
    "- Do NOT enumerate every cited mechanism — focus on the 3 most relevant. " +
    "- Keep your total output under 3000 tokens. " +
    // Sprint 4 Polish 4 Phase 1 (Lever 3): make the model budget its
    // output and prioritize JSON validity over additional content.
    "CRITICAL: Your response MUST be valid JSON that parses cleanly. If you approach the output limit, prioritize completing the JSON structure over including additional content. Better to return fewer claims with valid JSON than more claims with truncated JSON.",
  synthesizer:
    "You are the SYNTHESIZER. You produce the final authoritative analysis. Consider ALL prior outputs plus the ARBITRATION decision in the prompt. If arbitration.status is 'rejected_low_confidence', LABEL your summary 'LOW-CONFIDENCE ADVISORY' and produce best-guess output without overstating certainty. " +
    "SPRINT 4C CONSEQUENCE PROFILE: If the prompt contains a CONSEQUENCE PROFILE section, it is the deterministic, rules-based risk quantification produced by the consequence engine. Treat its numbers (tiers, dollar ranges, hours-of-downtime, time-to-consequence days, recommended_action_tier) as AUTHORITATIVE. Your job is to (a) state the recommended_action_tier explicitly in your summary, (b) state the overall_tier with the worst-case category, (c) provide narrative context explaining WHY each consequence tier applies — cite evidence from prior specialists and the cited_mechanisms — and (d) if any category had estimated_value: null, explain in your open_questions what additional data would unlock that category. Do NOT override, contradict, or re-estimate any numerical value the consequence engine produced. If no CONSEQUENCE PROFILE section is present, the engine failed or wasn't run — proceed with diagnostic-only output and note the gap in open_questions. " +
    // Sprint 4 Polish 2 (Fix 5): explicit priority order resolves the
    // conflict between the Polish 1 code-first directive and the older
    // "LEAD with dissent on flagged_dissent" directive — production
    // showed the dissent prefix winning, pushing the code citation
    // into the second sentence. Code citation ALWAYS leads now;
    // dissent acknowledgment moves to a second paragraph when needed.
    "SPRINT 4 POLISH 2 (Fix 5) — SUMMARY STRUCTURE (in this strict priority order, applied to the `summary` text): " +
    "(1) FIRST SENTENCE: open with the authoritative standard(s) the analysis anchors to. Example: 'Per API 579-1/ASME FFS-1 Part 5 and DNV-RP-F101, this anomaly …'. Pick from API, ASME, NACE, ASNT, DNV, PHMSA, BSEE, CFR, ISO, IMCA, ABS, or similar authoritative bodies as appropriate. Never lead with the dissent. Always lead with the code citation. " +
    "(2) SECOND PARAGRAPH (only if arbitration.status is 'flagged_dissent' or consensus is 'majority_with_dissent' / 'split'): acknowledge the dissent in 1-2 sentences using the explicit prefix 'DISSENT ADDRESSED:'. Then immediately pivot back to the code-anchored analysis. Skip this paragraph entirely when consensus is 'unanimous' or arbitration is 'accepted'. " +
    "(3) THIRD PARAGRAPH (WHY): the engineering/physical reasoning that connects evidence to the cited standard (e.g., 'because cathodic shielding under disbonded coatings prevents CP current from reaching the steel surface …'). " +
    "(4) FOURTH PARAGRAPH (HOW): the practical action — recommended_action_tier explicitly stated, specific next steps, and what additional data would close any confidence gaps (e.g., 'Recommended action: urgent_assessment. Conduct a Level 2 FFS per API 579-1, regrid UT at 25 mm spacing, retrofit anodes given the > 70% depletion at KP 2.45.'). " +
    "Apply this four-part structure to the HEADLINE conclusions only — do not repeat for every minor point. The `claims` array stays structured / machine-readable; only the `summary` prose changes shape.",
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
  // Sprint 4C: downstream specialists (Researcher, DA, Historian,
  // Synthesizer) all see the deterministic consequence profile when
  // the engine succeeded. Inspector and Engineer ran before the
  // engine fired so they don't get it.
  if (
    input.consequenceProfile &&
    role !== "inspector" &&
    role !== "engineer"
  ) {
    parts.push(
      "\nCONSEQUENCE PROFILE (rules-based, deterministic — DO NOT override or re-estimate the numerical values):"
    );
    parts.push(JSON.stringify(input.consequenceProfile, null, 2));
  }
  if (role === "historian") {
    if (input.analogousCases && input.analogousCases.length > 0) {
      // Sprint 4A: cases come from vector retrieval over cd_tenant_memory_index.
      // Each item is a MemoryRecord projection — text_content is the actual
      // embedded reasoning artifact (synth summary or specialist claim).
      parts.push(
        "\nANALOGOUS PRIOR CASES (vector retrieval over tenant memory, top-K by cosine similarity):"
      );
      parts.push(JSON.stringify(input.analogousCases, null, 2));
    } else {
      parts.push(
        "\nANALOGOUS PRIOR CASES: (none — cold-start tenant or no semantically similar prior reasoning in cd_tenant_memory_index)"
      );
    }
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
  systemPrompt: string,
  tools?: WebSearchToolConfig[]
): Promise<{ value: ProviderCallResult; attempts: number }> {
  return callWithRetry(() => {
    if (spec.provider === "anthropic") {
      // Sprint 4 Polish 4 Phase 1 (Lever 1): per-role output budget.
      // Researcher-with-tools and Historian each get a wider budget
      // than the regular DELIBERATION_MAX_OUTPUT_TOKENS; every other
      // Anthropic specialist keeps the default.
      let baseOutputBudget: number;
      if (tools && tools.length > 0) {
        baseOutputBudget = RESEARCHER_WEB_SEARCH_MAX_TOKENS;
      } else if (spec.role === "historian") {
        baseOutputBudget = HISTORIAN_MAX_OUTPUT_TOKENS;
      } else {
        baseOutputBudget = DELIBERATION_MAX_OUTPUT_TOKENS;
      }
      const maxTokens = spec.thinking
        ? spec.thinking.budget_tokens + baseOutputBudget
        : baseOutputBudget;
      return callAnthropic(spec, {
        userPrompt,
        systemPrompt,
        maxTokens,
        thinking: spec.thinking,
        tools,
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

// Determine why a parse attempt failed, given the raw model response.
// Returns a short, actionable diagnostic the caller can persist into
// SpecialistAnalysis.parse_error.
function diagnoseParseFailure(rawResponse: string | null | undefined): string {
  if (rawResponse === null || rawResponse === undefined) {
    return "model returned null content";
  }
  if (rawResponse.length === 0) {
    return "model returned empty content";
  }
  const trimmed = rawResponse.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return "no JSON object braces found in response";
  }
  try {
    JSON.parse(trimmed.slice(start, end + 1));
  } catch (e) {
    return `JSON.parse: ${e instanceof Error ? e.message : String(e)}`;
  }
  return "parsed JSON did not match SpecialistAnalysis schema";
}

async function deliberate(
  role: SpecialistRole,
  input: DeliberationInput,
  arbitration: { status: string; reason: string } | null,
  ctx?: SpecialistCallContext
): Promise<SpecialistDeliberationResult> {
  const spec = specForDeliberation(role);
  const tools = getWebSearchToolsForRole(role);
  const t0 = Date.now();
  const systemPrompt = buildSystemPrompt(role);
  const userPrompt = buildUserPrompt(role, input, arbitration);

  let totalCostUsd = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  // Sprint 4 Polish 3 (Fix 3): accumulate prompt-cache token counts
  // across the (up to 2) passes so cost + ai_cost_log reflect cache
  // hits/writes.
  let totalCacheReadTokens = 0;
  let totalCacheCreationTokens = 0;
  let lastRequestId: string | null = null;
  let totalAttempts = 0;
  // Sprint 3.2 — accumulate the raw text across passes so we never
  // throw it away on parse failure. The last non-empty response wins.
  let accumulatedRawResponse = "";
  // Sprint 4B — accumulate citations + search counts across passes.
  // Search cost is added to totalCostUsd as searches occur so an
  // early http_error path still surfaces it.
  const accumulatedSources: ExternalSource[] = [];
  let totalSearchesPerformed = 0;
  let totalSearchErrors = 0;

  // Up to 2 LLM passes: 1 initial + 1 parse-failure retry with stricter
  // instruction. We only do the retry pass when the model returned
  // SOME text that failed to parse — an empty response means refusal or
  // a malformed request, both of which won't be fixed by retrying.
  for (let pass = 1; pass <= 2; pass++) {
    let r: ProviderCallResult;
    let httpAttempts: number;
    try {
      const passUserPrompt =
        pass === 1
          ? userPrompt
          : `${userPrompt}\n\nIMPORTANT: Your previous response was not valid JSON. Respond with VALID JSON ONLY matching the schema. No prose, no markdown.`;
      const result = await runProviderCall(
        spec,
        passUserPrompt,
        systemPrompt,
        tools
      );
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
        role,
        model: spec.model,
        summary: "",
        claims: [],
        open_questions: [],
        cited_mechanisms: [],
        cited_evidence: [],
        cost_usd: totalCostUsd,
        latency_ms,
        attempts,
        raw_response: accumulatedRawResponse,
        parse_error: `http_error: ${underlying.message}`,
        ...(tools
          ? {
              cited_sources: accumulatedSources,
              searches_performed: totalSearchesPerformed,
            }
          : {}),
      };
      await logCost(
        ctx,
        spec,
        totalInputTokens,
        totalOutputTokens,
        totalCostUsd,
        lastRequestId,
        {
          deliberation: true,
          role,
          pass,
          error: underlying.message,
          cache_read_input_tokens: totalCacheReadTokens,
          cache_creation_input_tokens: totalCacheCreationTokens,
          ...(tools
            ? {
                searches_performed: totalSearchesPerformed,
                search_errors: totalSearchErrors,
              }
            : {}),
        }
      );
      console.warn(
        `[deliberate ${role}] http_error pass=${pass} attempts=${attempts} cost=$${totalCostUsd.toFixed(4)} err=${underlying.message}`
      );
      return { ok: false, analysis: a, error: underlying.message };
    }

    totalAttempts += httpAttempts;
    totalInputTokens += r.input_tokens;
    totalOutputTokens += r.output_tokens;
    totalCacheReadTokens += r.cache_read_input_tokens ?? 0;
    totalCacheCreationTokens += r.cache_creation_input_tokens ?? 0;
    totalCostUsd += computeCostUsd(
      spec.model,
      r.input_tokens,
      r.output_tokens,
      r.cache_read_input_tokens ?? 0,
      r.cache_creation_input_tokens ?? 0
    );
    // Sprint 4B: web_search results are billed per search ($0.01).
    // r.searches_performed is undefined when tools weren't enabled,
    // 0 when tools were enabled but the model didn't search.
    if (typeof r.searches_performed === "number" && r.searches_performed > 0) {
      totalCostUsd += r.searches_performed * WEB_SEARCH_COST_PER_CALL_USD;
      totalSearchesPerformed += r.searches_performed;
    }
    if (typeof r.search_errors === "number" && r.search_errors > 0) {
      totalSearchErrors += r.search_errors;
      console.warn(
        `[deliberate ${role}] web_search returned ${r.search_errors} tool error(s) — proceeding with whatever results parsed`
      );
    }
    if (r.cited_sources && r.cited_sources.length > 0) {
      accumulatedSources.push(...r.cited_sources);
    }
    lastRequestId = r.request_id ?? lastRequestId;
    const rawThisPass = r.response ?? "";
    if (rawThisPass.length > 0) {
      accumulatedRawResponse = rawThisPass;
    }

    const parsed = validateAnalysisShape(extractJsonObject(rawThisPass));
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
        raw_response: rawThisPass,
        ...(tools
          ? {
              cited_sources: accumulatedSources,
              searches_performed: totalSearchesPerformed,
            }
          : {}),
      };
      await logCost(
        ctx,
        spec,
        totalInputTokens,
        totalOutputTokens,
        totalCostUsd,
        lastRequestId,
        {
          deliberation: true,
          role,
          passes: pass,
          latency_ms,
          cache_read_input_tokens: totalCacheReadTokens,
          cache_creation_input_tokens: totalCacheCreationTokens,
          ...(tools
            ? {
                searches_performed: totalSearchesPerformed,
                search_errors: totalSearchErrors,
              }
            : {}),
        }
      );
      return { ok: true, analysis };
    }

    // Parse failed. Empty content is a hard stop — retrying won't
    // change refusal/policy/malformed-request outcomes.
    if (rawThisPass.length === 0) {
      const latency_ms = Date.now() - t0;
      const parseError = "model returned empty content";
      const analysis: SpecialistAnalysis = {
        role,
        model: spec.model,
        summary: "",
        claims: [],
        open_questions: [],
        cited_mechanisms: [],
        cited_evidence: [],
        cost_usd: totalCostUsd,
        latency_ms,
        attempts: totalAttempts,
        raw_response: "",
        parse_error: parseError,
        ...(tools
          ? {
              cited_sources: accumulatedSources,
              searches_performed: totalSearchesPerformed,
            }
          : {}),
      };
      await logCost(
        ctx,
        spec,
        totalInputTokens,
        totalOutputTokens,
        totalCostUsd,
        lastRequestId,
        {
          deliberation: true,
          role,
          empty_content: true,
          cache_read_input_tokens: totalCacheReadTokens,
          cache_creation_input_tokens: totalCacheCreationTokens,
          ...(tools
            ? {
                searches_performed: totalSearchesPerformed,
                search_errors: totalSearchErrors,
              }
            : {}),
        }
      );
      console.warn(
        `[deliberate ${role}] empty_content pass=${pass} attempts=${totalAttempts} cost=$${totalCostUsd.toFixed(4)} model=${spec.model}`
      );
      return { ok: false, analysis, error: parseError };
    }
    // Model produced text but it didn't parse — loop once more with
    // the stricter instruction. Second failure falls through below.
  }

  // Both passes failed to parse despite non-empty content. Preserve
  // the model's actual output for diagnosis (Sprint 3.2: this used
  // to be silently discarded as `raw_response: ""`).
  const latency_ms = Date.now() - t0;
  const parseError = diagnoseParseFailure(accumulatedRawResponse);
  const analysis: SpecialistAnalysis = {
    role,
    model: spec.model,
    summary: "",
    claims: [],
    open_questions: [],
    cited_mechanisms: [],
    cited_evidence: [],
    cost_usd: totalCostUsd,
    latency_ms,
    attempts: totalAttempts,
    raw_response: accumulatedRawResponse,
    parse_error: parseError,
    ...(tools
      ? {
          cited_sources: accumulatedSources,
          searches_performed: totalSearchesPerformed,
        }
      : {}),
  };
  await logCost(
    ctx,
    spec,
    totalInputTokens,
    totalOutputTokens,
    totalCostUsd,
    lastRequestId,
    {
      deliberation: true,
      role,
      parse_failed: true,
      parse_error: parseError,
      cache_read_input_tokens: totalCacheReadTokens,
      cache_creation_input_tokens: totalCacheCreationTokens,
      ...(tools
        ? {
            searches_performed: totalSearchesPerformed,
            search_errors: totalSearchErrors,
          }
        : {}),
    }
  );
  console.warn(
    `[deliberate ${role}] parse_failed attempts=${totalAttempts} cost=$${totalCostUsd.toFixed(4)} parse_error="${parseError}" raw_len=${accumulatedRawResponse.length}`
  );
  return {
    ok: false,
    analysis,
    error: `specialist returned invalid JSON after retry: ${parseError}`,
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
  parseAnthropicMixedContent,
  getWebSearchToolsForRole,
  WEB_SEARCH_COST_PER_CALL_USD,
  WEB_SEARCH_MAX_USES,
  HISTORIAN_MAX_OUTPUT_TOKENS,
};
