-- ================================================================
-- DEPLOY267: Corrosion Loop Engine
-- ================================================================
-- Ties corrosion mechanism identification to rate prediction
-- to remaining wall to inspection interval in a single traceable loop.
-- API 579 / DNV-RP-F101 / API 571 logic.
-- ================================================================

CREATE TABLE IF NOT EXISTS corrosion_loops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES inspection_cases(id),
  component TEXT NOT NULL,
  material TEXT,
  mechanism TEXT NOT NULL,
  mechanism_confidence TEXT DEFAULT 'INFERRED',
  environment TEXT,
  temperature_c NUMERIC,
  pressure_bar NUMERIC,
  ph NUMERIC,
  co2_partial_pressure NUMERIC,
  h2s_partial_pressure NUMERIC,
  chloride_ppm NUMERIC,
  flow_velocity_ms NUMERIC,
  nominal_wall_mm NUMERIC,
  measured_wall_mm NUMERIC,
  minimum_required_wall_mm NUMERIC,
  corrosion_rate_mmpy NUMERIC,
  rate_basis TEXT,
  rate_confidence TEXT DEFAULT 'LOW',
  remaining_life_years NUMERIC,
  remaining_life_confidence TEXT DEFAULT 'LOW',
  next_inspection_date DATE,
  inspection_interval_months INTEGER,
  interval_basis TEXT,
  calculation_method TEXT,
  code_reference TEXT,
  input_quality JSONB DEFAULT '{}'::jsonb,
  assumptions JSONB DEFAULT '[]'::jsonb,
  proof_status TEXT DEFAULT 'UNPROVEN',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS corrosion_rate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loop_id UUID REFERENCES corrosion_loops(id),
  measurement_date DATE,
  wall_thickness_mm NUMERIC,
  location_id TEXT,
  method TEXT,
  confidence TEXT DEFAULT 'MEASURED',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_corrosion_loops_case ON corrosion_loops(case_id);
CREATE INDEX IF NOT EXISTS idx_corrosion_loops_mechanism ON corrosion_loops(mechanism);
CREATE INDEX IF NOT EXISTS idx_corrosion_loops_proof ON corrosion_loops(proof_status);
CREATE INDEX IF NOT EXISTS idx_corrosion_rate_history_loop ON corrosion_rate_history(loop_id);

-- ================================================================
-- DONE
-- ================================================================
