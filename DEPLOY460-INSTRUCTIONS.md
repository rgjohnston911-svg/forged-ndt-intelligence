# DEPLOY460 — Governance Contest CP3, commit 4: disposition ledger / inspection plan evidence floor

**Commit 4 of 5.** The disposition ledger and required-inspection-plan stop demanding
mechanism-specific evidence (TOFD / MT / crack sizing) for a mechanism the report says doesn't
exist. This is the fatigue/TOFD/PAUT leak GPT flagged on TEST 31/32.

## What changed
- **`netlify/functions/disposition-pathway.js`** — `buildRequiredEvidenceLedger` and
  `buildRequiredInspectionPlan` now apply an evidence floor (`isEvidencedEnough`): a mechanism earns
  a full evidence ledger / NDE plan **only if** it is `confirmed` / `probable` / `possible`, or
  carries a non-trivial `reality_score` (≥ 0.10). A **phantom at ~0.05, unverified, no basis** gets
  no ledger entry and no inspection plan. Universal and asset-agnostic — it consumes decision-core's
  own per-mechanism evidence assessment (`reality_state` / `reality_score`), it does not re-derive.
  - `confirmed` mechanisms: still excluded from the ledger (already confirmed) but kept in the
    inspection plan for severity-quantification NDE — unchanged.
- Version **v16.13 → v16.14**.

## Verified (new gate: disposition-ledger-evidence-gate, 6 checks)
| mechanism | ledger | inspection plan |
|---|---|---|
| phantom `fatigue_mechanical` (0.05, unverified) | **dropped** | **dropped** |
| genuine `fatigue_vibration` (probable, 0.4) | kept | kept |
| confirmed `general_corrosion` | excluded (already confirmed) | kept (severity NDE) |

## Verification (offline, all green)
- new gate `disposition-ledger-evidence-gate.test.cjs`: 6/6
- `node scripts/run-gates.cjs` → **46 / 46**
- `node scripts/eval-sa.cjs` → 20 / 20
- `npx tsc -b` → clean

## Note on scope (per the TEST 32 analysis)
This is the universal evidence floor — it fixes the phantom-ledger leak for *every* asset, not a
SIS-specific block. The SIS asset class + identity-precedence classifier, and the assurance
recognizer that makes TEST 31/32 actually conclude "verify the safety function," are the separate
§6 / CP4 items — not this commit.

---

## Git — run in Git Bash at /c/dev/forged-ndt-intelligence

```bash
git add netlify/functions/disposition-pathway.js tests/disposition-ledger-evidence-gate.test.cjs src/pages/VoiceInspectionPage.tsx DEPLOY460-INSTRUCTIONS.md
git commit -m "DEPLOY460: governance contest CP3 commit 4 - disposition ledger + inspection plan apply an evidence floor; a phantom mechanism (~0.05, unverified) gets no full ledger/NDE plan; v16.14"
git push
```

## Live check
Hard-refresh → subtitle **v16.14**. Re-run **TEST 31 / TEST 32** (the SIS): the **Required Evidence
Ledger** and **Required Inspection Plan** should no longer demand TOFD / MT / PAUT / crack-sizing for
"Mechanical Overload / Buckling" or any unevidenced mechanism. A real corrosion/crack case must still
list its confirmation NDE.

## Remaining
CP3 commit 5: consequence engine `failure_mode` derives from the verdict (no manufactured
`crack_propagation_pressure_breach` / "Personnel fatality — offshore structural failure" on a clean
asset). Then CP4 recognizers (assurance + regulatory) — the load-bearing fix that makes TEST 29/31/32
conclude "verify the safety function," and the §6 classifier (SIS class + identity-precedence).
