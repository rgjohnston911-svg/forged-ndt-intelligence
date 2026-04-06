// ============================================================================
// FORGED NDT INTELLIGENCE OS — HARDENING TYPES v1.0
// Sprint 1: Reality Challenge Engine + Unknown State Engine
// ============================================================================

// ============================================================================
// MODULE 1 — REALITY CHALLENGE ENGINE
// ============================================================================

export interface RealityHypothesis {
  asset_class: string;
  scenario_type: string;
  finding_frame: string;
  mechanism_frame: string;
  confidence: number;
  basis: string[];
}

export interface AlternateHypothesis {
  hypothesis_id: string;
  asset_class: string;
  scenario_type: string;
  finding_frame: string;
  mechanism_frame: string;
  confidence: number;
  risk_bias: 'lower' | 'equal' | 'higher';
  basis: string[];
}

export interface HighestRiskHypothesis {
  hypothesis_id: string;
  reason: string;
  risk_bias: 'higher';
  confidence: number;
}

export interface RealityChallengeResult {
  primary_reality_hypothesis: RealityHypothesis;
  alternate_hypotheses: AlternateHypothesis[];
  highest_risk_plausible_hypothesis: HighestRiskHypothesis | null;
  ambiguity_flags: string[];
  ambiguity_score: number;
  challenge_triggered: boolean;
  reality_lock_recommendation:
    | 'accept_primary'
    | 'accept_with_guard'
    | 'defer_to_unknown'
    | 'escalate_for_more_data';
  challenge_reasoning_trace: string[];
}

// ============================================================================
// MODULE 2 — UNKNOWN STATE + MINIMUM DATA ENGINE
// ============================================================================

export type RealityState =
  | 'CONFIRMED'
  | 'PROBABLE'
  | 'POSSIBLE'
  | 'UNVERIFIED'
  | 'UNKNOWN'
  | 'UNRESOLVABLE_WITH_CURRENT_DATA';

export interface MinimumDataItem {
  question: string;
  required_data: string;
  preferred_method: string;
  reason: string;
  priority: 'critical' | 'high' | 'medium';
}

export interface NextBestInspectionAction {
  action_id: string;
  method: string;
  target: string;
  purpose: string;
  release_condition: string;
}

export interface UnknownStateResult {
  reality_state: RealityState;
  unknown_triggered: boolean;
  unknown_reason_codes: string[];
  unresolved_questions: string[];
  blocked_questions: string[];
  minimum_data_required: MinimumDataItem[];
  next_best_inspection_actions: NextBestInspectionAction[];
  unknown_blocks_final_disposition: boolean;
}

// ============================================================================
// TRUSTED FACT (used by Adversarial Validation and persisted)
// ============================================================================

export interface TrustedFact {
  field: string;
  value: string;
  provenance: string;
  trust_weight: number;
}

// ============================================================================
// HARDENING SNAPSHOT (maps to case_hardening_snapshots table)
// ============================================================================

export interface HardeningSnapshot {
  id?: string;
  case_id: string;
  run_id: string;
  challenge_result: RealityChallengeResult;
  unknown_state_result: UnknownStateResult;
  interaction_result?: any;
  authority_conflict_result?: any;
  decision_gradient_result?: any;
  mesh_result?: any;
  evolution_result?: any;
  adversarial_validation_result?: any;
  created_at?: string;
}

// ============================================================================
// FUTURE MODULE STUBS (Phase 2+)
// ============================================================================

export interface MechanismInteractionResult {
  interaction_detected: boolean;
  interaction_pairs: Array<{
    mechanism_a: string;
    mechanism_b: string;
    interaction_type: 'synergy' | 'suppression' | 'conflict' | 'cascade';
    amplification_score: number;
    explanation: string;
  }>;
  interaction_amplification_score: number;
  interaction_adjusted_mechanism_scores: Array<{
    mechanism: string;
    base_score: number;
    adjusted_score: number;
    interaction_modifier: number;
  }>;
  interaction_consequence_modifier: number;
  interaction_growth_modifier: number;
  interaction_reasoning_trace: string[];
}

export interface AuthorityConflictResult {
  conflict_detected: boolean;
  conflict_type: string | null;
  authority_stack: Array<{
    rank: number;
    authority_basis:
      | 'life_safety'
      | 'physics_reality'
      | 'consequence_severity'
      | 'governing_code'
      | 'engineering_review'
      | 'owner_user_program'
      | 'workflow_preference';
    description: string;
    dominant: boolean;
  }>;
  governing_codes: string[];
  engineering_review_required: boolean;
  escalation_required: boolean;
  dominant_authority_basis: string;
  conflict_resolution_reason: string;
  authority_trace: string[];
}

export interface DecisionGradientResult {
  decision_class:
    | 'GO'
    | 'CONDITIONAL_GO'
    | 'ENGINEERING_HOLD'
    | 'INSPECTION_HOLD'
    | 'NO_GO';
  hold_basis: string | null;
  release_conditions: string[];
  temporary_controls: string[];
  required_validation: string[];
  hold_blocks_case_closure: boolean;
  decision_gradient_trace: string[];
}

export interface RealityEvolutionResult {
  evolution_enabled: boolean;
  current_damage_state: string;
  projected_damage_state_7d: string | null;
  projected_damage_state_30d: string | null;
  projected_damage_state_90d: string | null;
  time_to_threshold_estimate_days: number | null;
  projected_failure_risk_curve: Array<{
    day: number;
    risk_score: number;
    confidence: number;
  }>;
  urgency_escalation_basis: string[];
  model_assumptions: string[];
  model_limitations: string[];
  evolution_trace: string[];
}
