import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { runDeliberation, arbitrate } from "../orchestrator";
import { makeMockSupabase } from "./fixtures";
import type {
  AnomalyContext,
  AssetContext,
  DeliberationInput,
  DegradationMechanismRef,
  EvidenceItem,
  SpecialistAnalysis,
} from "../types";

const ORG = "55555555-5555-5555-5555-555555555555";

const ASSET: AssetContext = {
  id: "asset-7",
  asset_name: "Riser 14B",
  asset_type: "pipeline_segment",
  domain: "subsea",
  material: "carbon_steel",
  service_environment: "subsea",
  criticality: "high",
  age_years: 12,
};

const ANOMALY: AnomalyContext = {
  id: "anomaly-99",
  asset_id: "asset-7",
  description: "Localized wall loss on external surface, near weld toe",
  severity: "cat_3_major",
  observed_at: new Date().toISOString(),
  mechanism_key: null,
};

const EVIDENCE: EvidenceItem[] = [
  {
    id: "ev-1",
    evidence_type: "photo",
    source: "observed",
    reliability_weight: 0.9,
    captured_at: new Date().toISOString(),
    raw_text: null,
    structured_jsonb: null,
    confidence: 0.9,
  },
];

const MECHS: DegradationMechanismRef[] = [
  { mechanism_key: "pitting_corrosion", display_name: "Pitting Corrosion", category: "corrosion" },
  { mechanism_key: "fatigue_cracking", display_name: "Fatigue Cracking", category: "fatigue" },
];

const SEEDED_MECH_ROWS = [
  {
    mechanism_key: "pitting_corrosion",
    display_name: "Pitting Corrosion",
    category: "corrosion",
    default_consequence_bias: "high",
    related_domains: ["subsea"],
    active: true,
  },
  {
    mechanism_key: "fatigue_cracking",
    display_name: "Fatigue Cracking",
    category: "fatigue",
    default_consequence_bias: "critical",
    related_domains: ["structural"],
    active: true,
  },
];

function input(overrides: Partial<DeliberationInput> = {}): DeliberationInput {
  return {
    anomaly: ANOMALY,
    asset: ASSET,
    evidence: EVIDENCE,
    priorAnalyses: [],
    mechanismVocabulary: MECHS,
    ...overrides,
  };
}

// ------------------------------------------------------------
// Mock fetch — scripted queue
// ------------------------------------------------------------

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];
type ResponseFactory = () => Response;

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_ANTHROPIC = process.env.ANTHROPIC_API_KEY;
const ORIGINAL_OPENAI = process.env.OPENAI_API_KEY;
const ORIGINAL_RETRY_BASE = process.env.CROSS_DOMAIN_RETRY_BASE_MS;

let responseQueue: ResponseFactory[] = [];

function specialistJson(opts: {
  summary?: string;
  claims?: Array<{
    text: string;
    confidence: number;
    supporting_evidence_ids?: string[];
    cited_mechanism_codes?: string[];
  }>;
  open_questions?: string[];
  cited_mechanisms?: string[];
  cited_evidence?: string[];
}): string {
  return JSON.stringify({
    summary: opts.summary ?? "summary",
    claims: (opts.claims ?? []).map((c) => ({
      supporting_evidence_ids: [],
      cited_mechanism_codes: [],
      ...c,
    })),
    open_questions: opts.open_questions ?? [],
    cited_mechanisms: opts.cited_mechanisms ?? [],
    cited_evidence: opts.cited_evidence ?? [],
  });
}

