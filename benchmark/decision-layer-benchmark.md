# Decision-Layer Benchmark (LIVE-scored) — governing mechanism / disposition / escalation

## Why this exists
The offline benchmark (benchmark/run.cjs) measures the tractable layers
(classification, organizational, forecast, jurisdiction). It CANNOT measure the
decision-critical layers — governing-mechanism correctness, disposition, and
escalation — because those run through the live pipeline (parse -> FMD ->
decision-core -> HOLD gate -> SA/forecaster). This rubric is how you score those,
using the 50-case Governing-Mechanism/Disposition/Escalation battery whose
"Hidden Condition" lines are the ground-truth answer key.

## How to run
Paste each case into the DEPLOYED app, read the report, and score against the
archetype's pass criteria below. Record pass/fail per case; the decision-layer
score = passes / 50. This is the number that actually tells you whether the
platform "understands reality," and it is the prerequisite the Arbiter spec
depends on (don't build the arbiter on unmeasured lenses).

## The 5 archetypes (10 assets each) and PASS criteria
The obvious defect must NOT be reported as the governing risk; the platform must
surface the hidden governing factor and escalate appropriately.

1. "Corrosion appears obvious but FATIGUE governs"
   PASS = report names fatigue/cyclic loading as governing (or as a required
   alternate mechanism to rule out), not general corrosion alone. FMD should not
   lock corrosion as dominant without addressing fatigue.

2. "Crack present but CONSEQUENCE governs"
   PASS = report elevates on consequence (life-safety/toxic/collateral), not just
   crack size; disposition reflects consequence tier, not thickness acceptability.

3. "Wall loss acceptable but FUTURE-STATE risk governs"
   PASS = future-state forecaster / timeline drives the call; report states the
   asset is acceptable today but flags the forward risk (breach-before-intervention
   style), not "monitor, acceptable."

4. "SUPPORT failure more critical than the primary asset"
   PASS = report shifts attention to the support/structural element and its
   consequence pathway, not only the primary component finding.

5. "HUMAN FACTORS dominate technical findings"
   PASS = report surfaces the organizational/human driver (production pressure,
   deferred maintenance, competency) as governing, not the technical indication
   alone. (Org engine + SA should fire.)

Every case also carries: production pressure, deferred maintenance, future
operating change, non-obvious consequence pathways -> escalation SHOULD be
required in all 50. A "continue / acceptable / monitor only" answer with no
escalation is a FAIL.

## Scoring sheet (fill in from live runs)
Assets per archetype: Refinery Piping, Pressure Vessel, Offshore Platform, Bridge,
LNG Transfer Line, Pipeline, Storage Tank, Heat Exchanger, Boiler, Subsea Structure.

| Archetype (ground truth) | passes / 10 | notes |
|---|---|---|
| Fatigue governs (not corrosion) |  /10 |  |
| Consequence governs (not crack) |  /10 |  |
| Future-state governs (not wall loss) |  /10 |  |
| Support governs (not primary) |  /10 |  |
| Human factors govern (not technical) |  /10 |  |
| **Decision-layer total** | **/50** |  |

## Honest caveats
- 5 archetypes x 10 assets = breadth across assets, not 50 distinct situations.
  Good for "does it look past the obvious defect"; pair with the diverse Test 1/2/3
  style scenarios for depth.
- Cases are abstract (no numbers), so they test the reasoning/parse layer, not the
  calc engines. Calc correctness is covered by the difficult-mechanism battery
  (run live) + remaining-strength-guard test (offline).
