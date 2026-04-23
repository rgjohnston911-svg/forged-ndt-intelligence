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
    immediate_damage: ["foundation_displacement", "pipeline_displacement", "structural_misalignment"],
    latent_damage: ["ongoing_creep_movement", "progressive_misalignment", "cyclic_loading_from_settlement"],
    typical_indicators: ["survey_position_change", "tilt_monitoring_change", "pipeline_displacement"],
    structural_criticality: "catastrophic",
    requires_immediate_assessment: true
  }
};

// ============================================================
// DAMAGE SEVERITY CLASSIFICATION
// ============================================================

var DAMAGE_SEVERITY = {
  negligible: { level: 1, name: "Negligible", description: "Cosmetic only. No structural or protection impact.", action: "Record and monitor" },
  minor: { level: 2, name: "Minor", description: "Coating damage only. No structural deformation.", action: "Plan coating repair. Monitor corrosion." },
  moderate: { level: 3, name: "Moderate", description: "Measurable deformation or significant coating loss. No immediate structural concern.", action: "Detailed inspection. Engineering assessment. Plan repair." },
  significant: { level: 4, name: "Significant", description: "Structural deformation affecting load capacity. Multiple protection barriers compromised.", action: "Priority engineering assessment. Restrict operations if needed." },
  severe: { level: 5, name: "Severe", description: "Major structural damage. Possible crack initiation. Load path compromised.", action: "URGENT engineering assessment. Consider shutdown of affected system." },
  catastrophic: { level: 6, name: "Catastrophic", description: "Member failure or rupture. Loss of containment risk. Structural collapse risk.", action: "EMERGENCY response. Shutdown. Evacuate if personnel at risk." }
};

// ============================================================
// CORE FUNCTIONS
// ============================================================

function evaluateEvent(input) {
  var eventType = input.event_type;
  var eventDef = EVENT_TYPES[eventType];

  if (!eventDef) {
    return { error: "Unknown event type. Available: " + Object.keys(EVENT_TYPES).join(", ") };
  }

  var assetType = input.asset_type || "unknown";
  var zone = input.zone || "submerged";
  var damageDescription = input.damage_description || "";
  var dent_depth_mm = input.dent_depth_mm || 0;
  var member_diameter_mm = input.member_diameter_mm || 500;
  var wall_thickness_mm = input.wall_thickness_mm || 20;
  var structuralRole = input.structural_role || "secondary";

  var dentRatio = member_diameter_mm > 0 ? dent_depth_mm / member_diameter_mm : 0;
  var dentWallRatio = wall_thickness_mm > 0 ? dent_depth_mm / wall_thickness_mm : 0;

  var severity = "minor";
  if (dentRatio > 0.1 || eventDef.structural_criticality === "catastrophic") severity = "catastrophic";
  else if (dentRatio > 0.05 || eventDef.structural_criticality === "critical") severity = "severe";
  else if (dentRatio > 0.03 || dentWallRatio > 2) severity = "significant";
  else if (dentRatio > 0.01 || dentWallRatio > 1) severity = "moderate";
  else if (dent_depth_mm > 0) severity = "minor";
  else severity = "negligible";

  if (structuralRole === "primary" && severity === "moderate") severity = "significant";
  if (structuralRole === "primary" && severity === "minor") severity = "moderate";

  var severityDef = DAMAGE_SEVERITY[severity];

  var followUp = [];
  if (severity === "catastrophic" || severity === "severe") {
    followUp.push("Emergency structural assessment");
    followUp.push("Detailed underwater inspection with cleaning");
    followUp.push("FEA analysis of damaged member");
    followUp.push("Fracture mechanics assessment per BS 7910");
  } else if (severity === "significant" || severity === "moderate") {
    followUp.push("Detailed inspection of damage area");
    followUp.push("UT wall thickness measurement");
    followUp.push("Coating condition assessment");
    followUp.push("CP survey at damage location");
    followUp.push("Engineering assessment of structural impact");
  } else {
    followUp.push("Record damage in inspection database");
    followUp.push("Monitor at next scheduled inspection");
  }

  var latentTimeline = [];
  if (eventDef.latent_damage) {
    for (var i = 0; i < eventDef.latent_damage.length; i++) {
      var latent = eventDef.latent_damage[i];
      var onset = "months";
      if (latent.indexOf("fatigue") >= 0) onset = "months_to_years";
      if (latent.indexOf("corrosion") >= 0) onset = "weeks_to_months";
      if (latent.indexOf("CP") >= 0) onset = "immediate";
      if (latent.indexOf("load_path") >= 0) onset = "immediate";

      latentTimeline.push({
        effect: latent,
        onset: onset,
        detectable_by: latent.indexOf("fatigue") >= 0 ? "MPI/UT at next inspection" :
                       latent.indexOf("corrosion") >= 0 ? "Visual/UT monitoring" :
                       latent.indexOf("CP") >= 0 ? "CP survey" :
                       "Engineering analysis"
      });
    }
  }

  return {
    event_type: eventType,
    event_name: eventDef.name,
    category: eventDef.category,
    energy_level: eventDef.energy_level,
    asset_type: assetType,
    zone: zone,
    structural_role: structuralRole,
    damage_measurements: {
      dent_depth_mm: dent_depth_mm,
      member_diameter_mm: member_diameter_mm,
      wall_thickness_mm: wall_thickness_mm,
      dent_diameter_ratio: Math.round(dentRatio * 1000) / 1000,
      dent_wall_ratio: Math.round(dentWallRatio * 100) / 100
    },
    severity: {
      classification: severity,
      level: severityDef.level,
      name: severityDef.name,
      description: severityDef.description,
      recommended_action: severityDef.action
    },
    immediate_damage: eventDef.immediate_damage,
    latent_damage: eventDef.latent_damage,
    latent_timeline: latentTimeline,
    typical_indicators: eventDef.typical_indicators,
    requires_immediate_assessment: eventDef.requires_immediate_assessment,
    follow_up_required: followUp,
    special_note: eventDef.special_note || null,
    assumptions_for_mesh: {
      coating_condition: severity === "negligible" ? "intact" : (severity === "minor" ? "minor_degradation" : "failed"),
      cp_effectiveness: dent_depth_mm > 0 ? "possibly_disrupted" : "assumed_effective",
      stress_state: dentRatio > 0.03 ? "elevated" : "design_basis",
      fatigue_state: dentRatio > 0.01 ? "crack_initiation_possible" : "within_design_life"
    },
    klein_bottle_note: "A single external event creates damage on one continuous surface: the dent is also a coating breach, a CP disruption, a fatigue site, and a corrosion accelerator. All consequences unfold simultaneously from one impact point."
  };
}

