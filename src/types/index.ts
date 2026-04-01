export type NDTMethod = "VT" | "PT" | "MT" | "UT" | "RT" | "ET";

export type CaseStatus =
  | "draft"
  | "evidence_uploaded"
  | "normalized"
  | "vision_complete"
  | "reasoning_complete"
  | "truth_resolved"
  | "finalized"
  | "adjudicated";

export type FinalDisposition =
  | "accept"
  | "reject"
  | "review_required"
  | "inconclusive"
  | "monitor";

export interface InspectionCase {
  id: string;
  org_id: string;
  project_id: string | null;
  asset_id: string | null;
  case_number: string;
  title: string;
  method: NDTMethod;
  status: CaseStatus;
  component_name: string | null;
  weld_id: string | null;
  joint_type: string | null;
  thickness_mm: number | null;
  material_class: string;
  load_condition: string;
  code_family: string | null;
  code_edition: string | null;
  code_section: string | null;
  acceptance_table: string | null;
  procedure_ref: string | null;
  inspector_ref: string | null;
  energy_type: string;
  interaction_type: string;
  response_type: string;
  time_dimension_type: string;
  ai_openai_summary: string | null;
  ai_claude_summary: string | null;
  truth_engine_summary: string | null;
  final_disposition: FinalDisposition | null;
  final_decision_reason: string | null;
  final_confidence: number | null;
  ffs_applicable: boolean;
  remaining_life_years: number | null;
  adjudication_required: boolean;
  adjudication_status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Evidence {
  id: string;
  case_id: string;
  evidence_type: string;
  storage_path: string | null;
  mime_type: string | null;
  filename: string | null;
  uploaded_by: string;
  capture_source: string | null;
  metadata_json: Record<string, any>;
  created_at: string;
}

export interface Finding {
  id: string;
  case_id: string;
  source: string;
  finding_type: string;
  label: string;
  location_ref: string | null;
  severity: string | null;
  confidence: number | null;
  structured_json: Record<string, any>;
  created_at: string;
}

export interface RuleEvaluation {
  id: string;
  case_id: string;
  rule_key: string;
  rule_name: string;
  method: string;
  passed: boolean | null;
  rule_class: string;
  explanation: string;
  engineering_basis_cited: string | null;
  created_at: string;
}

export interface PhysicsModel {
  id: string;
  case_id: string;
  material_properties_json: Record<string, any>;
  geometry_json: Record<string, any>;
  process_context_json: Record<string, any>;
  service_context_json: Record<string, any>;
  probable_discontinuities_json: any[];
  method_capability_map_json: Record<string, any>;
  model_version: string;
  created_at: string;
}

export interface CreateCaseInput {
  title: string;
  method: NDTMethod;
  material_class?: string;
  load_condition?: string;
  code_family?: string;
  code_edition?: string;
  code_section?: string;
  acceptance_table?: string;
  component_name?: string;
  weld_id?: string;
  joint_type?: string;
  thickness_mm?: number;
  procedure_ref?: string;
  inspector_ref?: string;
  asset_tag?: string;
}
