-- DEPLOY265: Physics Check Registry
-- Replaces hardcoded assessPhysicsCoverage() checks with a data-driven table.
-- Material class determines which physics checks apply. The spine queries this
-- table instead of running if-statements for each check type.
--
-- This permanently fixes the class of bugs where the spine doesn't know what
-- checks apply to a given material (composites, linings, refractories, etc.)
-- and either blocks forever or reports 100% coverage when it shouldn't.

-- ============================================================
-- TABLE 1: physics_check_registry
-- Each row = one physics check applicable to one material class.
-- ============================================================
create table if not exists physics_check_registry (
  id uuid default gen_random_uuid() primary key,
  check_id text not null,
  material_class text not null,
  code_ref text not null,
  check_description text not null,
  requirement_level text not null check (requirement_level in ('required', 'conditional', 'recommended')),
  trigger_condition text,
  missing_inputs_template jsonb not null default '[]',
  solver_status text not null default 'stub' check (solver_status in ('active', 'stub', 'planned')),
  solver_note text,
  evidence_type text check (evidence_type in ('photo', 'measurement', 'test_result', 'document', 'thickness', 'solver', null)),
  display_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_pcr_material on physics_check_registry(material_class);
create index if not exists idx_pcr_check_id on physics_check_registry(check_id);
create unique index if not exists idx_pcr_unique on physics_check_registry(check_id, material_class);

alter table physics_check_registry enable row level security;
create policy "physics_check_registry_read" on physics_check_registry for select using (true);

-- ============================================================
-- TABLE 2: physics_check_triggers
-- Maps trigger_condition values to case field checks.
-- The spine uses these to determine if a conditional check is required.
-- ============================================================
create table if not exists physics_check_triggers (
  id uuid default gen_random_uuid() primary key,
  trigger_name text not null unique,
  case_field text not null,
  match_type text not null check (match_type in ('regex', 'equals', 'greater_than', 'less_than', 'exists', 'finding_contains')),
  match_value text not null,
  description text not null,
  created_at timestamptz default now()
);

alter table physics_check_triggers enable row level security;
create policy "physics_check_triggers_read" on physics_check_triggers for select using (true);

-- ============================================================
-- TABLE 3: physics_check_audit
-- Logs each time the spine evaluates physics checks for a case.
-- ============================================================
create table if not exists physics_check_audit (
  id uuid default gen_random_uuid() primary key,
  case_id uuid not null,
  material_class text,
  checks_evaluated int not null default 0,
  required_count int not null default 0,
  runnable_count int not null default 0,
  recommended_count int not null default 0,
  coverage_pct numeric(5,4),
  registry_version text,
  evaluated_at timestamptz default now()
);

create index if not exists idx_pca_case on physics_check_audit(case_id);

alter table physics_check_audit enable row level security;
create policy "physics_check_audit_read" on physics_check_audit for select using (true);

-- ============================================================
-- SEED: Trigger conditions
-- These map trigger names to case field evaluations.
-- ============================================================
insert into physics_check_triggers (trigger_name, case_field, match_type, match_value, description) values
('method_is_ut', 'method', 'regex', '^[Uu][Tt]$', 'Inspection method is ultrasonic testing'),
('has_thickness_data', 'thickness_readings', 'exists', 'true', 'Thickness readings have been uploaded'),
('component_is_pressure', 'component_name', 'regex', 'pipe|vessel|tank|shell|header|riser|column|drum', 'Component name matches pressure equipment pattern'),
('finding_has_crack', 'findings', 'finding_contains', 'crack', 'At least one finding contains crack indication'),
('load_is_cyclic', 'load_condition', 'regex', 'cyclic|fatigue|pulsat|vibration', 'Load condition indicates cyclic/fatigue loading'),
('temp_above_370c', 'service_temperature_c', 'greater_than', '370', 'Service temperature exceeds creep threshold'),
('temp_above_200c', 'service_temperature_c', 'greater_than', '200', 'Service temperature exceeds oxidation threshold'),
('temp_below_minus20c', 'service_temperature_c', 'less_than', '-20', 'Service temperature below brittle transition concern'),
('has_coating', 'component_name', 'regex', 'coat|lined|lining|clad|overlay', 'Component involves coating or lining'),
('environment_is_corrosive', 'load_condition', 'regex', 'acid|chloride|sulfide|caustic|sour|amine|wet.*h2s', 'Environment indicates corrosive service'),
('has_refractory', 'component_name', 'regex', 'refractory|kiln|furnace|incinerator|duct.*hot|flue', 'Component has refractory lining'),
('is_composite', 'material_class', 'regex', 'composite|frp|grp|gfrp|cfrp|fiber.*reinf', 'Material is a fiber-reinforced composite'),
('is_polymer_lined', 'material_class', 'regex', 'rubber|ptfe|pvc|hdpe|pp.*lined|polymer|ebonite|flake.*glass', 'Material involves polymer or elastomer lining'),
('has_insulation', 'component_name', 'regex', 'insul|blanket|lagging|jacketed|cryogenic', 'Component has thermal insulation'),
('is_glass_lined', 'material_class', 'regex', 'glass.*lined|enamel|porcelain', 'Material is glass-lined or enameled');

-- ============================================================
-- SEED: Physics checks for CARBON STEEL
-- These replicate the existing hardcoded checks in decision-spine.ts
-- ============================================================
insert into physics_check_registry (check_id, material_class, code_ref, check_description, requirement_level, trigger_condition, missing_inputs_template, solver_status, solver_note, display_order) values
('wall_thickness_vs_nominal', 'carbon_steel', 'API 510 / API 570', 'Wall thickness measurement against nominal for general/localized corrosion assessment', 'conditional', 'method_is_ut', '["thickness_readings (upload UT grid or CML CSV on Evidence tab)"]', 'active', 'Evaluates min reading vs nominal, flags <80% for FFS review, <50% for reject', 1),
('wall_thickness_recommended', 'carbon_steel', 'API 510 / API 570', 'Wall thickness measurement recommended based on component type', 'recommended', 'component_is_pressure', '["thickness_readings recommended for this component type (upload UT grid or CML CSV on Evidence tab)"]', 'active', 'Advisory — does not block the spine', 2),
('crack_like_flaw_ffs', 'carbon_steel', 'API 579 Part 9', 'Crack-like flaw fitness-for-service assessment', 'conditional', 'finding_has_crack', '["crack length measurement","crack depth measurement","operating stress / load condition","material fracture toughness (KIC or CVN -> KIC)"]', 'stub', 'Solver slot reserved for FFS integration', 3),
('fatigue_life', 'carbon_steel', 'BS 7910 / ASME Sec VIII Div 2', 'Fatigue life assessment for cyclic loading conditions', 'conditional', 'load_is_cyclic', '["cycle count history","stress range per cycle","SN curve class / material fatigue properties"]', 'stub', 'Solver slot reserved for fatigue integration', 4),
('creep_damage', 'carbon_steel', 'API 579 Part 10', 'Creep damage assessment for high-temperature service', 'conditional', 'temp_above_370c', '["service temperature history","stress history","material creep rupture data (Larson-Miller constants)"]', 'stub', 'Solver slot reserved for creep integration', 5),
('wall_loss_severity', 'carbon_steel', 'API 579 Part 4 / Part 5', 'Remaining life calculation for components with measured wall loss', 'conditional', 'has_thickness_data', '["design pressure / MAWP","corrosion rate (mpy)","next planned shutdown date"]', 'stub', 'Solver slot for remaining life calculation', 6),
('brittle_fracture_risk', 'carbon_steel', 'API 579 Part 3 / ASME Sec VIII UCS-66', 'Brittle fracture screening for low-temperature or impact service', 'conditional', 'temp_below_minus20c', '["minimum design metal temperature (MDMT)","material impact test data (CVN)","operating pressure at low temperature"]', 'stub', 'Solver slot for brittle fracture screening', 7),
('corrosion_mechanism_id', 'carbon_steel', 'API 571 / API 580', 'Corrosion mechanism identification for corrosive service environments', 'conditional', 'environment_is_corrosive', '["process fluid composition","operating temperature range","flow velocity","historical corrosion rate data"]', 'stub', 'Links to chemical-process engine mechanism registry', 8);

-- ============================================================
-- SEED: Physics checks for STAINLESS STEEL (austenitic 304/316)
-- ============================================================
insert into physics_check_registry (check_id, material_class, code_ref, check_description, requirement_level, trigger_condition, missing_inputs_template, solver_status, solver_note, display_order) values
('wall_thickness_vs_nominal', 'stainless_steel', 'API 510 / API 570', 'Wall thickness measurement for corrosion assessment', 'conditional', 'method_is_ut', '["thickness_readings (upload UT grid or CML CSV on Evidence tab)"]', 'active', 'Same thickness engine as carbon steel', 1),
('wall_thickness_recommended', 'stainless_steel', 'API 510 / API 570', 'Wall thickness measurement recommended based on component type', 'recommended', 'component_is_pressure', '["thickness_readings recommended for this component type"]', 'active', 'Advisory only', 2),
('crack_like_flaw_ffs', 'stainless_steel', 'API 579 Part 9', 'Crack-like flaw FFS assessment', 'conditional', 'finding_has_crack', '["crack length measurement","crack depth measurement","operating stress / load condition","material fracture toughness"]', 'stub', 'Solver slot reserved', 3),
('chloride_scc_screening', 'stainless_steel', 'API 571 (4.5.1) / NACE MR0175', 'Chloride stress corrosion cracking screening for austenitic SS', 'conditional', 'environment_is_corrosive', '["chloride concentration (ppm)","operating temperature","residual stress state","sensitization history (welding, heat treatment)"]', 'stub', 'Critical for 304/316 in chloride service', 4),
('sensitization_check', 'stainless_steel', 'ASTM A262 / API 571', 'Intergranular corrosion / sensitization screening', 'conditional', 'temp_above_200c', '["time at temperature history","carbon content verification","stabilization heat treatment records"]', 'stub', 'Relevant for non-L grades or improperly heat-treated L grades', 5),
('fatigue_life', 'stainless_steel', 'BS 7910 / ASME Sec VIII Div 2', 'Fatigue life assessment', 'conditional', 'load_is_cyclic', '["cycle count history","stress range per cycle","SN curve class"]', 'stub', 'Solver slot reserved', 6),
('creep_damage', 'stainless_steel', 'API 579 Part 10', 'Creep damage assessment', 'conditional', 'temp_above_370c', '["service temperature history","stress history","creep rupture data"]', 'stub', 'Solver slot reserved', 7);

-- ============================================================
-- SEED: Physics checks for DUPLEX STAINLESS
-- ============================================================
insert into physics_check_registry (check_id, material_class, code_ref, check_description, requirement_level, trigger_condition, missing_inputs_template, solver_status, solver_note, display_order) values
('wall_thickness_vs_nominal', 'duplex_stainless', 'API 510 / API 570', 'Wall thickness measurement', 'conditional', 'method_is_ut', '["thickness_readings"]', 'active', 'Same engine as carbon steel', 1),
('phase_balance_check', 'duplex_stainless', 'ASTM E562 / ASTM A923', 'Ferrite/austenite phase balance verification', 'required', null, '["ferrite count (point count or magnetic method)","heat treatment records","weld procedure with ferrite prediction"]', 'stub', 'Critical — phase imbalance causes SCC and corrosion', 2),
('chloride_scc_screening', 'duplex_stainless', 'NACE MR0175 / API 571', 'Chloride SCC screening for duplex grades', 'conditional', 'environment_is_corrosive', '["chloride concentration (ppm)","operating temperature","PREN calculation verification"]', 'stub', 'Duplex more resistant than austenitic but not immune', 3),
('sigma_phase_embrittlement', 'duplex_stainless', 'API 571 (4.2.13)', 'Sigma phase embrittlement screening for high-temperature exposure', 'conditional', 'temp_above_200c', '["maximum temperature exposure history","time at temperature","impact test data post-exposure"]', 'stub', 'Sigma forms above ~300C, causes severe embrittlement', 4),
('crack_like_flaw_ffs', 'duplex_stainless', 'API 579 Part 9', 'Crack-like flaw FFS', 'conditional', 'finding_has_crack', '["crack length","crack depth","fracture toughness","operating stress"]', 'stub', 'Solver slot reserved', 5);

-- ============================================================
-- SEED: Physics checks for TITANIUM
-- ============================================================
insert into physics_check_registry (check_id, material_class, code_ref, check_description, requirement_level, trigger_condition, missing_inputs_template, solver_status, solver_note, display_order) values
('wall_thickness_vs_nominal', 'titanium', 'ASME Sec VIII / B31.3', 'Wall thickness measurement', 'conditional', 'method_is_ut', '["thickness_readings"]', 'active', 'Use appropriate UT velocity for titanium', 1),
('hydrogen_embrittlement_screen', 'titanium', 'ASTM F2066 / API 571', 'Hydrogen embrittlement and hydriding screening', 'required', null, '["hydrogen content analysis (vacuum hot extraction)","surface contamination visual check","process hydrogen partial pressure history"]', 'stub', 'Titanium absorbs hydrogen above ~80C, catastrophic failure risk', 2),
('contamination_check', 'titanium', 'AWS D1.9 / ASTM B265', 'Surface contamination assessment (oxygen, nitrogen pickup)', 'required', null, '["weld color inspection (gold/blue/white acceptable, gray/white-flaky reject)","trailing shield gas records","surface hardness readings near welds"]', 'stub', 'Alpha case formation from O2/N2 pickup makes titanium brittle', 3),
('crack_like_flaw_ffs', 'titanium', 'API 579 Part 9 (with Ti properties)', 'Crack-like flaw FFS', 'conditional', 'finding_has_crack', '["crack length","crack depth","fracture toughness (Ti-specific)","operating stress"]', 'stub', 'Must use titanium-specific fracture data', 4),
('fatigue_life', 'titanium', 'ASME Sec VIII Div 2', 'Fatigue life assessment', 'conditional', 'load_is_cyclic', '["cycle count","stress range","Ti fatigue curve"]', 'stub', 'Solver slot reserved', 5);

-- ============================================================
-- SEED: Physics checks for NICKEL ALLOY
-- ============================================================
insert into physics_check_registry (check_id, material_class, code_ref, check_description, requirement_level, trigger_condition, missing_inputs_template, solver_status, solver_note, display_order) values
('wall_thickness_vs_nominal', 'nickel_alloy', 'ASME Sec VIII / B31.3', 'Wall thickness measurement', 'conditional', 'method_is_ut', '["thickness_readings"]', 'active', 'Appropriate UT velocity for nickel alloy', 1),
('hot_cracking_screen', 'nickel_alloy', 'API 571 / AWS / ASME IX', 'Hot cracking susceptibility screening for weld zones', 'required', null, '["weld procedure (heat input, interpass temperature)","filler metal composition (Nb, Si, S, P content)","restraint condition assessment"]', 'stub', 'Ni alloys highly susceptible to solidification and DDC cracking', 2),
('creep_damage', 'nickel_alloy', 'API 579 Part 10', 'Creep damage assessment', 'conditional', 'temp_above_370c', '["service temperature history","stress history","alloy-specific creep rupture data"]', 'stub', 'Solver slot reserved', 3),
('crack_like_flaw_ffs', 'nickel_alloy', 'API 579 Part 9', 'Crack-like flaw FFS', 'conditional', 'finding_has_crack', '["crack length","crack depth","fracture toughness","operating stress"]', 'stub', 'Solver slot reserved', 4),
('corrosion_mechanism_id', 'nickel_alloy', 'API 571 / API 580', 'Corrosion mechanism ID for corrosive service', 'conditional', 'environment_is_corrosive', '["process fluid composition","temperature range","velocity","historical corrosion data"]', 'stub', 'Links to chemical-process engine', 5);

-- ============================================================
-- SEED: Physics checks for ALUMINUM
-- ============================================================
insert into physics_check_registry (check_id, material_class, code_ref, check_description, requirement_level, trigger_condition, missing_inputs_template, solver_status, solver_note, display_order) values
('wall_thickness_vs_nominal', 'aluminum', 'AWS D1.2 / ASME Sec VIII', 'Wall thickness measurement', 'conditional', 'method_is_ut', '["thickness_readings"]', 'active', 'Appropriate UT velocity for aluminum', 1),
('wall_thickness_recommended', 'aluminum', 'AWS D1.2', 'Wall thickness recommended for structural aluminum', 'recommended', 'component_is_pressure', '["thickness_readings recommended for this component type"]', 'active', 'Advisory only', 2),
('fatigue_life', 'aluminum', 'BS 7910 / Eurocode 9', 'Fatigue life assessment — aluminum has no fatigue endurance limit', 'conditional', 'load_is_cyclic', '["cycle count history","stress range per cycle","aluminum SN curve class"]', 'stub', 'CRITICAL: aluminum has no endurance limit — all cyclic loading accumulates damage', 3),
('crack_like_flaw_ffs', 'aluminum', 'BS 7910 (aluminum annex)', 'Crack-like flaw FFS', 'conditional', 'finding_has_crack', '["crack length","crack depth","aluminum fracture toughness","operating stress"]', 'stub', 'Must use aluminum-specific fracture data', 4);

-- ============================================================
-- SEED: Physics checks for COMPOSITE / FRP / GRP
-- ============================================================
insert into physics_check_registry (check_id, material_class, code_ref, check_description, requirement_level, trigger_condition, missing_inputs_template, solver_status, solver_note, display_order) values
('visual_damage_assessment', 'composite', 'ASME RTP-1 / ASTM D2563', 'Visual inspection for delamination, fiber exposure, blistering, crazing, discoloration', 'required', null, '["surface condition photos","delamination map (location, area)","fiber exposure assessment","blister count and size"]', 'stub', 'Primary inspection method for composites', 1),
('barcol_hardness', 'composite', 'ASTM D2583', 'Barcol hardness measurement to assess resin degradation', 'required', null, '["Barcol readings (minimum 5 per zone)","baseline Barcol from fabrication records","resin type and cure schedule"]', 'stub', 'Drop in Barcol indicates resin degradation, chemical attack, or under-cure', 2),
('acoustic_emission_delam', 'composite', 'ASTM E1067 / ASME RTP-1 NM-3', 'Acoustic emission testing for delamination and structural damage', 'recommended', null, '["AE sensor placement map","load application method","AE event count and amplitude data"]', 'stub', 'Best non-visual method for detecting internal composite damage', 3),
('flexural_stiffness', 'composite', 'ASTM D790 / ASME RTP-1', 'Flexural stiffness measurement to assess structural degradation', 'conditional', 'load_is_cyclic', '["deflection measurements under known load","original design deflection limit","span and support conditions"]', 'stub', 'Stiffness loss indicates matrix cracking or fiber damage', 4),
('chemical_resistance_check', 'composite', 'ASME RTP-1 / ASTM C581', 'Chemical resistance verification after chemical exposure event', 'conditional', 'environment_is_corrosive', '["chemical exposure history","resin type vs chemical compatibility table","inner surface condition (corrosion barrier intact?)"]', 'stub', 'FRP corrosion barrier is the critical first defense', 5),
('thickness_measurement', 'composite', 'ASME RTP-1', 'Laminate thickness measurement (UT or direct measurement)', 'recommended', 'component_is_pressure', '["laminate thickness readings","design minimum thickness","corrosion barrier thickness"]', 'stub', 'Different technique than metal UT — requires composite-calibrated probe', 6);

-- ============================================================
-- SEED: Physics checks for LINED SYSTEMS (rubber, PTFE, polymer)
-- ============================================================
insert into physics_check_registry (check_id, material_class, code_ref, check_description, requirement_level, trigger_condition, missing_inputs_template, solver_status, solver_note, display_order) values
('lining_integrity_spark', 'lined_system', 'NACE SP0188 / ASTM D5162', 'Holiday/spark test to detect lining breaches', 'required', null, '["spark test voltage setting","holiday map (location, count)","lining type and thickness"]', 'stub', 'Primary method — any holiday exposes substrate to corrosion', 1),
('lining_adhesion', 'lined_system', 'ASTM D4541 / ASTM D3359', 'Lining adhesion pull-off or cross-cut test', 'required', null, '["adhesion test results (psi or rating)","test location map","acceptance criteria for lining type"]', 'stub', 'Disbonded lining traps corrosive fluid against substrate', 2),
('substrate_ut', 'lined_system', 'API 510 / API 570', 'Substrate wall thickness through or adjacent to lining', 'recommended', null, '["substrate thickness readings (may require lining removal at test points)","nominal substrate thickness","historical corrosion rate at holidays"]', 'active', 'Check substrate under any known lining holidays', 3),
('thermal_degradation_screen', 'lined_system', 'Manufacturer specs / NACE SP0188', 'Thermal degradation screening after temperature excursion', 'conditional', 'temp_above_200c', '["maximum temperature exposure","lining rated temperature","visual assessment for discoloration, bubbling, softening"]', 'stub', 'Polymer linings have strict temperature limits', 4),
('chemical_attack_screen', 'lined_system', 'NACE SP0188 / manufacturer compatibility', 'Chemical compatibility verification after upset exposure', 'conditional', 'environment_is_corrosive', '["chemical exposure details","lining material compatibility chart","swell/hardness change measurements"]', 'stub', 'Wrong chemical + wrong lining = rapid failure', 5);

-- ============================================================
-- SEED: Physics checks for GLASS-LINED systems
-- ============================================================
insert into physics_check_registry (check_id, material_class, code_ref, check_description, requirement_level, trigger_condition, missing_inputs_template, solver_status, solver_note, display_order) values
('spark_test', 'glass_lined', 'DIN 28060 / ASTM C537', 'High-voltage spark test for glass lining defects', 'required', null, '["spark test voltage (typically 5-20kV)","defect map (chips, cracks, pinholes)","test coverage area"]', 'stub', 'Any glass lining defect exposes carbon steel substrate to process fluid', 1),
('visual_chip_crack', 'glass_lined', 'DIN 28060 / Pfaudler standards', 'Visual inspection for mechanical damage — chips, cracks, spalling', 'required', null, '["surface photos with scale reference","chip/crack map with dimensions","impact history (thermal shock, mechanical impact)"]', 'stub', 'Glass lining is brittle — thermal shock is the #1 damage mechanism', 2),
('substrate_corrosion', 'glass_lined', 'API 510', 'Substrate corrosion assessment at known glass defects', 'conditional', 'has_thickness_data', '["substrate thickness at defect locations","corrosion product analysis","time since defect was first noted"]', 'active', 'Corrosion at holidays can undermine adjacent glass', 3),
('thermal_shock_assessment', 'glass_lined', 'DIN 28060', 'Thermal shock damage assessment', 'conditional', 'temp_above_200c', '["temperature change rate during event","glass lining type and rated thermal shock","location of thermal shock exposure"]', 'stub', 'Rapid cooling (>50C in minutes) can crack glass lining', 4);

-- ============================================================
-- SEED: Physics checks for REFRACTORY-LINED systems
-- ============================================================
insert into physics_check_registry (check_id, material_class, code_ref, check_description, requirement_level, trigger_condition, missing_inputs_template, solver_status, solver_note, display_order) values
('refractory_thickness', 'refractory', 'API 936 / ASTM C704', 'Refractory lining thickness measurement (IR thermography or UT)', 'required', null, '["IR thermography scan or direct UT thickness","original lining thickness","hot-face temperature readings"]', 'stub', 'Hot spots on shell indicate refractory thinning', 1),
('hot_spot_mapping', 'refractory', 'API 936', 'Shell hot spot survey using IR thermography', 'required', null, '["IR scan of entire vessel shell","ambient temperature at time of scan","process temperature during scan","hot spot map with temperatures"]', 'stub', 'Shell temperature above design indicates refractory failure', 2),
('anchor_integrity', 'refractory', 'API 936 / manufacturer specs', 'Refractory anchor system integrity check', 'recommended', null, '["anchor type and spacing","visual inspection at exposed anchors","shell deformation near anchor points"]', 'stub', 'Anchor failure leads to refractory spalling and detachment', 3),
('thermal_shock_damage', 'refractory', 'ASTM C1171', 'Thermal shock spalling assessment', 'conditional', 'temp_above_200c', '["temperature excursion rate","refractory type and thermal shock rating","visual inspection for spalling, cracking"]', 'stub', 'Rapid cooldown or water ingress causes explosive spalling', 4),
('substrate_shell_ut', 'refractory', 'API 510 / API 579', 'Substrate shell thickness at known refractory failures', 'conditional', 'has_thickness_data', '["shell UT readings at hot spots","nominal shell thickness","corrosion rate estimate"]', 'active', 'Refractory failure exposes shell to process temperature', 5);

-- ============================================================
-- SEED: Physics checks for COPPER (water-cooled panels, etc.)
-- ============================================================
insert into physics_check_registry (check_id, material_class, code_ref, check_description, requirement_level, trigger_condition, missing_inputs_template, solver_status, solver_note, display_order) values
('wall_thickness_vs_nominal', 'copper', 'ASME Sec VIII / ASTM B152', 'Wall thickness measurement for erosion/corrosion assessment', 'conditional', 'method_is_ut', '["thickness_readings (copper-calibrated UT)"]', 'active', 'Requires copper-specific UT velocity calibration', 1),
('cooling_channel_integrity', 'copper', 'Manufacturer specs', 'Cooling channel flow and leak test', 'required', null, '["pressure/leak test results","flow rate measurements","inlet/outlet temperature differential"]', 'stub', 'Cooling channel breach in service = steam explosion risk', 2),
('erosion_wear_pattern', 'copper', 'API 571 (erosion)', 'Erosion wear pattern assessment from high-velocity flow or particles', 'recommended', null, '["surface profile measurements","wear pattern photos","flow velocity and particle content history"]', 'stub', 'Copper panels in steel plants see severe erosion from slag/metal splash', 3),
('thermal_fatigue_check', 'copper', 'ASME Sec VIII Div 2', 'Thermal fatigue assessment from cyclic heating/cooling', 'conditional', 'load_is_cyclic', '["thermal cycle count","temperature range per cycle","copper fatigue data"]', 'stub', 'Repeated heating/quenching causes thermal fatigue cracking', 4);

-- ============================================================
-- SEED: Physics checks for CERAMIC FIBER insulation
-- ============================================================
insert into physics_check_registry (check_id, material_class, code_ref, check_description, requirement_level, trigger_condition, missing_inputs_template, solver_status, solver_note, display_order) values
('visual_condition', 'ceramic_fiber', 'ASTM C892 / manufacturer specs', 'Visual assessment for shrinkage, devitrification, erosion, mechanical damage', 'required', null, '["surface condition photos","shrinkage gap measurements","evidence of devitrification (hard, glossy surface)"]', 'stub', 'Ceramic fiber degrades permanently above rated temperature', 1),
('thickness_remaining', 'ceramic_fiber', 'ASTM C892', 'Remaining insulation thickness measurement', 'required', null, '["thickness measurements at multiple points","original installed thickness","shrinkage percentage"]', 'stub', 'Shrinkage above 3-5% indicates overtemperature exposure', 2),
('thermal_performance', 'ceramic_fiber', 'ASTM C177 / ASTM C335', 'Thermal conductivity / performance verification', 'recommended', null, '["shell temperature survey","process temperature","original design shell temperature limit"]', 'stub', 'Degraded fiber has higher conductivity = higher shell temps', 3);

-- ============================================================
-- SEED: Physics checks for COATING SYSTEMS (external protective)
-- ============================================================
insert into physics_check_registry (check_id, material_class, code_ref, check_description, requirement_level, trigger_condition, missing_inputs_template, solver_status, solver_note, display_order) values
('coating_condition_visual', 'coating', 'SSPC-PA 2 / ISO 8501 / NACE SP0188', 'Visual coating condition assessment — chalking, cracking, blistering, rust-through', 'required', null, '["coating condition photos per ASTM D714 (blistering) / D610 (rusting)","chalking grade per ASTM D4214","coating type and original DFT"]', 'stub', 'Primary assessment — sets the scope for all other coating checks', 1),
('dft_measurement', 'coating', 'SSPC-PA 2 / ISO 19840', 'Dry film thickness measurement to assess erosion and wear', 'required', null, '["DFT readings (magnetic or eddy current gauge)","original specified DFT range","measurement grid map"]', 'stub', 'Low DFT indicates erosion, weathering, or insufficient original application', 2),
('adhesion_test', 'coating', 'ASTM D4541 / ASTM D3359', 'Coating adhesion pull-off or cross-cut test', 'recommended', null, '["pull-off adhesion results (psi)","test location map","cohesive vs adhesive failure mode"]', 'stub', 'Adhesion loss precedes disbonding and coating failure', 3),
('holiday_detection', 'coating', 'NACE SP0188 / ASTM D5162', 'Holiday/spark test for immersion or buried service coatings', 'conditional', 'has_coating', '["holiday test voltage","holiday count and location map","coating type"]', 'stub', 'Critical for submerged or buried service — every holiday is a corrosion initiation site', 4),
('cp_interaction_check', 'coating', 'NACE SP0169 / DNV-RP-B401', 'Cathodic protection interaction assessment — disbonding risk from CP overprotection', 'conditional', 'has_coating', '["CP potential readings at coating holidays","coating type vs CP compatibility","any evidence of cathodic disbonding"]', 'stub', 'Overprotection causes hydrogen evolution under coating = disbonding', 5);

-- ============================================================
-- SEED: Default / unknown material fallback
-- When material_class doesn't match any seeded rows, these generic
-- checks ensure the spine doesn't return "no checks required" when
-- it genuinely doesn't know.
-- ============================================================
insert into physics_check_registry (check_id, material_class, code_ref, check_description, requirement_level, trigger_condition, missing_inputs_template, solver_status, solver_note, display_order) values
('visual_inspection_general', 'unknown', 'General practice', 'General visual inspection for obvious damage, distortion, leakage', 'required', null, '["visual inspection photos","damage map with dimensions","comparison to baseline condition"]', 'stub', 'Always applicable regardless of material', 1),
('material_verification', 'unknown', 'ASTM E1476 / PMI', 'Positive material identification to confirm actual material class', 'required', null, '["PMI readings (XRF or OES)","material certificate review","comparison to specified material"]', 'stub', 'Must verify material before selecting material-specific checks', 2),
('dimensional_check', 'unknown', 'General practice', 'Dimensional check for distortion, bulging, sagging, misalignment', 'recommended', null, '["dimensional survey results","original design dimensions","distortion measurements"]', 'stub', 'Thermal excursions and overpressure cause permanent deformation', 3);
