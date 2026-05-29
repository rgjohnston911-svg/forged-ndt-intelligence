# DEPLOY372: SA Build Stage 11 — SituationalAwarenessPackage Assembler

## What This Does
Adds the **SA package assembler** — Stage 11 of the FORGED SA Build Brief. It bundles the L9.0–L9.4 outputs into one typed `SituationalAwarenessPackage`, computes the SA artifact's **own independent `saPackageHash`**, offers an optional HMAC signature, and emits a new `SA_PACKAGE_ASSEMBLED` coherence-log event. This is the last of the pure additive SA engines.

## The critical invariant (Directive 4)
The frozen DecisionPackage is **referenced by its existing hash** — this module never recomputes, reshapes, or modifies the DecisionPackage or its canonicalization. The SA package is a separate artifact that points at the DecisionPackage by hash, so the DecisionPackage stays byte-for-byte identical and `replay-audit.cjs` keeps verifying every package already stored.

## Why It Is Safe
- **No callers.** Nothing invokes the assembler in the live path yet. Platform behavior is unchanged.
- **Pure deterministic.** `saPackageHash` is computed over a deep canonical (key-sorted) JSON, so it is invariant to input key order and excludes itself. Verified by test.
- **Fully revertable.** Deleting the one new file returns the repo to the DEPLOY371 state.
- **Invariants honored:** DecisionPackage hashing untouched (Directive 4); no field added to the DecisionPackage; no LLM; no clock read (the coherence event takes a caller-supplied `referenceIso`). Uses only Node's `crypto` builtin — no core-engine imports.

## Files in This Deploy

### 1. NEW — `netlify/functions/situational-awareness-package.cjs`
The assembler. Pure JS (`var` only, string concatenation only, no template literals, no arrow functions, `module.exports`); `require('crypto')` only. Exports `assembleSaPackage(parts)`, `computeSaPackageHash`, `verifySaPackage`, `signSaPackage`, `buildCoherenceEvent`.

### 2. LOCAL-ONLY — `tests/situational-awareness-package.test.cjs`
Stage 11 acceptance gate. Lives in `tests/` (git-ignored, `tests/*.cjs`), **not committed** — run locally. Never under `netlify/functions/` (DEPLOY368 lesson).

**Only file 1 is committed/deployed.**

## `SituationalAwarenessPackage` shape
```
{
  decisionPackageHash:  string                 // references the FROZEN DecisionPackage by hash
  validatedEvidenceSet: ValidatedEvidenceSet    // L9.0
  stakeholderViews:     StakeholderRealityView[]// L9.1
  conflictMatrix:       ConflictMatrix          // L9.2
  consequenceScenarios: ConsequenceScenario[]   // L9.3
  executiveBrief:       ExecutiveBrief          // L9.4
  saPackageHash:        string                  // SA artifact's own hash (independent of DP hash)
}
```

## Deploy Steps (git bash)

### Step 0 (MANDATORY) — pull first
```
git pull
```

### Step 1 — run the acceptance gate locally
```
node tests/situational-awareness-package.test.cjs
```
Expected: `All Stage 11 SA-package assembler checks passed (independent hash, DP referenced not modified).`

### Step 2 — stage ONLY the engine + this doc (by name; never `git add -A`)
```
git add netlify/functions/situational-awareness-package.cjs DEPLOY372-INSTRUCTIONS.md
```
The `tests/` file is git-ignored and will not appear — correct; do not force-add it.

### Step 3 — confirm exactly those two files are staged
```
git status
```

### Step 4 — commit + push
```
git commit -m "DEPLOY372 - Stage 11: SituationalAwarenessPackage assembler. Bundles L9.0-L9.4 outputs; references frozen DecisionPackage by existing hash (Directive 4, never recomputed); computes independent saPackageHash (deep-canonical, excludes itself); optional HMAC sign; new SA_PACKAGE_ASSEMBLED coherence event (caller referenceIso, no clock). crypto builtin only, no callers."
git push
```
If an `index.lock` error appears, `rm -f ".git/index.lock"` and retry. Confirm `git status` shows the files staged before committing (the `git add` is the step that has silently failed on the lock before).

## After Deploy
No production check — no callers, build just needs to go green (deploys as a no-op function like the other SA modules). The test runs locally.

## SA Build Status — engines complete
Stages 1–8, 9 Part 1, 10, and 11 are done. **All pure additive SA engines are now in.** The only remaining piece is:

- **Stage 9 Part 2 (DEPLOY373, the single higher-risk change):** wire a report section into `VoiceInspectionPage.tsx` that renders the Executive Brief and the unresolved-questions list **only when SA is present** — this closes the "same question asked twice" UX echo. The SA-absent path must stay bit-identical; ships on its own and is independently revertable. Recommend doing it in a focused sitting.
