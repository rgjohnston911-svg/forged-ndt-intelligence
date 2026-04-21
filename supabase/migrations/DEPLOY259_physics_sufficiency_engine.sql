-- DEPLOY259: Physics Sufficiency Engine v1.0.0
-- "Can this method physically detect this mechanism?"
-- Maps damage mechanisms → valid methods → required techniques
-- Deterministic method selection and sufficiency scoring
-- Run in Supabase SQL Editor

-- 1. physics_method_registry
-- Master registry of NDT methods and their physical capabilities
create table physics_method_registry (
  id uuid primary key default gen_random_uuid(),
  method_key text not null unique,
  method_name text not null,
  method_category text not null,
  physics_principle text not null,
  detection_capability jsonb not null default '[]'::jsonb,
  limitations jsonb not null default '[]'::jsonb,
  surface_access_required text not null default 'one_side',
  material_constraints jsonb not null default '[]'::jsonb,
  thickness_min_mm numeric,
  thickness_max_mm numeric,
  temperature_max_c numeric,
  requires_couplant boolean not null default false,
  requires_power boolean not null default false,
  field_portable boolean not null default true,
  cost_tier text not null default 'medium',
  skill_level_required text not null default 'level_ii',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_physics_method_registry_method_key on physics_method_registry(method_key);
create index idx_physics_method_registry_method_category on physics_method_registry(method_category);
create index idx_physics_method_registry_physics_principle on physics_method_registry(physics_principle);

-- No RLS on reference table - read-only global data
alter table physics_method_registry enable row level security;
create policy "physics_method_registry_read_all" on physics_method_registry
  for select using (true);

-- 2. physics_damage_mechanisms
-- Master registry of damage mechanisms and their physical characteristics
create table physics_damage_mechanisms (
  id uuid primary key default gen_random_uuid(),
  mechanism_key text not null unique,
  mechanism_name text not null,
  mechanism_category text not null,
  description text not null,
  flaw_type text not null,
  flaw_orientation text not null default 'any',
  flaw_location text not null default 'any',
  typical_industries jsonb not null default '[]'::jsonb,
  typical_materials jsonb not null default '[]'::jsonb,
  typical_environments jsonb not null default '[]'::jsonb,
  progression_rate text not null default 'moderate',
  severity_if_missed text not null default 'high',
  code_references jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_physics_damage_mechanisms_mechanism_key on physics_damage_mechanisms(mechanism_key);
create index idx_physics_damage_mechanisms_mechanism_category on physics_damage_mechanisms(mechanism_category);
create index idx_physics_damage_mechanisms_flaw_type on physics_damage_mechanisms(flaw_type);

alter table physics_damage_mechanisms enable row level security;
create policy "physics_damage_mechanisms_read_all" on physics_damage_mechanisms
  for select using (true);

-- 3. physics_method_mechanism_map
-- The core mapping: which methods can detect which mechanisms
create table physics_method_mechanism_map (
  id uuid primary key default gen_random_uuid(),
  method_key text not null,
  mechanism_key text not null,
  detection_capability text not null,
  confidence_rating numeric not null default 0.7,
  is_primary boolean not null default false,
  is_sufficient_alone boolean not null default false,
  complementary_methods jsonb not null default '[]'::jsonb,
  required_technique text,
  limitations_for_mechanism text,
  min_detectable_size_mm numeric,
  code_requirement text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_physics_mmm_method_key on physics_method_mechanism_map(method_key);
create index idx_physics_mmm_mechanism_key on physics_method_mechanism_map(mechanism_key);
create index idx_physics_mmm_detection_capability on physics_method_mechanism_map(detection_capability);
create index idx_physics_mmm_is_primary on physics_method_mechanism_map(is_primary);

alter table physics_method_mechanism_map enable row level security;
create policy "physics_method_mechanism_map_read_all" on physics_method_mechanism_map
  for select using (true);

-- 4. physics_sufficiency_assessments
-- Per-case sufficiency evaluations
create table physics_sufficiency_assessments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  case_id uuid not null,
  mechanism_key text not null,
  methods_applied jsonb not null default '[]'::jsonb,
  methods_required jsonb not null default '[]'::jsonb,
  methods_missing jsonb not null default '[]'::jsonb,
  sufficiency_score numeric not null default 0,
  sufficiency_rating text not null default 'insufficient',
  gaps jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  assessment_json jsonb not null default '{}'::jsonb,
  engine_version text not null default 'v1.0.0',
  computed_at timestamptz not null default now()
);

create index idx_physics_sufficiency_org_id on physics_sufficiency_assessments(org_id);
create index idx_physics_sufficiency_case_id on physics_sufficiency_assessments(case_id);
create index idx_physics_sufficiency_mechanism_key on physics_sufficiency_assessments(mechanism_key);
create index idx_physics_sufficiency_rating on physics_sufficiency_assessments(sufficiency_rating);

alter table physics_sufficiency_assessments enable row level security;
create policy "physics_sufficiency_org_isolation" on physics_sufficiency_assessments
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- 5. physics_technique_requirements
-- Detailed technique parameters required per method+mechanism combo
create table physics_technique_requirements (
  id uuid primary key default gen_random_uuid(),
  method_key text not null,
  mechanism_key text not null,
  technique_name text not null,
  required_parameters jsonb not null default '{}'::jsonb,
  calibration_requirements jsonb not null default '[]'::jsonb,
  acceptance_criteria jsonb not null default '{}'::jsonb,
  code_reference text,
  procedure_notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_physics_technique_method on physics_technique_requirements(method_key);
create index idx_physics_technique_mechanism on physics_technique_requirements(mechanism_key);

alter table physics_technique_requirements enable row level security;
create policy "physics_technique_requirements_read_all" on physics_technique_requirements
  for select using (true);

-- 6. physics_audit_events
create table physics_audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  case_id uuid,
  action_type text not null,
  event_json jsonb not null,
  created_at timestamptz not null default now()
);

create index idx_physics_audit_events_org_id on physics_audit_events(org_id);
create index idx_physics_audit_events_case_id on physics_audit_events(case_id);
create index idx_physics_audit_events_action_type on physics_audit_events(action_type);

alter table physics_audit_events enable row level security;
create policy "physics_audit_events_org_isolation" on physics_audit_events
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ══════════════════════════════════════════════
-- SEED DATA: NDT Methods
-- ══════════════════════════════════════════════

insert into physics_method_registry (method_key, method_name, method_category, physics_principle, detection_capability, limitations, surface_access_required, requires_couplant, requires_power, field_portable, cost_tier, skill_level_required, thickness_min_mm, thickness_max_mm, temperature_max_c) values
  ('ut_conventional', 'Ultrasonic Testing (Conventional)', 'volumetric', 'sound_wave_reflection', '["wall_thickness","internal_flaws","laminations","inclusions","lack_of_fusion"]', '["surface_must_be_accessible","requires_couplant","not_ideal_for_coarse_grain"]', 'one_side', true, true, true, 'medium', 'level_ii', 3, 500, 400),
  ('ut_paut', 'Phased Array UT (PAUT)', 'volumetric', 'phased_sound_wave_steering', '["cracks","lack_of_fusion","porosity","inclusions","wall_thickness","weld_flaws","corrosion_mapping"]', '["requires_calibration_block","higher_skill_requirement","surface_condition_dependent"]', 'one_side', true, true, true, 'high', 'level_ii', 2, 300, 350),
  ('ut_tofd', 'Time-of-Flight Diffraction (TOFD)', 'volumetric', 'diffracted_wave_timing', '["cracks","lack_of_fusion","incomplete_penetration","through_wall_sizing"]', '["dead_zones_near_surfaces","requires_two_probes","weld_cap_must_be_ground"]', 'one_side', true, true, true, 'high', 'level_ii', 8, 300, 350),
  ('rt_film', 'Radiographic Testing (Film)', 'volumetric', 'radiation_absorption', '["porosity","inclusions","slag","lack_of_fusion","incomplete_penetration","cracks_parallel_to_beam"]', '["radiation_hazard","access_both_sides_preferred","poor_for_planar_flaws_perpendicular","slow_processing"]', 'both_sides', false, true, false, 'high', 'level_ii', 2, 200, null),
  ('rt_digital', 'Digital Radiography (DR/CR)', 'volumetric', 'radiation_digital_capture', '["porosity","inclusions","slag","lack_of_fusion","wall_thickness_profile"]', '["radiation_hazard","access_both_sides_preferred","poor_for_tight_cracks"]', 'both_sides', false, true, true, 'high', 'level_ii', 1, 200, null),
  ('mt', 'Magnetic Particle Testing (MT)', 'surface', 'magnetic_flux_leakage', '["surface_cracks","near_surface_cracks","lack_of_fusion_at_surface","fatigue_cracks","stress_corrosion_cracks"]', '["ferromagnetic_materials_only","surface_must_be_clean","max_depth_6mm","demagnetization_required"]', 'one_side', false, true, true, 'low', 'level_ii', null, null, 315),
  ('pt', 'Liquid Penetrant Testing (PT)', 'surface', 'capillary_action', '["surface_breaking_cracks","porosity_at_surface","laps","seams","lack_of_fusion_at_surface"]', '["surface_breaking_only","porous_materials_problematic","temperature_sensitive","surface_preparation_critical"]', 'one_side', false, false, true, 'low', 'level_i', null, null, 175),
  ('vt', 'Visual Testing (VT)', 'surface', 'visible_light_reflection', '["surface_corrosion","misalignment","undercut","overlap","spatter","surface_cracks_visible","coating_damage","deformation"]', '["surface_only","subjective","lighting_dependent","no_subsurface_detection"]', 'one_side', false, false, true, 'low', 'level_i', null, null, null),
  ('et_ect', 'Eddy Current Testing (ECT)', 'surface_subsurface', 'electromagnetic_induction', '["surface_cracks","near_surface_cracks","conductivity_changes","coating_thickness","tube_wall_loss","heat_exchanger_tubes"]', '["conductive_materials_only","depth_limited","lift_off_sensitive","geometry_dependent"]', 'one_side', false, true, true, 'medium', 'level_ii', null, null, null),
  ('ae', 'Acoustic Emission (AE)', 'monitoring', 'stress_wave_emission', '["active_crack_growth","leak_detection","fiber_breakage","delamination_growth","pressure_boundary_integrity"]', '["requires_loading","background_noise_sensitive","cannot_size_flaws","requires_multiple_sensors"]', 'one_side', false, true, true, 'high', 'level_ii', null, null, null),
  ('mfl', 'Magnetic Flux Leakage (MFL)', 'volumetric', 'magnetic_flux_leakage', '["wall_loss","pitting","corrosion","tank_floor_scanning"]', '["ferromagnetic_only","surface_condition_affects","limited_sizing_accuracy","speed_dependent"]', 'one_side', false, true, true, 'medium', 'level_ii', 3, 25, null),
  ('pmi', 'Positive Material Identification (PMI)', 'composition', 'x_ray_fluorescence', '["material_verification","alloy_identification","mix_up_prevention","heat_number_verification"]', '["surface_preparation_needed","not_for_carbon_content","light_elements_limited"]', 'one_side', false, true, true, 'medium', 'level_ii', null, null, null),
  ('ir_thermography', 'Infrared Thermography', 'thermal', 'infrared_radiation', '["delamination","disbonds","moisture_ingress","insulation_gaps","hot_spots","CUI_screening"]', '["surface_temperature_only","emissivity_dependent","wind_affects","resolution_limited"]', 'one_side', false, true, true, 'medium', 'level_ii', null, null, null),
  ('gwut', 'Guided Wave UT (GWUT/LRUT)', 'volumetric', 'guided_wave_propagation', '["wall_loss_screening","corrosion_under_insulation","buried_pipe_corrosion","long_range_screening"]', '["screening_only","follow_up_needed","attenuation_at_features","cannot_size_precisely"]', 'one_side', true, true, true, 'high', 'level_ii', 2, 50, 200),
  ('hardness', 'Hardness Testing', 'mechanical', 'indentation_resistance', '["heat_treatment_verification","temper_embrittlement_screening","hydrogen_damage_screening","weld_hardness"]', '["point_measurement","surface_preparation_needed","not_definitive_alone"]', 'one_side', false, false, true, 'low', 'level_ii', null, null, null);

-- ══════════════════════════════════════════════
-- SEED DATA: Damage Mechanisms
-- ══════════════════════════════════════════════

insert into physics_damage_mechanisms (mechanism_key, mechanism_name, mechanism_category, description, flaw_type, flaw_orientation, flaw_location, typical_industries, typical_materials, typical_environments, progression_rate, severity_if_missed, code_references) values
  ('general_corrosion', 'General/Uniform Corrosion', 'corrosion', 'Uniform material loss across exposed surfaces', 'wall_thinning', 'any', 'internal_or_external', '["oil_gas","chemical","power","marine"]', '["carbon_steel","low_alloy_steel"]', '["aqueous","atmospheric","marine"]', 'slow', 'medium', '["API 571 4.3.2","API 510","API 570"]'),
  ('pitting', 'Pitting Corrosion', 'corrosion', 'Localized corrosion forming small pits or cavities', 'localized_thinning', 'any', 'internal_or_external', '["oil_gas","chemical","marine","water_treatment"]', '["stainless_steel","carbon_steel","copper_alloys"]', '["chloride","stagnant","aerated"]', 'moderate', 'high', '["API 571 4.3.3","NACE SP0116"]'),
  ('cui', 'Corrosion Under Insulation (CUI)', 'corrosion', 'Corrosion hidden beneath thermal insulation', 'wall_thinning', 'any', 'external', '["oil_gas","chemical","power"]', '["carbon_steel","low_alloy_steel"]', '["insulated","cyclic_temperature","marine"]', 'moderate', 'critical', '["API 571 4.3.4","API 583","NACE SP0198"]'),
  ('erosion', 'Erosion/Erosion-Corrosion', 'mechanical', 'Material removal by fluid velocity and/or particle impingement', 'wall_thinning', 'any', 'internal', '["oil_gas","chemical","power","mining"]', '["carbon_steel","copper_alloys"]', '["high_velocity","slurry","multiphase"]', 'fast', 'high', '["API 571 4.3.5","API 14E"]'),
  ('fatigue_cracking', 'Fatigue Cracking', 'cracking', 'Progressive cracking under cyclic stress', 'crack', 'perpendicular_to_stress', 'surface_or_subsurface', '["all"]', '["all_metals"]', '["cyclic_loading","vibration","thermal_cycling"]', 'moderate', 'critical', '["API 571 4.5.1","ASME VIII Div 2","BS 7910"]'),
  ('scc', 'Stress Corrosion Cracking (SCC)', 'cracking', 'Cracking from combined tensile stress and corrosive environment', 'crack', 'branching', 'surface', '["oil_gas","chemical","nuclear","power"]', '["stainless_steel","carbon_steel","copper_alloys","nickel_alloys"]', '["chloride","caustic","amine","carbonate","H2S"]', 'fast', 'critical', '["API 571 4.5.2","NACE MR0175","API 945"]'),
  ('hydrogen_damage', 'Hydrogen Damage (HIC/SOHIC/HE)', 'cracking', 'Damage from hydrogen absorption — blistering, cracking, embrittlement', 'crack_or_blister', 'parallel_to_surface_hic', 'internal', '["oil_gas","chemical","refining"]', '["carbon_steel","low_alloy_steel","high_strength_steel"]', '["wet_H2S","high_pressure_hydrogen","acid"]', 'moderate', 'critical', '["API 571 4.5.4","API 941","NACE MR0175"]'),
  ('htha', 'High Temperature Hydrogen Attack (HTHA)', 'metallurgical', 'Methane formation at grain boundaries from hydrogen at high temperature', 'microfissuring', 'intergranular', 'internal', '["refining","chemical"]', '["carbon_steel","C-0.5Mo_steel"]', '["hydrogen_above_200C","high_pressure"]', 'slow_then_sudden', 'critical', '["API 571 4.5.5","API 941","API RP 942"]'),
  ('creep', 'Creep/Stress Rupture', 'metallurgical', 'Time-dependent deformation and cracking at elevated temperature', 'deformation_and_crack', 'intergranular', 'throughout', '["power","refining","chemical"]', '["carbon_steel","CrMo_steels","stainless_steel"]', '["high_temperature_sustained"]', 'slow', 'critical', '["API 571 4.5.6","API 579","ASME I","ASME VIII"]'),
  ('caustic_cracking', 'Caustic Cracking/Caustic Embrittlement', 'cracking', 'Cracking in caustic (NaOH/KOH) environments under stress', 'crack', 'intergranular', 'surface', '["chemical","power","pulp_paper"]', '["carbon_steel"]', '["caustic_concentration","elevated_temperature"]', 'moderate', 'high', '["API 571 4.5.3","NACE SP0403"]'),
  ('mic', 'Microbiologically Influenced Corrosion (MIC)', 'corrosion', 'Corrosion caused or accelerated by microorganisms', 'pitting_underdeposit', 'any', 'internal', '["oil_gas","water_treatment","marine","power"]', '["carbon_steel","stainless_steel","copper_alloys"]', '["stagnant_water","low_flow","biofilm"]', 'moderate', 'high', '["API 571 4.3.8","NACE TM0212"]'),
  ('temper_embrittlement', 'Temper Embrittlement', 'metallurgical', 'Loss of toughness from segregation of impurities to grain boundaries', 'embrittlement', 'intergranular', 'throughout', '["refining","chemical","power"]', '["CrMo_steels","2.25Cr-1Mo"]', '["long_term_high_temperature","slow_cooling"]', 'slow', 'high', '["API 571 4.5.7","API 934"]'),
  ('sigma_phase', 'Sigma Phase Embrittlement', 'metallurgical', 'Brittle intermetallic phase formation in stainless steels', 'embrittlement', 'intergranular', 'throughout', '["refining","chemical"]', '["stainless_steel_300_series","duplex_stainless"]', '["600_900C_exposure"]', 'slow', 'high', '["API 571 4.5.8"]'),
  ('lac', 'Lack of Fusion', 'fabrication', 'Incomplete fusion between weld passes or weld-to-base metal', 'planar_flaw', 'parallel_to_weld_face', 'weld', '["all"]', '["all_weldable_metals"]', '["welding"]', 'none', 'critical', '["AWS D1.1","ASME IX","API 1104"]'),
  ('incomplete_pen', 'Incomplete Penetration', 'fabrication', 'Failure of weld metal to penetrate through the joint', 'planar_flaw', 'along_root', 'weld_root', '["all"]', '["all_weldable_metals"]', '["welding"]', 'none', 'critical', '["AWS D1.1","ASME IX","API 1104"]'),
  ('porosity', 'Porosity', 'fabrication', 'Gas pockets trapped in solidified weld metal', 'volumetric_flaw', 'random', 'weld', '["all"]', '["all_weldable_metals"]', '["welding"]', 'none', 'medium', '["AWS D1.1","ASME IX","API 1104"]'),
  ('slag_inclusion', 'Slag Inclusions', 'fabrication', 'Non-metallic material trapped between weld passes', 'volumetric_flaw', 'along_weld', 'weld', '["all"]', '["all_weldable_metals"]', '["welding_smaw_fcaw"]', 'none', 'medium', '["AWS D1.1","ASME IX"]'),
  ('lamination', 'Lamination/Delamination', 'material', 'Planar separation within base material from rolling or hydrogen', 'planar_flaw', 'parallel_to_surface', 'mid_wall', '["all"]', '["rolled_plate","carbon_steel"]', '["as_manufactured","hydrogen"]', 'none', 'medium', '["ASTM A578","ASME SA-578"]'),
  ('coating_failure', 'Coating/Lining Failure', 'protective', 'Degradation or loss of protective coating or lining', 'surface_degradation', 'any', 'external_or_internal', '["oil_gas","chemical","marine","infrastructure"]', '["carbon_steel","concrete"]', '["UV","chemical","mechanical","thermal"]', 'moderate', 'medium', '["SSPC","NACE","ISO 12944"]');

-- ══════════════════════════════════════════════
-- SEED DATA: Method-Mechanism Mapping (Core Intelligence)
-- ══════════════════════════════════════════════

-- General Corrosion
insert into physics_method_mechanism_map (method_key, mechanism_key, detection_capability, confidence_rating, is_primary, is_sufficient_alone, complementary_methods, required_technique, code_requirement) values
  ('ut_conventional', 'general_corrosion', 'excellent', 0.95, true, true, '["vt"]', 'thickness_grid', 'API 570 Section 7'),
  ('ut_paut', 'general_corrosion', 'excellent', 0.97, false, true, '["vt"]', 'corrosion_mapping', 'API 570'),
  ('rt_digital', 'general_corrosion', 'good', 0.75, false, false, '["ut_conventional"]', 'tangential_profile', null),
  ('vt', 'general_corrosion', 'moderate', 0.50, false, false, '["ut_conventional"]', 'close_visual', 'API 570 Section 6'),
  ('gwut', 'general_corrosion', 'good_screening', 0.70, false, false, '["ut_conventional"]', 'guided_wave_scan', null);

-- Pitting
insert into physics_method_mechanism_map (method_key, mechanism_key, detection_capability, confidence_rating, is_primary, is_sufficient_alone, complementary_methods, required_technique, code_requirement) values
  ('ut_paut', 'pitting', 'excellent', 0.92, true, true, '["vt","pt"]', 'corrosion_mapping_c_scan', 'API 570'),
  ('ut_conventional', 'pitting', 'moderate', 0.60, false, false, '["ut_paut","vt"]', 'grid_scanning', 'API 570'),
  ('vt', 'pitting', 'good_external_only', 0.65, false, false, '["ut_paut"]', 'close_visual_with_pit_gauge', null),
  ('rt_digital', 'pitting', 'good', 0.70, false, false, '["ut_paut"]', 'profile_radiography', null);

-- CUI
insert into physics_method_mechanism_map (method_key, mechanism_key, detection_capability, confidence_rating, is_primary, is_sufficient_alone, complementary_methods, required_technique, code_requirement) values
  ('ut_conventional', 'cui', 'excellent_after_strip', 0.95, true, true, '["ir_thermography","gwut"]', 'thickness_grid_stripped', 'API 583'),
  ('ir_thermography', 'cui', 'good_screening', 0.60, false, false, '["ut_conventional"]', 'thermal_survey', 'API 583 Section 7'),
  ('gwut', 'cui', 'good_screening', 0.65, false, false, '["ut_conventional"]', 'guided_wave_scan', 'API 583'),
  ('rt_digital', 'cui', 'good', 0.75, false, true, '["ut_conventional"]', 'profile_through_insulation', null),
  ('vt', 'cui', 'poor_indicators_only', 0.30, false, false, '["ut_conventional","ir_thermography"]', 'insulation_condition_survey', 'API 583 Section 6');

-- Fatigue Cracking
insert into physics_method_mechanism_map (method_key, mechanism_key, detection_capability, confidence_rating, is_primary, is_sufficient_alone, complementary_methods, required_technique, code_requirement) values
  ('ut_paut', 'fatigue_cracking', 'excellent', 0.93, true, true, '["mt","pt"]', 'sector_scan_weld', 'ASME V Article 4'),
  ('ut_tofd', 'fatigue_cracking', 'excellent', 0.95, true, true, '["mt","ut_paut"]', 'tofd_scan', 'ASME V Article 4'),
  ('mt', 'fatigue_cracking', 'good_surface', 0.85, false, false, '["ut_paut","ut_tofd"]', 'yoke_or_prods', 'ASME V Article 7'),
  ('pt', 'fatigue_cracking', 'good_surface', 0.80, false, false, '["ut_paut","ut_tofd"]', 'visible_or_fluorescent', 'ASME V Article 6'),
  ('et_ect', 'fatigue_cracking', 'good', 0.80, false, false, '["ut_paut"]', 'surface_scan', null),
  ('ae', 'fatigue_cracking', 'good_active_only', 0.70, false, false, '["ut_paut","mt"]', 'continuous_monitoring', null);

-- SCC
insert into physics_method_mechanism_map (method_key, mechanism_key, detection_capability, confidence_rating, is_primary, is_sufficient_alone, complementary_methods, required_technique, code_requirement) values
  ('ut_paut', 'scc', 'excellent', 0.90, true, true, '["mt","pt","et_ect"]', 'sector_scan', 'API 571'),
  ('ut_tofd', 'scc', 'excellent', 0.92, true, true, '["mt","pt"]', 'tofd_scan', 'API 571'),
  ('mt', 'scc', 'good_surface', 0.80, false, false, '["ut_paut","ut_tofd"]', 'wet_fluorescent_mt', 'NACE'),
  ('pt', 'scc', 'good_surface', 0.75, false, false, '["ut_paut","ut_tofd"]', 'fluorescent_pt', 'NACE'),
  ('et_ect', 'scc', 'good', 0.78, false, false, '["ut_paut"]', 'eddy_current_scan', null);

-- Hydrogen Damage (HIC/SOHIC)
insert into physics_method_mechanism_map (method_key, mechanism_key, detection_capability, confidence_rating, is_primary, is_sufficient_alone, complementary_methods, required_technique, code_requirement) values
  ('ut_paut', 'hydrogen_damage', 'excellent', 0.90, true, true, '["ut_tofd","hardness"]', 'angle_beam_with_c_scan', 'API 941'),
  ('ut_tofd', 'hydrogen_damage', 'excellent', 0.92, true, true, '["ut_paut","hardness"]', 'tofd_weld_scan', 'API 941'),
  ('ut_conventional', 'hydrogen_damage', 'moderate', 0.55, false, false, '["ut_paut","ut_tofd"]', 'straight_beam_for_hic', 'API 941'),
  ('hardness', 'hydrogen_damage', 'screening_only', 0.40, false, false, '["ut_paut","ut_tofd"]', 'portable_hardness', 'API 941');

-- HTHA
insert into physics_method_mechanism_map (method_key, mechanism_key, detection_capability, confidence_rating, is_primary, is_sufficient_alone, complementary_methods, required_technique, code_requirement) values
  ('ut_paut', 'htha', 'excellent', 0.88, true, true, '["ut_tofd","hardness"]', 'velocity_ratio_and_backscatter', 'API 941 / API RP 942'),
  ('ut_tofd', 'htha', 'good', 0.80, false, false, '["ut_paut"]', 'tofd_baseline_comparison', 'API 941'),
  ('ut_conventional', 'htha', 'poor', 0.30, false, false, '["ut_paut"]', 'NOT_SUFFICIENT', 'API 941 — conventional UT INSUFFICIENT for HTHA'),
  ('hardness', 'htha', 'screening_only', 0.35, false, false, '["ut_paut"]', 'portable_hardness', null);

-- Creep
insert into physics_method_mechanism_map (method_key, mechanism_key, detection_capability, confidence_rating, is_primary, is_sufficient_alone, complementary_methods, required_technique, code_requirement) values
  ('ut_paut', 'creep', 'good', 0.80, true, false, '["mt","hardness","vt"]', 'angle_beam_weld_scan', 'API 579'),
  ('mt', 'creep', 'good_surface', 0.75, false, false, '["ut_paut","hardness"]', 'wet_mt_haz_and_welds', 'API 579'),
  ('hardness', 'creep', 'good_screening', 0.65, false, false, '["ut_paut","mt"]', 'in_situ_hardness_survey', 'API 579'),
  ('vt', 'creep', 'moderate', 0.50, false, false, '["ut_paut","mt","hardness"]', 'dimensional_survey_for_bulging', 'API 579');

-- Lack of Fusion
insert into physics_method_mechanism_map (method_key, mechanism_key, detection_capability, confidence_rating, is_primary, is_sufficient_alone, complementary_methods, required_technique, code_requirement) values
  ('ut_paut', 'lac', 'excellent', 0.95, true, true, '["ut_tofd"]', 'sector_scan_full_volume', 'ASME V Article 4'),
  ('ut_tofd', 'lac', 'excellent', 0.95, true, true, '["ut_paut"]', 'tofd_scan', 'ASME V Article 4'),
  ('rt_film', 'lac', 'moderate', 0.55, false, false, '["ut_paut","ut_tofd"]', 'radiograph', 'ASME V Article 2 — limited for planar flaws'),
  ('rt_digital', 'lac', 'moderate', 0.60, false, false, '["ut_paut","ut_tofd"]', 'digital_radiograph', null),
  ('ut_conventional', 'lac', 'good', 0.80, false, true, '["ut_paut"]', 'angle_beam_scan', 'ASME V Article 4');

-- Incomplete Penetration
insert into physics_method_mechanism_map (method_key, mechanism_key, detection_capability, confidence_rating, is_primary, is_sufficient_alone, complementary_methods, required_technique, code_requirement) values
  ('ut_tofd', 'incomplete_pen', 'excellent', 0.95, true, true, '["ut_paut","rt_film"]', 'tofd_root_scan', 'ASME V'),
  ('ut_paut', 'incomplete_pen', 'excellent', 0.93, true, true, '["ut_tofd"]', 'sector_scan', 'ASME V'),
  ('rt_film', 'incomplete_pen', 'good', 0.80, false, true, '["ut_tofd"]', 'radiograph', 'ASME V Article 2'),
  ('rt_digital', 'incomplete_pen', 'good', 0.80, false, true, '["ut_tofd"]', 'digital_radiograph', null);

-- Porosity
insert into physics_method_mechanism_map (method_key, mechanism_key, detection_capability, confidence_rating, is_primary, is_sufficient_alone, complementary_methods, required_technique, code_requirement) values
  ('rt_film', 'porosity', 'excellent', 0.95, true, true, '[]', 'radiograph', 'ASME V Article 2'),
  ('rt_digital', 'porosity', 'excellent', 0.95, true, true, '[]', 'digital_radiograph', null),
  ('ut_paut', 'porosity', 'good', 0.75, false, true, '["rt_film"]', 'sector_scan', null),
  ('ut_conventional', 'porosity', 'moderate', 0.60, false, false, '["rt_film"]', 'straight_beam', null);

-- Lamination
insert into physics_method_mechanism_map (method_key, mechanism_key, detection_capability, confidence_rating, is_primary, is_sufficient_alone, complementary_methods, required_technique, code_requirement) values
  ('ut_conventional', 'lamination', 'excellent', 0.95, true, true, '[]', 'straight_beam_scan', 'ASTM A578'),
  ('ut_paut', 'lamination', 'excellent', 0.97, true, true, '[]', 'linear_scan_c_scan', 'ASTM A578');

-- Erosion
insert into physics_method_mechanism_map (method_key, mechanism_key, detection_capability, confidence_rating, is_primary, is_sufficient_alone, complementary_methods, required_technique, code_requirement) values
  ('ut_conventional', 'erosion', 'excellent', 0.95, true, true, '["vt"]', 'thickness_grid', 'API 570'),
  ('ut_paut', 'erosion', 'excellent', 0.97, true, true, '["vt"]', 'corrosion_mapping', null),
  ('vt', 'erosion', 'good_internal', 0.70, false, false, '["ut_conventional"]', 'internal_visual', null);

-- Coating Failure
insert into physics_method_mechanism_map (method_key, mechanism_key, detection_capability, confidence_rating, is_primary, is_sufficient_alone, complementary_methods, required_technique, code_requirement) values
  ('vt', 'coating_failure', 'excellent', 0.90, true, true, '["et_ect"]', 'close_visual_astm', 'SSPC-PA 2'),
  ('et_ect', 'coating_failure', 'excellent_thickness', 0.90, false, false, '["vt"]', 'coating_thickness_gauge', 'SSPC-PA 2');

-- MIC
insert into physics_method_mechanism_map (method_key, mechanism_key, detection_capability, confidence_rating, is_primary, is_sufficient_alone, complementary_methods, required_technique, code_requirement) values
  ('ut_paut', 'mic', 'good', 0.80, true, false, '["vt","pt"]', 'corrosion_mapping', null),
  ('ut_conventional', 'mic', 'moderate', 0.60, false, false, '["ut_paut","vt"]', 'thickness_grid', null),
  ('vt', 'mic', 'moderate_indicators', 0.50, false, false, '["ut_paut"]', 'internal_visual_for_deposits', null);

-- Temper Embrittlement
insert into physics_method_mechanism_map (method_key, mechanism_key, detection_capability, confidence_rating, is_primary, is_sufficient_alone, complementary_methods, required_technique, code_requirement) values
  ('hardness', 'temper_embrittlement', 'good_screening', 0.70, true, false, '[]', 'in_situ_hardness_survey', 'API 934');

-- Sigma Phase
insert into physics_method_mechanism_map (method_key, mechanism_key, detection_capability, confidence_rating, is_primary, is_sufficient_alone, complementary_methods, required_technique, code_requirement) values
  ('hardness', 'sigma_phase', 'good_screening', 0.65, true, false, '["pmi"]', 'hardness_survey', null),
  ('pmi', 'sigma_phase', 'composition_only', 0.40, false, false, '["hardness"]', 'xrf_scan', null);

-- Caustic Cracking
insert into physics_method_mechanism_map (method_key, mechanism_key, detection_capability, confidence_rating, is_primary, is_sufficient_alone, complementary_methods, required_technique, code_requirement) values
  ('ut_paut', 'caustic_cracking', 'excellent', 0.90, true, true, '["mt","pt"]', 'sector_scan', null),
  ('mt', 'caustic_cracking', 'good_surface', 0.80, false, false, '["ut_paut"]', 'wet_mt', null),
  ('pt', 'caustic_cracking', 'good_surface', 0.75, false, false, '["ut_paut"]', 'fluorescent_pt', null);

-- Slag Inclusions
insert into physics_method_mechanism_map (method_key, mechanism_key, detection_capability, confidence_rating, is_primary, is_sufficient_alone, complementary_methods, required_technique, code_requirement) values
  ('rt_film', 'slag_inclusion', 'excellent', 0.95, true, true, '[]', 'radiograph', 'ASME V Article 2'),
  ('rt_digital', 'slag_inclusion', 'excellent', 0.95, true, true, '[]', 'digital_radiograph', null),
  ('ut_paut', 'slag_inclusion', 'good', 0.75, false, true, '["rt_film"]', 'sector_scan', null);
