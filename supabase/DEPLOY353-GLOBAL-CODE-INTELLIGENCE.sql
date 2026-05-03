-- DEPLOY353: GLOBAL CODE INTELLIGENCE MAPPINGS
-- SQL Migration: global_code_mappings table with jurisdiction-aware code equivalences
-- Purpose: Map US codes to foreign equivalents, track jurisdiction applicability,
--          document technical differences for international inspector workflows

BEGIN;

-- ============================================================
-- Create global_code_mappings table
-- ============================================================
CREATE TABLE IF NOT EXISTS global_code_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  us_code text NOT NULL,                     -- e.g. "API 570", "ASME Section VIII"
  foreign_code text NOT NULL,                -- e.g. "CSA Z662", "EN 13445"
  jurisdiction text NOT NULL,                -- e.g. "canada", "eu", "germany", "uk", "norway", "australia", "brazil", "japan"
  region_display text,                       -- Human-readable e.g. "Canada", "European Union"

  equivalence_level text NOT NULL,           -- one of: "direct", "partial", "no_equivalent", "supersedes"
  category text,                             -- one of: "piping", "pressure_vessel", "pipeline", "structural", "welding", "nde_method", "fitness_for_service"

  -- Technical difference tracking
  key_differences text[],                    -- Array of specific technical differences
  acceptance_criteria_differences text,      -- How acceptance criteria differ
  inspection_interval_differences text,      -- How inspection scheduling differs
  qualification_differences text,            -- Inspector/procedure qualification differences

  -- Edition tracking for maintenance
  edition_us text,                           -- e.g. "API 570 4th Ed. 2016"
  edition_foreign text,                      -- e.g. "CSA Z662:2023"

  notes text,                                -- Additional context

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- Create indexes
-- ============================================================
CREATE INDEX idx_global_code_mappings_jurisdiction_us_code
  ON global_code_mappings(jurisdiction, us_code);

CREATE INDEX idx_global_code_mappings_us_code
  ON global_code_mappings(us_code);

