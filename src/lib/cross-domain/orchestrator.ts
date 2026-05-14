// ============================================================
// DEPLOY355 — Cross-domain deliberation orchestrator
//
// Sequential 7-step flow:
//   1. Inspector       (sonnet)
//   2. Engineer        (opus, thinking 16000)
//   3. Causal chain    (rules-based, deterministic)
//   4. Researcher      (sonnet)
//   5. Devil's Advocate (gpt-4o)
//   6. Historian       (sonnet, with pre-filtered analogous cases)
//   -- arbitrate --
//   7. Synthesizer     (opus, thinking 32000)
//
// SCHEMA NOTES (PR body): cd_deliberation_log is one-row-per-
// deliberation with `specialist_outputs` jsonb[] in the current
// schema, not one-row-per-specialist as the brief implies. We
// upsert: INSERT at start, UPDATE after each specialist with the
// growing array. Best-effort incremental persistence is preserved.
// ============================================================

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DeliberationInput,
  DeliberationResult,
  SpecialistAnalysis,
  ArbitrationDecision,
  CausalChainResult,
  AnomalyContext,
  AssetContext,
  SpecialistRole,
  ConsequenceProfile,
} from "./types";
import {
  deliberateAsInspector,
  deliberateAsEngineer,
  deliberateAsResearcher,
  deliberateAsDevilsAdvocate,
  deliberateAsHistorian,
  deliberateAsSynthesizer,
} from "./aiSpecialists";
import { buildCausalChain } from "./causalChainEngine";
import { buildConsequenceProfile } from "./consequenceEngine";
import { checkOrgBudget, recordSpend } from "./budgetGuard";
import { SPECIALIST_ORDER } from "./deliberationState";
import { ingestDeliberationMemory } from "./memoryIngest";
import { captureDeliberationPrediction } from "./predictionCapture";
import {
  deliverDeliberationWebhook,
  type DeliberationWebhookPayload,
} from "./webhookDelivery";

export interface RunDeliberationOptions {
  org_id: string;
  deliberation_id: string;
  supabase: SupabaseClient;
  // Sprint 3 — resume support for the chunked-async runtime. When set,
  // the orchestrator loads existing specialist_outputs + total_cost_usd
  // from the cd_deliberation_log row and resumes from that specialist
  // instead of restarting at Inspector.
  resume_from_specialist?: SpecialistRole;
}

// ------------------------------------------------------------
// Arbitration — deterministic, NOT LLM-based.
// ------------------------------------------------------------

function objectionsFrom(da: SpecialistAnalysis | undefined): SpecialistAnalysis["claims"] {
  if (!da) return [];
  return da.claims.filter(
    (c) => !c.text.toLowerCase().startsWith("no significant gaps found")
  );
}

function isObjectionAddressed(
  objection: SpecialistAnalysis["claims"][number],
  downstream: SpecialistAnalysis[]
): boolean {
  const objMechanisms = new Set(objection.cited_mechanism_codes);
  const objKeyword = objection.text.toLowerCase().slice(0, 40);
  for (const a of downstream) {
    for (const claim of a.claims) {
      // Mechanism overlap: a downstream claim cites a mechanism the
      // objection raised.
      for (const m of claim.cited_mechanism_codes) {
        if (objMechanisms.has(m)) return true;
      }
      // Textual addressing: a downstream claim's text contains a
      // recognisable chunk of the objection text.
      if (objKeyword.length > 8 && claim.text.toLowerCase().includes(objKeyword)) {
        return true;
      }
    }
  }
  return false;
}

export function arbitrate(analyses: SpecialistAnalysis[]): ArbitrationDecision {
  const da = analyses.find((a) => a.role === "devils_advocate");
  const objections = objectionsFrom(da);

  // Downstream = specialists that ran after devils_advocate (historian).
  const daIdx = analyses.findIndex((a) => a.role === "devils_advocate");
  const downstream = daIdx >= 0 ? analyses.slice(daIdx + 1) : [];

  let addressed = 0;
  for (const obj of objections) {
    if (isObjectionAddressed(obj, downstream)) addressed++;
  }
  const total = objections.length;
  const unresolved = total - addressed;

  // Rule: unresolved > 50% (strictly greater than half) → flagged_dissent.
  // Tie at 50% is "addressed not strictly less than half" → accepted.
  if (total > 0 && unresolved / total > 0.5) {
    return {
      status: "flagged_dissent",
      reason: `${unresolved}/${total} devils_advocate objections unresolved (>50%)`,
      devils_advocate_objections_addressed: addressed,
      devils_advocate_objections_unresolved: unresolved,
    };
  }

  // Rule: average claim confidence < 0.6 across Engineer
  // (Synthesizer hasn't run at arbitrate time; brief mentions both
  // but only Engineer is available pre-synthesizer).
  const engineer = analyses.find((a) => a.role === "engineer");
  if (engineer && engineer.claims.length > 0) {
    const avg =
      engineer.claims.reduce((s, c) => s + c.confidence, 0) /
      engineer.claims.length;
    if (avg < 0.6) {
      return {
        status: "rejected_low_confidence",
        reason: `Engineer average claim confidence ${avg.toFixed(2)} < 0.6`,
        devils_advocate_objections_addressed: addressed,
        devils_advocate_objections_unresolved: unresolved,
      };
    }
  }

  return {
    status: "accepted",
    reason:
      total === 0
        ? "no devils_advocate objections raised"
        : `${addressed}/${total} objections addressed`,
    devils_advocate_objections_addressed: addressed,
    devils_advocate_objections_unresolved: unresolved,
  };
}

