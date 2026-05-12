import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checkOrgBudget,
  recordSpend,
  DEFAULT_DAILY_CAP_USD,
  DEFAULT_PER_DELIBERATION_CAP_USD,
} from "../budgetGuard";
import { makeMockSupabase } from "./fixtures";

const ORG = "33333333-3333-3333-3333-333333333333";
const NOW = Date.now();
const HOURS_AGO = (h: number) =>
  new Date(NOW - h * 60 * 60 * 1000).toISOString();

describe("checkOrgBudget — caps resolution", () => {
  it("returns defaults when org has no flags row", async () => {
    const supabase = makeMockSupabase({
      org_feature_flags: [],
      ai_cost_log: [],
    });
    const r = await checkOrgBudget(supabase as never, ORG);
    assert.equal(r.daily_cap_usd, DEFAULT_DAILY_CAP_USD);
    assert.equal(r.per_deliberation_cap_usd, DEFAULT_PER_DELIBERATION_CAP_USD);
    assert.equal(r.ok, true);
  });

  it("returns defaults when org_feature_flags row exists but has no cross_domain block", async () => {
    const supabase = makeMockSupabase({
      org_feature_flags: [
        { org_id: ORG, feature_flags: { other_feature: true } },
      ],
      ai_cost_log: [],
    });
    const r = await checkOrgBudget(supabase as never, ORG);
    assert.equal(r.daily_cap_usd, DEFAULT_DAILY_CAP_USD);
    assert.equal(r.per_deliberation_cap_usd, DEFAULT_PER_DELIBERATION_CAP_USD);
  });

  it("uses custom caps from org_feature_flags.cross_domain", async () => {
    const supabase = makeMockSupabase({
      org_feature_flags: [
        {
          org_id: ORG,
          feature_flags: {
            cross_domain: {
              daily_cap_usd: 200,
              per_deliberation_cap_usd: 25,
            },
          },
        },
      ],
      ai_cost_log: [],
    });
    const r = await checkOrgBudget(supabase as never, ORG);
    assert.equal(r.daily_cap_usd, 200);
    assert.equal(r.per_deliberation_cap_usd, 25);
  });
});

describe("checkOrgBudget — daily spend + projection", () => {
  it("ok:true when daily_spent + projected_deliberation fits under cap", async () => {
    const supabase = makeMockSupabase({
      org_feature_flags: [
        {
          org_id: ORG,
          feature_flags: { cross_domain: { daily_cap_usd: 50, per_deliberation_cap_usd: 15 } },
        },
      ],
      ai_cost_log: [
        // $20 already spent within 24h ← 20 + 15 = 35 < 50
        { org_id: ORG, code_name: "cross_domain:inspector", cost_usd: 10, created_at: HOURS_AGO(2) },
        { org_id: ORG, code_name: "cross_domain:engineer", cost_usd: 10, created_at: HOURS_AGO(5) },
      ],
    });
    const r = await checkOrgBudget(supabase as never, ORG);
    assert.equal(r.ok, true);
    assert.equal(r.daily_spent_usd, 20);
    assert.equal(r.reason, undefined);
  });

  it("ok:false with org_daily_cap_exceeded when projection would breach cap", async () => {
    const supabase = makeMockSupabase({
      org_feature_flags: [
        {
          org_id: ORG,
          feature_flags: { cross_domain: { daily_cap_usd: 50, per_deliberation_cap_usd: 15 } },
        },
      ],
      ai_cost_log: [
        // $40 already spent → 40 + 15 = 55 > 50
        { org_id: ORG, code_name: "cross_domain:engineer", cost_usd: 40, created_at: HOURS_AGO(2) },
      ],
    });
    const r = await checkOrgBudget(supabase as never, ORG);
    assert.equal(r.ok, false);
    assert.equal(r.reason, "org_daily_cap_exceeded");
    assert.equal(r.daily_spent_usd, 40);
  });

  it("excludes rows older than 24h from daily sum", async () => {
    const supabase = makeMockSupabase({
      org_feature_flags: [
        {
          org_id: ORG,
          feature_flags: { cross_domain: { daily_cap_usd: 50, per_deliberation_cap_usd: 15 } },
        },
      ],
      ai_cost_log: [
        // 36h ago → excluded
        { org_id: ORG, code_name: "cross_domain:engineer", cost_usd: 999, created_at: HOURS_AGO(36) },
        // 6h ago → included
        { org_id: ORG, code_name: "cross_domain:inspector", cost_usd: 5, created_at: HOURS_AGO(6) },
      ],
    });
    const r = await checkOrgBudget(supabase as never, ORG);
    assert.equal(r.daily_spent_usd, 5);
    assert.equal(r.ok, true);
  });

  it("only counts code_name LIKE 'cross_domain:%' — unrelated rows ignored", async () => {
    const supabase = makeMockSupabase({
      org_feature_flags: [
        {
          org_id: ORG,
          feature_flags: { cross_domain: { daily_cap_usd: 50, per_deliberation_cap_usd: 15 } },
        },
      ],
      ai_cost_log: [
        { org_id: ORG, code_name: "tri_model:opus", cost_usd: 100, created_at: HOURS_AGO(1) },
        { org_id: ORG, code_name: "cross_domain:inspector", cost_usd: 3, created_at: HOURS_AGO(1) },
      ],
    });
    const r = await checkOrgBudget(supabase as never, ORG);
    assert.equal(r.daily_spent_usd, 3);
    assert.equal(r.ok, true);
  });

  it("only sums rows for the given org_id", async () => {
    const otherOrg = "ffffffff-ffff-ffff-ffff-ffffffffffff";
    const supabase = makeMockSupabase({
      org_feature_flags: [
        {
          org_id: ORG,
          feature_flags: { cross_domain: { daily_cap_usd: 50, per_deliberation_cap_usd: 15 } },
        },
      ],
      ai_cost_log: [
        { org_id: otherOrg, code_name: "cross_domain:engineer", cost_usd: 999, created_at: HOURS_AGO(1) },
        { org_id: ORG, code_name: "cross_domain:engineer", cost_usd: 4, created_at: HOURS_AGO(1) },
      ],
    });
    const r = await checkOrgBudget(supabase as never, ORG);
    assert.equal(r.daily_spent_usd, 4);
  });
});

describe("recordSpend", () => {
  it("writes an audit row with cost_usd=0 (avoiding double-count) and total in metadata", async () => {
    const supabase = makeMockSupabase({ ai_cost_log: [] });
    await recordSpend(supabase as never, ORG, "delib-123", 7.42);

    const rows = supabase.__store.ai_cost_log;
    assert.equal(rows.length, 1);
    const row = rows[0] as Record<string, unknown>;
    assert.equal(row.code_name, "cross_domain:deliberation_total");
    assert.equal(row.cost_usd, 0);
    assert.equal(row.org_id, ORG);
    const md = row.metadata as Record<string, unknown>;
    assert.equal(md.deliberation_id, "delib-123");
    assert.equal(md.deliberation_total_usd, 7.42);
    assert.equal(md.audit_only, true);
  });
});
