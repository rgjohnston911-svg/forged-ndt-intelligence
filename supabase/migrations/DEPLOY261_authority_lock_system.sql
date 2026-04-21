-- DEPLOY261: Authority Lock System v1.0.0
-- "Which exact clause governs this disposition?"
-- Pins the specific table/row/section of the governing code before any accept/reject decision.
-- Makes every disposition legally traceable to a specific code requirement.

-- ============================================================
-- TABLE 1: authority_code_editions
-- Which edition/year of each code is currently active
-- ============================================================
CREATE TABLE IF NOT EXISTS authority_code_editions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code_family TEXT NOT NULL,
  edition_year TEXT NOT NULL,
  full_title TEXT NOT NULL,
  issuing_body TEXT NOT NULL,
  effective_date DATE,
  supersedes TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE authority_code_editions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authority_code_editions_read" ON authority_code_editions FOR SELECT USING (true);

-- ============================================================
-- TABLE 2: authority_clause_registry
-- Master registry of specific clauses, tables, figures, sections
-- ============================================================
CREATE TABLE IF NOT EXISTS authority_clause_registry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  edition_id UUID REFERENCES authority_code_editions(id),
  code_family TEXT NOT NULL,
  clause_id TEXT NOT NULL,
  clause_type TEXT NOT NULL CHECK (clause_type IN ('table', 'figure', 'section', 'paragraph', 'appendix', 'annex')),
  clause_number TEXT NOT NULL,
  clause_title TEXT NOT NULL,
  description TEXT,
  governs_category TEXT NOT NULL CHECK (governs_category IN ('visual_acceptance', 'rt_acceptance', 'ut_acceptance', 'mt_pt_acceptance', 'weld_size', 'preheat', 'interpass', 'joint_design', 'qualification', 'procedure', 'repair', 'general_requirement')),
  discontinuity_types TEXT[],
  applies_to_loading TEXT[] DEFAULT ARRAY['static', 'cyclic', 'fatigue', 'seismic'],
  applies_to_joint_types TEXT[],
  applies_to_weld_types TEXT[],
  thickness_min_mm NUMERIC,
  thickness_max_mm NUMERIC,
  is_mandatory BOOLEAN DEFAULT true,
  priority_rank INTEGER DEFAULT 100,
  cross_references TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE authority_clause_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authority_clause_registry_read" ON authority_clause_registry FOR SELECT USING (true);