-- ============================================================
-- Enable RLS and policies
-- ============================================================
ALTER TABLE global_code_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read global_code_mappings"
  ON global_code_mappings
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- INSERT SEED DATA — CANADA
-- ============================================================
INSERT INTO global_code_mappings (
  us_code, foreign_code, jurisdiction, region_display,
  equivalence_level, category,
  key_differences, acceptance_criteria_differences,
  inspection_interval_differences, qualification_differences,
  edition_us, edition_foreign, notes
) VALUES
(
  'ASME B31.8', 'CSA Z662', 'canada', 'Canada',
  'partial', 'pipeline',
  ARRAY[
    'CSA Z662 allows higher pressure stress ratios in some gas service conditions',
    'CSA Z662 requires different pipeline coating and cathodic protection criteria',
    'CSA Z662 Section 12 specifies different fatigue assessment methodology',
    'CSA allows hydrogen sulfide service thresholds different from ASME 1% rule'
  ],
  'CSA Z662 acceptance criteria for mill test pressure more conservative in some alloy combinations; tensile strength minimums differ for some material grades',
  'CSA Z662 requires in-service inspection every 3-5 years for transmission lines (vs ASME guideline 5-7 years typically)',
  'CSA Z662 inspector qualifications per CSA W47.1 (not ASME Section IX for piping personnel)',
  'ASME B31.8 2012 + 2014 Addenda', 'CSA Z662:2023',
  'CSA Z662 is primary authority for Canadian gas transmission. API codes supplemental only if explicitly adopted by owner.'
),
(
  'ASME B31.4', 'CSA Z662 (liquid service)', 'canada', 'Canada',
  'partial', 'pipeline',
  ARRAY[
    'CSA Z662 liquid service annex allows higher stress ratios for some service conditions',
    'CSA coating and cathodic protection requirements differ from ASME',
    'Fatigue crack initiation rules diverge for girth welds'
  ],
  'Acceptance thresholds for defect sizing differ: CSA more prescriptive on flaw location and depth limits',
  'CSA requires different in-service inspection schedules for crude oil vs refined products (1-5 year range)',
  'CSA W47.1 qualification path required (different from ASME Section IX)',
  'ASME B31.4 2012 + 2016 Addenda', 'CSA Z662:2023 (Liquid Service Annex)',
  'Applies to crude oil and liquid petroleum transmission in Canada.'
),
(
  'ASME Section VIII', 'CSA B51', 'canada', 'Canada',
  'direct', 'pressure_vessel',
  ARRAY[
    'CSA B51 design margins and safety factors slightly different for certain materials',
    'Fatigue analysis requirements diverge for high-cycle loading',
    'Inspection interval matrix differs: CSA more risk-based in some cases'
  ],
  'Acceptance criteria for welds, corrosion allowance, and proof test pressure differ modestly; CSA typically more conservative on tensile requirements',
  'CSA B51 mandates different inspection intervals based on vessel class and service (often more frequent than ASME)',
  'CSA B51 requires Canadian certification for inspectors/engineers (not reciprocal with ASME credentials)',
  'ASME Section VIII Division 1 2023', 'CSA B51:2023',
  'CSA B51 is Canadian boiler and pressure vessel code. Direct equivalence but with jurisdictional variations.'
),
(
  'AWS D1.1', 'CSA W59', 'canada', 'Canada',
  'direct', 'welding',
  ARRAY[
    'CSA W59 preheat and PWHT requirements differ slightly for certain carbon/HSLA grades',
    'Filler metal specifications and testing differ (CSA uses different designation system)',
    'Qualification test procedures have different bend radii and acceptance for some positions'
  ],
  'CSA W59 visual acceptance criteria more stringent in some defect categories (e.g., undercut depth limits)',
  'Certification renewal intervals differ: CSA 3-5 years (vs AWS typically longer for established qualifications)',
  'CSA W59 requires Canadian Welding Bureau (CWB) certification (not reciprocal with AWS SENSE)',
  'AWS D1.1 / ASME Section IX 2023', 'CSA W59:2023',
  'CSA W59 governs structural steel welding in Canada. Partial equivalence with periodic updates.'
);

