-- ================================================================
-- DEPLOY270: Live Code Authority Engine
-- ================================================================
-- Hardcoded knowledge of current standards editions, supersession
-- history, and applicability rules. Eliminates "edition TBD" failures
-- in the governance lock.
-- ================================================================

CREATE TABLE IF NOT EXISTS code_authority_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_body TEXT NOT NULL,
  standard_designation TEXT NOT NULL,
  current_edition TEXT NOT NULL,
  current_year INTEGER NOT NULL,
  previous_edition TEXT,
  previous_year INTEGER,
  superseded_by TEXT,
  title TEXT,
  scope TEXT,
  applicable_domains JSONB DEFAULT '[]'::jsonb,
  applicable_materials JSONB DEFAULT '[]'::jsonb,
  applicable_damage_modes JSONB DEFAULT '[]'::jsonb,
  key_requirements JSONB DEFAULT '[]'::jsonb,
  critical_thresholds JSONB DEFAULT '{}'::jsonb,
  withdrawal_date DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS code_authority_lookups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES inspection_cases(id),
  query_context TEXT,
  standard_requested TEXT,
  standard_resolved TEXT,
  edition_resolved TEXT,
  resolution_status TEXT DEFAULT 'RESOLVED',
  resolution_notes TEXT,
  applicability_confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_code_authority_body ON code_authority_registry(standard_body);
CREATE INDEX IF NOT EXISTS idx_code_authority_designation ON code_authority_registry(standard_designation);
CREATE INDEX IF NOT EXISTS idx_code_authority_active ON code_authority_registry(is_active);
CREATE INDEX IF NOT EXISTS idx_code_lookups_case ON code_authority_lookups(case_id);

-- ================================================================
-- DONE
-- ================================================================
