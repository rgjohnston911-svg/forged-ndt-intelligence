-- DEPLOY254: Cost Reasoning Engine v1.0.0
-- 8 tables + indexes + RLS + starter seeds
-- Run in Supabase SQL Editor

-- ============================================================
-- 1. cost_models
-- ============================================================
create table if not exists cost_models (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  asset_type text not null,
  component_type text,
  failure_mode text,
  cost_category text not null,
  base_cost numeric not null,
  currency_code text not null default 'USD',
  multiplier_json jsonb not null default '{}'::jsonb,
  version text not null default 'v1.0.0',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_cost_models_org_id on cost_models(org_id);
create index if not exists idx_cost_models_asset_type on cost_models(asset_type);
create index if not exists idx_cost_models_failure_mode on cost_models(failure_mode);
create index if not exists idx_cost_models_active on cost_models(active);

alter table cost_models enable row level security;
create policy "cost_models_org_isolation" on cost_models
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 2. failure_cost_profiles
-- ============================================================
create table if not exists failure_cost_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  failure_mode text not null,
  consequence_level text not null,
  direct_repair_cost numeric,
  downtime_cost numeric,
  collateral_damage_cost numeric,
  environmental_cost numeric,
  safety_liability_cost numeric,
  regulatory_cost numeric,
  cost_json jsonb not null,
  currency_code text not null default 'USD',
  version text not null default 'v1.0.0',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_failure_cost_profiles_org_id on failure_cost_profiles(org_id);
create index if not exists idx_failure_cost_profiles_failure_mode on failure_cost_profiles(failure_mode);
create index if not exists idx_failure_cost_profiles_consequence_level on failure_cost_profiles(consequence_level);
create index if not exists idx_failure_cost_profiles_active on failure_cost_profiles(active);

alter table failure_cost_profiles enable row level security;
create policy "failure_cost_profiles_org_isolation" on failure_cost_profiles
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 3. inspection_cost_profiles
-- ============================================================
create table if not exists inspection_cost_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  method text not null,
  asset_type text,
  component_type text,
  mobilization_cost numeric,
  execution_cost numeric,
  analysis_cost numeric,
  outage_cost numeric,
  cost_json jsonb not null,
  currency_code text not null default 'USD',
  version text not null default 'v1.0.0',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_inspection_cost_profiles_org_id on inspection_cost_profiles(org_id);
create index if not exists idx_inspection_cost_profiles_method on inspection_cost_profiles(method);
create index if not exists idx_inspection_cost_profiles_active on inspection_cost_profiles(active);

alter table inspection_cost_profiles enable row level security;
create policy "inspection_cost_profiles_org_isolation" on inspection_cost_profiles
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 4. case_cost_scenarios
-- ============================================================
create table if not exists case_cost_scenarios (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  scenario_type text not null,
  immediate_cost numeric,
  expected_cost numeric,
  risk_exposure numeric,
  avoided_cost numeric,
  roi_value numeric,
  confidence numeric,
  currency_code text not null default 'USD',
  scenario_json jsonb not null,
  engine_version text not null default 'v1.0.0',
  created_at timestamptz not null default now()
);

create index if not exists idx_case_cost_scenarios_case_id on case_cost_scenarios(case_id);
create index if not exists idx_case_cost_scenarios_org_id on case_cost_scenarios(org_id);
create index if not exists idx_case_cost_scenarios_scenario_type on case_cost_scenarios(scenario_type);
create index if not exists idx_case_cost_scenarios_created_at on case_cost_scenarios(created_at desc);

alter table case_cost_scenarios enable row level security;
create policy "case_cost_scenarios_org_isolation" on case_cost_scenarios
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 5. cost_decision_outputs
-- ============================================================
create table if not exists cost_decision_outputs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  recommended_action text not null,
  best_scenario_type text not null,
  cost_summary_json jsonb not null,
  roi_json jsonb,
  narrative_json jsonb,
  engine_version text not null default 'v1.0.0',
  created_at timestamptz not null default now()
);

