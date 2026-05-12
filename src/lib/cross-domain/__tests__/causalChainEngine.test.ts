import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCausalChain } from "../causalChainEngine";
import { makeMockSupabase } from "./fixtures";
import type { AnomalyContext, AssetContext } from "../types";

const ORG = "44444444-4444-4444-4444-444444444444";

const ASSET: AssetContext = {
  id: "asset-1",
  asset_name: "Subsea Riser 12",
  asset_type: "pipeline_segment",
  domain: "subsea",
  material: "carbon_steel",
  service_environment: "subsea",
  criticality: "high",
  age_years: 14,
};

const ANOMALY: AnomalyContext = {
  id: "anomaly-1",
  asset_id: "asset-1",
  description: "Localized wall loss on external surface",
  severity: "cat_3_major",
  observed_at: new Date().toISOString(),
  mechanism_key: null,
};

const MECHANISMS = [
  {
    mechanism_key: "pitting_corrosion",
    display_name: "Pitting Corrosion",
    category: "corrosion",
    default_consequence_bias: "high",
    related_domains: ["subsea", "pipeline", "marine_vessel"],
    active: true,
  },
  {
    mechanism_key: "general_corrosion",
    display_name: "General Corrosion",
    category: "corrosion",
    default_consequence_bias: "moderate",
    related_domains: ["subsea", "pipeline"],
    active: true,
  },
  {
    mechanism_key: "fatigue_cracking",
    display_name: "Fatigue Cracking",
    category: "fatigue",
    default_consequence_bias: "critical",
    related_domains: ["structural"], // does NOT include subsea
    active: true,
  },
  {
    mechanism_key: "atmospheric_corrosion",
    display_name: "Atmospheric Corrosion",
    category: "corrosion",
    default_consequence_bias: "low",
    related_domains: ["industrial"], // does NOT include subsea
    active: true,
  },
  {
    mechanism_key: "inactive_mechanism",
    display_name: "Inactive Mechanism",
    category: "unknown",
    default_consequence_bias: "low",
    related_domains: ["subsea"],
    active: false,
  },
] as const;

describe("buildCausalChain — single candidate", () => {
  it("returns the single mechanism as primary", async () => {
    const supabase = makeMockSupabase({
      cd_degradation_mechanisms: [...MECHANISMS],
      cd_causal_chains: [],
    });
    const r = await buildCausalChain({
      anomaly: ANOMALY,
      asset: ASSET,
      candidateMechanismCodes: ["pitting_corrosion"],
      supabase: supabase as never,
      org_id: ORG,
    });
    assert.equal(r.ok, true);
    assert.ok(r.primary_mechanism);
    assert.equal(r.primary_mechanism!.code, "pitting_corrosion");
    assert.equal(r.primary_mechanism!.name, "Pitting Corrosion");
    assert.ok(r.primary_mechanism!.fit_score > 0);
    assert.ok(r.failure_path.length > 0);
    assert.ok(r.causal_chain_id);
    // Persisted row
    assert.equal(supabase.__store.cd_causal_chains.length, 1);
  });
});