// ------------------------------------------------------------
// Persistence
// ------------------------------------------------------------

// Sprint 3.1 fix: conform to the existing CHECK constraint on
// cd_deliberation_log.consensus_level (unanimous | majority_with_dissent
// | split | unresolved). Sprint 3 originally wrote the arbitration
// vocabulary verbatim ('accepted'/'failed'/etc.) which silently failed
// the CHECK in production, rolling back the entire finalize UPDATE and
// leaving rows in 'running' state forever. The fine-grained arbitration
// status now lives in arbitration_rules_applied.final_status; the
// status endpoint reads from there.
function consensusLevelFor(arbitration: ArbitrationDecision): string {
  switch (arbitration.status) {
    case "accepted":
      return arbitration.devils_advocate_objections_unresolved === 0
        ? "unanimous"
        : "majority_with_dissent";
    case "flagged_dissent":
      return "majority_with_dissent";
    case "rejected_low_confidence":
    default:
      return "unresolved";
  }
}

function escalatedFor(arbitration: ArbitrationDecision): boolean {
  return (
    arbitration.status === "flagged_dissent" ||
    arbitration.status === "rejected_low_confidence"
  );
}

// Idempotent: if the row was pre-created by the trigger endpoint
// (Sprint 3 chunked-async flow), skip INSERT and just stamp
// deliberation_started_at. Otherwise INSERT as before.
async function ensureLogRow(
  supabase: SupabaseClient,
  opts: RunDeliberationOptions,
  anomaly: AnomalyContext
): Promise<{
  specialist_outputs: SpecialistAnalysis[];
  total_cost_usd: number;
} | null> {
  const { data: existing } = await supabase
    .from("cd_deliberation_log")
    .select(
      "id, deliberation_started_at, specialist_outputs, total_cost_usd"
    )
    .eq("id", opts.deliberation_id)
    .maybeSingle();
  if (existing) {
    const row = existing as Record<string, unknown>;
    if (!row.deliberation_started_at) {
      await supabase
        .from("cd_deliberation_log")
        .update({ deliberation_started_at: new Date().toISOString() })
        .eq("id", opts.deliberation_id);
    }
    const outputs = Array.isArray(row.specialist_outputs)
      ? (row.specialist_outputs as SpecialistAnalysis[])
      : [];
    const cost =
      typeof row.total_cost_usd === "number" ? row.total_cost_usd : 0;
    return { specialist_outputs: outputs, total_cost_usd: cost };
  }
  await supabase.from("cd_deliberation_log").insert({
    id: opts.deliberation_id,
    org_id: opts.org_id,
    finding_id: anomaly.id,
    finding_type: "cd_asset_anomaly",
    deliberation_started_at: new Date().toISOString(),
    specialist_outputs: [],
    arbitration_rules_applied: [],
    consensus_level: "unresolved",
    escalated_to_human: false,
    total_cost_usd: 0,
  });
  return null;
}

async function appendSpecialistToLog(
  supabase: SupabaseClient,
  opts: RunDeliberationOptions,
  perSpecialist: SpecialistAnalysis[],
  totalCost: number
): Promise<void> {
  await supabase
    .from("cd_deliberation_log")
    .update({
      specialist_outputs: perSpecialist,
      total_cost_usd: totalCost,
    })
    .eq("id", opts.deliberation_id);
}

