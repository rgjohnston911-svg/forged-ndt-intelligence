// ============================================================
// Sprint 4 Polish 3 — Fix 5: webhookDelivery unit tests
//
// Coverage:
//   - signWebhookBody: HMAC-SHA256 over the body with the org secret,
//     `sha256=<hex>` format, deterministic, secret-sensitive
//   - deliverDeliberationWebhook: fires when configured, signs the
//     body, no-ops when disabled / unconfigured / url-less, retries
//     ONCE on 5xx, does NOT retry on 4xx, abandons on a thrown error
// ============================================================

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  signWebhookBody,
  deliverDeliberationWebhook,
  type DeliberationWebhookPayload,
} from "../webhookDelivery";

const ORG = "99999999-9999-9999-9999-999999999999";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_RETRY = process.env.CROSS_DOMAIN_WEBHOOK_RETRY_MS;

function basePayload(): DeliberationWebhookPayload {
  return {
    event: "deliberation.completed",
    delivered_at: "2026-05-14T00:00:00.000Z",
    deliberation_id: "delib-webhook-1",
    org_id: ORG,
    anomaly_id: "anom-1",
    asset_id: "asset-1",
    consensus_level: "majority_with_dissent",
    escalated_to_human: false,
    recommended_action_tier: "urgent_assessment",
    overall_consequence_tier: "severe",
    total_cost_usd: 1.31,
    poll_url: "https://example.com/status?deliberation_id=delib-webhook-1",
  };
}

// Minimal supabase mock — only org_feature_flags select is exercised.
function makeSupabase(featureFlags: Record<string, unknown> | null): unknown {
  return {
    from(table: string) {
      return {
        _filters: [] as Array<(r: Record<string, unknown>) => boolean>,
        select(_c?: string) {
          return this;
        },
        eq(col: string, val: unknown) {
          this._filters.push((r) => r[col] === val);
          return this;
        },
        maybeSingle() {
          return this;
        },
        then(onFulfilled: (v: unknown) => unknown) {
          if (table === "org_feature_flags") {
            if (featureFlags === null) {
              return Promise.resolve({ data: null, error: null }).then(
                onFulfilled
              );
            }
            return Promise.resolve({
              data: { feature_flags: featureFlags },
              error: null,
            }).then(onFulfilled);
          }
          return Promise.resolve({ data: null, error: null }).then(
            onFulfilled
          );
        },
      };
    },
  };
}

function webhookFlags(
  over: Partial<{ url: string; secret: string; enabled: boolean }> = {}
) {
  return {
    cross_domain_intelligence: true,
    webhooks: {
      deliberation_completed: {
        url: "https://customer.example.com/forged-webhook",
        secret: "shared-secret-123",
        enabled: true,
        ...over,
      },
    },
  };
}

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  if (ORIGINAL_RETRY === undefined)
    delete process.env.CROSS_DOMAIN_WEBHOOK_RETRY_MS;
  else process.env.CROSS_DOMAIN_WEBHOOK_RETRY_MS = ORIGINAL_RETRY;
});

describe("Fix 5 — signWebhookBody (HMAC-SHA256)", () => {
  it("produces sha256=<hex> matching a standard HMAC-SHA256 of the body", () => {
    const body = '{"event":"deliberation.completed","deliberation_id":"x"}';
    const secret = "test-secret";
    const sig = signWebhookBody(body, secret);
    const expected =
      "sha256=" +
      createHmac("sha256", secret).update(body, "utf8").digest("hex");
    assert.equal(sig, expected);
    assert.ok(sig.startsWith("sha256="));
    // hex digest is 64 chars
    assert.equal(sig.slice("sha256=".length).length, 64);
  });

  it("is deterministic and secret-sensitive", () => {
    const body = "abc";
    assert.equal(signWebhookBody(body, "s1"), signWebhookBody(body, "s1"));
    assert.notEqual(signWebhookBody(body, "s1"), signWebhookBody(body, "s2"));
  });
});

describe("Fix 5 — deliverDeliberationWebhook: fires when configured", () => {
  beforeEach(() => {
    process.env.CROSS_DOMAIN_WEBHOOK_RETRY_MS = "1";
  });

  it("POSTs the payload to the configured URL with X-Forged-Signature and X-Forged-Event headers", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    const payload = basePayload();
    const result = await deliverDeliberationWebhook(
      payload,
      makeSupabase(webhookFlags()) as never
    );
    assert.equal(result.ok, true);
    assert.equal(result.attempted, true);
    assert.equal(result.status, 200);
    assert.equal(capturedUrl, "https://customer.example.com/forged-webhook");
    const headers = (capturedInit?.headers ?? {}) as Record<string, string>;
    assert.equal(headers["X-Forged-Event"], "deliberation.completed");
    // Signature is HMAC-SHA256 of the EXACT body sent.
    const sentBody = String(capturedInit?.body ?? "");
    assert.equal(
      headers["X-Forged-Signature"],
      signWebhookBody(sentBody, "shared-secret-123")
    );
    // Body round-trips the payload.
    const parsed = JSON.parse(sentBody);
    assert.equal(parsed.event, "deliberation.completed");
    assert.equal(parsed.deliberation_id, "delib-webhook-1");
    assert.equal(parsed.consensus_level, "majority_with_dissent");
  });
});

