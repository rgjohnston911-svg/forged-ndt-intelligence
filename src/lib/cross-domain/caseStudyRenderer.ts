// ============================================================
// Sprint 5 Phase B — Case Study Renderer
//
// Pure-function module: takes the rows assembled by the case-study
// endpoint and emits the code-first / why / how teaching artifact as
// markdown. Zero IO; zero AI inference; deterministic and replayable.
// Every byte of output is traceable to either a column the platform
// wrote during deliberation OR a literal regex extraction from the
// Synthesizer's own prose — preserving the audit trail that is the
// reason the case study exists in the first place.
// ============================================================

import type {
  SpecialistAnalysis,
  RecommendedActionTier,
  ConsequenceTier,
} from "./types";

// ------------------------------------------------------------
// Shapes (subset projections of the underlying tables — only the
// columns the renderer actually reads).
// ------------------------------------------------------------

export interface CaseStudyAsset {
  id: string;
  asset_name: string;
  domain: string;
  criticality: string;
  location_description: string | null;
}

export interface CaseStudyAnomaly {
  id: string;
  anomaly_type: string | null;
  severity: string;
  description: string;
  domain: string | null;
}

export interface CaseStudyEvidence {
  id: string;
  evidence_type: string;
  raw_text: string | null;
}

export interface CaseStudyConsequence {
  recommended_action_tier: RecommendedActionTier;
  overall_tier: ConsequenceTier;
  total_confidence: number;
  time_to_consequence_days: number | null;
}

export interface CaseStudyDeliberation {
  id: string;
  org_id: string;
  finding_id: string | null;
  deliberation_started_at: string | null;
  deliberation_completed_at: string | null;
  specialist_outputs: SpecialistAnalysis[];
  synthesizer_decision: SpecialistAnalysis | null;
  arbitration_rules_applied: Record<string, unknown> | null;
  consensus_level: string | null;
  total_cost_usd: number;
}

export interface CaseStudyData {
  deliberation: CaseStudyDeliberation;
  asset: CaseStudyAsset;
  anomaly: CaseStudyAnomaly;
  // Indexed by evidence.id for fast per-claim lookup.
  evidenceById: Map<string, CaseStudyEvidence>;
  // Latest consequence assessment if any, else null (e.g., engine
  // errored or pre-Sprint-4C deliberation).
  consequence: CaseStudyConsequence | null;
  // ISO timestamp of case-study generation (NOT of deliberation).
  generatedAt: string;
}

// ------------------------------------------------------------
// Standards extraction — regex-only, no AI re-inference.
//
// The Synthesizer's system prompt mandates leading the summary with
// authority-code citation (see aiSpecialists.ts:1063-1070). We extract
// the standard name + immediate identifier and (separately) quote the
// containing sentence so the reader sees both the code and its context
// without us having to parse the section/clause structure (which is
// brittle across Roman numerals, section symbols, and language).
// ------------------------------------------------------------

// The authority list comes from the Synthesizer prompt's enumeration:
// "API, ASME, NACE, ASNT, DNV, PHMSA, BSEE, CFR, ISO, IMCA, ABS" plus
// AWS (called out separately in the Sprint 4 prompts) and DNV-RP (a
// common compound prefix on offshore standards).
const AUTHORITY_PREFIX_RE =
  /\b(?:API|ASME|NACE|ASNT|DNV-RP|DNV|PHMSA|BSEE|CFR|ISO|IMCA|ABS|AWS)\b/g;

// After matching a prefix, greedily consume the immediate identifier:
// digits, hyphens, dots, letters (e.g., "579-1", "MR0175", "RP-F101",
// "D1.1", "B31.4", "VIII"). Stops at whitespace outside the identifier
// so we don't drift into prose. Slash is intentionally NOT in the char
// class so compound phrases like "API 579-1/ASME FFS-1" yield TWO
// separate standards rather than one slash-joined blob.
const IDENTIFIER_TAIL_RE = /^[-\s]?[A-Z0-9.-]{1,40}/;

export interface ExtractedStandard {
  raw_match: string; // e.g., "API 579-1" or "DNV-RP-F101"
  context_sentence: string;
}

