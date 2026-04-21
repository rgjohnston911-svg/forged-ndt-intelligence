# DEPLOY220 — Decision State Machine + Unified Confidence + Conceptual Reasoning Engine

Replaces the DEPLOY216 decision-spine with a gated state machine that enforces physics sufficiency before any decision can be issued. Introduces unified confidence scoring that can never exceed physics coverage. Adds the Conceptual Reasoning Engine trace — the system's concept-thinking architecture.

## What changed from DEPLOY216

1. **Decision State Machine** — 5 states: `pending`, `blocked`, `provisional`, `advisory`, `authority_locked`. Physics coverage gates enforce minimum thresholds before decisions.
2. **Unified Confidence** — single composite score: `min(authority_confidence, physics_coverage) * ood_discount`. A case with 50% physics coverage can never show more than 50% confidence.
3. **Conceptual Reasoning Engine** — traces the 6-concept reasoning chain (Physical Reality → Damage Reality → Consequence Reality → Authority Reality → Sufficiency Reality → Decision Reality). This is the system thinking through engineering *concepts* in sequence, not matching keywords.
4. **Execution Mode** — function self-declares `deterministic` for audit trail transparency.

## Decision States

| State | Trigger | Meaning |
|-------|---------|---------|
| `pending` | Initial / no spine run yet | No decision issued |
| `blocked` | Physics coverage < 60% OR critical inputs missing | System refuses to issue any decision. UI shows exactly what data is missing. |
| `provisional` | Physics 60-85% OR OOD out-of-distribution OR awaiting authority lock | Decision issued with mandatory human review. Cannot be authority-locked. |
| `advisory` | AI-sourced findings present without measurement confirmation | Informational only. Not code-authoritative. |
| `authority_locked` | Physics >= 85%, authority lock executed, all gates pass | Final, immutable, signed. Regulatory-grade output. |

## Unified Confidence Formula

```
unified = min(authority_confidence, physics_coverage_fraction) * ood_discount

ood_discount:
  in_distribution     = 1.00
  marginal            = 0.75
  out_of_distribution = 0.50
  unknown             = 0.60
```

This fixes the GPT red-team finding: "confidence appears misaligned with physics coverage and OOD flags."

## Deploy order

### 1. Run migration
File: `DEPLOY220-migration.sql` in Supabase SQL Editor.
Adds: `decision_state`, `decision_state_reason`, `unified_confidence`, `confidence_components`, `conceptual_reasoning`, `decision_state_changed_at`.

### 2. Replace function
File: `netlify/functions/decision-spine.ts`
This is a **complete replacement** of the DEPLOY216 version. Paste over the existing file.

### 3. Replace component
File: `src/components/DecisionSpineCard.tsx`
This is a **complete replacement** of the DEPLOY216 version. Paste over the existing file.

No new imports needed in CaseDetail.tsx — it already mounts `<DecisionSpineCard caseId={id} />`.

---

## Smoke test on the riser case

1. Open NDT-1776299065297 (the riser with test evidence).
2. Decision tab → Decision Spine → **Run spine**.
3. Expected results:
   - **Decision State: PROVISIONAL** (physics coverage is ~50% because only wall thickness check is runnable out of 2 required; crack FFS check has missing inputs)
   - **Unified Confidence: ~30%** (authority 98% x physics 50% = 50%, then x OOD discount)
   - **Conceptual Reasoning Engine**: expandable trace showing all 6 concepts with status badges
   - **Confidence breakdown**: clickable, shows authority × physics × OOD components
   - The old DEPLOY216 showed 98% confidence with 50% physics — that's now impossible

---

## Handoff to DEPLOY222 (Universal Code Authority Engine)

The decision state machine is designed to receive input from the authority precedence engine described in `Universal_Code_Authority_Engine_v1.docx`. The integration points are:

- `resolveDecisionState()` checks `caseRow.authority_locked` — DEPLOY222 will feed the lock signal
- The `authority` section of the bundle records disposition, confidence, and lock status — DEPLOY222 will populate these with tiered precedence resolution
- The 5-tier hierarchy (Regulatory > Jurisdictional > Industry Code > Owner Specs > Best Practice) maps to the `gate_detail` object in the state machine output
- Conflict resolution outcomes from DEPLOY222 flow into the synthesis narrative

No changes to DEPLOY220 files will be needed when DEPLOY222 is built. The state machine is already wired to consume authority output.

---

## Architecture

- State machine is deterministic (no LLM calls, no randomness)
- All thresholds are configurable constants at the top of the file
- Conceptual Reasoning Engine maps available evidence to 6 concept layers regardless of whether decision-core has run
- Bundle hash covers the entire output including state, confidence components, and concept trace
- Backward compatible: if DEPLOY220 columns don't exist yet, the function still runs (update just won't persist the new fields)
