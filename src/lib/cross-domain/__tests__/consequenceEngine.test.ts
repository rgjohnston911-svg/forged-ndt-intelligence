// ============================================================
// Sprint 4C — consequenceEngine tests
//
// Coverage matrix:
//   1. High-criticality subsea hydrocarbon pipeline + cat_3_major + H2S
//      → overall_tier severe/catastrophic, all 5 categories populated,
//      citations include PHMSA/BSEE, recommended_action_tier escalated
//   2. Low-criticality atmospheric structural + cat_2_moderate
//      → overall_tier moderate or lower, regulatory tier negligible
//   3. Missing operating_conditions.fluid → environmental still produces
//      a result, cost may be null (no anchor)
//   4. Missing mechanism_key (no causal chain) → downtime + time-to-cons
//      both null, reasoning explains
//   5. Empty asset → no exception, low-confidence profile, ok:true
//   6. Insert error → ok:false, error preserved, no throw
//
// Tests prior to 4C (132/132) must still pass.
// ============================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildConsequenceProfile,
  assessSafety,
  assessEnvironmental,
  assessRegulatory,
  worstTier,
  deriveRecommendedAction,
  deriveTotalConfidence,
} from "../consequenceEngine";
import type {
  AnomalyContext,
  AssetContext,
  CausalChainResult,
  CategoryAssessment,
} from "../types";

const ORG = "44444444-4444-4444-4444-444444444444";

// ------------------------------------------------------------
// Inline Supabase mock — only needs to handle a single insert
// into cd_anomaly_consequence_assessments.
// ------------------------------------------------------------

interface MockState {
  inserts: Array<Record<string, unknown>>;
  forceInsertError: boolean;
}

function makeMockSupabase(state: MockState): unknown {
  return {
    from(table: string) {
      return {
        _table: table,
        _payload: null as unknown,
        select(_cols?: string) {
          return this;
        },
        insert(payload: unknown) {
          this._payload = payload;
          return this;
        },
        eq(_col: string, _val: unknown) {
          return this;
        },
        then(onFulfilled: (v: unknown) => unknown) {
          if (state.forceInsertError) {
            return Promise.resolve({
              data: null,
              error: { message: "simulated insert failure" },
            }).then(onFulfilled);
          }
          state.inserts.push({
            table: this._table,
            payload: this._payload,
          });
          return Promise.resolve({ data: null, error: null }).then(onFulfilled);
        },
      };
    },
  };
}

// ------------------------------------------------------------
// Fixture builders
// ------------------------------------------------------------

function subseaH2SPipelineFixture(): {
  anomaly: AnomalyContext;
  asset: AssetContext;
  causalChain: CausalChainResult;
} {
  const anomaly: AnomalyContext = {
    id: "anom-1",
    asset_id: "asset-1",
    description: "External wall loss with H2S exposure",
    severity: "cat_3_major",
    observed_at: new Date().toISOString(),
    mechanism_key: "pitting_corrosion",
    measurement_jsonb: { remaining_wall_mm: 7, nominal_wall_mm: 12 },
  };
  const asset: AssetContext = {
    id: "asset-1",
    asset_name: "Riser 14B",
    asset_type: "pipeline_segment",
    domain: "pipeline",
    material: "carbon_steel",
    service_environment: "subsea",
    criticality: "critical",
    age_years: 12,
    operating_conditions: {
      fluid: "crude_oil_h2s_5pct",
      replacement_cost_usd: 5_000_000,
    },
  };
  const causalChain: CausalChainResult = {
    ok: true,
    causal_chain_id: "cc-1",
    primary_mechanism: {
      code: "pitting_corrosion",
      name: "Pitting Corrosion",
      fit_score: 0.85,
      reasoning: "Localized wall loss with H2S service.",
    },
    ranked_alternatives: [],
    failure_path: [],
    confidence: 0.85,
  };
  return { anomaly, asset, causalChain };
}

function atmosphericStructuralFixture(): {
  anomaly: AnomalyContext;
  asset: AssetContext;
} {
  return {
    anomaly: {
      id: "anom-2",
      asset_id: "asset-2",
      description: "Minor surface scaling on handrail",
      severity: "cat_2_moderate",
      observed_at: new Date().toISOString(),
      mechanism_key: "general_corrosion",
      measurement_jsonb: null,
    },
    asset: {
      id: "asset-2",
      asset_name: "Walkway handrail",
      asset_type: "handrail",
      domain: "structural",
      material: "carbon_steel",
      service_environment: "atmospheric",
      criticality: "low",
      age_years: 8,
      operating_conditions: { fluid: "" },
    },
  };
}

