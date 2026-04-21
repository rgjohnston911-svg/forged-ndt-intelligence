-- ================================================================
-- DEPLOY269: Multi-Asset Cascade Engine
-- ================================================================
-- Models how failure in one component propagates to others.
-- Maps interaction effects across connected asset systems.
-- Free span -> VIV -> riser fatigue -> topsides vibration -> process upset.
-- ================================================================

CREATE TABLE IF NOT EXISTS asset_graphs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES inspection_cases(id),
  graph_name TEXT,
  graph_type TEXT DEFAULT 'production_system',
  nodes JSONB DEFAULT '[]'::jsonb,
  edges JSONB DEFAULT '[]'::jsonb,
  cascade_paths JSONB DEFAULT '[]'::jsonb,
  isolation_boundaries JSONB DEFAULT '[]'::jsonb,
  single_points_of_failure JSONB DEFAULT '[]'::jsonb,
  common_cause_groups JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cascade_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID REFERENCES asset_graphs(id),
  initiating_event TEXT NOT NULL,
  initiating_component TEXT NOT NULL,
  propagation_path JSONB DEFAULT '[]'::jsonb,
  affected_components JSONB DEFAULT '[]'::jsonb,
  cascade_depth INTEGER DEFAULT 0,
  final_consequence TEXT,
  consequence_severity TEXT DEFAULT 'UNKNOWN',
  probability_qualitative TEXT DEFAULT 'UNKNOWN',
  barriers_in_path JSONB DEFAULT '[]'::jsonb,
  barrier_effectiveness JSONB DEFAULT '{}'::jsonb,
  time_to_propagate TEXT,
  detection_opportunity TEXT,
  intervention_point TEXT,
  proof_status TEXT DEFAULT 'UNPROVEN',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asset_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID REFERENCES asset_graphs(id),
  source_component TEXT NOT NULL,
  target_component TEXT NOT NULL,
  interaction_type TEXT NOT NULL,
  coupling_mechanism TEXT,
  coupling_strength TEXT DEFAULT 'UNKNOWN',
  directionality TEXT DEFAULT 'unidirectional',
  evidence_basis TEXT,
  proof_status TEXT DEFAULT 'UNPROVEN',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_graphs_case ON asset_graphs(case_id);
CREATE INDEX IF NOT EXISTS idx_cascade_scenarios_graph ON cascade_scenarios(graph_id);
CREATE INDEX IF NOT EXISTS idx_cascade_severity ON cascade_scenarios(consequence_severity);
CREATE INDEX IF NOT EXISTS idx_asset_interactions_graph ON asset_interactions(graph_id);

-- ================================================================
-- DONE
-- ================================================================
