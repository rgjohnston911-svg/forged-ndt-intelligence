# DEPLOY367: SA Build Stage 7 — Stakeholder Reality Engine (L9.1)

## What This Does
Adds the **Stakeholder Reality Engine** — Stage 7 of the FORGED SA Build Brief. It extends the platform's 6 deterministic role projections to **9** by adding `RELIABILITY`, `FINANCIAL`, and `LEGAL`, and emits one typed `StakeholderRealityView` per role from the **frozen DecisionPackage** plus the L9.0 `ValidatedEvidenceSet`.

This is a **pure deterministic projection**. Same inputs → byte-identical output. It reads the package; it never writes back, never adds a field to the DecisionPackage, and imports nothing from `decision-core` or any L0–L8 engine.

## Why It Is Safe (read before committing)
- **No callers.** Stage 7 ships the module and its test only. Nothing in the live request path calls `projectStakeholders()` yet, so the platform's behavior is unchanged.
- **Pre-SA path is bit-identical.** With `sa_responses` absent, no SA code runs at all.
- **Fully revertable.** Deleting the two new files returns the repo to the DEPLOY366 state.
- **Patent / determinism invariants honored:** DecisionPackage is read-only (Directive 3); no field added to it (Directive 4); FINANCIAL/LEGAL signals come **only** from validated, user-provided evidence and the authority chain — never LLM-inferred (Claim 1(ix)); no clock is read inside the module.

## Files in This Deploy

### 1. NEW — `netlify/functions/situational-awareness-stakeholder.cjs`
The L9.1 engine. Pure JS (`var` only, string concatenation only, no template literals, no arrow functions, `module.exports`). Exports `projectStakeholders(decisionPackage, validatedEvidenceSet)` returning a `StakeholderRealityView[]` in the fixed role order: `INSPECTOR, ENGINEER, TECHNICIAN, OPS_MANAGER, SAFETY, STUDENT, RELIABILITY, FINANCIAL, LEGAL`.

### 2. NEW — `netlify/functions/situational-awareness-stakeholder.test.cjs`
The Stage 7 acceptance gate: a pure-function determinism + projection-correctness suite.

**No other files change.**

## `StakeholderRealityView` shape (per role)
```
{
  role:                        "INSPECTOR|ENGINEER|...|RELIABILITY|FINANCIAL|LEGAL",
  position:                    "<canonical position statement>",
  evidence_basis:              [ <EvidenceEntry from ValidatedEvidenceSet>, ... ],
  confidence:                  <0-1, 2-dp>,
  what_they_want:              "CONTINUE|DERATE|SHUTDOWN|MORE_DATA|N/A",
  what_they_fear:              "<string>",
  decision_contamination_risk: "LOW|MEDIUM|HIGH"
}
```

## Deterministic projection rules (summary)
- **Baseline stance** from disposition: REJECT/REPORT/HALT/REPAIR → `SHUTDOWN`; HOLD/REINSPECT/FFS-2/FFS-3 → `MORE_DATA`; ACCEPT(/WITH_MONITORING) → `CONTINUE`.
- **SAFETY** leans `SHUTDOWN` on any active hard lock, shutdown disposition, or base confidence < 0.60. Conservative bias is **not** flagged as contamination (LOW).
- **OPS_MANAGER** aligns to a mandated SHUTDOWN (hard lock / REJECT / report / halt) but is flagged `MEDIUM`; on an un-mandated REPAIR it pulls toward `CONTINUE` and is flagged `HIGH` (production pressure).
- **FINANCIAL** is sourced **only** from validated financial inputs. With none present: `what_they_want = N/A`, `confidence = 0`. With inputs present, cost-avoidance pressure pulls toward `CONTINUE` against a shutdown call and is flagged HIGH/MEDIUM.
- **LEGAL** keys off the authority chain: full confidence when binding clauses exist, halved when none; wants `SHUTDOWN` when a jurisdictional report is required.
- **RELIABILITY** wants `MORE_DATA` when FMD margin < 0.15 or no L4 timeline exists.
- Each **unresolved CRITICAL** question lowers shared role confidence by 0.10 (floored at 0).

## Deploy Steps

### Step 0 (MANDATORY) — pull first
Before pasting anything into the GitHub web editor, run **Ctrl+F → "git pull"** on your local clone (or pull in the GitHub Desktop / web flow) so you are committing on top of the current `main`. This avoids clobbering DEPLOY366.

### Step 1 — Add the engine
Create `netlify/functions/situational-awareness-stakeholder.cjs` with the file in this deploy. Commit.

### Step 2 — Add the test
Create `netlify/functions/situational-awareness-stakeholder.test.cjs`. Commit.

### Step 3 — No wiring
Do **not** add any caller. Stage 8 (Conflict Detection) and Stage 9 (Executive Brief) consume these views later; Stage 11 assembles the `SituationalAwarenessPackage`.

## Acceptance Gate (run locally)
```
node netlify/functions/situational-awareness-stakeholder.test.cjs
```
Expected output:
```
All Stage 7 stakeholder-projection checks passed (9 roles, deterministic).
```
The suite asserts: exactly 9 roles in fixed order; every view carries the full typed contract; **byte-identical output on repeat calls and under input key-order permutation** (the pure-function determinism gate); SAFETY/OPS/FINANCIAL/LEGAL/RELIABILITY projection rules; and graceful handling of a null `ValidatedEvidenceSet` (pre-SA path).

Optional structural check (should print nothing — proves no forbidden syntax and no imports):
```
grep -nE '`|=>|\b(const|let)\b' netlify/functions/situational-awareness-stakeholder.cjs
grep -n 'require(' netlify/functions/situational-awareness-stakeholder.cjs
```

## Where This Leaves the SA Build
Stages 1–5 (substrate, typed contracts, orchestrator wiring) + Stage 6 (regression) shipped previously. **Stage 7 (this deploy) is now complete.** Remaining: Stage 8 (Conflict Detection, L9.2), Stage 9 (Executive Brief + report section, L9.4 — also closes the duplicate-question UX echo), Stage 10 (Consequence Simulator, L9.3), Stage 11 (SA Package assembler + hash/sign). All are additive and downstream; none touches the live hot path.
