-- DEPLOY208: Add nde_method column to evidence table
-- Run this in Supabase SQL Editor before deploying DEPLOY208

ALTER TABLE evidence ADD COLUMN IF NOT EXISTS nde_method TEXT DEFAULT NULL;

-- Optional: Add index for filtering evidence by method
CREATE INDEX IF NOT EXISTS idx_evidence_nde_method ON evidence(nde_method);

-- Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'evidence' AND column_name = 'nde_method';
