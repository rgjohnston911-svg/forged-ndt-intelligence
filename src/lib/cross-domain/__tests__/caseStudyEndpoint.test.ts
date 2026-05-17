// ============================================================
// Sprint 5 Phase B — case-study endpoint + renderer tests
// ============================================================

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { HandlerEvent } from "@netlify/functions";
import { handleCaseStudyRequest } from "../../../../netlify/functions/cross-domain-deliberation-case-study";
import {
  extractStandards,
  extractRecommendedActionFromSummary,
  extractPriorCaseRefs,
  renderCaseStudyMarkdown,
  SECTION_HEADERS,
  NO_PRIOR_CASES_STRING,
  type CaseStudyData,
} from "../caseStudyRenderer";
import { makeMockSupabase, type MockSupabase } from "./fixtures";
import type { SpecialistAnalysis } from "../types";

const ORG = "713dcec2-69db-43e2-a367-457a1fe6d943";
const OTHER_ORG = "99999999-9999-9999-9999-999999999999";
const HEALTH_KEY = "test-health-key";
const DELIB_OK = "11111111-1111-1111-1111-111111111111";
const DELIB_PENDING = "22222222-2222-2222-2222-222222222222";
const DELIB_OTHER_ORG = "33333333-3333-3333-3333-333333333333";
const DELIB_COLD_START = "44444444-4444-4444-4444-444444444444";
const ASSET_ID = "00000000-0000-0000-0000-000000000a01";
const ANOMALY_ID = "00000000-0000-0000-0000-000000000a02";
const EVIDENCE_E01 = "00000000-0000-0000-0000-000000000e01";
const EVIDENCE_E02 = "00000000-0000-0000-0000-000000000e02";
const EVIDENCE_E03 = "00000000-0000-0000-0000-000000000e03";

const ORIGINAL_HEALTH_KEY = process.env.CROSS_DOMAIN_HEALTH_KEY;

before(() => {
  process.env.CROSS_DOMAIN_HEALTH_KEY = HEALTH_KEY;
});
after(() => {
  if (ORIGINAL_HEALTH_KEY === undefined) {
    delete process.env.CROSS_DOMAIN_HEALTH_KEY;
  } else {
    process.env.CROSS_DOMAIN_HEALTH_KEY = ORIGINAL_HEALTH_KEY;
  }
});

function makeEvent(opts: {
  method?: string;
  healthKey?: string | null;
  id?: string | null;
  orgId?: string | null;
  format?: string | null;
}): HandlerEvent {
  const headers: Record<string, string> = {};
  if (opts.healthKey !== null && opts.healthKey !== undefined) {
    headers["x-health-key"] = opts.healthKey;
  }
  const qs: Record<string, string> = {};
  if (opts.id) qs.id = opts.id;
  if (opts.orgId) qs.org_id = opts.orgId;
  if (opts.format) qs.format = opts.format;
  return {
    httpMethod: opts.method ?? "GET",
    headers,
    queryStringParameters: qs,
    // Other HandlerEvent fields aren't read by the handler. Cast through unknown.
  } as unknown as HandlerEvent;
}

const SYNTH_SUMMARY = [
  "Per API 579-1/ASME FFS-1 Part 5 and DNV-RP-F101, this anomaly is a localized external wall loss requiring Level 2 fitness-for-service assessment.",
  "The 6.65mm remaining wall (35% of nominal) at KP 2.3 results from cathodic protection shielding under disbonded 3LPP coating, consistent with NACE SP0169-2013 §6.4.",
  "Recommended action: urgent_assessment. Conduct a Level 2 FFS per API 579-1, regrid UT at 25mm spacing, and retrofit anodes given >70% depletion at KP 2.45.",
].join(" ");

const SYNTH_CLAIMS = [
  {
    text: "Cathodic protection shielding under disbonded coating is the dominant mechanism, per NACE SP0169-2013.",
    confidence: 0.91,
    supporting_evidence_ids: [EVIDENCE_E03, EVIDENCE_E02],
    cited_mechanism_codes: [
      "cathodic_protection_failure",
      "coating_disbondment",
    ],
  },
  {
    text: "Localized external wall loss measured at 6.65mm remaining (35% of 19.05mm nominal) over a 200mm region.",
    confidence: 0.95,
    supporting_evidence_ids: [EVIDENCE_E01],
    cited_mechanism_codes: ["general_corrosion", "pitting_corrosion"],
  },
];

