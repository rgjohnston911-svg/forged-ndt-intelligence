# DEPLOY410 - Fleet: word-boundary the hic/ssc mechanism scan (found by 50-case internal test)

## Source: internal fleet test on all 50 live-pack scenarios
Ran every scenario through the deterministic engines (decision-core + FMD + organizational
+ future-state) and the fleet-triage ranking. 50/50 ran with ZERO errors. The ranking
stratified correctly (24 IMMEDIATE / 25 PRIORITY / 2 ELEVATED; 25 CRITICAL / 25 HIGH / 2
MEDIUM). Full output saved to benchmark/fleet-50-internal-test.txt.

## Bug found
~30 cards showed "suspected: hic". Cause: FleetTriagePage's mechanism scan did
`lt.indexOf("hic")`, which matches the substring in "t-hic-kness" - so any scenario
mentioning thickness fed a bogus "hic" damage mechanism into FMD, which surfaced it as a
suspected cracking mechanism. (FMD's own transcript scan was already word-boundary-safe
since DEPLOY398; this was the Fleet page feeding it junk.)

## Fix (FleetTriagePage.tsx)
`lt.indexOf("hic")` / `indexOf("ssc")` -> `/\bhic\b/.test(lt)` / `/\bssc\b/.test(lt)`.
Re-ran the 50-case test: spurious suspected-HIC count went 30 -> 0. tsc clean.

## Notes (not bugs)
- Within-archetype ties: the live-pack reuses identical context across the 10 asset
  types per archetype, so all 10 score the same. Honest; real fleets with distinct
  findings spread out.
- Offline limitation: this internal test runs deterministic engines only (no LLM
  parse-incident/physics). The fatigue archetype (C01-C10: vibration+cycling+"prior
  cracked", no literal "fatigue") shows as CORROSION/HIGH here; in live runs the LLM/
  physics layer names fatigue and the suspected-fatigue surfaces (confirmed in TESTs 1-5).
  A future "fatigue-from-physics-cues" detector in FMD would make this deterministic.

## Files
- src/pages/FleetTriagePage.tsx          (word-boundary hic/ssc)
- benchmark/fleet-50-internal-test.txt    (full ranked output - reference artifact)
- DEPLOY410-INSTRUCTIONS.md

## Commit
```bash
git pull
npx tsc -b
git add src/pages/FleetTriagePage.tsx benchmark/fleet-50-internal-test.txt DEPLOY410-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Then:
```bash
git commit -m "DEPLOY410 - Fleet: word-boundary the hic/ssc mechanism scan so 'thickness' no longer yields a spurious suspected-HIC on cards (found by internal 50-case fleet test; 30 false suspected-HIC -> 0). Adds the 50-case test output as a reference artifact. tsc clean."
git push
```