async function finalizeLog(
  supabase: SupabaseClient,
  opts: RunDeliberationOptions,
  perSpecialist: SpecialistAnalysis[],
  arbitration: ArbitrationDecision,
  synthesizer: SpecialistAnalysis | null,
  totalCost: number,
  // Sprint 3.2: optional extras merged into arbitration_rules_applied
  // (e.g. causal_chain_error). Keeps the jsonb a single object instead
  // of needing a separate UPDATE per diagnostic.
  extras: Record<string, unknown> = {}
): Promise<void> {
  await supabase
    .from("cd_deliberation_log")
    .update({
      specialist_outputs: perSpecialist,
      synthesizer_decision: synthesizer,
      // Store both the conformed consensus_level AND the fine-grained
      // arbitration outcome so the polling endpoint can distinguish
      // accepted vs flagged_dissent (both map to majority_with_dissent
      // in the enum).
      arbitration_rules_applied: {
        arbitration_decision: arbitration,
        final_status: arbitration.status,
        ...extras,
      },
      consensus_level: consensusLevelFor(arbitration),
      escalated_to_human: escalatedFor(arbitration),
      total_cost_usd: totalCost,
      deliberation_completed_at: new Date().toISOString(),
    })
    .eq("id", opts.deliberation_id);
}

// Sprint 4A: memory ingest is supplementary to the deliberation
// outcome. We fire it AFTER finalizeLog succeeds, gated on a non-
// 'unresolved' consensus_level. Any failure is logged and written
// to arbitration_rules_applied.memory_ingest_error — it must NEVER
// mark the deliberation failed. The error is MERGED into the existing
// arbitration_rules_applied so we don't clobber causal_chain_error
// or arbitration_decision fields finalizeLog already wrote.
async function mergeMemoryIngestError(
  supabase: SupabaseClient,
  deliberation_id: string,
  message: string
): Promise<void> {
  try {
    const { data } = await supabase
      .from("cd_deliberation_log")
      .select("arbitration_rules_applied")
      .eq("id", deliberation_id)
      .maybeSingle();
    const row = (data ?? {}) as Record<string, unknown>;
    const existing =
      (row.arbitration_rules_applied as Record<string, unknown> | null) ?? {};
    await supabase
      .from("cd_deliberation_log")
      .update({
        arbitration_rules_applied: {
          ...existing,
          memory_ingest_error: message,
        },
      })
      .eq("id", deliberation_id);
  } catch {
    // Best-effort — if even this fails, the deliberation outcome
    // already stands; nothing else to do.
  }
}

