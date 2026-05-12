// ============================================================
// DEPLOY355 — Six AI specialist client skeletons
//
// Sprint 1: smoke-test ping behavior only. Each function returns
// a role confirmation and, if cost context is provided, writes a
// cost row to ai_cost_log with code_name prefix `cross_domain:<role>`.
//
// Sprint 2+ will swap in real fetch() calls to:
//   - Inspector:       Anthropic claude-sonnet-4-6
//   - Engineer:        Anthropic claude-opus-4-6  (extended_thinking 16000)
//   - Researcher:      Anthropic claude-sonnet-4-6 (web_search_20250305)
//   - Devil's Advocate: OpenAI gpt-5 (Responses API, reasoning.effort=high)
//   - Historian:       Anthropic claude-sonnet-4-6
//   - Synthesizer:     Anthropic claude-opus-4-6  (extended_thinking 32000)
//
// Existing repo uses raw fetch() for AI calls — no SDKs installed.
// Skeletons follow that pattern.
// ============================================================

import type {
  SpecialistOutput,
  SpecialistCallContext,
  SpecialistRole,
} from "./types";

interface SpecialistSpec {
  role: SpecialistRole;
  model: string;
  code_name: string;
  notes: string;
}

const SPECS: Record<SpecialistRole, SpecialistSpec> = {
  inspector: {
    role: "inspector",
    model: "claude-sonnet-4-6",
    code_name: "cross_domain:inspector",
    notes: "Anthropic — standard sonnet",
  },
  engineer: {
    role: "engineer",
    model: "claude-opus-4-6",
    code_name: "cross_domain:engineer",
    notes: "Anthropic — opus with extended_thinking budget 16000",
  },
  researcher: {
    role: "researcher",
    model: "claude-sonnet-4-6",
    code_name: "cross_domain:researcher",
    notes: "Anthropic — sonnet with web_search_20250305 tool",
  },
  devils_advocate: {
    role: "devils_advocate",
    model: "gpt-5",
    code_name: "cross_domain:devils_advocate",
    notes: "OpenAI Responses API — reasoning.effort=high",
  },
  historian: {
    role: "historian",
    model: "claude-sonnet-4-6",
    code_name: "cross_domain:historian",
    notes: "Anthropic — sonnet, no extended thinking",
  },
  synthesizer: {
    role: "synthesizer",
    model: "claude-opus-4-6",
    code_name: "cross_domain:synthesizer",
    notes: "Anthropic — opus with extended_thinking budget 32000",
  },
};

async function logCost(
  ctx: SpecialistCallContext | undefined,
  spec: SpecialistSpec,
  extra: Record<string, unknown> = {}
): Promise<void> {
  if (!ctx?.cost?.supabaseAdmin) return;
  const { orgId, supabaseAdmin } = ctx.cost;
  await supabaseAdmin.from("ai_cost_log").insert({
    org_id: orgId,
    code_name: spec.code_name,
    model: spec.model,
    input_tokens: 0,
    output_tokens: 0,
    cost_usd: 0,
    request_id: null,
    metadata: { smoke_test: true, role: spec.role, ...extra },
  });
}

async function ping(
  role: SpecialistRole,
  prompt: string,
  ctx?: SpecialistCallContext
): Promise<SpecialistOutput<{ ack: string; prompt_preview: string }>> {
  const spec = SPECS[role];
  const prompt_preview = (prompt || "").slice(0, 120);

  try {
    await logCost(ctx, spec, { prompt_chars: prompt?.length ?? 0 });
    return {
      role,
      model: spec.model,
      ok: true,
      result: {
        ack: `${role} skeleton online (${spec.notes})`,
        prompt_preview,
      },
      cost: {
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
        request_id: null,
        code_name: spec.code_name,
        smoke_test: true,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      role,
      model: spec.model,
      ok: false,
      result: { ack: "", prompt_preview },
      cost: {
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
        request_id: null,
        code_name: spec.code_name,
        smoke_test: true,
      },
      error: message,
    };
  }
}

export function callInspector(prompt: string, ctx?: SpecialistCallContext) {
  return ping("inspector", prompt, ctx);
}
export function callEngineer(prompt: string, ctx?: SpecialistCallContext) {
  return ping("engineer", prompt, ctx);
}
export function callResearcher(prompt: string, ctx?: SpecialistCallContext) {
  return ping("researcher", prompt, ctx);
}
export function callDevilsAdvocate(prompt: string, ctx?: SpecialistCallContext) {
  return ping("devils_advocate", prompt, ctx);
}
export function callHistorian(prompt: string, ctx?: SpecialistCallContext) {
  return ping("historian", prompt, ctx);
}
export function callSynthesizer(prompt: string, ctx?: SpecialistCallContext) {
  return ping("synthesizer", prompt, ctx);
}

export const SPECIALIST_SPECS = SPECS;
