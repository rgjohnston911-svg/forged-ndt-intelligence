-- DEPLOY215: Case Similarity Retrieval Layer (foundation)
-- Adds pgvector + embedding column + similarity RPC.
-- Run this in Supabase SQL Editor BEFORE deploying the DEPLOY215 code.
--
-- Rationale: every locked case becomes a retrievable neighbor for future
-- cases. The platform compounds knowledge without touching model weights.

-- 1. Enable pgvector (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding + summary columns to inspection_cases
ALTER TABLE inspection_cases
  ADD COLUMN IF NOT EXISTS case_summary TEXT,
  ADD COLUMN IF NOT EXISTS case_embedding vector(1536),
  ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ;

-- 3. ivfflat index for cosine similarity (lists=100 is fine up to ~1M rows)
-- Note: ivfflat needs at least some rows before it's useful; safe to create empty.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_inspection_cases_embedding') THEN
    EXECUTE 'CREATE INDEX idx_inspection_cases_embedding ON inspection_cases
             USING ivfflat (case_embedding vector_cosine_ops) WITH (lists = 100)';
  END IF;
END $$;

-- 4. RPC: find_similar_cases
-- Returns top-k nearest neighbors by cosine distance, excluding the query case itself
-- and restricted to the same org as the caller's case.
CREATE OR REPLACE FUNCTION find_similar_cases(
  query_embedding vector(1536),
  query_org_id UUID,
  exclude_case_id UUID,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  case_number TEXT,
  title TEXT,
  component_name TEXT,
  material_class TEXT,
  method TEXT,
  final_disposition TEXT,
  final_confidence NUMERIC,
  case_summary TEXT,
  similarity NUMERIC,
  authority_locked BOOLEAN,
  authority_locked_at TIMESTAMPTZ
)
LANGUAGE SQL STABLE AS $$
  SELECT
    c.id,
    c.case_number,
    c.title,
    c.component_name,
    c.material_class,
    c.method,
    c.final_disposition,
    c.final_confidence,
    c.case_summary,
    (1 - (c.case_embedding <=> query_embedding))::NUMERIC AS similarity,
    c.authority_locked,
    c.authority_locked_at
  FROM inspection_cases c
  WHERE c.case_embedding IS NOT NULL
    AND c.id <> exclude_case_id
    AND c.org_id = query_org_id
  ORDER BY c.case_embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 5. Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'inspection_cases'
  AND column_name IN ('case_summary', 'case_embedding', 'embedded_at')
ORDER BY ordinal_position;
