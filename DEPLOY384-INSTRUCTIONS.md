# DEPLOY384 - SA Tier 3b: Convergence Detection

## What this adds
A deterministic **Convergence Detection** engine. Most integrity failures are
first dismissed because each observation is read in isolation. The expert
insight is that several *independent* evidence streams (different sensors,
surveys, people, datasets) are quietly telling the same story.

The engine groups independent evidence streams under candidate failure
hypotheses and reports how many distinct streams converge on each, then emits a
**Convergence Score (0-10)**. Directly addresses GPT eval miss #3 ("Five
independent evidence streams support the same failure hypothesis").

- Independent streams: incident/ops log, ROV visual, geometry scan, coating
  survey, CP survey, UT/ACFM thickness, process chemistry, flow data.
- Candidate hypotheses: mechanical-displacement-driven integrity loss; internal
  corrosion progression. Primary = the hypothesis with the most independent
  supporting streams.
- On the Test-1 subsea pipeline scenario: **6 independent streams converge ->
  score 10/10** on the mechanical-displacement hypothesis (anchor drag ->
  displacement -> ovality -> coating damage -> CP degradation -> wall loss).

## Properties
- PURE DETERMINISTIC (enumerated keyword ruleset). No LLM, no network, no clock,
  no random. var-only / string-concat / no template literals / no arrow fns.
- Attached to the SA package for rendering only; **NOT part of saPackageHash**,
  so `verifySaPackage` stays valid (confirmed: valid=true at runtime).
- Rendered in both the report PDF (Convergence block, amber) and the on-screen
  SA card.
- `tsc -b` clean. Convergence test + organizational regression test both pass.

## Files (4)
- `netlify/functions/situational-awareness-convergence.cjs`  (new engine)
- `netlify/functions/situational-awareness-orchestrate.cjs`  (+7: require + attach)
- `src/pages/VoiceInspectionPage.tsx`                        (+12: PDF block + SA card line)
- `DEPLOY384-INSTRUCTIONS.md`                                (this file)
(`tests/situational-awareness-convergence.test.cjs` is git-ignored.)

## Commit
```bash
git pull
node tests/situational-awareness-convergence.test.cjs
node tests/situational-awareness-organizational.test.cjs
git add netlify/functions/situational-awareness-convergence.cjs netlify/functions/situational-awareness-orchestrate.cjs src/pages/VoiceInspectionPage.tsx DEPLOY384-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Confirm the 4 files are staged, then:
```bash
git commit -m "DEPLOY384 - SA Tier 3b: Convergence Detection engine. Groups independent evidence streams (ops/ROV/geometry/coating/CP/UT/chemistry/flow) under candidate failure hypotheses -> Convergence Score (0-10). On Test-1: 6 independent streams converge -> 10/10. Rendered in report + SA card. Attached to SA package for rendering; saPackageHash unaffected (verifySaPackage valid). No LLM. tsc -b clean."
git push
```
Paste the push output.

## Next in Tier 3
- **3c Causal Chain Reconstruction** - explicitly build the chain (anchor drag ->
  displacement -> bending -> ovality -> coating damage -> CP shielding ->
  accelerated corrosion).
- **3d Future-State Simulator** - 24h / 7d / 30d / storm-event projections.
