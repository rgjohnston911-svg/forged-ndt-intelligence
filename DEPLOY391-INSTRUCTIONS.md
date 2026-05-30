# DEPLOY391 - Future-State Forecaster (the "Future Reality" decision layer)

## Why
The platform answered "is it acceptable today?" but not the more valuable
question: "the asset is acceptable now -- will the forecast operating reality
(degradation trend, production change, deferred turnaround, staffing, weather)
push it below minimum BEFORE the next planned intervention?" Linear remaining
life (failure-timeline) and probability scenarios (survival bridge) existed, and
three richer forecasting engines were built but inert -- yet they are
Supabase-backed fleet twins needing persisted history, so they don't fit a
one-shot inspection. The decision-relevant, stateless layer was missing.

## What this adds
`netlify/functions/future-state-forecaster.cjs` (pure deterministic, no DB/LLM):
- Detects forecast drivers from the narrative: trend acceleration (x1.5 rate),
  production/throughput increase (x1.2), deferred turnaround, staff reduction,
  weather loading.
- Adjusts the platform's own remaining life (failure-timeline
  governing_time_years) by the combined rate multiplier (modifiers only SHORTEN
  life -- conservative).
- Projects life-fraction consumed at 3/6/12/24 months.
- Compares adjusted time-to-minimum against the next planned intervention
  (parsed from the transcript) and returns a verdict:
  BREACH_BEFORE_NEXT_INTERVENTION / ACCEPTABLE_THROUGH_NEXT_INTERVENTION /
  INTERVENTION_(DEFERRED_)TIMING_UNKNOWN / QUALITATIVE_ONLY.
- Names the dominant risk driver.

Wired into `situational-awareness-orchestrate.cjs` (attached to the SA package
like Tier 3a/3b -- NOT part of saPackageHash, verifySaPackage stays valid) and
rendered in the on-screen SA card + report PDF.

## Verification
- `tests/future-state-forecaster.test.cjs` (git-ignored):
  - Accelerating + production increase shortens a 36-mo life to ~20 mo; with a
    30-mo turnaround -> BREACH_BEFORE_NEXT_INTERVENTION; dominant driver = trend
    acceleration.
  - 8-yr life vs 24-mo intervention -> ACCEPTABLE_THROUGH.
  - Deferred turnaround, no new date -> INTERVENTION_DEFERRED_TIMING_UNKNOWN.
  - No quantified life -> QUALITATIVE_ONLY but still flags drivers.
  - 150-case digital-twin corpus: forecast drivers detected in 150/150
    (production=150, deferred=150, acceleration=150).
- Orchestrate integration: futureState attached, verdict correct,
  `verifySaPackage` valid (hash unaffected).
- `tsc -b` clean.

## Files (4; test + fixture git-ignored)
- `netlify/functions/future-state-forecaster.cjs`            (new engine)
- `netlify/functions/situational-awareness-orchestrate.cjs`  (require + attach)
- `src/pages/VoiceInspectionPage.tsx`                        (SA card + PDF render)
- `DEPLOY391-INSTRUCTIONS.md`                                 (this file)

## Commit
```bash
git pull
node tests/future-state-forecaster.test.cjs
npx tsc -b
git add netlify/functions/future-state-forecaster.cjs netlify/functions/situational-awareness-orchestrate.cjs src/pages/VoiceInspectionPage.tsx DEPLOY391-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Then:
```bash
git commit -m "DEPLOY391 - Future-State Forecaster (Future Reality decision layer). New deterministic future-state-forecaster.cjs: detects forecast drivers (trend acceleration, production increase, deferred turnaround, staffing, weather), adjusts failure-timeline remaining life, projects 3/6/12/24mo, and decides BREACH_BEFORE_NEXT_INTERVENTION vs ACCEPTABLE_THROUGH. Wired into SA orchestrate (hash-unaffected) + rendered in SA card/PDF. Locked by 150-case digital-twin corpus (drivers 150/150). tsc -b clean; verifySaPackage valid."
git push
```
Paste the push output. To see it live, run an inspection with quantifiable
thickness/rate (so failure-timeline yields a remaining life) plus forecast text
(e.g. "accelerated degradation; production increase; turnaround in 30 months").

## Follow-ups
- Add discrete projected-thickness numbers per horizon when t_min is available
  (currently life-fraction consumed); requires passing currentWall + t_min through.
- Expand the global-authority CROSSWALK_MATRIX (deferred from DEPLOY390).
