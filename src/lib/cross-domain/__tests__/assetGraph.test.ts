import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getAssetGraph,
  findRelatedAssets,
  findAssetsSharingMechanism,
  findAssetsInSameEnvironment,
  findAssetsImpactedByFailure,
} from "../assetGraph";
import { makeMockSupabase } from "./fixtures";

const ORG = "11111111-1111-1111-1111-111111111111";
const A_PARENT = "aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const A_ROOT = "bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const A_CHILD = "cccc3333-cccc-cccc-cccc-cccccccccccc";
const A_NEIGHBOR = "dddd4444-dddd-dddd-dddd-dddddddddddd";
const A_DOWNSTREAM = "eeee5555-eeee-eeee-eeee-eeeeeeeeeeee";

function mkAsset(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    org_id: ORG,
    asset_key: null,
    asset_name: `Asset ${id.slice(0, 4)}`,
    domain: "pipeline",
    asset_type: "pipe",
    asset_subtype: null,
    parent_asset_id: null,
    location_description: null,
    gps_lat: null,
    gps_lon: null,
    material: null,
    material_grade: null,
    coating_system: null,
    design_code: null,
    service_environment: null,
    operating_conditions: {},
    owner: null,
    operator: null,
    client: null,
    install_date: null,
    design_life_years: null,
    expected_service_life_end: null,
    criticality: "moderate",
    status: "active",
    metadata_jsonb: {},
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function seed() {
  return {
    asset_nodes: [
      mkAsset(A_PARENT),
      mkAsset(A_ROOT, { parent_asset_id: A_PARENT, service_environment: "splash_zone" }),
      mkAsset(A_CHILD),
      mkAsset(A_NEIGHBOR, { service_environment: "splash_zone" }),
      mkAsset(A_DOWNSTREAM),
    ],
    asset_relationships: [
      {
        id: "r1", org_id: ORG, source_asset_id: A_CHILD, target_asset_id: A_ROOT,
        relationship_type: "parent_child", confidence: 1, description: null,
        created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "r2", org_id: ORG, source_asset_id: A_ROOT, target_asset_id: A_NEIGHBOR,
        relationship_type: "connected_to", confidence: 1, description: null,
        created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "r3", org_id: ORG, source_asset_id: A_ROOT, target_asset_id: A_DOWNSTREAM,
        relationship_type: "feeds", confidence: 1, description: null,
        created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
      },
    ],
    inspection_events: [
      {
        id: "ie1", org_id: ORG, asset_id: A_ROOT, domain: "pipeline",
        inspection_type: "UT", inspection_date: "2026-04-01",
        evidence_quality: "moderate", confidence: 0.8, status: "approved",
        created_at: "2026-04-01T00:00:00Z", updated_at: "2026-04-01T00:00:00Z",
      },
    ],
    asset_anomalies: [
      {
        id: "an1", org_id: ORG, asset_id: A_ROOT, inspection_event_id: "ie1",
        domain: "pipeline", anomaly_type: "crack", mechanism_key: "fatigue_cracking",
        severity: "cat_3_major", description: "near weld toe",
        authority_status: "hold_for_review", status: "open",
        created_at: "2026-04-01T00:00:00Z", updated_at: "2026-04-01T00:00:00Z",
      },
      {
        id: "an2", org_id: ORG, asset_id: A_NEIGHBOR, inspection_event_id: null,
        domain: "pipeline", anomaly_type: "crack", mechanism_key: "fatigue_cracking",
        severity: "cat_2_moderate", description: "neighbor crack",
        authority_status: "hold_for_review", status: "open",
        created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z",
      },
    ],
    causal_chains: [
      {
        id: "cc1", org_id: ORG, asset_id: A_ROOT, title: "Fatigue chain",
        summary: null, chain_type: "degradation", linked_anomaly_ids: [], linked_asset_ids: [],
        linked_mechanisms: [], chain_steps: [], confidence: 0.5,
        competing_hypotheses: [], missing_evidence: [], recommended_information_gain_actions: [],
        created_by: "system", created_at: "2026-04-03T00:00:00Z", updated_at: "2026-04-03T00:00:00Z",
      },
    ],
    asset_timeline_events: [
      {
        id: "te1", org_id: ORG, asset_id: A_ROOT, event_type: "inspection",
        event_date: "2026-04-01T00:00:00Z", title: "UT scan", description: null,
        severity: null, evidence_jsonb: {}, created_at: "2026-04-01T00:00:00Z",
      },
    ],
  };
}

describe("getAssetGraph", () => {
  it("returns asset, parent, child, connected, history slices", async () => {
    const supabase = makeMockSupabase(seed()) as never;
    const g = await getAssetGraph(ORG, A_ROOT, supabase);
    assert.equal(g.asset?.id, A_ROOT);
    assert.deepEqual(g.parents.map((a) => a.id), [A_PARENT]);
    assert.deepEqual(g.children.map((a) => a.id), [A_CHILD]);
    assert.deepEqual(g.connected_assets.map((a) => a.id), [A_NEIGHBOR]);
    assert.equal(g.inspection_history.length, 1);
    assert.equal(g.anomaly_history.length, 1);
    assert.equal(g.causal_chains.length, 1);
    assert.equal(g.timeline.length, 1);
  });

  it("returns empty result for unknown asset", async () => {
    const supabase = makeMockSupabase(seed()) as never;
    const g = await getAssetGraph(ORG, "ffffffff-ffff-ffff-ffff-ffffffffffff", supabase);
    assert.equal(g.asset, null);
    assert.deepEqual(g.parents, []);
    assert.deepEqual(g.children, []);
  });
});

describe("findRelatedAssets", () => {
  it("filters by relationship type", async () => {
    const supabase = makeMockSupabase(seed()) as never;
    const connected = await findRelatedAssets(ORG, A_ROOT, ["connected_to"], supabase);
    assert.deepEqual(connected.map((a) => a.id), [A_NEIGHBOR]);

    const feeds = await findRelatedAssets(ORG, A_ROOT, ["feeds"], supabase);
    assert.deepEqual(feeds.map((a) => a.id), [A_DOWNSTREAM]);
  });
});

describe("findAssetsSharingMechanism", () => {
  it("returns assets with anomalies of the given mechanism", async () => {
    const supabase = makeMockSupabase(seed()) as never;
    const assets = await findAssetsSharingMechanism(ORG, "fatigue_cracking", supabase);
    const ids = new Set(assets.map((a) => a.id));
    assert.equal(ids.has(A_ROOT), true);
    assert.equal(ids.has(A_NEIGHBOR), true);
  });
});

describe("findAssetsInSameEnvironment", () => {
  it("returns peers sharing service_environment, excluding self", async () => {
    const supabase = makeMockSupabase(seed()) as never;
    const peers = await findAssetsInSameEnvironment(ORG, A_ROOT, supabase);
    const ids = peers.map((a) => a.id);
    assert.equal(ids.includes(A_NEIGHBOR), true);
    assert.equal(ids.includes(A_ROOT), false);
  });
});

describe("findAssetsImpactedByFailure", () => {
  it("returns downstream/dependency assets", async () => {
    const supabase = makeMockSupabase(seed()) as never;
    const impacted = await findAssetsImpactedByFailure(ORG, A_ROOT, supabase);
    assert.equal(impacted.map((a) => a.id).includes(A_DOWNSTREAM), true);
  });
});
