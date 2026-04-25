-- DEPLOY273-277: Phase 1 v8 Expansion Tables
-- Run in Supabase SQL Editor BEFORE deploying code

-- Evidence contracts (engine 65)
CREATE TABLE IF NOT EXISTS evidence_contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  case_id UUID,
  domain TEXT NOT NULL,
  contract_key TEXT NOT NULL,
  evidence_items JSONB DEFAULT '[]',
  evidence_score NUMERIC(4,2),
  confidence_ceiling NUMERIC(4,2),
  mode_eligibility TEXT,
  missing_critical JSONB DEFAULT '[]',
  result_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coating assessments (engine 66)
CREATE TABLE IF NOT EXISTS coating_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  case_id UUID,
  scan_id UUID,
  coating_system TEXT,
  service_environment TEXT,
  disposition TEXT,
  mode TEXT,
  confidence NUMERIC(4,2),
  evidence_score NUMERIC(4,2),
  flags JSONB DEFAULT '[]',
  steps JSONB DEFAULT '[]',
  result_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coating audit events (engine 66)
CREATE TABLE IF NOT EXISTS coating_audit_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  case_id UUID,
  scan_id UUID,
  action_type TEXT NOT NULL,
  event_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Uncertainty records (engine 68)
CREATE TABLE IF NOT EXISTS uncertainty_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  case_id UUID,
  final_confidence NUMERIC(4,2),
  confidence_ceiling NUMERIC(4,2),
  knowledge_state TEXT,
  sources_count INTEGER,
  result_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Decision audit log (engine 69)
CREATE TABLE IF NOT EXISTS decision_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  case_id UUID,
  decision_category TEXT,
  decision_mode TEXT,
  confidence NUMERIC(4,2),
  disposition TEXT,
  rationale TEXT,
  human_reviewer TEXT,
  human_approved BOOLEAN DEFAULT FALSE,
  engine_versions JSONB DEFAULT '{}',
  evidence_summary JSONB,
  escalation_flags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_evidence_contracts_org ON evidence_contracts(org_id);
CREATE INDEX IF NOT EXISTS idx_evidence_contracts_case ON evidence_contracts(case_id);
CREATE INDEX IF NOT EXISTS idx_coating_assessments_org ON coating_assessments(org_id);
CREATE INDEX IF NOT EXISTS idx_coating_assessments_case ON coating_assessments(case_id);
CREATE INDEX IF NOT EXISTS idx_coating_audit_events_org ON coating_audit_events(org_id);
CREATE INDEX IF NOT EXISTS idx_uncertainty_records_org ON uncertainty_records(org_id);
CREATE INDEX IF NOT EXISTS idx_uncertainty_records_case ON uncertainty_records(case_id);
CREATE INDEX IF NOT EXISTS idx_decision_audit_log_org ON decision_audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_decision_audit_log_case ON decision_audit_log(case_id);

-- Enable RLS
ALTER TABLE evidence_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE coating_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE coating_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE uncertainty_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies (service role bypass)
CREATE POLICY "evidence_contracts_service" ON evidence_contracts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "coating_assessments_service" ON coating_assessments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "coating_audit_events_service" ON coating_audit_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "uncertainty_records_service" ON uncertainty_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "decision_audit_log_service" ON decision_audit_log FOR ALL USING (true) WITH CHECK (true);