const HISTORIAN_OUTPUT: SpecialistAnalysis = {
  role: "historian",
  model: "claude-sonnet-4-6",
  summary:
    "Two analogous prior cases retrieved. Case e9953ca4-b014-4911-943d-65fe9e1432e0 (pressure vessel weld toe, sour service, 2024) shows the same disbonded-coating + CP-shielding pattern. Case a5bc1de1-6ce2-4211-96f3-37828b7f2a58 (offshore crane fatigue, 2025) is mechanism-divergent but environment-similar.",
  claims: [
    {
      text: "Case e9953ca4 confirmed CP-shielding as the dominant failure mode after Level 2 FFS.",
      confidence: 0.82,
      supporting_evidence_ids: [],
      cited_mechanism_codes: ["cathodic_protection_failure"],
    },
  ],
  open_questions: [],
  cited_mechanisms: ["cathodic_protection_failure"],
  cited_evidence: [],
  cost_usd: 0.012,
  latency_ms: 4200,
  attempts: 1,
  raw_response: "{}",
};

const SYNTH_OUTPUT: SpecialistAnalysis = {
  role: "synthesizer",
  model: "claude-opus-4-6",
  summary: SYNTH_SUMMARY,
  claims: SYNTH_CLAIMS,
  open_questions: [
    "Anode survey at KP 2.45 should be repeated to confirm >70% depletion is uniform.",
    "Re-coating extent recommendation pending operator constraints.",
  ],
  cited_mechanisms: ["cathodic_protection_failure", "coating_disbondment"],
  cited_evidence: [EVIDENCE_E01, EVIDENCE_E02, EVIDENCE_E03],
  cost_usd: 0.045,
  latency_ms: 18500,
  attempts: 1,
  raw_response: "{}",
};

