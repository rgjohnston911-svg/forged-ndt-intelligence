-- ================================================================
-- DEPLOY342 SQL MIGRATION
-- Comprehensive Assessment Orchestrator
-- Run in Supabase SQL Editor
-- ================================================================

DROP TABLE IF EXISTS comprehensive_assessments CASCADE;

CREATE TABLE IF NOT EXISTS comprehensive_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  domain TEXT,
  equipment_type TEXT,
  scope TEXT,
  disposition TEXT,
  stages_succeeded INTEGER DEFAULT 0,
  stages_failed INTEGER DEFAULT 0,
  total_elapsed_ms INTEGER DEFAULT 0,
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comp_case ON comprehensive_assessments(case_id);
CREATE INDEX IF NOT EXISTS idx_comp_domain ON comprehensive_assessments(domain);
CREATE INDEX IF NOT EXISTS idx_comp_disposition ON comprehensive_assessments(disposition);
CREATE INDEX IF NOT EXISTS idx_comp_equipment ON comprehensive_assessments(equipment_type);

ALTER TABLE comprehensive_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sr_comp" ON comprehensive_assessments FOR ALL TO service_role USING (true);

-- ================================================================
-- VERIFICATION
-- ================================================================
-- SELECT 'comprehensive_assessments' as tbl, count(*) FROM comprehensive_assessments;
