# DEPLOY427 — TEST 13 fixes (authority, life-safety, convergence narrative) + bundles DEPLOY426

## Important: TEST 13 was run before DEPLOY426 deployed
Two of GPT's findings — **pressure used 2,150 (design) not 1,875** and **wall loss 22% not 64%**
(the "charge rate 22%" grabbed as wall loss) — are **already fixed in DEPLOY426**, which had not
been committed when TEST 13 was run. This commit includes DEPLOY426 **and** the new DEPLOY427
fixes, so all of it deploys together.

## DEPLOY427 fixes

### 1. Authority conflict — REAC inlet piping locked API 510 / Section VIII (vessel)
**Cause:** the upstream classifier tagged "Reactor effluent air **cooler**" as a heat-exchanger
*asset*. authority-lock only lets the description-derived component override the asset_type **on
facility assets**, so the (correct) "piping" inference was ignored and it routed by the
heat_exchanger asset → vessel codes.
**Fix (two parts):**
- `authority-lock.js`: a **served-equipment trap** — when the asset is an exchanger/cooler class
  but the described component is explicitly **piping**, route by piping (**API 570 / ASME B31.3**).
  Scoped to exchanger/cooler classes so a real exchanger and a vessel-with-nozzle-piping are
  unaffected.
- `VoiceInspectionPage.tsx`: pass `component_description` (the raw text) to authority-lock so its
  component discriminator can see "inlet piping".
- **Verified:** REAC inlet piping → API 570/B31.3; real shell-and-tube exchanger → API 510/Sec VIII;
  separator vessel + nozzle piping → API 510/Sec VIII (no regression).

### 2. Life-safety contradiction — CRITICAL consequence showed "Life-Safety Risk LOW"
**Cause:** `lifeSafetyRisk()` returned HIGH only when `tier === 'HIGH'`; a **CRITICAL** tier fell
through to LOW.
**Fix:** `situational-awareness-brief.cjs` — HIGH when tier is HIGH **or CRITICAL**. Verified:
CRITICAL→HIGH, HIGH→HIGH, MEDIUM→MEDIUM.

### 3. Convergence contamination — narrative asserted "cathodic-protection decline" (not in scenario)
**Cause:** DEPLOY425 gated which *hypothesis* fires, but the winning hypothesis still printed a
canned paragraph naming an **optional** stream (CP). 
**Fix:** `situational-awareness-convergence.cjs` — the narrative is now **generated**: a core
mechanism claim (guaranteed by the required streams) plus clauses appended **only for streams that
actually matched**. A mechanism can never be named without its evidence. Verified: REAC →
internal-corrosion narrative names process chemistry + wall loss + flow increase, **no CP**; TEST 11
still vibration-fatigue, no anchor/ovality/CP; anchor-drag regression preserved.

## Verified offline
- `tsc -b` **clean**; `node scripts/run-gates.cjs` → **35/35** (convergence gate now carries the
  REAC anti-CP assertions + TEST 11 + anchor regression).
- authority-lock, life-safety, and convergence each spot-checked directly (results above).

## Files (this commit = DEPLOY426 + DEPLOY427)
DEPLOY426: `src/lib/fieldExtraction.ts`, `src/lib/__tests__/fieldExtraction.test.ts`,
`DEPLOY426-INSTRUCTIONS.md`, and `src/pages/VoiceInspectionPage.tsx` (auth headers on 6 engine
calls, canonical pressure/wall-loss override, legacy regex tighten).
DEPLOY427: `netlify/functions/situational-awareness-convergence.cjs`,
`tests/situational-awareness-convergence.test.cjs`, `netlify/functions/situational-awareness-brief.cjs`,
`netlify/functions/authority-lock.js`, `src/pages/VoiceInspectionPage.tsx` (authority-lock
`component_description`), `DEPLOY427-INSTRUCTIONS.md`.

## Commit
```bash
git pull
npx tsc -b                       # expect clean
node scripts/run-gates.cjs       # expect 35/35
git add src/lib/fieldExtraction.ts src/lib/__tests__/fieldExtraction.test.ts src/pages/VoiceInspectionPage.tsx netlify/functions/situational-awareness-convergence.cjs tests/situational-awareness-convergence.test.cjs netlify/functions/situational-awareness-brief.cjs netlify/functions/authority-lock.js DEPLOY426-INSTRUCTIONS.md DEPLOY427-INSTRUCTIONS.md
git status
git diff --cached --stat
git commit -m "DEPLOY426+427 - TEST 12/13 fixes. Pressure: canonical extractor authoritative for operating_pressure (1,875 not 2,150). Wall loss: multi-reading min + computed from nominal-measured (64%), bare rate % never read as wall loss. Auth: engineAuthHeaders() on 6 direct engine calls (fixes NULL FMD/disposition/superbrain). Authority: served-equipment trap routes REAC inlet piping to API 570/B31.3 not API 510/Sec VIII + pass component_description. Life-safety: CRITICAL tier maps to HIGH (was LOW). Convergence: generated narrative names only matched streams (kills cathodic-protection contamination). tsc clean, run-gates 35/35."
git push
```

## After deploy — re-run TEST 13 on the launch-hardening preview
Expect: operating **1,875 psi**, wall loss **~64%**, **API 570 / ASME B31.3** primary authority on
BOTH pages, **Life-Safety HIGH**, convergence = internal corrosion (process chemistry + wall loss +
flow increase, no cathodic protection), and non-NULL FMD / Disposition / Superbrain.
