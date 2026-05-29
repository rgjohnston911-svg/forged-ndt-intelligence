# DEPLOY369: SA Build Stage 8 — Conflict Detection Engine (L9.2)

## What This Does
Adds the **Conflict Detection Engine** — Stage 8 of the FORGED SA Build Brief. It operates on the 9 `StakeholderRealityView`s from L9.1 (DEPLOY367) and emits one typed `ConflictMatrix` using a **fixed, enumerated** bias/conflict ruleset. No LLM, anywhere.

## Why It Is Safe (read before committing)
- **No callers.** Stage 8 ships the engine only. Nothing in the live request path calls `detectConflicts()` yet, so platform behavior is unchanged.
- **Pure deterministic.** Same views in → byte-identical `ConflictMatrix` out (verified under repeat calls and input key-order permutation).
- **Fully revertable.** Deleting the one new file returns the repo to the DEPLOY368 state.
- **Invariants honored:** read-only over L9.1 output (Directive 3); no field added to the DecisionPackage (Directive 4); every conflict and contamination flag comes from an enumerated rule — no LLM (Claim 1(ix)); no clock read.

## Files in This Deploy

### 1. NEW — `netlify/functions/situational-awareness-conflict.cjs`
The L9.2 engine. Pure JS (`var` only, string concatenation only, no template literals, no arrow functions, `module.exports`). Imports nothing — it consumes the L9.1 views the caller passes in. Exports `detectConflicts(stakeholderViews, validatedEvidenceSet)`.

### 2. LOCAL-ONLY — `tests/situational-awareness-conflict.test.cjs`
Stage 8 acceptance gate. Lives in `tests/`, which is **git-ignored** (`tests/*.cjs`). It is NOT committed (same convention as the Stage 1/Stage 7 tests). Run it locally. It must never go under `netlify/functions/` — every file there is bundled as a deployable function, and a dotted name like `...conflict.test` is rejected by the Netlify bundler (the DEPLOY368 lesson).

**Only file 1 is committed/deployed.**

## `ConflictMatrix` shape
```
{
  options:                      ["CONTINUE","DERATE","SHUTDOWN","MORE_DATA"]  // distinct non-N/A wants, canonical order
  stakeholder_positions:        { <ROLE>: { wants, rationale }, ... }          // all 9 roles
  active_conflicts:             [ { between:[roleA,roleB], axis, severity }, ... ]
  decision_contamination_flags: [ { stakeholder, type, severity, evidence }, ... ]
  conflict_resolution_priority: [ fixed constant ]
}
```

## Deterministic ruleset (summary)
- **Conflict axes (enumerated):** `shutdown_now` (every SHUTDOWN-leaning role vs every CONTINUE-leaning role) and `gather_more_data` (MORE_DATA vs CONTINUE). Pairs are generated in view order.
- **Severity:** `shutdown_now` is HIGH when SAFETY is on the shutdown side or the CONTINUE side carries HIGH contamination, and CRITICAL when both; otherwise MEDIUM. `gather_more_data` is MEDIUM for RELIABILITY/ENGINEER or a HIGH-contamination counterpart, else LOW.
- **Contamination flags, two enumerated sources:** (1) any role whose own L9.1 contamination risk is MEDIUM/HIGH (OPS_MANAGER→PRODUCTION_PRESSURE, FINANCIAL→COST_PRESSURE, else DECISION_PRESSURE); (2) a named-bias keyword scan over the validated evidence (production-bonus → OPS, cost/penalty → FINANCIAL, prior-incident → ENGINEER, missing-calibration → INSPECTOR). De-duplicated by stakeholder+type. SAFETY's conservative bias is never flagged.
- **`conflict_resolution_priority`:** a fixed constant — `SAFETY, LEGAL, ENGINEER, RELIABILITY, INSPECTOR, TECHNICIAN, OPS_MANAGER, FINANCIAL, STUDENT` (safety/regulatory/integrity dominate; operations/financial rank last).

## Deploy Steps (git bash)

### Step 0 (MANDATORY) — pull first
```
git pull
```

### Step 1 — run the acceptance gate locally
```
node tests/situational-awareness-conflict.test.cjs
```
Expected: `All Stage 8 conflict-detection checks passed (deterministic ConflictMatrix).`

### Step 2 — stage ONLY the engine + this doc (by name; never `git add -A`)
```
git add netlify/functions/situational-awareness-conflict.cjs DEPLOY369-INSTRUCTIONS.md
```
The test in `tests/` is git-ignored and will not appear — that is correct, do not force-add it.

### Step 3 — confirm the staged set is exactly those two files
```
git status
```

### Step 4 — commit + push
```
git commit -m "DEPLOY369 - Stage 8: Conflict Detection Engine (L9.2). Deterministic ConflictMatrix over the 9 L9.1 views: enumerated conflict axes + bias/contamination ruleset, fixed resolution priority. No LLM, no callers, no core imports, no clock."
git push
```
If an `index.lock` error appears, `rm -f ".git/index.lock"` and retry.

## After Deploy
No production check — Stage 8 has no callers, so the Netlify build only needs to go green (the engine module deploys as a no-op function, like the gate and stakeholder modules). The test runs locally.

## SA Build Status
Stages 1–8 complete. Remaining: Stage 9 (Executive Brief + report section, L9.4 — also closes the duplicate-question UX echo), Stage 10 (Consequence Simulator, L9.3), Stage 11 (SA Package assembler + hash/sign). All additive and downstream of the frozen DecisionPackage.
