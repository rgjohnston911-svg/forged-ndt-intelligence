// ============================================================
// Sprint 4A — Memory ingest pipeline
//
// Reads a finalized deliberation from cd_deliberation_log and writes
// one cd_tenant_memory_index row per reasoning artifact (synthesizer
// summary + each high-confidence claim). Each row gets a 1536-dim
// embedding from text-embedding-3-large.
//
// SCHEMA REALITY CHECK (Part 1 of the brief):
//   cd_tenant_memory_index does NOT have source_deliberation_id /
//   record_type / text_content / metadata_jsonb columns. Actual
//   columns: id, org_id, memory_type (CHECK enum), asset_id, anomaly_id,
//   concept_key, summary (NOT NULL), context_jsonb, embedding vector(1536),
//   reinforcement_count, last_retrieved_at, created_at.
//
//   We map the brief's intent onto the real schema:
//     - text to embed                → summary column
//     - claim/summary classification → context_jsonb.record_type
//     - originating deliberation     → context_jsonb.deliberation_id
//     - cited mechanisms / evidence  → context_jsonb.cited_mechanisms / .cited_evidence_ids
//     - schema's memory_type enum    → 'analogous_case' for everything
//       (the CHECK constraint does not accept 'synthesis_summary' or
//       'specialist_claim')
//
// Idempotency is keyed off context_jsonb->>'deliberation_id'.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { embedText } from "./embeddings";

export interface IngestResult {
  ok: boolean;
  rows_inserted: number;
  total_cost_usd: number;
  total_latency_ms: number;
  errors: string[];
  note?: string;
  error?: string;
}

interface DeliberationRow {
  id: string;
  org_id: string;
  finding_id: string | null;
  deliberation_completed_at: string | null;
  consensus_level: string | null;
  synthesizer_decision: SynthesizerDecision | null;
}

interface SynthesizerDecision {
  summary?: string;
  claims?: Array<{
    text?: string;
    confidence?: number;
    cited_mechanism_codes?: string[];
    supporting_evidence_ids?: string[];
  }>;
  cited_mechanisms?: string[];
  cited_evidence?: string[];
}

interface RowToInsert {
  org_id: string;
  memory_type:
    | "recurring_mechanism"
    | "analogous_case"
    | "pattern_observation"
    | "calibration_outcome";
  asset_id: string | null;
  anomaly_id: string | null;
  concept_key: string | null;
  summary: string;
  context_jsonb: Record<string, unknown>;
  embedding: number[];
}

const CLAIM_CONFIDENCE_FLOOR = 0.5;

async function loadDeliberation(
  supabase: SupabaseClient,
  deliberation_id: string,
  org_id: string
): Promise<DeliberationRow | null> {
  const { data } = await supabase
    .from("cd_deliberation_log")
    .select(
      "id, org_id, finding_id, deliberation_completed_at, consensus_level, synthesizer_decision"
    )
    .eq("id", deliberation_id)
    .eq("org_id", org_id)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    org_id: String(row.org_id),
    finding_id: (row.finding_id as string | null) ?? null,
    deliberation_completed_at:
      (row.deliberation_completed_at as string | null) ?? null,
    consensus_level: (row.consensus_level as string | null) ?? null,
    synthesizer_decision:
      (row.synthesizer_decision as SynthesizerDecision | null) ?? null,
  };
}

async function isAlreadyIngested(
  supabase: SupabaseClient,
  org_id: string,
  deliberation_id: string
): Promise<boolean> {
  // No source_deliberation_id column exists; idempotency check goes
  // through the JSONB key we wrote on the previous run.
  const { data } = await supabase
    .from("cd_tenant_memory_index")
    .select("id")
    .eq("org_id", org_id)
    .eq("context_jsonb->>deliberation_id", deliberation_id);
  return Array.isArray(data) && data.length > 0;
}

interface BuildRowOpts {
  org_id: string;
  deliberation_id: string;
  anomaly_id: string | null;
  asset_id: string | null;
  recordType: "synthesis_summary" | "specialist_claim";
  text: string;
  citedMechanisms: string[];
  citedEvidenceIds: string[];
  confidence?: number;
  embedding: number[];
}

function buildRow(opts: BuildRowOpts): RowToInsert {
  const context: Record<string, unknown> = {
    deliberation_id: opts.deliberation_id,
    record_type: opts.recordType,
    cited_mechanisms: opts.citedMechanisms,
    cited_evidence_ids: opts.citedEvidenceIds,
  };
  if (typeof opts.confidence === "number") {
    context.confidence = opts.confidence;
  }
  return {
    org_id: opts.org_id,
    // CHECK constraint on cd_tenant_memory_index.memory_type only allows:
    //   recurring_mechanism | analogous_case | pattern_observation |
    //   calibration_outcome
    // The brief's 'synthesis_summary' / 'specialist_claim' don't fit;
    // we map both to 'analogous_case' and keep the finer-grained
    // record_type in context_jsonb.
    memory_type: "analogous_case",
    asset_id: opts.asset_id,
    anomaly_id: opts.anomaly_id,
    concept_key: null,
    summary: opts.text,
    context_jsonb: context,
    embedding: opts.embedding,
  };
}

