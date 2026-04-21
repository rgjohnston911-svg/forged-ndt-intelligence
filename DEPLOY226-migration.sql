-- =============================================================
-- DEPLOY226 - Inspector Adjudication Engine
-- Run in Supabase SQL Editor
-- =============================================================

-- Inspector adjudication records
create table if not exists public.inspector_adjudications (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.inspection_cases(id),
  inspector_id uuid not null,
  inspector_email text,
  inspector_name text,
  inspector_cert_level text,
  adjudication_type text not null check (adjudication_type in ('concur', 'override', 'escalate')),

  -- System state at time of adjudication (snapshot)
  system_decision_state text,
  system_unified_confidence numeric,
  system_disposition text,
  system_precedence_tier text,
  system_predicted_failure_date timestamptz,
  system_remaining_life_months numeric,

  -- Inspector's decision (for overrides)
  override_decision text,
  override_disposition text,
  override_confidence numeric,

  -- Rationale (always required)
  rationale text not null,
  evidence_references text[] default '{}',
  additional_notes text,

  -- Escalation details
  escalate_to text,
  escalate_reason text,
  escalation_priority text check (escalation_priority in ('routine', 'elevated', 'urgent', 'emergency')),

  -- Metadata
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_adjudications_case_id on public.inspector_adjudications(case_id);
create index if not exists idx_adjudications_inspector_id on public.inspector_adjudications(inspector_id);
create index if not exists idx_adjudications_type on public.inspector_adjudications(adjudication_type);
create index if not exists idx_adjudications_created_at on public.inspector_adjudications(created_at desc);

-- RLS
alter table public.inspector_adjudications enable row level security;

drop policy if exists "adjudications_insert" on public.inspector_adjudications;
create policy "adjudications_insert" on public.inspector_adjudications
  for insert to authenticated
  with check (true);

drop policy if exists "adjudications_select" on public.inspector_adjudications;
create policy "adjudications_select" on public.inspector_adjudications
  for select to authenticated
  using (true);

drop policy if exists "adjudications_service" on public.inspector_adjudications;
create policy "adjudications_service" on public.inspector_adjudications
  for all to service_role
  using (true)
  with check (true);

-- Add adjudication tracking to inspection_cases
alter table public.inspection_cases
  add column if not exists adjudication_count int default 0,
  add column if not exists last_adjudication_type text,
  add column if not exists last_adjudication_at timestamptz,
  add column if not exists inspector_final_decision text,
  add column if not exists inspector_override_active boolean default false;

-- Comments
comment on table public.inspector_adjudications is
  'DEPLOY226 Inspector Adjudication: records inspector concur/override/escalate decisions with full rationale';
comment on column public.inspection_cases.adjudication_count is
  'DEPLOY226 total adjudication records for this case';
comment on column public.inspection_cases.inspector_override_active is
  'DEPLOY226 true if inspector has overridden system decision';
