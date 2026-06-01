# DEPLOY445 — Stabilization Phase 7: no-destructive-override (the seven rules)

The safety spine for Phase 9. It generalizes the TEST 22 lesson into seven rules so a
weak / default / keyword signal can never silently overwrite a confident, explicit,
component-level finding — and every conflict is surfaced, never hidden.

## `src/lib/noDestructiveOverride.ts` (new, pure, gated)
`resolveOverride(current, proposed)` decides whether a challenger may replace the incumbent,
applying the seven rules:
1. Low confidence cannot override high confidence (challenger must beat the incumbent by a margin).
2. Defaults (`isDefault`) cannot override explicit findings.
3. Facility classification cannot override component classification.
4. A domain keyword cannot override an explicit asset.
5. A jurisdiction keyword cannot override an explicit asset.
6. Conflicts are surfaced (every disagreement returns a reason).
7. Conflicts are never hidden (`reduceClaims` accumulates all of them).

Claims are tagged by `kind` (`explicit-asset` / `component` / `facility` / `domain-keyword` /
`jurisdiction-keyword` / `default`) — the same `{value, confidence, evidence, source,
isDefault}` shape Phase 4 already emits. `reduceClaims(list)` folds an ordered set of claims
into one winner plus a list of `ConflictRecord`s.

The TEST 22 reference example is a gate assertion: `furnace (0.89, explicit)` vs
`offshore_platform (0.31, domain-keyword)` → **furnace wins, conflict logged** — and it stays
protected even if the keyword somehow reports higher confidence (Rule 4 is categorical, not
just numeric).

## Verified
- `node tests/no-destructive-override.test.cjs` → 12 assertions (all seven rules, the TEST 22
  reference example, a legitimate override still allowed, conflicts always surfaced).
- `node scripts/run-gates.cjs` → **40/40**.
- `npx tsc -b` → clean.
- `npm run eval` → 18/18 hard, XFAIL 0. §13 ledger flat (12 classes / 210 keywords).

Pure library; consumed by the Phase-9 reconciliation layer. No production wiring yet.

## Files
- `src/lib/noDestructiveOverride.ts`
- `tests/no-destructive-override.test.cjs`
- `DEPLOY445-INSTRUCTIONS.md`

## Commit (from C:\dev\forged-ndt-intelligence — targeted add)
```bash
node tests/no-destructive-override.test.cjs && node scripts/run-gates.cjs && npx tsc -b && npm run eval

git add src/lib/noDestructiveOverride.ts \
        tests/no-destructive-override.test.cjs \
        DEPLOY445-INSTRUCTIONS.md

git commit -m "DEPLOY445 - Stabilization Phase 7: noDestructiveOverride.ts (the seven rules). Low conf / default / facility / domain-keyword / jurisdiction-keyword can never silently override a confident explicit/component finding; conflicts always surfaced (reduceClaims). TEST 22 reference example gated (furnace 0.89 beats offshore_platform 0.31). gate 12 assertions; gates 40/40; tsc clean; eval 18/18; S13 flat (12/210)."

git push
```

## Next — Phases 8-9 (built together): tiered veto + reconciliation layer
Phase 8's tiered veto IS applied inside the Phase-9 reconciliation layer, so they land
together: `reconciliationLayer.ts` consumes the LLM hypothesis + the deterministic suite +
the evidence gate (Phase 6) + authority derivation (Phase 5) + the override rules (Phase 7),
applies Tier-1 hard vetoes (math / provenance / consistency / scope / confidence floor) with
cited reasons and Tier-2 advisories, and emits the **three-axis governing tuple** plus the
conflict/veto ledger. Then the breaker `axis_target_future` tuples (incl. Breaker A's FINAL
PRINCIPLE dual output) become live assertions.
