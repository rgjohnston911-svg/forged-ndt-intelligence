# DEPLOY432 — TEST 15 (FLNG) engine fixes: structural hallucination + LNG authority

The SA layer scored 9–9.5 on TEST 15 (governing reality, convergence, organizational risk all
correct). Two deterministic-engine bugs dragged it down; both fixed.

## 1. Structural-instability hallucination (the integrity-trust failure)
The scenario only stated wear-pad wear: "guide shows abnormal wear, polished contact surfaces,
deformation of wear pads ... accepted as cosmetic." The engine escalated to "GLOBAL PLASTIC
DEFORMATION / STRUCTURAL INSTABILITY / CAPACITY EXCEEDED" — a fabricated physics claim that also
contradicted the (correct) governing reality of dynamic fatigue.

**Cause:** `failure-mode-dominance.js` `isGlobalDeformation()` treats "deformation" as ambiguous and
checks ±60 chars for a local-context word. The list had `" pad "` (singular, space-bounded) and no
"wear pad" / "pads" / "guide", so "deformation of wear pads" missed local context and defaulted to
GLOBAL.

**Fix:** added sacrificial-accessory contexts — wear pad/pads, wear plate, pipe guide, guide shoe,
wear/contact surface, polished. Deformation of a wear pad or guide is now LOCAL (expected wear),
never global structural collapse.

**Verified:** wear-pad deformation -> NOT structural (governing stays the measured mechanism);
genuine "severely bowed / gross deformation of the main run" -> STILL structural instability (no
regression).

## 2. LNG loading line -> API 510 / Section VIII (wrong authority)
A 24-inch cryogenic LNG transfer/loading line (piping; API 570 / ASME B31.3 / DNV / SIGTTO) locked as
a pressure vessel. Same family as the TEST 13 REAC bug; DEPLOY427's trap only covered exchanger/cooler.

**Fix (authority-lock.js):** added loading/transfer/export/jetty-line and loading-arm terms to the
piping discriminator, plus an LNG/marine transfer-line trap that routes piping even when the
asset_type was misclassified as vessel/tank/facility-equipment. Scoped to unambiguous line terms, so
"nozzle piping on a vessel" is unaffected.

**Verified:** LNG loading line (asset=tank OR offshore_platform) -> API 570 / B31.3; separator vessel
+ nozzle piping -> stays API 510; real shell-and-tube exchanger -> stays API 510 (no regression).

## Gate
New `tests/structural-authority-routing.test.cjs` asserts both directions for each fix
(local-vs-global deformation; LNG-line-vs-vessel routing). `node scripts/run-gates.cjs` -> **35/35**;
`tsc -b` clean.

## Files
- `netlify/functions/failure-mode-dominance.js` (wear/guide local contexts; export isGlobalDeformation)
- `netlify/functions/authority-lock.js` (LNG/marine transfer-line piping trap)
- `tests/structural-authority-routing.test.cjs` (new gate)
- `DEPLOY432-INSTRUCTIONS.md`

## Commit (from C:\dev\forged-ndt-intelligence)
```bash
npx tsc -b
node scripts/run-gates.cjs
git add netlify/functions/failure-mode-dominance.js netlify/functions/authority-lock.js tests/structural-authority-routing.test.cjs DEPLOY432-INSTRUCTIONS.md
git commit -m "DEPLOY432 - TEST 15 engine fixes. (1) Structural-instability hallucination: deformation of a wear pad/guide is a sacrificial-accessory observation, not global plastic deformation (FMD discriminator local-context fix) - kills the fabricated 'capacity exceeded' that contradicted the fatigue governing reality. (2) LNG/marine loading & transfer LINES route to API 570/B31.3 (DNV/SIGTTO apply), not API 510/Section VIII - authority-lock piping trap. New gate both directions; tsc clean; gates 35/35."
git push
```

## Not changed (GPT enhancements, deliberately deferred)
- Elevating the pressure-spike signal (18-22% spikes during loading-arm movement = possible
  surge/transient) and the control-software-change-without-MOC as stronger contributors. These are
  signal-weighting enhancements to convergence/SA, not bugs — worth a scoped follow-on.
- Adding DNV / SIGTTO explicitly to the LNG authority chain (currently API 570 / B31.3 is the core
  correct routing; the marine-transfer codes are an additive enhancement).