-- ============================================================
-- INSERT SEED DATA — EUROPEAN UNION / GERMANY
-- ============================================================
INSERT INTO global_code_mappings (
  us_code, foreign_code, jurisdiction, region_display,
  equivalence_level, category,
  key_differences, acceptance_criteria_differences,
  inspection_interval_differences, qualification_differences,
  edition_us, edition_foreign, notes
) VALUES
(
  'ASME Section VIII Division 1', 'EN 13445', 'eu', 'European Union',
  'partial', 'pressure_vessel',
  ARRAY[
    'EN 13445 incorporates PED 2014/68/EU harmonized standards (regulatory overlay)',
    'Stress analysis methodology (EN uses stress categories, ASME uses maximum stress theory)',
    'Fatigue assessment per EN 13445 Part 3 uses different S-N curves and safety factors',
    'MAWP derivation procedures differ: EN more detailed on creep/fatigue interaction',
    'Inspection interval requirements more prescriptive under EN/PED framework'
  ],
  'EN 13445 accepts lower thickness for some alloys due to different safety margin philosophy; proof test pressures may differ',
  'PED requires mandatory initial inspection and pressure test before service (stricter than ASME in some cases)',
  'EN 13445 requires PED-notified body involvement; ASME Section VIII does not have equivalent regulatory requirement',
  'ASME Section VIII Division 1 2023', 'EN 13445:2014 + Amendments (PED 2014/68/EU)',
  'Partial equivalence: EN 13445 is mandatory in EU; ASME not acceptable as primary authority in EU jurisdiction.'
),
(
  'ASME B31.3', 'EN 13480-3', 'eu', 'European Union',
  'partial', 'piping',
  ARRAY[
    'EN 13480 uses stress categorization different from ASME B31.3 (secondary vs primary stress distinction)',
    'Flexibility analysis per EN more conservative (ASME allows higher stress indices in some configurations)',
    'Thermal expansion and contraction evaluation methods diverge',
    'Fatigue analysis methodology per EN ISO 15614 (different from ASME approach)',
    'Corrosion allowance and design life assumptions differ'
  ],
  'Acceptance criteria for material certifications different: EN more stringent on mill test reports and traceability',
  'In-service inspection intervals per EN 13480 typically 5-10 years (vs ASME guideline 3-5 years); risk-based assessment required',
  'EN 13480 inspector qualification per EN 473 + national certification schemes (not reciprocal with ASME Section IX)',
  'ASME B31.3 2020', 'EN 13480-3:2017 (Process Piping)',
  'EN 13480 is primary in EU. ASME B31.3 not acceptable as sole authority in EU jurisdiction.'
),
(
  'ASME Section IX', 'EN ISO 15614-1', 'eu', 'European Union',
  'partial', 'welding',
  ARRAY[
    'EN ISO 15614 qualification ranges and groupings differ from ASME Section IX (parent material classifications)',
    'Filler metal specifications align with EN ISO 1641 (different designation than AWS)',
    'Bend test radii and acceptance criteria differ between standards',
    'Preheat and PWHT requirements have different mandatory zones and temperature ranges'
  ],
  'EN ISO 15614 visual acceptance criteria per EN ISO 5817 (different flaw size limits than ASME); radiographic acceptance per EN ISO 11699',
  'EN ISO qualification certifications valid 2 years (vs ASME Section IX 3 years with requalification options)',
  'EN ISO 15614 requires certification body involvement (accredited notified body for regulated work); ASME does not mandate external authority',
  'ASME Section IX 2023', 'EN ISO 15614-1:2017',
  'EN ISO 15614 is primary in EU. ASME Section IX not accepted without explicit reference in PED documentation.'
);

-- ============================================================
-- INSERT SEED DATA — UNITED KINGDOM
-- ============================================================
INSERT INTO global_code_mappings (
  us_code, foreign_code, jurisdiction, region_display,
  equivalence_level, category,
  key_differences, acceptance_criteria_differences,
  inspection_interval_differences, qualification_differences,
  edition_us, edition_foreign, notes
) VALUES
(
  'API 579-1', 'BS 7910', 'uk', 'United Kingdom',
  'partial', 'fitness_for_service',
  ARRAY[
    'BS 7910 uses fracture mechanics assessment (similar to API 579-1 Part 9) but with different failure assessment diagram (FAD) construction',
    'Crack tip opening displacement (CTOD) approach differs from LEFM assumptions',
    'Material property derivation methods differ: BS 7910 more conservative in some alloy groups',
    'Residual stress treatment in assessments differs between standards'
  ],
  'BS 7910 acceptance criteria for crack size and growth rate more prescriptive in some cases; flaw interaction rules differ',
  'BS 7910 inspection intervals driven by assessed remaining strength: typically 1-5 year range for defects (more flexible than API 579-1 prescriptive guidance)',
  'BS 7910 assessor qualification per ISO 17662 (fracture mechanics expert certification); API 579-1 uses inspector/engineer experience path',
  'API 579-1 FFS 2016', 'BS 7910:2019 (Guidance on methods for assessing the acceptability of flaws in metallic structures)',
  'UK accepts BS 7910 as primary FFS authority. API 579-1 supplemental if explicitly adopted.'
),
(
  'AWS D1.1', 'BS EN 1090-2', 'uk', 'United Kingdom',
  'partial', 'welding',
  ARRAY[
    'BS EN 1090 adopts EN ISO 5817 acceptance levels (A, B, C) rather than AWS D1.1 categories',
    'Preheat temperature requirements more stringent in BS EN for higher strength steels',
    'Filler metal specifications per EN ISO 1641 (not AWS A5.x)',
    'Qualification ranges use parent material groupings per EN ISO 15614 (different from AWS D1.1 groupings)'
  ],
  'BS EN 1090 acceptance criteria more conservative for surface breaking defects; undercut and porosity size limits stricter',
  'BS EN 1090 inspector certification valid 3 years with annual surveillance (vs AWS SENSE typically 3-5 years)',
  'BS EN 1090 requires CCNSG (ASME equivalent) certification for certain classes of welding; US CWIB credentials not recognized',
  'AWS D1.1 / ASME Section IX 2023', 'BS EN 1090-2:2018 (Execution of steel structures and aluminium structures - Part 2: Technical requirements for steel structures)',
  'BS EN 1090 is primary in UK. AWS D1.1 not accepted without explicit reference.'
);

