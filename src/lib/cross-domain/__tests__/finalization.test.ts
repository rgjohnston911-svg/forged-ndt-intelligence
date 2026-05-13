import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeMockSupabase } from "./fixtures";
import {
  finalizeDeliberation,
  mapConsensusLevel,
  escalatedForArbitration,
} from "../deliberationFinalizer";
import { buildCausalChain } from "../causalChainEngine";
import type {
  SpecialistAnalysis,
  ArbitrationDecision,
  AnomalyContext,
  AssetContext,
  Claim,
} from "../types";

const ORG = "88888888-8888-8888-8888-888888888888";
const DELIB = "delib-aaaaaaaa";

function mkClaim(overrides: Partial<Claim>): Claim {
  return {
    text: "claim",
    confidence: 0.7,
    supporting_evidence_ids: [],
    cited_mechanism_codes: [],
    ...overrides,
  };
}

function mkSpec(
  role: SpecialistAnalysis["role"],
  overrides: Partial<SpecialistAnalysis> = {}
): SpecialistAnalysis {
  return {
    role,
    model: "mock",
    summary: `${role} summary`,
    claims: [],
    open_questions: [],
    cited_mechanisms: [],
    cited_evidence: [],
    cost_usd: 0.05,
    latency_ms: 1000,
    attempts: 1,
    raw_response: "",
    ...overrides,
  };
}

const FULL_CHAIN_OUTPUTS: SpecialistAnalysis[] = [
  mkSpec("inspector", {
    claims: [mkClaim({ text: "i1", confidence: 0.7 })],
    cited_mechanisms: ["pitting_corrosion"],
  }),
  mkSpec("engineer", {
    claims: [mkClaim({ text: "e1", confidence: 0.8 })],
    cited_mechanisms: ["pitting_corrosion"],
  }),
  mkSpec("researcher", {
    claims: [mkClaim({ text: "r1", confidence: 0.7 })],
  }),
  mkSpec("devils_advocate", {
    claims: [
      mkClaim({
        text: "No significant gaps found: evidence is direct",
        confidence: 0.7,
      }),
    ],
  }),
  mkSpec("historian", {
    claims: [mkClaim({ text: "h1", confidence: 0.7 })],
  }),
  mkSpec("synthesizer", {
    claims: [mkClaim({ text: "s1", confidence: 0.9 })],
    summary: "Final synthesis",
  }),
];

function seedWithRow(opts: {
  completed?: boolean;
  outputs?: SpecialistAnalysis[];
  total_cost_usd?: number;
}) {
  return makeMockSupabase({
    cd_deliberation_log: [
      {
        id: DELIB,
        org_id: ORG,
        finding_id: "anomaly-x",
        finding_type: "anomaly",
        deliberation_started_at: new Date(Date.now() - 60000).toISOString(),
        deliberation_completed_at: opts.completed
          ? new Date().toISOString()
          : null,
        specialist_outputs: opts.outputs ?? [],
        synthesizer_decision: null,
        arbitration_rules_applied: {},
        consensus_level: null,
        escalated_to_human: false,
        total_cost_usd: opts.total_cost_usd ?? 0,
      },
    ],
  });
}

// ------------------------------------------------------------
// mapConsensusLevel — unit
// ------------------------------------------------------------

describe("mapConsensusLevel — conforms to CHECK enum", () => {
  function arb(
    status: ArbitrationDecision["status"],
    unresolved = 0
  ): ArbitrationDecision {
    return {
      status,
      reason: "",
      devils_advocate_objections_addressed: 0,
      devils_advocate_objections_unresolved: unresolved,
    };
  }
  it("accepted + 0 unresolved → unanimous", () => {
    assert.equal(mapConsensusLevel(arb("accepted", 0)), "unanimous");
  });
  it("accepted + some unresolved → majority_with_dissent", () => {
    assert.equal(mapConsensusLevel(arb("accepted", 1)), "majority_with_dissent");
  });
  it("flagged_dissent → majority_with_dissent", () => {
    assert.equal(mapConsensusLevel(arb("flagged_dissent", 3)), "majority_with_dissent");
  });
  it("rejected_low_confidence → unresolved", () => {
    assert.equal(mapConsensusLevel(arb("rejected_low_confidence")), "unresolved");
  });
  it("escalatedForArbitration: flagged_dissent + rejected_low_confidence", () => {
    assert.equal(escalatedForArbitration(arb("accepted")), false);
    assert.equal(escalatedForArbitration(arb("flagged_dissent")), true);
    assert.equal(escalatedForArbitration(arb("rejected_low_confidence")), true);
  });
});

