-- ================================================================
-- DEPLOY323-327 SQL MIGRATION
-- Physics-Constrained Inference + Uncertainty Propagation +
-- Causal Discovery + Multi-Agent Debate + Anomaly Fingerprint
-- Run in Supabase SQL Editor
-- ================================================================

-- ── CLEAN SLATE ─────────────────────────────────────────────────
DROP TABLE IF EXISTS constrained_inference_runs CASCADE;
DROP TABLE IF EXISTS uncertainty_propagation_runs CASCADE;
DROP TABLE IF EXISTS causal_discovery_results CASCADE;
DROP TABLE IF EXISTS causal_relationships CASCADE;
DROP TABLE IF EXISTS debate_sessions CASCADE;
DROP TABLE IF EXISTS debate_arguments CASCADE;
DROP TABLE IF EXISTS anomaly_fingerprints CASCADE;
DROP TABLE IF EXISTS anomaly_matches CASCADE;

-- ── TABLE 1: constrained_inference_runs ─────────────────────────
CREATE TABLE IF NOT EXISTS constrained_inference_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  equation_key TEXT NOT NULL,
  observations_count INTEGER,
  inferred_parameters JSONB,
  parameter_uncertainty JSONB,
  fit_quality JSONB,
  tri_state TEXT,
  confidence NUMERIC(4,3),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_constrained_inf_case ON constrained_inference_runs(case_id);
CREATE INDEX IF NOT EXISTS idx_constrained_inf_eq ON constrained_inference_runs(equation_key);

-- ── TABLE 2: uncertainty_propagation_runs ───────────────────────
CREATE TABLE IF NOT EXISTS uncertainty_propagation_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  model_key TEXT,
  method TEXT,
  n_samples INTEGER,
  input_variables JSONB,
  output_mean NUMERIC(10,4),
  output_std NUMERIC(10,4),
  p5 NUMERIC(10,4),
  p95 NUMERIC(10,4),
  probability_of_failure NUMERIC(6,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uncert_prop_case ON uncertainty_propagation_runs(case_id);
CREATE INDEX IF NOT EXISTS idx_uncert_prop_model ON uncertainty_propagation_runs(model_key);

-- ── TABLE 3: causal_discovery_results ───────────────────────────
CREATE TABLE IF NOT EXISTS causal_discovery_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  variables JSONB,
  edges_discovered INTEGER,
  edges_removed INTEGER,
  method TEXT,
  results JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_causal_disc_case ON causal_discovery_results(case_id);

-- ── TABLE 4: causal_relationships ───────────────────────────────
CREATE TABLE IF NOT EXISTS causal_relationships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cause_variable TEXT NOT NULL,
  effect_variable TEXT NOT NULL,
  direction TEXT,
  mechanism TEXT,
  strength TEXT,
  correlation NUMERIC(4,3),
  evidence_count INTEGER DEFAULT 0,
  discovered_by TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_causal_rel_cause ON causal_relationships(cause_variable);
CREATE INDEX IF NOT EXISTS idx_causal_rel_effect ON causal_relationships(effect_variable);

-- ── TABLE 5: debate_sessions ────────────────────────────────────
CREATE TABLE IF NOT EXISTS debate_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  agent_results JSONB,
  judgment JSONB,
  consensus_risk NUMERIC(4,3),
  final_disposition TEXT,
  code_override BOOLEAN DEFAULT false,
  conflicts_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debate_case ON debate_sessions(case_id);

-- ── TABLE 6: debate_arguments ───────────────────────────────────
CREATE TABLE IF NOT EXISTS debate_arguments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES debate_sessions(id) ON DELETE CASCADE,
  agent_name TEXT,
  position TEXT,
  evidence JSONB,
  risk_score NUMERIC(4,3),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debate_args_session ON debate_arguments(session_id);

-- ── TABLE 7: anomaly_fingerprints ───────────────────────────────
CREATE TABLE IF NOT EXISTS anomaly_fingerprints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  fingerprint JSONB,
  top_match TEXT,
  match_score NUMERIC(4,3),
  anomaly_score NUMERIC(4,3),
  classification TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anomaly_fp_case ON anomaly_fingerprints(case_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_fp_class ON anomaly_fingerprints(classification);

-- ── TABLE 8: anomaly_matches ────────────────────────────────────
CREATE TABLE IF NOT EXISTS anomaly_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fingerprint_id UUID REFERENCES anomaly_fingerprints(id) ON DELETE CASCADE,
  library_fingerprint_id TEXT,
  match_score NUMERIC(4,3),
  match_details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anomaly_match_fp ON anomaly_matches(fingerprint_id);

-- ── ENABLE RLS ──────────────────────────────────────────────────
ALTER TABLE constrained_inference_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE uncertainty_propagation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE causal_discovery_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE causal_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_arguments ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_matches ENABLE ROW LEVEL SECURITY;

-- ── SERVICE ROLE POLICIES ───────────────────────────────────────
CREATE POLICY "sr_constrained_inf" ON constrained_inference_runs FOR ALL TO service_role USING (true);
CREATE POLICY "sr_uncert_prop" ON uncertainty_propagation_runs FOR ALL TO service_role USING (true);
CREATE POLICY "sr_causal_disc" ON causal_discovery_results FOR ALL TO service_role USING (true);
CREATE POLICY "sr_causal_rel" ON causal_relationships FOR ALL TO service_role USING (true);
CREATE POLICY "sr_debate_sess" ON debate_sessions FOR ALL TO service_role USING (true);
CREATE POLICY "sr_debate_args" ON debate_arguments FOR ALL TO service_role USING (true);
CREATE POLICY "sr_anomaly_fp" ON anomaly_fingerprints FOR ALL TO service_role USING (true);
CREATE POLICY "sr_anomaly_match" ON anomaly_matches FOR ALL TO service_role USING (true);

-- ================================================================
-- VERIFICATION
-- ================================================================
-- SELECT 'constrained_inference_runs' as tbl, count(*) FROM constrained_inference_runs
-- UNION ALL SELECT 'uncertainty_propagation_runs', count(*) FROM uncertainty_propagation_runs
-- UNION ALL SELECT 'causal_discovery_results', count(*) FROM causal_discovery_results
-- UNION ALL SELECT 'causal_relationships', count(*) FROM causal_relationships
-- UNION ALL SELECT 'debate_sessions', count(*) FROM debate_sessions
-- UNION ALL SELECT 'debate_arguments', count(*) FROM debate_arguments
-- UNION ALL SELECT 'anomaly_fingerprints', count(*) FROM anomaly_fingerprints
-- UNION ALL SELECT 'anomaly_matches', count(*) FROM anomaly_matches;