async function loadAnomalyForFinding(
  supabase: SupabaseClient,
  org_id: string,
  finding_id: string
): Promise<{ id: string; asset_id: string | null } | null> {
  const { data } = await supabase
    .from("cd_asset_anomalies")
    .select("id, asset_id")
    .eq("org_id", org_id)
    .eq("id", finding_id)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    asset_id: (row.asset_id as string | null) ?? null,
  };
}

export async function ingestDeliberationMemory(
  deliberation_id: string,
  org_id: string,
  supabase: SupabaseClient
): Promise<IngestResult> {
  const t0 = Date.now();
  const errors: string[] = [];

  const delib = await loadDeliberation(supabase, deliberation_id, org_id);
  if (!delib) {
    return {
      ok: false,
      rows_inserted: 0,
      total_cost_usd: 0,
      total_latency_ms: Date.now() - t0,
      errors: [],
      error: "deliberation_not_found",
    };
  }
  if (!delib.deliberation_completed_at) {
    return {
      ok: false,
      rows_inserted: 0,
      total_cost_usd: 0,
      total_latency_ms: Date.now() - t0,
      errors: [],
      note: "deliberation_not_completed",
    };
  }
  if (!delib.consensus_level || delib.consensus_level === "unresolved") {
    return {
      ok: false,
      rows_inserted: 0,
      total_cost_usd: 0,
      total_latency_ms: Date.now() - t0,
      errors: [],
      note: "consensus_unresolved_skipped",
    };
  }

  if (await isAlreadyIngested(supabase, org_id, deliberation_id)) {
    return {
      ok: true,
      rows_inserted: 0,
      total_cost_usd: 0,
      total_latency_ms: Date.now() - t0,
      errors: [],
      note: "already_ingested",
    };
  }

  const synth = delib.synthesizer_decision;
  if (!synth || (!synth.summary && (!synth.claims || synth.claims.length === 0))) {
    return {
      ok: false,
      rows_inserted: 0,
      total_cost_usd: 0,
      total_latency_ms: Date.now() - t0,
      errors: [],
      note: "no_synthesizer_decision_to_embed",
    };
  }

  // Resolve asset_id for the finding so the row can be linked back.
  let asset_id: string | null = null;
  if (delib.finding_id) {
    const anomaly = await loadAnomalyForFinding(
      supabase,
      org_id,
      delib.finding_id
    );
    asset_id = anomaly?.asset_id ?? null;
  }

  const costCtx = { orgId: org_id, supabaseAdmin: supabase };
  const rows: RowToInsert[] = [];
  let totalCostUsd = 0;

  // ---- 1. Synthesizer summary ----
  if (synth.summary && synth.summary.trim().length > 0) {
    try {
      const r = await embedText(synth.summary, { cost: costCtx });
      if (r.ok && r.embedding) {
        totalCostUsd += r.cost_usd ?? 0;
        rows.push(
          buildRow({
            org_id,
            deliberation_id,
            anomaly_id: delib.finding_id,
            asset_id,
            recordType: "synthesis_summary",
            text: synth.summary,
            citedMechanisms: synth.cited_mechanisms ?? [],
            citedEvidenceIds: synth.cited_evidence ?? [],
            embedding: r.embedding,
          })
        );
      } else {
        errors.push(`summary embed failed: ${r.error ?? "unknown"}`);
        totalCostUsd += r.cost_usd ?? 0;
      }
    } catch (err) {
      errors.push(
        `summary embed threw: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // ---- 2. Each high-confidence claim ----
  const claims = Array.isArray(synth.claims) ? synth.claims : [];
  for (const claim of claims) {
    const conf = typeof claim.confidence === "number" ? claim.confidence : 0;
    if (!claim.text || claim.text.trim().length === 0) continue;
    if (conf < CLAIM_CONFIDENCE_FLOOR) continue;
    try {
      const r = await embedText(claim.text, { cost: costCtx });
      if (r.ok && r.embedding) {
        totalCostUsd += r.cost_usd ?? 0;
        rows.push(
          buildRow({
            org_id,
            deliberation_id,
            anomaly_id: delib.finding_id,
            asset_id,
            recordType: "specialist_claim",
            text: claim.text,
            citedMechanisms: claim.cited_mechanism_codes ?? [],
            citedEvidenceIds: claim.supporting_evidence_ids ?? [],
            confidence: conf,
            embedding: r.embedding,
          })
        );
      } else {
        errors.push(`claim embed failed: ${r.error ?? "unknown"}`);
        totalCostUsd += r.cost_usd ?? 0;
      }
    } catch (err) {
      errors.push(
        `claim embed threw: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  let rowsInserted = 0;
  if (rows.length > 0) {
    const { error } = await supabase.from("cd_tenant_memory_index").insert(rows);
    if (error) {
      errors.push(`insert failed: ${error.message}`);
    } else {
      rowsInserted = rows.length;
    }
  }

  return {
    ok: rowsInserted > 0,
    rows_inserted: rowsInserted,
    total_cost_usd: totalCostUsd,
    total_latency_ms: Date.now() - t0,
    errors,
  };
}

export const MEMORY_INGEST_CONSTANTS = {
  CLAIM_CONFIDENCE_FLOOR,
};
