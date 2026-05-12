// ============================================================
// DEPLOY355 — Cross-domain deliberation state helpers
//
// Pure derivation from a cd_deliberation_log row. No schema change.
// Used by the polling endpoint and by the resume endpoint to figure
// out what state a deliberation is in and what specialist runs next.
// ============================================================

import type { SpecialistRole, SpecialistAnalysis } from "./types";

export const SPECIALIST_ORDER: SpecialistRole[] = [
  "inspector",
  "engineer",
  "researcher",
  "devils_advocate",
  "historian",
  "synthesizer",
];

export type DeliberationStatus = "pending" | "running" | "completed" | "failed";

export interface DeliberationLogRow {
  id: string;
  org_id: string;
  finding_id?: string | null;
  finding_type?: string | null;
  deliberation_started_at?: string | null;
  deliberation_completed_at?: string | null;
  specialist_outputs?: SpecialistAnalysis[] | null;
  synthesizer_decision?: SpecialistAnalysis | null;
  arbitration_rules_applied?:
    | Record<string, unknown>
    | Array<Record<string, unknown>>
    | null;
  consensus_level?: string | null;
  escalated_to_human?: boolean | null;
  total_cost_usd?: number | null;
}

export function deriveStatus(row: DeliberationLogRow): DeliberationStatus {
  if (row.consensus_level === "failed") return "failed";
  if (!row.deliberation_started_at) return "pending";
  if (!row.deliberation_completed_at) return "running";
  return "completed";
}

export function specialistsCompleted(row: DeliberationLogRow): SpecialistRole[] {
  const outputs = Array.isArray(row.specialist_outputs)
    ? row.specialist_outputs
    : [];
  const roles: SpecialistRole[] = [];
  for (const o of outputs) {
    if (o && typeof o === "object" && typeof o.role === "string") {
      roles.push(o.role as SpecialistRole);
    }
  }
  return roles;
}

// Given the canonical order, return the next specialist that hasn't
// completed yet. Returns null if all six are done.
export function currentSpecialist(
  completed: SpecialistRole[]
): SpecialistRole | null {
  const done = new Set(completed);
  for (const r of SPECIALIST_ORDER) {
    if (!done.has(r)) return r;
  }
  return null;
}

export function progressPct(completedCount: number): number {
  const pct = Math.round((completedCount / SPECIALIST_ORDER.length) * 100);
  return Math.max(0, Math.min(100, pct));
}

export function elapsedMs(row: DeliberationLogRow): number {
  if (!row.deliberation_started_at) return 0;
  const start = Date.parse(row.deliberation_started_at);
  if (Number.isNaN(start)) return 0;
  const end = row.deliberation_completed_at
    ? Date.parse(row.deliberation_completed_at)
    : Date.now();
  return Math.max(0, end - start);
}

// arbitration_rules_applied may be a single object or an array of
// applied rules. Failures encode their reason at `.error` on either
// shape; pull it out if present.
export function extractFailureReason(row: DeliberationLogRow): string | null {
  const a = row.arbitration_rules_applied;
  if (!a) return null;
  if (Array.isArray(a)) {
    for (const entry of a) {
      if (entry && typeof entry === "object") {
        const err = (entry as Record<string, unknown>).error;
        if (typeof err === "string" && err.length > 0) return err;
        // Sprint 2 also stored the arbitration object itself here.
        const reason = (entry as Record<string, unknown>).reason;
        if (typeof reason === "string" && reason.length > 0) return reason;
      }
    }
    return null;
  }
  if (typeof a === "object") {
    const err = (a as Record<string, unknown>).error;
    if (typeof err === "string" && err.length > 0) return err;
  }
  return null;
}
