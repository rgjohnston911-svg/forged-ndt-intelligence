# DEPLOY397 - Decision-layer fix #1: confirmed-vs-suspected governing mechanism

## Source: first LIVE decision-layer run (live-pack Case 01, refinery piping, fatigue archetype)
GPT eval scored ~8/10. The platform did the SAFETY part right (held disposition,
required fatigue NDE, correct API 570/B31.3/579/571) but reported headline
"GOVERNING: CORROSION" because corrosion was the CONFIRMED/measured mechanism while
fatigue was unverified. Eval's exact critique: "separate confirmed observed
mechanism from suspected governing mechanism - that distinction is critical."

## Root cause (failure-mode-dominance.js)
The v1.3 branch "corrosion confirmed + cracking screening-only" set
governingMode = CORROSION and emitted a screening gate that blocks finalization
(the correct HOLD), but only surfaced "CORROSION" as governing - the suspected
higher-consequence mechanism (fatigue) was buried in the screening gate.

## Fix (additive; safety behavior unchanged)
- FMD now emits **suspected_governing_mechanism** (the unconfirmed higher-
  consequence candidates, e.g. fatigue) alongside governing_failure_mode, and the
  basis is reframed: "CONFIRMED governing mechanism: corrosion ... SUSPECTED
  higher-consequence mechanism pending confirmation: FATIGUE ... calc governs on
  the confirmed mechanism but disposition is HELD until the suspected mechanism is
  confirmed or ruled out." Version 1.4.0 -> 1.5.0.
- `governing_failure_mode` is UNCHANGED (still drives the B31G/FFS calc and the
  screening-gate HOLD the eval praised). 'generic'/'unknown' tokens filtered out.
- Report (VoiceInspectionPage.tsx) renders a second banner: "SUSPECTED GOVERNING
  (pending confirmation): FATIGUE" right under the GOVERNING banner, only when a
  suspected mechanism exists.

## Verification (offline, FMD handler)
- Case 01 (corrosion measured + fatigue suspected): gov=CORROSION,
  suspected=["fatigue"], HOLD=true. <- the fix.
- Corrosion only: gov=CORROSION, suspected=null (NO false suspected banner).
- Confirmed cracking: gov=CRACKING, suspected=null (unaffected).
- Benchmark unchanged (cls 98 / org 100 / forecast 100); domain/org/forecast locks
  pass; tsc -b clean.

## Files (3) + 1 pending
- netlify/functions/failure-mode-dominance.js   (suspected_governing_mechanism + basis)
- src/pages/VoiceInspectionPage.tsx              (suspected-governing report banner)
- DEPLOY397-INSTRUCTIONS.md
- benchmark/run-jurisdiction.cjs                 (from earlier - jurisdiction layer scorer, still uncommitted)

## Commit
```bash
git pull
npx tsc -b
git add netlify/functions/failure-mode-dominance.js src/pages/VoiceInspectionPage.tsx benchmark/run-jurisdiction.cjs DEPLOY397-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Then:
```bash
git commit -m "DEPLOY397 - Decision-layer fix #1 (from live-pack Case 01). FMD now emits suspected_governing_mechanism (e.g. fatigue) alongside the confirmed governing_failure_mode (corrosion); basis reframed as confirmed-vs-suspected; report shows a 'SUSPECTED GOVERNING (pending confirmation)' banner. governing_failure_mode + screening-gate HOLD unchanged. Corrosion-only emits no suspected (no false banner). Also commits benchmark/run-jurisdiction.cjs (jurisdiction layer scorer, 50/50). tsc -b clean."
git push
```
Paste the push output, then re-run live-pack Case 01 to confirm the report now reads
"GOVERNING: CORROSION" + "SUSPECTED GOVERNING (pending confirmation): FATIGUE".

## Why this matters
This is the catch->fix loop operating on the DECISION layer for the first time -
the layer that actually determines whether the platform "understands reality" and
the one the Arbiter spec depends on. The confirmed-vs-suspected split is a
reusable pattern: it should extend to the other archetypes (consequence-governs,
support-governs) as you run more live-pack cases.