function buildStore(extra: Record<string, unknown[]> = {}) {
  return {
    cd_deliberation_log: [
      {
        id: DELIB_OK,
        org_id: ORG,
        finding_id: ANOMALY_ID,
        deliberation_started_at: "2026-05-12T22:00:00+00:00",
        deliberation_completed_at: "2026-05-12T22:08:42+00:00",
        specialist_outputs: [HISTORIAN_OUTPUT, SYNTH_OUTPUT],
        synthesizer_decision: SYNTH_OUTPUT,
        arbitration_rules_applied: {
          arbitration_decision: {
            status: "accepted",
            reason: "n/a",
            devils_advocate_objections_addressed: 3,
            devils_advocate_objections_unresolved: 0,
          },
          final_status: "accepted",
          webhook_attempted: true,
          webhook_status: 200,
        },
        consensus_level: "unanimous",
        total_cost_usd: 0.057,
      },
      {
        id: DELIB_PENDING,
        org_id: ORG,
        finding_id: ANOMALY_ID,
        deliberation_started_at: "2026-05-13T10:00:00+00:00",
        deliberation_completed_at: null,
        specialist_outputs: [],
        synthesizer_decision: null,
        arbitration_rules_applied: {},
        consensus_level: null,
        total_cost_usd: 0,
      },
      {
        id: DELIB_OTHER_ORG,
        org_id: OTHER_ORG,
        finding_id: ANOMALY_ID,
        deliberation_started_at: "2026-05-12T22:00:00+00:00",
        deliberation_completed_at: "2026-05-12T22:08:00+00:00",
        specialist_outputs: [SYNTH_OUTPUT],
        synthesizer_decision: SYNTH_OUTPUT,
        arbitration_rules_applied: { final_status: "accepted" },
        consensus_level: "unanimous",
        total_cost_usd: 0.05,
      },
      {
        id: DELIB_COLD_START,
        org_id: ORG,
        finding_id: ANOMALY_ID,
        deliberation_started_at: "2026-05-12T22:00:00+00:00",
        deliberation_completed_at: "2026-05-12T22:08:00+00:00",
        specialist_outputs: [
          {
            ...HISTORIAN_OUTPUT,
            summary:
              "No analogous prior cases in tenant memory; reasoning from current evidence and the degradation mechanism database only.",
            claims: [],
          },
          SYNTH_OUTPUT,
        ],
        synthesizer_decision: SYNTH_OUTPUT,
        arbitration_rules_applied: { final_status: "accepted" },
        consensus_level: "unanimous",
        total_cost_usd: 0.05,
      },
    ],
    cd_asset_anomalies: [
      {
        id: ANOMALY_ID,
        org_id: ORG,
        asset_id: ASSET_ID,
        domain: "pipeline",
        anomaly_type: "external_wall_loss_localized",
        severity: "cat_3_major",
        description: "Localized external wall loss at KP 2.3, 6 o'clock.",
      },
    ],
    cd_asset_nodes: [
      {
        id: ASSET_ID,
        org_id: ORG,
        asset_name: "Riser Touchdown Section, Platform Alpha",
        domain: "pipeline",
        criticality: "high",
        location_description: "Gulf of Mexico, 1200m water depth",
      },
    ],
    cd_evidence_items: [
      {
        id: EVIDENCE_E01,
        org_id: ORG,
        linked_entity_type: "anomaly",
        linked_entity_id: ANOMALY_ID,
        evidence_type: "measurement",
        raw_text:
          "UT grid scan, 25mm spacing. 47 readings across 200mm x 200mm region centered on 6 o'clock at KP 2.3. Minimum 6.65mm, maximum 18.92mm, mean 14.31mm.",
      },
      {
        id: EVIDENCE_E02,
        org_id: ORG,
        linked_entity_type: "anomaly",
        linked_entity_id: ANOMALY_ID,
        evidence_type: "photo",
        raw_text:
          "ROV close-visual inspection of KP 2.3 region. 3LPP coating exhibits radial cracking and disbondment over approximately 350mm axial extent at 6 o'clock.",
      },
      {
        id: EVIDENCE_E03,
        org_id: ORG,
        linked_entity_type: "anomaly",
        linked_entity_id: ANOMALY_ID,
        evidence_type: "measurement",
        raw_text:
          "CP potential measurements at KP 2.3 region using Ag/AgCl reference. Readings: -780 mV at the disbondment center, -920 mV at 1m offset, -940 mV at 5m offset.",
      },
    ],
    cd_anomaly_consequence_assessments: [
      {
        deliberation_id: DELIB_OK,
        org_id: ORG,
        recommended_action_tier: "urgent_assessment",
        overall_tier: "high",
        total_confidence: 0.88,
        time_to_consequence_days: 180,
        created_at: "2026-05-12T22:09:00+00:00",
      },
      {
        deliberation_id: DELIB_OK,
        org_id: ORG,
        recommended_action_tier: "engineering_review",
        overall_tier: "moderate",
        total_confidence: 0.7,
        time_to_consequence_days: 365,
        // Older row — the endpoint must take the newer one.
        created_at: "2026-05-10T08:00:00+00:00",
      },
    ],
    ...extra,
  };
}

let supabase: MockSupabase;
beforeEach(() => {
  supabase = makeMockSupabase(buildStore());
});

// ============================================================
// Pure renderer / helper tests
// ============================================================

describe("extractStandards", () => {
  it("extracts standards with their immediate identifiers", () => {
    const r = extractStandards(SYNTH_SUMMARY);
    const codes = r.map((x) => x.raw_match);
    assert.ok(codes.includes("API 579-1"), `codes: ${codes.join(", ")}`);
    assert.ok(codes.includes("DNV-RP-F101"), `codes: ${codes.join(", ")}`);
    assert.ok(
      codes.some((c) => c.startsWith("NACE")),
      `codes: ${codes.join(", ")}`
    );
  });
  it("dedupes repeated mentions", () => {
    const r = extractStandards(
      "Per API 579-1 this is required. Reaffirmed by API 579-1 in section 5."
    );
    assert.equal(r.length, 1);
  });
  it("captures context sentence for each match", () => {
    const r = extractStandards(SYNTH_SUMMARY);
    for (const s of r) {
      assert.ok(s.context_sentence.includes(s.raw_match.split(" ")[0]));
    }
  });
  it("returns empty array on no-standards text", () => {
    const r = extractStandards("This is a sentence with no codes cited.");
    assert.deepEqual(r, []);
  });
});

describe("extractRecommendedActionFromSummary", () => {
  it("parses 'Recommended action: urgent_assessment' from prose", () => {
    assert.equal(
      extractRecommendedActionFromSummary(SYNTH_SUMMARY),
      "urgent_assessment"
    );
  });
  it("returns null when no recommended-action phrase present", () => {
    assert.equal(extractRecommendedActionFromSummary("no action here"), null);
  });
  it("returns null when tier value is outside the enum", () => {
    assert.equal(
      extractRecommendedActionFromSummary(
        "Recommended action: invent_a_new_tier here."
      ),
      null
    );
  });
});

