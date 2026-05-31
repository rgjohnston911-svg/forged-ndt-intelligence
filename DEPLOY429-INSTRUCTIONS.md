# DEPLOY429 — Confirmed-MEASURED vs Suspected-GOVERNING mechanism labeling

## The issue (GPT, TEST 10/13/14)
The report showed "Confirmed governing mechanism: CORROSION / Suspected: FATIGUE." That conflates
two different things: corrosion is what the UT actually *measured*, but it is NOT what governs the
disposition — the suspected vibration-induced fatigue is. Labeling corrosion "GOVERNING" contradicts
the disposition driver (fatigue) printed just below it.

## The fix (labeling only — the engine was already right)
`failure-mode-dominance` already computes the three concepts separately
(`governing_failure_mode` = the measured/calc mode, `suspected_governing_mechanism`,
`disposition_driver`). Only the report's wording blurred them. In `VoiceInspectionPage` the FMD
banner now reads:

- When a suspected governing mechanism exists: **"CONFIRMED MEASURED MECHANISM: CORROSION"**
  (no longer "GOVERNING (CONFIRMED MECHANISM)").
- **"SUSPECTED GOVERNING MECHANISM (pending confirmation): VIBRATION-INDUCED FATIGUE"**
- **"DISPOSITION DRIVER: …"** (unchanged — already correct).
- When nothing is suspected, the confirmed mode is correctly labeled **"GOVERNING MECHANISM:"**.

So for TEST 14 the report now reads, in order: Confirmed measured = corrosion; Suspected governing =
vibration-induced fatigue; Disposition driver = the unresolved fatigue risk. No contradiction.

## Verified
- `tsc -b` clean; `node scripts/run-gates.cjs` → 34/34 (no engine behavior changed; rendering-only).

## Files
- `src/pages/VoiceInspectionPage.tsx` (FMD banner labels)
- `DEPLOY429-INSTRUCTIONS.md`

## Commit (from C:\dev\forged-ndt-intelligence)
```bash
npx tsc -b
node scripts/run-gates.cjs
git add src/pages/VoiceInspectionPage.tsx DEPLOY429-INSTRUCTIONS.md
git commit -m "DEPLOY429 - Confirmed-MEASURED vs Suspected-GOVERNING mechanism labels. FMD banner now labels the measured mode (corrosion) as CONFIRMED MEASURED MECHANISM and reserves GOVERNING for the suspected mechanism + disposition driver, so 'corrosion' is no longer mislabeled governing when fatigue is the real disposition driver. Rendering-only; tsc clean, gates 34/34."
git push
```

## Note — Edit-tool truncation
The Edit tool truncates this large (~2,985-line) file's tail in this environment, independent of
OneDrive. All edits to `VoiceInspectionPage.tsx` should be done via a full safe rewrite (the
git-restore + python-patch approach used here), not the Edit tool.

## Still queued (not built)
- "GOVERNING REALITY" as an explicit labeled line (operational change without engineering
  reassessment) — needs a source-of-truth decision (convergence vs org-failure layer).
- Whether CRITICAL consequence should trigger for H2S / offshore pressure-boundary cases.
