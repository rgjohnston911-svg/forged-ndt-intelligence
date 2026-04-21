-- ================================================================
-- DEPLOY265: Tri-Model Adversarial Reasoning Engine — SQL Migration
-- ================================================================
-- Creates learning loop tables for the tri-model reasoning engine.
-- The engine itself lives in netlify/functions/tri-model-reasoning.ts.
-- These tables store reasoning sessions, learning records, hypothesis
-- tracking, and calibration scores so the system improves over time.
--
-- Run this in Supabase SQL Editor -> Click "Run and enable RLS"
-- ================================================================

-- ================================================================
-- TABLE 1: reasoning_sessions
-- Every time the tri-model pipeline runs, the full session is stored.
-- This is the primary audit trail for the adversarial reasoning engine.
-- ================================================================
CREATE TABLE IF NOT EXISTS reasoning_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id),
  session_type TEXT NOT NULL DEFAULT 'case_reasoning',
  -- Input context
  input_summary JSONB,
  material_class TEXT,
  component_type TEXT,
  industry_vertical TEXT,
  -- Model outputs (full JSON from each model)
  model_a_output JSONB,
  model_b_output JSONB,
  model_c_output JSONB,
  resolution_output JSONB,
  -- Final synthesized output
  final_output JSONB,
  governance_lock JSONB,
  -- Pipeline metadata
  pipeline_version TEXT NOT NULL DEFAULT 'tri-model-reasoning/1.0.0',
  total_duration_ms INTEGER,
  model_a_duration_ms INTEGER,
  model_b_duration_ms INTEGER,
  model_c_duration_ms INTEGER,
  resolution_duration_ms INTEGER,
  -- Adversarial quality metrics
  contradictions_found INTEGER DEFAULT 0,
  blind_spots_identified INTEGER DEFAULT 0,
  assumptions_challenged INTEGER DEFAULT 0,
  consensus_fragility_score NUMERIC(4,3),
  -- Learning feedback (filled in later by humans or outcome tracking)
  outcome_correct BOOLEAN,
  outcome_notes TEXT,
  human_override TEXT,
  human_override_reason TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reasoning_sessions_case_id ON reasoning_sessions(case_id);
CREATE INDEX IF NOT EXISTS idx_reasoning_sessions_material ON reasoning_sessions(material_class);
CREATE INDEX IF NOT EXISTS idx_reasoning_sessions_created ON reasoning_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reasoning_sessions_type ON reasoning_sessions(session_type);

-- ================================================================
-- TABLE 2: learning_records
-- Captures what the system learned from each reasoning session.
-- When a human corrects the system, or an outcome diverges from
-- prediction, a learning record is created. These feed back into
-- future reasoning via the "governed searcher" discipline.
-- ================================================================
CREATE TABLE IF NOT EXISTS learning_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES reasoning_sessions(id),
  case_id UUID REFERENCES inspection_cases(id),
  -- What was learned
  learning_type TEXT NOT NULL,
  -- Types: 'correction', 'confirmation', 'new_pattern', 'edge_case',
  --        'false_positive', 'false_negative', 'novel_mechanism',
  --        'cross_domain_analogy', 'phantom_scenario_hit'
  domain TEXT,
  material_class TEXT,
  mechanism TEXT,
  -- The actual learning content
  observation TEXT NOT NULL,
  prior_belief TEXT,
  updated_belief TEXT,
  confidence_delta NUMERIC(4,3),
  -- Evidence supporting this learning
  evidence_refs JSONB,
  -- Who/what triggered this learning
  source TEXT NOT NULL DEFAULT 'system',
  -- Sources: 'human_override', 'outcome_tracking', 'adversarial_model',
  --          'cross_case_pattern', 'calibration_check'
  source_user_id UUID,
  -- Applicability scope
  applies_to_materials TEXT[],
  applies_to_mechanisms TEXT[],
  applies_to_industries TEXT[],
  -- Status
  status TEXT NOT NULL DEFAULT 'active',
  -- Statuses: 'active', 'superseded', 'invalidated', 'under_review'
  superseded_by UUID REFERENCES learning_records(id),
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID
);

CREATE INDEX IF NOT EXISTS idx_learning_records_session ON learning_records(session_id);
CREATE INDEX IF NOT EXISTS idx_learning_records_case ON learning_records(case_id);
CREATE INDEX IF NOT EXISTS idx_learning_records_type ON learning_records(learning_type);
CREATE INDEX IF NOT EXISTS idx_learning_records_material ON learning_records(material_class);
CREATE INDEX IF NOT EXISTS idx_learning_records_status ON learning_records(status);

