import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  callInspector,
  callEngineer,
  callResearcher,
  callDevilsAdvocate,
  callHistorian,
  callSynthesizer,
  SPECIALIST_SPECS,
} from "../aiSpecialists";
import { makeMockSupabase } from "./fixtures";

const ORG = "22222222-2222-2222-2222-222222222222";

const ROLES = [
  ["inspector", callInspector, "claude-sonnet-4-6", "cross_domain:inspector"],
  ["engineer", callEngineer, "claude-opus-4-6", "cross_domain:engineer"],
  ["researcher", callResearcher, "claude-sonnet-4-6", "cross_domain:researcher"],
  ["devils_advocate", callDevilsAdvocate, "gpt-5", "cross_domain:devils_advocate"],
  ["historian", callHistorian, "claude-sonnet-4-6", "cross_domain:historian"],
  ["synthesizer", callSynthesizer, "claude-opus-4-6", "cross_domain:synthesizer"],
] as const;

describe("AI specialist skeletons — ping behavior", () => {
  for (const [role, fn, expectedModel, expectedCode] of ROLES) {
    it(`${role}: returns ok with correct model + code_name`, async () => {
      const out = await fn(`test prompt for ${role}`);
      assert.equal(out.ok, true);
      assert.equal(out.role, role);
      assert.equal(out.model, expectedModel);
      assert.equal(out.cost.code_name, expectedCode);
      assert.equal(out.cost.smoke_test, true);
      assert.ok(out.result.ack.includes(role), `ack should mention role ${role}`);
    });
  }
});

describe("AI specialist skeletons — cost row write", () => {
  it("inserts an ai_cost_log row when cost context is provided", async () => {
    const supabase = makeMockSupabase({ ai_cost_log: [] });
    const out = await callInspector("hello inspector", {
      cost: { orgId: ORG, supabaseAdmin: supabase as never },
    });
    assert.equal(out.ok, true);
    const rows = supabase.__store.ai_cost_log;
    assert.equal(rows.length, 1);
    const row = rows[0] as Record<string, unknown>;
    assert.equal(row.code_name, "cross_domain:inspector");
    assert.equal(row.model, "claude-sonnet-4-6");
    assert.equal(row.org_id, ORG);
    assert.equal((row.metadata as { smoke_test: boolean }).smoke_test, true);
  });

  it("writes a row for every specialist when cost ctx is provided", async () => {
    const supabase = makeMockSupabase({ ai_cost_log: [] });
    const ctx = { cost: { orgId: ORG, supabaseAdmin: supabase as never } };
    await callInspector("p", ctx);
    await callEngineer("p", ctx);
    await callResearcher("p", ctx);
    await callDevilsAdvocate("p", ctx);
    await callHistorian("p", ctx);
    await callSynthesizer("p", ctx);

    const rows = supabase.__store.ai_cost_log;
    assert.equal(rows.length, 6);
    const codeNames = rows.map((r) => (r as Record<string, unknown>).code_name);
    assert.deepEqual(codeNames, [
      "cross_domain:inspector",
      "cross_domain:engineer",
      "cross_domain:researcher",
      "cross_domain:devils_advocate",
      "cross_domain:historian",
      "cross_domain:synthesizer",
    ]);
  });

  it("does not write when no cost context is provided", async () => {
    const supabase = makeMockSupabase({ ai_cost_log: [] });
    await callInspector("hello");
    assert.equal(supabase.__store.ai_cost_log.length, 0);
  });
});

describe("SPECIALIST_SPECS", () => {
  it("covers all six roles", () => {
    assert.deepEqual(
      Object.keys(SPECIALIST_SPECS).sort(),
      ["devils_advocate", "engineer", "historian", "inspector", "researcher", "synthesizer"]
    );
  });
});
