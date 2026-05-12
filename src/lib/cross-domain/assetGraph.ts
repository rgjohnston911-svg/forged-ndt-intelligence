// ============================================================
// DEPLOY355 — Cross-domain asset graph engine
//
// Five async functions over the cd_asset_nodes / cd_asset_relationships
// graph plus related history. All functions take a Supabase client
// as a DI parameter so callers control whether they use anon or
// service-role context. The client's session/key governs RLS.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AssetGraphResult,
  AssetNode,
  AssetRelationship,
  InspectionEvent,
  AssetAnomaly,
  CausalChain,
  AssetTimelineEvent,
  RelationshipType,
} from "./types";

const ASSET_COLUMNS =
  "id,org_id,asset_key,asset_name,domain,asset_type,asset_subtype,parent_asset_id," +
  "location_description,gps_lat,gps_lon,material,material_grade,coating_system," +
  "design_code,service_environment,operating_conditions,owner,operator,client," +
  "install_date,design_life_years,expected_service_life_end,criticality,status," +
  "metadata_jsonb,created_at,updated_at";

async function loadAssetsByIds(
  supabase: SupabaseClient,
  orgId: string,
  ids: string[]
): Promise<AssetNode[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("cd_asset_nodes")
    .select(ASSET_COLUMNS)
    .eq("org_id", orgId)
    .in("id", ids);
  if (error) throw new Error(`loadAssetsByIds: ${error.message}`);
  return (data ?? []) as unknown as AssetNode[];
}

async function loadRelationships(
  supabase: SupabaseClient,
  orgId: string,
  assetId: string
): Promise<AssetRelationship[]> {
  const { data, error } = await supabase
    .from("cd_asset_relationships")
    .select("*")
    .eq("org_id", orgId)
    .or(`source_asset_id.eq.${assetId},target_asset_id.eq.${assetId}`);
  if (error) throw new Error(`loadRelationships: ${error.message}`);
  return (data ?? []) as AssetRelationship[];
}

function targetsByType(
  rels: AssetRelationship[],
  assetId: string,
  type: RelationshipType
): string[] {
  return rels
    .filter((r) => r.relationship_type === type && r.source_asset_id === assetId)
    .map((r) => r.target_asset_id);
}

function sourcesByType(
  rels: AssetRelationship[],
  assetId: string,
  type: RelationshipType
): string[] {
  return rels
    .filter((r) => r.relationship_type === type && r.target_asset_id === assetId)
    .map((r) => r.source_asset_id);
}

function bothEndsByType(
  rels: AssetRelationship[],
  assetId: string,
  type: RelationshipType
): string[] {
  const ids = new Set<string>();
  for (const r of rels) {
    if (r.relationship_type !== type) continue;
    if (r.source_asset_id === assetId) ids.add(r.target_asset_id);
    else if (r.target_asset_id === assetId) ids.add(r.source_asset_id);
  }
  return Array.from(ids);
}