create index if not exists idx_cost_decision_outputs_case_id on cost_decision_outputs(case_id);
create index if not exists idx_cost_decision_outputs_org_id on cost_decision_outputs(org_id);
create index if not exists idx_cost_decision_outputs_best_scenario_type on cost_decision_outputs(best_scenario_type);

alter table cost_decision_outputs enable row level security;
create policy "cost_decision_outputs_org_isolation" on cost_decision_outputs
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 6. cost_assumption_profiles
-- ============================================================
create table if not exists cost_assumption_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  profile_name text not null,
  assumption_json jsonb not null,
  version text not null default 'v1.0.0',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_cost_assumption_profiles_org_id on cost_assumption_profiles(org_id);
create index if not exists idx_cost_assumption_profiles_active on cost_assumption_profiles(active);

alter table cost_assumption_profiles enable row level security;
create policy "cost_assumption_profiles_org_isolation" on cost_assumption_profiles
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 7. cost_timeline_projections
-- ============================================================
create table if not exists cost_timeline_projections (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  scenario_type text not null,
  time_horizon text not null,
  projected_cost numeric not null,
  probability_of_failure numeric,
  projection_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_cost_timeline_projections_case_id on cost_timeline_projections(case_id);
create index if not exists idx_cost_timeline_projections_org_id on cost_timeline_projections(org_id);
create index if not exists idx_cost_timeline_projections_scenario_type on cost_timeline_projections(scenario_type);
create index if not exists idx_cost_timeline_projections_time_horizon on cost_timeline_projections(time_horizon);

alter table cost_timeline_projections enable row level security;
create policy "cost_timeline_projections_org_isolation" on cost_timeline_projections
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 8. cost_audit_events
-- ============================================================
create table if not exists cost_audit_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  action_type text not null,
  event_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_cost_audit_events_case_id on cost_audit_events(case_id);
create index if not exists idx_cost_audit_events_org_id on cost_audit_events(org_id);
create index if not exists idx_cost_audit_events_action_type on cost_audit_events(action_type);

alter table cost_audit_events enable row level security;
create policy "cost_audit_events_org_isolation" on cost_audit_events
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- STARTER SEEDS
-- ============================================================

-- Cost models seed
insert into cost_models (org_id, asset_type, component_type, failure_mode, cost_category, base_cost, currency_code, multiplier_json, version, active) values
(null, 'pipeline', 'attachment_weld', 'fatigue_crack', 'repair_now', 40000, 'USD', '{"criticality_multiplier":1.6,"offshore_multiplier":2.0,"shutdown_multiplier":1.8}'::jsonb, 'v1.0.0', true),
(null, 'pipeline', 'attachment_weld', 'fatigue_crack', 'deferred_repair', 120000, 'USD', '{"time_escalation_multiplier":1.5,"criticality_multiplier":1.8}'::jsonb, 'v1.0.0', true),
(null, 'pipeline', 'attachment_weld', 'fatigue_crack', 'failure_event', 2200000, 'USD', '{"downtime_multiplier":2.2,"environmental_multiplier":1.4,"liability_multiplier":1.6}'::jsonb, 'v1.0.0', true),
(null, 'pressure_vessel', 'shell_weld', 'through_wall_crack', 'repair_now', 85000, 'USD', '{"shutdown_multiplier":2.0,"inspection_access_multiplier":1.3}'::jsonb, 'v1.0.0', true),
(null, 'pressure_vessel', 'shell_weld', 'through_wall_crack', 'deferred_repair', 220000, 'USD', '{"time_escalation_multiplier":1.6,"criticality_multiplier":2.0}'::jsonb, 'v1.0.0', true),
(null, 'pressure_vessel', 'shell_weld', 'through_wall_crack', 'failure_event', 3500000, 'USD', '{"downtime_multiplier":2.5,"environmental_multiplier":1.8,"liability_multiplier":2.0}'::jsonb, 'v1.0.0', true),
(null, 'structural_steel', 'connection_detail', 'fatigue_crack', 'repair_now', 25000, 'USD', '{"access_multiplier":1.2,"temporary_support_multiplier":1.5}'::jsonb, 'v1.0.0', true),
(null, 'structural_steel', 'connection_detail', 'fatigue_crack', 'deferred_repair', 65000, 'USD', '{"time_escalation_multiplier":1.4,"criticality_multiplier":1.5}'::jsonb, 'v1.0.0', true),
(null, 'structural_steel', 'connection_detail', 'fatigue_crack', 'failure_event', 1500000, 'USD', '{"downtime_multiplier":1.8,"liability_multiplier":2.2}'::jsonb, 'v1.0.0', true),
(null, 'pipeline', 'small_bore_connection', 'fiv_fatigue', 'repair_now', 35000, 'USD', '{"criticality_multiplier":1.4,"offshore_multiplier":2.0}'::jsonb, 'v1.0.0', true),
(null, 'pipeline', 'small_bore_connection', 'fiv_fatigue', 'failure_event', 1800000, 'USD', '{"downtime_multiplier":2.0,"environmental_multiplier":1.6}'::jsonb, 'v1.0.0', true),
(null, 'bridge', 'substructure', 'scour_undermining', 'repair_now', 150000, 'USD', '{"access_multiplier":1.8,"underwater_multiplier":2.5}'::jsonb, 'v1.0.0', true),
(null, 'bridge', 'substructure', 'scour_undermining', 'failure_event', 8500000, 'USD', '{"liability_multiplier":3.0,"environmental_multiplier":1.2}'::jsonb, 'v1.0.0', true),
(null, 'storage_tank', 'floor_plate', 'corrosion_under_insulation', 'repair_now', 55000, 'USD', '{"scaffold_multiplier":1.6,"insulation_removal_multiplier":1.3}'::jsonb, 'v1.0.0', true),
(null, 'storage_tank', 'floor_plate', 'corrosion_under_insulation', 'failure_event', 2800000, 'USD', '{"downtime_multiplier":2.0,"environmental_multiplier":2.5}'::jsonb, 'v1.0.0', true)
on conflict do nothing;

-- Failure cost profiles seed
insert into failure_cost_profiles (org_id, failure_mode, consequence_level, direct_repair_cost, downtime_cost, collateral_damage_cost, environmental_cost, safety_liability_cost, regulatory_cost, cost_json, currency_code, version, active) values
(null, 'fatigue_crack', 'high', 250000, 1100000, 300000, 150000, 250000, 150000, '{"notes":"Representative high-consequence piping failure profile"}'::jsonb, 'USD', 'v1.0.0', true),
(null, 'fatigue_crack', 'critical', 400000, 1800000, 500000, 300000, 500000, 250000, '{"notes":"Critical piping fatigue failure profile"}'::jsonb, 'USD', 'v1.0.0', true),
(null, 'through_wall_crack', 'critical', 500000, 1800000, 450000, 250000, 600000, 250000, '{"notes":"Representative pressure boundary critical failure profile"}'::jsonb, 'USD', 'v1.0.0', true),
(null, 'structural_instability', 'critical', 350000, 900000, 700000, 50000, 500000, 100000, '{"notes":"Representative structural consequence profile"}'::jsonb, 'USD', 'v1.0.0', true),
(null, 'fiv_fatigue', 'high', 200000, 900000, 250000, 180000, 200000, 120000, '{"notes":"Flow-induced vibration fatigue failure profile"}'::jsonb, 'USD', 'v1.0.0', true),
(null, 'scour_undermining', 'critical', 600000, 2500000, 1200000, 100000, 800000, 200000, '{"notes":"Bridge scour undermining failure profile"}'::jsonb, 'USD', 'v1.0.0', true),
(null, 'corrosion_under_insulation', 'high', 280000, 1200000, 200000, 350000, 180000, 160000, '{"notes":"CUI leak-to-failure profile"}'::jsonb, 'USD', 'v1.0.0', true),
(null, 'hic_sohic', 'high', 320000, 1400000, 350000, 200000, 300000, 180000, '{"notes":"HIC/SOHIC wet H2S cracking profile"}'::jsonb, 'USD', 'v1.0.0', true),
(null, 'scc_cascade', 'critical', 450000, 1600000, 400000, 280000, 550000, 220000, '{"notes":"Stress corrosion cracking cascade failure profile"}'::jsonb, 'USD', 'v1.0.0', true)
on conflict do nothing;

-- Inspection cost profiles seed
insert into inspection_cost_profiles (org_id, method, asset_type, component_type, mobilization_cost, execution_cost, analysis_cost, outage_cost, cost_json, currency_code, version, active) values
(null, 'PAUT', 'pipeline', 'attachment_weld', 2500, 3500, 1500, 1000, '{"notes":"Typical targeted PAUT follow-up profile"}'::jsonb, 'USD', 'v1.0.0', true),
(null, 'TOFD', 'pipeline', 'attachment_weld', 3000, 4000, 1800, 1000, '{"notes":"Typical TOFD follow-up profile"}'::jsonb, 'USD', 'v1.0.0', true),
(null, 'UT', 'pipeline', 'attachment_weld', 1500, 1800, 800, 500, '{"notes":"Typical manual UT profile"}'::jsonb, 'USD', 'v1.0.0', true),
(null, 'RT', 'pipeline', 'attachment_weld', 3500, 5000, 2000, 2000, '{"notes":"Radiographic testing profile"}'::jsonb, 'USD', 'v1.0.0', true),
(null, 'ET', 'pipeline', 'attachment_weld', 2000, 2800, 1200, 800, '{"notes":"Eddy current testing profile"}'::jsonb, 'USD', 'v1.0.0', true),
(null, 'MFL', 'pipeline', null, 4000, 6000, 2500, 1500, '{"notes":"Magnetic flux leakage inline profile"}'::jsonb, 'USD', 'v1.0.0', true),
(null, 'AE', 'pressure_vessel', null, 3500, 4500, 2000, 0, '{"notes":"Acoustic emission monitoring profile"}'::jsonb, 'USD', 'v1.0.0', true),
(null, 'advanced_visual', 'structural_steel', 'connection_detail', 800, 900, 300, 0, '{"notes":"Typical advanced visual profile"}'::jsonb, 'USD', 'v1.0.0', true),
(null, 'MT', 'structural_steel', 'connection_detail', 1200, 1500, 600, 0, '{"notes":"Magnetic particle testing profile"}'::jsonb, 'USD', 'v1.0.0', true),
(null, 'PT', 'structural_steel', 'connection_detail', 1000, 1200, 500, 0, '{"notes":"Penetrant testing profile"}'::jsonb, 'USD', 'v1.0.0', true),
(null, 'VT', null, null, 500, 600, 200, 0, '{"notes":"Basic visual testing profile"}'::jsonb, 'USD', 'v1.0.0', true)
on conflict do nothing;

-- Assumption profile seed
insert into cost_assumption_profiles (org_id, profile_name, assumption_json, version, active) values
(
  null,
  'default_integrity_cost_assumptions',
  '{
    "discount_rate": 0.08,
    "monitoring_decay_penalty": 0.12,
    "uncertainty_cost_multiplier": 0.15,
    "high_consequence_failure_probability_floor": 0.10,
    "critical_failure_probability_floor": 0.20,
    "executive_summary_currency_rounding": 1000,
    "default_time_horizons": ["immediate", "3_month", "12_month", "36_month"],
    "deferred_condition_escalation_default": 1.15,
    "monitoring_risk_retention_factor": 0.35,
    "inspection_uncertainty_reduction_factor": 0.35,
    "residual_risk_after_repair": 0.15
  }'::jsonb,
  'v1.0.0',
  true
)
on conflict do nothing;
