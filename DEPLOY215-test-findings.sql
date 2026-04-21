-- =============================================================
-- Test evidence PART 2: Bridge cases table + insert findings
-- for NDT-1776299065297 (VT - riser)
-- Run in Supabase SQL Editor AFTER Part 1
-- =============================================================

do $$
declare
  v_case_id uuid;
  v_case_number text;
begin
  select id, case_number into v_case_id, v_case_number
  from public.inspection_cases
  where case_number = 'NDT-1776299065297'
  limit 1;

  if v_case_id is null then
    raise exception 'Case NDT-1776299065297 not found in inspection_cases';
  end if;

  -- Bridge: insert into cases table if not already there (FK target for findings)
  insert into public.cases (
    id, case_id, case_name, inspector_name, asset_type, location, applicable_standard,
    asset_description, organization, priority, stage, title, status
  ) values (
    v_case_id,
    v_case_number,
    'VT - riser',
    'System Injected',
    'piping',
    'Offshore platform - splash zone',
    'API 570',
    '22-year offshore platform riser with carbon-fiber composite wrap over external corrosion zone',
    'Test Organization',
    'High',
    'Evaluation',
    'VT - riser',
    'open'
  )
  on conflict (id) do nothing;

  -- Now insert findings (FK to cases satisfied)
  delete from public.findings where case_id = v_case_id;

  insert into public.findings (case_id, finding_id, indication_type, severity, location_zone, component, method_detected_by, notes, recommended_action) values
  (v_case_id, 'F-RISER-001', 'external_corrosion', 'Major', 'splash zone 3-6 o''clock', 'riser', 'VT', 'General external corrosion under composite wrap. Visible rust bleed at wrap termination seams. Estimated 30% surface area affected in splash zone. Marine environment accelerated degradation.', 'UT thickness survey, FFS assessment per API 579'),
  (v_case_id, 'F-RISER-002', 'crack', 'Rejectable', 'girth weld GW-3 at wrap edge', 'riser', 'VT', 'Linear indication at girth weld GW-3, 35mm length, oriented transverse to weld. Located at composite wrap termination band. Suspect stress corrosion cracking from cyclic wave loading over 22 years.', 'MT/PT confirmation, engineering critical assessment per BS 7910'),
  (v_case_id, 'F-RISER-003', 'pitting', 'Recordable', 'external surface 9 o''clock', 'riser', 'VT', 'Scattered pitting on external surface adjacent to wrap system. Max pit depth estimated 1.5mm by visual. Localized galvanic corrosion from marine biofouling.', 'Pit depth gauge measurement, monitor at next inspection'),
  (v_case_id, 'F-RISER-004', 'coating_failure', 'Major', 'wrap termination bands', 'riser', 'VT', 'Complete coating breakdown at both composite wrap termination bands. Blistering and delamination of protective coating system. Differential thermal expansion at wrap edge, moisture ingress, UV degradation.', 'Strip and recoat, assess substrate condition before re-wrap'),
  (v_case_id, 'F-RISER-005', 'wall_loss', 'Rejectable', '6 o''clock splash zone', 'riser', 'UT', 'Minimum wall thickness 0.210 in at 6 o''clock splash zone. Nominal 0.500 in. 42% of nominal remaining — below retirement threshold. Critical wall loss driven by external corrosion under composite wrap.', 'Immediate engineering assessment, consider shutdown or temporary repair'),
  (v_case_id, 'F-RISER-006', 'disbond', 'Major', 'wrap body 4-8 o''clock', 'riser', 'VT', 'Tap test indicates soft/hollow response over 40% of wrap area. Edge lifting at both termination bands. Rust bleed at overlap seam. Composite repair integrity compromised per ASME PCC-2 Art. 4.1.', 'Full composite repair assessment, thermography, shearography');

  raise notice 'Cases bridge + findings injected for case %', v_case_id;
end $$;

-- Verify
select 'findings' as tbl, count(*) as cnt
from public.findings
where case_id = (select id from public.inspection_cases where case_number = 'NDT-1776299065297');
