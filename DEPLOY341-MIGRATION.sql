-- ================================================================
-- DEPLOY341 SQL MIGRATION
-- Differential Diagnosis Engine (DDE)
-- Bayesian damage mechanism ranking for NDT inspection workflows
-- Run in Supabase SQL Editor
-- ================================================================

-- ── TABLE: dde_assessments ────────────────────────────────────────
DROP TABLE IF EXISTS dde_assessments CASCADE;

CREATE TABLE IF NOT EXISTS dde_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  domain TEXT,
  service TEXT,
  material TEXT,
  status TEXT,
  top_mechanism TEXT,
  top_posterior NUMERIC(8,4),
  fmd_dominant TEXT,
  fmd_divergence BOOLEAN DEFAULT false,
  evidence_dimensions_used INTEGER DEFAULT 0,
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dde_case ON dde_assessments(case_id);
CREATE INDEX IF NOT EXISTS idx_dde_domain ON dde_assessments(domain);
CREATE INDEX IF NOT EXISTS idx_dde_status ON dde_assessments(status);
CREATE INDEX IF NOT EXISTS idx_dde_top_mechanism ON dde_assessments(top_mechanism);
CREATE INDEX IF NOT EXISTS idx_dde_fmd_divergence ON dde_assessments(fmd_divergence);

-- ── ENABLE RLS ────────────────────────────────────────────────────
ALTER TABLE dde_assessments ENABLE ROW LEVEL SECURITY;

-- ── SERVICE ROLE POLICY ───────────────────────────────────────────
CREATE POLICY "sr_dde" ON dde_assessments FOR ALL TO service_role USING (true);

-- ================================================================
-- VERIFICATION
-- ================================================================
-- SELECT 'dde_assessments' as tbl, count(*) FROM dde_assessments;
