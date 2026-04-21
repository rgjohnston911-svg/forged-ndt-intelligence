-- ============================================================
-- DEPLOY227 — Case Search & Analytics Engine
-- Run in Supabase SQL Editor
-- ============================================================

-- Add ALL searchable columns to inspection_cases if they don't exist

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inspection_cases' AND column_name = 'disposition') THEN
    ALTER TABLE inspection_cases ADD COLUMN disposition text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inspection_cases' AND column_name = 'state') THEN
    ALTER TABLE inspection_cases ADD COLUMN state text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inspection_cases' AND column_name = 'confidence') THEN
    ALTER TABLE inspection_cases ADD COLUMN confidence numeric;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inspection_cases' AND column_name = 'status') THEN
    ALTER TABLE inspection_cases ADD COLUMN status text DEFAULT 'open';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inspection_cases' AND column_name = 'material') THEN
    ALTER TABLE inspection_cases ADD COLUMN material text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inspection_cases' AND column_name = 'material_family') THEN
    ALTER TABLE inspection_cases ADD COLUMN material_family text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inspection_cases' AND column_name = 'asset_type') THEN
    ALTER TABLE inspection_cases ADD COLUMN asset_type text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inspection_cases' AND column_name = 'component_name') THEN
    ALTER TABLE inspection_cases ADD COLUMN component_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inspection_cases' AND column_name = 'inspection_method') THEN
    ALTER TABLE inspection_cases ADD COLUMN inspection_method text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inspection_cases' AND column_name = 'damage_type') THEN
    ALTER TABLE inspection_cases ADD COLUMN damage_type text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inspection_cases' AND column_name = 'severity') THEN
    ALTER TABLE inspection_cases ADD COLUMN severity text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inspection_cases' AND column_name = 'notes') THEN
    ALTER TABLE inspection_cases ADD COLUMN notes text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inspection_cases' AND column_name = 'case_number') THEN
    ALTER TABLE inspection_cases ADD COLUMN case_number text;
  END IF;
END $$;

-- ============================================================
-- Performance indexes for search queries
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_cases_created_at ON inspection_cases (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_status ON inspection_cases (status);
CREATE INDEX IF NOT EXISTS idx_cases_disposition ON inspection_cases (disposition);
CREATE INDEX IF NOT EXISTS idx_cases_state ON inspection_cases (state);
CREATE INDEX IF NOT EXISTS idx_cases_material ON inspection_cases (material);
CREATE INDEX IF NOT EXISTS idx_cases_material_family ON inspection_cases (material_family);
CREATE INDEX IF NOT EXISTS idx_cases_asset_type ON inspection_cases (asset_type);
CREATE INDEX IF NOT EXISTS idx_cases_inspection_method ON inspection_cases (inspection_method);
CREATE INDEX IF NOT EXISTS idx_cases_damage_type ON inspection_cases (damage_type);
CREATE INDEX IF NOT EXISTS idx_cases_severity ON inspection_cases (severity);
CREATE INDEX IF NOT EXISTS idx_cases_confidence ON inspection_cases (confidence);
CREATE INDEX IF NOT EXISTS idx_cases_override ON inspection_cases (inspector_override_active);
CREATE INDEX IF NOT EXISTS idx_cases_status_date ON inspection_cases (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_method_material ON inspection_cases (inspection_method, material);

-- ============================================================
-- DONE. All columns and indexes ready for DEPLOY227.
-- ============================================================
