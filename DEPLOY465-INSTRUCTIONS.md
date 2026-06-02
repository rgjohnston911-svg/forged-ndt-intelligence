# DEPLOY465 — Generalized assurance recognizer (§3): one recognizer for SIS, ESD, and a control loop

Generalizes the DEPLOY462 safety-function recognizer into **one** protective/control-function
assurance recognizer that fires on *function behavior*, not asset class — so it covers TEST 29/31/33
(SIS/ESD) **and** TEST 34 (a control loop layered on a physically-fit vessel) with no state-per-flavor.

## The two ideas doing the work
- **No-assurance-default (§1):** a protective/control function is ESTABLISHED only on *affirmative
  validation*. A closed MOC is not validation; "no independent validation found" is an assurance gap,
  not a neutral. Mirror of no-physical-default, pointed at the assurance axis.
- **Keys on behavior, not asset class (§2):** engages whenever an automatic protective/control
  function's behavior is described — covering a SIS (asset = the function) and a vessel with a
  degraded control loop (asset = vessel, function on top) with one recognizer.

## What changed (`src/lib/reconciliationLayer.ts`)
- Replaced the safety-specific recognizer with `assuranceRecognizer(t)` over three falsifiable,
  stated-fact signals: **A** automatic action declining, **B** demand *or human compensation* rising
  (TEST 34's generalization), **C** validation basis not affirmatively established.
  - `A AND B` (behavioral divergence) → assurance **UNKNOWN_STATE**.
  - `C` alone → assurance **DEGRADED**.
  - none → recognizer does not fire (ESTABLISHED via the normal path; no fabrication).
- `functionKind` (SAFETY vs CONTROL) drives **citation/escalation routing only** (§5): SAFETY →
  IEC 61511 / ISA 84 / functional safety engineer; CONTROL → ISA 18.2 / process control engineer +
  process safety + MOC. Both cite PSM/MOC. The governing statement names the flavor.
- The manual-takeover / human-compensation signal is folded in as the assurance bid's **basis**, not
  a competing operational bid (so the contest can't mis-assign governance to operational).
- **Recognize + escalate only** — the platform cites IEC 61511 / ISA 18.2 / PSM and names the missing
  validation; it does NOT compute SIL, run LOPA, or analyze control loops. No per-flavor state, no
  engine-suppression firewall.

## Bug caught during build (worth noting)
The first draft's "action declining" regex used a bare `N%` as a decrease token — it falsely matched
"interventions **increased 55%**" as a decline. Tightened to decrease *words* only, and added
"automatic control / control action" to the subject list so "automatic control actions decreased"
matches legitimately. Measured, not assumed.

## Verified (reconciliation-layer gate: 57 assertions)
| case | result |
|---|---|
| TEST 31 SIS (safety divergence) | UNKNOWN_STATE → safety-function governs, IEC 61511 |
| TEST 34 control loop on V-401 | physical ACCEPTABLE + **control-function** UNKNOWN_STATE governs, ISA 18.2 |
| C-only (validation gap, no divergence) | **DEGRADED** |
| validated control loop / plain piping | ESTABLISHED — no over-fire |

## Verification (offline, all green)
- reconciliation-layer gate: **57 assertions** (6 new generalized/control/DEGRADED traces; 462 SIS traces still pass)
- `node scripts/run-gates.cjs` → **48 / 48**
- `node scripts/eval-sa.cjs` → 20 / 20 (no regression — the 20 physical cases describe no protective/control function, so the recognizer never engages)
- `npx tsc -b` → clean
- Version **v16.18 → v16.19**.

---

## Git — run in Git Bash at /c/dev/forged-ndt-intelligence

**⚠️ The phantom staged-deletions are present again — run `git reset` FIRST**, confirm `git status`
shows only the two real changes (reconciliationLayer.ts, VoiceInspectionPage.tsx, reconciliation-layer.test.cjs + the untracked doc), then commit:

```bash
git reset
git status   # confirm: NO deleted tsconfig.json / test files; only the 3 modified + 1 untracked doc
git add src/lib/reconciliationLayer.ts tests/reconciliation-layer.test.cjs src/pages/VoiceInspectionPage.tsx DEPLOY465-INSTRUCTIONS.md
git commit -m "DEPLOY465: generalized assurance recognizer - one behavior-keyed recognizer for SIS/ESD AND control-loop-on-a-vessel; no-assurance-default; A&B->UNKNOWN, C->DEGRADED; SAFETY->IEC 61511 / CONTROL->ISA 18.2 routing (cite+escalate, no SIL/LOPA); v16.19"
git push
```

## Live check (v16.19)
Re-run **TEST 34** (vessel + degraded control loop) and **TEST 31/33**: TEST 34 should read physical
ACCEPTABLE with a **control-function assurance failure governs … ISA 18.2 … escalate to process
control + process safety + MOC**; the SIS/ESD cases read **safety-function … IEC 61511**. A plain
vessel/piping case must still produce its full physical assessment.

## Status
This was the last unbuilt frontier piece. The cascade is closed end-to-end and the protective-function
cases now *conclude* correctly, not just fail safe. Remaining smaller items: **CP4b** regulatory
routing (TEST 30) and the **Gulf-of-Mexico jurisdiction word-boundary**. Then freeze TEST 29/30/31/32/33/34
as the golden acceptance set and the list is empty for the ASNT bar.
