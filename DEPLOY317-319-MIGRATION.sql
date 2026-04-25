-- ================================================================
-- DEPLOY317-319 SQL MIGRATION
-- Layer 1: Inspection World Model Engine
-- Layer 2: Physics Learning Engine
-- Layer 3: Self-Calibrating Digital Twin Engine
-- Run in Supabase SQL Editor
-- ================================================================

-- ── CLEAN SLATE ─────────────────────────────────────────────────
DROP TABLE IF EXISTS simulation_scenarios CASCADE;
DROP TABLE IF EXISTS world_model_simulations CASCADE;
DROP TABLE IF EXISTS physics_learning_events CASCADE;
DROP TABLE IF EXISTS physics_model_versions CASCADE;
DROP TABLE IF EXISTS physics_model_registry CASCADE;
DROP TABLE IF EXISTS twin_calibration_history CASCADE;
DROP TABLE IF EXISTS twin_drift_records CASCADE;
DROP TABLE IF EXISTS twin_calibration_state CASCADE;

-- ── TABLE 1: world_model_simulations ────────────────────────────
-- Stores time-stepped physics simulations of damage progression
CREATE TABLE IF NOT EXISTS world_model_simulations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  asset_id UUID,
  simulation_type TEXT NOT NULL,
  initial_state JSONB,
  boundary_conditions JSONB,
  physics_parameters JSONB,
  time_horizon_years NUMERIC(6,2),
  time_steps INTEGER,
  results JSONB,
  critical_threshold JSONB,
  time_to_critical TEXT,
  confidence NUMERIC(4,3),
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_world_model_sims_case ON world_model_simulations(case_id);
CREATE INDEX IF NOT EXISTS idx_world_model_sims_asset ON world_model_simulations(asset_id);
CREATE INDEX IF NOT EXISTS idx_world_model_sims_type ON world_model_simulations(simulation_type);

-- ── TABLE 2: simulation_scenarios ───────────────────────────────
-- What-if scenario variants linked to a base simulation
CREATE TABLE IF NOT EXISTS simulation_scenarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  simulation_id UUID REFERENCES world_model_simulations(id) ON DELETE CASCADE,
  scenario_name TEXT NOT NULL,
  scenario_type TEXT,
  modified_conditions JSONB,
  results JSONB,
  divergence_from_baseline JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sim_scenarios_sim ON simulation_scenarios(simulation_id);

-- ── TABLE 3: physics_model_registry ─────────────────────────────
-- Master registry of physics models with default + calibrated parameters
CREATE TABLE IF NOT EXISTS physics_model_registry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_name TEXT NOT NULL,
  model_type TEXT,
  default_parameters JSONB,
  calibrated_parameters JSONB,
  calibration_count INTEGER DEFAULT 0,
  accuracy_score NUMERIC(4,3),
  applicable_materials JSONB,
  applicable_environments JSONB,
  status TEXT DEFAULT 'active',
  version TEXT DEFAULT 'v1.0.0',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_physics_model_type ON physics_model_registry(model_type);
CREATE INDEX IF NOT EXISTS idx_physics_model_status ON physics_model_registry(status);

-- ── TABLE 4: physics_learning_events ────────────────────────────
-- Records predicted vs actual for physics model learning
CREATE TABLE IF NOT EXISTS physics_learning_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id UUID REFERENCES physics_model_registry(id) ON DELETE CASCADE,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  predicted_value NUMERIC(10,4),
  actual_value NUMERIC(10,4),
  prediction_error NUMERIC(10,4),
  environmental_factors JSONB,
  material_factors JSONB,
  parameter_adjustment JSONB,
  learning_weight NUMERIC(4,3),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_physics_learn_model ON physics_learning_events(model_id);
CREATE INDEX IF NOT EXISTS idx_physics_learn_case ON physics_learning_events(case_id);

-- ── TABLE 5: physics_model_versions ─────────────────────────────
-- Version history for physics model parameter changes
CREATE TABLE IF NOT EXISTS physics_model_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id UUID REFERENCES physics_model_registry(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  parameters JSONB,
  accuracy_at_version NUMERIC(4,3),
  change_reason TEXT,
  approved_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_physics_ver_model ON physics_model_versions(model_id);
CREATE INDEX IF NOT EXISTS idx_physics_ver_version ON physics_model_versions(version);

-- ── TABLE 6: twin_calibration_state ─────────────────────────────
-- Current calibration state per asset digital twin
CREATE TABLE IF NOT EXISTS twin_calibration_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL,
  model_type TEXT,
  current_parameters JSONB,
  prediction_accuracy NUMERIC(4,3),
  last_calibration TIMESTAMPTZ,
  drift_rate NUMERIC(6,4),
  calibration_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_twin_cal_asset ON twin_calibration_state(asset_id);
CREATE INDEX IF NOT EXISTS idx_twin_cal_status ON twin_calibration_state(status);

-- ── TABLE 7: twin_calibration_history ───────────────────────────
-- History of predicted vs actual comparisons for twin calibration
CREATE TABLE IF NOT EXISTS twin_calibration_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  calibration_state_id UUID REFERENCES twin_calibration_state(id) ON DELETE CASCADE,
  predicted_value NUMERIC(10,4),
  actual_value NUMERIC(10,4),
  error_before NUMERIC(10,4),
  error_after NUMERIC(10,4),
  parameter_changes JSONB,
  calibration_method TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_twin_hist_state ON twin_calibration_history(calibration_state_id);

-- ── TABLE 8: twin_drift_records ─────────────────────────────────
-- Tracks prediction drift over time for each twin
CREATE TABLE IF NOT EXISTS twin_drift_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  calibration_state_id UUID REFERENCES twin_calibration_state(id) ON DELETE CASCADE,
  drift_magnitude NUMERIC(6,4),
  drift_direction TEXT,
  drift_cause TEXT,
  recalibration_recommended BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_twin_drift_state ON twin_drift_records(calibration_state_id);

-- ── ENABLE RLS ──────────────────────────────────────────────────
ALTER TABLE world_model_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE physics_model_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE physics_learning_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE physics_model_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE twin_calibration_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE twin_calibration_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE twin_drift_records ENABLE ROW LEVEL SECURITY;

-- ── SERVICE ROLE POLICIES ───────────────────────────────────────
CREATE POLICY "service_role_world_model_sims" ON world_model_simulations FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_sim_scenarios" ON simulation_scenarios FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_physics_model_reg" ON physics_model_registry FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_physics_learn" ON physics_learning_events FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_physics_versions" ON physics_model_versions FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_twin_cal_state" ON twin_calibration_state FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_twin_cal_hist" ON twin_calibration_history FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_twin_drift" ON twin_drift_records FOR ALL TO service_role USING (true);

-- ================================================================
-- VERIFICATION: Run after migration
-- ================================================================
-- SELECT 'world_model_simulations' as tbl, count(*) FROM world_model_simulations
-- UNION ALL SELECT 'simulation_scenarios', count(*) FROM simulation_scenarios
-- UNION ALL SELECT 'physics_model_registry', count(*) FROM physics_model_registry
-- UNION ALL SELECT 'physics_learning_events', count(*) FROM physics_learning_events
-- UNION ALL SELECT 'physics_model_versions', count(*) FROM physics_model_versions
-- UNION ALL SELECT 'twin_calibration_state', count(*) FROM twin_calibration_state
-- UNION ALL SELECT 'twin_calibration_history', count(*) FROM twin_calibration_history
-- UNION ALL SELECT 'twin_drift_records', count(*) FROM twin_drift_records;
