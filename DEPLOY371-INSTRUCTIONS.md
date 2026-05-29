# DEPLOY371: SA Build Stage 10 — Consequence Simulator (L9.3)

## What This Does
Adds the **Consequence Simulator** — Stage 10 of the FORGED SA Build Brief. For each decision option it emits one typed `ConsequenceScenario`. Its defining discipline: **it never invents probabilities.** Probability-weighted outcomes are passed through ONLY from a caller-supplied `probabilityBasis` (sourced upstream from the L4 Failure Timeline and the asset registry's precedent failures). When no basis exists for an option, the scenario is emitted with `confidence: 0` and `probability_weighted_outcomes: []`.

## Why It Is Safe
- **No callers.** Nothing invokes `buildConsequenceScenarios()` in the live path yet. Platform behavior is unchanged.
- **Pure deterministic.** Same inputs → byte-identical output (verified under repeat calls and input key-order permutation).
- **Fully revertable.** Deleting the one new file returns the repo to the DEPLOY370 state.
- **Invariants honored:** read-only over upstream artifacts (Directive 3); no field added to the DecisionPackage (Directive 4); no LLM and no fabricated probabilities (Claim 1(ix); brief Stage 10 gate); no clock read.

## Files in This Deploy

### 1. NEW — `netlify/functions/situational-awareness-consequence.cjs`
The L9.3 engine. Pure JS (`var` only, string concatenation only, no template literals, no arrow functions, `module.exports`). Imports nothing. Exports `buildConsequenceScenarios(decisionPackage, conflictMatrix, validatedEvidenceSet, probabilityBasis)`.

### 2. LOCAL-ONLY — `tests/situational-awareness-consequence.test.cjs`
Stage 10 acceptance gate. Lives in `tests/` (git-ignored, `tests/*.cjs`), **not committed** — run locally. Never place it under `netlify/functions/` (dotted function names break the Netlify bundler — the DEPLOY368 lesson).

**Only file 1 is committed/deployed.**

## `ConsequenceScenario` shape (one per option)
```
{
  option:                       "CONTINUE|DERATE|SHUTDOWN|MORE_DATA"
  probability_weighted_outcomes:[ { outcome, probability, consequence_basis, evidence_source:[...] }, ... ]
  expected_value:               { financial, safety, regulatory }   // passed through from basis; else UNQUANTIFIED
  confidence:                   <0-1>                               // 0 when no basis
  evidence_basis:               [ <EvidenceEntry>, ... ]
}
```

## The no-invention rules (acceptance gate)
- **No `probabilityBasis` for an option → `confidence: 0`, empty outcomes, `expected_value` UNQUANTIFIED.**
- A basis entry counts only if it has **at least one valid outcome AND an explicit numeric `confidence`.** Outcomes without a stated confidence are treated as no basis.
- **Invalid probabilities are dropped, never coerced** — a probability must be a number in `[0,1]`. If all outcomes drop, the option falls back to no-basis (`confidence: 0`).
- `expected_value.financial` may show `SEE_PROVIDED_INPUTS` when the user supplied financial evidence, but the simulator never fabricates a dollar figure.
- The option set comes from the L9.2 `ConflictMatrix` when supplied; otherwise the canonical four options, all at `confidence: 0`.

## Deploy Steps (git bash)

### Step 0 (MANDATORY) — pull first
```
git pull
```

### Step 1 — run the acceptance gate locally
```
node tests/situational-awareness-consequence.test.cjs
```
Expected: `All Stage 10 consequence-simulator checks passed (no invented probabilities).`

### Step 2 — stage ONLY the engine + this doc (by name; never `git add -A`)
```
git add netlify/functions/situational-awareness-consequence.cjs DEPLOY371-INSTRUCTIONS.md
```
The `tests/` file is git-ignored and will not appear — correct; do not force-add it.

### Step 3 — confirm exactly those two files are staged
```
git status
```

### Step 4 — commit + push
```
git commit -m "DEPLOY371 - Stage 10: Consequence Simulator (L9.3). Per-option ConsequenceScenario, probabilities passed through ONLY from caller-supplied basis (L4 timeline/precedents); confidence 0 + empty outcomes when no basis; invalid probabilities dropped, never coerced. No LLM, no callers, no core imports, no clock."
git push
```
If an `index.lock` error appears, `rm -f ".git/index.lock"` and retry the failed command. (Note: the `git add` is the step that has been silently failing on the lock — always confirm `git status` shows the files staged before committing.)

## After Deploy
No production check — no callers, so the build just needs to go green (deploys as a no-op function, like the other SA modules). The test runs locally.

## SA Build Status
Stages 1–8, plus Stage 9 Part 1 (brief engine) and Stage 10 (this) are complete. **Remaining:**
- **Stage 11 (DEPLOY372):** `SituationalAwarenessPackage` assembler + independent hash/sign + coherence-log extension. Pure additive engine — last of the safe ones.
- **Stage 9 Part 2 (DEPLOY373, the only higher-risk change):** `VoiceInspectionPage.tsx` report section that renders the brief and the unresolved-questions list only when SA is present — closes the "same question asked twice" UX echo. SA-absent path must stay bit-identical.
