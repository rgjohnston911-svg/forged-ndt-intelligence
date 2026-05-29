# DEPLOY370: SA Build Stage 9 (Part 1 of 2) — Executive Decision Brief engine (L9.4)

## What This Does
Adds the **Executive Decision Brief engine** — the first half of Stage 9. It is a pure, deterministic **rendering** layer that summarizes the upstream SA outputs (L9.0 ValidatedEvidenceSet, the frozen DecisionPackage, the L9.2 ConflictMatrix, and — once Stage 10 lands — the L9.3 ConsequenceScenarios) into one typed `ExecutiveBrief`. It **produces no new evidence**.

## Stage 9 is two commits — this is Part 1 (the safe half)
- **DEPLOY370 (this one):** `situational-awareness-brief.cjs` engine only. Additive, no callers, identical safety profile to Stages 7 and 8.
- **DEPLOY371 (next, higher-risk):** wires a report section into `VoiceInspectionPage.tsx` that renders the brief and the unresolved-questions list **only when SA is present**. That is the change that finally closes the "same question asked twice" UX echo. It touches a live frontend file, so it ships separately with an SA-absent bit-identical guard and is revertable on its own.

## Why Part 1 Is Safe
- **No callers.** Nothing invokes `buildExecutiveBrief()` in the live path yet. Platform behavior is unchanged.
- **Pure deterministic.** Same upstream artifacts in → byte-identical `ExecutiveBrief` out (verified under repeat calls and input key-order permutation).
- **Fully revertable.** Deleting the one new file returns the repo to the DEPLOY369 state.
- **Invariants honored:** read-only over upstream artifacts (Directive 3); no field added to the DecisionPackage (Directive 4); no LLM — `produces_new_evidence` is always `false` (Claim 1(ix)); no clock read.

## Files in This Deploy

### 1. NEW — `netlify/functions/situational-awareness-brief.cjs`
The L9.4 engine. Pure JS (`var` only, string concatenation only, no template literals, no arrow functions, `module.exports`). Imports nothing. Exports `buildExecutiveBrief(decisionPackage, validatedEvidenceSet, conflictMatrix, consequenceScenarios)`. The last two args are optional and tolerate `null` (ConsequenceScenarios do not exist until Stage 10).

### 2. LOCAL-ONLY — `tests/situational-awareness-brief.test.cjs`
Stage 9 engine acceptance gate. Lives in `tests/` (git-ignored, `tests/*.cjs`), **not committed** — run locally. Never place it under `netlify/functions/` (dotted function names break the Netlify bundler — the DEPLOY368 lesson).

**Only file 1 is committed/deployed.**

## `ExecutiveBrief` shape
```
{
  recommendation:   { action, disposition, basis, simulator_informed }
  risk:             { life_safety: LOW|MEDIUM|HIGH,
                      financial:   QUANTIFIED_FROM_PROVIDED_INPUTS | UNQUANTIFIED_NO_INPUTS_PROVIDED,
                      regulatory:  LOW|MEDIUM|HIGH }
  confidence:       <0-1>                              // pkg.confidence minus 0.10 per unresolved CRITICAL
  unknowns:         { unresolved_questions:[...], critical_unresolved_count:N }   // from L9.0
  code_basis:       [ { code, clause, requirement }, ... ]                        // from bindingClauses (L3)
  conflict_summary: { active_conflict_count, highest_severity, contamination_flag_count, top_priority }  // from L9.2
  hard_locks:       [ trigger, ... ]
  produces_new_evidence: false
}
```

## Deploy Steps (git bash)

### Step 0 (MANDATORY) — pull first
```
git pull
```

### Step 1 — run the acceptance gate locally
```
node tests/situational-awareness-brief.test.cjs
```
Expected: `All Stage 9 (engine) executive-brief checks passed (deterministic ExecutiveBrief).`

### Step 2 — stage ONLY the engine + this doc (by name; never `git add -A`)
```
git add netlify/functions/situational-awareness-brief.cjs DEPLOY370-INSTRUCTIONS.md
```
The `tests/` file is git-ignored and will not appear — correct; do not force-add it.

### Step 3 — confirm exactly those two files are staged
```
git status
```

### Step 4 — commit + push
```
git commit -m "DEPLOY370 - Stage 9 (engine): Executive Decision Brief (L9.4). Pure deterministic rendering of DecisionPackage + ValidatedEvidenceSet + ConflictMatrix (+ optional ConsequenceScenarios) into a typed ExecutiveBrief. Produces no new evidence. No LLM, no callers, no core imports, no clock."
git push
```
If an `index.lock` error appears, `rm -f ".git/index.lock"` and retry the failed command.

## After Deploy
No production check — no callers, so the build just needs to go green (deploys as a no-op function, like the gate/stakeholder/conflict modules). The test runs locally.

## SA Build Status
Stages 1–8 complete; Stage 9 Part 1 (this) brings the brief engine in. Remaining: **Stage 9 Part 2 (DEPLOY371)** — the `VoiceInspectionPage.tsx` report section + duplicate-question UX-echo fix; Stage 10 (Consequence Simulator, L9.3); Stage 11 (SA Package assembler + hash/sign).
