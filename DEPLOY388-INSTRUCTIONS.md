# DEPLOY388 - Classifier weak-signal guard + LNG fix (Test-3 class)

## The bug (GPT eval Test-3)
An LNG export terminal scenario was classified as `rocket_test_article` and the
platform refused -- no analysis at all. Root cause: reality-lock's domain scorer
listed bare `"cryogenic"` as an `aerospace_ground_test` keyword. In the LNG text
"cryogenic" was the ONLY keyword that hit (score 8, every supported domain 0),
so a single weak keyword confidently routed a valid industrial scenario into an
exotic, unsupported domain.

## The systematic fix (not just one keyword)
1. **Shared classifier module** `netlify/functions/domain-classifier.cjs` -- the
   single source of truth for the domain keyword tables + scoring. reality-lock
   now delegates to it.
2. **Weak-signal guard** -- the platform never commits to an UNSUPPORTED domain
   unless the signal is corroborated (>= 2 keyword hits AND score >= 16). On weak
   signal it falls back to the best supported domain with real signal, else
   "unknown" (AI-interpretation path) -- never a confident wrong refusal. This
   kills the whole "one overloaded keyword -> exotic misroute -> refuse" class.
3. **Keyword precision** -- bare `"cryogenic"` replaced with `"cryogenic
   propellant"` (rocket-specific); LNG/process terms (`lng`, `lng terminal`,
   `lng transfer`, `transfer line`, `cryogenic transfer/piping/storage`) added to
   the supported `pressure_equipment` domain.

## Verification (durable, corpus-locked)
- `tests/domain-classifier.test.cjs` -- unit battery: LNG -> pressure_equipment;
  weak single-keyword exotic -> guarded; GENUINE multi-keyword rocket/nuclear
  still classify correctly; supported domains unchanged.
- `tests/domain-classifier-corpus.test.cjs` -- runs the **100-case multi-domain
  battery** (`tests/fixtures/ndt-100-case-battery.md`) through the classifier and
  asserts the Test-3 class CANNOT recur: **0 of 100** industrial cases route to
  rocket/spacecraft; LNG -> pressure_equipment; 56 land in supported domains.
- `tsc -b` clean.

## Files (3 committed; tests + fixture are git-ignored, run locally)
- `netlify/functions/domain-classifier.cjs`  (new shared classifier + guard)
- `netlify/functions/reality-lock.ts`         (delegates to the module; +13/-4)
- `DEPLOY388-INSTRUCTIONS.md`                  (this file)

## Commit
```bash
git pull
node tests/domain-classifier.test.cjs
node tests/domain-classifier-corpus.test.cjs
npx tsc -b
git add netlify/functions/domain-classifier.cjs netlify/functions/reality-lock.ts DEPLOY388-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Confirm 3 files staged (reality-lock should be small ~+13/-4; if it shows the
whole file it reverted to CRLF -- re-run is fine). Then:
```bash
git commit -m "DEPLOY388 - Fix Test-3 classifier misroute (LNG -> rocket_test_article). New shared domain-classifier.cjs with a weak-signal guard: never commit to an unsupported domain without >=2 keyword hits AND score>=16, else fall back to supported/unknown. Bare 'cryogenic' (->'cryogenic propellant') no longer false-triggers aerospace; LNG/process keywords added to pressure_equipment. reality-lock delegates to the module. Locked by a 100-case corpus regression: 0 rocket/spacecraft misroutes. tsc -b clean."
git push
```
Paste the push output.

## Known follow-ups (next deploys)
- **DEPLOY389 (coverage):** the corpus shows ~40 valid process-plant assets
  (amine, hydrogen, steam, ammonia, deadleg, firewater, LPG sphere, etc.) fall to
  `unknown` -> AI-only. Expand the domain keywords so they route to a supported
  domain and get the full deterministic pipeline. Verify against the corpus.
- **DEPLOY390 (core battery):** wire the Claude `ndt_deterministic_battery.js`
  adapter to decision-core (offline) for permanent property-based coverage of the
  core, the FUNC-1 HOLD coupling, and the DEPLOY385 measured>=nominal guard.
