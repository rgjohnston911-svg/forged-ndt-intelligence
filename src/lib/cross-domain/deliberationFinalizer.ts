// ============================================================
// DEPLOY355 — Sprint 3.1 deliberation finalizer
//
// The orchestrator's internal finalizeLog can fail silently when the
// row state is inconsistent (and Sprint 3 had a CHECK-constraint bug
// that did exactly that). This module is the belt-and-suspenders:
// the background function calls finalizeDeliberation in a `finally`
// block to GUARANTEE the row reaches a terminal state.
//
// Idempotent — early-returns if deliberation_completed_at is already
// set. Partial-chain safe — marks failed when fewer than 6 specialists
// completed instead of crashing.
//
// SCHEMA NOTE: consensus_level is a `text` column with a CHECK
// constraint allowing only unanimous|majority_with_dissent|split|
// unresolved. Writes here conform to that constraint. Fine-grained
// arbitration outcome ('accepted'/'flagged_dissent'/etc.) is stored
// in arbitration_rules_applied.final_status for the status endpoint
// to surface.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SpecialistAnalysis,
  ArbitrationDecision,
} from "./types";
import { arbitrate } from "./orchestrator";
import { SPECIALIST_ORDER } from "./deliberationState";

export const REQUIRED_SPECIALIST_COUNT = SPECIALIST_ORDER.length;

// Map fine-grained ArbitrationDecision.status to the existing
// consensus_level CHECK enum.
export function mapConsensusLevel(arbitration: ArbitrationDecision): string {
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

export function escalatedForArbitration(
  arbitration: ArbitrationDecision
): boolean {
  return (
    arbitration.status === "flagged_dissent" ||
    arbitration.status === "rejected_low_confidence"
  );
}

interface DeliberationRowSnapshot {
  id: string;
  deliberation_completed_at: string | null;
  specialist_outputs: SpecialistAnalysis[] | null;
  total_cost_usd: number | null;
}

async function readRow(
  supabase: SupabaseClient,
  deliberation_id: string,
  org_id: string
): Promise<DeliberationRowSnapshot | null> {
  const { data } = await supabase
    .from("cd_deliberation_log")
    .select(
      "id, deliberation_completed_at, specialist_outputs, total_cost_usd"
    )
    .eq("id", deliberation_id)
    .eq("org_id", org_id)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    deliberation_completed_at:
      (row.deliberation_completed_at as string | null) ?? null,
    specialist_outputs: Array.isArray(row.specialist_outputs)
      ? (row.specialist_outputs as SpecialistAnalysis[])
      : null,
    total_cost_usd:
      typeof row.total_cost_usd === "number" ? row.total_cost_usd : null,
  };
}

export interface FinalizeDeliberationResult {
  status: "noop_already_finalized" | "noop_row_missing" | "finalized" | "finalized_partial_chain";
  consensus_level?: string;
  final_status?: string;
}

export async function finalizeDeliberation(
  deliberation_id: string,
  org_id: string,
  supabase: SupabaseClient
): Promise<FinalizeDeliberationResult> {
  const row = await readRow(supabase, deliberation_id, org_id);
  if (!row) return { status: "noop_row_missing" };

  // Idempotency: never finalize twice. If completed_at is set, leave
  // the row alone — there is nothing to do and we don't want to clobber
  // a prior successful finalize with stale state.
  if (row.deliberation_completed_at) {
    return { status: "noop_already_finalized" };
  }

  const outputs = row.specialist_outputs ?? [];

  // Partial-chain safe: if fewer than 6 specialists completed, mark
  // failed (within the CHECK enum) and surface the partial-count
  // error for the status endpoint to report.
  if (outputs.length < REQUIRED_SPECIALIST_COUNT) {
    const errorMessage = `partial_chain: ${outputs.length}/${REQUIRED_SPECIALIST_COUNT} specialists completed`;
    console.warn(
      `[cross-domain finalize] ${deliberation_id} ${errorMessage}`
    );
    await supabase
      .from("cd_deliberation_log")
      .update({
        consensus_level: "unresolved",
        escalated_to_human: true,
        arbitration_rules_applied: {
          error: errorMessage,
          final_status: "failed",
          specialist_outputs_count: outputs.length,
        },
        synthesizer_decision: null,
        deliberation_completed_at: new Date().toISOString(),
      })
      .eq("id", deliberation_id);
    return {
      status: "finalized_partial_chain",
      consensus_level: "unresolved",
      final_status: "failed",
    };
  }

  // Find synthesizer by ROLE search (defensive against ordering bugs)
  // rather than blind array index access.
  const synthesizer =
    outputs.find((o) => o && typeof o === "object" && o.role === "synthesizer") ??
    null;

  const arbitration = arbitrate(outputs);
  const consensusLevel = mapConsensusLevel(arbitration);
  const escalated = escalatedForArbitration(arbitration);

  await supabase
    .from("cd_deliberation_log")
    .update({
      deliberation_completed_at: new Date().toISOString(),
      synthesizer_decision: synthesizer,
      consensus_level: consensusLevel,
      escalated_to_human: escalated,
      arbitration_rules_applied: {
        arbitration_decision: arbitration,
        final_status: arbitration.status,
      },
    })
    .eq("id", deliberation_id);

  return {
    status: "finalized",
    consensus_level: consensusLevel,
    final_status: arbitration.status,
  };
}
