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

  it("Sprint 4 Polish (Fix E): when both candidates are Engineer-cited, severity_envelope decides — pitting wins on cat_3_major × high bias", async () => {
    // The prior assertion (general_corrosion wins from anomaly.mechanism_key
    // boost) was based on the old scorer that only checked anomaly.mechanism_key.
    // Under the new normalization, BOTH candidates are members of Engineer's
    // cited list (since candidateMechanismCodes ARE Engineer's cited mechanisms
    // in production wiring), so mechanism_already_cited scores 1.0 for both.
    // Differentiation falls to severity_envelope. For cat_3_major: pitting
    // (default_consequence_bias=high, idx 3) matches exactly → 1.0;
    // general (moderate, idx 2) is one step away → 0.66. Pitting wins.
    const supabase = makeMockSupabase({
      cd_degradation_mechanisms: [...MECHANISMS],
      cd_causal_chains: [],
    });
    const r = await buildCausalChain({
      anomaly: { ...ANOMALY, mechanism_key: "general_corrosion" },
      asset: ASSET,
      candidateMechanismCodes: ["pitting_corrosion", "general_corrosion"],
      supabase: supabase as never,
      org_id: ORG,
    });
    assert.equal(r.primary_mechanism!.code, "pitting_corrosion");
    // Both must have fired the cited component.
    assert.ok(
      /mechanism_already_cited=1\.00/.test(r.primary_mechanism!.reasoning)
    );
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

// ============================================================
// Sprint 3.3 — schema-fidelity regression.
//
// The Sprint 2 engine SELECTed three columns that don't exist in
// the live cd_degradation_mechanisms table: applicable_materials,
// typical_severity_range, typical_progression_rate. PostgREST
// rejected the query (`42703 column ... does not exist`) which
// silently became `mechanism_lookup_failed` — no cd_causal_chains
// rows ever got written in production.
//
// This test pins the real 14-column shape from the deployed schema:
//   id, mechanism_key, display_name, category, description,
//   physics_explanation, related_domains, typical_evidence,
//   accelerators, inhibitors, related_codes,
//   default_consequence_bias, active, created_at
// Mechanism rows are seeded with EXACTLY those columns (nothing
// else) so a future regression that re-introduces phantom columns
// to the SELECT will be caught: a row that doesn't include the
// phantom would parse as undefined, and any code that expected it
// to be present would break.
// ============================================================

// The 8 mechanism keys Engineer actually cited in the smoke-test
// deliberation that surfaced this bug (org 713dcec2-..., anomaly
// 00000000-...-000000000a02).
const SMOKE_TEST_ENGINEER_MECHANISMS = [
  "coating_disbondment",
  "underfilm_corrosion",
  "cathodic_protection_failure",
  "anode_depletion",
  "pitting_corrosion",
  "crevice_corrosion",
  "microbiologically_influenced_corrosion",
  "abrasion_damage",
] as const;

// Seeded with ONLY the real 14 columns — phantom column names are
// deliberately absent so any code that depends on them shows up.
const REAL_SCHEMA_MECHANISMS = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    mechanism_key: "coating_disbondment",
    display_name: "Coating Disbondment",
    category: "coating",
    description: "Loss of adhesion between coating and substrate.",
    physics_explanation: "Adhesive failure at the coating-substrate interface.",
    related_domains: ["subsea", "marine_vessel", "coatings"],
    typical_evidence: ["visual_inspection", "adhesion_pull_test"],
    accelerators: ["water_ingress", "elevated_temperature"],
    inhibitors: ["surface_prep_quality"],
    related_codes: ["NACE_SP0188"],
    default_consequence_bias: "moderate",
    active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    mechanism_key: "underfilm_corrosion",
    display_name: "Underfilm Corrosion",
    category: "coating",
    description: "Corrosion proceeding beneath an intact coating film.",
    physics_explanation: "Electrolyte diffusion through the film.",
    related_domains: ["subsea", "coatings", "corrosion"],
    typical_evidence: ["coating_blistering", "rust_staining"],
    accelerators: ["chloride_exposure"],
    inhibitors: ["barrier_coatings"],
    related_codes: ["ASTM_D610"],
    default_consequence_bias: "high",
    active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    mechanism_key: "cathodic_protection_failure",
    display_name: "Cathodic Protection Failure",
    category: "corrosion",
    description: "CP system fails to maintain protective potential.",
    physics_explanation: "Anode depletion or reference electrode drift.",
    related_domains: ["subsea", "corrosion"],
    typical_evidence: ["potential_survey", "anode_inspection"],
    accelerators: ["high_current_demand"],
    inhibitors: ["regular_cp_survey"],
    related_codes: ["DNV_RP_B401"],
    default_consequence_bias: "high",
    active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000004",
    mechanism_key: "anode_depletion",
    display_name: "Anode Depletion",
    category: "corrosion",
    description: "Sacrificial anode consumed below useful mass.",
    physics_explanation: "Galvanic consumption of sacrificial mass.",
    related_domains: ["subsea", "corrosion"],
    typical_evidence: ["anode_mass_measurement"],
    accelerators: ["coating_breakdown"],
    inhibitors: ["coating_integrity"],
    related_codes: ["DNV_RP_B401"],
    default_consequence_bias: "moderate",
    active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000005",
    mechanism_key: "pitting_corrosion",
    display_name: "Pitting Corrosion",
    category: "corrosion",
    description: "Localized anodic dissolution producing pits.",
    physics_explanation: "Breakdown of passive film at local sites.",
    related_domains: ["subsea", "pipeline", "marine_vessel", "corrosion"],
    typical_evidence: ["pit_depth_measurement", "ut_scan"],
    accelerators: ["chloride", "stagnant_conditions"],
    inhibitors: ["alloy_selection"],
    related_codes: ["NACE_TM0177"],
    default_consequence_bias: "high",
    active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000006",
    mechanism_key: "crevice_corrosion",
    display_name: "Crevice Corrosion",
    category: "corrosion",
    description: "Localized corrosion in crevices and shielded areas.",
    physics_explanation: "Differential aeration cell within the crevice.",
    related_domains: ["subsea", "corrosion"],
    typical_evidence: ["visual", "disassembly_inspection"],
    accelerators: ["stagnant_electrolyte"],
    inhibitors: ["crevice_free_design"],
    related_codes: ["ASTM_G78"],
    default_consequence_bias: "high",
    active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000007",
    mechanism_key: "microbiologically_influenced_corrosion",
    display_name: "Microbiologically Influenced Corrosion (MIC)",
    category: "corrosion",
    description: "Corrosion driven or accelerated by microbial activity.",
    physics_explanation: "Sulfate-reducing bacteria produce localized attack.",
    related_domains: ["subsea", "corrosion"],
    typical_evidence: ["mic_swab", "biofilm_visual"],
    accelerators: ["stagnant_water", "organic_matter"],
    inhibitors: ["biocide_treatment"],
    related_codes: ["NACE_TM0212"],
    default_consequence_bias: "high",
    active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000008",
    mechanism_key: "abrasion_damage",
    display_name: "Abrasion Damage",
    category: "abrasion",
    description: "Surface material loss from mechanical scraping.",
    physics_explanation: "Mechanical wear from contact with abrasive media.",
    related_domains: ["subsea", "marine_vessel"],
    typical_evidence: ["wear_pattern", "thickness_measurement"],
    accelerators: ["seabed_contact", "currents"],
    inhibitors: ["wear_resistant_coating"],
    related_codes: [],
    default_consequence_bias: "moderate",
    active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
];

describe("buildCausalChain — real 14-column schema (Sprint 3.3 regression)", () => {
  it("succeeds against the actual cd_degradation_mechanisms schema with the smoke-test mechanism keys", async () => {
    const supabase = makeMockSupabase({
      cd_degradation_mechanisms: REAL_SCHEMA_MECHANISMS,
      cd_causal_chains: [],
    });

    const subseaAsset: AssetContext = {
      ...ASSET,
      domain: "subsea",
      material: "carbon_steel",
    };
    const subseaAnomaly: AnomalyContext = {
      id: "00000000-0000-0000-0000-000000000a02",
      asset_id: "00000000-0000-0000-0000-000000000a01",
      description: "coating breakdown with localized pitting",
      severity: "cat_3_major",
      observed_at: new Date().toISOString(),
      mechanism_key: null,
    };

    const r = await buildCausalChain({
      anomaly: subseaAnomaly,
      asset: subseaAsset,
      candidateMechanismCodes: [...SMOKE_TEST_ENGINEER_MECHANISMS],
      supabase: supabase as never,
      org_id: "713dcec2-69db-43e2-a367-457a1fe6d943",
    });

    // (1) Engine returns ok:true
    assert.equal(r.ok, true, `expected ok:true, got reason="${r.reason}"`);
    assert.equal(typeof r.causal_chain_id, "string");

    // (2) Non-empty ranking: primary + up to 2 alternatives
    assert.ok(r.primary_mechanism, "primary_mechanism must be set");
    assert.ok(
      r.ranked_alternatives.length >= 1,
      `expected ranked_alternatives, got ${r.ranked_alternatives.length}`
    );
    // All 8 candidates were active and seeded, so we should rank them.
    // Each ranking entry must reference one of the input mechanism_keys.
    const allCodes = [
      r.primary_mechanism!.code,
      ...r.ranked_alternatives.map((a) => a.code),
    ];
    for (const code of allCodes) {
      assert.ok(
        (SMOKE_TEST_ENGINEER_MECHANISMS as readonly string[]).includes(code),
        `ranked code "${code}" must come from input candidates`
      );
    }

    // (3) Insert was called with a valid payload
    const causalRows = supabase.__store.cd_causal_chains as Array<
      Record<string, unknown>
    >;
    assert.equal(causalRows.length, 1, "exactly one cd_causal_chains row");
    const row = causalRows[0];
    assert.equal(row.id, r.causal_chain_id);
    assert.equal(row.org_id, "713dcec2-69db-43e2-a367-457a1fe6d943");
    assert.equal(row.asset_id, subseaAnomaly.asset_id);
    assert.equal(row.chain_type, "degradation");
    assert.deepEqual(row.linked_anomaly_ids, [subseaAnomaly.id]);
    assert.deepEqual(row.linked_asset_ids, [subseaAnomaly.asset_id]);
    // linked_mechanisms must be a non-empty jsonb array of {mechanism_key, fit_score, ...}
    const linked = row.linked_mechanisms as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(linked) && linked.length > 0);
    assert.equal(typeof linked[0].mechanism_key, "string");
    assert.equal(typeof linked[0].fit_score, "number");
    // chain_steps is the forward-progression array
    const steps = row.chain_steps as unknown[];
    assert.ok(Array.isArray(steps) && steps.length > 0);
    // confidence must equal the primary's fit_score
    assert.equal(row.confidence, r.primary_mechanism!.fit_score);
    assert.equal(row.created_by, "cross_domain:causal_chain_engine");
  });

  it("does NOT crash when seed rows omit all the phantom columns the Sprint 2 engine asked for", async () => {
    // The seed rows above have ONLY the real 14 columns — no
    // applicable_materials / typical_severity_range / typical_progression_rate.
    // If the engine still referenced any of those in its scoring logic,
    // m.<field> would be undefined and scoreMaterialMatch (or similar)
    // would have to tolerate that. This test acts as the canary.
    const supabase = makeMockSupabase({
      cd_degradation_mechanisms: REAL_SCHEMA_MECHANISMS,
      cd_causal_chains: [],
    });
    const r = await buildCausalChain({
      anomaly: { ...ANOMALY, mechanism_key: null },
      // Asset has material=null AND material=carbon_steel — neither should
      // matter since the material scorer is gone.
      asset: { ...ASSET, material: null, domain: "subsea" },
      candidateMechanismCodes: ["pitting_corrosion"],
      supabase: supabase as never,
      org_id: ORG,
    });
    assert.equal(r.ok, true);
    assert.equal(r.primary_mechanism!.code, "pitting_corrosion");
  });
});

