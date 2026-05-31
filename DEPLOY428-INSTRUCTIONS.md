# DEPLOY428 — B31G input-consistency guard (TEST 14 false "reduce pressure" alarm)

## The bug (TEST 14)
The report demanded an immediate 808-psi reduction (MAOP 612 vs operating 1,420). GPT blamed the
infinite-flaw assumption, but that only drops the RSF to ~0.895. The real cause: `barlow_pressure`
(nominal-wall capacity) = 2·SMYS·t·F/D = 2·35000·0.5·0.72/36 ≈ 700 psi. A 36-in / 0.5-in / A106-B
line holds only ~700 psi at nominal — yet the scenario says it *operates* at 1,420. The operating
pressure exceeds the nominal-wall capacity at the assumed grade, which means the material grade is
understated (a 36-in line at 1,420 psi is API 5L X-grade, not A106-B). The engine didn't detect that
and issued a confident pressure reduction off a wrong-SMYS MAOP.

## The fix
`netlify/functions/remaining-strength.js`: if `operating_pressure > barlow_pressure` (nominal-wall
capacity at assumed SMYS), set `safe_envelope = "INPUTS_INCONSISTENT"`, zero the pressure-reduction
figure, null the operating ratio, back-calculate the implied SMYS, and recommend verifying the
material grade rather than actioning a reduction. A genuine exceedance (operating below nominal
capacity but above the corroded MAOP) still flags EXCEEDS with a real reduction — not masked.

## Verified (stable tree, post-relocation)
- `tsc -b` clean; `node scripts/run-gates.cjs` → 34/34 (canary git-ignored in clones).
- remaining-strength-guard now covers: TEST 14 → INPUTS_INCONSISTENT (flag true, reduction 0,
  implied SMYS ≈ 71,000 / X70); genuine exceedance → EXCEEDS with real reduction; consistent line → WITHIN.

## Files
- `netlify/functions/remaining-strength.js`
- `tests/remaining-strength-guard.test.cjs`
- `DEPLOY428-INSTRUCTIONS.md`

## Commit (now from C:\dev\forged-ndt-intelligence — never OneDrive)
```bash
npx tsc -b
node scripts/run-gates.cjs
git add netlify/functions/remaining-strength.js tests/remaining-strength-guard.test.cjs DEPLOY428-INSTRUCTIONS.md
git commit -m "DEPLOY428 - B31G input-consistency guard. Operating pressure above nominal-wall Barlow capacity at assumed grade => INPUTS_INCONSISTENT (understated material grade, implied X-grade), suppress false pressure-reduction; genuine exceedance still EXCEEDS. tsc clean, gates green."
git push
```
You're on `main` (= production). Pushing publishes after the Netlify gate re-runs. (If you prefer the
branch flow: `git checkout launch-hardening` before the commit, push, then merge to main.)
