-- =============================================================
-- DEPLOY219 - Unified Material Authority Engine migration
-- Run in Supabase SQL Editor
-- =============================================================

alter table public.inspection_cases
  add column if not exists material_authority_assessment jsonb,
  add column if not exists material_authority_generated_at timestamptz,
  add column if not exists material_authority_status text;

-- Index for quick filtering of cases with material issues
create index if not exists idx_cases_material_authority_status
  on public.inspection_cases(material_authority_status)
  where material_authority_status in ('suspect', 'failed');
