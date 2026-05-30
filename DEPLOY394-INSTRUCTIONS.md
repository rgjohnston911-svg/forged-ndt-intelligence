# DEPLOY394 - Phase 0 benchmark (tracked) + Phase 1 first burn-down

## What this is
The roadmap's Phase 0 (a frozen, labeled benchmark + repeatable scorer) plus the
first Phase-1 catch->fix->re-score loop against it. This is the moment the platform
gets a real, auditable accuracy number instead of friendly-corpus theater.

## The benchmark (new, version-controlled)
- `benchmark/ndt-benchmark-v1.json` - 25 labeled diverse cases (real assets,
  jurisdictions, "the finding isn't the problem" traps). Each case carries expected
  labels for the OFFLINE-scoreable layers (domain, org_failure, forecast_driver) plus
  should_escalate / governing_risk / jurisdiction for live scoring later.
- `benchmark/run.cjs` - the scorer. `node benchmark/run.cjs` prints a per-LAYER
  scorecard and writes `benchmark-report.md`. Reproducible, frozen.
- Authority / mechanism / disposition stay LIVE-ONLY by design and are not
  auto-scored here (honest about what offline can see).

## Score movement (same frozen 25 cases)
| Layer | Before | After |
|---|---|---|
| Domain classification | 88% | **96%** (24/25) |
| Organizational detection | 100% | 100% |
| Forecast-driver detection | 88% | **100%** |

(Remaining classification miss is C13, a label edge - an LNG-facility refrigeration
compressor routes to pressure_equipment via "lng"; rotating equipment is arguably
out-of-scope/unknown. Left as an honest edge, not overfit.)

## The three fixes (each surfaced BY the benchmark)
1. **Negation guard** (future-state-forecaster.cjs + situational-awareness-
   organizational.cjs): a keyword hit preceded by no/not/without/never/free-of is
   ignored. Kills the "no severe weather" / "no active leak" false-positives - the
   over-escalation failure mode. Generalizes across both detectors.
2. **Forecast phrasing** (forecaster): added flow-rate / velocity / slurry-velocity
   increase to PRODUCTION_INCREASE (fixed the FAC and erosion cases).
3. **Refinery disambiguation** (domain-classifier.cjs): refinery + coker /
   hydrotreater / hydrocracker / alkylation / reactor-effluent are now domain-
   defining (unambiguous override) and added to the refinery keyword set, so
   refinery process scenarios stop losing to generic terms like "transfer line".

## No regressions (all locks pass; two improved)
domain-classifier (unit/corpus/realworld), sa-diverse-realworld, organizational
(Test-1 + 100/150 corpora), future-state, convergence - all PASS. Corpus supported
count 55->57 and diverse-56 forecast 42->44 (improvements, not regressions). Test-1
still 7 indicators. tsc -b clean.

## Files (7; benchmark/ + report + 3 engines + this doc are tracked; tests/*.cjs are ignored)
- benchmark/ndt-benchmark-v1.json   (new, tracked - the yardstick)
- benchmark/run.cjs                 (new, tracked - the scorer)
- benchmark-report.md               (new, tracked - current scorecard)
- netlify/functions/future-state-forecaster.cjs        (negation guard + flow/velocity)
- netlify/functions/situational-awareness-organizational.cjs (negation guard)
- netlify/functions/domain-classifier.cjs              (refinery disambiguation)
- DEPLOY394-INSTRUCTIONS.md          (this file)

## Commit
```bash
git pull
node benchmark/run.cjs
node tests/sa-diverse-realworld.test.cjs
node tests/domain-classifier-corpus.test.cjs
npx tsc -b
git add benchmark/ benchmark-report.md DEPLOY394-INSTRUCTIONS.md netlify/functions/future-state-forecaster.cjs netlify/functions/situational-awareness-organizational.cjs netlify/functions/domain-classifier.cjs
git status
git diff --cached --stat
```
Then:
```bash
git commit -m "DEPLOY394 - Phase 0 benchmark (tracked) + Phase 1 burn-down. Adds benchmark/ (25 labeled cases + run.cjs scorer + report). Fixes from the benchmark: negation guard (no/not/without) in forecaster + org engines (kills 'no severe weather' false-positives), forecast flow/velocity phrasing, refinery domain disambiguation. Frozen-benchmark score: classification 88->96%, forecast 88->100%, org 100%. All regression locks pass (corpus 55->57, diverse-56 forecast 42->44; Test-1 intact). tsc -b clean."
git push
```
Paste the push output.

## Next (Phase 1 continues, benchmark-measured)
- Jurisdiction resolver completion (France/Indonesia/...) + add jurisdiction scoring
  to the benchmark once the resolver covers the corpus countries.
- Metric-units extraction; dead-leg recognition.
- Grow the benchmark toward ~150 labeled cases as the trusted yardstick.
- Phase 2: wire + calibrate conformal-prediction for an honest confidence number.
