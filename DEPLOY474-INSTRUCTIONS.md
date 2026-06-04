# DEPLOY474 — #135 FMD Corrosion-Leg Fabrication Fix

**Scope:** ONE file — `netlify/functions/failure-mode-dominance.js`. Pure JS (var/concat/module.exports). No new file, no new state, no controller.
**Work order:** FORGED_135_FMD_CorrosionLeg_WorkOrder.md (operationalizes FORGED_FMD_CorrosionLeg_Fabrication_Directive §3/§4/§5).
**Status:** offline-verified; awaiting reviewer diff-check, then push by rj, then LIVE re-run of TEST 42.

## What changed (the fix = swap 3 loose gates to the verdict gate; nothing more)
Reuse the DEPLOY459 sub-path gate `corrConfirmed = (mev.confirmed === "corrosion") || (wallLossPercent > 0)`, hoisted to the governing layer so the governing block and the DEPLOY452 compulsion gate share it:
1. Branch-2 pressure-compare `governingMode = "CORROSION"` pick → requires `corrConfirmed` (else confirmed cracking governs).
2. SCREENING branch `else if (hasCorrosionMode && hasCrackingMode_screeningOnly)` → `else if (corrConfirmed && hasCrackingMode_screeningOnly)`. Inferred-only corrosion + screening cracking now falls through to the existing `SCREENING_REQUIRED` branch — which preserves the suspected HIC/SSC screening output WITHOUT asserting confirmed corrosion. (Gates both the `governingMode="CORROSION"` and the `interactionType="CORROSION_CONFIRMED_CRACKING_SCREENING"` here.)
3. Only-corrosion branch `else if (hasCorrosionMode)` → `else if (corrConfirmed)`.
4. DEPLOY452 compulsion-gate CORROSION leg `evidenced = clausePositive(DIRECT_CORR)` → `evidenced = corrConfirmed` (removes a keyword/clause gate; does not add one).

Diff: 21 insertions, 5 deletions. No other file touched. `node --check` clean (pure JS, not in the tsc build).

## Why
On no-corrosion / sour-service-worded inputs (TEST 42, alkylation/acid), the SCREENING branch fired off the LOOSE `hasCorrosionMode` (which counts INFERRED sour-service mechanisms) and set `interactionType=CORROSION_CONFIRMED_CRACKING_SCREENING` + a disposition_driver reading "the measured metal loss is the confirmed mechanism" — BEFORE the DEPLOY452 compulsion gate ran. That gate only downgrades `governingMode`, never those strings, so the report showed governing NONE next to "confirmed corrosion": the self-contradiction. The §459 sub-path already used the tight `corrConfirmed`; this brings the governing layer under the same gate.

## Acceptance gates — ALL hold offline (harness: outputs/fmd135-verify.cjs)
1. Fabrication gone: TEST 42 (no loss) → governingMode=SCREENING_REQUIRED; no "confirmed corrosion"; no "measured metal loss is the confirmed mechanism"; interaction_type=none; confirmed_governing_mechanism=null. PASS
2. Grounded inference PRESERVED (load-bearing): TEST 42 STILL surfaces suspected HIC/SSC screening (screening_gate.required=true, mechs include hic/ssc; suspected_governing=["hic","ssc"]) — framed suspected/screening, never confirmed. PASS
3. §2B traces unchanged: TEST 36 phantom suppressed; CUI+fatigue=CASCADE, MIC+HIC=SYNERGY, erosion+SCC=SYNERGY. PASS
4. Real corrosion unchanged: measured 45% loss + screening crack → CORROSION + CORROSION_CONFIRMED_CRACKING_SCREENING; 64% loss only → CORROSION. PASS
5. Suite: run-gates 49/49; eval-sa 20/20 (XFAIL=0); node --check clean. PASS

## Ship (rj runs all git)
```
git reset                 # clear any phantom-deletion staging first
git add netlify/functions/failure-mode-dominance.js DEPLOY474-INSTRUCTIONS.md
git status                # CONFIRM: no deleted tests/*.test.cjs or tsconfig.json staged
git commit -m "DEPLOY474: #135 FMD corrosion-leg verdict gate (kill inferred-corrosion 'confirmed corrosion' fabrication; preserve suspected HIC/SSC screening)"
git push
```
**LIVE verify (not offline-claimed):** after the Netlify build is green, re-run the TEST 42 alkylation case on the deployed build and confirm the report shows NO "confirmed corrosion" / NO "measured metal loss is the confirmed mechanism", governing = screening-required, and the suspected HIC/SSC screening recommendation is still present.

## Do NOT
No keyword/negation lock, no evidence-nullity lock, no new enum state, no engine-suppression/termination controller. The fix is the corrConfirmed verdict gate, nothing more. CP3 satellite directive is a separate, later pass.
