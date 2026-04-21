-- DEPLOY218 — Composite Repair Authority Pack
-- Adds bonded-composite-repair integrity assessment as a first-class mechanism
-- domain so the engine can rule on ASME PCC-2 Art. 4.1 / ISO 24817 systems
-- (carbon-fiber wraps, FRP wraps, bonded repairs) alongside the steel substrate.
--
-- Run in Supabase SQL Editor.

alter table public.inspection_cases
  add column if not exists composite_repair_assessment jsonb,
  add column if not exists composite_repair_generated_at timestamptz,
  add column if not exists composite_repair_status text
    check (composite_repair_status in
      ('no_composite_repair_detected','repair_intact','repair_suspect','repair_failed','insufficient_evidence'));

-- Review-queue index for any suspect/failed repairs on HIGH/CRITICAL assets.
create index if not exists idx_cases_composite_repair_flagged
  on public.inspection_cases(composite_repair_status)
  where composite_repair_status in ('repair_suspect','repair_failed');

comment on column public.inspection_cases.composite_repair_assessment is
  'DEPLOY218: bonded composite repair integrity assessment payload (ASME PCC-2 Art.4.1 / ISO 24817)';
