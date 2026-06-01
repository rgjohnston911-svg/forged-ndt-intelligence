# DEPLOY447 — Information/monitoring assets as first-class (TEST 25) + the negation bug

TEST 25 (GPT 3.5) fed a semiconductor **Water Quality Assurance System** — analyzers,
monitors, control software, explicitly "NOT a pressure vessel / pipeline / tank / heat
exchanger" — and the live platform answered **heat_exchanger → API 510 → CORROSION**. Two
distinct, real bugs caused that; both are fixed here, and the scenario is now a permanent
gate (BREAKER_E).

## Bug 1 — the negation bug (front end)
`resolve-asset` matched the words "pressure vessel" / "vessel" that appear **only inside the
negation list** ("NOT a pressure vessel, pipeline, …") and scored them as positive evidence.
A scenario that says "this is NOT a pressure vessel" was classified as one.

**Fix:** a negation guard builds a scoring copy of the transcript with "not …" / "rather
than …" / "instead of …" spans (and their bullet lists) removed before alias scoring.
Negated nouns can no longer be counted as evidence.

## Bug 2 — no information/monitoring asset category (+ FMD manufacturing a mechanism)
Even with the negation fixed, the platform had no concept of a non-physical asset, and FMD
**manufactured** a CORROSION governing mechanism for a software monitoring system with zero
corrosion in the text — the exact "there must be a physical mechanism" bias GPT named.

**Fixes:**
- New **`instrumentation_monitoring`** asset family in `resolve-asset` (water quality
  assurance, analyzers, conductivity/TOC monitors, particle counters, sampling network,
  control software, SCADA, monitoring algorithms).
- **FMD non-physical guard:** an `instrumentation_monitoring` / `information_system` /
  `control_system` asset returns `governing_failure_mode: NONE` — FMD never manufactures
  corrosion/cracking/fatigue/structural for it. The governing reality is a system/assurance
  question, not a metallurgical one.
- **`authorityDerivation`:** `instrumentation_monitoring` → ISA-18.2 / IEC 62443 (control &
  alarm system assurance), **not** API 510.
- **`reconciliationLayer`:** broadened the deterministic axis floor to information-system
  vocabulary — assurance-loss signals (unvalidated/modified monitoring algorithms,
  documentation incomplete, software support expired, patch level behind, database migration,
  "normalization error / software suppressed a trend") and operational change (a modified,
  unvalidated algorithm is an unreassessed change). A non-physical asset is never scanned for
  physical damage.

## Result — the governing reality TEST 25 wanted
Reconciliation now returns, for the UPW scenario:
`asset = instrumentation_monitoring · authority = (no physical code) · tuple = ACCEPTABLE /
UNKNOWN_STATE / CHANGED_UNREASSESSED · mechanism = none · disposition =
restricted_reassessment_required · dual-hold = true` — i.e. **"the asset is acceptable, but
we cannot trust the system that tells us whether reality is changing."** That is "monitoring
assurance failure," reached without inventing corrosion.

## On GPT's "model drift / self-trust" (TEST 24) point
GPT noted a fourth concern: the *reasoning system's own* reliability degrading. The honest
mapping: the **AssuranceState** axis already encodes "can we trust the basis for this call?"
and the reconciliation layer already raises `requiresHumanReview` + a Tier-1 confidence-floor
HOLD when aggregate confidence is low or the hypothesis is degraded. That is the seed of
self-trust. A dedicated "model/self-confidence" signal may be worth promoting to an explicit
field later, but it does **not** need a new governing-reality class (that would reintroduce
enumeration growth). Tracking it as: AssuranceState=UNKNOWN_STATE + requiresHumanReview.

## Verified
- `npm run eval` → **19/19 hard**, XFAIL 0; BREAKER_E asserts asset=instrumentation_monitoring,
  must_not_contain [corrosion, heat_exchanger, API 510, API RP 2A, …], axis tuple ACCEPTABLE/
  UNKNOWN_STATE/CHANGED_UNREASSESSED + FINAL PRINCIPLE dual conclusion.
- `node scripts/run-gates.cjs` → **41/41**; `npx tsc -b` → clean.
- §13 ledger: governing_reality_classes **12** (no new class — handled by the tuple, not a
  new ladder entry), domain_classifier_keywords 210.

## Files
- `netlify/functions/resolve-asset.ts` (negation guard + instrumentation_monitoring family)
- `netlify/functions/failure-mode-dominance.js` (non-physical asset guard)
- `src/lib/reconciliationLayer.ts` (info-system assurance/operational + asset-aware physical)
- `src/lib/authorityDerivation.ts` (instrumentation_monitoring authority + family)
- `scripts/eval-sa.cjs` (asset-aware axis derivation; passes asset_class to FMD)
- `tests/fixtures/system-breakers.json` (BREAKER_E)
- `DEPLOY447-INSTRUCTIONS.md`

## Housekeeping
Delete the stray debug file if present: `rm -f scripts/eval-dbg.cjs` (it is untracked; do not commit it).

## Commit (from C:\dev\forged-ndt-intelligence — Git Bash, single-line add)
```bash
rm -f .git/index.lock scripts/eval-dbg.cjs
git add netlify/functions/resolve-asset.ts netlify/functions/failure-mode-dominance.js src/lib/reconciliationLayer.ts src/lib/authorityDerivation.ts scripts/eval-sa.cjs tests/fixtures/system-breakers.json DEPLOY447-INSTRUCTIONS.md
git commit -m "DEPLOY447 - Information/monitoring assets as first-class (TEST 25). Negation guard in resolve-asset (stop scoring nouns inside 'NOT a X' lists); new instrumentation_monitoring asset family; FMD non-physical guard (never manufacture corrosion/fatigue for a monitoring/software asset); authority derivation -> ISA-18.2/IEC 62443 not API 510; reconciliation axis floor broadened to information-system assurance/operational vocabulary. BREAKER_E gate: governing reality = ACCEPTABLE/UNKNOWN_STATE/CHANGED_UNREASSESSED (monitoring assurance failure), no invented mechanism. eval 19/19; gates 41/41; tsc clean; S13 flat (12 classes)."
git push
git log --oneline -1
```
