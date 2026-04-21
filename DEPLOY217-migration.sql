-- DEPLOY217: Planner-Agent action plan
-- Stores the prioritized "what to do next" plan generated from the
-- decision-spine bundle. Separate column so re-planning does not
-- invalidate the bundle integrity hash.
--
-- Run this in Supabase SQL Editor BEFORE deploying the DEPLOY217 code.

ALTER TABLE inspection_cases
  ADD COLUMN IF NOT EXISTS action_plan JSONB,
  ADD COLUMN IF NOT EXISTS action_plan_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS action_plan_status TEXT;

-- action_plan_status: ready_to_lock | actions_required | escalate | unknown
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'inspection_cases_action_plan_status_check'
  ) THEN
    ALTER TABLE inspection_cases
      ADD CONSTRAINT inspection_cases_action_plan_status_check
      CHECK (action_plan_status IS NULL OR action_plan_status IN
        ('ready_to_lock', 'actions_required', 'escalate', 'unknown'));
  END IF;
END $$;

-- Index for review-queue surfacing
CREATE INDEX IF NOT EXISTS idx_inspection_cases_action_status
  ON inspection_cases(action_plan_status)
  WHERE action_plan_status IN ('actions_required', 'escalate');

-- Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'inspection_cases'
  AND column_name IN ('action_plan', 'action_plan_generated_at', 'action_plan_status')
ORDER BY ordinal_position;
