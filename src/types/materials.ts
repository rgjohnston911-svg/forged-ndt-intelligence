/**
 * DEPLOY224 - Shared Material & Inspection Types
 * src/types/materials.ts
 *
 * Type interfaces for material science and inspection domains.
 */

// ================================================================
// Material Classifications
// ================================================================
export type MaterialFamily =
  | "carbon_steel"
  | "low_alloy_steel"
  | "stainless_steel"
  | "duplex_stainless"
  | "nickel_alloy"
  | "copper_alloy"
  | "aluminum"
  | "titanium"
  | "cast_iron"
  | "composite"
  | "concrete"
  | "unknown";

export type DamageMechanism =
  | "general_corrosion"
  | "pitting"
  | "crevice_corrosion"
  | "galvanic_corrosion"
  | "erosion_corrosion"
  | "mic"
  | "stress_corrosion_cracking"
  | "hydrogen_induced_cracking"
  | "sulfide_stress_cracking"
  | "fatigue_cracking"
  | "creep"
  | "embrittlement"
  | "caustic_cracking"
  | "co2_corrosion"
  | "naphthenic_acid"
  | "high_temp_oxidation"
  | "carburization"
  | "decarburization"
  | "graphitization"
  | "temper_embrittlement"
  | "sigma_phase"
  | "weld_decay"
  | "dealloying"
  | "cavitation"
  | "mechanical_damage"
  | "unknown";

// ================================================================
// Asset Types
// ================================================================
export type AssetType =
  | "pressure_vessel"
  | "heat_exchanger"
  | "storage_tank"
  | "process_piping"
  | "pipeline"
  | "boiler"
  | "reactor_vessel"
  | "steam_generator"
  | "nuclear_piping"
  | "structural_steel"
  | "aircraft_structure"
  | "engine_component"
  | "marine_vessel"
  | "offshore_fixed_platform"
  | "offshore_floating_facility"
  | "bridge_civil_structure"
  | "additive_manufactured"
  | "unknown";

// ================================================================
// Inspection
// ================================================================
export type InspectionPriority = "routine" | "elevated" | "urgent" | "emergency";

export interface ThicknessSummary {
  nominal: number;
  min_measured: number;
  max_measured: number;
  avg_measured: number;
  reading_count: number;
  pct_min: number;
  pct_avg: number;
  unit: "in" | "mm";
}

export interface MaterialAuthorityResult {
  engine: string;
  execution_mode: string;
  material_class: string;
  material_family: MaterialFamily;
  verified: boolean;
  status: "verified" | "suspect" | "failed" | "unknown";
  mechanisms: DamageMechanism[];
  susceptibility_factors: string[];
  recommendations: string[];
}

// ================================================================
// Code Standards
// ================================================================
export interface CodeSet {
  id: string;
  name: string;
  short_name: string;
  region: string;
  industry: string;
  tier: number;
  asset_types: AssetType[];
  material_classes: string[];
  description: string;
}

export type CodeTier = 1 | 2 | 3 | 4 | 5;

export interface CodeTierInfo {
  tier: CodeTier;
  label: string;
  authority: string;
}

export var CODE_TIERS: CodeTierInfo[] = [
  { tier: 1, label: "Regulatory Authority", authority: "Legal mandate — NRC, FAA, OSHA, PHMSA" },
  { tier: 2, label: "Jurisdictional Law", authority: "State/local law — NBIC, boiler codes" },
  { tier: 3, label: "Industry Consensus Code", authority: "Recognized standard — API, ASME, DNV, AWS" },
  { tier: 4, label: "Owner/Operator Specification", authority: "Company-specific requirements" },
  { tier: 5, label: "Best Practice Standard", authority: "Guidelines — ISO, ASTM general" }
];
