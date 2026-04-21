# DEPLOY221 — Predictive Twins (Outcome Simulation Engine)

Physics-based predictive engine that projects future outcomes under three scenarios: Do Nothing, Monitor, and Repair Now. Pure deterministic physics — no AI, no LLM calls.

## What it does

Given current damage data (wall thickness, crack size, pitting depth), the engine:

1. **Estimates corrosion rate** from wall loss and service life (or accepts user-provided rate)
2. **Projects wall thickness** forward in time at 6/12/24/36/48/60/84/120 month intervals
3. **Calculates time-to-failure** (when wall drops below t_min = 50% nominal)
4. **Compares 3 scenarios** side-by-side:
   - **Do Nothing**: current rate continues unchecked
   - **Monitor**: tightened inspection interval, 20% effective rate reduction through early intervention
   - **Repair Now**: restore to 90% nominal, 30% rate reduction with protective measures
5. **Projects crack growth** (10% annual, exponential) if crack measurements exist
6. **Projects pitting growth** (power law, n=0.40) if pitting measurements exist

## Deploy order

### 1. Run migration
File: `DEPLOY221-migration.sql` in Supabase SQL Editor.
Adds: `outcome_simulation` (jsonb), `outcome_simulation_generated_at`, `predicted_failure_date`, `remaining_life_months`.

### 2. Paste function
File: `netlify/functions/outcome-simulation.ts`
Endpoint: `POST /api/outcome-simulation { case_id, corrosion_rate_mpy? }`

### 3. Paste component
File: `src/components/OutcomeSimulationCard.tsx`

### 4. Mount on Decision tab in `src/pages/CaseDetail.tsx`

**Import** (with the others):
```
import OutcomeSimulationCard from "../components/OutcomeSimulationCard";
```

**JSX** — immediately after the MaterialAuthorityCard line:
```
{id && <OutcomeSimulationCard caseId={id} />}
```

---

## Smoke test on the riser case

1. Open NDT-1776299065297 (the riser with 12 thickness readings).
2. Decision tab → Predictive Twins → **Run simulation**.
3. Expected results:
   - **Do Nothing**: projected failure in ~41 months (wall loss at 29 mpy estimated from 42% loss over 10 years)
   - **Monitor**: failure pushed to ~51 months with 6-month inspection intervals
   - **Repair Now**: failure at ~131 months (restore to 0.450 in, rate drops to 20.3 mpy)
   - **Crack growth**: shows 6.5 in crack growing to ~11.7 in at 60 months
   - **Pitting growth**: shows 0.12 in pit growing to ~0.14 in at 60 months
   - Timeline table shows risk badges going from LOW → MEDIUM → HIGH → CRITICAL over time
   - "BELOW T-MIN" flag appears in red when projected thickness drops below 0.250 in

---

## Architecture

- All projections are deterministic physics (linear corrosion, exponential crack growth, power-law pitting)
- Corrosion rate estimated from: user input > calculated from wall loss/age > environment-based default
- t_min = 50% of nominal (conservative; future DEPLOY can use PD/2SE + CA from design data)
- Monitor scenario assumes 20% effective rate reduction (earlier detection = earlier intervention)
- Repair scenario assumes 90% nominal restoration and 30% rate reduction (coating/wrap protection)
- Results persisted: `remaining_life_months` and `predicted_failure_date` enable dashboard sorting by urgency