-- ============================================================
-- INSERT SEED DATA — NORWAY
-- ============================================================
INSERT INTO global_code_mappings (
  us_code, foreign_code, jurisdiction, region_display,
  equivalence_level, category,
  key_differences, acceptance_criteria_differences,
  inspection_interval_differences, qualification_differences,
  edition_us, edition_foreign, notes
) VALUES
(
  'API 570', 'NORSOK M-001', 'norway', 'Norway',
  'partial', 'piping',
  ARRAY[
    'NORSOK M-001 stress allowables more conservative than API 570 for some alloys in offshore service',
    'In-service flaw assessment per NORSOK more stringent (incorporates fracture mechanics)',
    'Corrosion allowance methodology differs: NORSOK prescribes design life assumptions',
    'Fatigue assessment mandatory in NORSOK for cyclic loading (not always required in API 570)',
    'Materials approval process more rigorous: NORSOK requires vendor assessment and DNV-GL review'
  ],
  'NORSOK M-001 acceptance criteria for wall thickness measurements: tighter tolerance stack-up than API 570',
  'NORSOK M-001 in-service inspection mandatory every 2-5 years for critical piping (vs API 570 5-10 year guideline)',
  'NORSOK M-001 requires DNV-GL certified inspector (not API inspector credential); different qualification pathway',
  'API 570 2015', 'NORSOK M-001:2023 (Piping systems)',
  'NORSOK M-001 is primary for Norwegian offshore. API 570 supplemental only if DNV-GL approves.'
),
(
  'ASME B31.8', 'DNV-OS-F101', 'norway', 'Norway',
  'partial', 'pipeline',
  ARRAY[
    'DNV-OS-F101 incorporates environmental factors (Arctic, deep-water) not in ASME B31.8',
    'Fracture initiation propagation control (FIPP) methodology mandatory in DNV (optional in ASME)',
    'Material specifications and impact testing more rigorous in DNV-OS-F101',
    'Buckle propagation analysis required by DNV for certain geometries',
    'Subsea installation and laying requirements integrated in DNV (not part of ASME code)'
  ],
  'DNV-OS-F101 wall thickness derivation incorporates pressure cycling and low-cycle fatigue (ASME does not)',
  'In-service inspection per DNV every 5-10 years (more frequent for defect-bearing lines); more risk-based than ASME guideline',
  'DNV-OS-F101 inspector qualification via DNV pipeline technician certification (not ASME equivalent)',
  'ASME B31.8 2012', 'DNV-OS-F101:2021 (Submarine Pipeline Systems)',
  'DNV-OS-F101 is primary for Norwegian subsea pipelines. ASME B31.8 not acceptable without DNV approval.'
),
(
  'ASME Section V', 'NORSOK M-710', 'norway', 'Norway',
  'direct', 'nde_method',
  ARRAY[
    'NORSOK M-710 NDE acceptance criteria more stringent for offshore applications',
    'Ultrasonic examination per NORSOK M-710 specifies smaller flaw detection thresholds',
    'Automated UT mapping mandatory in NORSOK for critical welds (not always required by ASME V)',
    'Phased array UT more prominent in NORSOK (ASME V uses conventional UT primarily)'
  ],
  'NORSOK M-710 acceptance uses smaller flaw dimensions for offshore service (safety margin philosophy)',
  'NORSOK M-710 requires periodic recertification of NDE procedures every 2 years (vs ASME V typically 3 years)',
  'NORSOK M-710 NDE personnel must hold DNV certification (not reciprocal with ASME NDT certification)',
  'ASME Section V 2023', 'NORSOK M-710:2018 (Qualification of NDE Personnel)',
  'NORSOK M-710 is primary for Norwegian offshore NDE. ASME Section V supplemental if DNV approves procedure adaptation.'
);

