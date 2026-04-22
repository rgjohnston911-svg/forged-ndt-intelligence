-- DEPLOY271b: Add report_status and updated_at columns for async background pattern
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE superbrain_reports ADD COLUMN IF NOT EXISTS report_status TEXT NOT NULL DEFAULT 'processing';
ALTER TABLE superbrain_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Index for polling by status
CREATE INDEX IF NOT EXISTS idx_superbrain_reports_status ON superbrain_reports(report_status);
