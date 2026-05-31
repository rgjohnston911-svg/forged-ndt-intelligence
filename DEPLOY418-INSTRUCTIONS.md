# DEPLOY418 - Public /demo route (curated, pre-sign-in "see the system" surface)

## What shipped
A public, no-auth `/demo` route in the app: a guided demo of vetted runs that a visitor (or a
Columbus attendee) can see WITHOUT signing in. The landing-page "Live Demo" tab links to it.

Curated, not live - the deliberate choice for an unattended public surface: deterministic,
zero LLM cost, can't be broken or abused, instant, and it can't embarrass on stage. But it is
not mock data - the fleet systemic findings drive the SAME production renderer as /fleet, and
every single-asset narrative is held to the report-provenance gate.

## The three scenarios
1. Sour gas line, confirmed cracking -> CRITICAL / NO-GO. Shows the decision plus a green
   "Provenance verified - every figure traces to a deterministic engine field" badge.
2. Pressure vessel, insufficient data -> HOLD FOR REVIEW. The "correct refusal" beat: the
   system names the two missing fields and declines to guess. More credible than a system that
   always answers, and impossible for a pattern-matcher to fake.
3. Five platforms in a hurricane's path -> fleet order of action + the parallel Systemic
   Patterns panel (a real CLUSTER), rendered by the production systemicPanel module - so the
   demo shows the actual parallel-not-coupled discipline, teal/gray disjoint from the bands.

## Dogfooding (the point)
The public demo is held to the SAME gates as the product:
- Every single-asset narrative passes report-provenance (verdict PASS) - our own marketing demo
  may not ship a number that does not trace to a source field.
- The HOLD scenario actually holds (disposition hold_for_review).
- The fleet CLUSTER is reproducible from aggregatePeripherals, not hand-faked - the gate rebuilds
  the cohort and asserts the engine produces the finding the demo displays.

## Architecture
- /demo is PUBLIC: App.tsx now routes /demo -> DemoPage OUTSIDE the auth gate; the auth-bearing
  logic moved into an inner AuthedApp (useAuth only mounts for non-/demo paths, so hooks stay
  clean). No engine calls, no token, no cost.
- DemoPage is self-contained (@ts-nocheck), dark-themed, with a scenario selector and a
  "Sign in to run your own" CTA.

## Verification
- demoScenarios gate (src/lib/__tests__/demoScenarios.test.ts): provenance PASS on every
  narrative, HOLD holds, CLUSTER reproducible - verified offline via the compiled module (4/4);
  runs under `npm test`.
- tsc -b clean. Full .cjs regression: 31/31. No engine behavior changed (additive demo surface).

## Files
- src/pages/DemoPage.tsx                       (new - public guided demo page)
- src/lib/demoScenarios.ts                      (new - curated vetted scenarios + sources)
- src/lib/__tests__/demoScenarios.test.ts       (new - dogfood gate: provenance/HOLD/CLUSTER)
- src/App.tsx                                   (public /demo route outside the auth gate)
- DEPLOY418-INSTRUCTIONS.md

## Commit
```bash
git pull
npm test            # includes demoScenarios + systemicPanel gates
npx tsc -b
git add src/pages/DemoPage.tsx src/lib/demoScenarios.ts src/lib/__tests__/demoScenarios.test.ts src/App.tsx DEPLOY418-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Then:
```bash
git commit -m "DEPLOY418 - Public /demo route: a curated, no-auth guided demo for the landing-page Live Demo tab (and Columbus). Three vetted runs - a provenance-verified NO-GO decision, a deliberate insufficient-evidence HOLD (the correct-refusal beat), and fleet triage with the production Systemic Patterns panel showing a real CLUSTER. Deterministic, zero LLM cost, unbreakable. Dogfooded: every single-asset narrative passes the report-provenance gate, the HOLD holds, and the CLUSTER is reproducible from aggregatePeripherals (not hand-faked). /demo is public (App.tsx routes it outside the auth gate; AuthedApp holds useAuth so hooks stay clean). tsc clean; regression 31/31; demo gate verified."
git push
```

## After deploy
Visit /demo (no sign-in). Point the landing-page "Live Demo" tab at https://4dndt.com/demo (or
the app's /demo path). To add scenarios later, extend src/lib/demoScenarios.ts - the gate will
hold any new narrative to provenance automatically.

## Note on scope
This is a SEPARATE concern from the landing page itself (a different codebase not in this repo).
DEPLOY418 builds the demo experience the landing tab points to. If you want the demo embedded
INTO the landing page rather than linked, that work lives in the landing-page project.
