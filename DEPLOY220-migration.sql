-- =============================================================
-- DEPLOY220 - Decision State Machine + Unified Confidence
-- + Conceptual Reasoning Engine metadata
-- Run in Supabase SQL Editor
-- =============================================================

-- New columns for the state machine
alter table public.inspection_cases
  add column if not exists decision_state text default 'pending',
  add column if not exists decision_state_reason text,
  add column if not exists unified_confidence numeric,
  add column if not exists confidence_components jsonb,
  add column if not exists conceptual_reasoning jsonb,
  add column if not exists decision_state_changed_at timestamptz;

-- Constrain to valid states
-- (won't add if it already exists; safe to re-run)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_decision_state'
  ) then
    alter table public.inspection_cases
      add constraint chk_decision_state
      check (decision_state in (
        'pending', 'blocked', 'provisional', 'advisory', 'authority_locked'
      ));
  end if;
end $$;

-- Index for dashboard: cases needing attention
create index if not exists idx_cases_decision_state
  on public.inspection_cases(decision_state)
  where decision_state in ('blocked', 'provisional', 'advisory');

-- Index for fast unified confidence range queries
create index if not exists idx_cases_unified_confidence
  on public.inspection_cases(unified_confidence)
  where unified_confidence is not null;

comment on column public.inspection_cases.decision_state is
  'DEPLOY220 state machine: pending | blocked | provisional | advisory | authority_locked';
comment on column public.inspection_cases.unified_confidence is
  'DEPLOY220 composite score: min(authority_conf, physics_pct) * ood_discount';
comment on column public.inspection_cases.conceptual_reasoning is
  'DEPLOY220 Conceptual Reasoning Engine trace: 6-state concept chain from decision-core';
