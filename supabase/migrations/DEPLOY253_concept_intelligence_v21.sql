-- DEPLOY253: Concept Intelligence Core v2.1 — Validation + Dominance Pack
-- Run in Supabase SQL Editor AFTER DEPLOY252 migration

-- 1. concept_validation_events — track confirmed/false_positive/useful per activation
create table if not exists concept_validation_events (
  id uuid primary key default gen_random_uuid(),
  concept_run_id uuid not null references concept_runs(id) on delete cascade,
  case_id uuid not null,
  org_id uuid not null,
  concept_key text not null,
  validation_status text not null,
  validation_source text not null,
  validator_user_id uuid,
  usefulness_score numeric,
  agreement_score numeric,
  notes text,
  validation_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_concept_validation_events_run_id on concept_validation_events(concept_run_id);
create index if not exists idx_concept_validation_events_case_id on concept_validation_events(case_id);
create index if not exists idx_concept_validation_events_org_id on concept_validation_events(org_id);
create index if not exists idx_concept_validation_events_concept_key on concept_validation_events(concept_key);
create index if not exists idx_concept_validation_events_status on concept_validation_events(validation_status);

-- 2. concept_dominance_results — which concept governs, which are supporting/suppressed
create table if not exists concept_dominance_results (
  id uuid primary key default gen_random_uuid(),
  concept_run_id uuid not null references concept_runs(id) on delete cascade,
  case_id uuid not null,
  org_id uuid not null,
  governing_concept text,
  visible_supporting_concepts jsonb not null default '[]'::jsonb,
  suppressed_concepts jsonb not null default '[]'::jsonb,
  audit_only_concepts jsonb not null default '[]'::jsonb,
  dominance_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_concept_dominance_results_run_id on concept_dominance_results(concept_run_id);
create index if not exists idx_concept_dominance_results_case_id on concept_dominance_results(case_id);
create index if not exists idx_concept_dominance_results_org_id on concept_dominance_results(org_id);

-- 3. concept_replay_runs — re-run old cases through current logic
create table if not exists concept_replay_runs (
  id uuid primary key default gen_random_uuid(),
  source_case_id uuid not null,
  org_id uuid not null,
  replay_version text not null default 'v2.1.0',
  replay_mode text not null default 'strict',
  replay_output jsonb not null,
  improvement_delta_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_concept_replay_runs_case_id on concept_replay_runs(source_case_id);
create index if not exists idx_concept_replay_runs_org_id on concept_replay_runs(org_id);

-- 4. concept_drift_metrics — accuracy drift by vertical/method over time
create table if not exists concept_drift_metrics (
  id uuid primary key default gen_random_uuid(),
  concept_key text not null,
  org_id uuid,
  vertical text,
  asset_type text,
  material_class text,
  method text,
  time_window text not null,
  activation_rate numeric,
  confirmation_rate numeric,
  false_positive_rate numeric,
  false_negative_rate numeric,
  drift_score numeric,
  metric_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_concept_drift_metrics_concept_key on concept_drift_metrics(concept_key);
create index if not exists idx_concept_drift_metrics_org_id on concept_drift_metrics(org_id);
create index if not exists idx_concept_drift_metrics_vertical on concept_drift_metrics(vertical);

-- 5. concept_calibration_profiles — per-concept tuning parameters
create table if not exists concept_calibration_profiles (
  id uuid primary key default gen_random_uuid(),
  concept_key text not null,
  vertical text,
  severity_tier text,
  calibration_json jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_concept_calibration_profiles_concept_key on concept_calibration_profiles(concept_key);
create index if not exists idx_concept_calibration_profiles_active on concept_calibration_profiles(active);

-- 6. concept_authority_events — HOLD/PROVISIONAL/ESCALATE/STABLE decisions
create table if not exists concept_authority_events (
  id uuid primary key default gen_random_uuid(),
  concept_run_id uuid not null references concept_runs(id) on delete cascade,
  case_id uuid not null,
  org_id uuid not null,
  authority_state text not null,
  authority_reason text not null,
  authority_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_concept_authority_events_run_id on concept_authority_events(concept_run_id);
create index if not exists idx_concept_authority_events_case_id on concept_authority_events(case_id);
create index if not exists idx_concept_authority_events_state on concept_authority_events(authority_state);

-- 7. concept_metrics_rollup — aggregated reliability per concept per period
create table if not exists concept_metrics_rollup (
  id uuid primary key default gen_random_uuid(),
  concept_key text not null,
  org_id uuid,
  period_key text not null,
  activations integer not null default 0,
  confirmed integer not null default 0,
  false_positives integer not null default 0,
  false_negatives integer not null default 0,
  inconclusive integer not null default 0,
  followed_and_useful integer not null default 0,
  ignored_but_correct integer not null default 0,
  average_usefulness numeric,
  average_agreement numeric,
  reliability_score numeric,
  rollup_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_concept_metrics_rollup_concept_key on concept_metrics_rollup(concept_key);
create index if not exists idx_concept_metrics_rollup_org_id on concept_metrics_rollup(org_id);
create index if not exists idx_concept_metrics_rollup_period_key on concept_metrics_rollup(period_key);

-- 8. Seed calibration profiles
insert into concept_calibration_profiles (concept_key, vertical, severity_tier, calibration_json, active) values
('physics_sufficiency', 'default', 'all', '{"family_authority_weight":1.00,"hold_threshold":0.75,"dominance_bonus":0.20,"noise_penalty":0.05}'::jsonb, true),
('contradiction_detection', 'default', 'all', '{"family_authority_weight":0.95,"hold_threshold":0.70,"dominance_bonus":0.18,"noise_penalty":0.06}'::jsonb, true),
('decision_boundary', 'default', 'all', '{"family_authority_weight":0.98,"provisional_threshold":0.68,"dominance_bonus":0.17,"noise_penalty":0.04}'::jsonb, true),
('mechanism_propagation', 'default', 'all', '{"family_authority_weight":0.85,"visible_threshold":0.60,"dominance_bonus":0.10,"noise_penalty":0.08}'::jsonb, true),
('blind_spot_detection', 'default', 'high_consequence', '{"family_authority_weight":0.92,"hold_threshold":0.72,"dominance_bonus":0.16,"noise_penalty":0.05}'::jsonb, true),
('information_gain', 'default', 'all', '{"family_authority_weight":0.75,"visible_threshold":0.58,"dominance_bonus":0.08,"noise_penalty":0.10}'::jsonb, true),
('constraint_dominance', 'default', 'all', '{"family_authority_weight":1.00,"hold_threshold":0.80,"dominance_bonus":0.22,"noise_penalty":0.03}'::jsonb, true),
('confidence_collapse', 'default', 'all', '{"family_authority_weight":0.90,"hold_threshold":0.65,"dominance_bonus":0.15,"noise_penalty":0.06}'::jsonb, true),
('mechanism_interaction', 'default', 'all', '{"family_authority_weight":0.83,"visible_threshold":0.62,"dominance_bonus":0.12,"noise_penalty":0.07}'::jsonb, true),
('failure_pathway', 'default', 'all', '{"family_authority_weight":0.80,"visible_threshold":0.55,"dominance_bonus":0.10,"noise_penalty":0.08}'::jsonb, true),
('parallel_reality', 'default', 'all', '{"family_authority_weight":0.72,"visible_threshold":0.50,"dominance_bonus":0.06,"noise_penalty":0.10}'::jsonb, true),
('causal_root', 'default', 'all', '{"family_authority_weight":0.65,"visible_threshold":0.45,"dominance_bonus":0.05,"noise_penalty":0.12}'::jsonb, true)
on conflict do nothing;
