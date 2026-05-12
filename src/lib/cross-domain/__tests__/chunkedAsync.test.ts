import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { HandlerEvent } from "@netlify/functions";
import { makeMockSupabase } from "./fixtures";
import { handleTriggerRequest } from "../../../../netlify/functions/cross-domain-deliberate";
import { handleStatusRequest } from "../../../../netlify/functions/cross-domain-deliberation-status";
import {
  deriveStatus,
  specialistsCompleted,
  currentSpecialist,
  progressPct,
  extractFailureReason,
  SPECIALIST_ORDER,
} from "../deliberationState";
import type { SpecialistAnalysis } from "../types";

const ORG = "66666666-6666-6666-6666-666666666666";
const OTHER_ORG = "77777777-7777-7777-7777-777777777777";
const ANOMALY_ID = "00000000-0000-0000-0000-000000000a02";

// ------------------------------------------------------------
// Fetch + env mocking
// ------------------------------------------------------------

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_HEALTH_KEY = process.env.CROSS_DOMAIN_HEALTH_KEY;
const ORIGINAL_URL = process.env.URL;

let fetchCalls: Array<{ url: string; init: RequestInit | undefined }> = [];

function installFetchMock(opts?: { throwOnInvoke?: boolean }) {
  fetchCalls = [];
  process.env.CROSS_DOMAIN_HEALTH_KEY = "test-key";
  process.env.URL = "https://example.netlify.app";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    fetchCalls.push({ url, init });
    if (opts?.throwOnInvoke) throw new Error("network down");
    return new Response("", { status: 202 });
  }) as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = ORIGINAL_FETCH;
  if (ORIGINAL_HEALTH_KEY === undefined) delete process.env.CROSS_DOMAIN_HEALTH_KEY;
  else process.env.CROSS_DOMAIN_HEALTH_KEY = ORIGINAL_HEALTH_KEY;
  if (ORIGINAL_URL === undefined) delete process.env.URL;
  else process.env.URL = ORIGINAL_URL;
}

function mkEvent(opts: {
  method?: string;
  body?: unknown;
  query?: Record<string, string>;
  headers?: Record<string, string>;
}): HandlerEvent {
  return {
    httpMethod: opts.method ?? "POST",
    headers: { "x-health-key": "test-key", ...(opts.headers ?? {}) },
    queryStringParameters: opts.query ?? {},
    body: opts.body === undefined ? null : JSON.stringify(opts.body),
    rawUrl: "https://example.netlify.app/.netlify/functions/cross-domain-deliberate",
  } as unknown as HandlerEvent;
}

function seededFlags() {
  return [
    {
      org_id: ORG,
      feature_flags: { cross_domain_intelligence: true },
    },
    {
      org_id: OTHER_ORG,
      feature_flags: { cross_domain_intelligence: true },
    },
  ];
}

// ------------------------------------------------------------
// deliberationState — pure helpers
// ------------------------------------------------------------

describe("deliberationState — deriveStatus", () => {
  it("returns 'pending' when started_at is null", () => {
    assert.equal(
      deriveStatus({
        id: "x",
        org_id: ORG,
        deliberation_started_at: null,
        deliberation_completed_at: null,
      }),
      "pending"
    );
  });
  it("returns 'running' when started but not completed", () => {
    assert.equal(
      deriveStatus({
        id: "x",
        org_id: ORG,
        deliberation_started_at: new Date().toISOString(),
        deliberation_completed_at: null,
      }),
      "running"
    );
  });
  it("returns 'failed' when consensus_level='failed'", () => {
    assert.equal(
      deriveStatus({
        id: "x",
        org_id: ORG,
        deliberation_started_at: new Date().toISOString(),
        deliberation_completed_at: new Date().toISOString(),
        consensus_level: "failed",
      }),
      "failed"
    );
  });
  it("returns 'completed' otherwise", () => {
    assert.equal(
      deriveStatus({
        id: "x",
        org_id: ORG,
        deliberation_started_at: new Date().toISOString(),
        deliberation_completed_at: new Date().toISOString(),
        consensus_level: "accepted",
      }),
      "completed"
    );
  });
});

describe("deliberationState — currentSpecialist + progressPct", () => {
  it("returns the next specialist in canonical order", () => {
    assert.equal(currentSpecialist([]), "inspector");
    assert.equal(currentSpecialist(["inspector"]), "engineer");
    assert.equal(
      currentSpecialist(["inspector", "engineer", "researcher"]),
      "devils_advocate"
    );
    assert.equal(
      currentSpecialist([...SPECIALIST_ORDER]),
      null
    );
  });
  it("progressPct rounds to nearest integer of completed/6", () => {
    assert.equal(progressPct(0), 0);
    assert.equal(progressPct(3), 50);
    assert.equal(progressPct(6), 100);
  });
});

