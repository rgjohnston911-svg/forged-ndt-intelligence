# DEPLOY446 — Stabilization Phases 8 + 9: tiered veto + reconciliation layer (axis gates LIVE)

The capstone of the inverted flow. The reconciliation layer composes every prior phase into
a single governing decision expressed as the **three-axis tuple**, with Tier-1 hard vetoes
(cited reasons) and Tier-2 advisories. The system-breaker `axis_target_future` tuples are now
**live acceptance gates**, including Breaker A's FINAL PRINCIPLE dual conclusion.

## `src/lib/reconciliationLayer.ts` (new, pure, gated)
Consumes the LLM hypothesis (Phase 3) + deterministic suite (classification P4, authority
derivation P5, evidence gate P6) and reconciles them under the no-destructive-override rules
(P7).

- **`deriveAxesDeterministic(transcript)`** — the reproducibility floor (§12): produces a
  valid `{physical, assurance, operational}` tuple from documented facts even when the
  hypothesis is absent/degraded. A wrong or missing hypothesis still hits the same wall.
  - physical: CONFIRMED only with direct evidence; SUSPECTED on strong indirect (e.g. ≥2
    dynamic-loading signals); ACCEPTABLE on within-limits/non-finding language; else UNKNOWN.
  - assurance: LOST_DESIGN_BASIS (design-basis records lost) / UNKNOWN_STATE (≥2 loss-of-
    knowledge signals) / DEGRADED / ESTABLISHED.
  - operational: FLEET_PATTERN (common change + sister-unit failures) / CHANGED_UNREASSESSED
    (change without reassessment) / STABLE.
- **`reconcile(input)`** — folds asset claims under the override rules; merges the hypothesis
  only where it does not over-claim; applies **Tier-1 hard vetoes**:
  - *evidence* — a hypothesis asserting CONFIRMED_DAMAGE with no direct evidence is downgraded;
  - *consistency* — a cited code whose family disagrees with the asset (e.g. API 653 on piping);
  - *scope* — refused domains (nuclear/aerospace/spacecraft/medical) → refer out;
  - *confidence floor* — aggregate < 0.60 → forced HOLD;
  and emits the governing tuple, derived authority, mechanism, disposition (a function of the
  tuple), the conflict/veto ledger, and `requiresHumanReview`.

The disposition map realizes the FINAL PRINCIPLE: `ACCEPTABLE` + (`LOST_DESIGN_BASIS` |
`UNKNOWN_STATE` | `CHANGED_UNREASSESSED`) → **`restricted_reassessment_required`** —
"physically acceptable today, but not dispositionable."

## Axis gates are now LIVE in the eval
The harness computes the deterministic tuple per case and asserts each axis the fixture
specifies plus the dual-conclusion predicate. All four breakers now assert their tuples:

```
BREAKER_A  physical=ACCEPTABLE  assurance=LOST_DESIGN_BASIS  + FINAL PRINCIPLE dual ✓
BREAKER_B  physical=ACCEPTABLE  assurance=UNKNOWN_STATE ✓
BREAKER_C  operational=FLEET_PATTERN ✓
BREAKER_D  physical=SUSPECTED  operational=CHANGED_UNREASSESSED ✓
SA EVAL: 18 / 18 hard cases passed   XFAIL=0
```

(Breaker A's `axis_target_future` was corrected to an assurance-carried dual conclusion —
the furnace is a lost-design-basis case; the coking drift is a gradual process condition,
advisory only. Same fixture-accuracy discipline as the T16 correction.)

## Verified
- `node tests/reconciliation-layer.test.cjs` → 19 assertions (deterministic floor for all
  breakers, FINAL PRINCIPLE end-to-end, Tier-1 evidence/consistency/scope/confidence vetoes,
  conflict surfacing + requiresHumanReview).
- `node scripts/run-gates.cjs` → **41/41**.
- `npx tsc -b` → clean.
- `npm run eval` → 18/18 hard with **live axis gates**, XFAIL 0. §13 flat (12 classes / 210 keywords).

## Not yet (Phases 10-11)
The reconciliation layer is built, gated, and proven offline, but it does not yet **drive the
live report**. Phase 10 runs it in shadow (parallel, logged, not governing) until it has a
track record against production; Phase 11 flips the report to lead with the reconciliation
result (hypothesis · deterministic · reconciliation · conflicts · vetoes · governing tuple ·
disposition · ledger). Those touch the frontend and are the production cutover.

## Files
- `src/lib/reconciliationLayer.ts`
- `scripts/eval-sa.cjs` (compiles the lib stack; live axis assertions)
- `tests/reconciliation-layer.test.cjs`
- `tests/fixtures/system-breakers.json` (Breaker A axis target corrected)
- `DEPLOY446-INSTRUCTIONS.md`

## Commit (from C:\dev\forged-ndt-intelligence — targeted add)
```bash
node tests/reconciliation-layer.test.cjs && node scripts/run-gates.cjs && npx tsc -b && npm run eval

git add src/lib/reconciliationLayer.ts \
        scripts/eval-sa.cjs \
        tests/reconciliation-layer.test.cjs \
        tests/fixtures/system-breakers.json \
        DEPLOY446-INSTRUCTIONS.md

git commit -m "DEPLOY446 - Stabilization Phases 8+9: reconciliation layer + tiered veto. reconciliationLayer.ts composes hypothesis + deterministic suite + evidence gate + authority derivation under the override rules; deterministic three-axis floor (reproducibility per s12); Tier-1 hard vetoes (evidence/consistency/scope/confidence) with cited reasons; disposition realizes the FINAL PRINCIPLE (ACCEPTABLE + lost-basis/unknown/changed -> restricted_reassessment_required). Axis tuples now LIVE eval gates for all 4 breakers incl. FINAL PRINCIPLE. gate 19 assertions; gates 41/41; tsc clean; eval 18/18; S13 flat (12/210); XFAIL 0."

git push
```
