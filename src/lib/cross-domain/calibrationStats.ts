// ============================================================
// Sprint 4D — Calibration stats
//
// Aggregates cd_deliberation_predictions rows for an org, optionally
// filtered by asset domain / asset type / primary mechanism / date
// range. Reads each row's reported_at + calibration_delta jsonb and
// produces the CalibrationStats object that the calibration endpoint
// returns.
//
// Pure deterministic SQL + math. Empty result sets return zero-valued
// stats (not nulls or throws) so callers can render "no data yet"
// uniformly.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalibrationDelta, CalibrationStats } from "./types";

export interface CalibrationFilters {
  org_id: string;
  asset_domain?: string;
  asset_type?: string;
  primary_mechanism?: string;
  since?: string; // ISO date — inclusive lower bound on predicted_at
  until?: string; // ISO date — inclusive upper bound on predicted_at
}

interface PredictionLite {
  id: string;
  asset_id: string;
  primary_mechanism: string | null;
  reported_at: string | null;
  calibration_delta: CalibrationDelta | null;
}

interface AssetLite {
  id: string;
  domain: string | null;
  asset_type: string | null;
}

function describeFilters(f: CalibrationFilters): string {
  const parts: string[] = [];
  if (f.asset_domain) parts.push(`domain=${f.asset_domain}`);
  if (f.asset_type) parts.push(`type=${f.asset_type}`);
  if (f.primary_mechanism)
    parts.push(`mechanism=${f.primary_mechanism}`);
  if (f.since) parts.push(`since=${f.since}`);
  if (f.until) parts.push(`until=${f.until}`);
  return parts.length === 0 ? "all predictions" : parts.join(", ");
}

function zeroStats(
  org_id: string,
  filter_description: string
): CalibrationStats {
  return {
    org_id,
    filter_description,
    total_predictions: 0,
    predictions_with_outcomes: 0,
    mechanism_match_rate: 0,
    consequence_tier_match_rate: 0,
    consequence_tier_within_1_rate: 0,
    action_tier_alignment_distribution: {
      matched: 0,
      over_predicted: 0,
      under_predicted: 0,
      unknown: 0,
    },
    time_to_consequence_mean_error_days: null,
    computed_at: new Date().toISOString(),
  };
}

async function loadPredictions(
  supabase: SupabaseClient,
  filters: CalibrationFilters
): Promise<PredictionLite[]> {
  let q = supabase
    .from("cd_deliberation_predictions")
    .select(
      "id, asset_id, primary_mechanism, reported_at, calibration_delta, predicted_at"
    )
    .eq("org_id", filters.org_id);
  if (filters.primary_mechanism) {
    q = q.eq("primary_mechanism", filters.primary_mechanism);
  }
  if (filters.since) q = q.gte("predicted_at", filters.since);
  if (filters.until) q = q.lte("predicted_at", filters.until);
  const { data } = await q;
  const rows = (data ?? []) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    asset_id: String(r.asset_id ?? ""),
    primary_mechanism: (r.primary_mechanism as string | null) ?? null,
    reported_at: (r.reported_at as string | null) ?? null,
    calibration_delta:
      (r.calibration_delta as CalibrationDelta | null) ?? null,
  }));
}

async function loadAssetsForIds(
  supabase: SupabaseClient,
  org_id: string,
  ids: string[]
): Promise<Map<string, AssetLite>> {
  const map = new Map<string, AssetLite>();
  if (ids.length === 0) return map;
  const { data } = await supabase
    .from("cd_asset_nodes")
    .select("id, domain, asset_type")
    .eq("org_id", org_id)
    .in("id", ids);
  const rows = (data ?? []) as Record<string, unknown>[];
  for (const r of rows) {
    map.set(String(r.id), {
      id: String(r.id),
      domain: (r.domain as string | null) ?? null,
      asset_type: (r.asset_type as string | null) ?? null,
    });
  }
  return map;
}