-- ============================================================
-- TABLE 3: authority_clause_conditions
-- Conditions that determine which clause applies in a given context
-- ============================================================
CREATE TABLE IF NOT EXISTS authority_clause_conditions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clause_id UUID REFERENCES authority_clause_registry(id),
  condition_type TEXT NOT NULL CHECK (condition_type IN ('loading', 'thickness', 'material_group', 'joint_type', 'weld_type', 'service_temperature', 'process', 'position', 'ndt_method', 'application', 'custom')),
  condition_key TEXT NOT NULL,
  condition_value TEXT NOT NULL,
  condition_operator TEXT NOT NULL DEFAULT 'eq' CHECK (condition_operator IN ('eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'between', 'contains')),
  is_required BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE authority_clause_conditions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authority_clause_conditions_read" ON authority_clause_conditions FOR SELECT USING (true);

-- ============================================================
-- TABLE 4: authority_clause_criteria
-- Specific acceptance/rejection criteria within each clause
-- ============================================================
CREATE TABLE IF NOT EXISTS authority_clause_criteria (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clause_id UUID REFERENCES authority_clause_registry(id),
  discontinuity_type TEXT NOT NULL,
  criteria_description TEXT NOT NULL,
  limit_type TEXT NOT NULL CHECK (limit_type IN ('max_dimension', 'max_count', 'max_percentage', 'min_spacing', 'max_aggregate', 'prohibited', 'conditional')),
  limit_value TEXT,
  limit_unit TEXT,
  severity_if_exceeded TEXT NOT NULL DEFAULT 'reject' CHECK (severity_if_exceeded IN ('reject', 'repair', 'hold', 'accept_with_condition', 'engineering_review')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE authority_clause_criteria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authority_clause_criteria_read" ON authority_clause_criteria FOR SELECT USING (true);

-- ============================================================
-- TABLE 5: authority_locks
-- Records which clause was locked to which assessment
-- ============================================================
CREATE TABLE IF NOT EXISTS authority_locks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  assessment_id UUID,
  case_id UUID,
  clause_id UUID REFERENCES authority_clause_registry(id),
  edition_id UUID REFERENCES authority_code_editions(id),
  code_family TEXT NOT NULL,
  clause_number TEXT NOT NULL,
  clause_title TEXT NOT NULL,
  lock_reason TEXT NOT NULL,
  context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  locked_by TEXT,
  locked_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  superseded_by UUID,
  override_reason TEXT,
  override_by TEXT,
  override_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE authority_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authority_locks_org" ON authority_locks FOR ALL USING (
  org_id IS NULL OR org_id = ((auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
);

-- ============================================================
-- TABLE 6: authority_lock_audit
-- Full audit trail of lock events
-- ============================================================
CREATE TABLE IF NOT EXISTS authority_lock_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  lock_id UUID REFERENCES authority_locks(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('lock_created', 'lock_verified', 'lock_superseded', 'lock_overridden', 'lock_expired', 'clause_lookup', 'edition_check', 'comparison_run')),
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE authority_lock_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authority_lock_audit_org" ON authority_lock_audit FOR ALL USING (
  org_id IS NULL OR org_id = ((auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
);

-- ============================================================
-- SEED DATA: Code Editions
-- ============================================================
INSERT INTO authority_code_editions (code_family, edition_year, full_title, issuing_body, effective_date, is_active) VALUES
  ('AWS_D1.1', '2020', 'Structural Welding Code — Steel (D1.1/D1.1M:2020)', 'American Welding Society', '2020-01-01', true),
  ('AWS_D1.2', '2019', 'Structural Welding Code — Aluminum (D1.2/D1.2M:2019)', 'American Welding Society', '2019-01-01', true),
  ('AWS_D1.3', '2018', 'Structural Welding Code — Sheet Steel (D1.3/D1.3M:2018)', 'American Welding Society', '2018-01-01', true),
  ('AWS_D1.5', '2020', 'Bridge Welding Code (D1.5M/D1.5:2020)', 'American Welding Society', '2020-01-01', true),
  ('AWS_D1.6', '2017', 'Structural Welding Code — Stainless Steel (D1.6/D1.6M:2017)', 'American Welding Society', '2017-01-01', true),
  ('API_1104', '2021', 'Welding of Pipelines and Related Facilities (22nd Edition)', 'American Petroleum Institute', '2021-01-01', true),
  ('ASME_VIII', '2023', 'ASME Boiler and Pressure Vessel Code Section VIII Division 1', 'American Society of Mechanical Engineers', '2023-07-01', true),
  ('ASME_B31.3', '2022', 'Process Piping (ASME B31.3-2022)', 'American Society of Mechanical Engineers', '2022-01-01', true),
  ('ASME_IX', '2023', 'Qualification Standard for Welding, Brazing, and Fusing (ASME IX-2023)', 'American Society of Mechanical Engineers', '2023-07-01', true);

-- ============================================================
-- SEED DATA: Clause Registry — AWS D1.1
-- ============================================================
INSERT INTO authority_clause_registry (code_family, clause_id, clause_type, clause_number, clause_title, description, governs_category, discontinuity_types, applies_to_loading, applies_to_joint_types) VALUES
  ('AWS_D1.1', 'D1.1-T8.1', 'table', 'Table 8.1', 'Visual Inspection Acceptance Criteria — Statically Loaded', 'Acceptance criteria for visual inspection of statically loaded nontubular connections', 'visual_acceptance', ARRAY['crack', 'incomplete_fusion', 'incomplete_penetration', 'undercut', 'porosity', 'underfill', 'overlap', 'excessive_reinforcement'], ARRAY['static'], ARRAY['butt', 'v_groove', 'bevel_groove', 'u_groove', 'j_groove', 'fillet_tee', 'fillet_lap', 'fillet_corner', 'cjp', 'pjp']),
  ('AWS_D1.1', 'D1.1-T8.2', 'table', 'Table 8.2', 'Visual Inspection Acceptance Criteria — Cyclically Loaded', 'Acceptance criteria for visual inspection of cyclically loaded nontubular connections — stricter limits than Table 8.1', 'visual_acceptance', ARRAY['crack', 'incomplete_fusion', 'incomplete_penetration', 'undercut', 'porosity', 'underfill', 'overlap', 'excessive_reinforcement'], ARRAY['cyclic', 'fatigue', 'seismic'], ARRAY['butt', 'v_groove', 'bevel_groove', 'u_groove', 'j_groove', 'fillet_tee', 'fillet_lap', 'fillet_corner', 'cjp', 'pjp']),
  ('AWS_D1.1', 'D1.1-T6.1', 'table', 'Table 6.1', 'RT Acceptance Criteria — Statically Loaded', 'Acceptance criteria for radiographic testing of statically loaded groove welds', 'rt_acceptance', ARRAY['porosity', 'slag_inclusion', 'incomplete_fusion', 'incomplete_penetration'], ARRAY['static'], ARRAY['butt', 'v_groove', 'bevel_groove', 'cjp']),
  ('AWS_D1.1', 'D1.1-T6.2', 'table', 'Table 6.2', 'RT Acceptance Criteria — Cyclically Loaded', 'Acceptance criteria for radiographic testing of cyclically loaded groove welds — stricter limits', 'rt_acceptance', ARRAY['porosity', 'slag_inclusion', 'incomplete_fusion', 'incomplete_penetration'], ARRAY['cyclic', 'fatigue', 'seismic'], ARRAY['butt', 'v_groove', 'bevel_groove', 'cjp']),
  ('AWS_D1.1', 'D1.1-T6.3', 'table', 'Table 6.3', 'UT Acceptance Criteria — Class R (Statically Loaded)', 'Acceptance-rejection criteria for UT of statically loaded groove welds', 'ut_acceptance', ARRAY['crack', 'incomplete_fusion', 'incomplete_penetration', 'slag_inclusion', 'porosity'], ARRAY['static'], ARRAY['butt', 'v_groove', 'bevel_groove', 'cjp']),
  ('AWS_D1.1', 'D1.1-T6.4', 'table', 'Table 6.4', 'UT Acceptance Criteria — Class X (Cyclically Loaded)', 'Acceptance-rejection criteria for UT of cyclically loaded groove welds — stricter than Class R', 'ut_acceptance', ARRAY['crack', 'incomplete_fusion', 'incomplete_penetration', 'slag_inclusion', 'porosity'], ARRAY['cyclic', 'fatigue', 'seismic'], ARRAY['butt', 'v_groove', 'bevel_groove', 'cjp']),
  ('AWS_D1.1', 'D1.1-C5.22', 'section', 'Clause 5.22', 'Minimum Preheat and Interpass Temperature', 'Preheat and interpass temperature requirements based on material group and thickness', 'preheat', NULL, ARRAY['static', 'cyclic', 'fatigue', 'seismic'], NULL),
  ('AWS_D1.1', 'D1.1-C3.7.3', 'section', 'Clause 3.7.3', 'Maximum Weld Reinforcement', 'Limits on maximum reinforcement height for groove welds', 'weld_size', ARRAY['excessive_reinforcement'], ARRAY['static', 'cyclic', 'fatigue', 'seismic'], ARRAY['butt', 'v_groove', 'bevel_groove', 'cjp']),
  ('AWS_D1.1', 'D1.1-C5.24', 'section', 'Clause 5.24', 'Weld Repair Requirements', 'Requirements for repair of unacceptable welds including excavation, re-welding, and re-inspection', 'repair', NULL, ARRAY['static', 'cyclic', 'fatigue', 'seismic'], NULL),
  ('AWS_D1.1', 'D1.1-C5.24.1', 'section', 'Clause 5.24.1', 'Two-Repair Maximum Rule', 'Welds repaired more than twice in same area require written approval from Engineer', 'repair', NULL, ARRAY['static', 'cyclic', 'fatigue', 'seismic'], NULL),
  ('AWS_D1.1', 'D1.1-T8.9', 'table', 'Table 8.9', 'Tubular Visual Acceptance Criteria — Statically Loaded', 'Visual acceptance criteria specifically for tubular connections under static loading', 'visual_acceptance', ARRAY['crack', 'incomplete_fusion', 'incomplete_penetration', 'undercut', 'porosity'], ARRAY['static'], ARRAY['pipe_to_plate', 'branch_connection']),
  ('AWS_D1.1', 'D1.1-T8.10', 'table', 'Table 8.10', 'Tubular Visual Acceptance Criteria — Cyclically Loaded', 'Visual acceptance criteria for tubular connections under cyclic loading', 'visual_acceptance', ARRAY['crack', 'incomplete_fusion', 'incomplete_penetration', 'undercut', 'porosity'], ARRAY['cyclic', 'fatigue', 'seismic'], ARRAY['pipe_to_plate', 'branch_connection']);

-- ============================================================
-- SEED DATA: Clause Registry — AWS D1.2 (Aluminum)
-- ============================================================
INSERT INTO authority_clause_registry (code_family, clause_id, clause_type, clause_number, clause_title, description, governs_category, discontinuity_types, applies_to_loading) VALUES
  ('AWS_D1.2', 'D1.2-T8.1', 'table', 'Table 8.1', 'Visual Acceptance Criteria — Statically Loaded (Aluminum)', 'Visual inspection acceptance for aluminum structural welds under static loading', 'visual_acceptance', ARRAY['crack', 'incomplete_fusion', 'incomplete_penetration', 'undercut', 'porosity', 'underfill', 'excessive_reinforcement'], ARRAY['static']),
  ('AWS_D1.2', 'D1.2-T8.2', 'table', 'Table 8.2', 'Visual Acceptance Criteria — Cyclically Loaded (Aluminum)', 'Visual inspection acceptance for aluminum structural welds under cyclic loading', 'visual_acceptance', ARRAY['crack', 'incomplete_fusion', 'incomplete_penetration', 'undercut', 'porosity', 'underfill', 'excessive_reinforcement'], ARRAY['cyclic', 'fatigue']),
  ('AWS_D1.2', 'D1.2-C3.7', 'section', 'Clause 3.7', 'Aluminum Filler Metal Requirements', 'Filler metal selection requirements for aluminum welding — critical for avoiding hot cracking', 'procedure', NULL, ARRAY['static', 'cyclic', 'fatigue']),
  ('AWS_D1.2', 'D1.2-C5.3', 'section', 'Clause 5.3', 'Aluminum Preheat Restrictions', 'Preheat limits for aluminum — excessive preheat causes grain growth and reduces strength in heat-treatable alloys', 'preheat', NULL, ARRAY['static', 'cyclic', 'fatigue']);

-- ============================================================
-- SEED DATA: Clause Registry — AWS D1.3 (Sheet Steel)
-- ============================================================
INSERT INTO authority_clause_registry (code_family, clause_id, clause_type, clause_number, clause_title, description, governs_category, discontinuity_types, applies_to_loading) VALUES
  ('AWS_D1.3', 'D1.3-T4.1', 'table', 'Table 4.1', 'Sheet Steel Visual Acceptance Criteria', 'Acceptance criteria for visual inspection of sheet steel welds — burnthrough and edge distance are key concerns', 'visual_acceptance', ARRAY['crack', 'incomplete_fusion', 'undercut', 'porosity', 'burnthrough', 'excessive_reinforcement'], ARRAY['static', 'cyclic']),
  ('AWS_D1.3', 'D1.3-C2.5', 'section', 'Clause 2.5', 'Sheet Steel Minimum Edge Distance', 'Edge distance requirements to prevent burnthrough and distortion in sheet steel joints', 'joint_design', NULL, ARRAY['static', 'cyclic']),
  ('AWS_D1.3', 'D1.3-C4.3', 'section', 'Clause 4.3', 'Sheet Steel Weld Size Requirements', 'Weld size limits for sheet steel — oversizing causes burnthrough; undersizing causes throat failure', 'weld_size', ARRAY['underfill', 'burnthrough'], ARRAY['static', 'cyclic']),
  ('AWS_D1.3', 'D1.3-C3.2', 'section', 'Clause 3.2', 'Sheet Steel Arc Welding Process Limits', 'Process limitations and parameter ranges for sheet steel welding — heat input control critical', 'procedure', NULL, ARRAY['static', 'cyclic']);

-- ============================================================
-- SEED DATA: Clause Registry — AWS D1.5 (Bridge)
-- ============================================================
INSERT INTO authority_clause_registry (code_family, clause_id, clause_type, clause_number, clause_title, description, governs_category, discontinuity_types, applies_to_loading) VALUES
  ('AWS_D1.5', 'D1.5-T6.1', 'table', 'Table 6.1', 'Bridge Weld Visual Acceptance Criteria', 'Visual inspection acceptance criteria for bridge welding — fracture critical requirements are most stringent', 'visual_acceptance', ARRAY['crack', 'incomplete_fusion', 'incomplete_penetration', 'undercut', 'porosity', 'underfill', 'overlap', 'excessive_reinforcement', 'lamellar_tear'], ARRAY['cyclic', 'fatigue']),
  ('AWS_D1.5', 'D1.5-T6.2', 'table', 'Table 6.2', 'Bridge Weld RT Acceptance Criteria', 'Radiographic acceptance criteria for bridge groove welds — zero tolerance for cracks and linear indications', 'rt_acceptance', ARRAY['crack', 'porosity', 'slag_inclusion', 'incomplete_fusion', 'incomplete_penetration'], ARRAY['cyclic', 'fatigue']),
  ('AWS_D1.5', 'D1.5-T6.3', 'table', 'Table 6.3', 'Bridge Weld UT Acceptance Criteria', 'Ultrasonic testing acceptance for bridge welds — fracture critical members require enhanced scanning', 'ut_acceptance', ARRAY['crack', 'incomplete_fusion', 'incomplete_penetration', 'slag_inclusion'], ARRAY['cyclic', 'fatigue']),
  ('AWS_D1.5', 'D1.5-C12', 'section', 'Clause 12', 'Fracture Critical Member Requirements', 'Additional requirements for fracture critical members — CVN testing, enhanced NDE, tighter acceptance criteria', 'general_requirement', ARRAY['crack', 'lamellar_tear'], ARRAY['cyclic', 'fatigue']),
  ('AWS_D1.5', 'D1.5-C5.18', 'section', 'Clause 5.18', 'Bridge Preheat Requirements', 'Preheat and interpass requirements for bridge steel — more conservative than D1.1 for fracture critical', 'preheat', NULL, ARRAY['cyclic', 'fatigue']);

-- ============================================================
-- SEED DATA: Clause Registry — AWS D1.6 (Stainless Steel)
-- ============================================================
INSERT INTO authority_clause_registry (code_family, clause_id, clause_type, clause_number, clause_title, description, governs_category, discontinuity_types, applies_to_loading) VALUES
  ('AWS_D1.6', 'D1.6-T6.1', 'table', 'Table 6.1', 'Stainless Steel Visual Acceptance Criteria', 'Visual inspection acceptance for stainless steel structural welds — sensitization and discoloration are additional concerns', 'visual_acceptance', ARRAY['crack', 'incomplete_fusion', 'incomplete_penetration', 'undercut', 'porosity', 'discoloration', 'tungsten_inclusion'], ARRAY['static', 'cyclic']),
  ('AWS_D1.6', 'D1.6-C5.6', 'section', 'Clause 5.6', 'Stainless Steel Interpass Temperature Limits', 'Maximum interpass temperature limits for austenitic stainless — prevents sensitization and hot cracking', 'interpass', NULL, ARRAY['static', 'cyclic']),
  ('AWS_D1.6', 'D1.6-C3.4', 'section', 'Clause 3.4', 'Stainless Steel Filler Metal Selection', 'Filler metal requirements — ferrite number control, matching vs overmatching, low carbon grades for corrosion service', 'procedure', NULL, ARRAY['static', 'cyclic']);

-- ============================================================
-- SEED DATA: Clause Registry — API 1104 (Pipeline)
-- ============================================================
INSERT INTO authority_clause_registry (code_family, clause_id, clause_type, clause_number, clause_title, description, governs_category, discontinuity_types, applies_to_loading) VALUES
  ('API_1104', '1104-S9.3', 'section', 'Section 9.3', 'Visual Inspection Standards', 'Visual acceptance criteria for pipeline welds — applies to all girth, fillet, and branch welds', 'visual_acceptance', ARRAY['crack', 'incomplete_fusion', 'incomplete_penetration', 'undercut', 'porosity', 'burnthrough', 'underfill', 'excessive_reinforcement', 'arc_strike'], ARRAY['static', 'cyclic']),
  ('API_1104', '1104-S9.3.1', 'section', 'Section 9.3.1', 'Inadequate Penetration Without Hi-Lo', 'Acceptance limits for inadequate penetration not caused by misalignment', 'visual_acceptance', ARRAY['incomplete_penetration'], ARRAY['static', 'cyclic']),
  ('API_1104', '1104-S9.3.2', 'section', 'Section 9.3.2', 'Inadequate Penetration Due to Hi-Lo', 'Acceptance limits for incomplete penetration caused by internal misalignment', 'visual_acceptance', ARRAY['incomplete_penetration', 'misalignment'], ARRAY['static', 'cyclic']),
  ('API_1104', '1104-S9.3.3', 'section', 'Section 9.3.3', 'Incomplete Fusion (Pipeline)', 'Acceptance limits for incomplete fusion in pipeline girth welds', 'visual_acceptance', ARRAY['incomplete_fusion'], ARRAY['static', 'cyclic']),
  ('API_1104', '1104-S9.3.8', 'section', 'Section 9.3.8', 'Cracks (Pipeline)', 'Crack acceptance criteria — cracks are not acceptable regardless of size or location', 'visual_acceptance', ARRAY['crack'], ARRAY['static', 'cyclic']),
  ('API_1104', '1104-S9.3.9', 'section', 'Section 9.3.9', 'Undercutting (Pipeline)', 'Undercut acceptance based on depth relative to wall thickness and aggregate length', 'visual_acceptance', ARRAY['undercut'], ARRAY['static', 'cyclic']),
  ('API_1104', '1104-T1', 'table', 'Table 1', 'NDT Acceptance Criteria (Pipeline)', 'Acceptance criteria for RT and UT examination of pipeline welds', 'rt_acceptance', ARRAY['porosity', 'slag_inclusion', 'incomplete_fusion', 'incomplete_penetration', 'crack'], ARRAY['static', 'cyclic']),
  ('API_1104', '1104-S9.7', 'section', 'Section 9.7', 'Pipeline Repair Requirements', 'Repair procedures for pipeline welds — maximum two repairs, excavation requirements, re-inspection requirements', 'repair', NULL, ARRAY['static', 'cyclic']),
  ('API_1104', '1104-AppA', 'appendix', 'Appendix A', 'Alternative Acceptance Standards (ECA-based)', 'Engineering Critical Assessment-based alternative acceptance criteria — fitness for service approach, requires fracture mechanics analysis', 'visual_acceptance', ARRAY['crack', 'incomplete_fusion', 'incomplete_penetration', 'porosity'], ARRAY['static', 'cyclic']);

-- ============================================================
-- SEED DATA: Clause Registry — ASME VIII (Pressure Vessels)
-- ============================================================
INSERT INTO authority_clause_registry (code_family, clause_id, clause_type, clause_number, clause_title, description, governs_category, discontinuity_types, applies_to_loading) VALUES
  ('ASME_VIII', 'VIII-UW51', 'section', 'UW-51', 'Radiographic Examination Acceptance Standards', 'RT acceptance criteria for pressure vessel welds — references ASME V Article 2 for technique and this section for acceptance', 'rt_acceptance', ARRAY['crack', 'incomplete_fusion', 'incomplete_penetration', 'porosity', 'slag_inclusion'], ARRAY['static']),
  ('ASME_VIII', 'VIII-UW35', 'section', 'UW-35', 'Welded Joint Efficiency', 'Joint efficiency factors based on joint type and extent of examination — drives required thickness calculation', 'general_requirement', NULL, ARRAY['static']),
  ('ASME_VIII', 'VIII-UW33', 'section', 'UW-33', 'Extent of Radiographic Examination', 'Requirements for full vs spot RT based on joint category, material, thickness, service, and lethal designation', 'general_requirement', NULL, ARRAY['static']),
  ('ASME_VIII', 'VIII-UW52', 'section', 'UW-52', 'Spot Radiographic Examination', 'Requirements and acceptance criteria for spot radiographic examination of pressure vessel welds', 'rt_acceptance', ARRAY['crack', 'porosity', 'slag_inclusion', 'incomplete_fusion'], ARRAY['static']),
  ('ASME_VIII', 'VIII-UW53', 'section', 'UW-53', 'UT Examination in Lieu of RT', 'Requirements for using ultrasonic examination as alternative to radiography — must meet ASME V Article 4', 'ut_acceptance', ARRAY['crack', 'incomplete_fusion', 'incomplete_penetration', 'slag_inclusion'], ARRAY['static']),
  ('ASME_VIII', 'VIII-UW40', 'section', 'UW-40', 'Repair of Weld Defects', 'Pressure vessel weld repair requirements — defect removal verification, re-weld requirements, PWHT considerations', 'repair', NULL, ARRAY['static']),
  ('ASME_VIII', 'VIII-UCS56', 'section', 'UCS-56', 'PWHT Requirements', 'Post-weld heat treatment requirements based on P-Number, thickness, and service conditions', 'general_requirement', NULL, ARRAY['static']),
  ('ASME_VIII', 'VIII-UG93', 'section', 'UG-93', 'Pressure Test Requirements', 'Hydrostatic and pneumatic test requirements after welding — test pressure based on MAWP and joint efficiency', 'general_requirement', NULL, ARRAY['static']);

-- ============================================================
-- SEED DATA: Clause Registry — ASME B31.3 (Process Piping)
-- ============================================================
INSERT INTO authority_clause_registry (code_family, clause_id, clause_type, clause_number, clause_title, description, governs_category, discontinuity_types, applies_to_loading) VALUES
  ('ASME_B31.3', 'B31.3-T341.3.2', 'table', 'Table 341.3.2', 'Acceptance Criteria for Visual Examination', 'Visual examination acceptance criteria for process piping welds', 'visual_acceptance', ARRAY['crack', 'incomplete_fusion', 'incomplete_penetration', 'undercut', 'porosity', 'underfill', 'excessive_reinforcement'], ARRAY['static', 'cyclic']),
  ('ASME_B31.3', 'B31.3-T341.3.2A', 'table', 'Table 341.3.2A', 'Acceptance Criteria for RT/UT Examination', 'Radiographic and ultrasonic examination acceptance for process piping welds', 'rt_acceptance', ARRAY['crack', 'porosity', 'slag_inclusion', 'incomplete_fusion', 'incomplete_penetration'], ARRAY['static', 'cyclic']),
  ('ASME_B31.3', 'B31.3-C328', 'section', 'Clause 328', 'Process Piping Preheat Requirements', 'Preheat requirements for process piping based on material P-Number and thickness', 'preheat', NULL, ARRAY['static', 'cyclic']),
  ('ASME_B31.3', 'B31.3-C331', 'section', 'Clause 331', 'Process Piping Heat Treatment', 'PWHT requirements including holding temperature, time, cooling rate for process piping', 'general_requirement', NULL, ARRAY['static', 'cyclic']),
  ('ASME_B31.3', 'B31.3-C341.4', 'section', 'Clause 341.4', 'Process Piping Repair Requirements', 'Repair and re-examination requirements for process piping welds — includes cavity repair and overlay repair methods', 'repair', NULL, ARRAY['static', 'cyclic']),
  ('ASME_B31.3', 'B31.3-CM323', 'section', 'Chapter IX M323', 'High Pressure Piping Examination', 'Additional examination requirements for high pressure piping (Chapter IX) — 100% RT/UT required', 'general_requirement', NULL, ARRAY['static', 'cyclic']);

-- ============================================================
-- SEED DATA: Clause Registry — ASME IX (Qualification)
-- ============================================================
INSERT INTO authority_clause_registry (code_family, clause_id, clause_type, clause_number, clause_title, description, governs_category, discontinuity_types, applies_to_loading) VALUES
  ('ASME_IX', 'IX-QW150', 'section', 'QW-150', 'Tension Tests — Performance Qualification', 'Tensile test requirements for welder performance qualification', 'qualification', NULL, ARRAY['static', 'cyclic']),
  ('ASME_IX', 'IX-QW160', 'section', 'QW-160', 'Guided Bend Tests — Performance Qualification', 'Bend test requirements — root, face, and side bends with acceptance criteria for open discontinuities', 'qualification', ARRAY['crack', 'incomplete_fusion', 'incomplete_penetration'], ARRAY['static', 'cyclic']),
  ('ASME_IX', 'IX-QW190', 'section', 'QW-190', 'Visual Examination — Performance Qualification', 'Visual examination requirements for welder qualification test coupons', 'qualification', ARRAY['crack', 'incomplete_fusion', 'incomplete_penetration', 'undercut', 'porosity'], ARRAY['static', 'cyclic']),
  ('ASME_IX', 'IX-QW200', 'section', 'QW-200', 'Welding Procedure Specifications (WPS)', 'Requirements for developing and qualifying welding procedure specifications', 'procedure', NULL, ARRAY['static', 'cyclic']),
  ('ASME_IX', 'IX-QW250', 'section', 'QW-250', 'Welding Essential Variables', 'Essential, supplementary essential, and nonessential variables for WPS qualification by process', 'procedure', NULL, ARRAY['static', 'cyclic']);

-- ============================================================
-- SEED DATA: Clause Criteria — D1.1 Table 8.1 (Static) key items
-- Uses subquery to resolve clause_id by clause_id field
-- ============================================================
INSERT INTO authority_clause_criteria (clause_id, discontinuity_type, criteria_description, limit_type, limit_value, limit_unit, severity_if_exceeded)
SELECT id, 'crack', 'No cracks permitted regardless of size or location', 'prohibited', NULL, NULL, 'reject' FROM authority_clause_registry WHERE clause_id = 'D1.1-T8.1'
UNION ALL SELECT id, 'incomplete_fusion', 'No incomplete fusion permitted', 'prohibited', NULL, NULL, 'reject' FROM authority_clause_registry WHERE clause_id = 'D1.1-T8.1'
UNION ALL SELECT id, 'incomplete_penetration', 'Incomplete penetration in CJP groove welds is not permitted', 'prohibited', NULL, NULL, 'reject' FROM authority_clause_registry WHERE clause_id = 'D1.1-T8.1'
UNION ALL SELECT id, 'undercut', 'Undercut shall not exceed 1/32 in (1mm) for material less than or equal to 1 in thick', 'max_dimension', '1', 'mm', 'reject' FROM authority_clause_registry WHERE clause_id = 'D1.1-T8.1'
UNION ALL SELECT id, 'porosity', 'Maximum diameter of scattered porosity: 3/32 in for t <= 3/4 in; 3/16 in max otherwise', 'max_dimension', '2.4', 'mm', 'reject' FROM authority_clause_registry WHERE clause_id = 'D1.1-T8.1'
UNION ALL SELECT id, 'underfill', 'Weld profiles shall conform to Figure 5.4', 'conditional', NULL, NULL, 'reject' FROM authority_clause_registry WHERE clause_id = 'D1.1-T8.1'
UNION ALL SELECT id, 'excessive_reinforcement', 'Maximum reinforcement per Clause 3.7.3 and Figure 5.4', 'max_dimension', '3.2', 'mm', 'reject' FROM authority_clause_registry WHERE clause_id = 'D1.1-T8.1'
UNION ALL SELECT id, 'overlap', 'Overlap is not acceptable', 'prohibited', NULL, NULL, 'reject' FROM authority_clause_registry WHERE clause_id = 'D1.1-T8.1'
UNION ALL SELECT id, 'arc_strike', 'Arc strikes outside weld area shall be repaired', 'prohibited', NULL, NULL, 'repair' FROM authority_clause_registry WHERE clause_id = 'D1.1-T8.1'
UNION ALL SELECT id, 'spatter', 'Excessive spatter shall be removed', 'conditional', NULL, NULL, 'accept_with_condition' FROM authority_clause_registry WHERE clause_id = 'D1.1-T8.1';

-- D1.1 Table 8.2 (Cyclic) key items — stricter
INSERT INTO authority_clause_criteria (clause_id, discontinuity_type, criteria_description, limit_type, limit_value, limit_unit, severity_if_exceeded)
SELECT id, 'crack', 'No cracks permitted regardless of size or location', 'prohibited', NULL, NULL, 'reject' FROM authority_clause_registry WHERE clause_id = 'D1.1-T8.2'
UNION ALL SELECT id, 'incomplete_fusion', 'No incomplete fusion permitted', 'prohibited', NULL, NULL, 'reject' FROM authority_clause_registry WHERE clause_id = 'D1.1-T8.2'
UNION ALL SELECT id, 'incomplete_penetration', 'No incomplete penetration permitted in any joint', 'prohibited', NULL, NULL, 'reject' FROM authority_clause_registry WHERE clause_id = 'D1.1-T8.2'
UNION ALL SELECT id, 'undercut', 'Undercut shall not exceed 0.01 in (0.25mm) for cyclically loaded connections', 'max_dimension', '0.25', 'mm', 'reject' FROM authority_clause_registry WHERE clause_id = 'D1.1-T8.2'
UNION ALL SELECT id, 'porosity', 'No visible piping porosity permitted; scattered porosity limited to 3/32 in max diameter', 'max_dimension', '2.4', 'mm', 'reject' FROM authority_clause_registry WHERE clause_id = 'D1.1-T8.2'
UNION ALL SELECT id, 'underfill', 'No underfill permitted in cyclically loaded connections', 'prohibited', NULL, NULL, 'reject' FROM authority_clause_registry WHERE clause_id = 'D1.1-T8.2'
UNION ALL SELECT id, 'excessive_reinforcement', 'Reinforcement shall not exceed 1/8 in (3mm)', 'max_dimension', '3', 'mm', 'reject' FROM authority_clause_registry WHERE clause_id = 'D1.1-T8.2'
UNION ALL SELECT id, 'overlap', 'Overlap is not acceptable', 'prohibited', NULL, NULL, 'reject' FROM authority_clause_registry WHERE clause_id = 'D1.1-T8.2';

-- API 1104 key criteria
INSERT INTO authority_clause_criteria (clause_id, discontinuity_type, criteria_description, limit_type, limit_value, limit_unit, severity_if_exceeded)
SELECT id, 'crack', 'Cracks are not acceptable regardless of size, location, or orientation', 'prohibited', NULL, NULL, 'reject' FROM authority_clause_registry WHERE clause_id = '1104-S9.3'
UNION ALL SELECT id, 'incomplete_penetration', 'IP without hi-lo: individual length max 1 in, aggregate max 1 in in any 12 in', 'max_dimension', '25', 'mm', 'reject' FROM authority_clause_registry WHERE clause_id = '1104-S9.3'
UNION ALL SELECT id, 'incomplete_fusion', 'IF individual length max 1 in, aggregate max 1 in in any 12 in', 'max_dimension', '25', 'mm', 'reject' FROM authority_clause_registry WHERE clause_id = '1104-S9.3'
UNION ALL SELECT id, 'undercut', 'Undercut max 1/32 in deep for 12.5% of weld length; 1/16 in max absolute', 'max_dimension', '0.8', 'mm', 'reject' FROM authority_clause_registry WHERE clause_id = '1104-S9.3'
UNION ALL SELECT id, 'burnthrough', 'Individual burnthrough max 1/4 in; aggregate max 1/2 in in any 12 in', 'max_dimension', '6.4', 'mm', 'reject' FROM authority_clause_registry WHERE clause_id = '1104-S9.3'
UNION ALL SELECT id, 'porosity', 'Individual pore max 1/8 in; cluster max 1/2 in in any 12 in; piping porosity max 1/8 in width', 'max_dimension', '3.2', 'mm', 'reject' FROM authority_clause_registry WHERE clause_id = '1104-S9.3'
UNION ALL SELECT id, 'arc_strike', 'Arc strikes on pipe surface shall be ground smooth and wall thickness verified', 'prohibited', NULL, NULL, 'repair' FROM authority_clause_registry WHERE clause_id = '1104-S9.3';

-- ASME VIII UW-51 key criteria
INSERT INTO authority_clause_criteria (clause_id, discontinuity_type, criteria_description, limit_type, limit_value, limit_unit, severity_if_exceeded)
SELECT id, 'crack', 'No cracks or zones of incomplete fusion or penetration are acceptable', 'prohibited', NULL, NULL, 'reject' FROM authority_clause_registry WHERE clause_id = 'VIII-UW51'
UNION ALL SELECT id, 'incomplete_fusion', 'Not acceptable under any condition', 'prohibited', NULL, NULL, 'reject' FROM authority_clause_registry WHERE clause_id = 'VIII-UW51'
UNION ALL SELECT id, 'incomplete_penetration', 'Not acceptable under any condition', 'prohibited', NULL, NULL, 'reject' FROM authority_clause_registry WHERE clause_id = 'VIII-UW51'
UNION ALL SELECT id, 'slag_inclusion', 'Elongated slag: length max 2/3t for t<3/4in; aggregate in any 12t length limited', 'max_aggregate', NULL, NULL, 'reject' FROM authority_clause_registry WHERE clause_id = 'VIII-UW51'
UNION ALL SELECT id, 'porosity', 'Isolated porosity: max dimension t/4 or 3/16 in, whichever is smaller; cluster: max per 6t length', 'max_dimension', '4.8', 'mm', 'reject' FROM authority_clause_registry WHERE clause_id = 'VIII-UW51';

-- ============================================================
-- SEED DATA: Clause Conditions — D1.1 loading-based routing
-- ============================================================
INSERT INTO authority_clause_conditions (clause_id, condition_type, condition_key, condition_value, condition_operator, is_required)
SELECT id, 'loading', 'loading_condition', 'static', 'eq', true FROM authority_clause_registry WHERE clause_id = 'D1.1-T8.1'
UNION ALL SELECT id, 'application', 'connection_type', 'nontubular', 'eq', true FROM authority_clause_registry WHERE clause_id = 'D1.1-T8.1'
UNION ALL SELECT id, 'ndt_method', 'examination_method', 'VT', 'eq', true FROM authority_clause_registry WHERE clause_id = 'D1.1-T8.1';

INSERT INTO authority_clause_conditions (clause_id, condition_type, condition_key, condition_value, condition_operator, is_required)
SELECT id, 'loading', 'loading_condition', 'cyclic', 'in', true FROM authority_clause_registry WHERE clause_id = 'D1.1-T8.2'
UNION ALL SELECT id, 'application', 'connection_type', 'nontubular', 'eq', true FROM authority_clause_registry WHERE clause_id = 'D1.1-T8.2'
UNION ALL SELECT id, 'ndt_method', 'examination_method', 'VT', 'eq', true FROM authority_clause_registry WHERE clause_id = 'D1.1-T8.2';

-- D1.5 Bridge — always cyclic/fatigue
INSERT INTO authority_clause_conditions (clause_id, condition_type, condition_key, condition_value, condition_operator, is_required)
SELECT id, 'loading', 'loading_condition', 'cyclic,fatigue', 'in', true FROM authority_clause_registry WHERE clause_id = 'D1.5-T6.1'
UNION ALL SELECT id, 'application', 'structure_type', 'bridge', 'eq', true FROM authority_clause_registry WHERE clause_id = 'D1.5-T6.1';

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clause_registry_code ON authority_clause_registry(code_family);
CREATE INDEX IF NOT EXISTS idx_clause_registry_category ON authority_clause_registry(governs_category);
CREATE INDEX IF NOT EXISTS idx_clause_conditions_clause ON authority_clause_conditions(clause_id);
CREATE INDEX IF NOT EXISTS idx_clause_criteria_clause ON authority_clause_criteria(clause_id);
CREATE INDEX IF NOT EXISTS idx_locks_assessment ON authority_locks(assessment_id);
CREATE INDEX IF NOT EXISTS idx_locks_case ON authority_locks(case_id);
CREATE INDEX IF NOT EXISTS idx_locks_org ON authority_locks(org_id);
CREATE INDEX IF NOT EXISTS idx_lock_audit_lock ON authority_lock_audit(lock_id);
CREATE INDEX IF NOT EXISTS idx_lock_audit_org ON authority_lock_audit(org_id);