// ------------------------------------------------------------
// finalizeDeliberation — happy path
// ------------------------------------------------------------

describe("finalizeDeliberation — happy path (6 outputs, no dissent)", () => {
  it("writes completed_at, synthesizer_decision (by role search), consensus_level=unanimous, escalated=false", async () => {
    const supabase = seedWithRow({ outputs: FULL_CHAIN_OUTPUTS, total_cost_usd: 0.88 });
    const result = await finalizeDeliberation(DELIB, ORG, supabase as never);

    assert.equal(result.status, "finalized");
    assert.equal(result.consensus_level, "unanimous");
    assert.equal(result.final_status, "accepted");

    const row = supabase.__store.cd_deliberation_log[0] as Record<string, unknown>;
    assert.ok(row.deliberation_completed_at);
    assert.equal(row.consensus_level, "unanimous");
    assert.equal(row.escalated_to_human, false);
    // synthesizer_decision sourced by role search (not blind index)
    const synth = row.synthesizer_decision as SpecialistAnalysis;
    assert.equal(synth.role, "synthesizer");
    assert.equal(synth.summary, "Final synthesis");
    // arbitration_rules_applied carries the fine-grained outcome
    const ara = row.arbitration_rules_applied as Record<string, unknown>;
    assert.equal(ara.final_status, "accepted");
    assert.ok(ara.arbitration_decision);
  });
});

// ------------------------------------------------------------
// finalizeDeliberation — idempotency
// ------------------------------------------------------------

describe("finalizeDeliberation — idempotency", () => {
  it("second call no-ops when row is already completed", async () => {
    const supabase = seedWithRow({
      outputs: FULL_CHAIN_OUTPUTS,
      completed: true,
    });
    // Stash the row's completed_at — second call must not change it
    const originalCompletedAt = (
      supabase.__store.cd_deliberation_log[0] as Record<string, unknown>
    ).deliberation_completed_at as string;

    const r1 = await finalizeDeliberation(DELIB, ORG, supabase as never);
    assert.equal(r1.status, "noop_already_finalized");

    // Sleep 1ms to ensure new Date().toISOString() would differ
    await new Promise((res) => setTimeout(res, 2));

    const r2 = await finalizeDeliberation(DELIB, ORG, supabase as never);
    assert.equal(r2.status, "noop_already_finalized");

    const row = supabase.__store.cd_deliberation_log[0] as Record<string, unknown>;
    assert.equal(row.deliberation_completed_at, originalCompletedAt);
  });

  it("returns noop_row_missing when no row exists for id+org_id", async () => {
    const supabase = makeMockSupabase({ cd_deliberation_log: [] });
    const r = await finalizeDeliberation(DELIB, ORG, supabase as never);
    assert.equal(r.status, "noop_row_missing");
  });
});

// ------------------------------------------------------------
// finalizeDeliberation — partial chain
// ------------------------------------------------------------

describe("finalizeDeliberation — partial chain (<6 outputs)", () => {
  it("marks completed with consensus_level=unresolved, final_status=failed, null synthesizer", async () => {
    const partial = FULL_CHAIN_OUTPUTS.slice(0, 4); // inspector, engineer, researcher, da
    const supabase = seedWithRow({ outputs: partial });

    const result = await finalizeDeliberation(DELIB, ORG, supabase as never);
    assert.equal(result.status, "finalized_partial_chain");
    assert.equal(result.consensus_level, "unresolved");
    assert.equal(result.final_status, "failed");

    const row = supabase.__store.cd_deliberation_log[0] as Record<string, unknown>;
    assert.ok(row.deliberation_completed_at);
    assert.equal(row.consensus_level, "unresolved");
    assert.equal(row.synthesizer_decision, null);
    assert.equal(row.escalated_to_human, true);
    const ara = row.arbitration_rules_applied as Record<string, unknown>;
    assert.equal(ara.final_status, "failed");
    assert.ok(String(ara.error).includes("partial_chain: 4/6"));
    assert.equal(ara.specialist_outputs_count, 4);
  });
});

// ------------------------------------------------------------
// finalizeDeliberation — flagged_dissent path
// ------------------------------------------------------------