// ------------------------------------------------------------
// Pure-function tier helpers
// ------------------------------------------------------------

describe("worstTier", () => {
  it("returns negligible for empty input", () => {
    assert.equal(worstTier([]), "negligible");
  });
  it("returns the highest tier in the list", () => {
    assert.equal(
      worstTier(["low", "moderate", "severe", "high"]),
      "severe"
    );
    assert.equal(worstTier(["negligible", "negligible"]), "negligible");
    assert.equal(
      worstTier(["catastrophic", "low"]),
      "catastrophic"
    );
  });
});

describe("deriveRecommendedAction", () => {
  const c = (tier: CategoryAssessment["tier"]): CategoryAssessment => ({
    category: "safety",
    tier,
    estimated_value: null,
    reasoning: "",
    contributing_factors: [],
  });
  it("any catastrophic → cease_operation", () => {
    assert.equal(
      deriveRecommendedAction([c("low"), c("catastrophic"), c("low")]),
      "cease_operation"
    );
  });
  it("any severe (no catastrophic) → immediate_remediation", () => {
    assert.equal(
      deriveRecommendedAction([c("severe"), c("low"), c("moderate")]),
      "immediate_remediation"
    );
  });
  it("2+ high → urgent_assessment", () => {
    assert.equal(
      deriveRecommendedAction([c("high"), c("high"), c("low"), c("low"), c("low")]),
      "urgent_assessment"
    );
  });
  it("1 high → engineering_review", () => {
    assert.equal(
      deriveRecommendedAction([c("high"), c("low"), c("low")]),
      "engineering_review"
    );
  });
  it("all moderate-or-lower → monitor", () => {
    assert.equal(
      deriveRecommendedAction([c("moderate"), c("low"), c("negligible")]),
      "monitor"
    );
  });
});

describe("deriveTotalConfidence", () => {
  it("all-quantified gives 0.80", () => {
    const cats: CategoryAssessment[] = [
      {
        category: "safety",
        tier: "high",
        estimated_value: { low: 1, expected: 2, high: 3, unit: "USD" },
        reasoning: "",
        contributing_factors: [],
      },
      {
        category: "cost",
        tier: "high",
        estimated_value: { low: 1, expected: 2, high: 3, unit: "USD" },
        reasoning: "",
        contributing_factors: [],
      },
    ];
    assert.equal(deriveTotalConfidence(cats), 0.8);
  });
  it("all-null gives 0.30", () => {
    const cats: CategoryAssessment[] = [
      {
        category: "safety",
        tier: "high",
        estimated_value: null,
        reasoning: "",
        contributing_factors: [],
      },
    ];
    assert.equal(deriveTotalConfidence(cats), 0.3);
  });
});

// ------------------------------------------------------------
// Per-category direct unit tests
// ------------------------------------------------------------

describe("assessSafety — fluid + environment modifiers", () => {
  it("life_safety × cat_4_critical → catastrophic baseline", () => {
    const { anomaly, asset } = subseaH2SPipelineFixture();
    asset.criticality = "life_safety";
    anomaly.severity = "cat_4_critical";
    asset.operating_conditions = { fluid: "water" }; // no modifiers
    asset.service_environment = "atmospheric";
    const r = assessSafety(anomaly, asset);
    assert.equal(r.tier, "catastrophic");
  });
  it("critical × cat_3_major + H2S + subsea → multiple modifiers bump tier", () => {
    const { anomaly, asset } = subseaH2SPipelineFixture();
    const r = assessSafety(anomaly, asset);
    // Base: critical × cat_3_major = high. +H2S = severe. +subsea = catastrophic.
    assert.equal(r.tier, "catastrophic");
    assert.ok(
      r.contributing_factors.some((f) => f.includes("toxic")),
      "should record toxic-fluid factor"
    );
    assert.ok(
      r.contributing_factors.some((f) => f.includes("evacuation")),
      "should record subsea/marine factor"
    );
    assert.ok(r.citation_codes?.includes("API RP 581"));
  });
});

