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
import { checkOrgBudget, recordSpend } from "./budgetGuard";

export interface RunDeliberationOptions {
  org_id: string;
  deliberation_id: string;
  supabase: SupabaseClient;
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

function consensusLevelFor(
  arbitration: ArbitrationDecision
): "unanimous" | "majority_with_dissent" | "split" | "unresolved" {
  if (arbitration.status === "accepted") {
    return arbitration.devils_advocate_objections_unresolved === 0
      ? "unanimous"
      : "majority_with_dissent";
  }
  if (arbitration.status === "flagged_dissent") return "majority_with_dissent";
  return "unresolved";
}

async function ensureLogRow(
  supabase: SupabaseClient,
  opts: RunDeliberationOptions,
  anomaly: AnomalyContext
): Promise<void> {
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
  totalCost: number
): Promise<void> {
  await supabase
    .from("cd_deliberation_log")
    .update({
      specialist_outputs: perSpecialist,
      synthesizer_decision: synthesizer,
      arbitration_rules_applied: [arbitration],
      consensus_level: consensusLevelFor(arbitration),
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

  await ensureLogRow(supabase, opts, input.anomaly);

  const ctx = { cost: { orgId: org_id, supabaseAdmin: supabase } };
  const perSpecialist: SpecialistAnalysis[] = [];
  let runningCost = 0;
  let causalChain: CausalChainResult | null = null;

  const recordOutcome = async (a: SpecialistAnalysis): Promise<void> => {
    perSpecialist.push(a);
    runningCost += a.cost_usd;
    await appendSpecialistToLog(supabase, opts, perSpecialist, runningCost);
  };

  const inputWithChain = (): DeliberationInput => ({
    ...input,
    priorAnalyses: [...perSpecialist],
    causalChain: causalChain ?? undefined,
  });

  // ---- Step 1: Inspector ----
  const inspector = await deliberateAsInspector(inputWithChain(), ctx);
  await recordOutcome(inspector.analysis);
  if (runningCost > perDelibCap) {
    const arb = emptyArbitration("per_deliberation_cap_exceeded");
    await finalizeLog(supabase, opts, perSpecialist, arb, null, runningCost);
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
  const engineer = await deliberateAsEngineer(inputWithChain(), ctx);
  await recordOutcome(engineer.analysis);
  if (!engineer.ok) {
    const arb = emptyArbitration(`engineer_failed: ${engineer.error ?? "unknown"}`);
    await finalizeLog(supabase, opts, perSpecialist, arb, null, runningCost);
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
  if (runningCost > perDelibCap) {
    const arb = emptyArbitration("per_deliberation_cap_exceeded");
    await finalizeLog(supabase, opts, perSpecialist, arb, null, runningCost);
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
  causalChain = await buildCausalChain({
    anomaly: input.anomaly,
    asset: input.asset,
    candidateMechanismCodes: engineer.analysis.cited_mechanisms,
    supabase,
    org_id,
  });

  // ---- Step 4: Researcher ----
  const researcher = await deliberateAsResearcher(inputWithChain(), ctx);
  await recordOutcome(researcher.analysis);
  if (runningCost > perDelibCap) {
    const arb = emptyArbitration("per_deliberation_cap_exceeded");
    await finalizeLog(supabase, opts, perSpecialist, arb, null, runningCost);
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

  // ---- Step 5: Devil's Advocate ----
  const da = await deliberateAsDevilsAdvocate(inputWithChain(), ctx);
  await recordOutcome(da.analysis);
  if (runningCost > perDelibCap) {
    const arb = emptyArbitration("per_deliberation_cap_exceeded");
    await finalizeLog(supabase, opts, perSpecialist, arb, null, runningCost);
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
  const historian = await deliberateAsHistorian(inputWithChain(), ctx);
  await recordOutcome(historian.analysis);
  if (runningCost > perDelibCap) {
    const arb = emptyArbitration("per_deliberation_cap_exceeded");
    await finalizeLog(supabase, opts, perSpecialist, arb, null, runningCost);
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
  const synthesizerInput: DeliberationInput = {
    ...inputWithChain(),
    priorAnalyses: [...perSpecialist],
  };
  const synthesizer = await deliberateAsSynthesizer(
    synthesizerInput,
    { status: arbitration.status, reason: arbitration.reason },
    ctx
  );
  await recordOutcome(synthesizer.analysis);

  await finalizeLog(
    supabase,
    opts,
    perSpecialist,
    arbitration,
    synthesizer.ok ? synthesizer.analysis : null,
    runningCost
  );
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
    total_cost_usd: runningCost,
    total_latency_ms: Date.now() - t0,
    per_specialist: perSpecialist,
  };
}

export function generateDeliberationId(): string {
  return randomUUID();
}