export function extractStandards(text: string): ExtractedStandard[] {
  if (!text) return [];
  const found = new Map<string, ExtractedStandard>(); // dedupe by raw_match
  const sentences = splitIntoSentences(text);
  for (const sentence of sentences) {
    const matches = sentence.matchAll(AUTHORITY_PREFIX_RE);
    for (const m of matches) {
      const prefix = m[0];
      const matchStart = m.index ?? 0;
      const rest = sentence.slice(matchStart + prefix.length);
      const tail = rest.match(IDENTIFIER_TAIL_RE);
      // Slice the source verbatim from prefix-start through end-of-tail
      // so the separator between prefix and identifier (hyphen vs space)
      // is preserved exactly as the model wrote it.
      const raw_match = tail
        ? sentence
            .slice(matchStart, matchStart + prefix.length + tail[0].length)
            .trim()
        : prefix;
      if (!found.has(raw_match)) {
        found.set(raw_match, {
          raw_match,
          context_sentence: sentence.trim(),
        });
      }
    }
  }
  return Array.from(found.values());
}

// Split on sentence-ending punctuation while keeping the punctuation.
// Defensive against the Synthesizer's habit of using em-dashes,
// semicolons, and parenthetical asides — we use a conservative split
// that errs on the side of keeping context together.
function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ------------------------------------------------------------
// Recommended-action-tier extraction from Synthesizer prose.
// Used as fallback when no cd_anomaly_consequence_assessments row
// exists (consequence engine errored, or pre-Sprint-4C chain).
// ------------------------------------------------------------

// The Synthesizer prompt mandates "Recommended action: <tier>" in the
// summary's HOW paragraph. The tier vocabulary is fixed by the
// RecommendedActionTier type.
const ACTION_TIER_VALUES: RecommendedActionTier[] = [
  "monitor",
  "engineering_review",
  "urgent_assessment",
  "immediate_remediation",
  "cease_operation",
];

export function extractRecommendedActionFromSummary(
  text: string
): RecommendedActionTier | null {
  if (!text) return null;
  // Match "Recommended action: <tier>" case-insensitively, tolerating
  // markdown bold (**Recommended action:**) and minor punctuation drift.
  const m = text.match(
    /recommended\s+action\s*[:\-—]?\s*\*{0,2}([a-z_]+)\*{0,2}/i
  );
  if (!m) return null;
  const candidate = m[1].toLowerCase().replace(/[^a-z_]/g, "");
  if ((ACTION_TIER_VALUES as string[]).includes(candidate)) {
    return candidate as RecommendedActionTier;
  }
  return null;
}

// ------------------------------------------------------------
// Prior-case reference extraction from Historian output.
//
// The Historian prompt instructs the model to name prior cases by
// deliberation ID ("Case e9953ca4-..."). Some outputs use the full UUID,
// some use the 8-char prefix. We accept both.
// ------------------------------------------------------------

