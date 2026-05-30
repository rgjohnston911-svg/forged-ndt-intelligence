# DEPLOY411 - Asset-class / consequence-mode reconciliation (bridge != pressure boundary)

## Source: the remaining open item from GPT's fleet gap analysis (Problem 1)
GPT: "The Bridge case should not automatically be treated as pressure_boundary_failure
unless the bridge asset is actually carrying pressure (pipe bridge / attached process
line). For a normal bridge, governing risk should be structural/fatigue cracking, not
pressure-boundary failure." (Problem 2 - mechanism vs consequence - was fixed in
DEPLOY408; this closes Problem 1.)

## Root cause (decision-core.ts resolveConsequenceReality)
`failure_mode` was set to "pressure_boundary_failure" whenever stored pressure energy was
detected - read straight from the narrative ("high-pressure") - with no check against the
asset class. So a structural asset (bridge) inherited a pressure-boundary consequence
purely from pressure wording.

## Fix
After the physics/amplifier blocks, a reconciliation pass: if the asset is structural-only
(bridge / rail_bridge / bridge_steel / bridge_concrete) AND there is no genuine
pressure-carrying evidence (pipe bridge / process line / pipeline / process piping /
attached process / pipe rack / pressurized line), and failure_mode landed on a
pressure-boundary mode, it is reclassified to **structural_failure** (member fracture /
collapse) with an explicit basis note. The consequence TIER is untouched (a bridge stays
HIGH for public exposure); only the consequence MODE is corrected.

## Verification (real resolveConsequenceReality, offline)
- Bridge + toxic/high-pressure text + crack -> mode **structural_failure** (not
  pressure_boundary_failure). <- the fix.
- Pipe bridge / bridge carrying a process line -> pressure_boundary_failure KEPT.
- Pressure Vessel + high pressure -> pressure_boundary_failure unchanged.
- Pipeline + high pressure -> pressure_boundary_failure unchanged (not a structural-only asset).
- Bridge girder, fatigue crack, traffic -> structural_failure, HIGH.
- tsc -b clean; 23/23 regression locks; benchmark (49/50 / 100 / 100) and jurisdiction
  (50/50) unchanged.

## Interaction with the mechanism layer (DEPLOY408)
The Fleet card already shows the damage MECHANISM from FMD (CRACKING for a crack-like
indication). With this fix the CONSEQUENCE mode for a bridge reads structural_failure, so
the bridge now reads, correctly: mechanism = CRACKING (structural/fatigue cracking),
consequence = structural, NOT pressure-boundary.

## Files
- netlify/functions/decision-core.ts   (DEPLOY411 reconciliation in resolveConsequenceReality)
- DEPLOY411-INSTRUCTIONS.md

## Commit
```bash
git pull
npx tsc -b
git add netlify/functions/decision-core.ts DEPLOY411-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Then:
```bash
git commit -m "DEPLOY411 - Asset-class/consequence-mode reconciliation: a structural-only asset (bridge) no longer inherits a pressure_boundary_failure consequence from mere pressure wording; reclassified to structural_failure unless it genuinely carries pressure (pipe bridge/process line/pipeline). Consequence tier unchanged. Closes Problem 1 from the fleet gap analysis. tsc clean; 23/23 locks; benchmark/jurisdiction unchanged."
git push
```

## Status after this
Both items from the fleet gap analysis are now closed: Problem 2 (mechanism vs
consequence) = DEPLOY408; Problem 1 (bridge consequence mode) = DEPLOY411.
```