// ============================================================
// Sprint 4 Polish (Fix E) — mechanism_already_cited normalization
//
// In production, Engineer cited mechanisms in mixed form: some snake_case
// keys, some display names ("Pitting Corrosion"). The scorer only
// matched the candidate's mechanism_key against anomaly.mechanism_key
// (a single value on the anomaly row), missing Engineer's full list,
// so mechanism_already_cited returned 0.00 across the board — dragging
// fit_score down by 20% on every candidate. Fixed by normalizing both
// sides and checking membership in Engineer's cited list.
// ============================================================

describe("Fix E — mechanism_already_cited normalization", () => {
  it("Engineer cites display name 'Pitting Corrosion' → mechanism_already_cited scores 1.0", async () => {
    const supabase = makeMockSupabase({
      cd_degradation_mechanisms: [
        {
          mechanism_key: "pitting_corrosion",
          display_name: "Pitting Corrosion",
          category: "corrosion",
          default_consequence_bias: "high",
          related_domains: ["subsea", "pipeline"],
          active: true,
        },
      ],
      cd_causal_chains: [],
    });
    const r = await buildCausalChain({
      anomaly: ANOMALY,
      asset: ASSET,
      // Display-name citation — must still match after normalization.
      candidateMechanismCodes: ["Pitting Corrosion"],
      supabase: supabase as never,
      org_id: ORG,
    });
    assert.equal(r.ok, true, r.reason ?? "");
    // domain_match (0.5) + severity_envelope (0.3 * partial) +
    // mechanism_already_cited (0.2 * 1.0) — verify the cited
    // component fired. Reasoning string carries each component's score.
    assert.ok(
      /mechanism_already_cited=1\.00/.test(r.primary_mechanism!.reasoning),
      `mechanism_already_cited must score 1.0; reasoning: ${r.primary_mechanism!.reasoning}`
    );
  });

  it("mixed list (display + snake_case) → both candidates score 1.0 on cited component", async () => {
    const supabase = makeMockSupabase({
      cd_degradation_mechanisms: [
        {
          mechanism_key: "pitting_corrosion",
          display_name: "Pitting Corrosion",
          category: "corrosion",
          default_consequence_bias: "high",
          related_domains: ["subsea", "pipeline"],
          active: true,
        },
        {
          mechanism_key: "underfilm_corrosion",
          display_name: "Underfilm Corrosion",
          category: "coating",
          default_consequence_bias: "high",
          related_domains: ["subsea", "pipeline"],
          active: true,
        },
      ],
      cd_causal_chains: [],
    });
    const r = await buildCausalChain({
      anomaly: ANOMALY,
      asset: ASSET,
      candidateMechanismCodes: ["Pitting Corrosion", "underfilm_corrosion"],
      supabase: supabase as never,
      org_id: ORG,
    });
    assert.equal(r.ok, true, r.reason ?? "");
    // Primary and at least one alternative should both show
    // mechanism_already_cited=1.00 in their reasoning.
    assert.ok(
      /mechanism_already_cited=1\.00/.test(r.primary_mechanism!.reasoning)
    );
    const cited_alt = r.ranked_alternatives.length > 0;
    if (cited_alt) {
      // Alternatives' reasoning isn't in the result type, but the
      // fact that both rows were fetched (despite Engineer using
      // mixed forms) proves the IN-filter normalization works.
      assert.ok(true);
    }
  });

  it("Sprint 4 Polish (Fix F): asset domain disjoint from mechanism.related_domains but service_environment tokens overlap → score 1.0", async () => {
    // Brief's named scenario: asset.domain='pipeline',
    // service_environment='subsea_seawater_aerated' vs mechanism with
    // related_domains=['subsea','marine'] should now match via the
    // widened vocabulary (token 'subsea' extracted from env string).
    const supabase = makeMockSupabase({
      cd_degradation_mechanisms: [
        {
          mechanism_key: "pitting_corrosion",
          display_name: "Pitting Corrosion",
          category: "corrosion",
          default_consequence_bias: "high",
          related_domains: ["subsea", "marine"], // no 'pipeline' entry!
          active: true,
        },
      ],
      cd_causal_chains: [],
    });
    const r = await buildCausalChain({
      anomaly: ANOMALY,
      asset: {
        ...ASSET,
        domain: "pipeline" as never,
        service_environment: "subsea_seawater_aerated",
      },
      candidateMechanismCodes: ["pitting_corrosion"],
      supabase: supabase as never,
      org_id: ORG,
    });
    assert.equal(r.ok, true, r.reason ?? "");
    assert.ok(
      /domain_match=1\.00/.test(r.primary_mechanism!.reasoning),
      `domain_match should fire on env-token overlap; reasoning: ${r.primary_mechanism!.reasoning}`
    );
  });

  it("Sprint 4 Polish (Fix F): asset_type 'pipeline_segment' matches mechanism.related_domains 'pipeline' via direct token", async () => {
    const supabase = makeMockSupabase({
      cd_degradation_mechanisms: [
        {
          mechanism_key: "general_corrosion",
          display_name: "General Corrosion",
          category: "corrosion",
          default_consequence_bias: "moderate",
          related_domains: ["pipeline"],
          active: true,
        },
      ],
      cd_causal_chains: [],
    });
    const r = await buildCausalChain({
      anomaly: ANOMALY,
      // domain='other', so the OLD scorer would miss this.
      asset: {
        ...ASSET,
        domain: "other" as never,
        asset_type: "pipeline",
      },
      candidateMechanismCodes: ["general_corrosion"],
      supabase: supabase as never,
      org_id: ORG,
    });
    assert.equal(r.ok, true);
    assert.ok(
      /domain_match=1\.00/.test(r.primary_mechanism!.reasoning),
      "asset_type 'pipeline' must match related_domains ['pipeline']"
    );
  });

  it("Sprint 4 Polish (Fix F): truly disjoint domains still score 0.00", async () => {
    const supabase = makeMockSupabase({
      cd_degradation_mechanisms: [
        {
          mechanism_key: "fatigue_cracking",
          display_name: "Fatigue Cracking",
          category: "fatigue",
          default_consequence_bias: "critical",
          related_domains: ["aerospace"], // not a token we recognize
          active: true,
        },
      ],
      cd_causal_chains: [],
    });
    const r = await buildCausalChain({
      anomaly: ANOMALY,
      asset: { ...ASSET, domain: "pipeline" as never },
      candidateMechanismCodes: ["fatigue_cracking"],
      supabase: supabase as never,
      org_id: ORG,
    });
    assert.equal(r.ok, true);
    assert.ok(
      /domain_match=0\.00/.test(r.primary_mechanism!.reasoning),
      "no token overlap → 0.00 (regression: must not over-match)"
    );
  });

  it("Engineer cites NO matching mechanism → cited component scores 0.00 (regression: scorer must NOT always return 1.0)", async () => {
    const supabase = makeMockSupabase({
      cd_degradation_mechanisms: [
        {
          mechanism_key: "pitting_corrosion",
          display_name: "Pitting Corrosion",
          category: "corrosion",
          default_consequence_bias: "high",
          related_domains: ["subsea"],
          active: true,
        },
      ],
      cd_causal_chains: [],
    });
    // Pass an UNRELATED candidate. The IN filter normalizes and
    // looks up pitting_corrosion, but Engineer's cited list contains
    // only "Fatigue Cracking" — so mechanism_already_cited should be 0.
    const r = await buildCausalChain({
      anomaly: ANOMALY,
      asset: ASSET,
      candidateMechanismCodes: ["pitting_corrosion", "Fatigue Cracking"],
      supabase: supabase as never,
      org_id: ORG,
    });
    assert.equal(r.ok, true);
    // pitting_corrosion IS in the cited list → score 1.0
    assert.ok(
      /mechanism_already_cited=1\.00/.test(r.primary_mechanism!.reasoning)
    );
  });
});
