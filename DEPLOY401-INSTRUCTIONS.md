# DEPLOY401 - Future-state forecaster robustness + forward-risk surfacing (future-state-governs archetype)

## Source: live-pack refinery accelerating-trend case (TEST 7)
GPT 8.5/10. The forecaster correctly flagged org "TREND NEGLECT," but GPT: "it
underplays the forward-risk issue. The governing risk is the trend acceleration +
deferred turnaround + increased throughput, not today's remaining thickness."

## Root cause (keyword brittleness - confirmed offline)
Run on TEST 7 wording, the Future-State Forecaster detected ONLY PRODUCTION_INCREASE
(via "throughput") and MISSED two of three drivers:
- "the degradation trend HAS ACCELERATED" - keywords expected "accelerating" /
  "accelerated degradation", neither matches the past-tense "has accelerated".
- "turnaround HAS BEEN DEFERRED" - keywords expected "turnaround deferred" /
  "deferred turnaround", neither matches the passive "has been deferred".
Right engine, too-literal matching (the recurring anti-overfit failure).

## Fix
1. **future-state-forecaster.cjs** - broadened driver keywords to natural phrasings:
   - TREND_ACCELERATION += accelerated, has accelerated, trend has accelerated,
     accelerated over, rate has increased, corrosion rate increased, getting worse,
     worsened, has worsened, trend has worsened, progressively worse.
   - DEFERRED_INTERVENTION += deferred, has been deferred, turnaround has been
     deferred, turnaround pushed, pushed back/out, deferral, slipped, turnaround/
     outage slipped, maintenance postponed, interval extended, overdue.
   Negation guard still applies ("not deferred" / "no acceleration" stay suppressed).
2. **VoiceInspectionPage.tsx** - forward-risk elevated from the SA executive brief to a
   top-level banner alongside the governing banners. Fires when the forecaster reports
   BREACH_BEFORE_NEXT_INTERVENTION, >=2 drivers, or TREND_ACCELERATION dominant:
   "FORWARD-RISK (disposition driver): acceptable today, but the governing concern is
   the forward trajectory - <dominant driver> (<drivers>). ... NOT today's remaining
   thickness."

## Verification (real forecaster, offline)
- TEST 7 -> drivers = TREND_ACCELERATION (dominant) + PRODUCTION_INCREASE +
  DEFERRED_INTERVENTION; verdict INTERVENTION_DEFERRED_TIMING_UNKNOWN. <- the fix
  (was: PRODUCTION_INCREASE only).
- "not deferred / no acceleration / throughput steady" -> no trend/deferred drivers
  (negation guard holds; no false positives).
- clean asset -> no drivers.
- tsc -b clean; 23/23 regression locks; benchmark (49/50 / 100 / 100) and jurisdiction
  (50/50) unchanged.

## Files
- netlify/functions/future-state-forecaster.cjs   (driver keyword robustness)
- src/pages/VoiceInspectionPage.tsx               (forward-risk top-level banner)
- DEPLOY401-INSTRUCTIONS.md

## Commit (NOTE: DEPLOY400 is also still unpushed - see DEPLOY400-INSTRUCTIONS.md)
```bash
git pull
npx tsc -b
git add netlify/functions/decision-core.ts netlify/functions/future-state-forecaster.cjs src/pages/VoiceInspectionPage.tsx DEPLOY400-INSTRUCTIONS.md DEPLOY401-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Then:
```bash
git commit -m "DEPLOY400+401 - Consequence + future-state fixes from live-pack TEST 6/7. (400) consequence receptor-exposure amplifier: hazardous release pathway + occupied/populated receptor (occupied control room, downwind population) -> CRITICAL life-safety, the collateral axis the source-only lenses missed; gated so toxic-no-occupancy stays HIGH and occupied-no-hazard stays MEDIUM. (401) future-state forecaster catches passive/past-tense trend + deferred-turnaround phrasings (was missing 'has accelerated' / 'has been deferred'); forward-risk elevated to a top-level disposition banner. tsc clean; 23/23 locks; benchmark/jurisdiction unchanged."
git push
```
Then re-run TEST 6 (life-safety CRITICAL) and TEST 7 (forward-risk banner with trend
acceleration + deferred turnaround as the governing concern).

## Two open items raised alongside this (not in this commit)
- "HIC/sour injected without evidence" (TEST 7): could NOT reproduce from the scenario
  text - the catalog gates HIC behind H2S, and no sour/H2S/unit keywords are present, so
  HIC should be rejected. Needs the actual report/transcript to chase.
- Consequence MEDIUM critique (TEST 7): GPT hedged ("depending on fluid/pressure/
  location"); the DEPLOY400 amplifier covers it when occupied/toxic exposure is present.
