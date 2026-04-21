-- DEPLOY216: Decision Core spine
-- Adds the columns required for signed, hash-verifiable audit bundles,
-- OOD-aware confidence, and physics sufficiency coverage.
--
-- This is the structural move. Every future engine (planner, FFS,
-- multi-case reasoning) reads from and writes to these columns via the
-- decision-core.ts function. The spine is the moat.
--
-- Run this in Supabase SQL Editor BEFORE deploying the DEPLOY216 code.

ALTER TABLE inspection_cases
  ADD COLUMN IF NOT EXISTS decision_bundle JSONB,
  ADD COLUMN IF NOT EXISTS decision_bundle_hash TEXT,
  ADD COLUMN IF NOT EXISTS decision_bundle_version TEXT,
  ADD COLUMN IF NOT EXISTS decision_bundle_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ood_score NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS ood_flag TEXT,
  ADD COLUMN IF NOT EXISTS physics_coverage JSONB;

-- OOD flag constraint: in_distribution | marginal | out_of_distribution | unknown
-- (unknown = no neighbors available to compare against yet)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'inspection_cases_ood_flag_check'
  ) THEN
    ALTER TABLE inspection_cases
      ADD CONSTRAINT inspection_cases_ood_flag_check
      CHECK (ood_flag IS NULL OR ood_flag IN ('in_distribution', 'marginal', 'out_of_distribution', 'unknown'));
  END IF;
END $$;

-- Index for audit lookups by hash (regulator-mode verification)
CREATE INDEX IF NOT EXISTS idx_inspection_cases_bundle_hash
  ON inspection_cases(decision_bundle_hash)
  WHERE decision_bundle_hash IS NOT NULL;

-- Index for OOD flagged cases (inspector review queue)
CREATE INDEX IF NOT EXISTS idx_inspection_cases_ood_flag
  ON inspection_cases(ood_flag)
  WHERE ood_flag IN ('marginal', 'out_of_distribution');

-- Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'inspection_cases'
  AND column_name IN (
    'decision_bundle', 'decision_bundle_hash', 'decision_bundle_version',
    'decision_bundle_signed_at', 'ood_score', 'ood_flag', 'physics_coverage'
  )
ORDER BY ordinal_position;