describe("assessRegulatory — PHMSA + BSEE rules", () => {
  it("subsea hydrocarbon pipeline cat_3_major → catastrophic with PHMSA + BSEE citations", () => {
    const { anomaly, asset } = subseaH2SPipelineFixture();
    const r = assessRegulatory(anomaly, asset);
    assert.ok(r.citation_codes?.includes("49 CFR 195"));
    assert.ok(r.citation_codes?.includes("30 CFR 250"));
    assert.equal(r.tier, "catastrophic");
  });
  it("low-criticality atmospheric structural cat_2_moderate → negligible regulatory", () => {
    const { anomaly, asset } = atmosphericStructuralFixture();
    const r = assessRegulatory(anomaly, asset);
    assert.equal(r.tier, "negligible");
    assert.equal(r.citation_codes?.length ?? 0, 0);
  });
});

describe("assessEnvironmental", () => {
  it("hydrocarbon subsea + cat_3_major → severe, cites 40 CFR 110 + 30 CFR 250", () => {
    const { anomaly, asset } = subseaH2SPipelineFixture();
    const r = assessEnvironmental(anomaly, asset);
    assert.equal(r.tier, "severe");
    assert.ok(r.citation_codes?.includes("40 CFR 110"));
    assert.ok(r.citation_codes?.includes("30 CFR 250"));
  });
  it("non-hazardous fluid → negligible", () => {
    const { anomaly, asset } = atmosphericStructuralFixture();
    const r = assessEnvironmental(anomaly, asset);
    assert.equal(r.tier, "negligible");
  });
});

// ------------------------------------------------------------
// buildConsequenceProfile end-to-end
// ------------------------------------------------------------