async function triggerMemoryIngest(
  supabase: SupabaseClient,
  opts: RunDeliberationOptions,
  arbitration: ArbitrationDecision
): Promise<void> {
  const consensus = consensusLevelFor(arbitration);
  if (consensus === "unresolved") return;
  try {
    const result = await ingestDeliberationMemory(
      opts.deliberation_id,
      opts.org_id,
      supabase
    );
    if (result.ok) {
      console.log(
        `[memory ingest ${opts.deliberation_id}] OK rows=${result.rows_inserted} cost=$${result.total_cost_usd.toFixed(4)} latency=${result.total_latency_ms}ms`
      );
    } else {
      const note = result.note ?? result.error ?? "no_rows_inserted";
      console.warn(
        `[memory ingest ${opts.deliberation_id}] not_ok note="${note}" errors=${result.errors.length}`
      );
      if (result.error || result.errors.length > 0) {
        await mergeMemoryIngestError(
          supabase,
          opts.deliberation_id,
          result.error ?? result.errors.join("; ")
        );
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[memory ingest ${opts.deliberation_id}] threw err="${message}"`
    );
    await mergeMemoryIngestError(supabase, opts.deliberation_id, message);
  }
}

// Sprint 4D: prediction capture. Same try/catch + merge-into-
// arbitration_rules_applied pattern as memory ingest. Fires AFTER
// memory ingest in the finalize sequence so the consequence assessment
// and causal chain rows are already present for the capture to read.
async function mergePredictionCaptureError(
  supabase: SupabaseClient,
  deliberation_id: string,
  message: string
): Promise<void> {
  try {
    const { data } = await supabase
      .from("cd_deliberation_log")
      .select("arbitration_rules_applied")
      .eq("id", deliberation_id)
      .maybeSingle();
    const row = (data ?? {}) as Record<string, unknown>;
    const existing =
      (row.arbitration_rules_applied as Record<string, unknown> | null) ?? {};
    await supabase
      .from("cd_deliberation_log")
      .update({
        arbitration_rules_applied: {
          ...existing,
          prediction_capture_error: message,
        },
      })
      .eq("id", deliberation_id);
  } catch {
    // Best-effort — outcome already stands; nothing else to do.
  }
}

async function triggerPredictionCapture(
  supabase: SupabaseClient,
  opts: RunDeliberationOptions,
  arbitration: ArbitrationDecision
): Promise<void> {
  const consensus = consensusLevelFor(arbitration);
  if (consensus === "unresolved") {
    // Sprint 4 Polish 2 (Fix 1): even the intentional skip path leaves
    // a breadcrumb so we can confirm in production whether capture was
    // even invoked. Pre-Polish-2 this returned silently — production
    // showed no error AND no row, indistinguishable from "function was
    // never called".
    console.log(
      `[prediction capture ${opts.deliberation_id}] skipped (consensus=unresolved)`
    );
    return;
  }
  try {
    const result = await captureDeliberationPrediction(
      opts.deliberation_id,
      opts.org_id,
      supabase
    );
    if (result.ok) {
      console.log(
        `[prediction capture ${opts.deliberation_id}] OK prediction_id=${result.prediction_id}${result.note ? ` note=${result.note}` : ""}`
      );
    } else {
      // Sprint 4 Polish 2 (Fix 1): EVERY ok:false return writes to the
      // deliberation log now, not just error-bearing ones. Pre-Polish-2
      // the orchestrator gated this DB write on result.error, meaning
      // note-only returns ("deliberation_not_completed",
      // "consensus_unresolved_skipped", etc.) were silently dropped —
      // making it impossible to tell post-hoc whether the capture
      // function even ran.
      const detail = result.error ?? result.note ?? "unknown";
      console.warn(
        `[prediction capture ${opts.deliberation_id}] not_ok detail="${detail}"`
      );
      await mergePredictionCaptureError(
        supabase,
        opts.deliberation_id,
        detail
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[prediction capture ${opts.deliberation_id}] threw err="${message}"`
    );
    await mergePredictionCaptureError(supabase, opts.deliberation_id, message);
  }
}

// Sprint 4 Polish 3 (Fix 5): webhook delivery. Same merge-into-
// arbitration_rules_applied pattern as the other supplementary hooks
// — a webhook failure is recorded but NEVER fails the deliberation.
async function mergeWebhookError(
  supabase: SupabaseClient,
  deliberation_id: string,
  message: string
): Promise<void> {
  try {
    const { data } = await supabase
      .from("cd_deliberation_log")
      .select("arbitration_rules_applied")
      .eq("id", deliberation_id)
      .maybeSingle();
    const row = (data ?? {}) as Record<string, unknown>;
    const existing =
      (row.arbitration_rules_applied as Record<string, unknown> | null) ?? {};
    await supabase
      .from("cd_deliberation_log")
      .update({
        arbitration_rules_applied: {
          ...existing,
          webhook_error: message,
        },
      })
      .eq("id", deliberation_id);
  } catch {
    // Best-effort — outcome already stands; nothing else to do.
  }
}

interface WebhookTriggerContext {
  anomaly_id: string;
  asset_id: string;
  consequenceProfile: ConsequenceProfile | null;
  total_cost_usd: number;
}

async function triggerWebhookDelivery(
  supabase: SupabaseClient,
  opts: RunDeliberationOptions,
  arbitration: ArbitrationDecision,
  ctx: WebhookTriggerContext
): Promise<void> {
  try {
    // poll_url points the receiver at the status endpoint for the full
    // payload. CROSS_DOMAIN_PUBLIC_BASE_URL is preferred; Netlify also
    // injects URL at runtime. Falls back to a relative path.
    const base =
      process.env.CROSS_DOMAIN_PUBLIC_BASE_URL || process.env.URL || "";
    const statusPath = `/.netlify/functions/cross-domain-deliberation-status?deliberation_id=${opts.deliberation_id}`;
    const poll_url = base ? `${base.replace(/\/$/, "")}${statusPath}` : statusPath;

    const payload: DeliberationWebhookPayload = {
      event: "deliberation.completed",
      delivered_at: new Date().toISOString(),
      deliberation_id: opts.deliberation_id,
      org_id: opts.org_id,
      anomaly_id: ctx.anomaly_id,
      asset_id: ctx.asset_id,
      consensus_level: consensusLevelFor(arbitration),
      escalated_to_human: escalatedFor(arbitration),
      recommended_action_tier:
        ctx.consequenceProfile?.recommended_action_tier ?? null,
      overall_consequence_tier: ctx.consequenceProfile?.overall_tier ?? null,
      total_cost_usd: ctx.total_cost_usd,
      poll_url,
    };

    const result = await deliverDeliberationWebhook(payload, supabase);
    if (result.ok) {
      if (result.attempted) {
        console.log(
          `[webhook ${opts.deliberation_id}] delivered status=${result.status}`
        );
      }
      // result.attempted === false → no webhook configured / disabled;
      // intentional silent no-op.
    } else {
      const detail =
        result.error ?? `status_${result.status ?? "unknown"}`;
      console.warn(
        `[webhook ${opts.deliberation_id}] delivery failed: ${detail}`
      );
      await mergeWebhookError(supabase, opts.deliberation_id, detail);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[webhook ${opts.deliberation_id}] threw err="${message}"`);
    await mergeWebhookError(supabase, opts.deliberation_id, message);
  }
}

// System-failure finalization (engineer crash, cap exceeded, etc.).
// consensus_level conforms to the CHECK constraint ('unresolved').
// The actual failure marker lives in arbitration_rules_applied.error;
// the status endpoint derives status='failed' from that, not from
// consensus_level.
async function finalizeLogAsFailure(
  supabase: SupabaseClient,
  opts: RunDeliberationOptions,
  perSpecialist: SpecialistAnalysis[],
  errorMessage: string,
  totalCost: number
): Promise<void> {
  await supabase
    .from("cd_deliberation_log")
    .update({
      specialist_outputs: perSpecialist,
      synthesizer_decision: null,
      arbitration_rules_applied: {
        error: errorMessage,
        final_status: "failed",
      },
      consensus_level: "unresolved",
      escalated_to_human: true,
      total_cost_usd: totalCost,
      deliberation_completed_at: new Date().toISOString(),
    })
    .eq("id", opts.deliberation_id);
}

// ------------------------------------------------------------
// Orchestrator
// ------------------------------------------------------------

function emptyArbitration(reason: string): ArbitrationDecision {
  return {
    status: "rejected_low_confidence",
    reason,
    devils_advocate_objections_addressed: 0,
    devils_advocate_objections_unresolved: 0,
  };
}

function emptyResult(
  opts: RunDeliberationOptions,
  perSpecialist: SpecialistAnalysis[],
  causalChain: CausalChainResult | null,
  arbitration: ArbitrationDecision,
  aborted_reason: NonNullable<DeliberationResult["aborted_reason"]>,
  totalCost: number,
  totalLatency: number
): DeliberationResult {
  return {
    deliberation_id: opts.deliberation_id,
    ok: false,
    arbitration,
    synthesizer_output: null,
    causal_chain: causalChain,
    total_cost_usd: totalCost,
    total_latency_ms: totalLatency,
    per_specialist: perSpecialist,
    aborted_reason,
  };
}

export async function runDeliberation(
  input: DeliberationInput,
  opts: RunDeliberationOptions
): Promise<DeliberationResult> {
  const t0 = Date.now();
  const { supabase, org_id, deliberation_id } = opts;

  // Pre-check daily budget. Abort before spending if cap would
  // be breached by this deliberation.
  const budget = await checkOrgBudget(supabase, org_id);
  if (!budget.ok) {
    return {
      deliberation_id,
      ok: false,
      arbitration: emptyArbitration(budget.reason ?? "budget_exceeded"),
      synthesizer_output: null,
      causal_chain: null,
      total_cost_usd: 0,
      total_latency_ms: Date.now() - t0,
      per_specialist: [],
      aborted_reason: "org_daily_cap_exceeded",
    };
  }
  const perDelibCap = budget.per_deliberation_cap_usd;

  // ensureLogRow is idempotent — if the trigger endpoint pre-created
  // the row, it returns the existing specialist_outputs + total_cost_usd
  // so we can resume.
  const existing = await ensureLogRow(supabase, opts, input.anomaly);

  const ctx = { cost: { orgId: org_id, supabaseAdmin: supabase } };
  const perSpecialist: SpecialistAnalysis[] = existing?.specialist_outputs
    ? [...existing.specialist_outputs]
    : [];
  let runningCost = existing?.total_cost_usd ?? 0;
  let causalChain: CausalChainResult | null = null;
  // Sprint 3.2: surface causal-chain-engine failures to the final
  // arbitration_rules_applied payload for diagnosis. Empty string =
  // engine succeeded (or wasn't applicable).
  let causalChainError: string = "";
  // Sprint 4C: same pattern for the deterministic consequence engine.
  // Runs after causal chain, before Researcher. Failure does NOT block
  // the deliberation — the error surfaces via arbitration_rules_applied.
  let consequenceProfile: ConsequenceProfile | null = null;
  let consequenceEngineError: string = "";

  // resume_from_specialist controls which steps to skip. If we're
  // resuming, the orchestrator uses the loaded prior outputs for
  // anything before this specialist instead of re-running them.
  const resumeIdx = opts.resume_from_specialist
    ? SPECIALIST_ORDER.indexOf(opts.resume_from_specialist)
    : 0;
  const shouldRun = (role: SpecialistRole): boolean =>
    SPECIALIST_ORDER.indexOf(role) >= resumeIdx;

  const recordOutcome = async (a: SpecialistAnalysis): Promise<void> => {
    perSpecialist.push(a);
    runningCost += a.cost_usd;
    await appendSpecialistToLog(supabase, opts, perSpecialist, runningCost);
  };

  const priorOutputFor = (role: SpecialistRole): SpecialistAnalysis | null => {
    return perSpecialist.find((s) => s.role === role) ?? null;
  };

  // Helper: either run the specialist or return the prior analysis
  // (when shouldRun(role) is false and we have an existing entry).
  // Returns a result-shaped object so callers can check .ok / .analysis
  // uniformly.
  async function step(
    role: SpecialistRole,
    callFn: () => Promise<{ ok: boolean; analysis: SpecialistAnalysis; error?: string }>
  ): Promise<{ ok: boolean; analysis: SpecialistAnalysis; error?: string; ran: boolean }> {
    if (!shouldRun(role)) {
      const prior = priorOutputFor(role);
      if (prior) {
        return { ok: true, analysis: prior, ran: false };
      }
      // Resume index says skip but no prior output present — fall
      // through and actually run (defensive).
    }
    const r = await callFn();
    await recordOutcome(r.analysis);
    // Sprint 3.2 instrumentation: one-line per-step trace so Netlify
    // function logs can reconstruct a chain post-hoc.
    console.log(
      `[deliberation ${deliberation_id}] step=${role} ok=${r.ok} attempts=${r.analysis.attempts} cost=$${r.analysis.cost_usd.toFixed(4)} latency=${r.analysis.latency_ms}ms${r.analysis.parse_error ? ` parse_error="${r.analysis.parse_error}"` : ""}`
    );
    return { ...r, ran: true };
  }

  const inputWithChain = (): DeliberationInput => ({
    ...input,
    priorAnalyses: [...perSpecialist],
    causalChain: causalChain ?? undefined,
    consequenceProfile: consequenceProfile ?? undefined,
  });

  // ---- Step 1: Inspector ----
  const inspector = await step("inspector", () =>
    deliberateAsInspector(inputWithChain(), ctx)
  );
  if (inspector.ran && runningCost > perDelibCap) {
    const arb = emptyArbitration("per_deliberation_cap_exceeded");
    await finalizeLogAsFailure(
      supabase,
      opts,
      perSpecialist,
      "per_deliberation_cap_exceeded",
      runningCost
    );
    return emptyResult(
      opts,
      perSpecialist,
      causalChain,
      arb,
      "per_deliberation_cap_exceeded",
      runningCost,
      Date.now() - t0
    );
  }

  // ---- Step 2: Engineer ----
  const engineer = await step("engineer", () =>
    deliberateAsEngineer(inputWithChain(), ctx)
  );
  if (!engineer.ok) {
    const arb = emptyArbitration(`engineer_failed: ${engineer.error ?? "unknown"}`);
    await finalizeLogAsFailure(
      supabase,
      opts,
      perSpecialist,
      `engineer_failed: ${engineer.error ?? "unknown"}`,
      runningCost
    );
    await recordSpend(supabase, org_id, deliberation_id, runningCost);
    return emptyResult(
      opts,
      perSpecialist,
      causalChain,
      arb,
      "engineer_failed",
      runningCost,
      Date.now() - t0
    );
  }
  if (engineer.ran && runningCost > perDelibCap) {
    const arb = emptyArbitration("per_deliberation_cap_exceeded");
    await finalizeLogAsFailure(
      supabase,
      opts,
      perSpecialist,
      "per_deliberation_cap_exceeded",
      runningCost
    );
    await recordSpend(supabase, org_id, deliberation_id, runningCost);
    return emptyResult(
      opts,
      perSpecialist,
      causalChain,
      arb,
      "per_deliberation_cap_exceeded",
      runningCost,
      Date.now() - t0
    );
  }

  // ---- Step 3: Causal chain (rules-based; uses Engineer's output) ----
  // Supplementary to the 6-AI chain — if it fails for any reason
  // (engine throws, INSERT fails, no candidate mechanisms), the
  // deliberation MUST still complete with the 6 specialists. The
  // failure reason is propagated to finalize via causalChainError.
  const engineerMechanisms = engineer.analysis.cited_mechanisms ?? [];
  if (engineerMechanisms.length === 0) {
    causalChainError = "engineer_cited_no_mechanisms";
    console.warn(
      `[orchestrator deliberation_id=${deliberation_id}] causal chain SKIPPED: engineer cited zero mechanisms`
    );
  } else {
    try {
      causalChain = await buildCausalChain({
        anomaly: input.anomaly,
        asset: input.asset,
        candidateMechanismCodes: engineerMechanisms,
        supabase,
        org_id,
      });
      if (!causalChain.ok) {
        causalChainError = `causal_chain_engine: ${causalChain.reason ?? "unknown"}`;
        console.warn(
          `[orchestrator deliberation_id=${deliberation_id}] causal chain returned ok:false reason="${causalChain.reason}"`
        );
      } else {
        console.log(
          `[orchestrator deliberation_id=${deliberation_id}] causal chain OK primary=${causalChain.primary_mechanism?.code} fit=${causalChain.confidence.toFixed(2)}`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      causalChainError = `causal_chain_threw: ${message}`;
      console.error(
        `[orchestrator deliberation_id=${deliberation_id}] causal chain THREW err="${message}" — continuing deliberation`
      );
      causalChain = null;
    }
  }

  // ---- Step 3b: Consequence engine (rules-based; runs between
  // causal chain and Researcher so downstream specialists can
  // reference the deterministic risk quantification). Supplementary
  // to the 6-AI chain. Failure logged + surfaced via
  // arbitration_rules_applied.consequence_engine_error.
  try {
    const consResult = await buildConsequenceProfile({
      anomaly: input.anomaly,
      asset: input.asset,
      causalChain,
      supabase,
      org_id,
      deliberation_id,
    });
    if (consResult.ok && consResult.profile) {
      consequenceProfile = consResult.profile;
      console.log(
        `[orchestrator deliberation_id=${deliberation_id}] consequence engine OK overall_tier=${consequenceProfile.overall_tier} action=${consequenceProfile.recommended_action_tier} confidence=${consequenceProfile.total_confidence.toFixed(2)}`
      );
    } else {
      consequenceProfile = consResult.profile ?? null;
      consequenceEngineError = consResult.error ?? "unknown";
      console.warn(
        `[orchestrator deliberation_id=${deliberation_id}] consequence engine ok:false err="${consequenceEngineError}"`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    consequenceEngineError = `consequence_engine_threw: ${message}`;
    console.error(
      `[orchestrator deliberation_id=${deliberation_id}] consequence engine THREW err="${message}" — continuing deliberation`
    );
    consequenceProfile = null;
  }

  // ---- Steps 4 + 5: Researcher + Devil's Advocate (PARALLEL) ----
  // Sprint 4 Polish 3 (Fix 4): Researcher (~70s) and Devil's Advocate
  // (~5-7s) both consume ONLY the upstream context (Inspector +
  // Engineer outputs, causal chain, consequence profile) — neither
  // consumes the other's output. Running them with Promise.all removes
  // ~70s from the critical path (Researcher dominates DA latency).
  //
  // Trade-off (intentional, per the brief): after parallelization
  // Devil's Advocate no longer sees Researcher's output and vice
  // versa. DA still adversarially reviews Inspector + Engineer. The
  // DOWNSTREAM chain — Historian and Synthesizer — still sees BOTH
  // (they snapshot perSpecialist after both are recorded), so the
  // adversarial-validation behavior of the deliberation is preserved.
  //
  // Both are recorded researcher-then-DA so arbitrate()'s
  // position-based "downstream" slice (everything after devils_advocate)
  // is byte-identical to the pre-parallel ordering.
  let researcher: { ok: boolean; analysis: SpecialistAnalysis; error?: string; ran: boolean };
  let da: { ok: boolean; analysis: SpecialistAnalysis; error?: string; ran: boolean };
  if (shouldRun("researcher") && shouldRun("devils_advocate")) {
    // Snapshot the input ONCE so both specialists see the identical
    // upstream context. recordOutcome is then applied sequentially
    // (researcher first) to keep the perSpecialist array order
    // deterministic and avoid racing the incremental persist.
    const sharedInput = inputWithChain();
    const [rRes, dRes] = await Promise.all([
      deliberateAsResearcher(sharedInput, ctx),
      deliberateAsDevilsAdvocate(sharedInput, ctx),
    ]);
    await recordOutcome(rRes.analysis);
    await recordOutcome(dRes.analysis);
    for (const [role, r] of [
      ["researcher", rRes],
      ["devils_advocate", dRes],
    ] as const) {
      console.log(
        `[deliberation ${deliberation_id}] step=${role} (parallel) ok=${r.ok} attempts=${r.analysis.attempts} cost=$${r.analysis.cost_usd.toFixed(4)} latency=${r.analysis.latency_ms}ms${r.analysis.parse_error ? ` parse_error="${r.analysis.parse_error}"` : ""}`
      );
    }
    researcher = { ...rRes, ran: true };
    da = { ...dRes, ran: true };
  } else {
    // Resume edge case (e.g. resuming exactly at devils_advocate):
    // shouldRun is monotonic by SPECIALIST_ORDER index, so this branch
    // only hits mid-chain resumes. Fall back to sequential step()
    // calls so prior-output reuse works correctly.
    researcher = await step("researcher", () =>
      deliberateAsResearcher(inputWithChain(), ctx)
    );
    da = await step("devils_advocate", () =>
      deliberateAsDevilsAdvocate(inputWithChain(), ctx)
    );
  }
  // Single combined cap check — both specialists have run by here.
  if ((researcher.ran || da.ran) && runningCost > perDelibCap) {
    const arb = emptyArbitration("per_deliberation_cap_exceeded");
    await finalizeLogAsFailure(
      supabase,
      opts,
      perSpecialist,
      "per_deliberation_cap_exceeded",
      runningCost
    );
    await recordSpend(supabase, org_id, deliberation_id, runningCost);
    return emptyResult(
      opts,
      perSpecialist,
      causalChain,
      arb,
      "per_deliberation_cap_exceeded",
      runningCost,
      Date.now() - t0
    );
  }

  // ---- Step 6: Historian ----
  // Sprint 2 placeholder: any pre-filtered analogous cases are
  // already in input.priorAnalyses via the caller (deliberate
  // endpoint). Sprint 4 swaps for vector retrieval.
  const historian = await step("historian", () =>
    deliberateAsHistorian(inputWithChain(), ctx)
  );
  if (historian.ran && runningCost > perDelibCap) {
    const arb = emptyArbitration("per_deliberation_cap_exceeded");
    await finalizeLogAsFailure(
      supabase,
      opts,
      perSpecialist,
      "per_deliberation_cap_exceeded",
      runningCost
    );
    await recordSpend(supabase, org_id, deliberation_id, runningCost);
    return emptyResult(
      opts,
      perSpecialist,
      causalChain,
      arb,
      "per_deliberation_cap_exceeded",
      runningCost,
      Date.now() - t0
    );
  }

  // ---- Arbitration ----
  const arbitration = arbitrate(perSpecialist);

  // ---- Step 7: Synthesizer ----
  const synthesizer = await step("synthesizer", () =>
    deliberateAsSynthesizer(
      { ...inputWithChain(), priorAnalyses: [...perSpecialist] },
      { status: arbitration.status, reason: arbitration.reason },
      ctx
    )
  );

  if (synthesizer.ok) {
    const extras: Record<string, unknown> = {};
    if (causalChainError) extras.causal_chain_error = causalChainError;
    if (consequenceEngineError)
      extras.consequence_engine_error = consequenceEngineError;
    await finalizeLog(
      supabase,
      opts,
      perSpecialist,
      arbitration,
      synthesizer.analysis,
      runningCost,
      extras
    );
    // Sprint 4A: ingest reasoning artifacts into tenant memory. Supplementary
    // — never blocks the deliberation outcome. See triggerMemoryIngest.
    await triggerMemoryIngest(supabase, opts, arbitration);
    // Sprint 4D: capture the structured prediction. Must run AFTER
    // memory ingest so consequence + causal chain sibling rows are
    // already in place; the capture function pulls from them.
    await triggerPredictionCapture(supabase, opts, arbitration);
    // Sprint 4 Polish 3 (Fix 5): fire the deliberation-completed
    // webhook LAST — after every subsystem hook — so a registered
    // receiver gets a payload reflecting the fully finalized state.
    // Failure is recorded to arbitration_rules_applied.webhook_error
    // but never fails the deliberation.
    await triggerWebhookDelivery(supabase, opts, arbitration, {
      anomaly_id: input.anomaly.id,
      asset_id: input.asset.id,
      consequenceProfile,
      total_cost_usd: runningCost,
    });
  } else {
    await finalizeLogAsFailure(
      supabase,
      opts,
      perSpecialist,
      `synthesizer_failed: ${synthesizer.error ?? "unknown"}`,
      runningCost
    );
  }
  await recordSpend(supabase, org_id, deliberation_id, runningCost);

  if (!synthesizer.ok) {
    return emptyResult(
      opts,
      perSpecialist,
      causalChain,
      arbitration,
      "synthesizer_failed",
      runningCost,
      Date.now() - t0
    );
  }

  return {
    deliberation_id,
    ok: true,
    arbitration,
    synthesizer_output: synthesizer.analysis,
    causal_chain: causalChain,
    consequence_profile: consequenceProfile,
    total_cost_usd: runningCost,
    total_latency_ms: Date.now() - t0,
    per_specialist: perSpecialist,
  };
}

export function generateDeliberationId(): string {
  return randomUUID();
}
