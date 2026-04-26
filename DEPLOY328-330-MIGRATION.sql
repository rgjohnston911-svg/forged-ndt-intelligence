-- ================================================================
-- DEPLOY328-330 SQL MIGRATION
-- Explainability & Audit Trail + Temporal Fusion + Regulatory Report
-- Run in Supabase SQL Editor
-- ================================================================

-- ── CLEAN SLATE ─────────────────────────────────────────────────
DROP TABLE IF EXISTS explainability_traces CASCADE;
DROP TABLE IF EXISTS temporal_fusion_states CASCADE;
DROP TABLE IF EXISTS regulatory_reports CASCADE;

-- ── TABLE 1: explainability_traces ──────────────────────────────
CREATE TABLE IF NOT EXISTS explainability_traces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  trace_id TEXT NOT NULL,
  layers_executed INTEGER,
  total_inputs INTEGER,
  total_models INTEGER,
  total_rules INTEGER,
  critical_decisions_count INTEGER DEFAULT 0,
  narrative_summary TEXT,
  full_trace JSONB,
  audit_package JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_explain_trace_case ON explainability_traces(case_id);
CREATE INDEX IF NOT EXISTS idx_explain_trace_id ON explainability_traces(trace_id);

-- ── TABLE 2: temporal_fusion_states ─────────────────────────────
CREATE TABLE IF NOT EXISTS temporal_fusion_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id TEXT,
  health_index NUMERIC(4,3),
  confidence INTEGER,
  regime TEXT,
  active_alarms_count INTEGER DEFAULT 0,
  stream_contributions JSONB,
  cross_stream_attention JSONB,
  full_state JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_temporal_fusion_asset ON temporal_fusion_states(asset_id);
CREATE INDEX IF NOT EXISTS idx_temporal_fusion_regime ON temporal_fusion_states(regime);

-- ── TABLE 3: regulatory_reports ─────────────────────────────────
CREATE TABLE IF NOT EXISTS regulatory_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id TEXT NOT NULL,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  template TEXT NOT NULL,
  title TEXT,
  code_reference TEXT,
  completeness INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',
  calculations_count INTEGER DEFAULT 0,
  full_report JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reg_report_case ON regulatory_reports(case_id);
CREATE INDEX IF NOT EXISTS idx_reg_report_template ON regulatory_reports(template);
CREATE INDEX IF NOT EXISTS idx_reg_report_status ON regulatory_reports(status);

-- ── ENABLE RLS ──────────────────────────────────────────────────
ALTER TABLE explainability_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE temporal_fusion_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_reports ENABLE ROW LEVEL SECURITY;

-- ── SERVICE ROLE POLICIES ───────────────────────────────────────
CREATE POLICY "sr_explain_traces" ON explainability_traces FOR ALL TO service_role USING (true);
CREATE POLICY "sr_temporal_fusion" ON temporal_fusion_states FOR ALL TO service_role USING (true);
CREATE POLICY "sr_reg_reports" ON regulatory_reports FOR ALL TO service_role USING (true);

-- ================================================================
-- VERIFICATION
-- ================================================================
-- SELECT 'explainability_traces' as tbl, count(*) FROM explainability_traces
-- UNION ALL SELECT 'temporal_fusion_states', count(*) FROM temporal_fusion_states
-- UNION ALL SELECT 'regulatory_reports', count(*) FROM regulatory_reports;
