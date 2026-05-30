# DEPLOY400 - Consequence receptor-exposure amplifier (consequence-governs archetype)

## Source: live-pack refinery toxic-piping case (TEST 6)
GPT 9/10 - the strongest yet. Governing mechanism (cracking) correct, disposition and
escalation correct. One real weakness: **"It calls life-safety 'Not CRITICAL' while the
scenario has occupied/control-room and toxic release exposure. I'd expect CRITICAL
consequence or at least HIGH with critical-escalation flags."** GPT's framing: the
governing risk is the *consequence-amplified* crack - "small crack + toxic/high-pressure
release + occupied/control/safety-critical exposure."

## Root cause (decision-core.ts resolveConsequenceReality)
The consequence lenses elevate on the RELEASE SOURCE (toxic/H2S -> HIGH, stored pressure
-> HIGH, fire/structural cascades -> CRITICAL) but, for fixed equipment, never weigh the
RECEPTOR - who/what is exposed when it releases. CRITICAL was reachable only via
diving/hyperbaric human-occupancy keywords, hazardous TRANSPORT cargo, or physics
cascades. Toxic refinery piping next to an occupied control room / downwind population
therefore capped at HIGH, and the life-safety gate read "Not CRITICAL."

## Fix (additive; gated to avoid false positives)
New CONSEQUENCE RECEPTOR-EXPOSURE AMPLIFIER. When BOTH hold, tier -> CRITICAL with a
life-safety basis and FATAL human-impact framing:
- **hazard pathway:** H2S/caustic, the word "toxic", stored pressure energy, flammable
  hydrocarbon context, or operating temp >= 400F, AND
- **receptor exposure:** occupied / manned / populated / population / downwind /
  residential / public exposure / control building / occupied control room/building/structure.

This is the "collateral" axis from the Arbiter objective vector: a small defect can
GOVERN through consequence amplification, independent of remaining wall thickness.
`governing_failure_mode` and disposition logic are untouched - only the consequence tier
(and thus the existing CRITICAL escalation/life-safety gates) responds.

## Verification (real resolveConsequenceReality, transpiled offline)
- TEST 6 toxic + occupied control room + downwind population -> **CRITICAL**, human
  impact "FATAL -- hazardous release to occupied/populated receptors". <- the fix.
- Toxic high-pressure piping, NO occupancy -> **HIGH** (not over-elevated).
- Occupied control room, NO hazard pathway -> **MEDIUM** (no false positive).
- tsc -b clean; 23/23 regression locks; benchmark (49/50 / 100 / 100) and jurisdiction
  (50/50) unchanged.

## Files
- netlify/functions/decision-core.ts   (DEPLOY400 amplifier in resolveConsequenceReality)
- DEPLOY400-INSTRUCTIONS.md

## Commit
```bash
git pull
npx tsc -b
git add netlify/functions/decision-core.ts DEPLOY400-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Then:
```bash
git commit -m "DEPLOY400 - Consequence receptor-exposure amplifier (from live-pack TEST 6). resolveConsequenceReality now elevates to CRITICAL when a hazardous release pathway (toxic/H2S/caustic, stored pressure, flammable, >=400F) co-occurs with occupied/populated receptor exposure (occupied control room, downwind population, residential/manned area) - the collateral axis the source-only lenses missed. A small defect can govern via consequence amplification, independent of wall thickness. Gated behind BOTH conditions: toxic-no-occupancy stays HIGH, occupied-no-hazard stays MEDIUM. governing_failure_mode + disposition unchanged. tsc clean; 23/23 locks; benchmark/jurisdiction unchanged."
git push
```
Paste the push output, then re-run TEST 6 to confirm life-safety now reads CRITICAL
(elevated scrutiny / escalation) instead of "Not CRITICAL."

## Why this matters
First fix in the CONSEQUENCE-GOVERNS archetype (cases 1-5 were all fatigue). It teaches
the platform to weigh the receptor, not just the source - the same multi-axis weighing
the Decision Arbiter is meant to own. Next archetypes to probe: future-state-governs
(Case 21), support-governs (Case 31, still my bet for the biggest gap), human-factors-
governs (Case 41).
