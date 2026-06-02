# DEPLOY456 — Governance Contest CP2: the single arbiter

The §1 fold completed: `runGovernanceContest` is now the **sole** disposition authority.
reconciliation = perception (bids), contest = judgment. Built against the corrected v2 contract
(directional-conflict-plus-causal-merge; the axis contest is **merge-only**).

## What changed
- **`governancePipeline.ts` replaced with v2** (merge-only contest; no count-based escalate
  branch). Kept the CP1 adaptation: axis enums **imported from governingAxes** (one source of
  truth) rather than redefined locally.
- **`reconciliationLayer.ts`:**
  - The disposition `if/else` (the enumerated `dualHold` / `assuranceGoverns` predicates) and the
    **DEPLOY453 FLEET stopgap** are **deleted**. Disposition now comes from
    `runGovernanceContest(bids)`, mapped to the legacy disposition vocabulary (physical CONFIRMED →
    fitness_for_service; SUSPECTED → monitor; assurance/operational/compound → restricted).
  - **Causal link recorded at perception (Q5):** when a change makes operations adverse *and* the
    assurance basis is doubted via loss-of-knowledge signals, the assurance bid is tagged
    `causedBy: "OPERATIONAL"`. The contest absorbs the cause → assurance governs (not a fabricated
    multi-axis conflict). Not set for LOST_DESIGN_BASIS (records loss, not the change).
  - `gStmt` (Governing Reality top line) rewritten to key off the contest result, with a new
    **compound** branch for genuinely-independent same-direction concerns.
  - Tier-1 scope/confidence-floor overrides preserved on top of the contest.
- **FLEET stopgap deleted by construction** — `isAdverse()` treats any operational state != STABLE
  as adverse, so FLEET_PATTERN governs with no special-casing.
- Version bumped **v16.10 → v16.11** (the Governing Reality top line is reconcile output, so this
  CP is live-visible on multi-adverse cases).

## Surfaced deviation (deliberate, not hidden)
The directive said delete `isPhysicallyAcceptableButNotDispositionable`. I **removed it from the
disposition path** (the substantive requirement — the contest decides) but **kept the pure
predicate** in `governingAxes.ts`, used only for the informational `physicallyAcceptableNot­Dispositionable`
flag and the FINAL-PRINCIPLE concept tests (llm-hypothesis, reconciliation-layer). Deleting the
function would churn two test files over a still-valid concept with no behavioral benefit. Flag if
you'd rather it be fully removed.

## Contest behavior (verified)
| case | tuple | contest result |
|---|---|---|
| E (monitoring) | ACCEPTABLE/UNKNOWN_STATE/CHANGED | operational absorbed → **assurance governs** (restricted) ✓ |
| A (furnace) | ACCEPTABLE/LOST_DESIGN_BASIS/STABLE | **assurance governs** (restricted) ✓ |
| C (fleet) | ACCEPTABLE/ESTABLISHED/FLEET_PATTERN | **operational governs** via contest, no stopgap ✓ |
| D / F (multi-adverse) | — | **merge, never escalate** (compound) ✓ |
| characterized wall loss | CONFIRMED_DAMAGE | **fitness_for_service** (no regression) ✓ |

**Known interim:** F resolves as a *compound* (suspected-physical + assurance) rather than pure
assurance-governs, because the deterministic floor still labels its pressure-spikes as a suspected
physical signal. The statement still reads "monitoring/assurance failure governs alongside…", so
it is not contradictory. F's full §5 resolution lands at **CP4** (the assurance recognizer). Not a
regression.

## Verification (offline, all green)
- reconciliation-layer gate: **45 assertions** (5 new CP2: causal merge, FLEET-by-contest, FFS no-regression)
- llm-hypothesis gate: 23 (FINAL PRINCIPLE predicate intact)
- `node scripts/run-gates.cjs` → 42 / 42
- `node scripts/eval-sa.cjs` → 20 / 20
- `npx tsc -b` → clean

---

## Git — run in Git Bash at /c/dev/forged-ndt-intelligence

```bash
git add src/lib/governancePipeline.ts src/lib/reconciliationLayer.ts tests/reconciliation-layer.test.cjs src/pages/VoiceInspectionPage.tsx DEPLOY456-INSTRUCTIONS.md
git commit -m "DEPLOY456: governance contest CP2 - runGovernanceContest is the sole arbiter; delete enumerated predicates + FLEET stopgap; causal merge (causedBy) so multi-adverse merges not escalates; v16.11"
git push
```

## Live check (this also clears the still-pending 454/455 confirmation)
Hard-refresh → subtitle **v16.11**. Re-run a monitoring/assurance scenario (TEST 29 ESD or
BREAKER-E-like) and confirm the Governing Reality reads an assurance/operational governing reality
(no fabricated "conflict / escalate" at the axis level, no manufactured mechanism). A clean
characterized-wall-loss case must still read fitness-for-service.

## Next
CP3 (DEPLOY457+): the server-side consumption contract — hoist the evidence pre-pass (after
provenance, before Authority Lock), then thread the mechanism-evidence verdict through the four
satellites one per commit. **This is the one that needs 454/455/456 confirmed live first**, since
it changes the report body.