export async function getAssetGraph(
  orgId: string,
  assetId: string,
  supabase: SupabaseClient
): Promise<AssetGraphResult> {
  const empty: AssetGraphResult = {
    asset: null,
    parents: [],
    children: [],
    protected_by: [],
    coating_systems: [],
    cp_zones: [],
    connected_assets: [],
    weld_connections: [],
    inspection_history: [],
    anomaly_history: [],
    causal_chains: [],
    timeline: [],
  };
  if (!orgId || !assetId) return empty;

  const { data: assetRow, error: assetErr } = await supabase
    .from("cd_asset_nodes")
    .select(ASSET_COLUMNS)
    .eq("org_id", orgId)
    .eq("id", assetId)
    .maybeSingle();
  if (assetErr) throw new Error(`getAssetGraph asset: ${assetErr.message}`);
  if (!assetRow) return empty;
  const asset = assetRow as unknown as AssetNode;

  const rels = await loadRelationships(supabase, orgId, assetId);

  const parentIds = asset.parent_asset_id ? [asset.parent_asset_id] : [];
  const childIds = sourcesByType(rels, assetId, "parent_child");
  const protectedByIds = targetsByType(rels, assetId, "protected_by");
  const coatedByIds = targetsByType(rels, assetId, "coated_by");
  const cpZoneIds = bothEndsByType(rels, assetId, "same_cp_zone");
  const connectedIds = bothEndsByType(rels, assetId, "connected_to");
  const weldedIds = bothEndsByType(rels, assetId, "welded_to");

  const allRelatedIds = Array.from(
    new Set([
      ...parentIds, ...childIds, ...protectedByIds, ...coatedByIds,
      ...cpZoneIds, ...connectedIds, ...weldedIds,
    ])
  );

  const [
    relatedAssets,
    inspectionRes,
    anomalyRes,
    causalRes,
    timelineRes,
  ] = await Promise.all([
    loadAssetsByIds(supabase, orgId, allRelatedIds),
    supabase
      .from("cd_inspection_events")
      .select("*")
      .eq("org_id", orgId)
      .eq("asset_id", assetId)
      .order("inspection_date", { ascending: false }),
    supabase
      .from("cd_asset_anomalies")
      .select("*")
      .eq("org_id", orgId)
      .eq("asset_id", assetId)
      .order("created_at", { ascending: false }),
    supabase
      .from("cd_causal_chains")
      .select("*")
      .eq("org_id", orgId)
      .eq("asset_id", assetId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("cd_asset_timeline_events")
      .select("*")
      .eq("org_id", orgId)
      .eq("asset_id", assetId)
      .order("event_date", { ascending: false }),
  ]);

  if (inspectionRes.error) throw new Error(`getAssetGraph inspections: ${inspectionRes.error.message}`);
  if (anomalyRes.error) throw new Error(`getAssetGraph anomalies: ${anomalyRes.error.message}`);
  if (causalRes.error) throw new Error(`getAssetGraph causal: ${causalRes.error.message}`);
  if (timelineRes.error) throw new Error(`getAssetGraph timeline: ${timelineRes.error.message}`);

  const byId = new Map<string, AssetNode>(relatedAssets.map((a) => [a.id, a]));
  const pickAll = (ids: string[]): AssetNode[] =>
    ids.map((id) => byId.get(id)).filter((a): a is AssetNode => Boolean(a));

  return {
    asset,
    parents: pickAll(parentIds),
    children: pickAll(childIds),
    protected_by: pickAll(protectedByIds),
    coating_systems: pickAll(coatedByIds),
    cp_zones: pickAll(cpZoneIds),
    connected_assets: pickAll(connectedIds),
    weld_connections: pickAll(weldedIds),
    inspection_history: (inspectionRes.data ?? []) as InspectionEvent[],
    anomaly_history: (anomalyRes.data ?? []) as AssetAnomaly[],
    causal_chains: (causalRes.data ?? []) as CausalChain[],
    timeline: (timelineRes.data ?? []) as AssetTimelineEvent[],
  };
}

export async function findRelatedAssets(
  orgId: string,
  assetId: string,
  relationshipTypes: RelationshipType[],
  supabase: SupabaseClient
): Promise<AssetNode[]> {
  if (!orgId || !assetId || !relationshipTypes.length) return [];

  const { data: rels, error } = await supabase
    .from("cd_asset_relationships")
    .select("source_asset_id,target_asset_id,relationship_type")
    .eq("org_id", orgId)
    .in("relationship_type", relationshipTypes)
    .or(`source_asset_id.eq.${assetId},target_asset_id.eq.${assetId}`);
  if (error) throw new Error(`findRelatedAssets: ${error.message}`);

  const otherIds = new Set<string>();
  for (const r of rels ?? []) {
    const row = r as { source_asset_id: string; target_asset_id: string };
    if (row.source_asset_id === assetId) otherIds.add(row.target_asset_id);
    else if (row.target_asset_id === assetId) otherIds.add(row.source_asset_id);
  }

  return loadAssetsByIds(supabase, orgId, Array.from(otherIds));
}

export async function findAssetsSharingMechanism(
  orgId: string,
  mechanismKey: string,
  supabase: SupabaseClient
): Promise<AssetNode[]> {
  if (!orgId || !mechanismKey) return [];

  const { data: anomalies, error: anomErr } = await supabase
    .from("cd_asset_anomalies")
    .select("asset_id")
    .eq("org_id", orgId)
    .eq("mechanism_key", mechanismKey);
  if (anomErr) throw new Error(`findAssetsSharingMechanism: ${anomErr.message}`);

  const assetIds = Array.from(
    new Set(
      (anomalies ?? [])
        .map((r) => (r as { asset_id: string | null }).asset_id)
        .filter((id): id is string => Boolean(id))
    )
  );
  return loadAssetsByIds(supabase, orgId, assetIds);
}

export async function findAssetsInSameEnvironment(
  orgId: string,
  assetId: string,
  supabase: SupabaseClient
): Promise<AssetNode[]> {
  if (!orgId || !assetId) return [];

  const { data: asset, error: assetErr } = await supabase
    .from("cd_asset_nodes")
    .select("service_environment")
    .eq("org_id", orgId)
    .eq("id", assetId)
    .maybeSingle();
  if (assetErr) throw new Error(`findAssetsInSameEnvironment: ${assetErr.message}`);

  const env = (asset as { service_environment: string | null } | null)?.service_environment;
  const fromRels = await findRelatedAssets(orgId, assetId, ["same_environment"], supabase);

  if (!env) return fromRels;

  const { data: byEnv, error: byEnvErr } = await supabase
    .from("cd_asset_nodes")
    .select(ASSET_COLUMNS)
    .eq("org_id", orgId)
    .eq("service_environment", env)
    .neq("id", assetId);
  if (byEnvErr) throw new Error(`findAssetsInSameEnvironment env: ${byEnvErr.message}`);

  const dedup = new Map<string, AssetNode>();
  for (const a of fromRels) dedup.set(a.id, a);
  for (const a of (byEnv ?? []) as unknown as AssetNode[]) dedup.set(a.id, a);
  return Array.from(dedup.values());
}

export async function findAssetsImpactedByFailure(
  orgId: string,
  assetId: string,
  supabase: SupabaseClient
): Promise<AssetNode[]> {
  if (!orgId || !assetId) return [];

  return findRelatedAssets(
    orgId,
    assetId,
    [
      "failure_dependency",
      "operational_dependency",
      "feeds",
      "drains_to",
      "supports",
      "protected_by",
    ],
    supabase
  );
}
