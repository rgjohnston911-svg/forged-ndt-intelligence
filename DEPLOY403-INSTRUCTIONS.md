# DEPLOY403 - Definitive question-loop fix (no re-pause after one answered round)

## Source: Case 41 (human-factors scenario) still showing repeating clarifying questions

## Why DEPLOY402 wasn't enough
DEPLOY402 suppressed re-asked questions by matching questionId AND normalized question
TEXT. But parse-incident is an LLM and can REPHRASE the same question on the re-run
("What is the material of the piping?" -> "What material is the piping made of?").
A rephrase changes the normalized text, so text-dedup misses it and the question is
re-asked -> the loop persists. (Backend still does not honor sa_responses, so
parse-incident keeps emitting questions on every re-run of the same transcript.)

## Fix (VoiceInspectionPage.tsx)
The clarifying-question pause now fires ONLY on the first round (`priorSa.length === 0`).
On any re-generation that already carries sa_responses (i.e. the user has answered a
round and clicked "Generate with Answers"), the pipeline NEVER re-pauses - it proceeds
with the answers the user gave, regardless of whether parse-incident re-emitted or
rephrased questions. The DEPLOY402 id/text dedup remains as belt-and-suspenders for the
first round.

This is robust to LLM id instability AND rephrasing. Unresolved items are not lost -
they still surface downstream via the SA unresolved-questions list and the confidence
layer (which is the correct place for "we proceeded without this answer").

## Behavior
- Fresh Analyze (no answers): asks one round of clarifying questions (unchanged).
- After you answer and click Generate with Answers: proceeds to the report, carrying
  your answers. Never re-asks.
- Click Analyze again on a new/edited transcript: fresh round (correct).

## Verification
- tsc -b clean. Frontend-only change (no engine touched); .cjs regression locks and
  benchmark are unaffected by this file.

## Files
- src/pages/VoiceInspectionPage.tsx   (pause gated on priorSa.length === 0)
- DEPLOY403-INSTRUCTIONS.md

## Commit
```bash
git pull
npx tsc -b
git add src/pages/VoiceInspectionPage.tsx DEPLOY403-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Then:
```bash
git commit -m "DEPLOY403 - definitive question-loop fix. Clarifying-question pause now fires only on the first round (priorSa.length===0); after the user answers a round, the pipeline proceeds with their answers and never re-asks, even if parse-incident rephrases the same questions (which defeated DEPLOY402 text dedup). Unresolved items still surface via the SA unresolved-questions / confidence layers. tsc clean; frontend-only."
git push
```
After pushing, WAIT for the Netlify build to finish, then HARD-REFRESH the browser
(Ctrl+Shift+R) before re-testing - the old bundle is cached.

## Next: confirm the human-factors archetype (Case 41) on the report
Once the loop is fixed and you answer one round, you'll reach the report. parse-incident
already "Understood" the human factors (production pressure, deferred-maintenance
backlog, loss of experienced personnel, undocumented contractor repair, outdated
procedures). The open question is whether the report makes those organizational/human
factors the GOVERNING concern (they should be, for this archetype) or just notes them.
Paste that report/eval and we close the human-factors archetype the same way we did
fatigue / consequence / support.
