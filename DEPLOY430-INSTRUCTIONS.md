# DEPLOY430 — CRITICAL consequence for offshore manned platform + hydrocarbon/toxic medium

## The issue (GPT, TEST 14)
For a wet-gas / trace-H2S / offshore fixed production platform, the consequence capped at HIGH
("not CRITICAL"). GPT argued — correctly — that a sour, high-pressure hydrocarbon release on a
continuously-manned offshore platform with limited egress is a credible MULTIPLE-fatality scenario
(Piper Alpha class) and should read CRITICAL.

## Why it capped at HIGH
In `decision-core`, H2S/toxic and "offshore platform" each only elevate MEDIUM/LOW → HIGH, and the
auto-CRITICAL cargo list (crude/LNG/LPG/ammonia/chlorine) doesn't include sour/wet gas. The
DEPLOY400 receptor amplifier needs an explicit "occupied/manned" word, which the transcript didn't
use ("offshore fixed production platform").

## The fix (scoped — not a blanket offshore escalation)
A new compound rule: **offshore manned platform AND a real hydrocarbon/toxic medium → CRITICAL.**
The medium must be explicit (h2s flag, sour, h2s, wet gas, natural gas, gas compression/export,
crude, condensate) — deliberately NOT the broad `flammableContext`/stored-energy flags, which are
set too liberally and would over-escalate benign offshore assets.

## Verified offline (4/4) + gated
- Offshore sour gas (TEST 14) → **CRITICAL**.
- Offshore produced-water reinjection w/ H2S (TEST 11) → **CRITICAL**.
- Onshore cooling water → HIGH (not CRITICAL).
- Offshore benign seawater/structural, no hydrocarbon → **HIGH** (not over-escalated — this was the
  trap; the first attempt using `flammableContext` wrongly flagged it CRITICAL, now fixed).
- `tsc -b` clean; `node scripts/run-gates.cjs` → **34/34**. The `decision-core-hold` gate now carries
  two DEPLOY430 assertions (offshore-sour → CRITICAL; offshore-benign → not CRITICAL).

## Files
- `netlify/functions/decision-core.ts` (compound consequence rule)
- `tests/decision-core-hold.test.cjs` (2 consequence assertions)
- `DEPLOY430-INSTRUCTIONS.md`

## Commit (from C:\dev\forged-ndt-intelligence)
```bash
npx tsc -b
node scripts/run-gates.cjs
git add netlify/functions/decision-core.ts tests/decision-core-hold.test.cjs DEPLOY430-INSTRUCTIONS.md
git commit -m "DEPLOY430 - CRITICAL consequence for offshore manned platform + hydrocarbon/toxic medium. Sour/wet-gas/high-pressure release on a manned offshore platform is a credible multiple-fatality scenario -> CRITICAL (was capped at HIGH). Scoped to an explicit hydrocarbon/toxic medium so benign offshore seawater/structural assets are NOT over-escalated. Verified 4/4 offline; decision-core-hold gate +2 assertions; tsc clean, gates 34/34."
git push
```

## After deploy — re-run TEST 14
Consequence should read CRITICAL with a fatal-toxic/hydrocarbon-release human-impact line, and
Life-Safety HIGH (DEPLOY427) is consistent with it. The B31G card reads INPUTS INCONSISTENT
(DEPLOY428), the mechanism reads Confirmed-measured corrosion / Suspected-governing fatigue
(DEPLOY429), and convergence stays vibration-fatigue.
