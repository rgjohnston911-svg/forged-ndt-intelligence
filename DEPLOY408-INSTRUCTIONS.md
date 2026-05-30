# DEPLOY408 - Fleet: separate damage MECHANISM from failure CONSEQUENCE

## Source: live 4-asset Fleet run + GPT eval (8/10)
The Fleet page now correctly splits and ranks multiple assets (big win). GPT's main
logic issue: the cards showed "governing: pressure_boundary_failure" - but that is the
failure CONSEQUENCE mode, not the damage MECHANISM. For MT/PAUT crack-like indications
the governing mechanism is cracking / crack-like flaw; for the subsea wall-loss case the
suspected governing risk is vibration/thermal fatigue, not stable wall loss.

## Root cause
The Fleet page pulled `consequence_reality.failure_mode` (the consequence mode) and
labeled it "governing". It never called FMD, which is the engine that determines the
actual governing MECHANISM (and the confirmed-vs-suspected split from DEPLOY397/398).

## Fix
- FleetTriagePage now calls **failure-mode-dominance** per asset (same body shape the
  single-asset page uses; reads the scenario transcript so FMD infers crack
  confirmation state). It uses:
  - `governing_failure_mode` -> the card's **mechanism:** label (CRACKING / CORROSION /
    STRUCTURAL_INSTABILITY / SCREENING_REQUIRED / NONE),
  - `governing_severity` -> now feeds the urgency score (was unset before),
  - `suspected_governing_mechanism` -> shown as **suspected:** (e.g. the subsea case now
    reads "mechanism: CORROSION  suspected: fatigue").
- The consequence mode is stored separately (`consequence_mode`) and the consequence TIER
  (CRITICAL/HIGH) still shows as before. Mechanism and consequence are now distinct on
  the card, exactly as GPT asked.
- fleet-triage.cjs passes `suspected` through to the ranked output.
- FMD call is best-effort (try/catch); if it fails the asset still ranks.

## What this fixes from the eval
- LNG / Pressure Vessel crack cases -> mechanism reads **CRACKING** (crack-like flaw), not
  pressure_boundary_failure.
- Subsea Structure -> mechanism **CORROSION** + **suspected: fatigue** (the
  vibration/thermal-fatigue suspicion), instead of just stable wall loss.
- Bridge crack case -> mechanism now reads CRACKING rather than pressure_boundary_failure.

## Known limitation (not fixed here - adversarial input)
GPT's Problem 1 (a "Bridge" rated pressure_boundary_failure consequence): in that test the
scenario TEXT was the toxic/high-pressure LNG context merely re-labeled "Bridge", so
decision-core read a pressure boundary. Reconciling a structural asset class against a
contradictory pressure/toxic narrative is a decision-core consequence nuance, not a Fleet
bug; the mechanism label is now correct (CRACKING) regardless. Flagged for later.

## Verification
- tsc -b clean. fleet-triage ranking re-checked offline (mechanism + suspected pass
  through; LNG CRACKING ranks above Subsea CORROSION+fatigue). Files intact (no NUL).

## Files
- src/pages/FleetTriagePage.tsx        (per-asset FMD call; mechanism vs consequence)
- netlify/functions/fleet-triage.cjs    (suspected passthrough)
- DEPLOY408-INSTRUCTIONS.md

## Commit
```bash
git pull
npx tsc -b
git add src/pages/FleetTriagePage.tsx netlify/functions/fleet-triage.cjs DEPLOY408-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Then:
```bash
git commit -m "DEPLOY408 - Fleet: separate damage mechanism from failure consequence. FleetTriagePage now calls FMD per asset and labels the card with the governing MECHANISM (cracking/corrosion/fatigue) + suspected mechanism, not the consequence mode; governing severity now feeds the urgency score. Crack-like indications read CRACKING; subsea wall-loss reads CORROSION + suspected fatigue. fleet-triage passes suspected through. tsc clean."
git push
```
After deploy + hard-refresh, re-run the 4-asset paste: cards should read
"CRITICAL  hold for review  mechanism: CRACKING" (LNG/PV/Bridge) and
"HIGH  hold for review  mechanism: CORROSION  suspected: fatigue" (Subsea).
```
