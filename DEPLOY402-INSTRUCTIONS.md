# DEPLOY402 - Question-loop fix + support-governs archetype

Two fixes in one deploy, both from this session's feedback.

---

## Part A - "Platform repeats the same questions after I answer them"

### Root cause (VoiceInspectionPage.tsx)
After you answer the clarifying questions, the pipeline re-runs parse-incident on the
same transcript, which re-emits questions. The dedup that should suppress already-
answered questions matched ONLY on `questionId`. The parse-incident LLM does not return
a stable `questionId` across re-generations, so the id match failed and the SAME
question was re-asked - the loop you saw.

### Fix
The suppression now also matches on the **normalized question text** (lowercased,
whitespace-collapsed, trailing punctuation stripped), which `sa_responses` already
records (`questionText`). A question is suppressed if its id OR its normalized text is
already answered. Additive - only ever suppresses more; a fresh Analyze (no prior
answers) is unchanged.

---

## Part B - Support / secondary-element governs (support-governs archetype)

### Source: live-pack support scenario (Case 31 archetype)
Primary finding minor / within limits, but the pipe support beneath is corroding/
cracking; loss of support would drop/overload the line onto adjacent critical equipment
(cabling, scrubber, electrical). Question: is the obvious defect the governing risk? No -
the support is.

### Root cause (decision-core.ts)
"pipe support" / "spring hanger" were used ONLY as asset-classification confirmation
signals. The platform had no model for a degrading support as a governing risk, nor for
the cascade onto adjacent equipment. The FMD structural path only covers the asset's own
tilt/settlement/buckling, not a failing support beneath an otherwise-healthy line.

### Fix (resolveConsequenceReality + report)
New SUPPORT / SECONDARY-ELEMENT CASCADE GOVERNANCE block:
- Detects a degrading support (pipe support, hanger, shoe, saddle, trunnion, support
  steel, etc.) where the support is the SUBJECT of the degradation - forward scan capped
  at the next sentence boundary, or a degradation adjective immediately before the
  support term. This prevents pipe-side corrosion that merely mentions a support from
  false-firing.
- If loss of support would cascade onto adjacent critical equipment (adjacent / cabling /
  scrubber / electrical / drop / overload / onto): tier -> CRITICAL,
  failure_mode = "support_failure_cascade", collateral human/env impact.
- Support degrading without a named cascade: tier -> at least HIGH,
  failure_mode = "support_degradation".
- Emits `support_failure_governs` / `support_cascade`; the report shows a top banner:
  "GOVERNING RISK: SUPPORT FAILURE [+ CASCADE onto adjacent critical equipment] - the
  primary finding is within limits, but the degrading support is the governing concern."
- governing_failure_mode (mechanism lens) is untouched; this is the consequence/collateral
  lens naming the real governing risk.

### Verification (real resolveConsequenceReality, offline)
- support corroding + cascade onto cabling/scrubber/electrical -> CRITICAL, gov=true,
  cascade=true, mode=support_failure_cascade. <- the archetype.
- support corroding, no cascade -> HIGH, gov=true, cascade=false, mode=support_degradation.
- pipe-side corrosion, support in GOOD condition -> NOT governing (no false positive).
- support mentioned, no degradation -> NOT governing (no false positive).
- "corroded support ... adjacent equipment" (adjective form) -> CRITICAL, gov=true.

---

## Shared verification
- tsc -b clean; 23/23 regression locks; benchmark (49/50 / 100 / 100) and jurisdiction
  (50/50) unchanged.

## Files
- src/pages/VoiceInspectionPage.tsx   (Part A dedup + Part B support banner)
- netlify/functions/decision-core.ts  (Part B support-cascade governance)
- DEPLOY402-INSTRUCTIONS.md

## Commit (NOTE: DEPLOY400 + 401 are also still unpushed - this commit carries all three)
```bash
git pull
npx tsc -b
git add netlify/functions/decision-core.ts netlify/functions/future-state-forecaster.cjs src/pages/VoiceInspectionPage.tsx DEPLOY400-INSTRUCTIONS.md DEPLOY401-INSTRUCTIONS.md DEPLOY402-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Then:
```bash
git commit -m "DEPLOY400+401+402 - consequence/future-state/support fixes + question-loop fix. (400) receptor-exposure consequence amplifier (occupied/populated + hazard -> CRITICAL). (401) future-state forecaster catches passive/past-tense trend+deferred phrasings; forward-risk top-level banner. (402a) question dedup now matches normalized question TEXT not just LLM questionId, so answered questions are no longer re-asked. (402b) support/secondary-element cascade governance: a degrading support (subject-of-degradation gated) governs over a within-limits primary; cascade onto adjacent critical equipment -> CRITICAL; report shows GOVERNING RISK: SUPPORT FAILURE banner. tsc clean; 23/23 locks; benchmark/jurisdiction unchanged."
git push
```
Then re-run: the support scenario (expect the SUPPORT FAILURE governing banner + CRITICAL),
TEST 6 (life-safety CRITICAL), TEST 7 (forward-risk banner), and confirm the question
loop no longer re-asks answered questions.

## Note
This is the third archetype landed (fatigue, consequence, support) plus the future-state
robustness. Remaining live-pack archetype to probe: human-factors-governs (Case 41).
