# DEPLOY396 - Benchmark grown to 50 + 2 benchmark-surfaced fixes + decision-layer rubric

## Benchmark v1 grown 25 -> 50 cases
Added 25 ground-truth-labeled cases (more domains: power/marine/tank/refinery
variants; more don't-escalate/false-positive cases; negation-guard tests; varied
jurisdictions). Bigger N => the number means more.

## Score on the 50 cases (offline auto-scored layers)
| Layer | Accuracy |
|---|---|
| Domain classification | 98% (49/50) |
| Organizational detection | 100% (F1 100) |
| Forecast-driver detection | 100% (F1 100) |
(Only remaining miss: C13, an LNG-facility refrigeration compressor that routes to
pressure_equipment via "lng" - rotating equipment is arguably out-of-scope/unknown;
left as an honest label edge, not overfit.)

## Two fixes, each surfaced BY a new benchmark miss
1. **Classifier**: dropped the bare ambiguous keyword "rail" (it matched "crane
   rail wear" -> rail domain). Railway scenarios still classify via railcar / track
   / freight train / derailment / railway. (domain-classifier.cjs)
2. **Org engine**: removed "near misses" from HUMAN_FACTORS - it is a trend signal
   (already a forecast driver), not a management-system failure; it was double-
   counting and causing an org false-positive. (situational-awareness-organizational.cjs)
Plus a LABEL correction: C47 (emergency spillway unavailable) -> org_failure true,
consistent with the SAFETY_BARRIER_DEGRADATION category (the benchmark validating
its own labels again).

## New: decision-layer benchmark (the live-only blind spot)
`benchmark/decision-layer-benchmark.md` - turns the 50-case Governing-Mechanism /
Disposition / Escalation battery into a LIVE-scored rubric. Its 5 archetypes
(fatigue-not-corrosion, consequence-not-crack, future-state-not-wall-loss,
support-not-primary, human-factors-not-technical) carry ground-truth answers, so
running them in the deployed app yields a decision-layer score (passes/50). This
is the layer the offline harness cannot see and the prerequisite the Arbiter spec
depends on.

## Verification
All regression locks PASS (domain unit/corpus/realworld, sa-diverse, organizational
Test-1 + 100/150 corpora, future-state, convergence). tsc -b clean.

## Files (6)
- benchmark/ndt-benchmark-v1.json           (25 -> 50 cases; C47 label fix)
- benchmark/decision-layer-benchmark.md     (new - live-scored decision-layer rubric)
- benchmark-report.md                       (regenerated; 98/100/100)
- netlify/functions/domain-classifier.cjs   (drop bare "rail")
- netlify/functions/situational-awareness-organizational.cjs  (remove "near misses" from org)
- DEPLOY396-INSTRUCTIONS.md                  (this file)

## Commit
```bash
git pull
node benchmark/run.cjs
node tests/domain-classifier-corpus.test.cjs
node tests/situational-awareness-organizational-corpus.test.cjs
node tests/sa-diverse-realworld.test.cjs
npx tsc -b
git add benchmark/ benchmark-report.md netlify/functions/domain-classifier.cjs netlify/functions/situational-awareness-organizational.cjs DEPLOY396-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Then:
```bash
git commit -m "DEPLOY396 - Benchmark grown 25->50 + 2 benchmark-surfaced fixes + decision-layer rubric. Classifier drops ambiguous bare 'rail' (matched 'crane rail'); org removes 'near misses' (it's a forecast trend, not org). C47 label -> org true (barrier degradation). 50-case score: classification 98%, org 100%, forecast 100%. Adds benchmark/decision-layer-benchmark.md (live-scored governing-mechanism/disposition/escalation rubric). All locks pass; tsc -b clean."
git push
```
Paste the push output.

## Next
- Run the decision-layer rubric live (the real measure of "understands reality").
- Grow benchmark further; extract jurisdiction resolver to .cjs for a 4th auto layer; metric units; dead-leg; Phase 2 confidence calibration.
