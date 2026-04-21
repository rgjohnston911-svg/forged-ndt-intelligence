-- DEPLOY264: Reality Lock Domain Gating v1.0.0
-- "Does the system ACTUALLY know enough to evaluate this combination?"
-- Declares which process x position x material x code combinations are
-- supported, limited, or unsupported. Refuses to fake an answer.
-- Honest about what it knows and what it doesn't.

-- ============================================================
-- TABLE 1: domain_combination_registry
-- Master registry of all supported/unsupported combinations
-- ============================================================
CREATE TABLE IF NOT EXISTS domain_combination_registry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  process TEXT NOT NULL,
  position TEXT NOT NULL,
  material TEXT NOT NULL,
  code_family TEXT NOT NULL,
  support_level TEXT NOT NULL CHECK (support_level IN ('full', 'validated', 'limited', 'experimental', 'unsupported')),
  confidence_pct INTEGER NOT NULL DEFAULT 0 CHECK (confidence_pct >= 0 AND confidence_pct <= 100),
  data_source TEXT NOT NULL CHECK (data_source IN ('code_based', 'empirical', 'physics_derived', 'expert_seeded', 'ai_inferred', 'untested')),
  limitations TEXT[],
  known_issues TEXT[],
  recommended_actions TEXT[],
  notes TEXT,
  last_validated TIMESTAMPTZ,
  validated_by TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE domain_combination_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "domain_combinations_read" ON domain_combination_registry FOR SELECT USING (true);

-- ============================================================
-- TABLE 2: domain_gap_registry
-- Known gaps — combinations we know we can't handle well
-- ============================================================
CREATE TABLE IF NOT EXISTS domain_gap_registry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gap_code TEXT NOT NULL UNIQUE,
  process TEXT,
  position TEXT,
  material TEXT,
  code_family TEXT,
  gap_type TEXT NOT NULL CHECK (gap_type IN ('no_code_coverage', 'no_acceptance_criteria', 'no_physics_model', 'insufficient_training_data', 'no_repair_pathway', 'material_not_modeled', 'process_not_modeled', 'position_not_validated')),
  severity TEXT NOT NULL DEFAULT 'blocking' CHECK (severity IN ('blocking', 'degraded', 'warning', 'informational')),
  description TEXT NOT NULL,
  workaround TEXT,
  resolution_plan TEXT,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE domain_gap_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "domain_gaps_read" ON domain_gap_registry FOR SELECT USING (true);

