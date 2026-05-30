# DEPLOY409 - Fleet: split inline "Asset:" scenarios (no line breaks) + cleaner names

## Source: live run where 4 scenarios merged into 1
The paste had all four scenarios on effectively ONE line (no line breaks before each
`Asset:`). DEPLOY407's auto-split required a NEWLINE before `Asset:`, so it didn't fire ->
everything merged into a single asset. Symptoms: one card, a messy 70-char name ("LNG
Transfer Line Inspection finding (the obvious defect): MT/PAUT fin"), and
`mechanism: COMPOUND` (the merge mixed the crack text with the subsea corrosion text, so
FMD saw both confirmed -> COMPOUND).

## Fix (FleetTriagePage.tsx)
- splitScenarios now splits before each `Asset:` marker **even inline** (no newline
  required): `t.split(/(?=\*{0,2}\s*Asset\s*:)/i)` when 2+ colon-bearing `Asset:` markers
  are present. Colon-bearing so body prose like "the asset is..." is NOT matched. The
  `===`/`---` delimiter path is unchanged.
- deriveName now bounds the captured name at the next markdown `*` (`[^*\n]+`), so an
  inline block yields "LNG Transfer Line" instead of swallowing the whole paragraph.
  Dropped "line" from the label alternation so "Transfer Line" isn't mistaken for the
  marker.

## Verification
- Offline split test on the exact inline paste -> 4 scenarios, names: "LNG Transfer
  Line", "Bridge", "Pressure Vessel", "Subsea Structure".
- tsc -b clean. File intact (no NUL).
- With proper splitting each asset runs alone, so FMD returns the right mechanism per
  asset (CRACKING for the crack cases; CORROSION + suspected fatigue for subsea) instead
  of the merged COMPOUND.

## Files
- src/pages/FleetTriagePage.tsx   (inline Asset: split + bounded name)
- DEPLOY409-INSTRUCTIONS.md

## Commit
```bash
git pull
npx tsc -b
git add src/pages/FleetTriagePage.tsx DEPLOY409-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Then:
```bash
git commit -m "DEPLOY409 - Fleet: split inline 'Asset:' scenarios (no line breaks needed) so a single-line paste no longer merges into one asset; bound parsed asset name at markdown so names stay clean. tsc clean."
git push
```
After deploy + hard-refresh, re-run the same 4-asset paste: you should now get FOUR
cards - LNG Transfer Line / Bridge / Pressure Vessel (mechanism: CRACKING, CRITICAL) and
Subsea Structure (mechanism: CORROSION, suspected: fatigue, HIGH) - each ranked.