-- ================================================================
-- TABLE 3: hypothesis_tracking
-- The tri-model engine generates multiple competing hypotheses.
-- This table tracks each hypothesis across its lifecycle:
-- proposed -> under_test -> confirmed / rejected / superseded
-- Implements the "Multi-Hypothesis Persistence" discipline.
-- ================================================================
CREATE TABLE IF NOT EXISTS hypothesis_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES reasoning_sessions(id),
  case_id UUID REFERENCES inspection_cases(id),
  -- Hypothesis content
  hypothesis_text TEXT NOT NULL,
  hypothesis_type TEXT NOT NULL,
  -- Types: 'damage_mechanism', 'failure_mode', 'root_cause',
  --        'propagation_path', 'remaining_life', 'repair_strategy',
  --        'phantom_scenario', 'cascade_path'
  proposed_by TEXT NOT NULL,
  -- 'model_a', 'model_b', 'model_c', 'resolution', 'human'
  confidence NUMERIC(4,3) NOT NULL,
  -- Supporting and disconfirming evidence
  supporting_evidence JSONB,
  disconfirming_evidence JSONB,
  -- What would change our mind (falsifiability)
  falsification_criteria TEXT,
  -- Competing hypotheses
  competes_with UUID[],
  -- Status lifecycle
  status TEXT NOT NULL DEFAULT 'proposed',
  -- Statuses: 'proposed', 'under_test', 'confirmed', 'rejected',
  --           'superseded', 'indeterminate'
  status_reason TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  -- Physics grounding
  physics_basis TEXT,
  code_references TEXT[],
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hypothesis_case ON hypothesis_tracking(case_id);
CREATE INDEX IF NOT EXISTS idx_hypothesis_session ON hypothesis_tracking(session_id);
CREATE INDEX IF NOT EXISTS idx_hypothesis_status ON hypothesis_tracking(status);
CREATE INDEX IF NOT EXISTS idx_hypothesis_type ON hypothesis_tracking(hypothesis_type);

-- ================================================================
-- TABLE 4: calibration_scores
-- Tracks the system's calibration over time. When the system says
-- "80% confidence", does the actual outcome match 80% of the time?
-- Implements the "Uncertainty Discipline" and prevents both
-- overconfidence and underconfidence.
-- ================================================================
CREATE TABLE IF NOT EXISTS calibration_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- What was calibrated
  calibration_type TEXT NOT NULL,
  -- Types: 'overall', 'by_material', 'by_mechanism', 'by_industry',
  --        'by_model', 'by_confidence_band'
  dimension_key TEXT NOT NULL,
  -- e.g., 'carbon_steel', 'fatigue', 'aerospace', 'model_a', '0.7-0.8'
  -- Stats
  total_predictions INTEGER NOT NULL DEFAULT 0,
  correct_predictions INTEGER NOT NULL DEFAULT 0,
  mean_predicted_confidence NUMERIC(4,3),
  actual_success_rate NUMERIC(4,3),
  calibration_error NUMERIC(4,3),
  -- calibration_error = abs(mean_predicted_confidence - actual_success_rate)
  -- Perfect calibration = 0.000
  brier_score NUMERIC(6,4),
  -- Time window
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  -- Trend (compared to previous window)
  previous_calibration_error NUMERIC(4,3),
  trend TEXT,
  -- 'improving', 'stable', 'degrading'
  -- Timestamps
  computed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calibration_type ON calibration_scores(calibration_type);
CREATE INDEX IF NOT EXISTS idx_calibration_dimension ON calibration_scores(dimension_key);
CREATE INDEX IF NOT EXISTS idx_calibration_computed ON calibration_scores(computed_at DESC);

-- ================================================================
-- TABLE 5: adversarial_challenges
-- When Model C (adversarial) identifies a flaw in Model A or B's
-- reasoning, that challenge is logged here. This builds a searchable
-- library of common reasoning failures and blind spots.
-- ================================================================
CREATE TABLE IF NOT EXISTS adversarial_challenges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES reasoning_sessions(id),
  case_id UUID REFERENCES inspection_cases(id),
  -- Challenge details
  challenged_model TEXT NOT NULL,
  -- 'model_a', 'model_b', 'both'
  challenge_type TEXT NOT NULL,
  -- Types: 'assumption_exposure', 'missing_mechanism', 'confidence_inflation',
  --        'evidence_gap', 'code_misapplication', 'cascade_blindness',
  --        'temporal_blindness', 'klein_bottle_violation', 'phantom_scenario',
  --        'inference_from_absence'
  challenge_description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  -- 'low', 'medium', 'high', 'critical'
  -- Resolution
  resolution_accepted BOOLEAN,
  resolution_description TEXT,
  impact_on_output TEXT,
  -- Pattern matching (for future reference)
  material_class TEXT,
  mechanism TEXT,
  industry TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adversarial_session ON adversarial_challenges(session_id);
CREATE INDEX IF NOT EXISTS idx_adversarial_type ON adversarial_challenges(challenge_type);
CREATE INDEX IF NOT EXISTS idx_adversarial_severity ON adversarial_challenges(severity);

-- ================================================================
-- Enable RLS on all tables
-- ================================================================
ALTER TABLE reasoning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE hypothesis_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibration_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE adversarial_challenges ENABLE ROW LEVEL SECURITY;

-- Service role policies (full access for backend functions)
CREATE POLICY "srv_reasoning_sessions" ON reasoning_sessions
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "srv_learning_records" ON learning_records
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "srv_hypothesis_tracking" ON hypothesis_tracking
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "srv_calibration_scores" ON calibration_scores
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "srv_adversarial_challenges" ON adversarial_challenges
  FOR ALL USING (true) WITH CHECK (true);

-- ================================================================
-- DONE. Five tables created:
--   1. reasoning_sessions — full pipeline audit trail
--   2. learning_records — what the system learned over time
--   3. hypothesis_tracking — competing hypotheses lifecycle
--   4. calibration_scores — confidence calibration metrics
--   5. adversarial_challenges — adversarial attack library
-- ================================================================
