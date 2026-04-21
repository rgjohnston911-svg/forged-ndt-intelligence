-- =============================================================
-- DEPLOY221 - Outcome Simulation Engine (Predictive Twins)
-- Run in Supabase SQL Editor
-- =============================================================

alter table public.inspection_cases
  add column if not exists outcome_simulation jsonb,
  add column if not exists outcome_simulation_generated_at timestamptz,
  add column if not exists predicted_failure_date timestamptz,
  add column if not exists remaining_life_months numeric;

-- Index for dashboard: cases approaching failure
create index if not exists idx_cases_remaining_life
  on public.inspection_cases(remaining_life_months)
  where remaining_life_months is not null;

comment on column public.inspection_cases.outcome_simulation is
  'DEPLOY221 Predictive Twins: scenario projections (do nothing, repair, monitor)';
comment on column public.inspection_cases.predicted_failure_date is
  'DEPLOY221 earliest projected failure under do-nothing scenario';
comment on column public.inspection_cases.remaining_life_months is
  'DEPLOY221 months until projected failure under do-nothing scenario';
