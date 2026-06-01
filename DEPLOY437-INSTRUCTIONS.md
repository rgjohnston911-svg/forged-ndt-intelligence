# DEPLOY437 — Assurance-failure / UNKNOWN state + structural non-finding gate + convergent precedence (TEST 21 & 20)

## TEST 21 ("The Sleeping Dragon", 9.4) — uncertainty as the governing risk
An LNG tank with NO defect: every physical finding within limits (settlement 12 mm vs 75 mm,
wall loss 1.8% below concern, no crack, no leak), but the integrity-assurance BASIS is gone
(foundation baseline destroyed, 11 years of records lost, settlement monitoring failed 18 months,
regional subsidence never reviewed). The governing risk is the **loss of the ability to know**.

GPT's findings: (a) the governing-reality top line correctly identified assurance failure — a major
win; but (b) the FMD/decision-core layer **fabricated** "structural instability / foundation
instability / capacity exceeded" from the within-limits settlement, contradicting itself.

### Fixes
1. **Structural non-finding gate (FMD):** a settlement/tilt documented as within-limits/acceptable
   and NOT as an exceedance is a NON-FINDING, not structural instability. Verified: TEST 21 no longer
   fabricates structural; a genuine excessive/accelerating/differential settlement still fires.
2. **New governing-reality class `ASSURANCE_FAILURE_UNKNOWN_STATE`** (the first-class "UNKNOWN" state
   GPT asked for): >=2 documented "loss of ability to know" facts (missing/destroyed baseline, lost
   records, failed monitoring, unreviewed external change) + no confirmed defect -> the governing
   reality is uncertainty itself: "the facility has lost the ability to know the asset's condition …
   physical findings are within limits but cannot be trusted as a basis for continued service … hold
   pending restoration of the ability to know." Facts only; no behavioral inference.

## TEST 20 follow-through — convergent mechanism precedence
Once structural stopped masking it, FMD exposed a `suspected=[fatigue]`, so the arbiter fired the
thinner SUSPECTED class. Reordered **CONVERGENT_MECHANISM_GOVERNS above SUSPECTED**: a strong
multi-stream convergence (>=3 streams) now gives the richer "vibration-induced fatigue governs;
structural finding is a contributing cause" statement.

## Verified
- `npm run eval` -> **12/12** (TEST 21 -> ASSURANCE_FAILURE_UNKNOWN_STATE + no structural fabrication;
  TEST 20 -> CONVERGENT_MECHANISM_GOVERNS; all prior cases unchanged).
- `node scripts/run-gates.cjs` -> 35/35; `tsc -b` clean.

## Honest scope — still NOT fixed (the dedicated next FMD build)
The governing-reality TOP LINE is now correct for TEST 21 (assurance failure). But the FMD mechanism
banner can still surface a fabricated **corrosion / cracking** path from a non-finding / negation
("no corrosion", "no active crack growth", "wall loss below concern"). The structural fabrication is
gated; corrosion + cracking non-finding/negation suppression is the next focused FMD pass — it needs
full eval coverage so genuine corrosion (REAC 64%) and confirmed cracks are unaffected. Also still
open: the falsely-precise 0% forecast (TEST 20) — a forecaster honesty fix.

## Bundle (everything uncommitted since DEPLOY433)
- `src/lib/governingReality.ts` — SYSTEM_DRIFT (domain-agnostic), CONVERGENT_MECHANISM_GOVERNS (now
  above SUSPECTED), ASSURANCE_FAILURE_UNKNOWN_STATE
- `netlify/functions/failure-mode-dominance.js` — dynamic-fatigue dominance + structural non-finding gate
- `scripts/eval-sa.cjs` — eval hardening
- `tests/fixtures/sa-eval-cases.json` — TEST 16–21 (corpus now 12)
- `DEPLOY434/435/436/437-INSTRUCTIONS.md`

## Commit (from C:\dev\forged-ndt-intelligence)
```bash
npm run eval
node scripts/run-gates.cjs
git add src/lib/governingReality.ts netlify/functions/failure-mode-dominance.js scripts/eval-sa.cjs tests/fixtures/sa-eval-cases.json DEPLOY434-INSTRUCTIONS.md DEPLOY435-INSTRUCTIONS.md DEPLOY436-INSTRUCTIONS.md DEPLOY437-INSTRUCTIONS.md
git commit -m "DEPLOY434-437 - Governing-reality maturation (TEST 16-21): dynamic-fatigue dominance, SYSTEM_DRIFT (domain-agnostic hub/hydrogen/grid), CONVERGENT_MECHANISM_GOVERNS (cause vs mechanism), structural non-finding gate, ASSURANCE_FAILURE_UNKNOWN_STATE (uncertainty as the governing risk). Eval corpus 12; eval 12/12; gates 35/35; tsc clean."
git push
```