function evaluateEntanglement(input) {
  var material = input.entanglement_material || "fishing_net";
  var wrapAngle = input.wrap_angle_degrees || 180;
  var currentVelocity = input.current_velocity_ms || 1.0;
  var memberDiameter = input.member_diameter_mm || 500;
  var estimatedDragArea = input.drag_area_m2 || 2.0;

  var seawaterDensity = 1025;
  var cd = 1.2;
  var dragForce = 0.5 * seawaterDensity * cd * estimatedDragArea * currentVelocity * currentVelocity;

  var cyclicAmplitude = dragForce * 0.3;
  var cyclicFrequency = "wave_period_dependent";

  var wrapFactor = wrapAngle / 360;
  var effectiveTension = dragForce * (1 + wrapFactor);

  var fatigueRisk = "low";
  if (dragForce > 5000) fatigueRisk = "critical";
  else if (dragForce > 2000) fatigueRisk = "high";
  else if (dragForce > 500) fatigueRisk = "moderate";

  return {
    entanglement_material: material,
    wrap_angle_degrees: wrapAngle,
    current_velocity_ms: currentVelocity,
    member_diameter_mm: memberDiameter,
    drag_area_m2: estimatedDragArea,
    forces: {
      mean_drag_N: Math.round(dragForce),
      cyclic_amplitude_N: Math.round(cyclicAmplitude),
      cyclic_frequency: cyclicFrequency,
      effective_tension_N: Math.round(effectiveTension),
      wrap_factor: Math.round(wrapFactor * 100) / 100
    },
    risk: {
      fatigue_risk: fatigueRisk,
      abrasion_risk: wrapAngle > 90 ? "high" : "moderate",
      coating_damage: "progressive",
      cp_disruption: wrapAngle > 180 ? "likely" : "possible"
    },
    action: fatigueRisk === "critical" ? "URGENT: Remove entanglement immediately. Fatigue damage accumulating." :
            fatigueRisk === "high" ? "Priority removal. Inspect member after removal for fatigue damage." :
            "Plan removal at next opportunity. Monitor for progression.",
    critical_insight: "Entanglement is NOT a static load. Ocean current makes it a dynamic, oscillating force. Every wave cycle adds fatigue damage. Duration of entanglement directly determines fatigue impact."
  };
}