function anthropicOk(
  bodyJson: string,
  opts?: { input_tokens?: number; output_tokens?: number; with_thinking?: boolean }
): Response {
  const content: Array<{ type: string; text?: string; thinking?: string }> = [];
  if (opts?.with_thinking) content.push({ type: "thinking", thinking: "..." });
  content.push({ type: "text", text: bodyJson });
  return new Response(
    JSON.stringify({
      id: "msg_" + Math.random().toString(36).slice(2, 10),
      content,
      usage: {
        input_tokens: opts?.input_tokens ?? 100,
        output_tokens: opts?.output_tokens ?? 100,
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function openaiOk(
  bodyJson: string,
  opts?: { input_tokens?: number; output_tokens?: number }
): Response {
  return new Response(
    JSON.stringify({
      id: "resp_" + Math.random().toString(36).slice(2, 10),
      output_text: bodyJson,
      usage: {
        input_tokens: opts?.input_tokens ?? 100,
        output_tokens: opts?.output_tokens ?? 100,
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function anthropic529(): Response {
  return new Response(JSON.stringify({ error: "overloaded" }), { status: 529 });
}

function installFetchMock() {
  responseQueue = [];
  process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
  process.env.OPENAI_API_KEY = "test-openai-key";
  process.env.CROSS_DOMAIN_RETRY_BASE_MS = "1";
  globalThis.fetch = (async (_input: FetchInput, _init?: FetchInit) => {
    if (responseQueue.length === 0) {
      return new Response(JSON.stringify({ error: "no_mock_available" }), {
        status: 500,
      });
    }
    return responseQueue.shift()!();
  }) as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = ORIGINAL_FETCH;
  if (ORIGINAL_ANTHROPIC === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = ORIGINAL_ANTHROPIC;
  if (ORIGINAL_OPENAI === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = ORIGINAL_OPENAI;
  if (ORIGINAL_RETRY_BASE === undefined) delete process.env.CROSS_DOMAIN_RETRY_BASE_MS;
  else process.env.CROSS_DOMAIN_RETRY_BASE_MS = ORIGINAL_RETRY_BASE;
}

// ------------------------------------------------------------
// arbitrate() — unit tests, no orchestrator
// ------------------------------------------------------------

describe("arbitrate — deterministic rules", () => {
  function mkAnalysis(
    role: SpecialistAnalysis["role"],
    overrides: Partial<SpecialistAnalysis> = {}
  ): SpecialistAnalysis {
    return {
      role,
      model: "mock",
      summary: "",
      claims: [],
      open_questions: [],
      cited_mechanisms: [],
      cited_evidence: [],
      cost_usd: 0,
      latency_ms: 0,
      attempts: 1,
      raw_response: "",
      ...overrides,
    };
  }

  it("returns accepted with reason='no objections' when DA raised none", () => {
    const r = arbitrate([
      mkAnalysis("engineer", {
        claims: [
          { text: "x", confidence: 0.8, supporting_evidence_ids: [], cited_mechanism_codes: [] },
        ],
      }),
      mkAnalysis("devils_advocate"),
      mkAnalysis("historian"),
    ]);
    assert.equal(r.status, "accepted");
    assert.equal(r.devils_advocate_objections_unresolved, 0);
  });

  it("returns accepted at exactly 50% unresolved (2/4 — not strictly > half)", () => {
    const objections = [
      { text: "objA", confidence: 0.7, supporting_evidence_ids: [], cited_mechanism_codes: ["mech_a"] },
      { text: "objB", confidence: 0.7, supporting_evidence_ids: [], cited_mechanism_codes: ["mech_b"] },
      { text: "objC", confidence: 0.7, supporting_evidence_ids: [], cited_mechanism_codes: ["mech_c"] },
      { text: "objD", confidence: 0.7, supporting_evidence_ids: [], cited_mechanism_codes: ["mech_d"] },
    ];
    const r = arbitrate([
      mkAnalysis("engineer", {
        claims: [
          { text: "e", confidence: 0.8, supporting_evidence_ids: [], cited_mechanism_codes: [] },
        ],
      }),
      mkAnalysis("devils_advocate", { claims: objections }),
      mkAnalysis("historian", {
        claims: [
          { text: "addresses A", confidence: 0.7, supporting_evidence_ids: [], cited_mechanism_codes: ["mech_a"] },
          { text: "addresses B", confidence: 0.7, supporting_evidence_ids: [], cited_mechanism_codes: ["mech_b"] },
        ],
      }),
    ]);
    assert.equal(r.status, "accepted");
    assert.equal(r.devils_advocate_objections_addressed, 2);
    assert.equal(r.devils_advocate_objections_unresolved, 2);
  });

  it("returns flagged_dissent when unresolved > 50% (3/4 = 75%)", () => {
    const objections = [
      { text: "objA", confidence: 0.7, supporting_evidence_ids: [], cited_mechanism_codes: ["mech_a"] },
      { text: "objB", confidence: 0.7, supporting_evidence_ids: [], cited_mechanism_codes: ["mech_b"] },
      { text: "objC", confidence: 0.7, supporting_evidence_ids: [], cited_mechanism_codes: ["mech_c"] },
      { text: "objD", confidence: 0.7, supporting_evidence_ids: [], cited_mechanism_codes: ["mech_d"] },
    ];
    const r = arbitrate([
      mkAnalysis("engineer", {
        claims: [
          { text: "e", confidence: 0.8, supporting_evidence_ids: [], cited_mechanism_codes: [] },
        ],
      }),
      mkAnalysis("devils_advocate", { claims: objections }),
      mkAnalysis("historian", {
        claims: [
          { text: "addresses A", confidence: 0.7, supporting_evidence_ids: [], cited_mechanism_codes: ["mech_a"] },
        ],
      }),
    ]);
    assert.equal(r.status, "flagged_dissent");
    assert.equal(r.devils_advocate_objections_addressed, 1);
    assert.equal(r.devils_advocate_objections_unresolved, 3);
  });

  it("returns rejected_low_confidence when Engineer's avg claim confidence < 0.6", () => {
    const r = arbitrate([
      mkAnalysis("engineer", {
        claims: [
          { text: "low1", confidence: 0.4, supporting_evidence_ids: [], cited_mechanism_codes: [] },
          { text: "low2", confidence: 0.5, supporting_evidence_ids: [], cited_mechanism_codes: [] },
        ],
      }),
      mkAnalysis("devils_advocate"),
      mkAnalysis("historian"),
    ]);
    assert.equal(r.status, "rejected_low_confidence");
  });

  it("ignores 'no significant gaps found' claim as a non-objection", () => {
    const r = arbitrate([
      mkAnalysis("engineer", {
        claims: [
          { text: "e", confidence: 0.8, supporting_evidence_ids: [], cited_mechanism_codes: [] },
        ],
      }),
      mkAnalysis("devils_advocate", {
        claims: [
          {
            text: "No significant gaps found: analysis is robust",
            confidence: 0.7,
            supporting_evidence_ids: [],
            cited_mechanism_codes: [],
          },
        ],
      }),
      mkAnalysis("historian"),
    ]);
    assert.equal(r.status, "accepted");
    assert.equal(r.devils_advocate_objections_unresolved, 0);
  });
});

// ------------------------------------------------------------
// runDeliberation — end-to-end with mocked fetch
// ------------------------------------------------------------

describe("runDeliberation — happy path", () => {
  beforeEach(installFetchMock);
  afterEach(restoreFetch);

  it("all 6 specialists succeed, arbitration=accepted, log finalized, causal chain persisted", async () => {
    const supabase = makeMockSupabase({
      cd_degradation_mechanisms: SEEDED_MECH_ROWS,
      org_feature_flags: [
        {
          org_id: ORG,
          feature_flags: {
            cross_domain: { daily_cap_usd: 100, per_deliberation_cap_usd: 50 },
          },
        },
      ],
      cd_deliberation_log: [],
      cd_causal_chains: [],
      ai_cost_log: [],
    });

    responseQueue = [
      // Inspector
      () =>
        anthropicOk(
          specialistJson({
            summary: "Inspector — visible pitting near weld",
            claims: [
              {
                text: "Photo evidence shows pitting",
                confidence: 0.7,
                cited_mechanism_codes: ["pitting_corrosion"],
              },
            ],
            cited_mechanisms: ["pitting_corrosion"],
            cited_evidence: ["ev-1"],
          })
        ),
      // Engineer (with thinking)
      () =>
        anthropicOk(
          specialistJson({
            summary: "Engineer — pitting corrosion most likely",
            claims: [
              {
                text: "Pitting corrosion fits environment and material",
                confidence: 0.85,
                cited_mechanism_codes: ["pitting_corrosion"],
              },
            ],
            cited_mechanisms: ["pitting_corrosion"],
          }),
          { with_thinking: true }
        ),
      // Researcher
      () =>
        anthropicOk(
          specialistJson({
            summary: "Researcher — common in subsea CS",
            claims: [{ text: "Industry literature supports pitting", confidence: 0.65 }],
          })
        ),
      // Devil's Advocate (gpt-4o via Responses API)
      () =>
        openaiOk(
          specialistJson({
            summary: "No significant gaps found: evidence is direct",
            claims: [
              {
                text: "No significant gaps found: analysis is well-supported",
                confidence: 0.7,
              },
            ],
          })
        ),
      // Historian
      () =>
        anthropicOk(
          specialistJson({
            summary: "Historian — similar 2024 case",
            claims: [{ text: "Analogous case on similar riser", confidence: 0.7 }],
          })
        ),
      // Synthesizer (with thinking)
      () =>
        anthropicOk(
          specialistJson({
            summary: "Synthesizer — final: pitting corrosion confirmed",
            claims: [
              {
                text: "Primary mechanism is pitting corrosion",
                confidence: 0.88,
                cited_mechanism_codes: ["pitting_corrosion"],
              },
            ],
            cited_mechanisms: ["pitting_corrosion"],
          }),
          { with_thinking: true }
        ),
    ];

    const result = await runDeliberation(input(), {
      org_id: ORG,
      deliberation_id: "delib-happy",
      supabase: supabase as never,
    });

    assert.equal(result.ok, true, result.aborted_reason ?? "");
    assert.equal(result.arbitration.status, "accepted");
    assert.equal(result.per_specialist.length, 6);
    assert.ok(result.synthesizer_output);
    assert.equal(result.synthesizer_output!.role, "synthesizer");
    assert.ok(result.causal_chain);
    assert.equal(result.causal_chain!.ok, true);
    assert.equal(result.causal_chain!.primary_mechanism!.code, "pitting_corrosion");

    // Persistence
    const log = supabase.__store.cd_deliberation_log;
    assert.equal(log.length, 1);
    const row = log[0] as Record<string, unknown>;
    assert.equal((row.specialist_outputs as unknown[]).length, 6);
    // Sprint 3.1: consensus_level conforms to the CHECK enum
    // (unanimous|majority_with_dissent|split|unresolved). Fine-grained
    // status lives in arbitration_rules_applied.final_status.
    assert.equal(row.consensus_level, "unanimous");
    const ara = row.arbitration_rules_applied as Record<string, unknown>;
    assert.equal(ara.final_status, "accepted");
    assert.equal(row.escalated_to_human, false);
    assert.ok(row.deliberation_completed_at);
    assert.ok(row.synthesizer_decision);

    // Causal chain persisted
    assert.equal(supabase.__store.cd_causal_chains.length, 1);

    // ai_cost_log: 6 specialist rows + 1 deliberation_total audit row
    const costRows = supabase.__store.ai_cost_log as Array<Record<string, unknown>>;
    const codeNames = costRows.map((r) => r.code_name);
    assert.equal(
      codeNames.filter((n) => String(n).startsWith("cross_domain:")).length,
      7
    );
    assert.ok(codeNames.includes("cross_domain:deliberation_total"));
  });
});

describe("runDeliberation — arbitration scenarios via orchestrator", () => {
  beforeEach(installFetchMock);
  afterEach(restoreFetch);

  function seedSupabase() {
    return makeMockSupabase({
      cd_degradation_mechanisms: SEEDED_MECH_ROWS,
      org_feature_flags: [
        {
          org_id: ORG,
          feature_flags: {
            cross_domain: { daily_cap_usd: 100, per_deliberation_cap_usd: 50 },
          },
        },
      ],
      cd_deliberation_log: [],
      cd_causal_chains: [],
      ai_cost_log: [],
    });
  }

  function queueWithDaAndHistorian(opts: {
    daClaims: Array<{ text: string; confidence: number; cited_mechanism_codes: string[] }>;
    historianClaims: Array<{ text: string; confidence: number; cited_mechanism_codes: string[] }>;
  }) {
    responseQueue = [
      // Inspector
      () =>
        anthropicOk(
          specialistJson({
            summary: "I",
            claims: [{ text: "x", confidence: 0.7, cited_mechanism_codes: ["pitting_corrosion"] }],
            cited_mechanisms: ["pitting_corrosion"],
          })
        ),
      // Engineer
      () =>
        anthropicOk(
          specialistJson({
            summary: "E",
            claims: [
              { text: "Pitting probable", confidence: 0.8, cited_mechanism_codes: ["pitting_corrosion"] },
            ],
            cited_mechanisms: ["pitting_corrosion"],
          }),
          { with_thinking: true }
        ),
      // Researcher
      () => anthropicOk(specialistJson({ summary: "R", claims: [] })),
      // Devil's Advocate
      () => openaiOk(specialistJson({ summary: "DA", claims: opts.daClaims })),
      // Historian
      () =>
        anthropicOk(specialistJson({ summary: "H", claims: opts.historianClaims })),
      // Synthesizer
      () =>
        anthropicOk(
          specialistJson({
            summary: "S",
            claims: [{ text: "final", confidence: 0.8 }],
          }),
          { with_thinking: true }
        ),
    ];
  }

  it("4 objections, 2 addressed by Historian → accepted (50% not > half)", async () => {
    const supabase = seedSupabase();
    queueWithDaAndHistorian({
      daClaims: [
        { text: "objection alpha", confidence: 0.7, cited_mechanism_codes: ["mech_a"] },
        { text: "objection beta", confidence: 0.7, cited_mechanism_codes: ["mech_b"] },
        { text: "objection gamma", confidence: 0.7, cited_mechanism_codes: ["mech_c"] },
        { text: "objection delta", confidence: 0.7, cited_mechanism_codes: ["mech_d"] },
      ],
      historianClaims: [
        { text: "addresses A", confidence: 0.7, cited_mechanism_codes: ["mech_a"] },
        { text: "addresses B", confidence: 0.7, cited_mechanism_codes: ["mech_b"] },
      ],
    });
    const r = await runDeliberation(input(), {
      org_id: ORG,
      deliberation_id: "delib-50pct",
      supabase: supabase as never,
    });
    assert.equal(r.ok, true);
    assert.equal(r.arbitration.status, "accepted");
    assert.equal(r.arbitration.devils_advocate_objections_addressed, 2);
    assert.equal(r.arbitration.devils_advocate_objections_unresolved, 2);
  });

  it("4 objections, 1 addressed → flagged_dissent (75% > half)", async () => {
    const supabase = seedSupabase();
    queueWithDaAndHistorian({
      daClaims: [
        { text: "objection alpha", confidence: 0.7, cited_mechanism_codes: ["mech_a"] },
        { text: "objection beta", confidence: 0.7, cited_mechanism_codes: ["mech_b"] },
        { text: "objection gamma", confidence: 0.7, cited_mechanism_codes: ["mech_c"] },
        { text: "objection delta", confidence: 0.7, cited_mechanism_codes: ["mech_d"] },
      ],
      historianClaims: [
        { text: "addresses A", confidence: 0.7, cited_mechanism_codes: ["mech_a"] },
      ],
    });
    const r = await runDeliberation(input(), {
      org_id: ORG,
      deliberation_id: "delib-75pct",
      supabase: supabase as never,
    });
    assert.equal(r.ok, true);
    assert.equal(r.arbitration.status, "flagged_dissent");
    assert.equal(r.arbitration.devils_advocate_objections_unresolved, 3);
    // Sprint 3.1: consensus_level conforms to CHECK enum;
    // flagged_dissent → majority_with_dissent. Fine-grained outcome
    // is in arbitration_rules_applied.final_status.
    const row = supabase.__store.cd_deliberation_log[0] as Record<string, unknown>;
    assert.equal(row.consensus_level, "majority_with_dissent");
    const ara = row.arbitration_rules_applied as Record<string, unknown>;
    assert.equal(ara.final_status, "flagged_dissent");
    assert.equal(row.escalated_to_human, true);
  });
});

// ============================================================
// Sprint 3.2 — causal chain wiring behavior
// ============================================================

describe("runDeliberation — causal chain wiring (Sprint 3.2)", () => {
  beforeEach(installFetchMock);
  afterEach(restoreFetch);

  function seedSupabase() {
    return makeMockSupabase({
      cd_degradation_mechanisms: SEEDED_MECH_ROWS,
      org_feature_flags: [
        {
          org_id: ORG,
          feature_flags: {
            cross_domain: { daily_cap_usd: 100, per_deliberation_cap_usd: 50 },
          },
        },
      ],
      cd_deliberation_log: [],
      cd_causal_chains: [],
      ai_cost_log: [],
    });
  }

  function queueWithEngineerMechanisms(mechanisms: string[]) {
    responseQueue = [
      // Inspector
      () =>
        anthropicOk(
          specialistJson({
            summary: "I",
            claims: [{ text: "x", confidence: 0.7 }],
          })
        ),
      // Engineer — cited_mechanisms is the variable under test
      () =>
        anthropicOk(
          specialistJson({
            summary: "E",
            claims: [{ text: "e1", confidence: 0.8 }],
            cited_mechanisms: mechanisms,
          }),
          { with_thinking: true }
        ),
      // Researcher
      () => anthropicOk(specialistJson({ summary: "R", claims: [] })),
      // Devil's Advocate
      () =>
        openaiOk(
          specialistJson({
            summary: "DA",
            claims: [{ text: "No significant gaps found: ok", confidence: 0.6 }],
          })
        ),
      // Historian
      () => anthropicOk(specialistJson({ summary: "H", claims: [] })),
      // Synthesizer
      () =>
        anthropicOk(
          specialistJson({
            summary: "S",
            claims: [{ text: "final", confidence: 0.8 }],
          }),
          { with_thinking: true }
        ),
    ];
  }

  it("engineer cites mechanisms → buildCausalChain runs → cd_causal_chains row written", async () => {
    const supabase = seedSupabase();
    queueWithEngineerMechanisms(["pitting_corrosion"]);

    const r = await runDeliberation(input(), {
      org_id: ORG,
      deliberation_id: "delib-cc-ok",
      supabase: supabase as never,
    });
    assert.equal(r.ok, true);
    assert.ok(r.causal_chain);
    assert.equal(r.causal_chain!.ok, true);
    assert.equal(supabase.__store.cd_causal_chains.length, 1);

    // No causal_chain_error in the finalized row
    const row = supabase.__store.cd_deliberation_log[0] as Record<string, unknown>;
    const ara = row.arbitration_rules_applied as Record<string, unknown>;
    assert.equal(ara.causal_chain_error, undefined);
  });

  it("engineer cites ZERO mechanisms → buildCausalChain NOT invoked, deliberation still completes, causal_chain_error='engineer_cited_no_mechanisms'", async () => {
    const supabase = seedSupabase();
    queueWithEngineerMechanisms([]); // empty

    const r = await runDeliberation(input(), {
      org_id: ORG,
      deliberation_id: "delib-cc-empty",
      supabase: supabase as never,
    });
    assert.equal(r.ok, true, "deliberation must complete even without mechanisms");
    // No causal chain row written
    assert.equal(supabase.__store.cd_causal_chains.length, 0);
    // Error surfaced in arbitration_rules_applied
    const row = supabase.__store.cd_deliberation_log[0] as Record<string, unknown>;
    const ara = row.arbitration_rules_applied as Record<string, unknown>;
    assert.equal(ara.causal_chain_error, "engineer_cited_no_mechanisms");
  });

  it("buildCausalChain throws → deliberation still completes, causal_chain_error captures the throw", async () => {
    const supabase = seedSupabase();
    queueWithEngineerMechanisms(["pitting_corrosion"]);
    // Force the causal chain engine to throw by sabotaging the mechanism lookup.
    // Replace cd_degradation_mechanisms entirely with a value that .filter()/.find()
    // can't iterate over, which will cause the engine to throw.
    (supabase.__store as Record<string, unknown>).cd_degradation_mechanisms =
      null as unknown as Record<string, unknown>[];

    const r = await runDeliberation(input(), {
      org_id: ORG,
      deliberation_id: "delib-cc-throws",
      supabase: supabase as never,
    });
    // Deliberation completes regardless of causal chain failure
    assert.equal(r.ok, true);
    assert.equal(r.per_specialist.length, 6);
    // No row written
    assert.equal(
      (supabase.__store.cd_causal_chains as unknown[] | undefined)?.length ?? 0,
      0
    );
    // Error captured
    const row = supabase.__store.cd_deliberation_log[0] as Record<string, unknown>;
    const ara = row.arbitration_rules_applied as Record<string, unknown>;
    const err = String(ara.causal_chain_error ?? "");
    assert.ok(
      err.startsWith("causal_chain_threw:") || err.startsWith("causal_chain_engine:"),
      `expected causal_chain_error to be threw/engine path, got: "${err}"`
    );
  });
});

describe("runDeliberation — failure modes", () => {
  beforeEach(installFetchMock);
  afterEach(restoreFetch);

  it("Engineer fails after retries (4× 529) → aborted with engineer_failed, no causal chain", async () => {
    const supabase = makeMockSupabase({
      cd_degradation_mechanisms: SEEDED_MECH_ROWS,
      org_feature_flags: [
        {
          org_id: ORG,
          feature_flags: {
            cross_domain: { daily_cap_usd: 100, per_deliberation_cap_usd: 50 },
          },
        },
      ],
      cd_deliberation_log: [],
      cd_causal_chains: [],
      ai_cost_log: [],
    });

    responseQueue = [
      // Inspector succeeds
      () =>
        anthropicOk(
          specialistJson({
            summary: "I",
            claims: [{ text: "x", confidence: 0.7 }],
          })
        ),
      // Engineer: 4 consecutive 529s (initial + 3 retries)
      anthropic529,
      anthropic529,
      anthropic529,
      anthropic529,
    ];

    const r = await runDeliberation(input(), {
      org_id: ORG,
      deliberation_id: "delib-engineer-fail",
      supabase: supabase as never,
    });
    assert.equal(r.ok, false);
    assert.equal(r.aborted_reason, "engineer_failed");
    assert.equal(r.causal_chain, null);
    // Per-specialist has Inspector + failed Engineer placeholder
    assert.equal(r.per_specialist.length, 2);
    assert.equal(r.per_specialist[0].role, "inspector");
    assert.equal(r.per_specialist[1].role, "engineer");
    // Engineer placeholder analysis has empty claims
    assert.equal(r.per_specialist[1].claims.length, 0);
    // No causal chain row persisted
    assert.equal(supabase.__store.cd_causal_chains.length, 0);
  });

  it("Per-deliberation cap exceeded after Inspector → aborted with per_deliberation_cap_exceeded", async () => {
    const supabase = makeMockSupabase({
      cd_degradation_mechanisms: SEEDED_MECH_ROWS,
      org_feature_flags: [
        {
          org_id: ORG,
          feature_flags: {
            cross_domain: {
              daily_cap_usd: 100,
              per_deliberation_cap_usd: 0.001, // ridiculously low
            },
          },
        },
      ],
      cd_deliberation_log: [],
      cd_causal_chains: [],
      ai_cost_log: [],
    });

    responseQueue = [
      // Inspector returns enough tokens to blow past $0.001
      () =>
        anthropicOk(
          specialistJson({
            summary: "I",
            claims: [{ text: "x", confidence: 0.7 }],
          }),
          { input_tokens: 100, output_tokens: 100 }
        ),
      // Subsequent mocks shouldn't be consumed — keep them as a safety
      () =>
        anthropicOk(
          specialistJson({ summary: "should not be reached", claims: [] })
        ),
    ];

    const r = await runDeliberation(input(), {
      org_id: ORG,
      deliberation_id: "delib-cap",
      supabase: supabase as never,
    });
    assert.equal(r.ok, false);
    assert.equal(r.aborted_reason, "per_deliberation_cap_exceeded");
    assert.equal(r.per_specialist.length, 1);
    assert.equal(r.per_specialist[0].role, "inspector");
  });

  it("Org daily cap pre-check fails → aborted before any specialist runs", async () => {
    const supabase = makeMockSupabase({
      cd_degradation_mechanisms: SEEDED_MECH_ROWS,
      org_feature_flags: [
        {
          org_id: ORG,
          feature_flags: {
            cross_domain: { daily_cap_usd: 10, per_deliberation_cap_usd: 5 },
          },
        },
      ],
      ai_cost_log: [
        // $8 spent in last hour → 8 + 5 = 13 > 10
        {
          org_id: ORG,
          code_name: "cross_domain:engineer",
          cost_usd: 8,
          created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        },
      ],
      cd_deliberation_log: [],
      cd_causal_chains: [],
    });

    // No fetches should fire — leave queue empty as proof.
    responseQueue = [];

    const r = await runDeliberation(input(), {
      org_id: ORG,
      deliberation_id: "delib-daily-cap",
      supabase: supabase as never,
    });
    assert.equal(r.ok, false);
    assert.equal(r.aborted_reason, "org_daily_cap_exceeded");
    assert.equal(r.per_specialist.length, 0);
    // No deliberation log row created
    assert.equal(supabase.__store.cd_deliberation_log?.length ?? 0, 0);
  });
});

// ============================================================
// Sprint 4 Polish 3 — Fix 4: Researcher + Devil's Advocate run in
// parallel. These tests use a ROLE-AWARE fetch mock (responses keyed
// off the system prompt's role-identifying text, not a positional
// queue) so they are robust to the concurrent firing order, and they
// capture every request body so we can assert what Historian and
// Synthesizer actually see in their priorAnalyses.
// ============================================================

describe("runDeliberation — Fix 4 parallel Researcher + Devil's Advocate", () => {
  const ORIGINAL = globalThis.fetch;
  let capturedBodies: Array<Record<string, unknown>>;

  function systemTextOf(body: Record<string, unknown>): string {
    // Anthropic (Fix 3): system is a content-block array.
    if (Array.isArray(body.system)) {
      return (body.system as Array<Record<string, unknown>>)
        .map((b) => String(b.text ?? ""))
        .join("");
    }
    if (typeof body.system === "string") return body.system;
    // OpenAI (Devil's Advocate): callOpenAI concatenates system + user
    // into `input`.
    if (typeof body.input === "string") return body.input;
    return "";
  }

  function roleOf(body: Record<string, unknown>): string {
    const s = systemTextOf(body);
    if (s.includes("INSPECTION specialist")) return "inspector";
    if (s.includes("SENIOR ENGINEERING specialist")) return "engineer";
    if (s.includes("RESEARCH specialist")) return "researcher";
    if (s.includes("ADVERSARIAL REVIEWER")) return "devils_advocate";
    if (s.includes("HISTORICAL CASES specialist")) return "historian";
    if (s.includes("SYNTHESIZER")) return "synthesizer";
    return "unknown";
  }

  function userTextOf(body: Record<string, unknown>): string {
    const messages = body.messages as
      | Array<Record<string, unknown>>
      | undefined;
    if (messages && typeof messages[0]?.content === "string") {
      return messages[0].content as string;
    }
    if (typeof body.input === "string") return body.input;
    return "";
  }

  const RESPONSE_BY_ROLE: Record<string, () => Response> = {
    inspector: () =>
      anthropicOk(
        specialistJson({
          summary: "Inspector — visible pitting",
          claims: [
            {
              text: "Photo shows pitting",
              confidence: 0.7,
              cited_mechanism_codes: ["pitting_corrosion"],
            },
          ],
          cited_mechanisms: ["pitting_corrosion"],
        })
      ),
    engineer: () =>
      anthropicOk(
        specialistJson({
          summary: "Engineer — pitting most likely",
          claims: [
            {
              text: "Pitting fits environment",
              confidence: 0.85,
              cited_mechanism_codes: ["pitting_corrosion"],
            },
          ],
          cited_mechanisms: ["pitting_corrosion"],
        }),
        { with_thinking: true }
      ),
    researcher: () =>
      anthropicOk(
        specialistJson({
          summary: "Researcher — common in subsea CS",
          claims: [
            { text: "Literature supports pitting", confidence: 0.65 },
          ],
        })
      ),
    devils_advocate: () =>
      openaiOk(
        specialistJson({
          summary: "No significant gaps found: evidence is direct",
          claims: [
            {
              text: "No significant gaps found: well-supported",
              confidence: 0.7,
            },
          ],
        })
      ),
    historian: () =>
      anthropicOk(
        specialistJson({
          summary: "Historian — similar 2024 case",
          claims: [{ text: "Analogous riser case", confidence: 0.7 }],
        })
      ),
    synthesizer: () =>
      anthropicOk(
        specialistJson({
          summary: "Per API 579-1, pitting corrosion confirmed",
          claims: [
            {
              text: "Primary mechanism is pitting corrosion",
              confidence: 0.88,
              cited_mechanism_codes: ["pitting_corrosion"],
            },
          ],
          cited_mechanisms: ["pitting_corrosion"],
        }),
        { with_thinking: true }
      ),
  };

  beforeEach(() => {
    capturedBodies = [];
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.CROSS_DOMAIN_RETRY_BASE_MS = "1";
    globalThis.fetch = (async (_input: FetchInput, init?: FetchInit) => {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(String(init?.body ?? "{}"));
      } catch {
        body = {};
      }
      capturedBodies.push(body);
      const role = roleOf(body);
      const factory = RESPONSE_BY_ROLE[role];
      if (factory) return factory();
      return new Response(JSON.stringify({ error: "unknown_role" }), {
        status: 500,
      });
    }) as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = ORIGINAL;
    if (ORIGINAL_ANTHROPIC === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = ORIGINAL_ANTHROPIC;
    if (ORIGINAL_OPENAI === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = ORIGINAL_OPENAI;
    if (ORIGINAL_RETRY_BASE === undefined)
      delete process.env.CROSS_DOMAIN_RETRY_BASE_MS;
    else process.env.CROSS_DOMAIN_RETRY_BASE_MS = ORIGINAL_RETRY_BASE;
  });

  function freshSupabase() {
    return makeMockSupabase({
      cd_degradation_mechanisms: SEEDED_MECH_ROWS,
      org_feature_flags: [
        {
          org_id: ORG,
          feature_flags: {
            cross_domain: { daily_cap_usd: 100, per_deliberation_cap_usd: 50 },
          },
        },
      ],
      cd_deliberation_log: [],
      cd_causal_chains: [],
      ai_cost_log: [],
    });
  }

  it("both Researcher and Devil's Advocate land in per_specialist, in researcher-then-DA order", async () => {
    const supabase = freshSupabase();
    const result = await runDeliberation(input(), {
      org_id: ORG,
      deliberation_id: "delib-fix4-order",
      supabase: supabase as never,
    });
    assert.equal(result.ok, true, result.aborted_reason ?? "");
    assert.equal(result.per_specialist.length, 6);
    const roles = result.per_specialist.map((s) => s.role);
    assert.deepEqual(roles, [
      "inspector",
      "engineer",
      "researcher",
      "devils_advocate",
      "historian",
      "synthesizer",
    ]);
  });

  it("Researcher and Devil's Advocate are dispatched concurrently — neither request body contains the other's output", async () => {
    const supabase = freshSupabase();
    await runDeliberation(input(), {
      org_id: ORG,
      deliberation_id: "delib-fix4-concurrent",
      supabase: supabase as never,
    });
    const researcherBody = capturedBodies.find(
      (b) => roleOf(b) === "researcher"
    );
    const daBody = capturedBodies.find((b) => roleOf(b) === "devils_advocate");
    assert.ok(researcherBody, "researcher request must have been captured");
    assert.ok(daBody, "devils_advocate request must have been captured");
    assert.ok(
      !userTextOf(researcherBody!).includes('"role": "devils_advocate"'),
      "Researcher must NOT see Devil's Advocate output (parallel dispatch)"
    );
    assert.ok(
      !userTextOf(daBody!).includes('"role": "researcher"'),
      "Devil's Advocate must NOT see Researcher output (parallel dispatch)"
    );
  });

  it("Historian priorAnalyses includes BOTH researcher and devils_advocate", async () => {
    const supabase = freshSupabase();
    await runDeliberation(input(), {
      org_id: ORG,
      deliberation_id: "delib-fix4-historian",
      supabase: supabase as never,
    });
    const historianBody = capturedBodies.find(
      (b) => roleOf(b) === "historian"
    );
    assert.ok(historianBody, "historian request must have been captured");
    const u = userTextOf(historianBody!);
    assert.ok(
      u.includes('"role": "researcher"'),
      "Historian must see Researcher output"
    );
    assert.ok(
      u.includes('"role": "devils_advocate"'),
      "Historian must see Devil's Advocate output"
    );
  });

  it("Synthesizer priorAnalyses includes all 5 prior specialists", async () => {
    const supabase = freshSupabase();
    await runDeliberation(input(), {
      org_id: ORG,
      deliberation_id: "delib-fix4-synth",
      supabase: supabase as never,
    });
    const synthBody = capturedBodies.find((b) => roleOf(b) === "synthesizer");
    assert.ok(synthBody, "synthesizer request must have been captured");
    const u = userTextOf(synthBody!);
    for (const role of [
      "inspector",
      "engineer",
      "researcher",
      "devils_advocate",
      "historian",
    ]) {
      assert.ok(
        u.includes(`"role": "${role}"`),
        `Synthesizer must see ${role} output`
      );
    }
  });
});

// ============================================================
// Sprint 4 Polish 3 — Fix 5: deliberation-completed webhook fires at
// the end of a successful deliberation. Uses a role-aware mock that
// ALSO handles the webhook POST URL.
// ============================================================

import { signWebhookBody } from "../webhookDelivery";

describe("runDeliberation — Fix 5 webhook delivery", () => {
  const ORIGINAL = globalThis.fetch;
  const WEBHOOK_URL = "https://webhook-receiver.test/forged-hook";
  const WEBHOOK_SECRET = "fix5-shared-secret";
  let webhookPosts: Array<{ headers: Record<string, string>; body: string }>;
  let webhookResponder: () => Response;

  function systemTextOf(body: Record<string, unknown>): string {
    if (Array.isArray(body.system)) {
      return (body.system as Array<Record<string, unknown>>)
        .map((b) => String(b.text ?? ""))
        .join("");
    }
    if (typeof body.system === "string") return body.system;
    if (typeof body.input === "string") return body.input;
    return "";
  }
  function roleOf(body: Record<string, unknown>): string {
    const s = systemTextOf(body);
    if (s.includes("INSPECTION specialist")) return "inspector";
    if (s.includes("SENIOR ENGINEERING specialist")) return "engineer";
    if (s.includes("RESEARCH specialist")) return "researcher";
    if (s.includes("ADVERSARIAL REVIEWER")) return "devils_advocate";
    if (s.includes("HISTORICAL CASES specialist")) return "historian";
    if (s.includes("SYNTHESIZER")) return "synthesizer";
    return "unknown";
  }
  const RESPONSE_BY_ROLE: Record<string, () => Response> = {
    inspector: () =>
      anthropicOk(
        specialistJson({
          summary: "Inspector",
          claims: [
            {
              text: "pitting",
              confidence: 0.7,
              cited_mechanism_codes: ["pitting_corrosion"],
            },
          ],
          cited_mechanisms: ["pitting_corrosion"],
        })
      ),
    engineer: () =>
      anthropicOk(
        specialistJson({
          summary: "Engineer",
          claims: [
            {
              text: "pitting fits",
              confidence: 0.85,
              cited_mechanism_codes: ["pitting_corrosion"],
            },
          ],
          cited_mechanisms: ["pitting_corrosion"],
        }),
        { with_thinking: true }
      ),
    researcher: () =>
      anthropicOk(
        specialistJson({
          summary: "Researcher",
          claims: [{ text: "literature supports", confidence: 0.65 }],
        })
      ),
    devils_advocate: () =>
      openaiOk(
        specialistJson({
          summary: "No significant gaps found: direct evidence",
          claims: [
            {
              text: "No significant gaps found: solid",
              confidence: 0.7,
            },
          ],
        })
      ),
    historian: () =>
      anthropicOk(
        specialistJson({
          summary: "Historian",
          claims: [{ text: "analogous case", confidence: 0.7 }],
        })
      ),
    synthesizer: () =>
      anthropicOk(
        specialistJson({
          summary: "Per API 579-1, pitting confirmed",
          claims: [
            {
              text: "primary is pitting",
              confidence: 0.88,
              cited_mechanism_codes: ["pitting_corrosion"],
            },
          ],
          cited_mechanisms: ["pitting_corrosion"],
        }),
        { with_thinking: true }
      ),
  };

  beforeEach(() => {
    webhookPosts = [];
    webhookResponder = () => new Response("ok", { status: 200 });
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.CROSS_DOMAIN_RETRY_BASE_MS = "1";
    process.env.CROSS_DOMAIN_WEBHOOK_RETRY_MS = "1";
    globalThis.fetch = (async (urlInput: FetchInput, init?: FetchInit) => {
      const url = String(urlInput);
      if (url.includes("webhook-receiver.test")) {
        webhookPosts.push({
          headers: (init?.headers ?? {}) as Record<string, string>,
          body: String(init?.body ?? ""),
        });
        return webhookResponder();
      }
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(String(init?.body ?? "{}"));
      } catch {
        body = {};
      }
      const factory = RESPONSE_BY_ROLE[roleOf(body)];
      if (factory) return factory();
      return new Response(JSON.stringify({ error: "unknown_role" }), {
        status: 500,
      });
    }) as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = ORIGINAL;
    if (ORIGINAL_ANTHROPIC === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = ORIGINAL_ANTHROPIC;
    if (ORIGINAL_OPENAI === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = ORIGINAL_OPENAI;
    if (ORIGINAL_RETRY_BASE === undefined)
      delete process.env.CROSS_DOMAIN_RETRY_BASE_MS;
    else process.env.CROSS_DOMAIN_RETRY_BASE_MS = ORIGINAL_RETRY_BASE;
    delete process.env.CROSS_DOMAIN_WEBHOOK_RETRY_MS;
  });

  function supabaseWith(webhookEnabled: boolean) {
    return makeMockSupabase({
      cd_degradation_mechanisms: SEEDED_MECH_ROWS,
      org_feature_flags: [
        {
          org_id: ORG,
          feature_flags: {
            cross_domain: { daily_cap_usd: 100, per_deliberation_cap_usd: 50 },
            webhooks: {
              deliberation_completed: {
                url: WEBHOOK_URL,
                secret: WEBHOOK_SECRET,
                enabled: webhookEnabled,
              },
            },
          },
        },
      ],
      cd_deliberation_log: [],
      cd_causal_chains: [],
      ai_cost_log: [],
    });
  }

  it("org has a webhook configured → POST fired with signed payload after the deliberation finalizes", async () => {
    const supabase = supabaseWith(true);
    const result = await runDeliberation(input(), {
      org_id: ORG,
      deliberation_id: "delib-fix5-fires",
      supabase: supabase as never,
    });
    assert.equal(result.ok, true, result.aborted_reason ?? "");
    assert.equal(webhookPosts.length, 1, "exactly one webhook POST");
    const post = webhookPosts[0];
    // Signature header present + correct for the exact body sent.
    assert.equal(
      post.headers["X-Forged-Signature"],
      signWebhookBody(post.body, WEBHOOK_SECRET)
    );
    assert.equal(post.headers["X-Forged-Event"], "deliberation.completed");
    const payload = JSON.parse(post.body);
    assert.equal(payload.event, "deliberation.completed");
    assert.equal(payload.deliberation_id, "delib-fix5-fires");
    assert.equal(payload.org_id, ORG);
    assert.equal(payload.anomaly_id, ANOMALY.id);
    assert.equal(payload.asset_id, ASSET.id);
    assert.ok(
      typeof payload.consensus_level === "string" &&
        payload.consensus_level.length > 0
    );
    assert.equal(typeof payload.total_cost_usd, "number");
    assert.ok(String(payload.poll_url).includes("delib-fix5-fires"));
  });

  it("webhook returns 500 (twice) → deliberation still completes ok, webhook_error logged to arbitration_rules_applied", async () => {
    webhookResponder = () => new Response("server error", { status: 500 });
    const supabase = supabaseWith(true);
    const result = await runDeliberation(input(), {
      org_id: ORG,
      deliberation_id: "delib-fix5-500",
      supabase: supabase as never,
    });
    // Deliberation itself is unaffected.
    assert.equal(result.ok, true, result.aborted_reason ?? "");
    assert.equal(result.per_specialist.length, 6);
    // initial + one retry on 5xx.
    assert.equal(webhookPosts.length, 2);
    // webhook_error recorded, deliberation NOT failed.
    const row = supabase.__store.cd_deliberation_log[0] as Record<
      string,
      unknown
    >;
    const ara = row.arbitration_rules_applied as Record<string, unknown>;
    assert.ok(
      typeof ara.webhook_error === "string" &&
        (ara.webhook_error as string).includes("500"),
      `webhook_error must be logged; got: ${JSON.stringify(ara.webhook_error)}`
    );
    // final_status still reflects the real arbitration outcome.
    assert.notEqual(ara.final_status, "failed");
  });

  it("webhook disabled (enabled:false) → no POST fired, deliberation completes normally", async () => {
    const supabase = supabaseWith(false);
    const result = await runDeliberation(input(), {
      org_id: ORG,
      deliberation_id: "delib-fix5-disabled",
      supabase: supabase as never,
    });
    assert.equal(result.ok, true, result.aborted_reason ?? "");
    assert.equal(webhookPosts.length, 0, "disabled webhook must not fire");
    const row = supabase.__store.cd_deliberation_log[0] as Record<
      string,
      unknown
    >;
    const ara = row.arbitration_rules_applied as Record<string, unknown>;
    assert.equal(ara.webhook_error, undefined);
  });
});
