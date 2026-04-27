-- ============================================================================
-- Contextual Failure Intelligence Layer - Complete Schema & Seed Data
-- Supabase Migration: CFI-SCHEMA-SEED.sql
-- ============================================================================

-- ============================================================================
-- PART 1: SCHEMA SETUP
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE 1: cfi_context_patterns
-- ============================================================================

CREATE TABLE IF NOT EXISTS cfi_context_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  component TEXT,
  location_context TEXT NOT NULL,
  geometry_context TEXT,
  material TEXT,
  coating_context TEXT,
  insulation_context TEXT,
  environment_context TEXT,
  process_context TEXT,
  loading_context TEXT,
  common_failure_modes TEXT[],
  likely_damage_mechanisms TEXT[],
  primary_ndt_methods TEXT[],
  secondary_ndt_methods TEXT[],
  evidence_required TEXT[],
  risk_indicators TEXT[],
  escalation_triggers TEXT[],
  recommended_actions TEXT[],
  prevention_actions TEXT[],
  severity_default TEXT CHECK (severity_default IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  confidence_weight NUMERIC DEFAULT 0.70,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- TABLE 2: cfi_case_findings
-- ============================================================================

CREATE TABLE IF NOT EXISTS cfi_case_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL,
  pattern_id UUID REFERENCES cfi_context_patterns(id),
  asset_id UUID,
  observed_context JSONB NOT NULL,
  matched_failure_modes TEXT[],
  matched_damage_mechanisms TEXT[],
  recommended_ndt_methods TEXT[],
  missing_evidence TEXT[],
  risk_score NUMERIC,
  severity TEXT,
  system_reasoning TEXT,
  inspector_override JSONB,
  final_disposition TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- TABLE 3: cfi_feedback_events
-- ============================================================================

CREATE TABLE IF NOT EXISTS cfi_feedback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL,
  finding_id UUID REFERENCES cfi_case_findings(id),
  inspector_action TEXT,
  inspector_notes TEXT,
  confirmed_failure_modes TEXT[],
  rejected_failure_modes TEXT[],
  confirmed_mechanisms TEXT[],
  missed_context_tags TEXT[],
  model_adjustment JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_cfi_patterns_domain
  ON cfi_context_patterns(domain);

CREATE INDEX IF NOT EXISTS idx_cfi_patterns_asset_type
  ON cfi_context_patterns(asset_type);

CREATE INDEX IF NOT EXISTS idx_cfi_patterns_location_context
  ON cfi_context_patterns(location_context);

CREATE INDEX IF NOT EXISTS idx_cfi_patterns_component
  ON cfi_context_patterns(component);

CREATE INDEX IF NOT EXISTS idx_cfi_patterns_failure_modes
  ON cfi_context_patterns USING GIN(common_failure_modes);

CREATE INDEX IF NOT EXISTS idx_cfi_patterns_damage_mechanisms
  ON cfi_context_patterns USING GIN(likely_damage_mechanisms);

CREATE INDEX IF NOT EXISTS idx_cfi_findings_case_id
  ON cfi_case_findings(case_id);

CREATE INDEX IF NOT EXISTS idx_cfi_findings_pattern_id
  ON cfi_case_findings(pattern_id);

CREATE INDEX IF NOT EXISTS idx_cfi_feedback_case_id
  ON cfi_feedback_events(case_id);

CREATE INDEX IF NOT EXISTS idx_cfi_feedback_finding_id
  ON cfi_feedback_events(finding_id);

-- ============================================================================
-- TRIGGER FUNCTION: Update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_cfi_patterns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cfi_patterns_updated_at_trigger
BEFORE UPDATE ON cfi_context_patterns
FOR EACH ROW
EXECUTE FUNCTION update_cfi_patterns_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE cfi_context_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfi_case_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfi_feedback_events ENABLE ROW LEVEL SECURITY;

-- Permissive policies for authenticated users
CREATE POLICY "Allow authenticated users to view patterns"
  ON cfi_context_patterns FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert patterns"
  ON cfi_context_patterns FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update patterns"
  ON cfi_context_patterns FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to view findings"
  ON cfi_case_findings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert findings"
  ON cfi_case_findings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to view feedback"
  ON cfi_feedback_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert feedback"
  ON cfi_feedback_events FOR INSERT
  TO authenticated
  WITH CHECK (true);


INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'piping', 'carbon_steel_pipe', 'support_interface', 'pipe_at_support', 'curved_contact_surface', 'A106 Grade B', 'external_epoxy_coating', NULL, 'industrial_humid', NULL, 'static_load_vibration', ARRAY['External corrosion','Coating breakdown','Crevice corrosion'], ARRAY['Uniform corrosion','Crevice attack','Disbonded coating'], ARRAY['UT thickness mapping','PAUT','Visual inspection'], ARRAY['PEC','Thermography'], ARRAY['Wall thickness variation','Coating condition','Pitting depth','Corrosion product buildup'], ARRAY['Yellow/brown deposits','Coating lifting','Rust bleeding','Active staining'], ARRAY['UT reading <0.100 in nominal','Multiple pits >0.050 in deep','Coating loss >5% area'], ARRAY['Clean support surface quarterly','Improve drainage','Apply touch-up coating','Replace riser clamp'], ARRAY['Elevated drain holes','Stainless steel clamps','High-build epoxy','CUI mitigation coating'], 'HIGH', 0.82
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'piping', 'carbon_steel_pipe', 'dead_leg', 'piping_low_point', 'vertical_low_point', 'A106 Grade B', 'internal_mill_scale', NULL, 'stagnant_water', 'cooling_water_system', 'static', ARRAY['Internal corrosion','MIC','Under-deposit attack'], ARRAY['Microbial corrosion','Pitting','Stagnant water attack'], ARRAY['UT thickness mapping','Profile radiography','Guided wave UT'], ARRAY['Deposit sampling','Water chemistry'], ARRAY['Wall thickness loss','Localized pitting','Deposits present','Biological signatures'], ARRAY['Black deposits','Hydrogen sulfide odor','Localized staining','Texture change'], ARRAY['UT reading <0.090 in','Pit depth >0.080 in','Biological activity confirmed'], ARRAY['Install flush connection','Increase circulation','Biocide treatment','Increase blowdown'], ARRAY['Eliminate low points','Add sloped drains','Improve water treatment','Cathodic protection'], 'HIGH', 0.8
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'piping', 'carbon_steel_pipe', 'elbow', 'piping_elbow_downstream', 'bend_radius_downstream', 'A106 Grade B', 'mill_scale_external', NULL, 'turbulent_flow_zone', 'two_phase_flow', 'flow_erosion', ARRAY['Erosion','Flow-assisted corrosion','Thinning'], ARRAY['Erosion-corrosion','FAC mechanism','Accelerated wall loss'], ARRAY['UT grid mapping','PAUT','Radiography profile'], ARRAY['Profile RT','Thermography'], ARRAY['Wall thickness gradient','Erosion pattern','Surface roughness','Flow direction indicators'], ARRAY['Elliptical wear pattern','Upstream side thinner','Smooth surface','No pitting'], ARRAY['UT thickness trending <0.120 in','Localized thinning >0.050 in','Non-random pattern'], ARRAY['Replace with WC coated elbow','Install flow management device','Increase inspection frequency','Isolate line'], ARRAY['Use erosion-resistant elbows','Optimize flow velocity','Material upgrade to stainless','Add erosion shields'], 'HIGH', 0.83
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'piping', 'carbon_steel_pipe', 'small_bore_connection', 'small_bore_vibration', 'high_stress_concentration', 'A106 Grade B', NULL, NULL, 'vibrating_equipment', 'pump_discharge', 'vibration_cyclic_stress', ARRAY['Fatigue cracking','Thread root cracking','Vibration fatigue'], ARRAY['Stress concentration','Vibration-induced fatigue','Crack initiation at root'], ARRAY['Magnetic particle inspection','PT','PAUT'], ARRAY['Vibration survey','Acoustic emission'], ARRAY['Crack indications','Surface finish','Vibration amplitude','Stress concentration factor'], ARRAY['Fine crack network','Root area involvement','Visible deformation','Metal fatigue sounds'], ARRAY['MT indication >1.0 in length','Vibration >0.5 in/sec','Multiple indications clustered'], ARRAY['Replace small-bore tubing','Install vibration dampers','Support with better clamps','Upgrade to seamless tube'], ARRAY['Isolate vibration sources','Use flexible hose sections','Proper support spacing','Stress relief bends'], 'CRITICAL', 0.85
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'piping', 'carbon_steel_pipe', 'clamp_interface', 'pipe_at_clamp', 'contact_surface', 'A106 Grade B', 'external_epoxy', NULL, 'humid_weather', NULL, 'vibration_support_load', ARRAY['Coating damage','Fretting corrosion','Crevice attack'], ARRAY['Mechanical abrasion','Crevice corrosion under clamp','Coating disbondment'], ARRAY['Visual inspection','UT thickness','PEC'], ARRAY['Eddy current','Ultrasonic'], ARRAY['Coating condition','Clamp tightness','Surface corrosion','Contact area wear'], ARRAY['Coating loss at contact','Surface rust staining','Visible corrosion product','Loose clamp'], ARRAY['Coating breached >0.5 in','UT reading >0.015 in loss','Corrosion staining >2 in'], ARRAY['Paint and clamp touch-up','Increase inspection frequency','Replace corroded clamp','Add shim'], ARRAY['Use stainless clamps','Apply corrosion inhibitor','Install clamp insulators','Improve drainage'], 'MEDIUM', 0.75
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'piping', 'stainless_steel_pipe', 'weld_haz', 'weld_haz_corrosive', 'weld_heat_affected_zone', 'A312 TP316', NULL, NULL, 'corrosive_chemical', 'acidic_service', 'pressure_cycling', ARRAY['HAZ cracking','Sensitization','Intergranular corrosion'], ARRAY['Sensitization from welding','Intergranular attack','Stress-assisted cracking'], ARRAY['PAUT/TOFD','MT/PT','Hardness testing'], ARRAY['Metallography','Electrochemistry'], ARRAY['Weld geometry','Hardness profile','Chromium depletion','Crack indications'], ARRAY['HAZ discoloration','Visible cracks','Color change in HAZ','Pitting near weld'], ARRAY['PT indication >0.5 in','Hardness >350 HV','Sensitization curves positive'], ARRAY['PWHT if feasible','Low-carbon grade replacement','Nitric acid passivation','Remove weld heat tint'], ARRAY['Use ER316L electrode','PWHT all welds','Minimize heat input','Argon shielding throughout'], 'CRITICAL', 0.88
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'piping', 'carbon_steel_pipe', 'injection_quill', 'injection_point', 'quill_tip_zone', 'A106 Grade B', 'mill_scale', NULL, 'chemical_injection_zone', 'corrosive_chemical_flow', 'turbulent_injection', ARRAY['Localized corrosion','Erosion at jet impingement','Pitting'], ARRAY['Jet impingement corrosion','Localized erosion-corrosion','Cavitation pitting'], ARRAY['UT thickness mapping','Radiography','Corrosion monitoring probe'], ARRAY['Deposit analysis','On-line coupon monitoring'], ARRAY['Wall thickness distribution','Erosion pattern','Quill condition','Flow characteristics'], ARRAY['Erosion cone pattern','Localized thinning','Black deposits','Impingement signature'], ARRAY['UT >0.050 in localized loss','Pit depth >0.100 in','Erosion pattern distinct'], ARRAY['Replace carbon steel quill','Install diffuser at quill tip','Change chemical injection point','Use erosion-resistant material'], ARRAY['Optimize quill design','Lower injection pressure','Use stainless steel component','Install erosion shields'], 'HIGH', 0.84
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'piping', 'carbon_steel_pipe', 'insulated_section', 'pipe_under_insulation', 'insulation_covered_pipe', 'A106 Grade B', 'insulation_contact', 'glass_fiber_mineral', 'moisture_under_insulation', NULL, 'thermal_cycling', ARRAY['CUI','Under-insulation corrosion','Accelerated attack'], ARRAY['Pitting under insulation','Crevice corrosion','Water ingress driven'], ARRAY['PEC scanning','Radiography profile','Thermography','Strip-and-inspect'], ARRAY['Visual inspection','Ultrasonic thickness'], ARRAY['Insulation condition','Moisture presence','Wall thickness','Coating under insulation'], ARRAY['Wet insulation','Dark stains on jacket','Visible corrosion under jacket','Water ingress'], ARRAY['PEC signal >15% loss','UT reading <0.080 in','Pit depth >0.075 in confirmed'], ARRAY['Remove and replace insulation','Apply CUI protective coating','Install insulation jacketing','Increase inspection scope'], ARRAY['Use CUI-resistant coating','Install insulation support systems','Improve drainage design','Polyurethane foam wrap'], 'CRITICAL', 0.87
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'piping', 'stainless_steel_pipe', 'penetration', 'pipe_at_penetration', 'wall_floor_roof_hole', 'A312 TP304', 'external_epoxy', NULL, 'exterior_wet', NULL, 'static_load', ARRAY['Corrosion at edge','Stress concentration','Crevice attack'], ARRAY['Galvanic corrosion','Crevice attack at seal','Mechanical stress'], ARRAY['Visual inspection','UT thickness','MT/PT'], ARRAY['Eddy current','Pit depth gauge'], ARRAY['Seal condition','Edge corrosion','Stress concentration','Material compatibility'], ARRAY['Visible corrosion at penetration','Seal degradation','Water ingress','Staining pattern'], ARRAY['UT loss >0.020 in','Pit depth >0.050 in','Seal compromised >0.5 in'], ARRAY['Re-seal penetration','Upgrade seal material','Apply epoxy coating','Install backing ring'], ARRAY['Use compatible sealant','Stainless sleeves for penetrations','Improved drainage','Regular resealing schedule'], 'MEDIUM', 0.72
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'piping', 'carbon_steel_pipe', 'expansion_loop', 'pipe_expansion_loop', 'loop_structure', 'A106 Grade B', 'mill_scale_external', NULL, 'high_temperature_cycling', 'thermal_expansion', 'cyclic_thermal_stress', ARRAY['Fatigue cracking','Thermal stress cracking','Vibration fatigue'], ARRAY['Stress concentration at loop','Cyclic loading fatigue','Thermal gradient stress'], ARRAY['PAUT','Strain measurement','Visual inspection'], ARRAY['Profile radiography','Thermography'], ARRAY['Pipe geometry','Support conditions','Temperature cycling','Crack indications'], ARRAY['Visible cracks','Permanent deformation','Loose supports','Metal fatigue surfaces'], ARRAY['PT indication >1.0 in','Permanent set >0.25 in','Support deflection >0.5 in'], ARRAY['Reinforce loop design','Add intermediate support','Stress relief heat treat','Replace with flexible hose'], ARRAY['Design per ASME B31.1','Proper anchor placement','Spring support installation','Thermal design review'], 'HIGH', 0.78
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'piping', 'carbon_steel_pipe', 'threaded_joint', 'pipe_threaded', 'thread_root_area', 'A106 Grade B', 'mill_scale_threads', NULL, 'vibration_environment', 'threaded_connection', 'cyclic_vibration_load', ARRAY['Thread root cracking','Fatigue cracking','Leakage'], ARRAY['Fatigue crack initiation','Stress concentration at root','Vibration-assisted cracking'], ARRAY['MT/PT','UT thread inspection','Visual inspection'], ARRAY['Leak test','Acoustic emission'], ARRAY['Thread geometry','Crack indications','Surface finish','Vibration amplitude'], ARRAY['Fine cracks at root','Leak seepage','Visible surface cracking','Metal fatigue appearance'], ARRAY['MT indication >0.5 in','Active leak present','Vibration >0.3 in/sec at joint'], ARRAY['Replace threaded joint','Install vibration dampers','Upgrade to welded connection','Add locking device'], ARRAY['Use welded connections','Thread lock compound','Stress relief threads','Isolate vibration source'], 'HIGH', 0.76
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'piping', 'carbon_steel_pipe', 'branch_connection', 'pipe_branch', 'branch_reinforcement_pad', 'A106 Grade B', 'mill_scale_external', NULL, 'industrial', 'multi-phase_flow', 'pressure_cyclic', ARRAY['Stress corrosion cracking','Fatigue cracking','Erosion'], ARRAY['Stress concentration','Cyclic loading','Flow-induced vibration'], ARRAY['PAUT','UT thickness','MT/PT'], ARRAY['Radiography','Profile inspection'], ARRAY['Pad geometry','Weld quality','Crack indications','Wall thickness'], ARRAY['Visible cracks in pad','Corrosion staining','Surface defects','Thinning on downstream'], ARRAY['PT indication >0.75 in','UT reading <0.100 in nominal','Pad disbondment >1 in'], ARRAY['Replace branch with new pad','Upgrade reinforcement','Stress relief','Add support'], ARRAY['Use heavier pad thickness','Improve weld quality','Stress relieve branches','Optimize geometry'], 'HIGH', 0.79
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'piping', 'carbon_steel_pipe', 'downstream_valve', 'pipe_at_valve', 'control_valve_outlet', 'A106 Grade B', 'mill_scale_external', NULL, 'throttling_service', 'pressure_reducing_valve', 'turbulent_downstream', ARRAY['Erosion','Cavitation erosion','Pitting'], ARRAY['Cavitation damage','Jet erosion','Localized material removal'], ARRAY['UT grid mapping','Radiography','Visual inspection'], ARRAY['Profile RT','Eddy current'], ARRAY['Erosion pattern','Wall thickness variation','Surface condition','Valve performance'], ARRAY['Erosion cone pattern','Smooth worn surface','Material loss asymmetric','Pitting'], ARRAY['UT loss >0.060 in localized','Erosion pit >0.100 in deep','Pattern distinct downstream'], ARRAY['Install erosion resistant trim','Add cage to valve','Increase pipe diameter','Change valve type'], ARRAY['Use trimmed control valves','Optimize pressure drop stages','Add swirl breakers','Install drain'], 'HIGH', 0.77
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'piping', 'carbon_steel_pipe', 'buried_transition', 'pipe_buried_transition', 'above_ground_to_buried', 'A106 Grade B', 'external_epoxy_coating', NULL, 'wet_soil_above_grade', NULL, 'static_load', ARRAY['External corrosion','Coating failure','Crevice attack'], ARRAY['Coating disbondment','Soil-side corrosion','Water ingress'], ARRAY['DCVG/ACVG survey','PEC scanning','Close interval survey'], ARRAY['Visual inspection','Soil resistivity test'], ARRAY['Coating condition','Potential survey','Soil characteristics','Water content'], ARRAY['Coating lifting','Visible corrosion','Holiday detected','Dark staining'], ARRAY['Holiday >0.5 in','Potential <-750 mV CSE','Corrosion staining >1 in'], ARRAY['Repair coating','Install CP anode nearby','Increase monitoring','Relocate if possible'], ARRAY['Improve coating system','Install sloped transition','Add drainage system','CP protection'], 'HIGH', 0.81
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'piping', 'carbon_steel_pipe', 'flange_assembly', 'pipe_at_flange', 'flange_face_assembly', 'A106 Grade B', 'external_paint', NULL, 'wet_environment', NULL, 'pressure_vibration', ARRAY['Gasket degradation','Bolt corrosion','Flange face attack'], ARRAY['Gasket creep','Bolt stress relaxation','Corrosion of bolts'], ARRAY['Visual inspection','UT bolt thickness','Leak test'], ARRAY['Thermography','Bolt tension measurement'], ARRAY['Gasket condition','Bolt status','Corrosion product','Leak indicators'], ARRAY['Visible gasket extrusion','Corroded bolts','Active leaking','Deposits around flange'], ARRAY['Active leak >drops/min','Bolt corrosion >25%','Gasket extrusion >0.5 in'], ARRAY['Replace gasket','Replace corroded bolts','Re-torque bolts','Upgrade bolt material'], ARRAY['Use stainless bolts','Apply anti-seize compound','Better gasket material','Regular re-torque schedule'], 'MEDIUM', 0.74
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'piping', 'carbon_steel_pipe', 'steam_trace', 'pipe_steam_trace', 'steam_trace_contact', 'A106 Grade B', NULL, 'steam_trace_line', 'high_temperature_zone', 'steam_tracing_heating', 'thermal_stress', ARRAY['Overheating','Bulging','Thermal damage'], ARRAY['Thermal creep','Material softening','Stress rupture'], ARRAY['Thermography','UT thickness','Visual inspection'], ARRAY['Temperature monitoring','Hardness test'], ARRAY['Temperature distribution','Pipe deformation','Wall thickness','Material condition'], ARRAY['Visible bulge','High temperature zone','Color change from heat','Deformation'], ARRAY['Bulge depth >0.25 in','Temperature >design limit','Hardness loss >15%'], ARRAY['Upgrade trace insulation','Install temperature control','Remove bulk heating','Replace pipe section'], ARRAY['Proper trace support','Temperature limit switches','Improved insulation','Monitor temperature'], 'MEDIUM', 0.73
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'piping', 'stainless_steel_pipe', 'drain_connection', 'pipe_at_drain', 'drain_vent_connection', 'A312 TP316', NULL, NULL, 'wet_stagnant_environment', 'drain_service', 'static_stagnant', ARRAY['Pitting','MIC','Under-deposit corrosion'], ARRAY['Microbial attack','Stagnant water corrosion','Localized pitting'], ARRAY['UT thickness mapping','Visual inspection','Fluid sampling'], ARRAY['Deposit analysis','Biological culture'], ARRAY['Wall thickness','Deposits present','Biological activity','Fluid chemistry'], ARRAY['Black deposits','Visible pitting','Hydrogen sulfide odor','Biological growth'], ARRAY['Pit depth >0.050 in','UT loss >0.015 in','Biological activity confirmed'], ARRAY['Install drain flush connection','Increase blow-down frequency','Biocide treatment','Improve circulation'], ARRAY['Sloped drain lines','Frequent flushing','Water treatment','Add circulation line'], 'MEDIUM', 0.71
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'piping', 'carbon_steel_pipe', 'gauge_transmitter', 'pipe_instrument_tap', 'gauge_tap_connection', 'A106 Grade B', 'mill_scale', NULL, 'vibration_environment', 'instrument_connection', 'vibration_cyclic', ARRAY['Vibration fatigue','Thread cracking','Leakage'], ARRAY['Fatigue crack initiation','Vibration-assisted fatigue','Stress concentration'], ARRAY['Visual inspection','MT/PT','Vibration survey'], ARRAY['Acoustic emission','Leak test'], ARRAY['Crack indications','Vibration amplitude','Connection condition','Leak status'], ARRAY['Fine cracks','Visible leakage','Metal fatigue appearance','Vibration staining'], ARRAY['MT indication >0.5 in','Active leak','Vibration >0.5 in/sec at tap'], ARRAY['Replace with welded connection','Install vibration dampers','Use flexible hose','Relocate tap'], ARRAY['Welded taps preferred','Vibration isolation','Support optimization','Thread lock compound'], 'HIGH', 0.77
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'piping', 'carbon_steel_pipe', 'dissimilar_metal_joint', 'pipe_dissimilar_metal', 'copper_to_steel_junction', 'A106 Grade B / Copper', 'mill_scale_steel', NULL, 'wet_oxygen_present', NULL, 'static_galvanic', ARRAY['Galvanic corrosion','Preferential attack','Dezincification'], ARRAY['Galvanic couple formation','Steel accelerated attack','Copper passivity loss'], ARRAY['UT thickness mapping','PMI analysis','Potential survey'], ARRAY['Metallography','Electrochemistry'], ARRAY['Material identification','Wall thickness','Potential reading','Coupling design'], ARRAY['Preferential thinning on steel','Corrosion product color change','Potential >0.3V difference','Stress concentration'], ARRAY['UT loss >0.050 in on steel','Potential difference >0.5V','Visual attack on steel side'], ARRAY['Install dielectric union','Use isolating gasket','Apply isolating coating','Replace with compatible material'], ARRAY['Dielectric isolation unions','Material compatibility review','Protective coating system','Regular inspection'], 'HIGH', 0.8
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'piping', 'carbon_steel_pipe', 'reducer_expander', 'pipe_at_reducer', 'reducer_expansion_zone', 'A106 Grade B', 'mill_scale_external', NULL, 'turbulent_flow_system', 'multi-phase_flow', 'flow_turbulence', ARRAY['Turbulence erosion','Cavitation','Vibration fatigue'], ARRAY['Erosion-corrosion','Flow turbulence damage','Cavitation pitting'], ARRAY['UT grid mapping','PAUT','CFD analysis'], ARRAY['Profile radiography','Thermography'], ARRAY['Wall thickness distribution','Erosion pattern','Flow characteristics','Vibration signature'], ARRAY['Asymmetric erosion pattern','Smooth worn surface','Downstream thinning','Pitting marks'], ARRAY['UT loss >0.060 in localized','Erosion pit >0.100 in','Non-uniform pattern'], ARRAY['Replace reducer section','Optimize geometry','Reduce flow velocity','Add flow management'], ARRAY['Proper reducer design','Gradual transitions','Material upgrade for erosion','Flow control devices'], 'HIGH', 0.79
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'pressure_vessel', 'carbon_steel_vessel', 'nozzle_weld', 'nozzle_to_shell', 'nozzle_weld_heat_affected_zone', 'A285 Grade C', 'external_epoxy_coating', NULL, 'industrial_pressure', 'pressure_vessel_service', 'cyclic_pressure_thermal', ARRAY['Fatigue cracking','Thermal cracking','HAZ cracking'], ARRAY['Stress concentration','Cyclic thermal stress','Weld metallurgy'], ARRAY['PAUT/TOFD','MT/PT','Ultrasonic inspection'], ARRAY['Radiography','Hardness testing'], ARRAY['Weld geometry','Crack indications','HAZ condition','Stress state'], ARRAY['Visible cracks','Discoloration in HAZ','Metal fatigue appearance','Service history'], ARRAY['PT indication >0.75 in','Hardness >350 HV in HAZ','Cycle history indicating stress'], ARRAY['Perform PWHT','Grind and re-weld','Stress relief','Consider replacement'], ARRAY['Design per ASME Sec VIII','PWHT all nozzle welds','Proper heat input control','Use low-carbon weld wire'], 'CRITICAL', 0.86
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'pressure_vessel', 'carbon_steel_vessel', 'bottom_head', 'vessel_bottom_head', 'vessel_lowest_point', 'A285 Grade C', 'internal_coal_tar', NULL, 'wet_sludge_environment', 'sludge_settling', 'static_corrosion', ARRAY['Settling corrosion','Under-deposit attack','Pitting'], ARRAY['Localized corrosion under deposits','Stagnant zone attack','Deposit concentration cell'], ARRAY['UT thickness mapping','Internal visual camera','Deposit sampling'], ARRAY['Radiography profile','Fluid sampling'], ARRAY['Wall thickness distribution','Deposit composition','Localized loss','Pit depth'], ARRAY['Deposits accumulated','Visible corrosion under deposits','Black staining','Wall thinning'], ARRAY['UT reading <nominal -0.050 in','Pit depth >0.075 in','Deposits >1 inch thick'], ARRAY['Clean vessel interior','Increase blow-down frequency','Apply internal coating','Replace bottom'], ARRAY['Drain sump design','Regular cleaning schedule','Internal protective coating','Improve water chemistry'], 'HIGH', 0.82
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'pressure_vessel', 'stainless_steel_vessel', 'liquid_vapor_interface', 'vessel_liquid_vapor', 'waterline_interface_zone', 'A312 TP316', 'passivated_surface', NULL, 'waterline_cycling', 'vapor_liquid_service', 'concentration_cell_corrosion', ARRAY['Waterline corrosion','Pitting at interface','Crevice attack'], ARRAY['Oxygen concentration cell','Chloride pitting','Crevice corrosion'], ARRAY['UT thickness mapping','Internal visual inspection','Potential survey'], ARRAY['Radiography','Deposit sampling'], ARRAY['Waterline location','Wall thickness','Corrosion pattern','Chemistry gradient'], ARRAY['Visible line of corrosion','Pitting at interface','Interface discoloration','Surface degradation'], ARRAY['UT loss >0.020 in at line','Pit depth >0.050 in','Corrosion rate trending'], ARRAY['Increase internal circulation','Improve water chemistry','Apply internal coating','Increase monitoring'], ARRAY['Better mixing/circulation design','Water treatment optimization','Noble metal anodes','Continuous internal coating'], 'HIGH', 0.8
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'pressure_vessel', 'carbon_steel_vessel', 'manway_opening', 'vessel_manway', 'manway_nozzle_interface', 'A285 Grade C', 'paint_system', NULL, 'maintenance_exposure', NULL, 'pressure_static', ARRAY['Gasket degradation','Bolt corrosion','Flange leakage'], ARRAY['Gasket creep','Bolt corrosion','Stress relaxation'], ARRAY['Visual inspection','UT bolt measurement','Leak test'], ARRAY['Thermography','Torque check'], ARRAY['Gasket condition','Bolt status','Flange surface','Leak indicators'], ARRAY['Corroded bolts','Gasket extrusion','Visible leaking','Deposits on flange'], ARRAY['Bolt corrosion >25%','Gasket extrusion >0.5 in','Active leak present'], ARRAY['Replace gasket and bolts','Re-torque assembly','Apply anti-seize','Upgrade materials'], ARRAY['Stainless bolt fasteners','Better gasket compounds','Anti-seize application','Regular maintenance schedule'], 'MEDIUM', 0.74
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'pressure_vessel', 'carbon_steel_vessel', 'internal_attachment', 'vessel_internal_attachment', 'internal_tray_clip_support', 'A285 Grade C', 'coal_tar_internal', NULL, 'internal_chemical_exposure', NULL, 'static_crevice', ARRAY['Crevice corrosion','Under-clip attack','Localized pitting'], ARRAY['Crevice formation','Oxygen depletion','pH drop in crevice'], ARRAY['Internal visual inspection','UT thickness mapping','MT/PT if accessible'], ARRAY['Radiography','Coupon monitoring'], ARRAY['Attachment design','Wall thickness under attachment','Crevice depth','Corrosion morphology'], ARRAY['Pitting visible under clips','Dark discoloration','Material loss pattern','Uniform vs localized'], ARRAY['Pit depth >0.060 in','UT loss >0.025 in under attachment','Wall thickness <nominal'], ARRAY['Replace internal attachment','Remove clip-on type','Apply crevice protection','Install noble metal anode'], ARRAY['Welded attachments preferred','Design to minimize crevices','Internal protective coating','Inhibitor additions'], 'HIGH', 0.79
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'pressure_vessel', 'stainless_steel_vessel', 'tubesheet_tube', 'vessel_hx_tube', 'tube_to_tubesheet_junction', 'A312 TP316 / Copper nickel tubes', 'passivated', NULL, 'heat_exchanger_service', 'cooling_water_duty', 'dynamic_flow_thermal', ARRAY['Tube cracking','Erosion at inlet','Vibration fatigue'], ARRAY['Tubesheet joint stress','Flow-induced vibration','Erosion-corrosion'], ARRAY['IRIS probe','ECT inspection','Leak test'], ARRAY['Eddy current array','Ultrasonic thickness'], ARRAY['Tube condition','Crack indications','Wall thickness','Vibration signature'], ARRAY['Visible cracks','Erosion pattern','Leaking tube','Tube vibration'], ARRAY['ECT indication in tube','Leak rate >0.5 drops/min','Vibration amplitude >0.1 in/sec'], ARRAY['Plug leaking tube','Reduce inlet velocity','Install tube support','Replace tube bundle'], ARRAY['Design to avoid resonance','Inlet diffuser design','Tube support optimization','Material upgrade'], 'HIGH', 0.83
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'pressure_vessel', 'carbon_steel_reactor', 'refractory_lining', 'vessel_refractory', 'refractory_loss_zone', 'Carbon steel shell / Refractory', NULL, 'refractory_material', 'high_temperature_service', 'thermal_cycling', 'hot_face_creep', ARRAY['Refractory loss','Hot spots','Creep failure'], ARRAY['Thermal cycling fatigue','Refractory spalling','Shell overheating'], ARRAY['Thermography','Ultrasonic thickness','Replication test'], ARRAY['Bore camera','Temperature mapping'], ARRAY['Temperature profile','Refractory condition','Wall thickness','Hot spot location'], ARRAY['High temperature zone','Refractory spall visible','Discoloration on shell','Shell bulging'], ARRAY['Temperature >design +50°F','Refractory loss >1 inch','Shell temperature >threshold'], ARRAY['Replace refractory','Reduce operating temperature','Improve insulation','Install emergency cooling'], ARRAY['Better refractory material','Thermal cycle control','Improved design','Preventive relining schedule'], 'CRITICAL', 0.85
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'pressure_vessel', 'carbon_steel_vessel', 'skirt_junction', 'vessel_skirt_shell', 'skirt_to_shell_weld', 'A285 Grade C', 'paint_system', NULL, 'wind_load_exposure', NULL, 'fatigue_wind_thermal', ARRAY['Fatigue cracking','Weld cracking','Vibration-induced'], ARRAY['Stress concentration','Wind-induced vibration','Cyclic loading'], ARRAY['MT/PT inspection','PAUT','Visual inspection'], ARRAY['Radiography','Vibration measurement'], ARRAY['Weld geometry','Crack indications','Vibration amplitude','Wind loading estimate'], ARRAY['Visible cracks','Paint cracking','Metal fatigue appearance','Vibration staining'], ARRAY['PT indication >0.75 in','Vibration amplitude >0.5 in/sec','Wind speed history correlates'], ARRAY['Perform stress relief','Upgrade weld','Install guy cables','Damping system'], ARRAY['Proper weld design','PWHT all critical welds','Vibration analysis','Guide cable pre-stress'], 'HIGH', 0.81
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'pressure_vessel', 'carbon_steel_vessel', 'stiffener_ring', 'vessel_stiffener', 'external_ring_crevice', 'A285 Grade C', 'paint_external', NULL, 'wet_environment', NULL, 'static_support', ARRAY['Crevice corrosion','Under-ring attack','Localized pitting'], ARRAY['Crevice formation','Oxygen depletion','pH drop under ring'], ARRAY['Visual inspection','UT thickness mapping','Coating inspection'], ARRAY['Eddy current','Pit gauge'], ARRAY['Ring condition','Surface corrosion','Wall thickness','Paint integrity'], ARRAY['Corrosion under stiffener','Coating lifting','Dark deposits','Pitting visible'], ARRAY['UT loss >0.025 in under ring','Pit depth >0.050 in','Coating loss >1 in area'], ARRAY['Remove stiffener ring','Improve paint system','Install isolation spacers','Increase monitoring'], ARRAY['Design without rings if possible','Isolate with spacers','Better paint prep','CUI prevention system'], 'MEDIUM', 0.73
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'pressure_vessel', 'carbon_steel_vessel', 'head_knuckle', 'vessel_knuckle', 'head_to_shell_knuckle_zone', 'A285 Grade C', 'external_epoxy', NULL, 'pressure_cycling', 'pressure_vessel_duty', 'cyclic_bending_stress', ARRAY['Plastic strain','Cracking','Distortion'], ARRAY['Overstress damage','Plastic deformation','Crack initiation from strain'], ARRAY['PAUT inspection','MT/PT','Strain measurement'], ARRAY['Radiography','Hardness test'], ARRAY['Crack indications','Deformation severity','Material condition','Stress state'], ARRAY['Visible cracks','Permanent deformation','Material thinning','Color change from stress'], ARRAY['PT indication >0.5 in','Permanent set >0.25 in','Hardness loss >10%'], ARRAY['Reduce operating pressure','Reinforce knuckle area','Replace head','Improve design'], ARRAY['Better knuckle design','Pressure relief optimization','Material upgrade','Regular stress analysis'], 'HIGH', 0.8
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'pressure_vessel', 'stainless_steel_vessel', 'weld_overlay_cladding', 'vessel_weld_overlay', 'cladding_disbondment_zone', 'A312 TP316 overlay', 'passivated', NULL, 'corrosive_chemical_contact', 'corrosive_chemical_service', 'thermal_cycling', ARRAY['Disbondment','Cracking','Delamination'], ARRAY['Lack of fusion','Dilution cracking','Thermal stress disbondment'], ARRAY['UT straight beam','PAUT','PT inspection'], ARRAY['Radiography','Eddy current array'], ARRAY['Overlay thickness','Bonding condition','Crack indications','Dilution assessment'], ARRAY['Disbond sound on tap','Visible cracks','Paint lifting','Corrosion staining'], ARRAY['UT indication >0.5 in disbond','PT crack indication','Disbond area >2 sq in'], ARRAY['Re-weld overlay','Grind and re-apply','Consider alternative material','Increase monitoring'], ARRAY['Proper weld procedure','Controlled heat input','Preheat management','PWHT as needed'], 'HIGH', 0.82
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'pressure_vessel', 'carbon_steel_reactor', 'catalyst_support', 'vessel_catalyst_support', 'catalyst_bed_support_structure', 'A285 Grade C / Alloy supports', 'internal_coating', NULL, 'high_temperature_fluidized_bed', 'catalyst_thermal_cycling', 'erosion_thermal_stress', ARRAY['Erosion','Thermal fatigue','Support failure'], ARRAY['Particle erosion','Thermal gradient stress','Mechanical fatigue'], ARRAY['Internal visual inspection','UT thickness mapping','Thermography'], ARRAY['Bore camera','Vibration measurement'], ARRAY['Support geometry','Erosion pattern','Temperature distribution','Wall thickness'], ARRAY['Erosion visible','Material loss pattern','Hot spots','Support vibration'], ARRAY['Erosion depth >0.100 in','Temperature gradient >200°F','Vibration amplitude >0.3 in/sec'], ARRAY['Replace support structure','Upgrade material','Improve flow design','Install erosion protection'], ARRAY['Better erosion-resistant material','Flow optimization','Support design improvement','Refractory protection'], 'HIGH', 0.78
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'pressure_vessel', 'carbon_steel_vessel', 'sight_glass', 'vessel_sight_glass', 'sight_glass_connection_nozzle', 'A285 Grade C', 'paint_system', NULL, 'wet_product_contact', 'liquid_level_glass', 'pressure_thermal_cycling', ARRAY['Leakage','Cracking','Gasket failure'], ARRAY['Stress concentration','Gasket degradation','Thermal cycling'], ARRAY['Visual inspection','Leak test','UT nozzle thickness'], ARRAY['Pressure test','Thermography'], ARRAY['Glass condition','Connection integrity','Gasket status','Leak indicators'], ARRAY['Visible crack in glass','Seepage around connection','Gasket extrusion','Deposits'], ARRAY['Visible leak >1 drop/min','Glass crack visible','Gasket extrusion >0.25 in'], ARRAY['Replace sight glass assembly','Re-torque connection','Replace gaskets','Inspect nozzle'], ARRAY['Quality glasses only','Proper installation procedure','Gasket material selection','Regular maintenance'], 'MEDIUM', 0.7
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'pressure_vessel', 'carbon_steel_vessel', 'psv_inlet_nozzle', 'vessel_psv_nozzle', 'psv_inlet_corrosion_zone', 'A285 Grade C', 'internal_coal_tar', NULL, 'process_fluid_exposure', 'safety_valve_inlet', 'static_deposit_corrosion', ARRAY['Corrosion under deposits','Localized pitting','Nozzle erosion'], ARRAY['Deposit concentration cell','Stagnant zone attack','Flow erosion at inlet'], ARRAY['UT thickness mapping','Internal visual inspection','Radiography'], ARRAY['Deposit sampling','Fluid analysis'], ARRAY['Wall thickness','Deposit composition','Inlet erosion','Corrosion morphology'], ARRAY['Deposits accumulated','Visible corrosion','Erosion pattern','Black staining'], ARRAY['UT loss >0.040 in','Pit depth >0.075 in','Deposits >0.5 inch thick'], ARRAY['Clean deposits','Apply internal coating','Increase monitoring','Consider dip tube'], ARRAY['Clean inlet design','Regular flushing','Protective coating','Better water chemistry'], 'HIGH', 0.79
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'pressure_vessel', 'stainless_steel_vessel', 'jacket_space', 'vessel_jacket', 'jacket_half_pipe_internal', 'A312 TP304 jacket', 'passivated', 'jacket_insulation', 'trapped_moisture_environment', 'heating_cooling_duty', 'thermal_cycling', ARRAY['Trapped moisture corrosion','Under-insulation corrosion','Pitting'], ARRAY['Moisture entrapment','Oxygen starvation','Crevice corrosion'], ARRAY['UT scanning','Thermography','Drain check'], ARRAY['Leak detection','Moisture content measurement'], ARRAY['Wall thickness','Moisture presence','Drain condition','Temperature profile'], ARRAY['Wet jacket','Visible staining','Dark discoloration','Drain line wet'], ARRAY['UT reading <nominal -0.015 in','Moisture detected','Drain plugged or weeping'], ARRAY['Install drain valve','Remove insulation','Improve ventilation','Install vent'], ARRAY['Jacket design with drains','Regular drain inspection','Breathable insulation','Prevent water entry'], 'MEDIUM', 0.72
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'subsea', 'offshore_pipeline', 'splash_zone', 'subsea_splash_zone', 'tidal_to_above_waterline', 'API X65 linepipe', 'three_layer_coating', NULL, 'splash_zone_tidal', 'subsea_pipeline', 'cyclic_wetting_drying', ARRAY['Accelerated corrosion','Coating damage','Splash zone attack'], ARRAY['Galvanic acceleration','Coating disbondment','Rapid pitting'], ARRAY['Visual/ROV inspection','UT thickness mapping','CP survey'], ARRAY['Coating adhesion test','Coupon monitoring'], ARRAY['Coating condition','Wall thickness','CP protection','Wetting cycle severity'], ARRAY['Coating lifting','Visible corrosion','Heavy rust staining','Disbonded areas'], ARRAY['Coating loss >1 inch area','UT loss >0.050 in','CP potential <-750 mV CSE'], ARRAY['Repair coating locally','Install sacrificial anode','Increase monitoring','Replace section if severe'], ARRAY['Better coating system','Enhanced CP design','Regular inspection','Improved anode placement'], 'CRITICAL', 0.87
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'subsea', 'offshore_subsea_equipment', 'j_tube', 'subsea_j_tube', 'riser_cable_entry_point', 'Carbon steel J-tube', 'three_layer_coating', NULL, 'dynamic_wave_environment', 'umbilical_cable_guide', 'vibration_wear', ARRAY['Fatigue cracking','Abrasion','Fretting corrosion'], ARRAY['Cable abrasion','Fatigue stress concentration','Vibration wear'], ARRAY['ROV visual inspection','UT thickness mapping','FMD inspection'], ARRAY['Eddy current','Ultrasonic array'], ARRAY['Crack indications','Wall thickness','Abrasion extent','Cable condition'], ARRAY['Visible cracks','Cable abrasion marks','Wear pattern','Coating loss'], ARRAY['PT indication >0.5 in','UT loss >0.025 in localized','Cable outer jacket damaged'], ARRAY['Replace J-tube section','Install cable fairlead','Add protective sleeve','Increase support'], ARRAY['Better cable routing','Protective sleeves','Stress relief design','Material upgrade'], 'HIGH', 0.82
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'subsea', 'offshore_pipeline', 'riser_clamp', 'subsea_riser_clamp', 'clamp_contact_surface', 'API X65 / Titanium clamp', 'three_layer_coating', NULL, 'seawater_high_energy', 'subsea_riser', 'vibration_fretting_contact', ARRAY['Fretting corrosion','Coating damage','Metal loss'], ARRAY['Cyclic contact wear','Fretting oxygen depletion','Crevice formation'], ARRAY['ROV visual inspection','UT thickness mapping','CP survey'], ARRAY['Coating adhesion test','Vibration survey'], ARRAY['Coating condition','Contact wear','Wall thickness','Vibration amplitude'], ARRAY['Coating loss at contact','Fretting pattern','Metal sheen','Rust staining'], ARRAY['Coating loss >0.5 in area','UT loss >0.015 in','Fretting pattern >0.25 in wide'], ARRAY['Replace clamp','Install elastomer insert','Repair coating','Increase CP'], ARRAY['Elastomer-lined clamps','Better clamp design','Protective coating','Vibration analysis'], 'HIGH', 0.8
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'subsea', 'offshore_subsea_equipment', 'anode_weld', 'subsea_anode_weld', 'sacrificial_anode_attachment', 'Carbon steel structure / Zinc anode', 'paint_system', NULL, 'seawater_galvanic', 'cathodic_protection_anode', 'galvanic_couple_stress', ARRAY['Weld cracking','CP interference','Anode disbondment'], ARRAY['Stress concentration','Hydrogen embrittlement','CP overpotential'], ARRAY['ROV visual inspection','CP survey','FMD inspection'], ARRAY['Eddy current','Anode potential measurement'], ARRAY['Crack indications','Weld quality','CP potential','Anode attachment'], ARRAY['Visible cracks','Anode detachment','Unusual CP readings','Hydrogen embrittlement signs'], ARRAY['PT indication >0.5 in','Anode disbond >1 inch','Potential >-1.1V CSE'], ARRAY['Replace anode','Re-weld attachment','Adjust CP system','Inspect for cracking'], ARRAY['Proper weld design','PWHT anode welds','CP system optimization','Anode material selection'], 'MEDIUM', 0.75
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'subsea', 'offshore_platform', 'jacket_tubular_node', 'subsea_jacket_node', 'tubular_joint_brace_intersection', 'API 2A Grade 50', 'paint_system', NULL, 'high_energy_wave_zone', 'jacket_structure', 'fatigue_cyclic_loading', ARRAY['Fatigue cracking','Weld defects','Crack growth'], ARRAY['Stress concentration','Cyclic wave loading','Weld quality issue'], ARRAY['FMD magnetic inspection','ROV visual inspection','ACFM inspection'], ARRAY['Radiography','Ultrasonic array'], ARRAY['Crack indications','Weld quality','Node geometry','Wave loading history'], ARRAY['Visible cracks','Paint cracking over defect','Metal fatigue appearance','Service history'], ARRAY['FMD indication >0.75 in','Visual crack >0.5 in','Service cycles >critical threshold'], ARRAY['Perform PWHT','Install reinforcement plate','Reduce loading','Monitor crack growth'], ARRAY['Proper joint design per API','PWHT all critical welds','Material certification','Fatigue analysis'], 'CRITICAL', 0.88
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'subsea', 'offshore_pipeline', 'mudline_burial', 'subsea_mudline', 'mudline_scour_zone', 'API X65 linepipe', 'three_layer_coating', NULL, 'seafloor_scour_environment', 'subsea_pipeline', 'scour_burial_risk', ARRAY['Scour','Free span','Pipeline exposure'], ARRAY['Seafloor scouring','Pipeline settlement','Unsupported span formation'], ARRAY['ROV sonar survey','Bathymetry mapping','Visual inspection'], ARRAY['Seabed sampling','Sediment analysis'], ARRAY['Scour depth','Burial status','Free span length','Seafloor condition'], ARRAY['Scour hole visible','Pipeline partially exposed','Free span evident','Silt movement'], ARRAY['Scour depth >2 ft','Free span >10 ft','Pipeline unsupported >3 ft'], ARRAY['Install scour protection','Backfill with sand','Add concrete mattress','Increase monitoring'], ARRAY['Better burial depth','Scour protection design','Trenching with backfill','Silt/clay cover'], 'HIGH', 0.79
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'subsea', 'offshore_subsea_equipment', 'subsea_caisson', 'subsea_caisson', 'caisson_internal_external_walls', 'Carbon steel caisson', 'external_coating_internal_epoxy', NULL, 'seawater_immersion', 'subsea_foundation_support', 'continuous_wet_static', ARRAY['Internal corrosion','External corrosion','Painting degradation'], ARRAY['Seawater attack','Oxygen starvation','Localized pitting'], ARRAY['UT thickness mapping','ROV visual inspection','CP survey'], ARRAY['Eddy current','Paint system assessment'], ARRAY['Wall thickness','Coating condition','CP protection','Internal water level'], ARRAY['Visible corrosion','Coating loss','Dark staining','Paint failure'], ARRAY['UT loss >0.050 in','Coating loss >2% area','CP potential <-750 mV CSE'], ARRAY['Apply protective coating','Increase anode spacing','Improve water management','Install interior coating'], ARRAY['Better paint system','CP system optimization','Regular maintenance','Drain plugs for water'], 'HIGH', 0.8
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'subsea', 'offshore_subsea_equipment', 'subsea_flange', 'subsea_flange', 'subsea_flange_assembly', 'Stainless steel / Alloy bolts', 'passivated_surface', NULL, 'seawater_immersion', 'subsea_connection', 'pressure_thermal_cycling', ARRAY['Bolt degradation','Gasket failure','Leakage'], ARRAY['Hydrogen embrittlement','Chloride stress corrosion','Gasket creep'], ARRAY['ROV visual inspection','Torque check','CP survey'], ARRAY['Potential measurement','Bolt condition assessment'], ARRAY['Bolt status','Gasket condition','Leakage indicators','CP protection'], ARRAY['Corroded bolts','Seepage','Gasket extrusion','Paint loss around flange'], ARRAY['Bolt corrosion >25%','Active leak >1 drop/min','Torque loss >10%'], ARRAY['Replace corroded bolts','Replace gasket','Re-torque assembly','Improve bolt coating'], ARRAY['Stainless bolts preferred','Cathodic protection','Better gasket material','Regular torque checks'], 'HIGH', 0.78
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'subsea', 'offshore_subsea_equipment', 'grouted_pile', 'subsea_grout', 'grouted_pile_connection', 'Carbon steel pile / Epoxy grout', 'paint_external', NULL, 'seawater_immersion', 'foundation_piling', 'static_cyclic_loading', ARRAY['Grout failure','Pile cracking','Interface degradation'], ARRAY['Grout shrinkage','Debonding','Pile fatigue cracking'], ARRAY['ROV visual inspection','Underwater UT','Impact echo test'], ARRAY['Acoustic testing','Sediment sampling'], ARRAY['Grout condition','Pile wall thickness','Interface integrity','Crack indications'], ARRAY['Grout separation','Visible cracks','Hollow sound on tap','Paint loss'], ARRAY['Debond area >2 sq ft','Crack indication present','UT loss >0.025 in'], ARRAY['Re-grout pile','Install tremie tube','Seal crack','Inspect pile quality'], ARRAY['Better grout specification','Improved grouting procedure','Quality control testing','Protective pile coating'], 'HIGH', 0.77
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'subsea', 'offshore_platform', 'boat_landing', 'subsea_appurtenance', 'boat_landing_platform', 'Carbon steel structure / Composite deck', 'paint_system', NULL, 'high_energy_splash_zone', 'operational_appurtenance', 'impact_vibration_fatigue', ARRAY['Fatigue cracking','Coating failure','Weld cracks'], ARRAY['Cyclic boat impact loading','Stress concentration','Fatigue initiation'], ARRAY['ROV visual inspection','ACFM inspection','FMD magnetic inspection'], ARRAY['Radiography','Ultrasonic array'], ARRAY['Crack indications','Weld quality','Coating condition','Usage history'], ARRAY['Visible cracks','Paint cracking','Metal fatigue appearance','Service history'], ARRAY['Visual crack >0.5 in','ACFM indication present','Paint failure >1 sq ft'], ARRAY['Install crack arrest','Reinforce connection','Limit boat landing use','Replace component'], ARRAY['Better landing design','Impact energy dissipation','Fatigue analysis per API','Protective coating system'], 'MEDIUM', 0.74
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'subsea', 'offshore_pipeline', 'pipeline_crossing', 'subsea_pipeline_crossing', 'pipeline_to_pipeline_crossing_point', 'API X65 linepipe', 'three_layer_coating', NULL, 'crossing_contact_zone', 'subsea_pipeline', 'mechanical_contact_dynamic', ARRAY['Mechanical damage','Coating loss','Abrasion'], ARRAY['Cable/pipeline abrasion','Contact wear','Coating disbondment'], ARRAY['ROV visual inspection','UT thickness mapping','CP survey'], ARRAY['Eddy current','Coating adhesion test'], ARRAY['Coating condition','Wall thickness','Contact damage','CP protection'], ARRAY['Coating loss at contact','Visible abrasion','Metal sheen','Corrosion staining'], ARRAY['Coating loss >0.75 in area','UT loss >0.015 in','Contact wear >0.25 in wide'], ARRAY['Install crossing saddle','Repair coating','Separate crossings','Increase monitoring'], ARRAY['Design crossing protection','Pipeline separation design','Protective sleeves','Regular surveys'], 'HIGH', 0.79
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'subsea', 'offshore_pipeline', 'free_span', 'subsea_free_span', 'unsupported_pipeline_span', 'API X65 linepipe', 'three_layer_coating', NULL, 'high_energy_wave_zone', 'subsea_pipeline', 'vortex_induced_vibration', ARRAY['VIV fatigue cracking','Strain fatigue','Buckle initiation'], ARRAY['Vortex shedding','Cyclic bending strain','Resonance conditions'], ARRAY['ROV sonar survey','UT thickness mapping','Strain measurement'], ARRAY['Pipeline support survey','Seabed surveying'], ARRAY['Free span length','Span depth','Vibration amplitude','Wall thickness'], ARRAY['Visible pipeline movement','Span increasing','Corrosion pattern','Buckle initiation'], ARRAY['Free span >10 ft','Vibration amplitude >0.2 in','Buckle toe crack indication'], ARRAY['Install support structure','Install clump weight','Add damping device','Backfill scour'], ARRAY['Proper support spacing','Burial or clump weight','VIV analysis per DNV','Strain monitoring'], 'CRITICAL', 0.85
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'subsea', 'offshore_pipeline', 'dropped_object_dent', 'subsea_anchor_impact', 'impact_dent_gouge_zone', 'API X65 linepipe', 'three_layer_coating', NULL, 'seabed_drop_impact', 'subsea_pipeline', 'mechanical_impact_damage', ARRAY['Dent formation','Gouge','Crack initiation'], ARRAY['Impact plastic deformation','Stress riser formation','Coating loss'], ARRAY['ROV visual inspection','UT thickness mapping','Crack detection UT'], ARRAY['Eddy current','MFL inspection'], ARRAY['Dent depth','Dent length','Wall thickness','Crack indications'], ARRAY['Visible dent','Paint loss','Metal sheen','Deformation shape'], ARRAY['Dent depth >5% OD','Dent >6 in long','Crack indication present'], ARRAY['Install fatigue strap','Reduce operating pressure','Schedule replacement','Monitor crack growth'], ARRAY['Dent impact prevention design','Pipeline marking','Vessel anchor protocols','Insurance against impacts'], 'HIGH', 0.83
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'subsea', 'offshore_platform', 'cp_survey_anomaly', 'subsea_cp_anomaly', 'cp_protection_variation_zone', 'Carbon steel structure', 'paint_system', NULL, 'seawater_cathodic_protection', 'platform_steel_structure', 'galvanic_potential_gradient', ARRAY['Under-protection','Over-protection','Stray current'], ARRAY['CP gradient variation','Anode consumption','Stray current interference'], ARRAY['CP potential survey','High-resolution mapping','Current measurement'], ARRAY['Anode depletion check','Stray current survey'], ARRAY['Potential distribution','Anode status','Electrical interference','Corrosion condition'], ARRAY['Potential >-1.1V CSE','Potential <-750 mV CSE','Uneven protection','Stray current detection'], ARRAY['Negative zone >100 sq ft','Positive zone >50 sq ft','Stray current >10 mA'], ARRAY['Adjust anode placement','Add anodes to under-protected zone','Remove stray current source','Upgrade CP system'], ARRAY['CP system optimization','Better anode spacing','Stray current mitigation','Design CP analysis'], 'HIGH', 0.8
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'subsea', 'offshore_pipeline', 'concrete_weight_coating', 'subsea_concrete_coat', 'concrete_disbondment_zone', 'API X65 / Concrete coating', 'concrete_on_pipe', NULL, 'deep_water_seawater', 'subsea_pipeline_weight_coating', 'static_hydrostatic_pressure', ARRAY['Disbondment','Concrete delamination','Pipe corrosion'], ARRAY['Adhesion loss','Water ingress under concrete','Localized corrosion'], ARRAY['ROV visual inspection','Impact test','UT thickness mapping'], ARRAY['Acoustic tap test','Eddy current'], ARRAY['Disbond area','Concrete condition','Pipe wall thickness','Water ingress'], ARRAY['Concrete separation','Hollow sound on tap','Rust staining','Concrete spalling'], ARRAY['Disbond area >1 sq ft','Impact test >1 in deflection','UT loss >0.010 in under concrete'], ARRAY['Apply additional protection','Remove and re-coat','Install cathodic protection','Monitor progression'], ARRAY['Better concrete adhesion design','CP protection','Regular inspection','Improved concrete formulation'], 'MEDIUM', 0.73
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'marine', 'bulk_carrier', 'ballast_tank', 'marine_ballast_tank', 'ballast_tank_internal', 'Mild steel', 'internal_paint_system', NULL, 'seawater_ballast', 'ballast_water_service', 'static_wetting_drying', ARRAY['Coating breakdown','Pitting','MIC'], ARRAY['Localized corrosion','Microbial attack','Paint failure'], ARRAY['Visual inspection','UT thickness mapping','Coating gauge'], ARRAY['Deposit sampling','Biological culture'], ARRAY['Paint condition','Wall thickness','Pit depth','Biological activity'], ARRAY['Visible corrosion','Paint breakdown','Black deposits','Hydrogen sulfide odor'], ARRAY['Pit depth >0.050 in','UT loss >0.020 in','Paint loss >5% area'], ARRAY['Clean tank','Reapply paint system','Biocide treatment','Increase ventilation'], ARRAY['Quality ballast water treatment','High-build paint coating','Regular tank inspection','Maintenance schedule'], 'HIGH', 0.82
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'marine', 'general_cargo_vessel', 'deck_plate', 'marine_deck_plate', 'hatch_corner_zone', 'Grade A steel', 'paint_system', NULL, 'weather_exposure', 'hatch_opening', 'cyclic_stress', ARRAY['Fatigue cracking','Weld stress','Cracking at opening'], ARRAY['Stress concentration','Cyclic bending','Weld defects'], ARRAY['MT/PT inspection','PAUT','Visual inspection'], ARRAY['Radiography','Ultrasonic array'], ARRAY['Crack indications','Weld quality','Paint condition','Hatch usage'], ARRAY['Visible cracks','Paint cracking','Metal fatigue appearance','Service history'], ARRAY['PT indication >0.5 in','Paint failure >2 sq ft','Corrosion staining visible'], ARRAY['Grind and re-weld','Stress relief','Install reinforcement','Increase inspection'], ARRAY['Better weld design','PWHT deck welds','Quality control','Paint maintenance program'], 'HIGH', 0.8
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'marine', 'container_vessel', 'hull_weld', 'marine_weld_seam', 'longitudinal_transverse_weld', 'Grade A marine steel', 'paint_system', NULL, 'high_sea_loading', 'hull_structure', 'cyclic_wave_bending', ARRAY['Cracking at weld','Laminar cracking','Through-thickness cracking'], ARRAY['Stress concentration','Residual stress','Material defect'], ARRAY['PAUT inspection','TOFD','MT/PT'], ARRAY['Radiography','Ultrasonic array'], ARRAY['Crack indications','Weld quality','Material condition','Wave loading'], ARRAY['Visible cracks','Paint loss','Service corrosion','Deformation signs'], ARRAY['PT indication >0.75 in','Through-wall crack potential','Crack growth trending'], ARRAY['Perform PWHT','Grind and re-weld','Ultrasonic therapy','Monitor growth'], ARRAY['Proper weld procedure','PWHT all hull welds','Preheat management','Quality inspection'], 'HIGH', 0.81
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'marine', 'tanker_vessel', 'bilge_keel', 'marine_bilge_keel', 'bilge_keel_attachment', 'Grade B marine steel', 'paint_system', NULL, 'wave_spray_environment', 'stabilizing_appendage', 'vibration_cyclic', ARRAY['Fatigue at weld','Cracking','Attachment failure'], ARRAY['Vibration fatigue','Weld stress','Material weakness'], ARRAY['Visual inspection','MT/PT','UT'], ARRAY['Eddy current','Vibration survey'], ARRAY['Crack indications','Weld condition','Paint state','Vibration signature'], ARRAY['Visible cracks','Paint cracking','Loose attachment','Vibration stains'], ARRAY['PT indication >0.5 in','Attachment loose >0.1 in','Vibration amplitude trending'], ARRAY['Re-weld attachment','Install damping system','Replace bilge keel','Stress relief'], ARRAY['Better keel design','PWHT attachment welds','Vibration analysis','Paint protective coat'], 'MEDIUM', 0.75
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'marine', 'general_cargo_vessel', 'propeller_shaft', 'marine_propeller_shaft', 'stern_tube_bearing_zone', 'Carbon steel shaft / Bronze bearing', 'paint_external', NULL, 'seawater_wet_sump', 'propulsion_drive', 'continuous_rotation_wear', ARRAY['Bearing wear','Shaft corrosion','Oil degradation'], ARRAY['Mechanical wear','Fretting corrosion','Lubrication loss'], ARRAY['UT thickness mapping','Visual inspection','Vibration analysis'], ARRAY['Bearing clearance check','Oil analysis'], ARRAY['Shaft wear','Bearing condition','Lubrication level','Vibration signature'], ARRAY['Visible corrosion','Bearing play','Oil contamination','Vibration increase'], ARRAY['Bearing clearance >limits','Vibration amplitude >2 in/sec','Oil analysis shows wear metals'], ARRAY['Replace bearing','Increase oil circulation','Realign shaft','Service oil system'], ARRAY['Quality bearing material','Regular lubrication','Shaft coating','Maintenance schedule'], 'HIGH', 0.79
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'marine', 'general_cargo_vessel', 'rudder_stock', 'marine_rudder_stock', 'rudder_stock_pintle_zone', 'Carbon steel stock', 'paint_system', NULL, 'seawater_wet_bearing', 'steering_system', 'cyclic_steering_load', ARRAY['Corrosion','Fatigue cracking','Bearing wear'], ARRAY['Seawater attack','Stress concentration','Material wear'], ARRAY['Visual inspection','UT thickness mapping','MT/PT'], ARRAY['Bearing play check','Ultrasonic array'], ARRAY['Stock wall thickness','Corrosion pattern','Bearing clearance','Crack indications'], ARRAY['Visible corrosion','Bearing play','Paint loss','Discoloration'], ARRAY['UT loss >0.040 in','Bearing clearance out of spec','PT indication >0.5 in'], ARRAY['Coat exposed areas','Replace bearing','Increase inspection','Realign rudder'], ARRAY['Quality paint system','Bearing material selection','Regular servicing','Design improvement'], 'HIGH', 0.78
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'marine', 'bulk_carrier', 'void_space', 'marine_void_space', 'enclosed_void_internal', 'Mild steel', 'internal_paint', NULL, 'high_humidity_condensation', 'structural_void', 'static_condensation_corrosion', ARRAY['Condensation corrosion','Pitting','Coating failure'], ARRAY['Moisture accumulation','Oxygen starvation crevice','Paint breakdown'], ARRAY['Visual inspection','UT thickness mapping','Humidity measurement'], ARRAY['Thermography','Paint thickness gauge'], ARRAY['Paint condition','Wall thickness','Humidity level','Corrosion pattern'], ARRAY['Wet internal surfaces','Visible rust','Paint deterioration','Moisture condensation'], ARRAY['Humidity >85% RH','UT loss >0.015 in','Paint loss >2% area'], ARRAY['Install ventilation','Apply sealant coating','Increase air circulation','Dehumidify space'], ARRAY['Improved ventilation design','Better paint system','Regular humidity checks','Access for inspection'], 'MEDIUM', 0.72
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'marine', 'tanker_vessel', 'tank_top', 'marine_tank_top', 'tank_top_under_cargo', 'Mild steel deck', 'epoxy_coating_internal', NULL, 'cargo_liquid_contact', 'cargo_tank_top', 'static_liquid_contact', ARRAY['Pitting','Wastage','Coating failure'], ARRAY['Localized corrosion','Cargo attack','Paint disbondment'], ARRAY['UT thickness mapping','Visual inspection','Coating gauge'], ARRAY['Eddy current','Paint adhesion test'], ARRAY['Wall thickness','Coating condition','Corrosion depth','Liquid characteristics'], ARRAY['Visible corrosion','Paint loss','Pitting clusters','Discoloration pattern'], ARRAY['Pit depth >0.050 in','UT loss >0.025 in','Coating loss >1% area'], ARRAY['Repair coating','Localized replacement','Improve tank design','Increase monitoring'], ARRAY['High-performance tank coating','Design for drainage','Quality cargo handling','Regular cleaning'], 'HIGH', 0.79
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'marine', 'container_vessel', 'waterline', 'marine_waterline', 'variable_waterline_zone', 'Grade A marine steel', 'paint_system', NULL, 'waterline_cycling', 'hull_waterline', 'oxygen_concentration_cell', ARRAY['Grooving','Pitting at waterline','Coating failure'], ARRAY['Waterline corrosion','Oxygen gradient','Fouling underside'], ARRAY['UT thickness mapping','Visual inspection','Coating condition'], ARRAY['Radiography','Paint thickness gauge'], ARRAY['Wall thickness','Corrosion pattern','Paint state','Operating waterline'], ARRAY['Visible waterline rust','Grooved pattern','Paint loss','Coating deterioration'], ARRAY['UT loss >0.050 in at line','Groove depth >0.100 in','Paint failure >5 sq ft'], ARRAY['Repair coating locally','Update operating waterline','Hull repaint','Increase inspection'], ARRAY['Improved paint system','Anti-fouling coating','Design waterline mark','Ballast optimization'], 'HIGH', 0.8
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'marine', 'general_cargo_vessel', 'frame_bracket', 'marine_frame_bracket', 'frame_toe_connection', 'Grade A steel', 'paint_system', NULL, 'normal_sea_environment', 'structural_frame', 'cyclic_sea_bending', ARRAY['Fatigue cracking','Stress concentration','Weld defect'], ARRAY['Cyclic bending stress','Weld quality issue','Material defect'], ARRAY['MT/PT inspection','PAUT','Visual inspection'], ARRAY['Radiography','Ultrasonic thickness'], ARRAY['Crack indications','Weld condition','Paint state','Sea state history'], ARRAY['Visible cracks','Paint cracking','Metal fatigue surface','Stress concentration'], ARRAY['PT indication >0.5 in','Paint failure >1 sq ft','Service stress trending'], ARRAY['Grind and re-weld','Stress relief','Install reinforcement','Monitor crack'], ARRAY['Better toe design','PWHT frame welds','Quality control','Paint system maintenance'], 'HIGH', 0.81
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'marine', 'bulk_carrier', 'pipe_rack', 'marine_pipe_rack', 'pipe_support_structure', 'Mild steel', 'paint_system', NULL, 'wind_wave_exposure', 'vessel_piping_support', 'vibration_fatigue', ARRAY['Vibration fatigue','Cracking at support','Coating failure'], ARRAY['Vibration-induced fatigue','Weld stress','Pipe movement wear'], ARRAY['Visual inspection','MT/PT','Vibration survey'], ARRAY['Ultrasonic array','Acceleration measurement'], ARRAY['Crack indications','Paint condition','Vibration amplitude','Support attachment'], ARRAY['Visible cracks','Paint cracking','Loose connections','Vibration staining'], ARRAY['PT indication >0.5 in','Vibration >0.5 in/sec','Paint loss >2 sq ft'], ARRAY['Re-weld connections','Install dampers','Tighten fasteners','Increase stiffness'], ARRAY['Better support design','PWHT support welds','Vibration isolation','Paint maintenance'], 'MEDIUM', 0.74
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'marine', 'general_cargo_vessel', 'cargo_hold', 'marine_cargo_hold', 'cargo_hold_structural', 'Mild steel', 'paint_system_internal', NULL, 'cargo_exposure', 'cargo_hold_compartment', 'static_cargo_load', ARRAY['Cargo damage','Coating wear','Structural deformation'], ARRAY['Cargo impact','Paint abrasion','Material degradation'], ARRAY['Visual inspection','UT thickness mapping','Coating gauge'], ARRAY['Paint adhesion test','Structural survey'], ARRAY['Paint condition','Wall thickness','Deformation extent','Cargo handling records'], ARRAY['Visible coating loss','Cargo staining','Deformation marks','Corrosion present'], ARRAY['Paint loss >5% area','Deformation >0.25 in','UT loss >0.010 in'], ARRAY['Repaint interior','Repair deformation','Increase stiffeners','Cargo handling procedure'], ARRAY['Protective coating system','Cargo handling equipment','Damage prevention','Regular maintenance'], 'MEDIUM', 0.73
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'storage_tank', 'welded_steel_tank', 'tank_bottom', 'tank_bottom', 'tank_bottom_external', 'ASTM A36 steel', 'external_paint', 'bottom_external_surface', 'wet_soil_subgrade', NULL, 'static_soil_contact', ARRAY['Underside corrosion','Soil-side attack','CP failure'], ARRAY['Soil moisture attack','Differential aeration','Galvanic gradients'], ARRAY['MFL survey','UT thickness mapping','ACVG survey'], ARRAY['Potential survey','Corrosion coupon'], ARRAY['Wall thickness distribution','CP potential','Soil resistivity','Coating condition'], ARRAY['Corrosion patches visible','Settlement indicators','CP inadequacy','Wet soil present'], ARRAY['UT loss >0.100 in localized','CP potential <-600 mV CSE','Settlement >1 inch'], ARRAY['Install anode bed','Increase tank CP','Backfill remediation','Consider replacement'], ARRAY['Better foundation design','CP system installation','Quality bottom paint','Soil management'], 'CRITICAL', 0.86
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'storage_tank', 'welded_steel_tank', 'shell_bottom_weld', 'tank_shell_bottom', 'shell_to_bottom_weld', 'ASTM A36 steel', 'external_paint', NULL, 'ground_support', 'tank_shell', 'fatigue_settlement_stress', ARRAY['Fatigue cracking','Weld cracking','Settlement damage'], ARRAY['Differential settlement','Weld residual stress','Cyclic loading'], ARRAY['UT thickness mapping','MT/PT','Settlement survey'], ARRAY['Radiography','Foundation survey'], ARRAY['Crack indications','Settlement pattern','Wall thickness','Foundation condition'], ARRAY['Visible cracks at weld','Uneven settlement','Paint loss','Deformation'], ARRAY['PT indication >0.75 in','Settlement >0.5 in differential','UT loss >0.025 in'], ARRAY['Repair foundation','Re-weld shell-bottom','Level tank','Increase monitoring'], ARRAY['Foundation design per code','PWHT weld','Quality control','Settlement monitoring'], 'HIGH', 0.82
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'storage_tank', 'welded_steel_tank', 'roof_shell_junction', 'tank_roof_shell', 'roof_to_shell_connection', 'ASTM A36 / A283 roof', 'paint_external', NULL, 'weather_thermal_cycling', 'tank_roof_support', 'thermal_stress_cycling', ARRAY['Corrosion at junction','Breathing attacks','Cracking'], ARRAY['Thermal stress','Moisture entrapment','Coating failure'], ARRAY['Visual inspection','UT thickness mapping','Thermography'], ARRAY['Radiography','Paint thickness gauge'], ARRAY['Paint condition','Wall thickness','Corrosion morphology','Thermal cycling'], ARRAY['Visible rust pattern','Paint loss','Coating deterioration','Rust streaking'], ARRAY['UT loss >0.025 in','Paint loss >2 sq ft','Rust staining >6 in wide'], ARRAY['Repair coating','Improve roof design','Install sealant','Increase ventilation'], ARRAY['Better roof design','Sealed junction detail','Quality paint system','Anti-breathing vent'], 'HIGH', 0.78
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'storage_tank', 'floating_roof_tank', 'floating_roof', 'tank_floating_roof', 'floating_roof_deck', 'ASTM A36 roof deck', 'paint_internal', NULL, 'product_vapor_contact', 'floating_roof_structure', 'cyclic_floating_movement', ARRAY['Seal degradation','Rim corrosion','Pontoon leaks'], ARRAY['Mechanical wear','Product attack','Fatigue of seals'], ARRAY['Visual inspection','UT thickness mapping','Float test'], ARRAY['Seal condition check','Pontoon inspection'], ARRAY['Seal condition','Rim corrosion','Float status','Pontoon integrity'], ARRAY['Visible corrosion on rim','Seal extrusion','Float low','Visible leaks'], ARRAY['Seal loss >2 feet','Float below level','Pontoon leak >0.5 drops/min'], ARRAY['Replace floating roof','Repair pontoons','Reseal perimeter','Adjust float'], ARRAY['Quality floating roof design','Better seal material','Regular maintenance','Float inspection'], 'HIGH', 0.8
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'storage_tank', 'welded_steel_tank', 'tank_sump', 'tank_sump', 'sump_drain_low_point', 'ASTM A36 steel', 'epoxy_internal_sump', NULL, 'wet_sludge_stagnant', 'tank_bottom_sump', 'static_stagnation_microbial', ARRAY['MIC','Under-deposit corrosion','Pitting'], ARRAY['Microbial attack','Deposit concentration','Stagnant water corrosion'], ARRAY['UT thickness mapping','Visual inspection','Fluid sampling'], ARRAY['Deposit analysis','Biological culture'], ARRAY['Wall thickness','Deposits present','Biological activity','Fluid chemistry'], ARRAY['Black deposits visible','Hydrogen sulfide odor','Pitting pattern','Biological growth'], ARRAY['Pit depth >0.060 in','UT loss >0.020 in','Biological activity confirmed'], ARRAY['Clean sump','Apply protective coating','Biocide treatment','Improve drainage'], ARRAY['Sump design for drainage','Regular flushing','Biocide addition','Water treatment'], 'HIGH', 0.77
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'storage_tank', 'welded_steel_tank', 'annular_ring', 'tank_annular', 'annular_ring_junction', 'ASTM A36 steel', 'paint_external', NULL, 'wet_annular_space', 'tank_annular_ring', 'static_water_contact', ARRAY['Accelerated corrosion','Underside attack','CP failure'], ARRAY['Moisture trapped annular','Differential aeration','Under-ring attack'], ARRAY['MFL survey','UT thickness mapping','ACVG survey'], ARRAY['Potential mapping','Corrosion coupon'], ARRAY['Wall thickness','CP protection','Water presence','Coating condition'], ARRAY['Corrosion visible under ring','Water in annular','Poor CP coverage','Paint loss'], ARRAY['UT loss >0.075 in','CP potential <-700 mV CSE','Water >0.5 inch deep in annular'], ARRAY['Install anode in annular','Improve drainage holes','Increase CP','Raise ring drainage'], ARRAY['Better annular design','CP system enhancement','Drainage hole design','Paint system quality'], 'HIGH', 0.81
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'storage_tank', 'welded_steel_tank', 'wind_girder', 'tank_wind_girder', 'wind_girder_shell_attach', 'ASTM A36 girder', 'paint_external', NULL, 'wind_exposure_cycling', 'tank_wind_bracing', 'vibration_fatigue_wind', ARRAY['Buckling','Corrosion at attachment','Weld cracking'], ARRAY['Wind vibration','Fatigue stress','Attachment wear'], ARRAY['Visual inspection','UT thickness mapping','Plumb survey'], ARRAY['Radiography','Vibration survey'], ARRAY['Girder condition','Attachment weld','Plumb status','Vibration signature'], ARRAY['Visible buckling','Attachment rust','Paint loss','Vibration staining'], ARRAY['Buckling >0.5 in','UT loss >0.030 in at attachment','Vibration >0.5 in/sec'], ARRAY['Reinforce girder','Repair attachment weld','Straighten girder','Add bracing'], ARRAY['Wind analysis per code','PWHT attachment welds','Quality paint','Vibration damping'], 'MEDIUM', 0.73
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'storage_tank', 'welded_steel_tank', 'nozzle', 'tank_nozzle', 'nozzle_reinforcement_pad', 'ASTM A36 shell / Pad', 'paint_external', NULL, 'industrial_weather', 'tank_nozzle', 'fatigue_stress_concentration', ARRAY['Cracking','Corrosion at nozzle','Weld cracks'], ARRAY['Stress concentration','Fatigue cycling','Weld defect'], ARRAY['UT thickness mapping','MT/PT','Visual inspection'], ARRAY['Radiography','Ultrasonic array'], ARRAY['Crack indications','Wall thickness','Weld quality','Paint state'], ARRAY['Visible cracks','Paint cracking','Corrosion staining','Stress concentration'], ARRAY['PT indication >0.5 in','UT loss >0.020 in','Paint loss >0.5 sq ft'], ARRAY['Perform PWHT','Grind and re-weld','Install reinforcement','Monitor crack'], ARRAY['Proper nozzle design','PWHT nozzle welds','Quality control','Paint maintenance'], 'HIGH', 0.78
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'storage_tank', 'welded_steel_tank', 'heating_coil', 'tank_heating_coil', 'heating_coil_support_floor', 'Carbon steel coil / Floor', 'paint_internal', NULL, 'steam_heated_service', 'heating_system', 'thermal_fatigue_stress', ARRAY['Coil leak','Support corrosion','Thermal damage to floor'], ARRAY['Coil fatigue crack','Support weld failure','Thermal overstress'], ARRAY['Leak test','UT thickness mapping','Visual inspection'], ARRAY['Pressure test','Thermography'], ARRAY['Coil condition','Support integrity','Floor thickness','Leak indicators'], ARRAY['Visible leak','Support corrosion','Floor discoloration','Scale buildup'], ARRAY['Coil leak >0.5 drops/min','Support corrosion >25%','Floor temperature >design'], ARRAY['Replace coil','Repair support','Improve floor protection','Isolation system'], ARRAY['Better coil design','Improved support structure','Thermal insulation','Regular maintenance'], 'HIGH', 0.77
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'storage_tank', 'welded_steel_tank', 'foundation', 'tank_foundation', 'foundation_ringwall', 'ASTM A36 shell / Concrete ring', 'paint_external', NULL, 'ground_settlement', 'tank_foundation_system', 'differential_settlement', ARRAY['Edge settlement','Ringwall cracking','Drainage failure'], ARRAY['Soil settlement','Foundation movement','Water accumulation'], ARRAY['Settlement survey','Visual inspection','GPR survey'], ARRAY['Foundation inspection','Soil testing'], ARRAY['Settlement differential','Crack pattern','Drainage status','Soil condition'], ARRAY['Visible cracks in ringwall','Tank edge movement','Water pooling','Ground separation'], ARRAY['Settlement >0.5 in differential','Ringwall cracks >3 in long','Standing water >1 inch deep'], ARRAY['Install sump pump','Improve drainage','Inject grout','Monitor settlement'], ARRAY['Better foundation design','Subsurface analysis','Improved drainage detail','Regular monitoring'], 'HIGH', 0.79
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'offshore', 'production_platform', 'module_support', 'offshore_module_support', 'module_stool_connection', 'API Grade 50 steel', 'paint_system', NULL, 'marine_splash_zone', 'production_module', 'fatigue_wave_cycling', ARRAY['Fatigue cracking','Weld defects','Stress concentration'], ARRAY['Cyclic wave loading','Weld residual stress','Material defect'], ARRAY['MT/PT inspection','PAUT','Visual inspection'], ARRAY['Radiography','Ultrasonic array'], ARRAY['Crack indications','Weld quality','Paint state','Loading history'], ARRAY['Visible cracks','Paint cracking','Metal fatigue surface','Service corrosion'], ARRAY['PT indication >0.5 in','Paint loss >2 sq ft','Service cycles near limit'], ARRAY['Perform PWHT','Grind and re-weld','Stress relief','Monitor crack growth'], ARRAY['Better stool design per API','PWHT all critical welds','Quality control','Fatigue analysis'], 'CRITICAL', 0.85
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'offshore', 'production_platform', 'flare_tower', 'offshore_flare_tower', 'flare_connection_nozzle', 'API Grade 50 steel', 'paint_system', NULL, 'flare_radiant_heat', 'flare_gas_system', 'thermal_fatigue_cycling', ARRAY['Fatigue cracking','Thermal damage','Coating failure'], ARRAY['Thermal cycling','Weld stress','Heat damage to paint'], ARRAY['Visual inspection','UT thickness mapping','Thermography'], ARRAY['Radiography','MT/PT'], ARRAY['Crack indications','Paint condition','Temperature profile','Weld quality'], ARRAY['Visible cracks','Paint blistering','Metal discoloration','Heat staining'], ARRAY['PT indication >0.5 in','Paint loss >3 sq ft','Surface temperature >design'], ARRAY['Install heat shield','Grind and re-weld','Improve cooling','Monitor temperature'], ARRAY['Heat shield design','Better weld design','Improved paint system','Temperature monitoring'], 'HIGH', 0.8
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'offshore', 'production_platform', 'helideck', 'offshore_helideck', 'helideck_support_frame', 'API Grade 50 / Composite deck', 'paint_system', NULL, 'weather_wind_spray', 'helicopter_landing', 'fatigue_impact_loading', ARRAY['Fatigue cracking','Corrosion under deck','Coating failure'], ARRAY['Impact loading','Fatigue cycling','Paint disbondment'], ARRAY['Visual inspection','MT/PT','UT thickness mapping'], ARRAY['Eddy current','Coating adhesion test'], ARRAY['Crack indications','Paint condition','Corrosion pattern','Deck integrity'], ARRAY['Visible cracks','Paint loss','Corrosion staining','Deck deformation'], ARRAY['PT indication >0.75 in','Paint loss >2 sq ft','Deck deformation >0.25 in'], ARRAY['Reinforce support structure','Repair painting','Increase inspection','Monitor damage'], ARRAY['Better deck design','Fatigue analysis','Quality paint system','Impact energy dissipation'], 'MEDIUM', 0.76
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'offshore', 'production_platform', 'crane_pedestal', 'offshore_crane_pedestal', 'crane_pedestal_base_weld', 'API Grade 50 steel', 'paint_system', NULL, 'marine_spray_zone', 'crane_support_structure', 'fatigue_cyclic_loading', ARRAY['Fatigue cracking','Base weld cracking','Anchor bolt failure'], ARRAY['Cyclic crane loading','Weld residual stress','Bolt stress concentration'], ARRAY['MT/PT inspection','PAUT','Bolt torque check'], ARRAY['Radiography','Ultrasonic array'], ARRAY['Crack indications','Weld quality','Bolt status','Paint condition'], ARRAY['Visible cracks','Bolt corrosion','Paint loss','Stress corrosion signs'], ARRAY['PT indication >0.75 in','Bolt corrosion >25%','Paint loss >3 sq ft'], ARRAY['Perform PWHT','Replace anchor bolts','Stress relief','Monitor cracks'], ARRAY['Better pedestal design','PWHT base welds','Quality anchor bolts','Fatigue analysis'], 'CRITICAL', 0.84
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'offshore', 'production_platform', 'riser_guide_frame', 'offshore_riser_guide', 'riser_guide_frame_structure', 'Carbon steel structure', 'paint_system', NULL, 'marine_wave_zone', 'riser_guide_system', 'vibration_wear_friction', ARRAY['Fretting wear','Coating damage','Metal loss'], ARRAY['Cyclic riser movement','Contact wear','Paint disbondment'], ARRAY['Visual inspection','UT thickness mapping','FMD inspection'], ARRAY['Eddy current','Vibration survey'], ARRAY['Wear pattern','Wall thickness','Paint state','Vibration signature'], ARRAY['Visible wear marks','Paint loss at contact','Metal sheen','Corrosion staining'], ARRAY['Wear depth >0.050 in','Paint loss >1 sq ft','UT loss >0.010 in'], ARRAY['Install elastomer liners','Repair painting','Lubricate guide','Replace guide frame'], ARRAY['Better guide design','Elastomer liners','Quality paint system','Riser isolation'], 'HIGH', 0.78
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'offshore', 'production_platform', 'cellar_deck', 'offshore_cellar_deck', 'lower_deck_member_splash', 'API Grade 50 steel', 'paint_system', NULL, 'splash_zone_tidal', 'platform_lower_deck', 'splash_zone_corrosion', ARRAY['Splash zone corrosion','Accelerated attack','Coating failure'], ARRAY['Cyclic wetting drying','Galvanic acceleration','Paint disbondment'], ARRAY['Visual inspection','UT thickness mapping','CP survey'], ARRAY['Coating adhesion test','Potential survey'], ARRAY['Corrosion pattern','Wall thickness','Paint state','CP protection'], ARRAY['Visible corrosion','Paint loss','Rust staining','CP inadequacy'], ARRAY['Corrosion rate trending','Paint loss >2 sq ft','CP potential <-750 mV CSE'], ARRAY['Repair coating locally','Increase anode spacing','Inspect regularly','CP system upgrade'], ARRAY['Enhanced paint system','CP optimization','Improved anode design','Regular inspection'], 'HIGH', 0.81
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'offshore', 'production_platform', 'grouted_pile_foundation', 'offshore_grouted_pile', 'grouted_pile_annulus', 'Steel pile / Epoxy grout', 'paint_external', NULL, 'subsea_immersion', 'foundation_support_pile', 'static_long_term_durability', ARRAY['Grout failure','Pile cracking','Annulus corrosion'], ARRAY['Grout shrinkage','Pile fatigue','Debonding attack'], ARRAY['Underwater UT','ROV visual inspection','Impact echo test'], ARRAY['Acoustic survey','Sediment inspection'], ARRAY['Grout condition','Pile wall thickness','Crack indications','Annulus water'], ARRAY['Grout separation','Pile cracks visible','Hollow sound','Paint loss'], ARRAY['Debond area >3 sq ft','Crack indication present','Water in annulus'], ARRAY['Re-grout pile','Install tremie tube','Seal annulus','Inspect pile'], ARRAY['Better grouting procedure','Quality grout spec','Process control','Design optimization'], 'HIGH', 0.79
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'offshore', 'production_platform', 'conductor_guide_frame', 'offshore_conductor_guide', 'conductor_guide_connection', 'Carbon steel guide', 'paint_system', NULL, 'marine_wave_zone', 'conductor_drilling_guide', 'fatigue_cyclic_movement', ARRAY['Fatigue cracking','Weld defects','Connector wear'], ARRAY['Cyclic conductor movement','Weld stress','Contact fatigue'], ARRAY['Visual inspection','FMD magnetic inspection','UT thickness mapping'], ARRAY['Radiography','Ultrasonic array'], ARRAY['Crack indications','Weld quality','Wear pattern','Paint state'], ARRAY['Visible cracks','Wear marks','Paint loss','Metal fatigue surface'], ARRAY['PT indication >0.5 in','Paint loss >1.5 sq ft','Wear depth >0.025 in'], ARRAY['Grind and re-weld','Replace guide','Repair painting','Monitor fatigue'], ARRAY['Better guide design','PWHT guide welds','Quality paint','Fatigue analysis'], 'MEDIUM', 0.75
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'offshore', 'production_platform', 'deck_drain', 'offshore_deck_drain', 'deck_drain_penetration', 'Steel structure / Stainless drain', 'paint_external', NULL, 'seawater_immersion_drainage', 'platform_drainage_system', 'static_water_contact', ARRAY['Corrosion at penetration','Drain blockage','Seepage'], ARRAY['Crevice corrosion','Drain line attack','Sediment accumulation'], ARRAY['Visual inspection','UT thickness mapping','Leak test'], ARRAY['Eddy current','Sediment inspection'], ARRAY['Penetration condition','Wall thickness','Drain status','Leak indicators'], ARRAY['Visible corrosion','Drain sluggish','Paint loss','Seepage staining'], ARRAY['UT loss >0.020 in','Drain blocked >50%','Active leak >0.5 drops/min'], ARRAY['Repair penetration','Clean drain line','Improve seal','Increase monitoring'], ARRAY['Better penetration design','Quality drain design','Protective coating','Regular cleaning schedule'], 'MEDIUM', 0.72
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'offshore', 'production_platform', 'leg_node_joint', 'offshore_leg_node', 'leg_brace_node_intersection', 'API Grade 50 steel', 'paint_system', NULL, 'high_energy_wave_zone', 'platform_leg_structure', 'fatigue_cyclic_wave', ARRAY['Fatigue cracking','Node failure','Brace cracks'], ARRAY['Stress concentration','Cyclic wave loading','Weld defect'], ARRAY['FMD magnetic inspection','ACFM inspection','ROV visual inspection'], ARRAY['Radiography','Ultrasonic array'], ARRAY['Crack indications','Weld quality','Node geometry','Wave loading'], ARRAY['Visible cracks','Paint cracking','Metal fatigue surface','Service corrosion'], ARRAY['FMD indication >0.75 in','Visual crack >0.5 in','Service cycles exceeded'], ARRAY['Install crack arrest','Perform PWHT','Monitor crack growth','Reduce loading'], ARRAY['API node design','PWHT all node welds','Quality control','Fatigue analysis'], 'CRITICAL', 0.87
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'civil_infrastructure', 'steel_bridge', 'bearing_plate', 'bridge_bearing', 'bearing_plate_anchor_bolt', 'ASTM A572 Grade 50', 'paint_system', NULL, 'weather_exposure', 'bridge_bearing_system', 'static_vibration_corrosion', ARRAY['Corrosion','Fretting at bearing','Anchor bolt failure'], ARRAY['Moisture attack','Vibration wear','Paint disbondment'], ARRAY['Visual inspection','UT thickness mapping','Hammer test'], ARRAY['Anchor bolt inspection','Ultrasonic thickness'], ARRAY['Corrosion pattern','Bearing condition','Bolt status','Paint state'], ARRAY['Visible corrosion','Rust staining','Loose bearing','Paint loss'], ARRAY['Corrosion >25% section loss','Bearing slack >0.1 in','Bolt corrosion >30%'], ARRAY['Blast and repaint','Replace bearings','Tighten/replace bolts','Monitor condition'], ARRAY['Better paint system','Protective bearing covers','Quality paint maintenance','Regular inspections'], 'HIGH', 0.78
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'civil_infrastructure', 'steel_bridge', 'expansion_joint', 'bridge_expansion_joint', 'joint_opening_zone', 'ASTM A36 structure / Elastomer joint', 'paint_system', NULL, 'weather_thermal_cycling', 'bridge_movement_joint', 'cyclic_movement_wear', ARRAY['Fatigue cracking','Joint debris','Corrosion under joint'], ARRAY['Cyclic joint movement','Debris accumulation','Water ingress'], ARRAY['Visual inspection','UT thickness mapping','Load test'], ARRAY['Joint opening measurement','Ultrasonic array'], ARRAY['Joint function','Crack indications','Paint state','Debris amount'], ARRAY['Visible cracks','Debris clogged joint','Paint loss','Corrosion under joint'], ARRAY['Crack indication >0.5 in','Joint debris >50% blockage','Paint loss >1 sq ft'], ARRAY['Clean joint','Replace joint seal','Repair adjacent corrosion','Repaint'], ARRAY['Better joint design','Improved drainage','Quality paint system','Regular maintenance'], 'HIGH', 0.77
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'civil_infrastructure', 'steel_bridge', 'gusset_plate', 'bridge_gusset', 'gusset_plate_connection', 'ASTM A36 / A572 Grade 50', 'paint_system', NULL, 'weather_stress_cycling', 'bridge_connection_gusset', 'fatigue_stress_concentration', ARRAY['Fatigue cracking','Weld cracking','Bolt failure'], ARRAY['Stress concentration','Cyclic loading','Fatigue initiation'], ARRAY['MT/PT inspection','PAUT','Bolt inspection'], ARRAY['Radiography','Ultrasonic array'], ARRAY['Crack indications','Weld quality','Bolt status','Paint condition'], ARRAY['Visible cracks','Paint cracking','Bolt corrosion','Metal fatigue surface'], ARRAY['PT indication >0.5 in','Bolt corrosion >25%','Paint loss >1 sq ft'], ARRAY['Grind and re-weld','Replace bolts','Stress relief if needed','Repaint'], ARRAY['Better connection design','PWHT critical welds','Quality bolts','Paint maintenance'], 'CRITICAL', 0.84
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'civil_infrastructure', 'steel_bridge', 'coverplate_termination', 'bridge_coverplate', 'coverplate_end_zone', 'ASTM A36 structure', 'paint_system', NULL, 'weather_cycling', 'bridge_member_reinforce', 'fatigue_stress_riser', ARRAY['Fatigue cracking','Stress concentration','Bolt failure'], ARRAY['Cyclic loading','Stress riser','Weld defect'], ARRAY['MT/PT inspection','UT thickness mapping','Bolt inspection'], ARRAY['Radiography','Bolt torque check'], ARRAY['Crack indications','Stress concentration','Bolt status','Paint state'], ARRAY['Visible cracks','Paint loss','Bolt corrosion','Stress staining'], ARRAY['PT indication >0.75 in','Bolt corrosion >30%','Paint loss >2 sq ft'], ARRAY['Grind and re-weld','Replace bolts','Install coverplate extension','Repaint'], ARRAY['Better termination design','PWHT coverplate welds','Quality bolts','Paint maintenance'], 'HIGH', 0.8
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'civil_infrastructure', 'reinforced_concrete_bridge', 'deck_rebar', 'bridge_deck_rebar', 'concrete_deck_reinforcement', 'Reinforced concrete deck', NULL, NULL, 'deicing_salt_exposure', 'bridge_deck', 'chloride_ingress_corrosion', ARRAY['Rebar corrosion','Delamination','Spalling'], ARRAY['Chloride-induced corrosion','Concrete deterioration','Expansive rust'], ARRAY['GPR scanning','Half-cell potential survey','Chain drag test'], ARRAY['Concrete core sampling','Chloride analysis'], ARRAY['Rebar corrosion extent','Delamination area','Concrete chloride','Crack pattern'], ARRAY['Spalling visible','Rebar exposed','Delamination sound','Rust staining'], ARRAY['Delamination area >10 sq ft','Rebar corrosion >50%','Surface chloride >threshold'], ARRAY['Concrete repair/overlay','Seal deck','Cathodic protection','Drainage improvement'], ARRAY['Corrosion protection design','Quality concrete','Drainage system','Protective overlay'], 'HIGH', 0.82
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'civil_infrastructure', 'reinforced_concrete_bridge', 'pier_splash_zone', 'bridge_pier_splash', 'pier_splash_zone_concrete', 'Reinforced concrete pier', NULL, NULL, 'splash_zone_freeze_thaw', 'bridge_pier_foundation', 'freeze_thaw_deterioration', ARRAY['Concrete deterioration','Spalling','Rebar exposure'], ARRAY['Freeze-thaw cycling','Salt scaling','Material loss'], ARRAY['Visual inspection','Hammer test','Core sampling'], ARRAY['Durometer testing','Chloride testing'], ARRAY['Deterioration pattern','Material loss depth','Rebar condition','Concrete quality'], ARRAY['Visible spalling','Material loss','Rebar exposed','Scaling pattern'], ARRAY['Spall depth >0.5 in','Material loss >3 sq ft','Rebar exposed'], ARRAY['Concrete repair','Surface coating','Install de-icing protection','Monitor progression'], ARRAY['Quality concrete design','Air entrainment','Protective coating','Drainage improvement'], 'HIGH', 0.79
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'civil_infrastructure', 'cable_stayed_bridge', 'cable_anchorage', 'bridge_cable_anchorage', 'cable_anchorage_socket', 'High-strength steel cable / Cast steel socket', 'paint_system', NULL, 'weather_vibration_tension', 'bridge_cable_support', 'fatigue_stress_corrosion', ARRAY['Corrosion','Fatigue cracking','Socket failure'], ARRAY['Stress concentration','Vibration fatigue','Corrosive environment'], ARRAY['Visual inspection','MT inspection','Acoustic emission'], ARRAY['Radiography','Ultrasonic thickness'], ARRAY['Crack indications','Corrosion pattern','Cable condition','Socket integrity'], ARRAY['Visible cracks','Corrosion staining','Cable fraying','Socket deterioration'], ARRAY['MT indication >0.5 in','Corrosion >25% section loss','Cable damage >0.25 in'], ARRAY['Replace cable anchorage','Protective coating','Monitor stress','Emergency support'], ARRAY['Better anchorage design','Quality paint system','Cable protection','Regular inspection'], 'CRITICAL', 0.85
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'civil_infrastructure', 'steel_bridge', 'deck_drainage', 'bridge_drainage', 'drainage_point_penetration', 'Steel structure / Stainless drain', 'paint_system', NULL, 'deicing_salt_water_drainage', 'bridge_drainage_system', 'static_corrosive_drainage', ARRAY['Corrosion at drainage point','Drain blockage','Water pooling'], ARRAY['Corrosive water contact','Sediment accumulation','Chloride attack'], ARRAY['Visual inspection','UT thickness mapping','Drain flow check'], ARRAY['Water sample testing','Sediment inspection'], ARRAY['Drainage condition','Wall thickness','Water pooling','Chloride content'], ARRAY['Visible corrosion','Drain clogged','Standing water','Rust staining'], ARRAY['UT loss >0.030 in','Drain blockage >70%','Standing water >0.5 inch'], ARRAY['Repair drainage','Clean drain system','Protective coating','Improve design'], ARRAY['Better drainage design','Improved materials','Quality coating','Regular maintenance'], 'MEDIUM', 0.73
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'coated_insulated_buried', 'generic_coated_asset', 'coating_at_weld', 'coating_at_weld', 'weld_bead_coating', 'Coated steel structure', 'industrial_paint_coating', NULL, 'weather_industrial', NULL, 'static_exposure', ARRAY['Disbondment','Holiday','Lack of coverage'], ARRAY['Coating process defect','Paint adhesion loss','Spray miss'], ARRAY['Holiday detection','Adhesion test','Visual inspection'], ARRAY['Coating thickness gauge','Pull-off test'], ARRAY['Coating integrity','Holiday location','Adhesion strength','Weld geometry'], ARRAY['Visible coating loss','Holiday detected','Corrosion staining','Coating failure'], ARRAY['Holiday area >0.5 in diameter','Adhesion failure >25%','Coating thickness <minimum'], ARRAY['Apply touch-up paint','Blast and re-coat','Repair weld coating','Inspect for defects'], ARRAY['Better application technique','Quality control inspection','Surface prep procedure','Coating specification'], 'HIGH', 0.8
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'coated_insulated_buried', 'generic_coated_asset', 'coating_at_edge', 'coating_at_edge', 'sharp_edge_corner_coverage', 'Coated steel asset', 'industrial_paint_coating', NULL, 'weather_exposure', NULL, 'edge_exposure', ARRAY['Coating recession','Thin coverage','Holiday at edge'], ARRAY['Edge build limitation','Paint flow-out','Spray shadowing'], ARRAY['DFT gauge','Holiday detection','Visual inspection'], ARRAY['Adhesion test','Coating pull-off'], ARRAY['Coating thickness','Holiday location','Edge geometry','Paint flow pattern'], ARRAY['Thin coating visible','Holiday at edge','Paint recession','Corrosion starting'], ARRAY['Coating thickness <75% minimum','Holiday >0.5 in','Edge recession >0.1 in'], ARRAY['Apply additional coat','Round sharp edges','Spray technique improvement','Repair coating'], ARRAY['Edge rounding design','Better spray technique','High-build coatings','Quality control'], 'MEDIUM', 0.74
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'coated_insulated_buried', 'insulated_piping', 'insulation_low_point', 'insulation_low_point', 'insulation_low_accumulation_zone', 'Insulated carbon steel pipe', 'external_cladding', 'mineral_fiber_insulation', 'wet_insulation_low_point', 'thermal_insulation', 'crevice_corrosion_wet', ARRAY['CUI concentration','Under-insulation attack','Accelerated loss'], ARRAY['Pitting under insulation','Moisture concentration','Chloride attack'], ARRAY['PEC scanning','Radiography','Thermography'], ARRAY['Strip-and-inspect','Ultrasonic thickness'], ARRAY['Insulation condition','Wall thickness','Moisture presence','Corrosion depth'], ARRAY['Wet insulation','Dark staining','Visible corrosion','Paint deterioration'], ARRAY['PEC signal >20% loss','UT reading <nominal -0.060 in','Pit depth >0.080 in confirmed'], ARRAY['Remove and replace insulation','Apply protective coating','Install insulation support','Increase monitoring'], ARRAY['Better CUI coating','Improved insulation design','Drainage detail','Regular inspection'], 'CRITICAL', 0.86
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'coated_insulated_buried', 'insulated_piping', 'insulation_protrusion', 'insulation_protrusion', 'pipe_shoe_insulation_interface', 'Insulated carbon steel pipe', 'external_cladding', 'mineral_fiber_insulation', 'moisture_ingress_shoe', 'thermal_insulation', 'water_ingress_crevice', ARRAY['Water ingress','CUI at shoe','Pitting'], ARRAY['Moisture penetration','Pipe shoe gap','Crevice formation'], ARRAY['PEC scanning','Thermography','Strip-and-inspect'], ARRAY['Visual inspection','Ultrasonic thickness'], ARRAY['Insulation integrity','Wall thickness','Moisture presence','Gap size'], ARRAY['Water seeping','Dark staining','Visible corrosion','Insulation separation'], ARRAY['Water ingress confirmed','UT loss >0.040 in','Gap >0.25 in'], ARRAY['Seal shoe/insulation gap','Replace insulation','Apply protective coating','Improve drainage'], ARRAY['Better pipe shoe design','Improved sealing detail','Protective coating','Material upgrade'], 'HIGH', 0.82
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'coated_insulated_buried', 'insulated_piping', 'insulation_at_flange', 'insulation_at_flange', 'insulation_termination_flange_area', 'Insulated carbon steel pipe', 'external_cladding', 'mineral_fiber_insulation', 'water_ingress_termination', 'thermal_insulation', 'moisture_penetration_crevice', ARRAY['Water ingress','CUI at termination','Flange corrosion'], ARRAY['Moisture penetration','Insulation gap','Crevice under insulation'], ARRAY['PEC scanning','Thermography','Visual inspection'], ARRAY['Strip-and-inspect','Ultrasonic thickness'], ARRAY['Insulation condition','Wall thickness','Moisture presence','Termination design'], ARRAY['Water seeping','Visible corrosion','Dark staining','Insulation separation'], ARRAY['Water detected','UT loss >0.035 in','Insulation gap >0.5 in'], ARRAY['Seal insulation gap','Apply protective coating','Replace termination detail','Increase monitoring'], ARRAY['Better termination design','Improved sealing','Protective coating system','Material upgrade'], 'HIGH', 0.8
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'coated_insulated_buried', 'buried_pipeline', 'casing_crossing', 'buried_casing', 'road_rail_casing_junction', 'API linepipe in steel casing', 'external_coating', NULL, 'buried_soil_wet', 'utility_crossing', 'static_soil_contact', ARRAY['Corrosion in casing','Casing wall loss','CP inadequacy'], ARRAY['Trapped moisture','Soil electrolyte','Differential aeration'], ARRAY['DCVG survey','CIPS measurement','UT at dig location'], ARRAY['Soil resistivity','Potential survey'], ARRAY['Wall thickness','CP protection','Soil moisture','Coating condition'], ARRAY['Corrosion visible at dig','Low CP potential','Wet soil present','Rust staining'], ARRAY['UT loss >0.060 in','CP potential <-600 mV CSE','Water in casing'], ARRAY['Increase CP current','Improve drainage','Protective coating repair','Monitor regularly'], ARRAY['Better casing design','CP system optimization','Drainage detail','Quality coating'], 'HIGH', 0.81
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'coated_insulated_buried', 'buried_pipeline', 'coating_holiday_buried', 'buried_coating_defect', 'coating_holiday_buried_line', 'API linepipe', 'external_3_layer_coating', NULL, 'buried_moist_soil', 'subsurface_pipeline', 'localized_holiday_corrosion', ARRAY['Localized corrosion','Pit formation','Accelerated loss'], ARRAY['Coating holiday','Soil electrolyte','Differential aeration'], ARRAY['DCVG/ACVG survey','CIPS measurement','UT at dig'], ARRAY['Holiday detection','Potential survey'], ARRAY['Holiday location','Wall thickness','CP protection','Corrosion depth'], ARRAY['Low potential zone','Corrosion visible at dig','Holiday detected','Pitting pattern'], ARRAY['Holiday area >0.5 in diameter','UT loss >0.100 in localized','CP potential <-750 mV CSE'], ARRAY['Exhume and repair','Install local anode','Increase CP','Monitor closely'], ARRAY['Better coating system','Improved application QA','CP optimization','Regular surveys'], 'HIGH', 0.83
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'coated_insulated_buried', 'buried_pipeline', 'dissimilar_soil', 'buried_dissimilar_soil', 'soil_resistivity_change_zone', 'API linepipe', 'external_coating', NULL, 'dissimilar_soil_resistivity', 'subsurface_pipeline', 'differential_aeration_corrosion', ARRAY['Differential corrosion','Accelerated loss','Pitting'], ARRAY['Soil resistivity gradient','Differential aeration','Oxygen variation'], ARRAY['Soil resistivity survey','CIPS measurement','UT at change zone'], ARRAY['Potential survey','Soil testing'], ARRAY['Resistivity values','Wall thickness','CP protection','Soil characteristics'], ARRAY['Corrosion concentrated at transition','Potential gradient visible','Soil type change','Pitting pattern'], ARRAY['Resistivity change >5:1 ratio','UT loss >0.070 in','CP gradient >0.3V'], ARRAY['Increase anode density','Improve CP coverage','Dig and inspect','Upgrade coating'], ARRAY['Better CP design for gradient','Soil management','Quality coating','Regular monitoring'], 'HIGH', 0.79
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'coated_insulated_buried', 'buried_pipeline', 'ac_interference', 'buried_ac_interference', 'parallel_power_line_zone', 'API linepipe / Power line proximity', 'external_coating', NULL, 'ac_current_interference_zone', 'subsurface_pipeline', 'ac_induced_corrosion', ARRAY['AC corrosion','Accelerated loss','Deep pitting'], ARRAY['AC current coupling','Electrochemical acceleration','Pit propagation'], ARRAY['AC/DC potential survey','Current measurement','UT inspection'], ARRAY['Coupon monitoring','Power line survey'], ARRAY['AC voltage present','Wall thickness','Corrosion depth','Coupling assessment'], ARRAY['Accelerated corrosion visible','AC voltage detected','Pitting pattern','Deep pits'], ARRAY['AC voltage >10V AC','Corrosion rate >5x normal','Pit depth >0.150 in'], ARRAY['Install decoupling devices','Improve CP','Increase anode density','Monitor AC'], ARRAY['Decoupling grounding design','CP system upgrade','Power line coordination','Cathodic shielding'], 'HIGH', 0.8
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'coated_insulated_buried', 'buried_pipeline', 'foreign_utility_crossing', 'buried_foreign_crossing', 'utility_crossing_contact_zone', 'API linepipe / Other utility', 'external_coating', NULL, 'foreign_utility_contact_zone', 'utility_crossing', 'mechanical_contact_corrosion', ARRAY['Coating damage','Metal loss at contact','Accelerated corrosion'], ARRAY['Mechanical contact','Abrasion','Crevice formation'], ARRAY['DCVG/ACVG survey','CIPS measurement','UT at crossing'], ARRAY['Visual inspection at dig','Coating condition check'], ARRAY['Coating integrity','Wall thickness','Contact extent','Corrosion morphology'], ARRAY['Coating loss at contact','Metal sheen','Corrosion staining','Abrasion marks'], ARRAY['Coating loss >1 in area','UT loss >0.050 in localized','Contact wear >0.25 in'], ARRAY['Repair coating','Increase anode locally','Separate utilities','Monitor closely'], ARRAY['Better crossing design','Protective sleeves','CP optimization','Regular monitoring'], 'MEDIUM', 0.76
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'composites_special', 'composite_structure', 'impact_damage', 'composite_impact', 'low_velocity_impact_zone', 'Carbon fiber composite laminate', NULL, NULL, 'mechanical_impact_exposure', 'composite_structure', 'impact_delamination_damage', ARRAY['Delamination','Matrix cracking','Fiber breakage'], ARRAY['Low-velocity impact','Interlaminar failure','Matrix degradation'], ARRAY['UT C-scan','Tap test','Thermography'], ARRAY['Visual inspection','DMA testing'], ARRAY['Delamination size','Damage depth','Fiber condition','Matrix state'], ARRAY['Visible impact mark','Soft spot on tap','Thermal signature','Surface deflection'], ARRAY['Delamination area >2 sq in','Depth >50% laminate','Fiber visible breakage'], ARRAY['Localized patch repair','Surface resin coat','Ply replacement','Increase inspection'], ARRAY['Impact-resistant design','Protective covering','Quality manufacturing','Regular inspection'], 'HIGH', 0.79
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'composites_special', 'composite_structure', 'uv_weathering', 'composite_uv', 'weathered_surface_exposure', 'Carbon fiber composite laminate', 'external_resin_matrix', NULL, 'uv_weather_exposure', 'composite_structure', 'environmental_degradation', ARRAY['Matrix degradation','Resin cracking','Color fading'], ARRAY['UV absorption','Resin photo-oxidation','Loss of properties'], ARRAY['Visual inspection','Barcol hardness test','DMA testing'], ARRAY['Microscopy','Weight loss measurement'], ARRAY['Surface degradation','Hardness loss','Fiber condition','Resin state'], ARRAY['Color fading','Visible cracking','Soft surface','Material embrittlement'], ARRAY['Hardness loss >15%','Cracking visible on surface','Property loss trending'], ARRAY['Apply UV protective coating','Surface sealing','Increase inspection','Schedule replacement'], ARRAY['Better resin system','UV protective coating','Maintenance schedule','Design for durability'], 'MEDIUM', 0.74
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'composites_special', 'hdpe_pipeline', 'squeeze_off', 'hdpe_squeeze', 'squeeze_off_contact_zone', 'HDPE polyethylene pipe', NULL, NULL, 'squeeze_off_service', 'hdpe_squeeze_off_area', 'localized_compressive_stress', ARRAY['Stress whitening','Creep','Failure'], ARRAY['Compressive stress','Long-term creep','Material softening'], ARRAY['Visual inspection','Squeeze-off log','UT thickness mapping'], ARRAY['Microscopy','Hardness test'], ARRAY['Stress history','Wall thickness','Whitening extent','Creep pattern'], ARRAY['Visible whitening','Deformation','Material softening','Creep marks'], ARRAY['Whitening >50% area','Wall thickness <nominal -0.025 in','Creep rate increasing'], ARRAY['Monitor closely','Reduce squeeze time','Replace line section','Lower squeeze pressure'], ARRAY['Better squeeze-off design','Gradual pressure ramp','Regular monitoring','Material selection'], 'MEDIUM', 0.72
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'composites_special', 'hdpe_pipeline', 'electrofusion_joint', 'hdpe_electrofusion', 'electrofusion_weld_zone', 'HDPE pipe with electrofusion coupler', NULL, NULL, 'electrofusion_joint_service', 'hdpe_electrofusion_coupling', 'thermal_stress_joint', ARRAY['Incomplete fusion','Weak joint','Leakage'], ARRAY['Insufficient fusion energy','Joint cooling issue','Process parameter variation'], ARRAY['Visual inspection','Peel test','Ultrasonic testing'], ARRAY['Pressure test','Thermal imaging'], ARRAY['Fusion quality','Joint strength','Wall thickness','Pressure test result'], ARRAY['Visible defect','Peel separation','Leaking joint','Temperature gradient'], ARRAY['Peel strength <minimum','Leak rate >0.5 drops/min','Thermal mismatch >50°F'], ARRAY['Replace joint','Perform peel test','Monitor pressure','Investigate fusion'], ARRAY['Better fusion procedure','Quality control testing','Equipment calibration','Operator training'], 'HIGH', 0.78
);