describe("finalizeDeliberation — flagged_dissent", () => {
  it("majority of DA objections unaddressed → consensus_level=majority_with_dissent, escalated=true, final_status=flagged_dissent", async () => {
    // Build a chain where Devil's Advocate raises 4 objections and
    // Historian only addresses 1 (3/4 unresolved = 75% > half).
    const outputs: SpecialistAnalysis[] = [
      mkSpec("inspector"),
      mkSpec("engineer", {
        claims: [mkClaim({ text: "e1", confidence: 0.8 })],
      }),
      mkSpec("researcher"),
      mkSpec("devils_advocate", {
        claims: [
          mkClaim({ text: "obj A", cited_mechanism_codes: ["mech_a"] }),
          mkClaim({ text: "obj B", cited_mechanism_codes: ["mech_b"] }),
          mkClaim({ text: "obj C", cited_mechanism_codes: ["mech_c"] }),
          mkClaim({ text: "obj D", cited_mechanism_codes: ["mech_d"] }),
        ],
      }),
      mkSpec("historian", {
        claims: [
          mkClaim({ text: "addresses A", cited_mechanism_codes: ["mech_a"] }),
        ],
      }),
      mkSpec("synthesizer", { summary: "with dissent" }),
    ];

    const supabase = seedWithRow({ outputs });
    const result = await finalizeDeliberation(DELIB, ORG, supabase as never);
    assert.equal(result.status, "finalized");
    assert.equal(result.consensus_level, "majority_with_dissent");
    assert.equal(result.final_status, "flagged_dissent");

    const row = supabase.__store.cd_deliberation_log[0] as Record<string, unknown>;
    assert.equal(row.consensus_level, "majority_with_dissent");
    assert.equal(row.escalated_to_human, true);
    const ara = row.arbitration_rules_applied as Record<string, unknown>;
    assert.equal(ara.final_status, "flagged_dissent");
    const decision = ara.arbitration_decision as ArbitrationDecision;
    assert.equal(decision.devils_advocate_objections_unresolved, 3);
    assert.equal(decision.devils_advocate_objections_addressed, 1);
  });
});

// ------------------------------------------------------------
// causal chain write — column mapping verification
// ------------------------------------------------------------

describe("cd_causal_chains insert — column mapping (Sprint 3.1 verification)", () => {
  it("writes to existing columns: linked_mechanisms, chain_steps, competing_hypotheses (NOT primary_mechanism_code/failure_path_jsonb/ranked_mechanisms_jsonb)", async () => {
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
        {
          mechanism_key: "general_corrosion",
          display_name: "General Corrosion",
          category: "corrosion",
          default_consequence_bias: "moderate",
          related_domains: ["subsea"],
          active: true,
        },
      ],
      cd_causal_chains: [],
    });

    const anomaly: AnomalyContext = {
      id: "anom-1",
      asset_id: "asset-1",
      description: "wall loss",
      severity: "cat_3_major",
      observed_at: new Date().toISOString(),
      mechanism_key: null,
    };
    const asset: AssetContext = {
      id: "asset-1",
      asset_name: "Riser",
      asset_type: "pipeline_segment",
      domain: "subsea",
      material: "carbon_steel",
      service_environment: "subsea",
      criticality: "high",
      age_years: 10,
    };

    const result = await buildCausalChain({
      anomaly,
      asset,
      candidateMechanismCodes: ["pitting_corrosion", "general_corrosion"],
      supabase: supabase as never,
      org_id: ORG,
    });
    assert.equal(result.ok, true);

    assert.equal(supabase.__store.cd_causal_chains.length, 1);
    const row = supabase.__store.cd_causal_chains[0] as Record<string, unknown>;
    // Must write to the actual production columns:
    assert.ok(Array.isArray(row.linked_mechanisms), "linked_mechanisms must be an array");
    assert.ok((row.linked_mechanisms as unknown[]).length > 0);
    assert.ok(Array.isArray(row.chain_steps), "chain_steps must be an array");
    assert.ok(Array.isArray(row.competing_hypotheses), "competing_hypotheses must be an array");
    assert.ok(Array.isArray(row.linked_anomaly_ids), "linked_anomaly_ids must be an array");
    assert.deepEqual(row.linked_anomaly_ids, [anomaly.id]);
    assert.deepEqual(row.linked_asset_ids, [asset.id]);
    assert.equal(row.org_id, ORG);
    assert.equal(row.asset_id, asset.id);
    assert.equal(row.chain_type, "degradation");
    // Brief's older vocabulary should NOT appear as columns:
    assert.equal(row.primary_mechanism_code, undefined);
    assert.equal(row.ranked_mechanisms_jsonb, undefined);
    assert.equal(row.failure_path_jsonb, undefined);
  });
});