describe("deliberationState — extractFailureReason", () => {
  it("pulls .error from object form", () => {
    assert.equal(
      extractFailureReason({
        id: "x",
        org_id: ORG,
        arbitration_rules_applied: { error: "engineer_failed: 529" },
      }),
      "engineer_failed: 529"
    );
  });
  it("pulls .error from array form", () => {
    assert.equal(
      extractFailureReason({
        id: "x",
        org_id: ORG,
        arbitration_rules_applied: [
          { error: "per_deliberation_cap_exceeded" } as Record<string, unknown>,
        ],
      }),
      "per_deliberation_cap_exceeded"
    );
  });
  it("returns null when nothing present", () => {
    assert.equal(
      extractFailureReason({ id: "x", org_id: ORG }),
      null
    );
  });
});

// ------------------------------------------------------------
// Trigger endpoint — idempotency + return shape + auth
// ------------------------------------------------------------

describe("trigger endpoint — happy path + return shape", () => {
  beforeEach(() => installFetchMock());
  afterEach(restoreFetch);

  it("first call returns 202 with deliberation_id, status=pending, poll_url", async () => {
    const supabase = makeMockSupabase({
      org_feature_flags: seededFlags(),
      cd_deliberation_log: [],
    });
    const res = await handleTriggerRequest(
      mkEvent({
        body: { anomaly_id: ANOMALY_ID },
        query: { org_id: ORG },
      }),
      supabase as never
    );
    assert.equal(res.statusCode, 202);
    const body = JSON.parse(res.body);
    assert.equal(body.status, "pending");
    assert.ok(body.deliberation_id);
    assert.ok(
      body.poll_url.includes("cross-domain-deliberation-status") &&
        body.poll_url.includes(body.deliberation_id) &&
        body.poll_url.includes(ORG)
    );
    // pending row exists with NO started_at
    const rows = supabase.__store.cd_deliberation_log;
    assert.equal(rows.length, 1);
    const row = rows[0] as Record<string, unknown>;
    assert.equal(row.id, body.deliberation_id);
    assert.equal(row.deliberation_started_at, null);
    assert.equal(row.finding_id, ANOMALY_ID);
    // Background was invoked
    const bgCall = fetchCalls.find((c) =>
      c.url.includes("cross-domain-deliberate-background")
    );
    assert.ok(bgCall, "expected background fetch invocation");
    const bgBody = JSON.parse(String(bgCall!.init?.body ?? "{}"));
    assert.equal(bgBody.deliberation_id, body.deliberation_id);
    assert.equal(bgBody.anomaly_id, ANOMALY_ID);
    assert.equal(bgBody.org_id, ORG);
  });
});

describe("trigger endpoint — idempotency", () => {
  beforeEach(() => installFetchMock());
  afterEach(restoreFetch);

  it("second call within 30s returns already_running with the first deliberation_id", async () => {
    const supabase = makeMockSupabase({
      org_feature_flags: seededFlags(),
      cd_deliberation_log: [],
    });
    const first = await handleTriggerRequest(
      mkEvent({ body: { anomaly_id: ANOMALY_ID }, query: { org_id: ORG } }),
      supabase as never
    );
    const firstId = JSON.parse(first.body).deliberation_id;

    const second = await handleTriggerRequest(
      mkEvent({ body: { anomaly_id: ANOMALY_ID }, query: { org_id: ORG } }),
      supabase as never
    );
    assert.equal(second.statusCode, 200);
    const body = JSON.parse(second.body);
    assert.equal(body.already_running, true);
    assert.equal(body.deliberation_id, firstId);
    // No second row created
    assert.equal(supabase.__store.cd_deliberation_log.length, 1);
    // Background invoked only once
    assert.equal(
      fetchCalls.filter((c) => c.url.includes("background")).length,
      1
    );
  });

  it("does NOT match a completed row in the same window", async () => {
    const supabase = makeMockSupabase({
      org_feature_flags: seededFlags(),
      cd_deliberation_log: [
        {
          id: "completed-old",
          org_id: ORG,
          finding_id: ANOMALY_ID,
          deliberation_started_at: new Date().toISOString(),
          // Already completed → not in-flight
          deliberation_completed_at: new Date().toISOString(),
          consensus_level: "accepted",
          specialist_outputs: [],
          created_at: new Date().toISOString(),
        },
      ],
    });
    const res = await handleTriggerRequest(
      mkEvent({ body: { anomaly_id: ANOMALY_ID }, query: { org_id: ORG } }),
      supabase as never
    );
    assert.equal(res.statusCode, 202);
    const body = JSON.parse(res.body);
    assert.notEqual(body.deliberation_id, "completed-old");
  });

  it("does NOT match an older-than-30s row (stale, eligible for resume)", async () => {
    const oldISO = new Date(Date.now() - 90 * 1000).toISOString();
    const supabase = makeMockSupabase({
      org_feature_flags: seededFlags(),
      cd_deliberation_log: [
        {
          id: "stale-row",
          org_id: ORG,
          finding_id: ANOMALY_ID,
          deliberation_started_at: oldISO,
          deliberation_completed_at: null,
          specialist_outputs: [],
          created_at: oldISO,
        },
      ],
    });
    const res = await handleTriggerRequest(
      mkEvent({ body: { anomaly_id: ANOMALY_ID }, query: { org_id: ORG } }),
      supabase as never
    );
    assert.equal(res.statusCode, 202);
  });
});

