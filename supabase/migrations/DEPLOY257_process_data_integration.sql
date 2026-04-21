-- DEPLOY257: Process Data Integration v1.0.0
-- Connects live sensor/process data to inspection cases
-- Correlates operating conditions with failure modes
-- Run in Supabase SQL Editor

-- 1. process_data_sources
-- Registered sensors, historians, and data feeds
create table process_data_sources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  source_key text not null,
  source_name text not null,
  source_type text not null default 'sensor',
  asset_id text,
  asset_name text,
  location text,
  unit_of_measure text not null default 'unknown',
  data_type text not null default 'numeric',
  normal_min numeric,
  normal_max numeric,
  alarm_low numeric,
  alarm_high numeric,
  critical_low numeric,
  critical_high numeric,
  sampling_interval_seconds integer,
  tags jsonb not null default '[]'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_process_data_sources_org_id on process_data_sources(org_id);
create index idx_process_data_sources_source_key on process_data_sources(source_key);
create index idx_process_data_sources_source_type on process_data_sources(source_type);
create index idx_process_data_sources_asset_id on process_data_sources(asset_id);
create index idx_process_data_sources_active on process_data_sources(active);

alter table process_data_sources enable row level security;
create policy "process_data_sources_org_isolation" on process_data_sources
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- 2. process_data_readings
-- Time-series sensor readings
create table process_data_readings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  source_id uuid not null references process_data_sources(id) on delete cascade,
  reading_value numeric not null,
  reading_quality text not null default 'good',
  reading_timestamp timestamptz not null,
  raw_json jsonb not null default '{}'::jsonb,
  ingested_at timestamptz not null default now()
);

create index idx_process_data_readings_org_id on process_data_readings(org_id);
create index idx_process_data_readings_source_id on process_data_readings(source_id);
create index idx_process_data_readings_reading_timestamp on process_data_readings(reading_timestamp);
create index idx_process_data_readings_source_timestamp on process_data_readings(source_id, reading_timestamp);

alter table process_data_readings enable row level security;
create policy "process_data_readings_org_isolation" on process_data_readings
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- 3. process_exceedance_events
-- When readings exceeded thresholds
create table process_exceedance_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  source_id uuid not null references process_data_sources(id) on delete cascade,
  exceedance_type text not null,
  threshold_value numeric not null,
  peak_value numeric not null,
  duration_seconds integer,
  severity text not null default 'medium',
  start_at timestamptz not null,
  end_at timestamptz,
  reading_count integer not null default 1,
  event_json jsonb not null default '{}'::jsonb,
  acknowledged boolean not null default false,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_process_exceedance_events_org_id on process_exceedance_events(org_id);
create index idx_process_exceedance_events_source_id on process_exceedance_events(source_id);
create index idx_process_exceedance_events_exceedance_type on process_exceedance_events(exceedance_type);
create index idx_process_exceedance_events_severity on process_exceedance_events(severity);
create index idx_process_exceedance_events_start_at on process_exceedance_events(start_at);

alter table process_exceedance_events enable row level security;
create policy "process_exceedance_events_org_isolation" on process_exceedance_events
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- 4. process_case_correlations
-- Links between process data and inspection cases
create table process_case_correlations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  case_id uuid not null,
  source_id uuid not null references process_data_sources(id) on delete cascade,
  correlation_type text not null default 'temporal',
  correlation_score numeric not null default 0,
  window_start timestamptz not null,
  window_end timestamptz not null,
  avg_value numeric,
  min_value numeric,
  max_value numeric,
  std_deviation numeric,
  exceedance_count integer not null default 0,
  operating_regime text,
  correlation_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_process_case_correlations_org_id on process_case_correlations(org_id);
create index idx_process_case_correlations_case_id on process_case_correlations(case_id);
create index idx_process_case_correlations_source_id on process_case_correlations(source_id);
create index idx_process_case_correlations_correlation_type on process_case_correlations(correlation_type);

alter table process_case_correlations enable row level security;
create policy "process_case_correlations_org_isolation" on process_case_correlations
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- 5. process_exposure_summaries
-- Computed exposure profiles for assets/cases
create table process_exposure_summaries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  asset_id text,
  case_id uuid,
  summary_type text not null default 'asset',
  period_start timestamptz not null,
  period_end timestamptz not null,
  total_operating_hours numeric,
  avg_temperature numeric,
  max_temperature numeric,
  avg_pressure numeric,
  max_pressure numeric,
  avg_vibration numeric,
  max_vibration numeric,
  avg_flow_rate numeric,
  corrosion_rate numeric,
  cumulative_cycles integer,
  thermal_cycles integer,
  pressure_cycles integer,
  exceedance_count integer not null default 0,
  operating_regime_breakdown jsonb not null default '{}'::jsonb,
  exposure_json jsonb not null default '{}'::jsonb,
  severity_score numeric not null default 0,
  engine_version text not null default 'v1.0.0',
  computed_at timestamptz not null default now()
);

create index idx_process_exposure_summaries_org_id on process_exposure_summaries(org_id);
create index idx_process_exposure_summaries_asset_id on process_exposure_summaries(asset_id);
create index idx_process_exposure_summaries_case_id on process_exposure_summaries(case_id);
create index idx_process_exposure_summaries_summary_type on process_exposure_summaries(summary_type);

alter table process_exposure_summaries enable row level security;
create policy "process_exposure_summaries_org_isolation" on process_exposure_summaries
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- 6. process_audit_events
create table process_audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  source_id uuid,
  case_id uuid,
  action_type text not null,
  event_json jsonb not null,
  created_at timestamptz not null default now()
);

create index idx_process_audit_events_org_id on process_audit_events(org_id);
create index idx_process_audit_events_source_id on process_audit_events(source_id);
create index idx_process_audit_events_case_id on process_audit_events(case_id);
create index idx_process_audit_events_action_type on process_audit_events(action_type);

alter table process_audit_events enable row level security;
create policy "process_audit_events_org_isolation" on process_audit_events
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);
