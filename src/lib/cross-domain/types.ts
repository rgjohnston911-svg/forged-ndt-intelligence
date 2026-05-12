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

export interface SpecialistOutput<T = unknown> {
  role: SpecialistRole;
  model: string;
  ok: boolean;
  result: T;
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
