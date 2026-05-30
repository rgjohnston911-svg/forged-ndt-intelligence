# DEPLOY393 - Classifier disambiguation (unambiguous domain-defining override)

## Why
Every real-world test battery exposed the same classifier defect: a generic
high-weight keyword collapsed the wrong domain. The diverse 10/20 sets proved 3:
- FPSO turret -> bridge_civil (matched "bearing")
- offshore wind monopile -> offshore_oil_gas (matched "offshore")
- nuclear feedwater -> unknown (the DEPLOY388 weak-signal guard suppressed a
  single "nuclear" hit)

## Fix (single file: domain-classifier.cjs)
Added an UNAMBIGUOUS domain-defining override. Terms that uniquely define a
domain (fpso, wellhead, riser; monopile, wind farm, offshore wind; nuclear,
reactor core; aircraft, airframe; spacecraft, satellite; rocket engine, etc.)
now select that domain over a higher-scoring GENERIC term, and let a clearly
unsupported domain (nuclear/wind/aircraft/spacecraft) classify on its defining
term instead of being guarded to "unknown". Also added monopile / offshore wind
/ transition piece to the wind_energy keyword list. The DEPLOY388 weak-signal
guard still protects against AMBIGUOUS single-keyword routing (e.g. bare
"cryogenic" still does NOT become rocket).

reality-lock already delegates to this module (DEPLOY388/390), so the fix flows
through with no other change.

## Result
- Real-world classification: **5/8 -> 8/8** correct (FPSO, wind, nuclear fixed;
  others unchanged).
- The classification corpus now CORRECTLY classifies its genuine aerospace cases
  (AERO-096 aircraft, AERO-100 spacecraft) instead of suppressing them; the
  Test-3 invariant (no INDUSTRIAL case routes to rocket/spacecraft) still holds.
- All regressions pass: domain-classifier unit + corpus, sa-diverse-realworld,
  organizational, future-state, convergence. tsc -b clean.

## Files (2; tests git-ignored)
- `netlify/functions/domain-classifier.cjs`  (+40/-1: UNAMBIGUOUS_TERMS + override)
- `DEPLOY393-INSTRUCTIONS.md`

## Commit
```bash
git pull
node tests/domain-classifier-realworld.test.cjs
node tests/domain-classifier-corpus.test.cjs
npx tsc -b
git add netlify/functions/domain-classifier.cjs DEPLOY393-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Then:
```bash
git commit -m "DEPLOY393 - Classifier disambiguation. Unambiguous domain-defining override: terms like fpso/monopile/nuclear/aircraft select their domain over generic high-weight terms (bearing/platform) and classify clearly-unsupported domains instead of guarding to unknown. Fixes FPSO->bridge, wind->offshore, nuclear->unknown (real-world 5/8 -> 8/8). DEPLOY388 weak-signal guard intact (bare cryogenic still not rocket); corpus + all regressions pass. tsc -b clean."
git push
```
Paste the push output.

## Remaining from the difficult-mechanism battery (separate work)
- Mechanism coverage audit: the platform models CUI/HTHA/brittle-fracture/erosion/
  HIC-SOHIC/FAC/fatigue/crack/API-579-levels broadly. ONE true gap: **dead leg**
  (0 files) -- add dead-leg/stagnant-service recognition (Test 27).
- Jurisdiction resolver still misses France/Indonesia (global-authority-engine).
- The difficult mechanism tests (21-40) are orchestration-behavior tests
  (escalate-not-thickness-only, request-missing-data) -> evaluate via LIVE
  full-pipeline runs, not offline.
