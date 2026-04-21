-- DEPLOY252: Concept Intelligence Core v2.0.0
-- SQL migration for concept intelligence tables
-- Run in Supabase SQL Editor

-- 1. concept_registry — registered concept engines
create table if not exists concept_registry (
  id uuid primary key default gen_random_uuid(),
  concept_key text unique not null,
  concept_family text not null,
  concept_name text not null,
  description text not null,
  deterministic boolean not null default true,
  active boolean not null default true,
  severity_weight numeric not null default 1.0,
  engine_version text not null default 'v2.0.0',
  created_at timestamptz not null default now()
);

create index if not exists idx_concept_registry_family on concept_registry(concept_family);
create index if not exists idx_concept_registry_active on concept_registry(active);

-- 2. concept_runs — each time the engine analyzes a case
create table if not exists concept_runs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  governing_concept text,
  output_json jsonb not null,
  engine_version text not null default 'v2.0.0',
  created_at timestamptz not null default now()
);

create index if not exists idx_concept_runs_case_id on concept_runs(case_id);
create index if not exists idx_concept_runs_org_id on concept_runs(org_id);
create index if not exists idx_concept_runs_created_at on concept_runs(created_at desc);

-- 3. concept_flags — individual flags raised per run
create table if not exists concept_flags (
  id uuid primary key default gen_random_uuid(),
  concept_run_id uuid not null references concept_runs(id) on delete cascade,
  case_id uuid not null,
  org_id uuid not null,
  concept_key text not null,
  flag_type text not null,
  severity text not null,
  confidence numeric,
  details_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_concept_flags_run_id on concept_flags(concept_run_id);
create index if not exists idx_concept_flags_case_id on concept_flags(case_id);
create index if not exists idx_concept_flags_org_id on concept_flags(org_id);

-- 4. concept_action_queue — recommended next actions
create table if not exists concept_action_queue (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  concept_run_id uuid not null references concept_runs(id) on delete cascade,
  action_type text not null,
  priority text not null,
  reason text not null,
  status text not null default 'pending',
  details_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_concept_action_queue_case_id on concept_action_queue(case_id);
create index if not exists idx_concept_action_queue_status on concept_action_queue(status);

-- 5. concept_pathways — failure pathway simulations
create table if not exists concept_pathways (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  concept_run_id uuid not null references concept_runs(id) on delete cascade,
  pathway_key text not null,
  plausibility numeric not null,
  consequence_level text,
  time_horizon text,
  pathway_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_concept_pathways_case_id on concept_pathways(case_id);
create index if not exists idx_concept_pathways_plausibility on concept_pathways(plausibility desc);

-- 6. concept_explanations — audit narrative per run
create table if not exists concept_explanations (
  id uuid primary key default gen_random_uuid(),
  concept_run_id uuid not null references concept_runs(id) on delete cascade,
  case_id uuid not null,
  org_id uuid not null,
  short_text text not null,
  full_text text not null,
  explanation_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_concept_explanations_case_id on concept_explanations(case_id);

-- 7. concept_learning_feedback — inspector feedback loop
create table if not exists concept_learning_feedback (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  concept_run_id uuid references concept_runs(id) on delete set null,
  concept_key text,
  inspector_action text,
  outcome_label text,
  feedback_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_concept_learning_feedback_case_id on concept_learning_feedback(case_id);

-- 8. Seed concept registry
insert into concept_registry (concept_key, concept_family, concept_name, description, deterministic, severity_weight, engine_version) values
('constraint_dominance', 'governing_reality', 'Constraint Dominance Engine', 'Identifies the governing constraint controlling the case.', true, 1.00, 'v2.0.0'),
('physics_sufficiency', 'governing_reality', 'Physics Sufficiency Engine', 'Determines whether available methods and evidence are sufficient to support the conclusion.', true, 1.10, 'v2.0.0'),
('mechanism_propagation', 'propagation_reality', 'Mechanism Propagation Engine', 'Triggers secondary risks and recommended follow-up based on primary findings.', true, 1.00, 'v2.0.0'),
('mechanism_interaction', 'propagation_reality', 'Mechanism Interaction Engine', 'Detects coupled or mutually reinforcing mechanisms.', true, 1.05, 'v2.0.0'),
('contradiction_detection', 'uncertainty_reality', 'Contradiction Detection Engine', 'Flags conflicts between evidence, context, and conclusions.', true, 1.15, 'v2.0.0'),
('blind_spot_detection', 'uncertainty_reality', 'Blind Spot Detector', 'Finds missing scope, missing coverage, or missing context.', true, 1.05, 'v2.0.0'),
('information_gain', 'action_reality', 'Information Gain Engine', 'Ranks next actions by uncertainty reduction value.', true, 0.95, 'v2.0.0'),
('failure_pathway', 'propagation_reality', 'Failure Pathway Simulator', 'Builds plausible defect-to-failure pathways.', true, 1.10, 'v2.0.0'),
('parallel_reality', 'action_reality', 'Parallel Reality Engine', 'Simulates likely outcomes under multiple response strategies.', true, 0.90, 'v2.0.0'),
('confidence_collapse', 'uncertainty_reality', 'Confidence Collapse Engine', 'Reduces confidence when evidence quality or method adequacy is insufficient.', true, 1.20, 'v2.0.0'),
('decision_boundary', 'governing_reality', 'Decision Boundary Engine', 'Detects when the case sits near an acceptance or rejection threshold.', true, 1.10, 'v2.0.0'),
('causal_root', 'origin_reality', 'Causal Root Engine', 'Ranks upstream drivers that likely caused the observed condition.', false, 0.85, 'v2.0.0')
on conflict (concept_key) do nothing;

-- 9. RLS policies (enable after verifying org_id model)
-- alter table concept_runs enable row level security;
-- alter table concept_flags enable row level security;
-- alter table concept_action_queue enable row level security;
-- alter table concept_pathways enable row level security;
-- alter table concept_explanations enable row level security;
-- alter table concept_learning_feedback enable row level security;
-- Create policies matching your existing org_id pattern when ready