-- ============================================================
-- TABLE 3: domain_validation_checks
-- Records of domain validation checks performed
-- ============================================================
CREATE TABLE IF NOT EXISTS domain_validation_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  assessment_id UUID,
  case_id UUID,
  process TEXT NOT NULL,
  position TEXT NOT NULL,
  material TEXT NOT NULL,
  code_family TEXT NOT NULL,
  support_level TEXT NOT NULL,
  confidence_pct INTEGER NOT NULL,
  gate_result TEXT NOT NULL CHECK (gate_result IN ('proceed', 'proceed_with_warnings', 'degraded_mode', 'blocked')),
  warnings TEXT[],
  gaps_found TEXT[],
  checked_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE domain_validation_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "domain_checks_org" ON domain_validation_checks FOR ALL USING (
  org_id IS NULL OR org_id = ((auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
);

-- ============================================================
-- TABLE 4: domain_audit_events
-- ============================================================
CREATE TABLE IF NOT EXISTS domain_audit_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  assessment_id UUID,
  event_type TEXT NOT NULL CHECK (event_type IN ('gate_check', 'combination_added', 'combination_updated', 'gap_identified', 'gap_resolved', 'override_applied', 'coverage_report')),
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE domain_audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "domain_audit_org" ON domain_audit_events FOR ALL USING (
  org_id IS NULL OR org_id = ((auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
);

-- ============================================================
-- SEED DATA: Supported Domain Combinations
-- Full support = code coverage + physics model + acceptance criteria + repair pathways
-- ============================================================

-- SMAW — the most broadly supported process
INSERT INTO domain_combination_registry (process, position, material, code_family, support_level, confidence_pct, data_source, limitations, notes) VALUES
('SMAW', '1G', 'carbon_steel', 'AWS_D1.1', 'full', 98, 'code_based', NULL, 'Most common structural welding combination — fully modeled'),
('SMAW', '2G', 'carbon_steel', 'AWS_D1.1', 'full', 97, 'code_based', NULL, NULL),
('SMAW', '3G', 'carbon_steel', 'AWS_D1.1', 'full', 97, 'code_based', NULL, 'Common CTE qualification position'),
('SMAW', '4G', 'carbon_steel', 'AWS_D1.1', 'full', 95, 'code_based', NULL, 'Overhead — gravity effects fully modeled'),
('SMAW', '1F', 'carbon_steel', 'AWS_D1.1', 'full', 98, 'code_based', NULL, NULL),
('SMAW', '2F', 'carbon_steel', 'AWS_D1.1', 'full', 97, 'code_based', NULL, NULL),
('SMAW', '3F', 'carbon_steel', 'AWS_D1.1', 'full', 96, 'code_based', NULL, NULL),
('SMAW', '4F', 'carbon_steel', 'AWS_D1.1', 'full', 94, 'code_based', NULL, NULL),
('SMAW', '6G', 'carbon_steel', 'AWS_D1.1', 'full', 93, 'code_based', NULL, 'All-position pipe — complex gravity transitions'),
('SMAW', '3G', 'carbon_steel', 'AWS_D1.5', 'full', 95, 'code_based', ARRAY['Fracture critical requirements add complexity'], 'Bridge welding — stricter than D1.1'),
('SMAW', '1G', 'low_alloy', 'AWS_D1.1', 'full', 95, 'code_based', ARRAY['Preheat requirements vary by grade'], NULL),
('SMAW', '3G', 'low_alloy', 'AWS_D1.1', 'validated', 90, 'code_based', ARRAY['Preheat critical', 'Hydrogen control essential'], NULL),
('SMAW', '5G', 'carbon_steel', 'API_1104', 'full', 95, 'code_based', NULL, 'Pipeline girth weld — downhill or uphill technique'),
('SMAW', '6G', 'carbon_steel', 'API_1104', 'full', 93, 'code_based', NULL, 'Pipeline qualification position'),
('SMAW', '1G', 'carbon_steel', 'ASME_VIII', 'full', 96, 'code_based', ARRAY['PWHT requirements per UCS-56'], 'Pressure vessel welding'),
('SMAW', '1G', 'carbon_steel', 'ASME_B31.3', 'full', 95, 'code_based', NULL, 'Process piping');

-- GMAW
INSERT INTO domain_combination_registry (process, position, material, code_family, support_level, confidence_pct, data_source, limitations, notes) VALUES
('GMAW', '1G', 'carbon_steel', 'AWS_D1.1', 'full', 97, 'code_based', NULL, 'Spray or short-circuit transfer'),
('GMAW', '2G', 'carbon_steel', 'AWS_D1.1', 'full', 95, 'code_based', NULL, NULL),
('GMAW', '3G', 'carbon_steel', 'AWS_D1.1', 'full', 93, 'code_based', ARRAY['Short-circuit only for vertical-up'], NULL),
('GMAW', '1F', 'carbon_steel', 'AWS_D1.1', 'full', 97, 'code_based', NULL, NULL),
('GMAW', '1G', 'aluminum', 'AWS_D1.2', 'validated', 88, 'code_based', ARRAY['Porosity risk from hydrogen/moisture', 'Shielding gas coverage critical'], 'Aluminum structural welding'),
('GMAW', '3G', 'aluminum', 'AWS_D1.2', 'limited', 75, 'code_based', ARRAY['High porosity risk', 'Burn-through on thin sections', 'Pulsed transfer recommended'], 'Challenging combination'),
('GMAW', 'flat_sheet', 'sheet_steel', 'AWS_D1.3', 'full', 95, 'code_based', ARRAY['Heat input control critical'], 'Sheet steel — short-circuit or pulsed'),
('GMAW', 'horizontal_sheet', 'sheet_steel', 'AWS_D1.3', 'validated', 90, 'code_based', ARRAY['Burnthrough risk on thin material'], NULL),
('GMAW', 'vertical_sheet', 'sheet_steel', 'AWS_D1.3', 'limited', 78, 'code_based', ARRAY['High burnthrough risk', 'Difficult heat control'], NULL),
('GMAW', 'flat_sheet', 'sheet_aluminum', 'AWS_D1.3', 'limited', 70, 'code_based', ARRAY['Extreme burnthrough risk', 'Porosity common', 'Distortion control critical'], 'Very challenging thin aluminum'),
('GMAW-P', '1G', 'aluminum', 'AWS_D1.2', 'validated', 85, 'code_based', ARRAY['Pulse parameters affect bead profile'], 'Pulsed GMAW — better control on aluminum'),
('GMAW-P', '3G', 'stainless_austenitic', 'AWS_D1.6', 'limited', 72, 'code_based', ARRAY['Interpass temperature limits', 'Sensitization risk'], 'Stainless structural');

-- FCAW
INSERT INTO domain_combination_registry (process, position, material, code_family, support_level, confidence_pct, data_source, limitations, notes) VALUES
('FCAW-G', '1G', 'carbon_steel', 'AWS_D1.1', 'full', 96, 'code_based', NULL, 'Gas-shielded flux-cored'),
('FCAW-G', '3G', 'carbon_steel', 'AWS_D1.1', 'full', 94, 'code_based', ARRAY['Slag entrapment risk in vertical-up'], NULL),
('FCAW-G', '4G', 'carbon_steel', 'AWS_D1.1', 'validated', 90, 'code_based', ARRAY['Slag management critical overhead'], NULL),
('FCAW-S', '1G', 'carbon_steel', 'AWS_D1.1', 'full', 94, 'code_based', ARRAY['Higher porosity risk than gas-shielded', 'Slag removal critical'], 'Self-shielded flux-cored'),
('FCAW-S', '3G', 'carbon_steel', 'AWS_D1.1', 'validated', 88, 'code_based', ARRAY['Slag entrapment common', 'Technique-dependent quality'], NULL),
('FCAW-G', '5G', 'carbon_steel', 'API_1104', 'validated', 87, 'code_based', ARRAY['Slag management in pipe position'], 'Pipeline FCAW');

-- GTAW
INSERT INTO domain_combination_registry (process, position, material, code_family, support_level, confidence_pct, data_source, limitations, notes) VALUES
('GTAW', '1G', 'carbon_steel', 'AWS_D1.1', 'full', 96, 'code_based', NULL, 'Root pass process'),
('GTAW', '6G', 'carbon_steel', 'ASME_IX', 'full', 94, 'code_based', NULL, 'Common pipe root qualification'),
('GTAW', '1G', 'stainless_austenitic', 'AWS_D1.6', 'full', 95, 'code_based', ARRAY['Interpass temperature max per D1.6 Clause 5.6'], 'Stainless structural — GTAW primary process'),
('GTAW', '6G', 'stainless_austenitic', 'ASME_B31.3', 'validated', 90, 'code_based', ARRAY['Back purge required', 'Tungsten contamination risk at root'], 'Process piping stainless'),
('GTAW', '1G', 'aluminum', 'AWS_D1.2', 'validated', 88, 'code_based', ARRAY['AC balance critical', 'Cleanliness paramount'], NULL),
('GTAW', '6G', 'titanium', 'ASME_IX', 'limited', 65, 'physics_derived', ARRAY['Full trailing shield required', 'Back purge mandatory', 'Contamination = immediate reject', 'Limited acceptance criteria data'], 'Titanium — extreme cleanliness requirements'),
('GTAW', '1G', 'nickel_alloy', 'ASME_IX', 'limited', 68, 'physics_derived', ARRAY['Hot cracking susceptible', 'Strict interpass limits', 'Filler selection critical'], 'Nickel alloys — challenging metallurgy');

-- SAW
INSERT INTO domain_combination_registry (process, position, material, code_family, support_level, confidence_pct, data_source, limitations, notes) VALUES
('SAW', '1G', 'carbon_steel', 'AWS_D1.1', 'full', 96, 'code_based', ARRAY['Flat/horizontal only', 'Centerline crack risk on deep penetration'], 'Submerged arc — high deposition rate'),
('SAW', '2F', 'carbon_steel', 'AWS_D1.1', 'full', 94, 'code_based', ARRAY['Slag removal between passes'], NULL),
('SAW', '1G', 'carbon_steel', 'ASME_VIII', 'full', 95, 'code_based', ARRAY['PWHT likely required for thick sections'], 'Pressure vessel longitudinal seams');

-- Specialty processes — limited or unsupported
INSERT INTO domain_combination_registry (process, position, material, code_family, support_level, confidence_pct, data_source, limitations, notes) VALUES
('RSW', 'flat_sheet', 'sheet_steel', 'AWS_D1.3', 'limited', 60, 'expert_seeded', ARRAY['Visual inspection limited to surface', 'Nugget size not measurable by VT', 'Destructive testing often required'], 'Resistance spot welding — VT limitations'),
('RSW', 'flat_sheet', 'sheet_aluminum', 'AWS_D1.3', 'experimental', 40, 'expert_seeded', ARRAY['Oxide layer affects nugget', 'No reliable VT criteria', 'Destructive testing required'], 'Aluminum RSW — very limited visual inspection capability'),
('EBW', '1G', 'titanium', 'ASME_IX', 'experimental', 35, 'expert_seeded', ARRAY['Vacuum chamber required', 'No photo-based evaluation possible', 'Specialized NDE required'], 'Electron beam welding — beyond photo-based evaluation'),
('LBW', '1G', 'carbon_steel', 'AWS_D1.1', 'experimental', 45, 'expert_seeded', ARRAY['Very narrow HAZ', 'Difficult to evaluate by VT', 'Specialized acceptance criteria needed'], 'Laser beam welding — limited VT applicability'),
('FSW', '1G', 'aluminum', 'AWS_D1.2', 'experimental', 40, 'expert_seeded', ARRAY['No filler metal — solid state process', 'Defect types differ from fusion welding', 'No standard VT acceptance criteria'], 'Friction stir welding — different defect paradigm'),
('OFW', '1G', 'carbon_steel', 'AWS_D1.1', 'limited', 55, 'expert_seeded', ARRAY['Wide HAZ', 'Slow process', 'Rarely used structurally', 'Limited modern code coverage'], 'Oxy-fuel welding — legacy process');

-- ============================================================
-- SEED DATA: Known Domain Gaps
-- ============================================================
INSERT INTO domain_gap_registry (gap_code, process, position, material, code_family, gap_type, severity, description, workaround, resolution_plan) VALUES

('GAP-001', 'EBW', NULL, NULL, NULL, 'process_not_modeled', 'blocking',
 'Electron beam welding operates in vacuum and produces a fundamentally different weld profile than arc processes. Photo-based evaluation is not applicable.',
 'Require specialized NDE (RT, UT) results as input rather than photo evaluation',
 'Future: accept NDE data input instead of photo for non-arc processes'),

('GAP-002', 'FSW', NULL, NULL, NULL, 'process_not_modeled', 'blocking',
 'Friction stir welding is a solid-state process with different defect types (tunneling, lack of fill, hooking) than fusion welding. Standard VT acceptance criteria do not apply.',
 'Reference AWS D17.3 (Friction Stir Welding) for specialized acceptance criteria',
 'Future: add FSW-specific defect library and acceptance criteria'),

('GAP-003', NULL, NULL, 'titanium', NULL, 'no_acceptance_criteria', 'degraded',
 'Titanium welding has limited visual acceptance criteria in standard codes. Color-based contamination assessment (silver/straw/blue/purple/gray) is the primary VT method but is not fully modeled.',
 'Use GTAW-titanium combination in limited mode with manual contamination color assessment',
 'Future: add titanium color chart evaluation engine'),

('GAP-004', NULL, NULL, 'duplex_ss', NULL, 'material_not_modeled', 'degraded',
 'Duplex stainless steel has unique requirements for ferrite/austenite balance, interpass temperature control, and solution annealing. Physics model is incomplete.',
 'Treat as stainless_austenitic with additional warnings about ferrite control and interpass limits',
 'Future: add duplex-specific physics rules and ferrite measurement requirements'),

('GAP-005', NULL, NULL, 'cast_iron', NULL, 'no_repair_pathway', 'degraded',
 'Cast iron repair welding requires specialized procedures (preheat to 1200F or no-preheat with peening, nickel filler metals). Repair pathway engine does not cover cast iron specifics.',
 'Flag for engineering review — cast iron repair requires specialized procedure',
 'Future: add cast iron repair methods with nickel filler selection logic'),

('GAP-006', 'RSW', NULL, 'sheet_aluminum', NULL, 'no_acceptance_criteria', 'blocking',
 'Resistance spot welding of aluminum has no reliable visual acceptance criteria. Nugget quality requires destructive testing or specialized ultrasonic evaluation.',
 'Require peel test or cross-section results instead of visual evaluation',
 'Future: accept destructive test data as evidence input'),

('GAP-007', NULL, NULL, NULL, 'AWS_D1.4', 'no_code_coverage', 'blocking',
 'AWS D1.4 (Reinforcing Steel) is not in the code authority system. Rebar welding has unique prequalified joints and acceptance criteria.',
 'None — cannot evaluate under D1.4 until code is added',
 'Future: add D1.4 code family with rebar-specific joints and criteria'),

('GAP-008', 'LBW', NULL, NULL, NULL, 'process_not_modeled', 'degraded',
 'Laser beam welding produces very narrow, deep welds with minimal HAZ. Standard visual criteria are difficult to apply. Weld width may be too narrow for photo-based measurement.',
 'Accept in limited mode with warnings about measurement accuracy limitations',
 'Future: add LBW-specific acceptance criteria and measurement approach'),

('GAP-009', NULL, '6GR', NULL, NULL, 'position_not_validated', 'warning',
 '6GR (restricted access pipe) position is recognized but physics model for restricted access bead placement is not fully validated.',
 'Treat as 6G with additional warnings about access restrictions affecting bead placement and inspection',
 'Future: validate 6GR physics model with restricted access scenario testing'),

('GAP-010', 'brazing', NULL, NULL, NULL, 'process_not_modeled', 'degraded',
 'Brazing is a joining process, not welding. Different physics (capillary flow, not fusion), different defect types (voids, lack of fill, flux entrapment), different codes (AWS C3.6).',
 'Flag as different process category — brazing evaluation not supported in weld evaluation engine',
 'Future: separate brazing evaluation module if demand warrants');

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_domain_combo_process ON domain_combination_registry(process);
CREATE INDEX IF NOT EXISTS idx_domain_combo_material ON domain_combination_registry(material);
CREATE INDEX IF NOT EXISTS idx_domain_combo_code ON domain_combination_registry(code_family);
CREATE INDEX IF NOT EXISTS idx_domain_combo_support ON domain_combination_registry(support_level);
CREATE INDEX IF NOT EXISTS idx_domain_gaps_type ON domain_gap_registry(gap_type);
CREATE INDEX IF NOT EXISTS idx_domain_gaps_severity ON domain_gap_registry(severity);
CREATE INDEX IF NOT EXISTS idx_domain_checks_assessment ON domain_validation_checks(assessment_id);
CREATE INDEX IF NOT EXISTS idx_domain_checks_org ON domain_validation_checks(org_id);
CREATE INDEX IF NOT EXISTS idx_domain_audit_org ON domain_audit_events(org_id);