export async function computeCalibrationStats(
  filters: CalibrationFilters,
  supabase: SupabaseClient
): Promise<CalibrationStats> {
  const filterDesc = describeFilters(filters);
  const predictions = await loadPredictions(supabase, filters);

  // Asset-side filters (domain, asset_type) require joining to
  // cd_asset_nodes; we resolve via a second query and filter in JS so
  // the calling code stays portable and supabase-js's join semantics
  // don't bite us.
  const needsAssetFilter =
    Boolean(filters.asset_domain) || Boolean(filters.asset_type);
  let filtered = predictions;
  if (needsAssetFilter) {
    const uniqueAssetIds = Array.from(
      new Set(predictions.map((p) => p.asset_id).filter((id) => id.length > 0))
    );
    const assets = await loadAssetsForIds(
      supabase,
      filters.org_id,
      uniqueAssetIds
    );
    filtered = predictions.filter((p) => {
      const a = assets.get(p.asset_id);
      if (!a) return false;
      if (filters.asset_domain && a.domain !== filters.asset_domain)
        return false;
      if (filters.asset_type && a.asset_type !== filters.asset_type)
        return false;
      return true;
    });
  }

  if (filtered.length === 0) {
    return zeroStats(filters.org_id, filterDesc);
  }

  const reported = filtered.filter(
    (p) => p.reported_at !== null && p.calibration_delta !== null
  );
  const total = filtered.length;

  if (reported.length === 0) {
    return {
      ...zeroStats(filters.org_id, filterDesc),
      total_predictions: total,
    };
  }

  // Mechanism match rate — only over rows where the delta carries a
  // determinate mechanism_match. 'unknown' is excluded from the
  // denominator to avoid penalizing the platform for unverifiable cases.
  const mechDeterminate = reported.filter(
    (p) => p.calibration_delta!.mechanism_match !== "unknown"
  );
  const mechCorrect = mechDeterminate.filter(
    (p) => p.calibration_delta!.mechanism_match === "correct"
  ).length;
  const mechanism_match_rate =
    mechDeterminate.length === 0 ? 0 : mechCorrect / mechDeterminate.length;

  // Consequence tier match rates
  const exactTier = reported.filter(
    (p) => (p.calibration_delta!.consequence_tier_delta ?? 0) === 0
  ).length;
  const withinOne = reported.filter(
    (p) => Math.abs(p.calibration_delta!.consequence_tier_delta ?? 0) <= 1
  ).length;
  const consequence_tier_match_rate = exactTier / reported.length;
  const consequence_tier_within_1_rate = withinOne / reported.length;

  // Action tier alignment histogram
  const dist = {
    matched: 0,
    over_predicted: 0,
    under_predicted: 0,
    unknown: 0,
  };
  for (const p of reported) {
    const a = p.calibration_delta!.action_tier_alignment;
    if (a === "matched") dist.matched++;
    else if (a === "over_predicted") dist.over_predicted++;
    else if (a === "under_predicted") dist.under_predicted++;
    else dist.unknown++;
  }

  // Mean absolute time-to-consequence error
  const t2cErrors = reported
    .map((p) => p.calibration_delta!.time_to_consequence_error_days)
    .filter((d): d is number => typeof d === "number");
  const time_to_consequence_mean_error_days =
    t2cErrors.length === 0
      ? null
      : t2cErrors.reduce((s, d) => s + Math.abs(d), 0) / t2cErrors.length;

  return {
    org_id: filters.org_id,
    filter_description: filterDesc,
    total_predictions: total,
    predictions_with_outcomes: reported.length,
    mechanism_match_rate,
    consequence_tier_match_rate,
    consequence_tier_within_1_rate,
    action_tier_alignment_distribution: dist,
    time_to_consequence_mean_error_days,
    computed_at: new Date().toISOString(),
  };
}

// Exported for tests.
export { describeFilters, zeroStats };
