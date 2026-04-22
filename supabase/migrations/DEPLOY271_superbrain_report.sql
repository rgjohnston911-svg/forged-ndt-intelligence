-- DEPLOY271: Superbrain Report Query Engine
-- Creates tables for AI-generated reports from Superbrain v6 sessions.
-- Run in Supabase Dashboard → SQL Editor

-- Reports table — stores every AI-generated report
CREATE TABLE IF NOT EXISTS superbrain_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  query TEXT,
  preset TEXT,
  report_title TEXT NOT NULL DEFAULT 'Untitled Report',
  report_type TEXT NOT NULL DEFAULT 'custom',
  report_content JSONB,
  raw_response TEXT,
  claude_model TEXT,
  claude_duration_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by session
CREATE INDEX IF NOT EXISTS idx_superbrain_reports_session ON superbrain_reports(session_id);

-- Index for listing reports by date
CREATE INDEX IF NOT EXISTS idx_superbrain_reports_created ON superbrain_reports(created_at DESC);

-- Index for filtering by report type
CREATE INDEX IF NOT EXISTS idx_superbrain_reports_type ON superbrain_reports(report_type);

-- Enable RLS
ALTER TABLE superbrain_reports ENABLE ROW LEVEL SECURITY;

-- Allow all access (platform uses service role key)
CREATE POLICY "superbrain_reports_all" ON superbrain_reports FOR ALL USING (true) WITH CHECK (true);
