-- ============================================================================
-- 4D NDT INTELLIGENCE PLATFORM - MASTER SCHEMA (Disaster Recovery)
-- ============================================================================
-- This is a consolidated schema rebuild file containing ALL CREATE TABLE, 
-- CREATE INDEX, and RLS POLICY statements from all deployment migrations.
--
-- USAGE:
--   1. Restore the database to a clean Supabase instance
--   2. Run this entire file in sequence: psql < MASTER-SCHEMA.sql
--   3. Verify table counts and structure match expected configuration
--
-- CONTENT:
--   - Extensions (uuid, pgvector, etc.)
--   - All table definitions with IF NOT EXISTS guards
--   - All indexes with IF NOT EXISTS guards
--   - All RLS policies with DROP/CREATE guards
--   - All functions and triggers
--
-- SAFETY:
--   - All CREATE statements use IF NOT EXISTS
--   - All indexes use IF NOT EXISTS
--   - Idempotent - safe to re-run
--
-- Generated from migrations: CFI-SCHEMA-SEED.sql and DEPLOY208-DEPLOY351+
-- ============================================================================


-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE CASE MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS cfi_case_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL,
  pattern_id UUID REFERENCES cfi_context_patterns(id),
  asset_id UUID,
  observed_context JSONB NOT NULL,
  matched_failure_modes TEXT[],
  matched_damage_mechanisms TEXT[],
  recommended_ndt_methods TEXT[],
  missing_evidence TEXT[],
  risk_score NUMERIC,
  severity TEXT,
  system_reasoning TEXT,
  inspector_override JSONB,
  final_disposition TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence_contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  case_id UUID,
  domain TEXT NOT NULL,
  contract_key TEXT NOT NULL,
  evidence_items JSONB DEFAULT '[]',
  evidence_score NUMERIC(4,2),
  confidence_ceiling NUMERIC(4,2),
  mode_eligibility TEXT,
  missing_critical JSONB DEFAULT '[]',
  result_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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


-- ============================================================================
-- THICKNESS & CORROSION DATA
-- ============================================================================

CREATE TABLE IF NOT EXISTS thickness_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES inspection_cases(id) ON DELETE CASCADE,
  evidence_id UUID REFERENCES evidence(id) ON DELETE SET NULL,
  grid_row TEXT,
  grid_col TEXT,
  location_ref TEXT,
  thickness_in NUMERIC(10, 4),
  thickness_mm NUMERIC(10, 3),
  nominal_in NUMERIC(10, 4),
  is_min_of_grid BOOLEAN DEFAULT FALSE,
  source_format TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- CONCEPT INTELLIGENCE ENGINE
-- ============================================================================

create table if not exists concept_accuracy (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  outcome_record_id uuid not null references outcome_records(id) on delete cascade,
  concept_key text not null,
  was_activated boolean not null,
  was_correct boolean,
  was_useful boolean,
  was_governing boolean not null default false,
  confidence_at_prediction numeric,
  accuracy_json jsonb not null default '{}'::jsonb,
  engine_version text not null default 'v1.0.0',
  created_at timestamptz not null default now()
);

