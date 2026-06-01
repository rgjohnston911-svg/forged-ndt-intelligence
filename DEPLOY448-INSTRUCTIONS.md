# DEPLOY448 — The cutover: the live report now reads governing reality from reconciliation

This is the integration step both reviewers said was the actual gap. For eleven phases the
reconciliation layer computed the correct governing reality and the live report threw it away,
rendering the legacy mechanism string instead (the "measured mechanism (corrosion, high
severity)" line). The brain was not connected to the mouth. This connects them.

## What changed
`src/pages/VoiceInspectionPage.tsx` (v16.7) — the **Governing Reality** banner now renders
`reconcile(...).governingStatement` (three-axis tuple) instead of the legacy
`resolveGoverningReality(...).statement`. The render:
- builds the reconciliation input from the live data already on the page (resolve-asset
  classification + confidence + `isDefault`, the transcript, and the authority-lock cited
  codes);
- renders the prose governing statement, the governing tuple, the disposition, any Tier-1
  vetoes / surfaced conflicts, and a `requires human review` flag;
- keeps the legacy arbiter as a small grey "supporting" line (nothing lost);
- is fully wrapped in try/catch and falls back to the legacy banner if reconciliation ever
  returns nothing — additive, never blocks the report.

`src/lib/reconciliationLayer.ts` — `reconcile()` now emits a human-readable
`governingStatement` generated from the tuple/vetoes/disposition (facts/physics only, no
behavioral inference). Examples now produced:
- **TEST 25 (monitoring):** "physically acceptable on current findings, but NOT
  dispositionable: the integrity-assurance basis cannot be established … loss of confidence in
  the basis for continued service … reassessment/validation required." **No "corrosion."**
- **Furnace:** "… NOT dispositionable: the design basis cannot be established (records lost) …"
- **Fleet:** "A fleet-level pattern governs … systemic, not a single-unit physical defect."

## Bundled with DEPLOY447
DEPLOY447 (negation guard + `instrumentation_monitoring` asset family + FMD non-physical
guard + broadened assurance/operational detection) was never pushed. It ships in the same
commit, because together they are what makes a live monitoring-system report stop saying
"heat_exchanger / API 510 / corrosion" AND start saying "monitoring assurance failure."

## Verified
- `npx tsc -b` → clean (the frontend type-checks — the real gate for a render change).
- `node scripts/run-gates.cjs` → **41/41** (reconciliation gate now also asserts the
  `governingStatement` wording: TEST 25 frames assurance failure and never says corrosion;
  furnace names lost design basis; fleet is systemic).
- `npm run eval` → 19/19 hard, XFAIL 0; §13 ledger flat (12 classes / 210 keywords).

## Honest scope
- The Governing Reality **top line** is now reconciliation-driven and reaches the screen.
- The other report cards (FMD, authority-lock, remaining-strength) still render from the
  legacy engines, but for a non-physical asset DEPLOY447's FMD guard makes FMD return NONE,
  so those cards no longer manufacture corrosion either.
- The LLM hypothesis (Phase 3) is not yet called in the live render — the cutover uses the
  deterministic reconciliation floor, which already produces the correct answers offline.
  Wiring the live LLM hypothesis call (via `llm-proxy`) is the remaining enrichment and can
  follow once this is confirmed on the live site.

## After deploy — the disambiguating live check
Run a BREAKER_E-style healthy-monitoring scenario on the live site and confirm:
1. the `VoiceInspectionPage` version reads **DEPLOY448 / v16.7**;
2. the Governing Reality banner reads the assurance/dispositionability statement, **not**
   "corrosion".

## Files
- `src/pages/VoiceInspectionPage.tsx` (cutover + version bump)
- `src/lib/reconciliationLayer.ts` (governingStatement)
- `tests/reconciliation-layer.test.cjs` (governingStatement assertions)
- `DEPLOY448-INSTRUCTIONS.md`
- (plus the DEPLOY447 files, shipped together)

## Commit + push (from C:\dev\forged-ndt-intelligence — Git Bash, single-line add)
```bash
rm -f .git/index.lock scripts/eval-dbg.cjs
git add netlify/functions/resolve-asset.ts netlify/functions/failure-mode-dominance.js src/lib/reconciliationLayer.ts src/lib/authorityDerivation.ts src/pages/VoiceInspectionPage.tsx scripts/eval-sa.cjs tests/fixtures/system-breakers.json tests/reconciliation-layer.test.cjs DEPLOY447-INSTRUCTIONS.md DEPLOY448-INSTRUCTIONS.md
git commit -m "DEPLOY447+448 - Information/monitoring assets as first-class (TEST 25) + Governing-Reality CUTOVER: live report banner now reads the reconciliation three-axis tuple/statement instead of the legacy mechanism string. Negation guard, instrumentation_monitoring family, FMD non-physical guard, broadened assurance/operational detection. eval 19/19; gates 41/41; tsc clean; S13 flat (12 classes)."
git push
git log --oneline -1
```
