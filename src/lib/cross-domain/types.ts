// ============================================================
// DEPLOY355 — Cross-Domain Intelligence TypeScript types
// Sprint 1 Foundation
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

export type AssetDomain =
  | "industrial" | "welding" | "ndt" | "coatings" | "corrosion"
  | "subsea" | "marine_vessel" | "port_infrastructure" | "diving"
  | "pipeline" | "pressure_equipment" | "structural"
  | "power_generation" | "other";

export type AssetCriticality = "low" | "moderate" | "high" | "critical" | "life_safety";

export type AssetStatus =
  | "active" | "restricted_service" | "out_of_service"
  | "repair_required" | "retired" | "unknown";

export type RelationshipType =
  | "parent_child" | "connected_to" | "supports" | "protected_by"
  | "coated_by" | "welded_to" | "feeds" | "drains_to" | "adjacent_to"
  | "same_cp_zone" | "same_coating_system" | "same_environment"
  | "same_inspection_circuit" | "operational_dependency" | "failure_dependency";

export interface AssetNode {
  id: string;
  org_id: string;
  asset_key: string | null;
  asset_name: string;
  domain: AssetDomain;
  asset_type: string;
  asset_subtype: string | null;
  parent_asset_id: string | null;
  location_description: string | null;
  gps_lat: number | null;
  gps_lon: number | null;
  material: string | null;
  material_grade: string | null;
  coating_system: string | null;
  design_code: string | null;
  service_environment: string | null;
  operating_conditions: Record<string, unknown>;
  owner: string | null;
  operator: string | null;
  client: string | null;
  install_date: string | null;
  design_life_years: number | null;
  expected_service_life_end: string | null;
  criticality: AssetCriticality;
  status: AssetStatus;
  metadata_jsonb: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AssetRelationship {
  id: string;
  org_id: string;
  source_asset_id: string;
  target_asset_id: string;
  relationship_type: RelationshipType;
  confidence: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface InspectionEvent {
  id: string;
  org_id: string;
  asset_id: string;
  domain: string | null;
  inspection_type: string | null;
  inspection_date: string;
  inspector_name: string | null;
  summary: string | null;
  evidence_quality: "low" | "moderate" | "high" | "verified";
  confidence: number;
  status: "draft" | "in_review" | "approved" | "sealed" | "superseded";
  created_at: string;
  updated_at: string;
}

export interface AssetAnomaly {
  id: string;
  org_id: string;
  asset_id: string;
  inspection_event_id: string | null;
  domain: string | null;
  anomaly_type: string | null;
  mechanism_key: string | null;
  severity: "cat_1_minor" | "cat_2_moderate" | "cat_3_major" | "cat_4_critical";
  description: string;
  authority_status:
    | "acceptable" | "acceptable_with_monitoring" | "hold_for_review"
    | "repair_required" | "block_use" | "insufficient_information";
  status: "open" | "monitoring" | "repaired" | "accepted_by_engineering" | "closed" | "superseded";
  created_at: string;
  updated_at: string;
}

export interface CausalChain {
  id: string;
  org_id: string;
  asset_id: string | null;
  title: string;
  summary: string | null;
  chain_type: "degradation" | "failure_pathway" | "operational_breakdown" | "inspection_gap" | "repair_priority" | "unknown";
  chain_steps: unknown[];
  confidence: number;
  created_at: string;
  updated_at: string;
}

export interface AssetTimelineEvent {
  id: string;
  org_id: string;
  asset_id: string;
  event_type: string;
  event_date: string;
  title: string;
  description: string | null;
  severity: string | null;
  created_at: string;
}

export interface AssetGraphResult {
  asset: AssetNode | null;
  parents: AssetNode[];
  children: AssetNode[];
  protected_by: AssetNode[];
  coating_systems: AssetNode[];
  cp_zones: AssetNode[];
  connected_assets: AssetNode[];
  weld_connections: AssetNode[];
  inspection_history: InspectionEvent[];
  anomaly_history: AssetAnomaly[];
  causal_chains: CausalChain[];
  timeline: AssetTimelineEvent[];
}

export interface AICostInfo {
  orgId: string | null;
  supabaseAdmin: SupabaseClient;
}

export interface SpecialistOutput {
  role: SpecialistRole;
  model: string;
  ok: boolean;
  response: string | null;
  latency_ms: number;
  attempts: number;
  cost: {
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    request_id: string | null;
    code_name: string;
    smoke_test: boolean;
  };
  error?: string;
}

export type SpecialistRole =
  | "inspector"
  | "engineer"
  | "researcher"
  | "devils_advocate"
  | "historian"
  | "synthesizer";

export interface SpecialistCallContext {
  cost?: AICostInfo;
}

// ============================================================
// Sprint 2 — Deliberation contracts
// ============================================================

export interface AnomalyContext {
  id: string;
  asset_id: string;
  description: string;
  severity: AssetAnomaly["severity"];
  observed_at: string;
  mechanism_key?: string | null;
}

export interface AssetContext {
  id: string;
  asset_name: string;
  asset_type: string;
  domain: AssetDomain;
  material: string | null;
  service_environment: string | null;
  criticality: AssetCriticality;
  age_years: number | null;
}

export interface EvidenceItem {
  id: string;
  evidence_type: string;
  source: string;
  reliability_weight: number | null;
  captured_at: string | null;
  raw_text: string | null;
  structured_jsonb: Record<string, unknown> | null;
  confidence: number | null;
}

export interface DegradationMechanismRef {
  mechanism_key: string;
  display_name: string;
  category: string;
}

export interface Claim {
  text: string;
  confidence: number; // 0..1
  supporting_evidence_ids: string[];
  cited_mechanism_codes: string[];
}

// Sprint 4B: a single external source cited by a specialist that has
// web access. Only Researcher populates this today; other specialists
// leave cited_sources undefined. Captured from the Anthropic mixed-
// content response (web_search_tool_result blocks) so we can audit
// what the model actually read.
export interface ExternalSource {
  url: string;
  title?: string;
  // Short excerpt the model used (Anthropic's web_search returns
  // encrypted_content; we surface whatever readable snippet is present).
  snippet?: string;
  // Extracted hostname, e.g. "asme.org". Convenient for grouping in
  // the UI without re-parsing URLs.
  domain?: string;
  // The query the model issued that surfaced this result. Links a
  // result back to a server_tool_use block via tool_use_id.
  search_query?: string;
  // Anthropic sometimes returns a page_age string (e.g. "2024-08-15"
  // or "3 months ago"). Pass through as-is.
  page_age?: string;
}

export interface SpecialistAnalysis {
  role: SpecialistRole;
  model: string;
  summary: string;
  claims: Claim[];
  open_questions: string[];
  cited_mechanisms: string[];
  cited_evidence: string[];
  cost_usd: number;
  latency_ms: number;
  attempts: number;
  raw_response: string;
  // Populated when the model returned content but it didn't parse
  // against the SpecialistAnalysis schema. Empty / undefined on success.
  // Sprint 3.2 added so we never silently discard model output again.
  parse_error?: string;
  // Sprint 4B: external sources the specialist cited via server-side
  // tools (web_search). Only Researcher populates this today; other
  // specialists leave it undefined. Empty array means the specialist
  // had tool access but the model decided not to search — that's a
  // valid outcome, not an error.
  cited_sources?: ExternalSource[];
  // Sprint 4B: count of web_search invocations observed in the response.
  // 0 means tools were enabled but the model didn't search. Undefined
  // means tools weren't enabled for this specialist.
  searches_performed?: number;
}

// Sprint 4A: AnalogousCase is now sourced from vector retrieval over
// cd_tenant_memory_index. The previous shape (inspection_event_id,
// inspection_date, …) was a Sprint 2 placeholder that read raw
// cd_inspection_events rows. The new shape exposes the originating
// deliberation + anomaly so the Historian can reason about prior
// reasoning, not just prior inspection records.
//
// SCHEMA NOTE: cd_tenant_memory_index has no source_deliberation_id
// column — the deliberation id is stored inside context_jsonb. The
// retrieval module projects it back out so callers see a flat shape.
export interface AnalogousCase {
  source_deliberation_id: string;
  source_anomaly_id: string | null;
  record_type: "synthesis_summary" | "specialist_claim" | string;
  text_content: string;
  similarity: number;
  metadata: Record<string, unknown>;
  cited_mechanisms: string[];
  created_at: string;
}

// Sprint 4A: a single row in cd_tenant_memory_index as written by
// memoryIngest. The schema's `memory_type` is a CHECK-enum
// ('recurring_mechanism'|'analogous_case'|'pattern_observation'|
// 'calibration_outcome'); the finer-grained record_type ('synthesis_summary'
// | 'specialist_claim') lives in context_jsonb because no dedicated
// column exists.
export type EmbeddingProvider = "openai";

export interface MemoryRecord {
  id?: string;
  org_id: string;
  memory_type:
    | "recurring_mechanism"
    | "analogous_case"
    | "pattern_observation"
    | "calibration_outcome";
  asset_id: string | null;
  anomaly_id: string | null;
  concept_key: string | null;
  summary: string;
  context_jsonb: Record<string, unknown>;
  embedding: number[];
  reinforcement_count?: number;
  last_retrieved_at?: string | null;
  created_at?: string;
}

export interface DeliberationInput {
  anomaly: AnomalyContext;
  asset: AssetContext;
  evidence: EvidenceItem[];
  priorAnalyses: SpecialistAnalysis[];
  mechanismVocabulary: DegradationMechanismRef[];
  analogousCases?: AnalogousCase[]; // Sprint 2 placeholder for historian; Sprint 4 → vector retrieval
  causalChain?: CausalChainResult; // injected after Engineer for downstream specialists
}

export interface ArbitrationDecision {
  status: "accepted" | "flagged_dissent" | "rejected_low_confidence";
  reason: string;
  devils_advocate_objections_addressed: number;
  devils_advocate_objections_unresolved: number;
}

export interface CausalChainStateNode {
  state: string;
  estimated_days_to_state: number | null;
}

export interface CausalChainResult {
  ok: boolean;
  reason?: string;
  causal_chain_id: string | null;
  primary_mechanism: {
    code: string;
    name: string;
    fit_score: number;
    reasoning: string;
  } | null;
  ranked_alternatives: Array<{
    code: string;
    name: string;
    fit_score: number;
  }>;
  failure_path: CausalChainStateNode[];
  confidence: number;
}

export interface DeliberationResult {
  deliberation_id: string;
  ok: boolean;
  arbitration: ArbitrationDecision;
  synthesizer_output: SpecialistAnalysis | null;
  causal_chain: CausalChainResult | null;
  total_cost_usd: number;
  total_latency_ms: number;
  per_specialist: SpecialistAnalysis[];
  aborted_reason?:
    | "engineer_failed"
    | "synthesizer_failed"
    | "per_deliberation_cap_exceeded"
    | "org_daily_cap_exceeded";
}
