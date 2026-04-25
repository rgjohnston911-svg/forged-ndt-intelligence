-- ================================================================
-- DEPLOY313-314 SQL MIGRATION
-- Regression Test Authority + Decision Proof Recorder
-- Run in Supabase SQL Editor
-- ================================================================

-- ── TABLE 1: regression_test_runs ─────────────────────────────────
-- Stores results from each regression test suite run
CREATE TABLE IF NOT EXISTS regression_test_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_type TEXT NOT NULL DEFAULT 'full_suite',
  total_tests INTEGER NOT NULL DEFAULT 0,
  passed INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  pass_rate NUMERIC(6,2) NOT NULL DEFAULT 0,
  verdict TEXT NOT NULL DEFAULT 'UNKNOWN',
  total_ms INTEGER DEFAULT 0,
  results_json JSONB,
  run_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying run history
CREATE INDEX IF NOT EXISTS idx_regression_runs_at ON regression_test_runs(run_at DESC);
CREATE INDEX IF NOT EXISTS idx_regression_verdict ON regression_test_runs(verdict);

-- ── TABLE 2: decision_proofs ──────────────────────────────────────
-- Immutable proof records for every authority decision
CREATE TABLE IF NOT EXISTS decision_proofs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proof_id TEXT UNIQUE NOT NULL,
  case_id UUID NOT NULL,
  source_engine TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  decision_value TEXT NOT NULL,
  rationale TEXT NOT NULL,
  input_summary JSONB,
  physics_applied JSONB,
  code_authority JSONB,
  evidence_quality NUMERIC(4,3),
  confidence NUMERIC(4,3),
  alternatives_considered JSONB,
  assumptions JSONB,
  prior_proof_id TEXT,
  revision_reason TEXT,
  metadata JSONB,
  integrity_hash TEXT NOT NULL,
  completeness_pct INTEGER DEFAULT 0,
  completeness_grade TEXT DEFAULT 'D',
  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_proofs_case_id ON decision_proofs(case_id);
CREATE INDEX IF NOT EXISTS idx_proofs_source_engine ON decision_proofs(source_engine);
CREATE INDEX IF NOT EXISTS idx_proofs_decision_type ON decision_proofs(decision_type);
CREATE INDEX IF NOT EXISTS idx_proofs_recorded_at ON decision_proofs(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_proofs_prior ON decision_proofs(prior_proof_id);
CREATE INDEX IF NOT EXISTS idx_proofs_grade ON decision_proofs(completeness_grade);

-- ── ENABLE RLS (non-blocking) ─────────────────────────────────────
ALTER TABLE regression_test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_proofs ENABLE ROW LEVEL SECURITY;

-- Service role access
CREATE POLICY "service_role_regression" ON regression_test_runs FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_proofs" ON decision_proofs FOR ALL TO service_role USING (true);

-- ================================================================
-- VERIFICATION: Run after migration
-- ================================================================
-- SELECT 'regression_test_runs' as tbl, count(*) FROM regression_test_runs
-- UNION ALL
-- SELECT 'decision_proofs' as tbl, count(*) FROM decision_proofs;
