-- ================================================================
-- DEPLOY351-352 SQL MIGRATION
-- Uncertainty & Reliability Core + Distribution Sampler Engine
-- Run in Supabase SQL Editor
-- ================================================================

-- ── TABLE 1: uncertainty_reliability_runs ────────────────────────
DROP TABLE IF EXISTS uncertainty_reliability_runs CASCADE;
CREATE TABLE IF NOT EXISTS uncertainty_reliability_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  action TEXT,
  iterations INTEGER,
  distribution_type TEXT,
  survival_model TEXT,
  reliability_class TEXT,
  failure_probability NUMERIC(8,6),
  p05 NUMERIC(12,4),
  p50 NUMERIC(12,4),
  p95 NUMERIC(12,4),
  remaining_life_years NUMERIC(8,2),
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_urc_case ON uncertainty_reliability_runs(case_id);
CREATE INDEX IF NOT EXISTS idx_urc_action ON uncertainty_reliability_runs(action);
CREATE INDEX IF NOT EXISTS idx_urc_class ON uncertainty_reliability_runs(reliability_class);
CREATE INDEX IF NOT EXISTS idx_urc_survival ON uncertainty_reliability_runs(survival_model);

-- ── TABLE 2: distribution_sampler_results ────────────────────────
DROP TABLE IF EXISTS distribution_sampler_results CASCADE;
CREATE TABLE IF NOT EXISTS distribution_sampler_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  action TEXT,
  distribution_type TEXT,
  sample_count INTEGER,
  mean NUMERIC(12,6),
  std_dev NUMERIC(12,6),
  p05 NUMERIC(12,6),
  p50 NUMERIC(12,6),
  p95 NUMERIC(12,6),
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dse_case ON distribution_sampler_results(case_id);
CREATE INDEX IF NOT EXISTS idx_dse_action ON distribution_sampler_results(action);
CREATE INDEX IF NOT EXISTS idx_dse_dist ON distribution_sampler_results(distribution_type);

-- ── ENABLE RLS ────────────────────────────────────────────────────
ALTER TABLE uncertainty_reliability_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribution_sampler_results ENABLE ROW LEVEL SECURITY;

-- ── SERVICE ROLE POLICIES ─────────────────────────────────────────
CREATE POLICY "sr_urc" ON uncertainty_reliability_runs FOR ALL TO service_role USING (true);
CREATE POLICY "sr_dse" ON distribution_sampler_results FOR ALL TO service_role USING (true);

-- ── ANON READ POLICIES ───────────────────────────────────────────
CREATE POLICY "anon_read_urc" ON uncertainty_reliability_runs FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_dse" ON distribution_sampler_results FOR SELECT TO anon USING (true);

-- ================================================================
-- VERIFY: SELECT count(*) FROM information_schema.tables
--         WHERE table_name IN ('uncertainty_reliability_runs','distribution_sampler_results');
-- Expected: 2
-- ================================================================
