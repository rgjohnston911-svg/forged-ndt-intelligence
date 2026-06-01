# DEPLOY449 — Monitoring-assurance failure governs a physically-healthy asset (flare-gas TEST)

The flare-gas scenario (Singapore refinery: a mechanically-healthy flare-gas recovery
compressor whose emissions analyzer was "smoothed" by an undocumented control-logic patch
while an independent transmitter still shows the spikes) exposed the next gap after the
DEPLOY447/448 cutover: a **physical** asset whose governing reality is **monitoring-trust
failure**. The reconciliation layer was returning "suspected dynamic-loading mechanism"
instead of "we can't trust the reported state."

## What changed (`src/lib/reconciliationLayer.ts`)
1. **Broadened assurance detection** to monitoring-trust vocabulary: control-logic/software
   patch, management-of-change "opened but not formally closed", change "not listed in vendor
   release notes / unsupported", independent transmitter/instrument still showing spikes,
   "no corresponding events recorded", "cannot be independently validated / no longer trust
   what the software shows".
2. **Broadened operational detection**: an installed patch with incomplete docs / unclosed
   MOC / vendor-unsupported is itself a `CHANGED_UNREASSESSED` operating change.
3. **New precedence — assurance governs over a *suspected* physical mechanism.** When there
   is no CONFIRMED damage but the assurance basis is `UNKNOWN_STATE`/`LOST_DESIGN_BASIS`, the
   controlling risk is "can we trust the reported state," not a weak suspected mechanism. (A
   CONFIRMED physical mechanism still outranks everything.)

## Result — the flare-gas governing reality
```
TUPLE:       SUSPECTED / UNKNOWN_STATE / CHANGED_UNREASSESSED
DISPOSITION: restricted_reassessment_required   (requires human review)
STATEMENT:   "A monitoring/assurance failure governs ... the reported state cannot be
              independently validated (loss of confidence in the basis for continued
              service); this is the controlling risk, not a physical damage mechanism ...
              continue physical operation with elevated, independent monitoring;
              reassessment/validation and escalation required."
```
That matches the ideal answer: continue physical operation, escalate, and treat the
inability to trust the emissions reporting as the governing risk — no corrosion, no API 579.

## Verified
- `npm run eval` → **20/20 hard** (new `BREAKER_F` locks assurance=UNKNOWN_STATE +
  operational=CHANGED_UNREASSESSED and forbids corrosion-governs/metal-loss-governs).
- Reconciliation gate → 31 assertions (adds: flare-gas statement frames monitoring-assurance
  and never says corrosion).
- `node scripts/run-gates.cjs` → 41/41; `npx tsc -b` → clean. §13 ledger flat (12 classes).

## Honest scope — the next cleanup (DEPLOY450)
The **governing-reality banner** (the headline, reconciliation-driven) is now correct for
this hybrid case. But the **legacy FMD supporting card** still emits a physical FFS package
(API 579 / SSC / HIC screening) for a physically-healthy asset — the body contamination GPT
flagged. The cutover means that is no longer the *governing* output, but the supporting card
should also be gated: when no mechanism is evidenced, FMD's `governing_code_reference` must
not default to API 579. That is the DEPLOY450 FMD-body cleanup (a careful change with full
regression coverage so genuine-mechanism cases keep their FFS code).

## Files
- `src/lib/reconciliationLayer.ts`
- `tests/fixtures/system-breakers.json` (BREAKER_F)
- `tests/reconciliation-layer.test.cjs` (flare governingStatement assertion)
- `DEPLOY449-INSTRUCTIONS.md`

## Commit + push (Git Bash, from /c/dev/forged-ndt-intelligence — NOT the OneDrive folder)
```bash
rm -f .git/index.lock
git add src/lib/reconciliationLayer.ts tests/fixtures/system-breakers.json tests/reconciliation-layer.test.cjs DEPLOY449-INSTRUCTIONS.md
git commit -m "DEPLOY449 - Monitoring-assurance failure governs a physically-healthy asset (flare-gas): broadened assurance/operational detection (control-logic patch, unclosed MOC, vendor-unsupported, instrument/historian disagreement) + assurance-governs-over-suspected-physical precedence. BREAKER_F added. eval 20/20; gates 41/41; tsc clean."
git push
git log --oneline -1
```
