// ============================================================
// Sprint 4 Polish 3 — Fix 5: deliberation-completed webhook delivery
//
// On a finalized deliberation, if the org has a webhook configured in
// org_feature_flags.feature_flags.webhooks.deliberation_completed,
// POST a compact signed payload to the registered URL. Lets downstream
// systems (CMMS, integrity-management software, customer integrations)
// react without polling.
//
// Design constraints (from the brief):
//   - HMAC-SHA256 sign the request body with the org's stored secret;
//     send as `X-Forged-Signature: sha256=<hex>`.
//   - Fire-and-forget w.r.t. the deliberation OUTCOME: the deliberation
//     row is already finalized before this runs. A webhook failure is
//     logged to arbitration_rules_applied.webhook_error by the
//     orchestrator wrapper but never fails the deliberation.
//   - ONE retry, ~5s after a 5xx. 4xx or a thrown network error →
//     abandon immediately (no retry). After two failures, give up.
//   - No retry queue — operationally simpler at this stage.
//
// NOTE: the webhook REGISTRATION endpoint is intentionally deferred
// (the brief permits this) — orgs set
// feature_flags.webhooks.deliberation_completed manually via SQL for
// now. Delivery is the part that matters for ASNT-demo storytelling.
// ============================================================

import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface WebhookConfig {
  url: string;
  secret: string;
  enabled: boolean;
}

export interface DeliberationWebhookPayload {
  event: "deliberation.completed";
  delivered_at: string;
  deliberation_id: string;
  org_id: string;
  anomaly_id: string;
  asset_id: string;
  consensus_level: string;
  escalated_to_human: boolean;
  recommended_action_tier: string | null;
  overall_consequence_tier: string | null;
  total_cost_usd: number;
  poll_url: string;
}

export interface WebhookDeliveryResult {
  ok: boolean;
  // false when no webhook is configured / it's disabled — that's a
  // normal no-op, NOT an error the orchestrator should log.
  attempted: boolean;
  status?: number;
  error?: string;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// 5s default per the brief; env-overridable so tests don't actually
// wait 5 seconds.
function webhookRetryDelayMs(): number {
  const env = Number(process.env.CROSS_DOMAIN_WEBHOOK_RETRY_MS);
  return Number.isFinite(env) && env >= 0 ? env : 5000;
}

// HMAC-SHA256 over the exact request body bytes. Exported so the
// (deferred) registration endpoint and tests can verify signatures.
export function signWebhookBody(body: string, secret: string): string {
  return (
    "sha256=" +
    createHmac("sha256", secret).update(body, "utf8").digest("hex")
  );
}

async function loadWebhookConfig(
  supabase: SupabaseClient,
  org_id: string
): Promise<WebhookConfig | null> {
  const { data } = await supabase
    .from("org_feature_flags")
    .select("feature_flags")
    .eq("org_id", org_id)
    .maybeSingle();
  if (!data) return null;
  const flags = ((data as Record<string, unknown>).feature_flags ??
    {}) as Record<string, unknown>;
  const webhooks = flags.webhooks as Record<string, unknown> | undefined;
  const cfg = webhooks?.deliberation_completed as
    | Record<string, unknown>
    | undefined;
  if (!cfg) return null;
  const url = typeof cfg.url === "string" ? cfg.url : "";
  const secret = typeof cfg.secret === "string" ? cfg.secret : "";
  const enabled = cfg.enabled === true;
  // A configured-but-disabled or url-less webhook is a deliberate
  // no-op, not an error.
  if (!url || !enabled) return null;
  return { url, secret, enabled };
}

export async function deliverDeliberationWebhook(
  payload: DeliberationWebhookPayload,
  supabase: SupabaseClient
): Promise<WebhookDeliveryResult> {
  let cfg: WebhookConfig | null;
  try {
    cfg = await loadWebhookConfig(supabase, payload.org_id);
  } catch (err) {
    return {
      ok: false,
      attempted: false,
      error: `webhook_config_load_failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
  if (!cfg) {
    // No webhook configured / disabled — normal no-op.
    return { ok: true, attempted: false };
  }

  const bodyStr = JSON.stringify(payload);
  const signature = signWebhookBody(bodyStr, cfg.secret);
  const retryMs = webhookRetryDelayMs();

  // Up to 2 attempts: initial + ONE retry, retry ONLY on 5xx.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(cfg.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forged-Signature": signature,
          "X-Forged-Event": payload.event,
        },
        body: bodyStr,
      });
      if (res.ok) {
        return { ok: true, attempted: true, status: res.status };
      }
      const is5xx = res.status >= 500 && res.status < 600;
      if (is5xx && attempt === 1) {
        console.warn(
          `[webhook ${payload.deliberation_id}] got ${res.status}; retrying once in ${retryMs}ms`
        );
        await sleep(retryMs);
        continue;
      }
      // 4xx (never retried) OR 5xx after the retry — abandon.
      return {
        ok: false,
        attempted: true,
        status: res.status,
        error: `webhook responded ${res.status}`,
      };
    } catch (err) {
      // Thrown network error. Per the brief, retry is for 5xx ONLY —
      // a throw is abandoned immediately.
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        attempted: true,
        error: `webhook post threw: ${message}`,
      };
    }
  }
  return {
    ok: false,
    attempted: true,
    error: "webhook delivery failed after one retry",
  };
}