describe("trigger endpoint — failure to invoke background", () => {
  beforeEach(() => installFetchMock({ throwOnInvoke: true }));
  afterEach(restoreFetch);

  it("returns 500 and marks the row failed", async () => {
    const supabase = makeMockSupabase({
      org_feature_flags: seededFlags(),
      cd_deliberation_log: [],
    });
    const res = await handleTriggerRequest(
      mkEvent({ body: { anomaly_id: ANOMALY_ID }, query: { org_id: ORG } }),
      supabase as never
    );
    assert.equal(res.statusCode, 500);
    const body = JSON.parse(res.body);
    assert.equal(body.error, "background_trigger_failed");
    const row = supabase.__store.cd_deliberation_log[0] as Record<string, unknown>;
    assert.equal(row.consensus_level, "failed");
    const era = row.arbitration_rules_applied as Record<string, unknown>;
    assert.ok(String(era.error).includes("background_trigger_failed"));
  });
});

describe("trigger endpoint — auth + validation", () => {
  beforeEach(() => installFetchMock());
  afterEach(restoreFetch);

  it("401 on wrong x-health-key", async () => {
    const supabase = makeMockSupabase({ org_feature_flags: seededFlags() });
    const res = await handleTriggerRequest(
      mkEvent({
        body: { anomaly_id: ANOMALY_ID },
        query: { org_id: ORG },
        headers: { "x-health-key": "wrong" },
      }),
      supabase as never
    );
    assert.equal(res.statusCode, 401);
  });

  it("400 on missing anomaly_id", async () => {
    const supabase = makeMockSupabase({ org_feature_flags: seededFlags() });
    const res = await handleTriggerRequest(
      mkEvent({ body: {}, query: { org_id: ORG } }),
      supabase as never
    );
    assert.equal(res.statusCode, 400);
  });

  it("403 when cross_domain_intelligence flag is off", async () => {
    const supabase = makeMockSupabase({
      org_feature_flags: [
        { org_id: ORG, feature_flags: { cross_domain_intelligence: false } },
      ],
    });
    const res = await handleTriggerRequest(
      mkEvent({ body: { anomaly_id: ANOMALY_ID }, query: { org_id: ORG } }),
      supabase as never
    );
    assert.equal(res.statusCode, 403);
  });
});

// ------------------------------------------------------------
// Status endpoint — pending / running / completed / failed
// ------------------------------------------------------------

function statusEvent(query: Record<string, string>, headers?: Record<string, string>) {
  return mkEvent({ method: "GET", query, headers });
}

function mkSpecialist(role: SpecialistAnalysis["role"]): SpecialistAnalysis {
  return {
    role,
    model: "mock",
    summary: `${role} summary`,
    claims: [],
    open_questions: [],
    cited_mechanisms: [],
    cited_evidence: [],
    cost_usd: 0.01,
    latency_ms: 1000,
    attempts: 1,
    raw_response: "",
  };
}

describe("status endpoint — pending", () => {
  beforeEach(() => installFetchMock());
  afterEach(restoreFetch);

  it("returns pending, 0%, empty completed[] when started_at is null", async () => {
    const supabase = makeMockSupabase({
      cd_deliberation_log: [
        {
          id: "pending-1",
          org_id: ORG,
          deliberation_started_at: null,
          deliberation_completed_at: null,
          specialist_outputs: [],
        },
      ],
    });
    const res = await handleStatusRequest(
      statusEvent({ id: "pending-1", org_id: ORG }),
      supabase as never
    );
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.status, "pending");
    assert.equal(body.progress_pct, 0);
    assert.deepEqual(body.specialists_completed, []);
    assert.equal(body.current_specialist, null);
  });
});

