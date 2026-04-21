-- =============================================================
-- Test evidence injection for NDT-1776299065297 (VT - riser)
-- PART 1: Case metadata + thickness + measurements (no FK issue)
-- Run in Supabase SQL Editor
-- =============================================================

do $$
declare
  v_case_id uuid;
begin
  select id into v_case_id
  from public.inspection_cases
  where case_number = 'NDT-1776299065297'
  limit 1;

  if v_case_id is null then
    raise exception 'Case NDT-1776299065297 not found';
  end if;

  -- Update case metadata for a realistic riser scenario
  update public.inspection_cases set
    component_name = 'riser',
    material_class = 'carbon_steel',
    load_condition = 'cyclic',
    code_family = 'API 570',
    code_edition = '2020',
    thickness_mm = 12.7,
    joint_type = 'girth_weld',
    geometry_type = 'pipe',
    industry_sector = 'offshore',
    asset_type = 'piping',
    lifecycle_stage = 'in_service',
    service_environment = 'marine_splash_zone'
  where id = v_case_id;

  -- ---------------------------------------------------------------
  -- THICKNESS READINGS - UT grid survey
  -- Nominal wall = 0.500 in (12.7mm)
  -- ---------------------------------------------------------------
  delete from public.thickness_readings where case_id = v_case_id;

  insert into public.thickness_readings (id, case_id, grid_row, grid_col, location_ref, thickness_in, thickness_mm, nominal_in, is_min_of_grid, source_format) values
  (gen_random_uuid(), v_case_id, 'A', '1', '12 o''clock - above wrap', 0.4750, 12.065, 0.500, false, 'manual'),
  (gen_random_uuid(), v_case_id, 'A', '2', '12 o''clock - wrap edge', 0.4200, 10.668, 0.500, false, 'manual'),
  (gen_random_uuid(), v_case_id, 'A', '3', '12 o''clock - below wrap', 0.4620, 11.735, 0.500, false, 'manual'),
  (gen_random_uuid(), v_case_id, 'B', '1', '3 o''clock - above wrap', 0.3850, 9.779, 0.500, false, 'manual'),
  (gen_random_uuid(), v_case_id, 'B', '2', '3 o''clock - splash zone', 0.2950, 7.493, 0.500, false, 'manual'),
  (gen_random_uuid(), v_case_id, 'B', '3', '3 o''clock - below wrap', 0.3600, 9.144, 0.500, false, 'manual'),
  (gen_random_uuid(), v_case_id, 'C', '1', '6 o''clock - above wrap', 0.3700, 9.398, 0.500, false, 'manual'),
  (gen_random_uuid(), v_case_id, 'C', '2', '6 o''clock - splash zone', 0.2100, 5.334, 0.500, true, 'manual'),
  (gen_random_uuid(), v_case_id, 'C', '3', '6 o''clock - below wrap', 0.3400, 8.636, 0.500, false, 'manual'),
  (gen_random_uuid(), v_case_id, 'D', '1', '9 o''clock - above wrap', 0.4100, 10.414, 0.500, false, 'manual'),
  (gen_random_uuid(), v_case_id, 'D', '2', '9 o''clock - splash zone', 0.3150, 8.001, 0.500, false, 'manual'),
  (gen_random_uuid(), v_case_id, 'D', '3', '9 o''clock - below wrap', 0.4000, 10.160, 0.500, false, 'manual');

  -- ---------------------------------------------------------------
  -- CASE MEASUREMENTS (crack dimensions for authority rules)
  -- ---------------------------------------------------------------
  delete from public.case_measurements where case_id = v_case_id;

  insert into public.case_measurements (case_id, finding_type, measurement_key, value_imperial, value_metric) values
  (v_case_id, 'crack', 'length', 1.378, 35.0),
  (v_case_id, 'crack', 'depth', 0.060, 1.524),
  (v_case_id, 'pitting', 'depth', 0.059, 1.5),
  (v_case_id, 'pitting', 'diameter', 0.197, 5.0);

  raise notice 'Metadata + thickness + measurements injected for case %', v_case_id;
end $$;

-- Verify
select 'thickness_readings' as tbl, count(*) as cnt from public.thickness_readings where case_id = (select id from public.inspection_cases where case_number = 'NDT-1776299065297')
union all
select 'case_measurements', count(*) from public.case_measurements where case_id = (select id from public.inspection_cases where case_number = 'NDT-1776299065297');
