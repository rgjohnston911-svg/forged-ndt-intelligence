# FORGED 4D NDT - Phase 0 Benchmark Report (v1)

Labeled cases: **50**. Offline-scored layers only; authority / mechanism / disposition / governing-risk require live full-pipeline runs and are not auto-scored here.

## Per-layer scorecard

| Layer | Accuracy | Detail |
|---|---|---|
| Domain classification | 98% | 49/50 exact match |
| Organizational detection | 100% | F1 100 (TP19 TN31 FP0 FN0) |
| Forecast-driver detection | 100% | F1 100 (TP23 TN27 FP0 FN0) |

## Misses (where to look next)
- **C13** Qatar LNG compressor redundancy — domain pressure_equipment != unknown

_Run: `node tests/benchmark-runner.cjs`. Benchmark frozen at tests/fixtures/benchmark/ndt-benchmark-v1.json._