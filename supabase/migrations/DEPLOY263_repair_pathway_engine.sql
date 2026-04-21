-- DEPLOY263: Repair Pathway Engine v1.0.0
-- Turns every reject into an actionable repair plan.
-- Accept / Repair / Reject / Cut-Out-and-Rerun with prerequisites.
-- Tracks repair count per location (D1.1 two-repair max rule).
-- Code-specific repair requirements and re-inspection mandates.

-- ============================================================
-- TABLE 1: repair_method_registry
-- All known repair methods with applicability and constraints
-- ============================================================
CREATE TABLE IF NOT EXISTS repair_method_registry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  method_code TEXT NOT NULL UNIQUE,
  method_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('excavation_and_reweld', 'grinding', 'buildup', 'cut_out_and_rerun', 'heat_treatment', 'peening', 'blend_grinding', 'weld_overlay', 'mechanical_repair', 'full_replacement')),
  description TEXT NOT NULL,
  applicable_discontinuities TEXT[] NOT NULL,
  applicable_processes TEXT[] DEFAULT ARRAY['SMAW', 'GMAW', 'FCAW', 'GTAW', 'SAW'],
  applicable_materials TEXT[] DEFAULT ARRAY['carbon_steel', 'low_alloy', 'stainless_austenitic'],
  prerequisites TEXT[] NOT NULL,
  procedure_steps TEXT[] NOT NULL,
  reinspection_required TEXT[] NOT NULL,
  code_references TEXT[] DEFAULT ARRAY[]::TEXT[],
  risk_level TEXT NOT NULL DEFAULT 'moderate' CHECK (risk_level IN ('low', 'moderate', 'high', 'critical')),
  typical_success_rate NUMERIC,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE repair_method_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "repair_methods_read" ON repair_method_registry FOR SELECT USING (true);

-- ============================================================
-- TABLE 2: repair_prerequisites
-- Specific prerequisites that must be verified before repair
-- ============================================================
CREATE TABLE IF NOT EXISTS repair_prerequisites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prerequisite_code TEXT NOT NULL UNIQUE,
  prerequisite_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('wps_qualification', 'welder_qualification', 'material_verification', 'excavation_verification', 'preheat', 'nde_verification', 'engineering_approval', 'safety', 'equipment', 'documentation')),
  description TEXT NOT NULL,
  verification_method TEXT NOT NULL,
  is_mandatory BOOLEAN DEFAULT true,
  applicable_codes TEXT[] DEFAULT ARRAY['AWS_D1.1', 'API_1104', 'ASME_VIII', 'ASME_B31.3'],
  failure_consequence TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE repair_prerequisites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "repair_prerequisites_read" ON repair_prerequisites FOR SELECT USING (true);

-- ============================================================
-- TABLE 3: repair_code_rules
-- Code-specific repair rules and limits
-- ============================================================
CREATE TABLE IF NOT EXISTS repair_code_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code_family TEXT NOT NULL,
  rule_code TEXT NOT NULL UNIQUE,
  rule_name TEXT NOT NULL,
  rule_description TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('repair_limit', 'method_restriction', 'reinspection_requirement', 'approval_requirement', 'preheat_requirement', 'pwht_requirement', 'documentation_requirement', 'time_restriction')),
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_mandatory BOOLEAN DEFAULT true,
  clause_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE repair_code_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "repair_code_rules_read" ON repair_code_rules FOR SELECT USING (true);

