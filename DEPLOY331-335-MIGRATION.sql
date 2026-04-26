-- ================================================================
-- DEPLOY331-335 SQL MIGRATION
-- Output Envelope + Field Observation Protocol + Batch Processing
-- + Asset Registry + Event Bus
-- Run in Supabase SQL Editor
-- ================================================================

-- ── CLEAN SLATE ─────────────────────────────────────────────────
DROP TABLE IF EXISTS output_envelopes CASCADE;
DROP TABLE IF EXISTS field_observations CASCADE;
DROP TABLE IF EXISTS batch_processing_runs CASCADE;
DROP TABLE IF EXISTS asset_registry CASCADE;
DROP TABLE IF EXISTS event_bus_log CASCADE;

-- ── TABLE 1: output_envelopes ───────────────────────────────────
CREATE TABLE IF NOT EXISTS output_envelopes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  engine_id TEXT NOT NULL,
  engine_version TEXT,
  input_hash TEXT,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  deterministic_field_count INTEGER DEFAULT 0,
  interpreted_field_count INTEGER DEFAULT 0,
  quality_score INTEGER DEFAULT 0,
  has_code_references BOOLEAN DEFAULT false,
  has_pass_fail BOOLEAN DEFAULT false,
  full_envelope JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_envelope_engine ON output_envelopes(engine_id);
CREATE INDEX IF NOT EXISTS idx_envelope_case ON output_envelopes(case_id);

-- ── TABLE 2: field_observations ─────────────────────────────────
CREATE TABLE IF NOT EXISTS field_observations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id TEXT,
  cml_id TEXT,
  measurement_type TEXT,
  measured_value NUMERIC(10,4),
  unit TEXT,
  inspector_id TEXT,
  validation_valid BOOLEAN DEFAULT true,
  warning_count INTEGER DEFAULT 0,
  has_history BOOLEAN DEFAULT false,
  corrosion_rate NUMERIC(8,4),
  remaining_life NUMERIC(8,1),
  amendment_count INTEGER DEFAULT 0,
  confirmed BOOLEAN DEFAULT false,
  full_evidence JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_field_obs_asset ON field_observations(asset_id);
CREATE INDEX IF NOT EXISTS idx_field_obs_cml ON field_observations(cml_id);
CREATE INDEX IF NOT EXISTS idx_field_obs_type ON field_observations(measurement_type);

-- ── TABLE 3: batch_processing_runs ──────────────────────────────
CREATE TABLE IF NOT EXISTS batch_processing_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id TEXT NOT NULL,
  total_readings INTEGER DEFAULT 0,
  processed INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  incomplete INTEGER DEFAULT 0,
  critical_count INTEGER DEFAULT 0,
  high_count INTEGER DEFAULT 0,
  action_items_count INTEGER DEFAULT 0,
  fleet_statistics JSONB,
  full_summary JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_batch_id ON batch_processing_runs(batch_id);

-- ── TABLE 4: asset_registry ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS asset_registry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id TEXT UNIQUE NOT NULL,
  asset_type TEXT DEFAULT 'component',
  parent_id TEXT,
  tag_number TEXT,
  name TEXT,
  material_spec TEXT,
  nominal_diameter TEXT,
  nominal_wall NUMERIC(8,2),
  schedule TEXT,
  design_pressure NUMERIC(10,2),
  design_temperature NUMERIC(8,2),
  design_code TEXT,
  service_fluid TEXT,
  operating_temp NUMERIC(8,2),
  operating_pressure NUMERIC(10,2),
  corrosion_allowance NUMERIC(6,2),
  install_date DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_reg_id ON asset_registry(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_reg_parent ON asset_registry(parent_id);
CREATE INDEX IF NOT EXISTS idx_asset_reg_type ON asset_registry(asset_type);
CREATE INDEX IF NOT EXISTS idx_asset_reg_tag ON asset_registry(tag_number);

-- ── TABLE 5: event_bus_log ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_bus_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  severity_level INTEGER DEFAULT 0,
  source_engine TEXT,
  asset_id TEXT,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  message TEXT,
  matched_subscriptions JSONB DEFAULT '[]',
  notification_count INTEGER DEFAULT 0,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_bus_type ON event_bus_log(event_type);
CREATE INDEX IF NOT EXISTS idx_event_bus_severity ON event_bus_log(severity);
CREATE INDEX IF NOT EXISTS idx_event_bus_engine ON event_bus_log(source_engine);
CREATE INDEX IF NOT EXISTS idx_event_bus_asset ON event_bus_log(asset_id);
CREATE INDEX IF NOT EXISTS idx_event_bus_created ON event_bus_log(created_at);

-- ── ENABLE RLS ──────────────────────────────────────────────────
ALTER TABLE output_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_processing_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_bus_log ENABLE ROW LEVEL SECURITY;

-- ── SERVICE ROLE POLICIES ───────────────────────────────────────
CREATE POLICY "sr_output_envelopes" ON output_envelopes FOR ALL TO service_role USING (true);
CREATE POLICY "sr_field_observations" ON field_observations FOR ALL TO service_role USING (true);
CREATE POLICY "sr_batch_processing" ON batch_processing_runs FOR ALL TO service_role USING (true);
CREATE POLICY "sr_asset_registry" ON asset_registry FOR ALL TO service_role USING (true);
CREATE POLICY "sr_event_bus" ON event_bus_log FOR ALL TO service_role USING (true);

-- ================================================================
-- VERIFICATION
-- ================================================================
-- SELECT 'output_envelopes' as tbl, count(*) FROM output_envelopes
-- UNION ALL SELECT 'field_observations', count(*) FROM field_observations
-- UNION ALL SELECT 'batch_processing_runs', count(*) FROM batch_processing_runs
-- UNION ALL SELECT 'asset_registry', count(*) FROM asset_registry
-- UNION ALL SELECT 'event_bus_log', count(*) FROM event_bus_log;