describe("extractPriorCaseRefs", () => {
  it("extracts Case <uuid> references from Historian summary + claims", () => {
    const r = extractPriorCaseRefs(HISTORIAN_OUTPUT);
    assert.ok(r.case_ids.includes("e9953ca4-b014-4911-943d-65fe9e1432e0"));
    assert.ok(r.case_ids.includes("a5bc1de1-6ce2-4211-96f3-37828b7f2a58"));
  });
  it("returns empty for null Historian", () => {
    const r = extractPriorCaseRefs(null);
    assert.deepEqual(r.case_ids, []);
  });
});

// ============================================================
// Endpoint integration tests
// ============================================================

describe("cross-domain-deliberation-case-study endpoint", () => {
  it("Test 1: wrong x-health-key → 401", async () => {
    const r = await handleCaseStudyRequest(
      makeEvent({ healthKey: "wrong", id: DELIB_OK, orgId: ORG }),
      supabase as never
    );
    assert.equal(r.statusCode, 401);
    assert.ok(r.body.includes("unauthorized"));
  });

  it("Test 2: missing org_id → 400", async () => {
    const r = await handleCaseStudyRequest(
      makeEvent({ healthKey: HEALTH_KEY, id: DELIB_OK, orgId: null }),
      supabase as never
    );
    assert.equal(r.statusCode, 400);
    assert.ok(r.body.includes("org_id"));
  });

  it("Test 3: wrong org_id (deliberation belongs to other org) → 404", async () => {
    const r = await handleCaseStudyRequest(
      makeEvent({
        healthKey: HEALTH_KEY,
        id: DELIB_OTHER_ORG,
        orgId: ORG, // requesting org isn't the owner
      }),
      supabase as never
    );
    assert.equal(r.statusCode, 404);
    assert.ok(r.body.includes("deliberation_not_found"));
  });

  it("Test 4: unknown deliberation_id → 404", async () => {
    const r = await handleCaseStudyRequest(
      makeEvent({
        healthKey: HEALTH_KEY,
        id: "00000000-0000-0000-0000-000000000bad",
        orgId: ORG,
      }),
      supabase as never
    );
    assert.equal(r.statusCode, 404);
  });

  it("Test 5: incomplete deliberation (deliberation_completed_at IS NULL) → 422", async () => {
    const r = await handleCaseStudyRequest(
      makeEvent({ healthKey: HEALTH_KEY, id: DELIB_PENDING, orgId: ORG }),
      supabase as never
    );
    assert.equal(r.statusCode, 422);
    assert.ok(r.body.includes("deliberation_incomplete"));
  });

  it("Test 6: unsupported format (?format=pdf) → 400", async () => {
    const r = await handleCaseStudyRequest(
      makeEvent({
        healthKey: HEALTH_KEY,
        id: DELIB_OK,
        orgId: ORG,
        format: "pdf",
      }),
      supabase as never
    );
    assert.equal(r.statusCode, 400);
    assert.ok(r.body.includes("unsupported_format"));
  });

  it("Test 7: markdown structure contains all 6 section headers", async () => {
    const r = await handleCaseStudyRequest(
      makeEvent({ healthKey: HEALTH_KEY, id: DELIB_OK, orgId: ORG }),
      supabase as never
    );
    assert.equal(r.statusCode, 200);
    assert.equal(r.headers["Content-Type"], "text/markdown; charset=utf-8");
    for (const header of SECTION_HEADERS) {
      assert.ok(
        r.body.includes(header),
        `missing section header "${header}" in output`
      );
    }
  });

  it("Test 8: evidence excerpts present in Why section", async () => {
    const r = await handleCaseStudyRequest(
      makeEvent({ healthKey: HEALTH_KEY, id: DELIB_OK, orgId: ORG }),
      supabase as never
    );
    assert.equal(r.statusCode, 200);
    assert.ok(
      r.body.includes("UT grid scan, 25mm spacing"),
      "evidence e01 raw_text excerpt should appear in Why section"
    );
    assert.ok(
      r.body.includes("[measurement]") || r.body.includes("[photo]"),
      "evidence_type prefix should appear in Why section"
    );
  });

  it("Test 9: prior case section handles cold-start", async () => {
    const r = await handleCaseStudyRequest(
      makeEvent({ healthKey: HEALTH_KEY, id: DELIB_COLD_START, orgId: ORG }),
      supabase as never
    );
    assert.equal(r.statusCode, 200);
    assert.ok(
      r.body.includes(NO_PRIOR_CASES_STRING),
      "cold-start fallback string should appear when Historian has no case refs"
    );
  });

  it("Test 10: happy-path returns 200 + text/markdown, > 2000 chars, contains synth summary", async () => {
    const r = await handleCaseStudyRequest(
      makeEvent({ healthKey: HEALTH_KEY, id: DELIB_OK, orgId: ORG }),
      supabase as never
    );
    assert.equal(r.statusCode, 200);
    assert.equal(r.headers["Content-Type"], "text/markdown; charset=utf-8");
    assert.ok(
      r.body.length > 2000,
      `expected real case study (>2000 chars), got ${r.body.length}`
    );
    assert.ok(
      r.body.includes("Riser Touchdown Section"),
      "asset name must appear in title"
    );
    assert.ok(
      r.body.includes("URGENT_ASSESSMENT"),
      "consequence row's recommended_action_tier must appear in HOW"
    );
    assert.ok(
      r.body.includes("e9953ca4"),
      "Historian's prior-case reference must appear in Prior cases section"
    );
  });

  it("405 on non-GET method", async () => {
    const r = await handleCaseStudyRequest(
      makeEvent({
        method: "POST",
        healthKey: HEALTH_KEY,
        id: DELIB_OK,
        orgId: ORG,
      }),
      supabase as never
    );
    assert.equal(r.statusCode, 405);
  });

  it("200 on OPTIONS preflight", async () => {
    const r = await handleCaseStudyRequest(
      makeEvent({ method: "OPTIONS" }),
      supabase as never
    );
    assert.equal(r.statusCode, 200);
  });
});

