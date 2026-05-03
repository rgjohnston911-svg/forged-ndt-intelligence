-- ============================================================
-- DEPLOY354: Field Chaos Validator — Real Data Validation Tables
-- FORGED 4D NDT Intelligence OS
-- ============================================================

-- Field Chaos Cases — stores each validation case run
CREATE TABLE IF NOT EXISTS field_chaos_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id TEXT NOT NULL,
  case_title TEXT NOT NULL,
  input_quality_score NUMERIC(4,2),
  extraction_confidence NUMERIC(4,2),
  decision_lock TEXT NOT NULL DEFAULT 'PENDING',
  final_disposition_allowed BOOLEAN DEFAULT FALSE,
  inspector_message TEXT,
  score INTEGER,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Field Chaos Documents — evidence intake records
CREATE TABLE IF NOT EXISTS field_chaos_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES field_chaos_cases(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  document_type TEXT NOT NULL,
  extraction_confidence NUMERIC(4,2),
  has_text BOOLEAN DEFAULT FALSE,
  flagged_low_quality BOOLEAN DEFAULT FALSE,
  raw_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Field Chaos Extractions — structured data extracted from evidence
CREATE TABLE IF NOT EXISTS field_chaos_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES field_chaos_cases(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_value TEXT,
  confidence NUMERIC(4,2),
  source_document TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Field Chaos Conflicts — detected conflicts between documents/data
CREATE TABLE IF NOT EXISTS field_chaos_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES field_chaos_cases(id) ON DELETE CASCADE,
  conflict_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  description TEXT NOT NULL,
  source_a TEXT,
  source_b TEXT,
  resolution_required BOOLEAN DEFAULT TRUE,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Field Chaos Results — final output for each case
CREATE TABLE IF NOT EXISTS field_chaos_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES field_chaos_cases(id) ON DELETE CASCADE,
  authority_decision JSONB,
  technical_sufficiency JSONB,
  conflicts_summary JSONB,
  missing_data JSONB,
  mandatory_questions JSONB,
  recommended_actions JSONB,
  audit_trace JSONB,
  full_output JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fcc_case_id ON field_chaos_cases(case_id);
CREATE INDEX IF NOT EXISTS idx_fcc_status ON field_chaos_cases(status);
CREATE INDEX IF NOT EXISTS idx_fcc_decision_lock ON field_chaos_cases(decision_lock);
CREATE INDEX IF NOT EXISTS idx_fcd_case ON field_chaos_documents(case_id);
CREATE INDEX IF NOT EXISTS idx_fcx_case ON field_chaos_extractions(case_id);
CREATE INDEX IF NOT EXISTS idx_fcn_case ON field_chaos_conflicts(case_id);
CREATE INDEX IF NOT EXISTS idx_fcn_severity ON field_chaos_conflicts(severity);
CREATE INDEX IF NOT EXISTS idx_fcr_case ON field_chaos_results(case_id);

-- RLS Policies
ALTER TABLE field_chaos_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_chaos_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_chaos_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_chaos_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_chaos_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "field_chaos_cases_read" ON field_chaos_cases FOR SELECT USING (true);
CREATE POLICY "field_chaos_cases_write" ON field_chaos_cases FOR INSERT WITH CHECK (true);
CREATE POLICY "field_chaos_documents_read" ON field_chaos_documents FOR SELECT USING (true);
CREATE POLICY "field_chaos_documents_write" ON field_chaos_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "field_chaos_extractions_read" ON field_chaos_extractions FOR SELECT USING (true);
CREATE POLICY "field_chaos_extractions_write" ON field_chaos_extractions FOR INSERT WITH CHECK (true);
CREATE POLICY "field_chaos_conflicts_read" ON field_chaos_conflicts FOR SELECT USING (true);
CREATE POLICY "field_chaos_conflicts_write" ON field_chaos_conflicts FOR INSERT WITH CHECK (true);
CREATE POLICY "field_chaos_results_read" ON field_chaos_results FOR SELECT USING (true);
CREATE POLICY "field_chaos_results_write" ON field_chaos_results FOR INSERT WITH CHECK (true);