describe("buildCausalChain — ranking", () => {
  it("ranks correctly when domain fits differ across candidates", async () => {
    const supabase = makeMockSupabase({
      cd_degradation_mechanisms: [...MECHANISMS],
      cd_causal_chains: [],
    });
    const r = await buildCausalChain({
      anomaly: ANOMALY,
      asset: ASSET, // domain=subsea
      candidateMechanismCodes: [
        "atmospheric_corrosion", // industrial only
        "fatigue_cracking",       // structural only
        "pitting_corrosion",      // subsea ✓
      ],
      supabase: supabase as never,
      org_id: ORG,
    });
    assert.equal(r.ok, true);
    // pitting_corrosion should win on domain match
    assert.equal(r.primary_mechanism!.code, "pitting_corrosion");
    // ranked_alternatives = top 3 minus primary = 2 alternatives
    assert.equal(r.ranked_alternatives.length, 2);
    // Fit scores in descending order
    const primaryScore = r.primary_mechanism!.fit_score;
    for (const alt of r.ranked_alternatives) {
      assert.ok(alt.fit_score <= primaryScore);
    }
  });

  it("boosts a mechanism that already matches anomaly.mechanism_key", async () => {
    const supabase = makeMockSupabase({
      cd_degradation_mechanisms: [...MECHANISMS],
      cd_causal_chains: [],
    });
    const r = await buildCausalChain({
      anomaly: { ...ANOMALY, mechanism_key: "general_corrosion" },
      asset: ASSET,
      // pitting and general both match domain, but anomaly already cites general
      candidateMechanismCodes: ["pitting_corrosion", "general_corrosion"],
      supabase: supabase as never,
      org_id: ORG,
    });
    assert.equal(r.primary_mechanism!.code, "general_corrosion");
  });

  it("excludes inactive mechanisms from ranking", async () => {
    const supabase = makeMockSupabase({
      cd_degradation_mechanisms: [...MECHANISMS],
      cd_causal_chains: [],
    });
    const r = await buildCausalChain({
      anomaly: ANOMALY,
      asset: ASSET,
      candidateMechanismCodes: ["inactive_mechanism", "pitting_corrosion"],
      supabase: supabase as never,
      org_id: ORG,
    });
    assert.equal(r.primary_mechanism!.code, "pitting_corrosion");
    // inactive_mechanism should not appear in alternatives
    assert.ok(
      r.ranked_alternatives.every((a) => a.code !== "inactive_mechanism")
    );
  });
});

describe("buildCausalChain — tolerance to missing data", () => {
  it("does not crash when asset has no material set", async () => {
    const supabase = makeMockSupabase({
      cd_degradation_mechanisms: [...MECHANISMS],
      cd_causal_chains: [],
    });
    const r = await buildCausalChain({
      anomaly: ANOMALY,
      asset: { ...ASSET, material: null },
      candidateMechanismCodes: ["pitting_corrosion"],
      supabase: supabase as never,
      org_id: ORG,
    });
    assert.equal(r.ok, true);
    assert.equal(r.primary_mechanism!.code, "pitting_corrosion");
  });

  it("returns ok:false with reason 'no_candidates' on empty candidate list", async () => {
    const supabase = makeMockSupabase({
      cd_degradation_mechanisms: [...MECHANISMS],
      cd_causal_chains: [],
    });
    const r = await buildCausalChain({
      anomaly: ANOMALY,
      asset: ASSET,
      candidateMechanismCodes: [],
      supabase: supabase as never,
      org_id: ORG,
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "no_candidates");
    assert.equal(r.primary_mechanism, null);
    assert.equal(r.causal_chain_id, null);
    assert.equal(supabase.__store.cd_causal_chains.length, 0);
  });

  it("returns ok:false when none of the candidates exist in the DB", async () => {
    const supabase = makeMockSupabase({
      cd_degradation_mechanisms: [...MECHANISMS],
      cd_causal_chains: [],
    });
    const r = await buildCausalChain({
      anomaly: ANOMALY,
      asset: ASSET,
      candidateMechanismCodes: ["nonexistent_mechanism_xyz"],
      supabase: supabase as never,
      org_id: ORG,
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "no_mechanism_records_for_candidates");
  });
});

describe("buildCausalChain — failure path", () => {
  it("builds a category-appropriate forward progression for the top mechanism", async () => {
    const supabase = makeMockSupabase({
      cd_degradation_mechanisms: [...MECHANISMS],
      cd_causal_chains: [],
    });
    const r = await buildCausalChain({
      anomaly: ANOMALY,
      asset: ASSET,
      candidateMechanismCodes: ["pitting_corrosion"],
      supabase: supabase as never,
      org_id: ORG,
    });
    assert.ok(r.failure_path.length >= 3);
    // estimated_days_to_state is null in Sprint 2 (no progression-rate column)
    for (const node of r.failure_path) {
      assert.equal(node.estimated_days_to_state, null);
      assert.equal(typeof node.state, "string");
    }
  });
});
