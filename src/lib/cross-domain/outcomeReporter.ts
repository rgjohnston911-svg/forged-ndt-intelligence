// ============================================================
// Sprint 4D — Outcome reporting
//
// Operator-driven update path: an outcome report comes in via the
// cross-domain-record-outcome endpoint, lands here, computes the
// calibration_delta deterministically against the stored prediction,
// and UPDATEs the cd_deliberation_predictions row.
//
// Pure deterministic math — no AI calls, no probability estimates.
// Tier deltas use index distance along the canonical TIER_ORDER
// imported from consequenceEngine.ts so calibration math agrees
// with how the engine ranks tiers.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { TIER_ORDER } from "./consequenceEngine";
import type {
  ActualOutcome,
  CalibrationDelta,
  ConsequenceTier,
  RecommendedActionTier,
} from "./types";

export interface RecordOutcomeInput {
  prediction_id: string;
  org_id: string;
  actual: ActualOutcome;
  supabase: SupabaseClient;
}

export interface RecordOutcomeResult {
  ok: boolean;
  calibration_delta?: CalibrationDelta;
  error?: string;
}

interface PredictionRowSnapshot {
  id: string;
  reported_at: string | null;
  primary_mechanism: string | null;
  consequence_overall_tier: string | null;
  recommended_action_tier: string | null;
  time_to_consequence_days: number | null;
}

async function loadPrediction(
  supabase: SupabaseClient,
  prediction_id: string,
  org_id: string
): Promise<PredictionRowSnapshot | null> {
  const { data } = await supabase
    .from("cd_deliberation_predictions")
    .select(
      "id, reported_at, primary_mechanism, consequence_overall_tier, recommended_action_tier, time_to_consequence_days"
    )
    .eq("id", prediction_id)
    .eq("org_id", org_id)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    reported_at: (row.reported_at as string | null) ?? null,
    primary_mechanism: (row.primary_mechanism as string | null) ?? null,
    consequence_overall_tier:
      (row.consequence_overall_tier as string | null) ?? null,
    recommended_action_tier:
      (row.recommended_action_tier as string | null) ?? null,
    time_to_consequence_days:
      typeof row.time_to_consequence_days === "number"
        ? row.time_to_consequence_days
        : null,
  };
}

function computeMechanismMatch(
  actual: ActualOutcome
): CalibrationDelta["mechanism_match"] {
  if (actual.mechanism_confirmed === true) return "correct";
  if (actual.mechanism_confirmed === false) return "incorrect";
  return "unknown";
}

function tierIndex(
  tier: ConsequenceTier | string | null | undefined
): number | null {
  if (typeof tier !== "string") return null;
  const i = TIER_ORDER.indexOf(tier as ConsequenceTier);
  return i >= 0 ? i : null;
}

// Predicted index − actual index. Positive ⇒ platform over-predicted
// severity; negative ⇒ under-predicted. 0 ⇒ exact match. When either
// side is missing the delta is 0 with mechanism_match marking it
// 'unknown'-equivalent. We return null only when both sides are
// missing so the caller can distinguish "no information" from "exact".
function computeConsequenceTierDelta(
  predicted: string | null,
  actual: ConsequenceTier | null
): number {
  const p = tierIndex(predicted);
  const a = tierIndex(actual);
  if (p === null && a === null) return 0;
  if (p === null) return -((a as number) + 1); // strong "under-predicted" signal
  if (a === null) return (p as number) + 1; // strong "over-predicted" signal
  return p - a;
}

function computeActionAlignment(
  predicted: string | null,
  actualAction: ActualOutcome["action_taken"]
): CalibrationDelta["action_tier_alignment"] {
  const ACTION_ORDER: RecommendedActionTier[] = [
    "monitor",
    "engineering_review",
    "urgent_assessment",
    "immediate_remediation",
    "cease_operation",
  ];
  if (
    actualAction === "no_action_taken" ||
    actualAction === "other_action"
  ) {
    return "unknown";
  }
  if (!predicted) return "unknown";
  const p = ACTION_ORDER.indexOf(predicted as RecommendedActionTier);
  const a = ACTION_ORDER.indexOf(actualAction as RecommendedActionTier);
  if (p < 0 || a < 0) return "unknown";
  if (p === a) return "matched";
  // Predicted tier ranked LOWER than actual taken → we recommended
  // less aggressive action than was needed → under-predicted.
  return p < a ? "under_predicted" : "over_predicted";
}

function computeCalibrationDelta(
  pred: PredictionRowSnapshot,
  actual: ActualOutcome
): CalibrationDelta {
  const t2c_error =
    typeof pred.time_to_consequence_days === "number" &&
    typeof actual.days_to_actual_consequence === "number"
      ? pred.time_to_consequence_days - actual.days_to_actual_consequence
      : null;
  return {
    mechanism_match: computeMechanismMatch(actual),
    consequence_tier_delta: computeConsequenceTierDelta(
      pred.consequence_overall_tier,
      actual.actual_consequence_tier
    ),
    time_to_consequence_error_days: t2c_error,
    action_tier_alignment: computeActionAlignment(
      pred.recommended_action_tier,
      actual.action_taken
    ),
    computed_at: new Date().toISOString(),
  };
}

export async function recordOutcome(
  input: RecordOutcomeInput
): Promise<RecordOutcomeResult> {
  try {
    const { prediction_id, org_id, actual, supabase } = input;
    const pred = await loadPrediction(supabase, prediction_id, org_id);
    if (!pred) {
      return { ok: false, error: "prediction_not_found" };
    }
    if (pred.reported_at) {
      return {
        ok: false,
        error: "prediction_already_reported",
      };
    }

    const delta = computeCalibrationDelta(pred, actual);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("cd_deliberation_predictions")
      .update({
        reported_at: now,
        actual_outcome: actual,
        calibration_delta: delta,
        updated_at: now,
      })
      .eq("id", prediction_id)
      .eq("org_id", org_id);
    if (error) {
      return {
        ok: false,
        error: `prediction_update_failed: ${error.message}`,
      };
    }
    return { ok: true, calibration_delta: delta };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `outcome_reporter_threw: ${message}` };
  }
}

// Exported for tests so we can unit-test the pure-function math
// without hitting supabase.
export {
  computeCalibrationDelta,
  computeMechanismMatch,
  computeConsequenceTierDelta,
  computeActionAlignment,
};
