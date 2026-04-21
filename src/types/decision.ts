/**
 * DEPLOY224 - Shared Decision Types
 * src/types/decision.ts
 *
 * Type interfaces for the decision pipeline:
 *   - Decision State Machine (DEPLOY220)
 *   - Unified Confidence (DEPLOY220)
 *   - Conceptual Reasoning (DEPLOY220)
 *   - Outcome Simulation (DEPLOY221)
 *   - Code Authority (DEPLOY222)
 *   - Enterprise Audit (DEPLOY223)
 *   - Inspector Adjudication (DEPLOY226)
 *
 * These types are imported by safety-critical functions
 * that have @ts-nocheck removed.
 */

// ================================================================
// DEPLOY220: Decision State Machine
// ================================================================
export type DecisionState =
  | "pending"
  | "blocked"
  | "provisional"
  | "advisory"
  | "authority_locked";

export type OODFlag =
  | "in_distribution"
  | "marginal"
  | "out_of_distribution"
  | "unknown";

export interface ConfidenceComponents {
  authority_confidence: number;
  physics_coverage: number;
  ood_flag: OODFlag;
  ood_discount: number;
  unified_confidence: number;
}

export interface ConceptLayer {
  concept: string;
  status: string;
  evidence: string[];
  reasoning: string;
}

export interface ConceptualReasoning {
  physical_reality: ConceptLayer;
  damage_reality: ConceptLayer;
  consequence_reality: ConceptLayer;
  authority_reality: ConceptLayer;
  sufficiency_reality: ConceptLayer;
  decision_reality: ConceptLayer;
}

export interface DecisionStateResult {
  state: DecisionState;
  reason: string;
  blockers: string[];
  unified_confidence: number;
  confidence_components: ConfidenceComponents;
  conceptual_reasoning: ConceptualReasoning;
}

// ================================================================
// DEPLOY221: Outcome Simulation
// ================================================================
export type ScenarioType = "do_nothing" | "monitor" | "repair_now";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface TimelinePoint {
  months: number;
  thickness: number;
  pct_nominal: number;
  risk: RiskLevel;
  below_tmin: boolean;
}

export interface Scenario {
  type: ScenarioType;
  label: string;
  rate_mpy: number;
  timeline: TimelinePoint[];
  failure_month: number | null;
  notes: string;
}

export interface CrackProjection {
  initial_length: number;
  projections: Array<{
    months: number;
    length: number;
    growth_pct: number;
  }>;
}

export interface PittingProjection {
  initial_depth: number;
  projections: Array<{
    months: number;
    depth: number;
    growth_pct: number;
  }>;
}

export interface OutcomeSimulation {
  engine: string;
  execution_mode: string;
  corrosion_data: {
    nominal_thickness: number;
    min_thickness: number;
    t_min: number;
    rate_mpy: number;
    rate_source: string;
  };
  scenarios: Scenario[];
  crack_growth: CrackProjection | null;
  pitting_growth: PittingProjection | null;
  summary: string;
}

// ================================================================
// DEPLOY222: Code Authority
// ================================================================
export type AuthorityLevel =
  | "regulatory"
  | "jurisdictional"
  | "code_authoritative"
  | "provisional"
  | "advisory";

export type CodeRole = "primary" | "supplementary" | "reference";

export interface GoverningCode {
  code_id: string;
  name: string;
  short_name: string;
  tier: number;
  tier_label: string;
  role: CodeRole;
  clause_count: number;
  match_reasons: string[];
}

export interface ApplicableClause {
  code_id: string;
  code_name: string;
  clause: string;
  title: string;
  trigger: string;
  role: CodeRole;
}

export interface CodeConflict {
  tier: number;
  tier_label: string;
  codes: string[];
  resolution: string;
  explanation: string;
}

export interface CodeAuthorityResult {
  engine: string;
  execution_mode: string;
  generated_at: string;
  case_id: string;
  precedence_hierarchy: Array<{
    code_id: string;
    name: string;
    short_name: string;
    tier: number;
    tier_label: string;
    match_reasons: string[];
  }>;
  conflicts: CodeConflict[];
  governing_codes: GoverningCode[];
  applicable_clauses: ApplicableClause[];
  authority_level: {
    level: AuthorityLevel;
    reason: string;
  };
  highest_tier: number | null;
  highest_tier_label: string;
  summary: string;
}

// ================================================================
// DEPLOY223: Enterprise Audit
// ================================================================
export type ActorType = "user" | "system";

export type EventCategory =
  | "case_lifecycle"
  | "evidence"
  | "findings"
  | "decision"
  | "prediction"
  | "material"
  | "repair"
  | "analysis"
  | "planning"
  | "audit"
  | "adjudication"
  | "custom";

export interface AuditEvent {
  id: string;
  case_id: string;
  event_type: string;
  event_category: EventCategory;
  actor_type: ActorType;
  actor_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  detail: Record<string, any>;
  execution_mode: string;
  function_name: string | null;
  created_at: string;
}

export interface AuditBundle {
  id: string;
  case_id: string;
  bundle_version: number;
  bundle_data: Record<string, any>;
  bundle_hash: string;
  previous_hash: string | null;
  signature: string;
  signing_key_id: string;
  signed_by_user_id: string | null;
  signed_by_email: string | null;
  signed_at: string;
  chain_valid: boolean;
}

export interface ChainVerificationResult {
  bundle_version: number;
  overall: "VERIFIED" | "FAILED";
  checks: {
    hash_integrity: { passed: boolean; detail: string };
    signature_valid: { passed: boolean; detail: string };
    chain_link: { passed: boolean; detail: string };
    version_sequence: { passed: boolean; detail: string };
  };
}

// ================================================================
// DEPLOY226: Inspector Adjudication
// ================================================================
export type AdjudicationType = "concur" | "override" | "escalate";

export interface InspectorAdjudication {
  id: string;
  case_id: string;
  inspector_id: string;
  inspector_email: string;
  inspector_name: string | null;
  adjudication_type: AdjudicationType;
  system_decision_state: DecisionState;
  system_confidence: number;
  system_disposition: string | null;
  override_decision: string | null;
  override_disposition: string | null;
  rationale: string;
  evidence_references: string[];
  created_at: string;
}

// ================================================================
// SHARED: Execution Mode
// ================================================================
export type ExecutionMode = "deterministic" | "ai_assisted" | "hybrid";

export interface EngineResponse {
  engine: string;
  execution_mode: ExecutionMode;
  generated_at: string;
  case_id: string;
}
