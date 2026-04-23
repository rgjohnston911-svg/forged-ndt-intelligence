// @ts-nocheck
/**
 * DEPLOY286 - external-interaction-engine.ts
 * netlify/functions/external-interaction-engine.ts
 *
 * EXTERNAL INTERACTION & TRAUMA ENGINE
 *
 * Anchor strikes, trawl impacts, dropped objects, ROV collisions,
 * scour, debris. Damage signature mapping. Immediate vs latent damage.
 * Entanglement load modeling.
 *
 * Klein Bottle: a single impact event creates immediate visible damage
 * AND latent invisible damage. The dent is also a coating breach, a CP
 * disruption, a fatigue initiation site, and a corrosion accelerator.
 * One event, one continuous surface of consequence.
 *
 * POST /api/external-interaction-engine
 *
 * Actions:
 *   evaluate_event          — full external event assessment
 *   map_damage_signature    — event type to expected damage patterns
 *   classify_immediate_latent — separate immediate vs latent effects
 *   evaluate_entanglement   — sustained entanglement load assessment
 *   assess_scour            — scour exposure assessment
 *   get_event_registry      — all event types
 *   get_registry            — engine metadata
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var ENGINE_ID = "external-interaction-engine";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY286";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

// ============================================================
// EXTERNAL EVENT TYPES
// ============================================================

var EVENT_TYPES = {
  anchor_strike: {
    category: "anchor_vessel",
    name: "Anchor Strike",
    severity_range: "high_to_catastrophic",
    energy_level: "very_high",
    description: "Direct impact from vessel anchor. Can cause severe deformation, rupture, or complete member severance.",
    immediate_damage: ["severe_denting", "member_deformation", "coating_destruction", "possible_rupture", "weld_cracking"],
    latent_damage: ["fatigue_initiation_at_dent", "CP_disruption", "corrosion_acceleration", "load_path_change", "residual_stress"],
    typical_indicators: ["large_deformation", "gouge_marks", "displaced_members", "coating_loss_pattern"],
    structural_criticality: "critical",
    requires_immediate_assessment: true
  },
  anchor_drag: {
    category: "anchor_vessel",
    name: "Anchor Drag / Chain Drag",
    severity_range: "moderate_to_high",
    energy_level: "high_sustained",
    description: "Anchor or chain dragged across asset. Creates long gouges, sustained loading.",
    immediate_damage: ["long_gouges", "coating_loss_linear", "denting", "member_misalignment", "clamp_damage"],
    latent_damage: ["fatigue_at_gouge_base", "corrosion_at_coating_loss", "CP_disruption_along_track", "stress_concentration_at_gouge"],
    typical_indicators: ["linear_gouge_marks", "directional_coating_loss", "displaced_appurtenances"],
    structural_criticality: "high",
    requires_immediate_assessment: true
  },
  vessel_collision: {
    category: "anchor_vessel",
    name: "Vessel Collision / Allision",
    severity_range: "high_to_catastrophic",
    energy_level: "extreme",
    description: "Direct vessel contact with structure. Massive energy transfer.",
    immediate_damage: ["major_deformation", "member_buckling", "weld_failure", "complete_member_loss", "topside_damage"],
    latent_damage: ["global_structural_redistribution", "foundation_overload", "multiple_fatigue_sites", "system_integrity_compromise"],
    typical_indicators: ["large_scale_deformation", "paint_transfer", "displaced_structure"],
    structural_criticality: "catastrophic",
    requires_immediate_assessment: true
  },
  trawl_impact: {
    category: "fishing",
    name: "Trawl Board Impact",
    severity_range: "moderate",
    energy_level: "moderate",
    description: "Impact from trawl board or fishing gear. Localized damage.",
    immediate_damage: ["localized_denting", "coating_loss", "small_member_deformation"],
    latent_damage: ["fatigue_initiation", "corrosion_at_impact", "CP_local_disruption"],
    typical_indicators: ["impact_marks", "localized_coating_loss", "slight_deformation"],
    structural_criticality: "moderate",
    requires_immediate_assessment: false
  },
  net_entanglement: {
    category: "fishing",
    name: "Net / Line Entanglement",
    severity_range: "moderate_to_high",
    energy_level: "sustained_dynamic",
    description: "Fishing net, rope, or line wrapped around structure. Creates sustained dynamic loading from current.",
    immediate_damage: ["abrasion", "coating_loss_circumferential", "minor_deformation"],
    latent_damage: ["sustained_cyclic_loading", "fatigue_from_dynamic_drag", "torsional_stress", "bending_stress", "progressive_coating_loss"],
    typical_indicators: ["circumferential_abrasion", "material_wrapped_around_member", "cyclic_movement_visible"],
    structural_criticality: "high",
    requires_immediate_assessment: true,
    special_note: "Entanglement is a DYNAMIC load, not static contact. Current makes it oscillate. Treat as ongoing fatigue source until removed."
  },
  repeated_snagging: {
    category: "fishing",
    name: "Repeated Snagging / Contact",
    severity_range: "low_to_moderate",
    energy_level: "low_repeated",
    description: "Multiple minor contacts over time from fishing activity.",
    immediate_damage: ["cumulative_coating_loss", "surface_abrasion"],
    latent_damage: ["progressive_coating_degradation", "corrosion_at_contact_points", "fatigue_from_repeated_loading"],
    typical_indicators: ["wear_patterns", "coating_loss_in_fishing_corridor"],
    structural_criticality: "low_to_moderate",
    requires_immediate_assessment: false
  },
  dropped_object: {
    category: "operations",
    name: "Dropped Object",
    severity_range: "moderate_to_catastrophic",
    energy_level: "variable_height_dependent",
    description: "Object dropped from platform or vessel. Energy depends on mass and fall height.",
    immediate_damage: ["localized_dent", "coating_loss", "possible_crack_initiation", "member_crushing", "component_destruction"],
    latent_damage: ["fatigue_at_dent_edge", "corrosion_at_impact", "hidden_crack_growth", "stress_concentration"],
    typical_indicators: ["impact_crater", "deformation_pattern", "debris_field"],
    structural_criticality: "variable",
    requires_immediate_assessment: true
  },
  rov_collision: {
    category: "operations",
    name: "ROV Collision / Tool Impact",
    severity_range: "low_to_moderate",
    energy_level: "low",
    description: "Inadvertent ROV contact or tool impact during subsea operations.",
    immediate_damage: ["minor_coating_loss", "small_dent", "component_displacement"],
    latent_damage: ["corrosion_at_coating_loss", "minor_CP_disruption"],
    typical_indicators: ["small_impact_marks", "displaced_small_components"],
    structural_criticality: "low",
    requires_immediate_assessment: false
  },
  installation_damage: {
    category: "operations",
    name: "Installation Damage",
    severity_range: "moderate_to_high",
    energy_level: "variable",
    description: "Damage occurring during installation, hook-up, or commissioning.",
    immediate_damage: ["coating_damage", "denting", "misalignment", "weld_damage", "bolt_damage"],
    latent_damage: ["pre_service_fatigue_damage", "residual_stress", "corrosion_from_day_one"],
    typical_indicators: ["damage_inconsistent_with_service_age", "pre_existing_condition"],
    structural_criticality: "moderate_to_high",
    requires_immediate_assessment: false
  },
  debris_impact: {
    category: "environmental",
    name: "Debris Impact (Marine / Storm)",
    severity_range: "low_to_moderate",
    energy_level: "variable",
    description: "Impact from marine debris, containers, or storm-driven objects.",
    immediate_damage: ["localized_damage", "coating_loss", "minor_deformation"],
    latent_damage: ["corrosion_at_impact", "entanglement_if_debris_lodged"],
    typical_indicators: ["random_impact_marks", "lodged_debris"],
    structural_criticality: "low_to_moderate",
    requires_immediate_assessment: false
  },
  scour: {
    category: "environmental",
    name: "Scour / Seabed Erosion",
    severity_range: "moderate_to_high",
    energy_level: "gradual",
    description: "Seabed erosion exposing buried sections. Changes load path and exposes previously protected surfaces.",
    immediate_damage: ["exposure_of_buried_sections", "loss_of_lateral_support"],
    latent_damage: ["corrosion_of_newly_exposed_steel", "fatigue_from_changed_load_path", "free_span_creation", "VIV_initiation"],
    typical_indicators: ["seabed_depression", "exposed_pile_length", "visible_previously_buried_sections"],
    structural_criticality: "high",
    requires_immediate_assessment: true,
    special_note: "Scour can instantly change an asset's structural model. A pile that was supported by soil is now a cantilever. A pipeline that was buried is now a free span."
  },
  seabed_movement: {
    category: "environmental",
    name: "Seabed Movement / Slope Instability",
    severity_range: "high_to_catastrophic",
    energy_level: "massive",
    description: "Large-scale seabed movement, submarine landslide, or liquefaction.",