function assessScour(input) {
  var exposedLength = input.exposed_length_m || 0;
  var originalBurial = input.original_burial_m || 1.0;
  var scourDepth = input.scour_depth_m || 0.5;
  var assetType = input.asset_type || "pile";
  var soilType = input.soil_type || "sand";

  var exposureRatio = originalBurial > 0 ? scourDepth / originalBurial : 1;

  var severity = "low";
  if (exposureRatio > 0.8) severity = "critical";
  else if (exposureRatio > 0.5) severity = "high";
  else if (exposureRatio > 0.2) severity = "moderate";

  var consequences = [];
  consequences.push("Previously buried steel now exposed to seawater corrosion");
  if (assetType === "pile" || assetType === "suction_pile") {
    consequences.push("Reduced lateral support — effective cantilever length increased");
    consequences.push("Foundation capacity may be reduced");
    consequences.push("Natural frequency change — fatigue reassessment needed");
  }
  if (assetType === "pipeline") {
    consequences.push("Free span created — VIV and fatigue assessment required");
    consequences.push("Upheaval buckling risk if pipeline was restrained by burial");
  }
  consequences.push("Coating on newly exposed section may not be suitable for immersion");
  consequences.push("CP system not designed for this much bare steel exposure");

  return {
    scour_depth_m: scourDepth,
    original_burial_m: originalBurial,
    exposed_length_m: exposedLength,
    exposure_ratio: Math.round(exposureRatio * 100) / 100,
    severity: severity,
    soil_type: soilType,
    progressive: soilType === "sand" ? "likely_progressive" : "may_stabilize",
    consequences: consequences,
    required_actions: severity === "critical" ? ["Immediate structural reassessment", "Scour protection installation", "CP survey of exposed section", "Foundation capacity check"] :
                      severity === "high" ? ["Engineering assessment", "Monitor scour progression", "Plan scour protection", "CP check"] :
                      ["Monitor at next survey", "Record scour dimensions"],
    klein_bottle_note: "Scour transforms buried steel into submerged steel — changing the corrosion environment, CP demand, structural model, and fatigue life simultaneously. The seabed is not a fixed boundary."
  };
}

// ============================================================
// HANDLER
// ============================================================

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";

    if (action === "get_registry") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: ENGINE_ID,
          version: ENGINE_VERSION,
          deploy: DEPLOY,
          mode: "deterministic",
          purpose: "External Interaction & Trauma Engine — anchor strikes, trawl impacts, dropped objects, scour, entanglement",
          event_types: Object.keys(EVENT_TYPES).length,
          damage_severity_levels: Object.keys(DAMAGE_SEVERITY).length,
          actions: [
            "evaluate_event — full external event assessment",
            "map_damage_signature — event type to expected damage patterns",
            "classify_immediate_latent — separate immediate vs latent effects",
            "evaluate_entanglement — sustained entanglement load assessment",
            "assess_scour — scour exposure assessment",
            "get_event_registry — all event types",
            "get_registry — engine metadata"
          ]
        })
      };
    }

    if (action === "evaluate_event") {
      if (!body.event_type) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "event_type required" }) };
      var eventResult = evaluateEvent(body);
      try {
        var sb = createClient(supabaseUrl, supabaseKey);
        await sb.from("external_events").insert({
          org_id: body.org_id || null,
          case_id: body.case_id || null,
          event_type: body.event_type,
          severity: eventResult.severity ? eventResult.severity.classification : "unknown",
          result_json: eventResult
        });
      } catch (dbErr) { /* non-fatal */ }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: eventResult }, null, 2) };
    }

    if (action === "map_damage_signature") {
      var evType = body.event_type;
      if (!evType || !EVENT_TYPES[evType]) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Valid event_type required" }) };
      var ev = EVENT_TYPES[evType];
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, event_type: evType, immediate_damage: ev.immediate_damage, latent_damage: ev.latent_damage, typical_indicators: ev.typical_indicators }, null, 2) };
    }

    if (action === "classify_immediate_latent") {
      var clEvType = body.event_type;
      if (!clEvType || !EVENT_TYPES[clEvType]) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Valid event_type required" }) };
      var clEv = EVENT_TYPES[clEvType];
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, event_type: clEvType, immediate: clEv.immediate_damage, latent: clEv.latent_damage, rule: "Latent damage must trigger timeline simulation even if visible damage is minor" }, null, 2) };
    }

    if (action === "evaluate_entanglement") {
      var entResult = evaluateEntanglement(body);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: entResult }, null, 2) };
    }

    if (action === "assess_scour") {
      var scourResult = assessScour(body);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: scourResult }, null, 2) };
    }

    if (action === "get_event_registry") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, event_types: EVENT_TYPES, damage_severity: DAMAGE_SEVERITY }, null, 2) };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