const CASE_REF_RE =
  /\bCase\s+([0-9a-f]{8}(?:-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?)\b/gi;

export function extractPriorCaseRefs(historian: SpecialistAnalysis | null): {
  case_ids: string[];
  context_by_id: Map<string, string>;
} {
  const case_ids: string[] = [];
  const context_by_id = new Map<string, string>();
  if (!historian) return { case_ids, context_by_id };
  // Walk summary + each claim text. Preserve insertion order, dedupe.
  const sources: string[] = [historian.summary];
  for (const c of historian.claims ?? []) sources.push(c.text);
  for (const src of sources) {
    if (!src) continue;
    const matches = src.matchAll(CASE_REF_RE);
    for (const m of matches) {
      const id = m[1];
      if (!case_ids.includes(id)) {
        case_ids.push(id);
        // Capture the sentence containing this match for context.
        const sentence =
          splitIntoSentences(src).find((s) => s.includes(m[0])) ?? "";
        context_by_id.set(id, sentence);
      }
    }
  }
  return { case_ids, context_by_id };
}

// ------------------------------------------------------------
// Markdown rendering
// ------------------------------------------------------------

const TRUNCATED_CLAIM_TEXT_LEN = 60;
const EVIDENCE_EXCERPT_LEN = 200;

export function renderCaseStudyMarkdown(data: CaseStudyData): string {
  const { deliberation: d, asset, anomaly, evidenceById, consequence } = data;
  const synth = d.synthesizer_decision;
  const arb = (d.arbitration_rules_applied ?? {}) as Record<string, unknown>;
  const final_status =
    typeof arb.final_status === "string" ? arb.final_status : "unknown";
  const webhook_status =
    typeof arb.webhook_status === "number" ||
    typeof arb.webhook_status === "string"
      ? String(arb.webhook_status)
      : "n/a";

  const failed =
    final_status === "failed" ||
    d.consensus_level === "unresolved" ||
    typeof (arb as { error?: unknown }).error === "string";

  const lines: string[] = [];

  // ---- Title + frontmatter ----
  lines.push(
    `# Case Study: ${asset.asset_name} — ${anomaly.anomaly_type ?? "Unknown anomaly type"}`
  );
  lines.push("");
  if (failed) {
    lines.push(
      "> **STATUS: FAILED.** This deliberation did not reach consensus or aborted before the chain completed. The case study below preserves the chain's reasoning up to the failure point as an audit artifact."
    );
    lines.push("");
  }
  lines.push(`**Deliberation ID:** ${d.id}`);
  lines.push(`**Domain:** ${anomaly.domain ?? asset.domain}`);
  lines.push(`**Severity:** ${anomaly.severity}`);
  lines.push(`**Consensus level:** ${d.consensus_level ?? "n/a"}`);
  lines.push(`**Final status:** ${final_status}`);
  lines.push(`**Generated:** ${data.generatedAt}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // ---- Summary ----
  lines.push("## Summary");
  lines.push("");
  if (synth?.summary) {
    lines.push(synth.summary);
  } else {
    lines.push(
      "_No synthesizer summary available — synthesizer did not complete._"
    );
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  // ---- What the codes say (CODE FIRST) ----
  lines.push("## What the codes say (CODE FIRST)");
  lines.push("");
  const standards = synth?.summary ? extractStandards(synth.summary) : [];
  if (standards.length > 0) {
    for (const s of standards) {
      lines.push(`- **${s.raw_match}**`);
      lines.push(`  - Context: ${s.context_sentence}`);
    }
  } else if (synth?.cited_mechanisms && synth.cited_mechanisms.length > 0) {
    lines.push(
      "_No authority codes parsed from summary; falling back to cited mechanisms:_"
    );
    for (const m of synth.cited_mechanisms) lines.push(`- ${m}`);
  } else {
    lines.push("_No standards or mechanisms cited._");
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  // ---- Why ----
  lines.push("## Why (WHY)");
  lines.push("");
  if (synth?.claims && synth.claims.length > 0) {
    const sorted = [...synth.claims].sort((a, b) => b.confidence - a.confidence);
    for (const claim of sorted) {
      const head = truncate(claim.text, TRUNCATED_CLAIM_TEXT_LEN);
      lines.push(`### Claim (${formatConfidence(claim.confidence)}): ${head}`);
      lines.push("");
      lines.push(claim.text);
      lines.push("");
      if (claim.cited_mechanism_codes.length > 0) {
        lines.push(
          `- **Mechanisms cited:** ${claim.cited_mechanism_codes.join(", ")}`
        );
      }
      if (claim.supporting_evidence_ids.length > 0) {
        lines.push(`- **Supporting evidence:**`);
        for (const eid of claim.supporting_evidence_ids) {
          const ev = evidenceById.get(eid);
          if (!ev) {
            lines.push(
              `  - \`${eid}\` — _evidence row not found (may have been deleted or belongs to a different anomaly)_`
            );
            continue;
          }
          const excerpt = truncate(
            (ev.raw_text ?? "").replace(/\s+/g, " ").trim(),
            EVIDENCE_EXCERPT_LEN
          );
          lines.push(`  - **[${ev.evidence_type}]** ${excerpt}`);
        }
      }
      lines.push("");
    }
  } else {
    lines.push(
      "_Synthesizer produced no structured claims (parse failure or chain aborted before synthesis)._"
    );
    lines.push("");
  }
  lines.push("---");
  lines.push("");

  // ---- What to do about it (HOW) ----
  lines.push("## What to do about it (HOW)");
  lines.push("");
  const actionTier =
    consequence?.recommended_action_tier ??
    (synth?.summary
      ? extractRecommendedActionFromSummary(synth.summary)
      : null);
  if (actionTier) {
    lines.push(`**Recommended action tier:** ${actionTier.toUpperCase()}`);
    if (consequence) {
      lines.push(
        `**Overall consequence tier:** ${consequence.overall_tier.toUpperCase()}`
      );
      lines.push(
        `**Total confidence:** ${(consequence.total_confidence * 100).toFixed(0)}%`
      );
      if (consequence.time_to_consequence_days != null) {
        lines.push(
          `**Time to consequence:** ~${consequence.time_to_consequence_days} days`
        );
      }
    }
  } else {
    lines.push(
      "**Recommended action tier:** _Not derivable from deliberation — see synthesizer narrative below._"
    );
  }
  lines.push("");
  if (synth?.open_questions && synth.open_questions.length > 0) {
    lines.push("**Open questions:**");
    lines.push("");
    for (const q of synth.open_questions) lines.push(`- ${q}`);
    lines.push("");
  }
  lines.push("---");
  lines.push("");

  // ---- Prior cases (HISTORICAL CONTEXT) ----
  lines.push("## Prior cases (HISTORICAL CONTEXT)");
  lines.push("");
  const historian =
    d.specialist_outputs.find((o) => o.role === "historian") ?? null;
  const priors = extractPriorCaseRefs(historian);
  if (priors.case_ids.length > 0) {
    for (const id of priors.case_ids.slice(0, 3)) {
      lines.push(`- **Case ${id}**`);
      const ctx = priors.context_by_id.get(id);
      if (ctx) lines.push(`  - Context: ${ctx}`);
    }
  } else {
    lines.push(
      "_No analogous prior cases in tenant memory — this is the first deliberation of its kind, or the Historian found no semantically similar prior reasoning._"
    );
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  // ---- Audit trail (APPENDIX) ----
  lines.push("## Audit trail (APPENDIX)");
  lines.push("");
  lines.push("**Deliberation metadata:**");
  lines.push("");
  lines.push(`- ID: \`${d.id}\``);
  lines.push(`- Asset ID: \`${asset.id}\``);
  lines.push(`- Anomaly ID: \`${anomaly.id}\``);
  lines.push(`- Started: ${d.deliberation_started_at ?? "n/a"}`);
  lines.push(`- Completed: ${d.deliberation_completed_at ?? "n/a"}`);
  lines.push(`- Duration: ${formatDuration(d)}`);
  lines.push(`- Total cost: $${(d.total_cost_usd ?? 0).toFixed(4)}`);
  lines.push("");
  lines.push("**Specialist outputs (in deliberation order):**");
  lines.push("");
  for (const sp of d.specialist_outputs) {
    lines.push(
      `- **${sp.role}** (${sp.model}): ${sp.attempts} attempt(s), $${(sp.cost_usd ?? 0).toFixed(4)}, ${sp.latency_ms}ms${sp.parse_error ? ` — parse_error: ${sp.parse_error}` : ""}`
    );
  }
  lines.push("");
  if (synth?.cited_evidence && synth.cited_evidence.length > 0) {
    lines.push("**Cited evidence:**");
    lines.push("");
    for (const eid of synth.cited_evidence) lines.push(`- \`${eid}\``);
    lines.push("");
  }
  if (synth?.cited_mechanisms && synth.cited_mechanisms.length > 0) {
    lines.push("**Cited mechanisms:**");
    lines.push("");
    for (const m of synth.cited_mechanisms) lines.push(`- ${m}`);
    lines.push("");
  }
  lines.push(`**Consensus level:** ${d.consensus_level ?? "n/a"}`);
  lines.push(`**Final status:** ${final_status}`);
  lines.push(`**Webhook status:** ${webhook_status}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(
    "*Generated by FORGED 4D NDT Cross-Domain Intelligence Platform. This case study is a literal representation of the deliberation chain's output and audit trail — no AI-generated interpretation beyond what the platform produced during deliberation.*"
  );

  return lines.join("\n");
}

function truncate(text: string, n: number): string {
  if (!text) return "";
  return text.length <= n ? text : `${text.slice(0, n).trimEnd()}…`;
}

function formatConfidence(c: number): string {
  return c.toFixed(2);
}

function formatDuration(d: CaseStudyDeliberation): string {
  if (!d.deliberation_started_at || !d.deliberation_completed_at) return "n/a";
  const start = Date.parse(d.deliberation_started_at);
  const end = Date.parse(d.deliberation_completed_at);
  if (Number.isNaN(start) || Number.isNaN(end)) return "n/a";
  const ms = Math.max(0, end - start);
  const seconds = Math.round(ms / 1000);
  return `${seconds}s`;
}

// Constant exported for tests to assert ordering / section structure.
export const SECTION_HEADERS = [
  "## Summary",
  "## What the codes say (CODE FIRST)",
  "## Why (WHY)",
  "## What to do about it (HOW)",
  "## Prior cases (HISTORICAL CONTEXT)",
  "## Audit trail (APPENDIX)",
] as const;

// Also surface for downstream module discrimination of cold-start.
export const NO_PRIOR_CASES_STRING =
  "_No analogous prior cases in tenant memory — this is the first deliberation of its kind, or the Historian found no semantically similar prior reasoning._";

