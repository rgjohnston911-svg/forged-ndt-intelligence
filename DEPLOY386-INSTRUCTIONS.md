# DEPLOY386 - FUNC-1: activate the unresolved-CRITICAL -> confidence-penalty/HOLD coupling

## The gap (Gap Analysis HIGH / FUNC-1)
`decision-core.ts` called `saGate.validateSet(saResponses, [], startMs)` with the
required-questions list hardcoded to `[]`. So `stats.criticalUnresolved` was
**always 0**, and the Stage-5 confidence penalty / HOLD-on-unresolved-CRITICAL
(decision-core line ~6430) could **never fire**. The brief's core SA safety
mechanism -- an opinion-only CRITICAL question should reduce confidence and HOLD
-- was silently neutralized.

## Fix (one localized change, frozen core)
Each submitted `sa_response` already carries `questionId` + `questionDecisionImpact`
(built by the frontend). decision-core now derives the required-questions list
from the responses it already receives and passes it to `validateSet`:

```
var saRequired = [];
for (...) saRequired.push({ questionId: r.questionId, decisionImpact: r.questionDecisionImpact || "MEDIUM" });
saValidatedSet = saGate.validateSet(saResponses, saRequired, startMs);
```

Because the UI answers questions at `STAKEHOLDER_OPINION` / provenance `REPORTED`
(rank 2, NOT a STRONG provenance of MEASURED/OBSERVED/DOCUMENTED), any CRITICAL
question answered by opinion is correctly UNRESOLVED -> `+0.10` penalty each
(capped `+0.30`) -> the existing HIGH/CRITICAL-tier confidence gate HOLDs
naturally. The penalty consumer was already wired; only the `[]` was wrong.

## Why this is safe
- The change lives entirely inside `if (saResponses)`. Any run WITHOUT
  `sa_responses` (all golden/blind cases -- confirmed none send the field) never
  executes it and is **byte-identical**. No frontend change, no gate-condition
  change.
- `tsc -b` clean. No determinism/patent invariant touched (this completes the
  already-authorized Stage-5 SA block; the DecisionPackage hash is unaffected).

## Verification
- `tests/sa-func1-hold-coupling.test.cjs` (git-ignored): baseline `[]` -> 0 (the
  bug); 2 opinion CRITICAL -> criticalUnresolved 2 / penalty 0.20; cap at 0.30;
  MEASURED CRITICAL -> resolved (0); non-CRITICAL opinion -> 0; mixed -> exactly 1.
- Post-deploy sanity (optional): run the live golden suite -- it MUST stay
  100/100 unchanged, since it sends no `sa_responses`.

## Files (2)
- `netlify/functions/decision-core.ts`   (+17/-1: derive requiredQuestions)
- `DEPLOY386-INSTRUCTIONS.md`             (this file)
(`tests/sa-func1-hold-coupling.test.cjs` is git-ignored.)

## Commit
```bash
git pull
node tests/sa-func1-hold-coupling.test.cjs
npx tsc -b
git add netlify/functions/decision-core.ts DEPLOY386-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Confirm 2 files staged (decision-core diff should be small, ~+17/-1 -- if it
shows the whole file, the working copy reverted to CRLF; re-run is fine). Then:
```bash
git commit -m "DEPLOY386 - FUNC-1: activate unresolved-CRITICAL HOLD coupling. decision-core derives requiredQuestions from sa_responses (questionId+questionDecisionImpact) instead of passing []; opinion-only CRITICAL questions (provenance REPORTED) are now unresolved -> +0.10/ea penalty (cap 0.30) -> existing confidence gate HOLDs. Change is inside the sa_responses block, so non-SA runs are byte-identical (golden/blind unaffected). tsc -b clean; gate regression test passes."
git push
```
Paste the push output.

## Known follow-up (not in this deploy)
A CRITICAL question left COMPLETELY unanswered (all options skipped -> empty
`sa_responses`) still won't HOLD, because decision-core's SA block is gated on
`sa_responses` being non-empty. Catching that needs (a) carrying the full asked
question list and (b) running validation even with empty responses -- a
gate-condition change that intersects BUG-4 (surface dropped/unanswered CRITICAL
questions). Recommend a separate, regression-tested deploy.