INSERT INTO cfi_context_patterns (
  domain, asset_type, component, location_context, geometry_context, material,
  coating_context, insulation_context, environment_context, process_context, loading_context,
  common_failure_modes, likely_damage_mechanisms, primary_ndt_methods, secondary_ndt_methods,
  evidence_required, risk_indicators, escalation_triggers, recommended_actions, prevention_actions,
  severity_default, confidence_weight
) VALUES (
  'composites_special', 'frp_pipeline', 'chemical_degradation', 'frp_chemical', 'chemical_contact_zone', 'Fiberglass reinforced polyester pipe', 'polyester_resin_matrix', NULL, 'chemical_internal_contact', 'frp_chemical_service', 'resin_barrier_degradation', ARRAY['Resin degradation','Fiber exposure','Leakage'], ARRAY['Chemical attack','Matrix dissolution','Fiber corrosion'], ARRAY['Visual inspection','Barcol hardness test','Spark test'], ARRAY['Weight loss measurement','Chemical analysis'], ARRAY['Resin condition','Hardness','Wall thickness','Chemical compatibility'], ARRAY['Visible degradation','Soft resin','Fiber visible','Leakage present'], ARRAY['Hardness loss >25%','Fiber exposure visible','Leak rate >0.25 drops/min'], ARRAY['Replace pipe section','Protective barrier coating','Reduce chemical concentration','Monitor closely'], ARRAY['Chemical-resistant resin','Barrier layer design','Material selection','Regular inspection'], 'HIGH', 0.8
);

