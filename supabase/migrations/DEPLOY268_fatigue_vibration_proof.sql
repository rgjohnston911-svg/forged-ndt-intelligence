-- ================================================================
-- DEPLOY268: Fatigue & Vibration Proof Engine
-- ================================================================
-- Dedicated engine for cyclic loading assessment.
-- S-N curves, fatigue life estimation, VIV assessment.
-- BS 7608 / DNV-RP-C203 / DNV-RP-F105 logic.
-- ================================================================

CREATE TABLE IF NOT EXISTS fatigue_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES inspection_cases(id),
  component TEXT NOT NULL,
  material TEXT,
  joint_classification TEXT,
  loading_type TEXT,
  stress_range_mpa NUMERIC,
  stress_ratio NUMERIC,
  cycle_count NUMERIC,
  design_life_years NUMERIC,
  consumed_life_fraction NUMERIC,
  remaining_life_years NUMERIC,
  sn_curve_used TEXT,
  sn_curve_basis TEXT,
  environment_factor NUMERIC DEFAULT 1.0,
  thickness_correction NUMERIC DEFAULT 1.0,
  scf NUMERIC DEFAULT 1.0,
  cumulative_damage NUMERIC,
  miner_sum NUMERIC,
  fatigue_status TEXT DEFAULT 'UNASSESSED',
  proof_status TEXT DEFAULT 'UNPROVEN',
  code_reference TEXT,
  calculation_method TEXT,
  input_quality JSONB DEFAULT '{}'::jsonb,
  assumptions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vibration_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES inspection_cases(id),
  component TEXT NOT NULL,
  vibration_type TEXT,
  frequency_hz NUMERIC,
  amplitude_mm NUMERIC,
  velocity_mms NUMERIC,
  acceleration_g NUMERIC,
  natural_frequency_hz NUMERIC,
  reduced_velocity NUMERIC,
  viv_susceptibility TEXT,
  span_length_m NUMERIC,
  span_gap_m NUMERIC,
  current_velocity_ms NUMERIC,
  allowable_span_m NUMERIC,
  screening_result TEXT,
  fatigue_from_viv_years NUMERIC,
  measurement_source TEXT,
  baseline_available BOOLEAN DEFAULT false,
  baseline_date DATE,
  change_from_baseline TEXT,
  proof_status TEXT DEFAULT 'UNPROVEN',
  code_reference TEXT,
  input_quality JSONB DEFAULT '{}'::jsonb,
  assumptions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fatigue_case ON fatigue_assessments(case_id);
CREATE INDEX IF NOT EXISTS idx_fatigue_status ON fatigue_assessments(fatigue_status);
CREATE INDEX IF NOT EXISTS idx_vibration_case ON vibration_assessments(case_id);
CREATE INDEX IF NOT EXISTS idx_vibration_type ON vibration_assessments(vibration_type);

-- ================================================================
-- DONE
-- ================================================================
