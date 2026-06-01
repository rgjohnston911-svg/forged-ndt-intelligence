# DEPLOY442 — Stabilization Phase 4: confidence-tagged classification

Phase 4 makes the two front-end classifiers report not just *what* they decided but *how
well-grounded* that decision is — the raw material Phase 7 (no-destructive-override) and
Phase 9 (reconciliation) both depend on. Additive only: the existing `asset_class` /
`asset_type` / `detected_domain` fields are unchanged, so nothing downstream breaks.

## The contract
Every classification now carries `{ value, confidence, evidence, source, isDefault }`:
- **value** — the class chosen.
- **confidence** — 0..1. **No evidence ⇒ no confidence.**
- **evidence** — the exact terms that matched in the transcript (provenance).
- **source** — `alias-match` / `domain-keyword` when something matched, else `default`.
- **isDefault** — `true` when nothing matched and the class fell back to a default. Per the
  directive a default may **never** override an explicit finding (enforced in Phase 7).

## resolve-asset.ts
- Records which alias terms actually matched, per class (`matchedAliases`).
- Adds `value / evidence / source / isDefault` to `resolved`.
- When **no alias matches** (`best_score === 0`): `isDefault = true`, `source = "default"`,
  `evidence = []`, **`confidence = 0`** — a pure default now openly declares it has no
  evidence, instead of carrying a misleading 0.3 base. The no-text early return does the same.

## reality-lock.ts
- Adds a `classification` block for the **domain** call with the identical contract:
  `evidence` = the keyword hits, `confidence` derived from the domain score
  (≥15→0.8, ≥8→0.6, >0→0.4, 0→0), `isDefault = (score === 0)`, `source = domain-keyword|default`.
- This formalizes the DEPLOY439 instinct (a weak/defaulted domain match must not steamroll a
  confident asset) into a first-class, inspectable signal for the reconciliation layer.

## Verified (offline, real handlers)
- New gate `tests/classification-confidence.test.cjs` → 16 assertions:
  - furnace → `value=pressure_vessel`, `source=alias-match`, `isDefault=false`, `confidence>0`,
    `evidence` cites "furnace";
  - garbage text → `isDefault=true`, `source=default`, `confidence=0`, `evidence=[]`;
  - reality-lock furnace → `classification.value=refinery`, evidence non-empty, not default;
  - reality-lock garbage → `classification.isDefault=true`, `confidence=0`.
- `node scripts/run-gates.cjs` → **37/37**.
- `npx tsc -b` → clean.
- `npm run eval` → 16/16 hard (+2 tracked XFAIL). **ARCH-HEALTH §13 unchanged: 12 classes /
  210 keywords / XFAIL 2** — capability added, zero enumeration growth.

## Files
- `netlify/functions/resolve-asset.ts`
- `netlify/functions/reality-lock.ts`
- `tests/classification-confidence.test.cjs`
- `DEPLOY442-INSTRUCTIONS.md`

## Commit (from C:\dev\forged-ndt-intelligence — targeted add)
```bash
node tests/classification-confidence.test.cjs && node scripts/run-gates.cjs && npx tsc -b && npm run eval

git add netlify/functions/resolve-asset.ts \
        netlify/functions/reality-lock.ts \
        tests/classification-confidence.test.cjs \
        DEPLOY442-INSTRUCTIONS.md

git commit -m "DEPLOY442 - Stabilization Phase 4: confidence-tagged classification. resolve-asset + reality-lock now emit {value, confidence, evidence, source, isDefault}; no evidence => no confidence (unmatched -> isDefault true, confidence 0, evidence []); defaults flagged so Phase 7 can forbid them overriding explicit findings. Additive (asset_class/detected_domain unchanged). New Phase-4 gate (16 assertions). gates 37/37; tsc clean; eval 16/16; S13 health flat (12/210/2)."

git push
```

## Next — Phase 5: authority derivation
Authority becomes **derived**, never keyword-selected: `Component → Asset → Jurisdiction →
Authority` (Pipe→API 570, Vessel→API 510, Tank→API 653, Furnace→fired-heater standards,
Offshore platform→API RP 2A, …). `authority-lock` keeps a Tier-1 internal-consistency veto
(cited code vs asset class). This is the structural fix that retires the T13 XFAIL **without
a REAC-specific keyword** in the diff.
