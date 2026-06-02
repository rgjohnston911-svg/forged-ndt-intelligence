# DEPLOY467 — CP4b: regulatory routing (TEST 30) — the last frontier item

Completes the coverage-recognizer pair. A physically-clean asset whose only adverse finding is a
**stated regulatory/jurisdictional nonconformance** now routes to "fit for service, resolve the
regulatory correction" instead of a clean continue that ignores the finding.

## What changed (`src/lib/reconciliationLayer.ts`)
- `statedRegulatoryNonconformance(t)` — detects a stated audit finding / inspection-interval-
  methodology dispute / code-of-record gap against the governing regulatory guidance (stated facts
  only; "no regulatory findings" does not fire).
- Override: when the contest would CONTINUE (all three axes non-adverse) **and** a stated regulatory
  nonconformance exists, the governing statement names that nonconformance as governing —
  **technically fit for service, reconcile the inspection-interval methodology with the regulatory
  guidance, no FFS or mechanism NDE** — and flags `requiresHumanReview`. This is admissible stated
  evidence (RAE §3.7) surfaced through the authority/jurisdiction layer, **not a fourth axis** and
  **not a physical mechanism**.
- Version **v16.19 → v16.20**.

## Verified (reconciliation-layer gate: 65 assertions)
| case | result |
|---|---|
| TEST 30 (Alberta H2 piping, interval-methodology dispute) | regulatory nonconformance governs → fit-for-service + reconcile interval, no FFS/NDE, requiresHumanReview |
| clean piping, "no regulatory findings" | clean continue — override does NOT over-fire |
| real corrosion | still fitness-for-service (override only touches the clean-continue case) |

## Verification (offline, all green)
- reconciliation-layer gate: **65 assertions**
- `node scripts/run-gates.cjs` → **49 / 49**
- `node scripts/eval-sa.cjs` → 20 / 20 (no regression)
- `npx tsc -b` → clean

---

## Git — run in Git Bash at /c/dev/forged-ndt-intelligence (reset first — phantom deletions)

```bash
git reset
git status   # confirm: reconciliationLayer.ts + reconciliation-layer.test.cjs + VoiceInspectionPage.tsx modified, DEPLOY467 doc untracked; NO deleted tests/tsconfig
git add src/lib/reconciliationLayer.ts tests/reconciliation-layer.test.cjs src/pages/VoiceInspectionPage.tsx DEPLOY467-INSTRUCTIONS.md
git commit -m "DEPLOY467: CP4b regulatory routing - a stated regulatory/jurisdictional nonconformance on a physically-clean asset governs the disposition (fit for service, reconcile interval, no FFS/NDE); not a fourth axis; v16.20"
git push
```

## Live check (v16.20)
Re-run **TEST 30** (Alberta H2 piping): physically fit, jurisdiction **Canada / CSA**, and the
Governing Reality should read **"… a stated regulatory/jurisdictional nonconformance governs …
reconcile the inspection-interval methodology … no FFS or mechanism NDE."** A real corrosion case
must still read fitness-for-service.

## The finite list is empty for the ASNT bar
End-to-end, the frontier work is complete:
- **Governance contest** CP1–CP3 (perception → one judge → satellites consume one evidence verdict)
- **CP4a** safety-function assurance recognizer + **CP4b** regulatory routing
- **Asset Identity Gate** (no authority → honest HOLD)
- **functional_safety class** (SIS/ESD → IEC 61511, in-matrix)
- **generalized assurance recognizer** (SIS/ESD/control-loop, one behavior-keyed recognizer)
- **jurisdiction word-boundary** (Gulf of Mexico stays US)

Frozen golden traces (all in the reconciliation-layer + dedicated gates): TEST 24/25/29/30/31/32/33/34/35,
the 20 physical golden cases, the 6 system-breakers, and the contradiction check. 49 acceptance gates,
20/20 eval. After this lands and you re-baseline a GPT eval against v16.20, the list is empty.
