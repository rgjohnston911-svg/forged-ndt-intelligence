# DEPLOY425 — Convergence engine: kill the hallucinated mechanism + add vibration-fatigue

## The bug (TEST 11, GPT's "serious hallucination / contamination" finding)
On the produced-water reinjection scenario, the report claimed the evidence converged on
**anchor drag / vessel contact, ovality, cathodic protection, coating survey, ACFM wall loss** —
none of which were in the scenario. That is the worst failure mode for this product: asserting
mechanisms that were never observed.

### Root cause (found in `situational-awareness-convergence.cjs`)
1. **Pre-written narratives.** Each hypothesis carried a hand-written paragraph that name-dropped
   specific mechanisms (anchor drag, ovality, CP).
2. **Fired on any 2 streams.** A hypothesis became "primary" if *any* 2 of its streams matched.
   TEST 11 has a support-shoe **coating damage** + a **prior incident** + general **corrosion** —
   three streams that belong to the anchor-drag hypothesis — so the engine selected it and printed
   its entire canned paragraph, fabricating anchor drag / ovality / CP.
3. **No fatigue hypothesis existed**, so the *correct* convergence (operational change → vibration →
   branch/support → prior fatigue failure) was not even representable.

## The fix
- **Signature gating (anti-contamination).** Every hypothesis now declares `required` signature
  streams. A hypothesis is **eligible** (and may surface its mechanism narrative or be primary)
  **only when all its signature streams are present.** The anchor-drag hypothesis now requires
  `INCIDENT_HISTORY + VISUAL_DISPLACEMENT + GEOMETRY_OVALITY` — so coating + corrosion + a prior
  incident can no longer summon it. A mechanism is named only when its defining evidence exists.
- **Honest fallback.** If no hypothesis has its required signature, the engine reports the
  converging independent observations **without naming any mechanism** ("N independent observations
  are present … no mechanism is asserted"). Same discipline as the report-provenance gate.
- **Coverage.** Added evidence streams `VIBRATION`, `OPERATIONAL_CHANGE`, `STRUCTURAL_INTERFACE`,
  `PRIOR_SIMILAR_FAILURE`, `DEFERRED_MAINTENANCE`, `STORM_LOADING`, and a
  **`VIBRATION_INDUCED_FATIGUE`** hypothesis (required `VIBRATION` + at least one of
  structural-interface / prior-failure / operational-change).

## Verified offline
- **TEST 11** → primary `VIBRATION_INDUCED_FATIGUE`, **8** converging streams (vibration, branch/
  support interface, prior similar failure, operational change, deferred maintenance, storm loading,
  process chemistry, wall loss). Narrative + summary contain **no** "anchor", "ovality", or
  "cathodic" — contamination gone. This is exactly the convergence GPT said was correct.
- **Regression** — the genuine subsea anchor-drag scenario still fires
  `MECHANICAL_DISPLACEMENT_DRIVEN_INTEGRITY_LOSS` (6 streams, score 10); clean/null → 0.
- **Signature proof** — stripping the word "vibration" from TEST 11 makes the fatigue hypothesis
  refuse to fire (it cannot exist without its signature).
- `node scripts/run-gates.cjs` → **35 / 35** (the convergence gate now carries the TEST 11
  anti-contamination assertions alongside the original anchor-drag checks). No `.ts` changed, so
  `tsc -b` is unaffected.

## Files
- `netlify/functions/situational-awareness-convergence.cjs` — rewritten (signature gating + new
  streams/hypothesis + honest fallback).
- `tests/situational-awareness-convergence.test.cjs` — extended with TEST 11 + anti-contamination
  + signature-gate proof; original Test-1 expectations preserved.
- `DEPLOY425-INSTRUCTIONS.md`

## Commit
```bash
git pull
node scripts/run-gates.cjs       # expect 35/35
git add netlify/functions/situational-awareness-convergence.cjs tests/situational-awareness-convergence.test.cjs DEPLOY425-INSTRUCTIONS.md
git status
git diff --cached --stat          # expect 3 files
git commit -m "DEPLOY425 - Convergence engine anti-contamination rebuild. Kills the hallucinated 'anchor drag / ovality / cathodic protection' narrative on TEST 11: hypotheses now require signature streams (a mechanism narrative can only surface when its defining evidence is present), with an honest no-mechanism fallback otherwise. Adds vibration/operational-change/structural-interface/prior-failure/deferred-maintenance/storm streams + a VIBRATION_INDUCED_FATIGUE hypothesis so the correct convergence is representable. TEST 11 -> vibration-induced fatigue, 8 streams, zero anchor/ovality/CP contamination; anchor-drag regression preserved; run-gates 35/35."
git push
```

## On the pressure (850 / MAOP 711) GPT also flagged
That is the **same comma-thousands bug**, and it is **already fixed in DEPLOY424** on the
`launch-hardening` branch — but TEST 11 was evidently run against a build that does not yet include
it. **It is not a new bug and not a separate path.** After the launch-hardening preview is live,
re-run TEST 11 there and the B31G card will read **operating pressure 2,300 psi** (not 850). If it
still shows 850 on the launch-hardening preview specifically, tell me — that would mean a second
pressure path I need to trace.

## Net
Both of GPT's two "major problems" are now addressed in code on this branch: pressure (DEPLOY424)
and convergence contamination (DEPLOY425). The remaining items from its eval — surfacing
"governing reality: operational change without engineering reassessment" and the confirmed-vs-
suspected mechanism framing — are wording/disposition-layer enhancements, not integrity bugs.
