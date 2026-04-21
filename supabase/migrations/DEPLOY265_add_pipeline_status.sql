-- ================================================================
-- DEPLOY265 PATCH: Add pipeline status columns to reasoning_sessions
-- ================================================================
-- Supports async background function architecture.
-- The main function creates a session with status "processing",
-- the background function updates it as it progresses.
-- ================================================================

ALTER TABLE reasoning_sessions ADD COLUMN IF NOT EXISTS pipeline_status TEXT DEFAULT 'processing';
ALTER TABLE reasoning_sessions ADD COLUMN IF NOT EXISTS pipeline_step TEXT DEFAULT 'queued';
ALTER TABLE reasoning_sessions ADD COLUMN IF NOT EXISTS pipeline_error TEXT;
ALTER TABLE reasoning_sessions ADD COLUMN IF NOT EXISTS final_output JSONB;

CREATE INDEX IF NOT EXISTS idx_reasoning_sessions_status ON reasoning_sessions(pipeline_status);

-- ================================================================
-- DONE. Added: pipeline_status, pipeline_step, pipeline_error, final_output
-- ================================================================
