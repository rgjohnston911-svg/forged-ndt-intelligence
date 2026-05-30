# DEPLOY383: SA Tier 3a — Organizational Failure Detection (L9.5)

## Why
The GPT eval's highest-value miss was **Organizational Failure Recognition**: the scenario's strongest situational-awareness clues were management-system failures — "No damage report filed," "Observation never entered into integrity database," "CP survey overdue by 19 months," "No root cause investigation initiated." Those aren't damage findings; they're how major incidents actually happen. The eval asked for an Organizational Risk category with a score.

## What This Does
Adds a new deterministic engine, `situational-awareness-organizational.cjs`, that scans the inspection narrative for an **enumerated** set of organizational/management-system failure patterns and emits indicators + an **Organizational Failure Score (0–10)**. It renders in the report (PDF) and the on-screen SA card. No LLM — a fixed keyword ruleset.

Detected categories: unreported events (CRITICAL), lost/unrecorded observations, missed/overdue inspections, no root-cause investigation, ignored degradation trends, schedule/production-pressure overrides, and normalized-deviation complacency ("just coating damage"). On the actual Test-1 scenario it produces **score 10/10, 7 indicators**, including the exact items the eval flagged.

## Files in This Deploy
1. **NEW — `netlify/functions/situational-awareness-organizational.cjs`** — pure deterministic; `detectOrganizationalFailures(signals)` → `{ indicators, organizational_failure_score, summary }`. No LLM/clock/random.
2. **MODIFIED — `netlify/functions/situational-awareness-orchestrate.cjs`** — requires the engine; runs it on the supplied narrative `signals` and **attaches** `organizationalFailures` to the returned SA package object for rendering. Important: it is attached AFTER assembly and is **not** part of `saPackageHash` (which still covers only the core SA artifact) — `verifySaPackage` remains valid (verified). (~7-line diff.)
3. **MODIFIED — `src/pages/VoiceInspectionPage.tsx`** — passes `signals: { transcript: inputText }` to the orchestrate call; renders an **Organizational Risk** block in the PDF SA section and a summary line in the on-screen card. (~14-line diff.)
4. **LOCAL-ONLY — `tests/situational-awareness-organizational.test.cjs`** — git-ignored. Verifies detection of each pattern on the real Test-1 scenario, score range, determinism, null-safety. Run: `node tests/situational-awareness-organizational.test.cjs`.

## Verify (local)
```
node tests/situational-awareness-organizational.test.cjs
```
Expected: `All DEPLOY383 organizational-failure checks passed (score 10/10, 7 indicators ...)`. `tsc -b` also passes.

## Deploy Steps (git bash)
```
git pull
node tests/situational-awareness-organizational.test.cjs
git add netlify/functions/situational-awareness-organizational.cjs netlify/functions/situational-awareness-orchestrate.cjs src/pages/VoiceInspectionPage.tsx DEPLOY383-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Confirm those 4 files staged (the `tests/` file is git-ignored). Then:
```
git commit -m "DEPLOY383 - SA Tier 3a: Organizational Failure Detection engine. Enumerated detection of management-system failures (unreported events, lost observations, overdue inspections, no RCA, ignored degradation, schedule pressure) -> indicators + Organizational Failure Score (0-10). Rendered in report + SA card. Attached to SA package for rendering; saPackageHash unaffected (verifySaPackage valid). No LLM. tsc -b clean."
git push
```
If an `index.lock` error appears, `rm -f ".git/index.lock"` and retry.

## After Deploy — verify live
Run an inspection whose narrative includes management-system signals (overdue survey, unreported event, no RCA). Confirm the report's SA section shows an **Organizational Risk** block with a score and the indicator list, and the on-screen SA card shows the org-risk summary line.

## Tier 3 progress
This is **Tier 3a** of 4. Remaining: 3b Convergence Detection (N independent evidence streams → Convergence Score), 3c Causal Chain Reconstruction (anchor-drag → displacement → ovality → coating → CP shielding → corrosion), 3d Future-State Simulator (24h/7d/30d/storm-event projections). Together these complete the eval's "SA-2 Causal Reality Engine."
