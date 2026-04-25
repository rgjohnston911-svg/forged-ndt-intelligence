-- ================================================================
-- DEPLOY315-316 SQL MIGRATION
-- Conceptual Reasoning Brain + Closed-Loop Self-Learning Brain
-- Run in Supabase SQL Editor
-- ================================================================

-- ── TABLE 1: concept_registry ─────────────────────────────────
-- Master registry of engineering/physics concepts referenced in reasoning
CREATE TABLE IF NOT EXISTS concept_registry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  concept_name TEXT NOT NULL,
  concept_category TEXT,
  description TEXT,
  related_industries JSONB,
  related_mechanisms JSONB,
  required_evidence JSONB,
  physics_models JSONB,
  code_relevance JSONB,
  validation_score NUMERIC(4,3) DEFAULT 0,
  concept_version TEXT DEFAULT 'v1.0.0',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_concept_registry_name ON concept_registry(concept_name);
CREATE INDEX IF NOT EXISTS idx_concept_registry_status ON concept_registry(status);

-- ── TABLE 2: case_concepts ───────────────────────────────────
-- Links cases to applicable concepts with confidence scoring
CREATE TABLE IF NOT EXISTS case_concepts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES inspection_cases(id) ON DELETE CASCADE,
  concept_id UUID NOT NULL REFERENCES concept_registry(id) ON DELETE CASCADE,
  match_score NUMERIC(4,3),
  confidence NUMERIC(4,3),
  status TEXT DEFAULT 'matched',
  evidence_links JSONB,
  proof_id UUID REFERENCES decision_proofs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_concepts_case_id ON case_concepts(case_id);
CREATE INDEX IF NOT EXISTS idx_case_concepts_concept_id ON case_concepts(concept_id);
CREATE INDEX IF NOT EXISTS idx_case_concepts_proof_id ON case_concepts(proof_id);

-- ── TABLE 3: hypothesis_trees ────────────────────────────────
-- Structures multi-level hypotheses and supporting evidence trees
CREATE TABLE IF NOT EXISTS hypothesis_trees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES inspection_cases(id) ON DELETE CASCADE,
  hypothesis_name TEXT NOT NULL,
  hypothesis_description TEXT,
  probability NUMERIC(4,3),
  supporting_evidence JSONB,
  conflicting_evidence JSONB,
  required_next_evidence JSONB,
  likely_trajectory TEXT,
  proof_requirements JSONB,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hypothesis_trees_case_id ON hypothesis_trees(case_id);
CREATE INDEX IF NOT EXISTS idx_hypothesis_trees_status ON hypothesis_trees(status);

