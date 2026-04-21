-- ============================================================
-- DEPLOY228 — Escalation Workflow Engine
-- Run in Supabase SQL Editor
-- ============================================================

-- Escalation queue: tracks every escalation from submission to resolution
CREATE TABLE IF NOT EXISTS escalation_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES inspection_cases(id),
  adjudication_id uuid REFERENCES inspector_adjudications(id),

  -- Who escalated
  escalated_by text NOT NULL,
  escalated_by_email text,
  escalated_by_name text,
  escalated_at timestamptz DEFAULT now(),

  -- Priority and routing
  priority text NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine', 'elevated', 'urgent', 'emergency')),
  assigned_to text,
  assigned_to_email text,
  assigned_to_name text,
  assigned_at timestamptz,

  -- Deadline tracking
  deadline timestamptz,
  deadline_source text, -- 'auto' or 'manual'

  -- Status lifecycle: open -> assigned -> in_review -> resolved / expired
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'in_review', 'resolved', 'expired', 'cancelled')),

  -- Resolution
  resolution_type text CHECK (resolution_type IN ('upheld', 'overturned', 'modified', 'deferred')),
  resolution_decision text,
  resolution_rationale text,
  resolved_by text,
  resolved_by_email text,
  resolved_by_name text,
  resolved_at timestamptz,

  -- Context from the original escalation
  escalation_reason text,
  system_state_snapshot jsonb,

  -- Metadata
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for escalation queue
CREATE INDEX IF NOT EXISTS idx_escalation_case_id ON escalation_queue (case_id);
CREATE INDEX IF NOT EXISTS idx_escalation_status ON escalation_queue (status);
CREATE INDEX IF NOT EXISTS idx_escalation_priority ON escalation_queue (priority);
CREATE INDEX IF NOT EXISTS idx_escalation_assigned_to ON escalation_queue (assigned_to);
CREATE INDEX IF NOT EXISTS idx_escalation_deadline ON escalation_queue (deadline);
CREATE INDEX IF NOT EXISTS idx_escalation_created_at ON escalation_queue (created_at DESC);

-- Composite index for queue views
CREATE INDEX IF NOT EXISTS idx_escalation_status_priority ON escalation_queue (status, priority, created_at DESC);

-- Add escalation tracking columns to inspection_cases
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inspection_cases' AND column_name = 'escalation_count') THEN
    ALTER TABLE inspection_cases ADD COLUMN escalation_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inspection_cases' AND column_name = 'active_escalation_id') THEN
    ALTER TABLE inspection_cases ADD COLUMN active_escalation_id uuid;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inspection_cases' AND column_name = 'escalation_status') THEN
    ALTER TABLE inspection_cases ADD COLUMN escalation_status text;
  END IF;
END $$;

-- RLS: authenticated users can read all, insert, and update escalations
ALTER TABLE escalation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "escalation_select" ON escalation_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "escalation_insert" ON escalation_queue FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "escalation_update" ON escalation_queue FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Service role bypass
CREATE POLICY "escalation_service_all" ON escalation_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- Auto-deadline rules based on priority
-- routine = 7 days, elevated = 3 days, urgent = 24 hours, emergency = 4 hours
-- ============================================================

-- ============================================================
-- DONE. Escalation queue ready for DEPLOY228.
-- ============================================================
