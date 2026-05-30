# DEPLOY385 - Fix Test-2 wall-loss / MAOP calculation error

## The bug (GPT eval Test-2, finding #2)
The report showed **wall loss -96.3%** and a governing **MAOP of 9 psi** for a
produced-water discharge spool. True wall loss from 0.500" -> 0.214" is **57.2%**.

## Root cause (confirmed by reproduction)
The scenario states **"Original Thickness: 0.500"** -- using the word *original*,
not *nominal*. The voice extractor only recognized "nominal ... thickness", so
`nominalWall` was never set. With nominal missing, the remaining-strength engine
defaulted it to a thin NPS schedule (NPS 0.5" STD = 0.109") -- which is *below*
the measured 0.214" reading. That makes wall loss negative:
`(0.109 - 0.214) / 0.109 = -96.3%`, and the resulting Barlow/B31G math collapses
MAOP to ~9 psi. The numbers in the eval are reproduced exactly.

## Fix (two layers - defense in depth)
1. **Extraction (frontend, `VoiceInspectionPage.tsx`)** - recognize
   "original / as-built / design (wall) thickness: X in" as the nominal wall.
   Now `Original Thickness: 0.500"` -> nominalWall 0.500 -> correct **57.2%**.
   Verified it does NOT false-match "118% of original design capacity".
2. **Engine guard (`remaining-strength.js`)** - if `measured_minimum_wall >=
   nominal_wall` the inputs are physically impossible (remaining wall cannot
   exceed original). The engine now returns `data_quality:"inconsistent"`,
   `governing_maop:null`, and a recommendation to supply the original/nominal
   wall -- instead of emitting a negative wall loss / bogus MAOP. This protects
   every future scenario, not just this phrasing.

## Verification
- `tests/remaining-strength-guard.test.cjs` (git-ignored):
  - Case A: nominal 0.500 + measured 0.214 -> wall loss ~57.2%, positive finite MAOP.
  - Case B: nominal defaulted thin (0.109) below measured (0.214) -> guard fires,
    no MAOP, never a negative wall loss.
  - Case C: measured == nominal -> inconsistent.
- Extraction check: "Original Thickness: 0.500 in" -> nominal 0.500; "original
  design capacity" correctly ignored.
- `tsc -b` clean. Convergence + organizational regression tests still pass.

## Files (3)
- `netlify/functions/remaining-strength.js`  (+35: measured>=nominal guard)
- `src/pages/VoiceInspectionPage.tsx`        (+14: original/design/as-built -> nominal)
- `DEPLOY385-INSTRUCTIONS.md`                 (this file)
(`tests/remaining-strength-guard.test.cjs` is git-ignored.)

## Commit
```bash
git pull
node tests/remaining-strength-guard.test.cjs
npx tsc -b
git add netlify/functions/remaining-strength.js src/pages/VoiceInspectionPage.tsx DEPLOY385-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Confirm the 3 files are staged, then:
```bash
git commit -m "DEPLOY385 - Fix Test-2 wall-loss/MAOP calc error. Extractor now reads 'original/as-built/design thickness' as nominal wall (Original Thickness 0.500 -> 57.2% wall loss, not -96.3%). remaining-strength.js guards measured>=nominal -> returns inconsistent data error instead of negative wall loss / bogus MAOP (9 psi). Defense in depth. tsc -b clean; guard + SA regression tests pass."
git push
```
Paste the push output.

## Still open from Test-2 (future deploys)
- Authority routing: produced-water discharge spool -> API 570 + API 579 with
  BSEE/USCG overlay, not API RP 2A default (finding #1).
- Mechanism prioritization: lead with produced-water corrosion, erosion-corrosion,
  chloride effects, chemical-injection failure, water-cut/flow change (finding #3).
- SA future-operating-reality urgency rule: escalate when min-thickness barely met
  AND production > design AND weather loading imminent AND consequence offshore/high
  (finding #4).
