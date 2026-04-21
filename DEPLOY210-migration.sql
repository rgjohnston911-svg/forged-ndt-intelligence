-- DEPLOY210: thickness_readings table
-- Stores parsed CSV thickness grids (UT corrosion maps, CML readings, etc.)
-- Run this in Supabase SQL Editor BEFORE deploying the DEPLOY210 code.

CREATE TABLE IF NOT EXISTS thickness_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES inspection_cases(id) ON DELETE CASCADE,
  evidence_id UUID REFERENCES evidence(id) ON DELETE SET NULL,
  grid_row TEXT,
  grid_col TEXT,
  location_ref TEXT,
  thickness_in NUMERIC(10, 4),
  thickness_mm NUMERIC(10, 3),
  nominal_in NUMERIC(10, 4),
  is_min_of_grid BOOLEAN DEFAULT FALSE,
  source_format TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_thickness_readings_case ON thickness_readings(case_id);
CREATE INDEX IF NOT EXISTS idx_thickness_readings_evidence ON thickness_readings(evidence_id);

-- RLS: users can read/write readings for cases in their org
ALTER TABLE thickness_readings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS thickness_readings_read ON thickness_readings;
CREATE POLICY thickness_readings_read ON thickness_readings FOR SELECT
  USING (
    case_id IN (
      SELECT id FROM inspection_cases
      WHERE org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS thickness_readings_write ON thickness_readings;
CREATE POLICY thickness_readings_write ON thickness_readings FOR INSERT
  WITH CHECK (
    case_id IN (
      SELECT id FROM inspection_cases
      WHERE org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'thickness_readings' ORDER BY ordinal_position;
