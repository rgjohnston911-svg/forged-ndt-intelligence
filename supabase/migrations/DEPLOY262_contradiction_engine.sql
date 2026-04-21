-- DEPLOY262: Contradiction Engine v1.0.0
-- "Student says no cracks — photo shows linear indication at crater."
-- Catches gaps between what the person CLAIMS and what the EVIDENCE shows.
-- Highest-impact teaching engine: forces honest observation before disposition.

-- ============================================================
-- TABLE 1: contradiction_rule_registry
-- Defines all known contradiction patterns the system can detect
-- ============================================================
CREATE TABLE IF NOT EXISTS contradiction_rule_registry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_code TEXT NOT NULL UNIQUE,
  rule_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('claim_vs_image', 'claim_vs_measurement', 'measurement_vs_measurement', 'claim_vs_code', 'measurement_vs_wps', 'process_vs_evidence', 'position_vs_evidence', 'material_vs_evidence', 'history_vs_current', 'logic_conflict')),
  severity TEXT NOT NULL DEFAULT 'major' CHECK (severity IN ('critical', 'major', 'minor', 'informational')),
  description TEXT NOT NULL,
  detection_logic TEXT NOT NULL,
  example_scenario TEXT,
  teaching_response TEXT NOT NULL,
  applies_to TEXT[] DEFAULT ARRAY['welding', 'ndt', 'general'],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE contradiction_rule_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contradiction_rules_read" ON contradiction_rule_registry FOR SELECT USING (true);

