# DEPLOY398 - Decision-layer fix #2: disposition driver (+ HIC substring fix)

## Source: live-pack offshore-platform case (TEST 3, fatigue archetype)
GPT eval scored 8.5/10 - up from 8 - and confirmed DEPLOY397 works: the platform
now flags a "suspected higher-consequence mechanism pending confirmation." Exact
remaining critique: it still labels headline **GOVERNING: CORROSION**, and the
better output names the disposition driver - "unresolved crack risk, not remaining
wall thickness." i.e. separate the CONFIRMED governing *mechanism* (the calc lens)
from the *risk that governs the decision* (the disposition/HOLD lens).

## Root cause (failure-mode-dominance.js)
DEPLOY397 surfaced the suspected mechanism but never stated WHAT DRIVES THE HOLD.
A reader can still infer "wall thickness is the concern" because corrosion is the
headline. The HOLD is actually governed by the unresolved crack-mechanism risk -
remaining thickness is acceptable/stable and is NOT the decision driver.

## Fix (additive; safety + calc behavior unchanged)
- FMD now emits **disposition_driver**: a plain-language statement naming the
  unresolved suspected-crack risk as what governs the HOLD - explicitly "NOT
  remaining wall thickness." Set in both branches that produce a suspected
  mechanism (confirmed-corrosion + cracking-screening-only, and screening-only
  with no confirmed mode). Version 1.5.0 -> 1.6.0.
- `governing_failure_mode`, `suspected_governing_mechanism`, and the screening-gate
  HOLD are UNCHANGED.
- Report (VoiceInspectionPage.tsx): when a suspected mechanism exists, the GOVERNING
  banner is qualified to **"GOVERNING (CONFIRMED MECHANISM): ..."** and a new
  **"DISPOSITION DRIVER: ..."** banner is rendered (only when disposition_driver set).

## Bonus root-cause fix (found during verification)
The bare transcript scans `transcript.indexOf("hic")` / `"ssc"` / `"sohic"` were
substring-matching common words - notably **"thickness" contains "hic"** - which
spuriously flagged HIC as a suspected mechanism on almost any report mentioning
thickness. Now word-boundary-gated via the existing `hasWordBoundaryMatch` helper
(same guard already used for tilt/lean/list). TEST 3 suspected set went from
["hic","fatigue"] to a clean ["fatigue"].

## Verification (offline, FMD handler)
- TEST 3 (offshore; corrosion measured+stable, fatigue suspected at vibrating
  nozzle): gov=CORROSION, confirmed=CORROSION, suspected=["fatigue"],
  disposition_driver set ("Unresolved FATIGUE ... NOT remaining wall thickness"),
  HOLD=true. <- the fix.
- Corrosion only (no crack cue): gov=CORROSION, suspected=null,
  disposition_driver=null (NO false banner).
- Confirmed cracking: gov=CRACKING, disposition_driver=null (unaffected).
- Benchmark unchanged (cls 49/50 / org 100 / forecast 100); jurisdiction 50/50;
  23/23 regression locks pass; tsc -b clean.

## Files (3)
- netlify/functions/failure-mode-dominance.js   (disposition_driver + HIC word-boundary fix; v1.6.0)
- src/pages/VoiceInspectionPage.tsx              (GOVERNING-confirmed label + disposition-driver banner)
- DEPLOY398-INSTRUCTIONS.md

## Commit
```bash
git pull
npx tsc -b
git add netlify/functions/failure-mode-dominance.js src/pages/VoiceInspectionPage.tsx DEPLOY398-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Then:
```bash
git commit -m "DEPLOY398 - Decision-layer fix #2 (from live-pack offshore TEST 3). FMD now emits disposition_driver naming the unresolved suspected-crack risk as what governs the HOLD (NOT remaining wall thickness); report qualifies the headline as 'GOVERNING (CONFIRMED MECHANISM)' and adds a 'DISPOSITION DRIVER' banner when a suspected mechanism exists. Also word-boundary-gates bare hic/ssc/sohic transcript scans so 'thickness' no longer spuriously flags HIC. governing_failure_mode + screening-gate HOLD unchanged; corrosion-only emits no driver. Benchmark/jurisdiction/regression unchanged; tsc -b clean."
git push
```
Paste the push output, then re-run live-pack TEST 3 to confirm the report now reads
"GOVERNING (CONFIRMED MECHANISM): CORROSION" + "SUSPECTED GOVERNING (pending
confirmation): FATIGUE" + "DISPOSITION DRIVER: Unresolved FATIGUE ... NOT remaining
wall thickness."

## Why this matters
This is decision-layer fix #2 and it completes the confirmed-vs-suspected pattern:
DEPLOY397 said *there is* a suspected mechanism; DEPLOY398 says *it is what governs
the decision*. Together they answer GPT's core critique for the entire fatigue
archetype. The disposition-driver concept is exactly the Arbiter's job - separating
"what is confirmed" from "what drives the call" - so this is a down payment on that
layer. Next: the OTHER archetypes (consequence-governs, future-state-governs,
support-governs, human-factors-governs) - run live-pack Case 11 / 21 / 31 / 41 and
paste the evals.