describe("Fix 5 — deliverDeliberationWebhook: no-op when not usefully configured", () => {
  beforeEach(() => {
    process.env.CROSS_DOMAIN_WEBHOOK_RETRY_MS = "1";
  });

  it("enabled:false → no fetch, ok:true attempted:false", async () => {
    let fetched = false;
    globalThis.fetch = (async () => {
      fetched = true;
      return new Response("ok", { status: 200 });
    }) as typeof fetch;
    const result = await deliverDeliberationWebhook(
      basePayload(),
      makeSupabase(webhookFlags({ enabled: false })) as never
    );
    assert.equal(result.ok, true);
    assert.equal(result.attempted, false);
    assert.equal(fetched, false);
  });

  it("empty url → no fetch, ok:true attempted:false", async () => {
    let fetched = false;
    globalThis.fetch = (async () => {
      fetched = true;
      return new Response("ok", { status: 200 });
    }) as typeof fetch;
    const result = await deliverDeliberationWebhook(
      basePayload(),
      makeSupabase(webhookFlags({ url: "" })) as never
    );
    assert.equal(result.ok, true);
    assert.equal(result.attempted, false);
    assert.equal(fetched, false);
  });

  it("no webhooks block at all → no fetch, ok:true attempted:false", async () => {
    let fetched = false;
    globalThis.fetch = (async () => {
      fetched = true;
      return new Response("ok", { status: 200 });
    }) as typeof fetch;
    const result = await deliverDeliberationWebhook(
      basePayload(),
      makeSupabase({ cross_domain_intelligence: true }) as never
    );
    assert.equal(result.ok, true);
    assert.equal(result.attempted, false);
    assert.equal(fetched, false);
  });

  it("no org_feature_flags row → no fetch, ok:true attempted:false", async () => {
    let fetched = false;
    globalThis.fetch = (async () => {
      fetched = true;
      return new Response("ok", { status: 200 });
    }) as typeof fetch;
    const result = await deliverDeliberationWebhook(
      basePayload(),
      makeSupabase(null) as never
    );
    assert.equal(result.ok, true);
    assert.equal(result.attempted, false);
    assert.equal(fetched, false);
  });
});

describe("Fix 5 — deliverDeliberationWebhook: retry semantics", () => {
  beforeEach(() => {
    process.env.CROSS_DOMAIN_WEBHOOK_RETRY_MS = "1";
  });

  it("5xx then 200 → retried once, ends ok", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      if (calls === 1) return new Response("err", { status: 503 });
      return new Response("ok", { status: 200 });
    }) as typeof fetch;
    const result = await deliverDeliberationWebhook(
      basePayload(),
      makeSupabase(webhookFlags()) as never
    );
    assert.equal(result.ok, true);
    assert.equal(result.status, 200);
    assert.equal(calls, 2, "must retry exactly once on 5xx");
  });

  it("5xx twice → abandoned after one retry, ok:false with error", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response("err", { status: 500 });
    }) as typeof fetch;
    const result = await deliverDeliberationWebhook(
      basePayload(),
      makeSupabase(webhookFlags()) as never
    );
    assert.equal(result.ok, false);
    assert.equal(result.attempted, true);
    assert.equal(result.status, 500);
    assert.ok(result.error && result.error.includes("500"));
    assert.equal(calls, 2, "initial + one retry, then abandon");
  });

  it("4xx → NOT retried, ok:false immediately", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response("bad", { status: 400 });
    }) as typeof fetch;
    const result = await deliverDeliberationWebhook(
      basePayload(),
      makeSupabase(webhookFlags()) as never
    );
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.equal(calls, 1, "4xx must NOT be retried");
  });

  it("thrown network error → NOT retried, ok:false with error, no throw", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      throw new TypeError("network down");
    }) as typeof fetch;
    const result = await deliverDeliberationWebhook(
      basePayload(),
      makeSupabase(webhookFlags()) as never
    );
    assert.equal(result.ok, false);
    assert.equal(calls, 1, "a thrown error is abandoned, not retried");
    assert.ok(result.error && result.error.includes("network down"));
  });
});