describe("status endpoint — running", () => {
  beforeEach(() => installFetchMock());
  afterEach(restoreFetch);

  it("returns running, 50%, completed[3], current=devils_advocate", async () => {
    const supabase = makeMockSupabase({
      cd_deliberation_log: [
        {
          id: "running-1",
          org_id: ORG,
          deliberation_started_at: new Date(Date.now() - 5000).toISOString(),
          deliberation_completed_at: null,
          specialist_outputs: [
            mkSpecialist("inspector"),
            mkSpecialist("engineer"),
            mkSpecialist("researcher"),
          ],
          total_cost_usd: 0.03,
        },
      ],
    });
    const res = await handleStatusRequest(
      statusEvent({ id: "running-1", org_id: ORG }),
      supabase as never
    );
    const body = JSON.parse(res.body);
    assert.equal(body.status, "running");
    assert.equal(body.progress_pct, 50);
    assert.deepEqual(body.specialists_completed, [
      "inspector",
      "engineer",
      "researcher",
    ]);
    assert.equal(body.current_specialist, "devils_advocate");
    assert.ok(body.elapsed_ms >= 0);
    assert.equal(body.total_cost_usd, 0.03);
  });
});

describe("status endpoint — completed", () => {
  beforeEach(() => installFetchMock());
  afterEach(restoreFetch);

  it("returns completed, 100%, surfaces synthesizer_decision + consensus_level", async () => {
    const synth = mkSpecialist("synthesizer");
    const supabase = makeMockSupabase({
      cd_deliberation_log: [
        {
          id: "done-1",
          org_id: ORG,
          deliberation_started_at: new Date(Date.now() - 60000).toISOString(),
          deliberation_completed_at: new Date().toISOString(),
          specialist_outputs: SPECIALIST_ORDER.map(mkSpecialist),
          synthesizer_decision: synth,
          consensus_level: "accepted",
          escalated_to_human: false,
          total_cost_usd: 2.45,
        },
      ],
    });
    const res = await handleStatusRequest(
      statusEvent({ id: "done-1", org_id: ORG }),
      supabase as never
    );
    const body = JSON.parse(res.body);
    assert.equal(body.status, "completed");
    assert.equal(body.progress_pct, 100);
    assert.equal(body.consensus_level, "accepted");
    assert.equal(body.escalated_to_human, false);
    assert.ok(body.synthesizer_decision);
    assert.equal(body.failure_reason, null);
  });
});

describe("status endpoint — failed", () => {
  beforeEach(() => installFetchMock());
  afterEach(restoreFetch);

  it("returns failed and surfaces failure_reason from arbitration_rules_applied.error", async () => {
    const supabase = makeMockSupabase({
      cd_deliberation_log: [
        {
          id: "fail-1",
          org_id: ORG,
          deliberation_started_at: new Date(Date.now() - 30000).toISOString(),
          deliberation_completed_at: new Date().toISOString(),
          specialist_outputs: [mkSpecialist("inspector")],
          consensus_level: "failed",
          escalated_to_human: true,
          arbitration_rules_applied: { error: "engineer_failed: anthropic 529" },
        },
      ],
    });
    const res = await handleStatusRequest(
      statusEvent({ id: "fail-1", org_id: ORG }),
      supabase as never
    );
    const body = JSON.parse(res.body);
    assert.equal(body.status, "failed");
    assert.equal(body.failure_reason, "engineer_failed: anthropic 529");
    assert.equal(body.escalated_to_human, true);
  });
});

describe("status endpoint — auth + tenant isolation", () => {
  beforeEach(() => installFetchMock());
  afterEach(restoreFetch);

  it("401 on wrong x-health-key", async () => {
    const supabase = makeMockSupabase({ cd_deliberation_log: [] });
    const res = await handleStatusRequest(
      statusEvent({ id: "x", org_id: ORG }, { "x-health-key": "wrong" }),
      supabase as never
    );
    assert.equal(res.statusCode, 401);
  });

  it("400 on missing id", async () => {
    const supabase = makeMockSupabase({ cd_deliberation_log: [] });
    const res = await handleStatusRequest(
      statusEvent({ org_id: ORG }),
      supabase as never
    );
    assert.equal(res.statusCode, 400);
  });

  it("404 when querying with the wrong org_id (NOT leaking row exists)", async () => {
    const supabase = makeMockSupabase({
      cd_deliberation_log: [
        {
          id: "iso-1",
          org_id: ORG,
          deliberation_started_at: new Date().toISOString(),
          deliberation_completed_at: null,
          specialist_outputs: [],
        },
      ],
    });
    const res = await handleStatusRequest(
      statusEvent({ id: "iso-1", org_id: OTHER_ORG }),
      supabase as never
    );
    assert.equal(res.statusCode, 404);
  });
});

// Sanity: specialistsCompleted gracefully handles a malformed jsonb
describe("specialistsCompleted — defensive parsing", () => {
  it("ignores non-object entries", () => {
    const result = specialistsCompleted({
      id: "x",
      org_id: ORG,
      specialist_outputs: [
        mkSpecialist("inspector"),
        // @ts-expect-error intentionally malformed for runtime tolerance test
        null,
        // @ts-expect-error intentionally malformed
        "not-an-object",
      ],
    });
    assert.deepEqual(result, ["inspector"]);
  });
});
