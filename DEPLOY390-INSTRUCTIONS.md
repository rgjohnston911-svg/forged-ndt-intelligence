# DEPLOY390 - Wire jurisdiction-aware codes + US comparison (global-authority-engine)

## What this fixes
The platform is supposed to detect the asset's location, apply that jurisdiction's
governing codes/standards, and compare them to the US codes. That capability was
ALREADY built -- `global-authority-engine.ts` (v2.2.0) has a Jurisdiction
Resolver, a 20-country authority matrix, a US<->foreign Standard Equivalency
crosswalk, and a unit-conversion engine -- but **nothing ever called it** (its
only references were itself and the health registry). The pipeline used only the
US-centric `authority-lock`. So for the Test-3-style global scenarios, no
jurisdiction detection or code comparison ever happened. This is the same
"built but inert" pattern as FUNC-1.

## The fix (frontend wiring only -- engine already deployed)
In `VoiceInspectionPage.tsx`, after `authority-lock` runs, the pipeline now makes
a best-effort call to `global-authority-engine` with:
- `location_text` = transcript (the engine's resolver detects the country),
- `asset_type` = classified asset,
- `requested_code` = the primary US code `authority-lock` selected.

The engine returns the detected jurisdiction, the governing local authority, and
the US->local crosswalk (e.g. API 570 -> "NORSOK M-001 / DNV-RP-G101" in Norway,
API 510 -> "CSA B51" in Canada, API 570 -> "BS EN 13480 / PER 1999" in the UK),
plus an inspector message stating the US code is reference-only unless
contractually adopted. Rendered as a new "Jurisdiction & Applicable Codes" card
on-screen and a matching section in the report PDF.

Best-effort: any failure is logged to errors[] and never blocks the report.

## Verification
- `tsc -b` clean.
- Engine offline-verified (compiled standalone) across corpus jurisdictions:
  - Norway (offshore, API 570) -> NORSOK M-001 / DNV-RP-G101
  - Canada/Alberta (API 510)   -> CSA B51
  - United Kingdom (API 570)   -> BS EN 13480 / PER 1999 / SAFed
  - Germany (PED/EN/TUV), USA (API/ASME) -> correct jurisdiction + authority
- Frontend wiring is +37/-1, LF, file intact.

## Post-deploy live check
Run a NON-US scenario (e.g. the Saudi/Norway/China cases from the global battery).
Confirm the "Jurisdiction & Applicable Codes" card appears with the detected
country, local governing authority, and the US->local crosswalk.

## Files (2; engine pre-exists, no backend change)
- `src/pages/VoiceInspectionPage.tsx`   (+37/-1: best-effort call + on-screen card + PDF section + state/interface)
- `DEPLOY390-INSTRUCTIONS.md`            (this file)

## Commit
```bash
git pull
npx tsc -b
git add src/pages/VoiceInspectionPage.tsx DEPLOY390-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Confirm 2 files staged (VoiceInspectionPage ~+37/-1; if it shows the whole file
it reverted to CRLF -- re-run is fine). Then:
```bash
git commit -m "DEPLOY390 - Wire jurisdiction-aware codes + US comparison. The built-but-inert global-authority-engine (jurisdiction resolver + 20-country authority matrix + US<->foreign crosswalk) is now called from the pipeline after authority-lock, passing the transcript as location_text and the US code as requested_code. Renders detected jurisdiction, local governing authority, and US->local code crosswalk (e.g. API 570 -> NORSOK/DNV in Norway) on-screen + in the PDF. Best-effort; never blocks the report. tsc -b clean."
git push
```
Paste the push output.

## Known follow-up
The engine's `CROSSWALK_MATRIX` is "abbreviated for v2.2" -- some country x code
cells are empty (e.g. ASME B31.3 has no EU/Germany row), so the US->local field
is blank there even though the jurisdiction + local authority still resolve.
DEPLOY391 candidate: expand CROSSWALK_MATRIX coverage (more codes x more
jurisdictions), locked by the 150-case global corpus.