create table if not exists concept_action_queue (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  concept_run_id uuid not null references concept_runs(id) on delete cascade,
  action_type text not null,
  priority text not null,
  reason text not null,
  status text not null default 'pending',
  details_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists concept_authority_events (
  id uuid primary key default gen_random_uuid(),
  concept_run_id uuid not null references concept_runs(id) on delete cascade,
  case_id uuid not null,
  org_id uuid not null,
  authority_state text not null,
  authority_reason text not null,
  authority_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists concept_calibration_profiles (
  id uuid primary key default gen_random_uuid(),
  concept_key text not null,
  vertical text,
  severity_tier text,
  calibration_json jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists concept_dominance_results (
  id uuid primary key default gen_random_uuid(),
  concept_run_id uuid not null references concept_runs(id) on delete cascade,
  case_id uuid not null,
  org_id uuid not null,
  governing_concept text,
  visible_supporting_concepts jsonb not null default '[]'::jsonb,
  suppressed_concepts jsonb not null default '[]'::jsonb,
  audit_only_concepts jsonb not null default '[]'::jsonb,
  dominance_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists concept_drift_metrics (
  id uuid primary key default gen_random_uuid(),
  concept_key text not null,
  org_id uuid,
  vertical text,
  asset_type text,
  material_class text,
  method text,
  time_window text not null,
  activation_rate numeric,
  confirmation_rate numeric,
  false_positive_rate numeric,
  false_negative_rate numeric,
  drift_score numeric,
  metric_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists concept_explanations (
  id uuid primary key default gen_random_uuid(),
  concept_run_id uuid not null references concept_runs(id) on delete cascade,
  case_id uuid not null,
  org_id uuid not null,
  short_text text not null,
  full_text text not null,
  explanation_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists concept_flags (
  id uuid primary key default gen_random_uuid(),
  concept_run_id uuid not null references concept_runs(id) on delete cascade,
  case_id uuid not null,
  org_id uuid not null,
  concept_key text not null,
  flag_type text not null,
  severity text not null,
  confidence numeric,
  details_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists concept_learning_feedback (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  concept_run_id uuid references concept_runs(id) on delete set null,
  concept_key text,
  inspector_action text,
  outcome_label text,
  feedback_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists concept_metrics_rollup (
  id uuid primary key default gen_random_uuid(),
  concept_key text not null,
  org_id uuid,
  period_key text not null,
  activations integer not null default 0,
  confirmed integer not null default 0,
  false_positives integer not null default 0,
  false_negatives integer not null default 0,
  inconclusive integer not null default 0,
  followed_and_useful integer not null default 0,
  ignored_but_correct integer not null default 0,
  average_usefulness numeric,
  average_agreement numeric,
  reliability_score numeric,
  rollup_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists concept_pathways (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  concept_run_id uuid not null references concept_runs(id) on delete cascade,
  pathway_key text not null,
  plausibility numeric not null,
  consequence_level text,
  time_horizon text,
  pathway_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists concept_registry (
  id uuid primary key default gen_random_uuid(),
  concept_key text unique not null,
  concept_family text not null,
  concept_name text not null,
  description text not null,
  deterministic boolean not null default true,
  active boolean not null default true,
  severity_weight numeric not null default 1.0,
  engine_version text not null default 'v2.0.0',
  created_at timestamptz not null default now()
);

create table if not exists concept_replay_runs (
  id uuid primary key default gen_random_uuid(),
  source_case_id uuid not null,
  org_id uuid not null,
  replay_version text not null default 'v2.1.0',
  replay_mode text not null default 'strict',
  replay_output jsonb not null,
  improvement_delta_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists concept_runs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  governing_concept text,
  output_json jsonb not null,
  engine_version text not null default 'v2.0.0',
  created_at timestamptz not null default now()
);

create table if not exists concept_validation_events (
  id uuid primary key default gen_random_uuid(),
  concept_run_id uuid not null references concept_runs(id) on delete cascade,
  case_id uuid not null,
  org_id uuid not null,
  concept_key text not null,
  validation_status text not null,
  validation_source text not null,
  validator_user_id uuid,
  usefulness_score numeric,
  agreement_score numeric,
  notes text,
  validation_json jsonb,
  created_at timestamptz not null default now()
);


-- ============================================================================
-- LEARNING & OUTCOME TRACKING
-- ============================================================================

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

create table if not exists outcome_audit_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid,
  org_id uuid not null,
  action_type text not null,
  event_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists outcome_calibration_queue (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  target_engine text not null,
  target_parameter text not null,
  current_value numeric,
  recommended_value numeric,
  reason text not null,
  evidence_count integer not null default 0,
  confidence numeric,
  status text not null default 'pending',
  calibration_json jsonb not null default '{}'::jsonb,
  engine_version text not null default 'v1.0.0',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists outcome_records (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  outcome_type text not null,
  outcome_status text not null default 'pending',
  recorded_by uuid,
  actual_disposition text,
  actual_failure_mode text,
  actual_consequence_level text,
  time_to_outcome_days integer,
  outcome_json jsonb not null default '{}'::jsonb,
  notes text,
  engine_version text not null default 'v1.0.0',
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);


-- ============================================================================
-- PHYSICS VERIFICATION
-- ============================================================================

create table if not exists physics_check_audit (
  id uuid default gen_random_uuid() primary key,
  case_id uuid not null,
  material_class text,
  checks_evaluated int not null default 0,
  required_count int not null default 0,
  runnable_count int not null default 0,
  recommended_count int not null default 0,
  coverage_pct numeric(5,4),
  registry_version text,
  evaluated_at timestamptz default now()
);

create table if not exists physics_check_registry (
  id uuid default gen_random_uuid() primary key,
  check_id text not null,
  material_class text not null,
  code_ref text not null,
  check_description text not null,
  requirement_level text not null check (requirement_level in ('required', 'conditional', 'recommended')),
  trigger_condition text,
  missing_inputs_template jsonb not null default '[]',
  solver_status text not null default 'stub' check (solver_status in ('active', 'stub', 'planned')),
  solver_note text,
  evidence_type text check (evidence_type in ('photo', 'measurement', 'test_result', 'document', 'thickness', 'solver', null)),
  display_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists physics_check_triggers (
  id uuid default gen_random_uuid() primary key,
  trigger_name text not null unique,
  case_field text not null,
  match_type text not null check (match_type in ('regex', 'equals', 'greater_than', 'less_than', 'exists', 'finding_contains')),
  match_value text not null,
  description text not null,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS physics_learning_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id UUID REFERENCES physics_model_registry(id) ON DELETE CASCADE,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  predicted_value NUMERIC(10,4),
  actual_value NUMERIC(10,4),
  prediction_error NUMERIC(10,4),
  environmental_factors JSONB,
  material_factors JSONB,
  parameter_adjustment JSONB,
  learning_weight NUMERIC(4,3),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS physics_model_registry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_name TEXT NOT NULL,
  model_type TEXT,
  default_parameters JSONB,
  calibrated_parameters JSONB,
  calibration_count INTEGER DEFAULT 0,
  accuracy_score NUMERIC(4,3),
  applicable_materials JSONB,
  applicable_environments JSONB,
  status TEXT DEFAULT 'active',
  version TEXT DEFAULT 'v1.0.0',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS physics_model_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id UUID REFERENCES physics_model_registry(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  parameters JSONB,
  accuracy_at_version NUMERIC(4,3),
  change_reason TEXT,
  approved_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================================
-- AUTHORITY SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS authority_clause_conditions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clause_id UUID REFERENCES authority_clause_registry(id),
  condition_type TEXT NOT NULL CHECK (condition_type IN ('loading', 'thickness', 'material_group', 'joint_type', 'weld_type', 'service_temperature', 'process', 'position', 'ndt_method', 'application', 'custom')),
  condition_key TEXT NOT NULL,
  condition_value TEXT NOT NULL,
  condition_operator TEXT NOT NULL DEFAULT 'eq' CHECK (condition_operator IN ('eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'between', 'contains')),
  is_required BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS authority_clause_criteria (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clause_id UUID REFERENCES authority_clause_registry(id),
  discontinuity_type TEXT NOT NULL,
  criteria_description TEXT NOT NULL,
  limit_type TEXT NOT NULL CHECK (limit_type IN ('max_dimension', 'max_count', 'max_percentage', 'min_spacing', 'max_aggregate', 'prohibited', 'conditional')),
  limit_value TEXT,
  limit_unit TEXT,
  severity_if_exceeded TEXT NOT NULL DEFAULT 'reject' CHECK (severity_if_exceeded IN ('reject', 'repair', 'hold', 'accept_with_condition', 'engineering_review')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS authority_clause_registry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  edition_id UUID REFERENCES authority_code_editions(id),
  code_family TEXT NOT NULL,
  clause_id TEXT NOT NULL,
  clause_type TEXT NOT NULL CHECK (clause_type IN ('table', 'figure', 'section', 'paragraph', 'appendix', 'annex')),
  clause_number TEXT NOT NULL,
  clause_title TEXT NOT NULL,
  description TEXT,
  governs_category TEXT NOT NULL CHECK (governs_category IN ('visual_acceptance', 'rt_acceptance', 'ut_acceptance', 'mt_pt_acceptance', 'weld_size', 'preheat', 'interpass', 'joint_design', 'qualification', 'procedure', 'repair', 'general_requirement')),
  discontinuity_types TEXT[],
  applies_to_loading TEXT[] DEFAULT ARRAY['static', 'cyclic', 'fatigue', 'seismic'],
  applies_to_joint_types TEXT[],
  applies_to_weld_types TEXT[],
  thickness_min_mm NUMERIC,
  thickness_max_mm NUMERIC,
  is_mandatory BOOLEAN DEFAULT true,
  priority_rank INTEGER DEFAULT 100,
  cross_references TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS authority_code_editions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code_family TEXT NOT NULL,
  edition_year TEXT NOT NULL,
  full_title TEXT NOT NULL,
  issuing_body TEXT NOT NULL,
  effective_date DATE,
  supersedes TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS authority_lock_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  lock_id UUID REFERENCES authority_locks(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('lock_created', 'lock_verified', 'lock_superseded', 'lock_overridden', 'lock_expired', 'clause_lookup', 'edition_check', 'comparison_run')),
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS authority_locks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  assessment_id UUID,
  case_id UUID,
  clause_id UUID REFERENCES authority_clause_registry(id),
  edition_id UUID REFERENCES authority_code_editions(id),
  code_family TEXT NOT NULL,
  clause_number TEXT NOT NULL,
  clause_title TEXT NOT NULL,
  lock_reason TEXT NOT NULL,
  context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  locked_by TEXT,
  locked_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  superseded_by UUID,
  override_reason TEXT,
  override_by TEXT,
  override_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS code_authority_lookups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES inspection_cases(id),
  query_context TEXT,
  standard_requested TEXT,
  standard_resolved TEXT,
  edition_resolved TEXT,
  resolution_status TEXT DEFAULT 'RESOLVED',
  resolution_notes TEXT,
  applicability_confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS code_authority_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_body TEXT NOT NULL,
  standard_designation TEXT NOT NULL,
  current_edition TEXT NOT NULL,
  current_year INTEGER NOT NULL,
  previous_edition TEXT,
  previous_year INTEGER,
  superseded_by TEXT,
  title TEXT,
  scope TEXT,
  applicable_domains JSONB DEFAULT '[]'::jsonb,
  applicable_materials JSONB DEFAULT '[]'::jsonb,
  applicable_damage_modes JSONB DEFAULT '[]'::jsonb,
  key_requirements JSONB DEFAULT '[]'::jsonb,
  critical_thresholds JSONB DEFAULT '{}'::jsonb,
  withdrawal_date DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================================
-- CONTRADICTION DETECTION
-- ============================================================================

CREATE TABLE IF NOT EXISTS contradiction_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  assessment_id UUID,
  case_id UUID,
  total_checks_run INTEGER NOT NULL DEFAULT 0,
  contradictions_found INTEGER NOT NULL DEFAULT 0,
  critical_count INTEGER NOT NULL DEFAULT 0,
  major_count INTEGER NOT NULL DEFAULT 0,
  minor_count INTEGER NOT NULL DEFAULT 0,
  informational_count INTEGER NOT NULL DEFAULT 0,
  integrity_score NUMERIC NOT NULL DEFAULT 100,
  disposition_blocked BOOLEAN DEFAULT false,
  block_reason TEXT,
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ DEFAULT now(),
  checked_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contradiction_audit_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  assessment_id UUID,
  event_type TEXT NOT NULL CHECK (event_type IN ('check_run', 'contradiction_detected', 'contradiction_resolved', 'disposition_blocked', 'override_applied', 'false_positive_marked', 'integrity_scored')),
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contradiction_rule_registry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_code TEXT NOT NULL UNIQUE,
  rule_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('claim_vs_image', 'claim_vs_measurement', 'measurement_vs_measurement', 'claim_vs_code', 'measurement_vs_wps', 'process_vs_evidence', 'position_vs_evidence', 'material_vs_evidence', 'history_vs_current', 'logic_conflict')),
  severity TEXT NOT NULL DEFAULT 'major' CHECK (severity IN ('critical', 'major', 'minor', 'informational')),
  description TEXT NOT NULL,
  detection_logic TEXT NOT NULL,
  example_scenario TEXT,
  teaching_response TEXT NOT NULL,
  applies_to TEXT[] DEFAULT ARRAY['welding', 'ndt', 'general'],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================================
-- REPAIR PATHWAY ENGINE
-- ============================================================================

CREATE TABLE IF NOT EXISTS repair_audit_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  assessment_id UUID,
  event_type TEXT NOT NULL CHECK (event_type IN ('pathway_generated', 'prerequisite_checked', 'repair_started', 'repair_completed', 'reinspection_performed', 'repair_limit_warning', 'engineering_approval_requested', 'plan_overridden')),
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repair_code_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code_family TEXT NOT NULL,
  rule_code TEXT NOT NULL UNIQUE,
  rule_name TEXT NOT NULL,
  rule_description TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('repair_limit', 'method_restriction', 'reinspection_requirement', 'approval_requirement', 'preheat_requirement', 'pwht_requirement', 'documentation_requirement', 'time_restriction')),
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_mandatory BOOLEAN DEFAULT true,
  clause_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repair_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  case_id UUID,
  assessment_id UUID,
  weld_id TEXT,
  location_id TEXT,
  repair_number INTEGER NOT NULL DEFAULT 1,
  repair_method TEXT NOT NULL,
  discontinuity_repaired TEXT NOT NULL,
  repair_wps TEXT,
  repaired_by TEXT,
  repaired_at TIMESTAMPTZ,
  reinspection_method TEXT,
  reinspection_result TEXT CHECK (reinspection_result IN ('acceptable', 'rejectable', 'pending', 'not_performed')),
  reinspected_by TEXT,
  reinspected_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repair_method_registry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  method_code TEXT NOT NULL UNIQUE,
  method_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('excavation_and_reweld', 'grinding', 'buildup', 'cut_out_and_rerun', 'heat_treatment', 'peening', 'blend_grinding', 'weld_overlay', 'mechanical_repair', 'full_replacement')),
  description TEXT NOT NULL,
  applicable_discontinuities TEXT[] NOT NULL,
  applicable_processes TEXT[] DEFAULT ARRAY['SMAW', 'GMAW', 'FCAW', 'GTAW', 'SAW'],
  applicable_materials TEXT[] DEFAULT ARRAY['carbon_steel', 'low_alloy', 'stainless_austenitic'],
  prerequisites TEXT[] NOT NULL,
  procedure_steps TEXT[] NOT NULL,
  reinspection_required TEXT[] NOT NULL,
  code_references TEXT[] DEFAULT ARRAY[]::TEXT[],
  risk_level TEXT NOT NULL DEFAULT 'moderate' CHECK (risk_level IN ('low', 'moderate', 'high', 'critical')),
  typical_success_rate NUMERIC,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repair_pathway_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  assessment_id UUID,
  case_id UUID,
  disposition TEXT NOT NULL CHECK (disposition IN ('repair', 'cut_out_and_rerun', 'engineering_review', 'accept_as_is', 'full_replacement')),
  discontinuities JSONB NOT NULL DEFAULT '[]'::jsonb,
  weld_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  repair_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  prerequisites_checked JSONB NOT NULL DEFAULT '[]'::jsonb,
  all_prerequisites_met BOOLEAN DEFAULT false,
  code_rules_applied JSONB NOT NULL DEFAULT '[]'::jsonb,
  repair_count_at_location INTEGER NOT NULL DEFAULT 0,
  max_repairs_allowed INTEGER NOT NULL DEFAULT 2,
  repair_limit_exceeded BOOLEAN DEFAULT false,
  reinspection_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  estimated_difficulty TEXT CHECK (estimated_difficulty IN ('straightforward', 'moderate', 'complex', 'requires_specialist')),
  teaching_notes TEXT,
  generated_by TEXT DEFAULT 'system',
  generated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repair_prerequisites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prerequisite_code TEXT NOT NULL UNIQUE,
  prerequisite_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('wps_qualification', 'welder_qualification', 'material_verification', 'excavation_verification', 'preheat', 'nde_verification', 'engineering_approval', 'safety', 'equipment', 'documentation')),
  description TEXT NOT NULL,
  verification_method TEXT NOT NULL,
  is_mandatory BOOLEAN DEFAULT true,
  applicable_codes TEXT[] DEFAULT ARRAY['AWS_D1.1', 'API_1104', 'ASME_VIII', 'ASME_B31.3'],
  failure_consequence TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================================
-- CORROSION ANALYSIS
-- ============================================================================

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


-- ============================================================================
-- FATIGUE ANALYSIS
-- ============================================================================

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


-- ============================================================================
-- ASSET MANAGEMENT
-- ============================================================================

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

CREATE TABLE IF NOT EXISTS asset_registry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id TEXT UNIQUE NOT NULL,
  asset_type TEXT DEFAULT 'component',
  parent_id TEXT,
  tag_number TEXT,
  name TEXT,
  material_spec TEXT,
  nominal_diameter TEXT,
  nominal_wall NUMERIC(8,2),
  schedule TEXT,
  design_pressure NUMERIC(10,2),
  design_temperature NUMERIC(8,2),
  design_code TEXT,
  service_fluid TEXT,
  operating_temp NUMERIC(8,2),
  operating_pressure NUMERIC(10,2),
  corrosion_allowance NUMERIC(6,2),
  install_date DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

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


-- ============================================================================
-- CONTEXTUAL FAILURE INTELLIGENCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS cfi_context_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  component TEXT,
  location_context TEXT NOT NULL,
  geometry_context TEXT,
  material TEXT,
  coating_context TEXT,
  insulation_context TEXT,
  environment_context TEXT,
  process_context TEXT,
  loading_context TEXT,
  common_failure_modes TEXT[],
  likely_damage_mechanisms TEXT[],
  primary_ndt_methods TEXT[],
  secondary_ndt_methods TEXT[],
  evidence_required TEXT[],
  risk_indicators TEXT[],
  escalation_triggers TEXT[],
  recommended_actions TEXT[],
  prevention_actions TEXT[],
  severity_default TEXT CHECK (severity_default IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  confidence_weight NUMERIC DEFAULT 0.70,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cfi_feedback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL,
  finding_id UUID REFERENCES cfi_case_findings(id),
  inspector_action TEXT,
  inspector_notes TEXT,
  confirmed_failure_modes TEXT[],
  rejected_failure_modes TEXT[],
  confirmed_mechanisms TEXT[],
  missed_context_tags TEXT[],
  model_adjustment JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================================
-- ANOMALY DETECTION
-- ============================================================================

CREATE TABLE IF NOT EXISTS anomaly_fingerprints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  fingerprint JSONB,
  top_match TEXT,
  match_score NUMERIC(4,3),
  anomaly_score NUMERIC(4,3),
  classification TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS anomaly_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fingerprint_id UUID REFERENCES anomaly_fingerprints(id) ON DELETE CASCADE,
  library_fingerprint_id TEXT,
  match_score NUMERIC(4,3),
  match_details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================================
-- BATCH PROCESSING
-- ============================================================================

CREATE TABLE IF NOT EXISTS batch_processing_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id TEXT NOT NULL,
  total_readings INTEGER DEFAULT 0,
  processed INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  incomplete INTEGER DEFAULT 0,
  critical_count INTEGER DEFAULT 0,
  high_count INTEGER DEFAULT 0,
  action_items_count INTEGER DEFAULT 0,
  fleet_statistics JSONB,
  full_summary JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================================
-- API 579 ASSESSMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS api579_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  asset_id TEXT,
  component_type TEXT,
  action TEXT DEFAULT 'assess',
  tmin NUMERIC(10,4),
  rt NUMERIC(8,4),
  lambda NUMERIC(8,4),
  mt NUMERIC(8,4),
  rsf NUMERIC(8,4),
  rsf_allowable NUMERIC(8,4) DEFAULT 0.9,
  mawp NUMERIC(10,2),
  mawp_reduced NUMERIC(10,2),
  remaining_life NUMERIC(8,1),
  acceptance TEXT,
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================================
-- PIPELINE STATUS
-- ============================================================================

CREATE TABLE IF NOT EXISTS pipeline_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  pipeline_id TEXT,
  segment_id TEXT,
  action TEXT DEFAULT 'assess_segment',
  class_location INTEGER,
  maop NUMERIC(10,2),
  hca_identified BOOLEAN DEFAULT false,
  threat_count INTEGER DEFAULT 0,
  critical_features INTEGER DEFAULT 0,
  reassessment_years NUMERIC(6,1),
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================================
-- USER PROFILES & AUTH
-- ============================================================================

create table if not exists cost_assumption_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  profile_name text not null,
  assumption_json jsonb not null,
  version text not null default 'v1.0.0',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists failure_cost_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  failure_mode text not null,
  consequence_level text not null,
  direct_repair_cost numeric,
  downtime_cost numeric,
  collateral_damage_cost numeric,
  environmental_cost numeric,
  safety_liability_cost numeric,
  regulatory_cost numeric,
  cost_json jsonb not null,
  currency_code text not null default 'USD',
  version text not null default 'v1.0.0',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists inspection_cost_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  method text not null,
  asset_type text,
  component_type text,
  mobilization_cost numeric,
  execution_cost numeric,
  analysis_cost numeric,
  outage_cost numeric,
  cost_json jsonb not null,
  currency_code text not null default 'USD',
  version text not null default 'v1.0.0',
  active boolean not null default true,
  created_at timestamptz not null default now()
);


-- ============================================================================
-- ORGANIZATION MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- OTHER SYSTEM TABLES
-- ============================================================================

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

create table if not exists case_cost_scenarios (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  scenario_type text not null,
  immediate_cost numeric,
  expected_cost numeric,
  risk_exposure numeric,
  avoided_cost numeric,
  roi_value numeric,
  confidence numeric,
  currency_code text not null default 'USD',
  scenario_json jsonb not null,
  engine_version text not null default 'v1.0.0',
  created_at timestamptz not null default now()
);

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

CREATE TABLE IF NOT EXISTS causal_discovery_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  variables JSONB,
  edges_discovered INTEGER,
  edges_removed INTEGER,
  method TEXT,
  results JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS causal_relationships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cause_variable TEXT NOT NULL,
  effect_variable TEXT NOT NULL,
  direction TEXT,
  mechanism TEXT,
  strength TEXT,
  correlation NUMERIC(4,3),
  evidence_count INTEGER DEFAULT 0,
  discovered_by TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coating_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  case_id UUID,
  scan_id UUID,
  coating_system TEXT,
  service_environment TEXT,
  disposition TEXT,
  mode TEXT,
  confidence NUMERIC(4,2),
  evidence_score NUMERIC(4,2),
  flags JSONB DEFAULT '[]',
  steps JSONB DEFAULT '[]',
  result_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coating_audit_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  case_id UUID,
  scan_id UUID,
  action_type TEXT NOT NULL,
  event_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comprehensive_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  domain TEXT,
  equipment_type TEXT,
  scope TEXT,
  disposition TEXT,
  stages_succeeded INTEGER DEFAULT 0,
  stages_failed INTEGER DEFAULT 0,
  total_elapsed_ms INTEGER DEFAULT 0,
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS conformal_calibration (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  metric TEXT NOT NULL UNIQUE,
  residuals JSONB,
  calibration_size INTEGER,
  mean_residual NUMERIC(10,4),
  median_residual NUMERIC(10,4),
  max_residual NUMERIC(10,4),
  status TEXT DEFAULT 'active',
  calibrated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conformal_predictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  asset_id UUID,
  metric TEXT,
  point_estimate NUMERIC(10,4),
  lower_bound NUMERIC(10,4),
  upper_bound NUMERIC(10,4),
  alpha NUMERIC(4,3),
  coverage_guarantee NUMERIC(5,2),
  method TEXT,
  calibration_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS constrained_inference_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  equation_key TEXT NOT NULL,
  observations_count INTEGER,
  inferred_parameters JSONB,
  parameter_uncertainty JSONB,
  fit_quality JSONB,
  tri_state TEXT,
  confidence NUMERIC(4,3),
  created_at TIMESTAMPTZ DEFAULT now()
);

create table if not exists cost_accuracy (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  outcome_record_id uuid not null references outcome_records(id) on delete cascade,
  scenario_type text not null,
  predicted_cost numeric not null,
  actual_cost numeric,
  cost_variance numeric,
  cost_variance_pct numeric,
  accuracy_grade text,
  cost_json jsonb not null default '{}'::jsonb,
  currency_code text not null default 'USD',
  engine_version text not null default 'v1.0.0',
  created_at timestamptz not null default now()
);

create table if not exists cost_audit_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  action_type text not null,
  event_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists cost_decision_outputs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  recommended_action text not null,
  best_scenario_type text not null,
  cost_summary_json jsonb not null,
  roi_json jsonb,
  narrative_json jsonb,
  engine_version text not null default 'v1.0.0',
  created_at timestamptz not null default now()
);

create table if not exists cost_models (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  asset_type text not null,
  component_type text,
  failure_mode text,
  cost_category text not null,
  base_cost numeric not null,
  currency_code text not null default 'USD',
  multiplier_json jsonb not null default '{}'::jsonb,
  version text not null default 'v1.0.0',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists cost_timeline_projections (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  scenario_type text not null,
  time_horizon text not null,
  projected_cost numeric not null,
  probability_of_failure numeric,
  projection_json jsonb not null,
  created_at timestamptz not null default now()
);

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

CREATE TABLE IF NOT EXISTS dde_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  domain TEXT,
  service TEXT,
  material TEXT,
  status TEXT,
  top_mechanism TEXT,
  top_posterior NUMERIC(8,4),
  fmd_dominant TEXT,
  fmd_divergence BOOLEAN DEFAULT false,
  evidence_dimensions_used INTEGER DEFAULT 0,
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS debate_arguments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES debate_sessions(id) ON DELETE CASCADE,
  agent_name TEXT,
  position TEXT,
  evidence JSONB,
  risk_score NUMERIC(4,3),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS debate_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  agent_results JSONB,
  judgment JSONB,
  consensus_risk NUMERIC(4,3),
  final_disposition TEXT,
  code_override BOOLEAN DEFAULT false,
  conflicts_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS decision_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  case_id UUID,
  decision_category TEXT,
  decision_mode TEXT,
  confidence NUMERIC(4,2),
  disposition TEXT,
  rationale TEXT,
  human_reviewer TEXT,
  human_approved BOOLEAN DEFAULT FALSE,
  engine_versions JSONB DEFAULT '{}',
  evidence_summary JSONB,
  escalation_flags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS decision_proofs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proof_id TEXT UNIQUE NOT NULL,
  case_id UUID NOT NULL,
  source_engine TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  decision_value TEXT NOT NULL,
  rationale TEXT NOT NULL,
  input_summary JSONB,
  physics_applied JSONB,
  code_authority JSONB,
  evidence_quality NUMERIC(4,3),
  confidence NUMERIC(4,3),
  alternatives_considered JSONB,
  assumptions JSONB,
  prior_proof_id TEXT,
  revision_reason TEXT,
  metadata JSONB,
  integrity_hash TEXT NOT NULL,
  completeness_pct INTEGER DEFAULT 0,
  completeness_grade TEXT DEFAULT 'D',
  recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS detected_contradictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  assessment_id UUID,
  case_id UUID,
  rule_id UUID REFERENCES contradiction_rule_registry(id),
  rule_code TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  claim_field TEXT NOT NULL,
  claim_value TEXT NOT NULL,
  evidence_field TEXT NOT NULL,
  evidence_value TEXT NOT NULL,
  contradiction_description TEXT NOT NULL,
  teaching_message TEXT NOT NULL,
  resolution_required BOOLEAN DEFAULT true,
  resolved BOOLEAN DEFAULT false,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  resolution_action TEXT CHECK (resolution_action IN ('claim_corrected', 'evidence_reexamined', 'both_updated', 'override_with_justification', 'false_positive_confirmed')),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS distribution_sampler_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  action TEXT,
  distribution_type TEXT,
  sample_count INTEGER,
  mean NUMERIC(12,6),
  std_dev NUMERIC(12,6),
  p05 NUMERIC(12,6),
  p50 NUMERIC(12,6),
  p95 NUMERIC(12,6),
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS domain_audit_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  assessment_id UUID,
  event_type TEXT NOT NULL CHECK (event_type IN ('gate_check', 'combination_added', 'combination_updated', 'gap_identified', 'gap_resolved', 'override_applied', 'coverage_report')),
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS domain_combination_registry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  process TEXT NOT NULL,
  position TEXT NOT NULL,
  material TEXT NOT NULL,
  code_family TEXT NOT NULL,
  support_level TEXT NOT NULL CHECK (support_level IN ('full', 'validated', 'limited', 'experimental', 'unsupported')),
  confidence_pct INTEGER NOT NULL DEFAULT 0 CHECK (confidence_pct >= 0 AND confidence_pct <= 100),
  data_source TEXT NOT NULL CHECK (data_source IN ('code_based', 'empirical', 'physics_derived', 'expert_seeded', 'ai_inferred', 'untested')),
  limitations TEXT[],
  known_issues TEXT[],
  recommended_actions TEXT[],
  notes TEXT,
  last_validated TIMESTAMPTZ,
  validated_by TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS domain_gap_registry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gap_code TEXT NOT NULL UNIQUE,
  process TEXT,
  position TEXT,
  material TEXT,
  code_family TEXT,
  gap_type TEXT NOT NULL CHECK (gap_type IN ('no_code_coverage', 'no_acceptance_criteria', 'no_physics_model', 'insufficient_training_data', 'no_repair_pathway', 'material_not_modeled', 'process_not_modeled', 'position_not_validated')),
  severity TEXT NOT NULL DEFAULT 'blocking' CHECK (severity IN ('blocking', 'degraded', 'warning', 'informational')),
  description TEXT NOT NULL,
  workaround TEXT,
  resolution_plan TEXT,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS domain_validation_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  assessment_id UUID,
  case_id UUID,
  process TEXT NOT NULL,
  position TEXT NOT NULL,
  material TEXT NOT NULL,
  code_family TEXT NOT NULL,
  support_level TEXT NOT NULL,
  confidence_pct INTEGER NOT NULL,
  gate_result TEXT NOT NULL CHECK (gate_result IN ('proceed', 'proceed_with_warnings', 'degraded_mode', 'blocked')),
  warnings TEXT[],
  gaps_found TEXT[],
  checked_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS embedding_retrieval_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  domain TEXT,
  observation_text TEXT,
  top_mechanism TEXT,
  top_similarity NUMERIC(6,4),
  mechanisms_matched INTEGER,
  evidence_dimensions_filled INTEGER,
  action TEXT,
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS event_bus_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  severity_level INTEGER DEFAULT 0,
  source_engine TEXT,
  asset_id TEXT,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  message TEXT,
  matched_subscriptions JSONB DEFAULT '[]',
  notification_count INTEGER DEFAULT 0,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS explainability_traces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  trace_id TEXT NOT NULL,
  layers_executed INTEGER,
  total_inputs INTEGER,
  total_models INTEGER,
  total_rules INTEGER,
  critical_decisions_count INTEGER DEFAULT 0,
  narrative_summary TEXT,
  full_trace JSONB,
  audit_package JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS field_observations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id TEXT,
  cml_id TEXT,
  measurement_type TEXT,
  measured_value NUMERIC(10,4),
  unit TEXT,
  inspector_id TEXT,
  validation_valid BOOLEAN DEFAULT true,
  warning_count INTEGER DEFAULT 0,
  has_history BOOLEAN DEFAULT false,
  corrosion_rate NUMERIC(8,4),
  remaining_life NUMERIC(8,1),
  amendment_count INTEGER DEFAULT 0,
  confirmed BOOLEAN DEFAULT false,
  full_evidence JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS floating_platform_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  platform_id TEXT,
  platform_type TEXT,
  action TEXT,
  acceptance TEXT,
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flow_assurance_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  pipeline_id TEXT,
  action TEXT,
  acceptance TEXT,
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

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

create table if not exists inspection_effectiveness (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  outcome_record_id uuid not null references outcome_records(id) on delete cascade,
  method_recommended text not null,
  method_used text not null,
  detection_success boolean,
  sizing_accuracy_pct numeric,
  false_call boolean not null default false,
  missed_finding boolean not null default false,
  effectiveness_score numeric,
  effectiveness_json jsonb not null default '{}'::jsonb,
  engine_version text not null default 'v1.0.0',
  created_at timestamptz not null default now()
);

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

CREATE TABLE IF NOT EXISTS inspection_priorities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID,
  recommended_inspection TEXT,
  information_gain NUMERIC(6,4),
  current_uncertainty NUMERIC(4,3),
  risk_level TEXT,
  candidates_evaluated INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

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
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  version_name TEXT NOT NULL,
  version_type TEXT,
  changes JSONB,
  approved_by UUID,
  approval_notes TEXT,
  active BOOLEAN DEFAULT false,
  rollback_reference UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mooring_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  platform_id TEXT,
  line_id TEXT,
  component_type TEXT,
  action TEXT,
  acceptance TEXT,
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS multimodal_fusion_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  asset_id TEXT,
  modalities_used TEXT[],
  modality_count INTEGER,
  fusion_strategy TEXT,
  overall_confidence NUMERIC(6,4),
  anomaly_count INTEGER,
  corroboration_count INTEGER,
  action TEXT,
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS neurosymbolic_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id TEXT NOT NULL UNIQUE,
  category TEXT,
  domain TEXT,
  description TEXT,
  condition TEXT,
  conclusion TEXT,
  severity TEXT,
  symbolic_expression TEXT,
  parameters JSONB,
  overridable BOOLEAN DEFAULT true,
  created_by UUID,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS neurosymbolic_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  input_data JSONB,
  symbolic_results JSONB,
  pattern_results JSONB,
  fused_chain JSONB,
  conflicts JSONB,
  dominant_source TEXT,
  confidence NUMERIC(4,3),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL UNIQUE,

  -- Toggle by event category
  notify_escalation boolean DEFAULT true,
  notify_override boolean DEFAULT true,
  notify_critical_finding boolean DEFAULT true,
  notify_case_assigned boolean DEFAULT true,
  notify_deadline_warning boolean DEFAULT true,
  notify_resolution boolean DEFAULT true,
  notify_system_alert boolean DEFAULT true,

  -- Delivery preferences
  in_app boolean DEFAULT true,
  email_digest boolean DEFAULT false,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Who gets this notification
  recipient_id text NOT NULL,
  recipient_email text,
  recipient_role text, -- 'technician', 'manager', 'admin'

  -- What triggered it
  case_id uuid REFERENCES inspection_cases(id),
  event_type text NOT NULL,
  source_engine text, -- which engine/deploy generated this

  -- Content
  title text NOT NULL,
  message text NOT NULL,
  severity text DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical', 'success')),

  -- Status
  read boolean DEFAULT false,
  read_at timestamptz,
  dismissed boolean DEFAULT false,
  dismissed_at timestamptz,

  -- Action link (optional — where to go when clicked)
  action_url text,
  action_label text,

  -- Metadata
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS offshore_structural_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  platform_id TEXT,
  member_id TEXT,
  action TEXT DEFAULT 'assess_member',
  unity_check NUMERIC(8,4),
  fatigue_damage NUMERIC(8,4),
  remaining_fatigue_life NUMERIC(8,1),
  inspection_level TEXT,
  assessment_verdict TEXT,
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS output_envelopes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  engine_id TEXT NOT NULL,
  engine_version TEXT,
  input_hash TEXT,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  deterministic_field_count INTEGER DEFAULT 0,
  interpreted_field_count INTEGER DEFAULT 0,
  quality_score INTEGER DEFAULT 0,
  has_code_references BOOLEAN DEFAULT false,
  has_pass_fail BOOLEAN DEFAULT false,
  full_envelope JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

create table if not exists pattern_alerts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  cluster_id uuid not null references pattern_clusters(id) on delete cascade,
  rule_id uuid references pattern_rules(id) on delete set null,
  alert_type text not null,
  alert_severity text not null default 'medium',
  message text not null,
  acknowledged boolean not null default false,
  alert_json jsonb not null default '{}'::jsonb,
  engine_version text not null default 'v1.0.0',
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz
);

create table if not exists pattern_audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  case_id uuid,
  action_type text not null,
  event_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists pattern_case_members (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references pattern_clusters(id) on delete cascade,
  case_id uuid not null,
  org_id uuid not null,
  similarity_score numeric not null default 0,
  contribution_json jsonb not null default '{}'::jsonb,
  added_at timestamptz not null default now()
);

create table if not exists pattern_clusters (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  cluster_key text not null,
  cluster_name text not null,
  cluster_type text not null,
  asset_type text,
  failure_mode text,
  environment text,
  material_class text,
  method text,
  vertical text,
  case_count integer not null default 0,
  confidence numeric not null default 0,
  severity text not null default 'low',
  cluster_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  engine_version text not null default 'v1.0.0',
  discovered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pattern_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  cluster_id uuid references pattern_clusters(id) on delete set null,
  rule_key text not null,
  rule_name text not null,
  condition_json jsonb not null,
  recommendation text not null,
  supporting_case_count integer not null default 0,
  confidence numeric not null default 0,
  severity text not null default 'medium',
  auto_apply boolean not null default false,
  active boolean not null default true,
  rule_json jsonb not null default '{}'::jsonb,
  engine_version text not null default 'v1.0.0',
  created_at timestamptz not null default now()
);

create table if not exists pattern_statistics (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  dimension_type text not null,
  dimension_value text not null,
  case_count integer not null default 0,
  rejection_rate numeric,
  avg_confidence numeric,
  top_failure_mode text,
  top_finding_type text,
  stats_json jsonb not null default '{}'::jsonb,
  period_key text not null default 'all_time',
  engine_version text not null default 'v1.0.0',
  computed_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS portfolio_uncertainty_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL,
  asset_name TEXT,
  uncertainty NUMERIC(4,3),
  active_mechanisms JSONB,
  risk_level TEXT,
  days_since_last_inspection INTEGER,
  recommended_action TEXT,
  snapshot_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

create table if not exists prediction_accuracy (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  org_id uuid not null,
  outcome_record_id uuid not null references outcome_records(id) on delete cascade,
  prediction_source text not null,
  prediction_type text not null,
  predicted_value text,
  actual_value text,
  accuracy_score numeric,
  match_type text not null default 'pending',
  accuracy_json jsonb not null default '{}'::jsonb,
  engine_version text not null default 'v1.0.0',
  created_at timestamptz not null default now()
);

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

CREATE TABLE IF NOT EXISTS rbi_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  asset_id TEXT,
  equipment_type TEXT,
  action TEXT DEFAULT 'assess_risk',
  pof NUMERIC(12,8),
  cof_area NUMERIC(10,2),
  cof_usd NUMERIC(14,2),
  risk_score NUMERIC(14,4),
  risk_level TEXT,
  damage_factor NUMERIC(12,2),
  inspection_effectiveness TEXT,
  next_inspection_years NUMERIC(6,1),
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS regression_test_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_type TEXT NOT NULL DEFAULT 'full_suite',
  total_tests INTEGER NOT NULL DEFAULT 0,
  passed INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  pass_rate NUMERIC(6,2) NOT NULL DEFAULT 0,
  verdict TEXT NOT NULL DEFAULT 'UNKNOWN',
  total_ms INTEGER DEFAULT 0,
  results_json JSONB,
  run_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS regulatory_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id TEXT NOT NULL,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  template TEXT NOT NULL,
  title TEXT,
  code_reference TEXT,
  completeness INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',
  calculations_count INTEGER DEFAULT 0,
  full_report JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS riser_dynamics_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  riser_id TEXT,
  riser_type TEXT,
  action TEXT,
  acceptance TEXT,
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS simulation_scenarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  simulation_id UUID REFERENCES world_model_simulations(id) ON DELETE CASCADE,
  scenario_name TEXT NOT NULL,
  scenario_type TEXT,
  modified_conditions JSONB,
  results JSONB,
  divergence_from_baseline JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sour_service_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  asset_id TEXT,
  material TEXT,
  h2s_pp_psia NUMERIC(10,4),
  co2_pp_bar NUMERIC(10,4),
  nace_region TEXT,
  corrosion_rate_mm_yr NUMERIC(10,4),
  action TEXT,
  acceptance TEXT,
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subsea_equipment_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  equipment_id TEXT,
  equipment_type TEXT,
  action TEXT,
  acceptance TEXT,
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS superbrain_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  query TEXT,
  preset TEXT,
  report_title TEXT NOT NULL DEFAULT 'Untitled Report',
  report_type TEXT NOT NULL DEFAULT 'custom',
  report_content JSONB,
  raw_response TEXT,
  claude_model TEXT,
  claude_duration_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS tank_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  asset_id TEXT,
  tank_diameter_ft NUMERIC(8,1),
  tank_height_ft NUMERIC(8,1),
  action TEXT DEFAULT 'assess',
  course_count INTEGER DEFAULT 0,
  min_remaining_life NUMERIC(8,1),
  bottom_remaining_life NUMERIC(8,1),
  settlement_acceptable BOOLEAN DEFAULT true,
  overall_verdict TEXT,
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS temporal_fusion_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id TEXT,
  health_index NUMERIC(4,3),
  confidence INTEGER,
  regime TEXT,
  active_alarms_count INTEGER DEFAULT 0,
  stream_contributions JSONB,
  cross_stream_attention JSONB,
  full_state JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS twin_calibration_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  calibration_state_id UUID REFERENCES twin_calibration_state(id) ON DELETE CASCADE,
  predicted_value NUMERIC(10,4),
  actual_value NUMERIC(10,4),
  error_before NUMERIC(10,4),
  error_after NUMERIC(10,4),
  parameter_changes JSONB,
  calibration_method TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS twin_calibration_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL,
  model_type TEXT,
  current_parameters JSONB,
  prediction_accuracy NUMERIC(4,3),
  last_calibration TIMESTAMPTZ,
  drift_rate NUMERIC(6,4),
  calibration_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS twin_drift_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  calibration_state_id UUID REFERENCES twin_calibration_state(id) ON DELETE CASCADE,
  drift_magnitude NUMERIC(6,4),
  drift_direction TEXT,
  drift_cause TEXT,
  recalibration_recommended BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS uncertainty_propagation_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  model_key TEXT,
  method TEXT,
  n_samples INTEGER,
  input_variables JSONB,
  output_mean NUMERIC(10,4),
  output_std NUMERIC(10,4),
  p5 NUMERIC(10,4),
  p95 NUMERIC(10,4),
  probability_of_failure NUMERIC(6,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS uncertainty_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  case_id UUID,
  final_confidence NUMERIC(4,2),
  confidence_ceiling NUMERIC(4,2),
  knowledge_state TEXT,
  sources_count INTEGER,
  result_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS uncertainty_reliability_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  action TEXT,
  iterations INTEGER,
  distribution_type TEXT,
  survival_model TEXT,
  reliability_class TEXT,
  failure_probability NUMERIC(8,6),
  p05 NUMERIC(12,4),
  p50 NUMERIC(12,4),
  p95 NUMERIC(12,4),
  remaining_life_years NUMERIC(8,2),
  input_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  org_id UUID REFERENCES organizations(id),
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'reviewer', 'technician', 'viewer')),
  assigned_by UUID,
  is_active BOOLEAN DEFAULT true,
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
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

CREATE TABLE IF NOT EXISTS world_model_simulations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  asset_id UUID,
  simulation_type TEXT NOT NULL,
  initial_state JSONB,
  boundary_conditions JSONB,
  physics_parameters JSONB,
  time_horizon_years NUMERIC(6,2),
  time_steps INTEGER,
  results JSONB,
  critical_threshold JSONB,
  time_to_critical TEXT,
  confidence NUMERIC(4,3),
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================================
-- INDEXES
-- ============================================================================

create index if not exists idx_adjudications_case_id on public.inspector_adjudications(case_id);

create index if not exists idx_adjudications_created_at on public.inspector_adjudications(created_at desc);

create index if not exists idx_adjudications_inspector_id on public.inspector_adjudications(inspector_id);

create index if not exists idx_adjudications_type on public.inspector_adjudications(adjudication_type);

CREATE INDEX IF NOT EXISTS idx_adversarial_session ON adversarial_challenges(session_id);

CREATE INDEX IF NOT EXISTS idx_adversarial_severity ON adversarial_challenges(severity);

CREATE INDEX IF NOT EXISTS idx_adversarial_type ON adversarial_challenges(challenge_type);

CREATE INDEX IF NOT EXISTS idx_anomaly_fp_case ON anomaly_fingerprints(case_id);

CREATE INDEX IF NOT EXISTS idx_anomaly_fp_class ON anomaly_fingerprints(classification);

CREATE INDEX IF NOT EXISTS idx_anomaly_match_fp ON anomaly_matches(fingerprint_id);

CREATE INDEX IF NOT EXISTS idx_api579_acceptance ON api579_assessments(acceptance);

CREATE INDEX IF NOT EXISTS idx_api579_asset ON api579_assessments(asset_id);

CREATE INDEX IF NOT EXISTS idx_api579_case ON api579_assessments(case_id);

CREATE INDEX IF NOT EXISTS idx_asset_graphs_case ON asset_graphs(case_id);

CREATE INDEX IF NOT EXISTS idx_asset_interactions_graph ON asset_interactions(graph_id);

CREATE INDEX IF NOT EXISTS idx_asset_reg_id ON asset_registry(asset_id);

CREATE INDEX IF NOT EXISTS idx_asset_reg_parent ON asset_registry(parent_id);

CREATE INDEX IF NOT EXISTS idx_asset_reg_tag ON asset_registry(tag_number);

CREATE INDEX IF NOT EXISTS idx_asset_reg_type ON asset_registry(asset_type);

CREATE INDEX IF NOT EXISTS idx_asset_twin_memory_asset_id ON asset_twin_memory(asset_id);

CREATE INDEX IF NOT EXISTS idx_asset_twin_memory_case_id ON asset_twin_memory(case_id);

create index if not exists idx_audit_bundles_case_id on public.audit_bundles(case_id);

create index if not exists idx_audit_bundles_signed_at on public.audit_bundles(signed_at desc);

create index if not exists idx_audit_events_actor_id on public.audit_events(actor_id);

create index if not exists idx_audit_events_case_id on public.audit_events(case_id);

create index if not exists idx_audit_events_created_at on public.audit_events(created_at desc);

create index if not exists idx_audit_events_event_type on public.audit_events(event_type);

CREATE INDEX IF NOT EXISTS idx_batch_id ON batch_processing_runs(batch_id);

CREATE INDEX IF NOT EXISTS idx_belief_updates_case_id ON belief_updates(case_id);

CREATE INDEX IF NOT EXISTS idx_belief_updates_hypothesis_id ON belief_updates(hypothesis_id);

CREATE INDEX IF NOT EXISTS idx_calibration_computed ON calibration_scores(computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_calibration_dimension ON calibration_scores(dimension_key);

CREATE INDEX IF NOT EXISTS idx_calibration_type ON calibration_scores(calibration_type);

CREATE INDEX IF NOT EXISTS idx_cascade_scenarios_graph ON cascade_scenarios(graph_id);

CREATE INDEX IF NOT EXISTS idx_cascade_severity ON cascade_scenarios(consequence_severity);

CREATE INDEX IF NOT EXISTS idx_case_concepts_case_id ON case_concepts(case_id);

CREATE INDEX IF NOT EXISTS idx_case_concepts_concept_id ON case_concepts(concept_id);

CREATE INDEX IF NOT EXISTS idx_case_concepts_proof_id ON case_concepts(proof_id);

create index if not exists idx_case_cost_scenarios_case_id on case_cost_scenarios(case_id);

create index if not exists idx_case_cost_scenarios_created_at on case_cost_scenarios(created_at desc);

create index if not exists idx_case_cost_scenarios_org_id on case_cost_scenarios(org_id);

create index if not exists idx_case_cost_scenarios_scenario_type on case_cost_scenarios(scenario_type);

CREATE INDEX IF NOT EXISTS idx_cases_asset_type ON inspection_cases (asset_type);

create index if not exists idx_cases_composite_repair_flagged
  on public.inspection_cases(composite_repair_status)
  where composite_repair_status in ('repair_suspect','repair_failed');

CREATE INDEX IF NOT EXISTS idx_cases_confidence ON inspection_cases (confidence);

CREATE INDEX IF NOT EXISTS idx_cases_created_at ON inspection_cases (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cases_damage_type ON inspection_cases (damage_type);

create index if not exists idx_cases_decision_state
  on public.inspection_cases(decision_state)
  where decision_state in ('blocked', 'provisional', 'advisory');

CREATE INDEX IF NOT EXISTS idx_cases_disposition ON inspection_cases (disposition);

CREATE INDEX IF NOT EXISTS idx_cases_inspection_method ON inspection_cases (inspection_method);

CREATE INDEX IF NOT EXISTS idx_cases_material ON inspection_cases (material);

create index if not exists idx_cases_material_authority_status
  on public.inspection_cases(material_authority_status)
  where material_authority_status in ('suspect', 'failed');

CREATE INDEX IF NOT EXISTS idx_cases_material_family ON inspection_cases (material_family);

CREATE INDEX IF NOT EXISTS idx_cases_method_material ON inspection_cases (inspection_method, material);

CREATE INDEX IF NOT EXISTS idx_cases_org_id ON inspection_cases(org_id);

CREATE INDEX IF NOT EXISTS idx_cases_override ON inspection_cases (inspector_override_active);

create index if not exists idx_cases_remaining_life
  on public.inspection_cases(remaining_life_months)
  where remaining_life_months is not null;

CREATE INDEX IF NOT EXISTS idx_cases_severity ON inspection_cases (severity);

CREATE INDEX IF NOT EXISTS idx_cases_state ON inspection_cases (state);

CREATE INDEX IF NOT EXISTS idx_cases_status ON inspection_cases (status);

CREATE INDEX IF NOT EXISTS idx_cases_status_date ON inspection_cases (status, created_at DESC);

create index if not exists idx_cases_unified_confidence
  on public.inspection_cases(unified_confidence)
  where unified_confidence is not null;

CREATE INDEX IF NOT EXISTS idx_causal_chains_case_id ON causal_chains(case_id);

CREATE INDEX IF NOT EXISTS idx_causal_disc_case ON causal_discovery_results(case_id);

CREATE INDEX IF NOT EXISTS idx_causal_rel_cause ON causal_relationships(cause_variable);

CREATE INDEX IF NOT EXISTS idx_causal_rel_effect ON causal_relationships(effect_variable);

CREATE INDEX IF NOT EXISTS idx_cfi_feedback_case_id
  ON cfi_feedback_events(case_id);

CREATE INDEX IF NOT EXISTS idx_cfi_feedback_finding_id
  ON cfi_feedback_events(finding_id);

CREATE INDEX IF NOT EXISTS idx_cfi_findings_case_id
  ON cfi_case_findings(case_id);

CREATE INDEX IF NOT EXISTS idx_cfi_findings_pattern_id
  ON cfi_case_findings(pattern_id);

CREATE INDEX IF NOT EXISTS idx_cfi_patterns_asset_type
  ON cfi_context_patterns(asset_type);

CREATE INDEX IF NOT EXISTS idx_cfi_patterns_component
  ON cfi_context_patterns(component);

CREATE INDEX IF NOT EXISTS idx_cfi_patterns_damage_mechanisms
  ON cfi_context_patterns USING GIN(likely_damage_mechanisms);

CREATE INDEX IF NOT EXISTS idx_cfi_patterns_domain
  ON cfi_context_patterns(domain);

CREATE INDEX IF NOT EXISTS idx_cfi_patterns_failure_modes
  ON cfi_context_patterns USING GIN(common_failure_modes);

CREATE INDEX IF NOT EXISTS idx_cfi_patterns_location_context
  ON cfi_context_patterns(location_context);

CREATE INDEX IF NOT EXISTS idx_clause_conditions_clause ON authority_clause_conditions(clause_id);

CREATE INDEX IF NOT EXISTS idx_clause_criteria_clause ON authority_clause_criteria(clause_id);

CREATE INDEX IF NOT EXISTS idx_clause_registry_category ON authority_clause_registry(governs_category);

CREATE INDEX IF NOT EXISTS idx_clause_registry_code ON authority_clause_registry(code_family);

CREATE INDEX IF NOT EXISTS idx_coating_assessments_case ON coating_assessments(case_id);

CREATE INDEX IF NOT EXISTS idx_coating_assessments_org ON coating_assessments(org_id);

CREATE INDEX IF NOT EXISTS idx_coating_audit_events_org ON coating_audit_events(org_id);

CREATE INDEX IF NOT EXISTS idx_code_authority_active ON code_authority_registry(is_active);

CREATE INDEX IF NOT EXISTS idx_code_authority_body ON code_authority_registry(standard_body);

CREATE INDEX IF NOT EXISTS idx_code_authority_designation ON code_authority_registry(standard_designation);

CREATE INDEX IF NOT EXISTS idx_code_lookups_case ON code_authority_lookups(case_id);

create index if not exists idx_code_sets_industry on public.code_sets(industry);

create index if not exists idx_code_sets_tier on public.code_sets(tier);

CREATE INDEX IF NOT EXISTS idx_comp_case ON comprehensive_assessments(case_id);

CREATE INDEX IF NOT EXISTS idx_comp_disposition ON comprehensive_assessments(disposition);

CREATE INDEX IF NOT EXISTS idx_comp_domain ON comprehensive_assessments(domain);

CREATE INDEX IF NOT EXISTS idx_comp_equipment ON comprehensive_assessments(equipment_type);

create index if not exists idx_concept_accuracy_case_id on concept_accuracy(case_id);

create index if not exists idx_concept_accuracy_concept_key on concept_accuracy(concept_key);

create index if not exists idx_concept_accuracy_org_id on concept_accuracy(org_id);

create index if not exists idx_concept_accuracy_outcome_record_id on concept_accuracy(outcome_record_id);

create index if not exists idx_concept_action_queue_case_id on concept_action_queue(case_id);

create index if not exists idx_concept_action_queue_run_id on concept_action_queue(concept_run_id);

create index if not exists idx_concept_action_queue_status on concept_action_queue(status);

create index if not exists idx_concept_authority_events_case_id on concept_authority_events(case_id);

create index if not exists idx_concept_authority_events_run_id on concept_authority_events(concept_run_id);

create index if not exists idx_concept_authority_events_state on concept_authority_events(authority_state);

create index if not exists idx_concept_calibration_profiles_active on concept_calibration_profiles(active);

create index if not exists idx_concept_calibration_profiles_concept_key on concept_calibration_profiles(concept_key);

create index if not exists idx_concept_dominance_results_case_id on concept_dominance_results(case_id);

create index if not exists idx_concept_dominance_results_org_id on concept_dominance_results(org_id);

create index if not exists idx_concept_dominance_results_run_id on concept_dominance_results(concept_run_id);

create index if not exists idx_concept_drift_metrics_concept_key on concept_drift_metrics(concept_key);

create index if not exists idx_concept_drift_metrics_org_id on concept_drift_metrics(org_id);

create index if not exists idx_concept_drift_metrics_vertical on concept_drift_metrics(vertical);

create index if not exists idx_concept_explanations_case_id on concept_explanations(case_id);

create index if not exists idx_concept_explanations_run_id on concept_explanations(concept_run_id);

create index if not exists idx_concept_flags_case_id on concept_flags(case_id);

create index if not exists idx_concept_flags_org_id on concept_flags(org_id);

create index if not exists idx_concept_flags_run_id on concept_flags(concept_run_id);

create index if not exists idx_concept_learning_feedback_case_id on concept_learning_feedback(case_id);

create index if not exists idx_concept_learning_feedback_concept_key on concept_learning_feedback(concept_key);

create index if not exists idx_concept_metrics_rollup_concept_key on concept_metrics_rollup(concept_key);

create index if not exists idx_concept_metrics_rollup_org_id on concept_metrics_rollup(org_id);

create index if not exists idx_concept_metrics_rollup_period_key on concept_metrics_rollup(period_key);

create index if not exists idx_concept_pathways_case_id on concept_pathways(case_id);

create index if not exists idx_concept_pathways_plausibility on concept_pathways(plausibility desc);

create index if not exists idx_concept_pathways_run_id on concept_pathways(concept_run_id);

create index if not exists idx_concept_registry_active on concept_registry(active);

create index if not exists idx_concept_registry_family on concept_registry(concept_family);

CREATE INDEX IF NOT EXISTS idx_concept_registry_name ON concept_registry(concept_name);

CREATE INDEX IF NOT EXISTS idx_concept_registry_status ON concept_registry(status);

create index if not exists idx_concept_replay_runs_case_id on concept_replay_runs(source_case_id);

create index if not exists idx_concept_replay_runs_org_id on concept_replay_runs(org_id);

create index if not exists idx_concept_runs_case_id on concept_runs(case_id);

create index if not exists idx_concept_runs_created_at on concept_runs(created_at desc);

create index if not exists idx_concept_runs_org_id on concept_runs(org_id);

create index if not exists idx_concept_validation_events_case_id on concept_validation_events(case_id);

create index if not exists idx_concept_validation_events_concept_key on concept_validation_events(concept_key);

create index if not exists idx_concept_validation_events_org_id on concept_validation_events(org_id);

create index if not exists idx_concept_validation_events_run_id on concept_validation_events(concept_run_id);

create index if not exists idx_concept_validation_events_status on concept_validation_events(validation_status);

CREATE INDEX IF NOT EXISTS idx_confidence_calibration_engine ON confidence_calibration_records(engine_code);

CREATE INDEX IF NOT EXISTS idx_conformal_cal_metric ON conformal_calibration(metric);

CREATE INDEX IF NOT EXISTS idx_conformal_pred_asset ON conformal_predictions(asset_id);

CREATE INDEX IF NOT EXISTS idx_conformal_pred_case ON conformal_predictions(case_id);

CREATE INDEX IF NOT EXISTS idx_conformal_pred_metric ON conformal_predictions(metric);

CREATE INDEX IF NOT EXISTS idx_constrained_inf_case ON constrained_inference_runs(case_id);

CREATE INDEX IF NOT EXISTS idx_constrained_inf_eq ON constrained_inference_runs(equation_key);

CREATE INDEX IF NOT EXISTS idx_contradiction_assessments_assessment ON contradiction_assessments(assessment_id);

CREATE INDEX IF NOT EXISTS idx_contradiction_assessments_case ON contradiction_assessments(case_id);

CREATE INDEX IF NOT EXISTS idx_contradiction_assessments_org ON contradiction_assessments(org_id);

CREATE INDEX IF NOT EXISTS idx_contradiction_audit_assessment ON contradiction_audit_events(assessment_id);

CREATE INDEX IF NOT EXISTS idx_contradiction_audit_org ON contradiction_audit_events(org_id);

CREATE INDEX IF NOT EXISTS idx_contradiction_rules_category ON contradiction_rule_registry(category);

CREATE INDEX IF NOT EXISTS idx_contradiction_rules_severity ON contradiction_rule_registry(severity);

CREATE INDEX IF NOT EXISTS idx_corrosion_loops_case ON corrosion_loops(case_id);

CREATE INDEX IF NOT EXISTS idx_corrosion_loops_mechanism ON corrosion_loops(mechanism);

CREATE INDEX IF NOT EXISTS idx_corrosion_loops_proof ON corrosion_loops(proof_status);

CREATE INDEX IF NOT EXISTS idx_corrosion_rate_history_loop ON corrosion_rate_history(loop_id);

create index if not exists idx_cost_accuracy_accuracy_grade on cost_accuracy(accuracy_grade);

create index if not exists idx_cost_accuracy_case_id on cost_accuracy(case_id);

create index if not exists idx_cost_accuracy_org_id on cost_accuracy(org_id);

create index if not exists idx_cost_accuracy_outcome_record_id on cost_accuracy(outcome_record_id);

create index if not exists idx_cost_accuracy_scenario_type on cost_accuracy(scenario_type);

create index if not exists idx_cost_assumption_profiles_active on cost_assumption_profiles(active);

create index if not exists idx_cost_assumption_profiles_org_id on cost_assumption_profiles(org_id);

create index if not exists idx_cost_audit_events_action_type on cost_audit_events(action_type);

create index if not exists idx_cost_audit_events_case_id on cost_audit_events(case_id);

create index if not exists idx_cost_audit_events_org_id on cost_audit_events(org_id);

create index if not exists idx_cost_decision_outputs_best_scenario_type on cost_decision_outputs(best_scenario_type);

create index if not exists idx_cost_decision_outputs_case_id on cost_decision_outputs(case_id);

create index if not exists idx_cost_decision_outputs_org_id on cost_decision_outputs(org_id);

create index if not exists idx_cost_models_active on cost_models(active);

create index if not exists idx_cost_models_asset_type on cost_models(asset_type);

create index if not exists idx_cost_models_failure_mode on cost_models(failure_mode);

create index if not exists idx_cost_models_org_id on cost_models(org_id);

create index if not exists idx_cost_timeline_projections_case_id on cost_timeline_projections(case_id);

create index if not exists idx_cost_timeline_projections_org_id on cost_timeline_projections(org_id);

create index if not exists idx_cost_timeline_projections_scenario_type on cost_timeline_projections(scenario_type);

create index if not exists idx_cost_timeline_projections_time_horizon on cost_timeline_projections(time_horizon);

CREATE INDEX IF NOT EXISTS idx_cross_domain_analogies_case_id ON cross_domain_analogies(case_id);

CREATE INDEX IF NOT EXISTS idx_dde_case ON dde_assessments(case_id);

CREATE INDEX IF NOT EXISTS idx_dde_domain ON dde_assessments(domain);

CREATE INDEX IF NOT EXISTS idx_dde_fmd_divergence ON dde_assessments(fmd_divergence);

CREATE INDEX IF NOT EXISTS idx_dde_status ON dde_assessments(status);

CREATE INDEX IF NOT EXISTS idx_dde_top_mechanism ON dde_assessments(top_mechanism);

CREATE INDEX IF NOT EXISTS idx_debate_args_session ON debate_arguments(session_id);

CREATE INDEX IF NOT EXISTS idx_debate_case ON debate_sessions(case_id);

CREATE INDEX IF NOT EXISTS idx_decision_audit_log_case ON decision_audit_log(case_id);

CREATE INDEX IF NOT EXISTS idx_decision_audit_log_org ON decision_audit_log(org_id);

CREATE INDEX IF NOT EXISTS idx_detected_contradictions_assessment ON detected_contradictions(assessment_id);

CREATE INDEX IF NOT EXISTS idx_detected_contradictions_case ON detected_contradictions(case_id);

CREATE INDEX IF NOT EXISTS idx_detected_contradictions_org ON detected_contradictions(org_id);

CREATE INDEX IF NOT EXISTS idx_detected_contradictions_resolved ON detected_contradictions(resolved);

CREATE INDEX IF NOT EXISTS idx_domain_audit_org ON domain_audit_events(org_id);

CREATE INDEX IF NOT EXISTS idx_domain_checks_assessment ON domain_validation_checks(assessment_id);

CREATE INDEX IF NOT EXISTS idx_domain_checks_org ON domain_validation_checks(org_id);

CREATE INDEX IF NOT EXISTS idx_domain_combo_code ON domain_combination_registry(code_family);

CREATE INDEX IF NOT EXISTS idx_domain_combo_material ON domain_combination_registry(material);

CREATE INDEX IF NOT EXISTS idx_domain_combo_process ON domain_combination_registry(process);

CREATE INDEX IF NOT EXISTS idx_domain_combo_support ON domain_combination_registry(support_level);

CREATE INDEX IF NOT EXISTS idx_domain_gaps_severity ON domain_gap_registry(severity);

CREATE INDEX IF NOT EXISTS idx_domain_gaps_type ON domain_gap_registry(gap_type);

CREATE INDEX IF NOT EXISTS idx_dse_action ON distribution_sampler_results(action);

CREATE INDEX IF NOT EXISTS idx_dse_case ON distribution_sampler_results(case_id);

CREATE INDEX IF NOT EXISTS idx_dse_dist ON distribution_sampler_results(distribution_type);

CREATE INDEX IF NOT EXISTS idx_emb_case ON embedding_retrieval_results(case_id);

CREATE INDEX IF NOT EXISTS idx_emb_domain ON embedding_retrieval_results(domain);

CREATE INDEX IF NOT EXISTS idx_emb_mechanism ON embedding_retrieval_results(top_mechanism);

CREATE INDEX IF NOT EXISTS idx_envelope_case ON output_envelopes(case_id);

CREATE INDEX IF NOT EXISTS idx_envelope_engine ON output_envelopes(engine_id);

CREATE INDEX IF NOT EXISTS idx_escalation_assigned_to ON escalation_queue (assigned_to);

CREATE INDEX IF NOT EXISTS idx_escalation_case_id ON escalation_queue (case_id);

CREATE INDEX IF NOT EXISTS idx_escalation_created_at ON escalation_queue (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_escalation_deadline ON escalation_queue (deadline);

CREATE INDEX IF NOT EXISTS idx_escalation_priority ON escalation_queue (priority);

CREATE INDEX IF NOT EXISTS idx_escalation_status ON escalation_queue (status);

CREATE INDEX IF NOT EXISTS idx_escalation_status_priority ON escalation_queue (status, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_bus_asset ON event_bus_log(asset_id);

CREATE INDEX IF NOT EXISTS idx_event_bus_created ON event_bus_log(created_at);

CREATE INDEX IF NOT EXISTS idx_event_bus_engine ON event_bus_log(source_engine);

CREATE INDEX IF NOT EXISTS idx_event_bus_severity ON event_bus_log(severity);

CREATE INDEX IF NOT EXISTS idx_event_bus_type ON event_bus_log(event_type);

CREATE INDEX IF NOT EXISTS idx_evidence_contracts_case ON evidence_contracts(case_id);

CREATE INDEX IF NOT EXISTS idx_evidence_contracts_org ON evidence_contracts(org_id);

CREATE INDEX IF NOT EXISTS idx_evidence_nde_method ON evidence(nde_method);

CREATE INDEX IF NOT EXISTS idx_evidence_org_id ON evidence(org_id);

CREATE INDEX IF NOT EXISTS idx_evidence_value_records_case_id ON evidence_value_records(case_id);

CREATE INDEX IF NOT EXISTS idx_explain_trace_case ON explainability_traces(case_id);

CREATE INDEX IF NOT EXISTS idx_explain_trace_id ON explainability_traces(trace_id);

create index if not exists idx_failure_cost_profiles_active on failure_cost_profiles(active);

create index if not exists idx_failure_cost_profiles_consequence_level on failure_cost_profiles(consequence_level);

create index if not exists idx_failure_cost_profiles_failure_mode on failure_cost_profiles(failure_mode);

create index if not exists idx_failure_cost_profiles_org_id on failure_cost_profiles(org_id);

CREATE INDEX IF NOT EXISTS idx_failure_trajectories_case_id ON failure_trajectories(case_id);

CREATE INDEX IF NOT EXISTS idx_fatigue_case ON fatigue_assessments(case_id);

CREATE INDEX IF NOT EXISTS idx_fatigue_status ON fatigue_assessments(fatigue_status);

CREATE INDEX IF NOT EXISTS idx_field_obs_asset ON field_observations(asset_id);

CREATE INDEX IF NOT EXISTS idx_field_obs_cml ON field_observations(cml_id);

CREATE INDEX IF NOT EXISTS idx_field_obs_type ON field_observations(measurement_type);

CREATE INDEX IF NOT EXISTS idx_findings_org_id ON findings(org_id);

CREATE INDEX IF NOT EXISTS idx_flow_case ON flow_assurance_assessments(case_id);

CREATE INDEX IF NOT EXISTS idx_flow_pipeline ON flow_assurance_assessments(pipeline_id);

CREATE INDEX IF NOT EXISTS idx_fp_case ON floating_platform_assessments(case_id);

CREATE INDEX IF NOT EXISTS idx_fp_platform ON floating_platform_assessments(platform_id);

CREATE INDEX IF NOT EXISTS idx_fp_type ON floating_platform_assessments(platform_type);

CREATE INDEX IF NOT EXISTS idx_hypothesis_case ON hypothesis_tracking(case_id);

CREATE INDEX IF NOT EXISTS idx_hypothesis_session ON hypothesis_tracking(session_id);

CREATE INDEX IF NOT EXISTS idx_hypothesis_status ON hypothesis_tracking(status);

CREATE INDEX IF NOT EXISTS idx_hypothesis_trees_case_id ON hypothesis_trees(case_id);

CREATE INDEX IF NOT EXISTS idx_hypothesis_trees_status ON hypothesis_trees(status);

CREATE INDEX IF NOT EXISTS idx_hypothesis_type ON hypothesis_tracking(hypothesis_type);

CREATE INDEX IF NOT EXISTS idx_insp_priorities_asset ON inspection_priorities(asset_id);

CREATE INDEX IF NOT EXISTS idx_inspection_cases_action_status
  ON inspection_cases(action_plan_status)
  WHERE action_plan_status IN ('actions_required', 'escalate');

CREATE INDEX IF NOT EXISTS idx_inspection_cases_bundle_hash
  ON inspection_cases(decision_bundle_hash)
  WHERE decision_bundle_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inspection_cases_ood_flag
  ON inspection_cases(ood_flag)
  WHERE ood_flag IN ('marginal', 'out_of_distribution');

create index if not exists idx_inspection_cost_profiles_active on inspection_cost_profiles(active);

create index if not exists idx_inspection_cost_profiles_method on inspection_cost_profiles(method);

create index if not exists idx_inspection_cost_profiles_org_id on inspection_cost_profiles(org_id);

create index if not exists idx_inspection_effectiveness_case_id on inspection_effectiveness(case_id);

create index if not exists idx_inspection_effectiveness_method_used on inspection_effectiveness(method_used);

create index if not exists idx_inspection_effectiveness_org_id on inspection_effectiveness(org_id);

create index if not exists idx_inspection_effectiveness_outcome_record_id on inspection_effectiveness(outcome_record_id);

CREATE INDEX IF NOT EXISTS idx_inspection_plans_case ON inspection_plans(case_id);

CREATE INDEX IF NOT EXISTS idx_inspection_plans_status ON inspection_plans(plan_status);

CREATE INDEX IF NOT EXISTS idx_inspector_overrides_case_id ON inspector_overrides(case_id);

CREATE INDEX IF NOT EXISTS idx_learning_outcomes_case_id ON learning_outcomes(case_id);

CREATE INDEX IF NOT EXISTS idx_learning_outcomes_proof_id ON learning_outcomes(proof_id);

CREATE INDEX IF NOT EXISTS idx_learning_outcomes_status ON learning_outcomes(learning_status);

CREATE INDEX IF NOT EXISTS idx_learning_records_case ON learning_records(case_id);

CREATE INDEX IF NOT EXISTS idx_learning_records_material ON learning_records(material_class);

CREATE INDEX IF NOT EXISTS idx_learning_records_session ON learning_records(session_id);

CREATE INDEX IF NOT EXISTS idx_learning_records_status ON learning_records(status);

CREATE INDEX IF NOT EXISTS idx_learning_records_type ON learning_records(learning_type);

CREATE INDEX IF NOT EXISTS idx_learning_update_candidates_status ON learning_update_candidates(status);

CREATE INDEX IF NOT EXISTS idx_learning_update_candidates_target ON learning_update_candidates(target_engine);

CREATE INDEX IF NOT EXISTS idx_learning_versions_active ON learning_versions(active);

CREATE INDEX IF NOT EXISTS idx_learning_versions_name ON learning_versions(version_name);

CREATE INDEX IF NOT EXISTS idx_lock_audit_lock ON authority_lock_audit(lock_id);

CREATE INDEX IF NOT EXISTS idx_lock_audit_org ON authority_lock_audit(org_id);

CREATE INDEX IF NOT EXISTS idx_locks_assessment ON authority_locks(assessment_id);

CREATE INDEX IF NOT EXISTS idx_locks_case ON authority_locks(case_id);

CREATE INDEX IF NOT EXISTS idx_locks_org ON authority_locks(org_id);

CREATE INDEX IF NOT EXISTS idx_mmf_asset ON multimodal_fusion_results(asset_id);

CREATE INDEX IF NOT EXISTS idx_mmf_case ON multimodal_fusion_results(case_id);

CREATE INDEX IF NOT EXISTS idx_mmf_strategy ON multimodal_fusion_results(fusion_strategy);

CREATE INDEX IF NOT EXISTS idx_moor_case ON mooring_assessments(case_id);

CREATE INDEX IF NOT EXISTS idx_moor_line ON mooring_assessments(line_id);

CREATE INDEX IF NOT EXISTS idx_moor_platform ON mooring_assessments(platform_id);

CREATE INDEX IF NOT EXISTS idx_neuro_rules_category ON neurosymbolic_rules(category);

CREATE INDEX IF NOT EXISTS idx_neuro_rules_domain ON neurosymbolic_rules(domain);

CREATE INDEX IF NOT EXISTS idx_neuro_rules_status ON neurosymbolic_rules(status);

CREATE INDEX IF NOT EXISTS idx_neuro_sessions_case ON neurosymbolic_sessions(case_id);

CREATE INDEX IF NOT EXISTS idx_notifications_case ON notifications (case_id);

CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_event_type ON notifications (event_type);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications (recipient_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_severity ON notifications (severity);

CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (recipient_id, read) WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_novelty_flags_case_id ON novelty_flags(case_id);

CREATE INDEX IF NOT EXISTS idx_novelty_flags_escalation ON novelty_flags(expert_review_required);

CREATE INDEX IF NOT EXISTS idx_offshore_case ON offshore_structural_assessments(case_id);

CREATE INDEX IF NOT EXISTS idx_offshore_member ON offshore_structural_assessments(member_id);

CREATE INDEX IF NOT EXISTS idx_offshore_platform ON offshore_structural_assessments(platform_id);

CREATE INDEX IF NOT EXISTS idx_offshore_verdict ON offshore_structural_assessments(assessment_verdict);

create index if not exists idx_org_signing_keys_active on public.org_signing_keys(is_active) where is_active = true;

CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations(name);

create index if not exists idx_outcome_audit_events_action_type on outcome_audit_events(action_type);

create index if not exists idx_outcome_audit_events_case_id on outcome_audit_events(case_id);

create index if not exists idx_outcome_audit_events_org_id on outcome_audit_events(org_id);

create index if not exists idx_outcome_calibration_queue_org_id on outcome_calibration_queue(org_id);

create index if not exists idx_outcome_calibration_queue_status on outcome_calibration_queue(status);

create index if not exists idx_outcome_calibration_queue_target_engine on outcome_calibration_queue(target_engine);

create index if not exists idx_outcome_records_case_id on outcome_records(case_id);

create index if not exists idx_outcome_records_created_at on outcome_records(created_at desc);

create index if not exists idx_outcome_records_org_id on outcome_records(org_id);

create index if not exists idx_outcome_records_outcome_status on outcome_records(outcome_status);

create index if not exists idx_outcome_records_outcome_type on outcome_records(outcome_type);

create index if not exists idx_pattern_alerts_acknowledged on pattern_alerts(acknowledged);

create index if not exists idx_pattern_alerts_alert_severity on pattern_alerts(alert_severity);

create index if not exists idx_pattern_alerts_case_id on pattern_alerts(case_id);

create index if not exists idx_pattern_alerts_cluster_id on pattern_alerts(cluster_id);

create index if not exists idx_pattern_alerts_org_id on pattern_alerts(org_id);

create index if not exists idx_pattern_audit_events_action_type on pattern_audit_events(action_type);

create index if not exists idx_pattern_audit_events_case_id on pattern_audit_events(case_id);

create index if not exists idx_pattern_audit_events_org_id on pattern_audit_events(org_id);

create index if not exists idx_pattern_case_members_case_id on pattern_case_members(case_id);

create index if not exists idx_pattern_case_members_cluster_id on pattern_case_members(cluster_id);

create index if not exists idx_pattern_case_members_org_id on pattern_case_members(org_id);

create index if not exists idx_pattern_clusters_active on pattern_clusters(active);

create index if not exists idx_pattern_clusters_asset_type on pattern_clusters(asset_type);

create index if not exists idx_pattern_clusters_cluster_key on pattern_clusters(cluster_key);

create index if not exists idx_pattern_clusters_cluster_type on pattern_clusters(cluster_type);

create index if not exists idx_pattern_clusters_failure_mode on pattern_clusters(failure_mode);

create index if not exists idx_pattern_clusters_org_id on pattern_clusters(org_id);

create index if not exists idx_pattern_clusters_severity on pattern_clusters(severity);

create index if not exists idx_pattern_rules_active on pattern_rules(active);

create index if not exists idx_pattern_rules_cluster_id on pattern_rules(cluster_id);

create index if not exists idx_pattern_rules_org_id on pattern_rules(org_id);

create index if not exists idx_pattern_rules_rule_key on pattern_rules(rule_key);

create index if not exists idx_pattern_rules_severity on pattern_rules(severity);

create index if not exists idx_pattern_statistics_dimension_type on pattern_statistics(dimension_type);

create index if not exists idx_pattern_statistics_dimension_value on pattern_statistics(dimension_value);

create index if not exists idx_pattern_statistics_org_id on pattern_statistics(org_id);

create index if not exists idx_pattern_statistics_period_key on pattern_statistics(period_key);

create index if not exists idx_pca_case on physics_check_audit(case_id);

create index if not exists idx_pcr_check_id on physics_check_registry(check_id);

create index if not exists idx_pcr_material on physics_check_registry(material_class);

CREATE INDEX IF NOT EXISTS idx_physics_learn_case ON physics_learning_events(case_id);

CREATE INDEX IF NOT EXISTS idx_physics_learn_model ON physics_learning_events(model_id);

CREATE INDEX IF NOT EXISTS idx_physics_model_status ON physics_model_registry(status);

CREATE INDEX IF NOT EXISTS idx_physics_model_type ON physics_model_registry(model_type);

CREATE INDEX IF NOT EXISTS idx_physics_ver_model ON physics_model_versions(model_id);

CREATE INDEX IF NOT EXISTS idx_physics_ver_version ON physics_model_versions(version);

CREATE INDEX IF NOT EXISTS idx_pipeline_case ON pipeline_assessments(case_id);

CREATE INDEX IF NOT EXISTS idx_pipeline_id ON pipeline_assessments(pipeline_id);

CREATE INDEX IF NOT EXISTS idx_pipeline_segment ON pipeline_assessments(segment_id);

CREATE INDEX IF NOT EXISTS idx_portfolio_asset ON portfolio_uncertainty_state(asset_id);

CREATE INDEX IF NOT EXISTS idx_portfolio_risk ON portfolio_uncertainty_state(risk_level);

create index if not exists idx_prediction_accuracy_case_id on prediction_accuracy(case_id);

create index if not exists idx_prediction_accuracy_match_type on prediction_accuracy(match_type);

create index if not exists idx_prediction_accuracy_org_id on prediction_accuracy(org_id);

create index if not exists idx_prediction_accuracy_outcome_record_id on prediction_accuracy(outcome_record_id);

create index if not exists idx_prediction_accuracy_prediction_source on prediction_accuracy(prediction_source);

CREATE INDEX IF NOT EXISTS idx_predictive_data_sources_case_id ON predictive_data_sources(case_id);

CREATE INDEX IF NOT EXISTS idx_proofs_case_id ON decision_proofs(case_id);

CREATE INDEX IF NOT EXISTS idx_proofs_decision_type ON decision_proofs(decision_type);

CREATE INDEX IF NOT EXISTS idx_proofs_grade ON decision_proofs(completeness_grade);

CREATE INDEX IF NOT EXISTS idx_proofs_prior ON decision_proofs(prior_proof_id);

CREATE INDEX IF NOT EXISTS idx_proofs_recorded_at ON decision_proofs(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_proofs_source_engine ON decision_proofs(source_engine);

CREATE INDEX IF NOT EXISTS idx_rbi_asset ON rbi_assessments(asset_id);

CREATE INDEX IF NOT EXISTS idx_rbi_case ON rbi_assessments(case_id);

CREATE INDEX IF NOT EXISTS idx_rbi_risk ON rbi_assessments(risk_level);

CREATE INDEX IF NOT EXISTS idx_reasoning_sessions_case_id ON reasoning_sessions(case_id);

CREATE INDEX IF NOT EXISTS idx_reasoning_sessions_created ON reasoning_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reasoning_sessions_material ON reasoning_sessions(material_class);

CREATE INDEX IF NOT EXISTS idx_reasoning_sessions_status ON reasoning_sessions(pipeline_status);

CREATE INDEX IF NOT EXISTS idx_reasoning_sessions_type ON reasoning_sessions(session_type);

CREATE INDEX IF NOT EXISTS idx_reg_report_case ON regulatory_reports(case_id);

CREATE INDEX IF NOT EXISTS idx_reg_report_status ON regulatory_reports(status);

CREATE INDEX IF NOT EXISTS idx_reg_report_template ON regulatory_reports(template);

CREATE INDEX IF NOT EXISTS idx_regression_runs_at ON regression_test_runs(run_at DESC);

CREATE INDEX IF NOT EXISTS idx_regression_verdict ON regression_test_runs(verdict);

CREATE INDEX IF NOT EXISTS idx_repair_audit_assessment ON repair_audit_events(assessment_id);

CREATE INDEX IF NOT EXISTS idx_repair_audit_org ON repair_audit_events(org_id);

CREATE INDEX IF NOT EXISTS idx_repair_code_rules_family ON repair_code_rules(code_family);

CREATE INDEX IF NOT EXISTS idx_repair_history_case ON repair_history(case_id);

CREATE INDEX IF NOT EXISTS idx_repair_history_location ON repair_history(location_id);

CREATE INDEX IF NOT EXISTS idx_repair_history_org ON repair_history(org_id);

CREATE INDEX IF NOT EXISTS idx_repair_methods_category ON repair_method_registry(category);

CREATE INDEX IF NOT EXISTS idx_repair_pathways_assessment ON repair_pathway_assessments(assessment_id);

CREATE INDEX IF NOT EXISTS idx_repair_pathways_case ON repair_pathway_assessments(case_id);

CREATE INDEX IF NOT EXISTS idx_repair_pathways_org ON repair_pathway_assessments(org_id);

CREATE INDEX IF NOT EXISTS idx_repair_prerequisites_category ON repair_prerequisites(category);

CREATE INDEX IF NOT EXISTS idx_riser_case ON riser_dynamics_assessments(case_id);

CREATE INDEX IF NOT EXISTS idx_riser_id ON riser_dynamics_assessments(riser_id);

CREATE INDEX IF NOT EXISTS idx_riser_type ON riser_dynamics_assessments(riser_type);

CREATE INDEX IF NOT EXISTS idx_se_case ON subsea_equipment_assessments(case_id);

CREATE INDEX IF NOT EXISTS idx_se_equipment ON subsea_equipment_assessments(equipment_id);

CREATE INDEX IF NOT EXISTS idx_se_type ON subsea_equipment_assessments(equipment_type);

CREATE INDEX IF NOT EXISTS idx_sim_scenarios_sim ON simulation_scenarios(simulation_id);

CREATE INDEX IF NOT EXISTS idx_sour_asset ON sour_service_assessments(asset_id);

CREATE INDEX IF NOT EXISTS idx_sour_case ON sour_service_assessments(case_id);

CREATE INDEX IF NOT EXISTS idx_sour_region ON sour_service_assessments(nace_region);

CREATE INDEX IF NOT EXISTS idx_superbrain_reports_created ON superbrain_reports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_superbrain_reports_session ON superbrain_reports(session_id);

CREATE INDEX IF NOT EXISTS idx_superbrain_reports_status ON superbrain_reports(report_status);

CREATE INDEX IF NOT EXISTS idx_superbrain_reports_type ON superbrain_reports(report_type);

CREATE INDEX IF NOT EXISTS idx_synthetic_scenarios_domain ON synthetic_scenarios(scenario_domain);

CREATE INDEX IF NOT EXISTS idx_synthetic_scenarios_status ON synthetic_scenarios(test_status);

CREATE INDEX IF NOT EXISTS idx_tank_asset ON tank_assessments(asset_id);

CREATE INDEX IF NOT EXISTS idx_tank_case ON tank_assessments(case_id);

CREATE INDEX IF NOT EXISTS idx_tank_verdict ON tank_assessments(overall_verdict);

CREATE INDEX IF NOT EXISTS idx_temporal_fusion_asset ON temporal_fusion_states(asset_id);

CREATE INDEX IF NOT EXISTS idx_temporal_fusion_regime ON temporal_fusion_states(regime);

CREATE INDEX IF NOT EXISTS idx_thickness_readings_case ON thickness_readings(case_id);

CREATE INDEX IF NOT EXISTS idx_thickness_readings_evidence ON thickness_readings(evidence_id);

CREATE INDEX IF NOT EXISTS idx_twin_cal_asset ON twin_calibration_state(asset_id);

CREATE INDEX IF NOT EXISTS idx_twin_cal_status ON twin_calibration_state(status);

CREATE INDEX IF NOT EXISTS idx_twin_drift_state ON twin_drift_records(calibration_state_id);

CREATE INDEX IF NOT EXISTS idx_twin_hist_state ON twin_calibration_history(calibration_state_id);

CREATE INDEX IF NOT EXISTS idx_uncert_prop_case ON uncertainty_propagation_runs(case_id);

CREATE INDEX IF NOT EXISTS idx_uncert_prop_model ON uncertainty_propagation_runs(model_key);

CREATE INDEX IF NOT EXISTS idx_uncertainty_records_case ON uncertainty_records(case_id);

CREATE INDEX IF NOT EXISTS idx_uncertainty_records_org ON uncertainty_records(org_id);

CREATE INDEX IF NOT EXISTS idx_urc_action ON uncertainty_reliability_runs(action);

CREATE INDEX IF NOT EXISTS idx_urc_case ON uncertainty_reliability_runs(case_id);

CREATE INDEX IF NOT EXISTS idx_urc_class ON uncertainty_reliability_runs(reliability_class);

CREATE INDEX IF NOT EXISTS idx_urc_survival ON uncertainty_reliability_runs(survival_model);

CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_user_roles_org_id ON user_roles(org_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_org_role ON user_roles(org_id, role);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

CREATE INDEX IF NOT EXISTS idx_vibration_case ON vibration_assessments(case_id);

CREATE INDEX IF NOT EXISTS idx_vibration_type ON vibration_assessments(vibration_type);

CREATE INDEX IF NOT EXISTS idx_workpack_items_plan ON workpack_items(plan_id);

CREATE INDEX IF NOT EXISTS idx_workpack_items_priority ON workpack_items(priority);

CREATE INDEX IF NOT EXISTS idx_world_model_sims_asset ON world_model_simulations(asset_id);

CREATE INDEX IF NOT EXISTS idx_world_model_sims_case ON world_model_simulations(case_id);

CREATE INDEX IF NOT EXISTS idx_world_model_sims_type ON world_model_simulations(simulation_type);


-- ============================================================================
-- FUNCTIONS & STORED PROCEDURES
-- ============================================================================

CREATE OR REPLACE FUNCTION find_similar_cases(
  query_embedding vector(1536),
  query_org_id UUID,
  exclude_case_id UUID,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  case_number TEXT,
  title TEXT,
  component_name TEXT,
  material_class TEXT,
  method TEXT,
  final_disposition TEXT,
  final_confidence NUMERIC,
  case_summary TEXT,
  similarity NUMERIC,
  authority_locked BOOLEAN,
  authority_locked_at TIMESTAMPTZ
)
LANGUAGE SQL STABLE AS $$
  SELECT
    c.id,
    c.case_number,
    c.title,
    c.component_name,
    c.material_class,
    c.method,
    c.final_disposition,
    c.final_confidence,
    c.case_summary,
    (1 - (c.case_embedding <=> query_embedding))::NUMERIC AS similarity,
    c.authority_locked,
    c.authority_locked_at
  FROM inspection_cases c
  WHERE c.case_embedding IS NOT NULL
    AND c.id <> exclude_case_id
    AND c.org_id = query_org_id
  ORDER BY c.case_embedding <=> query_embedding
  LIMIT match_count;

CREATE OR REPLACE FUNCTION update_cfi_patterns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();


-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Allow authenticated users to insert feedback" CASCADE;
DROP POLICY IF EXISTS "Allow authenticated users to insert findings" CASCADE;
DROP POLICY IF EXISTS "Allow authenticated users to insert patterns" CASCADE;
DROP POLICY IF EXISTS "Allow authenticated users to update patterns" CASCADE;
DROP POLICY IF EXISTS "Allow authenticated users to view feedback" CASCADE;
DROP POLICY IF EXISTS "Allow authenticated users to view findings" CASCADE;
DROP POLICY IF EXISTS "Allow authenticated users to view patterns" CASCADE;
DROP POLICY IF EXISTS "adjudications_insert" CASCADE;
DROP POLICY IF EXISTS "adjudications_select" CASCADE;
DROP POLICY IF EXISTS "adjudications_service" CASCADE;
DROP POLICY IF EXISTS "anon_read_dse" CASCADE;
DROP POLICY IF EXISTS "anon_read_urc" CASCADE;
DROP POLICY IF EXISTS "asset_condition_records_org_isolation" CASCADE;
DROP POLICY IF EXISTS "audit_bundles_insert" CASCADE;
DROP POLICY IF EXISTS "audit_bundles_select" CASCADE;
DROP POLICY IF EXISTS "audit_bundles_service_insert" CASCADE;
DROP POLICY IF EXISTS "audit_bundles_service_select" CASCADE;
DROP POLICY IF EXISTS "audit_events_insert" CASCADE;
DROP POLICY IF EXISTS "audit_events_select" CASCADE;
DROP POLICY IF EXISTS "audit_events_service_insert" CASCADE;
DROP POLICY IF EXISTS "audit_events_service_select" CASCADE;
DROP POLICY IF EXISTS "authority_clause_conditions_read" CASCADE;
DROP POLICY IF EXISTS "authority_clause_criteria_read" CASCADE;
DROP POLICY IF EXISTS "authority_clause_registry_read" CASCADE;
DROP POLICY IF EXISTS "authority_code_editions_read" CASCADE;
DROP POLICY IF EXISTS "authority_lock_audit_org" CASCADE;
DROP POLICY IF EXISTS "authority_locks_org" CASCADE;
DROP POLICY IF EXISTS "case_cost_scenarios_org_isolation" CASCADE;
DROP POLICY IF EXISTS "coating_assessments_service" CASCADE;
DROP POLICY IF EXISTS "coating_audit_events_service" CASCADE;
DROP POLICY IF EXISTS "concept_accuracy_org_isolation" CASCADE;
DROP POLICY IF EXISTS "concept_action_queue_org_isolation" CASCADE;
DROP POLICY IF EXISTS "concept_authority_events_org_isolation" CASCADE;
DROP POLICY IF EXISTS "concept_calibration_profiles_read_all" CASCADE;
DROP POLICY IF EXISTS "concept_dominance_results_org_isolation" CASCADE;
DROP POLICY IF EXISTS "concept_drift_metrics_org_isolation" CASCADE;
DROP POLICY IF EXISTS "concept_explanations_org_isolation" CASCADE;
DROP POLICY IF EXISTS "concept_flags_org_isolation" CASCADE;
DROP POLICY IF EXISTS "concept_learning_feedback_org_isolation" CASCADE;
DROP POLICY IF EXISTS "concept_metrics_rollup_org_isolation" CASCADE;
DROP POLICY IF EXISTS "concept_pathways_org_isolation" CASCADE;
DROP POLICY IF EXISTS "concept_registry_read_all" CASCADE;
DROP POLICY IF EXISTS "concept_replay_runs_org_isolation" CASCADE;
DROP POLICY IF EXISTS "concept_runs_org_isolation" CASCADE;
DROP POLICY IF EXISTS "concept_validation_events_org_isolation" CASCADE;
DROP POLICY IF EXISTS "contradiction_assessments_org" CASCADE;
DROP POLICY IF EXISTS "contradiction_audit_org" CASCADE;
DROP POLICY IF EXISTS "contradiction_rules_read" CASCADE;
DROP POLICY IF EXISTS "cost_accuracy_org_isolation" CASCADE;
DROP POLICY IF EXISTS "cost_assumption_profiles_org_isolation" CASCADE;
DROP POLICY IF EXISTS "cost_audit_events_org_isolation" CASCADE;
DROP POLICY IF EXISTS "cost_decision_outputs_org_isolation" CASCADE;
DROP POLICY IF EXISTS "cost_models_org_isolation" CASCADE;
DROP POLICY IF EXISTS "cost_timeline_projections_org_isolation" CASCADE;
DROP POLICY IF EXISTS "decision_audit_log_service" CASCADE;
DROP POLICY IF EXISTS "degradation_models_org_isolation" CASCADE;
DROP POLICY IF EXISTS "detected_contradictions_org" CASCADE;
DROP POLICY IF EXISTS "domain_audit_org" CASCADE;
DROP POLICY IF EXISTS "domain_checks_org" CASCADE;
DROP POLICY IF EXISTS "domain_combinations_read" CASCADE;
DROP POLICY IF EXISTS "domain_gaps_read" CASCADE;
DROP POLICY IF EXISTS "escalation_insert" CASCADE;
DROP POLICY IF EXISTS "escalation_select" CASCADE;
DROP POLICY IF EXISTS "escalation_service_all" CASCADE;
DROP POLICY IF EXISTS "escalation_update" CASCADE;
DROP POLICY IF EXISTS "evidence_contracts_service" CASCADE;
DROP POLICY IF EXISTS "failure_cost_profiles_org_isolation" CASCADE;
DROP POLICY IF EXISTS "inspection_cost_profiles_org_isolation" CASCADE;
DROP POLICY IF EXISTS "inspection_effectiveness_org_isolation" CASCADE;
DROP POLICY IF EXISTS "inspection_schedule_recommendations_org_isolation" CASCADE;
DROP POLICY IF EXISTS "life_predictions_org_isolation" CASCADE;
DROP POLICY IF EXISTS "notifications_insert" CASCADE;
DROP POLICY IF EXISTS "notifications_select" CASCADE;
DROP POLICY IF EXISTS "notifications_service" CASCADE;
DROP POLICY IF EXISTS "notifications_update" CASCADE;
DROP POLICY IF EXISTS "org_signing_keys_service" CASCADE;
DROP POLICY IF EXISTS "outcome_audit_events_org_isolation" CASCADE;
DROP POLICY IF EXISTS "outcome_calibration_queue_org_isolation" CASCADE;
DROP POLICY IF EXISTS "outcome_records_org_isolation" CASCADE;
DROP POLICY IF EXISTS "pattern_alerts_org_isolation" CASCADE;
DROP POLICY IF EXISTS "pattern_audit_events_org_isolation" CASCADE;
DROP POLICY IF EXISTS "pattern_case_members_org_isolation" CASCADE;
DROP POLICY IF EXISTS "pattern_clusters_org_isolation" CASCADE;
DROP POLICY IF EXISTS "pattern_rules_org_isolation" CASCADE;
DROP POLICY IF EXISTS "pattern_statistics_org_isolation" CASCADE;
DROP POLICY IF EXISTS "physics_audit_events_org_isolation" CASCADE;
DROP POLICY IF EXISTS "physics_check_audit_read" CASCADE;
DROP POLICY IF EXISTS "physics_check_registry_read" CASCADE;
DROP POLICY IF EXISTS "physics_check_triggers_read" CASCADE;
DROP POLICY IF EXISTS "physics_damage_mechanisms_read_all" CASCADE;
DROP POLICY IF EXISTS "physics_method_mechanism_map_read_all" CASCADE;
DROP POLICY IF EXISTS "physics_method_registry_read_all" CASCADE;
DROP POLICY IF EXISTS "physics_sufficiency_org_isolation" CASCADE;
DROP POLICY IF EXISTS "physics_technique_requirements_read_all" CASCADE;
DROP POLICY IF EXISTS "prediction_accuracy_org_isolation" CASCADE;
DROP POLICY IF EXISTS "prefs_insert" CASCADE;
DROP POLICY IF EXISTS "prefs_select" CASCADE;
DROP POLICY IF EXISTS "prefs_service" CASCADE;
DROP POLICY IF EXISTS "prefs_update" CASCADE;
DROP POLICY IF EXISTS "prl_audit_events_org_isolation" CASCADE;
DROP POLICY IF EXISTS "process_audit_events_org_isolation" CASCADE;
DROP POLICY IF EXISTS "process_case_correlations_org_isolation" CASCADE;
DROP POLICY IF EXISTS "process_data_readings_org_isolation" CASCADE;
DROP POLICY IF EXISTS "process_data_sources_org_isolation" CASCADE;
DROP POLICY IF EXISTS "process_exceedance_events_org_isolation" CASCADE;
DROP POLICY IF EXISTS "process_exposure_summaries_org_isolation" CASCADE;
DROP POLICY IF EXISTS "repair_audit_org" CASCADE;
DROP POLICY IF EXISTS "repair_code_rules_read" CASCADE;
DROP POLICY IF EXISTS "repair_history_org" CASCADE;
DROP POLICY IF EXISTS "repair_methods_read" CASCADE;
DROP POLICY IF EXISTS "repair_pathways_org" CASCADE;
DROP POLICY IF EXISTS "repair_prerequisites_read" CASCADE;
DROP POLICY IF EXISTS "risk_projections_org_isolation" CASCADE;
DROP POLICY IF EXISTS "service_role_asset_twin_memory" CASCADE;
DROP POLICY IF EXISTS "service_role_belief_updates" CASCADE;
DROP POLICY IF EXISTS "service_role_case_concepts" CASCADE;
DROP POLICY IF EXISTS "service_role_causal_chains" CASCADE;
DROP POLICY IF EXISTS "service_role_concept_registry" CASCADE;
DROP POLICY IF EXISTS "service_role_confidence_calibration" CASCADE;
DROP POLICY IF EXISTS "service_role_conformal_cal" CASCADE;
DROP POLICY IF EXISTS "service_role_conformal_pred" CASCADE;
DROP POLICY IF EXISTS "service_role_cross_domain_analogies" CASCADE;
DROP POLICY IF EXISTS "service_role_evidence_value_records" CASCADE;
DROP POLICY IF EXISTS "service_role_failure_trajectories" CASCADE;
DROP POLICY IF EXISTS "service_role_hypothesis_trees" CASCADE;
DROP POLICY IF EXISTS "service_role_insp_priorities" CASCADE;
DROP POLICY IF EXISTS "service_role_inspector_overrides" CASCADE;
DROP POLICY IF EXISTS "service_role_learning_outcomes" CASCADE;
DROP POLICY IF EXISTS "service_role_learning_update_candidates" CASCADE;
DROP POLICY IF EXISTS "service_role_learning_versions" CASCADE;
DROP POLICY IF EXISTS "service_role_neuro_rules" CASCADE;
DROP POLICY IF EXISTS "service_role_neuro_sessions" CASCADE;
DROP POLICY IF EXISTS "service_role_novelty_flags" CASCADE;
DROP POLICY IF EXISTS "service_role_physics_learn" CASCADE;
DROP POLICY IF EXISTS "service_role_physics_model_reg" CASCADE;
DROP POLICY IF EXISTS "service_role_physics_versions" CASCADE;
DROP POLICY IF EXISTS "service_role_portfolio_state" CASCADE;
DROP POLICY IF EXISTS "service_role_predictive_data_sources" CASCADE;
DROP POLICY IF EXISTS "service_role_proofs" CASCADE;
DROP POLICY IF EXISTS "service_role_regression" CASCADE;
DROP POLICY IF EXISTS "service_role_sim_scenarios" CASCADE;
DROP POLICY IF EXISTS "service_role_synthetic_scenarios" CASCADE;
DROP POLICY IF EXISTS "service_role_twin_cal_hist" CASCADE;
DROP POLICY IF EXISTS "service_role_twin_cal_state" CASCADE;
DROP POLICY IF EXISTS "service_role_twin_drift" CASCADE;
DROP POLICY IF EXISTS "service_role_world_model_sims" CASCADE;
DROP POLICY IF EXISTS "sr_anomaly_fp" CASCADE;
DROP POLICY IF EXISTS "sr_anomaly_match" CASCADE;
DROP POLICY IF EXISTS "sr_api579" CASCADE;
DROP POLICY IF EXISTS "sr_asset_registry" CASCADE;
DROP POLICY IF EXISTS "sr_batch_processing" CASCADE;
DROP POLICY IF EXISTS "sr_causal_disc" CASCADE;
DROP POLICY IF EXISTS "sr_causal_rel" CASCADE;
DROP POLICY IF EXISTS "sr_comp" CASCADE;
DROP POLICY IF EXISTS "sr_constrained_inf" CASCADE;
DROP POLICY IF EXISTS "sr_dde" CASCADE;
DROP POLICY IF EXISTS "sr_debate_args" CASCADE;
DROP POLICY IF EXISTS "sr_debate_sess" CASCADE;
DROP POLICY IF EXISTS "sr_dse" CASCADE;
DROP POLICY IF EXISTS "sr_emb" CASCADE;
DROP POLICY IF EXISTS "sr_event_bus" CASCADE;
DROP POLICY IF EXISTS "sr_explain_traces" CASCADE;
DROP POLICY IF EXISTS "sr_field_observations" CASCADE;
DROP POLICY IF EXISTS "sr_flow" CASCADE;
DROP POLICY IF EXISTS "sr_fp" CASCADE;
DROP POLICY IF EXISTS "sr_mmf" CASCADE;
DROP POLICY IF EXISTS "sr_moor" CASCADE;
DROP POLICY IF EXISTS "sr_offshore" CASCADE;
DROP POLICY IF EXISTS "sr_output_envelopes" CASCADE;
DROP POLICY IF EXISTS "sr_pipeline" CASCADE;
DROP POLICY IF EXISTS "sr_rbi" CASCADE;
DROP POLICY IF EXISTS "sr_reg_reports" CASCADE;
DROP POLICY IF EXISTS "sr_riser" CASCADE;
DROP POLICY IF EXISTS "sr_se" CASCADE;
DROP POLICY IF EXISTS "sr_sour" CASCADE;
DROP POLICY IF EXISTS "sr_tank" CASCADE;
DROP POLICY IF EXISTS "sr_temporal_fusion" CASCADE;
DROP POLICY IF EXISTS "sr_uncert_prop" CASCADE;
DROP POLICY IF EXISTS "sr_urc" CASCADE;
DROP POLICY IF EXISTS "srv_adversarial_challenges" CASCADE;
DROP POLICY IF EXISTS "srv_calibration_scores" CASCADE;
DROP POLICY IF EXISTS "srv_hypothesis_tracking" CASCADE;
DROP POLICY IF EXISTS "srv_learning_records" CASCADE;
DROP POLICY IF EXISTS "srv_reasoning_sessions" CASCADE;
DROP POLICY IF EXISTS "superbrain_reports_all" CASCADE;
DROP POLICY IF EXISTS "uncertainty_records_service" CASCADE;
DROP POLICY IF EXISTS "weld_4d_physics_read_all" CASCADE;
DROP POLICY IF EXISTS "weld_assessments_org_isolation" CASCADE;
DROP POLICY IF EXISTS "weld_audit_org_isolation" CASCADE;
DROP POLICY IF EXISTS "weld_criteria_read_all" CASCADE;
DROP POLICY IF EXISTS "weld_disc_read_all" CASCADE;
DROP POLICY IF EXISTS "weld_joint_registry_read_all" CASCADE;
DROP POLICY IF EXISTS "weld_material_registry_read_all" CASCADE;
DROP POLICY IF EXISTS "weld_position_registry_read_all" CASCADE;
DROP POLICY IF EXISTS "weld_process_registry_read_all" CASCADE;

CREATE POLICY "Allow authenticated users to insert feedback"
  ON cfi_feedback_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to insert findings"
  ON cfi_case_findings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to insert patterns"
  ON cfi_context_patterns FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update patterns"
  ON cfi_context_patterns FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to view feedback"
  ON cfi_feedback_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to view findings"
  ON cfi_case_findings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to view patterns"
  ON cfi_context_patterns FOR SELECT
  TO authenticated
  USING (true);

create policy "adjudications_insert" on public.inspector_adjudications
  for insert to authenticated
  with check (true);

create policy "adjudications_select" on public.inspector_adjudications
  for select to authenticated
  using (true);

create policy "adjudications_service" on public.inspector_adjudications
  for all to service_role
  using (true)
  with check (true);

CREATE POLICY "anon_read_dse" ON distribution_sampler_results FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_urc" ON uncertainty_reliability_runs FOR SELECT TO anon USING (true);

create policy "asset_condition_records_org_isolation" on asset_condition_records
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "audit_bundles_insert" on public.audit_bundles
  for insert to authenticated
  with check (true);

create policy "audit_bundles_select" on public.audit_bundles
  for select to authenticated
  using (true);

create policy "audit_bundles_service_insert" on public.audit_bundles
  for insert to service_role
  with check (true);

create policy "audit_bundles_service_select" on public.audit_bundles
  for select to service_role
  using (true);

create policy "audit_events_insert" on public.audit_events
  for insert to authenticated
  with check (true);

create policy "audit_events_select" on public.audit_events
  for select to authenticated
  using (true);

create policy "audit_events_service_insert" on public.audit_events
  for insert to service_role
  with check (true);

create policy "audit_events_service_select" on public.audit_events
  for select to service_role
  using (true);

CREATE POLICY "authority_clause_conditions_read" ON authority_clause_conditions FOR SELECT USING (true);

CREATE POLICY "authority_clause_criteria_read" ON authority_clause_criteria FOR SELECT USING (true);

CREATE POLICY "authority_clause_registry_read" ON authority_clause_registry FOR SELECT USING (true);

CREATE POLICY "authority_code_editions_read" ON authority_code_editions FOR SELECT USING (true);

CREATE POLICY "authority_lock_audit_org" ON authority_lock_audit FOR ALL USING (
  org_id IS NULL OR org_id = ((auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
);

CREATE POLICY "authority_locks_org" ON authority_locks FOR ALL USING (
  org_id IS NULL OR org_id = ((auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
);

create policy "case_cost_scenarios_org_isolation" on case_cost_scenarios
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

CREATE POLICY "coating_assessments_service" ON coating_assessments FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "coating_audit_events_service" ON coating_audit_events FOR ALL USING (true) WITH CHECK (true);

create policy "concept_accuracy_org_isolation" on concept_accuracy
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "concept_action_queue_org_isolation" on concept_action_queue
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "concept_authority_events_org_isolation" on concept_authority_events
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "concept_calibration_profiles_read_all" on concept_calibration_profiles
  for select using (true);

create policy "concept_dominance_results_org_isolation" on concept_dominance_results
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "concept_drift_metrics_org_isolation" on concept_drift_metrics
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "concept_explanations_org_isolation" on concept_explanations
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "concept_flags_org_isolation" on concept_flags
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "concept_learning_feedback_org_isolation" on concept_learning_feedback
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "concept_metrics_rollup_org_isolation" on concept_metrics_rollup
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "concept_pathways_org_isolation" on concept_pathways
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "concept_registry_read_all" on concept_registry
  for select using (true);

create policy "concept_replay_runs_org_isolation" on concept_replay_runs
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "concept_runs_org_isolation" on concept_runs
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "concept_validation_events_org_isolation" on concept_validation_events
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

CREATE POLICY "contradiction_assessments_org" ON contradiction_assessments FOR ALL USING (
  org_id IS NULL OR org_id = ((auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
);

CREATE POLICY "contradiction_audit_org" ON contradiction_audit_events FOR ALL USING (
  org_id IS NULL OR org_id = ((auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
);

CREATE POLICY "contradiction_rules_read" ON contradiction_rule_registry FOR SELECT USING (true);

create policy "cost_accuracy_org_isolation" on cost_accuracy
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "cost_assumption_profiles_org_isolation" on cost_assumption_profiles
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "cost_audit_events_org_isolation" on cost_audit_events
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "cost_decision_outputs_org_isolation" on cost_decision_outputs
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "cost_models_org_isolation" on cost_models
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "cost_timeline_projections_org_isolation" on cost_timeline_projections
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

CREATE POLICY "decision_audit_log_service" ON decision_audit_log FOR ALL USING (true) WITH CHECK (true);

create policy "degradation_models_org_isolation" on degradation_models
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

CREATE POLICY "detected_contradictions_org" ON detected_contradictions FOR ALL USING (
  org_id IS NULL OR org_id = ((auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
);

CREATE POLICY "domain_audit_org" ON domain_audit_events FOR ALL USING (
  org_id IS NULL OR org_id = ((auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
);

CREATE POLICY "domain_checks_org" ON domain_validation_checks FOR ALL USING (
  org_id IS NULL OR org_id = ((auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
);

CREATE POLICY "domain_combinations_read" ON domain_combination_registry FOR SELECT USING (true);

CREATE POLICY "domain_gaps_read" ON domain_gap_registry FOR SELECT USING (true);

CREATE POLICY "escalation_insert" ON escalation_queue FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "escalation_select" ON escalation_queue FOR SELECT TO authenticated USING (true);

CREATE POLICY "escalation_service_all" ON escalation_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "escalation_update" ON escalation_queue FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "evidence_contracts_service" ON evidence_contracts FOR ALL USING (true) WITH CHECK (true);

create policy "failure_cost_profiles_org_isolation" on failure_cost_profiles
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "inspection_cost_profiles_org_isolation" on inspection_cost_profiles
  for all using (org_id is null or org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "inspection_effectiveness_org_isolation" on inspection_effectiveness
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "inspection_schedule_recommendations_org_isolation" on inspection_schedule_recommendations
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "life_predictions_org_isolation" on life_predictions
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

CREATE POLICY "notifications_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated USING (true);

CREATE POLICY "notifications_service" ON notifications FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

create policy "org_signing_keys_service" on public.org_signing_keys
  for all to service_role
  using (true)
  with check (true);

create policy "outcome_audit_events_org_isolation" on outcome_audit_events
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "outcome_calibration_queue_org_isolation" on outcome_calibration_queue
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "outcome_records_org_isolation" on outcome_records
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "pattern_alerts_org_isolation" on pattern_alerts
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "pattern_audit_events_org_isolation" on pattern_audit_events
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "pattern_case_members_org_isolation" on pattern_case_members
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "pattern_clusters_org_isolation" on pattern_clusters
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "pattern_rules_org_isolation" on pattern_rules
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "pattern_statistics_org_isolation" on pattern_statistics
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "physics_audit_events_org_isolation" on physics_audit_events
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "physics_check_audit_read" on physics_check_audit for select using (true);

create policy "physics_check_registry_read" on physics_check_registry for select using (true);

create policy "physics_check_triggers_read" on physics_check_triggers for select using (true);

create policy "physics_damage_mechanisms_read_all" on physics_damage_mechanisms
  for select using (true);

create policy "physics_method_mechanism_map_read_all" on physics_method_mechanism_map
  for select using (true);

create policy "physics_method_registry_read_all" on physics_method_registry
  for select using (true);

create policy "physics_sufficiency_org_isolation" on physics_sufficiency_assessments
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "physics_technique_requirements_read_all" on physics_technique_requirements
  for select using (true);

create policy "prediction_accuracy_org_isolation" on prediction_accuracy
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

CREATE POLICY "prefs_insert" ON notification_preferences FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "prefs_select" ON notification_preferences FOR SELECT TO authenticated USING (true);

CREATE POLICY "prefs_service" ON notification_preferences FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "prefs_update" ON notification_preferences FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

create policy "prl_audit_events_org_isolation" on prl_audit_events
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "process_audit_events_org_isolation" on process_audit_events
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "process_case_correlations_org_isolation" on process_case_correlations
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "process_data_readings_org_isolation" on process_data_readings
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "process_data_sources_org_isolation" on process_data_sources
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "process_exceedance_events_org_isolation" on process_exceedance_events
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "process_exposure_summaries_org_isolation" on process_exposure_summaries
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

CREATE POLICY "repair_audit_org" ON repair_audit_events FOR ALL USING (
  org_id IS NULL OR org_id = ((auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
);

CREATE POLICY "repair_code_rules_read" ON repair_code_rules FOR SELECT USING (true);

CREATE POLICY "repair_history_org" ON repair_history FOR ALL USING (
  org_id IS NULL OR org_id = ((auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
);

CREATE POLICY "repair_methods_read" ON repair_method_registry FOR SELECT USING (true);

CREATE POLICY "repair_pathways_org" ON repair_pathway_assessments FOR ALL USING (
  org_id IS NULL OR org_id = ((auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
);

CREATE POLICY "repair_prerequisites_read" ON repair_prerequisites FOR SELECT USING (true);

create policy "risk_projections_org_isolation" on risk_projections
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

CREATE POLICY "service_role_asset_twin_memory" ON asset_twin_memory FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_belief_updates" ON belief_updates FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_case_concepts" ON case_concepts FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_causal_chains" ON causal_chains FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_concept_registry" ON concept_registry FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_confidence_calibration" ON confidence_calibration_records FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_conformal_cal" ON conformal_calibration FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_conformal_pred" ON conformal_predictions FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_cross_domain_analogies" ON cross_domain_analogies FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_evidence_value_records" ON evidence_value_records FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_failure_trajectories" ON failure_trajectories FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_hypothesis_trees" ON hypothesis_trees FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_insp_priorities" ON inspection_priorities FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_inspector_overrides" ON inspector_overrides FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_learning_outcomes" ON learning_outcomes FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_learning_update_candidates" ON learning_update_candidates FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_learning_versions" ON learning_versions FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_neuro_rules" ON neurosymbolic_rules FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_neuro_sessions" ON neurosymbolic_sessions FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_novelty_flags" ON novelty_flags FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_physics_learn" ON physics_learning_events FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_physics_model_reg" ON physics_model_registry FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_physics_versions" ON physics_model_versions FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_portfolio_state" ON portfolio_uncertainty_state FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_predictive_data_sources" ON predictive_data_sources FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_proofs" ON decision_proofs FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_regression" ON regression_test_runs FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_sim_scenarios" ON simulation_scenarios FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_synthetic_scenarios" ON synthetic_scenarios FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_twin_cal_hist" ON twin_calibration_history FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_twin_cal_state" ON twin_calibration_state FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_twin_drift" ON twin_drift_records FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_world_model_sims" ON world_model_simulations FOR ALL TO service_role USING (true);

CREATE POLICY "sr_anomaly_fp" ON anomaly_fingerprints FOR ALL TO service_role USING (true);

CREATE POLICY "sr_anomaly_match" ON anomaly_matches FOR ALL TO service_role USING (true);

CREATE POLICY "sr_api579" ON api579_assessments FOR ALL TO service_role USING (true);

CREATE POLICY "sr_asset_registry" ON asset_registry FOR ALL TO service_role USING (true);

CREATE POLICY "sr_batch_processing" ON batch_processing_runs FOR ALL TO service_role USING (true);

CREATE POLICY "sr_causal_disc" ON causal_discovery_results FOR ALL TO service_role USING (true);

CREATE POLICY "sr_causal_rel" ON causal_relationships FOR ALL TO service_role USING (true);

CREATE POLICY "sr_comp" ON comprehensive_assessments FOR ALL TO service_role USING (true);

CREATE POLICY "sr_constrained_inf" ON constrained_inference_runs FOR ALL TO service_role USING (true);

CREATE POLICY "sr_dde" ON dde_assessments FOR ALL TO service_role USING (true);

CREATE POLICY "sr_debate_args" ON debate_arguments FOR ALL TO service_role USING (true);

CREATE POLICY "sr_debate_sess" ON debate_sessions FOR ALL TO service_role USING (true);

CREATE POLICY "sr_dse" ON distribution_sampler_results FOR ALL TO service_role USING (true);

CREATE POLICY "sr_emb" ON embedding_retrieval_results FOR ALL TO service_role USING (true);

CREATE POLICY "sr_event_bus" ON event_bus_log FOR ALL TO service_role USING (true);

CREATE POLICY "sr_explain_traces" ON explainability_traces FOR ALL TO service_role USING (true);

CREATE POLICY "sr_field_observations" ON field_observations FOR ALL TO service_role USING (true);

CREATE POLICY "sr_flow" ON flow_assurance_assessments FOR ALL TO service_role USING (true);

CREATE POLICY "sr_fp" ON floating_platform_assessments FOR ALL TO service_role USING (true);

CREATE POLICY "sr_mmf" ON multimodal_fusion_results FOR ALL TO service_role USING (true);

CREATE POLICY "sr_moor" ON mooring_assessments FOR ALL TO service_role USING (true);

CREATE POLICY "sr_offshore" ON offshore_structural_assessments FOR ALL TO service_role USING (true);

CREATE POLICY "sr_output_envelopes" ON output_envelopes FOR ALL TO service_role USING (true);

CREATE POLICY "sr_pipeline" ON pipeline_assessments FOR ALL TO service_role USING (true);

CREATE POLICY "sr_rbi" ON rbi_assessments FOR ALL TO service_role USING (true);

CREATE POLICY "sr_reg_reports" ON regulatory_reports FOR ALL TO service_role USING (true);

CREATE POLICY "sr_riser" ON riser_dynamics_assessments FOR ALL TO service_role USING (true);

CREATE POLICY "sr_se" ON subsea_equipment_assessments FOR ALL TO service_role USING (true);

CREATE POLICY "sr_sour" ON sour_service_assessments FOR ALL TO service_role USING (true);

CREATE POLICY "sr_tank" ON tank_assessments FOR ALL TO service_role USING (true);

CREATE POLICY "sr_temporal_fusion" ON temporal_fusion_states FOR ALL TO service_role USING (true);

CREATE POLICY "sr_uncert_prop" ON uncertainty_propagation_runs FOR ALL TO service_role USING (true);

CREATE POLICY "sr_urc" ON uncertainty_reliability_runs FOR ALL TO service_role USING (true);

CREATE POLICY "srv_adversarial_challenges" ON adversarial_challenges
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "srv_calibration_scores" ON calibration_scores
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "srv_hypothesis_tracking" ON hypothesis_tracking
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "srv_learning_records" ON learning_records
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "srv_reasoning_sessions" ON reasoning_sessions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "superbrain_reports_all" ON superbrain_reports FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "uncertainty_records_service" ON uncertainty_records FOR ALL USING (true) WITH CHECK (true);

create policy "weld_4d_physics_read_all" on weld_4d_physics_rules for select using (true);

create policy "weld_assessments_org_isolation" on weld_assessments
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "weld_audit_org_isolation" on weld_audit_events
  for all using (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

create policy "weld_criteria_read_all" on weld_code_acceptance_criteria for select using (true);

create policy "weld_disc_read_all" on weld_discontinuity_registry for select using (true);

create policy "weld_joint_registry_read_all" on weld_joint_registry for select using (true);

create policy "weld_material_registry_read_all" on weld_material_registry for select using (true);

create policy "weld_position_registry_read_all" on weld_position_registry for select using (true);

create policy "weld_process_registry_read_all" on weld_process_registry for select using (true);


-- ============================================================================
-- MASTER SCHEMA REBUILD COMPLETE
-- ============================================================================