describe("buildConsequenceProfile — full integration", () => {
  it("subsea H2S hydrocarbon pipeline scenario → high/severe overall, all 5 categories present, INSERT performed", async () => {
    const { anomaly, asset, causalChain } = subseaH2SPipelineFixture();
    const state: MockState = { inserts: [], forceInsertError: false };
    const supabase = makeMockSupabase(state);
    const r = await buildConsequenceProfile({
      anomaly,
      asset,
      causalChain,
      supabase: supabase as never,
      org_id: ORG,
      deliberation_id: "delib-c1",
    });
    assert.equal(r.ok, true, r.error ?? "");
    assert.ok(r.profile, "profile must be present");
    const p = r.profile!;
    assert.equal(p.categories.length, 5);
    // Overall tier must be at least severe given safety→catastrophic + reg→catastrophic
    assert.ok(
      ["severe", "catastrophic"].includes(p.overall_tier),
      `overall_tier ${p.overall_tier} expected severe/catastrophic`
    );
    assert.ok(
      ["immediate_remediation", "cease_operation"].includes(
        p.recommended_action_tier
      ),
      `action ${p.recommended_action_tier}`
    );
    // Time-to-consequence: remaining 7mm, threshold 6mm, slack 1mm,
    // rate 0.5mm/yr → ~730 days. confidence=medium.
    assert.equal(p.time_to_consequence.confidence, "medium");
    assert.ok(
      p.time_to_consequence.estimated_days !== null &&
        p.time_to_consequence.estimated_days! > 0
    );
    // Cost category: anchored to replacement_cost_usd, value non-null
    const cost = p.categories.find((c) => c.category === "cost");
    assert.ok(cost?.estimated_value, "cost should be quantified");
    assert.equal(cost!.estimated_value!.unit, "USD");
    // Citations include PHMSA + BSEE somewhere
    const allCitations = p.categories
      .flatMap((c) => c.citation_codes ?? [])
      .join(" ");
    assert.ok(allCitations.includes("49 CFR 195"));
    assert.ok(allCitations.includes("30 CFR 250"));
    // INSERT happened against the right table with the right shape
    assert.equal(state.inserts.length, 1);
    const ins = state.inserts[0] as Record<string, unknown>;
    assert.equal(ins.table, "cd_anomaly_consequence_assessments");
    const payload = ins.payload as Record<string, unknown>;
    assert.equal(payload.org_id, ORG);
    assert.equal(payload.anomaly_id, "anom-1");
    assert.equal(payload.deliberation_id, "delib-c1");
    assert.equal(payload.overall_tier, p.overall_tier);
  });

  it("low-criticality atmospheric structural cat_2 → moderate-or-lower, regulatory negligible, monitor action", async () => {
    const { anomaly, asset } = atmosphericStructuralFixture();
    const state: MockState = { inserts: [], forceInsertError: false };
    const supabase = makeMockSupabase(state);
    const r = await buildConsequenceProfile({
      anomaly,
      asset,
      supabase: supabase as never,
      org_id: ORG,
    });
    assert.equal(r.ok, true, r.error ?? "");
    const p = r.profile!;
    // Without H2S/explosive/subsea modifiers, safety tier should be
    // at most moderate.
    const tiersOrder = [
      "negligible",
      "low",
      "moderate",
      "high",
      "severe",
      "catastrophic",
    ];
    assert.ok(
      tiersOrder.indexOf(p.overall_tier) <= tiersOrder.indexOf("moderate"),
      `overall_tier=${p.overall_tier} expected moderate or lower`
    );
    const reg = p.categories.find((c) => c.category === "regulatory");
    assert.equal(reg!.tier, "negligible");
    assert.equal(p.recommended_action_tier, "monitor");
  });

  it("missing operating_conditions.fluid → environmental still scored, cost returns null", async () => {
    const { anomaly, asset } = atmosphericStructuralFixture();
    asset.operating_conditions = null;
    const state: MockState = { inserts: [], forceInsertError: false };
    const supabase = makeMockSupabase(state);
    const r = await buildConsequenceProfile({
      anomaly,
      asset,
      supabase: supabase as never,
      org_id: ORG,
    });
    assert.equal(r.ok, true);
    const p = r.profile!;
    const env = p.categories.find((c) => c.category === "environmental");
    assert.ok(env, "environmental must still be present");
    const cost = p.categories.find((c) => c.category === "cost");
    assert.equal(cost!.estimated_value, null);
    assert.ok(
      cost!.reasoning.toLowerCase().includes("no asset replacement cost"),
      "cost reasoning must explain missing anchor"
    );
  });

  it("missing mechanism_key (no causalChain, no anomaly.mechanism_key) → downtime + time-to-cons null", async () => {
    const { anomaly, asset } = atmosphericStructuralFixture();
    anomaly.mechanism_key = null;
    anomaly.measurement_jsonb = null;
    const state: MockState = { inserts: [], forceInsertError: false };
    const supabase = makeMockSupabase(state);
    const r = await buildConsequenceProfile({
      anomaly,
      asset,
      supabase: supabase as never,
      org_id: ORG,
    });
    assert.equal(r.ok, true);
    const p = r.profile!;
    const downtime = p.categories.find((c) => c.category === "downtime");
    assert.equal(downtime!.estimated_value, null);
    assert.ok(
      downtime!.reasoning.toLowerCase().includes("mechanism"),
      "downtime reasoning must mention missing mechanism"
    );
    assert.equal(p.time_to_consequence.estimated_days, null);
    assert.equal(p.time_to_consequence.confidence, "low");
  });

  it("empty asset / minimal inputs → no exception, low-confidence profile", async () => {
    const minimalAnomaly: AnomalyContext = {
      id: "anom-min",
      asset_id: "asset-min",
      description: "",
      severity: "cat_1_minor",
      observed_at: new Date().toISOString(),
      mechanism_key: null,
      measurement_jsonb: null,
    };
    const minimalAsset: AssetContext = {
      id: "asset-min",
      asset_name: "",
      asset_type: "",
      domain: "other",
      material: null,
      service_environment: null,
      criticality: "low",
      age_years: null,
      operating_conditions: null,
      metadata_jsonb: null,
    };
    const state: MockState = { inserts: [], forceInsertError: false };
    const supabase = makeMockSupabase(state);
    const r = await buildConsequenceProfile({
      anomaly: minimalAnomaly,
      asset: minimalAsset,
      supabase: supabase as never,
      org_id: ORG,
    });
    assert.equal(r.ok, true, r.error ?? "");
    const p = r.profile!;
    assert.equal(p.categories.length, 5);
    // With everything null-leaning, confidence trends low
    assert.ok(
      p.total_confidence < 0.6,
      `total_confidence ${p.total_confidence} should be < 0.6`
    );
  });

  it("INSERT error → ok:false, error message preserved, profile still returned for caller inspection, no throw", async () => {
    const { anomaly, asset, causalChain } = subseaH2SPipelineFixture();
    const state: MockState = { inserts: [], forceInsertError: true };
    const supabase = makeMockSupabase(state);
    const r = await buildConsequenceProfile({
      anomaly,
      asset,
      causalChain,
      supabase: supabase as never,
      org_id: ORG,
    });
    assert.equal(r.ok, false);
    assert.ok(
      r.error && r.error.includes("simulated insert failure"),
      `error msg=${r.error}`
    );
    // Profile still returned so the orchestrator can log it / surface
    // partial info even when persistence fails.
    assert.ok(r.profile);
  });
});
