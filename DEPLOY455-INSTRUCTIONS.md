# DEPLOY455 — Governance Contest CP1: the bid producer

First checkpoint of the contest phase (the §1 fold). **Invisible, pure logic, offline-verified** —
no render change, no disposition change. Safe to land on the committed base.

## What this does
- Adds the contest contract `src/lib/governancePipeline.ts` to the repo (it was only an uploaded
  artifact before). **Aligned to the live axis enums:** instead of redefining PhysicalState /
  AssuranceState / OperationalState locally, it now *imports* `PhysicalCondition` / `AssuranceState`
  / `OperationalChange` from `governingAxes.ts`. This was a real contradiction in the handed-over
  contract — its `OperationalState` had `OUTSIDE_ENVELOPE` but was **missing FLEET_PATTERN** (the
  live state). One enum source of truth; the drift this whole phase exists to kill, fixed at the
  type level before it could bite.
- Refactors `reconciliationLayer.ts` to emit three `AxisBid`s — `{ axis, state, tier, evidenceRefs,
  rationale }` — from the axis states it already computes. `tier` is **provenance, not a score**:
  DIRECT_MEASURED / DOCUMENTED / ABSENCE_CONFIRMED / NONE.

## What this deliberately does NOT do (CP1 boundary)
- **Disposition is unchanged.** The existing arbiter (`dualHold` / `assuranceGoverns` / etc.) still
  decides. The bids are *emitted*, not yet consumed. `runGovernanceContest` becomes the sole judge
  in **CP2** (DEPLOY456), where those predicates and the FLEET stopgap line get deleted.
- This keeps the system whole between checkpoints — there is never a moment with no disposition.

## Files
- `src/lib/governancePipeline.ts` — NEW (contract; axis enums imported from governingAxes).
- `src/lib/reconciliationLayer.ts` — bid producer: tier helpers + `buildBids` + `bids` on the return.
- `tests/reconciliation-layer.test.cjs` — CP1 golden trace (3 well-formed bids, valid tiers,
  physical bid matches the tuple, disposition still produced).

## Verification (offline, all green)
- reconciliation-layer gate: **40 assertions** pass (6 new CP1 bid checks)
- `node scripts/run-gates.cjs` -> 42 / 42
- `node scripts/eval-sa.cjs` -> 20 / 20
- `npx tsc -b` -> clean (rc 0)

---

## Git — run in Git Bash at /c/dev/forged-ndt-intelligence

```bash
git add src/lib/governancePipeline.ts src/lib/reconciliationLayer.ts tests/reconciliation-layer.test.cjs DEPLOY455-INSTRUCTIONS.md
git commit -m "DEPLOY455: governance contest CP1 - bid producer; add governancePipeline contract (axis enums imported from governingAxes, one source of truth); reconcile emits AxisBids; disposition unchanged"
git push
```

(Stale lock? close VS Code / GitHub Desktop, `rm -f .git/index.lock`.)

## Live check
None needed for CP1 — no visible change, no disposition change. Confidence is the offline suite.

## Still-open precondition
DEPLOY454 (v16.10) live confirmation is **still pending** from earlier. CP1 is invisible so it
doesn't depend on it, but please confirm v16.10 on screen before **CP3** (DEPLOY457+), which is the
server threading whose effects DO show in the report.

## Next
CP2 (DEPLOY456): wire `runGovernanceContest` as the sole arbiter; delete the enumerated predicates
and the 453 FLEET stopgap line (redundant by construction); verify TEST 24/25 + the FLEET case.
