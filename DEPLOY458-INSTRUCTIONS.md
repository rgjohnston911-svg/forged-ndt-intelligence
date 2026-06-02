# DEPLOY458 — Governance Contest CP3, commit 2: Authority Lock consumes the verdict

**Commit 2 of 5** of the consumption contract. The first satellite now reads the single
mechanism-evidence verdict instead of re-deriving. This is the commit where the TEST 30 / TEST 31
**HIC / API-579 / NACE tower starts to collapse.**

## What changed
- **`netlify/functions/authority-lock.js`** computes the verdict from the transcript it already
  receives (carried as `component_description`) via the shared `_mechanism-evidence.cjs`, then:
  - **Asset-class locks UNCHANGED** — API 510 / ASME VIII / ASME B31.3 / general API 579 FFS
    authority still fire from the asset/component type. (So a *misclassified* SIS still shows
    API 510 — that's the separate §6 classifier fix, not this commit.)
  - **Mechanism-triggered locks now gate on the verdict:**
    - **API 579 Part 9 (crack)** fires only when `confirmed === "cracking"` (direct crack evidence).
    - **NACE MR0175 (sour)** fires only when `sour_service` is true — non-negated H2S evidence.
      **Hydrogen ≠ H2S:** "hydrogen-rich gas" and "No H2S present" no longer fire NACE. Both NACE
      paths (the pipeline asset-block and the general block) are unified onto the verdict.
    - **API 579 Part 4/5 (metal loss)** fires only when `confirmed === "corrosion"`.
    - B31G unchanged (gated on a *measured* wall-loss percentage — already evidence).
  - The verdict is exposed on the result (`mechanism_verdict`) and the `trigger_*` flags now read
    from it.
- **`_mechanism-evidence.cjs`** — refined `sourPresent` to comma-clause-local negation (a live test
  exposed that "sour … 200 ppm H2S … no crack indications" wrongly read as not-sour because the
  unrelated "no" negated the whole sentence). Now the negation must sit in the H2S mention's own
  comma-clause. Parity gate still green.
- Version **v16.11 → v16.12** (Authority Lock is report-body; live-visible).

## Verified behavior (new gate: authority-lock-mechanism-gate, 7 checks)
| input | mechanism locks |
|---|---|
| TEST 30 hydrogen piping (no H2S), even with inferred has_cracking+hic/ssc | **NONE** (tower collapsed) |
| TEST 31 SIS clean | **NONE** (asset-class API 510 remains — §6) |
| real corrosion (64% measured loss) | Part 4/5 + B31G ✓ |
| real crack (PAUT through-wall) | Part 9 ✓ |
| real H2S service | NACE ✓ |

## Verification (offline, all green)
- new gate `authority-lock-mechanism-gate.test.cjs`: 7/7
- parity gate: 19/19 (sour negation refinement holds)
- `node scripts/run-gates.cjs` → **44 / 44**
- `node scripts/eval-sa.cjs` → 20 / 20
- `npx tsc -b` → clean

---

## Git — run in Git Bash at /c/dev/forged-ndt-intelligence

```bash
git add netlify/functions/authority-lock.js netlify/functions/_mechanism-evidence.cjs tests/authority-lock-mechanism-gate.test.cjs src/pages/VoiceInspectionPage.tsx DEPLOY458-INSTRUCTIONS.md
git commit -m "DEPLOY458: governance contest CP3 commit 2 - Authority Lock mechanism-triggered locks (Part 9 crack, NACE sour, Part 4/5 metal loss) gate on the evidence verdict; asset-class locks unchanged; hydrogen != H2S; v16.12"
git push
```

## Live check
Hard-refresh → subtitle **v16.12**. Re-run **TEST 30** (hydrogen piping) or **TEST 31** (SIS): the
**Authority Lock section should no longer show API 579 Part 9 / NACE MR0175 / Part 4/5** (the crack/
sour/metal-loss tower). For TEST 31 the asset-class API 510/ASME VIII will still appear — that's the
misclassification, fixed separately in §6. A real corrosion or crack case must still show its
Part 4/5 or Part 9 locks.

## Remaining CP3 commits
3) FMD sub-paths (corrosion/cracking/structural path + severity) read the verdict — NONE → no active
paths. 4) disposition ledger / required inspection plan — no mechanism-specific NDE for an
unevidenced mechanism. 5) consequence `failure_mode` derives from the verdict. Then CP4 recognizers.