// ============================================================
// Renderer fallback paths (consequence row missing, failed deliberation)
// ============================================================

describe("renderCaseStudyMarkdown — fallbacks", () => {
  function baseData(): CaseStudyData {
    return {
      deliberation: {
        id: DELIB_OK,
        org_id: ORG,
        finding_id: ANOMALY_ID,
        deliberation_started_at: "2026-05-12T22:00:00+00:00",
        deliberation_completed_at: "2026-05-12T22:08:00+00:00",
        specialist_outputs: [SYNTH_OUTPUT],
        synthesizer_decision: SYNTH_OUTPUT,
        arbitration_rules_applied: { final_status: "accepted" },
        consensus_level: "unanimous",
        total_cost_usd: 0.05,
      },
      asset: {
        id: ASSET_ID,
        asset_name: "Test Asset",
        domain: "pipeline",
        criticality: "high",
        location_description: null,
      },
      anomaly: {
        id: ANOMALY_ID,
        anomaly_type: "external_wall_loss_localized",
        severity: "cat_3_major",
        description: "desc",
        domain: "pipeline",
      },
      evidenceById: new Map(),
      consequence: null,
      generatedAt: "2026-05-17T00:00:00.000Z",
    };
  }

  it("falls back to summary regex when consequence row is missing", () => {
    const md = renderCaseStudyMarkdown(baseData());
    // synth summary contains 'Recommended action: urgent_assessment'
    assert.ok(md.includes("URGENT_ASSESSMENT"));
  });

  it("shows STATUS: FAILED banner when consensus is unresolved", () => {
    const data = baseData();
    data.deliberation.consensus_level = "unresolved";
    data.deliberation.arbitration_rules_applied = {
      final_status: "failed",
      error: "synthesizer_failed: anthropic 500",
    };
    const md = renderCaseStudyMarkdown(data);
    assert.ok(md.includes("STATUS: FAILED"));
  });

  it("handles a deliberation with no synthesizer_decision", () => {
    const data = baseData();
    data.deliberation.synthesizer_decision = null;
    data.deliberation.specialist_outputs = [];
    const md = renderCaseStudyMarkdown(data);
    assert.ok(md.includes("_No synthesizer summary available"));
    assert.ok(md.includes("_No standards or mechanisms cited._"));
  });
});
