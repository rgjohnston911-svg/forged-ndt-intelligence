-- DEPLOY256: Cross-Case Pattern Recognition Engine v1.0.0
-- Finds patterns across thousands of cases that no single inspector would see
-- 6 tables + indexes + RLS + seeds
-- Run in Supabase SQL Editor

-- ============================================================
-- 1. pattern_clusters — discovered groupings of similar cases
-- "Every time we see X on this asset class in this environment, Y follows"
-- ============================================================
create table if not exists pattern_clusters (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  cluster_key text not null,
  cluster_name text not null,
  cluster_type text not null,
  asset_type text,
  failure_mode text,
  environment text,
  material_class text,
  method text,
  vertical text,
  case_count integer not null default 0,
  confidence numeric not null default 0,
  severity text not null default 'low',
  cluster_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  engine_version text not null default 'v1.0.0',
  discovered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pattern_clusters_org_id on pattern_clusters(org_id);
create index if not exists idx_pattern_clusters_cluster_key on pattern_clusters(cluster_key);
create index if not exists idx_pattern_clusters_cluster_type on pattern_clusters(cluster_type);
create index if not exists idx_pattern_clusters_asset_type on pattern_clusters(asset_type);
create index if not exists idx_pattern_clusters_failure_mode on pattern_clusters(failure_mode);
create index if not exists idx_pattern_clusters_severity on pattern_clusters(severity);
create index if not exists idx_pattern_clusters_active on pattern_clusters(active);

alter table pattern_clusters enable row level security;
drop policy if exists "pattern_clusters_org_isolation" on pattern_clusters;
create policy "pattern_clusters_org_isolation" on pattern_clusters
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 2. pattern_case_members — which cases belong to which clusters
-- ============================================================
create table if not exists pattern_case_members (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references pattern_clusters(id) on delete cascade,
  case_id uuid not null,
  org_id uuid not null,
  similarity_score numeric not null default 0,
  contribution_json jsonb not null default '{}'::jsonb,
  added_at timestamptz not null default now()
);

create index if not exists idx_pattern_case_members_cluster_id on pattern_case_members(cluster_id);
create index if not exists idx_pattern_case_members_case_id on pattern_case_members(case_id);
create index if not exists idx_pattern_case_members_org_id on pattern_case_members(org_id);

alter table pattern_case_members enable row level security;
drop policy if exists "pattern_case_members_org_isolation" on pattern_case_members;
create policy "pattern_case_members_org_isolation" on pattern_case_members
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 3. pattern_rules — deterministic rules extracted from patterns
-- "If asset_type=pipeline AND environment=marine AND age>15yr THEN check scour+CUI"
-- ============================================================
create table if not exists pattern_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  cluster_id uuid references pattern_clusters(id) on delete set null,
  rule_key text not null,
  rule_name text not null,
  condition_json jsonb not null,
  recommendation text not null,
  supporting_case_count integer not null default 0,
  confidence numeric not null default 0,
  severity text not null default 'medium',
  auto_apply boolean not null default false,
  active boolean not null default true,
  rule_json jsonb not null default '{}'::jsonb,
  engine_version text not null default 'v1.0.0',
  created_at timestamptz not null default now()
);

create index if not exists idx_pattern_rules_org_id on pattern_rules(org_id);
create index if not exists idx_pattern_rules_cluster_id on pattern_rules(cluster_id);
create index if not exists idx_pattern_rules_rule_key on pattern_rules(rule_key);
create index if not exists idx_pattern_rules_active on pattern_rules(active);
create index if not exists idx_pattern_rules_severity on pattern_rules(severity);

alter table pattern_rules enable row level security;
drop policy if exists "pattern_rules_org_isolation" on pattern_rules;
create policy "pattern_rules_org_isolation" on pattern_rules
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 4. pattern_alerts — notifications when a new case matches a known pattern
-- ============================================================
create table if not exists pattern_alerts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  cluster_id uuid not null references pattern_clusters(id) on delete cascade,
  rule_id uuid references pattern_rules(id) on delete set null,
  alert_type text not null,
  alert_severity text not null default 'medium',
  message text not null,
  acknowledged boolean not null default false,
  alert_json jsonb not null default '{}'::jsonb,
  engine_version text not null default 'v1.0.0',
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz
);

create index if not exists idx_pattern_alerts_case_id on pattern_alerts(case_id);
create index if not exists idx_pattern_alerts_org_id on pattern_alerts(org_id);
create index if not exists idx_pattern_alerts_cluster_id on pattern_alerts(cluster_id);
create index if not exists idx_pattern_alerts_acknowledged on pattern_alerts(acknowledged);
create index if not exists idx_pattern_alerts_alert_severity on pattern_alerts(alert_severity);

alter table pattern_alerts enable row level security;
drop policy if exists "pattern_alerts_org_isolation" on pattern_alerts;
create policy "pattern_alerts_org_isolation" on pattern_alerts
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 5. pattern_statistics — aggregate stats per pattern dimension
-- ============================================================
create table if not exists pattern_statistics (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  dimension_type text not null,
  dimension_value text not null,
  case_count integer not null default 0,
  rejection_rate numeric,
  avg_confidence numeric,
  top_failure_mode text,
  top_finding_type text,
  stats_json jsonb not null default '{}'::jsonb,
  period_key text not null default 'all_time',
  engine_version text not null default 'v1.0.0',
  computed_at timestamptz not null default now()
);

create index if not exists idx_pattern_statistics_org_id on pattern_statistics(org_id);
create index if not exists idx_pattern_statistics_dimension_type on pattern_statistics(dimension_type);
create index if not exists idx_pattern_statistics_dimension_value on pattern_statistics(dimension_value);
create index if not exists idx_pattern_statistics_period_key on pattern_statistics(period_key);

alter table pattern_statistics enable row level security;
drop policy if exists "pattern_statistics_org_isolation" on pattern_statistics;
create policy "pattern_statistics_org_isolation" on pattern_statistics
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 6. pattern_audit_events — audit trail
-- ============================================================
create table if not exists pattern_audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  case_id uuid,
  action_type text not null,
  event_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_pattern_audit_events_org_id on pattern_audit_events(org_id);
create index if not exists idx_pattern_audit_events_case_id on pattern_audit_events(case_id);
create index if not exists idx_pattern_audit_events_action_type on pattern_audit_events(action_type);

alter table pattern_audit_events enable row level security;
drop policy if exists "pattern_audit_events_org_isolation" on pattern_audit_events;
create policy "pattern_audit_events_org_isolation" on pattern_audit_events
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);