-- ============================================================
-- INSERT SEED DATA — AUSTRALIA / NEW ZEALAND
-- ============================================================
INSERT INTO global_code_mappings (
  us_code, foreign_code, jurisdiction, region_display,
  equivalence_level, category,
  key_differences, acceptance_criteria_differences,
  inspection_interval_differences, qualification_differences,
  edition_us, edition_foreign, notes
) VALUES
(
  'API 510 / API 570', 'AS/NZS 3788', 'australia', 'Australia/New Zealand',
  'partial', 'pressure_vessel',
  ARRAY[
    'AS/NZS 3788 incorporates Australian Pressure Equipment Safety Standard (APESS)',
    'Design pressure and stress allowances differ from API (AS/NZS uses lower safety factors in some cases)',
    'Corrosion allowance methodology more conservative for marine/coastal environments (AS/NZS)',
    'In-service assessment criteria more risk-based than API inspection codes',
    'Materials certification requirements aligned with ISO standards (not API equivalents)'
  ],
  'AS/NZS 3788 acceptance for wall loss uses thickness monitoring and trend analysis more heavily than API threshold approach',
  'AS/NZS 3788 inspection interval matrix different: typically 1-5 years based on risk assessment (vs API 510 3-10 year ranges)',
  'AS/NZS 3788 competency requirements per AS/NZS 1379 (not direct reciprocity with API inspector credentials)',
  'API 510 2020, API 570 2015', 'AS/NZS 3788:2021 (Pressure equipment — Safety)',
  'AS/NZS 3788 is primary in Australia/NZ. API codes supplemental if AS/NZS compliance verified.'
),
(
  'ASME B31.8', 'AS 2885', 'australia', 'Australia',
  'partial', 'pipeline',
  ARRAY[
    'AS 2885 incorporates Australian onshore/offshore pipeline standards (Part 1 design, Part 2 inspection)',
    'Stress ratios and design factor more stringent in AS 2885 for some service conditions',
    'Seismic and environmental hazard loading per AS 2885 more relevant to Australian geography',
    'Fatigue assessment mandatory in AS 2885 Part 2 for certain service categories',
    'Cathodic protection and coating requirements more specific to Australian soil/marine conditions'
  ],
  'AS 2885 wall thickness calculation incorporates cyclone/wind loading (not in ASME B31.8)',
  'AS 2885 mandatory inspection every 3-5 years (more frequent than ASME guideline); biennial for high-risk lines',
  'AS 2885 pipeline inspector qualification via Australian certification schemes (not reciprocal with ASME)',
  'ASME B31.8 2012', 'AS 2885:2023 (Pipelines — Design and construction / Inspection and testing)',
  'AS 2885 is primary for Australian pipelines. ASME B31.8 not acceptable without explicit AS 2885 compliance verification.'
),
(
  'AWS D1.1', 'AS/NZS 1554', 'australia', 'Australia',
  'partial', 'welding',
  ARRAY[
    'AS/NZS 1554 adopts ISO 5817 flaw acceptance levels (A, B, C) rather than AWS categories',
    'Preheat and PWHT requirements aligned with ISO 17659 (not AWS procedures)',
    'Filler metal specifications per AS/NZS ISO 1641 (not AWS A5.x equivalents)',
    'Qualification ranges per ISO 15614 (different parent material groupings than AWS)'
  ],
  'AS/NZS 1554 acceptance for surface defects more stringent than AWS D1.1 in some flaw categories',
  'AS/NZS 1554 welder certification valid 2-3 years with mandatory requalification (vs AWS 3-5 year typical)',
  'AS/NZS 1554 requires Australian Board of Certification (ABC) credential (not AWS SENSE reciprocal)',
  'AWS D1.1 2023', 'AS/NZS 1554:2018 (Structural steel welding)',
  'AS/NZS 1554 is primary in Australia/NZ. AWS D1.1 not accepted without explicit AS/NZS compliance pathway.'
);

