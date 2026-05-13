// ============================================================
// Sprint 4A — Memory retrieval
//
// Single entry point: retrieveAnalogousCases(input, supabase). Embeds
// the query text, calls the match_tenant_memory RPC for cosine top-K,
// hydrates each row with the originating deliberation's consensus +
// summary so the Historian can present prior outcomes alongside the
// matched reasoning artifact.
//
// SCHEMA REALITY CHECK (Part 1 of the brief):
//   - cd_tenant_memory_index has no source_deliberation_id column;
//     deliberation id lives in context_jsonb.deliberation_id.
//   - the RPC returns similarity = 1 - cosine_distance, so higher is
//     more similar (matches the brief's "similarity" semantics).
//   - Empty result is a normal cold-start case → returns ok:true with
//     cases:[].
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalogousCase } from "./types";
import { embedText } from "./embeddings";

export interface RetrieveInput {
  anomalyDescription: string;
  assetContext: string;
  citedMechanisms: string[];
  org_id: string;
  topK?: number;
  // Sprint 4A: optional exclusion to keep the *current* deliberation's
  // own freshly-ingested rows out of its own Historian retrieval.
  excludeDeliberationId?: string;
}

export interface RetrieveResult {
  ok: boolean;
  cases: AnalogousCase[];
  cost_usd: number;
  latency_ms: number;
  error?: string;
}

const DEFAULT_TOP_K = 5;

interface MatchRow {
  id: string;
  org_id: string;
  memory_type: string | null;
  asset_id: string | null;
  anomaly_id: string | null;
  summary: string;
  context_jsonb: Record<string, unknown> | null;
  similarity: number;
  created_at: string;
}

function buildQueryText(input: RetrieveInput): string {
  const mechanisms =
    input.citedMechanisms.length > 0
      ? input.citedMechanisms.join(", ")
      : "(none yet identified)";
  return [
    `Anomaly: ${input.anomalyDescription || "(no description)"}`,
    `Asset: ${input.assetContext || "(no asset context)"}`,
    `Mechanisms under consideration: ${mechanisms}`,
  ].join(" | ");
}

interface DeliberationLookup {
  consensus_level: string | null;
  synthesizer_summary: string | null;
}

async function hydrateDeliberationContext(
  supabase: SupabaseClient,
  org_id: string,
  deliberationIds: string[]
): Promise<Map<string, DeliberationLookup>> {
  const map = new Map<string, DeliberationLookup>();
  if (deliberationIds.length === 0) return map;
  const { data } = await supabase
    .from("cd_deliberation_log")
    .select("id, consensus_level, synthesizer_decision")
    .eq("org_id", org_id)
    .in("id", deliberationIds);
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  for (const row of rows) {
    const synth = row.synthesizer_decision as
      | { summary?: string }
      | null
      | undefined;
    map.set(String(row.id), {
      consensus_level: (row.consensus_level as string | null) ?? null,
      synthesizer_summary: (synth?.summary as string | undefined) ?? null,
    });
  }
  return map;
}

function projectRow(
  row: MatchRow,
  delibLookup: Map<string, DeliberationLookup>
): AnalogousCase {
  const ctx = (row.context_jsonb ?? {}) as Record<string, unknown>;
  const deliberation_id = String(ctx.deliberation_id ?? "");
  const record_type = String(ctx.record_type ?? row.memory_type ?? "unknown");
  const cited =
    Array.isArray(ctx.cited_mechanisms) &&
    (ctx.cited_mechanisms as unknown[]).every((m) => typeof m === "string")
      ? (ctx.cited_mechanisms as string[])
      : [];
  const lookup = delibLookup.get(deliberation_id);
  const metadata: Record<string, unknown> = {
    ...ctx,
    prior_consensus_level: lookup?.consensus_level ?? null,
    prior_synthesizer_summary: lookup?.synthesizer_summary ?? null,
  };
  return {
    source_deliberation_id: deliberation_id,
    source_anomaly_id: row.anomaly_id,
    record_type,
    text_content: row.summary,
    similarity: row.similarity,
    metadata,
    cited_mechanisms: cited,
    created_at: row.created_at,
  };
}

export async function retrieveAnalogousCases(
  input: RetrieveInput,
  supabase: SupabaseClient
): Promise<RetrieveResult> {
  const t0 = Date.now();
  const topK = input.topK ?? DEFAULT_TOP_K;
  const queryText = buildQueryText(input);

  const embedRes = await embedText(queryText, {
    cost: { orgId: input.org_id, supabaseAdmin: supabase },
  });
  if (!embedRes.ok || !embedRes.embedding) {
    return {
      ok: false,
      cases: [],
      cost_usd: embedRes.cost_usd ?? 0,
      latency_ms: Date.now() - t0,
      error: embedRes.error ?? "embed_failed",
    };
  }

  // Pull a few extras so we can filter out the caller's own deliberation
  // rows without falling below topK.
  const fetchCount = topK + (input.excludeDeliberationId ? 5 : 0);

  const { data, error } = await supabase.rpc("match_tenant_memory", {
    query_embedding: embedRes.embedding,
    match_org_id: input.org_id,
    match_count: fetchCount,
  });

  if (error) {
    return {
      ok: false,
      cases: [],
      cost_usd: embedRes.cost_usd ?? 0,
      latency_ms: Date.now() - t0,
      error: `match_tenant_memory rpc failed: ${error.message}`,
    };
  }

  const rows = Array.isArray(data) ? (data as MatchRow[]) : [];

  // Filter out self-matches (rows from the current deliberation, if any).
  const filtered = input.excludeDeliberationId
    ? rows.filter((r) => {
        const ctx = (r.context_jsonb ?? {}) as Record<string, unknown>;
        return String(ctx.deliberation_id ?? "") !== input.excludeDeliberationId;
      })
    : rows;

  const limited = filtered.slice(0, topK);

  // Hydrate originating deliberation's consensus + summary for each unique
  // deliberation id surfaced.
  const uniqueDelibIds = Array.from(
    new Set(
      limited
        .map((r) => {
          const ctx = (r.context_jsonb ?? {}) as Record<string, unknown>;
          return String(ctx.deliberation_id ?? "");
        })
        .filter((id) => id.length > 0)
    )
  );
  const delibLookup = await hydrateDeliberationContext(
    supabase,
    input.org_id,
    uniqueDelibIds
  );

  return {
    ok: true,
    cases: limited.map((r) => projectRow(r, delibLookup)),
    cost_usd: embedRes.cost_usd ?? 0,
    latency_ms: Date.now() - t0,
  };
}

export const MEMORY_RETRIEVAL_CONSTANTS = {
  DEFAULT_TOP_K,
};

// Exported for tests.
export { buildQueryText };
