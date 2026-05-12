-- ============================================================
-- DEPLOY355: Cross-Domain Intelligence — Sprint 1 Foundation
-- FORGED 4D NDT Intelligence OS
--
-- Adds the schema + memory backbone for the cross-domain asset
-- reality intelligence system. Additive-only: no destructive
-- changes. Behind a per-org feature flag (org_feature_flags).
--
-- Deviations from the original Sprint 1 brief:
--   - No `shared` schema (this repo uses `public`)
--   - Tenant column is `org_id uuid` (no FK), RLS via JWT app_metadata
--   - Feature flag lives on new `org_feature_flags` (no companies table)
--   - `ai_cost_log` added (no existing LLM cost table in this repo)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 0. org_feature_flags
-- ============================================================
CREATE TABLE IF NOT EXISTS org_feature_flags (
  org_id uuid PRIMARY KEY,
  feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE org_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_feature_flags FORCE ROW LEVEL SECURITY;

CREATE POLICY "org_feature_flags_tenant_read" ON org_feature_flags
  FOR SELECT USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);
CREATE POLICY "org_feature_flags_tenant_write" ON org_feature_flags
  FOR ALL USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
  WITH CHECK (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 1. asset_nodes
-- ============================================================
CREATE TABLE IF NOT EXISTS asset_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  asset_key text,
  asset_name text NOT NULL,
  domain text NOT NULL CHECK (domain IN (
    'industrial','welding','ndt','coatings','corrosion','subsea',
    'marine_vessel','port_infrastructure','diving','pipeline',
    'pressure_equipment','structural','power_generation','other'
  )),
  asset_type text NOT NULL,
  asset_subtype text,
  parent_asset_id uuid REFERENCES asset_nodes(id) ON DELETE SET NULL,
  location_description text,
  gps_lat numeric,
  gps_lon numeric,
  material text,
  material_grade text,
  coating_system text,
  design_code text,
  service_environment text,
  operating_conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  owner text,
  operator text,
  client text,
  install_date date,
  design_life_years numeric,
  expected_service_life_end date,
  criticality text NOT NULL DEFAULT 'moderate' CHECK (criticality IN (
    'low','moderate','high','critical','life_safety'
  )),
  status text NOT NULL DEFAULT 'active' CHECK (status IN (
    'active','restricted_service','out_of_service','repair_required','retired','unknown'
  )),
  metadata_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_nodes_org ON asset_nodes(org_id);
CREATE INDEX IF NOT EXISTS idx_asset_nodes_domain ON asset_nodes(domain);
CREATE INDEX IF NOT EXISTS idx_asset_nodes_asset_type ON asset_nodes(asset_type);
CREATE INDEX IF NOT EXISTS idx_asset_nodes_parent ON asset_nodes(parent_asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_nodes_criticality ON asset_nodes(criticality);
CREATE INDEX IF NOT EXISTS idx_asset_nodes_status ON asset_nodes(status);

ALTER TABLE asset_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_nodes FORCE ROW LEVEL SECURITY;
CREATE POLICY "asset_nodes_tenant_isolation" ON asset_nodes
  FOR ALL USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
  WITH CHECK (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 2. asset_relationships
-- ============================================================
CREATE TABLE IF NOT EXISTS asset_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  source_asset_id uuid NOT NULL REFERENCES asset_nodes(id) ON DELETE CASCADE,
  target_asset_id uuid NOT NULL REFERENCES asset_nodes(id) ON DELETE CASCADE,
  relationship_type text NOT NULL CHECK (relationship_type IN (
    'parent_child','connected_to','supports','protected_by','coated_by',
    'welded_to','feeds','drains_to','adjacent_to','same_cp_zone',
    'same_coating_system','same_environment','same_inspection_circuit',
    'operational_dependency','failure_dependency'
  )),
  confidence numeric NOT NULL DEFAULT 1.0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, source_asset_id, target_asset_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_asset_rel_org ON asset_relationships(org_id);
CREATE INDEX IF NOT EXISTS idx_asset_rel_source ON asset_relationships(source_asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_rel_target ON asset_relationships(target_asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_rel_type ON asset_relationships(relationship_type);

ALTER TABLE asset_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_relationships FORCE ROW LEVEL SECURITY;
CREATE POLICY "asset_relationships_tenant_isolation" ON asset_relationships
  FOR ALL USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
  WITH CHECK (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 3. degradation_mechanisms — GLOBAL (no org_id)
-- ============================================================
CREATE TABLE IF NOT EXISTS degradation_mechanisms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanism_key text UNIQUE NOT NULL,
  display_name text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'corrosion','coating','welding','fatigue','mechanical_damage',
    'environmental','erosion','abrasion','thermal','pressure',
    'structural','biological','unknown'
  )),
  description text,
  physics_explanation text,
  related_domains jsonb NOT NULL DEFAULT '[]'::jsonb,
  typical_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  accelerators jsonb NOT NULL DEFAULT '[]'::jsonb,
  inhibitors jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_consequence_bias text NOT NULL DEFAULT 'moderate' CHECK (default_consequence_bias IN (
    'low','moderate','high','critical'
  )),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE degradation_mechanisms ENABLE ROW LEVEL SECURITY;
ALTER TABLE degradation_mechanisms FORCE ROW LEVEL SECURITY;
CREATE POLICY "degradation_mechanisms_authenticated_read" ON degradation_mechanisms
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "degradation_mechanisms_service_write" ON degradation_mechanisms
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 4. inspection_events
-- ============================================================
CREATE TABLE IF NOT EXISTS inspection_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  asset_id uuid NOT NULL REFERENCES asset_nodes(id) ON DELETE CASCADE,
  domain text,
  inspection_type text,
  inspection_date date NOT NULL,
  inspection_start_at timestamptz,
  inspection_end_at timestamptz,
  inspector_user_id uuid,
  inspector_name text,
  inspection_company text,
  method_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  equipment_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  conditions_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  access_method text,
  visibility_conditions text,
  environmental_conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text,
  evidence_quality text NOT NULL DEFAULT 'moderate' CHECK (evidence_quality IN (
    'low','moderate','high','verified'
  )),
  confidence numeric NOT NULL DEFAULT 0.75,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','in_review','approved','sealed','superseded'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspection_events_org_asset ON inspection_events(org_id, asset_id);
CREATE INDEX IF NOT EXISTS idx_inspection_events_date ON inspection_events(inspection_date DESC);

ALTER TABLE inspection_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_events FORCE ROW LEVEL SECURITY;
CREATE POLICY "inspection_events_tenant_isolation" ON inspection_events
  FOR ALL USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
  WITH CHECK (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 5. asset_anomalies
-- ============================================================
CREATE TABLE IF NOT EXISTS asset_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  asset_id uuid NOT NULL REFERENCES asset_nodes(id) ON DELETE CASCADE,
  inspection_event_id uuid REFERENCES inspection_events(id) ON DELETE SET NULL,
  domain text,
  anomaly_type text,
  mechanism_key text REFERENCES degradation_mechanisms(mechanism_key) ON DELETE SET NULL,
  severity text NOT NULL DEFAULT 'cat_1_minor' CHECK (severity IN (
    'cat_1_minor','cat_2_moderate','cat_3_major','cat_4_critical'
  )),
  location_description text,
  position_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text NOT NULL,
  measurement_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  original_field_language text,
  normalized_language_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommended_action text,
  authority_status text NOT NULL DEFAULT 'insufficient_information' CHECK (authority_status IN (
    'acceptable','acceptable_with_monitoring','hold_for_review',
    'repair_required','block_use','insufficient_information'
  )),
  prior_anomaly_id uuid REFERENCES asset_anomalies(id) ON DELETE SET NULL,
  forecast_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  consequence_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  causal_chain_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN (
    'open','monitoring','repaired','accepted_by_engineering','closed','superseded'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_anomalies_org ON asset_anomalies(org_id);
CREATE INDEX IF NOT EXISTS idx_asset_anomalies_asset ON asset_anomalies(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_anomalies_domain ON asset_anomalies(domain);
CREATE INDEX IF NOT EXISTS idx_asset_anomalies_severity ON asset_anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_asset_anomalies_mechanism ON asset_anomalies(mechanism_key);
CREATE INDEX IF NOT EXISTS idx_asset_anomalies_status ON asset_anomalies(status);
CREATE INDEX IF NOT EXISTS idx_asset_anomalies_prior ON asset_anomalies(prior_anomaly_id);

ALTER TABLE asset_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_anomalies FORCE ROW LEVEL SECURITY;
CREATE POLICY "asset_anomalies_tenant_isolation" ON asset_anomalies
  FOR ALL USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
  WITH CHECK (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 6. evidence_items (polymorphic)
-- ============================================================
CREATE TABLE IF NOT EXISTS evidence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  linked_entity_type text NOT NULL,
  linked_entity_id uuid NOT NULL,
  evidence_type text NOT NULL CHECK (evidence_type IN (
    'photo','video','document','measurement','voice_note','sms',
    'manual_observation','sensor_import','inspection_report',
    'ai_interpretation','calculation','authority_reference'
  )),
  source text NOT NULL CHECK (source IN (
    'observed','measured','reported','inferred','calculated','imported','ai_suggested'
  )),
  reliability_weight numeric NOT NULL DEFAULT 0.75,
  captured_at timestamptz,
  captured_by uuid,
  storage_path text,
  sha256_hex text,
  raw_text text,
  structured_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric NOT NULL DEFAULT 0.75,
  human_verified boolean NOT NULL DEFAULT false,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_items_lookup
  ON evidence_items(org_id, linked_entity_type, linked_entity_id);

ALTER TABLE evidence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_items FORCE ROW LEVEL SECURITY;
CREATE POLICY "evidence_items_tenant_isolation" ON evidence_items
  FOR ALL USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
  WITH CHECK (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 7. causal_chains
-- ============================================================
CREATE TABLE IF NOT EXISTS causal_chains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  asset_id uuid REFERENCES asset_nodes(id) ON DELETE SET NULL,
  title text NOT NULL,
  summary text,
  chain_type text NOT NULL DEFAULT 'degradation' CHECK (chain_type IN (
    'degradation','failure_pathway','operational_breakdown',
    'inspection_gap','repair_priority','unknown'
  )),
  linked_anomaly_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  linked_asset_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  linked_mechanisms jsonb NOT NULL DEFAULT '[]'::jsonb,
  chain_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence numeric NOT NULL DEFAULT 0.5,
  competing_hypotheses jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_information_gain_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_causal_chains_org_asset ON causal_chains(org_id, asset_id);

ALTER TABLE causal_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE causal_chains FORCE ROW LEVEL SECURITY;
CREATE POLICY "causal_chains_tenant_isolation" ON causal_chains
  FOR ALL USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
  WITH CHECK (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 8. asset_timeline_events
-- ============================================================
CREATE TABLE IF NOT EXISTS asset_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  asset_id uuid NOT NULL REFERENCES asset_nodes(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'installation','inspection','anomaly_detected','repair',
    'coating_applied','coating_failure','cp_reading','impact_event',
    'maintenance','operational_change','environmental_event',
    'authority_decision','report_sealed','status_change','other'
  )),
  event_date timestamptz NOT NULL,
  title text NOT NULL,
  description text,
  linked_entity_type text,
  linked_entity_id uuid,
  severity text,
  evidence_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_timeline_lookup
  ON asset_timeline_events(org_id, asset_id, event_date DESC);

ALTER TABLE asset_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_timeline_events FORCE ROW LEVEL SECURITY;
CREATE POLICY "asset_timeline_events_tenant_isolation" ON asset_timeline_events
  FOR ALL USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
  WITH CHECK (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 9. asset_consequence_profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS asset_consequence_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  asset_id uuid NOT NULL REFERENCES asset_nodes(id) ON DELETE CASCADE,
  safety_consequence integer NOT NULL DEFAULT 3 CHECK (safety_consequence BETWEEN 1 AND 5),
  environmental_consequence integer NOT NULL DEFAULT 3 CHECK (environmental_consequence BETWEEN 1 AND 5),
  operational_consequence integer NOT NULL DEFAULT 3 CHECK (operational_consequence BETWEEN 1 AND 5),
  financial_consequence integer NOT NULL DEFAULT 3 CHECK (financial_consequence BETWEEN 1 AND 5),
  regulatory_consequence integer NOT NULL DEFAULT 3 CHECK (regulatory_consequence BETWEEN 1 AND 5),
  reputation_consequence integer NOT NULL DEFAULT 3 CHECK (reputation_consequence BETWEEN 1 AND 5),
  downtime_cost_per_day numeric,
  repair_complexity text,
  access_difficulty text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, asset_id)
);

ALTER TABLE asset_consequence_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_consequence_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY "asset_consequence_profiles_tenant_isolation" ON asset_consequence_profiles
  FOR ALL USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
  WITH CHECK (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 10. concept_graph — GLOBAL
-- ============================================================
CREATE TABLE IF NOT EXISTS concept_graph (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_key text UNIQUE NOT NULL,
  display_name text NOT NULL,
  abstraction_level text NOT NULL DEFAULT 'mechanism' CHECK (abstraction_level IN (
    'mechanism','principle','system'
  )),
  description text,
  embedding vector(1536),
  example_count integer NOT NULL DEFAULT 0,
  connected_concept_keys text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_concept_graph_embedding
  ON concept_graph USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE concept_graph ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_graph FORCE ROW LEVEL SECURITY;
CREATE POLICY "concept_graph_authenticated_read" ON concept_graph
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "concept_graph_service_write" ON concept_graph
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 11. tenant_memory_index
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_memory_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  memory_type text NOT NULL CHECK (memory_type IN (
    'recurring_mechanism','analogous_case','pattern_observation','calibration_outcome'
  )),
  asset_id uuid REFERENCES asset_nodes(id) ON DELETE SET NULL,
  anomaly_id uuid REFERENCES asset_anomalies(id) ON DELETE SET NULL,
  concept_key text REFERENCES concept_graph(concept_key) ON DELETE SET NULL,
  summary text NOT NULL,
  context_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(1536),
  reinforcement_count integer NOT NULL DEFAULT 1,
  last_retrieved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_memory_org ON tenant_memory_index(org_id);
CREATE INDEX IF NOT EXISTS idx_tenant_memory_embedding
  ON tenant_memory_index USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE tenant_memory_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memory_index FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_memory_index_tenant_isolation" ON tenant_memory_index
  FOR ALL USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
  WITH CHECK (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 12. prediction_outcomes
-- ============================================================
CREATE TABLE IF NOT EXISTS prediction_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  anomaly_id uuid REFERENCES asset_anomalies(id) ON DELETE CASCADE,
  prediction_type text NOT NULL CHECK (prediction_type IN (
    'forecast_critical_date','severity_classification',
    'mechanism_attribution','consequence_score'
  )),
  predicted_value jsonb NOT NULL,
  predicted_at timestamptz NOT NULL DEFAULT now(),
  predicted_confidence numeric,
  actual_value jsonb,
  actual_observed_at timestamptz,
  delta_jsonb jsonb,
  calibration_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE prediction_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_outcomes FORCE ROW LEVEL SECURITY;
CREATE POLICY "prediction_outcomes_tenant_isolation" ON prediction_outcomes
  FOR ALL USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
  WITH CHECK (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 13. deliberation_log
-- ============================================================
CREATE TABLE IF NOT EXISTS deliberation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  finding_id uuid,
  finding_type text,
  deliberation_started_at timestamptz,
  deliberation_completed_at timestamptz,
  specialist_outputs jsonb NOT NULL DEFAULT '[]'::jsonb,
  synthesizer_decision jsonb,
  arbitration_rules_applied jsonb NOT NULL DEFAULT '[]'::jsonb,
  consensus_level text CHECK (consensus_level IN (
    'unanimous','majority_with_dissent','split','unresolved'
  )),
  escalated_to_human boolean NOT NULL DEFAULT false,
  total_cost_usd numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deliberation_log_lookup ON deliberation_log(org_id, finding_id);

ALTER TABLE deliberation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliberation_log FORCE ROW LEVEL SECURITY;
CREATE POLICY "deliberation_log_tenant_isolation" ON deliberation_log
  FOR ALL USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
  WITH CHECK (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 14. ai_cost_log (LLM cost tracking — net-new for this repo)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_cost_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  code_name text NOT NULL,
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric NOT NULL DEFAULT 0,
  request_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_cost_log_org ON ai_cost_log(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_cost_log_code_name ON ai_cost_log(code_name);
CREATE INDEX IF NOT EXISTS idx_ai_cost_log_created ON ai_cost_log(created_at DESC);

ALTER TABLE ai_cost_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cost_log FORCE ROW LEVEL SECURITY;
CREATE POLICY "ai_cost_log_tenant_read" ON ai_cost_log
  FOR SELECT USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);
CREATE POLICY "ai_cost_log_service_write" ON ai_cost_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- SEED: 34 degradation_mechanisms
-- ============================================================
INSERT INTO degradation_mechanisms (mechanism_key, display_name, category, default_consequence_bias) VALUES
  ('general_corrosion','General Corrosion','corrosion','moderate'),
  ('pitting_corrosion','Pitting Corrosion','corrosion','high'),
  ('crevice_corrosion','Crevice Corrosion','corrosion','high'),
  ('galvanic_corrosion','Galvanic Corrosion','corrosion','moderate'),
  ('microbiologically_influenced_corrosion','Microbiologically Influenced Corrosion (MIC)','corrosion','high'),
  ('corrosion_under_insulation','Corrosion Under Insulation (CUI)','corrosion','high'),
  ('erosion_corrosion','Erosion-Corrosion','corrosion','high'),
  ('coating_blistering','Coating Blistering','coating','moderate'),
  ('coating_holiday','Coating Holiday','coating','moderate'),
  ('coating_disbondment','Coating Disbondment','coating','moderate'),
  ('underfilm_corrosion','Underfilm Corrosion','coating','high'),
  ('cathodic_protection_failure','Cathodic Protection Failure','corrosion','high'),
  ('anode_depletion','Anode Depletion','corrosion','moderate'),
  ('marine_growth_loading','Marine Growth Loading','biological','moderate'),
  ('scour','Scour','environmental','high'),
  ('settlement','Settlement','structural','high'),
  ('fatigue_cracking','Fatigue Cracking','fatigue','critical'),
  ('weld_toe_cracking','Weld Toe Cracking','welding','critical'),
  ('hydrogen_cracking','Hydrogen Cracking','welding','critical'),
  ('lack_of_fusion','Lack of Fusion','welding','high'),
  ('undercut','Undercut','welding','moderate'),
  ('porosity','Porosity','welding','moderate'),
  ('impact_damage','Impact Damage','mechanical_damage','high'),
  ('dropped_object_damage','Dropped Object Damage','mechanical_damage','high'),
  ('vessel_strike_damage','Vessel Strike Damage','mechanical_damage','critical'),
  ('abrasion_damage','Abrasion Damage','abrasion','moderate'),
  ('cavitation_damage','Cavitation Damage','erosion','moderate'),
  ('thermal_cycling','Thermal Cycling Damage','thermal','moderate'),
  ('pressure_cycling','Pressure Cycling Damage','pressure','high'),
  ('concrete_spalling','Concrete Spalling','structural','high'),
  ('rebar_corrosion','Rebar Corrosion','corrosion','high'),
  ('chloride_attack','Chloride Attack on Concrete','environmental','high'),
  ('freeze_thaw_damage','Freeze-Thaw Damage','environmental','moderate'),
  ('unknown_mechanism','Unknown / Unclassified Mechanism','unknown','moderate')
ON CONFLICT (mechanism_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
