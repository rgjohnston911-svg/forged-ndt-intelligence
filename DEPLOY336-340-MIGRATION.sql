-- ================================================================
-- DEPLOY336-340 SQL MIGRATION
-- Deep Code Authority: API 579 L2, API 581 RBI, API 653 Tank,
-- Pipeline Integrity, Offshore Structural Assessment
-- Run in Supabase SQL Editor
-- ================================================================

-- ── CLEAN SLATE ─────────────────────────────────────────────────
DROP TABLE IF EXISTS api579_assessments CASCADE;
DROP TABLE IF EXISTS rbi_assessments CASCADE;
DROP TABLE IF EXISTS tank_assessments CASCADE;
DROP TABLE IF EXISTS pipeline_assessments CASCADE;
DROP TABLE IF EXISTS offshore_structural_assessments CASCADE;

-- ── TABLE 1: api579_assessments ────────────────────────────────
CREATE TABLE IF NOT EXISTS api579_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  asset_id TEXT,
  component_type TEXT,
  action TEXT DEFAULT 'assess',
  tmin NUMERIC(10,4),
  rt NUMERIC(8,4),
  lambda NUMERIC(8,4),
  mt NUMERIC(8,4),
  rsf NUMERIC(8,4),
  rsf_allowable NUMERIC(8,4) DEFAULT 0.9,
  mawp NUMERIC(10,2),
  mawp_reduced NUMERIC(10,2),
  remaining_life NUMERIC(8,1),
  acceptance TEXT,
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api579_case ON api579_assessments(case_id);
CREATE INDEX IF NOT EXISTS idx_api579_asset ON api579_assessments(asset_id);
CREATE INDEX IF NOT EXISTS idx_api579_acceptance ON api579_assessments(acceptance);

-- ── TABLE 2: rbi_assessments ───────────────────────────────────
CREATE TABLE IF NOT EXISTS rbi_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  asset_id TEXT,
  equipment_type TEXT,
  action TEXT DEFAULT 'assess_risk',
  pof NUMERIC(12,8),
  cof_area NUMERIC(10,2),
  cof_usd NUMERIC(14,2),
  risk_score NUMERIC(14,4),
  risk_level TEXT,
  damage_factor NUMERIC(12,2),
  inspection_effectiveness TEXT,
  next_inspection_years NUMERIC(6,1),
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rbi_case ON rbi_assessments(case_id);
CREATE INDEX IF NOT EXISTS idx_rbi_asset ON rbi_assessments(asset_id);
CREATE INDEX IF NOT EXISTS idx_rbi_risk ON rbi_assessments(risk_level);

-- ── TABLE 3: tank_assessments ──────────────────────────────────
CREATE TABLE IF NOT EXISTS tank_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  asset_id TEXT,
  tank_diameter_ft NUMERIC(8,1),
  tank_height_ft NUMERIC(8,1),
  action TEXT DEFAULT 'assess',
  course_count INTEGER DEFAULT 0,
  min_remaining_life NUMERIC(8,1),
  bottom_remaining_life NUMERIC(8,1),
  settlement_acceptable BOOLEAN DEFAULT true,
  overall_verdict TEXT,
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tank_case ON tank_assessments(case_id);
CREATE INDEX IF NOT EXISTS idx_tank_asset ON tank_assessments(asset_id);
CREATE INDEX IF NOT EXISTS idx_tank_verdict ON tank_assessments(overall_verdict);

-- ── TABLE 4: pipeline_assessments ──────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  pipeline_id TEXT,
  segment_id TEXT,
  action TEXT DEFAULT 'assess_segment',
  class_location INTEGER,
  maop NUMERIC(10,2),
  hca_identified BOOLEAN DEFAULT false,
  threat_count INTEGER DEFAULT 0,
  critical_features INTEGER DEFAULT 0,
  reassessment_years NUMERIC(6,1),
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_case ON pipeline_assessments(case_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_id ON pipeline_assessments(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_segment ON pipeline_assessments(segment_id);

-- ── TABLE 5: offshore_structural_assessments ───────────────────
CREATE TABLE IF NOT EXISTS offshore_structural_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  platform_id TEXT,
  member_id TEXT,
  action TEXT DEFAULT 'assess_member',
  unity_check NUMERIC(8,4),
  fatigue_damage NUMERIC(8,4),
  remaining_fatigue_life NUMERIC(8,1),
  inspection_level TEXT,
  assessment_verdict TEXT,
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offshore_case ON offshore_structural_assessments(case_id);
CREATE INDEX IF NOT EXISTS idx_offshore_platform ON offshore_structural_assessments(platform_id);
CREATE INDEX IF NOT EXISTS idx_offshore_member ON offshore_structural_assessments(member_id);
CREATE INDEX IF NOT EXISTS idx_offshore_verdict ON offshore_structural_assessments(assessment_verdict);

-- ── ENABLE RLS ──────────────────────────────────────────────────
ALTER TABLE api579_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rbi_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tank_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE offshore_structural_assessments ENABLE ROW LEVEL SECURITY;

-- ── SERVICE ROLE POLICIES ───────────────────────────────────────
CREATE POLICY "sr_api579" ON api579_assessments FOR ALL TO service_role USING (true);
CREATE POLICY "sr_rbi" ON rbi_assessments FOR ALL TO service_role USING (true);
CREATE POLICY "sr_tank" ON tank_assessments FOR ALL TO service_role USING (true);
CREATE POLICY "sr_pipeline" ON pipeline_assessments FOR ALL TO service_role USING (true);
CREATE POLICY "sr_offshore" ON offshore_structural_assessments FOR ALL TO service_role USING (true);

-- ================================================================
-- VERIFICATION
-- ================================================================
-- SELECT 'api579_assessments' as tbl, count(*) FROM api579_assessments
-- UNION ALL SELECT 'rbi_assessments', count(*) FROM rbi_assessments
-- UNION ALL SELECT 'tank_assessments', count(*) FROM tank_assessments
-- UNION ALL SELECT 'pipeline_assessments', count(*) FROM pipeline_assessments
-- UNION ALL SELECT 'offshore_structural_assessments', count(*) FROM offshore_structural_assessments;
