-- DEPLOY258: Predictive Remaining Life v1.0.0
-- Estimates remaining component life from inspection history,
-- degradation rates, process data, and environmental factors.
-- Run in Supabase SQL Editor

-- 1. degradation_models
-- Reference models for how different damage mechanisms progress
create table degradation_models (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  model_key text not null,
  model_name text not null,
  damage_mechanism text not null,
  asset_type text,
  material_class text,
  environment text,
  base_rate numeric not null,
  base_rate_unit text not null default 'mm_per_year',
  acceleration_factors jsonb not null default '{}'::jsonb,
  temperature_factor numeric not null default 1.0,
  pressure_factor numeric not null default 1.0,
  cyclic_factor numeric not null default 1.0,
  environment_factor numeric not null default 1.0,
  confidence numeric not null default 0.7,
  model_json jsonb not null default '{}'::jsonb,
  source text not null default 'engineering_estimate',
  active boolean not null default true,
  engine_version text not null default 'v1.0.0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_degradation_models_org_id on degradation_models(org_id);
create index idx_degradation_models_model_key on degradation_models(model_key);
create index idx_degradation_models_damage_mechanism on degradation_models(damage_mechanism);
create index idx_degradation_models_asset_type on degradation_models(asset_type);
create index idx_degradation_models_material_class on degradation_models(material_class);
create index idx_degradation_models_active on degradation_models(active);

alter table degradation_models enable row level security;
create policy "degradation_models_org_isolation" on degradation_models
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- 2. asset_condition_records
-- Point-in-time condition snapshots from inspections
create table asset_condition_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  asset_id text not null,
  case_id uuid,
  inspection_date timestamptz not null,
  measurement_type text not null,
  measured_value numeric not null,
  measurement_unit text not null default 'mm',
  nominal_value numeric,
  minimum_allowable numeric,
  location_description text,
  measurement_json jsonb not null default '{}'::jsonb,
  inspector_id uuid,
  method text,
  created_at timestamptz not null default now()
);

create index idx_asset_condition_records_org_id on asset_condition_records(org_id);
create index idx_asset_condition_records_asset_id on asset_condition_records(asset_id);
create index idx_asset_condition_records_case_id on asset_condition_records(case_id);
create index idx_asset_condition_records_inspection_date on asset_condition_records(inspection_date);
create index idx_asset_condition_records_measurement_type on asset_condition_records(measurement_type);

alter table asset_condition_records enable row level security;
create policy "asset_condition_records_org_isolation" on asset_condition_records
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- 3. life_predictions
-- Computed remaining life estimates
create table life_predictions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  asset_id text not null,
  case_id uuid,
  model_id uuid references degradation_models(id) on delete set null,
  prediction_type text not null default 'remaining_life',
  current_value numeric not null,
  minimum_allowable numeric not null,
  degradation_rate numeric not null,
  degradation_rate_unit text not null default 'mm_per_year',
  remaining_life_months numeric not null,
  remaining_life_lower numeric,
  remaining_life_upper numeric,
  confidence numeric not null default 0.7,
  risk_level text not null default 'medium',
  next_inspection_recommended timestamptz,
  retirement_date_estimated timestamptz,
  factors_applied jsonb not null default '{}'::jsonb,
  prediction_json jsonb not null default '{}'::jsonb,
  engine_version text not null default 'v1.0.0',
  computed_at timestamptz not null default now()
);

create index idx_life_predictions_org_id on life_predictions(org_id);
create index idx_life_predictions_asset_id on life_predictions(asset_id);
create index idx_life_predictions_case_id on life_predictions(case_id);
create index idx_life_predictions_model_id on life_predictions(model_id);
create index idx_life_predictions_risk_level on life_predictions(risk_level);
create index idx_life_predictions_remaining_life_months on life_predictions(remaining_life_months);

alter table life_predictions enable row level security;
create policy "life_predictions_org_isolation" on life_predictions
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- 4. inspection_schedule_recommendations
-- Optimized inspection intervals based on degradation
create table inspection_schedule_recommendations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  asset_id text not null,
  prediction_id uuid references life_predictions(id) on delete set null,
  recommended_date timestamptz not null,
  inspection_type text not null default 'general',
  method_recommended text,
  priority text not null default 'routine',
  reason text not null,
  interval_months integer,
  schedule_json jsonb not null default '{}'::jsonb,
  accepted boolean,
  accepted_at timestamptz,
  engine_version text not null default 'v1.0.0',
  created_at timestamptz not null default now()
);

create index idx_inspection_schedule_recommendations_org_id on inspection_schedule_recommendations(org_id);
create index idx_inspection_schedule_recommendations_asset_id on inspection_schedule_recommendations(asset_id);
create index idx_inspection_schedule_recommendations_prediction_id on inspection_schedule_recommendations(prediction_id);
create index idx_inspection_schedule_recommendations_recommended_date on inspection_schedule_recommendations(recommended_date);
create index idx_inspection_schedule_recommendations_priority on inspection_schedule_recommendations(priority);

