# DEPLOY443 — Stabilization Phase 5: authority derivation + component precedence (T13 retired)

Authority becomes **derived**, never keyword-selected, and the first baseline XFAIL (T13)
is retired the right way — by a general structural rule, with **no REAC-specific keyword
anywhere in the diff** (the sharpened exit gate from the review).

## The chain: Component → Asset → Authority

### `src/lib/authorityDerivation.ts` (new, pure, gated)
1. **`applyComponentPrecedence(assetClass, transcript)` — Phase 7 rule 3.**
   When a facility/equipment class wins (`pressure_vessel` / `heat_exchanger` /
   `refinery_process_facility`) but the transcript names an explicit **piping component**
   (inlet/outlet/process piping, header, dead leg, injection point, …), the piping is the
   inspected item → `process_piping`. A genuine `pipeline` winner is **never** rewritten.
   General rule keyed on component-vs-facility nouns — contains no asset-specific keyword.
2. **`deriveAuthority(assetClass)` — Phase 5.** Fixed Asset→Authority map: piping→API 570,
   vessel→API 510, tank→API 653, fired heater→API 530, offshore→API RP 2A, wind→IEC 61400,
   … An unknown asset yields **no** authority (`derived:false`) — a loose keyword can never
   select a code.
3. **`checkAuthorityConsistency(assetClass, citedCodes)` — Tier-1 veto.** If a cited code's
   asset family disagrees with the asset (e.g. API 653 tank code on piping), it returns a
   veto **with a cited reason**. (`pressure_vessel`/`heat_exchanger` share the vessel family,
   so API 510 on an exchanger is consistent.)

### `resolve-asset.ts` — component precedence inlined
The same rule is inlined (consistent with resolve-asset's self-contained style) right after
the winner is selected: a facility/equipment winner + an explicit piping noun → the asset
becomes `process_piping` (`component_override:true` recorded on `resolved`).

## T13 retired — the proof
The eval harness runs the real front end. With component precedence, the T13 transcript
("hydrocracker reactor effluent air cooler **inlet piping**") now resolves
`pressure_vessel → process_piping`, and authority-lock returns **API 570** (not API 510):

```
PASS  T13_reac_inlet_piping [process_piping / dom:refinery]
SA EVAL: 17 / 17 hard cases passed  (+ 1 tracked baseline XFAIL)
ARCH-HEALTH (S13): governing_reality_classes=12  domain_classifier_keywords=210  XFAIL=1
```

- **XFAIL 2 → 1** (only BREAKER_D remains, owned by Phase 3/6).
- The Phase-5 gate asserts `authorityDerivation.ts` contains **no "reac" substring** — the
  fix is a general rule, not a patch. Exit gate satisfied exactly as specified.
- **§13 ledger flat: 12 classes / 210 keywords, unchanged.** Structural fix, zero
  enumeration growth. XFAIL monotonically decreasing toward the Phase-9 target of 0.
- No regressions: all 17 hard cases pass, including the pipeline cases (T16/T20) which are
  correctly NOT rewritten to piping.

## Verified
- `node tests/authority-derivation.test.cjs` → 18 assertions (component precedence,
  asset→authority, Tier-1 veto, T13 chain → API 570, no-REAC-keyword invariant).
- `node scripts/run-gates.cjs` → **38/38**.
- `npx tsc -b` → clean.
- `npm run eval` → 17/17 hard (+1 XFAIL).

## Not yet (by design)
`deriveAuthority` + `checkAuthorityConsistency` are built and gated but not yet the live
report's authority source — `authority-lock` still routes today. The reconciliation layer
(Phase 9) will make the LLM hypothesis + derived authority + the Tier-1 veto the governing
path; until then the component-precedence classification fix already reaches production
through `resolve-asset`.

## Files
- `src/lib/authorityDerivation.ts`
- `netlify/functions/resolve-asset.ts` (component precedence inlined)
- `tests/authority-derivation.test.cjs`
- `DEPLOY443-INSTRUCTIONS.md`

## Commit (from C:\dev\forged-ndt-intelligence — targeted add)
```bash
node tests/authority-derivation.test.cjs && node scripts/run-gates.cjs && npx tsc -b && npm run eval

git add src/lib/authorityDerivation.ts \
        netlify/functions/resolve-asset.ts \
        tests/authority-derivation.test.cjs \
        DEPLOY443-INSTRUCTIONS.md

git commit -m "DEPLOY443 - Stabilization Phase 5: authority derivation (Component->Asset->Authority) + component precedence (Phase 7 rule 3). authorityDerivation.ts: piping component governs over facility/equipment context (pipeline never rewritten); fixed asset->authority map (no keyword-selected codes); Tier-1 cited-code-vs-asset consistency veto. Inlined component precedence into resolve-asset. T13 RETIRED: REAC inlet piping -> process_piping -> API 570 with NO REAC keyword (general rule). eval 17/17 hard (+1 XFAIL); gates 38/38; tsc clean; S13 flat (12/210), XFAIL 2->1."

git push
```

## Next — Phase 6: evidence gate for physical damage
A mechanism is `ACTIVE`/`CONFIRMED_DAMAGE` only with direct evidence (measured wall loss,
NDT crack indication, measured deformation, …). Consequence / missing records / high-risk
class / failures elsewhere support at most `SUSPECTED`. This + Phase 3 retires BREAKER_D
(re-welded branch crack + trace H2S must NOT make HIC govern) and is the last XFAIL.
