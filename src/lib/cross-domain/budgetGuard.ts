// ============================================================
// DEPLOY355 — Cross-domain budget guard
//
// Reads daily + per-deliberation cost caps from
// org_feature_flags.feature_flags. Sums recent ai_cost_log
// rows to determine current daily spend. Caps:
//   - cross_domain.daily_cap_usd        (default 50)
//   - cross_domain.per_deliberation_cap_usd (default 15)
//
// recordSpend writes a 0-cost audit row to ai_cost_log so the
// per-deliberation total is queryable without double-counting
// the per-specialist rows the wrappers already write.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_DAILY_CAP_USD = 50;
export const DEFAULT_PER_DELIBERATION_CAP_USD = 15;

export interface BudgetCheckResult {
  ok: boolean;
  reason?: string;
  daily_spent_usd: number;
  daily_cap_usd: number;
  per_deliberation_cap_usd: number;
}

interface CrossDomainFlags {
  daily_cap_usd?: number;
  per_deliberation_cap_usd?: number;
}

async function readCaps(
  supabase: SupabaseClient,
  org_id: string
): Promise<{ daily_cap_usd: number; per_deliberation_cap_usd: number }> {
  const { data } = await supabase
    .from("org_feature_flags")
    .select("feature_flags")
    .eq("org_id", org_id)
    .maybeSingle();

  const flags = (data?.feature_flags ?? {}) as Record<string, unknown>;
  const crossDomain = (flags["cross_domain"] ?? {}) as CrossDomainFlags;
  const daily =
    typeof crossDomain.daily_cap_usd === "number"
      ? crossDomain.daily_cap_usd
      : DEFAULT_DAILY_CAP_USD;
  const perDelib =
    typeof crossDomain.per_deliberation_cap_usd === "number"
      ? crossDomain.per_deliberation_cap_usd
      : DEFAULT_PER_DELIBERATION_CAP_USD;
  return { daily_cap_usd: daily, per_deliberation_cap_usd: perDelib };
}

async function sumDailyCrossDomainSpend(
  supabase: SupabaseClient,
  org_id: string
): Promise<number> {
  const sinceISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("ai_cost_log")
    .select("cost_usd")
    .eq("org_id", org_id)
    .like("code_name", "cross_domain:%")
    .gte("created_at", sinceISO);
  if (!Array.isArray(data)) return 0;
  let total = 0;
  for (const row of data) {
    const v = (row as { cost_usd?: number | string | null }).cost_usd;
    const n = typeof v === "number" ? v : v != null ? Number(v) : 0;
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

export async function checkOrgBudget(
  supabase: SupabaseClient,
  org_id: string
): Promise<BudgetCheckResult> {
  const { daily_cap_usd, per_deliberation_cap_usd } = await readCaps(
    supabase,
    org_id
  );
  const daily_spent_usd = await sumDailyCrossDomainSpend(supabase, org_id);

  // Projecting one more deliberation at full per_deliberation_cap.
  if (daily_spent_usd + per_deliberation_cap_usd > daily_cap_usd) {
    return {
      ok: false,
      reason: "org_daily_cap_exceeded",
      daily_spent_usd,
      daily_cap_usd,
      per_deliberation_cap_usd,
    };
  }
  return {
    ok: true,
    daily_spent_usd,
    daily_cap_usd,
    per_deliberation_cap_usd,
  };
}

// Audit-trail write. cost_usd=0 so this row does NOT double-count
// the per-specialist rows the wrappers already wrote. The actual
// deliberation total lives in metadata.deliberation_total_usd.
export async function recordSpend(
  supabase: SupabaseClient,
  org_id: string,
  deliberation_id: string,
  cost_usd: number
): Promise<void> {
  await supabase.from("ai_cost_log").insert({
    org_id,
    code_name: "cross_domain:deliberation_total",
    model: "n/a",
    input_tokens: 0,
    output_tokens: 0,
    cost_usd: 0,
    request_id: null,
    metadata: {
      deliberation_id,
      deliberation_total_usd: cost_usd,
      audit_only: true,
    },
  });
}
