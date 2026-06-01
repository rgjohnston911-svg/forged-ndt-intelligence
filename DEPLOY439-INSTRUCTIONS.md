# DEPLOY439 — Furnace→Offshore misclassification killed at the root (TEST 22) + CONTROL_SOFTWARE_FLEET_FAILURE (TEST 22 wind)

## TEST 22 (Japan ethylene cracker furnace, GPT 8.2) — the dangerous one

GPT: *"The engine completely hallucinated the asset … classified it as an Offshore
Platform / API RP 2A / structural-instability / personnel fatality. The authority lock
appears to have inherited state from prior offshore scenarios. That's dangerous —
because once the authority engine is wrong, everything downstream becomes contaminated."*

### Root cause (reproduced offline, NOT state leakage)
It was a deterministic, repeatable classification bug — provable in isolation:

1. `domain-classifier.cjs` listed the generic word **"hydrocarbon"** as an
   `offshore_oil_gas` keyword. The furnace transcript ("mixed feed including heavier
   **hydrocarbons**") scored `offshore_oil_gas = 12`, beating every other domain.
2. `reality-lock.ts` then checked asset-vs-domain compatibility. Its
   `DOMAIN_ASSET_MAP` lists only `offshore_platform` as compatible with offshore, so a
   correctly-resolved `pressure_vessel` (resolve-asset had it right: furnace →
   `pressure_vessel` / `fired_heater` @ 0.8) was deemed "in conflict" and
   **force-overridden to `offshore_platform`** — which cascaded into API RP 2A,
   offshore structural-instability, and a fabricated fatality consequence.

resolve-asset was never wrong. The override destroyed its correct answer.

### Fix — two facts-only corrections (no behavioral inference)

1. **"hydrocarbon" removed from the offshore keyword list** (both `domain-classifier.cjs`
   and `reality-lock.ts`). Fact: hydrocarbons are present across all hydrocarbon
   processing — refineries, pipelines, petrochemical plants, *and* offshore — so the
   word is not evidence of *offshore*. Offshore is evidenced by offshore-specific
   structures (platform, jacket, riser, subsea, fpso, wellhead, cellar deck, boat
   landing, topside, splash zone), which remain.

2. **Fired-heater / petrochemical terms added to the SUPPORTED `refinery` domain**
   (`furnace`, `fired heater`, `process heater`, `ethylene cracker`, `cracker furnace`,
   `steam cracker`, `petrochemical`, `coking`, `decoking`, `convection section`,
   `radiant section`, `tube metal temperature`). A fired-heater furnace is process
   pressure equipment; it now routes to the full deterministic pipeline instead of
   falling to "unknown". `refinery` already lists `pressure_vessel` as compatible, so
   no override fires.

3. **Defense-in-depth (reality-lock): a domain-keyword score may not override a
   high-confidence asset.** resolve-asset identifies the asset from an explicit asset
   noun and reports a confidence; that is stronger evidence than a domain keyword tally.
   When parsed-asset confidence ≥ 0.7, reality-lock now **retains the specific asset**
   and emits an advisory instead of silently swapping in the domain's generic default.
   This stops the "everything downstream contaminated" cascade for *any* future
   mis-scoped keyword, not just this one. Facts only; no behavioral inference.

### Verified (offline, end-to-end)
- Reality-lock on the actual furnace transcript with `parsed_asset_class=pressure_vessel`,
  `confidence=0.8` →
  `detected_domain: refinery | asset_conflict: false | asset_override: null |
  routing_decision: full_pipeline`. (Was: offshore_oil_gas / true / offshore_platform.)
- Genuine offshore still classifies offshore (platform/jacket/riser/subsea = 71);
  FPSO still offshore (38); refinery coker still refinery (57). No regression.
- New permanent regression in `tests/domain-classifier.test.cjs`: furnace must NOT be
  offshore, must be `refinery`/supported; bare "hydrocarbon" must not imply offshore.
- New eval case `T22_furnace_petrochemical_not_offshore` (`must_not_contain`: API RP 2A,
  offshore platform, jacket, brace node, splash zone).
- `npm run eval` → **14/14**; `node scripts/run-gates.cjs` → **35/35**; `tsc -b` clean.

## Also in this bundle — CONTROL_SOFTWARE_FLEET_FAILURE (TEST 22 wind)
The wind scenario (a control-software upgrade followed by multiple sister-unit failures)
gets a governing-reality class that recognizes a common software/control change + a
fleet-wide failure pattern as the governing reality (signature-gated on `softwareChange`
AND `fleetAfterChange`; facts only). Covered by eval case
`T22_wind_turbine_software_fleet`.

## Honest scope — still NOT fixed (unchanged from DEPLOY437)
The FMD mechanism banner can still surface a fabricated corrosion/cracking path from a
non-finding/negation ("no corrosion", "no active crack growth"). The governing-reality
top line is correct; the FMD non-finding suppression is the next focused pass and needs
full eval coverage so genuine corrosion (REAC 64%) / confirmed cracks are unaffected.
Also still open: the falsely-precise 0% forecast (forecaster honesty fix).

## Files changed this deploy
- `netlify/functions/domain-classifier.cjs` — remove "hydrocarbon" from offshore; add fired-heater/petrochemical terms to refinery
- `netlify/functions/reality-lock.ts` — remove "hydrocarbon" from offshore; high-confidence-asset override guard
- `tests/domain-classifier.test.cjs` — TEST 22 furnace regression
- `tests/fixtures/sa-eval-cases.json` — T22 furnace eval case

## Full uncommitted bundle (DEPLOY434–439, all still unpushed)
- `src/lib/governingReality.ts` — SYSTEM_DRIFT (domain-agnostic), CONVERGENT_MECHANISM_GOVERNS, ASSURANCE_FAILURE_UNKNOWN_STATE, CONTROL_SOFTWARE_FLEET_FAILURE
- `netlify/functions/failure-mode-dominance.js` — dynamic-fatigue dominance + structural non-finding gate
- `netlify/functions/domain-classifier.cjs`, `netlify/functions/reality-lock.ts` — DEPLOY439 (this doc)
- `scripts/eval-sa.cjs` — eval scorer hardening
- `tests/fixtures/sa-eval-cases.json`, `tests/domain-classifier.test.cjs`
- `DEPLOY434/435/436/437/439-INSTRUCTIONS.md`

## Commit (run from C:\dev\forged-ndt-intelligence — targeted add; the tree shows broad
## line-ending noise from the OneDrive→C:\dev relocation, so add ONLY these files)
```bash
npm run eval && node scripts/run-gates.cjs && npx tsc -b

git add netlify/functions/domain-classifier.cjs \
        netlify/functions/reality-lock.ts \
        src/lib/governingReality.ts \
        netlify/functions/failure-mode-dominance.js \
        scripts/eval-sa.cjs \
        tests/domain-classifier.test.cjs \
        tests/fixtures/sa-eval-cases.json \
        DEPLOY434-INSTRUCTIONS.md DEPLOY435-INSTRUCTIONS.md \
        DEPLOY436-INSTRUCTIONS.md DEPLOY437-INSTRUCTIONS.md \
        DEPLOY439-INSTRUCTIONS.md

git commit -m "DEPLOY434-439 - Governing-reality maturation (TEST 16-22): dynamic-fatigue dominance, SYSTEM_DRIFT (domain-agnostic), CONVERGENT_MECHANISM_GOVERNS, structural non-finding gate, ASSURANCE_FAILURE_UNKNOWN_STATE, CONTROL_SOFTWARE_FLEET_FAILURE. TEST 22 root-cause fix: 'hydrocarbon' removed from offshore keywords + fired-heater/petrochemical -> refinery + high-confidence-asset override guard in reality-lock (furnace no longer hallucinated as offshore_platform/API RP 2A). Facts only; no behavioral inference. eval 14/14; gates 35/35; tsc clean."

git push
```
