-- =============================================================
-- DEPLOY223 - Enterprise Audit System
-- Run in Supabase SQL Editor
-- =============================================================

-- ---------------------------------------------------------------
-- 1. Audit event log — every user + system action, append-only
-- ---------------------------------------------------------------
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.inspection_cases(id),
  event_type text not null,
  event_category text not null default 'system',
  actor_type text not null default 'system',
  actor_id uuid,
  actor_email text,
  actor_name text,
  detail jsonb default '{}',
  input_snapshot jsonb,
  output_snapshot jsonb,
  execution_mode text default 'deterministic',
  function_name text,
  ip_address text,
  session_id text,
  created_at timestamptz not null default now()
);

-- Indexes for fast queries
create index if not exists idx_audit_events_case_id on public.audit_events(case_id);
create index if not exists idx_audit_events_actor_id on public.audit_events(actor_id);
create index if not exists idx_audit_events_event_type on public.audit_events(event_type);
create index if not exists idx_audit_events_created_at on public.audit_events(created_at desc);

-- INSERT-only RLS: authenticated users can insert and read, never update or delete
alter table public.audit_events enable row level security;

drop policy if exists "audit_events_insert" on public.audit_events;
create policy "audit_events_insert" on public.audit_events
  for insert to authenticated
  with check (true);

drop policy if exists "audit_events_select" on public.audit_events;
create policy "audit_events_select" on public.audit_events
  for select to authenticated
  using (true);

-- No UPDATE or DELETE policies = immutable log

-- Service role bypass for Netlify functions
drop policy if exists "audit_events_service_insert" on public.audit_events;
create policy "audit_events_service_insert" on public.audit_events
  for insert to service_role
  with check (true);

drop policy if exists "audit_events_service_select" on public.audit_events;
create policy "audit_events_service_select" on public.audit_events
  for select to service_role
  using (true);

-- ---------------------------------------------------------------
-- 2. Signed audit bundles — tamper-proof decision snapshots
-- ---------------------------------------------------------------
create table if not exists public.audit_bundles (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.inspection_cases(id),
  bundle_version int not null default 1,
  bundle_data jsonb not null,
  bundle_hash text not null,
  previous_hash text,
  signature text not null,
  signing_key_id text not null,
  signed_by_user_id uuid,
  signed_by_email text,
  signed_at timestamptz not null default now(),
  chain_valid boolean default true,
  replay_snapshot jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_bundles_case_id on public.audit_bundles(case_id);
create index if not exists idx_audit_bundles_signed_at on public.audit_bundles(signed_at desc);
create unique index if not exists idx_audit_bundles_case_version on public.audit_bundles(case_id, bundle_version);

-- INSERT-only RLS for bundles too
alter table public.audit_bundles enable row level security;

drop policy if exists "audit_bundles_insert" on public.audit_bundles;
create policy "audit_bundles_insert" on public.audit_bundles
  for insert to authenticated
  with check (true);

drop policy if exists "audit_bundles_select" on public.audit_bundles;
create policy "audit_bundles_select" on public.audit_bundles
  for select to authenticated
  using (true);

drop policy if exists "audit_bundles_service_insert" on public.audit_bundles;
create policy "audit_bundles_service_insert" on public.audit_bundles
  for insert to service_role
  with check (true);

drop policy if exists "audit_bundles_service_select" on public.audit_bundles;
create policy "audit_bundles_service_select" on public.audit_bundles
  for select to service_role
  using (true);

-- ---------------------------------------------------------------
-- 3. Signing keys per organization
-- ---------------------------------------------------------------
create table if not exists public.org_signing_keys (
  id text primary key,
  org_id uuid,
  public_key text not null,
  private_key_encrypted text not null,
  algorithm text not null default 'HMAC-SHA256',
  created_by uuid,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  is_active boolean default true
);

create index if not exists idx_org_signing_keys_active on public.org_signing_keys(is_active) where is_active = true;

alter table public.org_signing_keys enable row level security;

drop policy if exists "org_signing_keys_service" on public.org_signing_keys;
create policy "org_signing_keys_service" on public.org_signing_keys
  for all to service_role
  using (true)
  with check (true);

-- ---------------------------------------------------------------
-- 4. Add chain tracking columns to inspection_cases
-- ---------------------------------------------------------------
alter table public.inspection_cases
  add column if not exists audit_bundle_count int default 0,
  add column if not exists last_audit_hash text,
  add column if not exists last_audit_signed_at timestamptz,
  add column if not exists audit_chain_valid boolean default true;

-- ---------------------------------------------------------------
-- 5. Seed default signing key (HMAC-SHA256)
-- ---------------------------------------------------------------
insert into public.org_signing_keys (id, public_key, private_key_encrypted, algorithm)
values (
  'default_hmac_v1',
  'FORGED-NDT-AUDIT-PUBLIC-v1',
  'FORGED-NDT-AUDIT-SECRET-v1',
  'HMAC-SHA256'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------
comment on table public.audit_events is
  'DEPLOY223 Enterprise Audit: append-only event log tracking every user and system action';
comment on table public.audit_bundles is
  'DEPLOY223 Enterprise Audit: tamper-proof signed decision bundles with hash chain';
comment on table public.org_signing_keys is
  'DEPLOY223 Enterprise Audit: per-org signing keys for bundle cryptographic signatures';
comment on column public.inspection_cases.audit_bundle_count is
  'DEPLOY223 total signed audit bundles for this case';
comment on column public.inspection_cases.last_audit_hash is
  'DEPLOY223 hash of most recent audit bundle (chain head)';
