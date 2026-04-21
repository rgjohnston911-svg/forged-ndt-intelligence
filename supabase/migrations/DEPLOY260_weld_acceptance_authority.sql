-- DEPLOY260: Weld Acceptance Authority v1.0.0
-- CWI-level deterministic weld evaluation engine
-- All processes, positions, materials, joints, codes, acceptance criteria
-- Backed by 4D physics: process x position x material x environment
-- Run in Supabase SQL Editor

-- 1. weld_process_registry
-- Every welding process with physics characteristics
create table weld_process_registry (
  id uuid primary key default gen_random_uuid(),
  process_key text not null unique,
  process_name text not null,
  aws_designation text,
  process_category text not null,
  heat_source text not null,
  shielding_type text not null,
  transfer_modes jsonb not null default '[]'::jsonb,
  filler_type text,
  flux_type text,
  typical_thickness_min_mm numeric,
  typical_thickness_max_mm numeric,
  typical_deposition_rate text,
  common_defects jsonb not null default '[]'::jsonb,
  physics_json jsonb not null default '{}'::jsonb,
  sheet_metal_capable boolean not null default false,
  pipe_capable boolean not null default true,
  structural_capable boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_weld_process_registry_key on weld_process_registry(process_key);
create index idx_weld_process_registry_category on weld_process_registry(process_category);

alter table weld_process_registry enable row level security;
create policy "weld_process_registry_read_all" on weld_process_registry for select using (true);

-- 2. weld_position_registry
create table weld_position_registry (
  id uuid primary key default gen_random_uuid(),
  position_key text not null unique,
  position_name text not null,
  aws_designation text,
  asme_designation text,
  orientation text not null,
  gravity_effect text not null,
  difficulty_tier integer not null default 2,
  physics_challenges jsonb not null default '[]'::jsonb,
  common_defects jsonb not null default '[]'::jsonb,
  applicable_joint_types jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_weld_position_registry_key on weld_position_registry(position_key);

alter table weld_position_registry enable row level security;
create policy "weld_position_registry_read_all" on weld_position_registry for select using (true);

-- 3. weld_material_registry
create table weld_material_registry (
  id uuid primary key default gen_random_uuid(),
  material_key text not null unique,
  material_name text not null,
  material_group text not null,
  aws_group text,
  asme_p_number text,
  base_material_specs jsonb not null default '[]'::jsonb,
  typical_thickness_range text,
  preheat_required boolean not null default false,
  preheat_temp_min_c numeric,
  pwht_required boolean not null default false,
  max_interpass_temp_c numeric,
  carbon_equivalent_max numeric,
  weldability text not null default 'good',
  common_defects jsonb not null default '[]'::jsonb,
  filler_compatibility jsonb not null default '[]'::jsonb,
  physics_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_weld_material_registry_key on weld_material_registry(material_key);
create index idx_weld_material_registry_group on weld_material_registry(material_group);
create index idx_weld_material_registry_p_number on weld_material_registry(asme_p_number);

alter table weld_material_registry enable row level security;
create policy "weld_material_registry_read_all" on weld_material_registry for select using (true);

-- 4. weld_joint_registry
create table weld_joint_registry (
  id uuid primary key default gen_random_uuid(),
  joint_key text not null unique,
  joint_name text not null,
  joint_category text not null,
  weld_type text not null,
  groove_type text,
  access_requirement text not null default 'single_side',
  critical_dimensions jsonb not null default '[]'::jsonb,
  applicable_processes jsonb not null default '[]'::jsonb,
  physics_stress_pattern text,
  fatigue_category text,
  common_defects jsonb not null default '[]'::jsonb,
  sheet_metal_applicable boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_weld_joint_registry_key on weld_joint_registry(joint_key);
create index idx_weld_joint_registry_category on weld_joint_registry(joint_category);
create index idx_weld_joint_registry_weld_type on weld_joint_registry(weld_type);

alter table weld_joint_registry enable row level security;
create policy "weld_joint_registry_read_all" on weld_joint_registry for select using (true);

-- 5. weld_discontinuity_registry
-- All weld discontinuity types with physics causes
create table weld_discontinuity_registry (
  id uuid primary key default gen_random_uuid(),
  discontinuity_key text not null unique,
  discontinuity_name text not null,
  discontinuity_category text not null,
  iw_designation text,
  is_planar boolean not null default false,
  is_linear boolean not null default false,
  is_surface_breaking boolean not null default false,
  typical_location text not null,
  physics_cause jsonb not null default '[]'::jsonb,
  process_association jsonb not null default '[]'::jsonb,
  severity_ranking integer not null default 5,
  dominance_tier integer not null default 3,
  detection_methods jsonb not null default '[]'::jsonb,
  measurement_type text not null default 'length',
  measurement_unit text not null default 'mm',
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_weld_disc_key on weld_discontinuity_registry(discontinuity_key);
create index idx_weld_disc_category on weld_discontinuity_registry(discontinuity_category);
create index idx_weld_disc_dominance on weld_discontinuity_registry(dominance_tier);

alter table weld_discontinuity_registry enable row level security;
create policy "weld_disc_read_all" on weld_discontinuity_registry for select using (true);

-- 6. weld_code_acceptance_criteria
-- THE CORE TABLE: deterministic acceptance thresholds per code per discontinuity
create table weld_code_acceptance_criteria (
  id uuid primary key default gen_random_uuid(),
  code_key text not null,
  code_name text not null,
  code_edition text,
  table_reference text not null,
  clause_reference text not null,
  loading_condition text not null default 'static',
  connection_type text not null default 'all',
  discontinuity_key text not null,
  criteria_type text not null,
  max_individual numeric,
  max_aggregate numeric,
  max_length_mm numeric,
  max_depth_mm numeric,
  max_depth_percent numeric,
  max_width_mm numeric,
  max_size_mm numeric,
  max_count_per_length integer,
  reference_length_mm numeric,
  min_spacing_mm numeric,
  absolute_reject boolean not null default false,
  conditional_note text,
  thickness_dependent boolean not null default false,
  thickness_ranges jsonb not null default '[]'::jsonb,
  criteria_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_weld_criteria_code on weld_code_acceptance_criteria(code_key);
create index idx_weld_criteria_disc on weld_code_acceptance_criteria(discontinuity_key);
create index idx_weld_criteria_loading on weld_code_acceptance_criteria(loading_condition);
create index idx_weld_criteria_table on weld_code_acceptance_criteria(table_reference);
create index idx_weld_criteria_clause on weld_code_acceptance_criteria(clause_reference);

alter table weld_code_acceptance_criteria enable row level security;
create policy "weld_criteria_read_all" on weld_code_acceptance_criteria for select using (true);

-- 7. weld_4d_physics_rules
-- 4D physics validation: process x position x material x environment
create table weld_4d_physics_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null,
  rule_name text not null,
  process_key text,
  position_key text,
  material_key text,
  environment text,
  joint_key text,
  discontinuity_key text,
  probability text not null default 'possible',
  physics_explanation text not null,
  root_cause text not null,
  contributing_factors jsonb not null default '[]'::jsonb,
  prevention_actions jsonb not null default '[]'::jsonb,
  correction_actions jsonb not null default '[]'::jsonb,
  teaching_point text,
  code_references jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_weld_4d_rule_key on weld_4d_physics_rules(rule_key);
create index idx_weld_4d_process on weld_4d_physics_rules(process_key);
create index idx_weld_4d_position on weld_4d_physics_rules(position_key);
create index idx_weld_4d_material on weld_4d_physics_rules(material_key);
create index idx_weld_4d_disc on weld_4d_physics_rules(discontinuity_key);
create index idx_weld_4d_probability on weld_4d_physics_rules(probability);

alter table weld_4d_physics_rules enable row level security;
create policy "weld_4d_physics_read_all" on weld_4d_physics_rules for select using (true);

-- 8. weld_assessments
-- Per-case weld evaluation results
create table weld_assessments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  case_id uuid,
  scan_id uuid,
  process_key text,
  position_key text,
  material_key text,
  joint_key text,
  code_key text not null,
  loading_condition text not null default 'static',
  thickness_mm numeric,
  discontinuities_found jsonb not null default '[]'::jsonb,
  criteria_applied jsonb not null default '[]'::jsonb,
  physics_validations jsonb not null default '[]'::jsonb,
  disposition text not null,
  disposition_detail text,
  governing_clause text,
  reject_reasons jsonb not null default '[]'::jsonb,
  accept_conditions jsonb not null default '[]'::jsonb,
  repair_required boolean not null default false,
  repair_recommendations jsonb not null default '[]'::jsonb,
  confidence_score numeric not null default 0,
  assessment_json jsonb not null default '{}'::jsonb,
  engine_version text not null default 'v1.0.0',
  computed_at timestamptz not null default now()
);

create index idx_weld_assessments_org on weld_assessments(org_id);
create index idx_weld_assessments_case on weld_assessments(case_id);
create index idx_weld_assessments_scan on weld_assessments(scan_id);
create index idx_weld_assessments_code on weld_assessments(code_key);
create index idx_weld_assessments_disposition on weld_assessments(disposition);

alter table weld_assessments enable row level security;
create policy "weld_assessments_org_isolation" on weld_assessments
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- 9. weld_audit_events
create table weld_audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  case_id uuid,
  scan_id uuid,
  action_type text not null,
  event_json jsonb not null,
  created_at timestamptz not null default now()
);

create index idx_weld_audit_org on weld_audit_events(org_id);
create index idx_weld_audit_case on weld_audit_events(case_id);
create index idx_weld_audit_action on weld_audit_events(action_type);

alter table weld_audit_events enable row level security;
create policy "weld_audit_org_isolation" on weld_audit_events
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ══════════════════════════════════════════════
-- SEED DATA: Welding Processes
-- ══════════════════════════════════════════════

insert into weld_process_registry (process_key, process_name, aws_designation, process_category, heat_source, shielding_type, transfer_modes, filler_type, flux_type, typical_thickness_min_mm, typical_thickness_max_mm, common_defects, sheet_metal_capable, pipe_capable, structural_capable) values
  ('smaw', 'Shielded Metal Arc Welding (Stick)', 'SMAW', 'arc', 'electric_arc', 'flux_coating', '[]', 'consumable_electrode', 'coating', 3, 200, '["slag_inclusion","porosity","incomplete_fusion","undercut","arc_strike"]', false, true, true),
  ('gmaw_solid', 'Gas Metal Arc Welding — Solid Wire (MIG)', 'GMAW', 'arc', 'electric_arc', 'gas', '["short_circuit","globular","spray","pulsed_spray"]', 'solid_wire', null, 0.5, 50, '["porosity","incomplete_fusion","burnthrough","lack_of_penetration","spatter"]', true, true, true),
  ('gmaw_pulse', 'Gas Metal Arc Welding — Pulsed', 'GMAW-P', 'arc', 'electric_arc', 'gas', '["pulsed_spray"]', 'solid_wire', null, 0.8, 50, '["porosity","incomplete_fusion","lack_of_penetration"]', true, true, true),
  ('fcaw_gas', 'Flux-Cored Arc Welding — Gas Shielded', 'FCAW-G', 'arc', 'electric_arc', 'dual_gas_flux', '["globular","spray"]', 'flux_cored_wire', 'internal_flux', 2, 100, '["slag_inclusion","wormhole_porosity","incomplete_fusion","undercut"]', false, true, true),
  ('fcaw_self', 'Flux-Cored Arc Welding — Self Shielded', 'FCAW-S', 'arc', 'electric_arc', 'flux_only', '["globular"]', 'flux_cored_wire', 'internal_flux', 3, 100, '["slag_inclusion","porosity","incomplete_fusion","undercut","nitrogen_porosity"]', false, true, true),
  ('gtaw', 'Gas Tungsten Arc Welding (TIG)', 'GTAW', 'arc', 'electric_arc', 'gas', '[]', 'separate_filler_or_autogenous', null, 0.3, 25, '["tungsten_inclusion","porosity","incomplete_fusion","lack_of_penetration","oxidation"]', true, true, true),
  ('saw', 'Submerged Arc Welding', 'SAW', 'arc', 'electric_arc', 'granular_flux', '[]', 'solid_wire_or_strip', 'granular', 6, 300, '["slag_inclusion","porosity","centerline_cracking","incomplete_fusion"]', false, false, true),
  ('rsw', 'Resistance Spot Welding', 'RSW', 'resistance', 'resistance_heat', 'none', '[]', 'none', null, 0.3, 4, '["expulsion","undersized_nugget","sheet_separation","electrode_indentation"]', true, false, false),
  ('rsew', 'Resistance Seam Welding', 'RSEW', 'resistance', 'resistance_heat', 'none', '[]', 'none', null, 0.3, 3, '["skip_weld","leak_path","overheating","sheet_separation"]', true, false, false),
  ('ew', 'Electroslag / Electrogas Welding', 'ESW/EGW', 'electroslag', 'resistance_heat', 'slag_or_gas', '[]', 'wire_or_strip', 'slag_or_gas', 20, 500, '["centerline_cracking","lack_of_fusion","coarse_grain","porosity"]', false, false, true),
  ('paw', 'Plasma Arc Welding', 'PAW', 'arc', 'plasma_arc', 'gas', '[]', 'separate_filler_or_autogenous', null, 0.1, 12, '["tungsten_inclusion","porosity","undercut","incomplete_fusion"]', true, true, true),
  ('laser', 'Laser Beam Welding', 'LBW', 'high_energy', 'laser', 'gas_or_vacuum', '[]', 'autogenous_or_filler', null, 0.1, 20, '["porosity","cracking","incomplete_penetration","undercut"]', true, true, true),
  ('ebw', 'Electron Beam Welding', 'EBW', 'high_energy', 'electron_beam', 'vacuum', '[]', 'autogenous', null, 0.5, 150, '["porosity","spiking","missed_joint","cracking"]', false, true, true),
  ('friction_stir', 'Friction Stir Welding', 'FSW', 'solid_state', 'friction', 'none', '[]', 'none', null, 1, 50, '["wormhole","incomplete_root","flash","surface_galling"]', true, false, true),
  ('oxy_fuel', 'Oxy-Fuel Welding', 'OFW', 'gas', 'oxy_fuel_flame', 'flame_envelope', '[]', 'separate_filler', null, 0.5, 6, '["porosity","oxidation","incomplete_fusion","distortion","excess_penetration"]', true, true, false),
  ('stud', 'Stud Welding', 'SW', 'arc', 'electric_arc', 'ferrule_or_gas', '[]', 'stud', null, null, null, '["incomplete_fusion","flash_defect","off_center","porosity"]', true, false, true),
  ('brazing', 'Brazing', 'B', 'brazing', 'various', 'flux_or_atmosphere', '[]', 'brazing_filler', 'flux', 0.1, null, '["incomplete_fill","erosion","flux_entrapment","porosity","lack_of_wetting"]', true, true, false);

-- ══════════════════════════════════════════════
-- SEED DATA: Welding Positions
-- ══════════════════════════════════════════════

insert into weld_position_registry (position_key, position_name, aws_designation, asme_designation, orientation, gravity_effect, difficulty_tier, physics_challenges, common_defects, applicable_joint_types) values
  ('1f', 'Flat Fillet', '1F', '1F', 'flat', 'favorable', 1, '["minimal_gravity_challenge"]', '["overlap","excessive_convexity"]', '["fillet","lap","tee","corner"]'),
  ('1g', 'Flat Groove', '1G', '1G', 'flat', 'favorable', 1, '["minimal_gravity_challenge"]', '["excessive_reinforcement","incomplete_fusion_at_root"]', '["butt","groove"]'),
  ('2f', 'Horizontal Fillet', '2F', '2F', 'horizontal', 'moderate', 2, '["sagging_on_vertical_leg","unequal_legs"]', '["undercut_on_top","overlap_on_bottom","unequal_legs"]', '["fillet","lap","tee","corner"]'),
  ('2g', 'Horizontal Groove', '2G', '2G', 'horizontal', 'moderate', 2, '["sagging","face_profile_control"]', '["sagging","undercut_on_top","incomplete_fusion"]', '["butt","groove"]'),
  ('3f', 'Vertical Fillet (Up/Down)', '3F', '3F', 'vertical', 'challenging', 3, '["gravity_pulls_pool_down","travel_speed_critical","heat_control"]', '["cold_lap","incomplete_fusion","sagging","icicles"]', '["fillet","lap","tee","corner"]'),
  ('3g', 'Vertical Groove (Up/Down)', '3G', '3G', 'vertical', 'challenging', 3, '["gravity_pulls_pool","root_control","tie_in_critical"]', '["cold_lap","incomplete_fusion","root_concavity","icicles"]', '["butt","groove"]'),
  ('4f', 'Overhead Fillet', '4F', '4F', 'overhead', 'severe', 4, '["full_gravity_opposition","pool_drip","heat_rises"]', '["sagging","drip_through","undercut","incomplete_fusion"]', '["fillet","lap","tee","corner"]'),
  ('4g', 'Overhead Groove', '4G', '4G', 'overhead', 'severe', 4, '["full_gravity_opposition","root_control_critical","pool_drip"]', '["sagging","drip_through","incomplete_fusion","root_issues"]', '["butt","groove"]'),
  ('5g', 'Pipe — Horizontal Fixed', '5G', '5G', 'pipe_fixed_horizontal', 'variable', 4, '["all_positions_in_one_weld","continuous_transition","overhead_at_6_oclock"]', '["incomplete_fusion_at_6","root_concavity","undercut_at_12"]', '["pipe_butt"]'),
  ('6g', 'Pipe — 45° Fixed', '6G', '6G', 'pipe_fixed_45', 'variable_extreme', 5, '["all_positions_plus_45_rotation","most_challenging","transitions_critical"]', '["incomplete_fusion","root_issues","undercut","suck_back"]', '["pipe_butt"]'),
  ('6gr', 'Pipe — 45° Fixed with Restriction Ring', '6GR', '6GR', 'pipe_fixed_45_restricted', 'variable_extreme', 5, '["all_6g_challenges_plus_access_restriction","electrode_angle_limited"]', '["root_issues","incomplete_fusion","restricted_access_defects"]', '["pipe_butt"]'),
  ('2fr', 'Horizontal Fillet — Rotated', '2FR', '2FR', 'rotated', 'controlled', 1, '["rotation_controls_gravity"]', '["overlap","convexity"]', '["fillet","pipe_fillet"]'),
  ('1g_pipe', 'Pipe — Rotated', '1G-ROT', '1G', 'pipe_rotated', 'favorable', 2, '["pipe_rotation_keeps_flat"]', '["start_stop_defects","root_issues"]', '["pipe_butt"]'),
  ('sheet_flat', 'Sheet Metal — Flat', 'N/A', 'N/A', 'flat', 'favorable', 1, '["thin_material","burnthrough_risk","heat_control_critical"]', '["burnthrough","warping","porosity","excessive_penetration"]', '["lap","edge_flange","butt","corner"]'),
  ('sheet_horizontal', 'Sheet Metal — Horizontal', 'N/A', 'N/A', 'horizontal', 'moderate', 2, '["thin_material","burnthrough","sagging"]', '["burnthrough","sagging","unequal_legs","warping"]', '["lap","edge_flange","corner"]'),
  ('sheet_vertical', 'Sheet Metal — Vertical', 'N/A', 'N/A', 'vertical', 'challenging', 3, '["thin_material","gravity","burnthrough","heat_accumulation"]', '["burnthrough","cold_lap","drop_through","warping"]', '["lap","edge_flange","butt"]'),
  ('sheet_overhead', 'Sheet Metal — Overhead', 'N/A', 'N/A', 'overhead', 'severe', 4, '["thin_material","gravity_opposition","pool_drip","burnthrough"]', '["burnthrough","drip_through","sagging","warping"]', '["lap","edge_flange"]');

-- ══════════════════════════════════════════════
-- SEED DATA: Base Materials
-- ══════════════════════════════════════════════

insert into weld_material_registry (material_key, material_name, material_group, aws_group, asme_p_number, weldability, preheat_required, common_defects, filler_compatibility) values
  ('mild_steel', 'Mild/Low Carbon Steel (A36, A283, A500)', 'carbon_steel', 'I', 'P1', 'excellent', false, '["porosity","slag","undercut"]', '["E6010","E6011","E7018","ER70S-6","E71T-1"]'),
  ('structural_steel', 'Structural Steel (A572 Gr50, A992)', 'carbon_steel', 'I', 'P1', 'good', false, '["hydrogen_cracking","lamellar_tearing","porosity"]', '["E7018","E7018-1","ER70S-6","E71T-1"]'),
  ('high_strength_steel', 'High Strength Low Alloy (A514, A517)', 'hsla_steel', 'III', 'P1-P3', 'fair', true, '["hydrogen_cracking","reheat_cracking","cold_cracking"]', '["E11018","ER110S-1","E111T1-K3"]'),
  ('cr_mo_steel', 'Chrome-Moly Steel (A335 P11, P22, P91)', 'cr_mo_steel', 'IV', 'P4-P5B', 'fair', true, '["hydrogen_cracking","temper_embrittlement","reheat_cracking"]', '["E8018-B2","E9018-B3","ER80S-B2"]'),
  ('austenitic_ss', 'Austenitic Stainless Steel (304, 316, 321)', 'stainless_steel', 'VIII', 'P8', 'good', false, '["sensitization","hot_cracking","distortion","carbide_precipitation"]', '["E308L","E316L","ER308L","ER316L"]'),
  ('duplex_ss', 'Duplex Stainless Steel (2205, 2507)', 'stainless_steel', 'X', 'P10H', 'fair', false, '["sigma_phase","loss_of_ferrite","hot_cracking","nitrogen_loss"]', '["E2209","ER2209","E2594"]'),
  ('ferritic_ss', 'Ferritic Stainless Steel (409, 430)', 'stainless_steel', 'VII', 'P7', 'fair', false, '["grain_growth","embrittlement","martensite_formation"]', '["E409","ER409","E430"]'),
  ('aluminum_1xxx_3xxx', 'Aluminum — 1xxx/3xxx Series (1100, 3003)', 'aluminum', 'XXI', 'P21', 'good', false, '["porosity","oxide_inclusion","hot_cracking","burnthrough"]', '["ER1100","ER4043"]'),
  ('aluminum_5xxx', 'Aluminum — 5xxx Series (5052, 5083, 5086)', 'aluminum', 'XXII', 'P22', 'good', false, '["porosity","oxide_inclusion","stress_corrosion","hot_cracking"]', '["ER5356","ER5183","ER5556"]'),
  ('aluminum_6xxx', 'Aluminum — 6xxx Series (6061, 6063)', 'aluminum', 'XXIII', 'P23', 'fair', false, '["hot_cracking","porosity","HAZ_softening","oxide_inclusion"]', '["ER4043","ER5356"]'),
  ('nickel_alloy', 'Nickel Alloys (Inconel 600/625, Monel)', 'nickel', 'XI', 'P41-P45', 'fair', false, '["hot_cracking","porosity","oxide_inclusion","microfissuring"]', '["ENiCrFe-3","ERNiCrMo-3","ERNiCr-3"]'),
  ('copper_alloy', 'Copper Alloys (CuNi, CuSn, CuAl)', 'copper', 'XII', 'P31-P35', 'fair', true, '["porosity","hot_cracking","oxide_inclusion","lack_of_fusion"]', '["ERCuNi","ERCuAl-A2","ERCuSn-A"]'),
  ('titanium', 'Titanium (Gr1, Gr2, Gr5/Ti-6Al-4V)', 'titanium', 'N/A', 'P51-P53', 'difficult', false, '["oxygen_contamination","porosity","embrittlement","discoloration"]', '["ERTi-1","ERTi-2","ERTi-5"]'),
  ('galvanized_steel', 'Galvanized Steel', 'carbon_steel', 'I', 'P1', 'fair', false, '["zinc_fume_porosity","spatter","cracking","incomplete_fusion"]', '["E6010","E7018","ER70S-6"]'),
  ('sheet_steel', 'Sheet Steel (26-10 gauge, 0.5-3.4mm)', 'carbon_steel', 'I', 'P1', 'good', false, '["burnthrough","warping","distortion","porosity","excessive_penetration"]', '["ER70S-6","E6013","E71T-11"]'),
  ('sheet_stainless', 'Sheet Stainless Steel (26-10 gauge)', 'stainless_steel', 'VIII', 'P8', 'good', false, '["burnthrough","warping","sensitization","oxidation","discoloration"]', '["ER308L","ER316L"]'),
  ('sheet_aluminum', 'Sheet Aluminum (various gauges)', 'aluminum', 'XXI-XXIII', 'P21-P23', 'fair', false, '["burnthrough","warping","porosity","oxide_inclusion","hot_cracking"]', '["ER4043","ER5356"]'),
  ('cast_iron', 'Cast Iron (Gray, Ductile, Malleable)', 'cast_iron', 'N/A', 'N/A', 'difficult', true, '["cracking","porosity","hard_zone","incomplete_fusion","carbon_migration"]', '["ENi-CI","ENiFe-CI","ENiCu-B"]');

-- ══════════════════════════════════════════════
-- SEED DATA: Weld Joint Types
-- ══════════════════════════════════════════════

insert into weld_joint_registry (joint_key, joint_name, joint_category, weld_type, groove_type, access_requirement, physics_stress_pattern, fatigue_category, sheet_metal_applicable) values
  ('butt_v', 'Butt — V-Groove', 'butt', 'groove', 'v_groove', 'both_sides_preferred', 'tension_or_bending', 'B', false),
  ('butt_single_v', 'Butt — Single-V with Backing', 'butt', 'groove', 'single_v', 'single_side', 'tension_or_bending', 'C', false),
  ('butt_double_v', 'Butt — Double-V', 'butt', 'groove', 'double_v', 'both_sides', 'tension_or_bending', 'B', false),
  ('butt_u', 'Butt — U-Groove', 'butt', 'groove', 'u_groove', 'both_sides_preferred', 'tension_or_bending', 'B', false),
  ('butt_j', 'Butt — J-Groove', 'butt', 'groove', 'j_groove', 'single_side', 'tension_or_bending', 'C', false),
  ('butt_square', 'Butt — Square Groove', 'butt', 'groove', 'square', 'both_sides_preferred', 'tension', 'C', true),
  ('butt_bevel', 'Butt — Single Bevel', 'butt', 'groove', 'bevel', 'single_side', 'tension_or_bending', 'C', false),
  ('tee_fillet', 'Tee — Fillet Weld', 'tee', 'fillet', null, 'single_side', 'shear_and_tension', 'D', true),
  ('tee_pjp', 'Tee — Partial Joint Penetration', 'tee', 'groove', 'bevel', 'single_side', 'shear_and_tension', 'D', false),
  ('tee_cjp', 'Tee — Complete Joint Penetration', 'tee', 'groove', 'double_bevel', 'both_sides', 'tension_or_shear', 'C', false),
  ('lap_fillet', 'Lap — Fillet Weld', 'lap', 'fillet', null, 'single_side', 'shear', 'E', true),
  ('corner_outside', 'Corner — Outside Fillet', 'corner', 'fillet', null, 'single_side', 'tension_and_shear', 'D', true),
  ('corner_inside', 'Corner — Inside Corner', 'corner', 'groove', 'v_or_bevel', 'single_side', 'tension', 'D', true),
  ('edge_flange', 'Edge Flange', 'edge', 'edge', null, 'single_side', 'shear', 'E', true),
  ('pipe_butt', 'Pipe — Butt Joint', 'pipe', 'groove', 'v_or_compound_bevel', 'outside_only', 'hoop_and_axial', 'B', false),
  ('pipe_branch', 'Pipe — Branch Connection', 'pipe', 'groove', 'saddle', 'outside_only', 'complex_triaxial', 'D', false),
  ('pipe_socket', 'Pipe — Socket Weld', 'pipe', 'fillet', null, 'outside_only', 'shear', 'E', false),
  ('plug_slot', 'Plug or Slot Weld', 'plug', 'plug', null, 'single_side', 'shear', 'E', true),
  ('flare_v', 'Flare-V Groove', 'flare', 'groove', 'flare_v', 'single_side', 'tension', 'D', true),
  ('flare_bevel', 'Flare-Bevel Groove', 'flare', 'groove', 'flare_bevel', 'single_side', 'shear', 'D', true);

-- ══════════════════════════════════════════════
-- SEED DATA: Discontinuity Types
-- ══════════════════════════════════════════════

insert into weld_discontinuity_registry (discontinuity_key, discontinuity_name, discontinuity_category, is_planar, is_linear, is_surface_breaking, typical_location, severity_ranking, dominance_tier, detection_methods, measurement_type, description) values
  ('crack_transverse', 'Transverse Crack', 'crack', true, true, true, 'weld_or_haz', 10, 1, '["vt","mt","pt","ut_paut","rt"]', 'length', 'Crack perpendicular to weld axis — always rejectable'),
  ('crack_longitudinal', 'Longitudinal Crack', 'crack', true, true, true, 'weld_centerline_or_haz', 10, 1, '["vt","mt","pt","ut_paut","rt"]', 'length', 'Crack parallel to weld axis — always rejectable'),
  ('crack_crater', 'Crater Crack', 'crack', true, false, true, 'weld_crater', 9, 1, '["vt","mt","pt"]', 'length', 'Crack at weld termination point'),
  ('crack_toe', 'Toe Crack', 'crack', true, true, true, 'weld_toe', 10, 1, '["vt","mt","pt","ut_paut"]', 'length', 'Crack initiating at weld toe in HAZ'),
  ('crack_root', 'Root Crack', 'crack', true, true, false, 'weld_root', 10, 1, '["rt","ut_paut","ut_tofd"]', 'length', 'Crack at root of weld'),
  ('crack_underbead', 'Underbead/HAZ Crack', 'crack', true, true, false, 'haz', 10, 1, '["ut_paut","mt"]', 'length', 'Hydrogen-induced cracking in HAZ'),
  ('incomplete_fusion', 'Incomplete/Lack of Fusion', 'fusion', true, true, false, 'weld_interface', 9, 2, '["ut_paut","ut_tofd","rt"]', 'length', 'Failure to fuse weld metal to base metal or previous pass'),
  ('incomplete_penetration', 'Incomplete Joint Penetration', 'fusion', true, true, false, 'weld_root', 8, 2, '["rt","ut_tofd","ut_paut"]', 'length', 'Root not fully penetrated through joint'),
  ('porosity_scattered', 'Scattered Porosity', 'porosity', false, false, false, 'weld_body', 3, 4, '["rt","ut_paut"]', 'diameter_and_count', 'Random gas pores distributed through weld'),
  ('porosity_cluster', 'Cluster Porosity', 'porosity', false, false, false, 'weld_body', 5, 3, '["rt","ut_paut"]', 'cluster_area', 'Group of pores in localized area'),
  ('porosity_linear', 'Linear/Aligned Porosity', 'porosity', false, true, false, 'weld_body', 6, 3, '["rt","ut_paut"]', 'length_and_count', 'Pores aligned along weld axis'),
  ('porosity_piping', 'Piping/Wormhole Porosity', 'porosity', false, true, false, 'weld_body', 6, 3, '["rt"]', 'length', 'Elongated gas cavity — common in FCAW'),
  ('slag_inclusion', 'Slag Inclusion', 'inclusion', false, true, false, 'between_passes', 5, 3, '["rt","ut_paut"]', 'length', 'Trapped slag between weld passes'),
  ('tungsten_inclusion', 'Tungsten Inclusion', 'inclusion', false, false, false, 'weld_body', 4, 4, '["rt"]', 'diameter', 'Tungsten particle in weld — GTAW specific'),
  ('undercut', 'Undercut', 'surface', false, true, true, 'weld_toe_or_root', 6, 3, '["vt","mt","pt"]', 'depth', 'Groove melted into base metal at weld toe not filled'),
  ('overlap', 'Overlap/Cold Lap', 'surface', false, true, true, 'weld_toe', 7, 3, '["vt","mt","pt"]', 'length', 'Weld metal extending over base metal without fusion'),
  ('excessive_reinforcement', 'Excessive Reinforcement/Convexity', 'profile', false, false, true, 'weld_face', 3, 4, '["vt"]', 'height', 'Weld face too high above base metal'),
  ('insufficient_throat', 'Insufficient Throat/Size', 'profile', false, false, true, 'weld_cross_section', 7, 3, '["vt"]', 'size', 'Fillet weld smaller than specified'),
  ('excessive_concavity', 'Excessive Concavity', 'profile', false, false, true, 'weld_face', 5, 3, '["vt"]', 'depth', 'Weld face depressed below base metal surface'),
  ('burnthrough', 'Burnthrough/Melt-Through', 'profile', false, false, true, 'weld_root', 7, 2, '["vt"]', 'diameter', 'Complete melting through base metal — especially sheet metal'),
  ('arc_strike', 'Arc Strike', 'surface', false, false, true, 'base_metal', 6, 3, '["vt","mt","pt"]', 'area', 'Inadvertent arc contact on base metal'),
  ('spatter', 'Spatter', 'surface', false, false, true, 'adjacent_base_metal', 2, 5, '["vt"]', 'area', 'Expelled metal particles adhering to surface'),
  ('distortion', 'Distortion/Warping', 'dimensional', false, false, false, 'overall_assembly', 4, 4, '["vt"]', 'deviation_mm', 'Dimensional change from welding heat — critical for sheet metal'),
  ('misalignment', 'Misalignment/Hi-Lo', 'dimensional', false, false, true, 'joint_alignment', 5, 3, '["vt"]', 'offset_mm', 'Offset between joined members'),
  ('lamellar_tearing', 'Lamellar Tearing', 'crack', true, true, false, 'base_metal_parallel_to_surface', 9, 1, '["ut_conventional","ut_paut"]', 'length', 'Step-like cracking parallel to rolling direction from through-thickness stress');

-- ══════════════════════════════════════════════
-- SEED DATA: Code Acceptance Criteria (Key Rules)
-- Note: Not reproducing copyrighted text — referencing
-- rule categories, criteria types, and applicable scope
-- ══════════════════════════════════════════════

-- AWS D1.1 — Structural Steel (Static Loading — Table 8.1 criteria types)
insert into weld_code_acceptance_criteria (code_key, code_name, table_reference, clause_reference, loading_condition, discontinuity_key, criteria_type, absolute_reject, conditional_note) values
  ('aws_d1_1', 'AWS D1.1 Structural Welding Code — Steel', 'Table 8.1', '8.9', 'static', 'crack_transverse', 'zero_tolerance', true, 'No cracks permitted'),
  ('aws_d1_1', 'AWS D1.1 Structural Welding Code — Steel', 'Table 8.1', '8.9', 'static', 'crack_longitudinal', 'zero_tolerance', true, 'No cracks permitted'),
  ('aws_d1_1', 'AWS D1.1 Structural Welding Code — Steel', 'Table 8.1', '8.9', 'static', 'crack_crater', 'zero_tolerance', true, 'No cracks permitted'),
  ('aws_d1_1', 'AWS D1.1 Structural Welding Code — Steel', 'Table 8.1', '8.9', 'static', 'incomplete_fusion', 'zero_tolerance', true, 'Not permitted'),
  ('aws_d1_1', 'AWS D1.1 Structural Welding Code — Steel', 'Table 8.1', '8.9', 'static', 'incomplete_penetration', 'conditional', false, 'Limited depth and length for static CJP; not permitted in tension splices'),
  ('aws_d1_1', 'AWS D1.1 Structural Welding Code — Steel', 'Table 8.1', '8.9', 'static', 'undercut', 'max_depth_conditional', false, 'Depth limits vary by member stress and thickness'),
  ('aws_d1_1', 'AWS D1.1 Structural Welding Code — Steel', 'Table 8.1', '8.9', 'static', 'porosity_scattered', 'size_and_spacing', false, 'Max individual size and aggregate per reference length'),
  ('aws_d1_1', 'AWS D1.1 Structural Welding Code — Steel', 'Table 8.1', '8.9', 'static', 'slag_inclusion', 'size_and_length', false, 'Max width and length per weld size'),
  ('aws_d1_1', 'AWS D1.1 Structural Welding Code — Steel', 'Table 8.1', '8.9', 'static', 'excessive_reinforcement', 'max_height', false, 'Max reinforcement height varies by weld width');

-- AWS D1.1 — Cyclic Loading (Table 8.2 — more restrictive)
insert into weld_code_acceptance_criteria (code_key, code_name, table_reference, clause_reference, loading_condition, discontinuity_key, criteria_type, absolute_reject, conditional_note) values
  ('aws_d1_1', 'AWS D1.1 Structural Welding Code — Steel', 'Table 8.2', '8.9', 'cyclic', 'crack_transverse', 'zero_tolerance', true, 'No cracks permitted'),
  ('aws_d1_1', 'AWS D1.1 Structural Welding Code — Steel', 'Table 8.2', '8.9', 'cyclic', 'crack_longitudinal', 'zero_tolerance', true, 'No cracks permitted'),
  ('aws_d1_1', 'AWS D1.1 Structural Welding Code — Steel', 'Table 8.2', '8.9', 'cyclic', 'incomplete_fusion', 'zero_tolerance', true, 'Not permitted'),
  ('aws_d1_1', 'AWS D1.1 Structural Welding Code — Steel', 'Table 8.2', '8.9', 'cyclic', 'incomplete_penetration', 'zero_tolerance', true, 'Not permitted for cyclic loading'),
  ('aws_d1_1', 'AWS D1.1 Structural Welding Code — Steel', 'Table 8.2', '8.9', 'cyclic', 'undercut', 'max_depth_strict', false, 'Stricter depth limits than static'),
  ('aws_d1_1', 'AWS D1.1 Structural Welding Code — Steel', 'Table 8.2', '8.9', 'cyclic', 'porosity_scattered', 'size_and_spacing_strict', false, 'More restrictive than static');

-- AWS D1.3 — Sheet Steel
insert into weld_code_acceptance_criteria (code_key, code_name, table_reference, clause_reference, loading_condition, discontinuity_key, criteria_type, absolute_reject, conditional_note) values
  ('aws_d1_3', 'AWS D1.3 Structural Welding Code — Sheet Steel', 'Section 6', '6.6', 'static', 'crack_transverse', 'zero_tolerance', true, 'No cracks permitted'),
  ('aws_d1_3', 'AWS D1.3 Structural Welding Code — Sheet Steel', 'Section 6', '6.6', 'static', 'crack_longitudinal', 'zero_tolerance', true, 'No cracks permitted'),
  ('aws_d1_3', 'AWS D1.3 Structural Welding Code — Sheet Steel', 'Section 6', '6.6', 'static', 'burnthrough', 'max_size_conditional', false, 'Limited size and frequency; material thickness dependent'),
  ('aws_d1_3', 'AWS D1.3 Structural Welding Code — Sheet Steel', 'Section 6', '6.6', 'static', 'undercut', 'max_depth_sheet', false, 'Depth relative to material thickness'),
  ('aws_d1_3', 'AWS D1.3 Structural Welding Code — Sheet Steel', 'Section 6', '6.6', 'static', 'incomplete_fusion', 'conditional', false, 'Location and extent dependent'),
  ('aws_d1_3', 'AWS D1.3 Structural Welding Code — Sheet Steel', 'Section 6', '6.6', 'static', 'excessive_reinforcement', 'max_height_sheet', false, 'Height relative to material thickness');

-- AWS D1.2 — Aluminum
insert into weld_code_acceptance_criteria (code_key, code_name, table_reference, clause_reference, loading_condition, discontinuity_key, criteria_type, absolute_reject, conditional_note) values
  ('aws_d1_2', 'AWS D1.2 Structural Welding Code — Aluminum', 'Table 8.1', '8.5', 'static', 'crack_transverse', 'zero_tolerance', true, 'No cracks permitted'),
  ('aws_d1_2', 'AWS D1.2 Structural Welding Code — Aluminum', 'Table 8.1', '8.5', 'static', 'crack_longitudinal', 'zero_tolerance', true, 'No cracks permitted'),
  ('aws_d1_2', 'AWS D1.2 Structural Welding Code — Aluminum', 'Table 8.1', '8.5', 'static', 'porosity_scattered', 'size_and_spacing', false, 'Max size varies by weld size'),
  ('aws_d1_2', 'AWS D1.2 Structural Welding Code — Aluminum', 'Table 8.1', '8.5', 'static', 'undercut', 'max_depth_conditional', false, 'Depth limits per member thickness');

-- AWS D1.5 — Bridge
insert into weld_code_acceptance_criteria (code_key, code_name, table_reference, clause_reference, loading_condition, discontinuity_key, criteria_type, absolute_reject, conditional_note) values
  ('aws_d1_5', 'AWS D1.5M/D1.5 Bridge Welding Code', 'Table 6.1', '6', 'cyclic', 'crack_transverse', 'zero_tolerance', true, 'No cracks — bridge is always cyclic'),
  ('aws_d1_5', 'AWS D1.5M/D1.5 Bridge Welding Code', 'Table 6.1', '6', 'cyclic', 'crack_longitudinal', 'zero_tolerance', true, 'No cracks'),
  ('aws_d1_5', 'AWS D1.5M/D1.5 Bridge Welding Code', 'Table 6.1', '6', 'cyclic', 'incomplete_fusion', 'zero_tolerance', true, 'Not permitted'),
  ('aws_d1_5', 'AWS D1.5M/D1.5 Bridge Welding Code', 'Table 6.1', '6', 'cyclic', 'incomplete_penetration', 'zero_tolerance', true, 'Not permitted'),
  ('aws_d1_5', 'AWS D1.5M/D1.5 Bridge Welding Code', 'Table 6.1', '6', 'cyclic', 'undercut', 'max_depth_strict_bridge', false, 'Very strict limits for fatigue-loaded members');

-- AWS D1.6 — Stainless
insert into weld_code_acceptance_criteria (code_key, code_name, table_reference, clause_reference, loading_condition, discontinuity_key, criteria_type, absolute_reject, conditional_note) values
  ('aws_d1_6', 'AWS D1.6 Structural Welding Code — Stainless Steel', 'Table 8.1', '8.8', 'static', 'crack_transverse', 'zero_tolerance', true, 'No cracks'),
  ('aws_d1_6', 'AWS D1.6 Structural Welding Code — Stainless Steel', 'Table 8.1', '8.8', 'static', 'crack_longitudinal', 'zero_tolerance', true, 'No cracks'),
  ('aws_d1_6', 'AWS D1.6 Structural Welding Code — Stainless Steel', 'Table 8.1', '8.8', 'static', 'porosity_scattered', 'size_and_spacing', false, 'Similar structure to D1.1 with SS-specific considerations');

-- API 1104 — Pipeline
insert into weld_code_acceptance_criteria (code_key, code_name, table_reference, clause_reference, loading_condition, discontinuity_key, criteria_type, absolute_reject, conditional_note) values
  ('api_1104', 'API 1104 Welding of Pipelines and Related Facilities', 'Table 9.3', '9', 'static', 'crack_transverse', 'zero_tolerance', true, 'No cracks'),
  ('api_1104', 'API 1104 Welding of Pipelines and Related Facilities', 'Table 9.3', '9', 'static', 'crack_longitudinal', 'zero_tolerance', true, 'No cracks'),
  ('api_1104', 'API 1104 Welding of Pipelines and Related Facilities', 'Table 9.3', '9', 'static', 'incomplete_penetration', 'max_length_conditional', false, 'Length limits per weld length; aggregate limits'),
  ('api_1104', 'API 1104 Welding of Pipelines and Related Facilities', 'Table 9.3', '9', 'static', 'incomplete_fusion', 'max_length_conditional', false, 'Length limits per weld length'),
  ('api_1104', 'API 1104 Welding of Pipelines and Related Facilities', 'Table 9.3', '9', 'static', 'porosity_scattered', 'size_and_distribution', false, 'Max diameter and aggregate per reference length'),
  ('api_1104', 'API 1104 Welding of Pipelines and Related Facilities', 'Table 9.3', '9', 'static', 'undercut', 'max_depth_pipeline', false, 'Depth and length limits');

-- ASME IX / ASME VIII — Pressure Vessels
insert into weld_code_acceptance_criteria (code_key, code_name, table_reference, clause_reference, loading_condition, discontinuity_key, criteria_type, absolute_reject, conditional_note) values
  ('asme_viii', 'ASME BPVC Section VIII — Pressure Vessels', 'UW-51/52', 'UW-51', 'pressure', 'crack_transverse', 'zero_tolerance', true, 'No cracks — pressure boundary'),
  ('asme_viii', 'ASME BPVC Section VIII — Pressure Vessels', 'UW-51/52', 'UW-51', 'pressure', 'crack_longitudinal', 'zero_tolerance', true, 'No cracks'),
  ('asme_viii', 'ASME BPVC Section VIII — Pressure Vessels', 'UW-51/52', 'UW-51', 'pressure', 'incomplete_fusion', 'zero_tolerance', true, 'Not permitted in pressure boundary'),
  ('asme_viii', 'ASME BPVC Section VIII — Pressure Vessels', 'UW-51/52', 'UW-51', 'pressure', 'incomplete_penetration', 'zero_tolerance', true, 'Not permitted in full-pen pressure welds'),
  ('asme_viii', 'ASME BPVC Section VIII — Pressure Vessels', 'UW-51/52', 'UW-51', 'pressure', 'porosity_scattered', 'size_per_thickness', false, 'RT acceptance per ASME V Article 2'),
  ('asme_viii', 'ASME BPVC Section VIII — Pressure Vessels', 'UW-51/52', 'UW-51', 'pressure', 'slag_inclusion', 'size_per_thickness', false, 'Acceptance per radiographic standards'),
  ('asme_viii', 'ASME BPVC Section VIII — Pressure Vessels', 'UW-51/52', 'UW-51', 'pressure', 'undercut', 'max_depth_pressure', false, 'Depth limits per ASME VIII UW-35');

-- ASME B31.3 — Process Piping
insert into weld_code_acceptance_criteria (code_key, code_name, table_reference, clause_reference, loading_condition, discontinuity_key, criteria_type, absolute_reject, conditional_note) values
  ('asme_b31_3', 'ASME B31.3 Process Piping', 'Table 341.3.2', '341.3', 'pressure', 'crack_transverse', 'zero_tolerance', true, 'No cracks'),
  ('asme_b31_3', 'ASME B31.3 Process Piping', 'Table 341.3.2', '341.3', 'pressure', 'incomplete_penetration', 'conditional', false, 'Limits per fluid service category — normal vs severe cyclic'),
  ('asme_b31_3', 'ASME B31.3 Process Piping', 'Table 341.3.2', '341.3', 'pressure', 'undercut', 'max_depth_piping', false, 'Depth limit based on nominal wall');

-- ══════════════════════════════════════════════
-- SEED DATA: 4D Physics Rules (Process x Position x Material x Defect)
-- ══════════════════════════════════════════════

insert into weld_4d_physics_rules (rule_key, rule_name, process_key, position_key, material_key, discontinuity_key, probability, physics_explanation, root_cause, contributing_factors, prevention_actions, teaching_point) values
  ('smaw_3g_root_lof', 'SMAW Vertical Up — Root Lack of Fusion', 'smaw', '3g', null, 'incomplete_fusion', 'probable', 'Gravity pulls molten pool downward. If welder does not maintain proper electrode angle and arc length at root, the arc hits the pool not the base metal.', 'Insufficient heat input at root face combined with gravity pulling pool away from sidewall', '["travel_speed_too_fast","electrode_angle_wrong","arc_length_too_long","amperage_too_low"]', '["maintain_tight_arc","use_whip_and_pause","keep_electrode_angle_5_to_15_drag","listen_for_crackling_sound"]', 'In vertical up, the weld pool is your enemy and your friend — too hot it drips, too cold it rolls. The sweet spot is a small, controlled keyhole at the root.'),
  ('smaw_4g_sag', 'SMAW Overhead — Sagging and Drip-Through', 'smaw', '4g', null, 'excessive_reinforcement', 'probable', 'Full gravity opposition. Molten metal pool wants to fall. If too much metal deposited or heat too high, pool detaches from joint.', 'Excessive heat input or deposition rate in overhead position', '["amperage_too_high","travel_speed_too_slow","electrode_too_large","weave_too_wide"]', '["reduce_amperage_10_to_15_percent","use_smaller_electrode","stringer_beads_only","maintain_short_arc"]', 'Overhead is about small puddles and fast moves. If you can see the pool growing, you are already too slow.'),
  ('fcaw_slag_trap', 'FCAW — Inter-pass Slag Entrapment', 'fcaw_gas', null, null, 'slag_inclusion', 'probable', 'Flux-cored wire produces slag that can be trapped between passes if not properly cleaned. Self-shielded FCAW produces even more slag.', 'Insufficient inter-pass cleaning combined with slag flowing ahead of arc', '["incomplete_slag_removal","wrong_bead_sequence","slag_runs_ahead_in_vertical"]', '["wire_brush_between_every_pass","grind_slag_pockets","proper_bead_sequencing","avoid_concave_beads_that_trap_slag"]', 'With FCAW, the rule is simple: if you can see slag, it is not clean enough. Wire brush is minimum; grinding is better.'),
  ('gtaw_tungsten', 'GTAW — Tungsten Inclusion', 'gtaw', null, null, 'tungsten_inclusion', 'possible', 'Tungsten electrode tip contacts the molten pool or filler rod, breaking off particles that become trapped in the weld.', 'Electrode dipping into pool or filler rod touching electrode', '["poor_hand_control","filler_rod_contacts_electrode","gas_coverage_loss_oxidizes_tip","amperage_too_high_for_tip_size"]', '["sharpen_electrode_properly","maintain_consistent_torch_angle","feed_filler_at_leading_edge","match_electrode_size_to_amperage"]', 'GTAW is precision welding. The electrode never touches anything except the arc. If it touches the pool, you will see a gray speck in the X-ray.'),
  ('gmaw_sheet_burn', 'GMAW Short Circuit — Sheet Metal Burnthrough', 'gmaw_solid', 'sheet_flat', 'sheet_steel', 'burnthrough', 'probable', 'Short circuit transfer on thin material. Each short circuit pulse delivers concentrated heat. If travel speed is too slow or wire feed too high, heat accumulates and melts through.', 'Excessive heat input relative to material thickness and heat dissipation capacity', '["wire_feed_too_high","travel_speed_too_slow","voltage_too_high","gap_too_large"]', '["reduce_wire_feed_speed","increase_travel_speed","use_pulsed_transfer","tack_close_spacing","use_copper_backing"]', 'Sheet metal does not forgive hesitation. The moment you stop moving, the hole starts forming. Set it up right and keep moving.'),
  ('gmaw_al_porosity', 'GMAW Aluminum — Porosity', 'gmaw_solid', null, 'aluminum_6xxx', 'porosity_scattered', 'probable', 'Aluminum has high hydrogen solubility when molten. Moisture, hydrocarbons, or oxide on filler/base metal release hydrogen that gets trapped as porosity upon solidification.', 'Hydrogen contamination from moisture, oil, oxide layer, or contaminated shielding gas', '["dirty_base_metal","oil_or_moisture_on_filler","inadequate_gas_coverage","oxide_not_removed"]', '["solvent_clean_then_stainless_brush_within_30_min","use_dry_filler","check_gas_flow_35_to_45_cfh","extend_postflow_time"]', 'Aluminum welding is 80% preparation. If you see porosity, the answer is almost always cleanliness — not technique.'),
  ('smaw_pipe_6g_root', 'SMAW 6G Pipe — Root Pass Issues', 'smaw', '6g', null, 'incomplete_penetration', 'probable', 'The 6G position (45 degree fixed) combines every challenge: overhead at 6 oclock, vertical on sides, flat at top. Root gap and electrode angle must continuously adjust through 360 degrees.', 'Continuously changing gravity vector requires real-time adjustment of technique, speed, and heat', '["inconsistent_root_gap","electrode_angle_not_adjusted","travel_speed_inconsistent","keyhole_lost"]', '["set_consistent_root_gap_with_spacer","adjust_angle_every_15_degrees","maintain_visible_keyhole","listen_for_consistent_arc_sound"]', '6G is the ultimate test because it requires you to weld in every position in one continuous pass. The root is where most failures happen — if you cannot see the keyhole, you do not have penetration.'),
  ('saw_centerline_crack', 'SAW — Centerline Cracking', 'saw', '1g', null, 'crack_longitudinal', 'possible', 'High deposition rate creates deep, narrow weld pool. Upon solidification, shrinkage stresses concentrate at centerline. If depth-to-width ratio exceeds 2:1, centerline cracking is likely.', 'Unfavorable depth-to-width ratio causing centerline solidification cracking', '["high_travel_speed_narrow_bead","excessive_current","insufficient_voltage","deep_groove"]', '["increase_voltage_for_wider_bead","reduce_current","use_tandem_wire","multi_pass_instead_of_single"]', 'SAW centerline cracking is a geometry problem, not a metallurgy problem. If the bead is deeper than it is wide, the last metal to freeze is a line down the middle — and that line cracks.'),
  ('any_dissimilar_fusion', 'Dissimilar Metal — Fusion Line Issues', null, null, null, 'incomplete_fusion', 'possible', 'Different melting points and thermal conductivities between base metals cause uneven melting. Higher-melting-point metal may not fully fuse.', 'Thermal property mismatch between dissimilar base metals', '["arc_directed_at_lower_melting_metal","preheat_insufficient","wrong_filler_selection"]', '["direct_arc_toward_higher_melting_point_metal","use_intermediate_filler","preheat_per_higher_requirement"]', 'When welding dissimilar metals, always favor the harder-to-weld material with your technique. The easier metal will take care of itself.'),
  ('sheet_al_distortion', 'Sheet Aluminum — Distortion and Warping', null, null, 'sheet_aluminum', 'distortion', 'probable', 'Aluminum has thermal conductivity 4x steel and thermal expansion 2x steel. Sheet gauge aluminum dissipates heat rapidly but distorts severely if welding sequence is wrong.', 'High thermal expansion coefficient combined with thin material and rapid heat input', '["no_fixturing","wrong_weld_sequence","excessive_heat_input","no_tack_welds"]', '["use_rigid_fixturing","backstep_technique","balanced_weld_sequence","skip_weld_pattern","minimize_heat_input"]', 'Aluminum sheet wants to move. You cannot fight physics — you manage it with fixturing, sequence, and speed.');
