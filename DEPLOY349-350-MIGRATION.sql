-- ================================================================
-- DEPLOY349-350 SQL MIGRATION
-- Diffusion Embedding Retrieval + Multimodal Fusion Engine
-- Run in Supabase SQL Editor
-- ================================================================

-- ── TABLE 1: embedding_retrieval_results ─────────────────────────
DROP TABLE IF EXISTS embedding_retrieval_results CASCADE;
CREATE TABLE IF NOT EXISTS embedding_retrieval_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  domain TEXT,
  observation_text TEXT,
  top_mechanism TEXT,
  top_similarity NUMERIC(6,4),
  mechanisms_matched INTEGER,
  evidence_dimensions_filled INTEGER,
  action TEXT,
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_emb_case ON embedding_retrieval_results(case_id);
CREATE INDEX IF NOT EXISTS idx_emb_domain ON embedding_retrieval_results(domain);
CREATE INDEX IF NOT EXISTS idx_emb_mechanism ON embedding_retrieval_results(top_mechanism);

-- ── TABLE 2: multimodal_fusion_results ───────────────────────────
DROP TABLE IF EXISTS multimodal_fusion_results CASCADE;
CREATE TABLE IF NOT EXISTS multimodal_fusion_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  asset_id TEXT,
  modalities_used TEXT[],
  modality_count INTEGER,
  fusion_strategy TEXT,
  overall_confidence NUMERIC(6,4),
  anomaly_count INTEGER,
  corroboration_count INTEGER,
  action TEXT,
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mmf_case ON multimodal_fusion_results(case_id);
CREATE INDEX IF NOT EXISTS idx_mmf_asset ON multimodal_fusion_results(asset_id);
CREATE INDEX IF NOT EXISTS idx_mmf_strategy ON multimodal_fusion_results(fusion_strategy);

-- ── ENABLE RLS ────────────────────────────────────────────────────
ALTER TABLE embedding_retrieval_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE multimodal_fusion_results ENABLE ROW LEVEL SECURITY;

-- ── SERVICE ROLE POLICIES ─────────────────────────────────────────
CREATE POLICY "sr_emb" ON embedding_retrieval_results FOR ALL TO service_role USING (true);
CREATE POLICY "sr_mmf" ON multimodal_fusion_results FOR ALL TO service_role USING (true);