-- ── TABLE 4: causal_chains ──────────────────────────────────
-- Models cause-effect relationships and intervention points
CREATE TABLE IF NOT EXISTS causal_chains (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES inspection_cases(id) ON DELETE CASCADE,
  initiating_event TEXT NOT NULL,
  enabling_conditions JSONB,
  active_mechanisms JSONB,
  accelerating_factors JSONB,
  downstream_consequences JSONB,
  prevention_options JSONB,
  confidence NUMERIC(4,3),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_causal_chains_case_id ON causal_chains(case_id);

-- ── TABLE 5: cross_domain_analogies ──────────────────────────
-- Stores analogical reasoning across domains
CREATE TABLE IF NOT EXISTS cross_domain_analogies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES inspection_cases(id) ON DELETE CASCADE,
  source_domain TEXT,
  analogous_domain TEXT,
  analogous_pattern TEXT,
  similarity_score NUMERIC(4,3),
  transferable_insight TEXT,
  limitation TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cross_domain_analogies_case_id ON cross_domain_analogies(case_id);

-- ── TABLE 6: novelty_flags ──────────────────────────────────
-- Flags unusual or novel case characteristics requiring escalation
CREATE TABLE IF NOT EXISTS novelty_flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES inspection_cases(id) ON DELETE CASCADE,
  novelty_score NUMERIC(4,3),
  novelty_reason TEXT,
  unusual_features JSONB,
  recommended_escalation TEXT,
  expert_review_required BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_novelty_flags_case_id ON novelty_flags(case_id);
CREATE INDEX IF NOT EXISTS idx_novelty_flags_escalation ON novelty_flags(expert_review_required);

-- ── TABLE 7: belief_updates ─────────────────────────────────
-- Bayesian belief update records for hypothesis evolution
CREATE TABLE IF NOT EXISTS belief_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES inspection_cases(id) ON DELETE CASCADE,
  hypothesis_id UUID REFERENCES hypothesis_trees(id) ON DELETE SET NULL,
  prior_probability NUMERIC(4,3),
  new_evidence JSONB,
  posterior_probability NUMERIC(4,3),
  confidence_change NUMERIC(4,3),
  update_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_belief_updates_case_id ON belief_updates(case_id);
CREATE INDEX IF NOT EXISTS idx_belief_updates_hypothesis_id ON belief_updates(hypothesis_id);

-- ── TABLE 8: failure_trajectories ───────────────────────────
-- Predicts degradation paths and intervention windows
CREATE TABLE IF NOT EXISTS failure_trajectories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES inspection_cases(id) ON DELETE CASCADE,
  current_state TEXT,
  trajectory_state TEXT,
  likely_next_failure_mode TEXT,
  time_to_escalation_band TEXT,
  intervention_window TEXT,
  consequence_if_ignored TEXT,
  confidence NUMERIC(4,3),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_failure_trajectories_case_id ON failure_trajectories(case_id);

-- ── TABLE 9: predictive_data_sources ────────────────────────
-- Tracks external data sources used for prediction confidence
CREATE TABLE IF NOT EXISTS predictive_data_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES inspection_cases(id) ON DELETE CASCADE,
  prediction_type TEXT,
  source_name TEXT,
  source_type TEXT,
  source_quality TEXT,
  coverage_area TEXT,
  limitations TEXT,
  confidence_modifier NUMERIC(4,3),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_predictive_data_sources_case_id ON predictive_data_sources(case_id);

-- ── TABLE 10: learning_outcomes ─────────────────────────────
-- Records predicted vs. actual outcomes for continuous learning
CREATE TABLE IF NOT EXISTS learning_outcomes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES inspection_cases(id) ON DELETE CASCADE,
  proof_id UUID REFERENCES decision_proofs(id) ON DELETE SET NULL,
  predicted_mechanism TEXT,
  confirmed_mechanism TEXT,
  predicted_severity TEXT,
  actual_severity TEXT,
  predicted_outcome TEXT,
  actual_outcome TEXT,
  prediction_accuracy NUMERIC(4,3),
  learning_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_outcomes_case_id ON learning_outcomes(case_id);
CREATE INDEX IF NOT EXISTS idx_learning_outcomes_proof_id ON learning_outcomes(proof_id);
CREATE INDEX IF NOT EXISTS idx_learning_outcomes_status ON learning_outcomes(learning_status);

-- ── TABLE 11: inspector_overrides ───────────────────────────
-- Records when human inspectors override system recommendations
CREATE TABLE IF NOT EXISTS inspector_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES inspection_cases(id) ON DELETE CASCADE,
  original_recommendation TEXT,
  override_recommendation TEXT,
  human_role TEXT,
  override_reason TEXT,
  evidence_cited JSONB,
  final_outcome TEXT,
  human_correct BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspector_overrides_case_id ON inspector_overrides(case_id);

-- ── TABLE 12: evidence_value_records ────────────────────────
-- Measures information gain from each piece of evidence
CREATE TABLE IF NOT EXISTS evidence_value_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES inspection_cases(id) ON DELETE CASCADE,
  evidence_type TEXT,
  evidence_name TEXT,
  uncertainty_before NUMERIC(4,3),
  uncertainty_after NUMERIC(4,3),
  uncertainty_reduction NUMERIC(4,3),
  cost_to_obtain NUMERIC(10,2),
  time_to_obtain TEXT,
  field_difficulty TEXT,
  value_score NUMERIC(4,3),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_value_records_case_id ON evidence_value_records(case_id);

-- ── TABLE 13: confidence_calibration_records ────────────────
-- Tracks model confidence vs. actual accuracy across types
CREATE TABLE IF NOT EXISTS confidence_calibration_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  engine_code TEXT NOT NULL,
  industry TEXT,
  asset_type TEXT,
  mechanism TEXT,
  stated_confidence NUMERIC(4,3),
  observed_accuracy NUMERIC(4,3),
  calibration_error NUMERIC(4,3),
  recommended_adjustment NUMERIC(4,3),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_confidence_calibration_engine ON confidence_calibration_records(engine_code);

-- ── TABLE 14: learning_update_candidates ───────────────────
-- Proposed changes to core learning (concepts, rules, models)
CREATE TABLE IF NOT EXISTS learning_update_candidates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  update_type TEXT NOT NULL,
  target_engine TEXT,
  proposed_change JSONB,
  evidence_basis JSONB,
  validation_score NUMERIC(4,3),
  risk_score NUMERIC(4,3),
  status TEXT DEFAULT 'pending',
  human_approval_required BOOLEAN DEFAULT true,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_update_candidates_status ON learning_update_candidates(status);
CREATE INDEX IF NOT EXISTS idx_learning_update_candidates_target ON learning_update_candidates(target_engine);

-- ── TABLE 15: learning_versions ─────────────────────────────
-- Snapshots of learning system versions for rollback/audit
CREATE TABLE IF NOT EXISTS learning_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  version_name TEXT NOT NULL,
  version_type TEXT,
  changes JSONB,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approval_notes TEXT,
  active BOOLEAN DEFAULT false,
  rollback_reference UUID REFERENCES learning_versions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_versions_active ON learning_versions(active);
CREATE INDEX IF NOT EXISTS idx_learning_versions_name ON learning_versions(version_name);

-- ── TABLE 16: asset_twin_memory ────────────────────────────
-- Digital twin state and history for each asset
CREATE TABLE IF NOT EXISTS asset_twin_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  baseline_condition JSONB,
  inspection_history JSONB,
  exposure_history JSONB,
  repair_history JSONB,
  known_flaws JSONB,
  degradation_rate JSONB,
  risk_trend JSONB,
  predicted_future_state JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_twin_memory_asset_id ON asset_twin_memory(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_twin_memory_case_id ON asset_twin_memory(case_id);

-- ── TABLE 17: synthetic_scenarios ───────────────────────────
-- Test scenarios for validating reasoning engines
CREATE TABLE IF NOT EXISTS synthetic_scenarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scenario_name TEXT NOT NULL,
  scenario_domain TEXT,
  scenario_complexity TEXT,
  scenario_payload JSONB,
  expected_reasoning_path JSONB,
  expected_failure_modes JSONB,
  test_status TEXT DEFAULT 'untested',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_synthetic_scenarios_domain ON synthetic_scenarios(scenario_domain);
CREATE INDEX IF NOT EXISTS idx_synthetic_scenarios_status ON synthetic_scenarios(test_status);

-- ── ENABLE RLS (non-blocking) ─────────────────────────────────────
ALTER TABLE concept_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hypothesis_trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE causal_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_domain_analogies ENABLE ROW LEVEL SECURITY;
ALTER TABLE novelty_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE belief_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE failure_trajectories ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictive_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspector_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_value_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE confidence_calibration_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_update_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_twin_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthetic_scenarios ENABLE ROW LEVEL SECURITY;

-- Service role access (concept_registry and system tables)
CREATE POLICY "service_role_concept_registry" ON concept_registry FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_synthetic_scenarios" ON synthetic_scenarios FOR ALL TO service_role USING (true);

-- Service role access (case-linked reasoning tables)
CREATE POLICY "service_role_case_concepts" ON case_concepts FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_hypothesis_trees" ON hypothesis_trees FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_causal_chains" ON causal_chains FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_cross_domain_analogies" ON cross_domain_analogies FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_novelty_flags" ON novelty_flags FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_belief_updates" ON belief_updates FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_failure_trajectories" ON failure_trajectories FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_predictive_data_sources" ON predictive_data_sources FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_learning_outcomes" ON learning_outcomes FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_inspector_overrides" ON inspector_overrides FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_evidence_value_records" ON evidence_value_records FOR ALL TO service_role USING (true);

-- Service role access (calibration and learning system)
CREATE POLICY "service_role_confidence_calibration" ON confidence_calibration_records FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_learning_update_candidates" ON learning_update_candidates FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_learning_versions" ON learning_versions FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_asset_twin_memory" ON asset_twin_memory FOR ALL TO service_role USING (true);

-- ================================================================
-- VERIFICATION: Run after migration
-- ================================================================
-- SELECT 'concept_registry' as tbl, count(*) FROM concept_registry
-- UNION ALL
-- SELECT 'case_concepts' as tbl, count(*) FROM case_concepts
-- UNION ALL
-- SELECT 'hypothesis_trees' as tbl, count(*) FROM hypothesis_trees
-- UNION ALL
-- SELECT 'causal_chains' as tbl, count(*) FROM causal_chains
-- UNION ALL
-- SELECT 'cross_domain_analogies' as tbl, count(*) FROM cross_domain_analogies
-- UNION ALL
-- SELECT 'novelty_flags' as tbl, count(*) FROM novelty_flags
-- UNION ALL
-- SELECT 'belief_updates' as tbl, count(*) FROM belief_updates
-- UNION ALL
-- SELECT 'failure_trajectories' as tbl, count(*) FROM failure_trajectories
-- UNION ALL
-- SELECT 'predictive_data_sources' as tbl, count(*) FROM predictive_data_sources
-- UNION ALL
-- SELECT 'learning_outcomes' as tbl, count(*) FROM learning_outcomes
-- UNION ALL
-- SELECT 'inspector_overrides' as tbl, count(*) FROM inspector_overrides
-- UNION ALL
-- SELECT 'evidence_value_records' as tbl, count(*) FROM evidence_value_records
-- UNION ALL
-- SELECT 'confidence_calibration_records' as tbl, count(*) FROM confidence_calibration_records
-- UNION ALL
-- SELECT 'learning_update_candidates' as tbl, count(*) FROM learning_update_candidates
-- UNION ALL
-- SELECT 'learning_versions' as tbl, count(*) FROM learning_versions
-- UNION ALL
-- SELECT 'asset_twin_memory' as tbl, count(*) FROM asset_twin_memory
-- UNION ALL
-- SELECT 'synthetic_scenarios' as tbl, count(*) FROM synthetic_scenarios;
