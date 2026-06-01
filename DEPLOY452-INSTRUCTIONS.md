# DEPLOY452 — Mechanism-Compulsion Gate (the "no damage mechanism allowed to exist" bug)

## What was actually wrong (TEST 25 / 26 / 27 / 28)

The reconciliation top-line was already correct ("No confirmed damage mechanism governs"),
but a **second, older engine** (Failure Mode Dominance) underneath it was *manufacturing* a
physical damage mechanism with **zero evidence** and writing it into the same report. That is
the contradiction GPT kept catching: Page 3 says "no mechanism," Page 4 says
"GOVERNING MECHANISM: STRUCTURAL INSTABILITY / EMERGENCY STRUCTURAL REVIEW."

Reproduced in the live code on the TEST 28 transcript (healthy Alberta H2 piping, "no distortion,
within limits, no damage mechanism identified"):

```
BEFORE:  FMD governing_failure_mode = STRUCTURAL_INSTABILITY   ← invented from "no distortion"
         RECON tuple                = ACCEPTABLE/ESTABLISHED/STABLE  (correct)
AFTER:   FMD governing_failure_mode = NONE                     ← fixed
```

Root cause: `isGlobalDeformation()` set `hasDeformation=true` off the word "distortion" even
inside "**no** distortion," and the DEPLOY437 within-limits guard only cleared tilt/settlement,
not deformation — so the structural path fired on a non-finding.

## The fix (GPT Rule 1 + Rule 2)

A CONFIRMED governing mechanism now requires **direct, non-negated evidence** in the transcript.
If the chosen mode rests only on negated / within-limits non-findings, it is **downgraded to
NONE** — the system is explicitly allowed to conclude *"no confirmed damage mechanism
established."* Same clause-aware negation logic that fixed the convergence engine in DEPLOY450.

Files changed:
1. `netlify/functions/failure-mode-dominance.js` — final evidence gate on `governingMode`
   (CORROSION / CRACKING / STRUCTURAL_INSTABILITY / COMPOUND). On downgrade it also neutralizes
   `structural_path.active` so the red "STRUCTURAL INSTABILITY PATH" box can't re-print the
   contradiction. Direct-evidence patterns require things like *measured wall loss / % loss*,
   *NDT crack indication*, *settlement beyond allowable / buckling / measured out-of-plumb*.
2. `src/pages/VoiceInspectionPage.tsx` — when FMD = NONE, render
   **"NO CONFIRMED DAMAGE MECHANISM ESTABLISHED — disposition is set by the Governing Reality"**
   instead of a bare "GOVERNING MECHANISM: NONE." Version strings bumped **v16.6m → v16.9** so you
   can confirm the new build is live (the TEST 28 screenshot was an *old* build — it still showed
   "Organizational risk 7.5/10," which the RAE cutover already removed).

## Verification (offline, all green)
- `node scripts/eval-sa.cjs` → **20 / 20** hard cases
- `node scripts/run-gates.cjs` → **42 / 42** acceptance gates
- `npx tsc -b` → clean (rc 0)
- Controls held: real corrosion → CORROSION, real settlement-beyond-allowable → STRUCTURAL_INSTABILITY.

---

## Git — run these in C:\dev\forged-ndt-intelligence

> ⚠️ The repo's git **index is corrupt** and there's a stale **index.lock** (left over from a
> crashed git GUI / OneDrive sync). The sandbox can't touch `.git`, so repair it first on Windows.
> This does NOT lose any work — it rebuilds the index from your last commit; your edited files are
> untouched. **Close VS Code / GitHub Desktop first.**

```powershell
cd C:\dev\forged-ndt-intelligence

REM 1. repair the corrupt index + stale lock (rebuilds index from HEAD, no file loss)
del /f .git\index.lock
del /f .git\index
git reset

REM 2. confirm it's healthy and shows the two changed files
git status

REM 3. stage, commit, push
git add netlify/functions/failure-mode-dominance.js src/pages/VoiceInspectionPage.tsx DEPLOY452-INSTRUCTIONS.md
git commit -m "DEPLOY452: mechanism-compulsion gate - FMD must not manufacture a governing mechanism without direct evidence (TEST 25/26/27/28); render NONE as 'no confirmed damage mechanism established'; v16.9"
git push
```

If `git status` still errors after `git reset`, run `git read-tree HEAD` then `git status`.

## Confirm the deploy is live
After Netlify finishes, hard-refresh the report page (Ctrl+Shift+R) and check the subtitle reads
**v16.9**. Re-run the TEST 28 transcript: the FMD card should now read *"NO CONFIRMED DAMAGE
MECHANISM ESTABLISHED"* and the structural-instability box should be gone.
