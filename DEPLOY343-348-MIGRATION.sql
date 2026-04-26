-- ================================================================
-- DEPLOY343-348 SQL MIGRATION
-- Floating Platform, Subsea Production Equipment, Mooring System,
-- Sour Service Corrosion, Flow Assurance, Riser Dynamics
-- Run in Supabase SQL Editor
-- ================================================================

-- ── TABLE 1: floating_platform_assessments ────────────────────────
DROP TABLE IF EXISTS floating_platform_assessments CASCADE;
CREATE TABLE IF NOT EXISTS floating_platform_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  platform_id TEXT,
  platform_type TEXT,
  action TEXT,
  acceptance TEXT,
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fp_case ON floating_platform_assessments(case_id);
CREATE INDEX IF NOT EXISTS idx_fp_platform ON floating_platform_assessments(platform_id);
CREATE INDEX IF NOT EXISTS idx_fp_type ON floating_platform_assessments(platform_type);

-- ── TABLE 2: subsea_equipment_assessments ─────────────────────────
DROP TABLE IF EXISTS subsea_equipment_assessments CASCADE;
CREATE TABLE IF NOT EXISTS subsea_equipment_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  equipment_id TEXT,
  equipment_type TEXT,
  action TEXT,
  acceptance TEXT,
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_se_case ON subsea_equipment_assessments(case_id);
CREATE INDEX IF NOT EXISTS idx_se_equipment ON subsea_equipment_assessments(equipment_id);
CREATE INDEX IF NOT EXISTS idx_se_type ON subsea_equipment_assessments(equipment_type);

-- ── TABLE 3: mooring_assessments ──────────────────────────────────
DROP TABLE IF EXISTS mooring_assessments CASCADE;
CREATE TABLE IF NOT EXISTS mooring_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  platform_id TEXT,
  line_id TEXT,
  component_type TEXT,
  action TEXT,
  acceptance TEXT,
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_moor_case ON mooring_assessments(case_id);
CREATE INDEX IF NOT EXISTS idx_moor_platform ON mooring_assessments(platform_id);
CREATE INDEX IF NOT EXISTS idx_moor_line ON mooring_assessments(line_id);

-- ── TABLE 4: sour_service_assessments ─────────────────────────────
DROP TABLE IF EXISTS sour_service_assessments CASCADE;
CREATE TABLE IF NOT EXISTS sour_service_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  asset_id TEXT,
  material TEXT,
  h2s_pp_psia NUMERIC(10,4),
  co2_pp_bar NUMERIC(10,4),
  nace_region TEXT,
  corrosion_rate_mm_yr NUMERIC(10,4),
  action TEXT,
  acceptance TEXT,
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sour_case ON sour_service_assessments(case_id);
CREATE INDEX IF NOT EXISTS idx_sour_asset ON sour_service_assessments(asset_id);
CREATE INDEX IF NOT EXISTS idx_sour_region ON sour_service_assessments(nace_region);

-- ── TABLE 5: flow_assurance_assessments ───────────────────────────
DROP TABLE IF EXISTS flow_assurance_assessments CASCADE;
CREATE TABLE IF NOT EXISTS flow_assurance_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  pipeline_id TEXT,
  action TEXT,
  acceptance TEXT,
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_flow_case ON flow_assurance_assessments(case_id);
CREATE INDEX IF NOT EXISTS idx_flow_pipeline ON flow_assurance_assessments(pipeline_id);

-- ── TABLE 6: riser_dynamics_assessments ───────────────────────────
DROP TABLE IF EXISTS riser_dynamics_assessments CASCADE;
CREATE TABLE IF NOT EXISTS riser_dynamics_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  riser_id TEXT,
  riser_type TEXT,
  action TEXT,
  acceptance TEXT,
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_riser_case ON riser_dynamics_assessments(case_id);
CREATE INDEX IF NOT EXISTS idx_riser_id ON riser_dynamics_assessments(riser_id);
CREATE INDEX IF NOT EXISTS idx_riser_type ON riser_dynamics_assessments(riser_type);

-- ── ENABLE RLS ────────────────────────────────────────────────────
ALTER TABLE floating_platform_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subsea_equipment_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mooring_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sour_service_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_assurance_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE riser_dynamics_assessments ENABLE ROW LEVEL SECURITY;

-- ── SERVICE ROLE POLICIES ─────────────────────────────────────────
CREATE POLICY "sr_fp" ON floating_platform_assessments FOR ALL TO service_role USING (true);
CREATE POLICY "sr_se" ON subsea_equipment_assessments FOR ALL TO service_role USING (true);
CREATE POLICY "sr_moor" ON mooring_assessments FOR ALL TO service_role USING (true);
CREATE POLICY "sr_sour" ON sour_service_assessments FOR ALL TO service_role USING (true);
CREATE POLICY "sr_flow" ON flow_assurance_assessments FOR ALL TO service_role USING (true);
CREATE POLICY "sr_riser" ON riser_dynamics_assessments FOR ALL TO service_role USING (true);

-- ================================================================
-- VERIFICATION
-- ================================================================
-- SELECT 'floating_platform_assessments' as tbl, count(*) FROM floating_platform_assessments
-- UNION ALL SELECT 'subsea_equipment_assessments', count(*) FROM subsea_equipment_assessments
-- UNION ALL SELECT 'mooring_assessments', count(*) FROM mooring_assessments
-- UNION ALL SELECT 'sour_service_assessments', count(*) FROM sour_service_assessments
-- UNION ALL SELECT 'flow_assurance_assessments', count(*) FROM flow_assurance_assessments
-- UNION ALL SELECT 'riser_dynamics_assessments', count(*) FROM riser_dynamics_assessments;