-- ============================================================
-- TABLE 4: repair_pathway_assessments
-- Generated repair plans for rejected welds
-- ============================================================
CREATE TABLE IF NOT EXISTS repair_pathway_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  assessment_id UUID,
  case_id UUID,
  disposition TEXT NOT NULL CHECK (disposition IN ('repair', 'cut_out_and_rerun', 'engineering_review', 'accept_as_is', 'full_replacement')),
  discontinuities JSONB NOT NULL DEFAULT '[]'::jsonb,
  weld_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  repair_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  prerequisites_checked JSONB NOT NULL DEFAULT '[]'::jsonb,
  all_prerequisites_met BOOLEAN DEFAULT false,
  code_rules_applied JSONB NOT NULL DEFAULT '[]'::jsonb,
  repair_count_at_location INTEGER NOT NULL DEFAULT 0,
  max_repairs_allowed INTEGER NOT NULL DEFAULT 2,
  repair_limit_exceeded BOOLEAN DEFAULT false,
  reinspection_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  estimated_difficulty TEXT CHECK (estimated_difficulty IN ('straightforward', 'moderate', 'complex', 'requires_specialist')),
  teaching_notes TEXT,
  generated_by TEXT DEFAULT 'system',
  generated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE repair_pathway_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "repair_pathways_org" ON repair_pathway_assessments FOR ALL USING (
  org_id IS NULL OR org_id = ((auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
);

-- ============================================================
-- TABLE 5: repair_history
-- Tracks all repairs performed at a location
-- ============================================================
CREATE TABLE IF NOT EXISTS repair_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  case_id UUID,
  assessment_id UUID,
  weld_id TEXT,
  location_id TEXT,
  repair_number INTEGER NOT NULL DEFAULT 1,
  repair_method TEXT NOT NULL,
  discontinuity_repaired TEXT NOT NULL,
  repair_wps TEXT,
  repaired_by TEXT,
  repaired_at TIMESTAMPTZ,
  reinspection_method TEXT,
  reinspection_result TEXT CHECK (reinspection_result IN ('acceptable', 'rejectable', 'pending', 'not_performed')),
  reinspected_by TEXT,
  reinspected_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE repair_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "repair_history_org" ON repair_history FOR ALL USING (
  org_id IS NULL OR org_id = ((auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
);

-- ============================================================
-- TABLE 6: repair_audit_events
-- ============================================================
CREATE TABLE IF NOT EXISTS repair_audit_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  assessment_id UUID,
  event_type TEXT NOT NULL CHECK (event_type IN ('pathway_generated', 'prerequisite_checked', 'repair_started', 'repair_completed', 'reinspection_performed', 'repair_limit_warning', 'engineering_approval_requested', 'plan_overridden')),
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE repair_audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "repair_audit_org" ON repair_audit_events FOR ALL USING (
  org_id IS NULL OR org_id = ((auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
);

-- ============================================================
-- SEED DATA: Repair Methods
-- ============================================================
INSERT INTO repair_method_registry (method_code, method_name, category, description, applicable_discontinuities, applicable_processes, applicable_materials, prerequisites, procedure_steps, reinspection_required, code_references, risk_level, typical_success_rate) VALUES

('RM-001', 'Arc Gouge and Reweld', 'excavation_and_reweld',
 'Remove defective weld metal by carbon arc gouging, grind to sound metal, verify complete removal by MT/PT, reweld per qualified WPS',
 ARRAY['crack', 'incomplete_fusion', 'incomplete_penetration', 'slag_inclusion', 'porosity_cluster'],
 ARRAY['SMAW', 'GMAW', 'FCAW', 'GTAW', 'SAW'],
 ARRAY['carbon_steel', 'low_alloy', 'stainless_austenitic', 'stainless_ferritic'],
 ARRAY['Qualified repair WPS', 'Qualified welder for repair process', 'MT or PT dye available', 'Preheat per WPS if required', 'Carbon arc gouging equipment'],
 ARRAY['Mark extent of defect with soapstone', 'Preheat to WPS minimum if required', 'Carbon arc gouge to remove defective area plus 1/2 in beyond each end', 'Grind gouged surface to bright metal — remove all carbon deposits', 'MT or PT to verify complete defect removal', 'Reweld per qualified WPS maintaining interpass temperature', 'Visually inspect repair weld', 'Perform required NDE on completed repair'],
 ARRAY['VT of completed repair', 'Same NDE method that found original defect', 'RT or UT if original joint required volumetric examination'],
 ARRAY['AWS D1.1 Clause 5.24', 'API 1104 Section 9.7', 'ASME VIII UW-40'],
 'moderate', 85),

('RM-002', 'Grind and Reweld', 'excavation_and_reweld',
 'Remove defective area by grinding (no gouging), verify removal, reweld. Used for shallow surface defects where gouging would remove too much base metal.',
 ARRAY['undercut', 'overlap', 'excessive_reinforcement', 'arc_strike', 'surface_porosity', 'underfill'],
 ARRAY['SMAW', 'GMAW', 'FCAW', 'GTAW', 'SAW'],
 ARRAY['carbon_steel', 'low_alloy', 'stainless_austenitic', 'stainless_ferritic', 'aluminum', 'nickel_alloy'],
 ARRAY['Qualified repair WPS', 'Qualified welder', 'Grinding equipment with appropriate disc', 'PT dye for verification'],
 ARRAY['Mark extent of defect', 'Grind to remove defect — maintain smooth contour, no sharp notches', 'Verify minimum wall thickness maintained after grinding', 'PT to verify complete removal', 'Reweld per WPS if material was removed below minimum', 'Blend grind toes of repair to smooth transition'],
 ARRAY['VT of completed repair', 'PT of repaired area'],
 ARRAY['AWS D1.1 Clause 5.24', 'ASME VIII UW-40'],
 'low', 95),

('RM-003', 'Blend Grinding Only', 'blend_grinding',
 'Remove defect by grinding without rewelding. Applicable only when remaining thickness meets minimum requirements after grinding.',
 ARRAY['undercut', 'excessive_reinforcement', 'overlap', 'arc_strike', 'spatter', 'surface_roughness'],
 ARRAY['SMAW', 'GMAW', 'FCAW', 'GTAW', 'SAW'],
 ARRAY['carbon_steel', 'low_alloy', 'stainless_austenitic', 'stainless_ferritic', 'aluminum', 'nickel_alloy', 'copper_alloy', 'titanium'],
 ARRAY['Verification that minimum thickness will be maintained', 'Grinding equipment'],
 ARRAY['Mark area to be ground', 'Grind with smooth radius — no sharp transitions or notches', 'Verify remaining thickness with UT if near minimum', 'Blend toes to 4:1 minimum taper ratio', 'VT finished surface'],
 ARRAY['VT of ground area', 'UT thickness if near minimum wall'],
 ARRAY['AWS D1.1 Clause 5.24', 'API 1104 Section 9.7'],
 'low', 98),

('RM-004', 'Cut Out and Rerun', 'cut_out_and_rerun',
 'Complete removal of the weld joint and rewelding from scratch. Required when defects are too extensive for local repair or when repair limit has been exceeded.',
 ARRAY['crack', 'incomplete_fusion', 'incomplete_penetration', 'extensive_porosity', 'multiple_defects'],
 ARRAY['SMAW', 'GMAW', 'FCAW', 'GTAW', 'SAW'],
 ARRAY['carbon_steel', 'low_alloy', 'stainless_austenitic', 'aluminum'],
 ARRAY['Qualified WPS for the joint', 'Qualified welder', 'Complete joint preparation tools', 'Engineering approval if repair limit exceeded', 'Fit-up verification capability'],
 ARRAY['Remove the entire weld by cutting or grinding back to base metal on both sides', 'Prepare new joint geometry per WPS', 'Verify fit-up dimensions', 'Preheat per WPS', 'Reweld complete joint per WPS', 'Full NDE as required by original joint specification'],
 ARRAY['Full VT of new weld', 'Same NDE scope as original joint requirement', 'RT or UT if originally required'],
 ARRAY['AWS D1.1 Clause 5.24.1', 'API 1104 Section 9.7.3'],
 'high', 90),

('RM-005', 'Weld Buildup (Underfill Repair)', 'buildup',
 'Add weld metal to bring undersized weld to required dimensions. Common for underfill, undersized fillets, and insufficient throat.',
 ARRAY['underfill', 'undersized_fillet', 'insufficient_throat'],
 ARRAY['SMAW', 'GMAW', 'FCAW', 'GTAW'],
 ARRAY['carbon_steel', 'low_alloy', 'stainless_austenitic', 'aluminum', 'nickel_alloy'],
 ARRAY['Qualified WPS', 'Qualified welder', 'Surface cleaning to bright metal before buildup'],
 ARRAY['Clean existing weld surface to bright metal — wire brush or grind', 'Preheat if required by WPS', 'Deposit additional weld metal per WPS', 'Maintain interpass temperature', 'Build to required dimension plus grinding allowance', 'Blend grind to required profile and dimensions', 'Verify final dimensions with gauges'],
 ARRAY['VT with dimensional verification', 'Gauge check of final weld size'],
 ARRAY['AWS D1.1 Clause 5.24'],
 'low', 92),

('RM-006', 'Back Gouge and Backweld', 'excavation_and_reweld',
 'Remove root side of weld by gouging from the back, then weld from the back side. Standard procedure for double-sided CJP groove welds.',
 ARRAY['incomplete_penetration', 'root_crack', 'root_porosity'],
 ARRAY['SMAW', 'GMAW', 'FCAW', 'GTAW', 'SAW'],
 ARRAY['carbon_steel', 'low_alloy', 'stainless_austenitic'],
 ARRAY['Access to back side of joint', 'Gouging equipment', 'Qualified WPS for backweld', 'MT or PT for verification'],
 ARRAY['Carbon arc gouge from root side — remove to sound weld metal', 'Grind gouged surface smooth — remove all carbon', 'MT or PT to verify complete removal of root defect', 'Preheat if required', 'Backweld per WPS', 'Grind flush if required'],
 ARRAY['VT of backweld', 'MT or PT of completed backweld', 'RT or UT if joint requires volumetric examination'],
 ARRAY['AWS D1.1 Clause 5.21', 'ASME VIII UW-40'],
 'moderate', 88),

('RM-007', 'Cosmetic Grinding', 'grinding',
 'Surface grinding for appearance only — removes spatter, discoloration, minor surface irregularities. No structural repair.',
 ARRAY['spatter', 'discoloration', 'surface_roughness', 'arc_strike'],
 ARRAY['SMAW', 'GMAW', 'FCAW', 'GTAW', 'SAW'],
 ARRAY['carbon_steel', 'low_alloy', 'stainless_austenitic', 'stainless_ferritic', 'aluminum', 'nickel_alloy', 'copper_alloy', 'titanium', 'duplex_ss'],
 ARRAY['Grinding equipment with appropriate disc for material'],
 ARRAY['Remove spatter with chisel or grinder', 'Grind arc strikes flush — verify no base metal reduction', 'For stainless: use stainless-only grinding disc to avoid carbon contamination', 'Wire brush to final finish'],
 ARRAY['VT of cleaned area'],
 ARRAY['AWS D1.1 Clause 5.24', 'AWS D1.6 Clause 7.3'],
 'low', 99),

('RM-008', 'PWHT After Repair', 'heat_treatment',
 'Post-weld heat treatment of the repair area. Required by code when original joint required PWHT, or when repair involves certain materials/thicknesses.',
 ARRAY['crack', 'hydrogen_damage', 'hardness_exceedance'],
 ARRAY['SMAW', 'GMAW', 'FCAW', 'GTAW', 'SAW'],
 ARRAY['carbon_steel', 'low_alloy', 'chrome_moly'],
 ARRAY['PWHT procedure qualified per code', 'Thermocouples and recording equipment', 'Insulation materials', 'Engineering approval for local PWHT if not furnace'],
 ARRAY['Attach thermocouples per procedure', 'Heat at controlled rate per code requirements', 'Hold at temperature for required time based on thickness', 'Cool at controlled rate', 'Record time-temperature chart', 'Hardness test after PWHT to verify effectiveness'],
 ARRAY['Hardness testing after PWHT', 'NDE after PWHT (repeat original NDE)', 'Review time-temperature records'],
 ARRAY['ASME VIII UCS-56', 'AWS D1.1 Clause 5.8', 'ASME B31.3 Clause 331'],
 'high', 90),

('RM-009', 'Overlay / Butter Layer', 'weld_overlay',
 'Weld overlay or butter layer for dissimilar metal joints, corrosion protection, or transition layers before final welding.',
 ARRAY['dissimilar_metal_cracking', 'corrosion_undercut', 'erosion_damage'],
 ARRAY['SMAW', 'GMAW', 'GTAW'],
 ARRAY['carbon_steel', 'low_alloy', 'stainless_austenitic', 'nickel_alloy', 'chrome_moly'],
 ARRAY['Qualified overlay WPS with specific filler metal', 'Qualified welder for overlay process', 'Chemical analysis verification capability'],
 ARRAY['Prepare surface to bright metal', 'Apply butter layer per WPS — minimum 2 layers typically required', 'Verify chemistry of deposit if required', 'Machine or grind to required dimensions', 'PWHT if required before final weld', 'Final weld per joint WPS'],
 ARRAY['PT of each overlay layer', 'Chemical analysis if required', 'VT and NDE of final joint'],
 ARRAY['ASME VIII UW-40', 'ASME IX QW-214'],
 'critical', 82),

('RM-010', 'Peening (Fatigue Improvement)', 'peening',
 'Mechanical peening of weld toes to introduce compressive residual stress and improve fatigue life. Not a defect repair — a fatigue improvement technique.',
 ARRAY['fatigue_improvement', 'toe_crack_prevention'],
 ARRAY['SMAW', 'GMAW', 'FCAW', 'GTAW', 'SAW'],
 ARRAY['carbon_steel', 'low_alloy', 'stainless_austenitic'],
 ARRAY['Peening procedure approved by Engineer', 'Appropriate peening tool (needle, hammer, or ultrasonic)', 'Coverage verification method'],
 ARRAY['Complete all welding and NDE before peening', 'Peen weld toes per approved procedure', 'Verify coverage — entire toe length treated', 'Verify indent depth meets procedure requirements', 'VT to confirm no damage to base metal'],
 ARRAY['VT of peened area', 'Coverage verification per procedure'],
 ARRAY['AWS D1.5 Clause 12', 'IIW recommendations'],
 'moderate', 95);

-- ============================================================
-- SEED DATA: Repair Prerequisites
-- ============================================================
INSERT INTO repair_prerequisites (prerequisite_code, prerequisite_name, category, description, verification_method, is_mandatory, applicable_codes, failure_consequence) VALUES

('PRQ-001', 'Repair WPS Qualified', 'wps_qualification',
 'A welding procedure specification qualified for the repair configuration must exist. Repair WPS may differ from original WPS.',
 'Verify WPS number, qualification record (PQR), and that essential variables cover the repair configuration',
 true, ARRAY['AWS_D1.1', 'API_1104', 'ASME_VIII', 'ASME_B31.3', 'ASME_IX'],
 'Repair weld is unqualified — weld must be removed and redone with qualified procedure'),

('PRQ-002', 'Welder Qualified for Repair Process', 'welder_qualification',
 'The welder performing the repair must be qualified for the repair process, position, and material thickness range.',
 'Verify welder qualification record covers the repair process (which may differ from original), position, and thickness',
 true, ARRAY['AWS_D1.1', 'API_1104', 'ASME_VIII', 'ASME_B31.3', 'ASME_IX'],
 'Welder is not qualified for repair — repair is invalid'),

('PRQ-003', 'Complete Defect Removal Verified', 'excavation_verification',
 'After excavation, the cavity must be examined by MT or PT to confirm all defective material has been removed.',
 'MT or PT of excavated cavity — no indications remaining in the prepared surface',
 true, ARRAY['AWS_D1.1', 'API_1104', 'ASME_VIII', 'ASME_B31.3'],
 'Incomplete removal means the defect will propagate through the repair weld'),

('PRQ-004', 'Preheat Applied Per WPS', 'preheat',
 'Preheat temperature must be at or above WPS minimum before repair welding begins.',
 'Temperature measurement by contact pyrometer or thermocouple — verify at preheat distance from repair area per code',
 true, ARRAY['AWS_D1.1', 'API_1104', 'ASME_VIII', 'ASME_B31.3'],
 'Cold repair increases risk of hydrogen cracking and hard HAZ'),

('PRQ-005', 'Minimum Wall Thickness Maintained', 'material_verification',
 'After excavation, verify that remaining wall thickness meets minimum design requirements.',
 'UT thickness measurement of the excavated area — compare to minimum required thickness',
 true, ARRAY['API_1104', 'ASME_VIII', 'ASME_B31.3'],
 'Below-minimum wall requires engineering evaluation for fitness for service'),

('PRQ-006', 'Engineering Approval for Third Repair', 'engineering_approval',
 'When a location has been repaired twice, a third repair requires written approval from the Engineer per D1.1 Clause 5.24.1.',
 'Written approval from the Engineer of Record documenting justification for third repair attempt',
 true, ARRAY['AWS_D1.1'],
 'D1.1 two-repair rule: unauthorized third repair violates the code'),

('PRQ-007', 'Repair Area Cleaned and Dry', 'safety',
 'The repair area must be clean, dry, and free of contaminants (oil, grease, paint, rust, moisture) before welding.',
 'Visual verification — solvent wipe, wire brush or grind to bright metal',
 true, ARRAY['AWS_D1.1', 'API_1104', 'ASME_VIII', 'ASME_B31.3'],
 'Contaminants cause porosity, hydrogen cracking, and incomplete fusion in the repair'),

('PRQ-008', 'Filler Metal Verified', 'material_verification',
 'Verify filler metal matches WPS specification — correct classification, size, lot number, storage condition.',
 'Check electrode/wire label against WPS — verify F-number and A-number for ASME IX',
 true, ARRAY['AWS_D1.1', 'API_1104', 'ASME_VIII', 'ASME_B31.3', 'ASME_IX'],
 'Wrong filler metal may produce incorrect mechanical properties or chemical composition'),

('PRQ-009', 'PWHT Evaluation', 'safety',
 'Determine if PWHT is required after repair. Depends on code, material P-number, thickness, and original PWHT status.',
 'Review code requirements for PWHT after repair welding — ASME VIII UCS-56, D1.1 Clause 5.8',
 true, ARRAY['ASME_VIII', 'ASME_B31.3', 'AWS_D1.1'],
 'Missing required PWHT leaves residual stress and potentially hard HAZ'),

('PRQ-010', 'Reinspection Plan Established', 'documentation',
 'A reinspection plan must be established before repair begins — defines what NDE methods will be used to verify the repair.',
 'Document specifying NDE methods, acceptance criteria, and timing for reinspection of the completed repair',
 true, ARRAY['AWS_D1.1', 'API_1104', 'ASME_VIII', 'ASME_B31.3'],
 'Without a reinspection plan, there is no verification that the repair is acceptable');

-- ============================================================
-- SEED DATA: Code-Specific Repair Rules
-- ============================================================
INSERT INTO repair_code_rules (code_family, rule_code, rule_name, rule_description, rule_type, parameters, is_mandatory, clause_reference) VALUES

('AWS_D1.1', 'RCR-D1.1-001', 'Two-Repair Maximum', 'Welds repaired more than twice in the same area require written approval from the Engineer', 'repair_limit', '{"max_repairs": 2, "requires_approval_from": "Engineer", "approval_type": "written"}'::jsonb, true, 'D1.1 Clause 5.24.1'),

('AWS_D1.1', 'RCR-D1.1-002', 'Excavation Verification Required', 'After excavation of defective weld metal, the repair cavity must be examined by MT or PT to verify complete removal', 'reinspection_requirement', '{"methods": ["MT", "PT"], "timing": "after_excavation_before_reweld"}'::jsonb, true, 'D1.1 Clause 5.24'),

('AWS_D1.1', 'RCR-D1.1-003', 'Repair Weld NDE Same as Original', 'Repair welds shall be reinspected by the same method(s) required for the original weld', 'reinspection_requirement', '{"scope": "same_as_original"}'::jsonb, true, 'D1.1 Clause 5.24'),

('API_1104', 'RCR-1104-001', 'Pipeline Two-Repair Maximum', 'A weld that has been repaired twice and is still unacceptable shall be cut out and rewelded', 'repair_limit', '{"max_repairs": 2, "action_when_exceeded": "cut_out_and_rerun"}'::jsonb, true, 'API 1104 Section 9.7.3'),

('API_1104', 'RCR-1104-002', 'Pipeline Repair Length Limit', 'Individual repair excavation shall not exceed a length that would result in excessive distortion or stress concentration', 'method_restriction', '{"max_repair_length_factor": "design_consideration"}'::jsonb, true, 'API 1104 Section 9.7'),

('API_1104', 'RCR-1104-003', 'Pipeline Repair Reinspection', 'Repaired welds must be reinspected using the same NDE methods and acceptance criteria as the original weld', 'reinspection_requirement', '{"scope": "same_as_original", "acceptance_criteria": "same_as_original"}'::jsonb, true, 'API 1104 Section 9.7.4'),

('ASME_VIII', 'RCR-VIII-001', 'Pressure Vessel Defect Removal Verification', 'Complete removal of defect must be verified by MT or PT before repair welding', 'reinspection_requirement', '{"methods": ["MT", "PT"], "timing": "after_excavation_before_reweld"}'::jsonb, true, 'ASME VIII UW-40'),

('ASME_VIII', 'RCR-VIII-002', 'Pressure Vessel PWHT After Repair', 'PWHT is required after repair if the original joint required PWHT, unless exempted by thickness or material per UCS-56', 'pwht_requirement', '{"condition": "if_original_required_pwht", "exemption_reference": "UCS-56"}'::jsonb, true, 'ASME VIII UW-40'),

('ASME_VIII', 'RCR-VIII-003', 'Pressure Vessel Repair Documentation', 'All repairs must be documented and traceable — repair procedure, welder, NDE results, and PWHT records', 'documentation_requirement', '{"required_records": ["repair_WPS", "welder_ID", "NDE_results", "PWHT_chart"]}'::jsonb, true, 'ASME VIII UW-40'),

('ASME_B31.3', 'RCR-B31.3-001', 'Process Piping Repair Methods', 'Repairs may be made by cavity repair (excavation and reweld) or overlay repair, per qualified procedure', 'method_restriction', '{"allowed_methods": ["cavity_repair", "overlay_repair"], "wps_required": true}'::jsonb, true, 'ASME B31.3 Clause 341.4'),

('ASME_B31.3', 'RCR-B31.3-002', 'Process Piping Re-examination', 'Repaired joints must be re-examined by the same methods and to the same acceptance criteria as the original examination', 'reinspection_requirement', '{"scope": "same_as_original", "acceptance_criteria": "same_as_original"}'::jsonb, true, 'ASME B31.3 Clause 341.4.3'),

('AWS_D1.5', 'RCR-D1.5-001', 'Bridge Fracture Critical Repair', 'Repairs to fracture critical members require enhanced NDE and engineering review — CVN testing may be required', 'approval_requirement', '{"requires": "engineering_review", "additional_nde": true, "cvn_testing_possible": true}'::jsonb, true, 'AWS D1.5 Clause 12');

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_repair_methods_category ON repair_method_registry(category);
CREATE INDEX IF NOT EXISTS idx_repair_prerequisites_category ON repair_prerequisites(category);
CREATE INDEX IF NOT EXISTS idx_repair_code_rules_family ON repair_code_rules(code_family);
CREATE INDEX IF NOT EXISTS idx_repair_pathways_assessment ON repair_pathway_assessments(assessment_id);
CREATE INDEX IF NOT EXISTS idx_repair_pathways_case ON repair_pathway_assessments(case_id);
CREATE INDEX IF NOT EXISTS idx_repair_pathways_org ON repair_pathway_assessments(org_id);
CREATE INDEX IF NOT EXISTS idx_repair_history_case ON repair_history(case_id);
CREATE INDEX IF NOT EXISTS idx_repair_history_location ON repair_history(location_id);
CREATE INDEX IF NOT EXISTS idx_repair_history_org ON repair_history(org_id);
CREATE INDEX IF NOT EXISTS idx_repair_audit_assessment ON repair_audit_events(assessment_id);
CREATE INDEX IF NOT EXISTS idx_repair_audit_org ON repair_audit_events(org_id);
