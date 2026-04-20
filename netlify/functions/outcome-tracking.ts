-- DEPLOY255: Outcome Tracking Engine v1.0.0
-- Closes the feedback loop: what did we predict vs what actually happened
-- 7 tables + indexes + RLS + starter seeds
-- Run in Supabase SQL Editor

-- ============================================================
-- 1. outcome_records — the master outcome for a case
-- What actually happened after the decision was made
-- ============================================================
create table if not exists outcome_records (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  outcome_type text not null,
  outcome_status text not null default 'pending',
  recorded_by uuid,
  actual_disposition text,
  actual_failure_mode text,
  actual_consequence_level text,
  time_to_outcome_days integer,
  outcome_json jsonb not null default '{}'::jsonb,
  notes text,
  engine_version text not null default 'v1.0.0',
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_outcome_records_case_id on outcome_records(case_id);
create index if not exists idx_outcome_records_org_id on outcome_records(org_id);
create index if not exists idx_outcome_records_outcome_type on outcome_records(outcome_type);
create index if not exists idx_outcome_records_outcome_status on outcome_records(outcome_status);
create index if not exists idx_outcome_records_created_at on outcome_records(created_at desc);

alter table outcome_records enable row level security;
drop policy if exists "outcome_records_org_isolation" on outcome_records;
create policy "outcome_records_org_isolation" on outcome_records
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 2. prediction_accuracy — compare each prediction to actual
-- Did concept intelligence get it right?
-- ============================================================
create table if not exists prediction_accuracy (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  outcome_record_id uuid not null references outcome_records(id) on delete cascade,
  prediction_source text not null,
  prediction_type text not null,
  predicted_value text,
  actual_value text,
  accuracy_score numeric,
  match_type text not null default 'pending',
  accuracy_json jsonb not null default '{}'::jsonb,
  engine_version text not null default 'v1.0.0',
  created_at timestamptz not null default now()
);

create index if not exists idx_prediction_accuracy_case_id on prediction_accuracy(case_id);
create index if not exists idx_prediction_accuracy_org_id on prediction_accuracy(org_id);
create index if not exists idx_prediction_accuracy_outcome_record_id on prediction_accuracy(outcome_record_id);
create index if not exists idx_prediction_accuracy_prediction_source on prediction_accuracy(prediction_source);
create index if not exists idx_prediction_accuracy_match_type on prediction_accuracy(match_type);

alter table prediction_accuracy enable row level security;
drop policy if exists "prediction_accuracy_org_isolation" on prediction_accuracy;
create policy "prediction_accuracy_org_isolation" on prediction_accuracy
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 3. cost_accuracy — predicted cost vs actual cost
-- Did the Cost Reasoning Engine get it right?
-- ============================================================
create table if not exists cost_accuracy (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  outcome_record_id uuid not null references outcome_records(id) on delete cascade,
  scenario_type text not null,
  predicted_cost numeric not null,
  actual_cost numeric,
  cost_variance numeric,
  cost_variance_pct numeric,
  accuracy_grade text,
  cost_json jsonb not null default '{}'::jsonb,
  currency_code text not null default 'USD',
  engine_version text not null default 'v1.0.0',
  created_at timestamptz not null default now()
);

create index if not exists idx_cost_accuracy_case_id on cost_accuracy(case_id);
create index if not exists idx_cost_accuracy_org_id on cost_accuracy(org_id);
create index if not exists idx_cost_accuracy_outcome_record_id on cost_accuracy(outcome_record_id);
create index if not exists idx_cost_accuracy_scenario_type on cost_accuracy(scenario_type);
create index if not exists idx_cost_accuracy_accuracy_grade on cost_accuracy(accuracy_grade);

alter table cost_accuracy enable row level security;
drop policy if exists "cost_accuracy_org_isolation" on cost_accuracy;
create policy "cost_accuracy_org_isolation" on cost_accuracy
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 4. inspection_effectiveness — did the recommended method work?
-- ============================================================
create table if not exists inspection_effectiveness (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  outcome_record_id uuid not null references outcome_records(id) on delete cascade,
  method_recommended text not null,
  method_used text not null,
  detection_success boolean,
  sizing_accuracy_pct numeric,
  false_call boolean not null default false,
  missed_finding boolean not null default false,
  effectiveness_score numeric,
  effectiveness_json jsonb not null default '{}'::jsonb,
  engine_version text not null default 'v1.0.0',
  created_at timestamptz not null default now()
);

create index if not exists idx_inspection_effectiveness_case_id on inspection_effectiveness(case_id);
create index if not exists idx_inspection_effectiveness_org_id on inspection_effectiveness(org_id);
create index if not exists idx_inspection_effectiveness_outcome_record_id on inspection_effectiveness(outcome_record_id);
create index if not exists idx_inspection_effectiveness_method_used on inspection_effectiveness(method_used);

alter table inspection_effectiveness enable row level security;
drop policy if exists "inspection_effectiveness_org_isolation" on inspection_effectiveness;
create policy "inspection_effectiveness_org_isolation" on inspection_effectiveness
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 5. concept_accuracy — per-concept engine accuracy over time
-- Feeds back into concept reliability scores in v2.1
-- ============================================================
create table if not exists concept_accuracy (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  outcome_record_id uuid not null references outcome_records(id) on delete cascade,
  concept_key text not null,
  was_activated boolean not null,
  was_correct boolean,
  was_useful boolean,
  was_governing boolean not null default false,
  confidence_at_prediction numeric,
  accuracy_json jsonb not null default '{}'::jsonb,
  engine_version text not null default 'v1.0.0',
  created_at timestamptz not null default now()
);

create index if not exists idx_concept_accuracy_case_id on concept_accuracy(case_id);
create index if not exists idx_concept_accuracy_org_id on concept_accuracy(org_id);
create index if not exists idx_concept_accuracy_outcome_record_id on concept_accuracy(outcome_record_id);
create index if not exists idx_concept_accuracy_concept_key on concept_accuracy(concept_key);

alter table concept_accuracy enable row level security;
drop policy if exists "concept_accuracy_org_isolation" on concept_accuracy;
create policy "concept_accuracy_org_isolation" on concept_accuracy
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 6. outcome_calibration_queue — recommended adjustments
-- System suggestions for improving accuracy
-- ============================================================
create table if not exists outcome_calibration_queue (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  target_engine text not null,
  target_parameter text not null,
  current_value numeric,
  recommended_value numeric,
  reason text not null,
  evidence_count integer not null default 0,
  confidence numeric,
  status text not null default 'pending',
  calibration_json jsonb not null default '{}'::jsonb,
  engine_version text not null default 'v1.0.0',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists idx_outcome_calibration_queue_org_id on outcome_calibration_queue(org_id);
create index if not exists idx_outcome_calibration_queue_target_engine on outcome_calibration_queue(target_engine);
create index if not exists idx_outcome_calibration_queue_status on outcome_calibration_queue(status);

alter table outcome_calibration_queue enable row level security;
drop policy if exists "outcome_calibration_queue_org_isolation" on outcome_calibration_queue;
create policy "outcome_calibration_queue_org_isolation" on outcome_calibration_queue
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 7. outcome_audit_events — audit trail for all outcome operations
-- ============================================================
create table if not exists outcome_audit_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid,
  org_id uuid not null,
  action_type text not null,
  event_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_outcome_audit_events_case_id on outcome_audit_events(case_id);
create index if not exists idx_outcome_audit_events_org_id on outcome_audit_events(org_id);
create index if not exists idx_outcome_audit_events_action_type on outcome_audit_events(action_type);

alter table outcome_audit_events enable row level security;
drop policy if exists "outcome_audit_events_org_isolation" on outcome_audit_events;
create policy "outcome_audit_events_org_isolation" on outcome_audit_events
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- STARTER SEEDS — outcome types and grading thresholds
-- ============================================================
insert into outcome_records (case_id, org_id, outcome_type, outcome_status, outcome_json, notes) values
('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'seed_example', 'closed',
 '{"outcome_types":["repair_confirmed","repair_not_needed","failure_occurred","monitoring_stable","monitoring_degraded","inspection_confirmed","inspection_missed","deferred_no_change","deferred_worsened"],"accuracy_grades":["exact_match","close_match","partial_match","miss","opposite"],"cost_variance_thresholds":{"exact":0.10,"close":0.25,"partial":0.50,"miss":1.00}}'::jsonb,
 'Seed row with reference enums and thresholds — do not delete')
on conflict do nothing;
