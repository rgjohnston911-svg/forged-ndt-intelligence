-- ================================================================
-- DEPLOY320-322 SQL MIGRATION
-- Neurosymbolic Reasoning + Conformal Prediction + Active Inspection
-- Run in Supabase SQL Editor
-- ================================================================

-- ── CLEAN SLATE ─────────────────────────────────────────────────
DROP TABLE IF EXISTS neurosymbolic_sessions CASCADE;
DROP TABLE IF EXISTS neurosymbolic_rules CASCADE;
DROP TABLE IF EXISTS conformal_predictions CASCADE;
DROP TABLE IF EXISTS conformal_calibration CASCADE;
DROP TABLE IF EXISTS inspection_priorities CASCADE;
DROP TABLE IF EXISTS portfolio_uncertainty_state CASCADE;

-- ── TABLE 1: neurosymbolic_rules ────────────────────────────────
-- Custom symbolic rules added by users/engineers (beyond hardcoded)
CREATE TABLE IF NOT EXISTS neurosymbolic_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id TEXT NOT NULL UNIQUE,
  category TEXT,
  domain TEXT,
  description TEXT,
  condition TEXT,
  conclusion TEXT,
  severity TEXT,
  symbolic_expression TEXT,
  parameters JSONB,
  overridable BOOLEAN DEFAULT true,
  created_by UUID,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_neuro_rules_category ON neurosymbolic_rules(category);
CREATE INDEX IF NOT EXISTS idx_neuro_rules_domain ON neurosymbolic_rules(domain);
CREATE INDEX IF NOT EXISTS idx_neuro_rules_status ON neurosymbolic_rules(status);

-- ── TABLE 2: neurosymbolic_sessions ─────────────────────────────
-- Records of fused reasoning sessions
CREATE TABLE IF NOT EXISTS neurosymbolic_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  input_data JSONB,
  symbolic_results JSONB,
  pattern_results JSONB,
  fused_chain JSONB,
  conflicts JSONB,
  dominant_source TEXT,
  confidence NUMERIC(4,3),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_neuro_sessions_case ON neurosymbolic_sessions(case_id);

-- ── TABLE 3: conformal_calibration ──────────────────────────────
-- Calibration residuals for conformal prediction intervals
CREATE TABLE IF NOT EXISTS conformal_calibration (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  metric TEXT NOT NULL UNIQUE,
  residuals JSONB,
  calibration_size INTEGER,
  mean_residual NUMERIC(10,4),
  median_residual NUMERIC(10,4),
  max_residual NUMERIC(10,4),
  status TEXT DEFAULT 'active',
  calibrated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conformal_cal_metric ON conformal_calibration(metric);

-- ── TABLE 4: conformal_predictions ──────────────────────────────
-- Records of predictions with conformal intervals
CREATE TABLE IF NOT EXISTS conformal_predictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  asset_id UUID,
  metric TEXT,
  point_estimate NUMERIC(10,4),
  lower_bound NUMERIC(10,4),
  upper_bound NUMERIC(10,4),
  alpha NUMERIC(4,3),
  coverage_guarantee NUMERIC(5,2),
  method TEXT,
  calibration_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conformal_pred_case ON conformal_predictions(case_id);
CREATE INDEX IF NOT EXISTS idx_conformal_pred_metric ON conformal_predictions(metric);
CREATE INDEX IF NOT EXISTS idx_conformal_pred_asset ON conformal_predictions(asset_id);

-- ── TABLE 5: inspection_priorities ──────────────────────────────
-- Active inspection recommendations and outcomes
CREATE TABLE IF NOT EXISTS inspection_priorities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID,
  recommended_inspection TEXT,
  information_gain NUMERIC(6,4),
  current_uncertainty NUMERIC(4,3),
  risk_level TEXT,
  candidates_evaluated INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insp_priorities_asset ON inspection_priorities(asset_id);

-- ── TABLE 6: portfolio_uncertainty_state ────────────────────────
-- Snapshot of uncertainty state across the asset portfolio
CREATE TABLE IF NOT EXISTS portfolio_uncertainty_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL,
  asset_name TEXT,
  uncertainty NUMERIC(4,3),
  active_mechanisms JSONB,
  risk_level TEXT,
  days_since_last_inspection INTEGER,
  recommended_action TEXT,
  snapshot_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_asset ON portfolio_uncertainty_state(asset_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_risk ON portfolio_uncertainty_state(risk_level);

-- ── ENABLE RLS ──────────────────────────────────────────────────
ALTER TABLE neurosymbolic_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE neurosymbolic_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conformal_calibration ENABLE ROW LEVEL SECURITY;
ALTER TABLE conformal_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_uncertainty_state ENABLE ROW LEVEL SECURITY;

-- ── SERVICE ROLE POLICIES ───────────────────────────────────────
CREATE POLICY "service_role_neuro_rules" ON neurosymbolic_rules FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_neuro_sessions" ON neurosymbolic_sessions FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_conformal_cal" ON conformal_calibration FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_conformal_pred" ON conformal_predictions FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_insp_priorities" ON inspection_priorities FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_portfolio_state" ON portfolio_uncertainty_state FOR ALL TO service_role USING (true);

-- ================================================================
-- VERIFICATION
-- ================================================================
-- SELECT 'neurosymbolic_rules' as tbl, count(*) FROM neurosymbolic_rules
-- UNION ALL SELECT 'neurosymbolic_sessions', count(*) FROM neurosymbolic_sessions
-- UNION ALL SELECT 'conformal_calibration', count(*) FROM conformal_calibration
-- UNION ALL SELECT 'conformal_predictions', count(*) FROM conformal_predictions
-- UNION ALL SELECT 'inspection_priorities', count(*) FROM inspection_priorities
-- UNION ALL SELECT 'portfolio_uncertainty_state', count(*) FROM portfolio_uncertainty_state;