-- ============================================================
-- TABLE 2: detected_contradictions
-- Individual contradictions found during an assessment
-- ============================================================
CREATE TABLE IF NOT EXISTS detected_contradictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  assessment_id UUID,
  case_id UUID,
  rule_id UUID REFERENCES contradiction_rule_registry(id),
  rule_code TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  claim_field TEXT NOT NULL,
  claim_value TEXT NOT NULL,
  evidence_field TEXT NOT NULL,
  evidence_value TEXT NOT NULL,
  contradiction_description TEXT NOT NULL,
  teaching_message TEXT NOT NULL,
  resolution_required BOOLEAN DEFAULT true,
  resolved BOOLEAN DEFAULT false,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  resolution_action TEXT CHECK (resolution_action IN ('claim_corrected', 'evidence_reexamined', 'both_updated', 'override_with_justification', 'false_positive_confirmed')),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE detected_contradictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "detected_contradictions_org" ON detected_contradictions FOR ALL USING (
  org_id IS NULL OR org_id = ((auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
);

-- ============================================================
-- TABLE 3: contradiction_assessments
-- Summary of contradiction check for a full assessment
-- ============================================================
CREATE TABLE IF NOT EXISTS contradiction_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  assessment_id UUID,
  case_id UUID,
  total_checks_run INTEGER NOT NULL DEFAULT 0,
  contradictions_found INTEGER NOT NULL DEFAULT 0,
  critical_count INTEGER NOT NULL DEFAULT 0,
  major_count INTEGER NOT NULL DEFAULT 0,
  minor_count INTEGER NOT NULL DEFAULT 0,
  informational_count INTEGER NOT NULL DEFAULT 0,
  integrity_score NUMERIC NOT NULL DEFAULT 100,
  disposition_blocked BOOLEAN DEFAULT false,
  block_reason TEXT,
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ DEFAULT now(),
  checked_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE contradiction_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contradiction_assessments_org" ON contradiction_assessments FOR ALL USING (
  org_id IS NULL OR org_id = ((auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
);

-- ============================================================
-- TABLE 4: contradiction_audit_events
-- ============================================================
CREATE TABLE IF NOT EXISTS contradiction_audit_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  assessment_id UUID,
  event_type TEXT NOT NULL CHECK (event_type IN ('check_run', 'contradiction_detected', 'contradiction_resolved', 'disposition_blocked', 'override_applied', 'false_positive_marked', 'integrity_scored')),
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE contradiction_audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contradiction_audit_org" ON contradiction_audit_events FOR ALL USING (
  org_id IS NULL OR org_id = ((auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
);

-- ============================================================
-- SEED DATA: Contradiction Rules
-- ============================================================
INSERT INTO contradiction_rule_registry (rule_code, rule_name, category, severity, description, detection_logic, example_scenario, teaching_response, applies_to) VALUES

-- CLAIM VS IMAGE contradictions
('CVE-001', 'Claims No Cracks But Linear Indication Present', 'claim_vs_image', 'critical',
 'Inspector/student claims no cracks found, but AI image analysis or prior evidence shows linear indication consistent with cracking',
 'User claims findings do not include any crack type, but image analysis detected linear indication at toe, crater, or weld centerline',
 'Student scans a SMAW 3G coupon and reports "no defects found." AI detects a 12mm linear indication at the crater — consistent with crater crack.',
 'A linear indication at the crater is one of the most common crack locations in SMAW. Crater cracks form when the arc is terminated too quickly without proper crater fill technique. Look again at the crater area — do you see a star-shaped or longitudinal line? If present, this is a rejectable discontinuity under every code.',
 ARRAY['welding']),

('CVE-002', 'Claims No Porosity But Rounded Indications Visible', 'claim_vs_image', 'major',
 'Inspector claims no porosity, but image shows rounded indications consistent with gas pores',
 'User claims no porosity in findings, but image analysis detected scattered rounded indications in weld face or root',
 'Student reports clean weld on FCAW vertical-up. Image shows cluster of small rounded indications near the start of the weld — classic gas pocket from inadequate pre-flow.',
 'Look at the weld start area carefully. Those small round dark spots are gas pores — they form when shielding gas has not fully purged the atmosphere before arc initiation. In FCAW, this is common when pre-flow time is insufficient or when drafts disrupt the gas column. Count them and measure — scattered porosity has size and spacing limits in your governing code.',
 ARRAY['welding']),

('CVE-003', 'Claims No Undercut But Groove Visible at Toe', 'claim_vs_image', 'major',
 'Inspector claims no undercut, but image shows visible groove or notch along weld toe',
 'User claims no undercut, but image analysis shows shadow/groove pattern along one or both toes consistent with undercut',
 'Student inspecting overhead fillet reports no undercut. Photo clearly shows a continuous groove along the upper toe — gravity-induced undercut from excessive amperage in the overhead position.',
 'Run your fingernail along both toes of the weld. Undercut feels like a groove or notch where the arc has melted the base metal without filling it back in. In overhead position, gravity pulls molten metal away from the upper toe, making undercut very common. Measure the depth — D1.1 static allows up to 1/32 in (1mm), but cyclic allows only 0.01 in (0.25mm).',
 ARRAY['welding']),

('CVE-004', 'Claims No Incomplete Fusion But Cold Lap Visible', 'claim_vs_image', 'critical',
 'Inspector claims no incomplete fusion, but image shows overlap/cold lap indicating the weld metal did not fuse to the base metal',
 'User claims no IF in findings, but image shows weld metal rolled over onto base metal without visible fusion line — classic cold lap',
 'Student running GMAW short-circuit on thick plate reports complete fusion. Image shows weld bead sitting on top of base metal at the bottom toe — insufficient heat input for fusion.',
 'Look at where the weld meets the base metal at the lower toe. If the weld metal appears to sit ON TOP of the base metal rather than melting INTO it, that is incomplete fusion (also called cold lap). This happens when heat input is too low for the joint thickness or when travel speed is too fast. Incomplete fusion is prohibited in every structural code — it creates a stress riser that will initiate fatigue cracking.',
 ARRAY['welding']),

-- CLAIM VS MEASUREMENT contradictions
('CVM-001', 'Claimed Throat Does Not Match Measured Throat', 'claim_vs_measurement', 'major',
 'Inspector reports a throat measurement that conflicts with another measurement or the specified throat from the WPS',
 'User-reported throat measurement differs from WPS minimum required throat by more than tolerance, or from AI-estimated throat from image by more than 1mm',
 'Student claims fillet weld throat is 1/4 in (6.4mm) but WPS calls for 5/16 in (7.9mm) minimum. The weld is undersized.',
 'Your measured throat (1/4 in) is less than the WPS-required throat (5/16 in). This means the weld does not have enough cross-sectional area to carry the design load. Measure again using a fillet weld gauge — place it at the point of minimum throat, perpendicular to the weld face. If confirmed undersized, this weld needs to be built up to meet the minimum.',
 ARRAY['welding']),

('CVM-002', 'Claimed Weld Size Conflicts With Leg Measurement', 'claim_vs_measurement', 'major',
 'Inspector reports weld size that is geometrically inconsistent with reported leg measurements',
 'For fillet welds: user reports weld size but leg measurements are inconsistent (e.g., claims 1/4 in fillet but one leg measures 3/16 in)',
 'Student reports 5/16 in fillet weld but measures horizontal leg at 3/16 in and vertical leg at 5/16 in. The weld size is governed by the shorter leg.',
 'Fillet weld size is measured by the leg of the largest right triangle that can be inscribed in the cross section. For equal-leg fillets, the size equals the leg length. For unequal-leg fillets, you need to specify both legs. Your shorter leg (3/16 in) means the effective weld size is smaller than you reported. Re-measure and report accurately — the shorter leg governs.',
 ARRAY['welding']),

('CVM-003', 'Reinforcement Exceeds Code Maximum', 'claim_vs_measurement', 'minor',
 'Inspector reports reinforcement height that exceeds the code-allowed maximum but claims the weld is acceptable',
 'User reports weld as acceptable, but the measured reinforcement height exceeds the code limit for the given thickness range',
 'Student measures groove weld reinforcement at 5/32 in (4mm) on 3/4 in plate under D1.1. Claims weld is acceptable. D1.1 Clause 3.7.3 limits reinforcement to 1/8 in (3.2mm) for this thickness.',
 'Your reinforcement measurement (5/32 in) exceeds the D1.1 maximum of 1/8 in for this plate thickness. Excessive reinforcement creates a stress concentration at the weld toe that can initiate fatigue cracking. The fix is to grind the reinforcement flush or to within the allowed height, blending smoothly into the base metal at both toes.',
 ARRAY['welding']),

-- MEASUREMENT VS MEASUREMENT contradictions
('MVM-001', 'UT Thickness Readings Conflict With Known Nominal', 'measurement_vs_measurement', 'major',
 'UT thickness readings are significantly different from the known nominal wall thickness in a way that suggests measurement error rather than actual wall loss',
 'UT reading exceeds nominal wall thickness by more than 10%, or shows gain in thickness in a corrosion environment — likely measurement artifact',
 'Inspector reports 0.450 in wall on a pipe with 0.375 in nominal. Unless this is a weld area with reinforcement, gaining thickness in a corrosion circuit is physically impossible.',
 'Your UT reading (0.450 in) is greater than the nominal wall thickness (0.375 in). Unless you are measuring at a weld or reinforced area, wall thickness does not increase in service. This suggests a measurement error — check your calibration, coupling, and probe placement. Common causes: measuring through paint/coating, coupling lift-off, incorrect velocity setting, or measuring on a weld bead rather than base metal.',
 ARRAY['ndt']),

('MVM-002', 'Hardness Reading Conflicts With Material Spec', 'measurement_vs_measurement', 'major',
 'Reported hardness value is outside the expected range for the specified material, suggesting measurement error or wrong material',
 'Hardness value is more than 20% outside expected range for the specified material grade and heat treatment condition',
 'Inspector reports 350 HB on what is supposedly SA-516 Gr 70 carbon steel (expected 121-197 HB range). Either wrong material or measurement error.',
 'Your hardness reading (350 HB) is far outside the expected range for SA-516 Gr 70 carbon steel (121-197 HB). This could mean: (1) wrong material installed — verify with PMI, (2) the HAZ has hardened due to rapid cooling — check if PWHT was performed, (3) measurement error — verify calibration block, surface prep, and minimum thickness requirements for the hardness method used.',
 ARRAY['ndt']),

-- CLAIM VS CODE contradictions
('CVC-001', 'Claims Acceptable But Findings Exceed Code Limits', 'claim_vs_code', 'critical',
 'Inspector dispositions the weld as acceptable, but one or more reported findings exceed the acceptance criteria of the governing code',
 'User disposition is accept, but a reported discontinuity measurement exceeds the code limit for that discontinuity type under the locked clause',
 'Student reports undercut at 1/16 in (1.6mm) on a cyclically loaded D1.1 joint and marks it "acceptable." Table 8.2 limits undercut to 0.01 in (0.25mm) for cyclic loading.',
 'You marked this weld as acceptable, but your own undercut measurement (1/16 in) exceeds the D1.1 Table 8.2 limit for cyclically loaded connections (0.01 in). Re-read the acceptance criteria for your loading condition. Static and cyclic have DIFFERENT limits — Table 8.1 allows 1/32 in for static, but Table 8.2 allows only 0.01 in for cyclic. Your measurement exceeds both.',
 ARRAY['welding', 'ndt']),

('CVC-002', 'Claims Rejectable But All Findings Within Limits', 'claim_vs_code', 'minor',
 'Inspector rejects the weld, but all reported measurements are within code acceptance criteria',
 'User disposition is reject, but no reported finding exceeds the applicable code limit. May indicate unmeasured or unreported defects.',
 'Student rejects GMAW butt weld but all measurements are within D1.1 Table 8.1 limits. Either there is an unreported defect or the student is being overly conservative.',
 'You rejected this weld, but all your reported measurements are within the acceptance criteria. This means either: (1) there is a defect you observed but did not report in your measurements — add it, (2) you are applying the wrong code table (check static vs cyclic), or (3) you are being more conservative than the code requires. Being conservative is safe, but you should be able to cite the specific code requirement that drives the rejection.',
 ARRAY['welding', 'ndt']),

-- MEASUREMENT VS WPS contradictions
('MVW-001', 'Amperage Outside WPS Range', 'measurement_vs_wps', 'major',
 'Reported welding amperage is outside the qualified range specified in the WPS',
 'User reports amperage that is below minimum or above maximum specified in the WPS essential variable range',
 'Student running SMAW 7018 at 145A on WPS that specifies 110-130A range. Exceeding WPS amperage range is an essential variable violation under ASME IX.',
 'Your reported amperage (145A) exceeds the WPS maximum (130A). Amperage is an essential variable — welding outside the qualified range means the procedure is no longer qualified. The resulting weld may have different mechanical properties than the qualification test demonstrated. This must be documented as a WPS deviation.',
 ARRAY['welding']),

('MVW-002', 'Voltage Outside WPS Range', 'measurement_vs_wps', 'major',
 'Reported welding voltage is outside the qualified range specified in the WPS',
 'User reports voltage that is below minimum or above maximum specified in the WPS',
 'GMAW operator running at 28V on WPS specifying 22-26V. Higher voltage increases arc length, reduces penetration, increases spatter.',
 'Your reported voltage (28V) exceeds the WPS maximum (26V). Voltage controls arc length and bead width. Running above the qualified range typically produces a wider, flatter bead with less penetration and more spatter. Adjust your voltage to within the WPS range and re-evaluate the weld deposited at the out-of-range setting.',
 ARRAY['welding']),

-- PROCESS VS EVIDENCE contradictions
('PVE-001', 'Process Claimed Does Not Match Visual Evidence', 'process_vs_evidence', 'major',
 'The claimed welding process does not match visual characteristics visible in the weld',
 'User claims GTAW but weld shows heavy spatter and slag (SMAW/FCAW characteristics); or claims SMAW but weld shows no slag and has stack-of-dimes appearance (GTAW)',
 'Student claims GMAW but weld shows heavy slag coverage and irregular bead — characteristics of FCAW-S (self-shielded).',
 'The visual characteristics of this weld do not match the process you reported. You claimed GMAW, but the heavy slag coverage and irregular bead profile are characteristic of FCAW-S (self-shielded flux-cored). GMAW produces little to no slag. Verify which wire was loaded in the feeder — E71T-11 is FCAW-S, ER70S-6 is GMAW. Using the wrong process invalidates the WPS.',
 ARRAY['welding']),

-- POSITION VS EVIDENCE contradictions
('POS-001', 'Position Claimed Does Not Match Gravity Effects', 'position_vs_evidence', 'major',
 'The claimed welding position does not match the gravity-influenced bead shape visible in the weld',
 'User claims flat position but weld shows sag/droop consistent with overhead; or claims overhead but weld shows no gravity-fighting characteristics',
 'Student claims 1G (flat) position but weld shows sagging on the underside and uneven reinforcement — characteristics of 4G (overhead) welding.',
 'The bead shape in your weld does not match a flat (1G) position. The sagging on the underside and uneven reinforcement are caused by gravity pulling molten metal downward — this happens in overhead (4G) or vertical-down welding. Verify the actual position the coupon was welded in. Misreporting position affects the WPS qualification range and the applicable acceptance criteria.',
 ARRAY['welding']),

-- HISTORY VS CURRENT contradictions
('HVC-001', 'Current Disposition Conflicts With Previous Assessment', 'history_vs_current', 'minor',
 'The current disposition contradicts a previous assessment of the same weld/case without explanation',
 'Current assessment dispositions differently from a prior assessment on the same case_id or assessment_id, and no override or re-examination is documented',
 'Weld was previously rejected for excessive porosity. New assessment accepts with same measurements and no documented repair.',
 'This weld was previously rejected for excessive porosity with measurements exceeding the code limit. Your current assessment accepts the weld with similar measurements and no documented repair. Either: (1) a repair was performed and should be documented, (2) the previous assessment was incorrect and needs formal override, or (3) this acceptance is in error. No weld goes from reject to accept without repair or formal re-evaluation.',
 ARRAY['welding', 'ndt']),

-- LOGIC CONFLICT contradictions
('LOG-001', 'Accept Disposition With Crack Reported', 'logic_conflict', 'critical',
 'Inspector accepts a weld while simultaneously reporting a crack-type discontinuity — cracks are rejectable under all codes',
 'User disposition is accept but findings include any crack type (longitudinal, transverse, crater, throat, toe, root, underbead)',
 'Student reports a crater crack but dispositions the weld as "accept." No welding code permits cracks of any type.',
 'You reported a crater crack AND accepted this weld. Cracks are rejectable under EVERY welding and inspection code — AWS D1.1, D1.5, API 1104, ASME VIII, all of them. There is no size threshold for cracks. If a crack exists, the weld is rejected. Period. Re-evaluate your disposition.',
 ARRAY['welding', 'ndt']),

('LOG-002', 'Reject With No Discontinuities Reported', 'logic_conflict', 'minor',
 'Inspector rejects a weld but has not reported any discontinuities or measurements that would justify rejection',
 'User disposition is reject but findings array is empty or contains no items exceeding code limits',
 'Student rejects a weld but has not documented any specific discontinuity or measurement to justify the rejection.',
 'You rejected this weld but have not documented the specific reason. A rejection must cite a specific discontinuity that exceeds a specific code requirement. What did you see that drove this rejection? Document the discontinuity type, location, and measurement so your rejection is traceable and defensible.',
 ARRAY['welding', 'ndt']),

('LOG-003', 'Insufficient Evidence But Definitive Disposition', 'logic_conflict', 'major',
 'Inspector gives a definitive accept or reject when evidence is clearly insufficient for a reliable determination',
 'Evidence sufficiency score is below 50% but user gives a definitive accept or reject rather than requesting more evidence',
 'Student accepts based on a single blurry photo with no measurements, no WPS reference, and no code clause cited.',
 'You gave a definitive disposition with very limited evidence. You have no calibrated measurements, limited visual evidence, and no code clause cited. A responsible inspector would request additional examination before committing to accept or reject. With the evidence available, the appropriate disposition is "insufficient evidence" — not a definitive judgment.',
 ARRAY['welding', 'ndt']),

-- MATERIAL VS EVIDENCE
('MAT-001', 'Material Claimed Does Not Match Visual/PMI Evidence', 'material_vs_evidence', 'critical',
 'The claimed material does not match visual oxidation patterns, color, or PMI results',
 'User claims carbon steel but weld shows bright silvery appearance with no oxidation (stainless or aluminum characteristics); or claims stainless but weld shows heavy rust scale',
 'Inspector reports carbon steel pipe but weld area shows no oxidation and bright metallic surface — consistent with stainless steel or nickel alloy.',
 'The visual appearance of this material does not match carbon steel. Carbon steel oxidizes rapidly and shows dark scale in the HAZ. The bright, clean appearance with no oxidation is characteristic of stainless steel or nickel alloy. Verify the material with PMI (positive material identification). Wrong material identification means wrong WPS, wrong filler metal, and potentially wrong code — every downstream decision is compromised.',
 ARRAY['welding', 'ndt']);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_contradiction_rules_category ON contradiction_rule_registry(category);
CREATE INDEX IF NOT EXISTS idx_contradiction_rules_severity ON contradiction_rule_registry(severity);
CREATE INDEX IF NOT EXISTS idx_detected_contradictions_assessment ON detected_contradictions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_detected_contradictions_case ON detected_contradictions(case_id);
CREATE INDEX IF NOT EXISTS idx_detected_contradictions_org ON detected_contradictions(org_id);
CREATE INDEX IF NOT EXISTS idx_detected_contradictions_resolved ON detected_contradictions(resolved);
CREATE INDEX IF NOT EXISTS idx_contradiction_assessments_assessment ON contradiction_assessments(assessment_id);
CREATE INDEX IF NOT EXISTS idx_contradiction_assessments_case ON contradiction_assessments(case_id);
CREATE INDEX IF NOT EXISTS idx_contradiction_assessments_org ON contradiction_assessments(org_id);
CREATE INDEX IF NOT EXISTS idx_contradiction_audit_assessment ON contradiction_audit_events(assessment_id);
CREATE INDEX IF NOT EXISTS idx_contradiction_audit_org ON contradiction_audit_events(org_id);
