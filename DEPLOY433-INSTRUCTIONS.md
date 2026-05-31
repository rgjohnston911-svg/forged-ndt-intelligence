# DEPLOY433 — Offline batch SA scorer (ends the one-scenario-at-a-time loop)

## Why
The 35 acceptance gates test *engine invariants*. But the holistic dimensions — authority routing,
governing mechanism, governing reality, disposition, and the contamination bugs — were marked
**"live_only"** in the benchmark (scored by hand on live runs). That is why TEST 10–15 were each a
manual UI session graded by GPT, one at a time, with nothing accumulating into a regression guard.

The blocker that made them "live_only" (TS-compiled, auth-guarded engines) is gone — this session
proved the offline compile-and-invoke harness works for every engine. So those dimensions can now be
batch-scored automatically.

## What this adds
- **`scripts/eval-sa.cjs`** — compiles decision-core + governingReality once, copies the engine set,
  then runs the FULL offline pipeline per case (decision-core → authority-lock → FMD → convergence →
  organizational → governing-reality), assembles the report text, and scores:
  - **Structured labels:** authority codes (includes/excludes), consequence tier, governing-reality
    class, disposition.
  - **Anti-contamination:** per-case `must_not_contain` + a global `behavioral_guard` (the report
    may not assert a mechanism it can't evidence, or any human-behavior inference).
- **`tests/fixtures/sa-eval-cases.json`** — the labeled corpus. v1 encodes the TEST 11/13/14/15
  regressions as permanent cases (anchor-drag, cathodic, global-plastic-deformation, API-510-on-piping
  contamination all asserted away) plus clean/benign controls.
- `npm run eval` (and a CI step in `.github/workflows/ci.yml`) runs the whole corpus in one command.

## What it replaces
The manual loop: paste scenario → wait → read GPT grade → repeat. Now: one command scores the whole
multi-domain corpus in seconds, and **every past bug is a permanent automated assertion** — TEST 11's
anchor-drag, TEST 13's cathodic, TEST 15's structural hallucination can never silently return.

## What it does NOT replace
The subjective narrative quality ("would a senior engineer phrase it this way") still benefits from
occasional human/GPT review on genuinely NEW scenario types. But the structured correctness +
anti-contamination — ~90% of what TEST 10–15 actually caught — is now automated and batched.

## Verified
- `npm run eval` → **6 / 6** on current code. The assertions map 1:1 to the fixed bugs (DEPLOY425/
  427/430/432), so a regression in any of them fails the eval.
- `npm run test:gates` → 35/35 (unchanged); `tsc -b` clean (no TS changed).

## How to grow it (the workflow going forward)
For each new scenario you'd previously have tested by hand: add one entry to
`tests/fixtures/sa-eval-cases.json` (transcript + expected labels + `must_not_contain`). It then runs
forever in `npm run eval` / CI. The 500+ prose cases already in `tests/fixtures/ndt-*.md` can be
converted into labeled entries over time to widen coverage.

## Files
- `scripts/eval-sa.cjs` (new), `tests/fixtures/sa-eval-cases.json` (new)
- `package.json` (+`eval` script), `.github/workflows/ci.yml` (+SA eval step)
- `DEPLOY433-INSTRUCTIONS.md`

## Commit (from C:\dev\forged-ndt-intelligence)
```bash
npm run eval
node scripts/run-gates.cjs
git add scripts/eval-sa.cjs tests/fixtures/sa-eval-cases.json package.json .github/workflows/ci.yml DEPLOY433-INSTRUCTIONS.md
git commit -m "DEPLOY433 - Offline batch SA scorer (scripts/eval-sa.cjs + sa-eval-cases.json). Runs the full offline pipeline over a labeled multi-domain corpus and scores structured labels + anti-contamination (must_not_contain + behavioral_guard). Encodes TEST 11/13/14/15 bugs as permanent cases; npm run eval + CI step. 6/6; gates 35/35. Ends the one-scenario-at-a-time loop."
git push
```