alter table inspection_schedule_recommendations enable row level security;
create policy "inspection_schedule_recommendations_org_isolation" on inspection_schedule_recommendations
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- 5. risk_projections
-- Forward-looking risk curves over time
create table risk_projections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  asset_id text not null,
  prediction_id uuid references life_predictions(id) on delete cascade,
  projection_date timestamptz not null,
  months_from_now integer not null,
  projected_value numeric not null,
  projected_risk_score numeric not null default 0,
  risk_level text not null default 'low',
  probability_of_failure numeric not null default 0,
  consequence_category text,
  projection_json jsonb not null default '{}'::jsonb,
  engine_version text not null default 'v1.0.0',
  computed_at timestamptz not null default now()
);

create index idx_risk_projections_org_id on risk_projections(org_id);
create index idx_risk_projections_asset_id on risk_projections(asset_id);
create index idx_risk_projections_prediction_id on risk_projections(prediction_id);
create index idx_risk_projections_projection_date on risk_projections(projection_date);
create index idx_risk_projections_risk_level on risk_projections(risk_level);

alter table risk_projections enable row level security;
create policy "risk_projections_org_isolation" on risk_projections
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- 6. prl_audit_events
create table prl_audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  asset_id text,
  case_id uuid,
  action_type text not null,
  event_json jsonb not null,
  created_at timestamptz not null default now()
);

create index idx_prl_audit_events_org_id on prl_audit_events(org_id);
create index idx_prl_audit_events_asset_id on prl_audit_events(asset_id);
create index idx_prl_audit_events_case_id on prl_audit_events(case_id);
create index idx_prl_audit_events_action_type on prl_audit_events(action_type);

alter table prl_audit_events enable row level security;
create policy "prl_audit_events_org_isolation" on prl_audit_events
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- Seed: common degradation models
insert into degradation_models (org_id, model_key, model_name, damage_mechanism, asset_type, material_class, environment, base_rate, base_rate_unit, temperature_factor, pressure_factor, cyclic_factor, environment_factor, confidence, source) values
  ('00000000-0000-0000-0000-000000000000', 'general_corrosion_cs_atmospheric', 'General Corrosion - Carbon Steel - Atmospheric', 'general_corrosion', 'piping', 'carbon_steel', 'atmospheric', 0.1, 'mm_per_year', 1.0, 1.0, 1.0, 1.0, 0.8, 'api_581'),
  ('00000000-0000-0000-0000-000000000000', 'general_corrosion_cs_marine', 'General Corrosion - Carbon Steel - Marine', 'general_corrosion', 'piping', 'carbon_steel', 'marine', 0.3, 'mm_per_year', 1.0, 1.0, 1.0, 1.8, 0.75, 'api_581'),
  ('00000000-0000-0000-0000-000000000000', 'general_corrosion_cs_chemical', 'General Corrosion - Carbon Steel - Chemical Process', 'general_corrosion', 'vessel', 'carbon_steel', 'chemical', 0.25, 'mm_per_year', 1.3, 1.1, 1.0, 1.5, 0.7, 'api_581'),
  ('00000000-0000-0000-0000-000000000000', 'general_corrosion_ss_marine', 'General Corrosion - Stainless Steel - Marine', 'general_corrosion', 'piping', 'stainless_steel', 'marine', 0.05, 'mm_per_year', 1.0, 1.0, 1.0, 1.2, 0.8, 'api_581'),
  ('00000000-0000-0000-0000-000000000000', 'cui_cs_insulated', 'CUI - Carbon Steel - Insulated', 'corrosion_under_insulation', 'piping', 'carbon_steel', 'insulated', 0.4, 'mm_per_year', 1.5, 1.0, 1.0, 1.3, 0.65, 'api_581'),
  ('00000000-0000-0000-0000-000000000000', 'fatigue_cracking_cs_cyclic', 'Fatigue Cracking - Carbon Steel - Cyclic Service', 'fatigue_cracking', 'piping', 'carbon_steel', 'cyclic', 0.05, 'mm_per_year', 1.2, 1.3, 2.0, 1.0, 0.6, 'asme_bpvc'),
  ('00000000-0000-0000-0000-000000000000', 'erosion_cs_high_velocity', 'Erosion - Carbon Steel - High Velocity', 'erosion', 'piping', 'carbon_steel', 'high_velocity', 0.5, 'mm_per_year', 1.1, 1.0, 1.0, 1.0, 0.7, 'api_581'),
  ('00000000-0000-0000-0000-000000000000', 'scc_ss_chloride', 'Stress Corrosion Cracking - SS - Chloride', 'stress_corrosion_cracking', 'vessel', 'stainless_steel', 'chloride', 0.15, 'mm_per_year', 1.8, 1.2, 1.0, 2.0, 0.55, 'api_581'),
  ('00000000-0000-0000-0000-000000000000', 'hydrogen_damage_cs_hic', 'Hydrogen Damage - Carbon Steel - HIC/SOHIC', 'hydrogen_damage', 'vessel', 'carbon_steel', 'hydrogen', 0.2, 'mm_per_year', 1.4, 1.5, 1.0, 1.3, 0.5, 'api_941'),
  ('00000000-0000-0000-0000-000000000000', 'creep_cs_high_temp', 'Creep - Carbon Steel - High Temperature', 'creep', 'piping', 'carbon_steel', 'high_temperature', 0.08, 'mm_per_year', 2.5, 1.3, 1.0, 1.0, 0.6, 'api_579');
