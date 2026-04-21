-- ================================================================
-- DEPLOY266: Inspection Planning Proof Engine
-- ================================================================
-- Closes the loop from "what data is missing" to "exactly how to find it."
-- Takes proof breaks, missing evidence flags, and component proof chains
-- and generates a defensible, prioritized inspection workpack.
-- ================================================================

CREATE TABLE IF NOT EXISTS inspection_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES inspection_cases(id),
  session_id UUID,
  plan_version TEXT DEFAULT '1.0',
  plan_status TEXT DEFAULT 'draft',
  priority_ranking JSONB DEFAULT '[]'::jsonb,
  workpack_items JSONB DEFAULT '[]'::jsonb,
  method_selections JSONB DEFAULT '{}'::jsonb,
  access_constraints JSONB DEFAULT '[]'::jsonb,
  equipment_requirements JSONB DEFAULT '[]'::jsonb,
  personnel_requirements JSONB DEFAULT '[]'::jsonb,
  estimated_duration_hours NUMERIC,
  estimated_cost NUMERIC,
  proof_gaps_addressed JSONB DEFAULT '[]'::jsonb,
  governance_gaps_addressed JSONB DEFAULT '[]'::jsonb,
  safety_requirements JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workpack_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES inspection_plans(id),
  item_number INTEGER,
  priority TEXT DEFAULT 'MEDIUM',
  component TEXT NOT NULL,
  damage_mode TEXT,
  inspection_method TEXT NOT NULL,
  method_justification TEXT,
  coverage_requirement TEXT,
  acceptance_criteria TEXT,
  code_basis TEXT,
  proof_gap_closed TEXT,
  access_method TEXT,
  scaffolding_required BOOLEAN DEFAULT false,
  isolation_required BOOLEAN DEFAULT false,
  estimated_hours NUMERIC,
  prerequisites JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspection_plans_case ON inspection_plans(case_id);
CREATE INDEX IF NOT EXISTS idx_inspection_plans_status ON inspection_plans(plan_status);
CREATE INDEX IF NOT EXISTS idx_workpack_items_plan ON workpack_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_workpack_items_priority ON workpack_items(priority);

-- ================================================================
-- DONE
-- ================================================================
