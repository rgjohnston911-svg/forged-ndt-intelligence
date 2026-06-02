# DEPLOY462 — Governance Contest CP4a: the safety-function assurance recognizer

The load-bearing fix for the TEST 29 / 31 / 32 trio. The platform now **recognizes** that a
protective/safety function's integrity is unverified and concludes **verify the safety function** —
instead of failing safe for the wrong reason (mechanism uncertainty) or quietly concluding continue.

CP4 has two recognizers; this is the **assurance recognizer**. Regulatory routing (TEST 30) is the
next commit (CP4b).

## What changed
- **`src/lib/reconciliationLayer.ts`** — a new safety-function assurance recognizer in the
  perception layer. When the asset is a protective/safety function (SIS / ESD / relief / interlock /
  BMS / SIF / trip system / feed isolation) **and** either:
  - **protective demand is up while protective response is down** (excursions/upsets/challenges
    increasing while trips/activations/isolations decreasing, or "events that previously isolated now
    only alarm"), or
  - **a logic/software change occurred with no independent validation** ("independent safety
    validation report not found" — and a *closed MOC is not validation*),

  → the **assurance bid is set to UNKNOWN_STATE (adverse)**. The contest then makes assurance govern →
  `restricted_reassessment_required`, and the governing statement reads **"A safety-function assurance
  failure governs … verify the safety function per IEC 61511 … escalate to a functional safety engineer
  and PSM/MOC authority."**
- **Recognize-and-escalate boundary held:** the engine names the governing reality, the missing
  evidence (SRS, pre/post logic comparison, independent validation, SIL/LOPA verification), and the
  authority to escalate to. It does **NOT** compute the SIL or run the LOPA — those are escalation
  items it raises, not answers it produces.
- Falsifiable + no over-fire: a clean, independently-validated SIS with stable demand/response stays
  ESTABLISHED; a non-safety asset is unaffected.
- Version **v16.15 → v16.16**.

## Verified (reconciliation-layer gate, +6 CP4 assertions = 51 total)
- SIS, demand↑/response↓ + missing validation → assurance UNKNOWN_STATE → restricted; statement names
  safety-function assurance + IEC 61511; no manufactured corrosion/cracking.
- ESD, demand↑/response↓ → assurance UNKNOWN_STATE.
- **No over-fire:** clean, independently-validated SIS → ESTABLISHED.
- (`buildBids` already tags `causedBy` when an operational change co-occurs, so a SIS whose logic
  change also reads as operational still merges to assurance-governs, not a fabricated conflict.)

## Verification (offline, all green)
- reconciliation-layer gate: **51 assertions**
- `node scripts/run-gates.cjs` → **46 / 46**
- `node scripts/eval-sa.cjs` → 20 / 20 (no regression — non-safety assets unaffected)
- `npx tsc -b` → clean

---

## Git — run in Git Bash at /c/dev/forged-ndt-intelligence

```bash
git add src/lib/reconciliationLayer.ts tests/reconciliation-layer.test.cjs src/pages/VoiceInspectionPage.tsx DEPLOY462-INSTRUCTIONS.md
git commit -m "DEPLOY462: governance contest CP4a - safety-function assurance recognizer (SIS/ESD demand-vs-response divergence or logic change without independent validation -> assurance UNKNOWN_STATE -> verify the safety function per IEC 61511); v16.16"
git push
```

## Live check (v16.16) — the conclusion check
Re-run **TEST 31 / TEST 32** (SIS) and **TEST 29** (ESD). The **Governing Reality** should now read
**"A safety-function assurance failure governs … verify the safety function per IEC 61511 … escalate
to a functional safety engineer and PSM/MOC"** — i.e., it now *concludes the right thing*, not just
"no mechanism / hold on the confidence gate."

Still expected (the last item): asset class may still show pressure_vessel / API 510 (the §6
classifier — SIS class + identity-precedence). That's authority-routing cleanup; the governing
*conclusion* is now correct.

## Next
- **CP4b:** regulatory routing (TEST 30) — a stated regulatory/jurisdictional nonconformance on a
  physically-clean asset drives "fit for service, resolve the regulatory correction; no FFS / no
  mechanism NDE."
- **§6:** classifier (SIS class + identity-precedence so SIS stops routing to API 510; Gulf-of-Mexico
  jurisdiction word-boundary).
- Then freeze TEST 29 / 31 / 32 (and 30) as the golden acceptance set.
