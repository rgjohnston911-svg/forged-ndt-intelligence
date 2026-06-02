# DEPLOY459 — Governance Contest CP3, commit 3: FMD sub-paths consume the verdict

**Commit 3 of 5.** The corrosion / cracking / structural sub-paths inside FMD now read the single
mechanism-evidence verdict instead of running on their own flags. This kills the "corrosion path
active HIGH" / "cracking path active" leak on an unevidenced asset (TEST 30 / TEST 31).

## What changed
- **`netlify/functions/failure-mode-dominance.js`** — after the paths are built, a verdict gate
  (using the shared `_mechanism-evidence.cjs`) overrides their `active` / `severity`:
  - **NONE** → path `active: false`, no severity, failure_pressure cleared.
  - **SUSPECTED / screening** → `severity: "candidate_unconfirmed"`, `active: false` — a candidate
    for screening, NOT an active path with a severity number. (The screening-gate HOLD still fires
    — the screening *recommendation* is preserved; only the "active path" render is suppressed.)
  - **CONFIRMED** → active with severity (unchanged). Corrosion counts a *measured* wall-loss
    percentage as direct evidence.
  - structural path stays aligned (DEPLOY452 already neutralized it on downgrade).
  - The DEPLOY452 governing-mode gate is untouched (it already evidence-gates the headline); this
    extends the same single source to the sub-paths the report renders.
- Version **v16.12 → v16.13**.

## Verified (new gate: fmd-subpath-verdict-gate, 6 checks)
| input | corrosion | cracking | structural |
|---|---|---|---|
| TEST 30 hydrogen piping (within limits), even w/ inferred hic+corrosion+has_cracking | inactive, no severity | inactive | inactive |
| TEST 31 SIS clean | inactive | inactive | inactive |
| real corrosion (64% measured loss) | **active / SEVERE** | inactive | inactive |
| real crack (PAUT through-wall) | inactive | **active / HIGH** | inactive |

## Verification (offline, all green)
- new gate `fmd-subpath-verdict-gate.test.cjs`: 6/6
- `node scripts/run-gates.cjs` → **45 / 45** (screening-gate HOLD logic preserved — no eval regression)
- `node scripts/eval-sa.cjs` → 20 / 20
- `npx tsc -b` → clean

## Known minor (not a leak, noted for later)
On a "no H2S present" transcript, corrosion can still be flagged a *candidate* (the indirect H2S
indicator matches before negation). It is **not active and carries no severity**, so it does not
manufacture a path — it reads as a screening candidate at worst. Tightening candidate detection to
be negation-aware is a small follow-up, not a tower leak.

---

## Git — run in Git Bash at /c/dev/forged-ndt-intelligence

```bash
git add netlify/functions/failure-mode-dominance.js tests/fmd-subpath-verdict-gate.test.cjs src/pages/VoiceInspectionPage.tsx DEPLOY459-INSTRUCTIONS.md
git commit -m "DEPLOY459: governance contest CP3 commit 3 - FMD corrosion/cracking/structural sub-paths gate on the evidence verdict (NONE -> inactive/no severity; CONFIRMED -> active); v16.13"
git push
```

## Live check
Hard-refresh → subtitle **v16.13**. Re-run **TEST 30 / TEST 31**: the **Failure Mode Dominance**
section should no longer show an active "CORROSION PATH (active) HIGH" / "CRACKING PATH (active)"
on these unevidenced assets. A real corrosion or crack case must still show its active path.

## Remaining CP3 commits
4) disposition ledger / required inspection plan — no mechanism-specific NDE (TOFD/MT/crack sizing)
for an unevidenced mechanism. 5) consequence `failure_mode` derives from the verdict. Then CP4
(assurance + regulatory recognizers — the load-bearing fix for TEST 29/31).
