# DEPLOY426 — TEST 12 fixes: pressure precedence, wall-loss math, NULL FMD/disposition auth

Three issues GPT flagged on TEST 12 (the convergence win was already confirmed). All fixed and
verified offline.

## 1. Pressure used 2,850 (design) as operating — now 2,300
**Cause:** DEPLOY424 killed the `850` comma bug, but `voice-grammar-bridge` (gbData) extracts the
*first* psi it sees — the **design** line (2,850) — and seeded `operatingPressure` *before* the
canonical extractor's gap-fill, so the correct operating-labeled 2,300 never won.
**Fix:** the canonical extractor is now **authoritative** for `operating_pressure` (it alone
distinguishes operating-labeled from design and keeps them in separate fields). Its value overrides
the naive gbData value. Same for `nominal_wall` and `measured_min_wall`.

## 2. Wall loss showed 40% — now ~16.4% (computed)
**Cause:** the scenario has no stated wall-loss %. The legacy frontend regex had an **optional**
`(?:wall|metal|thickness)?` suffix, so it matched the bare **"reinjection rates increased 40%"** and
reported 40% wall loss.
**Fix (three layers):**
- The canonical extractor now reads the multi-location UT grid ("Location A 0.425, B 0.418, C 0.430")
  and takes the **minimum / worst case (0.418)**, then **computes** wall loss from
  `nominal − measured` = (0.500 − 0.418)/0.500 = **16.4%**, tagged `computed_from_nominal_measured`.
- A bare percentage with **no wall/metal/thickness word** is never read as wall loss (kills the
  "40% rate" and "27% flow" contamination).
- The legacy regex's optional suffix was made **required** (`(?:wall|metal|thickness)\b`) as
  defense-in-depth.

## 3. NULL Failure-Mode-Dominance / NULL Disposition Pathway / "superbrain auth-token error"
**Cause:** a real auth bug (not a preview-env issue). `decision-core` and SA-orchestrate go through
the `callAPI()` helper, which attaches the Supabase token — that's why they worked. But the direct
`fetch()` calls to **failure-mode-dominance, disposition-pathway, and superbrain-synthesis** sent no
`Authorization` header, so those auth-guarded engines returned **401 → NULL**. (`remaining-strength`
worked only because it isn't guarded.)
**Fix:** added an `engineAuthHeaders()` helper that attaches the user token, and applied it to all
six direct engine calls (FMD, disposition-pathway, superbrain, authority-lock, remaining-strength,
failure-timeline). Harmless for the unguarded ones; future-proof.

## Verified offline
- Canonical battery: **17/17** including TEST 12 — operating 2300 / design 2850, measured-min 0.418,
  wall loss 16.4% (`computed_from_nominal_measured`), and bare "40% rate" / "27% flow" produce **no**
  wall-loss field.
- `tsc -b` **clean**; `node scripts/run-gates.cjs` → **35/35**.
- The fieldExtraction gate (`npm test`/tsx in CI) now carries the TEST 12 assertions.

## Files
- `src/lib/fieldExtraction.ts` — multi-reading measured-min, computed wall-loss, contamination guard,
  operating/design separation.
- `src/lib/__tests__/fieldExtraction.test.ts` — TEST 12 cases.
- `src/pages/VoiceInspectionPage.tsx` — `engineAuthHeaders()` + applied to 6 engine calls; canonical
  override for pressure/wall/measured; legacy wall-loss regex tightened.
- `DEPLOY426-INSTRUCTIONS.md`

## Commit
```bash
git pull
npx tsc -b                       # expect clean
node scripts/run-gates.cjs       # expect 35/35
git add src/lib/fieldExtraction.ts src/lib/__tests__/fieldExtraction.test.ts src/pages/VoiceInspectionPage.tsx DEPLOY426-INSTRUCTIONS.md
git status
git diff --cached --stat          # expect 4 files
git commit -m "DEPLOY426 - TEST 12 fixes. (1) Pressure: canonical extractor is authoritative for operating_pressure (operating-labeled), overriding gbData's first-psi=design, so operating reads 2,300 not 2,850. (2) Wall loss: read multi-location UT grid -> minimum (0.418), COMPUTE wall loss from nominal-measured (=16.4%); a bare rate/flow % with no wall word is never wall loss; legacy regex suffix made required. (3) NULL FMD/disposition/superbrain: direct engine fetches sent no Authorization header (401 on auth-guarded engines) -> added engineAuthHeaders() to all 6 direct calls. 17/17 battery, tsc clean, run-gates 35/35."
git push
```

## After deploy — re-test TEST 12 on the launch-hardening preview
Expect: operating pressure **2,300 psi**, wall loss **~16.4%**, and **non-NULL** Failure-Mode-
Dominance + Disposition Pathway + Superbrain (no auth-token error). The convergence panel should
still read vibration-induced fatigue (DEPLOY425).
