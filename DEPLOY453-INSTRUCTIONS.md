# DEPLOY453 — FLEET_PATTERN disposition stopgap

## What this fixes (a quiet self-contradiction)

When the operational axis came back `FLEET_PATTERN` (a common change with failures across
sister/fleet units) on an otherwise-clean asset, the governing-reality **statement** said
"A fleet-level pattern governs…", but the **disposition** fell through to
`continue_with_conditions`. Statement and disposition disagreed — the report told you the
fleet pattern governed while concluding "continue."

Reproduced live-path (LLM hypothesis emitting FLEET_PATTERN, as it's instructed to):

```
BEFORE:  tuple ACCEPTABLE/ESTABLISHED/FLEET_PATTERN  ->  disposition continue_with_conditions   (contradicts statement)
AFTER:   tuple ACCEPTABLE/ESTABLISHED/FLEET_PATTERN  ->  disposition restricted_reassessment_required
```

Root cause: `isPhysicallyAcceptableButNotDispositionable` (the `dualHold` predicate) and the
disposition `if/else` were a hand-maintained enumeration of which operational states hold, and
`FLEET_PATTERN` was left off the list — while the statement block already handled it. The
deterministic floor didn't trip it, but the live LLM hypothesis does, so it was a live miss on
fleet scenarios (BREAKER_C / the wind-software case), not latent.

## The fix

One disposition branch in `src/lib/reconciliationLayer.ts`, placed to mirror the
governing-statement ordering (after `dualHold`, before `SUSPECTED`) so statement and
disposition agree for every fleet case. An adverse fleet-pattern operational reality now
governs over a clean physical pass — the no-default guarantee.

This is explicitly a **stopgap**. It is a patch to a hand-maintained enumeration, and the
governance contest (`governancePipeline.ts`) **deletes it by construction**: there, an adverse
operational *bid* governs uniformly, so no operational sub-state needs special-casing. Remove
this branch when the contest lands.

## Files
- `src/lib/reconciliationLayer.ts` — FLEET_PATTERN disposition branch (+ comment marking it for removal).
- `tests/reconciliation-layer.test.cjs` — golden trace: ACCEPTABLE/ESTABLISHED/FLEET_PATTERN -> `restricted_reassessment_required`, statement names "fleet".

## Verification (offline, all green)
- reconciliation-layer gate: 34 assertions pass (incl. new FLEET trace)
- `node scripts/eval-sa.cjs` -> 20 / 20
- `node scripts/run-gates.cjs` -> 42 / 42
- `npx tsc -b` -> clean (rc 0)

No render change, no engine-wide change — disposition logic + its test only.

---

## Git — run in Git Bash at /c/dev/forged-ndt-intelligence

This is its own standalone commit, separate from 452.

```bash
git add src/lib/reconciliationLayer.ts tests/reconciliation-layer.test.cjs DEPLOY453-INSTRUCTIONS.md
git commit -m "DEPLOY453: FLEET_PATTERN disposition stopgap - fleet pattern governs over a clean physical pass (matches governing statement); removed by the governance contest"
git push
```

(If the stale lock returns, close VS Code / GitHub Desktop and `rm -f .git/index.lock` first.)

## Live check
This is back-end disposition logic with no visible-string change, so there's no version bump to
look for. The behavioral check is: run a fleet scenario (common change + failures across sister
units, asset otherwise clean) and confirm the Governing Reality disposition reads
**restricted / reassessment required**, consistent with the "fleet-level pattern governs"
statement — not "continue."

Next after this lands: DEPLOY454 render subordination (the render-only pass), then the contest.
