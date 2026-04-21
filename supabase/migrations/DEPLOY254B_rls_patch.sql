-- DEPLOY254B: RLS Patch for DEPLOY252 + DEPLOY253 tables
-- Safe to re-run — drops existing policies first
-- Run in Supabase SQL Editor

-- ============================================================
-- DEPLOY252 tables — RLS was commented out
-- ============================================================
alter table concept_runs enable row level security;
drop policy if exists "concept_runs_org_isolation" on concept_runs;
create policy "concept_runs_org_isolation" on concept_runs
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

alter table concept_flags enable row level security;
drop policy if exists "concept_flags_org_isolation" on concept_flags;
create policy "concept_flags_org_isolation" on concept_flags
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

alter table concept_action_queue enable row level security;
drop policy if exists "concept_action_queue_org_isolation" on concept_action_queue;
create policy "concept_action_queue_org_isolation" on concept_action_queue
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

alter table concept_pathways enable row level security;
drop policy if exists "concept_pathways_org_isolation" on concept_pathways;
create policy "concept_pathways_org_isolation" on concept_pathways
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

alter table concept_explanations enable row level security;
drop policy if exists "concept_explanations_org_isolation" on concept_explanations;
create policy "concept_explanations_org_isolation" on concept_explanations
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

alter table concept_learning_feedback enable row level security;
drop policy if exists "concept_learning_feedback_org_isolation" on concept_learning_feedback;
create policy "concept_learning_feedback_org_isolation" on concept_learning_feedback
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- DEPLOY253 tables with org_id
-- ============================================================
alter table concept_validation_events enable row level security;
drop policy if exists "concept_validation_events_org_isolation" on concept_validation_events;
create policy "concept_validation_events_org_isolation" on concept_validation_events
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

alter table concept_dominance_results enable row level security;
drop policy if exists "concept_dominance_results_org_isolation" on concept_dominance_results;
create policy "concept_dominance_results_org_isolation" on concept_dominance_results
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

alter table concept_replay_runs enable row level security;
drop policy if exists "concept_replay_runs_org_isolation" on concept_replay_runs;
create policy "concept_replay_runs_org_isolation" on concept_replay_runs
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

alter table concept_drift_metrics enable row level security;
drop policy if exists "concept_drift_metrics_org_isolation" on concept_drift_metrics;
create policy "concept_drift_metrics_org_isolation" on concept_drift_metrics
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

alter table concept_authority_events enable row level security;
drop policy if exists "concept_authority_events_org_isolation" on concept_authority_events;
create policy "concept_authority_events_org_isolation" on concept_authority_events
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

alter table concept_metrics_rollup enable row level security;
drop policy if exists "concept_metrics_rollup_org_isolation" on concept_metrics_rollup;
create policy "concept_metrics_rollup_org_isolation" on concept_metrics_rollup
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- Global config tables — no org_id, read-only for all
-- ============================================================
alter table concept_calibration_profiles enable row level security;
drop policy if exists "concept_calibration_profiles_read_all" on concept_calibration_profiles;
create policy "concept_calibration_profiles_read_all" on concept_calibration_profiles
  for select using (true);

alter table concept_registry enable row level security;
drop policy if exists "concept_registry_read_all" on concept_registry;
create policy "concept_registry_read_all" on concept_registry
  for select using (true);

-- ============================================================
-- Missing indexes on foreign keys
-- ============================================================
create index if not exists idx_concept_action_queue_run_id on concept_action_queue(concept_run_id);
create index if not exists idx_concept_pathways_run_id on concept_pathways(concept_run_id);
create index if not exists idx_concept_explanations_run_id on concept_explanations(concept_run_id);
create index if not exists idx_concept_explanations_case_id on concept_explanations(case_id);
create index if not exists idx_concept_learning_feedback_concept_key on concept_learning_feedback(concept_key);
