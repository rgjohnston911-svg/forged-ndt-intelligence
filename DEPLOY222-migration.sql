-- =============================================================
-- DEPLOY222 - Universal Code Authority Engine
-- Run in Supabase SQL Editor
-- =============================================================

-- Code authority resolution results
alter table public.inspection_cases
  add column if not exists code_authority_result jsonb,
  add column if not exists code_authority_generated_at timestamptz,
  add column if not exists governing_codes jsonb,
  add column if not exists precedence_tier text,
  add column if not exists authority_conflicts jsonb;

-- Code sets reference table (expandable per domain)
create table if not exists public.code_sets (
  id text primary key,
  name text not null,
  short_name text,
  region text,
  industry text,
  tier int not null default 3,
  asset_types text[] default '{}',
  material_classes text[] default '{}',
  description text,
  created_at timestamptz default now()
);

-- Seed with core code sets (tier 1 = regulatory, tier 5 = best practice)
insert into public.code_sets (id, name, short_name, region, industry, tier, asset_types, description) values
  ('NRC_10CFR50', '10 CFR 50.55a', 'NRC', 'US', 'nuclear', 1, '{"reactor_vessel","steam_generator","nuclear_piping"}', 'NRC regulatory requirements for nuclear power plant components'),
  ('OSHA_PSM', 'OSHA 29 CFR 1910.119', 'OSHA PSM', 'US', 'process', 1, '{"pressure_vessel","process_piping","storage_tank"}', 'Process Safety Management standard'),
  ('DOT_PHMSA', '49 CFR 192/195', 'PHMSA', 'US', 'pipeline', 1, '{"pipeline"}', 'Pipeline safety regulations'),
  ('FAA_AC43', 'FAA AC 43.13-1B', 'FAA', 'US', 'aerospace', 1, '{"aircraft_structure","engine_component"}', 'FAA acceptable methods for aircraft inspection'),
  ('NBIC', 'National Board Inspection Code', 'NBIC', 'US', 'general', 2, '{"pressure_vessel","boiler"}', 'Jurisdictional inspection requirements'),
  ('API_510', 'API 510 - Pressure Vessel Inspection', 'API 510', 'US', 'oil_gas', 3, '{"pressure_vessel","heat_exchanger"}', 'In-service inspection of pressure vessels'),
  ('API_570', 'API 570 - Piping Inspection', 'API 570', 'US', 'oil_gas', 3, '{"process_piping"}', 'In-service inspection of process piping'),
  ('API_579', 'API 579 - Fitness-For-Service', 'API 579', 'US', 'oil_gas', 3, '{"pressure_vessel","process_piping","storage_tank"}', 'Fitness-for-service assessment procedures'),
  ('API_653', 'API 653 - Tank Inspection', 'API 653', 'US', 'oil_gas', 3, '{"storage_tank"}', 'Aboveground storage tank inspection'),
  ('ASME_PCC2', 'ASME PCC-2 - Repair of Pressure Equipment', 'PCC-2', 'US', 'general', 3, '{"pressure_vessel","process_piping"}', 'Repair methods including composite wraps'),
  ('ASME_B313', 'ASME B31.3 - Process Piping', 'B31.3', 'US', 'process', 3, '{"process_piping"}', 'Design and inspection of process piping'),
  ('ASME_VIII', 'ASME Section VIII - Pressure Vessels', 'ASME VIII', 'US', 'general', 3, '{"pressure_vessel"}', 'Pressure vessel design and fabrication'),
  ('AWS_D11', 'AWS D1.1 - Structural Welding', 'AWS D1.1', 'US', 'structural', 3, '{"structural_steel"}', 'Structural welding code'),
  ('API_1104', 'API 1104 - Pipeline Welding', 'API 1104', 'US', 'pipeline', 3, '{"pipeline"}', 'Welding of pipelines and related facilities'),
  ('DNV_GL', 'DNV GL Rules for Classification', 'DNV', 'intl', 'maritime', 3, '{"marine_vessel","offshore_fixed_platform","offshore_floating_facility"}', 'Classification rules for ships and offshore'),
  ('NACE_MR0175', 'NACE MR0175 - Sulfide Stress Cracking', 'MR0175', 'US', 'oil_gas', 3, '{"pressure_vessel","process_piping","pipeline"}', 'Material requirements for sour service'),
  ('AASHTO_MBE', 'AASHTO Manual for Bridge Evaluation', 'AASHTO', 'US', 'civil', 3, '{"bridge_civil_structure"}', 'Bridge inspection and evaluation'),
  ('ISO_24817', 'ISO 24817 - Composite Repairs', 'ISO 24817', 'intl', 'general', 5, '{"pressure_vessel","process_piping"}', 'Composite repair qualification'),
  ('ASTM_E3166', 'ASTM E3166 - AM Parts', 'E3166', 'US', 'advanced', 5, '{"additive_manufactured"}', 'NDE of additively manufactured parts')
on conflict (id) do nothing;

-- Index for fast code lookups
create index if not exists idx_code_sets_tier on public.code_sets(tier);
create index if not exists idx_code_sets_industry on public.code_sets(industry);

comment on column public.inspection_cases.code_authority_result is
  'DEPLOY222 Universal Code Authority: full resolution with precedence, conflicts, governing set';
comment on column public.inspection_cases.precedence_tier is
  'DEPLOY222 highest tier that resolved: regulatory, jurisdictional, industry, owner, best_practice';