-- ============================================================
-- INSERT SEED DATA — BRAZIL
-- ============================================================
INSERT INTO global_code_mappings (
  us_code, foreign_code, jurisdiction, region_display,
  equivalence_level, category,
  key_differences, acceptance_criteria_differences,
  inspection_interval_differences, qualification_differences,
  edition_us, edition_foreign, notes
) VALUES
(
  'API 510 / API 570', 'NR-13', 'brazil', 'Brazil',
  'direct', 'pressure_vessel',
  ARRAY[
    'NR-13 (Brazilian regulatory standard) adopts ASME as reference but with local enforcement variations',
    'Inspection intervals more conservative in NR-13 for vessels with corrosion history',
    'Hydrostatic test pressure higher in NR-13 (typically 1.5x instead of 1.3x design pressure)',
    'Documentation and record-keeping requirements more rigorous per NR-13',
    'Inspector certification must include Brazilian government approval (not just API credential)'
  ],
  'NR-13 acceptance criteria for wear monitoring more frequent (annual vs biennial in API)',
  'NR-13 mandatory inspection every 12-24 months (vs API 510 3-10 year range depending on risk)',
  'NR-13 requires NR-13 inspector certification from INMETRO-accredited body (not reciprocal with API)',
  'API 510 2020, API 570 2015', 'NR-13 (Vasos de Pressão) + ABNT NBR 8084',
  'NR-13 is primary and mandatory in Brazil. API codes used as technical reference but NR-13 regulatory compliance required.'
),
(
  'ASME B31.3', 'ABNT NBR 15749', 'brazil', 'Brazil',
  'partial', 'piping',
  ARRAY[
    'ABNT NBR 15749 incorporates Brazilian operational practices and tropical environment considerations',
    'Stress allowables slightly different for materials commonly used in Brazilian refineries',
    'Thermal expansion allowances account for higher ambient temperature swings',
    'Fatigue assessment methodology aligned with API 579-1 but with Brazilian-specific guidance',
    'Materials selection more prescriptive for corrosion-prone service (H2S, CO2, brine)'
  ],
  'ABNT NBR 15749 acceptance criteria for fittings and components more restrictive than ASME B31.3',
  'ABNT NBR 15749 in-service inspection intervals 2-5 years (more frequent than ASME guideline); biennial for critical lines',
  'ABNT NBR 15749 inspector qualification per ABNT certification (not ASME Section IX reciprocal)',
  'ASME B31.3 2020', 'ABNT NBR 15749:2021 (Sistemas de tubulação - Critérios para projeto, materiais, fabricação e inspeção)',
  'ABNT NBR 15749 is primary in Brazil. ASME B31.3 used as technical reference with ABNT compliance verification.'
);

-- ============================================================
-- Final notes and timestamp
-- ============================================================
COMMIT;

-- Migration notes:
-- This table provides a reference framework for inspector training, code equivalence evaluation,
-- and international equipment assessment. The key_differences and acceptance_criteria_differences
-- fields allow inspectors to quickly understand what changes when transitioning between jurisdictions.
--
-- Future enhancements:
-- - Add version history tracking for code editions
-- - Link to JURISDICTION_MAP in authority-lock.js for automated detection
-- - Add inspector_certification_crosswalk table for credential recognition
-- - Implement temporal validity (effective_from / effective_to) for code edition tracking
