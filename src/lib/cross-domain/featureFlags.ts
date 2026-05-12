// ============================================================
// DEPLOY355 — Cross-domain feature flag helper
// Reads org_feature_flags.feature_flags->>'cross_domain_intelligence'
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

export async function isCrossDomainEnabled(
  orgId: string,
  supabase: SupabaseClient
): Promise<boolean> {
  if (!orgId) return false;

  const { data, error } = await supabase
    .from("org_feature_flags")
    .select("feature_flags")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error || !data) return false;

  const flags = (data.feature_flags ?? {}) as Record<string, unknown>;
  const value = flags["cross_domain_intelligence"];
  return value === true || value === "true";
}
